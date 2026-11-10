// limits.mjs: the formula length and nesting limits (cp67), checked on inputs as they are typed
// (set, setMany, fromCSV, fill, replace), never on inputs a sheet rewrites or loads.
import { makeError } from "./errors.mjs";

export const MAX_LENGTH = 1000; // characters of the input, the leading = included
export const MAX_DEPTH = 16; // open parentheses at once, grouping and function calls alike

// The greatest number of parentheses open at once, reading left to right. Parentheses inside a
// string literal do not count; a ")" with nothing open is ignored; an unclosed string runs to the end.
export function depthOf(input) {
  let open = 0;
  let max = 0;
  let quoted = false;
  for (const ch of input) {
    if (ch === '"') quoted = !quoted;
    else if (quoted) continue;
    else if (ch === "(") max = Math.max(max, ++open);
    else if (ch === ")" && open > 0) open--;
  }
  return max;
}

// Throws #LIMIT (cell = k) when the formula input is too long, then when it nests too deeply.
export function checkLimits(k, input) {
  if (!input.startsWith("=")) return;
  if (input.length > MAX_LENGTH) throw makeError("#LIMIT", k, `${k}: a formula holds at most ${MAX_LENGTH} characters`);
  if (depthOf(input) > MAX_DEPTH) throw makeError("#LIMIT", k, `${k}: parentheses nest at most ${MAX_DEPTH} deep`);
}
