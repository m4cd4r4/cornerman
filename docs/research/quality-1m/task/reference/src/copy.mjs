// copy.mjs: sheet.copy(from, to) - the writes a copy makes, worked out before any is applied (cp26).
import { parseAddress, rangeBox, rangeSize, colName, RANGE_LIMIT } from "./address.mjs";
import { makeError, throwAddr } from "./errors.mjs";
import { rewriteRefs, onSheet, MAX_ROW, MAX_COL } from "./refs.mjs";

// [[key, input, source key]] in row-major source order; input "" clears the target.
export function copyWrites(inputs, from, to) {
  const parts = typeof from === "string" ? from.split(":") : [];
  const a = parts.length >= 1 && parts.length <= 2 ? parseAddress(parts[0]) : null;
  const b = parts.length === 2 ? parseAddress(parts[1]) : a;
  if (!a || !b) throwAddr(from);
  const t = parseAddress(to);
  if (!t) throwAddr(to);
  if (rangeSize(a.key, b.key) > RANGE_LIMIT) throw makeError("#ARG", from, `copy source holds more than ${RANGE_LIMIT} cells`);
  const { r1, r2, c1, c2 } = rangeBox(a.key, b.key);
  const dr = t.row - r1;
  const dc = t.col - c1;
  if (r2 + dr > MAX_ROW || c2 + dc > MAX_COL) throw makeError("#ARG", to, `copy to ${to} would pass the sheet edge`);

  const one = (p) => {
    const q = { ...p, row: p.absRow ? p.row : p.row + dr, col: p.absCol ? p.col : p.col + dc };
    return onSheet(q) ? q : null;
  };
  const range = (x, y) => {
    const qx = one(x);
    const qy = one(y);
    return qx === null || qy === null ? null : [qx, qy];
  };
  const writes = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const raw = inputs.get(colName(c) + r) ?? "";
      const out = raw.startsWith("=") ? "=" + rewriteRefs(raw.slice(1), one, range) : raw;
      writes.push([colName(c + dc) + (r + dr), out, colName(c) + r]);
    }
  }
  return writes;
}
