// ROUTINE CHECK-UPS AT THE BIG SCANNER (src/checkup.js; people.js THE SCANNER'S QUEUE). The game's maker (2026-11-23):
// "I feel like the scanner should always be getting used, Whether for rescue mission survivors or people that live on
// the station getting routine check ups."
// node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHECKUP, OPEN, spare, needed, whoseTurn, firstCome, paged } from '../src/checkup.js';
import { ROSTER, ROOM_CREW, SEATS } from '../src/life.js';
import { SCAN_TALK, CHECKUP_TALK } from '../src/lines.js';
import { SCAN_WAIT, SCAN_STEP } from '../src/wardplan.js';

const standing = (o = {}) => ({ act: 'stand', phase: 'do', ...o });

test('who can be spared: anyone standing, sitting, at their post or walking about; and who cannot, with why', () => {
  for (const act of ['stand', 'post', 'sit', 'walk', 'wait']) assert.equal(spare({ act, phase: act === 'sit' ? 'sat' : 'do' }), null, act);
  assert.equal(spare({ act: 'sit', phase: 'go' }), null, 'on their way to a seat');
  assert.equal(spare(standing({ medic: true })), 'the medic');
  assert.equal(spare(standing({ home: 'store' })), 'the lift');
  assert.equal(spare(standing({ rescued: true })), 'rescued');
  assert.equal(spare(standing({ hidden: true })), 'away');
  assert.equal(spare(standing({ queued: true })), 'queued');
  for (const act of ['scan', 'scanMedic', 'drive', 'ward', 'talk', null]) assert.equal(spare({ act, phase: 'do' }), 'busy', String(act));
  assert.equal(spare(standing({ talking: true })), 'busy');
  assert.equal(spare(standing({ fleeing: true })), 'busy');
  assert.equal(spare(standing({ scripted: true })), 'busy');
  for (const phase of ['sitting', 'rising']) assert.equal(spare({ act: 'sit', phase }), 'busy', phase);
  assert.equal(spare(null), 'nobody');
});

test('a captain: spared only with no contract open and not with the crew member', () => {
  const cap = (K) => standing({ captain: { busy: false, meet: false, seeking: false, state: 'new', ...K } });
  for (const state of ['new', 'asked', 'declined']) assert.equal(spare(cap({ state })), null, state);
  for (const state of OPEN) assert.equal(spare(cap({ state })), 'the captain', state);
  assert.deepEqual(OPEN, ['interested', 'signed', 'payout']);
  assert.equal(spare(cap({ busy: true })), 'the captain', 'making their offer, or their contract\'s card up');
  assert.equal(spare(cap({ meet: true })), 'the captain', 'gone to wait by their ship');
  assert.equal(spare(cap({ seeking: true })), 'the captain', 'the crew member is being led to them');
  // (called and then needed: let go; only stopping on the way to make their offer: not)
  assert.equal(needed({ meet: true, state: 'new' }), true); assert.equal(needed({ state: 'signed' }), true);
  assert.equal(needed({ busy: true, state: 'asked' }), false); assert.equal(needed(null), false);
});

test('turn and turn about: the fewest check-ups first, then the longest ago, then the nearest', () => {
  const L = [{ id: 'a', far: 80, order: 0 }, { id: 'b', far: 20, order: 1 }, { id: 'c', far: 50, order: 2 }];
  assert.equal(whoseTurn(L, {}).id, 'b', 'nobody has had one: the nearest');
  assert.equal(whoseTurn(L, { b: { n: 1, at: 100 } }).id, 'c');
  assert.equal(whoseTurn(L, { b: { n: 1, at: 100 }, c: { n: 1, at: 200 } }).id, 'a');
  assert.equal(whoseTurn(L, { a: { n: 1, at: 300 }, b: { n: 1, at: 100 }, c: { n: 1, at: 200 } }).id, 'b', 'all had one: the one longest ago');
  assert.equal(whoseTurn(L, { a: { n: 2, at: 50 }, b: { n: 1, at: 100 }, c: { n: 1, at: 200 } }).id, 'b');
  assert.equal(whoseTurn([], {}), null);
  // (a day of it: fourteen people, wherever they happen to be; everyone has one before anyone has two, and nobody
  // twice running)
  const P = Array.from({ length: 14 }, (_, i) => ({ id: 'p' + i, order: i })), done = {}, came = [];
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let t = 0; t < 70; t++) {
    for (const p of P) p.far = 5 + rand() * 140;
    // (two or three of them busy at any moment)
    const free = P.filter(() => rand() > 0.18), w = whoseTurn(free, done);
    assert.ok(w); came.push(w.id); (done[w.id] = done[w.id] || { n: 0, at: 0 }).n++; done[w.id].at = t;
  }
  for (let i = 1; i < came.length; i++) assert.notEqual(came[i], came[i - 1], 'the same one twice running');
  const n = P.map((p) => (done[p.id] || { n: 0 }).n);
  assert.ok(Math.max(...n) - Math.min(...n) <= 2, 'check-ups each: ' + n.join(' '));
  assert.equal(new Set(came.slice(0, 20)).size >= 13, true, 'the first twenty: ' + came.slice(0, 20).join(' '));
});

test('first come, first scanned: whoever sat down first, the rescued and the station\'s own alike', () => {
  const tam = { came: 40, own: true }, rescued = { came: 31.5, scan: true }, bo = { came: 55 }, coming = { came: null };
  assert.equal(firstCome([tam, rescued, bo, coming]), rescued);
  assert.equal(firstCome([bo, tam]), tam);
  assert.equal(firstCome([coming]), null, 'still on their way: not in the queue yet');
  assert.equal(firstCome([]), null);
});

test('one waiting or on the way behind the one at the scanner; the numbers', () => {
  assert.equal(CHECKUP.ahead, 1);
  assert.ok(CHECKUP.giveUp >= 240 && CHECKUP.sit >= 1 && CHECKUP.every <= 1);
  // (they wait where the rescued wait, and have the station's own scan: wardplan.js)
  assert.equal(SCAN_WAIT[0].do, 'sit:medWaiting'); assert.equal(SCAN_STEP.do, 'scan');
  assert.ok(SEATS.medWaiting.every((s) => s.room === 'medical'));
});

test('the medic is paged for a patient\'s scan and for the rescued, never for a routine check-up', () => {
  assert.equal(paged({ medic: { id: 'medic' }, patient: {} }), true);
  assert.equal(paged({ medic: { id: 'medic' }, patient: {}, checkup: true }), false);
  assert.equal(paged({ patient: {} }), false); assert.equal(paged(null), false);
  assert.match(fs.readFileSync(new URL('../src/announce.js', import.meta.url), 'utf8'), /paged\(busy\)\) events\.push\('scan'\)/);
});

test('the medic\'s words for a check-up: the same moments as a scan\'s, the patient named, nothing alarming', () => {
  assert.deepEqual(Object.keys(CHECKUP_TALK), Object.keys(SCAN_TALK));
  for (const [k, L] of Object.entries(CHECKUP_TALK)) {
    assert.ok(L.length >= 3, k);
    for (const w of L) { assert.ok(w.length <= 64, w); assert.doesNotMatch(w, /emergenc|urgent|hurt|pain|sick|\bill\b|wrong|danger|blood|broken|disease|scar/i, w); }
  }
  for (const w of CHECKUP_TALK.hello) { assert.match(w, /\{patient\}/); assert.match(w, /check-up/i); }
  assert.ok(CHECKUP_TALK.thanks.some((w) => /\{medic\}/.test(w)));
  // (and every line a check-up's own or one a scan already says: none says "scan" of a check-up)
  for (const w of Object.values(CHECKUP_TALK).flat()) assert.doesNotMatch(w, /your scan/i, w);
});

test('who lives on the station: the main deck\'s people come, the medic and the lift\'s two places do not', () => {
  const fact = (d, home = null) => standing({ medic: /medic/.test(d.id), home, captain: d.captain ? { state: 'new' } : null });
  const come = ROSTER.filter((d) => spare(fact(d)) == null).map((d) => d.id);
  assert.equal(come.length, ROSTER.length - 1);
  assert.ok(!come.includes('medic'));
  for (const id of ['cook', 'guard', 'smelter', 'rook', 'patient', 'mechanic', 'vega', 'hale']) assert.ok(come.includes(id), id);
  for (const d of ROOM_CREW) { assert.ok(d.place, d.id); assert.equal(spare(fact(d, d.place)), 'the lift', d.id); }
  // (today's patient: a day with the scan in it has a seat on the waiting benches just before it, where they join the
  // queue; the benches of that group are the medical centre's among others)
  const withScan = ROSTER.filter((d) => d.day.some((s) => s.do === 'scan'));
  assert.deepEqual(withScan.map((d) => d.id), ['patient', 'miner-oso']);
  for (const d of withScan) { const i = d.day.findIndex((s) => s.do === 'scan'); assert.equal(d.day[i - 1].do, 'sit:waiting', d.id); }
  assert.ok(SEATS.waiting.some((s) => s.room === 'medical'));
});

test('people.js: the scan the queue hands out is the station\'s own, for the rescued and the station\'s people alike', () => {
  const src = fs.readFileSync(new URL('../src/people.js', import.meta.url), 'utf8');
  // (one place claims the scan for anyone waiting, and it claims the station's own errand)
  assert.equal((src.match(/claimFor\(P, SCAN_STEP\)/g) || []).length, 2, 'scanErrand, and the one placed as the station loads');
  assert.match(src, /function scanErrand\(P, rec\)/);
  assert.match(src, /const a = scanErrand\(P, r\);/, 'the rescued (aboutNext)');
  assert.match(src, /const a = scanErrand\(P, c\);/, 'the station\'s own (checkNext)');
  assert.match(src, /scanWaitStep\(P, r\);/); assert.match(src, /scanWaitStep\(P, c\);/);
  assert.equal((src.match(/function scanPatient\(/g) || []).length, 1);
  assert.equal((src.match(/function scanMedic\(/g) || []).length, 1);
});
