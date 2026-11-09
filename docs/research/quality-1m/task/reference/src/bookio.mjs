// bookio.mjs: loadWorkbook(text) - a v2 workbook save, or a v1 sheet save migrated to one sheet (cp35).
import { parseDoc, parseSheetDoc, parseBody, bad, isPlain } from "./persist.mjs";
import { checkName } from "./names.mjs";
import { buildWorkbook } from "./workbook.mjs";

export const MIGRATED_NAME = "Sheet_1";

export function loadWorkbook(json) {
  const doc = parseDoc(json);
  if (doc.format === "sheet") return buildWorkbook("priority", [{ name: MIGRATED_NAME, init: parseSheetDoc(doc) }]);
  if (doc.format !== "workbook") throw bad("format", `format is ${JSON.stringify(doc.format)}`);
  if (doc.version !== 2) throw bad("version", `version is ${JSON.stringify(doc.version)}`);
  if (doc.errorOrder !== "priority" && doc.errorOrder !== "first") throw bad("errorOrder", `errorOrder is ${JSON.stringify(doc.errorOrder)}`);
  if (!Array.isArray(doc.sheets)) throw bad("sheets", "sheets must be an array");
  const seen = new Set();
  const sheets = doc.sheets.map((s, i) => {
    const at = `sheets.${i}`;
    if (!isPlain(s)) throw bad(at, `${at} must be an object`);
    try {
      checkName(s.name);
    } catch {
      throw bad(`${at}.name`, `${at}.name is not a valid sheet name`);
    }
    if (seen.has(s.name.toUpperCase())) throw bad(`${at}.name`, `a sheet named ${s.name} comes earlier`);
    seen.add(s.name.toUpperCase());
    return { name: s.name, init: parseBody(s, `${at}.`) };
  });
  return buildWorkbook(doc.errorOrder, sheets);
}
