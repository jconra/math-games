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
import { lightLines, DRUM_PLACE, LINE_LOOK, lineColour } from '../src/music/lights.js';
import { screenLink } from '../src/music/screen.js';
import { paintVisual } from '../src/music/visuals.js';
import { hexMaterial, hexUniforms, hexState, HEX_SHADER, BASS_READING } from '../src/music/hex.js';
import { FRAG_HEAD, FRAG_BEAT, FRAG_MEL, FRAG_END } from '../src/music/electric.js';
import { createHash } from 'node:crypto';

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
  const b = lightLines(f, cols);
  assert.equal(b.length, 5 * cols);
  for (const v of b) assert.ok(v >= 0 && v <= 1);
  assert.ok(at(b, row('bass'), 0.25) > 0.5 && at(b, row('bass'), 0.75) < 0.2 && at(b, row('bass'), 0.75) > 0.03, 'the bass note lights its place; the whole line rests dimly, lifting with the bass');
  assert.ok(at(b, row('pads'), 0) > 0.5 && at(b, row('pads'), 1) > 0.5 && at(b, row('pads'), 0.5) < 0.3, 'a chord: several places');
  assert.ok(at(b, row('beat'), DRUM_PLACE.kick) > 0.5 && at(b, row('beat'), DRUM_PLACE.hat) > 0.3 && at(b, row('beat'), DRUM_PLACE.snare) < 0.4, 'each drum its place');
  assert.ok(at(b, row('melody'), 0.5) < 0.1, 'a part with no note: its line low');
  // the line pulses with its part: a note dying away dims it
  const later = lightLines({ ...f, now: 11, pulse: pulses(f.notes, 11, 60 / song.bpm / 4) }, cols);
  assert.ok(at(later, row('bass'), 0.25) < at(b, row('bass'), 0.25) * 0.3);
  // stopped: all low
  for (const v of lightLines({ playing: false }, cols)) assert.ok(v < 0.1);
  // the one style left (the game's maker chose it): a resting line clearly dimmer than a note's stretch, which is a
  // metre or more in a 20 m hallway; the colour at full strength, not washed out to white
  const one = frame([N('lead', { midi: (RANGES.lead[0] + RANGES.lead[1]) / 2 })]), t1 = lightLines(one, cols), lead = row('lead');
  assert.ok(at(t1, lead, 0.5) > 6 * at(t1, lead, 0.1), 'the note\'s place against the resting line');
  let wide = 0; for (let i = 0; i < cols; i++) if (t1[lead * cols + i] > at(t1, lead, 0.5) / 2) wide++;
  assert.ok(wide / cols * 20 >= 1, 'a metre or more of 20 m lit');
  const full = lineColour('#8fd3ff', 1), rest = lineColour('#8fd3ff', 0);
  assert.ok(Math.max(...full) > 0.99 && Math.min(...full) < 0.7, 'full strength, still its colour');
  assert.ok(Math.max(...rest) <= LINE_LOOK.rest + 1e-9);
});

test('Spectrum is gone from the pictures; a kept or asked-for "spectrum" is the first picture', () => {
  assert.deepEqual(VISUALS.map((v) => v.id), ['notes', 'electric', 'hex', 'orbit', 'sections']);
  assert.ok(!VISUALS.some((v) => /spectrum/i.test(v.id + v.label)));
  assert.equal(visualOf('spectrum').id, VISUALS[0].id);
  const L = screenLink({ picture: 'electric' }); L.pick('spectrum'); assert.equal(L.picture, 'notes');
  const E = visualOf('electric');
  assert.equal(E.shader, 'electric'); assert.equal(E.paint, visualOf('notes').paint, 'with no WebGL the Electric picture paints as Notes');
  assert.ok(E.label.split(' ').length <= 2);
});

// ── ELECTRIC 2: the Hex picture, and Orbit's glow. The game's maker, 2026-11-26: "Eletric is interesting, but it might
// be too busy ... Maybe you can keep that one to compare" and "The orbit is cool, but I feel like it could use a glow
// behind it that pulses."
test('Hex: its own material on the same uniforms as Electric, sharing the hexagon field and the harp; Electric unchanged', () => {
  class ShaderMaterial { constructor(o) { Object.assign(this, o); this.userData = {}; } }
  const m = hexMaterial({ ShaderMaterial }), U = m.userData.state;
  assert.equal(m.name, 'music-hex'); assert.equal(hexUniforms, electricUniforms); assert.equal(hexState, electricState);
  hexUniforms(frame([N('lead', { midi: 70 }), N('bass', { midi: 40 })]), U, { time: 4 });
  assert.equal(m.uniforms.uTime.value, 4); assert.equal(m.uniforms.uLead.value, U.uLead);
  const F = HEX_SHADER.fragment;
  for (const k of Object.keys(U)) assert.ok(F.includes(k), k + ' declared');
  // the beat's hexagon outlines and the melody's harp are Electric's own pieces, not copies
  for (const piece of [FRAG_HEAD, FRAG_BEAT, FRAG_MEL, FRAG_END]) { assert.ok(F.includes(piece)); assert.ok(ELECTRIC_SHADER.fragment.includes(piece.trimEnd())); }
  // none of Electric's busier effects: no plasma ball or ring, no tongues, no streams
  for (const gone of ['plasma ball', 'tongues', 'streams of plasma', 'ringl']) assert.ok(!F.includes(gone), gone);
  for (const m2 of F.matchAll(/for \( int \w+ = \d; \w+ <=? (\w+);/g)) assert.match(m2[1], /^\d+$/);
  assert.doesNotMatch(F, /\bpow\(/);
  assert.equal(BASS_READING, 'insides', 'the bass fills the insides of hexagons placed by the note (as built)');
  // Electric's shader text exactly as ELECTRIC 1 made it ("keep that one to compare")
  assert.equal(createHash('sha256').update(ELECTRIC_SHADER.fragment).digest('hex'), 'e5b35f35820cf3f077b8864f287a04d755b58d06c4d44f1256d7517b8ebbe14e');
});

test('Hex on the Picture row right after Electric, with Notes as its fallback; an unknown name is still Notes', () => {
  const H = visualOf('hex');
  assert.equal(H.label, 'Hex'); assert.equal(H.shader, 'hex'); assert.equal(H.paint, visualOf('notes').paint);
  assert.equal(VISUALS.findIndex((v) => v.id === 'hex'), VISUALS.findIndex((v) => v.id === 'electric') + 1);
  assert.equal(visualOf('nonesuch').id, 'notes');
  const L = screenLink(); L.pick('hex'); assert.equal(L.picture, 'hex');
});

test('Orbit\'s glow: painted first, behind the rings, swelling on the beat and easing off between, steady when stopped', () => {
  // a 2D canvas that notes how strongly the glow (the one gradient) is painted, and what was painted before it
  const glow = (f) => {
    let G = null, at = null, before = 0;
    const o = { globalAlpha: 1 };
    const g = new Proxy(o, { get: (t, k) => {
      if (k in t) return t[k];
      if (k === 'createRadialGradient') return () => (G = { addColorStop() {} });
      if (k === 'fillRect') return () => { if (t.fillStyle === G && at == null) at = t.globalAlpha; else if (at == null) before++; };
      return () => {};
    } });
    paintVisual('orbit', g, { ...f, w: 736, h: 400, memo: {} });
    return { at, before };
  };
  const f = { ...frame([]), section: { kind: 'peak', barIn: 0 }, step: 0, barPhase: 0 }, on = glow({ ...f, beatPhase: 0 }), mid = glow({ ...f, beatPhase: 0.5 }), near = glow({ ...f, beatPhase: 0.15 });
  assert.equal(on.before, 1, 'only the dark behind it is painted first');
  assert.ok(on.at > mid.at + 0.25 && near.at < on.at && near.at > mid.at, `on the beat ${on.at}, easing ${near.at}, between ${mid.at}`);
  assert.ok(mid.at >= 0.25, 'never gone: a glow that swells, not a flash');
  const offBeat = glow({ ...f, beatPhase: 0, song: { ...song, beat: 'off' } });
  assert.ok(offBeat.at < on.at && offBeat.at > mid.at, 'softer with the beat off');
  const a = glow({ ...f, playing: false, beatPhase: 0 }), b = glow({ ...f, playing: false, beatPhase: 0.5 });
  assert.equal(a.at, b.at, 'stopped: steady');
});
