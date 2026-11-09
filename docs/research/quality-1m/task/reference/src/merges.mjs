// merges.mjs: merged ranges (cp47) as { a, b } boxes, top-left a and bottom-right b.
import { rangeBox, rangeKeys, compareAddresses } from "./address.mjs";

export const mergeText = (m) => `${m.a}:${m.b}`;
export const sortMerges = (list) => [...list].sort((x, y) => compareAddresses(x.a, y.a));

// Every cell a merge covers: all of its cells but the top-left one.
export function coveredBy(list) {
  const out = new Set();
  for (const m of list) for (const k of rangeKeys(m.a, m.b).slice(1)) out.add(k);
  return out;
}

export function overlaps(m, t) {
  const p = rangeBox(m.a, m.b);
  const q = rangeBox(t.a, t.b);
  return !(p.r2 < q.r1 || q.r2 < p.r1 || p.c2 < q.c1 || q.c2 < p.c1);
}

export const mergeAt = (list, k) => list.find((m) => overlaps(m, { a: k, b: k })) || null;

// Merges after a structural change: box(m) -> moved box | null. A merge cut to one cell is gone.
export function moveMerges(list, box) {
  const out = [];
  for (const m of list) {
    const n = box(m);
    if (n !== null && n.a !== n.b) out.push(n);
  }
  return sortMerges(out);
}
