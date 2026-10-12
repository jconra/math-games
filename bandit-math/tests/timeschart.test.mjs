// Tests for the times-table chart's plain helpers (src/ui/timeschart.js): the grid numbers, how big the chart is,
// where a missed number falls in a row, the words the kid reads, and the "gone quiet" timer.
// Run: node --test tests/timeschart.test.mjs
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  chartGrid, chartSize, chartOptions, productFromRule, missPlace, chartWords, watchHesitation,
} from '../src/ui/timeschart.js';
import { makeTimes, seeded, LADDER } from '../src/math/times.js';

test('the grid holds all 100 products, 1 to 10 each way', () => {
  const g = chartGrid(10);
  assert.equal(g.length, 10);
  for (const row of g) assert.equal(row.length, 10);
  assert.equal(g.flat().length, 100);
  assert.equal(g[0][0], 1);
  assert.equal(g[5][3], 24);            // the 6s row, column 4
  assert.equal(g[6][7], 56);            // 7 x 8
  assert.equal(g[9][9], 100);
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) assert.equal(g[r][c], g[c][r], 'the chart is the same both ways');
});

test('a 12 chart goes up to 144; anything else is a 10 chart', () => {
  const g = chartGrid(12);
  assert.equal(g.length, 12);
  assert.equal(g.flat().length, 144);
  assert.equal(g[11][11], 144);
  assert.equal(chartGrid(7).length, 10);
  assert.equal(chartGrid().length, 10);
});

test('chartSize: 10 unless the 11s/12s or numbers past x10 are in play', () => {
  assert.equal(chartSize({ table: 6 }), 10);
  assert.equal(chartSize({ table: 6, reach: 10 }), 10);
  assert.equal(chartSize({ table: 6, reach: 12 }), 12);
  assert.equal(chartSize({ table: 11 }), 12);
  assert.equal(chartSize({ table: 12 }), 12);
  assert.equal(chartSize({ table: 7, find: 77 }), 12);   // 7 x 11 is off a 10 chart
  assert.equal(chartSize({ table: 7, find: 56 }), 10);
  assert.equal(chartSize({ table: 6, missed: 62 }), 12); // 62 sits between 60 and 66, so show 66
  assert.equal(chartSize({ table: 6, missed: 27 }), 10);
  assert.equal(chartSize({ table: 6, size: 12 }), 12);   // the caller's choice wins
  assert.equal(chartSize({ table: 12, size: 10 }), 10);
  assert.equal(chartSize({}), 10);
});

test('missPlace: 27 in the 6s sits between 24 and 30, after column 4', () => {
  assert.deepEqual(missPlace(6, 27), { kind: 'gap', table: 6, n: 27, after: 4, prev: 24, next: 30 });
  const p = missPlace(7, 50);
  assert.equal(p.kind, 'gap'); assert.equal(p.prev, 49); assert.equal(p.next, 56); assert.equal(p.after, 7);
});

test('missPlace: smaller than the table goes before the first column', () => {
  const p = missPlace(6, 4);
  assert.equal(p.kind, 'gap'); assert.equal(p.after, 0); assert.equal(p.prev, 0); assert.equal(p.next, 6);
});

test('missPlace: past the end of the row, and numbers that are in the table', () => {
  const p = missPlace(6, 62, 10);
  assert.equal(p.kind, 'past'); assert.equal(p.last, 60); assert.equal(p.prev, 60); assert.equal(p.next, 66);
  assert.equal(missPlace(6, 62, 12).kind, 'gap');
  assert.deepEqual(missPlace(6, 54), { kind: 'in', table: 6, n: 54, col: 9, onChart: true });
  assert.equal(missPlace(6, 66, 10).onChart, false);
  assert.equal(missPlace(0, 5), null);
  assert.equal(missPlace(6, 'x'), null);
});

test('every wrong number up to x12 lands in a real gap of its row', () => {
  for (let t = 2; t <= 12; t++) {
    for (let n = 1; n <= t * 12 + 3; n++) {
      if (n % t === 0) continue;
      const size = chartSize({ table: t, missed: n });
      const p = missPlace(t, n, size);
      assert.ok(p.prev < n && n < p.next, `${n} among the ${t}s`);
      assert.equal(p.next - p.prev, t);
      if (p.kind === 'gap') {
        assert.ok(p.after >= 0 && p.after < size);
        assert.equal(p.prev, p.after * t);
      }
    }
  }
});

test('words: the 6s with nothing missed', () => {
  const w = chartWords({ table: 6 });
  assert.equal(w.title, 'The 6s');
  assert.equal(w.line, 'Every number in the 6s row is in the 6-herd.');
  assert.equal(w.tag, null);
});

test("words: after missing 27 on the 6s, the line a player will read", () => {
  const w = chartWords({ table: 6, missed: 27 });
  assert.equal(w.line, "27 sits between 24 and 30, so it isn't in the 6s.");
  assert.equal(w.tag, '27');
});

test('words: a number smaller than the table, past the end, and one that is in it', () => {
  assert.equal(chartWords({ table: 6, missed: 4 }).line, "4 is smaller than 6, the first number in the 6s, so it isn't in the 6s.");
  assert.equal(chartWords({ table: 6, missed: 62, size: 10 }).line, "62 sits between 60 and 66 (6 × 11, just off the chart), so it isn't in the 6s.");
  assert.equal(chartWords({ table: 6, missed: 62 }).line, "62 sits between 60 and 66, so it isn't in the 6s.");
  const inside = chartWords({ table: 6, missed: 54 });
  assert.equal(inside.line, '54 is in the 6s: 6 × 9 = 54.');
  assert.equal(inside.tag, null);
});

test('words: a missing-number card tells the kid how to read the chart, without giving the answer', () => {
  const w = chartWords({ table: 7, find: 56, rule: '7 × ? = 56' });
  assert.equal(w.title, '7 × ? = 56');
  assert.match(w.line, /Slide along the 7s row to 56, then look straight up/);
  assert.doesNotMatch(w.line + w.note, /\b8\b/);
  // the small note says something new, not the "Point at a number" readout that sits right under it
  assert.equal(w.note, 'The 7s row is lit.');
  assert.doesNotMatch(w.note, /point at|tap/i);
  const wrong = chartWords({ table: 7, find: 56, missed: 9 });
  assert.equal(wrong.line, '7 × 9 = 63, one 7 too many.');
  assert.match(wrong.note, /look straight up/);
  assert.equal(chartWords({ table: 7, find: 56, missed: 6 }).line, '7 × 6 = 42, two 7s short.');
  assert.equal(chartWords({ table: 7, find: 56, rule: '? x 7 = 56' }).title, '? × 7 = 56');
});

test("words: the caller's own line wins", () => {
  assert.equal(chartWords({ table: 6, missed: 27, line: 'Three past 24, not in the 6-herd' }).line, 'Three past 24, not in the 6-herd');
});

test('productFromRule reads the number after the equals sign', () => {
  assert.equal(productFromRule('7 × ? = 56'), 56);
  assert.equal(productFromRule('? × 12 = 132'), 132);
  assert.equal(productFromRule('Rope the 6-herd'), null);
  assert.equal(productFromRule(undefined), null);
});

test('chartOptions turns real trainer waves into chart options', () => {
  // a rule card from the trainer
  const T = makeTimes({}, { rand: seeded(3), now: () => 1e12 });
  T.setStep(LADDER.findIndex((r) => r.table === 6 && r.upTo === 10) + 1);
  const w = T.wave({ count: 10 });
  assert.equal(w.kind, 'rule');
  const o = chartOptions(w);
  assert.equal(o.table, w.table);
  assert.equal(o.size, w.reach >= 11 || w.table >= 11 ? 12 : 10);
  assert.equal(o.find, undefined);
  const stray = w.targets.find((x) => !x.good);
  const o2 = chartOptions(w, stray.n);
  assert.equal(o2.missed, stray.n);
  const p = missPlace(o2.table, stray.n, o2.size);
  assert.ok(p && p.kind !== 'in', 'a stray never sits inside the row');

  // a missing-number card from the trainer
  const M = makeTimes({}, { rand: seeded(5), now: () => 1e12 });
  M.setStep(LADDER.length - 1);
  const m = M.wave({ count: 6 });
  assert.equal(m.kind, 'missing');
  const om = chartOptions(m);
  assert.equal(om.table, m.table);
  const good = m.targets.find((x) => x.good).n;
  assert.equal(om.find, m.table * good);
  assert.equal(om.rule, m.rule);
  assert.ok(om.find <= om.size * m.table, 'the product to find is on the chart');
});

test('missing-number card: a wrong try of 11 or 12 grows the chart so the try can be ringed', () => {
  // 6 x ? = 48, the kid tried 11: 6 x 11 = 66 only shows on a 12 chart
  assert.equal(chartSize({ table: 6, find: 48, missed: 11 }), 12);
  assert.equal(chartSize({ table: 6, find: 48, missed: 12 }), 12);
  assert.equal(chartSize({ table: 7, find: 56, missed: 9 }), 10);   // a try on the 10 chart keeps it at 10
  assert.equal(chartSize({ table: 7, find: 56 }), 10);
  assert.equal(chartSize({ table: 6, find: 48, missed: 11, size: 10 }), 10);   // the caller's choice still wins
  // a rule card is unchanged: 11 among the 6s is a small number, not a try
  assert.equal(chartSize({ table: 6, missed: 11 }), 10);
  // the same through chartOptions, from a wave shaped like the trainer's (reach 10)
  const o = chartOptions({ kind: 'missing', table: 6, rule: '6 × ? = 48', reach: 10 }, 11);
  assert.equal(o.find, 48);
  assert.equal(o.missed, 11);
  assert.equal(o.size, 12);
  // and the line under the grid stays the plain one
  assert.equal(chartWords(o).line, '6 × 11 = 66, three 6s too many.');
  assert.equal(chartWords({ ...o, missed: 12 }).line, '6 × 12 = 72, four 6s too many.');
  assert.match(chartWords(o).note, /Slide along the 6s row to 48/);
});

test('real missing-number waves: every wrong try lands on the chart it gets', () => {
  let tries = 0, past10 = 0;
  for (const step of [LADDER.length - 1, LADDER.length]) {     // missing numbers up to x10, then up to x12
    for (let seed = 1; seed <= 40; seed++) {
      const T = makeTimes({}, { rand: seeded(seed * 31 + step), now: () => 1e12 });
      T.setStep(step);
      for (let i = 0; i < 3; i++) {
        const w = T.wave({ count: 10 });
        if (w.kind !== 'missing') continue;
        for (const x of w.targets) {
          if (x.good) continue;
          tries++;
          if (x.n > 10) past10++;
          const o = chartOptions(w, x.n);
          assert.ok(x.n <= o.size, `${w.rule}: a try of ${x.n} on a ${o.size} chart`);
        }
        for (const x of w.targets) if (x.good) T.answer(x.n, true);
      }
    }
  }
  assert.ok(tries > 100, 'enough tries to mean something');
  assert.ok(past10 > 0, 'some tries were 11 or 12, the case this checks');
});

test('chartOptions copes with odd input', () => {
  assert.deepEqual(chartOptions(null), { table: 0, size: 10 });
  assert.equal(chartOptions({ table: 6, kind: 'rule' }, 27).missed, 27);
  assert.equal(chartOptions({ table: 6, reach: 12 }).size, 12);
});

test('watchHesitation: fires once after the wait; answered and cancel stop it; restart starts it again', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let shown = 0;
    const h = watchHesitation({ after: 8000, onShow: () => shown++ });
    assert.equal(h.waiting, true);
    mock.timers.tick(7999);
    assert.equal(shown, 0);
    mock.timers.tick(1);
    assert.equal(shown, 1);
    assert.equal(h.shown, true);
    assert.equal(h.waiting, false);
    mock.timers.tick(20000);
    assert.equal(shown, 1, 'only once per wait');

    // a pick stops the wait; the round-up restarts it while the card still has numbers left
    h.restart();
    assert.equal(h.shown, false);
    mock.timers.tick(5000);
    h.answered();
    assert.equal(h.waiting, false);
    mock.timers.tick(60000);
    assert.equal(shown, 1, 'answered() stops it');
    h.restart();
    mock.timers.tick(5000);
    h.answered(); h.restart();     // a pick before the wait ran out starts the wait over
    mock.timers.tick(5000);
    assert.equal(shown, 1);
    mock.timers.tick(3000);
    assert.equal(shown, 2);

    h.restart();
    h.cancel();
    mock.timers.tick(60000);
    assert.equal(shown, 2, 'cancel() stops it');
    h.restart();                   // the next card
    mock.timers.tick(8000);
    assert.equal(shown, 3);
  } finally {
    mock.timers.reset();
  }
});

test('watchHesitation behaves the same as the number line helper', async () => {
  let other;
  try { other = (await import('../src/ui/numberline.js')).watchHesitation; } catch { other = null; }
  if (typeof other !== 'function') return;   // the number line isn't there yet: nothing to compare
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const run = (make) => {
      const log = [];
      const h = make({ after: 1000, onShow: () => log.push('show') });
      mock.timers.tick(999); log.push(h.waiting);
      mock.timers.tick(1); log.push(h.shown, h.waiting);
      h.restart(); mock.timers.tick(500); h.answered(); mock.timers.tick(2000); log.push(h.shown);
      h.restart(); h.cancel(); mock.timers.tick(2000); log.push(h.shown, h.waiting);
      h.restart(); mock.timers.tick(1000); log.push(h.shown);
      return log;
    };
    assert.deepEqual(run(watchHesitation), run(other));
  } finally {
    mock.timers.reset();
  }
});

test('the module loads without a page (nothing touches document at import)', async () => {
  const mod = await import('../src/ui/timeschart.js');
  assert.equal(typeof mod.offerChart, 'function');
  assert.equal(typeof mod.showChart, 'function');
  assert.equal(typeof mod.closeChart, 'function');
  assert.doesNotThrow(() => mod.closeChart());
  // a game key handler asks this before acting on Esc
  assert.equal(typeof mod.isChartOpen, 'function');
  assert.equal(mod.isChartOpen(), false);
});
