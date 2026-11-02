// THE LIBRARY'S GOODS. A BOOT is a real shape, still cheap: its upper is one skin lofted from the shaft's top down round the
// ankle and out along the foot to a rounded toe, on a sole with a raised heel, with a pull strap either side of the top
// and the dark inside of the shaft. About 210 triangles; all of them in the goods mesh, on the leather tiles of the
// store's picture. Toes toward +x. Used by the store's shelves (labs/buildings/store.js) and anyone else with boots.
import { T, RY, mul } from '../../../labs/buildings/parts.js';
import { STORE_ART } from '../../../labs/buildings/art.js';

// [x, y of the section's middle, half depth along its radial way, half width, its tilt (0: flat, the radial way along x; 90
// degrees: upright, the radial way along y)], from the shaft's top to the toe
const UPPER = [
  [-0.052, 0.315, 0.062, 0.05, 0], [-0.053, 0.245, 0.056, 0.046, 0], [-0.056, 0.165, 0.05, 0.04, 0],
  [-0.058, 0.108, 0.066, 0.043, 16], [-0.052, 0.078, 0.072, 0.045, 38], [-0.012, 0.062, 0.058, 0.046, 62],
  [0.052, 0.05, 0.044, 0.046, 84], [0.108, 0.043, 0.033, 0.047, 90], [0.152, 0.038, 0.024, 0.04, 90], [0.178, 0.034, 0.012, 0.022, 90],
];
const SOLE = [[-0.122, 0], [-0.05, 0], [-0.04, 0.018], [0.178, 0.012], [0.196, 0.024], [0.18, 0.034], [-0.04, 0.036], [-0.125, 0.04]];
const SIDES = 8;
export const BOOT_TINT = [0.62, 0.5, 0.42];   // (the leather tile is a warm red-brown: taken down to old saddle leather)
export function makeBoot(gd, M, reg, tint) {
  const rows = UPPER.length - 1;
  const at = (i, j) => {
    const [x, y, hd, hw, t] = UPPER[j], a = (i / SIDES) * Math.PI * 2, c = Math.cos(t * Math.PI / 180), s = Math.sin(t * Math.PI / 180), u = Math.cos(a) * hd;
    return [x + u * c, y + u * s, Math.sin(a) * hw];
  };
  gd.grid(SIDES, rows, at, (i, j) => [i / SIDES, j / rows], reg, tint, M, { wrap: true });
  // (the toe's tip closed; the sole and heel a shade darker; the shaft's inside dark; a strap each side of the top)
  const tipX = UPPER[rows][0], tipY = UPPER[rows][1], pts = []; for (let i = 0; i < SIDES; i++) pts.push(at(i, rows));
  gd.fan(pts, [1, 0, 0], () => [0.5, 0.5], reg, tint, M);
  gd.extrude(SOLE, 0.07, M, STORE_ART.tile.leatherBlack, STORE_ART.tile.leatherBlack, tint.map((c) => c * 0.7));
  gd.lathe([[UPPER[0][2], UPPER[0][1]], [0.05, 0.25], [0, 0.25]], mul(M, T(UPPER[0][0], 0, 0)), SIDES, STORE_ART.tile.coal, [0.5, 0.45, 0.4], { oval: [1, UPPER[0][3] / UPPER[0][2]] });
  for (const s of [-1, 1]) gd.box([0.022, 0.028, 0.006], mul(M, T(UPPER[0][0], 0.318, s * 0.046)), { all: reg, '-y': null }, tint.map((c) => c * 0.8));
  return { tipX, tipY };
}
// a pair, side by side, the toes a little apart
export function makeBoots(gd, M, reg, tint) { for (const s of [-1, 1]) makeBoot(gd, mul(M, T(s * 0.012, 0, s * 0.066), RY(s * 0.07)), reg, tint); }

export const GOODS = {
  boots(k, M, o) {
    const black = o.leather === 'black', shade = k.r(0.85, 1.1), t = BOOT_TINT.map((c) => c * shade);
    makeBoots(o.gd, M, black ? STORE_ART.tile.leatherBlack : STORE_ART.tile.leather, t);
  },
};
