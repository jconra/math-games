// A SONG CAN CARRY A WRITTEN TUNE (src/music/tunes.js; song.tune), and the eighth preset, the Old Joe Clark Remix,
// does. The game's maker, 2026-11-24: "Would you be able to make an "Old Joe Clark Remix"? Using the notes in a techno
// and innovating way?" The tune's notes are all in its key and fill whole bars; the preset is a good song; its main
// section plays the tune plain; every part's choice still picks its sound and Off still silences it; "Copy this song"
// brings the same song back, the tune named in it; and the seven presets that were there play the very same notes.
//   node --test pi-nebula/tests/musictune.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PRESETS, PART_IDS, SCALES, checkSong, cleanSong, songText, formOf } from '../src/music/song.js';
import { barNotes, barBlock, sectionAt, inKey, FORMS, SECTION } from '../src/music/patterns.js';
import { TUNES, tuneBars } from '../src/music/tunes.js';

const REMIX = PRESETS.find((p) => p.id === 'joeclarkremix');
const BARS = SECTION * (1 + FORMS.remix.loop.length * 2);   // (the opening and twice round the loop)
const midiA = (d) => 69 + 12 * Math.floor(d / 7) + SCALES.mixolydian[((d % 7) + 7) % 7];   // (a step in A mixolydian from A4)

test('Old Joe Clark: as written (A mixolydian, A A B B), every bar whole, every note a step of its scale', () => {
  const T = TUNES.joeclark, bars = tuneBars('joeclark');
  assert.equal(T.key, 'A'); assert.equal(T.scale, 'mixolydian'); assert.deepEqual(T.form, ['A', 'A', 'B', 'B']);
  assert.deepEqual(SCALES.mixolydian, [0, 2, 4, 5, 7, 9, 10]);
  for (const part of ['A', 'B']) {
    assert.equal(bars[part].length, 8, part + ': eight bars');
    for (const [i, b] of bars[part].entries()) {
      assert.equal(b.length, 16, `${part} bar ${i + 1} is a whole bar`);
      let at = 0;
      for (const [s, l, d] of b.notes) { assert.ok(s >= at && Number.isInteger(s) && l > 0 && s + l <= 16, `${part} ${i + 1}`); assert.ok(Number.isInteger(d)); at = s + l; }
      for (const [, c] of b.chords) assert.ok(c === 0 || c === -1, 'its two chords: A (0) and G (a step under)');
    }
  }
  // the opening as he would know it: E F# G F# | E D C# (A mixolydian, from A4)
  assert.deepEqual(bars.A[0].notes.map(([, , d]) => midiA(d)), [76, 78, 79, 78]);
  assert.deepEqual(bars.A[1].notes.map(([, , d]) => midiA(d)), [76, 74, 73]);
  assert.deepEqual(bars.A[0].chords, [[0, 0], [8, -1]]);
  for (const p of ['A', 'B']) for (const b of bars[p]) for (const [, , d] of b.notes) assert.ok(inKey(REMIX.song, midiA(d)));
});

test('the remix is a good song: the eighth preset, the tune named, its own speed and key', () => {
  assert.equal(PRESETS.length, 8); assert.equal(PRESETS[7], REMIX);
  assert.equal(REMIX.name, 'Old Joe Clark Remix');
  assert.deepEqual(checkSong(REMIX.song), []);
  assert.equal(REMIX.song.tune, 'joeclark'); assert.equal(formOf(REMIX.song), 'remix');
  assert.deepEqual([REMIX.song.key, REMIX.song.scale, REMIX.song.bpm], ['A', 'mixolydian', 140]);
  for (const P of PRESETS.slice(0, 7)) assert.equal(P.song.tune, undefined, P.name + ' names no tune');
  assert.deepEqual(checkSong({ ...REMIX.song, tune: 'nonesuch' }), ['tune nonesuch']);
});

test('its main section plays the tune plain on the lead, bar for bar; the arrangement goes round its sections', () => {
  const bars = tuneBars('joeclark'), song = REMIX.song, kinds = new Set();
  let seen = 0;
  for (let bar = 0; bar < BARS; bar++) {
    const S = sectionAt(song, bar); kinds.add(S.kind);
    if (S.kind !== 'tune') continue;
    const lead = barNotes(song, bar).notes.filter((n) => n.part === 'lead');
    const want = bars[S.part][S.barIn].notes;
    assert.deepEqual(lead.map((n) => [n.step, n.len, n.midi]), want.map(([s, l, d]) => [s, l, midiA(d)]), `bar ${bar}`);
    seen++;
  }
  assert.equal(seen, 4 * SECTION, 'the A part and the B part, twice round');
  for (const k of ['intro', 'riff', 'tune', 'low', 'breakdown', 'build', 'drop', 'answer']) assert.ok(kinds.has(k), k);
  // the low section: the tune's line on the bass, two octaves under the lead, the drums in half-time (a snare on 3)
  const low = SECTION * (1 + FORMS.remix.loop.findIndex((S) => S.kind === 'low'));
  const n = barNotes(song, low).notes;
  assert.deepEqual(n.filter((x) => x.part === 'bass').map((x) => x.midi), [52, 54, 55, 54]);
  assert.ok(n.some((x) => x.part === 'beat' && x.sound === 'snare' && x.step === 8));
  assert.ok(!n.some((x) => x.part === 'beat' && (x.sound === 'clap' || x.sound === 'snare') && x.step === 4));
  // the build: shorter and shorter cuts, one beat of quiet at its end, into the drop
  const build = SECTION * (1 + FORMS.remix.loop.findIndex((S) => S.kind === 'build'));
  const leads = [0, 2, 4, 6, 7].map((i) => barNotes(song, build + i).notes.filter((x) => x.part === 'lead'));
  assert.ok(leads[4].length > leads[0].length && leads[4].every((x) => x.step < 12));
  assert.equal(sectionAt(song, build + 8).kind, 'drop');
});

test('with the tune: every note in the song\'s key, on whole steps inside its bar, in any key and scale', () => {
  for (const key of ['A', 'C', 'F#']) for (const scale of Object.keys(SCALES)) {
    const s = { ...REMIX.song, key, scale };
    for (let bar = 0; bar < BARS; bar++) for (const n of barNotes(s, bar).notes) {
      assert.ok(Number.isInteger(n.step) && n.step >= 0 && n.step < 16 && n.len > 0 && n.step + n.len <= 16, `${key} ${scale} bar ${bar} ${n.part}`);
      assert.ok(n.vel > 0 && n.vel <= 1);
      if (n.part !== 'beat') for (const m of [].concat(n.midi)) assert.ok(inKey(s, m), `${key} ${scale} bar ${bar}: ${n.part} ${m}`);
    }
  }
});

test('with the tune the controls do what they say: another sound changes only the sound, Off silences, speed only the speed', () => {
  const song = REMIX.song;
  const strip = (notes, part) => notes.filter((n) => n.part === part).map(({ sound, wob, ...n }) => n);
  for (const [part, other] of [['lead', 'square'], ['lead', 'keys'], ['bass', 'pulse'], ['bass', 'warm'], ['bass', 'wobble'], ['melody', 'arp'], ['pads', 'dark']]) {
    let changed = 0;
    for (let bar = 0; bar < BARS; bar++) {
      const a = barNotes(song, bar).notes, b = barNotes({ ...song, [part]: other }, bar).notes;
      if (part !== 'pads') assert.deepEqual(strip(b, part), strip(a, part), `${part} ${other} bar ${bar}: the same notes`);
      for (const p of PART_IDS) if (p !== part) assert.deepEqual(b.filter((x) => x.part === p), a.filter((x) => x.part === p));
      if (b.some((x) => x.part === part)) { assert.ok(b.filter((x) => x.part === part).every((x) => x.sound === other)); changed++; }
    }
    assert.ok(changed > 0);
  }
  for (const p of PART_IDS) for (let bar = 0; bar < BARS; bar++) assert.ok(!barNotes({ ...song, [p]: 'off' }, bar).notes.some((x) => x.part === p), p + ' off');
  for (let bar = 0; bar < BARS; bar += 3) {
    assert.deepEqual(barNotes({ ...song, bpm: 120 }, bar), barNotes(song, bar));
    assert.equal(barBlock({ ...song, bpm: 120 }, bar).bpm, 120);
  }
  // another beat: its own drums, the same arrangement
  for (const beat of ['lofi', 'broken', 'half']) {
    assert.equal(formOf({ ...song, beat }), 'remix');
    const kit = barBlock({ ...song, beat }, 12).tracks.filter((t) => t.part === 'beat').map((t) => t.inst);
    assert.ok(kit.length > 0);
  }
});

test('"Copy this song" brings the remix back, the tune named in it; a song without a tune stays without one', () => {
  const line = songText(REMIX.song);
  assert.match(line, /tune: 'joeclark'/); assert.doesNotMatch(line, /\n/);
  const back = Function('return (' + line + ')')();
  assert.deepEqual(cleanSong(back), REMIX.song);
  assert.deepEqual(cleanSong(back, PRESETS[3].song), REMIX.song);
  // an old preset's text: no tune in it, and none when put right over the remix
  const old = songText(PRESETS[3].song);
  assert.doesNotMatch(old, /tune/);
  assert.deepEqual(cleanSong(Function('return (' + old + ')')(), REMIX.song), PRESETS[3].song);
  assert.equal(cleanSong({ ...REMIX.song, tune: 'nonesuch' }).tune, undefined);
});

// the seven presets as they were before the tune came (the frozen main, 741f17d): the first 32 bars of each (their
// notes, their bars in the sequencer's form) and their copy text, fingerprinted there
// (and the remix, fingerprinted on the frozen main d477978 before the bass's Rolling switch and the new sounds). Deep
// Hangar's bass was the Rolling sound, now the Pulse sound with the Rolling switch on: the same notes at the same times,
// only its sound's name differs, so its text and notes are read back to the old names before they are fingerprinted.
const BEFORE = { nightshift: '2466293856087367', quietorbit: 'c93ddb1298158b61', windowseat: '2ca9ad7f0c3058aa', stationdrive: '0086945980f1f904', deephangar: 'b53218ca7db1e867', mathballdrop: '6973b0cc2826c9a7', overtime: 'c4234dc0075e4f11', joeclarkremix: '12e0439037485419' };
const asBefore = (id, t) => (id !== 'deephangar' ? t : t.replace("bass: 'pulse', ", "bass: 'rolling', ").replace(', roll: true', '')
  .replace(/"part":"bass","sound":"pulse"/g, '"part":"bass","sound":"rolling"').replace(/TECHNO — PULSE BASS/g, 'TECHNO — ROLLING BASS'));
test('the eight presets play the very same notes, bar for bar (Deep Hangar: only its bass sound\'s name differs)', () => {
  for (const [id, want] of Object.entries(BEFORE)) {
    const P = PRESETS.find((p) => p.id === id), h = createHash('sha256');
    h.update(asBefore(id, songText(P.song)));
    for (let b = 0; b < 32; b++) h.update(asBefore(id, JSON.stringify(barNotes(P.song, b)) + JSON.stringify(barBlock(P.song, b))));
    assert.equal(h.digest('hex').slice(0, 16), want, P.name);
  }
  const D = PRESETS.find((p) => p.id === 'deephangar').song;
  assert.equal(D.bass, 'pulse'); assert.equal(D.roll, true);
});
