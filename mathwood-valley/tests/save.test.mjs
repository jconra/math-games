// Tests for src/save.js: riders, gold, titles, badges, and saving when the browser blocks storage.
// Run with:  node --test mathwood-valley/tests/*.test.mjs   (Node 22 wants the files, not the folder)
import test from 'node:test';
import assert from 'node:assert/strict';

// A stand-in for the browser's localStorage. `blocked` makes every call throw, like a locked-down private window;
// `full` makes writes throw, like a full disk.
const fake = {
  data: new Map(), blocked: false, full: false,
  getItem(k) { if (this.blocked) throw new Error('blocked'); return this.data.has(k) ? this.data.get(k) : null; },
  setItem(k, v) { if (this.blocked || this.full) throw new Error('blocked'); this.data.set(k, String(v)); },
  removeItem(k) { if (this.blocked) throw new Error('blocked'); this.data.delete(k); },
};
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { return fake; } });

const S = await import('../src/save.js');

function fresh() {
  fake.data.clear(); fake.blocked = false; fake.full = false;
  S.useSaveKey('bandit-math.riders.nodetest');
}

test('a new rider has every default and is not saved until asked', () => {
  fresh();
  const r = S.newRider('  Ada  ', { outfit: 'adventurer_f', palette: 'mustard' });
  assert.equal(r.name, 'Ada');
  assert.equal(r.gold, 0); assert.equal(r.bounty, 0);
  assert.equal(r.mode, 'lasso');
  // every job on by default (a grown-up can turn some off on the title); no lasso-or-shooting choice any more
  assert.deepEqual(r.missions, { store: true, deliveries: true, sheep: true, pigs: true, wagon: true, loot: true, hunt: true, range: true, windmill: true, bridge: true, fishing: true });
  assert.equal(r.missionsV, 2);
  assert.ok(S.MISSIONS.every((m) => S.jobOn(r, m.id)));
  assert.equal(r.topicsOn.times, true); assert.equal(r.topicsOn.algebra, true); assert.equal(r.topicsOn.adding, false);
  assert.deepEqual(r.owned, { saddle: null, horse: null, dog: null, horsesV: 2 }, 'on foot: every horse is bought now');
  assert.equal(r.look.outfit, 'adventurer_f'); assert.equal(typeof r.look.skin, 'string');
  assert.deepEqual(r.lockboxes, []);
  assert.equal(r.stats.answered, 0); assert.deepEqual(r.stats.recent, []);
  assert.equal(r.last, 0);
  assert.equal(S.loadRiders().length, 0);
  S.saveRider(r);
  const back = S.loadRiders();
  assert.equal(back.length, 1); assert.equal(back[0].id, r.id); assert.equal(back[0].look.outfit, 'adventurer_f');
});

test('long names are cut and empty names get a stand-in', () => {
  fresh();
  assert.equal(S.newRider('A very long name for a cowpoke').name.length, 16);
  assert.equal(S.newRider('   ').name, 'Rider');
});

test('settings and module state survive a save and load', () => {
  fresh();
  const r = S.newRider('Bo');
  r.mode = 'shoot'; r.missions.pigs = false; r.missions.wagon = true; r.topicsOn.algebra = false;
  r.topics.times = { step: 4, seen: { 6: [1, 0] } };
  S.saveRider(r);
  const [b] = S.loadRiders();
  assert.equal(b.mode, 'shoot'); assert.equal(b.missions.pigs, false); assert.equal(b.missions.wagon, true);
  assert.equal(S.jobOn(b, 'pigs'), false); assert.equal(S.jobOn(b, 'wagon'), true);
  assert.equal(b.topicsOn.algebra, false); assert.deepEqual(b.topics.times, { step: 4, seen: { 6: [1, 0] } });
});

test('riders come back most recently ridden first, and delete removes one', () => {
  fresh();
  const a = S.newRider('A'), b = S.newRider('B'), c = S.newRider('C');
  a.last = 100; b.last = 300; c.last = 200;
  [a, b, c].forEach(S.saveRider);
  assert.deepEqual(S.loadRiders().map(r => r.name), ['B', 'C', 'A']);
  S.deleteRider(b.id);
  assert.deepEqual(S.loadRiders().map(r => r.name), ['C', 'A']);
});

test('titles follow bounty', () => {
  const cases = [[0, 'Greenhorn'], [99, 'Greenhorn'], [100, 'Drifter'], [299, 'Drifter'], [300, 'Wrangler'],
    [700, 'Deputy'], [1499, 'Deputy'], [1500, 'Sheriff'], [3000, 'Marshal'], [5999, 'Marshal'], [6000, 'Legend'], [99999, 'Legend']];
  for (const [bounty, t] of cases) assert.equal(S.titleOf({ bounty }), t, `bounty ${bounty}`);
  assert.deepEqual(S.nextTitle({ bounty: 40 }), { title: 'Drifter', at: 100, toGo: 60 });
  assert.equal(S.nextTitle({ bounty: 7000 }), null);
});

test('earn adds to gold and bounty and saves at once; spend never goes below zero', () => {
  fresh();
  const r = S.newRider('Cy'); S.saveRider(r);
  const res = S.earn(r, 60);
  assert.equal(r.gold, 60); assert.equal(r.bounty, 60); assert.equal(res.newTitle, null);
  assert.equal(S.loadRiders()[0].gold, 60);
  assert.equal(S.spend(r, 15), true);
  assert.equal(r.gold, 45); assert.equal(r.bounty, 60, 'spending never lowers bounty');
  assert.equal(S.loadRiders()[0].gold, 45);
  assert.equal(S.spend(r, 100), false); assert.equal(r.gold, 45);
  assert.equal(S.spend(r, -5), false);
  const up = S.earn(r, 50);
  assert.equal(up.newTitle, 'Drifter'); assert.equal(up.title, 'Drifter');
  S.earn(r, -20); S.earn(r, 'junk');
  assert.equal(r.gold, 95); assert.equal(r.bounty, 110);
});

test('accuracy keeps the last 50 answers and Top Hand needs 30 answers at 90%', () => {
  fresh();
  const r = S.newRider('Dee'); S.saveRider(r);
  for (let i = 0; i < 29; i++) S.recordAnswer(r, true);
  assert.deepEqual(S.badgesOf(r), [], '29 answers is not enough');
  const res = S.recordAnswer(r, true);
  assert.equal(res.badge, 'Top Hand');
  assert.deepEqual(S.badgesOf(r), ['Top Hand']);
  for (let i = 0; i < 40; i++) S.recordAnswer(r, i % 2 === 0);
  assert.equal(r.stats.recent.length, 50);
  assert.equal(r.stats.answered, 70);
  assert.equal(S.accuracyOf(r).of, 50);
  assert.deepEqual(S.badgesOf(r), ['Top Hand'], 'a badge once earned is kept');
  assert.deepEqual(S.loadRiders()[0].badges, ['Top Hand']);
});

test('Sharpshooter counts only the bottle range\'s answers, below 90% earns nothing', () => {
  fresh();
  const r = S.newRider('Eli'); r.mode = 'shoot';   // (an old Shooting-mode rider: the mode no longer decides anything)
  for (let i = 0; i < 40; i++) S.recordAnswer(r, i % 10 !== 0);   // exactly 90%, but none of them at the range
  assert.deepEqual(S.badgesOf(r), ['Top Hand']);
  const e = S.newRider('Eve');
  for (let i = 0; i < 40; i++) S.recordAnswer(e, i % 10 !== 0, { range: true });   // exactly 90% at the range
  assert.deepEqual(S.badgesOf(e), ['Sharpshooter']);
  const q = S.newRider('Flo');
  for (let i = 0; i < 50; i++) S.recordAnswer(q, i % 5 !== 0, { range: true });    // 80%
  assert.deepEqual(S.badgesOf(q), []);
  assert.equal(S.accuracyOf(q, 'shoot').pct, 80);
  assert.equal(S.accuracyOf(q, 'lasso').pct, null);
});

test('Safecracker after 10 lock boxes solved at par', () => {
  fresh();
  const r = S.newRider('Gus');
  for (let i = 0; i < 9; i++) S.recordLockbox(r, { solved: true, moves: 3, par: 3, stars: 3 });
  S.recordLockbox(r, { solved: true, moves: 5, par: 3, stars: 2 });   // over par: solved, not at par
  S.recordLockbox(r, { solved: false, moves: 2, par: 3 });            // left unsolved: not counted
  assert.equal(r.stats.boxes, 10); assert.equal(r.stats.parBoxes, 9);
  assert.deepEqual(S.badgesOf(r), []);
  const res = S.recordLockbox(r, { solved: true, stars: 3 });          // no move counts: 3 stars means par
  assert.equal(res.atPar, true); assert.equal(res.badge, 'Safecracker');
  assert.deepEqual(S.badgesOf(r), ['Safecracker']);
});

test('works with storage blocked: nothing throws and riders live in memory', () => {
  fresh();
  fake.blocked = true;
  assert.equal(S.storageWorks(), false);
  assert.deepEqual(S.loadRiders(), []);
  const r = S.newRider('Hal');
  assert.equal(S.saveRider(r), false);
  S.earn(r, 12);
  assert.equal(S.spend(r, 2), true);
  S.recordAnswer(r, true);
  const back = S.loadRiders();
  assert.equal(back.length, 1); assert.equal(back[0].gold, 10);
  back[0].gold = 999;   // editing a loaded copy changes nothing until it is saved
  assert.equal(S.loadRiders()[0].gold, 10);
  S.deleteRider(r.id);
  assert.deepEqual(S.loadRiders(), []);
});

test('a full disk keeps the newest riders in memory instead of rolling back', () => {
  fresh();
  const r = S.newRider('Ivy'); S.saveRider(r); S.earn(r, 5);
  fake.full = true;
  S.earn(r, 7);
  assert.equal(S.storageWorks(), false);
  assert.equal(S.loadRiders()[0].gold, 12);
});

test('a damaged save is kept aside and the game starts clean', () => {
  fresh();
  fake.data.set('bandit-math.riders.nodetest', '{not json');
  const warn = console.warn; console.warn = () => {};
  try { assert.deepEqual(S.loadRiders(), []); } finally { console.warn = warn; }
  assert.equal(fake.data.get('bandit-math.riders.nodetest.broken'), '{not json');
});

test('a hand-edited or partial rider is repaired, unknown fields kept', () => {
  fresh();
  fake.data.set('bandit-math.riders.nodetest', JSON.stringify({ version: 1, riders: [
    { id: 'x1', name: 'Old', gold: -5, bounty: 3, mode: 'cannon', stats: { recent: [1, 1, 0, 'yes'] }, future: { a: 1 } },
  ] }));
  const [r] = S.loadRiders();
  assert.equal(r.gold, 0); assert.equal(r.bounty, 3); assert.equal(r.mode, 'lasso');
  assert.deepEqual(r.stats.recent, [1, 1, 0, 1]);
  assert.deepEqual(r.future, { a: 1 });
  assert.ok(S.MISSIONS.every((m) => r.missions[m.id] === true), 'every job on');
  assert.equal(r.look.outfit, 'farmer_m');
});

test('a saved lock box of a tier the game does not know is read as an iron one', () => {
  fresh();
  const r = S.newRider('Kit');
  r.lockboxes = [{ tier: 'gold', from: 'loot' }, { tier: 'brass', from: 'loot' }, null, 'tin'];
  S.saveRider(r);
  const [b] = S.loadRiders();
  assert.deepEqual(b.lockboxes, [{ tier: 'iron', from: 'loot' }, { tier: 'brass', from: 'loot' }]);
  assert.deepEqual(S.cleanBoxes([{ tier: 'vault' }, { tier: 7 }]), [{ tier: 'vault' }, { tier: 'iron' }]);
});

// ---- job counts and belt buckles ----

test('a new rider starts every job at 0, with no buckle yet and the tin one to aim for', () => {
  fresh();
  const r = S.newRider('Lou');
  assert.deepEqual(r.stats.jobs, { cattle: 0, boxes: 0, sheep: 0, orders: 0, pigs: 0, bandits: 0, deliveries: 0, loot: 0, targets: 0, tower: 0, loads: 0, fish: 0 });
  const list = S.bucklesOf(r);
  assert.deepEqual(list.map(b => b.job), ['cattle', 'boxes', 'sheep', 'orders', 'pigs', 'bandits', 'deliveries', 'loot', 'targets', 'tower', 'loads', 'fish'], 'every job this build has is shown');
  assert.deepEqual(list.map(b => b.tier), [null, null, null, null, null, null, null, null, null, null, null, null]);
  assert.deepEqual(S.buckleOf(r, 'cattle').next, { tier: 'tin', at: 10, toGo: 10 });
  assert.equal(S.buckleProgress(S.buckleOf(r, 'cattle')), '0 / 10 to tin');
  assert.equal(S.buckleProgress(S.buckleOf(r, 'boxes')), '0 / 5 to tin');
});

test('the job table: four rising milestones a job, a keepsake for each, cattle, boxes, sheep, orders and pigs ready', () => {
  assert.deepEqual(S.BUCKLES, ['tin', 'copper', 'silver', 'gold']);
  for (const j of S.JOBS) {
    assert.equal(j.at.length, 4, j.id);
    for (let i = 1; i < 4; i++) assert.ok(j.at[i] > j.at[i - 1], `${j.id} milestones rise`);
    assert.ok(S.KEEPSAKES[j.id] && S.KEEPSAKES[j.id].name, `${j.id} has a keepsake`);
    assert.ok(S.BUCKLES.includes(S.KEEPSAKES[j.id].from));
  }
  assert.deepEqual(S.JOBS.filter(j => j.ready).map(j => j.id), ['cattle', 'boxes', 'sheep', 'orders', 'pigs', 'bandits', 'deliveries', 'loot', 'targets', 'tower', 'loads', 'fish']);
  // (the counts as decided 2026-10-19: tin and copper as before, silver and gold brought in so the whole checklist
  // takes about 17 hours of play, not 38)
  assert.deepEqual(Object.fromEntries(S.JOBS.map(j => [j.id, j.at])), {
    cattle: [10, 50, 120, 250], boxes: [5, 25, 50, 100], sheep: [5, 20, 40, 80], orders: [10, 40, 100, 200], pigs: [10, 50, 100, 200],
    bandits: [3, 15, 40, 80], deliveries: [3, 10, 25, 40], loot: [5, 20, 40, 80], targets: [15, 60, 150, 300],
    tower: [4, 10, 16, 18],   // (feet of windmill tower stood: gold at the 18 ft the checklist counts as done)
    loads: [3, 15, 40, 80],   // (loads carried across the bridge in its tests: one to five a test)
    fish: [5, 25, 60, 120],   // (fish landed off the dock: about half a minute a fish)
  });
  assert.equal(S.jobWords('cattle', 1), '1 steer corralled');
  assert.equal(S.jobWords('cattle', 1200), '1,200 cattle corralled');
  assert.equal(S.jobWords('boxes', 1), '1 lock box cracked');
});

test('counting a job saves at once and hands back a buckle exactly at each milestone', () => {
  fresh();
  const r = S.newRider('Max'); S.saveRider(r);
  const won = [];
  for (let i = 1; i <= 260; i++) {
    const res = S.countJob(r, 'cattle');
    assert.equal(res.count, i);
    if (res.buckle) won.push([i, res.buckle.tier]);
  }
  assert.deepEqual(won, [[10, 'tin'], [50, 'copper'], [120, 'silver'], [250, 'gold']]);
  assert.equal(S.loadRiders()[0].stats.jobs.cattle, 260, 'saved');
  const b = S.buckleOf(r, 'cattle');
  assert.equal(b.tier, 'gold'); assert.equal(b.next, null);
  assert.equal(S.buckleProgress(b), '260 · Gold buckle');
  const mid = S.buckleOf({ stats: { jobs: { cattle: 37 } } }, 'cattle');
  assert.equal(mid.tier, 'tin'); assert.equal(S.buckleProgress(mid), '37 / 50 to copper');
  assert.equal(S.buckleProgress(S.buckleOf({ stats: { jobs: { cattle: 100 } } }, 'cattle')), '100 / 120 to silver');
  // a rider from before the counts came down keeps every buckle, and one past the new silver count has it at once
  assert.equal(S.buckleOf({ stats: { jobs: { cattle: 180 } } }, 'cattle').tier, 'silver');
  assert.equal(S.buckleOf({ stats: { jobs: { cattle: 500 } } }, 'cattle').tier, 'gold');
  // a jump past two milestones at once wins the higher one
  const q = S.newRider('Ned');
  assert.equal(S.countJob(q, 'cattle', 60).buckle.tier, 'copper');
});

test('a solved lock box counts once toward the lock-box buckle; a skipped one does not', () => {
  fresh();
  const r = S.newRider('Oz'); S.saveRider(r);
  for (let i = 0; i < 4; i++) assert.equal(S.recordLockbox(r, { solved: true, moves: 2, par: 2 }).buckle, null);
  assert.equal(S.recordLockbox(r, { solved: false }).buckle, null);
  assert.equal(r.stats.jobs.boxes, 4); assert.equal(r.stats.boxes, 4);
  const res = S.recordLockbox(r, { solved: true, moves: 9, par: 2 });
  assert.equal(res.buckle.tier, 'tin'); assert.equal(res.buckle.job, 'boxes'); assert.equal(res.atPar, false);
  assert.equal(r.stats.jobs.boxes, 5); assert.equal(r.stats.boxes, 5);
  assert.equal(S.loadRiders()[0].stats.jobs.boxes, 5);
});

test('an old save without job counts loads safely and keeps the work it already holds', () => {
  fresh();
  fake.data.set('bandit-math.riders.nodetest', JSON.stringify({ version: 1, riders: [
    { id: 'o1', name: 'Old', gold: 40, bounty: 90, stats: { answered: 30, right: 23, recent: [1, 1, 0], boxes: 7, parBoxes: 3 } },
    { id: 'o2', name: 'Bare', stats: {} },
    { id: 'o3', name: 'Junk', stats: { right: 4, boxes: 2, jobs: { cattle: -3, boxes: 'x', pigs: 2.6, lassoed: 9 } } },
  ] }));
  const rs = S.loadRiders(), by = (id) => rs.find(r => r.id === id);
  // every right answer before the counts existed was a steer roped; stats.boxes is the boxes solved
  assert.deepEqual(by('o1').stats.jobs, { cattle: 23, boxes: 7, sheep: 0, orders: 0, pigs: 0, bandits: 0, deliveries: 0, loot: 0, targets: 0, tower: 0, loads: 0, fish: 0 });
  assert.deepEqual(S.bucklesOf(by('o1')).map(b => b.tier), ['tin', 'tin', null, null, null, null, null, null, null, null, null, null]);
  assert.equal(by('o1').stats.parBoxes, 3, 'the old counts are untouched');
  assert.deepEqual(by('o2').stats.jobs, { cattle: 0, boxes: 0, sheep: 0, orders: 0, pigs: 0, bandits: 0, deliveries: 0, loot: 0, targets: 0, tower: 0, loads: 0, fish: 0 });
  // a save that has counts is read as it is (cleaned up), never topped up from the answers again; extra jobs kept
  assert.deepEqual(by('o3').stats.jobs, { cattle: 0, boxes: 2, sheep: 0, orders: 0, pigs: 3, bandits: 0, deliveries: 0, loot: 0, targets: 0, tower: 0, loads: 0, fish: 0, lassoed: 9 });
  // the next lock box on the old save counts once, not twice
  const o = by('o1');
  S.recordLockbox(o, { solved: true, moves: 1, par: 1 });
  assert.equal(o.stats.boxes, 8); assert.equal(o.stats.jobs.boxes, 8);
  // and after a save and a load the counts are not credited again from the answers
  S.recordAnswer(o, true);
  const back = S.loadRiders().find(r => r.id === 'o1');
  assert.equal(back.stats.right, 24); assert.equal(back.stats.jobs.cattle, 23);
});

test('a rider object with no stats at all can still be counted, and counting works with storage blocked', () => {
  fresh();
  const bare = { id: 'b1', name: 'Bare' };
  assert.equal(S.jobCount(bare, 'cattle'), 0);
  assert.equal(S.buckleOf(bare, 'boxes').tier, null);
  fake.blocked = true;
  const r = S.newRider('Pam');
  for (let i = 0; i < 9; i++) S.countJob(r, 'cattle');
  assert.equal(S.countJob(r, 'cattle').buckle.tier, 'tin');
  assert.equal(S.loadRiders()[0].stats.jobs.cattle, 10, 'kept in memory');
  assert.equal(S.countJob(bare, 'sheep').count, 1);
});

// The bottle range's count: the range is every rider's now, so its buckle shows for everyone, unless a grown-up turned
// the range off (and nothing was hit yet)
test('the targets-hit buckle shows for every rider; a job turned off hides its buckle until some of it is done', () => {
  const a = S.newRider('Any'), old = S.newRider('Old'); old.mode = 'lasso';
  assert.ok(S.bucklesOf(a).some(b => b.job === 'targets'), 'every rider: the Targets hit buckle');
  assert.ok(S.bucklesOf(old).some(b => b.job === 'targets'), 'an old lasso rider too');
  a.missions.range = false;
  assert.ok(!S.bucklesOf(a).some(b => b.job === 'targets'), 'the range turned off: no buckle');
  const r = S.countJob(a, 'targets', 15);
  assert.equal(r.count, 15); assert.equal(r.buckle && r.buckle.tier, 'tin');
  assert.ok(S.bucklesOf(a).some(b => b.job === 'targets'), 'turned off with some targets hit: still shown');
  // bandits come from two jobs: hidden only when both are off
  a.missions.wagon = false;
  assert.ok(S.buckleShown(a, 'bandits'), 'Loot the gang still brings bandits in');
  a.missions.loot = false;
  assert.ok(!S.buckleShown(a, 'bandits'));
  assert.ok(S.buckleShown(a, 'cattle') && S.buckleShown(a, 'boxes'), 'the round-up and the lock boxes are always on');
  assert.equal(S.jobWords('targets', 1), '1 target hit');
});

test('every job is switched on once for a rider from before; the grown-ups\' choices are kept from then on', () => {
  fresh();
  fake.data.set('bandit-math.riders.nodetest', JSON.stringify({ version: 1, riders: [
    { id: 'm1', name: 'Old', mode: 'shoot', missions: { roundup: true, wagon: false, hunt: false, loot: false } },
  ] }));
  const [r] = S.loadRiders();
  assert.ok(S.MISSIONS.every((m) => r.missions[m.id] === true), JSON.stringify(r.missions));
  assert.equal(r.missions.roundup, true, 'an old flag is kept as it was');
  r.missions.hunt = false;
  S.saveRider(r);
  const [b] = S.loadRiders();
  assert.equal(b.missions.hunt, false, 'turned off after the switch-over: stays off');
  assert.equal(b.missions.wagon, true);
  // a job a later build adds is on for everyone (not in the save yet)
  delete b.missions.range;
  assert.equal(S.fixRider(b).missions.range, true);
});

test('read aloud: only while the rider\'s math is young, and the grown-ups\' switch still turns it off', () => {
  const kid = S.newRider('Kid'), teen = S.newRider('Teen');
  teen.age = 15;
  assert.equal(S.readAloudLevel(kid), true, 'nothing known, no age: read');
  assert.equal(S.readAloudLevel(teen), false, 'a teen: not read');
  kid.readAloud = false;
  assert.equal(S.readAloudLevel(kid), true, 'the level says read; the switch is the grown-ups\' (skill.js readAloud reads it)');
});
