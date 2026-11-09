// validation.mjs: data validation rules (cp46): whole numbers in a range, or a list of texts.
import { makeError } from "./errors.mjs";

const NUMBER = /^-?\d+(\.\d+)?$/;
const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const LIST_LIMIT = 50;

// The stored copy of a setValidation rule (other keys dropped); null clears. Throws #RULE.
export function checkRule(rule, target) {
  if (rule === null) return undefined;
  const bad = () => { throw makeError("#RULE", String(target), "not a validation rule"); };
  if (!isPlain(rule)) bad();
  if (rule.type === "whole") {
    if (!Number.isInteger(rule.min) || !Number.isInteger(rule.max) || rule.min > rule.max) bad();
    return { type: "whole", min: rule.min, max: rule.max };
  }
  if (rule.type === "list") {
    const ok = Array.isArray(rule.items) && rule.items.length >= 1 && rule.items.length <= LIST_LIMIT;
    if (!ok || !rule.items.every((x) => typeof x === "string" && x !== "")) bad();
    return { type: "list", items: [...rule.items] };
  }
  return bad();
}

export const copyRule = (r) => (r.type === "list" ? { type: "list", items: [...r.items] } : { ...r });

// Whether an input may be typed into a cell with this rule. Empty input and formulas always may.
export function passes(rule, input) {
  if (input === "" || input.startsWith("=")) return true;
  if (rule.type === "list") return rule.items.includes(input);
  if (!NUMBER.test(input)) return false;
  const n = Number(input);
  return Number.isInteger(n) && n >= rule.min && n <= rule.max;
}
