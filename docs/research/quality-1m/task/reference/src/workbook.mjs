// workbook.mjs: createWorkbook() - named sheets sharing one engine, so formulas can read across (cp31).
import { makeError, errorOrderOption } from "./errors.mjs";
import { checkName } from "./names.mjs";
import { createEngine } from "./engine.mjs";
import { makeSheet, CORE } from "./sheet.mjs";
import { renameRefs, dropSheetRefs } from "./refs.mjs";
import { addBookNames } from "./booknames.mjs";

export const createWorkbook = (opts) => buildWorkbook(errorOrderOption(opts), []);

// order = "priority" | "first"; loaded = [{ name, init }] and bookNames = Map NAME -> target from a
// workbook save (cp35, cp53), already checked.
export function buildWorkbook(order, loaded, bookNames = new Map()) {
  const engine = createEngine(order);
  const list = []; // { name, sheet } in creation order, name as typed
  const find = (name) => (typeof name === "string" ? list.findIndex((e) => e.name.toUpperCase() === name.toUpperCase()) : -1);
  const add = (name, init) => {
    const sheet = makeSheet(init, engine.errorOrder);
    CORE.get(sheet).bind(engine, name);
    list.push({ name, sheet });
    return sheet;
  };

  const book = {
    addSheet(name) {
      checkName(name);
      if (find(name) >= 0) throw makeError("#SHEET", name, `a sheet named ${name} already exists`);
      return add(name, null);
    },
    get(name) {
      return book.sheet(name);
    },
    sheet(name) {
      const i = find(name);
      if (i < 0) throw makeError("#SHEET", String(name), `no sheet named ${name}`);
      return list[i].sheet;
    },
    sheetNames() {
      return list.map((e) => e.name);
    },
    // The removed sheet keeps working on its own, as a sheet in no workbook.
    removeSheet(name) {
      const i = find(name);
      if (i < 0) return false;
      const [e] = list.splice(i, 1);
      CORE.get(e.sheet).bind(createEngine(engine.errorOrder), null);
      return true;
    },
    // cp54: remove the sheet as removeSheet does, rewrite every reference to it as #REF!, drop the
    // workbook names on it, and clear every undo list. Returns how many inputs were rewritten.
    deleteSheet(name) {
      const i = find(name);
      if (i < 0) throw makeError("#SHEET", String(name), `no sheet named ${name}`);
      const OLD = list[i].name.toUpperCase();
      const [e] = list.splice(i, 1);
      CORE.get(e.sheet).bind(createEngine(engine.errorOrder), null);
      CORE.get(e.sheet).history.clear();
      for (const [n, d] of [...engine.bookNames]) if (d.sheet && d.sheet.toUpperCase() === OLD) engine.setBookName(n, undefined);
      return list.reduce((count, x) => count + CORE.get(x.sheet).renamed((v) => dropSheetRefs(v, OLD)), 0);
    },
    // cp37: rename a sheet and rewrite every formula in the book that names it. Clears every
    // sheet's undo and redo; renaming to the exact same name does nothing.
    renameSheet(oldName, newName) {
      const i = find(oldName);
      if (i < 0) throw makeError("#SHEET", String(oldName), `no sheet named ${oldName}`);
      checkName(newName);
      const j = find(newName);
      if (j >= 0 && j !== i) throw makeError("#SHEET", newName, `a sheet named ${newName} already exists`);
      if (list[i].name === newName) return;
      const OLD = list[i].name.toUpperCase();
      list[i].name = newName;
      engine.rename(OLD, newName);
      for (const e of list) CORE.get(e.sheet).renamed((v) => renameRefs(v, OLD, newName));
    },
    // cp35: the whole workbook as v2 save text; each sheet's cells and names as its own save writes them.
    save() {
      const sheets = list.map((e) => {
        const { cells, names, notes } = JSON.parse(e.sheet.save());
        if (notes) return { name: e.name, cells, names, notes };
        return { name: e.name, cells, names };
      });
      const names = book.names();
      if (!Object.keys(names).length) return JSON.stringify({ format: "workbook", version: 2, errorOrder: engine.errorOrder, sheets });
      return JSON.stringify({ format: "workbook", version: 2, errorOrder: engine.errorOrder, sheets, names });
    },
  };
  for (const { name, init } of loaded) add(name, init);
  for (const [n, d] of bookNames) engine.setBookName(n, d);
  return addBookNames(book, engine);
}
