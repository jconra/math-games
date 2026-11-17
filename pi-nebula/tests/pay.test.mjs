// THE PAY BY THE WORK A CARD ASKS (src/jobs/engine.js workOf, answer, rushOf): the game's maker's anchors (2026-11-17,
// CR2-7: "if a kindergartener is doing easy questions at a moderate rate then they should be making 100 - 150, or 200 if
// its a word problem"; more reading, long division or long multiplication pays more; a run of level 1 cards answered
// "at an incredibly fast rate ... only 50 credits"; "Half the full pay" after a miss), and the young and the older
// earning about the same in an hour. Then (2026-11-17, "About an hour: every card pays a third more") every amount a
// third more: 15 credits a second became 20, so his 100 to 150 is 130 to 200 here and his 200 about 270.
//   node --test pi-nebula/tests/pay.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import { JOB as galley } from '../src/jobs/galley.js';
import { JOB as medical } from '../src/jobs/medical.js';
import { JOB as smelter } from '../src/jobs/smelter.js';
import { JOB as crane } from '../src/jobs/crane.js';
import { JOB as dock } from '../src/jobs/dock.js';
import { JOB as arena } from '../src/jobs/arena.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';
import { storeOrder } from '../../mathwood-valley/src/levels/place/store.js';

const JOBS = [galley, medical, smelter, crane, dock];
const crewOf = () => ({ id: 'c1', name: 'Test', look: { id: 'zuri' } });
// a card dealt at one level of a job, as the job deals it
function cardAt(job, L, rand) {
  E.register(job);
  const ask = L.gen.mix[Math.floor(rand() * L.gen.mix.length)], own = job.makers && job.makers[ask.maker];
  return own ? own.make(ask.step, { rand }) : storeOrder(ask, { rand, setting: job.setting, longMost: 0 });
}
const paysAt = (job, id, n = 30, seed = 1) => {
  const L = job.place.levels.find((x) => x.id === id), rand = seeded(seed), out = [];
  for (let k = 0; k < n; k++) out.push(E.workOf(cardAt(job, L, rand), L).pay);
  return out;
};
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

test('every card of every job pays from PAY.min to PAY.max, in tens, with its fair time and the parts of it', () => {
  for (const job of JOBS) {
    E.register(job);
    job.place.levels.forEach((L, i) => {
      const rand = seeded(100 + i);
      for (let k = 0; k < 12; k++) {
        const w = E.workOf(cardAt(job, L, rand), L);
        assert.ok(w.pay >= E.PAY.min && w.pay <= E.PAY.max && w.pay % 10 === 0, `${job.id}/${L.id}: ${w.pay}`);
        assert.ok(w.secs > 4 && w.secs < 80, `${job.id}/${L.id}: ${w.secs} s`);
        assert.ok(Math.abs(Object.values(w.parts).reduce((a, b) => a + b, 0) - w.secs) < 0.3, 'the parts add up to the time');
      }
    });
  }
});

test('his anchors, a third more: an easy card for the youngest pays 130 to 200, a picture story about 270, an older word problem more', () => {
  // easy cards for the youngest, no story to work out: bracing the dock's squares, which pane fits, counting canisters
  for (const p of [...paysAt(dock, 'brace', 4), ...paysAt(dock, 'fit', 8)]) assert.ok(p >= 130 && p <= 200, 'easy: ' + p);
  for (const p of paysAt(smelter, 'kCount', 20).filter((x, i, a) => a.length)) assert.ok(p >= 130 && p <= 310, 'counting: ' + p);
  // a picture story for the youngest (a word problem): about 270 (his 200, a third more)
  for (const J of [galley, medical]) { const m = mean(paysAt(J, 'kAll', 30)); assert.ok(m >= 230 && m <= 310, `${J.id} picture stories: ${m}`); }
  // an older child's one-step word problem: 270 to 400 (his 200 to 300, a third more); two steps: more
  const one = paysAt(galley, 'groups', 30), two = paysAt(galley, 'recipe', 30);
  assert.ok(mean(one) >= 270 && mean(one) <= 400, 'one step: ' + mean(one));
  assert.ok(mean(two) > mean(one) + 20, `two steps ${mean(two)} against one ${mean(one)}`);
  // the smelter's whole pay slip (three sums and more) pays the most of its ladder
  const slip = paysAt(smelter, 'payslip', 40), share = paysAt(smelter, 'share', 40);
  assert.ok(Math.max(...slip) >= 800 && mean(slip) > mean(share), `the pay slip ${mean(slip)} against sharing ${mean(share)}`);
});

test('the work: more reading pays more; long division and long multiplication pay more than the same story in the tables', () => {
  const L = { grade: 40 };
  const card = (story, sum) => ({ story, ask: 'How many?', sum, own: { strand: 'words', at: 40 } });
  const short = E.workOf(card('A bag holds 56 mL over 7 hours.', { op: 'div', a: 56, b: 7 }), L);
  const long = E.workOf(card('A bag holds 56 mL. It has to run evenly over 7 hours, the same in each hour, all through the night shift.', { op: 'div', a: 56, b: 7 }), L);
  assert.ok(long.pay > short.pay, `reading: ${long.pay} > ${short.pay}`);
  const inTables = E.workOf(card('A bag holds 56 mL. It has to run evenly over 7 hours.', { op: 'div', a: 56, b: 7 }), L);
  const longDiv = E.workOf(card('A bag holds 875 mL. It has to run evenly over 7 hours.', { op: 'div', a: 875, b: 7 }), L);
  assert.ok(longDiv.pay >= inTables.pay + 200, `long division: ${longDiv.pay} against ${inTables.pay}`);
  const fact = E.workOf(card('6 trays with 4 rolls on each.', { op: 'mul', a: 6, b: 4 }), L);
  const longMul = E.workOf(card('36 trays with 24 rolls on each.', { op: 'mul', a: 36, b: 24 }), L);
  assert.ok(longMul.pay >= fact.pay + 200, `long multiplication: ${longMul.pay} against ${fact.pay}`);
  // the sums themselves: a fact is quick, carrying a little more, long work much more; halving and zeros stay quick
  const s = (op, a, b) => E.stepSecs({ op, a, b });
  assert.ok(s('add', 3, 4) < s('add', 27, 6) && s('add', 27, 6) < s('add', 348, 275));
  assert.ok(s('mul', 7, 8) < s('mul', 17, 8) && s('mul', 17, 8) < s('mul', 47, 36));
  assert.ok(s('div', 3600, 2) < s('div', 875, 7) && s('div', 5400, 60) < s('div', 875, 7) && s('div', 875, 7) < s('div', 9875, 25));
  assert.ok(s('add', 2.8, 0.7) > s('add', 28, 7), 'decimals a little more');
});

test('a right pick after a miss pays half the card\'s pay; Help never costs', () => {
  const crew = crewOf();
  setLevelAt(crew, 'galley', 'recipe');
  const q = E.deal(crew, galley, { rand: seeded(4) });
  const wrong = q.order.coins.findIndex((c) => !c.good), right = q.order.coins.findIndex((c) => c.good);
  assert.equal(E.answer(crew, galley, q, wrong, { ms: 9000 }).pay, 0);
  const r = E.answer(crew, galley, q, right, { ms: 15000, helped: true });
  assert.equal(r.pay, Math.round(q.worth.pay / 2 / 10) * 10);
  const q2 = E.deal(crew, galley, { rand: seeded(5) });
  assert.equal(E.answer(crew, galley, q2, q2.order.coins.findIndex((c) => c.good), { ms: 20000, helped: true }).pay, q2.worth.pay, 'Help used: the full pay');
});

test('rushed: only a run of very quick answers on the easiest levels comes down to 50, and a fair pace brings it back', () => {
  const crew = crewOf();
  setLevelAt(crew, 'galley', 'kAll');
  const go = (ms, opts = {}) => { const q = E.deal(crew, galley, { rand: seeded(Math.floor(Math.random() * 1e6)) }); return { q, r: E.answer(crew, galley, q, q.order.coins.findIndex((c) => c.good), { ms, ...opts }) }; };
  // (kept to the first level: the staircase would climb a quick child out of it, which is the point of it)
  crew.levels.places.galley.keep = true;
  const run = [];
  for (let k = 0; k < 6; k++) run.push(go(1200));
  assert.equal(run[0].r.pay, run[0].q.worth.pay, 'one very quick answer: the full pay');
  assert.equal(run[1].r.pay, run[1].q.worth.pay, 'two in a row: still the full pay');
  assert.ok(run[2].r.pay < run[2].q.worth.pay && run[2].r.pay > E.PAY.floor, 'the third: less');
  assert.equal(run[5].r.pay, E.PAY.floor, 'a run of them: 50 credits');
  assert.equal(run[5].r.rushed, true);
  // a fair pace: the full pay again at once
  const fair = go(9000);
  assert.equal(fair.r.pay, fair.q.worth.pay, 'a fair pace: the full pay');
  // quick answers with Help open are never rushed
  for (let k = 0; k < 6; k++) go(1200, { helped: true });
  assert.equal(go(9000).r.rushed, false);
  // the run is the crew member's own, saved with them
  assert.ok(Number.isFinite(crew.pace.run));
});

test('rushed never touches the harder levels, a quick child at a fair pace, or Mathball', () => {
  const crew = crewOf();
  setLevelAt(crew, 'medical', 'table');
  crew.levels.places.medical.keep = true;
  for (let k = 0; k < 8; k++) {
    const q = E.deal(crew, medical, { rand: seeded(40 + k) });
    const r = E.answer(crew, medical, q, q.order.coins.findIndex((c) => c.good), { ms: 900 });
    assert.equal(r.pay, q.worth.pay, 'a harder level, answered fast: the full pay');
  }
  // the dock's squares tapped as fast as fingers go: play, never rushed
  const tapper = crewOf();
  setLevelAt(tapper, 'dock', 'brace'); tapper.levels.places.dock.keep = true;
  for (let k = 0; k < 8; k++) { const q = E.deal(tapper, dock, { rand: seeded(80 + k) }); assert.equal(E.answer(tapper, dock, q, 0, { ms: 700 }).pay, q.worth.pay, 'tapping is play'); }
  // a quick but fair child on the easiest level: 4 to 5 seconds a card
  const kid = crewOf();
  setLevelAt(kid, 'galley', 'kAll'); kid.levels.places.galley.keep = true;
  for (let k = 0; k < 10; k++) {
    const q = E.deal(kid, galley, { rand: seeded(60 + k) });
    const r = E.answer(kid, galley, q, q.order.coins.findIndex((c) => c.good), { ms: 0.36 * q.worth.secs * 1000 });
    assert.equal(r.pay, q.worth.pay, 'quick and fair: the full pay');
  }
  // Mathball's balls: their level's own amount, never rushed
  E.register(arena);
  const m = crewOf();
  arena.place.levels.forEach((L) => {
    const q = { order: { kind: 'ball', coins: [{ good: true }], own: { strand: L.strand, at: L.grade }, credit: [], size: 1 }, level: L, misses: 0, picked: new Set(), done: false };
    assert.equal(E.answer(m, arena, q, 0, {}).pay, E.levelPay(L));
  });
});

test('Mathball keeps its pay: a good two-minute round (12 to 14 right balls) makes about 1,000 to 2,000', () => {
  E.register(arena);
  for (const L of arena.place.levels) {
    const p = E.levelPay(L);
    assert.ok(p * 12 >= 900 && p * 14 <= 2400, `${L.id}: ${p} a ball`);
  }
});

test('a young child and an older one earn about the same in an hour (each card pays for its time)', () => {
  // (each at a fair pace: the card's own fair time, a moment between cards, 4 in 5 right first time and the rest half)
  const rateOf = (picks) => {
    let credits = 0, secs = 0;
    for (const [job, ids] of picks) for (const id of ids) {
      const L = job.place.levels.find((x) => x.id === id), rand = seeded(id.length * 31 + job.id.length);
      for (let k = 0; k < 20; k++) { const w = E.workOf(cardAt(job, L, rand), L); credits += w.pay * (0.8 + 0.2 * E.PAY.half); secs += w.secs * 1.08 + 1.6; }
    }
    return credits / secs * 60;
  };
  const young = rateOf([[galley, ['kAll', 'kLeft', 'kPast', 'kTrays']], [medical, ['kAll', 'kLeft', 'kTrays']], [smelter, ['kCount', 'kFull', 'kRacks']], [dock, ['brace', 'fit', 'count']]]);
  const older = rateOf([[galley, ['recipe', 'table', 'mix', 'prop']], [medical, ['rate', 'table', 'mix', 'prop']], [smelter, ['percent', 'tonnes', 'anyPercent', 'credits']], [dock, ['corner', 'area', 'third']]]);
  assert.ok(Math.abs(young - older) / older < 0.25, `credits a minute: young ${young.toFixed(0)}, older ${older.toFixed(0)}`);
  // and the Explorer (50,000 to 60,000) takes each of them about an hour of play (his choice: it was an hour and a half)
  for (const r of [young, older]) assert.ok(50000 / r >= 45 && 60000 / r <= 80, `minutes to the Explorer: ${(50000 / r).toFixed(0)} to ${(60000 / r).toFixed(0)}`);
});

test('free control (the crane by hand) pays 20 credits a canister, through the pay\'s own credits and tally', async () => {
  // (src/jobs/index.js payDock: no card, so no work and no level: a flat FREE.dock from src/cranedrive.js, which needs
  // three.js, so it is read here as text)
  const { readFileSync } = await import('node:fs');
  const drive = readFileSync(new URL('../src/cranedrive.js', import.meta.url), 'utf8'), jobs = readFileSync(new URL('../src/jobs/index.js', import.meta.url), 'utf8');
  assert.match(drive, /export const FREE = \{ dock: 20 \}/);
  assert.match(jobs, /crewNow\.credits = credits\(crewNow\) \+ FREE\.dock;/);
  assert.match(jobs, /jobTally\(crewNow, 'crane'\)\.earned \+= FREE\.dock;/);
  const crew = crewOf(); crew.credits = 130;
  crew.credits = E.credits(crew) + 20; E.jobTally(crew, 'crane').earned += 20;
  assert.equal(E.credits(crew), 150); assert.equal(crew.jobs.crane.earned, 20);
  // (earn: the same flat amount in one call, for anything else done that is not a card)
  assert.equal(E.earn(crew, 'crane', 20), 170); assert.equal(crew.jobs.crane.earned, 40);
});
