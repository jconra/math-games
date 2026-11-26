// THE HALLWAY LINES: five long glowing lines along a hallway's wall, one for each part in its colour (src/music/
// visuals.js PART_COLOURS), each brightest along its length where its note is. The game's maker, 2026-11-24: "It seems
// like it would be cool to have some light bars or something that respond the the music that are in the hallways or
// something. But I don't know if that would be a performance hit. Maybe it could be an option." 2026-11-25: "maybe a
// line that represents each instrument that pulses. Maybe the line can get bright on the x axis representing the note
// being played." 2026-11-26, of the six styles the Music Lab showed: "I like 4, but I think the lines need to be a
// little thicker so the effect is overall brighter", and "One long line for each instrument, from one end of the
// hallway to the other. Low notes light up near one end and high notes near the other." So this one style only.
//
// Each line pulses with its own part and is brightest at the place of the note playing: low notes toward one end, high
// toward the other (the part's own range, RANGES), a chord lit in several places; on the beat's line each drum has its
// own place (DRUM_PLACE: the kick near the start, the snare and clap, the toms, the hats, the riser near the end).
// No real light is cast: in the game the table is one small data texture on the lines' glowing material
// (src/music/places.js), so a hallway of them costs about what working the table out costs.
//
//   lightLines(f, cols, out?) -> Float32Array(5 * cols): for each part (PART_IDS order: beat, bass, pads, lead, melody)
//             its line's brightness 0..1 at `cols` places along it (0 the low end), from the tap frame f
//             (src/music/tap.js)
//   LINE_LOOK  how a line is drawn, the same in the game and in the Music Lab's preview: the five lines' spacing on the
//             wall, the bright core's and the soft glow's heights (m), and how a brightness v becomes light: the core
//             toward white as v * v * white, at least `base` lit, the glow round it `glow` * v of the part's colour
import { PART_IDS } from './song.js';
import { RANGES } from './visuals.js';

// (the lines themselves are on the rail, kit/wallkit.js MUSIC_LINES: 3.2 cm each, five filling the rail's face with
// small gaps, "a little thicker so the effect is overall brighter". How a place's brightness v becomes light: a resting
// line is `rest` of its part's colour, the colour at its full strength (no washing out to white) where v is 1, a hint
// toward white only at the very top (white * v * v))
export const LINE_LOOK = { rest: 0.08, white: 0.12 };
// a part's colour at brightness v (0..1), as display numbers 0..1: the colour made as bright as it goes (its strongest
// channel 1), times the light
export function lineColour(hex, v) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((x) => x / 255), m = Math.max(...c);
  const lit = v > 0 ? LINE_LOOK.rest + (1 - LINE_LOOK.rest) * v : 0, w = LINE_LOOK.white * v * v;   // (a part switched off: dark)
  return c.map((x) => (x / m * (1 - w) + w) * lit);
}

// where each drum sits along the beat's line (0 the start, 1 the end)
export const DRUM_PLACE = { kick: 0.1, snare: 0.3, clap: 0.3, tom: 0.5, hat: 0.7, open: 0.7, riser: 0.9 };
const ROW = Object.fromEntries(PART_IDS.map((p, i) => [p, i]));
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
export const placeOf = (n) => {
  if (n.part === 'beat') return DRUM_PLACE[n.sound] ?? 0.5;
  const [lo, hi] = RANGES[n.part] || [36, 96];
  return Math.max(0, Math.min(1, ((n.midi ?? (lo + hi) / 2) - lo) / (hi - lo)));
};
export function lightLines(f, cols = 64, out = null) {
  const b = out && out.length === 5 * cols ? out : new Float32Array(5 * cols);
  b.fill(0);
  if (!f || !f.playing) { b.fill(0.04); return b; }
  const now = f.now, P = f.pulse, on = (p) => f.song && f.song[p] && f.song[p] !== 'off';
  // each line resting dim, lifting a little with its own part, and bright along a stretch at each note's place (a stretch
  // a twentieth of the line or so: a metre or more in a hallway, soft at its ends)
  const pulse = { beat: 0.06 * P.kick, bass: 0.05 * P.bass, pads: 0.03 * P.on.pads, lead: 0.04 * P.on.lead, melody: 0.04 * P.on.melody };
  PART_IDS.forEach((p, r) => { const v = on(p) ? 0.02 + pulse[p] : 0; for (let i = 0; i < cols; i++) b[r * cols + i] = v; });
  for (const n of f.notes) {
    const r = ROW[n.part]; if (r == null) continue;
    bump(b, r, cols, placeOf(n), n.part === 'beat' ? (n.sound === 'riser' ? 0.08 : 0.04) : 0.045, noteLight(n, now));
  }
  for (let k = 0; k < b.length; k++) b[k] = b[k] > 1 ? 1 : b[k];
  return b;
}
