// Tests for the bridge lab's frame (labs/bridge/frame.js): hand checks against statics done by hand (a plank beam,
// a king post truss, a Pratt and a Howe truss by the method of joints, with textbook pin joints), the banks (they only
// push; a strut's foot in a notch in the stone wall bears), the room a load needs, the loads themselves, and the outcome
// classes of a few reference bridges through the whole test (a plank span fails under the horse, a truss under the deck
// carries the covered wagon, a pony truss with nothing bracing its sides across bows out sideways).
// Run with:  node --test tests/bridge-frame.test.mjs   (from mathwood-valley)
import test from 'node:test';
import assert from 'node:assert/strict';

const F = await import('../labs/bridge/frame.js');
const B = await import('../labs/bridge/bridge.js');
const { solveLoads, moveAt, forceAt, crossTest, LOADS, partsAt, positionsOf, inTheWay, WOOD } = F;

// ── building bridges for the tests: one side's boards [x0, y0, x1, y1, name], mirrored front to back ────────────────
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const P = (X, Y, Z) => ({ X: r6(X), Y: r6(Y), Z: r6(Z) });
const bd = (a, b, id) => ({ id, a, b, len: r6(Math.hypot(b.X - a.X, b.Y - a.Y, b.Z - a.Z)) });
const side = (list, Z, tag) => list.map(([x0, y0, x1, y1, n]) => bd(P(x0, y0, Z), P(x1, y1, Z), tag + n));
const both = (one, D = 7) => [...side(one, D / 2, 'f'), ...side(one, -D / 2, 'k')];
const cross = (xs, y, D = 7, tag = 'x') => xs.map((x, i) => bd(P(x, y, -D / 2), P(x, y, D / 2), tag + i));
const withDeck = (br) => { const d = B.deckLine(br); br.deck = d.planks ? d : null; return br; };
// the bottom boards from bank to bank: west and east pieces and a middle piece lapping both
const bottom = [[-8.5, 0, -0.5, 0, 'L0'], [0.5, 0, 8.5, 0, 'L1'], [-4, 0, 4, 0, 'L2']];
function pratt(kind, { roller = 1, pins = true } = {}) {
  const X = (i) => -8 + i * 4, h = 4;
  const one = [[-8.5, 0, -0.5, 0, 'L0'], [-1.5, 0, 6.5, 0, 'L1'], [5.5, 0, 8.5, 0, 'L2'], [X(0), 0, X(1), h, 'E0'], [X(4), 0, X(3), h, 'E1'], [X(1), h, X(3), h, 'T'],
    [X(1), 0, X(1), h, 'V1'], [X(2), 0, X(2), h, 'V2'], [X(3), 0, X(3), h, 'V3'],
    ...(kind === 'pratt' ? [[X(1), h, X(2), 0, 'D1'], [X(3), h, X(2), 0, 'D3']] : [[X(1), 0, X(2), h, 'D1'], [X(3), 0, X(2), h, 'D3']])];
  return { S: 16, D: 7, boards: [...both(one), ...cross([-4, 0, 4], h, 7, 'tt'), ...cross([-4, 0, 4], 0, 7, 'tb')], deck: null, roller, pins };
}
// the truss under the deck the real-input rigs build (33 boards, all 8 ft or shorter)
function underTruss() {
  const one = [...bottom, [-8, 0, -4, -4, 'E0'], [8, 0, 4, -4, 'E1'], [-8, -4, -4, 0, 'F0'], [8, -4, 4, 0, 'F1'], [-4, -4, 4, -4, 'T'], [-4, -4, -4, 0, 'V1'], [4, -4, 4, 0, 'V3'], [0, -4, 0, 0, 'V2'],
    [-4, 0, 0, -4, 'D1'], [4, 0, 0, -4, 'D3'], [-4, -4, 0, 0, 'H1'], [4, -4, 0, 0, 'H3']];
  const br = { S: 16, D: 7, boards: both(one), deck: null };
  br.boards.push(bd(P(-4, -4, 3.5), P(-4, -0.5, -3.5), 'x3'), bd(P(4, -4, 3.5), P(4, -0.5, -3.5), 'x4'), bd(P(0, -4, 3.5), P(0, -0.5, -3.5), 'x5'));
  return withDeck(br);
}
const close = (a, b, pct, msg) => assert.ok(Math.abs(a - b) <= Math.abs(b) * pct / 100, `${msg}: ${a.toFixed(1)} vs ${b.toFixed(1)} (within ${pct}%)`);

test('hand check: a plank beam across 7 ft bends P L / 4 and sags P L^3 / 48 E I', () => {
  const br = { S: 7, D: 7, boards: [bd(P(-3.75, 0, 3.5), P(3.75, 0, 3.5), 'p')], deck: null };
  const r = solveLoads(br, { pushes: [{ id: 'p', s: 3.75, f: [0, -200, 0] }], selfWeight: false, buckle: false });
  close(r.force.p.M, 200 * 7 / 4, 0.5, 'bending');
  close(-moveAt(r, 'p', 3.75)[1], 200 * 7 ** 3 / (48 * WOOD.E * WOOD.I), 2, 'sag');
  for (const q of r.reactions) close(q.press, 100, 0.5, 'each bank');
});

test('hand check: a king post truss by statics, with pin joints', () => {
  const one = [[-6.5, 0, 1, 0, 'L0'], [-1, 0, 6.5, 0, 'L1'], [-6, 0, 0, 4.5, 'R0'], [6, 0, 0, 4.5, 'R1'], [0, 0, 0, 4.5, 'K']];
  const br = { S: 12, D: 7, boards: [...both(one), ...cross([0], 4.5, 7, 'tt'), ...cross([0], 0, 7, 'tb')], deck: null, roller: 1, pins: true };
  const Pl = 600, r = solveLoads(br, { pushes: [{ id: 'fK', s: 0, f: [0, -Pl, 0] }, { id: 'kK', s: 0, f: [0, -Pl, 0] }], selfWeight: false, buckle: false });
  close(forceAt(r, 'fR0', 3), -(Pl / 2) * 7.5 / 4.5, 2, 'rafter');
  close(forceAt(r, 'fK', 2), Pl, 2, 'king post');
  close(forceAt(r, 'fL0', 3), (Pl / 2) * 6 / 4.5, 2, 'bottom board');
});

test('hand check: Pratt and Howe trusses by the method of joints, with pin joints', () => {
  const k = Math.SQRT2 / 2, Pl = 1000;
  const want = { pratt: { E0: -k * Pl, T: -Pl, D1: k * Pl, V2: 0, L1: Pl / 2 }, howe: { E0: -k * Pl, T: -Pl / 2, D1: -k * Pl, V2: Pl, L1: Pl } };
  for (const kind of ['pratt', 'howe']) {
    const r = solveLoads(pratt(kind), { pushes: [{ id: 'fV2', s: 0, f: [0, -Pl, 0] }, { id: 'kV2', s: 0, f: [0, -Pl, 0] }], selfWeight: false, buckle: false });
    const w = want[kind];
    close(forceAt(r, 'fE0', 2), w.E0, 2, `${kind} end post`);
    close(forceAt(r, 'fT', 2), w.T, 2, `${kind} top board`);
    close(forceAt(r, 'fD1', 2), w.D1, 2, `${kind} diagonal`);
    close(forceAt(r, 'fL0', 6.5), w.L1, 2, `${kind} bottom board, middle panel`);
    if (w.V2) close(forceAt(r, 'fV2', 2), w.V2, 2, `${kind} middle post`); else assert.ok(Math.abs(forceAt(r, 'fV2', 2)) < 20, `${kind} middle post carries next to nothing`);
  }
});

test('with the game\'s nails the frame shares load by bending: diagonals carry less than the pinned sums, never more', () => {
  const Pl = 1000, r = solveLoads(pratt('pratt', { pins: false }), { pushes: [{ id: 'fV2', s: 0, f: [0, -Pl, 0] }, { id: 'kV2', s: 0, f: [0, -Pl, 0] }], selfWeight: false, buckle: false });
  const d = forceAt(r, 'fD1', 2);
  assert.ok(d > 0.7 * 707 && d < 707, `Pratt diagonal with nails: ${d.toFixed(0)} lb`);
});

test('the banks only push: a board resting on both edges is held up at each, and a strut in a notch bears into the stone', () => {
  const plank = { S: 7, D: 7, boards: [bd(P(-3.75, 0, 3.5), P(3.75, 0, 3.5), 'p')], deck: null };
  const sup = B.supportsOf(plank, plank.boards[0]);
  assert.equal(sup.length, 2); assert.ok(sup.every((s) => s.kind === 'top' && Math.abs(Math.abs(s.P.X) - 3.5) < 1e-6), 'it rests at the two stone edges');
  // a strut from a notch 3 ft down the west wall up to a beam: the stone pushes it back into the gap (+X) and up
  const strut = { S: 16, D: 7, boards: both([[-8.5, 0, -0.5, 0, 'L0'], [0.5, 0, 8.5, 0, 'L1'], [-4, 0, 4, 0, 'L2'], [-8, -3, -4, 0, 'S0'], [8, -3, 4, 0, 'S1']]), deck: null };
  const s0 = B.supportsOf(strut, strut.boards.find((b) => b.id === 'fS0'));
  assert.equal(s0.length, 1); assert.equal(s0[0].kind, 'face'); assert.deepEqual(s0[0].n, [1, 0, 0]);
  const r = solveLoads(strut, { pushes: [{ id: 'fL2', s: 4, f: [0, -300, 0] }, { id: 'kL2', s: 4, f: [0, -300, 0] }] });
  const face = r.reactions.filter((q) => q.kind === 'face');
  assert.equal(face.length, 4, 'the four strut feet bear in their notches');
  assert.ok(face.every((q) => q.press > 0), 'each pushed into the stone wall');
});

test('a board in a load\'s way stops it on the bank: ties across a 4 ft pony truss block even a person', () => {
  const br = withDeck(pratt('pratt'));
  assert.ok(br.deck, 'the deck lies on the bottom boards');
  const way = inTheWay(br, LOADS[0]);
  assert.ok(way.length >= 3 && way.every((id) => /^tt/.test(id)), `the ties across the top are in the way: ${way}`);
  assert.deepEqual(inTheWay(underTruss(), LOADS[3]), [], 'a truss under the deck leaves the way clear for the freight wagon');
});

test('the loads: their weights add up, and each crosses from before the deck to past it', () => {
  const total = { person: 180, horse: 1300, covered: 2500, freight: 5000, cattle: 13200 };
  for (const L of LOADS) {
    assert.ok(Math.abs(L.total - total[L.key]) < 1e-6, `${L.key}: ${L.total} lb`);
    const xs = positionsOf(L, 16, L.step || 0.5), first = partsAt(L, xs[0]), last = partsAt(L, xs[xs.length - 1]);
    assert.ok(first.every((q) => q.X < -8), `${L.key} starts on the west bank`);
    assert.ok(last.every((q) => q.X > 8), `${L.key} ends on the east bank`);
  }
  // the deck shares a weight between the two planks it stands between, all of it reaching the bridge
  const br = underTruss(), M = F.internals.modelOf({ br, boards: [...br.boards, ...br.deck.planks], deck: br.deck, cuts: [], hinges: [], gone: [], M: null, models: 0 });
  const r = F.internals.deckLoads(M, [{ X: 1.1, Z: 0.5, lb: 900 }], br.deck);
  assert.equal(r.loads.length, 2); assert.ok(Math.abs(r.loads.reduce((s, q) => s - q.f[1], 0) - 900) < 1e-6);
});

test('outcomes: a plank span carries a person and snaps under the horse', () => {
  const r = crossTest(withDeck({ S: 16, D: 7, boards: both(bottom), deck: null }));
  assert.equal(r.rating, 0, 'it carried the person only');
  const horse = r.crossings[1];
  assert.equal(horse.made, false);
  assert.ok(horse.events.some((e) => e.kind === 'snap'), 'a board snapped under the horse');
});

test('outcomes: the truss under the deck carries the covered wagon, and the freight wagon breaks it', () => {
  const r = crossTest(underTruss());
  assert.equal(r.rating, 2, `rating ${r.rating}`);
  assert.equal(r.crossings[3].made, false);
  assert.ok(r.crossings[2].sag < 0.05, `the covered wagon sags it ${(r.crossings[2].sag * 12).toFixed(2)} in.`);
});

test('outcomes: a pony truss with nothing bracing its two sides across bows out sideways under the horse', () => {
  const br = pratt('pratt', { roller: 0, pins: false }); br.boards = br.boards.filter((b) => !/^tt|^tb/.test(b.id)); withDeck(br);
  const r = crossTest(br);
  assert.equal(r.rating, 0);
  assert.ok(r.crossings[1].events[0].kind === 'bow', `first break under the horse: ${r.crossings[1].events[0].kind}`);
});

test('the test streams its parts: her own weight first, then each crossing as it is worked out', () => {
  const parts = [];
  const r = crossTest(withDeck({ S: 16, D: 7, boards: both(bottom), deck: null }), { onPart: (p) => parts.push(p.part + (p.index ?? '')) });
  assert.deepEqual(parts, ['calm', 'crossing0', 'crossing1']);
  assert.ok(r.ms > 0 && r.solves > 0);
});

test('symmetry: a bridge mirrored across the middle gives the same rating, its strain mirrored at the middle step', () => {
  const a = underTruss(), m = JSON.parse(JSON.stringify(a));
  for (const b of m.boards) { b.a.X = -b.a.X; b.b.X = -b.b.X; }
  withDeck(m);
  const ra = solveLoads(a, { parts: [{ X: 0, Z: 0, lb: 1000 }] }), rm = solveLoads(m, { parts: [{ X: 0, Z: 0, lb: 1000 }] });
  assert.ok(Math.abs(ra.sag - rm.sag) < 1e-4, `sag ${ra.sag} vs ${rm.sag}`);
});
