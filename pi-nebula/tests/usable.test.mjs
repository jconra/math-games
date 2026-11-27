// WHAT CAN BE USED, WITH THE MOUSE (POINTER 1): the one helper's rules (src/usableplan.js): only what is in reach is
// ever tested, the hand over it and a click doing what E does; a drag is no click, nor a finger; something over the game
// (a panel up) takes the click first; nothing is tested while the mouse and the view are still; every usable thing hands
// itself to the same helper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeUsableCore, isClick, nearestUnder, USE } from '../src/usableplan.js';

const text = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
// (a shape for the tests: a square on the page, at a distance along the view)
const sq = (x0, y0, x1, y1, d = 2) => ({ x0, y0, x1, y1, d });
const hit = (s, x, y) => (x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1 ? s.d : null);
function rig() {
  const log = { cursor: [], used: [] };
  const U = makeUsableCore({ hit, cursor: (on) => log.cursor.push(on) });
  return { U, log };
}

test('in reach: the hand over it, a click does what E does; out of reach: nothing, not even tested', () => {
  const { U, log } = rig();
  let inReach = false;
  U.add({ name: 'kiosk', ready: () => inReach, shape: sq(100, 100, 200, 200), use: () => log.used.push('kiosk') });
  U.move(150, 150);
  assert.equal(U.frame(), null); assert.equal(U.hand, false); assert.equal(U.stats.tests, 0, 'out of reach: never tested');
  assert.equal(U.click(150, 150), null); assert.deepEqual(log.used, []);
  inReach = true;
  assert.equal(U.frame().name, 'kiosk'); assert.equal(U.hand, true); assert.deepEqual(log.cursor, [true]);
  // (beside it, not over it: no hand)
  U.move(250, 150); assert.equal(U.frame(), null); assert.equal(U.hand, false);
  assert.equal(U.click(250, 150), null);
  assert.equal(U.click(150, 150).name, 'kiosk'); assert.deepEqual(log.used, ['kiosk']);
  // walked off: the hand goes
  U.move(150, 150); U.frame(); assert.equal(U.hand, true);
  inReach = false; U.frame(); assert.equal(U.hand, false);
});

test('a drag is not a click (the game\'s own line), nor is a finger, nor any but the left button', () => {
  assert.equal(USE.dragPx, 6);
  assert.ok(text('../../shared/input.js').includes('const DRAG_PX = 6;'), 'the game\'s own line is the input\'s');
  assert.equal(isClick({ moved: 0 }), true); assert.equal(isClick({ moved: 6 }), true); assert.equal(isClick({ moved: 7 }), false);
  assert.equal(isClick({ touch: true }), false); assert.equal(isClick({ button: 2 }), false);
  const { U, log } = rig();
  U.add({ name: 'seat', ready: () => true, shape: sq(0, 0, 50, 50), use: () => log.used.push('seat') });
  assert.equal(U.click(10, 10, { moved: 40 }), null, 'a long drag across it uses nothing');
  assert.equal(U.click(10, 10, { touch: true }), null, 'a tap is the phone\'s own button');
  assert.deepEqual(log.used, []);
  assert.equal(U.click(10, 10, { moved: 3 }).name, 'seat'); assert.deepEqual(log.used, ['seat']);
});

test('something over the game takes the click first: a panel up, the pointer locked; and the view hears only its own clicks', () => {
  const { U, log } = rig();
  U.add({ name: 'board', ready: () => true, shape: sq(0, 0, 50, 50), use: () => log.used.push('board') });
  U.move(10, 10); U.frame(false, false); assert.equal(U.hand, true);
  assert.equal(U.frame(false, true), null, 'blocked: no hand'); assert.equal(U.hand, false);
  assert.equal(U.click(10, 10, { blocked: true }), null); assert.deepEqual(log.used, []);
  // the mouse off the view (onto a card or a panel over it): no hand
  U.frame(); assert.equal(U.hand, true); U.leave(); U.frame(); assert.equal(U.hand, false);
  // the clicks reach the helper only from the view itself (the canvas's own pointerup, shared/input.js): a button or a
  // panel over the game is the page's, never the view's; a click it used is marked, so nothing else takes it too
  const inp = text('../../shared/input.js'), u = text('../src/usable.js');
  assert.ok(inp.includes("canvas.addEventListener('pointerup', onUp)"));
  assert.ok(u.includes('pk.used = T.name') && u.includes('if (pk.touch || pk.used) return;'));
  assert.ok(text('../src/friendcard.js').includes('pk.used) return;') && text('../src/jobsboard.js').includes('if (!pk.used) tapAt(pk)'));
  assert.ok(u.includes('document.pointerLockElement') && u.includes('input.enabled === false') && u.includes('input.dragging'));
});

test('a thing that takes its own clicks: the hand, and the click left to it', () => {
  const { U, log } = rig();
  U.add({ name: 'jobs board', ready: () => true, shape: sq(0, 0, 50, 50) });
  U.move(10, 10); U.frame(); assert.equal(U.hand, true);
  const T = U.click(10, 10); assert.equal(T.name, 'jobs board'); assert.equal(T.use, null); assert.equal(U.stats.used, 0);
  assert.deepEqual(log.used, []);
});

test('the nearest of two under the mouse; a list of shapes; a shape asked for only while in reach', () => {
  let asked = 0;
  const list = [
    { name: 'far', shape: sq(0, 0, 100, 100, 5) },
    { name: 'near', shape: () => { asked++; return [sq(500, 500, 600, 600, 1), sq(0, 0, 100, 100, 1.5)]; } },
  ];
  assert.equal(nearestUnder(list, 50, 50, hit).thing.name, 'near');
  assert.equal(nearestUnder(list, 550, 550, hit).thing.name, 'near');
  assert.equal(nearestUnder(list, 300, 300, hit), null);
  const { U } = rig();
  let reach = false;
  U.add({ name: 'x', ready: () => reach, shape: () => { asked++; return sq(0, 0, 9, 9); } });
  asked = 0; U.move(1, 1); U.frame(); U.frame(true); assert.equal(asked, 0);
  reach = true; U.frame(); assert.equal(asked, 1);
});

test('it costs next to nothing while the mouse is still: tested again only when the mouse, the view or the reach changes', () => {
  const { U } = rig();
  let a = true, b = false;
  U.add({ name: 'a', ready: () => a, shape: sq(0, 0, 50, 50) });
  U.add({ name: 'b', ready: () => b, shape: sq(60, 0, 90, 50) });
  U.frame(); assert.equal(U.stats.tests, 0, 'no mouse over the view yet: nothing');
  U.move(10, 10); U.frame(); assert.equal(U.stats.tests, 1);
  for (let i = 0; i < 100; i++) U.frame(false); assert.equal(U.stats.tests, 1, 'still: no more tests');
  U.frame(true); assert.equal(U.stats.tests, 2, 'the view moved');
  U.move(11, 10); U.frame(); assert.equal(U.stats.tests, 3, 'the mouse moved');
  b = true; U.frame(); assert.equal(U.stats.tests, 4, 'another thing came into reach');
  a = b = false; U.frame(); U.frame(true); assert.equal(U.stats.tests, 4, 'nothing in reach: no test even as the view moves');
  // (a thing taken away is never tested again)
  const { U: V } = rig(); const off = V.add({ name: 'gone', ready: () => true, shape: sq(0, 0, 9, 9) });
  off(); V.move(1, 1); V.frame(); assert.equal(V.stats.tests, 0); assert.equal(V.count, 0);
});

test('every usable thing hands itself to the one helper (and the music screens use it too, with no copy of their own)', () => {
  const want = {
    '../src/kiosk.js': ["name: 'kiosk'"], '../src/jobsboard.js': ["name: 'jobs board'"], '../src/jobs/index.js': ["name: 'job'"],
    '../src/friendcard.js': ["name: 'person'", "name: 'captain\\'s question'"], '../src/mission.js': ["name: 'pilot\\'s seat'", "name: 'survey table'"],
    '../src/trip.js': ["name: 'seat aboard'"], '../src/tune.js': ["'survey table' : 'reactor core'"], '../src/cargodrive.js': ["name: 'forklift'"],
    '../src/rescue.js': ["name: 'pod lock'"], '../src/music/places.js': ["name: 'music screen'"],
  };
  for (const [f, names] of Object.entries(want)) { const s = text(f); for (const n of names) assert.ok(s.includes(n), f + ': ' + n); assert.ok(/usable\.add\(|usable\.add\(/.test(s), f); }
  const places = text('../src/music/places.js');
  assert.ok(!places.includes('style.cursor') && !places.includes('new THREE.Raycaster()'), 'no cursor or ray of its own');
  const main = text('../src/main.js');
  assert.ok(main.indexOf('makeUsable({') < main.indexOf('makeFriendCard({'), 'made before anything else that takes the view\'s clicks');
  assert.ok(main.includes('usable.update();'));
});

test('held still (sitting or lying aboard, the walking keys off): only what can be used then shows the hand and takes a click', () => {
  const { U, log } = rig();
  U.add({ name: 'kiosk', ready: () => true, shape: sq(0, 0, 50, 50), use: () => log.used.push('kiosk') });
  U.add({ name: 'seat aboard', held: true, ready: () => true, shape: sq(100, 0, 150, 50), use: () => log.used.push('seat') });
  U.move(10, 10); assert.equal(U.frame(false, false, true), null, 'held: the kiosk is not');
  U.move(110, 10); assert.equal(U.frame(false, false, true).name, 'seat aboard');
  assert.equal(U.click(10, 10, { held: true }), null);
  assert.equal(U.click(110, 10, { held: true, moved: 30 }), null, 'a drag is still no click');
  assert.equal(U.click(110, 10, { held: true }).name, 'seat aboard'); assert.deepEqual(log.used, ['seat']);
  assert.ok(text('../src/trip.js').includes("name: 'seat aboard', held: true"));
});
