// The skill model (src/math/skill.js): the strands and the maps onto today's ladders, seeding a strand first met, the
// baseline on first meeting, the 80% staircase, answer times, several strands at once, choosing a maker, and reading
// today's riders into the strands. Simulated learners of known ability answer the questions: a learner with ability
// `th` answers a question asked at point d right with chance
//   p(d) = G + (1 - G - SLIP) / (1 + exp((d - th) / W))
// (G: a lucky guess among a few answers; SLIP: a careless slip on easy work; W: how gradually it gets harder).
import test from 'node:test';
import assert from 'node:assert/strict';

const K = await import('../src/math/skill.js');
const { SKILL, MAPS, STRANDS, STRAND, stepAt, pctAt, record, pick, levelOf, isPlaced, isMet, seedOf, ageStart, stats, migrate, setLevel, chooseMap, fits, readAloud, stepFor, skillOf } = K;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const learner = ({ G = 0.25, SLIP = 0.03, W = 4 } = {}) => {
  const p = (d, th) => G + (1 - G - SLIP) / (1 + Math.exp((d - th) / W));
  // the point where this learner gets 4 in 5 right
  const d80 = (th) => { let lo = -60, hi = 160; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (p(m, th) > 0.8) lo = m; else hi = m; } return lo; };
  return { p, d80 };
};
const fresh = (extra = {}) => ({ skill: { v: 1, migrated: 1, strands: {} }, ...extra });
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const T0 = Date.UTC(2026, 9, 18, 15);

// ---- the strands and the maps ----------------------------------------------------------------------------------

test('every strand has a name, a scale and seeds that point at real strands; the registry loaded clean', () => {
  assert.deepEqual(K.PROBLEMS, [], 'src/math/strands.js has a bad entry');
  for (const id of ['number', 'add', 'sub', 'mul', 'div', 'money', 'time', 'frac', 'dec', 'pct', 'ratio', 'long', 'words', 'order', 'pow', 'eq', 'ineq', 'geo']) assert.ok(STRAND[id], id);
  for (const s of STRANDS) {
    assert.ok(s.id && s.name && s.short, s.id);
    assert.ok(s.scale.length >= 3, s.id + ' scale');
    for (let i = 1; i < s.scale.length; i++) assert.ok(s.scale[i][0] > s.scale[i - 1][0], s.id + ' scale climbs');
    for (const [k, f] of Object.entries(s.seed)) { assert.ok(STRAND[k], `${s.id} seeds from ${k}`); assert.ok(f > 0 && f <= 1); }
  }
  for (const m of Object.values(MAPS)) for (const s of m.strands) assert.ok(STRAND[s], m.id);
});

test('the maps have one point for every step of the real ladders', async () => {
  const L = async (f, name = 'LADDER') => (await import(f))[name];
  const same = async (map, f, name) => assert.equal(MAPS[map].anchors.length, (await L(f, name)).length, map);
  await same('counting', '../src/math/counting.js');
  await same('adding', '../src/math/adding.js');
  await same('taking', '../src/math/taking.js');
  await same('negatives', '../src/math/negatives.js');
  await same('times', '../src/math/times.js');
  await same('dividing', '../src/math/dividing.js');
  await same('range', '../src/math/numbersense.js', 'STEPS');
  await same('store', '../src/math/wordproblems.js');
  await same('supplies', '../src/math/supplies.js');
  await same('shares', '../src/math/shares.js');
  const G = await import('../src/math/goods.js');
  assert.deepEqual(MAPS.wool.ids, G.WOOL.forms.map((f) => f.forms[0]));
  assert.deepEqual(MAPS.sales.ids, G.SALE_FORMS.map((f) => f.forms[0]));
  const { RUNG_IDS } = await import('../src/lockbox/generate.js');
  assert.deepEqual([...MAPS.lockbox.ids, ...MAPS.lockboxIneq.ids], RUNG_IDS);
  const W = await import('../labs/windmill/questions.js');
  assert.equal(MAPS.windmill.anchors.length, W.LADDER_TOP);
  // the negatives sit on top of both adding and taking away
  assert.deepEqual(MAPS.negatives.strands, ['add', 'sub']);
  assert.ok(MAPS.negatives.anchors[0] > MAPS.adding.anchors.at(-1) && MAPS.negatives.anchors[0] > MAPS.taking.anchors.at(-1));
});

test('stepAt and pctAt: the step at or below a point, and back again', () => {
  for (const [id, m] of Object.entries(MAPS)) {
    m.anchors.forEach((a, i) => {
      const s = stepAt(id, a);
      assert.equal(s.i, i, `${id} ${a}`);
      assert.equal(s.step, i + (m.base === 0 ? 0 : 1));
      assert.equal(pctAt(id, s.step), a);
      if (m.ids) { assert.equal(s.id, m.ids[i]); assert.equal(pctAt(id, m.ids[i]), a); }
    });
  }
  assert.deepEqual(stepAt('times', 35), { i: 12, step: 13, frac: 0.5, id: null, below: false });   // (34 and 36 either side)
  assert.equal(stepAt('lockbox', 52).id, 'R5');
  assert.equal(stepAt('lockbox', 5).id, 'R0a');
  assert.equal(stepAt('lockbox', 5).below, true);
  assert.equal(stepAt('range', 3).step, 0);
  assert.equal(pctAt('lockbox', 'R6', 1 / 3), 58);
  assert.equal(pctAt('lockbox', 'nope'), null);
  // the top step's frac grows over the margin past it
  assert.equal(stepAt('times', 54 + SKILL.TOP_MARGIN).frac, 1);
});

test('a strand can rise only a little past the hardest material the game has for it', () => {
  assert.equal(K.maxOf('mul'), 54 + SKILL.TOP_MARGIN);
  assert.equal(K.maxOf('eq'), 100);
  assert.equal(K.maxOf('geo'), 94 + SKILL.TOP_MARGIN);   // (the engineer's questions at the ravine: the bridge's panel diagonal, above the miller's top step)
  const r = fresh();
  setLevel(r, 'mul', 95);
  assert.equal(levelOf(r, 'mul'), K.maxOf('mul'));
});

// ---- seeding and the age ----------------------------------------------------------------------------------------

test('seeding: a strand first met starts from its related strands, with the discount', () => {
  const r = fresh();
  assert.equal(seedOf(r, 'sub'), 0, 'nothing known, no age: 0');
  setLevel(r, 'add', 25);
  assert.equal(seedOf(r, 'sub'), 22.5, 'subtraction starts at 0.9 x addition');
  assert.equal(pick(r, 'sub'), 22.5, 'the baseline starts there');
  assert.equal(isPlaced(r, 'sub'), false);
  // ...but never past a gap in its material: Addition at 60 (positive & negative) starts Subtraction at the top of the
  // two-digit take-aways (30), not at 54, where nothing would ask it
  setLevel(r, 'add', 60);
  assert.equal(K.runTop('sub'), 30);
  assert.equal(levelOf(r, 'sub'), 22.5, '(sub is met now: its own level stands)');
  const g = fresh(); setLevel(g, 'add', 60);
  assert.equal(seedOf(g, 'sub'), 30, 'a seed stops at the gap');
  setLevel(r, 'mul', 40);
  // equations: the average of the related strands met, each with its discount (add 60, sub 22.5, mul 40)
  assert.equal(seedOf(r, 'eq'), Math.round(((60 + 22.5 + 40) * 0.75 / 3) * 10) / 10);
  assert.equal(seedOf(r, 'div'), 36, 'division from multiplication');
  assert.equal(levelOf(r, 'div'), 36, 'levelOf a strand not met yet: where it would start');
  assert.equal(isMet(r, 'div'), false, '... and asking about it does not meet it');
});

test('the optional age gives only a modest head start, and only when nothing related is known', () => {
  assert.equal(ageStart(null), 0);
  assert.equal(ageStart(undefined), 0);
  assert.equal(ageStart(5), 0);
  assert.equal(ageStart(8), 10);
  assert.equal(ageStart(10), 17);
  assert.equal(ageStart(15), 33, 'a 15-year-old starts with third-grade work, well under their grade');
  assert.equal(ageStart(40), 33);
  const r = fresh({ age: 15 });
  assert.equal(seedOf(r, 'mul'), 33);
  assert.equal(seedOf(r, 'add'), 30, '(Addition: no further than the top of the two-digit sums, the gap rule)');
  setLevel(r, 'add', 12);   // a 15-year-old who turns out to need easy adding
  assert.equal(seedOf(r, 'sub'), 10.8, 'what the rider has shown beats the age');
});

// ---- the baseline -----------------------------------------------------------------------------------------------

// Plays a strand's baseline with a learner: -> { path: ['+40', '-50', ...], level }
function runBaseline(rider, strand, answer) {
  const path = [];
  while (!isPlaced(rider, strand) && path.length < 60) {
    const at = pick(rider, strand);
    const ok = answer(at);
    record(rider, strand, { right: ok, at, now: T0 });
    path.push((ok ? '+' : '-') + at);
  }
  return { path, level: levelOf(rider, strand) };
}

test('the baseline climbs in big steps, asks the top right again, halves the gap, then settles below it', () => {
  const r = fresh();
  const { path, level } = runBaseline(r, 'eq', (at) => at < 44);   // can do everything below 44
  assert.deepEqual(path, ['+0', '+10', '+20', '+30', '+40', '-50', '+40', '-45', '+42.5']);
  assert.equal(level, 42.5 - SKILL.SETTLE_BELOW);
  assert.equal(isPlaced(r, 'eq'), true);
});

test('a fluke miss: every check right, and the climb goes on', () => {
  const r = fresh();
  let slipped = false;
  const { path, level } = runBaseline(r, 'eq', (at) => { if (at === 30 && !slipped) { slipped = true; return false; } return at < 64; });
  assert.deepEqual(path.slice(0, 7), ['+0', '+10', '+20', '-30', '+20', '+25', '+27.5']);
  assert.equal(path[7], '+30', 'the missed point asked again');
  assert.ok(level >= 55 && level <= 60, `settled ${level} (can do below 64)`);
});

test('a slip on the first easy question is asked again; a lucky right on the way down must be right twice', () => {
  let r = fresh(), first = true;
  let res = runBaseline(r, 'add', (at) => { if (first) { first = false; return false; } return at < 34; });
  assert.deepEqual(res.path.slice(0, 2), ['-0', '+0']);
  assert.ok(res.level > 20, `not stuck at 0 by one slip (${res.level})`);
  r = fresh(); setLevel(r, 'add', 60, { placed: false });
  // can do below 15, and guesses right once at 40
  let lucky = true;
  res = runBaseline(r, 'add', (at) => { if (at === 40 && lucky) { lucky = false; return true; } return at < 15; });
  assert.deepEqual(res.path.slice(0, 4), ['-60', '-50', '+40', '-40'], 'the lucky right at 40 was asked again');
  assert.ok(res.level <= 12, `settled ${res.level}, not up near 40`);
  // missing everything settles at 0 (after the bottom was asked twice)
  r = fresh(); setLevel(r, 'add', 25, { placed: false });
  res = runBaseline(r, 'add', () => false);
  assert.equal(res.level, 0);
  assert.deepEqual(res.path.slice(-2), ['-0', '-0']);
});

test('near 0 a miss that close to a confirmed right needs no checks: a young rider is not held on the first box', () => {
  // a 6-year-old (age seed 3) misses the very first kindergarten box, then gets every one right: the two rights at 0,
  // then straight back to the missed point (no checks in a 3-point gap), and the climb goes on
  let r = fresh({ age: 6 }), first = true;
  let res = runBaseline(r, 'eq', () => { if (first) { first = false; return false; } return true; });
  assert.deepEqual(res.path.slice(0, 5), ['-3', '+0', '+0', '+3', '+13'], res.path.join(' '));
  // the same rider missing the missed point again (and again: FLUKES): placed at 0, with no checks between
  r = fresh({ age: 6 });
  res = runBaseline(r, 'eq', (at) => at < 2);
  assert.deepEqual(res.path, ['-3', '+0', '+0', ...Array(SKILL.FLUKES).fill('-3')], res.path.join(' '));
  assert.equal(res.level, 0);
  assert.ok(SKILL.GAP_MIN > 0 && SKILL.GAP_MIN <= SKILL.JUMP / 2, 'only gaps near 0 skip the checks');
});

test('a miss far above the question being tried never moves the next question up', () => {
  // a young rider's division (seed 3) asked only well above it (a job whose easiest question is at 22)
  const r = fresh({ age: 6 });
  const p0 = pick(r, 'div');
  for (let k = 0; k < 4; k++) { record(r, 'div', { right: false, at: 22 }); assert.ok(pick(r, 'div') <= p0, `next question ${pick(r, 'div')} rose above ${p0}`); }
  // and a miss at the question tried still steps down as before
  const r2 = fresh(); setLevel(r2, 'div', 40, { placed: false });
  record(r2, 'div', { right: false, at: 40 });
  assert.equal(pick(r2, 'div'), 30);
});

test('right at the very top: asked once more there, then the baseline ends there', () => {
  const r = fresh();
  setLevel(r, 'mul', 40, { placed: false });
  const res = runBaseline(r, 'mul', () => true);
  assert.deepEqual(res.path, ['+40', '+50', '+60', '+60']);
  assert.equal(res.level, K.maxOf('mul'));
  // one right answer recorded at (or above) the top, while the point being tried is far below, never places it there:
  // the top is asked as a real question first (a lock box part credited high, or a lucky guess)
  const t = fresh({ age: 13 });
  const p0 = pick(t, 'mul');
  const res2 = record(t, [{ strand: 'mul', at: 62 }], { right: true }).mul;
  assert.equal(res2.placed, false, 'not placed by one answer at the top');
  assert.equal(pick(t, 'mul'), K.maxOf('mul'), 'the top is asked next');
  record(t, 'mul', { right: false, at: K.maxOf('mul') });
  assert.equal(isPlaced(t, 'mul'), false, 'missed when really asked: the baseline goes on');
  assert.ok(pick(t, 'mul') < K.maxOf('mul') && pick(t, 'mul') >= p0, `checks below the top (${pick(t, 'mul')})`);
});

test('a strand finding its level: answers far below the point being tried change nothing (a lock box part, an extra credit)', () => {
  // a 15-year-old right at 33 and 43 in subtraction, then a lock box part "9 − 6" missed, recorded at its own point
  const r = fresh({ age: 15 });
  record(r, 'sub', { right: true, at: pick(r, 'sub') });
  record(r, 'sub', { right: true, at: pick(r, 'sub') });
  const p = pick(r, 'sub'), lv = levelOf(r, 'sub');
  assert.deepEqual([p, lv], [50, 35], '(Subtraction starts at 30 for a teen: the top of the two-digit take-aways)');
  record(r, 'sub', { right: false, at: 9, sitDown: true, ms: 2000 });
  assert.deepEqual([pick(r, 'sub'), levelOf(r, 'sub')], [p, lv], 'a slip far under the highest right is not a reason to throw it away');
  assert.ok(seedOf(r, 'add') >= 30 && seedOf(r, 'words') >= 33, 'nor do the strands seeded from it drop');
  record(r, 'sub', { right: true, at: 12 });
  assert.equal(pick(r, 'sub'), p, 'a right far below says nothing new');
  // the very first answer far below the seed: a right changes nothing (the level is not shown 5 under that point)
  const t = fresh({ age: 15 });
  pick(t, 'sub');
  record(t, 'sub', { right: true, at: 9 });
  assert.deepEqual([levelOf(t, 'sub'), pick(t, 'sub')], [30, 30]);
  record(t, 'sub', { right: false, at: 9 });
  assert.deepEqual([levelOf(t, 'sub'), pick(t, 'sub')], [30, 30], '... and a miss there leaves the questions at the point being tried to tell');
  // a first right AT the seed doesn't show a level under the seed while the climb goes on
  const u = fresh({ age: 15 });
  record(u, 'sub', { right: true, at: pick(u, 'sub') });
  assert.equal(levelOf(u, 'sub'), 30);
  // a weaker kid still comes down: misses at the point being tried
  const w = fresh({ age: 15 });
  const res = runBaseline(w, 'sub', (at) => at < 8);
  assert.ok(res.level <= 5, `a teen who needs early work lands low (${res.level}; ${res.path.join(' ')})`);
});

test('an extra credit at part weight never moves a level still being found, either way', () => {
  const r = fresh({ age: 10 });
  for (let k = 0; k < 3; k++) record(r, 'mul', { right: true, at: pick(r, 'mul') });
  const p = pick(r, 'mul'), lv = levelOf(r, 'mul');
  record(r, [{ strand: 'words', at: 40 }, { strand: 'mul', at: p - 4, weight: 0.5 }], { right: false });
  assert.deepEqual([pick(r, 'mul'), levelOf(r, 'mul')], [p, lv], 'a missed word problem leaves its times part out of the baseline');
  record(r, [{ strand: 'words', at: 40 }, { strand: 'mul', at: p, weight: 0.5 }], { right: true });
  assert.deepEqual([pick(r, 'mul'), levelOf(r, 'mul')], [p, lv], '...and a right one doesn\'t climb it (it couldn\'t have stopped it)');
  assert.equal(skillOf(r).strands.mul.n, 5, 'both are counted as practice');
  record(r, 'mul', { right: true, at: p });
  assert.equal(pick(r, 'mul'), p + SKILL.JUMP, 'a whole answer at the point being tried climbs');
});

test('nothing is recorded above a maker\'s hardest question; right twice there, the baseline settles at it', () => {
  // the round-up's counting maker tops at 24 (its steps don't grow within a step): a kindergartner who counts everything
  const r = fresh({ age: 5 });
  const path = [];
  for (let k = 0; k < 8 && !isPlaced(r, 'number'); k++) {
    const q = stepFor(r, 'counting');
    assert.ok(q.at <= K.capOf('counting'), `asked at ${q.at}`);
    record(r, 'number', { right: true, at: q.at });
    path.push(q.at);
  }
  assert.deepEqual(path, [0, 10, 20, 24, 24], path.join(' '));
  assert.deepEqual([isPlaced(r, 'number'), levelOf(r, 'number')], [true, 24], 'no limit was found: the material ran out');
  // once placed, rights at the top step can't lift the level more than a step past it
  for (let k = 0; k < 30; k++) record(r, 'number', { right: true, at: stepFor(r, 'counting').at });
  assert.ok(levelOf(r, 'number') <= K.capOf('counting') + SKILL.UP, `Numbers ${levelOf(r, 'number')}`);
  assert.equal(readAloud(r), true, 'and a counting kindergartner keeps read-aloud');
  // a maker that grows its numbers within a step (the lock box) is asked up to TOP_MARGIN past its top step
  assert.equal(K.capOf('lockbox'), 100);
  assert.equal(K.capOf('lockboxK'), 7 + SKILL.TOP_MARGIN);
  assert.equal(K.capOf('adding'), 30);
  // a job that holds its questions lower (most): the same rule at that point
  const y = fresh({ age: 7 }); setLevel(y, 'eq', 40, { placed: false });
  const q = stepFor(y, 'lockbox', { most: 24 });
  assert.deepEqual([q.at, q.id, q.capped], [24, 'R1', true]);
});

test('time: a very quick tap is left out like a very slow answer', () => {
  const r = fresh();
  setLevel(r, 'eq', 50);
  for (let k = 0; k < 6; k++) record(r, 'eq', { right: true, sitDown: true, ms: 10000 });
  const res = record(r, 'eq', { right: true, sitDown: true, ms: 2000 }).eq;
  assert.deepEqual([res.fast, res.timed, res.outlier, res.moved], [false, false, true, SKILL.UP], 'under QUICK x the median: counted, not timed');
  assert.equal(record(r, 'eq', { right: true, sitDown: true, ms: 5000 }).eq.fast, true, 'a quick, plausible answer is still fast');
});

test('time: only the answer\'s own strand is timed (a word problem\'s time is not a times-table time)', () => {
  const r = fresh();
  setLevel(r, 'words', 40); setLevel(r, 'mul', 40);
  for (let k = 0; k < 6; k++) record(r, [{ strand: 'words', at: 40 }, { strand: 'mul', at: 30, weight: 0.5 }], { right: true, sitDown: true, ms: 16000 + k * 500 });
  assert.equal(skillOf(r).strands.mul.t.length, 0);
  assert.equal(skillOf(r).strands.words.t.length, 6);
  const res = record(r, 'mul', { right: true, sitDown: true, ms: 5000 }).mul;
  assert.equal(res.fast, false, 'an ordinary 5 s times part is not fast against 16 s word problems');
});

test('a placed strand isn\'t pushed under its maker\'s gate by misses on its first step while most of them are right', () => {
  const r = fresh();
  setLevel(r, 'order', 42);
  const first = MAPS.order.anchors[0], gate = first - SKILL.GATE;
  for (let k = 0; k < 6; k++) record(r, 'order', { right: true, at: first });
  for (let k = 0; k < 3; k++) record(r, 'order', { right: false, at: first });
  assert.equal(levelOf(r, 'order'), gate, 'held at the gate: the order boxes stay on offer');
  assert.ok(fits(r, 'order'));
  // a kid who misses most of the first step goes under it (and stops being asked)
  const w = fresh(); setLevel(w, 'order', 42);
  for (let k = 0; k < 6; k++) record(w, 'order', { right: k === 0, at: first });
  assert.ok(levelOf(w, 'order') < gate, `${levelOf(w, 'order')}`);
  assert.equal(K.floorOf('eq'), 0, 'a strand whose material starts at the bottom has no gate to hold');
});

test('seeding: a related strand still finding counts at no less than the age; a seed never starts above the middle of its material', () => {
  const r = fresh({ age: 15 });
  setLevel(r, 'mul', 4, { placed: false });
  assert.equal(seedOf(r, 'div'), 33, 'an unplaced guess low for a moment: the age stands in');
  setLevel(r, 'mul', 4);
  assert.equal(seedOf(r, 'div'), 3.6, 'what the rider has shown (placed) beats the age');
  // Time from a teen strong at negatives: no higher than the middle of the clock questions (not their hardest first)
  const t = fresh(); setLevel(t, 'add', 66); setLevel(t, 'sub', 63); setLevel(t, 'number', 74);
  assert.ok(seedOf(t, 'time') <= 30 && seedOf(t, 'money') <= 40, `time ${seedOf(t, 'time')}, money ${seedOf(t, 'money')}`);
  // the arithmetic from equations when nothing closer is known (a rider who has only done lock boxes)
  const e = fresh(); setLevel(e, 'eq', 50);
  assert.deepEqual([seedOf(e, 'add'), seedOf(e, 'number'), seedOf(e, 'mul')], [30, 35, MAPS.times.anchors[11]], '(0.8 x 50 = 40 for adding: no further than the gap at 30; 0.7 x 50 = 35 for times: no higher than the middle of the times tables)');
  setLevel(e, 'sub', 20);
  assert.equal(seedOf(e, 'add'), 19, 'a closer strand met: equations no longer used');
});

test('a strand not placed yet is judged at no less than the age\'s head start: no counting cards for a teen', () => {
  const t = fresh({ age: 15 }); setLevel(t, 'add', 30); setLevel(t, 'sub', 30);
  assert.ok(seedOf(t, 'number') <= K.capOf('counting') + SKILL.TOP_MARGIN, 'its seed alone would fit counting');
  assert.equal(fits(t, 'counting', ['counting', 'adding']), false, 'but the age says past it');
  setLevel(t, 'number', 12);
  assert.equal(fits(t, 'counting', ['counting', 'adding']), true, 'placed low by the rider\'s own answers: counting it is');
  const k = fresh({ age: 6 }); setLevel(k, 'add', 30);
  assert.equal(fits(k, 'counting', ['counting', 'adding']), true, 'a 6-year-old: no difference');
  // and read-aloud: a teen whose placed levels sit under 30 isn't read to
  assert.equal(readAloud(t), false);
});

test('positive & negative opens once Addition or Subtraction is placed at the top of two-digit sums', () => {
  const herd = ['adding', 'taking', 'negatives'];
  const r = fresh(); setLevel(r, 'add', 29); setLevel(r, 'sub', 26);
  assert.equal(fits(r, 'negatives', herd), false);
  setLevel(r, 'add', MAPS.negatives.opens);
  assert.equal(fits(r, 'negatives', herd), true);
  assert.equal(fits(r, 'adding', herd), true, 'two-digit sums stay on offer too');
  setLevel(r, 'add', 40, { placed: false });
  assert.equal(fits(r, 'negatives', herd), false, 'a level still being found does not open it');
});

test('a batch of answers to one question point climbs once (the round-up deals a wave from one pick)', () => {
  const r = fresh();
  const at = pick(r, 'mul');
  for (let k = 0; k < 4; k++) record(r, 'mul', { right: true, at });
  assert.equal(pick(r, 'mul'), at + SKILL.JUMP);
});

test('the baseline lands simulated learners near their own 80% point, from several starting points (3 seed sets)', () => {
  const L = learner();
  for (const set of [1, 2, 3]) {
    for (const th of [12, 30, 48, 66, 84]) for (const seed of [0, 30, 60]) {
      if (seed > th + 25) continue;   // (a start far above the learner is checked on its own below)
      const R = rng(set * 7919 + th * 31 + seed);
      const errs = [], lens = [];
      let above = 0;
      for (let k = 0; k < 80; k++) {
        const r = fresh();
        setLevel(r, 'eq', seed, { placed: false });
        const res = runBaseline(r, 'eq', (at) => R() < L.p(at, th));
        assert.ok(isPlaced(r, 'eq'), 'a baseline always ends');
        lens.push(res.path.length);
        const e = res.level - L.d80(th);
        errs.push(e); if (e > 8) above++;
      }
      const tag = `set ${set}, ability ${th}, start ${seed}`;
      assert.ok(mean(errs) > -5 && mean(errs) < 6, `${tag}: lands ${mean(errs).toFixed(1)} from the 80% point on average`);
      assert.ok(above <= 0.3 * errs.length, `${tag}: ${above} of ${errs.length} land more than 8 above`);
      assert.ok(mean(lens) <= 18 && Math.max(...lens) <= SKILL.BASE_MOST, `${tag}: ${mean(lens).toFixed(1)} questions (most ${Math.max(...lens)})`);
    }
  }
  // a start 30 to 50 points too high (a teen who turns out to need early work): it comes down, if less exactly
  for (const set of [1, 2, 3]) {
    const R = rng(set * 104729), errs = [];
    for (let k = 0; k < 80; k++) { const r = fresh(); setLevel(r, 'eq', 60, { placed: false }); errs.push(runBaseline(r, 'eq', (at) => R() < L.p(at, 12)).level - L.d80(12)); }
    assert.ok(mean(errs) < 15, `set ${set}: from 50 too high, lands ${mean(errs).toFixed(1)} above on average`);
  }
});

// ---- the staircase ----------------------------------------------------------------------------------------------

test('after the baseline, simulated learners settle at 75-85% right, at several abilities (3 seed sets)', () => {
  for (const model of [{}, { G: 0.2, W: 6 }, { G: 0.33, W: 3 }]) {
    const L = learner(model);
    for (const set of [1, 2, 3]) for (const th of [10, 30, 50, 70, 90]) {
      const R = rng(set * 3571 + th);
      let right = 0, n = 0;
      for (let k = 0; k < 20; k++) {
        const r = fresh();
        runBaseline(r, 'eq', (at) => R() < L.p(at, th));
        for (let i = 0; i < 500; i++) {
          const at = pick(r, 'eq'), ok = R() < L.p(at, th);
          record(r, 'eq', { right: ok, at, now: T0 });
          if (i >= 100) { n++; right += ok; }
        }
      }
      const pct = (100 * right) / n;
      assert.ok(pct >= 75 && pct <= 85, `${JSON.stringify(model)} set ${set} ability ${th}: ${pct.toFixed(1)}% right`);
    }
  }
});

test('small steps: once placed, one answer moves the level up at most FAST_UP and down at most DOWN', () => {
  const L = learner(), R = rng(5);
  const r = fresh();
  setLevel(r, 'add', 40);
  for (let i = 0; i < 400; i++) {
    const at = pick(r, 'add');
    const res = record(r, 'add', { right: R() < L.p(at, 45), at, sitDown: true, ms: 4000 + R() * 8000, now: T0 }).add;
    assert.ok(res.moved <= SKILL.FAST_UP && res.moved >= -SKILL.DOWN, `moved ${res.moved}`);
  }
});

test('only answers near the level move it: warm-up rights do not push it up, stretch misses do not pull it down', () => {
  const r = fresh();
  setLevel(r, 'mul', 40);
  assert.equal(record(r, 'mul', { right: true, at: 20 }).mul.moved, 0, 'a right warm-up from far below');
  assert.equal(record(r, 'mul', { right: false, at: 55 }).mul.moved, 0, 'a miss on a stretch from far above');
  assert.equal(record(r, 'mul', { right: false, at: 34 }).mul.moved, -SKILL.DOWN, 'a miss on work near the level counts in full');
  setLevel(r, 'mul', 40);
  assert.equal(record(r, 'mul', { right: false, at: 28 }).mul.moved, -SKILL.DOWN / 2, 'a miss from NEAR below counts half');
  setLevel(r, 'mul', 40);
  assert.equal(record(r, 'mul', { right: false, at: 20 }).mul.moved, -SKILL.DOWN / 4, '... from twice NEAR below a quarter: mostly a slip');
  setLevel(r, 'mul', 40);
  assert.equal(record(r, 'mul', { right: true, at: 55 }).mul.moved, SKILL.UP, 'a right stretch still counts');
  assert.equal(record(r, 'mul', { right: true }).mul.moved, SKILL.UP, 'no at: asked at the level');
});

test('one answer can count in several strands, a smaller weight moving the staircase less both ways', () => {
  const r = fresh();
  setLevel(r, 'words', 40); setLevel(r, 'mul', 40); setLevel(r, 'div', 30);
  let res = record(r, [{ strand: 'words', at: 40 }, { strand: 'mul', at: 40, weight: 0.5 }, 'div'], { right: false, at: 30 });
  assert.deepEqual([res.words.moved, res.mul.moved, res.div.moved], [-4, -2, -4]);
  res = record(r, ['words', 'nope'], { right: true });
  assert.deepEqual(Object.keys(res), ['words'], 'an unknown strand is left out');
  // an extra credit at part weight doesn't drive a strand's baseline; a whole answer does
  const b = fresh();
  record(b, [{ strand: 'frac', weight: 0.25 }], { right: true, at: 30 });
  assert.equal(pick(b, 'frac'), 0, 'met, but its baseline has not moved');
  record(b, [{ strand: 'frac', weight: 0.5 }], { right: true, at: 0 });
  assert.equal(pick(b, 'frac'), 0, 'nor at half weight');
  record(b, [{ strand: 'frac' }], { right: true, at: 0 });
  assert.equal(pick(b, 'frac'), SKILL.JUMP);
});

// ---- time ---------------------------------------------------------------------------------------------------------

test('time: a fast right sit-down answer counts double, once the strand has a few timed answers', () => {
  const r = fresh();
  setLevel(r, 'eq', 50);
  for (let k = 0; k < SKILL.TIMED_MIN; k++) {
    const res = record(r, 'eq', { right: true, sitDown: true, ms: k === 0 ? 1000 : 10000 }).eq;
    assert.equal(res.fast, false, 'no median yet: nothing is fast');
    assert.equal(res.moved, SKILL.UP);
  }
  let res = record(r, 'eq', { right: true, sitDown: true, ms: 4000 }).eq;
  assert.equal(res.fast, true); assert.equal(res.moved, SKILL.FAST_UP);
  res = record(r, 'eq', { right: true, sitDown: true, ms: 9000 }).eq;
  assert.equal(res.fast, false); assert.equal(res.moved, SKILL.UP);
  res = record(r, 'eq', { right: false, sitDown: true, ms: 2000 }).eq;
  assert.equal(res.fast, false, 'a fast wrong answer is just wrong'); assert.equal(res.moved, -SKILL.DOWN);
  // travel jobs: never timed, never fast
  res = record(r, 'eq', { right: true, ms: 1000 }).eq;
  assert.equal(res.timed, false); assert.equal(res.fast, false);
  assert.equal(stats(r).find((s) => s.strand === 'eq').fast, 1);
});

test('time: a hidden tab, an idle spell or a very slow answer is left out; the size of the question counts', () => {
  const r = fresh();
  setLevel(r, 'words', 50);
  for (let k = 0; k < 6; k++) record(r, 'words', { right: true, sitDown: true, ms: 10000 });
  const t = () => skillOf(r).strands.words.t.length;
  const n0 = t();
  let res = record(r, 'words', { right: true, sitDown: true, ms: 2000, hidden: true }).words;
  assert.deepEqual([res.timed, res.outlier, res.fast, res.moved], [false, true, false, SKILL.UP], 'hidden: the answer counts, its time does not');
  res = record(r, 'words', { right: true, sitDown: true, ms: 2000, idle: true }).words;
  assert.deepEqual([res.timed, res.outlier, res.fast], [false, true, false], 'idle');
  res = record(r, 'words', { right: true, sitDown: true, ms: 31000 }).words;
  assert.deepEqual([res.timed, res.outlier], [false, true], 'over 3 times the median');
  assert.equal(t(), n0, 'none of them went into the median');
  res = record(r, 'words', { right: true, sitDown: true, ms: 29000, size: 3 }).words;
  assert.deepEqual([res.timed, res.fast, res.outlier], [true, false, false], 'a three-part question at 3 times as long is ordinary');
  res = record(r, 'words', { right: true, sitDown: true, ms: 15000, size: 3 }).words;
  assert.equal(res.fast, true, '... and at half that it is fast');
});

test('time: simulated sit-down learners who are faster on easier questions still settle at 75-85% right (3 seed sets)', () => {
  const L = learner();
  for (const set of [1, 2, 3]) for (const th of [20, 50, 80]) {
    const R = rng(set * 911 + th);
    const z = () => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());
    let right = 0, n = 0, fast = 0, timed = 0;
    for (let k = 0; k < 20; k++) {
      const r = fresh(), base = 6000 + 6000 * R();
      runBaseline(r, 'words', (at) => R() < L.p(at, th));
      for (let i = 0; i < 400; i++) {
        const at = pick(r, 'words'), p = L.p(at, th), ok = R() < p;
        // the harder it is for this learner, the longer it takes; now and then a long look away (left out by SLOW)
        const ms = R() < 0.03 ? base * 8 : base * (0.6 + 1.2 * (1 - p)) * Math.exp(0.45 * z());
        const res = record(r, 'words', { right: ok, at, sitDown: true, ms, now: T0 }).words;
        if (i >= 100) { n++; right += ok; fast += res.fast; timed += res.timed; }
      }
    }
    const pct = (100 * right) / n;
    assert.ok(pct >= 75 && pct <= 85, `set ${set} ability ${th}: ${pct.toFixed(1)}% right (${((100 * fast) / n).toFixed(0)}% fast)`);
    assert.ok(timed > 0.9 * n, 'nearly every answer was timed');
  }
});

// ---- the stats page -----------------------------------------------------------------------------------------------

test('stats: one row per strand met, whole percents, a day-by-day history and the average time', () => {
  const r = fresh();
  assert.deepEqual(stats(r), []);
  setLevel(r, 'add', 41.6);
  const day = 86400000;
  record(r, 'add', { right: true, now: T0 });
  record(r, 'add', { right: true, now: T0 + 1000 });
  record(r, 'add', { right: false, now: T0 + day });
  record(r, 'mul', { right: true, sitDown: true, ms: 8000, now: T0 + day });
  record(r, 'mul', { right: true, sitDown: true, ms: 6000, now: T0 + day });
  const s = stats(r);
  assert.deepEqual(s.map((x) => x.strand), ['add', 'mul'], 'in the strands order');
  const add = s[0];
  assert.equal(add.name, 'Addition');
  assert.equal(add.pct, 40);
  assert.equal(add.answered, 3); assert.equal(add.right, 2); assert.equal(add.recentPct, 67);
  assert.deepEqual(add.history.map((h) => h.pct), [44, 40], 'one point a day');
  assert.equal(add.avgMs, null, 'no timed answers');
  assert.equal(s[1].avgMs, 7000);
  assert.equal(s[1].finding, true, 'multiplication is still finding its level');
  assert.equal(stats(r, { all: true }).length, STRANDS.length);
  assert.ok(STRANDS.length >= 18);
  assert.equal(stats(r, { all: true }).find((x) => x.strand === 'geo').pct, null);
  assert.equal(K.meaning('add', 31), 'two-digit sums to 100');
});

// ---- choosing what a job asks ---------------------------------------------------------------------------------------

test('chooseMap and fits: each rider gets makers with material near their level', () => {
  const herd = ['times', 'dividing', 'counting', 'adding', 'taking', 'negatives'];
  const kid = fresh();
  assert.deepEqual(herd.filter((m) => fits(kid, m, herd)), ['counting', 'adding', 'taking'], 'a kindergartner: no times tables yet');
  const teen = fresh({ age: 15 });
  setLevel(teen, 'add', 64); setLevel(teen, 'sub', 64); setLevel(teen, 'mul', 45);
  assert.deepEqual(herd.filter((m) => fits(teen, m, herd)), ['times', 'dividing', 'negatives'], 'a teen: no counting dots or small sums');
  // (Subtraction's own positive & negative cards start at 68: under 62 the two-digit take-aways still serve it)
  const t60 = fresh({ age: 15 }); setLevel(t60, 'add', 64); setLevel(t60, 'sub', 60); setLevel(t60, 'mul', 45);
  assert.deepEqual(herd.filter((m) => fits(t60, m, herd)), ['times', 'dividing', 'taking', 'negatives']);
  const mid = fresh();
  setLevel(mid, 'add', 45); setLevel(mid, 'sub', 45);
  assert.ok(fits(mid, 'adding', herd), 'between two makers (nothing built from 36 to 54): the one below still serves');
  assert.ok(!fits(mid, 'adding', ['adding']), '... but not when there is no maker above to wait for');
  const R = rng(9), seen = new Set();
  for (let k = 0; k < 200; k++) seen.add(chooseMap(teen, herd, { rand: R, now: T0 }));
  assert.deepEqual([...seen].sort(), ['dividing', 'negatives', 'times']);
  assert.equal(chooseMap(kid, ['times', 'negatives']), null);
  // a strand still finding its level is asked more (so its baseline finishes)
  const both = fresh(); setLevel(both, 'mul', 30); setLevel(both, 'div', 30, { placed: false });
  let div = 0;
  for (let k = 0; k < 400; k++) div += chooseMap(both, ['times', 'dividing'], { rand: R, now: T0 }) === 'dividing';
  assert.ok(div > 260, `dividing chosen ${div} of 400`);
});

test('stepFor: a maker on two strands uses the average of the two', () => {
  const r = fresh();
  setLevel(r, 'add', 72); setLevel(r, 'sub', 64);
  const q = stepFor(r, 'negatives');
  assert.deepEqual([q.at, q.step, q.strand], [68, 3, 'add']);
  assert.deepEqual(q.strands, ['add', 'sub']);
  assert.equal(stepFor(fresh(), 'lockbox').id, 'R0a');
});

test('readAloud: on while every strand is low, off for older work or when switched off', () => {
  assert.equal(readAloud(fresh()), true);
  assert.equal(readAloud(fresh({ age: 15 })), false, 'a teen with nothing played yet');
  const r = fresh(); setLevel(r, 'add', 22);
  assert.equal(readAloud(r), true);
  setLevel(r, 'mul', 35);
  assert.equal(readAloud(r), false);
  assert.equal(readAloud({ ...fresh(), readAloud: false }), false);
  // only PLACED strands count (a level still being found can climb fast for a moment)
  const f = fresh(); setLevel(f, 'number', 40, { placed: false });
  assert.equal(readAloud(f), true);
  // a rider whose age is set at READ_AGE or under: on whatever the levels; the grown-ups can still switch it off
  const y = fresh({ age: SKILL.READ_AGE }); setLevel(y, 'number', 40);
  assert.equal(readAloud(y), true);
  assert.equal(readAloud({ ...y, readAloud: false }), false);
  // 'on' keeps it on for anyone
  assert.equal(readAloud({ ...fresh({ age: 15 }), readAloud: 'on' }), true);
});

test('skillOf repairs a damaged skill object and keeps strands it does not know', () => {
  const r = { skill: { strands: { add: { level: 'x', placed: 'yes', h: [[1, 30], 'junk'], t: [[0, 1], [5000, 2]], days: 'no', base: { phase: 'odd' } },
    mul: { level: 250, placed: true }, frogs: { level: 3 }, div: 'junk' } } };
  const sk = skillOf(r);
  assert.equal(sk.strands.add.level, 0);
  assert.equal(sk.strands.add.placed, false);
  assert.equal(sk.strands.add.base.phase, 'climb');
  assert.deepEqual(sk.strands.add.h, [[1, 30, 0]]);
  assert.deepEqual(sk.strands.add.t, [[5000, 2]]);
  assert.deepEqual(sk.strands.add.days, []);
  assert.equal(sk.strands.mul.level, K.maxOf('mul'));
  assert.deepEqual(sk.strands.frogs, { level: 3 }, 'a newer build\'s strand is kept as it is');
  assert.equal(sk.strands.div, undefined);
  assert.equal(levelOf({}, 'add'), 0);
  assert.equal(levelOf(null, 'add'), 0);
});

// ---- reading today's riders into the strands ------------------------------------------------------------------------

test('migration: riders made with the old trainers keep their progress (real trainers, real state)', async () => {
  const { makeTimes } = await import('../src/math/times.js');
  const { makeAdding } = await import('../src/math/adding.js');
  const { makeNegatives } = await import('../src/math/negatives.js');
  const { makeAlgebra } = await import('../src/lockbox/algebra.js');
  const { makeNumberSense } = await import('../src/math/numbersense.js');
  const { makeWordProblems, seeded } = await import('../src/math/wordproblems.js');
  const { makeShares } = await import('../src/math/shares.js');
  const play = (T, n, right = () => true) => {   // a card trainer: n cards answered
    for (let k = 0; k < n; k++) { T.wave({}); const c = T.card(); if (!c) continue; const g = c.targets.find((x) => x.good === right(k)) || c.targets[0]; T.answer(g.n, g.good, c.id); }
  };

  // 1. a times-tables rider, placed on step 12, who has also played adding and positive & negative a while
  const t1 = {}; const T = makeTimes(t1, { rand: seeded(1) }); T.setStep(12); const w = T.wave({}); T.answer(w.targets.find((x) => x.good).n, true);
  const a1 = {}; const A = makeAdding(a1, { rand: seeded(2) }); A.setStep(8); play(A, 3);
  const n1 = {}; const N = makeNegatives(n1, { rand: seeded(3) }); N.setStep(4); play(N, 2);
  const r1 = { name: 'Older', topics: { times: t1, adding: a1, negatives: n1, algebra: {} } };
  const before = JSON.stringify(r1.topics);
  const sk = migrate(r1, { now: T0 }).strands;
  assert.equal(JSON.stringify(r1.topics), before, 'the old topics are left exactly as they were');
  assert.deepEqual([sk.mul.level, sk.mul.placed], [pctAt('times', t1.step), true]);
  assert.deepEqual([sk.add.level, sk.add.placed], [pctAt('negatives', n1.step), true], 'adding: the higher of adding and positive & negative');
  assert.deepEqual([sk.sub.level, sk.sub.placed], [pctAt('negatives', n1.step), true], 'taking away: from positive & negative');
  assert.equal(sk.eq, undefined, 'solving for x never played: not met');
  assert.equal(sk.mul.old, true);

  // 2. a young rider part-way up the adding climb (not placed): the baseline starts where they had got to
  const a2 = {}; const A2 = makeAdding(a2, { rand: seeded(4) }); play(A2, 3);
  assert.equal(a2.placed, false); assert.ok(a2.step > 1);
  const r2 = { topics: { adding: a2, times: {}, algebra: {} } };
  const s2 = migrate(r2).strands.add;
  assert.deepEqual([s2.level, s2.placed, s2.base.phase, s2.base.at], [pctAt('adding', a2.step), false, 'climb', pctAt('adding', a2.step)]);

  // 3. a lock-box rider: the real first climb, then settled; and the boxes' level within the rung
  const al = {}; const AL = makeAlgebra(al, { now: () => T0 });
  for (let k = 0; k < 12 && al.placing; k++) { const p = AL.next(); AL.record({ rung: p.rung, clean: k < 5, solved: true, moves: p.par, par: p.par }); }
  assert.equal(al.placing, false);
  for (let k = 0; k < 3; k++) { const p = AL.next(); AL.record({ rung: p.rung, clean: true, solved: true, moves: p.par, par: p.par }); }
  const s3 = migrate({ topics: { algebra: al, times: {} } }).strands.eq;
  assert.equal(s3.placed, true);
  assert.equal(s3.level, pctAt('lockbox', al.rung, ((al.levels[al.rung] ?? 2) - 2) / 3));

  // 4. past the vault, on the inequalities
  const s4 = migrate({ topics: { algebra: { rung: 'I2', placing: false, levels: { I2: 4 }, boxes: 140, stamped: ['R15', 'I1'] } } }).strands;
  assert.deepEqual([s4.eq.level, s4.eq.placed], [pctAt('lockbox', 'R15'), true]);
  assert.equal(s4.ineq.level, pctAt('lockboxIneq', 'I2', 2 / 3));

  // 5. the range (its steps count from 0), the store and Loot the gang
  const ns = {}; const NS = makeNumberSense(ns); for (let k = 0; k < 4; k++) NS.finish(NS.card(), 0);
  const st = {}; const Q = makeWordProblems(st, { rand: seeded(5) }); for (let k = 0; k < 4; k++) { const o = Q.next(); Q.answer(o, o.coins.findIndex((c) => c.good)); }
  const lo = {}; const S = makeShares(lo, { rand: seeded(6) }); for (let k = 0; k < 3; k++) { const q = S.next({}); S.answer(q, q.coins.findIndex((c) => c.good)); }
  const s5 = migrate({ topics: { numbersense: ns, store: st, loot: lo } }).strands;
  assert.equal(s5.number.level, pctAt('range', ns.step));
  assert.equal(s5.words.level, pctAt('store', st.step));
  assert.equal(s5.div.level, pctAt('shares', lo.step));
  assert.equal(s5.words.placed, st.placing === false);

  // 6. a rider who never played anything: no strands, but marked so it isn't read again
  const r6 = { topics: { times: {}, algebra: {} } };
  assert.deepEqual(migrate(r6), { v: 1, migrated: 1, n: 0, strands: {} });
});

test('migration: two topics on one strand keep the placed flag of the higher; a barely started climb is not read', () => {
  const g = K.oldLevels({ topics: { adding: { step: 3, placed: true, waves: 9 }, negatives: { step: 4, placed: false, waves: 3 } } });
  assert.deepEqual(g.add, { level: 72, placed: false }, 'an unplaced climb above a placed topic: a baseline from there, not placed');
  const g2 = K.oldLevels({ topics: { counting: { step: 8, placed: true, waves: 9 }, numbersense: { step: 8, placed: false, cards: 2 } } });
  assert.deepEqual(g2.number, { level: 24, placed: true }, 'two range cards are not read');
  // an algebra rider who once roped one adding steer and saw one times wave
  const r = { topics: { adding: { step: 2, placed: false, waves: 1 }, times: { step: 1, placed: false, waves: 1 }, algebra: { rung: 'R5', placing: true, boxes: 4 } } };
  migrate(r);
  assert.deepEqual(Object.keys(r.skill.strands), ['eq']);
  assert.ok(!fits(r, 'counting', ['counting', 'adding']), 'no counting for an equations rider at 50');
});

test('migration runs once and never overwrites a strand', () => {
  const r = { topics: { times: { step: 10, placed: true, clock: 30 }, algebra: {} } };
  migrate(r);
  setLevel(r, 'mul', 44);
  r.topics.times.step = 20;
  migrate(r);
  assert.equal(levelOf(r, 'mul'), 44, 'the second load leaves it alone');
  const r2 = { skill: { migrated: 1, strands: {} }, topics: { times: { step: 10, placed: true, clock: 30 } } };
  migrate(r2);
  assert.equal(isMet(r2, 'mul'), false, 'already migrated: the old topics are not read again');
  const r3 = { skill: { strands: { mul: { level: 20, placed: true } } }, topics: { times: { step: 22, placed: true, clock: 300 } } };
  migrate(r3);
  assert.equal(levelOf(r3, 'mul'), 20, 'a strand already there wins over the old topic');
});

test('save.js: loading an old rider reads its topics into the strands; recordAnswer feeds the skill model', async () => {
  const S = await import('../src/save.js');
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  S.useSaveKey('test.skill.riders');
  // an old save, as the browser holds it today (no skill, no age)
  store.set('test.skill.riders', JSON.stringify({ version: 1, riders: [{ id: 'r1', name: 'Jo', gold: 40, bounty: 90, mode: 'lasso',
    topicsOn: { times: true, algebra: true }, topics: { times: { v: 1, step: 7, placed: true, clock: 55, waves: 9 }, algebra: { v: 1, rung: 'R3', placing: false, levels: { R3: 4 }, boxes: 14 } },
    missions: { roundup: true }, owned: { saddle: 'plain', horse: 'bay', dog: null }, stats: { answered: 60, right: 50, recent: [1, 1, 0] }, made: 1, last: 2 }] }));
  const [jo] = S.loadRiders();
  assert.deepEqual([jo.skill.strands.mul.level, jo.skill.strands.eq.level], [pctAt('times', 7), pctAt('lockbox', 'R3', 2 / 3)]);
  assert.equal(jo.age, null);
  assert.equal(jo.goals, undefined, 'goals and done appear only once a rider has them');
  const res = S.recordAnswer(jo, true, { strands: [{ strand: 'mul', at: pctAt('times', 7) }] });
  assert.equal(res.skill.mul.moved, SKILL.UP);
  assert.equal(jo.stats.answered, 61, 'the old counts still go up');
  const plain = S.recordAnswer(jo, false);
  assert.equal(plain.skill, null, 'without the skill part, only the old counts');
  const [again] = S.loadRiders();
  assert.equal(again.skill.strands.mul.level, pctAt('times', 7) + SKILL.UP, 'saved');
  assert.equal(again.skill.migrated, 1);
  const kid = S.newRider('Kit');
  assert.deepEqual(kid.skill, { v: 1, migrated: 1, n: 0, strands: {} });
  assert.equal(S.fixRider({ age: '11' }).age, 11);
  assert.equal(S.fixRider({ age: 300 }).age, null);
  assert.deepEqual(S.fixRider({ goals: [{ id: 'buckle:cattle:silver' }, 'x', null], done: ['a', 'a', 3] }).goals, [{ id: 'buckle:cattle:silver' }]);
  assert.deepEqual(S.fixRider({ done: ['a', 'a', 3] }).done, ['a']);
  delete globalThis.localStorage;
});

// ---- the answer timer -------------------------------------------------------------------------------------------------

test('answertimer: measures the time, and notices a hidden tab and a long spell without input', async () => {
  const { answerTimer } = await import('../src/ui/answertimer.js');
  let t = 1000;
  const now = () => t;
  // no page: the time only
  let A = answerTimer({ now });
  t = 4500;
  assert.deepEqual(A.stop(), { ms: 3500, hidden: false, idle: false });
  // a page (a small stand-in for document)
  const ls = {};
  globalThis.document = { visibilityState: 'visible', addEventListener: (e, f) => { (ls[e] ||= new Set()).add(f); }, removeEventListener: (e, f) => { if (ls[e]) ls[e].delete(f); } };
  const fire = (e) => { for (const f of ls[e] || []) f(); };
  try {
    t = 0; A = answerTimer({ now, idleMs: 60000 });
    t = 30000; fire('pointermove'); t = 80000; fire('keydown'); t = 90000;
    assert.deepEqual(A.lap(), { ms: 90000, hidden: false, idle: false }, 'never 60 s without input');
    t = 160000; fire('pointerdown'); t = 161000;
    assert.deepEqual(A.lap(), { ms: 71000, hidden: false, idle: true }, '70 s without input');
    document.visibilityState = 'hidden'; fire('visibilitychange'); document.visibilityState = 'visible'; t = 170000;
    assert.deepEqual(A.stop(), { ms: 9000, hidden: true, idle: false });
    assert.equal(Object.values(ls).reduce((n, s) => n + s.size, 0), 0, 'stop() stops listening');
  } finally { delete globalThis.document; }
});
