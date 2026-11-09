// products.mjs: SUMPRODUCT over ranges of one shape (cp45).
import { makeError, isError, pickError } from "./errors.mjs";
import { gridArg } from "./lookup.mjs";

// What a cell value multiplies by: numbers as they are, booleans as 1 and 0, anything else 0.
const factor = (v) => (typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : 0);

// Every argument must be a range argument; it is never evaluated as an expression.
function sumproduct(args, ctx) {
  if (!args.length) return makeError("#VALUE!", ctx.cell, "SUMPRODUCT takes at least one range");
  const grids = args.map((a) => gridArg(a, ctx));
  const err = pickError(grids.map((g) => g.err));
  if (err) return err;
  const [first] = grids;
  if (grids.some((g) => g.width !== first.width || g.height !== first.height)) return makeError("#VALUE!", ctx.cell, "SUMPRODUCT: ranges differ in shape");
  const values = grids.map((g) => g.keys.map((k) => ctx.read(k)));
  const e = pickError(values.flat().filter(isError));
  if (e) return e;
  let total = 0;
  for (let i = 0; i < first.keys.length; i++) total += values.reduce((p, col) => p * factor(col[i]), 1);
  return total;
}

export const PRODUCTS = { SUMPRODUCT: sumproduct };
