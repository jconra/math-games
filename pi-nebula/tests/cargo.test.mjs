// THE SUPPLY RUN IN CARGO (2026-11-22, the game's maker, STA2-5: "you go to the computer, do the questions to calculate
// out how much of the supplies you need to pack. Maybe 5 questions. Then you go get in the forklift and load some
// pallets onto the containers. If someone is really bad at driving, Id say they can get off the forklift and the ship
// will automatically be loaded once they leave"), as the plain numbers say it:
//   the computer (src/jobs/cargo.js): every level's five questions, each from the last, come out at the run's own
//   number of pallets, two to a container; one right answer each, the slips kids make, the numbers whole;
//   the run (src/supplyrun.js): one call starts it; 3 or 4 pallets; the containers' doors open once it is worked out;
//   the forklift by hand (kit/forkliftdrive.js): in under a pallet lined up with it, up, down only where a pallet can
//   stand, and set down there exactly, in a container's doorway too; never into the racks, the walls, the containers,
//   the other pallets or anyone, whatever the keys do;
//   the containers (kit/places-plan.js LOAD, kit/containerdoors.js): two places side by side just inside the doors of
//   03 and 02; their doors latched back clear of the sides, never meeting as they swing.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../src/jobs/engine.js';
import { JOB, STEPS, CARDS, PER_BOX, chainAt, orderOf, MAKERS, seeded } from '../src/jobs/cargo.js';
import { cargoLink } from '../src/jobs/cargolink.js';
import { startRun, runOf, RUN, makeSupplyRun } from '../src/supplyrun.js';
import { makeDrive, worldOf, clearance, stillBlocks, BOX_PLACES, FLOOR_PLACES, HAND, boxGap, palletObb } from '../kit/forkliftdrive.js';
import { PARKED, TRUCK, FORKS, ON_FORKS, outline, palletFoot, poseFor, wallGap } from '../kit/forkliftround.js';
import { LOAD, SLOT, STORE, PALLET, CARGO, RACKS, doorHinge as hingeOf, doorTurn as turnOf } from '../kit/places-plan.js';

const crewOf = () => ({ id: 'c1', name: 'Test', look: { id: 'zuri' }, age: 9 });

test('the computer: every level\'s five questions come out at the run\'s pallets, two to a container', () => {
  E.register(JOB);
  for (let g = 1; g < STEPS.length; g++) assert.ok(STEPS[g].grade > STEPS[g - 1].grade, 'easiest first: ' + STEPS[g].id);
  for (let step = 1; step <= STEPS.length; step++) {
    for (const N of RUN.pallets) {
      for (let s = 0; s < 60; s++) {
        const C = chainAt(step, N, seeded(step * 7919 + N * 131 + s));
        assert.equal(C.cards.length, CARDS);
        assert.equal(C.cards[3].n, N, `step ${step}: the pallets`);
        assert.equal(C.cards[4].n, Math.ceil(N / PER_BOX), `step ${step}: the containers`);
        // (each card's answer is its own sum's: the food, the crates, the drums, the pallets from the crates and drums)
        if (C.food) {
          assert.equal(C.cards[0].n, C.food); assert.equal(C.cards[1].n, C.crates); assert.equal(C.cards[2].n, C.drums);
          assert.equal(Math.ceil((C.crates + C.drums) / C.k), N, `step ${step}: ${C.crates} + ${C.drums}, ${C.k} to a pallet`);
        }
        C.cards.forEach((c, k) => {
          const o = orderOf(c, step, k, seeded(s + k));
          assert.equal(o.coins.filter((x) => x.good).length, 1);
          assert.ok(o.coins.length >= 3, `step ${step} card ${k + 1}: ${o.coins.length} answers`);
          assert.equal(o.coins.find((x) => x.good).v, c.n);
          for (const x of o.coins) { assert.ok(Number.isInteger(x.v) && x.v > 0, `step ${step}: ${x.label}`); if (!x.good) assert.ok(x.why && x.why.length > 10, 'a wrong answer says why'); }
          assert.ok(!/NaN|undefined|Infinity|\[object/.test(`${o.story} ${o.ask} ${o.rightWhy}`), o.story);
          assert.ok(!/\b(Gus|Otto|Nell|Sami)\b/.test(o.story), 'Cargo\'s people are never named on a card');
          if (step <= 2) assert.ok(o.lead && o.lead.includes('<svg'), 'the youngest have the things to count on the card');
          assert.ok(o.help && (o.help.svg || o.lead), 'help has its picture');
        });
      }
    }
  }
});

test('the computer: its five questions are the run\'s, in turn; the fifth works the run out; opened again, its end card', () => {
  const crew = crewOf(), saved = [];
  const supply = makeSupplyRun({ crew: () => crew, save: () => saved.push(1), forklift: { stock: null } });
  const L = cargoLink({ crew, save: () => saved.push(1), supply });
  const run = runOf(crew);
  assert.ok(run && RUN.pallets.includes(run.pallets) && run.k === 0 && !run.worked, 'a run started by the one call');
  assert.equal(supply.open().length, 0, 'the doors shut until it is worked out');
  for (let k = 0; k < CARDS; k++) {
    assert.equal(L.over(), null);
    const q = E.deal(crew, JOB, { rand: seeded(k), live: L.now() });
    assert.equal(q.order.facts.k, k, 'the run\'s next question');
    // (the same question at the same level, each time it is dealt for this run)
    assert.equal(E.deal(crew, JOB, { rand: seeded(99), live: L.now() }).order.story, q.order.story);
    L.right(q);
  }
  assert.ok(run.worked, 'worked out');
  assert.deepEqual(supply.open(), run.slots, 'the containers\' doors open');
  assert.equal(run.slots.length, Math.ceil(run.pallets / LOAD.each));
  const end = L.over();
  assert.ok(end && /Pack \d pallets/.test(end.html) && /forklift/.test(end.html), 'the end card: what to load, and the forklift');
  // (opened again: the same run, its end card at once)
  const L2 = cargoLink({ crew, save: () => {}, supply });
  assert.ok(L2.over(), 'its end card at once');
  assert.equal(runOf(crew), run);
  // (one call starts a run; a run loaded is done, and the next one is a new run)
  run.done = true;
  const L3 = cargoLink({ crew, save: () => {}, supply });
  assert.notEqual(runOf(crew), run); assert.equal(L3.over(), null);
  assert.equal(crew.jobs.cargo.runs, 2);
  assert.ok(startRun(crewOf()).pallets >= 3);
});

// ── the forklift by hand ─────────────────────────────────────────────────────────────────────────────────────────
// (the room as at the start: the four pallets waiting, the containers' doors open)
const start = (open = LOAD.slots) => CARGO.pallets.map((p, i) => ({ i, place: p.at })).filter((p) => /^w/.test(p.place)).map((p) => { const q = FLOOR_PLACES.find((x) => x.id === p.place); return { i: p.i, at: q.at, y: q.y, h: q.h, place: q.id }; });
function harness(pallets, open = LOAD.slots, people = []) {
  const H = { pallets: pallets.slice(), open, people };
  H.W = () => worldOf({ open: H.open, pallets: H.pallets, people: H.people });
  H.apply = (ev) => {
    if (ev.took) H.pallets = H.pallets.filter((p) => p.i !== ev.took.i);
    if (ev.set) H.pallets.push({ i: ev.placed.i, at: ev.placed.q.at, y: ev.placed.q.y, h: ev.placed.h, place: ev.set, box: !!ev.placed.q.box });
  };
  H.run = (D, cmd, frames) => { let last = null; for (let f = 0; f < frames; f++) { const ev = D.step(cmd, 1 / 60, H.W()); H.apply(ev); last = ev; if (ev.took || ev.set) break; } return last; };
  return H;
}

test('the forklift by hand: in under a pallet lined up with it, up, over to a container, in through its doorway, down in its place', () => {
  const H = harness(start());
  const w1 = FLOOR_PLACES.find((q) => q.id === 'w1');
  // (a little off its line and turned: it lines itself up as it goes in)
  const D = makeDrive({ x: w1.at[0] + 0.15, z: w1.at[1] + ON_FORKS.x + 1.4, h: w1.h + 0.12 });
  for (let f = 0; f < 600 && D.s.under == null; f++) H.apply(D.step({ go: 0.6 }, 1 / 60, H.W()));
  for (let f = 0; f < 200 && D.s.v !== 0; f++) H.apply(D.step({ go: 0.6 }, 1 / 60, H.W()));
  assert.ok(D.s.under != null, 'in under it');
  assert.ok(Math.abs(D.s.x - w1.at[0]) < 0.01 && Math.abs(D.s.h - w1.h) < 0.01, 'lined up on it');
  assert.ok(D.s.lift < FORKS.rest, 'its forks brought down the last few millimetres');
  const ev = H.run(D, { forks: 1 }, 120);
  assert.ok(ev.took && D.s.carry === ev.took.i, 'up: on its forks');
  // carrying, the forks come no lower than carrying height away from a place a pallet can stand in
  for (let f = 0; f < 180; f++) H.apply(D.step({ go: -0.6 }, 1 / 60, H.W()));
  for (let f = 0; f < 120; f++) H.apply(D.step({ forks: -1 }, 1 / 60, H.W()));
  assert.ok(D.s.carry != null && D.s.lift >= FORKS.carry - 1e-9, 'not set down on the open floor');
  // stood 2.5 m short of container 03's south place, facing it, a hand off its line: in, stopped at the doorway, down
  const b1 = BOX_PLACES.find((q) => q.id === 'b1');
  Object.assign(D.s, { x: b1.at[0] + 2.5 + ON_FORKS.x, z: b1.at[1] + 0.12, h: Math.PI - 0.06, v: 0, curv: 0 });
  assert.ok(clearance(D.s, D.s, H.W()).gap > 0, 'clear where the test stood it');
  for (let f = 0; f < 600; f++) { H.apply(D.step({ go: 0.7 }, 1 / 60, H.W())); if (D.s.v === 0 && f > 30) break; }
  const p = D.palletOn();
  assert.ok(Math.hypot(p[0] - b1.at[0], p[1] - b1.at[1]) < HAND.reach, 'its pallet at the place: ' + p.map((v) => v.toFixed(2)));
  const ev2 = H.run(D, { forks: -1 }, 200);
  assert.equal(ev2.set, 'b1', 'set down in container 03\'s south place');
  const P = H.pallets.find((x) => x.place === 'b1');
  assert.deepEqual(P.at, b1.at, 'exactly in its place');
  assert.ok(palletFoot(D.s.lift, b1.y) <= b1.y + 1e-9, 'standing on the container\'s floor');
  for (let f = 0; f < 240; f++) H.apply(D.step({ go: -0.6 }, 1 / 60, H.W()));
  assert.equal(D.s.under, null, 'backed out from under it');
});

test('the forklift by hand never goes into the racks, the walls, the containers, the pallets or anyone, whatever the keys do', () => {
  const people = [[3, 20], [-1.5, 10.25], [0.5, 25]], touched = [];
  for (let run = 0; run < 14; run++) {
    const rand = seeded(500 + run), H = harness(start(), run % 3 === 2 ? [] : LOAD.slots, people);
    // (from its bay, and from out on the loading floor)
    const D = makeDrive(run % 2 ? { x: 1.5, z: 20.5, h: Math.PI / 2 } : PARKED);
    let cmd = { go: 0, turn: 0, forks: 0 }, worst = Infinity, what = null;
    for (let f = 0; f < 2400; f++) {
      if (f % 45 === 0) cmd = { go: rand() < 0.75 ? 1 : -1, turn: rand() * 2 - 1, forks: rand() < 0.15 ? (rand() < 0.5 ? 1 : -1) : 0 };
      const W = H.W(); H.apply(D.step(cmd, 1 / 60, W));
      const F = D.inFront(H.W()), c = clearance(D.s, D.s, H.W(), F ? F.q.i : null);
      if (c.gap < worst) { worst = c.gap; what = c.what; }
    }
    assert.ok(worst > -1e-6, `run ${run}: into ${what} by ${worst}`);
    touched.push(worst);
  }
  // (and the drives did come up against things: not a test that never met anything)
  assert.ok(touched.filter((g) => g < 0.03).length >= 7, 'most drives met something: ' + touched.map((g) => g.toFixed(2)).join(' '));
});

test('the forklift by hand: someone in its way stops it; a shut container and an open one\'s doorway stop its body', () => {
  // someone standing a metre in front of its forks
  const D = makeDrive({ x: 2, z: 21, h: Math.PI / 2 }), front = [2, 21 - TRUCK.tips - 0.9];
  const H = harness([], LOAD.slots, [front]);
  for (let f = 0; f < 240; f++) H.apply(D.step({ go: 1 }, 1 / 60, H.W()));
  assert.ok(outline(D.s, false).every((o) => boxGap(o, { c: front, f: [1, 0], r: [0, 1], hx: 0, hz: 0 }) >= HAND.people - 1e-6), 'stopped short of them');
  // container 03's doors shut: the whole container stops it
  assert.ok(stillBlocks([]).some((b) => b.what === 'container 03'));
  // open: its body never into the doorway (only its forks, its carriage and a pallet on them)
  const z = SLOT.z[2], D2 = makeDrive({ x: SLOT.end + 3.2, z, h: Math.PI }), H2 = harness([], LOAD.slots);
  for (let f = 0; f < 600; f++) H2.apply(D2.step({ go: 1 }, 1 / 60, H2.W()));
  const body = outline(D2.s)[0], nose = Math.min(...[-1, 1].flatMap((a) => [-1, 1].map((b) => body.c[0] + body.f[0] * body.hx * a + body.r[0] * body.hz * b)));
  assert.ok(nose >= SLOT.end + 0.02 - 1e-6, 'its body stops at the doorway: ' + nose.toFixed(3));
  assert.ok(Math.abs(D2.s.x - TRUCK.face - (SLOT.end + 0.02)) < 0.05, 'its carriage at the door frame, its forks in the doorway');
});

test('the containers: two places side by side just inside the doors of 03 and 02, clear of the frame; the doors latched back clear of the sides, never meeting', () => {
  assert.deepEqual(LOAD.slots, [2, 1]);
  assert.equal(BOX_PLACES.length, LOAD.slots.length * LOAD.each);
  // (every block the forklift is kept off has its numbers: a block with none stops nothing)
  for (const open of [[], LOAD.slots]) for (const b of stillBlocks(open)) assert.ok([...b.o.c, b.o.hx, b.o.hz].every(Number.isFinite) && b.o.hx > 0 && b.o.hz > 0, b.what);
  for (const q of BOX_PLACES) {
    const z = SLOT.z[q.slot], x1 = SLOT.end + 0.02;
    assert.ok(q.at[0] + PALLET.long / 2 < x1 - 0.01 && q.at[0] + PALLET.long / 2 > x1 - 0.2, `${q.id} just inside the doorway`);
    assert.ok(Math.abs(q.at[1] - z) + PALLET.wide / 2 < LOAD.door - 0.05, `${q.id} clear of the door frame's posts`);
    // the forklift setting it there: its body out of the container, its carriage just inside the door frame
    const p = poseFor(q.at, q.h), o = outline(p, true);
    for (const x of [...o]) { const W = worldOf({ open: LOAD.slots, pallets: [], people: [] }); assert.ok(W.blocks.every((b) => (b.body && x.what === 'pallet') || boxGap(x, b.o) > -1e-6), `${q.id}: ${x.what}`); }
  }
  // the leaves: opened, along the container's sides and clear of them (their bars too); the two between the
  // containers, swinging one after the other, never meet
  const hz = SLOT.box[0] / 2 + 0.045;
  for (const k of LOAD.slots) for (const side of ['north', 'south']) {
    const H = hingeOf(k, side), a = turnOf(H.s, 1), z = SLOT.z[k];
    // (its face at its hinge's side, turned all the way: the leaf runs back along the side)
    const along = [Math.sin(a) * (H.s < 0 ? 1 : -1), Math.cos(a) * (H.s < 0 ? 1 : -1)];
    assert.ok(Math.abs(along[1]) < 1e-9 && along[0] < 0, `${k} ${side}: back along the side`);
    assert.ok(Math.abs(H.z - z) > hz + 0.05, `${k} ${side}: its hinge out past the side`);
  }
  // (two leaves meeting: the north leaf of 03 and the south leaf of 02, each a segment from its hinge; swung with 02's
  // later by LOAD.hinge.after, sampled through the swing)
  const leaf = (k, side, t) => { const H = hingeOf(k, side), a = turnOf(H.s, t), d = [Math.sin(a) * -H.s, Math.cos(a) * -H.s]; return [[H.x + d[0] * 0.22, H.z + d[1] * 0.22], [H.x + d[0] * 1.36, H.z + d[1] * 1.36]]; };
  const near = (A, B) => { let best = Infinity; for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) { const p = [A[0][0] + (A[1][0] - A[0][0]) * i / 20, A[0][1] + (A[1][1] - A[0][1]) * i / 20], q = [B[0][0] + (B[1][0] - B[0][0]) * j / 20, B[0][1] + (B[1][1] - B[0][1]) * j / 20]; best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1])); } return best; };
  let least = Infinity;
  for (let s = 0; s <= LOAD.hinge.secs + LOAD.hinge.after; s += 0.05) least = Math.min(least, near(leaf(2, 'north', s / LOAD.hinge.secs), leaf(1, 'south', (s - LOAD.hinge.after) / LOAD.hinge.secs)));
  assert.ok(least > 0.2, 'the leaves between the containers never meet: ' + least.toFixed(2));
});

test('the shipping computer stands at the shipping desk in Cargo, in front of its right-hand screen', () => {
  const S = JSON.parse(readFileSync(new URL('../kit/rooms/station.json', import.meta.url), 'utf8'));
  const store = S.rooms.find((r) => r.id === 'store');
  assert.ok(store.pieces.some((p) => p.piece === 'shipDesk'), 'Cargo has the shipping desk');
  assert.deepEqual(JOB.spot.piece, 'shipDesk'); assert.equal(JOB.spot.room, 'store');
  assert.ok(Math.abs(JOB.spot.local[0] - 0.65) < 0.1 && JOB.spot.local[2] > 0.4 && JOB.spot.local[2] < 1, 'in front of its right-hand screen, beside the chair');
  assert.equal(JOB.link, 'cargo'); assert.equal(JOB.dark, true);
});
