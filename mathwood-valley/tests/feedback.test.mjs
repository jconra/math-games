// tests for src/feedback.js: the device id, the share switch, the send queue and its batches, with a stubbed fetch
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFeedback, FEEDBACK, ENDPOINT, SHARE_DEFAULT } from '../src/feedback.js';

const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
function fetcher(status = 200) {
  const calls = [];
  const f = (url, o) => { calls.push({ url, o, body: JSON.parse(o.body) }); return Promise.resolve({ ok: status < 300, status }); };
  f.calls = calls;
  return f;
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('a device id is made once and kept', () => {
  const s = store();
  const a = makeFeedback({ storage: s }), b = makeFeedback({ storage: s });
  assert.match(a.device, /^[A-Za-z0-9_-]{8,40}$/);
  assert.equal(a.device, b.device);
  assert.notEqual(makeFeedback({ storage: store() }).device, a.device);
});

test('storage blocked: nothing throws, the switch still works for the page', () => {
  const F = makeFeedback({ storage: blocked, host: '127.0.0.1', fetch: fetcher() });
  assert.match(F.device, /^[A-Za-z0-9_-]{8,40}$/);
  assert.equal(F.sharing(), SHARE_DEFAULT);
  assert.doesNotThrow(() => { F.setSharing(false); F.setMaker(true); F.event('x'); F.flush(); F.send('tell', { text: 'hi' }); });
});

test('the share switch: on by default on the family hosts only, and remembered', () => {
  const s = store();
  assert.equal(makeFeedback({ storage: store(), host: 'math-games.jconra.com' }).sharing(), SHARE_DEFAULT);
  assert.equal(makeFeedback({ storage: store(), host: '127.0.0.1' }).sharing(), SHARE_DEFAULT);
  assert.equal(makeFeedback({ storage: store(), host: 'example.itch.io' }).sharing(), false);
  const F = makeFeedback({ storage: s, host: '127.0.0.1' });
  F.setSharing(false);
  assert.equal(makeFeedback({ storage: s, host: '127.0.0.1' }).sharing(), false);
  F.setSharing(true);
  assert.equal(makeFeedback({ storage: s, host: 'example.itch.io' }).sharing(), true);
});

test('play events wait in the queue and go in one post on flush', async () => {
  const f = fetcher(), F = makeFeedback({ storage: store(), host: '127.0.0.1', fetch: f, version: 'v9' });
  F.event('session', { device: 'computer' });
  F.event('fps', { fps: 60 });
  assert.equal(f.calls.length, 0, 'nothing is sent before the batch');
  assert.equal(F.flush(), 1);
  assert.equal(f.calls.length, 1);
  const c = f.calls[0];
  assert.equal(c.url, ENDPOINT);
  assert.equal(c.o.method, 'POST'); assert.equal(c.o.keepalive, true);
  assert.match(c.o.headers['Content-Type'], /^text\/plain/, 'a simple request: no preflight');
  assert.equal(c.body.kind, 'events'); assert.equal(c.body.device, F.device); assert.equal(c.body.ver, 'v9');
  assert.deepEqual(c.body.data.list.map((e) => e.type), ['session', 'fps']);
  assert.equal(F.flush(), 0, 'an empty queue sends nothing');
  await tick();
  assert.equal(F.state().sent, 1);
});

test('the switch off: no events are queued, and turning it off empties the queue', () => {
  const f = fetcher(), F = makeFeedback({ storage: store(), host: '127.0.0.1', fetch: f });
  F.event('a'); F.setSharing(false);
  assert.equal(F.event('b'), false);
  assert.equal(F.flush(), 0); assert.equal(f.calls.length, 0);
  // ...but a thumbs up, a flagged question and a note are the rider's own choice and still go
  assert.equal(F.send('rate', { job: 'roundup', up: true }), true);
  assert.equal(f.calls[0].body.kind, 'rate');
});

test('batches every 30 s through the timer it is given', () => {
  let fn = null, ms = 0;
  const f = fetcher(), F = makeFeedback({ storage: store(), host: '127.0.0.1', fetch: f, every: (g, t) => { fn = g; ms = t; } });
  assert.equal(ms, FEEDBACK.batchMs);
  F.event('one'); fn();
  assert.equal(f.calls.length, 1);
  fn(); assert.equal(f.calls.length, 1, 'nothing new: no post');
});

test('a big queue is split into posts the server takes', () => {
  const f = fetcher(), F = makeFeedback({ storage: store(), host: '127.0.0.1', fetch: f });
  for (let i = 0; i < 380; i++) F.event('answer', { strand: 'mul', pct: 40 + (i % 9), right: i % 3 > 0, ms: 2000 + i, job: 'roundup' });
  const n = F.flush();
  assert.ok(n >= 3, `posts: ${n}`);
  let total = 0;
  for (const c of f.calls) { assert.ok(c.o.body.length < 16000, 'under 16 KB'); assert.ok(c.body.data.list.length <= FEEDBACK.maxPerPost); total += c.body.data.list.length; }
  assert.equal(total, 380);
  assert.equal(F.queued().length, 0);
});

test('the queue keeps the newest when it overflows', () => {
  const F = makeFeedback({ storage: store(), host: '127.0.0.1', fetch: fetcher() });
  for (let i = 0; i < FEEDBACK.maxQueue + 25; i++) F.event('e', { i });
  const q = F.queued();
  assert.equal(q.length, FEEDBACK.maxQueue);
  assert.equal(q[q.length - 1].i, FEEDBACK.maxQueue + 24);
});

test('a 429 holds sending for a minute; offline and a failing fetch drop quietly', async () => {
  let t = 1000;
  const f = fetcher(429), F = makeFeedback({ storage: store(), host: '127.0.0.1', fetch: f, now: () => t });
  F.send('tell', { text: 'a' }); await tick();
  assert.equal(F.send('tell', { text: 'b' }), false, 'held after a 429');
  t += FEEDBACK.backoffMs + 1;
  assert.equal(F.send('tell', { text: 'c' }), true);
  const off = makeFeedback({ storage: store(), host: '127.0.0.1', fetch: fetcher(), online: () => false });
  assert.equal(off.send('rate', { up: true }), false);
  const bad = makeFeedback({ storage: store(), host: '127.0.0.1', fetch: () => Promise.reject(new Error('net')) });
  assert.equal(bad.send('rate', { up: true }), true); await tick();
  assert.equal(bad.state().dropped, 1);
  const throws = makeFeedback({ storage: store(), host: '127.0.0.1', fetch: () => { throw new Error('boom'); } });
  assert.doesNotThrow(() => throws.send('rate', { up: true }));
  const none = makeFeedback({ storage: store(), host: '127.0.0.1' });
  assert.equal(none.send('rate', { up: true }), false);
});

test('a test rig browser posts nothing unless forced', () => {
  const f = fetcher();
  const rig = makeFeedback({ storage: store(), host: '127.0.0.1', fetch: f, webdriver: true });
  rig.event('x'); rig.flush(); rig.send('tell', { text: 'x' });
  assert.equal(f.calls.length, 0);
  const forced = makeFeedback({ storage: store(), host: '127.0.0.1', fetch: f, webdriver: true, force: true });
  forced.send('tell', { text: 'x' });
  assert.equal(f.calls.length, 1);
});

test('send takes only the feedback kinds and adds the rider number and tier from the game', () => {
  const f = fetcher(), F = makeFeedback({ storage: store(), host: '127.0.0.1', fetch: f });
  F.context = () => ({ rider: 2, tier: 'gaming', job: 'store' });
  assert.equal(F.send('events', {}), false);
  assert.equal(F.send('nonsense', {}), false);
  F.send('question', { job: 'store', text: '3 + 4 = ?' });
  assert.deepEqual(f.calls[0].body.data, { rider: 2, tier: 'gaming', job: 'store', text: '3 + 4 = ?' });
  F.context = () => { throw new Error('no game'); };
  assert.equal(F.send('note', { text: 'n' }), true);
});

test('answers: an answer event each, a job started by the first answer in it, level changes, the recent list', () => {
  let t = 0;
  const f = fetcher(), F = makeFeedback({ storage: store(), host: '127.0.0.1', fetch: f, now: () => t });
  let job = 'roundup';
  F.context = () => ({ job });
  F.answered({ strand: 'mul', at: 42.04, right: true, ms: 2310.4, level: 41, before: 40 });
  t += 1000;
  F.answered({ strand: 'mul', at: 42, right: false, ms: null, level: 39.5, before: 41 });   // (crosses the 40 band)
  F.answered({ strand: 'words', at: 30, right: true, also: true, level: 31, before: 30 });  // (another strand: its level only)
  assert.equal(F.job(), 'roundup');
  const r = F.jobEnd('roundup');
  assert.deepEqual({ answers: r.answers, right: r.right }, { answers: 2, right: 1 });
  assert.equal(F.jobEnd('roundup'), null, 'ended once');
  job = 'store'; F.answered({ strand: 'words', at: 20, right: true, level: 20.5, before: 20 });
  job = 'boxes'; F.answered({ strand: 'eq', at: 50, right: true, level: 50, before: 49, placed: true, justPlaced: true });
  const types = F.queued().map((e) => `${e.type}${e.go ? ':' + e.go : ''}`);
  assert.deepEqual(types, ['job:start', 'answer', 'answer', 'level', 'job:end', 'job:start', 'answer', 'job:end', 'job:start', 'answer', 'level']);
  const a = F.queued().find((e) => e.type === 'answer');
  assert.deepEqual({ strand: a.strand, pct: a.pct, right: a.right, ms: a.ms, job: a.job }, { strand: 'mul', pct: 42, right: true, ms: 2310, job: 'roundup' });
  const sw = F.queued().filter((e) => e.go === 'end')[1];
  assert.equal(sw.why, 'switch');
  assert.equal(F.recent().length, 4);
  assert.equal(F.last().strand, 'eq');
  assert.doesNotThrow(() => { F.answered(null); F.answered({}); });
  // no names and no free text in the events
  for (const e of F.queued()) for (const v of Object.values(e)) assert.ok(typeof v !== 'string' || v.length < 20);
});

test('maker notes are remembered on the device', () => {
  const s = store();
  const F = makeFeedback({ storage: s });
  assert.equal(F.maker(), false);
  F.setMaker(true); assert.equal(makeFeedback({ storage: s }).maker(), true);
  F.setMaker(false); assert.equal(makeFeedback({ storage: s }).maker(), false);
});
