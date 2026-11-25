// THE MUSIC'S INSTRUMENTS ARE SOUND LAB PATCHES. The game's maker, 2026-11-24: "I thought all my projects used the same
// sound engine as the sound lab. That is how Id prefer it." / "It would be great to put sounds into the sound lab in
// case I want to tweak them." So every drum, bass, pad and lead of the music is a patch (plain data, nodes and cables),
// WRITTEN IN THE SOUND LAB (~/sound-lab/sounds/pi-nebula.js, where each can be opened and tuned by ear) and brought here
// by its script, with the engine that plays them: src/audio/patch.js is made by `node tools/sync.mjs pi-nebula
// <this game's src/audio/patch.js>` and is never edited here. A new sound, or a change to one: there, then sync.
//
// What is the game's own stays in this file: each pitched patch's note (ROOT), which patch each choice on the
// control screen plays (DRUMS, INSTRUMENTS), and the random waves (WAVES, waveTable, patchFor: below).
//
// Pitched patches are written at a C, as the Sound Lab's sequencer instruments are (sound-lab/seq.js), so a note's
// semitones from that C mean what they say: ROOT gives each one's note (MIDI). The bass at C2, the sub under the
// wobble at C1, everything else at C4. Drums have no pitch (their noise is never transposed); the tom has one.
import { PATCH_PRESETS } from '../audio/patch.js';
import { numberOf } from './song.js';

// the patches by their names ('TECHNO — KICK' ...): the Sound Lab's own list for this game
export const TECHNO_PATCHES = PATCH_PRESETS;

// each pitched patch's note (MIDI): the C it is written at
export const ROOT = {
  'TECHNO — TOM': 48,
  'TECHNO — RISER': 60,
  'TECHNO — WARM BASS': 36,
  'TECHNO — PULSE BASS': 36,
  'TECHNO — WOBBLE BASS': 36,
  'TECHNO — FM LADDER BASS': 36,
  'TECHNO — ACID BASS': 36,
  'TECHNO — WARM PAD': 60,
  'TECHNO — AIRY PAD': 60,
  'TECHNO — DARK PAD': 60,
  'TECHNO — GLASS PAD': 60,
  'TECHNO — DRIFT PAD': 60,
  'TECHNO — KEYS': 60,
  'TECHNO — SOFT SAW': 60,
  'TECHNO — SQUARE LEAD': 60,
  'TECHNO — FM HORN': 60,
  'TECHNO — RING LEAD': 60,
  'TECHNO — ARP': 60,
  'TECHNO — BELLS': 60,
  'TECHNO — ECHO PLUCK': 60,
  'TECHNO — CRYSTAL': 60,
  'TECHNO — BLIPS': 60,
  'TECHNO — RANDOM PAD': 60,
  'TECHNO — RANDOM LEAD': 60,
  'TECHNO — RANDOM MELODY': 60,
};

// which patch each choice plays (src/music/song.js PARTS); the beat's drums by the beat chosen
export const DRUMS = {
  lofi: { kick: 'TECHNO — LOFI KICK', snare: 'TECHNO — LOFI SNARE', hat: 'TECHNO — LOFI HAT', open: 'TECHNO — OPEN HAT', clap: 'TECHNO — CLAP', tom: 'TECHNO — TOM', riser: 'TECHNO — RISER' },
  four: { kick: 'TECHNO — KICK', snare: 'TECHNO — SNARE', hat: 'TECHNO — HAT', open: 'TECHNO — OPEN HAT', clap: 'TECHNO — CLAP', tom: 'TECHNO — TOM', riser: 'TECHNO — RISER' },
  broken: { kick: 'TECHNO — KICK', snare: 'TECHNO — SNARE', hat: 'TECHNO — HAT', open: 'TECHNO — OPEN HAT', clap: 'TECHNO — CLAP', tom: 'TECHNO — TOM', riser: 'TECHNO — RISER' },
  half: { kick: 'TECHNO — HEAVY KICK', snare: 'TECHNO — HEAVY SNARE', hat: 'TECHNO — HAT', open: 'TECHNO — OPEN HAT', clap: 'TECHNO — CLAP', tom: 'TECHNO — TOM', riser: 'TECHNO — RISER' },
  twostep: { kick: 'TECHNO — KICK', snare: 'TECHNO — LOFI SNARE', hat: 'TECHNO — HAT', open: 'TECHNO — OPEN HAT', clap: 'TECHNO — CLAP', tom: 'TECHNO — TOM', riser: 'TECHNO — RISER' },
};
export const INSTRUMENTS = {
  bass: { warm: 'TECHNO — WARM BASS', pulse: 'TECHNO — PULSE BASS', wobble: 'TECHNO — WOBBLE BASS', ladder: 'TECHNO — FM LADDER BASS', acid: 'TECHNO — ACID BASS' },
  pads: { warm: 'TECHNO — WARM PAD', airy: 'TECHNO — AIRY PAD', dark: 'TECHNO — DARK PAD', glass: 'TECHNO — GLASS PAD', drift: 'TECHNO — DRIFT PAD', random: 'TECHNO — RANDOM PAD' },
  lead: { keys: 'TECHNO — KEYS', saw: 'TECHNO — SOFT SAW', square: 'TECHNO — SQUARE LEAD', horn: 'TECHNO — FM HORN', ring: 'TECHNO — RING LEAD', random: 'TECHNO — RANDOM LEAD' },
  melody: { arp: 'TECHNO — ARP', bells: 'TECHNO — BELLS', echo: 'TECHNO — ECHO PLUCK', crystal: 'TECHNO — CRYSTAL', blips: 'TECHNO — BLIPS', random: 'TECHNO — RANDOM MELODY' },
};

// ── THE RANDOM WAVES ─────────────────────────────────────────────────────────────────────────────────────────────────
// The game's maker, 2026-11-24: "I wonder if there could be a random button for the leads, pads, and melody that give
// you some variation. That could be cool. I always liked hearing random custom periodic waves". A part on Random
// (src/music/song.js PARTS[part].numbered) plays its base patch (WAVES[part].patch, written in the Sound Lab round one
// custom-wave oscillator, carrying an ordinary table of its own) with the table of the song's number for that part in
// its place (song.wave[part]): the same number, the same wave, on any machine, every time.
//
// A WAVE'S TABLE (waveTable): the overtones' strengths at random, but always listenable:
//   - no constant offset (the first entry 0, as a sound's middle line)
//   - the note itself always there at full strength, so it is heard at its pitch; every overtone a whole multiple of
//     it, so it is in tune
//   - falling away toward the top (each overtone about 1/k^tilt, tilt 0.35 .. 1.15, a random spread on top) and nothing
//     above WAVE_TOP Hz at the part's highest note (WAVES[part].top, the highest its first choice's notes go in any key:
//     ~/pw/space-math/rigs/random-1/top.mjs), the upper half eased off toward that: so as many overtones as fit
//     (pads 12, the lead and the melody 6)
//   - never just a plain sine: at least WAVE_COLOUR (15 %) of its power in the overtones
//   - its own colour: some waves hollow (the even overtones weak, as a square's), some with a hump of louder overtones
//     in the lower half (a vowel-like ring), each overtone at its own random place in the cycle
//   - evened in loudness (waveTrim): the engine plays a table at its peak (the browser scales every custom wave so its
//     highest point is 1), so a wave's level is its overtones' power against its peak, worked out from the table; it
//     is trimmed (the oscillator's level) to the base patch's own table's level
export const WAVE_TOP = 6000;
export const WAVE_COLOUR = 0.15;   // the least share of a wave's power in its overtones
export const WAVE_CAP = 1.6;       // no overtone louder than WAVE_CAP / k^0.8 of the note (k: which overtone): the top never stands out
export const WAVES = {
  pads: { patch: 'TECHNO — RANDOM PAD', top: 71 },
  lead: { patch: 'TECHNO — RANDOM LEAD', top: 81 },
  melody: { patch: 'TECHNO — RANDOM MELODY', top: 81 },
};
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
export const waveHarmonics = (part) => Math.max(2, Math.floor(WAVE_TOP / hz(WAVES[part].top)));
// (the wave's own dice: FNV-1a of its part and number, then a small fast generator; the same on every machine)
function waveDice(part, seed) {
  let h = 2166136261;
  for (const c of 'wave|' + part + '|' + seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r5 = (v) => Math.round(v * 1e5) / 1e5;
export function waveTable(seed, part) {
  const K = waveHarmonics(part), r = waveDice(part, seed);
  const tilt = 0.35 + 0.8 * r();                                  // how fast it falls away
  const evens = r() < 0.35 ? 0.05 + 0.25 * r() : 0.5 + 0.5 * r(); // a third of them hollow
  const bump = 2 + r() * (K / 2 - 1), width = 0.7 + 1.3 * r(), lift = r() < 0.6 ? 0.4 + 1.2 * r() : 0;
  const amp = [0, 1], ph = [0, 2 * Math.PI * r()];
  for (let k = 2; k <= K; k++) {
    const ease = k <= K / 2 ? 1 : Math.pow(Math.cos((Math.PI / 2) * (k - K / 2) / (K / 2 + 1)), 2);
    const a = Math.pow(k, -tilt) * (0.15 + 0.85 * r()) * (k % 2 ? 1 : evens) * (1 + lift * Math.exp(-Math.pow((k - bump) / width, 2))) * ease;
    amp.push(Math.min(WAVE_CAP * Math.pow(k, -0.8), a));   // (no overtone standing out: at most WAVE_CAP / k^0.8)
    ph.push(2 * Math.PI * r());
  }
  // (never all but a plain sine: the overtones at least WAVE_COLOUR of its power; none louder than 0.9 of the note's)
  const over = amp.slice(2).reduce((t, a) => t + a * a, 0), want = WAVE_COLOUR / (1 - WAVE_COLOUR);
  const lift2 = over > 0 && over < want ? Math.sqrt(want / over) : 1;
  const real = [0], imag = [0];
  for (let k = 1; k <= K; k++) {
    const a = k === 1 ? 1 : Math.min(0.9, amp[k] * lift2);
    real.push(r5(a * Math.cos(ph[k]))); imag.push(r5(a * Math.sin(ph[k])));
  }
  return { real, imag };
}
// a table's level as the engine plays it: the power of its overtones against its highest point (the browser scales a
// custom wave to a peak of 1), from 2048 points of one cycle
export function waveLevel({ real, imag }) {
  const N = 2048; let peak = 0, pow = 0;
  for (let k = 1; k < real.length; k++) pow += (real[k] * real[k] + (imag[k] || 0) * (imag[k] || 0)) / 2;
  for (let i = 0; i < N; i++) {
    const w = (2 * Math.PI * i) / N; let x = 0;
    for (let k = 1; k < real.length; k++) x += real[k] * Math.cos(k * w) + (imag[k] || 0) * Math.sin(k * w);
    peak = Math.max(peak, Math.abs(x));
  }
  return peak > 0 ? Math.sqrt(pow) / peak : 0;
}
// the oscillator's level that brings a table to the base patch's own table's level (kept within 1/4 .. 4)
const custom = (patch) => patch.nodes.find((n) => n.type === 'osc' && n.wave === 'custom' && n.harm);
export function waveTrim(harm, part) {
  const base = TECHNO_PATCHES[WAVES[part].patch], o = base && custom(base);
  const L = waveLevel(harm), L0 = o ? waveLevel(o.harm) * (o.level ?? 1) : 0;
  return L > 0 && L0 > 0 ? Math.max(0.25, Math.min(4, L0 / L)) : 1;
}
// the base patch with the table of `seed` in it (its oscillator's table, its level trimmed, its name)
export function wavePatch(seed, part) {
  const base = TECHNO_PATCHES[WAVES[part].patch], o = base && custom(base);
  if (!o) return base || null;
  const harm = waveTable(seed, part), level = r5(waveTrim(harm, part));
  return { ...base, name: base.name + ' ' + seed, nodes: base.nodes.map((n) => (n === o ? { ...n, waveName: 'Random ' + seed, harm, level } : n)) };
}
// THE PATCH TO PLAY for a part of a song (src/music/player.js asks this for every note): the fixed patch of that name,
// or, for a part on Random, its base patch with the song's wave in it: the same object for the same number (the last
// WAVE_KEEP numbers of each part are kept). A part's wave pushed out of those is gone: anyone told (waveGone) lets go of
// what they made of it (the pre-rendered notes, src/music/bake.js).
export const WAVE_KEEP = 2;
const made = { pads: new Map(), lead: new Map(), melody: new Map() }, goneFans = new Set();
export const waveGone = (fn) => { goneFans.add(fn); return () => goneFans.delete(fn); };
export function patchFor(inst, part, song) {
  const W = WAVES[part];
  if (!W || inst !== W.patch || !song) return TECHNO_PATCHES[inst];
  const v = numberOf(song, part);
  if (v == null) return TECHNO_PATCHES[inst];
  const m = made[part];
  let p = m.get(v);
  if (p) { m.delete(v); m.set(v, p); return p; }   // (the newest last)
  p = wavePatch(v, part); m.set(v, p);
  while (m.size > WAVE_KEEP) {
    const [k, old] = m.entries().next().value; m.delete(k);
    for (const f of goneFans) try { f(old); } catch (e) { /* theirs */ }
  }
  return p;
}
