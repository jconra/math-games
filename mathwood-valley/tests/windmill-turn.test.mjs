// The windmill lab's TURNED square, built from free boards (labs/windmill/tower.js, frame.js): the 45 degree square inside
// a 4 x 4 level (its corners on the middles of the level's top horizontal boards), its twins (the quarter turns), the
// beam carrying a post at its middle (checked by hand), and the wind on a turned level. (The physics may be handed how
// a board was laid, n: the page no longer stores it, and the physics lays a board alike without it.)
// node --test tests/windmill-turn.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const T = await import('../labs/windmill/tower.js');
const F = await import('../labs/windmill/frame.js');

const close = (a, b, e = 1e-6, msg) => assert.ok(Math.abs(a - b) <= e, `${msg || ''} ${a} vs ${b}`);
const near = (p, q, e = 1e-5) => Math.abs(p.X - q.X) < e && Math.abs(p.Y - q.Y) < e && Math.abs(p.Z - q.Z) < e;

const MIDS = [{ X: 0, Z: 2 }, { X: 2, Z: 0 }, { X: 0, Z: -2 }, { X: -2, Z: 0 }];
function base4() {
  const t = { W: 4, D: 4, boards: [] }; let n = 0;
  const add = (a, b, fam) => { const r = { ...T.makeBoard('b' + n++, a, b), n: fam }; t.boards.push(r); return r; };
  for (const [x, z] of [[-2, 2], [2, 2], [2, -2], [-2, -2]]) add({ X: x, Y: 0, Z: z }, { X: x, Y: 8, Z: z }, 'Z');
  for (const z of [2, -2]) add({ X: -2, Y: 8, Z: z }, { X: 2, Y: 8, Z: z }, 'Z');
  for (const x of [2, -2]) add({ X: x, Y: 8, Z: 2 }, { X: x, Y: 8, Z: -2 }, 'X');
  return { t, add };
}

test('the turned square from free boards: its posts on the middles, its sides √8 long; twins go round by quarter turns', () => {
  const { t, add } = base4();
  const p0 = add({ X: 0, Y: 8, Z: 2 }, { X: 0, Y: 16, Z: 2 });
  // its first post's twins: the other three middles (a quarter turn, its mirror image, the half turn)
  const tw = T.twinsOf(t, p0);
  assert.equal(tw.length, 3);
  for (const m of MIDS.slice(1)) assert.ok(tw.some((g) => near(g.a, { X: m.X, Y: 8, Z: m.Z })), JSON.stringify(m));
  // a top side from the front middle to the right middle: √8 long; its twins are the other three sides
  for (const m of MIDS.slice(1)) add({ X: m.X, Y: 8, Z: m.Z }, { X: m.X, Y: 16, Z: m.Z });
  const top = add({ X: 0, Y: 16, Z: 2 }, { X: 2, Y: 16, Z: 0 });
  close(top.len, Math.sqrt(8), 1e-9);
  const tt = T.twinsOf(t, top);
  assert.equal(tt.length, 3);
  for (const [a, b] of [[1, 2], [2, 3], [3, 0]]) assert.ok(tt.some((g) => (near(g.a, { ...MIDS[a], Y: 16 }) && near(g.b, { ...MIDS[b], Y: 16 })) || (near(g.b, { ...MIDS[a], Y: 16 }) && near(g.a, { ...MIDS[b], Y: 16 }))), `${a}-${b}`);
  // named by where it is, never by a wall
  assert.equal(T.placeWords(t, top), 'the horizontal board at the front right, 16 ft up');
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

