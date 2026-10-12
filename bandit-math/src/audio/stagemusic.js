// THE STAGE MUSIC: a harmonica and a low piano playing a made-up Western tune that never ends, as the band on the town's
// stage plays it. The two instruments are Sound Lab patches (src/audio/patch.js is the game's copy of the Sound Lab's
// engine, ~/sound-lab/patch.js, with its presets: 'STAGE — HARMONICA' and 'STAGE — PIANO'), so they can be tuned by
// ear in the lab; each note is the patch played at a pitch, for a length (voicePatch), with a few more settings made
// here per note (the bend into it, the wobble, how it swells in and fades). No sound files.
//
// The tune is made up as it plays, by seeded dice, from a G major pentatonic palette over the chords G, C and D: four-bar
// lines at 80 beats a minute, the piano keeping a bass line (the root on beat one, the fifth on beat three, now and then a
// passing note into the next bar, and a soft chord above), the harmonica playing a phrase or two over most lines and
// resting over the others. Nothing in it is taken from any recording: only the SOUND of the two instruments was measured
// (overtones, swell and fade times, wobble rates, breath; see ~/pw/bandit-math/sound/REPORT.md).
//
//   const M = makeStageMusic(ctx, { harp, piano, room, seed })   harp / piano: where each instrument's notes go (an
//                          AudioNode: the game puts each through its own positioned panner); room: where their echo goes
//   M.start(at)            starts the tune at ctx time `at` (the first beat); in an OfflineAudioContext it writes the
//                          whole render at once
//   M.stop()               stops making notes (the ones already sounding ring out)
//   M.stop({ now: true })  also silences every note already made, sounding or still to come (for when the sound goes
//                          to sleep: the notes would be cut off by their own timers meanwhile, so they are let go cleanly)
//   M.beat()               the beat the music is on now (counted from the first one; fractions between), or null
//   M.harmonicaAt(t)       true while the harmonica is playing (a phrase sounding at ctx time t)
//   M.events               what has been scheduled (for testing): [{ at, what, midi, len, ... }]; in the game only the
//                          last EVENTS_KEPT are kept (the band can play for hours), an offline render keeps them all
//   M.played               how many notes have been scheduled in all
//   notePatch(patch, opts) the note as patch data (exported for the render rig)
import { playPatch, voicePatch, PATCH_PRESETS } from './patch.js';

export const BEAT = 0.75;                 // seconds a beat (80 a minute); the performers' clips are four beats long
export const HARMONICA = 'STAGE — HARMONICA', PIANO = 'STAGE — PIANO';
const HARP_ROOT = 67, PIANO_ROOT = 43;    // the patches are written at G4 and G2 (MIDI note numbers)
const EVENTS_KEPT = 256;                  // the notes listed in M.events while playing live (only rigs read them)
const LOOKAHEAD = 2.5;                    // seconds of notes made ahead (rides out a slow frame or a busy tab)

// ── A NOTE FROM A PATCH ──────────────────────────────────────────────────────────────────────────────────────────────
// voicePatch moves every oscillator and filter with the note's pitch. Some parts of a patch are the player or the
// instrument's body rather than the note (a wobble ~7 times a second, the breath's hiss, a fixed tone filter): `keep`
// names them and they stay as written. `set` changes settings of named nodes for this one note. Nodes that can't reach
// the output any more (the spare reed tables, anything switched off) are left out, so they cost nothing.
export function notePatch(patch, { semi = 0, gain = 1, len = null, set = null, keep = [] } = {}) {
  const v = voicePatch(patch, { semi, gain, len });
  const byId = new Map(patch.nodes.map((n) => [n.id, n]));
  let nodes = v.nodes.map((n) => {
    let m = keep.includes(n.id) && byId.has(n.id) ? { ...n, ...pick(byId.get(n.id), ['freq', 'freqPeak', 'freqEnd', 'freqMod']) } : n;
    if (n.type === 'send' && gain !== 1) m = { ...m, gain: (n.gain ?? 0) * gain };   // (the echo follows the note's loudness too)
    if (set && set[n.id]) m = { ...m, ...set[n.id] };
    return m;
  });
  // what reaches the output (an audio or a control cable both count: a control source feeds what it moves)
  const live = new Set(nodes.filter((n) => n.type === 'out' || n.type === 'send').map((n) => n.id));
  for (let grew = true; grew;) {
    grew = false;
    for (const c of v.cables) if (live.has(c.to) && !live.has(c.from)) { live.add(c.from); grew = true; }
  }
  nodes = nodes.filter((n) => live.has(n.id) && !(n.type === 'osc' && n.level === 0));
  const ids = new Set(nodes.map((n) => n.id));
  return { ...v, nodes, cables: v.cables.filter((c) => ids.has(c.from) && ids.has(c.to)) };
}
function pick(o, keys) { const r = {}; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; }

// ── THE HARMONICA ────────────────────────────────────────────────────────────────────────────────────────────────────
// Its three ways of wobbling a note, as measured: pulses in loudness ~7 a second (the usual), a slow rock 2-3 times a
// second (pitch and loudness together), and nearly plain. fade: the phrase-end fade (the loudness envelope's release, s)
const WOBBLE = {
  pulse: { rate: [6.85, 7.15], trem: 0.45, vib: -0.074, delay: 0.25, fade: 1.5 },
  rock:  { rate: [2.2, 3.0],   trem: 0.36, vib: -0.10,  delay: 0.15, fade: 1.0, soft: true },
  plain: { rate: [2.4, 3.2],   trem: 0.1,  vib: -0.027, delay: 0.1,  fade: 0.6 },
};
const SOFT_SQUARE = { real: [0, 0, 0, 0, 0, 0], imag: [0, 1, 0, 0.28, 0, 0.08] };   // (the slow rock flips more than it glides)
const HARP_KEEP = ['wob', 'wander-f', 'br-hp', 'br-lp', 'air-hp', 'air-lp', 'tone'];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// one harmonica note: { midi, len (s), level, bend (cents flat at the start, 0 = none), fresh (a new breath, else it runs
// on from the note before), last (the phrase's last note: the long fade), style, rate }
export function harmonicaNote(n, patch = PATCH_PRESETS[HARMONICA]) {
  const W = WOBBLE[n.style] || WOBBLE.pulse, f = hz(n.midi), node = (id) => patch.nodes.find((x) => x.id === id);
  const set = {
    amp: { attack: n.fresh ? 0.55 : 0.09, release: n.last ? W.fade : 0.22 },
    bend: { peak: (n.bend || 0) / 100, decay: Math.min(0.6, Math.max(0.22, 0.25 + ((n.bend || 0) - 60) / 60 * 0.35)) },
    wob: { freq: n.rate || (W.rate[0] + W.rate[1]) / 2, ...(W.soft ? { wave: 'custom', harm: SOFT_SQUARE } : {}) },
    grow: { delay: n.fresh ? W.delay : 0.05 },
    'trem-d': { mul: W.trem }, 'vib-d': { mul: W.vib },
  };
  // the reed's colour for this pitch (low notes have a weak 2nd overtone; going up, the 2nd grows and the 3rd fades)
  const swap = f < 370 ? node('reed-lo') : f >= 540 ? node('reed-hi') : f >= 470 ? node('reed-up') : null;
  if (swap) set.reed = { harm: swap.harm, level: swap.level };
  return notePatch(patch, { semi: n.midi - HARP_ROOT, gain: n.level ?? 1, len: n.len, set, keep: HARP_KEEP });
}

// ── THE PIANO ────────────────────────────────────────────────────────────────────────────────────────────────────────
// one piano note (or a chord: midi a list): { midi, len (how long the key is held, s), vel 0..1 }. The patch is written
// for the low notes; played higher (the soft chords) its top partials are turned down, as a real string's top is duller
// than a low string's transposed would be.
export function pianoNotes(n, patch = PATCH_PRESETS[PIANO]) {
  const list = Array.isArray(n.midi) ? n.midi : [n.midi], vel = Math.max(0.05, Math.min(1, n.vel ?? 0.6));
  return list.map((m) => {
    const semi = m - PIANO_ROOT, up = Math.max(0, semi / 12), node = (id) => patch.nodes.find((x) => x.id === id);
    const set = {};
    if (up > 0) { set.mid = { level: node('mid').level * Math.pow(10, -3 * up / 20) }; set.high = { level: node('high').level * Math.pow(10, -7 * up / 20) }; }
    const gain = (0.25 + 0.75 * Math.pow(vel, 1.4)) * (list.length > 1 ? 0.78 : 1);
    const tail = node('damp-b-e');
    if (tail && n.len != null) set['damp-b-e'] = { hold: Math.max(0.01, n.len + TAIL_HANG - (tail.attack ?? 0.01) - (tail.decay ?? 0.2)) };
    return notePatch(patch, { semi, gain, len: n.len, set });
  });
}

// ── THE TUNE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// Seeded dice (mulberry32): the same seed always gives the same music.
export function makeRandom(seed = 1) {
  let a = (Math.floor(seed) * 2654435761) >>> 0 || 1;
  const next = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    next, range: (lo, hi) => lo + (hi - lo) * next(), int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (list) => list[Math.floor(next() * list.length)], chance: (p) => next() < p,
    weighted: (pairs) => { let s = 0; for (const p of pairs) s += p[1]; let x = next() * s; for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; } return pairs[pairs.length - 1][0]; },
  };
}
// the chords, in G (MIDI numbers): the bass's root and fifth (between D2 and C3, where the piano's sound was measured),
// the harmonica's chord tones, and soft three-note voicings for the piano's right hand
const CHORDS = {
  I:  { root: 43, fifth: 38, tones: [62, 67, 71, 74], voicing: [[55, 59, 62], [59, 62, 67]] },   // G
  IV: { root: 48, fifth: 43, tones: [64, 67, 72, 76], voicing: [[55, 60, 64], [52, 55, 60]] },   // C
  V:  { root: 38, fifth: 45, tones: [62, 66, 69, 74], voicing: [[54, 57, 62], [57, 62, 66]] },   // D
};
// four-bar lines: a chord a bar
const LINES = [['I', 'I', 'IV', 'I'], ['I', 'IV', 'V', 'I'], ['I', 'V', 'I', 'V'], ['IV', 'I', 'V', 'I'], ['I', 'I', 'V', 'I'], ['I', 'IV', 'I', 'V']];
// the harmonica's notes: G major pentatonic from D4 to E5 (the reference's harmonica sat at 290-570 Hz)
const PALETTE = [62, 64, 67, 69, 71, 74, 76];
const TAIL_HANG = 0.25;                   // s the piano's damper tail hangs on past the key's release (measured), then goes
const HARP_PAIRS = { I: [[67, 71], [71, 74], [62, 71]], IV: [[64, 67], [67, 72], [64, 72]], V: [[62, 66], [66, 69], [62, 69]] };
const PASSING = [36, 38, 40, 42, 43, 45, 47, 48, 50];
const near = (list, m) => list.reduce((b, x) => (Math.abs(x - m) < Math.abs(b - m) ? x : b), list[0]);

// The plan, a line at a time. Times are in beats from the first beat; lengths of notes in beats.
export function makeTune(seed = 1) {
  const rnd = makeRandom(seed);
  let line = 0, lastHarp = 71, harpRun = 0, restRun = 0;
  return function nextLine() {
    const chords = line === 0 ? LINES[0] : rnd.pick(LINES), t0 = line * 16, ev = [];
    // the piano's bass: beat one always, beat three most bars, now and then a step into the next bar's root
    chords.forEach((c, b) => {
      const C = CHORDS[c], bar = t0 + b * 4, next = CHORDS[chords[b + 1] || 'I'];
      const end = b === 3;
      if (end && rnd.chance(0.35)) ev.push({ beat: bar, what: 'piano', midi: [C.root, C.root + 12], len: rnd.range(1.6, 2.4), vel: rnd.range(0.55, 0.68) });
      else ev.push({ beat: bar, what: 'piano', midi: C.root, len: rnd.range(0.8, 1.3), vel: rnd.range(0.58, 0.72) });
      if (rnd.chance(0.75)) ev.push({ beat: bar + 2, what: 'piano', midi: C.fifth, len: rnd.range(0.7, 1.1), vel: rnd.range(0.45, 0.58) });
      if (!end && rnd.chance(0.18)) {
        const pass = near(PASSING, next.root + rnd.pick([-2, -1, 2]));
        ev.push({ beat: bar + 3, what: 'piano', midi: pass, len: rnd.range(0.5, 0.7), vel: rnd.range(0.4, 0.5) });
      }
      // a soft chord above, on beat two or four of some bars
      if (rnd.chance(0.3)) ev.push({ beat: bar + rnd.pick([1, 3]), what: 'piano', midi: rnd.pick(C.voicing), len: rnd.range(0.5, 0.9), vel: rnd.range(0.28, 0.4) });
    });
    // the harmonica: plays over most lines, rests over some (never more than three in a row either way)
    let play;
    if (line === 0) play = false;                 // (the first line: the piano alone, as an opening)
    else if (restRun >= 2) play = true;
    else if (harpRun >= 3) play = false;
    else play = rnd.chance(restRun >= 1 ? 0.8 : 0.6);
    if (play) {
      harpRun++; restRun = 0;
      const style = rnd.weighted([['pulse', 0.5], ['rock', 0.2], ['plain', 0.3]]), level = rnd.range(0.85, 1), rate = rnd.range(...WOBBLE[style].rate);
      // one phrase from the start of the line (an answer later in the line, often)
      const phrases = [{ at: t0 + rnd.pick([0, 0, 0.5, 1]), notes: rnd.weighted([[2, 0.2], [3, 0.35], [4, 0.3], [5, 0.15]]), end: chords[1] }];
      if (rnd.chance(0.65)) phrases.push({ at: t0 + 8 + rnd.pick([0, 0, 1]), notes: rnd.weighted([[2, 0.3], [3, 0.4], [4, 0.3]]), end: chords[3] });
      for (const ph of phrases) {
        const limit = ph === phrases[0] && phrases.length > 1 ? t0 + 7.5 : t0 + 15.5;   // (each phrase ends in time)
        const tones = CHORDS[ph.end].tones;
        let cur = near(tones, lastHarp + rnd.range(-3, 3)), beat = ph.at;
        const notes = [];
        for (let i = 0; i < ph.notes; i++) {
          if (i > 0) {
            let idx = PALETTE.indexOf(cur); if (idx < 0) idx = PALETTE.findIndex((m) => m > cur) - 1;
            idx = Math.max(0, Math.min(PALETTE.length - 1, idx + rnd.weighted([[-1, 0.34], [1, 0.34], [-2, 0.13], [2, 0.13], [0, 0.06]])));
            cur = PALETTE[idx];
            if (i === ph.notes - 1) { const pool = tones.filter((m) => m !== notes[i - 1].midi); cur = near(pool.length ? pool : tones, cur); }
          }
          const lastOne = i === ph.notes - 1;
          let len = lastOne ? rnd.pick([3, 4, 4]) : rnd.pick([1, 1.5, 2, 2, 3]);
          const gap = i > 0 && (rnd.chance(0.25) || cur === notes[i - 1].midi) ? 0.5 : 0;    // a breath (the same note again is always a fresh breath)
          beat += gap;
          if (beat + len > limit) len = Math.max(1, limit - beat);
          notes.push({ beat, midi: cur, lenBeats: len, fresh: i === 0 || gap > 0, bend: (i === 0 ? rnd.chance(0.5) : rnd.chance(0.2)) ? Math.round(rnd.range(55, 115)) : 0 });
          beat += len;
          if (beat >= limit - 0.5) break;
        }
        notes[notes.length - 1].last = true;
        for (const n of notes) ev.push({ beat: n.beat, what: 'harp', midi: n.midi, lenBeats: n.lenBeats, fresh: n.fresh, last: !!n.last, bend: n.bend, style, rate, level });
        // now and then the phrase closes on two notes together (a third or a sixth)
        if (rnd.chance(0.2) && beat + 2 <= t0 + 16) {
          const pair = rnd.pick(HARP_PAIRS[ph.end]);
          pair.forEach((m, j) => ev.push({ beat: beat + 0.5, what: 'harp', midi: m, lenBeats: 2.5, fresh: true, last: true, bend: 0, style: 'plain', rate, level: level * 0.72 }));
        }
        lastHarp = notes[notes.length - 1].midi;
      }
    } else { restRun++; harpRun = 0; }
    line++;
    return ev.sort((a, b) => a.beat - b.beat);
  };
}

// ── PLAYING IT ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function makeStageMusic(ctx, { harp, piano, room = null, seed = 1, patches = PATCH_PRESETS } = {}) {
  const tune = makeTune(seed), queue = [], events = [], harpSpans = [], voices = [];
  let origin = null, made = 0, timer = null, running = false;
  const offline = typeof ctx.startRendering === 'function';
  const secs = (beat) => origin + beat * BEAT;
  function play(ev) {
    const at = secs(ev.beat);
    if (ev.what === 'piano') {
      for (const p of pianoNotes({ midi: ev.midi, len: ev.len, vel: ev.vel }, patches[PIANO])) keep(playPatch(ctx, null, piano, room, p, null, { at }), at + ev.len * BEAT);
      events.push({ at, what: 'piano', midi: ev.midi, len: ev.len, vel: ev.vel });
    } else {
      const len = ev.lenBeats * BEAT;
      keep(playPatch(ctx, null, harp, room, harmonicaNote({ ...ev, len }, patches[HARMONICA]), null, { at }), at + len);
      events.push({ at, what: 'harp', midi: ev.midi, len, bend: ev.bend, style: ev.style, fresh: ev.fresh });
      harpSpans.push([at, at + len]);
      while (harpSpans.length > 64) harpSpans.shift();
    }
    M.played++;
    if (!offline && events.length > EVENTS_KEPT) events.splice(0, events.length - EVENTS_KEPT);
  }
  // the notes made so far that may still sound (each with the time its key or breath ends), so a hard stop can reach them
  function keep(h, end) {
    if (offline || !h) return;
    voices.push({ h, end: end + 3 });                         // (+ a few seconds for the fade and the echo)
    const now = ctx.currentTime;
    while (voices.length && voices[0].end < now) voices.shift();
  }
  function pump() {
    if (!running) return;
    const until = (ctx.currentTime - origin) / BEAT + LOOKAHEAD / BEAT;
    while (made * 16 <= until + 16) { queue.push(...tune()); made++; }
    queue.sort((a, b) => a.beat - b.beat);
    while (queue.length && queue[0].beat <= until) {
      const ev = queue.shift();
      if (secs(ev.beat) < ctx.currentTime - 0.05) continue;    // already past (the page was asleep): skipped, never piled up
      play(ev);
    }
  }
  const M = {
    events, played: 0,
    start(at = ctx.currentTime + 0.1) {
      if (running) return;
      running = true; queue.length = 0;
      // (after a stop, the tune carries on from where its dice are, at the new start)
      origin = at - made * 16 * BEAT;
      if (offline) {
        const end = (ctx.length / ctx.sampleRate - origin) / BEAT;
        while (made * 16 <= end) { queue.push(...tune()); made++; }
        for (const ev of queue.sort((a, b) => a.beat - b.beat)) if (secs(ev.beat) >= at - 1e-6 && ev.beat <= end) play(ev);
        queue.length = 0;
      } else { pump(); timer = setInterval(pump, 200); }
    },
    stop({ now = false } = {}) {
      running = false; if (timer) clearInterval(timer); timer = null; queue.length = 0;
      if (now) { for (const v of voices.splice(0)) try { v.h.stop(0.02); } catch (e) { /* already gone */ } harpSpans.length = 0; }
    },
    get running() { return running; },
    beat() { return origin == null ? null : (ctx.currentTime - origin) / BEAT; },
    harmonicaAt(t = ctx.currentTime) { for (const [a, b] of harpSpans) if (t >= a && t < b) return true; return false; },
    // the next time the harmonica starts after t (or null): the player lifts it to the mouth a moment before
    nextHarmonica(t = ctx.currentTime) { let best = null; for (const [a] of harpSpans) if (a >= t && (best == null || a < best)) best = a; return best; },
  };
  return M;
}

// A small wooden room made from decaying noise: dark, about 1.4 s to die away, left and right a little different.
// (One for the whole band; the notes' SEND nodes feed it.)
export function makeRoom(ctx, { seconds = 1.6, seed = 5, delay = 0.018 } = {}) {
  const sr = ctx.sampleRate, n = Math.floor(sr * seconds), buf = ctx.createBuffer(2, n, sr), r = makeRandom(seed);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0, energy = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, fc = 900 + 6000 * Math.exp(-t / 0.35), a = Math.exp(-2 * Math.PI * fc / sr);
      lp = (1 - a) * (r.next() * 2 - 1) + a * lp;
      d[i] = lp * Math.exp(-t / 0.21) * Math.min(1, t / 0.008) * Math.min(1, (seconds - t) / 0.2);
      energy += d[i] * d[i];
    }
    const s = 1 / Math.sqrt(energy); for (let i = 0; i < n; i++) d[i] *= s;
  }
  const input = ctx.createGain(), pre = ctx.createDelay(0.1), conv = ctx.createConvolver();
  pre.delayTime.value = delay; conv.normalize = false; conv.buffer = buf;
  input.connect(pre).connect(conv);
  return { input, output: conv };
}
