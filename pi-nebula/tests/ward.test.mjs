// THE RESCUED IN THE WARD (src/wardplan.js; people.js THE WARD) and THE STATION'S NEWS OF A RESCUE (announce.js's text
// line, lines.js's talk). The game's maker (MED-6): "If you are just standing there watching them it would be nice if
// they could walk in there and lay down. But if you run off then its fine if they teleport to the bed."
// node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WARD, WARD_BED, bedFor, bedNumber, bedSide, assign, stayFor, watching, numberWord, fromWords, outcome, kept } from '../src/wardplan.js';
import { ANNOUNCE, LINES, makeAnnouncer, readSecs, TEXT } from '../src/announce.js';
import { TALKS } from '../src/lines.js';
import { pose, SECS } from '../src/onbed.js';

const station = JSON.parse(fs.readFileSync(new URL('../kit/rooms/station.json', import.meta.url), 'utf8'));
const wardBeds = station.rooms.find((r) => r.id === 'med-ward').pieces.filter((p) => p.piece === 'cabinMedBed');

test('the ward\'s three beds: each with its long rail folded down on one side, got onto from that side', () => {
  assert.deepEqual(wardBeds.map((p) => bedNumber(p.variant)), [1, 2, 3]);
  for (const p of wardBeds) assert.notEqual(bedSide(p.variant), 0, p.variant + ': both rails up, nobody could get onto it');
  assert.equal(bedSide('ward 1, right rail down'), 1); assert.equal(bedSide('ward 2, left rail down'), -1); assert.equal(bedSide('ward 3'), 0);
  assert.equal(bedNumber('raised'), null);
  // (the ward bed's own variants are still the kit's: kit/shipparts/cabin/fit.cat.js PRESETS)
  const cat = fs.readFileSync(new URL('../kit/shipparts/cabin/fit.cat.js', import.meta.url), 'utf8');
  assert.match(cat, /right rail down/); assert.match(cat, /left rail down/);
});

test('the free beds go to the first to come down the ramp, lowest number first; the rest go home', () => {
  const beds = [{ n: 1, side: 1 }, { n: 2, side: 1 }, { n: 3, side: 1 }];
  assert.deepEqual(assign(3, beds), [0, 1, 2]);
  assert.deepEqual(assign(6, beds), [0, 1, 2, -1, -1, -1]);
  assert.deepEqual(assign(4, beds, new Set([1])), [0, 2, -1, -1]);
  assert.deepEqual(assign(2, beds, new Set([0, 1, 2])), [-1, -1]);
  // (a bed nobody can get onto is never given)
  assert.deepEqual(assign(3, [{ n: 1, side: 0 }, { n: 2, side: -1 }, { n: 3, side: 1 }]), [1, 2, -1]);
  assert.deepEqual(assign(0, beds), []);
});

test('watched along the way, or in bed at once: the Medic\'s hangar, the Medic, the medical centre and its rooms, the ward', () => {
  for (const r of ['hangar-medic', 'ship-medic', 'medical', 'med-ward', 'med-scanner']) assert.ok(watching(r), r);
  for (const r of ['terminal', 'hangar', 'hangar-miner', 'spine-s', 'quarters', null, undefined]) assert.ok(!watching(r), String(r));
  // (every room named is the station's)
  const ids = new Set(station.rooms.map((r) => r.id));
  for (const r of WARD.rooms) assert.ok(ids.has(r), r);
});

test('they stay 8 to 12 minutes each; kept over a reload while in bed, one to a bed, at most three', () => {
  assert.equal(stayFor(() => 0), 480); assert.equal(stayFor(() => 1), 720);
  for (let i = 0; i < 50; i++) { const s = stayFor(); assert.ok(s >= 480 && s <= 720); }
  const now = 1e12;
  const list = [{ look: 'zuri', position: 'pilot', bed: 0, until: now + 5e3 }, { look: 'sol', bed: 1, until: now - 1 }, { look: 'noor', bed: 0, until: now + 9e3 },
    { look: 'mira', bed: 2, until: now + 1 }, { look: 7, bed: 1, until: now + 1e4 }, { look: 'kai', bed: -1, until: now + 1e4 }, { look: 'ana', bed: 1, until: now + 1e4 }, null];
  const k = kept(list, now);
  assert.deepEqual(k.map((r) => [r.look, r.bed]), [['zuri', 0], ['mira', 2], ['ana', 1]]);
  assert.equal(k[0].position, 'pilot'); assert.equal(k[1].position, null);
  assert.deepEqual(kept(undefined, now), []); assert.deepEqual(kept('x', now), []);
});

test('lying on a ward bed: the head on the pillow, the toes short of the foot board, whatever their legs\' length', () => {
  for (const [a, b, hs] of [[0.38, 0.38, 0.82], [0.43, 0.43, 0.93], [0.47, 0.47, 1.0]]) {
    const who = { a, b, w: 0.09, hs }, bed = bedFor(who);
    assert.ok(bed.z >= WARD_BED.least && bed.z <= WARD_BED.most);
    assert.equal(bed.stand[1], bed.z); assert.equal(bed.top, 0.68);
    const p = pose('lying', 0, bed, who);
    // (the hips over the mattress, the feet's roots along it, the toes past them still on the mattress)
    assert.ok(Math.abs(p.hips[2] - bed.z) < 1e-9);
    for (const f of p.feet) assert.ok(f[2] + WARD_BED.toes <= WARD_BED.feet + 0.005, 'toes at ' + (f[2] + WARD_BED.toes).toFixed(3));
    // (the head toward the pillow: about 0.75 m of a person's middle-height body from the hips toward the head end)
    const head = bed.z - 0.8 * (hs / 0.93);
    assert.ok(head > 0.15 && head < WARD_BED.rest[1], 'the head at ' + head.toFixed(2));
    // (getting on: standing at its side, past the folded rail's face (0.53), the hips then over the mattress)
    const st = pose('back', 0, bed, who); assert.ok(st.hips[0] >= 0.7);
    const sat = pose('hop', SECS.hop, bed, who); assert.ok(sat.done && sat.hips[0] < WARD_BED.pad && sat.hips[1] > bed.top);
  }
  // (where they walk to, and past the foot first: beside the bed, clear of it)
  assert.ok(WARD_BED.walkTo[0] > WARD_BED.stand[0] && WARD_BED.via[1] > 2.25);
});

test('the words: the station\'s line for how the rescue went, as the recorded news says things', () => {
  assert.equal(numberWord(5), 'five'); assert.equal(numberWord(12), '12');
  assert.equal(fromWords('moon'), 'a crashed ship on a cratered moon');
  assert.equal(fromWords('Canyon world'), 'a crashed ship in a canyon world');
  assert.equal(fromWords('meadow'), 'a crashed ship on a meadow world');
  assert.equal(outcome({ people: 5, from: fromWords('canyon'), resting: 3 }), 'News from the Medic. Five people have been brought home from a crashed ship in a canyon world. Three of them are resting in the ward.');
  assert.equal(outcome({ people: 3, from: fromWords('moon'), resting: 3 }), 'News from the Medic. Three people have been brought home from a crashed ship on a cratered moon. They are resting in the ward.');
  assert.equal(outcome({ people: 4, from: fromWords('moon'), resting: 1 }), 'News from the Medic. Four people have been brought home from a crashed ship on a cratered moon. One of them is resting in the ward.');
  assert.equal(outcome({ people: 6, from: fromWords('meadow'), resting: 0 }), 'News from the Medic. Six people have been brought home from a crashed ship on a meadow world.');
  // (the people's talk of it: every blank one the news of a rescue run fills)
  const T = TALKS.find((t) => t.id === 'rescue-3'); assert.ok(T && T.news === 'rescue');
  const facts = { ship: 'Medic', captain: 'Captain Hale', crew: 'five stranded crew', people: 'five people', from: fromWords('moon') };
  for (const l of T.lines) for (const m of l.matchAll(/\{(\w+)\}/g)) assert.ok(m[1] in facts, m[1]);
});

// (the game's sound, stood in for: every clip ready, the chime as long as its file, a voice 4 s)
function fakeSound() {
  const S = { played: [], load() {}, has: () => true, length: (n) => (n.endsWith(':chime') ? ANNOUNCE.chime : 4),
    play(name, o) { const h = { name, v: o.volume, volume(v) { h.v = v; } }; S.played.push(h); return h; } };
  return S;
}
const captains = { vega: { state: 'signed', room: 'terminal' }, ruiz: { state: 'signed', room: 'hangar-miner' }, hale: { state: 'payout', room: 'terminal' }, adair: { state: 'signed', room: 'terminal' } };
const seeded = (s = 7) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

test('the rescue on the speakers: the recorded line first, then a text line of how it went (the chime, its words shown, no voice)', () => {
  const S = fakeSound(), shown = [];
  const A = makeAnnouncer({ sound: S, read: null, rand: seeded(11), onText: (w) => shown.push(w) });
  const item = { id: 'rescue:9', kind: 'rescue', ship: 'Medic', captain: 'Captain Hale', crew: 'five stranded crew', people: 'five people', from: fromWords('canyon'), count: 5, resting: 3 };
  const facts = (over = {}) => ({ playing: true, place: 'medical', math: false, news: [item], captains, scan: null, alarm: null, events: [], ...over });
  const log = [];
  for (let t = 0; t < 400; t += 0.1) { A.update(0.1, facts()); if (A.state().shown && !log.length) log.push(t); }
  const L = A.log.map((x) => x.id);
  assert.equal(L[0], 'news', 'the recorded line first: ' + L.join());
  assert.deepEqual(A.log[0].clips, ['chime', 'rescue']);
  const k = L.indexOf('rescued'); assert.ok(k > 0, 'then how it went: ' + L.join());
  const R = A.log[k];
  assert.deepEqual(R.clips, ['chime'], 'no voice: only the chime'); assert.ok(R.text);
  assert.equal(R.words, outcome({ people: 5, from: fromWords('canyon'), resting: 3 }));
  // (its words shown from the chime's end for as long as they take to read, then put away; said once)
  assert.deepEqual(shown, [R.words, null]);
  assert.ok(log[0] - R.t >= ANNOUNCE.chime - 0.15 && log[0] - R.t <= ANNOUNCE.chime + 0.15, 'shown at ' + (log[0] - R.t).toFixed(2));
  assert.equal(L.filter((x) => x === 'rescued').length, 1);
  assert.ok(readSecs(R.words) >= TEXT.least && readSecs(R.words) <= TEXT.most);
  // (a rescue in the news with no run's facts: no text line)
  const B = makeAnnouncer({ sound: fakeSound(), read: null, rand: seeded(3) });
  const other = { id: 'rescue:2', kind: 'rescue', ship: 'Medic', captain: 'Captain Hale', crew: 'six miners' };
  for (let t = 0; t < 400; t += 0.1) B.update(0.1, facts({ news: [other] }));
  assert.ok(!B.log.some((x) => x.id === 'rescued'));
  assert.ok(LINES.find((x) => x.id === 'rescued'));
});

test('a text line is not shown where it is not heard, nor away from the station; it shows with no chime to be had', () => {
  const S = { played: [], load() {}, has: () => false, length: () => 0, play: () => null }, shown = [];
  const A = makeAnnouncer({ sound: S, read: null, rand: seeded(5), onText: (w) => shown.push(w) });
  const item = { id: 'rescue:4', kind: 'rescue', ship: 'Medic', captain: 'Captain Hale', crew: 'three stranded crew', people: 'three people', from: fromWords('moon'), count: 3, resting: 3 };
  const facts = (place) => ({ playing: true, place, math: false, news: [item], captains, scan: null, alarm: null, events: [], told: null });
  // (the recorded line never comes (no clip to be had), so the text line waits for it: told by hand here)
  A.told.add('rescue:4');
  A.say('rescued');
  for (let t = 0; t < 3; t += 0.1) A.update(0.1, facts('medical'));
  // (with no chime to be had it starts all the same, a second on)
  for (let t = 0; t < 3; t += 0.1) A.update(0.1, facts('medical'));
  assert.equal(shown[0], outcome({ people: 3, from: fromWords('moon'), resting: 3 }));
  // (walked out of the station's rooms while it shows: put away)
  for (let t = 0; t < 1; t += 0.1) A.update(0.1, facts(null));
  assert.equal(shown[shown.length - 1], null);
});

test('a text line waits while a question card is up (its words would be read over the card\'s), and is put away if one comes up', () => {
  const shown = [];
  const A = makeAnnouncer({ sound: fakeSound(), read: null, rand: seeded(13), onText: (w) => shown.push(w) });
  const item = { id: 'rescue:7', kind: 'rescue', ship: 'Medic', captain: 'Captain Hale', crew: 'four stranded crew', people: 'four people', from: fromWords('meadow'), count: 4, resting: 3 };
  const facts = (math) => ({ playing: true, place: 'medical', math, news: [item], captains, scan: null, alarm: null, events: [] });
  A.told.add('rescue:7');
  // (a card up the whole time: other lines, never the text one)
  for (let t = 0; t < 400; t += 0.1) A.update(0.1, facts(true));
  assert.ok(A.log.length >= 3 && !A.log.some((x) => x.id === 'rescued'), A.log.map((x) => x.id).join());
  assert.deepEqual(shown, []);
  // (the card put away: said at the next turn)
  for (let t = 0; t < 120; t += 0.1) A.update(0.1, facts(false));
  assert.ok(A.log.some((x) => x.id === 'rescued'));
  assert.equal(shown[0], outcome({ people: 4, from: fromWords('meadow'), resting: 3 }));
  // (shown, then a card comes up: put away)
  const B = makeAnnouncer({ sound: fakeSound(), read: null, rand: seeded(13), onText: (w) => shown.push(w) });
  B.told.add('rescue:7'); B.say('rescued'); shown.length = 0;
  for (let t = 0; t < 4; t += 0.1) B.update(0.1, facts(false));
  assert.equal(shown.length, 1);
  B.update(0.1, facts(true));
  assert.deepEqual(shown, [outcome({ people: 4, from: fromWords('meadow'), resting: 3 }), null]);
});
