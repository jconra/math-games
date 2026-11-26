// THE MUSIC'S HALLWAY LINES' RAIL, its numbers (kit/wallkit.js musicLines draws it; src/music/places.js lights it; the
// tests read them, so no three.js here).
//   MUSIC_LINES  { y, h, out, depth: the rail's foot, height, standing off the wall's face, depth; pitch, line: the five
//                lines' spacing up its face and each one's height (the beat's at the top, the melody's at the foot);
//                lens: the stretches' lengths (the piece's variants) }
//   lineY(k)     line k's middle up the rail (k 0 the beat)
export const MUSIC_LINES = { y: 0.92, h: 0.22, out: 0.2, depth: 0.035, pitch: 0.042, line: 0.032, lens: Array.from({ length: 18 }, (_, i) => (2 - i * 0.1).toFixed(1)) };
export const lineY = (k) => MUSIC_LINES.h / 2 + (2 - k) * MUSIC_LINES.pitch;
