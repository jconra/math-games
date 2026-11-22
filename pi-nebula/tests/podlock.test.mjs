// THE STASIS POD'S LOCK (src/podlock.js): Mathwood's lock box, shared, in this game's look and words. The game's maker
// (2026-11-19): "opening the statis pods on medical missions can be equation solving, like lockboxes". No browser: the
// look handed to Mathwood's panel, the words it puts in place of the West's, Mathwood's own look left as it was, and the
// rule for when a pod is near enough and looked at to offer its lock (src/podreach-plan.js).
//   node --test pi-nebula/tests/podlock.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPACE_LOOK, spaceWords, WEST_WORDS, SPACE_THINGS } from '../src/podlock.js';
import { lookOf } from '../../mathwood-valley/src/lockbox/panel.js';
import { THINGS, kProblem, kHint } from '../../mathwood-valley/src/lockbox/kbox.js';
import { makeRng } from '../../mathwood-valley/src/lockbox/generate.js';
import { GO_WORD } from '../../mathwood-valley/src/lockbox/rules.js';
import { inReach, REACH } from '../src/podreach-plan.js';

test('Mathwood keeps its own look when none is handed in', () => {
  const L = lookOf(undefined);
  assert.equal(L.helper, 'Ask Hob');
  assert.equal(L.skip, 'Skip this box');
  assert.equal(L.finish, 'Finish');
  assert.equal(L.pay, true);
  assert.equal(L.where({ from: 'sheriff' }), 'Sheriff’s desk');
  assert.equal(L.title({}, 'iron'), 'Iron strongbox');
  assert.equal(L.say('That one goes back in the pile.'), 'That one goes back in the pile.');
  assert.equal(L.cls, '');
});

test('the pod: no gold, the game\'s own words on every button and line, a drawing for every thing', () => {
  const L = lookOf(SPACE_LOOK);
  assert.equal(L.pay, false);
  assert.equal(L.cls, 'lbx-space');
  for (const w of [L.helper, L.skip, L.finish, L.opened, L.title({}, 'iron'), L.where({}), L.title({ name: 'Stasis pod 3' }), L.say(GO_WORD.again)]) {
    assert.ok(!WEST_WORDS.test(w), `"${w}" has a word of the West's`);
  }
  assert.equal(L.title({ name: 'Stasis pod 3' }), 'Stasis pod 3');
  assert.equal(L.finish, 'Open the pod');
  for (const [t, drawn] of SPACE_THINGS) assert.ok(drawn, `${t} has a drawing`);
  for (const k of ['face', 'bag', 'nugget', 'sack', 'reward']) assert.match(L[k], /^<svg/, k);
});

test('every line of the box that speaks of the West says it in the game\'s words', () => {
  const lines = ['Box jammed. Let\'s back up.', 'That one goes back in the pile.', 'Dark coins are negative numbers.',
    'Negatives get their own box now.', GO_WORD.again];
  // the kindergarten box's help, for every thing it counts, at both helping levels (adding and taking away)
  const rng = makeRng(7), things = new Set();
  for (let k = 0; k < 400; k++) {
    const p = kProblem(['K1', 'K2', 'K3'][k % 3], { rng, frac: (k % 5) / 4 });
    lines.push(kHint(p, 1), kHint(p, 2), kHint(p, 3)); things.add(p.thing);
  }
  for (const l of lines) {
    const s = spaceWords(l);
    assert.ok(!WEST_WORDS.test(s), `"${l}" -> "${s}"`);
  }
  assert.equal(spaceWords('Box jammed. Let\'s back up.'), 'Lock jammed. Let\'s back up.');
  assert.equal(spaceWords('Count the horseshoes on each side.'), 'Count the bolts on each side.');
  assert.equal(spaceWords('Count the gold nuggets on each side.'), 'Count the ore crystals on each side.');
  // the plain math is left word for word
  for (const l of ['Get x alone. Same move on both sides.', 'x = 4. Check it in the beginning equation.', '3 plus what equals 7?', 'It\'s 4.']) assert.equal(spaceWords(l), l);
  // (every thing the kindergarten boxes count came up among them)
  for (const t of THINGS) assert.ok(things.has(t), t);
});

test('a pod is offered near enough and looked at, not behind or far off', () => {
  const eye = [0, 1.7, 0], fwd = [0, -0.3, -1];
  assert.equal(inReach(eye, fwd, [0, 0.5, -3]), true);                     // in front, 3 m
  assert.equal(inReach(eye, fwd, [0, 0.5, -(REACH.reach + 1)]), false);    // too far
  assert.equal(inReach(eye, fwd, [0, 0.5, 3]), false);                     // behind
  assert.equal(inReach(eye, fwd, [3, 0.5, -0.5]), false);                  // off to the side
  assert.equal(inReach(eye, fwd, [0.8, 0.6, -3]), true);                   // a little to the side
  assert.equal(inReach(eye, fwd, [0, 0.5, -8], { reach: 9 }), true);       // the Kit Lab's longer reach
});
