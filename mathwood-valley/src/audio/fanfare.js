// THE SHIFT'S FANFARE: a short, gentle bugle call when a job's shift is done (src/shiftkeeper.js). Four notes up a
// major chord, the last one held, on a soft brassy tone (a sawtooth through a low-pass, with a slow swell like a breath
// into a horn), well under the game's own sounds: FANFARE.level into the game's master volume (src/audio/audio.js),
// about the checklist's chime. Nothing plays while the game is held quiet (the title, a panel, the tab hidden).
//
//   playFanfare(audio)   audio: the game's makeAudio(); safe to call before the sound has woken (it just stays quiet)
export const FANFARE = {
  level: 0.06,                                        // loudness into the master volume
  notes: [[392, 0.13], [523.25, 0.13], [659.25, 0.13], [783.99, 0.62]],   // [Hz, seconds]: G, C, E, then G held
  gap: 0.02,                                          // s of air between two notes
  cut: 2200,                                          // Hz: the low-pass that keeps the brass soft
};

export function playFanfare(audio) {
  if (!audio || !audio.ready) return;
  if (audio.need) { audio.need('fanfare', true); setTimeout(() => audio.need('fanfare', false), 2200); }
  audio.ready((ctx, out) => {
    const play = () => {
      if (!audio.running) return;
      let t = ctx.currentTime + 0.04;
      const nodes = [];
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = FANFARE.cut; filter.Q.value = 0.7;
      filter.connect(out); nodes.push(filter);
      for (const [k, [f, len]] of FANFARE.notes.entries()) {
        const last = k === FANFARE.notes.length - 1, g = ctx.createGain(), lv = FANFARE.level * (last ? 1 : 0.8);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(lv, t + 0.03);                          // (the breath in)
        g.gain.setValueAtTime(lv, t + Math.max(0.04, len - (last ? 0.3 : 0.05)));
        g.gain.exponentialRampToValueAtTime(0.0004, t + len + (last ? 0.25 : 0.04));
        g.connect(filter); nodes.push(g);
        // a horn's body: a sawtooth and a quieter square an octave down, with a slow vibrato on the held note
        for (const [type, mul, amp] of [['sawtooth', 1, 0.55], ['square', 0.5, 0.18]]) {
          const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mul;
          if (last) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.value = f * mul * 0.006; lfo.connect(lg).connect(o.frequency); lfo.start(t + 0.15); lfo.stop(t + len + 0.3); nodes.push(lfo, lg); }
          const og = ctx.createGain(); og.gain.value = amp; o.connect(og).connect(g); o.start(t); o.stop(t + len + 0.3); nodes.push(o, og);
        }
        t += len + FANFARE.gap;
      }
      setTimeout(() => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* gone */ } } }, (t - ctx.currentTime + 0.8) * 1000);
    };
    // (the context may be asleep: it wakes on need(), which takes a moment)
    const a = performance.now();
    const wait = () => { if (ctx.state === 'running') play(); else if (performance.now() - a < 700) setTimeout(wait, 40); };
    wait();
  });
}
