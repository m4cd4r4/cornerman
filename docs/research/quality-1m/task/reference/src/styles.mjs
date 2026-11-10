// styles.mjs: cell styles (cp79): bold, italic, text colour and fill colour, a cell layer like the
// number formats of cp41. setStyle merges into a cell's style; copy, fills and book.copy paste each
// source cell's whole style; sort leaves styles where they are. Not saved.
import { parseTarget } from "./layers.mjs";
import { makeError } from "./errors.mjs";
import { copyWrites } from "./copy.mjs";

const KEYS = ["bold", "italic", "color", "fill"];
const HEX = /^#[0-9A-Fa-f]{6}$/;

// The changes a style argument asks for, { key: value | null }, or null to remove every key. #ARG.
function checkStyle(style) {
  if (style === null) return null;
  if (typeof style !== "object" || Array.isArray(style)) throw makeError("#ARG", String(style), "a style is an object or null");
  const out = {};
  for (const [k, v] of Object.entries(style)) {
    const flag = (k === "bold" || k === "italic") && (v === null || typeof v === "boolean");
    const colour = (k === "color" || k === "fill") && (v === null || (typeof v === "string" && HEX.test(v)));
    if (!flag && !colour) throw makeError("#ARG", k, `not a style value: ${k}`);
    out[k] = typeof v === "string" ? v.toUpperCase() : v;
  }
  return out;
}

// before with the changes applied, keys in KEYS order; undefined when no key is left.
function merged(before, changes) {
  if (changes === null) return undefined;
  const all = { ...(before || {}), ...changes };
  const out = {};
  for (const k of KEYS) if (all[k] !== undefined && all[k] !== null) out[k] = all[k];
  return Object.keys(out).length ? out : undefined;
}

export function addStyles(sheet, core) {
  const { layers, history } = core;
  const copy = sheet.copy;
  Object.assign(sheet, {
    // One undo step for the whole target, none when nothing changes.
    setStyle(target, style) {
      const t = parseTarget(target);
      const changes = checkStyle(style);
      history.record(layers.write("styles", t.keys.map((k) => [k, merged(layers.L.styles.get(k), changes)])));
    },
    getStyle(address) {
      const s = layers.L.styles.get(core.key(address));
      return s ? { ...s } : null;
    },
    // cp26's copy, then each target cell takes its source cell's whole style: one undo step.
    copy(from, to) {
      history.group(() => {
        copy(from, to);
        const w = copyWrites({ get: core.input }, from, to);
        history.record(layers.write("styles", w.map(([k, , s]) => [k, layers.L.styles.get(s)])));
      });
    },
  });
  return sheet;
}
