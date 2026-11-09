// structure.mjs: insert and delete rows and columns, with formula-text rewriting (cp23-cp25).
// Works on the raw inputs and names; index.mjs swaps the result in and rebuilds.
import { makeError } from "./errors.mjs";
import { parseRef, refText, rewriteRefs, MAX_ROW, MAX_COL } from "./refs.mjs";
import { moveLayers } from "./layers.mjs";

const AXES = {
  row: { max: MAX_ROW, word: "row", get: (p) => p.row, put: (p, v) => ({ ...p, row: v }) },
  col: { max: MAX_COL, word: "column", get: (p) => p.col, put: (p, v) => ({ ...p, col: v }) },
};

// Rows are numbers; columns are given as letters ("C", case-insensitive). Also cp49 hide and show.
export function position(axis, at, count) {
  const ax = AXES[axis];
  let pos = at;
  if (axis === "col") pos = typeof at === "string" && /^[A-Za-z]{1,2}$/.test(at) ? parseRef(at + "1").col : NaN;
  const ok = Number.isInteger(pos) && Number.isInteger(count) && pos >= 1 && pos <= ax.max && count >= 1 && pos + count - 1 <= ax.max;
  if (!ok) throw makeError("#ARG", String(at), `invalid ${ax.word} arguments: at=${at} count=${count}`);
  return pos;
}

// Lift a mapping on one coordinate to whole references, cells, names and layers (cp41 on).
function apply(inputs, names, axis, one, range, layers) {
  const ax = AXES[axis];
  const oneP = (p) => {
    const v = one(ax.get(p));
    return v === null ? null : ax.put(p, v);
  };
  const rangeP = (a, b) => {
    const lo = Math.min(ax.get(a), ax.get(b));
    const hi = Math.max(ax.get(a), ax.get(b));
    const m = range(lo, hi);
    if (m === null) return null;
    // Each typed corner keeps its role (low or high) even if typed high-first.
    const fix = (p) => ax.put(p, ax.get(p) === lo ? m[0] : m[1]);
    return [fix(a), fix(b)];
  };
  const nextInputs = new Map();
  for (const [k, raw] of inputs) {
    const q = oneP(parseRef(k));
    if (q === null) continue;
    nextInputs.set(refText(q), raw.startsWith("=") ? "=" + rewriteRefs(raw.slice(1), oneP, rangeP, false) : raw);
  }
  const nextNames = new Map();
  for (const [n, d] of names) {
    const a = parseRef(d.a);
    const b = parseRef(d.b);
    const m = range(ax.get(a), ax.get(b));
    if (m === null) continue;
    nextNames.set(n, { a: refText(ax.put(a, m[0])), b: refText(ax.put(b, m[1])), range: d.range });
  }
  const cell = (k) => {
    const q = oneP(parseRef(k));
    return q === null ? null : refText(q);
  };
  const box = (m) => {
    const p = parseRef(m.a);
    const q = parseRef(m.b);
    const r = range(ax.get(p), ax.get(q));
    return r === null ? null : { a: refText(ax.put(p, r[0])), b: refText(ax.put(q, r[1])) };
  };
  const line = (layer, n) => (layer === (axis === "row" ? "rows" : "cols") ? one(n) : n);
  return { inputs: nextInputs, names: nextNames, ...moveLayers(layers, cell, box, line) };
}

function insert(axis, inputs, names, at, count, layers) {
  const ax = AXES[axis];
  const max = ax.max;
  const pos = position(axis, at, count);
  for (const k of inputs.keys()) {
    const p = ax.get(parseRef(k));
    if (p >= pos && p + count > max) {
      throw makeError("#FULL", String(at), `inserting ${count} ${ax.word}(s) would push ${k} off the sheet`);
    }
  }
  at = pos;
  const shift = (r) => (r >= at ? r + count : r);
  const one = (r) => (shift(r) > max ? null : shift(r));
  const range = (r1, r2) => {
    const a = one(r1);
    const b = one(r2);
    return a === null || b === null ? null : [a, b];
  };
  return apply(inputs, names, axis, one, range, layers);
}

function remove(axis, inputs, names, at, count, layers) {
  at = position(axis, at, count);
  const last = at + count - 1;
  const one = (r) => (r < at ? r : r > last ? r - count : null);
  const range = (r1, r2) => {
    if (r1 >= at && r2 <= last) return null;
    const a = r1 >= at && r1 <= last ? at : one(r1);
    const b = r2 >= at && r2 <= last ? at - 1 : one(r2);
    return [a, b];
  };
  return apply(inputs, names, axis, one, range, layers);
}

// layers = the sheet's layers snapshot (layers.mjs), moved like the cells.
export const insertRows = (inputs, names, at, count, layers) => insert("row", inputs, names, at, count, layers);
export const deleteRows = (inputs, names, at, count, layers) => remove("row", inputs, names, at, count, layers);
export const insertCols = (inputs, names, at, count, layers) => insert("col", inputs, names, at, count, layers);
export const deleteCols = (inputs, names, at, count, layers) => remove("col", inputs, names, at, count, layers);
