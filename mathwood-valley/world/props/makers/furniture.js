// THE LIBRARY'S FURNITURE (makers in a building's prop list: { type, x, y, z, rot, ... }; labs/buildings/props.js buildProps
// calls them with the kit, the prop's frame and the prop). Round tops and chair seats are the cabin table's boards, off the
// paper sheet (o.pa, world/props/sheet.js): straight grain, thin seams, each top turned its own way; never the end-grain
// rings a kit prism's cap would show. A frame's picture goes on the same sheet, its mouldings in the kit's wood.
import * as THREE from 'three';
import { T, RX, RY, mul, vary, ngon } from '../../../labs/buildings/parts.js';
import { SHEET, tableTop, chairSeat, pictureRegion } from '../sheet.js';

export const FURN = [0.62, 0.42, 0.3], DARKF = [0.46, 0.3, 0.2];
// the boards' picture is lit as the room lights it: a little under its own colour, each top its own shade
const BOARD_TINT = [0.66, 0.6, 0.55], LID_TINT = [0.5, 0.74, 1.05];
const euler = (rot) => (rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot, 'YXZ')) : new THREE.Matrix4());
export const put = (k, M) => ({
  b: (size, pos, rot, o) => k.board(size, null, null, { ...o, m: mul(M, T(...pos), euler(rot)) }),
  x: (group, size, pos, rot, o = {}) => k.box(group, size, null, null, { ...o, m: mul(M, T(...pos), euler(rot)) }),
  p: (group, poly, len, pos, rot, o = {}) => k.prism(group, poly, len, null, null, { ...o, m: mul(M, T(...pos), euler(rot)) }),
  // a square board from point a to point b (its ends on them: a leg from under a seat to the floor, a stretcher from one
  // leg's middle to another's), w thick
  rod: (w, a, b, o = {}) => {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
    const R = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    return k.board([w, L, w], null, null, { long: 1, ...o, m: mul(M, T((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), R) });
  },
});
// a point up a leg running from its top `t` (under the seat) to its foot `f` (on the floor), at height y
const upLeg = (t, f, y) => { const u = (y - f[1]) / (t[1] - f[1]); return [f[0] + (t[0] - f[0]) * u, y, f[2] + (t[2] - f[2]) * u]; };
// a round of boards: top and underside the boards' picture, its edge a board's edge; turned its own way
function roundOfBoards(k, pa, M, r, th, reg, n) {
  const shade = k.r(0.88, 1.08), tint = BOARD_TINT.map((c) => c * shade);
  pa.cyl(r, th, mul(M, RY(k.r(0, Math.PI * 2))), n, SHEET.edge, reg, tint, { bottom: reg, uSpan: 2 });
}

// the same boards as a lid: just the face (its edge is hidden inside whatever it closes)
export function lidOfBoards(k, pa, M, r, n = 16) {
  const shade = k.r(0.9, 1.08), tint = LID_TINT.map((c) => c * shade);
  pa.cyl(r, 0.0001, mul(M, RY(k.r(0, Math.PI * 2))), n, null, tableTop(Math.floor(k.r(0, 2))), tint);
}

export const FURNITURE = {
  // a round pedestal table: a top of boards with a thin apron under its edge, a turned column, four feet
  roundTable(k, M, o) {
    const q = put(k, M), r = o.r ?? 0.46, H = 0.76, tint = vary(k, DARKF, 0.95, 1.1);
    roundOfBoards(k, o.pa, mul(M, T(0, H - 0.0175, 0)), r, 0.035, tableTop(Math.floor(k.r(0, 2))), 16);
    q.p('wood', ngon(12, r - 0.03), 0.06, [0, H - 0.065, 0], null, { tint: tint.map((c) => c * 0.8), smooth: true, skip: '+y' });
    q.p('wood', ngon(6, 0.05), 0.3, [0, 0.52, 0], null, { tint, smooth: true, taper: 0.25, skip: '+y-y' });
    q.p('wood', ngon(6, 0.065), 0.32, [0, 0.22, 0], null, { tint, smooth: true, taper: -0.3, skip: '-y' });   // (down into the feet)
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; q.b([0.06, 0.06, 0.34], [Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15], [0.12, a, 0], { long: 2, tint: tint.map((c) => c * 0.85) }); }
    k.solid([r * 1.6, 0.05, r * 1.6], null, null, mul(M, T(0, H - 0.03, 0)));
    k.solid([0.14, H, 0.14], null, null, mul(M, T(0, H / 2, 0)));
  },
  // a spindle-back chair facing +z (its back at -z): legs from under the seat splayed out to the floor, stretchers
  // between them (one each side and one across the front, their ends in the legs), a round seat of boards, two back posts
  // and three spindles standing on the seat, a top rail bent round the back from post to post
  spindleChair(k, M, o) {
    const q = put(k, M), tint = vary(k, DARKF, 0.95, 1.12), S = 0.45, cz = 0.01;
    const leg = (sx, sz) => ({ t: [sx * 0.115, S + 0.006, sz * 0.11 + cz], f: [sx * 0.172, 0, sz * 0.168 + cz] });
    const L = { lb: leg(-1, -1), rb: leg(1, -1), rf: leg(1, 1), lf: leg(-1, 1) };
    for (const g of Object.values(L)) q.rod(0.035, g.t, g.f, { tint, skip: '-y+y' });
    for (const [a, b, y] of [[L.lb, L.lf, 0.2], [L.rb, L.rf, 0.2], [L.lf, L.rf, 0.15]]) q.rod(0.02, upLeg(a.t, a.f, y), upLeg(b.t, b.f, y), { tint, skip: '-y+y' });
    roundOfBoards(k, o.pa, mul(M, T(0, S + 0.017, cz)), 0.22, 0.035, chairSeat(Math.floor(k.r(0, 2))), 12);
    // (the back: posts and spindles from the seat's back up and leaning back 10 degrees, away from the sitter, the rail
    // across their tops bowed back between them: the game's maker saw an older rail point into the sitter's back)
    const top = S + 0.52, rake = Math.tan(10 * Math.PI / 180) * 0.5, z0 = -0.14 + cz, post = (sx) => [[sx * 0.13, S + 0.02, z0], [sx * 0.15, top, z0 - rake]];
    for (const sx of [-1, 1]) { const [a, b] = post(sx); q.rod(0.035, a, b, { tint, skip: '-y' }); }
    for (let i = 0; i < 3; i++) { const x = -0.065 + i * 0.065; q.rod(0.018, [x, S + 0.02, z0 - 0.01], [x, top - 0.03, z0 - 0.01 - rake - (0.02 - Math.abs(x) * 0.15)], { tint, skip: '-y+y' }); }
    for (const sx of [-1, 1]) {
      const a = [sx * 0.15, top, z0 - rake], b = [0, top, z0 - rake - 0.025], mid = [(a[0] + b[0]) / 2, top, (a[2] + b[2]) / 2], len = Math.hypot(b[0] - a[0], b[2] - a[2]) + 0.03;
      q.b([len, 0.07, 0.025], mid, [0, Math.atan2(-(b[2] - a[2]), b[0] - a[0]), 0], { long: 0, tint });
    }
    k.solid([0.42, S, 0.4], null, null, mul(M, T(0, S / 2, 0)));
  },
  // a framed picture (o.pic: the sheet's), its face toward +z, its middle at the prop's spot (y: o.y), its back on the
  // wall behind it: four dark mouldings and the picture a little back in them
  framedPicture(k, M0, o) {
    const M = o.tilt ? mul(M0, RX(o.tilt)) : M0;   // (o.tilt: leaning, stood up on something)
    const w = o.w ?? 0.62, h = o.h ?? 0.46, m = 0.04, d = 0.025, q = put(k, M), tint = vary(k, DARKF, 0.7, 0.85);
    o.pa.box([w, h, 0.004], mul(M, T(0, 0, 0.012)), { '+z': pictureRegion(o.pic, w / h), all: null }, [1.2, 1.18, 1.12]);
    for (const s of [-1, 1]) {
      q.b([w + m * 2, m, d], [0, s * (h + m) / 2, d / 2], null, { long: 0, tint, skip: '-z' });
      q.b([m, h, d], [s * (w + m) / 2, 0, d / 2], null, { long: 1, tint, skip: '-z+y-y' });
    }
  },
};
