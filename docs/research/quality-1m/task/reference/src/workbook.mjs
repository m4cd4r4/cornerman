// workbook.mjs: createWorkbook() - named sheets sharing one engine, so formulas can read across (cp31).
import { makeError, errorOrderOption } from "./errors.mjs";
import { checkName } from "./names.mjs";
import { createEngine } from "./engine.mjs";
import { makeSheet, CORE } from "./sheet.mjs";

export const createWorkbook = (opts) => buildWorkbook(errorOrderOption(opts), []);

// order = "priority" | "first"; loaded = [{ name, init }] from a workbook save (cp35), already checked.
export function buildWorkbook(order, loaded) {
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
    // cp35: the whole workbook as v2 save text; each sheet's cells and names as its own save writes them.
    save() {
      const sheets = list.map((e) => {
        const { cells, names } = JSON.parse(e.sheet.save());
        return { name: e.name, cells, names };
      });
      return JSON.stringify({ format: "workbook", version: 2, errorOrder: engine.errorOrder, sheets });
    },
  };
  for (const { name, init } of loaded) add(name, init);
  return book;
}
