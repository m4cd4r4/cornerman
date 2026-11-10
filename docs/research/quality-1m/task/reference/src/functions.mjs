// functions.mjs: the function table, aggregates and rounding (cp13, cp15, cp16).
import { makeError, isError, pickError } from "./errors.mjs";
import { roundDecimal } from "./decimal.mjs";
import { isRangeArg, rangeArg, numberArg, arity } from "./args.mjs";
import { LOGIC } from "./logic.mjs";
import { TEXT } from "./text.mjs";
import { DATES } from "./dates.mjs";
import { LOOKUP } from "./lookup.mjs";
import { CRITERIA } from "./criteria.mjs";
import { INDEXING } from "./indexing.mjs";
import { PRODUCTS } from "./products.mjs";
import { SUBTOTALS } from "./subtotal.mjs";
import { CALENDAR } from "./calendar.mjs";

// Numbers for an aggregate. Range arguments contribute only their numbers; direct arguments
// contribute numbers and booleans (1/0), and direct text is #VALUE!. COUNT passes `count`.
function gather(args, ctx, evaluate, count) {
  const nums = [];
  const errors = [];
  for (const a of args) {
    if (isRangeArg(a)) {
      const r = rangeArg(a, ctx);
      if (r.err) { errors.push(r.err); continue; }
      for (const v of r.values) {
        if (typeof v === "number") nums.push(v);
        else if (isError(v) && !count) errors.push(v);
      }
      continue;
    }
    const v = evaluate(a, ctx);
    if (isError(v)) { if (!count) errors.push(v); }
    else if (typeof v === "number") nums.push(v);
    else if (typeof v === "boolean") { if (!count) nums.push(v ? 1 : 0); }
    else if (v === null) nums.push(0);
    else if (!count) errors.push(makeError("#VALUE!", ctx.cell, "text argument"));
  }
  return { nums, err: pickError(errors) };
}

function aggregate(fn, args, ctx, evaluate) {
  const { nums, err } = gather(args, ctx, evaluate, fn === "COUNT");
  if (err) return err;
  switch (fn) {
    case "SUM": return nums.reduce((s, x) => s + x, 0);
    case "COUNT": return nums.length;
    case "AVERAGE":
      if (!nums.length) return makeError("#DIV/0!", ctx.cell, "AVERAGE of no numbers");
      return nums.reduce((s, x) => s + x, 0) / nums.length;
    case "MIN":
    case "MAX":
      if (!nums.length) return makeError("#VALUE!", ctx.cell, `${fn} of no numbers`);
      return nums.reduce((m, x) => (fn === "MIN" ? (x < m ? x : m) : x > m ? x : m));
  }
  throw new Error(`not an aggregate ${fn}`);
}

const MODES = { ROUND: "even", ROUNDUP: "up", ROUNDDOWN: "down" };

function rounding(fn, args, ctx, evaluate) {
  const bad = arity(fn, args, ctx, 2);
  if (bad) return bad;
  const x = numberArg(args[0], ctx, evaluate);
  const d = numberArg(args[1], ctx, evaluate);
  const err = pickError([x, d]);
  if (err) return err;
  const digits = Math.trunc(d);
  if (digits > 15 || digits < -15) return makeError("#VALUE!", ctx.cell, "digits out of range");
  return roundDecimal(x, digits === 0 ? 0 : digits, MODES[fn]);
}

const TABLE = { ...LOGIC, ...TEXT, ...DATES, ...LOOKUP, ...CRITERIA, ...INDEXING, ...PRODUCTS, ...SUBTOTALS, ...CALENDAR };
for (const fn of ["SUM", "AVERAGE", "MIN", "MAX", "COUNT"]) TABLE[fn] = (args, ctx, ev) => aggregate(fn, args, ctx, ev);
for (const fn of Object.keys(MODES)) TABLE[fn] = (args, ctx, ev) => rounding(fn, args, ctx, ev);

export function callFunction(node, ctx, evaluate) {
  const f = TABLE[node.fn];
  if (!f) return makeError("#NAME?", ctx.cell, `unknown function ${node.fn}`);
  return f(node.args, ctx, evaluate, node.fn);
}
