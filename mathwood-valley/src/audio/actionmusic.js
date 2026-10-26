// THE ACTION MUSIC for "Protect the wagon": spaghetti-western energy made up as it plays, from Sound Lab patches
// (src/audio/actionpatches.js): a galloping da-da-DUM on a low tom and rim knocks, a plucked bass, a twangy guitar riff,
// a whistled melody and whip cracks, and a big drum on every catch. No sound files; nothing taken from any recording.
//
// It has two layers that fade over each other, so the music follows the ride:
//   the trail  (always, while the job runs and the player is with the wagon): the bass on the chord's root and fifth and
//              a soft picked guitar, quiet road music
//   the action (while a gang is riding): the gallop on the drums, the bass galloping with it, the guitar riff, the
//              whistle and the whips. action(true) fades it in on the NEXT BAR (the beat never stumbles: everything is
//              always played in time and the layer's volume opens on the bar line); action(false) fades it out over
//              about a bar from the next bar line
// The tempo is the stage music's (80 beats a minute, BEAT from stagemusic.js) and the key is its key's own minor (E
// minor: the same notes as the stage's G major), four-bar lines a chord a bar, so it sits with the town's music.
//
//   const M = makeActionMusic(ctx, { out, seed, patches })   out: where it plays (the game gives a gain into the master)
//   M.start(at, { action })   starts at ctx time `at` (the first beat); in an OfflineAudioContext it writes the whole
//                             render at once (then action() and hit() take a time: M.action(true, 8))
//   M.stop({ now })           stops making notes (now: also silences the ones already made)
//   M.action(on, at)          the action layer in or out, from the next bar line after `at` (default now)
//   M.hit(at)                 the big drum (and a whip just after) on the next sixteenth: a catch
//   M.beat()                  the beat it is on now (fractions between), or null
//   M.state()                 { beat, trail, action (the layers' volumes now, 0..1), actionOn, played }
//   M.events                  what has been scheduled (testing): [{ at, what, layer, midi }]; live, only the last 256
//   ACTION                    the levels and timings
//   makeActionTune(seed)      the plan, a line at a time (tested in tests/actionmusic.test.mjs)
import { playPatch, PATCH_PRESETS } from './patch.js';
import { notePatch, makeRandom, makeRoom, BEAT } from './stagemusic.js';
import { ACTION_PATCHES } from './actionpatches.js';

export const ACTION = {
  level: 0.6,             // the whole action music's level into the game's master volume (the loudest catch peaks near -2 dBFS)
  room: 0.55,             // the echo's level (a big dry plain: a longer, darker room than the stage's)
  fadeIn: 0.08,           // time constant (s) of the action layer opening on its bar line (about a quarter second)
  fadeOut: 0.6,           // ... and closing (about two seconds: under a bar)
  trail: 1.4,             // the trail layer's level (about 13 dB under the action: quiet road music)
  lookahead: 2.5,         // seconds of notes made ahead
  kept: 256,              // events listed while playing live
};
const NAMES = { gallop: 'ACTION — GALLOP', rim: 'ACTION — RIM', big: 'ACTION — BIG DRUM', whip: 'ACTION — WHIP', twang: 'ACTION — TWANG', whistle: 'ACTION — WHISTLE', bass: 'ACTION — BASS' };
const ROOT = { twang: 52, whistle: 88, bass: 40 };   // the MIDI notes the patches are written at
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
// a patch by name: the Sound Lab's copy (src/audio/patch.js) when it has one of that name (tuned there by ear and copied
// over), else this game's own
export const patchOf = (name, patches = PATCH_PRESETS) => patches[name] || ACTION_PATCHES[name];

// ── THE TUNE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// E minor's chords (MIDI): the bass's root and fifth, the guitar's chord tones (E2 to E4: the guitar's range here), and
// the whistle's chord tones (B5 to B6)
const CHORDS = {
  Em: { root: 40, fifth: 47, gtr: [52, 55, 59], wh: [83, 88, 91, 95] },
  D:  { root: 38, fifth: 45, gtr: [50, 54, 57], wh: [86, 90, 93] },
  C:  { root: 36, fifth: 43, gtr: [48, 52, 55], wh: [84, 88, 91] },
  G:  { root: 43, fifth: 50, gtr: [55, 59, 62], wh: [86, 91, 95] },
  Am: { root: 45, fifth: 52, gtr: [57, 60, 64], wh: [84, 88, 93] },
};
const LINES = [['Em', 'Em', 'D', 'Em'], ['Em', 'C', 'D', 'Em'], ['Em', 'G', 'D', 'Em'], ['C', 'D', 'Em', 'Em'], ['Em', 'D', 'C', 'D'], ['Am', 'Em', 'D', 'Em']];
const RIFF = [40, 43, 45, 47, 50, 52, 55, 57, 59, 62, 64];        // E minor pentatonic, low (the guitar's riffs)
const WHISTLE = [83, 86, 88, 91, 93, 95];                          // ... and high (the whistle)
const near = (list, m) => list.reduce((b, x) => (Math.abs(x - m) < Math.abs(b - m) ? x : b), list[0]);

// -> nextLine(): the next four bars, [{ beat (from the first beat), what, layer: 'trail' | 'action', midi, len (beats), vel }]
export function makeActionTune(seed = 1) {
  const rnd = makeRandom(seed);
  let line = 0, lastWh = 88, whRun = 0;
  return function nextLine() {
    const chords = line === 0 ? LINES[0] : rnd.pick(LINES), t0 = line * 16, ev = [];
    const add = (beat, what, layer, o = {}) => ev.push({ beat, what, layer, ...o });
    chords.forEach((c, b) => {
      const C = CHORDS[c], bar = t0 + b * 4;
      // THE TRAIL: the bass on the root and the fifth, a soft guitar picking the chord
      add(bar, 'bass', 'trail', { midi: C.root, len: 1.6, vel: 0.62 });
      add(bar + 2, 'bass', 'trail', { midi: C.fifth, len: 1.2, vel: 0.5 });
      const pick = [0, 1.5, 3].filter(() => rnd.chance(0.7));
      for (const k of pick) add(bar + k, 'twang', 'trail', { midi: rnd.pick(C.gtr), len: 1.5, vel: rnd.range(0.22, 0.32) });
      // THE ACTION: the gallop, da-da-DUM into every beat (the DUM on the beat, the bar's first a little harder)
      for (let k = 0; k < 4; k++) {
        add(bar + k, 'gallop', 'action', { vel: k === 0 ? 1 : 0.8 });
        add(bar + k + 0.5, 'rim', 'action', { vel: 0.45 });
        add(bar + k + 0.75, 'rim', 'action', { vel: 0.62 });
        // the bass gallops with it: the root on the beat, an octave up now and then
        add(bar + k, 'bass', 'action', { midi: k === 2 && rnd.chance(0.4) ? C.root + 12 : C.root, len: 0.45, vel: 0.55 });
      }
    });
    // the guitar's riff over bars two and four: a few quick notes up or down the scale, the last one rung out
    for (const b of [1, 3]) {
      const C = CHORDS[chords[b]], bar = t0 + b * 4;
      const n = rnd.weighted([[3, 0.3], [4, 0.4], [5, 0.3]]), up = rnd.chance(0.5);
      let idx = RIFF.indexOf(near(RIFF, C.root + (up ? 12 : 12 + 7)));
      let beat = bar + rnd.pick([0, 0.5, 1]);
      for (let i = 0; i < n; i++) {
        const last = i === n - 1, m = last ? near(C.gtr, RIFF[idx]) : RIFF[idx];
        add(beat, 'twang', 'action', { midi: m, len: last ? 2 : 0.5, vel: last ? 0.85 : 0.7 });
        beat += last ? 2 : 0.5;
        idx = Math.max(0, Math.min(RIFF.length - 1, idx + (up ? 1 : -1) * rnd.pick([1, 1, 2])));
      }
    }
    // the whistle: a phrase of long notes over most lines (rests now and then, never three lines in a row playing)
    const play = line > 0 && whRun < 2 && rnd.chance(0.65);
    if (play) {
      whRun++;
      let beat = t0 + rnd.pick([0, 0, 1]), cur = near(WHISTLE, lastWh + rnd.pick([-3, 0, 3]));
      const n = rnd.weighted([[2, 0.3], [3, 0.45], [4, 0.25]]);
      for (let i = 0; i < n; i++) {
        if (i > 0) {
          let idx = WHISTLE.indexOf(cur);
          idx = Math.max(0, Math.min(WHISTLE.length - 1, idx + rnd.weighted([[-1, 0.35], [1, 0.35], [-2, 0.15], [2, 0.15]])));
          cur = WHISTLE[idx];
        }
        const last = i === n - 1, bar = Math.min(3, Math.floor((beat - t0) / 4));
        if (last) cur = near(CHORDS[chords[bar]].wh, cur);
        let len = last ? rnd.pick([3, 4]) : rnd.pick([1.5, 2, 3]);
        if (beat + len > t0 + 15.5) len = Math.max(1, t0 + 15.5 - beat);
        add(beat, 'whistle', 'action', { midi: cur, len, vel: last ? 0.9 : 1 });
        beat += len + (rnd.chance(0.3) ? 0.5 : 0);
        if (beat >= t0 + 15) break;
      }
      lastWh = cur;
    } else whRun = 0;
    // whip cracks: at the end of every other line, and now and then in the middle
    if (line % 2 === 1) add(t0 + 15.5, 'whip', 'action', { vel: 0.9 });
    if (rnd.chance(0.3)) add(t0 + 7.5, 'whip', 'action', { vel: 0.7 });
    line++;
    return ev.sort((a, b) => a.beat - b.beat);
  };
}

// one scheduled note as patch data
function noteOf(ev, patches) {
  const p = patchOf(NAMES[ev.what], patches);
  if (!p) return null;
  const vel = Math.max(0.05, Math.min(1.2, ev.vel ?? 1));
  if (ev.what === 'twang') {
    const f = hz(ev.midi);
    // the string's length: one period of the note (a hair less: the string's damping filter adds a little delay)
    return notePatch(p, { semi: ev.midi - ROOT.twang, gain: vel, set: { string: { time: Math.max(0.0031, 1 / f - 0.00004) }, 'pick-f': { freq: 1800 + 2600 * vel } } });
  }
  if (ev.what === 'whistle') return notePatch(p, { semi: ev.midi - ROOT.whistle, gain: vel, len: ev.len * BEAT });
  if (ev.what === 'bass') return notePatch(p, { semi: ev.midi - ROOT.bass, gain: vel });
  return notePatch(p, { gain: vel });
}

// ── PLAYING IT ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function makeActionMusic(ctx, { out = ctx.destination, seed = 1, patches = PATCH_PRESETS } = {}) {
  const tune = makeActionTune(seed), queue = [], events = [], voices = [];
  const offline = typeof ctx.startRendering === 'function';
  let origin = null, made = 0, timer = null, running = false, actionOn = false;
  // the mix: each layer has its own volume for its notes and for their echo, so a closed layer's echo is closed too
  const mix = ctx.createGain(); mix.gain.value = ACTION.level; mix.connect(out);
  const room = makeRoom(ctx, { seconds: 2.6, seed: 11, delay: 0.035 }), wet = ctx.createGain(); wet.gain.value = ACTION.room;
  room.output.connect(wet).connect(mix);
  const layer = (level) => {
    const dry = ctx.createGain(), send = ctx.createGain(); dry.gain.value = send.gain.value = level;
    dry.connect(mix); send.connect(room.input);
    return { dry, send };
  };
  const L = { trail: layer(ACTION.trail), action: layer(0), hit: layer(1) };
  const nodes = [mix, wet, room.output, ...Object.values(L).flatMap((l) => [l.dry, l.send])];
  const secs = (beat) => origin + beat * BEAT;

  function play(ev, at = secs(ev.beat)) {
    const note = noteOf(ev, patches); if (!note) return;
    const l = L[ev.layer] || L.action;
    const h = playPatch(ctx, null, l.dry, l.send, note, null, { at });
    if (h) voices.push({ h, end: at + (ev.len || 1) * BEAT + 3 });
    if (!offline) { const now = ctx.currentTime; while (voices.length && voices[0].end < now) voices.shift(); }
    events.push({ at, what: ev.what, layer: ev.layer, midi: ev.midi });
    M.played++;
    if (!offline && events.length > ACTION.kept) events.splice(0, events.length - ACTION.kept);
  }
  function pump() {
    if (!running) return;
    const until = (ctx.currentTime - origin) / BEAT + ACTION.lookahead / BEAT;
    while (made * 16 <= until + 16) { queue.push(...tune()); made++; }
    queue.sort((a, b) => a.beat - b.beat);
    while (queue.length && queue[0].beat <= until) {
      const ev = queue.shift();
      if (secs(ev.beat) < ctx.currentTime - 0.05) continue;   // (already past: the page was asleep; skipped, never piled up)
      play(ev);
    }
  }
  // the next bar line at or after time t (a small margin, so a bar starting this very moment is not half missed)
  const nextBar = (t) => { const b = (t - origin) / BEAT; return secs(Math.ceil(b / 4 - 1e-3) * 4); };
  const ramp = (p, v, at, tc) => { try { p.cancelScheduledValues(at); p.setTargetAtTime(v, at, tc); } catch (e) { /* closed */ } };

  const M = {
    events, played: 0,
    start(at = ctx.currentTime + 0.1, { action = false } = {}) {
      if (running) return;
      running = true; queue.length = 0;
      origin = at - made * 16 * BEAT;
      if (action) { actionOn = true; L.action.dry.gain.setValueAtTime(1, at); L.action.send.gain.setValueAtTime(1, at); }
      if (offline) {
        const end = (ctx.length / ctx.sampleRate - origin) / BEAT;
        while (made * 16 <= end) { queue.push(...tune()); made++; }
        for (const ev of queue.sort((a, b) => a.beat - b.beat)) if (secs(ev.beat) >= at - 1e-6 && ev.beat <= end) play(ev);
        queue.length = 0;
        // offline, a note's sources would run on to the end of the render (nothing stops them): the render pauses each
        // second and lets go of the notes that have finished, so a long render stays quick
        const total = ctx.length / ctx.sampleRate;
        for (let t = 1; t < total - 0.5; t += 1) {
          ctx.suspend(t).then(() => {
            for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end < ctx.currentTime) { try { voices[i].h.stop(0.01); } catch (e) { /* gone */ } voices.splice(i, 1); }
            ctx.resume();
          }).catch(() => {});
        }
      } else { pump(); timer = setInterval(pump, 200); }
    },
    stop({ now = false } = {}) {
      running = false; if (timer) clearInterval(timer); timer = null; queue.length = 0;
      const t = ctx.currentTime;
      if (now) { for (const v of voices.splice(0)) try { v.h.stop(0.02); } catch (e) { /* gone */ } }
      // the layers close (the notes' echoes ring out), then the mix is let go
      ramp(mix.gain, 0, t, now ? 0.02 : 0.4);
      if (!offline) setTimeout(() => { for (const n of nodes) try { n.disconnect(); } catch (e) { /* gone */ } }, now ? 300 : 3500);
    },
    action(on, at = ctx.currentTime) {
      on = !!on; if (on === actionOn && !offline) return;
      actionOn = on;
      if (origin == null) return;
      const t = nextBar(at);
      for (const p of [L.action.dry.gain, L.action.send.gain]) ramp(p, on ? 1 : 0, t, on ? ACTION.fadeIn : ACTION.fadeOut);
      M.switches.push({ at: t, on });
    },
    switches: [],
    hit(at = ctx.currentTime) {
      if (origin == null) return;
      const b = (at - origin) / BEAT, t = secs(Math.ceil(b * 4 - 1e-3) / 4);   // (the next sixteenth)
      play({ what: 'big', layer: 'hit', vel: 1 }, Math.max(at, t));
      play({ what: 'whip', layer: 'hit', vel: 0.8 }, Math.max(at, t) + BEAT / 4);
    },
    get running() { return running; },
    beat() { return origin == null ? null : (ctx.currentTime - origin) / BEAT; },
    state() {
      return { beat: M.beat() == null ? null : +M.beat().toFixed(2), trail: +L.trail.dry.gain.value.toFixed(3), action: +L.action.dry.gain.value.toFixed(3),
        actionOn, played: M.played, master: +mix.gain.value.toFixed(3) };
    },
  };
  return M;
}
