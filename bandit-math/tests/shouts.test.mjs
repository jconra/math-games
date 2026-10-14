// The player's own shouts (src/audio/shouts.js): the deciding, without a browser. Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SHOUTS, VOICE_CLIPS, makeShoutBrain, pickShout } from '../src/audio/shouts.js';

const VOICE = new URL('../sounds/voice/', import.meta.url);
// dice that come up in order (then repeat)
const dice = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('every voice clip is in sounds/voice as .ogg and .m4a, every kind plays only known clips, nothing unplayed is shipped', () => {
  for (const name of Object.keys(VOICE_CLIPS)) for (const ext of ['.ogg', '.m4a']) assert.ok(fs.existsSync(new URL(name + ext, VOICE)), name + ext);
  const used = new Set();
  for (const [k, K] of Object.entries(SHOUTS.kinds)) for (const [n] of K.clips) { assert.ok(VOICE_CLIPS[n], k + ': ' + n); used.add(n); }
  for (const [n] of SHOUTS.morning.clips) { assert.ok(VOICE_CLIPS[n], n); used.add(n); }
  for (const n of Object.keys(VOICE_CLIPS)) assert.ok(used.has(n), n + ' is played somewhere');
  for (const f of fs.readdirSync(VOICE).filter((f) => /\.(ogg|m4a)$/.test(f))) assert.ok(VOICE_CLIPS[f.replace(/\.(ogg|m4a)$/, '')], f + ' is played');
  for (const k of Object.values(SHOUTS.events)) assert.ok(SHOUTS.kinds[k], k);
});

test('the voice files are small', () => {
  let bytes = 0;
  for (const f of fs.readdirSync(VOICE)) if (f.endsWith('.ogg')) bytes += fs.statSync(new URL(f, VOICE)).size;
  assert.ok(bytes < 800 * 1024, `the .ogg set is ${Math.round(bytes / 1024)} KB`);
});

test('pickShout never picks what it is told to avoid, unless nothing else is left', () => {
  const list = [['a', 1], ['b', 1]];
  for (let i = 0; i < 50; i++) assert.equal(pickShout(list, ['a'], Math.random), 'b');
  assert.equal(pickShout([['a', 1]], ['a']), 'a');
  assert.equal(pickShout([], []), null);
});

test('a spur: Shift and a direction from a walk or a stand (not from a trot, not on foot), with its chance and its wait', () => {
  const B = makeShoutBrain(dice(0)), ride = (t, o) => B.ride(t, { onHorse: true, ...o });
  ride(0, { speed: 1, push: true, run: false });
  ride(0.1, { speed: 1.2, push: true, run: true });
  assert.equal(B.pending && B.pending.kind, 'spur');
  const n = B.next(0.3); assert.ok(n && SHOUTS.kinds.spur.clips.some(([c]) => c === n.name), 'a spur clip');
  B.ended(0.8);
  // released and pressed again at once: inside its wait, nothing
  ride(1, { speed: 9, push: true, run: false }); ride(1.1, { speed: 3, push: false, run: false }); ride(1.2, { speed: 3, push: true, run: true });
  assert.ok(!B.pending || B.pending.kind !== 'spur', 'no spur inside the wait');
  // from a trot: no spur, ever
  const T = makeShoutBrain(dice(0)); T.ride(0, { onHorse: true, speed: 6, push: true, run: false }); T.ride(0.1, { onHorse: true, speed: 6, push: true, run: true });
  assert.equal(T.pending, null);
  // on foot: no spur
  const F = makeShoutBrain(dice(0)); F.ride(0, { onHorse: false, speed: 1, push: true, run: true }); assert.equal(F.pending, null);
  // the dice say no (60%): no spur
  const N = makeShoutBrain(dice(0.95)); N.ride(0, { onHorse: true, speed: 0, push: true, run: true }); assert.equal(N.pending, null);
});

test('a whoa: letting go of the keys at a gallop; not when just easing off to a trot or after slowing some other way', () => {
  const B = makeShoutBrain(dice(0)), ride = (t, o) => B.ride(t, { onHorse: true, ...o });
  ride(0, { speed: 12, push: true, run: true }); ride(0.1, { speed: 11.5, push: false, run: false });
  assert.equal(B.pending && B.pending.kind, 'whoa');
  for (let t = 0.2, v = 11; v > 0; t += 1 / 60, v -= 0.1) ride(t, { speed: v, push: false, run: false });   // (slowing down, still over a gallop's speed at first)
  assert.equal(B.moments.whoa, 1, 'one pull-up is one whoa moment');
  const C = makeShoutBrain(dice(0));
  C.ride(0, { onHorse: true, speed: 12, push: true, run: true }); C.ride(0.1, { onHorse: true, speed: 11, push: true, run: false });   // (Shift let go: a trot)
  assert.equal(C.pending, null);
  C.ride(2, { onHorse: true, speed: 4, push: true, run: false }); C.ride(2.1, { onHorse: true, speed: 3.5, push: false, run: false });
  assert.equal(C.pending, null, 'slowed to a trot first: no whoa');
});

test('one shout at a time, a gap between, never the same clip twice running, a bigger moment wins', () => {
  const B = makeShoutBrain(dice(0));
  assert.ok(B.ask('done', 0));
  assert.equal(B.next(0.1), null, 'waits for its delay');
  const a = B.next(0.6); assert.ok(a);
  B.ask('hello', 0.8);
  assert.equal(B.next(1.0, true), null, 'not over one that is playing');
  B.ended(1.2);
  assert.equal(B.next(3), null, 'a gap after one ends');
  const h = B.next(4.3); assert.ok(h && h.kind === 'hello');
  // never twice running: ask 'done' many times (its wait passed each time) and check neighbours
  const D = makeShoutBrain(Math.random); let last = null, t = 0;
  for (let i = 0; i < 40; i++) { t += 20; D.ask('done', t); const n = D.next(t + 1); assert.ok(n); assert.notEqual(n.name, last); last = n.name; D.ended(t + 2); }
  // the bigger moment: a waiting get-along is replaced by a job's end
  const E = makeShoutBrain(dice(0)); E.ask('along', 0); E.ask('done', 0.1); assert.equal(E.pending.kind, 'done');
  assert.ok(!E.ask('along', 0.2), 'and not the other way round');
});

test('a job done always gets its yeehaw (unless one just played); a waiting shout is dropped once too late', () => {
  const B = makeShoutBrain(Math.random);
  for (let i = 0; i < 20; i++) { const t = i * 30; assert.ok(B.ask('done', t)); const n = B.next(t + 1); assert.ok(/^(yeehaw|whoohee)_/.test(n.name)); B.ended(t + 2); }
  const L = makeShoutBrain(dice(0)); L.ask('spur', 0); assert.equal(L.next(5), null); assert.equal(L.pending, null);
});

test('the first hello of a ride is sometimes a good morning, the rest are howdies', () => {
  const B = makeShoutBrain(dice(0));   // (the dice always say yes: good morning on the first)
  B.ask('hello', 0); const a = B.next(1); assert.match(a.name, /^goodmorning_/);
  B.ended(2); B.ask('hello', 60); const b = B.next(61); assert.match(b.name, /^(howdy|howyado)/);
  const C = makeShoutBrain(dice(0, 0.9, 0)); C.ask('hello', 0); const c = C.next(1); assert.match(c.name, /^(howdy|howyado)/);
});
