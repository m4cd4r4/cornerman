// batch.mjs: book.batch(fn) (cp66). fn runs with every change applied at once; when fn throws,
// every sheet of the workbook, the workbook names and every undo list are put back as they were.
import { makeError } from "./errors.mjs";
import { CORE } from "./sheet.mjs";

// The methods that change the workbook's list of sheets are refused inside a batch.
const SHEET_LIST = ["addSheet", "removeSheet", "renameSheet", "deleteSheet"];

export function addBatch(book, engine, nameHistory, sheets) {
  let open = false;
  const refuse = (what) => { throw makeError("#BATCH", what, `${what} cannot be called inside a batch`); };
  for (const k of SHEET_LIST) {
    const f = book[k];
    book[k] = (...args) => (open ? refuse(k) : f(...args));
  }

  // Put every saved sheet, the workbook names and the undo lists back. Rebuilding recalculates.
  function rollback(saved, names, nameSteps) {
    for (const { core, state, steps } of saved) {
      core.rebuild(state);
      core.history.restore(steps);
    }
    for (const n of new Set([...names.keys(), ...engine.bookNames.keys()])) {
      if (JSON.stringify(names.get(n)) !== JSON.stringify(engine.bookNames.get(n))) engine.setBookName(n, names.get(n));
    }
    nameHistory.restore(nameSteps);
  }

  book.batch = (fn) => {
    if (open) refuse("batch");
    if (typeof fn !== "function") throw makeError("#ARG", String(fn), "batch takes a function");
    const saved = sheets().map((s) => {
      const core = CORE.get(s);
      return { core, state: core.state(), steps: core.history.save() };
    });
    const names = new Map(engine.bookNames);
    const nameSteps = nameHistory.save();
    open = true;
    try {
      return fn(book);
    } catch (e) {
      open = false;
      rollback(saved, names, nameSteps);
      throw e;
    } finally {
      open = false;
    }
  };
  return book;
}
