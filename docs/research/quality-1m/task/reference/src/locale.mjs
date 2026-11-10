// locale.mjs: the decimal option (cp63): "." (the default) or ",". It changes only the text shown
// for numbers (display, text, toCSV), never inputs, values or formulas.
import { makeError, errorOrderOption } from "./errors.mjs";

// { errorOrder, decimal } from the options of createSheet, loadSheet, createWorkbook and
// loadWorkbook. Throws #ARG: the object and errorOrder first (cp34), then decimal.
export function sheetOptions(opts) {
  const errorOrder = errorOrderOption(opts);
  const d = opts === undefined ? undefined : opts.decimal;
  if (d !== undefined && d !== "." && d !== ",") throw makeError("#ARG", String(d), `unknown decimal ${d}`);
  return { errorOrder, decimal: d ?? "." };
}

// The display text of a number in a locale: with ",", every "." and "," swap places.
export const localize = (text, decimal) => (decimal === "," ? text.replace(/[.,]/g, (c) => (c === "." ? "," : ".")) : text);
