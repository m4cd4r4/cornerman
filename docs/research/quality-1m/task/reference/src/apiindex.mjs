// apiindex.mjs: apiIndex() (cp80): every public name, sorted: the package's exports, the methods of a
// sheet and the methods of a workbook, read from new objects so the index always matches them.
import { createSheet } from "./sheet.mjs";
import { createWorkbook } from "./workbook.mjs";

export const EXPORTS = ["apiIndex", "createSheet", "createWorkbook", "diffWorkbooks", "loadSheet", "loadWorkbook"];

const methods = (obj) => Object.keys(obj).filter((k) => typeof obj[k] === "function").sort();

export function apiIndex() {
  return { exports: [...EXPORTS], sheet: methods(createSheet()), workbook: methods(createWorkbook()) };
}
