// history.mjs: undo and redo stacks (cp27). An entry is one of
//   { cells: [[key, before, after], ...] }   set, copy, fromCSV: per-cell inputs ("" = empty)
//   { name, before, after }                   defineName, removeName (undefined = no name)
//   { state: { before, after } }              structural ops: { inputs, names, ...layers } snapshots
//   { layer, cells: [[key, before, after]] }  a per-cell layer (cp41 on; undefined = none)
//   { group: [entry, ...] }                   several entries made by one call (cp41 on)
//   { bookName, before, after }               a workbook name (cp53), on the book's own list (cp55)
// sheet.mjs owns applying an entry; this file only keeps the order and unpacks groups.
// cp55: every entry is stamped from one clock shared by all lists: t when it was made or redone,
// u when it was undone, so a workbook can find the newest step across its sheets. cp76: and label.
import { sameLayers } from "./layers.mjs";
import { callLabel } from "./events.mjs";

export const HISTORY_LIMIT = 100;
let CLOCK = 0;

// apply(entry, side) for every part of a group: in order for "after", reversed for "before".
const grouped = (fn) => function each(e, side) {
  if (!e.group) return fn(e, side);
  for (const x of side === "before" ? [...e.group].reverse() : e.group) each(x, side);
};

export function createHistory(limit = HISTORY_LIMIT) {
  const done = [];
  const undone = [];
  let buffer = null; // entries recorded inside group(fn)
  const history = {
    record(entry) {
      if (!entry) return;
      if (buffer) { buffer.push(entry); return; }
      entry.t = ++CLOCK;
      entry.label = callLabel(); // cp76
      done.push(entry);
      if (done.length > limit) done.shift();
      undone.length = 0;
    },
    // Everything fn records becomes one undo step.
    group(fn) {
      const outer = buffer;
      buffer = [];
      try {
        return fn();
      } finally {
        const parts = buffer;
        buffer = outer;
        if (parts.length) history.record(parts.length === 1 ? parts[0] : { group: parts });
      }
    },
    // cp55: the stamp of the step undo() or redo() would take next, or -1 when there is none.
    nextUndo: () => (done.length ? done[done.length - 1].t : -1),
    nextRedo: () => (undone.length ? undone[undone.length - 1].u : -1),
    // cp76: { label, at } for each step undo() or redo() would take, next first.
    steps: (which) => (which === "undo" ? done : undone).map((e) => ({ label: e.label, at: which === "undo" ? e.t : e.u })).reverse(),
    // cp66: both lists and their stamps, to put back when a batch rolls back.
    save: () => [done, undone].map((list) => list.map((e) => [e, e.t, e.u])),
    restore(saved) {
      [done, undone].forEach((list, i) => {
        list.length = 0;
        for (const [e, t, u] of saved[i]) list.push(Object.assign(e, { t, u }));
      });
    },
    clear() {
      done.length = 0;
      undone.length = 0;
    },
    undo(fn) {
      const apply = grouped(fn);
      const e = done.pop();
      if (!e) return false;
      apply(e, "before");
      e.u = ++CLOCK;
      undone.push(e);
      return true;
    },
    redo(fn) {
      const apply = grouped(fn);
      const e = undone.pop();
      if (!e) return false;
      apply(e, "after");
      e.t = ++CLOCK;
      done.push(e);
      return true;
    },
  };
  return history;
}

// Shallow copy of the sheet's inputs, names and layers, for a structural entry.
export const snapshot = (inputs, names, layers) => ({ inputs: new Map(inputs), names: new Map(names), ...(layers ? layers.state() : {}) });

export function sameState(x, y) {
  const same = (a, b, eq) => a.size === b.size && [...a].every(([k, v]) => b.has(k) && eq(v, b.get(k)));
  return same(x.inputs, y.inputs, (a, b) => a === b) && same(x.names, y.names, (a, b) => JSON.stringify(a) === JSON.stringify(b)) && sameLayers(x, y);
}
