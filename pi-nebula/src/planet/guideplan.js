// THE WAY TO THE WRECK, ITS PLAIN PART (no page and no three.js: node tests it, tests/planetguide.test.mjs). The picture
// of it is src/planet/guide.js (the beam, the arrow, the radar, the blue ship to set down on); the sensors' card that
// finds the wreck first is src/jobs/sensors.js.
//
// THE GAME'S MAKER, 2026-11-22 (RESC1-3 C, the arrow and the radar both): "That arrow is almost the same color as the
// ground, which is not good. We could also have a big beam marking the target area, like a green column that goes into
// space. But if we use an arrow then it should be a different color than the ground (green or purple for this planet).
// Also, We could do a math question with coordinates when you first start that shows you relative to the target, so it
// is representing you finding the target with sensors, and then you travel to it." And RESC1-4 C: "No edge: the ship can
// fly anywhere, and the arrow (or the radar) always points back to the wreck."
//
// SO:
//   - ONE COLOUR FOR THE WAY THERE, the beam's and the arrow's, picked for each planet from its own colours: green, as
//     he said, unless the ground is green or near it; then purple; failing both (a ground of greens and purples),
//     whichever of a few more stands furthest from every colour of the ground (guideColour). A grey ground (the moon)
//     has no colour of its own to clash with: green.
//   - THE WRECK IS WHERE IT IS DRAWN, once: no edge, and nothing wraps the way there. Flown off past the ground's own
//     repeat, the arrow and the radar still point back the whole way to it (offsetTo is plain x and z).
//   - THE RADAR is the ship's own, heading up: the ship in its middle pointing up the screen, the wreck a dot where it
//     lies from the ship; further off than the radar reaches, the dot waits on its rim, the way to turn (radarDot).
//   - THE ARROW is over the view: over the wreck while it is in sight, with how far it is; at the edge of the view,
//     pointing round toward it, when it is not (edgeSpot).
//
//   guideColour(palette)            -> { id, name, rgb (sRGB 0..1), hex, stands (how far it stands from the ground, OKLab) }
//   offsetTo(from, to)              -> { dx, dz, dist } across the ground (x, z), metres
//   shipFrame(dx, dz, ahead)        -> [right, ahead]: the same offset as the ship sees it (ahead: its nose's way, x and z)
//   radarDot(right, ahead, range)   -> { x, y (the radar's own -1..1, y up the screen), beyond }
//   distWords(m)                    -> '420 m', '1.2 km'
//   edgeSpot(sx, sy, box, behind)   -> { x, y, angle }: where the arrow stands at the edge of `box` and which way it points

// the colours the way there may take, in his order: green first ("like a green column"), then purple ("green or purple
// for this planet"); then, only for a ground that is both, the next furthest of the rest
export const WAY_COLOURS = [
  { id: 'green', name: 'Green', rgb: [0.27, 1.0, 0.42] },
  { id: 'purple', name: 'Purple', rgb: [0.76, 0.42, 1.0] },
  { id: 'magenta', name: 'Magenta', rgb: [1.0, 0.36, 0.82] },
  { id: 'cyan', name: 'Cyan', rgb: [0.3, 0.92, 1.0] },
  { id: 'yellow', name: 'Yellow', rgb: [1.0, 0.9, 0.28] },
];
// a colour of the ground with less colour than this (OKLab's chroma) is grey enough to clash with nothing; a colour of
// the way there is far enough from the ground once its hue is this many degrees from every coloured part of it
export const STAND = { grey: 0.035, hue: 45 };

// sRGB 0..1 -> OKLab [L, a, b]
export function oklab([r, g, b]) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const chroma = (lab) => Math.hypot(lab[1], lab[2]);
const hueOf = (lab) => Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
const hueGap = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return Math.min(d, 360 - d); };
// THE GROUND'S COLOURS, as the palette has them (src/planet/kinds.js): its dust or soil, its rock, its bright and dark
// rock, and its grass (his words: "a different color than the ground"; the plants dotted about it are not asked about)
export function groundColours(P) {
  const out = [];
  for (const k of ['dust', 'rock', 'bright', 'dark', 'grass', 'grass2']) if (Array.isArray(P[k])) out.push(P[k]);
  return out;
}

// THE COLOUR OF THE WAY THERE for a planet (its palette): green, purple, then the one furthest from the ground
export function guideColour(P) {
  const ground = groundColours(P || {}).map(oklab).filter((c) => chroma(c) >= STAND.grey);
  const scored = WAY_COLOURS.map((c) => {
    const h = hueOf(oklab(c.rgb));
    const stands = ground.length ? Math.min(...ground.map((g) => hueGap(h, hueOf(g)))) : 180;
    return { ...c, stands, hex: '#' + c.rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('') };
  });
  const ok = scored.find((c, i) => i < 2 && c.stands >= STAND.hue);
  return ok || scored.slice().sort((a, b) => b.stands - a.stands)[0];
}

// FROM THE SHIP TO THE WRECK across the ground: plain x and z (no edge: nothing wraps), and how far
export function offsetTo(from, to) {
  const dx = to[0] - from[0], dz = to[2] - from[2];
  return { dx, dz, dist: Math.hypot(dx, dz) };
}
// the same offset as the ship sees it: [to its right, ahead of it]; ahead: its nose's way across the ground, [x, z]
export function shipFrame(dx, dz, ahead) {
  const l = Math.hypot(ahead[0], ahead[1]) || 1, fx = ahead[0] / l, fz = ahead[1] / l;
  // (its right, as the ship sees it, with y up: ahead turned a quarter clockwise seen from above)
  return [dx * -fz + dz * fx, dx * fx + dz * fz];
}
// the ship's nose's way across the ground from where it looks: a camera's yaw (as the Planet Lab keeps it) -> [x, z]
export const aheadOfYaw = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];

// THE RADAR'S DOT: where the wreck is drawn on the radar (its rim at 1), y up the screen = ahead; past `range`, on the
// rim (beyond: it is further off than the radar reaches)
export const RADAR = { range: 800, ring: 400 };
export function radarDot(right, ahead, range = RADAR.range) {
  const d = Math.hypot(right, ahead);
  if (d <= range) return { x: right / range, y: ahead / range, beyond: false };
  return { x: right / d, y: ahead / d, beyond: true };
}

// HOW FAR, in plain words: metres to the nearest ten under a kilometre (the nearest metre under fifty), then kilometres
// to a tenth
export function distWords(m) {
  m = Math.max(0, m);
  if (m < 50) return `${Math.round(m)} m`;
  if (m < 995) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 9950 ? 1 : 0)} km`;
}

// WHERE THE ARROW STANDS when the wreck is out of sight: from the middle of `box` ({ left, top, right, bottom }, the
// part of the screen the arrow keeps to) toward the wreck's place on the screen (sx, sy, pixels; behind: the wreck is
// behind the eye, its place on the screen turned through the middle), out to the box's edge. angle: the way it points,
// radians, 0 to the right and a quarter turn down the screen
export function edgeSpot(sx, sy, box, behind = false) {
  const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
  let dx = sx - cx, dy = sy - cy;
  if (behind) { dx = -dx; dy = -dy; if (Math.abs(dy) < 1e-6 && Math.abs(dx) < 1e-6) dy = 1; }
  // (straight behind: down the screen, so it reads as "turn round")
  if (behind && dy < 0 && Math.abs(dx) < Math.abs(dy) * 0.25) dy = Math.abs(dy);
  const hw = (box.right - box.left) / 2, hh = (box.bottom - box.top) / 2, k = Math.min(hw / Math.max(1e-6, Math.abs(dx)), hh / Math.max(1e-6, Math.abs(dy)));
  return { x: cx + dx * k, y: cy + dy * k, angle: Math.atan2(dy, dx) };
}
// is a place on the screen inside the box (with room for the marker over it)?
export const inBox = (sx, sy, box) => sx >= box.left && sx <= box.right && sy >= box.top && sy <= box.bottom;
