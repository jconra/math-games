// The lock box's optional onSolved (src/lockbox/solved.js): another game's hook (Pi Nebula's pod locks chime there),
// called once a box at the moment its last answer is judged right; Mathwood itself passes none, and then nothing at all
// happens; a throw from it is logged and the box goes on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solvedHook } from '../src/lockbox/solved.js';

test('the lock box tells a solved box once, only to a game that asks, and a failing hook never stops the box', () => {
  // Mathwood's own boxes: no hook, nothing happens however often a box is solved
  const none = solvedHook({ rider: null });
  assert.doesNotThrow(() => { none(); none(); });
  assert.doesNotThrow(() => solvedHook(undefined)());
  // a game that asks (the pod lock): one call a box, however many places of the box say it is solved
  let calls = 0; const told = solvedHook({ onSolved: () => { calls++; } });
  told(); told(); told(); assert.equal(calls, 1);
  // the next box is told again (a hook a box)
  const next = solvedHook({ onSolved: () => { calls++; } }); next(); assert.equal(calls, 2);
  // a hook that throws: logged, and the box goes on
  const errors = [], keep = console.error; console.error = (...a) => errors.push(a.join(' '));
  try { const bad = solvedHook({ onSolved: () => { throw new Error('no sound'); } }); assert.doesNotThrow(() => { bad(); bad(); }); }
  finally { console.error = keep; }
  assert.equal(errors.length, 1);
});
