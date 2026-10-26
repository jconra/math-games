// The windmill's and the bridge's questions through the levels (src/buildasker.js levelAsker on the place 'building'):
// placement climbs one level per right answer (the old geometry asker stuck at level 2: it saved each answer at the
// level's own point, below the point being tried), the windmill stops at level 7 while the bridge reaches 8, the two
// jobs share one ladder, a card's own step is what is recorded, and switched-off levels are skipped.
import test from 'node:test';
import assert from 'node:assert/strict';

const fake = { data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, String(v)); }, removeItem(k) { this.data.delete(k); } };
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { return fake; } });

const { levelAsker } = await import('../src/buildasker.js');
const M = await import('../src/levels/model.js');
const S = await import('../src/save.js');

const noTimer = () => ({ stop: () => ({}), cancel() {} });
const rider = () => S.newRider('Builder');
// one card answered as a builder does: ask at the asker's step, then answer
function card(a, right, step) {
  const L = step || a.level();
  a.asked({ level: L });
  return a.answered({ level: L }, right);
}

test('a rider who gets every card right climbs one level per answer through placement (no stop at level 2)', () => {
  const r = rider();
  const a = levelAsker(r, { timer: noTimer });
  assert.equal(a.level(), 1);
  assert.equal(a.state().placing, true);
  const seen = [];
  for (let k = 0; k < 8; k++) { seen.push(a.level()); card(a, true); }
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7, 8], 'every level once, in order: none skipped, none repeated');
  assert.equal(a.state().placing, false, 'the top answered right: placed');
  assert.equal(M.stateOf(r, 'building').id, 'g8');
});

test('the windmill asks no higher than level 7; the bridge goes on to 8 on the same ladder', () => {
  const r = rider();
  const mill = levelAsker(r, { most: 'g7', timer: noTimer });
  for (let k = 0; k < 7; k++) card(mill, true);
  assert.equal(mill.level(), 7);
  assert.equal(M.stateOf(r, 'building').id, 'g7', 'placed at the windmill\'s top');
  assert.equal(M.isPlaced(r, 'building'), true);
  const bridge = levelAsker(r, { timer: noTimer });
  assert.equal(bridge.level(), 7, 'the bridge starts where the windmill left off');
  for (let k = 0; k < 5; k++) card(bridge, true);   // (a level's count: 5)
  assert.equal(bridge.level(), 8);
  assert.equal(mill.level(), 7, 'back at the windmill: capped at its top');
  assert.equal(mill.state().capped, true);
  // (a windmill-only rider who keeps getting level 7 right also fills it and moves up the ladder, as the model does
  // for any job that can't ask a place's top; the windmill goes on asking 7)
  const r2 = rider(), m2 = levelAsker(r2, { most: 'g7', timer: noTimer });
  for (let k = 0; k < 20; k++) card(m2, true);
  assert.equal(m2.level(), 7);
});

test('after placement it moves in each level\'s count: 5 right to go up, a miss takes 4', () => {
  const r = rider();
  M.setLevelAt(r, 'building', 'g3');
  const a = levelAsker(r, { timer: noTimer });
  for (let k = 0; k < 4; k++) card(a, true);
  assert.equal(a.level(), 3);
  card(a, true);
  assert.equal(a.level(), 4);
  card(a, false);
  assert.equal(a.level(), 3, 'a miss at the start of a level goes back to the one before, near its end');
  assert.equal(M.stateOf(r, 'building').into, 1);
});

test('a card made at another step (a board-just-nailed question, a "Try it") is recorded at its own level', () => {
  const r = rider();
  M.setLevelAt(r, 'building', 'g5');
  const a = levelAsker(r, { timer: noTimer });
  card(a, true, 3);   // a right answer below the rider's level: a warm-up, no move
  assert.deepEqual([M.stateOf(r, 'building').id, M.stateOf(r, 'building').into], ['g5', 0]);
  const h = M.stateOf(r, 'building').h;
  assert.equal(h[h.length - 1][1], 'g3');
  // and the answer counts in the geometry strand at that level's grade (the stats' kinds of math)
  assert.ok(r.skill.strands.geo && r.skill.strands.geo.n >= 1);
});

test('levels switched off on the levels page are skipped; fast answers never count double here', () => {
  const r = rider();
  M.setOn(r, 'building', 'g2', false);
  M.setOn(r, 'building', 'g3', false);
  const a = levelAsker(r, { timer: noTimer });
  const seen = [];
  for (let k = 0; k < 4; k++) { seen.push(a.level()); card(a, true); }
  assert.deepEqual(seen, [1, 4, 5, 6]);
  // timed answers, the last ones very quick: still one step each
  const r2 = rider();
  M.setLevelAt(r2, 'building', 'g1');
  let ms = 9000;
  const quick = () => ({ stop: () => ({ ms }), cancel() {} });
  const b = levelAsker(r2, { timer: quick });
  for (let k = 0; k < 4; k++) card(b, true);
  ms = 1500; card(b, true);
  assert.equal(M.stateOf(r2, 'building').f, 0, 'no fast answers counted: the building place has no fastFrom');
});
