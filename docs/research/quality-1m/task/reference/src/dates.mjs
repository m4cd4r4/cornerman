// dates.mjs: DATE, YEAR, MONTH, DAY on serials where 2000-01-01 is 1 (cp19); helpers for calendar.mjs.
import { makeError, pickError } from "./errors.mjs";
import { intArg, arity } from "./args.mjs";

const DAY_MS = 86400000;
const EPOCH = Date.UTC(2000, 0, 1);
export const MAX = (Date.UTC(9999, 11, 31) - EPOCH) / DAY_MS + 1;

export const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function dateSerial(y, m, d) {
  if (y < 2000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > daysIn(y, m)) return null;
  return (Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS + 1;
}

export function parts(serial) {
  const t = new Date(EPOCH + (serial - 1) * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function part(fn, key) {
  return (args, ctx, evaluate) => {
    const bad = arity(fn, args, ctx, 1);
    if (bad) return bad;
    const s = intArg(args[0], ctx, evaluate);
    if (typeof s !== "number") return s;
    if (s < 1 || s > MAX) return makeError("#VALUE!", ctx.cell, `${fn}: serial out of range`);
    return parts(s)[key];
  };
}

export const DATES = {
  DATE(args, ctx, evaluate) {
    const bad = arity("DATE", args, ctx, 3);
    if (bad) return bad;
    const [y, m, d] = args.map((a) => intArg(a, ctx, evaluate));
    const err = pickError([y, m, d]);
    if (err) return err;
    const s = dateSerial(y, m, d);
    return s === null ? makeError("#VALUE!", ctx.cell, "DATE: no such day") : s;
  },
  YEAR: part("YEAR", "y"),
  MONTH: part("MONTH", "m"),
  DAY: part("DAY", "d"),
};
