// layers.mjs: what a sheet keeps per cell beside its inputs (formats cp41, notes cp42, validation
// rules cp46), how it moves with insert and delete, its undo entries, its structural snapshot.
import { parseAddress, rangeKeys, rangeBox, rangeSize, colName, RANGE_LIMIT } from "./address.mjs";
import { makeError, throwAddr } from "./errors.mjs";
import { displayValue } from "./display.mjs";
import { parseFormat, formatNumber } from "./numfmt.mjs";
import { passes } from "./validation.mjs";

// Layers keyed by cell address. A value is a string (format text, note text) or a rule object.
export const CELL_LAYERS = ["formats", "notes", "rules"];

// cp42: note text as setNote stores it (trimmed, 1 to NOTE_LIMIT characters).
export const NOTE_LIMIT = 200;
export const storedNote = (v) => typeof v === "string" && v !== "" && v === v.trim() && v.length <= NOTE_LIMIT;

// "A1" or "A1:B3" as given to setFormat and the like: { a, b, keys } with a top-left. Throws
// #ADDR (cell = the text as given) or #ARG for more than RANGE_LIMIT cells.
export function parseTarget(text) {
  const parts = typeof text === "string" ? text.split(":") : [];
  const a = parts.length >= 1 && parts.length <= 2 ? parseAddress(parts[0]) : null;
  const b = parts.length === 2 ? parseAddress(parts[1]) : a;
  if (!a || !b) throwAddr(String(text));
  if (rangeSize(a.key, b.key) > RANGE_LIMIT) throw makeError("#ARG", text, `${text} holds more than ${RANGE_LIMIT} cells`);
  const { r1, r2, c1, c2 } = rangeBox(a.key, b.key);
  return { a: colName(c1) + r1, b: colName(c2) + r2, keys: rangeKeys(a.key, b.key), r1, r2, c1, c2 };
}

// The layers of a snapshot moved by a structural change: cell(k) -> new key | null (dropped).
export function moveLayers(state, cell) {
  const out = {};
  for (const n of CELL_LAYERS) {
    out[n] = new Map();
    for (const [k, v] of state[n] || []) {
      const to = cell(k);
      if (to !== null) out[n].set(to, v);
    }
  }
  return out;
}

const sameMap = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.has(k) && JSON.stringify(v) === JSON.stringify(b.get(k)));
export const sameLayers = (x, y) => CELL_LAYERS.every((n) => sameMap(x[n] || new Map(), y[n] || new Map()));

export function createLayers() {
  const L = {};
  for (const n of CELL_LAYERS) L[n] = new Map();

  // pairs: [[key, value | undefined]]; returns the undo entry for the ones that change, or null.
  function write(layer, pairs) {
    const cells = [];
    for (const [k, v] of pairs) {
      const before = L[layer].get(k);
      if (JSON.stringify(before) === JSON.stringify(v)) continue;
      if (v === undefined) L[layer].delete(k);
      else L[layer].set(k, v);
      cells.push([k, before, v]);
    }
    return cells.length ? { layer, cells } : null;
  }

  return {
    L,
    write,
    state: () => Object.fromEntries(CELL_LAYERS.map((n) => [n, new Map(L[n])])),
    load(next) {
      for (const n of CELL_LAYERS) L[n] = new Map(next[n] || []);
    },
    applyEntry(e, side) {
      const list = side === "before" ? [...e.cells].reverse() : e.cells;
      for (const [k, before, after] of list) {
        const v = side === "before" ? before : after;
        if (v === undefined) L[e.layer].delete(k);
        else L[e.layer].set(k, v);
      }
    },
    // cp46: throws #INVALID for the first [key, input] its cell's rule refuses; writes nothing.
    check(writes) {
      for (const [k, input] of writes) {
        const r = L.rules.get(k);
        if (r && !passes(r, input)) throw makeError("#INVALID", k, `${k} refuses ${JSON.stringify(input)}`);
      }
      return writes;
    },
    // The text display() shows for value v in cell k: its number format applies to numbers only.
    show(k, v) {
      const f = typeof v === "number" ? parseFormat(L.formats.get(k)) : null;
      return f ? formatNumber(v, f) : displayValue(v);
    },
  };
}
