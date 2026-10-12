// The times-table trainer behind the round-up.
//
// One ladder of steps runs from "the 2s up to x5" to missing-number cards (7 x ? = 56). Each wave is
// a rule card ("Rope the 6-herd") and a herd of numbers: about half are in the herd, the rest are
// strays with designed wrong numbers. The step moves with the answers:
//   - 5 right in a row moves up a step; a miss moves down a step, but at most one step a wave
//     (several misses in one wave count once, so a rough wave can't drop a kid from the 8s to the
//     3s). Only the step's own waves count. Simulated kids settle near 80% right on their own
//     material (the numbers are with the dials just below).
//   - On a kid's first visit the step climbs after every right answer. One slip is forgiven (the
//     kid goes back to the step that wave was dealt at and the next wave tests it again); the
//     second miss ends the climb two steps below the step it happened on. An older kid isn't stuck
//     on the 2s.
//   - Each session opens with 2 easy warm-up waves from well below the kid's step.
//   - The tables take turns: two waves on the step's own table, then one on another open table
//     (weighted toward the hard tables and the ones the kid has missed).
//   - A number that fooled the kid comes back 2 to 4 answers later (due() hands it back mid-wave),
//     or with the next wave of its table, and again next session, right after the warm-ups.
//
// The wrong numbers are designed, never random. Early waves use strays that are clearly out (far from
// any multiple, and odd for the even tables). After that every wave leans on a different kind of trap,
// so no shortcut like "even means herd" or "ends in 7 means herd" keeps working:
//   neighbour  products from the next-door tables (24 and 30 among the 7s)
//   near       one or two off a real multiple (55 and 57 next to 56)
//   parity     even numbers that are not in an even herd (12, 20, 28 among the 8s)
//   shared     multiples of a smaller factor (9, 15, 21 among the 6s)
//   lookalike  same last digit, or digits swapped (17, 27, 47 among the 7s; 42 for 24)
// The trainer counts which kind fools the kid and serves a little more of it.
//
// Everything it remembers lives in the plain object it is given (rider.topics.times), so it saves as
// JSON with the rider. Nothing is kept anywhere else, and a reload mid-wave carries on where it was.
//
// The same small shape fits every topic (see topic.js): wave(), answer(), explain(), hint(), level().

// ---- the dials (defaults; change them here) ---------------------------------------------------

export const CLEAN_TO_CLIMB = 5;        // right answers in a row to move up a step
export const MAX_DOWN_PER_WAVE = 1;     // a rough wave drops the kid this many steps at most (several misses count once)
// With 5 in a row up and at most one step down a wave, simulated kids settle near 80% right on their own
// step's waves. Played the way the round-up plays (11 numbers a wave, 6 of them right, and a number that
// fooled the kid handed back mid-wave by due()): 78 to 81% in one kid model and 77 to 80% in the other (10 seed
// sets), about 86% and 84% over the whole session with the reviews and warm-ups. The tests deal 10 numbers a
// wave and leave due() out, which runs a point or two easier: 80 to 83% and 78 to 82% (over 20 seed sets),
// about 87% and 85% over the session. With 3 in a row they settled near 58% and 54% in the round-up (64% and
// 57% the tests' way): a wave has 5 or 6 right ones, so a kid could climb twice in a wave but drop only once.
// The kids now settle 2 to 3 steps lower.
export const PLACEMENT_MISSES = 2;      // the first-visit climb ends at this many misses (one slip is forgiven)
export const PLACE_BELOW = 2;           // the climb ends this many steps below the step of the wave with that miss
// With 2 below, first-visit kids land where they go on to settle ON AVERAGE: played the round-up's way, the
// average kid lands within about a step of it either way (a step below to a step and a half above over the seed
// sets tried, mostly within half a step). With 1 below they landed up to 2.5 steps above once 5 in a row became
// the rule. A single kid can land well off: the climb goes up a step per right answer and a miss sends it back
// to the step the wave was dealt at, so it can only stop on a few steps. Depending on the kid, from a few in 100
// to most of them land 2 or more steps above or below their own step; the next waves move them there.

// The order the tables unlock in. Small, friendly tables first; the hard middle (6, 7, 8, 12) last.
export const ORDER = [2, 10, 5, 3, 4, 9, 11, 6, 8, 7, 12];

// Review waves lean toward the tables kids find hardest.
const HARD_TABLES = { 6: 2, 7: 2.5, 8: 2, 9: 1.5, 12: 2 };

// A gap this long between answers starts a new session (warm-ups, last session's misses).
const SESSION_GAP_MS = 30 * 60 * 1000;

// How many times a table must be served before its strays stop being the easy kind.
const EASY_WAVES = { 2: 3, 10: 3, 5: 3 };

// How many missed facts to keep for next session, and how many may wait to come back at once.
const REVIEW_KEEP = 40;
const SOON_KEEP = 30;

const TIMES = '×';   // the times sign
const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

// The kinds of designed wrong number, in the order they are explained above.
export const TRAP_KINDS = ['neighbour', 'near', 'parity', 'shared', 'lookalike'];

// ---------------------------------------------------------------------------------------------
// The ladder. Each row is one step: which table is new, and how far up its multiples go.
// `label` is the stage a parent sees; the row's own table and reach make the detail.

export const LADDER = (() => {
  const L = [];
  const add = (table, upTo, label) => L.push({ kind: 'rule', table, upTo, label });
  const A = '2s, 10s and 5s up to x5', B = '2s, 10s and 5s up to x10', C = 'Adding the 3s and 4s';
  const D = 'Adding the 9s and 11s', E = 'Adding the 6s and 8s', F = 'Adding the 7s and 12s';
  add(2, 5, A); add(10, 5, A); add(5, 5, A);
  add(2, 10, B); add(10, 10, B); add(5, 10, B);
  add(3, 5, C); add(3, 10, C); add(4, 5, C); add(4, 10, C);
  add(9, 5, D); add(9, 10, D);
  add(11, 10, D);   // the 11s are twin digits up to x9, so one step covers them
  add(6, 5, E); add(6, 10, E); add(8, 5, E); add(8, 10, E);
  add(7, 5, F); add(7, 10, F); add(12, 5, F); add(12, 10, F);
  L.push({ kind: 'rule', table: 0, upTo: 12, label: 'Every table up to x12' });          // table 0 = all of them, mixed
  L.push({ kind: 'missing', table: 0, upTo: 10, label: 'Missing numbers (7 x ? = 56)' });
  L.push({ kind: 'missing', table: 0, upTo: 12, label: 'Missing numbers up to x12' });
  return L;
})();

const MIXED_STEP = LADDER.findIndex(r => r.table === 0) + 1;   // the first step where every table is open, up to x12

// The tables open at a step (every table the ladder has reached so far).
export function tablesAt(step) {
  if (step >= MIXED_STEP) return ORDER.slice();
  const out = [];
  for (let i = 0; i < step && i < LADDER.length; i++) {
    const t = LADDER[i].table;
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

// How far up a table's multiples go at a step (5, 10 or 12), or 0 if the table isn't open yet.
export function reachAt(table, step) {
  if (step >= MIXED_STEP) return 12;
  let r = 0;
  for (let i = 0; i < step && i < LADDER.length; i++) if (LADDER[i].table === table) r = Math.max(r, LADDER[i].upTo);
  return r;
}

// The ladder step a table at a reach comes from: a measure of how hard that material is.
export function stepOf(table, reach) {
  if (reach >= 12) return MIXED_STEP;
  const i = LADDER.findIndex(r => r.table === table && r.upTo === reach);
  if (i >= 0) return i + 1;
  const j = LADDER.findIndex(r => r.table === table);
  return j >= 0 ? j + 1 : 1;
}

// A small seeded random-number maker, for tests and rigs that need the same waves every run.
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

// ---------------------------------------------------------------------------------------------
// Number helpers.

function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
// 24 -> 42. Only two-digit numbers that don't end in 0 (10 -> 1 isn't a look-alike), and never itself.
function swapDigits(n) {
  if (n < 10 || n > 99 || n % 10 === 0) return 0;
  const s = (n % 10) * 10 + Math.floor(n / 10);
  return s === n ? 0 : s;
}
function word(n) { return WORDS[n] || String(n); }

// Two whole numbers from 2 to 12 that multiply to n, preferring a pair that uses `near` (a table
// next door), or null if there is none. 24 -> [4, 6].
function factorPair(n, avoid, near = []) {
  const pairs = [];
  for (let a = 2; a <= 12; a++) {
    if (n % a) continue;
    const b = n / a;
    if (b < a || b > 12 || a === avoid || b === avoid) continue;
    pairs.push([a, b]);
  }
  if (!pairs.length) return null;
  return pairs.find(([a, b]) => near.includes(a) || near.includes(b)) || pairs[pairs.length - 1];
}

// ---------------------------------------------------------------------------------------------
// The skip-count line shown after a miss: the table's multiples up to just past `mark`, with the
// wrong number in brackets at its place. Long lines start from a known anchor (x5 or x10).
//   skipLine(6, 27) -> [6, 12, 18, 24, '(27)', 30]
//   skipLine(7, 66) -> [35, 42, 49, 56, 63, '(66)', 70]   anchor 7 x 5 = 35

export function skipLine(t, mark, upto = null, bracketMultiple = false) {
  const end = upto != null ? upto : (mark % t === 0 ? mark : (Math.floor(mark / t) + 1) * t);
  const last = Math.max(1, Math.round(end / t));
  let start = 1;
  if (last > 7) start = last - 10 >= 2 ? 10 : last - 5 >= 2 && last - 5 <= 6 ? 5 : Math.max(1, last - 6);
  if (mark != null && mark < start * t) start = Math.max(1, Math.floor(mark / t));
  const out = [];
  let placed = mark == null || (mark % t === 0 && !bracketMultiple);
  for (let k = start; k <= last; k++) {
    const m = k * t;
    if (!placed && mark < m && mark % t !== 0) { out.push(`(${mark})`); placed = true; }
    if (!placed && bracketMultiple && mark === m) { out.push(`(${m})`); placed = true; continue; }
    out.push(m);
  }
  if (!placed) out.push(`(${mark})`);
  return { skip: out, anchor: start > 1 ? `${t} ${TIMES} ${start} = ${t * start}` : null };
}

// The hint for a table: a divisibility rule where there is a neat one, counting on from an anchor
// where there isn't (7s, 8s, 12s).
export function hintFor(t, reach = 10) {
  const count = (from, n) => { const a = []; for (let k = from; k < from + n; k++) a.push(k * t); return a.join(', '); };
  switch (t) {
    case 2: return 'The 2-herd ends in 0, 2, 4, 6 or 8.';
    case 10: return 'The 10-herd ends in 0.';
    case 5: return 'The 5-herd ends in 0 or 5.';
    case 3: return 'Add up the digits. If that sum is in the 3-herd, so is the number (27: 2 + 7 = 9).';
    case 9: return 'Add up the digits. In the 9-herd they always make 9, or 18 for 99 (63: 6 + 3 = 9).';
    case 4: return 'Halve it, then halve it again. Nothing left over? It is in the 4-herd (28, then 14, then 7).';
    case 6: return 'Even, and the digits add up to a number in the 3-herd (42: even, and 4 + 2 = 6).';
    case 11: return 'Up to 99 the 11-herd has twin digits: 22, 33, 44. After that: 110, 121, 132.';
    default:
      if (reach <= 5) return `Count by ${t}s: ${count(1, 5)}.`;
      return `Count on from ${t} ${TIMES} 5 = ${5 * t}: ${count(6, reach >= 12 ? 7 : 5)}.`;
  }
}

// ---------------------------------------------------------------------------------------------
// Candidate wrong numbers of one kind for table t, between lo and hi. Returns two lists: the best
// fits first, then weaker fits to fall back on. Never returns a multiple of t.

function candidates(kind, t, lo, hi, goods) {
  const A = [], B = [];
  const seen = new Set();
  const push = (list, n) => {
    if (!Number.isInteger(n) || n < 1 || n < lo || n > hi || n % t === 0 || seen.has(n)) return;
    seen.add(n); list.push(n);
  };
  if (kind === 'far') {
    // Clearly out: no shared factor with the table, not a look-alike, as far from a multiple as the
    // table allows, and odd for the even tables.
    const want = Math.max(1, Math.ceil(Math.floor(t / 2) * 0.6));
    for (let n = lo; n <= hi; n++) {
      if (n % t === 0 || (t % 2 === 0 && n % 2 === 0)) continue;
      if (gcd(n, t) !== 1 || (t < 10 && n % 10 === t)) continue;
      const d = Math.min(n % t, t - (n % t));
      push(d >= want ? A : B, n);
    }
  } else if (kind === 'neighbour') {
    for (const a of [t - 1, t + 1]) if (a >= 2 && a <= 12) for (let b = 2; b <= 12; b++) push(A, a * b);
    for (const a of [t - 2, t + 2]) if (a >= 2 && a <= 12) for (let b = 2; b <= 12; b++) push(B, a * b);
  } else if (kind === 'near') {
    for (const g of goods) for (const d of [1, -1, 2, -2]) push(A, g + d);
    for (let m = t; m <= hi + 2; m += t) for (const d of [1, -1, 2, -2]) push(B, m + d);
  } else if (kind === 'parity') {
    for (let n = lo; n <= hi; n++) if (n % 2 === 0) push(A, n);
  } else if (kind === 'shared') {
    const fs = [];
    for (let f = t - 1; f >= 2; f--) if (t % f === 0) fs.push(f);   // biggest factor first: 4s among the 8s
    fs.forEach((f, i) => { for (let n = f; n <= hi; n += f) push(i === 0 ? A : B, n); });
  } else if (kind === 'lookalike') {
    const ends = new Set(goods.map(g => g % 10));
    if (t < 10) ends.add(t);
    for (let n = lo; n <= hi; n++) if (ends.has(n % 10)) push(A, n);
    for (const g of goods) push(A, swapDigits(g));
    if (t === 11) {
      for (let n = Math.max(lo, 10); n <= Math.min(hi, 99); n++) if (Math.abs(Math.floor(n / 10) - (n % 10)) === 1) push(A, n);
      push(A, 101); push(A, 111);
    }
  } else {   // 'other': anything that isn't in the herd
    for (let n = lo; n <= hi; n++) push(A, n);
  }
  return [A, B];
}

// The kinds of designed trap that make sense for a table.
function kindsFor(t) {
  const k = ['neighbour', 'near'];
  if (t % 2 === 0 && t !== 2) k.push('parity');
  let composite = false;
  for (let f = 2; f < t; f++) if (t % f === 0) composite = true;
  if (composite && t !== 4) k.push('shared');   // for the 4s, "shared" would be the same list as "parity"
  // For the 2s, 5s and 10s every number that ends like a herd number IS in the herd, so the only
  // look-alikes left are swapped digits (51 for 15), and those all sit above the herd's biggest
  // number: they would teach "big means stray" instead of the table.
  if (t !== 2 && t !== 5 && t !== 10) k.push('lookalike');
  return k;
}

// ---------------------------------------------------------------------------------------------
// The trainer.

const isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

// Fill in whatever the saved object is missing, and repair anything that isn't the right shape.
function fill(S) {
  S.v = 1;
  S.step = clampInt(num(S.step, 1), 1, LADDER.length);
  S.placed = S.placed === true;
  S.streak = clampInt(num(S.streak, 0), 0, 99);
  S.placeMisses = clampInt(num(S.placeMisses, 0), 0, 9);   // misses so far on the first-visit climb
  S.clock = Math.max(0, Math.floor(num(S.clock, 0)));       // answers ever recorded; the comeback timer counts these
  S.waves = Math.max(0, Math.floor(num(S.waves, 0)));
  S.session = Math.max(0, Math.floor(num(S.session, 0)));
  S.warmups = clampInt(num(S.warmups, 0), 0, 2);
  S.sinceReview = clampInt(num(S.sinceReview, 0), 0, 99);
  S.lastMain = typeof S.lastMain === 'string' ? S.lastMain : null;
  S.lastTable = typeof S.lastTable === 'number' ? S.lastTable : null;
  S.lastCard = typeof S.lastCard === 'string' ? S.lastCard : null;
  S.lastAt = num(S.lastAt, 0);
  delete S.backTurn; delete S.intro; delete S.introTable;   // an older build's turn-keeping, no longer used
  if (!isObj(S.tables)) S.tables = {};
  for (const k of Object.keys(S.tables)) {
    const r = S.tables[k];
    if (!isObj(r)) { delete S.tables[k]; continue; }
    r.waves = num(r.waves, 0); r.right = num(r.right, 0); r.wrong = num(r.wrong, 0); r.upTo = num(r.upTo, 0);
    r.lastMain = typeof r.lastMain === 'string' ? r.lastMain : null;
  }
  if (!isObj(S.traps)) S.traps = {};
  for (const k of Object.keys(S.traps)) {
    const r = S.traps[k];
    if (!isObj(r)) { delete S.traps[k]; continue; }
    r.seen = num(r.seen, 0); r.fooled = num(r.fooled, 0);
  }
  const tidy = x => {
    x.n = typeof x.n === 'number' ? x.n : null; x.a = typeof x.a === 'number' ? x.a : null;
    x.trap = typeof x.trap === 'string' ? x.trap : 'other';
    if ('due' in x || !('sess' in x)) x.due = num(x.due, 0);
    if ('sess' in x) { x.sess = num(x.sess, 0); x.misses = num(x.misses, 1); }
    return x;
  };
  const okItem = x => isObj(x) && (x.kind === 'rule' ? typeof x.n === 'number' : x.kind === 'missing' && typeof x.a === 'number') && typeof x.t === 'number';
  S.soon = Array.isArray(S.soon) ? S.soon.filter(okItem).map(tidy).slice(-SOON_KEEP) : [];
  S.review = Array.isArray(S.review) ? S.review.filter(okItem).map(tidy).slice(-REVIEW_KEEP) : [];
  if (!(isObj(S.cur) && Array.isArray(S.cur.targets) && typeof S.cur.table === 'number')) S.cur = null;
  if (S.cur) {
    S.cur.downs = clampInt(num(S.cur.downs, 0), 0, 99);   // steps this wave has already moved the kid down
    S.cur.held = S.cur.held === true;                     // first visit: a slip in this wave stopped its climb
  }
  return S;
}

// state: rider.topics.times (filled in and changed in place). opts: { rand, now, newSession } for
// tests and rigs: a seeded random maker, a clock, and a way to force a new session.
export function makeTimes(state, opts = {}) {
  const S = fill(isObj(state) ? state : {});
  const R = typeof opts.rand === 'function' ? opts.rand : Math.random;
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();

  // ----- small random helpers (all randomness goes through R so a seeded run repeats exactly)
  const pick = arr => arr[Math.floor(R() * arr.length)];
  function pickW(arr, w) {
    let sum = 0;
    const ws = arr.map(x => { const v = Math.max(0, w(x)); sum += v; return v; });
    if (sum <= 0) return pick(arr);
    let r = R() * sum;
    for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r < 0) return arr[i]; }
    return arr[arr.length - 1];
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  const tab = t => (S.tables[t] ||= { waves: 0, right: 0, wrong: 0, upTo: 0, lastMain: null });
  const trapStat = k => (S.traps[k] ||= { seen: 0, fooled: 0 });
  const row = () => LADDER[S.step - 1];

  // ----- sessions

  function newSession() {
    S.session++;
    S.warmups = S.placed && S.waves > 0 ? 2 : 0;
    S.sinceReview = 0;
    // Last session's misses come back early this session (after the warm-ups): the most-missed
    // ten, newest first among equals. The rest wait for a later session.
    const order = S.review.map((r, i) => ({ r, i })).sort((x, y) => (y.r.misses || 1) - (x.r.misses || 1) || y.i - x.i);
    S.soon = order.slice(0, 10).map(({ r }) => ({ kind: r.kind, t: r.t, n: r.n ?? null, a: r.a ?? null, trap: r.trap || 'other', due: S.clock }));
    // Misses from a table other than the step's own get the first turn after the warm-ups (the own
    // table's ride in with its next wave anyway).
    const own = LADDER[S.step - 1].table, open = tablesAt(S.step);
    if (S.soon.some(x => x.kind === 'rule' && x.t !== own && open.includes(x.t))) S.sinceReview = 3;
    S.lastAt = now();
  }

  // ----- choosing what the next wave is about

  function accuracy(t) { const r = tab(t); return (r.right + 1) / (r.right + r.wrong + 2); }

  function focusPlan(extra = {}) {
    const r = row();
    if (r.kind === 'missing') return { kind: 'missing', upTo: r.upTo, ...extra };
    if (r.table === 0) {
      // Every table is open: lean on the hard ones, and on any with numbers waiting to come back.
      const waiting = t => S.soon.some(x => x.kind === 'rule' && x.t === t);
      const t = pickW(ORDER.filter(x => x !== S.lastTable), x => (HARD_TABLES[x] || 1) * (waiting(x) ? 3 : 1));
      return { kind: 'rule', table: t, reach: 12, ...extra };
    }
    return { kind: 'rule', table: r.table, reach: r.upTo, newRange: r.upTo > 5, ...extra };
  }

  function reviewPlan(open, focusTable) {
    let pool = open.filter(t => t !== focusTable && t !== S.lastTable);
    if (!pool.length) pool = open.filter(t => t !== focusTable);
    if (!pool.length) return null;
    const missed = t => S.review.filter(r => r.t === t).length;
    const t = pickW(pool, x => (HARD_TABLES[x] || 1) + Math.min(3, missed(x)) + (1 - accuracy(x)) * 2);
    return { kind: 'rule', table: t, reach: Math.max(5, reachAt(t, S.step)), review: true };
  }

  function plan() {
    const r = row();
    const open = tablesAt(S.step);

    // Two easy warm-ups at the start of a session, from well below the kid's step.
    if (S.warmups > 0 && S.placed) {
      S.warmups--;
      const ws = Math.max(1, S.step - 3);
      const pool = tablesAt(ws);
      const t = pickW(pool, x => accuracy(x) ** 3 + (x === S.lastTable ? 0 : 0.2));
      return { kind: 'rule', table: t, reach: Math.max(5, reachAt(t, ws)), warmup: true, stage: 'easy' };
    }

    // First visit: always the step's own material, so each climb is tested on the new step.
    if (!S.placed) return focusPlan({ placing: true });

    // After that the tables take turns: two waves on the step's own material, then one on another
    // open table. Mixed practice is what sticks (in a classroom trial, 61% against 38% on a test a
    // month later), and a kid who slips once a wave would otherwise get the same table forever.
    // A table that has just opened joins in the same way; its first waves come slowly and with the
    // clearly-wrong strays, which is the gentle start it needs. Numbers that fooled the kid ride
    // back in with the next wave of their own table; the other table's turn goes first to a table
    // with numbers waiting, so a pile of misses from many tables comes back steadily without taking
    // over the session (and last session's misses come right after the warm-ups).
    const own = r.kind === 'rule' ? r.table : 0;
    S.sinceReview++;
    if (open.length >= 2 && S.sinceReview >= 3) {
      const waiting = [];
      for (const x of S.soon) if (x.kind === 'rule' && x.t !== own && open.includes(x.t) && !waiting.includes(x.t)) waiting.push(x.t);
      const t = waiting.find(x => x !== S.lastTable) ?? waiting[0];
      if (t) { S.sinceReview = 0; return { kind: 'rule', table: t, reach: Math.max(5, reachAt(t, S.step)), review: true }; }
      const p = reviewPlan(open, own);
      if (p) { S.sinceReview = 0; return p; }
    }
    return focusPlan();
  }

  // ----- building a wave

  function wave({ count = 10 } = {}) {
    closeWave();
    count = clampInt(num(count, 10), 2, 40);
    // A long break with the game left open (or the trainer kept from an earlier ride) starts a new
    // session too: warm-ups, and last session's misses.
    if (S.lastAt && now() - S.lastAt > SESSION_GAP_MS) newSession();
    S.lastAt = now();
    const p = plan();
    const w = p.kind === 'missing' ? missingWave(p, count) : ruleWave(p, count);
    S.waves++;
    return w;
  }

  // How likely each multiplier is to be in the herd: small ones while the table is new, the newly
  // added big ones once the reach grows.
  function multiplierWeight(m, reach, p) {
    if (reach <= 5) return m === 1 ? 0.35 : 1;
    if (reach <= 10) return m === 1 ? 0.15 : m <= 5 ? (p.newRange ? 0.55 : 0.85) : 1.3;
    return m === 1 ? 0.1 : m <= 10 ? 1 : 1.6;
  }

  function ruleWave(p, count) {
    const t = p.table, reach = p.reach;
    const tb = tab(t);
    const stage = p.stage || (reach <= 5 && tb.waves < (EASY_WAVES[t] || 2) && (!p.placing || S.step <= 3) ? 'easy' : 'designed');
    const fresh = !p.warmup && (tb.waves < 3 || reach > tb.upTo);
    const nGood = Math.max(1, Math.min(count - 1, Math.round(count / 2), reach <= 5 ? reach - 1 : reach));
    const nTraps = count - nGood;

    // Numbers that fooled the kid and are waiting to come back (not in warm-ups: those stay easy).
    const backs = p.warmup ? [] : S.soon.filter(x => x.kind === 'rule' && x.t === t);

    // The herd: multipliers, with the true neighbour of each returning stray included.
    const ms = [];
    for (const b of backs) {
      if (ms.length >= Math.ceil(nGood / 2)) break;
      const m = Math.max(1, Math.min(reach, Math.round(b.n / t)));
      if (!ms.includes(m)) ms.push(m);
    }
    const pool = [];
    for (let m = 1; m <= reach; m++) pool.push(m);
    while (ms.length < nGood) {
      const free = pool.filter(m => !ms.includes(m));
      ms.push(pickW(free.length ? free : pool, m => multiplierWeight(m, reach, p)));
    }
    const goods = ms.map(m => m * t);

    // The strays sit among the herd's sizes, so "big means stray" never works.
    let lo = Math.max(1, t * (Math.min(...ms) - 1) + 1);
    let hi = t * Math.max(...ms) + t - 1;
    const used = new Set(goods);
    const traps = [];
    const put = (n, trap, back) => { used.add(n); traps.push({ n, good: false, trap, back: !!back }); };

    // Returning numbers first, up to half the strays.
    for (const b of backs) {
      if (traps.length >= Math.ceil(nTraps / 2)) break;
      S.soon.splice(S.soon.indexOf(b), 1);
      if (used.has(b.n) || b.n % t === 0) continue;   // not a stray for this table after all: drop it
      put(b.n, b.trap || 'other', true);
    }

    function take(kind, k) {
      let got = 0;
      while (got < k) {
        const [A, B] = candidates(kind, t, lo, hi, goods);
        const a = A.filter(n => !used.has(n)), b = B.filter(n => !used.has(n));
        if (!a.length && !b.length) break;
        // Mostly the best fits, now and then a weaker one for variety; the clearly-wrong early strays
        // use the weaker fits only once the best ones run out.
        const best = a.length && (kind === 'far' || !b.length || R() < 0.8);
        put(best ? pick(a) : pick(b), kind === 'other' ? 'other' : kind);
        got++;
      }
      return got;
    }
    function widen() {
      const top = t * (reach + 3);
      if (lo > 1 || hi < t * reach + t - 1) { lo = 1; hi = Math.max(hi, t * reach + t - 1); return true; }
      if (hi < top) { hi += t; return true; }
      return false;
    }

    let main = null;
    if (stage === 'easy') {
      let guard = 0;
      while (traps.length < nTraps && guard++ < 20) {
        take('far', nTraps - traps.length);
        if (traps.length < nTraps && !widen()) take('other', nTraps - traps.length);
      }
    } else {
      // Pick this wave's main kind of trap: never the same as the last wave's, and a little more of
      // whatever fools this kid.
      const kinds = kindsFor(t);
      const have = {};
      for (const k of kinds) have[k] = candidates(k, t, lo, hi, goods)[0].filter(n => !used.has(n)).length;
      // In order of preference. The wave-to-wave change is what the kid sees, so it comes first
      // (even over having plenty of that kind to hand); then a change from this table's last wave;
      // then plenty to choose from.
      const changed = k => k !== S.lastMain, changedHere = k => k !== tb.lastMain;
      const tiers = [
        k => changed(k) && changedHere(k) && have[k] >= 2,
        k => changed(k) && have[k] >= 2,
        k => changed(k) && changedHere(k) && have[k] >= 1,
        k => changed(k) && have[k] >= 1,
        k => have[k] >= 1,
        () => true,
      ];
      let choice = [];
      for (const ok of tiers) { choice = kinds.filter(ok); if (choice.length) break; }
      main = pickW(choice, k => { const s = trapStat(k); return 0.5 + 3 * (s.fooled + 1) / (s.seen + 5); });

      // The main kind takes about half the strays (reaching a little wider for them if it must),
      // and no other kind outnumbers it.
      const want = Math.ceil((nTraps - traps.length) / 2);
      let mainGot = take(main, want);
      while (mainGot < want && widen()) mainGot += take(main, want - mainGot);
      const others = shuffle(kinds.filter(k => k !== main));
      const howMany = k => traps.filter(x => x.trap === k && !x.back).length;
      let guard = 0;
      while (traps.length < nTraps && guard++ < 60) {
        let got = 0;
        for (const k of others) { if (traps.length < nTraps && howMany(k) < howMany(main)) got += take(k, 1); }
        if (traps.length < nTraps && !got) got += take(main, 1);
        if (traps.length < nTraps && !got) got += widen() ? 1 : 0;
        if (traps.length < nTraps && !got) for (const k of others) { if (traps.length < nTraps) got += take(k, 1); }
        if (traps.length < nTraps && !got) take('other', nTraps - traps.length);
      }
      breakShortcuts(t, goods, traps, used, lo, hi);
      tb.lastMain = main;
      S.lastMain = main;
    }

    const targets = shuffle([...goods.map(n => ({ n, good: true, trap: null, back: false })), ...traps]);
    tb.waves++;
    tb.upTo = Math.max(tb.upTo, reach);
    S.lastTable = t;
    const hard = stepOf(t, reach);
    S.cur = {
      id: S.waves + 1, kind: 'rule', table: t, reach, step: S.step, hard, stage, main,
      warmup: !!p.warmup, review: !!p.review, placing: !!p.placing, closed: false, downs: 0,
      targets: targets.map(x => ({ n: x.n, good: x.good, trap: x.trap, back: x.back, done: 0 })),
    };
    return {
      id: S.cur.id, kind: 'rule', table: t, rule: `Rope the ${t}-herd`,
      targets: targets.map(x => ({ n: x.n, good: x.good, trap: x.trap, ...(x.back ? { back: true } : {}) })),
      step: S.step, hard, reach, stage, main, warmup: !!p.warmup, review: !!p.review, placing: !!p.placing, fresh,
    };
  }

  // Make sure neither "odd/even" nor "last digit" sorts this wave's herd from its strays. For the
  // 2s, 5s and 10s the last digit IS the real rule (and the hint teaches it), so only the odd/even
  // check applies there, and the 2s can't have an even stray at all.
  function breakShortcuts(t, goods, traps, used, lo, hi) {
    const replaceable = () => {
      const free = traps.filter(x => !x.back);
      return free.length ? free[free.length - 1] : null;
    };
    const fromAny = test => {
      for (const k of [...kindsFor(t), 'other']) {
        const [A, B] = candidates(k, t, lo, hi, goods);
        const list = [...A, ...B].filter(n => !used.has(n) && test(n));
        if (list.length) return { n: pick(list), trap: k };
      }
      return null;
    };
    const swap = (victim, c) => {
      if (!victim || !c) return;
      used.delete(victim.n); used.add(c.n);
      victim.n = c.n; victim.trap = c.trap;
    };
    // Odd/even: if every herd number has the same parity, at least one stray must share it.
    const par = new Set(goods.map(g => g % 2));
    if (t !== 2 && par.size === 1) {
      const p = [...par][0];
      if (!traps.some(x => x.n % 2 === p)) swap(replaceable(), fromAny(n => n % 2 === p));
    }
    // Last digit: at least one stray must end in a digit some herd number ends in.
    if (t !== 2 && t !== 5 && t !== 10) {
      const ends = new Set(goods.map(g => g % 10));
      if (!traps.some(x => ends.has(x.n % 10))) {
        // A number ending like a herd number has that herd number's parity, so this swap can't undo
        // the odd/even fix above.
        const c = fromAny(n => ends.has(n % 10));
        if (c) c.trap = 'lookalike';
        swap(replaceable(), c);
      }
    }
  }

  // A missing-number card: "7 x ? = 56". The herd carries the possible answers (1 to 12); one is right.
  function missingWave(p, count) {
    const upTo = p.upTo || 10;
    let card = null;
    const bi = S.soon.findIndex(x => x.kind === 'missing');
    if (bi >= 0) { card = S.soon[bi]; S.soon.splice(bi, 1); }
    let t, a;
    if (card && card.a) { t = card.t; a = card.a; }
    else {
      for (let tries = 0; tries < 4; tries++) {
        t = pickW(ORDER, x => HARD_TABLES[x] || 1);
        const as = []; for (let k = 2; k <= upTo; k++) as.push(k);
        a = pickW(as, k => (k >= 6 && k <= 9) || k >= 11 ? 1.6 : 1);
        if (`${t}x${a}` !== S.lastCard) break;
      }
    }
    S.lastCard = `${t}x${a}`;
    const prod = t * a;
    const size = Math.max(3, Math.min(count, 6));
    const used = new Set([a]);
    const traps = [];
    const put = (x, trap) => {
      if (!Number.isInteger(x) || x < 1 || x > 12 || used.has(x) || t * x === prod) return;
      used.add(x); traps.push({ n: x, good: false, trap });
    };
    // One-off answers and the number already on the card are the classic slips. The offsets are
    // picked at random, so "the middle number" is never a shortcut to the answer.
    const offs = shuffle([1, -1, 2, -2, 3, -3]);
    put(a + offs[0], 'near');
    put(t, 'given');
    for (const d of offs.slice(1)) { if (traps.length >= size - 2) break; put(a + d, 'near'); }
    for (const x of shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])) { if (traps.length >= size - 1) break; put(x, 'other'); }
    const targets = shuffle([{ n: a, good: true, trap: null, back: false }, ...traps.slice(0, size - 1).map(x => ({ ...x, back: false }))]);
    const rule = R() < 0.5 ? `${t} ${TIMES} ? = ${prod}` : `? ${TIMES} ${t} = ${prod}`;
    tab(t).waves++;
    S.lastTable = t;
    S.cur = {
      id: S.waves + 1, kind: 'missing', table: t, a, prod, rule, reach: upTo, step: S.step, hard: S.step,
      stage: 'designed', main: 'near', warmup: false, review: false, placing: !!p.placing, closed: false, downs: 0,
      targets: targets.map(x => ({ n: x.n, good: x.good, trap: x.trap, back: x.back, done: 0 })),
    };
    return {
      id: S.cur.id, kind: 'missing', table: t, rule, targets: targets.map(x => ({ n: x.n, good: x.good, trap: x.trap })),
      step: S.step, hard: S.step, reach: upTo, stage: 'designed', main: 'near', warmup: false, review: false,
      placing: !!p.placing, fresh: false,
    };
  }

  // ----- answers

  function remember(item) {
    const same = r => r.kind === item.kind && r.t === item.t && (item.kind === 'rule' ? r.n === item.n : r.a === item.a);
    const old = S.review.find(same);
    if (old) { old.sess = S.session; old.misses = (old.misses || 1) + 1; old.trap = item.trap || old.trap; }
    else S.review.push({ kind: item.kind, t: item.t, n: item.n ?? null, a: item.a ?? null, trap: item.trap || 'other', sess: S.session, misses: 1 });
    while (S.review.length > REVIEW_KEEP) S.review.shift();
  }

  // n: the number on the target the kid roped. good: whether it was a right one (the target's `good`).
  // Returns { right, step, moved (-1, 0 or +1), placed, comeback: null | { n, after } }.
  function answer(n, good) {
    const c = S.cur && !S.cur.closed ? S.cur : null;
    let x = null;
    if (c) x = c.targets.find(y => y.n === n && !y.done) || c.targets.find(y => y.n === n) || null;
    let right;
    if (typeof good === 'boolean') right = good;
    else if (x) right = x.good;
    else if (c && c.kind === 'missing') right = c.table * n === c.prod;
    else right = c ? n % c.table === 0 : false;

    S.clock++;
    S.lastAt = now();
    if (x && !x.done) x.done = right ? 1 : -1;
    if (c) { const tb = tab(c.table); if (right) tb.right++; else tb.wrong++; }

    let comeback = null;
    if (!right) {
      const trap = (x && x.trap) || 'other';
      const st = trapStat(trap); st.seen++; st.fooled++;
      const reallyWrong = c && (c.kind === 'missing' ? c.table * n !== c.prod : n % c.table !== 0);
      if (reallyWrong) {
        const after = 2 + Math.floor(R() * 3);   // comes back 2 to 4 answers later
        const item = c.kind === 'missing'
          ? { kind: 'missing', t: c.table, a: c.a, n, trap, due: S.clock + after }
          : { kind: 'rule', t: c.table, n, a: null, trap, due: S.clock + after };
        S.soon = S.soon.filter(s => !(s.kind === item.kind && s.t === item.t && (item.kind === 'rule' ? s.n === n : s.a === item.a)));
        S.soon.push(item);
        while (S.soon.length > SOON_KEEP) S.soon.shift();
        remember(item);
        comeback = { n, after };
      }
    }

    const before = S.step;
    if (c && (c.warmup || c.review)) {
      // Warm-ups and the other tables' turns sit below the kid's step; they never move it. The
      // ladder is judged on the step's own material only, so that material settles near 80% right
      // (with the reviews counted in, about 84 to 87%). A slip on an older table brings that table
      // back on the next other-table turn instead of a step down.
    } else if (!S.placed) {
      // First visit: a step per right answer. One slip is forgiven (a misclick shouldn't park a
      // teenager on the 2s): the kid goes back to the step this wave was dealt at (the right
      // answers before the slip climbed past steps it hasn't been tested on yet), the rest of the
      // wave doesn't climb, and the next wave tests that step again. The climb ends at the second
      // miss, which settles the kid PLACE_BELOW (2) steps below the step that wave was dealt at.
      // On average that lands simulated kids about where they go on to settle; a single kid can land
      // a few steps off either way (see PLACE_BELOW), and the next waves move it a step at a time.
      const missAt = c ? c.step : S.step;
      if (right) {
        if (!(c && c.held)) S.step = Math.min(LADDER.length, S.step + 1);
        if (S.step === LADDER.length) S.placed = true;   // reached the top: nothing left to find
      } else {
        S.placeMisses++;
        S.streak = 0;
        if (S.placeMisses >= PLACEMENT_MISSES) {
          S.placed = true;
          S.step = Math.max(1, missAt - PLACE_BELOW);
          if (c) c.downs = MAX_DOWN_PER_WAVE;   // that was this wave's step down
        } else {
          S.step = missAt;
          if (c) c.held = true;
        }
      }
    } else if (right) {
      S.streak++;
      if (S.streak >= CLEAN_TO_CLIMB) { S.step = Math.min(LADDER.length, S.step + 1); S.streak = 0; }
    } else {
      // A miss resets the run of rights. It moves the kid down a step, but only once a wave: a
      // rough wave (several misses) can't drop a kid from the 8s to the 3s.
      S.streak = 0;
      if (!c || (c.downs || 0) < MAX_DOWN_PER_WAVE) {
        S.step = Math.max(1, S.step - 1);
        if (c) c.downs = (c.downs || 0) + 1;
      }
    }
    return { right, step: S.step, moved: Math.sign(S.step - before), placed: S.placed, comeback };
  }

  // Strays that fooled the kid and are due back now (2 to 4 answers after the miss), for the
  // current wave. Call it after each answer. Each one returned is { n, good: false, trap, back: true }:
  // if the steer that carried n is still standing in the herd (tangled), make it ropeable again;
  // otherwise bring in a new steer with n. Anything not taken here rides in with the next wave of
  // that table instead.
  function due() {
    const c = S.cur;
    if (!c || c.closed || c.kind !== 'rule') return [];
    if (c.targets.every(y => !y.good || y.done === 1)) return [];   // every right one is roped: the wave is over
    const out = [];
    S.soon = S.soon.filter(s => {
      if (s.kind !== 'rule' || s.t !== c.table || s.due > S.clock) return true;
      if (s.n % c.table === 0) return false;
      const old = c.targets.find(y => y.n === s.n);
      if (old && !old.done) return false;   // already standing in the herd, ropeable
      if (old) { old.done = 0; old.back = true; }   // the tangled steer gets another turn
      else c.targets.push({ n: s.n, good: false, trap: s.trap || 'other', back: true, done: 0 });
      out.push({ n: s.n, good: false, trap: s.trap || 'other', back: true });
      return false;
    });
    return out;
  }

  // Close the current wave (wave() does this itself). Strays the kid left alone in a finished wave
  // count as seen-and-not-fooled; last session's misses that were left alone are done with.
  function closeWave() {
    const c = S.cur;
    if (!c || c.closed) return;
    c.closed = true;
    const finished = c.targets.every(y => !y.good || y.done === 1);
    if (!finished) return;
    for (const y of c.targets) if (!y.good && !y.done) trapStat(y.trap || 'other').seen++;
    const clean = !c.targets.some(y => y.done === -1);
    S.review = S.review.filter(r => {
      if (r.sess >= S.session || r.t !== c.table) return true;
      if (r.kind === 'rule' && c.kind === 'rule') return !c.targets.some(y => y.n === r.n && !y.done);
      if (r.kind === 'missing' && c.kind === 'missing') return !(r.a === c.a && clean);
      return true;
    });
  }

  // ----- words for the kid

  // The fact behind a right number, written a few different ways (24 = 4 x 6, 6 x 4 = 24, ...).
  function fact(n, table) {
    const t = table || (S.cur && S.cur.table) || row().table || 2;
    if (n % t !== 0) return null;
    const m = n / t;
    const forms = [`${n} = ${m} ${TIMES} ${t}`, `${t} ${TIMES} ${m} = ${n}`, `${m} ${TIMES} ${t} = ${n}`];
    if (S.step >= 10) {
      const other = factorPair(n, t);
      if (other && !(other[0] === m || other[1] === m)) forms.push(`${m} ${TIMES} ${t} = ${other[0]} ${TIMES} ${other[1]}`);
    }
    return forms[S.clock % forms.length];
  }

  // explain(n) -> { line, skip, anchor, also, good }. After a miss: one plain line and the skip-count
  // list with the wrong number in brackets at its place. For a right number: the fact and the count.
  function explain(n, table) {
    const c = S.cur;
    if (c && c.kind === 'missing' && table == null) {
      const t = c.table, a = c.a, p = c.prod;
      if (n === a) {
        const s = skipLine(t, p);
        return { good: true, line: `${t} ${TIMES} ${a} = ${p}`, skip: s.skip, anchor: s.anchor, also: null };
      }
      const prod = t * n, d = Math.abs(n - a);
      const line = `${t} ${TIMES} ${n} = ${prod}, ${word(d).toLowerCase()} ${t}${d > 1 ? 's' : ''} ${n > a ? 'too many' : 'short'}`;
      const s = skipLine(t, prod, Math.max(prod, p), true);
      return { good: false, line, skip: s.skip, anchor: s.anchor, also: null };
    }
    const t = table || (c && c.table) || row().table || 2;
    if (n % t === 0) {
      const s = skipLine(t, n);
      return { good: true, line: fact(n, t), skip: s.skip, anchor: s.anchor, also: null, sacks: n / t, per: t };
    }
    const prev = Math.floor(n / t) * t, next = prev + t;
    const d1 = n - prev, d2 = next - n;
    let line;
    if (prev === 0) line = `${word(d2)} short of ${t}, not in the ${t}-herd`;
    else if (d1 <= d2) line = `${word(d1)} past ${prev}, not in the ${t}-herd`;
    else line = `${word(d2)} short of ${next}, not in the ${t}-herd`;
    const s = skipLine(t, n);
    const pair = factorPair(n, t, [t - 1, t + 1]);
    return { good: false, line, skip: s.skip, anchor: s.anchor, also: pair ? `${n} is ${pair[0]} ${TIMES} ${pair[1]}` : null };
  }

  function hint(table) {
    const c = S.cur;
    if (c && c.kind === 'missing' && table == null) return `Count by ${c.table}s until you reach ${c.prod}. How many ${c.table}s did it take?`;
    const t = table || (c && c.table) || row().table || 2;
    return hintFor(t, (c && c.table === t && c.reach) || reachAt(t, S.step) || 10);
  }

  // ----- for parents and dev tools

  function level() {
    const r = row();
    const detail = r.table ? `the ${r.table}s up to x${r.upTo}` : r.kind === 'missing' ? `missing numbers up to x${r.upTo}` : 'every table up to x12';
    return {
      step: S.step, of: LADDER.length, label: r.label, detail, placing: !S.placed, tables: tablesAt(S.step),
      line: `Step ${S.step} of ${LADDER.length}: ${r.label} (now ${detail})${S.placed ? '' : ', still finding the starting step'}`,
    };
  }

  function report() {
    return {
      level: level(), sessions: S.session, waves: S.waves, answers: S.clock,
      tables: ORDER.filter(t => S.tables[t]).map(t => ({ table: t, waves: S.tables[t].waves, right: S.tables[t].right, wrong: S.tables[t].wrong })),
      traps: Object.fromEntries(Object.entries(S.traps).map(([k, v]) => [k, { seen: v.seen, fooled: v.fooled }])),
      missed: S.review.map(r => (r.kind === 'rule' ? `${r.n} among the ${r.t}s` : `${r.t} ${TIMES} ? = ${r.t * r.a}`)),
    };
  }

  // Dev shortcut: jump to a step (counts as placed, so it stays put until the answers move it).
  function setStep(step) {
    S.step = clampInt(num(step, 1), 1, LADDER.length);
    S.placed = true; S.streak = 0; S.warmups = 0;
  }

  if (opts.newSession || !S.lastAt || now() - S.lastAt > SESSION_GAP_MS) newSession();

  return {
    topic: 'times', name: 'Times tables', state: S,
    wave, answer, due, endWave: closeWave, explain, hint, level, fact, report, setStep, newSession,
  };
}
