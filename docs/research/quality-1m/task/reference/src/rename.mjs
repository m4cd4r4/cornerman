// rename.mjs: renaming a defined name (cp78). sheet.renameName (one undo step) and book.renameName
// (not undoable) keep the target and rewrite every formula that uses the name, where no LET hides it.
import { tokenize } from "./lexer.mjs";
import { parseFormula, ParseError } from "./parser.mjs";
import { letNames } from "./let.mjs";
import { checkName } from "./names.mjs";
import { makeError } from "./errors.mjs";
import { CORE } from "./sheet.mjs";

const REFLIKE = /^\$?[A-Za-z]+\$?\d+$/;

// For each name node of the tree, in source order: its name where it uses a defined name, or
// null (a LET's own name, or a name a LET hides there). Mirrors graph.mjs collectRefs.
function nameUses(ast) {
  const out = [];
  (function walk(n, scope) {
    switch (n.k) {
      case "name": out.push(scope.has(n.v) ? null : n.v); break;
      case "bin": walk(n.left, scope); walk(n.right, scope); break;
      case "neg": case "pct": walk(n.arg, scope); break;
      case "call": {
        const local = n.fn === "LET" ? letNames(n.args) : null;
        if (!local) { n.args.forEach((a) => walk(a, scope)); break; }
        let inner = scope;
        local.forEach((name, j) => { out.push(null); walk(n.args[2 * j + 1], inner); inner = new Set([...inner, name]); });
        walk(n.args[n.args.length - 1], inner);
      }
    }
  })(ast, new Set());
  return out;
}

// The word tokens the parser reads as names: not a function, a sheet prefix, a reference or a boolean.
function nameTokens(toks) {
  const op = (t, v) => t && t.t === "op" && t.v === v;
  return toks.filter((t, i) => t.t === "word" && !op(toks[i + 1], "(") && !op(toks[i + 1], "!") && !op(toks[i - 1], "!") && !REFLIKE.test(t.v) && !/^(TRUE|FALSE)$/i.test(t.v));
}

// input with every use of the name OLD (upper case) written as next. Values, unparseable formulas
// and formulas without such a use are returned unchanged.
export function renameNameRefs(input, OLD, next) {
  if (!input.startsWith("=")) return input;
  const src = input.slice(1);
  let ast;
  try {
    ast = parseFormula(src);
  } catch (e) {
    if (e instanceof ParseError) return input;
    throw e;
  }
  const uses = nameUses(ast);
  const words = nameTokens(tokenize(src));
  let out = src;
  for (let i = words.length - 1; i >= 0; i--) if (uses[i] === OLD) out = out.slice(0, words[i].s) + next + out.slice(words[i].e);
  return "=" + out;
}

// Checks in order: old is a name in has(), new is a valid name, new is not another name in has().
// Returns [OLD, NEW], NEW === OLD for a case-only rename.
function checkRename(has, oldName, newName) {
  const OLD = typeof oldName === "string" ? oldName.toUpperCase() : "";
  if (!has(OLD)) throw makeError("#BADNAME", String(oldName), `no name ${oldName}`);
  const NEW = checkName(newName);
  if (NEW !== OLD && has(NEW)) throw makeError("#BADNAME", String(newName), `${newName} is already a name`);
  return [OLD, NEW];
}

export function addRenameName(sheet, core) {
  sheet.renameName = (oldName, newName) => {
    const [OLD, NEW] = checkRename((n) => core.names.has(n), oldName, newName);
    if (NEW === OLD) return 0;
    const writes = [...core.keys()].map((k) => [k, renameNameRefs(core.input(k), OLD, newName)]).filter(([k, v]) => v !== core.input(k));
    const d = core.names.get(OLD);
    core.history.group(() => {
      core.setName(OLD, undefined);
      core.history.record({ name: OLD, before: d, after: undefined });
      core.setName(NEW, d);
      core.history.record({ name: NEW, before: undefined, after: d });
      core.writeRaw(writes); // not checked: locks, rules and limits never refuse a rename
    });
    return writes.length;
  };
  return sheet;
}

// list = [{ name, sheet }]; names = the workbook names' history. Clears every undo list, as
// renameSheet does; a sheet with its own name OLD keeps its formulas.
export function addBookRenameName(book, engine, names, list) {
  book.renameName = (oldName, newName) => {
    const [OLD, NEW] = checkRename((n) => engine.bookNames.has(n), oldName, newName);
    if (NEW === OLD) return 0;
    const d = engine.bookNames.get(OLD);
    engine.setBookName(OLD, undefined);
    engine.setBookName(NEW, d);
    names.clear();
    let count = 0;
    for (const e of list) {
      const core = CORE.get(e.sheet);
      if (core.names.has(OLD)) core.history.clear();
      else count += core.renamed((v) => renameNameRefs(v, OLD, newName));
    }
    return count;
  };
  return book;
}
