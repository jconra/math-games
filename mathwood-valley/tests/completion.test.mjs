// The checklist (src/completion.js): what counts, a fresh rider at 0%, a played one, the first look at an old save,
// the toasts' items, goals, what the world notices, and the copies of the camps and hideouts against their files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  completion, unlocked, goalChoices, goalsOf, setGoal, clearGoal, notice, markFound, found, setWindmill, progressLine,
  CAMP_PLACES, HIDEOUTS, COMING, MOST_GOALS, PHOTO_STEPS, WINDMILL_FEET, GROUPS,
} from '../src/completion.js';
import { newRider, fixRider, upgradeGoals, JOBS, BUCKLES, KEEPSAKES } from '../src/save.js';
import { PRICES, SADDLES, HORSES, DOGS } from '../src/catalog.js';
import { HATS } from '../src/hats.js';
import { SLOTS } from '../src/cabin/slots.js';
import { KINDS } from '../src/math/goods.js';
import { ALBUM } from '../src/ui/album.js';

const source = (path) => fs.readFileSync(new URL(path, import.meta.url)).toString();
const ids = (c) => c.items.map((i) => i.id);
// a rider who has done everything there is today
function everything() {
  const r = newRider('Ada');
  r.stats.jobs = Object.fromEntries(JOBS.map((j) => [j.id, j.at[3]]));
  r.stats.jobs.photos = 30;
  r.owned = { ...r.owned, saddles: SADDLES.map((s) => s.id), saddle: 'silver', horses: HORSES.map((h) => h.id), hats: HATS.map((h) => h.id).filter((h) => h !== 'cowboy'),
    dogs: DOGS.map((d) => ({ kind: d.id, name: d.name })), animals: KINDS.map((k) => ({ kind: k, name: k })), cabin: SLOTS.map((s) => s.id), home: 'cabin' };
  r.topics.loot = { trips: 7 };
  r.found = { place: [...CAMP_PLACES.map((c) => 'camp-' + c.id), 'bridge', 'fishing'], keepsake: JOBS.map((j) => j.id), windmill: WINDMILL_FEET };
  return r;
}

test('the items: every job\'s four buckles, everything for sale, the collections and the camps, each id once', () => {
  const c = completion(newRider('Sam'));
  const all = ids(c);
  assert.equal(new Set(all).size, all.length, 'no id twice');
  for (const id of all) assert.match(id, /^(buckle:[a-z]+:(tin|copper|silver|gold)|buy:[a-z]+:[a-z0-9]+|collect:[a-z]+:[a-z0-9]+|place:[a-z0-9-]+)$/, id);
  const jobs = JOBS.filter((j) => j.ready);
  assert.equal(c.items.filter((i) => i.group === 'buckles').length, jobs.length * BUCKLES.length, 'four buckles a job');
  assert.ok(all.includes('buckle:targets:gold'), 'the target range counts for every rider (no shooting mode)');
  const buy = all.filter((i) => i.startsWith('buy:'));
  assert.equal(buy.length, 1 + SADDLES.length + (HORSES.length - 1) + (HATS.length - 1) + DOGS.length + KINDS.length + SLOTS.length,
    'the cabin, every saddle, every horse but the free bay, every hat but the free one, every dog, one of each farm animal, every piece of furniture');
  assert.equal(c.items.find((i) => i.id === 'buy:cabin:home').need, PRICES.cabin, 'the cabin is for sale');
  for (const h of HORSES) assert.equal(all.includes(`buy:horse:${h.id}`), h.id !== 'bay', h.id);
  for (const k of Object.keys(KEEPSAKES)) assert.ok(all.includes(`collect:keepsake:${k}`), k);
  for (const h of HIDEOUTS) assert.ok(all.includes(`collect:hideout:${h.id}`), h.id);
  for (const n of PHOTO_STEPS) assert.ok(all.includes(`collect:photos:${n}`), String(n));
  for (const p of CAMP_PLACES) assert.ok(all.includes(`place:camp-${p.id}`), p.id);
  assert.deepEqual(c.groups.map((g) => g.id), GROUPS.map((g) => g.id));
  for (const i of c.items) {
    assert.ok(i.name && i.hint && i.hint === i.how, `${i.id} has a name and says how`);
    assert.ok(!/\bundefined\b|NaN|\[object/.test(i.name + i.hint), `${i.id}: ${i.name} / ${i.hint}`);
    assert.ok(i.need >= 1 && i.have >= 0 && i.have <= i.need, i.id);
  }
});

test('a fresh rider is at 0%, and nothing to toast', () => {
  const r = newRider('Sam');
  const c = completion(r);
  assert.equal(c.pct, 0); assert.equal(c.done, 0);
  assert.ok(c.total >= 80, `total ${c.total}`);
  for (const g of c.groups) { assert.equal(g.done, 0, g.id); assert.equal(g.pct, 0, g.id); }
  assert.deepEqual(unlocked(r), [], 'the first look');
  assert.deepEqual(r.done, [], 'nothing was done');
  assert.deepEqual(unlocked(r), []);
});

test('a played rider: what they did is checked off, from the fields the game already keeps', () => {
  const r = newRider('Tess');
  r.stats.jobs.cattle = 64; r.stats.jobs.boxes = 25; r.stats.jobs.photos = 7;
  r.owned.saddles = ['plain']; r.owned.saddle = 'plain';
  r.owned.horses = ['bay', 'donkey']; r.owned.horse = 'donkey';
  r.owned.hats = ['straw']; r.look.hatStyle = 'bowler';   // (an old save wearing a hat its list missed)
  r.owned.dog = { kind: 'pug', name: 'Biscuit' };          // (an old save: one dog, no list)
  r.owned.animals = [{ kind: 'sheep', name: 'Clover', young: true, age: 3 }];   // (a thank-you lamb counts)
  r.owned.cabin = ['rug'];
  r.album = [{ eq: 'x + 1 = 2', x: '1' }];
  r.topics.loot = { trips: 2 };
  const c = completion(r), done = new Set(c.items.filter((i) => i.done).map((i) => i.id));
  const want = ['buckle:cattle:tin', 'buckle:cattle:copper', 'buckle:boxes:tin', 'buckle:boxes:copper', 'buy:saddle:plain', 'buy:horse:donkey',
    'buy:hat:straw', 'buy:hat:bowler', 'buy:dog:pug', 'buy:animal:sheep', 'buy:furniture:rug', 'collect:photos:1', 'collect:photos:6',
    'collect:hideout:hollow', 'collect:hideout:timber'];
  assert.deepEqual([...done].sort(), want.sort());
  assert.equal(c.done, want.length);
  assert.equal(c.pct, Math.round((100 * want.length) / c.total));
  const silver = c.items.find((i) => i.id === 'buckle:cattle:silver');
  assert.deepEqual([silver.have, silver.need, silver.done], [64, JOBS.find((j) => j.id === 'cattle').at[2], false]);
  // a keepsake needs its buckle AND a look at it in the cabin
  assert.equal(c.items.find((i) => i.id === 'collect:keepsake:cattle').done, false);
  assert.match(c.items.find((i) => i.id === 'collect:keepsake:cattle').hint, /go into your cabin/);
  assert.equal(notice(r, { home: true }), true);
  assert.deepEqual(found(r).keepsake, ['cattle', 'boxes'], 'only the keepsakes won so far are seen');
  assert.equal(completion(r).items.find((i) => i.id === 'collect:keepsake:cattle').done, true);
  assert.equal(notice(r, { home: true }), false, 'nothing new the second time');
  // a thing to buy: the gold in hand toward its price
  r.gold = 45;
  const tooled = completion(r).items.find((i) => i.id === 'buy:saddle:tooled');
  assert.deepEqual([tooled.have, tooled.need], [45, PRICES.saddle.tooled]);
});

test('an old save\'s first look takes what is done as announced; then each new item comes back once', () => {
  const r = newRider('Old');
  r.stats.jobs.cattle = 12; r.owned.hats = ['white'];
  delete r.done;
  assert.deepEqual(unlocked(r), [], 'no flood of toasts for the old save');
  assert.deepEqual([...r.done].sort(), ['buckle:cattle:tin', 'buy:hat:white']);
  r.owned.hats.push('straw', 'bowler'); r.stats.jobs.cattle = 50;
  const fresh = unlocked(r).map((i) => i.id).sort();
  assert.deepEqual(fresh, ['buckle:cattle:copper', 'buy:hat:bowler', 'buy:hat:straw']);
  assert.deepEqual(unlocked(r), [], 'once only');
  assert.ok(r.done.includes('buy:hat:bowler'));
  // the save keeps them (fixRider tidies rider.done and keeps rider.found as it is)
  r.found = { place: ['camp-cow'] };
  const back = fixRider(JSON.parse(JSON.stringify(r)));
  assert.deepEqual(back.done, r.done);
  assert.deepEqual(back.found, { place: ['camp-cow'] });
  assert.deepEqual(unlocked(back).map((i) => i.id), ['place:camp-cow'], 'only what is new since the last look');
});

test('100% only when every item is done; COMING entries are not counted until switched on', () => {
  const r = everything();
  const c = completion(r);
  assert.equal(c.pct, 100, JSON.stringify(c.items.filter((i) => !i.done).map((i) => i.id)));
  assert.equal(c.done, c.total);
  r.owned.hats = r.owned.hats.slice(1);
  assert.equal(completion(r).pct, 99, 'one item short is not 100');
  // a place still waiting in COMING (the bridge, the fishing hole, while they are): not shown, not counted, named in
  // "more to come"
  assert.ok(!completion(r).coming.some((n) => /cabin/i.test(n)), 'the cabin is for sale now: never "to come"');
  for (const k of ['bridge', 'fishing'].filter((k) => !COMING[k])) {
    assert.ok(!ids(completion(r)).includes('place:' + k), k);
    assert.ok(ids(completion(r, { all: true })).includes('place:' + k), k);
  }
  assert.equal(completion(r).coming.length, ['bridge', 'fishing'].filter((k) => !COMING[k]).length);
  // the windmill is in the game (src/windmilljob.js): on the list, done at an 18 ft tower standing
  assert.equal(COMING.windmill, true);
  const w = newRider('Wyn'), wi = () => completion(w).items.find((i) => i.id === 'place:windmill');
  const before = completion(w).total;
  assert.ok(ids(completion(w)).includes('place:windmill'));
  assert.equal(wi().done, false);
  assert.equal(setWindmill(w, 12), true);
  assert.deepEqual(['have', 'need', 'done'].map((k) => wi()[k]), [12, WINDMILL_FEET, false]);
  assert.equal(setWindmill(w, 9), false, 'the tallest one is kept');
  setWindmill(w, WINDMILL_FEET);
  assert.equal(wi().done, true, 'an 18 ft tower standing is done');
  assert.equal(completion(w).total, before);
});

test('goals: pin up to two, progress, reached ones make room, finished or unknown ones refused', () => {
  const r = newRider('Kit');
  r.stats.jobs.cattle = 37;
  assert.equal(setGoal(r, 'nope'), false);
  assert.equal(setGoal(r, 'buckle:cattle:silver'), true);
  assert.equal(setGoal(r, 'buckle:cattle:silver'), true, 'pinning it again is fine');
  assert.equal(r.goals.length, 1);
  assert.equal(setGoal(r, 'goal:buy'), true);
  assert.equal(setGoal(r, 'goal:places'), false, `${MOST_GOALS} at most`);
  assert.equal(setGoal(r, 'buckle:cattle:tin'), false, 'a done item is not a goal');
  const g = goalsOf(r), silverAt = JOBS.find((j) => j.id === 'cattle').at[2], buyAll = completion(r).items.filter((i) => i.group === 'buy').length;
  assert.deepEqual(g.map((x) => [x.id, x.have, x.need, x.pct, x.done]), [['buckle:cattle:silver', 37, silverAt, Math.round((100 * 37) / silverAt), false], ['goal:buy', 0, buyAll, 0, false]]);
  // the progress in words, for the rider card and the corner
  assert.deepEqual(g.map((x) => x.line), [`37 / ${silverAt}`, `0 / ${buyAll}`]);
  assert.equal(g[1].name, 'Buy everything');
  assert.equal(progressLine({ group: 'places', have: 0, need: 1, done: false }), 'Not yet');
  assert.equal(progressLine({ group: 'buckles', have: 1200, need: 1500, done: false }), '1,200 / 1,500');
  assert.equal(progressLine({ group: 'buy', have: 9, need: 9, done: true }), 'Done');
  assert.equal(progressLine({ group: 'buy', have: 60, need: 60, done: false }), 'You have the gold!');
  // buying one thing moves the count; buying the lot reaches the goal (flagged, stamped) and makes room
  unlocked(r);
  r.owned.horses = ['bay', 'midnight'];
  assert.deepEqual(unlocked(r).map((i) => [i.id, !!i.goal]), [['buy:horse:midnight', false]]);
  assert.equal(goalsOf(r)[1].line, `1 / ${buyAll}`);
  const all = everything();
  r.owned = all.owned;
  const fresh = unlocked(r);
  assert.equal(fresh.filter((i) => i.goal).length, 1, 'one toast says the goal is reached');
  assert.ok(r.goals.find((x) => x.id === 'goal:buy').doneAt > 0);
  assert.equal(goalsOf(r)[1].done, true);
  assert.equal(setGoal(r, 'goal:places'), true, 'the reached goal made room');
  assert.deepEqual(r.goals.map((x) => x.id), ['buckle:cattle:silver', 'goal:places']);
  assert.equal(clearGoal(r, 'goal:places'), true);
  assert.equal(clearGoal(r, 'goal:places'), false);
  assert.deepEqual(r.goals.map((x) => x.id), ['buckle:cattle:silver']);
});

test('the goal picker: a row per job with its four buckles, one to buy everything, one per collection, every place', () => {
  const r = newRider('Mo');
  r.stats.jobs.boxes = 3;
  const list = goalChoices(r), jobs = JOBS.filter((j) => j.ready);
  assert.equal(new Set(list.map((g) => g.id)).size, list.length, 'no goal twice');
  const rows = list.filter((g) => g.tiers);
  assert.equal(rows.length, jobs.length, 'one row a job');
  for (const g of rows) assert.deepEqual(g.tiers.map((t) => t.tier), BUCKLES);
  assert.equal(rows[0].id, 'goal:buckles:boxes', 'a job under way comes first');
  assert.deepEqual(list.filter((g) => !g.tiers).map((g) => g.id), ['goal:buy', 'goal:collect:photos', 'goal:collect:keepsake', 'goal:collect:hideout', 'goal:places']);
  assert.ok(!list.some((g) => /^(buy|collect|place):/.test(g.id)), 'no single hat, horse, photo or camp to pin');
  assert.ok(list.length <= jobs.length + 5, 'short enough for a phone');
  const photos = list.find((g) => g.id === 'goal:collect:photos');
  assert.deepEqual([photos.have, photos.need], [0, PHOTO_STEPS[PHOTO_STEPS.length - 1]], 'the photos count up to a full album');
  // a job's row aims at the next buckle and moves on when it is won; a chip pins one exact buckle
  const tinAt = JOBS.find((j) => j.id === 'cattle').at[0];
  assert.equal(setGoal(r, 'goal:buckles:cattle'), true);
  assert.equal(setGoal(r, 'buckle:boxes:gold'), true);
  assert.deepEqual(goalsOf(r).map((g) => [g.id, g.of, g.done]), [['goal:buckles:cattle', 'buckle:cattle:tin', false], ['buckle:boxes:gold', 'buckle:boxes:gold', false]]);
  unlocked(r);
  r.stats.jobs.cattle = tinAt;
  const fresh = unlocked(r);
  assert.deepEqual(fresh.filter((i) => i.goal).map((i) => i.id), ['buckle:cattle:tin'], 'each buckle won on the row says so');
  const now = goalsOf(r)[0];
  assert.deepEqual([now.of, now.done, now.name], ['buckle:cattle:copper', false, 'Copper buckle: cattle corralled']);
  assert.ok(!r.goals[0].doneAt, 'the row goes on to the next buckle');
  r.stats.jobs.cattle = JOBS.find((j) => j.id === 'cattle').at[3];
  unlocked(r);
  assert.equal(goalsOf(r)[0].done, true);
  assert.ok(r.goals[0].doneAt > 0, 'every buckle won: reached');
  assert.ok(!goalChoices(r).some((g) => g.id === 'goal:buckles:cattle'), 'a job with every buckle won leaves the picker');
  assert.equal(goalChoices(everything()).length, 0, 'everything done: nothing to pin');
});

test('old goals on an item the picker no longer offers move to the goal that holds it (save.js upgradeGoals)', () => {
  const old = [{ id: 'buy:hat:straw', at: 5, doneAt: 9 }, { id: 'buy:horse:midnight', at: 6 }, { id: 'collect:photos:12', at: 7 },
    { id: 'place:camp-cow', at: 8 }, { id: 'buckle:cattle:silver', at: 4 }, { id: 'collect:keepsake:boxes', at: 3 }, { id: 'collect:hideout:pines', at: 2 }];
  assert.deepEqual(upgradeGoals(old).map((g) => g.id), ['goal:buy', 'goal:collect:photos', 'goal:places', 'buckle:cattle:silver', 'goal:collect:keepsake', 'goal:collect:hideout']);
  assert.deepEqual(upgradeGoals(old)[0], { id: 'goal:buy', at: 5 }, 'the first kept, its doneAt worked out afresh');
  assert.deepEqual(fixRider({ goals: [{ id: 'buy:dog:pug', at: 1 }, null, 'x'] }).goals, [{ id: 'goal:buy', at: 1 }]);
  // a rider still holding old ids (not loaded through save.js): read as the new goals, and rider.goals moved over
  const r = newRider('Jo');
  r.goals = [{ id: 'buy:hat:straw', at: 1 }, { id: 'place:camp-cow', at: 2 }];
  assert.deepEqual(goalsOf(r).map((g) => g.id), ['goal:buy', 'goal:places']);
  assert.deepEqual(r.goals.map((g) => g.id), ['goal:buy', 'goal:places']);
  assert.equal(setGoal(r, 'buy:saddle:silver'), true, 'an old item id pins the goal holding it');
  assert.equal(r.goals.length, 2);
  assert.equal(clearGoal(r, 'place:camp-hollis'), true);
  assert.deepEqual(r.goals.map((g) => g.id), ['goal:buy']);
  // a goal an old build pinned on something gone: kept, not shown, nothing throws
  r.goals = [{ id: 'buckle:nojob:gold', at: 1 }, { id: 'goal:collect:nothing', at: 2 }];
  assert.doesNotThrow(() => { goalsOf(r); unlocked(r); goalChoices(r); });
  assert.deepEqual(goalsOf(r), []);
});

test('what the world notices: camps ridden up to, hideouts reached; a damaged save reads as empty', () => {
  const r = newRider('Lu');
  assert.equal(notice(r, { place: 'cow' }), true);
  assert.equal(notice(r, { place: 'cow' }), false);
  assert.equal(notice(r, { place: 'nowhere', hideout: 'nowhere' }), false, 'unknown places are ignored');
  assert.equal(notice(r, { hideout: 'pines' }), true);
  const c = completion(r);
  assert.ok(c.items.find((i) => i.id === 'place:camp-cow').done);
  assert.ok(c.items.find((i) => i.id === 'collect:hideout:pines').done, 'a hideout reached counts, whatever the trips');
  assert.ok(!c.items.find((i) => i.id === 'collect:hideout:hollow').done);
  assert.equal(markFound(r, 'gold', 'x'), false);
  for (const bad of [null, 'x', 7, { place: 'x', hideout: [3, null, 'meadow'] }]) {
    const d = newRider('Bad'); d.found = bad; d.done = 'x'; d.goals = { id: 1 }; d.owned.hats = 'all'; d.owned.dogs = [null, 7]; d.album = 'x';
    assert.doesNotThrow(() => { completion(d); unlocked(d); goalsOf(d); goalChoices(d); notice(d, { place: 'cow', home: true }); }, JSON.stringify(bad));
  }
  const d = newRider('Bad'); d.found = { hideout: [3, null, 'meadow'] };
  assert.ok(completion(d).items.find((i) => i.id === 'collect:hideout:meadow').done);
});

test('the copies of the camps and hideouts match the files that draw them; the album step matches the album', () => {
  const camps = source('../src/camps.js'), loot = source('../src/missions/loot.js');
  const campList = [...camps.match(/export const CAMPS = \[([\s\S]*?)\n\];/)[1].matchAll(/\{ id: '(\w+)', kind: '\w+', name: '((?:[^'\\]|\\.)*)'/g)].map((m) => [m[1], m[2].replace(/\\'/g, '\'')]);
  assert.deepEqual(CAMP_PLACES.map((c) => [c.id, c.name]), campList);
  const caches = [...loot.match(/export const CACHES = \[([\s\S]*?)\n\];/)[1].matchAll(/\{ id: '(\w+)', x: -?\d+, z: -?\d+, name: '([^']*)'/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(HIDEOUTS.map((h) => [h.id, h.name.charAt(0).toLowerCase() + h.name.slice(1)]), caches);
  assert.equal(PHOTO_STEPS[PHOTO_STEPS.length - 1], ALBUM.max, 'the last photo step is a full album');
});

test('the shop sells what the catalog lists (shop.js takes its tables from src/catalog.js)', () => {
  const shop = source('../src/shop.js');
  assert.match(shop, /import \{ PRICES, SADDLES, HORSES, DOGS, DOG_NAMES \} from '\.\/catalog\.js';/);
  assert.match(shop, /export \{ PRICES, SADDLES, HORSES, DOGS, DOG_NAMES \};/);
  assert.ok(!/export const (PRICES|SADDLES|HORSES|DOGS) =/.test(shop), 'one copy of each table');
  for (const s of SADDLES) assert.ok(PRICES.saddle[s.id] > 0, s.id);
});

test('a job a grown-up turned off leaves the list (what is done stays), so 100% stays in reach', () => {
  const r = newRider('Bo');
  const full = completion(r).total;
  r.missions = { ...r.missions, range: false, hunt: false, pigs: false };
  const c = completion(r), have = new Set(ids(c));
  for (const t of BUCKLES) assert.ok(!have.has(`buckle:targets:${t}`), 'the bottle range off: no targets buckles');
  assert.ok(!have.has('collect:keepsake:targets') && !have.has('collect:photos:1') && !have.has('buy:animal:pig'));
  assert.ok(have.has('buckle:pigs:tin') === false && have.has('buy:animal:sheep') && have.has('buckle:cattle:tin'));
  assert.equal(c.total, full - (4 + 1) - (4 + 1) - PHOTO_STEPS.length - 1, 'targets 4 + its keepsake, pigs 4 + its keepsake, the photos, the pig');
  // a pig already unlocked at the store stays buyable with its job off; something already done stays on the list
  r.owned.farm = { unlocked: ['pig'], jobs: {} };
  r.stats.jobs.targets = 20;
  const d = new Set(ids(completion(r)));
  assert.ok(d.has('buy:animal:pig'), 'pigs unlocked: still for sale');
  assert.ok(d.has('buckle:targets:tin') && !d.has('buckle:targets:copper'), 'the tin already won stays; the rest are off');
  assert.ok(ids(completion(r, { all: true })).includes('buckle:targets:gold'), 'all: everything');
  // everything that is on, done: 100%
  const e = everything(); e.missions = { range: false, wagon: false, loot: false }; e.stats.jobs.targets = 0; e.stats.jobs.bandits = 0;
  e.topics.loot = {}; e.found.keepsake = e.found.keepsake.filter((k) => !['targets', 'bandits', 'loot'].includes(k));
  e.stats.jobs.loot = 0;
  assert.equal(completion(e).pct, 100, JSON.stringify(completion(e).items.filter((i) => !i.done).map((i) => i.id)));
  // goals: only what's on the list can be pinned
  assert.equal(setGoal(r, 'buckle:targets:gold'), false);
});

test('every job has its own sign on its buckle, and every keepsake a spot in the cabin to be looked at', () => {
  const hud = source('../src/ui/hud.js'), cabin = source('../src/cabin/cabin.js');
  const signs = hud.slice(hud.indexOf('const SIGN = {'), hud.indexOf('const signAt'));
  const look = cabin.slice(cabin.indexOf('const KEEP_LOOK = {'), cabin.indexOf('};', cabin.indexOf('const KEEP_LOOK = {')));
  for (const j of JOBS) assert.match(signs, new RegExp(`\\n  ${j.id}: \\(f, ink\\)`), `a buckle sign for ${j.id} (else it shows the longhorn)`);
  for (const id of Object.keys(KEEPSAKES)) assert.match(look, new RegExp(`\\b${id}: \\[`), `a look spot for the ${id} keepsake`);
});

test('the windmill, the bridge and fishing turned off: their places, buckles and keepsakes leave the list (what is done stays)', () => {
  const r = newRider('Lu');
  r.missions = { ...r.missions, windmill: false, bridge: false, fishing: false };
  const have = new Set(ids(completion(r)));
  for (const id of ['place:windmill', 'place:bridge', 'place:fishing', 'buckle:tower:tin', 'buckle:loads:gold', 'buckle:fish:tin', 'collect:keepsake:tower', 'collect:keepsake:loads', 'collect:keepsake:fish']) assert.ok(!have.has(id), id);
  // a tower that stood and a bridge that carries the horse, built before the switches went off, stay checked off
  r.found = { place: ['bridge'], windmill: 18 };
  const d = completion(r), done = new Set(d.items.filter((i) => i.done).map((i) => i.id));
  assert.ok(done.has('place:windmill') && done.has('place:bridge') && !ids(d).includes('place:fishing'));
  // and the how-to lines say what to do for the tower's buckle and where its keepsake waits
  const all = completion(newRider('Mo'), { all: true }).items;
  assert.match(all.find((i) => i.id === 'buckle:tower:tin').how, /miller/);
  assert.match(all.find((i) => i.id === 'collect:keepsake:tower').how, /windowsill/);
});
