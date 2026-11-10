// export.mjs: sheet.exportJSON(target, opts) (cp77): a range as JSON text, row by row: values as
// value() gives them (or display texts), and optionally each cell's number format. Hidden rows and
// columns are included, unlike toCSV.
import { parseTarget } from "./layers.mjs";
import { colName } from "./address.mjs";
import { makeError, isError } from "./errors.mjs";

// undefined or a plain object whose display and formats, when given, are booleans; throws #ARG.
function checkOptions(opts) {
  if (opts === undefined) return {};
  if (opts === null || typeof opts !== "object" || Array.isArray(opts)) throw makeError("#ARG", String(opts), "exportJSON options must be an object");
  for (const k of ["display", "formats"]) {
    if (k in opts && typeof opts[k] !== "boolean") throw makeError("#ARG", k, `${k} must be true or false`);
  }
  return opts;
}

// A value as JSON writes it: empty and non-finite numbers null, an error { error, cell }.
const jsonValue = (v) => (v === null ? null : isError(v) ? { error: v.code, cell: v.cell } : typeof v === "number" && !Number.isFinite(v) ? null : v);

export function addExport(sheet, core) {
  sheet.exportJSON = (target, opts) => {
    const t = parseTarget(target);
    const o = checkOptions(opts);
    const values = [];
    const formats = [];
    for (let r = t.r1; r <= t.r2; r++) {
      const vs = [];
      const fs = [];
      for (let c = t.c1; c <= t.c2; c++) {
        const k = colName(c) + r;
        vs.push(o.display ? sheet.text(k) : jsonValue(sheet.value(k)));
        fs.push(core.layers.L.formats.get(k) ?? null);
      }
      values.push(vs);
      formats.push(fs);
    }
    const doc = { range: `${t.a}:${t.b}`, values };
    if (o.formats) doc.formats = formats;
    return JSON.stringify(doc);
  };
  return sheet;
}
