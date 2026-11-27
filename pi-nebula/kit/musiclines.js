// THE MUSIC'S HALLWAY LINES, their numbers (kit/wallkit.js musicLines draws the piece; src/music/places.js lights it;
// the tests read them, so no three.js here). MUSIC 4: a set of the five lines on the slanted panel where a hallway's
// wall meets its ceiling (the cornice, kit/shell.js trim 'cornice': from TOP up the wall at 45 degrees out to the
// ceiling), in every section, on both sides. The piece is placed as that panel is (an edge piece: the same cell and
// turn), slid along it by `off`, its variant its length.
//   MUSIC_LINES  { s0: how far up the slant the plate's foot is (m, from the slant's foot at TOP); h: the plate's height
//                up the slant; depth: how far it stands off the slant's face; pitch, line: the five lines' spacing up
//                its face and each one's height (the beat's nearest the ceiling, the melody's at the foot); end: how
//                far a set stops short of a frame, a hatch or another panel; min: the shortest set; lens: lengths the
//                Kit Lab offers (any length from min to 2 m, in centimetres, is a variant: linesLength) }
//   lineY(k)     line k's middle up the plate (k 0 the beat)
//   SLANT        the cornice's own numbers (kit/shell.js TOP, kit/grid.js WALL_FACE and ROOM_H): where its slant starts
//                up the wall, how far its foot is in from the cell's edge, the ceiling
//   onSlant(s, n) -> [y, z]   a point s up the slant from its foot and n out of its face, in the panel's own frame
//   linesLength(v) -> metres, or NaN when v is not a set's length
export const MUSIC_LINES = { s0: 0.44, h: 0.22, depth: 0.012, pitch: 0.042, line: 0.032, end: 0.03, min: 0.5, lens: ['1.68', '1.46', '1.39', '1.17', '1.12'] };
export const lineY = (k) => MUSIC_LINES.h / 2 + (2 - k) * MUSIC_LINES.pitch;
export const SLANT = { top: 2.52, face: 0.22, ceiling: 3 };
const C = Math.SQRT1_2;
export const onSlant = (s, n) => [SLANT.top + (s - n) * C, SLANT.face + (s + n) * C];
export function linesLength(v) {
  if (!/^\d\.\d\d$/.test(String(v))) return NaN;
  const L = +v; return L >= MUSIC_LINES.min && L <= 2 ? L : NaN;
}
