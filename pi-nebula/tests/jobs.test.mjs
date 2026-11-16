// The station jobs' math (src/jobs/engine.js, galley.js, medical.js, smelter.js): every level of every open job deals good
// questions, answers move the level and pay credits as they should, the arrows step, and Mathwood's own places are
// untouched by the jobs joining them.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import { JOB as galley } from '../src/jobs/galley.js';
import { JOB as medical } from '../src/jobs/medical.js';
import { JOB as smelter, STEADY, CARRIES, METALS, LOADS, forget } from '../src/jobs/smelter.js';
import { helpPicture } from '../src/jobs/pics.js';
import { workOf } from '../../mathwood-valley/src/math/longwork.js';
import { JOB as arena } from '../src/jobs/arena.js';
import { JOB as dock } from '../src/jobs/dock.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { PROBLEMS, PLACE } from '../../mathwood-valley/src/levels/places.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';

const OPEN = [galley, medical, smelter, arena];
const crewOf = (age = null) => ({ id: 'c1', name: 'Test', look: { id: 'zuri' }, age });

test('the open jobs join Mathwood\'s levels cleanly', () => {
  for (const J of OPEN) assert.equal(E.register(J), true, J.id);
  assert.deepEqual(PROBLEMS, []);
  for (const J of OPEN) {
    const P = PLACE[J.id];
    assert.ok(P, J.id);
    // easiest first: the grades never drop
    for (let i = 1; i < P.levels.length; i++) assert.ok(P.levels[i].grade >= P.levels[i - 1].grade, `${J.id}/${P.levels[i].id}: ${P.levels[i].grade} after ${P.levels[i - 1].grade}`);
  }
  // Mathwood's own places are all still there
  for (const id of ['roundup', 'store', 'lockbox', 'sheep']) assert.ok(PLACE[id], id);
});

test('every level deals questions with one right answer, no numbers gone wrong, and Mathwood\'s west left out', () => {
  const WEST = /\b(horse|cattle|wagon|saloon|stagecoach|rifle|cowhand|steer|Yuma|Tucson|jerky|harvest supper|town social)\b/i;
  for (const J of OPEN) {
    for (const L of J.place.levels) {
      const rand = seeded(L.id.length * 97 + L.grade);
      for (let k = 0; k < 40; k++) {
        const crew = crewOf();
        setLevelAt(crew, J.place.id, L.id);
        const q = E.deal(crew, J, { rand });
        const o = q.order;
        assert.equal(q.level.id, L.id);
        assert.equal(o.coins.filter((c) => c.good).length, 1, `${J.id}/${L.id}: ${o.story}`);
        assert.ok(o.coins.length >= 3, `${J.id}/${L.id}: ${o.coins.length} coins`);
        assert.equal(new Set(o.coins.map((c) => c.label)).size, o.coins.length, `${J.id}/${L.id}: two coins alike`);
        const text = `${o.story} ${o.ask} ${o.coins.map((c) => `${c.big} ${c.small} ${c.why}`).join(' ')} ${o.rightWhy || ''}`;
        assert.ok(!/NaN|undefined|Infinity|\[object/.test(text), `${J.id}/${L.id}: ${text}`);
        assert.ok(!WEST.test(`${o.story} ${o.ask}`), `${J.id}/${L.id}: the west got in: ${o.story} ${o.ask}`);
        assert.ok(o.own && Number.isFinite(o.own.at), `${J.id}/${L.id}: no strand`);
      }
    }
  }
});

test('the own makers: the galley\'s cups and the medical drip are right', () => {
  const rand = seeded(5);
  for (let k = 0; k < 200; k++) {
    const g = galley.makers.cups.make(1 + (k % 2), { rand });
    const f = g.facts, right = g.coins.find((c) => c.good);
    const want = f.amt[0] * f.k[0] / (f.amt[1] * f.k[1]);
    const [t, b] = right.v.slice(1).split('/').map(Number);
    assert.ok(Math.abs(t / b - want) < 1e-9, `cups: ${g.story} -> ${right.label}`);
    const d = medical.makers.drip.make(1 + (k % 2), { rand });
    const r = d.coins.find((c) => c.good).v;
    if (d.facts.V) assert.equal(r * d.facts.h, d.facts.V);
    else assert.equal(r * 60, d.facts.R * d.facts.F);
  }
});

// ── the smelter's own makers ─────────────────────────────────────────────────────────────────────────────────
const num = (label) => Number(String(label).replace(/,/g, '').split(' ')[0]);
const rightOf = (o) => num(o.coins.find((c) => c.good).label);
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('the smelter: counting, parts, weights, percents and pay are right, and decimals stay decimals', () => {
  const rand = seeded(11), M = smelter.makers;
  for (let k = 0; k < 300; k++) {
    const frac = (k % 5) / 4;
    // counting: the right answer is the number of canisters drawn that the question asks for
    for (const step of [1, 2, 3]) {
      const o = M.count.make(step, { rand }), f = o.facts, pic = o.help.pic;
      assert.equal(o.picFirst, true); assert.equal(o.coins.length, 3, o.story);
      if (f.kind === 'racks') { assert.equal(rightOf(o), f.g * f.e); assert.equal(pic.g * pic.e, rightOf(o)); }
      else if (f.kind === 'full' || f.kind === 'empty') assert.equal(pic.slots.filter((x) => x === f.kind).length, rightOf(o), o.ask);
      else assert.equal(pic.slots.filter((x) => x !== 'none').length, rightOf(o), o.ask);
      assert.ok(rightOf(o) <= (step === 1 ? 5 : step === 2 ? CARRIES : 12));
    }
    // a part of the load
    for (const step of [1, 2]) { const o = M.part.make(step, { rand, frac }), f = o.facts; assert.ok(near(rightOf(o), f.whole * f.n / f.d), o.story); assert.ok(Number.isInteger(rightOf(o))); }
    // weights in tenths: adding, taking away, a load of canisters
    const a = M.weigh.make(1, { rand, frac }), fa = a.facts;
    assert.ok(near(rightOf(a), (fa.op === '+' ? fa.a + fa.b : fa.a - fa.b) / 10), a.story);
    const l = M.weigh.make(2, { rand, frac }), fl = l.facts;
    assert.ok(near(rightOf(l), fl.n * fl.w / 10), l.story);
    // percent
    for (const step of [1, 2]) { const o = M.percent.make(step, { rand, frac }), f = o.facts; assert.ok(near(rightOf(o), f.whole * f.pct / 100), `${o.story} -> ${o.answer}`); }
    // pay: tonnes times the price; the whole slip
    const p = M.pay.make(1, { rand, frac }), fp = p.facts;
    assert.ok(near(rightOf(p), fp.w / 10 * fp.price), p.story);
    assert.ok(METALS.some((m) => m.price === fp.price && p.story.includes(m.name)), 'a metal at its own price');
    const s = M.pay.make(2, { rand, frac }), fs = s.facts;
    assert.ok(near(rightOf(s), fs.n * fs.w / 10 * fs.pct / 100 * fs.price), s.story);
    assert.ok(near(fs.ore, fs.n * fs.w / 10) && near(fs.metal, fs.ore * fs.pct / 100));
    assert.equal(s.lines[s.lines.length - 1][1], '?');
    // no answer button hides a decimal as a fraction, and none shows a number gone wrong
    for (const o of [a, l, p, s]) for (const c of o.coins) assert.ok(/^[\d,]+(\.\d{1,2})?$/.test(c.big), `${o.story}: ${c.big}`);
  }
});

test('the smelter: every question has a picture and steps for Help, and its sums can be worked on paper', () => {
  const rand = seeded(23), M = smelter.makers;
  for (const [maker, steps] of [['count', [1, 2, 3]], ['part', [1, 2]], ['weigh', [1, 2]], ['percent', [1, 2]], ['pay', [1, 2]]]) {
    for (const step of steps) for (let k = 0; k < 60; k++) {
      const o = M[maker].make(step, { rand, frac: (k % 3) / 2 }), pic = helpPicture(o);
      assert.ok(pic.svg.startsWith('<svg') && !/NaN|undefined/.test(pic.svg), `${maker} ${step}: no picture`);
      // the picture never gives the answer away (the youngest count theirs; the others show a "?")
      if (maker !== 'count') assert.ok(pic.svg.includes('?'), `${maker} ${step}: the picture has no "?"`);
      if (maker === 'count') continue;
      // the sums: every step can be laid out by the worked sheet, the last one ends on the right answer, and each
      // later step works on from one before it
      assert.ok(o.sum, `${maker} ${step}: no sum`);
      const chain = o.sum.chain || [o.sum];
      for (const x of chain) assert.doesNotThrow(() => workOf(x), `${maker} ${step}: ${JSON.stringify(x)}`);
      chain.slice(1).forEach((x, i) => assert.ok(x.carried, `${maker} ${step}: step ${i + 2} does not follow on: ${JSON.stringify(chain)}`));
      const last = chain[chain.length - 1], end = last.op === 'add' ? last.a + last.b : last.op === 'sub' ? last.a - last.b : last.op === 'mul' ? last.a * last.b : last.a / last.b;
      assert.ok(near(end, rightOf(o)), `${maker} ${step}: ${o.story} ends on ${end}, the answer is ${o.answer}`);
    }
  }
});

test('the smelter: a slip counts the canisters in the hangar when the count suits and will stay; else its own', () => {
  const rand = seeded(31), M = smelter.makers;
  const load = (over = {}) => ({ canisters: CARRIES, phase: 'unload', onShip: 5, fullOnShip: 5, docked: [{ socket: 0, percent: 0 }, { socket: 2, percent: 40 }], drained: 1, onRack: 8, carried: 1,
    steady: { onShip: 60, fullOnShip: 60, docked: 60, drained: 60, onRack: 60 }, ...over });
  for (let k = 0; k < 120; k++) {
    forget();   // (each case afresh: a count of the hangar is asked about only once, see the next test)
    // the youngest: one of the counts that are 5 or fewer (5 on the ship, 2 at the wall), never the rack's 8
    const c = M.count.make(1, { rand, live: load() });
    assert.equal(c.facts.live, true); assert.ok(['ship', 'wall'].includes(c.facts.kind)); assert.equal(rightOf(c), c.facts.kind === 'ship' ? 5 : 2);
    // how many are still on the Miner: the ones really on it
    const st = M.count.make(2, { rand, live: load() });
    assert.equal(st.facts.kind, 'still'); assert.equal(rightOf(st), 5); assert.equal(st.help.pic.slots.filter((x) => x === 'none').length, CARRIES - 5);
    // a load of canisters: the canisters counted are the full ones on the ship, the ones at the wall, or all the ship carries
    const w = M.weigh.make(2, { rand, live: load() });
    assert.equal(w.facts.live, true); assert.equal(w.facts.n, { ship: 5, wall: 2, load: CARRIES }[w.facts.kind]);
    // ... and each of them holds the same on every slip about that load (one weight for the crane's whole round)
    for (const round of [1, 3, LOADS.length + 2]) assert.equal(M.weigh.make(2, { rand, live: load({ round }) }).facts.w, LOADS[round % LOADS.length]);
    // the whole slip is for the canisters the Miner carries, but it is a load from the log: it does not say "now"
    const slip = M.pay.make(2, { rand, live: load() });
    assert.equal(slip.facts.n, CARRIES); assert.equal(slip.facts.live, false);
    // a count about to change is not asked about; nor one that does not suit the level
    forget();
    const soon = load({ steady: { onShip: STEADY - 5, fullOnShip: STEADY - 5, docked: STEADY - 5, drained: 60, onRack: 60 } });
    assert.equal(M.count.make(1, { rand, live: soon }).facts.live, false);
    assert.notEqual(M.weigh.make(2, { rand, live: soon }).facts.kind, 'ship');
    assert.equal(M.count.make(1, { rand, live: load({ onShip: 8, fullOnShip: 8, docked: [], onRack: 8 }) }).facts.live, false);
    // while empties are going back on, the ship's canisters are not "still full"
    const loading = load({ phase: 'load', onShip: 3, fullOnShip: 0 });
    assert.notEqual(M.weigh.make(2, { rand, live: loading }).facts.kind, 'ship');
    // no hangar (node, the levels page): the job's own numbers
    assert.equal(M.count.make(1, { rand }).facts.live, false);
    assert.equal(M.weigh.make(2, { rand }).facts.live, false);
  }
  // through the engine: the live load reaches the maker
  const crew = crewOf();
  setLevelAt(crew, 'smelter', 'kCount');
  let seen = 0;
  for (let k = 0; k < 40; k++) { forget(); const q = E.deal(crew, smelter, { rand: seeded(k + 1), live: load() }); if (q.order.facts && q.order.facts.live) seen++; }
  assert.ok(seen > 5, `only ${seen} of 40 slips used the hangar's count`);
});

test('the smelter: a count of the hangar is asked about once, and again only when the crane has changed it', () => {
  const rand = seeded(41), M = smelter.makers;
  const load = (over = {}) => ({ canisters: CARRIES, phase: 'unload', round: 2, onShip: 5, fullOnShip: 5, docked: [{ socket: 0, percent: 0 }, { socket: 2, percent: 40 }], drained: 1, onRack: 8, carried: 1,
    steady: { onShip: 60, fullOnShip: 60, docked: 60, drained: 60, onRack: 60 }, ...over });
  forget();
  // level 1: 5 on the ship and 2 at the wall are each asked once, in either order; then slips from the log
  const first = [1, 2, 3, 4, 5, 6].map(() => M.count.make(1, { rand, live: load() }).facts);
  assert.deepEqual(first.map((f) => f.live), [true, true, false, false, false, false]);
  assert.deepEqual(first.slice(0, 2).map((f) => f.kind).sort(), ['ship', 'wall']);
  // the crane docks another: 3 at the wall is new, and is asked once
  const more = { docked: [{ socket: 0, percent: 0 }, { socket: 2, percent: 0 }, { socket: 4, percent: 90 }], onShip: 4, fullOnShip: 4 };
  const next = [1, 2, 3, 4].map(() => M.count.make(1, { rand, live: load(more) }).facts);
  assert.equal(next.filter((f) => f.live).length, 2); assert.equal(next.slice(2).filter((f) => f.live).length, 0);
  // how many are still on the Miner: once for 4, and once more when it is 3
  forget();
  assert.equal(M.count.make(2, { rand, live: load(more) }).facts.live, true);
  for (let k = 0; k < 10; k++) assert.equal(M.count.make(2, { rand, live: load(more) }).facts.live, false);
  assert.equal(M.count.make(2, { rand, live: load({ ...more, onShip: 3, fullOnShip: 3 }) }).facts.n, 3);
  // a load of canisters: the ship's, the wall's and the whole load's are three sums, each asked once a round
  forget();
  const sums = [1, 2, 3, 4, 5, 6, 7].map(() => M.weigh.make(2, { rand, live: load() }).facts);
  assert.deepEqual(sums.map((f) => f.live), [true, true, true, false, false, false, false]);
  assert.deepEqual(sums.slice(0, 3).map((f) => f.kind).sort(), ['load', 'ship', 'wall']);
  assert.equal(new Set(sums.slice(0, 3).map((f) => f.n)).size, 3);
  // a new round's load is new
  assert.equal(M.weigh.make(2, { rand, live: load({ round: 3 }) }).facts.live, true);
  forget();
});

test('an answer: the first pick counts, a right one pays, a miss pays nothing, the level moves', () => {
  const crew = crewOf(9);
  const q = E.deal(crew, galley, { rand: seeded(3) });
  const wrong = q.order.coins.findIndex((c) => !c.good), right = q.order.coins.findIndex((c) => c.good);
  const a = E.answer(crew, galley, q, wrong);
  assert.equal(a.right, false); assert.equal(a.pay, 0); assert.equal(E.credits(crew), 0);
  const b = E.answer(crew, galley, q, right);
  assert.equal(b.right, true); assert.equal(b.first, false); assert.equal(b.pay, E.PAY.after);
  assert.equal(E.answer(crew, galley, q, right), null, 'a finished question takes no more picks');
  // right first time, again and again: credits at the level's pay, and the level climbs
  const start = E.level(crew, galley).i;
  let paid = 0;
  for (let k = 0; k < 8; k++) {
    const q2 = E.deal(crew, galley, { rand: seeded(10 + k) });
    const r = E.answer(crew, galley, q2, q2.order.coins.findIndex((c) => c.good));
    assert.equal(r.pay, E.payFor(q2.level)); paid += r.pay;
  }
  assert.equal(E.credits(crew), E.PAY.after + paid);
  assert.ok(E.level(crew, galley).i > start, 'the level climbed');
  assert.equal(crew.jobs.galley.n, 9);
});

test('the arrows step the level by hand, and stop at the ends', () => {
  const crew = crewOf();
  E.deal(crew, medical, { rand: seeded(1) });
  const v0 = E.level(crew, medical);
  const up = E.step(crew, medical, 1);
  assert.equal(up.i, v0.i + 1);
  assert.equal(E.deal(crew, medical, { rand: seeded(2) }).level.id, up.id);
  setLevelAt(crew, 'medical', medical.place.levels[0].id);
  assert.equal(E.step(crew, medical, -1), null);
});

test('the jobs still to come are marked, with nothing to play yet', () => {
  // (none is left to come: the arena is Mathball, its own tests mathball.test.mjs; the dock's bridge is open, a try of
  // three rings: its own tests, dock.test.mjs. A job closed again would have to be marked as one still to come)
  for (const J of [arena, dock].filter((j) => j.open === false)) {
    assert.equal(J.open, false); assert.equal(J.place, null);
    assert.ok(J.spot && J.sign && J.hint, J.id);
  }
  assert.equal(dock.open, true); assert.equal(arena.open, true);
});
