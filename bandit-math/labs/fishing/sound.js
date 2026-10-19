// SOUNDS at the lake, all made on the spot with Web Audio (no sound files): water lapping at the dock, now and then a
// bird or a frog, the whoosh of a cast, the bobber's plop, the nibble and the bite, the reel's ratchet, the drag
// buzzing when a fish runs, splashes, a friendly chime for a right answer and a soft note for a wrong one. Splashes,
// clicks and plops are shaped noise (they ring like glass when made from tones); only the chime, the soft note and the
// birds are tones. Nothing plays until the first tap or click (browsers keep sound off until then).

let A = null;            // { ctx, master, sfx, amb, noise }
let volume = 0.8, muted = false;
const KEY = 'bm-fishing-vol';
try { const v = JSON.parse(localStorage.getItem(KEY)); if (v) { volume = Math.max(0, Math.min(1, +v.volume || 0)); muted = !!v.muted; } } catch (e) { /* no storage: defaults */ }
const rnd = (a, b) => a + Math.random() * (b - a);

export function audioOn() {
  if (A) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const ctx = new AC();
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -8; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.15; lim.connect(ctx.destination);
  const master = ctx.createGain(); master.gain.value = muted ? 0 : volume; master.connect(lim);
  const sfx = ctx.createGain(); sfx.connect(master);
  const amb = ctx.createGain(); amb.gain.value = 0.9; amb.connect(master);
  // two seconds of white noise, shared by every noisy sound
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  A = { ctx, master, sfx, amb, noise };
  lapping(); setTimeout(critters, 3000);
}
export function setVolume(v, mute = muted) {
  volume = Math.max(0, Math.min(1, v)); muted = !!mute;
  if (A) A.master.gain.setTargetAtTime(muted ? 0 : volume, A.ctx.currentTime, 0.05);
  try { localStorage.setItem(KEY, JSON.stringify({ volume, muted })); } catch (e) { /* no storage */ }
}
export const getVolume = () => ({ volume, muted });
const ok = () => A && A.ctx.state === 'running';

// a burst of filtered noise. type: the filter (bandpass / lowpass / highpass), freq (to freqTo), q, gain, attack, dur
function noise(t, dur, { type = 'bandpass', freq = 1000, freqTo = null, q = 1, gain = 0.3, attack = 0.005, dest = null } = {}) {
  const { ctx } = A, src = ctx.createBufferSource(); src.buffer = A.noise; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest || A.sfx);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}
function tone(t, dur, { freq = 440, freqTo = null, type = 'sine', gain = 0.2, attack = 0.01, dest = null } = {}) {
  const { ctx } = A, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (freqTo) o.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || A.sfx); o.start(t); o.stop(t + dur + 0.05);
}

// ── the lake around you ──────────────────────────────────────────────────────────────────────────────────────────────
// water lapping at the posts: soft low noise swelling and falling, a slow wave every couple of seconds
function lapping() {
  const { ctx } = A, src = ctx.createBufferSource(); src.buffer = A.noise; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 0.6;
  const g = ctx.createGain(); g.gain.value = 0.0;
  src.connect(f); f.connect(g); g.connect(A.amb); src.start();
  const swell = () => {
    if (!A) return; const t = ctx.currentTime, p = rnd(1.6, 3.2);
    g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(rnd(0.05, 0.09), t, p * 0.25); g.gain.setTargetAtTime(0.015, t + p * 0.45, p * 0.2);
    f.frequency.setTargetAtTime(rnd(380, 700), t, 0.4);
    // a little slap against a post now and then
    if (Math.random() < 0.5 && ok()) noise(t + p * 0.35, 0.12, { freq: rnd(500, 900), q: 1.4, gain: 0.05, attack: 0.01, dest: A.amb });
    setTimeout(swell, p * 1000);
  };
  swell();
}
// a songbird's quick chirps, or a frog's croak (noise through a low, ringing filter, pulsed), now and then
function critters() {
  if (!A) return;
  if (ok()) {
    const t = A.ctx.currentTime + 0.05;
    if (Math.random() < 0.6) {
      const base = rnd(2400, 3600), n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) tone(t + i * rnd(0.09, 0.14), 0.08, { freq: base * rnd(0.9, 1.15), freqTo: base * rnd(1.15, 1.4), gain: 0.025, attack: 0.008, dest: A.amb });
    } else {
      const n = 2 + Math.floor(Math.random() * 3), f = rnd(140, 220);
      for (let i = 0; i < n; i++) noise(t + i * 0.13, 0.09, { freq: f, q: 9, gain: 0.08, attack: 0.012, dest: A.amb });
    }
  }
  setTimeout(critters, rnd(3500, 9000));
}

// ── fishing ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export function whoosh() { if (!ok()) return; const t = A.ctx.currentTime; noise(t, 0.32, { freq: 600, freqTo: 2600, q: 0.8, gain: 0.16, attack: 0.08 }); noise(t + 0.25, 0.5, { freq: 3800, freqTo: 1800, q: 2, gain: 0.03, attack: 0.05 }); }
// the bobber landing: a low "plup" (a fast falling band of noise) and a few drops
export function plop(size = 1) {
  if (!ok()) return; const t = A.ctx.currentTime;
  noise(t, 0.14, { freq: 900 * size, freqTo: 260, q: 3, gain: 0.32, attack: 0.004 });
  noise(t, 0.08, { type: 'lowpass', freq: 400, gain: 0.25, attack: 0.002 });
  for (let i = 0; i < 3; i++) noise(t + 0.08 + i * rnd(0.04, 0.08), 0.05, { freq: rnd(1400, 2600), q: 6, gain: 0.05 });
}
export function nibble() { if (!ok()) return; const t = A.ctx.currentTime; noise(t, 0.07, { freq: 700, freqTo: 400, q: 4, gain: 0.12, attack: 0.004 }); }
export function bite() { if (!ok()) return; const t = A.ctx.currentTime; noise(t, 0.2, { freq: 700, freqTo: 180, q: 3, gain: 0.4, attack: 0.004 }); splash(0.6, 0.05); }
export function splash(big = 1, delay = 0) {
  if (!ok()) return; const t = A.ctx.currentTime + delay;
  noise(t, 0.25 + big * 0.35, { type: 'highpass', freq: 900, gain: 0.18 + big * 0.18, attack: 0.006 });
  noise(t, 0.18 + big * 0.2, { freq: 600, freqTo: 200, q: 1.2, gain: 0.2 + big * 0.2, attack: 0.004 });
  for (let i = 0; i < 4 + big * 6; i++) noise(t + 0.1 + Math.random() * (0.3 + big * 0.4), 0.05, { freq: rnd(1200, 3200), q: 5, gain: 0.04 + big * 0.03 });
}
// one click of the reel's ratchet (the page calls it as the handle turns)
export function click(speed = 1) { if (!ok()) return; const t = A.ctx.currentTime; noise(t, 0.022, { type: 'highpass', freq: 2600 + speed * 900, gain: 0.07, attack: 0.001 }); }
// the drag buzzing as the fish takes line: quick clicks running together
export function drag(ms = 500) { if (!ok()) return; const t = A.ctx.currentTime; for (let i = 0; i < ms / 18; i++) noise(t + i * 0.018, 0.016, { type: 'highpass', freq: 3600, gain: 0.06, attack: 0.001 }); }
export function landed() { if (!ok()) return; splash(1.2); }
// a fish slapping into the creel, wet
export function slap() { if (!ok()) return; const t = A.ctx.currentTime; noise(t, 0.09, { type: 'lowpass', freq: 1400, gain: 0.35, attack: 0.002 }); noise(t + 0.01, 0.05, { freq: 2500, q: 2, gain: 0.08 }); }
export function chime() { if (!ok()) return; const t = A.ctx.currentTime; tone(t, 0.35, { freq: 784, gain: 0.22, type: 'triangle' }); tone(t + 0.12, 0.5, { freq: 1175, gain: 0.22, type: 'triangle' }); }
export function soft() { if (!ok()) return; const t = A.ctx.currentTime; tone(t, 0.4, { freq: 330, freqTo: 294, gain: 0.16, type: 'triangle' }); }
// a new biggest fish: three rising notes
export function record() { if (!ok()) return; const t = A.ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.11, 0.4, { freq: f, gain: 0.16, type: 'triangle' })); }
