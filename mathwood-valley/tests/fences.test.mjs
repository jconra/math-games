// Tests for the town's fence styles and gates (world/objects/fenceplan.js, the plan world/objects/fences.js draws):
// a fence's style is kept from the lab to the decor to the game, a fence with no style is the plain one as before,
// a gate cuts a gap of its kind's width in the fence clicked, Clear takes fences and gates down, and the zigzag fence
// blocks along its zigzag.
// Run with:  node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { planFences, fenceLines, wormCorners, nearestFence, FENCE_STYLES, GATES, GATE_REACH, styleOf } from '../world/objects/fenceplan.js';
import { inStroke, normalisePlanting } from '../world/objects/planting.js';
import { applyDecor } from '../world/objects/decor.js';
import { makeDecor, decorText } from '../labs/town/decorfile.js';

const FENCE = 27, GATE = 98, opts = { fence: FENCE, gate: GATE, inStroke };
let seed = 1;
const fence = (pts, style, extra = {}) => ({ id: 'f' + seed, mode: 'paint', kind: FENCE, r: 1.5, density: 2, size: 1, seed: seed++, pts, ...(style ? { style } : {}), ...extra });
const gate = (x, z) => ({ id: 'g' + seed, mode: 'paint', kind: GATE, r: 0.6, density: 2, size: 1, seed: seed++, pts: [[x, z]] });
const clear = (pts, kind = FENCE, r = 1.5) => ({ id: 'c' + seed, mode: 'clear', kind, r, density: 2, size: 1, seed: seed++, pts });

test('every style is known, with a gate kind, and anything else is the plain fence', () => {
  for (const [id, S] of Object.entries(FENCE_STYLES)) { assert.ok(S.name && S.h > 0.5 && S.h < 2, id); assert.ok(GATES[S.gate], id + ' gate'); }
  assert.equal(styleOf({ style: 'corral' }), 'corral');
  assert.equal(styleOf({}), null); assert.equal(styleOf({ style: 'nonsense' }), null);
  const P = planFences([fence([[0, 0], [10, 0]]), fence([[0, 5], [10, 5]], 'nonsense')], opts);
  assert.deepEqual(P.runs.map((R) => R.style), [null, null]);
  assert.equal(P.runs[0].pieces.length, 1); assert.equal(P.gates.length, 0);
});

test('a gate cuts a gap of its kind\'s width in the nearest fence, which leaves its own post out there', () => {
  const P = planFences([fence([[0, 0], [20, 0]], 'corral'), gate(10, 0.8)], opts);
  assert.equal(P.gates.length, 1);
  const G = P.gates[0];
  assert.equal(G.kind, 'corral'); assert.ok(Math.abs(G.w - GATES.corral.w) < 1e-9); assert.ok(GATES.corral.w >= 3.5, 'wide enough for a horse');
  assert.ok(Math.abs(G.s - 10) < 1e-6);
  const R = P.runs[0];
  assert.equal(R.pieces.length, 2);
  assert.ok(Math.abs(R.pieces[0].b - (10 - G.w / 2)) < 1e-6 && R.pieces[0].gateB && !R.pieces[0].gateA);
  assert.ok(Math.abs(R.pieces[1].a - (10 + G.w / 2)) < 1e-6 && R.pieces[1].gateA && !R.pieces[1].gateB);
  // its style picks its gate: a picket fence a picket gate, the plain fence the square board gate, wire the ranch gate
  assert.equal(planFences([fence([[0, 0], [20, 0]], 'picketWhite'), gate(5, 0)], opts).gates[0].kind, 'picketWhite');
  assert.equal(planFences([fence([[0, 0], [20, 0]]), gate(5, 0)], opts).gates[0].kind, 'board');
  assert.equal(planFences([fence([[0, 0], [20, 0]], 'wire'), gate(5, 0)], opts).gates[0].kind, 'ranch');
});

test('a gate too far from any fence, or put in before the fence was drawn, goes nowhere', () => {
  assert.equal(planFences([fence([[0, 0], [20, 0]], 'wire'), gate(10, GATE_REACH + 0.5)], opts).gates.length, 0);
  assert.equal(planFences([gate(10, 0), fence([[0, 0], [20, 0]], 'wire')], opts).gates.length, 0);
});

test('a gate stays on one straight run of the fence, and two gates never overlap', () => {
  const P = planFences([fence([[0, 0], [10, 0], [10, 10]], 'wire'), gate(9.6, 0)], opts);
  const G = P.gates[0];
  assert.ok(G.b <= 10 + 1e-6, 'kept short of the corner'); assert.ok(Math.abs(G.B[1]) < 1e-9 && Math.abs(G.A[1]) < 1e-9);
  const Q = planFences([fence([[0, 0], [20, 0]], 'picket'), gate(10, 0), gate(10.5, 0)], opts);
  assert.equal(Q.gates.length, 1);
});

test('Clear with the fence chosen takes down a styled fence under the brush, and a gate under it; with the gate chosen, the gate only', () => {
  const P = planFences([fence([[0, 0], [20, 0]], 'picket'), clear([[5, 0]])], opts);
  assert.equal(P.runs[0].pieces.length, 2);
  assert.ok(P.runs[0].pieces[0].b < 4 && P.runs[0].pieces[1].a > 6);
  assert.equal(planFences([fence([[0, 0], [20, 0]], 'picket'), gate(10, 0), clear([[10, 0]])], opts).gates.length, 0);
  const Q = planFences([fence([[0, 0], [20, 0]], 'picket'), gate(10, 0), clear([[10, 0]], GATE, 0.8)], opts);
  assert.equal(Q.gates.length, 0); assert.equal(Q.runs[0].pieces.length, 1, 'the fence stays whole');
  // (the plain fence's own rule, its posts taken out one by one, is valley.js's, as before: no cut planned here)
  assert.equal(planFences([fence([[0, 0], [20, 0]]), clear([[5, 0]])], opts).runs[0].pieces.length, 1);
});

test('the zigzag fence stands on its zigzag: both ends on the line, the corners 0.7 m either side, every panel at the same slant', () => {
  const C = wormCorners([[0, 0], [26, 0]], 2.6, 0.7), n = C.length;
  assert.equal(n, 12);
  assert.deepEqual(C[0], [0, 0]); assert.ok(Math.abs(C[n - 1][0] - 26) < 1e-9 && Math.abs(C[n - 1][1]) < 1e-9);
  for (let i = 1; i < n - 1; i++) assert.ok(Math.abs(Math.abs(C[i][1]) - 0.7) < 1e-9 && (i === n - 2 || Math.sign(C[i][1]) !== Math.sign(C[i + 1][1])));
  const slant = (i) => Math.atan2(Math.abs(C[i + 1][1] - C[i][1]), C[i + 1][0] - C[i][0]) * 180 / Math.PI;
  for (let i = 0; i < n - 1; i++) assert.ok(slant(i) > 24 && slant(i) < 32, `panel ${i}: ${slant(i).toFixed(1)} degrees`);
  // a short run (a gate's either side) still zigzags at that slant
  const S = wormCorners([[0, 0], [6.1, 0]], 2.6, 0.7);
  assert.equal(S.length, 4); assert.ok(Math.atan2(0.7, S[1][0]) * 180 / Math.PI > 22);
  const piece = { pts: [[0, 0], [26, 0]] };
  assert.deepEqual(fenceLines('worm', piece), C);
  assert.deepEqual(fenceLines('corral', piece), piece.pts);
});

test('the lab\'s gate tool finds the fence clicked', () => {
  const P = planFences([fence([[0, 0], [20, 0]], 'buck'), fence([[0, 30], [20, 30]], 'wattle')], opts);
  const n = nearestFence(P, 7, 1.2); assert.ok(n && n.run.style === 'buck' && Math.abs(n.x - 7) < 1e-9 && Math.abs(n.z) < 1e-9);
  assert.equal(nearestFence(P, 7, 15), null);
});

test('a fence\'s style is kept by the planting, written into the decor and read back by the game the same', () => {
  const kept = normalisePlanting({ strokes: [fence([[0, 0], [5, 0]], 'logRail'), fence([[0, 2], [5, 2]]), { ...fence([[0, 4], [5, 4]]), style: '<script>' }, gate(2, 0)] });
  assert.equal(kept.strokes[0].style, 'logRail');
  assert.ok(!('style' in kept.strokes[1]), 'no style: none written');
  assert.ok(!('style' in kept.strokes[2]), 'nonsense dropped');
  assert.equal(kept.strokes[3].kind, GATE);
  const layout = { items: [] }, shipped = { layout, planting: normalisePlanting({ strokes: [] }) }, now = { layout, planting: kept };
  const decor = JSON.parse(decorText(makeDecor(shipped, now)));
  assert.equal(decor.planting.strokes[0].style, 'logRail');
  assert.ok(!('style' in decor.planting.strokes[1]));
  const back = normalisePlanting(applyDecor(layout, shipped.planting, decor).planting);
  assert.deepEqual(back.strokes.map((s) => [s.kind, s.style || null, s.pts]), kept.strokes.map((s) => [s.kind, s.style || null, s.pts]));
  // the same stroke with another style is a change the lab writes
  const restyled = normalisePlanting({ strokes: [{ ...kept.strokes[0], style: 'corral' }] });
  assert.equal(makeDecor({ layout, planting: normalisePlanting({ strokes: [kept.strokes[0]] }) }, { layout, planting: restyled }).planting.strokes[0].style, 'corral');
});
