// args.mjs: shared rules for function arguments: ranges, numbers, booleans, text (cp13-cp22).
import { makeError, isError } from "./errors.mjs";
import { rangeKeys, rangeBox } from "./address.mjs";
import { toNumber } from "./evaluate.mjs";
import { displayValue } from "./display.mjs";

// Keys of a range node, or #REF! for a bad corner or a range over the size limit.
export function rangeCells(node, ctx) {
  if (node.a.k !== "ref" || node.b.k !== "ref") return makeError("#REF!", ctx.cell, "invalid range corner");
  const keys = rangeKeys(node.a.addr, node.b.addr);
  return keys || makeError("#REF!", ctx.cell, "range larger than 10000 cells");
}

export const isRangeArg = (n) => n.k === "ref" || n.k === "range" || n.k === "name";

// A range argument as a grid: { keys, width, height } or { err }.
export function rangeGrid(node, ctx) {
  let a;
  let b;
  let sheet = node.sheet;
  if (node.sheet && !ctx.sheet(node.sheet)) return { err: makeError("#REF!", ctx.cell, `no sheet named ${node.sheet}`) };
  if (node.k === "ref") a = b = node.addr;
  else if (node.k === "range") {
    const r = rangeCells(node, ctx);
    if (isError(r)) return { err: r };
    a = node.a.addr;
    b = node.b.addr;
  } else if (node.k === "name") {
    const n = ctx.name(node.v);
    if (!n) return { err: makeError("#NAME?", ctx.cell, `unknown name ${node.v}`) };
    if ("value" in n) return { err: makeError("#VALUE!", ctx.cell, `constant ${node.v} used as a range`) };
    if (n.sheet && !ctx.sheet(n.sheet)) return { err: makeError("#REF!", ctx.cell, `no sheet named ${n.sheet}`) };
    sheet = n.sheet;
    a = n.a;
    b = n.b;
  } else return { err: makeError("#VALUE!", ctx.cell, "expected a range") };
  const { r1, r2, c1, c2 } = rangeBox(a, b);
  const keys = rangeKeys(a, b).map((k) => (sheet ? `${sheet}!${k}` : k));
  return { keys, width: c2 - c1 + 1, height: r2 - r1 + 1 };
}

// A range argument (bare reference, range, or name): its cell values, or a structural error.
export function rangeArg(node, ctx) {
  const g = rangeGrid(node, ctx);
  return g.err ? g : { values: g.keys.map((k) => ctx.read(k)) };
}

export function numberArg(node, ctx, evaluate) {
  const v = evaluate(node, ctx);
  return isError(v) ? v : toNumber(v, ctx.cell);
}

// Whole number, truncated toward zero.
export function intArg(node, ctx, evaluate) {
  const n = numberArg(node, ctx, evaluate);
  return isError(n) ? n : Math.trunc(n) || 0;
}

export function toBool(v, cell) {
  if (isError(v)) return v;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v === null) return false;
  return makeError("#VALUE!", cell, "text used as a condition");
}

export function boolArg(node, ctx, evaluate) {
  return toBool(evaluate(node, ctx), ctx.cell);
}

export function textArg(node, ctx, evaluate) {
  const v = evaluate(node, ctx);
  return isError(v) ? v : displayValue(v);
}

export const arity = (fn, args, ctx, lo, hi = lo) =>
  args.length < lo || args.length > hi ? makeError("#VALUE!", ctx.cell, `${fn} takes ${lo === hi ? lo : `${lo}-${hi}`} arguments`) : null;
