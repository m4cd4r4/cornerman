// sheet.mjs: one sheet: its inputs, names, layers, undo list and public methods (cp01-cp33). The
// graph and value cache live in the engine the sheet is bound to (engine.mjs); a workbook rebinds it.
import { normalise, compareAddresses, rangeKeys } from "./address.mjs";
import { makeError, throwAddr, withErrorOrder, errorOrderOption } from "./errors.mjs";
import { evaluate } from "./evaluate.mjs";
import { parseEntry, reachable, recalcOrder } from "./graph.mjs";
import { createEngine } from "./engine.mjs";
import { insertRows, deleteRows, insertCols, deleteCols } from "./structure.mjs";
import { copyWrites } from "./copy.mjs";
import { canonicalInput } from "./canonical.mjs";
import { explainTree } from "./explain.mjs";
import { createHistory, snapshot, sameState } from "./history.mjs";
import { toCSV, csvWrites } from "./csv.mjs";
import { saveText, parseSave } from "./persist.mjs";
import { addV2 } from "./api2.mjs";
import { createLayers } from "./layers.mjs";
import { addFeatures } from "./features.mjs";
import { addNames } from "./namedefs.mjs";
import { addHiding } from "./hiding.mjs";
import { leftOut } from "./subtotal.mjs";
import { addFindReplace } from "./findreplace.mjs";

const NUMBER = /^-?\d+(\.\d+)?$/;
const sorted = (xs) => [...xs].sort(compareAddresses);

export const CORE = new WeakMap(); // sheet object -> its core, for workbook.mjs

export const createSheet = (opts) => makeSheet(null, errorOrderOption(opts));
export const loadSheet = (json, opts) => { const order = errorOrderOption(opts); return makeSheet(parseSave(json), order); };

// init = { inputs, names } from a save, or null for an empty sheet.
export function makeSheet(init, order = "priority") {
  const inputs = new Map(); // key -> raw string
  const parsed = new Map(); // key -> { ast, refs } | { parseError }
  const names = new Map(); // NAME -> { a, b, range }
  const nameUsers = new Map(); // NAME -> Set of formula keys whose text uses it
  const stats = { evaluations: 0 };
  const history = createHistory();
  // formats, notes, rules, merges, hidden rows and columns (cp41-cp49)
  const layers = createLayers((keys) => invalidate(keys), () => engine.invalidateSheet(id));
  let engine = null;
  let id = 0;
  const g = (k) => `${id}|${k}`;

  function key(address) {
    const k = normalise(address);
    if (!k) throwAddr(address);
    return k;
  }

  // Graph keys k reads: its own cells, cells on sheets that exist now, and its names' cells.
  function precedentsOf(k) {
    const p = parsed.get(k);
    const out = new Set();
    for (const c of p.refs.cells) {
      const i = c.indexOf("!");
      if (i < 0) { out.add(g(c)); continue; }
      const sid = engine.resolve(c.slice(0, i));
      if (sid !== null) out.add(`${sid}|${c.slice(i + 1)}`);
    }
    for (const n of p.refs.names) {
      const d = nameOf(n);
      const sid = d && d.sheet ? engine.resolve(d.sheet) : id;
      if (d && d.a && sid !== null) for (const c of rangeKeys(d.a, d.b)) out.add(`${sid}|${c}`);
    }
    return [...out];
  }

  // Re-derive k's outgoing edges after its formula, a name it uses, or a sheet it names changed.
  function relink(k) {
    const p = parsed.get(k);
    if (p && p.refs) engine.link(g(k), precedentsOf(k), p.refs.sheets);
    else engine.unlink(g(k));
  }

  const invalidate = (keys) => engine.invalidate(keys.map(g));
  const nameOf = (n) => names.get(n) || engine.bookName(n); // cp53: own names hide workbook names
  const edgesOf = (k) => engine.ownPrecs(id, k);

  // A cell reference in a formula: own cell, or "NAME!A1" on another sheet.
  function read(k, a) {
    const i = a.indexOf("!");
    if (i < 0) return valueOf(a);
    const sid = engine.resolve(a.slice(0, i));
    return sid === null ? makeError("#REF!", k, `no sheet named ${a.slice(0, i)}`) : engine.valueAt(sid, a.slice(i + 1));
  }

  function valueOf(k) {
    const raw = inputs.get(k);
    if (raw === undefined || layers.L.covered.has(k)) return null;
    if (!raw.startsWith("=")) {
      if (NUMBER.test(raw)) {
        const n = Number(raw);
        return n === 0 ? 0 : n;
      }
      return raw;
    }
    return engine.cache.has(g(k)) ? engine.cache.get(g(k)) : engine.evaluateCell(core, k);
  }

  // Evaluate the formula at k now; engine.evaluateCell calls it, and an unwind (cp36) leaves no count.
  function compute(k) {
    const p = parsed.get(k);
    let v;
    if (p.parseError) v = makeError("#PARSE!", k, p.parseError);
    else if (engine.onCycle(g(k))) v = makeError("#CYCLE!", k, "circular reference");
    else {
      const ctx = { cell: k, read: (a) => read(k, a), name: nameOf, sheet: (n) => engine.resolve(n) !== null, skip };
      v = withErrorOrder(engine.errorOrder, () => evaluate(p.ast, ctx));
    }
    const out = v === null ? 0 : typeof v === "number" && v === 0 ? 0 : v;
    stats.evaluations++;
    engine.cache.set(g(k), out);
    return out;
  }

  // cp50: whether SUBTOTAL leaves out a cell it reads, own ("A1") or on another sheet ("NAME!A1").
  const skipped = (k) => leftOut(k, parsed.get(k), layers.L.rows);
  function skip(a) {
    const i = a.indexOf("!");
    if (i < 0) return skipped(a);
    const sid = engine.resolve(a.slice(0, i));
    return sid !== null && engine.coreOf(sid).skipped(a.slice(i + 1));
  }

  function setNameUsers(k, add) {
    const p = parsed.get(k);
    for (const n of (p && p.refs && p.refs.names) || []) {
      if (!nameUsers.has(n)) nameUsers.set(n, new Set());
      if (add) nameUsers.get(n).add(k);
      else nameUsers.get(n).delete(k);
    }
  }

  function nameChanged(n) {
    const users = [...(nameUsers.get(n) || [])];
    for (const k of users) relink(k);
    invalidate(users);
  }

  function parseInto(k, input) {
    const e = parseEntry(input);
    if (e) parsed.set(k, e);
    else parsed.delete(k);
  }

  // After a structural change: swap in the moved inputs, names and layers, rebuild every index.
  // Cells on other sheets that read this one are invalidated before and after the swap.
  function rebuild(next) {
    invalidate([...inputs.keys()]);
    for (const k of inputs.keys()) engine.unlink(g(k));
    inputs.clear();
    names.clear();
    for (const [k, v] of next.inputs) inputs.set(k, v);
    for (const [n, d] of next.names) names.set(n, d);
    layers.load(next);
    for (const m of [parsed, nameUsers]) m.clear();
    for (const [k, v] of inputs) parseInto(k, v);
    for (const k of inputs.keys()) { setNameUsers(k, true); relink(k); }
    invalidate([...inputs.keys()]);
  }

  // One cell's new input; false when it already held it.
  function write(k, input) {
    if ((inputs.get(k) ?? "") === input) return false;
    setNameUsers(k, false);
    if (input === "") {
      inputs.delete(k);
      parsed.delete(k);
    } else {
      inputs.set(k, input);
      parseInto(k, input);
    }
    setNameUsers(k, true);
    relink(k);
    invalidate([k]);
    return true;
  }

  // Apply [key, input] writes as one undo step; only cells that changed are recorded.
  function writeAll(writes) {
    const diffs = [];
    for (const [k, input] of writes) {
      const before = inputs.get(k) ?? "";
      if (write(k, input)) diffs.push([k, before, input]);
    }
    if (diffs.length) history.record({ cells: diffs });
  }

  function setName(n, d) {
    if (d === undefined) names.delete(n);
    else names.set(n, d);
    nameChanged(n);
  }

  // A structural op: next = { inputs, names, ...layers } from structure.mjs.
  const state = () => snapshot(inputs, names, layers);
  function restructure(next) {
    const before = state();
    rebuild(next);
    if (!sameState(before, next)) history.record({ state: { before, after: state() } });
  }

  function applyEntry(e, side) {
    if (e.layer) layers.applyEntry(e, side);
    else if (e.cells) {
      const list = side === "before" ? [...e.cells].reverse() : e.cells;
      for (const [k, before, after] of list) write(k, side === "before" ? before : after);
    } else if (e.state) rebuild(e.state[side]);
    else setName(e.name, e[side]);
  }

  // Move the sheet into an engine (a workbook's, or a fresh one of its own when name is null).
  function bind(next, name) {
    if (engine) engine.remove(id);
    engine = next;
    id = engine.register(core, name);
    for (const k of parsed.keys()) relink(k);
    if (name !== null) engine.announce(name);
  }

  // cp37: a sheet of the workbook was renamed (or deleted, cp54); rewrite(input) is each input's new
  // text. Not undoable. Returns how many inputs changed.
  function renamed(rewrite) {
    const changed = [...inputs.values()].filter((v) => rewrite(v) !== v).length;
    rebuild({ ...state(), inputs: new Map([...inputs].map(([k, v]) => [k, rewrite(v)])) });
    history.clear();
    return changed;
  }

  const shown = (k) => layers.show(k, valueOf(k));
  const core = { valueOf, compute, relink, bind, key, writeAll: (w) => writeAll(layers.check(w)), writeRaw: writeAll, renamed, layers, history, names, setName, nameChanged, skipped, input: (k) => inputs.get(k) ?? null, keys: () => inputs.keys() };
  bind(createEngine(order), null);
  if (init) rebuild(init);

  const sheet = {
    save() {
      return saveText(inputs, names, layers.L.notes);
    },
    set(address, input) {
      writeAll(layers.check([[key(address), input]]));
    },
    copy(from, to) {
      const w = copyWrites(inputs, from, to);
      history.group(() => { writeAll(w); history.record(layers.write("formats", w.map(([t, , s]) => [t, layers.L.formats.get(s)]))); });
    },
    toCSV(opts = {}) {
      const text = opts.formulas ? (k) => (layers.L.covered.has(k) ? "" : inputs.get(k) ?? "") : shown;
      return toCSV(sorted(inputs.keys()), text, layers.L);
    },
    fromCSV(text, at = "A1") {
      writeAll(layers.check(csvWrites(text, at)));
    },
    undo() {
      return history.undo(applyEntry);
    },
    redo() {
      return history.redo(applyEntry);
    },
    get(address) {
      return valueOf(key(address));
    },
    getInput(address) {
      const raw = inputs.get(key(address));
      return raw === undefined ? null : raw;
    },
    explain: (address) => explainTree(engine, id, key(address)),
    canonical: (address) => canonicalInput(inputs.get(key(address)) ?? null),
    display: (address) => shown(key(address)),
    cells: () => sorted(inputs.keys()),
    stats: () => ({ evaluations: stats.evaluations }),
    precedents(address, opts = {}) {
      const k = g(key(address));
      return engine.labels(opts.transitive ? reachable(k, engine.precs) : engine.precs(k), id);
    },
    dependents(address, opts = {}) {
      const k = g(key(address));
      return engine.labels(opts.transitive ? reachable(k, engine.deps) : engine.deps(k), id);
    },
    recalc() {
      const dirty = sorted(parsed.keys()).filter((k) => !engine.cache.has(g(k)) && !layers.L.covered.has(k));
      const order = recalcOrder(dirty, edgesOf);
      for (const k of order) valueOf(k);
      return order;
    },
    insertRows: (at, count = 1) => restructure(insertRows(inputs, names, at, count, state())),
    deleteRows: (at, count = 1) => restructure(deleteRows(inputs, names, at, count, state())),
    insertCols: (at, count = 1) => restructure(insertCols(inputs, names, at, count, state())),
    deleteCols: (at, count = 1) => restructure(deleteCols(inputs, names, at, count, state())),
  };
  CORE.set(sheet, core);
  return addV2(addFindReplace(addHiding(addNames(addFeatures(sheet, core), core), core), core), core);
}
