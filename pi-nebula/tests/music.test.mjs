// THE MUSIC (src/music/; the game's maker, 2026-11-24: "Im thinking about having it more techno themed ... select the
// lead, pads, bass, bpm, melodies, beat. But we can have a few presets"): the parts' patterns are the same for the same
// seed, stay in their key and fill whole bars; every preset is a good song; a part switched off makes no notes; every
// instrument is a Sound Lab patch played by the game's copy of the Sound Lab's engine. No browser: plain data.
//   node --test pi-nebula/tests/music.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PARTS, PART_IDS, PRESETS, checkSong, cleanSong, songText, formOf } from '../src/music/song.js';
import { barNotes, barBlock, sectionAt, inKey, FORMS, SECTION } from '../src/music/patterns.js';
import { TECHNO_PATCHES, ROOT, DRUMS, INSTRUMENTS } from '../src/music/patches.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const BARS = 160;   // (past two times round every form's loop)

test('every preset is a good song, with a plain name; two or three lo-fi, techno, and heavy ones for Mathball', () => {
  assert.ok(PRESETS.length >= 6);
  for (const P of PRESETS) { assert.deepEqual(checkSong(P.song), [], P.name); assert.ok(P.name && P.song.name === P.name); }
  const forms = PRESETS.map((P) => formOf(P.song));
  assert.ok(forms.filter((f) => f === 'flow').length >= 2 && forms.filter((f) => f === 'drive').length >= 1 && forms.filter((f) => f === 'drop').length >= 2);
  // the heavy ones: half-time drums at a fast speed and a wobbling bass
  for (const P of PRESETS.filter((p) => formOf(p.song) === 'drop')) { assert.equal(P.song.beat, 'half'); assert.equal(P.song.bass, 'wobble'); assert.ok(P.song.bpm >= 135); }
  for (const P of PRESETS.filter((p) => formOf(p.song) === 'flow')) { assert.ok(P.song.bpm <= 90 && P.song.swing > 0, P.name + ': slow, a little swing'); }
});

test('the same seed plays the same notes; another seed plays others', () => {
  for (const P of PRESETS) {
    for (let bar = 0; bar < BARS; bar += 7) assert.deepEqual(barNotes(P.song, bar), barNotes({ ...P.song }, bar));
    const other = { ...P.song, seed: P.song.seed + 1000 };
    let differ = 0; for (let bar = 0; bar < BARS; bar++) if (JSON.stringify(barNotes(P.song, bar).notes) !== JSON.stringify(barNotes(other, bar).notes)) differ++;
    assert.ok(differ > BARS / 4, P.name + ': a new seed changes the tunes');
  }
});

test('every pitched note is in the song\'s key; every note starts on a whole step and ends inside its bar', () => {
  for (const P of PRESETS) for (const key of ['C', 'F#', 'A#']) for (const scale of ['minor', 'dorian']) {
    const s = { ...P.song, key, scale };
    for (let bar = 0; bar < BARS; bar++) for (const n of barNotes(s, bar).notes) {
      assert.ok(Number.isInteger(n.step) && n.step >= 0 && n.step < 16, `${P.name} bar ${bar}: step ${n.step}`);
      assert.ok(n.len > 0 && n.step + n.len <= 16 + 1e-9, `${P.name} bar ${bar}: ${n.part} ${n.step}+${n.len}`);
      assert.ok(n.vel > 0 && n.vel <= 1);
      if (n.part !== 'beat') for (const m of [].concat(n.midi)) assert.ok(inKey(s, m), `${P.name} ${key} ${scale} bar ${bar}: ${n.part} ${m}`);
    }
  }
});

test('the sections come and go: parts drop out and come back, fills end sections, the heavy songs build into drops', () => {
  for (const P of PRESETS) {
    const kinds = new Set(), out = Object.fromEntries(PART_IDS.map((p) => [p, 0]));
    let fills = 0;
    for (let bar = 0; bar < BARS; bar++) {
      const { section, notes } = barNotes(P.song, bar); kinds.add(section.kind);
      for (const p of PART_IDS) if (P.song[p] !== 'off' && !notes.some((n) => n.part === p)) out[p]++;
      if (section.last && section.mask.beat && section.mask.beat !== 'build' && notes.some((n) => n.part === 'beat' && (n.sound === 'tom' || (n.sound === 'snare' && n.step === 15)))) fills++;
    }
    assert.ok(kinds.size >= 4, P.name + ': four kinds of section or more');
    for (const p of PART_IDS) if (P.song[p] !== 'off') assert.ok(out[p] > 0 && out[p] < BARS, `${P.name}: ${p} rests some bars and plays others`);
    assert.ok(fills >= 4, P.name + ': drum fills');
    if (formOf(P.song) === 'drop') {
      const b = FORMS.drop.loop.findIndex((S) => S.kind === 'build');
      const bar = SECTION + b * SECTION, buildNotes = barNotes(P.song, bar + 7).notes;
      assert.ok(buildNotes.some((n) => n.sound === 'riser') && buildNotes.filter((n) => n.sound === 'snare').length >= 10, 'the build\'s last bar: a riser and a fast roll');
      assert.equal(sectionAt(P.song, bar + 8).kind, 'drop');
    }
  }
});

test('a part switched off makes no notes', () => {
  for (const P of PRESETS) for (const p of PART_IDS) {
    const s = { ...P.song, [p]: 'off' };
    for (let bar = 0; bar < BARS; bar++) assert.ok(!barNotes(s, bar).notes.some((n) => n.part === p), `${P.name} ${p} off, bar ${bar}`);
  }
  const silent = { ...PRESETS[0].song, ...Object.fromEntries(PART_IDS.map((p) => [p, 'off'])) };
  for (let bar = 0; bar < 40; bar++) assert.equal(barBlock(silent, bar).tracks.length, 0);
});

test('every choice of every part plays a patch in the Sound Lab\'s form; the bars are written in its sequencer\'s form', () => {
  const ids = (P) => new Set(P.nodes.map((n) => n.id));
  for (const [key, P] of Object.entries(TECHNO_PATCHES)) {
    assert.match(key, /^TECHNO — [A-Z ]+$/);
    assert.equal(P.group, 'MUSIC'); assert.equal(P.project, 'pi-nebula'); assert.ok(P.name && P.kind && P.dur > 0);
    const I = ids(P);
    assert.ok(P.nodes.some((n) => n.type === 'out') && P.nodes.some((n) => n.type === 'env'), key + ': an output, and an envelope (so every note ends)');
    for (const c of P.cables) assert.ok(I.has(c.from) && I.has(c.to), `${key}: ${c.from} -> ${c.to}`);
    for (const n of P.nodes) assert.ok(['osc', 'noise', 'filter', 'gain', 'shaper', 'delay', 'env', 'value', 'math', 'send', 'out'].includes(n.type), key + ': ' + n.type);
  }
  for (const P of PARTS) for (const c of P.choices) {
    if (P.id === 'beat') for (const k of Object.values(DRUMS[c.id])) assert.ok(TECHNO_PATCHES[k], k);
    else { assert.ok(TECHNO_PATCHES[INSTRUMENTS[P.id][c.id]], P.id + ' ' + c.id); assert.ok(ROOT[INSTRUMENTS[P.id][c.id]] != null); }
  }
  for (const P of PRESETS) for (let bar = 0; bar < 48; bar++) {
    const B = barBlock(P.song, bar);
    assert.deepEqual([B.bars, B.beats, B.div, B.bpm], [1, 4, 4, P.song.bpm]);
    for (const tr of B.tracks) { assert.ok(TECHNO_PATCHES[tr.inst]); for (const n of tr.notes) assert.ok(Number.isInteger(n[0]) && Number.isFinite(n[1]) && n[2] > 0 && n[3] > 0); }
  }
});

test('one engine: the music plays only Sound Lab patches through src/audio/patch.js (no oscillators of its own)', () => {
  for (const f of ['src/music/player.js', 'src/music/patterns.js', 'src/music/patches.js', 'src/music/song.js', 'src/music/screen.js']) {
    const code = read(f).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    assert.doesNotMatch(code, /createOscillator|createBufferSource|createConstantSource/, f);
    assert.doesNotMatch(code, /from '\.\.\/\.\.\/\.\.\//, f + ': nothing from outside pi-nebula');
  }
  const eng = read('src/audio/patch.js');
  assert.match(eng, /export function playPatch/); assert.match(eng, /export function voicePatch/);
});

test('a kept or pasted song is put right; "Copy this song" gives one line that reads back as the same song', () => {
  const s = PRESETS[3].song;
  const line = songText(s);
  assert.doesNotMatch(line, /\n/);
  const back = Function('return (' + line + ')')();
  assert.deepEqual(cleanSong(back), s);
  assert.deepEqual(cleanSong({ bpm: 999, beat: 'bogus', lead: 'off' }, s), { ...s, bpm: 180, lead: 'off' });
  assert.doesNotMatch(line, /quarters|hangar|reverb/i, 'the place it is heard in is not part of the song');
});
