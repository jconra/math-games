// SOUNDS, all made on the spot with Web Audio (no sound files): the wind, the saw, the hammer, a joint popping, boards
// hitting the ground, the big crash, and a friendly chime for a right answer. Nothing plays until the first tap or click
// (browsers keep sound off until then).
let ctx = null, master = null, noiseBuf = null, wind = null;

export function audioOn() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
  // two seconds of white noise, reused by everything that hisses
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
const ok = () => !!ctx && ctx.state === 'running';
function noise(t0, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.5, attack = 0.005, freqTo = null } = {}) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
}
function tone(t0, dur, { freq = 200, freqTo = null, type = 'sine', gain = 0.4, attack = 0.004 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (freqTo) o.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}

// the wind: a steady hiss through two moving filters; level 0..1 (a breeze is about 0.25, a big gust 1)
export function setWind(level) {
  if (!ok()) return;
  if (!wind) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const lo = ctx.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 400;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 2.5;
    const g = ctx.createGain(); g.gain.value = 0; const g2 = ctx.createGain(); g2.gain.value = 0;
    src.connect(lo); lo.connect(g); g.connect(master); src.connect(bp); bp.connect(g2); g2.connect(master); src.start();
    wind = { lo, bp, g, g2, level: 0 };
  }
  const t = ctx.currentTime, l = Math.max(0, Math.min(1.2, level));
  wind.g.gain.setTargetAtTime(l * 0.55, t, 0.15);
  wind.g2.gain.setTargetAtTime(l * l * 0.22, t, 0.1);
  wind.lo.frequency.setTargetAtTime(250 + l * 650, t, 0.2);
  wind.bp.frequency.setTargetAtTime(500 + l * 900 + Math.random() * 200, t, 0.3);   // (the whistle wanders)
}

// the saw: a few back-and-forth strokes
export function saw() {
  if (!ok()) return; const t = ctx.currentTime;
  for (let i = 0; i < 4; i++) noise(t + i * 0.16, 0.14, { freq: i % 2 ? 2600 : 3400, q: 3, gain: 0.25, attack: 0.03, freqTo: i % 2 ? 3300 : 2500 });
  tone(t + 0.66, 0.12, { freq: 180, freqTo: 90, gain: 0.25 });       // the piece drops on the bench
}
// three hammer taps (the nails going in)
export function hammer(n = 3) {
  if (!ok()) return; const t = ctx.currentTime;
  for (let i = 0; i < n; i++) { noise(t + i * 0.13, 0.05, { freq: 3200, q: 1.5, gain: 0.5 }); tone(t + i * 0.13, 0.08, { freq: 260 - i * 15, freqTo: 140, gain: 0.35 }); }
}
// a joint popping apart: a sharp crack
export function crack() {
  if (!ok()) return; const t = ctx.currentTime;
  noise(t, 0.09, { type: 'highpass', freq: 1800, gain: 0.55, attack: 0.002 });
  tone(t, 0.07, { freq: 900, freqTo: 300, type: 'square', gain: 0.08 });
}
// a board hitting the ground (big = how hard)
export function thud(big = 0.5) {
  if (!ok()) return; const t = ctx.currentTime;
  tone(t, 0.25, { freq: 110 + Math.random() * 40, freqTo: 50, gain: 0.25 + big * 0.35 });
  noise(t, 0.12, { freq: 900 + Math.random() * 900, q: 4, gain: 0.15 + big * 0.25 });   // the wood's clack
}
// the whole tower coming down: a long roar of splintering with thumps in it
export function crash() {
  if (!ok()) return; const t = ctx.currentTime;
  noise(t, 1.8, { type: 'lowpass', freq: 2200, freqTo: 300, gain: 0.6, attack: 0.02 });
  for (let i = 0; i < 9; i++) {
    const at = t + 0.05 + Math.random() * 1.3;
    noise(at, 0.1, { freq: 1200 + Math.random() * 2000, q: 5, gain: 0.3 + Math.random() * 0.2 });
    tone(at, 0.3, { freq: 70 + Math.random() * 60, freqTo: 40, gain: 0.3 });
  }
}
// a right answer: two bright notes. A miss: one soft low note (no buzzer: there is no penalty)
export function chime() { if (!ok()) return; const t = ctx.currentTime; tone(t, 0.35, { freq: 784, gain: 0.25, type: 'triangle' }); tone(t + 0.12, 0.5, { freq: 1175, gain: 0.25, type: 'triangle' }); }
export function soft() { if (!ok()) return; const t = ctx.currentTime; tone(t, 0.4, { freq: 330, freqTo: 294, gain: 0.18, type: 'triangle' }); }
// a board dropped on the pile
export function clunk() { if (!ok()) return; const t = ctx.currentTime; tone(t, 0.18, { freq: 160, freqTo: 80, gain: 0.35 }); noise(t, 0.08, { freq: 700, q: 3, gain: 0.2 }); }
