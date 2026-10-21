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
const { makeRng } = await import('../src/lockbox/generate.js');
const { evalSide, F } = await import('../src/lockbox/engine.js');
const S = await import('../src/save.js');
const A = await import('../src/ui/album.js');
const { PLACE } = await import('../src/levels/places.js');
const LV = await import('../src/levels/model.js');

const LADDER = PLACE.deer.levels;
const L = (id) => LADDER.find((x) => x.id === id);
const shotAt = (id, o = {}) => M.makePhoto({}, { n: 4, rng: o.rng || makeRng(o.seed ?? 3), level: L(id), into: o.into ?? 2, count: L(id).count, recent: o.recent || [], fact: o.fact || null });
// does v fill the blank? (read back from the question itself, not from the maker's answer)
function fills(shot, v) {
  if (!shot.young) return evalSide(shot.start.L, F(v)).eq(evalSide(shot.start.R, F(v)));
  const e = shot.eq.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  let m;
  if ((m = /^(\d+) (more|less) than (\d+) is \?$/.exec(e))) return v === (m[2] === 'more' ? +m[3] + +m[1] : +m[3] - +m[1]);
  if ((m = /^(\d+) \/ (\d+) = (\d+), \? left over$/.exec(e))) return v >= 0 && v < +m[2] && +m[3] * +m[2] + v === +m[1];
  const [lhs, rhs] = e.split('=').map((t) => t.trim());
  return Function(`return (${lhs.replace('?', `(${v})`)}) === (${rhs})`)();
}

test('every level gives one question with exactly one right tag, a counting number', () => {
  const rng = makeRng(11);
  for (const lv of LADDER) {
    for (let k = 0; k < 40; k++) {
      const n = 3 + (k % 4);
      const shot = M.makePhoto({}, { n, rng, level: lv, into: k % lv.count, count: lv.count });
      assert.equal(shot.level, lv.id);
      assert.equal(shot.values.length, n, `${lv.id}: ${n} tags`);
      assert.equal(new Set(shot.values).size, n, `${lv.id}: no repeated tags ${shot.values}`);
      const right = shot.values.filter((v) => fills(shot, v));
      assert.deepEqual(right, [shot.x], `${lv.id} ${shot.eq}: only ${shot.x} fills it (${shot.values})`);
      assert.equal(shot.values[shot.right], shot.x);
      assert.ok(shot.values.every((v) => Number.isInteger(v) && v > 0 && v <= M.DEERMATH.most), `${lv.id}: counting-number tags ${shot.values}`);
    }
  }
});

test('each level asks its own kind: a blank below simple x, x from there; the numbers stay in the level', () => {
  const rng = makeRng(5);
  for (const lv of LADDER) {
    for (let k = 0; k < 30; k++) {
      const s = M.makePhoto({}, { n: 4, rng, level: lv, into: k % lv.count, count: lv.count });
      if (lv.gen.kind === 'x') { assert.ok(!s.young && /x/.test(s.eq) && !/\?/.test(s.eq), s.eq); continue; }
      assert.ok(s.young && /\?/.test(s.eq) && !/x/.test(s.eq), `${lv.id}: ${s.eq}`);
      const nums = s.eq.match(/\d+/g).map(Number);
      if (lv.id === 'more1') assert.ok(Math.max(...nums, s.x) <= 10 && /^1 (more|less)/.test(s.eq), s.eq);
      if (lv.id === 'add10') assert.ok(Math.max(...nums) <= 10 && /\+/.test(s.eq), s.eq);
      if (lv.id === 'add20') assert.ok(Math.max(...nums) > 10 && Math.max(...nums) <= 20, s.eq);
      if (lv.id === 'sub20') assert.ok(/−/.test(s.eq) && Math.max(...nums) <= 20, s.eq);
      if (lv.id === 'ten') assert.ok(/^10 (more|less)/.test(s.eq) && s.x <= 99, s.eq);
      if (lv.id === 'mul') assert.ok(/×/.test(s.eq) && s.x <= 10, s.eq);
      if (lv.id === 'div') assert.ok(/÷/.test(s.eq) && s.x <= 100, s.eq);
      if (lv.id === 'left') assert.ok(/left over/.test(s.eq) && s.x >= 1, s.eq);
    }
  }
});

test('the numbers grow across a level, never past its top: a sum up to 20 opens near 10', () => {
  const first = [], last = [];
  for (let k = 0; k < 60; k++) {
    first.push(Math.max(...shotAt('add20', { seed: k, into: 0 }).eq.match(/\d+/g).map(Number)));
    last.push(Math.max(...shotAt('add20', { seed: k, into: 4 }).eq.match(/\d+/g).map(Number)));
  }
  assert.ok(Math.max(...first) <= 12, `first photo of "8 + ? = 15": sums to ${Math.max(...first)}`);
  assert.ok(Math.max(...last) === 20 && Math.min(...first, ...last) > 10, 'and up to 20 by the end, every sum past 10');
});

test('a times fact picked for the rider is the one asked, and is handed back for the times chart', () => {
  const s = shotAt('mul', { fact: { a: 7, b: 4 } });
  assert.equal(s.eq, '? × 4 = 28'); assert.deepEqual(s.fact, { a: 7, b: 4 });
  const d = shotAt('div', { fact: { a: 3, b: 6 } });
  assert.equal(d.eq, '? ÷ 3 = 6'); assert.equal(d.x, 18);
  const x = shotAt('xMul', { fact: { a: 3, b: 7 } });
  assert.equal(x.eq.replace(/^21 = 3x$/, '3x = 21'), '3x = 21'); assert.deepEqual(x.fact, { a: 3, b: 7 });
  const l = shotAt('left'); assert.equal(l.fact.a * l.fact.b + l.x, Number(l.eq.match(/^\d+/)[0]), 'a leftover asks its groups as a fact');
});

test('the youngest levels come in words and are read aloud from the clips; the ladder\'s example is the same maker', () => {
  const s = M.makePhoto({}, { n: 4, rng: makeRng(2), level: L('add10'), into: 1, count: 5 });
  assert.ok(s.words && /what/i.test(s.words), s.words);
  assert.match(s.say, /^\d+ and what make \d+$/);
  const m = M.makePhoto({}, { n: 4, rng: makeRng(2), level: L('more1') });
  assert.match(m.say, /^one (more|less) than \d+$/);
  const t = M.makePhoto({}, { n: 4, rng: makeRng(4), level: L('mul') });
  assert.equal(t.say, null, 'a level not marked read: true is not read');
  const ex = PLACE.deer.example(L('sub20'), () => 0.4);
  assert.match(ex.q, /^\d+ − \? = \d+$/); assert.match(ex.a, /^\d+$/);
  assert.match(PLACE.deer.example(L('xTwo'), () => 0.4).a, /^x = \d+$/);
});

test('a wrong deer gets a check that doesn\'t give the answer away; the steps end on it', () => {
  for (const lv of LADDER) {
    for (let k = 0; k < 15; k++) {
      const s = shotAt(lv.id, { seed: 100 + k, into: k % 5 });
      for (const v of s.values) {
        if (v === s.x) continue;
        const why = M.whyNot(s, v);
        assert.ok(why.startsWith(`That one's ${v}:`), why);
        const b = M.balanceFor(s, v);
        assert.notEqual(b.tip, 0, `${s.eq} with ${v}: the pans don't balance`);
        // (the side the wrong number is checked against is never the answer itself, unless the question prints it)
        if (s.young && !s.eq.match(/\d+/g).map(Number).includes(s.x)) assert.notEqual(b.rightValue, String(s.x), `${s.eq} with ${v}: the balance shows the answer: ${JSON.stringify(b)}`);
      }
      const last = s.steps[s.steps.length - 1].text;
      assert.ok(new RegExp(`(^|\\D)${s.x}$`).test(last), `${s.eq}: the steps end on ${s.x} (${last})`);
    }
  }
  const m = shotAt('more1', { seed: 7 });
  const v = m.values.find((x) => x !== m.x);
  assert.match(M.whyNot(m, v), /is (\d+ (more|less) than \d+|\d+ itself), not 1 (more|less)\.$/);
});

test('questions are not dealt again straight away', () => {
  const rng = makeRng(9), recent = [];
  for (let k = 0; k < 10; k++) {
    const s = M.makePhoto({}, { n: 4, rng, recent, level: L('add20'), into: 4, count: 5 });
    assert.ok(!recent.includes(s.key), `${s.eq} dealt twice in ten`);
    recent.push(s.key);
  }
});

test('on the levels: a photo\'s first try moves the rider one level in placement, and lands in its strand', () => {
  fake.data.clear(); S.useSaveKey('bandit-math.riders.deertest');
  const r = S.newRider('Cy');
  const q = LV.levelFor(r, 'deer');
  assert.equal(q.id, 'more1', 'a new rider starts at one more, one less');
  const s = M.makePhoto(r, { n: 4, rng: makeRng(1), level: q.level, into: q.into, count: q.count });
  const out = S.recordAnswer(r, true, { place: 'deer', level: s.level });
  assert.equal(out.level.moved, 1);
  assert.equal(LV.levelFor(r, 'deer').id, 'add10');
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
