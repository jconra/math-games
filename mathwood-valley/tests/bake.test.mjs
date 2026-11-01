// The band's baked notes (src/audio/bake.js): the keys that decide when a note is baked again, what the piano's bake leans
// on, and the fallback to the live patch. The sound itself is proved in a browser: ~/pw/bandit-math/rigs/band/bake_proof.cjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { BAKE, bakedBand, bakedSecs, hashText, nearest, noteKey, openNote, storeOpen, wetNote } from '../src/audio/bake.js';
import { ACTION_BAKE, actionShots, makeActionTune } from '../src/audio/actionmusic.js';
import { ACTION_PATCHES } from '../src/audio/actionpatches.js';
import { hoofShots } from '../src/audio/ambience.js';
import { wagonShots } from '../src/audio/wagonsound.js';
import { SONGS, CANDIDATES, pianoNotes, boxNote, makeBoxPart, makeStageMusic, PIANO } from '../src/audio/stagemusic.js';
import { PATCH_PRESETS } from '../src/audio/patch.js';

const piano = (midi, o = {}) => pianoNotes({ midi, len: 0.5, vel: 0.6, ...o })[0];

test('a note\'s key follows its patch, its length, the sample rate and the take', () => {
  const p = openNote(piano(50)), k = noteKey(p, 2, 48000);
  assert.equal(k, noteKey(JSON.parse(JSON.stringify(p)), 2, 48000), 'the same patch, the same key');
  const tuned = { ...p, nodes: p.nodes.map((n) => (n.id === 'thump-e' ? { ...n, peak: n.peak * 1.01 } : n)) };
  assert.notEqual(k, noteKey(tuned, 2, 48000), 'a patch tuned a little: baked again');
  assert.notEqual(k, noteKey(p, 1.5, 48000)); assert.notEqual(k, noteKey(p, 2, 44100)); assert.notEqual(k, noteKey(p, 2, 48000, 1));
  assert.notEqual(noteKey(openNote(piano(50)), 2, 48000), noteKey(openNote(piano(51)), 2, 48000));
  assert.match(hashText('x'), /^[0-9a-f]{16}$/);
});

test('a note baked: full level, nothing sent to the room, no cable left hanging', () => {
  const o = openNote(piano(50, { gain: 0.5 }));
  assert.equal(o.nodes.find((n) => n.type === 'out').gain, 1);
  assert.ok(!o.nodes.some((n) => n.type === 'send'));
  const ids = new Set(o.nodes.map((n) => n.id));
  for (const c of o.cables) assert.ok(ids.has(c.from) && ids.has(c.to));
});

test('the piano\'s touch only sets its level: what lets one bake a key serve every touch', () => {
  const strip = (p) => JSON.stringify(p.nodes.filter((n) => n.type !== 'out' && n.type !== 'send'));
  for (const midi of [38, 62, 86]) {
    assert.equal(strip(piano(midi, { vel: 0.2 })), strip(piano(midi, { vel: 1 })));
    assert.equal(strip(piano(midi, { gain: 0.6 })), strip(piano(midi)));
    const a = piano(midi, { vel: 0.2 }), b = piano(midi, { vel: 1 }), ratio = (p) => p.nodes.find((n) => n.type === 'send').gain / p.nodes.find((n) => n.type === 'out').gain;
    assert.ok(Math.abs(ratio(a) - ratio(b)) < 1e-9, 'the echo follows the level');
  }
  const P = PATCH_PRESETS[PIANO];
  for (const id of ['damp-a-e', 'damp-b-e', 'damp-a-g', 'damp-b-g']) assert.ok(P.nodes.some((n) => n.id === id), `${id} (the damper played at play time)`);
  assert.ok(!P.nodes.some((n) => n.type === 'shaper'), 'nothing in it that would make it not linear');
});

test('the baked keys cover what the songs play, and nearly every note fits its bake', () => {
  let all = 0, fit = 0; const missing = new Set();
  for (const s of [...SONGS, ...CANDIDATES]) for (const seed of [1, 2, 3, 4]) for (const o of [{ intro: true, fiddle: true }, { intro: false, fiddle: true }]) {
    const next = s.tune(seed, o);
    for (let i = 0; i < 24; i++) for (const e of next()) if (e.what === 'piano') for (const m of [].concat(e.midi)) {
      all++; if (e.len + 0.25 + BAKE.tail <= BAKE.pianoSecs) fit++;
      if (!BAKE.pianoKeys.includes(m)) missing.add(m);
    }
  }
  assert.deepEqual([...missing], []);
  assert.ok(fit / all > 0.98, `${fit} of ${all}`);
});

test('the box: every hit the songs play has a baked velocity and tone close by', () => {
  for (const s of SONGS) {
    const next = makeBoxPart(s.id, 3);
    for (let i = 0; i < 12; i++) for (const e of next()) {
      assert.ok(Math.abs(nearest(BAKE.tones, e.tone) - e.tone) <= 0.0126, `${s.id} tone ${e.tone}`);
      if (e.hit === 'thump') assert.ok(Math.abs(nearest(BAKE.thumpVels, e.vel) - e.vel) <= 0.3, `${s.id} vel ${e.vel}`);
      assert.ok(boxNote(e).nodes.some((n) => n.type === 'out'));
    }
  }
});

test('nothing baked yet: the bakery says so, counts it, and the band plays the live patch', () => {
  const warn = console.warn; console.warn = () => {};   // (no OfflineAudioContext here: its baking stops, quietly)
  try {
    const B = bakedBand(48000, { store: false, fresh: true });
    assert.equal(B.playPiano({ sampleRate: 48000 }, null, null, piano(50), 50, 0, 0.5), null);
    assert.equal(B.playBox({ sampleRate: 48000 }, null, null, { hit: 'thump', vel: 0.8, tone: 1 }, boxNote({ hit: 'thump' }), 0), null);
    const st = B.stats();
    assert.equal(st.live.piano, 1); assert.equal(st.live.box, 1); assert.equal(st.played.piano, 0);
    assert.equal(st.MB, 0);
  } finally { console.warn = warn; }
});

test('the band asks the bakery first and uses a baked note instead of building one, or builds it when there is none', () => {
  const made = []; const node = () => ({ connect: (x) => x, disconnect() {}, gain: { value: 1 }, start() {}, stop() {}, frequency: { setValueAtTime() {}, value: 0, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 0 }, detune: { value: 0 }, offset: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }, playbackRate: { value: 1 }, setPeriodicWave() {}, delayTime: { value: 0 } });
  const ctx = new Proxy({ currentTime: 0, sampleRate: 44100, length: 44100 * 4, startRendering() {} }, { get(t, k) { if (k in t) return t[k]; if (String(k).startsWith('create')) return (...a) => { made.push(k); if (k === 'createBuffer') return { getChannelData: () => new Float32Array(a[1]) }; return node(); }; return undefined; } });
  const dest = node();
  const handle = { stop() {} }, asked = { piano: 0, box: 0 };
  const yes = { playPiano() { asked.piano++; return handle; }, playBox() { asked.box++; return handle; } };
  makeStageMusic(ctx, { harp: dest, piano: dest, box: dest, room: dest, seed: 3, song: 'easy', intro: true, baked: yes }).start(0);
  assert.ok(asked.piano > 0 && asked.box > 0);
  const countYes = made.filter((k) => k === 'createOscillator').length; made.length = 0;
  const no = { playPiano() { return null; }, playBox() { return null; } };
  makeStageMusic(ctx, { harp: dest, piano: dest, box: dest, room: dest, seed: 3, song: 'easy', intro: true, baked: no }).start(0);
  const countNo = made.filter((k) => k === 'createOscillator').length;
  assert.ok(countNo > countYes, `live ${countNo} oscillators, baked ${countYes}`);
});

test('no IndexedDB here: the store just isn\'t there', async () => {
  assert.equal(await storeOpen(50), null);
});

test('the action music: every note the tune plays has its bake, and a key stays the same from visit to visit', () => {
  const names = new Set(actionShots().map((x) => x.name));
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const next = makeActionTune(seed);
    for (let i = 0; i < 40; i++) for (const e of next()) {
      if (e.what === 'bass') assert.ok(names.has(`bass|${e.midi}|0`), `bass ${e.midi}`);
      else if (e.what === 'twang') assert.ok(names.has(`twang|${e.midi}|${nearest(ACTION_BAKE.twangVels, e.vel)}`), `twang ${e.midi} ${e.vel}`);
      else if (e.what === 'whistle') { assert.ok(names.has(`whistle|${e.midi}`), `whistle ${e.midi}`); assert.ok(e.len <= ACTION_BAKE.whistleBeats, 'held no longer than its bake'); }
    }
  }
  const keys = (list) => list.map((x) => { const m = x.make(); return noteKey(m.patch, m.secs, 48000, m.take || 0); });
  for (const f of [actionShots, hoofShots, wagonShots]) {
    assert.deepEqual(keys(f()), keys(f()), 'nothing random in what is baked');
    const list = f(); assert.equal(new Set(list.map((x) => x.name)).size, list.length, 'one name each');
    assert.equal(new Set(keys(list)).size, list.length, 'each its own key');
    for (const x of list) { const m = x.make(); assert.ok(m.secs > 0.05 && m.secs < 4, x.name + ' ' + m.secs); assert.ok(!m.patch.nodes.some((n) => n.type === 'send'), x.name + ' sends nothing'); }
  }
});

test("wetNote: what a note sends to its room, and nothing that only goes out", () => {
  const rim = ACTION_PATCHES['ACTION — RIM'], w = wetNote(rim);
  assert.ok(!w.nodes.some((n) => n.id === 'wood'), 'the rim\'s wood goes out only');
  assert.ok(w.nodes.some((n) => n.id === 'nz'));
  assert.equal(w.nodes.filter((n) => n.type === 'out').length, 1);
  assert.equal(w.nodes.find((n) => n.type === 'out').gain, 1);
  const ids = new Set(w.nodes.map((n) => n.id));
  for (const c of w.cables) assert.ok(ids.has(c.from) && ids.has(c.to));
  assert.ok(bakedSecs(rim) > 0.05);
});
