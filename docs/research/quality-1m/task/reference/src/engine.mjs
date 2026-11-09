// engine.mjs: the dependency graph, value cache and sheet registry shared by the sheets of one
// workbook (cp31-cp32). A sheet made by createSheet() has an engine of its own with no names in it.
// Graph keys are "<sheet id>|<address>"; sheet ids count up in creation order.
import { compareAddresses } from "./address.mjs";
import { cycleNodes, reachable } from "./graph.mjs";

export const split = (g) => {
  const i = g.indexOf("|");
  return [Number(g.slice(0, i)), g.slice(i + 1)];
};

export function createEngine() {
  const sheets = new Map(); // id -> { core, name }
  const byName = new Map(); // NAME -> id
  const cache = new Map(); // graph key -> value
  const edges = new Map(); // formula key -> precedent keys
  const rdeps = new Map(); // key -> Set of formula keys that read it
  const mentions = new Map(); // formula key -> sheet NAMEs its text uses
  const sheetUsers = new Map(); // NAME -> Set of formula keys whose text uses it
  let cycles = null;
  let nextId = 1;

  const precs = (g) => edges.get(g) || [];
  const deps = (g) => [...(rdeps.get(g) || [])];

  function unlink(g) {
    for (const p of precs(g)) rdeps.get(p)?.delete(g);
    edges.delete(g);
    for (const n of mentions.get(g) || []) sheetUsers.get(n)?.delete(g);
    mentions.delete(g);
    cycles = null;
  }

  // g's precedents and the sheet names its formula text uses (whether or not they exist).
  function link(g, list, names) {
    unlink(g);
    edges.set(g, list);
    for (const x of list) {
      if (!rdeps.has(x)) rdeps.set(x, new Set());
      rdeps.get(x).add(g);
    }
    mentions.set(g, names);
    for (const n of names) {
      if (!sheetUsers.has(n)) sheetUsers.set(n, new Set());
      sheetUsers.get(n).add(g);
    }
  }

  function invalidate(keys) {
    for (const g of keys) {
      cache.delete(g);
      for (const d of reachable(g, deps)) cache.delete(d);
    }
  }

  // A sheet name appeared or went away: every formula that names it re-resolves.
  function refresh(name) {
    const users = [...(sheetUsers.get(name) || [])];
    for (const g of users) {
      const [id, addr] = split(g);
      sheets.get(id).core.relink(addr);
    }
    invalidate(users);
  }

  // Own-sheet addresses first (row-major), then "Name!A1" for other sheets in creation order.
  function labels(keys, ownId) {
    const rows = [...keys].map(split);
    rows.sort(([i, a], [j, b]) => (i === j ? compareAddresses(a, b) : i === ownId ? -1 : j === ownId ? 1 : i - j));
    return rows.map(([i, a]) => (i === ownId ? a : `${sheets.get(i).name}!${a}`));
  }

  // Own-sheet cells that id|k waits for in recalc order, following paths through other sheets.
  function ownPrecs(id, k) {
    const out = new Set();
    const seen = new Set();
    const todo = [...precs(`${id}|${k}`)];
    while (todo.length) {
      const x = todo.pop();
      if (seen.has(x)) continue;
      seen.add(x);
      const [sid, a] = split(x);
      if (sid === id) out.add(a);
      else todo.push(...precs(x));
    }
    return [...out];
  }

  return {
    cache,
    ownPrecs,
    precs,
    deps,
    link,
    unlink,
    invalidate,
    labels,
    register(core, name) {
      const id = nextId++;
      sheets.set(id, { core, name });
      if (name !== null) byName.set(name.toUpperCase(), id);
      return id;
    },
    announce(name) {
      refresh(name.toUpperCase());
    },
    // Drop a sheet: its cells leave the graph and formulas that named it re-resolve to #REF!.
    remove(id) {
      const { core, name } = sheets.get(id);
      invalidate([...core.keys()].map((a) => `${id}|${a}`));
      for (const a of core.keys()) unlink(`${id}|${a}`);
      sheets.delete(id);
      if (name !== null) {
        byName.delete(name.toUpperCase());
        refresh(name.toUpperCase());
      }
    },
    resolve(name) {
      return byName.get(name.toUpperCase()) ?? null;
    },
    valueAt(id, addr) {
      return sheets.get(id).core.valueOf(addr);
    },
    cycleSet() {
      if (!cycles) cycles = cycleNodes([...edges.keys()], precs);
      return cycles;
    },
  };
}
