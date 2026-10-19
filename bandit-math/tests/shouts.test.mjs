// The voices (src/audio/shouts.js): the deciding, without a browser. Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SHOUTS, VOICE_CLIPS, JINGLE, makeShoutBrain, pickShout, isMale } from '../src/audio/shouts.js';
import { JOB_FOLK } from '../src/jobfolkplan.js';
import { FOLK } from '../src/math/wordproblems.js';

const VOICE = new URL('../sounds/voice/', import.meta.url);
// dice that come up in order (then repeat)
const dice = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const kindsOf = (B) => B.queue.map((q) => q.kind);
const MAN = { male: true, at: { x: 0, z: 0 } }, WOMAN = { male: false, at: { x: 0, z: 0 } };

test('every voice clip is in sounds/voice as .ogg and .m4a; every clip but the ones kept for later is played; nothing else is shipped', () => {
  for (const name of Object.keys(VOICE_CLIPS)) for (const ext of ['.ogg', '.m4a']) assert.ok(fs.existsSync(new URL(name + ext, VOICE)), name + ext);
  const used = new Set();
  for (const [k, K] of Object.entries(SHOUTS.kinds)) for (const [n] of K.clips) { assert.ok(VOICE_CLIPS[n], k + ': ' + n); used.add(n); }
  for (const [n] of SHOUTS.morning.clips) { assert.ok(VOICE_CLIPS[n], n); used.add(n); }
  for (const n of Object.keys(VOICE_CLIPS)) assert.ok(used.has(n) !== SHOUTS.unused.includes(n), n + (used.has(n) ? ' is played' : ' is played somewhere, or listed as kept for later'));
  assert.deepEqual(SHOUTS.unused, []);   // (mystuff_1 is Loot the gang's now)
  assert.ok(SHOUTS.kinds.mystuff.him && SHOUTS.kinds.mystuff.clips[0][0] === 'mystuff_1');
  assert.ok(SHOUTS.jobEnds.includes('lootDone') && !SHOUTS.events.lootDone, "a job's end is the coins, not a voice");
  for (const f of fs.readdirSync(VOICE).filter((f) => /\.(ogg|m4a)$/.test(f))) assert.ok(VOICE_CLIPS[f.replace(/\.(ogg|m4a)$/, '')], f + ' is listed');
  for (const k of Object.values(SHOUTS.events)) assert.ok(SHOUTS.kinds[k], k);
});

test('the voice files are small', () => {
  let bytes = 0;
  for (const f of fs.readdirSync(VOICE)) if (f.endsWith('.ogg')) bytes += fs.statSync(new URL(f, VOICE)).size;
  assert.ok(bytes < 1200 * 1024, `the .ogg set is ${Math.round(bytes / 1024)} KB`);
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
  assert.deepEqual(kindsOf(B), ['spur']);
  const n = B.next(0.3); assert.ok(n && SHOUTS.kinds.spur.clips.some(([c]) => c === n.name), 'a spur clip');
  B.ended(0.8);
  ride(1, { speed: 9, push: true, run: false }); ride(1.1, { speed: 3, push: false, run: false }); ride(1.2, { speed: 3, push: true, run: true });
  assert.ok(!kindsOf(B).includes('spur'), 'no spur inside the wait');
  const T = makeShoutBrain(dice(0)); T.ride(0, { onHorse: true, speed: 6, push: true, run: false }); T.ride(0.1, { onHorse: true, speed: 6, push: true, run: true });
  assert.equal(T.queue.length, 0);
  const F = makeShoutBrain(dice(0)); F.ride(0, { onHorse: false, speed: 1, push: true, run: true }); assert.equal(F.queue.length, 0);
  const N = makeShoutBrain(dice(0.95)); N.ride(0, { onHorse: true, speed: 0, push: true, run: true }); assert.equal(N.queue.length, 0);
});

test('a whoa: letting go of the keys at a gallop; once per pull-up; not when easing off to a trot or slowing some other way', () => {
  const B = makeShoutBrain(dice(0)), ride = (t, o) => B.ride(t, { onHorse: true, ...o });
  ride(0, { speed: 12, push: true, run: true }); ride(0.1, { speed: 11.5, push: false, run: false });
  assert.deepEqual(kindsOf(B), ['whoa']);
  for (let t = 0.2, v = 11; v > 0; t += 1 / 60, v -= 0.1) ride(t, { speed: v, push: false, run: false });   // (slowing down, still over a gallop's speed at first)
  assert.equal(B.moments.whoa, 1, 'one pull-up is one whoa moment');
  const C = makeShoutBrain(dice(0));
  C.ride(0, { onHorse: true, speed: 12, push: true, run: true }); C.ride(0.1, { onHorse: true, speed: 11, push: true, run: false });
  assert.equal(C.queue.length, 0);
  C.ride(2, { onHorse: true, speed: 4, push: true, run: false }); C.ride(2.1, { onHorse: true, speed: 3.5, push: false, run: false });
  assert.equal(C.queue.length, 0, 'slowed to a trot first: no whoa');
});

test('one at a time, a gap between, never the same clip twice running; the bigger moment goes first and the other waits its turn', () => {
  const B = makeShoutBrain(dice(0));
  assert.ok(B.ask('yeehaw', 0));
  assert.equal(B.next(0.05), null, 'waits for its delay');
  assert.ok(B.next(0.6));
  B.ask('hello', 0.8);
  assert.equal(B.next(1.0, true), null, 'not over one that is playing');
  B.ended(1.2);
  assert.equal(B.next(3), null, 'a gap after one ends');
  const h = B.next(4.3); assert.ok(h && h.kind === 'hello');
  const D = makeShoutBrain(Math.random); let last = null, t = 0;
  for (let i = 0; i < 40; i++) { t += 80; D.ask('yeehaw', t, { sure: true }); const n = D.next(t + 1); assert.ok(n); assert.notEqual(n.name, last); last = n.name; D.ended(t + 2); }
  // two moments at once: the bigger first ("you better sit down"), then a man's "have a nice day" (it waits its turn)
  const E = makeShoutBrain(dice(0)); E.ask('niceday', 0, { who: MAN, sure: true }); E.ask('sitdown', 0.05, { sure: true });
  assert.deepEqual(kindsOf(E), ['sitdown', 'niceday']);
  const a = E.next(1.3); assert.equal(a.kind, 'sitdown'); E.ended(2);
  const b = E.next(5.1); assert.equal(b && b.kind, 'niceday'); assert.equal(b.who, MAN);
  assert.ok(!E.ask('spur', 6) || E.queue.length <= SHOUTS.most);
});

test("a job done is the coins, never a voice; a yeehaw only when a direction and Shift are held a second on a moving horse; a waiting clip is dropped once too late", () => {
  for (const e of SHOUTS.jobEnds) assert.ok(!SHOUTS.events[e], e + ' is no voice');
  for (const e of ['waveDone', 'flockDone', 'pigsDone', 'banditsDone', 'deerDone', 'deliveryDone', 'lootDone', 'storeDone']) assert.ok(SHOUTS.jobEnds.includes(e), e);
  assert.ok(JINGLE.coins >= 3 && JINGLE.ring < 0.3 && JINGLE.level <= 0.1, 'a short, quiet handful of coins');
  for (const [k, K] of Object.entries(SHOUTS.kinds)) if (k !== 'yeehaw') assert.ok(!K.clips.some(([n]) => /^(yeehaw|whoohee)_/.test(n)), k + ' has no yeehaw');
  const B = makeShoutBrain(dice(0)), ride = (t, o) => B.ride(t, { onHorse: true, ...o });
  ride(0, { speed: 0, push: true, run: true });
  for (let t = 0; t < 0.95; t += 0.05) ride(t, { speed: t * 4.5, push: true, run: true });
  assert.ok(!kindsOf(B).includes('yeehaw'), 'not before a second');
  ride(1.05, { speed: 4.7, push: true, run: true });
  assert.ok(kindsOf(B).includes('yeehaw'), 'held a second, going well');
  for (let t = 1.1; t < 4; t += 0.05) ride(t, { speed: 12, push: true, run: true });
  assert.equal(B.moments.yeehaw, 1, 'once a press');
  // held but going nowhere (against a fence), Shift without a direction, a trot without Shift, on foot: none
  const S = makeShoutBrain(dice(0)); for (let t = 0; t < 3; t += 0.05) S.ride(t, { onHorse: true, speed: 0.5, push: true, run: true });
  for (let t = 3; t < 6; t += 0.05) S.ride(t, { onHorse: true, speed: 6, push: true, run: false });
  for (let t = 6; t < 9; t += 0.05) S.ride(t, { onHorse: true, speed: 6, push: false, run: true });
  for (let t = 9; t < 12; t += 0.05) S.ride(t, { onHorse: false, speed: 4.6, push: true, run: true });
  assert.ok(!S.moments.yeehaw, 'no yeehaw');
  const L = makeShoutBrain(dice(0)); L.ask('spur', 0); assert.equal(L.next(5), null); assert.equal(L.queue.length, 0);
});

test('"easy now": by a moving horse on foot (walking up to it or standing by), or letting the reins go from a trot; never by a standing horse or far off', () => {
  const B = makeShoutBrain(dice(0));
  B.horses(0, { d: 5, closing: 1, speed: 1.6 }); assert.deepEqual(kindsOf(B), ['easy'], 'walking up to a moving horse');
  B.next(0.4); B.ended(1);
  B.horses(2, { d: 4, closing: 1, speed: 1.6 }); assert.equal(B.moments.easy, 1, 'once a meeting');
  const C = makeShoutBrain(dice(0));
  C.horses(0, { d: null, speed: 0 }); C.horses(1, { d: 9, closing: 2, speed: 0 }); C.horses(2, { d: 3, closing: -1, speed: 1.6 });
  assert.equal(C.queue.length, 0, 'no moving horse; one too far off; one moving away while the player walks off');
  C.horses(3, { d: 3, closing: -1, speed: 0.2 }); assert.deepEqual(kindsOf(C), ['easy'], 'standing by while it moves');
  const R = makeShoutBrain(dice(0)); R.horses(0, { onHorse: true, d: 2, closing: 2, speed: 0 }); assert.equal(R.queue.length, 0, 'not from the saddle');
  const T = makeShoutBrain(dice(0)); T.ride(0, { onHorse: true, speed: 6, push: true, run: false }); T.ride(0.1, { onHorse: true, speed: 5.8, push: false, run: false });
  assert.deepEqual(kindsOf(T), ['easy'], 'easing off from a trot');
  const G = makeShoutBrain(dice(0)); G.ride(0, { onHorse: true, speed: 12, push: true, run: true }); G.ride(0.1, { onHorse: true, speed: 11.5, push: false, run: false });
  assert.deepEqual(kindsOf(G), ['whoa'], 'from a gallop it is a whoa');
  for (const e of ['sheepDose', 'deerSetup']) assert.ok(!SHOUTS.events[e], e + ' is no "easy now"');
});

test('the first hello of a ride is sometimes a good morning, the rest are howdies', () => {
  const B = makeShoutBrain(dice(0));
  B.ask('hello', 0); const a = B.next(1); assert.match(a.name, /^goodmorning_/);
  B.ended(2); B.ask('hello', 60); const b = B.next(61); assert.match(b.name, /^(howdy|howyado)/);
  const C = makeShoutBrain(dice(0, 0.9, 0)); C.ask('hello', 0); const c = C.next(1); assert.match(c.name, /^(howdy|howyado)/);
});

test("other people's lines are the maker's voice: only a man says them, from where he is", () => {
  for (const k of ['gotme', 'huh', 'thanks', 'thanksStore', 'niceday', 'whatchagot']) {
    assert.ok(SHOUTS.kinds[k].him, k + ' is said by another person');
    const B = makeShoutBrain(dice(0));
    assert.equal(B.ask(k, 0, { who: WOMAN, sure: true }), false, k + ': never a woman');
    assert.equal(B.ask(k, 0, { who: null, sure: true }), false, k + ': never nobody');
    assert.equal(B.ask(k, 0, { who: MAN, sure: true }), true, k + ': a man');
  }
  // the player's own kinds need nobody
  for (const k of ['spur', 'whoa', 'yeehaw', 'hello', 'bye', 'along', 'easy', 'sitdown']) assert.ok(!SHOUTS.kinds[k].him, k);
  // who is a man: the folk looks
  assert.equal(isMale({ outfit: 'suit_m' }), true); assert.equal(isMale({ outfit: 'casual_f' }), false); assert.equal(isMale(null), false);
  const byId = Object.fromEntries(JOB_FOLK.map((f) => [f.id, f]));
  assert.equal(isMale(byId.wife.look), false, "the farmer's wife"); assert.equal(isMale(byId.naturalist.look), false, 'the naturalist');
  assert.equal(isMale(byId.boss.look), true); assert.equal(isMale(byId.sheriff.look), true);
  for (const f of FOLK) assert.equal(!f.she, isMale(f.look), f.name + ': "she" and the outfit agree');
});

test('a bandit roped right: the player says "you better sit down", then (a man) answers "you got me" close behind', () => {
  const B = makeShoutBrain(dice(0));
  B.ask('sitdown', 0, { then: { kind: 'gotme', who: MAN, sure: true } });
  const a = B.next(1.3); assert.equal(a.name, 'sitdown_1');
  B.ended(2.6);
  assert.deepEqual(kindsOf(B), ['gotme']);
  assert.equal(B.next(2.8), null, 'a breath first');
  const b = B.next(3.0); assert.equal(b && b.name, 'yougotme_1', 'the answer comes before the usual gap is over'); assert.equal(b.who, MAN);
  // the wrong rider: one of his three lines
  const C = makeShoutBrain(dice(0)); C.ask('huh', 0, { who: MAN }); assert.match(C.next(0.5).name, /^(tarnation|whatareyoudoin|whoareyou)_1$/);
});

test('thanks: nearly always at a job end, about half the time at the store with a wait, and the two share "not the same twice"', () => {
  assert.ok(SHOUTS.kinds.thanks.chance >= 0.85);
  assert.ok(SHOUTS.kinds.thanksStore.chance <= 0.55 && SHOUTS.kinds.thanksStore.cool[0] >= 20);
  assert.equal(SHOUTS.kinds.thanks.group, SHOUTS.kinds.thanksStore.group);
  assert.equal(SHOUTS.kinds.thanks.clips.length, 8);
  const B = makeShoutBrain(dice(0)); B.ask('thanks', 0, { who: MAN }); const a = B.next(0.3); B.ended(1);
  B.ask('thanksStore', 60, { who: MAN }); const b = B.next(60.3); assert.notEqual(a.name, b.name);
});
