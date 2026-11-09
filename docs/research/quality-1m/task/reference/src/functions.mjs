// functions.mjs: built-in functions and range arguments (cp13, cp15, cp16).
import { makeError, isError, pickError } from "./errors.mjs";
import { rangeKeys } from "./address.mjs";
import { toNumber } from "./evaluate.mjs";
import { roundDecimal } from "./decimal.mjs";

// Keys of a range node, or #REF! for a bad corner or a range over the size limit.
export function rangeCells(node, ctx) {
  if (node.a.k !== "ref" || node.b.k !== "ref") return makeError("#REF!", ctx.cell, "invalid range corner");
  const keys = rangeKeys(node.a.addr, node.b.addr);
  return keys || makeError("#REF!", ctx.cell, "range larger than 10000 cells");
}

const isRangeArg = (n) => n.k === "ref" || n.k === "range" || n.k === "name";

// A range argument (bare reference, range, or name): its cell values, or a structural error.
function rangeArg(node, ctx) {
  if (node.k === "ref") return { values: [ctx.read(node.addr)] };
  if (node.k === "range") {
    const r = rangeCells(node, ctx);
    return isError(r) ? { err: r } : { values: r.map((k) => ctx.read(k)) };
  }
  const n = ctx.name(node.v);
  if (!n) return { err: makeError("#NAME?", ctx.cell, `unknown name ${node.v}`) };
  return { values: rangeKeys(n.a, n.b).map((k) => ctx.read(k)) };
}

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

function numberArg(node, ctx, evaluate) {
  const v = evaluate(node, ctx);
  return isError(v) ? v : toNumber(v, ctx.cell);
}

function rounding(fn, args, ctx, evaluate) {
  if (args.length !== 2) return makeError("#VALUE!", ctx.cell, `${fn} takes 2 arguments`);
  const x = numberArg(args[0], ctx, evaluate);
  const d = numberArg(args[1], ctx, evaluate);
  const err = pickError([x, d]);
  if (err) return err;
  const digits = Math.trunc(d);
  if (digits > 15 || digits < -15) return makeError("#VALUE!", ctx.cell, "digits out of range");
  return roundDecimal(x, digits === 0 ? 0 : digits, MODES[fn]);
}

const AGGREGATES = new Set(["SUM", "AVERAGE", "MIN", "MAX", "COUNT"]);

export function callFunction(node, ctx, evaluate) {
  if (AGGREGATES.has(node.fn)) return aggregate(node.fn, node.args, ctx, evaluate);
  if (node.fn in MODES) return rounding(node.fn, node.args, ctx, evaluate);
  return makeError("#NAME?", ctx.cell, `unknown function ${node.fn}`);
}
