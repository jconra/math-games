// The five ladders of fishing, the sick sheep, the loose pigs, the bottle range and loot (src/levels/place/*.js): each
// level's questions come from the job's own maker (one source), every question made is right by its own sums, the
// youngest levels are read out, and each job asks its place's level and records each answer there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { PLACE } = await import('../src/levels/places.js');
const { seeded } = await import('../src/levels/kit.js');
const { shareAt, picture } = await import('../src/math/shares.js');
const { cardAt, rightNow } = await import('../src/math/numbersense.js');
const { makeRng } = await import('../src/lockbox/generate.js');
const { itemAt, flockAt } = await import('../src/missions/sheepmath.js');
const { batchAt, penFor, judge } = await import('../src/missions/pigmath.js');
const { questionAt, lessonAt } = await import('../labs/fishing/pies.js');

const MINE = ['fishing', 'sheep', 'pigs', 'range', 'loot'];
const N = 25;
const num = (s) => Number(String(s).replace(/[−]/g, '-').replace(/[,$]/g, ''));

test('each ladder: kindergarten first (read out), small steps, examples from the job’s own maker', () => {
  for (const id of MINE) {
    const P = PLACE[id];
    assert.ok(P.levels[0].grade <= 8, `${id} starts young (kindergarten or first grade)`);
    assert.equal(P.levels[0].read, true, `${id}: the first level is read out`);
    for (const L of P.levels) {
      const rand = seeded(L.id.length * 31 + 7);
      for (let k = 0; k < 6; k++) {
        const ex = P.example(L, rand);
        assert.ok(ex && ex.q && ex.a != null, `${id}/${L.id}`);
        assert.ok(!/undefined|NaN|null/.test(ex.q + ' ' + ex.a), `${id}/${L.id}: ${ex.q} -> ${ex.a}`);
      }
    }
  }
});

test('loot: every share at every level adds up, one right coin, the youngest drawn on the slip (never the answer)', () => {
  for (const L of PLACE.loot.levels) {
    const rand = seeded(11);
    for (let k = 0; k < N; k++) {
      const p = shareAt(L.gen, { rand });
      assert.equal(p.coins.filter((c) => c.good).length, 1, L.id);
      assert.equal(p.coins.find((c) => c.good).label, p.answer);
      assert.equal(new Set(p.coins.map((c) => c.v)).size, p.coins.length, `${L.id}: no coin twice`);
      if (L.gen.kind === 'even') assert.equal(p.each * p.groups, p.total, L.id);
      if (L.gen.kind === 'rem') { assert.equal(p.each * p.groups + p.left, p.total); assert.ok(p.left > 0 && p.left < p.groups); }
      if (L.gen.range) { assert.ok(p.groups >= L.gen.range.g[0] && p.groups <= L.gen.range.g[1] && p.each >= L.gen.range.q[0] && p.each <= L.gen.range.q[1], `${L.id}: ${p.groups} x ${p.each}`); }
      if (L.gen.drawn) {
        assert.ok(p.lead, `${L.id}: drawn`);
        const svg = picture(p.lead).svg, texts = [...svg.matchAll(/>([^<]+)</g)].map((m) => m[1]).join(' ');
        assert.ok(!new RegExp(`(^|\\D)${p.each}(\\D|$)`).test(texts), `${L.id}: the picture's words never show ${p.each}: ${texts}`);
      } else assert.equal(p.lead, null);
    }
  }
});

test('the range: each level’s card has the right targets (place value, the dot on the line, the rest)', () => {
  for (const L of PLACE.range.levels) {
    const rng = makeRng(5);
    for (let k = 0; k < N; k++) {
      const c = cardAt(L.gen, { rng });
      assert.equal(new Set(c.targets.map((t) => t.n)).size, c.targets.length, `${L.id}: numbers all different`);
      assert.ok(rightNow(c).length >= 1, L.id);
      if (c.kind === 'place') {
        const { d, k: at, digits } = c.ask, dig = (n, i) => Math.floor(n / 10 ** i) % 10;
        for (const t of c.targets) {
          assert.equal(String(t.n).length, digits);
          assert.equal(t.good, dig(t.n, at) === d, `${L.id}: ${t.n} (${d} in place ${at})`);
        }
        assert.equal(c.targets.filter((t) => t.good).length, 1);
      }
      if (c.kind === 'dot') {
        assert.ok(c.ask.v >= c.ask.lo && c.ask.v <= c.ask.hi && c.ask.v % 5 !== 0, `${L.id}: the dot at ${c.ask.v} sits between the numbered ticks`);
        assert.deepEqual(c.targets.filter((t) => t.good).map((t) => t.n), [c.ask.v]);
        assert.ok(c.pic && c.pic.labels === 5, 'the card draws its own number line, numbered every 5');
        if (!L.gen.neg) assert.ok(c.targets.every((t) => t.n > 0));
      }
      if (L.gen.kind === 'compare' && L.gen.n === 2) assert.match(c.rule, /bigger|smaller/);
    }
  }
});

test('the sheep: a sick sheep’s sum is wrong by a real slip and one bottle cures it; a healthy one is right', () => {
  for (const L of PLACE.sheep.levels) {
    const rand = seeded(23);
    for (let k = 0; k < N; k++) {
      const ill = k % 2 === 0, it = itemAt(L.gen, ill, rand, new Set());
      assert.equal(it.sick, ill);
      const right = it.bottles.filter((b) => b.right);
      if (ill) { assert.equal(right.length, 1, `${L.id}: one cure`); assert.equal(right[0].value, it.answer); assert.notEqual(it.shown, it.fixed); }
      else { assert.equal(right.length, 0); assert.equal(it.shown, it.fixed); }
      assert.equal(new Set(it.bottles.map((b) => b.value)).size, it.bottles.length, `${L.id}: bottles all different`);
      if (L.gen.maker === 'columns' || L.gen.maker === 'money') {
        // the fixed sum checks out: a + b or a − b
        const m = it.fixed.match(/^\$?([\d,.]+) ([+−]) \$?([\d,.]+) = \$?([\d,.]+)$/);
        assert.ok(m, it.fixed);
        const [a, b, r] = [m[1], m[3], m[4]].map(num);
        assert.ok(Math.abs((m[2] === '+' ? a + b : a - b) - r) < 1e-9, it.fixed);
        if (L.gen.maker === 'columns') assert.equal(String(Math.round(a)).length, L.gen.digits, `${L.id}: ${it.fixed}`);
      }
    }
    const f = flockAt(L.gen, { size: 6, rand });
    assert.ok(f.sheep.filter((s) => s.sick).length >= 1 && f.sheep.filter((s) => !s.sick).length >= 1);
  }
});

test('the sheep fill the old gap: column sums, prices and change between two-digit sums and the negatives', () => {
  const ids = PLACE.sheep.levels.map((L) => L.id);
  const between = ids.slice(ids.indexOf('sub2d') + 1, ids.indexOf('negUp'));
  assert.deepEqual(between, ['add3', 'sub3', 'add3c', 'sub3b', 'money', 'change', 'add4', 'sub4']);
});

test('the pigs: every pig goes in its pen by its own answer, both pens get one, none on the line between', () => {
  for (const L of PLACE.pigs.levels) {
    const rand = seeded(41);
    for (let k = 0; k < N; k++) {
      const b = batchAt(L.gen, { size: 5, rand });
      assert.equal(b.pigs.length, 5);
      assert.deepEqual([...new Set(b.pigs.map((p) => p.pen))].sort(), [0, 1], `${L.id}: both pens`);
      for (const p of b.pigs) {
        assert.equal(penFor(b, p.answer), p.pen, `${L.id}: ${p.text}`);
        if (b.mode === 'sizes' || b.mode === 'signs' || b.mode === 'half') assert.notEqual(p.answer, b.split, `${L.id}: ${p.text} on the line`);
        assert.equal(judge(b, p, p.pen).right, true); assert.equal(judge(b, p, 1 - p.pen).right, false);
        assert.ok(judge(b, p, 1 - p.pen).line.length > 10);
      }
      if (L.gen.pens === 'less-more' && L.gen.mid) assert.equal(b.split, L.gen.mid, `${L.id}: the signs say ${L.gen.mid}`);
    }
  }
});

test('fishing: all fractions; every question has its answer among different choices, and a lesson of its own kind', () => {
  for (const L of PLACE.fishing.levels) {
    assert.equal(L.strand, 'frac');
    const rand = seeded(53);
    for (let k = 0; k < N; k++) {
      const q = questionAt(L.gen, rand);
      assert.ok(q.choices.includes(q.answer), `${L.id}: ${q.prompt}`);
      assert.equal(new Set(q.choices).size, q.choices.length, `${L.id}: ${q.choices}`);
      assert.equal(q.labels.length, q.choices.length);
      assert.ok(q.fish && q.fish.kind, `${L.id}: a caught fish on the card`);
      assert.ok(q.why && q.rule && q.steps.length, L.id);
      if (q.topic === 'slices' || q.topic === 'left') { const [n, d] = q.answer.split('/').map(Number); assert.ok(n >= 1 && n <= d, q.answer); }
      if (q.topic === 'group') { const m = q.prompt.match(/caught (\d+) fish .*\((\d+)\/(\d+)\)/); assert.equal(+q.answer, (+m[1] / +m[3]) * +m[2], q.prompt); }
      const ex = lessonAt(L.gen, rand, {}, q.topic);
      assert.equal(ex.topic, q.topic, `${L.id}: the lesson is the same kind`);
    }
  }
  assert.ok(!PLACE.fishing.levels.some((L) => ['cook', 'bait', 'rule', 'part'].includes(L.gen.topic)), 'no ratios at the dock: the store has them');
});

test('the jobs ask their place’s level and record each answer at the level it was made at', () => {
  const src = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');
  const jobs = { loot: '../src/missions/loot.js', range: '../src/missions/shooting.js', sheep: '../src/missions/sheep.js', pigs: '../src/missions/pigs.js', fishing: '../src/fishingjob.js' };
  for (const [place, f] of Object.entries(jobs)) {
    const s = src(f);
    assert.match(s, new RegExp(`levelFor\\(rider, '${place}'`), `${place} asks levelFor`);
    assert.match(s, new RegExp(`place: '${place}'`), `${place} records with its place`);
    assert.doesNotMatch(s, /askFor\(|chooseFor\(|flockFor\(|pigsFor\(/, `${place}: the old skill-model asking is gone`);
  }
});
