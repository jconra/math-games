// facts.js: THE TIMES FACTS, one at a time. Every place that asks a times fact (the round-up's series and herds, the
// wagon's gangs, the deer's "? × 4 = 28", a sheep's sum, the lock box's 3x = 12 ...) tells this module how the rider
// did on that fact, and the TIMES CHART (12 x 12) colours it: green for a fact answered right, red for one missed.
// A red fact comes back soon, and the tables the rider misses come up more often ("great at times tables 1-6,
// but needs work on 7 & 8, so it focuses on those more"), starting from the design's difficulty tiers before there's anything
// to go on: 1 & 2 super easy; 3, 5 & 10 easy; 4 & 9 normal; 6, 7 & 8 hard; 11 & 12 expert.
//
// WHAT A RIDER KEEPS (rider.facts, saved with the rider):
//   { v: 1, migrated: 1, n (fact answers recorded: the clock "soon" counts in), f: { '7x8': Fact, ... } }
//   Fact = { r, m (right and missed, all time), h ('1101': the last HIST answers, newest last), run (rights in a row
//            since the last miss), at (ms of the last answer), due (n when a red fact should come back, or null) }
//   A fact is kept once, smaller number first: 8 x 7 and 7 x 8 are the same fact '7x8' (the chart colours both).
//
// RED AND GREEN. A missed fact is red until it is answered right RED_CLEAR times running (once soon after, once more
// later), then green. A fact never missed and answered right is green. Not asked yet: no colour.
// SOON. A red fact is due again SOON (2 to 4) fact answers later; the picker brings due facts back first.
//
// THE API (pure, over the rider object; save.js saves)
//   recordFact(rider, a, b, right, { now })       -> the fact (made the first time)
//   factOf(rider, a, b) -> Fact | null;  colourOf(rider, a, b) -> 'green' | 'red' | null
//   chart(rider, size = 12) -> rows: chart[a - 1][b - 1] = 'green' | 'red' | null   (for the TIMES CHART)
//   tableMiss(rider, t) -> 0..1 how often the rider misses the t-table (the tiers' guess, then the rider's own answers)
//   pickTable(rider, tables, { rand, last })       -> a table, weak ones more often (for "Rope the 7s", the 7-Gang)
//   pickFact(rider, { tables, upTo, rand, last })  -> { a (the table), b, why: 'due' | 'weak' }   a red fact that is
//                                                     due first, else a fact of a table from pickTable
//   dueFacts(rider, { tables }) -> ['7x8', ...];  tierOf(t) -> 0..4;  factKey(a, b) -> '7x8'
//   migrate(rider): once, the old times trainer's missed facts (rider.topics.times) become red facts
//   FACTS (the dials), TIERS, TIER_NAMES

export const FACTS = {
  RED_CLEAR: 2,          // right this many times running after a miss turns a fact green again
  SOON: [2, 4],          // a missed fact is due again this many fact answers later (from the first to the second)
  HIST: 4,               // answers kept per fact for how weak its table is now
  PRIOR: 4,              // the tier's guess counts as this many answers in a table's miss rate
  TOP: 12,               // the chart and the facts go up to 12 x 12
};
// The difficulty tiers, easiest first, and how often a kid new to them is guessed to miss each tier
export const TIERS = [[1, 2], [3, 5, 10], [4, 9], [6, 7, 8], [11, 12]];
export const TIER_NAMES = ['super easy', 'easy', 'normal', 'hard', 'expert'];
const PRIOR_MISS = [0.03, 0.08, 0.15, 0.25, 0.3];

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const okN = (n) => Number.isInteger(n) && n >= 1 && n <= FACTS.TOP;

export function tierOf(t) { const i = TIERS.findIndex((x) => x.includes(t)); return i < 0 ? 4 : i; }
export function factKey(a, b) { return a <= b ? `${a}x${b}` : `${b}x${a}`; }

// rider.facts, filled in (made if missing)
export function factsOf(rider) {
  if (!isObj(rider)) return { v: 1, migrated: 0, n: 0, f: {} };
  const F = isObj(rider.facts) ? rider.facts : (rider.facts = {});
  F.v = 1; F.migrated = F.migrated ? 1 : 0;
  F.n = Math.max(0, Math.floor(num(F.n, 0)));
  if (!isObj(F.f)) F.f = {};
  for (const k of Object.keys(F.f)) {
    const e = F.f[k], m = /^(\d+)x(\d+)$/.exec(k);
    if (!m || !okN(+m[1]) || !okN(+m[2]) || !isObj(e)) { delete F.f[k]; continue; }
    for (const x of ['r', 'm', 'run']) e[x] = Math.max(0, Math.floor(num(e[x], 0)));
    e.h = typeof e.h === 'string' ? e.h.replace(/[^01]/g, '').slice(-FACTS.HIST) : '';
    e.at = num(e.at, 0);
    e.due = e.due == null ? null : num(e.due, null);
  }
  return F;
}

export function factOf(rider, a, b) {
  const F = rider && isObj(rider.facts) && isObj(rider.facts.f) ? rider.facts.f : null;
  return F ? F[factKey(a, b)] || null : null;
}
const isRed = (e) => !!e && e.m > 0 && e.run < FACTS.RED_CLEAR;
export function colourOf(rider, a, b) {
  const e = factOf(rider, a, b);
  if (!e || !(e.r + e.m)) return null;
  return isRed(e) ? 'red' : e.r > 0 ? 'green' : null;
}

// One answer on the fact a x b (either way round; a fact past 12 x 12 is not kept).
export function recordFact(rider, a, b, right, { now = Date.now(), rand = Math.random } = {}) {
  a = Math.round(a); b = Math.round(b);
  if (!okN(a) || !okN(b)) return null;
  const F = factsOf(rider);
  F.n++;
  const k = factKey(a, b);
  const e = F.f[k] || (F.f[k] = { r: 0, m: 0, h: '', run: 0, at: 0, due: null });
  if (right) { e.r++; e.run++; } else { e.m++; e.run = 0; }
  e.h = (e.h + (right ? '1' : '0')).slice(-FACTS.HIST);
  e.at = now;
  // red: due back soon (and again after each right answer until it is green)
  e.due = isRed(e) ? F.n + FACTS.SOON[0] + Math.floor(rand() * (FACTS.SOON[1] - FACTS.SOON[0] + 1)) : null;
  return e;
}

// The 12 x 12 chart's colours: chart[a - 1][b - 1].
export function chart(rider, size = FACTS.TOP) {
  return Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => colourOf(rider, i + 1, j + 1)));
}

// How often the rider misses the t-table now: the tier's guess (as PRIOR answers) and the recent answers on its facts.
export function tableMiss(rider, t) {
  const prior = PRIOR_MISS[tierOf(t)];
  let miss = prior * FACTS.PRIOR, n = FACTS.PRIOR;
  for (let b = 1; b <= FACTS.TOP; b++) {
    const e = factOf(rider, t, b);
    if (!e) continue;
    for (const c of e.h) { n++; if (c === '0') miss++; }
    if (isRed(e)) miss += 0.5;   // (a fact still red weighs a little extra, whatever its old answers say)
  }
  return Math.min(1, miss / n);
}

// A table to ask, the weak ones more often: weight = a small base + the table's miss rate (and half for the one just
// asked, when there is another).
export function pickTable(rider, tables, { rand = Math.random, last = null } = {}) {
  const list = (tables || []).filter((t) => okN(t));
  if (!list.length) return null;
  const w = list.map((t) => (0.12 + tableMiss(rider, t)) * (t === last && list.length > 1 ? 0.5 : 1));
  let r = rand() * w.reduce((x, y) => x + y, 0);
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r < 0) return list[i]; }
  return list[list.length - 1];
}

// Red facts that are due now (oldest due first), on the given tables (either number of the fact in them).
export function dueFacts(rider, { tables = null, upTo = FACTS.TOP } = {}) {
  const F = rider && isObj(rider.facts) ? rider.facts : null;
  if (!F || !isObj(F.f)) return [];
  const n = num(F.n, 0);
  return Object.entries(F.f)
    .filter(([k, e]) => isRed(e) && e.due != null && e.due <= n && inTables(k, tables, upTo))
    .sort((x, y) => x[1].due - y[1].due).map(([k]) => k);
}
function inTables(k, tables, upTo) {
  const [a, b] = k.split('x').map(Number);
  if (!tables) return a <= upTo && b <= upTo;
  return (tables.includes(a) && b <= upTo) || (tables.includes(b) && a <= upTo);
}

// A fact to ask: a red one that is due (on these tables) first; else a table from pickTable and its other number
// weighted toward red facts (3), facts not asked yet (1.5) and away from facts long green (0.5).
//   -> { a (the table, from `tables`), b, key, why: 'due' | 'weak' }
export function pickFact(rider, { tables, upTo = FACTS.TOP, from = 1, rand = Math.random, last = null } = {}) {
  const list = (tables || []).filter(okN);
  if (!list.length) return null;
  const due = dueFacts(rider, { tables: list, upTo }).filter((k) => k !== last);
  if (due.length) {
    const [x, y] = due[0].split('x').map(Number);
    const a = list.includes(y) && !list.includes(x) ? y : list.includes(x) ? x : y;
    return { a, b: a === x ? y : x, key: due[0], why: 'due' };
  }
  const a = pickTable(rider, list, { rand });
  const bs = [];
  for (let b = Math.max(1, from); b <= upTo; b++) bs.push(b);
  const w = bs.map((b) => {
    const e = factOf(rider, a, b), k = factKey(a, b);
    const base = !e ? 1.5 : isRed(e) ? 3 : e.run >= 3 ? 0.5 : 1;
    return base * (k === last ? 0.1 : 1);
  });
  let r = rand() * w.reduce((x, y) => x + y, 0);
  let b = bs[bs.length - 1];
  for (let i = 0; i < bs.length; i++) { r -= w[i]; if (r < 0) { b = bs[i]; break; } }
  return { a, b, key: factKey(a, b), why: 'weak' };
}

// Once per rider: the old times trainer's missed facts (rider.topics.times: its comebacks and next-session reviews)
// become red facts, due straight away. A missed "rule" number that is a multiple is that fact (56 in the 7s: 7 x 8); a
// stray (a number that wasn't in the herd) is no fact and is left out. Safe to call on every load.
export function migrate(rider) {
  const F = factsOf(rider);
  if (F.migrated) return F;
  const T = rider && isObj(rider.topics) && isObj(rider.topics.times) ? rider.topics.times : null;
  const items = T ? [...(Array.isArray(T.review) ? T.review : []), ...(Array.isArray(T.soon) ? T.soon : [])] : [];
  for (const x of items) {
    if (!isObj(x) || typeof x.t !== 'number') continue;
    let b = null;
    if (x.kind === 'missing' && typeof x.a === 'number') b = x.a;
    else if (x.kind === 'rule' && typeof x.n === 'number' && x.n % x.t === 0) b = x.n / x.t;
    if (!okN(x.t) || !okN(b)) continue;
    const k = factKey(x.t, b);
    const e = F.f[k] || (F.f[k] = { r: 0, m: 0, h: '', run: 0, at: 0, due: null });
    if (e.m === 0) { e.m = 1; e.h = '0'; e.run = 0; e.due = F.n; }
  }
  F.migrated = 1;
  return F;
}
