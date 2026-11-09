// booknames.mjs: workbook names (cp53): names every sheet of a workbook can use, for a range on a
// named sheet ("Data!A1:B3") or a constant (cp52). A sheet's own name of the same name wins.
import { makeError } from "./errors.mjs";
import { checkName, parseNameRef, nameText, checkConstant, parseConstant } from "./names.mjs";

// { sheet, a, b, range } for "Sheet!A1" or "Sheet!A1:B3"; the sheet name as typed, the cells as
// defineName stores them. Throws #ADDR with cell = the ref as given.
export function parseBookRef(ref) {
  const bad = () => { throw makeError("#ADDR", String(ref), `invalid workbook name target: ${ref}`); };
  const parts = typeof ref === "string" ? ref.split("!") : [];
  if (parts.length !== 2) bad();
  try {
    checkName(parts[0]);
    return { sheet: parts[0], ...parseNameRef(parts[1]) };
  } catch {
    return bad();
  }
}

// The target written as book.names() writes it, read back; throws when it is not written that way.
export function loadBookTarget(text) {
  const d = typeof text === "string" && text.startsWith("=") ? parseConstant(text) : parseBookRef(text);
  if (nameText(d) !== text) throw new Error("not written as names() writes it");
  return d;
}

// engine.bookNames is the shared map; engine.setBookName(n, d) applies a change (undefined removes).
export function addBookNames(book, engine) {
  function define(n, d) {
    const before = engine.bookNames.get(n);
    if (before && JSON.stringify(before) === JSON.stringify(d)) return;
    engine.setBookName(n, d);
  }
  Object.assign(book, {
    defineName: (name, ref) => define(checkName(name), parseBookRef(ref)),
    defineConstant(name, value) {
      const n = checkName(name);
      define(n, checkConstant(value));
    },
    removeName(name) {
      const n = typeof name === "string" ? name.toUpperCase() : "";
      if (!engine.bookNames.has(n)) return false;
      engine.setBookName(n, undefined);
      return true;
    },
    names() {
      const out = {};
      for (const n of [...engine.bookNames.keys()].sort()) out[n] = nameText(engine.bookNames.get(n));
      return out;
    },
  });
  return book;
}
