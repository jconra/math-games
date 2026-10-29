// THE CROWD'S APPLAUSE: the people in the saloon clapping when the band finishes a song (src/saloonfolk.js plays it from
// where each of them is; src/stage.js says when). A clap is a short burst of noise through a band-pass (the crack of
// the palms, about 1 to 2.5 kHz, tens of milliseconds) with a lower, hollow pop when the hands are cupped: no tones.
// Many hands are many bursts, each person's own: their own pace (three to five claps a second), a little early or late
// each time, louder or softer, brighter or more hollow; they start a moment apart, swell in, and die away over two to
// four seconds, the keen ones last. Now and then someone whistles (two quick notes, the second falling) and someone
// calls out (a speech bubble: there is no voice). Sound Lab patches, as the band's are (a preset of the same name in
// src/audio/patch.js takes their place: one tuned in the lab).
//
//   applausePlan(people, { rand }) -> { hands, whistle, shout, end }   people: [{ id }] (who is there to clap).
//                     hands: [{ id, from, to, rate, claps: [{ t, vel, tone, cup }] }] (s from the end of the song);
//                     whistle: { id, t } or null; shout: { id, t, text } or null; end: s when the last clap is done
//   clapNote({ vel, tone, cup }, patches) -> one clap as patch data;  whistleNotes(patches) -> [{ t, patch }]
//   makeApplause(ctx, { room, patches }) -> A
//     A.play(plan, at, outFor)   plays a plan from ctx time `at`; outFor(id): the AudioNode that person's sound goes
//                                into (their own positioned sound; null: left out). Made a little ahead as it goes.
//     A.stop()                   no more claps (the ones already made sound out)
//     A.busy                     true while claps are still being made
//   APPLAUSE, CROWD_PATCHES, CLAP, WHISTLE
import { playPatch, PATCH_PRESETS } from './patch.js';
import { notePatch } from './stagemusic.js';

export const CLAP = 'CROWD — CLAP', WHISTLE = 'CROWD — WHISTLE';
export const CROWD_PATCHES = {
  [CLAP]: {
    name: 'Hand clap', group: 'CROWD', kind: 'perc', dur: 0.15,
    nodes: [
      { id: 'nz', type: 'noise', name: 'hands', freq: 600, steps: 256, rate: 1, loopLen: 0.4 },
      { id: 'crack-f', type: 'filter', name: 'crack', ftype: 'bandpass', freq: 1550, Q: 1.15 },
      { id: 'crack-e', type: 'env', name: 'crack', peak: 1, attack: 0.0006, decay: 0.026, sustain: 0 },
      { id: 'crack-v', type: 'gain', name: 'crack', gain: 0 },
      { id: 'pop-f', type: 'filter', name: 'cupped air', ftype: 'bandpass', freq: 950, Q: 2.6 },
      { id: 'pop-e', type: 'env', name: 'pop', peak: 0.6, attack: 0.0006, decay: 0.016, sustain: 0 },
      { id: 'pop-v', type: 'gain', name: 'pop', gain: 0 },
      { id: 'mix', type: 'gain', name: 'mix', gain: 1 },
      { id: 'send', type: 'send', name: 'room', gain: 0.08 },
      { id: 'out', type: 'out', name: 'output', gain: 1.4 },   // (0.9 until the fiddle and banjo went up: the crowd follows the band)
    ],
    cables: [
      { from: 'nz', to: 'crack-f' }, { from: 'crack-f', to: 'crack-v' }, { from: 'crack-e', to: 'crack-v', port: 'gain' }, { from: 'crack-v', to: 'mix' },
      { from: 'nz', to: 'pop-f' }, { from: 'pop-f', to: 'pop-v' }, { from: 'pop-e', to: 'pop-v', port: 'gain' }, { from: 'pop-v', to: 'mix' },
      { from: 'mix', to: 'out' }, { from: 'mix', to: 'send' },
    ],
  },
  // a whistle through the fingers: a pure high note sliding (the sweep's envelope into its pitch), a little breath
  [WHISTLE]: {
    name: 'Crowd whistle', group: 'CROWD', kind: 'instrument', dur: 0.6,
    nodes: [
      { id: 'tone', type: 'osc', name: 'whistle', wave: 'sine', freq: 1750, freqMod: 1050 },
      { id: 'sweep', type: 'env', name: 'slide', peak: 1, attack: 0.13, attackCurve: 'lin', decay: 0.01, sustain: 1, release: 0.05 },
      { id: 'air', type: 'noise', name: 'breath', freq: 600, steps: 256, rate: 1, loopLen: 0.6 },
      { id: 'air-f', type: 'filter', name: 'breath', ftype: 'bandpass', freq: 2400, Q: 3 },
      { id: 'air-g', type: 'gain', name: 'breath', gain: 0.07 },
      { id: 'mix', type: 'gain', name: 'mix', gain: 1 },
      { id: 'amp', type: 'env', name: 'loudness', peak: 1, attack: 0.025, attackCurve: 'lin', decay: 0.04, sustain: 0.85, release: 0.06, hold: 0.16 },
      { id: 'vca', type: 'gain', name: 'loudness', gain: 0 },
      { id: 'send', type: 'send', name: 'room', gain: 0.15 },
      { id: 'out', type: 'out', name: 'output', gain: 0.16 },
    ],
    cables: [
      { from: 'sweep', to: 'tone', port: 'freq' }, { from: 'tone', to: 'mix' }, { from: 'air', to: 'air-f' }, { from: 'air-f', to: 'air-g' }, { from: 'air-g', to: 'mix' },
      { from: 'mix', to: 'vca' }, { from: 'amp', to: 'vca', port: 'gain' }, { from: 'vca', to: 'out' }, { from: 'vca', to: 'send' },
    ],
  },
};

export const APPLAUSE = {
  rate: [3.2, 4.6],       // claps a second, a person's own pace
  wobble: 0.07,           // ... each clap this share of a beat early or late
  start: [0.05, 0.8],     // s after the song's end each starts (most at once: the dice squared)
  last: [1.9, 3.6],       // s each claps for
  keen: 0.2,              // the share who go on a second longer
  swell: 0.35,            // s to come up to full
  fade: 0.8,              // s dying away at the end
  loud: [0.65, 1],        // a person's own loudness
  whistle: 0.55,          // the chance of a whistle, with three or more there
  shout: 0.5,             // the chance someone calls out (two or more there)
  shouts: ['Yeehaw!', 'Hooray!', 'Play us another!', 'Whoo-ee!', 'Bravo!', 'Good one!'],
  ahead: 0.5,             // s of claps made ahead
};

export function clapNote({ vel = 0.8, tone = 1, cup = 0.5 } = {}, patches = PATCH_PRESETS) {
  const P = patches[CLAP] || CROWD_PATCHES[CLAP], v = Math.max(0.03, Math.min(1, vel));
  return notePatch(P, { gain: 0.15 + 0.85 * Math.pow(v, 1.2), set: {
    'crack-f': { freq: 1600 * tone * (1 - 0.15 * cup) }, 'crack-e': { decay: 0.018 + 0.016 * cup },
    'pop-f': { freq: 1150 - 350 * cup }, 'pop-e': { peak: 0.15 + 0.85 * cup },
  } });
}
// two notes: up ("wheet"), then a longer one sliding down ("whee-oo")
export function whistleNotes(patches = PATCH_PRESETS) {
  const P = patches[WHISTLE] || CROWD_PATCHES[WHISTLE];
  return [
    { t: 0, patch: notePatch(P, { set: { tone: { freq: 1750, freqMod: 1050 }, sweep: { attack: 0.13, decay: 0.01, sustain: 1 }, amp: { hold: 0.16 } } }) },
    { t: 0.3, patch: notePatch(P, { set: { tone: { freq: 1650, freqMod: 1250 }, sweep: { attack: 0.004, decay: 0.42, sustain: 0 }, amp: { hold: 0.34 } } }) },
  ];
}

export function applausePlan(people, { rand = Math.random } = {}) {
  const A = APPLAUSE, lerp = (r, u) => r[0] + (r[1] - r[0]) * u, hands = [];
  let end = 0;
  for (const p of people) {
    const rate = lerp(A.rate, rand()), from = lerp(A.start, rand() * rand()), to = from + lerp(A.last, rand()) + (rand() < A.keen ? 1 : 0);
    const loud = lerp(A.loud, rand()), tone = 0.78 + 0.45 * rand(), cup = rand(), claps = [];
    for (let t = from; t < to; t += (1 / rate) * (1 + (rand() * 2 - 1) * A.wobble)) {
      const swell = Math.min(1, 0.55 + 0.45 * (t - from) / A.swell), fade = Math.min(1, 0.3 + 0.7 * Math.max(0, to - t) / A.fade);
      claps.push({ t: +t.toFixed(4), vel: Math.min(1, loud * swell * fade * (0.88 + 0.2 * rand())), tone: tone * (0.96 + 0.08 * rand()), cup });
    }
    hands.push({ id: p.id, from, to, rate, claps });
    end = Math.max(end, to);
  }
  const keen = [...hands].sort((a, b) => b.to - a.to);
  const whistle = hands.length >= 3 && rand() < A.whistle ? { id: keen[0].id, t: 0.5 + 0.9 * rand() } : null;
  const caller = keen.find((h) => !whistle || h.id !== whistle.id);
  const shout = hands.length >= 2 && caller && rand() < A.shout ? { id: caller.id, t: 0.25 + 0.8 * rand(), text: A.shouts[Math.floor(rand() * A.shouts.length) % A.shouts.length] } : null;
  return { hands, whistle, shout, end };
}

export function makeApplause(ctx, { room = null, patches = PATCH_PRESETS } = {}) {
  let timer = null, queue = [];
  const offline = typeof ctx.startRendering === 'function';   // (an offline render: everything made at once)
  const A = { get busy() { return queue.length > 0; } };
  function pump() {
    const until = offline ? Infinity : ctx.currentTime + APPLAUSE.ahead;
    while (queue.length && queue[0].at <= until) {
      const q = queue.shift();
      if (!offline && q.at < ctx.currentTime - 0.05) continue;   // (the page was asleep: skipped, never piled up)
      const out = q.out();
      if (!out) continue;
      if (q.whistle) for (const n of whistleNotes(patches)) playPatch(ctx, null, out, room, n.patch, null, { at: q.at + n.t });
      else playPatch(ctx, null, out, room, clapNote(q.clap, patches), null, { at: q.at });
    }
    if (!queue.length && timer) { clearInterval(timer); timer = null; }
  }
  A.play = (plan, at, outFor) => {
    for (const h of plan.hands) for (const c of h.claps) queue.push({ at: at + c.t, clap: c, out: () => outFor(h.id) });
    if (plan.whistle) queue.push({ at: at + plan.whistle.t, whistle: true, out: () => outFor(plan.whistle.id) });
    queue.sort((a, b) => a.at - b.at);
    pump();
    if (!timer && queue.length && !offline) timer = setInterval(pump, 100);
  };
  A.stop = () => { queue = []; if (timer) { clearInterval(timer); timer = null; } };
  return A;
}
