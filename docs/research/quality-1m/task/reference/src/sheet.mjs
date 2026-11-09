// sheet.mjs: one sheet: its inputs, names, undo list and public methods (cp01-cp33). The graph and
// value cache live in the engine the sheet is bound to (engine.mjs); a workbook rebinds it.
import { normalise, compareAddresses, rangeKeys } from "./address.mjs";
import { makeError, throwAddr, withErrorOrder, errorOrderOption } from "./errors.mjs";
import { parseFormula, ParseError } from "./parser.mjs";
import { evaluate } from "./evaluate.mjs";
import { displayValue } from "./display.mjs";
import { collectRefs, reachable, recalcOrder } from "./graph.mjs";
import { createEngine } from "./engine.mjs";
import { checkName, parseNameRef, nameText } from "./names.mjs";
import { insertRows, deleteRows, insertCols, deleteCols } from "./structure.mjs";
import { copyWrites } from "./copy.mjs";
import { createHistory, snapshot, sameState } from "./history.mjs";
import { toCSV, csvWrites } from "./csv.mjs";
import { saveText, parseSave } from "./persist.mjs";
import { addV2 } from "./api2.mjs";

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
      const d = names.get(n);
      if (d) for (const c of rangeKeys(d.a, d.b)) out.add(g(c));
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
    if (raw === undefined) return null;
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
      const ctx = { cell: k, read: (a) => read(k, a), name: (n) => names.get(n) || null, sheet: (n) => engine.resolve(n) !== null };
      v = withErrorOrder(engine.errorOrder, () => evaluate(p.ast, ctx));
    }
    const out = v === null ? 0 : typeof v === "number" && v === 0 ? 0 : v;
    stats.evaluations++;
    engine.cache.set(g(k), out);
    return out;
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
    if (!input.startsWith("=")) { parsed.delete(k); return; }
    try {
      const ast = parseFormula(input.slice(1));
      parsed.set(k, { ast, refs: collectRefs(ast) });
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      parsed.set(k, { parseError: e.message });
    }
  }

  // After a structural change: swap in the moved inputs and names, rebuild every index.
  // Cells on other sheets that read this one are invalidated before and after the swap.
  function rebuild(next) {
    invalidate([...inputs.keys()]);
    for (const k of inputs.keys()) engine.unlink(g(k));
    inputs.clear();
    names.clear();
    for (const [k, v] of next.inputs) inputs.set(k, v);
    for (const [n, d] of next.names) names.set(n, d);
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

  // A structural op: next = { inputs, names } from structure.mjs.
  function restructure(next) {
    const before = snapshot(inputs, names);
    rebuild(next);
    if (!sameState(before, next)) history.record({ state: { before, after: snapshot(inputs, names) } });
  }

  function applyEntry(e, side) {
    if (e.cells) {
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

  const core = { valueOf, compute, relink, bind, key, writeAll, keys: () => inputs.keys() };
  bind(createEngine(order), null);
  if (init) rebuild(init);

  const sheet = {
    save() {
      return saveText(inputs, names);
    },
    set(address, input) {
      writeAll([[key(address), input]]);
    },
    copy(from, to) {
      writeAll(copyWrites(inputs, from, to));
    },
    toCSV(opts = {}) {
      const text = opts.formulas ? (k) => inputs.get(k) ?? "" : (k) => displayValue(valueOf(k));
      return toCSV(sorted(inputs.keys()), text);
    },
    fromCSV(text, at = "A1") {
      writeAll(csvWrites(text, at));
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
    display(address) {
      return displayValue(valueOf(key(address)));
    },
    cells() {
      return sorted(inputs.keys());
    },
    stats() {
      return { evaluations: stats.evaluations };
    },
    precedents(address, opts = {}) {
      const k = g(key(address));
      return engine.labels(opts.transitive ? reachable(k, engine.precs) : engine.precs(k), id);
    },
    dependents(address, opts = {}) {
      const k = g(key(address));
      return engine.labels(opts.transitive ? reachable(k, engine.deps) : engine.deps(k), id);
    },
    recalc() {
      const dirty = sorted(parsed.keys()).filter((k) => !engine.cache.has(g(k)));
      const order = recalcOrder(dirty, edgesOf);
      for (const k of order) valueOf(k);
      return order;
    },
    defineName(name, ref) {
      const n = checkName(name);
      const d = parseNameRef(ref);
      const before = names.get(n);
      if (before && JSON.stringify(before) === JSON.stringify(d)) return;
      setName(n, d);
      history.record({ name: n, before, after: d });
    },
    removeName(name) {
      const n = typeof name === "string" ? name.toUpperCase() : "";
      if (!names.has(n)) return false;
      history.record({ name: n, before: names.get(n), after: undefined });
      setName(n, undefined);
      return true;
    },
    insertRows(at, count = 1) {
      restructure(insertRows(inputs, names, at, count));
    },
    deleteRows(at, count = 1) {
      restructure(deleteRows(inputs, names, at, count));
    },
    insertCols(at, count = 1) {
      restructure(insertCols(inputs, names, at, count));
    },
    deleteCols(at, count = 1) {
      restructure(deleteCols(inputs, names, at, count));
    },
    names() {
      const out = {};
      for (const n of [...names.keys()].sort()) out[n] = nameText(names.get(n));
      return out;
    },
  };
  CORE.set(sheet, core);
  return addV2(sheet, core);
}
