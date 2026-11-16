// The starting difficulty, the range of levels and KEEP TO THESE LEVELS at the station's jobs: a crew member made with
// Easy, Medium or Hard starts each job's ladder there (Mathwood's levels, shared: model.js THE SEED; "Start grown-ups
// higher"), a range set for a job keeps its questions inside it, and with keep on the level never moves by itself.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import { JOB as galley } from '../src/jobs/galley.js';
import { JOB as medical } from '../src/jobs/medical.js';
import { JOB as smelter } from '../src/jobs/smelter.js';
import { JOB as crane } from '../src/jobs/crane.js';
import { seeded } from '../../mathwood-valley/src/levels/kit.js';
import { setRange, setKeep, rangeOf, stateOf, levelsOf } from '../../mathwood-valley/src/levels/model.js';
import { makeStore } from '../../shared/players.js';

const JOBS = [galley, medical, smelter, crane];
const crewOf = (extra = {}) => ({ id: 'c1', name: 'Test', look: { id: 'zuri' }, ...extra });
const T0 = Date.UTC(2026, 10, 16, 15);
const ids = (job) => job.place.levels.map((L) => L.id);

test('a crew member\'s starting difficulty: Easy at each job\'s first level; Medium and Hard higher (Hard near the top)', () => {
  for (const J of JOBS) E.register(J);
  const want = { galley: ['bigger', 'table'], medical: ['dose', 'table'], smelter: ['part', 'tonnes'], crane: ['cHoist', 'cTrips'] };
  for (const J of JOBS) {
    const at = (start) => E.deal(crewOf({ start }), J, { rand: seeded(3), now: T0 }).level.id;
    assert.equal(at('easy'), ids(J)[0], `${J.id}: Easy`);
    assert.equal(at('medium'), want[J.id][0], `${J.id}: Medium`);
    assert.equal(at('hard'), want[J.id][1], `${J.id}: Hard`);
    assert.ok(ids(J).indexOf(want[J.id][1]) >= ids(J).length - 5, `${J.id}: Hard is near the top of the ladder`);
  }
  // a crew member saved before, with an age, keeps the age's start
  assert.equal(E.deal(crewOf({ age: 15 }), galley, { rand: seeded(3), now: T0 }).level.id, 'bigger');
  assert.equal(E.deal(crewOf({ age: 9 }), galley, { rand: seeded(3), now: T0 }).level.id, 'kPast');
});

test('the shared store keeps the starting difficulty (and an older save\'s age), and drops a bad one', () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const store = makeStore({ key: 'test.difficulty', game: 'Test' });
  const a = store.make('Ana', { id: 'zuri' }); a.start = 'hard'; store.save(a);
  const b = store.make('Bo', { id: 'zuri' }); b.start = 'tricky'; b.age = 12; store.save(b);
  const back = Object.fromEntries(store.load().map((p) => [p.name, p]));
  assert.equal(back.Ana.start, 'hard');
  assert.equal('start' in back.Bo, false);
  assert.equal(back.Bo.age, 12);
  delete globalThis.localStorage;
});

test('a range set for a job keeps its questions inside it, and keep-to holds the level still while the credits still come', () => {
  for (const J of JOBS) E.register(J);
  const c = crewOf({ start: 'easy' });
  assert.equal(setRange(c, 'medical', 'groups', 'rate', { now: T0 }), true);
  const rand = seeded(11);
  const seen = new Set();
  for (let k = 0; k < 30; k++) {
    const q = E.deal(c, medical, { rand, now: T0 });
    seen.add(q.level.id);
    E.answer(c, medical, q, q.order.coins.findIndex((x) => x.good), { ms: 6000, now: T0 });
  }
  const R = rangeOf(c, 'medical');
  for (const id of seen) { const i = ids(medical).indexOf(id); assert.ok(i >= R.lo && i <= R.hi, `${id} is inside the range`); }
  assert.equal(stateOf(c, 'medical').id, 'rate', 'right every time: at the hardest level of the range, no further');
  // keep to these levels: the arrows put it on a level, and thirty answers later it is still there; credits paid
  setKeep(c, 'medical', true, { now: T0 });
  assert.equal(E.step(c, medical, -1).id, 'dose');
  const credits0 = E.credits(c);
  let moved = 0;
  for (let k = 0; k < 30; k++) {
    const q = E.deal(c, medical, { rand, now: T0 });
    assert.equal(q.level.id, 'dose');
    const r = E.answer(c, medical, q, k % 4 ? q.order.coins.findIndex((x) => x.good) : q.order.coins.findIndex((x) => !x.good), { ms: 6000, now: T0 });
    if (r.up || r.down) moved++;
  }
  assert.equal(moved, 0, 'never "up a level" or "a level easier" while kept');
  assert.ok(E.credits(c) > credits0, 'the right answers still pay');
  const v = E.level(c, medical);
  assert.deepEqual([v.kept, v.canUp, v.canDown], [true, true, true]);
  assert.equal(E.step(c, medical, +1).id, 'rate');
  assert.equal(E.step(c, medical, +1), null, 'the arrows stop at the range\'s end');
  // a reload keeps it all (the shared store's save is plain JSON)
  const back = JSON.parse(JSON.stringify(c));
  levelsOf(back);
  assert.deepEqual([rangeOf(back, 'medical').loId, rangeOf(back, 'medical').hiId, rangeOf(back, 'medical').keep], ['groups', 'rate', true]);
});
