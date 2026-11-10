// choose.mjs: CHOOSE and SWITCH (cp60). Like IF (cp17), each evaluates only what it picks; every
// reference in every argument is still a precedent (graph.mjs reads the whole formula).
import { makeError, isError } from "./errors.mjs";
import { intArg } from "./args.mjs";
import { numEqual } from "./evaluate.mjs";

function choose(args, ctx, evaluate) {
  if (args.length < 2) return makeError("#VALUE!", ctx.cell, "CHOOSE takes an index and at least one value");
  const i = intArg(args[0], ctx, evaluate);
  if (isError(i)) return i;
  if (i < 1 || i > args.length - 1) return makeError("#VALUE!", ctx.cell, `CHOOSE has no value ${i}`);
  return evaluate(args[i], ctx);
}

// SWITCH equality: an empty cell is the number 0; then same type and equal, numbers within the
// checkpoint 8 tolerance and text with its case.
const zeroIfEmpty = (v) => (v === null ? 0 : v);
export function sameValue(a, b) {
  const x = zeroIfEmpty(a);
  const y = zeroIfEmpty(b);
  if (typeof x !== typeof y) return false;
  return typeof x === "number" ? numEqual(x, y) : x === y;
}

// SWITCH(value, case1, result1, ..., [default]): cases are evaluated in order until one matches.
function switchFn(args, ctx, evaluate) {
  if (args.length < 3) return makeError("#VALUE!", ctx.cell, "SWITCH takes a value and at least one case and result");
  const v = evaluate(args[0], ctx);
  if (isError(v)) return v;
  for (let i = 1; i + 1 < args.length; i += 2) {
    const c = evaluate(args[i], ctx);
    if (isError(c)) return c;
    if (sameValue(v, c)) return evaluate(args[i + 1], ctx);
  }
  if (args.length % 2 === 0) return evaluate(args[args.length - 1], ctx);
  return makeError("#N/A", ctx.cell, "SWITCH: no case matches");
}

export const CHOICE = { CHOOSE: choose, SWITCH: switchFn };
