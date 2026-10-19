// THE MATH AT THE DOCK. Every fish that comes up asks one question, and the ladder below says which kind:
//   keep    the keeper limit: is the fish shorter than it (throw it back), the same, or longer (keep it)?
//   order   your new fish and two from your creel: which line-up runs longest to shortest?
//   add     your new fish's weight and one from the creel: how much together?
//   same    the same length written with other numbers (a finer ruler, or the simplest form)
//   cook    a ratio: "3 trout for every 2 bass, 10 fish in all: how many trout?"
//   bait    a rate: "12 worms for 4 fish: how many for 7?"
//   rule    "keep 1 in every 4": how many to keep, or how many were caught
//   part    a ratio as a fraction: "3 trout for every 2 bass: what fraction are trout?"
// THE LADDER (LADDER_TOP steps), easy to hard:
//   1  halves and quarters of a foot, with the ruler in the question     2  eighths
//   3  line them up, add weights with the same bottom number             4  the same length, other numbers (equivalents)
//   5  different bottom numbers (unlike denominators)                     6  mixed numbers, improper fractions, inches
//   7  ratios                                                             8  a mix of 3 to 7
// A fresh angler starts on step 1, PLACING: each right answer climbs a step straight away until the second miss (the
// first slip is forgiven), so an older kid gets to their level in a few fish. After that, CLEAN_TO_CLIMB right in a row
// climbs a step and a wrong answer drops one (never below 1). Kept in localStorage by the page (LADDER_KEY).
// Every question: tap-to-answer `choices` (keys) with `labels` (the buttons), one right `answer`, wrong ones made from
// the real slips (the bigger bottom number taken as bigger, tops and bottoms added, the carried whole dropped, a ratio's
// parts swapped), `why` (said after an answer), `helper` (the picture shown after a wrong one: a ruler, fraction bars,
// a weight bar, a ratio table), `svg` (a picture shown with the question, step 1 only), and a lesson for "Teach me":
// `rule` (the idea in one sentence), `steps` (this question worked through), `lessonPic` (the picture with the answer).
// `action` is what happens to the fish after: 'keep' or 'throw'. `key` names the question's numbers, so the page can
// avoid asking the same one twice in a while (ladderQuestion's `recent`). Pure: no page, no three.js (node tests).
import { fr, gcd, lcm, simplest, value, compare, same, plus, over, fracText, parseFrac, M, measure, label, words, inches, feet, compareM, partsWord, isSimplest } from './frac.js';
import { rulerPic, barsPic, weighPic, tablePic, groupsPic, GREEN, RED } from './pics.js';

export const LADDER_TOP = 8;
// three right in a row to climb: with one wrong dropping a step, a kid settles where they get about 4 in 5 right (the
// times tables were set to settle near 80% right too). The windmill lab climbs on two.
export const CLEAN_TO_CLIMB = 3;
// while placing, the second miss ends the fast climb (one step down from there)
export const PLACING_SLIPS = 2;
export const LADDER_KEY = 'bandit-math.fishing.ladder';
export const RECENT = 10;            // how many recent questions' numbers to steer clear of
export const STEP_NAMES = {
  1: 'Halves and quarters on a ruler', 2: 'Eighths', 3: 'Line them up, add the weights', 4: 'Same length, other numbers',
  5: 'Different bottom numbers', 6: 'Mixed numbers and inches', 7: 'Ratios', 8: 'A mix of everything',
};

// ── the fish ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// min..max: lengths it comes in (feet); small: under this it's a little one, trophy: this long or more (the fish book);
// k: pounds for a fish 1 foot long (weight grows with length × length × length)
export const KINDS = {
  perch: { one: 'perch', name: 'yellow perch', min: fr(1, 4), max: fr(5, 4), small: fr(1, 2), trophy: fr(1), k: 0.6, colour: '#d2a93a' },
  trout: { one: 'trout', name: 'brook trout', min: fr(1, 3), max: fr(2), small: fr(2, 3), trophy: fr(3, 2), k: 0.55, colour: '#7d8a4e' },
  bass: { one: 'bass', name: 'largemouth bass', min: fr(1, 2), max: fr(2), small: fr(3, 4), trophy: fr(3, 2), k: 0.9, colour: '#5f7d3a' },
  catfish: { one: 'catfish', name: 'channel catfish', min: fr(3, 4), max: fr(3), small: fr(1), trophy: fr(2), k: 0.7, colour: '#7a7268' },
};
export const KIND_LIST = ['perch', 'trout', 'bass', 'catfish'];
export const SIZES = ['small', 'keeper', 'trophy'];

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];
const shuffle = (arr, rnd) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const wpick = (pairs, rnd) => { const t = pairs.reduce((s, p) => s + p[1], 0); let r = rnd() * t; for (const p of pairs) { r -= p[1]; if (r < 0) return p[0]; } return pairs[pairs.length - 1][0]; };
const int = (a, b, rnd) => a + Math.floor(rnd() * (b - a + 1));
const inRange = (kind, ft) => value(ft) >= value(KINDS[kind].min) - 1e-9 && value(ft) <= value(KINDS[kind].max) + 1e-9;
const ft = (f, form = 'mixed') => measure(f, 'ft', form);
const T = (f, form = 'mixed') => fracText(f, form);

// a kind of fish that comes this long (feet), the kinds caught least so far more likely
export function kindFor(lenFt, rnd = Math.random, counts = {}) {
  let c = KIND_LIST.filter((k) => inRange(k, lenFt));
  if (!c.length) c = [value(lenFt) < 0.5 ? 'perch' : 'catfish'];
  return wpick(c.map((k) => [k, 1 / (1 + (counts[k] || 0))]), rnd);
}
// about what a fish of this kind and length weighs: to the nearest eighth of a pound, at least an eighth
export function weightFor(kind, lenFt) {
  const L = value(lenFt), w = KINDS[kind].k * L * L * L;
  return measure(simplest(fr(Math.max(1, Math.round(w * 8)), 8)), 'lb');
}
// 'small' | 'keeper' | 'trophy' for its kind
export function sizeOf(fish) {
  const K = KINDS[fish.kind], L = feet(fish.len);
  return compare(L, K.small) < 0 ? 'small' : compare(L, K.trophy) >= 0 ? 'trophy' : 'keeper';
}
const fishOf = (kind, len, lb = null) => ({ kind, len, lb: lb || weightFor(kind, feet(len)) });
// a keeper of some kind for questions that don't ask about its length: a quarter-foot length within its range
function anyKeeper(rnd, counts) {
  const kind = wpick(KIND_LIST.map((k) => [k, 1 / (1 + (counts[k] || 0))]), rnd), K = KINDS[kind];
  const lo = Math.ceil(value(K.small) * 4), hi = Math.floor(value(K.max) * 4);
  return fishOf(kind, ft(simplest(fr(int(lo, hi, rnd), 4))));
}

// ── comparing two lengths, worked out in words ───────────────────────────────────────────────────────────────────────
const MORE = { '-1': 'less than', 0: 'the same as', 1: 'more than' };
// a and b: measures (a the fish, b the limit or another fish). -> { c (-1, 0, 1), lines: [the working, a line each] }
export function compareWork(a, b) {
  const lines = [];
  // feet against inches: the feet into inches first
  if (a.unit !== b.unit) {
    const f = a.unit === 'ft' ? a : b, inch = measure(inches(f), 'in');
    lines.push(`A foot is 12 inches, so ${words(f)} is 12 × ${T(f, 'frac')} = ${T(inches(f))} inches.`);
    if (a.unit === 'ft') a = inch; else b = inch;
  }
  const c = compareM(a, b), unit = a.unit === 'in' ? 'inches' : a.unit === 'lb' ? 'pounds' : 'feet';
  const wa = Math.floor(value(a)), wb = Math.floor(value(b));
  const ta = T(a, a.form), tb = T(b, b.form);
  if (wa !== wb && wa >= 1 && wb >= 1 && a.form === 'mixed' && b.form === 'mixed') {
    lines.push(`${ta} has ${wa} whole ${unit} and ${tb} has ${wb}, so ${ta} is ${MORE[Math.sign(wa - wb)]} ${tb}.`);
    return { c, lines };
  }
  if (wa === wb && wa >= 1 && a.form === 'mixed' && b.form === 'mixed' && a.n % a.d && b.n % b.d) {
    // the same whole number: compare the parts
    const pa = fr(a.n - wa * a.d, a.d), pb = fr(b.n - wb * b.d, b.d), D = lcm(pa.d, pb.d);
    const conv = (p) => (p.d === D ? `${T(p)}` : `${T(p)} = ${T(over(p, D), 'frac')}`);
    lines.push(`Both have ${wa} whole ${unit}. Compare the parts: ${pa.d === pb.d ? `both are in ${partsWord(D)}` : `in ${partsWord(D)}, ${conv(pa)} and ${conv(pb)}`}.`);
    lines.push(`${over(pa, D).n} is ${MORE[Math.sign(over(pa, D).n - over(pb, D).n)]} ${over(pb, D).n}, so ${ta} is ${MORE[c]} ${tb}.`);
    return { c, lines };
  }
  // a mixed number set against a fraction: written as a fraction first
  const asFrac = (m) => fr(m.n, m.d);
  const A = asFrac(a), B = asFrac(b);
  const mixedNote = (m) => (m.form === 'mixed' && m.n > m.d && m.n % m.d ? `${T(m)} = ${T(m, 'frac')} (${Math.floor(m.n / m.d)} whole is ${Math.floor(m.n / m.d) * m.d}/${m.d})` : null);
  const notes = [mixedNote(a), mixedNote(b)].filter(Boolean);
  if (notes.length) lines.push(`As fractions: ${notes.join(', and ')}.`);
  if (A.d === B.d) {
    if (A.n === B.n && T(a, a.form) === T(b, b.form)) { lines.push(`Both are ${T(A, 'frac')}${a.unit === 'in' ? (T(A, 'frac') === '1' ? ' inch' : ' inches') : ''}: the same length.`); return { c, lines }; }
    lines.push(`Both are in ${partsWord(A.d)}: ${A.n} of them against ${B.n}. ${A.n} is ${MORE[Math.sign(A.n - B.n)]} ${B.n}.`);
    return { c, lines };
  }
  const D = lcm(A.d, B.d), oa = over(A, D), ob = over(B, D);
  const conv = (x, o) => (x.d === D ? `${T(x, 'frac')} is already in ${partsWord(D)}` : `${T(x, 'frac')} = ${T(o, 'frac')}`);
  lines.push(`Give them the same bottom number (denominator), ${D}: ${conv(A, oa)}, and ${conv(B, ob)}.`);
  lines.push(`${oa.n} is ${MORE[Math.sign(oa.n - ob.n)]} ${ob.n}, so ${ta} is ${MORE[c]} ${tb}.`);
  return { c, lines };
}

// ── KEEP OR THROW BACK ───────────────────────────────────────────────────────────────────────────────────────────────
const KEEP_CHOICES = ['shorter', 'same', 'longer'];
const KEEP_LABELS = { shorter: 'Shorter: throw it back', same: 'The same: keep it', longer: 'Longer: keep it' };
const VERDICT = {
  shorter: 'So it is shorter than the limit: throw it back.',
  same: 'So it is just the limit: keep it.',
  longer: 'So it is longer than the limit: keep it.',
};
const verdictOf = (c) => (c < 0 ? 'shorter' : c === 0 ? 'same' : 'longer');
const simplestList = (dens, max = 1) => { const out = []; for (const d of dens) for (let n = 1; n <= d * max; n++) if (gcd(n, d) === 1) out.push(fr(n, d)); return out; };

// the fish's length and the limit for a step. -> { fish: measure, limit: measure, how }
function keepPair(level, rnd) {
  if (level <= 1) {
    const limit = pick([fr(1, 4), fr(1, 2), fr(3, 4)], rnd);
    const fish = rnd() < 0.15 ? limit : pick([fr(1, 4), fr(1, 2), fr(3, 4), fr(1)].filter((f) => !same(f, limit)), rnd);
    return { fish: ft(fish), limit: ft(limit), how: 'ruler' };
  }
  if (level === 2) {
    if (rnd() < 0.15) { const limit = pick([fr(1, 2), fr(1, 4), fr(3, 4)], rnd); return { fish: ft(over(limit, 8), 'frac'), limit: ft(limit), how: 'ruler' }; }
    const pool = simplestList([2, 4, 8]).filter((f) => value(f) <= 1 && value(f) >= 0.25);
    for (;;) {
      const a = pick(pool, rnd), b = pick(pool, rnd);
      if (same(a, b) || Math.abs(value(a) - value(b)) > 3 / 8 + 1e-9) continue;
      if (a.d !== 8 && b.d !== 8) continue;              // (one of them in eighths: the step's new idea)
      if (value(b) >= 1) continue;                       // (a limit of a whole foot reads oddly at this step)
      return { fish: ft(a), limit: ft(b), how: 'ruler' };
    }
  }
  if (level === 4) {
    const bases = [fr(1, 2), fr(1, 3), fr(2, 3), fr(1, 4), fr(3, 4), fr(2, 5), fr(3, 5), fr(4, 5), fr(5, 6)];
    for (;;) {
      const b = pick(bases, rnd), k = pick([2, 3, 4], rnd);
      if (b.d * k > 12 || b.d * k === 9) continue;
      let big = over(b, b.d * k);
      if (rnd() >= 0.3) { const nn = big.n + pick([-1, 1], rnd); if (nn <= 0 || nn >= big.d) continue; big = fr(nn, big.d); }
      const [fish, limit] = rnd() < 0.5 ? [ft(big, 'frac'), ft(b)] : [ft(b), ft(big, 'frac')];
      return { fish, limit, how: 'equiv' };
    }
  }
  if (level === 5) {
    const dens = [3, 4, 5, 6, 8, 10, 12];
    for (;;) {
      const d1 = pick(dens, rnd), d2 = pick(dens, rnd); if (d1 === d2) continue;
      const related = d1 % d2 === 0 || d2 % d1 === 0; if (related && rnd() < 0.6) continue;
      if (lcm(d1, d2) > 24) continue;
      const a = fr(int(1, d1 - 1, rnd), d1), b = fr(int(1, d2 - 1, rnd), d2);
      if (!isSimplest(a) || !isSimplest(b) || same(a, b) || Math.abs(value(a) - value(b)) > 0.25 || value(b) < 0.25) continue;
      return { fish: ft(a), limit: ft(b), how: 'unlike' };
    }
  }
  // step 6: mixed numbers and improper fractions, inches, feet against inches
  const sub = pick(['mixed', 'inches', 'units'], rnd);
  if (sub === 'mixed') {
    const eq = rnd() < 0.3;
    for (;;) {
      const d = pick([2, 3, 4, 8], rnd), p = int(1, d - 1, rnd); if (gcd(p, d) !== 1) continue;
      const lim = fr(d + p, d);
      let other;
      if (eq) other = lim;
      else { const d2 = pick([d, d * 2 <= 8 ? d * 2 : d], rnd), base = over(lim, d2), nn = base.n + pick([-2, -1, 1, 2], rnd); if (nn <= d2 || nn >= 2 * d2) continue; other = fr(nn, d2); }
      const mixedLimit = rnd() < 0.5;
      return mixedLimit ? { fish: ft(other, 'frac'), limit: ft(lim), how: 'mixed' } : { fish: ft(lim), limit: ft(other, 'frac'), how: 'mixed' };
    }
  }
  if (sub === 'inches') {
    const eq = rnd() < 0.15;
    for (;;) {
      const w = int(6, 14, rnd), b = pick([2, 4, 8], rnd), a = int(1, b - 1, rnd); if (gcd(a, b) !== 1) continue;
      const lim = fr(w * b + a, b);
      let fish;
      if (eq) fish = lim;
      else {
        const b2 = pick([2, 4, 8], rnd), wf = rnd() < 0.25 ? w + pick([-1, 1], rnd) : w, a2 = int(1, b2 - 1, rnd);
        if (gcd(a2, b2) !== 1) continue;
        fish = fr(wf * b2 + a2, b2);
        if (same(fish, lim)) continue;
      }
      return { fish: measure(fish, 'in'), limit: measure(lim, 'in'), how: 'inches' };
    }
  }
  // feet against inches: the limit a fraction of a foot that is a whole number of inches
  const lim = pick([fr(1, 2), fr(1, 3), fr(2, 3), fr(3, 4), fr(5, 6), fr(5, 4), fr(3, 2), fr(4, 3)], rnd), X = value(lim) * 12;
  const off = rnd() < 0.2 ? 0 : pick([-3, -2, -1, 1, 2, 3], rnd);   // half inches
  return { fish: measure(simplest(fr(X * 2 + off, 2)), 'in'), limit: ft(lim), how: 'units' };
}

const KEEP_RULE = {
  ruler: 'Keep a fish that is at least the keeper limit. On a ruler, the mark further from 0 is the longer length.',
  equiv: 'Keep a fish that is at least the keeper limit. Fractions are the same length when the top and bottom of one are the other\'s times the same number.',
  unlike: 'Keep a fish that is at least the keeper limit. To compare fractions, give them the same bottom number (denominator); then the bigger top number (numerator) is longer.',
  mixed: 'Keep a fish that is at least the keeper limit. Write a mixed number as a fraction (1 1/4 = 5/4), then compare with the same bottom number.',
  inches: 'Keep a fish that is at least the keeper limit. Compare the whole inches first; if they match, compare the fractions.',
  units: 'Keep a fish that is at least the keeper limit. A foot is 12 inches: turn the feet into inches, then compare.',
};
// the helper picture for a keep question: a ruler (steps 1 and 2, and inches), fraction bars (the rest)
function keepPic(fishM, limitM, kind, how, showAnswer = true) {
  const K = KINDS[kind];
  if (how === 'ruler') {
    const d = Math.max(fishM.d, limitM.d, 2), top = Math.max(1, Math.ceil(value(fishM)));
    return rulerPic({ unit: 'ft', to: top, parts: d === 2 ? 4 : d, marks: [
      { kind: 'fish', v: fr(fishM.n, fishM.d), label: label(fishM), colour: K.colour },
      { kind: 'limit', v: fr(limitM.n, limitM.d), label: 'limit ' + label(limitM) }] });
  }
  if (how === 'inches' || how === 'units') {
    const f = inches(fishM), l = inches(limitM), lo = Math.max(0, Math.floor(Math.min(value(f), value(l))) - 1), hi = Math.ceil(Math.max(value(f), value(l))) + 1;
    const D = Math.max(f.d, l.d, 2);
    return rulerPic({ unit: 'in', from: lo, to: hi, parts: D, marks: [
      { kind: 'fish', v: f, label: label(fishM), colour: K.colour },
      { kind: 'limit', v: l, label: 'limit ' + label(limitM) + (how === 'units' ? ` = ${T(l)} in.` : '') }],
      note: lo > 0 ? `(the ruler from ${lo} to ${hi} inches)` : '' });
  }
  const A = fr(fishM.n, fishM.d), B = fr(limitM.n, limitM.d), D = lcm(A.d, B.d), whole = Math.max(1, Math.ceil(Math.max(value(A), value(B)) - 1e-9));
  const note = (x) => (showAnswer && x.d !== D && D <= 24 ? `= ${T(over(x, D), 'frac')}` : '');
  return barsPic([
    { f: A, label: label(fishM).replace(' ft', ''), colour: K.colour, note: note(A) },
    { f: B, label: 'limit', colour: '#c98a5a', note: note(B) || label(limitM).replace(' ft', '') }],
  { whole, common: D <= 24 && D !== A.d && D !== B.d ? D : null, unitLabel: 'ft' });
}
function keepQ(level, rnd, ctx) {
  const { fish: len, limit, how } = keepPair(level, rnd);
  const kind = kindFor(feet(len), rnd, ctx.counts), K = KINDS[kind];
  const work = compareWork(len, limit), answer = verdictOf(work.c);
  const yours = ctx.practice ? `Say you catch one ${words(len)} long.` : `Yours is ${words(len)} long.`;
  const helper = keepPic(len, limit, kind, how);
  return {
    topic: 'keep', key: `keep:${label(len)}|${label(limit)}`, fish: fishOf(kind, len), limit,
    prompt: `The keeper limit for ${K.one} is ${words(limit)}: keep one at least that long. ${yours} How does it measure up?`,
    choices: KEEP_CHOICES, labels: KEEP_CHOICES.map((c) => KEEP_LABELS[c]), answer, action: answer === 'shorter' ? 'throw' : 'keep',
    why: `${work.lines.join(' ')} ${VERDICT[answer]}`, helper, svg: level <= 1 ? helper : '', lessonPic: helper,
    rule: KEEP_RULE[how], steps: [...work.lines, VERDICT[answer]], answerLabel: KEEP_LABELS[answer],
    check: { kind: 'keep', a: len, b: limit },
  };
}

// ── LINE THEM UP ─────────────────────────────────────────────────────────────────────────────────────────────────────
// which creel fish suit a step's line-up: lengths in feet, bottom numbers the step knows
const ORDER_DENS = { 3: [1, 2, 4, 8], 5: [1, 2, 3, 4, 6, 8, 12], 6: [1, 2, 3, 4, 6, 8, 12] };
const fitsOrder = (level, f) => f.len.unit === 'ft' && ORDER_DENS[level].includes(f.len.d) && (level === 6 || value(f.len) <= 1);
function orderQ(level, rnd, ctx) {
  level = level <= 3 ? 3 : level >= 6 ? 6 : 5;
  let creel = (ctx.creel || []).filter((f) => fitsOrder(level, f));
  // two from the creel with different lengths (the newest first)
  creel = creel.slice().reverse(); const two = [];
  for (const f of creel) if (two.length < 2 && !two.some((g) => compareM(g.len, f.len) === 0)) two.push(f);
  if (two.length < 2) return null;
  // the new fish: a length the step knows, different from both, within some kind's range
  const cands = level === 3 ? simplestList([2, 4, 8]).filter((f) => value(f) >= 0.5 && value(f) <= 1)
    : level === 5 ? simplestList([3, 4, 6, 8, 12]).filter((f) => value(f) >= 0.5 && value(f) < 1)
      : simplestList([2, 3, 4, 8], 2).filter((f) => value(f) > 1 && value(f) < 2);
  const ok = cands.filter((f) => two.every((g) => !same(f, feet(g.len))) && lcm(lcm(f.d, two[0].len.d), two[1].len.d) <= 24);
  if (!ok.length) return null;
  const c = pick(ok, rnd), form = level === 6 && rnd() < 0.5 ? 'frac' : 'mixed';
  const catchFish = fishOf(kindFor(c, rnd, ctx.counts), ft(c, form));
  const list = shuffle([{ f: two[0], who: 'creel' }, { f: two[1], who: 'creel' }, { f: catchFish, who: 'new' }], rnd);
  const right = [0, 1, 2].sort((i, j) => compareM(list[j].f.len, list[i].f.len));
  const keyOf = (p) => p.join(''), lab = (p) => p.map((i) => label(list[i].f.len)).join(' > ');
  // the slips: a bigger bottom number taken as longer, the top numbers alone, shortest first, the two closest swapped
  const den = (m) => fr(m.n, m.d).d, num = (m) => (m.form === 'mixed' && m.n > m.d ? m.n % m.d : m.n);
  const byDen = [0, 1, 2].sort((i, j) => den(list[j].f.len) - den(list[i].f.len) || num(list[j].f.len) - num(list[i].f.len));
  const byNum = [0, 1, 2].sort((i, j) => num(list[j].f.len) - num(list[i].f.len) || den(list[i].f.len) - den(list[j].f.len));
  const rev = right.slice().reverse();
  const g01 = value(feet(list[right[0]].f.len)) - value(feet(list[right[1]].f.len)), g12 = value(feet(list[right[1]].f.len)) - value(feet(list[right[2]].f.len));
  const swap = g01 < g12 ? [right[1], right[0], right[2]] : [right[0], right[2], right[1]];
  const all = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const wrong = [];
  for (const p of [byDen, byNum, swap, rev, ...shuffle(all.slice(), rnd)]) if (keyOf(p) !== keyOf(right) && !wrong.some((w) => keyOf(w) === keyOf(p))) wrong.push(p);
  const opts = shuffle([right, ...wrong.slice(0, 3)], rnd);
  // the working: all in one bottom number (as fractions)
  const fs = list.map((x) => fr(x.f.len.n, x.f.len.d)), D = fs.reduce((d, f) => lcm(d, f.d), 1);
  const changed = list.map((x, i) => (T(x.f.len, x.f.len.form) === T(over(fs[i], D), 'frac') ? null : `${T(x.f.len, x.f.len.form)} = ${T(over(fs[i], D), 'frac')}`)).filter(Boolean);
  const stay = list.filter((x, i) => T(x.f.len, x.f.len.form) === T(over(fs[i], D), 'frac')).map((x) => T(x.f.len, 'frac'));
  const conv = [...changed, ...(stay.length ? [`${stay.join(' and ')} ${stay.length > 1 ? 'are' : 'is'} already in ${partsWord(D)}`] : [])];
  const lines = [`Write all three in ${partsWord(D)}: ${conv.join(', ')}.`, `Biggest top number first: ${right.map((i) => over(fs[i], D).n).join(', ')}.`, `Longest to shortest: ${right.map((i) => T(list[i].f.len, list[i].f.len.form)).join(', ')}.`];
  const creelA = list.filter((x) => x.who === 'creel');
  const say = ctx.practice ? 'Say your creel holds' : 'Your creel holds';
  const fishWords = (x) => `a ${KINDS[x.f.kind].one} of ${words(x.f.len)}`;
  const top = Math.max(1, Math.ceil(Math.max(...fs.map(value)) - 1e-9));
  const pic = D <= 12 || (D <= 16 && top === 1) ? rulerPic({ unit: 'ft', to: top, parts: D, marks: right.map((i) => ({ kind: 'fish', v: fs[i], label: label(list[i].f.len), colour: KINDS[list[i].f.kind].colour })) })
    : barsPic(right.map((i) => ({ f: fs[i], label: label(list[i].f.len).replace(' ft', ''), colour: KINDS[list[i].f.kind].colour, note: `= ${T(over(fs[i], D), 'frac')}` })), { whole: top, common: D, unitLabel: 'ft' });
  return {
    topic: 'order', key: `order:${list.map((x) => label(x.f.len)).sort().join('|')}`, fish: catchFish,
    prompt: `${say} ${fishWords(creelA[0])} and ${fishWords(creelA[1])}. Your new ${KINDS[catchFish.kind].one} is ${words(catchFish.len)}. Which line-up goes from longest to shortest?`,
    choices: opts.map(keyOf), labels: opts.map(lab), answer: keyOf(right), action: 'keep',
    why: lines.join(' '), helper: pic, svg: '', lessonPic: pic,
    rule: 'To line up fractions, write them all with the same bottom number (denominator); then the bigger the top number (numerator), the longer.',
    steps: lines, answerLabel: lab(right), check: { kind: 'order', list: list.map((x) => x.f.len), right },
  };
}

// ── ADD THE WEIGHTS ──────────────────────────────────────────────────────────────────────────────────────────────────
const fitsAdd = (level, w) => {
  const s = simplest(w);
  if (level <= 3) return [2, 4, 8].includes(s.d) && value(s) < 1;
  if (level === 5) return [2, 3, 4, 6, 8].includes(s.d) && value(s) < 1;
  return [1, 2, 3, 4, 6, 8].includes(s.d);
};
// a kind whose weights take in w (pounds), the least caught first; null when none
function kindForWeight(w, rnd, counts) {
  const c = KIND_LIST.filter((k) => { const K = KINDS[k], lo = K.k * value(K.min) ** 3, hi = K.k * value(K.max) ** 3; return value(w) >= lo * 0.8 && value(w) <= hi; });
  return c.length ? wpick(c.map((k) => [k, 1 / (1 + (counts[k] || 0))]), rnd) : null;
}
// a length (feet, to the quarter) for a fish of this kind and weight
function lengthForWeight(kind, w) {
  const K = KINDS[kind], L = Math.cbrt(value(w) / K.k);
  const q = Math.min(Math.floor(value(K.max) * 4), Math.max(Math.ceil(value(K.min) * 4), Math.round(L * 4)));
  return ft(simplest(fr(q, 4)));
}
function addQ(level, rnd, ctx) {
  level = level <= 3 ? 3 : level >= 6 ? 6 : 5;
  const creel = (ctx.creel || []).filter((f) => fitsAdd(level, f.lb)).reverse();
  if (!creel.length) return null;
  const A = creel[Math.floor(rnd() * Math.min(3, creel.length))], a = simplest(A.lb);
  // the new fish's weight
  const cands = [];
  if (level === 3) { for (let n = 1; n < a.d; n++) { const b = fr(n, a.d); if (value(a) + value(b) <= 1 + 1e-9) cands.push(b); } }
  else if (level === 5) {
    for (const e of [2, 3, 4, 6, 8, 12]) {
      if (e === a.d || !(e % a.d === 0 || a.d % e === 0) || lcm(e, a.d) > 12) continue;
      for (let n = 1; n < e; n++) if (gcd(n, e) === 1) cands.push(fr(n, e));
    }
  } else {
    for (const e of [2, 3, 4, 8]) { if (!(e % a.d === 0 || a.d % e === 0 || a.d === 1)) continue; for (let n = e + 1; n < 3 * e; n++) if (gcd(n, e) === 1) cands.push(fr(n, e)); }
  }
  const usable = shuffle(cands, rnd).map((b) => ({ b, kind: kindForWeight(b, rnd, ctx.counts || {}) })).filter((x) => x.kind);
  if (!usable.length) return null;
  const { b, kind } = usable[0];
  const catchFish = fishOf(kind, lengthForWeight(kind, b), measure(b, 'lb'));
  const sum = plus(a, b), D = lcm(a.d, b.d), ans = measure(sum, 'lb');
  // the slips
  const wrong = [];
  const push = (f) => { if (f && f.n > 0 && f.d > 0 && !same(f, sum) && !wrong.some((w) => same(w, f))) wrong.push(simplest(f)); };
  const wa = Math.floor(value(a)), wb = Math.floor(value(b)), pa = fr(a.n - wa * a.d, a.d), pb = fr(b.n - wb * b.d, b.d);
  push(plus(fr(wa + wb), fr(pa.n + pb.n, pa.d + pb.d)));                                                                             // tops and bottoms added
  if (a.d !== b.d) push(plus(fr(wa + wb), fr(pa.n + pb.n, Math.max(pa.d, pb.d))));                                                   // kept the bigger bottom
  if (value(pa) + value(pb) >= 1) push(fr(sum.n - sum.d, sum.d));                                                                    // dropped the carried whole
  push(plus(sum, fr(1, D))); push(fr(sum.n * D / sum.d - 1, D)); push(plus(sum, fr(2, D)));
  const opts = shuffle([sum, ...wrong.slice(0, 3)], rnd);
  const lab = (f) => label(measure(f, 'lb'));
  // the working
  const lines = [];
  if (wa + wb > 0) {
    lines.push(wa && wb ? `Add the whole pounds: ${wa} + ${wb} = ${wa + wb}.` : `The whole pounds: ${wa + wb}.`);
    if (pa.n && pb.n) {
      const ps = plus(pa, pb);
      lines.push(pa.d === pb.d ? `Add the parts: ${T(pa)} + ${T(pb)} = ${T(fr(pa.n + pb.n, pa.d), 'frac')}${ps.d !== pa.d || value(ps) >= 1 ? ` = ${T(ps)}` : ''}.`
        : `Add the parts with the same bottom number, ${lcm(pa.d, pb.d)}: ${T(over(pa, lcm(pa.d, pb.d)), 'frac')} + ${T(over(pb, lcm(pa.d, pb.d)), 'frac')} = ${T(fr(over(pa, lcm(pa.d, pb.d)).n + over(pb, lcm(pa.d, pb.d)).n, lcm(pa.d, pb.d)), 'frac')}${value(ps) >= 1 || ps.d !== lcm(pa.d, pb.d) ? ` = ${T(ps)}` : ''}.`);
      lines.push(`${wa + wb} + ${T(ps)} = ${T(sum)} pounds.`);
    } else lines.push(`${wa + wb} + ${T(pa.n ? pa : pb)} = ${T(sum)} pounds.`);
  } else if (a.d === b.d) {
    lines.push(`Same bottom number (denominator), so add the tops: ${a.n} + ${b.n} = ${a.n + b.n}.`);
    lines.push(`${T(a)} + ${T(b)} = ${T(fr(a.n + b.n, a.d), 'frac')}${T(sum) !== T(fr(a.n + b.n, a.d), 'frac') ? ` = ${T(sum)}` : ''} ${value(sum) === 1 ? 'pound' : 'pounds'}.`);
  } else {
    const oa = over(a, D), ob = over(b, D);
    lines.push(`Give them the same bottom number (denominator), ${D}: ${a.d === D ? `${T(a)} stays` : `${T(a)} = ${T(oa, 'frac')}`}${b.d === D ? `, ${T(b)} stays` : `, ${T(b)} = ${T(ob, 'frac')}`}.`);
    lines.push(`${T(oa, 'frac')} + ${T(ob, 'frac')} = ${T(fr(oa.n + ob.n, D), 'frac')}${T(sum) !== T(fr(oa.n + ob.n, D), 'frac') ? ` = ${T(sum)}` : ''} ${value(sum) === 1 ? 'pound' : 'pounds'}.`);
  }
  const say = ctx.practice ? 'Say your new' : 'Your new';
  const pic = weighPic({ f: a, label: `${KINDS[A.kind].one} ${label(A.lb)}`, colour: KINDS[A.kind].colour }, { f: b, label: `${KINDS[kind].one} ${label(catchFish.lb)}`, colour: KINDS[kind].colour }, { parts: D <= 12 ? D : lcm(a.d, b.d), total: `together ${lab(sum)}` });
  return {
    topic: 'add', key: `add:${[T(a), T(b)].sort().join('+')}`, fish: catchFish,
    prompt: `${say} ${KINDS[kind].one} weighs ${words(catchFish.lb)}. The ${KINDS[A.kind].one} in your creel weighs ${words(measure(a, 'lb'))}. How much do the two weigh together?`,
    choices: opts.map((f) => T(f)), labels: opts.map(lab), answer: T(sum), action: 'keep',
    why: lines.join(' '), helper: pic, svg: '', lessonPic: pic,
    rule: level === 6 ? 'Add the whole numbers, then the fractions (with the same bottom number); if the fractions make more than one whole, carry it.'
      : 'To add fractions they need the same bottom number (denominator); then add the top numbers (numerators) and keep the bottom.',
    steps: lines, answerLabel: lab(sum), check: { kind: 'add', a, b, sum: ans },
  };
}

// ── THE SAME LENGTH, OTHER NUMBERS ───────────────────────────────────────────────────────────────────────────────────
function sameQ(level, rnd, ctx) {
  for (;;) {
    const base = pick([fr(1, 2), fr(1, 3), fr(2, 3), fr(1, 4), fr(3, 4), fr(1, 6), fr(5, 6)], rnd), k = pick([2, 3, 4], rnd), D = base.d * k;
    if (D > 12) continue;
    const big = over(base, D), finer = rnd() < 0.5;
    const answer = finer ? big : base, given = finer ? base : big;
    const wrong = [];
    const push = (f) => { if (f.n > 0 && f.d > 0 && !same(f, answer) && !wrong.some((w) => same(w, f))) wrong.push(f); };
    if (finer) { push(fr(base.n, D)); push(fr(base.n + D - base.d, D)); push(fr(big.n + 1, D)); push(fr(big.n - 1, D)); }
    else { push(fr(big.n / k, D)); push(fr(big.n, base.d)); push(fr(big.n - (D - base.d), base.d)); push(fr(big.n - 1, D - 1)); push(fr(base.n + 1, base.d)); push(fr(base.n, base.d + 1)); }
    if (wrong.length < 3) continue;
    const opts = shuffle([answer, ...shuffle(wrong, rnd).slice(0, 3)], rnd);
    const kind = kindFor(answer, rnd, ctx.counts), K = KINDS[kind];
    const len = ft(given, 'frac');
    const say = ctx.practice ? `Say your ${K.one}` : `Your ${K.one}`;
    const prompt = finer
      ? `${say} reaches the keeper limit exactly: ${words(ft(base))}. Your ruler is marked in ${partsWord(D)} of a foot. Which mark does its tail reach?`
      : `${say} measures ${words(len)} on a ruler marked in ${partsWord(D)} of a foot. The record book writes the simplest form (the smallest numbers). Which is the same length?`;
    const lines = finer
      ? [`${cap(partsWord(D))} are ${k} times smaller than ${partsWord(base.d)}, so there are ${k} times as many.`, `Multiply the top and the bottom by ${k}: ${base.n} × ${k} = ${big.n} and ${base.d} × ${k} = ${D}.`, `So ${T(base)} = ${T(big, 'frac')}.`]
      : [`Divide the top and the bottom by the same number, ${k}.`, `${big.n} ÷ ${k} = ${base.n} and ${D} ÷ ${k} = ${base.d}.`, `So ${T(big, 'frac')} = ${T(base)}.`];
    const pic = barsPic([{ f: base, label: T(base), colour: K.colour }, { f: big, label: T(big, 'frac'), colour: '#c98a5a' }], { unitLabel: 'ft' });
    return {
      topic: 'same', key: `same:${T(given, 'frac')}>${T(answer, 'frac')}`, fish: fishOf(kind, finer ? ft(base) : len), shown: finer ? ft(base) : len,
      prompt, choices: opts.map((f) => T(f, 'frac')), labels: opts.map((f) => label(ft(f, 'frac'))), answer: T(answer, 'frac'), action: 'keep',
      why: lines.join(' '), helper: pic, svg: '', lessonPic: pic,
      rule: 'Multiplying (or dividing) the top and the bottom of a fraction by the same number gives the same amount: an equivalent fraction.',
      steps: lines, answerLabel: label(ft(answer, 'frac')), check: { kind: 'same', given, answer },
    };
  }
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ── RATIOS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const twoKinds = (rnd) => { const a = pick(KIND_LIST, rnd); let b; do b = pick(KIND_LIST, rnd); while (b === a); return [a, b]; };
// the right number and up to 3 wrong ones from the list (whole numbers, more than 0, under `max`, none twice)
function numChoices(answer, wrong, rnd, max = Infinity) {
  const w = [...new Set(wrong.filter((v) => Number.isInteger(v) && v > 0 && v < max && v !== answer))];
  for (let d = 1; w.length < 3 && d < 60; d++) for (const v of [answer + d, answer - d]) if (w.length < 3 && v > 0 && v < max && !w.includes(v) && v !== answer) w.push(v);
  return shuffle([answer, ...shuffle(w, rnd).slice(0, 3)], rnd);
}
function cookQ(level, rnd, ctx) {
  for (;;) {
    const [a, b] = pick([[3, 2], [2, 1], [3, 1], [1, 2], [2, 3], [4, 1], [3, 4], [5, 2], [1, 3]], rnd), k = int(2, 5, rnd), n = k * (a + b);
    if (n > 35) continue;
    const [kA, kB] = twoKinds(rnd), askA = rnd() < 0.6, ans = askA ? k * a : k * b, other = askA ? k * b : k * a, part = askA ? a : b;
    const choices = numChoices(ans, [other, n / 2, ans + k, ans - k, part * (a + b)], rnd, n);
    const rows = [], steps = [];
    for (let i = 1; i <= k; i++) if (i <= 2 || i === k) { rows.push([a * i, b * i, (a + b) * i]); if (i > 1) steps.push('× ' + i); }
    const hlRow = rows.length - 1, nA = KINDS[kA].one, nB = KINDS[kB].one, askName = askA ? nA : nB;
    const pic = tablePic({ head: [nA, nB, 'in all'], rows, hl: [hlRow, askA ? 0 : 1], steps });
    const lines = [`Every batch has ${a} ${nA} and ${b} ${nB}: ${a} + ${b} = ${a + b} fish.`, `${n} fish ÷ ${a + b} = ${k} batches.`, `${k} × ${part} = ${ans} ${askName}.`];
    return {
      topic: 'cook', key: `cook:${a}:${b}:${n}:${askA}`, fish: anyKeeper(rnd, ctx.counts || {}),
      prompt: `The cook at the cabin wants ${a} ${nA} for every ${b} ${nB}. She will fry ${n} fish in all. How many of them are ${askName}?`,
      choices: choices.map(String), labels: choices.map(String), answer: String(ans), action: 'keep',
      why: lines.join(' '), helper: pic, svg: '', lessonPic: pic,
      rule: `A ratio like ${a} to ${b} means for every ${a} of one there are ${b} of the other. Find how many batches make the total, then multiply.`,
      steps: lines, answerLabel: String(ans), check: { kind: 'cook', a, b, n, askA, ans },
    };
  }
}
function baitQ(level, rnd, ctx) {
  for (;;) {
    const r = int(2, 4, rnd), f = int(2, 5, rnd), w = r * f, m = int(2, 10, rnd);
    if (m === f) continue;
    const ans = r * m;
    const choices = numChoices(ans, [w + (m - f), ans + r, ans - r, m + r, w + m], rnd);
    const pic = tablePic({ head: ['worms', 'fish'], rows: [[w, f], [r, 1], [ans, m]], hl: [2, 0], steps: ['÷ ' + f, '× ' + m] });
    const lines = [`${w} worms for ${f} fish: ${w} ÷ ${f} = ${r} worms for each fish.`, `For ${m} fish: ${m} × ${r} = ${ans} worms.`];
    return {
      topic: 'bait', key: `bait:${w}:${f}:${m}`, fish: anyKeeper(rnd, ctx.counts || {}),
      prompt: `You used ${w} worms to catch ${f} fish. At that rate, how many worms for ${m} fish?`,
      choices: choices.map(String), labels: choices.map(String), answer: String(ans), action: 'keep',
      why: lines.join(' '), helper: pic, svg: '', lessonPic: pic,
      rule: 'At the same rate, first find how many for one (the unit rate), then multiply.',
      steps: lines, answerLabel: String(ans), check: { kind: 'bait', w, f, m, ans },
    };
  }
}
function ruleQ(level, rnd, ctx) {
  for (;;) {
    const n = int(2, 5, rnd), k = int(2, 7, rnd), c = n * k;
    if (c > 30 || c < 8) continue;
    const fwd = rnd() < 0.6, ans = fwd ? k : c;
    const choices = fwd ? numChoices(ans, [c - n, c - k, n, k + 1, k - 1], rnd, c) : numChoices(ans, [k + n, k * (n - 1), c + n, c - n, c + k], rnd);
    const pic = groupsPic({ per: n, groups: k, colour: KINDS.trout.colour });
    const lines = fwd ? [`Put the ${c} fish in groups of ${n}: ${c} ÷ ${n} = ${k} groups.`, `Keep 1 from each group: ${k} fish.`]
      : [`Each fish you kept came from a group of ${n}.`, `${k} groups × ${n} = ${c} fish caught.`];
    return {
      topic: 'rule', key: `rule:${n}:${k}:${fwd}`, fish: anyKeeper(rnd, ctx.counts || {}),
      prompt: fwd ? `The rule on this lake: keep 1 fish in every ${n} you catch, and throw the rest back. You caught ${c} today. How many can you keep?`
        : `The rule on this lake: keep 1 fish in every ${n} you catch. You kept ${k} today. How many did you catch?`,
      choices: choices.map(String), labels: choices.map(String), answer: String(ans), action: 'keep',
      why: lines.join(' '), helper: pic, svg: '', lessonPic: pic,
      rule: `Keep 1 in every ${n} means sorting them into groups of ${n} and keeping one from each group.`,
      steps: lines, answerLabel: String(ans), check: { kind: 'rule', n, k, fwd, ans },
    };
  }
}
function partQ(level, rnd, ctx) {
  for (;;) {
    const a = int(1, 5, rnd), b = int(1, 5, rnd);
    if (a === b || gcd(a, b) !== 1) continue;
    const [kA, kB] = twoKinds(rnd), nA = KINDS[kA].one, nB = KINDS[kB].one;
    // (the parts the wrong way up, b/a, only while it stays a small number: "4" for 1 trout to 4 bass tempts nobody)
    const ans = fr(a, a + b), wrong = [fr(a, b), fr(b, a + b), ...(b <= 2 * a ? [fr(b, a)] : [])].filter((f) => !same(f, ans));
    const opts = shuffle([ans, ...wrong], rnd);
    const pic = barsPic([{ f: ans, label: nA, colour: KINDS[kA].colour, note: `${a} of ${a + b}` }], { unitLabel: '' });
    const lines = [`For every ${a} ${nA} there are ${b} ${nB}: ${a} + ${b} = ${a + b} fish in each batch.`, `${a} of every ${a + b} are ${nA}: ${T(ans)}.`];
    return {
      topic: 'part', key: `part:${a}:${b}`, fish: anyKeeper(rnd, ctx.counts || {}),
      prompt: `In the cook's pan there are ${a} ${nA} for every ${b} ${nB}. What fraction of the fish are ${nA}?`,
      choices: opts.map((f) => T(f, 'frac')), labels: opts.map((f) => T(f, 'frac')), answer: T(ans, 'frac'), action: 'keep',
      why: lines.join(' '), helper: pic, svg: '', lessonPic: pic,
      rule: `A ratio of ${a} to ${b} makes batches of ${a + b}, so ${a} out of every ${a + b} (${T(ans)}) are the first kind.`,
      steps: lines, answerLabel: T(ans, 'frac'), check: { kind: 'part', a, b },
    };
  }
}

// ── the ladder ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const MAKERS = { keep: keepQ, order: orderQ, add: addQ, same: sameQ, cook: cookQ, bait: baitQ, rule: ruleQ, part: partQ };
// which kinds each step asks, and how often
const PLAN = {
  1: [['keep', 1]], 2: [['keep', 1]], 3: [['order', 4], ['add', 4], ['keep', 2]], 4: [['keep', 6], ['same', 4]],
  5: [['keep', 4], ['order', 3], ['add', 3]], 6: [['keep', 4], ['add', 3], ['order', 3]], 7: [['cook', 3], ['bait', 3], ['rule', 2], ['part', 2]],
};
// a keep question for a step that has no keep of its own (3: eighths as at 2; 7: unlike as at 5)
const KEEP_AT = { 1: 1, 2: 2, 3: 2, 4: 4, 5: 5, 6: 6, 7: 5 };
// the topics each step can ask (Teach me, tests)
export const TOPICS_AT = Object.fromEntries(Object.entries(PLAN).map(([k, v]) => [k, v.map((p) => p[0])]));
const makeAt = (topic, from, rnd, ctx) => (topic === 'keep' ? keepQ(KEEP_AT[from], rnd, ctx) : MAKERS[topic](from, rnd, ctx));

// the question for a fish caught on this step. ctx: { creel: [fish kept, oldest first], counts: { kind: caught },
// practice }; recent: keys of the last questions (none of them is asked again while another will do)
export function ladderQuestion(level, rnd = Math.random, ctx = {}, recent = []) {
  level = Math.min(LADDER_TOP, Math.max(1, Math.round(level) || 1));
  ctx = { counts: {}, creel: [], ...ctx };
  let best = null;
  for (let t = 0; t < 40; t++) {
    const from = level === LADDER_TOP ? pick([3, 4, 5, 5, 6, 6, 7, 7], rnd) : level;
    const q = makeAt(wpick(PLAN[from], rnd), from, rnd, ctx);
    if (!q) continue;
    const out = { ...q, level, from };
    if (!recent.includes(q.key)) return out;
    best = best || out;
  }
  return best || { ...keepQ(KEEP_AT[Math.min(level, 7)], rnd, ctx), level, from: Math.min(level, 7) };
}
// some made-up fish in a creel, for a practice question that needs one (the right step's lengths and weights)
function practiceCreel(from, rnd) {
  const dens = from <= 3 ? [2, 4, 8] : from === 5 ? [3, 4, 6, 8, 12] : [2, 4, 8];
  const out = [];
  for (let t = 0; out.length < 3 && t < 60; t++) {
    const len = from === 6 ? pick(simplestList([2, 4, 8], 2).filter((f) => value(f) > 1 && value(f) < 2), rnd) : pick(simplestList(dens).filter((f) => value(f) >= 0.5 && value(f) <= 1), rnd);
    const kind = kindFor(len, rnd), fish = fishOf(kind, ft(len));
    if (from <= 3) fish.lb = measure(pick(simplestList([4, 8]).filter((f) => value(f) < 1), rnd), 'lb');
    if (!out.some((f) => same(feet(f.len), len))) out.push(fish);
  }
  return out;
}
// a fresh practice question of one topic at a step (the "Try it" after a lesson)
export function questionOf(topic, from, rnd = Math.random, ctx = {}) {
  from = Math.min(7, Math.max(1, Math.round(from) || 1));
  const c = { counts: {}, ...ctx, practice: true, creel: practiceCreel(from, rnd) };
  for (let t = 0; t < 20; t++) { const q = makeAt(topic, from, rnd, c); if (q) return { ...q, level: from, from }; }
  return { ...keepQ(KEEP_AT[from], rnd, c), level: from, from };
}

// the ladder after an answer
export const freshLadder = () => ({ level: 1, streak: 0, placing: true, slips: 0 });
export function stepLadder(s, right) {
  const level = Math.min(LADDER_TOP, Math.max(1, Math.round(+s?.level || 1)));
  if (s?.placing) {
    if (right) { const up = Math.min(LADDER_TOP, level + 1); return { level: up, streak: 0, placing: up < LADDER_TOP, slips: s.slips || 0 }; }
    const slips = (s.slips || 0) + 1;
    return slips >= PLACING_SLIPS ? { level: Math.max(1, level - 1), streak: 0, placing: false, slips } : { level, streak: 0, placing: true, slips };
  }
  if (!right) return { level: Math.max(1, level - 1), streak: 0, placing: false, slips: s?.slips || 0 };
  const streak = (s?.streak || 0) + 1;
  return streak >= CLEAN_TO_CLIMB && level < LADDER_TOP ? { level: level + 1, streak: 0, placing: false, slips: s?.slips || 0 }
    : { level, streak: streak >= CLEAN_TO_CLIMB ? 0 : streak, placing: false, slips: s?.slips || 0 };
}
// a saved ladder read back safely (anything odd: a fresh one)
export function readLadder(text) {
  try {
    const s = JSON.parse(text), l = Math.round(+s.level);
    if (l >= 1 && l <= LADDER_TOP) return { level: l, streak: Math.max(0, Math.min(CLEAN_TO_CLIMB - 1, Math.round(+s.streak || 0))), placing: !!s.placing, slips: Math.max(0, Math.round(+s.slips || 0)) };
  } catch (e) { /* fresh */ }
  return freshLadder();
}

// ── the biggest fish and the fish book ───────────────────────────────────────────────────────────────────────────────
export const RECORD_KEY = 'bandit-math.fishing.record';
export const BOOK_KEY = 'bandit-math.fishing.book';
// is this fish longer than the record (null: no record yet)?
export const beatsRecord = (rec, fish) => !rec || compareM(fish.len, rec.len) > 0;
// a record or a book read back safely
export function readRecord(text) {
  try { const r = JSON.parse(text); if (r && KINDS[r.kind] && r.len && r.len.d > 0 && ['ft', 'in'].includes(r.len.unit)) return { kind: r.kind, len: { n: +r.len.n, d: +r.len.d, unit: r.len.unit, form: r.len.form === 'frac' ? 'frac' : 'mixed' }, lb: r.lb && r.lb.d > 0 ? { n: +r.lb.n, d: +r.lb.d, unit: 'lb', form: 'mixed' } : null }; } catch (e) { /* none */ }
  return null;
}
// the book: { kind: { small, keeper, trophy (each true once caught), caught (how many), best (its longest, a measure) } }
const okLen = (r) => (r && +r.d > 0 && +r.n > 0 && ['ft', 'in'].includes(r.unit) ? { n: +r.n, d: +r.d, unit: r.unit, form: r.form === 'frac' ? 'frac' : 'mixed' } : null);
export function readBook(text) {
  const out = Object.fromEntries(KIND_LIST.map((k) => [k, { small: false, keeper: false, trophy: false, caught: 0, best: null }]));
  try {
    const b = JSON.parse(text);
    for (const k of KIND_LIST) if (b && b[k]) { for (const s of SIZES) out[k][s] = !!b[k][s]; out[k].caught = Math.max(0, Math.round(+b[k].caught || 0)); out[k].best = okLen(b[k].best); }
  } catch (e) { /* fresh */ }
  return out;
}
// the book with one more fish in it -> { book (a new object), size, newSize (true the first time that size of that kind) }
export function addToBook(book, fish) {
  const out = JSON.parse(JSON.stringify(book)), e = out[fish.kind], size = sizeOf(fish), newSize = !e[size];
  e[size] = true; e.caught++;
  if (!e.best || compareM(fish.len, e.best) > 0) e.best = { ...fish.len };
  return { book: out, size, newSize };
}
export const bookCount = (book) => KIND_LIST.reduce((n, k) => n + SIZES.filter((s) => book[k][s]).length, 0);
export const BOOK_TOTAL = KIND_LIST.length * SIZES.length;
export { label, words, fracText, parseFrac, feet, inches };
