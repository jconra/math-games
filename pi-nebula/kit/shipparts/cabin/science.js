// THE SCIENCE AREA: the holo table: round (the sheet's), or a console island (the game's maker's science-lab picture). A charcoal pedestal, a dark top ringed in blue light with a lens in its
// middle, and above it a hologram in the station's shield light (the hangar door's see-through blue, kit/materials.js):
// a patch of terrain with glowing contour lines over it ('terrain'), or a planet with a ring of light round it
// ('planet'), in a faint cone of light up from the lens.
//   holoTable(p, o)
//     o.r 0.35       the top's radius (the sheet's table is 0.7 m round)
//     o.top 0.9      the top's height (a table to stand round)
//     o.show 'terrain'   or 'planet'
//     o.size 0.5     the hologram's size across
//     o.form 'round' or 'console': a waist-high block, o.w x o.d (1.4 x 0.9), off-white with a charcoal top, a dark
//                    glass top inset ringed in blue light, a row of screens down its front edge
// Frame: free-standing, centred on the origin, on the deck (y = 0).
//   holoLens(p, o)   the lens it rises from, set into a top: o.top (the top's height, 0), o.k (every length times k, 1),
//                    o.tilt (radians: a top that rises away from +z, the lens lying on it; 0)
//   holoLight(p, o)  the cone of light up from the lens and the hologram over it: o.top, o.show, o.size, o.k as above;
//                    o.turn (true: the planet turns slowly about its upright middle line, kit/materials.js SPIN);
//                    o.foot (the cone's foot's radius: 0.07 k, the lens's glow); o.lift (the cone and the gap over it
//                    times this: 1); o.facets (true: the planet low-poly, below)
// The table is these two on its top; one is set into a ship's dashboard before the other seat (the game's maker,
// DASH3-2: "something in front of the co-pilot too. Like the low-poly planet or something": the cockpit's consoles.js,
// its place and size bank.js holoOf), every length times o.k, turning, its planet low-poly.
// THE PLANET LOW-POLY (o.facets): an icosahedron split once, 80 flat facets, each dark, sea or land (a fixed pattern),
// lit from one side, its edges light lines (the space game's screens' own look: dark glass, light lines); in place of
// the table's see-through sphere and the ring round its middle (its edges show its round). Its moon on its orbit as the
// table's.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { circle, cylinder, lathe, sweep, MeshData } from '../../geo.js';
import { lean } from './galley.js';
import { SCREEN_RECT } from '../../tex.js';
import { SPIN } from '../../materials.js';

const PI = Math.PI;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const BLUE = [0.9, 2.6, 6.0], BLUE2 = [0.5, 1.6, 4.0];
const ring = (r, y, n = 32) => Array.from({ length: n }, (_, i) => { const a = i / n * PI * 2, c = Math.cos(a), s = Math.sin(a); return { p: v3(c * r, y, s * r), x: v3(c, 0, s), y: v3(0, 1, 0) }; });
// the terrain's height at (u, v), both -1..1: a ridge, a valley, a peak, fading to the patch's edges
const hill = (u, v) => (0.55 * Math.exp(-((u + 0.3) ** 2 + (v - 0.2) ** 2) * 4) + 0.35 * Math.exp(-((u - 0.45) ** 2 + (v + 0.35) ** 2) * 6) + 0.18 * Math.sin(u * 4.5 + v * 2) * 0.5) * (1 - 0.6 * Math.max(Math.abs(u), Math.abs(v)) ** 4);

export function holoTable(p, o = {}) {
  p = lean(p);
  const R = o.r ?? 0.35, top = o.top ?? 0.9, show = o.show ?? 'terrain', S = o.size ?? (o.form === 'console' ? 0.8 : 0.5);
  if (o.form === 'console') {
    // a block to stand round: a dark plinth, off-white sides, a charcoal top with a glass inset ringed in blue light
    const w = o.w ?? 1.4, d = o.d ?? 0.9, hw = w / 2, hd = d / 2;
    p.slab('dark', -hw + 0.04, hw - 0.04, 0, 0.1, -hd + 0.04, hd - 0.04, { r: 0.01 });
    p.slab('white', -hw, hw, 0.1, top - 0.05, -hd, hd, { r: 0.02, cell: 0.6 });
    p.slab('band', -hw - 0.002, hw + 0.002, 0.55, 0.65, -hd - 0.002, hd + 0.002, { r: 0.006 });
    p.slab('black', -hw - 0.02, hw + 0.02, top - 0.05, top, -hd - 0.02, hd + 0.02, { r: 0.015 });
    p.slab('dark', -hw + 0.06, hw - 0.06, top, top + 0.004, -hd + 0.06, hd - 0.06, { r: 0 });
    for (const [x0, x1, z0, z1] of [[-hw + 0.04, hw - 0.04, -hd + 0.04, -hd + 0.05], [-hw + 0.04, hw - 0.04, hd - 0.05, hd - 0.04], [-hw + 0.04, -hw + 0.05, -hd + 0.05, hd - 0.05], [hw - 0.05, hw - 0.04, -hd + 0.05, hd - 0.05]]) p.glowSlab(BLUE, x0, x1, top, top + 0.006, z0, z1);
    // screens along its front, under the top's lip, in charcoal bezels
    for (const [x, sc] of [[-hw * 0.5, 'radar'], [hw * 0.5, 'status']]) { p.slab('black', x - 0.2, x + 0.2, top - 0.3, top - 0.08, hd, hd + 0.012, { r: 0.006 }); p.screen(SCREEN_RECT[sc], 0.36, 0.18, [x, top - 0.19, hd + 0.013], null, 1.1); }
    // the lens in the middle of the top, where the hologram rises from
    holoLens(p, { top });
  } else {
  // the pedestal and the top
  p.lathe('black', [[0.001, 0], [0.26, 0], [0.27, 0.025], [0.24, 0.05], [0.09, 0.09], [0.075, top - 0.2], [R * 0.7, top - 0.07], [R - 0.01, top - 0.045], [0.001, top - 0.045]], 28);
  p.lathe('black', [[0.001, top - 0.045], [R - 0.01, top - 0.045], [R, top - 0.03], [R, top - 0.01], [R - 0.012, top], [0.001, top]], 32);
  p.cyl('dark', R - 0.04, 0.008, [0, top + 0.002, 0], null, 32);
  p.add('glow', sweep(circle(0.007, 6), ring(R - 0.022, top + 0.003), { closed: true }), BLUE);
  holoLens(p, { top });
  }
  holoLight(p, { top, show, size: S });
}
export function holoLens(p, o = {}) {
  const top = o.top ?? 0, k = o.k ?? 1, tilt = o.tilt || 0;
  const disc = cylinder(0.07 * k, 0.01 * k, [0, top + 0.006 * k, 0], 20), rim = sweep(circle(0.012 * k, 8), ring(0.085 * k, top + 0.008 * k, 20), { closed: true });
  // (on a sloping top: lying on it, turned about its middle)
  if (tilt) for (const g of [disc, rim]) g.translate(0, -top, 0).rotateX(tilt).translate(0, top, 0);
  p.add('glow', disc, [0.3, 1.0, 2.6]);
  p.add('solid', rim, 'gun');
  return p;
}
// (a part of a hologram that turns, kit/materials.js SPIN: in its uv the mark and how far each corner is from the
// hologram's middle c, in its normal the way out from c to it)
function spinning(g, c) {
  const P = g.attributes.position, N = g.attributes.normal, T = g.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const dx = P.getX(i) - c[0], dy = P.getY(i) - c[1], dz = P.getZ(i) - c[2], d = Math.hypot(dx, dy, dz);
    if (d > 1e-9) N.setXYZ(i, dx / d, dy / d, dz / d); else N.setXYZ(i, 0, 1, 0);
    T.setXY(i, SPIN.mark, d);
  }
  return g;
}
// (the low-poly planet: its facets' tones, linear, dark enough not to bloom; which facets are land, from the way out to
// the facet's middle; the side the light comes from, in the planet's own frame)
const FACET = { sea: [0.014, 0.05, 0.13], land: [0.05, 0.17, 0.27], edge: [0.3, 1.0, 2.4], light: [-0.45, 0.6, 0.66] };
const isLand = (d) => Math.sin(3.1 * d[0] + 1.3) + Math.sin(2.3 * d[1] + 0.4) + Math.sin(2.7 * d[2] + 2.1) > 0.75;
function lowPoly(p, r, c, k, turn) {
  const ico = new THREE.IcosahedronGeometry(1, 1), P = ico.attributes.position, n = P.count, L = FACET.light, ll = Math.hypot(...L);
  const m = new MeshData(), edges = new Map(), cols = [];
  for (let f = 0; f < n; f += 3) {
    const v = [0, 1, 2].map((j) => [P.getX(f + j), P.getY(f + j), P.getZ(f + j)]), mid3 = [0, 1, 2].map((a) => (v[0][a] + v[1][a] + v[2][a]) / 3), ml = Math.hypot(...mid3), d = mid3.map((a) => a / ml);
    const lit = 0.45 + 0.55 * Math.max(0, (d[0] * L[0] + d[1] * L[1] + d[2] * L[2]) / ll), tone = (isLand(d) ? FACET.land : FACET.sea).map((a) => a * lit);
    for (const q of v) { m.v(c[0] + q[0] * r, c[1] + q[1] * r, c[2] + q[2] * r, d[0], d[1], d[2], 0, 0); cols.push(tone); }
    m.ix.push(f, f + 1, f + 2);
    for (let j = 0; j < 3; j++) { const a = v[j], e = v[(j + 1) % 3], key = [a, e].map((q) => q.map((x) => x.toFixed(4)).join(',')).sort().join('|'); if (!edges.has(key)) edges.set(key, [a, e]); }
  }
  // (each facet its own tone: given after the piece has filled the glow's one colour in)
  const G = p.add('glow', m.geometry(), FACET.sea), C = G.attributes.color;
  for (let i = 0; i < n; i++) C.setXYZ(i, ...cols[i]);
  turn(G, c);
  // its edges, a little out from the facets
  const tubes = [];
  for (const [a, e] of edges.values()) {
    const A = v3(...a).multiplyScalar(r * 1.004).add(v3(...c)), E = v3(...e).multiplyScalar(r * 1.004).add(v3(...c)), t = E.clone().sub(A).normalize();
    const x = new THREE.Vector3().crossVectors(t, Math.abs(t.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0)).normalize(), y = new THREE.Vector3().crossVectors(t, x);
    tubes.push(sweep(circle(0.003 * k, 4), [{ p: A, x, y }, { p: E, x, y }]));
  }
  turn(p.add('glow', mergeGeometries(tubes, false), FACET.edge), c);
}
export function holoLight(p, o = {}) {
  const top = o.top ?? 0, show = o.show ?? 'terrain', S = o.size ?? 0.5, k = o.k ?? 1, lift = o.lift ?? 1, turn = o.turn ? spinning : (g) => g;
  // the cone of light up from the lens to the hologram (bright at its two ends, see-through between)
  // (its uv runs from near the sheet's edge at the lens, 0.14, to its middle at the top, 0.5: the shield light is bright at its
  // edges, so the cone glows at the lens and fades out upward)
  const y0 = top + 0.01 * k * lift, y1 = top + 0.2 * k * lift, cone = lathe([[o.foot ?? 0.07 * k, y0], [S * 0.45 * k, y1]], 24);
  { const uv = cone.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, cone.attributes.position.getY(i) < (y0 + y1) / 2 ? 0.14 : 0.5); }
  p.add('shield', cone);
  if (show === 'planet') {
    const mid = top + 0.26 * k * lift + S * 0.32 * k, c = [0, mid, 0];
    if (o.facets) lowPoly(p, S * 0.32 * k, c, k, turn);
    else {
    const g = mergeVertices(new THREE.IcosahedronGeometry(S * 0.32 * k, 3).deleteAttribute('normal').deleteAttribute('uv'), 1e-5); g.computeVertexNormals();
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2).fill(0.5), 2)); g.translate(0, mid, 0);
    turn(p.add('shield', g), c);
    turn(p.add('glow', sweep(circle(0.003 * k, 4), ring(S * 0.32 * k * 0.98, 0, 40), { closed: true }).rotateX(0.35).translate(0, mid, 0), BLUE2), c);
    }
    const orbit = sweep(circle(0.0035 * k, 4), ring(S * 0.5 * k, 0, 48), { closed: true }); orbit.rotateZ(0.28).rotateX(0.12).translate(0, mid, 0); turn(p.add('glow', orbit, BLUE), c);
    const moon = new THREE.IcosahedronGeometry(0.025 * k, 1); const mm = mergeVertices(moon.deleteAttribute('uv'), 1e-5); mm.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(mm.attributes.position.count * 2), 2)); mm.translate(S * 0.5 * k * Math.cos(0.6), mid + 0.07 * k, S * 0.5 * k * Math.sin(0.6)); turn(p.add('glow', mm, BLUE), c);
  } else {
    // the terrain: a faint patch of hills in the shield light (its uv held in the middle of the sheet: the shield light
    // is bright at its sheet's edges, and a wavy sheet seen edge-on then piles that up into a white blur), and a grid of
    // glowing lines over it, one way and the other, a brighter one through the middle
    const n = 16, m = new MeshData(), hy = top + 0.22 * k, amp = S * 0.32 * k, W = S * k;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const u = i / n * 2 - 1, v = j / n * 2 - 1; m.v(u * W / 2, hy + hill(u, v) * amp, v * W / 2, 0, 1, 0, 0.5, 0.5); }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; m.quad(a, a + n + 1, a + n + 2, a + 1); }
    const g = m.geometry(); g.computeVertexNormals(); p.add('shield', g);
    const at = (u, v) => v3(u * W / 2, hy + hill(u, v) * amp + 0.002 * k, v * W / 2);
    for (let q = 0; q <= 8; q++) {
      const t = q / 8 * 2 - 1, A = [], B = [];
      for (let i = 0; i <= 24; i++) { const s2 = i / 24 * 2 - 1; A.push({ p: at(s2, t), x: v3(0, 0, 1), y: v3(0, 1, 0) }); B.push({ p: at(t, s2), x: v3(1, 0, 0), y: v3(0, 1, 0) }); }
      for (const L of [A, B]) p.add('glow', sweep(circle(0.0018 * k, 3), L), q === 4 ? BLUE : BLUE2);
    }
  }
  p.light([0, top + 0.35 * k, 0], 0.9 * k, [0.4, 0.7, 1], null, 3 * k);
  return p;
}
