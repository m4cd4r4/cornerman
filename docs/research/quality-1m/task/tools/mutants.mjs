#!/usr/bin/env node
// Scorer self-test: each mutant is the reference with one plausible mistake. Its target
// checkpoint's hidden tests must fail; the report also lists collateral failures.
//   node mutants.mjs --work <empty dir>
// Exit 0 only if every mutant applied cleanly AND failed its target.
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REF = resolve(HERE, "..", "reference");
const CHECK = join(HERE, "check-tree.mjs");

const MUTANTS = [
  { name: "excel-number-grammar", file: "index.mjs", find: "if (NUMBER.test(raw)) {", replace: "if (raw.trim() !== \"\" && !Number.isNaN(Number(raw))) {", target: "cp01" },
  { name: "unary-above-power", file: "parser.mjs", find: "      return { k: \"neg\", op, arg: unary() };", replace: "      const arg = postfix();\n      const neg = { k: \"neg\", op, arg };\n      if (isOp(\"^\")) { take(); return { k: \"bin\", op: \"^\", left: neg, right: unary() }; }\n      return neg;", target: "cp02" },
  { name: "blank-ref-is-null", file: "index.mjs", find: "const out = v === null ? 0 :", replace: "const out = v === null ? null :", target: "cp03" },
  { name: "leftmost-error-wins", file: "errors.mjs", find: "    if (best === null) { best = e; continue; }", replace: "    if (best === null) { best = e; continue; }\n    continue;", target: "cp04" },
  { name: "round-half-up", file: "decimal.mjs", find: "  return Number(lastKept) % 2 === 1;", replace: "  return true;", target: "cp05" },
  { name: "case-sensitive-text", file: "evaluate.mjs", find: "    const x = a.toLowerCase();\n    const y = b.toLowerCase();", replace: "    const x = a;\n    const y = b;", target: "cp06" },
  { name: "percent-below-power", file: "parser.mjs", find: "    if (isOp(\"^\")) { take(); return { k: \"bin\", op: \"^\", left: base, right: unary() }; }\n    return base;", replace: "    if (isOp(\"^\")) { take(); const r = { k: \"bin\", op: \"^\", left: base.k === \"pct\" ? base.arg : base, right: unary() }; return base.k === \"pct\" ? { k: \"pct\", arg: r } : r; }\n    return base;", target: "cp07" },
  { name: "no-tolerance", file: "evaluate.mjs", find: "  return Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b));", replace: "  return a === b;", target: "cp08" },
  // Block B. Excel-prior mutants first in each checkpoint, then plausible implementation slips.
  { name: "cycle-is-zero", file: "index.mjs", find: "else if (cycleSet().has(k)) v = makeError(\"#CYCLE!\", k, \"circular reference\");", replace: "else if (cycleSet().has(k)) v = 0;", target: "cp09" },
  { name: "cycle-below-ref", file: "errors.mjs", find: "[\"#CYCLE!\", \"#REF!\",", replace: "[\"#REF!\", \"#CYCLE!\",", target: "cp09" },
  { name: "precedents-skip-empty", file: "index.mjs", find: "      return sorted(opts.transitive ? reachable(k, edgesOf) : edgesOf(k));", replace: "      return sorted(opts.transitive ? reachable(k, edgesOf) : edgesOf(k).filter((x) => inputs.has(x)));", target: "cp10" },
  { name: "transitive-has-self", file: "index.mjs", find: "      return sorted(opts.transitive ? reachable(k, edgesOf) : edgesOf(k));", replace: "      return sorted(opts.transitive ? new Set([k, ...reachable(k, edgesOf)]) : edgesOf(k));", target: "cp10" },
  { name: "set-clears-all", file: "index.mjs", find: "      relink(k);\n      invalidate([k]);", replace: "      relink(k);\n      cache.clear();", target: "cp11" },
  { name: "same-input-marks", file: "index.mjs", find: "      if ((inputs.get(k) ?? \"\") === input) return;\n", replace: "", target: "cp11" },
  { name: "dfs-order", file: "index.mjs", find: "      const order = recalcOrder(dirty, edgesOf);", replace: "      const order = [];\n      const seen = new Set();\n      const visit = (k) => { if (seen.has(k) || !dirty.includes(k)) return; seen.add(k); for (const p of edgesOf(k)) visit(p); order.push(k); };\n      dirty.forEach(visit);", target: "cp12" },
  { name: "no-resort", file: "graph.mjs", find: "    ready.sort((x, y) => compareAddresses(comps[x][0], comps[y][0]));\n", replace: "", target: "cp12" },
  { name: "text-coerced", file: "functions.mjs", find: "    else if (!count) errors.push(makeError(\"#VALUE!\", ctx.cell, \"text argument\"));", replace: "    else if (!count) { const n = Number(v); if (v.trim() !== \"\" && !Number.isNaN(n)) nums.push(n); else errors.push(makeError(\"#VALUE!\", ctx.cell, \"text argument\")); }", target: "cp13" },
  { name: "single-ref-direct", file: "args.mjs", find: "const isRangeArg = (n) => n.k === \"ref\" || ", replace: "const isRangeArg = (n) => ", target: "cp13" },
  { name: "range-reads-first", file: "evaluate.mjs", find: "return isError(r) ? r : makeError(\"#VALUE!\", ctx.cell, \"range used outside a function\");", replace: "return isError(r) ? r : ctx.read(r[0]);", target: "cp13" },
  { name: "names-case-sensitive", file: "parser.mjs", find: "    if (NAME.test(w)) return { k: \"name\", v: up };", replace: "    if (NAME.test(w)) return { k: \"name\", v: w };", target: "cp14" },
  { name: "name-digits-allowed", file: "names.mjs", find: " && !/^[A-Za-z]+\\d+$/.test(name)", replace: "", target: "cp14" },
  { name: "one-cell-range-is-cell", file: "evaluate.mjs", find: "      if (n.range) return makeError(", replace: "      if (n.range && n.a !== n.b) return makeError(", target: "cp14" },
  { name: "minmax-empty-zero", file: "functions.mjs", find: "      if (!nums.length) return makeError(\"#VALUE!\", ctx.cell, `${fn} of no numbers`);", replace: "      if (!nums.length) return 0;", target: "cp15" },
  { name: "count-booleans", file: "functions.mjs", find: "    else if (typeof v === \"boolean\") { if (!count) nums.push(v ? 1 : 0); }", replace: "    else if (typeof v === \"boolean\") nums.push(v ? 1 : 0);", target: "cp15" },
  { name: "round-binary", file: "functions.mjs", find: "  return roundDecimal(x, digits === 0 ? 0 : digits, MODES[fn]);", replace: "  const f = Math.pow(10, digits);\n  const y = x * f;\n  const m = MODES[fn];\n  const r = m === \"down\" ? Math.trunc(y) : m === \"up\" ? (y < 0 ? Math.floor(y) : Math.ceil(y)) : Math.round(y);\n  return r / f || 0;", target: "cp16" },
  { name: "digits-rounded", file: "functions.mjs", find: "  const digits = Math.trunc(d);", replace: "  const digits = Math.round(d);", target: "cp16" },
  // Block C. Excel-prior mutants first in each checkpoint, then plausible implementation slips.
  { name: "if-text-true", file: "args.mjs", find: "  return makeError(\"#VALUE!\", cell, \"text used as a condition\");", replace: "  if (/^(TRUE|FALSE)$/i.test(v)) return /^TRUE$/i.test(v);\n  return makeError(\"#VALUE!\", cell, \"text used as a condition\");", target: "cp17" },
  { name: "and-short-circuit", file: "logic.mjs", find: "    else vals.push(b);", replace: "    else { vals.push(b); if (!b) break; }", target: "cp17" },
  { name: "if-eager", file: "logic.mjs", find: "    const taken = c ? args[1] : args[2];", replace: "    const all = args.slice(1).map((a) => evaluate(a, ctx));\n    const e = pickError(all);\n    if (e) return e;\n    const taken = c ? args[1] : args[2];", target: "cp17" },
  { name: "if-no-else-zero", file: "logic.mjs", find: "    return taken ? evaluate(taken, ctx) : false;", replace: "    return taken ? evaluate(taken, ctx) : 0;", target: "cp17" },
  { name: "and-empty-true", file: "logic.mjs", find: "    if (!vals.length) return makeError(\"#VALUE!\", ctx.cell, `${fn} of no values`);", replace: "    if (!vals.length) return fn === \"AND\";", target: "cp17" },
  { name: "trim-collapses", file: "text.mjs", find: "t.replace(/^ +| +$/g, \"\")", replace: "t.replace(/ +/g, \" \").replace(/^ | $/g, \"\")", target: "cp18" },
  { name: "text-raw-string", file: "args.mjs", find: "  return isError(v) ? v : displayValue(v);", replace: "  return isError(v) ? v : v === null ? \"\" : String(v);", target: "cp18" },
  { name: "mid-start-zero", file: "text.mjs", find: "    if (start < 1) return", replace: "    if (start < 0) return", target: "cp18" },
  { name: "right-zero-whole", file: "text.mjs", find: "n === 0 ? \"\" : t.slice(-n)", replace: "t.slice(-n)", target: "cp18" },
  { name: "date-rollover", file: "dates.mjs", find: "if (y < 2000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > daysIn(y, m)) return null;", replace: "if (y < 2000 || y > 9999) return null;", target: "cp19" },
  { name: "epoch-zero", file: "dates.mjs", find: "  return (Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS + 1;", replace: "  return (Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS;", target: "cp19" },
  { name: "serial-zero-ok", file: "dates.mjs", find: "if (s < 1 || s > MAX)", replace: "if (s < 0 || s > MAX)", target: "cp19" },
  { name: "iferror-catches-cycle", file: "logic.mjs", find: "if (isError(v) && v.code !== \"#CYCLE!\") return", replace: "if (isError(v)) return", target: "cp20" },
  { name: "iferror-eager", file: "logic.mjs", find: "    const v = evaluate(args[0], ctx);", replace: "    const v = evaluate(args[0], ctx);\n    const fb = evaluate(args[1], ctx);\n    if (isError(fb) && !isError(v)) return fb;", target: "cp20" },
  { name: "iserror-arity-true", file: "logic.mjs", find: "    return bad || isError(evaluate(args[0], ctx));", replace: "    return bad ? true : isError(evaluate(args[0], ctx));", target: "cp20" },
  { name: "na-lowest", file: "errors.mjs", find: "\"#NAME?\", \"#N/A\", \"#VALUE!\", \"#DIV/0!\"]", replace: "\"#NAME?\", \"#VALUE!\", \"#DIV/0!\", \"#N/A\"]", target: "cp21" },
  { name: "vlookup-col0-value", file: "lookup.mjs", find: "  if (col < 1 || col > g.width) return makeError(\"#REF!\", ctx.cell, \"VLOOKUP: column outside the range\");", replace: "  if (col < 1) return makeError(\"#VALUE!\", ctx.cell, \"VLOOKUP: column below 1\");\n  if (col > g.width) return makeError(\"#REF!\", ctx.cell, \"VLOOKUP: column outside the range\");", target: "cp21" },
  { name: "vlookup-loose-type", file: "lookup.mjs", find: "      if (v === null || isError(v) || !sameType(v, key)) continue;\n      if (compareValues(v, key) === 0)", replace: "      if (v === null || isError(v)) continue;\n      if (compareValues(v, key) === 0 || String(v).toLowerCase() === String(key).toLowerCase())", target: "cp21" },
  { name: "vlookup-last-match", file: "lookup.mjs", find: "    for (let r = 0; r < g.height; r++) {", replace: "    for (let r = g.height - 1; r >= 0; r--) {", target: "cp21" },
  { name: "vlookup-case-sensitive", file: "lookup.mjs", find: "      if (compareValues(v, key) === 0) return", replace: "      if (typeof v === \"string\" ? v === key : compareValues(v, key) === 0) return", target: "cp21" },
  { name: "vlookup-blank-matches", file: "lookup.mjs", edits: [["  if (key !== null) {", "  {"], ["      if (v === null || isError(v) || !sameType(v, key)) continue;", "      if (v === null && key === null) return ctx.read(g.keys[r * g.width + col - 1]);\n      if (v === null || isError(v) || !sameType(v, key)) continue;"]], target: "cp21" },
  { name: "sumif-text-matches-number", file: "lookup.mjs", find: "!isBlank(v) && sameType(v, operand) && compareValues(v, operand) === 0", replace: "!isBlank(v) && (sameType(v, operand) ? compareValues(v, operand) === 0 : typeof v !== \"boolean\" && typeof operand !== \"boolean\" && String(v).toLowerCase() === String(operand).toLowerCase())", target: "cp22" },
  { name: "sumif-resize", file: "lookup.mjs", find: "  if (s.width !== g.width || s.height !== g.height) return", replace: "  if (false) return", target: "cp22" },
  { name: "sumif-true-text", file: "lookup.mjs", find: "    operand = NUMBER.test(m[2]) ? Number(m[2]) : m[2];", replace: "    operand = NUMBER.test(m[2]) ? Number(m[2]) : /^true$/i.test(m[2]) ? true : /^false$/i.test(m[2]) ? false : m[2];", target: "cp22" },
  { name: "sumif-ne-skips-blank", file: "lookup.mjs", find: "    if (op === \"<>\") return !eq(v);", replace: "    if (op === \"<>\") return !isBlank(v) && !eq(v);", target: "cp22" },
  { name: "sumif-matched-error-ignored", file: "lookup.mjs", find: "    else if (isError(v)) errors.push(v);", replace: "", target: "cp22" },
  { name: "insert-expands-bottom-edge", file: "structure.mjs", find: "    const b = one(r2);", replace: "    const b = r2 === at - 1 ? r2 + count : one(r2);", target: "cp23" },
  { name: "insert-shift-after", file: "structure.mjs", find: "  const shift = (r) => (r >= at ? r + count : r);", replace: "  const shift = (r) => (r > at ? r + count : r);", target: "cp23" },
  { name: "insert-keeps-case", file: "refs.mjs", find: "      else if (moved(a, q)) edits.push([toks[i].s, toks[i].e, refText(q)]);", replace: "      else if (moved(a, q)) edits.push([toks[i].s, toks[i].e, toks[i].v.replace(/[0-9]+$/, String(q.row))]);", target: "cp23" },
  { name: "insert-no-full-check", file: "structure.mjs", find: "    if (p >= pos && p + count > max) {", replace: "    if (false) {", target: "cp23" },
  { name: "names-not-moved", file: "structure.mjs", find: "    const m = range(ax.get(a), ax.get(b));", replace: "    const m = [ax.get(a), ax.get(b)];", target: "cp23" },
  { name: "insert-clamps-row", file: "structure.mjs", find: "  const one = (r) => (shift(r) > max ? null : shift(r));", replace: "  const one = (r) => Math.min(shift(r), max);", target: "cp23" },
  { name: "partial-delete-ref", file: "structure.mjs", find: "    if (r1 >= at && r2 <= last) return null;", replace: "    if ((r1 >= at && r1 <= last) || (r2 >= at && r2 <= last)) return null;", target: "cp24" },
  { name: "delete-bottom-at", file: "structure.mjs", find: "    const b = r2 >= at && r2 <= last ? at - 1 : one(r2);", replace: "    const b = r2 >= at && r2 <= last ? at : one(r2);", target: "cp24" },
  { name: "delete-stale-cache", file: "index.mjs", find: "    for (const m of [parsed, cache, edges, rdeps, nameUsers]) m.clear();", replace: "    for (const m of [parsed, edges, rdeps, nameUsers]) m.clear();", target: "cp24" },
  { name: "delete-names-kept", file: "structure.mjs", find: "    if (m === null) continue;\n    nextNames.set", replace: "    if (m === null) { nextNames.set(n, d); continue; }\n    nextNames.set", target: "cp24" },
  { name: "delete-shift-by-one", file: "structure.mjs", find: "  const one = (r) => (r < at ? r : r > last ? r - count : null);", replace: "  const one = (r) => (r < at ? r : r > last ? r - 1 : null);", target: "cp24" },
  { name: "col-letters-upper-only", file: "structure.mjs", find: "/^[A-Za-z]{1,2}$/.test(at)", replace: "/^[A-Z]{1,2}$/.test(at)", target: "cp25" },
  { name: "col-accepts-number", file: "structure.mjs", find: "  if (axis === \"col\") pos = typeof at", replace: "  if (axis === \"col\") pos = typeof at === \"number\" ? at : typeof at", target: "cp25" },
  { name: "col-max-zy", file: "refs.mjs", find: "export const MAX_COL = 702;", replace: "export const MAX_COL = 701;", target: "cp25" },
  { name: "col-full-checks-row", file: "structure.mjs", find: "    const p = ax.get(parseRef(k));", replace: "    const p = parseRef(k).row;", target: "cp25" },
  { name: "dollar-parse-error", file: "parser.mjs", find: "const REFLIKE = /^\\$?([A-Za-z]+)\\$?(\\d+)$/;", replace: "const REFLIKE = /^([A-Za-z]+)(\\d+)$/;", target: "cp26" },
  { name: "copy-ignores-dollar", file: "copy.mjs", find: "row: p.absRow ? p.row : p.row + dr, col: p.absCol ? p.col : p.col + dc", replace: "row: p.row + dr, col: p.col + dc", target: "cp26" },
  { name: "copy-dollar-swapped", file: "copy.mjs", find: "row: p.absRow ? p.row : p.row + dr, col: p.absCol ? p.col : p.col + dc", replace: "row: p.absCol ? p.row : p.row + dr, col: p.absRow ? p.col : p.col + dc", target: "cp26" },
  { name: "copy-reads-own-writes", file: "copy.mjs", target: "cp26", edits: [
    ["  const writes = [];", "  const writes = [];\n  const seen = new Map();"],
    ["      const raw = inputs.get(colName(c) + r) ?? \"\";", "      const raw = seen.get(colName(c) + r) ?? inputs.get(colName(c) + r) ?? \"\";"],
    ["      writes.push([colName(c + dc) + (r + dr), out]);", "      writes.push([colName(c + dc) + (r + dr), out]);\n      seen.set(colName(c + dc) + (r + dr), out);"],
  ] },
  { name: "copy-skips-empty", file: "copy.mjs", find: "      const out = raw.startsWith", replace: "      if (raw === \"\") continue;\n      const out = raw.startsWith", target: "cp26" },
  { name: "copy-range-one-corner", file: "copy.mjs", find: "    return qx === null || qy === null ? null : [qx, qy];", replace: "    return qx === null && qy === null ? null : [qx || x, qy || y];", target: "cp26" },
  { name: "copy-no-col-edge", file: "copy.mjs", find: "if (r2 + dr > MAX_ROW || c2 + dc > MAX_COL)", replace: "if (r2 + dr > MAX_ROW)", target: "cp26" },
  { name: "copy-offset-typed-corner", file: "copy.mjs", find: "  const dr = t.row - r1;\n  const dc = t.col - c1;", replace: "  const dr = t.row - a.row;\n  const dc = t.col - a.col;", target: "cp26" },
  { name: "history-limit-99", file: "history.mjs", find: "      if (done.length > limit) done.shift();", replace: "      if (done.length >= limit) done.shift();", target: "cp27" },
  { name: "redo-kept-on-record", file: "history.mjs", find: "      undone.length = 0;\n", replace: "\n", target: "cp27" },
  { name: "redo-applies-before", file: "history.mjs", find: "      apply(e, \"after\");", replace: "      apply(e, \"before\");", target: "cp27" },
  { name: "noop-write-recorded", file: "index.mjs", find: "    if (diffs.length) history.record({ cells: diffs });", replace: "    history.record({ cells: diffs });", target: "cp27" },
  { name: "noop-structure-recorded", file: "index.mjs", find: "    if (!sameState(before, next)) history.record", replace: "    if (true) history.record", target: "cp27" },
  { name: "same-name-recorded", file: "index.mjs", find: "      if (before && JSON.stringify(before) === JSON.stringify(d)) return;\n", replace: "", target: "cp27" },
  { name: "removed-name-lost", file: "index.mjs", find: "      history.record({ name: n, before: names.get(n), after: undefined });", replace: "      history.record({ name: n, before: undefined, after: undefined });", target: "cp27" },
  { name: "copy-step-per-cell", file: "index.mjs", find: "      writeAll(copyWrites(inputs, from, to));", replace: "      for (const w of copyWrites(inputs, from, to)) writeAll([w]);", target: "cp27" },
  { name: "undo-cells-rebuilds", file: "index.mjs", find: "      for (const [k, before, after] of list) write(k, side === \"before\" ? before : after);", replace: "      for (const [k, before, after] of list) write(k, side === \"before\" ? before : after);\n      rebuild(snapshot(inputs, names));", target: "cp27" },
  { name: "csv-quote-comma-only", file: "csv.mjs", find: "const NEEDS_QUOTES = /[,\"\\r\\n]|^ | $/;", replace: "const NEEDS_QUOTES = /,/;", target: "cp28" },
  { name: "csv-no-space-quote", file: "csv.mjs", find: "const NEEDS_QUOTES = /[,\"\\r\\n]|^ | $/;", replace: "const NEEDS_QUOTES = /[,\"\\r\\n]/;", target: "cp28" },
  { name: "csv-trailing-newline", file: "csv.mjs", find: "  return lines.join(\"\\n\");", replace: "  return lines.length ? lines.join(\"\\n\") + \"\\n\" : \"\";", target: "cp28" },
  { name: "csv-crlf", file: "csv.mjs", find: "  return lines.join(\"\\n\");", replace: "  return lines.join(\"\\r\\n\");", target: "cp28" },
  { name: "csv-ragged-rows", file: "csv.mjs", find: "    for (let c = 1; c <= cols; c++) out.push(field(text(colName(c) + r)));\n    lines.push(out.join(\",\"));", replace: "    for (let c = 1; c <= cols; c++) out.push(field(text(colName(c) + r)));\n    while (out.length && out[out.length - 1] === \"\") out.pop();\n    lines.push(out.join(\",\"));", target: "cp28" },
  { name: "csv-empty-quoted", file: "csv.mjs", find: "const field = (s) => (NEEDS_QUOTES.test(s)", replace: "const field = (s) => (s === \"\" || NEEDS_QUOTES.test(s)", target: "cp28" },
  { name: "csv-formulas-evaluate", file: "index.mjs", find: "      const text = opts.formulas ? (k) => inputs.get(k) ?? \"\" : (k) => displayValue(valueOf(k));", replace: "      const text = opts.formulas ? (k) => { valueOf(k); return inputs.get(k) ?? \"\"; } : (k) => displayValue(valueOf(k));", target: "cp28" },
  { name: "csv-in-trailing-row", file: "csv.mjs", find: "    records.push(rec);\n    rec = [];\n    if (i >= n) return records;", replace: "    records.push(rec);\n    rec = [];\n    if (i >= n) { records.push([\"\"]); return records; }", target: "cp29" },
  { name: "csv-in-crlf-unknown", file: "csv.mjs", find: "    i += text[i] === \"\\r\" ? 2 : 1;", replace: "    i += 1;", target: "cp29" },
  { name: "csv-in-trims", file: "csv.mjs", find: "    rec.push(f);\n", replace: "    rec.push(text[i - 1] === '\"' ? f : f.trim());\n", target: "cp29" },
  { name: "csv-in-lenient-close", file: "csv.mjs", find: "        throw bad(records.length + 1, \"text after a closing quote\");", replace: "        while (i < n && text[i] !== \",\" && text[i] !== \"\\n\") f += text[i++];", target: "cp29" },
  { name: "csv-in-lenient-quote", file: "csv.mjs", find: "        if (text[i] === '\"') throw bad(records.length + 1, \"quote inside an unquoted field\");\n", replace: "", target: "cp29" },
  { name: "csv-in-line-count", file: "csv.mjs", find: "        f += text[i++];\n      }\n      if (i < n", replace: "        if (text[i] === \"\\n\") records.push([]);\n        f += text[i++];\n      }\n      if (i < n", target: "cp29" },
  { name: "csv-in-skip-empty", file: "index.mjs", find: "      writeAll(csvWrites(text, at));", replace: "      writeAll(csvWrites(text, at).filter(([, f]) => f !== \"\"));", target: "cp29" },
  { name: "csv-in-clear-row", file: "csv.mjs", find: "  records.forEach((r, i) => r.forEach((f, j) => writes.push([colName(t.col + j) + (t.row + i), f])));", replace: "  records.forEach((r, i) => { for (let j = 0; j < width; j++) writes.push([colName(t.col + j) + (t.row + i), r[j] ?? \"\"]); });", target: "cp29" },
  { name: "csv-in-edge-before-parse", file: "csv.mjs", find: "  const records = parseCSV(text);\n", replace: "  if (typeof text === \"string\" && t.row === MAX_ROW && text.includes(\"\\n\") && text.indexOf(\"\\n\") < text.length - 1) throw makeError(\"#FULL\", at, \"no room\");\n  const records = parseCSV(text);\n", target: "cp29" },
  { name: "csv-in-text-before-at", file: "csv.mjs", find: "  const t = parseAddress(at);\n  if (!t) throwAddr(at);\n  const records = parseCSV(text);\n", replace: "  const records = parseCSV(text);\n  const t = parseAddress(at);\n  if (!t) throwAddr(at);\n", target: "cp29" },
  { name: "csv-in-step-per-cell", file: "index.mjs", find: "      writeAll(csvWrites(text, at));", replace: "      for (const w of csvWrites(text, at)) writeAll([w]);", target: "cp29" },
  { name: "csv-in-partial-write", file: "csv.mjs", find: "  if (records.length && (t.row", replace: "  if (false && records.length && (t.row", target: "cp29" },
  { name: "save-insertion-order", file: "persist.mjs", find: "  for (const k of [...inputs.keys()].sort(compareAddresses)) cells[k]", replace: "  for (const k of [...inputs.keys()]) cells[k]", target: "cp30" },
  { name: "save-names-unsorted", file: "persist.mjs", find: "  for (const n of [...names.keys()].sort()) out[n]", replace: "  for (const n of [...names.keys()]) out[n]", target: "cp30" },
  { name: "save-one-cell-range-flat", file: "persist.mjs", find: "  for (const n of [...names.keys()].sort()) out[n] = nameText(names.get(n));", replace: "  for (const n of [...names.keys()].sort()) { const d = names.get(n); out[n] = d.a === d.b ? d.a : nameText(d); }", target: "cp30" },
  { name: "save-pretty", file: "persist.mjs", find: "cells, names: out });", replace: "cells, names: out }, null, 1);", target: "cp30" },
  { name: "save-evaluates", file: "index.mjs", find: "      return saveText(inputs, names);", replace: "      for (const k of inputs.keys()) valueOf(k);\n      return saveText(inputs, names);", target: "cp30" },
  { name: "load-keeps-history", file: "index.mjs", find: "  if (init) rebuild(init);", replace: "  if (init) restructure(init);", target: "cp30" },
  { name: "load-lenient-version", file: "persist.mjs", find: "  if (doc.version !== VERSION)", replace: "  if (doc.version != VERSION)", target: "cp30" },
  { name: "load-array-cells", file: "persist.mjs", find: "  if (!isPlain(doc.cells))", replace: "  if (doc.cells === null || typeof doc.cells !== \"object\")", target: "cp30" },
  { name: "load-lower-keys", file: "persist.mjs", find: "    if (normalise(k) !== k) throw", replace: "    if (normalise(k) === null) throw", target: "cp30" },
  { name: "load-empty-cell-ok", file: "persist.mjs", find: "    if (typeof v !== \"string\" || v === \"\") throw", replace: "    if (typeof v !== \"string\") throw", target: "cp30" },
  { name: "load-target-any-case", file: "persist.mjs", find: "    if (nameText(d) !== ref) throw", replace: "    if (nameText(d) !== ref.toUpperCase()) throw", target: "cp30" },
  { name: "load-names-before-cells", file: "persist.mjs", find: "  if (!isPlain(doc.cells)) throw bad(\"cells\", \"cells must be an object\");\n  if (!isPlain(doc.names)) throw bad(\"names\", \"names must be an object\");", replace: "  if (!isPlain(doc.names)) throw bad(\"names\", \"names must be an object\");\n  if (!isPlain(doc.cells)) throw bad(\"cells\", \"cells must be an object\");", target: "cp30" },
  { name: "col-names-not-moved", file: "structure.mjs", find: "    const m = range(ax.get(a), ax.get(b));", replace: "    const m = axis === \"col\" ? [ax.get(a), ax.get(b)] : range(ax.get(a), ax.get(b));", target: "cp25" },
];

const work = process.argv[process.argv.indexOf("--work") + 1];
if (!work || process.argv.indexOf("--work") === -1) throw new Error("need --work <empty dir>");
if (existsSync(work) && readdirSync(work).length) throw new Error(`--work ${work} is not empty`);

let ok = true;
for (const m of MUTANTS) {
  const dir = join(work, m.name);
  mkdirSync(dir, { recursive: true });
  cpSync(join(REF, "src"), join(dir, "src"), { recursive: true });
  const f = join(dir, "src", m.file);
  let text = readFileSync(f, "utf8");
  const edits = m.edits || [[m.find, m.replace]];
  const missing = edits.filter(([find]) => !text.includes(find));
  if (missing.length) { console.log(`${m.name}: DID NOT APPLY (find text missing)`); ok = false; continue; }
  for (const [find, replace] of edits) text = text.replace(find, replace);
  writeFileSync(f, text);
  const r = spawnSync(process.execPath, [CHECK, "--src", dir, "--out", join(work, `${m.name}-run`), "--kind", "hidden", "--json"], { encoding: "utf8" });
  const rows = JSON.parse(r.stdout.trim().split("\n").pop());
  const failing = rows.filter((x) => x.hidden && (x.hidden.failed.length || x.hidden.total === 0)).map((x) => x.cp);
  const hit = failing.includes(m.target);
  if (!hit) ok = false;
  const collateral = failing.filter((c) => c !== m.target);
  console.log(`${hit ? "KILLED " : "SURVIVED"} ${m.name.padEnd(22)} target ${m.target}${collateral.length ? `  also fails ${collateral.join(" ")}` : ""}`);
}
process.exitCode = ok ? 0 : 1;
