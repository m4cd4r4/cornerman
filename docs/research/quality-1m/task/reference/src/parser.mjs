// Formula parser (cp02, cp03, cp06, cp07). Precedence, lowest first:
// comparison < & < + - < * / < unary +- < ^ (right) < postfix %.
import { tokenize, ParseError } from "./lexer.mjs";
import { parseAddress } from "./address.mjs";

const CMP = new Set(["=", "<>", "<", ">", "<=", ">="]);

export function parseFormula(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v) => toks[p] && toks[p].t === "op" && toks[p].v === v;
  const take = () => toks[p++];

  function comparison() {
    let left = concat();
    while (peek() && peek().t === "op" && CMP.has(peek().v)) {
      const op = take().v;
      left = { k: "bin", op, left, right: concat() };
    }
    return left;
  }
  function concat() {
    let left = additive();
    while (isOp("&")) { take(); left = { k: "bin", op: "&", left, right: additive() }; }
    return left;
  }
  function additive() {
    let left = term();
    while (isOp("+") || isOp("-")) {
      const op = take().v;
      left = { k: "bin", op, left, right: term() };
    }
    return left;
  }
  function term() {
    let left = unary();
    while (isOp("*") || isOp("/")) {
      const op = take().v;
      left = { k: "bin", op, left, right: unary() };
    }
    return left;
  }
  function unary() {
    if (isOp("-") || isOp("+")) {
      const op = take().v;
      return { k: "neg", op, arg: unary() };
    }
    return power();
  }
  function power() {
    const base = postfix();
    if (isOp("^")) { take(); return { k: "bin", op: "^", left: base, right: unary() }; }
    return base;
  }
  function postfix() {
    let node = primary();
    while (isOp("%")) { take(); node = { k: "pct", arg: node }; }
    return node;
  }
  function primary() {
    const t = take();
    if (!t) throw new ParseError("unexpected end");
    if (t.t === "num") return { k: "num", v: t.v };
    if (t.t === "str") return { k: "str", v: t.v };
    if (t.t === "op" && t.v === "(") {
      const e = comparison();
      if (!isOp(")")) throw new ParseError("missing )");
      take();
      return e;
    }
    if (t.t === "word") return word(t.v);
    throw new ParseError(`unexpected ${t.v}`);
  }
  function word(w) {
    const up = w.toUpperCase();
    if (up === "TRUE") return { k: "bool", v: true };
    if (up === "FALSE") return { k: "bool", v: false };
    if (/^[A-Za-z]+$/.test(w)) return { k: "name", v: w };
    const m = /^([A-Za-z]+)(\d+)$/.exec(w);
    if (!m) throw new ParseError(`bad word ${w}`);
    if (m[1].length > 2) throw new ParseError(`bad reference ${w}`);
    const a = parseAddress(w);
    return a ? { k: "ref", addr: a.key } : { k: "badref", v: w };
  }

  const ast = comparison();
  if (p !== toks.length) throw new ParseError("trailing tokens");
  return ast;
}

export { ParseError };
