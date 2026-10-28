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
// Since the band moved into the saloon a drummer plays with them: a packing crate played with the hands (THE BOX below:
// a thump in the middle of its face, a slap at its top edge, a light finger tap between), noise through filters, no
// tones. Each song has its own box part, made by dice of its own, so the piano and the harmonica play just as they did.
//
//   const M = makeStageMusic(ctx, { harp, piano, box, room, seed, song })   harp / piano / box: where each instrument's
//                          notes go (an AudioNode: the game puts each through its own positioned panner; no box: no
//                          drummer, the old band); room: where their echo goes;
//                          song: which of SONGS ('easy', 'boots', 'waltz', 'lonesome', 'soldiers', 'joeclark'; see MORE
//                          SONGS and OLD FIDDLE TUNES below)
//   M.start(at)            starts the tune at ctx time `at` (the first beat); in an OfflineAudioContext it writes the
//                          whole render at once
//   M.stop()               stops making notes (the ones already sounding ring out)
//   M.stop({ now: true })  also silences every note already made, sounding or still to come (for when the sound goes
//                          to sleep: the notes would be cut off by their own timers meanwhile, so they are let go cleanly)
//   M.stop({ from: t })    lets go the notes made to start at ctx time t or later; the ones sounding ring out (a change
//                          of song: the band finishes what it is playing, then stops)
//   M.beat()               the beat the music is on now (counted from the first one; fractions between), or null
//   M.beatLen, M.bar       the song's seconds a beat and beats a bar;  M.song, M.name   which song
//   M.harmonicaAt(t)       true while the harmonica is playing (a phrase sounding at ctx time t)
//   M.events               what has been scheduled (for testing): [{ at, what, midi, len, ... }]; in the game only the
//                          last EVENTS_KEPT are kept (the band can play for hours), an offline render keeps them all
//   M.played               how many notes have been scheduled in all
//   notePatch(patch, opts) the note as patch data (exported for the render rig)
//   boxNote(hit, patches)  one hit on the box as patch data: { hit: 'thump' | 'slap' | 'tap', vel, tone }
//   makeBoxPart(song, seed, { intro }) -> nextLine   the box's part, a line (four bars) at a time, as the tunes are made
import { playPatch, voicePatch, PATCH_PRESETS } from './patch.js';

export const BEAT = 0.75;                 // seconds a beat in the first song (80 a minute); the performers' clips are four beats long
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
// on from the note before), last (the phrase's last note: the long fade), style, rate, attack?, release? (s: the
// swell and the fade, where a song wants them quicker than the breath's own) }
export function harmonicaNote(n, patch = PATCH_PRESETS[HARMONICA]) {
  const W = WOBBLE[n.style] || WOBBLE.pulse, f = hz(n.midi), node = (id) => patch.nodes.find((x) => x.id === id);
  const set = {
    amp: { attack: n.attack ?? (n.fresh ? 0.55 : 0.09), release: n.release ?? (n.last ? W.fade : 0.22) },   // (a quick song's notes speak and stop sooner)
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

// ── THE FIDDLE ───────────────────────────────────────────────────────────────────────────────────────────────────────
// A real violin, sampled: the solo violin's held notes with vibrato, played loud, from VSCO 2 Community Edition (CC0),
// every two or three notes from G3 to E6, each trimmed to 2.8 s and evened in loudness (sounds/fiddle/, credited in
// sounds/CREDITS.md). The game's maker: "if you are able to get some free to use violin samples and try using those ... pitching them
// up and down, I'd be good with that." A note is the nearest sample played a little faster or slower to its pitch (two
// semitones at most); a quick note starts just into its bow stroke, so it speaks at once instead of swelling, and every
// note is let go with the bow (a short fade).
//   loadFiddle(ctx) -> Promise of the kit (the decoded samples)   playFiddle(ctx, kit, dest, room, note) -> { stop(s) }
//   note: { at (ctx s), midi, len (s), vel 0..1, quick (a short note), release (s) }
export const FIDDLE_SAMPLES = [   // [name, MIDI note, cents sharp as measured, ms into it where it has half its loudness]
  ['G3', 55, -1, 15], ['A3', 57, 1, 5], ['C4', 60, 1, 50], ['E4', 64, 2, 25], ['G4', 67, 2, 105], ['A4', 69, 15, 75],
  ['C5', 72, 2, 45], ['E5', 76, 13, 40], ['G5', 79, 4, 85], ['A5', 81, 1, 125], ['C6', 84, -6, 120], ['E6', 88, 14, 145],
];
const FIDDLE_LEVEL = 0.4;                 // the samples' level: about the harmonica's while each plays (measured in a render)
const audioExt = () => { try { const el = document.createElement('audio'); if (/^(probably|maybe)$/.test(el.canPlayType('audio/ogg; codecs="vorbis"'))) return '.ogg'; } catch (e) { /* no audio element */ } return '.m4a'; };
export async function loadFiddle(ctx, { base = new URL('../../sounds/fiddle/', import.meta.url).href, ext = null } = {}) {
  const e = ext || audioExt();
  return Promise.all(FIDDLE_SAMPLES.map(async ([name, midi, cents, speak]) => {
    const r = await fetch(`${base}fiddle_${name}${e}`);
    if (!r.ok) throw new Error(`fiddle sample ${name}: ${r.status}`);
    return { name, midi: midi + cents / 100, speak: speak / 1000, buf: await ctx.decodeAudioData(await r.arrayBuffer()) };
  }));
}
export function playFiddle(ctx, kit, dest, room, n) {
  const s = kit.reduce((b, x) => (Math.abs(x.midi - n.midi) < Math.abs(b.midi - n.midi) ? x : b), kit[0]);
  const rate = Math.pow(2, (n.midi - s.midi) / 12), src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = s.buf; src.playbackRate.value = rate;
  const at = n.at, peak = FIDDLE_LEVEL * (0.3 + 0.7 * Math.max(0, Math.min(1, n.vel ?? 0.8)));
  const skip = n.quick ? Math.max(0, s.speak - 0.02) : 0, atk = n.quick ? 0.012 : 0.05, rel = n.release ?? (n.quick ? 0.07 : 0.2);
  const hold = Math.max(atk, Math.min(n.len, (s.buf.duration - skip) / rate - rel - 0.05));
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + atk);
  g.gain.setValueAtTime(peak, at + hold); g.gain.linearRampToValueAtTime(0, at + hold + rel);
  src.connect(g); g.connect(dest);
  if (room) { const sg = ctx.createGain(); sg.gain.value = 0.07; g.connect(sg); sg.connect(room); }
  src.start(at, skip); src.stop(at + hold + rel + 0.02);
  return { stop(t = 0) { const now = ctx.currentTime; try { g.gain.cancelScheduledValues(now); g.gain.setTargetAtTime(0, now, Math.max(0.004, t / 3)); src.stop(now + Math.max(0.03, t) + 0.05); } catch (e) { /* already gone */ } } };
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
export function makeTune(seed = 1, { intro = true } = {}) {
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
    if (line === 0 && intro) play = false;        // (the first line: the piano alone, as an opening)
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

// ── MORE SONGS ───────────────────────────────────────────────────────────────────────────────────────────────────────
// The band knows four songs of its own, each made up as it plays by the same kind of seeded dice (nothing from any
// recording), and two old fiddle tunes (OLD FIDDLE TUNES below):
//   easy      "Easy Afternoon"  the tune above: 80 beats a minute in G, the piano's bass and the harmonica's phrases
//   boots     "Dusty Boots"     the quick one: 138 a minute in G, the piano's boom-chick (the bass on one and three, a
//                               short chord on two and four), the harmonica's riffs: a bar's rhythm played, then answered
//   waltz     "Prairie Waltz"   three beats a bar at 100 a minute in D: the bass on one, soft chords on two and three, the
//                               harmonica's long notes swinging over them
//   lonesome  "Lonesome Trail"  slow, 64 a minute in E minor: a long bass note a bar, the harmonica's long bent notes and
//                               rests between
// A song: { id, name, beat (seconds a beat), bar (beats a bar), tune(seed, { intro }) -> nextLine (four bars a line, as
// makeTune; intro: the first line is the piano's alone), ask (what the harmonica player says when asked for it: short,
// to fit one speech bubble's line), feel (a word or two for the band's card: 'a waltz'), upbeat, make (the band's own
// songs: the tune as the dice make it, before the turns), round (a written tune's lines once round, the opening line
// not counted: where it comes home; the made-up songs have none), home (a made-up song's home chord, where its last
// chord lands: src/audio/songend.js; a written tune's is its round's last) }. Piano notes' len is in seconds (as the
// first tune's always were); the harmonica's lenBeats in the song's own beats.
const PENT_G = [62, 64, 67, 69, 71, 74, 76];
// a melody walking a scale a step or two at a time, from `cur`, ending (last) on one of `tones`
function walk(rnd, scale, cur, steps = [[-1, 0.34], [1, 0.34], [-2, 0.13], [2, 0.13], [0, 0.06]]) {
  let i = scale.indexOf(cur); if (i < 0) i = Math.max(0, scale.findIndex((m) => m > cur) - 1);
  return scale[Math.max(0, Math.min(scale.length - 1, i + rnd.weighted(steps)))];
}

// "Dusty Boots": the quick one. Each line a riff: one bar's rhythm, played over the first bar, answered (the same
// rhythm, the notes moved) over the second, played again over the third, and a long note home over the last.
const BOOTS_LINES = [['I', 'I', 'IV', 'I'], ['I', 'IV', 'I', 'V'], ['IV', 'IV', 'I', 'I'], ['I', 'V', 'I', 'V'], ['IV', 'I', 'V', 'I'], ['I', 'I', 'V', 'I']];
const RIFFS = [[1, 0.5, 0.5, 1, 1], [0.5, 0.5, 0.5, 0.5, 1, 1], [1.5, 0.5, 1, 1], [0.5, 0.5, 1, 0.5, 0.5, 1], [1, 1, 0.5, 0.5, 1], [0.5, 0.5, 1, 1, 1]];
export function makeBoots(seed = 1, { intro = true } = {}) {
  const rnd = makeRandom(seed), B = 60 / 138;
  let line = 0, last = 71, restRun = 0;
  return function nextLine() {
    const chords = line === 0 ? ['I', 'I', 'IV', 'V'] : rnd.pick(BOOTS_LINES), t0 = line * 16, ev = [];
    chords.forEach((c, b) => {
      const C = CHORDS[c], bar = t0 + b * 4, next = CHORDS[chords[b + 1] || 'I'];
      // boom on one (the root) and three (the fifth), chick on two and four (a short soft chord)
      ev.push({ beat: bar, what: 'piano', midi: C.root, len: 0.75 * B * 1.6, vel: rnd.range(0.64, 0.74) });
      ev.push({ beat: bar + 2, what: 'piano', midi: C.fifth, len: 0.75 * B * 1.5, vel: rnd.range(0.56, 0.66) });
      for (const k of [1, 3]) ev.push({ beat: bar + k, what: 'piano', midi: C.voicing[(b + (k === 3 ? 1 : 0)) % 2].slice(1), len: B * 0.42, vel: rnd.range(0.3, 0.38) });   // (two notes: lighter, and fewer voices at once)
      // a step up (or down) into the next bar's root, now and then, on the "and" of four
      if (b < 3 && rnd.chance(0.3)) ev.push({ beat: bar + 3.5, what: 'piano', midi: near(PASSING, next.root + rnd.pick([-2, -1, 2])), len: B * 0.4, vel: rnd.range(0.45, 0.52) });
    });
    // the harmonica: in after the first line, resting a line now and then (never two in a row)
    const play = (line > 0 || !intro) && (restRun >= 1 || rnd.chance(0.82));
    if (play) {
      restRun = 0;
      const riff = rnd.pick(RIFFS), level = rnd.range(0.88, 1), style = rnd.weighted([['plain', 0.6], ['pulse', 0.4]]);
      const rate = rnd.range(...WOBBLE[style].rate);
      let firstBar = null;
      for (let b = 0; b < 4; b++) {
        const bar = t0 + b * 4, tones = CHORDS[chords[b]].tones;
        if (b === 3) {   // home: a long note on a chord tone, sometimes with its third under it
          const m = near(tones, last);
          ev.push({ beat: bar, what: 'harp', midi: m, lenBeats: 3, fresh: true, last: true, bend: rnd.chance(0.4) ? Math.round(rnd.range(40, 80)) : 0, style, rate, level, attack: 0.05, release: 0.6 });
          if (rnd.chance(0.3)) { const pair = rnd.pick(HARP_PAIRS[chords[b]]); ev.push({ beat: bar, what: 'harp', midi: pair[0] === m ? pair[1] : pair[0], lenBeats: 3, fresh: true, last: true, bend: 0, style: 'plain', rate, level: level * 0.6, attack: 0.05, release: 0.6 }); }
          last = m;
          continue;
        }
        // the riff's notes: made fresh on the first bar, moved for the answer (bar 2), the first bar's again on bar 3
        let notes;
        if (b === 2 && firstBar) notes = firstBar;
        else {
          let cur = b === 0 ? near(tones, last + rnd.range(-3, 3)) : walk(rnd, PENT_G, firstBar ? firstBar[firstBar.length - 1] : last, [[-2, 0.3], [2, 0.3], [-1, 0.2], [1, 0.2]]);
          notes = riff.map((_, i) => { if (i > 0) cur = walk(rnd, PENT_G, cur); return cur; });
          notes[notes.length - 1] = near(tones, notes[notes.length - 1]);
          if (b === 0) firstBar = notes;
        }
        let beat = bar;
        riff.forEach((len, i) => {
          // (short, picked-out notes: a breath between each, quick to sound)
          ev.push({ beat, what: 'harp', midi: notes[i], lenBeats: Math.max(0.3, len - 0.12), fresh: i === 0, last: false, bend: i === 0 && rnd.chance(0.3) ? 35 : 0, style, rate, level: level * (i === 0 ? 1 : 0.92), attack: i === 0 ? 0.04 : 0.025, release: 0.09 });
          beat += len;
        });
        last = notes[notes.length - 1];
      }
    } else restRun++;
    line++;
    return ev.sort((a, b) => a.beat - b.beat);
  };
}

// "Prairie Waltz": three beats a bar, in D
const WALTZ_CHORDS = {
  I:  { root: 38, fifth: 45, tones: [62, 66, 69, 74], voicing: [[54, 57, 62], [57, 62, 66]] },   // D
  IV: { root: 43, fifth: 38, tones: [62, 67, 71, 74], voicing: [[55, 59, 62], [59, 62, 67]] },   // G
  V:  { root: 45, fifth: 40, tones: [64, 69, 73, 76], voicing: [[52, 57, 61], [57, 61, 64]] },   // A
};
const WALTZ_LINES = [['I', 'I', 'IV', 'I'], ['I', 'V', 'V', 'I'], ['IV', 'I', 'V', 'I'], ['I', 'IV', 'V', 'I'], ['I', 'I', 'V', 'V']];
const PENT_D = [62, 64, 66, 69, 71, 74, 76];
const WALTZ_BARS = [[3], [2, 1], [1, 1, 1], [1.5, 0.5, 1], [2, 1]];   // a bar's rhythm for the harmonica (beats)
export function makeWaltz(seed = 1, { intro = true } = {}) {
  const rnd = makeRandom(seed), B = 0.6;
  let line = 0, last = 69, harpRun = 0;
  return function nextLine() {
    const chords = line === 0 ? ['I', 'IV', 'V', 'I'] : rnd.pick(WALTZ_LINES), t0 = line * 12, ev = [];
    chords.forEach((c, b) => {
      const C = WALTZ_CHORDS[c], bar = t0 + b * 3;
      ev.push({ beat: bar, what: 'piano', midi: b % 2 ? C.fifth : C.root, len: B * 1.1, vel: rnd.range(0.6, 0.7) });   // oom...
      for (const k of [1, 2]) ev.push({ beat: bar + k, what: 'piano', midi: C.voicing[k - 1].slice(1), len: B * 0.55, vel: rnd.range(0.28, 0.36) });   // ...pah-pah (two notes each)
    });
    const play = (line > 0 || !intro) && (harpRun < 3 ? rnd.chance(line === 0 ? 1 : 0.8) : false);
    if (play) {
      harpRun++;
      const level = rnd.range(0.85, 1), style = rnd.weighted([['pulse', 0.6], ['rock', 0.25], ['plain', 0.15]]), rate = rnd.range(...WOBBLE[style].rate);
      let cur = near(WALTZ_CHORDS[chords[0]].tones, last + rnd.range(-2, 2));
      chords.forEach((c, b) => {
        const bar = t0 + b * 3, tones = WALTZ_CHORDS[c].tones, lastBar = b === 3;
        const rhythm = lastBar ? [3] : rnd.pick(WALTZ_BARS);
        let beat = bar;
        rhythm.forEach((len, i) => {
          if (b > 0 || i > 0) cur = walk(rnd, PENT_D, cur);
          if (i === 0) cur = near(tones, cur);   // (each bar starts on its chord)
          const end = lastBar;
          ev.push({ beat, what: 'harp', midi: cur, lenBeats: end ? 2.6 : len, fresh: (b === 0 && i === 0) || rnd.chance(0.2), last: end, bend: i === 0 && rnd.chance(0.35) ? Math.round(rnd.range(50, 100)) : 0, style, rate, level, attack: b === 0 && i === 0 ? 0.3 : undefined });
          beat += len;
        });
      });
      last = cur;
    } else harpRun = 0;
    line++;
    return ev.sort((a, b) => a.beat - b.beat);
  };
}

// "Lonesome Trail": slow, in E minor
const LONE_CHORDS = {
  i:   { root: 40, fifth: 47, tones: [64, 67, 71, 76], voicing: [[55, 59, 64], [52, 55, 59]] },   // E minor
  iv:  { root: 45, fifth: 40, tones: [64, 69, 72, 76], voicing: [[57, 60, 64], [52, 57, 60]] },   // A minor
  VII: { root: 38, fifth: 45, tones: [62, 66, 69, 74], voicing: [[54, 57, 62], [57, 62, 66]] },   // D
  VI:  { root: 48, fifth: 43, tones: [64, 67, 72, 76], voicing: [[55, 60, 64], [52, 55, 60]] },   // C
};
const LONE_LINES = [['i', 'i', 'iv', 'i'], ['i', 'VII', 'VI', 'i'], ['i', 'iv', 'VII', 'i'], ['VI', 'VII', 'i', 'i'], ['i', 'VI', 'iv', 'i']];
const PENT_E = [62, 64, 67, 69, 71, 74, 76];
export function makeLonesome(seed = 1, { intro = true } = {}) {
  const rnd = makeRandom(seed), B = 60 / 64;
  let line = 0, last = 71, harpRun = 0, restRun = 0;
  return function nextLine() {
    const chords = line === 0 ? ['i', 'i', 'iv', 'i'] : rnd.pick(LONE_LINES), t0 = line * 16, ev = [];
    chords.forEach((c, b) => {
      const C = LONE_CHORDS[c], bar = t0 + b * 4;
      ev.push({ beat: bar, what: 'piano', midi: C.root, len: B * rnd.range(2.6, 3.4), vel: rnd.range(0.5, 0.6) });
      if (rnd.chance(0.5)) ev.push({ beat: bar + 2, what: 'piano', midi: rnd.pick(C.voicing), len: B * rnd.range(1.2, 1.8), vel: rnd.range(0.24, 0.32) });
    });
    let play;
    if (line === 0) play = !intro; else if (restRun >= 1) play = true; else if (harpRun >= 2) play = false; else play = rnd.chance(0.7);
    if (play) {
      harpRun++; restRun = 0;
      const level = rnd.range(0.82, 0.96), style = rnd.weighted([['rock', 0.55], ['pulse', 0.45]]), rate = rnd.range(...WOBBLE[style].rate);
      // one long phrase over the line: three to five notes of two to four beats, the last held long
      const n = rnd.weighted([[3, 0.35], [4, 0.4], [5, 0.25]]);
      let beat = t0 + rnd.pick([0, 0.5, 1]), cur = near(LONE_CHORDS[chords[0]].tones, last + rnd.range(-3, 3));
      for (let i = 0; i < n; i++) {
        if (i > 0) cur = walk(rnd, PENT_E, cur, [[-1, 0.4], [1, 0.3], [-2, 0.15], [2, 0.15]]);
        const lastOne = i === n - 1, at = Math.floor((beat - t0) / 4), tones = LONE_CHORDS[chords[Math.min(3, at)]].tones;
        if (lastOne) cur = near(tones, cur);
        let len = lastOne ? 4 : rnd.pick([2, 2, 3, 1.5]);
        if (beat + len > t0 + 15.5) len = Math.max(1, t0 + 15.5 - beat);
        ev.push({ beat, what: 'harp', midi: cur, lenBeats: len, fresh: i === 0 || rnd.chance(0.35), last: lastOne, bend: rnd.chance(i === 0 ? 0.8 : 0.4) ? Math.round(rnd.range(70, 140)) : 0, style, rate, level });
        beat += len + (rnd.chance(0.3) ? 0.5 : 0);
        if (beat >= t0 + 15) break;
      }
      last = cur;
    } else { restRun++; harpRun = 0; }
    line++;
    return ev.sort((a, b) => a.beat - b.beat);
  };
}

// ── OLD FIDDLE TUNES ─────────────────────────────────────────────────────────────────────────────────────────────────
// Seven real tunes, old enough that nobody owns them (traditional, public domain), in the band's own arrangement: the
// harmonica plays the tune as written, the piano a boom-chick under the chords, the box as in the quick song. Only the
// notes are taken, from the written tunes; no recording. Where a source had no chords, the chords are the band's own.
//   soldiers  "Soldier's Joy"      a fiddle tune from the 1700s, played all over the frontier; the notes as the session
//                                  tunebooks write it (thesession.org, tune 1356, its first setting)
//   joeclark  "Old Joe Clark"      an Appalachian fiddle tune from the 1800s; the notes as natunelist.net writes it, with
//                                  the breaths at the ends of the lines (bars 4 and 8) and the chords as colinhume.com
//                                  writes them (thesession.org's two settings agree on the tune)
//   arkansas  "Arkansas Traveler"  from the 1840s; the notes as natunelist.net writes them, the chords as the
//                                  Combined Tunebook (kaz.neocities.org) has them (thesession.org agrees on the tune)
//   sally     "Sally Goodin"       an old breakdown fiddled every way there is; one plain setting (the Traditional Tune
//                                  Archive, tunearch.org, its first), the fiddle's double stops as their top notes, its
//                                  quick notes played as eighths (a 2/4 bar here is four beats)
//   cripple   "Cripple Creek"      a banjo tune from the hills; the notes and chords as colinhume.com writes them (the
//                                  Nottingham Music Database agrees)
//   devils    "Devil's Dream"      a reel from the early 1800s; the notes as O'Neill's Music of Ireland (1903) prints
//                                  them, its first two parts, the chords as thesession.org's setting 259 has them
//   fishers   "Fisher's Hornpipe"  from the late 1700s; the notes as thesession.org's setting 14043 writes them (its
//                                  other settings agree on the tune), the triplet kept
// Each part is written in ABC, the plain text folk musicians write tunes in: a letter a note (C..B the octave up from
// middle C, c..b the one above; ' an octave higher, , lower), a number after it the eighths it lasts (/ halves it),
// ^ _ = a sharp, flat or natural, z a rest, | a bar line, "D" the chord from there on, (3 three notes in the time of two.
// The key's sharps or flats hold unless a note says otherwise (a note's own lasts to the end of its bar). A section with
// two endings is written as two sections (A for the first time through, A2 for the second).
//   readAbc(text, { key, unit }) -> bars [{ notes: [{ at, len, midi (null: a rest) }], chords: [{ at, name }], len }]
//                          at and len in beats (unit: the beats one written note length lasts: 0.5 for an eighth
//                          with the beat a quarter note)
//   chordOf(name, semi)    a chord's root and fifth for the piano's left hand and two soft voicings for its right
const ABC_KEYS = { C: '', G: '^F', D: '^F^C', A: '^F^C^G', Dmix: '^F', Amix: '^F^C', Emix: '^F^C^G', F: '_B' };   // each key's sharps and flats
const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function readAbc(text, { key = 'D', unit = 0.5 } = {}) {
  const sig = ABC_KEYS[key] ?? '', bars = [];
  let bar = { notes: [], chords: [] }, t = 0, held = {}, i = 0, three = 0;
  const close = () => { if (bar.notes.length) bars.push({ ...bar, len: t }); bar = { notes: [], chords: [] }; t = 0; held = {}; };
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') { const j = text.indexOf('"', i + 1); bar.chords.push({ at: t, name: text.slice(i + 1, j) }); i = j + 1; continue; }
    if (ch === '|') { close(); i++; continue; }
    if (ch === '(' && text[i + 1] === '3') { three = 3; i += 2; continue; }
    let acc = null;
    if (ch === '^' || ch === '_' || ch === '=') { acc = ch === '^' ? 1 : ch === '_' ? -1 : 0; i++; }
    const c = text[i];
    if (!c || !/[A-Ga-gz]/.test(c)) { i++; continue; }   // (spaces, repeat marks: nothing to play)
    i++;
    let oct = 0;
    while (text[i] === "'" || text[i] === ',') { oct += text[i] === "'" ? 12 : -12; i++; }
    let num = '';
    while (/\d/.test(text[i] || '')) num += text[i++];
    let len = num ? +num : 1;
    while (text[i] === '/') { i++; let d = ''; while (/\d/.test(text[i] || '')) d += text[i++]; len /= d ? +d : 2; }
    len *= unit;
    if (three > 0) { len *= 2 / 3; three--; }
    if (c === 'z') { bar.notes.push({ at: t, len, midi: null }); t += len; continue; }
    const up = c.toUpperCase(), base = 60 + STEP[up] + (c === up ? 0 : 12) + oct;
    if (acc != null) held[base] = acc;
    bar.notes.push({ at: t, len, midi: base + (held[base] ?? (sig.includes('^' + up) ? 1 : sig.includes('_' + up) ? -1 : 0)) });
    t += len;
  }
  close();
  return bars;
}
export function chordOf(name, semi = 0) {
  const m = /^([A-G])([#b]?)(m?)/.exec(name || 'C');
  const pc = (((STEP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + semi) % 12) + 12) % 12, minor = m[3] === 'm';
  // (the bass between D2 and C#3, where the piano's sound was measured; the fifth below the root when above B2, as CHORDS)
  const root = 36 + pc < 38 ? 48 + pc : 36 + pc, fifth = root + 7 <= 47 ? root + 7 : root - 5;
  const tones = [0, minor ? 3 : 4, 7].map((x) => (pc + x) % 12), span = [];
  for (let k = 52; k <= 71; k++) if (tones.includes(k % 12)) span.push(k);
  const s = span.findIndex((k) => k >= 54);
  return { root, fifth, voicing: [span.slice(s, s + 3), span.slice(s + 1, s + 4)] };
}
// A tune: sections, then their order (the shape every song is to take, a song designer's too: ~/pw/bandit-math/BAND.md):
// { parts: { A, B } (each section in ABC, any number of bars), form (the order once round, a section as often as it
// comes: ['A', 'A', 'B', 'B']), key (as written), unit (beats a written note length lasts: 0.5 if left out), semi (how
// far the band plays it from where it's written: the harmonica's notes as measured sat about D4..E5, so each goes down
// a fourth or a fifth into about A3..E5), beat (s) }
export const FIDDLE_TUNES = {
  soldiers: {
    key: 'D', semi: -5, beat: 60 / 112, form: ['A', 'A', 'B', 'B'],
    parts: {
      A: '"D"AFDF AFDF|"D"A2 d2 d2 cB|"D"AFDF AFDF|"A"G2E2 E2 FG|"D"AFDF AFDF|"D"A2 d2 d2 de|"D"fafd "A"egec|"D"d2 d2 d4',
      B: '"D"fdfd fagf|"A"edcd efge|"D"fdfd fagf|"A"edcB A2 de|"D"fdfd fagf|"A"ecAc efge|"D"fafd "A"egec|"D"d2 d2 d4',
    },
  },
  joeclark: {
    key: 'Amix', semi: -5, beat: 60 / 140, form: ['A', 'A', 'B', 'B'],
    parts: {
      A: '"A"e2 f2 "G"g2 f2|"A"e2 d2 c4|"A"e2 f2 "G"g2 f2|"A"e4 z4|"A"e2 f2 "G"g2 f2|"A"e2 d2 c4|"A"ABcA "G"B2 G2|"A"A4 z4',
      B: '"A"A2 ABcB A2|"A"e2 d2 c4|"A"A2 ABcB A2|"G"G4 z4|"A"A2 ABcB A2|"A"e2 d2 c4|"A"ABcA "G"B2 G2|"A"A4 z4',
    },
  },
  arkansas: {
    key: 'D', semi: -7, beat: 60 / 116, form: ['A', 'A2', 'B', 'B2'],
    parts: {
      A: '"D"dfed "G"B2B2|"D"A2A2 d2d2|"A"e2e2 "D"f2f2|"Em"efed "A"B2A2|"D"dfed "G"B2B2|"D"A2A2 d4|"D"dcdA "G"BdAG|"A"F2E2 "D"D2A2',
      A2: '"D"dfed "G"B2B2|"D"A2A2 d2d2|"A"e2e2 "D"f2f2|"Em"efed "A"B2A2|"D"dfed "G"B2B2|"D"A2A2 d4|"D"dcdA "G"BdAG|"A"F2E2 "D"D2 fg',
      B: '"D"agfa "G"gfeg|"D"fedf "A"e2A2|"D"dcde fefg|"D"afdf "A"e2fg|"D"agfa "G"gfeg|"D"fedf "A"e2A2|"D"dcdA "G"BdAG|"A"F2E2 "D"D2 fg',
      B2: '"D"agfa "G"gfeg|"D"fedf "A"e2A2|"D"dcde fefg|"D"afdf "A"e2fg|"D"agfa "G"gfeg|"D"fedf "A"e2A2|"D"dcdA "G"BdAG|"A"F2E2 "D"D2A2',
    },
  },
  sally: {
    key: 'A', unit: 1, semi: -5, beat: 60 / 112, form: ['A', 'A', 'B', 'B'],
    parts: {
      A: '"A"A/c/B/A/ A A/B/|"A"c/A/B/A/ A A|"A"A/c/B/A/ A A/F/|"E"E/C/E/E/ "A"A A',
      B: '"A"e3/2 e/ e c/e/|"D"f/g/a/e/ "A"f/e/c/d/|"A"e f/e/ "E"c/B/A/B/|"A"c/A/B/A/ A A',
    },
  },
  cripple: {
    key: 'A', unit: 1, semi: -5, beat: 60 / 132, form: ['A', 'A', 'B', 'B'],
    parts: {
      A: '"A"aa e/g/f/e/|"D"df "E7"e2|"A"aa e/f/e/d/|"E7"c/A/B "A"A2',
      B: '"A"ce/c/ BA|"Bm"Bc "E7"E2|"A"ce/c/ BA|"E7"F/E/F/G/ "A"A2',
    },
  },
  devils: {
    key: 'A', semi: -7, beat: 60 / 116, form: ['A', 'A', 'B', 'B'],
    parts: {
      A: '"A"eaga eaga|"A"eaga fedc|"Bm"dfBf dfBf|"Bm"dfBf gfed|"A"eaga eaga|"A"eaga fedc|"D"dfed "A"cA"E"BG|"E"E2 "A"A2 A2 e2',
      B: '"A"ceAe ceAe|"A"ceAe fedc|"Bm"dfBf dfBf|"Bm"dfBf afed|"A"ceAe ceAe|"A"ceAe fedc|"D"dfed "A"cA"E"BG|"E"E2 "A"A2 A2 e2',
    },
  },
  fishers: {
    key: 'F', semi: -7, beat: 60 / 104, form: ['A', 'A2', 'B', 'B2'],
    parts: {
      A: '"F"fcAc "Bb"BdcB|"F"AcAc "C"BdcB|"F"AcFc "Gm"BdGd|"F"AcFA "C"G2 (3cde|"F"fcAc "Bb"BdcB|"F"AcFc "C"BdcB|"F"ABcd "C"efge|"F"f2a2 f2 c2',
      A2: '"F"fcAc "Bb"BdcB|"F"AcAc "C"BdcB|"F"AcFc "Gm"BdGd|"F"AcFA "C"G2 (3cde|"F"fcAc "Bb"BdcB|"F"AcFc "C"BdcB|"F"ABcd "C"efge|"F"f2a2 f2 ef',
      B: '"C"gece gebg|"F"afcf afba|"C"gece gaba|"C"gfed c2Bc|"Bb"dBFB dBfd|"F"cAFA cAfc|"Bb"dfed "C"cBAG|"F"F2A2 F2 ef',
      B2: '"C"gece gebg|"F"afcf afba|"C"gece gaba|"C"gfed c2Bc|"Bb"dBFB dBfd|"F"cAFA cAfc|"Bb"dfed "C"cBAG|"F"F2A2 F2 c2',
    },
  },
};
// The tune once round as bars, each with the chord sounding at its start (a bar without one of its own: the last one's)
export function fiddleRound(T) {
  const parts = {};
  for (const p of Object.keys(T.parts)) parts[p] = readAbc(T.parts[p], { key: T.key, unit: T.unit ?? 0.5 });
  const round = [];
  let chord = null;
  T.form.forEach((p, pos) => parts[p].forEach((bar, i) => {
    const chords = bar.chords.slice();
    if (!chords.length || chords[0].at > 0) chords.unshift({ at: 0, name: chord });
    chord = chords[chords.length - 1].name;
    round.push({ ...bar, chords, part: p, i, pos });   // (pos: the section's place in the order)
  }));
  if (round[0].chords[0].name == null) round[0].chords[0].name = chord;
  return round;
}
// The band playing it: the opening line (when there is one) the piano's alone on the first four bars' chords, then the
// tune round and round. The harmonica tongues each note short in the quick runs, swells a long note with its pulse
// (bending into it now and then, more often the second time round), leans on the beat.
// Who has the tune (the game's maker: the piano should "play some of the higher notes too, like alternate or play along with the
// harmonica", then "I like it when the piano high end and harmonica switch like that"): the sections take turns down
// the order, the harmonica, then the piano's right hand (an octave above the harmonica), and so on; each time round it
// moves on one, so every section gets each. With the fiddle in the band (its samples loaded: makeStageMusic says so),
// the turns are the fiddle, the harmonica, the piano, then the fiddle and the harmonica together. While the right hand
// has the tune it leaves out the soft chords on two and four; the left hand's bass goes on.
export const LEADS = ['harp', 'piano'], FIDDLE_LEADS = ['fiddle', 'harp', 'piano', 'fiddle+harp'];
export const fiddleLead = (pos, time, fiddle = false) => { const L = fiddle ? FIDDLE_LEADS : LEADS; return L[(pos + time) % L.length]; };
function makeFiddle(T) {
  const round = fiddleRound(T);
  return function tune(seed = 1, { intro = true, fiddle = false } = {}) {
    const rnd = makeRandom(seed), B = T.beat;
    let line = 0;
    return function nextLine() {
      const t0 = line * 16, ev = [], opening = line === 0 && intro, n = intro ? line - 1 : line;
      const level = rnd.range(0.88, 1), rate = rnd.range(...WOBBLE.pulse.rate);
      for (let b = 0; b < 4; b++) {
        const k = opening ? b : n * 4 + b, bar = round[k % round.length], time = Math.floor(k / round.length), at = t0 + b * 4;
        const chordAt = (beat) => { let c = bar.chords[0]; for (const x of bar.chords) if (x.at <= beat + 1e-9) c = x; return c; };
        const one = chordAt(0), three = chordAt(2), C1 = chordOf(one.name, T.semi), C3 = chordOf(three.name, T.semi);
        const lead = opening ? null : fiddleLead(bar.pos, time, fiddle), harp = lead === 'harp' || lead === 'fiddle+harp', fid = lead === 'fiddle' || lead === 'fiddle+harp', right = lead === 'piano';
        // boom on one (the root) and three (the fifth; the new chord's root when it changes there), chick on two and four
        // (the bass well under the tune, the chick up a little: the game's maker heard the piano's bass and the harmonica over the rest;
        // measured, the piano sat about 7 dB over the harmonica while each played)
        ev.push({ beat: at, what: 'piano', midi: C1.root, len: 0.75 * B * 1.6, vel: rnd.range(0.36, 0.42) });
        ev.push({ beat: at + 2, what: 'piano', midi: three === one ? C1.fifth : C3.root, len: 0.75 * B * 1.5, vel: rnd.range(0.31, 0.37) });
        if (!right) for (const q of [1, 3]) ev.push({ beat: at + q, what: 'piano', midi: chordOf(chordAt(q).name, T.semi).voicing[(b + (q === 3 ? 1 : 0)) % 2].slice(1), len: B * 0.42, vel: rnd.range(0.38, 0.46) });
        if (opening) continue;
        bar.notes.forEach((nt, j) => {
          if (nt.midi == null) return;
          const prev = bar.notes[j - 1], next = bar.notes[j + 1] || round[(k + 1) % round.length].notes[0], long = nt.len >= 2;
          // the right hand: the tune an octave up, the keys let go a little before the next note (softer when both play)
          if (right) ev.push({ beat: at + nt.at, what: 'piano', lead: true, midi: nt.midi + T.semi + 12, len: nt.len * B * (long ? 0.95 : 0.85), vel: nt.at % 1 === 0 ? 0.56 : 0.46 });
          // the fiddle: the tune where the harmonica plays it, bowed nearly joined (a quick note's bow speaks at once);
          // with the harmonica in unison, a little softer (doubled: makeStageMusic leaves it out if there's no fiddle)
          const harpNote = {
            beat: at + nt.at, what: 'harp', midi: nt.midi + T.semi, lenBeats: Math.max(0.3, nt.len - (long ? 0.25 : 0.12)),
            fresh: j === 0 || !prev || prev.midi == null, last: long || !next || next.midi == null,
            bend: long && rnd.chance(time % 2 ? 0.6 : 0.25) ? Math.round(rnd.range(35, 70)) : 0,
            style: long ? 'pulse' : 'plain', rate, level: level * (nt.at % 1 === 0 ? 1 : 0.9),
            attack: j === 0 ? 0.04 : 0.025, release: long ? 0.35 : 0.09,
          };
          if (fid) ev.push({ ...harpNote, what: 'fiddle', lenBeats: nt.len * (long ? 0.97 : 0.92), quick: nt.len < 1, vel: (nt.at % 1 === 0 ? 0.85 : 0.72) * (harp ? 0.8 : 1), doubled: harp });
          if (!harp) return;
          ev.push({
            beat: at + nt.at, what: 'harp', midi: nt.midi + T.semi, lenBeats: Math.max(0.3, nt.len - (long ? 0.25 : 0.12)),
            fresh: j === 0 || !prev || prev.midi == null, last: long || !next || next.midi == null,
            bend: long && rnd.chance(time % 2 ? 0.6 : 0.25) ? Math.round(rnd.range(35, 70)) : 0,
            style: long ? 'pulse' : 'plain', rate, level: level * (nt.at % 1 === 0 ? 1 : 0.9),
            attack: j === 0 ? 0.04 : 0.025, release: long ? 0.35 : 0.09,
          });
        });
      }
      line++;
      return ev.sort((a, b) => a.beat - b.beat);
    };
  };
}

// ── THE BOX ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// The drummer's packing crate, played with the hands, as a box drum is: the palm in the middle of its front face for a
// hollow thump (the air in the box rings, the boards with it, a deep thud under them), the fingers at its top edge for a
// slap (the board's wooden knock, a little crack), and a light tap of the fingers between the beats. All noise: a slow
// stepped noise through a low band that slides down (the thud, below the piano's bass so it isn't hidden), white noise
// through bands (the box's hollow ring about 190 Hz, the boards about 330, the knock about 600, the crack 1.5 kHz) and
// a little through a high pass (the snap). The game's maker (2026-10-28): the first box was "very clicky" and its bass wasn't heard
// (the thud sat under the piano's bass notes): this one has most of its sound in the hollow 150-500 Hz, little hiss. Sound Lab patches, as
// the piano's and the harmonica's are (a preset of the same name in patch.js takes their place: one tuned in the lab).
export const BOX_THUMP = 'STAGE — BOX THUMP', BOX_SLAP = 'STAGE — BOX SLAP';
export const BOX_PATCHES = {
  [BOX_THUMP]: {
    name: 'Box drum (thump)', group: 'MUSIC', kind: 'perc', dur: 0.5,
    nodes: [
      { id: 'air', type: 'noise', name: 'air', freq: 120, steps: 2, rate: 1, loopLen: 0.5 },
      { id: 'boom-f', type: 'filter', name: 'boom', ftype: 'bandpass', freq: 92, freqEnd: 60, glide: 0.07, Q: 3 },
      { id: 'boom-lp', type: 'filter', name: 'boom (soft)', ftype: 'lowpass', freq: 180, Q: 0.7 },
      { id: 'boom-e', type: 'env', name: 'boom', peak: 0.3, attack: 0.004, decay: 0.26, sustain: 0 },
      { id: 'boom-v', type: 'gain', name: 'boom', gain: 0 },
      { id: 'nz', type: 'noise', name: 'palm', freq: 600, steps: 256, rate: 1, loopLen: 0.4 },
      { id: 'hollow-f', type: 'filter', name: 'hollow', ftype: 'bandpass', freq: 190, Q: 4 },
      { id: 'hollow-e', type: 'env', name: 'hollow', peak: 4.2, attack: 0.002, decay: 0.3, sustain: 0 },
      { id: 'hollow-v', type: 'gain', name: 'hollow', gain: 0 },
      { id: 'body-f', type: 'filter', name: 'body', ftype: 'bandpass', freq: 330, Q: 3 },
      { id: 'body-e', type: 'env', name: 'body', peak: 2.4, attack: 0.002, decay: 0.11, sustain: 0 },
      { id: 'body-v', type: 'gain', name: 'body', gain: 0 },
      { id: 'palm-f', type: 'filter', name: 'palm', ftype: 'bandpass', freq: 560, Q: 1.1 },
      { id: 'palm-e', type: 'env', name: 'palm', peak: 0.35, attack: 0.002, decay: 0.025, sustain: 0 },
      { id: 'palm-v', type: 'gain', name: 'palm', gain: 0 },
      { id: 'mix', type: 'gain', name: 'mix', gain: 1 },
      { id: 'send', type: 'send', name: 'room', gain: 0.06 },
      { id: 'out', type: 'out', name: 'output', gain: 1.65 },
    ],
    cables: [
      { from: 'air', to: 'boom-f' }, { from: 'boom-f', to: 'boom-lp' }, { from: 'boom-lp', to: 'boom-v' }, { from: 'boom-e', to: 'boom-v', port: 'gain' },
      { from: 'boom-v', to: 'mix' }, { from: 'nz', to: 'hollow-f' }, { from: 'hollow-f', to: 'hollow-v' }, { from: 'hollow-e', to: 'hollow-v', port: 'gain' },
      { from: 'hollow-v', to: 'mix' }, { from: 'nz', to: 'body-f' }, { from: 'body-f', to: 'body-v' }, { from: 'body-e', to: 'body-v', port: 'gain' },
      { from: 'body-v', to: 'mix' }, { from: 'nz', to: 'palm-f' }, { from: 'palm-f', to: 'palm-v' }, { from: 'palm-e', to: 'palm-v', port: 'gain' },
      { from: 'palm-v', to: 'mix' }, { from: 'mix', to: 'out' }, { from: 'mix', to: 'send' },
    ],
  },
  [BOX_SLAP]: {
    name: 'Box drum (slap)', group: 'MUSIC', kind: 'perc', dur: 0.3,
    nodes: [
      { id: 'nz', type: 'noise', name: 'crack', freq: 600, steps: 256, rate: 1, loopLen: 0.4 },
      { id: 'wood-f', type: 'filter', name: 'wood', ftype: 'bandpass', freq: 600, Q: 3.2 },
      { id: 'wood-e', type: 'env', name: 'wood', peak: 2.2, attack: 0.002, decay: 0.075, sustain: 0 },
      { id: 'wood-v', type: 'gain', name: 'wood', gain: 0 },
      { id: 'crack-f', type: 'filter', name: 'crack', ftype: 'bandpass', freq: 1500, Q: 1.1 },
      { id: 'crack-e', type: 'env', name: 'crack', peak: 0.5, attack: 0.002, decay: 0.035, sustain: 0 },
      { id: 'crack-v', type: 'gain', name: 'crack', gain: 0 },
      { id: 'snap-f', type: 'filter', name: 'snap', ftype: 'highpass', freq: 5200, Q: 0.7 },
      { id: 'snap-e', type: 'env', name: 'snap', peak: 0.12, attack: 0.0005, decay: 0.01, sustain: 0 },
      { id: 'snap-v', type: 'gain', name: 'snap', gain: 0 },
      { id: 'body-f', type: 'filter', name: 'body', ftype: 'bandpass', freq: 210, Q: 3 },
      { id: 'body-e', type: 'env', name: 'body', peak: 0.9, attack: 0.002, decay: 0.1, sustain: 0 },
      { id: 'body-v', type: 'gain', name: 'body', gain: 0 },
      { id: 'mix', type: 'gain', name: 'mix', gain: 1 },
      { id: 'send', type: 'send', name: 'room', gain: 0.06 },
      { id: 'out', type: 'out', name: 'output', gain: 1.9 },
    ],
    cables: [
      { from: 'nz', to: 'wood-f' }, { from: 'wood-f', to: 'wood-v' }, { from: 'wood-e', to: 'wood-v', port: 'gain' }, { from: 'wood-v', to: 'mix' },
      { from: 'nz', to: 'crack-f' }, { from: 'crack-f', to: 'crack-v' }, { from: 'crack-e', to: 'crack-v', port: 'gain' }, { from: 'crack-v', to: 'mix' },
      { from: 'nz', to: 'snap-f' }, { from: 'snap-f', to: 'snap-v' }, { from: 'snap-e', to: 'snap-v', port: 'gain' }, { from: 'snap-v', to: 'mix' },
      { from: 'nz', to: 'body-f' }, { from: 'body-f', to: 'body-v' }, { from: 'body-e', to: 'body-v', port: 'gain' }, { from: 'body-v', to: 'mix' },
      { from: 'mix', to: 'out' }, { from: 'mix', to: 'send' },
    ],
  },
};
// one hit: { hit: 'thump' | 'slap' | 'tap', vel 0..1, tone (a little more or less ring: 0.94..1.06, so no two hits are
// quite the same) }. A tap is a slap with the fingers alone: lighter, quicker, no boom under it.
export function boxNote({ hit = 'thump', vel = 0.8, tone = 1 } = {}, patches = PATCH_PRESETS) {
  const v = Math.max(0.05, Math.min(1, vel)), gain = 0.2 + 0.8 * Math.pow(v, 1.3);
  const P = hit === 'thump' ? patches[BOX_THUMP] || BOX_PATCHES[BOX_THUMP] : patches[BOX_SLAP] || BOX_PATCHES[BOX_SLAP];
  // (each change made from the patch's own setting, so a patch tuned in the lab keeps its sound; a node it lacks is left)
  const set = {}, scale = (id, key, by) => { const n = P.nodes.find((x) => x.id === id); if (n && n[key] != null) (set[id] = set[id] || {})[key] = n[key] * by; };
  if (hit === 'thump') {
    scale('boom-f', 'freq', tone); scale('boom-f', 'freqEnd', tone); scale('hollow-f', 'freq', tone);
    scale('boom-e', 'decay', 0.85 + 0.3 * v);
    return notePatch(P, { gain, set });
  }
  const tap = hit === 'tap';
  scale('crack-f', 'freq', (tap ? 1.35 : 1) * tone); scale('wood-f', 'freq', tone);
  if (tap) { scale('crack-e', 'decay', 0.55); scale('wood-e', 'peak', 0.45); scale('body-e', 'peak', 0); }
  return notePatch(P, { gain: tap ? gain * 0.55 : gain, set });
}
// Each song's part, a bar at a time: [beat in the bar, hit, how hard], with the line's dice (first: the song's opening
// line, the piano's alone; end: the line's last bar, where a little fill leads round)
const BOX_BARS = {
  // the easy one: a backbeat (thump on one and three, slap on two and four), a push into three now and then, a tap on
  // the "and" of four into the next bar; the opening line just a soft thump a bar, under the piano
  easy: (r, { first, end }) => {
    if (first) return [[0, 'thump', 0.5]];
    const h = [[0, 'thump', 0.9], [1, 'slap', 0.66], [2, 'thump', 0.7], [3, 'slap', 0.72]];
    if (r.chance(0.3)) h.push([2.5, 'thump', 0.42]);
    if (end && r.chance(0.5)) h.push([3.5, 'slap', 0.6]); else if (r.chance(0.3)) h.push([3.5, 'tap', 0.4]);
    return h;
  },
  // the quick one: the same backbeat with taps on the "and"s, the gallop's extra thump before three, a fill at the end
  boots: (r, { first, end }) => {
    if (first) return [[0, 'thump', 0.7], [2, 'thump', 0.6]];
    const h = [[0, 'thump', 0.9], [1, 'slap', 0.7], [2, 'thump', 0.72], [3, 'slap', 0.74]];
    for (const a of [0.5, 1.5, 2.5]) if (r.chance(a === 1.5 ? 0.7 : 0.45)) h.push([a, a === 2.5 && r.chance(0.5) ? 'thump' : 'tap', a === 2.5 ? 0.5 : 0.34]);
    if (end && r.chance(0.55)) h.push([3.5, 'slap', 0.66]); else if (r.chance(0.5)) h.push([3.5, 'tap', 0.36]);
    return h;
  },
  // the old fiddle tunes: thump on one and three, slap on two and four, a thump pushing into three now and then (the
  // gallop), and few taps (the game's maker: the busier part sounded "very clicky")
  reel: (r, { first, end }) => {
    if (first) return [[0, 'thump', 0.7], [2, 'thump', 0.6]];
    const h = [[0, 'thump', 0.95], [1, 'slap', 0.62], [2, 'thump', 0.8], [3, 'slap', 0.66]];
    if (r.chance(0.4)) h.push([1.5, 'thump', 0.5]);
    if (end && r.chance(0.5)) h.push([3.5, 'slap', 0.5]); else if (r.chance(0.2)) h.push([3.5, 'tap', 0.32]);
    return h;
  },
  // the waltz: thump, slap, slap (the oom-pah-pah), the slaps light; now and then a tap before the next bar
  waltz: (r, { first, end }) => {
    if (first) return [[0, 'thump', 0.5]];
    const h = [[0, 'thump', 0.82], [1, 'slap', 0.46], [2, 'slap', 0.42]];
    if (!end && r.chance(0.18)) h.push([2.5, 'tap', 0.3]);
    return h;
  },
  // the slow one: sparse, a thump a bar and a soft slap on three in most; the opening line left to the piano
  lonesome: (r, { first, end }) => {
    if (first) return [];
    const h = [[0, 'thump', 0.62]];
    if (!end && r.chance(0.65)) h.push([2, 'slap', 0.36]);
    if (!end && r.chance(0.2)) h.push([3.5, 'tap', 0.24]);
    return h;
  },
};
export function makeBoxPart(song, seed = 1, { intro = true } = {}) {
  const S = songOf(song), part = BOX_BARS[S.box || S.id] || BOX_BARS.easy, rnd = makeRandom(seed * 7 + 3);   // (its own dice: the tune's stay as they were)
  let line = 0;
  return function nextLine() {
    const t0 = line * S.bar * 4, ev = [], first = line === 0 && intro;
    for (let b = 0; b < 4; b++) {
      for (const [at, hit, vel] of part(rnd, { first, end: b === 3, bar: b })) {
        // (a hair early or late, and a little harder or softer: a person playing, not a machine)
        const beat = t0 + b * S.bar + at + (at > 0 ? rnd.range(-0.012, 0.012) : 0);
        ev.push({ beat, what: 'box', hit, vel: Math.min(1, vel * rnd.range(0.92, 1.06)), tone: rnd.range(0.95, 1.05) });
      }
    }
    line++;
    return ev.sort((a, b) => a.beat - b.beat);
  };
}

// The band's own songs take turns too (the game's maker, hearing the fiddle tunes: "I like it when the piano high end and harmonica
// switch like that. We should keep our songs switching back and forth like that."): of the lines the harmonica plays,
// every other one goes to the piano's right hand instead, his notes an octave up, the right hand leaving out its soft
// chords meanwhile (the left hand's bass goes on). The dice are the same, so each song's notes are as they were; only
// who plays them changes. `beat`: the song's seconds a beat (the piano's lengths are in seconds).
export function turns(make, beat) {
  return (seed, opts) => {
    const next = make(seed, opts);
    let k = 0;
    return function nextLine() {
      const ev = next();
      if (!ev.some((e) => e.what === 'harp') || k++ % 2 === 0) return ev;
      return ev.filter((e) => !(e.what === 'piano' && Array.isArray(e.midi) && Math.min(...e.midi) >= 50)).map((e) => (e.what !== 'harp' ? e
        : { beat: e.beat, what: 'piano', lead: true, midi: e.midi + 12, len: e.lenBeats * beat * 0.95, vel: 0.5 * (e.level ?? 1) }));
    };
  };
}

export const SONGS = [
  { id: 'easy', name: 'Easy Afternoon', beat: BEAT, bar: 4, tune: turns(makeTune, BEAT), make: makeTune, ask: 'Easy Afternoon it is!', feel: 'easy-going', home: 'G' },
  { id: 'boots', name: 'Dusty Boots', beat: 60 / 138, bar: 4, tune: turns(makeBoots, 60 / 138), make: makeBoots, upbeat: true, ask: 'Dusty Boots: a quick one!', feel: 'a quick one', home: 'G' },
  { id: 'waltz', name: 'Prairie Waltz', beat: 0.6, bar: 3, tune: turns(makeWaltz, 0.6), make: makeWaltz, ask: 'A waltz: Prairie Waltz!', feel: 'a waltz', home: 'D' },
  { id: 'lonesome', name: 'Lonesome Trail', beat: 60 / 64, bar: 4, tune: turns(makeLonesome, 60 / 64), make: makeLonesome, ask: 'A slow one: Lonesome Trail.', feel: 'a slow one', home: 'Em' },
  { id: 'soldiers', name: "Soldier's Joy", beat: FIDDLE_TUNES.soldiers.beat, bar: 4, tune: makeFiddle(FIDDLE_TUNES.soldiers), round: fiddleRound(FIDDLE_TUNES.soldiers).length / 4, box: 'reel', upbeat: true, ask: "Soldier's Joy: a fiddle tune!", feel: 'a fiddle tune' },
  { id: 'joeclark', name: 'Old Joe Clark', beat: FIDDLE_TUNES.joeclark.beat, bar: 4, tune: makeFiddle(FIDDLE_TUNES.joeclark), round: fiddleRound(FIDDLE_TUNES.joeclark).length / 4, box: 'reel', upbeat: true, ask: 'Old Joe Clark! Stomp your feet!', feel: 'a hoedown' },
  ...[
    ['arkansas', 'Arkansas Traveler', 'Arkansas Traveler, here we go!', 'an old favorite'],
    ['sally', 'Sally Goodin', 'Sally Goodin! Swing your partner!', 'a breakdown'],
    ['cripple', 'Cripple Creek', 'Down to Cripple Creek!', 'a banjo tune'],
    ['devils', "Devil's Dream", "The Devil's Dream: hang on!", 'a quick reel'],
    ['fishers', "Fisher's Hornpipe", "Fisher's Hornpipe, nice and easy.", 'a hornpipe'],
  ].map(([id, name, ask, feel]) => ({ id, name, beat: FIDDLE_TUNES[id].beat, bar: 4, tune: makeFiddle(FIDDLE_TUNES[id]), round: fiddleRound(FIDDLE_TUNES[id]).length / 4, box: 'reel', upbeat: true, ask, feel })),
];
export const songOf = (id) => SONGS.find((s) => s.id === id) || SONGS[0];

// ── PLAYING IT ───────────────────────────────────────────────────────────────────────────────────────────────────────
// song: one of SONGS' ids ('easy' when left out: the first tune, as it always was); intro: false starts the harmonica in
// the first line (a song asked for: the band strikes it up at once) instead of the piano's line alone; box: the
// drummer's notes go there (none: the band without him)
export function makeStageMusic(ctx, { harp, piano, box = null, room = null, seed = 1, patches = PATCH_PRESETS, song = 'easy', intro = true, fiddle = null, fiddleKit = null } = {}) {
  const S = songOf(song), BL = S.beat, LINE = S.bar * 4;   // (seconds a beat; beats a line of four bars)
  const tune = S.tune(seed, { intro, fiddle: !!fiddleKit }), drum = box ? makeBoxPart(S.id, seed, { intro }) : null, queue = [], events = [], harpSpans = [], voices = [];
  let origin = null, made = 0, timer = null, running = false;
  const offline = typeof ctx.startRendering === 'function';
  const secs = (beat) => origin + beat * BL;
  const lineOf = () => (drum ? [...tune(), ...drum()] : tune());   // (a line: the tune's notes and the box's)
  function play(ev) {
    const at = secs(ev.beat);
    if (ev.what === 'box') {
      keep(playPatch(ctx, null, box, room, boxNote(ev, patches), null, { at }), at, at + 0.35);
      events.push({ at, what: 'box', hit: ev.hit, vel: ev.vel });
    } else if (ev.what === 'piano') {
      for (const p of pianoNotes({ midi: ev.midi, len: ev.len, vel: ev.vel }, patches[PIANO])) keep(playPatch(ctx, null, piano, room, p, null, { at }), at, at + ev.len);
      events.push({ at, what: 'piano', midi: ev.midi, len: ev.len, vel: ev.vel });
    } else if (ev.what === 'fiddle' && (fiddleKit || ev.doubled)) {
      if (!fiddleKit) return;                // (doubling the harmonica, and no fiddle: the harmonica has it)
      const len = ev.lenBeats * BL;
      keep(playFiddle(ctx, fiddleKit, fiddle || harp, room, { at, midi: ev.midi, len, vel: ev.vel, quick: ev.quick }), at, at + len);
      events.push({ at, what: 'fiddle', midi: ev.midi, len });
    } else {   // (the harmonica's notes; a fiddle's when its samples aren't there)
      const len = ev.lenBeats * BL;
      keep(playPatch(ctx, null, harp, room, harmonicaNote({ ...ev, len }, patches[HARMONICA]), null, { at }), at, at + len);
      events.push({ at, what: 'harp', midi: ev.midi, len, bend: ev.bend, style: ev.style, fresh: ev.fresh });
      harpSpans.push([at, at + len]);
      while (harpSpans.length > 64) harpSpans.shift();
    }
    M.played++;
    if (!offline && events.length > EVENTS_KEPT) events.splice(0, events.length - EVENTS_KEPT);
  }
  // the notes made so far that may still sound (each with when it starts and when its key or breath ends), so a stop
  // can reach them
  function keep(h, start, end) {
    if (offline || !h) return;
    voices.push({ h, start, end: end + 3 });                  // (+ a few seconds for the fade and the echo)
    const now = ctx.currentTime;
    while (voices.length && voices[0].end < now) voices.shift();
  }
  function pump() {
    if (!running) return;
    const until = (ctx.currentTime - origin) / BL + LOOKAHEAD / BL;
    while (made * LINE <= until + LINE) { queue.push(...lineOf()); made++; }
    queue.sort((a, b) => a.beat - b.beat);
    while (queue.length && queue[0].beat <= until) {
      const ev = queue.shift();
      if (secs(ev.beat) < ctx.currentTime - 0.05) continue;    // already past (the page was asleep): skipped, never piled up
      play(ev);
    }
  }
  const M = {
    events, played: 0, song: S.id, name: S.name, beatLen: BL, bar: S.bar,
    start(at = ctx.currentTime + 0.1) {
      if (running) return;
      running = true; queue.length = 0;
      // (after a stop, the tune carries on from where its dice are, at the new start)
      origin = at - made * LINE * BL;
      if (offline) {
        const end = (ctx.length / ctx.sampleRate - origin) / BL;
        while (made * LINE <= end) { queue.push(...lineOf()); made++; }
        for (const ev of queue.sort((a, b) => a.beat - b.beat)) if (secs(ev.beat) >= at - 1e-6 && ev.beat <= end) play(ev);
        queue.length = 0;
      } else { pump(); timer = setInterval(pump, 200); }
    },
    // stop making notes; now: also silence every note already made; from (a ctx time): the notes made to start at or
    // after it are let go unheard, and the ones sounding ring out (a song asked to change finishes its notes)
    stop({ now = false, from = null } = {}) {
      running = false; if (timer) clearInterval(timer); timer = null; queue.length = 0;
      if (now) { for (const v of voices.splice(0)) try { v.h.stop(0.02); } catch (e) { /* already gone */ } harpSpans.length = 0; }
      else if (from != null) {
        for (let i = voices.length - 1; i >= 0; i--) if (voices[i].start >= from) { try { voices[i].h.stop(0.01); } catch (e) { /* already gone */ } voices.splice(i, 1); }
        for (let i = harpSpans.length - 1; i >= 0; i--) if (harpSpans[i][0] >= from) harpSpans.splice(i, 1);
      }
    },
    get running() { return running; },
    beat() { return origin == null ? null : (ctx.currentTime - origin) / BL; },
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
