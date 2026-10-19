// Tests for the stats page's numbers (src/ui/stats.js: fmtTime, lately, spark, statRows, overview). The page itself is
// checked in a browser (the title screen's rig); these are the pure parts it draws from.
// Run with:  node --test bandit-math/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const fake = { data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, String(v)); }, removeItem(k) { this.data.delete(k); } };
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { return fake; } });

const { fmtTime, lately, spark, statRows, overview } = await import('../src/ui/stats.js');
const K = await import('../src/math/skill.js');
const S = await import('../src/save.js');

const DAY = 864e5, T0 = Date.UTC(2026, 9, 1, 15);

test('answer times read plainly', () => {
  assert.equal(fmtTime(4234), '4.2 s');
  assert.equal(fmtTime(9940), '9.9 s');
  assert.equal(fmtTime(23400), '23 s');
  assert.equal(fmtTime(60000), '1 min');
  assert.equal(fmtTime(65000), '1 min 5 s');
  assert.equal(fmtTime(0), '');
  assert.equal(fmtTime(null), '');
  assert.equal(fmtTime('x'), '');
});

test('the share right lately comes from the strand\'s recent answers', () => {
  assert.deepEqual(lately({ h: [[1, 20, 0], [0, 22, 0], [1, 20, 1]] }), { right: 2, of: 3 });
  assert.deepEqual(lately({}), { right: 0, of: 0 });
  assert.deepEqual(lately(null), { right: 0, of: 0 });
});

test('the history line: spaced by the calendar, fitted to its own range, at least 20 points tall', () => {
  assert.deepEqual(spark([]), { points: '', last: null, one: false });
  const one = spark([{ day: 5, pct: 40 }], 100, 20);
  assert.equal(one.one, true);
  assert.deepEqual(one.last, [97, 10]);
  const s = spark([{ day: 0, pct: 20 }, { day: 1, pct: 30 }, { day: 10, pct: 60 }], 100, 20);
  const pts = s.points.split(' ').map((p) => p.split(',').map(Number));
  assert.equal(pts.length, 3);
  assert.equal(pts[0][0], 3); assert.equal(pts[2][0], 97);
  assert.ok(pts[1][0] < 15, 'the second day sits near the first (a gap of a week shows as a gap)');
  assert.ok(pts[0][1] > pts[2][1], 'higher levels sit higher');
  for (const [x, y] of pts) { assert.ok(x >= 0 && x <= 100); assert.ok(y >= 0 && y <= 20); }
  // a small wobble stays small: 2 points apart doesn't fill the box
  const w = spark([{ day: 0, pct: 50 }, { day: 1, pct: 52 }], 100, 20).points.split(' ').map((p) => +p.split(',')[1]);
  assert.ok(Math.abs(w[0] - w[1]) < 3, w);
  // junk is skipped
  assert.equal(spark([{ day: 'x', pct: 3 }, null]).points, '');
});

// A rider who played a few days: addition placed and practised (travel answers, no time), word problems at the
// store (timed), and multiplication read from an old save (no answers since)
function playedRider() {
  const r = S.newRider('Ivy');
  K.setLevel(r, 'add', 40, { now: T0 });
  K.setLevel(r, 'words', 30, { now: T0 });
  r.skill.strands.mul = { level: 33, placed: true, base: null, n: 0, r: 0, f: 0, h: [], t: [], days: [], met: T0, last: 0, old: true };
  for (let d = 0; d < 3; d++) {
    for (let k = 0; k < 10; k++) K.record(r, 'add', { right: k % 5 !== 4, now: T0 + d * DAY * 2 + k * 6e4 });
    for (let k = 0; k < 6; k++) K.record(r, 'words', { right: k !== 3, sitDown: true, ms: 8000 + k * 500, size: 1, now: T0 + d * DAY * 2 + k * 6e4 });
  }
  r.stats.answered = 48; r.stats.recent = Array.from({ length: 48 }, (_, i) => (i % 5 === 4 ? 0 : 1));
  // fractions only looked up by a job choosing its question (met, with a starting guess, never answered)
  K.pick(r, 'frac', { now: T0 + 5 * DAY });
  return r;
}

test('a row a strand met, in the registry\'s order, with what is worked on, the last answers, time and the change', () => {
  const r = playedRider();
  const rows = statRows(r);
  assert.ok(r.skill.strands.frac, 'fractions were met (looked up)');
  assert.deepEqual(rows.map((x) => x.strand), ['add', 'mul', 'words'], 'registry order; strands not met, or only looked up with no answer, are left out');
  const add = rows.find((x) => x.strand === 'add'), words = rows.find((x) => x.strand === 'words'), mul = rows.find((x) => x.strand === 'mul');
  assert.equal(add.working, K.meaning('add', add.pct));
  assert.deepEqual(add.lately, { right: 16, of: 20 }, 'the last 20 answers');
  assert.equal(add.time, '', 'travel answers have no time');
  assert.equal(add.history.length, 3, 'one point a day played');
  assert.ok(add.change && add.change.since === add.history[0].day && add.change.by === add.history[2].pct - add.history[0].pct);
  assert.match(words.time, /^\d+(\.\d)? s$/, 'sit-down answers are timed');
  assert.equal(words.timed, 15, 'the last 15 timed right answers are kept');
  assert.equal(mul.old, true, 'from earlier rides, no answers since');
  assert.deepEqual(mul.lately, { right: 0, of: 0 });
  assert.equal(mul.change, null);
});

test('the totals: answers, the last 50, the average sit-down time, the days played, the strands not tried yet', () => {
  const r = playedRider();
  const o = overview(r);
  assert.equal(o.answered, 48);
  assert.equal(o.boxes, 0, 'no lock boxes solved');
  assert.equal(overview({ ...r, stats: { ...r.stats, boxes: 6 } }).boxes, 6, 'lock boxes solved are counted apart (save.js recordLockbox)');
  assert.deepEqual(o.recent, { right: 39, of: 48 });
  assert.equal(o.days, 3);
  const t = r.skill.strands.words.t.map((x) => x[0]);
  assert.equal(o.avgMs, Math.round(t.reduce((a, b) => a + b, 0) / t.length));
  assert.equal(o.unmet.length, K.STRANDS.length - 3);
  assert.ok(!o.unmet.some((u) => ['add', 'mul', 'words'].includes(u.id)));
  assert.ok(o.unmet.some((u) => u.id === 'frac'), 'a strand only looked up is still "not tried yet"');
  // a brand-new rider: nothing yet, every strand still to try
  const n = overview(S.newRider('New'));
  assert.deepEqual([n.answered, n.days, n.avgMs, n.unmet.length], [0, 0, null, K.STRANDS.length]);
  assert.deepEqual(statRows(S.newRider('New')), []);
  // a damaged skill object never throws
  assert.deepEqual(statRows({ skill: { strands: { add: 'x' } } }), []);
  assert.equal(overview({ skill: 7 }).answered, 0);
});

test('a kind of math with only light extra credits so far reads "a little practice", not "Finding the level" for ever', async () => {
  const SK = await import('../src/math/skill.js');
  const { statRows } = await import('../src/ui/stats.js');
  const r = { skill: { v: 1, migrated: 1, strands: {} }, stats: {} };
  for (let k = 0; k < 25; k++) SK.record(r, [{ strand: 'ratio', at: 38, weight: 0.25 }], { right: k % 2 === 0 });
  let row = statRows(r).find((x) => x.strand === 'ratio');
  assert.equal(row.light, true);
  assert.equal(row.finding, true);
  SK.record(r, [{ strand: 'ratio', at: SK.pick(r, 'ratio') }], { right: true });
  row = statRows(r).find((x) => x.strand === 'ratio');
  assert.equal(row.light, false, 'one answer that can place it: now its level is being found');
});
