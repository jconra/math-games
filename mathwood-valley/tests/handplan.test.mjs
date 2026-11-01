// The Hands Lab's file in plain numbers (src/handplan.js): only known players, clips and hands; numbers in range; nothing
// kept that does nothing; the saved file reads back the same; and the file in the game is a good one. How the hands LOOK
// is for eyes: labs/hands, ~/pw/bandit-math/rigs/horsefish/hands_shots.cjs.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAYERS, ELBOW, cleanHand, cleanHands, handsText, isEmpty } from '../src/handplan.js';

test('a file is cleaned: unknown things dropped, numbers kept in range, an empty hand gone', () => {
  const c = cleanHands({ v: 9, players: { nobody: { Play_Fiddle: { L: { off: [1, 2, 3] } } },
    fiddler: { Nope: { L: { off: [1, 1, 1] } }, Play_Fiddle: { L: { off: [999, 'x', 2], rot: [0, 0, 500], elbow: 12, curl: { fingers: 300 } }, R: {} } } } });
  assert.equal(c.v, 1);
  assert.deepEqual(Object.keys(c.players), ['fiddler']);
  assert.deepEqual(Object.keys(c.players.fiddler), ['Play_Fiddle']);
  assert.deepEqual(Object.keys(c.players.fiddler.Play_Fiddle), ['L']);
  const h = c.players.fiddler.Play_Fiddle.L;
  assert.deepEqual(h.off, [30, 0, 2]); assert.equal(h.rot[2], 180); assert.equal(h.curl.fingers, 90); assert.equal(h.curl.thumb, 0);
  assert.ok(isEmpty(cleanHand(null)));
});
test('the saved text reads back the same, a hand on each line', () => {
  const d = cleanHands({ players: { banjo: { Play_Banjo: { L: { rot: [1, 2, 3] }, R: { off: [0, 1, 0] } } }, harpist: { Play_Harmonica: { R: { elbow: 40 } } } } });
  const text = handsText(d);
  assert.deepEqual(JSON.parse(text), d);
  assert.ok(text.split('\n').some((l) => l.trim().startsWith('"L":')));
});
test('the game\'s file: every player set, and clean as it stands', () => {
  const d = JSON.parse(readFileSync(new URL('../models/people/hands.json', import.meta.url)));
  assert.deepEqual(cleanHands(d), d);
  for (const who of Object.keys(PLAYERS)) assert.ok(d.players[who], who);
  assert.ok(ELBOW.warn < ELBOW.worst);
});
