// kit.js: small shared helpers for the ladders' example makers (src/levels/place/*.js): a seeded random source, whole
// numbers in a range, picking and shuffling, the real minus sign, and fractions written the way the game writes them.
// Pure; no page.

export const MINUS = '−';   // the real minus sign (U+2212), everywhere a number is shown
export const TIMES = '×';
export const DIVIDE = '÷';

// A seeded random source (mulberry32): rand() -> 0..1, the same seed giving the same numbers.
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// A random seed for a fresh source.
export const anySeed = () => (Math.random() * 2 ** 32) >>> 0;
export const int = (lo, hi, rand) => (hi < lo ? lo : lo + Math.floor(rand() * (hi - lo + 1)));
export const pick = (list, rand) => list[Math.floor(rand() * list.length)];
export function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// A number as the game shows it: the real minus sign, thousands with commas.
export const numText = (n) => (n < 0 ? MINUS : '') + Math.abs(n).toLocaleString('en-US');

// Fractions, kept as [top, bottom] in lowest terms.
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
export function frac(top, bottom) {
  if (bottom < 0) { top = -top; bottom = -bottom; }
  const g = gcd(top, bottom);
  return [top / g, bottom / g];
}
// 5/4 -> "1 1/4", 3/4 -> "3/4", 2/1 -> "2", -3/2 -> "−1 1/2"
export function fracText([top, bottom]) {
  const neg = top < 0, t = Math.abs(top);
  const whole = Math.floor(t / bottom), rest = t % bottom;
  const s = rest === 0 ? String(whole) : whole ? `${whole} ${rest}/${bottom}` : `${rest}/${bottom}`;
  return (neg && (whole || rest) ? MINUS : '') + s;
}
// a decimal with no float dust: dec(1.5000000002) -> "1.5"
export const decText = (v, places = 2) => { const s = (Math.round(v * 10 ** places) / 10 ** places).toFixed(places).replace(/\.?0+$/, ''); return v < 0 ? MINUS + s.slice(1) : s; };
