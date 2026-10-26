// Old Hob's voice settings (src/audio/voice.js): the sliders' block, what each setting does to his syllables, and the
// mood of a line. Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HOB_VOICE, VOICE, babble, syllablePatch, moodOf, moodVoice } from '../src/audio/voice.js';
import { PATCH_PRESETS } from '../src/audio/patch.js';

const LINE = "Mornin'! Rancher next door needs a hand with his herd. Follow the hoofprints out to the pasture.";
const base = PATCH_PRESETS[VOICE.patch];
const node = (p, id) => p.nodes.find((n) => n.id === id);

test("one settings block: the sliders' names, sensible values, the voice's level is its volume", () => {
  assert.deepEqual(Object.keys(HOB_VOICE).sort(), ['clarity', 'gravel', 'mood', 'nasal', 'pitch', 'speed', 'volume', 'wander']);
  assert.equal(VOICE.level, HOB_VOICE.volume);
  assert.ok(HOB_VOICE.volume <= 0.4, 'quiet');
});

test('speed and pitch wander change the babble; the settings default to his voice as it was', () => {
  const a = babble(LINE), fast = babble(LINE, { ...HOB_VOICE, speed: 2 }), flat = babble(LINE, { ...HOB_VOICE, wander: 0 });
  assert.equal(fast.length, a.length);
  assert.ok(Math.abs(fast[fast.length - 1].at - a[a.length - 1].at / 2) < 0.01, 'twice as fast: half the time');
  const spread = (l) => Math.max(...l.map((s) => s.semi)) - Math.min(...l.map((s) => s.semi));
  assert.ok(spread(flat) < spread(a), 'no wander: flatter');
  assert.equal(babble('Hi there')[1].at, +(VOICE.step + VOICE.wordGap).toFixed(3), 'speed 1: the old timing');
});

test("each slider moves its part of the syllable's patch", () => {
  const s = babble('Howdy')[0];
  const p0 = syllablePatch(base, s), up = syllablePatch(base, s, { ...HOB_VOICE, pitch: 12 });
  assert.ok(Math.abs(node(up, 'buzz').freq / node(p0, 'buzz').freq - 2) < 1e-9, 'an octave up');
  assert.equal(node(syllablePatch(base, s, { ...HOB_VOICE, gravel: 0 }), 'gravel').level, 0, 'no gravel: smooth');
  assert.ok(node(syllablePatch(base, s, { ...HOB_VOICE, nasal: 1 }), 'f2-g').gain > node(p0, 'f2-g').gain * 2, 'nasal: the upper band rings');
  assert.ok(node(syllablePatch(base, s, { ...HOB_VOICE, clarity: 0 }), 'tone').freq < 800 && node(syllablePatch(base, s, { ...HOB_VOICE, clarity: 1 }), 'tone').freq > 6000);
  assert.ok(Math.abs(node(p0, 'tone').freq - 2600) < 30, 'the default clarity is his old soft top (2600 Hz)');
  assert.ok(Math.abs(node(p0, 'buzz2').level - 0.18) < 0.01 && node(p0, 'gravel').level === 0.42, 'the default gravel is as it was');
});

test("a line's mood: brighter for praise, lower and kinder for help, plain otherwise", () => {
  assert.equal(moodOf('catch'), 'praise'); assert.equal(moodOf('flockDone'), 'praise'); assert.equal(moodOf('boxWon'), 'praise');
  assert.equal(moodOf('miss'), 'help'); assert.equal(moodOf('sheepWrong'), 'help'); assert.equal(moodOf('storeMiss'), 'help');
  assert.equal(moodOf('arrive'), null); assert.equal(moodOf(null), null);
  const p = moodVoice(HOB_VOICE, 'praise'), h = moodVoice(HOB_VOICE, 'help');
  assert.ok(p.pitch > HOB_VOICE.pitch && h.pitch < HOB_VOICE.pitch && p.clarity > h.clarity && h.speed < p.speed);
  assert.deepEqual(moodVoice({ ...HOB_VOICE, mood: 0 }, 'praise').pitch, HOB_VOICE.pitch, 'mood 0: always the same');
  assert.equal(moodVoice(HOB_VOICE, null), HOB_VOICE);
});

test("the Sound Lab's copy of the voice code is the game's", () => {
  const lab = new URL('../../../sound-lab/hobvoice.js', import.meta.url);
  if (!fs.existsSync(lab)) return;
  assert.equal(fs.readFileSync(lab, 'utf8'), fs.readFileSync(new URL('../src/audio/voice.js', import.meta.url), 'utf8'),
    'copy mathwood-valley/src/audio/voice.js to ~/sound-lab/hobvoice.js');
});

test('voice clip slots: "Rope the evens", "Rope the odds" and "Help! Bandits" each have a named file, quiet until recorded', async () => {
  const { CLIP_SLOTS, slotFiles, playSlot } = await import('../src/audio/clipslots.js');
  const { AMBUSH } = await import('../src/missions/wagonplan.js');
  const want = { ropeEvens: 'rope_the_evens', ropeOdds: 'rope_the_odds', helpBandits: 'help_bandits' };
  for (const [id, file] of Object.entries(want)) {
    assert.equal(CLIP_SLOTS[id].file, file);
    assert.deepEqual(slotFiles(id), CLIP_SLOTS[id].recorded ? [file] : []);
    assert.equal(playSlot(null, id), false, 'no sound: the caller falls back');
  }
  assert.deepEqual(AMBUSH.helpClips, slotFiles('helpBandits'));
});
