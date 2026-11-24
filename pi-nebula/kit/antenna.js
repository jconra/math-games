// THE STATION'S RADIO ANTENNA: the old one (a small dish on a 3 m pole) and the new one the radio desk's job builds
// (src/jobs/antenna.js, src/jobs/antennalink.js), as the plan the game's maker approved (DT-12 A, 2026-11-17: "Right
// plan and the right size for one job"; the drawing ~/pw/space-math/shots/dock-try/build-ideas/idea_antenna.png): a
// footing of four pads at the corners of a 2 m square, four legs of 1.5 m (3 m struts cut in half), a brace across
// each face, eight sections of 1.5 m stacked to 12 m, three cables at each of two heights out to anchors 5 m out, and
// the dish on top, tilted 30 degrees up and turned 135 degrees round from the station's bow.
// IT STANDS AT THE VERY TOP OF THE STATION, on the control tower's roof (the game's maker, 2026-11-23: "at the very top
// of the station, over the control tower"; kit/antenna-plan.js has the roof's measure). That roof is 4.8 m across, so
// the anchors, 5 m out, stand on the ends of three arms that reach out past its edge, each bolted down on the roof and
// propped from the tower's wall below; and the red light that was the station's tip stands on a slim rod over the dish.
// ITS OWN FRAME (metres): the footing's middle on the roof at y = 0, y up, x east (the station's bow, out of the hangar
// doors), z south; the job stands it where it stands on the roof (ANTENNA.at).
//   parts()        -> { old, ghost, pads: [Piece x4], legs, braces: [Piece x4], sections: [Piece x7] (2 to 8),
//                     arms: [Piece x3], anchors: [Piece x3], cables: [Piece x6], mount, dish, beacon, tip,
//                     faces: [{ outline, target }] x4 }
//                     every one in this frame, as it stands when built (the dish facing +z before its turn and tilt:
//                     dishPose gives them)
// Drawn with the kit's own pieces and materials (kit/piece.js, kit/materials.js), merged to meshes by
// kit/dockbridge.js meshesOf.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Piece } from './piece.js';
import { sweep, circle, line, lathe, put, bevelBox } from './geo.js';
import { ANTENNA, TOWER_TOP, TOP, anchorsAt, armWays, squareOut, cableFrom, corners, FACES, DISH_PIVOT } from './antenna-plan.js';
export { ANTENNA, TOWER_TOP, TOP, anchorsAt, armWays, cableFrom, corners, FACES, DISH_FOOT, DISH_PIVOT, DISH_TOP, dishPose } from './antenna-plan.js';

const PI = Math.PI;
// a round rod from a to b
const V = (a) => new THREE.Vector3(...a);
function rodGeo(a, b, r, n = 6) {
  const d = V(b).sub(V(a)).normalize(), up = Math.abs(d.y) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  return sweep(circle(r, n), line(a, b, up, 50), { caps: true });
}
const rod = (p, look, a, b, r, n = 6, mat = 'solid') => p.add(mat, rodGeo(a, b, r, n), look);
const onlyPos = (g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };

// one section of the mast, from y0 to y1: its four corner posts, the four struts round its top, and (braced) a brace
// across each face, leaning one way on even sections and the other way on odd ones
function sectionPiece(k, { posts = true, top = true, bottom = false, braced = true } = {}) {
  const p = new Piece(), C = corners(), y0 = k * ANTENNA.sec, y1 = y0 + ANTENNA.sec;
  if (posts) for (const [x, z] of C) rod(p, 'grey', [x, y0, z], [x, y1, z], ANTENNA.post, 8);
  for (let f = 0; f < FACES; f++) {
    const [ax, az] = C[f], [bx, bz] = C[(f + 1) % FACES];
    if (top) rod(p, 'grey', [ax, y1, az], [bx, y1, bz], ANTENNA.strut);
    if (bottom) rod(p, 'grey', [ax, y0 + 0.12, az], [bx, y0 + 0.12, bz], ANTENNA.strut);
    if (braced) { const up = (k + f) % 2 === 0; rod(p, 'yellow', up ? [ax, y0, az] : [bx, y0, bz], up ? [bx, y1, bz] : [ax, y1, az], ANTENNA.strut); }
  }
  return p;
}

export function parts() {
  const C = corners(), A = anchorsAt();
  // ── the old antenna: a base plate, a 3 m pole, a small dish at its top facing east (the station's bow) ──
  const old = new Piece(), [ox, , oz] = ANTENNA.old.at, H = ANTENNA.old.pole;
  old.slab('dark', ox - 0.3, ox + 0.3, 0, 0.06, oz - 0.3, oz + 0.3, { r: 0.012 });
  old.cyl('grey', 0.05, H, [ox, H / 2, oz], null, 10);
  oldDish(old, [ox, H, oz], ANTENNA.old.r);
  // ── the plan, faint: the mast's four corner lines up to 12 m, a ring at each section's top, the dish's place ──
  const g = [];
  for (const [x, z] of C) g.push(rodGeo([x, 0, z], [x, TOP, z], 0.02, 4));
  for (let k = 1; k <= ANTENNA.n; k++) for (let f = 0; f < FACES; f++) { const [ax, az] = C[f], [bx, bz] = C[(f + 1) % FACES]; g.push(rodGeo([ax, k * ANTENNA.sec, az], [bx, k * ANTENNA.sec, bz], 0.016, 4)); }
  const ghost = mergeGeometries(g.map(onlyPos));
  // ── the footing's four pads: a steel plate bolted down, a socket for the leg ──
  const pads = C.map(([x, z]) => {
    const p = new Piece();
    p.slab('gun', x - 0.24, x + 0.24, 0, 0.06, z - 0.24, z + 0.24, { r: 0.012 });
    for (const [bx, bz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.cyl('rail', 0.022, 0.03, [x + bx * 0.17, 0.075, z + bz * 0.17], null, 8);
    p.cyl('dark', 0.085, 0.12, [x, 0.12, z], null, 10);
    return p;
  });
  // ── the first legs: four posts of 1.5 m stood in the pads, and the struts round them, top and bottom ──
  const legs = sectionPiece(0, { braced: false, bottom: true });
  // ── a brace across each face of the first section (the youngest tap each face to brace it), and for each face its
  // outline (marked while it is still to brace) and what a tap on it finds ──
  const braces = [], faces = [];
  for (let f = 0; f < FACES; f++) {
    const [ax, az] = C[f], [bx, bz] = C[(f + 1) % FACES], up = f % 2 === 0, q = new Piece(), y1 = ANTENNA.sec;
    rod(q, 'yellow', up ? [ax, 0.12, az] : [bx, 0.12, bz], up ? [bx, y1, bz] : [ax, y1, az], ANTENNA.strut + 0.004);
    braces.push(q);
    // (out from the face a little, so it is seen in front of the posts: the face's own outward way)
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, nx = Math.sign(Math.round(mx)), nz = Math.sign(Math.round(mz)), o = 0.09;
    const P = [[ax + nx * o, 0.12, az + nz * o], [bx + nx * o, 0.12, bz + nz * o], [bx + nx * o, y1, bz + nz * o], [ax + nx * o, y1, az + nz * o]];
    const outline = mergeGeometries(P.map((a, i) => onlyPos(rodGeo(a, P[(i + 1) % 4], 0.018, 4))));
    const target = new THREE.BufferGeometry();
    target.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3)); target.setIndex([0, 1, 2, 0, 2, 3]); target.computeVertexNormals();
    faces.push({ outline, target, mid: [mx + nx * o, y1 / 2, mz + nz * o], out: [nx, 0, nz] });
  }
  // ── sections 2 to 8, each braced as it goes up ──
  const sections = [];
  for (let k = 1; k < ANTENNA.n; k++) sections.push(sectionPiece(k));
  // ── the three arms that carry the anchors out past the roof's edge: a tube bolted down on the roof at its inner end,
  // a saddle under it at the roof's edge, a prop from under its outer end down to the tower's wall ──
  const arm = ANTENNA.arm, D2R = PI / 180;
  const arms = armWays().map(([ux, uz], k) => {
    const p = new Piece(), turn = [0, -ANTENNA.bearings[k] * D2R, 0], at = (r, y = arm.y) => [ux * r, y, uz * r];
    const from = arm.from[k], [long, wide] = arm.shoe;
    rod(p, 'grey', at(from), at(arm.to), arm.r, 8);
    p.add('solid', put(bevelBox([long, 0.06, wide], [0, 0, 0], { r: 0.012 }), at(from + long / 2 - 0.01, 0.03), turn), 'gun');
    for (const s of [-1, 1]) for (const d of [0.05, long - 0.07]) p.cyl('rail', 0.022, 0.03, [ux * (from + d) - uz * s * (wide / 2 - 0.045), 0.075, uz * (from + d) + ux * s * (wide / 2 - 0.045)], null, 8);
    // (the saddle stands down through the roof's plates, whatever their height there: 0.32 m at most)
    const edge = squareOut(ux, uz, TOWER_TOP.half);
    p.add('solid', put(bevelBox([0.36, 0.42, 0.3], [0, 0, 0], { r: 0.012 }), at(edge - 0.24, arm.y - arm.r - 0.2), turn), 'gun');
    const wall = squareOut(ux, uz, TOWER_TOP.wall) + 0.3;
    rod(p, 'grey', at(ANTENNA.out - 0.12, arm.y - arm.r * 0.6), at(wall, -arm.foot), arm.prop, 6);
    p.add('solid', put(bevelBox([0.34, 0.3, 0.34], [0, 0, 0], { r: 0.012 }), at(wall, -arm.foot), turn), 'gun');
    return p;
  });
  // ── the anchors on the arms' ends (a plate, a ring), and the cables: three from each height, one to each anchor ──
  const anchors = A.map(([x, z], k) => {
    const p = new Piece(), y = ANTENNA.drop[k];
    p.slab('gun', x - 0.22, x + 0.22, y, y + 0.05, z - 0.22, z + 0.22, { r: 0.012 });
    p.cyl('dark', 0.05, 0.16, [x, y + 0.12, z], null, 8);
    const ring = new THREE.TorusGeometry(0.07, 0.018, 6, 14); ring.rotateY(Math.atan2(-x, -z) + PI / 2); ring.translate(x, y + 0.26, z); p.add('solid', ring, 'rail');
    return p;
  });
  const cables = [];
  for (const h of ANTENNA.holds) A.forEach(([x, z], k) => {
    const p = new Piece(), d = Math.hypot(x, z), ux = x / d, uz = z / d;
    // (from the mast's side facing the anchor, at that height, to the anchor's ring)
    const at = cableFrom(ANTENNA.bearings[k], h);
    rod(p, 'rail', at, [x - ux * 0.06, ANTENNA.drop[k] + 0.27, z - uz * 0.06], ANTENNA.cable, 5);
    p.cyl('rail', 0.03, 0.08, [at[0], at[1], at[2]], null, 6);
    cables.push(p);
  });
  // ── the dish's mount on the mast's top: a plate across the top, a short post, a turntable ──
  const mount = new Piece();
  mount.slab('gun', -ANTENNA.half - 0.06, ANTENNA.half + 0.06, TOP, TOP + 0.08, -ANTENNA.half - 0.06, ANTENNA.half + 0.06, { r: 0.015 });
  mount.cyl('grey', 0.09, ANTENNA.dish.post, [0, TOP + 0.08 + ANTENNA.dish.post / 2, 0], null, 12);
  mount.cyl('dark', 0.22, 0.08, [0, TOP + 0.08 + ANTENNA.dish.post, 0], null, 16);
  // (the lights at the mast's top, red, as a tall mast has: lit when it is switched on; and the one at the very top, on
  // a slim rod up from the mast's corner, over the dish: the station's highest point)
  const beacon = new Piece(), T = ANTENNA.tip;
  beacon.add('glow', put(new THREE.SphereGeometry(0.07, 10, 8), [ANTENNA.half, TOP + 0.16, ANTENNA.half]), 'red');
  beacon.add('glow', put(new THREE.SphereGeometry(0.07, 10, 8), [-ANTENNA.half, TOP + 0.16, -ANTENNA.half]), 'red');
  beacon.add('glow', put(new THREE.SphereGeometry(T.r, 12, 10), [T.at[0], T.h - T.r, T.at[1]]), 'red');
  const tip = new Piece();
  rod(tip, 'grey', [T.at[0], TOP, T.at[1]], [T.at[0], T.h - 2 * T.r, T.at[1]], T.rod, 6);
  tip.cyl('dark', 0.05, 0.1, [T.at[0], T.h - 2 * T.r - 0.03, T.at[1]], null, 8);
  // ── the new dish, in its own frame: the turntable's top at its foot, the yoke, the bowl facing +z ──
  const dish = dishPiece();
  return { old, ghost, pads, legs, braces, faces, sections, arms, anchors, cables, mount, beacon, tip, dish };
}
// the dish: a yoke (two arms up from the turntable) and the bowl between them, a feed out in front on three struts
function dishPiece() {
  const yoke = new Piece(), bowl = new Piece(), R = ANTENNA.dish.r, D = ANTENNA.dish.deep;
  yoke.cyl('dark', 0.18, 0.06, [0, 0.03, 0], null, 16);
  for (const s of [-1, 1]) yoke.slab('grey', s * (R + 0.04) - 0.035, s * (R + 0.04) + 0.035, 0.03, DISH_PIVOT + 0.06, -0.06, 0.06, { r: 0.01 });
  yoke.slab('grey', -R - 0.08, R + 0.08, 0.03, 0.09, -0.07, 0.07, { r: 0.01 });
  // the bowl about its pivot (its own frame: the pivot at the origin, facing +z): a shallow dish of light panels, a
  // rim, its back braced; the feed on three struts at its focus
  const pts = []; for (let i = 0; i <= 10; i++) { const r = R * i / 10; pts.push([r, D * (r / R) ** 2]); }
  const inner = lathe(pts, 28); inner.rotateX(PI / 2); inner.translate(0, 0, -D * 0.6); bowl.add('solid', inner, 'white2');
  const back = lathe(pts.map(([r, y]) => [r, y - 0.03]).reverse(), 28); back.rotateX(PI / 2); back.translate(0, 0, -D * 0.6); bowl.add('solid', back, 'grey2');
  const rim = new THREE.TorusGeometry(R, 0.025, 6, 32); rim.translate(0, 0, D * 0.4); bowl.add('solid', rim, 'grey');
  const f = D * 0.4 + R * 0.55;
  for (let k = 0; k < 3; k++) { const a = k * 2 * PI / 3 + PI / 2; rod(bowl, 'grey', [Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92, D * 0.4], [0, 0, f], 0.012, 5); }
  bowl.cyl('dark', 0.06, 0.16, [0, 0, f + 0.02], [PI / 2, 0, 0], 10);
  bowl.cyl('grey', 0.05, 0.08, [0, 0, -D * 0.6 - 0.06], [PI / 2, 0, 0], 10);
  for (const s of [-1, 1]) bowl.cyl('dark', 0.03, 0.1, [s * (R + 0.02), 0, 0], [0, 0, PI / 2], 8);
  // (the feed's tip lights green while it hears something: src/jobs/antennalink.js)
  const feed = new Piece(); feed.add('glow', put(new THREE.SphereGeometry(0.035, 8, 6), [0, 0, f + 0.11]), 'green');
  return { yoke, bowl, feed, pivot: DISH_PIVOT };
}

// the old antenna's dish: a small bowl on a short arm at the pole's top, turned east and up a little
function oldDish(p, [x, y, z], R) {
  const pts = []; for (let i = 0; i <= 6; i++) { const r = R * i / 6; pts.push([r, 0.1 * (r / R) ** 2]); }
  const g = lathe(pts, 16); g.rotateX(PI / 2); put(g, [x + 0.12, y + 0.12, z], [0, PI / 2, 0]); g.rotateZ(0); p.add('solid', g, 'white2');
  const b = lathe(pts.map(([r, yy]) => [r, yy - 0.02]).reverse(), 16); b.rotateX(PI / 2); put(b, [x + 0.12, y + 0.12, z], [0, PI / 2, 0]); p.add('solid', b, 'grey2');
  p.add('solid', put(bevelBox([0.16, 0.06, 0.06], [0, 0, 0], { r: 0.01 }), [x + 0.05, y + 0.1, z]), 'grey');
  rod(p, 'grey', [x + 0.12, y + 0.12, z], [x + 0.34, y + 0.12, z], 0.008, 4);
}
