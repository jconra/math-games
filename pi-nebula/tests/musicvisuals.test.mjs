// THE MUSIC'S PICTURES, LIGHTS AND VOLUMES (src/music/tap.js, visuals.js, lights.js; song.js vol). The game's maker,
// 2026-11-24: "It would be nice to have a visual that demonstrates that all the note information is there" and "some
// light bars or something that respond the the music", and "a volume adjustment for each instrument". The notes the
// pictures are given are the notes the player plays, at their times; the pulse numbers stay 0..1 and follow the kick
// and the bass; every picture paints from made-up notes without error; a song's volumes go round its text.
//   node --test pi-nebula/tests/musicvisuals.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, PART_IDS, VOL, volOf, volGain, volsOf, checkSong, cleanSong, songText } from '../src/music/song.js';
import { barNotes } from '../src/music/patterns.js';
import { notesOfBar, barsAround, notesWindow, pulses, sectionsAround, tapOf } from '../src/music/tap.js';
import { VISUALS, PART_COLOURS, paintVisual } from '../src/music/visuals.js';
import { lightBars, LIGHT_STYLES } from '../src/music/lights.js';

const song = PRESETS.find((p) => p.id === 'stationdrive').song;
const sd = 60 / song.bpm / 4, bar = 16 * sd;
// what the player's tap gives while bars 20 and 21 have been made and 22 is next
const raw = (now) => ({ now, playing: true, song, anchor: { bar: 20, t: 10, bpm: song.bpm }, next: { bar: 22, t: 10 + 2 * bar },
  bars: [{ bar: 20, t: 10, sd, song, section: null }, { bar: 21, t: 10 + bar, sd, song, section: null }] });

test('a bar\'s notes are the player\'s notes, at their times on the audio clock; a chord is a note a pitch', () => {
  const e = { bar: 21, t: 10 + bar, sd, song: { ...song, swing: 0.2 } };
  const ns = notesOfBar(e), src = barNotes(e.song, 21).notes;
  assert.equal(ns.length, src.reduce((a, n) => a + (Array.isArray(n.midi) ? n.midi.length : 1), 0));
  for (const n of ns) {
    assert.ok(Math.abs(n.at - (e.t + n.step * sd + (n.step % 2 ? 0.2 * sd : 0))) < 1e-9, 'its time, swing and all');
    assert.ok(n.dur > 0 && PART_IDS.includes(n.part) && n.vel > 0 && n.vel <= 1.5);
  }
});

test('the window: the bars made and the ones to come, every note from a bar back to two on, coming ones marked', () => {
  const now = 10 + bar * 1.5, bs = barsAround(raw(now), 1, 2);
  assert.deepEqual(bs.map((b) => b.bar), [20, 21, 22, 23]);
  assert.ok(bs[2].coming && Math.abs(bs[2].t - (10 + 2 * bar)) < 1e-9 && Math.abs(bs[3].t - (10 + 3 * bar)) < 1e-9);
  const ns = notesWindow(bs, now - bar, now + 2 * bar);
  for (const n of ns) assert.ok(n.at + n.dur >= now - bar && n.at <= now + 2 * bar);
  // the notes of bar 22 are the ones the player will make for bar 22
  assert.equal(ns.filter((n) => n.bar === 22).length, notesOfBar({ bar: 22, t: 10 + 2 * bar, sd, song }).length);
  assert.ok(ns.some((n) => n.at > now), 'notes about to sound are there');
  assert.deepEqual(barsAround({ ...raw(now), playing: false }), [], 'stopped: nothing');
});

test('the pulse numbers: 0..1, the kick the moment it hits, the bass while it sounds, how busy each part is', () => {
  const kickAt = 5, notes = [
    { part: 'beat', sound: 'kick', at: kickAt, dur: 0.2, vel: 1, bar: 0, step: 0 },
    { part: 'bass', sound: 'pulse', midi: 33, at: kickAt, dur: 0.5, vel: 0.9, bar: 0, step: 0 },
    ...Array.from({ length: 16 }, (_, i) => ({ part: 'beat', sound: 'hat', at: kickAt - 1 + i * 0.06, dur: 0.05, vel: 0.5, bar: 0, step: i })),
  ];
  const P0 = pulses(notes, kickAt + 0.001, sd), P1 = pulses(notes, kickAt + 0.6, sd);
  assert.ok(P0.kick > 0.9 && P1.kick < 0.01, `kick ${P0.kick} then ${P1.kick}`);
  assert.ok(P0.bass > 0.8 && P1.bass === 0, 'the bass while its note sounds');
  assert.equal(P0.on.bass, 1); assert.equal(P1.on.bass, 0);
  assert.equal(P0.busy.beat, 1); assert.equal(P0.busy.pads, 0);
  for (const P of [P0, P1, pulses([], 0, sd), pulses(notes, 3, sd, false)]) {
    for (const k of ['kick', 'bass', 'level']) assert.ok(P[k] >= 0 && P[k] <= 1, k);
    for (const p of PART_IDS) assert.ok(P.busy[p] >= 0 && P.busy[p] <= 1 && (P.on[p] === 0 || P.on[p] === 1));
  }
});

test('the song\'s sections around now: the one playing, and the ones to come', () => {
  const S = sectionsAround(song, 30);
  assert.equal(S.length, 5); assert.equal(S[1].from, 24); assert.ok(S.every((s, i) => !i || s.from === S[i - 1].from + 8));
});

// a 2D canvas that only counts: every call a picture makes must exist and take plain numbers
function fakeCanvas() {
  const calls = { n: 0 }, bad = [];
  // (a gradient made is a thing with colour stops)
  const fn = (name) => (...a) => { calls.n++; for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) bad.push(name + ' ' + a.join(',')); return /^create.*Gradient$/.test(name) ? { addColorStop: fn('addColorStop') } : undefined; };
  const g = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (o[k] = fn(String(k)))), set: (o, k, v) => { o[k] = v; return true; } });
  return { g, calls, bad };
}
test('every picture paints from made-up notes without error, at the wall screen\'s size and the lab\'s, playing or not', () => {
  assert.ok(VISUALS.length >= 3 && VISUALS.some((v) => v.id === 'notes') && VISUALS.some((v) => v.id === 'electric'));
  for (const p of PART_IDS) assert.match(PART_COLOURS[p], /^#[0-9a-f]{6}$/);
  const music = { song, tapRaw: () => raw(10 + bar * 1.37) };
  const quiet = { song, tapRaw: () => ({ now: 0, playing: false, song, anchor: null, next: null, bars: [] }) };
  for (const m of [music, quiet]) for (const V of VISUALS) for (const [w, h] of [[512, 278], [1960, 1066], [1, 1]]) {
    const f = { ...tapOf(m).frame(), w, h, memo: {} }, c = fakeCanvas();
    paintVisual(V.id, c.g, f); paintVisual(V.id, c.g, f);
    assert.ok(c.calls.n > 4, V.id + ' painted'); assert.deepEqual(c.bad, [], V.id);
  }
  // the frame really is the music's: the notes the Notes picture shows include every part playing in that bar
  const f = tapOf(music).frame();
  assert.ok(f.playing && f.bar === 21 && f.step >= 0 && f.notes.length > 10);
});

test('the light bars: one brightness a strip, 0..1, in every style; the beat style follows the kick', () => {
  const P = (kick) => ({ ...pulses([], 0, sd), kick, level: kick, barPhase: 0.3 });
  for (const S of LIGHT_STYLES) for (const k of [0, 0.5, 1]) {
    const b = lightBars(P(k), 24, S.id);
    assert.equal(b.length, 24); for (const v of b) assert.ok(v >= 0 && v <= 1, S.id);
  }
  assert.ok(lightBars(P(1), 8, 'beat')[0] > lightBars(P(0), 8, 'beat')[0] + 0.5);
});

test('each part\'s volume belongs to the song: kept, copied in its text only when away from the usual, checked', () => {
  for (const P of PRESETS) { assert.doesNotMatch(songText(P.song), /vol/, 'a song with none: as before'); assert.equal(volOf(P.song, 'pads'), VOL.usual); }
  assert.equal(volGain(VOL.usual), 1); assert.equal(volGain(0), 0); assert.ok(Math.abs(volGain(VOL.usual - 1) - Math.pow(10, -VOL.db / 20)) < 1e-12);
  const s = { ...song, vol: { pads: 6, beat: 8, lead: 10 } };
  assert.deepEqual(checkSong(s), []);
  assert.deepEqual(volsOf(s), { pads: 6, lead: 10 });
  assert.match(songText(s), /, vol: \{ pads: 6, lead: 10 \} \}$/);
  assert.deepEqual(cleanSong(s).vol, { pads: 6, lead: 10 });
  assert.equal(cleanSong({ ...song, vol: { pads: 8 } }).vol, undefined, 'all usual: none kept');
  assert.ok(checkSong({ ...song, vol: { pads: 11 } }).length && checkSong({ ...song, vol: { drums: 3 } }).length);
  // the notes are the same at any volume
  for (let b = 0; b < 40; b += 3) assert.deepEqual(barNotes(s, b), barNotes(song, b));
});
