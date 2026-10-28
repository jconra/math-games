// THE HORSES' TREATS' SOUNDS (src/feeding.js), made in the browser as Sound Lab patches (src/audio/patch.js), all noise
// through filters, never a ringing tone (the game's rule: a crunch or a knock is a crack of noise; a ringing sine
// sounds like glass). Each play is a little different (a few random draws: the bites' timing, their brightness).
//   CRUNCH   a horse munching an apple or a carrot: a handful of bites, each a bright crack of noise (the apple
//            breaking) over a short dark thud (the jaw), the gaps between them uneven, the last ones softer
//   NICKER   a horse's soft low greeting: breathy noise through a throaty band that slides down, fluttered fast (the
//            flutter is a slow wobble on the loudness, not a sound of its own), and a short snort of air at the end
//   PICK     an apple pulled off a branch: a leafy rustle and the stalk's small snap
//
//   const S = makeTreatSound({ audio })   audio: src/audio/audio.js's (nothing plays until the player has clicked once)
//   S.play(kind, at)     kind 'crunch' | 'nicker' | 'pick'; at: { x, y, z } in the world, heard from the camera (the
//                        listener) and only within TREAT_SOUND.earshot metres; through the game's volume (audio.out)
//   TREAT_PATCHES        one of each, at the middle of its variation (for the Sound Lab)
import { playPatch } from './patch.js';

export const TREAT_SOUND = {
  level: 0.85,      // loudness (a near, small sound)
  ref: 2.5,         // m: full loudness out to this far
  earshot: 26,      // m: past this from the camera nothing is played
};

const WHITE = { type: 'noise', freq: 600, steps: 256, loopLen: 1, rate: 1, level: 1 };   // (white hiss: a fresh value every sample)
// a burst of `src` through one filter, shaped by its own envelope, into `to` (the output, or a flutter)
const burst = (id, src, ftype, freq, Q, peak, attack, decay, delay = 0, more = {}, to = 'out') => ({
  nodes: [
    { id: `${id}-f`, type: 'filter', name: id, ftype, freq, Q, delay, ...more },
    { id: `${id}-g`, type: 'gain', name: id, gain: 0 },
    { id: `${id}-e`, type: 'env', name: id, peak, attack, decay, sustain: 0, delay },
  ],
  cables: [{ from: src, to: `${id}-f` }, { from: `${id}-f`, to: `${id}-g` }, { from: `${id}-e`, to: `${id}-g`, port: 'gain' }, { from: `${id}-g`, to }],
});
const patch = (name, dur, gain, sources, bursts, extra = { nodes: [], cables: [] }) => ({
  name, group: 'HORSES', kind: 'perc', dur,
  nodes: [...sources, ...bursts.flatMap((b) => b.nodes), ...extra.nodes, { id: 'out', type: 'out', name: 'output', gain }],
  cables: [...bursts.flatMap((b) => b.cables), ...extra.cables],
});
const v = (r, base, spread) => base * (1 + (r() * 2 - 1) * spread);

// r(): 0..1 draws (Math.random in the game; 0.5 each for the middle of the variation)
export function crunchPatch(r = Math.random) {
  const bites = [];
  let t = v(r, 0.05, 0.4);
  for (let i = 0; i < 5; i++) {
    const soft = 1 - i * 0.14;
    bites.push(burst(`crack${i}`, 'n', 'bandpass', v(r, 2400, 0.2), 1.3, v(r, 0.9, 0.2) * soft, 0.002, v(r, 0.05, 0.3), t));
    bites.push(burst(`grit${i}`, 'n', 'highpass', v(r, 3800, 0.15), 0.8, v(r, 0.35, 0.3) * soft, 0.002, v(r, 0.03, 0.3), t + 0.012));
    bites.push(burst(`jaw${i}`, 'n', 'lowpass', v(r, 260, 0.2), 0.9, v(r, 1.1, 0.2) * soft, 0.004, v(r, 0.07, 0.25), t + 0.005));
    t += v(r, 0.36, 0.3) + i * 0.04;
  }
  return patch('Horse munches', t + 0.3, 0.55, [{ id: 'n', name: 'noise', ...WHITE }], bites);
}
export function nickerPatch(r = Math.random) {
  const band = v(r, 760, 0.12), len = v(r, 0.62, 0.15);
  // the flutter: the voice's loudness wobbled about 12 times a second (a slow wave on a gain, never heard as a tone)
  const flutter = { nodes: [
    { id: 'fl', type: 'gain', name: 'flutter', gain: 0.55 },
    { id: 'lfo', type: 'osc', name: 'flutter rate', wave: 'triangle', freq: v(r, 12, 0.15), level: 0.45 },
  ], cables: [{ from: 'lfo', to: 'fl', port: 'gain' }, { from: 'fl', to: 'out' }] };
  return patch('Horse nickers', len + 0.5, 0.75, [{ id: 'n', name: 'noise', ...WHITE }], [
    burst('throat', 'n', 'bandpass', band, 3.2, v(r, 1.6, 0.2), 0.05, len, 0, { freqEnd: band * 0.72, glide: len }, 'fl'),
    burst('chest', 'n', 'bandpass', band * 0.45, 2.2, v(r, 1.0, 0.2), 0.06, len * 0.9, 0.02, { freqEnd: band * 0.36, glide: len }, 'fl'),
    burst('nose', 'n', 'bandpass', band * 2.1, 2.5, v(r, 0.4, 0.3), 0.04, len * 0.7, 0, {}, 'fl'),
    burst('snort', 'n', 'lowpass', v(r, 1300, 0.2), 0.8, v(r, 0.5, 0.3), 0.01, v(r, 0.16, 0.2), len + 0.05),
  ], flutter);
}
export function pickPatch(r = Math.random) {
  return patch('Apple picked', 0.5, 0.45, [{ id: 'n', name: 'noise', ...WHITE }], [
    burst('rustle', 'n', 'bandpass', v(r, 3200, 0.2), 0.9, v(r, 0.45, 0.2), 0.03, v(r, 0.18, 0.2)),
    burst('snap', 'n', 'bandpass', v(r, 1800, 0.15), 2.2, v(r, 0.8, 0.2), 0.001, 0.018, v(r, 0.11, 0.2)),
  ]);
}
const MAKERS = { crunch: crunchPatch, nicker: nickerPatch, pick: pickPatch };
export const TREAT_PATCHES = { 'HORSES — CRUNCH': crunchPatch(() => 0.5), 'HORSES — NICKER': nickerPatch(() => 0.5), 'HORSES — PICK': pickPatch(() => 0.5) };

export function makeTreatSound({ audio = null } = {}) {
  const S = { played: [] };   // (played: the last few kinds, for the rigs)
  const ok = () => !!(audio && audio.ctx && audio.out && audio.running);
  S.play = (kind, at) => {
    const make = MAKERS[kind]; if (!make || !at) return;
    S.played.push(kind); if (S.played.length > 8) S.played.shift();
    if (!ok()) return;
    const ctx = audio.ctx, L = ctx.listener;
    const lx = L.positionX ? L.positionX.value : 0, lz = L.positionZ ? L.positionZ.value : 0;
    if (Math.hypot(at.x - lx, at.z - lz) > TREAT_SOUND.earshot) return;
    try {
      const g = ctx.createGain(); g.gain.value = TREAT_SOUND.level * (0.85 + Math.random() * 0.3);
      const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
      p.refDistance = TREAT_SOUND.ref; p.rolloffFactor = 1; p.maxDistance = 10000;
      if (p.positionX) { p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z; } else p.setPosition(at.x, at.y, at.z);
      g.connect(p); p.connect(audio.out);
      playPatch(ctx, null, g, null, make(), () => { try { g.disconnect(); p.disconnect(); } catch (e) { /* gone */ } }, { at: ctx.currentTime + 0.005 });
    } catch (e) { /* no sound: never mind */ }
  };
  return S;
}
