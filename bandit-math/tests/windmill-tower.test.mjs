// The windmill lab's tower as FREE BOARDS (labs/windmill/tower.js): no walls. Sockets (where a board's first end goes),
// the free end (its height from its length), connecting to a board it can reach (a too-long board sticking out past
// the joint), sawing off the extra (the offcut rounded down to the half foot), twins (mirrors and quarter turns), the
// words that name a board by where it is, the triangles the miller finds in 3D, and his "how high does it reach"
// question. node --test tests/windmill-tower.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const T = await import('../labs/windmill/tower.js');
const Q = await import('../labs/windmill/questions.js');

const close = (a, b, e = 1e-6, msg) => assert.ok(Math.abs(a - b) <= e, `${msg || ''} ${a} vs ${b}`);
const dist = (p, q) => Math.hypot(p.X - q.X, p.Y - q.Y, p.Z - q.Z);
const near = (p, q, e = 1e-5) => dist(p, q) < e;
// a seeded 0..1 random function, so the questions come out the same every run
const seeded = (s = 7) => () => { s = (s + 0x6D2B79F5) | 0; let r = Math.imul(s ^ (s >>> 15), 1 | s); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
const P = (X, Y, Z) => ({ X, Y, Z });
const B = (id, a, b, len) => T.makeBoard(id, a, b, len);

test('sockets: the half foot on the ground within the stones, and along boards from either end', () => {
  const t = T.newTower(6, 4);
  const g = T.socketsOf(t);
  assert.equal(g.length, 13 * 9, 'every half foot over a 6 x 4 base, the stones included');
  for (const c of [P(3, 0, 2), P(-3, 0, -2), P(0, 0, 0)]) assert.ok(g.some((s) => near(s, c) && !s.on), JSON.stringify(c));
  // a corner post: half-foot steps up it (its foot is the ground's socket already)
  t.boards.push(B('p', P(3, 0, 2), P(3, 8, 2), 8));
  // a brace 5 ft 8 in. long: half-foot steps from each of its ends (they don't meet on the same points)
  const L = Math.hypot(4, 4);
  t.boards.push(B('br', P(-3, 0, 2), P(1, 4, 2), L));
  const s = T.socketsOf(t), up = s.filter((q) => q.on && q.on.id === 'p'), br = s.filter((q) => q.on && q.on.id === 'br');
  assert.equal(up.length, 16, 'the post: 0.5 ... 8 ft up (its foot is the ground socket)');
  assert.ok(up.some((q) => near(q, P(3, 8, 2))) && up.some((q) => near(q, P(3, 4.5, 2))));
  assert.ok(br.some((q) => Math.abs(q.s - 0.5) < 1e-6) && br.some((q) => Math.abs(q.s - (L - 0.5)) < 1e-6), 'steps from both ends');
  assert.ok(br.some((q) => near(q, P(1, 4, 2))), 'its top end');
  // no spot listed twice
  for (const q of s) assert.equal(s.filter((o) => near(o, q, 0.02)).length, 1, JSON.stringify(q));
});

test('the free end: moved over by the half foot, its height from its length; too far over, it can\'t', () => {
  const A = P(-3, 0, 3);
  assert.deepEqual(T.freeEnd(A, 8, 0, 0), P(-3, 8, 3), 'straight up');
  const b = T.freeEnd(A, 8, 2, 0);
  close(b.Y, Math.sqrt(60), 1e-6); close(dist(A, b), 8, 1e-6);
  const c = T.freeEnd(A, 5, 3, -1.5); close(dist(A, c), 5, 1e-6); close(c.Z, 1.5);
  assert.equal(T.freeEnd(A, 4, 3, 3), null, 'a 4 ft board reaches only 4 ft over');
  // down from a socket up a post: it may hang down, never below the ground
  const hi = P(3, 6, 3), d = T.freeEnd(hi, 5, -3, 0, -1);
  close(d.Y, 2); assert.equal(T.freeEnd(P(0, 1, 0), 5, 0, 0, -1), null);
});

test('connecting: the free end reaches a board; a too-long board passes through and sticks out; a short one never', () => {
  const post = B('p', P(3, 0, 3), P(3, 8, 3), 8), A = P(-3, 0, 3);
  // an 8 ft board from the other corner's foot reaches the post from 0 up to √(8² − 6²) = 5.29 ft
  const span = T.reachOn(A, 8, post);
  close(span[0], 0); close(span[1], Math.sqrt(28), 1e-9);
  // right where it just reaches: no overhang, the free end on the post
  const c = T.connectTo(A, 8, post, Math.sqrt(28));
  close(c.past, 0, 1e-6); assert.ok(near(c.b, P(3, Math.sqrt(28), 3), 1e-5));
  // lower down the post: the board passes through the joint and sticks out past it
  const d = T.connectTo(A, 8, post, 3);
  close(d.past, 8 - Math.hypot(6, 3), 1e-6); assert.ok(near(d.P, P(3, 3, 3))); close(dist(A, d.b), 8, 1e-6);
  assert.ok(d.b.X > 3, 'its end is out past the post');
  // anywhere along the reachable stretch it connects (a wide range: it stays connected while the end slides)
  for (let s = 0.5; s <= 5; s += 0.5) assert.ok(T.connectTo(A, 8, post, s), `at ${s}`);
  assert.equal(T.connectTo(A, 8, post, 6), null, 'past its reach');
  // too short: a 5 ft board never reaches a post 6 ft away
  assert.equal(T.reachOn(A, 5, post), null);
  // the arrows: a board set over by the half foot that lands on (or passes through) a board connects there
  const t = { W: 6, D: 6, boards: [post] };
  const on = T.connectAlong(t, A, T.freeEnd(A, 8, 6, 0), 8);
  assert.ok(on && on.o === post); close(on.past, 0, 1e-6);
  const through = T.connectAlong(t, A, T.freeEnd(A, 8, 7, 0), 8);
  assert.ok(through && through.o === post && through.past > 1 && through.past < 1.3, JSON.stringify(through && through.past));
  close(dist(A, through.b), 8, 1e-6);
  // a board standing clear of the post: nothing
  assert.equal(T.connectAlong(t, A, T.freeEnd(A, 8, 3, 0), 8), null);
  // the board it stands on is never what it connects to
  const up = P(3, 2, 3);
  assert.equal(T.connectAlong(t, up, T.freeEnd(up, 4, -1, 0), 4, { skip: [post] }), null);
});

test('sawing off the extra: the offcut goes back rounded down to the half foot; under half a foot is kindling', () => {
  assert.equal(T.offcutOf(5 / 12), 0); assert.equal(T.offcutOf(0.49), 0);
  assert.equal(T.offcutOf(0.5), 0.5); assert.equal(T.offcutOf(1.16), 1); assert.equal(T.offcutOf(1.49), 1);
  assert.equal(T.offcutOf(1.5), 1.5); assert.equal(T.offcutOf(2), 2); assert.equal(T.offcutOf(2.999), 2.5);
});

test('twins: a corner post on the other corners, a brace on the other sides; never a crossing X, never off the stones', () => {
  const t = T.newTower(6, 6);
  t.boards.push(B('p0', P(-3, 0, 3), P(-3, 8, 3), 8));
  let tw = T.twinsOf(t, t.boards[0], () => true);
  assert.equal(tw.length, 3);
  for (const c of [[3, 3], [3, -3], [-3, -3]]) assert.ok(tw.some((g) => near(g.a, P(c[0], 0, c[1]))), c.join(','));
  // a brace on the front, corner to corner: its mirror at the back, and turned round the corners onto the two sides;
  // its mirror on the front itself would cross it (an X): not a twin
  const br = B('br', P(-3, 0, 3), P(3, 6, 3), Math.hypot(6, 6));
  tw = T.twinsOf(t, br, () => true);
  assert.equal(tw.length, 3, JSON.stringify(tw));
  assert.ok(tw.some((g) => g.a.Z === -3 && g.b.Z === -3), 'the back');
  assert.ok(tw.some((g) => g.a.X === 3 && g.b.X === 3) && tw.some((g) => g.a.X === -3 && g.b.X === -3), 'both sides');
  for (const g of tw) { assert.ok(!T.crossesMid(g, br)); close(dist(g.a, g.b), dist(br.a, br.b), 1e-9); }
  // an oblong base: no quarter turns, so the brace's only twin is at the back
  const o = T.newTower(6, 4), br2 = B('b2', P(-3, 0, 2), P(3, 6, 2), Math.hypot(6, 6));
  tw = T.twinsOf(o, br2, () => true);
  assert.equal(tw.length, 1); assert.ok(tw[0].a.Z === -2);
  // half a front crosspiece, from the left corner to the middle: its mirror side to side goes on to the right corner
  const half = B('h', P(-3, 4, 3), P(0, 4, 3), 3);
  tw = T.twinsOf(t, half, () => true);
  assert.ok(tw.some((g) => (near(g.a, P(3, 4, 3)) && near(g.b, P(0, 4, 3))) || (near(g.b, P(3, 4, 3)) && near(g.a, P(0, 4, 3)))));
  // a twin must have something to be nailed to (by default: the tower as it stands)
  assert.equal(T.twinsOf(T.newTower(6, 6), B('x', P(-1, 6, 3), P(1, 6, 3), 2)).length, 0);
});

test('words: a board named by what it is and where, never by a wall; an old tower\'s n and t are dropped', () => {
  const t = T.newTower(6, 6);
  assert.equal(T.placeWords(t, B('a', P(3, 8, 3), P(1, 14, 1), 8)), 'the brace at the front right, 8 ft up');
  assert.equal(T.placeWords(t, B('b', P(-3, 0, -3), P(-3, 8, -3), 8)), 'the post at the back left');
  assert.equal(T.placeWords(t, B('c', P(-3, 4.5, 0), P(3, 4.5, 0), 6)), 'the horizontal board in the middle, 4½ ft up');
  assert.equal(T.placeWords(t, B('d', P(3, 0, 3), P(3, 8, -3), 10)), 'the brace on the right');
  assert.equal(T.placeWords(t, B('e', P(-3, 0, 3), P(-2, 8, 2), 8), new Set(['e'])), 'the leg at the front left');
  const old = { W: 6, boards: [{ id: 'x', a: P(-3, 0, 3), b: P(-3, 8, 3), len: 8, n: 'Z' }, { id: 'y', a: P(-3, 4, 3), b: P(3, 4, 3), len: 6, n: 'Z', t: -0.125 }] };
  const c = T.cleanTower(old);
  assert.equal(c.D, 6); assert.deepEqual(Object.keys(c.boards[1]).sort(), ['a', 'b', 'id', 'len']);
});

test('the miller\'s triangles in 3D: a 3-4-5 brace on any side, and the ground as a side', () => {
  // the right side of a 3 x 3 base: two posts, a horizontal board 4 ft up, a 5 ft brace corner to corner
  const t = T.newTower(3, 3);
  t.boards.push(B('p1', P(1.5, 0, 1.5), P(1.5, 8, 1.5), 8), B('p2', P(1.5, 0, -1.5), P(1.5, 8, -1.5), 8), B('h', P(1.5, 4, 1.5), P(1.5, 4, -1.5), 3));
  const br = B('br', P(1.5, 0, 1.5), P(1.5, 4, -1.5), 5); t.boards.push(br);
  const tris = Q.trianglesOf(t, br);
  assert.ok(tris.length >= 1);
  // flat in its own plane: sides 5, 3 and 4 (or 5, 4, 3), whatever side of the tower it is on
  const sides = (tr) => [0, 1, 2].map((i) => Math.hypot(tr.pts[i].x - tr.pts[(i + 1) % 3].x, tr.pts[i].y - tr.pts[(i + 1) % 3].y)).map((v) => Math.round(v * 1000) / 1000).sort((a, b) => a - b);
  assert.ok(tris.some((tr) => sides(tr).join() === '3,4,5'), JSON.stringify(tris.map(sides)));
  const q = Q.makeQuestion(tris, br, seeded(3));
  assert.ok(q && q.kind === 'length' && [3, 4, 5].includes(q.answer), JSON.stringify(q && q.prompt));
  // with the ground: a brace from one post's foot to the other post's top makes a triangle with the ground
  const g = T.newTower(3, 3);
  g.boards.push(B('p1', P(-1.5, 0, 1.5), P(-1.5, 4, 1.5), 4), B('p2', P(1.5, 0, 1.5), P(1.5, 4, 1.5), 4));
  const b2 = B('b2', P(-1.5, 0, 1.5), P(1.5, 4, 1.5), 5); g.boards.push(b2);
  assert.ok(Q.trianglesOf(g, b2).some((tr) => sides(tr).join() === '3,4,5'));
});

test('how high a slanting board reaches: an 8 ft board 2 ft over (to the inch), a 5 ft board 3 ft over (exactly 4)', () => {
  const q = Q.reachQuestion(8, 2, seeded(1));
  assert.equal(q.answer, 93); assert.ok(q.choices.includes(93)); assert.equal(new Set(q.choices).size, q.choices.length);
  assert.equal(q.labels[q.choices.indexOf(93)], '7 ft 9 in.');
  assert.match(q.prompt, /^Your board is 8 feet long, and its top end stands 2 feet over from its foot\. About how high/);
  assert.match(q.why, /8×8 − 2×2 = 64 − 4 = 60/);
  assert.doesNotMatch(q.prompt + q.why, /\bwall|\d in\b(?!\.)/);
  const e = Q.reachQuestion(5, 3, seeded(2));
  assert.equal(e.answer, 48); assert.equal(e.helper.exact, true); assert.match(e.prompt, /How high does/);
  const h = Q.reachQuestion(7.5, 2.5, seeded(4));
  assert.equal(h.answer, Math.round(Math.sqrt(7.5 ** 2 - 2.5 ** 2) * 12)); assert.match(h.why, /7½×7½ − 2½×2½/);
  assert.equal(Q.reachQuestion(8, 8), null); assert.equal(Q.reachQuestion(8, 0), null); assert.equal(Q.reachQuestion(8, 2.3), null);
});

test('labels say "in." with the period, sentences spell the units out, the top bar says where a top end is', async () => {
  const B = await import('../labs/windmill/build.js');
  assert.equal(B.fmt(4), '4 ft'); assert.equal(B.fmt(4.5), '4½ ft'); assert.equal(B.fmt(0.5), '½ ft');
  assert.equal(B.fmt(1 + 7 / 12), '1 ft 7 in.'); assert.equal(B.fmt(9 / 12), '9 in.');
  assert.equal(B.fmtWords(4), '4 feet'); assert.equal(B.fmtWords(1), '1 foot'); assert.equal(B.fmtWords(4.5), '4½ feet');
  assert.equal(B.fmtWords(0.5), 'half a foot'); assert.equal(B.fmtWords(1 + 7 / 12), '1 foot 7 inches'); assert.equal(B.fmtWords(1 / 12), '1 inch');
  assert.equal(B.fmtStat(15 + 11 / 12), '15<span class="u">ft</span> 11<span class="u">in.</span>');
  assert.equal(B.rateWords(2.5, 'in'), '2½ inches in for every foot up');
  assert.equal(B.rateWords(1, 'out'), '1 inch out for every foot up');
  assert.equal(B.rateWords(0.5, 'in'), '½ inch in for every foot up');
  // to the nearest inch, from the middle of the base: the right and front as seen from the front; "0" on the middle
  // line; a leg and its mirror image read the same numbers with the opposite words
  const leg = T.makeBoard('L', { X: -3, Y: 0, Z: 3 }, { X: -3 + 1.5 / 12 * 8, Y: 8, Z: 3 - 1.5 / 12 * 8 }, 8);
  const top = leg.b.Y > leg.a.Y ? leg.b : leg.a;
  assert.deepEqual(B.whereWords(top), ['2 ft left', '2 ft front', '8 ft up']);
  assert.deepEqual(B.whereWords({ X: -top.X, Y: top.Y, Z: -top.Z }), ['2 ft right', '2 ft back', '8 ft up']);
  assert.deepEqual(B.whereWords({ X: 0.02, Y: 7.76, Z: -1.01 }), ['0', '1 ft back', '7 ft 9 in. up']);
  // an end on a half inch (a horizontal board 5 ft up between legs leaning 1½ inches in for every foot up ends at X =
  // ±2 ft 4½ in.): both ends, and the mirror image at the back, read the same numbers
  for (const Y of [1, 3, 5, 7]) {
    const x = 3 - 1.5 / 12 * Y, ws = [[-x, x], [x, x], [-x, -x], [x, -x]].map(([X, Z]) => B.whereWords({ X, Y, Z }));
    const nums = ws.map((w) => w.map((s) => s.replace(/ (left|right|front|back)$/, '')).join('|'));
    assert.ok(nums.every((n) => n === nums[0]), `at ${Y} ft: ${nums.join(' / ')}`);
  }
  assert.deepEqual(B.whereWords({ X: -2.875, Y: 2, Z: 0 }), ['2 ft 11 in. left', '0', '2 ft up']);
  assert.deepEqual(B.whereWords({ X: 2.875, Y: 2, Z: 0 }), ['2 ft 11 in. right', '0', '2 ft up']);
});

