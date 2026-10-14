// THE TARGET RANGE'S SOUNDS (src/missions/shooting.js), made in the browser as Sound Lab patches (RANGE_PATCHES below,
// the same in the Sound Lab's RANGE group, ~/sound-lab/patch.js: tune one there by ear, then paste it back here). Every
// one is noise through filters, never a ringing tone (the owner's rule for hits and knocks):
//   SHOT     the six-shooter: a sharp crack of bright noise, a short bark in the middle, and a low thump of dark noise,
//            with a little of the open air after it (kept well under the music and the town: it is heard a lot)
//   CLANK    a bullet knocking a tin can off the plank: a hard tick and two short bands of tinny noise
//   SHATTER  a bottle bursting: a crack and a scatter of tiny bright ticks, the glass falling
//   PING     a shot glancing off: a tick and a quick falling zing of narrow noise
//   THUD     a shot into the hay or the dirt: a soft dull thump and a little hiss
//   CLICK    the hammer cocked (and each round going into the cylinder on a reload): a small dry tick
//
//   const S = makeRangeSound({ audio })   audio: src/audio/audio.js's (nothing plays until the player has clicked once)
//   S.shot(), S.cock(), S.reload()        at the shooter (not placed)
//   S.clank(at), S.shatter(at), S.ping(at), S.thud(at)   at a place in the world ({ x, y, z }), heard from the camera
//   S.on(true | false)   keeps the sound awake while the range is in use (audio.need)
//   S.dispose()
import { playPatch } from './patch.js';

export const RANGE_SOUND = {
  shot: 0.55,      // the gunshot's level (it is right at the ears)
  hits: 1.0,       // the hits' level (they are 8 or 9 metres off: the distance takes some off)
  ref: 4,          // m: a placed sound's full loudness out to this far
};

const WHITE = { type: 'noise', freq: 600, steps: 256, loopLen: 1, rate: 1, level: 1 };   // (white hiss: a fresh value every sample)
const burst = (id, name, ftype, freq, Q, peak, decay, delay = 0, more = {}) => [
  { id: `${id}-f`, type: 'filter', name, ftype, freq, Q, ...more },
  { id: `${id}-g`, type: 'gain', name, gain: 0 },
  { id: `${id}-e`, type: 'env', name, peak, attack: 0.001, decay, sustain: 0, delay },
];
const wire = (id) => [{ from: 'n', to: `${id}-f` }, { from: `${id}-f`, to: `${id}-g` }, { from: `${id}-e`, to: `${id}-g`, port: 'gain' }, { from: `${id}-g`, to: 'out' }];

export const RANGE_PATCHES = {
  'RANGE — SHOT': {
    name: 'Six-shooter', group: 'RANGE', kind: 'perc', dur: 0.7,
    nodes: [
      { id: 'n', name: 'noise', ...WHITE },
      ...burst('crack', 'crack', 'highpass', 2200, 0.7, 1.6, 0.035),
      ...burst('bark', 'bark', 'bandpass', 700, 0.9, 1.2, 0.13),
      ...burst('thump', 'thump', 'lowpass', 170, 0.8, 2.2, 0.22),
      ...burst('air', 'open air', 'bandpass', 1300, 0.5, 0.12, 0.45, 0.03),
      { id: 'out', type: 'out', name: 'output', gain: 0.5 },
    ],
    cables: [...wire('crack'), ...wire('bark'), ...wire('thump'), ...wire('air')],
  },
  'RANGE — CLANK': {
    name: 'Tin can hit', group: 'RANGE', kind: 'perc', dur: 0.3,
    nodes: [
      { id: 'n', name: 'noise', ...WHITE },
      ...burst('tick', 'tick', 'highpass', 3500, 0.7, 0.9, 0.012),
      ...burst('tin1', 'tin', 'bandpass', 1750, 3, 1.4, 0.07),
      ...burst('tin2', 'tin, higher', 'bandpass', 3300, 3.5, 0.9, 0.05, 0.004),
      ...burst('body', 'knock', 'lowpass', 600, 0.7, 0.6, 0.04),
      { id: 'out', type: 'out', name: 'output', gain: 0.8 },
    ],
    cables: [...wire('tick'), ...wire('tin1'), ...wire('tin2'), ...wire('body')],
  },
  'RANGE — SHATTER': {
    name: 'Bottle bursting', group: 'RANGE', kind: 'perc', dur: 0.8,
    nodes: [
      { id: 'n', name: 'noise', ...WHITE },
      ...burst('crack', 'crack', 'highpass', 2500, 0.7, 1.3, 0.04),
      ...burst('burst', 'burst', 'bandpass', 4200, 1.2, 0.9, 0.16),
      ...burst('bits1', 'falling bits', 'highpass', 6000, 0.8, 0.5, 0.02, 0.09),
      ...burst('bits2', 'falling bits', 'highpass', 5200, 0.8, 0.4, 0.018, 0.17),
      ...burst('bits3', 'falling bits', 'highpass', 6800, 0.8, 0.35, 0.02, 0.26),
      ...burst('bits4', 'falling bits', 'highpass', 5600, 0.8, 0.25, 0.016, 0.38),
      { id: 'out', type: 'out', name: 'output', gain: 0.5 },
    ],
    cables: [...wire('crack'), ...wire('burst'), ...wire('bits1'), ...wire('bits2'), ...wire('bits3'), ...wire('bits4')],
  },
  'RANGE — PING': {
    name: 'Glancing shot', group: 'RANGE', kind: 'perc', dur: 0.45,
    nodes: [
      { id: 'n', name: 'noise', ...WHITE },
      ...burst('tick', 'tick', 'highpass', 3000, 0.7, 0.8, 0.012),
      ...burst('zing', 'zing', 'bandpass', 5200, 7, 1.6, 0.28, 0.006, { freqEnd: 1500, glide: 0.3 }),
      { id: 'out', type: 'out', name: 'output', gain: 0.55 },
    ],
    cables: [...wire('tick'), ...wire('zing')],
  },
  'RANGE — THUD': {
    name: 'Shot into the hay', group: 'RANGE', kind: 'perc', dur: 0.3,
    nodes: [
      { id: 'n', name: 'noise', ...WHITE },
      ...burst('thud', 'thud', 'lowpass', 320, 0.8, 1.4, 0.07),
      ...burst('hiss', 'dirt', 'bandpass', 2400, 0.8, 0.2, 0.09, 0.01),
      { id: 'out', type: 'out', name: 'output', gain: 1.2 },
    ],
    cables: [...wire('thud'), ...wire('hiss')],
  },
  'RANGE — CLICK': {
    name: 'Hammer click', group: 'RANGE', kind: 'perc', dur: 0.12,
    nodes: [
      { id: 'n', name: 'noise', ...WHITE },
      ...burst('tick', 'tick', 'bandpass', 2600, 2, 0.6, 0.008),
      ...burst('tock', 'tock', 'bandpass', 1500, 2, 0.35, 0.01, 0.035),
      { id: 'out', type: 'out', name: 'output', gain: 0.5 },
    ],
    cables: [...wire('tick'), ...wire('tock')],
  },
};

export function makeRangeSound({ audio = null } = {}) {
  const S = {};
  const ok = () => !!(audio && audio.ctx && audio.out && audio.running);
  // a patch now (or after `when` seconds), at the ears or at a place
  function play(name, { at = null, gain = 1, when = 0 } = {}) {
    if (!ok()) return;
    const ctx = audio.ctx, P = RANGE_PATCHES[name];
    try {
      const g = ctx.createGain(); g.gain.value = gain;
      let tail = g;
      if (at) {
        const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
        p.refDistance = RANGE_SOUND.ref; p.rolloffFactor = 1; p.maxDistance = 10000;
        if (p.positionX) { p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z; } else p.setPosition(at.x, at.y, at.z);
        g.connect(p); p.connect(audio.out); tail = p;
      } else g.connect(audio.out);
      playPatch(ctx, null, g, null, P, () => { try { g.disconnect(); if (tail !== g) tail.disconnect(); } catch (e) { /* gone */ } }, { at: ctx.currentTime + 0.005 + when });
    } catch (e) { /* no sound: never mind */ }
  }
  S.shot = () => play('RANGE — SHOT', { gain: RANGE_SOUND.shot * (0.9 + Math.random() * 0.15) });
  S.cock = () => play('RANGE — CLICK', { gain: 0.8, when: 0.12 });
  // six rounds into the cylinder, one click each, then the hammer
  S.reload = () => { for (let k = 0; k < 6; k++) play('RANGE — CLICK', { gain: 0.45 + Math.random() * 0.2, when: 0.25 + k * 0.11 + Math.random() * 0.03 }); play('RANGE — CLICK', { gain: 0.9, when: 1.05 }); };
  S.clank = (at) => play('RANGE — CLANK', { at, gain: RANGE_SOUND.hits * (0.9 + Math.random() * 0.2) });
  S.shatter = (at) => play('RANGE — SHATTER', { at, gain: RANGE_SOUND.hits });
  S.ping = (at) => play('RANGE — PING', { at, gain: RANGE_SOUND.hits * 0.9 });
  S.thud = (at) => play('RANGE — THUD', { at, gain: RANGE_SOUND.hits });
  S.on = (on) => { if (audio && audio.need) audio.need('range', !!on); };
  S.dispose = () => S.on(false);
  return S;
}
