// sort.mjs: the plan for sheet.sort(target, column, opts): which row of a range goes where (cp48).
import { colName } from "./address.mjs";
import { makeError, isError } from "./errors.mjs";
import { compareValues } from "./evaluate.mjs";
import { parseTarget } from "./layers.mjs";
import { overlaps } from "./merges.mjs";
import { parseRef } from "./refs.mjs";

// Ascending groups: numbers, text, booleans, errors, empty cells.
const group = (v) => (v === null ? 4 : isError(v) ? 3 : typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2);

// Order of two key values. Descending reverses the value groups and the order inside them;
// errors and empty cells stay last, and ties keep their order (the sort is stable).
export function compareKeys(a, b, descending) {
  let ga = group(a);
  let gb = group(b);
  if (descending && ga < 3) ga = 2 - ga;
  if (descending && gb < 3) gb = 2 - gb;
  if (ga !== gb) return ga - gb;
  if (ga >= 3) return 0;
  const c = compareValues(a, b);
  return descending ? -c : c;
}

// { t, from }: the target box and, for each of its rows in order, the row whose cells move there.
// Checks in order: target (#ADDR, #ARG), column (#ARG), opts (#ARG), merges (#MERGE).
export function sortPlan(target, column, opts, merges, valueOf) {
  const t = parseTarget(target);
  const col = typeof column === "string" && /^[A-Za-z]{1,2}$/.test(column) ? parseRef(column + "1").col : NaN;
  if (!(col >= t.c1 && col <= t.c2)) throw makeError("#ARG", String(column), `column ${column} is not in ${target}`);
  const plain = opts !== null && typeof opts === "object" && !Array.isArray(opts);
  if (opts !== undefined && !(plain && (opts.descending === undefined || typeof opts.descending === "boolean"))) {
    throw makeError("#ARG", "opts", "opts must be an object with an optional boolean descending");
  }
  if (merges.some((m) => overlaps(m, t))) throw makeError("#MERGE", String(target), `${target} overlaps a merge`);
  const descending = opts !== undefined && opts.descending === true;
  const rows = [];
  for (let r = t.r1; r <= t.r2; r++) rows.push({ r, v: valueOf(colName(col) + r) });
  rows.sort((x, y) => compareKeys(x.v, y.v, descending));
  return { t, from: rows.map((x) => x.r) };
}
