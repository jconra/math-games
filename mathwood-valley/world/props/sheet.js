// THE PROPS' PAPER SHEET: one picture (models/props/sheet.webp, 1024 x 1024, about 200 KB) holding the town's framed
// pictures and the round table tops' boards. A rig makes it (rigs/props/pictures.cjs): the pictures are the game's own
// people, animals and views rendered from the live world and toned sepia, so nothing here is drawn in code. Everything
// that shows it goes in one mesh a building (the 'paper' material), so a room's frames and tables cost one draw.
//
//   SHEET                          where things are, in pixels (the top left corner, as Goods regions want them)
//   pictureRegion(id, aspect)      the part of a picture's cell for a frame of this width / height, from its middle
//   tableTop(i), chairSeat(i)      a round top's picture (boards side by side, straight grain)
//   loadSheet(base)                -> a Promise of the one shared texture
import * as THREE from 'three';
import { PICTURES } from './catalog.js';

const CELL = 256;
export const SHEET = {
  w: 1024, h: 1024, cell: CELL,
  pictures: Object.fromEntries(PICTURES.map((id, i) => [id, [(i % 4) * CELL, Math.floor(i / 4) * CELL, CELL, CELL]])),
  tops: [[0, 768, 256, 256], [256, 768, 256, 256]],
  seats: [[512, 768, 128, 128], [640, 768, 128, 128]],
  edge: [512, 896, 256, 32],     // a board's edge, along u
};

export function pictureRegion(id, aspect = 1) {
  const [x, y, w, h] = SHEET.pictures[id] || SHEET.pictures.valley;
  if (aspect >= 1) { const hh = h / aspect; return [x, y + (h - hh) / 2, w, hh]; }
  const ww = w * aspect; return [x + (w - ww) / 2, y, ww, h];
}
export const tableTop = (i = 0) => SHEET.tops[i % SHEET.tops.length];
export const chairSeat = (i = 0) => SHEET.seats[i % SHEET.seats.length];

let LOADING = null;
export function loadSheet(base = new URL('../../', import.meta.url).href) {
  if (!LOADING) LOADING = new THREE.TextureLoader().loadAsync(`${base}models/props/sheet.webp`).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  });
  return LOADING;
}
