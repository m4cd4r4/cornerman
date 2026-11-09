// graph.mjs: dependency graph helpers: parsed inputs, references in a tree, cycles, recalc order (cp09-cp14).
import { rangeKeys, compareAddresses } from "./address.mjs";
import { parseFormula, ParseError } from "./parser.mjs";

// What a sheet keeps for an input: { ast, refs } for a formula, { parseError } for one that does
// not parse, null for a value.
export function parseEntry(input) {
  if (!input.startsWith("=")) return null;
  try {
    const ast = parseFormula(input.slice(1));
    return { ast, refs: collectRefs(ast) };
  } catch (e) {
    if (!(e instanceof ParseError)) throw e;
    return { parseError: e.message };
  }
}

// Cells, names and sheet names written in a formula tree. Bad or over-size ranges add no cells.
// A cell on another sheet is "NAME!A1" (cp31).
export function collectRefs(ast) {
  const cells = new Set();
  const names = new Set();
  const sheets = new Set();
  const at = (n, k) => (n.sheet ? `${n.sheet}!${k}` : k);
  (function walk(n) {
    if (n.sheet) sheets.add(n.sheet);
    switch (n.k) {
      case "ref": cells.add(at(n, n.addr)); break;
      case "range":
        if (n.a.k === "ref" && n.b.k === "ref") {
          const ks = rangeKeys(n.a.addr, n.b.addr);
          if (ks) for (const k of ks) cells.add(at(n, k));
        }
        break;
      case "name": names.add(n.v); break;
      case "bin": walk(n.left); walk(n.right); break;
      case "neg": case "pct": walk(n.arg); break;
      case "call": n.args.forEach(walk); break;
    }
  })(ast);
  return { cells: [...cells], names: [...names], sheets: [...sheets] };
}

// Strongly connected components (iterative Tarjan). succ(n) returns successors inside the graph.
export function sccs(nodes, succ) {
  let next = 0;
  const idx = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const out = [];
  const open = (v, work) => {
    idx.set(v, next); low.set(v, next); next++;
    stack.push(v); onStack.add(v);
    work.push([v, succ(v), 0]);
  };
  for (const start of nodes) {
    if (idx.has(start)) continue;
    const work = [];
    open(start, work);
    while (work.length) {
      const top = work[work.length - 1];
      const [v, ss] = top;
      if (top[2] < ss.length) {
        const w = ss[top[2]++];
        if (!idx.has(w)) open(w, work);
        else if (onStack.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
        continue;
      }
      work.pop();
      if (work.length) {
        const u = work[work.length - 1][0];
        low.set(u, Math.min(low.get(u), low.get(v)));
      }
      if (low.get(v) === idx.get(v)) {
        const comp = [];
        let w;
        do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
        out.push(comp);
      }
    }
  }
  return out;
}

// Nodes on a cycle: components of 2+ nodes, or a node that is its own successor.
export function cycleNodes(nodes, succ) {
  const out = new Set();
  for (const c of sccs(nodes, succ)) {
    if (c.length > 1 || succ(c[0]).includes(c[0])) for (const k of c) out.add(k);
  }
  return out;
}

// Everything reachable from start through next(); start itself only if a path returns to it.
export function reachable(start, next) {
  const seen = new Set();
  const todo = [...next(start)];
  while (todo.length) {
    const k = todo.pop();
    if (seen.has(k)) continue;
    seen.add(k);
    for (const x of next(k)) if (!seen.has(x)) todo.push(x);
  }
  return seen;
}

// cp12: order to evaluate `dirty` cells. A cell comes after its dirty precedents; a cycle is one
// group placed by its row-major-first member; among cells free to go, row-major first.
export function recalcOrder(dirty, prec) {
  const inSet = new Set(dirty);
  const succ = (k) => prec(k).filter((x) => inSet.has(x));
  const comps = sccs(dirty, succ).map((c) => c.sort(compareAddresses));
  const compOf = new Map();
  comps.forEach((c, i) => c.forEach((k) => compOf.set(k, i)));
  const need = comps.map(() => new Set());
  const users = comps.map(() => new Set());
  for (const k of dirty) {
    for (const p of succ(k)) {
      const ci = compOf.get(k);
      const pi = compOf.get(p);
      if (ci !== pi) { need[ci].add(pi); users[pi].add(ci); }
    }
  }
  const ready = comps.map((_, i) => i).filter((i) => need[i].size === 0);
  const order = [];
  while (ready.length) {
    ready.sort((x, y) => compareAddresses(comps[x][0], comps[y][0]));
    const i = ready.shift();
    order.push(...comps[i]);
    for (const u of users[i]) {
      need[u].delete(i);
      if (need[u].size === 0) ready.push(u);
    }
  }
  return order;
}
