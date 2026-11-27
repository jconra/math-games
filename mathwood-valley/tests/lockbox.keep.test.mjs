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
import { PLACE } from '../src/levels/places.js';
import { startHere, recordLevel, levelHere } from '../src/levels/model.js';
import { stepLevel, levelTool } from '../src/ui/leveltool.js';

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
  const lines = src.split('\n');
  // every call of slideTo (its own definition aside): the next box after a finished one, and the two deals over
  const calls = lines.map((l, i) => ({ l, i })).filter(({ l }) => /\bslideTo\(/.test(l) && !/function slideTo\(/.test(l) && !/^\s*\/\//.test(l));
  assert.deepEqual(calls.map(({ l }) => l.match(/slideTo\(([^)]*)\)/)[1]).sort(), ['infoNow', 'infoNow', 'nx'],
    'a new way of sliding a box in must say here whether it may deal over a solved box');
  for (const { l, i } of calls.filter(({ l }) => /slideTo\(infoNow\)/.test(l))) {
    // (the question stands in the few lines of code before the deal; comment lines between them are let be)
    const before = lines.slice(Math.max(0, i - 12), i).filter((x) => !/^\s*\/\//.test(x)).join('\n');
    assert.match(before, /if \(!mayDealOver\(cur\.phase\(\), !!cur\.B\?\.solved\)\)/, `line ${i + 1}: ${l.trim()}`);
  }
});

// A LEVEL PICKED BY HAND WHILE A SOLVED BOX IS KEPT STANDS (panel.js handLevel, keepHandLevel). The kept box is
// recorded on the levels' ladder only when its button is pressed, after the hand's step, at the level it was made at.
test('a kept box recorded late, as a miss, would take back the level picked by hand; put back after, it stands', () => {
  const P = PLACE.lockbox;
  assert.ok(P && P.levels.length > 8, 'the lock boxes have a ladder');
  for (const i of [2, 5, P.levels.length - 3]) {
    const rider = {};
    assert.ok(startHere(rider, 'lockbox', P.levels[i].id));
    const boxLevel = P.levels[i].id;
    // the solved box is up; the hand steps the level up; the box is kept
    const stepped = stepLevel(rider, 'lockbox', +1);
    assert.ok(stepped, `level ${i + 1}: the arrow up`);
    assert.equal(stepped.id, P.levels[i + 1].id);
    assert.equal(levelHere(rider, 'lockbox'), stepped.id);
    // its button is pressed: solved, but not clean, so the ladder hears a miss at the level the box was made at
    recordLevel(rider, 'lockbox', { right: false, level: boxLevel, now: 1e12 });
    assert.equal(levelHere(rider, 'lockbox'), boxLevel, `level ${i + 1}: the late miss steps the rider back (why the panel puts the hand's level back)`);
    // what keepHandLevel does once that record is in
    assert.ok(startHere(rider, 'lockbox', stepped.id));
    assert.equal(levelHere(rider, 'lockbox'), stepped.id, `level ${i + 1}: the hand's level stands`);
    const v = levelTool(rider, 'lockbox');
    assert.equal(v.into, 0);
    assert.equal(v.placing, false);
  }
});

test('the panel puts the hand\'s level back once a kept box is recorded: after its button, and at "Done for now"', () => {
  const src = readFileSync(new URL('../src/lockbox/panel.js', import.meta.url), 'utf8');
  // (read from the source: the panel needs a page; the browser rig rigs/lockbox-kept plays it through)
  const fin = src.slice(src.indexOf('async function boxFinished('), src.indexOf('async function boxFinished(') + 400);
  assert.ok(fin.indexOf('keepHandLevel()') > 0 && fin.indexOf('keepHandLevel()') < fin.indexOf('payOut(result)'), 'before the box is paid and the next one made');
  const end = src.slice(src.indexOf('function end(why)'), src.indexOf('function end(why)') + 500);
  assert.match(end, /const kept = cur\.stop\(\); keepHandLevel\(\); if \(kept\) payOut\(kept\);/);
  // remembered only for a box whose record is still to come (not one being opened)
  assert.match(src, /if \(ph !== 'open' && ph !== 'done'\) handLevel = stepped\.id;/);
});

// the "Work it out" kind of box said it was solved only when its last line had been written, 0.4 to 0.65 s after the
// last right answer: in that moment it could still be dealt over (read from the source: its page needs a browser)
test('a "Work it out" box is solved from its last right answer, not from the end of that answer\'s flourish', () => {
  const src = readFileSync(new URL('../src/lockbox/workpanel.js', import.meta.url), 'utf8');
  // (the branch taken on a right answer to a part: from where the box goes to 'anim' to where a wrong one is counted)
  const at = src.indexOf("if (c.right) {\n        phase = 'anim';");
  assert.ok(at > 0, 'the right answer\'s branch');
  const branch = src.slice(at, src.indexOf('wrongs++;', at));
  const now = branch.indexOf('if (si + 1 >= steps.length) solvedNow();'), later = branch.indexOf('setTimeout(');
  assert.ok(now > 0 && later > 0 && now < later, 'said before the wait, not only after it');
});

// the picker in the top strip is drawn when a "Work it out" box is made, as it is for every other box: it was left
// as the box before had it (the wrong level's name over the box), and hidden when such a box opened a session
test('the level picker is drawn for a "Work it out" box too', () => {
  const src = readFileSync(new URL('../src/lockbox/panel.js', import.meta.url), 'utf8');
  const at = src.indexOf('if (WORK_RUNG[problem.rung]) {');
  assert.ok(at > 0);
  const branch = src.slice(at, src.indexOf('return mountWorkBox(', at));
  assert.match(branch.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n'), /\bshowLevel\(\);/, 'before the box\'s own page is made');
});
