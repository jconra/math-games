// SOUNDS, all made on the spot with Web Audio (no sound files): the wind, the hand saw, the hammer and nails, boards
// clattering on the pile, a joint popping, boards hitting the ground, the big crash, a friendly chime for a right
// answer, and a quiet building-yard bed under it all (birds, the mill creaking, somebody else sawing and hammering
// down the hill). Nothing plays until the first tap or click (browsers keep sound off until then).
//
// Every sound takes an optional start time `at` (seconds on the audio clock), so a whole scene can be laid out ahead
// of time and rendered offline: renderOffline(seconds, (S) => { S.saw(8, 3, 0.5); ... }) gives back an AudioBuffer.

let A = null;            // the live audio: { ctx, master, sfx, amb, duck, far, noise, wind, offline }
let live = null;         // (kept while an offline render borrows A)
let volume = 0.8, muted = false;
try { const v = JSON.parse(localStorage.getItem('bm-windmill-vol')); if (v) { volume = +v.volume || 0; muted = !!v.muted; } } catch (e) { /* no storage: defaults */ }

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// the mixing desk: sounds -> sfx -> master -> a gentle limiter -> speakers; the yard bed -> amb -> duck -> master;
// far-off work -> far (muffled, with a little echo off the hills) -> amb
function makeDesk(ctx, offline) {
  const D = { ctx, offline, wind: null };
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.12;
  lim.connect(ctx.destination);
  D.master = ctx.createGain(); D.master.gain.value = offline ? 0.7 : (muted ? 0 : volume * 0.7 / 0.8); D.master.connect(lim);
  D.sfx = ctx.createGain(); D.sfx.connect(D.master);
  D.duck = ctx.createGain(); D.duck.connect(D.master);
  D.amb = ctx.createGain(); D.amb.gain.value = 1.3; D.amb.connect(D.duck);
  // far away: lowpassed and quieter, with a slap of echo
  D.far = ctx.createBiquadFilter(); D.far.type = 'lowpass'; D.far.frequency.value = 1800; D.far.Q.value = 0.5;
  const farG = ctx.createGain(); farG.gain.value = 0.32; D.far.connect(farG); farG.connect(D.amb);
  const dl = ctx.createDelay(1); dl.delayTime.value = 0.31; const fb = ctx.createGain(); fb.gain.value = 0.28;
  const dlLo = ctx.createBiquadFilter(); dlLo.type = 'lowpass'; dlLo.frequency.value = 900;
  const wet = ctx.createGain(); wet.gain.value = 0.4;
  farG.connect(dl); dl.connect(dlLo); dlLo.connect(fb); fb.connect(dl); dlLo.connect(wet); wet.connect(D.amb);
  // two seconds of white noise, reused by everything that hisses
  D.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = D.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return D;
}

export function audioOn() {
  if (A && !A.offline) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  A = live = makeDesk(new AC(), false);
  startYard();
}
const ok = () => !!A && (A.offline || A.ctx.state === 'running');
const now = (at) => (at === undefined || at === null ? A.ctx.currentTime : at);

// ── volume ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function setVolume(v, mute = muted) {
  volume = clamp(v, 0, 1); muted = !!mute;
  try { localStorage.setItem('bm-windmill-vol', JSON.stringify({ volume, muted })); } catch (e) { /* fine */ }
  if (live) live.master.gain.setTargetAtTime(muted ? 0 : volume * 0.7 / 0.8, live.ctx.currentTime, 0.03);
}
export const getVolume = () => ({ volume, muted });

// ── building blocks ──────────────────────────────────────────────────────────────────────────────────────────────
function noise(t0, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.5, attack = 0.005, freqTo = null, dest } = {}) {
  const c = A.ctx, src = c.createBufferSource(); src.buffer = A.noise; src.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(dest || A.sfx); src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
}
function tone(t0, dur, { freq = 200, freqTo = null, type = 'sine', gain = 0.4, attack = 0.004, dest } = {}) {
  const c = A.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (freqTo) o.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest || A.sfx); o.start(t0); o.stop(t0 + dur + 0.05);
}
// a ringing that dies away (one mode of a struck board or a nail): fast attack, exponential decay
function ring(t0, freq, gain, decay, dest) {
  const c = A.ctx, o = c.createOscillator(); o.frequency.value = freq;
  const g = c.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.0015); g.gain.setTargetAtTime(0, t0 + 0.0015, decay / 3);
  o.connect(g); g.connect(dest || A.sfx); o.start(t0); o.stop(t0 + decay * 2 + 0.05);
}
const panned = (dest, pan) => { const p = A.ctx.createStereoPanner(); p.pan.value = pan; p.connect(dest); return p; };

// a board struck somewhere: the free-bar modes (1 : 2.76 : 5.40) ring briefly, with a clack of contact noise on top
function knock(t, f, gain, decay, { bright = 1, dest } = {}) {
  ring(t, f, gain, decay, dest);
  ring(t, f * 2.76 * rnd(0.98, 1.02), gain * 0.45, decay * 0.55, dest);
  ring(t, f * 5.40 * rnd(0.97, 1.03), gain * 0.2 * bright, decay * 0.3, dest);
  noise(t, 0.025, { freq: clamp(f * 6, 900, 4200), q: 1.3, gain: gain * 0.9 * bright, attack: 0.001, dest });
}

// ── wood handling: a hollow board clack (longer boards sound lower) ──────────────────────────────────────────────
// kind: 'pick' (lifted off the pile, knocking its neighbours), 'set' (laid down / back on the pile), 'drop' (falls
// on the bench after a cut: a clack and a couple of bounces)
const boardPitch = (len) => clamp(330 * Math.pow(8 / clamp(len || 4, 0.5, 16), 0.45), 230, 900);
export function clatter(len = 4, kind = 'set', at, level = 1) {
  if (!ok()) return; const t = now(at), f = boardPitch(len) * rnd(0.96, 1.04), v = rnd(0.85, 1.1) * 0.7 * level;
  const dec = clamp(0.06 + len * 0.012, 0.07, 0.17);
  if (kind === 'pick') {
    noise(t, 0.16, { freq: 1800, q: 0.8, gain: 0.06 * v, attack: 0.03 });                     // a short scrape off the pile
    knock(t + 0.03, f * 1.05, 0.22 * v, dec * 0.8, { bright: 0.8 });
    knock(t + 0.03 + rnd(0.06, 0.09), f * 0.9, 0.12 * v, dec * 0.7, { bright: 0.6 });           // nudging the next board
  } else if (kind === 'drop') {
    knock(t, f, 0.5 * v, dec, { bright: 1.1 });
    knock(t + rnd(0.08, 0.1), f * 1.03, 0.24 * v, dec * 0.8);
    knock(t + rnd(0.15, 0.18), f * 0.98, 0.1 * v, dec * 0.6, { bright: 0.7 });
    knock(t + rnd(0.2, 0.23), f * 1.02, 0.04 * v, dec * 0.5, { bright: 0.5 });
  } else {
    knock(t, f, 0.42 * v, dec, { bright: 1 });
    knock(t + rnd(0.035, 0.07), f * rnd(0.92, 0.97), 0.3 * v, dec * 0.9);                     // the other end lands
    knock(t + rnd(0.13, 0.16), f * 1.04, 0.08 * v, dec * 0.6, { bright: 0.6 });                // a little rattle
  }
}
export function clunk(len = 4) { clatter(len, 'set'); }

// ── the hand saw ─────────────────────────────────────────────────────────────────────────────────────────────────
// one stroke: noise through the saw's bright band plus the board's own low ring, chopped by the teeth (a tooth-rate
// tremolo that speeds up and slows with the arm), louder and brighter on the push than on the pull
function stroke(t, dur, { push = true, depth = 0, gain = 1, dest } = {}) {
  const c = A.ctx, src = c.createBufferSource(); src.buffer = A.noise; src.loop = true;
  const lift = 1 + depth * 0.22;                                           // the kerf deepens: the pitch climbs a little
  const hi = c.createBiquadFilter(); hi.type = 'bandpass'; hi.Q.value = 1.1;
  const base = (push ? 3300 : 2500) * lift;
  hi.frequency.setValueAtTime(base * 0.85, t); hi.frequency.linearRampToValueAtTime(base * 1.1, t + dur * 0.5); hi.frequency.linearRampToValueAtTime(base * 0.9, t + dur);
  const body = c.createBiquadFilter(); body.type = 'bandpass'; body.Q.value = 6; body.frequency.value = 520 * lift;
  const bodyG = c.createGain(); bodyG.gain.value = push ? 1.6 : 1.0;
  // the teeth: an upside-down ramp (each tooth snaps, then fades) driving the level
  const am = c.createGain(); am.gain.value = 0.5;
  const teeth = c.createOscillator(); teeth.type = 'sawtooth';
  const rate = push ? 125 : 95;
  teeth.frequency.setValueAtTime(rate * 0.5, t); teeth.frequency.linearRampToValueAtTime(rate, t + dur * 0.45); teeth.frequency.linearRampToValueAtTime(rate * 0.55, t + dur);
  const tg = c.createGain(); tg.gain.value = -0.5; teeth.connect(tg); tg.connect(am.gain);
  const env = c.createGain(), peak = (push ? 0.85 : 0.45) * gain;           // (the arm: speeds up, carries, eases off)
  env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(peak, t + dur * 0.3);
  env.gain.setValueAtTime(peak, t + dur * 0.62); env.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(hi); hi.connect(am); src.connect(body); body.connect(bodyG); bodyG.connect(am); am.connect(env); env.connect(dest || A.sfx);
  src.start(t, Math.random()); src.stop(t + dur + 0.05); teeth.start(t); teeth.stop(t + dur + 0.05);
}
// a run of strokes; returns when it ends
function sawRun(t, n, { gain = 1, dest, tempo = 1 } = {}) {
  for (let i = 0; i < n; i++) {
    const push = i % 2 === 0, dur = (push ? 0.17 : 0.145) * tempo * rnd(0.93, 1.07);
    const g = gain * (i === 0 ? 0.6 : 1) * rnd(0.9, 1.08);                  // the first stroke is a gentle start
    stroke(t, dur, { push, depth: i / Math.max(1, n - 1), gain: g, dest });
    t += dur + rnd(0.015, 0.03) * tempo;
  }
  return t;
}
// cut a board of length `len` at `cutAt` feet: the strokes, a lighter last stroke, the fibres giving, the off-cut
// dropping on the bench
export function saw(len = 8, cutAt = len / 2, at) {
  if (!ok()) return; let t = now(at);
  const n = clamp(5 + Math.round(len / 4), 5, 8);
  t = sawRun(t, n);
  stroke(t, 0.11, { push: true, depth: 1.1, gain: 0.35 });                  // the last light stroke
  t += 0.12;
  noise(t, 0.04, { type: 'highpass', freq: 2500, gain: 0.12, attack: 0.002 });   // the last fibres snapping
  const off = clamp(Math.min(cutAt, len - cutAt), 0.5, len);
  clatter(off, 'drop', t + 0.06, 0.55);
}

// ── the hammer ───────────────────────────────────────────────────────────────────────────────────────────────────
// one blow: no ringing tones at all (those read as a percussion instrument). A hammer on a nail is a CRACK: a short
// broad burst of noise, like a clap, with a couple of tiny echoes a few milliseconds apart, over a dull thump of the board.
// As the nail sinks (sink 0..1) the crack gets drier and tighter; the last blow, nail seated, is mostly a dead thump.
function blow(t, sink, { last = false, gain = 1, dest, pitch = 1 } = {}) {
  gain *= 1.1;
  const crack = (last ? 0.35 : 1) * gain, f = (1700 + 600 * sink) * pitch * rnd(0.92, 1.08);
  noise(t, 0.03 - 0.01 * sink, { freq: f, q: 0.6, gain: 0.75 * crack, attack: 0.0006, dest });            // the crack
  noise(t + 0.004, 0.018, { freq: f * 1.6, q: 0.8, gain: 0.35 * crack, attack: 0.0006, dest });           // its rattle
  noise(t + rnd(0.009, 0.013), 0.014, { freq: f * 0.8, q: 0.7, gain: 0.2 * crack, attack: 0.0006, dest });
  noise(t, last ? 0.09 : 0.05, { type: 'lowpass', freq: last ? 380 : 520 + 200 * sink, gain: (last ? 0.8 : 0.45) * gain, attack: 0.001, dest });   // the board's thump
}
function nailBlows(t, { gain = 1, dest, pitch = 1, gap = 1 } = {}) {
  const n = Math.random() < 0.5 ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const g = gain * (i === 0 ? 0.55 : rnd(0.85, 1.05));                    // a light tap to set the nail, then swings
    blow(t, i / (n - 1), { last, gain: g, dest, pitch });
    if (!last) t += (i === 0 ? 0.3 : 0.36) * gap * rnd(0.88, 1.14);
  }
  return t;
}
// nail a board: `nails` nails (a board touching at both ends gets two), a short pause between them
export function hammer(nails = 1, at) {
  if (!ok()) return; let t = now(at);
  for (let k = 0; k < clamp(nails | 0, 1, 3); k++) {
    t = nailBlows(t, { pitch: k ? rnd(0.9, 0.96) : rnd(1, 1.06) });
    t += rnd(0.45, 0.6);
  }
}

// ── the yard: a quiet bed of life around the hill ────────────────────────────────────────────────────────────────
function bird(t, pan) {
  const d = panned(A.amb, pan), kind = pick(['tweet', 'tweet', 'whistle', 'trill']), g = rnd(0.015, 0.035);
  const note = (at, dur, f0, f1, gg) => {
    const o = A.ctx.createOscillator(); o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const e = A.ctx.createGain(); e.gain.setValueAtTime(0.0001, at); e.gain.exponentialRampToValueAtTime(gg, at + dur * 0.25); e.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(e); e.connect(d); o.start(at); o.stop(at + dur + 0.02);
  };
  if (kind === 'tweet') {
    const n = 2 + ((Math.random() * 4) | 0), f = rnd(3200, 4400);
    for (let i = 0; i < n; i++) note(t + i * rnd(0.09, 0.12), 0.055, f * 0.85, f * 1.25, g);
  } else if (kind === 'whistle') {               // a falling, liquid little song
    let f = rnd(3600, 4200), at = t;
    for (let i = 0; i < 4; i++) { const dur = rnd(0.1, 0.2); note(at, dur, f, f * rnd(0.8, 0.92), g); at += dur + 0.03; f *= rnd(0.82, 0.93); }
  } else {
    const n = 8 + ((Math.random() * 6) | 0), f = rnd(4200, 5200);
    for (let i = 0; i < n; i++) note(t + i * 0.045, 0.035, f, f * 0.9, g * 0.7);
  }
}
// the mill's wooden creak: stick-slip, a slow buzz of little catches through the timber's resonances
function creak(t, pan) {
  const c = A.ctx, d = panned(A.amb, pan), dur = rnd(0.7, 1.2);
  const o = c.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(rnd(14, 20), t); o.frequency.linearRampToValueAtTime(rnd(32, 45), t + dur * 0.55); o.frequency.linearRampToValueAtTime(rnd(18, 24), t + dur);
  const b1 = c.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = rnd(560, 760); b1.Q.value = 9;
  const b2 = c.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = rnd(1250, 1600); b2.Q.value = 7;
  const e = c.createGain(), g = rnd(0.08, 0.12);
  e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + dur * 0.4); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(b1); o.connect(b2); b1.connect(e); b2.connect(e); e.connect(d); o.start(t); o.stop(t + dur + 0.05);
}
const yard = { bird: 0, creak: 0, hammer: 0, saw: 0, until: 0 };
// lay out the yard's sounds between t0 and t1 (called a little ahead of the clock while live, or all at once offline)
function yardBetween(t0, t1) {
  if (!yard.until) { yard.bird = t0 + rnd(1, 3); yard.creak = t0 + rnd(0.5, 2.5); yard.hammer = t0 + rnd(2.5, 5); yard.saw = t0 + rnd(7, 11); }
  while (yard.bird < t1) { if (yard.bird >= t0 - 0.05) bird(yard.bird, rnd(-0.8, 0.8)); yard.bird += rnd(3.5, 9); }
  while (yard.creak < t1) { if (yard.creak >= t0 - 0.05) creak(yard.creak, 0.25); yard.creak += rnd(4.5, 8); }
  while (yard.hammer < t1) {
    if (yard.hammer >= t0 - 0.05) {
      const d = panned(A.far, -0.45); let t = yard.hammer;
      for (let k = 0, n = 1 + ((Math.random() * 2) | 0); k < n; k++) t = nailBlows(t, { gain: rnd(0.2, 0.32), dest: d, pitch: rnd(0.85, 1), gap: 1.35 }) + rnd(0.8, 1.3);
      yard.hammer = t;
    }
    yard.hammer += rnd(6, 14);
  }
  while (yard.saw < t1) {
    if (yard.saw >= t0 - 0.05) { const d = panned(A.far, 0.5); yard.saw = sawRun(yard.saw, 8 + ((Math.random() * 6) | 0), { gain: 0.8, dest: d, tempo: 1.4 }); }
    yard.saw += rnd(16, 30);
  }
  yard.until = t1;
}
let yardTimer = 0;
function startYard() {
  if (yardTimer) return;
  yardTimer = setInterval(() => {
    if (!live || live.ctx.state !== 'running' || A !== live) return;
    const t = live.ctx.currentTime;
    if (yard.until && yard.until < t) yard.until = 0, yardBetween(t, t + 1.5);
    else yardBetween(Math.max(t, yard.until || t), t + 1.5);
  }, 500);
}
// the yard as one offline stretch (for test renders)
export function ambience(t0, t1) { if (!ok()) return; const keep = { ...yard }; yard.until = 0; yardBetween(t0, t1); Object.assign(yard, keep); }

// ── the wind: a steady hiss through two moving filters; level 0..1 (a breeze is about 0.25, a big gust 1) ───────
export function setWind(level, at) {
  if (!ok()) return;
  if (!A.wind) {
    const c = A.ctx, src = c.createBufferSource(); src.buffer = A.noise; src.loop = true;
    const lo = c.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 400;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 2.5;
    const g = c.createGain(); g.gain.value = 0; const g2 = c.createGain(); g2.gain.value = 0;
    src.connect(lo); lo.connect(g); g.connect(A.sfx); src.connect(bp); bp.connect(g2); g2.connect(A.sfx); src.start(now(at));
    A.wind = { lo, bp, g, g2 };
  }
  const t = now(at), l = Math.max(0, Math.min(1.2, level)), w = A.wind;
  w.g.gain.setTargetAtTime(l * 0.55, t, 0.15);
  w.g2.gain.setTargetAtTime(l * l * 0.22, t, 0.1);
  w.lo.frequency.setTargetAtTime(250 + l * 650, t, 0.2);
  w.bp.frequency.setTargetAtTime(500 + l * 900 + Math.random() * 200, t, 0.3);   // (the whistle wanders)
  // the yard ducks under a real wind (a building breeze leaves it alone)
  A.duck.gain.setTargetAtTime(1 - clamp((l - 0.15) / 0.35, 0, 0.85), t, 0.25);
}

// a joint popping apart: a sharp crack
export function crack(at) {
  if (!ok()) return; const t = now(at);
  noise(t, 0.09, { type: 'highpass', freq: 1800, gain: 0.55, attack: 0.002 });
  tone(t, 0.07, { freq: 900, freqTo: 300, type: 'square', gain: 0.08 });
}
// a board hitting the ground (big = how hard)
export function thud(big = 0.5, at) {
  if (!ok()) return; const t = now(at);
  tone(t, 0.25, { freq: 110 + Math.random() * 40, freqTo: 50, gain: 0.25 + big * 0.35 });
  noise(t, 0.12, { freq: 900 + Math.random() * 900, q: 4, gain: 0.15 + big * 0.25 });   // the wood's clack
}
// the whole tower coming down: a long roar, timbers splintering, and boards landing all over
export function crash(at) {
  if (!ok()) return; const t = now(at);
  noise(t, 1.8, { type: 'lowpass', freq: 2200, freqTo: 300, gain: 0.45, attack: 0.02 });
  for (let i = 0; i < 9; i++) {
    const s = t + 0.05 + Math.random() * 1.3;
    noise(s, 0.1, { freq: 1200 + Math.random() * 2000, q: 5, gain: 0.25 + Math.random() * 0.15 });
    tone(s, 0.3, { freq: 70 + Math.random() * 60, freqTo: 40, gain: 0.25 });
  }
  // splintering: bursts of tiny cracks while it leans and goes
  for (let i = 0; i < 26; i++) noise(t + Math.pow(Math.random(), 1.5) * 0.9, rnd(0.015, 0.04), { type: 'highpass', freq: rnd(1800, 4000), gain: rnd(0.08, 0.22), attack: 0.001 });
  // the boards landing and bouncing
  for (let i = 0; i < 10; i++) clatter(rnd(1.5, 8), 'drop', t + 0.5 + Math.random() * 1.5);
}
// a right answer: two bright notes. A miss: one soft low note (no buzzer: there is no penalty)
export function chime(at) { if (!ok()) return; const t = now(at); tone(t, 0.35, { freq: 784, gain: 0.25, type: 'triangle' }); tone(t + 0.12, 0.5, { freq: 1175, gain: 0.25, type: 'triangle' }); }
export function soft(at) { if (!ok()) return; const t = now(at); tone(t, 0.4, { freq: 330, freqTo: 294, gain: 0.18, type: 'triangle' }); }

// ── offline rendering (for listening tests): lay out a scene with `script(S, ctx)` and get the AudioBuffer ───────
export async function renderOffline(seconds, script, { sampleRate = 44100, channels = 2 } = {}) {
  const keep = A, keepYard = { ...yard };
  const off = new OfflineAudioContext(channels, Math.ceil(seconds * sampleRate), sampleRate);
  A = makeDesk(off, true); yard.until = 0;
  try { script({ saw, hammer, clatter, clunk, setWind, crack, thud, crash, chime, soft, ambience }, off); }
  finally { A = keep; Object.assign(yard, keepYard); }
  return off.startRendering();
}
