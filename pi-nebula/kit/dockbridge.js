// THE DOCKING PORT'S BRIDGE: the lattice tube the game's maker picked (option C of the dock's option sheet, 2026-11-15:
// "a round glass tube held by a lattice of triangles"), built a ring at a time by the dock's job (src/jobs/docklink.js),
// and the crew module it reaches for. Drawn with the kit's own pieces and materials.
// ITS OWN FRAME (metres): the station's outer port face at z = 0, the bridge running out along +z, y up (the station's
// floor at y = 0, the port's middle at y = DOCK.c), x across. The job stands it at the port.
//   a RING is one length of the tube (DOCK.L): the hoop at its far end, six straight struts along it above the deck, a
//   plated trough under the deck, the deck with a light strip down each edge, and five panels round its top half
//   (between the struts) that a brace crosses corner to corner, making each two triangles. Its glass goes on once it
//   is braced.
//   ring(i)        -> { solid, braces: [Piece per panel], glass (geometry), glow (the hoop's ring of light),
//                     strips (the deck's lights), outlines: [geometry per panel], targets: [geometry per panel] }
//                     in the ring's own frame (its near end at z = 0), for the job to stand at DOCK.z0 + i * DOCK.L
//   collar(), crewModule(), plan()     the port's collar and floodlights; the crew module waiting at the far end (its
//                     docking ring's lights apart, for the job to colour); the
//                     bridge's plan, faint (a hoop for every ring and three lines along), to show where it goes
//   hull(box)      plating over the outside of the station's room round the port (seen from out here)
//   wholeBridge()  every ring built and braced, as the job leaves it: the bridge that stands and is walked on
//                  (src/dockwalk.js)
//   endWall(T), tunnel(T)   the plate across the tube's end and the short sealed tunnel from it in to the Hauler's
//                  crew door (the game's maker, HAUL3-2), from the Hauler's own numbers (src/haulerdock.js TUNNEL)
//   meshesOf(piece, mats, light)       a piece's parts merged into meshes, one a material, lit by `light(p, n)`
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Piece } from './piece.js';
import { sweep, circle, line, bend, lathe, put, bevelBox, extrude, MeshData, fixWinding } from './geo.js';

const PI = Math.PI, D2R = PI / 180;
export const DOCK = {
  c: 1.42,      // the tube's middle over the station's floor: the port's middle (kit/hangar.js AIRLOCK.centre)
  R: 1.3,       // the tube's radius (2.6 m across: 2.25 m over the deck)
  deck: 0.47,   // the deck's top: the port's sill (AIRLOCK.centre - AIRLOCK.r)
  z0: 0.34,     // the first ring's near end, out from the port's face (the collar between)
  L: 0.9,       // a ring's length
  rings: 9,     // the whole bridge (8.1 m); the try builds three
  gap: 0.28,    // from the last ring's hoop to the crew module's docking ring
};
// the struts round the tube, in degrees from +x toward +y: the six above the deck (the trough covers the rest)
export const STRUTS = [-22.5, 22.5, 67.5, 112.5, 157.5, 202.5];
// the panels, each between two struts: 0 the +x side, 1 above it, 2 the top, 3 above the -x side, 4 the -x side
export const PANELS = 5;
export const moduleAt = () => DOCK.z0 + DOCK.rings * DOCK.L + DOCK.gap;   // (the crew module's docking ring, z)

const at = (deg, z, r = DOCK.R) => [r * Math.cos(deg * D2R), DOCK.c + r * Math.sin(deg * D2R), z];
// a round rod from a to b
function rod(p, look, a, b, r = 0.03, n = 10, mat = 'solid') {
  const d = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize(), up = Math.abs(d.y) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  return p.add(mat, sweep(circle(r, n), line(a, b, up, 50), { caps: true }), look);
}
const rodGeo = (a, b, r) => { const d = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize(), up = Math.abs(d.y) > 0.9 ? [1, 0, 0] : [0, 1, 0]; return sweep(circle(r, 6), line(a, b, up, 50), { caps: true }); };
// a hoop round the tube's middle at z (tube radius r), or an arc of it from deg a0 to a1
const hoopGeo = (z, R, r, a0 = 0, a1 = 360, seg = 64, n = 8) => sweep(circle(r, n), bend([0, DOCK.c, z], R, [1, 0, 0], [0, 1, 0], a0 * D2R, a1 * D2R, Math.max(4, Math.round(seg * (a1 - a0) / 360))), { closed: a1 - a0 >= 360 });
// a piece of the tube's own surface: round from deg a0 to a1 at radius R, z0 to z1, facing out
function tubeGeo(R, a0, a1, z0, z1, seg = 40) {
  const m = new MeshData(), n = Math.max(2, Math.round(seg * (a1 - a0) / 360));
  for (const z of [z0, z1]) for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * D2R, c = Math.cos(a), s = Math.sin(a); m.v(R * c, DOCK.c + R * s, z, c, s, 0, R * a, z); }
  for (let i = 0; i < n; i++) m.quad(i, i + 1, n + 2 + i, n + 1 + i);
  return fixWinding(m.geometry());
}

// ── a ring ─────────────────────────────────────────────────────────────────────────────────────────────────────
export function ring(i) {
  const { R, L, deck } = DOCK, solid = new Piece();
  // the hoop at its far end (its near end is the last ring's hoop, or the collar)
  solid.add('solid', hoopGeo(L, R, 0.05, 0, 360, 64, 10), 'white2');
  // the struts along it
  for (const a of STRUTS) rod(solid, 'white2', at(a, 0.02), at(a, L - 0.02), 0.032);
  // the trough under the deck: plating round the bottom from strut to strut, ribbed at the hoop
  const band = [];
  for (let k = 0; k <= 24; k++) { const a = (202.5 + 135 * k / 24) * D2R; band.push([(R + 0.03) * Math.cos(a), DOCK.c + (R + 0.03) * Math.sin(a)]); }
  for (let k = 24; k >= 0; k--) { const a = (202.5 + 135 * k / 24) * D2R; band.push([(R - 0.03) * Math.cos(a), DOCK.c + (R - 0.03) * Math.sin(a)]); }
  solid.add('solid', extrude(band.slice().reverse(), L - 0.02, 0.01).translate(0, 0, 0.01), 'grey2');
  solid.add('solid', hoopGeo(L - 0.06, R + 0.035, 0.03, 202.5, 337.5, 40, 6), 'dark');
  // the deck: a plate across the trough, at the port's sill
  const hw = Math.sqrt(R * R - (DOCK.c - deck) ** 2) - 0.04;
  solid.slab('gun', -hw, hw, deck - 0.07, deck, 0.0, L, { r: 0.012 });
  for (const s of [-1, 1]) solid.slab('dark', s * hw - 0.03, s * hw + 0.03, deck, deck + 0.04, 0.0, L, { r: 0.01 });
  // its lights: a strip down each edge of the deck (lit when the ring locks)
  const strips = new Piece();
  for (const s of [-1, 1]) strips.glowSlab('strip', s * (hw - 0.13) - 0.025, s * (hw - 0.13) + 0.025, deck + 0.002, deck + 0.01, 0.05, L - 0.05);
  // its braces, one a panel, leaning one way on even rings and the other on odd (the lattice's zig-zag round the tube)
  const braces = [], outlines = [], targets = [];
  for (let j = 0; j < PANELS; j++) {
    const a = STRUTS[j], b = STRUTS[j + 1], up = (i + j) % 2 === 0, q = new Piece();
    rod(q, 'yellow', at(up ? a : b, 0.03, R - 0.005), at(up ? b : a, L - 0.03, R - 0.005), 0.034);
    braces.push(q);
    // (a panel still to be braced, marked: a thin outline just outside it)
    const o = [hoopGeo(0.02, R + 0.07, 0.016, a, b, 24, 5), hoopGeo(L - 0.02, R + 0.07, 0.016, a, b, 24, 5), rodGeo(at(a, 0.02, R + 0.07), at(a, L - 0.02, R + 0.07), 0.016), rodGeo(at(b, 0.02, R + 0.07), at(b, L - 0.02, R + 0.07), 0.016)];
    outlines.push(mergeGeometries(o.map(onlyPos)));
    // (and what a tap on it finds: the panel's face, a little outside the tube)
    const t = new THREE.BufferGeometry(), P = [at(a, 0, R + 0.06), at(b, 0, R + 0.06), at(b, L, R + 0.06), at(a, L, R + 0.06)].flat();
    t.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); t.setIndex([0, 1, 2, 0, 2, 3]); t.computeVertexNormals();
    targets.push(t);
  }
  // its glass, round the top above the deck, and the ring of light at its hoop (its glow when it locks)
  const glass = tubeGeo(R - 0.012, -22.5, 202.5, 0.02, L - 0.02);
  const glow = onlyPos(hoopGeo(L, R + 0.065, 0.022, 0, 360, 72, 6));
  return { solid, braces, glass, glow, strips, outlines, targets };
}
const onlyPos = (g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };

// ── the port's collar, and two floodlights on the station's wall either side of it ────────────────────────────────
export function collar() {
  const p = new Piece(), { R, z0 } = DOCK;
  p.lathe('black', [[R + 0.13, -0.02], [R + 0.13, z0 - 0.08], [R + 0.06, z0], [R - 0.05, z0], [R - 0.05, 0.02], [R + 0.13, -0.02]], 64, [0, DOCK.c, 0], [PI / 2, 0, 0]);
  // (the lathe stands along y: laid along +z by the turn above; its first hoop, where the first ring starts)
  p.add('solid', hoopGeo(z0, R, 0.055, 0, 360, 64, 10), 'white2');
  for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * 360; p.cyl('grey', 0.03, 0.05, at(a, z0 - 0.06, R + 0.09), [PI / 2, 0, 0], 8); }
  for (const s of [-1, 1]) {
    const x = s * (R + 0.42), y = DOCK.c + 0.95;
    p.slab('black', x - 0.2, x + 0.2, y - 0.12, y + 0.12, 0.0, 0.22, { r: 0.03 });
    p.slab('gun', x - 0.05, x + 0.05, y - 0.32, y - 0.1, 0.0, 0.08, { r: 0.015 });
    p.glowSlab('flare', x - 0.16, x + 0.16, y - 0.08, y + 0.08, 0.22, 0.226);
  }
  return p;
}
// the floodlights, for the light (in the bridge's frame): where they are, the way they point
export const FLOODS = [-1, 1].map((s) => ({ at: [s * (DOCK.R + 0.42), DOCK.c + 0.95, 0.3], dir: new THREE.Vector3(-s * 0.12, -0.18, 1).normalize() }));

// ── the station's outside round the port: plating over the airlock module's sides, roof and underside ──────────────
// The station's rooms are drawn to be seen from inside (a wall's back is not drawn): from out here, beside the port,
// the airlock module would look cut open. b: its box in the bridge's frame ({ x0, x1, y0, y1, z0, z1 }; z0 back toward
// the station, z1 at the port's face). Plates about 2 m by 1.5 m with dark seams, ribs at the module's corners.
export function hull(b) {
  const p = new Piece(), G = 0.02, T = 0.06, H1 = { c: '#a9acaf', r: 0.55, m: 0.15, w: 0.9 }, H2 = { c: '#8e9196', r: 0.5, m: 0.2, w: 0.9 };
  const rows = (a0, a1, n) => { const out = []; for (let k = 0; k < n; k++) out.push([a0 + (a1 - a0) * k / n, a0 + (a1 - a0) * (k + 1) / n]); return out; };
  const nz = Math.max(1, Math.round((b.z1 - b.z0) / 2)), ny = Math.max(1, Math.round((b.y1 - b.y0) / 1.5)), nx = Math.max(1, Math.round((b.x1 - b.x0) / 2));
  // the two sides (x0 and x1), plates facing out
  for (const [s, x] of [[-1, b.x0], [1, b.x1]]) {
    p.slab('dark', s < 0 ? x - T : x, s < 0 ? x : x + T, b.y0, b.y1, b.z0, b.z1, { r: 0.01, cell: 1.5 });
    rows(b.z0, b.z1, nz).forEach(([z0, z1], i) => rows(b.y0, b.y1, ny).forEach(([y0, y1], j) => p.slab((i + j) % 2 ? H1 : H2, s < 0 ? x - T - 0.03 : x + T, s < 0 ? x - T : x + T + 0.03, y0 + G, y1 - G, z0 + G, z1 - G, { r: 0.012, cell: 1.5 })));
  }
  // the roof and the underside
  for (const [s, y] of [[1, b.y1], [-1, b.y0]]) {
    p.slab('dark', b.x0 - T, b.x1 + T, s > 0 ? y : y - T, s > 0 ? y + T : y, b.z0, b.z1, { r: 0.01, cell: 1.5 });
    rows(b.z0, b.z1, nz).forEach(([z0, z1], i) => rows(b.x0, b.x1, nx).forEach(([x0, x1], j) => p.slab((i + j) % 2 ? H2 : H1, x0 + G, x1 - G, s > 0 ? y + T : y - T - 0.03, s > 0 ? y + T + 0.03 : y - T, z0 + G, z1 - G, { r: 0.012, cell: 1.5 })));
  }
  // ribs along the four long corners, and a band round the port's end
  for (const x of [b.x0 - T, b.x1 + T]) for (const y of [b.y0 - T, b.y1 + T]) p.slab('black', x - 0.07, x + 0.07, y - 0.07, y + 0.07, b.z0, b.z1, { r: 0.02 });
  for (const x of [b.x0 - T - 0.05, b.x1 + T + 0.05]) p.slab('yellow', x - 0.02, x + 0.02, b.y0 + 0.1, b.y1 - 0.1, b.z1 - 0.3, b.z1 - 0.12, { r: 0.006 });
  return p;
}

// ── the crew module, waiting at the far end (a stand-in: the transport's sealed crew section) ──────────────────────
export function crewModule() {
  const p = new Piece(), z = moduleAt(), glow = new Piece(), lights = new Piece();
  // its docking ring, facing the bridge: charcoal, eight lights round it (white here: the job colours them, red while
  // the bridge has not reached it)
  p.add('solid', sweep(circle(0.11, 10), bend([0, DOCK.c, z], DOCK.R + 0.06, [1, 0, 0], [0, 1, 0], 0, 2 * PI, 64), { closed: true }), 'black');
  p.lathe('gun', [[0.001, z - 0.02], [DOCK.R - 0.1, z - 0.02], [DOCK.R + 0.2, z + 0.25], [DOCK.R + 0.2, z + 0.55], [0.001, z + 0.55]], 48, [0, DOCK.c, 0], [PI / 2, 0, 0]);
  // (on the ring's face toward the bridge, in front of its rod (0.11 thick round), and big enough to read from the far
  // end of the bridge: the end of the try turns them green)
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * 360, q = at(a, z - 0.15, DOCK.R + 0.06); lights.add('glow', put(bevelBox([0.17, 0.17, 0.04], [0, 0, 0], { r: 0.015 }), q), [1, 1, 1]); }
  // the drum: a cockpit-and-cabin section lying along the bridge's line, a darker band, a row of lit windows round it
  const D = [[0.001, 0], [1.6, 0], [2.25, 0.3], [2.5, 0.75], [2.5, 4.3], [2.3, 4.9], [1.2, 5.25], [0.001, 5.3]].map(([r, y]) => [r, y + z + 0.55]);
  p.lathe('white', D, 56, [0, DOCK.c, 0], [PI / 2, 0, 0]);
  p.lathe('band', [[2.515, z + 2.0], [2.515, z + 2.7]], 56, [0, DOCK.c, 0], [PI / 2, 0, 0]);
  for (let k = 0; k < 14; k++) { const a = k / 14 * 360 + 6, q = at(a, z + 2.35, 2.53); glow.add('glow', put(bevelBox([0.05, 0.22, 0.42], [0, 0, 0], { r: 0.01 }), q, [0, 0, a * D2R]), 'soft'); }
  for (let k = 0; k < 4; k++) { const a = 45 + k * 90; p.add('solid', put(bevelBox([0.08, 1.4, 2.4], [0, 0, 0], { r: 0.02 }), at(a, z + 3.6, 3.15), [0, 0, (a - 90) * D2R]), 'grey'); }
  return { solid: p, glow, lights };
}
// the module's lights, for the light (in the bridge's frame)
export const MODULE_LIGHT = () => ({ at: [0, DOCK.c + 1.6, moduleAt() - 0.4], i: 1.2, color: [1, 0.45, 0.4], reach: 5 });

// ── the plan: where the bridge will go, faint ─────────────────────────────────────────────────────────────────────
// -> { hoops: [geometry per ring: its hoop], lines: geometry (three lines along, the top and both sides) }
export function plan() {
  const hoops = [];
  for (let k = 0; k < DOCK.rings; k++) hoops.push(onlyPos(hoopGeo(DOCK.z0 + (k + 1) * DOCK.L, DOCK.R, 0.012, 0, 360, 64, 4)));
  const z1 = moduleAt(), L = [];
  for (const a of [0, 90, 180]) L.push(onlyPos(rodGeo(at(a, DOCK.z0, DOCK.R), at(a, z1, DOCK.R), 0.008)));
  return { hoops, lines: mergeGeometries(L) };
}

// ── THE WHOLE BRIDGE, BUILT: every ring braced, its glass on, its hoop and its deck's strips lit, as the dock's job
// leaves it once all nine are built (the game's maker, HAUL3-3 2026-11-20: "Once all nine rings are built, walk across it
// and in through the crew door"): drawn by src/dockwalk.js for as long as it stands, and walked on.
//   wholeBridge() -> { solid: Piece (the collar, the rings, all their braces, a plate over the collar from the port's
//                    sill to the first ring's deck), glass: [geometry], glow: [geometry] (the hoops), strips: Piece }
export function wholeBridge() {
  const solid = collar(), strips = new Piece(), glass = [], glow = [];
  const moved = (g, z) => g.translate(0, 0, z);
  for (let i = 0; i < DOCK.rings; i++) {
    const z = DOCK.z0 + i * DOCK.L, R = ring(i);
    for (const P of [R.solid, ...R.braces]) for (const { mat, geo } of P.parts) solid.parts.push({ mat, geo: moved(geo, z) });
    for (const { mat, geo } of R.strips.parts) strips.parts.push({ mat, geo: moved(geo, z) });
    glass.push(moved(R.glass, z)); glow.push(moved(R.glow, z));
  }
  // (the plate over the collar: the port's round door's sill is the bridge's deck, so the way out is level, over the
  // airlock's outer step)
  const hw = Math.sqrt(DOCK.R * DOCK.R - (DOCK.c - DOCK.deck) ** 2) - 0.04;
  solid.slab('gun', -hw, hw, DOCK.deck - 0.07, DOCK.deck, -0.02, DOCK.z0 + 0.01, { r: 0.012 });
  return { solid, glass, glow, strips };
}

// ── THE TUNNEL INTO THE SHIP'S DOOR (the game's maker, HAUL3-2 2026-11-20: "Add a short, narrow tunnel, the size of the
// door, from the bridge's end in to the door." and "What is the point of having a tunnel if it isn't sealed?"): the
// ship's door is narrower than the tube and set in past what stands out beside it (the Hauler's front clamp frame and
// front pod), so a closed tunnel the size of the door runs from a plate across the tube's end in to the ship's hull
// round the door: a floor, two walls and a roof, sealed against the hull with a black gasket and against the plate.
// T, in the bridge's frame (src/haulerdock.js TUNNEL, from the ship's own door):
//   half      its inside's half width (the door's)          wall   its walls' thickness
//   floor     its floor's top                               roof   its roof's underside (the door's head)
//   z0        where it starts: the bridge's last hoop       face(y) -> z   the ship's hull at a height: where it ends
//   ys        the heights at which the hull's side bends (its profile's points), for the walls' edge along it
//   endWall(T) -> Piece        the plate across the tube's end, an opening the tunnel's inside in it
//   tunnel(T)  -> { solid: Piece, glow: Piece (the strip of light along its roof), lamp: [x, y, z] (that light's
//                 middle, for the light worked out on it) }
export function endWall(T) {
  const p = new Piece(), n = 64, out = [];
  for (let k = 0; k < n; k++) { const a = k / n * 2 * PI; out.push([(DOCK.R - 0.01) * Math.cos(a), DOCK.c + (DOCK.R - 0.01) * Math.sin(a)]); }
  const x = T.half, hole = [[-x, T.floor], [-x, T.roof], [x, T.roof], [x, T.floor]];
  p.add('solid', extrude(out, 0.05, 0.006, { holes: [hole] }).translate(0, 0, T.z0 - 0.045), 'grey2');
  // (a frame round the opening on the bridge's side, the hazard yellow along its sill)
  const f = 0.05, zf = T.z0 - 0.06;
  p.slab('white2', -x - f, -x, T.floor, T.roof + f, zf, T.z0 - 0.04, { r: 0.008 });
  p.slab('white2', x, x + f, T.floor, T.roof + f, zf, T.z0 - 0.04, { r: 0.008 });
  p.slab('white2', -x - f, x + f, T.roof, T.roof + f, zf, T.z0 - 0.04, { r: 0.008 });
  p.slab('yellow', -x, x, DOCK.deck - 0.005, DOCK.deck + 0.006, T.z0 - 0.09, T.z0 - 0.04, { r: 0.003 });
  return p;
}
export function tunnel(T) {
  const p = new Piece(), glow = new Piece(), { half, wall, floor, roof, z0 } = T, xo = half + wall, th = 0.05;
  const y0 = floor - th, y1 = roof + th;
  // (the hull's face along a wall's edge, from under the floor to over the roof: the heights it bends at, and the ends)
  const ys = [y0, ...T.ys.filter((y) => y > y0 + 1e-3 && y < y1 - 1e-3), y1];
  const edge = ys.map((y) => [T.face(y) - 0.005, y]);
  // the floor and the roof, each from the plate in to the hull
  p.slab('grey2', -xo, xo, y0, floor, z0 - 0.04, T.face(floor) - 0.005, { r: 0.006 });
  p.slab('grey2', -xo, xo, roof, y1, z0 - 0.04, T.face(roof) - 0.005, { r: 0.006 });
  // the two walls: from the plate in to the hull, their edge along its face (an outline in (z, y), across x)
  const outline = [[z0 - 0.04, y0], ...edge, [z0 - 0.04, y1]];
  for (const s of [-1, 1]) {
    const g = extrude(outline, wall, 0.004);   // (made in (z, y), pushed out along what becomes -x)
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0));
    g.applyMatrix4(m).translate(s > 0 ? xo : -half, 0, 0);
    p.add('solid', fixWinding(g), 'grey2');
  }
  // ribs round its outside, white as the bridge's hoops
  for (const z of [z0 + 0.32, z0 + 0.86]) {
    const a = z - 0.04, b = z + 0.04;
    for (const s of [-1, 1]) p.slab('white2', s > 0 ? xo : -xo - 0.04, s > 0 ? xo + 0.04 : -xo, y0 - 0.04, y1 + 0.04, a, b, { r: 0.008 });
    p.slab('white2', -xo, xo, y1, y1 + 0.04, a, b, { r: 0.008 }); p.slab('white2', -xo, xo, y0 - 0.04, y0, a, b, { r: 0.008 });
  }
  // THE SEAL: a black gasket all round where it meets the hull, and a dark band where it meets the plate
  const loop = [...edge.map(([z, y]) => [-xo - 0.012, y, z - 0.02]), ...edge.slice().reverse().map(([z, y]) => [xo + 0.012, y, z - 0.02])];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-3) continue;
    rod(p, 'black', a, b, 0.03, 8);
  }
  for (const s of [-1, 1]) p.slab('black', s > 0 ? xo : -xo - 0.03, s > 0 ? xo + 0.03 : -xo, y0 - 0.03, y1 + 0.03, z0 - 0.04, z0 + 0.04, { r: 0.006 });
  p.slab('black', -xo - 0.03, xo + 0.03, y1, y1 + 0.03, z0 - 0.04, z0 + 0.04, { r: 0.006 });
  // its light: a strip down the middle of its roof
  const zl = (z0 + T.face(roof)) / 2, len = T.face(roof) - z0 - 0.3;
  glow.glowSlab('strip', -0.07, 0.07, roof - 0.012, roof - 0.002, zl - len / 2, zl + len / 2);
  p.slab('black', -0.1, 0.1, roof - 0.004, roof, zl - len / 2 - 0.03, zl + len / 2 + 0.03, { r: 0.003 });
  return { solid: p, glow, lamp: [0, roof - 0.15, zl] };
}

// ── a piece into meshes ──────────────────────────────────────────────────────────────────────────────────────────
// light(p, n) -> [r, g, b]: the light reaching a point facing n (both THREE.Vector3, in the piece's frame), in the units
// of the kit's saved light (kit/materials.js aBake). Each material's parts merged into one mesh.
export function meshesOf(piece, mats, light) {
  const by = new Map();
  for (const { mat, geo } of piece.parts) { if (!by.has(mat)) by.set(mat, []); by.get(mat).push(geo); }
  const out = [], p = new THREE.Vector3(), n = new THREE.Vector3();
  for (const [mat, list] of by) {
    const g = list.length === 1 ? list[0] : mergeGeometries(list);
    if (!g) continue;
    if (mat === 'solid') {
      const N = g.attributes.position.count, ao = new Float32Array(N).fill(1), bk = new Float32Array(N * 3);
      for (let k = 0; k < N; k++) {
        p.fromBufferAttribute(g.attributes.position, k); n.fromBufferAttribute(g.attributes.normal, k);
        const c = light(p, n); bk[k * 3] = c[0]; bk[k * 3 + 1] = c[1]; bk[k * 3 + 2] = c[2];
      }
      g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1)); g.setAttribute('aBake', new THREE.BufferAttribute(bk, 3));
    }
    const m = new THREE.Mesh(g, mats[mat] || mats.solid); m.name = 'dock bridge: ' + mat;
    out.push(m);
  }
  return out;
}
