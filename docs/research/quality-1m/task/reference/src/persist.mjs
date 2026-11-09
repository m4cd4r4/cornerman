// persist.mjs: save text out and loadSheet text in (cp30). Pure: index.mjs builds the sheet.
import { normalise, compareAddresses } from "./address.mjs";
import { makeError } from "./errors.mjs";
import { checkName, parseNameRef, nameText } from "./names.mjs";

export const FORMAT = "sheet";
export const VERSION = 1;

// The { cells, names } object of a save: cells in address order, names sorted (cp30).
export function saveBody(inputs, names) {
  const cells = {};
  for (const k of [...inputs.keys()].sort(compareAddresses)) cells[k] = inputs.get(k);
  const out = {};
  for (const n of [...names.keys()].sort()) out[n] = nameText(names.get(n));
  return { cells, names: out };
}

// inputs: key -> input, names: NAME -> { a, b, range }.
export function saveText(inputs, names) {
  const { cells, names: out } = saveBody(inputs, names);
  return JSON.stringify({ format: FORMAT, version: VERSION, cells, names: out });
}

export const bad = (cell, why) => makeError("#LOAD", cell, `cannot load: ${why}`);
export const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// The parsed JSON object of save text, or throws #LOAD with cell "".
export function parseDoc(json) {
  if (typeof json !== "string") throw bad("", "save text must be a string");
  let doc;
  try {
    doc = JSON.parse(json);
  } catch {
    throw bad("", "not JSON");
  }
  if (!isPlain(doc)) throw bad("", "not a JSON object");
  return doc;
}

// The cells and names of one sheet, checked in a fixed order. at = "" for a v1 save (cells
// "cells", "names", then the key) or "sheets.N." for a sheet of a v2 workbook save (cp35).
export function parseBody(doc, at = "") {
  const path = (part, key) => (at === "" ? key ?? part : `${at}${part}${key === undefined ? "" : "." + key}`);
  if (!isPlain(doc.cells)) throw bad(path("cells"), "cells must be an object");
  if (!isPlain(doc.names)) throw bad(path("names"), "names must be an object");
  const inputs = new Map();
  for (const [k, v] of Object.entries(doc.cells)) {
    if (normalise(k) !== k) throw bad(path("cells", k), `${k} is not an upper-case cell address`);
    if (typeof v !== "string" || v === "") throw bad(path("cells", k), `${k} must hold a non-empty string`);
    inputs.set(k, v);
  }
  const names = new Map();
  for (const [n, ref] of Object.entries(doc.names)) {
    let d;
    try {
      if (checkName(n) !== n) throw new Error("case");
      d = parseNameRef(ref);
    } catch {
      throw bad(path("names", n), `${n} is not a valid name and target`);
    }
    if (nameText(d) !== ref) throw bad(path("names", n), `${n} target must be written as ${nameText(d)}`);
    names.set(n, d);
  }
  return { inputs, names };
}

// The checks after the JSON object of a v1 sheet save.
export function parseSheetDoc(doc) {
  if (doc.format !== FORMAT) throw bad("format", `format is ${JSON.stringify(doc.format)}`);
  if (doc.version !== VERSION) throw bad("version", `version is ${JSON.stringify(doc.version)}`);
  return parseBody(doc);
}

// { inputs: Map, names: Map } from save text, or throws #LOAD. Checks in a fixed order.
export const parseSave = (json) => parseSheetDoc(parseDoc(json));
