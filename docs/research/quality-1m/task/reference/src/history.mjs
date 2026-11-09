// history.mjs: undo and redo stacks (cp27). An entry is one of
//   { cells: [[key, before, after], ...] }   set, copy, fromCSV: per-cell inputs ("" = empty)
//   { name, before, after }                   defineName, removeName (undefined = no name)
//   { state: { before, after } }              structural ops: { inputs, names } snapshots
// index.mjs owns applying an entry; this file only keeps the order.
export const HISTORY_LIMIT = 100;

export function createHistory(limit = HISTORY_LIMIT) {
  const done = [];
  const undone = [];
  return {
    record(entry) {
      done.push(entry);
      if (done.length > limit) done.shift();
      undone.length = 0;
    },
    clear() {
      done.length = 0;
      undone.length = 0;
    },
    undo(apply) {
      const e = done.pop();
      if (!e) return false;
      apply(e, "before");
      undone.push(e);
      return true;
    },
    redo(apply) {
      const e = undone.pop();
      if (!e) return false;
      apply(e, "after");
      done.push(e);
      return true;
    },
  };
}

// Shallow copy of the sheet's inputs and names, for a structural entry.
export const snapshot = (inputs, names) => ({ inputs: new Map(inputs), names: new Map(names) });

export function sameState(x, y) {
  const same = (a, b, eq) => a.size === b.size && [...a].every(([k, v]) => b.has(k) && eq(v, b.get(k)));
  return same(x.inputs, y.inputs, (a, b) => a === b) && same(x.names, y.names, (a, b) => JSON.stringify(a) === JSON.stringify(b));
}
