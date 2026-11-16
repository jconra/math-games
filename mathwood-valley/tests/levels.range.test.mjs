// The starting difficulty (skill.js STARTS, model.js THE SEED), the range of levels a place may ask (model.js THE
// RANGE: the levels page's two-handled slider) and KEEP TO THESE LEVELS (adaptive level changes off), with the level
// tool's arrows (src/ui/leveltool.js) that stop at the range's ends. The game's maker, 2026-11-16: "just ask for a
// starting difficulty (Easy, Medium, Hard)", "a range selector ... with a min and max value", "a setting in the menu to
// disable adaptive level changes".
import test from 'node:test';
import assert from 'node:assert/strict';

const M = await import('../src/levels/model.js');
const { PLACE, PLACES, levelFor, recordLevel, skipLevel, stateOf, seedLevel, setRange, rangeOf, setKeep, isKept, setOn, setAllOn, onIds, isOn, levelHere, setLevelAt, isPlaced, levelsOf } = M;
const K = await import('../src/math/skill.js');
const LT = await import('../src/ui/leveltool.js');
const S = await import('../src/save.js');

const T0 = Date.UTC(2026, 10, 16, 15);
const fresh = (extra = {}) => ({ skill: { v: 1, migrated: 1, strands: {} }, ...extra });
const ids = (place) => PLACE[place].levels.map((L) => L.id);
const at = (r, place) => stateOf(r, place).id;
const ix = (place, id) => ids(place).indexOf(id);
const answer = (r, place, right) => { const q = levelFor(r, place, { now: T0 }); return recordLevel(r, place, { right, level: q.id, now: T0 }); };

// ---- the starting difficulty -------------------------------------------------------------------------------------------

test('the starting difficulty: Easy starts every place on its first level; Medium and Hard higher, never lower', () => {
  for (const P of PLACES) {
    const e = ix(P.id, seedLevel(fresh({ start: 'easy' }), P.id));
    const m = ix(P.id, seedLevel(fresh({ start: 'medium' }), P.id));
    const h = ix(P.id, seedLevel(fresh({ start: 'hard' }), P.id));
    assert.equal(e, 0, `${P.id}: Easy starts at the first level`);
    assert.ok(m >= e && h >= m, `${P.id}: easy ${e} <= medium ${m} <= hard ${h}`);
  }
  // (the table in ~/pw/space-math/DIFFICULTY.md)
  const want = {
    roundup: ['x4', 'rule'], lockbox: ['xMul', 'two'], sheep: ['sub2d', 'negUp'], store: ['more', 'multiply'],
    fishing: ['group2', 'times'], range: ['round10', 'dotNeg'], building: ['g1', 'g3'],
  };
  for (const [place, [med, hard]] of Object.entries(want)) {
    assert.equal(seedLevel(fresh({ start: 'medium' }), place), med, `${place}: Medium`);
    assert.equal(seedLevel(fresh({ start: 'hard' }), place), hard, `${place}: Hard`);
  }
});

test('the starting difficulty: a Hard start stops at the first level it does not cover; an older save\'s age passes over as before', () => {
  // the round-up's fractions (grades 34-52) come after its negatives (61-66): Hard (60) stops at the two-step rules
  assert.equal(seedLevel(fresh({ start: 'hard' }), 'roundup'), 'rule');
  // the deer job's equations (grades 20-32) come after its times and leftovers (40-45): Medium stops before them...
  assert.equal(seedLevel(fresh({ start: 'medium' }), 'deer'), 'ten');
  // ...while an age of 15 (a head start of 33) passes over, as it always has
  assert.equal(seedLevel(fresh({ age: 15 }), 'deer'), 'xMul');
  assert.equal(seedLevel(fresh({ age: 15 }), 'sheep'), 'add3', 'an older save keeps its age\'s start');
});

test('the starting difficulty: the rider\'s own answers beat it, both ways', () => {
  const low = fresh({ start: 'hard' });
  K.setLevel(low, 'mul', 30, { now: T0 });
  assert.equal(seedLevel(low, 'roundup'), 'x4', 'times shown at 30: the times levels stop at the 4s (25), whatever Hard says');
  const high = fresh({ start: 'easy' });
  K.setLevel(high, 'mul', 45, { now: T0 });
  assert.equal(seedLevel(high, 'roundup'), 'x7', 'times shown at 45: up to the 7s (40) on an Easy start');
});

test('the starting difficulty: the head start, the read-aloud and a save\'s clean-up', () => {
  assert.deepEqual(K.STARTS.map((s) => [s.id, s.points]), [['easy', 0], ['medium', 30], ['hard', 60]]);
  assert.equal(K.headStart(fresh({ start: 'hard' })), 60);
  assert.equal(K.headStart(fresh({ start: 'medium', age: 6 })), 30, 'a starting difficulty replaces an age');
  assert.equal(K.headStart(fresh({ age: 10 })), K.ageStart(10), 'an older save: the age\'s head start');
  assert.equal(K.headStart(fresh()), 0);
  assert.equal(K.headStart(fresh({ start: 'nonsense' })), 0);
  assert.equal(K.difficultyOf(fresh({ start: 'medium' })), 'medium');
  assert.equal(K.difficultyOf(fresh({ start: 'x' })), null);
  // read aloud "by itself": an Easy start with young levels is read to; Medium and Hard aren't; an age of 6 still is
  assert.equal(K.readAloud(fresh({ readAloud: true, start: 'easy' })), true);
  assert.equal(K.readAloud(fresh({ readAloud: true, start: 'medium' })), false);
  assert.equal(K.readAloud(fresh({ readAloud: true, age: 6 })), true);
  assert.equal(K.readAloud(fresh({ readAloud: true, age: 6, start: 'hard' })), false, 'the starting difficulty wins');
  // the saved field survives a save's clean-up; a bad one is dropped; an older save has none
  assert.equal(S.fixRider({ name: 'A', start: 'hard' }).start, 'hard');
  assert.equal('start' in S.fixRider({ name: 'B', start: 'impossible' }), false);
  assert.equal('start' in S.fixRider({ name: 'C', age: 9 }), false);
  assert.equal(S.fixRider({ name: 'C', age: 9 }).age, 9, 'an older save keeps its age');
});

// ---- the range ------------------------------------------------------------------------------------------------------------

test('the range: placement and the staircase stay inside it; a start below it begins at its easiest level', () => {
  const r = fresh();
  assert.equal(setRange(r, 'roundup', 'x2', 'x3', { now: T0 }), true);
  assert.deepEqual(onIds(r, 'roundup'), ['x2', 'x10', 'x5', 'x3']);
  assert.equal(levelFor(r, 'roundup', { now: T0 }).id, 'x2', 'the first level (seed) is below the range: its easiest');
  for (let k = 0; k < 40; k++) answer(r, 'roundup', true);
  assert.equal(at(r, 'roundup'), 'x3', 'right every time: up to the hardest level in the range, never past it');
  for (let k = 0; k < 40; k++) answer(r, 'roundup', false);
  assert.equal(at(r, 'roundup'), 'x2', 'wrong every time: down to the easiest, never under it');
  assert.equal(isOn(r, 'roundup', 'x9'), false); assert.equal(isOn(r, 'roundup', 'x5'), true);
});

test('the range: a rider above it is brought to its hardest level; one level (min = max) asks only that level', () => {
  const r = fresh();
  setLevelAt(r, 'sheep', 'add3', { now: T0 });
  setRange(r, 'sheep', 'add10', 'add20', { now: T0 });
  assert.equal(levelFor(r, 'sheep', { now: T0 }).id, 'add20');
  setRange(r, 'sheep', 'carry', 'carry', { now: T0 });
  for (let k = 0; k < 12; k++) { assert.equal(levelFor(r, 'sheep', { now: T0 }).id, 'carry'); answer(r, 'sheep', k % 3 !== 0); }
  assert.deepEqual(rangeOf(r, 'sheep'), { lo: ix('sheep', 'carry'), hi: ix('sheep', 'carry'), loId: 'carry', hiId: 'carry', n: ids('sheep').length, full: false, holes: [], keep: false });
});

test('the range: setting it brings back levels skipped one at a time; every level on opens the whole ladder', () => {
  const r = fresh();
  setOn(r, 'fishing', 'same', false, { now: T0 });
  setOn(r, 'fishing', 'keep', false, { now: T0 });
  assert.deepEqual(rangeOf(r, 'fishing').holes, ['same', 'keep'], 'an older save\'s ticks: holes inside the whole ladder');
  setRange(r, 'fishing', 'word', 'add', { now: T0 });
  assert.deepEqual(rangeOf(r, 'fishing').holes, [], 'the range is the whole setting now');
  assert.equal(isOn(r, 'fishing', 'same'), true);
  assert.equal(setAllOn(r, 'fishing'), true);
  assert.equal(rangeOf(r, 'fishing').full, true);
  assert.equal(setAllOn(r, 'fishing'), false, 'nothing left to change');
  assert.equal(setRange(r, 'fishing', 'nope', 'add', { now: T0 }), false, 'an unknown level: nothing changes');
  assert.equal(setRange(r, 'fishing', 'add', 'word', { now: T0 }), true, 'either order');
  assert.deepEqual([rangeOf(r, 'fishing').loId, rangeOf(r, 'fishing').hiId], ['word', 'add']);
});

test('the range: kept as level ids, so it survives a reload and a ladder edited later; its own ends are left out', () => {
  const r = fresh();
  setRange(r, 'pigs', 'eo10', 'half', { now: T0 });
  const back = JSON.parse(JSON.stringify(r));
  levelsOf(back);
  assert.deepEqual([rangeOf(back, 'pigs').loId, rangeOf(back, 'pigs').hiId], ['eo10', 'half']);
  // the whole ladder dragged out: nothing kept (a level added at the top later is in the range)
  setRange(r, 'pigs', ids('pigs')[0], ids('pigs').at(-1), { now: T0 });
  assert.equal('lo' in stateOf(r, 'pigs') || 'hi' in stateOf(r, 'pigs'), false);
  // a level id the ladder no longer has: that end opens
  const old = fresh({ levels: { v: 1, migrated: 1, places: { pigs: { id: 'lt5', lo: 'gone', hi: 'half', placed: false } } } });
  levelsOf(old);
  assert.deepEqual([rangeOf(old, 'pigs').lo, rangeOf(old, 'pigs').hiId], [0, 'half']);
  // the save's clean-up keeps it
  const saved = S.fixRider(JSON.parse(JSON.stringify({ name: 'R', ...r, levels: back.levels })));
  assert.deepEqual([rangeOf(saved, 'pigs').loId, rangeOf(saved, 'pigs').hiId], ['eo10', 'half']);
});

test('the range: the level tool\'s arrows stop at its ends; a level skipped inside it is switched on by stepping onto it', () => {
  const r = fresh();
  setRange(r, 'wagon', 'g5', 'g9', { now: T0 });
  let v = LT.levelTool(r, 'wagon');
  assert.deepEqual([v.id, v.lo, v.hi, v.canDown, v.canUp], ['g5', ix('wagon', 'g5'), ix('wagon', 'g9'), false, true], 'not met yet: shown at the range\'s easiest');
  assert.equal(LT.stepLevel(r, 'wagon', -1), null, 'nothing below the range');
  v = LT.stepLevel(r, 'wagon', +1); assert.equal(v.id, 'g3');
  v = LT.stepLevel(r, 'wagon', +1); v = LT.stepLevel(r, 'wagon', +1);
  assert.equal(v.id, 'g9'); assert.equal(v.canUp, false);
  assert.equal(LT.stepLevel(r, 'wagon', +1), null, 'nothing above the range');
  assert.equal(levelFor(r, 'wagon', { now: T0 }).id, 'g9');
  // an older save's hole inside the range: stepping onto it switches it on, as it always did
  setOn(r, 'wagon', 'g4', false, { now: T0 });
  v = LT.stepLevel(r, 'wagon', -1);
  assert.equal(v.id, 'g4'); assert.equal(isOn(r, 'wagon', 'g4'), true);
});

// ---- keep to these levels --------------------------------------------------------------------------------------------------

test('keep to these levels: the level never moves by itself, right or wrong; the answers are still counted', () => {
  const r = fresh({ start: 'medium' });
  setRange(r, 'sheep', 'add20', 'subTens', { now: T0 });
  assert.equal(setKeep(r, 'sheep', true, { now: T0 }), true);
  assert.equal(isKept(r, 'sheep'), true);
  let q = levelFor(r, 'sheep', { now: T0 });
  assert.deepEqual([q.id, q.kept, q.placing], ['subTens', true, false], 'Medium starts above the range: at its hardest level, not finding a level');
  for (let k = 0; k < 25; k++) { const res = answer(r, 'sheep', true); assert.equal(res.moved, 0); }
  assert.equal(at(r, 'sheep'), 'subTens');
  for (let k = 0; k < 25; k++) answer(r, 'sheep', false);
  assert.equal(at(r, 'sheep'), 'subTens', 'twenty-five misses: still there');
  const s = stateOf(r, 'sheep');
  assert.deepEqual([s.n, s.r], [50, 25], 'every answer counted');
  assert.equal(isPlaced(r, 'sheep'), false, 'no placement ran: it waits for keep to be turned off');
  // the arrows still step it, inside the range
  let v = LT.levelTool(r, 'sheep');
  assert.deepEqual([v.kept, v.fill, v.canUp, v.canDown], [true, 0, false, true]);
  assert.match(v.note, /Kept to levels 8 to 12: the game doesn't move you up or down; the arrows do/);
  v = LT.stepLevel(r, 'sheep', -1); assert.equal(v.id, 'addTens');
  for (let k = 0; k < 10; k++) answer(r, 'sheep', true);
  assert.equal(at(r, 'sheep'), 'addTens', 'kept where the arrow put it');
  // turned off: the game moves it again (the staircase, the arrow having placed it)
  assert.equal(setKeep(r, 'sheep', false, { now: T0 }), true);
  for (let k = 0; k < 5; k++) answer(r, 'sheep', true);
  assert.equal(at(r, 'sheep'), 'subTens', 'five right: up a level');
  q = levelFor(r, 'sheep', { now: T0 }); assert.equal(q.kept, false);
});

test('keep to these levels: with the whole ladder, the rider just stays on their level; a skip deals one easier question and stays', () => {
  const r = fresh();
  setLevelAt(r, 'range', 'place2', { now: T0 });
  setKeep(r, 'range', true, { now: T0 });
  for (let k = 0; k < 12; k++) answer(r, 'range', true);
  assert.equal(at(r, 'range'), 'place2');
  const sk = skipLevel(r, 'range', { now: T0 });
  assert.equal(sk.moved, 0); assert.equal(at(r, 'range'), 'place2');
  const q = levelFor(r, 'range', { now: T0 });
  assert.deepEqual([q.id, q.eased], ['order50', true], 'one question from the level below');
  answer(r, 'range', true);
  assert.equal(levelFor(r, 'range', { now: T0 }).id, 'place2', 'then back on the level kept');
  // at the bottom of the range there is nothing easier
  setRange(r, 'range', 'place2', 'round10', { now: T0 });
  skipLevel(r, 'range', { now: T0 });
  assert.equal(levelFor(r, 'range', { now: T0 }).eased, false);
  // and it survives a reload
  const back = S.fixRider(JSON.parse(JSON.stringify({ name: 'K', ...r })));
  assert.equal(isKept(back, 'range'), true);
});

test('the slider\'s sums (shared/levelrange.js): a spot on the track, the handles never crossing, the keys, the words', async () => {
  const R = await import('../../shared/levelrange.js');
  assert.equal(R.valueAt(0, 41), 0); assert.equal(R.valueAt(1, 41), 40); assert.equal(R.valueAt(0.5, 41), 20);
  assert.equal(R.valueAt(-3, 41), 0); assert.equal(R.valueAt(9, 41), 40); assert.equal(R.valueAt(0.7, 1), 0);
  assert.deepEqual(R.pairWith(5, 12, 'lo', 20), [12, 12], 'the easiest handle stops at the hardest (they meet)');
  assert.deepEqual(R.pairWith(5, 12, 'hi', 2), [5, 5], 'and the hardest at the easiest');
  assert.deepEqual(R.pairWith(5, 12, 'lo', 7), [7, 12]);
  assert.equal(R.keyMove('ArrowRight', 41, 5, 12, 'lo'), 6);
  assert.equal(R.keyMove('ArrowDown', 41, 5, 12, 'hi'), 11);
  assert.equal(R.keyMove('PageUp', 41, 5, 12, 'hi'), 16, 'a tenth of the ladder');
  assert.equal(R.keyMove('End', 41, 5, 12, 'lo'), 12, 'as far as it goes: the other handle');
  assert.equal(R.keyMove('Home', 41, 5, 12, 'hi'), 5);
  assert.equal(R.keyMove('Home', 41, 5, 12, 'lo'), 0);
  assert.equal(R.keyMove('a', 41, 5, 12, 'lo'), null);
  assert.equal(R.rangeWords(0, 40, 41), 'All 41 levels');
  assert.equal(R.rangeWords(4, 11, 41), 'Levels 5 to 12 of 41');
  assert.equal(R.rangeWords(4, 4, 41), 'Only level 5 of 41');
});

test('levelHere: the level the next question comes from, without meeting the place', () => {
  const r = fresh({ start: 'hard' });
  assert.equal(levelHere(r, 'lockbox'), 'two');
  assert.equal(stateOf(r, 'lockbox'), null, 'not met');
  setLevelAt(r, 'lockbox', 'both', { now: T0 });
  setRange(r, 'lockbox', 'xMul', 'twoNeg', { now: T0 });
  assert.equal(levelHere(r, 'lockbox'), 'twoNeg', 'brought into the range');
  assert.equal(at(r, 'lockbox'), 'both', 'nothing moved yet');
});
