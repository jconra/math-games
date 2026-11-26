// THE MUSIC PLAYER: plays a song (src/music/song.js) without end, made as it plays by the Sound Lab's engine (Pi
// Nebula's copy, src/audio/patch.js): every note is one of the music's patches (src/music/patches.js) played at its
// pitch and length, at its time on the audio clock. The game's maker, 2026-11-24: "Im thinking about having it more
// techno themed ... select the lead, pads, bass, bpm, melodies, beat", and of the station's rooms: "same sound
// everywhere. It might be cool if it was louder in some areas, or even had more reverb in the hangers".
//
//   const M = createMusic({ sound, ctx, dest, timer })
//       sound   the game's sound player (src/sound.js): the music plays through its 'music' volume group (its volume
//               and mute rule the music: muted, no notes are made at all), once the player has touched the page
//       ctx, dest   or an audio context of its own and where to play into (the lab's; an offline rig's)
//       left out: the music makes its own context on the first play() (in the lab: a click, so it may)
//       timer   false: nothing ticks by itself (a rig calls M.tick() at its own times)
//   M.play(song?) / M.stop()     start (on the next moment; from the first bar) / fade out over a third of a second
//   M.set(song)                  change the song while it plays: heard from the next bar not yet made (the speed too)
//   M.song, M.playing            what it is playing, and whether
//   M.room({ level, reverb, size }) / M.room('hangar')   where it is heard (PLACES): its loudness (0..1.5), how
//               much echo of the room (0..1) and how big the room is (0 small .. 1 a hangar), eased over a second
//               (walking from a corridor into a hangar never clicks or jumps); M.place: the place's name, or null
//   M.position() -> { bar, step, section } | null   where the music is now (the screen lights the step)
//   M.on(fn) -> off()            fn(M) whenever the song, playing or room changes (every screen showing it follows)
//   M.tick()                     make the bars due in the next moment (the timer's job; a rig's)
//   M.stats                      { voices (notes still sounding or to come), notes (made in all), lastBar (notes
//               in the last bar made), bars }
//   M.log                        if set to an array, every note made is pushed to it: { at, inst, part, step, bar, vel }
//
// TIMING: notes are made a whole bar at a time when that bar is due within the next 0.3 s (1.6 s while the tab is
// hidden and its timer slowed), each placed on its sample by the audio clock (the Sound Lab sequencer's lookahead,
// sound-lab/seq.js); the timer only has to be roughly on time, so the game's drawing cannot make it stumble. A bar's
// start is counted from where the speed last changed (bars times the bar's length, never added up step by step).
// The mixing is the player's own, not the engine's: each part's level, the bass and pads ducking a little under the
// kick in the techno and heavy songs, the room's echo, a tone filter (the chill songs warmer) and a limiter at the end.
import { playPatch, voicePatch, makeImpulse, patchAutoStopTime } from '../audio/patch.js';
import { TECHNO_PATCHES } from './patches.js';
import { patchFor } from './patches.js';   // (RANDOM 1: a note's patch, a part on Random its song's wave: patches.js patchFor)
import { barBlock, FORMS, SECTION } from './patterns.js';
import { PRESETS, PART_IDS, formOf } from './song.js';
import { volOf, volGain } from './song.js';   // (VISUALS 1: the parts' volumes, in the marked block at the end)
// ── PRE-RENDERED NOTES (MUSICGAME 1) ──
import { bakery } from './bake.js';
// ── end PRE-RENDERED NOTES ──

// the places to try it in (the lab's "Heard in" row): loudness, how much room, how big a room
export const PLACES = [
  { id: 'quarters', name: 'Quarters', level: 0.75, reverb: 0.12, size: 0 },
  { id: 'terminal', name: 'Terminal', level: 1, reverb: 0.3, size: 0.35 },
  { id: 'medical', name: 'Medical', level: 0.8, reverb: 0.22, size: 0.2 },
  { id: 'cargo', name: 'Cargo', level: 1, reverb: 0.45, size: 0.65 },
  { id: 'hangar', name: 'Hangar', level: 1.15, reverb: 0.7, size: 1 },
];
export const MIX = {
  parts: { beat: 1, bass: 1, pads: 0.7, lead: 1, melody: 1 },   // each part's level (the pads down 3 dB: the game's maker, 2026-11-24, "The pads seem a bit loud")
  duck: 0.72,                                                  // the bass, pads, lead and melody under a kick (techno, heavy)
  tone: { flow: 6000, drive: 8000, drop: 7500, remix: 7500 },  // the whole music's top, Hz
  trim: { flow: 1, drive: 1, drop: 1, remix: 1.08 },          // each kind of song's level, so the presets match
  rooms: { small: 0.7, big: 2.6 },                             // the two rooms' echo lengths, s
  out: 0.9,
};
const AHEAD = 0.3, AHEAD_HIDDEN = 1.6, TICK_MS = 60;

// ── A NOTE FROM A PATCH (after Mathwood's notePatch, mathwood-valley/src/audio/stagemusic.js) ──────────────────────
// voicePatch moves the patch to the note's pitch and length; `set` changes named nodes for this one note (the wobble's
// speed, the echo's time to the beat); nodes that can no longer reach the output are left out.
export function notePatch(patch, { semi = 0, gain = 1, len = null, set = null } = {}) {
  const v = voicePatch(patch, { semi, gain, len });
  let nodes = v.nodes.map((n) => {
    let m = n;
    if (n.type === 'send' && gain !== 1) m = { ...m, gain: (n.gain ?? 0) * gain };
    if (set && set[n.id]) m = { ...m, ...set[n.id] };
    return m;
  });
  const live = new Set(nodes.filter((n) => n.type === 'out' || n.type === 'send').map((n) => n.id));
  for (let grew = true; grew;) { grew = false; for (const c of v.cables) if (live.has(c.to) && !live.has(c.from)) { live.add(c.from); grew = true; } }
  nodes = nodes.filter((n) => live.has(n.id));
  const ids = new Set(nodes.map((n) => n.id));
  return { ...v, nodes, cables: v.cables.filter((c) => ids.has(c.from) && ids.has(c.to)) };
}

// the per-note settings a patch's note needs from the song: the wobble's speed, the echo's time, the riser's glide
export function setFor(inst, note, sd, len) {
  if (inst === 'TECHNO — WOBBLE BASS') return { 'w-lfo': { freq: (note[4] && note[4].wob ? note[4].wob : 1) / (4 * sd) } };
  if (inst === 'TECHNO — ECHO PLUCK') return { 'e-dl': { time: Math.min(1.2, 3 * sd) } };
  if (inst === 'TECHNO — RISER') return { 'r-f': { glide: Math.max(0.1, len) } };
  return null;
}

// ── PRE-RENDERED NOTES, AND THE GAME'S OWN SWITCHES (MUSICGAME 1) ──
//   notes   'baked': every note worth it (src/music/bake.js worth) pre-rendered in the background and played back as
//           one buffer, the rest (and any not rendered yet) live; 'live': every note live, as before. M.notes / M.setNotes
//   rests   true: no notes are made while the page is hidden (the game's); the bars go on counting from where they
//           were when it comes back. false: (the lab's) it plays on, made 1.6 s ahead
//   M.prepare(song)      ask for the notes of the song's first round of sections (spread over time, in the background)
//   M.switchTo(song)     change the song on the next bar not yet made, playing it from its top (the game's arena)
//   M.hush(v)            the music's level under talking (1 none, eased); M.bakery: the pre-rendering, once there is one
//   M.hold(on)           no notes made while on (the game: not heard off the station and off any ship)
// ── end ──
export function createMusic({ sound = null, ctx = null, dest = null, timer = true, notes = 'live', rests = false } = {}) {
  let A = null;                 // the audio parts: { ctx, buses, ... } once there is a context
  let song = { ...PRESETS[0].song }, playing = false, anchor = null, next = null, iv = null;
  let room = { ...PLACES[1] }, place = PLACES[1].id;
  const keep = [], bars = [], fans = new Set();
  const stats = { voices: 0, notes: 0, lastBar: 0, bars: 0 };
  const M = { stats, log: null, PLACES };
  // ── PRE-RENDERED NOTES (MUSICGAME 1) ──
  let noteMode = notes === 'baked' ? 'baked' : 'live', B = null, pending = null, prepTimer = null, hushV = 1, holdOn = false;
  const bakeryNow = () => { if (!B && A) B = bakery(A.ctx.sampleRate, { noteOf: notePatch, patches: TECHNO_PATCHES }); return B; };
  // ── end PRE-RENDERED NOTES ──
  const tell = () => { for (const f of fans) try { f(M); } catch (e) { /* a screen's fault is its own */ } };

  function contextNow() {
    if (A) return A;
    let c = ctx, d = dest;
    if (!c && sound) { const g = sound.groups && sound.groups.music; if (!g) return null; c = g.context; d = g; }
    if (!c) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!AC) return null;
      try { c = new AC(); } catch (e) { return null; }
      d = c.destination;
    }
    A = build(c, d || c.destination);
    return A;
  }

  // the mixing: parts -> (duck) -> mix -> tone -> limiter -> fade -> room level -> out; the patches' sends and some
  // of the mix -> the room's echo (a small room and a big one, blended by size) -> tone
  function build(c, d) {
    const G = (v) => { const g = c.createGain(); g.gain.value = v; return g; };
    const buses = {}, duck = G(1), mix = G(1);
    for (const p of PART_IDS) { buses[p] = G(MIX.parts[p]); buses[p].connect(p === 'beat' ? mix : duck); }
    duck.connect(mix);
    const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = MIX.tone[formOf(song)]; tone.Q.value = 0.5;
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25;
    const fade = G(0), level = G(room.level * MIX.out), trim = G(MIX.trim[formOf(song)]);
    // (MUSICGAME 1: a hush after the room's level, for the game's talking)
    const hush = G(hushV);
    mix.connect(trim); trim.connect(tone); tone.connect(lim); lim.connect(fade); fade.connect(level); level.connect(hush); hush.connect(d);
    // the room: the engine's own impulse (makeImpulse) in two convolvers, a small room and a big one
    const roomIn = G(1), mixSend = G(0.5), wet = G(room.reverb);
    const small = c.createConvolver(), big = c.createConvolver();
    small.buffer = makeImpulse(c, MIX.rooms.small, 3.5); big.buffer = makeImpulse(c, MIX.rooms.big, 2.2);
    const sG = G(1 - room.size), bG = G(room.size * 0.8);
    trim.connect(mixSend); mixSend.connect(roomIn); roomIn.connect(wet);
    wet.connect(small); wet.connect(big); small.connect(sG); big.connect(bG); sG.connect(tone); bG.connect(tone);
    return { ctx: c, buses, duck, mix, tone, trim, fade, level, hush, wet, sG, bG, roomIn, hidden: () => typeof document !== 'undefined' && document.hidden };
  }

  const stepDur = (s) => 60 / s.bpm / 4;
  const muted = () => !!(sound && (sound.muted || !sound.volume));

  // one note, made (MUSICGAME 1: the body of the bar's loop, as it was, in a function of its own)
  function playNote({ tr, patch, n, at, secs, sd, bar }) {
    const c = A.ctx, [step, semi, , vel] = n;
    const set = setFor(tr.inst, n, sd, secs), gain = vel * (tr.vol ?? 1);
    try {
      // ── PRE-RENDERED NOTES (MUSICGAME 1): the note as one buffer if it is rendered (null: live, as ever) ──
      let h = null, end = 0;
      if (noteMode === 'baked' && bakeryNow()) {
        const pl = B.plan(patch, { semi, len: secs, set });
        h = B.play(c, pl, at, gain, A.buses[tr.part], A.roomIn);
        if (h) end = at + pl.secs + 0.05;
      }
      // ── end PRE-RENDERED NOTES ──
      if (!h) {
        const p = notePatch(patch, { semi, gain, len: secs, set });
        h = playPatch(c, null, A.buses[tr.part], A.roomIn, p, null, { at });
        end = at + (patchAutoStopTime(p) ?? secs + 1);
      }
      keep.push({ h, end });
      stats.notes++;
      if (M.log) M.log.push({ at, inst: tr.inst, part: tr.part, step, bar, vel });
    } catch (e) { /* a bad note must never take the music down */ }
  }
  // (MUSICGAME 1: the notes of bars made, waiting for their times to come near; one whose time has gone by, as after
  // the page was hidden, is let go unmade)
  const waiting = [];
  function due(now, ahead) {
    if (!waiting.length) return;
    let k = 0;
    for (const j of waiting) { if (j.at < now) continue; if (j.at <= now + ahead + 0.1) { if (!muted()) playNote(j); } else waiting[k++] = j; }
    waiting.length = k;
  }

  function scheduleBar(bar, t) {
    const S = song, sd = stepDur(S), block = barBlock(S, bar), form = formOf(S);
    const c = A.ctx;
    bars.push({ bar, t, sd, section: block.section }); if (bars.length > 8) bars.shift();
    A.tone.frequency.setTargetAtTime(MIX.tone[form], t, 0.4);
    A.trim.gain.setTargetAtTime(MIX.trim[form], t, 0.4);
    stats.bars++; stats.lastBar = 0;
    if (muted()) return;
    const kicks = [];
    // ── MUSICGAME 1: a bar's notes are made as their times come near (each within the look-ahead), not all at once as
    // the bar is due, so the main thread's work is spread over the bar's ticks instead of one tick a bar ──
    const now = c.currentTime;
    for (const tr of block.tracks) {
      const patch = patchFor(tr.inst, tr.part, S); if (!patch) continue;   // (RANDOM 1)
      for (const n of tr.notes) {
        const step = n[0], at = t + step * sd + (step % 2 ? S.swing * sd : 0), secs = Math.max(0.05, n[2] * sd);
        const job = { tr, patch, n, at, secs, sd, bar };
        if (at > now + AHEAD + 0.1) waiting.push(job); else playNote(job);
        stats.lastBar++;
        if (tr.part === 'beat' && /KICK/.test(tr.inst)) kicks.push(at);
      }
    }
    // ── end ──
    // the duck: the other parts dip a little under each kick and come back (techno and heavy songs)
    if (form !== 'flow') for (const at of kicks.sort((a, b) => a - b)) { A.duck.gain.setTargetAtTime(MIX.duck, at, 0.004); A.duck.gain.setTargetAtTime(1, at + 0.03, 0.07); }
  }

  M.tick = () => {
    if (!A) return;
    const now = A.ctx.currentTime;
    // the notes done with: let go (the engine lets a live voice go by itself; an offline one waits for this)
    for (let i = keep.length - 1; i >= 0; i--) if (keep[i].end < now) { try { keep[i].h.stop(0.03); } catch (e) { /* */ } keep.splice(i, 1); }
    stats.voices = keep.length;
    if (!playing) return;
    // ── THE GAME'S SWITCHES (MUSICGAME 1): hidden, no notes made (rests); back, the bars counted on from now ──
    if ((rests && A.hidden()) || holdOn) { stats.resting = true; return; }
    if (stats.resting) { stats.resting = false; if (next.t < now + 0.05) { const t = now + 0.1; anchor = { bar: next.bar, t, bpm: song.bpm }; next.t = t; } }
    // ── end ──
    const ahead = A.hidden() ? AHEAD_HIDDEN : AHEAD;
    due(now, ahead);   // (MUSICGAME 1)
    while (next.t < now + ahead) {
      // ── THE GAME'S SWITCHES (MUSICGAME 1): a song switched to plays from its top, from this bar ──
      if (pending) { song = pending; pending = null; anchor = { bar: 0, t: next.t, bpm: song.bpm }; next.bar = 0; tell(); }
      // ── end ──
      // (a speed changed since the anchor: the bars from here on are counted from here)
      if (song.bpm !== anchor.bpm) anchor = { bar: next.bar, t: next.t, bpm: song.bpm };
      scheduleBar(next.bar, next.t);
      next.bar++;
      next.t = anchor.t + (next.bar - anchor.bar) * 16 * stepDur(song);
    }
    stats.voices = keep.length;
  };

  M.play = (s) => {
    if (s) song = { ...s };
    const a = contextNow();
    if (!a) { playing = true; startTimer(); tell(); return M; }   // (the game's sound not awake yet: it starts when it is)
    if (a.ctx.state === 'suspended' && typeof a.ctx.startRendering !== 'function') a.ctx.resume().catch(() => {});
    if (playing && next) { tell(); return M; }
    if (noteMode === 'baked') M.prepare(song);   // (MUSICGAME 1)
    const t = a.ctx.currentTime + 0.1;
    a.fade.gain.cancelScheduledValues(a.ctx.currentTime); a.fade.gain.setTargetAtTime(1, a.ctx.currentTime, 0.02);
    playing = true; anchor = { bar: 0, t, bpm: song.bpm }; next = { bar: 0, t };
    startTimer(); M.tick(); tell();
    return M;
  };
  M.stop = () => {
    if (!playing) return M;
    playing = false; next = null; anchor = null; waiting.length = 0;   // (MUSICGAME 1: waiting notes)
    if (A) {
      const now = A.ctx.currentTime;
      A.fade.gain.cancelScheduledValues(now); A.fade.gain.setTargetAtTime(0, now, 0.08);
      // every note made, sounding or still to come, let go once the fade is down
      const at = now + 0.4;
      for (const k of keep) k.end = Math.min(k.end, at);
      if (timer) setTimeout(() => M.tick(), 450);
    }
    bars.length = 0; tell();
    return M;
  };
  M.set = (s) => { song = { ...s }; pending = null; tell(); return M; };
  // ── PRE-RENDERED NOTES, AND THE GAME'S SWITCHES (MUSICGAME 1) ──
  M.setNotes = (m) => { noteMode = m === 'baked' ? 'baked' : 'live'; if (noteMode === 'baked' && playing) M.prepare(pending || song); tell(); return M; };
  M.switchTo = (s) => {
    if (!playing || !next) { song = { ...s }; pending = null; } else pending = { ...s };
    if (noteMode === 'baked') M.prepare(s);
    tell(); return M;
  };
  M.hush = (v) => { hushV = clamp(v, 0, 1); if (A) A.hush.gain.setTargetAtTime(hushV, A.ctx.currentTime, 0.25); return M; };
  // (the notes of a song's opening and its first round of sections, asked for a bar at a time, every 30 ms; songs
  // asked for while one is going come after it, the newest first)
  const prepQ = [];
  M.prepare = (s = song) => {
    if (!A || !bakeryNow()) return M;
    const S = { ...s }, id = JSON.stringify(S);
    if (prepQ.some((q) => q.id === id)) return M;
    prepQ.splice(prepTimer ? 1 : 0, 0, { id, S, bar: 0, bars: SECTION * (1 + FORMS[formOf(S)].loop.length) });
    const step = () => {
      const q = prepQ[0]; if (!q) { prepTimer = null; return; }
      const sd = stepDur(q.S);
      try {
        for (const tr of barBlock(q.S, q.bar).tracks) {
          const patch = patchFor(tr.inst, tr.part, q.S); if (!patch) continue;   // (RANDOM 1)
          for (const n of tr.notes) { const secs = Math.max(0.05, n[2] * sd); B.want(B.plan(patch, { semi: n[1], len: secs, set: setFor(tr.inst, n, sd, secs) })); }
        }
      } catch (e) { /* (the rest come as they are played) */ }
      if (++q.bar >= q.bars) prepQ.shift();
      prepTimer = prepQ.length ? setTimeout(step, 30) : null;
    };
    if (!prepTimer) step();
    return M;
  };
  // (not heard just now, off the station and off any ship: no notes made until it is again)
  M.hold = (on) => { holdOn = !!on; return M; };
  // ── end ──
  M.room = (r) => {
    const P = typeof r === 'string' ? PLACES.find((p) => p.id === r) : null;
    const v = P || r || {};
    room = { level: clamp(v.level ?? room.level, 0, 1.5), reverb: clamp(v.reverb ?? room.reverb, 0, 1), size: clamp(v.size ?? room.size, 0, 1) };
    place = P ? P.id : null;
    if (A) {
      const now = A.ctx.currentTime, T = 0.35;   // (about a second to settle)
      A.level.gain.setTargetAtTime(room.level * MIX.out, now, T);
      A.wet.gain.setTargetAtTime(room.reverb, now, T);
      A.sG.gain.setTargetAtTime(1 - room.size, now, T);
      A.bG.gain.setTargetAtTime(room.size * 0.8, now, T);
    }
    tell(); return M;
  };
  M.position = () => {
    if (!A || !playing) return null;
    const now = A.ctx.currentTime - (A.ctx.outputLatency || 0);
    for (let i = bars.length - 1; i >= 0; i--) {
      const b = bars[i];
      if (now >= b.t && now < b.t + 16 * b.sd) return { bar: b.bar, step: Math.floor((now - b.t) / b.sd), section: b.section };
    }
    return null;
  };
  M.on = (fn) => { fans.add(fn); return () => fans.delete(fn); };
  Object.defineProperties(M, {
    song: { get: () => song }, playing: { get: () => playing }, place: { get: () => place },
    roomNow: { get: () => ({ ...room }) }, audio: { get: () => A },
    notes: { get: () => noteMode }, bakery: { get: () => B }, hushed: { get: () => hushV },   // (MUSICGAME 1)
  });

  function startTimer() {
    if (!timer || iv) return;
    iv = setInterval(() => { if (!A) { if (playing && contextNow()) { playing = false; M.play(); } return; } M.tick(); if (!playing && !keep.length) { clearInterval(iv); iv = null; } }, TICK_MS);
  }

  // ── VISUALS 1's BLOCK: the visuals' tap (src/music/tap.js reads it) and the parts' volumes ──────────────────────
  // THE PARTS' VOLUMES (song.vol, src/music/song.js VOL): each part's bus at its usual level (MIX.parts) times the
  // song's volume for it, eased over ~50 ms the moment the song changes (no click; the notes are not touched)
  let volsSet = '';
  const vols = () => {
    if (!A) return;
    const key = PART_IDS.map((p) => volOf(song, p)).join(',');
    if (key === volsSet) return;
    volsSet = key;
    for (const p of PART_IDS) A.buses[p].gain.setTargetAtTime(MIX.parts[p] * volGain(volOf(song, p)), A.ctx.currentTime, 0.015);
  };
  const set0 = M.set;
  M.set = (s) => { set0(s); vols(); return M; };
  // THE TAP, read only: nothing in it changes what is played
  //   M.tapRaw() -> { now, playing, song, anchor, next, bars: [{ bar, t, sd, song, section }] }   the bars made lately
  //               (each with the song it was made from), where the next bar will start, the audio clock now
  const tapBars = [];
  const tick0 = M.tick, seen = new WeakSet();
  M.tick = () => {
    vols();
    tick0();
    // every bar made in this tick was made from the song as it is now (a tick is all at once); a fresh start (bar 0)
    // or a stop forgets the old ones
    for (const b of bars) if (!seen.has(b)) { seen.add(b); if (b.bar === 0) tapBars.length = 0; tapBars.push({ ...b, song }); }
    if (!playing) tapBars.length = 0;
    while (tapBars.length > 6) tapBars.shift();
  };
  M.tapRaw = () => {
    const now = A ? A.ctx.currentTime - (A.ctx.outputLatency || 0) : 0;
    return { now, playing, song, anchor: anchor && { ...anchor }, next: next && { ...next }, bars: tapBars };
  };
  // ── (end of VISUALS 1's block) ──────────────────────────────────────────────────────────────────────────────────────
  return M;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
