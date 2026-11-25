// THE ELECTRIC PICTURE AND THE HALLWAY LINES (src/music/electric.js, lights.js lightLines; visuals.js without Spectrum).
// The game's maker, 2026-11-25: "some kind of eletric effect for each instrument? Like laser harp for melody, some
// background flashes for the beat ... hexagon outlines", "I want to avoid the histogram of the spectrum", "a line that
// represents each instrument that pulses. Maybe the line can get bright on the x axis representing the note being
// played." A frame's notes go into the picture's uniforms (which note, when, how long, how loud); the lines' table
// lights each part's line at its notes' places; the Spectrum picture is gone and a kept 'spectrum' falls back.
//   node --test pi-nebula/tests/musicelectric.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, PART_IDS } from '../src/music/song.js';
import { tapOf, pulses } from '../src/music/tap.js';
import { VISUALS, visualOf, RANGES } from '../src/music/visuals.js';
import { electricState, electricUniforms, electricMaterial, SLOTS, DRUM_KIND, placeOf, ELECTRIC_SHADER } from '../src/music/electric.js';
import { lightLines, lightBars, LIGHT_STYLES, DRUM_PLACE } from '../src/music/lights.js';
import { screenLink } from '../src/music/screen.js';

const song = PRESETS.find((p) => p.id === 'stationdrive').song;
const UNI = { beat: 'uDrum', bass: 'uBass', pads: 'uPad', lead: 'uLead', melody: 'uMel' };
// a frame with made-up notes, now = 10
const N = (part, o) => ({ part, sound: part === 'beat' ? 'kick' : 'x', midi: null, at: 9.9, dur: 0.5, vel: 0.8, bar: 4, step: 2, len: 2, ...o });
const frame = (notes, more = {}) => ({ now: 10, playing: true, song, notes, barDur: 16 * 60 / song.bpm / 4, pulse: pulses(notes, 10, 60 / song.bpm / 4), ...more });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, a + ' near ' + b);
const slots = (U, part) => { const a = U[UNI[part]], out = []; for (let k = 0; k < SLOTS[part]; k++) out.push([...a.slice(k * 4, k * 4 + 4)]); return out; };

test('a frame\'s notes go into the electric picture\'s uniforms: which note, how long ago it started, how long, how loud', () => {
  const U = electricState();
  const f = frame([
    N('melody', { midi: 70, at: 9.8, dur: 0.4, vel: 0.9 }), N('melody', { midi: 66, at: 9.95, dur: 0.2, vel: 0.5, step: 3 }),
    N('pads', { midi: 57, at: 9, dur: 2 }), N('pads', { midi: 60, at: 9, dur: 2 }), N('pads', { midi: 64, at: 9, dur: 2 }),
    N('bass', { midi: 33, at: 9.9, dur: 0.3, vel: 1.2 }),
    N('lead', { midi: 69, at: 10.5, dur: 0.3 }),          // not started yet: not in the picture
    N('melody', { midi: 80, at: 8, dur: 0.2 }),           // long over: gone
    N('beat', { sound: 'kick', at: 9.95, vel: 0.9 }), N('beat', { sound: 'hat', at: 9.97, vel: 0.3 }), N('beat', { sound: 'clap', at: 9.9, vel: 0.6 }),
  ]);
  electricUniforms(f, U, { time: 3.5, aspect: 2, px: 0.01 });
  assert.equal(U.uTime, 3.5); assert.equal(U.uAspect, 2); assert.equal(U.uPx, 0.01); assert.equal(U.uPlay, 1);
  const mel = slots(U, 'melody');
  // newest first; the place is the semitone up from the part's lowest note, the seed after the point
  assert.equal(Math.floor(mel[0][0]), 66 - RANGES.melody[0]); near(mel[0][1], 0.05); near(mel[0][2], 0.2); near(mel[0][3], 0.5);
  assert.equal(Math.floor(mel[1][0]), 70 - RANGES.melody[0]); near(mel[1][1], 0.2); near(mel[1][2], 0.4);
  assert.equal(mel[2][3], 0, 'the rest empty'); assert.equal(mel[2][1], 99);
  assert.deepEqual(slots(U, 'pads').filter((s) => s[3] > 0).map((s) => Math.floor(s[0])).sort((a, b) => a - b), [57, 60, 64].map((m) => m - RANGES.pads[0]), 'a chord: a slot a note');
  assert.equal(slots(U, 'bass')[0][3], 1, 'loudness kept to 1');
  assert.equal(slots(U, 'lead')[0][3], 0, 'a note not yet started is not shown');
  const drums = slots(U, 'beat').filter((s) => s[3] > 0).map((s) => Math.floor(s[0]));
  assert.deepEqual(drums, [DRUM_KIND.hat, DRUM_KIND.kick, DRUM_KIND.clap], 'each drum its own kind, newest first');
  // a note keeps its seed (its bolt, its place in the hexagons) through its life
  const U2 = electricUniforms({ ...f, now: 10.1 }, electricState());
  assert.equal(slots(U2, 'melody')[1][0], mel[1][0]);
  // the parts switched on and off
  electricUniforms(frame([], { song: { ...song, lead: 'off' } }), U);
  assert.deepEqual([...U.uOn], PART_IDS.map((p) => (p === 'lead' ? 0 : 1)));
  assert.ok(slots(U, 'melody').every((s) => s[3] === 0), 'the old notes cleared');
  electricUniforms({ ...frame([N('bass', { midi: 40 })]), playing: false }, U);
  assert.equal(U.uPlay, 0); assert.equal(slots(U, 'bass')[0][3], 0, 'stopped: nothing');
});

test('the electric picture\'s uniforms from the real tap: every number finite, every place inside its part\'s range', () => {
  const sd = 60 / song.bpm / 4, bar = 16 * sd;
  for (let b = 20; b < 60; b += 3) {
    const raw = { now: 10 + bar * 1.43, playing: true, song, next: { bar: b + 2, t: 10 + 2 * bar }, bars: [{ bar: b, t: 10, sd, song }, { bar: b + 1, t: 10 + bar, sd, song }] };
    const U = electricUniforms(tapOf({ song, tapRaw: () => raw }).frame(), electricState());
    for (const p of PART_IDS) for (const s of slots(U, p)) {
      for (const v of s) assert.ok(Number.isFinite(v));
      if (!s[3]) continue;
      assert.ok(s[1] >= 0 && s[2] > 0 && s[3] <= 1);
      const top = p === 'beat' ? 5 : RANGES[p][1] - RANGES[p][0];
      assert.ok(s[0] >= 0 && Math.floor(s[0]) <= top, p + ' ' + s[0]);
    }
  }
  assert.equal(placeOf({ part: 'bass', midi: 2 }), 0); assert.equal(placeOf({ part: 'bass', midi: 200 }), RANGES.bass[1] - RANGES.bass[0]);
});

test('the material: a ShaderMaterial whose uniforms read the state electricUniforms fills, fixed loops in its shader', () => {
  class ShaderMaterial { constructor(o) { Object.assign(this, o); this.userData = {}; } }
  const m = electricMaterial({ ShaderMaterial });
  const U = m.userData.state;
  electricUniforms(frame([N('melody', { midi: 70 })]), U, { time: 7 });
  assert.equal(m.uniforms.uTime.value, 7, 'a number set in the state is the uniform\'s');
  assert.equal(m.uniforms.uMel.value, U.uMel);
  for (const k of Object.keys(U)) assert.ok(ELECTRIC_SHADER.fragment.includes(k), k + ' declared');
  // every loop counts to a fixed small number (no loop over a uniform)
  for (const m2 of ELECTRIC_SHADER.fragment.matchAll(/for \( int \w+ = \d; \w+ <=? (\w+);/g)) assert.match(m2[1], /^\d+$/);
  assert.doesNotMatch(ELECTRIC_SHADER.fragment, /\bpow\(/, 'no pow (a negative number to a power is undefined in GLSL)');
});

test('the hallway lines: a line a part, brightest at its notes\' places (low toward the start), each drum its own place', () => {
  const cols = 64, at = (b, r, x) => b[r * cols + Math.round(x * (cols - 1))];
  const [lo, hi] = RANGES.bass, row = (p) => PART_IDS.indexOf(p);
  const f = frame([N('bass', { midi: lo + 0.25 * (hi - lo) }), N('pads', { midi: RANGES.pads[0] }), N('pads', { midi: RANGES.pads[1] }),
    N('beat', { sound: 'kick' }), N('beat', { sound: 'hat', at: 9.98 })]);
  const b = lightLines(f, cols, 'notes');
  assert.equal(b.length, 5 * cols);
  for (const v of b) assert.ok(v >= 0 && v <= 1);
  assert.ok(at(b, row('bass'), 0.25) > 0.5 && at(b, row('bass'), 0.75) < 0.3 && at(b, row('bass'), 0.75) > 0.1, 'the bass note lights its place; the whole line glows with the bass');
  assert.ok(at(b, row('pads'), 0) > 0.5 && at(b, row('pads'), 1) > 0.5 && at(b, row('pads'), 0.5) < 0.3, 'a chord: several places');
  assert.ok(at(b, row('beat'), DRUM_PLACE.kick) > 0.5 && at(b, row('beat'), DRUM_PLACE.hat) > 0.3 && at(b, row('beat'), DRUM_PLACE.snare) < 0.4, 'each drum its place');
  assert.ok(at(b, row('melody'), 0.5) < 0.1, 'a part with no note: its line low');
  // the line pulses with its part: a note dying away dims it
  const later = lightLines({ ...f, now: 11, pulse: pulses(f.notes, 11, 60 / song.bpm / 4) }, cols, 'notes');
  assert.ok(at(later, row('bass'), 0.25) < at(b, row('bass'), 0.25) * 0.3);
  // the other two line styles and stopped: 0..1, right size
  for (const s of ['pass', 'one']) { const t = lightLines(f, cols, s); assert.equal(t.length, 5 * cols); for (const v of t) assert.ok(v >= 0 && v <= 1, s); }
  const pass = lightLines(frame([N('lead', { midi: 70, at: 10 + f.barDur * 0.5, dur: 0.2 })]), cols, 'pass');
  assert.ok(at(pass, row('lead'), 0.77) > 0.1 && at(pass, row('lead'), 0.25) < 0.05, 'going by: a note to come is ahead of the middle');
  const one = lightLines(frame([N('bass', { midi: RANGES.bass[0] }), N('melody', { midi: RANGES.melody[1] })]), cols, 'one');
  assert.ok(at(one, row('bass'), 0) > 0.5 && at(one, row('melody'), 1) > 0.5, 'one line: bass at the start, melody at the end');
  for (const v of lightLines({ playing: false }, cols, 'notes')) assert.ok(v < 0.1);
  // the strips' styles stay as they were, and every style is listed
  assert.deepEqual(LIGHT_STYLES.map((s) => s.id), ['beat', 'run', 'meter', 'notes', 'pass', 'one']);
  assert.equal(lightBars(f.pulse, 8, 'beat').length, 8);
});

test('Spectrum is gone from the pictures; a kept or asked-for "spectrum" is the first picture', () => {
  assert.deepEqual(VISUALS.map((v) => v.id), ['notes', 'electric', 'orbit', 'sections']);
  assert.ok(!VISUALS.some((v) => /spectrum/i.test(v.id + v.label)));
  assert.equal(visualOf('spectrum').id, VISUALS[0].id);
  const L = screenLink({ picture: 'electric' }); L.pick('spectrum'); assert.equal(L.picture, 'notes');
  const E = visualOf('electric');
  assert.equal(E.shader, 'electric'); assert.equal(E.paint, visualOf('notes').paint, 'with no WebGL the Electric picture paints as Notes');
  assert.ok(E.label.split(' ').length <= 2);
});
