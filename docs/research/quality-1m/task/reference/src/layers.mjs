// layers.mjs: what a sheet keeps beside its inputs (formats cp41, notes cp42, validation rules
// cp46, merges cp47, hidden rows and columns cp49), how it moves with insert and delete, its undo
// entries, its snapshot.
import { parseAddress, rangeKeys, rangeBox, rangeSize, colName, RANGE_LIMIT } from "./address.mjs";
import { makeError, throwAddr } from "./errors.mjs";
import { displayValue } from "./display.mjs";
import { parseFormat, formatNumber } from "./numfmt.mjs";
import { passes } from "./validation.mjs";
import { coveredBy, moveMerges, sortMerges } from "./merges.mjs";
import { checkLimits } from "./limits.mjs";

// Layers keyed by cell address. A value is a string (format text, note text) or a rule object.
export const CELL_LAYERS = ["formats", "notes", "rules", "locks"]; // locks: cp71, value true
// cp49: layers keyed by row number ("rows") or column number ("cols"); the value is true.
export const LINE_LAYERS = ["rows", "cols"];
const ALL = [...CELL_LAYERS, ...LINE_LAYERS];

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

// The layers of a snapshot moved by a structural change: cell(k) -> new key | null (dropped),
// box(merge) -> moved merge | null, line(layer, n) -> new row or column number | null.
export function moveLayers(state, cell, box, line) {
  const out = { merges: moveMerges(state.merges || [], box) };
  for (const n of ALL) {
    out[n] = new Map();
    for (const [k, v] of state[n] || []) {
      const to = CELL_LAYERS.includes(n) ? cell(k) : line(n, k);
      if (to !== null) out[n].set(to, v);
    }
  }
  return out;
}

const sameMap = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.has(k) && JSON.stringify(v) === JSON.stringify(b.get(k)));
export const sameLayers = (x, y) =>
  ALL.every((n) => sameMap(x[n] || new Map(), y[n] || new Map())) && JSON.stringify(x.merges || []) === JSON.stringify(y.merges || []);

// onCovered(keys): cells that became or stopped being covered by a merge, to recalculate.
// onLines(): a row or column was hidden or shown (cp49), so SUBTOTAL formulas (cp50) recalculate.
export function createLayers(onCovered, onLines = () => {}) {
  const L = { merges: [], covered: new Set() };
  for (const n of ALL) L[n] = new Map();
  let inputOf = () => "";
  // cp71: a locked cell refuses a write only when it would change the cell's input.
  const refuseLocked = (k, input) => {
    if (L.locks.has(k) && inputOf(k) !== input) throw makeError("#LOCKED", k, `${k} is protected`);
  };
  function setMerges(list) {
    const before = L.covered;
    L.merges = sortMerges(list);
    L.covered = coveredBy(L.merges);
    onCovered([...new Set([...before, ...L.covered])]);
  }

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
    if (cells.length && LINE_LAYERS.includes(layer)) onLines();
    return cells.length ? { layer, cells } : null;
  }

  return {
    L,
    write,
    state: () => ({ ...Object.fromEntries(ALL.map((n) => [n, new Map(L[n])])), merges: [...L.merges] }),
    load(next) {
      for (const n of ALL) L[n] = new Map(next[n] || []);
      L.merges = sortMerges(next.merges || []);
      L.covered = coveredBy(L.merges);
    },
    // cp47: the undo entry for replacing the merge list.
    merges(list) {
      const before = L.merges;
      setMerges(list);
      return { layer: "merges", before, after: L.merges };
    },
    applyEntry(e, side) {
      if (e.layer === "merges") return setMerges(e[side]);
      const list = side === "before" ? [...e.cells].reverse() : e.cells;
      for (const [k, before, after] of list) {
        const v = side === "before" ? before : after;
        if (v === undefined) L[e.layer].delete(k);
        else L[e.layer].set(k, v);
      }
      if (LINE_LAYERS.includes(e.layer)) onLines();
    },
    // cp71: the sheet's inputs, for the lock check; and the check alone (copy, sort).
    readInputs(fn) {
      inputOf = fn;
    },
    locked(writes) {
      for (const [k, input] of writes) refuseLocked(k, input);
      return writes;
    },
    // cp46, cp47, cp67, cp71: throws #MERGE, #LOCKED, #LIMIT or #INVALID for the first write refused.
    check(writes) {
      for (const [k, input] of writes) {
        if (L.covered.has(k)) throw makeError("#MERGE", k, `${k} is covered by a merge`);
        refuseLocked(k, input);
        checkLimits(k, input);
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
