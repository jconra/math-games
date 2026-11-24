// FRIENDSHIP (src/friends.js): everyone's meter, kept with each crew member's own progress; half a pip a talk, then
// nothing more for 5 minutes; one and a half for a game of Mathball; a rescued survivor at 3 stays for good, under 3
// leaves 15 minutes after the last tap (or after coming home); old saves load with empty meters.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FRIENDS, meterOf, add, talk, talkWait, tap, staysForGood, agreesToCrew, leavesAt, left, makeFriends, waitWords, nameFor, nameOf, RESCUED_NAMES } from '../src/friends.js';
import { kept, WARD, ABOUT } from '../src/wardplan.js';
import { FRIEND_TALK, friendTalk } from '../src/lines.js';
import { ROSTER, ROOM_CREW } from '../src/life.js';
import { MISSIONS, roleOf } from '../src/missions.js';

const MIN = 60e3;

test('the numbers are the ones put to the game\'s maker', () => {
  assert.deepEqual([FRIENDS.pips, FRIENDS.talk, FRIENDS.game, FRIENDS.stays, FRIENDS.crew, FRIENDS.talkGap, FRIENDS.leave], [10, 0.5, 1.5, 3, 5, 5 * MIN, 15 * MIN]);
});

test('a talk fills half a pip; another fills nothing until 5 minutes have passed', () => {
  const c = { id: 'a' }, t0 = 1e12;
  let r = talk(c, 'cook', t0);
  assert.equal(r.counted, true); assert.equal(r.pips, 0.5);
  r = talk(c, 'cook', t0 + 1 * MIN);
  assert.equal(r.counted, false); assert.equal(r.pips, 0.5); assert.equal(r.wait, 4 * MIN);
  assert.equal(talkWait(c, 'cook', t0 + 4.5 * MIN), 0.5 * MIN);
  assert.equal(talk(c, 'cook', t0 + 5 * MIN - 1).counted, false);
  r = talk(c, 'cook', t0 + 5 * MIN);
  assert.equal(r.counted, true); assert.equal(r.pips, 1);
  // (another person's talk is their own)
  assert.equal(talk(c, 'medic', t0 + 5 * MIN).pips, 0.5);
  // (six talks spaced out: 3 pips, the stay mark)
  const d = {}; for (let i = 0; i < 6; i++) talk(d, 'x', t0 + i * 5 * MIN);
  assert.equal(meterOf(d, 'x').p, 3); assert.equal(staysForGood(d, 'x'), true);
  assert.equal(waitWords(4 * MIN), '4 min'); assert.equal(waitWords(30e3), 'less than a minute'); assert.equal(waitWords(0), 'now');
});

test('a game of Mathball fills one and a half, won or lost; the meter tops out at 10 and never goes down', () => {
  const c = {};
  assert.equal(add(c, 'vega', FRIENDS.game, 'mathball'), 1.5);
  assert.equal(add(c, 'vega', FRIENDS.game, 'mathball, won'), 3);
  assert.equal(add(c, 'vega', -2), 3, 'nothing ever takes from it');
  for (let i = 0; i < 10; i++) add(c, 'vega', FRIENDS.game);
  assert.equal(meterOf(c, 'vega').p, 10);
  assert.equal(agreesToCrew(c, 'vega'), true);
  const e = {}; add(e, 'sol', 4.5); assert.equal(agreesToCrew(e, 'sol'), false); add(e, 'sol', 0.5); assert.equal(agreesToCrew(e, 'sol'), true);
});

test('a rescued survivor under 3 leaves 15 minutes after the last tap (or after coming home); at 3 they stay for good', () => {
  const c = {}, came = 1e12;
  assert.equal(leavesAt(c, 'rescued-1', came), came + 15 * MIN, 'never tapped: from coming home');
  tap(c, 'rescued-1', came + 10 * MIN);
  assert.equal(leavesAt(c, 'rescued-1', came), came + 25 * MIN, 'tapped: from the tap');
  add(c, 'rescued-1', 2.5);
  assert.equal(leavesAt(c, 'rescued-1', came), came + 25 * MIN, '2.5: still leaves');
  add(c, 'rescued-1', 0.5);
  assert.equal(leavesAt(c, 'rescued-1', came), Infinity, '3: stays for good');
});

test('the saved ward by the friends\' rule: kept while staying, about the station once out of bed, those staying for good beyond the room', () => {
  const now = 2e12, c = {};
  const L = [
    { look: 'zuri', bed: 0, until: now + 5e3, id: 'r-a', name: 'Nell', came: now - 2 * MIN },     // in bed still
    { look: 'kai', bed: 1, until: now - 1e3, id: 'r-b', name: 'Otto', came: now - 13 * MIN },     // out of bed, 2 min to go
    { look: 'sol', bed: -1, until: now - 1e3, id: 'r-c', name: 'Rosa', came: now - 16 * MIN },    // gone: 16 min, never tapped
    { look: 'ana', bed: -1, until: now - 1e3, id: 'r-d', name: 'Finn', came: now - 60 * MIN },    // stays: 3 pips
  ];
  add(c, 'r-d', 3);
  const leaves = (r) => leavesAt(c, r.id, r.came);
  const k = kept(L, now, leaves);
  assert.deepEqual(k.map((r) => [r.name, r.bed]), [['Nell', 0], ['Otto', -1], ['Finn', -1]]);
  // (a tap a while ago keeps the one who would have gone)
  tap(c, 'r-c', now - 5 * MIN);
  assert.deepEqual(kept(L, now, leaves).map((r) => r.name), ['Nell', 'Otto', 'Rosa', 'Finn']);
  // (those staying for good take none of ABOUT.most's room)
  const many = Array.from({ length: ABOUT.most + 4 }, (_, i) => ({ look: 'p', bed: -1, until: now - 1, id: 'f' + i, came: now - 99 * MIN }));
  for (const r of many) add(c, r.id, 3);
  assert.equal(kept(many, now, leaves).length, many.length);
  // (without the rule: as before, the ward's while)
  assert.deepEqual(kept(L, now).map((r) => r.name), ['Nell']);
});

test('old saves load with empty meters: no friends, no departed, ward records with no id or name', () => {
  const old = { id: 'p1', name: 'Kim', look: { id: 'a' }, credits: 40, ward: [{ look: 'zuri', bed: 0, until: 3e12 }, { look: 'kai', bed: -1, until: 3e12 + 5 }] };
  assert.deepEqual(meterOf(old, 'cook'), { p: 0, talk: 0, tap: 0 });
  assert.equal(staysForGood(old, 'cook'), false);
  assert.equal(talkWait(old, 'cook', 1e12), 0);
  const k = kept(old.ward, 3e12 - WARD.stay[1] * 1000);
  assert.ok(k.every((r) => /^rescued-/.test(r.id) && RESCUED_NAMES.includes(r.name) && r.came > 0));
  assert.notEqual(k[0].id, k[1].id);
  assert.deepEqual(kept(old.ward, 3e12 - 1).map((r) => r.id), kept(old.ward, 3e12 - 1).map((r) => r.id), 'the same ids each load');
  // (a meter of nonsense read as empty; a half kept, a third rounded to halves)
  assert.equal(meterOf({ friends: { x: { p: 'lots' } } }, 'x').p, 0);
  assert.equal(meterOf({ friends: { x: { p: 1.3 } } }, 'x').p, 1.5);
  assert.equal(meterOf({ friends: [] }, 'x').p, 0);
});

test('each crew member has their own meters; the game\'s saves as it changes', () => {
  const a = { id: 'a' }, b = { id: 'b' };
  let who = a, saves = 0, t = 1e12;
  const F = makeFriends({ crew: () => who, save: () => saves++, clock: () => t });
  F.talk('cook'); F.add('vega', 1.5, 'mathball');
  assert.equal(F.pips('cook'), 0.5); assert.equal(F.pips('vega'), 1.5); assert.ok(saves >= 2);
  who = b;
  assert.equal(F.pips('cook'), 0); assert.equal(F.agreesToCrew('vega'), false);
  assert.equal(a.friends.cook.p, 0.5); assert.ok(!b.friends || !b.friends.cook);
  t += 6 * MIN; who = a; assert.equal(F.talk('cook').counted, true); assert.equal(F.pips('cook'), 1);
});

test('who left is kept (look, name, the meter they had) and their ward record let go', () => {
  const c = { ward: [{ id: 'r-a', look: 'zuri', bed: -1, until: 1 }, { id: 'r-b', look: 'kai', bed: 0, until: 1 }] };
  add(c, 'r-a', 1.5);
  const r = left(c, { id: 'r-a', name: 'Nell', look: 'zuri', position: 'pilot' }, 5e12);
  assert.deepEqual(r, { id: 'r-a', name: 'Nell', look: 'zuri', position: 'pilot', pips: 1.5, at: 5e12 });
  assert.deepEqual(c.departed, [r]); assert.deepEqual(c.ward.map((x) => x.id), ['r-b']);
  left(c, { id: 'r-a', name: 'Nell', look: 'zuri' }); assert.equal(c.departed.length, 1, 'once');
});

test('the rescued get names of their own; the talks read well', () => {
  // (everyone with a name already: who walks the station, who works in the control room and in Cargo, the captains'
  // crews, Mathball's own players; "Teo" and "Theo" sound the same, so that one is held off by hand)
  const station = [...ROSTER, ...ROOM_CREW, ...Object.values(MISSIONS).flatMap((M) => (M.roles || []).map((id) => ({ name: roleOf(M, id).crew }))), { name: 'Ola' }, { name: 'Theo' }].map((d) => String(d.name || '').toLowerCase());
  assert.ok(station.includes('nell') && station.includes('pilot wren') && station.includes('ola'), 'the list of names in use reaches Cargo, the crews and the arena');
  for (const n of RESCUED_NAMES) assert.ok(!station.some((s) => s.split(/\s+/).includes(n.toLowerCase())), n + ' is a station person\'s name');
  assert.equal(new Set(RESCUED_NAMES).size, RESCUED_NAMES.length, 'no name twice');
  assert.notEqual(nameFor(['Nora'], () => 0), 'Nora');
  assert.equal(nameOf('x'), nameOf('x'));
  for (const t of [...FRIEND_TALK.yours, ...FRIEND_TALK.rescued]) {
    assert.ok(t.lines.length >= 2 && t.lines.length <= 4, t.id);
    assert.ok(t.lines.some((s) => s.startsWith('P: ')), t.id + ': the player says something');
    for (const s of t.lines) assert.ok(s.length <= 90, t.id + ': ' + s);
  }
  const first = friendTalk({ rescued: true, first: true, name: 'Nell', player: 'Kim' });
  assert.equal(first.id, 'fr-thanks'); assert.ok(first.lines.some((l) => /Nell/.test(l.words)));
  assert.deepEqual(first.lines.map((l) => l.who), ['them', 'you', 'them']);
  for (let i = 0; i < 20; i++) assert.notEqual(friendTalk({ last: 'ft-soup' }).id, 'ft-soup');
});
