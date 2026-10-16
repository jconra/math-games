// The windmill lab's tower as data on LEANING walls (labs/windmill/tower.js) and the slope questions (questions.js):
// plane keys, true lengths in a leaning wall, the planes a post or a two-way leg lies in, twins carrying the lean, the
// footprint a lean allows, the names, and the miller's slope questions. node --test tests/windmill-tower.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const T = await import('../labs/windmill/tower.js');
const Q = await import('../labs/windmill/questions.js');

const close = (a, b, e = 1e-6, msg) => assert.ok(Math.abs(a - b) <= e, `${msg || ''} ${a} vs ${b}`);
const dist = (p, q) => Math.hypot(p.X - q.X, p.Y - q.Y, p.Z - q.Z);
// a seeded 0..1 random function, so the questions come out the same every run
const seeded = (s = 7) => () => { s = (s + 0x6D2B79F5) | 0; let r = Math.imul(s ^ (s >>> 15), 1 | s); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };

test('plane keys: upright as before, leaning with its lean after a ~', () => {
  assert.equal(T.planeKey('Z', 1.5), 'Z:1.5');
  assert.equal(T.planeKey('X', -1, 0), 'X:-1');
  assert.equal(T.planeKey('Z', 3, -2), 'Z:3~-2');
  assert.equal(T.planeKey('X', -3, 1.5), 'X:-3~1.5');
  assert.equal(T.planeKey('Z', 3, 9), 'Z:3~7', 'a lean past 7 in a foot is held to 7');
  assert.deepEqual(T.parseKey('Z:1.5'), { axis: 'Z', off: 1.5, k: 0, t: 0 });
  const p = T.parseKey('Z:3~-2');
  assert.equal(p.axis, 'Z'); assert.equal(p.off, 3); assert.equal(p.k, -2); close(p.t, -2 / 12);
  assert.equal(T.parseKey('X:-3~1.5').k, 1.5);
});

test('in-plane coordinates are true lengths: y runs up the slope, heights shown use Y', () => {
  const key = 'Z:3~-2', t = T.parseKey(key).t, s = Math.sqrt(1 + t * t);
  const top = T.fromPlane(key, 1, 8);              // 8 ft up the slope from the ground line, 1 ft along
  close(top.Y, 8 / s, 1e-9); close(top.Z, 3 + T.parseKey(key).t * top.Y, 1e-9); close(top.X, 1, 1e-12);
  const back = T.toPlane(key, top); close(back.u, 1, 1e-9); close(back.y, 8, 1e-9);
  // a board 8 ft up the slope is 8 ft long in the world, and reaches less high than it is long
  const b = T.boardOnPlane(key, -3, 0, Math.PI / 2, 8);
  close(dist(b.a, b.b), 8, 2e-6); assert.ok(b.b.Y < 8);
  assert.equal(b.n, 'Z'); close(b.t, -2 / 12);
  // its ends lie in its own plane: Z - t·Y the same at both, to the millionth
  close(b.a.Z - b.t * b.a.Y, b.b.Z - b.t * b.b.Y, 1e-6);
  // an upright plane: y is the height, and the board has no t (exactly as before)
  const u = T.boardOnPlane('X:-1', 0.5, 2, 0, 3);
  assert.deepEqual(u, { a: { X: -1, Y: 2, Z: -0.5 }, b: { X: -1, Y: 2, Z: -3.5 }, len: 3, n: 'X' });
  // a level board in a leaning wall keeps its t (its ends can't show the lean)
  const lv = T.boardOnPlane('X:3~-1.5', -2, 7.9, 0, 4);
  close(lv.t, -1.5 / 12); close(lv.a.Y, lv.b.Y, 1e-9);
  assert.equal(T.planeKeyOf({ ...lv, id: 'x' }), 'X:3~-1.5');
});

test('planes a board lies in: a post two upright, a two-way leg two leaning, a brace one', () => {
  const post = { id: 'p', a: { X: -3, Y: 0, Z: 3 }, b: { X: -3, Y: 8, Z: 3 }, len: 8, n: 'Z' };
  assert.deepEqual(T.planesOf(post), ['Z:3', 'X:-3']);
  assert.ok(T.isPost(post)); assert.ok(T.isLeg(post));
  // a corner leg leaning in two ways at once: d = (1/12, 1, -2/12)·L from the front-left stone
  const L = 8, d = [1 / 12, 1, -2 / 12], n = Math.hypot(...d);
  const leg = T.makeBoard('l', { X: -3, Y: 0, Z: 3 }, { X: -3 + d[0] / n * L, Y: d[1] / n * L, Z: 3 + d[2] / n * L }, 'Z', L, 0, true);
  assert.deepEqual(T.planesOf(leg), ['Z:3~-2', 'X:-3~1']);
  assert.ok(!T.isPost(leg)); assert.ok(T.isLeg(leg));
  close(leg.t, -2 / 12);
  close(leg.a.Z - leg.t * leg.a.Y, leg.b.Z - leg.t * leg.b.Y, 1e-6, 'own wall');
  close(leg.a.X - (1 / 12) * leg.a.Y, leg.b.X - T.tOfK(1) * leg.b.Y, 1e-6, 'other wall');
  // the same leg put up in the side wall: its own plane is the side's
  assert.deepEqual(T.planesOf({ ...leg, n: 'X', t: undefined }), ['X:-3~1', 'Z:3~-2']);
  // a 45 degree brace in the leaning front wall lies only in it
  const br = T.boardOnPlane('Z:3~-2', -3, 0, Math.PI / 4, 8);
  assert.deepEqual(T.planesOf({ id: 'b', ...br }), ['Z:3~-2']);
  assert.ok(!T.isLeg({ id: 'b', ...br }));
  // a level board: its own plane only, by its stored lean
  const lv = { id: 'c', a: { X: -2, Y: 8, Z: 2 }, b: { X: 2, Y: 8, Z: 2 }, len: 4, n: 'Z', t: T.tOfK(-1.5) };
  assert.deepEqual(T.planesOf(lv), ['Z:3~-1.5']);
});

test('nothing leans: keys, planes and boards exactly as before', () => {
  // (the v3 rules, written out: a board's own plane by n at its a end, and a post's other plane)
  const v3own = (b) => (b.n === 'X' ? 'X:' + Math.round(b.a.X * 1e3) / 1e3 : 'Z:' + Math.round(b.a.Z * 1e3) / 1e3);
  const boards = [
    { id: 'p1', a: { X: 3, Y: 0, Z: -2 }, b: { X: 3, Y: 8, Z: -2 }, len: 8, n: 'X' },
    { id: 'c1', a: { X: -3, Y: 8, Z: 2 }, b: { X: 3, Y: 8, Z: 2 }, len: 6, n: 'Z' },
    { id: 'd1', a: { X: -3, Y: 0, Z: 2 }, b: { X: 3, Y: 8, Z: 2 }, len: 10, n: 'Z' },
    { id: 'm1', a: { X: 1, Y: 8, Z: -2 }, b: { X: 1, Y: 8, Z: 2 }, len: 4, n: 'X' },
  ];
  for (const b of boards) {
    assert.equal(T.planeKeyOf(b), v3own(b));
    assert.equal(T.planesOf(b)[0], v3own(b));
    const m = T.makeBoard(b.id, b.a, b.b, b.n, b.len);
    assert.deepEqual(m, b, 'makeBoard leaves an upright board exactly as it was (no t)');
  }
  assert.deepEqual(T.planesOf(boards[0]), ['X:3', 'Z:-2']);
  assert.deepEqual(T.planesOf(boards[2]), ['Z:2']);
  // a steep brace that happens to slant by a whole half inch a foot lies in a leaning plane too (the CONTRACT), but
  // that plane is no wall: the walls in use are the upright ones, as they always were
  const steep = { id: 's', a: { X: -1, Y: 8, Z: 1.5 }, b: { X: 1, Y: 12, Z: 1.5 }, len: Math.hypot(2, 4), n: 'Z' };
  assert.equal(T.planesOf(steep).length, 2);
  const t = { W: 6, D: 4, boards: [...boards, steep] };
  assert.deepEqual([...T.wallsInUse(t)].sort(), T.planesInUse(t).filter((k) => !k.includes('~')).sort());
  assert.ok(!T.isCornerLine(t, steep));
  assert.ok(T.isCornerLine(t, boards[0]));
});

test('crossings: a post in the middle crosses a leaning wall at one height', () => {
  const t = { W: 6, D: 6, boards: [{ id: 'm', a: { X: 0, Y: 0, Z: 2 }, b: { X: 0, Y: 8, Z: 2 }, len: 8, n: 'Z' }] };
  const cs = T.crossings(t, 'Z:3~-1.5');
  assert.equal(cs.length, 1);
  // Z = 3 - 0.125·Y = 2 at Y = 8
  close(T.fromPlane('Z:3~-1.5', cs[0].u, cs[0].y).Y, 8, 1e-6);
  // an upright plane: posts are parallel to it and never cross it (as before)
  assert.equal(T.crossings(t, 'Z:3').length, 0);
});

// a tapered storey: four corner legs leaning in 1½ in a foot both ways on a 6 × 6 base, a crosspiece in the front wall
function taper() {
  const k = -1.5 / 12, L = 8, out = [];
  let i = 0;
  for (const [sx, sz, n] of [[-1, 1, 'Z'], [1, 1, 'X'], [1, -1, 'Z'], [-1, -1, 'X']]) {
    // (each leg leans toward the middle: X toward 0, Z toward 0, 1½ in a foot each way)
    const dd = [sx * k, 1, sz * k], mm = Math.hypot(...dd);
    out.push(T.makeBoard('l' + i++, { X: sx * 3, Y: 0, Z: sz * 3 }, { X: sx * 3 + dd[0] / mm * L, Y: dd[1] / mm * L, Z: sz * 3 + dd[2] / mm * L }, n, L, 0, true));
  }
  return { W: 6, D: 6, boards: out };
}

test('a tapered storey: walls in use, corner lines, the width between the legs', () => {
  const t = taper();
  const walls = [...T.wallsInUse(t)].sort();
  assert.deepEqual(walls, ['X:-3~1.5', 'X:3~-1.5', 'Z:-3~1.5', 'Z:3~-1.5']);
  for (const b of t.boards) assert.ok(T.isCornerLine(t, b), b.id);
  // the front wall's segments: two legs, slanting toward each other
  const segs = T.planeSegments(t, 'Z:3~-1.5');
  assert.equal(segs.length, 2); assert.ok(segs.every((s) => s.leg && !s.post));
  // a crosspiece in the front wall at 4 ft up (in-plane y = 4·√(1+t²)): the wall is 6 - 2·(1.5·4/12) = 5 ft wide there
  const s = Math.sqrt(1 + (1.5 / 12) ** 2);
  close(T.wallSpan(t, 'Z:3~-1.5', { ax: -2.5, ay: 4 * s, bx: 2.5, by: 4 * s }), 5, 1e-3);
  close(T.wallSpan(t, 'Z:3~-1.5', { ax: -2, ay: 6 * s, bx: 2, by: 6 * s }), 4.5, 1e-3);
  // (8 ft legs leaning two ways reach a little under 8 ft)
  const top = t.boards[0].b.Y;
  assert.ok(top < 8 && top > 7.8, String(top));
  // the corner leg is named by both its walls
  assert.equal(T.planeName(t, 'Z:3~-1.5'), 'the front wall, leaning in 1½ in a foot');
  assert.equal(T.planeName(t, 'X:-3~1.5', true), 'left side, leaning in 1½ in a foot');
  assert.equal(T.faceOfPlane(t, 'Z:-3~1.5'), 2);
  assert.deepEqual(T.faceWalls(t, 1), ['X:3~-1.5']);
});

test('names: in and out, upright, inside walls', () => {
  const t = { W: 6, D: 4, boards: [] };
  assert.equal(T.planeName(t, 'Z:2'), 'the front wall');
  assert.equal(T.planeName(t, 'Z:2~-2'), 'the front wall, leaning in 2 in a foot');
  assert.equal(T.planeName(t, 'Z:2~1'), 'the front wall, leaning out 1 in a foot');
  assert.equal(T.planeName(t, 'Z:-2~2'), 'the back wall, leaning in 2 in a foot');
  assert.equal(T.planeName(t, 'X:3~-0.5'), 'the right side, leaning in ½ in a foot');
  assert.equal(T.planeName(t, 'X:-3~-7'), 'the left side, leaning out 7 in a foot');
  assert.equal(T.planeName(t, 'Z:0.5'), 'the inside wall 1½ ft in from the front');
  // an inside wall that leans is named where it stands at its foot (a tier's wall on beams 8 ft up)
  assert.equal(T.planeName(t, 'Z:1.5~-1.5', true, 8), '1½ ft in from the front, leaning in 1½ in a foot');
  assert.equal(T.leanWords(t, 'Z:0~2'), 'leaning toward the front 2 in a foot');
  assert.equal(T.leanWords(t, 'Z:2'), 'upright');
  assert.equal(T.leansIn('Z:2~-2'), 1); assert.equal(T.leansIn('Z:2~2'), -1); assert.equal(T.leansIn('X:-3~1'), 1); assert.equal(T.leansIn('Z:2'), 0);
});

test('twins carry the lean: a wall leaning in leans in on the opposite wall', () => {
  const t = taper();
  // a level crosspiece in the front wall leaning in, across the legs at 4 ft up
  const s = Math.sqrt(1 + (1.5 / 12) ** 2), cp = T.boardOnPlane('Z:3~-1.5', -2.5, 4 * s, 0, 5);
  const twins = T.twinsOf(t, { id: 'c', ...cp }, () => true);
  const keys = twins.map((g) => T.planeKeyOf(g)).sort();
  assert.deepEqual(keys, ['X:-3~1.5', 'X:3~-1.5', 'Z:-3~1.5']);
  for (const g of twins) close(Math.min(g.a.Y, g.b.Y), cp.a.Y, 1e-6);
  // a two-way leg's twins: the three other corners, each leaning in both ways, the two beside it turned a quarter
  const leg = t.boards[0], lt = T.twinsOf({ W: 6, D: 6, boards: [leg] }, leg, () => true);
  assert.equal(lt.length, 3);
  const corners = lt.map((g) => [Math.sign(g.a.X), Math.sign(g.a.Z), g.n].join(',')).sort();
  assert.deepEqual(corners, ['-1,-1,X', '1,-1,Z', '1,1,X']);
  for (const g of lt) {
    const ks = T.planesOf(g).map((k) => T.parseKey(k));
    assert.equal(ks.length, 2);
    for (const q of ks) assert.equal(T.leansIn(T.planeKey(q.axis, q.off, q.k)), 1, 'leans in');
  }
  // a twin of a post stays a post with no t (as before)
  const post = { id: 'p', a: { X: -3, Y: 0, Z: 3 }, b: { X: -3, Y: 8, Z: 3 }, len: 8, n: 'Z' };
  for (const g of T.twinsOf({ W: 6, D: 6, boards: [post] }, post, () => true)) assert.ok(!('t' in g));
});

test('the footprint: an end may stand out past the stones only as far as a lean allows', () => {
  const t = { W: 6, D: 6, boards: [] };
  assert.ok(T.inFootprint(t, { X: 3, Y: 0, Z: 0 }));
  assert.ok(!T.inFootprint(t, { X: 3.2, Y: 0, Z: 0 }), 'on the ground: within the stones');
  assert.ok(T.inFootprint(t, { X: 3 + 7 / 12 * 6, Y: 6, Z: 0 }), '7 in a foot out, 6 ft up');
  assert.ok(!T.inFootprint(t, { X: 3 + 7 / 12 * 6 + 0.1, Y: 6, Z: 0 }));
  assert.ok(!T.inFootprint(t, { X: 3.5, Y: 6, Z: 0 }, false), 'a board in upright walls stays over the stones');
  // a wall leaning out (the board nailed): its twins are offered out past the stones
  const out = { id: 'o', ...T.boardOnPlane('Z:3~2', -3, 0, Math.PI / 2, 8) };
  const tw = T.twinsOf({ W: 6, D: 6, boards: [out] }, out, () => true);
  // (a post leaned out only in the front wall's way: each twin lies in a front or back wall leaning out, and an upright side)
  assert.equal(tw.length, 3);
  for (const g of tw) { const ks = T.planesOf(g); assert.ok(ks.some((k) => k[0] === 'Z' && T.leansIn(k) === -1) && ks.some((k) => k[0] === 'X' && !T.parseKey(k).k), ks.join(' ')); }
  // the front and back walls leaning out, the sides upright: a side's crosspiece has its twin on the other side only,
  // not turned a quarter into the leaning back wall
  const legs = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sz], i) => T.makeBoard('l' + i, { X: 3 * sx, Y: 0, Z: 3 * sz }, { X: 3 * sx, Y: 8 / Math.hypot(1, 2 / 12), Z: 3 * sz + sz * (2 / 12) * 8 / Math.hypot(1, 2 / 12) }, 'Z', 8));
  const side = T.makeBoard('s', { X: -3, Y: 4.5, Z: 3.75 }, { X: -3, Y: 4.5, Z: -3.75 }, 'X', 7.5);
  const flare = { W: 6, D: 6, boards: [...legs, side] };
  const st = T.twinsOf(flare, side);
  assert.deepEqual(st.map((g) => T.planeKeyOf(g)), ['X:3']);
  // nothing leaning anywhere: a board sticking out past the stones has no twins out there (as before walls could lean)
  const over = { id: 'v', a: { X: -4, Y: 8, Z: 3 }, b: { X: 4, Y: 8, Z: 3 }, len: 8, n: 'Z' };
  assert.equal(T.twinsOf({ W: 6, D: 6, boards: [over] }, over, () => true).length, 0);
});

test('spotTaken and makeBoard on a leaning wall', () => {
  const t = taper();
  const again = T.makeBoard('x', t.boards[0].a, t.boards[0].b, 'X', 8, 0, true);
  assert.ok(T.spotTaken(t, again), 'the same leg again');
  const lv = T.makeBoard('c', { X: -2, Y: 7.9, Z: 2.0125 }, { X: 2, Y: 7.9, Z: 2.0125 }, 'Z', 4, T.tOfK(-1.5));
  close(lv.t, -0.125); assert.equal(T.planeKeyOf(lv), T.planeKey('Z', 2.0125 + 0.125 * 7.9, -1.5));
});

test('slope questions: rate, width at a height, and a leg by the right triangle', () => {
  const rnd = seeded(3);
  for (const k of [0.5, 1, 1.5, 2, 3, 7]) {
    const q = Q.rateQuestion(k, 'in', rnd);
    assert.ok(q, 'k ' + k);
    const Y = +q.prompt.match(/at (\d+) ft up/)[1];
    assert.equal(q.answer, k * Y);
    assert.ok(q.choices.includes(q.answer) && new Set(q.choices).size === q.choices.length && q.choices.length >= 3);
    assert.equal(q.labels.length, q.choices.length);
    assert.equal(q.helper.kind, 'steps');
  }
  // a taper: 6 ft across, leaning in 1½ in a foot on each side, at 8 ft: 4 ft
  let seen8 = false;
  for (let i = 0; i < 40; i++) {
    const q = Q.widthQuestion(6, 1.5, 'in', seeded(i + 1));
    const Y = +q.prompt.match(/at (\d+) ft up/)[1];
    assert.equal(q.answer, 6 - 2 * 1.5 * Y / 12);
    assert.ok(q.answer >= 1 && Number.isInteger(q.answer * 2));
    if (Y === 8) { seen8 = true; assert.equal(q.answer, 4); assert.ok(q.labels.includes('4 ft')); }
  }
  assert.ok(seen8, 'the 8 ft case comes up');
  // leaning out gets wider
  const wo = Q.widthQuestion(4, 1, 'out', seeded(5));
  assert.ok(wo.answer > 4);
  // a leg: a whole-number triple when the leg is that long, else "about" to the inch (8×8 − r×r)
  const l5 = Q.legQuestion(5, 1.5, seeded(2));
  assert.equal(l5.answer, 48, 'a 5 ft leg leaning 3 ft reaches 4 ft');
  assert.ok(l5.labels.includes('4 ft'));
  const l8 = Q.legQuestion(8, 1.5, seeded(4));
  const r = +l8.prompt.match(/stands (\d+) ft in/)[1];
  assert.equal(l8.answer, Math.round(Math.sqrt(64 - r * r) * 12));
  assert.ok(l8.answer < 96, 'a leaning leg reaches less high than it is long');
  assert.ok(Q.legQuestion(7.3, 1.5, seeded(4)) === null, 'only a whole-foot leg');
  // slopeQuestion picks among them; no lean, no question
  assert.equal(Q.slopeQuestion({ k: 0, dir: 'in' }), null);
  const kinds = new Set();
  for (let i = 0; i < 60; i++) kinds.add(Q.slopeQuestion({ k: 1.5, dir: 'in', base: 6, legLen: 8 }, seeded(i + 11)).pic.kind);
  assert.deepEqual([...kinds].sort(), ['lean', 'leg', 'taper']);
  // a leg 8 ft long leaning out 2 ft: 8² − 2² = 60, √60 ≈ 7 ft 9 in
  assert.equal(Q.ftIn(Math.round(Math.sqrt(60) * 12) / 12), '7 ft 9 in');
});
