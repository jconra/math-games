// "Protect the wagon" in plain numbers (src/missions/wagonplan.js): the riders' places round a held-up wagon, the sacks
// a roped bandit drops, the wording, the open road a hold-up's riders ride along, which wagon a gang jumps (on the way,
// or sent by the jobs board), how many waves a hold-up has, how the wagon's health wears, the gang's shots and the
// driver's thanks. How it plays, by the rigs in ~/pw/bandit-math/rigs/bandits/ (holdup_play.cjs).
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SLOTS, gangLine, sacksFor, makeOpenRoad, AMBUSH, HOLDUP, gangSize, outOnRoad, ambushPick, boardPick, holdUpWaves, perArrest,
  wearRate, wearStep, pickThanks, shotGap } from '../src/missions/wagonplan.js';
import { VOICE_CLIPS } from '../src/audio/shouts.js';

test('the riders\' places keep clear of the wagon and of each other', () => {
  assert.ok(SLOTS.length >= 10, 'room for a bunch of 9 and a couple riding back in');
  for (const [side, out] of SLOTS) { assert.ok(side === 1 || side === -1); assert.ok(out >= 5.5 && out <= 12.5, 'out from the wagon, inside the checked 12 m'); }
  for (let i = 0; i < SLOTS.length; i++) for (let j = i + 1; j < SLOTS.length; j++) {
    const [a, b] = [SLOTS[i], SLOTS[j]];
    const d = Math.hypot(a[0] * a[1] - b[0] * b[1], a[2] - b[2]);
    assert.ok(d >= 4, `slots ${i} and ${j} are ${d.toFixed(1)} m apart`);
  }
  // the first eight are spread over both sides
  const first = SLOTS.slice(0, 8);
  assert.equal(first.filter((s) => s[0] === 1).length, 4);
});

test('a roped bandit drops his number as sacks of the table', () => {
  assert.deepEqual(sacksFor(24, 6), { sacks: 4, per: 6 });
  assert.deepEqual(sacksFor(56, 7), { sacks: 8, per: 7 });
  assert.deepEqual(sacksFor(10, 10), { sacks: 1, per: 10 });
  assert.deepEqual(sacksFor(27, 6), { sacks: 0, per: 6 }, 'not in the gang: no sacks');
  assert.deepEqual(sacksFor(8, 7, 'missing'), { sacks: 8, per: 7 }, '7 × ? = 56: the 8 drops 8 sacks of 7');
  assert.deepEqual(sacksFor(5, 0), { sacks: 0, per: 0 });
});

test('the trainer\'s herd wording reads as the gang', () => {
  assert.equal(gangLine('Three past 24, not in the 6-herd'), 'Three past 24, not in the 6-Gang');
  assert.equal(gangLine('Two short of 12, not in the 12-herd'), 'Two short of 12, not in the 12-Gang');
  assert.equal(gangLine(null), '');
});

test('an open road follows its points, runs straight on past its ends, and does not wrap', () => {
  // a quarter circle of radius 50, then straight on: points a metre apart
  const pts = [];
  for (let a = 0; a <= Math.PI / 2; a += 1 / 50) pts.push([50 - 50 * Math.cos(a), 50 * Math.sin(a)]);
  const r = makeOpenRoad(pts);
  assert.ok(Math.abs(r.length - Math.PI * 25) < 1.5, `${r.length}`);
  const a = r.at(0), b = r.at(r.length);
  assert.ok(Math.hypot(a.x - pts[0][0], a.z - pts[0][1]) < 1e-6);
  assert.ok(Math.hypot(b.x - pts[pts.length - 1][0], b.z - pts[pts.length - 1][1]) < 0.5);
  // past the start: straight back along the first heading (facing +z there)
  const c = r.at(-10); assert.ok(Math.abs(c.x - a.x) < 0.5 && Math.abs(c.z - (a.z - 10)) < 0.5, JSON.stringify(c));
  assert.equal(r.gap(30, 10), -20);
  assert.equal(r.gap(10, 30), 20);
  // the side is to the left of the heading, a metre long
  for (const s0 of [5, 30, 60]) { const q = r.at(s0); assert.ok(Math.abs(Math.hypot(q.nx, q.nz) - 1) < 1e-9); assert.ok(Math.abs(q.nx * Math.sin(q.h) + q.nz * Math.cos(q.h)) < 1e-9); }
  // tracking a rider 8 m out to the side finds its place along the road
  for (const s0 of [4, 33, 70]) { const q = r.at(s0), t = r.track(q.x + q.nx * 8, q.z + q.nz * 8, s0 + 10); assert.ok(Math.abs(t - s0) < 1.5, `${s0} -> ${t}`); }
  assert.ok(Math.abs(r.nearest(r.at(42).x, r.at(42).z) - 42) < 1.1);
});

test('a hold-up on the way: only out on the long roads, on a travelling wagon near enough to see, with room round it', () => {
  const square = 500;
  assert.equal(outOnRoad({ pu: square + 20, off: 3, square }), false, 'in town');
  assert.equal(outOnRoad({ pu: square - AMBUSH.player - 5, off: 10, square }), true, 'out on the west road');
  assert.equal(outOnRoad({ pu: square + 300, off: AMBUSH.roadNear + 5, square }), false, 'well off the road');
  const base = { made: true, onRoad: true, held: false, ended: false, plan: false, seen: true, open: 1 };
  const far = { ...base, u: square - 300, dist: 100 };
  assert.equal(ambushPick([far], { square }), far);
  assert.equal(ambushPick([{ ...far, u: square - 60 }], { square }), null, 'in town');
  assert.equal(ambushPick([{ ...far, dist: AMBUSH.from - 5 }], { square }), null, 'on top of the player');
  assert.equal(ambushPick([{ ...far, dist: AMBUSH.to + 5 }], { square }), null, 'too far to see');
  assert.equal(ambushPick([{ ...far, made: false }], { square }), null, 'not drawn');
  assert.equal(ambushPick([{ ...far, onRoad: false }], { square }), null, 'pulling off or standing at a spot');
  assert.equal(ambushPick([{ ...far, held: true }], { square }), null, 'already held up');
  assert.equal(ambushPick([{ ...far, open: 0.3 }], { square }), null, 'thick trees round it');
  assert.equal(ambushPick([{ ...far, mist: 0.5 }], { square }), null, 'in the mist at the valley\'s end');
  assert.equal(ambushPick([{ ...far, mist: 0 }], { square }).u, far.u, 'clear air');
  assert.equal(ambushPick([{ ...far, atJob: true }], { square }), null, 'by the pasture or the corral (the round-up asks there)');
  // one in view first, then one a man drives (his recorded shouts go with it), then the one nearest a middling distance
  const unseen = { ...far, seen: false, dist: 100 }, seen = { ...far, seen: true, dist: 160 };
  assert.equal(ambushPick([unseen, seen], { square }), seen);
  const woman = { ...far, dist: 100, male: false }, man = { ...far, dist: 130, male: true };
  assert.equal(ambushPick([woman, man], { square }), man);
  const a = { ...far, dist: 60 }, b = { ...far, dist: 105 };
  assert.equal(ambushPick([a, b], { square }), b);
});

test('the jobs board\'s hold-up: the nearest good wagon out of town, drawn or not, but not too far out', () => {
  const square = 500, base = { made: false, onRoad: true, held: false, ended: false, plan: false, seen: false, open: 1 };
  const near = { ...base, u: square + 200, dist: 210 }, farther = { ...base, u: square - 260, dist: 270 };
  assert.equal(boardPick([farther, near], { square }), near, 'the nearest');
  assert.equal(boardPick([{ ...near, u: square + 90 }], { square }), null, 'still in town');
  assert.equal(boardPick([{ ...near, u: square + AMBUSH.boardFar + 20 }], { square }), null, 'too far out: a long ride for a kid');
  assert.equal(boardPick([{ ...near, held: true }], { square }), null, 'already held up');
  assert.equal(boardPick([{ ...near, onRoad: false }], { square }), null, 'standing at a spot');
  assert.equal(boardPick([{ ...near, mist: 0.6 }, { ...near, open: 0.2 }, { ...near, atJob: true }], { square }), null, 'mist, trees, another job');
  assert.equal(boardPick([{ ...near, male: false, dist: 200 }, { ...farther, male: true, dist: 230 }], { square }).male, true, 'a man driving, about as near');
  // none on the road: one is sent, out of town and inside the board's reach
  for (const d of AMBUSH.send) assert.ok(d >= AMBUSH.out && d <= AMBUSH.boardFar, `${d}`);
});

test('a bunch is 6 to 9 riders, 3 to 5 of them the gang', () => {
  for (const r of [0, 0.3, 0.6, 0.99]) {
    const n = gangSize(() => r), goods = Math.round(n / 2);   // (the times trainer: about half the bunch is the gang)
    assert.ok(n >= AMBUSH.riders[0] && n <= AMBUSH.riders[1], `${n}`);
    assert.ok(goods >= 3 && goods <= 5, `${n} riders: ${goods} bandits`);
  }
  assert.ok(AMBUSH.most >= 3 && AMBUSH.most <= 5);
  assert.equal(AMBUSH.words.help, 'Help!');
  assert.ok(Array.isArray(AMBUSH.helpClips) && AMBUSH.bonus > 0);
});

// a rider in the levels model's own shape: the wagon place's last answers [right 1/0, level, fast]
const answers = (right, of) => Array.from({ length: of }, (x, i) => [i < right ? 1 : 0, 'even10', 0]);
const rider = (o = {}) => ({ levels: { v: 1, places: o.h ? { wagon: { id: 'even10', placed: true, h: o.h } } : {} }, stats: { recent: [] }, age: o.age ?? null });

test('a hold-up is about 3 waves: 2 for the youngest or slower riders, up to 4 for quick ones (the shifts\' pace)', () => {
  assert.equal(holdUpWaves(rider()), 3, 'nothing known yet: 3');
  assert.equal(holdUpWaves(rider({ h: answers(10, 20) })), 2, 'half right: 2');
  assert.equal(holdUpWaves(rider({ h: answers(20, 20) })), 4, 'every one right: 4');
  assert.equal(holdUpWaves(rider({ h: answers(20, 20), age: 5 })), 2, 'a five-year-old: 2, however quick');
  for (const k of [0, 5, 10, 15, 20]) for (const age of [null, 4, 6, 8, 12]) {
    const n = holdUpWaves(rider({ h: answers(k, 20), age }));
    assert.ok(n >= 2 && n <= 4, `${k}/20 age ${age}: ${n}`);
  }
  // the pace expected of an arrest goes with it: slower for the young and slower riders
  assert.ok(perArrest(rider({ h: answers(10, 20) })) > perArrest(rider({ h: answers(20, 20) })));
  assert.equal(perArrest(rider({ h: answers(20, 20), age: 5 })), HOLDUP.perArrest[0]);
});

// a hold-up played out second by second: each wave's bandits all in at once, one arrested every `per` seconds (or never)
function play(r, { per, slow = 1, bandits = HOLDUP.bandits, never = false }) {
  const waves = holdUpWaves(r), rate = wearRate(perArrest(r), waves);
  let health = HOLDUP.health, t = 0;
  for (let w = 0; w < waves; w++) {
    let loose = bandits, next = per * slow;
    while (loose > 0) {
      health = wearStep(health, loose, rate, 0.5); t += 0.5;
      if (health <= 0) return { health: 0, t, emptied: true };
      if (!never && (next -= 0.5) <= 0) { loose--; next = per * slow; }
    }
  }
  return { health, t, emptied: false };
}

test('the wagon\'s health: a kid at a normal pace for their level finishes with most of it; only leaving the gang alone a long while empties it', () => {
  for (const r of [rider(), rider({ h: answers(10, 20) }), rider({ h: answers(20, 20) }), rider({ h: answers(20, 20), age: 5 }), rider({ age: 6 })]) {
    const per = perArrest(r);
    const normal = play(r, { per });
    assert.ok(normal.health >= 65 && normal.health <= 75, `at the expected pace: ${normal.health.toFixed(1)} left`);
    assert.ok(play(r, { per, bandits: 5 }).health >= 50, 'five bandits a wave, the most: still plenty left');
    assert.ok(play(r, { per, slow: 2 }).health >= 35, 'twice as slow: a good share left');
    assert.ok(!play(r, { per, slow: 3 }).emptied, 'three times as slow: still gets through');
    // the gang left alone from the start: empties, but only after minutes
    const idle = play(r, { per, never: true });
    assert.ok(idle.emptied && idle.t >= 240, `left alone: empty after ${idle.t} s`);
  }
  // wearing: never under nothing, nothing loose wears nothing, and an arrest slows it at once
  assert.equal(wearStep(1, 4, 0.5, 10), 0);
  assert.equal(wearStep(80, 0, 0.5, 10), 80);
  assert.ok(80 - wearStep(80, 3, 0.1, 1) < 80 - wearStep(80, 4, 0.1, 1));
  assert.ok(HOLDUP.wear < 0.5 && HOLDUP.low > 0 && HOLDUP.low < 0.5 && HOLDUP.pay.grabbed < AMBUSH.bonus, 'the box grabbed pays less than seeing them off');
});

test('the gang\'s shots: more of them the more bandits are out, none with none; mostly into the air', () => {
  assert.equal(shotGap(0), Infinity);
  const avg = (n) => { let s = 0; for (let i = 0; i < 200; i++) s += shotGap(n, () => i / 200); return s / 200; };
  assert.ok(avg(4) < avg(2) && avg(2) < avg(1), `${avg(4).toFixed(2)} < ${avg(2).toFixed(2)} < ${avg(1).toFixed(2)}`);
  assert.ok(avg(5) >= 0.7, 'never a barrage: about a shot a second at the most');
  assert.ok(HOLDUP.shots.air >= 0.5 && HOLDUP.shots.clear >= 2.5, 'into the air more often than not, and well clear of the player');
});

test('the driver\'s thanks: the game maker\'s recorded takes, the bubble saying the same words, never the same words twice running', () => {
  for (const t of HOLDUP.thanks) { assert.ok(VOICE_CLIPS[t.clip], `${t.clip} is a recorded clip`); assert.ok(t.says.length > 5 && /[!.]$/.test(t.says), t.says); }
  for (const name of ['thankya_kindly', 'thankya_partner', 'obliged', 'obliged_partner', 'lifesaver']) assert.ok(HOLDUP.thanks.some((t) => t.clip.startsWith(name + '_')), name);
  let last = null;
  for (let i = 0; i < 60; i++) { const t = pickThanks(last, () => (i * 0.37) % 1); assert.notEqual(t.says, last); last = t.says; }
  assert.ok(VOICE_CLIPS[HOLDUP.grabbedThanks.clip] && /all right/.test(HOLDUP.grabbed), 'the box grabbed: he\'s all right, and says so');
});

test('the hold-ups hold up the traffic\'s wagons and let them go; the old job wagon is gone', () => {
  const src = fs.readFileSync(new URL('../src/missions/wagonjob.js', import.meta.url), 'utf8');
  for (const name of ['T.holdUp(t)', 'A.T.letGo(A.t)', 'ambushPick(', 'boardPick(', 'makeOpenRoad(', 'howdy(d, t ? t.says : AMBUSH.words.help', 'AMBUSH.helpTakes',
    "hob.event('gangDone'", "hob.event('banditsDone'", "hob.event('boxGrabbed'", "countJob(rider, 'bandits'", 'makeGangGuns(', 'hud.meter(', 'wearStep(', 'makeActionMusic', 'makeRider', 'sacksFor', 'gangLine'])
    assert.ok(src.includes(name), name);
  for (const gone of ['makeRealWagon', 'makeStandInWagon', 'tripLeft', 'ROAD_POINTS', 'nextSpeed', 'Gus', 'Ride along']) assert.ok(!src.includes(gone), `${gone} is gone`);
  // a wave seen off is a round of the jobs board's shift; the end is the coins and the driver's own thanks
  const done = src.slice(src.indexOf('function waveDone()'), src.indexOf('function finish()'));
  assert.ok(done.includes('ambush: !hold.board'), 'only the board\'s hold-up counts toward the shift');
  // kid-safe: the shots never go toward the player (a shot whose line comes near the player goes into the air)
  const hit = src.slice(src.indexOf('function hitPoint('), src.indexOf('function fire()'));
  assert.ok(hit.includes('H.clear') && hit.includes('return null'));
  const traffic = fs.readFileSync(new URL('../src/traffic.js', import.meta.url), 'utf8');
  for (const name of ['T.holdUp = ', 'T.letGo = ', "t.why = 'held up'", 'makeRoadFolk(', 'howdy(t.wg.driver']) assert.ok(traffic.includes(name), name);
  // the save file's buckle table knows the bandits, and the job keeps its id
  const save = fs.readFileSync(new URL('../src/save.js', import.meta.url), 'utf8');
  assert.match(save, /id: 'bandits'[^\n]*ready: true/);
  assert.match(save, /id: 'wagon'[^\n]*ready: true/);
});

test('the gunfire is pooled: no new material or shape for a shot, and no blood', () => {
  const src = fs.readFileSync(new URL('../src/fx/gunfire.js', import.meta.url), 'utf8');
  const shot = src.slice(src.indexOf('F.flash = '), src.indexOf('// ── SPLINTERS AND DUST'));
  const bits = src.slice(src.indexOf('F.splinters = '), src.indexOf('const dust = makeDust'));
  for (const part of [shot, bits]) { assert.ok(!/new THREE\.(\w*Material|\w*Geometry|Sprite|Mesh)\b/.test(part), 'nothing made per shot'); }
  assert.ok(!/blood/i.test(src.replace(/No blood/g, '')), 'no blood');
  assert.match(src, /InstancedMesh/);
});
