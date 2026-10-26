// The "Counting" topic (ages 4 to 6) behind the round-up and the sick sheep.
//
// A wave is a few cards, one after another; each card brings a small herd of numbers with one right answer. The cards:
//   dots     "How many dots? ●●●●● ●●"          rope the 7 (the dots come in rows of five, as a ten-frame holds them)
//   after    "Rope what comes after 7"           rope the 8
//   before   "Rope what comes before 7"          rope the 6
//   more     "Rope 1 more than 4"                rope the 5        less   "Rope 1 less than 4"    rope the 3
//   skip     "5, 10, 15, ?"                      rope the 20 (counting by 2s, 5s and 10s)
//   tenMore  "Rope 10 more than 34"              rope the 44       tenLess "Rope 10 less than 34" rope the 24
// The wrong numbers on a card are the real slips small counters make, never random ones:
//   over / under    counted a dot twice, or missed one (one or two off)
//   row / frame     counted the full row of 5 (or the full ten) and stopped
//   same            picked the number already on the card (after 7: 7)
//   back / fwd      went the wrong way (after 7: 6; before 7: 8)
//   skip            skipped a number (after 7: 9)
//   turn            the digits swapped (after 16: 71), the teen numbers' own slip
//   tenBack         after 29 went back to the start of the ten (20)    tenJump  jumped a whole ten (40)
//   tenDrop         before 30 dropped to the ten before (20)           wrongTen kept the 9, wrong ten (39)
//   byOne           counting by 5s went up by 1 (15, then 16); 10 more than 34 went up by one (35)
//   skipOne         counting by 5s skipped one (15, then 25)           wrongWay 10 more went down (24)
//   twoTens         10 more went up two tens (54)
// A wrong pick gets one plain line that names the slip and says the right answer, and the helper (src/ui/counthelp.js)
// shows the dots in ten-frames, numbered one by one, or the number line with a hop for each step.
//
// The ladder (see LADDER) starts with counting dots up to 5 and climbs to counting by 2s, 5s and 10s, and 10 more or
// 10 less up to 100. The climb, the comebacks and the sessions are the card trainer's (src/math/early.js).
//
//   const C = makeCounting(rider.topics.counting ||= {})      the same shape as every card topic (see early.js)
//   sheepItem(step, sick, rand, used)                          a counting fact written over a sheep (missions/sheepmath.js)
import { makeCardTrainer, pickTargets, dotsText, countLine, int, pick, pickW, sheepItemFor } from './early.js';

export const LADDER = [
  { shapes: ['dots'], dots: [2, 5], label: 'Counting dots up to 5' },
  { shapes: ['after'], n: [1, 9], label: 'What comes next, up to 10' },
  { shapes: ['dots', 'after'], weights: { dots: 3, after: 1 }, dots: [5, 10], n: [1, 9], label: 'Counting dots up to 10' },
  { shapes: ['before', 'more', 'less', 'after'], weights: { before: 2, more: 1.5, less: 1.5, after: 0.6 }, n: [1, 9], label: 'One more, one less, and what comes before (up to 10)' },
  { shapes: ['after', 'before', 'more', 'less'], n: [10, 19], label: 'Counting on and back from 10 to 20' },
  { shapes: ['cross', 'dots'], weights: { cross: 2.5, dots: 1 }, dots: [11, 20], tens: [2, 6], label: 'Past the tens (29, 30) and dots up to 20' },
  { shapes: ['skip'], by: [2, 5, 10], label: 'Counting by 2s, 5s and 10s' },
  { shapes: ['tenMore', 'tenLess', 'after', 'before'], weights: { tenMore: 2, tenLess: 2, after: 0.8, before: 0.8 }, n: [21, 98], label: 'Up to 100: 10 more and 10 less' },
];

// ---- problems ---------------------------------------------------------------------------------------------------

export function answerOf(p) {
  switch (p.shape) {
    case 'dots': return p.n;
    case 'after': case 'more': return p.n + 1;
    case 'before': case 'less': return p.n - 1;
    case 'skip': return p.start + 3 * p.by;
    case 'tenMore': return p.n + 10;
    case 'tenLess': return p.n - 10;
    default: return NaN;
  }
}
export const key = (p) => (p.shape === 'skip' ? `skip:${p.by}:${p.start}` : `${p.shape}:${p.n}`);

// A problem of one shape for a step's row. ('cross' deals an "after 29" or a "before 30": counting over a ten.)
export function problem(shape, row, rand) {
  const [lo, hi] = row.n || [1, 9];
  switch (shape) {
    case 'dots': return { shape, n: int(row.dots[0], row.dots[1], rand) };
    case 'after': case 'more': return { shape, n: int(lo, hi, rand) };
    case 'before': case 'less': return { shape, n: int(lo + 1, hi + 1, rand) };
    case 'cross': { const d = int(row.tens[0], row.tens[1], rand); return rand() < 0.55 ? { shape: 'after', n: d * 10 - 1 } : { shape: 'before', n: d * 10 }; }
    case 'skip': {
      const by = pickW(row.by || [2, 5, 10], (b) => (b === 5 ? 1.3 : 1), rand);
      const start = by === 2 ? 2 * int(1, 6, rand) : by === 5 ? 5 * int(1, 7, rand) : 10 * int(1, 6, rand);
      return { shape, by, start };
    }
    case 'tenMore': return { shape, n: int(10, 89, rand) };
    case 'tenLess': return { shape, n: int(20, 99, rand) };
    default: return { shape: 'after', n: int(1, 9, rand) };
  }
}

// ---- the slips --------------------------------------------------------------------------------------------------

// 16 -> 61; null for one digit, a round ten, or twin digits
const turned = (n) => { if (n < 10 || n > 99 || n % 10 === 0) return null; const r = (n % 10) * 10 + Math.floor(n / 10); return r === n ? null : r; };

// The slips this problem allows: { n, trap, w } (w: how likely it is to be dealt as a wrong answer; see pickTargets)
export function slipsOf(p) {
  const a = answerOf(p), n = p.n;
  const s = [];
  switch (p.shape) {
    case 'dots':
      s.push({ n: a + 1, trap: 'over', w: 3 }, { n: a - 1, trap: 'under', w: 3 });
      if (a > 5 && a < 10) s.push({ n: 5, trap: 'row', w: 2.5 });
      if (a > 10) s.push({ n: 10, trap: 'frame', w: 2.5 });
      if (turned(a)) s.push({ n: turned(a), trap: 'turn', w: 1.5 });
      s.push({ n: a + 2, trap: 'over', w: 1 }, { n: a - 2, trap: 'under', w: 1 });
      break;
    case 'after': case 'more':
      s.push({ n, trap: 'same', w: 3 }, { n: n - 1, trap: 'back', w: 2 }, { n: a + 1, trap: 'skip', w: 2 });
      if (a % 10 === 0 && a > 10) s.push({ n: a - 10, trap: 'tenBack', w: 3 }, { n: a + 10, trap: 'tenJump', w: 2 });
      if (turned(a)) s.push({ n: turned(a), trap: 'turn', w: a < 20 ? 2.5 : 1 });
      s.push({ n: a + 2, trap: 'skip', w: 0.6 });
      break;
    case 'before': case 'less':
      s.push({ n, trap: 'same', w: 3 }, { n: n + 1, trap: 'fwd', w: 2 }, { n: a - 1, trap: 'skip', w: 2 });
      if (n % 10 === 0 && n > 10) s.push({ n: n - 10, trap: 'tenDrop', w: 3 }, { n: n + 9, trap: 'wrongTen', w: 2 });
      if (turned(a)) s.push({ n: turned(a), trap: 'turn', w: a < 20 ? 2.5 : 1 });
      s.push({ n: a - 2, trap: 'skip', w: 0.6 });
      break;
    case 'skip': {
      const last = p.start + 2 * p.by;
      s.push({ n: last + 1, trap: 'byOne', w: 3 }, { n: a + p.by, trap: 'skipOne', w: 2 }, { n: last, trap: 'same', w: 1.5 },
        { n: a + 1, trap: 'near', w: 1 }, { n: a - 1, trap: 'near', w: 1 }, { n: p.start + p.by, trap: 'back', w: 0.6 });
      break;
    }
    case 'tenMore':
      s.push({ n: n + 1, trap: 'byOne', w: 3 }, { n: n - 10, trap: 'wrongWay', w: 2 }, { n: n + 20, trap: 'twoTens', w: 1.5 },
        { n: a + 1, trap: 'near', w: 1 }, { n: a - 1, trap: 'near', w: 1 }, { n, trap: 'same', w: 0.8 });
      break;
    case 'tenLess':
      s.push({ n: n - 1, trap: 'byOne', w: 3 }, { n: n + 10, trap: 'wrongWay', w: 2 }, { n: n - 20, trap: 'twoTens', w: 1.5 },
        { n: a + 1, trap: 'near', w: 1 }, { n: a - 1, trap: 'near', w: 1 }, { n, trap: 'same', w: 0.8 });
      break;
    default: break;
  }
  return s.filter((x) => Number.isInteger(x.n) && x.n >= (p.shape === 'dots' ? 1 : 0) && x.n !== a);
}

// Which slip a wrong number is (the first in slipsOf's list that fits), 'other' if none, null for the answer.
export function classify(p, n) {
  if (n === answerOf(p)) return null;
  const s = slipsOf(p).find((x) => x.n === n);
  return s ? s.trap : 'other';
}

// ---- the card ---------------------------------------------------------------------------------------------------

function words(p) {
  const a = answerOf(p), n = p.n;
  switch (p.shape) {
    case 'dots': return { text: dotsText(n), rule: `How many dots? ${dotsText(n)}`, sub: 'Count them, rope that many', done: `${a} dots`, say: `how many dots` };
    case 'after': return { text: `after ${n}`, rule: `Rope what comes after ${n}`, sub: 'Count on one', done: `After ${n} comes ${a}`, say: `what comes after ${n}` };
    case 'before': return { text: `before ${n}`, rule: `Rope what comes before ${n}`, sub: 'Count back one', done: `Before ${n} comes ${a}`, say: `what comes before ${n}` };
    case 'more': return { text: `1 more than ${n}`, rule: `Rope 1 more than ${n}`, sub: 'One more', done: `1 more than ${n} is ${a}`, say: `one more than ${n}` };
    case 'less': return { text: `1 less than ${n}`, rule: `Rope 1 less than ${n}`, sub: 'One less', done: `1 less than ${n} is ${a}`, say: `one less than ${n}` };
    case 'skip': {
      const seq = `${p.start}, ${p.start + p.by}, ${p.start + 2 * p.by}`;
      return { text: `${seq}, ?`, rule: `${seq}, ?`, sub: `Counting by ${p.by}s: rope what comes next`, done: `${seq}, ${a}: up ${p.by} each time`, say: `counting by ${p.by}s` };
    }
    case 'tenMore': return { text: `10 more than ${n}`, rule: `Rope 10 more than ${n}`, sub: 'One more ten', done: `10 more than ${n} is ${a}`, say: `ten more than ${n}` };
    case 'tenLess': return { text: `10 less than ${n}`, rule: `Rope 10 less than ${n}`, sub: 'One ten less', done: `10 less than ${n} is ${a}`, say: `ten less than ${n}` };
    default: return { text: '?', rule: '?', sub: '', done: '', say: '' };
  }
}

export function card(p, { size = 5, rand = Math.random, avoid = null } = {}) {
  const a = answerOf(p);
  return { ...words(p), answer: a, targets: pickTargets(a, slipsOf(p), size, rand, { min: p.shape === 'dots' ? 1 : 0, max: 120, avoid }) };
}

// ---- words for the kid ------------------------------------------------------------------------------------------

const tensOnes = (v) => `${v} is ${Math.floor(v / 10)} ten${Math.floor(v / 10) === 1 ? '' : 's'} and ${v % 10} one${v % 10 === 1 ? '' : 's'}`;

// The one plain line after a wrong pick: what the slip was, and the right answer.
export function whyNot(c, picked) {
  const p = c.parts, a = answerOf(p), n = p.n, slip = classify(p, picked);
  let line;
  switch (p.shape) {
    case 'dots':
      if (slip === 'row') line = `That's just the first row of 5. Count on from 5: ${countLine(5, a)}. There are ${a}.`;
      else if (slip === 'frame') line = `That's just the full ten. Count on from 10: ${countLine(10, a)}. There are ${a}.`;
      else if (slip === 'turn') line = `${picked} has its digits swapped. There are ${a} dots: ${tensOnes(a)}.`;
      else if (picked > a) line = `${picked} is too many: count each dot just once. There are ${a}.`;
      else line = `${picked} is too few: ${a - picked === 1 ? 'one dot got' : 'some dots got'} missed. Count each dot once: there are ${a}.`;
      break;
    case 'after': case 'more': {
      const say = p.shape === 'after' ? `After ${n} comes ${a}` : `1 more than ${n} is ${a}`;
      if (slip === 'same') line = `That's ${n} itself. ${say}: ${n}, ${a}.`;
      else if (slip === 'back') line = p.shape === 'after' ? `${picked} comes before ${n}, not after. Count on one: ${n}, ${a}.` : `${picked} is 1 less than ${n}. 1 more is the next number: ${n}, ${a}.`;
      else if (slip === 'skip') line = `${picked} skips ${picked - a === 1 ? 'a number' : 'some numbers'}. Count on just one: ${n}, ${a}.`;
      else if (slip === 'tenBack') line = `${picked} goes back to the start of the ten. After ${n} the ones run out, so the tens go up: ${a}.`;
      else if (slip === 'tenJump') line = `${picked} jumps a whole ten. ${say}: just one more.`;
      else if (slip === 'turn') line = `${picked} has its digits swapped. ${say}: ${tensOnes(a)}.`;
      else line = `Not that one. ${say}: ${n}, ${a}.`;
      break;
    }
    case 'before': case 'less': {
      const say = p.shape === 'before' ? `Before ${n} comes ${a}` : `1 less than ${n} is ${a}`;
      if (slip === 'same') line = `That's ${n} itself. ${say}: ${a}, ${n}.`;
      else if (slip === 'fwd') line = p.shape === 'before' ? `${picked} comes after ${n}, not before. Count back one: ${n}, ${a}.` : `${picked} is 1 more than ${n}. 1 less is the number before: ${a}, ${n}.`;
      else if (slip === 'skip') line = `${picked} skips ${a - picked === 1 ? 'a number' : 'some numbers'}. Count back just one: ${n}, ${a}.`;
      else if (slip === 'tenDrop') line = `${picked} drops a whole ten. ${say}: one less, and the ones start again at 9.`;
      else if (slip === 'wrongTen') line = `${picked} has the 9 right but the wrong ten. ${say}.`;
      else if (slip === 'turn') line = `${picked} has its digits swapped. ${say}: ${tensOnes(a)}.`;
      else line = `Not that one. ${say}: ${a}, ${n}.`;
      break;
    }
    case 'skip': {
      const last = p.start + 2 * p.by;
      if (slip === 'byOne') line = `These go up by ${p.by} each time, not by 1: ${last}, ${a}.`;
      else if (slip === 'skipOne') line = `That skips one. Up ${p.by} from ${last} is ${a}.`;
      else if (slip === 'same') line = `That's the last one again. Up ${p.by} from ${last} is ${a}.`;
      else if (slip === 'back') line = `That goes back. Counting by ${p.by}s goes up: ${last}, ${a}.`;
      else line = `${Math.abs(picked - a) === 1 ? 'One' : 'Just'} off. Counting by ${p.by}s: ${last}, then ${a}.`;
      break;
    }
    case 'tenMore': case 'tenLess': {
      const up = p.shape === 'tenMore', say = `10 ${up ? 'more' : 'less'} than ${n} is ${a}`;
      const tens = `the tens go ${up ? 'up' : 'down'} by one and the ones stay ${n % 10}`;
      if (slip === 'byOne') line = `That's 1 ${up ? 'more' : 'less'}, not 10. ${say}: ${tens}.`;
      else if (slip === 'wrongWay') line = `That's 10 ${up ? 'less' : 'more'}. ${say}: ${tens}.`;
      else if (slip === 'twoTens') line = `That's 20 ${up ? 'more' : 'less'}. ${say}: just one ten.`;
      else if (slip === 'same') line = `That's ${n} itself. ${say}: ${tens}.`;
      else line = `${Math.abs(picked - a) === 1 ? 'One' : 'Just'} off. ${say}: ${tens}.`;
      break;
    }
    default: line = `Not that one: it's ${a}.`;
  }
  return { slip, line };
}

// A line for a kid who is stuck, without the answer.
export function nudge(c) {
  const p = c.parts, n = p.n;
  switch (p.shape) {
    case 'dots': return n > 10 ? 'A full frame is 10. Count on from 10, one dot at a time.' : n > 5 ? 'A full row is 5. Count on from 5, one dot at a time.' : 'Touch each dot as you count it, just once.';
    case 'after': return (n + 1) % 10 === 0 && n > 8 ? `After ${n} the ones run out: the tens go up by one.` : `Say ${n}, then the very next number.`;
    case 'more': return `1 more than ${n} is the number that comes right after it.`;
    case 'before': return n % 10 === 0 && n > 10 ? `Before ${n}: one ten down, and the ones start again at 9.` : `Count back one from ${n}.`;
    case 'less': return `1 less than ${n} is the number that comes right before it.`;
    case 'skip': return `Up ${p.by} each time. What is ${p.start + 2 * p.by} and ${p.by} more?`;
    case 'tenMore': return `10 more: the tens go up by one, the ones stay ${n % 10}.`;
    case 'tenLess': return `10 less: the tens go down by one, the ones stay ${n % 10}.`;
    default: return 'Count carefully, one at a time.';
  }
}

// The helper's picture (src/ui/counthelp.js): the dots in ten-frames, or the number line with its hop(s).
export function picture(c) {
  const p = c.parts, a = answerOf(p), n = p.n;
  const around = (from, to, pad = 3) => ({ lo: Math.max(0, Math.min(from, to) - pad), hi: Math.max(from, to) + pad });
  switch (p.shape) {
    case 'dots': return { helper: 'count', frame: { kind: 'count', n: a } };
    case 'after': case 'more': case 'before': case 'less': {
      const r = around(n, a, 4);
      return { helper: 'count', line: { ...r, start: n, end: a, hops: [{ from: n, to: a, label: a > n ? '+1' : '−1' }] } };
    }
    case 'skip': {
      const stops = [p.start, p.start + p.by, p.start + 2 * p.by, a];
      return { helper: 'count', line: { lo: Math.max(0, p.start - p.by), hi: a + p.by, start: p.start, end: a, stops, known: stops[2],
        hops: stops.slice(1).map((v, i) => ({ from: stops[i], to: v, label: `+${p.by}` })) } };
    }
    case 'tenMore': case 'tenLess': {
      const r = around(n, a, 3);
      return { helper: 'count', line: { ...r, start: n, end: a, hops: [{ from: n, to: a, label: a > n ? '+10' : '−10' }] } };
    }
    default: return { helper: 'count' };
  }
}

// ---- the trainer --------------------------------------------------------------------------------------------------

export const SPEC = {
  topic: 'counting', name: 'Counting', LADDER, problem, key, answerOf, card, whyNot, nudge, picture, slipsOf,
  hint: 'Count one at a time: each number just once, none skipped.',
  // a counting fact as written over a sheep ('after 6 comes 8'); the dots are kept to ten there (read from the saddle)
  sheepText(p, v) {
    switch (p.shape) {
      case 'dots': return `${dotsText(p.n)} is ${v}`;
      case 'after': return `after ${p.n} comes ${v}`;
      case 'before': return `before ${p.n} comes ${v}`;
      case 'more': return `1 more than ${p.n} is ${v}`;
      case 'less': return `1 less than ${p.n} is ${v}`;
      case 'skip': return `${p.start}, ${p.start + p.by}, ${p.start + 2 * p.by}, ${v}`;
      case 'tenMore': return `10 more than ${p.n} is ${v}`;
      case 'tenLess': return `10 less than ${p.n} is ${v}`;
      default: return String(v);
    }
  },
  sheepProblem(row, rand) {
    // (a sheep's card holds six dots at most: more run off its edge. The dots steps have few sums of their own, too few
    // for a flock of six, so what comes after joins them)
    const shapes = row.shapes.filter((s) => s !== 'dots' || row.dots[0] <= 6);
    if (shapes.length === 1 && shapes[0] === 'dots') shapes.push('after');
    const shape = pick(shapes.length ? shapes : ['after'], rand);
    if (shape === 'dots') return problem(shape, { ...row, dots: [row.dots[0], Math.min(6, row.dots[1])] }, rand);
    return problem(shape, shape === 'after' && !row.n ? { ...row, n: [1, Math.min(9, row.dots[1]) - 1] } : row, rand);
  },
};

export function makeCounting(state, opts) { return makeCardTrainer(SPEC, state, opts); }
export function sheepItem(step, sick, rand, used) { return sheepItemFor(SPEC, step, sick, rand, used); }
