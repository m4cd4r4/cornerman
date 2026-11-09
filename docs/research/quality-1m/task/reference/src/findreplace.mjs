// findreplace.mjs: sheet.find and sheet.replace (cp51): plain-text search over cell inputs, never
// over values. No wildcards; covered cells (cp47) are skipped, hidden rows and columns are not.
import { makeError } from "./errors.mjs";
import { compareAddresses } from "./address.mjs";

function options(opts) {
  if (opts === undefined) return { matchCase: false, whole: false };
  const plain = opts !== null && typeof opts === "object" && !Array.isArray(opts);
  if (!plain || !["matchCase", "whole"].every((k) => opts[k] === undefined || typeof opts[k] === "boolean")) {
    throw makeError("#ARG", "opts", "opts must be an object with optional boolean matchCase and whole");
  }
  return { matchCase: opts.matchCase === true, whole: opts.whole === true };
}

function checkText(text, what, empty) {
  if (typeof text !== "string" || (!empty && text === "")) throw makeError("#ARG", String(text), `${what} must be ${empty ? "" : "non-empty "}text`);
}

// Start positions of the matches of text in input: non-overlapping, found left to right.
function matches(input, text, o) {
  const fold = (x) => (o.matchCase ? x : x.toLowerCase());
  if (o.whole) return fold(input) === fold(text) ? [0] : [];
  const t = fold(text);
  const out = [];
  for (let i = 0; i + text.length <= input.length; ) {
    if (fold(input.slice(i, i + text.length)) === t) {
      out.push(i);
      i += text.length;
    } else i++;
  }
  return out;
}

export function addFindReplace(sheet, core) {
  const searched = () => [...core.keys()].filter((k) => !core.layers.L.covered.has(k)).sort(compareAddresses);
  Object.assign(sheet, {
    find(text, opts) {
      checkText(text, "find text");
      const o = options(opts);
      return searched().filter((k) => matches(core.input(k), text, o).length > 0);
    },
    // One undo step; every new input is checked (cp46) before any is written. Returns the number of
    // cells whose input changed.
    replace(text, replacement, opts) {
      checkText(text, "find text");
      checkText(replacement, "replacement", true);
      const o = options(opts);
      const writes = [];
      for (const k of searched()) {
        const input = core.input(k);
        const at = matches(input, text, o);
        if (!at.length) continue;
        let out = o.whole ? replacement : input;
        if (!o.whole) for (const i of [...at].reverse()) out = out.slice(0, i) + replacement + out.slice(i + text.length);
        if (out !== input) writes.push([k, out]);
      }
      core.writeAll(writes);
      return writes.length;
    },
  });
  return sheet;
}
