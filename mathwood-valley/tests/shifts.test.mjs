// The shifts (src/shifts.js, and the game's side, src/shiftkeeper.js): every job ends after a shift of rounds, with a
// thank-you, a tip, the buckle's credit, the board's stamp and Old Hob's next job; the polite no after it; a fresh
// shift at the next sunrise or when the job is picked on the jobs board; saved per rider, old saves starting fresh.
// Run with:  node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// a stand-in for the browser's localStorage (save.js keeps the riders there)
const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => ({ getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }) });

const S = await import('../src/shifts.js');
const SAVE = await import('../src/save.js');
const { makeShiftKeeper, KEEPER } = await import('../src/shiftkeeper.js');
SAVE.useSaveKey('bandit-math.riders.shifts-test');

const rider = (o = {}) => SAVE.fixRider({ id: 'r' + Math.random(), name: 'Kit', ...o });
// a place's last answers in the levels model's own shape: [right 1/0, level id, fast 1/0]
const answers = (right, of, fast = 0) => Array.from({ length: of }, (x, i) => [i < right ? 1 : 0, 'L1', i < fast ? 1 : 0]);
const withPlace = (place, h, o = {}) => rider({ ...o, levels: { v: 1, migrated: 1, places: { [place]: { id: 'L1', into: 0, placed: true, h } } } });

test('every job with a shift is on the jobs board, counts a round by its own event, and has its words', () => {
  const ids = S.SHIFT_JOBS.map((j) => j.id);
  assert.deepEqual(ids.sort(), ['deer', 'delivery', 'fishing', 'loot', 'pigs', 'range', 'roundup', 'sheep', 'store', 'wagon']);
  assert.ok(!ids.includes('windmill') && !ids.includes('bridge'), 'the windmill and the bridge end on their own');
  const rounds = new Set();
  for (const j of S.SHIFT_JOBS) {
    assert.ok(!rounds.has(j.round), `${j.id}: its own round event`); rounds.add(j.round);
    assert.equal(S.ROUND_OF[j.round], j.id);
    assert.ok(S.THANKS[j.id].length >= 3 && S.THANKS[j.id].length <= 4, `${j.id}: 3 or 4 thank-yous`);
    for (const l of S.THANKS[j.id]) assert.ok(l.length > 15 && l.length < 90 && /[.!]$/.test(l), `${j.id}: "${l}" is a short, whole line`);
    assert.ok(S.NEXT[j.id], `${j.id}: Old Hob can send a rider there`);
    assert.ok(j.tip >= 3 && j.tip <= 20 && j.credit >= 1, `${j.id}: a tip about a round's pay, and a buckle credit`);
    assert.ok(j.label && !/\d/.test(j.label), `${j.id}: a counter label`);
  }
  assert.equal(S.declineLines('sheep')[0], "That's all I need for today, partner. Come back tomorrow!");
  assert.ok(S.NEXT.boxes, 'the lock boxes when every job is done');
  assert.ok(SAVE.JOBS.some((j) => j.id === 'orders') && S.SHIFT_BY.store.buckle === 'orders', 'credit goes to the job\'s own buckle count');
});

test('a shift is 5 to 10 rounds (3 to 5 on the long trips), most riders 6 to 8, from how the rider is doing', () => {
  const r0 = rider();
  assert.equal(S.shiftLength(r0, 'sheep'), 7, 'nothing known yet: the middle');
  assert.equal(S.shiftLength(r0, 'delivery'), 4, 'a long trip, nothing known: the middle');
  // how often right lately at the job's place
  assert.equal(S.shiftLength(withPlace('sheep', answers(10, 20)), 'sheep'), 5, 'half right: the short end');
  assert.equal(S.shiftLength(withPlace('sheep', answers(16, 20)), 'sheep'), 7, 'about 80% right, as the levels aim for: the middle');
  assert.equal(S.shiftLength(withPlace('sheep', answers(20, 20)), 'sheep'), 10, 'every one right: the long end');
  assert.equal(S.shiftLength(withPlace('deliveries', answers(20, 20)), 'delivery'), 5, 'a long trip, all right: 5');
  assert.equal(S.shiftLength(withPlace('deliveries', answers(10, 20)), 'delivery'), 3, 'a long trip, half right: 3');
  // a quick hand at a sit-down job gets a little more
  const slow = S.shiftLength(withPlace('store', answers(17, 20, 0)), 'store'), quick = S.shiftLength(withPlace('store', answers(17, 20, 17)), 'store');
  assert.ok(quick > slow, `fast answers at the counter: ${slow} -> ${quick}`);
  assert.equal(S.shiftLength(withPlace('roundup', answers(17, 20, 17)), 'roundup'), S.shiftLength(withPlace('roundup', answers(17, 20, 0)), 'roundup'), 'a field job has no fast answers to count');
  // too few answers at the place: every job's last answers
  const r1 = withPlace('sheep', answers(2, 3), { stats: { recent: Array(30).fill(1) } });
  assert.equal(S.shiftLength(r1, 'sheep'), 10, 'three answers here say little: the rider\'s answers everywhere');
  // the age a grown-up gave caps it
  assert.equal(S.shiftLength(withPlace('sheep', answers(20, 20), { age: 5 }), 'sheep'), 5, 'a five-year-old: the short end, however quick');
  assert.equal(S.shiftLength(withPlace('sheep', answers(20, 20), { age: 7 }), 'sheep'), 8, 'seven: at most the middle-long');
  assert.equal(S.shiftLength(withPlace('sheep', answers(20, 20), { age: 11 }), 'sheep'), 10, 'eleven: no cap');
  // every length in range, every job, whatever the answers
  for (const j of S.SHIFT_JOBS) for (const k of [0, 5, 10, 15, 20]) for (const age of [null, 4, 6, 8, 12]) {
    const n = S.shiftLength(withPlace(j.place, answers(k, 20, k), { age }), j.id), [lo, hi] = j.holdup ? [2, 4] : j.long ? [3, 5] : [5, 10];
    assert.ok(n >= lo && n <= hi, `${j.id} ${k}/20 age ${age}: ${n}`);
  }
  assert.equal(S.shiftLength(r0, 'windmill'), 0, 'no shift for the windmill');
  // the wagon's: one hold-up of 2 to 4 waves (most riders 3)
  assert.equal(S.shiftLength(r0, 'wagon'), 3, 'a hold-up, nothing known: 3 waves');
  assert.equal(S.shiftLength(withPlace('wagon', answers(20, 20)), 'wagon'), 4);
  assert.equal(S.shiftLength(withPlace('wagon', answers(20, 20), { age: 5 }), 'wagon'), 2);
});

test('rounds count up to the shift\'s end, then the job is done for the day; a round after that changes nothing', () => {
  const r = rider();
  const of = S.ensureShift(r, 'sheep').of;
  for (let i = 1; i < of; i++) { const c = S.countRound(r, 'sheep'); assert.deepEqual([c.n, c.done, c.ended], [i, false, false]); }
  assert.equal(S.roundsLeft(r, 'sheep'), 1);
  const last = S.countRound(r, 'sheep');
  assert.deepEqual([last.n, last.of, last.done, last.ended], [of, of, true, true]);
  assert.ok(S.isDone(r, 'sheep'));
  assert.equal(S.roundsLeft(r, 'sheep'), 0);
  const again = S.countRound(r, 'sheep');
  assert.deepEqual([again.n, again.ended], [of, false], 'no second ending');
  assert.ok(!S.isDone(r, 'pigs'), 'the other jobs are still open');
  assert.equal(S.roundsLeft(r, 'windmill'), Infinity, 'a job with no shift never runs out');
  assert.equal(S.countRound(r, 'windmill'), null);
  assert.equal(S.counterText('sheep', S.shiftOf(r, 'sheep')), `Sheep healed ${of}/${of} · done for today`);
});

test('the length is fixed when the day\'s shift starts: the counter never jumps', () => {
  const r = withPlace('sheep', answers(16, 20));
  const of = S.ensureShift(r, 'sheep').of;
  r.levels.places.sheep.h = answers(20, 20);   // (all right since: a longer shift, but only from the next one)
  S.countRound(r, 'sheep');
  assert.equal(S.shiftOf(r, 'sheep').of, of);
  S.newDay(r);
  assert.ok(S.shiftOf(r, 'sheep').of > of, 'the next day\'s shift is worked out again');
});

test('a new day (the sunrise): every shift fresh; a shift left halfway keeps its count till then', () => {
  const r = rider();
  S.countRound(r, 'pigs'); S.countRound(r, 'pigs');
  const of = S.shiftOf(r, 'sheep').of; for (let i = 0; i < of; i++) S.countRound(r, 'sheep');
  assert.equal(S.shiftOf(r, 'pigs').n, 2, 'halfway: the count kept');
  assert.ok(S.isDone(r, 'sheep'));
  S.newDay(r);
  assert.equal(S.shiftOf(r, 'pigs').n, 0, 'a new day: a fresh shift');
  assert.ok(!S.isDone(r, 'sheep'), 'and the done job open again');
});

test('picked on the jobs board: a fresh shift at once', () => {
  const r = rider(), of = S.shiftOf(r, 'store').of;
  for (let i = 0; i < of; i++) S.countRound(r, 'store');
  assert.ok(S.isDone(r, 'store'));
  const f = S.resetShift(r, 'store');
  assert.deepEqual([f.n, f.done], [0, false]);
  assert.ok(!S.isDone(r, 'store'));
  assert.equal(S.resetShift(r, 'bridge'), null, 'no shift to reset');
});

test('the sunrise in the game\'s clock: crossing 5:00 forward, not a jump of the clock', () => {
  assert.ok(S.crossedSunrise(4.95, 5.02));
  assert.ok(S.crossedSunrise(4.9, 5), 'landing on it');
  assert.ok(!S.crossedSunrise(5, 5.1), 'already past it');
  assert.ok(!S.crossedSunrise(12, 12.1), 'midday');
  assert.ok(S.crossedSunrise(23.9, 5.5) === false, 'a jump of hours (a ride setting the morning) is no sunrise');
  assert.ok(!S.crossedSunrise(21, 9.67), 'the ride starting at 9:40 after a night start');
  assert.ok(S.crossedSunrise(23.99, 0.01, 0), 'across midnight, for a sunrise hour of 0');
  assert.ok(!S.crossedSunrise(NaN, 5));
});

test('a ride on a later calendar day starts a new game day; the same day does not', () => {
  const r = rider(), day = new Date(2026, 9, 28, 10).getTime();
  assert.equal(S.startRide(r, day), false, 'the first ride: today');
  assert.equal(S.today(r), 0);
  S.countRound(r, 'roundup');
  assert.equal(S.startRide(r, day + 3600e3), false, 'again an hour later: the same day');
  assert.equal(S.shiftOf(r, 'roundup').n, 1, '... its count kept');
  assert.equal(S.startRide(r, day + 24 * 3600e3), true, 'tomorrow: a new day');
  assert.equal(S.shiftOf(r, 'roundup').n, 0);
  assert.equal(S.dateKey(day), '2026-10-28');
});

test('saves: per rider, per job, kept through a save; old saves start fresh; broken ones are mended', () => {
  const old = SAVE.fixRider({ id: 'old', name: 'Old', gold: 40 });
  assert.deepEqual(old.shifts, { day: 0, date: '', jobs: {} }, 'an old save: a fresh start');
  const r = rider();
  S.startRide(r, new Date(2026, 9, 28).getTime());
  S.countRound(r, 'sheep'); S.countRound(r, 'loot');
  SAVE.saveRider(r);
  const back = SAVE.loadRiders().find((x) => x.id === r.id);
  assert.deepEqual(back.shifts.jobs.sheep, { day: 0, n: 1, of: S.shiftOf(r, 'sheep').of, done: false });
  assert.equal(back.shifts.jobs.loot.n, 1);
  assert.equal(back.shifts.date, '2026-10-28');
  const bad = SAVE.fixRider({ id: 'b', shifts: { day: -3, date: 7, jobs: { sheep: { n: 'x', of: 0, done: 1 }, pigs: 'no' } } });
  assert.deepEqual(bad.shifts, { day: 0, date: '', jobs: { sheep: { day: 0, n: 0, of: 1, done: true } } });
  assert.deepEqual(S.cleanShifts(null), { day: 0, date: '', jobs: {} });
});

test('Old Hob\'s next job: one not started today first, then the nearest', () => {
  assert.equal(S.pickNext([{ id: 'pigs', started: true, d: 10 }, { id: 'store', started: false, d: 300 }, { id: 'range', started: false, d: 100 }]), 'range');
  assert.equal(S.pickNext([{ id: 'pigs', started: true, d: 50 }, { id: 'loot', started: true, d: 20 }]), 'loot');
  assert.equal(S.pickNext([]), null);
  assert.match(S.hobLine('pigs', 'Doc Pruitt'), /^Doc Pruitt is mighty grateful\. Mrs\. Haskell's pigs .*follow my hoofprints\.$/);
});

// ── THE KEEPER, with stand-ins for the game ───────────────────────────────────────────────────────────────────────
function game(r, o = {}) {
  const log = { toasts: [], buckles: [], hob: [], said: [], thanked: [], picked: [], ended: [], hud: null };
  const W = { hour: 9.67 };
  const hud = { toast: (t) => log.toasts.push(t), buckle: (b) => b && log.buckles.push(b), shift: (x) => { log.hud = x; } };
  const hob = { say: (t) => log.hob.push(t) };
  const JF = { thank: (who, text) => { log.thanked.push({ who, text }); return true; }, say: (id, lines) => { log.said.push({ id, lines }); return true; } };
  const JB = { jobs: S.SHIFT_JOBS.map((j) => ({ id: j.id })), where: (id) => ({ x: id === 'pigs' ? 20 : 400, z: 0 }), pick: (id, opt) => { log.picked.push({ id, opt }); return true; } };
  const P = { position: { x: 0, z: 0 } };
  let busy = false, now = null;
  const SK = makeShiftKeeper({ W, rider: r, hud, hob, folk: () => JF, board: () => JB, player: () => P, busy: () => busy, current: () => now, working: () => now,
    store: () => ({ x: 1, z: 2 }), foreman: (id) => id === 'cow', ends: { fishing: () => log.ended.push('fishing') }, ...o });
  const run = (s) => { for (let t = 0; t < s; t += 0.1) SK.update(0.1); };
  return { SK, log, W, run, setBusy: (b) => { busy = b; }, setNow: (id) => { now = id; } };
}

test('the keeper: each round counted; the last ends the shift with the thank-you, tip, credit, Hob and the next job', () => {
  const r = rider({ gold: 0 });
  const g = game(r), { SK, log } = g;
  const of = S.shiftOf(r, 'sheep').of;
  g.setNow('sheep');
  for (let i = 1; i < of; i++) assert.equal(SK.heard('sheepHealed', {}), false, `round ${i}: just counted`);
  g.run(0.3);
  assert.deepEqual(log.hud, { label: 'Sheep healed', n: of - 1, of, done: false }, 'the HUD counter');
  assert.ok(SK.open('sheep') && SK.left('sheep') === 1);
  const cattle = SAVE.jobCount(r, 'sheep'), gold = r.gold;
  assert.equal(SK.heard('sheepHealed', {}), true, 'the last round: the shift\'s own thank-you takes the usual one\'s place');
  assert.ok(!SK.open('sheep') && SK.done('sheep'));
  assert.equal(r.gold, gold + S.SHIFT_BY.sheep.tip, 'the tip');
  assert.equal(SAVE.jobCount(r, 'sheep'), cattle + S.SHIFT_BY.sheep.credit, 'credit toward the sheep buckle');
  assert.equal(log.thanked.length, 1);
  assert.equal(log.thanked[0].who, 'vet');
  assert.ok(S.THANKS.sheep.includes(log.thanked[0].text));
  assert.equal(SK.heard('flockDone', {}), true, 'the flock\'s own thank-you just after: the shift\'s takes its place');
  g.run(KEEPER.toast + 0.2);
  assert.ok(log.toasts.some((t) => /^Done for today! Doc Pruitt tips you 5 gold$/.test(t)), log.toasts.join(' | '));
  g.run(KEEPER.hob);
  assert.equal(log.hob.length, 1);
  assert.match(log.hob[0], /^Doc Pruitt is mighty grateful\. Mrs\. Haskell's pigs are loose again: follow my hoofprints\.$/, 'the nearest job not started yet');
  assert.deepEqual(log.picked, [{ id: 'pigs', opt: { quiet: true } }]);
  assert.equal(log.hud.done, true, 'the counter: done for today');
  g.run(KEEPER.show);
  assert.equal(SK.heard('flockDone', {}), false, 'long after: the flock\'s own thank-you as ever');
  assert.equal(SK.heard('sheepHealed', {}), false, 'a round after the end ends nothing');
  assert.equal(log.thanked.length, 1);
});

test('the keeper: the polite no, the board\'s more work, and the sunrise', () => {
  const r = rider();
  const g = game(r), { SK, log } = g;
  assert.equal(SK.helloFor('boss'), null, 'open: the usual hello');
  assert.equal(SK.decline('roundup'), false);
  SK.dev.end('roundup');
  assert.ok(SK.done('roundup'));
  assert.deepEqual(SK.helloFor('boss'), S.declineLines('roundup'), 'done: the polite no in place of the hello');
  g.run(KEEPER.declineEvery + 0.5);
  assert.equal(SK.decline('roundup'), true);
  assert.deepEqual(log.said.at(-1), { id: 'boss', lines: S.declineLines('roundup') });
  const n = log.said.length; SK.decline('roundup');
  assert.equal(log.said.length, n, 'asked again at once: not said again');
  // picked on the jobs board: open again at once
  assert.ok(SK.ask('roundup'));
  assert.ok(SK.open('roundup') && SK.helloFor('boss') === null);
  // the sunrise in the game: everything fresh
  SK.dev.end('pigs');
  assert.ok(SK.done('pigs'));
  g.W.hour = 4.97; g.run(0.1); g.W.hour = 5.01; g.run(0.1);
  assert.ok(SK.open('pigs'), 'a new day');
  assert.ok(log.hob.some((t) => /Sun's up/.test(t)), 'Hob says so');
  assert.equal(SK.state().day, 1);
});

test('the keeper: a counter or a slip holds the tip\'s note and Hob back till the rider is free; the store and the foreman', () => {
  const r = rider();
  const g = game(r), { SK, log } = g;
  g.setBusy(true);
  SK.dev.end('store');
  assert.equal(log.thanked[0].who, 'storekeeper', 'the storekeeper himself, behind his counter (src/jobfolk.js)');
  g.run(6);
  assert.equal(log.hob.length, 0, 'at the counter still: Hob waits');
  assert.ok(!log.toasts.some((t) => /^Done for today/.test(t)));
  g.setBusy(false);
  g.run(1); assert.ok(!log.toasts.some((t) => /^Done for today/.test(t)), 'the counter\'s own note first');
  g.run(2); assert.ok(log.toasts.some((t) => /^Done for today! Mr\. Platt tips you/.test(t)));
  g.run(1); assert.equal(log.hob.length, 1);
  // (a store with no storekeeper standing in it: his card over the store's door)
  const g1 = game(rider()), JF1 = { thank: (who, text) => { if (typeof who === 'string') return false; g1.log.thanked.push({ who, text }); return true; }, say: () => false };
  const SK1 = makeShiftKeeper({ W: g1.W, rider: rider(), hud: { toast() {}, buckle() {}, shift() {} }, hob: { say() {} }, folk: () => JF1, store: () => ({ x: 1, z: 2 }) });
  SK1.dev.end('store');
  assert.deepEqual(g1.log.thanked[0].who, { id: 'storekeeper', name: 'Mr. Platt', x: 1, z: 2 }, 'the storekeeper\'s card over the store\'s door');
  // a delivery's last: the camp's own foreman thanks the rider
  const r2 = rider(), g2 = game(r2);
  const of = S.shiftOf(r2, 'delivery').of;
  for (let i = 0; i < of; i++) g2.SK.heard('deliveryDone', { camp: 'the cow camp' });
  assert.deepEqual(g2.log.thanked.map((t) => t.who), ['the cow camp']);
  assert.deepEqual(g2.SK.helloFor('cow'), S.declineLines('delivery'), 'the camp\'s foreman says no more orders today');
  // a hold-up on the road is never a round of the wagon's shift
  const before = S.shiftOf(r2, 'wagon').n;
  g2.SK.heard('gangDone', { ambush: true });
  assert.equal(S.shiftOf(r2, 'wagon').n, before);
  g2.SK.heard('gangDone', {});
  assert.equal(S.shiftOf(r2, 'wagon').n, before + 1);
});

test('the keeper: the wagon\'s shift is the jobs board\'s hold-up; the driver thanks the player himself; the box grabbed ends it with half the tip', () => {
  const r = rider({ gold: 0 }), g = game(r), { SK, log } = g;
  assert.deepEqual(SK.start('wagon'), { day: S.shiftsOf(r).day, n: 0, of: 3, done: false }, 'made when the hold-up is sent: 3 waves');
  assert.equal(SK.heard('gangDone', { board: true }), false);
  assert.equal(SK.left('wagon'), 2);
  assert.equal(SK.heard('gangDone', { board: true }), false);
  assert.equal(SK.heard('gangDone', { board: true }), true, 'the last wave: the shift ends');
  assert.equal(log.thanked.length, 0, 'no job person: the held-up wagon\'s driver says his own (recorded)');
  assert.equal(SK.heard('banditsDone', { board: true }), true, 'the coins just after: the shift\'s ending stands');
  g.run(KEEPER.toast + 0.2);
  assert.ok(log.toasts.some((t) => /^Done for today! The driver tips you 15 gold$/.test(t)), log.toasts.join(' | '));
  g.run(KEEPER.hob);
  assert.match(log.hob[0], /^The driver is mighty grateful\./);
  // a new day, the box grabbed on the second wave: done for today as it stands, half the tip
  const r2 = rider({ gold: 0 }), g2 = game(r2);
  g2.SK.start('wagon');
  g2.SK.heard('gangDone', { board: true });
  assert.equal(g2.SK.heard('boxGrabbed', { ambush: true }), false, 'one on the way is never the shift\'s');
  assert.ok(g2.SK.open('wagon'));
  assert.equal(g2.SK.heard('boxGrabbed', { board: true }), true);
  assert.ok(g2.SK.done('wagon') && !g2.SK.open('wagon'));
  assert.equal(S.shiftOf(r2, 'wagon').n, 1, 'the count as it stood');
  assert.equal(r2.gold, Math.round(S.SHIFT_BY.wagon.tip / 2), 'half the tip: nothing taken away');
  g2.run(KEEPER.toast + 0.2);
  assert.ok(g2.log.toasts.some((t) => /^Done for today! The driver tips you 8 gold$/.test(t)), g2.log.toasts.join(' | '));
  assert.equal(S.cutShift(r2, 'wagon').ended, false, 'cut again: nothing more');
  assert.equal(g2.SK.helloFor('driver'), null, 'no one\'s hello turns into a polite no for it');
});

test('the keeper: a job turned off has no shift; the fishing rod is put down at the end', () => {
  const r = rider(), g = game(r, { jobOn: (id) => id !== 'pigs' });
  assert.equal(g.SK.heard('pigPenned', {}), false);
  assert.equal(S.shiftOf(r, 'pigs').n, 0, 'not counted');
  assert.ok(g.SK.open('pigs'), 'never closed');
  g.SK.dev.end('fishing');
  g.run(KEEPER.close + 0.2);
  assert.deepEqual(g.log.ended, ['fishing']);
  g.run(KEEPER.hob);
  assert.ok(g.log.picked.length && g.log.picked[0].id !== 'pigs', 'Hob never sends the rider to a job turned off');
  // every job done: the sheriff's lock boxes
  const r3 = rider(), g3 = game(r3);
  for (const j of S.SHIFT_JOBS) g3.SK.dev.end(j.id);
  g3.run(KEEPER.hob + 0.5);
  assert.equal(g3.log.picked.at(-1).id, 'boxes');
});
