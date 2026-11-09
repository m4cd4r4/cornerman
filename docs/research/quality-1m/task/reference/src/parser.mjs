// parser.mjs: formula parser (cp02, cp03, cp06, cp07, cp13, cp14). Precedence, lowest first:
// comparison < & < + - < * / < unary +- < ^ (right) < postfix %.
import { tokenize, ParseError } from "./lexer.mjs";
import { parseAddress } from "./address.mjs";

const CMP = new Set(["=", "<>", "<", ">", "<=", ">="]);
const REFLIKE = /^([A-Za-z]+)(\d+)$/;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FUNC = /^[A-Za-z][A-Za-z0-9.]*$/;

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
    if (t.t === "referr") return { k: "badref", v: "#REF!" };
    if (t.t === "op" && t.v === "(") {
      const e = comparison();
      if (!isOp(")")) throw new ParseError("missing )");
      take();
      return e;
    }
    if (t.t === "word") {
      if (isOp("(")) return call(t.v);
      const node = word(t.v);
      if ((node.k === "ref" || node.k === "badref") && isOp(":")) {
        take();
        const u = take();
        if (!u || u.t !== "word" || !REFLIKE.test(u.v)) throw new ParseError("bad range");
        const end = word(u.v);
        return { k: "range", a: node, b: end };
      }
      return node;
    }
    throw new ParseError(`unexpected ${t.v}`);
  }
  function call(w) {
    if (!FUNC.test(w)) throw new ParseError(`bad function name ${w}`);
    take();
    const args = [];
    if (isOp(")")) { take(); return { k: "call", fn: w.toUpperCase(), args }; }
    for (;;) {
      args.push(comparison());
      if (isOp(",")) { take(); continue; }
      if (isOp(")")) { take(); return { k: "call", fn: w.toUpperCase(), args }; }
      throw new ParseError("bad argument list");
    }
  }
  function word(w) {
    const up = w.toUpperCase();
    if (up === "TRUE") return { k: "bool", v: true };
    if (up === "FALSE") return { k: "bool", v: false };
    const m = REFLIKE.exec(w);
    if (m) {
      if (m[1].length > 2) throw new ParseError(`bad reference ${w}`);
      const a = parseAddress(w);
      return a ? { k: "ref", addr: a.key } : { k: "badref", v: w };
    }
    if (NAME.test(w)) return { k: "name", v: up };
    throw new ParseError(`bad word ${w}`);
  }

  const ast = comparison();
  if (p !== toks.length) throw new ParseError("trailing tokens");
  return ast;
}

export { ParseError };
