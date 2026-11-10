// audit.mjs: the error audit (cp72): sheet.errorCells() and book.errorCells() list every cell whose
// value is an error, ordered by the error priority (cp04, cp09, cp21) with #PARSE! last, then by
// sheet creation order and row-major address. The errorOrder option (cp34) plays no part.
import { PRIORITY, isError } from "./errors.mjs";
import { compareAddresses } from "./address.mjs";
import { CORE } from "./sheet.mjs";

const ORDER = [...PRIORITY, "#PARSE!"];
const rank = (code) => {
  const i = ORDER.indexOf(code);
  return i < 0 ? ORDER.length : i;
};
// A stable sort by code, so the order given (sheet, then row-major) decides within a code.
const byCode = (list) => list.sort((x, y) => rank(x.code) - rank(y.code));

// { address, code, cell } for each error value on the sheet, row-major; covered cells read empty.
function errorsOf(core) {
  const out = [];
  for (const k of [...core.keys()].sort(compareAddresses)) {
    if (core.layers.L.covered.has(k)) continue;
    const v = core.valueOf(k);
    if (isError(v)) out.push({ address: k, code: v.code, cell: v.cell });
  }
  return out;
}

export function addAudit(sheet, core) {
  sheet.errorCells = () => byCode(errorsOf(core));
  return sheet;
}

// list = [{ name, sheet }] in creation order.
export function addBookAudit(book, list) {
  book.errorCells = () => byCode(list.flatMap((e) => errorsOf(CORE.get(e.sheet)).map((x) => ({ sheet: e.name, ...x }))));
  return book;
}
