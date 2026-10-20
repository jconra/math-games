// The Howdy bubbles (src/ui/howdy.js): a short hello for the time of day, said when the player comes close, and again
// only after they have been away a while.
// Run with:  node --test bandit-math/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { HOWDY, HELLOS, pickHello, makeHowdyWatch, howdy } from '../src/ui/howdy.js';

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('every hello is short and friendly', () => {
  for (const [k, list] of Object.entries(HELLOS)) {
    assert.ok(list.length >= 2, k);
    for (const l of list) {
      assert.ok(l.length >= 5 && l.length <= 26, `${k}: "${l}" is short`);
      assert.ok(/[.!?]$/.test(l), `${k}: "${l}" ends a sentence`);
    }
  }
});

test('the hello fits the time of day', () => {
  // (rand 0.1: the morning or evening one is taken; 0.9: the plain one)
  assert.ok(HELLOS.morning.includes(pickHello({ hour: 7, rand: seq(0.1, 0.1) })));
  assert.ok(HELLOS.any.includes(pickHello({ hour: 7, rand: seq(0.9, 0.1) })));
  assert.ok(HELLOS.evening.includes(pickHello({ hour: 20, rand: seq(0.1, 0.1) })));
  assert.ok(HELLOS.any.includes(pickHello({ hour: 13, rand: seq(0.1, 0.1) })), 'midday: the plain hellos');
  assert.ok(HELLOS.night.includes(pickHello({ hour: 23, night: 0.9, rand: seq(0.9, 0.1) })), 'a dark night: the night ones');
  assert.ok(HELLOS.any.includes(pickHello({ rand: seq(0.5, 0.3) })), 'no clock: the plain ones');
  assert.ok(HELLOS.riding.includes(pickHello({ riding: true, rand: seq(HOWDY.horse / 2, 0) })), 'now and then the horse');
  assert.ok(!HELLOS.riding.includes(pickHello({ riding: false, rand: seq(0, 0) })), 'never the horse on foot');
});

test('said once on coming close, and again only after being away a while', () => {
  const G = makeHowdyWatch({ near: 5, away: 14, again: 60 });
  assert.equal(G.update(0.1, 30), false, 'far off: nothing');
  assert.equal(G.update(0.1, 4), true, 'close: hello');
  let again = 0; for (let i = 0; i < 100; i++) if (G.update(0.1, 3)) again++;
  assert.equal(again, 0, 'standing close: not again');
  for (let i = 0; i < 10; i++) G.update(0.1, 10);
  assert.equal(G.update(0.1, 4), false, 'a step back and in again (never past away): no');
  for (let i = 0; i < 10; i++) G.update(0.1, 20);
  assert.equal(G.update(0.1, 4), false, 'away, but too soon: no');
  for (let i = 0; i < 700; i++) G.update(0.1, 20);
  assert.equal(G.update(0.1, 4), true, 'away a minute and back: hello again');
});

test('with no camera yet (or in node) a howdy does nothing and never throws', () => {
  assert.equal(howdy({ at: () => ({ x: 0, y: 2, z: 0 }) }, 'Howdy!'), null);
});
