// WHAT THE MUSIC'S PICTURES AND LIGHTS READ: the notes just played and about to play, where the music is, and a few
// "pulse" numbers for lights, all from the music player (src/music/player.js, its tap: M.tapRaw, M.analyser). Read
// only: nothing here changes what is played. The game's maker, 2026-11-24: "It would be nice to have a visual that
// demonstrates that all the note information is there, and not just a spectrum analyzer" and "some light bars or
// something that respond the the music that are in the hallways".
//
//   const T = tapOf(music)       one tap a music player (every screen and light on it shares it)
//   T.frame({ spectrum, back, ahead }) -> {
//       now, playing, song, sd (a step, s), barDur, bar, step, barPhase (0..1 through the bar), beatPhase (0..1),
//       section ({ kind, mask, number, barIn, ... }: src/music/patterns.js sectionAt), sections (SECTIONS around now),
//       notes   the notes from `back` bars ago to `ahead` bars on (made ones as made; the bars not made yet as they
//               will be unless the song is changed first): { part, sound, midi, at, dur, vel, bar, step, len }
//               (a chord is one note a pitch; at and dur in seconds on the audio clock)
//       pulse   PULSES (below): the numbers for lights, each 0..1
//       spectrum   (spectrum: true) the sound's levels by frequency (a Uint8Array, 0..255, the analyser's own;
//               made on the first ask) and sampleRate; null while there is no sound yet
//   }
//   notesOfBar(entry), barsAround(raw, back, ahead), notesWindow(bars, from, to), pulses(notes, now, sd, playing),
//   sectionsAround(song, bar)    the plain parts, for the tests and a rig
//
// PULSES: { kick (1 the moment a kick hits, falling to 0 in about a quarter second), bass (how loud the bass is now:
//   its notes' loudness, falling through each note), level (all the parts together, 0..1), beat / barPhase (where in
//   the beat / the bar, 0..1), busy: { beat, bass, pads, lead, melody } (how many notes each part started in the last
//   bar: 8 or more is 1), on: { ...the same parts } (1 while that part has a note sounding) }
import { barNotes, sectionAt, SECTION, STEPS } from './patterns.js';
import { PART_IDS } from './song.js';

export const BACK = 1.2, AHEAD = 2;   // bars of notes a frame gives, before and after now

// a bar's notes as they sound: seconds on the audio clock, one note a pitch (a pad's chord is three)
const cache = new Map();
export function notesOfBar(e) {
  const key = e.bar + '|' + e.t.toFixed(4) + '|' + e.sd.toFixed(6) + '|' + JSON.stringify(e.song);
  let v = cache.get(key);
  if (v) return v;
  const { notes } = barNotes(e.song, e.bar), sw = e.song.swing || 0;
  v = [];
  for (const n of notes) {
    const at = e.t + n.step * e.sd + (n.step % 2 ? sw * e.sd : 0), dur = Math.max(0.05, n.len * e.sd);
    for (const m of Array.isArray(n.midi) ? n.midi : [n.midi ?? null]) v.push({ part: n.part, sound: n.sound, midi: m, at, dur, vel: n.vel, bar: e.bar, step: n.step, len: n.len });
  }
  cache.set(key, v);
  if (cache.size > 48) cache.delete(cache.keys().next().value);
  return v;
}

// the bars from `back` before now to `ahead` after: those made (as made), then the ones to come (as the player will
// make them: counted from where it will start the next bar, at the song's speed now)
export function barsAround(raw, back = BACK, ahead = AHEAD) {
  if (!raw || !raw.playing) return [];
  const out = [], now = raw.now;
  for (const b of raw.bars) if (b.t + 16 * b.sd > now - back * 16 * b.sd) out.push(b);
  if (raw.next) {
    const sd = 60 / raw.song.bpm / 4, len = 16 * sd;
    for (let k = 0; k < 8; k++) {
      const t = raw.next.t + k * len;
      if (t > now + ahead * len) break;
      out.push({ bar: raw.next.bar + k, t, sd, song: raw.song, coming: true });
    }
  }
  return out;
}

export function notesWindow(bars, from, to) {
  const out = [];
  for (const b of bars) for (const n of notesOfBar(b)) if (n.at + n.dur >= from && n.at <= to) out.push(n);
  return out;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export function pulses(notes, now, sd, playing = true) {
  const busy = {}, on = {};
  for (const p of PART_IDS) { busy[p] = 0; on[p] = 0; }
  const P = { kick: 0, bass: 0, level: 0, beat: 0, barPhase: 0, busy, on };
  if (!playing || !sd) return P;
  const bar = 16 * sd, starts = {};
  let lastKick = -Infinity, kickVel = 0, sum = 0;
  for (const n of notes) {
    if (n.at > now) continue;
    if (n.at > now - bar) { const k = n.part + '|' + n.step + '|' + n.bar; if (!starts[k]) { starts[k] = 1; busy[n.part] += 1 / 8; } }
    if (n.part === 'beat' && n.sound === 'kick' && n.at > lastKick) { lastKick = n.at; kickVel = n.vel; }
    if (now < n.at + n.dur) {
      on[n.part] = 1;
      const through = (now - n.at) / n.dur, loud = n.vel * (1 - 0.6 * through);
      if (n.part === 'bass') P.bass = Math.max(P.bass, loud);
      if (n.part !== 'beat') sum += loud * (n.part === 'pads' ? 0.35 : 0.6);
    }
  }
  for (const p of PART_IDS) busy[p] = clamp01(busy[p]);
  P.kick = clamp01(Math.exp(-(now - lastKick) / 0.09) * Math.min(1, kickVel * 1.15));
  P.bass = clamp01(P.bass);
  P.level = clamp01(0.45 * P.kick + sum * 0.5);
  return P;
}

// the song's sections around a bar: [{ kind, mask, from (its first bar), number }], the one playing and the ones on
export function sectionsAround(song, bar, before = 1, after = 3) {
  const k0 = bar < SECTION ? 0 : Math.floor(bar / SECTION), out = [];
  for (let k = Math.max(0, k0 - before); k <= k0 + after; k++) { const S = sectionAt(song, k * SECTION); out.push({ kind: S.kind, mask: S.mask, from: k * SECTION, number: S.number }); }
  return out;
}

const taps = new WeakMap();
export function tapOf(music) {
  let T = taps.get(music);
  if (T) return T;
  let bins = null;
  T = {
    frame({ spectrum = false, back = BACK, ahead = AHEAD } = {}) {
      const raw = music.tapRaw ? music.tapRaw() : null;
      const song = (raw && raw.song) || music.song, playing = !!(raw && raw.playing);
      const now = raw ? raw.now : 0;
      const bars = barsAround(raw, back, ahead);
      // where we are: the bar the clock is in (made or to come)
      let cur = null;
      for (const b of bars) if (now >= b.t && now < b.t + 16 * b.sd) cur = b;
      const sd = cur ? cur.sd : 60 / song.bpm / 4, barDur = 16 * sd;
      const barPhase = cur ? (now - cur.t) / barDur : 0;
      const step = cur ? Math.min(STEPS - 1, Math.floor(barPhase * STEPS)) : -1;
      const notes = playing ? notesWindow(bars, now - back * barDur, now + ahead * barDur) : [];
      const pulse = pulses(notes, now, sd, playing && !!cur);
      pulse.barPhase = barPhase; pulse.beat = cur ? (barPhase * 4) % 1 : 0;
      const bar = cur ? cur.bar : -1, section = cur ? sectionAt(cur.song, cur.bar) : sectionAt(song, 0);
      let spec = null, sampleRate = 0;
      if (spectrum && music.analyser) {
        const an = music.analyser();
        if (an) { if (!bins || bins.length !== an.frequencyBinCount) bins = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(bins); spec = bins; sampleRate = an.context.sampleRate; }
      }
      return {
        now, playing, song, sd, barDur, bar, step, barPhase, beatPhase: pulse.beat, section,
        sections: sectionsAround(cur ? cur.song : song, Math.max(0, bar)), notes, pulse, spectrum: spec, sampleRate,
      };
    },
  };
  taps.set(music, T);
  return T;
}
