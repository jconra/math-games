// Tests for the windmill lab's 3D wind test (labs/windmill/frame.js): the outcome classes of the reference towers,
// symmetry, the wind across a board, the collapse carrying on to the end, a setback tower, and speed.
// Run with:  node --test tests/windmill-frame.test.mjs   (from bandit-math)
import test from 'node:test';
import assert from 'node:assert/strict';

const F = await import('../labs/windmill/frame.js');
const { windTest, windOn, WINDS, WOOD, DRAG, pressure, internals: I } = F;

// ── the reference towers (the same ones the v2 physics was measured on): built the way the v2 lab's twins built them,
// four faces seen from outside (front and right side as given, back and left side mirrored), then put in the world ──
const deg = Math.PI / 180;
let uid = 0;
function oldFrame(W, storeys, { braces = 'none', missing = null, knee = 3 } = {}) {
  const t = { W, walls: [[], [], [], []], corners: [[], [], [], []] };
  const posts = (y, len = 8) => { for (let c = 0; c < 4; c++) t.corners[c].push({ id: 'p' + uid++, y, len }); };
  const allWalls = (x, y, angDeg, len, only = [0, 1, 2, 3]) => {
    for (const k of only) { const m = k >= 2; t.walls[k].push({ id: 'b' + uid++, x: m ? W - x : x, y, ang: m ? Math.PI - angDeg * deg : angDeg * deg, len }); }
  };
  const braceDeg = Math.acos(Math.min(1, W / 8)) / deg;
  for (let i = 0; i < storeys; i++) { posts(i * 8); allWalls(0, (i + 1) * 8, 0, W); }
  for (let i = 0; i < storeys; i++) {
    const y = i * 8;
    if (braces === 'diag') allWalls(0, y, braceDeg, 8, [0, 1, 2, 3].filter((k) => !(missing && missing.storey === i && missing.wall === k)));
    if (braces === 'cross') { allWalls(0, y, braceDeg, 8); allWalls(W, y, 180 - braceDeg, 8); }
    if (braces === 'knee') { const d = knee / Math.SQRT2; allWalls(0, y + 8 - d, 45, knee); allWalls(W, y + 8 - d, 135, knee); }
  }
  t.posts = posts; t.allWalls = allWalls;
  return t;
}
const r6 = (v) => { const r = Math.round(v * 1e6) / 1e6; return r === 0 ? 0 : r; };
function toWorld(t) {
  const W = t.W, D = W, h = W / 2, d = D / 2, boards = [];
  const f2w = (k, x, y) => [{ X: -h + x, Y: y, Z: d }, { X: h, Y: y, Z: d - x }, { X: h - x, Y: y, Z: -d }, { X: -h, Y: y, Z: -d + x }][k];
  const P = (p) => ({ X: r6(p.X), Y: r6(p.Y), Z: r6(p.Z) });
  t.walls.forEach((wall, k) => { for (const b of wall) boards.push({ id: b.id, a: P(f2w(k, b.x, b.y)), b: P(f2w(k, b.x + Math.cos(b.ang) * b.len, b.y + Math.sin(b.ang) * b.len)), len: b.len, n: k % 2 ? 'X' : 'Z' }); });
  const CORNER = [[-h, d], [h, d], [h, -d], [-h, -d]];
  t.corners.forEach((list, c) => { for (const p of list) boards.push({ id: p.id, a: P({ X: CORNER[c][0], Y: p.y, Z: CORNER[c][1] }), b: P({ X: CORNER[c][0], Y: p.y + p.len, Z: CORNER[c][1] }), len: p.len, n: c % 2 ? 'X' : 'Z' }); });
  return { W, D, boards };
}
const REF = {
  unbraced8: oldFrame(6, 1), unbraced16: oldFrame(6, 2), unbraced24: oldFrame(6, 3),
  knee16: oldFrame(6, 2, { braces: 'knee' }), diag16: oldFrame(6, 2, { braces: 'diag' }), diag24: oldFrame(6, 3, { braces: 'diag' }),
  cross16: oldFrame(6, 2, { braces: 'cross' }),
  missingUpperFront16: oldFrame(6, 2, { braces: 'diag', missing: { storey: 1, wall: 0 } }),
  missingLowerFront16: oldFrame(6, 2, { braces: 'diag', missing: { storey: 0, wall: 0 } }),
  missingLowerRight16: oldFrame(6, 2, { braces: 'diag', missing: { storey: 0, wall: 1 } }),
  diag16_w2: oldFrame(2, 2, { braces: 'diag' }), diag16_w4: oldFrame(4, 2, { braces: 'diag' }), diag16_w8: oldFrame(8, 2, { braces: 'diag' }),
  cross16_w4: oldFrame(4, 2, { braces: 'cross' }),
  topHeavy24: (() => { const t = oldFrame(6, 2, { braces: 'diag' }); t.posts(16); t.allWalls(0, 24, 0, t.W); return t; })(),
  lonePostOnTop: (() => { const t = oldFrame(6, 2, { braces: 'diag' }); t.corners[0].push({ id: 'lone', y: 16, len: 8 }); return t; })(),
  loneBoardOnTop: (() => { const t = oldFrame(6, 2, { braces: 'diag' }); t.walls[0].push({ id: 'lone', x: 3, y: 16, ang: 90 * deg, len: 8 }); return t; })(),
};
const T = Object.fromEntries(Object.entries(REF).map(([k, t]) => [k, toWorld(t)]));
const R = Object.fromEntries(Object.entries(T).map(([k, t]) => [k, windTest(t)]));
const failStage = (r) => r.stages.findIndex((s) => s.gave);     // -1: nothing gave
const kinds = (r) => r.gusts.flatMap((g) => g.events.map((e) => e.kind));

// ── a few towers built in the world directly ──
const B = (id, a, b, n) => ({ id, a: { X: r6(a[0]), Y: r6(a[1]), Z: r6(a[2]) }, b: { X: r6(b[0]), Y: r6(b[1]), Z: r6(b[2]) }, len: r6(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])), n });
function storey(out, x0, x1, z0, z1, y0, h, { braces = true, blen = 8, tag = '' } = {}) {
  for (const [x, z, n] of [[x0, z1, 'Z'], [x1, z1, 'X'], [x1, z0, 'Z'], [x0, z0, 'X']]) out.push(B(`p${tag}${out.length}`, [x, y0, z], [x, y0 + h, z], n));
  out.push(B(`c${tag}${out.length}`, [x0, y0 + h, z1], [x1, y0 + h, z1], 'Z'), B(`c${tag}${out.length + 1}`, [x0, y0 + h, z0], [x1, y0 + h, z0], 'Z'));
  out.push(B(`c${tag}${out.length}`, [x1, y0 + h, z1], [x1, y0 + h, z0], 'X'), B(`c${tag}${out.length + 1}`, [x0, y0 + h, z1], [x0, y0 + h, z0], 'X'));
  if (braces) {
    const rw = Math.sqrt(blen * blen - (x1 - x0) ** 2), rd = Math.sqrt(blen * blen - (z1 - z0) ** 2);
    out.push(B(`b${tag}${out.length}`, [x0, y0, z1], [x1, y0 + rw, z1], 'Z'), B(`b${tag}${out.length + 1}`, [x0, y0, z0], [x1, y0 + rw, z0], 'Z'));
    out.push(B(`b${tag}${out.length}`, [x1, y0, z1], [x1, y0 + rd, z0], 'X'), B(`b${tag}${out.length + 1}`, [x0, y0, z1], [x0, y0 + rd, z0], 'X'));
  }
  return out;
}
// a setback tower: a 6 x 4 base, beams across its top, a 2 x 3 tier on the beams, beams again, a 1 x 1 on top
// (topH: how tall the 1 x 1's posts are; its 4 ft braces reach 3.87 ft up them whatever their height)
function setback(braced, topH = 4) {
  const bs = [];
  storey(bs, -3, 3, -2, 2, 0, 8, { tag: 'base' });
  bs.push(B('beamA', [-1, 8, 2], [-1, 8, -2], 'X'), B('beamB', [1, 8, 2], [1, 8, -2], 'X'));
  storey(bs, -1, 1, -1.5, 1.5, 8, 6, { braces: braced, blen: 6, tag: 'mid' });
  bs.push(B('beamC', [-0.5, 14, 1.5], [-0.5, 14, -1.5], 'X'), B('beamD', [0.5, 14, 1.5], [0.5, 14, -1.5], 'X'));
  storey(bs, -0.5, 0.5, -0.5, 0.5, 14, topH, { braces: braced, blen: 4, tag: 'top' });
  return { W: 6, D: 4, boards: bs };
}

// ── the outcome classes (DESIGN.md, Physics item 9) ──────────────────────────────────────────────────────────────────
test('unbraced towers fail early: 8 ft by the gust, 16 and 24 ft in the breeze or the stiff wind', () => {
  assert.ok(failStage(R.unbraced8) >= 0 && failStage(R.unbraced8) <= 2, 'unbraced 8 ft by the gust');
  for (const k of ['unbraced16', 'unbraced24', 'diag16_w8']) assert.ok(failStage(R[k]) >= 0 && failStage(R[k]) <= 1, k + ' early');
  for (const k of ['unbraced8', 'unbraced16', 'unbraced24']) { assert.equal(kinds(R[k])[0], 'rack', k + ' racks'); assert.equal(R[k].height, 0); }
});
test('a knee-braced 16 ft tower fails in one of the gusts; one missing brace fails later than unbraced', () => {
  assert.ok(failStage(R.knee16) >= 2, 'knee braces hold through the stiff wind');
  for (const k of ['missingUpperFront16', 'missingLowerFront16', 'missingLowerRight16']) {
    assert.ok(failStage(R[k]) > failStage(R.unbraced16), k + ' lasts longer than unbraced');
    assert.ok(failStage(R[k]) >= 0, k + ' still fails');
  }
});
test('diagonal and cross braced 16 ft towers stand, on a 6 ft base and on a 4 ft one', () => {
  for (const k of ['diag16', 'cross16', 'diag16_w4', 'cross16_w4']) { assert.ok(R[k].stood, k + ' stands'); assert.equal(R[k].height, 16); }
});
test('a 2 ft base tips over', () => {
  assert.ok(kinds(R.diag16_w2).includes('tip'));
  assert.equal(R.diag16_w2.height, 0);
});
test('a bare storey on a braced 16 ft tower loses only the top; a lone post or board on top goes and the 16 ft stands', () => {
  for (const k of ['topHeavy24', 'lonePostOnTop', 'loneBoardOnTop']) { assert.ok(!R[k].stood, k + ' loses something'); assert.equal(R[k].height, 16, k + ': 16 ft stands to the end'); }
  assert.equal(kinds(R.lonePostOnTop)[0], 'bend');
  assert.deepEqual(R.loneBoardOnTop.gusts[0].events[0].fell, ['lone']);
});

// ── symmetry ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const strainIn = (t, k, mph) => { const st = { W: t.W, D: t.D, boards: t.boards, cuts: [], M: null, models: 0 }; const M = I.modelOf(st); return I.checkAll(M, I.solveWind(M, k, mph)).strain; };
const same = (p, q) => Math.abs(p.X - q.X) < 1e-6 && Math.abs(p.Y - q.Y) < 1e-6 && Math.abs(p.Z - q.Z) < 1e-6;
const imageOf = (t, b, f) => t.boards.find((o) => (same(o.a, f(b.a)) && same(o.b, f(b.b))) || (same(o.a, f(b.b)) && same(o.b, f(b.a))));
test('a tower that is its own mirror image strains the same under wind from the west as from the east, mirrored', () => {
  // cross-braced, every post facing the front: the mirror X -> -X takes it onto itself
  const t = { ...T.cross16, boards: T.cross16.boards.map((b) => (Math.abs(b.a.X - b.b.X) < 1e-9 && Math.abs(b.a.Z - b.b.Z) < 1e-9 ? { ...b, n: 'Z' } : b)) };
  const west = strainIn(t, 0, 50), east = strainIn(t, 1, 50), mX = (p) => ({ X: -p.X, Y: p.Y, Z: p.Z });
  let n = 0;
  for (const b of t.boards) { const m = imageOf(t, b, mX); assert.ok(m, 'every board has a mirror image'); assert.ok(Math.abs(west[b.id] - east[m.id]) < 1e-6, `${b.id}: ${west[b.id]} vs ${east[m.id]}`); n++; }
  assert.equal(n, t.boards.length);
  assert.ok(Math.max(...Object.values(west)) > 0.05, 'and it is strained at all');
});
test('a tower that is its own image turned half round strains the same from the west as from the east, turned', () => {
  // the diagonal 16 ft tower with its back and left braces made the half-turn images of the front and right ones (posts:
  // diagonally opposite corners already face the same way)
  const half = (p) => ({ X: -p.X, Y: p.Y, Z: -p.Z });
  const slanting = (b) => b.a.Y !== b.b.Y && !(b.a.X === b.b.X && b.a.Z === b.b.Z);
  const keep = T.diag16.boards.filter((b) => !(slanting(b) && (b.a.Z === -3 && b.b.Z === -3 || b.a.X === -3 && b.b.X === -3)));
  const images = keep.filter((b) => slanting(b)).map((b) => ({ ...b, id: b.id + 'h', a: half(b.a), b: half(b.b) }));
  const t = { ...T.diag16, boards: [...keep, ...images] };
  assert.equal(t.boards.length, T.diag16.boards.length);
  const west = strainIn(t, 0, 65), east = strainIn(t, 1, 65);
  for (const b of t.boards) { const m = imageOf(t, b, half); assert.ok(m && m.n === b.n); assert.ok(Math.abs(west[b.id] - east[m.id]) < 1e-6, b.id); }
});

// ── the wind across a board (a board leaning 45 degrees) ─────────────────────────────────────────────────────────
test('only the wind blowing across a board pushes it: upright full, leaning 45 deg toward or away half, edge on 3/7', () => {
  const s = Math.SQRT1_2, L = 4, mph = 50, full = pressure(mph, 0) * DRAG * WOOD.width * L;   // (under 5 ft: the same wind all along)
  const one = (a, b, n) => ({ W: 8, D: 8, boards: [B('x', a, b, n)] });
  const size = (t) => Math.hypot(...windOn(t, 2, mph).force) / full;     // wind from the north, toward +Z
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  assert.ok(near(size(one([0, 0, 0], [0, L, 0], 'Z')), 1), 'upright, wide face to the wind');
  assert.ok(near(size(one([0, 0, 0], [0, L * s, -L * s], { X: 0, Y: s, Z: s })), 0.5), 'leaning 45 deg toward the wind');
  assert.ok(near(size(one([0, 0, 0], [0, L * s, L * s], { X: 0, Y: s, Z: -s })), 0.5), 'leaning 45 deg away from it');
  assert.ok(near(size(one([0, 0, 0], [L * s, L * s, 0], 'Z')), 1), 'leaning sideways across the wind, in the wall facing it');
  assert.ok(near(size(one([0, 0, 0], [0, L, 0], 'X')), 1.5 / 3.5), 'in a wall the wind runs along: its edge');
  assert.ok(near(size(one([0, 0, -1.4], [0, L * s, -1.4 + L * s], 'X')), 1.5 / 3.5 / 2), 'edge on and slanting 45 deg');
  assert.ok(near(size(one([0, 1, -2], [0, 1, 2], 'X')), 0), 'lying along the wind');
  // and the push acts square across the board: leaning into the wind, it lifts as much as it pushes
  const w = windOn(one([0, 0, 0], [0, L * s, -L * s], { X: 0, Y: s, Z: s }), 2, mph);
  assert.ok(near(w.force[1] / w.force[2], 1));
});
test('boards behind others are sheltered; total push on four-wall towers is v2-like (shelter) and honest about post faces', () => {
  const d = windOn(T.diag16, 0, 50);
  // the far wall's crosspieces get less than the near wall's
  const near = T.diag16.boards.filter((b) => b.n === 'X' && b.a.X === -3 && b.b.X === -3 && b.a.Y === 8 && b.b.Y === 8);
  const far = T.diag16.boards.filter((b) => b.n === 'X' && b.a.X === 3 && b.b.X === 3 && b.a.Y === 8 && b.b.Y === 8);
  assert.ok(near.length && far.length);
  assert.ok(d.per[far[0].id].along < 0.7 * d.per[near[0].id].along, 'behind the near wall');
  // v2 gave this tower 329.5 lb at 50 mph; edge-on posts (half the corners face the other way) take about a fifth off
  assert.ok(d.total > 0.7 * 329.5 && d.total < 0.9 * 329.5, `total ${d.total}`);
});

// ── the collapse carries on ──────────────────────────────────────────────────────────────────────────────────────────
test('the test runs to the end: the lone board on top blows off in the breeze and the rest goes on through the big gust', () => {
  const r = R.loneBoardOnTop;
  assert.equal(r.gusts[0].stage, 0);
  assert.equal(r.gusts[0].events[0].kind, 'bend');
  assert.deepEqual([...new Set(r.gusts.map((g) => g.stage))], [0, 1, 2, 3], 'every stage is still tried');
  assert.equal(r.standing.boards.length, T.loneBoardOnTop.boards.length - 1);
});
test('the bookkeeping holds: strain for what stands, fell from what stood, standing = start less what fell', () => {
  for (const [name, r] of Object.entries(R)) {
    let up = new Set(T[name].boards.map((b) => b.id));
    for (const g of r.gusts) {
      assert.deepEqual(Object.keys(g.strain).sort(), [...up].sort(), name + ': strain covers the boards standing');
      for (const k of ['stage', 'name', 'mph', 'from', 'dir', 'strain', 'joints', 'move', 'events']) assert.ok(k in g, name + ': gust has ' + k);
      for (const e of g.events) {
        for (const k of ['kind', 'text', 'at', 'plane', 'broke', 'fell', 'after']) assert.ok(k in e, name + ': event has ' + k);
        for (const id of e.fell) { assert.ok(up.has(id), name + ': fell ' + id + ' was standing'); up.delete(id); }
      }
    }
    assert.deepEqual(r.standing.boards.map((b) => b.id).sort(), [...up].sort(), name);
    // (a note, a foot sliding on the dirt with nothing coming down, does not count as giving way)
    assert.equal(r.stood, !r.gusts.some((g) => g.events.some((e) => !e.note)), name);
    assert.ok(Number.isFinite(r.ms) && r.ms >= 0);
  }
});
test('a stage where nothing gave shows one gust; a board touching nothing falls first', () => {
  for (const r of Object.values(R)) for (let s = 0; s < 4; s++) {
    const gs = r.gusts.filter((g) => g.stage === s);
    if (gs.length > 1) assert.ok(gs.every((g) => g.events.length), 'only winds in which something gave');
  }
  const t = { ...T.diag16, boards: [...T.diag16.boards, B('float', [0, 20, 0], [0, 22, 0], 'Z')] };
  const r = windTest(t);
  assert.equal(r.gusts[0].events[0].kind, 'loose');
  assert.deepEqual(r.gusts[0].events[0].fell, ['float']);
  assert.equal(r.height, 16);
});

// ── a setback tower ──────────────────────────────────────────────────────────────────────────────────────────────────
test('a setback tower (6 x 4, a 2 x 3 tier on beams, a 1 x 1 on top), braced, stands 18 ft; unbraced, the tier folds and the base stands', () => {
  const braced = windTest(setback(true)), open = windTest(setback(false));
  assert.equal(braced.height, 18);
  assert.equal(open.height, 8);
  const first = open.gusts.flatMap((g) => g.events)[0];
  assert.equal(first.kind, 'rack');
  assert.ok(first.at.Y > 8, 'it is the tier that folds');
  // the tier's posts stand on the beams, toe-nailed; the beams rest on the base's crosspieces
  const st = { W: 6, D: 4, boards: setback(true).boards, cuts: [], M: null, models: 0 }, M = I.modelOf(st);
  // (a toe joint sits on the carrier's tie to the hub, naming the board standing on it)
  const standsOn = (id) => M.hubs.flatMap((h) => h.items.filter((it) => it.kind === 'toe' && M.boards[it.toeEnd].id === id).map((it) => M.boards[it.b].id));
  for (const b of M.boards.filter((x) => x.id.startsWith('beam'))) assert.equal(standsOn(b.id).length, 2, b.id + ': both ends toe-nailed onto crosspieces');
  for (const b of M.boards.filter((x) => x.id.startsWith('pmid') && x.post)) assert.deepEqual(standsOn(b.id).map((x) => x.slice(0, 4)), ['beam'], b.id + ': its foot toe-nailed onto a beam');
});

// ── the solver ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('a braced tier keeps its margin a foot higher: a brace\'s foot beside a post\'s on a beam adds its own toe-nails, and a top that tips with its floor is not racking', () => {
  // the setback with a 5 ft 1 x 1 (19 ft), as built by hand in the play-test: it stands the whole test
  const r = windTest(setback(true, 5));
  assert.ok(r.stood, 'the 19 ft setback stands');
  assert.equal(r.height, 19);
  // every tier post stands on a beam with the braces' feet beside it: the beam's toe joint there counts them all
  const st = { W: 6, D: 4, boards: setback(true, 5).boards, cuts: [], hinges: [], M: null, models: 0 }, M = I.modelOf(st);
  const toes = M.hubs.flatMap((h) => h.items.filter((it) => it.kind === 'toe' && M.boards[it.toeEnd].post && M.boards[it.toeEnd].id.startsWith('pmid')));
  assert.deepEqual(toes.map((it) => it.toeN).sort(), [1, 2, 2, 3], 'post alone, post and one brace foot (twice), post and two');
  // in the big gust the 1 x 1 tips a little with the beams under it, but leans on its own floor far less than 1/30
  for (const k of [0, 1, 2, 3]) {
    const chk = I.checkAll(M, I.solveWind(M, k, 65));
    for (const it of chk.items) if (it.type === 'drift' && it.id.startsWith('ptop')) assert.ok(it.util < 0.5, `${it.id} leans ${it.util.toFixed(2)} of the limit in the ${F.WINDS[k].from} wind`);
    const shared = chk.items.filter((it) => it.type === 'joint' && it.kind === 'toe' && it.toeN > 1);
    assert.equal(shared.filter((it) => Math.abs(it.P[1] - 8) < 0.01).length, 3, 'the three tier post feet with brace feet beside them');
    assert.equal(shared.filter((it) => Math.abs(it.P[1] - 14) < 0.01).length, 3, 'and the 1 x 1\'s three');
    const toe = Math.max(...shared.map((it) => it.util));
    assert.ok(toe < 0.8, `the shared toe-nails at ${toe.toFixed(2)} in the ${F.WINDS[k].from} wind`);
  }
});
test('calm air first: a tier with no beam under one side comes down before the wind, named, and the sound base is never painted past its limit', () => {
  const t = setback(true); t.boards = t.boards.filter((b) => b.id !== 'beamA');
  const r = windTest(t), g0 = r.gusts[0], calm = g0.events.filter((e) => e.calm);
  assert.ok(calm.length, 'it gives way in calm air');
  assert.deepEqual(g0.events.slice(0, calm.length), calm, 'the calm-air events come first in the first gust');
  assert.ok(g0.calm && g0.calm.strain && g0.calm.move, 'the first gust carries the calm state they start from');
  const named = calm.find((e) => e.nofoot && /stood on nothing/.test(e.text));
  assert.ok(named, 'named by what was missing: ' + calm.map((e) => e.text).join(' / '));
  for (const id of named.nofoot) { const b = t.boards.find((x) => x.id === id); assert.ok(b.a.X === -1 && b.b.X === -1, id + ': a post on the left, where the beam is missing'); }
  assert.equal(r.height, 8, 'the base stands');
  for (const g of r.gusts) for (const [id, v] of Object.entries(g.strain)) if (id.includes('base')) assert.ok(v < 1, `${g.name}/${g.from}: ${id} at ${v}`);
  // a sound tower has nothing to give in calm air; the bookkeeping holds with calm events too
  assert.ok(!windTest(setback(true)).gusts.some((g) => g.events.some((e) => e.calm)));
  let up = new Set(t.boards.map((b) => b.id));
  for (const g of r.gusts) { assert.deepEqual(Object.keys(g.strain).sort(), [...up].sort()); for (const e of g.events) for (const id of e.fell) { assert.ok(up.has(id)); up.delete(id); } }
  assert.deepEqual(r.standing.boards.map((b) => b.id).sort(), [...up].sort());
});
test('after something gives in a stage, the winds that met the tower before are tried again on what is left', () => {
  // the back wall of a 6 x 4 base and a side brace from the front stone up to its back corner post. The back wall racks
  // in the big gust from the north; the side brace is left leaning alone on its stone, and it met the west wind nailed
  // into the wall: it meets it again by itself, and goes
  const t = { W: 6, D: 4, boards: [B('pb', [3, 0, -2], [3, 8, -2], 'Z'), B('pl', [-3, 0, -2], [-3, 8, -2], 'X'), B('cb', [-3, 8, -2], [3, 8, -2], 'Z'),
    B('bb', [-3, 0, -2], [3, 5.291503, -2], 'Z'), B('bs', [3, 0, 2], [3, 6.928203, -2], 'X')] };
  const r = windTest(t), big = r.gusts.filter((g) => g.stage === 3);
  assert.ok(big.length >= 2 && big[0].from === 'north' && big.some((g) => g.from === 'west' && g.events.length), big.map((g) => g.from).join(','));
  assert.equal(r.height, 0, 'no lone brace is left standing');
  // and what any reference test leaves standing holds the big gust again by itself, every wind of it
  for (const [k, rr] of Object.entries(R)) if (rr.height > 0) assert.ok(windTest(rr.standing, { stages: [F.STAGES[3]] }).height >= rr.height - 1e-9, k);
});
test('the band solver agrees with plain elimination', () => {
  const st = { W: 6, D: 6, boards: T.knee16.boards, cuts: [], M: null, models: 0 }, M = I.modelOf(st), n = M.n;
  const K = new Float64Array(n * n);
  for (const el of M.elems) for (let p = 0; p < 12; p++) for (let q = 0; q < 12; q++) K[el.dof[p] * n + el.dof[q]] += el.K[p * 12 + q];
  for (const s of M.springs) {
    const a = (k) => M.dof(s.node, k), b = (k) => M.dof(s.to, k);
    for (let k = 0; k < 3; k++) { K[a(k) * n + a(k)] += s.kt; if (s.to >= 0) { K[b(k) * n + b(k)] += s.kt; K[a(k) * n + b(k)] -= s.kt; K[b(k) * n + a(k)] -= s.kt; } }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const v = s.R[i * 3 + j]; K[a(3 + i) * n + a(3 + j)] += v; if (s.to >= 0) { K[b(3 + i) * n + b(3 + j)] += v; K[a(3 + i) * n + b(3 + j)] -= v; K[b(3 + i) * n + a(3 + j)] -= v; } }
  }
  const u = I.solveEnv(M.env, M.Fg);
  let res = 0, big = 0;
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += K[i * n + j] * u[j]; res = Math.max(res, Math.abs(s - M.Fg[i])); big = Math.max(big, Math.abs(M.Fg[i])); }
  assert.ok(res < 1e-8 * big, `residual ${res}`);
});

// ── speed ────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('speed: the full test on 28 boards cut into 52 pieces takes well under 400 ms', () => {
  const bs = [];
  for (let k = 0; k < 6; k++) storey(bs, -2, 2, -2, 2, 4 * k, 4, { braces: false, tag: 's' + k });
  const r = Math.sqrt(48);
  bs.push(B('br0', [-2, 0, 2], [2, r, 2], 'Z'), B('br1', [-2, 0, -2], [2, r, -2], 'Z'), B('br2', [2, 0, 2], [2, r, -2], 'X'), B('br3', [-2, 0, 2], [-2, r, -2], 'X'));
  const t = { W: 4, D: 4, boards: bs };
  assert.equal(bs.length, 52);
  windTest(t);
  const a = performance.now(); const res = windTest(t); const ms = performance.now() - a;
  assert.ok(ms < 400, `${ms.toFixed(0)} ms`);
  assert.ok(res.gusts.length > 0);
  // and the setback tower
  const b = performance.now(); windTest(setback(true)); assert.ok(performance.now() - b < 400);
});

// ── no cut-off angles; nails that twist loose; leftovers; shelter (fix round 1) ─────────────────────────────────────
const withBoards = (t, extra) => ({ ...t, boards: [...t.boards, ...extra] });
test('a lone board on top goes whatever its tilt: no angle where the bend-over check stops', () => {
  for (const a of [0, 5, 8.1, 10, 20, 30]) {
    const s = Math.sin(a * deg), c = Math.cos(a * deg);
    // lapped 1 ft over diag16's top front crosspiece, and stood on it (toe-nailed)
    for (const [how, y0] of [['lapped', 15], ['standing', 16]]) {
      const r = windTest(withBoards(T.diag16, [B('lone', [0, y0, 3], [8 * s, y0 + 8 * c, 3], 'Z')]));
      const first = r.gusts.flatMap((g) => g.events)[0];
      assert.ok(first && first.fell.includes('lone') && first.fell.length === 1, `${how} at ${a} deg: the board goes alone`);
      assert.equal(first.kind, 'bend', `${how} at ${a} deg: it bends over`);
      assert.ok(first && r.gusts.find((g) => g.events.includes(first)).stage <= 1, `${how} at ${a} deg: by the stiff wind`);
      assert.equal(r.height, 16, `${how} at ${a} deg: the 16 ft under it stands`);
    }
  }
});
test('nails that only twist loose leave a hinge: a board nailed to a corner post does not bring down the braced tower', () => {
  // diag16 with an 8 ft board nailed to a corner post at 4 ft, sticking out at 45 degrees in the front wall's plane
  const r = windTest(withBoards(T.diag16, [B('side', [3, 4, 3], [3 + 8 * Math.SQRT1_2, 4 + 8 * Math.SQRT1_2, 3], 'Z')]));
  assert.equal(r.height, 16);
  assert.deepEqual(r.gusts.flatMap((g) => g.events).flatMap((e) => e.fell), ['side'], 'only the side board comes down');
  // diag24: its corner joint at the top of a thin-way post twists loose in the gust and hinges; the tower goes in the big
  // gust, as v2 had it
  const d = windTest(T.diag24), evs = d.gusts.flatMap((g) => g.events.map((e) => ({ ...e, stage: g.stage })));
  assert.ok(evs.some((e) => e.hinge && e.fell.length === 0), 'a hinge, nothing falling');
  assert.equal(evs.find((e) => e.fell.length).stage, 3, 'the first boards fall in the big gust');
});
test('a tapered storey racks like a square one, whatever its lean (no 8 degree cliff)', () => {
  const lower = T.diag16.boards.filter((b) => Math.max(b.a.Y, b.b.Y) <= 8.001);
  const peaks = [];
  for (const a of [0, 4, 7.9, 8.1, 10, 15]) {
    const z1 = 3 - 8 * Math.tan(a * deg), bs = [...lower];
    for (const x of [-3, 3]) bs.push(B(`uf${x}`, [x, 8, 3], [x, 16, z1], 'X'), B(`ub${x}`, [x, 8, -3], [x, 16, -z1], 'X'), B(`us${x}`, [x, 16, z1], [x, 16, -z1], 'X'));
    bs.push(B('ucf', [-3, 16, z1], [3, 16, z1], 'Z'), B('ucb', [-3, 16, -z1], [3, 16, -z1], 'Z'));
    const r = windTest({ W: 6, D: 6, boards: bs }), first = r.gusts.flatMap((g) => g.events)[0];
    assert.equal(first.kind, 'rack', `${a} deg: the open storey racks`);
    assert.equal(r.height, 8, `${a} deg: the braced storey stands`);
    peaks.push(r.stages[1].peak);
  }
  // the stiff wind's rack eases off smoothly as the storey narrows: no jump at 8 degrees
  for (let i = 1; i < peaks.length; i++) assert.ok(Math.abs(peaks[i] - peaks[i - 1]) < 0.12, `peaks ${peaks.join(', ')}`);
  // and a post leaning on its stone is strapped there like an upright one (its feet don't just slide off)
  const t = { W: 6, D: 6, boards: [] };
  for (const x of [-3, 3]) t.boards.push(B(`pf${x}`, [x, 0, 3], [x, 8, 3 - 8 * Math.tan(10 * deg)], 'X'), B(`pb${x}`, [x, 0, -3], [x, 8, -3 + 8 * Math.tan(10 * deg)], 'X'));
  const r = windTest(t);
  assert.ok(!r.gusts.flatMap((g) => g.events).some((e) => e.kind === 'footing'), 'no feet sliding off the stones');
});
test('what is left after a collapse does not stand on a toe-nail alone, and a prop sliding on the dirt is only a note', () => {
  // the setback with one beam under the tier missing: the tier folds in the breeze, and nothing of it stays up
  const t = setback(true); t.boards = t.boards.filter((b) => b.id !== 'beamB');
  const r = windTest(t);
  assert.equal(r.height, 8);
  // a board propped from the dirt to diag16's front crosspiece: its foot slides, nothing comes down, the tower stood
  const p = windTest(withBoards(T.diag16, [B('prop', [0, 0, 3], [0, 8, 3], 'Z')]));
  const notes = p.gusts.flatMap((g) => g.events).filter((e) => e.note);
  assert.ok(notes.length && notes.every((e) => e.kind === 'footing' && !e.fell.length));
  assert.ok(p.stood, 'a note is not a failure');
  assert.equal(p.height, 16);
});
test('a board touching nothing: the gust it falls in and that event\'s after are separate (after holds only what stands)', () => {
  const r = windTest(withBoards(T.diag16, [B('float', [0, 20, 0], [0, 22, 0], 'Z')]));
  const g = r.gusts[0], e = g.events[0];
  assert.equal(g.strain.float, 1);
  assert.ok(!('float' in e.after.strain) && !('float' in e.after.move), 'after leaves out the board that fell');
  assert.notEqual(g.strain, e.after.strain);
});
test('shelter: a crosspiece shelters about half a foot either side of it, not the whole foot above', () => {
  const t = { W: 6, D: 4, boards: [...storey([], -3, 3, -2, 2, 0, 8, { tag: 's' }), B('stub1', [0, 8, 0], [0, 9, 0], 'X'), B('stub2', [0, 9, 0], [0, 10, 0], 'X')] };
  const all = windOn(t, 0, 50), open = (id) => windOn({ ...t, boards: [t.boards.find((b) => b.id === id)] }, 0, 50).per[id].along;
  const s1 = all.per.stub1.along / open('stub1'), s2 = all.per.stub2.along / open('stub2');
  assert.ok(s1 > 0.55 && s1 < 0.85, `8 to 9 ft: ${s1}`);
  assert.ok(s2 > 0.98, `9 to 10 ft: ${s2}`);
});
