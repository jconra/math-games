// The job people's plan (src/jobfolk.js's people and lines, src/jobfolkplan.js): a person at every outdoor job and the
// sheriff, each with a short hello (their problem, then plainly what to do) and thank-yous; the hello is said on coming
// up and not again until the player has been away a while; walking away from an area job is noticed once, and only
// after working there; a spot to stand is found round anything in the way.
// Run with:  node --test bandit-math/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { JOB_FOLK, FOLK_BY_ID, FOREMAN_HELLO, TALK, sayMs, standSpot, makeGreeter, makeLeaveWatch, thanksFor, WORK } from '../src/jobfolkplan.js';

test('a person at every outdoor job and the sheriff, each with a name, a role and a look', () => {
  const jobs = JOB_FOLK.map((f) => f.job).sort();
  assert.deepEqual(jobs, ['boxes', 'deer', 'pigs', 'roundup', 'sheep', 'wagon'].sort());
  assert.equal(new Set(JOB_FOLK.map((f) => f.id)).size, JOB_FOLK.length, 'ids are different');
  assert.equal(new Set(JOB_FOLK.map((f) => f.name)).size, JOB_FOLK.length, 'names are different');
  for (const f of JOB_FOLK) {
    assert.ok(f.name && f.role, f.id);
    if (f.id !== 'driver') assert.ok(f.look && f.look.outfit && f.look.palette, `${f.id} has a look`);   // (the driver is the wagon's own)
    assert.notEqual(f.look && f.look.palette, 'outlaw', `${f.id} is not dressed as the gang`);
  }
});

test('the hello is two short lines: the problem, then what to do', () => {
  for (const f of [...JOB_FOLK, ...Object.entries(FOREMAN_HELLO).map(([id, hello]) => ({ id, hello }))]) {
    assert.equal(f.hello.length, 2, f.id);
    for (const l of f.hello) {
      assert.ok(l.length >= 20 && l.length <= 120, `${f.id}: "${l}" is short (${l.length})`);
      assert.ok(/[.!?]$/.test(l), `${f.id}: "${l}" ends a sentence`);
      assert.ok(!/\b(press|click)\b/i.test(l), `${f.id}: no keys named (the prompt shows them, and phones tap)`);
    }
  }
  // the problems the owner asked for
  assert.match(FOLK_BY_ID.boss.hello[0], /mixed in with the big herd/);
  assert.match(FOLK_BY_ID.vet.hello[0], /sickness/);
  assert.match(FOLK_BY_ID.wife.hello[0], /gate/);
  assert.match(FOLK_BY_ID.driver.hello[0], /gang/);
  assert.match(FOLK_BY_ID.naturalist.hello[0], /book/);
  assert.match(FOLK_BY_ID.naturalist.hello[1], /camera/);
});

test('thank-yous: each job event goes to its own person, who has a few to take turns with', () => {
  const pairs = { waveDone: 'boss', flockDone: 'vet', pigsDone: 'wife', banditsDone: 'driver', deerDone: 'naturalist', sheriffDone: 'sheriff' };
  for (const [ev, id] of Object.entries(pairs)) { assert.equal(thanksFor(ev), id); assert.ok(FOLK_BY_ID[id].thanks.length >= 2, id); }
  assert.equal(thanksFor('catch'), null);
  assert.ok(FOLK_BY_ID.driver.start, 'the driver says something as the wagon rolls');
});

test('walking away: the area jobs and the wagon have a toast, the sit-down ones none', () => {
  for (const id of ['boss', 'vet', 'wife', 'driver']) assert.match(FOLK_BY_ID[id].leave, /will wait for you$/, id);
  assert.equal(FOLK_BY_ID.driver.leave, 'The wagon will wait for you');
  for (const id of ['naturalist', 'sheriff']) assert.equal(FOLK_BY_ID[id].leave, undefined, id);
});

test('a line stays up longer the longer it is, and never less than about four seconds', () => {
  assert.ok(sayMs('Hi.') >= 4000);
  assert.ok(sayMs(FOLK_BY_ID.vet.hello.join(' ')) > sayMs(FOLK_BY_ID.vet.hello[0]));
});

test('the hello: said on coming up, not again while near, again only after being away long enough', () => {
  const G = makeGreeter({ again: 10 });
  assert.equal(G.update(0.1, false, true), false, 'far: nothing');
  assert.equal(G.update(0.1, true, false), true, 'came up: hello');
  for (let i = 0; i < 300; i++) assert.equal(G.update(0.1, true, false), false, 'standing there: once');
  assert.equal(G.update(0.1, false, true), false);
  assert.equal(G.update(0.1, true, false), true, 'away and back after the wait: hello again');
  G.update(1, false, true);
  assert.equal(G.update(0.1, true, false), false, 'back again too soon: not again');
  // in between (not near, not away): coming back near doesn't count as having left
  const H = makeGreeter({ again: 0 });
  H.update(0.1, true, false); H.update(5, false, false);
  assert.equal(H.update(0.1, true, false), false);
});

test('walking away is noticed once, after working at the job a few seconds, and not when passing by', () => {
  const W = makeLeaveWatch({ stay: 4, leave: 50 });
  for (let i = 0; i < 20; i++) W.update(0.1, true, 30);   // 2 s: passing through
  assert.equal(W.update(0.1, false, 55), false, 'passing by is not leaving');
  for (let i = 0; i < 60; i++) W.update(0.1, true, 30);   // 6 s at the job, working
  W.worked();
  assert.equal(W.update(0.1, false, 45), false, 'not far enough yet');
  assert.equal(W.update(0.1, false, 51), true, 'gone: the toast');
  assert.equal(W.update(0.1, false, 80), false, 'only once');
});

test('walking away: only the area job the player last worked says goodbye', () => {
  const sheep = makeLeaveWatch({ stay: 4, leave: 50 });
  for (let i = 0; i < 150; i++) sheep.update(0.1, true, 30);   // 15 s riding through the sheep's area, nothing done there
  let toast = false;
  for (let i = 0; i < 100; i++) toast = sheep.update(0.1, false, 50 + i) || toast;
  assert.equal(toast, false, 'riding through is not working there');
  for (let i = 0; i < 100; i++) sheep.update(0.1, true, 20);
  sheep.worked();   // doctored a sheep, then over to the pigs next door and worked there
  sheep.other();
  for (let i = 0; i < 150; i++) toast = sheep.update(0.1, true, 30) || toast;   // and out through the sheep's area
  for (let i = 0; i < 100; i++) toast = sheep.update(0.1, false, 50 + i) || toast;
  assert.equal(toast, false, 'no sheep goodbye after working the pigs');
  for (let i = 0; i < 100; i++) sheep.update(0.1, true, 20);
  sheep.worked();
  assert.equal(sheep.update(0.1, false, 60), true, 'the sheep job says goodbye after working there');
  assert.equal(WORK.sheepWrong, 'vet'); assert.equal(WORK.pigPenned, 'wife'); assert.equal(WORK.miss, 'boss');
});

test('a spot to stand: straight out first, else a little to either side, never where it is blocked', () => {
  const a = standSpot({ x: 0, z: 0, toward: { x: 0, z: 10 }, dist: 5 });
  assert.ok(Math.abs(a.x) < 1e-9 && Math.abs(a.z - 5) < 1e-9);
  const b = standSpot({ x: 0, z: 0, toward: { x: 0, z: 10 }, dist: 5, ok: (x) => x < -0.5 });
  assert.ok(b && b.x < -0.5 && Math.abs(Math.hypot(b.x, b.z) - 5) < 1e-9);
  assert.equal(standSpot({ x: 0, z: 0, dist: 5, ok: () => false }), null);
  assert.ok(TALK.prompt < TALK.greet && TALK.greet < TALK.tag && TALK.tag < TALK.awake && TALK.awake < TALK.show);
});
