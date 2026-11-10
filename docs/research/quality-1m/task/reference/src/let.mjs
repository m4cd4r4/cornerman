// let.mjs: LET(name1, value1, ..., calculation) (cp62): names local to one formula. A LET name
// holds a value, like a named constant (cp52), and hides sheet and workbook names of the same name.
import { makeError } from "./errors.mjs";

// The names a LET call defines (upper case, in order), or null when its arguments are not
// name, value pairs and a calculation, or a name comes twice. graph.mjs uses this for its scopes.
export function letNames(args) {
  if (args.length < 3 || args.length % 2 === 0) return null;
  const out = [];
  for (let i = 0; i < args.length - 1; i += 2) {
    const a = args[i];
    if (a.k !== "name" || out.includes(a.v)) return null;
    out.push(a.v);
  }
  return out;
}

// Every value is evaluated, in order, before the calculation; a value sees the names before it.
function letFn(args, ctx, evaluate) {
  const names = letNames(args);
  if (!names) return makeError("#VALUE!", ctx.cell, "LET takes name, value pairs and a calculation, each name once");
  const local = new Map();
  const scope = { ...ctx, name: (n) => (local.has(n) ? { value: local.get(n) } : ctx.name(n)) };
  names.forEach((n, j) => local.set(n, evaluate(args[2 * j + 1], scope)));
  return evaluate(args[args.length - 1], scope);
}

export const LETS = { LET: letFn };
