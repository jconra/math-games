// WORK IT OUT FROM EVERY JOB (src/math/jobsums.js): each job hands over its own question's sum, made from the real
// question makers of every place's ladder: the bottle range's estimate (the exact sum; the estimate stays the kid's),
// the round-up (a series or a herd: no sum), the sheep's and the pigs' sums as written, the deer's blanks, the wagon's
// missing number, the loot's shares and the fishing's fraction of a catch (a story's sum: filled in, the button not saying
// it), and a question with no sum says so. THE LEVEL TOOL (src/ui/leveltool.js): the title, the bar, the arrows stepping the level
// and the rider setting that hides them.
import test from 'node:test';
import assert from 'node:assert/strict';

const J = await import('../src/math/jobsums.js');
const { PLACE } = await import('../src/levels/places.js');
const { cardAt } = await import('../src/math/numbersense.js');
const { flockAt } = await import('../src/missions/sheepmath.js');
const { batchAt } = await import('../src/missions/pigmath.js');
const { deerShot } = await import('../src/math/deermath.js');
const { shareAt } = await import('../src/math/shares.js');
const { questionAt } = await import('../labs/fishing/pies.js');
const { makeTimes } = await import('../src/math/times.js');
const { makeRng } = await import('../src/lockbox/generate.js');
const { seeded } = await import('../src/levels/kit.js');
const { sumLabel } = await import('../src/ui/tools.js');
const { workOf } = await import('../src/math/longwork.js');
const LT = await import('../src/ui/leveltool.js');
const M = await import('../src/levels/model.js');
const S = await import('../src/save.js');

const valueOf = (s) => (s.op === 'add' ? s.a + s.b : s.op === 'sub' ? s.a - s.b : s.op === 'mul' ? s.a * s.b : Math.floor(s.a / s.b));
const isSum = (s) => s && ['add', 'sub', 'mul', 'div'].includes(s.op) && Number.isFinite(s.a) && Number.isFinite(s.b) && s.a >= 0 && s.b >= 0;

test('the bottle range: "Shoot the can closest to 58 + 24" hands over 58 + 24 itself (the estimate stays the kid\'s); other cards no sum', () => {
  assert.deepEqual(J.rangeSum({ kind: 'estimate', ask: { a: 58, op: '+', b: 24, exact: 82 } }), { op: 'add', a: 58, b: 24 });
  assert.equal(sumLabel(J.rangeSum({ kind: 'estimate', ask: { a: 58, op: '+', b: 24 } })), '58 + 24');
  let est = 0;
  for (const L of PLACE.range.levels) {
    for (let k = 0; k < 40; k++) {
      const c = cardAt(L.gen, { rng: makeRng(1000 * k + 7) });
      const s = J.rangeSum(c);
      if (c.kind === 'estimate') {
        est++;
        assert.ok(isSum(s), `${L.id}: ${c.rule} has its sum`);
        assert.equal(valueOf(s), c.ask.exact, `${c.rule}: the sum worked is the exact answer`);
        assert.ok(!s.story, 'the sum is written on the card: the button says it');
        assert.match(c.rule, new RegExp(`${s.a} . ${s.b}$`));
      } else assert.equal(s, null, `${L.id}: ${c.rule}: no sum on it`);
    }
  }
  assert.ok(est >= 40, 'the estimating levels were dealt');
});

test('the round-up and the wagon: a missing-number card hands over its sum (picked by the kid); a series, a herd or odds and evens has none', () => {
  const T = makeTimes({}, { rand: seeded(3), now: () => 0 });
  for (let k = 0; k < 60; k++) {
    const t = 2 + (k % 11), a = 2 + (k % 9);
    const w = T.wave({ count: 6, fact: { t, a, upTo: 12 } });
    assert.equal(w.kind, 'missing');
    const s = J.waveSum({ w, kind: w.kind });
    assert.ok(isSum(s) && s.op === 'div' && s.story, `${w.rule}: a division (a story's: the button doesn't say it)`);
    assert.equal(valueOf(s), w.targets.find((x) => x.good).n, `${w.rule}: worked, it is the missing number`);
  }
  assert.equal(J.waveSum({ w: { kind: 'missing', rule: '7 × ? = 56' }, done: true }), null, 'a wave done: nothing to work');
  assert.equal(J.waveSum({ w: { kind: 'series', rule: 'What comes next' }, kind: 'card' }), null);
  assert.equal(J.waveSum({ w: { kind: 'times', rule: 'Rope the 7-herd' }, kind: 'herd' }), null);
  assert.equal(J.waveSum({ w: { kind: 'parity', rule: 'Rope the evens' } }), null);
  assert.equal(J.waveSum(null), null);
  assert.equal(sumLabel(null), 'Nothing to work out on paper here', 'a question with no sum still says so');
});

test('the sick sheep: each sheep\'s sum as written (24 + 49 = 63 -> 24 + 49, $2.90 + $3.80 in dollars and cents), worked to its right answer; negatives and x: none', () => {
  let n = 0, money = 0;
  for (const L of PLACE.sheep.levels) {
    for (let k = 0; k < 8; k++) {
      const f = flockAt(L.gen, { size: 4, rand: seeded(31 * k + 5) });
      for (const it of f.sheep) {
        const s = J.sheepSum(it);
        if (/−\d|\(/.test(it.shown) && !/ − /.test(it.shown.replace(/^\S+/, ''))) { assert.equal(s, null, `${L.id}: ${it.shown}`); continue; }
        if (/\$\d+\.\d\d/.test(it.shown)) {   // (dollars and cents: worked as decimals, the $ kept, to the right answer)
          money++;
          assert.ok(isSum(s) && s.money, `${L.id}: ${it.shown}`);
          if (typeof it.answer === 'number') assert.equal(Math.round(workOf(s).answer * 100), it.answer, `${it.shown}: worked is ${workOf(s).line} (the sheep's right sum, in cents: ${it.answer})`);
          continue;
        }
        if (it.top || /x/.test(it.shown)) { assert.equal(s, null, `${L.id}: a step of solving for x: none`); continue; }
        if (!s) continue;
        n++;
        assert.ok(isSum(s), `${L.id}: ${it.shown}`);
        if (typeof it.answer === 'number' && s.op !== 'div') assert.equal(valueOf(s), it.answer, `${L.id}: ${it.shown} worked is ${it.answer}`);
      }
    }
  }
  assert.ok(n > 100, `sheep sums handed over (${n})`);
  assert.ok(money > 5, `dollars-and-cents sheep handed over (${money})`);
  assert.equal(J.sheepSum({ shown: '−10 + 18 = −28' }), null);
  assert.deepEqual(J.sheepSum({ shown: '$2.90 + $3.80 = $6.80' }), { op: 'add', a: 2.9, b: 3.8, money: true, cash: 'ab' });
  assert.equal(workOf(J.sheepSum({ shown: '$2.90 + $3.80 = $6.80' })).line, '$3.80 + $2.90 = $6.70', 'worked: the sheep is wrong');
  assert.deepEqual(J.sheepSum({ shown: '9,047 − 7,362 = 1,785' }), { op: 'sub', a: 9047, b: 7362 });
});

test('the loose pigs: the nearest pig\'s sum ("18 + 26: less than 50?" -> 18 + 26); a lone number or a negative: none', () => {
  let n = 0;
  for (const L of PLACE.pigs.levels) {
    for (let k = 0; k < 6; k++) {
      const b = batchAt(L.gen, { size: 5, rand: seeded(17 * k + 2) });
      for (const g of b.pigs) {
        const s = J.pigSum(g);
        if (!/[+−×÷]/.test(g.text) || /−\d|\(/.test(g.text)) { if (!/^\d+ [+−] \d+$/.test(g.text)) assert.equal(s, null, `${L.id}: ${g.text}`); }
        if (!s) continue;
        n++;
        assert.equal(valueOf(s), g.answer, `${L.id}: ${g.text} worked is ${g.answer}`);
      }
    }
  }
  assert.ok(n > 40, `pig sums handed over (${n})`);
  assert.equal(J.pigSum({ text: '−3 + 8' }), null);
  assert.equal(J.pigSum({ text: '7: EVEN or ODD?' }), null);
});

test('the deer: a blank to fill gives its sum to pick ("9 + ? = 12" -> 12 − 9), worked to the deer\'s number; two steps: none', () => {
  const kinds = {};
  for (const L of PLACE.deer.levels) {
    const rng = makeRng(11);
    for (let k = 0; k < 20; k++) {
      const shot = deerShot(L.gen, { n: 4, rng, into: k % 5, count: 5, fact: L.gen.facts ? { a: 2 + (k % 9), b: 3 + (k % 7) } : null });
      const s = J.deerSum(shot);
      kinds[L.id] = (kinds[L.id] || 0) + (s ? 1 : 0);
      if (!s) continue;
      assert.ok(isSum(s), `${L.id}: ${shot.eq}`);
      const v = /left over/.test(shot.eq) ? s.a % s.b : valueOf(s);
      assert.equal(v, shot.x, `${L.id}: ${shot.eq} -> ${s.a} ${s.op} ${s.b} = ${shot.x}`);
      if (/\?|x/.test(shot.eq) && !/left over|than/.test(shot.eq)) assert.ok(s.story, `${shot.eq}: the sum isn't written: the button doesn't say it`);
    }
  }
  for (const id of ['more1', 'add10', 'add20', 'sub20', 'ten', 'mul', 'div', 'left', 'xAdd', 'xMul']) assert.equal(kinds[id], 20, `deer ${id}: every photo hands over a sum`);
  assert.equal(kinds.xTwo, 0, 'two steps (2x + 7 = 15): no one sum');
  const st = J.blankSum('9 + ? = 12');
  assert.deepEqual(st, { op: 'sub', a: 12, b: 9, story: true });
  assert.equal(sumLabel(st), 'The sum on this question', 'the button doesn\'t give it away');
  assert.equal(workOf(st).answer, 3, 'the sheet opens on the columns of 12 − 9');
  assert.ok(!workOf(st).steps.some((x) => /work out\?/.test(x.ask)), 'no "What do we work out?"');
});

test('loot: a fair share or a leftover gives total ÷ families (picked by the kid); a share by a rule: none', () => {
  for (const L of PLACE.loot.levels) {
    for (let k = 0; k < 12; k++) {
      const p = shareAt(L.gen, { rand: seeded(7 * k + 1) });
      const s = J.lootSum(p);
      if (p.kind === 'rule' || p.kind === 'rule3') { assert.equal(s, null, `${L.id}: by a rule`); continue; }
      assert.ok(isSum(s) && s.op === 'div' && s.story, `${L.id}: ${p.kind}`);
      assert.equal(s.a, p.total); assert.equal(s.b, p.groups);
      if (p.kind === 'even' || p.kind === 'rem') assert.equal(valueOf(s), p.each, `${p.total} ÷ ${p.groups}: ${p.each} each`);
    }
  }
});

test('fishing: a fraction of the fish caught gives all ÷ the bottom number (picked by the kid); the other fraction questions: none', () => {
  let groups = 0;
  for (const L of PLACE.fishing.levels) {
    for (let k = 0; k < 10; k++) {
      const q = questionAt(L.gen, seeded(13 * k + 3));
      const s = J.fishSum(q);
      if (q.topic === 'group') {
        groups++;
        const m = /caught (\d+) fish/.exec(q.prompt), d = +/\((\d+)\/(\d+)\)/.exec(q.prompt)[2];
        assert.ok(isSum(s) && s.op === 'div' && s.story, q.prompt);
        assert.equal(s.a, +m[1]); assert.equal(s.b, d);
      } else assert.equal(s, null, `${L.id}: ${q.topic}`);
    }
  }
  assert.ok(groups >= 20, 'the fraction-of-a-group levels were dealt');
});

// ── THE LEVEL TOOL ─────────────────────────────────────────────────────────────────────────────────────────────────
const T0 = Date.UTC(2026, 9, 25, 15);
const fresh = (o = {}) => Object.assign(S.newRider('Kit', null), o);

test('the level tool: "27: Odd steps going down" (the level\'s number and title), the bar, and the arrows stepping down and up', () => {
  const r = fresh();
  const P = PLACE.roundup, k = P.levels.findIndex((L) => L.id === 'oddDown');
  assert.ok(k > 0);
  let v = LT.levelTool(r, 'roundup');
  assert.equal(v.i, 0); assert.equal(v.met, false); assert.equal(v.words, `1: ${P.levels[0].title}`);
  assert.equal(v.canDown, false); assert.equal(v.canUp, true); assert.equal(v.pick, true);
  assert.equal(LT.stepLevel(r, 'roundup', -1), null, 'nothing below the first level');
  // up a level at a time to the odd steps going down, each title showing on the way
  for (let i = 1; i <= k; i++) {
    v = LT.stepLevel(r, 'roundup', +1);
    assert.equal(v.i, i); assert.equal(v.words, `${i + 1}: ${P.levels[i].title}`);
    assert.equal(M.stateOf(r, 'roundup').id, P.levels[i].id, 'the rider is on that level (as "Start here" put them)');
  }
  assert.equal(v.words, `${k + 1}: Odd steps going down`.replace('Odd steps going down', P.levels[k].title));
  assert.equal(M.isPlaced(r, 'roundup'), true); assert.equal(v.placing, false);
  assert.equal(M.levelFor(r, 'roundup', { now: T0 }).id, 'oddDown', 'the next question comes from it');
  // the bar: right answers toward the next level, a miss takes some back
  assert.equal(v.fill, 0);
  M.recordLevel(r, 'roundup', { right: true, level: 'oddDown', now: T0 });
  M.recordLevel(r, 'roundup', { right: true, level: 'oddDown', now: T0 });
  v = LT.levelTool(r, 'roundup');
  assert.equal(v.into, 2); assert.equal(v.fill, 2 / v.count);
  assert.match(v.note, new RegExp(`2 of ${v.count} right answers toward level ${k + 2}`));
  // down again
  v = LT.stepLevel(r, 'roundup', -1);
  assert.equal(v.i, k - 1); assert.equal(v.into, 0);
  // a level a grown-up skipped: stepping onto it switches it on (as "Start here" did)
  M.setOn(r, 'roundup', P.levels[k].id, false);
  v = LT.stepLevel(r, 'roundup', +1);
  assert.equal(v.id, P.levels[k].id); assert.equal(M.isOn(r, 'roundup', P.levels[k].id), true);
  // the top: no further up
  M.startHere(r, 'roundup', P.levels[P.levels.length - 1].id);
  v = LT.levelTool(r, 'roundup');
  assert.equal(v.canUp, false); assert.equal(LT.stepLevel(r, 'roundup', +1), null);
});

test('the level tool: "Let the rider pick levels" off hides the arrows (the title and the bar still show); every place has a tool', () => {
  const r = fresh({ pickLevels: false });
  assert.equal(LT.canPick(r), false); assert.equal(LT.canPick(fresh()), true); assert.equal(LT.canPick(null), true);
  const v = LT.levelTool(r, 'wagon');
  assert.equal(v.pick, false); assert.equal(v.canDown, false); assert.equal(v.canUp, false);
  assert.ok(v.words && v.note);
  assert.equal(LT.stepLevel(r, 'wagon', +1), null, 'no stepping by hand');
  assert.equal(M.stateOf(r, 'wagon'), null, 'and nothing changed');
  // the setting is kept with the rider through a save's clean-up
  assert.equal(S.fixRider(JSON.parse(JSON.stringify(r))).pickLevels, false);
  for (const P of Object.values(PLACE)) {
    const w = LT.levelTool(fresh(), P.id);
    assert.ok(w && w.n === P.levels.length && w.words.startsWith('1: '), P.id);
  }
  assert.equal(LT.levelTool(fresh(), 'nowhere'), null);
});
