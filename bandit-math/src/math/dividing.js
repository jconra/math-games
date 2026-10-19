// The "Dividing" trainer behind the round-up: sharing out evenly, the division facts (each one the other way round of a
// times-table fact: 24 ÷ 6 = 4 because 4 × 6 = 24), then remainders.
//
// A wave is a few cards, played one after another, like the positive & negative cards. A card asks one thing
// ("24 ÷ 6 = ?", "12 apples, 3 horses: how many each?", "13 ÷ 4 = ? r ?") and brings its own small herd of answers:
// one right, the rest the slips kids really make, never random numbers:
//   near     one row off the times table (24 ÷ 6 → 3 or 5: 3 × 6 = 18, 5 × 6 = 30), or two rows off
//   divisor  the number already on the card (24 ÷ 6 → 6)
//   sub      took the number away once instead of sharing (24 ÷ 6 → 18)
//   add      added them (24 ÷ 6 → 30)
//   mult     multiplied them (8 ÷ 2 → 16)
//   On the missing-number cards (? ÷ 6 = 4, 24 ÷ ? = 4) the same slips, the other way round: the given number,
//   a row off (6 × 5 = 30), added (6 + 4), took away (24 − 4), multiplied (24 × 4).
//   On the remainder cards (13 ÷ 4 = 3 r 1):
//   noRem    dropped the leftover (3)
//   short    stopped dealing a round early, so the leftover could still go round (2 r 5)
//   over     rounded up, though there aren't enough for another round (4)
//   swap     the two numbers swapped round (1 r 3)
//   nearRem  a row off the times table, or the leftover miscounted by one (4 r 1, 3 r 2)
// The right answer is not always the middle of the near ones: a card has one or two near numbers, on one side of the
// answer or both, so "the middle one" is no better than a guess.
//
// The ladder (LADDER below) starts with small numbers shared out evenly, told in words ("12 apples, 3 horses: how
// many each?"), goes through the division facts of each times table in the times tables' own order (2, 10, 5, then
// 3 and 4, then 6, 9 and 11, then 7, 8 and 12), both ways round (? ÷ 6 = 4), and ends with remainders. The step moves
// with the answers, one card at a time (only the first try at a card counts), as the positive & negative cards do:
//   - 3 clean cards in a row on the kid's own step move up a step (review cards and comebacks don't count toward it);
//     a miss moves down a step, at most once per wave.
//   - On a kid's first visit the step climbs after every clean card. The climb ends at the second miss (one slip is
//     forgiven), and the kid settles PLACE_BELOW steps below the step they had reached.
//   - Each session opens with 2 easy warm-up waves from below the kid's step; they never move it.
//   - Once placed, every third card comes from an earlier step (mixed practice sticks better).
//   - A missed card comes back 2 to 4 cards later (in the same wave when there is room, else in the next one).
//   - A right pick after the help came up (8 s of thinking, or "Show me") is paid as usual but isn't a clean card.
//
// The help (help(card): when the kid is stuck) is a picture with the answer hidden: equal groups drawn as rows of dots
// with the first round dealt out (src/ui/groups.js), or the times chart for the big ones (find the number in the
// table's row, then look up). After a wrong pick (explain(card, picked)) the rows are dealt out in full, with the
// leftover set aside, and one plain line says what that pick did.
//
// Everything it remembers lives in the plain object it is given (rider.topics.dividing), so it saves as JSON with the
// rider, and a reload mid-wave carries on where it was. Nothing is kept anywhere else.
//
//   const D = makeDividing(rider.topics.dividing ||= {})
//   const w = D.wave({ count: 5 })     -> { rule, card, cards, targets, step, hard, fresh, warmup, ... }
//   D.card()                           -> the card to show now (null when the wave is done)
//   D.answer(n, good, id)              -> { right, step, moved, placed, comeback, card, waveDone, first, stale }
//   D.explain(card, picked)            -> { slip, line, picture }   after a wrong pick (picture: groups or chart)
//   D.help(card)                       -> the picture with the answer hidden, for "Show me" / 8 s of thinking
//   D.hint(card), D.level(), D.report(), D.setStep(n)
//   D.steer(step, { placing })         the rider's skill model (src/math/skill.js) sets the step from now on (see steer)
//   D.shape === 'cards'                (the round-up deals these one card at a time, as the positive & negative ones)
// A card: { id, kind: 'share'|'fact'|'missing'|'rem', text ('24 ÷ 6', for "24 ÷ 6 = 4"), rule (the card's own words),
//   answer (the right target's n), label, parts: { total, groups, each, left, ask }, rung, targets: [{ n, good, trap,
//   label }] } (a remainder answer's n is each × 100 + left, and its label '3 r 1').
//
// Every division shows the ÷ sign; × in the times facts it is built on (as the times tables do).

// ---- the dials (defaults; change them here) --------------------------------------------------------------------

export const CLEAN_TO_CLIMB = 3;        // clean cards in a row to move up a step
export const MAX_DOWN_PER_WAVE = 1;     // a rough wave can drop the kid this many steps at most
export const PLACEMENT_MISSES = 2;      // the first-visit climb ends at this many misses (one slip is forgiven)
export const PLACE_BELOW = 2;           // the climb ends this many steps below the step the kid had reached (as times
                                        // tables and positive & negative; a default, not a final ruling)
export const REVIEWS_COUNT_UP = false;  // review cards (from an earlier step) and comebacks don't count toward the climb
export const WARMUP_WAVES = 2;          // easy waves at the start of each session
export const WARMUP_BELOW = 2;          // how many steps below the kid's step the warm-ups come from
export const REVIEW_EVERY = 3;          // once placed, one card in this many comes from an earlier step
export const CARDS_PER_WAVE = 3;        // cards in a wave
export const TARGETS_PER_CARD = 5;      // answers on a card (one right); count can ask for 4 to 6
export const EASY_TARGETS = 4;          // answers on warm-up cards and on a step's first cards
export const COMEBACK_MIN = 2;          // a missed card comes back this many cards later...
export const COMEBACK_MAX = 4;          // ...up to this many
export const SESSION_GAP_MS = 30 * 60 * 1000;   // a gap this long between answers starts a new session
export const GROUPS_MOST = 40;          // the help draws rows of dots up to this many in all; past it, the times chart
export const GROUPS_REM_MOST = 100;     // ... for remainder cards, up to this many
export const PAY_EVERY = 3;             // the round-up pays 1 more gold a steer for every this many steps up
const BELOW_LEAN = 0.5;                 // how much more often the answer is dealt a higher place when there's room (see pickSlips)
const REVIEW_KEEP = 40;                 // missed cards kept for later sessions
const SOON_KEEP = 30;                   // missed cards waiting to come back

const DIV = '÷', TIMES = '×', MINUS = '−';

// ---- the ladder ----------------------------------------------------------------------------------------------------
// kind: share (in words, small), fact (24 ÷ 6), missing (both ways round), rem (remainders). tables: what is divided
// by, the step's own first (older: the earlier ones, now and then); most: the biggest answer (how many each).
const ORDER = [2, 10, 5, 3, 4, 9, 11, 6, 8, 7, 12];   // (the times tables' own order: src/math/times.js)
export const LADDER = [
  { kind: 'share', tables: [2, 3], most: 10, cap: 20, label: 'Sharing out evenly (8 apples, 2 horses)' },   // (cap: no more than 20 to share)
  { kind: 'share', tables: [4, 5], older: [2, 3], most: 6, label: 'Sharing among 4 and 5 (20 into 5 even groups)' },
  { kind: 'fact', tables: [2, 10, 5], most: 10, label: `Dividing by 2, 10 and 5 (35 ${DIV} 5)` },
  { kind: 'fact', tables: [3, 4], older: [2, 10, 5], most: 10, label: `Dividing by 3 and 4 (28 ${DIV} 4)` },
  { kind: 'fact', tables: [6, 9, 11], older: [2, 10, 5, 3, 4], most: 10, label: `Dividing by 6, 9 and 11 (54 ${DIV} 9)` },
  { kind: 'fact', tables: [7, 8, 12], older: [2, 10, 5, 3, 4, 6, 9, 11], most: 10, label: `Dividing by 7, 8 and 12 (56 ${DIV} 8)` },
  { kind: 'missing', tables: ORDER, most: 10, label: `Both ways round (? ${DIV} 6 = 4, 24 ${DIV} ? = 4)` },
  { kind: 'rem', tables: [2, 3, 4, 5], most: 5, label: `Remainders (13 ${DIV} 4 = 3 r 1)` },
  { kind: 'rem', tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], most: 10, label: `Remainders up to the 10s (59 ${DIV} 8 = 7 r 3)` },
];
export const SLIP_KINDS = ['near', 'divisor', 'sub', 'add', 'mult', 'given', 'noRem', 'short', 'over', 'swap', 'nearRem'];

// The things shared out on the word cards: [what, what (one), among, among (one), 'each' words]
const STORIES = [
  ['apples', 'apple', 'horses', 'horse', 'each'],
  ['carrots', 'carrot', 'mules', 'mule', 'each'],
  ['biscuits', 'biscuit', 'cowhands', 'cowhand', 'each'],
  ['cows', 'cow', 'pens', 'pen', 'in each pen'],
  ['eggs', 'egg', 'baskets', 'basket', 'in each basket'],
  ['horseshoes', 'horseshoe', 'horses', 'horse', 'each'],
  ['sacks', 'sack', 'wagons', 'wagon', 'on each wagon'],
];

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

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n) => WORDS[n] || String(n);
// the n of a remainder answer, and its label
export const remCode = (q, r) => q * 100 + r;
export const remLabel = (q, r) => (r ? `${q} r ${r}` : String(q));

// ---- one card ----------------------------------------------------------------------------------------------------
// The wrong answers a card can carry, each with its kind (see the top of the file). v: the target's n; label: its words.
function slipsOf(c) {
  const { kind, n, d, q, r } = c, out = [];
  const add = (v, trap, w = 1, label = null) => { if (Number.isInteger(v) && v > 0 && v !== c.answer) out.push({ n: v, trap, w, label: label || String(v) }); };
  if (kind === 'rem') {
    const R = (qq, rr, trap, w) => { if (qq >= 0 && rr >= 0 && !(qq === 0 && rr === 0)) add(remCode(qq, rr), trap, w, remLabel(qq, rr)); };
    R(q, 0, 'noRem', 6);                              // dropped the leftover
    if (q >= 2) R(q - 1, r + d, 'short', 3);          // a round short: the leftover could still go round
    R(q + 1, 0, 'over', 1.5);                         // rounded up (not enough for that)
    if (r !== q) R(r, q, 'swap', 1);                  // swapped round
    R(q + 1, r, 'nearRem', 0.8); if (q >= 2) R(q - 1, r, 'nearRem', 0.8);
    if (r + 1 < d) R(q, r + 1, 'nearRem', 0.5); if (r >= 2) R(q, r - 1, 'nearRem', 0.5);
    return out;
  }
  if (kind === 'missing' && c.ask === 'n') {         // ? ÷ d = q: the answer is d × q
    add(d * (q + 1), 'near', 2); add(d * (q - 1), 'near', 2);
    add(d + q, 'add', 1.5); add(q, 'given', 1.2); add(d, 'given', 1.2);
    if (q > d) add(q - d, 'sub', 0.8); else add(d - q, 'sub', 0.8);
    add(d * (q + 2), 'near', 0.6);
    return out;
  }
  if (kind === 'missing') {                           // n ÷ ? = q: the answer is d
    add(n - q, 'sub', 2); add(q, 'given', 1.5);
    add(d + 1, 'near', 1.5); add(d - 1, 'near', 1.5);
    if (n * q <= 150) add(n * q, 'mult', 0.7);
    add(n + q, 'add', 0.7);
    return out;
  }
  // share and fact: n ÷ d = q
  add(q + 1, 'near', 2); add(q - 1, 'near', 2);
  add(q + 2, 'near', 0.9); add(q - 2, 'near', 0.9);
  add(d, 'divisor', 1.6);
  add(n - d, 'sub', 1.6);
  add(n + d, 'add', 0.9);
  if (n * d <= 150) add(n * d, 'mult', 0.6);
  return out;
}

// the card's wrong answers: size − 1 of them, no repeats. Where the answer falls among the card's numbers is dealt
// first (how many slips sit below it, any number the card's slips allow, each as likely), so no place in the order
// ("the second smallest", "the one in the middle") points to it much more than a guess does. The slip the topic is
// most about comes first when there is room on that side: a row off the table, or the dropped leftover.
function pickSlips(c, size, rand) {
  const uniq = [], seenN = new Set([c.answer]);
  for (const s of slipsOf(c)) if (!seenN.has(s.n)) { seenN.add(s.n); uniq.push(s); }
  const want = Math.min(size - 1, uniq.length);
  const below = uniq.filter((s) => s.n < c.answer), above = uniq.filter((s) => s.n > c.answer);
  const lo = Math.max(0, want - above.length), hi = Math.min(below.length, want);
  // (small answers have few slips below them, so on the cards that have room the answer goes higher a little more often:
  // over a whole step every place comes up about as often)
  let sum = 0; const ws = []; for (let j = lo; j <= hi; j++) { ws.push((1 + j) ** BELOW_LEAN); sum += ws[ws.length - 1]; }
  let x = rand() * sum, k = hi;
  for (let j = lo; j <= hi; j++) { x -= ws[j - lo]; if (x < 0) { k = j; break; } }
  const takeW = (list, m, first) => {
    const pool = [...list], out = [];
    if (first && m > 0 && pool.includes(first)) { out.push(first); pool.splice(pool.indexOf(first), 1); }
    while (out.length < m && pool.length) {
      let sum = 0; for (const s of pool) sum += s.w;
      let x = rand() * sum, i = 0;
      for (; i < pool.length - 1; i++) { x -= pool[i].w; if (x < 0) break; }
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  };
  const main = c.kind === 'rem' ? uniq.find((s) => s.trap === 'noRem')
    : c.kind === 'share' || c.kind === 'fact' ? (rand() < 0.5 ? uniq.find((s) => s.n === c.q - 1) : uniq.find((s) => s.n === c.q + 1)) : null;
  const out = [...takeW(below, k, main && main.n < c.answer && rand() < 0.85 ? main : null), ...takeW(above, want - k, main && main.n > c.answer ? main : null)];
  // short of slips (tiny numbers): plain neighbours above
  const have = new Set([c.answer, ...out.map((s) => s.n)]);
  for (let j = 1; out.length < size - 1 && j < 20; j++) {
    const s = c.kind === 'rem' ? { n: remCode(c.q + j, c.r), trap: 'nearRem', label: remLabel(c.q + j, c.r) }
      : { n: c.answer + j, trap: 'near', label: String(c.answer + j) };
    if (!have.has(s.n)) { have.add(s.n); out.push(s); }
  }
  return out;
}

const shuffleWith = (a, rand) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// A card for n ÷ d (kind 'share' | 'fact' | 'missing' | 'rem'; ask: 'n' | 'd' for a missing-number card).
//   makeCard({ kind, n, d, ask, size, rand, rung, story }) -> the card (see the top of the file)
export function makeCard({ kind = 'fact', n, d, ask = null, size = TARGETS_PER_CARD, rand = Math.random, rung = 1, story = null, id = 1 } = {}) {
  const q = Math.floor(n / d), r = n - q * d;
  const c = { id, kind, n, d, q, r, ask: kind === 'missing' ? (ask === 'd' ? 'd' : 'n') : null, rung };
  if (kind === 'rem') {
    c.answer = remCode(q, r); c.label = remLabel(q, r);
    c.text = `${n} ${DIV} ${d}`; c.rule = `${n} ${DIV} ${d} = ? r ?`;
  } else if (kind === 'missing' && c.ask === 'n') {
    c.answer = n; c.label = String(n);
    c.text = `${d} ${TIMES} ${q}`; c.rule = `? ${DIV} ${d} = ${q}`;      // (roped right: "6 × 4 = 24", the family)
  } else if (kind === 'missing') {
    c.answer = d; c.label = String(d);
    c.text = `${n} ${DIV} ${q}`; c.rule = `${n} ${DIV} ? = ${q}`;        // (roped right: "24 ÷ 4 = 6")
  } else {
    c.answer = q; c.label = String(q);
    c.text = `${n} ${DIV} ${d}`;
    if (kind === 'share') {
      const s = story || STORIES[Math.floor(rand() * STORIES.length)];
      c.story = s;
      c.rule = rand() < 0.3 ? `Split ${n} into ${d} even groups: how many in each?` : `${n} ${s[0]}, ${d} ${s[2]}: how many ${s[4]}?`;
    } else c.rule = `${n} ${DIV} ${d} = ?`;
  }
  const slips = pickSlips(c, Math.max(2, Math.min(6, size)), rand);
  c.targets = shuffleWith([{ n: c.answer, good: true, trap: null, label: c.label }, ...slips.map((s) => ({ n: s.n, good: false, trap: s.trap, label: s.label }))], rand);
  c.parts = { total: n, groups: d, each: q, left: r, ask: c.ask };
  return c;
}

// ---- words and pictures ----------------------------------------------------------------------------------------
// The slip a picked number is, on this card: one of SLIP_KINDS, or 'other'
export function classify(c, picked) {
  if (picked === c.answer) return 'right';
  const t = c.targets && c.targets.find((x) => x.n === picked);
  if (t && t.trap) return t.trap;
  const s = slipsOf(c).find((x) => x.n === picked);
  return s ? s.trap : 'other';
}
const labelOf = (c, v) => { const t = c.targets && c.targets.find((x) => x.n === v); return t ? t.label : (c.kind === 'rem' ? remLabel(Math.floor(v / 100), v % 100) : String(v)); };

// One plain line about a wrong pick: what that number is, and what the card asks.
export function explainPick(c, picked) {
  const { n, d, q, r } = c, slip = classify(c, picked), lab = labelOf(c, picked);
  if (slip === 'right') return { slip, line: rightLine(c) };
  if (c.kind === 'rem') {
    const pq = Math.floor(picked / 100), pr = picked % 100;
    const lines = {
      noRem: `${d} ${TIMES} ${q} = ${d * q}, so ${n - d * q} ${n - d * q === 1 ? 'is' : 'are'} left over: ${n} ${DIV} ${d} = ${q} r ${r}. Don't drop the remainder.`,
      short: `${pr} left over is enough for another round of ${d}. Keep dealing until fewer than ${d} are left.`,
      over: `${pq} ${TIMES} ${d} = ${pq * d}: that needs more than ${n}. Only ${q} whole rounds fit, with some left over.`,
      swap: `That's swapped round: ${n} ${DIV} ${d} gives ${q} each, and the remainder (what's left over) comes after the r.`,
      nearRem: pq !== q ? `${pq} ${TIMES} ${d} = ${pq * d}${pq * d > n ? `, more than ${n}` : `, and ${n} ${MINUS} ${pq * d} = ${n - pq * d} is still enough for another round`}.`
        : `${q} ${TIMES} ${d} = ${q * d}, and ${n} ${MINUS} ${q * d} = ${r} left over: the remainder is ${r}, not ${pr}.`,
    };
    return { slip, line: lines[slip] || `${lab} isn't it: deal ${n} out into ${d} rows, one round at a time.` };
  }
  if (c.kind === 'missing' && c.ask === 'n') {
    const lines = {
      near: `${picked} ${DIV} ${d} = ${picked / d}, not ${q}. The number shared out is ${d} ${TIMES} ${q}.`,
      add: `${d} + ${q} adds them. Undo the sharing by multiplying: ${q} each in ${d} rows is ${d} ${TIMES} ${q}.`,
      given: `${picked} is already on the card. What number, shared into ${d} rows, gives ${q} in each?`,
      sub: `Taking away doesn't undo sharing. ${q} each in ${d} rows: ${d} ${TIMES} ${q}.`,
    };
    return { slip, line: lines[slip] || `${picked} ${DIV} ${d} isn't ${q}. Think ${d} ${TIMES} ${q}.` };
  }
  if (c.kind === 'missing') {
    const lines = {
      sub: `${n} ${MINUS} ${q} takes away. What do you divide ${n} by to get ${q}? Think ? ${TIMES} ${q} = ${n}.`,
      given: `${q} is already on the card. ${n} ${DIV} ? = ${q}: which table has ${q} ${TIMES} it making ${n}?`,
      near: `${n} ${DIV} ${picked} isn't ${q}: ${picked} ${TIMES} ${q} = ${picked * q}, not ${n}.`,
      mult: `${n} ${TIMES} ${q} multiplies. The missing number times ${q} makes ${n}.`,
      add: `${n} + ${q} adds. The missing number times ${q} makes ${n}.`,
    };
    return { slip, line: lines[slip] || `${picked} ${TIMES} ${q} = ${picked * q}, not ${n}.` };
  }
  const story = c.kind === 'share' && c.story && !/^Split/.test(c.rule) ? c.story : null;
  const lines = {
    // (said the way the picture deals it: so many in each row, or for each horse)
    near: (story ? `${d} ${story[2]} with ${picked} ${story[4]}` : `${picked} in each of ${d} rows`)
      + (picked > q ? ` is ${picked * d}: ${picked * d - n} too many.` : ` is only ${picked * d}: ${n - picked * d} short of ${n}.`)
      + (story ? ` ${n} ${story[0]} make ${q} ${story[4]}.` : ` ${n} makes ${q} in each row.`),
    divisor: story ? `${d} is how many ${story[2]} there are. How many ${story[4]}? Think ? ${TIMES} ${d} = ${n}.`
      : `${d} is how many rows there are. How many in each row? Think ? ${TIMES} ${d} = ${n}.`,
    sub: `${n} ${MINUS} ${d} = ${picked} takes ${d} away once. Sharing asks how many ${d}s fit in ${n}.`,
    add: `${n} + ${d} adds them. Sharing ${n} out into ${d} rows makes each row smaller than ${n}.`,
    mult: `${n} ${TIMES} ${d} multiplies. Dividing goes the other way: what times ${d} makes ${n}?`,
  };
  return { slip, line: lines[slip] || `${picked} isn't it: ${n} shared into ${d} equal rows.` };
}
// what a right pick shows: the fact family
function rightLine(c) {
  const { n, d, q, r } = c;
  if (c.kind === 'rem') return `${n} ${DIV} ${d} = ${q} r ${r}: ${q} ${TIMES} ${d} = ${q * d}, and the remainder is ${r}.`;
  return `${n} ${DIV} ${d} = ${q}, because ${q} ${TIMES} ${d} = ${n}.`;
}
// the nudge for a kid who is stuck (the help picture's caption: it never says the answer)
export function nudge(c) {
  const { n, d } = c;
  if (c.kind === 'rem') return `Deal ${n} out into ${d} rows, one round at a time. When fewer than ${d} are left, they're the remainder: the number after the r.`;
  if (c.kind === 'missing' && c.ask === 'n') return `${c.q} in each of ${d} rows: how many is that in all? Think ${d} ${TIMES} ${c.q}.`;
  if (c.kind === 'missing') return `Which number times ${c.q} makes ${n}? Count by ${c.q}s up to ${n}.`;
  return `Deal ${n} out into ${d} rows, one round at a time, until none are left. How many in each row?`;
}

// The picture for a card (src/ui/groups.js draws it; a chart one is the times chart, src/ui/timeschart.js).
//   reveal false (help): the rows with the first round dealt and the rest still in the pile; or the chart in its
//   "find the number, then look up" way, nothing circled. reveal true (after a miss): every round dealt, the leftover
//   set aside, and the reason.
// (helper: which drawing it is, under the name the round-up dispatches on: 'groups' or 'chart')
export function pictureFor(c, o = {}) { const p = pictureOf(c, o); p.helper = p.kind; return p; }
function pictureOf(c, { reveal = false, picked = null, reason = '' } = {}) {
  const { n, d } = c;
  const dots = c.kind === 'missing' && c.ask === 'n' ? d * c.q : n;
  // (remainders are about the dealing itself: their rows are drawn up to 100 dots, where the chart can't show a leftover)
  if (dots <= (c.kind === 'rem' ? GROUPS_REM_MOST : GROUPS_MOST) && d <= 12) {
    return { kind: 'groups', total: dots, groups: d, dealt: reveal ? null : 1, reveal, picked: picked == null ? null : labelOf(c, picked), reason: reason || nudge(c),
      ask: c.kind === 'missing' ? c.ask : null, each: c.kind === 'missing' && c.ask === 'n' ? c.q : null };
  }
  // the times chart: the divisor's row, find the number in it, look up
  if (c.kind === 'missing' && c.ask === 'd') return { kind: 'chart', table: c.q, find: n, rule: `? ${TIMES} ${c.q} = ${n}`, line: reason || nudge(c), missed: reveal && picked != null && picked <= 12 ? picked : undefined };
  if (c.kind === 'missing') return { kind: 'chart', table: d, line: reason || nudge(c), missed: reveal && picked != null ? picked : undefined };
  if (c.kind === 'rem') return { kind: 'chart', table: d, line: reason || `Find the biggest number in the ${d}s row that isn't over ${n}. What's left is the leftover.` };
  return { kind: 'chart', table: d, find: n, rule: `${d} ${TIMES} ? = ${n}`, line: reason || nudge(c), missed: reveal && picked != null && picked <= 12 ? picked : undefined };
}

// ---- the trainer ---------------------------------------------------------------------------------------------------
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
const keyOf = (p) => `${p.kind}:${p.n}:${p.d}:${p.ask || ''}`;

function fill(S) {
  S.v = 1;
  S.step = clampInt(num(S.step, 1), 1, LADDER.length);
  S.placed = S.placed === true;
  S.streak = clampInt(num(S.streak, 0), 0, 99);
  S.placeMisses = clampInt(num(S.placeMisses, 0), 0, 9);
  S.clock = Math.max(0, Math.floor(num(S.clock, 0)));
  S.waves = Math.max(0, Math.floor(num(S.waves, 0)));
  S.session = Math.max(0, Math.floor(num(S.session, 0)));
  S.warmups = clampInt(num(S.warmups, 0), 0, WARMUP_WAVES);
  S.sinceReview = clampInt(num(S.sinceReview, 0), 0, 99);
  S.lastAt = num(S.lastAt, 0);
  S.lastKey = typeof S.lastKey === 'string' ? S.lastKey : null;
  if (!isObj(S.rungs)) S.rungs = {};
  for (const k of Object.keys(S.rungs)) { const r = S.rungs[k]; if (!isObj(r)) { delete S.rungs[k]; continue; } r.cards = num(r.cards, 0); r.right = num(r.right, 0); r.wrong = num(r.wrong, 0); r.helped = num(r.helped, 0); }
  if (!isObj(S.slips)) S.slips = {};
  for (const k of Object.keys(S.slips)) { const r = S.slips[k]; if (!isObj(r)) { delete S.slips[k]; continue; } r.seen = num(r.seen, 0); r.fooled = num(r.fooled, 0); }
  const okP = (x) => isObj(x) && typeof x.kind === 'string' && LADDER.some((r) => r.kind === x.kind) && Number.isInteger(x.n) && Number.isInteger(x.d) && x.d >= 1 && x.n >= 1;
  S.soon = Array.isArray(S.soon) ? S.soon.filter(okP).map((x) => ({ kind: x.kind, n: x.n, d: x.d, ask: x.ask || null, rung: clampInt(num(x.rung, 1), 1, LADDER.length), due: num(x.due, 0), old: !!x.old })).slice(-SOON_KEEP) : [];
  S.review = Array.isArray(S.review) ? S.review.filter(okP).map((x) => ({ kind: x.kind, n: x.n, d: x.d, ask: x.ask || null, rung: clampInt(num(x.rung, 1), 1, LADDER.length), sess: num(x.sess, 0), misses: num(x.misses, 1) })).slice(-REVIEW_KEEP) : [];
  if (!(isObj(S.cur) && Array.isArray(S.cur.cards) && S.cur.cards.every((c) => isObj(c) && Array.isArray(c.targets)))) S.cur = null;
  if (S.cur) { S.cur.at = clampInt(num(S.cur.at, 0), 0, S.cur.cards.length); S.cur.downs = clampInt(num(S.cur.downs, 0), 0, 9); S.cur.nextId = num(S.cur.nextId, S.cur.cards.length + 1); }
  return S;
}

// state: rider.topics.dividing (filled in and changed in place). opts: { rand, now, newSession } for tests and rigs.
export function makeDividing(state, opts = {}) {
  const S = fill(isObj(state) ? state : {});
  const R = typeof opts.rand === 'function' ? opts.rand : Math.random;
  const now = typeof opts.now === 'function' ? opts.now : () => Date.now();
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const int = (lo, hi) => (hi < lo ? lo : lo + Math.floor(R() * (hi - lo + 1)));
  const rungStat = (k) => (S.rungs[k] ||= { cards: 0, right: 0, wrong: 0, helped: 0 });
  const slipStat = (k) => (S.slips[k || 'other'] ||= { seen: 0, fooled: 0 });

  function newSession() {
    S.session++;
    S.warmups = S.placed && S.waves > 0 ? WARMUP_WAVES : 0;
    S.sinceReview = 0;
    // last session's misses come back early this session (after the warm-ups): the most missed ten
    const order = S.review.map((r, i) => ({ r, i })).sort((a, b) => (b.r.misses || 1) - (a.r.misses || 1) || b.i - a.i);
    S.soon = order.slice(0, 10).map(({ r }) => ({ kind: r.kind, n: r.n, d: r.d, ask: r.ask, rung: r.rung, due: S.clock, old: true }));
    S.lastAt = now();
  }

  // a problem from a step: { kind, n, d, ask }
  function problem(rung) {
    const row = LADDER[rung - 1];
    const tables = row.older && R() < 0.3 ? row.older : row.tables;
    for (let tries = 0; tries < 30; tries++) {
      const d = pick(tables);
      if (row.kind === 'rem') {
        const q = int(1, row.most), r = int(1, d - 1);
        const p = { kind: 'rem', n: d * q + r, d, rung };
        if (keyOf(p) !== S.lastKey) return p;
        continue;
      }
      // how many each: 2 and up mostly (1 each is a dull card), never the same as the rows on a word card
      const q = row.kind !== 'share' && R() < 0.06 ? 1 : int(2, row.cap ? Math.min(row.most, Math.floor(row.cap / d)) : row.most);
      if (row.kind === 'share' && q === d) continue;
      const p = { kind: row.kind, n: d * q, d, rung };
      if (row.kind === 'missing') p.ask = R() < 0.5 ? 'n' : 'd';
      if (row.kind === 'missing' && p.ask === 'd' && q === d) continue;   // (24 ÷ ? = 4 with 4 rows of 4: the given number would be the answer)
      if (keyOf(p) !== S.lastKey) return p;
    }
    return { kind: row.kind === 'missing' ? 'fact' : row.kind, n: 12, d: 3, rung };
  }
  function cardFor(p, rung, size, extra = {}) {
    const c = S.cur && extra.into ? extra.into : null;
    const id = c ? c.nextId++ : dealing++;
    const card = makeCard({ kind: p.kind, n: p.n, d: p.d, ask: p.ask, size, rand: R, rung, id });
    return { ...card, back: !!extra.back, review: !!extra.review, tried: false, done: 0, misses: 0, helped: false, lastPick: null };
  }
  let dealing = 1;

  function lowerStep() {
    const pool = []; for (let k = 1; k < S.step; k++) pool.push(k);
    if (!pool.length) return null;
    const missed = (k) => S.review.filter((r) => r.rung === k).length;
    let sum = 0; const ws = pool.map((k) => { const r = rungStat(k); const w = 1 + Math.min(3, missed(k)) + 2 * (1 - (r.right + 1) / (r.right + r.wrong + 2)); sum += w; return w; });
    let x = R() * sum; for (let i = 0; i < pool.length; i++) { x -= ws[i]; if (x < 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  function wave({ count = TARGETS_PER_CARD, cards = CARDS_PER_WAVE } = {}) {
    closeWave();
    const perCard = clampInt(num(count, TARGETS_PER_CARD), 4, 6);
    const nCards = clampInt(num(cards, CARDS_PER_WAVE), 1, 8);
    if (S.lastAt && now() - S.lastAt > SESSION_GAP_MS) newSession();
    S.lastAt = now();
    dealing = 1;
    const warmup = S.warmups > 0 && S.placed && !(steered && steered.placing), placing = !S.placed || !!(steered && steered.placing);
    const list = [], seen = new Set();
    const add = (p, rung, size, extra = {}) => {
      if (seen.has(keyOf(p))) return false;
      seen.add(keyOf(p)); S.lastKey = keyOf(p);
      list.push(cardFor(p, rung, size, extra));
      return true;
    };
    // cards that fooled the kid and are due now (this session's soonest first, last session's after)
    const takeBacks = (top) => {
      let backs = 0;
      const queue = [...S.soon.filter((b) => !b.old).sort((a, b) => a.due - b.due), ...S.soon.filter((b) => b.old)];
      for (const b of queue) {
        if (backs >= 2 || list.length >= nCards + 2) break;
        if (top && (b.old || b.rung > top)) continue;
        if (b.due - S.clock > list.length) continue;
        S.soon.splice(S.soon.indexOf(b), 1);
        if (seen.has(keyOf(b))) continue;
        seen.add(keyOf(b));
        const at = Math.min(Math.max(0, b.due - S.clock), list.length);
        list.splice(at, 0, cardFor(b, b.rung, top ? Math.min(perCard, EASY_TARGETS) : perCard, { back: true }));
        backs++;
      }
    };
    if (warmup) {
      S.warmups--;
      const top = Math.max(1, S.step - WARMUP_BELOW);
      for (let guard = 0; list.length < nCards && guard < 40; guard++) {
        const rung = int(Math.max(1, top - 1), top);
        add(problem(rung), rung, Math.min(perCard, EASY_TARGETS));
      }
      takeBacks(top);
    } else {
      const fresh = rungStat(S.step).cards < 3;
      for (let guard = 0; list.length < nCards && guard < 60; guard++) {
        let rung = S.step;
        if (!placing && S.step > 1 && S.sinceReview >= REVIEW_EVERY - 1) rung = lowerStep() || S.step;
        const ok = add(problem(rung), rung, rung === S.step && fresh ? Math.min(perCard, EASY_TARGETS) : perCard, rung !== S.step ? { review: true } : {});
        if (ok) S.sinceReview = rung !== S.step ? 0 : S.sinceReview + 1;
      }
      takeBacks(0);
    }
    S.waves++;
    S.cur = { id: S.waves, at: 0, step: S.step, warmup, placing, closed: false, downs: 0, cards: list, nextId: dealing };
    return view();
  }

  function publicCard(x) {
    return {
      id: x.id, kind: x.kind, text: x.text, rule: x.rule, answer: x.answer, label: x.label, rung: x.rung,
      parts: { ...x.parts }, n: x.n, d: x.d, q: x.q, r: x.r, ask: x.ask, story: x.story || null,
      targets: x.targets.map((t) => ({ ...t })), back: !!x.back, review: !!x.review, helped: !!x.helped,
    };
  }
  function view() {
    const c = S.cur; if (!c) return null;
    const card = c.cards[c.at] || null;
    const hard = c.cards.reduce((m, x) => Math.max(m, x.rung || 1), 1);
    return {
      id: c.id, kind: 'card', rule: card ? card.rule : '', card: card ? publicCard(card) : null, cards: c.cards.map(publicCard),
      targets: card ? card.targets.map((t) => ({ ...t })) : [], step: S.step, hard,
      fresh: !c.warmup && rungStat(c.step).cards < 3, warmup: c.warmup, placing: c.placing, review: c.cards.some((x) => x.review),
      stage: c.warmup || (card && card.targets.length <= EASY_TARGETS) ? 'easy' : 'designed',
    };
  }
  function card() {
    const c = S.cur; if (!c || c.closed) return null;
    const x = c.cards[c.at]; return x ? publicCard(x) : null;
  }

  function remember(x) {
    const old = S.review.find((r) => keyOf(r) === keyOf(x));
    if (old) { old.sess = S.session; old.misses = (old.misses || 1) + 1; }
    else S.review.push({ kind: x.kind, n: x.n, d: x.d, ask: x.ask || null, rung: x.rung, sess: S.session, misses: 1 });
    while (S.review.length > REVIEW_KEEP) S.review.shift();
  }

  // n: the number on the target picked (a remainder answer's code); good: whether it was the right one; id: its card.
  function answer(n, good, id) {
    const c = S.cur && !S.cur.closed ? S.cur : null;
    const x = c ? c.cards[c.at] : null;
    const before = S.step;
    if (!x || (id != null && id !== x.id)) {
      return { right: good === true, step: S.step, moved: 0, placed: S.placed, comeback: null, card: x ? publicCard(x) : null, waveDone: !x, first: false, stale: true };
    }
    const right = typeof good === 'boolean' ? good : n === x.answer;
    const first = !x.tried; x.tried = true;
    S.lastAt = now();
    const rs = rungStat(x.rung || 1);
    if (first) rs.cards++;
    let comeback = null;
    if (right) {
      x.done = first ? 1 : 2;
      S.clock++;
      if (first && x.helped) rs.helped++;   // (right after the help came up: well done and paid, but not a clean card)
      else if (first) {
        rs.right++;
        if (c.warmup || steered) { /* warm-ups never move the step (nor does anything, once the skill model steers) */ }
        else if (!S.placed) {
          S.step = Math.min(LADDER.length, S.step + 1);
          if (S.step === LADDER.length) S.placed = true;
        } else if (REVIEWS_COUNT_UP || (!x.review && !x.back)) {
          S.streak++;
          if (S.streak >= CLEAN_TO_CLIMB) { S.step = Math.min(LADDER.length, S.step + 1); S.streak = 0; }
        }
        if (x.back) S.review = S.review.filter((r) => !(keyOf(r) === keyOf(x) && r.sess < S.session));
      }
      for (const t of x.targets) if (!t.good && !t.picked) slipStat(t.trap).seen++;
      c.at++;
      // a climb on the first visit: the cards still to come are dealt again at the new step
      if (S.step > before && c.placing) {
        for (let i = c.at; i < c.cards.length; i++) if (!c.cards[i].back && !c.cards[i].review) c.cards[i] = cardFor(problem(S.step), S.step, c.cards[i].targets.length, { into: c });
      }
    } else {
      x.misses++;
      if (Number.isInteger(n)) x.lastPick = n;
      const t = x.targets.find((y) => y.n === n);
      if (t && !t.good && !t.picked) { t.picked = true; const st = slipStat(t.trap); st.seen++; st.fooled++; }
      if (first) {
        rs.wrong++;
        S.streak = 0;
        const counts = !steered && !c.warmup && !(x.back && (x.rung || 1) > S.step);
        if (counts) {
          if (!S.placed) {
            S.placeMisses++;
            if (S.placeMisses >= PLACEMENT_MISSES) { S.placed = true; S.step = Math.max(1, S.step - PLACE_BELOW); c.downs = MAX_DOWN_PER_WAVE; }
          } else if ((c.downs || 0) < MAX_DOWN_PER_WAVE && S.step > 1) { S.step--; c.downs = (c.downs || 0) + 1; }
        }
        const p = { kind: x.kind, n: x.n, d: x.d, ask: x.ask, rung: x.rung };
        S.soon = S.soon.filter((s) => keyOf(s) !== keyOf(p));
        if (!x.back) {
          const after = COMEBACK_MIN + Math.floor(R() * (COMEBACK_MAX - COMEBACK_MIN + 1));
          if (c.at + after <= c.cards.length) c.cards.splice(c.at + after, 0, cardFor(p, x.rung, x.targets.length, { back: true, into: c }));
          else { S.soon.push({ ...p, due: S.clock + after }); while (S.soon.length > SOON_KEEP) S.soon.shift(); }
          comeback = { text: x.text, after };
        }
        remember(p);
      }
    }
    const nowCard = c.cards[c.at] || null;
    if (!nowCard) closeWave();
    return { right, step: S.step, moved: Math.sign(S.step - before), placed: S.placed, comeback, card: nowCard ? publicCard(nowCard) : null, waveDone: !nowCard, first, helped: !!x.helped };
  }

  function closeWave() { if (S.cur && !S.cur.closed) S.cur.closed = true; }

  const asCard = (c) => (c && c.parts ? c : card());
  // explain(card, picked) or explain(picked) for the card showing now -> { slip, line, good, picture }
  function explain(c, picked) {
    if (typeof c === 'number') { picked = c; c = null; }
    c = asCard(c); if (!c) return null;
    const { slip, line } = explainPick(c, picked);
    const picture = pictureFor(c, { reveal: true, picked, reason: line });
    return { slip, line, good: picked === c.answer, picture, numberLine: picture };   // (numberLine: the same picture, under the name the round-up reads for card topics)
  }
  // help(card): the picture with the answer hidden. On a card already missed, the answer has been shown, so it brings
  // back that same picture. Before any pick it marks the card helped (a right pick still pays, but isn't clean).
  function help(c) {
    c = asCard(c); if (!c) return null;
    const live = S.cur && !S.cur.closed ? S.cur.cards[S.cur.at] : null;
    if (live && live.id === c.id && live.misses > 0 && Number.isInteger(live.lastPick)) return { ...explain(c, live.lastPick).picture, again: true };
    if (live && live.id === c.id && !live.tried) live.helped = true;
    return pictureFor(c, { reveal: false });
  }
  function hint(c) {
    c = asCard(c);
    if (c && c.kind === 'rem') return 'r means remainder: the ones left over when there aren\'t enough to go round again.';
    return c ? nudge(c) : `Dividing shares out evenly. 24 ${DIV} 6 asks how many 6s make 24 (4, because 4 ${TIMES} 6 = 24).`;
  }

  function level() {
    const r = LADDER[S.step - 1];
    return { step: S.step, of: LADDER.length, label: r.label, placing: !S.placed,
      line: `Step ${S.step} of ${LADDER.length}: ${r.label}${S.placed ? '' : ', still finding the starting step'}` };
  }
  function report() {
    return {
      level: level(), sessions: S.session, waves: S.waves, cards: S.clock,
      steps: Object.keys(S.rungs).sort((a, b) => a - b).map((k) => ({ step: Number(k), ...S.rungs[k] })),
      slips: Object.fromEntries(Object.entries(S.slips).map(([k, v]) => [k, { seen: v.seen, fooled: v.fooled }])),
      missed: S.review.map((r) => (r.kind === 'missing' ? (r.ask === 'n' ? `? ${DIV} ${r.d} = ${r.n / r.d}` : `${r.n} ${DIV} ? = ${r.n / r.d}`) : `${r.n} ${DIV} ${r.d}`)),
    };
  }
  function setStep(step) { S.step = clampInt(num(step, 1), 1, LADDER.length); S.placed = true; S.streak = 0; S.warmups = 0; }
  // The rider's skill model (src/math/skill.js) picks the step from here on (as the card trainer's steer in early.js):
  // the trainer's own climb, first-visit placement and steps down stop; placing: the strand is still finding its level
  // (no warm-ups or review cards). A new step while a wave is open deals its cards still to come again at it.
  let steered = null;
  function steer(step, { placing = false } = {}) {
    const was = S.step;
    S.step = clampInt(num(step, 1), 1, LADDER.length);
    if (!steered) { S.placed = true; S.streak = 0; S.placeMisses = 0; }
    steered = { placing: !!placing };
    const c = S.cur;
    if (c && !c.closed && !c.warmup && S.step !== was) {
      for (let i = c.at; i < c.cards.length; i++) { const x = c.cards[i]; if (!x.back && !x.review && !x.tried) c.cards[i] = cardFor(problem(S.step), S.step, x.targets.length, { into: c }); }
      c.step = S.step;
    }
    return S.step;
  }

  if (opts.newSession || !S.lastAt || now() - S.lastAt > SESSION_GAP_MS) newSession();

  return {
    topic: 'dividing', name: 'Dividing', state: S, shape: 'cards', mode: 'cards', payEvery: PAY_EVERY,
    wave, card, answer, explain, help, hint, level, report, setStep, steer, newSession,
    get steered() { return !!steered; },
    endWave: closeWave,
    due: () => [],   // (missed cards come back inside the wave's own list)
  };
}
