// display.mjs: display text (cp05).
import { isError } from "./errors.mjs";
import { roundText } from "./decimal.mjs";

export function formatNumber(x) {
  if (Math.abs(x) >= 1e15) return "##########";
  const s = roundText(x, 6, "even");
  if (/^0(\.0*)?$/.test(s)) return "0";
  return x < 0 ? "-" + s : s;
}

export function displayValue(v) {
  if (v === null || v === undefined) return "";
  if (isError(v)) return v.code;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return formatNumber(v);
  return String(v);
}
