// numfmt.mjs: number formats such as 0.00, #,##0 and 0% and the display text they give (cp41).
import { plainDecimal, roundText } from "./decimal.mjs";
import { makeError } from "./errors.mjs";

const GRAMMAR = /^(#,##)?0(?:\.(0{1,10}))?(%?)$/;

// { decimals, group, percent } for a format text, or null when it is not one.
export function parseFormat(text) {
  const m = typeof text === "string" ? GRAMMAR.exec(text) : null;
  return m ? { decimals: m[2] ? m[2].length : 0, group: m[1] !== undefined, percent: m[3] === "%" } : null;
}

// The stored form of a setFormat argument: null clears; anything else must parse or throws #FORMAT.
export function checkFormat(format) {
  if (format === null || format === "") return null;
  if (!parseFormat(format)) throw makeError("#FORMAT", String(format), `not a number format: ${format}`);
  return format;
}

// Move the decimal point of plain decimal text two places right (x 100, done on the digits).
function times100(text) {
  const [int, frac = ""] = text.split(".");
  const f = frac.padEnd(2, "0");
  const out = `${int}${f.slice(0, 2)}${f.length > 2 ? "." + f.slice(2) : ""}`;
  return out.replace(/^0+(?=\d)/, "");
}

const groups = (int) => int.replace(/\B(?=(\d{3})+$)/g, ",");

// Display text of number x under format f. Rounds half to even on the shortest decimal form.
export function formatNumber(x, f) {
  if (Math.abs(x) >= 1e15) return "##########";
  let digits = plainDecimal(Math.abs(x));
  if (f.percent) digits = times100(digits);
  const r = roundText(Number(digits), f.decimals, "even");
  let [int, frac = ""] = r.split(".");
  frac = frac.padEnd(f.decimals, "0");
  if (f.group) int = groups(int);
  const zero = !/[1-9]/.test(r);
  const sign = x < 0 && !zero ? "-" : "";
  return `${sign}${int}${f.decimals ? "." + frac : ""}${f.percent ? "%" : ""}`;
}
