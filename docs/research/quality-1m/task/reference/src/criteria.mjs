// criteria.mjs: COUNTIF and AVERAGEIF, on the criteria of SUMIF (cp43).
import { makeError, isError, pickError } from "./errors.mjs";
import { arity } from "./args.mjs";
import { matcher, gridArg } from "./lookup.mjs";

function countif(args, ctx, evaluate) {
  const bad = arity("COUNTIF", args, ctx, 2);
  if (bad) return bad;
  const g = gridArg(args[0], ctx);
  const crit = evaluate(args[1], ctx);
  const err = pickError([g.err, crit]);
  if (err) return err;
  const test = matcher(crit);
  let n = 0;
  for (const k of g.keys) if (test(ctx.read(k))) n++;
  return n;
}

// The mean of the numbers in averageRange at the positions where range meets the criterion.
function averageif(args, ctx, evaluate) {
  const bad = arity("AVERAGEIF", args, ctx, 2, 3);
  if (bad) return bad;
  const g = gridArg(args[0], ctx);
  const crit = evaluate(args[1], ctx);
  const s = args[2] ? gridArg(args[2], ctx) : g;
  const err = pickError([g.err, crit, s.err]);
  if (err) return err;
  if (s.width !== g.width || s.height !== g.height) return makeError("#VALUE!", ctx.cell, "AVERAGEIF: ranges differ in shape");
  const test = matcher(crit);
  let total = 0;
  let count = 0;
  const errors = [];
  g.keys.forEach((k, i) => {
    if (!test(ctx.read(k))) return;
    const v = ctx.read(s.keys[i]);
    if (typeof v === "number") { total += v; count++; }
    else if (isError(v)) errors.push(v);
  });
  const e = pickError(errors);
  if (e) return e;
  return count ? total / count : makeError("#DIV/0!", ctx.cell, "AVERAGEIF: no numbers match");
}

export const CRITERIA = { COUNTIF: countif, AVERAGEIF: averageif };
