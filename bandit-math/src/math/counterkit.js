// The small shared kit for the store counter's other questions (src/math/counter.js and its makers: money.js, clock.js,
// decimals.js, percent.js, ratios.js): a seeded random source, the tools every maker draws its numbers with, the
// townsperson's pronouns, and how money, times, lengths of time and decimals are printed. Pure, no page.

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
// t: what a maker draws with. int(lo, hi) whole numbers lo..hi; pick(list); chance(p); shuffle(list) in place;
// near(frac, easy, hard): an easy choice early in a step (frac near 0) and a harder one late (frac near 1)
export function tools(rand = Math.random) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const chance = (p) => rand() < p;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return { rand, int, pick, chance, shuffle };
}
// she / he for a townsperson ({ name, she })
export const pro = (f) => (f && f.she ? { they: 'she', them: 'her', their: 'her', They: 'She', does: 'does she', has: 'she has', is: 'she is' }
  : { they: 'he', them: 'him', their: 'his', They: 'He', does: 'does he', has: 'he has', is: 'he is' });
// a count with its unit: u(1, ['pound', 'pounds']) -> '1 pound'
export const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;

// ---- money, kept in whole cents (no rounding slips) -------------------------------------------------------------
// cents(35) -> '35¢' (under a dollar), '$1.35' from a dollar on; usd(500) -> '$5.00' always in dollars
export const usd = (c) => `${c < 0 ? '−' : ''}$${Math.floor(Math.abs(c) / 100)}.${String(Math.abs(c) % 100).padStart(2, '0')}`;
export const cents = (c) => (Math.abs(c) < 100 ? `${c}¢` : usd(c));
// a money coin's face: the big number and the word under it
export const cashFace = (c, { dollars = false } = {}) => (!dollars && c < 100
  ? { v: c, big: `${c}¢`, small: c === 1 ? 'cent' : 'cents', label: `${c}¢` }
  : { v: c, big: usd(c), small: '', label: usd(c) });

// ---- clock times and lengths of time -------------------------------------------------------------------------------
// a time is minutes from midnight (0..1439), or more for a later day. clock(h, m) -> '4:30'; ampm(mins) -> '4:30 pm'
export const pad2 = (n) => String(n).padStart(2, '0');
export const clock = (h, m) => `${h}:${pad2(m)}`;
export const hour12 = (mins) => { const h = Math.floor(((mins % 1440) + 1440) % 1440 / 60) % 12; return h === 0 ? 12 : h; };
export const ampm = (mins) => { const d = ((mins % 1440) + 1440) % 1440; return `${clock(hour12(d), d % 60)} ${d < 720 ? 'am' : 'pm'}`; };
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// the words for a length of time: dur(150) -> '2 h 30 min', dur(120) -> '2 hours', dur(45) -> '45 min'
export function dur(min, { long = false } = {}) {
  const h = Math.floor(min / 60), m = min % 60;
  if (!m) return long ? u(h, ['hour', 'hours']) : `${h} ${h === 1 ? 'hour' : 'hours'}`;
  if (!h) return `${m} min`;
  return `${h} h ${m} min`;
}
// the way a time is said: '4:30' -> 'half past 4', '7:45' -> 'quarter to 8', '3:00' -> '3 o'clock'
export function saidAs(h, m) {
  const next = h === 12 ? 1 : h + 1;
  if (m === 0) return `${h} o'clock`;
  if (m === 15) return `quarter past ${h}`;
  if (m === 30) return `half past ${h}`;
  if (m === 45) return `quarter to ${next}`;
  if (m < 30) return `${m} past ${h}`;
  return `${60 - m} to ${next}`;
}

// ---- decimals, kept as whole numbers of hundredths (or thousandths) -------------------------------------------------
// dec(45, 2) -> '0.45'; dec(5, 1) -> '0.5'; dec(250, 2) -> '2.50'; dec(250, 2, { trim: true }) -> '2.5'
export function dec(n, places, { trim = false } = {}) {
  const neg = n < 0, a = Math.abs(n), p = 10 ** places;
  let s = places ? `${Math.floor(a / p)}.${String(a % p).padStart(places, '0')}` : String(a);
  if (trim && places) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return (neg ? '−' : '') + s;
}
// a decimal string's value in hundredths (for comparing coins: '0.5' and '0.50' are the same coin)
export const hundredths = (s) => Math.round(Number(String(s).replace('−', '-').replace(/[^0-9.\-]/g, '')) * 100);
