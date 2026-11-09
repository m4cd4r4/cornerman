// Display text (cp05).
import { isError } from "./errors.mjs";

// Plain decimal digits of a non-negative number's shortest form, no exponent.
function plainDecimal(x) {
  const s = String(x);
  const m = /^(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(s);
  if (!m) return s;
  const digits = m[1] + (m[2] || "");
  const point = m[1].length + Number(m[3]);
  if (point <= 0) return "0." + "0".repeat(-point) + digits;
  if (point >= digits.length) return digits + "0".repeat(point - digits.length);
  return digits.slice(0, point) + "." + digits.slice(point);
}

function incrementDigits(s) {
  const a = s.split("");
  let i = a.length - 1;
  while (i >= 0) {
    if (a[i] === "9") { a[i] = "0"; i--; continue; }
    a[i] = String(Number(a[i]) + 1);
    return a.join("");
  }
  return "1" + a.join("");
}

export function formatNumber(x) {
  if (Math.abs(x) >= 1e15) return "##########";
  const neg = x < 0;
  const [intPart, frac = ""] = plainDecimal(Math.abs(x)).split(".");
  let i = intPart;
  let f = frac;
  if (f.length > 6) {
    const keep = f.slice(0, 6);
    const next = f[6];
    const rest = f.slice(7);
    let up = next > "5" || (next === "5" && /[1-9]/.test(rest));
    if (next === "5" && !/[1-9]/.test(rest)) {
      const last = keep.length ? keep[5] : i[i.length - 1];
      up = Number(last) % 2 === 1;
    }
    f = keep;
    if (up) {
      const joined = incrementDigits(i + f);
      i = joined.slice(0, joined.length - 6);
      f = joined.slice(joined.length - 6);
    }
  }
  f = f.replace(/0+$/, "");
  let out = f ? `${i}.${f}` : i;
  if (/^0(\.0*)?$/.test(out)) return "0";
  return neg ? "-" + out : out;
}

export function displayValue(v) {
  if (v === null || v === undefined) return "";
  if (isError(v)) return v.code;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return formatNumber(v);
  return String(v);
}
