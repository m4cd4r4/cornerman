// workbook.mjs: createWorkbook() - named sheets sharing one engine, so formulas can read across (cp31).
import { makeError } from "./errors.mjs";
import { sheetOptions } from "./locale.mjs";
import { checkName } from "./names.mjs";
import { createEngine } from "./engine.mjs";
import { makeSheet, CORE } from "./sheet.mjs";
import { renameRefs, dropSheetRefs } from "./refs.mjs";
import { addBookNames } from "./booknames.mjs";
import { createHistory } from "./history.mjs";
import { hasV3Layers, sheetEntry } from "./save3.mjs";
import { wrapCalls } from "./events.mjs";
import { addBatch } from "./batch.mjs";

export const createWorkbook = (opts) => { const o = sheetOptions(opts); return buildWorkbook(o.errorOrder, [], new Map(), o.decimal); };

// order = "priority" | "first"; loaded = [{ name, init }] and bookNames = Map NAME -> target from a
// workbook save (cp35, cp53), already checked. decimal = "." or "," (cp63), shared by every sheet.
export function buildWorkbook(order, loaded, bookNames = new Map(), decimal = ".") {
  const engine = createEngine(order, decimal);
  const nameHistory = createHistory(); // cp55: workbook name changes
  const applyName = (e, side) => engine.setBookName(e.bookName, e[side]);
  // cp55: the list (a sheet's, or the names list) whose next step by `which` is the newest.
  function newest(which) {
    const lists = [...list.map((e) => ({ h: CORE.get(e.sheet).history, run: (w) => e.sheet[w]() })), { h: nameHistory, run: (w) => nameHistory[w](applyName) }];
    let best = null;
    for (const x of lists) if (x.h[which]() >= 0 && (!best || x.h[which]() > best.h[which]())) best = x;
    return best;
  }
  const list = []; // { name, sheet } in creation order, name as typed
  const find = (name) => (typeof name === "string" ? list.findIndex((e) => e.name.toUpperCase() === name.toUpperCase()) : -1);
  const add = (name, init) => {
    const sheet = makeSheet(init, engine.errorOrder, engine.decimal);
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
      CORE.get(e.sheet).bind(createEngine(engine.errorOrder, engine.decimal), null);
      return true;
    },
    // cp54: remove the sheet as removeSheet does, rewrite every reference to it as #REF!, drop the
    // workbook names on it, and clear every undo list. Returns how many inputs were rewritten.
    deleteSheet(name) {
      const i = find(name);
      if (i < 0) throw makeError("#SHEET", String(name), `no sheet named ${name}`);
      const OLD = list[i].name.toUpperCase();
      const [e] = list.splice(i, 1);
      CORE.get(e.sheet).bind(createEngine(engine.errorOrder, engine.decimal), null);
      CORE.get(e.sheet).history.clear();
      nameHistory.clear();
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
      nameHistory.clear();
      for (const e of list) CORE.get(e.sheet).renamed((v) => renameRefs(v, OLD, newName));
    },
    // cp55: undo the newest step on any sheet or on the names list, or redo the one undone last.
    undo() {
      const x = newest("nextUndo");
      return x ? x.run("undo") : false;
    },
    redo() {
      const x = newest("nextRedo");
      return x ? x.run("redo") : false;
    },
    // cp35: the whole workbook as v2 save text; each sheet's cells and names as its own save writes them.
    // cp56: version 3 (every layer key in every sheet, names always) when a sheet has a v3 layer.
    save() {
      const v3 = list.some((e) => hasV3Layers(CORE.get(e.sheet).layers.L));
      const sheets = list.map((e) => sheetEntry(e.name, JSON.parse(e.sheet.save()), CORE.get(e.sheet).layers.L, v3));
      const names = book.names();
      const doc = { format: "workbook", version: v3 ? 3 : 2, errorOrder: engine.errorOrder, sheets };
      if (v3 || Object.keys(names).length) doc.names = names;
      return JSON.stringify(doc);
    },
  };
  for (const { name, init } of loaded) add(name, init);
  for (const [n, d] of bookNames) engine.setBookName(n, d);
  const sheets = () => list.map((e) => e.sheet);
  return wrapCalls(addBatch(addBookNames(book, engine, nameHistory), engine, nameHistory, sheets)); // cp65: one call each
}
