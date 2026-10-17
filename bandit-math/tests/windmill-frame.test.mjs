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

// ── v4: walls that lean (LEAN.md) ──────────────────────────────────────────────────────────────────────────────────────
// Towers with leaning walls, as data (board = { id, a, b, len, n, t }). shapeL(W, D, { F, B, R, L }): the four outer walls,
// each leaning IN k inches in a foot (negative: out): the front wall Z = D/2 - (F/12) Y, the back Z = -D/2 + (B/12) Y,
// the right X = W/2 - (R/12) Y, the left X = -W/2 + (L/12) Y. Corners 0 front-left, 1 front-right, 2 back-right,
// 3 back-left; a corner leg's own wall alternates Z, X, Z, X as the twins put up corner posts (legN: all one way).
const CORN = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
const BL = (id, a, b, n, t = 0) => ({ ...B(id, a, b, n), ...(t ? { t: r6(t) } : {}) });
function shapeL(W, D, k = {}) {
  const tin = { F: (k.F ?? 0) / 12, B: (k.B ?? 0) / 12, R: (k.R ?? 0) / 12, L: (k.L ?? 0) / 12 };
  const tZ = (sz) => (sz > 0 ? -tin.F : tin.B), tX = (sx) => (sx > 0 ? -tin.R : tin.L);
  const corner = (c, Y) => { const [sx, sz] = CORN[c]; return [sx * W / 2 + tX(sx) * Y, Y, sz * D / 2 + tZ(sz) * Y]; };
  const dir = (c) => { const [sx, sz] = CORN[c], v = [tX(sx), 1, tZ(sz)], l = Math.hypot(...v); return v.map((x) => x / l); };
  const WALLS = { front: [0, 1, 'Z', () => tZ(1)], right: [1, 2, 'X', () => tX(1)], back: [2, 3, 'Z', () => tZ(-1)], left: [3, 0, 'X', () => tX(-1)] };
  return { W, D, tX, tZ, corner, dir, WALLS };
}
const legTL = (s, c, n) => (n === 'Z' ? s.tZ(CORN[c][1]) : s.tX(CORN[c][0]));
// a leg up each corner from y0, len long; returns { boards, top }
function legsL(s, y0, len, tag, legN = (c) => (c % 2 ? 'X' : 'Z')) {
  const out = []; let top = 0;
  for (let c = 0; c < 4; c++) { const A = s.corner(c, y0), d = s.dir(c), Bp = A.map((x, i) => x + len * d[i]); out.push(BL(`leg${tag}${c}`, A, Bp, legN(c), legTL(s, c, legN(c)))); top = Bp[1]; }
  return { boards: out, top };
}
// the crosspieces at height y (two pieces lapped a foot in the middle when longer than a board)
function crossL(s, y, tag) {
  const out = [];
  for (const [w, [c0, c1, fam, tf]] of Object.entries(s.WALLS)) {
    const A = s.corner(c0, y), Bp = s.corner(c1, y), L = Math.hypot(Bp[0] - A[0], Bp[2] - A[2]);
    if (L <= 8 + 1e-9) { out.push(BL(`x${tag}${w}`, A, Bp, fam, tf())); continue; }
    const u = [(Bp[0] - A[0]) / L, 0, (Bp[2] - A[2]) / L], M1 = A.map((x, i) => x + u[i] * (L / 2 + 0.5)), M0 = A.map((x, i) => x + u[i] * (L / 2 - 0.5));
    out.push(BL(`x${tag}${w}a`, A, M1, fam, tf()), BL(`x${tag}${w}b`, M0, Bp, fam, tf()));
  }
  return out;
}
// an 8 ft brace in each wall (the twins' pinwheel) from its first corner at y0 up to where it reaches the far leg
function bracesL(s, y0, ymax, tag) {
  return Object.entries(s.WALLS).map(([w, [c0, c1, fam, tf]]) => {
    const A = s.corner(c0, y0), far = (Y) => { const Q = s.corner(c1, Y); return Math.hypot(Q[0] - A[0], Q[1] - A[1], Q[2] - A[2]); };
    let lo = y0, hi = y0 + 8; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (far(m) < 8) lo = m; else hi = m; }
    return BL(`br${tag}${w}`, A, s.corner(c1, Math.min(lo, ymax)), fam, tf());
  });
}
// storeys of whole 8 ft legs, crosspieces at their tops (the way the page builds: a leg's foot stays, its top comes in)
function taperL(W, D, k, { storeys = 2, braces = false, legN } = {}) {
  const s = shapeL(W, D, k), boards = []; let y = 0;
  for (let i = 0; i < storeys; i++) { const L = legsL(s, y, 8, i, legN); boards.push(...L.boards, ...crossL(s, L.top, i)); if (braces) boards.push(...bracesL(s, y, L.top, i)); y = L.top; }
  return { W, D, boards, top: y };
}
// a pyramid: legs from the stones meeting at a point (spliced from 8 ft boards lapped a foot), a ring of crosspieces
// every `ring` ft (while it is a foot across or more), braces from the stones in every face
function pyramidL(W, k, { ring = 6, braces = true } = {}) {
  const s = shapeL(W, W, { F: k, B: k, R: k, L: k }), apex = (W / 2) / (k / 12), boards = [];
  for (let c = 0; c < 4; c++) {
    const A = s.corner(c, 0), d = s.dir(c), L = apex / d[1], n = c % 2 ? 'X' : 'Z';
    for (let st = 0, i = 0; ; i++) { const e = Math.min(L, st + 8); boards.push(BL(`pl${c}_${i}`, A.map((x, j) => x + st * d[j]), A.map((x, j) => x + e * d[j]), n, legTL(s, c, n))); if (e >= L - 1e-9) break; st = e - 1; }
  }
  for (let y = ring; y < apex - 0.75 && W - 2 * y * k / 12 >= 1; y += ring) boards.push(...crossL(s, y, 'r' + y));
  if (braces) boards.push(...bracesL(s, 0, apex, 'p'));
  return { W, D: W, boards, apex };
}
// first-fit, longest first, from 8 ft boards: how many boards
const boardsCut = (t) => { const bins = []; for (const p of t.boards.map((b) => b.len).sort((x, y) => y - x)) { const i = bins.findIndex((r) => r >= p - 1e-9); if (i >= 0) bins[i] -= p; else bins.push(8 - p); } return bins.length; };
const firstGave = (r) => r.stages.findIndex((s) => s.gave);
const oneWindL = (t, k, mph) => { const st = { W: t.W, D: t.D, boards: JSON.parse(JSON.stringify(t.boards)), cuts: [], hinges: [], M: null, models: 0 }, M = I.modelOf(st), sol = I.solveWind(M, k, mph); return { M, sol, chk: I.checkAll(M, sol) }; };
const LEAN = {
  straight16: taperL(6, 6, {}), slight: taperL(6, 6, { F: 1, B: 1, R: 1, L: 1 }), taper16: taperL(6, 6, { F: 1.5, B: 1.5, R: 1.5, L: 1.5 }),
  steep: taperL(6, 6, { F: 2, B: 2, R: 2, L: 2 }), leanOut16: taperL(6, 6, { F: -2, B: -2, R: -2, L: -2 }), frontBack: taperL(6, 6, { F: 1.5, B: 1.5 }),
  taper16Braced: taperL(6, 6, { F: 1.5, B: 1.5, R: 1.5, L: 1.5 }, { braces: true }), pyramid: pyramidL(6, 1.5),
};

test('v4 no lean: the reference towers give exactly what they gave before walls could lean (whole results, hashed)', async () => {
  const crypto = await import('node:crypto');
  const hash = (r) => { const o = { ...r }; delete o.ms; return crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16); };
  // (made with the frame.js of v3, before leaning walls: rigs/windmill/v4/physics/hashes.mjs)
  const V3 = { unbraced8: '49f3f19b0f22359c', unbraced16: 'f85e320e7f7e5a41', unbraced24: 'c6e0012074b42a0d', knee16: '5360ec7b763dc593', diag16: '3f729de8a816a84a', diag24: '1650aaaccc00636a', cross16: '7df34192755ff50c', missingUpperFront16: '8772db4249b8bbb8', missingLowerFront16: 'd4c186f0d161a40d', missingLowerRight16: 'a17227b7bbe85e2b', diag16_w2: 'f051c02aeaa9ee1c', diag16_w4: '02142d500bc822dc', diag16_w8: '72c9309e2ce790fb', cross16_w4: 'e8b2449767deccda', topHeavy24: '9ed20faaa05d8d8c', lonePostOnTop: '330bf83531f2bc8d', loneBoardOnTop: 'a44af5afe1c3013b', setback: 'a79b574f0b0a9fb9', setbackOpen: '6099975c00398980' };
  for (const [k, r] of Object.entries(R)) assert.equal(hash(r), V3[k], k);
  assert.equal(hash(windTest(setback(true))), V3.setback);
  assert.equal(hash(windTest(setback(false))), V3.setbackOpen);
  // t: 0 written on every board changes nothing; nor does a brace leaning 3 in a foot in an upright wall with no leaning
  // wall round it (the CONTRACT calls it a leg; with no board standing in its second wall, it is a brace as before)
  const zero = { ...T.diag16, boards: T.diag16.boards.map((b) => ({ ...b, t: 0 })) }, rz = windTest(zero);
  rz.standing.boards = rz.standing.boards.map(({ t, ...b }) => b);       // (what stands keeps the boards as handed in)
  assert.equal(hash(rz), V3.diag16);
  const narrow = { W: 6, D: 2, boards: [...storey([], -3, 3, -1, 1, 0, 8, { braces: false, tag: 'n' }), B('br', [3, 0, 1], [3, 8, -1], 'X')] };
  const st = { W: 6, D: 2, boards: narrow.boards, cuts: [], hinges: [], M: null, models: 0 };
  assert.ok(!I.modelOf(st).boards.some((b) => b.leg), 'no leg without a leaning wall round it');
});
test('v4 walls: a leg lies in its two walls, keyed as tower.js keys them; a crosspiece across leaning legs shares their wall', () => {
  const bs = I.prepBoards(LEAN.taper16), legs = bs.filter((b) => b.id.startsWith('leg0'));
  assert.equal(legs.length, 4);
  for (const b of legs) assert.ok(b.leg && b.walls.length === 2, b.id + ' in two walls');
  const fl = bs.find((b) => b.id === 'leg00');
  assert.deepEqual(fl.walls.map(I.keyOfWall), ['Z:3~-1.5', 'X:-3~1.5'], 'the front wall leaning in 1½, the left side leaning in 1½');
  assert.ok(I.sharePlane(bs.find((b) => b.id === 'x0front'), fl), 'the front crosspiece and the front-left leg share the front wall');
  assert.ok(I.sharePlane(bs.find((b) => b.id === 'x0left'), fl), '...and the left crosspiece the left wall');
  // (the front crosspiece is lapped onto the leg in their wall; the leg, met in its other wall, turns about that wall)
  const st = { W: 6, D: 6, boards: LEAN.taper16.boards, cuts: [], hinges: [], M: null, models: 0 }, M = I.modelOf(st);
  const hub = M.hubs.find((h) => h.items.some((it) => M.boards[it.b].id === 'x0front') && h.items.some((it) => M.boards[it.b].id === 'leg01'));
  const it = hub.items.find((x) => M.boards[x.b].id === 'x0front'), lg = hub.items.find((x) => M.boards[x.b].id === 'leg01');
  assert.ok(it.lapped, 'the crosspiece is lapped onto the leg');
  const front = [0, 1.5 / 12, 1].map((x) => x / Math.hypot(1, 1.5 / 12));
  assert.ok(lg.soft.some((ax) => Math.abs(ax[0] * front[0] + ax[1] * front[1] + ax[2] * front[2]) > 0.99), 'the leg turns about the leaning front wall\'s normal there (and its own wall\'s)');
});
test('v4 shelter: boards in one leaning wall do not shade each other; a leaning front wall shelters the back at every height', () => {
  // a leg rising up a front wall leaning 7 in a foot, a crosspiece across it at 2 ft: the wind from the south meets the
  // wall; just above the crosspiece the leg stands a hair downwind of it, in the same wall, not behind it
  // (leaning out, toward the wind, the leg just BELOW the crosspiece is the part downwind of it; leaning in, just above)
  for (const [k, ys] of [[7, [1.95, 1.9, 1.85]], [-7, [2.05, 2.1, 2.15]]]) {
    const t = k / 12, s = Math.sqrt(1 + t * t), bs = I.prepBoards({ W: 6, D: 6, boards: [BL('leg', [0, 0, 3], [0, 4 / s, 3 + t * 4 / s], 'Z', t), BL('x', [-2, 2, 3 + 2 * t], [2, 2, 3 + 2 * t], 'Z', t)] });
    const shade = I.shelterFor(bs, [0, 0, -1]), leg = bs.findIndex((b) => b.id === 'leg');
    for (const y of ys) assert.equal(shade([0, y, 3 + t * y], leg), 1, `k=${k}, ${y} ft`);
  }
  // and behind the wall, at each height, the back crosspieces are sheltered (both storeys)
  const w = windOn(LEAN.taper16, 3, 50);
  for (const id of ['x0back', 'x1back']) {
    const open = windOn({ ...LEAN.taper16, boards: [LEAN.taper16.boards.find((b) => b.id === id)] }, 3, 50).per[id].along;
    assert.ok(w.per[id].along < 0.6 * open && w.per[id].along > 0.15 * open, `${id}: ${(w.per[id].along / open).toFixed(2)} of the open push`);
  }
});
test('v4 hand check: a board in a leaning wall bends the thin way across the tilted wall (P L^3 / 3 E Iweak), the wide way in it', () => {
  const keep = { ...F.NAILS.stone }, w = WOOD.weight; Object.assign(F.NAILS.stone, { kt: 1e14, kr: 1e14, kb: 1e14 }); WOOD.weight = 0;
  try {
    for (const k of [-5, 3]) {
      const t = k / 12, s = Math.sqrt(1 + t * t), L = 8, up = [0, 1 / s, t / s], nrm = [0, -t / s, 1 / s];
      const st = { W: 6, D: 6, boards: [BL('b', [-3, 0, 3], [-3, L * up[1], 3 + L * up[2]], 'Z', t)], cuts: [], hinges: [], M: null, models: 0 }, M = I.modelOf(st);
      const tip = M.boardNodes[0].reduce((p, m) => (M.nodes[m].t > M.nodes[p].t ? m : p));
      const push = (f) => { const v = new Float64Array(M.n); for (let q = 0; q < 3; q++) v[M.dof(tip, q)] = f[q]; const u = I.solveEnv(M.env, v); return [0, 1, 2].map((q) => u[M.dof(tip, q)]); };
      const a = push(nrm.map((x) => 100 * x)), b = push([100, 0, 0]);
      const dotp = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
      assert.ok(Math.abs(dotp(a, nrm) / (100 * L ** 3 / (3 * WOOD.E * WOOD.Iweak)) - 1) < 1e-6, `k=${k} thin way`);
      assert.ok(Math.abs(b[0] / (100 * L ** 3 / (3 * WOOD.E * WOOD.I)) - 1) < 1e-6, `k=${k} wide way`);
    }
  } finally { Object.assign(F.NAILS.stone, keep); WOOD.weight = w; }
});
test('v4 hand check: the wind across a board in a wall leaning 7 in a foot: cos^2 of the push up the slope, lifting or pressing; a level one by its tilted shadow', () => {
  const mph = 50, L = 4, q = pressure(mph, 0) * DRAG, near = (a, b) => Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(b));
  for (const k of [7, -7]) {
    const t = k / 12, s = Math.sqrt(1 + t * t), cos = 1 / s, sin = Math.abs(t) / s;
    const up = windOn({ W: 8, D: 8, boards: [BL('u', [0, 0, 3], [0, L / s, 3 + t * L / s], 'Z', t)] }, 3, mph).per.u;
    assert.ok(near(Math.hypot(...up.force), q * WOOD.width * L * cos * cos), `k=${k} push`);
    assert.ok(near(up.force[1], (k > 0 ? 1 : -1) * q * WOOD.width * L * cos * cos * sin), `k=${k} lift`);
    const lv = windOn({ W: 8, D: 8, boards: [BL('c', [-2, 2, 3 + 2 * t], [2, 2, 3 + 2 * t], 'Z', t)] }, 3, mph).per.c;
    assert.ok(near(-lv.force[2], q * (WOOD.width * cos + WOOD.thick * sin) * L), `k=${k} level`);
  }
});
test('v4 hand check: a tapered portal pushed sideways: half the push at each foot, the turn by statics; stiffer by its joints as it narrows', () => {
  const w = WOOD.weight; WOOD.weight = 0;
  try {
    const stiff = {};
    for (const b of [3, 1]) {
      const bs = [BL('L', [-3, 0, 3], [-b, 6, 3], 'Z'), BL('R', [3, 0, 3], [b, 6, 3], 'Z'), BL('C', [-b, 6, 3], [b, 6, 3], 'Z')];
      const st = { W: 6, D: 6, boards: bs, cuts: [], hinges: [], M: null, models: 0 }, M = I.modelOf(st), H = 100;
      const iC = M.boards.findIndex((x) => x.id === 'C'), ends = [0, M.boards[iC].L].map((tt) => M.boardNodes[iC].reduce((p, m) => (Math.abs(M.nodes[m].t - tt) < Math.abs(M.nodes[p].t - tt) ? m : p)));
      const f = new Float64Array(M.n); for (const e of ends) f[M.dof(e, 0)] += H / 2;
      const u = I.solveEnv(M.env, f);
      const sp = (id) => M.springs.find((x) => M.boards[x.it.b].id === id && x.it.kind === 'stone');
      const R = (id) => { const s = sp(id), d = M.dof(s.node, 0); return [0, 1, 2].map((q) => -s.kt * u[d + q]); };
      const Mz = (id) => { const s = sp(id), d = M.dof(s.node, 3); return -(s.R[6] * u[d] + s.R[7] * u[d + 1] + s.R[8] * u[d + 2]); };
      assert.ok(Math.abs(-R('L')[0] / (H / 2) - 1) < 1e-6 && Math.abs(-R('R')[0] / (H / 2) - 1) < 1e-6, 'half the push at each foot');
      const V = (H * 6 - Mz('L') - Mz('R')) / 6;
      assert.ok(Math.abs(R('R')[1] / V - 1) < 1e-6 && Math.abs(-R('L')[1] / V - 1) < 1e-6, `the feet press and lift by (H h - the straps' turn) / 2a: ${R('R')[1]}, ${-R('L')[1]} vs ${V}`);
      const sway = (u[M.dof(ends[0], 0)] + u[M.dof(ends[1], 0)]) / 2, hand = 2 * (F.NAILS.stone.kr + F.NAILS.face.kr / 2 * (3 / b) ** 2) / 36;
      assert.ok(Math.abs(H / sway / hand - 1) < 0.1, `b=${b}: within 10% of the joint-spring sum (${(H / sway).toFixed(0)} vs ${hand.toFixed(0)})`);
      stiff[b] = H / sway;
    }
    assert.ok(stiff[1] > 3 * stiff[3], 'narrowing from 6 ft to 2 ft at 6 ft up: over three times as stiff');
  } finally { WOOD.weight = w; }
});
test('v4 hand check: two legs meeting at a peak each carry P / 2cos(a); the feet push out P/2 tan(a); the peak nails slide by that', () => {
  const w = WOOD.weight; WOOD.weight = 0;
  try {
    for (const k of [0, -3]) {
      const t = k / 12, s = Math.sqrt(1 + t * t), up = [0, 1 / s, t / s], peak = [0, 6 * up[1], 3 + 6 * up[2]], P = 200;
      const st = { W: 6, D: 6, boards: [BL('L', [-3, 0, 3], peak, 'Z', t), BL('R', [3, 0, 3], peak, 'Z', t)], cuts: [], hinges: [], M: null, models: 0 }, M = I.modelOf(st);
      const hub = M.hubs.find((h) => !h.ground), f = new Float64Array(M.n); for (let q = 0; q < 3; q++) f[M.dof(hub.node, q)] = -P * up[q];
      const u = I.solveEnv(M.env, f), chk = I.checkAll(M, { u, N: new Float64Array(M.elems.length), unstable: false, k: 0, mph: 0 });
      const a = Math.atan(3 / 6), N = P / (2 * Math.cos(a)), iL = M.boards.findIndex((x) => x.id === 'L');
      const leg = chk.items.find((it) => it.type === 'board' && it.b === iL), foot = chk.items.find((it) => it.type === 'joint' && it.kind === 'stone' && it.b === iL);
      const nails = chk.items.find((it) => it.type === 'joint' && it.kind === 'face' && it.b === iL);
      assert.ok(Math.abs(-leg.N / N - 1) < 0.02, `k=${k}: leg squeeze ${-leg.N} vs ${N}`);
      assert.ok(Math.abs(foot.force / Math.hypot(P / 2 * Math.tan(a), P / 2 * Math.abs(t) / s) - 1) < 0.02, `k=${k}: foot slide`);
      assert.ok(Math.abs(nails.force / N - 1) < 0.02, `k=${k}: peak nails`);
    }
  } finally { WOOD.weight = w; }
});
test('v4 symmetry: a tapered tower strains the same from the west as from the east, mirrored, and turned half round', () => {
  const flip = (b, fx, fz) => ({ ...b, a: { X: fx * b.a.X, Y: b.a.Y, Z: fz * b.a.Z }, b: { X: fx * b.b.X, Y: b.b.Y, Z: fz * b.b.Z }, ...(b.t ? { t: (b.n === 'X' ? fx : fz) * b.t } : {}) });
  const check = (t, fx, fz) => {
    const west = strainIn(t, 0, 50), east = strainIn(t, 1, 50), f = (p) => ({ X: fx * p.X, Y: p.Y, Z: fz * p.Z });
    for (const b of t.boards) {
      const m = imageOf(t, b, f); assert.ok(m, b.id + ' has its image');
      const img = flip(b, fx, fz); assert.ok(m.n === img.n && Math.abs((m.t || 0) - (img.t || 0)) < 1e-9, b.id + ': its image leans the same way, mirrored');
      assert.ok(Math.abs(west[b.id] - east[m.id]) < 1e-6, `${b.id}: ${west[b.id]} vs ${east[m.id]}`);
    }
    assert.ok(Math.max(...Object.values(west)) > 0.05);
  };
  // every leg's own wall the front or back: the mirror X -> -X takes the tower onto itself
  check(taperL(6, 6, { F: 1.5, B: 1.5, R: 1.5, L: 1.5 }, { braces: false, legN: () => 'Z' }), -1, 1);
  // the twins' legs (Z, X, Z, X) and pinwheel braces: the half turn takes it onto itself
  check(LEAN.taper16Braced, -1, -1);
});
test('v4: racking counts the change in lean, not the lean as built; a tower leaning past its stones tips by its weight', () => {
  const calm = oneWindL(LEAN.taper16, 0, 0).chk;
  assert.ok(Math.max(...calm.items.filter((it) => it.type === 'drift').map((it) => it.util)) < 0.02, 'legs leaning 1/8 as built, nothing in still air');
  // all four walls leaning toward +X 7 in a foot (the right wall out, the left in): its weight past the +X stones
  const s = shapeL(6, 6, { R: -7, L: 7 }), bs = [];
  for (let c = 0; c < 4; c++) bs.push(BL('a' + c, s.corner(c, 0), s.corner(c, 7.5), c % 2 ? 'X' : 'Z', legTL(s, c, c % 2 ? 'X' : 'Z')), BL('b' + c, s.corner(c, 7.5), s.corner(c, 15), c % 2 ? 'X' : 'Z', legTL(s, c, c % 2 ? 'X' : 'Z')));
  bs.push(...crossL(s, 7.5, 'm'), ...crossL(s, 15, 't'));
  const t = { W: 6, D: 6, boards: bs }, M = oneWindL(t, 0, 0).M;
  let wt = 0, a = 0; for (const b of M.boards) { const x = WOOD.weight * b.L; wt += x; a += x * (b.A[0] + b.B[0]) / 2; }
  const hand = wt * (a / wt - 3) / (2 * F.stoneLb(6) * 6), tip = oneWindL(t, 0, 0).chk.items.find((it) => it.type === 'tip');
  assert.ok(a / wt > 3 && Math.abs(tip.util - hand) < 1e-9, `weight ${(a / wt).toFixed(2)} ft out; ${tip.util} vs ${hand}`);
});
test('v4 outcomes (what the physics says, LEAN.md item 5): taper, slight and steep, leaning out, front and back, tiers, braced', () => {
  const r = Object.fromEntries(Object.entries(LEAN).map(([k, t]) => [k, windTest(t)]));
  // a taper with no braces resists sway far better than the straight tower: it racks two stages later
  assert.ok(r.taper16.stages[0].peak < 0.5 * r.straight16.stages[0].peak);
  assert.ok(firstGave(r.taper16) > firstGave(r.straight16) && firstGave(r.straight16) >= 0);
  // ...but not because its legs brace it: with every joint turning a thousand times more easily it folds like the
  // straight tower; legs meeting at a point (a pyramid) do brace it
  const hinged = (t) => {
    const keep = {}; for (const k of Object.keys(F.NAILS)) { keep[k] = { ...F.NAILS[k] }; F.NAILS[k].kr /= 1000; F.NAILS[k].kb = Math.max(F.NAILS[k].kr, F.NAILS[k].kb / 1000); }
    const sway = (tt) => { const st = { W: tt.W, D: tt.D, boards: tt.boards, cuts: [], hinges: [], M: null, models: 0 }, M = I.modelOf(st), Wd = I.windOf(M, 0); return Math.max(...M.hubs.filter((h) => h.node >= 0).map((h) => Wd.u[M.dof(h.node, 0)])); };
    try { return sway(t); } finally { for (const k of Object.keys(keep)) Object.assign(F.NAILS[k], keep[k]); }
  };
  const swayOf = (t) => { const st = { W: t.W, D: t.D, boards: t.boards, cuts: [], hinges: [], M: null, models: 0 }, M = I.modelOf(st), Wd = I.windOf(M, 0); return Math.max(...M.hubs.filter((h) => h.node >= 0).map((h) => Wd.u[M.dof(h.node, 0)])); };
  assert.ok(hinged(LEAN.taper16) / swayOf(LEAN.taper16) > 100, 'the tapered frame is held square by its joints');
  assert.ok(hinged(LEAN.pyramid) / swayOf(LEAN.pyramid) < 3, 'the pyramid is a truss');
  // a slight taper works its feet and corner nails harder than a steeper one (it sways more)
  const use = (t) => { const c = oneWindL(t, 0, 35).chk; return { feet: Math.max(...c.items.filter((it) => it.type === 'joint' && it.kind === 'stone').map((it) => it.util)), nails: Math.max(...c.items.filter((it) => it.type === 'joint' && it.kind === 'face' && it.P[1] > 1).map((it) => it.util)) }; };
  const u1 = use(LEAN.slight), u15 = use(LEAN.taper16), u2 = use(LEAN.steep);
  assert.ok(u1.feet > u15.feet && u15.feet > u2.feet && u1.nails > u15.nails && u15.nails > u2.nails, JSON.stringify([u1, u15, u2]));
  // leaning out: more tipping than the straight tower in the big gust (its wide top catches more wind), and it racks no later
  const tipOf = (t) => oneWindL(t, 0, 65).chk.items.find((it) => it.type === 'tip').util;
  assert.ok(tipOf(LEAN.leanOut16) > 1.2 * tipOf(LEAN.straight16));
  assert.ok(firstGave(r.leanOut16) <= firstGave(r.straight16) && r.leanOut16.stages[0].peak > r.straight16.stages[0].peak);
  // front and back walls leaning in: stiffer against the wind into them (north, south) than along them (west, east)
  const worst = (t, k) => oneWindL(t, k, 35).chk.worst.util;
  assert.ok(worst(LEAN.frontBack, 2) < 0.75 * worst(LEAN.frontBack, 0) && worst(LEAN.frontBack, 0) < worst(LEAN.straight16, 0));
  // braced: the tapered tower stands with more to spare than the straight one (and fewer boards); the braced pyramid stands
  assert.ok(r.taper16Braced.stood && R.diag16.stood && r.taper16Braced.stages[3].peak < R.diag16.stages[3].peak);
  assert.ok(boardsCut(LEAN.taper16Braced) < boardsCut(T.diag16));
  assert.ok(r.pyramid.stood && Math.abs(r.pyramid.height - LEAN.pyramid.apex) < 1e-6 && boardsCut(LEAN.pyramid) <= 28, `the pyramid: ${r.pyramid.height} ft`);
});
test('v4 a tapered tier on beams: its feet toe-nailed to the beams; with no braces it folds in the big gust and the base stands', () => {
  const base = T.diag16.boards.filter((b) => Math.max(b.a.Y, b.b.Y) <= 8.001), s = shapeL(4, 4, { F: 1.5, B: 1.5, R: 1.5, L: 1.5 });
  const L = legsL(s, 0, 8, 't'), lift = (b) => ({ ...b, a: { ...b.a, Y: r6(b.a.Y + 8) }, b: { ...b.b, Y: r6(b.b.Y + 8) } });
  const t = { W: 6, D: 6, boards: [...base, B('beamL', [-2, 8, 3], [-2, 8, -3], 'X'), B('beamR', [2, 8, 3], [2, 8, -3], 'X'), ...[...L.boards, ...crossL(s, L.top, 't')].map(lift)] };
  const M = oneWindL(t, 0, 0).M, toes = M.hubs.flatMap((h) => h.items.filter((it) => it.kind === 'toe' && M.boards[it.b].id.startsWith('beam') && M.boards[it.toeEnd].id.startsWith('leg')));
  assert.equal(toes.length, 4, 'each leg\'s foot toe-nailed onto a beam');
  const r = windTest(t);
  assert.equal(firstGave(r), 3);
  assert.equal(r.height, 8);
});
test('v4 speed: braced leaning towers and a braced pyramid take well under 400 ms', () => {
  for (const t of [LEAN.taper16Braced, LEAN.pyramid, LEAN.leanOut16]) { windTest(t); const a = performance.now(); windTest(t); assert.ok(performance.now() - a < 400); }
});
// A 4 x 4 tower 16 ft tall, braced zig-zag post to post (5 ft braces rising 3 ft each), and then more on top to 19 ft,
// 56 boards in all, with four short posts at the back whose feet hang in the air (nailed only where they cross the
// horizontal boards): a tower as a player built it. The card blamed those four posts for 0 ft left standing. The base
// itself went: the whole tower tipped over on its 4 ft stones in the big gust, all 56 boards at once. The four posts
// come down in that tip (nofoot names them as standing on nothing), but they did not cause it: testrun.js says so.
function zigzag16() {
  const C = [[-2, 2], [2, 2], [2, -2], [-2, -2]], out = [], W4 = [['Z', 2], ['Z', -2], ['X', 2], ['X', -2]];
  const ring = (y, tag) => [B(tag + 'f', [-2, y, 2], [2, y, 2], 'Z'), B(tag + 'b', [-2, y, -2], [2, y, -2], 'Z'), B(tag + 'r', [2, y, 2], [2, y, -2], 'X'), B(tag + 'l', [-2, y, 2], [-2, y, -2], 'X')];
  C.forEach(([x, z], i) => { const n = i % 2 ? 'X' : 'Z'; out.push(B('post' + i, [x, 0, z], [x, 8, z], n), B('up' + i, [x, 8, z], [x, 16, z], n)); });
  out.push(...ring(8, 'x8'));
  for (const [n, off] of W4) {
    const p = (u, y) => (n === 'Z' ? [u, y, off] : [off, y, u]);
    for (let k = 0; k < 4; k++) { const u0 = k % 2 ? 2 : -2; out.push(B(`br${n}${off}_${k}`, p(u0, 3 * k), p(-u0, 3 * k + 3), n)); }
  }
  return out;
}
function zigzagOnTop() {
  const C = [[-2, 2], [2, 2], [2, -2], [-2, -2]], out = [], W4 = [['Z', 2], ['Z', -2], ['X', 2], ['X', -2]];
  const ring = (y, tag) => [B(tag + 'f', [-2, y, 2], [2, y, 2], 'Z'), B(tag + 'b', [-2, y, -2], [2, y, -2], 'Z'), B(tag + 'r', [2, y, 2], [2, y, -2], 'X'), B(tag + 'l', [-2, y, 2], [-2, y, -2], 'X')];
  out.push(...ring(16, 'h16'));
  for (const [n, off] of W4) { const p = (u, y) => (n === 'Z' ? [u, y, off] : [off, y, u]); out.push(B(`b12${n}${off}`, p(2, 12), p(-2, 15), n)); }
  C.forEach(([x, z], i) => out.push(B('top' + i, [x, 16, z], [x, 19, z], i % 2 ? 'X' : 'Z')));
  out.push(...ring(19, 'h19'));
  for (const [n, off] of W4) {
    const p = (u, y) => (n === 'Z' ? [u, y, off] : [off, y, u]);
    if (!(n === 'Z' && off === 2) && !(n === 'Z' && off === -2) && !(n === 'X' && off === 2)) out.push(B(`k${n}${off}a`, p(-2, 16.6), p(0.4, 19), n));
    out.push(B(`k${n}${off}b`, p(2, 16.6), p(-0.4, 19), n));
  }
  for (const [x, z, id] of [[-0.5, -2.125, 'ua'], [0.5, -2.125, 'ub'], [-0.5, -0.542, 'uc'], [0.5, -0.542, 'ud']]) out.push(B(id, [x, 15.5, z], [x, 18.5, z], 'Z'));
  out.push(B('ue', [-0.5, 18, -2.25], [-0.5, 18, -0.4], 'X'), B('uf', [0.5, 18, -2.25], [0.5, 18, -0.4], 'X'), B('ug', [-2, 17, -0.542], [2, 17, -0.542], 'Z'));
  return out;
}
test('a 4 x 4 zig-zag tower with a heavy top tips over whole in the big gust: the base itself goes, not a narrower level taking it', () => {
  const base = { W: 4, D: 4, boards: zigzag16() }, rb = windTest(base);
  assert.ok(rb.stood && rb.height === 16, 'the 16 ft zig-zag tower alone stands');
  const t = { W: 4, D: 4, boards: [...zigzag16(), ...zigzagOnTop()] };
  assert.equal(t.boards.length, 56);
  const r = windTest(t), evs = r.gusts.flatMap((g) => g.events.map((e) => ({ ...e, stage: g.stage })));
  assert.equal(r.height, 0);
  assert.equal(evs.length, 1, evs.map((e) => e.kind + ' ' + e.text).join(' / '));
  const e = evs[0];
  assert.equal(e.kind, 'tip'); assert.equal(e.stage, 3, 'in the big gust'); assert.equal(e.fell.length, 56, 'all at once');
  assert.deepEqual([...e.nofoot].sort(), ['ua', 'ub', 'uc', 'ud'], 'the four hanging posts are among what fell, standing on nothing');
  assert.deepEqual(e.broke, [], 'but nothing of theirs broke: the tip took the whole tower');
  // and the narrower-level rule still holds: those four posts taken away, the tower tips just the same (they are not
  // what put her over); a narrower level that folds leaves the levels under it (setbackUnbraced's tier, topHeavy24)
  const r2 = windTest({ W: 4, D: 4, boards: t.boards.filter((b) => !['ua', 'ub', 'uc', 'ud', 'ue', 'uf', 'ug'].includes(b.id)) });
  assert.ok(r2.gusts.some((g) => g.events.some((x) => x.kind === 'tip')), 'without them she still tips');
  assert.equal(R.topHeavy24.height, 16, 'a top level folding leaves the 16 ft under it');
});

// ── the result card's words (labs/windmill/testrun.js, run in node with its page-only imports stood in for) ─────────
// A taper whose top level folds, built the way the builder fits horizontal boards between leaning legs (where the legs
// are the board's length apart, 6 ft up, below the 7 ft 11 in. leg tops): the card names the TOP level, and the outer
// walls as the front and back walls, not "the bottom level" and "inside walls 9 inches in".
async function cardOf(tower) {
  if (!globalThis.__wmHooks) {
    const { register } = await import('node:module');
    const stub = (src) => 'data:text/javascript,' + encodeURIComponent(src);
    register(stub(`const S = ${JSON.stringify({ './scene.js': stub('export const wind = { dir: { set() {}, clone() { return {}; } }, level: 0 }; export const FT = 0.3048;'), './sound.js': stub('export const crack = () => {}, thud = () => {}, snap = () => {}, crash = () => {}, setWind = () => {}, audioOn = () => {}, saw = () => {}, clatter = () => {}, hammer = () => {};') })};
      export async function resolve(spec, ctx, next) { if (S[spec] && ctx.parentURL && /windmill\\/(testrun|build)\\.js$/.test(ctx.parentURL)) return { url: S[spec], shortCircuit: true }; return next(spec, ctx); }`));
    const el = () => ({ textContent: '', innerHTML: '', hidden: true, style: {}, classList: { add() {}, remove() {}, toggle() { return false; } }, setAttribute() {}, onclick: null, querySelector: () => null });
    const els = new Map();
    globalThis.document = globalThis.document || { getElementById: (id) => els.get(id) || els.set(id, el()).get(id) };
    globalThis.__wmHooks = true;
  }
  const { makeTestRun } = await import('../labs/windmill/testrun.js');
  const app = { tower: JSON.parse(JSON.stringify(tower)), phase: 'test' };
  const fall = { running: false, sticks: [], sinceDrop: 9, drop() { return 0; }, update() { return {}; }, settled: () => true, clear() {} };
  const run = makeTestRun(app, { towerView: { setBend() {}, setStrain() {}, setSpots() {}, nailsFor() {}, drawnNow: () => null }, fall, say() {}, gesture() {}, hideSay() {},
    viewAz: () => 0, watch() {}, record: (h, W, D) => ({ best: { height: h, W, D }, newBest: true }), showHead() {}, keep() {}, fresh() {} });
  run.start();
  for (let i = 0; i < 400 && !run.state(); i++) await new Promise((r) => setTimeout(r, 5));
  for (let s = 0; app.phase === 'test' && s < 20000; s++) run.frame(0.1);
  return run.state().card;
}
test('the card on a taper whose top level folds names the top level and the front and back walls', async () => {
  const rows = [['b1', 'Z', -3, 0, 3, -2.015268, 7.877855, 2.015268, 8, -0.125], ['b2', 'Z', 3, 0, -3, 2.015268, 7.877855, -2.015268, 8, 0.125], ['b3', 'X', 3, 0, 3, 2.015268, 7.877855, 2.015268, 8, -0.125], ['b4', 'X', -3, 0, -3, -2.015268, 7.877855, -2.015268, 8, 0.125], ['b5', 'Z', -2.25, 6, 2.25, 2.25, 6, 2.25, 4.5, -0.125], ['b6', 'Z', -2.25, 6, -2.25, 2.25, 6, -2.25, 4.5, 0.125], ['b7', 'X', 2.25, 6, 2.25, 2.25, 6, -2.25, 4.5, -0.125], ['b8', 'X', -2.25, 6, 2.25, -2.25, 6, -2.25, 4.5, 0.125], ['b9', 'Z', -3, 0, 3, 2.244881, 5.994149, 2.250731, 8, -0.125], ['b10', 'Z', -3, 0, -3, 2.244881, 5.994149, -2.250731, 8, 0.125], ['b11', 'X', 3, 0, 3, 2.250731, 5.994149, -2.244881, 8, -0.125], ['b12', 'X', -3, 0, 3, -2.250731, 5.994149, -2.244881, 8, 0.125], ['b13', 'X', 2.015268, 7.877855, 2.015268, 1.030536, 15.75571, 1.030536, 8, -0.125], ['b14', 'Z', -2.015268, 7.877855, 2.015268, -1.030536, 15.75571, 1.030536, 8, -0.125], ['b15', 'X', -2.015268, 7.877855, -2.015268, -1.030536, 15.75571, -1.030536, 8, 0.125], ['b16', 'Z', 2.015268, 7.877855, -2.015268, 1.030536, 15.75571, -1.030536, 8, 0.125], ['b17', 'Z', -1.25, 14, 1.25, 1.25, 14, 1.25, 2.5, -0.125], ['b18', 'Z', -1.25, 14, -1.25, 1.25, 14, -1.25, 2.5, 0.125], ['b19', 'X', 1.25, 14, 1.25, 1.25, 14, -1.25, 2.5, -0.125], ['b20', 'X', -1.25, 14, 1.25, -1.25, 14, -1.25, 2.5, 0.125]];
  const tower = { W: 6, D: 6, boards: rows.map(([id, n, ax, ay, az, bx, by, bz, len, t]) => ({ id, n, a: { X: ax, Y: ay, Z: az }, b: { X: bx, Y: by, Z: bz }, len, t })) };
  const c = await cardOf(tower);
  assert.match(c.story, /Gust: the top level racked/);
  assert.doesNotMatch(c.story + c.advice, /bottom level|inside wall/);
  assert.match(c.advice, /the front and back walls/);
  assert.ok(Math.abs(c.h - 7.877855) < 1e-3, 'the bottom level stands');
});
// A pyramid whose legs meet at a point: the card says the long legs bent between horizontal boards, not that legs only
// hold a wall square where they meet at a point
test('the card on a pyramid that folds says its legs bent between horizontal boards', async () => {
  const k = 1.5 / 12, W = 8, top = W / 2 / k, s = Math.sqrt(1 + 2 * k * k), boards = [];
  // four legs to the point, spliced from 8 ft boards lapped a foot; rings every 6 ft
  const C = [[-1, 1, 'Z'], [1, 1, 'X'], [1, -1, 'Z'], [-1, -1, 'X']];
  C.forEach(([sx, sz, n], i) => {
    let y = 0, j = 0;
    while (y < top - 1e-6) {
      const y1 = Math.min(top, y + 8 / s), at = (Y) => ({ X: sx * (W / 2 - k * Y), Y, Z: sz * (W / 2 - k * Y) });
      boards.push({ id: `leg${i}_${j++}`, n, a: at(y), b: at(y1), len: (y1 - y) * s, t: n === 'Z' ? -sz * k : -sx * k });
      y = y1 >= top - 1e-6 ? top : y1 - 1 / s;
    }
  });
  for (let Y = 6; Y < top - 2; Y += 6) {
    const h = W / 2 - k * Y;
    boards.push({ id: 'rf' + Y, n: 'Z', a: { X: -h, Y, Z: h }, b: { X: h, Y, Z: h }, len: 2 * h, t: -k }, { id: 'rb' + Y, n: 'Z', a: { X: -h, Y, Z: -h }, b: { X: h, Y, Z: -h }, len: 2 * h, t: k },
      { id: 'rr' + Y, n: 'X', a: { X: h, Y, Z: h }, b: { X: h, Y, Z: -h }, len: 2 * h, t: -k }, { id: 'rl' + Y, n: 'X', a: { X: -h, Y, Z: h }, b: { X: -h, Y, Z: -h }, len: 2 * h, t: k });
  }
  const c = await cardOf({ W, D: W, boards });
  if (c.h >= top - 0.1) return;      // (stood: nothing to word)
  assert.doesNotMatch(c.advice, /only hold a wall square where they meet at a point/);
  assert.match(c.advice, /meet at a point at the top/);
  assert.match(c.advice, /bent between horizontal boards/);
});
