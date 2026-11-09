// canonical.mjs: a formula printed back from its parse (cp38). Upper case, no spaces, shortest
// number text, and only the parentheses the precedence in parser.mjs needs.
import { parseFormula, ParseError } from "./parser.mjs";

const LEVEL = { "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1, "&": 2, "+": 3, "-": 3, "*": 4, "/": 4, "^": 6 };
const level = (n) => (n.k === "bin" ? LEVEL[n.op] : n.k === "neg" ? 5 : n.k === "pct" ? 7 : 8);
const wrap = (n, needs) => (needs ? `(${print(n)})` : print(n));

// "007.50" -> "7.5", "0.0" -> "0": the typed digits with leading and trailing zeros dropped.
function numText(text) {
  const [int, frac = ""] = text.split(".");
  const i = int.replace(/^0+(?=\d)/, "");
  const f = frac.replace(/0+$/, "");
  return f ? `${i}.${f}` : i;
}

const cell = (n) => (n.k === "ref" ? n.text.toUpperCase() : n.v.toUpperCase());
const prefix = (n) => (n.sheet ? `${n.sheet}!` : "");

function print(n) {
  switch (n.k) {
    case "num": return numText(n.text);
    case "str": return `"${n.v.replaceAll('"', '""')}"`;
    case "bool": return n.v ? "TRUE" : "FALSE";
    case "ref":
    case "badref": return prefix(n) + cell(n);
    case "range": return `${prefix(n)}${cell(n.a)}:${cell(n.b)}`;
    case "name": return n.v;
    case "call": return `${n.fn}(${n.args.map(print).join(",")})`;
    case "neg": return n.op + wrap(n.arg, level(n.arg) < 5);
    case "pct": return `${wrap(n.arg, level(n.arg) < 7)}%`;
    case "bin": {
      if (n.op === "^") return `${wrap(n.left, level(n.left) < 7)}^${wrap(n.right, level(n.right) < 5)}`;
      const p = LEVEL[n.op];
      return `${wrap(n.left, level(n.left) < p)}${n.op}${wrap(n.right, level(n.right) <= p)}`;
    }
  }
  throw new Error(`unknown node ${n.k}`);
}

// The canonical text of one input: "" for an empty cell, non-formula text as is, and a formula
// that does not parse as typed.
export function canonicalInput(input) {
  if (input === null) return "";
  if (!input.startsWith("=")) return input;
  try {
    return `=${print(parseFormula(input.slice(1)))}`;
  } catch (e) {
    if (e instanceof ParseError) return input;
    throw e;
  }
}
