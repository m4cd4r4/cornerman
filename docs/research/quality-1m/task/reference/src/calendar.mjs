// calendar.mjs: EDATE, EOMONTH and WEEKDAY (cp58) on the checkpoint 19 serials, where serial 1
// (2000-01-01) is a Saturday, and NETWORKDAYS (cp59).
import { makeError, isError, pickError } from "./errors.mjs";
import { numberArg, intArg, arity, isRangeArg, rangeArg } from "./args.mjs";
import { dateSerial, parts, daysIn, MAX } from "./dates.mjs";

const bad = (ctx, fn, why) => makeError("#VALUE!", ctx.cell, `${fn}: ${why}`);
export const inRange = (s) => s >= 1 && s <= MAX;

// Monday = 1 ... Sunday = 7 for a serial in range.
export const isoDay = (s) => ((s + 4) % 7) + 1;

// EDATE (last = false): the same day `months` months on, or the last day of a shorter month.
// EOMONTH (last = true): the last day of that month. Months must be a whole number.
function monthMove(fn, last) {
  return (args, ctx, evaluate) => {
    const no = arity(fn, args, ctx, 2);
    if (no) return no;
    const s = intArg(args[0], ctx, evaluate);
    const m = numberArg(args[1], ctx, evaluate);
    const err = pickError([s, m]);
    if (err) return err;
    if (!inRange(s)) return bad(ctx, fn, "start out of range");
    if (!Number.isInteger(m)) return bad(ctx, fn, "months must be a whole number");
    const p = parts(s);
    const total = p.y * 12 + (p.m - 1) + m;
    const y = Math.floor(total / 12);
    const mo = total - y * 12 + 1;
    if (y < 2000 || y > 9999) return bad(ctx, fn, "result out of range");
    const d = last ? daysIn(y, mo) : Math.min(p.d, daysIn(y, mo));
    return dateSerial(y, mo, d);
  };
}

// type 2 (the default): Monday 1 ... Sunday 7; type 1: Sunday 1 ... Saturday 7; type 3: Monday 0 ... Sunday 6.
function weekday(args, ctx, evaluate) {
  const no = arity("WEEKDAY", args, ctx, 1, 2);
  if (no) return no;
  const s = intArg(args[0], ctx, evaluate);
  const t = args.length > 1 ? numberArg(args[1], ctx, evaluate) : 2;
  const err = pickError([s, t]);
  if (err) return err;
  if (!inRange(s)) return bad(ctx, "WEEKDAY", "serial out of range");
  if (t !== 1 && t !== 2 && t !== 3) return bad(ctx, "WEEKDAY", "type must be 1, 2 or 3");
  const iso = isoDay(s);
  return t === 2 ? iso : t === 3 ? iso - 1 : (iso % 7) + 1;
}

// Monday-to-Friday days among serials 1 to s. Every 7 days in a row hold 5 of them.
function weekdaysUpTo(s) {
  const full = Math.floor(s / 7);
  let n = full * 5;
  for (let x = full * 7 + 1; x <= s; x++) if (isoDay(x) <= 5) n++;
  return n;
}

// cp59: weekdays from start to end in either order, less the weekday holidays between them.
// holidays is a range argument only (#REF! stays #REF!, anything else is #VALUE!, never evaluated); its numbers,
// truncated, are holidays and every other value but an error is skipped.
function networkdays(args, ctx, evaluate) {
  const no = arity("NETWORKDAYS", args, ctx, 2, 3);
  if (no) return no;
  const a = intArg(args[0], ctx, evaluate);
  const b = intArg(args[1], ctx, evaluate);
  let hol = { values: [] };
  const h = args[2];
  if (h) hol = isRangeArg(h) ? rangeArg(h, ctx) : { err: h.k === "badref" ? evaluate(h, ctx) : bad(ctx, "NETWORKDAYS", "holidays must be a range") };
  const err = pickError([a, b, hol.err, ...(hol.values || []).filter(isError)]);
  if (err) return err;
  if (!inRange(a) || !inRange(b)) return bad(ctx, "NETWORKDAYS", "date out of range");
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const off = new Set();
  for (const v of hol.values) {
    if (typeof v !== "number") continue;
    const d = Math.trunc(v);
    if (d >= lo && d <= hi && isoDay(d) <= 5) off.add(d);
  }
  return weekdaysUpTo(hi) - weekdaysUpTo(lo - 1) - off.size;
}

export const CALENDAR = { EDATE: monthMove("EDATE", false), EOMONTH: monthMove("EOMONTH", true), WEEKDAY: weekday, NETWORKDAYS: networkdays };
