// index.mjs: the sheet object and public API (cp01-cp08).
import { normalise, compareAddresses } from "./address.mjs";
import { makeError, throwAddr } from "./errors.mjs";
import { parseFormula, ParseError } from "./parser.mjs";
import { evaluate } from "./evaluate.mjs";
import { displayValue } from "./display.mjs";

const NUMBER = /^-?\d+(\.\d+)?$/;

export function createSheet() {
  const inputs = new Map(); // key -> raw string
  const parsed = new Map(); // key -> { ast } | { parseError }
  const cache = new Map(); // key -> value
  const stats = { evaluations: 0 };

  function key(address) {
    const k = normalise(address);
    if (!k) throwAddr(address);
    return k;
  }

  function valueOf(k) {
    const raw = inputs.get(k);
    if (raw === undefined) return null;
    if (!raw.startsWith("=")) {
      if (NUMBER.test(raw)) {
        const n = Number(raw);
        return n === 0 ? 0 : n;
      }
      return raw;
    }
    if (cache.has(k)) return cache.get(k);
    stats.evaluations++;
    const p = parsed.get(k);
    const v = p.parseError
      ? makeError("#PARSE!", k, p.parseError)
      : evaluate(p.ast, { cell: k, read: (a) => valueOf(a) });
    const out = v === null ? 0 : typeof v === "number" && v === 0 ? 0 : v;
    cache.set(k, out);
    return out;
  }

  return {
    set(address, input) {
      const k = key(address);
      cache.clear();
      if (input === "") {
        inputs.delete(k);
        parsed.delete(k);
        return;
      }
      inputs.set(k, input);
      if (input.startsWith("=")) {
        try {
          parsed.set(k, { ast: parseFormula(input.slice(1)) });
        } catch (e) {
          if (!(e instanceof ParseError)) throw e;
          parsed.set(k, { parseError: e.message });
        }
      } else {
        parsed.delete(k);
      }
    },
    get(address) {
      return valueOf(key(address));
    },
    getInput(address) {
      const raw = inputs.get(key(address));
      return raw === undefined ? null : raw;
    },
    display(address) {
      return displayValue(valueOf(key(address)));
    },
    cells() {
      return [...inputs.keys()].sort(compareAddresses);
    },
    stats() {
      return { evaluations: stats.evaluations };
    },
  };
}
