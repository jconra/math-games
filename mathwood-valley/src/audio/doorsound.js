// THE TOWN'S DOORS' SOUNDS (world/objects/codebuildings.js swings the doors), made in the browser as Sound Lab patches
// (src/audio/patch.js). Every one is noise through filters, never a ringing tone (the game's rule: a knock or a hammer
// is a clap-like crack; a ringing sine sounds like glass). Each play is a little different: the patch is made afresh
// each time from a few random draws (the creak's grain and pitch, the timings, the loudness).
//   OPEN     a wooden door: the latch let go (a dry tick and tock), the hinge's creak (a rough stepped noise rubbing
//            through a narrow band that slides up as the door swings), and the air of the swing (a soft low whoosh)
//   SHUT     the swing's whoosh, the soft thunk of the door against its frame (dark noise), the latch's click after it
//   FLAP     the saloon's batwings: two quick slaps of the leaves (and a third, smaller) and a short creak
//
//   const S = makeDoorSound({ audio })   audio: src/audio/audio.js's (nothing plays until the player has clicked once)
//   S.play(kind, at)     kind 'open' | 'shut' | 'flap'; at: { x, y, z } in the world, heard from the camera (the
//                        listener) and only within DOOR_SOUND.earshot metres; through the game's volume (audio.out)
//   DOOR_PATCHES         one of each, at the middle of its variation (to paste into the Sound Lab's DOORS group)
import { playPatch } from './patch.js';

export const DOOR_SOUND = {
  level: 0.9,       // the doors' loudness (a door is a near, ordinary sound: under the music and the town)
  ref: 3,           // m: full loudness out to this far
  earshot: 32,      // m: past this from the camera a door isn't played at all
};

const WHITE = { type: 'noise', freq: 600, steps: 256, loopLen: 1, rate: 1, level: 1 };   // (white hiss: a fresh value every sample)
// a burst of `src` through one filter, shaped by its own envelope, into the output
const burst = (id, src, ftype, freq, Q, peak, attack, decay, delay = 0, more = {}) => ({
  nodes: [
    { id: `${id}-f`, type: 'filter', name: id, ftype, freq, Q, delay, ...more },
    { id: `${id}-g`, type: 'gain', name: id, gain: 0 },
    { id: `${id}-e`, type: 'env', name: id, peak, attack, decay, sustain: 0, delay },
  ],
  cables: [{ from: src, to: `${id}-f` }, { from: `${id}-f`, to: `${id}-g` }, { from: `${id}-e`, to: `${id}-g`, port: 'gain' }, { from: `${id}-g`, to: 'out' }],
});
const patch = (name, dur, gain, sources, bursts) => ({
  name, group: 'DOORS', kind: 'perc', dur,
  nodes: [...sources, ...bursts.flatMap((b) => b.nodes), { id: 'out', type: 'out', name: 'output', gain }],
  cables: bursts.flatMap((b) => b.cables),
});
// the creak's grain: one held random value per step, `rate` steps a second (a hinge sticking and slipping); through a
// narrow band it is a rasp, not a tone
// (its rate one of a few: each rate is a noise buffer of its own, kept by patch.js, so a free choice would keep making
// new ones)
const RATES = [48, 56, 64, 74, 86, 100];
const grain = (rate) => ({ id: 'g', type: 'noise', name: 'hinge grain', freq: RATES.reduce((a, q) => (Math.abs(q - rate) < Math.abs(a - rate) ? q : a)), steps: 1, loopLen: 1, rate: 1, level: 1 });

// r(): 0..1 draws (Math.random in the game; 0.5 each for the middle of the variation)
const v = (r, base, spread) => base * (1 + (r() * 2 - 1) * spread);
export function openPatch(r = Math.random) {
  const creakAt = v(r, 0.06, 0.4), band = v(r, 760, 0.18);
  return patch('Door opens', 1.2, 0.55, [{ id: 'n', name: 'noise', ...WHITE }, grain(v(r, 62, 0.35))], [
    burst('latch', 'n', 'bandpass', v(r, 2600, 0.12), 2, 0.55, 0.001, 0.012),
    burst('tock', 'n', 'bandpass', v(r, 1300, 0.12), 2, 0.35, 0.001, 0.02, v(r, 0.03, 0.3)),
    burst('creak', 'g', 'bandpass', band, v(r, 6, 0.25), v(r, 0.9, 0.25), v(r, 0.08, 0.3), v(r, 0.42, 0.25), creakAt, { freqEnd: band * v(r, 1.45, 0.2), glide: 0.45 }),
    burst('swing', 'n', 'lowpass', v(r, 480, 0.2), 0.7, v(r, 0.3, 0.3), 0.14, v(r, 0.32, 0.2), 0.05),
  ]);
}
export function shutPatch(r = Math.random) {
  const hit = v(r, 0.2, 0.2);
  return patch('Door shuts', 0.8, 0.6, [{ id: 'n', name: 'noise', ...WHITE }], [
    burst('swing', 'n', 'lowpass', v(r, 420, 0.2), 0.7, v(r, 0.22, 0.3), 0.08, 0.14),
    burst('thunk', 'n', 'lowpass', v(r, 170, 0.18), 0.9, v(r, 2.0, 0.2), 0.002, v(r, 0.09, 0.2), hit),
    burst('knock', 'n', 'bandpass', v(r, 520, 0.15), 1.1, 0.5, 0.001, 0.04, hit),
    burst('latch', 'n', 'bandpass', v(r, 2900, 0.12), 2.2, 0.6, 0.001, 0.01, hit + v(r, 0.03, 0.4)),
    burst('rattle', 'n', 'bandpass', v(r, 1800, 0.15), 2, 0.25, 0.001, 0.015, hit + v(r, 0.06, 0.3)),
  ]);
}
export function flapPatch(r = Math.random) {
  const gap = v(r, 0.13, 0.25);
  return patch('Batwings flap', 0.9, 0.5, [{ id: 'n', name: 'noise', ...WHITE }, grain(v(r, 80, 0.3))], [
    burst('slap1', 'n', 'bandpass', v(r, 540, 0.15), 1, v(r, 1.0, 0.2), 0.002, 0.05),
    burst('slap2', 'n', 'bandpass', v(r, 480, 0.15), 1, v(r, 0.75, 0.2), 0.002, 0.05, gap),
    burst('slap3', 'n', 'bandpass', v(r, 600, 0.15), 1, v(r, 0.35, 0.3), 0.002, 0.04, gap * v(r, 2.3, 0.15)),
    burst('creak', 'g', 'bandpass', v(r, 1100, 0.15), 5, v(r, 0.5, 0.3), 0.03, v(r, 0.22, 0.25), 0.02, { freqEnd: v(r, 800, 0.15), glide: 0.25 }),
  ]);
}
const MAKERS = { open: openPatch, shut: shutPatch, flap: flapPatch };
export const DOOR_PATCHES = { 'DOORS — OPEN': openPatch(() => 0.5), 'DOORS — SHUT': shutPatch(() => 0.5), 'DOORS — FLAP': flapPatch(() => 0.5) };

export function makeDoorSound({ audio = null } = {}) {
  const S = {};
  const ok = () => !!(audio && audio.ctx && audio.out && audio.running);
  S.play = (kind, at) => {
    const make = MAKERS[kind]; if (!make || !at || !ok()) return;
    const ctx = audio.ctx, L = ctx.listener;
    const lx = L.positionX ? L.positionX.value : 0, lz = L.positionZ ? L.positionZ.value : 0;
    if (Math.hypot(at.x - lx, at.z - lz) > DOOR_SOUND.earshot) return;   // (out of earshot: nothing made)
    try {
      const g = ctx.createGain(); g.gain.value = DOOR_SOUND.level * (0.85 + Math.random() * 0.3);
      const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
      p.refDistance = DOOR_SOUND.ref; p.rolloffFactor = 1; p.maxDistance = 10000;
      if (p.positionX) { p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z; } else p.setPosition(at.x, at.y, at.z);
      g.connect(p); p.connect(audio.out);
      playPatch(ctx, null, g, null, make(), () => { try { g.disconnect(); p.disconnect(); } catch (e) { /* gone */ } }, { at: ctx.currentTime + 0.005 });
    } catch (e) { /* no sound: never mind */ }
  };
  return S;
}
