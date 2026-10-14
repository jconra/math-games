// The "Taking away" topic (ages 6 to 8) behind the round-up and the sick sheep.
//
// A wave is a few cards, one after another; each card brings a small herd of numbers with one right answer:
//   diff  "9 − 4 = ?"                              rope the 5
//   left  "9 cows, 4 run off" (how many are left?)  rope the 5
//   part  "8 − ? = 5"                              rope the 3 (how many were taken)
// The wrong numbers on a card are the real slips kids make, never random ones:
//   countStart  counted the starting number as a hop back (9 − 4: "9, 8, 7, 6", so 6): one too many
//   under       one too far back
//   added       added instead of taking away (9 + 4 = 13)
//   given       picked the number taken away (the 4)
//   noTen       17 − 4 = 3: the ten got lost
//   flip        took the smaller from the bigger in the ones: 13 − 5 = 12 (did 5 − 3), 52 − 27 = 35
//   noBorrow    broke a ten for the ones but kept it: 34 − 6 = 38
//   place       46 − 20 = 44 (the tens came off the ones)       zeros  70 − 30 = 4 (lost the zero)
//   half        58 − 23 = 38 (took away the 20, forgot the 3)   tenOff off by a ten
//   on a missing-number card: left (picked the 5 left), total (the 8), added (8 + 5), countStart (counted the 8 too)
// A wrong pick gets one plain line that names the slip and says the right answer, and the helper (src/ui/counthelp.js)
// shows the counters in ten-frames with the ones taken away crossed out, and the number line with a hop back for each
// step (hops of ten, and back to the ten, for the bigger numbers).
//
// The ladder (see LADDER) starts with taking away 1 or 2 and climbs through taking from 10 and past 10 to two-digit
// numbers. The climb, the comebacks and the sessions are the card trainer's (src/math/early.js).
//
//   const T = makeTaking(rider.topics.taking ||= {})      the same shape as every card topic (see early.js)
//   sheepItem(step, sick, rand, used)                      a sum written over a sheep (missions/sheepmath.js)
import { makeCardTrainer, pickTargets, countLine, int, pick, sheepItemFor, unitHops, chunkHops, around, MINUS } from './early.js';

export const LADDER = [
  { shapes: ['minus12'], label: `Taking away 1 or 2 (7 ${MINUS} 1)` },
  { shapes: ['small'], label: `Taking away up to 10 (9 ${MINUS} 4)` },
  { shapes: ['from10', 'left'], weights: { from10: 1.5, left: 1 }, label: 'Taking from 10, and how many are left' },
  { shapes: ['part', 'small'], weights: { part: 2, small: 1 }, label: `Missing numbers (8 ${MINUS} ? = 5)` },
  { shapes: ['teen'], label: `Taking away from 11 to 20 (17 ${MINUS} 4)` },
  { shapes: ['bridge', 'left20'], weights: { bridge: 3, left20: 1 }, label: `Taking away past 10 (13 ${MINUS} 5)` },
  { shapes: ['tensOnes', 'tens'], weights: { tensOnes: 1.5, tens: 1 }, label: `Two-digit numbers (34 ${MINUS} 6, 46 ${MINUS} 20)` },
  { shapes: ['twoDigit'], label: `Two-digit take away two-digit (52 ${MINUS} 27)` },
];

// ---- problems ---------------------------------------------------------------------------------------------------

export const answerOf = (p) => (p.shape === 'part' ? p.a - p.r : p.shape === 'diff' || p.shape === 'left' ? p.a - p.b : NaN);
export const key = (p) => (p.shape === 'part' ? `part:${p.a}:${p.r}` : `${p.shape}:${p.a}-${p.b}`);
const tensOf = (n) => Math.floor(n / 10);

// A problem of one shape (the row's generator), as { shape: 'diff' | 'left', a, b } or { shape: 'part', a, r }.
export function problem(shape, row, rand) {
  switch (shape) {
    case 'minus12': { const b = rand() < 0.55 ? 1 : 2; return { shape: 'diff', a: int(b + 1, 10, rand), b }; }
    case 'small': { const a = int(4, 10, rand); return { shape: 'diff', a, b: int(2, a - 1, rand) }; }
    case 'from10': return { shape: 'diff', a: 10, b: int(1, 9, rand) };
    case 'left': { const a = int(4, 10, rand); return { shape: 'left', a, b: int(1, a - 1, rand) }; }
    case 'part': { const a = int(4, 10, rand); return { shape: 'part', a, r: int(1, a - 1, rand) }; }
    case 'teen': {
      const a = int(11, 19, rand);
      if (rand() < 0.2) return { shape: 'diff', a, b: 10 };
      return { shape: 'diff', a, b: int(1, Math.max(1, a % 10), rand) };
    }
    case 'bridge': { const a = int(11, 18, rand); return { shape: 'diff', a, b: int((a % 10) + 1, 9, rand) }; }
    case 'left20': { const a = int(11, 20, rand); return { shape: 'left', a, b: int(2, 9, rand) }; }
    case 'tensOnes': {
      // a two-digit number take away a one-digit one, mostly breaking a ten (34 − 6)
      const a = int(2, 9, rand) * 10 + int(0, 7, rand), b = rand() < 0.75 ? int((a % 10) + 1, 9, rand) : int(1, Math.max(1, a % 10), rand);
      return { shape: 'diff', a, b };
    }
    case 'tens': {
      if (rand() < 0.4) { const x = int(3, 9, rand), y = int(1, x - 1, rand); return { shape: 'diff', a: x * 10, b: y * 10 }; }
      const a = int(2, 9, rand) * 10 + int(1, 9, rand), b = int(1, tensOf(a) - 1 || 1, rand) * 10;
      return { shape: 'diff', a, b };
    }
    case 'twoDigit':
    default: {
      const borrow = rand() < 0.6;
      for (let k = 0; k < 30; k++) {
        const a = int(3, 9, rand) * 10 + int(0, 9, rand), b = int(1, tensOf(a) - 1, rand) * 10 + int(1, 9, rand);
        if (a - b >= 5 && ((a % 10) < (b % 10)) === borrow) return { shape: 'diff', a, b };
      }
      return { shape: 'diff', a: 52, b: 27 };
    }
  }
}

// ---- the slips --------------------------------------------------------------------------------------------------

// The ones taken smaller-from-bigger: 52 − 27 -> tens 5 − 2 = 3, ones 7 − 2 = 5: 35
const flipOf = (a, b) => (tensOf(a) - tensOf(b)) * 10 + Math.abs((a % 10) - (b % 10));

export function slipsOf(p) {
  const s = [], push = (n, trap, w) => s.push({ n, trap, w });
  if (p.shape === 'part') {
    const { a, r } = p, x = a - r;
    push(r, 'left', 3); push(a, 'total', 2.5); push(a + r, 'added', 2); push(x + 1, 'countStart', 1.5); push(x - 1, 'under', 1);
    return s.filter((y) => y.n >= 0 && y.n !== x);
  }
  const { a, b } = p, r = a - b, borrow = (a % 10) < (b % 10);
  if (a <= 20 && b < 10) {
    if (borrow && a > 10) push(flipOf(a, b), 'flip', 3);
    push(r + 1, 'countStart', 3); push(a + b, 'added', 2.5);
    if (!borrow && r >= 10) push(r - 10, 'noTen', 2.5);
    if (b !== r) push(b, 'given', 1.5);
    push(r - 1, 'under', 1.5);
  } else if (a <= 20) {
    // 15 − 10
    push(a + b, 'added', 2.5); push(r + 10, 'tenOff', 2); push(a - 1, 'byOne', 2); push(r + 1, 'countStart', 1); push(b, 'given', 1);
  } else if (b < 10) {
    if (borrow) { push(flipOf(a, b), 'flip', 3); push(r + 10, 'noBorrow', 2.5); }
    push(r + 1, 'countStart', 1.5); push(r - 1, 'under', 1.2); push(r - 10, 'tenOff', 1); push(a + b, 'added', 1);
  } else if (a % 10 === 0 && b % 10 === 0) {
    push(r / 10, 'zeros', 2.5); push(r + 10, 'tenOff', 1.5); push(r - 10, 'tenOff', 1.5); push(a + b, 'added', 1.5);
  } else if (b % 10 === 0) {
    push(a - b / 10, 'place', 2.5); push(r + 10, 'tenOff', 1.5); push(r - 10, 'tenOff', 1.5); push(a + b, 'added', 1.2);
  } else {
    if (borrow) { push(flipOf(a, b), 'flip', 3); push(r + 10, 'noBorrow', 2.5); }
    else push(r + (b % 10), 'half', 1.5);
    push(r + 10, 'tenOff', 1.3); push(r - 10, 'tenOff', 1.3); push(r + 1, 'countStart', 1); push(r - 1, 'under', 1); push(a + b, 'added', 0.8);
  }
  return s.filter((y) => y.n >= 0 && y.n !== r);
}

export function classify(p, n) {
  if (n === answerOf(p)) return null;
  const s = slipsOf(p).find((x) => x.n === n);
  return s ? s.trap : 'other';
}

// ---- the card ---------------------------------------------------------------------------------------------------

function words(p) {
  if (p.shape === 'part') {
    const x = p.a - p.r;
    return { text: `${p.a} ${MINUS} ? = ${p.r}`, rule: `${p.a} ${MINUS} ? = ${p.r}`, sub: 'Rope the missing number: how many were taken?', done: `${p.a} ${MINUS} ${x} = ${p.r}`, say: `${p.a} take away what leaves ${p.r}` };
  }
  const r = p.a - p.b;
  if (p.shape === 'left') {
    return { text: `${p.a} ${MINUS} ${p.b}`, rule: `${p.a} cows, ${p.b} run off`, sub: 'How many are left? Rope that many', done: `${p.a} ${MINUS} ${p.b} = ${r}: ${r} left`, say: `${p.a} cows, ${p.b} run off` };
  }
  return { text: `${p.a} ${MINUS} ${p.b}`, rule: `${p.a} ${MINUS} ${p.b} = ?`, sub: 'Rope the answer', done: `${p.a} ${MINUS} ${p.b} = ${r}`, say: `${p.a} take away ${p.b}` };
}

export function card(p, { size = 5, rand = Math.random, avoid = null } = {}) {
  const a = answerOf(p);
  return { ...words(p), answer: a, targets: pickTargets(a, slipsOf(p), size, rand, { min: 0, max: 999, avoid }) };
}

// ---- words for the kid ------------------------------------------------------------------------------------------

export function whyNot(c, picked) {
  const p = c.parts, slip = classify(p, picked);
  let line;
  if (p.shape === 'part') {
    const { a, r } = p, x = a - r, hops = `${x} hop${x === 1 ? '' : 's'}`;
    if (slip === 'left') line = `That's the ${r} left. How many went? From ${r} up to ${a} is ${x}: ${a} ${MINUS} ${x} = ${r}.`;
    else if (slip === 'total') line = `That's the ${a} you started with. ${a} ${MINUS} ${x} = ${r}, so ${x} ${x === 1 ? 'was' : 'were'} taken.`;
    else if (slip === 'added') line = `That's ${a} + ${r}. Count back from ${a} to ${r}: ${hops}, so ${a} ${MINUS} ${x} = ${r}.`;
    else if (slip === 'countStart') line = `You counted the ${a} too. From ${a} back to ${r} is ${hops}: ${countLine(a, r)}.`;
    else if (slip === 'under') line = `One short. From ${a} back to ${r} is ${hops}: ${a} ${MINUS} ${x} = ${r}.`;
    else line = `Not that one. From ${a} back to ${r} is ${hops}: ${a} ${MINUS} ${x} = ${r}.`;
    return { slip, line };
  }
  const { a, b } = p, r = a - b, sum = `${a} ${MINUS} ${b} = ${r}`, back = `Start at ${a} and hop back ${b}`;
  const oa = a % 10, ob = b % 10;
  switch (slip) {
    case 'countStart':
      line = a <= 20 && b < 10 ? `You counted the ${a} as a hop. ${back}: ${countLine(a, r)}.` : `Just one too many. ${sum}.`;
      break;
    case 'under': line = a <= 20 && b < 10 ? `One too far back. ${back}: ${countLine(a, r)}.` : `Just one too far. ${sum}.`; break;
    case 'added': line = `That's ${a} + ${b}. The ${MINUS} means take away: ${sum}.`; break;
    case 'given': line = `That's the ${b} taken away. What's left is ${sum}.`; break;
    case 'noTen': line = `The ten is still there: ${oa} ${MINUS} ${b} = ${oa - b}, and the ten makes ${r}.`; break;
    case 'byOne': line = `That took away 1, not ${b}. ${b} is one ten: ${sum}.`; break;
    case 'flip':
      line = a < 20
        ? `That did ${ob} ${MINUS} ${oa}. ${oa} can't take away ${ob}: go back ${oa} to 10, then ${ob - oa} more: ${r}.`
        : `That did ${ob} ${MINUS} ${oa}. ${oa} can't take away ${ob}, so break a ten: ${10 + oa} ${MINUS} ${ob} = ${10 + oa - ob}, and ${sum}.`;
      break;
    case 'noBorrow': line = `You broke a ten for the ones, but kept it too. ${10 + oa} ${MINUS} ${ob} = ${10 + oa - ob}, and one ten fewer: ${r}.`; break;
    case 'place': line = `The ${b / 10} tens came off the ones. ${b} is ${b / 10} tens: ${sum}.`; break;
    case 'zeros': line = `${a / 10} tens take away ${b / 10} tens is ${r / 10} tens: ${r}, not ${r / 10}.`; break;
    case 'half': line = `That only took away the ${b - ob}. Take the ${ob} too: ${sum}.`; break;
    case 'tenOff': line = `Off by ten. Take the tens, then the ones: ${sum}.`; break;
    default: line = a <= 20 && b < 10 ? `Not that one. ${back}: ${countLine(a, r)}.` : `Not that one. Take the tens, then the ones: ${sum}.`;
  }
  return { slip, line };
}

export function nudge(c) {
  const p = c.parts;
  if (p.shape === 'part') return `Count back from ${p.a} to ${p.r}. How many hops?`;
  const { a, b } = p, oa = a % 10, ob = b % 10;
  if (a <= 20 && b < 10) {
    if (a > 10 && oa < b) return `Go back ${oa} to get to 10. How many more to go back?`;
    if (a > 10) return `Take ${b} from the ${oa} ones. The ten stays.`;
    return `Start at ${a} and hop back ${b}.`;
  }
  if (b < 10) return oa < ob ? `${oa} can't take away ${ob}: break a ten into ones first.` : `Take ${b} from the ${oa} ones. The tens stay.`;
  if (a % 10 === 0 && b % 10 === 0) return `${a / 10} tens take away ${b / 10} tens.`;
  if (b % 10 === 0) return `Take away ${b / 10} tens. The ones stay ${oa}.`;
  return `Take the tens, then the ones.${oa < ob ? ` (${oa} can't take away ${ob}: break a ten first.)` : ''}`;
}

export function picture(c) {
  const p = c.parts;
  if (p.shape === 'part') {
    const { a, r } = p, x = a - r;
    return { helper: 'count', frame: a <= 20 ? { kind: 'takePart', a, b: x } : null,
      line: { ...around([a, r]), start: a, end: r, ask: 'hops', hops: a <= 20 ? unitHops(a, -x) : chunkHops(a, -x) } };
  }
  const { a, b } = p, r = a - b;
  if (a <= 20 && b < 10) return { helper: 'count', frame: { kind: 'take', a, b }, line: { ...around([a, r]), start: a, end: r, hops: unitHops(a, -b) } };
  return { helper: 'count', frame: a <= 20 ? { kind: 'take', a, b } : null, line: { ...around([a, r]), start: a, end: r, hops: chunkHops(a, -b) } };
}

// ---- the trainer --------------------------------------------------------------------------------------------------

export const SPEC = {
  topic: 'taking', name: 'Taking away', LADDER, problem, key, answerOf, card, whyNot, nudge, picture, slipsOf,
  hint: 'Start at the first number and hop back.',
  sheepText: (p, v) => (p.shape === 'part' ? `${p.a} ${MINUS} ${v} = ${p.r}` : `${p.a} ${MINUS} ${p.b} = ${v}`),
  // (the "cows run off" story reads as a plain sum over a sheep, and so does a missing number: "8 − ? = 5" is written
  // 8 − 3 = 5. Then the slip, and every bottle, is always the answer at the end. With the slip in the middle, "6 − 4 = 3"
  // could be cured two ways: the game's 6 − 3 = 3, or a "wrong" bottle's 6 − 4 = 2)
  sheepProblem: (row, rand) => {
    const q = problem(pick(row.shapes, rand), row, rand);
    if (q.shape === 'left') return { ...q, shape: 'diff' };
    return q.shape === 'part' ? { shape: 'diff', a: q.a, b: q.a - q.r } : q;
  },
};

export function makeTaking(state, opts) { return makeCardTrainer(SPEC, state, opts); }
export function sheepItem(step, sick, rand, used) { return sheepItemFor(SPEC, step, sick, rand, used); }
