// diff.mjs: diffWorkbooks(before, after) (cp70): what changed between two saves, as a list of
// sheets removed and added, cell inputs, sheet names and workbook names, in a fixed order.
import { makeError } from "./errors.mjs";
import { compareAddresses } from "./address.mjs";
import { loadWorkbook } from "./bookio.mjs";

// The workbook in a save text; a #LOAD error gets `side` before its cell ("after.sheets.0.name").
function load(text, side) {
  try {
    return loadWorkbook(text);
  } catch (e) {
    if (e && e.code === "#LOAD") throw makeError("#LOAD", e.cell === "" ? side : `${side}.${e.cell}`, e.message);
    throw e;
  }
}

// Keys of x and y (plain objects) whose values differ, in order(a, b); missing values are null.
function changed(x, y, order) {
  const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].sort(order);
  return keys.filter((k) => (x[k] ?? null) !== (y[k] ?? null)).map((k) => [k, x[k] ?? null, y[k] ?? null]);
}
const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const inputsOf = (s) => Object.fromEntries(s.cells().map((k) => [k, s.getInput(k)]));

export function diffWorkbooks(before, after) {
  const a = load(before, "before");
  const b = load(after, "after");
  const has = (book, name) => book.sheetNames().some((n) => n.toUpperCase() === name.toUpperCase());
  const out = [];
  for (const n of a.sheetNames()) if (!has(b, n)) out.push({ kind: "sheet-removed", sheet: n });
  for (const n of b.sheetNames()) if (!has(a, n)) out.push({ kind: "sheet-added", sheet: n });
  for (const n of b.sheetNames()) {
    if (!has(a, n)) continue;
    const [x, y] = [a.sheet(n), b.sheet(n)];
    for (const [cell, was, now] of changed(inputsOf(x), inputsOf(y), compareAddresses)) out.push({ kind: "cell", sheet: n, cell, before: was, after: now });
    for (const [name, was, now] of changed(x.names(), y.names(), byName)) out.push({ kind: "name", sheet: n, name, before: was, after: now });
  }
  for (const [name, was, now] of changed(a.names(), b.names(), byName)) out.push({ kind: "name", sheet: null, name, before: was, after: now });
  return out;
}
