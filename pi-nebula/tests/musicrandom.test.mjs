// The Random button on the Pads, Lead and Melody rows (2026-11-24, the game's maker: "I wonder if there could be a random
// button for the leads, pads, and melody that give you some variation ... I always liked hearing random custom periodic
// waves"): the same number gives the same wave; a wave's rules (falling away, nothing above 6 kHz at the part's top, no
// offset, never a plain sine, its level trimmed); the song's number through checking, tidying and the copy text; a part
// on Random plays its first choice's notes on its random patch; the pre-rendered notes of a wave pushed out let go.
//   node --test pi-nebula/tests/musicrandom.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARTS, PRESETS, WAVE, checkSong, cleanSong, songText, numberOf, numbersOf, freshNumber, playsAs } from '../src/music/song.js';
import { barNotes, barBlock } from '../src/music/patterns.js';
import { TECHNO_PATCHES, ROOT, INSTRUMENTS, WAVES, WAVE_TOP, WAVE_COLOUR, WAVE_KEEP, waveTable, waveLevel, waveTrim, waveHarmonics, wavePatch, patchFor, waveGone } from '../src/music/patches.js';
import { bakery, patchHash } from '../src/music/bake.js';

const BASE = PRESETS.find((p) => p.id === 'stationdrive').song;
const RANDOM = ['pads', 'lead', 'melody'];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const amps = (h) => h.real.map((r, i) => Math.hypot(r, h.imag[i]));

test('only the Pads, Lead and Melody rows have a Random button, declared as the part\'s numbered choice', () => {
  for (const P of PARTS) {
    if (RANDOM.includes(P.id)) assert.deepEqual(P.numbered, { id: 'random', label: 'Random', field: 'wave' }, P.id);
    else assert.equal(P.numbered, undefined, P.id);
    assert.ok(!P.choices.some((c) => c.id === 'random'), P.id + ': Random is not one of the five');
  }
  for (const p of RANDOM) {
    const name = INSTRUMENTS[p].random;
    assert.equal(name, WAVES[p].patch);
    assert.ok(TECHNO_PATCHES[name], name + ' is synced from the Sound Lab');
    assert.equal(ROOT[name], 60);
    const P = TECHNO_PATCHES[name], o = P.nodes.filter((n) => n.type === 'osc');
    assert.equal(o.length, 1, name + ': one oscillator node');
    assert.equal(o[0].wave, 'custom'); assert.ok(o[0].harm.real.length === o[0].harm.imag.length);
    assert.equal(P.group, 'MUSIC'); assert.equal(P.project, 'pi-nebula');
  }
  // the pad is lean: two voices and one envelope a note
  const pad = TECHNO_PATCHES[WAVES.pads.patch];
  assert.equal(pad.nodes.find((n) => n.type === 'osc').voices, 2);
  assert.equal(pad.nodes.filter((n) => n.type === 'env').length, 1);
});

test('the same number gives the same wave, every time; different numbers different waves', () => {
  for (const p of RANDOM) {
    const a = waveTable(4821, p), b = waveTable(4821, p);
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(wavePatch(4821, p)), JSON.stringify(wavePatch(4821, p)));
    // (written down once: the same on any machine)
    const seen = new Set();
    for (let s = 1; s <= 200; s++) seen.add(JSON.stringify(waveTable(s, p)));
    assert.equal(seen.size, 200, p + ': 200 numbers, 200 waves');
  }
  assert.notDeepEqual(waveTable(7, 'pads'), waveTable(7, 'lead'));
});

test('a wave\'s rules: no offset, the note at full strength, falling away, nothing above 6 kHz at the part\'s top, never a plain sine', () => {
  for (const p of RANDOM) {
    const K = waveHarmonics(p);
    assert.ok(K * hz(WAVES[p].top) <= WAVE_TOP && (K + 1) * hz(WAVES[p].top) > WAVE_TOP, p + ': as many overtones as fit under 6 kHz');
    assert.ok(K >= 6, p + ': at least six');
    for (let s = WAVE.min; s <= 2000; s++) {
      const h = waveTable(s, p), a = amps(h);
      assert.equal(h.real[0], 0); assert.equal(h.imag[0], 0);
      assert.equal(h.real.length, K + 1);
      assert.ok(Math.abs(a[1] - 1) < 1e-4, 'the note itself at full strength');
      for (let k = 2; k <= K; k++) assert.ok(a[k] <= 0.9 + 1e-4, `${p} ${s}: overtone ${k} under the note`);
      const pw = a.map((x) => x * x), all = pw.reduce((t, x) => t + x, 0);
      assert.ok(1 - pw[1] / all >= WAVE_COLOUR - 1e-3, `${p} ${s}: overtones ${((1 - pw[1] / all) * 100).toFixed(1)} %`);
      // falling away: the top half of the overtones (above K/2) under 30 % of the wave's power
      const hi = pw.slice(Math.floor(K / 2) + 1).reduce((t, x) => t + x, 0) / all;
      assert.ok(hi < 0.3, `${p} ${s}: falls away (${(hi * 100).toFixed(1)} % in the top half)`);
      assert.ok(a[K] < 0.25, `${p} ${s}: the top overtone small`);
    }
  }
});

test('a wave is trimmed to its base patch\'s level: its level worked out from its table, the same for every number', () => {
  for (const p of RANDOM) {
    const base = TECHNO_PATCHES[WAVES[p].patch].nodes.find((n) => n.wave === 'custom');
    const L0 = waveLevel(base.harm) * (base.level ?? 1);
    for (let s = 1; s <= 300; s++) {
      const P = wavePatch(s, p), o = P.nodes.find((n) => n.wave === 'custom');
      assert.ok(Math.abs(20 * Math.log10((waveLevel(o.harm) * o.level) / L0)) < 0.01, `${p} ${s}`);
      assert.ok(o.level > 0.25 && o.level < 4);
      assert.equal(o.waveName, 'Random ' + s);
      // (everything else as the base patch)
      const B = TECHNO_PATCHES[WAVES[p].patch];
      assert.deepEqual(P.cables, B.cables);
      assert.deepEqual(P.nodes.filter((n) => n.wave !== 'custom'), B.nodes.filter((n) => n.wave !== 'custom'));
    }
    // (a sine's level against a square's, worked out: 1/sqrt2 and 1/sqrt2 times 4/pi... the plain check of waveLevel)
    assert.ok(Math.abs(waveLevel({ real: [0, 0], imag: [0, 1] }) - Math.SQRT1_2) < 1e-6);
    assert.ok(Math.abs(waveTrim(base.harm, p) - 1 / (base.level ?? 1)) < 1e-6 || base.level === 1);
  }
});

test('the song keeps a number for each part on Random: checked, tidied, copied and back', () => {
  const s = { ...BASE, pads: 'random', melody: 'random', wave: { pads: 4821, melody: 17 } };
  assert.deepEqual(checkSong(s), []);
  assert.equal(numberOf(s, 'pads'), 4821); assert.equal(numberOf(s, 'lead'), null); assert.equal(numberOf(s, 'melody'), 17);
  assert.deepEqual(cleanSong(s), s);
  const line = songText(s);
  assert.match(line, /pads: 'random'.*wave: \{ pads: 4821, melody: 17 \} \}$/);
  assert.deepEqual(cleanSong(Function('return (' + line + ')')()), s);
  // a song with no part on Random: no wave in it or its text, as before
  assert.equal(/wave/.test(songText(BASE)), false);
  assert.deepEqual(cleanSong({ ...BASE, wave: { pads: 3 } }, BASE), BASE, 'a number for a part not on Random is dropped');
  // what is wrong
  assert.deepEqual(checkSong({ ...BASE, pads: 'random' }), ['wave pads undefined']);
  assert.deepEqual(checkSong({ ...BASE, pads: 'random', wave: { pads: 0 } }), ['wave pads 0']);
  assert.deepEqual(checkSong({ ...BASE, pads: 'random', wave: { pads: 1.5 } }), ['wave pads 1.5']);
  assert.deepEqual(checkSong({ ...BASE, wave: { pads: 3 } }), ['wave pads 3 (not on Random)']);
  assert.deepEqual(checkSong({ ...BASE, bass: 'random' }), ['bass random']);
  assert.deepEqual(checkSong({ ...BASE, wave: 'x' }), ['wave x']);
  // tidied: a part on Random without a good number gets number 1; Random only where there is one
  assert.deepEqual(cleanSong({ ...BASE, lead: 'random' }).wave, { lead: 1 });
  assert.equal(cleanSong({ ...BASE, beat: 'random' }, BASE).beat, BASE.beat);
  assert.deepEqual(numbersOf({ ...BASE, lead: 'random', wave: { lead: 9999, pads: 4 } }), { wave: { lead: 9999 } });
  // a new number each press, never the one it had
  let n = 5; for (let i = 0; i < 200; i++) { const m = freshNumber(n); assert.ok(m !== n && m >= WAVE.min && m <= WAVE.max && Number.isInteger(m)); n = m; }
  assert.equal(freshNumber(7, () => 6 / 9999), WAVE.min, 'a dice that keeps giving the old number: another one all the same');
});

test('a part on Random plays its first choice\'s notes, on its random patch, the same object for the same number', () => {
  for (const p of RANDOM) {
    const first = PARTS.find((P) => P.id === p).choices[0].id;
    assert.equal(playsAs(p, 'random'), first);
    for (const song of [BASE, PRESETS[0].song, PRESETS.find((x) => x.id === 'mathballdrop').song, PRESETS.find((x) => x.id === 'joeclarkremix').song]) {
      const r = { ...song, [p]: 'random', wave: { [p]: 321 } }, f = { ...song, [p]: first };
      let played = 0;
      for (let b = 0; b < 40; b++) {
        const a = barNotes(r, b).notes.filter((n) => n.part === p), c = barNotes(f, b).notes.filter((n) => n.part === p);
        assert.deepEqual(a.map((n) => ({ ...n, sound: first })), c, `${p} in ${song.name}, bar ${b}`);
        for (const tr of barBlock(r, b).tracks) if (tr.part === p) {
          played += tr.notes.length;
          assert.equal(tr.inst, WAVES[p].patch);
          const P = patchFor(tr.inst, tr.part, r);
          assert.equal(P, patchFor(tr.inst, tr.part, r), 'the same object');
          assert.equal(P.nodes.find((n) => n.wave === 'custom').waveName, 'Random 321');
        }
      }
      assert.ok(played > 0, `${p} plays in ${song.name}`);
    }
  }
  // every other patch as it is
  for (const [k, v] of Object.entries(TECHNO_PATCHES)) assert.equal(patchFor(k, 'pads', BASE), v);
  assert.equal(patchFor(WAVES.pads.patch, 'pads', BASE), TECHNO_PATCHES[WAVES.pads.patch], 'the base patch when the song has no number');
});

test('pressing Random again and again: each part keeps its last few waves, and the pre-rendered notes of the others are let go', () => {
  const gone = [];
  const off = waveGone((p) => gone.push(p.nodes.find((n) => n.wave === 'custom').waveName));
  const noteOf = (patch) => patch;
  const B = bakery(22050, { noteOf, store: false, fresh: true });
  const plans = [];
  for (let s = 1000; s < 1050; s++) {
    const song = { ...BASE, pads: 'random', wave: { pads: s } }, P = patchFor(WAVES.pads.patch, 'pads', song);
    const pl = B.plan(P, { semi: 0, len: 2 });
    plans.push([s, P, pl]);
  }
  off();
  for (let v = 1000; v < 1050 - WAVE_KEEP; v++) assert.ok(gone.includes('Random ' + v), 'every wave pushed out is told: ' + v);
  assert.ok(!gone.includes('Random 1049') && !gone.includes('Random 1048'), 'the last two kept');
  assert.ok(B.stats().forgotten >= 50 - WAVE_KEEP);
  // a forgotten wave's note asked for straight after is not rendered (it plays live)
  const [, oldP, oldPlan] = plans[0];
  const before = B.stats().wanted;
  B.want(oldPlan);
  assert.equal(B.stats().wanted, before, 'not asked for again');
  assert.ok(patchHash(oldP));
});
