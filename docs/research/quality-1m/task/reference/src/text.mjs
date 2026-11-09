// text.mjs: LEN, UPPER, LOWER, LEFT, RIGHT, MID, TRIM (cp18).
import { makeError, pickError } from "./errors.mjs";
import { textArg, intArg, arity } from "./args.mjs";

// Evaluate every argument (text first, then whole numbers), then apply f or return the winning error.
function textFn(fn, lo, hi, f) {
  return (args, ctx, evaluate) => {
    const bad = arity(fn, args, ctx, lo, hi);
    if (bad) return bad;
    const vals = args.map((a, i) => (i === 0 ? textArg(a, ctx, evaluate) : intArg(a, ctx, evaluate)));
    const err = pickError(vals);
    if (err) return err;
    return f(vals, ctx);
  };
}

const negative = (ctx, fn) => makeError("#VALUE!", ctx.cell, `${fn}: negative count`);

export const TEXT = {
  LEN: textFn("LEN", 1, 1, ([t]) => t.length),
  UPPER: textFn("UPPER", 1, 1, ([t]) => t.toUpperCase()),
  LOWER: textFn("LOWER", 1, 1, ([t]) => t.toLowerCase()),
  TRIM: textFn("TRIM", 1, 1, ([t]) => t.replace(/^ +| +$/g, "")),
  LEFT: textFn("LEFT", 1, 2, ([t, n = 1], ctx) => (n < 0 ? negative(ctx, "LEFT") : t.slice(0, n))),
  RIGHT: textFn("RIGHT", 1, 2, ([t, n = 1], ctx) => (n < 0 ? negative(ctx, "RIGHT") : n === 0 ? "" : t.slice(-n))),
  MID: textFn("MID", 3, 3, ([t, start, n], ctx) => {
    if (start < 1) return makeError("#VALUE!", ctx.cell, "MID: start below 1");
    if (n < 0) return negative(ctx, "MID");
    return t.slice(start - 1, start - 1 + n);
  }),
};
