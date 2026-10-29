// The graph teacher's questions (src/math/graphs.js) and his ladder (src/levels/place/graphs.js): points on the grid
// they ask for, right answers, the "What point is this?" answers (the right one, x and y swapped, near misses: all on the
// grid, no two the same), a sitting with no point twice, and the "Show me" walk.
import test from 'node:test';
import assert from 'node:assert/strict';

const G = await import('../src/math/graphs.js');
const { PLACE } = await import('../src/levels/place/graphs.js');
const { PLACE: REG } = await import('../src/levels/places.js');

const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const GENS = PLACE.levels.map((L) => L.gen);

test('the ladder: rungs 1 to 3 in order, registered with the levels', () => {
  assert.deepEqual(PLACE.levels.map((L) => L.id), ['find', 'read', 'quads']);
  assert.equal(REG.graphs, PLACE);
  assert.ok(PLACE.levels.every((L, i, a) => i === 0 || L.grade > a[i - 1].grade));
});

test('points: on the grid, x never equal to y, a negative in every four-quarter point', () => {
  for (const gen of GENS) for (let s = 1; s <= 400; s++) {
    const p = G.pickPoint(gen, rngOf(s));
    assert.ok(p.x >= gen.lo && p.x <= gen.hi && p.y >= gen.lo && p.y <= gen.hi, JSON.stringify([gen, p]));
    assert.notEqual(p.x, p.y);
    assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y));
    if (gen.lo < 0) assert.ok(p.x < 0 || p.y < 0, JSON.stringify(p)); else assert.ok(p.x >= 0 && p.y >= 0);
  }
});

test('find and read: the right answer is the point, written x first with a true minus', () => {
  assert.equal(G.pointText(2, 3), '(2, 3)');
  assert.equal(G.pointText(-4, 0), '(−4, 0)');
  for (let s = 1; s <= 200; s++) {
    const f = G.makeQuestion({ kind: 'find', lo: 0, hi: 6 }, rngOf(s));
    assert.equal(f.kind, 'find'); assert.equal(f.answer, G.pointText(f.x, f.y)); assert.equal(f.text, `Find ${f.answer}`); assert.equal(f.choices, undefined);
    const r = G.makeQuestion({ kind: 'read', lo: 0, hi: 6 }, rngOf(s));
    assert.equal(r.kind, 'read'); assert.equal(r.text, 'What point is this?');
    const good = r.choices.filter((c) => c.good);
    assert.equal(good.length, 1); assert.equal(good[0].x, r.x); assert.equal(good[0].y, r.y); assert.equal(good[0].label, r.answer);
  }
});

test('read answers: four, the swap always among them, all on the grid, no two the same', () => {
  for (const gen of GENS) for (let s = 1; s <= 300; s++) {
    const rng = rngOf(s), { x, y } = G.pickPoint(gen, rng), cs = G.choicesFor(x, y, gen, rng);
    assert.equal(cs.length, 4, JSON.stringify([gen, x, y, cs]));
    assert.equal(new Set(cs.map((c) => `${c.x},${c.y}`)).size, 4);
    assert.equal(new Set(cs.map((c) => c.label)).size, 4);
    assert.ok(cs.some((c) => !c.good && c.x === y && c.y === x), 'x and y swapped is one of the answers');
    for (const c of cs) assert.ok(c.x >= gen.lo && c.x <= gen.hi && c.y >= gen.lo && c.y <= gen.hi, JSON.stringify(c));
    // (near misses: every wrong one is the swap, a sign flip, or one step from the point or from the swap)
    for (const c of cs.filter((q) => !q.good)) {
      const d = (a, b) => Math.abs(c.x - a) + Math.abs(c.y - b);
      assert.ok(d(y, x) <= 1 || d(x, y) <= 1 || (Math.abs(c.x) === Math.abs(x) && Math.abs(c.y) === Math.abs(y)), JSON.stringify([x, y, c]));
    }
  }
});

test('the four quarters by turns: find, then read', () => {
  const gen = { kind: 'quads', lo: -5, hi: 5 };
  assert.equal(G.makeQuestion(gen, rngOf(3), { i: 0 }).kind, 'find');
  assert.equal(G.makeQuestion(gen, rngOf(3), { i: 1 }).kind, 'read');
  // (some read answers in the four quarters flip a sign: the other mistake there)
  let flips = 0;
  for (let s = 1; s <= 100; s++) { const q = G.makeQuestion(gen, rngOf(s), { i: 1 }); if (q.choices.some((c) => !c.good && Math.abs(c.x) === Math.abs(q.x) && Math.abs(c.y) === Math.abs(q.y) && (c.x !== q.y || c.y !== q.x))) flips++; }
  assert.ok(flips > 80, `flips ${flips}`);
});

test('a sitting: five questions, no point twice', () => {
  for (const gen of GENS) for (let s = 1; s <= 100; s++) {
    const qs = G.sitting(gen, rngOf(s));
    assert.equal(qs.length, G.GRAPH.n);
    assert.equal(new Set(qs.map((q) => `${q.x},${q.y}`)).size, qs.length);
  }
});

test('Show me: along x from 0, then up or down to y; the words', () => {
  assert.deepEqual(G.walk(2, 3).map((s) => [s.axis, s.from, s.to, s.n, s.dir]), [['x', [0, 0], [2, 0], 2, 'right'], ['y', [2, 0], [2, 3], 3, 'up']]);
  assert.deepEqual(G.walk(-4, -1).map((s) => s.dir), ['left', 'down']);
  assert.equal(G.walkWords(2, 3), 'right 2, then up 3');
  assert.equal(G.walkWords(0, -2), 'no steps across, then down 2');
  assert.match(G.wrongFind({ x: 3, y: 2 }, { x: 2, y: 3 }), /You tapped \(3, 2\)\. For \(2, 3\), start at 0: right 2, then up 3/);
  assert.match(G.wrongRead({ x: 3, y: 2 }, { x: 2, y: 3 }), /\(3, 2\) would be right 3, then up 2/);
  assert.equal(G.nudge({ kind: 'find', x: -3, y: 1 }), 'Start at 0. Left 3, then up 1.');
  assert.equal(G.RULE, 'x first: left or right; then y: up or down.');
});

test('the levels page examples come from the same maker', () => {
  for (const L of PLACE.levels) for (let s = 1; s <= 20; s++) { const ex = PLACE.example(L, rngOf(s)); assert.ok(ex.q && ex.a, JSON.stringify(ex)); }
});
