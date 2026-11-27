// A lock box that is won is never dealt over (src/lockbox/keep.js). Run with  node --test tests/lockbox.keep.test.mjs
// The level arrows in the box's top strip and the help menu's "Skip to a new question" deal a new box over the one
// that is up. A box already solved (its check playing, or its working up with "Next problem" under it) is paid only
// by its own button, so dealing over it lost the box unpaid: found 2026-11-27.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mayDealOver } from '../src/lockbox/keep.js';
import { generate, makeRng, RUNG } from '../src/lockbox/generate.js';
import { makeBox } from '../src/lockbox/box.js';

const PHASES = ['play', 'anim', 'parts', 'brackets', 'nlpick', 'review', 'open', 'done'];

test('a box still being worked may be swapped for a new one', () => {
  for (const ph of ['play', 'anim', 'parts', 'brackets', 'nlpick']) assert.equal(mayDealOver(ph, false), true, ph);
});

test('a solved box is kept in every phase: its check playing, its working up, its lid opening', () => {
  for (const ph of PHASES) assert.equal(mayDealOver(ph, true), false, ph);
});

test('a box in its review, being opened or finished is kept whatever it says of itself', () => {
  for (const ph of ['review', 'open', 'done']) {
    assert.equal(mayDealOver(ph, false), false, ph);
    assert.equal(mayDealOver(ph, undefined), false, `${ph}, no word from the box`);
  }
});

// the word the panel passes is the box's own B.solved: true from the solving move on, while the key check and the
// review are still to come and nothing is paid yet (the moment the old code threw the box away)
test('a real box says it is solved from its last right move, before it is checked, recorded or paid', () => {
  const rng = makeRng(5);
  for (const id of ['R1', 'R4', 'R7', 'R12']) {
    const p = generate(id, { rng, size: 2 });
    const B = makeBox(p, { stage: RUNG[id].stage, level: 4, rng, tier: 'iron' });
    assert.equal(mayDealOver('play', B.solved), true, `${id}: unsolved, it may be swapped`);
    let guard = 0;
    while (!B.solved && guard++ < 10) {
      const g = B.buttons.slots.find((b) => b && b.role === 'good');
      assert.ok(g, `${id}: a good button`);
      B.press(g.move);
      if (!B.solved) assert.equal(mayDealOver('play', B.solved), true, `${id}: part way, it may still be swapped`);
      B.makeButtons();
    }
    assert.equal(B.solved, true, id);
    // (the check is playing: the panel's phase is 'anim'; then its working is up: 'review')
    assert.equal(mayDealOver('anim', B.solved), false, `${id}: solved, its check playing`);
    assert.equal(mayDealOver('review', B.solved), false, `${id}: solved, its working up`);
  }
});

// the panel's two ways of dealing over the box that is up both ask first (read from the source: the panel needs a page)
test('the panel asks before each deal over the box that is up, and nowhere deals over it unasked', () => {
  const src = readFileSync(new URL('../src/lockbox/panel.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ mayDealOver \} from '\.\/keep\.js';/);
  const deals = [...src.matchAll(/slideTo\(infoNow\)/g)].map((m) => m.index);
  assert.equal(deals.length, 2, 'the level arrows and the redeal');
  for (const at of deals) {
    const before = src.slice(Math.max(0, at - 260), at);
    assert.match(before, /if \(!mayDealOver\(cur\.phase\(\), !!cur\.B\?\.solved\)\) (\{ showLevel\(\); return; \}|return false;)\s*$/,
      'the line before the deal is the question');
  }
});
