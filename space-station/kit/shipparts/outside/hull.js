// THE SHIP'S HULL, IN PIECES ON THE SHIP GRID (kit/grid.js SHIP_GRID: 0.5 m cells, 0.5 m steps up and down from the
// deck, which is 1.26 m off the ground). Like the station's walls and floors, each piece is drawn once and snapped into
// place by a ship's layout file ({ piece, cell, turn, level, variant }). Every corner of every piece is on the grid's
// lattice, so pieces meet edge to edge; the look is flat panels meeting at creases, as in the game's maker's pictures.
// Frame: a piece faces +z (outward) at turn 0, its origin on a lattice point (a cell edge or corner, at its level).
// Units below: n cells (0.5 m) across and along, n steps (0.5 m) up. A ratio a:b is a cells across to b steps up:
// 1:1 is 45 degrees, 1:2 steep (63 degrees), 2:1 shallow (27 degrees); any ratio up to 4:4 is a lattice slope too (2:2, a
// 45 degree chamfer a metre across).
//
//   hullPanel   a flat panel.  'xN' a run N cells wide (1, 2, 4), 'hN' N steps tall (vertical, facing +z, from y 0 up);
//               'roof xN dM' / 'belly xN dM' level, N cells along x by M along z, centred on the origin, facing up /
//               down; 'roof tri a:b' / 'belly tri a:b' a level right triangle, legs a along +x and b along -z
//   hullSlope   'up a:b xN' a slope from its outer edge (z 0, y 0) rising inward (to z -a, y +b), a run N cells along x;
//               'down a:b xN' falling inward (to z -a, y -b) (the lower chamfer)
//               'dslope up|down a:b plan c:d L|R' the same slope along a diagonal in plan (above an angled side)
//   hullAngle   'c:d hN L|R' a vertical side across a diagonal in plan: c cells along x by d along z, N steps tall
//   hullCorner  'hip up a:b[/e:f]' an outside corner where a slope facing +z (a:b) meets one facing +x (e:f, the same
//               rise); 'valley up ...' an inside corner; 'gable up a:b L|R' the triangle where a slope's end meets a flat
//               side (its tall edge at x 0); 'down' for any of them below (lower chamfers)
//   hullCap     'nose <section> <style>' / 'tail <section> <style>' the end of a hull of that section (SECTIONS): facets
//               stepping in to a flat end face; 'mouth WxH' cuts a ramp's mouth in a tail's end face
//   hullOpening 'door' (1.0 x 2.0 m, from the deck, in a panel 5 steps tall; 'h4' 4 steps), 'door x4' (in a 2 m panel), 'window x2' / 'window x4' (a band:
//               windows 0.8 x 0.34 m in 1 m and 2 m panels), 'porthole' (round, in one cell), 'mouth WxH' (the lining
//               and frame of a W cells by H steps hole left between panels: a ramp's mouth), 'hatch N' (a belly panel
//               with an N-cell square hatch: a belly lift's or an airlock's)
// Paint, on any of them (words after the shape): white (the default off-white), white2, grey, dark, yellow, red,
// teal; a stripe across the middle third: ystripe, rstripe, tstripe, dstripe; two slanting bars: yslash, rslash; a dark
// edge along its top and bottom: edged, or all round: framed; seam (a seam line where the run starts),
// seams (round it); glass (the facet is a window: dark glass in a frame); bare (no inside face).
// Each panel is a plate 6 cm thick: the outside painted, the inside the station's off-white (where no cabin wall
// covers it). Openings have a lining 0.3 m deep (the hull's depth) and a charcoal frame outside.
import * as THREE from 'three';
import { SHIP_GRID } from '../../grid.js';
import { SHIP, PAINTS, STRIPES, SLASHES } from '../palette.js';
import { Acc, facet, ringFrame, lining, orient, inset, rim, THICK, PANES } from './facet.js';
import { SECTIONS, CAP_STYLES, capRings } from './sections.js';
export { SECTIONS, CAP_STYLES };

const U = SHIP_GRID.cell, PI = Math.PI;
export const DEPTH = 0.3;   // an opening's lining: the hull's depth
const THICK_RIM = new THREE.Vector3(0, 0, 1);
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const u3 = (x, y, z) => v(x * U, y * U, z * U);   // a lattice point, in cells and steps

// ── reading a variant: its shape words, then its paint ──
export function parseLook(words) {
  const look = { paint: SHIP.hull, stripe: null, seams: null, glass: false, inner: true };
  const rest = [];
  for (const w of words) {
    if (PAINTS[w]) look.paint = PAINTS[w];
    else if (STRIPES[w]) look.stripe = STRIPES[w];
    else if (SLASHES[w]) look.slash = SLASHES[w];
    else if (w === 'edged') look.edged = true;
    else if (w === 'framed') look.framed = true;
    else if (w === 'seam') look.seams = 'left';
    else if (w === 'seams') look.seams = 'all';
    else if (w === 'glass') look.glass = true;
    else if (w === 'bare') look.inner = false;
    else rest.push(w);
  }
  return { look, rest };
}
const PAINT_WORDS = new Set([...Object.keys(PAINTS), ...Object.keys(STRIPES), ...Object.keys(SLASHES), 'edged', 'framed', 'seam', 'seams', 'glass', 'bare']);
const ratio = (s, d = [1, 1]) => { const m = /^(\d+):(\d+)$/.exec(s || ''); return m ? [+m[1], +m[2]] : d; };
const num = (words, k, d) => { const w = words.find((x) => new RegExp('^' + k + '\\d+$').test(x)); return w ? +w.slice(k.length) : d; };

// ── flat panels ──
export function hullPanel(p, variant = 'x1') {
  const { look, rest } = parseLook(variant.split(' ')), acc = new Acc(), w = num(rest, 'x', 1) * U;
  if (rest[0] === 'roof' || rest[0] === 'belly') {
    const up = rest[0] === 'roof' ? 1 : -1;
    if (rest[1] === 'tri') { const [a, b] = ratio(rest[2]); facet(acc, [u3(0, 0, 0), u3(a, 0, 0), u3(0, 0, -b)], v(0, up, 0), look); }
    else { const d = num(rest, 'd', 1) * U; facet(acc, [v(-w / 2, 0, -d / 2), v(w / 2, 0, -d / 2), v(w / 2, 0, d / 2), v(-w / 2, 0, d / 2)], v(0, up, 0), look); }
  } else {
    const h = num(rest, 'h', 1) * U;
    facet(acc, [v(-w / 2, 0, 0), v(w / 2, 0, 0), v(w / 2, h, 0), v(-w / 2, h, 0)], v(0, 0, 1), look);
  }
  return acc.flush(p);
}

// ── slopes ──
export function hullSlope(p, variant = 'up 1:1 x1') {
  const { look, rest } = parseLook(variant.split(' ')), acc = new Acc();
  if (rest[0] === 'dslope') {
    // along a diagonal in plan: the base from (-c/2, 0, d/2) to (c/2, 0, -d/2) (the top edge of the angled side with
    // the same c:d), the top edge that moved a cells in (-z) and b steps up or down
    const s = rest[1] === 'down' ? -1 : 1, [a, b] = ratio(rest[2]), pi = rest.indexOf('plan'), [c, d] = ratio(rest[pi + 1]), m = rest.includes('L') ? -1 : 1;
    const A = u3(-c / 2 * m, 0, d / 2), B = u3(c / 2 * m, 0, -d / 2), sh = u3(0, s * b, -a);
    const out = v(0, s * a, b).normalize().add(v(d * m, 0, c).normalize());
    facet(acc, [A, B, B.clone().add(sh), A.clone().add(sh)], out, look);
    return acc.flush(p);
  }
  const s = rest[0] === 'down' ? -1 : 1, [a, b] = ratio(rest[1]), w = num(rest, 'x', 1) * U;
  facet(acc, [v(-w / 2, 0, 0), v(w / 2, 0, 0), v(w / 2, s * b * U, -a * U), v(-w / 2, s * b * U, -a * U)], v(0, s * a, b), look);
  return acc.flush(p);
}

// ── a vertical side across a diagonal in plan ──
export function hullAngle(p, variant = '1:1 h1') {
  const { look, rest } = parseLook(variant.split(' ')), acc = new Acc(), [c, d] = ratio(rest[0]), h = num(rest, 'h', 1) * U, m = rest.includes('L') ? -1 : 1;
  const A = u3(-c / 2 * m, 0, d / 2), B = u3(c / 2 * m, 0, -d / 2);
  facet(acc, [A, B, B.clone().setY(h), A.clone().setY(h)], v(d * m, 0, c), look);
  return acc.flush(p);
}

// ── corners: where two slopes meet (hip, valley), where a slope's end meets a flat side (gable) ──
export function hullCorner(p, variant = 'hip up 1:1') {
  const { look, rest } = parseLook(variant.split(' ')), acc = new Acc(), kind = rest[0], s = rest[1] === 'down' ? -1 : 1;
  const [rz, rx] = (rest[2] || '1:1').split('/'), [az, b] = ratio(rz), [ax, b2] = ratio(rx || rz);
  if (b2 !== b) throw new Error('kit: a corner\'s two slopes must rise the same (' + variant + ')');
  const outZ = v(0, s * az, b), outX = v(b, s * ax, 0);
  if (kind === 'hip') {
    facet(acc, [u3(-ax, 0, 0), u3(0, 0, 0), u3(-ax, s * b, -az)], outZ, look);
    facet(acc, [u3(0, 0, 0), u3(0, 0, -az), u3(-ax, s * b, -az)], outX, look);
  } else if (kind === 'valley') {
    facet(acc, [u3(0, 0, 0), u3(-ax, s * b, 0), u3(-ax, s * b, -az)], outX, look);
    facet(acc, [u3(0, 0, 0), u3(-ax, s * b, -az), u3(0, s * b, -az)], outZ, look);
  } else if (kind === 'gable') {
    const m = rest.includes('L') ? -1 : 1;
    facet(acc, [u3(0, 0, 0), u3(m * az, 0, 0), u3(0, s * b, 0)], v(0, 0, 1), look);
  } else throw new Error('kit: no hull corner ' + kind);
  return acc.flush(p);
}

// ── the ends: a section stepping in to a flat end face ──
// (sections and cap styles: sections.js)
// the octagon round a section, in cells and steps: [x, level], counter-clockwise seen from the front (+z), from the
// belly's right end: belly, lower chamfer (+x), side, upper chamfer, roof, and back down the -x side
export function ring(S) {
  const { w, b, r, lo, up } = S;
  return [[-(w - lo[0]), b], [w - lo[0], b], [w, b + lo[1]], [w, r - up[1]], [w - up[0], r], [-(w - up[0]), r], [-w, r - up[1]], [-w, b + lo[1]]];
}
const FACETS = ['belly', 'lo', 'side', 'up', 'roof', 'up', 'side', 'lo'];
export function hullCap(p, variant = 'nose sample canopy') {
  const { look, rest } = parseLook(variant.split(' ')), acc = new Acc(), dir = rest[0] === 'tail' ? -1 : 1;
  const S = SECTIONS[rest[1]] || SECTIONS.sample, style = CAP_STYLES[rest[2]] || CAP_STYLES[dir > 0 ? 'canopy' : 'flat'];
  const rings = capRings(S, style), P = (xy, z) => u3(xy[0], xy[1], dir * z);
  const yc = (S.b + S.r) / 2 * U;
  for (let i = 1; i < rings.length; i++) {
    const A = ring(rings[i - 1].S), B = ring(rings[i].S), st = rings[i].st, za = rings[i - 1].z, zb = rings[i].z;
    for (let k = 0; k < 8; k++) {
      const k1 = (k + 1) % 8, quad = [P(A[k], za), P(A[k1], za), P(B[k1], zb), P(B[k], zb)], name = FACETS[k];
      const c = quad.reduce((s, q) => s.add(q), v(0, 0, 0)).multiplyScalar(0.25), out = c.clone().sub(v(0, yc, c.z)).setZ(0).normalize().add(v(0, 0, dir * 0.6));
      const gl = st.glass === true ? ['roof', 'up'] : st.glass || [];   // (glass: true for the roof and the upper chamfers, or a list of facet names)
      const lk = { ...look, glass: gl.includes(name), paint: st.paint?.[name] ? PAINTS[st.paint[name]] : look.paint };
      facet(acc, quad, out, lk);
    }
  }
  // the end face, with a ramp's mouth cut in it if asked: W cells wide, H steps tall, from the deck up
  const last = rings[rings.length - 1], E = ring(last.S).map((xy) => P(xy, last.z)), n = v(0, 0, dir);
  const faceLook = { ...look, paint: PAINTS[style.face] || look.paint, stripe: null, glass: false };
  const mi = rest.indexOf('mouth');
  if (mi < 0) facet(acc, E, n, faceLook);
  else {
    const [W, H] = rest[mi + 1].split('x').map(Number), hw = W * U / 2, ht = H * U, ez = dir * last.z * U;
    const hole = [v(-hw, 0, ez), v(hw, 0, ez), v(hw, ht, ez), v(-hw, ht, ez)];
    faceWithHole(acc, E, hole, n, faceLook);
    openingTrim(acc, hole, n, true);
  }
  return acc.flush(p);
}
// a flat face (convex outline) with a hole (a convex loop inside it), both faces, triangulated round the hole
function faceWithHole(acc, outline, hole, n, look) {
  const o = orient(outline, n), h = orient(hole, n), t = new THREE.Vector3().crossVectors(n, Math.abs(n.y) > 0.9 ? v(0, 0, 1) : v(0, 1, 0)).normalize(), r = n.clone().cross(t);
  const to2 = (q) => new THREE.Vector2(q.dot(t), q.dot(r)), contour = o.pts.map(to2), holeR = h.pts.slice().reverse();
  const tris = THREE.ShapeUtils.triangulateShape(contour, [holeR.map(to2)]), all = [...o.pts, ...holeR];
  acc.tris(tris.map((tr) => tr.map((i) => all[i])), n, look.paint);
  if (look.inner !== false) acc.tris(tris.map((tr) => tr.map((i) => all[i].clone().addScaledVector(n, -THICK))), n.clone().negate(), SHIP.inner);
}
// round a hole: the lining through the hull and a raised charcoal frame outside (a door's, a ramp's); with `sill`, a
// grey plate along its foot
function openingTrim(acc, hole, n, sill, fw = 0.07) {
  const o = orient(hole, n);
  lining(acc, o.pts, n, DEPTH, SHIP.trim, true);
  ringFrame(acc, inset(o.pts, n, -fw), o.pts, n, 0.03, 0.0, SHIP.trim);
  if (sill) { const [a, b] = o.pts; acc.poly([a.clone().addScaledVector(n, 0.035), b.clone().addScaledVector(n, 0.035), b.clone().addScaledVector(n, -DEPTH), a.clone().addScaledVector(n, -DEPTH)].map((q) => q.add(v(0, 0.004, 0))), v(0, 1, 0), SHIP.grey); }
}

// ── panels with openings ──
// a vertical panel (facing +z) of w x h metres, from x -w/2 and y 0, with a w0..w1 x h0..h1 hole: the panel round
// the hole in up to four rectangles (its stripe measured on the whole panel), the lining, and a frame
function holedPanel(acc, w, h, hole, look, kind) {
  const [x0, x1, y0, y1] = hole, X0 = -w / 2, X1 = w / 2, rect = (a, b, c, d) => [v(a, c, 0), v(b, c, 0), v(b, d, 0), v(a, d, 0)];
  const range = [0, h], parts = [];
  if (y0 > 1e-6) parts.push(rect(X0, X1, 0, y0));
  if (y1 < h - 1e-6) parts.push(rect(X0, X1, y1, h));
  if (x0 > X0 + 1e-6) parts.push(rect(X0, x0, y0, y1));
  if (x1 < X1 - 1e-6) parts.push(rect(x1, X1, y0, y1));
  for (const q of parts) facet(acc, q, v(0, 0, 1), look, { range, noRim: true });
  if (look.inner !== false) rim(acc, rect(X0, X1, 0, h), THICK_RIM, 0, -THICK, SHIP.inner);   // (the plate's own rim, round its outside only)
  const loop = rect(x0, x1, y0, y1);
  if (kind === 'window') {
    // glass in the middle of the hull's depth, a charcoal frame outside and a pale one in
    lining(acc, loop, v(0, 0, 1), THICK + 0.04, SHIP.frame);
    ringFrame(acc, inset(loop, v(0, 0, 1), -0.045), loop, v(0, 0, 1), 0.02, 0, SHIP.frame);
    for (let k = 0; k < PANES; k++) { const g = loop.map((q) => q.clone().setZ(-0.02 - 0.006 * k));
      acc.poly(g, v(0, 0, 1), null, 'glass', 9); acc.poly(g.slice().reverse(), v(0, 0, -1), null, 'glass', 9); }
  } else openingTrim(acc, loop, v(0, 0, 1), kind === 'door');
}
export function hullOpening(p, variant = 'door') {
  const { look, rest } = parseLook(variant.split(' ')), acc = new Acc(), kind = rest[0], n = num(rest, 'x', 0);
  if (kind === 'door') {
    // a 1.0 x 2.0 m door from the deck, in a panel 5 steps tall: 2 cells wide (its own width), or 4 (a cell each side)
    const w = (n || 2) * U, h = Math.max(4, num(rest, 'h', 5)) * U; holedPanel(acc, w, h, [-0.5, 0.5, 0, 2.0], look, 'door');   // (h4: a side wall only 4 steps tall, the door its full height)
  } else if (kind === 'window') {
    // a band of windows: one window 0.8 x 0.34 m in each 2 cells, in a panel one step tall
    const cells = n || 2, w = cells * U;
    if (cells < 2) throw new Error('kit: a window panel is at least 2 cells');
    for (let i = 0; i < cells / 2; i++) {
      const cx = -w / 2 + U + i * 2 * U;
      const sub = new Acc(); holedPanel(sub, 2 * U, U, [-0.4, 0.4, 0.08, 0.42], look, 'window');
      for (const e of sub.by.values()) { const pos = e.m.p; for (let k = 0; k < pos.length; k += 3) pos[k] += cx; const m = acc.mesh(e.surf, e.mat), base = m.count; m.p.push(...e.m.p); m.n.push(...e.m.n); m.uv.push(...e.m.uv); m.ix.push(...e.m.ix.map((q) => q + base)); }
    }
  } else if (kind === 'porthole') {
    // a round window, 0.34 m across, in one cell: a square hole behind a round frame plate
    facetsRoundHole(acc, look);
  } else if (kind === 'mouth') {
    // a hole W cells by H steps left between panels: only its lining, its frame and a sill plate
    const [W, H] = (rest[1] || '6x5').split('x').map(Number), hw = W * U / 2;
    openingTrim(acc, [v(-hw, 0, 0), v(hw, 0, 0), v(hw, H * U, 0), v(-hw, H * U, 0)], v(0, 0, 1), true, 0.1);
  } else if (kind === 'hatch') {
    // a belly panel (facing down) with a square hatch N cells across, a cell of panel round it
    const N = +(rest[1] || 2), h = N * U / 2, w = h + U, rect = (a, b, c, d) => [v(a, 0, c), v(b, 0, c), v(b, 0, d), v(a, 0, d)], dn = v(0, -1, 0);
    for (const q of [rect(-w, w, -w, -h), rect(-w, w, h, w), rect(-w, -h, -h, h), rect(h, w, -h, h)]) facet(acc, q, dn, look, { noRim: true });
    if (look.inner !== false) rim(acc, orient(rect(-w, w, -w, w), dn).pts, dn, 0, -THICK, SHIP.inner);
    openingTrim(acc, rect(-h, h, -h, h), dn, false);
  } else throw new Error('kit: no hull opening ' + kind);
  return acc.flush(p);
}
// a porthole's panel: a square cell with a round hole (as a fan of quads from the hole to the square), a round
// charcoal rim, the glass
function facetsRoundHole(acc, look) {
  const N = 24, R = 0.17, cy = U / 2, out = v(0, 0, 1), sq = (a) => { const c = Math.cos(a), s = Math.sin(a), k = (U / 2) / Math.max(Math.abs(c), Math.abs(s)); return v(c * k, cy + s * k, 0); };
  const circ = (a, r, z = 0) => v(Math.cos(a) * r, cy + Math.sin(a) * r, z);
  for (let i = 0; i < N; i++) {
    const a0 = i / N * PI * 2, a1 = (i + 1) / N * PI * 2;
    facet(acc, [circ(a0, R), circ(a1, R), sq(a1), sq(a0)], out, { ...look, seams: null }, { noRim: true });
    // the rim: a raised ring, its lining into the hull
    const r0 = R + 0.045;
    acc.poly([circ(a0, R, 0.02), circ(a1, R, 0.02), circ(a1, r0, 0.02), circ(a0, r0, 0.02)], out, SHIP.frame);
    acc.poly([circ(a0, r0, 0), circ(a1, r0, 0), circ(a1, r0, 0.02), circ(a0, r0, 0.02)], v(Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0), SHIP.frame);
    acc.poly([circ(a0, R, 0.02), circ(a1, R, 0.02), circ(a1, R, -THICK - 0.04), circ(a0, R, -THICK - 0.04)], v(-Math.cos((a0 + a1) / 2), -Math.sin((a0 + a1) / 2), 0), SHIP.frame);
  }
  if (look.inner !== false) rim(acc, [v(-U / 2, 0, 0), v(U / 2, 0, 0), v(U / 2, U, 0), v(-U / 2, U, 0)], out, 0, -THICK, SHIP.inner);
  for (let k = 0; k < PANES; k++) { const disc = []; for (let i = 0; i < N; i++) disc.push(circ(i / N * PI * 2, R, -0.02 - 0.006 * k));
    acc.poly(disc, out, null, 'glass', 9); acc.poly(disc.slice().reverse(), v(0, 0, -1), null, 'glass', 9); }
}

// ── which variants a layout may ask for (any shape word with any paint words) ──
const okPaint = (ws) => ws.every((w) => PAINT_WORDS.has(w));
export const ACCEPTS = {
  hullPanel: (s) => { const ws = s.split(' '); return /^(x[124]( h[1-6])?|(roof|belly) x[124]( d[124])?|(roof|belly) tri (1:1|1:2|2:1))$/.test(ws.filter((w) => !PAINT_WORDS.has(w)).join(' ')) && okPaint(ws.filter((w) => PAINT_WORDS.has(w))); },
  hullSlope: (s) => /^((up|down) ([1-4]:[1-4]) x[124]|dslope (up|down) ([1-4]:[1-4]) plan ([1-4]:[1-4])( [LR])?)$/.test(s.split(' ').filter((w) => !PAINT_WORDS.has(w)).join(' ')),
  hullAngle: (s) => /^([1-4]:[1-4])( h[1-6])?( [LR])?$/.test(s.split(' ').filter((w) => !PAINT_WORDS.has(w)).join(' ')),
  hullCorner: (s) => /^((hip|valley) (up|down) ([1-4]:[1-4])(\/[1-4]:[1-4])?|gable (up|down) ([1-4]:[1-4])( [LR])?)$/.test(s.split(' ').filter((w) => !PAINT_WORDS.has(w)).join(' ')),
  hullCap: (s) => { const ws = s.split(' ').filter((w) => !PAINT_WORDS.has(w)); return ['nose', 'tail'].includes(ws[0]) && !!SECTIONS[ws[1]] && !!CAP_STYLES[ws[2]] && (ws.length === 3 || (ws[3] === 'mouth' && /^\d+x\d+$/.test(ws[4] || ''))); },
  hullOpening: (s) => /^(door( x[24])?( h[45])?|window x[24]|porthole|mouth \d+x\d+|hatch [23])$/.test(s.split(' ').filter((w) => !PAINT_WORDS.has(w)).join(' ')),
};
