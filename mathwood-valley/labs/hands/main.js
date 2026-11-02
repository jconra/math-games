// THE HANDS LAB: a pose editor for the whole band. The pianist at his piano, the drummer on his crate, the fiddler, the banjo player and the harmonica player with their instruments,
// made as the stage makes them (src/stage.js looks, src/bandgear.js what they hold), each playing the game's own clips.
// Pick a bone in the list or in the view; it offers only the joints it really has (src/handplan.js), each with a slider, a
// typed number and a ring to drag in the view. The wrist also has a ball to drag: the arm follows and the shoulder's and
// elbow's numbers change. Instruments: position, rotation and which bone holds them. Numbers are kept per clip and added on
// top of it by src/handpose.js, the game's own code; Save writes models/people/hands.json.
//   Save: served from this machine, sent to the little save script (rigs/town/save_server.cjs, POST /hands); else a download.
// window.HA for the rigs: see the end of this file.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { loadFolk, makePerson } from '../../src/actors/folk.js';
import { STAGE } from '../../src/stage.js';
import { makeHarmonicaModel, holdFiddleOn, holdBanjoOn, holdDrumsOn } from '../../src/bandgear.js';
import { makePianoHands } from '../../src/pianohands.js';
import { makeDrumHands } from '../../src/drumhands.js';
import { makePlayHands } from '../../src/playhands.js';
import { keyX, keyWidth, KEYBOARD } from '../../src/pianoplan.js';
import { SONGS, makeBoxPart } from '../../src/audio/stagemusic.js';
import { buildProps } from '../buildings/props.js';
import { makeSaloonArt } from '../buildings/saloonprops.js';
import { loadHands, setHands, getHands, makeHandPose } from '../../src/handpose.js';
import { PLAYERS, ELBOW_MOST, FINGERS, BONE_GROUPS, cleanHands, handsText, jointsOf, boneWord, setJoint, getJoint, resetBones, resetPlayer, resetAll, copyPose, copyClip, handBones, armBones, HAND_CM, getSize, setSize } from '../../src/handplan.js';

const $ = (id) => document.getElementById(id);
const GAME = new URL('../../', import.meta.url).href;
const LOCAL = ['127.0.0.1', 'localhost'].includes(location.hostname), SAVE_URL = 'http://127.0.0.1:8998/hands';
const FRAME = 1 / 30;
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x3a2c1f);
scene.add(new THREE.HemisphereLight(0xfff0dc, 0x4a3524, 1.5));
const key = new THREE.DirectionalLight(0xfff3e0, 2.2); key.position.set(1.5, 3.5, 3); scene.add(key);
scene.add(new THREE.Mesh(new THREE.CircleGeometry(6, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.9 })));
const camera = new THREE.PerspectiveCamera(35, 1, 0.03, 60);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.minDistance = 0.12;

const state = { who: 'pianist', clip: 'Play_Piano', frozen: true, time: 0.6, speed: 1, tab: 'bones', open: true, group: 'handL', bone: 'WristL', prop: null, overlay: true, dirty: false, hat: true };
const made = {};   // who -> { p (the person), H (the pose's layer) }
let DATA = cleanHands({}), saveWord = '';
const cur = () => made[state.who], action = () => cur().p.person.actions[state.clip], clipLen = () => { const a = action(); return a ? a.getClip().duration : 1; };

async function build() {
  const folk = await loadFolk(GAME + 'models/people/');
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  await Promise.all([['m', 'clips_stage_m.glb'], ['f', 'clips_stage_f.glb']].map(([b, f]) => loader.loadAsync(folk.dir + f).then((g) => folk.addClips(b, g.animations))));
  await loadHands(GAME); DATA = cleanHands(getHands()); setHands(DATA);
  const looks = { pianist: STAGE.pianist, drummer: STAGE.drummer, fiddler: STAGE.fiddler, banjo: STAGE.banjoist, harpist: STAGE.harpist };
  for (const who of Object.keys(PLAYERS)) {
    const p = makePerson(folk, looks[who]); p.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    let props = {}, harp = null;
    if (who === 'fiddler') { const g = holdFiddleOn(p); props = { fiddle: g.fiddle, bow: g.bow }; }
    if (who === 'banjo') { const g = holdBanjoOn(p); props = { banjo: g.banjo, stool: g.stool }; }
    if (who === 'harpist') { const h = makeHarmonicaModel(STAGE.harp); scene.add(h); props = { harmonica: h }; harp = STAGE.harp; }
    if (who === 'drummer') { const g = holdDrumsOn(p); props = { stool: g.stool, stickL: g.stickL, stickR: g.stickR }; }
    made[who] = { p, H: makeHandPose(p, who, { props, harp }), props };
    if (who === 'drummer') made[who].drums = makeDrumHands(p, made[who].H);
    made[who].play = makePlayHands(p, made[who].H, who);
    if (who === 'pianist') { p.root.add(await makePiano()); made[who].keys = makePianoHands(p, made[who].H); }
    p.root.visible = false; scene.add(p.root);
  }
}
// the saloon's own piano and stool, built by its own code, where the saloon has them from him (0.82 m before the stool's
// middle, the keys toward him). Plain wood here: this is for placing hands against, the Building Lab shows its finish.
async function makePiano() {
  const g = new THREE.Group(), P = buildProps([{ type: 'piano', x: 0, y: 0, z: 0.82, rot: Math.PI }, { type: 'pianoStool', x: 0, y: 0, z: 0 }], { seed: 5 }), art = await makeSaloonArt();
  const mat = { wood: new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.7 }), iron: new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.5 }), hay: new THREE.MeshStandardMaterial({ color: 0x6a3a2a }), goods: new THREE.MeshStandardMaterial({ map: art.saloon, roughness: 0.7 }) };
  for (const k of Object.keys(mat)) { const geo = P.geos[k]; if (geo && (!geo.index || geo.index.count)) { const m = new THREE.Mesh(geo, mat[k]); m.name = k; g.add(m); } }
  return g;
}
function showWho(who, clip = PLAYERS[who].clips[0]) {
  for (const k of Object.keys(made)) { made[k].p.root.visible = k === who; if (made[k].props.harmonica) made[k].props.harmonica.visible = k === who; }
  state.who = who; state.prop = Object.keys(PLAYERS[who].props)[0]; showClip(clip); look('whole'); paintMenu();
}
function showClip(name) {
  state.clip = name; const P = cur().p.person;
  P.mixer.stopAllAction(); P.cur = null; P.curName = ''; cur().p.play(name, { fade: 0 }); P.cur.stopFading().setEffectiveWeight(1); state.time = Math.min(state.time, clipLen());
  pose(0);
}
// the clip at its time (frozen), or running on; the pose laid over it
function pose(dt) {
  const m = cur(), a = action();
  m.H.before();
  if (state.frozen) { a.paused = false; a.time = state.time; m.p.update(0); }
  else { a.paused = false; m.p.update(dt * state.speed); state.time = a.time; }
  m.H.after();
  if (m.play && !state.frozen) m.play.update();
  if (m.keys) { if (song.on && !state.frozen) { song.tick(dt * state.speed); } m.keys.update(song.now, song.on ? dt * state.speed : 0, song.on ? song.events : null, song.on ? 1 : 0); }
  // (frozen with no song: the file's pose itself, the stick on the skin, so a slider or a rig works on the numbers as they are)
  if (m.drums && (song.on || !state.frozen)) { if (song.on && !state.frozen) song.tick(dt * state.speed); const A = action(); m.drums.update(song.now, song.on ? song.events : null, state.clip === 'Play_Box' ? 1 : 0, !song.on); }
  m.p.root.updateMatrixWorld(true);
  paintOverlay();
}
// THE SONG'S NOTES, no sound: the stage music's own tune for the song, on a clock of the lab's, into the same hands
const song = {
  on: false, id: SONGS[0].id, now: 0, events: [], tune: null, made: 0, beat: 1, line: 16,
  start(id) { const S = SONGS.find((x) => x.id === id) || SONGS[0]; song.id = S.id; song.tune = S.tune(7, { intro: true, fiddle: true, banjo: true }); song.drum = makeBoxPart(S.id, 7); song.events = []; song.now = 0; song.made = 0; song.beat = S.beat; song.line = S.bar * 4; song.on = true; song.tick(0); },
  stop() { song.on = false; song.events = []; },
  tick(dt) {
    song.now += dt;
    while (song.made * song.line * song.beat < song.now + 3) {
      for (const e of song.tune()) if (e.what === 'piano') song.events.push({ at: e.beat * song.beat, what: 'piano', midi: e.midi, len: e.len });
      for (const e of song.drum()) song.events.push({ at: e.beat * song.beat, what: 'box', hit: e.hit, vel: e.vel });
      song.made++; song.events.sort((a, b) => a.at - b.at);
      if (song.events.length > 400) song.events.splice(0, song.events.length - 400);
    }
  },
};
const LOOK = {
  whole: () => [[0.9, 1.25, 2.6], [0, 0.95, 0]],
  keys: () => [[0.1, 1.55, -0.1], [0, 0.74, 0.45]],
  L: () => boneLook('WristL', 0.65), R: () => boneLook('WristR', 0.65),
  head: () => boneLook('Head', 0.9),
  back: () => [[-0.6, 1.4, -2.2], [0, 1, 0]],
};
function boneLook(bone, dist) {
  const b = cur().p.bones[bone]; cur().p.root.updateMatrixWorld(true);
  const at = b.getWorldPosition(new THREE.Vector3());
  return [[at.x + 0.35 * dist * (bone.endsWith('L') ? 1 : bone.endsWith('R') ? -1 : 0.6), at.y + 0.3 * dist, at.z + dist], at.toArray()];
}
// the hat off to see the hands from above or the chin on the fiddle (the lab's own view only; the game keeps it on)
function setHat(on) { state.hat = on; for (const k of Object.keys(made)) made[k].p.root.traverse((o) => { if (o.name === 'hat') o.visible = on; }); }
function look(name) { const [p, t] = LOOK[name] ? LOOK[name]() : LOOK.whole(); camera.position.set(...p); controls.target.set(...t); controls.update(); }

// ── flying the view from the keyboard: W A S D along the way it faces, Space up, C down ───────────────────────────────
const FLY = { KeyW: [0, 0, 1], KeyS: [0, 0, -1], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], Space: [0, 1, 0], KeyC: [0, -1, 0] }, keys = new Set();
addEventListener('keydown', (e) => {
  if (!FLY[e.code] || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target && e.target.matches && e.target.matches('input[type=number], select')) return;   // (typing a number isn't flying)
  keys.add(e.code); if (e.code === 'Space') { e.preventDefault(); if (document.activeElement) document.activeElement.blur(); }
});
addEventListener('keyup', (e) => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function fly(dt) {
  if (!keys.size) return; let fx = 0, fy = 0, fz = 0; for (const k of keys) { const v = FLY[k]; fx += v[0]; fy += v[1]; fz += v[2]; }
  camera.getWorldDirection(_f); _f.y = 0; _f.normalize(); _r.crossVectors(_f, UP).normalize();
  _s.set(0, 0, 0).addScaledVector(_f, fz).addScaledVector(_r, fx); _s.y = fy; _s.multiplyScalar(0.9 * dt);
  camera.position.add(_s); controls.target.add(_s);
}

// ── in the view: the bones as dots and lines, the picked bone's rings, the ball that moves a hand or an instrument ───────
const overlay = new THREE.Group(); scene.add(overlay);
const over = (m) => { m.depthTest = false; m.transparent = true; return m; };
const lineGeo = new THREE.BufferGeometry(), lines = new THREE.LineSegments(lineGeo, over(new THREE.LineBasicMaterial({ color: 0xf3c56b, opacity: 0.55 })));
const dotGeo = new THREE.BufferGeometry(), dots = new THREE.Points(dotGeo, over(new THREE.PointsMaterial({ color: 0xf3c56b, size: 7, sizeAttenuation: false })));
const picked = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)), over(new THREE.PointsMaterial({ color: 0xffffff, size: 13, sizeAttenuation: false })));
lines.frustumCulled = dots.frustumCulled = picked.frustumCulled = false; lines.renderOrder = 20; dots.renderOrder = 21; picked.renderOrder = 22;
overlay.add(lines, dots, picked);
const RING_COL = [0xff6a55, 0x6fe07a, 0x62a8ff], RING_N = 48;
const ringPts = []; for (let i = 0; i <= RING_N; i++) { const a = i / RING_N * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)); }
const rings = [0, 1, 2].map((i) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), over(new THREE.LineBasicMaterial({ color: RING_COL[i] }))); l.renderOrder = 23; l.frustumCulled = false; l.visible = false; overlay.add(l); return l; });
const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), over(new THREE.MeshBasicMaterial({ color: 0xe2ad4c, opacity: 0.75 }))); ball.renderOrder = 24; ball.visible = false; overlay.add(ball);
const shownBones = () => cur().p.person.mesh.skeleton.bones.filter((b) => cur().H.hasJoints(b.name));
const ZZ = new THREE.Vector3(0, 0, 1);
let activeRings = [];   // { ring, set(deltaDegrees) }
function paintOverlay() {
  overlay.visible = state.overlay;
  if (!cur() || !state.overlay) return;
  const m = cur(), bs = shownBones(), seg = [], dot = [], v = new THREE.Vector3(), w = new THREE.Vector3();
  for (const b of bs) {
    b.getWorldPosition(v); dot.push(v.x, v.y, v.z);
    for (const c of b.children) if (c.isBone && m.H.hasJoints(c.name)) { c.getWorldPosition(w); seg.push(v.x, v.y, v.z, w.x, w.y, w.z); }
  }
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)); dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dot, 3));
  paintHandles();
}
function ringScale(at) { return Math.max(0.035, Math.min(0.22, camera.position.distanceTo(at) * 0.075)); }
function paintHandles() {
  const m = cur(); activeRings = []; for (const r of rings) r.visible = false; ball.visible = false; picked.visible = false;
  const q = new THREE.Quaternion(), at = new THREE.Vector3(), axis = new THREE.Vector3();
  const ring = (i, center, ax, r, set) => { const l = rings[i]; l.visible = true; l.position.copy(center); l.quaternion.setFromUnitVectors(ZZ, ax); l.scale.setScalar(r); activeRings.push({ ring: l, set }); };
  if (state.tab === 'props') {
    const w = m.H.propWorld(state.prop); if (!w) return;
    at.setFromMatrixPosition(w); q.setFromRotationMatrix(w);
    const r = ringScale(at);
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((a, i) => ring(i, at, axis.fromArray(a).applyQuaternion(q).clone(), r, (d) => { const e = propEntry(); e.rot = e.rot || [0, 0, 0]; e.rot[i] = wrap180(e.rot[i] + d); }));
    ball.visible = true; ball.position.copy(at); ball.scale.setScalar(r * 0.2);
    return;
  }
  const b = m.p.bones[state.bone]; if (!b || !m.H.hasJoints(state.bone)) return;
  b.getWorldPosition(at); picked.visible = true; picked.position.copy(at);
  b.getWorldQuaternion(q);
  const r = ringScale(at); let n = 0;
  for (const j of jointsOf(state.bone)) {
    if (j.id === 'twist') {
      const s = state.bone.slice(-1), wr = m.p.bones['Wrist' + s].getWorldPosition(new THREE.Vector3()), c = at.clone().lerp(wr, 0.55);
      ring(n++, c, m.H.twistAxis(s).clone().applyQuaternion(q).normalize(), r * 0.8, (d) => bump(j, d));
    } else {
      const ax = m.H.axis(state.bone, j.id); if (!ax) continue;
      ring(n++, at, ax.clone().applyQuaternion(q).normalize(), r, (d) => bump(j, d));
    }
  }
  if (state.bone.startsWith('Wrist')) { ball.visible = true; ball.position.copy(at); ball.scale.setScalar(r * 0.22); }
}
const wrap180 = (a) => ((a + 180) % 360 + 360) % 360 - 180;
const bump = (j, d) => setJoint(DATA, state.who, state.clip, state.bone, j.id, getJoint(DATA, state.who, state.clip, state.bone, j.id) + d);

// the view's pointer: a handle if one is under it, else the camera; a tap with no drag picks the nearest bone
const toScreen = (p) => { const n = p.clone().project(camera); return [(n.x + 1) / 2 * innerWidth, (1 - n.y) / 2 * innerHeight]; };
let grab = null, downAt = null;
function ringHit(x, y, tol) {
  let best = null, bestD = tol;
  for (const R of activeRings) for (let i = 0; i < RING_N; i++) {
    const p = ringPts[i].clone().applyMatrix4(R.ring.matrixWorld.compose(R.ring.position, R.ring.quaternion, R.ring.scale)), [sx, sy] = toScreen(p), d = Math.hypot(sx - x, sy - y);
    if (d < bestD) { bestD = d; best = { R, i, p }; }
  }
  return best;
}
canvas.addEventListener('pointerdown', (e) => {
  downAt = [e.clientX, e.clientY]; grab = null;
  if (!state.overlay) return;
  const tol = e.pointerType === 'touch' ? 26 : 12;
  if (ball.visible) { const [sx, sy] = toScreen(ball.position); if (Math.hypot(sx - e.clientX, sy - e.clientY) < tol + 6) grab = { ball: true, start: ball.position.clone(), last: ball.position.clone() }; }
  if (!grab) {
    const h = ringHit(e.clientX, e.clientY, tol);
    if (h) {
      // the way the ring runs at the grabbed point, on screen: how far along that the finger goes is the turn
      const ax = new THREE.Vector3(0, 0, 1).applyQuaternion(h.R.ring.quaternion), c = h.R.ring.position, rad = h.p.clone().sub(c), tan = ax.clone().cross(rad);
      const a = toScreen(h.p), b = toScreen(h.p.clone().addScaledVector(tan, 0.05));
      const tx = (b[0] - a[0]) / 0.05, ty = (b[1] - a[1]) / 0.05, l2 = tx * tx + ty * ty;
      if (l2 > 1) grab = { set: h.R.set, tx, ty, l2, x: e.clientX, y: e.clientY };
    }
  }
  if (grab) { beginEdit(); controls.enabled = false; canvas.setPointerCapture(e.pointerId); e.stopPropagation(); }
}, true);
canvas.addEventListener('pointermove', (e) => {
  if (!grab) return;
  if (grab.ball) {
    const dir = camera.getWorldDirection(new THREE.Vector3()), pl = new THREE.Plane().setFromNormalAndCoplanarPoint(dir, grab.last);
    const n = new THREE.Vector3((e.clientX / innerWidth) * 2 - 1, 1 - (e.clientY / innerHeight) * 2, 0.5).unproject(camera);
    const hit = new THREE.Ray(camera.position, n.sub(camera.position).normalize()).intersectPlane(pl, new THREE.Vector3()); if (!hit) return;
    if (state.tab === 'props') {
      const dw = hit.clone().sub(grab.last), q = cur().p.root.getWorldQuaternion(new THREE.Quaternion()).invert(); dw.applyQuaternion(q).multiplyScalar(100);
      const en = propEntry(); en.pos = (en.pos || [0, 0, 0]).map((v, i) => v + dw.getComponent(i));
    } else cur().H.reach(state.bone.slice(-1), hit, state.clip);
    grab.last.copy(hit);
  } else {
    const dx = e.clientX - grab.x, dy = e.clientY - grab.y; grab.x = e.clientX; grab.y = e.clientY;
    grab.set((dx * grab.tx + dy * grab.ty) / grab.l2 * 180 / Math.PI);
  }
  changed(); refreshValues();
});
const endDrag = (e) => {
  const wasGrab = !!grab; grab = null; controls.enabled = true;
  if (!downAt || wasGrab || !e || e.type !== 'pointerup') { downAt = null; return; }
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null;
  if (moved > 8 || !state.overlay) return;
  let best = null, bestD = e.pointerType === 'touch' ? 34 : 22; const v = new THREE.Vector3();
  for (const b of shownBones()) { const [sx, sy] = toScreen(b.getWorldPosition(v)), d = Math.hypot(sx - e.clientX, sy - e.clientY); if (d < bestD) { bestD = d; best = b.name; } }
  if (best) { pick(best); state.tab = 'bones'; state.open = true; paintMenu(); }
};
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

// ── the numbers being edited ──────────────────────────────────────────────────────────────────────────────────────────
const UNDO = []; let lastPush = 0;
function beginEdit() { const t = performance.now(); if (t - lastPush > 500) { UNDO.push(JSON.stringify(DATA)); if (UNDO.length > 60) UNDO.shift(); } lastPush = t; }
function changed() { state.dirty = true; saveWord = ''; setHands(DATA); pose(0); }
function pick(bone) { state.bone = bone; const g = BONE_GROUPS.find((x) => x.bones.includes(bone)); if (g) state.group = g.id; }
function propEntry(make = true) {
  const pl = DATA.players[state.who] || (make ? (DATA.players[state.who] = {}) : null); if (!pl) return null;
  const c = pl[state.clip] || (make ? (pl[state.clip] = {}) : null); if (!c) return null;
  const P = c.props || (make ? (c.props = {}) : null); if (!P) return null;
  return P[state.prop] || (make ? (P[state.prop] = {}) : null);
}
const isSet = (bone) => { const c = DATA.players[state.who] && DATA.players[state.who][state.clip]; return !!(c && c.bones && c.bones[bone] && Object.keys(c.bones[bone]).length); };

// ── the menu ──────────────────────────────────────────────────────────────────────────────────────────────────────────
function paintMenu() {
  $('who').innerHTML = Object.entries(PLAYERS).map(([id, d]) => `<button class="chip${id === state.who ? ' on' : ''}" data-who="${id}">${d.name.replace('The ', '')}</button>`).join('');
  const tabs = [['bones', 'Bones'], ['props', 'Instruments'], ['clip', 'Clip'], ['save', 'Save']];
  $('tabs').innerHTML = tabs.map(([id, l]) => `<button class="tab" data-tab="${id}" role="tab" aria-selected="${state.open && state.tab === id}">${l}</button>`).join('') + `<button class="tab" id="hide">${state.open ? 'Hide' : 'Show'}</button>`;
  paintDrawer();
}
const row = (k, label, min, max, step, val) => `<label class="ha-row"><span>${label}</span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${val}"><input type="number" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
const btn = (id, label, cls = '') => `<button class="ha-btn ${cls}" id="${id}">${label}</button>`;
function bonesPane() {
  const g = BONE_GROUPS.find((x) => x.id === state.group), side = state.group.slice(-1), P = state.bone;
  const groups = BONE_GROUPS.map((x) => `<button class="ha-btn${x.id === state.group ? ' on' : ''}${x.bones.some(isSet) ? ' set' : ''}" data-group="${x.id}">${x.label}</button>`).join('');
  const b = (n, label) => `<button data-bone="${n}" class="${n === P ? 'on ' : ''}${isSet(n) ? 'set' : ''}">${label}</button>`;
  let list;
  if (state.group.startsWith('hand')) {
    list = `<div class="ha-btns"><button class="ha-btn${'Wrist' + side === P ? ' on' : ''}${isSet('Wrist' + side) ? ' set' : ''}" data-bone="Wrist${side}">Wrist</button></div>
      <div class="ha-hand"><span></span><span>palm bone</span><span>base</span><span>middle</span><span>end</span>
      ${FINGERS.map((f) => `<span>${f === 'Pinky' ? 'Little' : f}</span>${[1, 2, 3, 4].map((i) => b(f + i + side, ['palm', 'base', 'mid', 'end'][i - 1])).join('')}`).join('')}
      <span>Thumb</span>${b('Thumb1' + side, 'palm')}${b('Thumb2' + side, 'first')}${b('Thumb3' + side, 'end')}<span></span></div>`;
  } else list = `<div class="ha-btns">${g.bones.map((n) => `<button class="ha-btn${n === P ? ' on' : ''}${isSet(n) ? ' set' : ''}" data-bone="${n}">${boneWord(n)}</button>`).join('')}</div>`;
  const J = jointsOf(P);
  let joints = J.map((j) => row('j:' + j.id, j.label, j.min, j.max, 1, getJoint(DATA, state.who, state.clip, P, j.id))).join('');
  if (!J.length) joints = `<p class="ha-note">${P === 'Root' ? 'Root moves the whole figure with its clip: no joint to turn.' : 'This is the clip\'s aim for the knee, not a joint; nothing on the body is tied to it.'}</p>`;
  if (/^(UpperLeg|LowerLeg)/.test(P)) joints += '<p class="ha-note">The feet hang from Root in this rig, not from the legs: the foot stays where the clip has it when the leg turns.</p>';
  const elbow = P.startsWith('LowerArm') ? '<div class="ha-now" id="elbowNow"></div>' : '';
  const hs = P.slice(-1), sided = hs === 'L' || hs === 'R';
  return `<h2>${boneWord(P)} <small>${state.clip.replace(/_/g, ' ')}</small></h2>${joints}${elbow}
    <div class="ha-h">This player's hands, wrist to fingertip (cm)</div>${row('size', 'Hand size', HAND_CM.min, HAND_CM.max, 0.5, shownSize())}
    <div class="ha-btns">${groups}</div>${list}
    <div class="ha-h">Reset</div><div class="ha-btns">${btn('rBone', 'This bone')}${sided && !/Leg|Foot|PT/.test(P) ? btn('rHand', 'This hand') + btn('rArm', 'This arm') : ''}${btn('rPlayer', 'This player')}${btn('rAll', 'Everything')}${btn('undo', 'Undo')}</div>
    <div class="ha-h">Copy this clip's arm and hand</div><div class="ha-btns">${btn('copyLR', 'Left to right')}${btn('copyRL', 'Right to left')}</div>`;
}
// (no number set: as the model has them)
const shownSize = () => getSize(DATA, state.who) || +cur().H.handLength().toFixed(1);
const pinOf = (S) => { const c = DATA.players[state.who] && DATA.players[state.who][state.clip]; return c && c.pins && c.pins[S]; };
function pinHand(S, prop = state.prop) {
  const pl = DATA.players[state.who] || (DATA.players[state.who] = {}), c = pl[state.clip] || (pl[state.clip] = {});
  if (c.pins && c.pins[S]) { delete c.pins[S]; if (!Object.keys(c.pins).length) delete c.pins; return false; }
  (c.pins || (c.pins = {}))[S] = cur().H.pinNow(S, prop); return true;
}
function propsPane() {
  const names = PLAYERS[state.who].props, e = propEntry(false) || {};
  if (!Object.keys(names).length) return '<p class="ha-note">The piano is part of the saloon, so it stays put; he moves to it. The Bones tab has his arms and hands, the Clip tab has a song to play through.</p>';
  const options = [`<option value="">Where its clip has it</option>`, ...BONE_GROUPS.flatMap((g) => g.bones.filter((n) => cur().H.hasJoints(n)).map((n) => `<option value="${n}"${e.bone === n ? ' selected' : ''}>${boneWord(n)}</option>`))].join('');
  const pos = e.pos || [0, 0, 0], rot = e.rot || [0, 0, 0];
  return `<div class="ha-btns">${Object.entries(names).map(([k, l]) => `<button class="ha-btn${k === state.prop ? ' on' : ''}" data-prop="${k}">${l}</button>`).join('')}</div>
    <label class="ha-row"><span>Held by</span><select class="ha-sel" id="holder" style="grid-column: 2 / -1">${options}</select></label>
    <div class="ha-h">Move it (cm, or drag the ball)</div>${row('p:0', 'To his left', -40, 40, 0.1, pos[0])}${row('p:1', 'Up', -40, 40, 0.1, pos[1])}${row('p:2', 'Forward', -40, 40, 0.1, pos[2])}
    <div class="ha-h">Turn it (or drag a ring)</div>${row('r:0', 'About its length', -180, 180, 1, rot[0])}${row('r:1', 'About its height', -180, 180, 1, rot[1])}${row('r:2', 'About its width', -180, 180, 1, rot[2])}
    <div class="ha-h">Keep a hand on it, however the clip moves (the arm follows; to move that hand again, let go first)</div>
    <div class="ha-btns">${['L', 'R'].map((S) => btn('pin' + S, (pinOf(S) ? 'Let go: ' : 'Keep on: ') + (S === 'L' ? 'left hand' : 'right hand'), pinOf(S) ? 'on' : '')).join('')}</div>
    <div class="ha-btns">${btn('rProp', 'Reset this one')}${btn('undo', 'Undo')}</div>`;
}
function clipPane() {
  const P = PLAYERS[state.who], len = clipLen(), others = P.clips.filter((c) => c !== state.clip);
  return `<div class="ha-btns">${[...P.clips, ...Object.keys(P.ramps || {})].map((c) => `<button class="ha-btn${c === state.clip ? ' on' : ''}" data-clip="${c}">${c.replace(/_/g, ' ')}</button>`).join('')}</div>
    <div class="ha-btns">${btn('freeze', state.frozen ? 'Play it' : 'Freeze it', state.frozen ? '' : 'on')}${btn('prev', 'Frame back')}${btn('next', 'Frame on')}</div>
    <div class="ha-now" id="frameNow"></div>
    ${row('time', 'Time (s)', 0, +len.toFixed(2), 0.01, +state.time.toFixed(2))}${row('speed', 'Playing speed', 0.1, 1.5, 0.05, state.speed)}
    <div class="ha-h">Look at</div><div class="ha-btns">${[['whole', 'The player'], ...(state.who === 'pianist' ? [['keys', 'The keys']] : []), ['L', 'Left hand'], ['R', 'Right hand'], ['head', 'The head'], ['back', 'From behind']].map(([k, l]) => `<button class="ha-btn" data-look="${k}">${l}</button>`).join('')}${btn('toggleBones', state.overlay ? 'Hide the bones' : 'Show the bones')}${btn('toggleHat', state.hat ? 'Hide the hat' : 'Show the hat')}</div>
    ${state.who === 'pianist' || state.who === 'drummer' ? `<div class="ha-h">${state.who === 'pianist' ? 'His hands on the keys' : 'His sticks on the drums'}, from a song's notes</div><label class="ha-row"><span>Song</span><select class="ha-sel" id="songPick" style="grid-column: 2 / -1">${SONGS.map((s) => `<option value="${s.id}"${s.id === song.id ? ' selected' : ''}>${s.name}</option>`).join('')}</select></label><div class="ha-btns">${btn('songGo', song.on ? 'Stop the notes' : 'Play the notes')}${''}</div>` : ''}
    <div class="ha-h">Use this clip's pose on</div><div class="ha-btns">${others.map((c) => `<button class="ha-btn" data-copyto="${c}">${c.replace(/_/g, ' ')}</button>`).join('')}</div>
    <p class="ha-note">Each clip keeps its own numbers, added on top of it. Drag to turn the view, W A S D to fly, Space up, C down.</p>`;
}
function savePane() {
  return `<h2>Save <small>models/people/hands.json: the game reads it when the band is made</small></h2>
    <div class="ha-btns">${btn('save', LOCAL ? 'Save into the game' : 'Download the file')}${LOCAL ? btn('down', 'Download the file') : ''}${btn('reload', 'Back to what\'s saved')}</div>
    <p class="ha-note" id="saved">${saveWord || (state.dirty ? 'Changes not saved yet.' : 'Nothing changed since the file was read.')}</p>
    ${LOCAL ? '<p class="ha-note">Save needs the little save script running: node ~/pw/bandit-math/rigs/town/save_server.cjs. Without it the file is downloaded instead.</p>' : ''}`;
}
function paintDrawer() {
  const d = $('drawer'); d.hidden = !state.open;
  if (state.open) { const keep = d.scrollTop; d.innerHTML = { bones: bonesPane, props: propsPane, clip: clipPane, save: savePane }[state.tab](); d.scrollTop = keep; }
  refreshValues(); paintHandles(); fitView();
}
// the numbers shown, after a drag or a frame change, without rebuilding the panel
function refreshValues() {
  const d = $('drawer'); if (d.hidden) return;
  const e = state.tab === 'props' ? propEntry(false) || {} : null;
  for (const el of d.querySelectorAll('[data-k]')) {
    if (el === document.activeElement && el.type === 'number') continue;
    const [a, b] = el.dataset.k.split(':'); let v = null;
    if (a === 'size') v = shownSize();
    else if (a === 'j') v = getJoint(DATA, state.who, state.clip, state.bone, b);
    else if (a === 'p') v = (e.pos || [0, 0, 0])[+b]; else if (a === 'r') v = (e.rot || [0, 0, 0])[+b];
    else if (a === 'time') v = state.time; else if (a === 'speed') v = state.speed;
    if (v != null) el.value = Math.round(v * 100) / 100;
  }
  const en = $('elbowNow'); if (en) { const E = cur().H.elbow(state.bone.slice(-1)); en.textContent = E ? `The elbow bends ${Math.round(E.now)}° now (the clip has ${Math.round(E.clip)}°), up to ${ELBOW_MOST}°` : ''; }
  const fn = $('frameNow'); if (fn) fn.textContent = `Frame ${Math.round(state.time / FRAME)} of ${Math.round(clipLen() / FRAME)}`;
}
function setK(k, v) {
  const [a, b] = k.split(':');
  if (a === 'time') { state.time = Math.max(0, Math.min(clipLen(), v)); pose(0); refreshValues(); return; }
  if (a === 'speed') { state.speed = v; return; }
  beginEdit();
  if (a === 'size') setSize(DATA, state.who, v);
  else if (a === 'j') setJoint(DATA, state.who, state.clip, state.bone, b, v);
  else { const e = propEntry(); const f = a === 'p' ? 'pos' : 'rot'; e[f] = e[f] || [0, 0, 0]; e[f][+b] = v; }
  changed();
}
$('drawer').addEventListener('input', (e) => {
  const k = e.target.dataset && e.target.dataset.k; if (!k) return;
  const v = +e.target.value; if (!Number.isFinite(v)) return; setK(k, v);
  for (const el of e.currentTarget.querySelectorAll(`[data-k="${k}"]`)) if (el !== e.target) el.value = v;
});
$('drawer').addEventListener('change', (e) => {
  if (e.target.id === 'songPick') { song.id = e.target.value; if (song.on) song.start(song.id); return; }
  if (e.target.id !== 'holder') return;
  beginEdit(); const m = cur(), en = propEntry(), bone = e.target.value;
  if (bone) { en.bone = bone; en.at = m.H.holdFrame(bone, new THREE.Matrix4()).invert().multiply(m.H.propWorld(state.prop)).toArray(); delete en.pos; delete en.rot; }
  else { delete en.bone; delete en.at; }
  changed(); paintDrawer();
});
const download = (text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'hands.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
async function save({ downloadOnly = false } = {}) {
  const text = handsText(DATA);
  if (LOCAL && !downloadOnly) {
    try { const r = await fetch(SAVE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: text }); if (r.ok) { state.dirty = false; saveWord = 'Saved into the game (models/people/hands.json). Reload the game to see it.'; paintDrawer(); return 'server'; } } catch (e) { /* not running: downloaded instead */ }
  }
  download(text); state.dirty = false; saveWord = 'Downloaded hands.json: hand it over to put it in the game.'; paintDrawer(); return 'download';
}
const edit = (fn) => { beginEdit(); lastPush = 0; fn(); changed(); paintDrawer(); };
document.addEventListener('click', async (e) => {
  const t = e.target; if (!t.closest) return;
  const w = t.closest('[data-who]'); if (w) { showWho(w.dataset.who); return; }
  const tb = t.closest('[data-tab]'); if (tb) { if (state.tab === tb.dataset.tab) state.open = !state.open; else { state.tab = tb.dataset.tab; state.open = true; } paintMenu(); return; }
  if (t.id === 'hide') { state.open = !state.open; paintMenu(); return; }
  const g = t.closest('[data-group]'); if (g) { state.group = g.dataset.group; const G = BONE_GROUPS.find((x) => x.id === state.group); state.bone = G.bones.find((n) => jointsOf(n).length) || G.bones[0]; paintDrawer(); return; }
  const bn = t.closest('[data-bone]'); if (bn) { pick(bn.dataset.bone); paintDrawer(); return; }
  const pr = t.closest('[data-prop]'); if (pr) { state.prop = pr.dataset.prop; paintDrawer(); return; }
  const c = t.closest('[data-clip]'); if (c) { showClip(c.dataset.clip); paintDrawer(); return; }
  const l = t.closest('[data-look]'); if (l) { look(l.dataset.look); return; }
  const ct = t.closest('[data-copyto]'); if (ct) { edit(() => copyClip(DATA, state.who, state.clip, ct.dataset.copyto)); return; }
  const side = state.bone.slice(-1);
  switch (t.id) {
    case 'songGo': if (song.on) song.stop(); else { song.start(song.id); state.frozen = false; } pose(0); paintDrawer(); return;
    case 'freeze': state.frozen = !state.frozen; if (state.frozen) state.time = action().time; paintDrawer(); return;
    case 'prev': case 'next': state.frozen = true; state.time = (state.time + (t.id === 'next' ? FRAME : -FRAME) + clipLen()) % clipLen(); pose(0); paintDrawer(); return;
    case 'toggleHat': setHat(!state.hat); paintDrawer(); return;
    case 'toggleBones': state.overlay = !state.overlay; paintOverlay(); paintDrawer(); return;
    case 'rBone': edit(() => resetBones(DATA, state.who, state.clip, [state.bone])); return;
    case 'rHand': edit(() => resetBones(DATA, state.who, state.clip, handBones(side))); return;
    case 'rArm': edit(() => resetBones(DATA, state.who, state.clip, armBones(side))); return;
    case 'rPlayer': edit(() => resetPlayer(DATA, state.who)); return;
    case 'rAll': edit(() => resetAll(DATA)); return;
    case 'pinL': case 'pinR': edit(() => pinHand(t.id.slice(-1))); return;
    case 'rProp': edit(() => { const c = DATA.players[state.who] && DATA.players[state.who][state.clip]; if (c && c.props) delete c.props[state.prop]; }); return;
    case 'copyLR': edit(() => copyPose(DATA, state.who, state.clip, 'L')); return;
    case 'copyRL': edit(() => copyPose(DATA, state.who, state.clip, 'R')); return;
    case 'undo': if (UNDO.length) { DATA = JSON.parse(UNDO.pop()); changed(); paintDrawer(); } return;
    case 'save': await save(); return;
    case 'down': await save({ downloadOnly: true }); return;
    case 'reload': { const r = await fetch(GAME + 'models/people/hands.json', { cache: 'no-cache' }); DATA = cleanHands(r.ok ? await r.json() : {}); setHands(DATA); state.dirty = false; saveWord = ''; pose(0); paintDrawer(); }
  }
});

// ── run ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
// the view centred in what the bar and the panel leave free, so the panel never sits over what's being looked at
function fitView() {
  const w = innerWidth, h = innerHeight, bar = $('bar').offsetHeight, d = $('drawer');
  document.documentElement.style.setProperty('--bar-h', bar + 'px');
  const open = state.open && !d.hidden, wide = w >= 900, below = bar + (open && !wide ? d.offsetHeight + 6 : 0), beside = open && wide ? d.offsetWidth + 10 : 0;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.setViewOffset(w, h, -beside / 2, below / 2, w, h); camera.updateProjectionMatrix();
}
addEventListener('resize', fitView);
let last = performance.now(), n = 0, tFps = last;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  fly(dt); controls.update();
  if (!state.frozen && !state.manual) { pose(dt); }
  else if (state.overlay) paintHandles();   // (the rings keep their size as the view moves)
  renderer.render(scene, camera);
  if (++n >= 30) { $('hud').textContent = `${Math.round(n * 1000 / (t - tFps))} fps`; n = 0; tFps = t; if (!state.frozen) refreshValues(); }
}
(async () => {
  try {
    await build();
    state.group = 'handL'; state.bone = 'WristL'; showWho('pianist'); state.open = innerWidth >= 900;
    paintMenu();
    $('loading').classList.add('gone'); $('loading').hidden = true;
    requestAnimationFrame(loop);
    window.HA.ready = true;
  } catch (e) { console.error(e); if (window.oops) window.oops(e); }
})();
// for the rigs (what the panel does, by name)
window.__songs = SONGS.map((x) => x.id);
window.HA = {
  ready: false, state, PLAYERS, scene,
  who: (id, clip) => showWho(id, clip), clip: (c) => { showClip(c); paintDrawer(); }, freeze: (t) => { state.frozen = true; state.time = t; pose(0); paintDrawer(); },
  joint: (bone, joint, v) => { const r = setJoint(DATA, state.who, state.clip, bone, joint, v); changed(); return r; }, get: (bone, joint) => getJoint(DATA, state.who, state.clip, bone, joint),
  prop: (name, { pos, rot } = {}) => { state.prop = name; const e = propEntry(); if (pos) e.pos = pos; if (rot) e.rot = rot; changed(); },
  hold: (name, bone) => { state.prop = name; const sel = { target: { id: 'holder', value: bone } }; const m = cur(), en = propEntry(); if (bone) { en.bone = bone; en.at = m.H.holdFrame(bone, new THREE.Matrix4()).invert().multiply(m.H.propWorld(name)).toArray(); delete en.pos; delete en.rot; } else { delete en.bone; delete en.at; } changed(); return sel; },
  reach: (side, p) => { const r = cur().H.reach(side, new THREE.Vector3(...p), state.clip); changed(); return r; },
  // a finger's tip: past its last bone by that bone's own length (the rig has no bone at the tip)
  tip: (f) => { const b = cur().p.bones[f], p = b.parent.getWorldPosition(new THREE.Vector3()), q = b.getWorldPosition(new THREE.Vector3()); return q.clone().add(q.clone().sub(p)).toArray(); },
  // (the bone's own twist counts: a list of world points on the fitted fingers, for the piano's clearance)
  world: (bone) => cur().p.bones[bone].getWorldPosition(new THREE.Vector3()).toArray(),
  propAt: (name) => new THREE.Vector3().setFromMatrixPosition(cur().H.propWorld(name)).toArray(),
  propMatrix: (name) => cur().H.propWorld(name).toArray(),
  elbow: (s) => cur().H.elbow(s), axis: (b, j) => { const a = cur().H.axis(b, j); return a && a.toArray(); },
  skinVerts: () => { const m = cur().p.mesh, sw = m.geometry.attributes.skinWeight, si = m.geometry.attributes.skinIndex, N = m.skeleton.bones.map(() => 0); for (let i = 0; i < sw.count; i++) for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > 0.01) N[si.getComponent(i, k)]++; return Object.fromEntries(m.skeleton.bones.map((b, i) => [b.name, N[i]]).filter(([k]) => /Twist|LowerArm/.test(k))); },
  screenOf: (bone) => toScreen(cur().p.bones[bone].getWorldPosition(new THREE.Vector3())),
  ringProbe: () => { paintHandles(); const R = activeRings[0]; if (!R) return null; R.ring.updateMatrixWorld(true); return toScreen(ringPts[8].clone().applyMatrix4(R.ring.matrixWorld)); },
  // the skin's turn part-way down the forearm against the wrist's: how the twist shares out, in the skin's own numbers
  twistProbe: () => {
    const m = cur().p.mesh, pos = m.geometry.attributes.position, sk = m.skeleton, wi = m.geometry.attributes.skinIndex, v = new THREE.Vector3(), near = [[], [], []];
    const E = new THREE.Vector3(), W = new THREE.Vector3(); const bd = (n) => new THREE.Matrix4().copy(sk.boneInverses[sk.bones.findIndex((b) => b.name === n)]).invert(); E.setFromMatrixPosition(bd('LowerArmR')); W.setFromMatrixPosition(bd('WristR'));
    const low = sk.bones.findIndex((b) => b.name === 'LowerArmR'), first = sk.bones.findIndex((b) => b.name === 'Twist1R'), ax = W.clone().sub(E), l2 = ax.lengthSq(), ids = [[], [], []];
    for (let i = 0; i < pos.count; i++) { const f = v.fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix).sub(E).dot(ax) / l2; let on = false; for (let k = 0; k < 4; k++) { const j = wi.getComponent(i, k); if (j === low || (j >= first && j < first + 5)) on = true; } if (!on) continue; if (f > 0.05 && f < 0.3) ids[0].push(i); else if (f > 0.4 && f < 0.6) ids[1].push(i); else if (f > 0.7 && f < 0.95) ids[2].push(i); }
    const at = (list) => list.map((i) => m.getVertexPosition ? m.getVertexPosition(i, new THREE.Vector3()) : null);
    const before = ids.map((l) => l.map((i) => { const p = new THREE.Vector3().fromBufferAttribute(pos, i); m.applyBoneTransform(i, p); return p; }));
    setJoint(DATA, state.who, state.clip, 'LowerArmR', 'twist', 90); changed(); cur().p.root.updateMatrixWorld(true); sk.update();
    const moved = ids.map((l, n) => { let s = 0; l.forEach((i, c) => { const p = new THREE.Vector3().fromBufferAttribute(pos, i); m.applyBoneTransform(i, p); s += p.distanceTo(before[n][c]); }); return l.length ? s / l.length : 0; });
    setJoint(DATA, state.who, state.clip, 'LowerArmR', 'twist', 0); changed();
    return { near: +moved[0].toFixed(4), mid: +moved[1].toFixed(4), far: +moved[2].toFixed(4), counts: ids.map((l) => l.length), ok: moved[0] < moved[1] && moved[1] < moved[2] };
  },
  size: (cm) => { const v = setSize(DATA, state.who, cm); changed(); return v; }, handCm: () => cur().H.handLength() * cur().H.handScale(), fullCm: () => cur().H.handLength(),
  rootMatrix: () => cur().p.root.matrixWorld.toArray(), keyX, keyWidth, KEYBOARD, song, keys: () => cur().keys, drums: () => cur().drums,
  pin: (S, prop) => { const c = DATA.players[state.who]?.[state.clip]; if (c?.pins?.[S]) pinHand(S); if (prop) pinHand(S, prop); changed(); },
  // a prop into a place: world matrix (16 numbers), held by a bone, or riding another prop
  placeProp: (name, M16, { bone = null, on = null, slide = 0 } = {}) => {
    state.prop = name; const e = propEntry(); delete e.pos; delete e.rot; delete e.bone; delete e.on; delete e.slide; const m = cur(), W = new THREE.Matrix4().fromArray(M16);
    if (bone) { e.bone = bone; e.at = m.H.holdFrame(bone, new THREE.Matrix4()).invert().multiply(W).toArray(); }
    else if (on) { e.on = on; if (slide) e.slide = slide; e.at = new THREE.Matrix4().copy(m.H.propWorld(on)).invert().multiply(W).toArray(); }
    changed();
  },
  step: (dt) => pose(dt),
  hat: (on) => setHat(on),
  look, cam: (p, t) => { camera.position.set(...p); controls.target.set(...t); controls.update(); }, overlay: (on) => { state.overlay = on; paintOverlay(); }, open: (on) => { state.open = on; paintMenu(); }, tab: (t) => { state.tab = t; state.open = true; paintMenu(); }, pick: (b) => { pick(b); paintDrawer(); },
  data: () => DATA, text: () => handsText(DATA), setData: (d) => { DATA = cleanHands(d); changed(); }, save, clean: () => { DATA = cleanHands(DATA); setHands(DATA); },
  render: () => renderer.render(scene, camera),
};
