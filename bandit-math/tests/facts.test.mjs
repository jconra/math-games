// The times facts (src/math/facts.js): one record per fact either way round, green and red for the times chart, a
// missed fact brought back soon, weak tables picked more often (the design's tiers as the first guess), and the old times
// trainer's misses read in once.
import test from 'node:test';
import assert from 'node:assert/strict';

const F = await import('../src/math/facts.js');
const { FACTS, TIERS, tierOf, factKey, recordFact, factOf, colourOf, chart, tableMiss, pickTable, pickFact, dueFacts, migrate } = F;
const { seeded } = await import('../src/levels/kit.js');
const S = await import('../src/save.js');

const fresh = () => ({});

test('the tiers: 1 & 2, 3 5 10, 4 9, 6 7 8, 11 12; a fact is kept once, smaller number first', () => {
  assert.deepEqual(TIERS, [[1, 2], [3, 5, 10], [4, 9], [6, 7, 8], [11, 12]]);
  assert.deepEqual([1, 2, 3, 5, 10, 4, 9, 6, 7, 8, 11, 12].map(tierOf), [0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4]);
  assert.equal(factKey(8, 7), '7x8');
  const r = fresh();
  recordFact(r, 8, 7, true);
  assert.equal(factOf(r, 7, 8).r, 1);
  assert.equal(recordFact(r, 13, 2, true), null, 'past 12 x 12 is not kept');
});

test('green for a fact answered right, red for one missed, until it is right twice running', () => {
  const r = fresh();
  assert.equal(colourOf(r, 7, 2), null);
  recordFact(r, 7, 2, true);
  assert.equal(colourOf(r, 2, 7), 'green');
  recordFact(r, 7, 8, false);
  assert.equal(colourOf(r, 8, 7), 'red');
  recordFact(r, 7, 8, true);
  assert.equal(colourOf(r, 7, 8), 'red', 'one right after a miss: still red');
  recordFact(r, 7, 8, true);
  assert.equal(colourOf(r, 7, 8), 'green');
  const c = chart(r);
  assert.equal(c.length, 12); assert.equal(c[6][1], 'green'); assert.equal(c[1][6], 'green'); assert.equal(c[6][7], 'green'); assert.equal(c[0][0], null);
});

test('a missed fact comes back soon: due 2 to 4 fact answers later, and pickFact asks it first', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const rand = seeded(seed), r = fresh();
    recordFact(r, 7, 8, false, { rand });
    let n = 0;
    while (!dueFacts(r).length && n < 10) { recordFact(r, 2, 2 + (n % 5), true, { rand }); n++; }
    assert.ok(n >= FACTS.SOON[0] && n <= FACTS.SOON[1], `due after ${n}`);
    const q = pickFact(r, { tables: [7, 8], rand });
    assert.deepEqual([q.key, q.why], ['7x8', 'due']);
    assert.equal(pickFact(r, { tables: [3], rand }).why, 'weak', 'a due fact off these tables waits');
    assert.equal(pickFact(r, { tables: [8], rand }).a, 8, 'asked from the table in play (8 x 7)');
  }
});

test('weak tables come up more often: the tiers first, then the rider’s own misses', () => {
  const count = (r, tables, n = 4000) => {
    const rand = seeded(9), c = {};
    for (let k = 0; k < n; k++) { const t = pickTable(r, tables, { rand }); c[t] = (c[t] || 0) + 1; }
    return c;
  };
  const r = fresh();
  assert.ok(tableMiss(r, 7) > tableMiss(r, 3) && tableMiss(r, 3) > tableMiss(r, 2), 'the tiers are the first guess');
  const c0 = count(r, [2, 7]);
  assert.ok(c0[7] > c0[2] * 1.5, `the hard 7s more than the 2s (${JSON.stringify(c0)})`);
  // "great at times tables 1-6, but needs work on 7 & 8"
  for (let b = 1; b <= 12; b++) for (const t of [3, 4, 5, 6]) recordFact(r, t, b, true);
  for (let b = 1; b <= 12; b++) { recordFact(r, 7, b, b % 2 === 0); recordFact(r, 8, b, b % 3 !== 0); }
  const c1 = count(r, [3, 4, 5, 6, 7, 8]);
  const weak = c1[7] + c1[8], strong = c1[3] + c1[4] + c1[5] + c1[6];
  assert.ok(weak > strong, `the 7s and 8s together more than the 3s to 6s (${JSON.stringify(c1)})`);
  // a table answered right lately is asked less again (the record forgets old answers: HIST)
  for (let k = 0; k < FACTS.HIST; k++) for (let b = 1; b <= 12; b++) recordFact(r, 7, b, true);
  assert.ok(tableMiss(r, 7) < tableMiss(r, 8), 'the 7s mended');
});

test('pickFact leans to red and new facts within the table, and not the one just asked', () => {
  const r = fresh(), rand = seeded(4);
  for (let b = 1; b <= 12; b++) for (let k = 0; k < 4; k++) recordFact(r, 6, b, true, { rand });
  recordFact(r, 6, 7, false, { rand }); recordFact(r, 6, 7, true, { rand });   // red, not due right now? (due soon)
  const c = {};
  for (let k = 0; k < 3000; k++) {
    const q = pickFact(r, { tables: [6], rand, last: '6x9' });
    if (q.why === 'weak') c[q.b] = (c[q.b] || 0) + 1;
  }
  assert.ok((c[7] || 0) > (c[3] || 0) * 3, `the red 6 x 7 more often (${JSON.stringify(c)})`);
  assert.ok((c[9] || 0) < (c[3] || 0), 'the one just asked less often');
});

test('the old times trainer’s missed facts become red facts, once (strays that were no fact are left out)', () => {
  const r = { topics: { times: {
    review: [{ kind: 'missing', t: 7, a: 8, trap: 'other', sess: 1, misses: 1 }, { kind: 'rule', t: 6, n: 27, trap: 'near', sess: 1, misses: 1 }],
    soon: [{ kind: 'rule', t: 9, n: 63, trap: 'other', due: 4 }],
  } } };
  migrate(r);
  assert.equal(colourOf(r, 7, 8), 'red');
  assert.equal(colourOf(r, 9, 7), 'red');
  assert.equal(Object.keys(r.facts.f).length, 2, '27 is no 6s fact');
  assert.deepEqual(dueFacts(r).sort(), ['7x8', '7x9']);
  recordFact(r, 7, 8, true); recordFact(r, 7, 8, true);
  migrate(r);
  assert.equal(colourOf(r, 7, 8), 'green', 'read once only');
  const saved = S.fixRider({ name: 'T', topics: { times: { review: [{ kind: 'missing', t: 12, a: 11 }] } } });
  assert.equal(colourOf(saved, 11, 12), 'red', 'save.js fixRider reads them in');
});
