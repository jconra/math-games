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

const K = await import('../src/math/skill.js');
// a rider whose equations level (the skill model) sits on that rung of the lock box ladder, frac of the way to the next
const riderAt = (rung, frac = 0, o = {}) => { const r = {}; K.setLevel(r, 'eq', K.pctAt('lockbox', rung, frac), o); return r; };
const riderEq = (pct, o = {}) => { const r = {}; K.setLevel(r, 'eq', pct, o); return r; };
const makesTrue = (shot, v) => evalSide(shot.start.L, F(v)).eq(evalSide(shot.start.R, F(v)));

test('every rung of the ladder gives one equation with exactly one right tag', () => {
  const rng = makeRng(11);
  for (const rung of RUNG_IDS) {
    for (let k = 0; k < 25; k++) {
      const n = 3 + (k % 3);
      const shot = M.makePhoto({}, { n, rng, rung });
      assert.equal(shot.values.length, n, `${rung}: ${n} tags`);
      assert.equal(new Set(shot.values).size, n, `${rung}: no repeated tags ${shot.values}`);
      const right = shot.values.filter((v) => makesTrue(shot, v));
      assert.deepEqual(right, [shot.x], `${rung} ${shot.eq}: only x makes it true (${shot.values})`);
      assert.equal(shot.values[shot.right], shot.x);
      assert.ok(shot.values.every((v) => Number.isInteger(v) && Math.abs(v) <= M.DEERMATH.most), `${rung}: whole tags within range`);
    }
  }
});

test('a photo is a quick pick: asked well below the level, never past two steps, never a warm-up rung', () => {
  const B = M.DEERMATH.below, at = (r) => K.pctAt('lockbox', r);
  // (at R0a's 10 the kindergarten boxes still fit too: either way a box with one x to find)
  assert.ok(['R1', 'K3'].includes(M.rungFor(riderAt('R0a')).rung));
  assert.equal(M.rungFor(riderAt('R0b')).rung, 'R1');
  assert.equal(M.rungFor(riderAt('R0b')).at, at('R1'));   // (a swapped rung is recorded at its own point)
  // a rider just above the add-on rung stays on it (nothing lower has an x to find)
  assert.equal(M.rungFor(riderAt('R2')).rung, 'R1');
  // well below the level: a rider on "two steps with negatives" (62) gets about 42, "x/4 = 3" (R4)
  assert.equal(M.rungFor(riderAt('R7')).rung, 'R4');
  assert.equal(M.rungFor(riderAt('R7')).at, at('R7') - B);
  // the hardest riders: never past two steps ("2x + 5 = 17"), its numbers at most the lock box's level 4
  for (const r of ['R12', 'R13', 'R14', 'R15', 'I2']) {
    const g = M.rungFor(riderEq(r[0] === 'I' ? 99 : at(r)));
    assert.equal(g.rung, M.DEERMATH.top, r);
    assert.ok(g.at <= K.pctAt('lockbox', M.DEERMATH.top, M.DEERMATH.topFrac) + 0.05, `${r}: at ${g.at}`);
  }
  // a level still being found is asked below its baseline's point too
  // (its point lands on "one step with negatives", which a photo swaps for "x/4 = 3": no negatives below two steps)
  const fresh = riderEq(70, { placed: false });
  assert.equal(M.rungFor(fresh).rung, 'R4');
});

test('a roll opens on one step (and keeps to it after a miss): never past "x/4 = 3", two steps only after; no negatives', () => {
  const rng = makeRng(11);
  for (const r of ['R7', 'R9', 'R12', 'R14']) {
    const rider = riderEq(K.pctAt('lockbox', r));
    for (let k = 0; k < 20; k++) {
      const first = M.makePhoto(rider, { n: 4, rng, oneStep: true }), later = M.makePhoto(rider, { n: 4, rng });
      assert.ok(['R1', 'R2', 'R3', 'R4'].includes(first.rung), `${r} first: ${first.rung} ${first.eq}`);
      assert.ok(['R4', 'R6'].includes(later.rung), `${r} later: ${later.rung} ${later.eq}`);
      for (const s of [first, later]) assert.ok(s.x > 0 && s.values.every((v) => v > 0), `${r}: counting numbers ${s.eq} ${s.values}`);
    }
  }
  // missed ones ease below it, never onto the negatives' rung
  const g = M.rungFor(riderEq(K.pctAt('lockbox', 'R12')), makeRng(2), { ease: 8 });
  assert.notEqual(g.rung, 'R5');
});

test('a missed photo makes the next ones easier, down to the add-on rung', () => {
  const r = riderEq(K.pctAt('lockbox', 'R12'));
  const rungs = [0, 8, 16, 24, 99].map((ease) => M.rungFor(r, makeRng(1), { ease }));
  const ix = (g) => RUNG_IDS.indexOf(g.rung);
  for (let k = 1; k < rungs.length; k++) assert.ok(ix(rungs[k]) <= ix(rungs[k - 1]), rungs.map((g) => g.rung).join(' '));
  assert.ok(rungs[3].at < rungs[0].at - 15, `eased: ${rungs.map((g) => g.at)}`);
  assert.deepEqual(rungs[4], M.rungFor(r, makeRng(1), { ease: M.DEERMATH.ease.most }), 'eased at most DEERMATH.ease.most');
  // a young rider on the add-on rung eases no lower than it
  assert.equal(M.rungFor(riderAt('R1'), makeRng(2), { ease: 24 }).rung, 'R1');
});

test('the youngest riders get the kindergarten boxes ("2 plus what equals 4?"), the older ones the ladder', () => {
  const rng = makeRng(3);
  for (const [pct, want] of [[0, ['K1']], [5, ['K2']], [8, ['K3']], [25, ['R1']], [50, ['R2']], [90, ['R6']]]) {
    for (let k = 0; k < 12; k++) {
      const shot = M.makePhoto(riderEq(pct), { n: 4, rng });
      assert.ok(want.includes(shot.rung), `eq ${pct}: ${shot.rung} ${shot.eq}`);
      if (/^K/.test(shot.rung)) {
        assert.match(shot.words, /^\d+ (plus|take away) what (equals|leaves) \d+\?$/, shot.words);
        assert.ok(shot.say && shot.say.length > 5, 'read aloud from the clips');
        assert.ok(shot.values.every((v) => v > 0 && v <= 20), `counting numbers on the tags: ${shot.values}`);
        // written with a box to fill, never a letter; the print shows it filled in
        assert.ok(shot.young, 'young');
        assert.match(shot.eq, /^\d+ [+−] \? = \d+$|^\d+ = \d+ [+−] \?$/, shot.eq);
        assert.ok(!/x/.test(shot.eq) && shot.steps.every((st) => !/x/.test(st.text)), `no x: ${shot.eq}`);
        assert.equal(shot.solved, shot.eq.replace('?', String(shot.x)));
      } else { assert.equal(shot.words, null); assert.ok(!shot.young && /x/.test(shot.eq), shot.eq); }
    }
  }
  // a rider never seen before starts at the bottom (no age): the kindergarten boxes
  assert.equal(M.rungFor({}).rung, 'K1');
});

test('rungs without negatives never put a negative or zero on a tag', () => {
  const rng = makeRng(5);
  for (const rung of ['R1', 'R2', 'R3', 'R4', 'R6', 'R12']) for (let k = 0; k < 40; k++) {
    const shot = M.makePhoto({}, { n: 5, rng, rung });
    assert.ok(shot.values.every((v) => v > 0), `${rung} ${shot.eq}: ${shot.values}`);
  }
});

test('the steps solve the equation, one move a line, and end on x', () => {
  const rng = makeRng(9);
  for (const rung of RUNG_IDS) {
    const shot = M.makePhoto({}, { n: 4, rng, rung });
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
    const shot = M.makePhoto(riderAt('R6'), { n: 4, rng, recent });
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
