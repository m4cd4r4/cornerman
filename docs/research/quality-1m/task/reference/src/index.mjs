// index.mjs: the sheet object and public API (cp01-cp25).
import { normalise, compareAddresses, rangeKeys } from "./address.mjs";
import { makeError, throwAddr } from "./errors.mjs";
import { parseFormula, ParseError } from "./parser.mjs";
import { evaluate } from "./evaluate.mjs";
import { displayValue } from "./display.mjs";
import { collectRefs, cycleNodes, reachable, recalcOrder } from "./graph.mjs";
import { checkName, parseNameRef, nameText } from "./names.mjs";
import { insertRows, deleteRows, insertCols, deleteCols } from "./structure.mjs";

const NUMBER = /^-?\d+(\.\d+)?$/;
const sorted = (xs) => [...xs].sort(compareAddresses);

export function createSheet() {
  const inputs = new Map(); // key -> raw string
  const parsed = new Map(); // key -> { ast, refs } | { parseError }
  const cache = new Map(); // key -> value
  const names = new Map(); // NAME -> { a, b, range }
  const edges = new Map(); // formula key -> precedent keys
  const rdeps = new Map(); // key -> Set of formula keys that read it
  const nameUsers = new Map(); // NAME -> Set of formula keys whose text uses it
  const stats = { evaluations: 0 };
  let cycles = null;

  function key(address) {
    const k = normalise(address);
    if (!k) throwAddr(address);
    return k;
  }

  function precedentsOf(k) {
    const p = parsed.get(k);
    if (!p || !p.refs) return [];
    const out = new Set(p.refs.cells);
    for (const n of p.refs.names) {
      const d = names.get(n);
      if (d) for (const c of rangeKeys(d.a, d.b)) out.add(c);
    }
    return [...out];
  }

  // Re-derive k's outgoing edges after its formula or a name it uses changed.
  function relink(k) {
    for (const p of edges.get(k) || []) rdeps.get(p)?.delete(k);
    edges.delete(k);
    const p = parsed.get(k);
    if (p && p.refs) {
      const prec = precedentsOf(k);
      edges.set(k, prec);
      for (const x of prec) {
        if (!rdeps.has(x)) rdeps.set(x, new Set());
        rdeps.get(x).add(k);
      }
    }
    cycles = null;
  }

  const dependentsOf = (k) => [...(rdeps.get(k) || [])];
  const edgesOf = (k) => edges.get(k) || [];

  function invalidate(keys) {
    for (const k of keys) {
      cache.delete(k);
      for (const d of reachable(k, dependentsOf)) cache.delete(d);
    }
  }

  function cycleSet() {
    if (!cycles) cycles = cycleNodes([...edges.keys()], edgesOf);
    return cycles;
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
    if (cache.has(k)) return cache.get(k);
    stats.evaluations++;
    const p = parsed.get(k);
    let v;
    if (p.parseError) v = makeError("#PARSE!", k, p.parseError);
    else if (cycleSet().has(k)) v = makeError("#CYCLE!", k, "circular reference");
    else v = evaluate(p.ast, { cell: k, read: (a) => valueOf(a), name: (n) => names.get(n) || null });
    const out = v === null ? 0 : typeof v === "number" && v === 0 ? 0 : v;
    cache.set(k, out);
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
  function rebuild(next) {
    inputs.clear();
    names.clear();
    for (const [k, v] of next.inputs) inputs.set(k, v);
    for (const [n, d] of next.names) names.set(n, d);
    for (const m of [parsed, cache, edges, rdeps, nameUsers]) m.clear();
    for (const [k, v] of inputs) parseInto(k, v);
    for (const k of inputs.keys()) { setNameUsers(k, true); relink(k); }
    cycles = null;
  }

  return {
    set(address, input) {
      const k = key(address);
      if ((inputs.get(k) ?? "") === input) return;
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
      const k = key(address);
      return sorted(opts.transitive ? reachable(k, edgesOf) : edgesOf(k));
    },
    dependents(address, opts = {}) {
      const k = key(address);
      return sorted(opts.transitive ? reachable(k, dependentsOf) : dependentsOf(k));
    },
    recalc() {
      const dirty = sorted([...edges.keys(), ...[...parsed.keys()].filter((k) => parsed.get(k).parseError)])
        .filter((k) => !cache.has(k));
      const order = recalcOrder(dirty, edgesOf);
      for (const k of order) valueOf(k);
      return order;
    },
    defineName(name, ref) {
      const n = checkName(name);
      names.set(n, parseNameRef(ref));
      nameChanged(n);
    },
    removeName(name) {
      const n = typeof name === "string" ? name.toUpperCase() : "";
      if (!names.has(n)) return false;
      names.delete(n);
      nameChanged(n);
      return true;
    },
    insertRows(at, count = 1) {
      rebuild(insertRows(inputs, names, at, count));
    },
    deleteRows(at, count = 1) {
      rebuild(deleteRows(inputs, names, at, count));
    },
    insertCols(at, count = 1) {
      rebuild(insertCols(inputs, names, at, count));
    },
    deleteCols(at, count = 1) {
      rebuild(deleteCols(inputs, names, at, count));
    },
    names() {
      const out = {};
      for (const n of [...names.keys()].sort()) out[n] = nameText(names.get(n));
      return out;
    },
  };
}
