// bookio.mjs: loadWorkbook(text) - a v2 or v3 (cp56) workbook save, or a v1 sheet save migrated to one
// sheet (cp35), with the workbook names after the sheets (cp53).
import { parseDoc, parseSheetDoc, parseBody, bad, isPlain } from "./persist.mjs";
import { checkName } from "./names.mjs";
import { loadBookTarget } from "./booknames.mjs";
import { buildWorkbook } from "./workbook.mjs";
import { parseLayers } from "./save3.mjs";

export const MIGRATED_NAME = "Sheet_1";

export function loadWorkbook(json) {
  const doc = parseDoc(json);
  if (doc.format === "sheet") return buildWorkbook("priority", [{ name: MIGRATED_NAME, init: parseSheetDoc(doc) }]);
  if (doc.format !== "workbook") throw bad("format", `format is ${JSON.stringify(doc.format)}`);
  if (doc.version !== 2 && doc.version !== 3) throw bad("version", `version is ${JSON.stringify(doc.version)}`);
  const v3 = doc.version === 3; // every layer key and the top-level names are required
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
    if (!v3) return { name: s.name, init: parseBody(s, `${at}.`) };
    return { name: s.name, init: { ...parseBody({ ...s, notes: s.notes ?? null }, `${at}.`), ...parseLayers(s, at) } };
  });
  return buildWorkbook(doc.errorOrder, sheets, bookNames(v3 ? doc.names ?? null : doc.names));
}

// cp53: the optional top-level names of a workbook save, checked after every sheet.
function bookNames(names) {
  const out = new Map();
  if (names === undefined) return out;
  if (!isPlain(names)) throw bad("names", "names must be an object");
  for (const [n, text] of Object.entries(names)) {
    try {
      if (checkName(n) !== n) throw new Error("case");
      out.set(n, loadBookTarget(text));
    } catch {
      throw bad(`names.${n}`, `${n} is not a valid workbook name and target`);
    }
  }
  return out;
}
