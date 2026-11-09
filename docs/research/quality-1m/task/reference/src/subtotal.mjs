// subtotal.mjs: SUBTOTAL(code, range, ...) (cp50): an aggregate over ranges that leaves out cells in
// hidden rows (cp49) and cells whose whole formula is a SUBTOTAL call. Hidden columns count.
import { makeError, isError, pickError } from "./errors.mjs";
import { isRangeArg, rangeGrid, intArg } from "./args.mjs";
import { parseAddress } from "./address.mjs";

export const CODES = { 1: "AVERAGE", 2: "COUNT", 4: "MAX", 5: "MIN", 9: "SUM" };

// Whether SUBTOTAL leaves out cell k of a sheet: its row is hidden, or its formula's outermost
// operation is a SUBTOTAL call. entry = what the sheet keeps for k's input (graph.mjs parseEntry).
export function leftOut(k, entry, hiddenRows) {
  if (hiddenRows.has(parseAddress(k).row)) return true;
  return !!(entry && entry.ast && entry.ast.k === "call" && entry.ast.fn === "SUBTOTAL");
}

function total(fn, nums, cell) {
  switch (fn) {
    case "SUM": return nums.reduce((s, x) => s + x, 0);
    case "COUNT": return nums.length;
    case "AVERAGE":
      if (!nums.length) return makeError("#DIV/0!", cell, "SUBTOTAL average of no numbers");
      return nums.reduce((s, x) => s + x, 0) / nums.length;
    default:
      if (!nums.length) return makeError("#VALUE!", cell, `SUBTOTAL ${fn} of no numbers`);
      return nums.reduce((m, x) => (fn === "MIN" ? (x < m ? x : m) : x > m ? x : m));
  }
}

// Checks in order: argument count, the code (its error, then its value), range arguments only;
// then range errors and cell errors together by the checkpoint 4 rules (COUNT skips cell errors).
function subtotal(args, ctx, evaluate) {
  if (args.length < 2) return makeError("#VALUE!", ctx.cell, "SUBTOTAL takes a code and at least one range");
  const code = intArg(args[0], ctx, evaluate);
  if (isError(code)) return code;
  const fn = CODES[code];
  if (!fn) return makeError("#VALUE!", ctx.cell, `SUBTOTAL has no function ${code}`);
  if (!args.slice(1).every(isRangeArg)) return makeError("#VALUE!", ctx.cell, "SUBTOTAL takes ranges only");
  const nums = [];
  const errors = [];
  for (const a of args.slice(1)) {
    const g = rangeGrid(a, ctx);
    if (g.err) { errors.push(g.err); continue; }
    for (const k of g.keys) {
      if (ctx.skip(k)) continue;
      const v = ctx.read(k);
      if (typeof v === "number") nums.push(v);
      else if (isError(v) && fn !== "COUNT") errors.push(v);
    }
  }
  return pickError(errors) || total(fn, nums, ctx.cell);
}

export const SUBTOTALS = { SUBTOTAL: subtotal };
