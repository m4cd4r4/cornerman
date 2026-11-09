// hiding.mjs: hidden rows and columns (cp49). Hidden is a property of the row or column number,
// not of the cells in it; insert and delete move it (structure.mjs), nothing else does.
import { position } from "./structure.mjs";
import { colName } from "./address.mjs";

export function addHiding(sheet, core) {
  const { layers, history } = core;
  // One undo step when at least one row or column changes; nothing recorded otherwise.
  function lines(layer, axis, at, count, on) {
    const pos = position(axis, at, count);
    const pairs = [];
    for (let i = pos; i < pos + count; i++) pairs.push([i, on ? true : undefined]);
    history.record(layers.write(layer, pairs));
  }
  const numbers = (layer) => [...layers.L[layer].keys()].sort((a, b) => a - b);
  Object.assign(sheet, {
    hideRows: (at, count = 1) => lines("rows", "row", at, count, true),
    showRows: (at, count = 1) => lines("rows", "row", at, count, false),
    hideCols: (at, count = 1) => lines("cols", "col", at, count, true),
    showCols: (at, count = 1) => lines("cols", "col", at, count, false),
    hiddenRows: () => numbers("rows"),
    hiddenCols: () => numbers("cols").map(colName),
  });
  return sheet;
}
