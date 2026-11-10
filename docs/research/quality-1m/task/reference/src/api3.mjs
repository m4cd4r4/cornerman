// api3.mjs: API v3 (cp75): sheet.cell and sheet.clear, and the deprecation log that counts the
// calls you make to the version 1 names (and book.sheet). Calls the library makes never count.
import { parseTarget } from "./layers.mjs";
import { userCalling } from "./events.mjs";

export const SHEET_OLD = { set: "setCell", get: "value", display: "text", cells: "addresses", getInput: "formula" };
export const BOOK_OLD = { sheet: "get" };

export function addV3(sheet, core) {
  Object.assign(sheet, {
    cell(address) {
      const k = core.key(address);
      return { address: k, input: core.input(k) ?? "", value: sheet.value(k), text: sheet.text(k) };
    },
    // Inputs only, as one undo step; covered cells keep their hidden inputs. Returns the count.
    clear(target) {
      const t = parseTarget(target);
      const writes = t.keys.filter((k) => core.input(k) !== null && !core.layers.L.covered.has(k)).map((k) => [k, ""]);
      core.writeRaw(core.layers.locked(writes)); // cp71: a locked cell with an input refuses
      return writes.length;
    },
  });
  return sheet;
}

// Wrap each old name of obj so that a call you make (not one made inside another public call,
// book.batch aside) is counted, also when it throws. table = { old: replacement }.
export function addDeprecations(obj, table) {
  const log = new Map();
  for (const [name, use] of Object.entries(table)) {
    const f = obj[name];
    obj[name] = (...args) => {
      if (userCalling()) {
        if (!log.has(name)) log.set(name, { name, use, calls: 0 });
        log.get(name).calls++;
      }
      return f(...args);
    };
  }
  obj.deprecations = () => [...log.values()].map((e) => ({ ...e }));
  return obj;
}
