// THE CABIN DOOR'S SOUNDS, made sample by sample in the game's sound (src/audio/audio.js), heard from the door: opening,
// the latch's click and a dry wooden creak of the hinges (noise through a narrow band that slides as the door swings,
// shaken in little stick-slip bursts, as wood rubbing on iron does); shutting, a soft creak and the wooden thump of the
// door into its frame. Noise, not ringing tones (impact sounds made of tones sound like glass).
//
//   playDoor(audio, kind, at)   kind: 'open' | 'shut'; at: where the door is in the valley (a Vector3); audio: the game's
//                               sound (A from makeAudio), or null for none
export const DOOR_SOUND = {
  level: 0.5,          // how loud, under the game's master volume
  ref: 3, rolloff: 1.4, // full loudness within ref metres, falling off past that (the ears are the camera)
};

let noiseBuf = null;
function noise(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const n = ctx.sampleRate * 1.5, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let seed = 12345; for (let i = 0; i < n; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 1073741823.5 - 1; }
  return (noiseBuf = b);
}

export function playDoor(audio, kind = 'open', at = null) {
  if (!audio || !audio.ready) return;
  audio.ready((ctx, out) => {
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + 0.01, S = DOOR_SOUND;
    const pan = ctx.createPanner(); pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = S.ref; pan.rolloffFactor = S.rolloff;
    if (at) { if (pan.positionX) { pan.positionX.value = at.x; pan.positionY.value = at.y; pan.positionZ.value = at.z; } else pan.setPosition(at.x, at.y, at.z); }
    const bus = ctx.createGain(); bus.gain.value = S.level; bus.connect(pan); pan.connect(out);
    // a burst of noise through a filter, shaped by an envelope: [time, level] pairs from t0
    const burst = (type, freq, q, env, { from = 0, slide = null, shake = 0 } = {}) => {
      const src = ctx.createBufferSource(); src.buffer = noise(ctx); src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0 + from); f.Q.value = q;
      if (slide) for (const [t, v] of slide) f.frequency.linearRampToValueAtTime(v, t0 + from + t);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t0 + from);
      for (const [t, v] of env) g.gain.linearRampToValueAtTime(v, t0 + from + t);
      src.connect(f); f.connect(g);
      if (shake) {   // (stick-slip: the creak comes in little jerks)
        const lfo = ctx.createOscillator(), depth = ctx.createGain(), am = ctx.createGain();
        lfo.type = 'square'; lfo.frequency.value = shake; depth.gain.value = 0.5; am.gain.value = 0.5;
        lfo.connect(depth); depth.connect(am.gain); g.connect(am); am.connect(bus);
        lfo.start(t0 + from); lfo.stop(t0 + from + env[env.length - 1][0] + 0.05);
      } else g.connect(bus);
      src.start(t0 + from, Math.random() * 0.8); src.stop(t0 + from + env[env.length - 1][0] + 0.05);
    };
    if (kind === 'open') {
      burst('bandpass', 2600, 4, [[0.004, 0.5], [0.04, 0]]);                                                   // the latch
      burst('bandpass', 760, 14, [[0.06, 0.32], [0.3, 0.24], [0.55, 0]], { from: 0.05, slide: [[0.25, 1040], [0.55, 820]], shake: 34 });   // the hinges
    } else {
      burst('bandpass', 900, 14, [[0.05, 0.18], [0.3, 0]], { slide: [[0.3, 700]], shake: 28 });                 // the hinges, closing
      burst('lowpass', 260, 0.8, [[0.008, 0.9], [0.16, 0]], { from: 0.32 });                                    // the door into its frame
      burst('bandpass', 1800, 3, [[0.003, 0.35], [0.03, 0]], { from: 0.33 });                                   // the latch catching
    }
    setTimeout(() => { try { bus.disconnect(); pan.disconnect(); } catch (e) { /* (gone) */ } }, 1500);
  });
}
