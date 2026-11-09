// address.mjs: A1 addresses and row-major order (cp01).
const ADDR = /^([A-Za-z]{1,2})([1-9]\d{0,3})$/;

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
