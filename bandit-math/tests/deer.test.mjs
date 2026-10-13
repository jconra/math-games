// Tests for the deer photographs' math (src/math/deermath.js) and the photo album (src/ui/album.js).
// Run with:  node --test bandit-math/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// a stand-in for the browser's localStorage (the album saves through save.js)
const fake = {
  data: new Map(), full: false,
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; },
  setItem(k, v) { if (this.full && String(v).length > 4000) throw new Error('full'); this.data.set(k, String(v)); },
  removeItem(k) { this.data.delete(k); },
};
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { return fake; } });

const M = await import('../src/math/deermath.js');
const { makeRng, RUNG_IDS } = await import('../src/lockbox/generate.js');
const { line, num, xt, evalSide, F, solvedValue } = await import('../src/lockbox/engine.js');
const S = await import('../src/save.js');
const A = await import('../src/ui/album.js');

const riderAt = (rung, o = {}) => ({ topicsOn: { algebra: true, ...(o.on || {}) }, topics: { algebra: { rung, levels: o.levels || {}, placing: !!o.placing } } });
const makesTrue = (shot, v) => evalSide(shot.start.L, F(v)).eq(evalSide(shot.start.R, F(v)));

test('every rung of the ladder gives one equation with exactly one right tag', () => {
  const rng = makeRng(11);
  for (const rung of RUNG_IDS) {
    for (let k = 0; k < 25; k++) {
      const n = 3 + (k % 3);
      const shot = M.makePhoto(riderAt(rung), { n, rng });
      assert.equal(shot.values.length, n, `${rung}: ${n} tags`);
      assert.equal(new Set(shot.values).size, n, `${rung}: no repeated tags ${shot.values}`);
      const right = shot.values.filter((v) => makesTrue(shot, v));
      assert.deepEqual(right, [shot.x], `${rung} ${shot.eq}: only x makes it true (${shot.values})`);
      assert.equal(shot.values[shot.right], shot.x);
      assert.ok(shot.values.every((v) => Number.isInteger(v) && Math.abs(v) <= M.DEERMATH.most), `${rung}: whole tags within range`);
    }
  }
});

test('the warm-up rungs and the vault are swapped for real one-answer rungs', () => {
  assert.equal(M.rungFor(riderAt('R0a')).rung, 'R1');
  assert.equal(M.rungFor(riderAt('R0b')).rung, 'R1');
  assert.equal(M.rungFor(riderAt('R15')).rung, 'R14');
  assert.equal(M.rungFor(riderAt('R7')).rung, 'R7');
  // the kid's level on the rung sets the numbers' size, as the lock boxes do (the first climb plays at level 3)
  assert.equal(M.rungFor(riderAt('R6', { levels: { R6: 2 } })).size, 1);
  assert.equal(M.rungFor(riderAt('R6', { levels: { R6: 4 } })).size, 2);
  assert.equal(M.rungFor(riderAt('R6', { placing: true })).size, 2);
});

test('without "Solving for x" ticked the deer ask the simplest one-step equations', () => {
  const rng = makeRng(3), seen = new Set();
  for (let k = 0; k < 60; k++) seen.add(M.rungFor({ topicsOn: { times: false } }, rng).rung);
  assert.deepEqual([...seen].sort(), ['R1', 'R2']);
  const withTimes = new Set();
  for (let k = 0; k < 60; k++) withTimes.add(M.rungFor({ topicsOn: { times: true } }, rng).rung);
  assert.deepEqual([...withTimes].sort(), ['R1', 'R2', 'R3']);
  // ticked but never played: the first rung
  assert.equal(M.rungFor({ topicsOn: { algebra: true }, topics: { algebra: {} } }).rung, 'R1');
});

test('rungs without negatives never put a negative or zero on a tag', () => {
  const rng = makeRng(5);
  for (const rung of ['R1', 'R2', 'R3', 'R4', 'R6', 'R12']) for (let k = 0; k < 40; k++) {
    const shot = M.makePhoto(riderAt(rung), { n: 5, rng });
    assert.ok(shot.values.every((v) => v > 0), `${rung} ${shot.eq}: ${shot.values}`);
  }
});

test('the steps solve the equation, one move a line, and end on x', () => {
  const rng = makeRng(9);
  for (const rung of RUNG_IDS) {
    const shot = M.makePhoto(riderAt(rung), { n: 4, rng });
    assert.equal(shot.steps[0].text, shot.eq);
    assert.ok(shot.steps.length >= 2, `${rung}: at least one move`);
    assert.ok(shot.steps.slice(1).every((s) => s.note), `${rung}: every move says what it did`);
    const last = shot.steps[shot.steps.length - 1].text;
    assert.match(last, new RegExp(`^(x = ${M.numText(shot.x)}|${M.numText(shot.x)} = x)$`), `${rung} ${shot.eq}: ends ${last}`);
  }
});

test('a wrong deer gets the check a teacher would write', () => {
  const shot = { start: line([xt(1), num(7)], [num(12)]), x: 5 };
  assert.equal(M.whyNot(shot, 7), "That one's 7: check, 7 + 7 is 14, not 12.");
  // x written on the right: still checked x side first
  const swapped = { start: line([num(12)], [xt(1), num(7)]), x: 5 };
  assert.equal(M.whyNot(swapped, 7), "That one's 7: check, 7 + 7 is 14, not 12.");
  // 3x − 4 = 11
  const two = { start: line([xt(3), num(-4)], [num(11)]), x: 5 };
  assert.equal(M.whyNot(two, 4), "That one's 4: check, 3·4 − 4 is 8, not 11.");
  // negatives in brackets, real minus signs
  assert.equal(M.whyNot(two, -2), "That one's −2: check, 3·(−2) − 4 is −10, not 11.");
  // x on both sides
  const both = { start: line([xt(5), num(3)], [xt(2), num(15)]), x: 4 };
  assert.equal(M.whyNot(both, 2), "That one's 2: 5·2 + 3 makes 13, but 2·2 + 15 makes 19.");
  const b = M.balanceFor(two, 4);
  assert.deepEqual([b.left, b.right, b.tip, b.leftText, b.rightText], [8, 11, 1, '3·4 − 4', '11']);
  assert.equal(M.balanceFor(two, 5).tip, 0);
});

test('equations are not dealt again straight away', () => {
  const rng = makeRng(21), recent = [];
  for (let k = 0; k < 8; k++) {
    const shot = M.makePhoto({ topicsOn: {} }, { n: 4, rng, recent });
    assert.ok(!recent.includes(shot.key), `${shot.key} repeated`);
    recent.push(shot.key);
  }
});

test('the album keeps the newest prints and survives a bad save', () => {
  fake.data.clear(); S.useSaveKey('bandit-math.riders.decktest');
  const r = S.newRider('Ada');
  S.saveRider(r);
  const img = 'data:image/jpeg;base64,' + 'A'.repeat(200);
  for (let k = 0; k < A.ALBUM.max + 5; k++) A.addPrint(r, { eq: `x + ${k} = ${k + 3}`, x: '3', img, rung: 'R1' });
  assert.equal(r.album.length, A.ALBUM.max);
  assert.equal(A.prints(r)[0].eq, `x + ${A.ALBUM.max + 4} = ${A.ALBUM.max + 7}`, 'newest first');
  // saved with the rider, read back after a reload
  const back = S.loadRiders().find((x) => x.id === r.id);
  assert.equal(A.prints(back).length, A.ALBUM.max);
  assert.equal(A.prints(back)[0].img, img);
  // junk in a hand-edited save is dropped; a picture that isn't a picture is blanked
  assert.deepEqual(A.cleanAlbum([null, 5, { eq: 'x = 1', x: 1, img: 'javascript:alert(1)' }]).map((p) => [p.eq, p.x, p.img]), [['x = 1', '1', '']]);
  assert.deepEqual(A.cleanAlbum('nope'), []);
});

test('a full browser storage lets old pictures go before the new print', () => {
  fake.data.clear(); S.useSaveKey('bandit-math.riders.decktest2');
  const r = S.newRider('Bo'); S.saveRider(r);
  const img = 'data:image/jpeg;base64,' + 'B'.repeat(1500);
  A.addPrint(r, { eq: 'x + 1 = 2', x: '1', img }); A.addPrint(r, { eq: 'x + 2 = 4', x: '2', img });
  fake.full = true;   // (now anything over 4000 characters won't fit)
  const p = A.addPrint(r, { eq: 'x + 3 = 6', x: '3', img });
  fake.full = false;
  const back = S.loadRiders().find((x) => x.id === r.id);
  assert.equal(A.prints(back).length, 3, 'every print kept');
  assert.equal(A.prints(back)[0].eq, 'x + 3 = 6');
  assert.ok(A.prints(back).some((q) => !q.img), 'an older one gave up its picture');
  assert.ok(p.img === img || p.img === '');
});
