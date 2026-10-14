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

// A sum over a sheep is read the plain way: the number after = is the answer. So a sick sum's slip must be that number
// (the bottle changes it), and no "wrong" bottle may make the sum shown true when it takes that place. A missing number
// written with the slip in the middle broke both ("5 + 8 = 8": the cure was 5 + 3 = 8, and "should be 13" made it true).
test('every sum over a sheep: the slip and the bottles are the number after =, and no wrong bottle makes it true', async () => {
  const { LADDER: COUNT } = await import('../src/math/counting.js');
  const { LADDER: ADD } = await import('../src/math/adding.js');
  const { LADDER: TAKE } = await import('../src/math/taking.js');
  const { LADDER: DIV } = await import('../src/math/dividing.js');
  const plain = (t) => String(t).replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  const SUM = /^(-?\d+) ([+\-*/]) (-?\d+) = (-?\d+)$/;
  const ops = { '+': (x, y) => x + y, '-': (x, y) => x - y, '*': (x, y) => x * y, '/': (x, y) => x / y };
  const levels = { counting: COUNT.length, adding: ADD.length, taking: TAKE.length, times: TIMES_LADDER.length, dividing: DIV.length, negatives: NEG_LADDER.length };
  const rand = seeded(29);
  for (const [topic, top] of Object.entries(levels)) {
    let sums = 0;
    for (let lv = 1; lv <= top; lv++) {
      const rider = { topicsOn: { [topic]: true }, topics: { [topic]: { step: lv, placed: true } } };
      for (let n = 0; n < 60; n++) for (const s of makeFlock(rider, topic, { rand }).sheep) {
        const a = plain(s.shown).match(SUM), f = plain(s.fixed).match(SUM);
        if (!a || !f) continue;
        sums++;
        const where = `${topic} ${lv}: "${s.shown}" (${s.bottles.map((b) => b.label + (b.right ? '*' : '')).join(' / ')})`;
        assert.equal(`${a[1]} ${a[2]} ${a[3]}`, `${f[1]} ${f[2]} ${f[3]}`, `${where}: only the number after = is ever wrong`);
        const truth = ops[a[2]](+a[1], +a[3]);
        assert.equal(truth, +f[4], `${where}: the fixed sum is true`);
        for (const b of s.bottles) if (!b.right) assert.notEqual(+plain(b.value), truth, `${where}: a wrong bottle makes the sum true`);
      }
    }
    if (topic !== 'counting') assert.ok(sums > 100, `${topic}: sums were checked (${sums})`);
  }
});
