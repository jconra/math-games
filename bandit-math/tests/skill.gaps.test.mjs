// The skill model (src/math/skill.js) where the material has gaps and edges: Addition and Subtraction between two-digit
// sums (30) and positive & negative (60), a strand placed under its maker's first step, old saves brought over, and the
// smaller rules that keep a level honest (extra credits, slow answers, a summary answer, a teen's easiest lock box).
import test from 'node:test';
import assert from 'node:assert/strict';

const K = await import('../src/math/skill.js');
const A = await import('../src/math/asking.js');
const { SKILL, record, pick, levelOf, isPlaced, seedOf, setLevel, fits, chooseMap, readAloud, migrate, skillOf, probeOf } = K;

const fresh = (extra = {}) => ({ skill: { v: 1, migrated: 1, strands: {} }, ...extra });
const T0 = Date.UTC(2026, 9, 19, 15);
const HOUR = 3600000;
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('the gap: Addition and Subtraction have no material between 30 and 60, and a start worked out elsewhere stops at 30', () => {
  assert.equal(K.runTop('add'), 30);
  assert.equal(K.runTop('sub'), 30);
  assert.equal(K.runTop('number'), K.maxOf('number') - SKILL.TOP_MARGIN, 'counting runs on into the range: no gap');
  assert.equal(K.nextAbove('add', 31), 60);
  assert.equal(K.nextAbove('sub', 31), 68, 'Subtraction\'s own positive & negative cards start at step 3 (strands.js starts)');
  assert.equal(K.startOf('negatives', 'sub'), 68);
  assert.equal(K.startOf('negatives', 'add'), 60);
  // a teen sure of equations (86) meets the round-up: Addition and Subtraction start at two-digit sums, not at 69
  const r = fresh({ age: 15 }); setLevel(r, 'eq', 86);
  assert.deepEqual([seedOf(r, 'add'), seedOf(r, 'sub')], [30, 30]);
  // an old save: a positive & negative topic still on its first climb is read as a baseline from 30; a placed one stays
  const o = { skill: {}, topics: { negatives: { step: 3, placed: false, waves: 4 } } };
  migrate(o);
  assert.deepEqual([levelOf(o, 'add'), isPlaced(o, 'add'), levelOf(o, 'sub')], [30, false, 30]);
  const p = { skill: {}, topics: { negatives: { step: 3, placed: true, waves: 12 } } };
  migrate(p);
  assert.deepEqual([levelOf(p, 'add'), isPlaced(p, 'add')], [68, true]);
});

test('a Subtraction baseline in the gap is never left with nothing to ask it (the stuck state)', () => {
  // (as an old build could leave it: finding at 61.9, under the 62 where positive & negative can lead it)
  const r = fresh({ age: 15 });
  setLevel(r, 'add', 45); setLevel(r, 'sub', 61.9, { placed: false });
  assert.ok(fits(r, 'taking', A.HERD_MAPS), 'the two-digit take-aways serve it (the nearest material below)');
  // positive & negative does not get the "finding" weight for a strand it can't ask
  const R = rng(3), tally = {};
  for (let i = 0; i < 4000; i++) { const m = chooseMap(r, A.HERD_MAPS, { rand: R, now: T0 }); tally[m] = (tally[m] || 0) + 1; }
  assert.ok((tally.taking || 0) > (tally.negatives || 0), JSON.stringify(tally));
  // asked at taking's top (its cap), right twice there: placed at 30
  for (let k = 0; k < 4 && !isPlaced(r, 'sub'); k++) { const q = K.stepFor(r, 'taking'); record(r, 'sub', { right: true, at: q.at }); }
  assert.deepEqual([isPlaced(r, 'sub'), levelOf(r, 'sub')], [true, 30]);
});

test('the gap\'s edge: a miss on the easiest material above the gap counts; three rights running there cross it', () => {
  const r = fresh(); setLevel(r, 'add', 31);
  assert.equal(record(r, 'add', { right: false, at: 60 }).add.moved, -SKILL.DOWN, 'a miss on −3 + 7 brings a kid weak at negatives back down');
  assert.equal(record(r, 'add', { right: false, at: 76 }).add.moved, 0, 'a miss further up, past the edge, is a stretch: nothing');
  const s = fresh(); setLevel(s, 'add', 31);
  record(s, 'add', { right: true, at: 60 }); record(s, 'add', { right: true, at: 60 });
  assert.equal(isPlaced(s, 'add'), true, 'two rights: still placed, +1 each');
  assert.equal(levelOf(s, 'add'), 33);
  const res = record(s, 'add', { right: true, at: 64 }).add;
  assert.equal(res.placed, false, 'the third right running: the gap is crossed and the level above it is looked for');
  assert.equal(pick(s, 'add'), 60 + SKILL.JUMP, 'the climb goes on from the easiest of those rights');
  assert.equal(levelOf(s, 'add'), 60 - SKILL.SETTLE_BELOW);
  // a miss among them breaks the run
  const t = fresh(); setLevel(t, 'add', 31);
  for (const ok of [true, false, true, true]) record(t, 'add', { right: ok, at: 60 });
  assert.equal(isPlaced(t, 'add'), true, 'right, wrong, right, right: no crossing yet');
});

test('a baseline across the gap: one lucky part with negatives in it does not climb Addition past two-digit sums', () => {
  const r = fresh({ age: 15 });
  pick(r, 'add');
  assert.equal(pick(r, 'add'), 30);
  record(r, 'add', { right: true, at: 60 });
  assert.equal(pick(r, 'add'), 30, 'a right on −3 + 7 alone: nothing yet');
  record(r, 'add', { right: false, at: 64 });
  assert.equal(pick(r, 'add'), 30, 'a miss across the gap says nothing about two-digit sums');
  for (let k = 0; k < 3; k++) record(r, 'add', { right: true, at: 60 });
  assert.ok(pick(r, 'add') >= 60 + SKILL.JUMP, `three running: the climb goes on (${pick(r, 'add')})`);
  // a point under the strand's first material is no gap (Multiplication tried at 0: the times tables start at 14)
  const m = fresh(); pick(m, 'mul');
  assert.ok(record(m, 'mul', { right: true, at: 14 }).mul.next > 0);
});

test('a strand placed under its maker\'s gate is tried again later, once the rider\'s other math says it is time', () => {
  const r = fresh({ age: 12 });
  for (const s of ['add', 'sub']) setLevel(r, s, 60, { now: T0 });
  setLevel(r, 'mul', 54, { now: T0 }); setLevel(r, 'div', 50, { now: T0 });
  // three O1 boxes missed: order sinks under its gate (45 - 6)
  for (let k = 0; k < 8 && !isPlaced(r, 'order'); k++) { const q = K.stepFor(r, 'order', { now: T0 }); record(r, 'order', { right: false, at: Math.max(q.at, 45), now: T0 }); }
  for (let k = 0; k < 3; k++) record(r, 'order', { right: false, at: 45, now: T0 });
  assert.ok(isPlaced(r, 'order') && levelOf(r, 'order') < 45 - SKILL.GATE, `order ${levelOf(r, 'order')}`);
  assert.ok(seedOf(r, 'order') >= 45 - SKILL.GATE, 'a new rider with these levels would be offered it');
  assert.equal(fits(r, 'order', ['order', 'pow'], T0 + HOUR), false, 'not straight away');
  assert.equal(fits(r, 'order', ['order', 'pow'], T0 + (SKILL.RECHECK.hours + 1) * HOUR), true, 'the next day');
  // ...or after a good many answers elsewhere
  for (let k = 0; k < SKILL.RECHECK.answers; k++) record(r, 'mul', { right: true, at: 54, now: T0 });
  assert.equal(fits(r, 'order', ['order', 'pow'], T0 + HOUR), true, `after ${SKILL.RECHECK.answers} answers elsewhere`);
  // asked: a short baseline from its first step
  assert.equal(pick(r, 'order', { now: T0 + HOUR }), 45);
  assert.equal(isPlaced(r, 'order'), false);
  // missed twice there again: back under the gate, until the next time
  record(r, 'order', { right: false, at: 45, now: T0 + HOUR }); record(r, 'order', { right: false, at: 45, now: T0 + HOUR });
  assert.equal(isPlaced(r, 'order'), true);
  assert.equal(fits(r, 'order', ['order', 'pow'], T0 + 2 * HOUR), false);
  // a strand put there by setLevel (no answers of the rider's own) is left alone
  const s = fresh({ age: 12 }); setLevel(s, 'mul', 54); setLevel(s, 'order', 30);
  assert.equal(fits(s, 'order', ['order'], T0 + 100 * HOUR), false);
});

test('read-aloud: a level brought over from an old save counts, placed there or not (an old algebra rider is a reader)', () => {
  const r = { skill: {}, topics: { algebra: { rung: 'R11', placing: true, boxes: 30 } } };
  migrate(r);
  assert.equal(isPlaced(r, 'eq'), false);
  assert.ok(levelOf(r, 'eq') >= 70, `eq ${levelOf(r, 'eq')}`);
  assert.equal(readAloud(r), false);
  const y = { skill: {}, topics: { counting: { step: 3, placed: false, waves: 5 } } };
  migrate(y);
  assert.equal(readAloud(y), true, 'an old counting rider low down is still read to');
});

test('extra credits at part weight never move a baseline; a summary answer (tally: false) moves it without counting twice', () => {
  const r = fresh({ age: 10 });
  const p = pick(r, 'mul');
  for (let k = 0; k < 6; k++) record(r, [{ strand: 'words', at: 30 }, { strand: 'mul', at: p, weight: 0.5 }], { right: true });
  assert.equal(pick(r, 'mul'), p, 'six right word problems with a times part: Multiplication not climbed');
  const n = skillOf(r).strands.mul.n;
  record(r, 'mul', { right: true, at: p, tally: false });
  assert.equal(pick(r, 'mul'), p + SKILL.JUMP, 'a whole answer moves it');
  assert.equal(skillOf(r).strands.mul.n, n, '...and a summary answer is not counted again');
});

test('time: after SLOW_RESET slow answers running, the times kept start over and the median follows the kid', () => {
  const r = fresh(); setLevel(r, 'eq', 50);
  for (let k = 0; k < 15; k++) record(r, 'eq', { right: true, sitDown: true, ms: 4000 });
  const outs = [];
  for (let k = 0; k < 12; k++) outs.push(record(r, 'eq', { right: true, sitDown: true, ms: 14000 }).eq.outlier);
  assert.deepEqual(outs.slice(0, SKILL.SLOW_RESET - 1), Array(SKILL.SLOW_RESET - 1).fill(true), 'the first few slow ones are left out');
  assert.ok(outs.slice(SKILL.SLOW_RESET).every((x) => !x), 'then the new pace is the kid\'s pace');
  const t = skillOf(r).strands.eq.t;
  assert.ok(t.length >= 5 && t.every(([ms]) => ms === 14000), JSON.stringify(t));
});

test('a teen\'s lock-box baseline bottoms out at the add-on box (floor), not the youngest\'s coin boxes', () => {
  const r = fresh({ age: 15 });
  setLevel(r, 'eq', 13, { placed: false });
  record(r, 'eq', { right: false, at: 20, floor: 20 });
  record(r, 'eq', { right: false, at: 20, floor: 20 });
  assert.equal(isPlaced(r, 'eq'), true, 'missed twice at its easiest box: placed');
  assert.ok(levelOf(r, 'eq') <= 20 - SKILL.GATE, `eq ${levelOf(r, 'eq')}`);
});

test('the baseline: the missed point answered right twice since is a slip, and the climb goes on (FLUKES)', () => {
  const r = fresh();
  setLevel(r, 'eq', 0, { placed: false });
  record(r, 'eq', { right: false, at: 10 });   // a slip on the very first box (R0a, at 10)
  record(r, 'eq', { right: true, at: 10 });
  record(r, 'eq', { right: true, at: 10 });
  assert.equal(pick(r, 'eq'), 10 + SKILL.JUMP, 'right twice where it slipped: on up');
  assert.equal(SKILL.FLUKES, 2);
});

test('positive & negative: a strand alone past its opening point leads; a plain take-away card counts where taking away has it', () => {
  const r = fresh(); setLevel(r, 'add', 25); setLevel(r, 'sub', 70);
  const q = A.askFor(r, 'negatives');
  assert.equal(q.lead, 'sub', 'Subtraction leads at its own level (Addition, under 30, is not dealt negatives for it)');
  assert.equal(A.plainAt({ shape: 'short', parts: { start: 8, term: 3, op: '-' } }), 5, '8 − 3: taking away up to 10');
  assert.equal(A.plainAt({ shape: 'short', parts: { start: 12, term: 5, op: '-' } }), 19, '12 − 5: past 10');
  assert.equal(A.plainAt({ shape: 'down', parts: { start: -4, term: 5, op: '-' } }), null);
  const qq = { map: 'negatives', step: 3, at: 68, lead: 'sub', strand: 'add' };
  assert.deepEqual(A.travel(qq, { card: { shape: 'short', rung: 3, parts: { start: 9, term: 4, op: '-' } } }), { strands: [{ strand: 'sub', at: 5 }] });
});
