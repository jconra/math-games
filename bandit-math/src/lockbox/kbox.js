// The kindergarten boxes: the same lock box all the way down, for the youngest riders (and anyone not reading yet).
//
//   K1 Count it up   2 + x = 4    sums up to 5; what is in the sack is 1 or 2 (up to 3 once the numbers grow)
//   K2 Up to ten     3 + x = 8    sums up to 10
//   K3 Take away     5 − x = 3    taking away within 10, and now and then a sum to 10 again
//
// They sit below R0a on the equations strand (src/math/strands.js MAPS.lockboxK: points 0, 4, 7), so the skill model
// hands them out like any rung: a rider whose equations level is under about 10 gets these. Within a rung the
// numbers grow with frac (skill.js stepAt: how far the level is toward the next rung).
//
// One box: the line in coins and the x card, as on every rung, with big pictures under it: the things on each side
// (apples, eggs, horseshoes, carrots, nuggets) and a sack where x is ("what is in the sack?"). The kid taps one of three
// answers, each a number with that many little pictures under it, so counting is enough: reading numbers isn't
// needed. The question is written the way it is said, "2 plus what equals 4?", and read out loud from the maker's own
// clips (src/audio/readaloud.js) while the rider's read-aloud is on: "2 and what make 4", "5 take away what leaves 3"
// (the clips' words; the line written on screen is the same question). A line the clips can't say is not read at all:
// never another voice mixed in with his.
// The help when stuck (Ask Hob, and after a wrong tap): for adding, the empty spots the sack has to fill are drawn as
// outlines; for taking away, the ones taken are crossed out. Counting them gives the answer.
//
// Nothing here touches the page, so the node tests can check it.
//   K_RUNGS, K_RUNG, K_IDS
//   kProblem(rungId, { rng, frac, recent, only }) -> { rung, mode: 'count', key, start (the line), x, kind: 'one', par: 1,
//     answer, choices (3 numbers), op: '+' | '−', a, b, thing, words (written), say (read out) }
//   THINGS, THING_NAME (one, many), THING_SVG, SACK_SVG   the pictures
//   kHint(problem, level) -> Ask Hob's line (1 look, 2 the picture help, 3 the answer)
//   kNudge(problem, v) -> the line after a wrong tap

import { num, xt, line, lineText, MINUS } from './engine.js';

export const K_RUNGS = [
  { id: 'K1', name: 'Count it up', mode: 'count', note: '2 + x = 4' },
  { id: 'K2', name: 'Up to ten', mode: 'count', note: '3 + x = 8' },
  { id: 'K3', name: 'Take away', mode: 'count', note: `5 ${MINUS} x = 3` },
];
export const K_RUNG = Object.fromEntries(K_RUNGS.map((r) => [r.id, r]));
export const K_IDS = K_RUNGS.map((r) => r.id);

export const K = {
  minusShare: 0.65,   // K3: the share of boxes that take away (the rest add up to 10)
  recent: 20,         // a box is not dealt again within this many
};

// The shapes, by rung: (rng, frac) -> { op, a, x, b } or null to try again. frac (0..1) grows the numbers.
const SHAPES = {
  K1(rng, f) {   // a + x = b, b up to 5; x 1 or 2, then up to 3
    const top = 5, x = rng.int(1, f < 0.5 ? 2 : 3);
    if (x >= top) return null;
    const a = rng.int(1, top - x);
    return { op: '+', a, x, b: a + x };
  },
  K2(rng, f) {   // a + x = b, b from 5 up to 6 .. 10
    const top = 6 + Math.round(f * 4), x = rng.int(1, Math.min(6, top - 2));
    const a = rng.int(1, top - x);
    if (a + x < 5) return null;
    return { op: '+', a, x, b: a + x };
  },
  K3(rng, f, only = null) {   // a − x = b within 6 .. 10; sometimes a + x = b up to 10 (only '−': never)
    const top = 6 + Math.round(f * 4);
    if (only !== '−' && rng.chance(1 - K.minusShare)) return SHAPES.K2(rng, Math.max(0.5, f));
    const a = rng.int(3, top), x = rng.int(1, a - 1);
    return { op: '−', a, x, b: a - x };
  },
};

export const THINGS = ['apple', 'egg', 'horseshoe', 'carrot', 'nugget'];
export const THING_NAME = {
  apple: ['apple', 'apples'], egg: ['egg', 'eggs'], horseshoe: ['horseshoe', 'horseshoes'], carrot: ['carrot', 'carrots'],
  nugget: ['gold nugget', 'gold nuggets'],
};

// Three answers: the right one and its two neighbours (counting one too many or one too few), never below 1.
function choicesFor(x, rng) {
  const out = [x];
  for (const c of [x + 1, x - 1, x + 2, x - 2]) if (c >= 1 && out.length < 3 && !out.includes(c)) out.push(c);
  return rng.shuffle(out);
}

// The question as it is written, and as the clips say it (readaloud.js PHRASES: "and what make", "take away what
// leaves"; every number up to 109 has a clip).
export function kWords(op, a, b) {
  return op === '+' ? `${a} plus what equals ${b}?` : `${a} take away what leaves ${b}?`;
}
export function kSay(op, a, b) {
  return op === '+' ? `${a} and what make ${b}` : `${a} take away what leaves ${b}`;
}

// only: '−' keeps K3 to taking away (the levels' "7 − what = 5": src/levels/place/lockbox.js)
export function kProblem(rungId, { rng, frac = 0, recent = [], only = null } = {}) {
  if (!K_RUNG[rungId]) throw new Error(`no kindergarten rung ${rungId}`);
  const f = Math.max(0, Math.min(1, Number(frac) || 0));
  const seen = new Set(recent);
  let best = null;
  for (let tries = 0; tries < 300; tries++) {
    const s = SHAPES[rungId](rng, f, only);
    if (!s) continue;
    // the answer is never already printed in the line (2 + x = 4 with x = 2 gives itself away to a kid who taps the
    // number they see; so does 6 − x = 3)
    if (s.x === s.a || s.x === s.b) continue;
    const L = s.op === '+' ? [num(s.a), xt(1)] : [num(s.a), xt(-1)];
    const start = line(L, [num(s.b)]);
    const key = `${rungId}:${lineText(start)}`;
    best = { s, start, key };
    if (!seen.has(key) || tries > 200) break;
  }
  if (!best) return null;
  const { s, start, key } = best;
  return {
    rung: rungId, mode: 'count', key, start, x: s.x, kind: 'one', par: 1, route: [],
    answer: s.x, choices: choicesFor(s.x, rng), op: s.op, a: s.a, b: s.b,
    thing: rng.pick(THINGS), words: kWords(s.op, s.a, s.b), say: kSay(s.op, s.a, s.b),
  };
}

// Ask Hob, on a kindergarten box: 1 look at the pictures, 2 the picture help (outlines or crossed out), 3 the answer.
export function kHint(p, level) {
  const many = THING_NAME[p.thing][1];
  if (level <= 1) return `Count the ${many} on each side.`;
  if (level === 2) {
    return p.op === '+' ? `The sack needs enough to make ${p.b}. Count the empty spots.`
      : `Cross out ${many} until ${p.b} are left. Count the crossed-out ones.`;
  }
  return `It's ${p.answer}.`;
}
// After a wrong tap: what that number makes, against the other side.
export function kNudge(p, v) {
  const got = p.op === '+' ? p.a + v : p.a - v;
  return p.op === '+' ? `${p.a} + ${v} makes ${got}, not ${p.b}.` : `${p.a} ${MINUS} ${v} leaves ${got}, not ${p.b}.`;
}

// ---- the pictures (32 × 32, drawn in code) ----
export const THING_SVG = {
  apple: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 9.5c-3-2.6-9.2-2.2-10.6 3.6-1.4 5.9 1.4 13.3 5.4 15.1 2 .9 3.6.1 5.2-.7 1.6.8 3.2 1.6 5.2.7 4-1.8 6.8-9.2 5.4-15.1C25.2 7.3 19 6.9 16 9.5z" fill="#c63f2c" stroke="#6b1c10" stroke-width="1.2"/><path d="M16 9.6c0-2.6.9-4.6 2.4-5.8" stroke="#5a3a1a" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M18.2 6.2c2-2.6 5.6-2.9 7.2-1.6-1.6 2.6-4.7 3.3-7.2 1.6z" fill="#6f9e3c" stroke="#3f5f1f" stroke-width=".8"/><path d="M9.8 13.4c.9-1.7 2.5-2.6 4-2.6" stroke="#f3b0a0" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,
  egg: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.5c-5.4 0-9.4 8.6-9.4 15.2 0 6 4.2 9.8 9.4 9.8s9.4-3.8 9.4-9.8C25.4 12.1 21.4 3.5 16 3.5z" fill="#f2e2c2" stroke="#86643a" stroke-width="1.2"/><ellipse cx="12.6" cy="12.4" rx="2.2" ry="3.6" fill="#fffaf0" opacity=".85"/></svg>`,
  horseshoe: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7.5 27V15.5a8.5 8.5 0 0 1 17 0V27" fill="none" stroke="#3d3a37" stroke-width="7" stroke-linecap="round"/><path d="M7.5 27V15.5a8.5 8.5 0 0 1 17 0V27" fill="none" stroke="#8f8b84" stroke-width="4.6" stroke-linecap="round"/><g fill="#3d3a37"><circle cx="7.6" cy="21" r="1"/><circle cx="24.4" cy="21" r="1"/><circle cx="8.8" cy="13.2" r="1"/><circle cx="23.2" cy="13.2" r="1"/></g><path d="M11 10.2a6.5 6.5 0 0 1 4-2.1" stroke="#d9d4ca" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>`,
  carrot: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13.5 9.5c4.6.4 8.6 2.7 9 6.2L10.2 29c-1.3 1.2-3.3.4-3.2-1.4l3.6-16.2c.4-1.4 1.6-2 2.9-1.9z" fill="#e5802a" stroke="#8a4512" stroke-width="1.2"/><path d="M11.4 16.5l3.2.9M10.2 21.6l3 .8M15.6 13.6l2.6.9" stroke="#a85618" stroke-width="1.1" stroke-linecap="round"/><path d="M17 9.6c-.6-3.4.4-6 2.2-7 .6 2.6.2 5-1 7zM18.8 10.6c1.8-2.8 4.6-3.8 6.8-3.2-1.2 2.4-3.8 3.6-6.8 3.2zM15.4 9.4c-2.2-2.4-2.6-5-1.8-6.8 1.8 1.6 2.6 4 1.8 6.8z" fill="#5f9a36" stroke="#355d18" stroke-width=".7"/></svg>`,
  nugget: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5.5 18.5l4-10 10-2.2 7.6 6 .2 9.6-7.6 6.2-10-2.2z" fill="#e8b84a" stroke="#86601e" stroke-width="1.3"/><path d="M11.5 12.5l6-2M20.5 12l3 2.5" stroke="#fff3c4" stroke-width="1.6" stroke-linecap="round"/><path d="M13 22l5 1.4" stroke="#b98a2c" stroke-width="1.3" stroke-linecap="round"/></svg>`,
};
// the sack x stands for: a "?" goes on it until the kid's answer is put in
export const SACK_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 22c-6 6-12 16-12 25 0 8 6 12 13 12h22c7 0 13-4 13-12 0-9-6-19-12-25z" fill="#b58a52" stroke="#4a2f17" stroke-width="2.2"/><path d="M22 22c2-3 5-4.5 10-4.5S40 19 42 22" fill="#a07642" stroke="#4a2f17" stroke-width="2.2"/><path d="M25 13c3 2 4 4 7 4s4-2 7-4c-1 3-2 5-1 7H26c1-2 0-4-1-7z" fill="#b58a52" stroke="#4a2f17" stroke-width="2"/><path d="M23 20.5h18" stroke="#6e4a22" stroke-width="3" stroke-linecap="round"/><path d="M14 44c1.5-6 4-11 8-15" stroke="#d3ad78" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/></svg>`;
