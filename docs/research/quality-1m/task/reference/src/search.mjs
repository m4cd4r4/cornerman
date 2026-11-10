// search.mjs: SUBSTITUTE, FIND and SEARCH (cp61). Text arguments are display text and counts are
// truncated numbers, as for the text functions of cp18.
import { makeError, pickError } from "./errors.mjs";
import { textArg, intArg, arity } from "./args.mjs";

// Every argument evaluated: the first `texts` as display text, the rest as whole numbers.
function readArgs(args, ctx, evaluate, texts) {
  const vals = args.map((a, i) => (i < texts ? textArg(a, ctx, evaluate) : intArg(a, ctx, evaluate)));
  return { vals, err: pickError(vals) };
}

// SUBSTITUTE(text, old, new, [instance]): case-sensitive, occurrences counted left to right
// without overlapping.
function substitute(args, ctx, evaluate) {
  const bad = arity("SUBSTITUTE", args, ctx, 3, 4);
  if (bad) return bad;
  const { vals: [t, old, rep, n], err } = readArgs(args, ctx, evaluate, 3);
  if (err) return err;
  if (n !== undefined && n < 1) return makeError("#VALUE!", ctx.cell, "SUBSTITUTE: instance below 1");
  if (old === "") return t;
  if (n === undefined) return t.split(old).join(rep);
  let at = -1;
  for (let i = 0; i < n; i++) {
    at = t.indexOf(old, at < 0 ? 0 : at + old.length);
    if (at < 0) return t;
  }
  return t.slice(0, at) + rep + t.slice(at + old.length);
}

// SEARCH patterns: ? is any one character, * any run (even none). There is no escape character.
const ANY = "[\\s\\S]";
const RUN = "[\\s\\S]*?";
const literal = (ch) => ch.replace(/[.*+?^${}()|[\]\\]/, "\\$&");
function wildcard(p) {
  let src = "";
  for (const ch of p) src += ch === "?" ? ANY : ch === "*" ? RUN : literal(ch);
  return new RegExp(src, "i");
}

// FIND (case-sensitive, no wildcards) and SEARCH (ignoring case, wildcards): the 1-based position
// of the first match at or after start, or #N/A.
function finder(fn, search) {
  return (args, ctx, evaluate) => {
    const bad = arity(fn, args, ctx, 2, 3);
    if (bad) return bad;
    const { vals: [f, w, start = 1], err } = readArgs(args, ctx, evaluate, 2);
    if (err) return err;
    if (start < 1 || start > w.length + 1) return makeError("#VALUE!", ctx.cell, `${fn}: start outside the text`);
    let at = -1;
    if (!search) at = w.indexOf(f, start - 1);
    else {
      const m = wildcard(f).exec(w.slice(start - 1));
      if (m) at = m.index + start - 1;
    }
    return at < 0 ? makeError("#N/A", ctx.cell, `${fn}: not found`) : at + 1;
  };
}

export const SEARCHING = { SUBSTITUTE: substitute, FIND: finder("FIND", false), SEARCH: finder("SEARCH", true) };
