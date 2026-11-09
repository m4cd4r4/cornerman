// lookup.mjs: VLOOKUP exact match (cp21) and SUMIF with its criteria grammar (cp22).
import { makeError, isError, pickError } from "./errors.mjs";
import { isRangeArg, rangeGrid, intArg, arity } from "./args.mjs";
import { compareValues } from "./evaluate.mjs";

const NUMBER = /^-?\d+(\.\d+)?$/;
const sameType = (a, b) => typeof a === typeof b;

export function gridArg(node, ctx) {
  return isRangeArg(node) ? rangeGrid(node, ctx) : { err: makeError("#VALUE!", ctx.cell, "expected a range") };
}

function vlookup(args, ctx, evaluate) {
  const bad = arity("VLOOKUP", args, ctx, 3);
  if (bad) return bad;
  const key = evaluate(args[0], ctx);
  const g = gridArg(args[1], ctx);
  const col = intArg(args[2], ctx, evaluate);
  const err = pickError([key, g.err, col]);
  if (err) return err;
  if (col < 1 || col > g.width) return makeError("#REF!", ctx.cell, "VLOOKUP: column outside the range");
  if (key !== null) {
    for (let r = 0; r < g.height; r++) {
      const v = ctx.read(g.keys[r * g.width]);
      if (v === null || isError(v) || !sameType(v, key)) continue;
      if (compareValues(v, key) === 0) return ctx.read(g.keys[r * g.width + col - 1]);
    }
  }
  return makeError("#N/A", ctx.cell, "VLOOKUP: no match");
}

const isBlank = (v) => v === null || v === "";

// cp22: a criterion becomes a test on one cell value.
export function matcher(crit) {
  let op = "=";
  let operand = crit;
  if (typeof crit === "string") {
    const m = /^(<=|>=|<>|=|<|>)?([\s\S]*)$/.exec(crit);
    op = m[1] || "=";
    operand = NUMBER.test(m[2]) ? Number(m[2]) : m[2];
  } else if (crit === null) operand = "";
  const eq = (v) => (operand === "" ? isBlank(v) : !isBlank(v) && sameType(v, operand) && compareValues(v, operand) === 0);
  return (v) => {
    if (isError(v)) return false;
    if (op === "=") return eq(v);
    if (op === "<>") return !eq(v);
    if (operand === "" || isBlank(v) || !sameType(v, operand)) return false;
    const c = compareValues(v, operand);
    return op === "<" ? c < 0 : op === ">" ? c > 0 : op === "<=" ? c <= 0 : c >= 0;
  };
}

function sumif(args, ctx, evaluate) {
  const bad = arity("SUMIF", args, ctx, 2, 3);
  if (bad) return bad;
  const g = gridArg(args[0], ctx);
  const crit = evaluate(args[1], ctx);
  const s = args[2] ? gridArg(args[2], ctx) : g;
  const err = pickError([g.err, crit, s.err]);
  if (err) return err;
  if (s.width !== g.width || s.height !== g.height) return makeError("#VALUE!", ctx.cell, "SUMIF: ranges differ in shape");
  const test = matcher(crit);
  let total = 0;
  const errors = [];
  g.keys.forEach((k, i) => {
    if (!test(ctx.read(k))) return;
    const v = ctx.read(s.keys[i]);
    if (typeof v === "number") total += v;
    else if (isError(v)) errors.push(v);
  });
  return pickError(errors) || total;
}

export const LOOKUP = { VLOOKUP: vlookup, SUMIF: sumif };
