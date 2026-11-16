// MATHBALL'S SOUNDS, made in the browser as it plays (no files): a port's thump as a ball is shot out, a soft knock as
// one lands, a bright rising chime for a right ball (its strike's crackle with it), a low buzz for a ball that bounces
// back out, a sweep as a goal's rule changes, a short fanfare at the end. Knocks are noise, not tones (the game's
// maker: ringing tones sound like glass balls). Quiet, and silent until the first press (browsers ask for one).
//   const S = makeSound()   S.play(name, { gain, pan })   S.dispose()
export function makeSound() {
  let ctx = null, master = null, noise = null, last = {};
  function ready() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.32; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  const out = (gain = 1, pan = 0) => {
    const g = ctx.createGain(); g.gain.value = gain;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(master); } else g.connect(master);
    return g;
  };
  function burst(t, dur, f0, f1, gain, pan, type = 'lowpass', q = 1) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = out(0, pan); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); s.start(t); s.stop(t + dur + 0.05);
  }
  function tone(t, dur, f0, f1, gain, pan, type = 'sine') {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = out(0, pan); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }
  const SOUNDS = {
    launch: (t, k, p) => { burst(t, 0.18, 900, 120, 0.5 * k, p); tone(t, 0.16, 120, 60, 0.25 * k, p); },
    knock: (t, k, p) => burst(t, 0.07, 1400, 300, 0.22 * k, p, 'bandpass', 1.2),
    grab: (t, k, p) => burst(t, 0.06, 2200, 800, 0.16 * k, p, 'bandpass', 2),
    throw: (t, k, p) => burst(t, 0.22, 400, 2400, 0.14 * k, p, 'bandpass', 1.5),
    score: (t, k, p) => { tone(t, 0.18, 660, 660, 0.18 * k, p, 'triangle'); tone(t + 0.09, 0.32, 990, 990, 0.16 * k, p, 'triangle'); burst(t, 0.5, 6000, 1500, 0.08 * k, p, 'highpass', 0.7); },
    them: (t, k, p) => { tone(t, 0.16, 520, 520, 0.11 * k, p, 'triangle'); tone(t + 0.08, 0.24, 780, 780, 0.09 * k, p, 'triangle'); },
    bounce: (t, k, p) => { tone(t, 0.32, 150, 110, 0.16 * k, p, 'sawtooth'); burst(t, 0.12, 700, 200, 0.2 * k, p); },
    change: (t, k, p) => { tone(t, 0.42, 300, 1200, 0.07 * k, p, 'square'); burst(t + 0.05, 0.3, 3000, 8000, 0.05 * k, p, 'bandpass', 3); },
    end: (t, k) => { [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.12, 0.4, f, f, 0.12 * k, 0, 'triangle')); },
  };
  return {
    play(name, { gain = 1, pan = 0, gap = 0.05 } = {}) {
      if (!ready() || !SOUNDS[name]) return;
      const t = ctx.currentTime; if (last[name] && t - last[name] < gap) return;   // (a burst of knocks is one knock)
      last[name] = t;
      try { SOUNDS[name](t + 0.01, gain, pan); } catch (e) { /* (a browser without some node: silence) */ }
    },
    wake: () => ready(),
    dispose() { if (ctx) { ctx.close().catch(() => {}); ctx = null; } },
  };
}
