// The banjo player in plain numbers: the banjo at full size (src/banjoplan.js), on his lap where his clips have it,
// his hands on it, and the music telling him when to pick (its banjo notes: the tune's turns and the strum). How it
// LOOKS is for eyes: ~/pw/bandit-math/rigs/banjoplayer/look.cjs.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { BANJO, PLACE, STOOL, HANDS, fret, placeFrame, placeMatrix, handFrame, banjoPlaying } from '../src/banjoplan.js';
import { makeStageMusic } from '../src/audio/stagemusic.js';

// a stand-in for the Web Audio API: every node, param and buffer a stub that takes anything (only what is scheduled
// matters here, not the sound). offline: an OfflineAudioContext of that many seconds (the music makes it all at once)
function stub(counts) {
  const store = {};
  const p = new Proxy(function () {}, {
    get(t, k) {
      if (k in store) return store[k];
      if (k === 'then' || k === Symbol.iterator) return undefined;
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'connect') return (n) => n;
      if (k === 'value' || k === 'length' || k === 'duration') return 0;
      return (store[k] = stub(counts));
    },
    set(t, k, v) { store[k] = v; return true; },
    apply() { return stub(counts); },
  });
  return p;
}
function fakeCtx({ offline = 0 } = {}) {
  const counts = { sources: 0, kit: 0 };
  const ctx = stub(counts);
  ctx.currentTime = 0; ctx.sampleRate = 44100; ctx.counts = counts;
  // (a source given one of the fiddle's samples is counted: a bowed note)
  ctx.createBufferSource = () => { counts.sources++; return new Proxy(stub(counts), { set(t, k, v) { if (k === 'buffer' && v && v.kitBuf) counts.kit++; t[k] = v; return true; } }); };
  ctx.createBuffer = (ch, len, sr) => ({ numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: () => new Float32Array(len) });
  if (offline) { ctx.length = offline * 44100; ctx.startRendering = () => Promise.resolve(null); }
  return ctx;
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('the banjo is full size: an 11 inch pot, a 26 inch scale, the fifth peg at the fifth fret', () => {
  assert.ok(near(BANJO.pot.r * 2, 0.28, 0.01));
  assert.ok(near(BANJO.nut - BANJO.bridge, 0.66, 1e-9));
  assert.ok(near(fret(12), BANJO.bridge + 0.33, 1e-9), 'the twelfth fret halfway');
  assert.ok(fret(BANJO.peg5) > BANJO.pot.r && fret(BANJO.peg5) < BANJO.nut, 'the fifth peg on the neck');
  assert.ok(BANJO.length > 0.85 && BANJO.length < 0.98, `${BANJO.length} m overall`);
});

test('on his lap: a square frame, the pot over the stool, the neck rising to his left, the head out to the room', () => {
  const F = placeFrame(), M = placeMatrix();
  for (const [a, b] of [[F.x, F.y], [F.y, F.z], [F.x, F.z]]) assert.ok(near(dot(a, b), 0, 1e-9));
  for (const v of [F.x, F.y, F.z]) assert.ok(near(dot(v, v), 1, 1e-9));
  assert.deepEqual(M.slice(12, 15), PLACE.at);
  assert.ok(F.x[0] > 0.7 && F.x[1] > 0.2, 'the neck to his left and up');
  assert.ok(F.y[2] > 0.8, 'the head faces the way he faces');
  assert.ok(F.z[1] < 0, 'the fifth peg\'s side (-z) is the neck\'s upper side');
  assert.ok(PLACE.at[1] - BANJO.pot.r > STOOL.h, 'the pot\'s lowest edge above the stool\'s top (on his thigh)');
  assert.ok(PLACE.at[2] > 0.15 && PLACE.at[2] < 0.35, 'in front of him, not in his belly or past his knees');
});

test('the hands: the right over the head between the bridge and the neck, the left round the neck on the frets', () => {
  for (const pose of ['play', 'rest']) {
    const R = handFrame(pose, 'R'), L = handFrame(pose, 'L');
    for (const H of [R, L]) { assert.ok(near(dot(H.y, H.z), 0, 1e-9)); assert.ok(near(dot(H.x, H.x), 1, 1e-9)); }
    assert.ok(Math.hypot(R.at[0], R.at[2]) < BANJO.pot.r + 0.02 && R.at[1] > 0.03, `${pose}: the right wrist over the head`);
    assert.ok(L.at[0] > BANJO.pot.r + 0.1 && L.at[0] < BANJO.nut && L.at[1] < 0, `${pose}: the left wrist behind the neck`);
  }
  assert.ok(handFrame('play', 'R').y[1] < 0, 'the picking fingers toward the strings');
});

test('the music says when he picks: through the banjo\'s notes in a banjo song, never in a song without a banjo', () => {
  const banjoSong = { id: 'cripple' }, other = { id: 'easy' };   // (a banjo tune; one of the band's own, with no banjo in it)
  const ctx = fakeCtx({ offline: 120 }), M = makeStageMusic(ctx, { harp: stub({}), piano: stub({}), box: stub({}), room: stub({}), banjo: stub({}), banjoSynth: true, song: banjoSong.id, intro: false, seed: 3 });
  M.start(0.2);
  const notes = M.events.filter((e) => e.what === 'banjo');
  assert.ok(notes.length > 20, `${notes.length} banjo notes`);
  for (const e of notes.slice(0, 40)) assert.ok(banjoPlaying(M.events, e.at + e.len / 2), 'picking while a note sounds');
  const end = Math.max(...notes.map((e) => e.at + e.len));
  assert.ok(!banjoPlaying(M.events, end + 3), 'resting once the notes are done');
  const M2 = makeStageMusic(fakeCtx({ offline: 60 }), { harp: stub({}), piano: stub({}), banjo: stub({}), banjoSynth: true, song: other.id, intro: false, seed: 3 });
  M2.start(0.2);
  assert.equal(M2.events.filter((e) => e.what === 'banjo').length, 0);
  assert.ok(!banjoPlaying(M2.events, 10));
});
