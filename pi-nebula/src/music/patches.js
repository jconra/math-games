// THE MUSIC'S INSTRUMENTS ARE SOUND LAB PATCHES. The game's maker, 2026-11-24: "I thought all my projects used the same
// sound engine as the sound lab. That is how Id prefer it." / "It would be great to put sounds into the sound lab in
// case I want to tweak them." So every drum, bass, pad and lead of the music is a patch (plain data, nodes and cables),
// WRITTEN IN THE SOUND LAB (~/sound-lab/sounds/pi-nebula.js, where each can be opened and tuned by ear) and brought here
// by its script, with the engine that plays them: src/audio/patch.js is made by `node tools/sync.mjs pi-nebula
// <this game's src/audio/patch.js>` and is never edited here. A new sound, or a change to one: there, then sync.
//
// What is the game's own stays in this file: each pitched patch's note (ROOT), and which patch each choice on the
// control screen plays (DRUMS, INSTRUMENTS).
//
// Pitched patches are written at a C, as the Sound Lab's sequencer instruments are (sound-lab/seq.js), so a note's
// semitones from that C mean what they say: ROOT gives each one's note (MIDI). The bass at C2, the sub under the
// wobble at C1, everything else at C4. Drums have no pitch (their noise is never transposed); the tom has one.
import { PATCH_PRESETS } from '../audio/patch.js';

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
  pads: { warm: 'TECHNO — WARM PAD', airy: 'TECHNO — AIRY PAD', dark: 'TECHNO — DARK PAD', glass: 'TECHNO — GLASS PAD', drift: 'TECHNO — DRIFT PAD' },
  lead: { keys: 'TECHNO — KEYS', saw: 'TECHNO — SOFT SAW', square: 'TECHNO — SQUARE LEAD', horn: 'TECHNO — FM HORN', ring: 'TECHNO — RING LEAD' },
  melody: { arp: 'TECHNO — ARP', bells: 'TECHNO — BELLS', echo: 'TECHNO — ECHO PLUCK', crystal: 'TECHNO — CRYSTAL', blips: 'TECHNO — BLIPS' },
};
