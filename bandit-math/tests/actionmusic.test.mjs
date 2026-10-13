// The action music's plan (src/audio/actionmusic.js makeActionTune) and its instruments (src/audio/actionpatches.js),
// in plain numbers: the gallop is on every beat, the layers are what they say, the notes stay where the instruments
// can play them (the plucked guitar's string can't be shorter than Web Audio's shortest looped delay), the tempo is the
// stage music's, and the same seed gives the same music. How it SOUNDS is for ears: the render rig
// ~/pw/bandit-math/rigs/bandits/action_render.cjs writes a WAV to ~/pw/bandit-math/sound/action/.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeActionTune, patchOf, ACTION } from '../src/audio/actionmusic.js';
import { ACTION_PATCHES } from '../src/audio/actionpatches.js';
import { BEAT } from '../src/audio/stagemusic.js';

const lines = (seed, n) => { const next = makeActionTune(seed), out = []; for (let i = 0; i < n; i++) out.push(next()); return out; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

test('the tempo is the stage music\'s', () => {
  assert.equal(BEAT, 0.75, '80 beats a minute');
});

test('the same seed gives the same music, another seed other music', () => {
  assert.deepEqual(lines(7, 6), lines(7, 6));
  assert.notDeepEqual(JSON.stringify(lines(7, 6)), JSON.stringify(lines(8, 6)));
});

test('every line is four bars, its notes in order and inside the line', () => {
  lines(3, 20).forEach((ev, i) => {
    for (let k = 1; k < ev.length; k++) assert.ok(ev[k].beat >= ev[k - 1].beat, 'in order');
    for (const e of ev) {
      assert.ok(e.beat >= i * 16 && e.beat < (i + 1) * 16, `line ${i}: beat ${e.beat}`);
      assert.ok(e.layer === 'trail' || e.layer === 'action', e.layer);
      if (e.len != null) assert.ok(e.beat + e.len <= (i + 1) * 16 + 2.01, 'a long note rings at most a little past the line');
    }
  });
});

test('the gallop: da-da-DUM into every beat, on the action layer', () => {
  for (const [i, ev] of lines(5, 8).entries()) {
    for (let b = 0; b < 16; b++) {
      const at = i * 16 + b;
      assert.ok(ev.some((e) => e.what === 'gallop' && e.beat === at && e.layer === 'action'), `DUM on beat ${at}`);
      assert.ok(ev.some((e) => e.what === 'rim' && e.beat === at + 0.5), `da at ${at + 0.5}`);
      assert.ok(ev.some((e) => e.what === 'rim' && e.beat === at + 0.75), `da at ${at + 0.75}`);
    }
    // the bar's first DUM is the hardest
    const g = ev.filter((e) => e.what === 'gallop');
    for (const e of g) assert.equal(e.vel, (e.beat - i * 16) % 4 === 0 ? 1 : 0.8);
  }
});

test('the trail layer keeps a bass on every bar, with nothing of the action in it', () => {
  for (const [i, ev] of lines(9, 10).entries()) {
    for (let bar = 0; bar < 4; bar++) assert.ok(ev.some((e) => e.layer === 'trail' && e.what === 'bass' && e.beat === i * 16 + bar * 4), `bar ${bar}`);
    for (const e of ev.filter((x) => x.layer === 'trail')) assert.ok(['bass', 'twang'].includes(e.what), e.what);
  }
});

test('the notes stay where the instruments play them', () => {
  const all = lines(11, 40).flat();
  for (const e of all.filter((x) => x.what === 'twang')) {
    // the string is a delay one period long: Web Audio loops a delay no shorter than 128 samples (2.9 ms at 44.1 kHz)
    assert.ok(1 / hz(e.midi) > 128 / 44100, `guitar note ${e.midi} (${hz(e.midi).toFixed(0)} Hz) is too high for the string`);
    assert.ok(e.midi >= 40, 'no lower than E2');
  }
  for (const e of all.filter((x) => x.what === 'whistle')) assert.ok(e.midi >= 83 && e.midi <= 95, `whistle ${e.midi}: B5 to B6`);
  for (const e of all.filter((x) => x.what === 'bass')) assert.ok(e.midi >= 36 && e.midi <= 57, `bass ${e.midi}`);
  // the key: every pitched note is in E minor (the stage's G major: the same seven notes)
  const SCALE = new Set([4, 6, 7, 9, 11, 0, 2]);   // E F# G A B C D
  for (const e of all.filter((x) => x.midi != null)) assert.ok(SCALE.has(e.midi % 12), `note ${e.midi} is in the key`);
});

test('the whistle rests now and then, and plays over most lines', () => {
  const ev = lines(4, 60), playing = ev.map((l) => l.some((e) => e.what === 'whistle'));
  const share = playing.filter(Boolean).length / playing.length;
  assert.ok(share > 0.3 && share < 0.8, `plays over ${(share * 100).toFixed(0)}% of lines`);
  for (let i = 2; i < playing.length; i++) assert.ok(!(playing[i] && playing[i - 1] && playing[i - 2]), 'never three lines in a row');
});

test('whip cracks come at the end of every other line', () => {
  lines(2, 12).forEach((ev, i) => { if (i % 2 === 1) assert.ok(ev.some((e) => e.what === 'whip' && e.beat === i * 16 + 15.5)); });
});

test('every instrument is a whole patch the Sound Lab can play', () => {
  const names = ['ACTION — GALLOP', 'ACTION — RIM', 'ACTION — BIG DRUM', 'ACTION — WHIP', 'ACTION — TWANG', 'ACTION — WHISTLE', 'ACTION — BASS'];
  for (const n of names) {
    const p = patchOf(n, {});
    assert.ok(p, n);
    assert.equal(p.group, 'MUSIC', n);
    const ids = new Set(p.nodes.map((x) => x.id));
    assert.equal(ids.size, p.nodes.length, `${n}: node ids are unique`);
    assert.ok(p.nodes.some((x) => x.type === 'out'), `${n}: has an output`);
    assert.ok(p.nodes.some((x) => x.type === 'env'), `${n}: has an envelope (so each note ends by itself)`);
    for (const c of p.cables) { assert.ok(ids.has(c.from), `${n}: cable from ${c.from}`); assert.ok(ids.has(c.to), `${n}: cable to ${c.to}`); }
  }
  assert.equal(Object.keys(ACTION_PATCHES).length, names.length);
  // the plucked string's delay: its damping filter lifts the loop by up to 1 dB (Web Audio's default Q on a lowpass), so
  // the feedback must stay under 1 / 1.122 or the loop runs away ("BiquadFilterNode: state is bad")
  const s = ACTION_PATCHES['ACTION — TWANG'].nodes.find((x) => x.id === 'string');
  assert.ok(s.feedback * Math.pow(10, 1 / 20) < 0.97, `loop gain ${(s.feedback * Math.pow(10, 1 / 20)).toFixed(3)}`);
  assert.ok(Math.abs(s.time - 1 / hz(52)) < 1e-5, 'written at E3');
  // a preset of the same name in the Sound Lab's copy wins (tuned there by ear)
  assert.equal(patchOf('ACTION — RIM', { 'ACTION — RIM': { mine: 1 } }).mine, 1);
  assert.ok(ACTION.fadeIn < ACTION.fadeOut, 'in quick on the bar line, out over about a bar');
});
