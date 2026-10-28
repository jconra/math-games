// THE END OF A SONG: the band's last chord. When a song has gone round enough (src/bandplan.js songLines) the band
// plays to the end of a line (a written tune: the end of a round, where it comes home) and lands together on the
// song's home chord on the next downbeat: the piano's low root and its octave with a soft chord over them, the box's
// thump and a slap at once, and the harmonica's home note held with a note of the chord under it, all ringing out.
// Then the crowd claps (src/audio/applause.js, src/saloonfolk.js) and the band names the next song (src/stage.js).
// The instruments are the band's own Sound Lab patches (src/audio/stagemusic.js), played here a note at a time.
//
//   homeOf(song) -> { name, semi, root, fifth, voicing, harp, under }   a song's home chord: its name as written and
//                     how far the band plays it from there (a written tune's round's last chord; a made-up one's
//                     song.home), the piano's root and fifth (MIDI) and a soft voicing, the harmonica's home note
//                     (a written tune's last note) and the chord's note under it (or null)
//   playEnding(ctx, { harp, piano, box, room, song, at, patches }) -> { at, end, stop() }   the closing chord at ctx
//                     time `at` into the band's own inputs (as makeStageMusic takes them; no box: none); end: when
//                     it has rung out; stop(): lets it go at once (the card asked for another song meanwhile)
//   ENDING            the dials
import { playPatch, PATCH_PRESETS } from './patch.js';
import { pianoNotes, harmonicaNote, boxNote, chordOf, fiddleRound, FIDDLE_TUNES, HARMONICA, PIANO, songOf } from './stagemusic.js';

export const ENDING = {
  bass: { vel: 0.76, len: 2.6 },        // the piano's low root and its octave
  chord: { vel: 0.46, len: 2.3 },       // ... and the soft chord over them
  harp: { len: 2.1, level: 0.95, under: 0.6, release: 1.3 },   // the harmonica's home note (s held), and the note under it
  box: { thump: 0.95, slap: 0.62 },     // the box's last hit: a thump and a slap together
  ring: 3.2,                            // s from the chord until all of it has rung out
  range: [62, 76],                      // the harmonica's notes (MIDI): where its home note is put
};

export function homeOf(song) {
  const S = typeof song === 'string' ? songOf(song) : song, T = FIDDLE_TUNES[S.id];
  let name = S.home || 'G', semi = 0, harp = null;
  if (T) {
    const round = fiddleRound(T), last = round[round.length - 1];
    name = last.chords[last.chords.length - 1].name; semi = T.semi;
    const notes = last.notes.filter((n) => n.midi != null);
    if (notes.length) harp = notes[notes.length - 1].midi + semi;
  }
  // (the home note: the chord's root in the harmonica's range, the one nearest the tune's last note: a tune can end on
  // its fifth, leading round again)
  const C = chordOf(name, semi), pc = C.root % 12, [lo, hi] = ENDING.range, near = harp == null ? 69 : harp;
  harp = null;
  for (let m = lo; m <= hi; m++) if (m % 12 === pc && (harp == null || Math.abs(m - near) < Math.abs(harp - near))) harp = m;
  // the chord's note under the home note (a third to a fourth down), sounded with it
  const pcs = new Set(C.voicing[0].map((m) => m % 12));
  let under = null;
  for (let m = harp - 3; m >= harp - 5; m--) if (pcs.has(((m % 12) + 12) % 12) && m >= lo - 2) { under = m; break; }
  return { name, semi, root: C.root, fifth: C.fifth, voicing: C.voicing[0], harp, under };
}

export function playEnding(ctx, { harp, piano, box = null, room = null, song, at, patches = PATCH_PRESETS } = {}) {
  const H = homeOf(song), E = ENDING, handles = [];
  const add = (h) => { if (h) handles.push(h); };
  for (const p of pianoNotes({ midi: [H.root, H.root + 12], len: E.bass.len, vel: E.bass.vel }, patches[PIANO])) add(playPatch(ctx, null, piano, room, p, null, { at }));
  for (const p of pianoNotes({ midi: H.voicing, len: E.chord.len, vel: E.chord.vel }, patches[PIANO])) add(playPatch(ctx, null, piano, room, p, null, { at: at + 0.012 }));
  if (box) {
    add(playPatch(ctx, null, box, room, boxNote({ hit: 'thump', vel: E.box.thump, tone: 1 }, patches), null, { at }));
    add(playPatch(ctx, null, box, room, boxNote({ hit: 'slap', vel: E.box.slap, tone: 1.02 }, patches), null, { at: at + 0.004 }));
  }
  const note = (midi, level) => harmonicaNote({ midi, len: E.harp.len, level, fresh: true, last: true, bend: 0, style: 'pulse', attack: 0.05, release: E.harp.release }, patches[HARMONICA]);
  add(playPatch(ctx, null, harp, room, note(H.harp, E.harp.level), null, { at }));
  if (H.under != null) add(playPatch(ctx, null, harp, room, note(H.under, E.harp.level * E.harp.under), null, { at }));
  return { at, end: at + E.ring, home: H, stop() { for (const h of handles.splice(0)) try { h.stop(0.03); } catch (e) { /* gone */ } } };
}
