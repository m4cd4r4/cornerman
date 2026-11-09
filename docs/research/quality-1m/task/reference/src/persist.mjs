// persist.mjs: save text out and loadSheet text in (cp30). Pure: index.mjs builds the sheet.
import { normalise, compareAddresses } from "./address.mjs";
import { makeError } from "./errors.mjs";
import { checkName, parseNameRef, nameText } from "./names.mjs";

export const FORMAT = "sheet";
export const VERSION = 1;

// inputs: key -> input, names: NAME -> { a, b, range }.
export function saveText(inputs, names) {
  const cells = {};
  for (const k of [...inputs.keys()].sort(compareAddresses)) cells[k] = inputs.get(k);
  const out = {};
  for (const n of [...names.keys()].sort()) out[n] = nameText(names.get(n));
  return JSON.stringify({ format: FORMAT, version: VERSION, cells, names: out });
}

const bad = (cell, why) => makeError("#LOAD", cell, `cannot load: ${why}`);
const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// { inputs: Map, names: Map } from save text, or throws #LOAD. Checks in a fixed order.
export function parseSave(json) {
  if (typeof json !== "string") throw bad("", "save text must be a string");
  let doc;
  try {
    doc = JSON.parse(json);
  } catch {
    throw bad("", "not JSON");
  }
  if (!isPlain(doc)) throw bad("", "not a JSON object");
  if (doc.format !== FORMAT) throw bad("format", `format is ${JSON.stringify(doc.format)}`);
  if (doc.version !== VERSION) throw bad("version", `version is ${JSON.stringify(doc.version)}`);
  if (!isPlain(doc.cells)) throw bad("cells", "cells must be an object");
  if (!isPlain(doc.names)) throw bad("names", "names must be an object");
  const inputs = new Map();
  for (const [k, v] of Object.entries(doc.cells)) {
    if (normalise(k) !== k) throw bad(k, `${k} is not an upper-case cell address`);
    if (typeof v !== "string" || v === "") throw bad(k, `${k} must hold a non-empty string`);
    inputs.set(k, v);
  }
  const names = new Map();
  for (const [n, ref] of Object.entries(doc.names)) {
    let d;
    try {
      if (checkName(n) !== n) throw new Error("case");
      d = parseNameRef(ref);
    } catch {
      throw bad(n, `${n} is not a valid name and target`);
    }
    if (nameText(d) !== ref) throw bad(n, `${n} target must be written as ${nameText(d)}`);
    names.set(n, d);
  }
  return { inputs, names };
}
