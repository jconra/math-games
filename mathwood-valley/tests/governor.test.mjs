// THE GOVERNOR'S DIALS AND LADDERS (world/governor.js), in plain numbers: every step turns one dial one level, each lane
// ends with its dials at their tops, the tiers start where they always looked, and the machine's memory (world/quality.js)
// round-trips. How it behaves on a slow and a fast machine is checked in the game by ~/pw/bandit-math/rigs/governor/
// (stepdown.cjs, climb.cjs).
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DIALS, LADDERS, STEPS, START, TOP, LANES, levelsAt, bandOf, bandPos, GOV, RELOAD } from '../world/governor.js';
import { ROADFOLK } from '../src/roadfolkplan.js';
import { TOWN } from '../src/townpeopleplan.js';

test('each step turns its own lane\'s dial up exactly one level, and each lane ends with every dial at its top', () => {
  for (const lane of LANES) {
    const lv = {};
    for (const [k, l] of STEPS[lane]) {
      assert.ok(DIALS[k], k);
      assert.equal(DIALS[k].lane, lane, `${k} is in the ${DIALS[k].lane} lane`);
      assert.equal(l, (lv[k] || 0) + 1, `${k} to ${l}`);
      lv[k] = l;
    }
    for (const k of Object.keys(DIALS)) if (DIALS[k].lane === lane) assert.equal(lv[k] || 0, DIALS[k].levels.length - 1, `${k} reaches its top`);
  }
});

test('the tiers start where they always looked; potato starts bare', () => {
  const at = (t) => levelsAt(START.scenery[t], START.people[t]), name = (t, k) => DIALS[k].levels[at(t)[k]].v;
  for (const k of Object.keys(DIALS)) assert.equal(at('potato')[k], 0, `potato: ${k} bare`);
  // (world/valley.js TIER_SET, as it was)
  assert.equal(name('normal', 'ratio'), 1.5); assert.equal(name('gaming', 'ratio'), 2);
  assert.deepEqual(name('normal', 'shadows'), { size: 1024, range: 80, plants: false });
  assert.deepEqual(name('gaming', 'shadows'), { size: 2048, range: 150, plants: true });
  assert.deepEqual(name('normal', 'grass'), { count: 7000, near: 70, radius: 140, farX: 3.1 });
  assert.deepEqual(name('gaming', 'grass'), { count: 30000, near: 100, radius: 290, farX: 3.1 });
  assert.deepEqual(name('normal', 'lawn'), { radius: 40, density: 1 }); assert.deepEqual(name('gaming', 'lawn'), { radius: 60, density: 1 });
  assert.equal(name('normal', 'trees').at, 150); assert.equal(name('gaming', 'trees').at, 260);
  assert.equal(name('normal', 'ground').stampFar, 30); assert.equal(name('gaming', 'ground').farOn, 1);
  for (const t of ['normal', 'gaming']) for (const k of ['sky', 'beams', 'props']) assert.equal(name(t, k), true, `${t} ${k}`);
  assert.equal(name('normal', 'stones'), 1);
  // the people: the road folk's and the town's own tables are the dials' levels at each tier
  for (const t of ['potato', 'normal', 'gaming']) {
    const v = name(t, 'travellers');
    assert.deepEqual([v.most, v.made, v.show], [ROADFOLK.most[t], ROADFOLK.made[t], ROADFOLK.show[t]], `${t} travellers`);
    assert.equal(name(t, 'townsfolk'), TOWN.out[t], `${t} townsfolk`);
  }
  assert.equal(name('potato', 'horse').player, 'old', 'potato: the old horse');
  assert.ok(name('potato', 'horse').pen < name('gaming', 'horse').pen && name('potato', 'horse').penFar, 'potato: fewer pen horses, in their far look');
  assert.equal(name('normal', 'horse').look, 'normal'); assert.equal(name('gaming', 'horse').look, 'gaming');
  assert.equal(levelsAt(TOP.scenery, TOP.people).horse, DIALS.horse.levels.length - 1); assert.ok(DIALS.horse.levels.at(-1).v.every, 'the top: every horse the new one');
  assert.equal(name('potato', 'fences'), 'one', 'potato: one fence everywhere');
});

test('the bands follow the scenery rung; past gaming there is more of everything', () => {
  assert.equal(bandOf(0), 'potato'); assert.equal(bandOf(START.scenery.normal - 1), 'potato');
  assert.equal(bandOf(START.scenery.normal), 'normal'); assert.equal(bandOf(START.scenery.gaming), 'gaming'); assert.equal(bandOf(TOP.scenery), 'gaming');
  assert.ok(START.scenery.gaming < TOP.scenery && START.people.gaming < TOP.people);
  const g = levelsAt(START.scenery.gaming, START.people.gaming), top = levelsAt(TOP.scenery, TOP.people);
  for (const k of ['grass', 'lawn', 'trees', 'travellers', 'townsfolk', 'crowd', 'horse']) assert.ok(top[k] > g[k], k);
  assert.ok(DIALS.travellers.levels.at(-1).v.most >= 100, 'hundreds on the road at the top');
  assert.ok(DIALS.grass.levels.at(-1).v.count > 30000, 'more grass than gaming had');
  // (the two ladders compared in bands: at a tier's start both lanes sit at the same place)
  for (const [t, b] of [['potato', 0], ['normal', 1], ['gaming', 2]]) for (const lane of LANES) assert.equal(bandPos(lane, START[lane][t]), b, `${lane} ${t}`);
  for (const lane of LANES) assert.equal(bandPos(lane, TOP[lane]), 3);
});

test('Dad\'s numbers: add over 60 (or spare time at 60 Hz), take away under 50; scenery changes only at a curtain', () => {
  assert.equal(GOV.addFps, 60); assert.equal(GOV.down, 50); assert.equal(GOV.spare, 0.7);
  assert.ok(GOV.downWin >= 2 && GOV.addWin >= 3);
  for (const k of ['ratio', 'shadows', 'grass', 'lawn', 'stones', 'trees', 'ground', 'sky', 'beams', 'props', 'horse', 'fences']) assert.equal(DIALS[k].lane, 'scenery', k);
  for (const k of ['travellers', 'wagons', 'townsfolk', 'chickens', 'crowd']) assert.equal(DIALS[k].lane, 'people', k);
  assert.ok(Object.keys(RELOAD).includes('antialias') && Object.keys(RELOAD).includes('land'));
});

test('the machine\'s memory: remembered by graphics card, read back with its band', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { recall, remember } = await import('../world/quality.js');
  assert.equal(recall('Radeon RX 7900 XT'), null);
  const high = START.scenery.gaming + 1;   // (a rung in the gaming band, wherever the ladder puts it)
  remember('Radeon RX 7900 XT', { v: 'x', scenery: high, people: 20, band: bandOf(high) });
  remember('Intel(R) UHD Graphics', { v: 'x', scenery: 3, people: 2, band: bandOf(3) });
  assert.equal(recall('Radeon RX 7900 XT').band, 'gaming');
  assert.equal(recall('Intel(R) UHD Graphics').band, 'potato');
  remember('Radeon RX 7900 XT', null);
  assert.equal(recall('Radeon RX 7900 XT'), null);
  assert.equal(LADDERS.scenery.includes('|normal') && LADDERS.people.includes('|gaming'), true);
});
