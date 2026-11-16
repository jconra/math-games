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
//                                        pic, rightWhy, sum, own) and lv (levelFor's answer: the level, its place)
//   answer(crew, job, q, coin, { ms, helped })   -> { right, first, pay, credits, moved, level, up, down }
//                                        the first pick of a question is the one that counts for the level; a right
//                                        pick after a miss still pays a little; changes the crew member (save after)
//   level(crew, job)                  -> the level tool's view (Mathwood leveltool.js): the arrows and the bar
//   step(crew, job, dir)              -> the arrows: up or down a level by hand (changes the crew member: save after)
//   payFor(level)                     -> credits for a right first pick at that level
//   example(job, level, rand)         -> { q, a }   one question as text (Mathwood's levels page shape)

import { addPlace, PLACE } from '../../../mathwood-valley/src/levels/places.js';
import { levelFor, recordLevel } from '../../../mathwood-valley/src/levels/model.js';
import { storeOrder, pickAsk, askAt } from '../../../mathwood-valley/src/levels/place/store.js';
import { record as recordSkill, STRAND } from '../../../mathwood-valley/src/math/skill.js';
import { levelTool, stepLevel } from '../../../mathwood-valley/src/ui/leveltool.js';
import { sumOf } from '../../../mathwood-valley/src/math/jobsums.js';
import { tools } from '../../../mathwood-valley/src/math/counterkit.js';

// THE ONE PAY TABLE for every job (the game's maker, 2026-11-16: "I think that people should be able to buy a ship
// after playing for about an hour ... a ship should cost about 50,000 credits ... Maybe faster questions get 50 credits
// and harder questions get 200 credits", and "It would be cool if the player got paid on average 1,000 credits a
// minute"): a right first pick pays `base` at a job's easiest level (the school guide's 0), rising evenly to `top` at
// `topGrade` (eighth grade) and no more above it, in tens; about 100 in the middle. A ship's price is SHIP (not used
// yet: nothing is for sale).
export const PAY = {
  base: 50,        // credits for a right first pick on a job's easiest level...
  top: 200,        // ...rising evenly with the school guide (0..100) to this...
  topGrade: 80,    // ...at this point of it (eighth grade), and no more above it
  step: 10,        // paid in tens
  after: 20,       // a right pick after a miss
};
export const SHIP = 50000;   // what a ship will cost (the game's maker's figure, for later)
export const payFor = (L) => {
  const g = Math.max(0, Math.min(PAY.topGrade, L ? L.grade : 0));
  return Math.round((PAY.base + (PAY.top - PAY.base) * g / PAY.topGrade) / PAY.step) * PAY.step;
};

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
// question), lines (the card's own lines for the story, [[label, value], ...]: a pay slip's rows)
export function ownOrder(core, rand = Math.random, coins = 4) {
  const t = tools(rand);
  const seen = new Set([String(core.right.v)]), wrong = [];
  for (const s of core.slips || []) {
    if (!s || wrong.length >= coins - 1) continue;
    if (s.v == null || seen.has(String(s.v)) || !(typeof s.v !== 'number' || s.v > 0)) continue;
    seen.add(String(s.v));
    wrong.push({ v: s.v, big: s.big, small: s.small || '', label: s.label, good: false, slip: s.slip || null, why: s.why || '' });
  }
  const R = core.right;
  const all = t.shuffle([{ v: R.v, big: R.big, small: R.small || '', label: R.label, good: true, slip: null, why: '' }, ...wrong]);
  return {
    id: Math.floor(rand() * 1e9).toString(36), key: core.key, story: core.story, ask: core.ask, read: `${core.story} ${core.ask}`,
    coins: all, answer: R.label, pic: core.pic || null, picFirst: !!core.picFirst, rightWhy: core.rightWhy, sum: core.sum ? sumOf(core.sum) : null,
    help: core.help || null, own: core.own, credit: core.credit || [], facts: core.facts || null, size: core.size || 1, lines: core.lines || null,
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
      const w = who || pickWho(job, rand);
      const o = own ? own.make(ask.step, { rand, who: w, frac, live })
        : storeOrder(ask, { rand, who: w, frac, longMost: 0, setting: job.setting });
      o.who = o.who || w;
      o.ask_ = { maker: ask.maker, step: ask.step };
      if (!o.own) o.own = { strand: own ? own.strand : L.strand, at: own ? own.at(ask.step) : askAt(ask) };
      return o;
    } catch (e) { if (tries === 7) throw e; }
  }
  return null;
}
const pickWho = (job, rand) => { const F = job.setting && job.setting.folk; return F && F.length ? F[Math.floor(rand() * F.length)] : null; };

export function deal(crew, job, { rand = Math.random, last = null, now = Date.now(), live = null } = {}) {
  register(job);
  const lv = levelFor(crew, job.place.id, { now });
  const order = make(job, lv.level, { rand, last, frac: lv.count ? lv.into / lv.count : 0, live });
  return { job: job.id, order, lv, level: lv.level, misses: 0, picked: new Set(), done: false, t0: now };
}

export function example(job, L, rand = Math.random) {
  const o = make(job, L, { rand });
  return { q: `${o.story} ${o.ask}`, a: o.answer };
}

// ── an answer ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function answer(crew, job, q, coin, { ms = null, helped = false, now = Date.now() } = {}) {
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
  if (right) {
    pay = first ? payFor(L) : PAY.after;
    crew.credits = whole(crew.credits) + pay;
    tally.earned += pay;
    q.done = true;
  } else {
    q.misses++;
    q.picked.add(q.order.coins.indexOf(c));
  }
  const moved = lv ? lv.moved : 0;
  return { right, first, pay, credits: whole(crew.credits), moved, up: moved > 0, down: moved < 0, level: lv, why: right ? q.order.rightWhy : c.why, helped };
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
