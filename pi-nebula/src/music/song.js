// THE MUSIC'S SONGS: what a song is, the choices for each of its parts, and the presets. Plain data, no sound, so the
// tests and the control screen can read it. The game's maker, 2026-11-24: "Im thinking about having it more techno
// themed. Maybe have a few screens around the station that interface with it to change the song, or modify the song.
// Such as select the lead, pads, bass, bpm, melodies, beat. But we can have a few presets. Some chill lowfi, some
// Skrillix sounding stuff for Mathball".
//
// A song is a small plain object:
//   { name, bpm, key, scale, swing, seed, beat, bass, pads, lead, melody, tune? }
//     bpm      its speed, beats a minute (BPM.min .. BPM.max)
//     key      the note it is in ('C' .. 'B', sharps as 'C#'); scale: 'minor', 'dorian' (a softer minor) or
//              'mixolydian' (major with the seventh a half step down: the old fiddle tunes')
//     swing    0 .. 0.3: how late the in-between sixteenths come (0 straight; lo-fi a little)
//     seed     a whole number: the same seed gives the same tunes and patterns
//     beat, bass, pads, lead, melody   one of PARTS[part]'s choices, or 'off'
//     tune     (most songs leave it out) a written tune (src/music/tunes.js TUNES): the lead, melody and bass then play
//              its notes, the pads its chords, as the tune's arrangement in patterns.js says, section by section; every
//              part's choice still picks its sound, and Off still silences it
//   PARTS                 the parts, in the screen's order, each { id, label, choices: [{ id, label }] }
//   PRESETS               the presets: [{ id, name, song }]
//   checkSong(s) -> []    what is wrong with a song (empty: it is a good song)
//   cleanSong(s) -> song  a song with anything missing or wrong put right (a kept or pasted one)
//   songText(s)  -> text  the song as one line to paste back into PRESETS ("Copy this song")
//   formOf(s)    -> 'flow' | 'drive' | 'drop' | 'remix'   how its sections go (src/music/patterns.js), from its beat
//                   ('remix': a song with a tune, whatever its beat)
import { tuneOk } from './tunes.js';

export const BPM = { min: 60, max: 180, step: 2 };
export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10] };

export const PARTS = [
  { id: 'beat', label: 'Beat', choices: [
    { id: 'lofi', label: 'Lo-fi' }, { id: 'four', label: 'Four floor' }, { id: 'broken', label: 'Broken' }, { id: 'half', label: 'Half-time' }] },
  { id: 'bass', label: 'Bass', choices: [
    { id: 'warm', label: 'Warm' }, { id: 'pulse', label: 'Pulse' }, { id: 'rolling', label: 'Rolling' }, { id: 'wobble', label: 'Wobble' }, { id: 'ladder', label: 'FM ladder' }] },
  { id: 'pads', label: 'Pads', choices: [
    { id: 'warm', label: 'Warm' }, { id: 'airy', label: 'Airy' }, { id: 'dark', label: 'Dark' }] },
  { id: 'lead', label: 'Lead', choices: [
    { id: 'keys', label: 'Keys' }, { id: 'saw', label: 'Soft saw' }, { id: 'square', label: 'Square' }] },
  { id: 'melody', label: 'Melody', choices: [
    { id: 'arp', label: 'Arp' }, { id: 'bells', label: 'Bells' }, { id: 'echo', label: 'Echo' }] },
];
export const PART_IDS = PARTS.map((p) => p.id);

// the presets: three chill lo-fi, two straight techno for the station, two heavy ones for Mathball (half-time drums at
// a fast speed, a wobbling bass, builds and drops). Every pattern and tune is made from the seed (patterns.js); the
// eighth, the remix, plays a written tune's notes instead (song.tune).
export const PRESETS = [
  { id: 'nightshift', name: 'Night Shift', song: { bpm: 72, key: 'D', scale: 'dorian', swing: 0.18, seed: 11, beat: 'lofi', bass: 'warm', pads: 'warm', lead: 'keys', melody: 'bells' } },
  { id: 'quietorbit', name: 'Quiet Orbit', song: { bpm: 80, key: 'F', scale: 'minor', swing: 0.14, seed: 23, beat: 'lofi', bass: 'warm', pads: 'airy', lead: 'off', melody: 'echo' } },
  { id: 'windowseat', name: 'Window Seat', song: { bpm: 66, key: 'A', scale: 'dorian', swing: 0.2, seed: 5, beat: 'lofi', bass: 'warm', pads: 'dark', lead: 'square', melody: 'echo' } },
  { id: 'stationdrive', name: 'Station Drive', song: { bpm: 124, key: 'A', scale: 'minor', swing: 0, seed: 7, beat: 'four', bass: 'pulse', pads: 'airy', lead: 'saw', melody: 'arp' } },
  { id: 'deephangar', name: 'Deep Hangar', song: { bpm: 128, key: 'E', scale: 'minor', swing: 0, seed: 31, beat: 'broken', bass: 'rolling', pads: 'dark', lead: 'off', melody: 'arp' } },
  { id: 'mathballdrop', name: 'Mathball Drop', song: { bpm: 140, key: 'F', scale: 'minor', swing: 0, seed: 3, beat: 'half', bass: 'wobble', pads: 'dark', lead: 'saw', melody: 'bells' } },
  { id: 'overtime', name: 'Overtime', song: { bpm: 150, key: 'G', scale: 'minor', swing: 0, seed: 19, beat: 'half', bass: 'wobble', pads: 'warm', lead: 'square', melody: 'arp' } },
  // the game's maker, 2026-11-24: "Would you be able to make an "Old Joe Clark Remix"? Using the notes in a techno and
  // innovating way?" The old fiddle tune (src/music/tunes.js) at its own dance speed, in its own key, arranged
  // (patterns.js FORMS.remix): a riff cut from its opening, the tune plain on the lead, its line down on the FM ladder
  // bass under half-time drums, a breakdown on its two chords, a stuttering build, a drop, lead and bass trading bars
  { id: 'joeclarkremix', name: 'Old Joe Clark Remix', song: { bpm: 140, key: 'A', scale: 'mixolydian', swing: 0, seed: 1, beat: 'four', bass: 'ladder', pads: 'airy', lead: 'saw', melody: 'arp', tune: 'joeclark' } },
].map((p) => ({ ...p, song: { name: p.name, ...p.song } }));

export const formOf = (s) => (s.tune ? 'remix' : s.beat === 'half' ? 'drop' : s.beat === 'four' || s.beat === 'broken' ? 'drive' : 'flow');

export function checkSong(s) {
  const bad = [];
  if (!s || typeof s !== 'object') return ['not a song'];
  if (!Number.isFinite(s.bpm) || s.bpm < BPM.min || s.bpm > BPM.max) bad.push('bpm ' + s.bpm);
  if (!KEYS.includes(s.key)) bad.push('key ' + s.key);
  if (!SCALES[s.scale]) bad.push('scale ' + s.scale);
  if (!Number.isFinite(s.swing) || s.swing < 0 || s.swing > 0.3) bad.push('swing ' + s.swing);
  if (!Number.isInteger(s.seed)) bad.push('seed ' + s.seed);
  for (const P of PARTS) if (s[P.id] !== 'off' && !P.choices.some((c) => c.id === s[P.id])) bad.push(P.id + ' ' + s[P.id]);
  if (s.tune != null && !tuneOk(s.tune)) bad.push('tune ' + s.tune);
  return bad;
}

export function cleanSong(s, base = PRESETS[0].song) {
  const o = { ...base };
  if (!s || typeof s !== 'object') return o;
  if (typeof s.name === 'string') o.name = s.name.slice(0, 40);
  if (Number.isFinite(+s.bpm)) o.bpm = Math.max(BPM.min, Math.min(BPM.max, Math.round(+s.bpm)));
  if (KEYS.includes(s.key)) o.key = s.key;
  if (SCALES[s.scale]) o.scale = s.scale;
  if (Number.isFinite(+s.swing)) o.swing = Math.max(0, Math.min(0.3, +s.swing));
  if (Number.isInteger(+s.seed)) o.seed = +s.seed;
  for (const P of PARTS) if (s[P.id] === 'off' || P.choices.some((c) => c.id === s[P.id])) o[P.id] = s[P.id];
  // a tune only when the song names one (a song written without one has none, whatever the base had)
  delete o.tune;
  if (tuneOk(s.tune)) o.tune = s.tune;
  return o;
}

export function songText(s) {
  const q = (v) => "'" + String(v).replace(/'/g, '') + "'";
  return `{ name: ${q(s.name || 'My song')}, bpm: ${s.bpm}, key: ${q(s.key)}, scale: ${q(s.scale)}, swing: ${s.swing}, seed: ${s.seed}, `
    + PART_IDS.map((p) => `${p}: ${q(s[p])}`).join(', ') + (s.tune ? `, tune: ${q(s.tune)}` : '') + ' }';
}
