// undolist.mjs: what undo and redo would take next (cp76). Every step carries the label of the
// method you called that made it (history.mjs stamps it from events.mjs callLabel()).
import { CORE } from "./sheet.mjs";

export function addUndoList(sheet, core) {
  sheet.undoList = () => core.history.steps("undo").map((s) => s.label);
  sheet.redoList = () => core.history.steps("redo").map((s) => s.label);
  return sheet;
}

// list = [{ name, sheet }] in creation order; names = the workbook names' own history (cp55).
// Steps of every list, merged in the order book.undo() / book.redo() would take them.
export function addBookUndoList(book, list, names) {
  const merged = (which) => {
    const all = [...list.map((e) => ({ sheet: e.name, h: CORE.get(e.sheet).history })), { sheet: null, h: names }];
    const steps = all.flatMap((x) => x.h.steps(which).map((s) => ({ sheet: x.sheet, label: s.label, at: s.at })));
    return steps.sort((a, b) => b.at - a.at).map(({ sheet, label }) => ({ sheet, label }));
  };
  book.undoList = () => merged("undo");
  book.redoList = () => merged("redo");
  return book;
}
