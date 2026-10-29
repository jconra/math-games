// THE SYNTH BANJO: a banjo made in the browser, no sound files, its notes matched by measurement to the sampled banjo
// (the Fluid R3 soundfont's General MIDI banjo, sounds/banjo/; see stagemusic.js THE BANJO). The game's maker: "Alternatively
// we could use the banjo sample to tune our synthesizer, since you said strings are relatively easy." It is a Sound Lab
// patch, as the harmonica and the piano are (a preset of the same name in patch.js, 'STAGE — BANJO', takes its place: one
// tuned in the lab), played at a pitch for a length by banjoNote; the rig that fitted it is
// ~/pw/bandit-math/rigs/banjo/ (the numbers and the method: ~/pw/bandit-math/BAND.md "The synth banjo").
//
// What it's made of (a pluck, subtractive; no delay line: a Web Audio feedback loop can't be shorter than 128 samples,
// so a plucked-string loop can't reach the high notes):
//   the string   four oscillators, each a group of the string's overtones from a drawn table (the 1st; the 2nd and 3rd;
//                the 4th to 7th; the 8th and up), each with its own fade made of two at once (a quick one and a slow
//                one: a plucked string's top dies in a moment and its body rings on), the upper groups a few cents
//                sharp (a stiff string's overtones run sharp)
//   the twang    two lowpasses on the string: a quick snap down just after the pick, then a slow slide
//   the pick     a short burst of noise through a band (the plectrum on the string)
//   the head     noise through a narrow band low down, ringing a moment (the drum head the bridge stands on)
//   the damper   holds while the note is held, then closes quickly (the next note stops the string)
// Following the pitch (banjoNote, the numbers in BANJO_PITCH): higher notes fade sooner and speak quicker, as the recordings
// do; the twang's cutoff follows the note part of the way; the string's colour (each overtone's level) changes along the
// neck as measured, between anchor notes every half octave; the pick's noise is weaker on high notes.
//
//   banjoNote(n, patch?, pitch?) -> patch data for one note: n = { midi, len (s, how long it's held: null = rings out),
//                                   vel 0..1, gain }
//   playBanjoSynth(ctx, dest, room, n) -> { stop(s) }   one note played at ctx time n.at (as playBanjo plays a sample)
import { voicePatch, playPatch, PATCH_PRESETS } from './patch.js';

export const BANJO = 'STAGE — BANJO';
export const BANJO_SYNTH_LEVEL = 0.45;   // the level the band plays it at (the sampled banjo's BANJO_LEVEL: the patch is
                                         // as loud as the recordings at vel 1)
const GROUPS = [['s1', 's1-f', 's1-s'], ['s2', 's2-f', 's2-s'], ['s3', 's3-f', 's3-s'], ['s4', 's4-f', 's4-s']];   // [osc, quick fade, slow fade]
const RINGERS = ['head-e'];              // (other one-shot envelopes that may ring past a short note)

// <fit> (written by ~/pw/bandit-math/rigs/banjo/export.cjs from the search's best, 2026-10-29: the patch at C4,
// and how it follows the pitch. distance to the recordings: see ~/pw/bandit-math/BAND.md "The synth banjo")
const tab = (n, imag) => ({ real: new Array(n).fill(0), imag: [...imag, ...new Array(n - imag.length).fill(0)] });   // (a custom wave: sines)
export const BANJO_SYNTH = {
  name: 'Banjo', group: 'MUSIC', kind: 'instrument', dur: 2,
  nodes: [
    { id: 'nz', type: 'noise', name: 'pick noise', freq: 600, steps: 256, loopLen: 0.5, rate: 1, level: 1 },
    { id: 'pick-f', type: 'filter', name: 'pick', ftype: 'bandpass', freq: 1076.7, Q: 4.174 },
    { id: 'pick-e', type: 'env', peak: 0.0099468, attack: 0.0005, attackCurve: 'lin', decay: 0.0012, sustain: 0, floor: 0.0008359, release: 0.1, name: 'pick' },
    { id: 'pick-v', type: 'gain', name: 'pick', gain: 0 },
    { id: 'head-f', type: 'filter', name: 'head', ftype: 'bandpass', freq: 636.5, Q: 10.574 },
    { id: 'head-e', type: 'env', peak: 0.0056003, attack: 0.001, attackCurve: 'lin', decay: 0.0385, sustain: 0, floor: 0.0008359, release: 0.1, name: 'head' },
    { id: 'head-v', type: 'gain', name: 'head', gain: 0 },
    { id: 's1', type: 'osc', name: 'string 1st', wave: 'custom', freq: 261.626, detune: 0, level: 0.054625, harm: tab(65, [0, 0.054625]) },
    { id: 's1-f', type: 'env', peak: 0.85565, attack: 0.00945, attackCurve: 'lin', decay: 1.0605, sustain: 0, floor: 0.0001, release: 0.1, name: 'string 1st quick fade' },
    { id: 's1-s', type: 'env', peak: 0.14435, attack: 0.00945, attackCurve: 'lin', decay: 5.1693, sustain: 0, floor: 0.0001, release: 0.1, name: 'string 1st slow fade' },
    { id: 's1-v', type: 'gain', name: 'string 1st', gain: 0 },
    { id: 's2', type: 'osc', name: 'string 2nd-3rd', wave: 'custom', freq: 261.626, detune: 3, level: 0.19888, harm: tab(65, [0, 0, 0.12158, 0.087523]) },
    { id: 's2-f', type: 'env', peak: 0.43329, attack: 0.00945, attackCurve: 'lin', decay: 0.7981, sustain: 0, floor: 0.0001, release: 0.1, name: 'string 2nd-3rd quick fade' },
    { id: 's2-s', type: 'env', peak: 0.56671, attack: 0.00945, attackCurve: 'lin', decay: 2.4548, sustain: 0, floor: 0.0001, release: 0.1, name: 'string 2nd-3rd slow fade' },
    { id: 's2-v', type: 'gain', name: 'string 2nd-3rd', gain: 0 },
    { id: 's3', type: 'osc', name: 'string 4th-7th', wave: 'custom', freq: 261.626, detune: 8, level: 0.095118, harm: tab(65, [0, 0, 0, 0, 0.055879, 0.01801, 0.015617, 0.011255]) },
    { id: 's3-f', type: 'env', peak: 0.64805, attack: 0.00945, attackCurve: 'lin', decay: 0.997, sustain: 0, floor: 0.0001, release: 0.1, name: 'string 4th-7th quick fade' },
    { id: 's3-s', type: 'env', peak: 0.35195, attack: 0.00945, attackCurve: 'lin', decay: 3.553, sustain: 0, floor: 0.0001, release: 0.1, name: 'string 4th-7th slow fade' },
    { id: 's3-v', type: 'gain', name: 'string 4th-7th', gain: 0 },
    { id: 's4', type: 'osc', name: 'string 8th up', wave: 'custom', freq: 261.626, detune: 12, level: 0.18931, harm: tab(65, [0, 0, 0, 0, 0, 0, 0, 0, 0.052751, 0.01065, 0.0057855, 0.0040887, 0.0071436, 0.0092229, 0.007971, 0.0069585, 0.0061281, 0.0057253, 0.0053698, 0.0050538, 0.0047713, 0.0045172, 0.0042876, 0.004079, 0.0038889, 0.0038247, 0.0037639, 0.0037063, 0.0036517, 0.0035998, 0.0035503, 0.0035031, 0.003458, 0.003177, 0.0029263, 0.0027017, 0.0025, 0.0023183, 0.0021541, 0.0020054, 0.0018703, 0.0017473, 0.0016351, 0.0015325, 0.0014385, 0.0013522, 0.0012727, 0.0011995, 0.0011319, 0.0013406, 0.0015822, 0.0018614, 0.0021828, 0.002552, 0.002975, 0.0034583, 0.0040092, 0.0046358, 0.0053467, 0.0061517, 0.0070612, 0.0080867, 0.0092405, 0.010537, 0.01199]) },
    { id: 's4-f', type: 'env', peak: 0.35107, attack: 0.00945, attackCurve: 'lin', decay: 0.5081, sustain: 0, floor: 0.0001, release: 0.1, name: 'string 8th up quick fade' },
    { id: 's4-s', type: 'env', peak: 0.64893, attack: 0.00945, attackCurve: 'lin', decay: 2.6004, sustain: 0, floor: 0.0001, release: 0.1, name: 'string 8th up slow fade' },
    { id: 's4-v', type: 'gain', name: 'string 8th up', gain: 0 },
    { id: 'str', type: 'gain', name: 'string', gain: 1 },
    { id: 'lp', type: 'filter', name: 'twang', ftype: 'lowpass', freq: 12444.4, freqEnd: 7616.9, glide: 0.0137, Q: 0.422 },
    { id: 'lp2', type: 'filter', name: 'twang (slow slide)', ftype: 'lowpass', freq: 6755.2, freqEnd: 2653.9, glide: 0.5227, Q: 0.707 },
    { id: 'mix', type: 'gain', name: 'mix', gain: 1 },
    { id: 'damp-e', type: 'env', name: 'damper', peak: 1, attack: 0.001, attackCurve: 'lin', decay: 0.01, sustain: 1, release: 0.09 },
    { id: 'damp', type: 'gain', name: 'damper', gain: 0 },
    { id: 'send', type: 'send', name: 'room', gain: 0.03 },
    { id: 'out', type: 'out', name: 'output', gain: 0.5 },
  ],
  cables: [
    { from: 'nz', to: 'pick-f' },
    { from: 'pick-f', to: 'pick-v' },
    { from: 'pick-e', to: 'pick-v', port: 'gain' },
    { from: 'pick-v', to: 'mix' },
    { from: 'nz', to: 'head-f' },
    { from: 'head-f', to: 'head-v' },
    { from: 'head-e', to: 'head-v', port: 'gain' },
    { from: 'head-v', to: 'mix' },
    { from: 's1', to: 's1-v' },
    { from: 's1-f', to: 's1-v', port: 'gain' },
    { from: 's1-s', to: 's1-v', port: 'gain' },
    { from: 's1-v', to: 'str' },
    { from: 's2', to: 's2-v' },
    { from: 's2-f', to: 's2-v', port: 'gain' },
    { from: 's2-s', to: 's2-v', port: 'gain' },
    { from: 's2-v', to: 'str' },
    { from: 's3', to: 's3-v' },
    { from: 's3-f', to: 's3-v', port: 'gain' },
    { from: 's3-s', to: 's3-v', port: 'gain' },
    { from: 's3-v', to: 'str' },
    { from: 's4', to: 's4-v' },
    { from: 's4-f', to: 's4-v', port: 'gain' },
    { from: 's4-s', to: 's4-v', port: 'gain' },
    { from: 's4-v', to: 'str' },
    { from: 'str', to: 'lp' },
    { from: 'lp', to: 'lp2' },
    { from: 'lp2', to: 'mix' },
    { from: 'mix', to: 'damp' },
    { from: 'damp-e', to: 'damp', port: 'gain' },
    { from: 'damp', to: 'out' },
    { from: 'damp', to: 'send' },
  ],
};
// root: the MIDI note the patch is written at; decay: each overtone group's quick and slow fades last 2^-(k u + sq u^2)
// as long, u octaves above the root (quick, slow: a k a group, the 1st, the 2nd-3rd, the 4th-7th, the 8th up); attack: the
// swell 2^-k as long an octave up; share, share2: each group's quick fade's share of the pluck moves (logit) by share u +
// share2 u^2;
// track: the twang's cutoffs follow the note to this power; velDark: octaves darker at vel 0; pick: the pick's noise 2^k
// an octave up; level: 2^k an octave up; glide: the twang's slides 2^-k as long an octave up; colour: each overtone's
// level (dB) against the patch's own, at the anchor notes (the recorded ones), knots at the overtones listed
export const BANJO_PITCH = {
  root: 60, decay: {quick: [0.5284, -0.1623, -0.3256, -0.7824], slow: [0.27, -0.4914, -1.2387, -1.2126], sq: 0.3593}, attack: 0.6611, track: 0.8137, velDark: 0.8, pick: -0.8143, level: 0.0628, share: [1.4205, 3.7111, 4.1051, 4.2473], share2: [-0.8762, -1.1198, -0.1242, 0.1975], glide: 0.3181,
  colour: {
    anchors: [48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84], harmonics: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 24, 32, 48, 64],
    delta: [   // dB, a row an anchor (the recorded notes, C3 to C6), a column a knot
      [-5.0, -7.8, -2.1, 1.6, 13.8, 7.1, 1.7, -14.6, 6.6, 10.1, 6.7, 4.5, -15.8, -12.2, -10.8, -0.7, -17.8],   // C3
      [-5.1, -10.4, -4.6, -2.3, 10.3, 3.9, -8.3, -15.8, 3.3, 7.3, 3.2, 0.2, -16.6, -15.7, -12.3, 1.1, -18.3],   // Eb3
      [-1.1, -9.3, -5.8, 7.0, 11.1, 9.2, 14.0, -1.3, -3.9, -3.6, 4.5, 1.7, -3.5, 2.1, 4.9, 0.1, 5.9],   // Gb3
      [-0.4, -10.4, -6.0, 6.7, 10.3, 8.3, 13.6, -2.6, -5.3, -4.9, 1.2, -0.5, -3.5, 1.2, 7.0, -4.2, -10.5],   // A3
      [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],   // C4
      [11.6, 2.6, -4.3, 1.6, 5.1, -2.2, 1.1, -13.7, 5.3, -1.3, 8.5, -2.3, -4.9, -10.2, -6.5, 12.8, 0.4],   // Eb4
      [11.8, 2.4, -5.3, 1.4, 5.1, -0.0, 1.5, -13.5, 5.7, -6.3, 10.1, -1.5, -4.9, -11.0, 2.8, 26.0, 0.7],   // Gb4
      [11.7, 2.3, -5.2, 0.6, 5.1, -1.7, 0.5, -15.6, 6.3, -2.2, 8.5, -0.7, -5.9, -14.4, 11.1, 28.2, 3.3],   // A4
      [0.7, -6.1, 6.5, 3.4, 1.1, -2.5, 7.6, -13.2, 13.8, 13.8, 13.9, 0.6, 0.8, 6.2, 26.4, 30.4, 5.9],   // C5
      [2.6, -4.4, 5.2, 2.4, -3.5, -8.0, 3.8, -17.3, 11.7, 11.8, 12.3, 2.4, 0.7, 15.4, 27.6, 32.3, 8.1],   // Eb5
      [2.2, -3.5, 4.7, 2.0, -1.1, -9.1, 4.1, -17.1, 11.2, 11.5, 13.4, 1.3, 4.6, 31.1, 28.9, 34.1, 10.3],   // Gb5
      [2.7, -3.0, 4.3, 2.3, -3.0, -7.5, 5.1, -17.0, 12.9, 11.6, 13.2, 0.6, 16.0, 29.5, 27.7, 33.4, 10.1],   // A5
      [3.6, -3.6, 5.0, 2.0, -2.0, -7.8, 5.0, -16.0, 13.1, 13.3, 14.4, -6.2, 27.4, 27.9, 26.5, 32.8, 9.8],   // C6
    ],
  },
};
// </fit>

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
// a custom wave's loudest point: Web Audio scales every custom wave so that its peak is 1, so a table changed for a note
// keeps its loudness by its level changing with its peak
function tablePeak(harm) {
  const N = 2048, re = harm.real, im = harm.imag; let mx = 0;
  for (let i = 0; i < N; i++) {
    const w = 2 * Math.PI * i / N; let s = 0;
    for (let k = 1; k < im.length; k++) if (re[k] || im[k]) s += (re[k] || 0) * Math.cos(k * w) + im[k] * Math.sin(k * w);
    mx = Math.max(mx, Math.abs(s));
  }
  return mx || 1;
}
// the string's colour at a pitch: each overtone's change in dB from the patch as written, at the anchor notes (the 1st to
// the 12th each, then at the 16th, 24th, 32nd, 48th and 64th, in between along the octaves), in between the anchors along
// the neck
function colourAt(P, midi) {
  const A = P.colour.anchors, D = P.colour.delta, K = P.colour.harmonics;
  let i = 0; while (i < A.length - 2 && midi > A[i + 1]) i++;
  const f = Math.max(0, Math.min(1, (midi - A[i]) / (A[i + 1] - A[i])));
  const row = D[i].map((v, j) => v * (1 - f) + D[i + 1][j] * f);
  return (k) => {
    let j = 0; while (j < K.length - 2 && k > K[j + 1]) j++;
    if (k <= K[0]) return row[0];
    if (k >= K[K.length - 1]) return row[K.length - 1];
    const g = Math.log2(k / K[j]) / Math.log2(K[j + 1] / K[j]);
    return row[j] * (1 - g) + row[j + 1] * g;
  };
}
const _cache = new WeakMap();   // patch -> pitch rules -> Map(midi -> the groups' tables and levels)
function groupsAt(patch, P, midi) {
  let byP = _cache.get(patch); if (!byP) { byP = new WeakMap(); _cache.set(patch, byP); }
  let m = byP.get(P); if (!m) { m = new Map(); byP.set(P, m); }
  const key = midi;
  if (m.has(key)) return m.get(key);
  const col = colourAt(P, midi), out = {};
  for (const [id] of GROUPS) {
    const o = patch.nodes.find((x) => x.id === id); if (!o) continue;
    if (o.wave !== 'custom' || !o.harm) { out[id] = { level: (o.level ?? 1) * Math.pow(10, col(1) / 20) }; continue; }
    const im = o.harm.imag.map((v, k) => (k && v ? v * Math.pow(10, col(k) / 20) : v)), re = o.harm.real.map((v, k) => (k && v ? v * Math.pow(10, col(k) / 20) : v));
    const harm = { real: re, imag: im };
    out[id] = { harm, level: (o.level ?? 1) * tablePeak(harm) / tablePeak(o.harm) };
  }
  m.set(key, out);
  return out;
}

export function banjoNote(n, patch = PATCH_PRESETS[BANJO] || BANJO_SYNTH, P = BANJO_PITCH) {
  const semi = n.midi - P.root, u = semi / 12, r = Math.pow(2, semi / 12), vel = Math.max(0.05, Math.min(1, n.vel ?? 0.8));
  const node = (id) => patch.nodes.find((x) => x.id === id);
  const D = P.decay, len = (k) => Math.pow(2, -(k * u + D.sq * u * u));   // a fade's length at this pitch
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length, fade = len((mean(D.quick) + mean(D.slow)) / 2);
  const speak = Math.pow(2, -P.attack * u);                             // the swell into the note
  const set = {};
  // the string: its colour here, its fades (each the patch's, shorter or longer by the pitch, the quick one's share of the
  // pluck moved too: a low string's body rings from the start, a high one's first moment dies away fast)
  const G = groupsAt(patch, P, n.midi);
  GROUPS.forEach(([id, fq, sl], g) => {
    if (G[id]) set[id] = G[id];
    const q = node(fq), s = node(sl);
    if (!q || !s) return;
    const m0 = q.peak / (q.peak + s.peak), lg = Math.log(m0 / (1 - m0)) + (P.share ? P.share[g] : 0) * u + (P.share2 ? P.share2[g] : 0) * u * u;
    const m = 1 / (1 + Math.exp(-lg)), tot = q.peak + s.peak;
    for (const [x, pk, k] of [[q, m * tot, D.quick[g]], [s, (1 - m) * tot, D.slow[g]]]) {
      const slope = Math.log10(x.peak / Math.max(1e-4, x.floor ?? 0.0005)) / (x.decay ?? 0.2);   // (decades a second)
      const p1 = Math.max(2e-4, pk), fl = Math.max(1e-4, p1 * 1e-4);
      set[x.id] = { peak: p1, floor: fl, attack: (x.attack ?? 0.01) * speak, decay: Math.log10(p1 / fl) / slope * len(k) };
    }
  });
  // the twang (a quick snap, then a slow slide): the cutoffs follow the note by their own measure (voicePatch moves them
  // exactly with it: undone here), a softer pick is a little darker, the slides quicker up the neck
  const k = Math.pow(r, P.track) * Math.pow(2, -P.velDark * (1 - vel)), gl = Math.pow(2, -(P.glide ?? 0) * u);
  for (const id of ['lp', 'lp2']) { const x = node(id); if (x) set[id] = { freq: x.freq * k, freqEnd: x.freqEnd * k, glide: (x.glide ?? 0.1) * gl }; }
  // the pick (weaker up the neck) and the head (a fixed drum: it doesn't follow the note)
  const pe = node('pick-e'); if (pe) set['pick-e'] = { peak: pe.peak * Math.pow(2, P.pick * u) * (0.4 + 0.6 * vel) };
  for (const id of ['pick-f', 'head-f']) { const x = node(id); if (x) set[id] = { freq: x.freq }; }
  const he = node('head-e'); if (he) set['head-e'] = { decay: he.decay * Math.pow(fade, 0.5) };
  // a held note: the string's fades end with the damper instead of ringing on silent (the voice stops sooner)
  if (n.len != null) {
    const de = node('damp-e'), te = n.len + (de ? de.release ?? 0.1 : 0.1) * 1.5 + 0.05;
    for (const [, fq, sl] of GROUPS) for (const e of [fq, sl, ...RINGERS]) {
      const x = node(e); if (!x) continue;
      const s = { ...x, ...set[e] }, atk = s.attack ?? 0.01, dec = s.decay ?? 0.2, pk = s.peak ?? 1, fl = Math.max(1e-4, s.floor ?? 0.0005);
      if (atk + dec <= te || pk <= fl) continue;
      const d2 = Math.max(0.01, te - atk), fl2 = pk * Math.pow(fl / pk, d2 / dec);
      set[e] = { ...set[e], decay: d2, floor: fl2 };
    }
  }
  // loudness: the touch, and the level along the neck
  const gain = (0.3 + 0.7 * vel) * Math.pow(2, P.level * u) * (n.gain ?? 1);
  const v = voicePatch(patch, { semi, gain, len: n.len ?? null });
  let nodes = v.nodes.map((x) => {
    let m = x;
    if (x.type === 'send') m = { ...m, gain: (x.gain ?? 0) * gain };    // (the echo follows the note's loudness)
    if (set[x.id]) m = { ...m, ...set[x.id] };
    return m;
  });
  // only what reaches the output is built
  const live = new Set(nodes.filter((x) => x.type === 'out' || x.type === 'send').map((x) => x.id));
  for (let grew = true; grew;) { grew = false; for (const c of v.cables) if (live.has(c.to) && !live.has(c.from)) { live.add(c.from); grew = true; } }
  nodes = nodes.filter((x) => live.has(x.id) && !(x.type === 'osc' && x.level === 0));
  const ids = new Set(nodes.map((x) => x.id));
  return { ...v, nodes, cables: v.cables.filter((c) => ids.has(c.from) && ids.has(c.to)) };
}

// one note at ctx time n.at: { at, midi, len, vel }, to dest (and its echo to room). Returns { stop(s) }
export function playBanjoSynth(ctx, dest, room, n, patch, P) {
  const h = playPatch(ctx, null, dest, room, banjoNote({ ...n, gain: BANJO_SYNTH_LEVEL * (n.gain ?? 1) }, patch, P), null, { at: n.at });
  return { stop(t = 0) { h.stop(Math.max(0.004, t / 3)); } };
}
