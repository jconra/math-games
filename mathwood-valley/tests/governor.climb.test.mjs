// AUTO CLIMBS BACK UP (world/governor.js; the game's maker, 2026-10-30): the governor run on a pretend machine, hours in a
// moment: a clock of its own, frames as long as the machine's rungs and load make them. It falls under load, the remembered
// band rises again once the riding is smooth, it doesn't flap, a chosen tier stays chosen, and nothing changes in play but
// the people. In the real game: ~/pw/bandit-math/rigs/governor/auto_climb.cjs.
//   node --test tests/governor.climb.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

let now = 0, wall = 1.8e12, raf = null;
const store = new Map();
Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });
const realDate = Date.now; Date.now = () => wall + now;
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.location = { search: '' };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile', maxTouchPoints: 5, deviceMemory: 8, hardwareConcurrency: 8 }, configurable: true });
globalThis.screen = { width: 412, height: 915 };
globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
globalThis.window = globalThis;
globalThis.requestAnimationFrame = (f) => { raf = f; return 1; };
const { makeGovernor, START, GOV, bandOf, TOP, LADDER_V } = await import('../world/governor.js');
const { recall } = await import('../world/quality.js');
const CARD = 'Adreno (TM) 750';
globalThis.WebGL2RenderingContext = class {};
const renderer = (gl2 = true) => ({ getContext: () => Object.assign(gl2 ? new WebGL2RenderingContext() : {}, { getExtension: () => null, getParameter: () => CARD, RENDERER: 1 }), domElement: { addEventListener() {}, removeEventListener() {} } });
// a load of the game: quality as chooseTier would say it
function load({ tier, source = 'remembered', gl2 = true }) {
  const G = makeGovernor({ renderer: renderer(gl2), quality: { tier, source } });
  G.on('travellers', () => {});   // (the game listening: the memory is kept once something is)
  return G;
}
// ride for `secs`: work(G) -> ms of work a frame; hz the screen; curtainEvery: the menu opened (2 s) that often; returns what the rungs did
function ride(G, secs, work, { hz = 120, curtainEvery = 0, scene = 'play' } = {}) {
  const end = now + secs * 1000, seen = []; let lastS = G.scenery, lastP = G.people, nextCurtain = curtainEvery ? now + curtainEvery * 1000 : Infinity, curtainEnd = 0, inPlay = 0;
  G.scene = () => (now < curtainEnd ? 'paused' : scene);
  while (now < end) {
    const ms = work(G), frame = Math.max(1000 / hz, ms);
    now += frame;
    if (now >= nextCurtain) { curtainEnd = now + 2000; nextCurtain = now + curtainEvery * 1000; }
    if (now >= curtainEnd) { G.drew(); G.work(now - Math.min(ms, frame)); }   // (a paused game draws nothing)
    raf(now);
    if (G.scenery !== lastS) { seen.push({ s: G.scenery, from: lastS, at: now, curtain: now < curtainEnd || scene !== 'play' }); lastS = G.scenery; }
    if (G.people !== lastP) { lastP = G.people; inPlay++; }
  }
  return { steps: seen, people: inPlay };
}
const fresh = () => { store.clear(); };
const reversals = (steps) => { let n = 0, dir = 0; for (const x of steps) { const d = Math.sign(x.s - x.from); if (dir && d !== dir) n++; dir = d; } return n; };
const seed = (s, p) => store.set('mathwood.governor', JSON.stringify({ cards: { [CARD]: { v: LADDER_V, scenery: s, people: p, band: bandOf(s), at: Date.now() } } }));

test('stuck on potato: smooth riding raises the remembered band, with no curtain and nothing changed in play', () => {
  fresh(); seed(5, 0);
  const G = load({ tier: 'potato' }), s0 = G.scenery;
  const r = ride(G, 8 * 60, () => 4);
  assert.equal(G.scenery, s0, 'the scenery stayed where it was: it changes only at a curtain');
  assert.equal(r.steps.length, 0);
  const rec = recall(CARD);
  assert.equal(rec.band, 'normal', `remembered ${JSON.stringify(rec)}`);
  assert.equal(rec.scenery, START.scenery.normal, 'one band a load: as far as the start of the band above');
  G.dispose();
  const N = load({ tier: 'normal' });
  assert.equal(N.loadBand, 'normal');
  N.dispose();
});

test('a slow start with no curtain after it doesn\'t stop the climb: the step down still waiting is let go', () => {
  fresh(); seed(5, 0);
  const G = load({ tier: 'potato' });
  ride(G, 20, () => 25);   // (the first seconds of a ride, slow, the people already at their fewest)
  assert.ok(G.wanted < G.scenery, `a step down waiting: ${G.wanted}`);
  ride(G, 8 * 60, () => 4);
  assert.equal(recall(CARD).band, 'normal', JSON.stringify(recall(CARD)));
  G.dispose();
});

test('a curtain takes the steps waiting a few at a time; the climb reaches the band above', () => {
  fresh(); seed(5, 0);
  const G = load({ tier: 'potato' });
  const r = ride(G, 8 * 60, () => 4, { curtainEvery: 40 });
  assert.ok(r.steps.length >= 2, `steps ${r.steps.length}`);
  for (const x of r.steps) { assert.ok(x.curtain, `a step in play ${JSON.stringify(x)}`); assert.ok(x.s - x.from <= GOV.curtainMost, `${x.from} to ${x.s}`); }
  assert.equal(G.scenery, START.scenery.normal);
  G.dispose();
});

test('drops under load, climbs back when the load ends; a phone stops short of the gaming band', () => {
  fresh(); store.delete('mathwood.governor');
  const G = load({ tier: 'normal', source: 'detected' }), s0 = G.scenery;
  ride(G, 60, () => 5, { curtainEvery: 20 });
  const slow = ride(G, 180, () => 40, { curtainEvery: 20 });
  assert.ok(G.scenery < s0, `fell: ${s0} to ${G.scenery}`);
  assert.equal(G.people, 0, 'people first');
  assert.equal(recall(CARD).band, 'potato', 'the memory fell with it');
  for (const x of slow.steps) assert.ok(x.curtain);
  const low = G.scenery;
  ride(G, 12 * 60, () => 5, { curtainEvery: 30 });
  assert.ok(G.scenery > low, `climbing again: ${low} to ${G.scenery}`);
  // (the band just fell soon after it came up: held back half an hour, then free)
  assert.equal(recall(CARD).band, 'potato', `held back: ${JSON.stringify(recall(CARD))}`);
  assert.ok(G.goal < START.scenery.normal);
  ride(G, 35 * 60, () => 5, { curtainEvery: 30 });
  assert.ok(G.scenery >= START.scenery.normal, `back in normal: ${G.scenery}`);
  assert.equal(recall(CARD).band, 'normal');
  ride(G, 30 * 60, () => 2, { curtainEvery: 30 });
  assert.ok(G.scenery <= GOV.phoneTop, 'a phone stops short of the gaming band');
  assert.equal(bandOf(G.goal), 'normal');
  G.dispose();
});

test('a machine with a real ceiling doesn\'t flap: rungs past it cost too much, and the tries get further apart', () => {
  fresh(); seed(START.scenery.normal - 12, 2);
  const ceil = START.scenery.normal - 6;
  const G = load({ tier: 'potato' });
  const work = (g) => (g.scenery > ceil ? 30 : 7);
  const a = ride(G, 10 * 60, work, { curtainEvery: 25 }), b = ride(G, 30 * 60, work, { curtainEvery: 25 });
  const flipsA = reversals(a.steps), flipsB = reversals(b.steps);
  assert.ok(flipsA <= 6, `first 10 minutes: ${flipsA} turns ${JSON.stringify(a.steps.map((x) => x.s))}`);
  assert.ok(flipsB <= 6, `next 30 minutes: ${flipsB}`);
  G.dispose();
});

test('across loads: a band that fails soon after it comes up isn\'t tried again load after load', () => {
  fresh(); seed(START.scenery.normal - 1, 4);
  const bands = [];
  // the normal band's reload-only settings cost this machine too much; the potato band has room to spare
  for (let i = 0; i < 12; i++) {
    const rec = recall(CARD), tier = rec ? rec.band : 'potato';
    bands.push(tier);
    const G = load({ tier });
    ride(G, 5 * 60, () => (tier === 'normal' ? 35 : 5), { curtainEvery: 20 });
    G.dispose();
  }
  const normals = bands.filter((b) => b === 'normal').length;
  assert.ok(normals >= 1, `tried: ${bands}`);
  assert.ok(normals <= 3, `not over and over: ${bands}`);
  assert.equal(bands.at(-1), 'potato', bands.join(' '));
  const h = recall(CARD).hold && recall(CARD).hold.normal;
  assert.ok(h && h.until > Date.now(), `held back ${JSON.stringify(h)}`);
});

test('a band that held a good while and then fell (a hot phone) rests a little and comes back', () => {
  fresh(); seed(START.scenery.normal, 8);
  const G = load({ tier: 'normal' });
  ride(G, GOV.bandProbe + 60, () => 5, { curtainEvery: 30 });
  ride(G, 120, () => 45, { curtainEvery: 20 });   // (the phone hot)
  assert.equal(recall(CARD).band, 'potato');
  const h = recall(CARD).hold.normal;
  assert.equal(h.n, 0); assert.ok(h.until - Date.now() <= GOV.bandRest * 1000);
  ride(G, GOV.bandRest + 8 * 60, () => 5, { curtainEvery: 30 });   // (cooled)
  assert.equal(recall(CARD).band, 'normal', JSON.stringify(recall(CARD)));
  G.dispose();
});

test('a card with no WebGL 2 stays in the potato band at load, but its live dials go on climbing', () => {
  fresh(); seed(5, 0);
  const G = load({ tier: 'potato', gl2: false });
  ride(G, 12 * 60, () => 4, { curtainEvery: 30 });
  assert.ok(G.scenery > START.scenery.normal, `climbed live: ${G.scenery}`);
  G.dispose();
});

test('a tier chosen by hand is never passed, and nothing is remembered', () => {
  fresh(); seed(5, 0);
  const before = store.get('mathwood.governor');
  const G = load({ tier: 'normal', source: 'saved' });
  ride(G, 10 * 60, () => 2, { curtainEvery: 20 });
  assert.equal(G.scenery, START.scenery.normal); assert.equal(G.people, START.people.normal);
  assert.equal(G.goal, START.scenery.normal);
  assert.equal(store.get('mathwood.governor'), before);
  G.dispose();
});

test('a desktop\'s climb isn\'t kept to the phone\'s top, and ends at the ladder\'s', () => {
  fresh(); seed(START.scenery.gaming, 10);
  const ua = navigator.userAgent, tp = navigator.maxTouchPoints;
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0)', maxTouchPoints: 0 }, configurable: true });
  const G = load({ tier: 'gaming' });
  ride(G, 20 * 60, () => 2, { curtainEvery: 20, hz: 144 });
  assert.equal(G.scenery, TOP.scenery);
  G.dispose();
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ua, maxTouchPoints: tp }, configurable: true });
  Date.now = realDate;
});
