// THE WAGONS' SOUND: a wagon rolling past makes three sounds, each a small Sound Lab patch (patch.js format: paste one
// into the Sound Lab to tune it by ear, then paste it back here):
//   WAGON — RUMBLE  the wheels on the dirt road: a low, uneven grumble with a little gravel crunch on top (a drone: it
//                   runs while the wagon is near, louder the faster it goes, silent when it stands)
//   WAGON — CREAK   the wood and the iron: now and then a short creak, a different pitch each time
//   WAGON — HOOF    one hoof coming down on the dirt: a dull thud with a small knock; played for every hoof of the team
//                   as it lands in the horses' Walk (four a step, each horse a little out of time with the other)
// Each wagon's sound comes from where it is (a PannerNode at the wagon and one at the team; the camera is the ears,
// as for the stage band), quiet, and off altogether past WAGON_SOUND.far metres.
//
//   const S = makeWagonSound(audio, wg)   audio: src/audio/audio.js's; wg: a wagon from src/wagon.js
//   S.update(dt, ears)    each frame after the wagon's update: ears = where the listener is (the camera's position)
//   S.dispose()
import { playPatch } from './patch.js';

export const WAGON_PATCHES = {
  'WAGON — RUMBLE': {
    name: 'Wagon rumble', group: 'WAGON', kind: 'engine', dur: 3,
    nodes: [
      { id: 'grind', type: 'noise', name: 'grind', freq: 31, steps: 26, loopLen: 1.6, rate: 1, level: 1 },
      { id: 'grind-f', type: 'filter', name: 'grind', ftype: 'lowpass', freq: 170, Q: 0.9 },
      { id: 'grind-g', type: 'gain', name: 'grind', gain: 0.9 },
      { id: 'grit', type: 'noise', name: 'gravel', freq: 600, steps: 256, loopLen: 1.1, rate: 1, level: 1 },
      { id: 'grit-f', type: 'filter', name: 'gravel', ftype: 'bandpass', freq: 520, Q: 0.7 },
      { id: 'grit-g', type: 'gain', name: 'gravel', gain: 0.12 },
      { id: 'wob', type: 'osc', name: 'bump', wave: 'sine', freq: 2.3, level: 0.35 },
      { id: 'bus', type: 'gain', name: 'mix', gain: 0.75 },
      { id: 'out', type: 'out', name: 'output', gain: 0.6 },
    ],
    cables: [
      { from: 'grind', to: 'grind-f' }, { from: 'grind-f', to: 'grind-g' }, { from: 'grind-g', to: 'bus' },
      { from: 'grit', to: 'grit-f' }, { from: 'grit-f', to: 'grit-g' }, { from: 'grit-g', to: 'bus' },
      { from: 'wob', to: 'bus', port: 'gain' }, { from: 'bus', to: 'out' },
    ],
  },
  'WAGON — CREAK': {
    name: 'Wagon creak', group: 'WAGON', kind: 'perc', dur: 0.6,
    nodes: [
      { id: 'wood', type: 'osc', name: 'wood', wave: 'sawtooth', freq: 210, freqMod: 40, voices: 2, detune: 18 },
      { id: 'wood-p', type: 'env', name: 'bend', peak: 1, attack: 0.18, decay: 0.2, sustain: 0, attackCurve: 'lin' },
      { id: 'wood-f', type: 'filter', name: 'wood', ftype: 'bandpass', freq: 900, Q: 3.5 },
      { id: 'wood-g', type: 'gain', name: 'wood', gain: 0 },
      { id: 'wood-e', type: 'env', name: 'wood', peak: 0.5, attack: 0.05, decay: 0.32, sustain: 0, attackCurve: 'lin' },
      { id: 'rasp', type: 'noise', name: 'rasp', freq: 85, steps: 3, loopLen: 1, rate: 1, level: 1 },
      { id: 'rasp-g', type: 'gain', name: 'rasp', gain: 0 },
      { id: 'out', type: 'out', name: 'output', gain: 0.5 },
    ],
    cables: [
      { from: 'wood', to: 'wood-f' }, { from: 'wood-p', to: 'wood', port: 'freq' }, { from: 'wood-f', to: 'wood-g' },
      { from: 'wood-e', to: 'wood-g', port: 'gain' }, { from: 'rasp', to: 'rasp-g' }, { from: 'wood-e', to: 'rasp-g', port: 'gain' },
      { from: 'rasp-g', to: 'wood-g', port: 'gain' },   // (the rasp roughens the creak, only while it sounds)
      { from: 'wood-g', to: 'out' },
    ],
  },
  'WAGON — HOOF': {
    name: 'Hoof on dirt', group: 'WAGON', kind: 'perc', dur: 0.3,
    nodes: [
      { id: 'thud', type: 'osc', name: 'thud', wave: 'sine', freq: 82, freqMod: 110 },
      { id: 'thud-p', type: 'env', name: 'thud pitch', peak: 1, attack: 0, decay: 0.045, sustain: 0 },
      { id: 'thud-g', type: 'gain', name: 'thud', gain: 0 },
      { id: 'thud-e', type: 'env', name: 'thud', peak: 0.9, attack: 0.002, decay: 0.11, sustain: 0 },
      { id: 'knock', type: 'noise', name: 'knock', freq: 600, steps: 256, loopLen: 1, rate: 1, level: 1 },
      { id: 'knock-f', type: 'filter', name: 'knock', ftype: 'bandpass', freq: 1100, Q: 1.2 },
      { id: 'knock-g', type: 'gain', name: 'knock', gain: 0 },
      { id: 'knock-e', type: 'env', name: 'knock', peak: 0.45, attack: 0.001, decay: 0.03, sustain: 0 },
      { id: 'out', type: 'out', name: 'output', gain: 0.55 },
    ],
    cables: [
      { from: 'thud', to: 'thud-g' }, { from: 'thud-p', to: 'thud', port: 'freq' }, { from: 'thud-e', to: 'thud-g', port: 'gain' }, { from: 'thud-g', to: 'out' },
      { from: 'knock', to: 'knock-f' }, { from: 'knock-f', to: 'knock-g' }, { from: 'knock-e', to: 'knock-g', port: 'gain' }, { from: 'knock-g', to: 'out' },
    ],
  },
};

export const WAGON_SOUND = {
  level: 0.9,               // the whole wagon's loudness
  rumble: 0.4,              // the rumble at a walk (it grows with the pace: x pace / 1.8 m/s, up to 1.6x)
  creak: [1.6, 5],          // s between creaks while moving
  hoof: 0.9,                // each hoof's loudness
  hoofAt: [0.02, 0.27, 0.5, 0.77],   // where in the horses' Walk clip each hoof lands (share of the clip)
  near: 6, far: 70,         // m: the sound starts at `far` (fading in from there), and is full by `near`
  ref: 4, rolloff: 1.2,     // the panners: full at ref metres, softening as 1 / distance past it
};
const rnd = (a, b) => a + Math.random() * (b - a);

let count = 0;
export function makeWagonSound(audio, wg) {
  const who = 'wagon' + (count++);
  let ctx = null, bus = null, pW = null, pT = null, rumble = null, rumbleGain = null, alive = true, on = false;
  let nextCreak = rnd(...WAGON_SOUND.creak);
  const last = wg.team.map(() => -1);
  const panner = () => {
    const n = ctx.createPanner(); n.panningModel = 'equalpower'; n.distanceModel = 'inverse';
    n.refDistance = WAGON_SOUND.ref; n.rolloffFactor = WAGON_SOUND.rolloff; n.maxDistance = 1000;
    return n;
  };
  function build() {
    ctx = audio.ctx;
    bus = ctx.createGain(); bus.gain.value = 0; bus.connect(audio.out);
    pW = panner(); pW.connect(bus); pT = panner(); pT.connect(bus);
    rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0; rumbleGain.connect(pW);
    rumble = playPatch(ctx, null, rumbleGain, null, WAGON_PATCHES['WAGON — RUMBLE'], null);
  }
  function teardown() {
    if (rumble) { rumble.stop(0.05); rumble = null; }
    const b = bus; bus = null; pW = pT = rumbleGain = null;
    if (b) setTimeout(() => { try { b.disconnect(); } catch (e) { /* gone */ } }, 600);
  }
  const setPos = (p, v) => {
    if (p.positionX) { const t = ctx.currentTime; p.positionX.setTargetAtTime(v.x, t, 0.03); p.positionY.setTargetAtTime(v.y, t, 0.03); p.positionZ.setTargetAtTime(v.z, t, 0.03); }
    else p.setPosition(v.x, v.y, v.z);
  };
  return {
    update(dt, ears) {
      if (!alive || !ears) return;
      const d = Math.hypot(wg.pos.x - ears.x, wg.pos.z - ears.z);
      const want = d < WAGON_SOUND.far && !!audio.ctx;
      audio.need(who, want);   // (the game's sound sleeps while nobody has any to make)
      if (want && !on) { if (audio.running) { build(); on = true; } }
      else if (!want && on) { teardown(); on = false; }
      if (!on || !audio.running) return;
      const t = ctx.currentTime, fade = Math.max(0, Math.min(1, (WAGON_SOUND.far - d) / (WAGON_SOUND.far - WAGON_SOUND.near)));
      bus.gain.setTargetAtTime(WAGON_SOUND.level * fade, t, 0.1);
      const pace = wg.pace;
      rumbleGain.gain.setTargetAtTime(pace < 0.05 ? 0 : WAGON_SOUND.rumble * Math.min(1.6, pace / 1.8), t, 0.15);
      setPos(pW, wg.pos);
      if (wg.team.length) setPos(pT, wg.team[0].root.position);
      if (pace > 0.2) {
        nextCreak -= dt;
        if (nextCreak <= 0) {
          nextCreak = rnd(...WAGON_SOUND.creak) / Math.min(1.5, Math.max(0.6, pace / 1.8));
          const semi = rnd(-5, 6), p = WAGON_PATCHES['WAGON — CREAK'];
          const n = p.nodes.map((x) => (x.type === 'osc' && x.id === 'wood' ? { ...x, freq: x.freq * Math.pow(2, semi / 12) } : x.type === 'out' ? { ...x, gain: x.gain * rnd(0.5, 1) } : x));
          playPatch(ctx, null, pW, null, { ...p, nodes: n }, null);
        }
      }
      // the hooves: each time a horse's Walk clip passes a hoof's landing
      wg.team.forEach((h, i) => {
        const a = h.actions && h.actions.Walk;
        if (!a || h.clip !== 'Walk' || pace < 0.05) { last[i] = -1; return; }
        const ph = (a.time / a.getClip().duration) % 1;
        if (last[i] >= 0) for (const at of WAGON_SOUND.hoofAt) {
          const crossed = last[i] <= ph ? at > last[i] && at <= ph : at > last[i] || at <= ph;
          if (crossed) {
            const p = WAGON_PATCHES['WAGON — HOOF'];
            const n = p.nodes.map((x) => (x.type === 'out' ? { ...x, gain: x.gain * WAGON_SOUND.hoof * rnd(0.7, 1) } : x.id === 'knock-f' ? { ...x, freq: x.freq * rnd(0.8, 1.25) } : x));
            playPatch(ctx, null, pT, null, { ...p, nodes: n }, null, { at: t + 0.01 + i * 0.004 });
          }
        }
        last[i] = ph;
      });
    },
    dispose() { alive = false; if (on) teardown(); on = false; audio.need(who, false); },
  };
}
