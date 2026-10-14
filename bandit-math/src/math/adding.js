// The "Adding" topic (ages 5 to 8) behind the round-up and the sick sheep.
//
// A wave is a few cards, one after another; each card brings a small herd of numbers with one right answer:
//   sum   "8 + 5 = ?"     rope the 13
//   part  "3 + ? = 8"     rope the 5 (the number that goes with 3 to make 8; "7 + ? = 10" makes ten)
// The wrong numbers on a card are the real slips kids make, never random ones:
//   countStart  counted the starting number as a hop (8 + 5: "8, 9, 10, 11, 12", so 12): one short
//   over        one too many
//   takeAway    took away instead of adding (8 − 5 = 3)
//   given       picked one of the numbers on the card (the 8)
//   noTen       past 10, kept only the ones (8 + 5 = 3)
//   place       put a number in the wrong place: 23 + 5 = 73 (the 5 went in the tens), 34 + 20 = 36 (the tens in the ones)
//   zeros       30 + 40 = 7 (added the tens and lost the zero)
//   noCarry     27 + 6 = 23: 7 + 6 made a new ten and it was dropped
//   stuck       27 + 6 = 213: the 13 written in the ones place
//   half        36 + 27 = 56: added the 20 and forgot the 7
//   tenOff      off by a ten
//   on a missing-number card: total (picked the 8), added (3 + 8 = 11), given (the 3), countStart (counted the 3 too)
// A wrong pick gets one plain line that names the slip and says the right answer, and the helper (src/ui/counthelp.js)
// shows the sum in ten-frames (the second number fills the first frame up to ten, then spills over) and on a number
// line with a hop for each step counted on, or hops of ten and to the next ten for the bigger numbers.
//
// The ladder (see LADDER) starts with adding 1 or 2 and climbs through making ten, doubles and adding past ten to
// two-digit sums up to 100. The climb, the comebacks and the sessions are the card trainer's (src/math/early.js).
//
//   const A = makeAdding(rider.topics.adding ||= {})      the same shape as every card topic (see early.js)
//   sheepItem(step, sick, rand, used)                      a sum written over a sheep (missions/sheepmath.js)
import { makeCardTrainer, pickTargets, countLine, int, pick, sheepItemFor, unitHops, chunkHops, around } from './early.js';

export const LADDER = [
  { shapes: ['plus12'], label: 'Adding 1 or 2 (4 + 1, 6 + 2)' },
  { shapes: ['small'], label: 'Adding up to 10 (3 + 4)' },
  { shapes: ['make10', 'part'], weights: { make10: 2, part: 1 }, label: 'Making 10, and missing numbers (7 + ? = 10)' },
  { shapes: ['doubles'], label: 'Doubles and near doubles (6 + 6, 6 + 7)' },
  { shapes: ['bridge'], label: 'Adding past 10 (8 + 5)' },
  { shapes: ['tensOnes', 'tens'], label: 'Tens and ones, no carrying (23 + 5, 34 + 20)' },
  { shapes: ['carry', 'part20'], weights: { carry: 3, part20: 1 }, label: 'Carrying a ten (27 + 6)' },
  { shapes: ['twoDigit'], label: 'Two-digit sums up to 100 (36 + 27)' },
];

// ---- problems ---------------------------------------------------------------------------------------------------

export const answerOf = (p) => (p.shape === 'part' ? p.t - p.a : p.shape === 'sum' ? p.a + p.b : NaN);
export const key = (p) => (p.shape === 'part' ? `part:${p.a}:${p.t}` : `sum:${p.a}+${p.b}`);
const sum = (a, b, rand, flip = 0.5) => (rand() < flip ? { shape: 'sum', a: b, b: a } : { shape: 'sum', a, b });

// A problem of one shape (the row's generator), as { shape: 'sum', a, b } or { shape: 'part', a, t }.
export function problem(shape, row, rand) {
  switch (shape) {
    case 'plus12': { const b = rand() < 0.55 ? 1 : 2; return sum(int(1, 10 - b, rand), b, rand, 0.25); }
    case 'small': {
      for (let k = 0; k < 20; k++) {
        const a = int(2, 8, rand), b = int(2, 8, rand);
        if (a + b <= 10 && a + b >= 5) return { shape: 'sum', a, b };
      }
      return { shape: 'sum', a: 3, b: 4 };
    }
    case 'make10': return { shape: 'part', a: int(1, 9, rand), t: 10 };
    case 'part': { const t = int(5, 9, rand); return { shape: 'part', a: int(1, t - 1, rand), t }; }
    case 'doubles': { const a = int(2, 10, rand); return rand() < 0.5 ? { shape: 'sum', a, b: a } : sum(a, a + 1, rand); }
    case 'bridge': {
      for (let k = 0; k < 20; k++) {
        const a = int(5, 9, rand), b = int(2, 9, rand);
        if (a + b >= 11 && a + b <= 18 && a !== b) return sum(a, b, rand, 0.3);
      }
      return { shape: 'sum', a: 8, b: 5 };
    }
    case 'tensOnes': {
      const a = int(1, 8, rand) * 10 + int(1, 8, rand), b = int(1, 9 - (a % 10), rand);
      return sum(a, b, rand, 0.15);
    }
    case 'tens': {
      if (rand() < 0.45) { const x = int(1, 6, rand), y = int(1, 9 - x, rand); return { shape: 'sum', a: x * 10, b: y * 10 }; }
      const a = int(1, 7, rand) * 10 + int(1, 9, rand), b = int(1, 9 - Math.floor(a / 10), rand) * 10;
      return sum(a, b, rand, 0.2);
    }
    case 'carry': {
      const a = int(1, 8, rand) * 10 + int(3, 9, rand), b = int(10 - (a % 10), 9, rand);
      if (a + b > 99) return { shape: 'sum', a: 27, b: 6 };
      return sum(a, b, rand, 0.15);
    }
    case 'part20': { const t = int(11, 20, rand); return { shape: 'part', a: int(2, t - 2, rand), t }; }
    case 'twoDigit':
    default: {
      const carry = rand() < 0.6;
      for (let k = 0; k < 30; k++) {
        const a = int(1, 7, rand) * 10 + int(1, 9, rand), b = int(1, 7, rand) * 10 + int(1, 9, rand);
        if (a + b <= 99 && ((a % 10) + (b % 10) >= 10) === carry) return { shape: 'sum', a, b };
      }
      return { shape: 'sum', a: 36, b: 27 };
    }
  }
}

// ---- the slips --------------------------------------------------------------------------------------------------

const tensOf = (n) => Math.floor(n / 10);

// The slips this problem allows: { n, trap, w } (the likeliest first; see pickTargets)
export function slipsOf(p) {
  const s = [], push = (n, trap, w) => s.push({ n, trap, w });
  if (p.shape === 'part') {
    const { a, t } = p, x = t - a;
    push(t, 'total', 3); push(a + t, 'added', 2.5); push(a, 'given', 2); push(x + 1, 'countStart', 1.5); push(x - 1, 'under', 1.2);
    return s.filter((y) => y.n >= 0 && y.n !== x);
  }
  const { a, b } = p, r = a + b, big = Math.max(a, b), small = Math.min(a, b), ones = (a % 10) + (b % 10);
  if (big < 10) {
    push(r - 1, 'countStart', 3); push(r + 1, 'over', 2);
    if (r > 10) push(r - 10, 'noTen', 2.5);   // (before taking away: 8 + 5 = 3 reads as "kept the ones" past ten)
    if (a !== b) push(big - small, 'takeAway', 2);
    push(big, 'given', 1.2);
  } else if (small < 10) {
    // a two-digit number and a one-digit one
    if (ones >= 10) { push(r - 10, 'noCarry', 3); push(tensOf(big) * 100 + ones, 'stuck', 1); }
    else push(big + small * 10, 'place', 2.5);
    push(r - 1, 'countStart', 1.2); push(r + 1, 'over', 1.2); push(r + 10, 'tenOff', 1.2); push(big - small, 'takeAway', 1);
  } else if (a % 10 === 0 && b % 10 === 0) {
    push(r / 10, 'zeros', 2.5); push(r + 10, 'tenOff', 1.5); push(r - 10, 'tenOff', 1.5); push(big - small, 'takeAway', 1);
  } else if (a % 10 === 0 || b % 10 === 0) {
    const round = a % 10 === 0 ? a : b, other = round === a ? b : a;
    push(other + round / 10, 'place', 2.5); push(r + 10, 'tenOff', 1.5); push(r - 10, 'tenOff', 1.5); push(r + 1, 'over', 1);
  } else {
    if (ones >= 10) { push(r - 10, 'noCarry', 3); push((tensOf(a) + tensOf(b)) * 100 + ones, 'stuck', 1); }
    push(r - (small % 10), 'half', 1.5); push(r + 10, 'tenOff', 1.3); push(r - 10, 'tenOff', 1.3);
    push(r + 1, 'over', 1); push(r - 1, 'countStart', 1);
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
    const x = p.t - p.a;
    return { text: `${p.a} + ? = ${p.t}`, rule: `${p.a} + ? = ${p.t}`, sub: `Rope the number that makes ${p.t}`, done: `${p.a} + ${x} = ${p.t}`, say: `${p.a} and what make ${p.t}` };
  }
  return { text: `${p.a} + ${p.b}`, rule: `${p.a} + ${p.b} = ?`, sub: 'Rope the answer', done: `${p.a} + ${p.b} = ${p.a + p.b}`, say: `${p.a} plus ${p.b}` };
}

export function card(p, { size = 5, rand = Math.random, avoid = null } = {}) {
  const a = answerOf(p);
  return { ...words(p), answer: a, targets: pickTargets(a, slipsOf(p), size, rand, { min: 0, max: 999, avoid }) };
}

// ---- words for the kid ------------------------------------------------------------------------------------------

// How to count it on: "Start at 8 and count on 5" (from the bigger number, which is quicker).
function countOn(a, b) {
  return a >= b ? `Start at ${a} and count on ${b}` : `Start at the bigger one, ${b}, and count on ${a}`;
}

export function whyNot(c, picked) {
  const p = c.parts, slip = classify(p, picked);
  let line;
  if (p.shape === 'part') {
    const { a, t } = p, x = t - a;
    if (slip === 'total') line = `That's the total, ${t}. What goes with ${a} to make ${t}? Count up from ${a}: ${countLine(a, t)}. That's ${x}.`;
    else if (slip === 'added') line = `That's ${a} + ${t}. You need the number that goes WITH ${a} to make ${t}: ${a} + ${x} = ${t}.`;
    else if (slip === 'given') line = `That's the ${a} you already have. ${a} + ${x} = ${t}.`;
    else if (slip === 'countStart') line = `You counted the ${a} too. From ${a} up to ${t} is ${x} hop${x === 1 ? '' : 's'}: ${countLine(a, t)}.`;
    else if (slip === 'under') line = `One short. From ${a} up to ${t} is ${x} hop${x === 1 ? '' : 's'}: ${a} + ${x} = ${t}.`;
    else line = `Not that one. Count up from ${a} to ${t}: ${countLine(a, t)}. That's ${x}: ${a} + ${x} = ${t}.`;
    return { slip, line };
  }
  const { a, b } = p, r = a + b, big = Math.max(a, b), small = Math.min(a, b);
  const sum = `${a} + ${b} = ${r}`, nearDouble = big < 11 && big - small === 1 && small >= 2;
  switch (slip) {
    case 'countStart': case 'over':
      if (big >= 10) line = `Just one ${slip === 'over' ? 'too many' : 'short'}. Add the tens, then the ones: ${sum}.`;
      else if (nearDouble) line = `${small} + ${small} is ${2 * small}, and ${big} is one more than ${small}: ${sum}.`;
      else if (a === b) line = `Double ${a} is ${r}. ${countOn(a, b)}: ${countLine(a, r)}.`;
      else if (slip === 'countStart') line = `You counted the ${big} as a hop. ${countOn(a, b)}: ${countLine(big, r)}.`;
      else line = `One too many. ${countOn(a, b)}: ${countLine(big, r)}.`;
      break;
    case 'takeAway': line = `That's ${big} − ${small}. The + puts them together: ${sum}.`; break;
    case 'given': line = `That's just the ${big}. Put the ${small} with it: ${sum}.`; break;
    case 'noTen': line = `That's only the ones. ${big} + ${10 - big} makes 10, then ${r - 10} more: ${r}.`; break;
    case 'place':
      if (small < 10) line = `The ${small} went in the tens. ${small} is ones: ${big % 10} + ${small} = ${(big % 10) + small}, so ${sum}.`;
      else { const round = a % 10 === 0 ? a : b; line = `The ${round / 10} tens went in the ones. ${round} is ${round / 10} tens: ${sum}.`; }
      break;
    case 'zeros': line = `${a / 10} tens and ${b / 10} tens make ${r / 10} tens: ${r}, not ${r / 10}.`; break;
    case 'noCarry': case 'stuck': {
      const ones = (a % 10) + (b % 10);
      line = `${a % 10} + ${b % 10} = ${ones}: that's a new ten${slip === 'stuck' ? `, and ${ones} won't fit in the ones place` : ''}. Carry it: ${sum}.`;
      break;
    }
    case 'half': line = `That only added the ${small - (small % 10)}. Add the ${small % 10} too: ${sum}.`; break;
    case 'tenOff': line = `Off by ten. Add the tens, then the ones: ${sum}.`; break;
    default: line = big < 10 ? `Not that one. ${countOn(a, b)}: ${countLine(big, r)}.` : `Not that one. Add the tens, then the ones: ${sum}.`;
  }
  return { slip, line };
}

export function nudge(c) {
  const p = c.parts;
  if (p.shape === 'part') return `Count up from ${p.a} to ${p.t}. How many hops?`;
  const { a, b } = p, big = Math.max(a, b), small = Math.min(a, b), r = a + b;
  if (big < 10) {
    if (a === b) return `Double ${a}: ${a} and ${a} more.`;
    if (big - small === 1 && small >= 2) return `${small} + ${small} is a double. ${big} is one more than ${small}.`;
    if (r > 10) return `${big} + ${10 - big} makes 10. How many more after that?`;
    return `${countOn(a, b)}.`;
  }
  if (small < 10) return (a % 10) + (b % 10) >= 10 ? `Add the ones first: ${big % 10} + ${small}. Is that a new ten?` : `Add the ones: ${big % 10} + ${small}. The tens stay the same.`;
  if (a % 10 === 0 && b % 10 === 0) return `${a / 10} tens and ${b / 10} tens.`;
  return `Add the tens, then the ones.${(a % 10) + (b % 10) >= 10 ? ' Do the ones make a new ten?' : ''}`;
}

// The helper's picture: ten-frames (up to 20) and the number line with its hops.
export function picture(c) {
  const p = c.parts;
  if (p.shape === 'part') {
    const { a, t } = p, x = t - a;
    return { helper: 'count', frame: t <= 20 ? { kind: 'part', a, b: x } : null,
      line: { ...around([a, t]), start: a, end: t, ask: 'hops', hops: t <= 20 ? unitHops(a, x) : chunkHops(a, x) } };
  }
  const { a, b } = p, r = a + b, big = Math.max(a, b), small = Math.min(a, b);
  // (the frames start with the bigger number, as the hops do: the gold counters are the ones counted on)
  if (r <= 20) return { helper: 'count', frame: { kind: 'add', a: big, b: small }, line: { ...around([big, r]), start: big, end: r, hops: unitHops(big, small) } };
  const from = a >= b || small >= 10 ? a : b, by = from === a ? b : a;
  return { helper: 'count', line: { ...around([from, r]), start: from, end: r, hops: chunkHops(from, by) } };
}

// ---- the trainer --------------------------------------------------------------------------------------------------

export const SPEC = {
  topic: 'adding', name: 'Adding', LADDER, problem, key, answerOf, card, whyNot, nudge, picture, slipsOf,
  hint: 'Start at the bigger number and count on.',
  sheepText: (p, v) => (p.shape === 'part' ? `${p.a} + ${v} = ${p.t}` : `${p.a} + ${p.b} = ${v}`),
  // (a missing number reads as a plain sum over a sheep: "7 + ? = 10" is written 7 + 3 = 10. Then the slip, and every
  // bottle, is always the answer at the end. With the slip in the middle, "5 + 8 = 8" could be cured two ways: the
  // game's 5 + 3 = 8, or a "wrong" bottle's 5 + 8 = 13)
  sheepProblem: (row, rand) => { const q = problem(pick(row.shapes, rand), row, rand); return q.shape === 'part' ? { shape: 'sum', a: q.a, b: q.t - q.a } : q; },
};

export function makeAdding(state, opts) { return makeCardTrainer(SPEC, state, opts); }
export function sheepItem(step, sick, rand, used) { return sheepItemFor(SPEC, step, sick, rand, used); }
