// Tokens for formulas (cp02, cp03, cp06, cp07).
const OPS = ["<=", ">=", "<>", "=", "<", ">", "&", "+", "-", "*", "/", "^", "%", "(", ")", ",", ":", "!"];

export class ParseError extends Error {}

export function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (/[0-9]/.test(c)) {
      const m = /^\d+(\.\d+)?/.exec(src.slice(i));
      const after = src[i + m[0].length];
      if (after === "." || (after && /[A-Za-z_]/.test(after))) throw new ParseError("bad number");
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let s = "";
      for (;;) {
        if (j >= src.length) throw new ParseError("unterminated string");
        if (src[j] === '"') {
          if (src[j + 1] === '"') { s += '"'; j += 2; continue; }
          j++;
          break;
        }
        s += src[j++];
      }
      out.push({ t: "str", v: s });
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_.$]*/.exec(src.slice(i));
      out.push({ t: "word", v: m[0] });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ParseError(`unexpected ${c}`);
    out.push({ t: "op", v: op });
    i += op.length;
  }
  return out;
}
