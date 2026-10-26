// The levels (src/levels/model.js): placement one level at a time, the 80% staircase in each level's count, the
// fast rule (only from a place's fastFrom), switched-off levels, "start here", the seed from the rider's other math,
// moving old riders onto the ladders (real saves from before the skill model: tests/fixtures/old-riders.json), and
// save.js recordAnswer feeding a place and its strand at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const M = await import('../src/levels/model.js');
const { LEVELS, PLACE, levelFor, recordLevel, isPlaced, stateOf, pctOf, setOn, isOn, onIds, setAllOn, startHere, seedLevel, placeStats, migrate, setLevelAt, levelPct, placeMost } = M;
const S = await import('../src/save.js');
const K = await import('../src/math/skill.js');
const { seeded } = await import('../src/levels/kit.js');

const T0 = Date.UTC(2026, 9, 21, 15);
const fresh = (extra = {}) => ({ skill: { v: 1, migrated: 1, strands: {} }, ...extra });
const ids = (place) => PLACE[place].levels.map((L) => L.id);
const at = (r, place) => stateOf(r, place).id;
const answer = (r, place, right, extra = {}) => { const q = levelFor(r, place, { now: T0 }); return recordLevel(r, place, { right, level: q.id, now: T0, ...extra }); };

// ---- placement ------------------------------------------------------------------------------------------------------

test('placement: a new rider with no age starts on the first level and climbs ONE level per right answer', () => {
  const r = fresh();
  const L = ids('lockbox');
  assert.equal(levelFor(r, 'lockbox', { now: T0 }).id, L[0]);
  assert.equal(levelFor(r, 'lockbox', { now: T0 }).placing, true);
  for (let k = 1; k <= 6; k++) {
    answer(r, 'lockbox', true);
    assert.equal(at(r, 'lockbox'), L[k], `after ${k} right answers the rider is on level ${k + 1}, never further`);
  }
  assert.equal(isPlaced(r, 'lockbox'), false);
});

test('placement: a miss is checked (the level asked again); missed twice, the rider settles on the highest level answered right', () => {
  const r = fresh();
  const L = ids('roundup');
  for (let k = 0; k < 4; k++) answer(r, 'roundup', true);   // levels 1..4 right; now trying level 5
  assert.equal(at(r, 'roundup'), L[4]);
  answer(r, 'roundup', false);
  assert.equal(at(r, 'roundup'), L[4], 'the missed level is asked once more');
  assert.equal(isPlaced(r, 'roundup'), false);
  const res = answer(r, 'roundup', false);
  assert.equal(isPlaced(r, 'roundup'), true);
  assert.equal(res.justPlaced, true);
  assert.equal(at(r, 'roundup'), L[3], 'settled on the highest level answered right');
  assert.equal(stateOf(r, 'roundup').into, 0, 'at its start');
});

test('placement: a slip (the check answered right) lets the climb go on once; the next slip settles', () => {
  const r = fresh();
  const L = ids('wagon');
  answer(r, 'wagon', true); answer(r, 'wagon', true);   // on level 3
  answer(r, 'wagon', false); answer(r, 'wagon', true);  // slip forgiven: on to level 4
  assert.equal(at(r, 'wagon'), L[3]);
  answer(r, 'wagon', true);                              // level 5
  answer(r, 'wagon', false); answer(r, 'wagon', true);  // a second slip, nothing left to forgive
  assert.equal(isPlaced(r, 'wagon'), true);
  assert.equal(at(r, 'wagon'), L[3], 'settles on the highest level answered right before it');
});

test('placement: the very first level missed twice goes down a level at a time; right twice running settles there', () => {
  const r = fresh({ age: 15 });   // the age starts the lock boxes up the ladder
  const start = levelFor(r, 'lockbox', { now: T0 }).i;
  assert.ok(start >= 4, 'a 15-year-old starts above the first levels (' + start + ')');
  answer(r, 'lockbox', false); answer(r, 'lockbox', false);
  assert.equal(levelFor(r, 'lockbox', { now: T0 }).i, start - 1);
  answer(r, 'lockbox', false);
  assert.equal(levelFor(r, 'lockbox', { now: T0 }).i, start - 2);
  answer(r, 'lockbox', true);
  assert.equal(isPlaced(r, 'lockbox'), false, 'one right on the way down is asked again');
  answer(r, 'lockbox', true);
  assert.equal(isPlaced(r, 'lockbox'), true);
  assert.equal(levelFor(r, 'lockbox', { now: T0 }).i, start - 2);
});

test('placement: the lowest level missed twice settles there; the top answered right settles at the top', () => {
  const r = fresh();
  answer(r, 'pigs', false); answer(r, 'pigs', false);
  assert.equal(isPlaced(r, 'pigs'), true);
  assert.equal(at(r, 'pigs'), ids('pigs')[0]);
  const t = fresh();
  for (let k = 0; k < ids('deliveries').length; k++) answer(t, 'deliveries', true);
  assert.equal(isPlaced(t, 'deliveries'), true);
  assert.equal(at(t, 'deliveries'), ids('deliveries').at(-1));
});

test('placement: an answer from another level (a warm-up) does not move it; it ends after PLACE_MOST answers at most', () => {
  const r = fresh();
  answer(r, 'sheep', true); answer(r, 'sheep', true);
  recordLevel(r, 'sheep', { right: true, level: ids('sheep')[0], now: T0 });
  assert.equal(at(r, 'sheep'), ids('sheep')[2]);
  const u = fresh();
  for (let k = 0; k < 200 && !isPlaced(u, 'roundup'); k++) recordLevel(u, 'roundup', { right: true, level: ids('roundup')[0], now: T0 });
  assert.equal(isPlaced(u, 'roundup'), true);
  assert.ok(stateOf(u, 'roundup').n <= placeMost(PLACE.roundup));
  assert.ok(placeMost(PLACE.roundup) >= PLACE.roundup.levels.length);   // (a kid right every time can climb the whole ladder)
});

// ---- the staircase -----------------------------------------------------------------------------------------------------

test('after placement: a level takes its count of right answers (5, then 10 on the lock boxes from x on both sides)', () => {
  const r = fresh();
  startHere(r, 'lockbox', 'whatAdd', { now: T0 });
  const per = {};
  let last = at(r, 'lockbox'), c = 0;
  for (let k = 0; k < 400 && at(r, 'lockbox') !== 'vault'; k++) {
    answer(r, 'lockbox', true); c++;
    if (at(r, 'lockbox') !== last) { per[last] = c; c = 0; last = at(r, 'lockbox'); }
  }
  assert.equal(per.whatAdd, 5); assert.equal(per.whatSub, 5); assert.equal(per.x10, 5); assert.equal(per.twoNeg, 5);
  assert.equal(per.both, 10); assert.equal(per.bothMul, 10); assert.equal(per.paren, 10);
});

test('after placement: a miss takes 4 off; under 0 the rider goes back a level, that many short of its end', () => {
  const r = fresh();
  setLevelAt(r, 'sheep', 'add20', { into: 1, now: T0 });
  answer(r, 'sheep', false);
  assert.equal(at(r, 'sheep'), 'doubles');
  assert.equal(stateOf(r, 'sheep').into, 2, '1 - 4 = -3: two into the 5 of the level before');
  for (let k = 0; k < 3; k++) answer(r, 'sheep', true);
  assert.equal(at(r, 'sheep'), 'add20', 'three right and back up');
  setLevelAt(r, 'sheep', 'add2', { into: 0, now: T0 });
  answer(r, 'sheep', false);
  assert.equal(at(r, 'sheep'), 'add2'); assert.equal(stateOf(r, 'sheep').into, 0, 'never under the first level');
});

test('after placement: a right below the level does not move it; a miss far below counts less; a stretch miss does not pull down', () => {
  const r = fresh();
  setLevelAt(r, 'range', 'estMore', { into: 2, now: T0 });
  recordLevel(r, 'range', { right: true, level: 'big10', now: T0 });
  assert.deepEqual([at(r, 'range'), stateOf(r, 'range').into], ['estMore', 2]);
  recordLevel(r, 'range', { right: false, level: 'orderNeg5', now: T0 });
  assert.deepEqual([at(r, 'range'), stateOf(r, 'range').into], ['estMore', 2]);
  recordLevel(r, 'range', { right: false, level: 'big10', now: T0 });   // far below: a quarter
  assert.equal(stateOf(r, 'range').into, 1);
  recordLevel(r, 'range', { right: false, level: 'round100', now: T0 });  // one below: in full
  assert.equal(at(r, 'range'), 'round100');
});

test('the staircase settles near 80% right: simulated kids, 3 seed sets', () => {
  const p = (i, th) => 0.25 + 0.72 / (1 + Math.exp((i - th) / 0.9));
  for (const place of ['roundup', 'lockbox', 'fishing']) {
    for (const seed of [11, 22, 33]) {
      const rand = seeded(seed);
      let ok = 0, all = 0;
      for (let kid = 0; kid < 40; kid++) {
        const r = fresh(), th = 3 + rand() * (PLACE[place].levels.length - 6);
        for (let k = 0; k < 260; k++) {
          const q = levelFor(r, place, { now: T0 });
          const g = rand() < p(q.i, th);
          recordLevel(r, place, { right: g, level: q.id, now: T0 });
          if (k >= 60) { ok += g; all++; }
        }
      }
      const pct = (100 * ok) / all;
      assert.ok(pct > 76 && pct < 84, `${place} seed ${seed}: ${pct.toFixed(1)}%`);
    }
  }
});

test('fast answers count double only from the place fastFrom level (the lock boxes: x on both sides), never on the early levels', () => {
  const timed = (r, place, level) => { for (let k = 0; k < 6; k++) recordLevel(r, place, { right: true, level, sitDown: true, ms: 10000, now: T0 }); };
  const r = fresh();
  setLevelAt(r, 'lockbox', 'two', { now: T0 });
  timed(r, 'lockbox', 'two');   // (builds the rider's usual time here; moves them on)
  setLevelAt(r, 'lockbox', 'two', { now: T0 });
  const a = recordLevel(r, 'lockbox', { right: true, level: 'two', sitDown: true, ms: 3000, now: T0 });
  assert.equal(a.fast, false, 'two steps sits below x on both sides');
  assert.equal(stateOf(r, 'lockbox').into, 1);
  setLevelAt(r, 'lockbox', 'bothMul', { now: T0 });
  const b = recordLevel(r, 'lockbox', { right: true, level: 'bothMul', sitDown: true, ms: 3000, now: T0 });
  assert.equal(b.fast, true);
  assert.equal(stateOf(r, 'lockbox').into, 2, 'counts double');
  const f = fresh();
  setLevelAt(f, 'fishing', 'mixed', { now: T0 });
  timed(f, 'fishing', 'mixed');
  setLevelAt(f, 'fishing', 'mixed', { now: T0 });
  assert.equal(recordLevel(f, 'fishing', { right: true, level: 'mixed', sitDown: true, ms: 2000, now: T0 }).fast, false, 'fishing: never');
});

// ---- toggles and "start here" ----------------------------------------------------------------------------------------

test('toggles: switched-off levels are skipped by placement and by the staircase; the last level on cannot go off', () => {
  const r = fresh();
  assert.equal(setOn(r, 'roundup', 'by1', false, { now: T0 }), true);
  assert.equal(setOn(r, 'roundup', 'by1b', false, { now: T0 }), true);
  assert.equal(isOn(r, 'roundup', 'by1b'), false);
  answer(r, 'roundup', true);
  assert.equal(at(r, 'roundup'), 'tens1', 'placement steps over the levels switched off');
  const s = fresh();
  setLevelAt(s, 'roundup', 'c1end', { now: T0 });
  setOn(s, 'roundup', 'by1', false, { now: T0 });
  for (let k = 0; k < 5; k++) answer(s, 'roundup', true);
  assert.equal(at(s, 'roundup'), 'by1b', 'the staircase steps over them too');
  answer(s, 'roundup', false);
  assert.equal(at(s, 'roundup'), 'c1end', 'and on the way down');
  const one = fresh();
  for (const id of ids('deliveries').slice(1)) assert.equal(setOn(one, 'deliveries', id, false, { now: T0 }), true);
  assert.equal(setOn(one, 'deliveries', 'small', false, { now: T0 }), false, 'the last level that is on stays on');
  assert.deepEqual(onIds(one, 'deliveries'), ['small']);
  for (let k = 0; k < 10; k++) answer(one, 'deliveries', true);
  assert.equal(at(one, 'deliveries'), 'small', 'with one level on, every question is from it');
  assert.equal(setAllOn(one, 'deliveries'), true);
  assert.equal(onIds(one, 'deliveries').length, ids('deliveries').length);
});

test('toggles: switching off the level the rider is on moves the next question to the nearest level on (below first)', () => {
  const r = fresh();
  setLevelAt(r, 'fishing', 'add', { now: T0 });
  setOn(r, 'fishing', 'add', false, { now: T0 });
  assert.equal(levelFor(r, 'fishing', { now: T0 }).id, 'keep8');
  setOn(r, 'fishing', 'slices', false, { now: T0 });
  setLevelAt(r, 'fishing', 'slices', { now: T0 });
  assert.equal(levelFor(r, 'fishing', { now: T0 }).id, 'slices8', 'nothing on below: the nearest above');
});

test('start here: the rider goes straight to that level, placed (placement over), switched on if it was off', () => {
  const r = fresh();
  levelFor(r, 'lockbox', { now: T0 });
  assert.equal(isPlaced(r, 'lockbox'), false);
  setOn(r, 'lockbox', 'both', false, { now: T0 });
  assert.equal(startHere(r, 'lockbox', 'both', { now: T0 }), true);
  assert.equal(isPlaced(r, 'lockbox'), true);
  assert.equal(isOn(r, 'lockbox', 'both'), true);
  assert.equal(levelFor(r, 'lockbox', { now: T0 }).id, 'both');
  assert.equal(stateOf(r, 'lockbox').start, 'both');
  assert.equal(startHere(r, 'lockbox', 'nope', { now: T0 }), false);
});

test('most: a job that stops lower (the windmill at 7) asks that level, and a placement there settles at it', () => {
  const r = fresh();
  setLevelAt(r, 'building', 'g8', { now: T0 });
  const q = levelFor(r, 'building', { now: T0, most: 'g7' });
  assert.deepEqual([q.id, q.capped], ['g7', true]);
  recordLevel(r, 'building', { right: true, level: 'g7', now: T0 });
  assert.equal(at(r, 'building'), 'g8', 'a right below the level is no news');
  const p = fresh();
  setLevelAt(p, 'building', 'g6', { placed: false, now: T0 });
  recordLevel(p, 'building', { right: true, level: levelFor(p, 'building', { now: T0, most: 'g7' }).id, now: T0 });
  recordLevel(p, 'building', { right: true, level: levelFor(p, 'building', { now: T0, most: 'g7' }).id, now: T0 });
  assert.equal(isPlaced(p, 'building'), true);
  assert.equal(at(p, 'building'), 'g7');
});

// ---- the seed and the %s ---------------------------------------------------------------------------------------------

test('the seed: from the rider’s own strands (a few points under), else the age, else the first level', () => {
  const r = fresh();
  assert.equal(seedLevel(r, 'lockbox'), 'whatAdd');
  K.setLevel(r, 'eq', 60, { now: T0 });
  assert.equal(seedLevel(r, 'lockbox'), 'xBig', 'equations 60: bigger numbers (50); two steps (56) is less than 5 under');
  K.setLevel(r, 'eq', 62, { now: T0 });
  assert.equal(seedLevel(r, 'lockbox'), 'two');
  K.setLevel(r, 'mul', 45, { now: T0 });
  assert.equal(seedLevel(r, 'wagon'), 'g8', 'times 45: the 8-Gang (37); the 7-Gang (41) is less than 5 under');
  assert.equal(seedLevel(r, 'roundup'), 'x7', 'the counting levels (strand not met) are passed over; the series up to the 7s (40)');
  const teen = fresh({ age: 15 });
  assert.equal(seedLevel(teen, 'sheep'), 'add3', 'the age covers grades up to its head start (33)');
});

test('the %: how far up its ladder; placeStats lists the places met', () => {
  const r = fresh();
  assert.equal(pctOf(r, 'loot'), null);
  setLevelAt(r, 'loot', 'rem', { into: 0, now: T0 });
  assert.equal(pctOf(r, 'loot'), Math.round((100 * 6) / 11));
  assert.equal(levelPct('loot', 'two'), 0);
  setLevelAt(r, 'loot', 'rule3', { into: 5, now: T0 });
  assert.equal(pctOf(r, 'loot'), 100);
  answer(r, 'loot', true);
  const st = placeStats(r);
  assert.equal(st.length, 1);
  assert.equal(st[0].place, 'loot'); assert.equal(st[0].title, PLACE.loot.levels.at(-1).title);
  assert.equal(placeStats(r, { all: true }).length, M.PLACES.length);
});

test('a saved place survives a ladder edited later: an unknown level id goes to the nearest level by grade', () => {
  const r = fresh();
  r.levels = { v: 1, migrated: 1, places: { lockbox: { id: 'gone', g: 57, s: 'eq', into: 3, placed: true } } };
  M.levelsOf(r);
  assert.equal(at(r, 'lockbox'), 'two');
  assert.equal(stateOf(r, 'lockbox').into, 3);
});

// ---- old riders -------------------------------------------------------------------------------------------------------

const OLD = JSON.parse(readFileSync(new URL('./fixtures/old-riders.json', import.meta.url), 'utf8')).riders;

test('old riders (saved before the skill model) are moved onto the ladders near the same school year', () => {
  const a = S.fixRider(structuredClone(OLD[0]));   // times placed at the 9s and 11s, adding into the negatives, lock boxes R6
  const lv = (p) => a.levels.places[p] && [a.levels.places[p].id, a.levels.places[p].placed];
  assert.equal(a.levels.migrated, 1);
  assert.deepEqual(lv('lockbox'), ['two', true], 'two steps, as the old R6');
  assert.deepEqual(lv('roundup'), ['herdB', true], 'times 33: the series through the 9s (31) and their tier\'s herd (32), not the 6s (34)');
  assert.deepEqual(lv('wagon'), ['g9', true]);
  assert.deepEqual(lv('sheep'), ['negDown', true], 'adding and taking away placed in the negatives');
  assert.equal(lv('fishing'), undefined, 'no fractions shown: met fresh later');
  for (const [p, s] of Object.entries(a.levels.places)) {
    const L = PLACE[p].levels.find((x) => x.id === s.id);
    const st = a.skill.strands[L.strand];
    assert.ok(st && st.level + 0.05 >= L.grade, `${p}: ${L.id} (${L.strand} ${L.grade}) is at or under the old level ${st && st.level}`);
    const next = PLACE[p].levels[PLACE[p].levels.indexOf(L) + 1];
    if (next && a.skill.strands[next.strand]) assert.ok(a.skill.strands[next.strand].level < next.grade, `${p}: the next level ${next.id} is past them`);
  }
  const b = S.fixRider(structuredClone(OLD[1]));   // lock boxes still placing at R9b
  assert.deepEqual([b.levels.places.lockbox.id, b.levels.places.lockbox.placed], ['twoNeg', false], 'an unfinished placement starts again there');
  // once only: a second load changes nothing, and a level already there is kept
  const again = S.fixRider(structuredClone(a));
  assert.deepEqual(again.levels, a.levels);
  const c = structuredClone(OLD[0]);
  c.levels = { v: 1, migrated: 0, places: { lockbox: { id: 'x10', into: 2, placed: true } } };
  assert.equal(S.fixRider(c).levels.places.lockbox.id, 'x10');
});

test('a rider of the strand model (2026-10-18 on) is moved the same way, from the strands', () => {
  const r = { name: 'Kid', skill: { v: 1, migrated: 1, strands: {} } };
  K.setLevel(r, 'eq', 84, { now: T0 }); K.setLevel(r, 'mul', 50, { now: T0 }); K.setLevel(r, 'frac', 41, { now: T0 }); K.setLevel(r, 'geo', 47, { now: T0 });
  const f = S.fixRider(r);
  assert.equal(f.levels.places.lockbox.id, 'bothMul');
  assert.equal(f.levels.places.wagon.id, 'gmix');
  assert.equal(f.levels.places.fishing.id, 'add');
  assert.equal(f.levels.places.building.id, 'g2');
  assert.equal(f.levels.places.roundup.id, 'herdE', 'the times series and herds up to every table (50); halves on another strand');
});

// ---- save.js ----------------------------------------------------------------------------------------------------------

test('save.js recordAnswer: a place answer moves the level AND its strand at the level’s grade', () => {
  S.useSaveKey('bandit-math.test-levels');
  const r = S.newRider('Tester');
  const q = levelFor(r, 'deer', { now: T0 });
  const out = S.recordAnswer(r, true, { place: 'deer', level: q.id });
  assert.equal(out.level.moved, 1);
  assert.equal(at(r, 'deer'), ids('deer')[1]);
  assert.ok(K.isMet(r, 'number'), 'the strand of the level asked (one more, one less: Numbers)');
  assert.equal(r.skill.strands.number.h.at(-1)[1], PLACE.deer.levels[0].grade);
  const s2 = S.recordAnswer(r, false, { place: 'sheep', level: 'negMix' });
  assert.ok(s2.skill.add && s2.skill.sub, 'a level with `also` counts in both strands');
  const own = S.recordAnswer(r, true, { place: 'store', level: 'coins', strands: [{ strand: 'time', at: 10 }] });
  assert.ok(own.skill.time && !own.skill.money, 'explicit strands win (the store says which kind each customer was)');
});
