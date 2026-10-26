// The bridge lab's crossing (labs/bridge/crossing.js) played through off the page, with stand-ins for the page and the
// drawing: a bridge that falls under its own weight ends cleanly, with no load started and nothing thrown.
// node --test tests/bridge-crossing.test.mjs   (from mathwood-valley)
import test from 'node:test';
import assert from 'node:assert/strict';

const B = await import('../labs/bridge/bridge.js');
const F = await import('../labs/bridge/frame.js');

// two 8 ft boards a side butted end to end in the middle of a 14 ft gap, the deck on them: they fold at the butt
function butted() {
  const S = 14, h = S / 2, boards = []; let n = 0;
  for (const z of [3.5, -3.5]) {
    boards.push({ id: 'b' + ++n, a: { X: -h - 1, Y: 0, Z: z }, b: { X: -h + 7, Y: 0, Z: z }, len: 8 });
    boards.push({ id: 'b' + ++n, a: { X: h - 7, Y: 0, Z: z }, b: { X: h + 1, Y: 0, Z: z }, len: 8 });
  }
  const br = { S, D: 7, boards }, d = B.deckLine(br);
  br.deck = { y: d.y, on: d.on, planks: d.planks };
  return br;
}

test('a bridge down under its own weight: no crossings at all, calm.down, the butt joint named', () => {
  const r = F.crossTest(butted());
  assert.equal(r.calm.down, true);
  assert.equal(r.crossings.length, 0);
  assert.equal(r.rating, -1);
  assert.equal(r.calm.events[0].kind, 'butt');
});

test('the same span with the joint lapped stands under its own weight (nothing bows sideways)', () => {
  const br = butted();
  for (const z of [3.5, -3.5]) br.boards.push({ id: 'lap' + z, a: { X: -2, Y: 0, Z: z }, b: { X: 2, Y: 0, Z: z }, len: 4 });
  const r = F.crossTest(br);
  assert.equal(r.calm.events.length, 0);
  assert.ok(r.rating >= 0);
});

test('the crossing plays a self-weight fall to the card without starting a load or throwing', async () => {
  const el = () => { const e = { style: {}, hidden: true, textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() { return false; } }, setAttribute() {} }; return e; };
  const els = new Map();
  globalThis.document = { getElementById: (id) => { if (!els.has(id)) els.set(id, el()); return els.get(id); } };
  const { makeCrossing } = await import('../labs/bridge/crossing.js');
  const view = { setStrain() {}, setBend() {}, setSpots() {}, nailsFor() {} };
  const shown = [];
  const loads = { shown: null, show(k) { shown.push(k); this.shown = k; }, place() {}, update() {}, back() {}, hide() { this.shown = null; } };
  const fall = { running: false, sticks: [], update: () => ({}), settled: () => true, drop() {}, clear() {} };
  const said = [];
  const app = { tower: butted(), phase: 'test' };
  const hooks = { towerView: view, deckView: view, loads, fall, say: (t) => said.push(t), gesture() {}, view: () => null, record: () => ({ best: -1, newBest: false }), fresh() {}, keep() {} };
  const cr = makeCrossing(app, hooks);
  cr.start();
  let card = null;
  for (let i = 0; i < 4000 && !card; i++) {
    await new Promise((r) => setTimeout(r, i < 20 ? 20 : 0));
    cr.frame(0.1);
    card = cr.card;
  }
  assert.ok(card, 'the card came up');
  if (process.env.SHOW) console.log(card.story, '//', card.advice);
  assert.equal(card.title, 'Down she came!');
  assert.deepEqual(shown, [], 'no load was started');
  assert.match(card.story, /^Before anything crossed, .*under her own weight\.$/);
  assert.doesNotMatch(card.story, /walker|coming onto the deck/);
});
