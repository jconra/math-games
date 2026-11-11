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
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { circle, cylinder, lathe, sweep, MeshData } from '../../geo.js';
import { lean } from './galley.js';
import { SCREEN_RECT } from '../../tex.js';

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
    p.add('glow', cylinder(0.07, 0.01, [0, top + 0.006, 0], 20), [0.3, 1.0, 2.6]);
    p.add('solid', sweep(circle(0.012, 8), ring(0.085, top + 0.008, 20), { closed: true }), 'gun');
  } else {
  // the pedestal and the top
  p.lathe('black', [[0.001, 0], [0.26, 0], [0.27, 0.025], [0.24, 0.05], [0.09, 0.09], [0.075, top - 0.2], [R * 0.7, top - 0.07], [R - 0.01, top - 0.045], [0.001, top - 0.045]], 28);
  p.lathe('black', [[0.001, top - 0.045], [R - 0.01, top - 0.045], [R, top - 0.03], [R, top - 0.01], [R - 0.012, top], [0.001, top]], 32);
  p.cyl('dark', R - 0.04, 0.008, [0, top + 0.002, 0], null, 32);
  p.add('glow', sweep(circle(0.007, 6), ring(R - 0.022, top + 0.003), { closed: true }), BLUE);
  p.add('glow', cylinder(0.07, 0.01, [0, top + 0.006, 0], 20), [0.3, 1.0, 2.6]);
  p.add('solid', sweep(circle(0.012, 8), ring(0.085, top + 0.008, 20), { closed: true }), 'gun');
  }
  // the cone of light up from the lens to the hologram (bright at its two ends, see-through between)
  // (its uv runs from near the sheet's edge at the lens, 0.14, to its middle at the top, 0.5: the shield light is bright at its
  // edges, so the cone glows at the lens and fades out upward)
  const y0 = top + 0.01, y1 = top + 0.2, cone = lathe([[0.07, y0], [S * 0.45, y1]], 24);
  { const uv = cone.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, cone.attributes.position.getY(i) < (y0 + y1) / 2 ? 0.14 : 0.5); }
  p.add('shield', cone);
  if (show === 'planet') {
    const g = mergeVertices(new THREE.IcosahedronGeometry(S * 0.32, 3).deleteAttribute('normal').deleteAttribute('uv'), 1e-5); g.computeVertexNormals();
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2).fill(0.5), 2)); g.translate(0, top + 0.26 + S * 0.32, 0);
    p.add('shield', g);
    p.add('glow', sweep(circle(0.003, 4), ring(S * 0.32 * 0.98, 0, 40), { closed: true }).rotateX(0.35).translate(0, top + 0.26 + S * 0.32, 0), BLUE2);
    const orbit = sweep(circle(0.0035, 4), ring(S * 0.5, 0, 48), { closed: true }); orbit.rotateZ(0.28).rotateX(0.12).translate(0, top + 0.26 + S * 0.32, 0); p.add('glow', orbit, BLUE);
    const moon = new THREE.IcosahedronGeometry(0.025, 1); const mm = mergeVertices(moon.deleteAttribute('uv'), 1e-5); mm.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(mm.attributes.position.count * 2), 2)); mm.translate(S * 0.5 * Math.cos(0.6), top + 0.26 + S * 0.32 + 0.07, S * 0.5 * Math.sin(0.6)); p.add('glow', mm, BLUE);
  } else {
    // the terrain: a faint patch of hills in the shield light (its uv held in the middle of the sheet: the shield light
    // is bright at its sheet's edges, and a wavy sheet seen edge-on then piles that up into a white blur), and a grid of
    // glowing lines over it, one way and the other, a brighter one through the middle
    const n = 16, m = new MeshData(), hy = top + 0.22, amp = S * 0.32;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const u = i / n * 2 - 1, v = j / n * 2 - 1; m.v(u * S / 2, hy + hill(u, v) * amp, v * S / 2, 0, 1, 0, 0.5, 0.5); }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; m.quad(a, a + n + 1, a + n + 2, a + 1); }
    const g = m.geometry(); g.computeVertexNormals(); p.add('shield', g);
    const at = (u, v) => v3(u * S / 2, hy + hill(u, v) * amp + 0.002, v * S / 2);
    for (let k = 0; k <= 8; k++) {
      const t = k / 8 * 2 - 1, A = [], B = [];
      for (let i = 0; i <= 24; i++) { const s2 = i / 24 * 2 - 1; A.push({ p: at(s2, t), x: v3(0, 0, 1), y: v3(0, 1, 0) }); B.push({ p: at(t, s2), x: v3(1, 0, 0), y: v3(0, 1, 0) }); }
      for (const L of [A, B]) p.add('glow', sweep(circle(0.0018, 3), L), k === 4 ? BLUE : BLUE2);
    }
  }
  p.light([0, top + 0.35, 0], 0.9, [0.4, 0.7, 1], null, 3);
}
