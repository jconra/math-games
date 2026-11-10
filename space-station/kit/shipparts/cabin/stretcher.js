// THE AMBULANCE STRETCHER, after the game's maker's picture (refs/ships/medic/stretcher_2026-11-10.jpg: a yellow tube
// frame on an X-shaped scissor lift, four castor wheels, a black padded mattress in sections with the back raised, black
// folding side rails, a handle frame at the foot), in the ship's yellow and black, cheap: about 1,100 triangles with its
// legs, 700 docked.
//   ambulanceStretcher(p, o)  standing free, centred on the deck under it, its length along z, its head at -z:
//     o.len (1.95, the frame), o.w (0.58), o.frame (the top frame's height: 0.62 with its legs, as low as 0.24 folded),
//     o.back (the back section's raise, radians: 0.5; 0 lies flat), o.legs ('lift': the scissor lift and castors; 'none':
//     docked on a base, its frame only), o.rails ('up' | 'down'), o.pillow (true: a grey pillow on the back section),
//     o.straps (true: two black straps across the pads)
//   stowedStretcher(p, o)     the same folded flat (its legs folded under it, its back down, its rails down) and hung
//                             upright on a wall in two clips (a WALL fitting: z = 0 on the wall line, facing +z; its foot
//                             o.y0 over the deck)
import * as THREE from 'three';
import { shape, solid, add } from '../../bevel.js';
import { FACE } from './ship.js';
import { tube } from './round.js';
import { placeInto, part } from '../place.js';

const PI = Math.PI;
export const FRAME_YELLOW = { c: '#e0ad1a', r: 0.4, m: 0.25, w: 0.5 }, FRAME_BLACK = { c: '#26282c', r: 0.45, m: 0.3, w: 0.4 }, PAD = { c: '#2e3034', r: 0.62, m: 0, w: 0.3 }, PILLOW = { c: '#9da0a5', r: 0.85, m: 0, w: 0.2 };
const T = (p, look, pts, r, o = {}) => add(p, look, tube(pts, r, { seg: o.seg ?? 6, arc: o.arc ?? 2, bend: o.bend }));
// a flat bar from a to b (a scissor arm), w wide across x, t thick
function bar(p, look, a, b, w, t) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(), g = new THREE.BoxGeometry(w, t, L);
  g.lookAt(d); g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); add(p, look, g);
}
export function ambulanceStretcher(p, o = {}) {
  const L = o.len ?? 1.95, W = o.w ?? 0.58, legs = o.legs ?? 'lift', yF = o.frame ?? (legs === 'lift' ? 0.62 : 0.05), back = o.back ?? 0.5, r = 0.016;
  const hw = W / 2, hl = L / 2, Y = FRAME_YELLOW, K = FRAME_BLACK;
  // THE TOP FRAME: a loop of yellow tube round the pads, its corners bent; the foot's handle frame in black, out and down
  T(p, Y, [[0, yF, -hl], [hw, yF, -hl], [hw, yF, hl], [-hw, yF, hl], [-hw, yF, -hl], [0.001, yF, -hl]], r, { bend: 0.05 });
  T(p, K, [[-hw + 0.04, yF, hl - 0.06], [-hw + 0.04, yF + 0.01, hl + 0.1], [-hw + 0.04, yF - 0.2, hl + 0.13], [hw - 0.04, yF - 0.2, hl + 0.13], [hw - 0.04, yF + 0.01, hl + 0.1], [hw - 0.04, yF, hl - 0.06]], r * 0.9, { bend: 0.04 });
  // cross members under the pads (dark)
  for (const z of [-hl + 0.55, -0.05, hl - 0.4]) bar(p, K, [-hw, yF - 0.012, z], [hw, yF - 0.012, z], 0.03, 0.02);
  // THE PADS: the leg and seat sections flat, the back section raised about its hinge; a seam between each; black
  const yP = yF + 0.02, th = 0.075, pw = W - 0.05, zH = -hl + 0.78, secs = [[zH + 0.42, hl - 0.04], [zH + 0.01, zH + 0.4]];
  for (const [a, b] of secs) add(p, PAD, solid(shape(pw, b - a, 0.04, 0, -(a + b) / 2), th, { edge: 0.022, back: false }), [0, yP, 0], [-PI / 2, 0, 0]);
  const bk = solid(shape(pw, zH - (-hl + 0.04) - 0.01, 0.04, 0, -((-hl + 0.04 + zH - 0.01) / 2)), th, { edge: 0.022, back: false });
  bk.rotateX(-PI / 2); bk.translate(0, yP, 0); bk.translate(0, -yP, -zH); bk.rotateX(back); bk.translate(0, yP, zH); add(p, PAD, bk);
  if (back > 0.05) { const lift = (zH - (-hl + 0.3)) * Math.sin(back); T(p, Y, [[-hw + 0.06, yF, zH - 0.45], [-hw + 0.06, yF + lift * 0.6, zH - 0.45 + 0.02], [hw - 0.06, yF + lift * 0.6, zH - 0.45 + 0.02], [hw - 0.06, yF, zH - 0.45]], r * 0.8, { bend: 0.03 }); }
  if (o.pillow) { const pl = solid(shape(pw * 0.62, 0.28, 0.05, 0, -(-hl + 0.22)), 0.07, { edge: 0.03, back: false }); pl.rotateX(-PI / 2); pl.translate(0, yP + th, 0); pl.translate(0, -yP, -zH); pl.rotateX(back); pl.translate(0, yP, zH); add(p, PILLOW, pl); }
  if (o.straps !== false) for (const z of [zH + 0.2, hl - 0.35]) { const g = new THREE.BoxGeometry(pw + 0.02, 0.012, 0.05); g.translate(0, yP + th + 0.004, z); add(p, K, g); }
  // THE SIDE RAILS: black, folding, beside the seat; up, or folded flat along the frame
  const up = o.rails !== 'down';
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.025), z0 = zH - 0.12, z1 = zH + 0.5, ry = up ? yF + 0.26 : yF + 0.035;
    T(p, K, up ? [[x, yF, z0], [x, ry, z0 + 0.04], [x, ry, z1 - 0.04], [x, yF, z1]] : [[x, yF + 0.01, z0], [x, ry, z0], [x, ry, z1], [x, yF + 0.01, z1]], r * 0.85, { bend: 0.04 });
  }
  if (legs !== 'lift') return p;
  // THE LIFT: a base frame of yellow tube low over the deck, four castors (yellow forks, black wheels), and the scissor:
  // on each side two flat yellow arms crossing from the base to the top frame, a black band across each pair's pivot
  const yB = 0.15, bl = hl * 0.82, bw = hw - 0.02, wr = 0.065;
  T(p, Y, [[0, yB, -bl], [bw, yB, -bl], [bw, yB, bl], [-bw, yB, bl], [-bw, yB, -bl], [0.001, yB, -bl]], r, { bend: 0.06 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * bw, z = sz * (bl - 0.04);
    bar(p, Y, [x, yB, z], [x, wr + 0.01, z + sz * 0.03], 0.03, 0.03);
    const g = new THREE.CylinderGeometry(wr, wr, 0.035, 10, 1); g.rotateZ(PI / 2); g.translate(x, wr, z + sz * 0.05); add(p, K, g);
  }
  const reach = Math.min(bl - 0.1, hl * 0.6);
  for (const s of [-1, 1]) {
    const x = s * (bw - 0.03);
    bar(p, Y, [x, yB + 0.02, -reach], [x, yF - 0.03, reach * 0.75], 0.025, 0.05);
    bar(p, Y, [x - s * 0.03, yB + 0.02, reach], [x - s * 0.03, yF - 0.03, -reach * 0.75], 0.025, 0.05);
  }
  bar(p, K, [-bw + 0.02, (yB + yF) / 2, 0], [bw - 0.02, (yB + yF) / 2, 0], 0.035, 0.035);
  return p;
}

// ── the stretcher stowed on a wall ──────────────────────────────────────────────────────────────────────────────
export function stowedStretcher(p, o = {}) {
  const L = o.len ?? 1.85, y0 = o.y0 ?? 0.18, W = o.w ?? 0.5;
  // (folded: its top frame down to just over its base frame, the scissor lying flat between; turned up on end, its
  // wheels to the wall)
  placeInto(p, part(ambulanceStretcher, { len: L, w: W, frame: 0.26, back: 0, rails: 'down', legs: 'lift', straps: true }), { at: [0, y0 + L / 2 + 0.14, FACE + 0.01], rot: [PI / 2, 0, 0] });
  for (const y of [y0 + 0.4, y0 + L - 0.2]) { const g = new THREE.BoxGeometry(W + 0.1, 0.05, 0.36); g.translate(0, y, FACE + 0.18); add(p, 'gun', g); }
  return p;
}
