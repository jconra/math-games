// The card trainer behind the early topics: Counting, Adding and Taking away (src/math/counting.js, adding.js and
// taking.js). Each of those files says what its cards are: the ladder of steps, how a problem is made, the real slips
// kids make on it (every wrong answer on a card is one of them, never a random number), the one plain line that says
// why a wrong pick is wrong, and the picture that helps (src/ui/counthelp.js: ten-frames, and a number line with a hop
// for every step). This file keeps the rest, the same way the positive & negative trainer does (src/math/negatives.js):
//
//   - A wave is a few cards (3), played one after another. Each card brings its own small herd of answers: one right.
//   - The step moves with the answers, one card at a time (only the first try at a card counts):
//       3 clean cards in a row on the kid's own step move up a step (review cards and comebacks don't count toward it);
//       a miss moves down a step, at most once a wave. Nothing else is taken away: no gold, no lives.
//   - On a kid's first visit the step climbs after every clean card. One slip is forgiven; the climb ends at the second
//     miss, PLACE_BELOW steps below where the kid had got to (an older kid isn't kept counting dots).
//   - Each session opens with 2 easy warm-up waves from below the kid's step; they never move it.
//   - Once placed, one card in 3 comes from an earlier step (mixed practice sticks better).
//   - A missed card comes back 2 to 4 cards later (in the same wave when there is room), and again next session.
//   - A card answered right after the helper came up (8 s of thinking, or "Show me") pays as usual, but doesn't count
//     toward the climb.
//
// Everything it remembers lives in the plain object it is given (rider.topics.counting, .adding, .taking), so it saves
// as JSON with the rider, and a reload mid-wave carries on where it was. Nothing is kept anywhere else.
//
//   const T = makeCardTrainer(SPEC, state, { rand, now, newSession })
//   T.mode                          'cards': the round-up deals these one card at a time, as it does positive & negative
//   T.payEvery                      the round-up pays 1 gold more a steer for every this many steps up the ladder
//   T.wave({ count, cards })        -> { kind: 'card', rule, sub, card, cards, targets, step, hard, fresh, warmup, ... }
//                                      count: answers on a card (3 to 6, one right); cards: how many cards
//   T.card()                        the card to show now (null when the wave is done)
//   T.answer(n, good, id)           -> { right, step, moved, placed, comeback, card, waveDone, first, stale }
//   T.explain(card, n)              -> { slip, line, good, numberLine }   numberLine: the picture (src/ui/counthelp.js
//                                      draws it: it carries helper: 'count') with the answer and the pick shown
//   T.help(card)                    the picture with the answer hidden, for "Show me" or 8 s of thinking
//   T.hint(card), T.level(), T.report(), T.setStep(n), T.newSession(), T.due() (always [])
//
// A card: { id, text ('7 + 1'), rule (the rule card's words: 'Rope what comes after 7'), sub, done (the line for a right
//   pick: 'After 7 comes 8'), say, answer, parts (the problem), shape, rung, targets: [{ n, good, trap, label }], back,
//   review, helped }
//
// A topic's SPEC:
//   topic, name, LADDER: [{ shapes: [...], weights: { shape: w }, label, ... }]
//   problem(shape, row, rand)        -> p: a plain object { shape, ...its numbers } (saved, so a missed card comes back)
//   key(p)                           -> a short id ('after:7')     answerOf(p) -> the right number
//   card(p, { size, rand, avoid })   -> { text, rule, sub, done, say, answer, targets: [{ n, good, trap }] }
//   whyNot(card, n)                  -> { slip, line }   the one plain line after a wrong pick
//   nudge(card)                      -> a line for a kid who is stuck, without the answer
//   picture(card)                    -> the helper's drawing (src/ui/counthelp.js); it hides or shows the answer itself

// ---- the dials (defaults; change them here) --------------------------------------------------------------------

export const CLEAN_TO_CLIMB = 3;        // clean cards in a row (on the kid's own step) to move up a step
export const MAX_DOWN_PER_WAVE = 1;     // a rough wave can drop the kid this many steps at most
export const PLACEMENT_MISSES = 2;      // the first-visit climb ends at this many misses (one slip is forgiven)
export const PLACE_BELOW = 2;           // ... this many steps below where the kid had got to
// Simulated kids (the negatives tests' kid model, 40 kids a set, 3 seed sets; ~/pw/bandit-math/rigs/early/settle.mjs)
// settle near 81% right on their own step's cards on all three topics (80.5 to 81.9%). With 2 below, first-visit kids
// land on average 0.4 to 1.0 steps above where they settle; with 1 below, 1.3 to 1.7 above. The times tables and
// positive & negative use 2 as well (a math-lane default, not yet a final call: set 1 here to go back).
export const REVIEWS_COUNT_UP = false;  // review cards and comebacks don't count toward the 3 in a row (as negatives)
export const WARMUP_WAVES = 2;          // easy waves at the start of each session
export const WARMUP_BELOW = 2;          // how many steps below the kid's step the warm-ups come from
export const REVIEW_EVERY = 3;          // once placed, one card in this many comes from an earlier step
export const CARDS_PER_WAVE = 3;        // cards in a wave
export const TARGETS_PER_CARD = 5;      // answers on a card (one right)
export const EASY_TARGETS = 4;          // answers on warm-up cards and on a step's first cards (fewer to read)
export const COMEBACK_MIN = 2;          // a missed card comes back this many cards later...
export const COMEBACK_MAX = 4;          // ...up to this many
export const MAX_BACKS_PER_WAVE = 2;    // returning cards in one wave at most
export const SESSION_GAP_MS = 30 * 60 * 1000;   // a gap this long between answers starts a new session
export const PAY_EVERY = 3;             // the round-up pays 1 gold more a steer every this many steps up
const REVIEW_KEEP = 40;                 // missed cards kept for later sessions
const SOON_KEEP = 30;                   // missed cards waiting to come back this session

export const MINUS = '−';   // the real minus sign (U+2212)
export const numText = (n) => (n < 0 ? MINUS : '') + Math.abs(n);

// A small seeded random-number maker, for tests and rigs that need the same cards every run.
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

export const int = (lo, hi, rand) => (hi < lo ? lo : lo + Math.floor(rand() * (hi - lo + 1)));
export const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
export function pickW(arr, w, rand) {
  let sum = 0;
  const ws = arr.map((x) => { const v = Math.max(0, w(x)); sum += v; return v; });
  if (sum <= 0) return pick(arr, rand);
  let r = rand() * sum;
  for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r < 0) return arr[i]; }
  return arr[arr.length - 1];
}
export function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// A run of numbers as a kid counts it out loud: countLine(7, 10) -> '8, 9, 10'; countLine(9, 5) -> '8, 7, 6, 5'.
// Long runs keep the first two and the last two: '28, 29, … 35, 36'.
export function countLine(from, to) {
  const d = to > from ? 1 : -1, out = [];
  for (let k = from + d; d > 0 ? k <= to : k >= to; k += d) out.push(k);
  if (out.length > 6) return `${out[0]}, ${out[1]}, … ${out[out.length - 2]}, ${out[out.length - 1]}`;
  return out.join(', ');
}

// Dots as the rule card shows them, in rows of five so they can be seen at a glance: 7 -> '●●●●● ●●'.
export function dotsText(n) {
  const out = [];
  for (let k = 0; k < n; k += 5) out.push('●'.repeat(Math.min(5, n - k)));
  return out.join(' ');
}

// The hops on the helper's number line (src/ui/counthelp.js) from `from`, `delta` along (+ up, − down):
//   unitHops(8, 5)    five hops of one, numbered 1 to 5 (counting on: the kid counts the hops, not the marks)
//   chunkHops(27, 6)  +3 to the next ten, then +3;  chunkHops(36, 27) +10, +10, +4 to 40, +3;  chunkHops(52, −27) back
export function unitHops(from, delta) {
  const d = Math.sign(delta), out = [];
  for (let k = 0; k < Math.abs(delta); k++) out.push({ from: from + k * d, to: from + (k + 1) * d, label: String(k + 1) });
  return out;
}
export function chunkHops(from, delta) {
  const d = Math.sign(delta), sign = d > 0 ? '+' : MINUS, out = [];
  let left = Math.abs(delta), at = from;
  for (let k = Math.floor(left / 10); k > 0; k--) { out.push({ from: at, to: at + 10 * d, label: `${sign}10` }); at += 10 * d; }
  left %= 10;
  if (left) {
    const toTen = d > 0 ? (10 - (at % 10)) % 10 : at % 10;
    if (toTen && toTen < left) { out.push({ from: at, to: at + toTen * d, label: `${sign}${toTen}` }); at += toTen * d; left -= toTen; }
    out.push({ from: at, to: at + left * d, label: `${sign}${left}` });
  }
  return out;
}
// A stretch of number line round some numbers: a little past both ends, at least `span` wide, never below zero.
export function around(nums, { pad = 2, span = 10 } = {}) {
  let lo = Math.max(0, Math.min(...nums) - pad), hi = Math.max(...nums) + pad;
  while (hi - lo < span) { if (lo > 0 && (hi - lo) % 2) lo--; else hi++; }
  return { lo, hi };
}

// A card's answers: the right one and size − 1 wrong ones, each a real slip. `slips` lists the slips this problem
// allows as { n, trap, w }: w is how likely it is to be dealt (the likeliest slips have the biggest w).
// Where the answer sits among the numbers is picked first, at random: how many of the wrong ones are smaller than it.
// Without that, the slips themselves would give it away: adding's are mostly one short, one over and smaller numbers
// (8 + 5: 12, 14, 3, 8), so "the second biggest" was right 4 times in 5, and counting's "after 7" (7, 6, 9) made "the
// middle one" right 2 times in 3. Each side is then filled with that side's real slips (likeliest first, at random), and
// a side without enough of them is topped up with numbers two or three away from the answer. With the place picked at
// random, no rule of "the biggest", "the second smallest" or "the middle" beats a plain guess by much (see the tests).
// Numbers outside [min, max], repeats, and the number in `avoid` (the answer of the card before, so a kid can't cross it
// off as "that was the last answer") are left out.
export function pickTargets(answer, slips, size, rand, { min = 0, max = 999, avoid = null } = {}) {
  const skip = new Set((Array.isArray(avoid) ? avoid : [avoid]).filter(Number.isInteger));
  const ok = (n) => Number.isInteger(n) && n >= min && n <= max && n !== answer;
  const seen = new Set([answer]), pool = [];
  for (const s of slips) if (ok(s.n) && !seen.has(s.n)) { seen.add(s.n); pool.push({ ...s, w: (s.w ?? 1) * (skip.has(s.n) ? 0.15 : 1) }); }
  const want = Math.max(1, size - 1);
  // how many wrong numbers go below the answer (as many as there can be: small answers have few numbers below them)
  const room = Math.min(want, answer - min);
  const below = Math.floor(rand() * (Math.max(0, room) + 1));   // (spread evenly over the places it can have)
  const out = [];
  const fill = (side, k) => {
    const mine = pool.filter((x) => (side < 0 ? x.n < answer : x.n > answer));
    let got = 0;
    while (got < k && mine.length) {
      const s = pickW(mine, (x) => x.w, rand);
      mine.splice(mine.indexOf(s), 1); pool.splice(pool.indexOf(s), 1);
      out.push(s); got++;
    }
    for (let d = 2; got < k && d <= 12; d++) {
      const n = answer + side * d;
      if (ok(n) && !seen.has(n)) { seen.add(n); out.push({ n, trap: 'other' }); got++; }
    }
    return got;
  };
  const lo = fill(-1, below);
  fill(1, want - lo);
  if (out.length < want) fill(-1, want - out.length);   // (no room above: max reached)
  return shuffle([{ n: answer, good: true, trap: null }, ...out.map((s) => ({ n: s.n, good: false, trap: s.trap }))], rand)
    .map((t) => ({ ...t, label: numText(t.n) }));
}

// ---- a sum over a sick sheep ------------------------------------------------------------------------------------

// The sick-sheep job's item (src/missions/sheepmath.js) for a card topic: a fact written over a sheep ('after 6 comes
// 8', '4 + 3 = 7'). A sick sheep's fact has one real slip in it (one of the likelier ones in the topic's slipsOf); a
// healthy sheep's is right. The bottles are fixes ("should be 7"): on a sick sheep one is the cure and the others are
// other real slips; on a healthy one all are slips, so the bottles never give away which sheep is sick. The picture
// is the topic's helper (help.kind 'count': src/ui/counthelp.js draws it).
//   SPEC.sheepText(p, valueText) writes the fact; SPEC.sheepProblem(row, rand) (optional) picks the problem
// The value is always the fact's answer, written last ('4 + 3 = 7'), so a bottle only ever changes that one number:
// the topics' sheepProblem writes a missing number as a plain sum (3 + ? = 7 as 3 + 4 = 7). A slip put in the middle
// of a sum could be read as a different sum that a "wrong" bottle makes true (5 + 8 = 8 is 5 + 8 = 13 too).
export function sheepItemFor(SPEC, step, sick, rand = Math.random, used = new Set(), { bottles = 3 } = {}) {
  const row = SPEC.LADDER[Math.max(1, Math.min(SPEC.LADDER.length, Math.round(step) || 1)) - 1];
  let p = null;
  // (the written fact is checked as well as the problem's id, so no two sheep in a flock read the same)
  const written = (q) => `=${SPEC.sheepText(q, numText(SPEC.answerOf(q)))}`;
  for (let k = 0; k < 24; k++) {
    p = SPEC.sheepProblem ? SPEC.sheepProblem(row, rand) : SPEC.problem(pick(row.shapes, rand), row, rand);
    if (!used.has(SPEC.key(p)) && !used.has(written(p))) break;
  }
  used.add(SPEC.key(p)); used.add(written(p));
  const a = SPEC.answerOf(p);
  const c = { ...SPEC.card(p, { size: 3, rand }), parts: { ...p }, shape: p.shape, answer: a };
  const seen = new Set([a]), slips = [];
  for (const s of SPEC.slipsOf(p)) if (Number.isInteger(s.n) && s.n >= 0 && !seen.has(s.n)) { seen.add(s.n); slips.push(s); }
  let slip = null;
  if (sick) {
    const main = slips.filter((s) => (s.w ?? 1) >= 1.5 && s.trap !== 'near' && s.trap !== 'other');
    slip = pickW(main.length ? main : slips, (s) => s.w ?? 1, rand);
  }
  const shown = slip ? slip.n : a;
  const pool = slips.filter((s) => s.n !== shown), wrong = [];
  const want = sick ? bottles - 1 : bottles;
  while (wrong.length < want && pool.length) { const s = pickW(pool, (x) => x.w ?? 1, rand); pool.splice(pool.indexOf(s), 1); wrong.push(s); }
  for (const d of [2, -2, 3, -3]) if (wrong.length < want && a + d >= 0 && a + d !== shown && !wrong.some((s) => s.n === a + d)) wrong.push({ n: a + d, trap: 'other' });
  const list = shuffle([...(sick ? [{ value: a, right: true, why: null }] : []), ...wrong.map((s) => ({ value: s.n, right: false, why: SPEC.whyNot(c, s.n).line }))], rand)
    .map((x) => ({ ...x, label: `should be ${numText(x.value)}` }));
  return {
    kind: SPEC.topic, sick: !!sick, top: null, shown: SPEC.sheepText(p, numText(shown)), fixed: SPEC.sheepText(p, numText(a)),
    answer: a, slip: slip ? slip.trap : null, bottles: list,
    fine: `She's fine: ${c.done}.`, healed: slip ? SPEC.whyNot(c, shown).line : `${c.done}.`,
    help: { kind: 'count', ...SPEC.picture(c) },
  };
}

// ---- the trainer -----------------------------------------------------------------------------------------------

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

export function makeCardTrainer(SPEC, state, opts = {}) {
  const LADDER = SPEC.LADDER, TOP = LADDER.length;
  const R = typeof opts.rand === 'function' ? opts.rand : Math.random;
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
  const placeBelow = Number.isInteger(opts.placeBelow) ? opts.placeBelow : PLACE_BELOW;   // (rigs try other values)
  const known = (p) => { try { return isObj(p) && typeof p.shape === 'string' && Number.isInteger(SPEC.answerOf(p)); } catch (e) { return false; } };
  const okCard = (c) => isObj(c) && typeof c.text === 'string' && Number.isInteger(c.answer) && known(c.parts) && Array.isArray(c.targets) && c.targets.length >= 2;

  // Fill in whatever the saved object is missing, and repair anything that isn't the right shape.
  function fill(S) {
    S.v = 1;
    S.step = clampInt(num(S.step, 1), 1, TOP);
    S.placed = S.placed === true;
    S.placeMisses = clampInt(num(S.placeMisses, 0), 0, 9);
    S.streak = clampInt(num(S.streak, 0), 0, 99);
    S.clock = Math.max(0, Math.floor(num(S.clock, 0)));      // cards finished; the comeback timer counts these
    S.waves = Math.max(0, Math.floor(num(S.waves, 0)));
    S.session = Math.max(0, Math.floor(num(S.session, 0)));
    S.warmups = clampInt(num(S.warmups, 0), 0, WARMUP_WAVES);
    S.sinceReview = clampInt(num(S.sinceReview, 0), 0, 99);
    S.lastAt = num(S.lastAt, 0);
    S.lastShape = typeof S.lastShape === 'string' ? S.lastShape : null;
    S.lastAns = Number.isInteger(S.lastAns) ? S.lastAns : null;   // the answer of the last card finished
    for (const k of ['rungs', 'slips']) if (!isObj(S[k])) S[k] = {};
    for (const k of Object.keys(S.rungs)) {
      const r = S.rungs[k];
      if (!isObj(r)) { delete S.rungs[k]; continue; }
      r.cards = num(r.cards, 0); r.right = num(r.right, 0); r.wrong = num(r.wrong, 0); r.helped = num(r.helped, 0);
    }
    for (const k of Object.keys(S.slips)) {
      const r = S.slips[k];
      if (!isObj(r)) { delete S.slips[k]; continue; }
      r.seen = num(r.seen, 0); r.fooled = num(r.fooled, 0);
    }
    const rung = (x) => clampInt(num(x.rung, 1), 1, TOP);
    // soon: { p, rung, due, old } (old = carried over from last session); review: { p, rung, sess, misses }
    S.soon = Array.isArray(S.soon) ? S.soon.filter((x) => isObj(x) && known(x.p)).map((x) => ({ p: x.p, rung: rung(x), due: num(x.due, 0), old: x.old === true })).slice(-SOON_KEEP) : [];
    S.review = Array.isArray(S.review) ? S.review.filter((x) => isObj(x) && known(x.p)).map((x) => ({ p: x.p, rung: rung(x), sess: num(x.sess, 0), misses: num(x.misses, 1) })).slice(-REVIEW_KEEP) : [];
    if (!(isObj(S.cur) && Array.isArray(S.cur.cards) && S.cur.cards.every(okCard))) S.cur = null;
    if (S.cur) {
      S.cur.at = clampInt(num(S.cur.at, 0), 0, S.cur.cards.length);
      const most = Math.max(0, ...S.cur.cards.map((c) => Number(String(c.id || '').split('.')[1]) || 0));
      S.cur.nextId = Math.max(most + 1, Math.floor(num(S.cur.nextId, 0)));
      S.cur.downs = clampInt(num(S.cur.downs, 0), 0, 9);
      // (a wave saved before `got` had its right-pick line written over with a number: make the line again)
      for (const c of S.cur.cards) if (typeof c.done !== 'string') { c.got = num(c.done, 0); c.done = SPEC.card(c.parts, { size: c.targets.length, rand: R }).done || ''; }
    }
    return S;
  }
  const S = fill(isObj(state) ? state : {});

  const rungStat = (k) => (S.rungs[k] ||= { cards: 0, right: 0, wrong: 0, helped: 0 });
  const slipStat = (k) => (S.slips[k || 'other'] ||= { seen: 0, fooled: 0 });
  const keyOf = (p) => SPEC.key(p);

  // ----- sessions

  function newSession() {
    S.session++;
    S.warmups = S.placed && S.waves > 0 ? WARMUP_WAVES : 0;
    S.sinceReview = 0;
    // Last session's misses come back early this session (right after the warm-ups): the most-missed ten, newest first
    // among equals. They are marked old, so a card missed this session still comes back on time.
    const order = S.review.map((r, i) => ({ r, i })).sort((x, y) => (y.r.misses || 1) - (x.r.misses || 1) || y.i - x.i);
    S.soon = order.slice(0, 10).map(({ r }) => ({ p: r.p, rung: r.rung, due: S.clock, old: true }));
    S.lastAt = now();
  }

  // ----- problems and cards

  // A shape for a step: by the row's weights, and less likely to be the shape just dealt (when there is a choice).
  function shapeFor(step) {
    const row = LADDER[step - 1], ws = row.weights || {};
    if (row.shapes.length === 1) return row.shapes[0];
    return pickW(row.shapes, (x) => (ws[x] ?? 1) * (x === S.lastShape ? 0.4 : 1), R);
  }
  const problemAt = (step) => SPEC.problem(shapeFor(step), LADDER[step - 1], R);

  // Card ids are "<wave>.<n>". A wave being dealt counts in `dealing`; once it is the current wave the count is kept in
  // the saved wave (S.cur.nextId), so cards added after a reload never repeat an id.
  let dealing = 1;
  function cardFor(p, rung, size, extra = {}) {
    const c = SPEC.card(p, { size, rand: R, avoid: extra.after });
    const id = extra.into ? `${extra.into.id}.${extra.into.nextId++}` : `${S.waves + 1}.${dealing++}`;
    const { into, after, ...rest } = extra;
    // (got: 1 right first time, 2 right later; the card's own `done` is its line for a right pick, so it isn't reused)
    return { id, ...c, parts: { ...p }, shape: p.shape, rung, back: false, review: false, ...rest, tried: false, got: 0, misses: 0 };
  }

  // Can a card with answer `ans` go at `pos` in `list`? Never the same answer on two cards in a row (the card before
  // the first one is the last card finished, maybe in the wave before).
  function fitsAt(list, pos, ans, from = 0) {
    const before = pos > from ? list[pos - 1]?.answer : S.lastAns, next = list[pos];
    return before !== ans && next?.answer !== ans;
  }

  // An earlier step for a review card: leaning toward the ones with misses waiting and the ones with the lowest score.
  function lowerStep() {
    const pool = [];
    for (let k = 1; k < S.step; k++) pool.push(k);
    if (!pool.length) return null;
    const missed = (k) => S.review.filter((r) => r.rung === k).length;
    return pickW(pool, (k) => { const r = rungStat(k); return 1 + Math.min(3, missed(k)) + 2 * (1 - (r.right + 1) / (r.right + r.wrong + 2)); }, R);
  }

  function wave({ count = TARGETS_PER_CARD, cards = CARDS_PER_WAVE } = {}) {
    closeWave();
    const perCard = clampInt(num(count, TARGETS_PER_CARD), 3, 6);
    const nCards = clampInt(num(cards, CARDS_PER_WAVE), 1, 8);
    if (S.lastAt && now() - S.lastAt > SESSION_GAP_MS) newSession();
    S.lastAt = now();
    dealing = 1;

    const warmup = S.warmups > 0 && S.placed;
    const placing = !S.placed;
    const list = [], seen = new Set();
    // never the same problem twice in a wave, and never the same answer twice in a row
    const add = (p, rung, size, extra = {}) => {
      const ans = SPEC.answerOf(p);
      if (seen.has(keyOf(p)) || !fitsAt(list, list.length, ans)) return false;
      seen.add(keyOf(p));
      list.push(cardFor(p, rung, size, { ...extra, after: list.length ? list[list.length - 1].answer : S.lastAns }));
      S.lastShape = p.shape;
      return true;
    };
    // Cards that fooled the kid come back where they are due: this session's misses first, soonest due first; last
    // session's after them. A warm-up wave takes back only this session's misses from its own easy steps.
    const takeBacks = (top) => {
      let backs = 0;
      const queue = [...S.soon.filter((b) => !b.old).sort((a, b) => a.due - b.due), ...S.soon.filter((b) => b.old)];
      for (const b of queue) {
        if (backs >= MAX_BACKS_PER_WAVE) break;
        if (top && (b.old || b.rung > top)) continue;
        if (b.due - S.clock > list.length) continue;
        const k = keyOf(b.p);
        if (seen.has(k)) {
          // this wave already deals the same problem: that card is its comeback
          const twin = list.find((x) => keyOf(x.parts) === k);
          if (twin) { twin.back = true; twin.review = false; backs++; }
          S.soon.splice(S.soon.indexOf(b), 1);
          continue;
        }
        const ans = SPEC.answerOf(b.p), pos = Math.min(Math.max(0, b.due - S.clock), list.length);
        let at = -1;
        for (const d of [0, 1, -1, 2]) { const q = pos + d; if (q >= 0 && q <= list.length && fitsAt(list, q, ans)) { at = q; break; } }
        if (at < 0) continue;   // no spot that fits: it waits for the next wave
        S.soon.splice(S.soon.indexOf(b), 1);
        seen.add(k);
        list.splice(at, 0, cardFor(b.p, b.rung, top ? Math.min(perCard, EASY_TARGETS) : perCard, { back: true, after: at ? list[at - 1].answer : S.lastAns }));
        backs++;
      }
    };

    if (warmup) {
      S.warmups--;
      const top = Math.max(1, S.step - WARMUP_BELOW);
      let guard = 0;
      while (list.length < nCards && guard++ < 60) {
        const rung = pickW(Array.from({ length: top }, (_, i) => i + 1), (k) => (k === top ? 2 : 1), R);
        add(problemAt(rung), rung, Math.min(perCard, EASY_TARGETS));
      }
      takeBacks(top);
    } else {
      const fresh = rungStat(S.step).cards < 3;
      const size = fresh ? Math.min(perCard, EASY_TARGETS) : perCard;
      let guard = 0;
      while (list.length < nCards && guard++ < 80) {
        let rung = S.step;
        if (!placing && S.step > 1 && S.sinceReview >= REVIEW_EVERY - 1) rung = lowerStep() || S.step;
        const ok = add(problemAt(rung), rung, rung === S.step ? size : perCard, rung !== S.step ? { review: true } : {});
        if (ok) S.sinceReview = rung !== S.step ? 0 : S.sinceReview + 1;
      }
      takeBacks(0);
    }
    // (a step with very few problems, and every one just dealt: a repeat is better than an empty wave)
    if (!list.length) list.push(cardFor(problemAt(S.step), S.step, Math.min(perCard, EASY_TARGETS)));

    S.waves++;
    S.cur = { id: S.waves, at: 0, step: S.step, warmup, placing, closed: false, downs: 0, cards: list, nextId: dealing };
    return view();
  }

  // What the game sees of the wave: the card to show now and the rest.
  function view() {
    const c = S.cur;
    if (!c) return null;
    const card = c.cards[c.at] || null;
    const hard = c.cards.reduce((m, x) => Math.max(m, x.rung || 1), 1);
    return {
      id: c.id, kind: 'card', topic: SPEC.topic,
      rule: card ? card.rule : '', sub: card ? card.sub : '',
      card: card ? publicCard(card) : null,
      cards: c.cards.map(publicCard),
      targets: card ? card.targets.map((t) => ({ ...t })) : [],
      step: S.step, hard,
      fresh: !c.warmup && rungStat(c.step).cards < 3,
      warmup: c.warmup, placing: c.placing, review: c.cards.some((x) => x.review),
      stage: c.warmup || (card && card.targets.length <= EASY_TARGETS) ? 'easy' : 'designed',
    };
  }
  function publicCard(x) {
    return {
      id: x.id, text: x.text, rule: x.rule, sub: x.sub, done: x.done, say: x.say, answer: x.answer, parts: { ...x.parts },
      shape: x.shape, rung: x.rung, targets: x.targets.map((t) => ({ ...t })), back: !!x.back, review: !!x.review, helped: !!x.helped,
    };
  }
  function card() {
    const c = S.cur;
    if (!c || c.closed) return null;
    const x = c.cards[c.at];
    return x ? publicCard(x) : null;
  }

  // ----- answers

  function remember(p, rung) {
    const k = keyOf(p), old = S.review.find((r) => keyOf(r.p) === k);
    if (old) { old.sess = S.session; old.misses = (old.misses || 1) + 1; }
    else S.review.push({ p: { ...p }, rung, sess: S.session, misses: 1 });
    while (S.review.length > REVIEW_KEEP) S.review.shift();
  }

  // After a climb on a first visit, the cards still to come are dealt again at the new step.
  function redealRest() {
    const c = S.cur;
    for (let i = c.at; i < c.cards.length; i++) {
      const x = c.cards[i];
      if (x.back || x.review) continue;
      const before = i > c.at ? c.cards[i - 1].answer : S.lastAns, next = c.cards[i + 1];
      let p = null;
      for (let tries = 0; tries < 10; tries++) {
        p = problemAt(S.step);
        const ans = SPEC.answerOf(p);
        if (ans !== before && ans !== next?.answer && !c.cards.some((y, j) => j !== i && keyOf(y.parts) === keyOf(p))) break;
      }
      c.cards[i] = cardFor(p, S.step, x.targets.length, { into: c, after: before });
    }
  }

  // n: the number on the target the kid picked. good: whether it was the right one (the target's `good`).
  // id (optional): the id of the card the target belonged to. A pick that lands after its card is gone changes nothing
  // and comes back with stale: true (`right` still says whether that target was the right one).
  function answer(n, good, id) {
    const c = S.cur && !S.cur.closed ? S.cur : null;
    const x = c ? c.cards[c.at] : null;
    const before = S.step;
    if (!x || (id != null && id !== x.id)) {
      return { right: good === true, step: S.step, moved: 0, placed: S.placed, comeback: null, card: x ? publicCard(x) : null, waveDone: !x, first: false, stale: true };
    }
    const right = typeof good === 'boolean' ? good : n === x.answer;
    const first = !x.tried;
    x.tried = true;
    S.lastAt = now();
    const rs = rungStat(x.rung || 1);
    if (first) rs.cards++;
    let comeback = null;

    if (right) {
      x.got = first ? 1 : 2;
      S.clock++;
      if (first && x.helped) {
        // right, after the helper came up but before any pick: well done and paid, but not a clean card (the streak waits)
        rs.helped++;
      } else if (first) {
        rs.right++;
        if (c.warmup) {
          // warm-ups sit below the kid's step; they never move it
        } else if (!S.placed) {
          S.step = Math.min(TOP, S.step + 1);
          if (S.step === TOP) S.placed = true;   // reached the top: nothing left to find
        } else if (REVIEWS_COUNT_UP || (!x.review && !x.back)) {
          S.streak++;
          if (S.streak >= CLEAN_TO_CLIMB) { S.step = Math.min(TOP, S.step + 1); S.streak = 0; }
        }
        // a card from an earlier session answered clean is done with
        if (x.back) { const k = keyOf(x.parts); S.review = S.review.filter((r) => !(keyOf(r.p) === k && r.sess < S.session)); }
      }
      for (const t of x.targets) if (!t.good && !t.picked) slipStat(t.trap).seen++;
      S.lastAns = x.answer;
      c.at++;
      if (S.step > before && c.placing) redealRest();
    } else {
      x.misses++;
      if (Number.isInteger(n)) x.lastPick = n;   // "Show me" now brings back this pick's picture (see help)
      const t = x.targets.find((y) => y.n === n);
      if (t && !t.good && !t.picked) { t.picked = true; const st = slipStat(t.trap); st.seen++; st.fooled++; }
      if (first) {
        rs.wrong++;
        S.streak = 0;
        const p = { ...x.parts };
        // a returning card from above the kid's step has been counted once already: missing it again moves nothing
        const counts = !c.warmup && !(x.back && (x.rung || 1) > S.step);
        if (counts) {
          if (!S.placed) {
            S.placeMisses++;
            if (S.placeMisses >= PLACEMENT_MISSES) { S.placed = true; S.step = Math.max(1, S.step - placeBelow); c.downs = MAX_DOWN_PER_WAVE; }
          } else if ((c.downs || 0) < MAX_DOWN_PER_WAVE && S.step > 1) {
            S.step--;
            c.downs = (c.downs || 0) + 1;
          }
        }
        // it comes back 2 to 4 cards later: in this wave if there is room, else in a later one. A card that was already
        // a comeback waits for next session instead, so a hard card can't keep coming round.
        S.soon = S.soon.filter((s) => keyOf(s.p) !== keyOf(p));
        if (!x.back) {
          let after = COMEBACK_MIN + Math.floor(R() * (COMEBACK_MAX - COMEBACK_MIN + 1));
          let at = -1;
          if (c.at + after <= c.cards.length) {
            for (const d of [0, 1, -1]) {
              const q = c.at + after + d;
              if (q >= c.at + COMEBACK_MIN && q <= Math.min(c.at + COMEBACK_MAX, c.cards.length) && fitsAt(c.cards, q, x.answer, c.at)) { at = q; break; }
            }
          }
          if (at >= 0) {
            after = at - c.at;
            c.cards.splice(at, 0, cardFor(p, x.rung, x.targets.length, { back: true, into: c, after: c.cards[at - 1].answer }));
          } else {
            S.soon.push({ p, rung: x.rung || 1, due: S.clock + after, old: false });
            while (S.soon.length > SOON_KEEP) S.soon.shift();
          }
          comeback = { text: x.text, after };
        }
        remember(p, x.rung || 1);
      }
    }
    const nowCard = c.cards[c.at] || null;
    if (!nowCard) closeWave();
    return {
      right, step: S.step, moved: Math.sign(S.step - before), placed: S.placed, comeback,
      card: nowCard ? publicCard(nowCard) : null, waveDone: !nowCard, first, helped: !!x.helped,
    };
  }

  function closeWave() { if (S.cur && !S.cur.closed) S.cur.closed = true; }

  // ----- words and pictures for the kid

  const asCard = (c) => (c && c.parts ? c : card());

  // explain(card, picked), or explain(picked) for the card showing now
  function explain(c, picked) {
    if (typeof c === 'number') { picked = c; c = null; }
    c = asCard(c);
    if (!c) return null;
    const good = picked === c.answer;
    const { slip, line } = good ? { slip: null, line: c.done } : SPEC.whyNot(c, picked);
    return { slip, line, good, numberLine: { ...SPEC.picture(c), reveal: true, picked: good ? null : picked, reason: line } };
  }

  // The picture for a kid who is stuck: the answer stays hidden. On a card already missed, the answer has been shown,
  // so "Show me" brings back that same picture (the answer, the pick and the reason) instead of hiding it again.
  function help(c) {
    c = asCard(c);
    if (!c) return null;
    const live = S.cur && !S.cur.closed ? S.cur.cards[S.cur.at] : null;
    if (live && live.id === c.id && live.misses > 0 && Number.isInteger(live.lastPick)) return { ...explain(c, live.lastPick).numberLine, again: true };
    if (live && live.id === c.id && !live.tried) live.helped = true;   // (a right pick after this pays, but doesn't climb)
    return { ...SPEC.picture(c), reveal: false, reason: SPEC.nudge(c) };
  }

  function hint(c) { c = asCard(c); return c ? SPEC.nudge(c) : SPEC.hint || ''; }

  // ----- for parents and dev tools

  function level() {
    const r = LADDER[S.step - 1];
    return {
      step: S.step, of: TOP, label: r.label, placing: !S.placed,
      line: `Step ${S.step} of ${TOP}: ${r.label}${S.placed ? '' : ', still finding the starting step'}`,
    };
  }
  function report() {
    return {
      level: level(), sessions: S.session, waves: S.waves, cards: S.clock,
      steps: Object.keys(S.rungs).sort((a, b) => a - b).map((k) => ({ step: Number(k), ...S.rungs[k] })),
      slips: Object.fromEntries(Object.entries(S.slips).map(([k, v]) => [k, { seen: v.seen, fooled: v.fooled }])),
      missed: S.review.map((r) => SPEC.card(r.p, { size: 3, rand: () => 0.5 }).text),   // (its own steady numbers: reading never changes play)
    };
  }
  function setStep(step) {
    S.step = clampInt(num(step, 1), 1, TOP);
    S.placed = true; S.streak = 0; S.warmups = 0;
  }

  if (opts.newSession || !S.lastAt || now() - S.lastAt > SESSION_GAP_MS) newSession();

  return {
    topic: SPEC.topic, name: SPEC.name, state: S, mode: 'cards', payEvery: PAY_EVERY,
    wave, card, answer, explain, help, hint, level, report, setStep, newSession,
    endWave: closeWave,
    due: () => [],   // missed cards come back inside the wave's own list (see answer()), so there is nothing extra to hand out
  };
}
