// The creek's and the campfire's loops (src/audio/nature.js): their settings blocks, what the settings do, that each
// loop wraps round with no click, and that the Sound Lab's copy is the game's. Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BROOK, FIRE, brookSamples, fireSamples } from '../src/audio/nature.js';
import * as ambience from '../src/audio/ambience.js';

const SR = 22050;
const seeded = (s) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const peak = (d) => d.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const rms = (d) => Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length);
// how bright: how much the wave moves sample to sample next to how big it is
const bright = (d) => { let a = 0, b = 0; for (let i = 1; i < d.length; i++) { a += (d[i] - d[i - 1]) ** 2; b += d[i] * d[i]; } return Math.sqrt(a / b); };
// the step across the seam is no bigger than an ordinary step inside the loop (no click where it wraps)
const seamOK = (d) => { const steps = []; for (let i = 1; i < d.length; i++) steps.push(Math.abs(d[i] - d[i - 1])); steps.sort((x, y) => x - y); return Math.abs(d[0] - d[d.length - 1]) <= steps[Math.floor(steps.length * 0.99)]; };

test("one settings block each: the sliders' names, the creek's as it was", () => {
  assert.deepEqual(Object.keys(BROOK).sort(), ['bubbleHigh', 'bubbleLen', 'bubbleLow', 'bubbles', 'fizz', 'gurglePitch', 'gurgles', 'level', 'lowpass', 'passes', 'rise', 'seconds']);
  assert.deepEqual({ seconds: BROOK.seconds, bubbles: BROOK.bubbles, low: BROOK.bubbleLow, high: BROOK.bubbleHigh, lowpass: BROOK.lowpass, passes: BROOK.passes, level: BROOK.level },
    { seconds: 7, bubbles: 38, low: 650, high: 2850, lowpass: 2000, passes: 2, level: 0.6 }, "the defaults are the creek's sound as it was");
  for (const k of ['crackles', 'cluster', 'clusterLen', 'crackleShort', 'crackleLong', 'bright', 'spread', 'pops', 'knock', 'settles', 'breath', 'lowpass', 'seconds', 'level']) assert.ok(k in FIRE, 'FIRE.' + k);
  assert.ok(FIRE.crackles > 20 * FIRE.pops, 'mostly crackles, fewer pops');
  assert.ok(FIRE.crackleShort >= 0.5 && FIRE.crackleLong <= 4, 'crackles 0.5 to 4 ms');
  assert.ok(FIRE.breath <= 0.01, 'at most a faint breath of flame');
  assert.equal(ambience.brookSamples, brookSamples, 'the town plays the shared creek');
});

test('the creek: its length and level from the settings; a lower low-pass (or more passes) is darker; no seam', () => {
  const a = brookSamples(SR, BROOK, seeded(3));
  assert.equal(a.length, Math.round(SR * BROOK.seconds));
  assert.ok(Math.abs(peak(a) - BROOK.level) < 1e-6);
  assert.ok(seamOK(a), 'the default loop wraps with no click');
  const lo = brookSamples(SR, { ...BROOK, lowpass: 400 }, seeded(3)), steep = brookSamples(SR, { ...BROOK, lowpass: 400, passes: 5 }, seeded(3));
  assert.ok(bright(lo) < bright(a) * 0.8 && bright(steep) < bright(lo), 'darker and darker');
  assert.ok(seamOK(lo) && seamOK(steep) && seamOK(brookSamples(SR, { ...BROOK, lowpass: 300, passes: 6, seconds: 4 }, seeded(8))));
  assert.equal(brookSamples(SR, { ...BROOK, seconds: 3 }, seeded(1)).length, 3 * SR);
  assert.deepEqual(brookSamples(SR, BROOK, seeded(9)), brookSamples(SR, BROOK, seeded(9)), 'the same random numbers make the same creek');
});

test('the campfire: crackles and pops (spiky, mostly quiet between), no seam, its level; more crackles = busier', () => {
  for (const s of [5, 9, 21]) {
    const d = fireSamples(SR, FIRE, seeded(s));
    assert.equal(d.length, Math.round(SR * FIRE.seconds));
    assert.ok(Math.abs(peak(d) - FIRE.level) < 1e-6 && peak(d) < 0.98);
    assert.ok(seamOK(d), 'seed ' + s + ': no click at the seam');
    assert.ok(peak(d) / rms(d) > 10, 'clicks, not a steady hiss (a hiss peaks only 3 or 4 times its rms)');
  }
  // a crackle-free, pop-free fire is (nearly) silent: the breath is faint
  const quiet = fireSamples(SR, { ...FIRE, crackles: 0, pops: 0, settles: 0, level: 1 }, seeded(2));
  assert.ok(peak(quiet) <= 1 && rms(quiet) < 0.5);
  const count = (d) => { let n = 0, was = false; const q = peak(d) * 0.05; for (const v of d) { const on = Math.abs(v) > q; if (on && !was) n++; was = on; } return n; };
  assert.ok(count(fireSamples(SR, { ...FIRE, crackles: 200 }, seeded(4))) > count(fireSamples(SR, { ...FIRE, crackles: 30 }, seeded(4))));
});

test("the campfire plays the loop, not the old embers' hiss; the fire's code makes no ringing tones", () => {
  const src = fs.readFileSync(new URL('../src/fire/campfire.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('EMBERS HISS') && !src.includes('playPatch'), 'no hiss drone, no patches');
  assert.match(src, /fireSamples\(/);
  const nat = fs.readFileSync(new URL('../src/audio/nature.js', import.meta.url), 'utf8');
  const fire = nat.slice(nat.indexOf('export function fireSamples'));
  assert.ok(!/Math\.sin\(ph|createOscillator/.test(fire), 'noise only: no sine voices in the fire');
});

test("the Sound Lab's copy of the nature code is the game's", () => {
  const lab = new URL('../../../sound-lab/nature.js', import.meta.url);
  if (!fs.existsSync(lab)) return;
  assert.equal(fs.readFileSync(lab, 'utf8'), fs.readFileSync(new URL('../src/audio/nature.js', import.meta.url), 'utf8'),
    'copy bandit-math/src/audio/nature.js to ~/sound-lab/nature.js');
});
