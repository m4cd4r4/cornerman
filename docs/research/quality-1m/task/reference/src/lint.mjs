// lint.mjs: sheet.lint() (cp73): the sheet's own names that no formula uses, then the one-cell
// references written in formulas that read an empty cell. Reads formula text only: evaluates nothing.
import { parseEntry } from "./graph.mjs";
import { compareAddresses } from "./address.mjs";

// The one-cell references a formula tree writes, in source order. Range corners are not one.
function cellRefs(ast) {
  const out = [];
  (function walk(n) {
    switch (n.k) {
      case "ref": out.push(n); break;
      case "bin": walk(n.left); walk(n.right); break;
      case "neg": case "pct": walk(n.arg); break;
      case "call": n.args.forEach(walk); break;
    }
  })(ast);
  return out;
}

// core.peer(sheetName | null) -> { core, rank, label(addr) } for that sheet, or null when there is none.
function emptyRefs(core, k, ast) {
  const seen = new Set();
  const here = [];
  for (const r of cellRefs(ast)) {
    const p = core.peer(r.sheet || null);
    if (!p) continue;
    const label = p.label(r.addr);
    const empty = p.core.input(r.addr) === null || p.core.layers.L.covered.has(r.addr);
    if (!empty || seen.has(label)) continue;
    seen.add(label);
    here.push({ rank: p.rank, addr: r.addr, label });
  }
  here.sort((x, y) => x.rank - y.rank || compareAddresses(x.addr, y.addr));
  return here.map((x) => ({ kind: "empty-ref", address: k, ref: x.label }));
}

export function addLint(sheet, core) {
  sheet.lint = () => {
    const used = new Set();
    const refs = [];
    for (const k of [...core.keys()].sort(compareAddresses)) {
      const e = parseEntry(core.input(k));
      if (!e || !e.ast) continue;
      for (const n of e.refs.names) used.add(n);
      refs.push(...emptyRefs(core, k, e.ast));
    }
    const unused = [...core.names.keys()].filter((n) => !used.has(n)).sort().map((name) => ({ kind: "unused-name", name }));
    return [...unused, ...refs];
  };
  return sheet;
}
