// THE SCIENCE LAB, in the bevel helper's language (kit/bevel.js), from the game's maker's science picture
// (refs/ships/explorer_science_ref_2026-11-09.png): a bench with labelled drawers (BIO, CHEM, ANALYSIS, TOOLS) and a knee
// space for a stool, a screen on the wall over it, a microscope, a glovebox with two glove ports, a rack of glowing vials and
// a tablet on its top; a SAMPLES case (his crate's stencil and hazard stripes, a lit display of jars over it); the survey
// table, its top a glowing map ringed in light; a lab stool with a navy pad and a backrest.
// Frames (kit/shipparts/cabin/ship.js): a WALL fitting stands on a wall line, x along the wall, centred; z = 0 on the line,
// its back at the wall's face (FACE), facing +z; y = 0 the deck. A FREE one is centred on its origin, standing on y = 0.
//   labBench(p, o)     o.len (1.5), o.depth (0.5), o.top (0.9), o.knee (the column left open for a stool's knees, its
//                      index: the middle one by default; -1 none), o.end ([left, right] worktop corner chamfers), o.labels
//                      (the drawers' label keys, in turn), o.handle, o.trim
//   microscope(p), glovebox(p, o), vialRack(p, o), tablet(p)   (free, standing on y = 0, facing +z; the glovebox's back
//                      at z = 0: o.w (0.5), o.h (0.42), o.d (0.36))
//   sampleCase(p, o)   o.len (1.5), o.depth (0.25), o.h (1.8), o.handle, o.trim
//   surveyTable(p, o)  a wall fitting (it stands against a wall, its top an 8-sided glowing map): o.w (1), o.depth (1.25),
//                      o.h (0.9), o.trim
//   labStool(p, o)     free: o.h (0.62, the seat), o.pad (the leather colour of its pad and backrest)
import { shape, solid, loft, plate, relief, prism, octagon, add } from '../../bevel.js';
import { FACE } from './ship.js';
import { FLAT, printed, glowStrip, screen, pool, strip, hazard, leatherOf } from './bits.js';
import { liveFace } from './live.js';
import { PANEL } from './bunks.js';
import { STEEL, GUN, TOP } from './mess.js';
import { SCREEN_RECT } from '../../tex.js';

const PI = Math.PI;
const GLASSPANE = (p, w, h, at, rot) => add(p, null, plate(shape(w, h, Math.min(w, h) * 0.08)), at, rot, 'glass');
const VIAL = [[0.25, 0.85, 2.2], [0.3, 1.6, 1.0], [0.25, 0.85, 2.2], [1.6, 1.1, 0.35], [0.25, 0.85, 2.2], [0.3, 1.6, 1.0]];   // (the liquids' glows: blue, green, amber)

// ── the bench ───────────────────────────────────────────────────────────────────────────────────────────────────
export function labBench(p, o = {}) {
  const len = o.len ?? 1.5, depth = o.depth ?? 0.5, top = o.top ?? 0.9, kick = 0.1, d = depth - 0.03 - FACE, [eL, eR] = o.end || [0, 0];
  const n = Math.max(1, Math.round(len / 0.5)), cw = len / n, knee = o.knee ?? (n >= 3 ? Math.floor(n / 2) : -1), labels = o.labels || ['bio', 'chem', 'analysis', 'tools'];
  let li = 0;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + cw * (i + 0.5);
    if (i === knee) continue;
    // a column of two drawers: the carcass, its kick, the raised fronts, handle slots, labels
    add(p, 'dark', solid(shape(cw - 0.004, kick, 0, x, kick / 2), d - 0.06, { edge: 0.004, back: false }), [0, 0, FACE]);
    add(p, 'white', solid(shape(cw - 0.004, top - 0.04 - kick, 0.008, x, (kick + top - 0.04) / 2), d, { edge: 0.008, back: false }), [0, 0, FACE]);
    const dh = (top - 0.04 - kick - 0.03) / 2;
    for (let k = 0; k < 2; k++) {
      const y = kick + 0.015 + dh * (k + 0.5);
      add(p, 'white2', relief(shape(cw - 0.03, dh - 0.02, 0.03, x, y), PANEL), [0, 0, FACE + d]);
      add(p, o.handle || 'black', plate(shape(Math.min(0.2, cw * 0.45), 0.022, 0.009, x, y + dh * 0.22)), [0, 0, FACE + d + 0.0075]);
      const L = labels[li++ % labels.length], wide = L === 'analysis' || L === 'samples' || L === 'reactor';
      add(p, 'black', solid(shape(wide ? 0.25 : 0.12, wide ? 0.04 : 0.05, 0.008, x, y - dh * 0.12), 0.003, { edge: 0.001, back: false }), [0, 0, FACE + d + 0.0035]);
      printed(p, 'label:' + L, wide ? 0.22 : 0.1, wide ? 0.0275 : 0.05, [x, y - dh * 0.12, FACE + d + 0.0069], null, '#e8e6de');
    }
  }
  // the knee space: its back panel, a little darker
  if (knee >= 0) { const x = -len / 2 + cw * (knee + 0.5); add(p, 'grey2', relief(shape(cw - 0.02, top - 0.1, 0.03, x, (top - 0.04) / 2), [{ inset: 0, depth: -0.004, bevel: 0.004 }]), [0, 0, FACE + 0.002]); }
  // the worktop on its charcoal edge (its open ends' front corners chamfered)
  add(p, o.trim || 'black', solid(shape(len, depth - FACE + 0.02, [eL, eR, 0, 0], 0, -(FACE + (depth - FACE + 0.02) / 2)), 0.025, { edge: 0.005 }), [0, top - 0.04, 0], FLAT);
  add(p, TOP, solid(shape(len - 0.01, depth - FACE + 0.01, [Math.max(0, eL - 0.004), Math.max(0, eR - 0.004), 0, 0], 0, -(FACE + (depth - FACE + 0.01) / 2)), 0.016, { edge: 0.004, back: false, front: [{ inset: 0.05, depth: -0.0015, bevel: 0.002 }, { inset: 0.004, depth: 0, bevel: 0.002 }] }), [0, top - 0.016, 0], FLAT);
  return p;
}

// ── on the bench ────────────────────────────────────────────────────────────────────────────────────────────────
export function microscope(p) {
  const S = (a, b, z, c = 0.3) => ({ s: shape(a, b, Math.min(a, b) * c), z });
  add(p, 'white2', solid(shape(0.17, 0.21, 0.04, 0, 0.0), 0.03, { edge: 0.008 }), [0, 0, 0], FLAT);
  // the arm: a column up the back, leaning forward over the stage
  add(p, 'white2', prism([[-0.03, 0.03], [0.03, 0.03], [0.05, 0.2], [0.03, 0.3], [-0.03, 0.3], [-0.01, 0.2]], -0.035, 0.035), [0, 0, -0.07], [0, -PI / 2, 0]);
  add(p, 'black', solid(shape(0.12, 0.11, 0.025, 0, -0.01), 0.012, { edge: 0.003 }), [0, 0.11, 0], FLAT);
  add(p, 'white2', solid(shape(0.09, 0.1, 0.03, 0, 0.0), 0.07, { edge: 0.01 }), [0, 0.25, 0], FLAT);
  add(p, 'black', loft([S(0.035, 0.035, 0), S(0.026, 0.026, 0.07)]), [0, 0.25, 0.0], [PI / 2, 0, 0]);
  // the eyepieces: two short tubes leaning back toward whoever sits at it
  for (const s of [-1, 1]) add(p, 'black', loft([S(0.026, 0.026, 0), S(0.026, 0.026, 0.1), S(0.032, 0.032, 0.11), S(0.032, 0.032, 0.13)]), [s * 0.02, 0.31, 0.01], [-PI / 4, 0, 0]);
  add(p, 'black', solid(shape(0.03, 0.03, 0.008, 0.06, 0), 0.03, { edge: 0.006 }), [0, 0.16, -0.02], [0, PI / 2, 0]);
  return p;
}
export function glovebox(p, o = {}) {
  const w = o.w ?? 0.5, h = o.h ?? 0.42, d = o.d ?? 0.36;
  // the box: a pale shell, its front a deep sunk hollow (the inside) behind a glass pane with two glove ports
  add(p, 'white', solid(shape(w, h, 0.05, 0, h / 2), d, { edge: 0.01, back: false, front: [{ inset: 0.012, depth: 0.004, bevel: 0.004 }, { inset: 0.02, depth: -(d - 0.03), bevel: 0.01 }] }), [0, 0, 0]);
  add(p, 'white', solid(shape(w * 0.7, 0.05, 0.015, 0, h + 0.024), 0.12, { edge: 0.01 }), [0, 0, 0.02]);
  GLASSPANE(p, w - 0.07, h - 0.07, [0, h / 2, d - 0.004]);
  for (const s of [-1, 1]) {
    const x = s * w * 0.22, y = h * 0.42;
    add(p, 'black', relief(shape(0.12, 0.12, 0.035, x, y), [{ inset: 0, depth: 0.012, bevel: 0.008 }, { inset: 0.01, depth: 0.004, bevel: 0.006 }], { hole: true, jamb: -0.006 }), [0, 0, d]);
    add(p, { c: '#1b1d22', r: 0.85, m: 0, w: 0.1 }, loft([{ s: shape(0.1, 0.1, 0.03, x, y), z: 0 }, { s: shape(0.085, 0.085, 0.025, x, y + 0.01), z: 0.07 }], { start: false }), [0, 0, d - 0.006], [0, PI, 0]);
  }
  glowStrip(p, w - 0.12, [0, h - 0.04, d * 0.55], [PI / 2, 0, 0], { i: 0.08, reach: 0.6, color: [0.75, 0.88, 1.0] });
  // a small screen on its front frame
  add(p, [1.2, 1.2, 1.2], screenQuad(0.09, 0.03, 'status', [0.05, 0.6, 0.6, 0.8]), [w / 2 - 0.08, h - 0.022, d + 0.0045], null, 'screen');
  return p;
}
function screenQuad(w, h, rect, sub) {
  const g = plate(shape(w, h, 0)), uv = g.attributes.uv.array, P = g.attributes.position.array, R0 = SCREEN_RECT[rect], [a, b, c, d] = R0, R = [a + (c - a) * sub[0], b + (d - b) * sub[1], a + (c - a) * sub[2], b + (d - b) * sub[3]];
  for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = R[0] + (P[i * 3] / w + 0.5) * (R[2] - R[0]); uv[i * 2 + 1] = R[1] + (P[i * 3 + 1] / h + 0.5) * (R[3] - R[1]); }
  return g;
}
export function vialRack(p, o = {}) {
  const n = o.n ?? 5, S = (a, z) => ({ s: shape(a, a, a * 0.29), z });
  add(p, 'black', solid(shape(0.06 * n + 0.04, 0.08, 0.015, 0, 0), 0.035, { edge: 0.006 }), [0, 0, 0], FLAT);
  for (let i = 0; i < n; i++) {
    const x = -0.03 * (n - 1) + 0.06 * i, c = VIAL[(i + (o.seed ?? 0)) % VIAL.length];
    add(p, c, loft([S(0.026, 0), S(0.026, 0.09)], { start: false }), [x, 0.02, 0], FLAT, 'glow');
    add(p, 'white2', loft([S(0.03, 0), S(0.03, 0.025)]), [x, 0.11, 0], FLAT);
  }
  return p;
}
export function tablet(p) {
  add(p, 'black', solid(shape(0.24, 0.17, 0.02, 0, 0.085), 0.012, { edge: 0.003 }), [0, 0.005, 0], [-PI / 2 + 0.3, 0, 0]);
  add(p, [1.25, 1.25, 1.25], screenQuad(0.21, 0.13, 'radar', [0.05, 0.05, 0.95, 0.95]), [0, 0.03, -0.017], [-PI / 2 + 0.3, 0, 0], 'screen');
  return p;
}

// ── the SAMPLES case ────────────────────────────────────────────────────────────────────────────────────────────
export function sampleCase(p, o = {}) {
  const len = o.len ?? 1.5, depth = o.depth ?? 0.25, h = o.h ?? 1.8, d = depth - 0.01 - FACE, fz = FACE + d, split = Math.min(0.74, h * 0.42);
  // (its body a block with the display's outline cut from its front: the display's hollow goes back into it)
  const dy0 = split + 0.02, dy1 = h - 0.07, hd = d - 0.035, disp = shape(len - 0.06, dy1 - dy0, 0.05, 0, (dy0 + dy1) / 2), L2 = (len - 0.008) / 2;
  add(p, 'white', prism([[-L2, 0], [L2, 0], [L2, h - 0.034], [L2 - 0.03, h - 0.004], [-L2 + 0.03, h - 0.004], [-L2, h - 0.034]], FACE, fz, { holes: [octagon(disp)], back: false }));
  add(p, 'dark', solid(shape(len - 0.02, 0.07, 0, 0, 0.035), 0.006, { edge: 0.002, back: false }), [0, 0, fz]);
  // the crate below: its doors, raised, ribbed with hazard stripes top and bottom, SAMPLES stencilled across them
  const n = Math.max(1, Math.round(len / 0.75)), dw = (len - 0.02) / n, y0 = 0.09, y1 = split - 0.02;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.01 + dw * (i + 0.5);
    add(p, 'white2', relief(shape(dw - 0.03, y1 - y0, 0.04, x, (y0 + y1) / 2), PANEL), [0, 0, fz]);
    for (const y of [y0 + 0.06, y1 - 0.06]) hazard(p, dw - 0.16, 0.04, [x, y, fz + 0.0045]);
    printed(p, 'label:samples', Math.min(0.42, dw - 0.16), Math.min(0.42, dw - 0.16) / 8, [x, (y0 + y1) / 2, fz + 0.0045], null, '#2c2e32');
    add(p, o.handle || 'black', plate(shape(0.024, 0.16, 0.009, x + (dw / 2 - 0.06) * (i % 2 ? -1 : 1), (y0 + y1) / 2)), [0, 0, fz + 0.0075]);
  }
  // the display above: a lit hollow behind glass, two shelves of jars
  add(p, 'white2', relief(disp, [{ inset: 0, depth: 0.006, bevel: 0.005 }, { inset: 0.02, depth: -hd, bevel: 0.008 }]), [0, 0, fz]);
  const back = fz - hd, rows = [dy0 + 0.05, dy0 + (dy1 - dy0) * 0.5];
  for (const ry of rows) {
    add(p, o.trim || 'black', solid(shape(len - 0.12, hd - 0.01, 0, 0, -(back + (hd - 0.01) / 2)), 0.014, { edge: 0.003 }), [0, ry - 0.014, 0], FLAT);
    const m = Math.max(3, Math.round((len - 0.2) / 0.11));
    for (let k = 0; k < m; k++) {
      const x = -(len - 0.2) / 2 + (len - 0.2) * (k + 0.5) / m, c = VIAL[(k + (ry > dy0 + 0.1 ? 2 : 0)) % VIAL.length], jh = 0.09 + ((k * 37) % 5) * 0.012, S = (a, z) => ({ s: shape(a, a, a * 0.29), z });
      add(p, c.map((v) => v * 0.7), loft([S(0.05, 0), S(0.05, jh)], { start: false }), [x, ry, back + hd * 0.5], FLAT, 'glow');
      add(p, 'white2', loft([S(0.054, 0), S(0.054, 0.018)]), [x, ry + jh, back + hd * 0.5], FLAT);
    }
  }
  glowStrip(p, len - 0.16, [0, dy1 - 0.035, back + 0.03], [PI / 2, 0, 0], { i: 0.12, dir: [0, 0.3, 0.95], reach: 0.9, color: [0.8, 0.92, 1.0], pool: 0.12, poolAt: [0, (dy0 + dy1) / 2, fz + 0.3] });
  GLASSPANE(p, len - 0.12, dy1 - dy0 - 0.05, [0, (dy0 + dy1) / 2, fz + 0.002]);
  // (SAMPLES again over the display, as a header with hazard stripes either side: it shows over whatever stands in front)
  const hy = (dy1 + h) / 2 - 0.002, lw = Math.min(0.36, len * 0.3);
  printed(p, 'label:samples', lw, lw / 8, [0, hy, fz + 0.0015], null, '#2c2e32');
  for (const s of [-1, 1]) hazard(p, Math.min(0.24, (len - lw) / 2 - 0.12), 0.035, [s * (lw / 2 + 0.04 + Math.min(0.24, (len - lw) / 2 - 0.12) / 2), hy, fz + 0.0015]);
  return p;
}

// ── the survey table ────────────────────────────────────────────────────────────────────────────────────────────
export function surveyTable(p, o = {}) {
  const w = o.w ?? 1.0, depth = o.depth ?? 1.25, h = o.h ?? 0.9, zc = FACE + (depth - FACE) / 2, tw = w - 0.04, td = depth - FACE - 0.06, c = Math.min(tw, td) * 0.22;
  const S = (a, b, y, k = 0.3) => ({ s: shape(a, b, Math.min(a, b) * k, 0, -zc), z: y });
  // the pedestal: a wide faceted foot, a body with sunk panels, a head under the top
  add(p, 'white', loft([S(tw * 0.8, td * 0.8, 0), S(tw * 0.8, td * 0.8, 0.05), S(tw * 0.64, td * 0.66, 0.1), S(tw * 0.64, td * 0.66, h - 0.12), S(tw * 0.86, td * 0.88, h - 0.06)], { start: false }), [0, 0, 0], FLAT);
  add(p, 'dark', loft([S(tw * 0.8 + 0.004, td * 0.8 + 0.004, 0), S(tw * 0.8 + 0.004, td * 0.8 + 0.004, 0.012)], { start: false, end: false }), [0, 0, 0], FLAT);
  // the top: a charcoal rim, a glowing band round its edge (the ring of light), the map sunk into it
  add(p, o.trim || 'black', solid(shape(tw, td, c, 0, -zc), 0.05, { edge: 0.01, back: false, front: [{ inset: 0.035, depth: 0.004, bevel: 0.004 }, { inset: 0.012, depth: -0.008, bevel: 0.006 }] }), [0, h - 0.06, 0], FLAT);
  add(p, [0.45, 1.4, 3.2], loft([{ s: shape(tw + 0.008, td + 0.008, c + 0.002, 0, -zc), z: 0 }, { s: shape(tw + 0.008, td + 0.008, c + 0.002, 0, -zc), z: 0.014 }], { start: false, end: false }), [0, h - 0.04, 0], FLAT, 'glow');
  // (the map: a live screen lying flat, the star chart drifting, kit/shipparts/cabin/live.js; the lab's wall screen
  // shows the wire planet, so the two never show the same thing)
  const mw = tw - 0.11, md = td - 0.11, mc = Math.max(0.01, c - 0.04);
  liveFace(p, { show: 'chart', w: mw, h: md, c: mc, seed: 0.71 }, [0, h - 0.008 + 0.0012, zc], FLAT);
  // its light up from the map, and its pool
  strip(p, [0, h + 0.1, zc], 0.45, [0, 1, 0], 2.2, [0.6, 0.82, 1.0]);
  strip(p, [0, h + 0.05, zc + td / 2 + 0.15], 0.2, [0, 0, 1], 1.6, [0.6, 0.82, 1.0]);
  pool(p, [0, h + 0.25, zc + 0.2], 0.55, 2.0, [0.62, 0.82, 1.0]);
  return p;
}

// ── the ring of light hung over the survey table (his science picture's ring, lower: under the hull's slope) ──
//   ringLight(p, o)   free: o.r (0.3: half its width), o.drop (0.3: how far it hangs, its cables up to the ceiling); the
//                     ring's underside at y = 0
export function ringLight(p, o = {}) {
  const r = o.r ?? 0.3, drop = o.drop ?? 0.3, s = shape(2 * r, 2 * r, 2 * r * 0.293), DOWN = [PI / 2, 0, 0];
  add(p, o.trim || 'black', relief(s, [{ inset: 0, depth: 0.035, bevel: 0.012 }, { inset: 0.055, depth: 0.0, bevel: 0.012 }], { hole: true }), [0, 0.035, 0], DOWN);
  add(p, [2.2, 2.5, 2.9], relief(shape(2 * r - 0.03, 2 * r - 0.03, (2 * r - 0.03) * 0.293), [{ inset: 0.028, depth: 0, bevel: 0 }], { hole: true }), [0, -0.0015, 0], DOWN, 'glow');
  for (const x of [-r * 0.75, r * 0.75]) add(p, o.trim || 'black', loft([{ s: shape(0.016, 0.016, 0.005, x, 0), z: 0 }, { s: shape(0.016, 0.016, 0.005, x, 0), z: drop }], { start: false, end: false }), [0, 0.035, 0], FLAT);
  strip(p, [0, -0.12, 0], 0.32, [0, -1, 0], 2.0, [0.85, 0.93, 1.0]);
  pool(p, [0, -0.35, 0], 0.5, 2.0, [0.85, 0.93, 1.0]);
  return p;
}

// ── the lab stool ───────────────────────────────────────────────────────────────────────────────────────────────
export function labStool(p, o = {}) {
  const h = o.h ?? 0.62, S = (a, z) => ({ s: shape(a, a, a * 0.29), z });
  add(p, GUN, loft([S(0.46, 0), S(0.46, 0.025), S(0.2, 0.07), S(0.07, 0.12), S(0.055, h - 0.09), S(0.2, h - 0.06), S(0.27, h - 0.05)], { start: false }), [0, 0, 0], FLAT);
  // the foot ring
  add(p, STEEL, relief(shape(0.4, 0.4, 0.12), [{ inset: 0, depth: 0.015, bevel: 0.01 }, { inset: 0.025, depth: 0, bevel: 0.01 }], { hole: true, jamb: -0.012 }), [0, 0.26, 0], FLAT);
  add(p, STEEL, solid(shape(0.36, 0.36, 0.1), 0.026, { edge: 0.007 }), [0, h - 0.06, 0], FLAT);
  add(p, o.pad ? leatherOf(o.pad, 'stools') : { c: '#6c7078', r: 0.6, m: 0.05, w: 0.3 }, solid(shape(0.34, 0.34, 0.1), 0.045, { edge: 0.014, back: false }), [0, h - 0.036, 0], FLAT);
  // the backrest on a post at its back (-z)
  add(p, GUN, solid(shape(0.035, 0.32, 0.01, 0, h + 0.13), 0.025, { edge: 0.006 }), [0, 0, -0.165]);
  add(p, o.pad ? leatherOf(o.pad, 'stools') : { c: '#6c7078', r: 0.6, m: 0.05, w: 0.3 }, solid(shape(0.3, 0.13, 0.04, 0, h + 0.27), 0.04, { edge: 0.014 }), [0, 0, -0.15], [-0.12, 0, 0]);
  return p;
}
