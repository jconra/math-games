// Who is aboard a ship (src/aboardplan.js, the plain part of src/aboard.js): every seat and bed of a ship's rooms as a
// place to sit or lie, read from its own blueprint, for any ship that can be boarded; the cockpit's seats kept for their
// jobs; the way between two rooms through their doors.
//   node --test pi-nebula/tests/aboard.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { placesOf, wayOf, SIT, LIE } from '../src/aboardplan.js';
// (the ships that can be boarded, as src/boarding.js lists them: read from its text, it loads three.js)
const SHIPS = [...readFileSync(new URL('../src/boarding.js', import.meta.url), 'utf8').matchAll(/\{ id: '(\w+)', zone: '[\w-]+', lab: [\w.]+, (?:cockpit: [\w.]+, )?bp: '([\w-]+)'/g)].map((m) => ({ id: m[1], bp: m[2] }));

const bpOf = (id) => JSON.parse(readFileSync(new URL(`../kit/ships/${id}.blueprint.json`, import.meta.url), 'utf8'));
const inRect = (p, r) => p.x >= r[0] - 1e-6 && p.x <= r[2] + 1e-6 && p.z >= r[1] - 1e-6 && p.z <= r[3] + 1e-6;

test('the Miner\'s places: its two cockpit seats kept for the pilot and the drill, its mess benches, its bunks; a step is not a seat', () => {
  // "it would be great if the seats and beds on the ships could be used by the npcs or the player"
  const bp = bpOf('miner-ore-cockpit'), P = placesOf(bp, { deck: 1.82, cockpitFloor: 0.62 });
  const by = (id) => P.filter((p) => p.item === id);
  assert.equal(by('seat-l').length, 1); assert.equal(by('seat-l')[0].job, 'pilot');
  assert.equal(by('seat-r')[0].job, 'drill');
  assert.equal(by('step-r').length, 0, 'the step up to the flight deck is no seat');
  assert.ok(by('bench-a').length >= 1 && by('bench-b').length >= 1);
  assert.equal(P.filter((p) => p.kind === 'lie').length, 2, 'a bed in each bunk: its lower berth');
  // (the cockpit's seats stand on its flight deck; the rest on the cabin's deck)
  assert.equal(by('seat-l')[0].y, 2.44); assert.equal(by('bench-a')[0].y, 1.82);
  // (the cockpit's seats face the nose; the benches face the table between them)
  assert.equal(by('seat-l')[0].heading, 0);
  const tb = bp.items.find((it) => it.id === 'table'), tz = (tb.rect[1] + tb.rect[3]) / 2;
  for (const id of ['bench-a', 'bench-b']) { const p = by(id)[0]; assert.ok(Math.cos(p.heading) * Math.sign(tz - p.z) > 0.5, id + ' faces the table'); }
  for (const p of P) {
    const room = bp.rooms.find((r) => r.id === p.room);
    assert.ok(inRect(p, room.rect), p.id + ' in its room');
    assert.ok(inRect({ x: p.stand[0], z: p.stand[1] }, room.rect), p.id + ': where one stands to use it is in its room');
    assert.ok(Math.hypot(p.stand[0] - p.x, p.stand[1] - p.z) > 0.2, p.id + ': stood beside, not on');
  }
});

test('any ship that can be boarded has its places, from its own blueprint, nothing of the Miner\'s', () => {
  assert.deepEqual(SHIPS.map((S) => S.id), ['explorer', 'medic', 'miner']);
  for (const S of SHIPS) {
    const bp = bpOf(S.bp), P = placesOf(bp, { deck: 0 });
    const kinds = new Set(bp.items.map((it) => it.kind));
    const want = [...kinds].filter((k) => SIT.includes(k) || LIE.includes(k));
    assert.ok(P.length > 0 === want.length > 0, S.id);
    for (const p of P) { assert.ok(['sit', 'lie'].includes(p.kind)); assert.ok(Number.isFinite(p.heading) && Number.isFinite(p.x) && Number.isFinite(p.z)); }
    assert.equal(new Set(P.map((p) => p.id)).size, P.length, S.id + ': each place its own');
    // (the ship's own cockpit floor, from its own kit, as boarding lists it)
    assert.match(readFileSync(new URL('../src/boarding.js', import.meta.url), 'utf8'), new RegExp(`id: '${S.id}'[^\\n]*cockpit: \\w+\\.COCKPIT`), S.id);
    // (at most one pilot's seat)
    assert.ok(P.filter((p) => p.job === 'pilot').length <= 1, S.id);
  }
});

test('the way between two rooms runs through their doors, in turn; a room to itself is no way at all', () => {
  const bp = bpOf('miner-ore-cockpit');
  assert.deepEqual(wayOf(bp, 'cockpit', 'cockpit'), []);
  const w = wayOf(bp, 'cockpit', 'engineering');
  assert.deepEqual(w, [[0, 3], [0, 0.5], [0, -2], [0, -4]]);
  assert.deepEqual(wayOf(bp, 'engineering', 'mess'), [[0, -4], [0, -2], [0, 0.5]]);
  // (never out through the lift's hatch)
  assert.equal(wayOf(bp, 'cockpit', 'outside'), null);
});
