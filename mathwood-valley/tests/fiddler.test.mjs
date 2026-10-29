// The fiddler in plain numbers: the fiddle and the bow at full size (src/fiddleplan.js), how they sit in his hands (the
// same numbers his Blender clips are made round), the bow resting on the string it plays and never through the others,
// and the music telling him when the fiddle plays (makeStageMusic's M.fiddleAt / M.nextFiddle) and his part of a song's
// end (playEnding with the fiddle). How it LOOKS and SOUNDS is for eyes and ears: ~/pw/bandit-math/rigs/band/band_game.cjs
// MODE=fiddler, ~/pw/bandit-math/rigs/fiddler/.
//   node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIDDLE, BOW, HOLD, CONTACT, BOW_TILT, HAIR_LOW, halfWidth, topY, stringAt, wristFrame, holdMatrix, fiddleData } from '../src/fiddleplan.js';
import { makeStageMusic, SONGS } from '../src/audio/stagemusic.js';
import { playEnding } from '../src/audio/songend.js';

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
const fakeKit = () => [55, 57, 60, 64, 67, 69, 72, 76, 79, 81, 84, 88].map((midi) => ({ name: String(midi), midi, speak: 0.05, buf: { kitBuf: true, duration: 2.8, length: 2.8 * 44100, numberOfChannels: 1 } }));
const near = (a, b, e) => Math.abs(a - b) <= e;

test('the fiddle and the bow are full size: body 35.5 cm, 59 cm overall, the bow 75 cm', () => {
  assert.equal(FIDDLE.body, 0.355);
  assert.ok(near(FIDDLE.scroll.x + FIDDLE.scroll.r + 0.0065, FIDDLE.length, 0.004), 'the scroll ends about 59 cm along');
  const widest = (x0, x1) => Math.max(...FIDDLE.outline.filter(([x]) => x >= x0 && x <= x1).map(([, w]) => w * 2));
  assert.ok(near(widest(0, 0.15), 0.206, 0.003), `the lower bout about 20.6 cm (${widest(0, 0.15)})`);
  assert.ok(near(widest(0.24, 0.355), 0.168, 0.004), `the upper bout about 16.8 cm (${widest(0.24, 0.355)})`);
  assert.ok(near(Math.min(...FIDDLE.outline.filter(([x]) => x > 0.16 && x < 0.23).map(([, w]) => w * 2)), 0.11, 0.003), 'the waist about 11 cm');
  assert.ok(near(FIDDLE.nut - FIDDLE.bridge.x, 0.325, 0.001), 'the strings sound 32.5 cm from the nut to the bridge');
  assert.equal(BOW.length, 0.75);
  assert.ok(BOW.hair.to - BOW.hair.from > 0.64, 'the hair runs most of the bow');
});

test('the bow crosses the strings between the bridge and the fingerboard\'s end, over the waist (clear of the bouts)', () => {
  assert.ok(CONTACT > FIDDLE.bridge.x + 0.015 && CONTACT < FIDDLE.fingerboard.from - 0.02, String(CONTACT));
  // (the bow, tilted to the outer strings, still clears the top's edge at the waist by a good margin)
  for (const [k, side] of [[0, -1], [3, 1]]) {
    const s = stringAt(k, CONTACT), w = halfWidth(CONTACT), drop = Math.tan(Math.abs(BOW_TILT[k])) * (w - Math.abs(s[2]));
    assert.ok(s[1] - drop > topY(CONTACT, side) + 0.01, `string ${k}: the bow over the edge ${(s[1] - drop).toFixed(3)}`);
  }
});

test('tilted to play a string, the bow rests on that string first (the others below it)', () => {
  for (let k = 0; k < 4; k++) {
    const phi = BOW_TILT[k], n = [0, Math.cos(phi), -Math.sin(phi)];   // (the bow's up, as the clip script has it)
    const h = [0, 1, 2, 3].map((j) => { const c = stringAt(j, CONTACT); return c[1] * n[1] + c[2] * n[2]; });
    const top = h.indexOf(Math.max(...h));
    assert.equal(top, k, `tilt ${phi}: string ${top} highest (${h.map((v) => v.toFixed(4))})`);
    for (let j = 0; j < 4; j++) if (j !== k) assert.ok(h[k] - h[j] > 0.0004, `string ${j} a little under the bow on ${k}`);
  }
});

test('the hands\' holds: square frames, and the prop in the wrist\'s frame is the wrist in the prop\'s frame turned back', () => {
  for (const which of ['fiddle', 'bow']) {
    const W = wristFrame(which), d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    for (const a of ['x', 'y', 'z']) assert.ok(near(Math.hypot(...W[a]), 1, 1e-9), `${which} ${a} unit`);
    assert.ok(Math.abs(d(W.x, W.y)) < 1e-9 && Math.abs(d(W.y, W.z)) < 1e-9 && Math.abs(d(W.x, W.z)) < 1e-9, `${which} square`);
    // (right-handed, as the skeleton's bones are)
    const c = [W.x[1] * W.y[2] - W.x[2] * W.y[1], W.x[2] * W.y[0] - W.x[0] * W.y[2], W.x[0] * W.y[1] - W.x[1] * W.y[0]];
    assert.ok(near(d(c, W.z), 1, 1e-9), `${which} right-handed`);
    // the wrist's place, taken into the wrist's own frame by holdMatrix, comes out at its origin
    const M = holdMatrix(which), at = W.at;
    // (M takes prop coordinates to wrist coordinates: the wrist's own place goes to 0)
    const p = [0, 1, 2].map((r) => M[r] * at[0] + M[4 + r] * at[1] + M[8 + r] * at[2] + M[12 + r]);
    assert.ok(Math.hypot(...p) < 1e-9, `${which}: ${p}`);
    // (within a hand's breadth of what it holds: the neck where it meets the body, the bow's frog)
    const grip = which === 'fiddle' ? [FIDDLE.body + 0.005, 0.017, 0] : [(BOW.frog.from + BOW.frog.to) / 2, -0.01, 0];
    assert.ok(Math.hypot(at[0] - grip[0], at[1] - grip[1], at[2] - grip[2]) < 0.12, `${which}: the wrist by what it holds`);
  }
  // the fiddle in the hand at its neck (where it meets the body), the bow at its frog
  assert.ok(HOLD.fiddle.at[0] > FIDDLE.body - 0.02 && HOLD.fiddle.at[0] < FIDDLE.nut, 'the left hand at the neck');
  assert.ok(HOLD.bow.at[0] < BOW.frog.to, 'the right hand at the frog');
  const D = fiddleData();
  assert.equal(D.contact.length, 4); assert.ok(D.HAIR_LOW === HAIR_LOW && D.wrist.fiddle && D.wrist.bow);
});

test('the music says when the fiddle plays: M.fiddleAt over each of its notes, M.nextFiddle ahead of them; none without its samples', () => {
  const song = 'soldiers', S = SONGS.find((s) => s.id === song);
  const ctx = fakeCtx({ offline: 80 }), M = makeStageMusic(ctx, { harp: stub({}), piano: stub({}), box: stub({}), room: stub({}), fiddle: stub({}), fiddleKit: fakeKit(), song, intro: false, seed: 3 });
  M.start(0.2);
  const fid = M.events.filter((e) => e.what === 'fiddle'), harp = M.events.filter((e) => e.what === 'harp');
  assert.ok(fid.length > 40 && harp.length > 40, `the fiddle and the harmonica both play (${fid.length}, ${harp.length})`);
  // (the spans kept are the last 64 notes)
  const last = fid.slice(-64);
  for (const e of last) {
    assert.ok(M.fiddleAt(e.at + Math.min(0.01, e.len / 2)), `sounding at ${e.at}`);
    assert.ok(M.nextFiddle(e.at - 0.002) <= e.at + 1e-9, `next before ${e.at}`);
  }
  // a stretch where only the harmonica has the tune: no fiddle
  const lone = harp.filter((h) => h.at > last[0].at && !last.some((f) => Math.abs(f.at - h.at) < 0.05));
  assert.ok(lone.length > 5, 'the harmonica plays its turns alone too');
  for (const h of lone) assert.ok(!M.fiddleAt(h.at + 0.01), `no fiddle under the harmonica's own turn at ${h.at}`);
  // let go from a time: the spans after it are gone
  const cut = last[Math.floor(last.length / 2)].at;
  M.stop({ from: cut });
  assert.equal(M.nextFiddle(cut - 0.001) == null || M.nextFiddle(cut - 0.001) < cut, true);
  assert.ok(!M.fiddleAt(last[last.length - 1].at + 0.005));
  // without the samples: the harmonica takes the fiddle's turns, and the fiddler never plays
  const M2 = makeStageMusic(fakeCtx({ offline: 60 }), { harp: stub({}), piano: stub({}), song, intro: false, seed: 3 });
  M2.start(0.2);
  assert.equal(M2.events.filter((e) => e.what === 'fiddle').length, 0);
  assert.equal(M2.nextFiddle(0), null); assert.equal(M2.fiddleAt(5), false);
  // the band's own songs have no fiddle in them yet
  const M3 = makeStageMusic(fakeCtx({ offline: 40 }), { harp: stub({}), piano: stub({}), fiddle: stub({}), fiddleKit: fakeKit(), song: 'easy', intro: false, seed: 3 });
  M3.start(0.2);
  assert.equal(M3.events.filter((e) => e.what === 'fiddle').length, 0);
  assert.ok(S.round > 0);
});

test('a song\'s end: the fiddle holds the home note with the one under it when the tune was its; not otherwise', () => {
  const run = (song, kit) => { const ctx = fakeCtx(); const E = playEnding(ctx, { harp: stub({}), piano: stub({}), box: stub({}), room: stub({}), song, at: 1, fiddle: stub({}), fiddleKit: kit }); return { E, bowed: ctx.counts.kit }; };
  const a = run('soldiers', fakeKit()), b = run('soldiers', null), c = run('easy', fakeKit());
  assert.equal(a.E.fiddle, true); assert.equal(b.E.fiddle, false); assert.equal(c.E.fiddle, false);
  assert.equal(a.bowed, 2, 'two bowed notes (a double stop) on the fiddle\'s samples'); assert.equal(b.bowed + c.bowed, 0);
  assert.ok(a.E.home.under != null);
});
