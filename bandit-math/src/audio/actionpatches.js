// THE ACTION MUSIC'S INSTRUMENTS, as Sound Lab patches (the same plain data ~/sound-lab/patch.js plays: nodes and the
// cables between them). The same patches are in the Sound Lab's MUSIC group, so they can be tuned there by ear: after
// a change, export the patch and paste it over the one here (or copy the lab's patch.js over src/audio/patch.js: the
// game plays a preset of the same name from there first, see actionmusic.js patchOf).
//
//   GALLOP — the "DUM" of the galloping da-da-DUM: a low tom (a sine that drops in pitch) and a felt thump
//   RIM    — the "da": a short knock on the drum's rim (noise through a narrow band, a hint of wood)
//   BIG DRUM — the hit on a catch: a deep drum with a long boom
//   WHIP   — a whip crack: a very short bright snap with a falling chirp, then a little air
//   TWANG  — a twangy plucked guitar: a burst of noise into a delay whose length is one period of the note, fed back on
//            itself (a plucked string: the echo repeating hundreds of times a second IS the pitch), the game setting the
//            delay's time per note (1 / the note's frequency). Under it a "wire" (a saw and a square at the note) through
//            a resonant filter that sweeps down from bright to dark: the twang, and the ring after the pluck. (The delay's
//            feedback stays at 0.85: its built-in damping filter lifts a little near its cutoff, and from about 0.89 the
//            loop runs away and the filter breaks; the wire gives the ring a stronger feedback would have.) Web Audio
//            can't loop a delay shorter than about 3 ms, so the guitar plays from E2 to E4 (330 Hz): the low, baritone
//            twang of a western guitar
//   WHISTLE — a whistled melody: a near-pure tone with a slow vibrato that grows in, a scoop up into each note, a
//            breath of air
//   BASS   — a plucked low bass (a triangle and a soft saw, darkened, fading)
// Written pitches: TWANG at E3, WHISTLE at E6, BASS at E2 (MIDI 52, 88, 40).
export const ACTION_PATCHES = {
  'ACTION — GALLOP': {
    name: 'Gallop drum', group: 'MUSIC', kind: 'perc', dur: 0.5,
    nodes: [
      { id: 'body', type: 'osc', name: 'tom', wave: 'sine', freq: 92, freqMod: 70 },
      { id: 'pit', type: 'env', name: 'pitch drop', peak: 1, attack: 0.001, decay: 0.07, sustain: 0 },
      { id: 'amp', type: 'env', name: 'tom', peak: 1, attack: 0.002, decay: 0.3, sustain: 0 },
      { id: 'vca', type: 'gain', name: 'tom', gain: 0 },
      { id: 'felt', type: 'noise', name: 'felt', freq: 600, steps: 256, rate: 1, loopLen: 0.4 },
      { id: 'felt-f', type: 'filter', name: 'felt', ftype: 'bandpass', freq: 260, Q: 1.2 },
      { id: 'felt-e', type: 'env', name: 'felt', peak: 0.5, attack: 0.001, decay: 0.05, sustain: 0 },
      { id: 'felt-v', type: 'gain', name: 'felt', gain: 0 },
      { id: 'mix', type: 'gain', name: 'mix', gain: 1 },
      { id: 'send', type: 'send', name: 'room', gain: 0.05 },
      { id: 'out', type: 'out', name: 'output', gain: 0.55 },
    ],
    cables: [
      { from: 'pit', to: 'body', port: 'freq' }, { from: 'body', to: 'vca' }, { from: 'amp', to: 'vca', port: 'gain' }, { from: 'vca', to: 'mix' },
      { from: 'felt', to: 'felt-f' }, { from: 'felt-f', to: 'felt-v' }, { from: 'felt-e', to: 'felt-v', port: 'gain' }, { from: 'felt-v', to: 'mix' },
      { from: 'mix', to: 'out' }, { from: 'mix', to: 'send' },
    ],
  },
  'ACTION — RIM': {
    name: 'Rim knock', group: 'MUSIC', kind: 'perc', dur: 0.2,
    nodes: [
      { id: 'nz', type: 'noise', name: 'knock', freq: 600, steps: 256, rate: 1, loopLen: 0.4 },
      { id: 'bp', type: 'filter', name: 'knock', ftype: 'bandpass', freq: 1900, Q: 3 },
      { id: 'e', type: 'env', name: 'knock', peak: 1, attack: 0.001, decay: 0.045, sustain: 0 },
      { id: 'v', type: 'gain', name: 'knock', gain: 0 },
      { id: 'wood', type: 'osc', name: 'wood', wave: 'triangle', freq: 520 },
      { id: 'wood-e', type: 'env', name: 'wood', peak: 0.35, attack: 0.001, decay: 0.03, sustain: 0 },
      { id: 'wood-v', type: 'gain', name: 'wood', gain: 0 },
      { id: 'send', type: 'send', name: 'room', gain: 0.06 },
      { id: 'out', type: 'out', name: 'output', gain: 0.3 },
    ],
    cables: [
      { from: 'nz', to: 'bp' }, { from: 'bp', to: 'v' }, { from: 'e', to: 'v', port: 'gain' }, { from: 'v', to: 'out' }, { from: 'v', to: 'send' },
      { from: 'wood', to: 'wood-v' }, { from: 'wood-e', to: 'wood-v', port: 'gain' }, { from: 'wood-v', to: 'out' },
    ],
  },
  'ACTION — BIG DRUM': {
    name: 'Big drum', group: 'MUSIC', kind: 'perc', dur: 1.6,
    nodes: [
      { id: 'body', type: 'osc', name: 'boom', wave: 'sine', freq: 52, freqMod: 80 },
      { id: 'pit', type: 'env', name: 'pitch drop', peak: 1, attack: 0.001, decay: 0.14, sustain: 0 },
      { id: 'amp', type: 'env', name: 'boom', peak: 1, attack: 0.003, decay: 1.2, sustain: 0 },
      { id: 'vca', type: 'gain', name: 'boom', gain: 0 },
      { id: 'skin', type: 'noise', name: 'skin', freq: 600, steps: 256, rate: 1, loopLen: 0.4 },
      { id: 'skin-f', type: 'filter', name: 'skin', ftype: 'lowpass', freq: 420, Q: 0.8 },
      { id: 'skin-e', type: 'env', name: 'skin', peak: 0.8, attack: 0.001, decay: 0.22, sustain: 0 },
      { id: 'skin-v', type: 'gain', name: 'skin', gain: 0 },
      { id: 'mix', type: 'gain', name: 'mix', gain: 1 },
      { id: 'send', type: 'send', name: 'room', gain: 0.22 },
      { id: 'out', type: 'out', name: 'output', gain: 0.9 },
    ],
    cables: [
      { from: 'pit', to: 'body', port: 'freq' }, { from: 'body', to: 'vca' }, { from: 'amp', to: 'vca', port: 'gain' }, { from: 'vca', to: 'mix' },
      { from: 'skin', to: 'skin-f' }, { from: 'skin-f', to: 'skin-v' }, { from: 'skin-e', to: 'skin-v', port: 'gain' }, { from: 'skin-v', to: 'mix' },
      { from: 'mix', to: 'out' }, { from: 'mix', to: 'send' },
    ],
  },
  'ACTION — WHIP': {
    name: 'Whip crack', group: 'MUSIC', kind: 'perc', dur: 0.4,
    nodes: [
      { id: 'nz', type: 'noise', name: 'crack', freq: 600, steps: 256, rate: 1, loopLen: 0.4 },
      { id: 'hp', type: 'filter', name: 'crack', ftype: 'highpass', freq: 2400, Q: 0.7 },
      { id: 'e', type: 'env', name: 'crack', peak: 1, attack: 0.0005, decay: 0.028, sustain: 0 },
      { id: 'v', type: 'gain', name: 'crack', gain: 0 },
      { id: 'chirp', type: 'osc', name: 'snap', wave: 'triangle', freq: 300, freqMod: 2600 },
      { id: 'chirp-p', type: 'env', name: 'snap', peak: 1, attack: 0.0005, decay: 0.03, sustain: 0 },
      { id: 'chirp-e', type: 'env', name: 'snap', peak: 0.5, attack: 0.0005, decay: 0.035, sustain: 0 },
      { id: 'chirp-v', type: 'gain', name: 'snap', gain: 0 },
      { id: 'air-f', type: 'filter', name: 'air', ftype: 'bandpass', freq: 1300, Q: 0.9 },
      { id: 'air-e', type: 'env', name: 'air', peak: 0.25, attack: 0.004, decay: 0.16, sustain: 0 },
      { id: 'air-v', type: 'gain', name: 'air', gain: 0 },
      { id: 'send', type: 'send', name: 'room', gain: 0.3 },
      { id: 'out', type: 'out', name: 'output', gain: 0.5 },
    ],
    cables: [
      { from: 'nz', to: 'hp' }, { from: 'hp', to: 'v' }, { from: 'e', to: 'v', port: 'gain' }, { from: 'v', to: 'out' }, { from: 'v', to: 'send' },
      { from: 'chirp-p', to: 'chirp', port: 'freq' }, { from: 'chirp', to: 'chirp-v' }, { from: 'chirp-e', to: 'chirp-v', port: 'gain' }, { from: 'chirp-v', to: 'out' },
      { from: 'nz', to: 'air-f' }, { from: 'air-f', to: 'air-v' }, { from: 'air-e', to: 'air-v', port: 'gain' }, { from: 'air-v', to: 'out' }, { from: 'air-v', to: 'send' },
    ],
  },
  'ACTION — TWANG': {
    name: 'Twang guitar', group: 'MUSIC', kind: 'instrument', dur: 2.2,
    nodes: [
      { id: 'pick', type: 'noise', name: 'pick', freq: 600, steps: 256, rate: 1, loopLen: 0.4 },
      { id: 'pick-f', type: 'filter', name: 'pick brightness', ftype: 'lowpass', freq: 3200, Q: 0.6 },
      { id: 'pick-e', type: 'env', name: 'pluck', peak: 1, attack: 0.0005, decay: 0.012, sustain: 0 },
      { id: 'pick-v', type: 'gain', name: 'pluck', gain: 0 },
      { id: 'string', type: 'delay', name: 'string (time = 1 / pitch)', time: 0.006068, feedback: 0.85, tone: 3800, wet: 1 },
      { id: 'wire', type: 'osc', name: 'wire', wave: 'sawtooth', freq: 164.81 },
      { id: 'wire2', type: 'osc', name: 'second wire', wave: 'square', freq: 164.81, detune: 6, level: 0.35 },
      { id: 'tw-f', type: 'filter', name: 'twang', ftype: 'lowpass', freq: 700, Q: 7 },
      { id: 'tw-e', type: 'env', name: 'twang sweep', peak: 1, attack: 0.001, decay: 0.28, sustain: 0 },
      { id: 'tw-m', type: 'math', name: 'twang sweep (Hz)', mul: 2600 },
      { id: 'wire-e', type: 'env', name: 'wire', peak: 0.5, attack: 0.002, decay: 1.6, sustain: 0 },
      { id: 'wire-v', type: 'gain', name: 'wire', gain: 0 },
      { id: 'mix', type: 'gain', name: 'mix', gain: 1 },
      { id: 'body', type: 'filter', name: 'body', ftype: 'lowpass', freq: 4200, Q: 1.4 },
      { id: 'low-cut', type: 'filter', name: 'low cut', ftype: 'highpass', freq: 110, Q: 0.7 },
      { id: 'grit', type: 'shaper', name: 'amp grit', grit: 0.18 },
      { id: 'ring', type: 'env', name: 'ring', peak: 1, attack: 0.001, decay: 1.8, sustain: 0 },
      { id: 'vca', type: 'gain', name: 'ring', gain: 0 },
      { id: 'trem', type: 'osc', name: 'tremolo', wave: 'sine', freq: 5.6, level: 0.18 },
      { id: 'trem-v', type: 'gain', name: 'tremolo', gain: 0.85 },
      { id: 'send', type: 'send', name: 'room', gain: 0.24 },
      { id: 'out', type: 'out', name: 'output', gain: 0.5 },
    ],
    cables: [
      { from: 'pick', to: 'pick-f' }, { from: 'pick-f', to: 'pick-v' }, { from: 'pick-e', to: 'pick-v', port: 'gain' },
      { from: 'pick-v', to: 'string' }, { from: 'string', to: 'mix' },
      { from: 'wire', to: 'tw-f' }, { from: 'wire2', to: 'tw-f' }, { from: 'tw-e', to: 'tw-m' }, { from: 'tw-m', to: 'tw-f', port: 'freq' },
      { from: 'tw-f', to: 'wire-v' }, { from: 'wire-e', to: 'wire-v', port: 'gain' }, { from: 'wire-v', to: 'mix' },
      { from: 'mix', to: 'body' }, { from: 'body', to: 'low-cut' }, { from: 'low-cut', to: 'grit' },
      { from: 'grit', to: 'vca' }, { from: 'ring', to: 'vca', port: 'gain' }, { from: 'vca', to: 'trem-v' }, { from: 'trem', to: 'trem-v', port: 'gain' },
      { from: 'trem-v', to: 'out' }, { from: 'trem-v', to: 'send' },
    ],
  },
  'ACTION — WHISTLE': {
    name: 'Whistle', group: 'MUSIC', kind: 'instrument', dur: 2,
    nodes: [
      { id: 'tone', type: 'osc', name: 'whistle', wave: 'sine', freq: 1318.5, freqMod: -110 },
      { id: 'over', type: 'osc', name: 'a little second harmonic', wave: 'sine', freq: 2637, freqMod: -220, level: 0.04 },
      { id: 'scoop', type: 'env', name: 'scoop up', peak: 1, attack: 0, decay: 0.09, sustain: 0, floor: 0.02 },
      { id: 'vib', type: 'osc', name: 'vibrato', wave: 'sine', freq: 5.4, level: 1 },
      { id: 'vib-grow', type: 'env', name: 'vibrato grows', peak: 1, attack: 0.35, attackCurve: 'lin', decay: 0.01, sustain: 1, release: 0.2, delay: 0.15 },
      { id: 'vib-g', type: 'gain', name: 'vibrato', gain: 0 },
      { id: 'vib-d', type: 'math', name: 'vibrato depth (x the scoop range: about 16 Hz)', mul: -0.145 },
      { id: 'air', type: 'noise', name: 'air', freq: 600, steps: 256, rate: 1, loopLen: 1.2 },
      { id: 'air-f', type: 'filter', name: 'air', ftype: 'bandpass', freq: 1318.5, Q: 6 },
      { id: 'air-g', type: 'gain', name: 'air', gain: 0.05 },
      { id: 'mix', type: 'gain', name: 'mix', gain: 1 },
      { id: 'amp', type: 'env', name: 'loudness', peak: 1, attack: 0.05, attackCurve: 'lin', decay: 0.1, sustain: 0.85, release: 0.16 },
      { id: 'vca', type: 'gain', name: 'loudness', gain: 0 },
      { id: 'send', type: 'send', name: 'room', gain: 0.22 },
      { id: 'out', type: 'out', name: 'output', gain: 0.16 },
    ],
    cables: [
      { from: 'scoop', to: 'tone', port: 'freq' }, { from: 'scoop', to: 'over', port: 'freq' },
      { from: 'vib', to: 'vib-g' }, { from: 'vib-grow', to: 'vib-g', port: 'gain' }, { from: 'vib-g', to: 'vib-d' }, { from: 'vib-d', to: 'tone', port: 'freq' },
      { from: 'tone', to: 'mix' }, { from: 'over', to: 'mix' }, { from: 'air', to: 'air-f' }, { from: 'air-f', to: 'air-g' }, { from: 'air-g', to: 'mix' },
      { from: 'mix', to: 'vca' }, { from: 'amp', to: 'vca', port: 'gain' }, { from: 'vca', to: 'out' }, { from: 'vca', to: 'send' },
    ],
  },
  'ACTION — BASS': {
    name: 'Plucked bass', group: 'MUSIC', kind: 'instrument', dur: 1,
    nodes: [
      { id: 'tri', type: 'osc', name: 'body', wave: 'triangle', freq: 82.41 },
      { id: 'saw', type: 'osc', name: 'edge', wave: 'sawtooth', freq: 82.41, level: 0.35 },
      { id: 'lp', type: 'filter', name: 'darkness', ftype: 'lowpass', freq: 520, Q: 0.9 },
      { id: 'amp', type: 'env', name: 'pluck', peak: 1, attack: 0.004, decay: 0.55, sustain: 0 },
      { id: 'vca', type: 'gain', name: 'pluck', gain: 0 },
      { id: 'send', type: 'send', name: 'room', gain: 0.04 },
      { id: 'out', type: 'out', name: 'output', gain: 0.42 },
    ],
    cables: [
      { from: 'tri', to: 'lp' }, { from: 'saw', to: 'lp' }, { from: 'lp', to: 'vca' }, { from: 'amp', to: 'vca', port: 'gain' },
      { from: 'vca', to: 'out' }, { from: 'vca', to: 'send' },
    ],
  },
};
