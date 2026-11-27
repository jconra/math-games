// THE GAME'S OWN SOUNDS (SOUNDS 1): the ships' engines, the jump and the chime, Sound Lab patches played by the game's
// one sound player. Checked by what they do: the engines' RPMs from a ship flown with the real flight model, which
// engines sound (the nearest few, by quality), and the sound player itself on a stand-in for the browser's audio (it
// counts what is made and started), before and after the player's first touch, muted, and asked for a name not there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/flymodel.js';
import { JUMP, makeJump, stepJump } from '../src/wormplan.js';
import { SOUNDS, LEVEL, ENGINE, rpmOf, rpmOfSpeed, easeRpm, nearest, mostFor, makeJumpSound, makeWatch, makeLockChime, rescueFloor, FIELD_FLOOR } from '../src/sounds.js';
import { makeEngines } from '../src/engines.js';
import { PATCH_PRESETS, patchAutoStopTime } from '../src/audio/patch.js';

const DT = 1 / 60;
const keys = (...k) => M.controlsOf(new Set(k));
const hold = (S, secs, k) => { const c = keys(...k), out = []; for (let t = 0; t < secs - 1e-9; t += DT) { M.stepShip(S, c, DT, null); out.push(rpmOf(S)); } return out; };

test('every sound the game asks for is a patch in the copy synced from the Sound Lab, of the right kind', () => {
  const names = [SOUNDS.engine, SOUNDS.chime, ...Object.values(SOUNDS.jump)];
  for (const n of names) { assert.ok(PATCH_PRESETS[n], n + ' is in src/audio/patch.js'); assert.equal(PATCH_PRESETS[n].project, 'pi-nebula', n); }
  // the engine (each take): a drone that plays until it is stopped, with the one RPMs number the game moves
  for (const k of ['A', 'B', 'C', 'D', 'E']) {
    const P = PATCH_PRESETS['SHIP — ENGINE ' + k];
    assert.equal(P.group, 'SHIPS'); assert.equal(patchAutoStopTime(P), null, k + ': no envelope, it runs until stopped');
    const rpm = P.nodes.find((n) => n.id === 'rpm'); assert.equal(rpm.type, 'value');
    // (pitch, throb and brightness all follow it, as the Lurcher's do)
    const from = P.cables.filter((c) => c.from === 'rpm').map((c) => c.to);
    const ports = P.cables.filter((c) => from.includes(c.from)).map((c) => c.port).sort();
    assert.deepEqual(ports, ['freq', 'freq', 'freq'], k + ': into the pitch, the throb\'s speed and the tone');
  }
  // the jump's moments: the tear and the far end end by themselves, the tear about when the colours are all round;
  // the colours' drone plays until it is stopped (src/wormhole.js stops it as the far end opens)
  const tearEnd = patchAutoStopTime(PATCH_PRESETS[SOUNDS.jump.tear]) - 0.2;
  assert.ok(Math.abs(tearEnd - (JUMP.rip + JUMP.plunge)) < 0.3, `the tear lasts ${tearEnd.toFixed(2)} s, the rip and the plunge ${JUMP.rip + JUMP.plunge} s`);
  assert.equal(patchAutoStopTime(PATCH_PRESETS[SOUNDS.jump.tunnel]), null);
  assert.ok(patchAutoStopTime(PATCH_PRESETS[SOUNDS.jump.open]) - 0.2 <= JUMP.open + 0.4);
  // the chime, both takes: short
  for (const k of ['A', 'B']) assert.ok(patchAutoStopTime(PATCH_PRESETS['CHIME — RIGHT ' + k]) < 1, k);
});

test('the RPMs of a flown ship follow what it is doing, eased, from the real flight model', () => {
  const S = M.makeShip();
  assert.equal(S.power, false); assert.equal(rpmOf(S), 0, 'parked, the power off: nothing');
  // power on, still on the floor: idling (and the flight model's idle is the one src/sounds.js counts from)
  S.power = true; hold(S, 3, []);
  assert.ok(Math.abs(S.engine - ENGINE.idle) < 1e-3, 'S.engine idles at ' + S.engine); assert.equal(rpmOf(S), 0);
  // lifting off: held up, working
  const up = hold(S, 1.2, ['up']);
  assert.equal(S.landed, false); assert.ok(up[up.length - 1] >= ENGINE.aloft, 'aloft');
  // forward held: up toward full, and down again let go
  const go = hold(S, 4, ['forward']), back = hold(S, 4, []);
  assert.ok(go[go.length - 1] > 0.9, 'full: ' + go[go.length - 1]);
  assert.ok(back[back.length - 1] < 0.3, 'let go: ' + back[back.length - 1]);
  // never a jump: from one frame to the next it moves little (the flight model eases its throttle)
  const all = [...up, ...go, ...back]; let most = 0;
  for (let i = 1; i < all.length; i++) most = Math.max(most, Math.abs(all[i] - all[i - 1]));
  assert.ok(most < 0.06, 'the most it moved in a frame: ' + most.toFixed(3));
  // and the game eases it again on top: never faster than ENGINE.rise a second, whatever is asked
  let r = 0, t = 0; while (r < 1) { const n = easeRpm(r, 1, DT); assert.ok(n - r <= ENGINE.rise * DT + 1e-12); r = n; t += DT; }
  assert.ok(t >= 1 / ENGINE.rise - DT);
  // a ship moving by itself: by its speed
  assert.equal(rpmOfSpeed(0), ENGINE.aloft); assert.equal(rpmOfSpeed(ENGINE.fast * 3), 1); assert.ok(rpmOfSpeed(10) > rpmOfSpeed(5));
});

test('which engines sound: the nearest few, as many as the quality level allows, the flown ship among them', () => {
  assert.ok(mostFor('low') < mostFor('medium') && mostFor('medium') < mostFor('high'));
  const list = [{ d: 30 }, { d: 0 }, { d: 300 }, { d: 9 }, { d: 60 }, { d: 15 }], out = [];
  assert.deepEqual(nearest(list, mostFor('low'), out).map((e) => e.d), [0, 9]);
  assert.deepEqual(nearest(list, mostFor('high'), out).map((e) => e.d), [0, 9, 15, 30]);
  assert.deepEqual(nearest(list, 10, out).map((e) => e.d), [0, 9, 15, 30, 60], 'never one past ENGINE.far');
});

// a stand-in for the game's sound player: what was started, where, its RPMs as sent, whether it was stopped
function fakeSound() {
  const started = [];
  const F = {
    on: true, started,
    audible: () => F.on,
    patch(name, o = {}) { const h = { name, o, at: o.at ? { ...o.at } : null, rpm: [o.values ? o.values.rpm : null], stopped: false, get on() { return !this.stopped; }, set(id, v) { this.rpm.push(v); }, move(p) { this.at = { ...p }; }, stop() { this.stopped = true; } }; started.push(h); return h; },
    live: () => started.filter((h) => !h.stopped),
  };
  return F;
}
test('the engines in play: the nearest by quality, the others let go; none left running', () => {
  const snd = fakeSound(), E = makeEngines({ sound: snd }), S = M.makeShip(), ears = { x: 0, y: 0, z: 0 };
  S.power = true;
  const ships = [5, 12, 40, 70].map((x, i) => ({ key: 'other' + i, x }));
  const frame = (q = 'low') => { E.own(S); for (const s of ships) E.other(s.key, s.x, 0, s.z || 0); E.update(DT, ears, q); };
  frame();
  assert.equal(snd.live().length, 2, 'low: two'); assert.deepEqual(snd.live().map((h) => h.name), [SOUNDS.engine, SOUNDS.engine]);
  assert.equal(snd.live().filter((h) => !h.at).length, 1, 'the flown ship\'s from everywhere; the other\'s from where it is');
  assert.equal(snd.live().find((h) => h.at).at.x, 5, 'the nearest other');
  frame('high'); assert.equal(snd.live().length, 4, 'high: four');
  // one comes nearer than the rest: it is heard, the farthest let go
  ships[3].x = 3; frame('low');
  assert.equal(snd.live().length, 2); assert.equal(snd.live().find((h) => h.at).at.x, 3);
  // a ship moving fast (round the ears, 3 m off, at 20 m/s): its RPMs climb toward full, never by more than ENGINE.rise a
  // second
  for (let i = 1; i <= 90; i++) { const a = i * DT * 20 / 3; ships[3].x = 3 * Math.cos(a); ships[3].z = 3 * Math.sin(a); frame('low'); }
  const h = snd.live().find((x) => x.at); let most = 0;
  for (let i = 1; i < h.rpm.length; i++) most = Math.max(most, h.rpm[i] - h.rpm[i - 1]);
  assert.ok(h.rpm[h.rpm.length - 1] > 0.6, 'speeding: ' + h.rpm[h.rpm.length - 1]); assert.ok(most <= ENGINE.rise * DT + 1e-9);
  // nobody asks any more (the ships put away, the run over): all of them stop by themselves, soon
  for (let t = 0; t < ENGINE.linger + 0.1; t += DT) E.update(DT, ears, 'low');
  assert.equal(snd.live().length, 0, 'none left running');
  // muted (or the volume right down): nothing runs at all, and it comes back after
  frame(); assert.ok(snd.live().length > 0); snd.on = false; frame(); assert.equal(snd.live().length, 0);
  snd.on = true; frame(); assert.equal(snd.live().length, 2);
  // the power off: the flown ship's engine stops
  S.power = false; for (let t = 0; t < ENGINE.linger + 0.1; t += DT) frame('low');
  assert.ok(snd.live().every((x) => x.at), 'only the others\' now');
});

// ── the sound player itself, on a stand-in for the browser's Web Audio (it counts what is made and started) ──
function fakeAudio() {
  const made = { osc: 0, started: 0, stopped: 0, nodes: 0 };
  const param = (v = 0) => ({ value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = (extra = {}) => { made.nodes++; return { connect(d) { return d; }, disconnect() {}, ...extra }; };
  const source = (extra) => node({ start() { made.started++; }, stop() { made.stopped++; }, ...extra });
  class AC {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 48000; this.destination = node(); this.listener = {}; }
    resume() { return Promise.resolve(); }
    createGain() { return node({ gain: param(1) }); }
    createOscillator() { made.osc++; return source({ type: 'sine', frequency: param(440), detune: param(0), setPeriodicWave() {} }); }
    createConstantSource() { return source({ offset: param(1) }); }
    createBufferSource() { return source({ buffer: null, loop: false, playbackRate: param(1) }); }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBiquadFilter() { return node({ type: 'lowpass', frequency: param(350), Q: param(1) }); }
    createPanner() { return node({ positionX: param(), positionY: param(), positionZ: param() }); }
    createWaveShaper() { return node({ curve: null }); }
    createDelay() { return node({ delayTime: param() }); }
    createConvolver() { return node({ buffer: null }); }
    decodeAudioData() {}
  }
  return { AC, made };
}
test('the sound player plays a Sound Lab patch by its name: nothing before the first touch, none muted, none unknown', async () => {
  const { AC, made } = fakeAudio(), on = {}, errors = [], page = { hidden: false, on: {} };
  const keep = { addEventListener: globalThis.addEventListener, window: globalThis.window, error: console.error, document: globalThis.document };
  globalThis.addEventListener = (ev, fn) => { on[ev] = fn; };
  globalThis.window = { AudioContext: AC };
  globalThis.document = { get hidden() { return page.hidden; }, addEventListener: (ev, fn) => { page.on[ev] = fn; } };
  console.error = (...a) => errors.push(a.join(' '));
  try {
    const { sound } = await import('../src/sound.js?player-test');
    // before the player has touched the page: nothing is made, nothing plays
    assert.equal(sound.patch(SOUNDS.chime), null); assert.equal(sound.audible(), false); assert.equal(made.nodes, 0);
    on.pointerdown();
    await new Promise((r) => setTimeout(r, 50));      // (the engine is fetched at the first touch)
    assert.equal(sound.audible(), true);
    // the engine: its oscillators made and started, a handle to move its RPMs and to stop it
    const h = sound.patch(SOUNDS.engine, { volume: LEVEL.engine, values: { rpm: 0.3 }, fade: 0.4 });
    assert.ok(h && h.on); assert.ok(made.osc >= 3, 'its oscillators'); assert.ok(made.started >= made.osc);
    assert.equal(sound.playing('effects'), 1, 'counted in its group');
    h.set('rpm', 0.8); h.stop(0.5);
    assert.ok(made.stopped >= made.osc, 'every oscillator stopped'); assert.equal(h.on, false); assert.equal(sound.playing('effects'), 0);
    // placed in the world: a panner, moved as it goes
    const p = sound.patch(SOUNDS.engine, { at: { x: 1, y: 2, z: 3 } }); assert.ok(p); p.move({ x: 4, y: 5, z: 6 }); p.stop();
    // a drone told the most it may run is stopped then whatever happens
    const n0 = made.stopped, d = sound.patch(SOUNDS.jump.tunnel, { most: 0.05 });
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(d.on, false); assert.ok(made.stopped > n0);
    // a name that is not there: nothing plays, and it is said (once)
    assert.equal(sound.patch('NO — SUCH SOUND'), null); assert.equal(sound.patch('NO — SUCH SOUND'), null);
    assert.equal(errors.filter((e) => e.includes('NO — SUCH SOUND')).length, 1);
    // THE PAGE HIDDEN: an engine and the jump's hum (no end of their own) stop at once; a chime plays its little out;
    // none starts while hidden; back, they play again when asked
    const eng = sound.patch(SOUNDS.engine, { values: { rpm: 0.2 } }), hum = sound.patch(SOUNDS.jump.tunnel), ding = sound.patch(SOUNDS.chime);
    page.hidden = true; page.on.visibilitychange();
    assert.equal(eng.on, false); assert.equal(hum.on, false); assert.equal(ding.on, true, 'the chime ends by itself');
    assert.equal(sound.patch(SOUNDS.engine), null, 'no engine starts while hidden');
    page.hidden = false; page.on.visibilitychange();
    const back = sound.patch(SOUNDS.engine); assert.ok(back && back.on); back.stop(); ding.stop();
    // muted, or the volume right down: nothing
    sound.setMuted(true); assert.equal(sound.patch(SOUNDS.chime), null); assert.equal(sound.audible(), false);
    sound.setMuted(false); sound.setVolume(0); assert.equal(sound.patch(SOUNDS.chime), null);
  } finally {
    globalThis.addEventListener = keep.addEventListener; globalThis.window = keep.window; console.error = keep.error; globalThis.document = keep.document;
  }
});

test('the sound player never throws: an engine that fails is said once, and the game goes on', async () => {
  const { AC } = fakeAudio(), on = {}, errors = [];
  class Broken extends AC { createConstantSource() { throw new Error('no ConstantSourceNode here'); } }
  const keep = { addEventListener: globalThis.addEventListener, window: globalThis.window, error: console.error };
  globalThis.addEventListener = (ev, fn) => { on[ev] = fn; };
  globalThis.window = { AudioContext: Broken };
  console.error = (...a) => errors.push(a.join(' '));
  try {
    const { sound } = await import('../src/sound.js?broken-test');
    on.pointerdown(); await new Promise((r) => setTimeout(r, 50));
    let h = 'not asked';
    assert.doesNotThrow(() => { h = sound.patch(SOUNDS.chime); sound.patch(SOUNDS.chime); });
    assert.equal(h, null); assert.equal(errors.filter((e) => e.includes(SOUNDS.chime)).length, 1, 'said once');
    assert.equal(sound.playing('effects'), 0);
  } finally {
    globalThis.addEventListener = keep.addEventListener; globalThis.window = keep.window; console.error = keep.error;
  }
});

test('the jump heard at the wormhole\'s own moments, in the game\'s own time', () => {
  const snd = fakeSound(), names = () => snd.started.map((h) => h.name);
  const run = (J, H, secs, ready = () => true) => { for (let t = 0; t < secs; t += DT) { for (const ev of stepJump(J, DT, ready())) H.event(ev); H.step(J); } };
  // a whole jump: the tear once, the hum from the colours all round until the far end opens, the far end once
  let H = makeJumpSound(snd), J = makeJump(() => 0.5); H.begin();
  run(J, H, JUMP.rip + JUMP.plunge - 0.05);
  assert.deepEqual(names(), [SOUNDS.jump.tear]);
  run(J, H, 0.2); assert.deepEqual(names(), [SOUNDS.jump.tear, SOUNDS.jump.tunnel]); assert.ok(H.humming);
  run(J, H, JUMP.least + JUMP.open + 0.3);
  assert.deepEqual(names(), [SOUNDS.jump.tear, SOUNDS.jump.tunnel, SOUNDS.jump.open]); assert.equal(H.humming, false);
  assert.ok(snd.started[1].stopped, 'the hum stopped at the far end');
  // a long tunnel (the place ahead slow): the hum lasts as long as the colours in game time, and if anything stops it
  // (the page hidden) it comes back while they last
  snd.started.length = 0; H = makeJumpSound(snd); J = makeJump(() => 0.5); H.begin();
  run(J, H, JUMP.rip + JUMP.plunge + 10, () => false);
  assert.equal(J.phase, 'tunnel'); assert.ok(H.humming, 'humming 10 s into the colours');
  snd.started.find((h) => h.name === SOUNDS.jump.tunnel).stop();
  run(J, H, DT * 2, () => false); assert.ok(H.humming, 'back');
  assert.ok(snd.started.filter((h) => h.name === SOUNDS.jump.tunnel).every((h) => (h.o.most || 0) > JUMP.most * 2), 'its wall-clock guard is only a last guard');
  // put away in the middle, and two jumps back to back: nothing of the one before is left sounding
  H.hush(); assert.equal(snd.live().filter((h) => h.name === SOUNDS.jump.tunnel).length, 0, 'no hum left');
  snd.started.length = 0; H.begin(); H.begin();
  assert.equal(snd.live().length, 1); assert.equal(snd.live()[0].name, SOUNDS.jump.tear);
  H.begin(true); assert.deepEqual(snd.live().map((h) => h.name), [SOUNDS.jump.tunnel], 'begun in the colours: the hum at once');
  H.hush();
});


// a ship flown by hand with forward held for a while (the real flight model), then left where it is: its throttle as the
// last flown frame left it, near full
function flownThenLeft() {
  const S = M.makeShip(); S.power = true;
  for (let t = 0; t < 1.2; t += DT) M.stepShip(S, keys('up'), DT, null);
  for (let t = 0; t < 4; t += DT) M.stepShip(S, keys('forward'), DT, null);
  assert.ok(rpmOf(S) > 0.95, 'flown at full: ' + rpmOf(S));
  return S;
}
// the run moving the ship itself frame by frame (M.place, as rescue.js and fieldfly.js put it), the flight model not
// stepped; the RPMs heard each frame
function moved(E, snd, S, p, secs, v, floor) {
  const out = [];
  for (let t = 0; t < secs; t += DT) { p[0] += v[0] * DT; p[1] += v[1] * DT; M.place(S, p); E.own(S, floor); E.update(DT, { x: 0, y: 0, z: 0 }, 'low'); const h = snd.live()[0]; out.push(h ? h.rpm.at(-1) : null); }
  return out;
}

test('at the rocks, flown to a rock and then drilling or riding: the engine idles, never held at the last throttle', () => {
  const snd = fakeSound(), E = makeEngines({ sound: snd }), S = flownThenLeft(), p = [...S.p];
  E.own(S); E.update(DT, { x: 0, y: 0, z: 0 }, 'low');      // (the last flown frame: hand flying, at full)
  assert.ok(snd.live()[0].rpm.at(-1) > 0.95);
  // the drill: the ship still among the rocks (fieldfly's own floor); then the ride to the next rock, then still again
  const drill = moved(E, snd, S, p, 3, [0, 0], FIELD_FLOOR), ride = moved(E, snd, S, p, 3, [12, 0], FIELD_FLOOR), still = moved(E, snd, S, p, 3, [0, 0], FIELD_FLOOR);
  assert.ok(drill.at(-1) < 0.05, 'drilling, the ship still: idling, ' + drill.at(-1));
  assert.ok(ride.at(-1) > 0.3 && ride.at(-1) < 0.7, 'riding at 12 m/s: ' + ride.at(-1));
  assert.ok(still.at(-1) < 0.05, 'still again: idling');
  assert.equal(snd.started.length, 1, 'one engine all through');
  E.update(1, null, 'low');
});

test('the drill at the rocks: the drill view\'s own ship flies a tapped trip while the flight model stays put; the engine follows the ship that moves', () => {
  const snd = fakeSound(), E = makeEngines({ sound: snd }), S = flownThenLeft(), frozen = [...S.p];
  E.own(S); E.update(DT, { x: 0, y: 0, z: 0 }, 'low');
  // (fieldfly's drill mode: the flight model paused and never put; its throttle put back to idle as it rests; the drill
  // view's ship, a vector of its own, is what moves: engines.own(fl.S, FIELD_FLOOR, drill.ship.p))
  S.engine = ENGINE.idle;
  const ship = { x: S.p[0], y: S.p[1], z: S.p[2] };
  const leg = (secs, v) => { const out = []; for (let t = 0; t < secs; t += DT) { ship.x += v * DT; E.own(S, FIELD_FLOOR, ship); E.update(DT, { x: 0, y: 0, z: 0 }, 'low'); out.push(snd.live()[0].rpm.at(-1)); } return out; };
  const before = leg(2, 0), trip = leg(4, 26), after = leg(4, 0);
  assert.deepEqual(S.p, frozen, 'the flight model was never moved');
  assert.ok(before.at(-1) < 0.05, 'drilling, still: idling ' + before.at(-1));
  assert.ok(trip.at(-1) > 0.9, 'on the tapped trip at 26 m/s: ' + trip.at(-1));
  assert.ok(after.at(-1) < 0.05, 'there, still again: idling ' + after.at(-1));
  assert.equal(snd.started.length, 1);
  // woken again (the seat for the jump home, or flown by hand): its throttle is the idle it rested at, not the pilot's
  // last "forward", so the engine does not swell with the ship still; without the rest it would read near full
  assert.ok(rpmOf(S) <= ENGINE.aloft + 1e-9, 'woken after its rest: ' + rpmOf(S));
  const left = flownThenLeft(); assert.ok(rpmOf(left) > 0.9, '(a model not put to rest would wake at ' + rpmOf(left) + ')');
  E.update(1, null, 'low');
});

test('a rescue\'s parts, after the pilot has flown: the engine through every one, by how the run moves the ship', () => {
  const snd = fakeSound(), E = makeEngines({ sound: snd }), S = flownThenLeft(), p = [...S.p];
  E.own(S); E.update(DT, { x: 0, y: 0, z: 0 }, 'low');
  const part = (phase, secs, v) => moved(E, snd, S, p, secs, v, rescueFloor(phase));
  const down = part('fly', 6, [15, -20]), hover = part('hover', 4, [0, 0]), stand = part('pods', 4, [0, 0]), lift = part('lift', 3, [0, 8]), above = part('up', 4, [0, 0]);
  assert.equal(snd.started.length, 1, 'one engine all the way through, never stopped and started again');
  assert.ok([...down, ...hover, ...stand, ...lift, ...above].every((r) => r != null), 'sounding in every part');
  assert.ok(down.at(-1) > 0.8, 'flown down at speed by her pilot: ' + down.at(-1));
  assert.ok(Math.abs(hover.at(-1) - ENGINE.aloft) < 0.05, 'the hover: held up, not the throttle the pilot left: ' + hover.at(-1));
  assert.ok(stand.at(-1) < 0.05, 'standing on the ground: idling');
  assert.ok(lift.at(-1) > above.at(-1), 'the climb works harder than holding above');
  // the run's own leap from one place to another (the ship put at the far place) is not a speed
  p[0] += 5000; part('up', DT, [0, 0]); assert.ok(snd.live()[0].rpm.at(-1) < 0.5);
  E.update(1, null, 'low');
});

test('the watch: one slow frame stops nothing; the game\'s frames gone, every engine and the jump\'s hum stop', async () => {
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
  const snd = fakeSound(), E = makeEngines({ sound: snd }), S = M.makeShip();
  S.power = true; E.own(S); E.update(DT, { x: 0, y: 0, z: 0 }, 'low');
  const H = makeJumpSound(snd); H.begin(true); H.step({ phase: 'tunnel', t: 0 });
  assert.equal(snd.live().length, 2);
  // one frame of 1.2 s (a planet's first picture): fewer missed checks than the watch needs
  await wait(1.2); E.own(S); E.update(DT, { x: 0, y: 0, z: 0 }, 'low'); H.step({ phase: 'tunnel', t: 1.2 });
  assert.equal(snd.live().length, 2, 'still sounding after one slow frame');
  // then no frame at all: both stopped
  await wait(ENGINE.watch.every * (ENGINE.watch.misses + 2));
  assert.equal(snd.live().length, 0, 'stopped once the frames are gone');
  const w = makeWatch(() => {}); assert.equal(w.armed, false);
});

test('a pod\'s lock chimes once, at its right answer; closed before the box said so, as it opens; solved again, not again', () => {
  const snd = fakeSound(), chimes = () => snd.started.filter((h) => h.name === SOUNDS.chime).length;
  let L = makeLockChime(snd); L.solved(); assert.equal(chimes(), 1); L.opened(); assert.equal(chimes(), 1, 'opened after: no second');
  L.solved(); assert.equal(chimes(), 1, 'a box thrown away and solved again: the same lock, no second');
  L = makeLockChime(snd); L.opened(); assert.equal(chimes(), 2, 'closed before the box said it was solved: chimed as it opens');
  L = makeLockChime(snd); assert.equal(chimes(), 2, 'a lock not solved: none'); assert.equal(L.chimed, false);
});
