// Saloon life in plain numbers: songs that end and the next one picked (src/bandplan.js songLines, nextSong), the band's
// last chord (src/audio/songend.js), the crowd's applause (src/audio/applause.js: noise only, each person their own pace,
// swelling and dying away), and the townsfolk's places in the hall (src/saloonfolkplan.js, with the saloon's own places
// from tests/fixtures/saloon-crowd.json, as labs/buildings/saloon.js builds them: nobody at the chalkboard, every place
// walkable, every walk clear of the furniture). How it SOUNDS and LOOKS is for ears and eyes: ~/pw/bandit-math/rigs/
// saloon/saloon_game.cjs.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SONGS, makeRandom } from '../src/audio/stagemusic.js';
import { songLines, nextSong, bandLine, bandChoices, groupOf, BAND } from '../src/bandplan.js';
import { homeOf, ENDING } from '../src/audio/songend.js';
import { applausePlan, clapNote, whistleNotes, CROWD_PATCHES, CLAP, APPLAUSE } from '../src/audio/applause.js';
import { SALOON_FOLK, crowdMost, spotsOf, pickSpot, makeNav, lookAt } from '../src/saloonfolkplan.js';
import { DIALS, START, levelsAt } from '../world/governor.js';

const FX = JSON.parse(readFileSync(new URL('./fixtures/saloon-crowd.json', import.meta.url), 'utf8'));
const lineSecs = (s) => s.beat * s.bar * 4;

test('a song goes on two to three minutes; a written tune ends at the end of a round, at least twice round', () => {
  for (const s of SONGS) for (const intro of [true, false]) for (const u of [0, 0.5, 0.999]) {
    const n = songLines(s, { intro, rand: () => u }), secs = n * lineSecs(s);
    if (s.round) {
      const k = n - (intro ? 1 : 0);
      assert.equal(k % s.round, 0, `${s.id}: whole rounds`);
      assert.ok(k / s.round >= BAND.length.rounds, `${s.id}: twice round at least`);
      assert.ok(secs > 95 && secs < 260, `${s.id}: ${secs.toFixed(0)} s`);
    } else {
      assert.ok(secs >= BAND.length.secs[0] - 1e-6 && secs < BAND.length.secs[1] + lineSecs(s) + 1e-6, `${s.id}: ${secs.toFixed(0)} s`);
    }
  }
  // (the short tunes go round more times)
  const sally = SONGS.find((s) => s.id === 'sally'), fishers = SONGS.find((s) => s.id === 'fishers');
  if (sally && fishers) assert.ok(songLines(sally, { intro: false, rand: () => 0.5 }) / sally.round > songLines(fishers, { intro: false, rand: () => 0.5 }) / fishers.round);
});

test('the next song: never one of the last two, the band\'s own and the old tunes about as often, every song in turn', () => {
  const rnd = makeRandom(11), played = ['easy'], seen = new Map(), side = { own: 0, old: 0 };
  for (let i = 0; i < 2000; i++) {
    const s = nextSong({ played, rand: rnd.next });
    assert.ok(!played.slice(-2).includes(s.id), `${s.id} after ${played.slice(-2)}`);
    played.push(s.id); seen.set(s.id, (seen.get(s.id) || 0) + 1); side[groupOf(s)]++;
  }
  for (const s of SONGS) assert.ok(seen.get(s.id) > 60, `${s.id} came ${seen.get(s.id) || 0} times`);
  const own = side.own / (side.own + side.old);
  assert.ok(own > 0.38 && own < 0.62, `the band's own ${(own * 100).toFixed(0)}%`);
  // (with no history at all: some song)
  assert.ok(SONGS.includes(nextSong({ played: [] })));
});

test('the harmonica player names the next song in one short line', () => {
  for (const s of SONGS) { const t = bandLine('next', s); assert.ok(t.includes(s.name) && t.length <= 34, t); }
});

test('the card: eleven songs in two groups, the number row along for keys, and the break', () => {
  const rows = bandChoices({ song: 'joeclark' });
  assert.equal(rows.length, SONGS.length + 1);
  const keys = rows.map((r) => r.key).filter(Boolean);
  assert.equal(new Set(keys).size, keys.length, 'no key twice');
  assert.ok(rows.filter((r) => r.group === 'own').length === 4 && rows.filter((r) => r.group === 'old').length === SONGS.length - 4);
  assert.equal(rows.find((r) => r.on).id, 'joeclark');
});

test('the last chord: the home note in the harmonica\'s range, on the home chord\'s root; a written tune\'s from its round', () => {
  for (const s of SONGS) {
    const H = homeOf(s);
    assert.ok(H.harp >= ENDING.range[0] && H.harp <= ENDING.range[1], `${s.id}: ${H.harp}`);
    assert.equal(H.harp % 12, H.root % 12, `${s.id}: the home note is the chord's root`);
    assert.ok(H.root >= 36 && H.root <= 50, `${s.id}: the bass ${H.root}`);
    assert.equal(H.voicing.length, 3);
    if (H.under != null) assert.ok(H.harp - H.under >= 3 && H.harp - H.under <= 5);
  }
  assert.equal(homeOf('easy').harp % 12, 7, 'Easy Afternoon ends on G');
  assert.equal(homeOf('lonesome').root % 12, 4, 'Lonesome Trail on E');
  assert.equal(homeOf('soldiers').root % 12, 9, "Soldier's Joy (in D, played down a fourth) on A");
});

test('the clap: noise through band-passes, no tones; its crack between 1 and 2.5 kHz, tens of milliseconds', () => {
  const P = CROWD_PATCHES[CLAP];
  assert.ok(P.nodes.every((n) => n.type !== 'osc'), 'no oscillators');
  for (const tone of [0.78, 1.0, 1.23]) for (const cup of [0, 1]) {
    const n = clapNote({ vel: 0.8, tone, cup }), f = n.nodes.find((x) => x.id === 'crack-f'), e = n.nodes.find((x) => x.id === 'crack-e');
    assert.equal(f.ftype, 'bandpass');
    assert.ok(f.freq >= 1000 && f.freq <= 2500, `crack ${f.freq.toFixed(0)} Hz`);
    assert.ok(e.decay >= 0.01 && e.decay <= 0.05, `decay ${e.decay}`);
  }
  // (a whistle is a whistle: the one tone the crowd makes, two quick notes)
  assert.equal(whistleNotes().length, 2);
});

test('the applause: each person at their own pace, a little ragged, swelling in and dying away over two to five seconds', () => {
  const people = Array.from({ length: 8 }, (_, i) => ({ id: 'p' + i })), rnd = makeRandom(4);
  const plan = applausePlan(people, { rand: rnd.next });
  assert.equal(plan.hands.length, 8);
  assert.ok(new Set(plan.hands.map((h) => h.rate.toFixed(2))).size > 5, 'their own paces');
  for (const h of plan.hands) {
    assert.ok(h.rate >= APPLAUSE.rate[0] && h.rate <= APPLAUSE.rate[1]);
    assert.ok(h.from >= APPLAUSE.start[0] - 1e-9 && h.from <= APPLAUSE.start[1] + 1e-9);
    assert.ok(h.to - h.from >= APPLAUSE.last[0] - 1e-9 && h.to - h.from <= APPLAUSE.last[1] + 1 + 1e-9);
    for (let i = 1; i < h.claps.length; i++) {
      const gap = h.claps[i].t - h.claps[i - 1].t, beat = 1 / h.rate;
      assert.ok(gap > beat * (1 - APPLAUSE.wobble) - 1e-3 && gap < beat * (1 + APPLAUSE.wobble) + 1e-3, `gap ${gap}`);
    }
    for (const c of h.claps) assert.ok(c.vel > 0 && c.vel <= 1 && c.tone > 0.7 && c.tone < 1.35);
    const mid = h.claps[Math.floor(h.claps.length / 2)];
    assert.ok(h.claps[0].vel < mid.vel * 1.08 && h.claps[h.claps.length - 1].vel < mid.vel, 'swells in, dies away');
  }
  assert.ok(plan.end > 2 && plan.end < 6, `over by ${plan.end.toFixed(1)} s`);
  // (the whistle and the call out only with company; never from nobody)
  assert.equal(applausePlan([], { rand: rnd.next }).hands.length, 0);
  for (let i = 0; i < 50; i++) assert.equal(applausePlan([{ id: 'a' }, { id: 'b' }], { rand: rnd.next }).whistle, null);
  let shouts = 0; for (let i = 0; i < 200; i++) { const p = applausePlan(people, { rand: rnd.next }); if (p.shout) { shouts++; assert.ok(APPLAUSE.shouts.includes(p.shout.text)); } }
  assert.ok(shouts > 50 && shouts < 150, `${shouts} of 200 with a call out`);
});

test('the crowd by tier: potato a few, gaming more; the governor\'s saloon dial agrees', () => {
  assert.ok(crowdMost('potato') <= 3 && crowdMost('gaming') > crowdMost('normal') && crowdMost('normal') > crowdMost('potato'));
  const at = (t) => DIALS.saloon.levels[levelsAt(START.scenery[t], START.people[t]).saloon].v;
  for (const t of ['potato', 'normal', 'gaming']) assert.equal(at(t), crowdMost(t), t);
  assert.equal(DIALS.saloon.lane, 'people');
});

test('the saloon\'s places: nobody at the chalkboard or its teacher\'s and player\'s spots, on the stage, in a doorway', () => {
  const C = FX.crowd, S = spotsOf(C), cb = FX.chalkboard, R = FX.stageRect;
  assert.ok(S.length >= 15, `${S.length} places`);
  assert.ok(S.some((s) => s.kind === 'chair') && S.some((s) => s.kind === 'stool') && S.some((s) => s.kind === 'stand'));
  for (const s of S) {
    assert.ok(Math.hypot(s.x - cb.centre[0], s.z - cb.centre[2]) > 1.6, `${s.kind} at ${s.x},${s.z}: the chalkboard`);
    for (const k of ['teacher', 'player']) assert.ok(Math.hypot(s.x - cb[k].x, s.z - cb[k].z) > 1.1, `${s.kind} at ${s.x},${s.z}: the ${k}'s spot`);
    assert.ok(!(s.x > R.x0 && s.x < R.x1 && s.z > R.z0 && s.z < R.z1), 'on the stage');
    for (const d of FX.doorways) assert.ok(Math.hypot(s.x - d.centre[0], s.z - d.centre[2]) > 1.2, 'in a doorway');
    const W = C.walls; assert.ok(s.x > W[0] && s.x < W[2] && s.z > W[1] && s.z < W[3], 'in the hall');
  }
  // (no two places on top of each other)
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) assert.ok(Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z) > 0.5);
});

test('the walks: every place reached from both doors, round the furniture, clear of the chalkboard\'s spots', () => {
  const C = FX.crowd, nav = makeNav(C), S = spotsOf(C), cb = FX.chalkboard;
  const inThing = (p) => C.obstacles.circles.some((c) => Math.hypot(c[0] - p.x, c[1] - p.z) < c[2] + 0.1)
    || C.obstacles.rects.some((r) => p.x > Math.min(r[0], r[2]) && p.x < Math.max(r[0], r[2]) && p.z > Math.min(r[1], r[3]) && p.z < Math.max(r[1], r[3]));
  for (const s of S) for (const d of C.doors) {
    const p = nav.path(nav.nodes[d.node], s.at);
    assert.ok(p && p.length >= 2, `${s.kind} ${s.i} from door ${d.name}`);
    for (let k = 1; k < p.length; k++) for (let u = 0; u <= 1; u += 0.05) {
      const q = { x: p[k - 1].x + (p[k].x - p[k - 1].x) * u, z: p[k - 1].z + (p[k].z - p[k - 1].z) * u };
      assert.ok(!inThing(q), `the walk to ${s.kind} ${s.i} goes through something at ${q.x.toFixed(2)},${q.z.toFixed(2)}`);
      assert.ok(Math.hypot(q.x - cb.player.x, q.z - cb.player.z) > 0.7 && Math.hypot(q.x - cb.teacher.x, q.z - cb.teacher.z) > 0.7, 'past the chalkboard\'s spots');
    }
  }
});

test('a newcomer takes a free place, likelier one facing the stage; the head turns toward the band within reach', () => {
  const S = spotsOf(FX.crowd), rnd = makeRandom(3), counts = new Map();
  for (let i = 0; i < 4000; i++) { const s = pickSpot(S, new Set(), rnd.next); counts.set(s.i, (counts.get(s.i) || 0) + 1); }
  const facing = S.filter((s) => s.kind === 'chair' && s.view > 0.8), away = S.filter((s) => s.kind === 'chair' && s.view < -0.8);
  const avg = (L) => L.reduce((a, s) => a + (counts.get(s.i) || 0), 0) / Math.max(1, L.length);
  assert.ok(avg(facing) > 2 * avg(away), 'the seats facing the stage are liked more');
  // (full: none; one left: that one)
  const all = new Set(S.map((s) => s.i)); assert.equal(pickSpot(S, all, rnd.next), null);
  const left = new Set(S.slice(1).map((s) => s.i)); assert.equal(pickSpot(S, left, rnd.next).i, S[0].i);
  for (const a of [-3, -1, 0, 1, 3]) { const v = lookAt(0, { x: 0, z: 0 }, { x: Math.sin(a), z: Math.cos(a) }); assert.ok(Math.abs(v) <= SALOON_FOLK.head + 1e-9); }
  assert.ok(Math.abs(lookAt(0, { x: 0, z: 0 }, { x: 0.3, z: 1 }) - Math.atan2(0.3, 1)) < 1e-9);
});
