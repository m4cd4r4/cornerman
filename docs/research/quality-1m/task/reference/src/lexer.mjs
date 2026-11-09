// lexer.mjs: tokens for formulas, with source positions (cp02, cp03, cp06, cp07, cp23).
const OPS = ["<=", ">=", "<>", "=", "<", ">", "&", "+", "-", "*", "/", "^", "%", "(", ")", ",", ":", "!"];

export class ParseError extends Error {}

// Each token: { t, v, s, e } where s..e is its span in src.
export function tokenize(src) {
  const out = [];
  let i = 0;
  const push = (t, v, s) => out.push({ t, v, s, e: i });
  while (i < src.length) {
    const c = src[i];
    const s = i;
    if (c === " " || c === "\t") { i++; continue; }
    if (/[0-9]/.test(c)) {
      const m = /^\d+(\.\d+)?/.exec(src.slice(i));
      const after = src[i + m[0].length];
      if (after === "." || (after && /[A-Za-z_]/.test(after))) throw new ParseError("bad number");
      i += m[0].length;
      push("num", Number(m[0]), s);
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let str = "";
      for (;;) {
        if (j >= src.length) throw new ParseError("unterminated string");
        if (src[j] === '"') {
          if (src[j + 1] === '"') { str += '"'; j += 2; continue; }
          j++;
          break;
        }
        str += src[j++];
      }
      i = j;
      push("str", str, s);
      continue;
    }
    if (src.startsWith("#REF!", i)) {
      i += 5;
      push("referr", "#REF!", s);
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_.$]*/.exec(src.slice(i));
      i += m[0].length;
      push("word", m[0], s);
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ParseError(`unexpected ${c}`);
    i += op.length;
    push("op", op, s);
  }
  return out;
}
