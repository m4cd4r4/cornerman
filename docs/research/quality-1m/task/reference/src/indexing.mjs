// indexing.mjs: INDEX and MATCH (cp44).
import { makeError, isError, pickError } from "./errors.mjs";
import { intArg, arity } from "./args.mjs";
import { compareValues } from "./evaluate.mjs";
import { gridArg } from "./lookup.mjs";

// INDEX(range, row, [col]): the value at that position; the second argument is always the row.
function index(args, ctx, evaluate) {
  const bad = arity("INDEX", args, ctx, 2, 3);
  if (bad) return bad;
  const g = gridArg(args[0], ctx);
  const row = intArg(args[1], ctx, evaluate);
  const col = args.length === 3 ? intArg(args[2], ctx, evaluate) : 1;
  const err = pickError([g.err, row, col]);
  if (err) return err;
  if (row < 1 || row > g.height || col < 1 || col > g.width) return makeError("#REF!", ctx.cell, "INDEX: position outside the range");
  return ctx.read(g.keys[(row - 1) * g.width + col - 1]);
}

// MATCH(key, range, [type]): 1-based position. Type 0 (the default) is the first equal cell;
// 1 is the largest value <= key, -1 the smallest >= key, anywhere in the range, first on ties.
function match(args, ctx, evaluate) {
  const bad = arity("MATCH", args, ctx, 2, 3);
  if (bad) return bad;
  const key = evaluate(args[0], ctx);
  const g = gridArg(args[1], ctx);
  const type = args.length === 3 ? intArg(args[2], ctx, evaluate) : 0;
  const err = pickError([key, g.err, type]);
  if (err) return err;
  if (g.width !== 1 && g.height !== 1) return makeError("#VALUE!", ctx.cell, "MATCH: range must be one row or one column");
  if (type !== -1 && type !== 0 && type !== 1) return makeError("#VALUE!", ctx.cell, "MATCH: type must be -1, 0 or 1");
  let best = -1;
  let bestV = null;
  if (key !== null) {
    for (let i = 0; i < g.keys.length; i++) {
      const v = ctx.read(g.keys[i]);
      if (v === null || isError(v) || typeof v !== typeof key) continue;
      const c = compareValues(v, key);
      if (type === 0) {
        if (c === 0) return i + 1;
        continue;
      }
      if (type === 1 ? c > 0 : c < 0) continue;
      if (best < 0 || (type === 1 ? compareValues(v, bestV) > 0 : compareValues(v, bestV) < 0)) {
        best = i;
        bestV = v;
      }
    }
  }
  return best < 0 ? makeError("#N/A", ctx.cell, "MATCH: no match") : best + 1;
}

export const INDEXING = { INDEX: index, MATCH: match };
