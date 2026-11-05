// WINGS AND FINS, from the game's maker's pictures: flat off-white planforms with chamfered faceted edges, dark
// leading edges, a yellow stripe near the tip and a light at the tip. Drawn for the +x side; the other side is the
// same part placed with a negative x scale (place.js mirrors it), with its own light colour.
//
//   wing(p, { root, tip, span, sweep, thick, stripe, light })
//       Frame: the root at x = 0 (against the hull), the root chord's middle at z = 0, the wing's underside at y = 0,
//       the span along +x. root 2.6 (the chord at the root, metres), tip 0.9, span 3.2, sweep 2.0 (how far back the
//       tip's leading edge is from the root's), thick 0.22 (at the root; the tip is half that), stripe 'yellow' (a
//       band across near the tip; 'red', or null), light 'red' (a nav light at the tip: red on the +x side, the ship's port; its mirrored copy 'green'; 'white' or null).
//   stubWing(p, opts)   a short thick wing (his medic's small swept fins): root 1.9, tip 0.9, span 1.2, sweep 1.0,
//                       thick 0.3, and a hard point under its tip
//   tailFin(p, opts)    a fin standing up: the same, with its span up +y and its root on y = 0; root 2.0, tip 0.9,
//                       span 1.0 (keep a ship under 5.3 m: the hangar's 5.6 m door with 0.3 m to spare), sweep 1.0,
//                       thick 0.18, light 'white'
import * as THREE from 'three';
import { SHIP, GLOW_SHIP } from '../palette.js';
import { GLOW } from '../../materials.js';
import { Acc, facet } from './facet.js';
import { box } from './shapes.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const STRIPES = { yellow: SHIP.yellow, red: SHIP.red, teal: SHIP.teal };
// the wing's solid: at each end (root x = 0, tip x = span) a flat-bottomed faceted section: the leading edge (a short
// dark nose), a ridge 40% back, the trailing edge; facets between the two ends; bands across the span painted
function planform(acc, o) {
  const c0 = o.root, c1 = o.tip, S = o.span, sw = o.sweep, t0 = o.thick, t1 = t0 * 0.5;
  const sec = (x, le, c, t) => ({ le: v(x, t * 0.25, le), leT: v(x, t * 0.7, le - c * 0.08), rid: v(x, t, le - c * 0.4), te: v(x, t * 0.3, le - c), teB: v(x, 0, le - c * 0.97), leB: v(x, 0, le - c * 0.05) });
  const at = (f) => { const x = S * f, le = c0 / 2 - sw * f, c = c0 + (c1 - c0) * f, t = t0 + (t1 - t0) * f; return sec(x, le, c, t); };
  const stripe = STRIPES[o.stripe] ? [0.7, 0.8] : null, cuts = [0, ...(stripe || []), 1];
  const look = (s) => ({ paint: s, inner: false });
  for (let i = 0; i < cuts.length - 1; i++) {
    const A = at(cuts[i]), B = at(cuts[i + 1]), band = stripe && i === 1 ? STRIPES[o.stripe] : SHIP.hull;
    facet(acc, [A.leT, B.leT, B.rid, A.rid], v(0, 1, 0.25), look(band));            // the top, front of the ridge
    facet(acc, [A.rid, B.rid, B.te, A.te], v(0, 1, -0.15), look(band));             // behind it
    facet(acc, [A.le, B.le, B.leT, A.leT], v(0, 0.5, 1), look(SHIP.trim));           // the leading edge, dark
    facet(acc, [A.leB, B.leB, B.le, A.le], v(0, -0.6, 1), look(SHIP.trim));
    facet(acc, [A.te, B.te, B.teB, A.teB], v(0, 0.2, -1), look(SHIP.trim));          // the trailing edge
    facet(acc, [A.leB, B.leB, B.teB, A.teB], v(0, -1, 0), look(SHIP.hull2));         // the underside
  }
  // the ends: the root (against the hull) and the tip
  for (const [f, out] of [[0, v(-1, 0, 0)], [1, v(1, 0, 0)]]) { const E = at(f); facet(acc, [E.leB, E.le, E.leT, E.rid, E.te, E.teB], out, look(f ? SHIP.trim : SHIP.hull2)); }
  return at;
}
function tipLight(p, acc, o, E) {
  if (!o.light) return;
  const col = GLOW[o.light] || GLOW.white, x = E.rid.x, z = (E.le.z + E.te.z) / 2, y = E.rid.y * 0.6;
  box(acc, SHIP.trim, [x - 0.02, x + 0.07], [y - 0.06, y + 0.06], [z - 0.2, z + 0.14]);
  box(acc, col, [x + 0.07, x + 0.085], [y - 0.035, y + 0.035], [z - 0.14, z + 0.08], 'glow');
  p.light([x + 0.3, y, z], 0.25, col.map((c) => Math.min(1.4, c / 4)), [1, 0, 0], 2);
}
export function wing(p, o = {}) {
  o = { root: 2.6, tip: 0.9, span: 3.2, sweep: 2.0, thick: 0.22, stripe: 'yellow', light: 'red', ...o };
  const acc = new Acc(), at = planform(acc, o);
  tipLight(p, acc, o, at(1));
  return acc.flush(p);
}
export function stubWing(p, o = {}) {
  o = { root: 1.9, tip: 0.9, span: 1.2, sweep: 1.0, thick: 0.3, stripe: 'yellow', light: null, ...o };
  const acc = new Acc(), at = planform(acc, o), E = at(0.85), z = (E.le.z + E.te.z) / 2;
  // a hard point under its outer end
  box(acc, SHIP.trim, [E.rid.x - 0.12, E.rid.x + 0.12], [-0.16, 0], [z - 0.35, z + 0.25]);
  box(acc, SHIP.gun, [E.rid.x - 0.08, E.rid.x + 0.08], [-0.2, -0.16], [z - 0.25, z + 0.15]);
  tipLight(p, acc, o, at(1));
  return acc.flush(p);
}
export function tailFin(p, o = {}) {
  o = { root: 2.0, tip: 0.9, span: 1.0, sweep: 1.0, thick: 0.18, stripe: 'yellow', light: 'white', ...o };
  const q = new (p.constructor)(); wing(q, o);
  // (the wing turned up: its span along +y, its underside facing -x, its middle on x = 0)
  const M = new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(o.thick * 0.5, 0, 0));
  for (const part of q.parts) { part.geo.applyMatrix4(M); p.parts.push(part); }
  for (const L of q.lights) p.lights.push({ ...L, at: new THREE.Vector3(...L.at).applyMatrix4(M).toArray(), dir: L.dir && new THREE.Vector3(...L.dir).transformDirection(M).toArray() });
  return p;
}
void GLOW_SHIP;
