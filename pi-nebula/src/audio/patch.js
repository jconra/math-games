// MADE BY THE SOUND LAB, do not edit it here: tools/sync.mjs pi-nebula, from the Sound Lab at commit f073842. Change the engine (engine.js) or a sound (sounds/pi-nebula.js) there and sync again.
// engine.js — the Sound Lab's modular patch engine, and only the engine: no sounds are written here. The sounds
// are plain data in sounds/, one file per project; patch.js puts the two together for the lab's pages, and
// tools/sync.mjs makes each game's copy from them (README: "Using the engine in a game").
// (Phase 1 foundation.)
//
// A *patch* is plain data: a set of typed nodes + cables between them. Every node
// maps to a real Web Audio node, so the wiring IS the synthesis — this is what will
// become the live, editable node graph, and the same playPatch() runtime drops into
// the game later (the game currently has no audio at all).
//
//   patch = {
//     name, dur,                       // dur = render/voice length in seconds
//     nodes: [ { id, type, ...params } ],
//     cables: [ { from, to, port } ],  // port omitted/'in' = audio; else a CV param
//   }
//
// Cable kinds:
//   • audio   — source.out → dest.in            (the signal path)
//   • CV/mod  — source.out → dest.params[port]   (envelope/LFO/S&H → a parameter)
//
// Node types (merged/orthogonal palette):
//   osc    — audio source; at low freq + `level` it doubles as an LFO (absorbs old lfo)
//   noise  — looping stepped random source (motor / sample&hold / white via high freq×steps)
//   filter — biquad ; gain — VCA *and* mixer/bus ; shaper — grit
//   env    — ADSR-ish CV (the "off switch") ; value — constant CV (a patchable knob)
//   send (reverb) ; out (→ destination)
//
// Signature mirrors gunsynth's playShot(ctx, noise, dest, reverbInput, …) so the two
// can be A/B rendered against each other for fidelity.

// ── Shared buffers (same as gunsynth, so noise voices match) ──────────────────────
export function makeNoiseBuffer(ctx, seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
export function makeImpulse(ctx, dur, decay) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

const FLOOR = 0.0005;

// waveshaper curve for grit (identical to gunsynth's)
function distortionCurve(amount) {
  const n = 1024, curve = new Float32Array(n), k = amount * amount * 45;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = (3 + k) * x * 0.3490659 / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// ════════════════════════════════════════════════════════════════════════════════
//  NODE BUILDERS — each returns { in, out, params, starts, at }
//    in     : audio input node (or null for sources / CV generators)
//    out    : audio/CV output node
//    params : { name: AudioParam } — the modulatable plugs a CV cable can target
//    starts : scheduled source nodes needing start()/stop()
//    at     : absolute start time for those sources
// ════════════════════════════════════════════════════════════════════════════════

// oscillator — audio source OR (at low freq + wired to a param) an LFO. `level` is the
// CUSTOM WAVES. An osc with wave 'custom' carries its own harmonic table on the node
// (n.harm = { real, imag }, the two arrays createPeriodicWave takes), chosen from a preset or
// drawn in the editor. The table travels inside the patch, so a patch that uses one plays
// anywhere patch.js does - the game included - with no wave library to ship alongside.
// PeriodicWaves are cached per context and table, since every voice of every note would
// otherwise build one.
const _pwCache = new WeakMap();
function periodicWaveFor(ctx, harm) {
  let byKey = _pwCache.get(ctx); if (!byKey) { byKey = new Map(); _pwCache.set(ctx, byKey); }
  const key = harm.real.join(',') + '|' + harm.imag.join(',');
  let pw = byKey.get(key);
  if (!pw) {
    const n = Math.max(2, Math.min(harm.real.length, harm.imag.length));
    pw = ctx.createPeriodicWave(Float32Array.from(harm.real.slice(0, n)), Float32Array.from(harm.imag.slice(0, n)), { disableNormalization: false });
    byKey.set(key, pw);
  }
  return pw;
}
// output depth, so a slow osc into a param modulates it; this absorbs the old lfo node.
function bOsc(ctx, n, t0) {
  const t = t0;                                                  // sources run from FIRE; timing lives on envelopes
  const out = ctx.createGain(); out.gain.value = n.level ?? 1;   // output level / mod depth
  const voices = n.voices || 1, starts = [];
  for (let i = 0; i < voices; i++) {
    const o = ctx.createOscillator();
    if (n.wave === 'custom' && n.harm && n.harm.imag) o.setPeriodicWave(periodicWaveFor(ctx, n.harm));
    else o.type = n.wave === 'custom' ? 'sine' : (n.wave || 'sine');
    o.frequency.setValueAtTime(n.freq ?? 440, t);              // pitch sweeps come from an ENV into the freq plug (× freqMod)
    o.detune.value = voices > 1 ? (i * 2 - 1) * (n.detune || 0) : (n.detune || 0);
    o.connect(out);
    starts.push(o);
  }
  // freq CV depth: a CV wired into the 'freq' plug (e.g. an ENV) is scaled to Hz by freqMod and
  // summed onto every voice's pitch — so an envelope can sweep pitch with a full ADSR contour.
  const freqMod = ctx.createGain(); freqMod.gain.value = n.freqMod ?? 0;
  starts.forEach(o => freqMod.connect(o.frequency));
  return { in: null, out, params: { freq: freqMod, detune: starts[0].detune, level: out.gain }, starts, at: t };
}

// noise — the one source node for all "random" needs, looping continuously.
//   `steps` random slots per cycle at `freq` Hz — one knob-set spans it all:
//   • white hiss            : crank freq×steps past the sample rate (~48k) → a fresh value every sample
//   • motor/engine texture  : steps≈24-32 at a low freq
//   • sample & hold         : steps=1 → one held random value per 1/freq sec
//   Use it as audio, or wire its output into a param as random CV modulation.
// `rate` = playbackRate (pitch/rev plug; CV in here revs it). `level` = output / mod depth.
// Building a noise buffer is a full pass over `loopLen` seconds of samples, and the sequencer asks
// for one on EVERY drum hit — at sixteenth-note speed that is a few hundred thousand samples a
// second spent purely on setup, before a note has sounded. Keep a small RING per
// (rate, freq, steps, loopLen) signature and draw from it at random.
//
// A ring rather than a single cache, deliberately. One shared buffer would make every shot from a
// gun identical, and per-shot noise variation is a good part of why the gunfire sounds alive; four
// gives successive hits different noise while the generation happens a handful of times instead of
// every time. Keyed on sampleRate too, since an offline render rig runs at its own rate.
const _noiseRing = new Map();
const NOISE_RING = 4;
function noiseBufFor(ctx, n) {
  const key = `${ctx.sampleRate}|${n.freq}|${n.steps}|${n.loopLen}`;
  let ring = _noiseRing.get(key);
  if (!ring) { ring = []; _noiseRing.set(key, ring); }
  if (ring.length < NOISE_RING) { const b = _buildNoiseBuf(ctx, n); ring.push(b); return b; }
  return ring[(Math.random() * ring.length) | 0];
}

function bNoise(ctx, n, t0) {
  const out = ctx.createGain(); out.gain.value = n.level ?? 1;
  const buf = noiseBufFor(ctx, n);
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  src.playbackRate.value = n.rate ?? 1;
  src.connect(out);
  return { in: null, out, params: { rate: src.playbackRate, level: out.gain }, starts: [src], at: t0 };   // runs from FIRE; envelopes do the timing
}

function _buildNoiseBuf(ctx, n) {
  const sr = ctx.sampleRate, f = Math.max(0.1, n.freq || 46);
  const steps = Math.max(1, Math.round(n.steps || 24));
  const period = sr / f;
  const cycles = Math.max(1, Math.round((n.loopLen || 1.2) * f));
  const len = Math.max(1, Math.round(cycles * period));
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const nb = new Float64Array(steps);
  for (let i = 0; i < steps; i++) nb[i] = Math.random() * 2 - 1;
  let phase = 0;
  for (let i = 0; i < len; i++) {
    phase++;
    if (phase >= period) { phase -= period; for (let k = 0; k < steps; k++) nb[k] = Math.random() * 2 - 1; }
    d[i] = nb[Math.min(steps - 1, Math.floor((phase / period) * steps))];
  }
  return buf;
}

// value — a constant control source. Patch its output into any param to set/offset it
// (AudioParam inputs SUM onto the param's own value), e.g. an idle pitch or a manual level.
function bValue(ctx, n, t0) {
  const cs = ctx.createConstantSource(); cs.offset.value = n.value ?? 0;
  return { in: null, out: cs, params: { value: cs.offset }, starts: [cs], at: t0 + (n.delay || 0) };
}

// math (multiply) — a CV utility. Scales the signal wired into its input by `mul` (itself CV-able),
// so ONE source can drive params at very different scales: an ENV that peaks near 1 can feed
// noise.rate directly AND, through a ×800 MULT, sweep an oscillator's frequency by ~800 Hz.
function bMath(ctx, n, t0) {
  const g = ctx.createGain(); g.gain.value = n.mul ?? 1;   // out = in × mul
  return { in: g, out: g, params: { mul: g.gain }, starts: [], at: t0 };
}

function bFilter(ctx, n, t0) {
  const t = t0 + (n.delay || 0);
  const f = ctx.createBiquadFilter();
  f.type = n.ftype || 'lowpass';
  f.Q.value = n.Q ?? 0.7;
  if (n.freqPeak != null) {                                  // 3-point sweep (roar)
    f.frequency.setValueAtTime(n.freq, t);
    f.frequency.linearRampToValueAtTime(n.freqPeak, t + (n.attack || 0.08));
    f.frequency.linearRampToValueAtTime(n.freqEnd, t + (n.dur || 0.6));
  } else if (n.freqEnd != null) {                            // 2-point glide
    f.frequency.setValueAtTime(n.freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, n.freqEnd), t + (n.glide || n.dur || 0.1));
  } else {
    f.frequency.value = n.freq;
  }
  return { in: f, out: f, params: { freq: f.frequency, Q: f.Q }, starts: [], at: t };
}

function bGain(ctx, n) {
  const g = ctx.createGain();
  g.gain.value = n.gain ?? 0;     // VCA: default 0 (driven by an env); attenuators set gain
  return { in: g, out: g, params: { gain: g.gain }, starts: [], at: 0 };
}

function bShaper(ctx, n) {
  const grit = n.grit || 0;
  if (grit <= 0) { const g = ctx.createGain(); return { in: g, out: g, params: {}, starts: [], at: 0 }; }
  const drive = ctx.createGain(); drive.gain.value = 1 + grit * grit * 14;
  const ws = ctx.createWaveShaper(); ws.curve = distortionCurve(grit); ws.oversample = '4x';
  const trim = ctx.createGain(); trim.gain.value = 1 / (1 + grit * 1.6);
  drive.connect(ws).connect(trim);
  return { in: drive, out: trim, params: {}, starts: [], at: 0 };
}

// delay / echo: dry passes straight through; a parallel delay line (with a feedback loop) adds the
// wet repeats. time/feedback/wet are live AudioParams (CV-able — modulate time for flange/pitch wob).
function bDelay(ctx, n) {
  const input = ctx.createGain(), out = ctx.createGain();
  const dl = ctx.createDelay(2.0);                                    // max 2s; param tops out at 1.5
  dl.delayTime.value = Math.min(2.0, Math.max(0, n.time ?? 0.3));
  const fb = ctx.createGain(); fb.gain.value = Math.min(0.95, Math.max(0, n.feedback ?? 0.4));   // cap < 1 so it can't run away
  const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = n.tone ?? 4000;   // darkens each repeat (tape feel)
  const wet = ctx.createGain(); wet.gain.value = n.wet ?? 0.5;
  if ((n.dry ?? 1) > 0) input.connect(out);                          // dry passthrough (dry: 0 for an echo-only branch)
  input.connect(dl); dl.connect(wet).connect(out);                    // wet path
  dl.connect(damp).connect(fb).connect(dl);                          // feedback loop (lowpass-damped) → repeating echoes
  return { in: input, out, params: { time: dl.delayTime, feedback: fb.gain, tone: damp.frequency, wet: wet.gain }, starts: [], at: 0 };
}

// envelope generator → CV (ConstantSource.offset shaped on trigger)
// envelope → CV (ConstantSource.offset shaped on trigger). One unified ADSR:
//   attack (lin/exp) → decay → sustain. sustain 0 = a one-shot that decays to TRUE 0
//   and lets the voice auto-stop; sustain > 0 holds until note-off (STOP), then release().
function bEnv(ctx, n, t0) {
  const t = t0 + (n.delay || 0);
  const cs = ctx.createConstantSource(); cs.offset.value = 0;
  const o = cs.offset, p = n.peak ?? 1, fl = Math.max(1e-4, n.floor ?? FLOOR);
  const atk = n.attack ?? 0.01, dec = n.decay ?? 0.2, sus = (n.sustain ?? 0) * p;
  const expOK = p > fl;                                     // exp ramps need a positive, above-floor target/start; peak≈0 ⇒ go linear
  let release = null;
  // attack
  if (atk <= 0) { o.setValueAtTime(p, t); }                 // instant
  else if (n.attackCurve === 'lin' || !expOK) { o.setValueAtTime(0, t); o.linearRampToValueAtTime(p, t + atk); }
  else { o.setValueAtTime(fl, t); o.exponentialRampToValueAtTime(p, t + atk); }
  // decay → sustain
  if (sus > fl) {                                           // held: decay to sustain, ring until STOP…
    expOK ? o.exponentialRampToValueAtTime(sus, t + atk + dec) : o.linearRampToValueAtTime(sus, t + atk + dec);
    release = (rt) => { try { o.cancelScheduledValues(rt); o.setTargetAtTime(0, rt, Math.max(0.005, (n.release ?? 0.3) / 3)); } catch (e) {} };
    // …unless a HOLD is set: sustain for `hold` seconds, then auto-release (a timed plateau —
    // lets a long steady sound like the elevator ride end itself, one-shot style).
    if ((n.hold ?? 0) > 0) {
      const rt = t + atk + dec + n.hold;
      o.setValueAtTime(sus, rt);
      o.setTargetAtTime(0, rt, Math.max(0.005, (n.release ?? 0.3) / 3));
    }
  } else {                                                  // one-shot: decay to TRUE 0 (VCA fully shuts, voice can auto-stop)
    if (expOK) o.exponentialRampToValueAtTime(fl, t + atk + dec);
    else o.setValueAtTime(0, t + atk + dec);
    o.linearRampToValueAtTime(0, t + atk + dec + 0.01);
  }
  return { in: null, out: cs, params: {}, starts: [cs], at: t0, release };
}

function bOut(ctx, n, dest) {
  const g = ctx.createGain(); g.gain.value = n.gain ?? 1;
  if (dest) g.connect(dest);
  return { in: g, out: g, params: { gain: g.gain }, starts: [], at: 0 };
}
function bSend(ctx, n, reverbInput) {
  const g = ctx.createGain(); g.gain.value = n.gain ?? 0;
  if (reverbInput) g.connect(reverbInput);
  return { in: g, out: g, params: { gain: g.gain }, starts: [], at: 0 };
}

// (noise/out/send are handled specially — they need the shared buffer / dest / reverb)
const BUILDERS = {
  osc: bOsc, filter: bFilter, gain: bGain, shaper: bShaper, delay: bDelay, env: bEnv, value: bValue, math: bMath,
};

// ════════════════════════════════════════════════════════════════════════════════
//  AUTO-STOP DETERMINATION — the ENVELOPE is the off switch (see patchAutoStopTime):
//  any envelope present ⇒ the voice ends; no envelope ⇒ a deliberate drone (engines).
// ════════════════════════════════════════════════════════════════════════════════
function envEndTime(n) {
  if ((n.sustain ?? 0) > 0.001) {
    if ((n.hold ?? 0) > 0)                                  // timed plateau → ends after hold + release tail
      return (n.delay || 0) + (n.attack ?? 0.01) + (n.decay ?? 0.2) + n.hold + (n.release ?? 0.3) * 1.5;
    return Infinity;                                        // held → sustains until STOP
  }
  return (n.delay || 0) + (n.attack ?? 0.01) + (n.decay ?? 0.2) + 0.02;   // one-shot → ends after decay
}
// Seconds-from-now to auto-stop the voice, or null to run until STOP.
// THE RULE (the game's maker's, 2026-07-08): an ENVELOPE is the "off switch" — if the patch has any envelope,
// the voice ENDS; with none, it's a deliberate drone (the engines). Precisely:
//   • all envelopes one-shot / timed-hold → stop right after the LAST one finishes (its natural end),
//   • any HELD envelope (sustain > 0, no hold) → the voice lives for the patch's `dur`, then releases,
//   • no envelopes at all → null (runs until STOP).
// (Replaces the old graph analysis that only auto-stopped when EVERY audio path was gated by an
//  env-VCA — which read as "engine-brain": deleting one env could silently turn an SFX into a drone.)
export function patchAutoStopTime(patch) {
  let maxEnd = 0, hasEnv = false, hasHeld = false;
  for (const n of patch.nodes) {
    if (n.type !== 'env' || n.disabled) continue;
    hasEnv = true;
    const e = envEndTime(n);
    if (!isFinite(e)) hasHeld = true;                       // a held env (sustain>0, no timed hold)
    else maxEnd = Math.max(maxEnd, e);
  }
  if (!hasEnv) return null;                                 // no envelopes → deliberate drone (engines)
  if (hasHeld) return (patch.dur || 3) + 0.2;               // held env → voice lasts `dur`, then release/stop
  return maxEnd + 0.2;                                      // all one-shot → stop after the last envelope
}
// A patch is "finite" (auto-stops) iff the rule above schedules an end.
export function patchIsFinite(patch) { return patchAutoStopTime(patch) != null; }

// ════════════════════════════════════════════════════════════════════════════════
//  playPatch — instantiate the whole patch as ONE live voice, triggered now at t0.
//  No scheduled stop: looping sources (noise, oscillators) run continuously and
//  one-shot sounds simply go silent when their envelopes close. Returns a handle
//  whose .stop() tears the voice down — the host stops the previous voice before
//  it fires/re-evaluates a new one, so engines replace instead of piling up.
//  (Offline render rigs ignore the handle; with no stop, sources just play the
//   full OfflineAudioContext length, which is what we want.)
// ════════════════════════════════════════════════════════════════════════════════
// ── PLAYING A PATCH AS A NOTE ────────────────────────────────────────────────
// A patch was authored as one sound at one pitch. Music needs the same patch at many pitches, at
// scheduled times, for varying lengths — so rather than teaching the runtime about notes, rewrite
// the patch DATA and let the existing runtime play it. A note is just a transposed patch.
//
//   semi — semitones from the patch's authored pitch. Scales oscillator frequencies and, with
//          them, the FILTER frequencies: a filter left at a fixed cutoff turns a low note muddy
//          and a high note thin, because the timbre stops moving with the pitch. Scaling both
//          transposes the whole voice, so it stays recognisably the same instrument.
//   len  — how long to hold the note, seconds. Applied to SUSTAINING envelopes only, as a timed
//          plateau (see envEndTime's `hold`). Percussive one-shot envelopes are left alone: a
//          drum's length is the drum, not the note, and stretching it would just detune the hit.
//   gain — velocity, into the OUT node.
//
// NOISE is deliberately never transposed. It is what the drums are made of, and pitching a snare
// with the melody is not a thing anybody wants.
export function voicePatch(patch, { semi = 0, gain = 1, len = null } = {}) {
  const r = Math.pow(2, semi / 12);
  if (r === 1 && gain === 1 && len == null) return patch;
  // SCALE WHAT IS THERE; DO NOT INVENT WHAT IS NOT. Writing `(n.freqPeak ?? 0) * r` looks like a
  // harmless default and is not: it turns an ABSENT freqPeak into a PRESENT zero, and bFilter
  // chooses its behaviour by presence — `freqPeak != null` is true for 0, so a patch with a plain
  // static cutoff silently got the three-point sweep branch and ramped its cutoff to 0 Hz. A
  // lowpass collapsing to zero is degenerate, and when the ramp brought it back up the stored
  // energy came out all at once: BASS rendered at 116 peak against 0.13 for every other
  // instrument, ~900x. It looked like a Web Audio filter bug for exactly as long as it took to
  // print what this function actually returns.
  const scale = (n, keys) => {
    const o = { ...n };
    for (const k of keys) if (o[k] != null) o[k] = o[k] * r;
    return o;
  };
  const nodes = patch.nodes.map(n => {
    if (n.type === 'osc') return scale(n, ['freq', 'freqMod']);
    if (n.type === 'filter') return scale(n, ['freq', 'freqPeak', 'freqEnd']);
    if (n.type === 'out')
      return { ...n, gain: (n.gain ?? 1) * gain };
    if (n.type === 'env' && len != null && (n.sustain ?? 0) > 0.001)
      return { ...n, hold: Math.max(0.01, len - (n.attack ?? 0.01) - (n.decay ?? 0.2)) };
    return n;
  });
  return { ...patch, nodes };
}

export const rigSwitches = { offlineLifetimes: false };
// opts.at — absolute ctx time to start at, for SCHEDULED playback. Web Audio can place a note on
// the sample; a JS timer cannot, and a sequencer driven by timers audibly wobbles. Everything
// downstream already derives its timing from t0, so this is the only place it needs to know.
export function playPatch(ctx, noise, dest, reverbInput, patch, onEnded, opts = {}) {
  const t0 = opts.at != null ? opts.at : ctx.currentTime;
  const built = {};

  for (const node of patch.nodes) {
    const ty = node.type;
    if (node.disabled) {     // BYPASS: a unity gain — passes audio straight through (or stays silent if it's a source/CV)
      const g = ctx.createGain(); built[node.id] = { in: g, out: g, params: {}, starts: [], at: t0 }; continue;
    }
    if (ty === 'out')        built[node.id] = bOut(ctx, node, dest);
    else if (ty === 'send')  built[node.id] = bSend(ctx, node, reverbInput);
    else if (ty === 'noise') built[node.id] = bNoise(ctx, node, t0);
    else {
      const fn = BUILDERS[ty];
      built[node.id] = fn ? fn(ctx, node, t0) : null;
    }
  }

  // wire cables
  for (const c of patch.cables) {
    const s = built[c.from], d = built[c.to];
    if (!s || !d) continue;
    if (!c.port || c.port === 'in') { if (d.in) s.out.connect(d.in); }
    else if (d.params[c.port]) { s.out.connect(d.params[c.port]); }
  }

  // VALUE nodes SET their target param (a remote knob): zero the param's own base so the value node's
  // constant provides the absolute level via the sum. ENV/LFO/osc sources keep modulating additively.
  const _byId = {}; patch.nodes.forEach(n => _byId[n.id] = n);
  for (const c of patch.cables) {
    if (!c.port || c.port === 'in') continue;
    const src = _byId[c.from], d = built[c.to];
    if (!src || src.type !== 'value' || !d) continue;
    const tgt = d.params[c.port];
    if (tgt && typeof tgt.connect !== 'function' && 'value' in tgt) tgt.value = 0;   // AudioParam target → zero its base
  }

  // start every source — no stop scheduled (the voice runs until torn down)
  const sources = [];
  for (const id in built) {
    const b = built[id]; if (!b || !b.starts) continue;
    for (const src of b.starts) { try { src.start(b.at ?? t0); } catch (e) {} sources.push(src); }
  }

  // outputs to fade on teardown (out → dest, send → reverb) so stopping doesn't click
  const outs = patch.nodes.filter(n => n.type === 'out' || n.type === 'send')
    .map(n => built[n.id]).filter(Boolean);
  // ADSR envelopes release on note-off (STOP); collect their hooks + longest release time
  const releasers = [];
  for (const node of patch.nodes) { const b = built[node.id]; if (b && b.release) releasers.push({ fn: b.release, dur: node.release ?? 0.3 }); }
  let stopped = false;
  const handle = {
    stop(fade = 0.02) {
      if (stopped) return; stopped = true;
      if (handle._auto) { clearTimeout(handle._auto); handle._auto = null; }
      const t = ctx.currentTime;
      let rel = 0;
      releasers.forEach(r => { r.fn(t); rel = Math.max(rel, r.dur); });   // note-off: start the ADSR releases now
      const t2 = t + rel;                                                  // …and let them ring out before tearing down
      outs.forEach(o => { try { o.out.gain.setTargetAtTime(0, t2, fade); } catch (e) {} });
      const at = t2 + fade * 5 + 0.02;
      sources.forEach(src => { try { src.stop(at); } catch (e) {} });
      setTimeout(() => Object.values(built).forEach(b => { if (b && b.out) try { b.out.disconnect(); } catch (e) {} }), (rel + fade * 5 + 0.15) * 1000);
    },
    // live-set a VALUE node's output on the PLAYING voice (smooth glide) — lets a slider "rev" the
    // engine without rebuilding/restarting. No-op for non-value nodes (no params.value AudioParam).
    setValue(id, v) {
      const p = built[id] && built[id].params && built[id].params.value;
      if (p && typeof p.setTargetAtTime === 'function') { try { p.setTargetAtTime(v, ctx.currentTime, 0.05); } catch (e) {} }
    },
  };
  // (a rig's switch: an offline render ends each voice when a live one would end, so its cost means what it does live)
  if (rigSwitches.offlineLifetimes && typeof ctx.startRendering === 'function') {
    const autoT = patchAutoStopTime(patch);
    if (autoT != null) sources.forEach(src => { try { src.stop(t0 + autoT + 0.27); } catch (e) {} });
  }
  // finite (one-shot) patches tear themselves down after the last envelope — live ctx only
  // (offline render contexts have startRendering(); they must play the full render length)
  if (typeof ctx.startRendering !== 'function') {
    const autoT = patchAutoStopTime(patch);
    // Count the auto-stop from the note's OWN start, not from now — a note scheduled a beat ahead
    // would otherwise be torn down a beat early, and at speed that clips the front off every hit.
    if (autoT != null) handle._auto = setTimeout(() => { handle.stop(0.05); if (onEnded) onEnded(); },
                                                 Math.max(0, autoT + (t0 - ctx.currentTime)) * 1000);
  }
  return handle;
}

// expose builders/curve for the UI layer (live param tweaks, introspection)
export { BUILDERS, distortionCurve };

// ════════════════════════════════════════════════════════════════════════════════
//  pi-nebula's sounds (the Sound Lab's sounds/pi-nebula.js)
// ════════════════════════════════════════════════════════════════════════════════
export const PATCH_PRESETS = {

  // ════════════════════════════════════════════════════════════════════════════════
  //  PI NEBULA — the station's techno music (2026-11-24). The same text as the game's own list,
  //  math-games/pi-nebula/src/music/patches.js (TECHNO_PATCHES): a patch tuned here goes back there
  //  as it is. `project` says whose they are (the engine passes over it). Pitched ones are written
  //  at a C: the basses at C2, the rest at C4.
  // ════════════════════════════════════════════════════════════════════════════════
  // ── drums ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // KICK: a sine with a fast pitch drop (the Sound Lab's SYNTH — KICK, a touch longer)
  'TECHNO — KICK': { group: 'MUSIC', project: 'pi-nebula', name: 'Kick', kind: 'perc', dur: 0.6, nodes: [
    { id: 'k-osc', type: 'osc', name: 'body', wave: 'sine', freq: 48, freqMod: 110 },
    { id: 'k-pit', type: 'env', name: 'pitch', peak: 1, attack: 0.001, decay: 0.07, sustain: 0 },
    { id: 'k-amp', type: 'env', name: 'amp', peak: 1, attack: 0.002, decay: 0.36, sustain: 0 },
    { id: 'k-g', type: 'gain', name: 'vca' },
    { id: 'out', type: 'out', name: 'output', gain: 0.85 },
  ], cables: [
    { from: 'k-pit', to: 'k-osc', port: 'freq' }, { from: 'k-osc', to: 'k-g' }, { from: 'k-amp', to: 'k-g', port: 'gain' }, { from: 'k-g', to: 'out' },
  ] },
  // LOFI KICK: rounder and shorter, its click filtered off
  'TECHNO — LOFI KICK': { group: 'MUSIC', project: 'pi-nebula', name: 'Lo-fi kick', kind: 'perc', dur: 0.5, nodes: [
    { id: 'k-osc', type: 'osc', name: 'body', wave: 'sine', freq: 46, freqMod: 70 },
    { id: 'k-pit', type: 'env', name: 'pitch', peak: 1, attack: 0.001, decay: 0.08, sustain: 0 },
    { id: 'k-amp', type: 'env', name: 'amp', peak: 1, attack: 0.003, decay: 0.3, sustain: 0 },
    { id: 'k-g', type: 'gain', name: 'vca' },
    { id: 'k-f', type: 'filter', name: 'soft', ftype: 'lowpass', freq: 900, Q: 0.7 },
    { id: 'out', type: 'out', name: 'output', gain: 0.8 },
  ], cables: [
    { from: 'k-pit', to: 'k-osc', port: 'freq' }, { from: 'k-osc', to: 'k-g' }, { from: 'k-amp', to: 'k-g', port: 'gain' }, { from: 'k-g', to: 'k-f' }, { from: 'k-f', to: 'out' },
  ] },
  // HEAVY KICK: a deeper drop and a longer boom, for the half-time beat
  'TECHNO — HEAVY KICK': { group: 'MUSIC', project: 'pi-nebula', name: 'Heavy kick', kind: 'perc', dur: 0.8, nodes: [
    { id: 'k-osc', type: 'osc', name: 'body', wave: 'sine', freq: 42, freqMod: 130 },
    { id: 'k-pit', type: 'env', name: 'pitch', peak: 1, attack: 0.001, decay: 0.09, sustain: 0 },
    { id: 'k-amp', type: 'env', name: 'amp', peak: 1, attack: 0.002, decay: 0.5, sustain: 0 },
    { id: 'k-g', type: 'gain', name: 'vca' },
    { id: 'k-sh', type: 'shaper', name: 'warmth', grit: 0.12 },
    { id: 'out', type: 'out', name: 'output', gain: 0.85 },
  ], cables: [
    { from: 'k-pit', to: 'k-osc', port: 'freq' }, { from: 'k-osc', to: 'k-g' }, { from: 'k-amp', to: 'k-g', port: 'gain' }, { from: 'k-g', to: 'k-sh' }, { from: 'k-sh', to: 'out' },
  ] },
  // SNARE: a triangle body and band-passed noise (the Sound Lab's SYNTH — SNARE, its hiss band-passed, not high-passed)
  'TECHNO — SNARE': { group: 'MUSIC', project: 'pi-nebula', name: 'Snare', kind: 'perc', dur: 0.4, nodes: [
    { id: 's-osc', type: 'osc', name: 'body', wave: 'triangle', freq: 180, freqMod: 60 },
    { id: 's-pit', type: 'env', name: 'pitch', peak: 1, attack: 0.001, decay: 0.05, sustain: 0 },
    { id: 's-tg', type: 'gain', name: 'body vca' },
    { id: 's-te', type: 'env', name: 'body amp', peak: 0.5, attack: 0.001, decay: 0.1, sustain: 0 },
    { id: 's-nz', type: 'noise', name: 'snap', freq: 600, steps: 256, rate: 1, level: 1, loopLen: 0.4 },
    { id: 's-nf', type: 'filter', name: 'snap tone', ftype: 'bandpass', freq: 1900, Q: 0.8 },
    { id: 's-ng', type: 'gain', name: 'snap vca' },
    { id: 's-ne', type: 'env', name: 'snap amp', peak: 0.8, attack: 0.001, decay: 0.14, sustain: 0 },
    { id: 'send', type: 'send', name: 'room', gain: 0.12 },
    { id: 'out', type: 'out', name: 'output', gain: 0.8 },
  ], cables: [
    { from: 's-pit', to: 's-osc', port: 'freq' }, { from: 's-osc', to: 's-tg' }, { from: 's-te', to: 's-tg', port: 'gain' }, { from: 's-tg', to: 'out' },
    { from: 's-nz', to: 's-nf' }, { from: 's-nf', to: 's-ng' }, { from: 's-ne', to: 's-ng', port: 'gain' }, { from: 's-ng', to: 'out' }, { from: 's-ng', to: 'send' },
  ] },
  // LOFI SNARE: duller and shorter, more room
  'TECHNO — LOFI SNARE': { group: 'MUSIC', project: 'pi-nebula', name: 'Lo-fi snare', kind: 'perc', dur: 0.4, nodes: [
    { id: 's-osc', type: 'osc', name: 'body', wave: 'triangle', freq: 170, freqMod: 40 },
    { id: 's-pit', type: 'env', name: 'pitch', peak: 1, attack: 0.001, decay: 0.05, sustain: 0 },
    { id: 's-tg', type: 'gain', name: 'body vca' },
    { id: 's-te', type: 'env', name: 'body amp', peak: 0.45, attack: 0.002, decay: 0.09, sustain: 0 },
    { id: 's-nz', type: 'noise', name: 'snap', freq: 600, steps: 256, rate: 1, level: 1, loopLen: 0.4 },
    { id: 's-nf', type: 'filter', name: 'snap tone', ftype: 'bandpass', freq: 1500, Q: 0.7 },
    { id: 's-nl', type: 'filter', name: 'dull', ftype: 'lowpass', freq: 3200, Q: 0.7 },
    { id: 's-ng', type: 'gain', name: 'snap vca' },
    { id: 's-ne', type: 'env', name: 'snap amp', peak: 0.75, attack: 0.002, decay: 0.11, sustain: 0 },
    { id: 'send', type: 'send', name: 'room', gain: 0.2 },
    { id: 'out', type: 'out', name: 'output', gain: 0.9 },
  ], cables: [
    { from: 's-pit', to: 's-osc', port: 'freq' }, { from: 's-osc', to: 's-tg' }, { from: 's-te', to: 's-tg', port: 'gain' }, { from: 's-tg', to: 'out' },
    { from: 's-nz', to: 's-nf' }, { from: 's-nf', to: 's-nl' }, { from: 's-nl', to: 's-ng' }, { from: 's-ne', to: 's-ng', port: 'gain' }, { from: 's-ng', to: 'out' }, { from: 's-ng', to: 'send' },
  ] },
  // HEAVY SNARE: a big body and a long tail, on the half-time beat's third beat
  'TECHNO — HEAVY SNARE': { group: 'MUSIC', project: 'pi-nebula', name: 'Heavy snare', kind: 'perc', dur: 0.6, nodes: [
    { id: 's-osc', type: 'osc', name: 'body', wave: 'triangle', freq: 190, freqMod: 90 },
    { id: 's-pit', type: 'env', name: 'pitch', peak: 1, attack: 0.001, decay: 0.06, sustain: 0 },
    { id: 's-tg', type: 'gain', name: 'body vca' },
    { id: 's-te', type: 'env', name: 'body amp', peak: 0.7, attack: 0.001, decay: 0.14, sustain: 0 },
    { id: 's-nz', type: 'noise', name: 'snap', freq: 600, steps: 256, rate: 1, level: 1, loopLen: 0.4 },
    { id: 's-nf', type: 'filter', name: 'snap tone', ftype: 'bandpass', freq: 1700, Q: 0.7 },
    { id: 's-ng', type: 'gain', name: 'snap vca' },
    { id: 's-ne', type: 'env', name: 'snap amp', peak: 0.8, attack: 0.001, decay: 0.26, sustain: 0 },
    { id: 'send', type: 'send', name: 'room', gain: 0.22 },
    { id: 'out', type: 'out', name: 'output', gain: 0.6 },
  ], cables: [
    { from: 's-pit', to: 's-osc', port: 'freq' }, { from: 's-osc', to: 's-tg' }, { from: 's-te', to: 's-tg', port: 'gain' }, { from: 's-tg', to: 'out' },
    { from: 's-nz', to: 's-nf' }, { from: 's-nf', to: 's-ng' }, { from: 's-ne', to: 's-ng', port: 'gain' }, { from: 's-ng', to: 'out' }, { from: 's-ng', to: 'send' },
  ] },
  // CLAP: three quick bursts of band-passed noise and a short tail (three envelopes, each a little later)
  'TECHNO — CLAP': { group: 'MUSIC', project: 'pi-nebula', name: 'Clap', kind: 'perc', dur: 0.4, nodes: [
    { id: 'c-nz', type: 'noise', name: 'hands', freq: 600, steps: 256, rate: 1, level: 1, loopLen: 0.4 },
    { id: 'c-f', type: 'filter', name: 'tone', ftype: 'bandpass', freq: 1300, Q: 1.2 },
    { id: 'c-g', type: 'gain', name: 'vca' },
    { id: 'c-e1', type: 'env', name: 'burst 1', peak: 0.6, attack: 0.001, decay: 0.01, sustain: 0 },
    { id: 'c-e2', type: 'env', name: 'burst 2', peak: 0.6, attack: 0.001, decay: 0.01, sustain: 0, delay: 0.011 },
    { id: 'c-e3', type: 'env', name: 'tail', peak: 0.7, attack: 0.001, decay: 0.16, sustain: 0, delay: 0.022 },
    { id: 'send', type: 'send', name: 'room', gain: 0.2 },
    { id: 'out', type: 'out', name: 'output', gain: 0.55 },
  ], cables: [
    { from: 'c-nz', to: 'c-f' }, { from: 'c-f', to: 'c-g' }, { from: 'c-e1', to: 'c-g', port: 'gain' }, { from: 'c-e2', to: 'c-g', port: 'gain' }, { from: 'c-e3', to: 'c-g', port: 'gain' },
    { from: 'c-g', to: 'out' }, { from: 'c-g', to: 'send' },
  ] },
  // HATS: band-passed noise, a very short envelope (closed) or a longer one (open)
  'TECHNO — HAT': { group: 'MUSIC', project: 'pi-nebula', name: 'Hat', kind: 'perc', dur: 0.2, nodes: [
    { id: 'h-nz', type: 'noise', name: 'hat', freq: 600, steps: 256, rate: 1, level: 1, loopLen: 0.4 },
    { id: 'h-f', type: 'filter', name: 'tone', ftype: 'bandpass', freq: 6800, Q: 0.9 },
    { id: 'h-g', type: 'gain', name: 'vca' },
    { id: 'h-e', type: 'env', name: 'amp', peak: 0.6, attack: 0.001, decay: 0.04, sustain: 0 },
    { id: 'out', type: 'out', name: 'output', gain: 0.9 },
  ], cables: [
    { from: 'h-nz', to: 'h-f' }, { from: 'h-f', to: 'h-g' }, { from: 'h-e', to: 'h-g', port: 'gain' }, { from: 'h-g', to: 'out' },
  ] },
  'TECHNO — OPEN HAT': { group: 'MUSIC', project: 'pi-nebula', name: 'Open hat', kind: 'perc', dur: 0.4, nodes: [
    { id: 'h-nz', type: 'noise', name: 'hat', freq: 600, steps: 256, rate: 1, level: 1, loopLen: 0.4 },
    { id: 'h-f', type: 'filter', name: 'tone', ftype: 'bandpass', freq: 6400, Q: 0.9 },
    { id: 'h-g', type: 'gain', name: 'vca' },
    { id: 'h-e', type: 'env', name: 'amp', peak: 0.5, attack: 0.002, decay: 0.18, sustain: 0 },
    { id: 'out', type: 'out', name: 'output', gain: 0.75 },
  ], cables: [
    { from: 'h-nz', to: 'h-f' }, { from: 'h-f', to: 'h-g' }, { from: 'h-e', to: 'h-g', port: 'gain' }, { from: 'h-g', to: 'out' },
  ] },
  'TECHNO — LOFI HAT': { group: 'MUSIC', project: 'pi-nebula', name: 'Lo-fi hat', kind: 'perc', dur: 0.2, nodes: [
    { id: 'h-nz', type: 'noise', name: 'hat', freq: 600, steps: 256, rate: 1, level: 1, loopLen: 0.4 },
    { id: 'h-f', type: 'filter', name: 'tone', ftype: 'bandpass', freq: 5000, Q: 0.8 },
    { id: 'h-g', type: 'gain', name: 'vca' },
    { id: 'h-e', type: 'env', name: 'amp', peak: 0.6, attack: 0.002, decay: 0.05, sustain: 0 },
    { id: 'out', type: 'out', name: 'output', gain: 0.8 },
  ], cables: [
    { from: 'h-nz', to: 'h-f' }, { from: 'h-f', to: 'h-g' }, { from: 'h-e', to: 'h-g', port: 'gain' }, { from: 'h-g', to: 'out' },
  ] },
  // TOM: a pitched sine drop, for the lo-fi fills
  'TECHNO — TOM': { group: 'MUSIC', project: 'pi-nebula', name: 'Tom', kind: 'perc', dur: 0.5, nodes: [
    { id: 't-osc', type: 'osc', name: 'body', wave: 'sine', freq: 130.81, freqMod: 60 },
    { id: 't-pit', type: 'env', name: 'pitch', peak: 1, attack: 0.001, decay: 0.12, sustain: 0 },
    { id: 't-amp', type: 'env', name: 'amp', peak: 1, attack: 0.003, decay: 0.26, sustain: 0 },
    { id: 't-g', type: 'gain', name: 'vca' },
    { id: 'send', type: 'send', name: 'room', gain: 0.15 },
    { id: 'out', type: 'out', name: 'output', gain: 0.5 },
  ], cables: [
    { from: 't-pit', to: 't-osc', port: 'freq' }, { from: 't-osc', to: 't-g' }, { from: 't-amp', to: 't-g', port: 'gain' }, { from: 't-g', to: 'out' }, { from: 't-g', to: 'send' },
  ] },
  // RISER: the build's hiss, noise through a band-pass that glides up across each note (the notes rise a bar at a
  // time, so the band climbs through the build)
  'TECHNO — RISER': { group: 'MUSIC', project: 'pi-nebula', name: 'Riser', kind: 'perc', dur: 2, nodes: [
    { id: 'r-nz', type: 'noise', name: 'hiss', freq: 600, steps: 256, rate: 1, level: 1, loopLen: 0.6 },
    { id: 'r-f', type: 'filter', name: 'band', ftype: 'bandpass', freq: 400, freqEnd: 650, glide: 1.6, Q: 1.4 },
    { id: 'r-g', type: 'gain', name: 'vca' },
    { id: 'r-e', type: 'env', name: 'amp', peak: 1, attack: 0.08, decay: 0.05, sustain: 0.95, release: 0.08 },
    { id: 'out', type: 'out', name: 'output', gain: 0.22 },
  ], cables: [
    { from: 'r-nz', to: 'r-f' }, { from: 'r-f', to: 'r-g' }, { from: 'r-e', to: 'r-g', port: 'gain' }, { from: 'r-g', to: 'out' },
  ] },

  // ── bass ───────────────────────────────────────────────────────────────────────────────────────────────────────
  // WARM: a sine with a soft triangle an octave up, low-passed (the lo-fi bass)
  'TECHNO — WARM BASS': { group: 'MUSIC', project: 'pi-nebula', name: 'Warm bass', kind: 'bass', dur: 1.5, nodes: [
    { id: 'b-osc', type: 'osc', name: 'body', wave: 'sine', freq: 65.406, level: 1 },
    { id: 'b-oct', type: 'osc', name: 'octave', wave: 'triangle', freq: 130.81, level: 0.22 },
    { id: 'b-f', type: 'filter', name: 'tone', ftype: 'lowpass', freq: 700, Q: 0.7 },
    { id: 'b-g', type: 'gain', name: 'vca' },
    { id: 'b-e', type: 'env', name: 'amp', peak: 1, attack: 0.012, decay: 0.1, sustain: 0.85, release: 0.12 },
    { id: 'out', type: 'out', name: 'output', gain: 0.28 },
  ], cables: [
    { from: 'b-osc', to: 'b-f' }, { from: 'b-oct', to: 'b-f' }, { from: 'b-f', to: 'b-g' }, { from: 'b-e', to: 'b-g', port: 'gain' }, { from: 'b-g', to: 'out' },
  ] },
  // PULSE: a saw whose filter snaps shut on each note (the off-beat techno bass)
  'TECHNO — PULSE BASS': { group: 'MUSIC', project: 'pi-nebula', name: 'Pulse bass', kind: 'bass', dur: 0.6, nodes: [
    { id: 'b-osc', type: 'osc', name: 'saw', wave: 'sawtooth', freq: 65.406, level: 1 },
    { id: 'b-f', type: 'filter', name: 'snap', ftype: 'lowpass', freq: 1100, freqEnd: 220, glide: 0.16, Q: 3 },
    { id: 'b-g', type: 'gain', name: 'vca' },
    { id: 'b-e', type: 'env', name: 'amp', peak: 1, attack: 0.004, decay: 0.1, sustain: 0.7, release: 0.05 },
    { id: 'out', type: 'out', name: 'output', gain: 0.58 },
  ], cables: [
    { from: 'b-osc', to: 'b-f' }, { from: 'b-f', to: 'b-g' }, { from: 'b-e', to: 'b-g', port: 'gain' }, { from: 'b-g', to: 'out' },
  ] },
  // ROLLING: shorter and darker, for sixteenths between the kicks
  'TECHNO — ROLLING BASS': { group: 'MUSIC', project: 'pi-nebula', name: 'Rolling bass', kind: 'bass', dur: 0.4, nodes: [
    { id: 'b-osc', type: 'osc', name: 'saw', wave: 'sawtooth', freq: 65.406, level: 1 },
    { id: 'b-f', type: 'filter', name: 'snap', ftype: 'lowpass', freq: 800, freqEnd: 220, glide: 0.12, Q: 2 },
    { id: 'b-g', type: 'gain', name: 'vca' },
    { id: 'b-e', type: 'env', name: 'amp', peak: 1, attack: 0.004, decay: 0.06, sustain: 0.6, release: 0.04 },
    { id: 'out', type: 'out', name: 'output', gain: 0.52 },
  ], cables: [
    { from: 'b-osc', to: 'b-f' }, { from: 'b-f', to: 'b-g' }, { from: 'b-e', to: 'b-g', port: 'gain' }, { from: 'b-g', to: 'out' },
  ] },
  // WOBBLE: the growl. Two saws a little apart through a resonant low-pass whose cutoff a slow sine (the LFO, x520
  // through a MULT) swings up and down: the wobble. A plain sine an octave down holds the floor. The player sets the
  // LFO's speed for each note in time with the beat (its 'w-lfo' freq), so it is written here at 2 a second.
  'TECHNO — WOBBLE BASS': { group: 'MUSIC', project: 'pi-nebula', name: 'Wobble bass', kind: 'bass', dur: 1.5, nodes: [
    { id: 'w-osc', type: 'osc', name: 'growl', wave: 'sawtooth', voices: 2, detune: 9, freq: 65.406, level: 1 },
    { id: 'w-lfo', type: 'osc', name: 'wobble', wave: 'sine', freq: 2, level: 1 },
    { id: 'w-mul', type: 'math', name: 'x520', mul: 520 },
    { id: 'w-f', type: 'filter', name: 'mouth', ftype: 'lowpass', freq: 650, Q: 5 },
    { id: 'w-g', type: 'gain', name: 'growl vca' },
    { id: 'w-sub', type: 'osc', name: 'sub', wave: 'sine', freq: 32.703, level: 1.3 },
    { id: 'w-sg', type: 'gain', name: 'sub vca' },
    { id: 'w-e', type: 'env', name: 'amp', peak: 1, attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.06 },
    { id: 'out', type: 'out', name: 'output', gain: 0.17 },
  ], cables: [
    { from: 'w-lfo', to: 'w-mul' }, { from: 'w-mul', to: 'w-f', port: 'freq' },
    { from: 'w-osc', to: 'w-f' }, { from: 'w-f', to: 'w-g' }, { from: 'w-e', to: 'w-g', port: 'gain' }, { from: 'w-g', to: 'out' },
    { from: 'w-sub', to: 'w-sg' }, { from: 'w-e', to: 'w-sg', port: 'gain' }, { from: 'w-sg', to: 'out' },
  ] },

  // FM LADDER: the plucked bass of slap house, made the way an FM synth makes it: four sine operators in a chain, each
  // bending the next one's phase (C, eight times the note, into D into E into F; only F is heard), every bend fading as
  // the note rings, so it starts bright and hollow and settles to a round tone. (The game's maker, 2026-11-24, of a
  // bass he likes: "some FM ladder thing where there is a chain of FM".) The engine's oscillators take a cable on their
  // pitch, not their phase; a phase bend is a pitch bend by the bender's rate of change, and a bandpass filter far below
  // its own pitch gives exactly that. So between two operators: the bender, its fade, that filter ("to phase"), then
  // the next one's pitch plug. HOW HARD each bends (the FM index, radians) = the next operator's freqMod / 3669: 4401
  // is 1.2. Measured against the same ladder worked out by plain arithmetic: every harmonic within 1.1 dB, on pitch to
  // a cent from C1 to C3 (~/pw/space-math/rigs/fmbass-1). The three freqMods and the four fades are the knobs to tune.
  'TECHNO — FM LADDER BASS': { group: 'MUSIC', project: 'pi-nebula', name: 'FM ladder bass', kind: 'bass', dur: 0.45, nodes: [
    { id: 'c', type: 'osc', name: 'C x8', wave: 'sine', freq: 523.248, level: 1 },
    { id: 'c-e', type: 'env', name: 'C fade', peak: 1, attack: 0.002, decay: 0.07, sustain: 0.15, release: 0.08 },
    { id: 'c-v', type: 'gain', name: 'C amount', gain: 0 },
    { id: 'c-d', type: 'filter', name: 'C to phase', ftype: 'bandpass', freq: 5000, Q: 0.7071 },
    { id: 'd', type: 'osc', name: 'D', wave: 'sine', freq: 65.406, freqMod: 4401, level: 1 },
    { id: 'd-e', type: 'env', name: 'D fade', peak: 1, attack: 0.002, decay: 0.14, sustain: 0.35, release: 0.08 },
    { id: 'd-v', type: 'gain', name: 'D amount', gain: 0 },
    { id: 'd-d', type: 'filter', name: 'D to phase', ftype: 'bandpass', freq: 5000, Q: 0.7071 },
    { id: 'e', type: 'osc', name: 'E', wave: 'sine', freq: 65.406, freqMod: 4401, level: 1 },
    { id: 'e-e', type: 'env', name: 'E fade', peak: 1, attack: 0.002, decay: 0.18, sustain: 0.45, release: 0.08 },
    { id: 'e-v', type: 'gain', name: 'E amount', gain: 0 },
    { id: 'e-d', type: 'filter', name: 'E to phase', ftype: 'bandpass', freq: 5000, Q: 0.7071 },
    { id: 'f', type: 'osc', name: 'F (heard)', wave: 'sine', freq: 65.406, freqMod: 4401, level: 1 },
    { id: 'f-e', type: 'env', name: 'pluck', peak: 1, attack: 0.002, decay: 0.25, sustain: 0.55, release: 0.08 },
    { id: 'f-v', type: 'gain', name: 'F level', gain: 0 },
    { id: 'hp', type: 'filter', name: 'no rumble', ftype: 'highpass', freq: 20, Q: 0.7071 },
    { id: 'out', type: 'out', name: 'output', gain: 0.36 },
  ], cables: [
    { from: 'c', to: 'c-v' }, { from: 'c-e', to: 'c-v', port: 'gain' }, { from: 'c-v', to: 'c-d' }, { from: 'c-d', to: 'd', port: 'freq' },
    { from: 'd', to: 'd-v' }, { from: 'd-e', to: 'd-v', port: 'gain' }, { from: 'd-v', to: 'd-d' }, { from: 'd-d', to: 'e', port: 'freq' },
    { from: 'e', to: 'e-v' }, { from: 'e-e', to: 'e-v', port: 'gain' }, { from: 'e-v', to: 'e-d' }, { from: 'e-d', to: 'f', port: 'freq' },
    { from: 'f', to: 'f-v' }, { from: 'f-e', to: 'f-v', port: 'gain' }, { from: 'f-v', to: 'hp' }, { from: 'hp', to: 'out' },
  ] },
  // ── pads (one note of the chord each) ──────────────────────────────────────────────────────────────────────────
  'TECHNO — WARM PAD': { group: 'MUSIC', project: 'pi-nebula', name: 'Warm pad', kind: 'instrument', dur: 4, nodes: [
    { id: 'p-osc', type: 'osc', name: 'saws', wave: 'sawtooth', voices: 2, detune: 7, freq: 261.63, level: 1 },
    { id: 'p-f', type: 'filter', name: 'tone', ftype: 'lowpass', freq: 900, Q: 0.6 },
    { id: 'p-g', type: 'gain', name: 'vca' },
    { id: 'p-e', type: 'env', name: 'amp', peak: 1, attack: 0.5, decay: 0.3, sustain: 0.85, release: 0.9 },
    { id: 'send', type: 'send', name: 'room', gain: 0.25 },
    { id: 'out', type: 'out', name: 'output', gain: 0.075 },
  ], cables: [
    { from: 'p-osc', to: 'p-f' }, { from: 'p-f', to: 'p-g' }, { from: 'p-e', to: 'p-g', port: 'gain' }, { from: 'p-g', to: 'out' }, { from: 'p-g', to: 'send' },
  ] },
  'TECHNO — AIRY PAD': { group: 'MUSIC', project: 'pi-nebula', name: 'Airy pad', kind: 'instrument', dur: 4, nodes: [
    { id: 'p-osc', type: 'osc', name: 'triangles', wave: 'triangle', voices: 2, detune: 9, freq: 261.63, level: 1 },
    { id: 'p-f', type: 'filter', name: 'tone', ftype: 'lowpass', freq: 2400, Q: 0.6 },
    { id: 'p-g', type: 'gain', name: 'vca' },
    { id: 'p-e', type: 'env', name: 'amp', peak: 1, attack: 0.7, decay: 0.3, sustain: 0.85, release: 1.1 },
    { id: 'send', type: 'send', name: 'room', gain: 0.4 },
    { id: 'out', type: 'out', name: 'output', gain: 0.09 },
  ], cables: [
    { from: 'p-osc', to: 'p-f' }, { from: 'p-f', to: 'p-g' }, { from: 'p-e', to: 'p-g', port: 'gain' }, { from: 'p-g', to: 'out' }, { from: 'p-g', to: 'send' },
  ] },
  'TECHNO — DARK PAD': { group: 'MUSIC', project: 'pi-nebula', name: 'Dark pad', kind: 'instrument', dur: 4, nodes: [
    { id: 'p-osc', type: 'osc', name: 'saws', wave: 'sawtooth', voices: 2, detune: 5, freq: 261.63, level: 1 },
    { id: 'p-f', type: 'filter', name: 'tone', ftype: 'lowpass', freq: 480, Q: 0.8 },
    { id: 'p-g', type: 'gain', name: 'vca' },
    { id: 'p-e', type: 'env', name: 'amp', peak: 1, attack: 0.6, decay: 0.3, sustain: 0.85, release: 1 },
    { id: 'send', type: 'send', name: 'room', gain: 0.3 },
    { id: 'out', type: 'out', name: 'output', gain: 0.11 },
  ], cables: [
    { from: 'p-osc', to: 'p-f' }, { from: 'p-f', to: 'p-g' }, { from: 'p-e', to: 'p-g', port: 'gain' }, { from: 'p-g', to: 'out' }, { from: 'p-g', to: 'send' },
  ] },

  // ── leads ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // KEYS: an electric piano: a sine ringing down, a quick soft octave on the strike
  'TECHNO — KEYS': { group: 'MUSIC', project: 'pi-nebula', name: 'Keys', kind: 'instrument', dur: 1.6, nodes: [
    { id: 'k-osc', type: 'osc', name: 'tine', wave: 'sine', freq: 261.63, level: 1 },
    { id: 'k-g', type: 'gain', name: 'vca' },
    { id: 'k-e', type: 'env', name: 'ring', peak: 1, attack: 0.006, decay: 1.3, sustain: 0 },
    { id: 'k-o2', type: 'osc', name: 'strike', wave: 'sine', freq: 523.25, level: 1 },
    { id: 'k-g2', type: 'gain', name: 'strike vca' },
    { id: 'k-e2', type: 'env', name: 'strike', peak: 0.25, attack: 0.003, decay: 0.2, sustain: 0 },
    { id: 'send', type: 'send', name: 'room', gain: 0.25 },
    { id: 'out', type: 'out', name: 'output', gain: 0.5 },
  ], cables: [
    { from: 'k-osc', to: 'k-g' }, { from: 'k-e', to: 'k-g', port: 'gain' }, { from: 'k-g', to: 'out' }, { from: 'k-g', to: 'send' },
    { from: 'k-o2', to: 'k-g2' }, { from: 'k-e2', to: 'k-g2', port: 'gain' }, { from: 'k-g2', to: 'out' },
  ] },
  // SOFT SAW: two saws a little apart, the filter settling darker after the start
  'TECHNO — SOFT SAW': { group: 'MUSIC', project: 'pi-nebula', name: 'Soft saw', kind: 'instrument', dur: 1.5, nodes: [
    { id: 'l-osc', type: 'osc', name: 'saws', wave: 'sawtooth', voices: 2, detune: 6, freq: 261.63, level: 1 },
    { id: 'l-f', type: 'filter', name: 'tone', ftype: 'lowpass', freq: 2200, freqEnd: 1300, glide: 0.3, Q: 0.8 },
    { id: 'l-g', type: 'gain', name: 'vca' },
    { id: 'l-e', type: 'env', name: 'amp', peak: 1, attack: 0.02, decay: 0.2, sustain: 0.8, release: 0.15 },
    { id: 'send', type: 'send', name: 'room', gain: 0.25 },
    { id: 'out', type: 'out', name: 'output', gain: 0.14 },
  ], cables: [
    { from: 'l-osc', to: 'l-f' }, { from: 'l-f', to: 'l-g' }, { from: 'l-e', to: 'l-g', port: 'gain' }, { from: 'l-g', to: 'out' }, { from: 'l-g', to: 'send' },
  ] },
  // SQUARE: a mellow square, low-passed
  'TECHNO — SQUARE LEAD': { group: 'MUSIC', project: 'pi-nebula', name: 'Square lead', kind: 'instrument', dur: 1.5, nodes: [
    { id: 'l-osc', type: 'osc', name: 'square', wave: 'square', freq: 261.63, level: 1 },
    { id: 'l-f', type: 'filter', name: 'tone', ftype: 'lowpass', freq: 1700, freqEnd: 1000, glide: 0.3, Q: 0.8 },
    { id: 'l-g', type: 'gain', name: 'vca' },
    { id: 'l-e', type: 'env', name: 'amp', peak: 1, attack: 0.02, decay: 0.2, sustain: 0.8, release: 0.15 },
    { id: 'send', type: 'send', name: 'room', gain: 0.25 },
    { id: 'out', type: 'out', name: 'output', gain: 0.12 },
  ], cables: [
    { from: 'l-osc', to: 'l-f' }, { from: 'l-f', to: 'l-g' }, { from: 'l-e', to: 'l-g', port: 'gain' }, { from: 'l-g', to: 'out' }, { from: 'l-g', to: 'send' },
  ] },

  // ── melodies ───────────────────────────────────────────────────────────────────────────────────────────────────
  'TECHNO — ARP': { group: 'MUSIC', project: 'pi-nebula', name: 'Arp', kind: 'instrument', dur: 0.6, nodes: [
    { id: 'a-osc', type: 'osc', name: 'pluck', wave: 'triangle', freq: 261.63, level: 1 },
    { id: 'a-f', type: 'filter', name: 'tone', ftype: 'lowpass', freq: 2600, Q: 0.7 },
    { id: 'a-g', type: 'gain', name: 'vca' },
    { id: 'a-e', type: 'env', name: 'amp', peak: 1, attack: 0.004, decay: 0.25, sustain: 0 },
    { id: 'send', type: 'send', name: 'room', gain: 0.25 },
    { id: 'out', type: 'out', name: 'output', gain: 0.3 },
  ], cables: [
    { from: 'a-osc', to: 'a-f' }, { from: 'a-f', to: 'a-g' }, { from: 'a-e', to: 'a-g', port: 'gain' }, { from: 'a-g', to: 'out' }, { from: 'a-g', to: 'send' },
  ] },
  'TECHNO — BELLS': { group: 'MUSIC', project: 'pi-nebula', name: 'Bells', kind: 'instrument', dur: 1.6, nodes: [
    { id: 'b-osc', type: 'osc', name: 'bell', wave: 'sine', freq: 261.63, level: 1 },
    { id: 'b-g', type: 'gain', name: 'vca' },
    { id: 'b-e', type: 'env', name: 'ring', peak: 1, attack: 0.004, decay: 1.2, sustain: 0 },
    { id: 'b-o3', type: 'osc', name: 'shimmer', wave: 'sine', freq: 784.89, level: 1 },
    { id: 'b-g3', type: 'gain', name: 'shimmer vca' },
    { id: 'b-e3', type: 'env', name: 'shimmer', peak: 0.15, attack: 0.002, decay: 0.15, sustain: 0 },
    { id: 'send', type: 'send', name: 'room', gain: 0.35 },
    { id: 'out', type: 'out', name: 'output', gain: 0.3 },
  ], cables: [
    { from: 'b-osc', to: 'b-g' }, { from: 'b-e', to: 'b-g', port: 'gain' }, { from: 'b-g', to: 'out' }, { from: 'b-g', to: 'send' },
    { from: 'b-o3', to: 'b-g3' }, { from: 'b-e3', to: 'b-g3', port: 'gain' }, { from: 'b-g3', to: 'out' },
  ] },
  // ECHO PLUCK: a pluck into its own echo (a delay with no dry path); a long envelope on the echo's wet level lets
  // the repeats fade and keeps the note alive until they have. The player sets the echo's time to the beat.
  'TECHNO — ECHO PLUCK': { group: 'MUSIC', project: 'pi-nebula', name: 'Echo pluck', kind: 'instrument', dur: 2, nodes: [
    { id: 'e-osc', type: 'osc', name: 'pluck', wave: 'triangle', freq: 261.63, level: 1 },
    { id: 'e-f', type: 'filter', name: 'tone', ftype: 'lowpass', freq: 2000, Q: 0.7 },
    { id: 'e-g', type: 'gain', name: 'vca' },
    { id: 'e-e', type: 'env', name: 'amp', peak: 1, attack: 0.004, decay: 0.25, sustain: 0 },
    { id: 'e-dl', type: 'delay', name: 'echo', time: 0.36, feedback: 0.4, tone: 1800, wet: 0, dry: 0 },
    { id: 'e-we', type: 'env', name: 'echo fade', peak: 0.6, attack: 0.001, decay: 1.6, sustain: 0 },
    { id: 'send', type: 'send', name: 'room', gain: 0.2 },
    { id: 'out', type: 'out', name: 'output', gain: 0.35 },
  ], cables: [
    { from: 'e-osc', to: 'e-f' }, { from: 'e-f', to: 'e-g' }, { from: 'e-e', to: 'e-g', port: 'gain' }, { from: 'e-g', to: 'out' }, { from: 'e-g', to: 'send' },
    { from: 'e-g', to: 'e-dl' }, { from: 'e-we', to: 'e-dl', port: 'wet' }, { from: 'e-dl', to: 'out' },
  ] },
  // ── end of PI NEBULA ──
};
