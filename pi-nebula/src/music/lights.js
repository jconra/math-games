// THE LIGHT BARS: a row of glowing strips (a hallway's) that answer the music, from the tap's pulse numbers
// (src/music/tap.js PULSES). The game's maker, 2026-11-24: "It seems like it would be cool to have some light bars or
// something that respond the the music that are in the hallways or something. But I don't know if that would be a
// performance hit. Maybe it could be an option."
//
// Each strip is one brightness, 0..1: in the game that is one number put on the strip's glowing material (its
// emissive intensity), no real light cast, so a hallway of them costs about what working the numbers out costs (the
// Music Lab's notes, VISUALS_1.md: measured).
//
//   LIGHT_STYLES   [{ id, label }]
//     beat    all the strips pulse together on the kick, a low glow with the bass between
//     run     a light running along the hallway a strip a step (sixteen a bar), brighter on the kick
//     meter   the strips as a level meter from the middle out: how loud the music is, the kick pushing it
//   lightBars(pulse, n, style, out?) -> Float32Array(n) of brightnesses 0..1 (out reused if given)
//   LIGHT_COLOURS  each style's colour (the strip's material colour)
//
// THE LINES (ELECTRIC 1). The game's maker, 2026-11-25: "For the hallway lights can I get more options too? Like maybe a
// line that represents each instrument that pulses. Maybe the line can get bright on the x axis representing the note
// being played." A line style (LIGHT_STYLES' `lines: true`) is not strips but long thin glowing lines along the wall, a
// line a part in its colour (src/music/visuals.js PART_COLOURS), each brighter along its length where something is:
//     notes   (his) five lines, each pulsing with its own part, brightest along its length at the place of the note
//             playing: low notes toward one end, high toward the other (the part's own range, RANGES), a chord lit
//             in several places; on the beat's line each drum has its own place (DRUM_PLACE: the kick near the start,
//             the snare and clap, the toms, the hats, the riser near the end)
//     pass    (ELECTRIC 1's own) "Notes going by": five lines, the notes travelling along them: a note's place along its
//             line is WHEN it plays, not how high; they come in from the far end dim, light up as they reach the
//             middle (now) and go on fading to the near end; a long note is a long dash
//     one     (ELECTRIC 1's own) "One line": all five parts on a single line, the whole range of notes along it, the
//             bass's low notes toward the start and the melody's high ones toward the end, each lit in its own
//             colour where it plays; the kick a soft wash along all of it, the other drums small flicks at the ends
//   lightLines(f, cols, style, out?) -> Float32Array(5 * cols): for each part (PART_IDS order: beat, bass, pads, lead,
//             melody) its line's brightness 0..1 at `cols` places along it, from the tap frame f (src/music/tap.js).
//             For 'one' the five rows are the five colours' shares of the single line (add them). In the game the table
//             is one small data texture (cols x 5) on the lines' glowing material; no real lights.
import { PART_IDS } from './song.js';
import { RANGES } from './visuals.js';

export const LIGHT_STYLES = [
  { id: 'beat', label: 'Pulse on the beat' },
  { id: 'run', label: 'Running light' },
  { id: 'meter', label: 'Level meter' },
  { id: 'notes', label: 'A line a part', lines: true },
  { id: 'pass', label: 'Notes going by', lines: true },
  { id: 'one', label: 'One line', lines: true },
];
export const LIGHT_COLOURS = { beat: '#8fd3ff', run: '#7dffc8', meter: '#ffd27a' };

export function lightBars(pulse, n, style = 'beat', out = null) {
  const b = out && out.length === n ? out : new Float32Array(n);
  const k = pulse ? pulse.kick : 0, bass = pulse ? pulse.bass : 0, level = pulse ? pulse.level : 0;
  if (style === 'run') {
    // the head moves one strip a step; a new light every 8 strips, each with a tail behind it
    const head = (pulse ? pulse.barPhase : 0) * 16, gap = 8;
    for (let i = 0; i < n; i++) {
      const d = (((head - i) % gap) + gap) % gap;           // how far behind a head this strip is (0..gap)
      const tail = d < 1 ? 1 - d * 0.2 : Math.max(0, 0.8 - (d - 1) * 0.28);
      b[i] = pulse && (pulse.busy.beat || pulse.on.bass || level) ? Math.min(1, 0.06 + tail * (0.55 + 0.45 * k)) : 0.06;
    }
  } else if (style === 'meter') {
    const v = Math.min(1, level * 0.8 + k * 0.35), mid = (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(i - mid) / (mid + 0.5);               // 0 middle .. 1 the ends
      b[i] = d < v ? 0.45 + 0.55 * (1 - d / Math.max(v, 1e-3)) : 0.05;
    }
  } else {
    const v = 0.08 + 0.22 * bass + 0.7 * k;
    for (let i = 0; i < n; i++) b[i] = Math.min(1, v);
  }
  return b;
}

// ── the lines ─────────────────────────────────────────────────────────────────────────────────────────────────────
// where each drum sits along the beat's line (0 the start, 1 the end)
export const DRUM_PLACE = { kick: 0.1, snare: 0.3, clap: 0.3, tom: 0.5, hat: 0.7, open: 0.7, riser: 0.9 };
const ROW = Object.fromEntries(PART_IDS.map((p, i) => [p, i]));
const LO = RANGES.bass[0], HI = RANGES.melody[1];   // 'one': the whole range of notes along the one line
const TAIL = { beat: 0.18, bass: 0.25, pads: 0.5, lead: 0.15, melody: 0.25 };   // s a note's light dies away in after it ends
// a note's brightness now: a flash as it starts settling to a hold while it sounds, dying away after (0 before it)
function noteLight(n, now) {
  const age = now - n.at;
  if (age < 0) return 0;
  const tail = TAIL[n.part] || 0.2, flash = Math.exp(-age * 8), v = Math.min(1, n.vel * 1.1);
  const life = age < n.dur ? 1 : Math.exp(-(age - n.dur) / (tail * 0.4));
  return v * (0.55 + 0.45 * flash) * life;
}
// a soft bump of light at x (0..1) on a row, width s (a share of the line), height a; combined so that two lights
// overlapping add without passing 1
function bump(b, row, cols, x, s, a) {
  if (a <= 0.003) return;
  const c = x * (cols - 1), w = Math.max(0.6, s * cols), i0 = Math.max(0, Math.floor(c - 3 * w)), i1 = Math.min(cols - 1, Math.ceil(c + 3 * w));
  for (let i = i0; i <= i1; i++) { const d = (i - c) / w, v = a * Math.exp(-d * d), k = row * cols + i; b[k] = 1 - (1 - b[k]) * (1 - v); }
}
const placeOf = (n) => {
  if (n.part === 'beat') return DRUM_PLACE[n.sound] ?? 0.5;
  const [lo, hi] = RANGES[n.part] || [36, 96];
  return Math.max(0, Math.min(1, ((n.midi ?? (lo + hi) / 2) - lo) / (hi - lo)));
};
export function lightLines(f, cols = 64, style = 'notes', out = null) {
  const b = out && out.length === 5 * cols ? out : new Float32Array(5 * cols);
  b.fill(0);
  if (!f || !f.playing) { for (let r = 0; r < 5; r++) for (let i = 0; i < cols; i++) b[r * cols + i] = 0.04; return b; }
  const now = f.now, P = f.pulse, on = (p) => f.song && f.song[p] && f.song[p] !== 'off';
  if (style === 'pass') {
    // a note's place is its time: now in the middle, a bar each way
    const bar = f.barDur || 2;
    for (const n of f.notes) {
      const r = ROW[n.part]; if (r == null) continue;
      // (a drum is a short dash whatever its length, so the hats' sixteenths stay apart)
      const len = n.part === 'beat' ? bar / 40 : Math.max(n.dur, bar / 32);
      const x0 = 0.5 + (n.at - now) / (2 * bar), x1 = 0.5 + (n.at + len - now) / (2 * bar);
      if (x1 < 0 || x0 > 1) continue;
      const lit = noteLight(n, now), coming = n.at > now, a = coming ? 0.14 + 0.2 * n.vel : Math.max(lit, 0.1 * n.vel);
      const i0 = Math.max(0, Math.ceil(x0 * (cols - 1))), i1 = Math.min(cols - 1, Math.floor(x1 * (cols - 1)));
      for (let i = i0; i <= i1; i++) { const k = r * cols + i; b[k] = 1 - (1 - b[k]) * (1 - a); }
      if (i1 < i0 && x0 >= 0 && x0 <= 1) bump(b, r, cols, x0, 0.004, a);
    }
    // now: the middle of every line faintly marked
    for (let r = 0; r < 5; r++) if (on(PART_IDS[r])) bump(b, r, cols, 0.5, 0.008, 0.12);
  } else if (style === 'one') {
    for (const n of f.notes) {
      const r = ROW[n.part]; if (r == null) continue;
      const a = noteLight(n, now); if (a <= 0) continue;
      if (n.part === 'beat') {
        if (n.sound === 'kick') for (let i = 0; i < cols; i++) { const k = r * cols + i; b[k] = Math.max(b[k], 0.22 * a); }
        else { const end = n.sound === 'hat' || n.sound === 'open' ? 0.02 : 0.98; bump(b, r, cols, end, 0.025, a); }
      } else bump(b, r, cols, Math.max(0, Math.min(1, ((n.midi ?? 60) - LO) / (HI - LO))), 0.018, a);
    }
  } else {
    // his: each line pulsing with its own part, brightest at the notes' places
    const pulse = { beat: 0.3 * P.kick, bass: 0.25 * P.bass, pads: 0.12 * P.on.pads, lead: 0.16 * P.on.lead, melody: 0.16 * P.on.melody };
    PART_IDS.forEach((p, r) => { const v = on(p) ? 0.05 + pulse[p] : 0.02; for (let i = 0; i < cols; i++) b[r * cols + i] = v; });
    for (const n of f.notes) {
      const r = ROW[n.part]; if (r == null) continue;
      bump(b, r, cols, placeOf(n), n.part === 'beat' ? (n.sound === 'riser' ? 0.06 : 0.035) : 0.03, noteLight(n, now));
    }
  }
  for (let k = 0; k < b.length; k++) b[k] = b[k] > 1 ? 1 : b[k];
  return b;
}
