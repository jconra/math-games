// THE SHOOTING RANGE'S MATH: number sense. A row of bottles or tin cans stands on the range's shelf, each wearing a
// number, and a card says which ones to shoot (src/missions/shooting.js). Five kinds of card:
//   compare    "Shoot the can with the biggest number"           one right
//   order      "Shoot the bottles from smallest to largest"      all of them, one after another: right is the smallest left
//   round      "Shoot every can that rounds to 40"               two or three right
//   estimate   "Shoot the bottle closest to 19 + 22"             one right (the bottles wear round tens)
//   between    "Shoot every bottle between −3 and 5"             two or three right (the two ends are never on the shelf)
// They are levelled (STEPS) from small whole numbers up to 1,000 and then negatives. The wrong numbers on a card are the
// real slips: 45 for "rounds to 40" (halfway rounds up), 49 (it starts with a 4 but is nearer 50), 34 (nearer 30), −11
// for "the biggest" (a big number after a minus sign is a small number), the sum with the carry forgotten.
//
// A wrong pick gets one plain line why (whyNot) and a number line to look at (lineFor): a rounding card's line shows
// the two halfway marks and the stretch that rounds to the card's number; the others plot the numbers on the shelf.
//
//   const N = makeNumberSense(state)    state = rider.topics.numbersense (filled in and changed in place)
//   N.card({ rng, recent })   -> a card: { kind, step, id, rule, sub, what: 'can' | 'bottle', targets: [{ n, good, slip }],
//                                ask, review, key }. ask is what the card asks: compare { want: 'big' | 'small' },
//                                order { dir: 'up' | 'down' }, round { ten, to }, estimate { a, op, b, exact, near },
//                                between { lo, hi }. good: right to shoot (for order: in the end, all are); slip: what
//                                a wrong one is ('half', 'over', 'under', 'far', 'negbig', 'nearzero', 'close', 'carry',
//                                'borrow', 'one', 'left', 'right', 'mirror', 'other')
//   rightNow(card, gone)      -> the indices that are right to shoot now (gone: a Set of indices already shot down)
//   isDone(card, gone)        -> true once every right one is down
//   whyNot(card, i, gone)     -> one plain line: why target i isn't one to shoot now
//   tipFor(card)              -> a one-line rule of thumb for the card (the number line's caption)
//   lineFor(card, { pick, gone, hint })   -> the number line to draw (the page draws it, see shooting.js):
//                                { from, to, major, minor, half: [values], shade: { a, b, open, label } | null,
//                                  (open: 'both' leaves both ends out of the band, 'right' only the right one)
//                                  dots: [{ v, kind: 'pick' | 'right' | 'other' | 'gone' | 'exact', label }],
//                                  arrow: { from, to, label } | null, caption }
//                                hint: the card's line before any pick (a kid stuck for a while): no answer marked
//   N.finish(card, wrong, { helped })  -> { clean, moved, step, placed }   once a card is cleared (wrong: its wrong
//                                shots; helped: its number line came up by itself before it was cleared)
//   N.newString()             a new string of cards begins (a step down can come once a string)
//   N.level()                 -> { step, of, label, line }
//   numText(n)                -> '−3', '450', '1,050' (the real minus sign)
//
// Nothing here touches the page, so the node tests load it as it is (tests/numbersense.test.mjs).

import { makeRng } from '../lockbox/generate.js';

export const NS = {
  CLEAN_TO_CLIMB: 3,       // clean cards in a row (no wrong shot) to go up a step
  ROUGH: 2,                // wrong shots on one card that make it a rough card: one step down (one wrong only stops
                           // the clean run; a rounding card has five targets, so one slip there is no reason to drop)
                         // (and at most one step down in a string of cards, however rough)
  PLACE_BELOW: 1,          // the first visit climbs a step with each clean card; the second card that isn't clean
                           // ends the climb this many steps below where it was dealt
  REVIEW_EVERY: 4,         // from the third step up, every 4th card is an easier kind from lower down, for variety (it
                           // doesn't move the ladder either way)
  RECENT: 12,              // cards (by their numbers) not dealt again within this many
};

// The ladder. n: how many targets the card puts on the shelf. lo..hi: the numbers' range.
export const STEPS = [
  { id: 'big20', kind: 'compare', label: 'Biggest and smallest, up to 20', lo: 1, hi: 20, n: 4 },
  { id: 'order50', kind: 'order', label: 'Smallest to largest, up to 50', lo: 1, hi: 50, n: 3 },
  { id: 'round10', kind: 'round', label: 'Rounding to the nearest ten', to: 10, n: 5 },
  { id: 'estAdd', kind: 'estimate', label: 'Estimating a sum', ops: ['+'], n: 4 },
  { id: 'order1000', kind: 'order', label: 'Smallest to largest, up to 1,000', lo: 100, hi: 999, n: 4, place: true },
  { id: 'round100', kind: 'round', label: 'Rounding to the nearest hundred', to: 100, n: 5 },
  { id: 'estMore', kind: 'estimate', label: 'Estimating differences and products', ops: ['−', '×'], n: 4 },
  { id: 'bigNeg', kind: 'compare', label: 'Biggest and smallest, with negatives', lo: -12, hi: 12, n: 5, neg: true },
  { id: 'between', kind: 'between', label: 'Between two numbers, with negatives', n: 6 },
  { id: 'orderNeg', kind: 'order', label: 'Smallest to largest, with negatives', lo: -20, hi: 20, n: 4, neg: true },
  { id: 'orderNeg5', kind: 'order', label: 'Five in order, with bigger negatives', lo: -70, hi: 70, n: 5, neg: true, mirror: true },
];

const MINUS = '−';
export const numText = (n) => (n < 0 ? MINUS : '') + Math.abs(n).toLocaleString('en-US');
const t = numText;
const plural = (what) => (what === 'can' ? 'cans' : 'bottles');
const roundTo = (v, g) => Math.floor(v / g + 0.5) * g;   // halfway goes up (35 -> 40; −35 -> −30, never used here)

// ── THE CARDS ────────────────────────────────────────────────────────────────────────────────────────────────────
function distinct(list) { return new Set(list).size === list.length; }

function compareCard(S, rng, what) {
  const want = rng.chance(0.5) ? 'big' : 'small';
  for (let tries = 0; tries < 200; tries++) {
    const vals = new Set(), slips = {};
    if (S.neg) {
      // a positive or two, two or three below zero, and the trap: for "biggest" a negative with a big number after its
      // minus sign; for "smallest" a negative close to zero (and a small positive next to it)
      const hiPos = rng.int(2, 8);
      vals.add(hiPos);
      if (want === 'big') { const nb = -rng.int(hiPos + 2, S.hi); vals.add(nb); slips[nb] = 'negbig'; }
      else { const nz = -rng.int(1, 3); vals.add(nz); slips[nz] = 'nearzero'; vals.add(-rng.int(6, S.hi)); }
      while (vals.size < S.n) vals.add(rng.chance(0.6) ? -rng.int(1, S.hi) : rng.int(0, hiPos));
    } else {
      // one right number and one right next to it (a real compare), the rest anywhere
      const top = want === 'big' ? rng.int(S.lo + 4, S.hi) : rng.int(S.lo, S.hi - 4);
      vals.add(top);
      const near = want === 'big' ? top - rng.int(1, 2) : top + rng.int(1, 2);
      vals.add(near); slips[near] = 'close';
      while (vals.size < S.n) vals.add(want === 'big' ? rng.int(S.lo, top - 1) : rng.int(top + 1, S.hi));
    }
    const list = [...vals].slice(0, S.n);
    if (list.length < S.n) continue;
    const ans = want === 'big' ? Math.max(...list) : Math.min(...list);
    rng.shuffle(list);
    return {
      kind: 'compare', ask: { want },
      rule: `Shoot the ${what} with the ${want === 'big' ? 'biggest' : 'smallest'} number`,
      sub: S.neg ? 'Below zero, the bigger the number after the minus sign, the smaller it is' : `Just one ${what} is right`,
      targets: list.map((n) => ({ n, good: n === ans, slip: n === ans ? null : slips[n] || 'other' })),
    };
  }
  throw new Error('numbersense: no compare card');
}

function orderCard(S, rng, what) {
  const dir = (S.place || S.neg) && rng.chance(0.3) ? 'down' : 'up';
  for (let tries = 0; tries < 200; tries++) {
    let list = [];
    if (S.place) {
      // three digits shuffled into different numbers (415, 451, 154 ...): the place value is the whole question
      const d = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3);
      const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map(([a, b, c]) => d[a] * 100 + d[b] * 10 + d[c]);
      list = rng.shuffle(perms).slice(0, S.n);
    } else if (S.mirror) {
      // two numbers whose digits swap (−15 and −51), a number and its opposite (15 and −15), and one more
      const a = rng.int(1, 5), b = rng.int(a + 1, 6), x = a * 10 + b, y = b * 10 + a;
      list = [-x, -y, x, rng.chance(0.5) ? y : -rng.int(1, 9), rng.int(-9, 30)];
    } else if (S.neg) {
      // two or three below zero (one close to zero, one further), and a positive
      const far = -rng.int(6, -S.lo), near = -rng.int(1, 5);
      list = [far, near, rng.int(1, S.hi), rng.chance(0.5) ? -near : rng.int(-S.hi, S.hi)];
    } else {
      list = Array.from({ length: S.n }, () => rng.int(S.lo, S.hi));
    }
    list = list.slice(0, S.n);
    if (!distinct(list) || list.length < S.n || list.some((v) => v < -99 || v > 999)) continue;
    rng.shuffle(list);
    return {
      kind: 'order', ask: { dir },
      rule: `Shoot the ${plural(what)} from ${dir === 'up' ? 'smallest to largest' : 'largest to smallest'}`,
      sub: S.place ? 'Look at the hundreds first, then the tens' : S.neg ? 'Below zero, further from zero is smaller' : `${dir === 'up' ? 'Smallest' : 'Largest'} first, then the next`,
      targets: list.map((n) => ({ n, good: true, slip: null })),
    };
  }
  throw new Error('numbersense: no order card');
}

function roundCard(S, rng, what) {
  const g = S.to, h = g / 2;
  for (let tries = 0; tries < 300; tries++) {
    const T = rng.int(2, 9) * g;
    const vals = new Map();   // value -> slip (null: a right one)
    const nGood = rng.chance(0.5) ? 3 : 2;
    while ([...vals.values()].filter((s) => s === null).length < nGood) {
      const v = rng.int(T - h, T + h - 1);
      if (v !== T && !vals.has(v)) vals.set(v, null);
    }
    // the slips: halfway (rounds up, away from T), just past halfway with T's first digit, and nearer the ten below
    const pool = [['half', () => T + h], ['over', () => rng.int(T + h + 1, T + g - 1)], ['under', () => rng.int(T - g + 1, T - h - 1)],
      ['far', () => rng.chance(0.5) ? rng.int(T + g, T + g + h - 1) : rng.int(T - g - h, T - g - 1)]];
    rng.shuffle(pool);
    // (the halfway slip on most cards: it is the one kids most often get wrong)
    if (rng.chance(0.7)) pool.sort((a, b) => (a[0] === 'half' ? -1 : b[0] === 'half' ? 1 : 0));
    for (const [slip, make] of pool) {
      if (vals.size >= S.n) break;
      const v = make();
      if (!vals.has(v) && v >= g && v <= 10 * g - 1) vals.set(v, slip);
    }
    if (vals.size < S.n) continue;
    const list = rng.shuffle([...vals.keys()]);
    return {
      kind: 'round', ask: { ten: T, to: g },
      rule: `Shoot every ${what} that rounds to ${t(T)}`,
      sub: g === 10 ? 'Round to the nearest ten' : 'Round to the nearest hundred',
      targets: list.map((n) => ({ n, good: vals.get(n) === null, slip: vals.get(n) })),
    };
  }
  throw new Error('numbersense: no round card');
}

function estimateCard(S, rng, what) {
  for (let tries = 0; tries < 400; tries++) {
    const op = rng.pick(S.ops);
    let a, b, exact, slip = null, slipKind = null;
    if (op === '+') {
      a = rng.int(11, 59); b = rng.int(11, 49); exact = a + b;
      if (exact > 98 || a % 10 === 0 || b % 10 === 0) continue;
      if ((a % 10) + (b % 10) < 10 && rng.chance(0.7)) continue;   // (mostly sums with a carry: the slip worth seeing)
      if ((a % 10) + (b % 10) >= 10) { slip = exact - 10; slipKind = 'carry'; }   // (the carry forgotten)
    } else if (op === '−') {
      a = rng.int(41, 98); b = rng.int(12, a - 11); exact = a - b;
      if (a % 10 === 0 || b % 10 === 0) continue;
      if (a % 10 >= b % 10 && rng.chance(0.7)) continue;   // (mostly ones that need a borrow)
      if (a % 10 < b % 10) { slip = Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10)); slipKind = 'borrow'; }   // (took the small digit from the big one)
    } else {
      a = rng.int(12, 49); b = rng.int(2, 5); exact = a * b;
      if (a % 10 === 0 || exact > 240) continue;
      slip = a + b; slipKind = 'added';   // (added instead of times)
    }
    if (exact % 10 === 5 || exact % 10 === 0 || exact < 10) continue;   // (one ten is clearly nearest, and it isn't already round)
    const near = roundTo(exact, 10);
    // (rounding each number first lands on the same ten, so the card's rule of thumb never leads a kid astray:
    // 55 + 28 = 83 is nearest 80, but 60 + 30 = 90)
    if (estimateOf(a, op, b) !== near) continue;
    const decoys = new Map();
    if (slip != null && roundTo(slip, 10) !== near && roundTo(slip, 10) > 0) decoys.set(roundTo(slip, 10), slipKind);
    if (op === '×') decoys.set(roundTo(a, 10), decoys.get(roundTo(a, 10)) || 'one');   // (forgot to multiply: the first number, rounded)
    for (const d of rng.shuffle([near + 10, near - 10, near + 20, near - 20])) decoys.set(d, decoys.get(d) || 'close');
    const pickD = [...decoys.entries()].filter(([v]) => v !== near && v > 0);
    if (pickD.length < S.n - 1) continue;
    // the slip first (when there is one), then the rest in a shuffled order
    const chosen = pickD.slice(0, S.n - 1);
    const list = rng.shuffle([near, ...chosen.map(([v]) => v)]);
    if (!distinct(list)) continue;
    const kind = new Map(chosen);
    return {
      kind: 'estimate', ask: { a, op, b, exact, near },
      rule: `Shoot the ${what} closest to ${a} ${op} ${b}`,
      // (a times card rounds only the big number: rounding the 2 of 32 × 2 to the nearest ten would make it 0)
      sub: op === '×' ? 'Round the big number to the nearest ten first, or work it out' : 'Round each number to the nearest ten first, or work it out',
      targets: list.map((n) => ({ n, good: n === near, slip: n === near ? null : kind.get(n) || 'close' })),
    };
  }
  throw new Error('numbersense: no estimate card');
}

function betweenCard(S, rng, what) {
  for (let tries = 0; tries < 300; tries++) {
    const lo = -rng.int(1, 8), hi = rng.int(2, 9);
    if (hi - lo < 5) continue;
    const vals = new Map();
    const nGood = rng.chance(0.5) ? 3 : 2;
    // a right one below zero (when there is room), the rest anywhere inside
    if (lo < -1) vals.set(rng.int(lo + 1, -1), null);
    while ([...vals.values()].filter((s) => s === null).length < nGood) { const v = rng.int(lo + 1, hi - 1); if (!vals.has(v)) vals.set(v, null); }
    // the slips: just left of the low end (a negative that looks bigger), just past the high end, and the high end's
    // opposite (−5 when the card says 5)
    const slips = rng.shuffle([['left', lo - rng.int(1, 3)], ['right', hi + rng.int(1, 3)], ['mirror', -hi]]);
    for (const [slip, v] of slips) if (vals.size < S.n && !vals.has(v) && v !== lo && v !== hi && (v < lo || v > hi) && Math.abs(v) <= 12) vals.set(v, slip);
    while (vals.size < S.n) {
      const v = rng.chance(0.5) ? lo - rng.int(1, 4) : hi + rng.int(1, 4);
      if (!vals.has(v) && Math.abs(v) <= 12) vals.set(v, v < lo ? 'left' : 'right');
    }
    const list = rng.shuffle([...vals.keys()]);
    return {
      kind: 'between', ask: { lo, hi },
      rule: `Shoot every ${what} between ${t(lo)} and ${t(hi)}`,
      sub: `${t(lo)} and ${t(hi)} aren't on the shelf: only numbers in between`,
      targets: list.map((n) => ({ n, good: vals.get(n) === null, slip: vals.get(n) })),
    };
  }
  throw new Error('numbersense: no between card');
}

const MAKE = { compare: compareCard, order: orderCard, round: roundCard, estimate: estimateCard, between: betweenCard };

// ── RIGHT AND WRONG ──────────────────────────────────────────────────────────────────────────────────────────────
// the targets still standing
const standing = (card, gone) => card.targets.map((x, i) => i).filter((i) => !gone.has(i));

export function rightNow(card, gone = new Set()) {
  const left = standing(card, gone);
  if (card.kind === 'order') {
    if (!left.length) return [];
    const pick = card.ask.dir === 'up' ? Math.min(...left.map((i) => card.targets[i].n)) : Math.max(...left.map((i) => card.targets[i].n));
    return left.filter((i) => card.targets[i].n === pick);
  }
  return left.filter((i) => card.targets[i].good);
}

export const isDone = (card, gone = new Set()) => rightNow(card, gone).length === 0;

const hundreds = (v) => Math.floor(Math.abs(v) / 100), tens = (v) => Math.floor(Math.abs(v) / 10) % 10;
const hundredsText = (v) => `${hundreds(v)} hundred${hundreds(v) === 1 ? '' : 's'}`;

export function whyNot(card, i, gone = new Set()) {
  const v = card.targets[i].n, A = card.ask;
  if (card.kind === 'compare') {
    const vals = card.targets.map((x) => x.n), m = A.want === 'big' ? Math.max(...vals) : Math.min(...vals);
    if (A.want === 'big') {
      if (v < 0 && Math.abs(v) > m) return `${t(v)} is ${Math.abs(v)} below zero, so it's small, not big. ${t(m)} is the biggest.`;
      return `${t(m)} is bigger than ${t(v)}: it sits further right on the number line.`;
    }
    if (v < 0) return `${t(v)} is only ${Math.abs(v)} below zero. ${t(m)} is ${Math.abs(m)} below zero, so ${t(m)} is smaller.`;
    if (m < 0) return `Every number below zero is smaller than ${t(v)}. ${t(m)} is the smallest.`;
    return `${t(m)} is smaller than ${t(v)}: it sits further left on the number line.`;
  }
  if (card.kind === 'order') {
    const nxt = rightNow(card, gone).map((k) => card.targets[k].n)[0];
    if (nxt == null) return '';
    const first = A.dir === 'up' ? 'smaller' : 'bigger';
    if (v < 0 && nxt < 0 && A.dir === 'up') return `${t(nxt)} is further below zero than ${t(v)}, so it comes first.`;
    if (v < 0 && nxt < 0) return `${t(nxt)} is closer to zero than ${t(v)}, so it's bigger: it comes first.`;
    if (Math.abs(v) >= 100 && Math.abs(nxt) >= 100 && hundreds(v) !== hundreds(nxt)) return `${t(nxt)} comes first: it has ${hundredsText(nxt)}, and ${t(v)} has ${hundredsText(v)}.`;
    if (Math.abs(v) >= 100 && Math.abs(nxt) >= 100 && tens(v) !== tens(nxt)) return `${t(nxt)} comes first: the hundreds match, so look at the tens (${tens(nxt)} against ${tens(v)}).`;
    return `${t(nxt)} comes first: it's ${first} than ${t(v)}.`;
  }
  if (card.kind === 'round') {
    const T = A.ten, g = A.to, h = g / 2, R = roundTo(v, g);
    if (v === T + h) return `${t(v)} is exactly halfway between ${t(T)} and ${t(T + g)}, and halfway rounds up: to ${t(T + g)}.`;
    if (R > T && v < T + g) return `${t(v)} starts like ${t(T)}, but it's past the halfway mark at ${t(T + h)}: it rounds up to ${t(R)}.`;
    if (R < T && v > T - g) return `${t(v)} hasn't reached the halfway mark at ${t(T - h)}, so it rounds down to ${t(R)}.`;
    return `${t(v)} rounds to ${t(R)}, not ${t(T)}.`;
  }
  if (card.kind === 'estimate') {
    const { a, op, b, exact, near } = A;
    return `${a} ${op} ${b} = ${exact}. ${t(v)} is ${Math.abs(v - exact)} away from it, but ${t(near)} is only ${Math.abs(near - exact)} away.`;
  }
  if (card.kind === 'between') {
    const { lo, hi } = A;
    if (card.targets[i].slip === 'mirror' && v < lo) return `${t(v)} isn't ${t(-v)}: it's below zero, left of ${t(lo)}, so it's outside.`;
    if (v < lo && v < 0 && lo < 0) return `${t(v)} is further below zero than ${t(lo)}: it's left of ${t(lo)}, outside.`;
    if (v < lo) return `${t(v)} is left of ${t(lo)} on the number line, so it's outside.`;
    return `${t(v)} is past ${t(hi)}, so it's outside.`;
  }
  return '';
}

// rounding each number to the nearest ten first (a single-digit times stays as it is)
export function estimateOf(a, op, b) {
  const ra = roundTo(a, 10), rb = op === '×' ? b : roundTo(b, 10);
  return op === '+' ? ra + rb : op === '−' ? ra - rb : ra * rb;
}

// a rule of thumb for the card (the number line's caption, and the "stuck" help)
export function tipFor(card) {
  const A = card.ask;
  if (card.kind === 'round') return `Halfway is ${t(A.ten - A.to / 2)} and ${t(A.ten + A.to / 2)}. Halfway rounds up.`;
  if (card.kind === 'estimate') {
    const ra = roundTo(A.a, 10), rb = A.op === '×' ? A.b : roundTo(A.b, 10), est = estimateOf(A.a, A.op, A.b);
    return `Round first: ${A.a} is about ${ra}${A.op === '×' ? '' : `, ${A.b} is about ${rb}`}, and ${ra} ${A.op} ${rb} = ${est}.`;
  }
  if (card.kind === 'between') return `Between ${t(A.lo)} and ${t(A.hi)}: right of ${t(A.lo)} and left of ${t(A.hi)}.`;
  if (card.kind === 'order') return A.dir === 'up' ? 'Smaller numbers sit further left on the number line.' : 'Bigger numbers sit further right on the number line.';
  return A.want === 'big' ? 'The biggest sits furthest right on the number line.' : 'The smallest sits furthest left on the number line.';
}

// a step for the labels: 1, 2, 5, 10, 20, 50 ... so a line from `from` to `to` has about 4 to 12 labels
function niceStep(span, most = 12) {
  for (const s of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) if (span / s <= most) return s;
  return 1000;
}

export function lineFor(card, { pick = null, gone = new Set(), hint = false } = {}) {
  const A = card.ask, vals = card.targets.map((x) => x.n);
  const right = new Set(hint ? [] : rightNow(card, gone));
  if (card.kind === 'round') {
    const T = A.ten, g = A.to, h = g / 2;
    const v = pick != null ? card.targets[pick].n : null;
    let from = T - g, to = T + g;
    if (v != null) { from = Math.min(from, Math.floor(v / g) * g); to = Math.max(to, Math.ceil((v + 1) / g) * g); }
    const dots = v != null ? [{ v, kind: 'pick', label: t(v) }] : [];
    const R = v != null ? roundTo(v, g) : null;
    return { from, to, major: h, minor: g / 10, half: [T - h, T + h].filter((x) => x > from && x < to), shade: { a: T - h, b: T + h, open: 'right', label: `rounds to ${t(T)}` },
      dots, arrow: v != null && R !== v ? { from: v, to: R, label: `rounds to ${t(R)}` } : null, caption: tipFor(card) };
  }
  if (card.kind === 'estimate') {
    const lo = Math.min(...vals, A.exact), hi = Math.max(...vals, A.exact);
    const from = Math.floor((lo - 5) / 10) * 10, to = Math.ceil((hi + 5) / 10) * 10;
    const dots = vals.map((n, i) => ({ v: n, kind: i === pick ? 'pick' : 'other', label: i === pick ? t(n) : '' }));
    if (!hint) dots.push({ v: A.exact, kind: 'exact', label: `${A.a} ${A.op} ${A.b} = ${A.exact}` });
    return { from, to, major: niceStep(to - from), minor: niceStep(to - from) >= 10 ? 5 : 1, half: [], shade: null, dots,
      arrow: !hint ? { from: A.exact, to: A.near, label: '' } : null, caption: tipFor(card) };
  }
  // compare, order, between: the numbers on the shelf, on a line wide enough for all of them (and zero, and the card's ends)
  const ends = card.kind === 'between' ? [A.lo, A.hi] : [];
  const lo = Math.min(...vals, ...ends, vals.some((n) => n < 0) ? 0 : Infinity), hi = Math.max(...vals, ...ends, vals.some((n) => n < 0) ? 0 : -Infinity);
  const span = Math.max(4, hi - lo), major = niceStep(span * 1.2), pad = Math.max(1, Math.round(span * 0.08));
  const from = Math.floor((lo - pad) / major) * major, to = Math.ceil((hi + pad) / major) * major;
  const dots = vals.map((n, i) => ({ v: n, kind: i === pick ? 'pick' : gone.has(i) ? 'gone' : right.has(i) ? 'right' : 'other', label: t(n) }));
  return { from, to, major, minor: major >= 10 ? major / 5 : major > 1 ? 1 : 0, half: [],
    shade: card.kind === 'between' ? { a: A.lo, b: A.hi, open: 'both', label: `between ${t(A.lo)} and ${t(A.hi)}` } : null,
    dots, arrow: null, caption: tipFor(card) };
}

// ── THE LADDER ───────────────────────────────────────────────────────────────────────────────────────────────────
export function makeNumberSense(state = {}) {
  const S = state;
  const fill = (k, v) => { if (S[k] === undefined || S[k] === null || typeof S[k] !== typeof v) S[k] = v; };
  fill('step', 0); fill('clean', 0); fill('placed', false); fill('misses', 0); fill('cards', 0); fill('down', false); fill('what', 'can');
  S.step = Math.max(0, Math.min(STEPS.length - 1, Math.round(S.step) || 0));
  const N = {};

  N.card = ({ rng = makeRng(), recent = [] } = {}) => {
    S.cards++;
    S.what = S.what === 'can' ? 'bottle' : 'can';   // (cans and bottles in turn)
    let stepI = S.step, review = false;
    if (S.placed && S.step >= 2 && S.cards % NS.REVIEW_EVERY === 0) {
      // an easier kind from lower down, for variety (not the kind this step deals, when there is another)
      const lower = STEPS.slice(0, S.step).map((s, i) => i).filter((i) => STEPS[i].kind !== STEPS[S.step].kind);
      if (lower.length) { stepI = rng.pick(lower); review = true; }
    }
    const step = STEPS[stepI];
    let card = null;
    for (let k = 0; k < 8; k++) {
      card = MAKE[step.kind](step, rng, S.what);
      card.key = card.kind + ':' + card.targets.map((x) => x.n).sort((a, b) => a - b).join(',') + (card.ask.ten ?? card.ask.exact ?? card.ask.lo ?? '');
      if (!recent.includes(card.key)) break;
    }
    return { ...card, step: stepI, id: step.id, what: S.what, review };
  };

  N.finish = (card, wrong = 0, { helped = false } = {}) => {
    const clean = wrong === 0 && !helped;
    let moved = 0;
    if (card.review) return { clean, moved, step: S.step, placed: S.placed };
    // cleared with no wrong shot, but after the number line had shown where the numbers sit: well shot and paid, but
    // not a clean card, so it neither climbs nor counts as a slip (the clean run waits)
    if (helped && wrong === 0) return { clean, moved, step: S.step, placed: S.placed };
    if (!S.placed) {
      // the first visit: up a step with each clean card; the second card that isn't clean ends the climb
      if (clean) { if (S.step < STEPS.length - 1) { S.step++; moved = 1; } else S.placed = true; }
      else if (++S.misses >= 2) { const to = Math.max(0, card.step - NS.PLACE_BELOW); moved = to - S.step; S.step = to; S.placed = true; }
      S.clean = 0;
      return { clean, moved, step: S.step, placed: S.placed };
    }
    if (clean) {
      if (++S.clean >= NS.CLEAN_TO_CLIMB && S.step < STEPS.length - 1) { S.step++; S.clean = 0; moved = 1; }
    } else {
      S.clean = 0;
      if (wrong >= NS.ROUGH && !S.down && S.step > 0) { S.step--; S.down = true; moved = -1; }
    }
    return { clean, moved, step: S.step, placed: S.placed };
  };

  N.newString = () => { S.down = false; };
  N.level = () => ({ step: S.step + 1, of: STEPS.length, label: STEPS[S.step].label, line: `Step ${S.step + 1} of ${STEPS.length}: ${STEPS[S.step].label}` });
  N.state = S;
  return N;
}
