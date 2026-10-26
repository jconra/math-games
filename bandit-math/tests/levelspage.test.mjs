// The levels page's words and data (src/ui/levels.js placeView, settingsWords, statusWords, gridWords, runs,
// placeOfJob) and the stats page's places (src/ui/stats.js placeRows). The page itself is checked in a browser
// (~/pw/bandit-math/rigs/levels/levelspage/); these are the pure parts it draws from.
import test from 'node:test';
import assert from 'node:assert/strict';

const fake = { data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, String(v)); }, removeItem(k) { this.data.delete(k); } };
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { return fake; } });

const V = await import('../src/ui/levels.js');
const M = await import('../src/levels/model.js');
const { PLACES, PLACE } = await import('../src/levels/places.js');
const S = await import('../src/save.js');
const { placeRows } = await import('../src/ui/stats.js');

const T0 = Date.UTC(2026, 9, 21, 15);
const rider = () => S.newRider('Kit');

test('every place has a picture the page can draw', () => {
  for (const P of PLACES) assert.ok(V.PIC[P.pic], `${P.id}: no picture for ${P.pic}`);
  for (const k of Object.keys(V.PIC)) assert.match(V.PIC[k], /^<svg viewBox="[\d .]+" aria-hidden="true">.*<\/svg>$/s);
});

test('a place view: every level with its title, line, examples from the place\'s own maker, a tick and where the rider is', () => {
  for (const P of PLACES) {
    const r = rider();
    const v = V.placeView(r, P.id, { seed: 3 });
    assert.equal(v.rows.length, P.levels.length);
    assert.equal(v.met, false, 'looking does not meet a place');
    assert.equal(M.stateOf(r, P.id), null);
    assert.equal(v.rows.filter((x) => x.here).length, 1);
    for (const x of v.rows) {
      assert.ok(x.title && x.line, `${P.id}/${x.id}`);
      assert.ok(x.on);
      assert.ok(x.examples.length >= 2 && x.examples.length <= 3, `${P.id}/${x.id}: ${x.examples.length} examples`);
      for (const e of x.examples) assert.ok(e.q && e.a && !/undefined|NaN/.test(e.q + e.a), `${P.id}/${x.id}: ${e.q} -> ${e.a}`);
    }
    assert.match(v.status, /^Not played yet\. You’d start at level 1 of \d+/);
    assert.match(v.settings, /^All \d+ levels on: the game moves you up and down by itself\.$/);
  }
});

test('the same seed gives the same examples; another seed, others', () => {
  const r = rider();
  const a = V.placeView(r, 'lockbox', { seed: 5 }).rows.map((x) => x.examples.map((e) => e.q).join('|'));
  const b = V.placeView(r, 'lockbox', { seed: 5 }).rows.map((x) => x.examples.map((e) => e.q).join('|'));
  const c = V.placeView(r, 'lockbox', { seed: 6 }).rows.map((x) => x.examples.map((e) => e.q).join('|'));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('the settings in plain words: levels skipped as runs, a level picked by hand, a job switched off', () => {
  assert.equal(V.runs([1, 2, 3, 7]), '1–3 and 7');
  assert.equal(V.runs([4]), '4');
  assert.equal(V.runs([2, 3]), '2, 3');
  assert.equal(V.runs([9, 1, 2, 3, 5, 6]), '1–3, 5, 6 and 9');
  const r = rider();
  const L = PLACE.roundup.levels;
  for (const k of [0, 1, 2, 6]) M.setOn(r, 'roundup', L[k].id, false, { now: T0 });
  assert.equal(V.settingsWords(r, 'roundup'), `${L.length - 4} of ${L.length} levels on: levels 1–3 and 7 skipped.`);
  M.startHere(r, 'roundup', L[9].id, { now: T0 });
  assert.match(V.settingsWords(r, 'roundup'), /Level 10 picked by hand with the level tool\.$/);
  assert.equal(V.gridWords(r), 'Round-up: levels 1–3 and 7 skipped, level 10 picked by hand');
  r.missions.windmill = false;
  assert.match(V.settingsWords(r, 'building'), /The windmill is switched off in the Jobs list\.$/);
  r.missions.bridge = false;
  assert.match(V.settingsWords(r, 'building'), /The windmill and the bridge are switched off in the Jobs list\.$/);
  assert.equal(V.gridWords(rider()), '', 'nothing set: nothing to say');
});

test('where the rider is, in words: not played, finding the level, on a level with its right answers so far, the top', () => {
  const r = rider();
  const L = PLACE.lockbox.levels;
  assert.match(V.statusWords(r, 'lockbox'), /^Not played yet/);
  M.levelFor(r, 'lockbox', { now: T0 });
  assert.match(V.statusWords(r, 'lockbox'), /^Finding your level: trying level 1 of \d+/);
  M.setLevelAt(r, 'lockbox', L[3].id, { into: 2, now: T0 });
  assert.equal(V.statusWords(r, 'lockbox'), `You’re on level 4 of ${L.length}: ${L[3].title}. 2 of ${L[3].count || 5} right answers toward level 5.`);
  M.setLevelAt(r, 'lockbox', L[L.length - 1].id, { now: T0 });
  assert.match(V.statusWords(r, 'lockbox'), /^You’re on the top level/);
  const v = V.placeView(r, 'lockbox');
  assert.equal(v.rows[L.length - 1].here, true);
  assert.equal(v.pct, M.pctOf(r, 'lockbox'));
});

test('the page opens on the place of the job being played', () => {
  assert.equal(V.placeOfJob('roundup'), 'roundup');
  assert.equal(V.placeOfJob('hunt'), 'deer');
  assert.equal(V.placeOfJob('windmill'), 'building');
  assert.equal(V.placeOfJob('bridge'), 'building');
  assert.equal(V.placeOfJob('boxes'), 'lockbox');
  assert.equal(V.placeOfJob('fishing'), 'fishing');
  assert.equal(V.placeOfJob(null), null);
  assert.equal(V.placeOfJob('nowhere'), null);
});

test('the stats page lists the places played, with the level, what was set, and the places not played yet', () => {
  const r = rider();
  assert.equal(placeRows(r).length, 0);
  assert.equal(placeRows(r).unplayed.length, PLACES.length);
  for (let k = 0; k < 6; k++) S.recordAnswer(r, true, { place: 'lockbox', level: M.levelFor(r, 'lockbox', { now: T0 }).id, now: T0 });
  M.setOn(r, 'lockbox', PLACE.lockbox.levels[18].id, false, { now: T0 });
  const rows = placeRows(r);
  assert.equal(rows.length, 1);
  const x = rows[0];
  assert.equal(x.place, 'lockbox');
  assert.equal(x.n, 7, 'one level per right answer while finding the level');
  assert.equal(x.of, PLACE.lockbox.levels.length);
  assert.deepEqual(x.lately, { right: 6, of: 6 });
  assert.deepEqual(x.set, ['1 level skipped']);
  assert.equal(rows.unplayed.length, PLACES.length - 1);
  // a place only looked at (met, no answer) is not a row yet
  M.levelFor(r, 'deer', { now: T0 });
  assert.equal(placeRows(r).length, 1);
});
