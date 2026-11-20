// THE CARGO CONTAINER: one box, one size, for every ship and dock that carries cargo. The Hauler holds eight of them in
// its clamp frames (hauler-built.js); the station's dock and its big transport are meant to use the same one.
// It is drawn about its own middle, its long way along z and its outer face toward +x, so whoever carries it places it
// by its middle (a mount's position) and slides or lifts it as one piece. Its outside is always the same frame (four
// corner posts, rails along every edge: what a clamp's jaws grip), so every look fits every clamp.
//   CONTAINER             its size: w across (x), h tall (y), l long (z), in metres; and the look drawn by default
//   LOOKS                 the looks to choose from (the game's maker picks): { name, about, draw }
//   COLOURS               the paints: each a body colour, a darker shade for the hollows, a darker one for the frame
//   containerInto(acc, look, colour, tf)   draws one into an accumulator; tf moves each point (to stand it somewhere)
//   containerLeaf(lp, look, colour)        draws one into a leaf's piece, about its own middle (a ship's mount)
//   cargoContainer(p, variant)             the catalog's piece: one standing on the floor; variant: a look's key
import * as THREE from 'three';
import { Acc } from '../shipparts/outside/facet.js';
import * as C from './built-common.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z), AX = [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)];
export const CONTAINER = { w: 1.2, h: 1.18, l: 2.94, look: 'ribbed' };
const X = CONTAINER.w / 2, Y = CONTAINER.h / 2, Z = CONTAINER.l / 2;

// ── the paints (sRGB; roughness, metalness, wear) ───────────────────────────────────────────────────────────────────
const s = (c, r = 0.62, m = 0.12, w = 0.8) => ({ c, r, m, w });
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const tone = (hex) => ({ body: s(hex), rib: s(shade(hex, 0.74)), frame: s(shade(hex, 0.5), 0.55, 0.3, 0.9), mark: s(shade(hex, 1.5)) });
export const COLOURS = { blue: tone('#3d6c99'), rust: tone('#a44a31'), yellow: tone('#d8a11d'), olive: tone('#6f7b46'), grey: tone('#858a91'), cream: tone('#cfc4ab') };
const DARK = s('#2c2f34', 0.5, 0.35, 0.8), STEEL = s('#767b82', 0.4, 0.6, 0.6), BLACK = s('#17191c', 0.45, 0.3, 0.5);

// ── a pen: boxes, flat faces and rows of ribs, each point moved by tf ───────────────────────────────────────────────
function pen(acc, tf) {
  const q = (pts, n, surf) => acc.poly(pts.map(tf), n, surf, 'solid', 99);
  const box = (c, h, surf, skip = [], ax = AX) => C.boxAt(acc, c, ax, h, surf, skip, tf);
  // ribs standing d out of a wall along N: they run along V (lv long), n of them spaced along U (over lu), from corner o
  const ribs = (o, U, V, N, lu, lv, n, d, surf) => {
    const pitch = lu / n, sl = pitch * 0.16, P = (u, v, h) => o.clone().addScaledVector(U, u).addScaledVector(V, v).addScaledVector(N, h);
    for (let i = 0; i < n; i++) {
      const u0 = (i + 0.2) * pitch, u1 = (i + 0.8) * pitch;
      q([P(u0 + sl, 0, d), P(u1 - sl, 0, d), P(u1 - sl, lv, d), P(u0 + sl, lv, d)], N, surf);
      q([P(u0, 0, 0), P(u0 + sl, 0, d), P(u0 + sl, lv, d), P(u0, lv, 0)], N.clone().multiplyScalar(sl).addScaledVector(U, -d).normalize(), surf);
      q([P(u1 - sl, 0, d), P(u1, 0, 0), P(u1, lv, 0), P(u1 - sl, lv, d)], N.clone().multiplyScalar(sl).addScaledVector(U, d).normalize(), surf);
    }
  };
  return { q, box, ribs };
}
// the frame every look shares: four corner posts and a rail along every edge, t thick
function frame(P, surf, t) {
  for (const sx of [1, -1]) for (const sz of [1, -1]) P.box(V3(sx * (X - t / 2), 0, sz * (Z - t / 2)), [t / 2, Y, t / 2], surf);
  for (const sx of [1, -1]) for (const sy of [1, -1]) P.box(V3(sx * (X - t / 2), sy * (Y - t / 2), 0), [t / 2, t / 2, Z - t], surf, ['w+', 'w-']);
  for (const sz of [1, -1]) for (const sy of [1, -1]) P.box(V3(0, sy * (Y - t / 2), sz * (Z - t / 2)), [X - t, t / 2, t / 2], surf, ['u+', 'u-']);
}
// a flat wall inside the frame: on a side (x), the top or bottom (y) or an end (z), i in from the frame's face
function wall(P, axis, sgn, i, t, surf) {
  const a = X - t, b = Y - t, c = Z - t;
  if (axis === 'x') P.q([V3(sgn * (X - i), -b, -c), V3(sgn * (X - i), -b, c), V3(sgn * (X - i), b, c), V3(sgn * (X - i), b, -c)], V3(sgn, 0, 0), surf);
  if (axis === 'y') P.q([V3(-a, sgn * (Y - i), -c), V3(a, sgn * (Y - i), -c), V3(a, sgn * (Y - i), c), V3(-a, sgn * (Y - i), c)], V3(0, sgn, 0), surf);
  if (axis === 'z') P.q([V3(-a, -b, sgn * (Z - i)), V3(a, -b, sgn * (Z - i)), V3(a, b, sgn * (Z - i)), V3(-a, b, sgn * (Z - i))], V3(0, 0, sgn), surf);
}

// ── THE LOOKS ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const LOOKS = {
  // 1. his picture's: a painted steel box, its sides and top pressed into ribs, doors with locking bars on one end
  ribbed: {
    name: 'Ribbed steel', about: 'His picture\'s box: sides and top pressed into ribs, a frame in a darker shade of the same paint, two doors with locking bars on one end.',
    draw(P, T) {
      const t = 0.08, i = 0.036, d = 0.026;
      frame(P, T.frame, t);
      for (const sx of [1, -1]) { wall(P, 'x', sx, i, t, T.rib); P.ribs(V3(sx * (X - i), -Y + t, -Z + t), V3(0, 0, 1), V3(0, 1, 0), V3(sx, 0, 0), 2 * (Z - t), 2 * (Y - t), 14, d, T.body); }
      wall(P, 'y', 1, i, t, T.rib); P.ribs(V3(-X + t, Y - i, -Z + t), V3(0, 0, 1), V3(1, 0, 0), V3(0, 1, 0), 2 * (Z - t), 2 * (X - t), 14, d, T.body);
      wall(P, 'y', -1, 0.02, t, T.frame);
      // (the door end: two leaves, the seam between them, four locking bars and their handles)
      wall(P, 'z', 1, i, t, T.body);
      P.box(V3(0, 0, Z - i + 0.004), [0.008, Y - t, 0.004], T.frame, ['w-', 'v+', 'v-']);
      for (const x of [-0.42, -0.15, 0.15, 0.42]) P.box(V3(x, 0, Z - i + 0.012), [0.014, Y - t, 0.012], STEEL, ['w-', 'v+', 'v-']);
      for (const x of [-0.24, 0.24]) P.box(V3(x, -0.1, Z - i + 0.022), [0.1, 0.016, 0.008], STEEL, ['w-']);
      // (the far end: ribs across)
      wall(P, 'z', -1, i, t, T.rib); P.ribs(V3(-X + t, -Y + t, -Z + i), V3(0, 1, 0), V3(1, 0, 0), V3(0, 0, -1), 2 * (Y - t), 2 * (X - t), 5, d, T.body);
    },
  },
  // 2. flat plates in a graphite frame, a pale band along each side to carry a label, a hatch on one end
  panelled: {
    name: 'Flat panels', about: 'Smooth painted plates in a graphite frame, a pale band along each side for a label, a square hatch on one end.',
    draw(P, T) {
      const t = 0.07, i = 0.02;
      frame(P, DARK, t);
      for (const sx of [1, -1]) {
        wall(P, 'x', sx, i, t, T.body);
        for (const z of [-Z / 3, Z / 3]) P.box(V3(sx * (X - i), 0, z), [0.012, Y - t, 0.025], T.rib, [sx > 0 ? 'u-' : 'u+', 'v+', 'v-']);
        for (const [z0, z1] of [[-Z + t + 0.06, -Z / 3 - 0.06], [-Z / 3 + 0.06, Z / 3 - 0.06], [Z / 3 + 0.06, Z - t - 0.06]]) P.q([V3(sx * (X - i + 0.004), 0.12, z0), V3(sx * (X - i + 0.004), 0.12, z1), V3(sx * (X - i + 0.004), 0.3, z1), V3(sx * (X - i + 0.004), 0.3, z0)], V3(sx, 0, 0), T.mark);
        P.q([V3(sx * (X - i + 0.004), -0.36, Z - t - 0.36), V3(sx * (X - i + 0.004), -0.36, Z - t - 0.1), V3(sx * (X - i + 0.004), -0.18, Z - t - 0.1), V3(sx * (X - i + 0.004), -0.18, Z - t - 0.36)], V3(sx, 0, 0), BLACK);
      }
      wall(P, 'y', 1, i, t, T.body);
      for (const z of [-Z / 3, Z / 3]) P.box(V3(0, Y - i, z), [X - t, 0.012, 0.025], T.rib, ['v-', 'u+', 'u-']);
      wall(P, 'y', -1, 0.02, t, DARK);
      for (const sz of [1, -1]) wall(P, 'z', sz, i, t, T.body);
      P.box(V3(0, 0, Z - i + 0.012), [0.3, 0.34, 0.012], T.rib, ['w-']);
      P.box(V3(0.2, 0, Z - i + 0.036), [0.016, 0.12, 0.012], STEEL, ['w-']);
    },
  },
  // 3. a coloured tank box hung inside an open graphite frame with slanted braces: the frame takes the knocks
  braced: {
    name: 'Braced frame', about: 'A coloured box set back inside an open graphite frame, a post and two slanted braces on each side: the frame takes the knocks.',
    draw(P, T) {
      const t = 0.09, i = 0.085, bz = (Z - t) / 2, by = Y - t, len = Math.hypot(bz, by), ang = Math.atan2(by, bz);
      frame(P, DARK, t);
      P.box(V3(0, 0, 0), [X - i, Y - 0.04, Z - i], T.body, ['v-']);
      wall(P, 'y', -1, 0.02, t, DARK);
      for (const sx of [1, -1]) {
        P.box(V3(sx * (X - 0.035), 0, 0), [0.035, Y - t, 0.04], DARK, [sx > 0 ? 'u-' : 'u+', 'v+', 'v-']);
        for (const sz of [1, -1]) {
          const u = V3(0, Math.sin(ang), sz * Math.cos(ang)), v = V3(0, Math.cos(ang), -sz * Math.sin(ang));
          P.box(V3(sx * (X - 0.03), 0, sz * (bz + 0.02)), [0.03, len - 0.06, 0.032], DARK, ['v+', 'v-', sx > 0 ? 'u-' : 'u+'], [V3(1, 0, 0), u, v]);
        }
        P.q([V3(sx * (X - i + 0.004), 0.1, -0.5), V3(sx * (X - i + 0.004), 0.1, 0.5), V3(sx * (X - i + 0.004), 0.26, 0.5), V3(sx * (X - i + 0.004), 0.26, -0.5)], V3(sx, 0, 0), T.mark);
      }
      for (const z of [-Z / 3, Z / 3]) P.box(V3(0, Y - 0.03, z), [X - t, 0.03, 0.035], DARK, ['v-', 'u+', 'u-']);
      P.box(V3(0, 0, Z - i + 0.012), [0.28, 0.3, 0.012], T.rib, ['w-']);
      P.box(V3(0, 0, Z - i + 0.034), [0.1, 0.016, 0.01], STEEL, ['w-']);
    },
  },
  // 4. a bulk pod: an eight-sided tank with hoops, carried in the same frame; for ore, gas or water
  tank: {
    name: 'Bulk tank', about: 'An eight-sided tank with three hoops, carried in the same frame: for ore, gas or water. A round hatch on each end.',
    draw(P, T) {
      const t = 0.07, a = X - 0.06, b = Y - 0.06, ch = 0.3, z0 = -Z + 0.1, z1 = Z - 0.1;
      frame(P, DARK, t);
      const oct = (k) => [[a * k, -(b - ch) * k], [a * k, (b - ch) * k], [(a - ch) * k, b * k], [-(a - ch) * k, b * k], [-a * k, (b - ch) * k], [-a * k, -(b - ch) * k], [-(a - ch) * k, -b * k], [(a - ch) * k, -b * k]];
      const O = oct(1), hoop = oct(1.045);
      O.forEach((p0, j) => {
        const p1 = O[(j + 1) % 8], n = V3(p1[1] - p0[1], -(p1[0] - p0[0]), 0).normalize();
        P.q([V3(p0[0], p0[1], z0), V3(p1[0], p1[1], z0), V3(p1[0], p1[1], z1), V3(p0[0], p0[1], z1)], n, T.body);
        for (const zc of [-Z * 0.6, 0, Z * 0.6]) {
          const h0 = hoop[j], h1 = hoop[(j + 1) % 8], za = zc - 0.05, zb = zc + 0.05;
          P.q([V3(h0[0], h0[1], za), V3(h1[0], h1[1], za), V3(h1[0], h1[1], zb), V3(h0[0], h0[1], zb)], n, T.frame);
          P.q([V3(p0[0], p0[1], za), V3(p1[0], p1[1], za), V3(h1[0], h1[1], za), V3(h0[0], h0[1], za)], V3(0, 0, -1), T.frame);
          P.q([V3(p0[0], p0[1], zb), V3(p1[0], p1[1], zb), V3(h1[0], h1[1], zb), V3(h0[0], h0[1], zb)], V3(0, 0, 1), T.frame);
        }
      });
      for (const sz of [1, -1]) {
        const ze = sz > 0 ? z1 : z0;
        P.q(O.map((q) => V3(q[0], q[1], ze)), V3(0, 0, sz), T.rib);
        P.q(oct(0.42).map((q) => V3(q[0], q[1], ze + sz * 0.02)), V3(0, 0, sz), STEEL);
        P.box(V3(0, 0, ze + sz * 0.03), [0.14, 0.016, 0.012], BLACK, [sz > 0 ? 'w-' : 'w+']);
      }
      wall(P, 'y', -1, 0.02, t, DARK);
    },
  },
};

// ── drawing one ─────────────────────────────────────────────────────────────────────────────────────────────────────
const same = (v) => v;
export function containerInto(acc, look = CONTAINER.look, colour = 'blue', tf = same) {
  (LOOKS[look] || LOOKS[CONTAINER.look]).draw(pen(acc, tf), COLOURS[colour] || COLOURS.blue);
  return acc;
}
export function containerLeaf(lp, look, colour) { containerInto(new Acc(), look, colour).flush(lp); return lp; }
// the catalog's piece: one standing on the floor (its middle over the origin); its variant a look's key, or
// 'look:colour'
export function cargoContainer(p, variant = CONTAINER.look) {
  const [look, colour = 'blue'] = String(variant).split(':');
  containerInto(new Acc(), look, colour, (v) => V3(v.x, v.y + Y, v.z)).flush(p);
  return p;
}
