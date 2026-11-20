// YOUR OWN BEST MATHBALL ROUND (2026-11-20, the game's maker, of the station's line "A new Mathball high score has been
// set in the arena": "Keep only your own best round. This plays when you beat it."). Each crew member keeps their own
// best round (the most right balls in one round), saved with the rest of their progress and kept across a reload; the
// station says the line once a round is over that beat it, and only then; the very first round only sets it.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/jobs/engine.js';
import { keepBest } from '../src/mathball/best.js';
import { ANNOUNCE, LINES, makeAnnouncer, makeAnnounce, happened } from '../src/announce.js';
import { makeStore } from '../../shared/players.js';

// a stand-in for the game's sound: every clip ready, the chime as long as its file, a voice clip 4 s
function fakeSound() {
  const S = { played: [], load() {}, has: () => true, length: (n) => (n.endsWith(':chime') ? ANNOUNCE.chime : 4),
    play(name, o) { const h = { name, v: o.volume, delay: o.delay, group: o.group, volume(v) { h.v = v; } }; S.played.push(h); return h; } };
  return S;
}
const seeded = (s = 7) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
const facts = (over = {}) => ({ playing: true, place: 'arena', math: false, news: [], captains: {}, scan: null, alarm: null, events: [], ...over });
const run = (A, secs, F) => { for (let t = 0; t < secs; t += 0.1) A.update(0.1, typeof F === 'function' ? F(t) : F); };
// (a round played: its score kept as the game's endRound keeps it, in the arena's tally)
const round = (crew, score) => keepBest(E.jobTally(crew, 'arena'), score);

test('a best round: the first only sets it (nothing beaten), more beats it, the same or less does not', () => {
  const c = { id: 'a', name: 'Ana' };
  assert.deepEqual(round(c, 9), { best: 9, was: null, beaten: false }, 'the first round: a best, nothing beaten');
  assert.deepEqual(round(c, 9), { best: 9, was: 9, beaten: false }, 'the same again: not beaten');
  assert.deepEqual(round(c, 4), { best: 9, was: 9, beaten: false }, 'less: the best stays');
  assert.deepEqual(round(c, 10), { best: 10, was: 9, beaten: true }, 'one more: beaten');
  assert.equal(c.jobs.arena.best, 10);
  // (a first round of nothing is still a best: the next with one right ball beats it)
  const z = { id: 'z' };
  assert.equal(round(z, 0).beaten, false); assert.equal(round(z, 1).beaten, true);
  // (a save from before there was a best: its rounds are counted, but its next round is the first best)
  const old = { id: 'o', jobs: { arena: { n: 40, right: 31, rounds: 6, wins: 2, rate: 4.2 } } };
  assert.deepEqual(round(old, 3), { best: 3, was: null, beaten: false });
  // (a damaged number in a save is no best)
  for (const bad of [-1, NaN, 'x', null]) { const d = { id: 'd', jobs: { arena: { best: bad } } }; assert.equal(round(d, 2).beaten, false); assert.equal(d.jobs.arena.best, 2); }
});

test('each crew member keeps their own best, with their save, and a reload keeps it', () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  try {
    const store = makeStore({ key: 'test.best', game: 'Test' });
    const a = store.make('Ana', { id: 'zuri' }), b = store.make('Bo', { id: 'zuri' });
    for (const s of [6, 11, 8]) round(a, s);
    for (const s of [3, 2]) round(b, s);
    store.save(a); store.save(b);
    assert.equal(a.jobs.arena.best, 11); assert.equal(b.jobs.arena.best, 3, 'one crew member\'s rounds are not another\'s');
    // the page loaded again: the saves read back from the browser
    const back = Object.fromEntries(makeStore({ key: 'test.best', game: 'Test' }).load().map((p) => [p.name, p]));
    assert.equal(back.Ana.jobs.arena.best, 11); assert.equal(back.Bo.jobs.arena.best, 3);
    // (and the next round is held to the kept best: Bo's 3 beaten by 4, Ana's 11 not by 10)
    assert.equal(round(back.Bo, 4).beaten, true); assert.equal(round(back.Ana, 10).beaten, false);
  } finally { delete globalThis.localStorage; }
});

test('the station says the high score line once a round beat the best, and never otherwise', () => {
  const L = LINES.find((x) => x.id === 'highscore');
  assert.equal(L.event, 'best'); assert.ok(!L.held); assert.equal(L.where, 'station');
  // the round over, beaten: said once, chime first, in the arena (with Mathball's screen up: half volume)
  let S = fakeSound(), A = makeAnnouncer({ sound: S, read: null, rand: seeded(2) });
  A.next(1e9);
  A.update(0.1, facts({ math: true, events: ['best'] })); run(A, 12, facts({ math: true }));
  assert.equal(A.log.length, 1);
  assert.equal(A.log[0].id, 'highscore'); assert.deepEqual(A.log[0].clips, ['chime', 'highscore']);
  assert.equal(A.log[0].words, 'A new Mathball high score has been set in the arena. Congratulations.');
  assert.equal(A.log[0].volume, ANNOUNCE.volume * ANNOUNCE.math);
  // beaten again in the next round: said again (a round is two minutes; no ten minutes' rest for it)
  run(A, 120, facts({ math: true })); A.update(0.1, facts({ math: true, events: ['best'] })); run(A, 12, facts({ math: true }));
  assert.equal(A.log.filter((e) => e.id === 'highscore').length, 2);
  // forty minutes of announcements, rounds played and nothing beaten: never said
  S = fakeSound(); A = makeAnnouncer({ sound: S, read: null, rand: seeded(4) });
  run(A, 40 * 60, facts());
  assert.ok(A.log.length > 20); assert.ok(!A.log.some((e) => e.id === 'highscore'));
});

test('from a played round to the station\'s speakers: the first round sets a best in silence, the round that beats it is announced', () => {
  // (the game's own announcer, its facts read from a stand-in station: the ears in the arena, nothing else going on)
  const W = { alone: false, camera: { position: { x: 0, y: 1, z: 0 } }, zoneAt: () => ({ id: 'arena', box: { distanceToPoint: () => 0 } }) };
  const S = fakeSound(), A = makeAnnounce({ sound: S, W });
  A.next(1e9);
  const frames = (secs) => { for (let t = 0; t < secs; t += 0.1) A.update(0.1, true); };
  frames(1);
  const crew = { id: 'm', name: 'Maya' };
  // (as src/mathball/index.js endRound does: the round's score kept, and told to the station if it beat the best)
  const end = (score) => { const r = round(crew, score); if (r.beaten) happened('best'); return r; };
  end(7); frames(12);
  assert.ok(!A.log.some((e) => e.id === 'highscore'), 'the first round: nothing beaten, nothing said');
  end(5); frames(12);
  assert.ok(!A.log.some((e) => e.id === 'highscore'), 'a lower round: nothing said');
  end(9); frames(12);
  const said = A.log.filter((e) => e.id === 'highscore');
  assert.equal(said.length, 1); assert.equal(said[0].where, 'station'); assert.equal(said[0].place, 'arena');
  assert.ok(S.played.some((h) => h.name === 'station:highscore'), 'its clip is the one played');
  // the same score again: nothing more
  end(9); frames(12);
  assert.equal(A.log.filter((e) => e.id === 'highscore').length, 1);
});
