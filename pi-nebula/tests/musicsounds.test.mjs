// The music's choices (2026-11-24): every row has as many choices as every other, every choice has its patch, its note
// and notes to play, every patch it plays is in the copy synced from the Sound Lab; the fifth beat; the bass's Rolling
// switch (on and off for every bass sound, an old song's bass 'rolling' read as Pulse rolling, the copy text and back).
//   node --test pi-nebula/tests/musicsounds.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PARTS, PRESETS, checkSong, cleanSong, songText } from '../src/music/song.js';
import { barNotes, barBlock } from '../src/music/patterns.js';
import { TECHNO_PATCHES, ROOT, DRUMS, INSTRUMENTS } from '../src/music/patches.js';
import { PATCH_PRESETS } from '../src/audio/patch.js';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const BASE = PRESETS.find((p) => p.id === 'stationdrive').song;
const partOf = (id) => PARTS.find((p) => p.id === id);
const notesOf = (song, part, bars = 48) => { const o = []; for (let b = 0; b < bars; b++) o.push(...barNotes(song, b).notes.filter((n) => n.part === part).map((n) => ({ ...n, bar: b }))); return o; };

test('every row has the same number of choices, each with its patch and its note, and each plays', () => {
  const counts = PARTS.map((P) => P.choices.length);
  assert.ok(counts.every((c) => c === counts[0]), 'the rows: ' + PARTS.map((P) => P.id + ' ' + P.choices.length).join(', '));
  for (const P of PARTS) {
    const ids = P.choices.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, P.id + ': no choice twice');
    for (const c of P.choices) {
      assert.ok(c.label && c.label.length <= 12, `${P.id} ${c.id}: a short label`);
      const kit = P.id === 'beat' ? Object.values(DRUMS[c.id]) : [INSTRUMENTS[P.id][c.id]];
      for (const k of kit) { assert.ok(TECHNO_PATCHES[k], k); if (P.id !== 'beat') assert.ok(Number.isInteger(ROOT[k]), k + ': its note'); }
      // with this choice picked, in a song of each form, the part plays notes and every one is on a patch there is
      for (const song of [BASE, PRESETS[0].song, PRESETS.find((p) => p.id === 'mathballdrop').song]) {
        const s = { ...song, [P.id]: c.id }, n = notesOf(s, P.id);
        assert.ok(n.length > 0, `${P.id} ${c.id} plays in ${song.name}`);
        for (let b = 0; b < 16; b++) for (const tr of barBlock(s, b).tracks) assert.ok(TECHNO_PATCHES[tr.inst], tr.inst);
      }
    }
  }
});

test('every patch the music can play is in the copy synced from the Sound Lab, and only through it', () => {
  const first = read('src/audio/patch.js').split('\n')[0];
  assert.match(first, /MADE BY THE SOUND LAB/);
  assert.equal(TECHNO_PATCHES, PATCH_PRESETS);
  const all = [...Object.values(DRUMS).flatMap((d) => Object.values(d)), ...Object.values(INSTRUMENTS).flatMap((i) => Object.values(i))];
  for (const k of all) assert.ok(PATCH_PRESETS[k], k + ' is in src/audio/patch.js');
  for (const k of Object.keys(ROOT)) assert.ok(PATCH_PRESETS[k], k);
  assert.ok(!all.includes('TECHNO — ROLLING BASS') && !ROOT['TECHNO — ROLLING BASS'], 'nothing plays the rolling bass sound any more');
  assert.ok(!partOf('bass').choices.some((c) => c.id === 'rolling'));
  // a new patch is as lean as a part of the music needs: a pad holds three or four notes at once
  const sources = (k) => PATCH_PRESETS[k].nodes.reduce((a, n) => a + (n.type === 'osc' ? (n.voices || 1) : ['noise', 'env', 'value'].includes(n.type) ? 1 : 0), 0);
  for (const k of Object.values(INSTRUMENTS.pads)) assert.ok(sources(k) <= 4, k + ': ' + sources(k) + ' sources a note');
});

test('the fifth beat, two-step: a pattern of its own on the drums there are', () => {
  const s = { ...PRESETS[0].song, beat: 'twostep' }, others = ['lofi', 'four', 'broken', 'half'];
  const kicks = (song) => { const o = []; for (let b = 8; b < 40; b++) o.push(barNotes(song, b).notes.filter((n) => n.sound === 'kick').map((n) => n.step).join(',')); return o.join('|'); };
  for (const o of others) assert.notEqual(kicks(s), kicks({ ...s, beat: o }), 'not the ' + o + ' beat');
  const full = notesOf(s, 'beat').filter((n) => n.bar >= 8 && n.bar < 16);
  assert.ok(full.some((n) => n.sound === 'snare' && n.step === 4) && full.some((n) => n.sound === 'snare' && n.step === 12), 'snares on two and four');
  assert.ok(!full.filter((n) => n.sound === 'kick').some((n) => n.step === 4), 'no kick on beat two: it skips');
  for (const n of full) assert.ok(n.step >= 0 && n.step + n.len <= 16);
});

test('the bass\'s Rolling switch: on, any bass sound rolls (short sixteenths between the kicks); off, its own way', () => {
  const roll = partOf('bass').switches;
  assert.deepEqual(roll, [{ id: 'roll', label: 'Rolling' }]);
  for (const c of partOf('bass').choices) {
    const off = notesOf({ ...BASE, bass: c.id }, 'bass'), on = notesOf({ ...BASE, bass: c.id, roll: true }, 'bass');
    assert.ok(on.length > 0 && on.every((n) => n.sound === c.id && n.step % 4 !== 0 && n.len < 1), c.id + ' rolling');
    assert.ok(on.every((n) => (c.id === 'wobble' ? n.wob > 0 : n.wob === undefined)), c.id + ': a wobble only on the wobble');
    assert.notDeepEqual(on.map((n) => [n.bar, n.step]), off.map((n) => [n.bar, n.step]), c.id + ': off is its own way');
    for (const b of [8, 9]) for (const tr of barBlock({ ...BASE, bass: c.id, roll: true }, b).tracks) if (tr.part === 'bass') assert.equal(tr.inst, INSTRUMENTS.bass[c.id]);
  }
  // a song with a written tune keeps its own bass line
  const remix = PRESETS.find((p) => p.id === 'joeclarkremix').song;
  assert.deepEqual(notesOf({ ...remix, roll: true }, 'bass', 80), notesOf(remix, 'bass', 80));
});

test('an old song\'s bass "rolling" is the Pulse sound rolling; the switch goes through checking, tidying and the copy text', () => {
  const old = { ...PRESETS.find((p) => p.id === 'deephangar').song, bass: 'rolling' };
  delete old.roll;
  const c = cleanSong(old);
  assert.equal(c.bass, 'pulse'); assert.equal(c.roll, true); assert.deepEqual(checkSong(c), []);
  assert.deepEqual(c, PRESETS.find((p) => p.id === 'deephangar').song);
  // (and played as it is, before it is tidied: the same notes)
  for (let b = 0; b < 24; b++) assert.deepEqual(barNotes(old, b), barNotes(c, b));
  assert.deepEqual(checkSong({ ...BASE, roll: 'yes' }), ['roll yes']);
  assert.deepEqual(checkSong({ ...BASE, roll: false }), []);
  assert.equal(cleanSong({ ...BASE, roll: false }).roll, undefined);
  assert.equal(cleanSong({ ...BASE }, c).roll, undefined, 'a song without the switch stays without it');
  for (const s of [c, { ...BASE, bass: 'acid', roll: true }, BASE]) {
    const line = songText(s), back = Function('return (' + line + ')')();
    assert.equal(/roll: true/.test(line), !!s.roll);
    assert.deepEqual(cleanSong(back), s);
  }
});
