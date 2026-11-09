// evaluate.mjs: formula evaluation (cp02-cp08; ranges cp13, names cp14).
import { makeError, isError, pickError } from "./errors.mjs";
import { displayValue } from "./display.mjs";
import { callFunction } from "./functions.mjs";
import { rangeCells } from "./args.mjs";

const TOL = 1e-9;

export function numEqual(a, b) {
  return Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b));
}

export function toNumber(v, cell) {
  if (v === null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return makeError("#VALUE!", cell, "text used in arithmetic");
}

const typeRank = (v) => (typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2);

function emptyLike(other) {
  if (typeof other === "string") return "";
  if (typeof other === "boolean") return false;
  return 0;
}

// -1, 0, 1 under cp06 + cp08 rules.
export function compareValues(a, b) {
  if (a === null && b === null) return 0;
  if (a === null) a = emptyLike(b);
  if (b === null) b = emptyLike(a);
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra !== rb) return ra < rb ? -1 : 1;
  if (ra === 0) return numEqual(a, b) ? 0 : a < b ? -1 : 1;
  if (ra === 1) {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    return x === y ? 0 : x < y ? -1 : 1;
  }
  return a === b ? 0 : a ? 1 : -1;
}

function arith(op, a, b, cell) {
  const x = toNumber(a, cell);
  const y = toNumber(b, cell);
  const err = pickError([x, y]);
  if (err) return err;
  switch (op) {
    case "+": return x + y;
    case "-": return x - y;
    case "*": return x * y;
    case "/": return y === 0 ? makeError("#DIV/0!", cell, "division by zero") : x / y;
    case "^": return Math.pow(x, y);
  }
  throw new Error(`unknown op ${op}`);
}

function compareOp(op, a, b) {
  const c = compareValues(a, b);
  switch (op) {
    case "=": return c === 0;
    case "<>": return c !== 0;
    case "<": return c < 0;
    case ">": return c > 0;
    case "<=": return c <= 0;
    case ">=": return c >= 0;
  }
  throw new Error(`unknown comparison ${op}`);
}

// ctx: { cell, read(addr), name(NAME) -> { a, b, range } | null }
export function evaluate(node, ctx) {
  switch (node.k) {
    case "num": return node.v;
    case "str": return node.v;
    case "bool": return node.v;
    case "ref": return ctx.read(node.sheet ? `${node.sheet}!${node.addr}` : node.addr);
    case "badref": return makeError("#REF!", ctx.cell, `invalid reference ${node.v}`);
    case "name": {
      const n = ctx.name(node.v);
      if (!n) return makeError("#NAME?", ctx.cell, `unknown name ${node.v}`);
      if (n.range) return makeError("#VALUE!", ctx.cell, `range name ${node.v} used as a value`);
      return ctx.read(n.a);
    }
    case "range": {
      const r = rangeCells(node, ctx);
      return isError(r) ? r : makeError("#VALUE!", ctx.cell, "range used outside a function");
    }
    case "call": return callFunction(node, ctx, evaluate);
    case "pct": {
      const v = evaluate(node.arg, ctx);
      if (isError(v)) return v;
      const n = toNumber(v, ctx.cell);
      return isError(n) ? n : n / 100;
    }
    case "neg": {
      const v = evaluate(node.arg, ctx);
      if (isError(v)) return v;
      const n = toNumber(v, ctx.cell);
      if (isError(n)) return n;
      return node.op === "-" ? -n : n;
    }
    case "bin": {
      const a = evaluate(node.left, ctx);
      const b = evaluate(node.right, ctx);
      const err = pickError([a, b]);
      if (err) return err;
      if (node.op === "&") return displayValue(a) + displayValue(b);
      if (node.op.length === 2 || "=<>".includes(node.op)) return compareOp(node.op, a, b);
      return arith(node.op, a, b, ctx.cell);
    }
  }
  throw new Error(`unknown node ${node.k}`);
}
