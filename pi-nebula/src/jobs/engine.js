// THE STATION'S JOBS, the math part: Mathwood Valley's own math engine, run for a crew member. Pure (no page, no
// three.js), so node can test it (pi-nebula/tests/jobs.test.mjs).
//
// Each job (galley.js, medical.js, smelter.js, arena.js, dock.js) is ONE Mathwood "place": one kind of math, one ladder
// of levels, kids to grown-ups. This file hands them to Mathwood's levels (src/levels/places.js addPlace), so:
//   - which level a crew member is on, finding it the first time (placement, seeded from their other math and their
//     age), and the 4-in-5 staircase up and down are Mathwood's src/levels/model.js (levelFor, recordLevel);
//   - the level arrows are Mathwood's src/ui/leveltool.js (levelTool, stepLevel);
//   - the questions are Mathwood's question makers (src/levels/place/store.js storeOrder: the word problems, the
//     picture stories, recipes, ratio tables, shares by a ratio, proportions), told in the station's world through
//     a job's `setting` (src/math/wordproblems.js and ratios.js read it);
//   - every answer is also counted in Mathwood's kinds of math (src/math/skill.js record), so a crew member good at
//     ratios in the galley starts higher at the triage desk.
// A job can add makers of its own (a question Mathwood has no maker for: drip rates, a recipe scaled by a fraction)
// in the same order shape (ownOrder below).
//
// A crew member keeps (saved with them by save.js; the shared store keeps any field):
//   credits                 the station's money, earned at the jobs
//   levels                  Mathwood's rider.levels: { places: { galley: {...}, medical: {...} } }
//   skill                   Mathwood's rider.skill (the kinds of math)
//   jobs: { [id]: { n, right, earned } }   a small tally per job
//
//   register(job)                     the job's place joins Mathwood's levels (once)
//   deal(crew, job, { rand, last, live })   -> a question: the order (story, ask, coins [{ big, small, label, good, why }],
//                                        pic, rightWhy, sum, own), lv (levelFor's answer: the level, its place) and
//                                        worth (workOf: what the card pays, from the work it asks)
//   answer(crew, job, q, coin, { ms, helped, pay })   -> { right, first, pay, worth, rushed, credits, moved, level, up, down }
//                                        the first pick of a question is the one that counts for the level; a right
//                                        pick after a miss pays half; changes the crew member (save after); pay false:
//                                        a card that pays nothing by itself (a captain's run pays by its share)
//   level(crew, job)                  -> the level tool's view (Mathwood leveltool.js): the arrows and the bar
//   step(crew, job, dir)              -> the arrows: up or down a level by hand (changes the crew member: save after)
//   workOf(order, level)              -> { secs, pay, parts, words, steps }   what a card pays, and why (THE PAY below)
//   levelPay(level) (= payFor)        -> a level's own amount, the old table: what a Mathball ball pays
//   earn(crew, jobId, credits)        -> credits now   a flat amount paid for something done (not a card)
//   example(job, level, rand)         -> { q, a }   one question as text (Mathwood's levels page shape)

import { addPlace, PLACE } from '../../../mathwood-valley/src/levels/places.js';
import { levelFor, recordLevel } from '../../../mathwood-valley/src/levels/model.js';
import { storeOrder, pickAsk, askAt } from '../../../mathwood-valley/src/levels/place/store.js';
import { record as recordSkill, STRAND } from '../../../mathwood-valley/src/math/skill.js';
import { levelTool, stepLevel } from '../../../mathwood-valley/src/ui/leveltool.js';
import { sumOf, workFrom } from '../../../mathwood-valley/src/math/jobsums.js';
import { tools } from '../../../mathwood-valley/src/math/counterkit.js';

// ── THE PAY: BY THE WORK A CARD ASKS ───────────────────────────────────────────────────────────────────────────────
// The game's maker (2026-11-17, on his questions page): "when I said 50-200 I didn't mean that kindergardeners have to
// play 4 times as much as high schooler to get a ship. I meant that a question that required a bunch of reading or took
// more time for some reason (like required long division or long multiplication) should pay more ... I don't want to
// make it so that a very young person barely makes any money and it takes the twice as long to buy a ship. The amount of
// money you make from a question should be dependent on the work and time required to figure it out. I'd say that if
// someone is answering level 1 questions at an incredibly fast rate (like they are intentionally gaming the system) then
// they should only be making 50 credits. But if a kindergartener is doing easy questions at a moderate rate then they
// should be making 100 - 150, or 200 if its a word problem." And a right answer after a miss: "Half the full pay".
// (Before: 50 at a job's easiest level rising evenly to 200 at eighth grade, by the level alone, and 20 after a miss.)
//
// So a card pays for the time its work fairly takes (workOf), PAY.rate credits a second, in tens, PAY.min to PAY.max:
//   - the reading: its words (the story, the question, a pay slip's rows) at a pace that quickens with the school year
//     the card is for (WORK.read: a kindergarten card read slowly or read out, an eighth-grade one skimmed);
//   - a look at it and a pick (WORK.look);
//   - its sums, one by one (stepSecs): a times-table fact or a sum to 10 is quick; columns, carrying and borrowing add a
//     little; long multiplication and long division a lot (more for each digit they make); decimals a little more;
//   - a story with a sum in it: seeing what kind of problem it is (WORK.story); each step after the first (WORK.next);
//   - a picture story for the youngest: the things on it counted, in place of the sums (WORK.count); a card answered by
//     doing, the dock's squares to brace: its taps (WORK.tap); a card with no sum to work (naming an angle, which pane
//     fits): a little thinking for each step, more for an older card (WORK.think).
// So an easy card for the youngest pays 100 to 150, a picture story about 200, a word problem for an older child 200 to
// 300, two steps or more 300 to 500, long division and the smelter's whole pay slip more; and as each pays for its time,
// a young child and an older one earn about the same in an hour (~/pw/space-math/PAY_DOCK_MATHBALL.md has the table).
// A THIRD MORE (the game's maker, 2026-11-17, asked whether about an hour and a half of jobs was the right time to earn
// the Explorer: "About an hour: every card pays a third more"): the rate went from 15 to 20 credits a second, and the
// least and the most a card pays with it (100 to 900 became 130 to 1,200). So the amounts above are a third more now: an
// easy card for the youngest about 190 to 210, a picture story about 270, an older word problem 270 to 400. The 50 of a
// rushed run of easy cards is his own figure and stays; Mathball's pay stays too.
// A right pick after a miss pays PAY.half of the card's pay; Help never costs. A card RUSHED on the easiest levels pays
// less, down to PAY.floor (rushOf, below). Mathball's balls are paid by their level's own amount (levelPay: the old
// table, which the game's maker kept for it, "Fine as it is": a good two-minute round makes 1,000 to 2,000).
export const PAY = {
  rate: 20,          // credits for each second a card's work fairly takes (about 1,200 a minute of steady work; it was 15)
  min: 130,          // the least a card pays (an easy card for the youngest; it was 100)...
  max: 1200,         // ...and the most (the longest pay slip; it was 900)
  step: 10,          // paid in tens
  half: 0.5,         // a right pick after a miss: this share of the card's pay
  // RUSHED (rushOf): only on the easiest levels, and only a run of very quick answers, never one
  easy: 20,          // the easiest levels: at this point of the school guide or under (up to second grade)
  quick: [0.35, 0.15],  // a first pick in under this share of the card's fair time starts to count as rushed; at the second, fully
  keep: 0.6,         // the run: how much of it each new first pick keeps (so it falls back as soon as the pace is fair)
  run: [1.7, 2.3],   // the run at which the pay starts to come down (the third very quick answer in a row), and reaches...
  floor: 50,         // ...this (about the fifth)
  // a level's own amount (levelPay), the old table: 50 at the school guide's 0 rising evenly to 200 at eighth grade,
  // in tens. Mathball's balls are paid by it; `after` is the old 20 after a miss (kept for anything still reading it)
  base: 50, top: 200, topGrade: 80, after: 20,
};
export const SHIP = 50000;   // what a ship will cost (the game's maker's figure, for later: 50,000 to 60,000)
export const levelPay = (L) => {
  const g = Math.max(0, Math.min(PAY.topGrade, L ? L.grade : 0));
  return Math.round((PAY.base + (PAY.top - PAY.base) * g / PAY.topGrade) / PAY.step) * PAY.step;
};
export const payFor = levelPay;   // (its old name: a level's own amount)

// the fair time of a card's parts, in seconds (see THE PAY above)
export const WORK = {
  look: 2,                       // looking the card over and picking an answer
  read: [0.45, 0.0025, 0.25],    // a word: 0.45 at the school guide's 0, 0.0025 less for each point, never under 0.25
  story: 3,                      // a story with a sum in it (more than a dozen words): seeing what kind of problem it is
  next: 3,                       // each step after the first: what comes next, the number carried
  count: 0.4,                    // a thing counted on a picture card (1.5 at least)
  tap: 1,                        // a square braced on a card answered by doing
  think: [2, 0.06],              // a step with no sum to work: 2, and 0.06 more for each point of the school guide
  older: [1.25, 0.7, 160],       // an older card's sums: times 1.25 less the card's point / 160, from 1 (to fourth grade) to 0.7
};
const TABLE = { 0: 1.5, 1: 1.5, 2: 2, 5: 2, 10: 2, 11: 2.5, 3: 3, 4: 3, 9: 3, 6: 4, 7: 4, 8: 4, 12: 4 };
const factSecs = (a, b) => Math.min(TABLE[a] ?? 4, TABLE[b] ?? 4);
const digitsOf = (n) => String(Math.round(Math.abs(n))).length;
const placesOf = (x) => { const s = String(x), i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };
const nonZero = (n) => String(n).split('').filter((d) => d !== '0').length;
// a whole number without its zeros at the end, and how many there were (3600 -> [36, 2])
const bare = (n) => { let k = 0; n = Math.round(n); while (n !== 0 && n % 10 === 0) { n /= 10; k++; } return [n, k]; };
// ONE SUM's fair time (seconds): { op: 'add' | 'sub' | 'mul' | 'div', a, b }
export function stepSecs(s) {
  if (!s) return 0;
  const op = s.op; let a = +s.a, b = +s.b;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 3;
  // (decimals: worked as whole numbers, the point placed after: a little more)
  const dp = Math.max(placesOf(a), placesOf(b)), dot = dp ? 1.5 : 0;
  if (dp) { const k = 10 ** dp; a = Math.round(a * k); b = Math.round(b * k); }
  if (op === 'add' || op === 'sub') {
    // (round numbers worked as their tens: 110 + 90 is 11 + 9 tens)
    const k = Math.min(bare(a)[1], bare(b)[1]);
    if (k && a && b) { a /= 10 ** k; b /= 10 ** k; }
    if (op === 'add' ? a + b <= 10 : a <= 10) return 1.5 + dot;
    if (op === 'add' ? a + b <= 20 && Math.max(a, b) < 10 : a <= 20 && b < 10) return 3 + dot;
    // a column at a time, and each carry or borrow
    const cols = Math.max(digitsOf(a), digitsOf(b));
    let carries = 0, A = a, B = b, c = 0;
    for (let i = 0; i < cols; i++) {
      const x = A % 10, y = B % 10;
      if (op === 'add' ? x + y + c >= 10 : x - c < y) { carries++; c = 1; } else c = 0;
      A = Math.floor(A / 10); B = Math.floor(B / 10);
    }
    return 1.5 + 1.5 * cols + carries + dot;
  }
  if (op === 'mul') {
    const [x, kx] = bare(a), [y, ky] = bare(b), zeros = kx + ky ? 1 : 0;
    if (x <= 1 || y <= 1) return 2 + zeros + dot;
    if (x <= 12 && y <= 12) return factSecs(x, y) + zeros + dot;            // (a times-table fact)
    if (x === 2 || y === 2) return 2 + 1.5 * digitsOf(x === 2 ? y : x) + zeros + dot;   // (doubling)
    // LONG MULTIPLICATION: a product for each pair of digits, the rows added
    const prods = nonZero(x) * nonZero(y), rows = Math.min(nonZero(x), nonZero(y));
    return 4 + 3 * prods + 1.5 * (rows - 1) + zeros + dot;
  }
  if (op === 'div') {
    if (!b) return 2;
    if (b === 1) return 1.5 + dot;
    const q = Math.floor(a / b), r = a % b, [qs] = bare(q || 1), [bs] = bare(b);
    if (b <= 12 && q <= 12) return factSecs(b, q || 1) + (r ? 2 : 0) + dot;   // (in the tables, a remainder or not)
    if (b === 10 || b === 100 || b === 1000) return 2 + dot;
    if (bs <= 12 && qs <= 12 && !r) return factSecs(bs, qs) + 1 + dot;          // (a fact with zeros: 5400 ÷ 60)
    if (b === 2 && !r) return 2 + 1.5 * digitsOf(qs) + dot;                     // (halving)
    // LONG DIVISION: each digit of the answer, longer with a bigger number to divide by
    const qd = digitsOf(qs), bd = digitsOf(bs);
    return 6 + 6 * qd * (bd >= 3 ? 2 : bd === 2 ? 1.5 : 1) + (r ? 2 : 0) + dot;
  }
  return 3;
}
const wordsIn = (o) => `${o.story || ''} ${o.ask || ''} ${(o.lines || []).flat().join(' ')}`.trim().split(/\s+/).filter(Boolean).length;
// a card's sums: its own (order.sum), else the ones its working writes out with their answers ("4 × 3 = 12")
function sumsIn(o) {
  let s = o.sum;
  if (!s && o.rightWhy) { try { s = workFrom(o.rightWhy); } catch (e) { s = null; } }
  return !s ? [] : s.chain ? s.chain : [s];
}
const round10 = (v) => Math.round(v / PAY.step) * PAY.step;
// WHAT A CARD PAYS, and why: { secs (its fair time), pay, parts: { look, read, sums, story, next, count, taps, think }
// (seconds each), words, steps }. L: the level it was dealt at (its grade, where the card has no point of its own).
// A Mathball ball (order.kind 'ball'): its level's own amount.
export function workOf(o, L = null) {
  if (!o) return { secs: 0, pay: PAY.min, parts: {}, words: 0, steps: 0 };
  if (o.kind === 'ball') return { secs: null, pay: levelPay(L), parts: {}, words: 0, steps: 1, ball: true };
  const g = o.own && Number.isFinite(o.own.at) ? o.own.at : (L && Number.isFinite(L.grade) ? L.grade : 0);
  const words = wordsIn(o), perWord = Math.max(WORK.read[2], WORK.read[0] - WORK.read[1] * g);
  const parts = { look: WORK.look, read: words * perWord };
  const sums = o.play ? [] : sumsIn(o);
  let steps = 1;
  if (o.play) parts.taps = (o.facts && o.facts.squares || 3) * WORK.tap;
  else if (o.picFirst && sums.length) {
    // (a picture story: the things drawn on the card, counted)
    const things = Math.min(20, sums.reduce((t, s) => Math.max(t, s.op === 'add' ? s.a + s.b : s.op === 'mul' ? s.a * s.b : s.a), 0));
    parts.count = Math.max(1.5, things * WORK.count);
  } else if (sums.length) {
    // (each sum's time is a child's at the school year it is taught; an older card's sums, three-digit sums on an
    // eighth-grade card, go quicker: WORK.older)
    steps = sums.length;
    const quick = Math.max(WORK.older[1], Math.min(1, WORK.older[0] - g / WORK.older[2]));
    parts.sums = sums.reduce((t, s) => t + stepSecs(s), 0) * quick;
    if (words > 12) parts.story = WORK.story;
  } else {
    steps = Math.max(1, Math.min(3, o.size || 1));
    parts.think = steps * (WORK.think[0] + WORK.think[1] * g);
  }
  if (steps > 1) parts.next = (steps - 1) * WORK.next;
  for (const k of Object.keys(parts)) parts[k] = Math.round(parts[k] * 10) / 10;
  const secs = Math.round(Object.values(parts).reduce((a, b) => a + b, 0) * 10) / 10;
  return { secs, pay: round10(Math.max(PAY.min, Math.min(PAY.max, secs * PAY.rate))), parts, words, steps };
}

// RUSHED (the game's maker: "if someone is answering level 1 questions at an incredibly fast rate (like they are
// intentionally gaming the system) then they should only be making 50 credits"). Kind to a quick child who is right:
// only on the easiest levels (PAY.easy), only a RUN of very quick first picks, never one. Each first pick there adds how
// rushed it was (0 at PAY.quick[0] of the card's fair time or slower, 1 at PAY.quick[1] or quicker) to a run that keeps
// PAY.keep of itself at each pick, so a fair pace lets it fall straight back (a card answered by doing, the dock's
// squares tapped, never adds to it: that is play). Past PAY.run[0] the card's pay comes down,
// evenly, to PAY.floor at PAY.run[1]: full pay for the first two very quick answers in a row, about half for the third,
// the floor by about the fifth. Help used is never rushed; Mathball (no time given) never is.
// The run is the crew member's own (crew.pace.run, saved with them), across every job.
// -> how much of the pay is kept: 1 (all of it) .. 0 (down to the floor)
export function rushOf(crew, run = paceOf(crew).run) {
  const [a, b] = PAY.run;
  return 1 - Math.max(0, Math.min(1, (run - a) / (b - a)));
}
function paceOf(crew) {
  if (!isObj(crew.pace)) crew.pace = { run: 0 };
  crew.pace.run = Number.isFinite(+crew.pace.run) && +crew.pace.run > 0 ? +crew.pace.run : 0;
  return crew.pace;
}
// a first pick heard: the run moves (only an easy card's, with its time and no help, adds to it)
function hearPace(crew, q, worth, ms, helped) {
  const P = paceOf(crew), L = q.level, T = worth && worth.secs;
  let k = 0;
  // (a card answered by doing, the dock's squares tapped, is play however quick: never rushed)
  if (T && Number.isFinite(ms) && ms > 0 && !helped && !q.order.play && L && (L.grade ?? 0) <= PAY.easy) {
    const t = ms / 1000, [q0, q1] = PAY.quick;
    k = Math.max(0, Math.min(1, (q0 * T - t) / ((q0 - q1) * T)));
  }
  P.run = Math.round((P.run * PAY.keep + k) * 1000) / 1000;
  return P.run;
}
// a flat amount paid for something done that is not a card (free control's canisters docked): -> credits now
export function earn(crew, jobId, amount) {
  const n = whole(amount);
  crew.credits = whole(crew.credits) + n;
  if (jobId) jobTally(crew, jobId).earned += n;
  return whole(crew.credits);
}

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const whole = (v) => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);

// a level's grade: the school-guide point of its first Ask (Mathwood's makers' own points), unless the level says
export function gradeOf(job, L) {
  if (typeof L.grade === 'number') return L.grade;
  const a = L.gen.mix[0];
  return job.makers && job.makers[a.maker] ? job.makers[a.maker].at(a.step) : askAt(a);
}

const registered = new Set();
export function register(job) {
  if (!job.place) return false;
  if (registered.has(job.id)) return true;
  const P = job.place;
  for (const L of P.levels) {
    if (typeof L.grade !== 'number') L.grade = gradeOf(job, L);
    if (!L.strand) { const a = L.gen.mix[0]; L.strand = job.makers && job.makers[a.maker] ? job.makers[a.maker].strand : ({ words: 'words', wordsK: 'words' }[a.maker] || a.maker); }
    if (L.count == null) L.count = 5;
  }
  P.example = (L, rand) => example(job, L, rand);
  const ok = addPlace(P);
  if (ok) registered.add(job.id);
  return ok;
}

// ── a job's own makers: the same order shape as Mathwood's counter (src/math/counter.js counterOrder) ─────────────
// core = { key, story, ask, right: Face, slips: [Face & { slip, why }], pic, rightWhy, sum, help, own: { strand, at } }
// and, where a job wants them: picFirst (its picture is on the card from the start: the things to count ARE the
// question), lines (the card's own lines for the story, [[label, value], ...]: a pay slip's rows), chart (a chart
// beside the story: { title, rows: [[name, price], ...] }, the smelter's price list). An answer's face may be a SET of
// numbers, one to a row (`rows`: [[name, number], ...], the smelter's "how much of each metal"): its `big` is the
// same numbers in a line, for anything that reads the face as words.
export function ownOrder(core, rand = Math.random, coins = 4) {
  const t = tools(rand);
  const seen = new Set([String(core.right.v)]), wrong = [];
  for (const s of core.slips || []) {
    if (!s || wrong.length >= coins - 1) continue;
    if (s.v == null || seen.has(String(s.v)) || !(typeof s.v !== 'number' || s.v > 0)) continue;
    seen.add(String(s.v));
    wrong.push({ v: s.v, big: s.big, small: s.small || '', label: s.label, good: false, slip: s.slip || null, why: s.why || '', ...(s.svg ? { svg: s.svg } : {}), ...(s.rows ? { rows: s.rows } : {}) });
  }
  const R = core.right;
  // (an answer may be a picture: its face's svg goes on the button, the dock's panes, the pilot's maps)
  const all = t.shuffle([{ v: R.v, big: R.big, small: R.small || '', label: R.label, good: true, slip: null, why: '', ...(R.svg ? { svg: R.svg } : {}), ...(R.rows ? { rows: R.rows } : {}) }, ...wrong]);
  return {
    id: Math.floor(rand() * 1e9).toString(36), key: core.key, story: core.story, ask: core.ask, read: `${core.story} ${core.ask}`,
    coins: all, answer: R.label, pic: core.pic || null, picFirst: !!core.picFirst, rightWhy: core.rightWhy, sum: core.sum ? sumOf(core.sum) : null,
    help: core.help || null, own: core.own, credit: core.credit || [], facts: core.facts || null, size: core.size || 1, lines: core.lines || null,
    ...(core.lead ? { lead: core.lead } : {}), ...(core.tap ? { tap: core.tap } : {}), ...(core.chart ? { chart: core.chart } : {}),
  };
}

// ── a question ────────────────────────────────────────────────────────────────────────────────────────────────────
// live: what the job's own props are doing right now, for a maker that asks about it (the smelter's load in the hangar:
// src/crane.js load()); null where there is none (node, the levels page)
function make(job, L, { rand = Math.random, last = null, who = null, frac = 0, live = null } = {}) {
  // (a job whose questions follow its props may choose from the level's mix itself: the crane operator job asks about
  // the crane's next move; otherwise, and when it has no choice to make, Mathwood's own pick by weight)
  const ask = (job.pickAsk && live && job.pickAsk(L.gen.mix, { rand, last, live })) || pickAsk(L.gen.mix, rand, last);
  const own = job.makers && job.makers[ask.maker];
  for (let tries = 0; tries < 8; tries++) {
    try {
      const w = who || pickWho(job, rand, live);
      const o = own ? own.make(ask.step, { rand, who: w, frac, live })
        : storeOrder(ask, { rand, who: w, frac, longMost: 0, setting: job.setting });
      o.who = o.who || w;
      o.ask_ = { maker: ask.maker, step: ask.step };
      // (a job whose cards are told of where its props are: the pilot's, on a run that is not the Miner's)
      if (job.reword && live) job.reword(o, live);
      if (!o.own) o.own = { strand: own ? own.strand : L.strand, at: own ? own.at(ask.step) : askAt(ask) };
      return o;
    } catch (e) { if (tries === 7) throw e; }
  }
  return null;
}
const pickWho = (job, rand, live = null) => { const F = job.folkFor ? job.folkFor(live) : job.setting && job.setting.folk; return F && F.length ? F[Math.floor(rand() * F.length)] : null; };

export function deal(crew, job, { rand = Math.random, last = null, now = Date.now(), live = null } = {}) {
  register(job);
  const lv = levelFor(crew, job.place.id, { now });
  const order = make(job, lv.level, { rand, last, frac: lv.count ? lv.into / lv.count : 0, live });
  return { job: job.id, order, lv, level: lv.level, worth: workOf(order, lv.level), misses: 0, picked: new Set(), done: false, t0: now };
}

export function example(job, L, rand = Math.random) {
  const o = make(job, L, { rand });
  return { q: `${o.story} ${o.ask}`, a: o.answer };
}

// ── an answer ─────────────────────────────────────────────────────────────────────────────────────────────────────
// (pay false: a card on a captain's run, src/trip.js: the level and the kinds of math hear it as any card's, but it
// pays nothing by itself: the crew member's share of the haul is the pay for all the work of the run, src/missions.js)
export function answer(crew, job, q, coin, { ms = null, helped = false, now = Date.now(), pay: paid = true } = {}) {
  const c = typeof coin === 'number' ? q.order.coins[coin] : coin;
  if (!c || q.done) return null;
  const right = !!c.good, first = q.misses === 0;
  const L = q.level;
  let lv = null, pay = 0;
  if (first) {
    // (the first pick is the one the level hears: Mathwood's store does the same)
    try { lv = recordLevel(crew, job.place.id, { right, level: L.id, ms, sitDown: true, size: q.order.size || 1, now }); } catch (e) { console.warn('Pi Nebula: could not record the level', e); }
    const strands = [{ strand: q.order.own.strand, at: q.order.own.at }, ...(q.order.credit || []).filter((x) => x && STRAND[x.strand] && Number.isFinite(x.at)).map((x) => ({ strand: x.strand, at: x.at, weight: x.weight ?? 0.5 }))]
      .filter((x) => STRAND[x.strand]);
    try { if (strands.length) recordSkill(crew, strands, { right, ms, sitDown: true, size: q.order.size || 1, now }); } catch (e) { console.warn('Pi Nebula: could not record the skill', e); }
  }
  const tally = jobTally(crew, job.id);
  if (first) { tally.n++; if (right) tally.right++; }
  // THE PAY (above): the card's own, from its work; rushed on the easiest levels, less; after a miss, half
  const worth = q.worth || (q.worth = workOf(q.order, L));
  const run = first ? hearPace(crew, q, worth, ms, helped) : paceOf(crew).run, kept = worth.ball ? 1 : rushOf(crew, run);
  if (right) {
    const full = kept < 1 ? PAY.floor + (worth.pay - PAY.floor) * kept : worth.pay;
    pay = paid ? round10(first ? full : full * PAY.half) : 0;
    crew.credits = whole(crew.credits) + pay;
    tally.earned += pay;
    q.done = true;
  } else {
    q.misses++;
    q.picked.add(q.order.coins.indexOf(c));
  }
  const moved = lv ? lv.moved : 0;
  return { right, first, pay, worth: worth.pay, rushed: kept < 1, credits: whole(crew.credits), moved, up: moved > 0, down: moved < 0, level: lv, why: right ? q.order.rightWhy : c.why, helped };
}

export function jobTally(crew, id) {
  if (!isObj(crew.jobs)) crew.jobs = {};
  const j = isObj(crew.jobs[id]) ? crew.jobs[id] : (crew.jobs[id] = {});
  j.n = whole(j.n); j.right = whole(j.right); j.earned = whole(j.earned);
  return j;
}

// ── the level arrows ────────────────────────────────────────────────────────────────────────────────────────────
export function level(crew, job) { register(job); return levelTool(crew, job.place.id); }
export function step(crew, job, dir) { register(job); return stepLevel(crew, job.place.id, dir); }
export const credits = (crew) => whole(crew && crew.credits);
export { PLACE };
