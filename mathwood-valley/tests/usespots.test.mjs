// THE LOOK-TO-USE SPOTS (src/usespotsplan.js): inside a building, the one prompt goes to the spot most directly in
// front of the view, within reach; turning toward another moves it; the one shown keeps it against a near tie; a long
// thing (the counter, the hat pegs) is in front wherever along it the view is aimed. And the store's and the sheriff's
// spots as their recipes give them (labs/buildings/store.js, sheriff.js anchors.spots) are laid out so each can be
// faced on its own from the middle of the room.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { USE, offAngle, aimAt, spotScore, pickSpot, inFrame } from '../src/usespotsplan.js';

const at = { x: 0, z: 0 }, ahead = { x: 0, z: 1 };
const dir = (deg) => ({ x: Math.sin(deg * Math.PI / 180), z: Math.cos(deg * Math.PI / 180) });

test('the angle off the way the view looks', () => {
  assert.equal(Math.round(offAngle(at, ahead, { x: 0, z: 2 })), 0);
  assert.equal(Math.round(offAngle(at, ahead, { x: 2, z: 2 })), 45);
  assert.equal(Math.round(offAngle(at, ahead, { x: 0, z: -2 })), 180);
  assert.equal(offAngle(at, ahead, at), 0, 'standing on it: no way to it');
});

test('a stretch the view\'s line crosses is dead ahead where it crosses; else its nearer end', () => {
  const counter = { x0: -1, z0: 2, x1: 1, z1: 2 };
  const q = aimAt(at, ahead, counter);
  assert.equal(q.angle, 0); assert.equal(q.x, 0); assert.equal(q.z, 2); assert.equal(q.reach, 2);
  const side = aimAt(at, dir(60), counter);
  assert.ok(side.angle > 10 && side.x === 1, `the end nearer the view: ${JSON.stringify(side)}`);
  const behind = aimAt(at, { x: 0, z: -1 }, counter);
  assert.ok(behind.angle > 90, 'behind the player: far off the view');
});

test('only within reach, only within the cone', () => {
  assert.equal(spotScore(at, ahead, { x: 0, z: USE.reach + 0.1 }), Infinity, 'out of reach');
  assert.ok(spotScore(at, ahead, { x: 0, z: USE.reach - 0.1 }) < Infinity);
  assert.equal(spotScore(at, dir(USE.cone + 5), { x: 0, z: 1.5, r: 0 }), Infinity, 'outside the cone');
  assert.ok(spotScore(at, dir(USE.cone - 5), { x: 0, z: 1.5, r: 0 }) < Infinity);
  // (a spot's size: aimed anywhere at it is aimed at it)
  assert.equal(aimAt(at, dir(10), { x: 0, z: 2, r: 0.5 }).angle, 0, 'within its size: dead ahead');
  assert.ok(aimAt(at, dir(30), { x: 0, z: 2, r: 0.5 }).angle > 10, 'past its edge: off by the rest');
  assert.ok(spotScore(at, { x: 0, z: -1 }, { x: 0, z: 0.2 }) < Infinity, 'standing right at it: in front whatever the facing');
  assert.equal(spotScore(at, ahead, { x: 0, z: 3, reach: 3.5 }) < Infinity, true, 'a spot with its own reach');
});

test('the spot most in front gets the prompt; turning moves it; a near tie keeps the one shown', () => {
  const food = { id: 'food', x: -1.2, z: 1.2 }, hats = { id: 'hats', x: 1.2, z: 1.2 };
  assert.equal(pickSpot([food, hats], at, dir(-45)).id, 'food');
  assert.equal(pickSpot([food, hats], at, dir(45)).id, 'hats');
  assert.equal(pickSpot([food, hats], at, dir(180)), null, 'facing away: none');
  // (straight between the two: the one already shown stays, not flickering between them)
  assert.equal(pickSpot([food, hats], at, dir(2), { current: food }).id, 'food');
  assert.equal(pickSpot([food, hats], at, dir(-2), { current: hats }).id, 'hats');
  assert.equal(pickSpot([food, hats], at, dir(30), { current: food }).id, 'hats', 'turned well toward the other: it moves');
  // (two in a line: the nearer)
  assert.equal(pickSpot([{ id: 'far', x: 0, z: 2.2 }, { id: 'near', x: 0, z: 1 }], at, ahead).id, 'near');
});

test('a building\'s spots carried into the world by its frame', () => {
  const F = { y0: 10, place: (x, z) => [x + 100, z - 50] };
  const p = inFrame({ id: 'dog', at: [1, 0.8, 2], use: [1.5, 2.5], words: 'Buy animals' }, F);
  assert.deepEqual([p.x, p.z, p.at.x, p.at.y, p.at.z, p.reach], [101.5, -47.5, 101, 10.8, -48, USE.reach]);
  const s = inFrame({ id: 'counter', at: [3, 2, 0], use: [3, 0, 3, -2], reach: 2 }, F);
  assert.deepEqual([s.x0, s.z0, s.x1, s.z1, s.reach], [103, -50, 103, -52, 2]);
});

// the recipes' own spots, read from their source (the recipe files need three.js; their anchors are plain numbers in
// the store's own metres): from the middle of the store room each one can be faced and gets the prompt on its own
test('the store\'s spots: each one faced from the middle of its room gets the prompt', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../labs/buildings/store.js', import.meta.url), 'utf8');
  for (const id of ['food', 'hats', 'animals', 'gun', 'counter']) assert.ok(src.includes(`{ id: '${id}',`), `the store has a ${id} spot`);
  const src2 = fs.readFileSync(new URL('../labs/buildings/sheriff.js', import.meta.url), 'utf8');
  for (const id of ['boxes', 'own']) assert.ok(src2.includes(`{ id: '${id}',`), `the sheriff's office has a ${id} spot`);
  // (the store's, in its own frame as store.js has them: XL -1.6, INS 0.12, CX 3.3)
  const S = [
    { id: 'food', x0: -0.6, z0: 0.25, x1: -0.1, z1: 1.15 }, { id: 'hats', x0: -0.85, z0: -0.55, x1: -0.85, z1: -1.85 },
    { id: 'animals', x: 2.75, z: -1.92, r: 0.5 }, { id: 'gun', x: 3.22, z: 0.2, r: 0.15, reach: 2.4 }, { id: 'counter', x0: 3.22, z0: -0.05, x1: 3.22, z1: -1.5 },
  ];
  const mid = { x: 1.5, z: -0.5 };
  const face = (p) => { const s = S.find((q) => q.id === p); const x = s.x ?? (s.x0 + s.x1) / 2, z = s.z ?? (s.z0 + s.z1) / 2; return { x: x - mid.x, z: z - mid.z }; };
  for (const id of ['food', 'hats', 'animals', 'counter']) {
    const got = pickSpot(S, mid, face(id));
    assert.equal(got && got.id, id, `facing the ${id} from the middle of the store`);
  }
  // (the six-shooter by the till: faced from in front of the counter's near end)
  assert.equal(pickSpot(S, { x: 2.3, z: 0.4 }, { x: 1, z: -0.1 }).id, 'gun');
});

// THE ONE E (src/usespotsplan.js pickAction): of every E action in reach, the one nearest the spot right in front of the
// player (the least off the view's line); the game maker couldn't open the stable's door for "Talk to the stable keeper"
test('the one E: whatever is nearest the spot right in front of the player', async () => {
  const { pickAction, ACT } = await import('../src/usespotsplan.js');
  const at = { x: 0, z: 0 };
  // the stable's doorway straight ahead, its keeper a couple of metres to the right
  const door = { key: 'door', at: { x: 0, z: 1.5 } }, keeper = { key: 'folk', at: { x: 2.2, z: 1.0 } }, horse = { key: 'horse', at: { x: -2.5, z: -1 } };
  assert.equal(pickAction([door, keeper, horse], at, { x: 0, z: 1 }).key, 'door', 'facing the door: open it');
  assert.equal(pickAction([door, keeper, horse], at, { x: 1, z: 0.4 }).key, 'folk', 'facing the keeper: talk to him');
  assert.equal(pickAction([door, keeper, horse], at, { x: -1, z: -0.4 }).key, 'horse', 'facing the horse: get on');
  // a near tie keeps the one chosen; turned well toward the other, it moves
  const a = { key: 'a', at: { x: -0.5, z: 1.4 } }, b = { key: 'b', at: { x: 0.5, z: 1.4 } };
  assert.equal(pickAction([a, b], at, { x: 0.05, z: 1 }, { current: 'a' }).key, 'a');
  assert.equal(pickAction([a, b], at, { x: 0.6, z: 1 }, { current: 'a' }).key, 'b');
  // one with no place of its own (the deer camera set up where you stand) counts as ACT.blind m off
  assert.equal(pickAction([{ key: 'cam', at: null }, { key: 'aside', at: { x: 2.5, z: 2 } }], at, { x: 0, z: 1 }).key, 'cam');
  assert.equal(pickAction([{ key: 'cam', at: null }, { key: 'wren', at: { x: 0.2, z: 2.1 } }], at, { x: 0, z: 1 }).key, 'wren', 'faced: her, over the camera');
  // from right by the stable's doors, turned to the keeper a few metres along: him, though the doorway is nearer
  assert.equal(pickAction([{ key: 'door', at: { x: 1.1, z: 0 } }, { key: 'folk', at: { x: 0.2, z: 3.8 } }], at, { x: 0, z: 1 }).key, 'folk');
  // the doorway just behind, the horse ahead: the horse
  assert.equal(pickAction([{ key: 'door', at: { x: 0.3, z: -1 } }, { key: 'horse', at: { x: 0.5, z: 3.4 } }], at, { x: 0, z: 1 }).key, 'horse');
  assert.ok(ACT.blind > 0);
  assert.equal(pickAction([], at, { x: 0, z: 1 }), null);
});
