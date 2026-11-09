// logic.mjs: IF, AND, OR, NOT (cp17) and ISERROR, IFERROR (cp20).
import { makeError, isError, pickError } from "./errors.mjs";
import { isRangeArg, rangeArg, boolArg, toBool, arity } from "./args.mjs";

function truths(args, ctx, evaluate) {
  const vals = [];
  const errors = [];
  for (const a of args) {
    if (isRangeArg(a)) {
      const r = rangeArg(a, ctx);
      if (r.err) { errors.push(r.err); continue; }
      for (const v of r.values) {
        if (isError(v)) errors.push(v);
        else if (typeof v === "boolean") vals.push(v);
        else if (typeof v === "number") vals.push(v !== 0);
      }
      continue;
    }
    const b = toBool(evaluate(a, ctx), ctx.cell);
    if (isError(b)) errors.push(b);
    else vals.push(b);
  }
  return { vals, err: pickError(errors) };
}

function andOr(fn) {
  return (args, ctx, evaluate) => {
    const { vals, err } = truths(args, ctx, evaluate);
    if (err) return err;
    if (!vals.length) return makeError("#VALUE!", ctx.cell, `${fn} of no values`);
    return fn === "AND" ? vals.every(Boolean) : vals.some(Boolean);
  };
}

export const LOGIC = {
  IF(args, ctx, evaluate) {
    const bad = arity("IF", args, ctx, 2, 3);
    if (bad) return bad;
    const c = boolArg(args[0], ctx, evaluate);
    if (isError(c)) return c;
    const taken = c ? args[1] : args[2];
    return taken ? evaluate(taken, ctx) : false;
  },
  AND: andOr("AND"),
  OR: andOr("OR"),
  NOT(args, ctx, evaluate) {
    const bad = arity("NOT", args, ctx, 1);
    if (bad) return bad;
    const b = boolArg(args[0], ctx, evaluate);
    return isError(b) ? b : !b;
  },
  ISERROR(args, ctx, evaluate) {
    const bad = arity("ISERROR", args, ctx, 1);
    return bad || isError(evaluate(args[0], ctx));
  },
  IFERROR(args, ctx, evaluate) {
    const bad = arity("IFERROR", args, ctx, 2);
    if (bad) return bad;
    const v = evaluate(args[0], ctx);
    if (isError(v) && v.code !== "#CYCLE!") return evaluate(args[1], ctx);
    return v;
  },
};
