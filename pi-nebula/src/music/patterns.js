// THE MUSIC'S PATTERNS: what every part plays in every bar, made from the song (src/music/song.js) and the bar's number
// alone, so the same song plays the same way every time and the tests can read it. No sound here: src/music/player.js
// turns the notes into sound on the audio clock.
//
// A bar is 16 steps (sixteenth notes). The music goes in sections of 8 bars that come and go (THE FORMS below): parts
// drop out and come back, the last bar of a section has a drum fill, and the heavy songs have builds (a snare roll
// getting quicker under a rising hiss) into drops. After the opening section the sections go round in a loop; each time
// round (a "cycle") the tunes and chords are made afresh from the seed, so ten minutes are not the same two bars.
//
//   barBlock(song, bar) -> the bar in the Sound Lab sequencer's own form (sound-lab/seq.js SONGS):
//       { bpm, bars: 1, beats: 4, div: 4, swing, section, tracks: [{ inst, part, vol, notes: [[step, semi, len, vel]] }] }
//       inst: the patch (src/music/patches.js), semi: semitones from its ROOT; a wobble note has a fifth item
//       { wob } (the wobbles a beat), which the Sound Lab's sequencer would pass over
//   barNotes(song, bar) -> { section, chord, notes: [{ part, sound, step, len, vel, midi? , wob? }] }
//       part   'beat' | 'bass' | 'pads' | 'lead' | 'melody'; sound: the part's choice (or for the beat the drum:
//              'kick' 'snare' 'clap' 'hat' 'open' 'tom' 'riser'); step: where in the bar (0 .. 16); len: steps long
//              (every note ends inside its bar); vel 0..1; midi: the note (pads: `midi` is an array, the chord);
//              wob: the wobble bass's wobbles a beat; (every step a whole sixteenth, as the Sound Lab's
//              sequencer has them)
//   sectionAt(song, bar) -> { kind, mask, number, barIn, cycle, last }
//   FORMS              each form's opening section and its loop of sections; mask: which parts play there
//                      (beat: 0 | 'light' | 'full' | 'build'; the rest 0 or 1)
//   inKey(song, midi) -> true if the note is in the song's key and scale
// Ideas from the Sound Lab's sequencer (sound-lab/seq.js: songs in sections, a lookahead scheduler) and the Mathwood
// band's seeded songs (mathwood-valley/src/stage.js): written afresh here, nothing imported.
import { SCALES, KEYS, formOf } from './song.js';
import { DRUMS, INSTRUMENTS, ROOT } from './patches.js';

export const STEPS = 16, SECTION = 8;

// ── seeded dice ──────────────────────────────────────────────────────────────────────────────────────────────────
function hash(...xs) {
  let h = 2166136261;
  for (const c of xs.join('|')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function dice(...xs) {
  let a = hash(...xs);
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

// ── the forms ────────────────────────────────────────────────────────────────────────────────────────────────────
const M = (beat, bass, pads, lead, melody) => ({ beat, bass, pads, lead, melody });
export const FORMS = {
  // chill: no builds; the beat and the bass rest now and then under the pads
  flow: { intro: { kind: 'intro', mask: M('light', 0, 1, 0, 1) }, loop: [
    { kind: 'a', mask: M('full', 1, 1, 1, 0) },
    { kind: 'b', mask: M('full', 1, 1, 0, 1) },
    { kind: 'rest', mask: M(0, 0, 1, 1, 1) },
    { kind: 'a', mask: M('light', 1, 1, 1, 1) },
    { kind: 'c', mask: M('full', 1, 1, 1, 1) },
    { kind: 'b', mask: M('full', 1, 0, 0, 1) },
  ] },
  // techno for the station: a groove that adds parts, a breakdown, a build back in
  drive: { intro: { kind: 'intro', mask: M('light', 0, 1, 0, 0) }, loop: [
    { kind: 'groove', mask: M('full', 1, 0, 0, 0) },
    { kind: 'main', mask: M('full', 1, 1, 0, 1) },
    { kind: 'peak', mask: M('full', 1, 1, 1, 1) },
    { kind: 'breakdown', mask: M(0, 0, 1, 1, 1) },
    { kind: 'build', mask: M('build', 0, 1, 0, 1) },
    { kind: 'peak', mask: M('full', 1, 1, 1, 1) },
    { kind: 'groove', mask: M('full', 1, 0, 1, 0) },
  ] },
  // heavy, for Mathball: builds and drops
  drop: { intro: { kind: 'intro', mask: M('light', 0, 1, 0, 1) }, loop: [
    { kind: 'build', mask: M('build', 0, 1, 0, 1) },
    { kind: 'drop', mask: M('full', 1, 0, 1, 0) },
    { kind: 'drop', mask: M('full', 1, 0, 0, 1) },
    { kind: 'break', mask: M(0, 0, 1, 1, 1) },
    { kind: 'build', mask: M('build', 0, 1, 1, 1) },
    { kind: 'drop', mask: M('full', 1, 1, 1, 1) },
    { kind: 'calm', mask: M('light', 0, 1, 0, 1) },
  ] },
};

export function sectionAt(song, bar) {
  const F = FORMS[formOf(song)];
  const barIn = bar % SECTION;
  if (bar < SECTION) return { kind: F.intro.kind, mask: F.intro.mask, number: 0, barIn, cycle: 0, last: barIn === SECTION - 1 };
  const k = Math.floor((bar - SECTION) / SECTION), S = F.loop[k % F.loop.length];
  return { kind: S.kind, mask: S.mask, number: k + 1, barIn, cycle: Math.floor(k / F.loop.length), last: barIn === SECTION - 1 };
}

// ── the key ──────────────────────────────────────────────────────────────────────────────────────────────────────
const tonicOf = (song) => 48 + KEYS.indexOf(song.key);                      // C3 .. B3
const degMidi = (song, T, d) => { const sc = SCALES[song.scale], o = Math.floor(d / 7); return T + 12 * o + sc[((d % 7) + 7) % 7]; };
export const inKey = (song, midi) => SCALES[song.scale].includes((((midi - tonicOf(song)) % 12) + 12) % 12);
// (a note moved by octaves into [lo, lo + 12))
const into = (m, lo) => { while (m < lo) m += 12; while (m >= lo + 12) m -= 12; return m; };

// the chords: four a phrase (scale steps from the key's note), one a bar (two a bar in a drop)
const PROGS = {
  flow: [[0, 5, 3, 4], [0, 3, 6, 5], [5, 3, 0, 4], [0, 6, 5, 3], [3, 4, 0, 0], [0, 2, 3, 6]],
  drive: [[0, 0, 5, 6], [0, 5, 3, 4], [0, 3, 0, 6], [5, 6, 0, 0]],
  drop: [[0, 5, 6, 4], [0, 0, 5, 6], [0, 3, 5, 4], [5, 3, 0, 6]],
};
function chordAt(song, S, bar) {
  const form = formOf(song), r = dice(song.seed, 'prog', form, S.kind, S.cycle % 3);
  const prog = pick(r, PROGS[form]);
  const i = form === 'drop' ? Math.floor(S.barIn / 2) % 4 : S.barIn % 4;
  const root = prog[i];
  return { root, tones: form === 'flow' ? [root, root + 2, root + 4, root + 6] : [root, root + 2, root + 4] };
}

// ── the parts ────────────────────────────────────────────────────────────────────────────────────────────────────
function beatOf(song, S, bar, choice) {
  const out = [], m = S.mask.beat, r = dice(song.seed, 'beat', bar), hit = (sound, step, len, vel, more) => out.push({ part: 'beat', sound, step, len: Math.min(len, 16 - step), vel, ...more });
  if (m === 'build') {
    // a snare roll that gets quicker (quarters, eighths, sixteenths), a hiss rising through the second half, and one
    // beat of quiet before the drop
    const every = S.barIn < 4 ? 4 : S.barIn < 6 ? 2 : 1, end = S.barIn === 7 ? 12 : 16;
    for (let s = 0; s < end; s += every) hit('snare', s, 1, 0.22 + 0.05 * S.barIn + 0.1 * (s / 16));
    if (S.barIn < 4) for (let s = 0; s < 16; s += 4) hit('kick', s, 3, 0.55);
    for (let s = 2; s < end; s += 4) hit('hat', s, 1, 0.25);
    if (S.barIn >= 4) hit('riser', 0, end, 0.4 + 0.15 * (S.barIn - 4), { midi: 60 + 9 * (S.barIn - 4) });
    return out;
  }
  const full = m === 'full', fill = S.last && song.beat !== 'off';
  const upto = fill ? 12 : 16;
  if (choice === 'lofi') {
    const extra = pick(dice(song.seed, 'lofik', S.kind, S.cycle), [7, 10, 11, 14]);
    hit('kick', 0, 4, 0.85);
    if (full) { if (extra < upto) hit('kick', extra, 2, 0.6); if (10 < upto && extra !== 10) hit('kick', 10, 2, 0.7); hit('snare', 4, 2, 0.7); if (12 < upto) hit('snare', 12, 2, 0.72); }
    for (let s = 0; s < upto; s += 2) hit('hat', s, 1, (s % 4 ? 0.32 : 0.48) * (0.85 + 0.3 * r()));
    if (full && r() < 0.5) hit('hat', 7, 1, 0.2);
  } else if (choice === 'four') {
    for (let s = 0; s < upto; s += 4) hit('kick', s, 3, 0.9);
    for (let s = 2; s < upto; s += 4) hit(full ? 'open' : 'hat', s, 2, full ? 0.38 : 0.34);
    if (full) { hit('clap', 4, 2, 0.6); if (12 < upto) hit('clap', 12, 2, 0.6); for (let s = 1; s < upto; s += 2) if (r() < 0.6) hit('hat', s, 1, 0.16 + 0.1 * r()); }
  } else if (choice === 'broken') {
    const ks = pick(dice(song.seed, 'brk', S.kind, S.cycle), [[0, 6, 10], [0, 3, 10], [0, 7, 10, 14], [0, 6, 11]]);
    for (const s of ks) if (s < upto && (full || s === 0 || s === 10)) hit('kick', s, 3, s ? 0.75 : 0.9);
    if (full) { hit('snare', 4, 2, 0.65); if (12 < upto) hit('snare', 12, 2, 0.68); }
    for (let s = 0; s < upto; s++) hit('hat', s, 1, (s % 4 === 2 ? 0.34 : s % 2 ? 0.14 : 0.24) * (0.85 + 0.3 * r()));
  } else if (choice === 'half') {
    // half-time: the snare on the third beat only, a fast speed's hats around it
    const ks = pick(dice(song.seed, 'half', S.kind, S.cycle), [[0, 10], [0, 3, 10], [0, 6, 11], [0, 10, 14]]);
    for (const s of ks) if (s < upto && (full || s === 0)) hit('kick', s, 3, 0.95);
    if (full) { hit('snare', 8, 4, 0.85); hit('clap', 8, 2, 0.4); }
    for (let s = 0; s < upto; s += 2) hit('hat', s, 1, s % 4 ? 0.3 : 0.2);
    if (full && !fill && S.barIn % 4 === 3) { hit('hat', 13, 1, 0.22); hit('hat', 15, 1, 0.28); }
  }
  if (fill) {
    if (choice === 'lofi') { const T = tonicOf(song) - 12; [[12, 0], [13, -3], [14, -5], [15, -7]].forEach(([s, d], i) => hit('tom', s, 1, 0.45 + 0.08 * i, { midi: T + d })); }
    else [12, 13, 14, 15].forEach((s, i) => hit('snare', s, 1, 0.35 + 0.1 * i));
  }
  return out;
}

function bassOf(song, S, bar, choice, chord) {
  const out = [], T = tonicOf(song), lo = T - 17;   // (G1 .. F#2 for the key's note)
  const root = into(degMidi(song, T, chord.root), lo), fifth = into(degMidi(song, T, chord.root + 4), lo);
  const note = (step, len, midi, vel, more) => out.push({ part: 'bass', sound: choice, step, len, midi, vel, ...more });
  const r = dice(song.seed, 'bass', S.kind, S.cycle, S.barIn % 4);
  if (choice === 'warm') {
    const t = pick(r, [[[0, 7], [10, 5]], [[0, 6], [6, 2], [8, 7]], [[0, 10], [11, 4]], [[0, 3], [3, 4], [10, 5]]]);
    t.forEach(([s, l], i) => note(s, l, i === t.length - 1 && r() < 0.4 ? fifth : root, 0.8));
  } else if (choice === 'pulse') {
    for (let s = 2; s < 16; s += 4) note(s, 1.6, root, 0.8);
    if (r() < 0.5) note(15, 1, fifth, 0.5);
  } else if (choice === 'rolling') {
    for (let s = 0; s < 16; s++) if (s % 4) note(s, 0.8, s % 4 === 3 && r() < 0.3 ? root + 12 : root, s % 4 === 2 ? 0.8 : 0.6);
  } else if (choice === 'wobble') {
    // long growling notes, each wobbling at its own speed (wobbles a beat); the key's note mostly, now and then the
    // fifth or the note under it
    const t = pick(r, [[[0, 3, 1], [3, 3, 2], [6, 2, 4], [8, 6, 1.5], [14, 2, 4]], [[0, 6, 2], [6, 2, 4], [8, 4, 1], [12, 4, 3]], [[0, 4, 1], [4, 4, 2], [8, 3, 3], [11, 5, 1.5]]]);
    t.forEach(([s, l, w], i) => note(s, l, i === 2 && r() < 0.5 ? fifth - 12 : root, 0.85, { wob: w }));
  } else if (choice === 'ladder') {
    // short plucked notes round the beat, some an octave up (each is [step, length, octave up]); the last now and then
    // the fifth
    const t = pick(r, [[[0, 2, 0], [3, 2, 0], [6, 2, 1], [8, 2, 0], [11, 2, 0], [14, 2, 1]], [[0, 3, 0], [4, 2, 1], [6, 2, 0], [10, 2, 0], [12, 2, 1], [14, 2, 0]], [[2, 2, 0], [4, 2, 0], [7, 2, 1], [10, 2, 0], [12, 2, 0], [15, 1, 1]]]);
    t.forEach(([s, l, up], i) => note(s, l, (i === t.length - 1 && r() < 0.35 ? fifth : root) + 12 * up, up ? 0.7 : 0.85));
  }
  return out;
}

function padsOf(song, S, choice, chord) {
  const T = tonicOf(song), lo = choice === 'airy' ? T + 7 : choice === 'dark' ? T - 3 : T + 2;
  return [{ part: 'pads', sound: choice, step: 0, len: 16, vel: 0.7, midi: chord.tones.map((d) => into(degMidi(song, T, d), lo)).sort((a, b) => a - b) }];
}

// the lead: a four-bar phrase of longer notes, said twice in a section with a different ending
const LEAD_RHYTHMS = {
  flow: [[[0, 4], [6, 2], [8, 6]], [[2, 2], [4, 4], [10, 4]], [[0, 6], [8, 3], [12, 3]], [[4, 3], [8, 2], [10, 6]]],
  fast: [[[0, 2], [3, 2], [6, 2], [8, 4]], [[0, 3], [4, 2], [8, 2], [10, 4]], [[0, 6], [8, 2], [10, 2], [12, 3]], [[2, 2], [4, 4], [10, 2], [12, 2]]],
};
const CHORD_STEPS = [0, 2, 4, 7], ANY_STEPS = [0, 1, 2, 3, 4, 5, 7];
function lineOf(song, S, chord, part, choice, lo, rhythms) {
  const T = tonicOf(song), out = [];
  const phraseBar = S.barIn % 4, ending = phraseBar === 3 ? S.barIn : phraseBar;   // (the 4th bar of each phrase its own)
  const r = dice(song.seed, part, S.kind, S.cycle, ending);
  const t = pick(r, rhythms);
  t.forEach(([s, l], i) => {
    const strong = s % 4 === 0, last = phraseBar === 3 && i === t.length - 1;
    const off = last ? 0 : pick(r, strong ? CHORD_STEPS : ANY_STEPS);
    out.push({ part, sound: choice, step: s, len: l, vel: strong ? 0.75 : 0.6, midi: into(degMidi(song, T, chord.root + off), lo) });
  });
  return out;
}

function melodyOf(song, S, choice, chord) {
  const T = tonicOf(song), out = [], form = formOf(song);
  const r = dice(song.seed, 'mel', choice, S.kind, S.cycle, S.barIn % 4 === 3 ? S.barIn : S.barIn % 2);
  const tones = chord.tones.slice(0, 3).concat(chord.root + 7);
  if (choice === 'arp') {
    const order = pick(r, [[0, 1, 2, 3], [0, 2, 1, 3, 2, 1], [3, 2, 1, 0], [0, 1, 2, 3, 2, 1], [0, 2, 3, 1]]);
    const every = form === 'drive' ? 1 : 2, gaps = pick(r, [[], [7], [3, 11], [6, 14]]);
    for (let s = 0, i = 0; s < 16; s += every, i++) if (!gaps.includes(s)) out.push({ part: 'melody', sound: choice, step: s, len: every, vel: s % 4 ? 0.5 : 0.65, midi: into(degMidi(song, T, tones[order[i % order.length]]), T + 12) });
  } else if (choice === 'bells') {
    const at = pick(r, [[0, 6, 10], [2, 8, 12, 14], [0, 3, 8], [4, 10, 14]]);
    for (const s of at) out.push({ part: 'melody', sound: choice, step: s, len: Math.min(4, 16 - s), vel: 0.6, midi: into(degMidi(song, T, pick(r, tones)), T + 19) });
  } else if (choice === 'echo') {
    const at = pick(r, [[0, 3], [2, 6, 10], [0, 7, 12], [4, 11]]);
    for (const s of at) out.push({ part: 'melody', sound: choice, step: s, len: Math.min(2, 16 - s), vel: 0.6, midi: into(degMidi(song, T, pick(r, tones)), T + 12) });
  }
  return out;
}

export function barNotes(song, bar) {
  const S = sectionAt(song, bar), chord = chordAt(song, S, bar), notes = [];
  const on = (p) => song[p] && song[p] !== 'off' && S.mask[p];
  const fast = formOf(song) !== 'flow';
  if (on('beat')) notes.push(...beatOf(song, S, bar, song.beat));
  if (on('bass')) notes.push(...bassOf(song, S, bar, song.bass, chord));
  if (on('pads')) notes.push(...padsOf(song, S, song.pads, chord));
  if (on('lead')) notes.push(...lineOf(song, S, chord, 'lead', song.lead, tonicOf(song) + 10, LEAD_RHYTHMS[fast ? 'fast' : 'flow']));
  if (on('melody')) notes.push(...melodyOf(song, S, song.melody, chord));
  return { section: S, chord, notes };
}

// the bar as the Sound Lab's sequencer writes a song: one track a patch, its notes [step, semi, len, vel]
export function barBlock(song, bar) {
  const { section, notes } = barNotes(song, bar), byInst = new Map();
  for (const n of notes) {
    const inst = n.part === 'beat' ? DRUMS[song.beat][n.sound] : INSTRUMENTS[n.part][n.sound];
    let tr = byInst.get(inst);
    if (!tr) byInst.set(inst, tr = { inst, part: n.part, vol: 1, notes: [] });
    const midis = Array.isArray(n.midi) ? n.midi : [n.midi];
    for (const m of midis) {
      const semi = m == null || ROOT[inst] == null ? 0 : m - ROOT[inst];
      tr.notes.push(n.wob ? [n.step, semi, n.len, n.vel, { wob: n.wob }] : [n.step, semi, n.len, n.vel]);
    }
  }
  return { bpm: song.bpm, bars: 1, beats: 4, div: 4, swing: song.swing, section, tracks: [...byInst.values()] };
}
