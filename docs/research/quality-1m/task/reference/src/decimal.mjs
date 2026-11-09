// decimal.mjs: decimal-digit rounding on a number's shortest form (cp05, cp16).

// Plain decimal digits of a non-negative number's shortest form, no exponent.
export function plainDecimal(x) {
  const s = String(x);
  const m = /^(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(s);
  if (!m) return s;
  const digits = m[1] + (m[2] || "");
  const point = m[1].length + Number(m[3]);
  if (point <= 0) return "0." + "0".repeat(-point) + digits;
  if (point >= digits.length) return digits + "0".repeat(point - digits.length);
  return digits.slice(0, point) + "." + digits.slice(point);
}

export function incrementDigits(s) {
  const a = s.split("");
  let i = a.length - 1;
  while (i >= 0) {
    if (a[i] === "9") { a[i] = "0"; i--; continue; }
    a[i] = String(Number(a[i]) + 1);
    return a.join("");
  }
  return "1" + a.join("");
}

// Should the kept digits go up? mode: "even" (half to even), "up" (away from zero), "down".
function goesUp(mode, lastKept, rest) {
  if (mode === "down") return false;
  if (mode === "up") return /[1-9]/.test(rest);
  const next = rest[0] || "0";
  const after = rest.slice(1);
  if (next > "5") return true;
  if (next < "5") return false;
  if (/[1-9]/.test(after)) return true;
  return Number(lastKept) % 2 === 1;
}

// Digits of |x| rounded to `digits` decimal places (negative = tens, hundreds, ...), as plain
// decimal text without trailing fraction zeros. Decides on the shortest decimal form.
export function roundText(x, digits, mode) {
  const [intPart, frac = ""] = plainDecimal(Math.abs(x)).split(".");
  let out;
  if (digits >= 0) {
    if (frac.length <= digits) out = frac ? `${intPart}.${frac}` : intPart;
    else {
      let kept = intPart + frac.slice(0, digits);
      if (goesUp(mode, kept[kept.length - 1], frac.slice(digits))) kept = incrementDigits(kept);
      const cut = kept.length - digits;
      out = digits ? `${kept.slice(0, cut)}.${kept.slice(cut)}` : kept;
    }
  } else {
    const k = -digits;
    const p = intPart.padStart(k + 1, "0");
    let kept = p.slice(0, p.length - k);
    if (goesUp(mode, kept[kept.length - 1], p.slice(p.length - k) + frac)) kept = incrementDigits(kept);
    out = kept + "0".repeat(k);
  }
  if (out.includes(".")) out = out.replace(/0+$/, "").replace(/\.$/, "");
  out = out.replace(/^0+(?=\d)/, "");
  return out;
}

// Signed number result of roundText; never -0.
export function roundDecimal(x, digits, mode) {
  const n = Number(roundText(x, digits, mode));
  if (n === 0) return 0;
  return x < 0 ? -n : n;
}
