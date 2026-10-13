// The sick-sheep job's math (src/missions/sheepmath.js): every flock has the right number of sick sheep, each sick sum
// has exactly one cure among its bottles, a healthy sum is really right, the bottles never repeat or "fix" a sum into
// what it already says, and every wrong bottle has its one-line why.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFlock, flockTopics, levelOf, SHEEP_MATH } from '../src/missions/sheepmath.js';
import { seeded } from '../src/math/negatives.js';
import { RUNG_IDS } from '../src/lockbox/generate.js';
import { LADDER as TIMES_LADDER } from '../src/math/times.js';
import { LADDER as NEG_LADDER } from '../src/math/negatives.js';

const MINUS = '−';
// what a written sum really comes to: '7 × 8 = 63' -> [56, 63]; '−10 + 18 = −28' -> [8, −28]
const val = (t) => Number(String(t).replace(/−/g, '-'));
function check(item, where) {
  assert.ok(Array.isArray(item.bottles) && item.bottles.length >= 2 && item.bottles.length <= SHEEP_MATH.bottles, `${where}: 2 or 3 bottles`);
  const values = item.bottles.map((b) => b.value);
  assert.equal(new Set(values).size, values.length, `${where}: no bottle twice ${values}`);
  const cures = item.bottles.filter((b) => b.right);
  const shownVal = val(item.shown.split('=').pop());
  if (item.sick) {
    assert.equal(cures.length, 1, `${where}: one cure`);
    assert.equal(cures[0].value, item.answer, `${where}: the cure is the answer`);
    assert.notEqual(shownVal, item.answer, `${where}: a sick sum is wrong`);
    assert.ok(!values.includes(shownVal), `${where}: no bottle says what the sum already says`);
    assert.ok(item.slip, `${where}: a sick sheep names its slip`);
  } else {
    assert.equal(cures.length, 0, `${where}: a healthy sheep has no cure`);
    assert.equal(shownVal, item.answer, `${where}: a healthy sum is right (${item.shown})`);
    assert.ok(!values.includes(item.answer), `${where}: no bottle "fixes" a right sum into itself`);
  }
  for (const b of item.bottles) {
    if (!b.right) assert.ok(typeof b.why === 'string' && b.why.length > 10, `${where}: a why for ${b.label}`);
    assert.ok(/^should be /.test(b.label), `${where}: label ${b.label}`);
    assert.ok(!/-\d/.test(b.label) && !/-\d/.test(item.shown), `${where}: the real minus sign (${b.label}, ${item.shown})`);
  }
  assert.ok(item.fine.startsWith("She's fine"), `${where}: Hob's line for a healthy one`);
  assert.ok(item.healed && item.fixed.includes('='), `${where}: the healed line and the fixed sum`);
}

test('every flock: 6 sheep, 1 or 2 sick, each sum and its bottles sound, at every level', () => {
  const rand = seeded(7);
  const levels = { times: TIMES_LADDER.length, negatives: NEG_LADDER.length, algebra: RUNG_IDS.length };
  for (const topic of Object.keys(levels)) {
    for (let lv = 1; lv <= levels[topic]; lv++) {
      const rider = { topics: { times: { step: lv }, negatives: { step: lv }, algebra: { rung: RUNG_IDS[lv - 1] } } };
      for (let n = 0; n < 25; n++) {
        const F = makeFlock(rider, topic, { rand });
        assert.equal(F.sheep.length, SHEEP_MATH.size);
        const sick = F.sheep.filter((s) => s.sick).length;
        assert.ok(sick >= 1 && sick <= 2, `${topic} ${lv}: ${sick} sick`);
        assert.equal(new Set(F.sheep.map((s) => (s.top || '') + s.fixed)).size, F.sheep.length, `${topic} ${lv}: no sum twice in a flock`);
        F.sheep.forEach((s, i) => check(s, `${topic} level ${lv} sheep ${i} (${s.top ? s.top + ' -> ' : ''}${s.shown})`));
      }
    }
  }
});

test('the times sums: a sick one is one row off; the numbers stay on the kid\'s own tables', () => {
  const rand = seeded(3);
  const rider = { topics: { times: { step: 3 } } };   // the 2s, 10s and 5s up to x5
  for (let n = 0; n < 60; n++) for (const s of makeFlock(rider, 'times', { rand }).sheep) {
    const [a, b] = s.fixed.split('=')[0].split('×').map(Number);
    assert.ok([2, 10, 5].includes(a), `table ${a}`);
    assert.ok(b <= 5, `up to x5: ${s.fixed}`);
    if (s.sick) assert.ok([a * (b + 1), a * (b - 1)].includes(val(s.shown.split('=')[1])), s.shown);
  }
});

test('the positive & negative sums: the wrong way along the line is the most common sickness', () => {
  const rand = seeded(11), count = {};
  const rider = { topics: { negatives: { step: 6 } } };
  for (let n = 0; n < 200; n++) for (const s of makeFlock(rider, 'negatives', { rand }).sheep) if (s.sick) count[s.slip] = (count[s.slip] || 0) + 1;
  assert.ok(count.way > count.sign && count.way > count.drop, JSON.stringify(count));
});

test('solving for x: early rungs only add and take away; a step done to one side only shows up', () => {
  const rand = seeded(5), slips = new Set();
  const early = { topics: { algebra: { rung: 'R1' } } };
  for (let n = 0; n < 60; n++) for (const s of makeFlock(early, 'algebra', { rand }).sheep) {
    assert.ok(/^x [+−] \d+ = −?\d+$/.test(s.top), s.top);
    if (s.sick) slips.add(s.slip);
  }
  assert.ok(slips.has('oneSide') && slips.has('way'), [...slips].join());
  const late = { topics: { algebra: { rung: 'R8' } } };
  let two = 0;
  for (let n = 0; n < 40; n++) for (const s of makeFlock(late, 'algebra', { rand }).sheep) if (/^\dx [+−]/.test(s.top)) two++;
  assert.ok(two > 20, `two-step sums on the later rungs: ${two}`);
});

test('topics and levels from the rider', () => {
  assert.deepEqual(flockTopics({ topicsOn: {} }), ['times']);
  assert.deepEqual(flockTopics({ topicsOn: { negatives: true, algebra: true } }), ['negatives', 'algebra']);
  assert.equal(levelOf({}, 'times'), 1);
  assert.equal(levelOf({ topics: { negatives: { step: 99 } } }, 'negatives'), NEG_LADDER.length);
  assert.equal(levelOf({ topics: { algebra: { rung: 'R6' } } }, 'algebra'), RUNG_IDS.indexOf('R6') + 1);
});
