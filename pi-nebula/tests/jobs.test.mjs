// The station jobs' math (src/jobs/engine.js, galley.js, medical.js): every level of every open job deals good
// questions, answers move the level and pay credits as they should, the arrows step, and Mathwood's own places are
// untouched by the jobs joining them.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import { JOB as galley } from '../src/jobs/galley.js';
import { JOB as medical } from '../src/jobs/medical.js';
import { JOB as smelter } from '../src/jobs/smelter.js';
import { JOB as arena } from '../src/jobs/arena.js';
import { JOB as dock } from '../src/jobs/dock.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { PROBLEMS, PLACE } from '../../mathwood-valley/src/levels/places.js';
import { setLevelAt } from '../../mathwood-valley/src/levels/model.js';

const OPEN = [galley, medical];
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
  for (const J of [smelter, arena, dock]) {
    assert.equal(J.open, false); assert.equal(J.place, null);
    assert.ok(J.spot && J.sign && J.hint, J.id);
  }
});
