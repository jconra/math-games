// The station's announcements (src/announce.js), their rules with no game: about one a minute and never like a clock,
// the chime first, half volume over a question card, a hangar's own line heard only in that hangar, nothing away from
// the station, the pages joined from their parts at the pauses, and every line that names something the game knows
// true to it (the news, the captains' offers, the scan). The game's maker (2026-11-19): "I was thinking the
// announcements would play about every minute... maybe just half volume" (while doing math); "the announcement might
// be targeted just to that hanger, not to the whole station". node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ANNOUNCE, PAGE, CLIPS, LINES, NAMES, PLACES, makeAnnouncer, timeline, heardIn, volumeAt, newsClip, wordsOf } from '../src/announce.js';
import { news } from '../src/news.js';

// a stand-in for the game's sound: every clip ready, the chime as long as its file, a voice clip 4 s
function fakeSound({ muted = false } = {}) {
  const S = { played: [], muted, load() {}, has: () => true, length: (n) => (n.endsWith(':chime') ? ANNOUNCE.chime : 4),
    play(name, o) { if (S.muted) return null; const h = { name, v: o.volume, delay: o.delay, group: o.group, volume(v) { h.v = v; } }; S.played.push(h); return h; } };
  return S;
}
const captains = (over = {}) => ({ vega: { state: 'new', room: 'terminal' }, ruiz: { state: 'new', room: 'hangar-miner' }, hale: { state: 'new', room: 'terminal' }, adair: { state: 'new', room: 'terminal' }, ...over });
const facts = (over = {}) => ({ playing: true, place: 'quarters', math: false, news: [], captains: captains(), scan: null, alarm: null, events: [], ...over });
// run the rules for `secs` of the game, a tenth of a second at a time; F(t) gives the facts at each moment
function run(A, secs, F) { for (let t = 0; t < secs; t += 0.1) A.update(0.1, typeof F === 'function' ? F(t) : F); }
const seeded = (s = 7) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

test('about one a minute, never like a clock: the first 25 to 40 s in, then 45 to 75 s from the end of one to the next', () => {
  const S = fakeSound(), A = makeAnnouncer({ sound: S, read: null, rand: seeded(3) });
  run(A, 40 * 60, facts());
  const L = A.log;
  assert.ok(L.length >= 30 && L.length <= 45, `${L.length} in forty minutes`);
  assert.ok(L[0].t >= 25 && L[0].t <= 40.2, 'the first at ' + L[0].t);
  const gaps = [];
  for (let i = 1; i < L.length; i++) {
    const end = L[i - 1].t + ANNOUNCE.chime + 4;    // (the chime, then a 4 s line; a page's parts end later)
    const g = L[i].t - end;
    if (L[i - 1].id !== 'page') { assert.ok(g >= ANNOUNCE.every[0] - 0.2 && g <= ANNOUNCE.every[1] + ANNOUNCE.retry + 0.3, `gap ${g.toFixed(1)} after ${L[i - 1].id}`); gaps.push(g); }
  }
  // (spread: not all the same)
  assert.ok(Math.max(...gaps) - Math.min(...gaps) > 15, 'the gaps vary: ' + Math.min(...gaps).toFixed(1) + ' to ' + Math.max(...gaps).toFixed(1));
  // the chime first, every time, and the voice as its file ends
  for (const h of S.played.filter((x, i, a) => i === 0 || a[i - 1].name !== x.name)) assert.equal(h.group, 'station');
  const starts = S.played.filter((h) => h.name === 'station:chime');
  assert.equal(starts.length, L.length, 'one chime for each announcement');
  for (const e of L) assert.equal(e.clips[0], 'chime');
  // never the same line (or a line of the same group) twice in ten minutes; a page not twice in four
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (L[i].id === L[j].id) {
    const line = LINES.find((x) => x.id === L[i].id), again = line.again ?? ANNOUNCE.again;
    assert.ok(L[j].t - L[i].t >= again, `${L[i].id} again after ${(L[j].t - L[i].t).toFixed(0)} s`);
  }
});

test('half volume while a question card is up, and it follows the card as it comes and goes', () => {
  const S = fakeSound(), A = makeAnnouncer({ sound: S, read: null, rand: seeded(5) });
  run(A, 45, facts({ math: true }));
  assert.equal(A.log.length, 1); assert.equal(A.log[0].volume, ANNOUNCE.volume * 0.5); assert.equal(A.log[0].volume, 0.275);
  for (const h of S.played) assert.equal(h.v, 0.275);
  // (a card put away while one plays: back to full; up again: half)
  run(A, 120, (t) => facts({ math: false }));
  const n = S.played.length; A.next(0); run(A, 1.5, facts({ math: false }));
  const mine = S.played.slice(n); assert.ok(mine.length >= 2);
  for (const h of mine) assert.equal(h.v, 0.55);
  run(A, 0.5, facts({ math: true }));
  for (const h of mine) assert.equal(h.v, 0.275);
  assert.equal(volumeAt('station', 'quarters', true), 0.275); assert.equal(volumeAt('station', 'quarters', false), 0.55);
});

test('a hangar\'s own line is heard in that hangar only; walking out, it goes quiet', () => {
  assert.equal(heardIn('hangar-miner', 'hangar-miner'), true); assert.equal(heardIn('hangar-miner', 'terminal'), false);
  assert.equal(heardIn('station', 'med-scanner'), true); assert.equal(heardIn('station', null), false);
  // a ship coming in while the player is in the terminal: not said there (and never later)
  let S = fakeSound(), A = makeAnnouncer({ sound: S, read: null, rand: seeded(1) });
  A.next(1e9); run(A, 0.2, facts({ place: 'terminal', events: ['shipIn'] })); run(A, 20, facts({ place: 'terminal' }));
  assert.equal(A.log.length, 0);
  // in the Miner hangar: said there, at the full volume
  S = fakeSound(); A = makeAnnouncer({ sound: S, read: null, rand: seeded(1) });
  A.next(1e9); run(A, 0.2, facts({ place: 'hangar-miner', events: ['shipIn'] })); run(A, 1, facts({ place: 'hangar-miner' }));
  assert.equal(A.log.length, 1); assert.equal(A.log[0].id, 'hangar-clear'); assert.equal(A.log[0].where, 'hangar-miner'); assert.equal(A.log[0].volume, 0.55);
  // out into the spine while it plays: quiet; back in: heard again
  run(A, 1, facts({ place: 'spine-n' })); for (const h of S.played) assert.equal(h.v, 0);
  run(A, 1, facts({ place: 'hangar-miner' })); for (const h of S.played) assert.equal(h.v, 0.55);
  // the alarm in the Medic hangar: its own security line, heard there
  S = fakeSound(); A = makeAnnouncer({ sound: S, read: null, rand: seeded(1) });
  A.next(1e9); run(A, 0.2, facts({ place: 'hangar-medic', alarm: 'hangar-medic', events: ['alarm'] })); run(A, 1, facts({ place: 'hangar-medic', alarm: 'hangar-medic' }));
  assert.deepEqual(A.log.map((e) => [e.id, e.clips[1], e.where]), [['security', 'security-medic', 'hangar-medic']]);
  // (the ears a moment late through the door: it waits for them, a little)
  S = fakeSound(); A = makeAnnouncer({ sound: S, read: null, rand: seeded(1) });
  A.next(1e9); run(A, 0.2, facts({ place: 'stub-explorer', alarm: 'hangar', events: ['alarm'] })); run(A, 2, facts({ place: 'stub-explorer', alarm: 'hangar' })); run(A, 1, facts({ place: 'hangar', alarm: 'hangar' }));
  assert.deepEqual(A.log.map((e) => [e.clips[1], e.where]), [['security-explorer', 'hangar']]);
});

test('nothing away from the station, and nothing before play', () => {
  const S = fakeSound(), A = makeAnnouncer({ sound: S, read: null, rand: seeded(2) });
  run(A, 15 * 60, facts({ place: null, events: [] }));
  assert.equal(A.log.length, 0); assert.equal(S.played.length, 0);
  run(A, 5 * 60, facts({ playing: false }));
  assert.equal(A.log.length, 0);
  // (back aboard: the next within the first minute)
  run(A, 41, facts());
  assert.equal(A.log.length, 1);
});

test('back to the crew screen while one plays: quiet; aboard again: heard again', () => {
  const S = fakeSound(), A = makeAnnouncer({ sound: S, read: null, rand: seeded(2) });
  A.next(0); run(A, 1, facts());
  assert.equal(A.log.length, 1);
  run(A, 0.5, facts({ playing: false })); for (const h of S.played) assert.equal(h.v, 0);
  run(A, 0.5, facts()); for (const h of S.played) assert.equal(h.v, 0.55);
});

test('muted: nothing is heard, and the minute goes on as ever (no rush of them when the sound comes back)', () => {
  const S = fakeSound({ muted: true }), A = makeAnnouncer({ sound: S, read: null, rand: seeded(4) });
  run(A, 5 * 60, facts());
  assert.ok(A.log.length >= 3 && A.log.every((e) => !e.heard));
  S.muted = false; const n = A.log.length; run(A, 30, facts());
  assert.ok(A.log.length - n <= 1);
});

test('the word bank: a page is its name and place joined at the pauses, as sample E; every clip there is', () => {
  const T = timeline({ page: ['ana', 'scanner'] });
  assert.deepEqual(T.map((x) => x.id), ['chime', 'name-ana', 'to-scanner-long', 'name-ana', 'to-scanner-short']);
  let at = ANNOUNCE.chime + PAGE.lead;
  ['name-ana', 'to-scanner-long', 'name-ana', 'to-scanner-short'].forEach((id, i) => { assert.ok(Math.abs(T[i + 1].at - at) < 0.002, id); at += CLIPS[id].len + (PAGE.gaps[i] || 0); });
  assert.equal(wordsOf({ page: ['ana', 'scanner'] }), 'Ana, please report to the scanner room. Ana, to the scanner room.');
  // the samples' own page, now joined: "Captain Vega, please report to the control room. Captain Vega, to the control room."
  assert.equal(wordsOf({ page: ['vega', 'control'] }), 'Captain Vega, please report to the control room. Captain Vega, to the control room.');
  // any name with any place: each has its parts, with their speech lengths, and a file
  const dir = new URL('../assets/sound/station/', import.meta.url);
  for (const n of [...new Set(Object.values(NAMES))]) { assert.ok(CLIPS['name-' + n] && CLIPS['name-' + n].len > 0.3, n); }
  for (const p of [...PLACES, 'scanner']) for (const k of ['long', 'short']) assert.ok(CLIPS[`to-${p}-${k}`] && CLIPS[`to-${p}-${k}`].len > 0.5, p + k);
  for (const id of Object.keys(CLIPS)) assert.ok(fs.existsSync(new URL(id + '.mp3', dir)), 'the file for ' + id);
  // (a random page never sends anyone to the scanner room: that page is for a real scan)
  const page = LINES.find((L) => L.id === 'page');
  for (let i = 0; i < 200; i++) assert.notEqual(page.say({}, Math.random).page[1], 'scanner');
});

test('true where the game knows: the news, with the very planet and metal it has, each said once', () => {
  // (every planet, haul and rescue the station's news can bring has its line)
  const seen = new Set();
  for (let i = 0; i < 600; i++) { news.update(400); for (const n of news.list) if (n.kind !== 'mathball' && n.kind !== 'player') { const c = newsClip(n); assert.ok(c, JSON.stringify(n)); seen.add(c); assert.ok(CLIPS[c].words.includes(n.kind === 'planet' ? n.planet : n.kind === 'haul' ? n.ore : 'Captain Hale')); } }
  assert.ok(seen.size >= 10, [...seen].join(' '));
  assert.equal(newsClip({ kind: 'mathball', winner: 'Ivo', loser: 'Tess', score: '7 to 5' }), null);
  assert.equal(newsClip({ kind: 'planet', planet: 'Nowhere' }), null);
  // said first, once
  const S = fakeSound(), A = makeAnnouncer({ sound: S, read: null, rand: seeded(9) });
  const N = [{ id: 'planet:3', kind: 'planet', planet: 'Vesper' }, { id: 'haul:2', kind: 'haul', ship: 'Miner', ore: 'cobalt', tons: 'twelve' }];
  run(A, 30 * 60, facts({ news: N, captains: {} }));
  const said = A.log.filter((e) => e.id === 'news').map((e) => e.clips[1]);
  assert.deepEqual(said, ['planet-vesper', 'haul-cobalt']);
  assert.equal(A.log[0].clips[1], 'planet-vesper');
});

test('true where the game knows: a captain looking for crew only while still asking, "see her in the terminal" only there', () => {
  const said = (C) => { const A = makeAnnouncer({ sound: fakeSound(), read: null, rand: seeded(11) }); run(A, 40 * 60, facts({ captains: C })); return new Set(A.log.map((e) => e.id)); };
  const only = (id, room) => ({ vega: { state: 'signed', room: 'terminal' }, ruiz: { state: 'signed', room: 'terminal' }, hale: { state: 'signed', room: 'terminal' }, [id]: { state: 'asked', room } });
  let s = said(captains());
  assert.ok(s.has('welcome'));
  for (const id of ['hale', 'vega', 'ruiz']) { s = said(only(id, 'terminal')); assert.ok(s.has('crew-' + id), id); for (const k of ['hale', 'vega', 'ruiz']) if (k !== id) assert.ok(!s.has('crew-' + k)); }
  s = said(only('ruiz', 'hangar-miner')); assert.ok(s.has('crew-ruiz'), 'his line names no place');
  s = said(captains({ hale: { state: 'new', room: 'hangar-medic' }, vega: { state: 'signed', room: 'terminal' }, ruiz: { state: 'interested', room: 'terminal' } }));
  assert.ok(!s.has('crew-hale') && !s.has('crew-vega') && !s.has('crew-ruiz'), [...s].join(' '));
  s = said(captains({ ruiz: { state: 'payout', room: 'terminal' } }));
  assert.ok(!s.has('crew-ruiz'));
  // (the welcome sends the player to a captain in the terminal: none there, none asking, no welcome)
  s = said({ vega: { state: 'signed', room: 'terminal' }, ruiz: { state: 'new', room: 'hangar-miner' }, hale: { state: 'new', room: 'med-ward' } });
  assert.ok(!s.has('welcome'));
  // (no Mathball high score is kept: never said)
  assert.ok(!said(captains()).has('highscore'));
});

test('true where the game knows: the medic paged to the scanner room as a scan begins, not once it is over', () => {
  let A = makeAnnouncer({ sound: fakeSound(), read: null, rand: seeded(1) });
  A.next(1e9); run(A, 0.2, facts({ scan: 'medic', events: ['scan'] })); run(A, 1, facts({ scan: 'medic' }));
  assert.equal(A.log.length, 1); assert.equal(A.log[0].words, 'Ana, please report to the scanner room. Ana, to the scanner room.');
  // the scan over before its turn came (another announcement playing): not said
  A = makeAnnouncer({ sound: fakeSound(), read: null, rand: seeded(1) });
  A.next(0); run(A, 0.3, facts()); assert.equal(A.log.length, 1);
  run(A, 0.2, facts({ scan: 'medic', events: ['scan'] })); run(A, 3, facts({ scan: 'medic' })); run(A, 20, facts({ scan: null }));
  assert.equal(A.log.filter((e) => e.id === 'scan').length, 0);
});
