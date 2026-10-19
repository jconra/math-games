// FRACTIONS, kept exact: { n, d } is n over d (the top number, the numerator, over the bottom number, the
// denominator). Nothing here goes through decimals, so 2/3 stays 2/3 and a comparison is never off by a rounding.
// A MEASURE is a fraction with a unit and the way it is written: { n, d, unit: 'ft' | 'in' | 'lb', form }
//   form 'mixed'  a whole number and a fraction ("1 1/4") when it is more than one, the usual way
//   form 'frac'   a fraction even when it is more than one ("5/4"): an improper fraction, on purpose
// Words follow the game's rule: units spelled out in sentences ("3/4 of a foot", "7 1/2 inches", "1 1/2 pounds"),
// short on labels and buttons ("3/4 ft", "7 1/2 in.", "1 1/2 lb"). Pure functions: node tests load this file.

export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
export const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
export const fr = (n, d = 1) => (d < 0 ? { n: -n, d: -d } : { n, d });
// the same amount with the smallest numbers (6/8 -> 3/4)
export const simplest = (f) => { const g = gcd(f.n, f.d); return { n: f.n / g, d: f.d / g }; };
export const value = (f) => f.n / f.d;
// -1 when a is less, 0 when they are the same amount, 1 when a is more
export const compare = (a, b) => Math.sign(a.n * b.d - b.n * a.d);
export const same = (a, b) => compare(a, b) === 0;
export const plus = (a, b) => simplest({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
export const minus = (a, b) => simplest({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
export const times = (a, k) => simplest({ n: a.n * (k.n ?? k), d: a.d * (k.d ?? 1) });
// the fraction written over a new bottom number (one it divides into): over(3/4, 8) -> 6/8
export const over = (f, d) => ({ n: f.n * (d / f.d), d });
export const isWhole = (f) => f.n % f.d === 0;
export const isSimplest = (f) => gcd(f.n, f.d) === 1;

// the fraction as text: "3/4", "1 1/4" (mixed), "5/4" (form 'frac'), "2"
export function fracText(f, form = 'mixed') {
  if (f.d === 1) return String(f.n);
  if (form === 'mixed' && f.n > f.d) {
    const w = Math.floor(f.n / f.d), r = f.n % f.d;
    return r ? `${w} ${r}/${f.d}` : String(w);
  }
  return `${f.n}/${f.d}`;
}
// read "3/4", "1 1/4", "5/4" or "2" back (tests and the page's buttons)
export function parseFrac(text) {
  const m = String(text).trim().match(/^(?:(\d+) )?(\d+)\/(\d+)$|^(\d+)$/);
  if (!m) return null;
  if (m[4]) return fr(+m[4], 1);
  return fr((m[1] ? +m[1] * +m[3] : 0) + +m[2], +m[3]);
}

// ── measures ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const M = (n, d, unit, form = 'mixed') => ({ n, d, unit, form });
// a measure from a fraction (written in its simplest form unless told)
export const measure = (f, unit, form = 'mixed') => ({ n: f.n, d: f.d, unit, form });
const SHORT = { ft: 'ft', in: 'in.', lb: 'lb' };
const ONE = { ft: 'foot', in: 'inch', lb: 'pound' }, MANY = { ft: 'feet', in: 'inches', lb: 'pounds' }, PART = { ft: 'a foot', in: 'an inch', lb: 'a pound' };
// on a label or a button: "3/4 ft", "7 1/2 in.", "1 lb"
export const label = (m) => `${fracText(m, m.form)} ${SHORT[m.unit]}`;
// in a sentence: "3/4 of a foot", "1 foot", "1 1/4 feet", "5/4 feet", "9 inches", "1/2 of a pound"
export function words(m) {
  const t = fracText(m, m.form);
  if (!t.includes('/')) return `${t} ${t === '1' ? ONE[m.unit] : MANY[m.unit]}`;
  if (m.n < m.d) return `${t} of ${PART[m.unit]}`;
  return `${t} ${MANY[m.unit]}`;
}
// a length in inches (a fraction), whatever it was written in
export const inches = (m) => (m.unit === 'ft' ? simplest({ n: m.n * 12, d: m.d }) : simplest({ n: m.n, d: m.d }));
// in feet
export const feet = (m) => (m.unit === 'in' ? simplest({ n: m.n, d: m.d * 12 }) : simplest({ n: m.n, d: m.d }));
// compare two measures of the same kind (a length in feet against one in inches works too)
export const compareM = (a, b) => (a.unit === 'lb' || b.unit === 'lb' ? compare(a, b) : compare(inches(a), inches(b)));
// a fraction's bottom number said as a word, for "a ruler marked in eighths"
export const PARTS = { 2: 'halves', 3: 'thirds', 4: 'quarters', 5: 'fifths', 6: 'sixths', 8: 'eighths', 10: 'tenths', 12: 'twelfths', 16: 'sixteenths', 24: 'twenty-fourths' };
export const partsWord = (d) => PARTS[d] || `${d}ths`;
