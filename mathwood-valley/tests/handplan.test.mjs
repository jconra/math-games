// The Hands Lab's file in plain numbers (src/handplan.js): each bone offers only its real joints; only known players,
// clips, bones and joints are kept, numbers in range, nothing that does nothing; the saved file reads back the same; a
// pose copies across; the resets; and the file in the game is a good one. How the poses LOOK is for eyes: labs/hands,
// ~/pw/bandit-math/rigs/hands/shots.cjs.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAYERS, ELBOW_MOST, BONE_GROUPS, jointsOf, boneWord, cleanHands, handsText, setJoint, getJoint, resetBones, resetPlayer, resetAll, copyPose, copyClip, handBones, armBones } from '../src/handplan.js';

const ids = (n) => jointsOf(n).map((j) => j.id);
test('each bone has only the joints it really has', () => {
  assert.deepEqual(ids('UpperArmL'), ['forward', 'raise', 'roll']);
  assert.deepEqual(ids('LowerArmR'), ['bend', 'twist']);
  assert.deepEqual(ids('WristL'), ['tip', 'side']);
  assert.deepEqual(ids('Index2L'), ['curl', 'spread']);
  assert.deepEqual(ids('Index3L'), ['curl']); assert.deepEqual(ids('Pinky4R'), ['curl']);
  assert.deepEqual(ids('Root'), []); assert.deepEqual(ids('PTL'), []);
  assert.equal(ELBOW_MOST, 150);
});
test('the list holds every bone of the rig, once, each named', () => {
  const all = BONE_GROUPS.flatMap((g) => g.bones);
  assert.equal(all.length, 62); assert.equal(new Set(all).size, 62);
  for (const n of all) assert.ok(boneWord(n) && !boneWord(n).includes('undefined'), n);
});
test('a file is cleaned: unknown things dropped, numbers in range, zeros gone, an old file not read', () => {
  const c = cleanHands({ v: 2, players: { nobody: { Play_Fiddle: { bones: { WristL: { tip: 1 } } } },
    fiddler: { Nope: { bones: { WristL: { tip: 1 } } }, Play_Fiddle: { bones: { WristL: { tip: 999, nod: 5, side: 0 }, Nope: { curl: 3 }, Index3L: { spread: 9 } }, props: { fiddle: { pos: [1, 'x', 500] }, nope: { pos: [1, 1, 1] }, bow: { bone: 'Nope', at: [1] } } } } } });
  assert.deepEqual(c, { v: 2, players: { fiddler: { Play_Fiddle: { bones: { WristL: { tip: 90 } }, props: { fiddle: { pos: [1, 0, 100] } } } } } });
  assert.deepEqual(cleanHands({ v: 1, players: { fiddler: { Play_Fiddle: { L: { off: [1, 1, 1] } } } } }).players, {});
});
test('the saved text reads back the same, a bone on each line', () => {
  const d = cleanHands({ v: 2, players: { banjo: { Play_Banjo: { bones: { Index2L: { curl: 30 }, LowerArmL: { twist: -40 } } } }, harpist: { Play_Harmonica: { props: { harmonica: { rot: [1, 2, 3] } } } } } });
  const text = handsText(d);
  assert.deepEqual(JSON.parse(text), d);
  assert.ok(text.split('\n').some((l) => l.trim().startsWith('"Index2L":')));
});
test('editing: a joint set and cleared, kept in its limits; left copies to right; resets take only what they say', () => {
  const d = cleanHands({}), cl = 'Play_Fiddle';
  assert.equal(setJoint(d, 'fiddler', cl, 'LowerArmL', 'twist', 500), 180);
  assert.equal(setJoint(d, 'fiddler', cl, 'Index4L', 'spread', 5), 0);   // (a knuckle has no spread)
  setJoint(d, 'fiddler', cl, 'Index2L', 'curl', 40); setJoint(d, 'fiddler', cl, 'Index3R', 'curl', 7);
  copyPose(d, 'fiddler', cl, 'L');
  assert.equal(getJoint(d, 'fiddler', cl, 'LowerArmR', 'twist'), 180); assert.equal(getJoint(d, 'fiddler', cl, 'Index2R', 'curl'), 40);
  assert.equal(getJoint(d, 'fiddler', cl, 'Index3R', 'curl'), 0);        // (the copy is the whole of the other side)
  resetBones(d, 'fiddler', cl, handBones('L'));
  assert.equal(getJoint(d, 'fiddler', cl, 'Index2L', 'curl'), 0); assert.equal(getJoint(d, 'fiddler', cl, 'LowerArmL', 'twist'), 180);
  resetBones(d, 'fiddler', cl, armBones('L')); assert.equal(getJoint(d, 'fiddler', cl, 'LowerArmL', 'twist'), 0);
  copyClip(d, 'fiddler', cl, 'Fiddle_Rest'); assert.equal(getJoint(d, 'fiddler', 'Fiddle_Rest', 'Index2R', 'curl'), 40);
  setJoint(d, 'banjo', 'Play_Banjo', 'WristR', 'tip', 3);
  resetPlayer(d, 'fiddler'); assert.ok(!d.players.fiddler && d.players.banjo);
  resetAll(d); assert.deepEqual(d.players, {});
});
test('the game\'s file: every player set, and clean as it stands', () => {
  const d = JSON.parse(readFileSync(new URL('../models/people/hands.json', import.meta.url)));
  assert.deepEqual(cleanHands(d), d);
  for (const who of Object.keys(PLAYERS)) assert.ok(d.players[who], who);
});
