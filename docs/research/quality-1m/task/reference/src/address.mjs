// address.mjs: A1 addresses, row-major order and ranges (cp01, cp13).
const ADDR = /^([A-Za-z]{1,2})([1-9]\d{0,3})$/;
export const RANGE_LIMIT = 10000;

export function parseAddress(text) {
  if (typeof text !== "string") return null;
  const m = ADDR.exec(text);
  if (!m) return null;
  const letters = m[1].toUpperCase();
  let col = 0;
  for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: Number(m[2]), key: letters + m[2] };
}

export function normalise(text) {
  const p = parseAddress(text);
  return p ? p.key : null;
}

export function compareAddresses(a, b) {
  const pa = parseAddress(a);
  const pb = parseAddress(b);
  if (!pa || !pb) return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  return pa.row - pb.row || pa.col - pb.col;
}

export function colName(col) {
  let s = "";
  while (col > 0) {
    const r = (col - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

// Corners of the rectangle spanned by two keys, top-left first.
export function rangeBox(a, b) {
  const pa = parseAddress(a);
  const pb = parseAddress(b);
  return {
    r1: Math.min(pa.row, pb.row), r2: Math.max(pa.row, pb.row),
    c1: Math.min(pa.col, pb.col), c2: Math.max(pa.col, pb.col),
  };
}

export function rangeSize(a, b) {
  const { r1, r2, c1, c2 } = rangeBox(a, b);
  return (r2 - r1 + 1) * (c2 - c1 + 1);
}

// Every key in the range, row-major; null when it holds more than RANGE_LIMIT cells.
export function rangeKeys(a, b) {
  if (rangeSize(a, b) > RANGE_LIMIT) return null;
  const { r1, r2, c1, c2 } = rangeBox(a, b);
  const out = [];
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(colName(c) + r);
  return out;
}

export function rangeText(a, b) {
  const { r1, r2, c1, c2 } = rangeBox(a, b);
  return `${colName(c1)}${r1}:${colName(c2)}${r2}`;
}
