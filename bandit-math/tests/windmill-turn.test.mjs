// The windmill lab's TURNED walls (labs/windmill/tower.js, frame.js, questions.js): wall families turned about the
// vertical by 15 degrees at a time ('R15' ... 'R165'), their keys and in-plane coordinates, the 45 degree square inside a
// 4 x 4 level (its corners on the middles of the level's top horizontal boards), its twins, the rule that a turned board
// stands off the ground, the beam carrying a post at its middle (checked by hand), and the miller's turned-square
// question. node --test tests/windmill-turn.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const T = await import('../labs/windmill/tower.js');
const F = await import('../labs/windmill/frame.js');
const Q = await import('../labs/windmill/questions.js');

const close = (a, b, e = 1e-6, msg) => assert.ok(Math.abs(a - b) <= e, `${msg || ''} ${a} vs ${b}`);
const near = (p, q, e = 1e-5) => Math.abs(p.X - q.X) < e && Math.abs(p.Y - q.Y) < e && Math.abs(p.Z - q.Z) < e;
const seeded = (s = 7) => () => { s = (s + 0x6D2B79F5) | 0; let r = Math.imul(s ^ (s >>> 15), 1 | s); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
const FAMS = ['Z', 'X', ...[15, 30, 45, 60, 75, 105, 120, 135, 150, 165].map((d) => 'R' + d)];

test('families: angles, normalized, never R0 or R90', () => {
  assert.equal(T.famAt(0), 'Z'); assert.equal(T.famAt(90), 'X'); assert.equal(T.famAt(180), 'Z'); assert.equal(T.famAt(270), 'X');
  assert.equal(T.famAt(225), 'R45'); assert.equal(T.famAt(-45), 'R135'); assert.equal(T.famAt(44), 'R45');
  for (let d = -720; d <= 720; d += 15) { const f = T.famAt(d); assert.ok(f !== 'R0' && f !== 'R90' && f !== 'R180', f); assert.ok(FAMS.includes(f), f); }
  for (const f of FAMS) {
    assert.equal(T.famAt(T.famTheta(f)), f);
    assert.equal(T.otherFam(T.otherFam(f)), f);
    // e and d are at right angles, unit, and the other family's e is d (up to its sign)
    const e = T.famNormal(f), d = T.famAlong(f), o = T.famNormal(T.otherFam(f));
    close(e.X * d.X + e.Z * d.Z, 0); close(Math.hypot(e.X, e.Z), 1); close(Math.abs(o.X * d.X + o.Z * d.Z), 1);
    close(o.X * d.X + o.Z * d.Z, T.otherSign(f));
  }
  // Z and X exactly as they always were
  assert.deepEqual(T.famNormal('Z'), { X: 0, Y: 0, Z: 1 }); assert.deepEqual(T.famNormal('X'), { X: 1, Y: 0, Z: 0 });
});

test('keys, parseKey, toPlane / fromPlane round trips for every family, upright and leaning', () => {
  for (const f of FAMS) for (const k of [0, 1.5, -2]) for (const off of [0, 1.414, -2.5]) {
    const key = T.planeKey(f, off, k), p = T.parseKey(key);
    assert.equal(p.axis, f); close(p.off, Math.round(off * 1000) / 1000); assert.equal(p.k, k);
    assert.equal(T.famOfKey(key), f);
    assert.ok(!/^R(0|90):/.test(key), key);
    for (const [u, y] of [[0, 0], [0.7, 5], [-2.2, 9.5]]) {
      const w = T.fromPlane(key, u, y), q = T.toPlane(key, w);
      close(q.u, u, 1e-9, key); close(q.y, y, 1e-9, key);
      // the point is on the plane: its place across the family is c + t·Y
      close(T.coord(f, w), p.off + p.t * w.Y, 1e-9, key);
    }
  }
  // the Z and X planes as before: u = X on Z, u = -Z on X
  assert.deepEqual(T.fromPlane('Z:2', 1, 3), { X: 1, Y: 3, Z: 2 });
  assert.deepEqual(T.fromPlane('X:2', 1, 3), { X: 2, Y: 3, Z: -1 });
});

// the 45 degree square inside a 4 x 4 level: corners on the middles of the top horizontal boards, 8 ft up
const MIDS = [{ X: 0, Z: 2 }, { X: 2, Z: 0 }, { X: 0, Z: -2 }, { X: -2, Z: 0 }];
function base4() {
  const t = { W: 4, D: 4, boards: [] }; let n = 0;
  const add = (a, b, fam) => { const r = T.makeBoard('b' + n++, a, b, fam); t.boards.push(r); return r; };
  for (const [x, z] of [[-2, 2], [2, 2], [2, -2], [-2, -2]]) add({ X: x, Y: 0, Z: z }, { X: x, Y: 8, Z: z }, 'Z');
  for (const z of [2, -2]) add({ X: -2, Y: 8, Z: z }, { X: 2, Y: 8, Z: z }, 'Z');
  for (const x of [2, -2]) add({ X: x, Y: 8, Z: 2 }, { X: x, Y: 8, Z: -2 }, 'X');
  return { t, add };
}

test('the turned square: its four walls, posts in two turned walls, names by corner', () => {
  const { t, add } = base4();
  const posts = MIDS.map((m, i) => add({ X: m.X, Y: 8, Z: m.Z }, { X: m.X, Y: 16, Z: m.Z }, i % 2 ? 'R135' : 'R45'));
  // each post lies in an R45 and an R135 plane, offset ±√2
  for (const p of posts) {
    const ps = T.planesOf(p).sort();
    assert.equal(ps.length, 2); assert.ok(/^R135:-?1\.414$/.test(ps[0]) && /^R45:-?1\.414$/.test(ps[1]), ps.join(' '));
    assert.ok(T.isPost(p) && T.isLeg(p));
  }
  const tops = MIDS.map((m, i) => { const q = MIDS[(i + 1) % 4]; return add({ X: m.X, Y: 16, Z: m.Z }, { X: q.X, Y: 16, Z: q.Z }, i % 2 ? 'R135' : 'R45'); });
  close(tops[0].len, Math.sqrt(8), 1e-9);
  const walls = [...T.wallsInUse(t)].filter((k) => k[0] === 'R').sort();
  assert.deepEqual(walls, ['R135:-1.414', 'R135:1.414', 'R45:-1.414', 'R45:1.414']);
  // two posts and a top in each turned wall
  for (const k of walls) assert.equal(T.planeSegments(t, k).length, 3, k);
  assert.equal(T.planeName(t, 'R45:1.414'), 'the turned wall at the front right, turned 45°');
  assert.equal(T.planeName(t, 'R45:-1.414'), 'the turned wall at the back left, turned 45°');
  assert.equal(T.planeName(t, 'R135:1.414'), 'the turned wall at the back right, turned 45°');
  assert.equal(T.planeName(t, 'R135:-1.414'), 'the turned wall at the front left, turned 45°');
  assert.equal(T.planeName(t, 'R45:1.414', true), 'turned wall at the front right, turned 45°');
  // a turned wall is never an outer wall; the base's horizontal boards cross it where the posts stand
  for (const k of walls) assert.equal(T.faceOfPlane(t, k), -1);
  const cs = T.crossings(t, 'R45:1.414').filter((c) => Math.abs(c.y - 8) < 1e-6);
  assert.equal(cs.length, 2);
  // a turned wall leaning in, named so, and its board squared up onto it
  const k2 = T.planeKey('R45', 1.414 + 8 / 12, -1);
  assert.match(T.planeName({ W: 4, D: 4, boards: [] }, k2), /^the turned wall at the front right, turned 45°, leaning 1 inch in for every foot up$/);
});

test('twins of a turned board: the quarter turns on a square base, the half turn on an oblong one; the lean turns with it', () => {
  const { t, add } = base4();
  const post = add({ X: 0, Y: 8, Z: 2 }, { X: 0, Y: 16, Z: 2 }, 'R45');
  const tw = T.twinsOf(t, post);
  assert.equal(tw.length, 3);
  for (const m of MIDS.slice(1)) assert.ok(tw.some((g) => near(g.a, { X: m.X, Y: 8, Z: m.Z }) && near(g.b, { X: m.X, Y: 16, Z: m.Z })), JSON.stringify(m));
  for (const g of tw) assert.ok(/^R/.test(g.n));
  // a horizontal board of the square: its three turned images, each on a corner-to-corner run of middles
  const top = add({ X: 0, Y: 12, Z: 2 }, { X: 2, Y: 12, Z: 0 }, 'R45');
  for (const m of MIDS.slice(1)) add({ X: m.X, Y: 8, Z: m.Z }, { X: m.X, Y: 16, Z: m.Z }, 'R45');
  const tt = T.twinsOf(t, top);
  assert.equal(tt.length, 3);
  for (let i = 1; i < 4; i++) { const a = MIDS[i], b = MIDS[(i + 1) % 4]; assert.ok(tt.some((g) => (near(g.a, { ...a, Y: 12 }) && near(g.b, { ...b, Y: 12 })) || (near(g.b, { ...a, Y: 12 }) && near(g.a, { ...b, Y: 12 }))), `${i}`); }
  // a level board in a turned wall leaning in: every twin leans in too
  const lt = { W: 4, D: 4, boards: [...t.boards] };
  const key = T.planeKey('R45', 1.414 + 8 / 12, -1), A = T.fromPlane(key, -1, 10 * Math.hypot(1, 1 / 12)), B = T.fromPlane(key, 1, 10 * Math.hypot(1, 1 / 12));
  const lb = T.makeBoard('lb', A, B, 'R45', 2, -1 / 12); lt.boards.push(lb);
  const lw = T.twinsOf(lt, lb, () => true);
  assert.equal(lw.length, 3);
  for (const g of lw) { const k = T.planeKeyOf(g); assert.equal(T.leansIn(k, 10), 1, k); }
  // an oblong base: only the half turn
  const ob = { W: 4, D: 6, boards: [] }, p2 = T.makeBoard('p', { X: 0, Y: 8, Z: 3 }, { X: 0, Y: 12, Z: 3 }, 'R45'); ob.boards.push(p2);
  const ow = T.twinsOf(ob, p2, () => true);
  assert.equal(ow.length, 1); assert.ok(near(ow[0].a, { X: 0, Y: 8, Z: -3 }));
});

test('a turned board on the ground is refused; above the ground it may be turned', () => {
  assert.equal(T.turnedOnGround({ a: { X: 0, Y: 0, Z: 2 }, b: { X: 0, Y: 8, Z: 2 }, n: 'R45' }), true);
  assert.equal(T.turnedOnGround({ a: { X: 0, Y: 0.2, Z: 2 }, b: { X: 2, Y: 0.2, Z: 0 }, n: 'R45' }), true);
  assert.equal(T.turnedOnGround({ a: { X: 0, Y: 8, Z: 2 }, b: { X: 0, Y: 16, Z: 2 }, n: 'R45' }), false);
  assert.equal(T.turnedOnGround({ a: { X: -2, Y: 0, Z: 2 }, b: { X: -2, Y: 8, Z: 2 }, n: 'Z' }), false);
  // a turn of a vector about the vertical by 90 takes the front's direction to the right side's
  const v = T.turnVec({ X: 0, Y: 1, Z: 1 }, 90); close(v.X, 1); close(v.Z, 0); assert.equal(v.Y, 1);
});

test('the beam hand check: a post at the middle of a 4 ft horizontal board bends it as a simple beam, P L / 4', () => {
  // the 4 x 4 base with its corner posts on the stones, the horizontal boards at 8 ft, and the turned square's four posts
  // on their middles with a top of horizontal boards: gravity alone (no wind)
  const { t, add } = base4();
  for (const [x, z] of [[-2, 2], [2, -2]]) add({ X: x, Y: 0, Z: z }, { X: -x, Y: 3, Z: z }, 'Z');
  for (const [x, z] of [[2, 2], [-2, -2]]) add({ X: x, Y: 0, Z: z }, { X: x, Y: 3, Z: -z }, 'X');
  MIDS.forEach((m, i) => add({ X: m.X, Y: 8, Z: m.Z }, { X: m.X, Y: 16, Z: m.Z }, i % 2 ? 'R135' : 'R45'));
  MIDS.forEach((m, i) => { const q = MIDS[(i + 1) % 4]; add({ X: m.X, Y: 16, Z: m.Z }, { X: q.X, Y: 16, Z: q.Z }, i % 2 ? 'R135' : 'R45'); });
  const I = F.internals, st = { W: 4, D: 4, boards: JSON.parse(JSON.stringify(t.boards)), cuts: [], hinges: [], M: null, models: 0 };
  const M = I.modelOf(st), chk = I.checkAll(M, { u: M.ug, N: new Float64Array(M.elems.length), unstable: false, k: 0, mph: 0 });
  const front = t.boards.find((b) => b.a.Y === 8 && b.b.Y === 8 && b.a.Z === 2 && b.b.Z === 2);
  const Ms = Math.max(...chk.items.filter((it) => it.type === 'board' && it.id === front.id).map((it) => it.Ms));
  const upper = (8 + Math.sqrt(8)) * F.WOOD.weight, P = upper, L = 4;      // (one post and one top's worth on each middle)
  const simple = P * L / 4 + F.WOOD.weight * L * L / 8, fixed = P * L / 8 + F.WOOD.weight * L * L / 12;
  assert.ok(Ms <= simple * 1.02 && Ms >= fixed, `frame.js ${Ms.toFixed(2)} lb-ft, simple beam ${simple.toFixed(2)}, ends held ${fixed.toFixed(2)}`);
  // nailed at its ends to the corner posts, it is nearly a simple beam: within 5%
  close(Ms, simple, simple * 0.05, 'nearly simple');
});

test('the wind on a turned level: it stands, winds from opposite sides push it alike, its walls shelter', () => {
  const { t, add } = base4();
  for (const z of [2, -2]) { add({ X: -2, Y: 0, Z: z }, { X: 2, Y: 3, Z: z }, 'Z'); add({ X: 2, Y: 3, Z: z }, { X: -2, Y: 6, Z: z }, 'Z'); }
  for (const x of [2, -2]) { add({ X: x, Y: 0, Z: 2 }, { X: x, Y: 3, Z: -2 }, 'X'); add({ X: x, Y: 3, Z: -2 }, { X: x, Y: 6, Z: 2 }, 'X'); }
  MIDS.forEach((m, i) => add({ X: m.X, Y: 8, Z: m.Z }, { X: m.X, Y: 16, Z: m.Z }, i % 2 ? 'R135' : 'R45'));
  MIDS.forEach((m, i) => { const q = MIDS[(i + 1) % 4]; const fam = i % 2 ? 'R135' : 'R45'; add({ X: m.X, Y: 16, Z: m.Z }, { X: q.X, Y: 16, Z: q.Z }, fam); add({ X: m.X, Y: 8, Z: m.Z }, { X: q.X, Y: 12, Z: q.Z }, fam); });
  const r = F.windTest(JSON.parse(JSON.stringify(t)));
  assert.equal(r.height, 16);
  const I = F.internals, one = (k) => { const st = { W: 4, D: 4, boards: JSON.parse(JSON.stringify(t.boards)), cuts: [], hinges: [], M: null, models: 0 }, M = I.modelOf(st); return { W: I.windOf(M, k), chk: I.checkAll(M, I.solveWind(M, k, 65)) }; };
  const w = one(0), e = one(1);
  // (alike to a thousandth: the base's zig-zag braces are not quite the same seen from the west and the east)
  close(w.W.total, e.W.total, 1e-3 * w.W.total, 'west and east push alike');
  const tip = (c) => c.chk.items.find((it) => it.type === 'tip').util;
  close(tip(w), tip(e), 1e-3, 'west and east tip alike');
  // the turned walls shelter what is behind them: the leeward posts get less than the windward one
  const pb = (id) => w.W.perBoard.get(id);
  const ids = t.boards.filter((b) => b.a.Y === 8 && b.b.Y === 16).map((b) => b.id), up = ids.find((id) => t.boards.find((b) => b.id === id).a.X === -2), down = ids.find((id) => t.boards.find((b) => b.id === id).a.X === 2);
  assert.ok(pb(down) < pb(up), `${pb(down)} < ${pb(up)}`);
});

test('the miller asks the turned square: each side by Pythagoras, and the corner from the middle', () => {
  const q = Q.turnedQuestion(4, seeded(3), 'side');
  assert.equal(q.answer, 34);                       // √8 = 2.83 ft = 2 ft 10 in.
  assert.ok(q.choices.includes(34) && q.choices.length === 4 && new Set(q.choices).size === 4);
  assert.equal(q.labels[q.choices.indexOf(34)], '2 ft 10 in.');
  assert.match(q.prompt, /turned inside a 4\u2011foot square, its corners on the middles/);
  assert.match(q.why, /2×2 \+ 2×2 = 8/);
  assert.deepEqual(q.sideLabels, ['2 ft', '?', '2 ft']);
  const c = Q.turnedQuestion(4, seeded(5), 'corner');
  assert.equal(c.answer, 2); assert.equal(c.labels[c.choices.indexOf(2)], '2 ft');
  assert.match(c.prompt, /How far is each of its corners from the middle of the tower/);
  for (let s = 1; s < 200; s++) { const r = Q.turnedQuestion([3, 4, 5, 6][s % 4], seeded(s), s % 2 ? 'side' : 'corner'); assert.equal(new Set(r.labels).size, 4); assert.ok(r.choices.includes(r.answer)); }
  assert.equal(Q.turnedQuestion(0.5), null);
});
