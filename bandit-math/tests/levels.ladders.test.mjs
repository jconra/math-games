// Every place's ladder (src/levels/place/*.js through src/levels/places.js): the registry loads clean, each level has
// what the levels page and the model need, every level makes real examples with the place's own maker, and the
// ladders follow the agreed design's shape (one kind of math per place; the design's lock-box ladder in its order).
import test from 'node:test';
import assert from 'node:assert/strict';

const R = await import('../src/levels/places.js');
const { PLACES, PLACE, PROBLEMS, examplesOf } = R;
const { STRAND } = await import('../src/math/strands.js');
const { MISSIONS } = await import('../src/save.js');

test('the registry loaded clean: every place, in the levels page’s order', () => {
  assert.deepEqual(PROBLEMS, []);
  assert.deepEqual(PLACES.map((P) => P.id), ['roundup', 'wagon', 'lockbox', 'deer', 'fishing', 'sheep', 'pigs', 'range', 'loot', 'store', 'deliveries', 'building']);
});

test('each place: a name, its math, a line, a picture, its job switch; each level: id, title, line, grade, strand, count', () => {
  const jobs = new Set(MISSIONS.map((m) => m.id));
  for (const P of PLACES) {
    assert.ok(P.name && P.short && P.math && P.line && P.pic, P.id);
    for (const j of [P.job].flat().filter(Boolean)) assert.ok(jobs.has(j), `${P.id}: job ${j} is a MISSIONS id`);
    assert.ok(P.levels.length >= 7, `${P.id}: kindergarten to hard in small steps (${P.levels.length} levels)`);
    const seen = new Set();
    for (const L of P.levels) {
      assert.ok(!seen.has(L.id), `${P.id}/${L.id} unique`); seen.add(L.id);
      assert.ok(L.title.length <= 60 && L.line.length <= 120, `${P.id}/${L.id}: short words for a phone`);
      assert.ok(STRAND[L.strand] && L.grade >= 0 && L.grade <= 100, `${P.id}/${L.id}`);
      assert.ok(Number.isInteger(L.count ?? 5) && (L.count ?? 5) >= 1);
      assert.ok(L.gen && typeof L.gen === 'object', `${P.id}/${L.id}: generator settings`);
    }
    if (P.id !== 'building') assert.ok(P.levels[0].grade <= 18, `${P.id}: starts young (${P.levels[0].grade})`);   // (the windmill and bridge: as built, from fourth grade)
  }
});

test('every level makes 3 different examples with its place’s maker (the levels page shows them)', () => {
  for (const P of PLACES) for (const L of P.levels) {
    for (const seed of [1, 2]) {
      const ex = examplesOf(P.id, L.id, { n: 3, seed });
      assert.equal(ex.length, 3, `${P.id}/${L.id}`);
      for (const e of ex) {
        assert.ok(e.q && e.a, `${P.id}/${L.id}: ${JSON.stringify(e)}`);
        assert.ok(!/NaN|undefined|null|Infinity|\[object/.test(e.q + ' ' + e.a), `${P.id}/${L.id}: ${e.q} -> ${e.a}`);
        assert.ok(!/(^|[^\w])-\d/.test(e.q + e.a), `${P.id}/${L.id}: the real minus sign: ${e.q} -> ${e.a}`);
      }
      if (!/^g\d$/.test(L.id) && !['same', 'name'].includes(L.id)) assert.equal(new Set(ex.map((e) => e.q)).size, 3, `${P.id}/${L.id}: different examples`);
    }
  }
  assert.deepEqual(examplesOf('lockbox', 'x10', { seed: 4 }), examplesOf('lockbox', 'x10', { seed: 4 }), 'the same seed, the same examples');
});

test('the lock boxes follow the design’s ladder: find x first, the moves and fast answers from x on both sides, slower after', () => {
  const L = PLACE.lockbox.levels;
  assert.deepEqual(L.slice(0, 9).map((x) => x.id), ['whatAdd', 'whatSub', 'x10', 'x15', 'x20', 'xMul', 'xDiv', 'xBig', 'two']);
  const both = L.findIndex((x) => x.id === 'both');
  assert.ok(L.slice(0, both).every((x) => x.gen.find && (x.count ?? 5) === 5), 'x on one side: find x, about 5 each');
  assert.ok(L.slice(both).every((x) => !x.gen.find && x.count === 10), 'from x on both sides: about 10 each');
  assert.ok(Math.abs((100 * both) / L.length - 50) <= 10, `x on both sides near the middle (${Math.round((100 * both) / L.length)}%)`);
  assert.equal(PLACE.lockbox.fastFrom, 'both');
});

test('one kind of math per place: the round-up is all series, fishing all fractions, the times tables in the difficulty order', () => {
  assert.ok(PLACE.roundup.levels.every((L) => ['series', 'herd', 'down', 'step', 'rule', 'frac', 'dec', 'neg'].includes(L.gen.kind)));
  const series = PLACE.roundup.levels.filter((L) => L.gen.table).map((L) => L.gen.table);
  assert.deepEqual(series, [2, 10, 5, 3, 4, 9, 6, 8, 7, 11, 12], 'the tiers in order: 2; 10, 5, 3; 4, 9; 6, 8, 7; 11, 12');
  assert.deepEqual(PLACE.wagon.levels.filter((L) => L.gen.kind === 'gang' && L.gen.table).map((L) => L.gen.table), series, 'the wagon\'s gangs in the same order');
  assert.ok(PLACE.fishing.levels.every((L) => L.strand === 'frac'));
  assert.ok(PLACE.wagon.levels.slice(0, 4).every((L) => L.gen.kind === 'parity'), 'the wagon starts with odds and evens');
  assert.ok(PLACE.sheep.levels.every((L) => ['add', 'sub'].includes(L.strand)), 'the sheep: adding and taking away');
  assert.ok(PLACE.pigs.levels.every((L) => ['less-more', 'even-odd', 'half', 'neg-pos'].includes(L.gen.pens)), 'the pigs: sorting into two pens');
  assert.ok(PLACE.range.levels.every((L) => L.strand === 'number'), 'the range: number sense');
  assert.ok(PLACE.loot.levels.every((L) => L.strand === 'div'), 'loot: sharing');
});
