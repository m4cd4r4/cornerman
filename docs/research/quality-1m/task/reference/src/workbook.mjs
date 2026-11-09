// workbook.mjs: createWorkbook() - named sheets sharing one engine, so formulas can read across (cp31).
import { makeError, errorOrderOption } from "./errors.mjs";
import { checkName } from "./names.mjs";
import { createEngine } from "./engine.mjs";
import { makeSheet, CORE } from "./sheet.mjs";

export function createWorkbook(opts) {
  const engine = createEngine(errorOrderOption(opts));
  const list = []; // { name, sheet } in creation order, name as typed
  const find = (name) => (typeof name === "string" ? list.findIndex((e) => e.name.toUpperCase() === name.toUpperCase()) : -1);

  const book = {
    addSheet(name) {
      checkName(name);
      if (find(name) >= 0) throw makeError("#SHEET", name, `a sheet named ${name} already exists`);
      const sheet = makeSheet(null, engine.errorOrder);
      CORE.get(sheet).bind(engine, name);
      list.push({ name, sheet });
      return sheet;
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
  };
  return book;
}
