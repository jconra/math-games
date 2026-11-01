// THE HANDS LAB: the band's hands, set by eye. The fiddler, the banjo player and the harmonica player with their
// instruments, made as the stage makes them (src/stage.js looks, src/bandgear.js what they hold), each playing the game's
// own clips. Freeze a frame, and each hand has sliders for moving it, turning it and curling its fingers, the elbow's
// swing, and a warning when an elbow bends past what the low-poly arm can take. Each clip keeps its own numbers. They are
// laid over the clip every frame by src/handpose.js, the game's own code; Save writes models/people/hands.json, which the game reads.
//   Save: served from this machine, sent to the little save script (rigs/town/save_server.cjs, POST /hands); else a download.
// window.HA for the rigs: HA.who(id), HA.clip(name), HA.freeze(t), HA.set(side, hand), HA.look(view), HA.arms(), HA.worst()
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { loadFolk, makePerson } from '../../src/actors/folk.js';
import { STAGE } from '../../src/stage.js';
import { makeHarmonicaModel, placeHarmonicaOn, holdFiddleOn, holdBanjoOn } from '../../src/bandgear.js';
import { loadHands, setHands, getHands, makeHandPose } from '../../src/handpose.js';
import { PLAYERS, ELBOW, cleanHand, cleanHands, handsText } from '../../src/handplan.js';

const $ = (id) => document.getElementById(id);
const GAME = new URL('../../', import.meta.url).href;
const LOCAL = ['127.0.0.1', 'localhost'].includes(location.hostname), SAVE_URL = 'http://127.0.0.1:8998/hands';
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x3a2c1f);
scene.add(new THREE.HemisphereLight(0xfff0dc, 0x4a3524, 1.5));
const key = new THREE.DirectionalLight(0xfff3e0, 2.2); key.position.set(1.5, 3.5, 3); scene.add(key);
const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.9 })); scene.add(floor);
const camera = new THREE.PerspectiveCamera(35, 1, 0.03, 60);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.minDistance = 0.12;

const state = { who: 'fiddler', clip: 'Play_Fiddle', frozen: true, time: 0.6, speed: 1, tab: 'L', dirty: false };
const made = {};   // who -> { p (the person), H (the hands' layer), length of each clip, harmonica }
let DATA = cleanHands({});
const cur = () => made[state.who], clipLen = () => { const a = cur().p.person.actions[state.clip]; return a ? a.getClip().duration : 1; };

async function build() {
  const folk = await loadFolk(GAME + 'models/people/');
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  await Promise.all([['m', 'clips_stage_m.glb'], ['f', 'clips_stage_f.glb']].map(([b, f]) => loader.loadAsync(folk.dir + f).then((g) => folk.addClips(b, g.animations))));
  await loadHands(GAME); DATA = cleanHands(getHands()); setHands(DATA);
  const looks = { fiddler: STAGE.fiddler, banjo: STAGE.banjoist, harpist: STAGE.harpist };
  for (const who of Object.keys(PLAYERS)) {
    const p = makePerson(folk, looks[who]); p.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    const m = made[who] = { p };
    if (who === 'fiddler') m.props = holdFiddleOn(p);
    if (who === 'banjo') m.props = holdBanjoOn(p);
    if (who === 'harpist') { m.harmonica = makeHarmonicaModel(STAGE.harp); scene.add(m.harmonica); }
    m.H = makeHandPose(p, who, { props: m.props });
    p.root.visible = false; scene.add(p.root);
  }
}
function showWho(who, clip = PLAYERS[who].clips[0]) {
  for (const k of Object.keys(made)) { made[k].p.root.visible = k === who; if (made[k].harmonica) made[k].harmonica.visible = k === who; }
  state.who = who; showClip(clip); look('whole'); paintMenu();
}
function showClip(name) {
  state.clip = name; const P = cur().p.person;
  P.mixer.stopAllAction(); P.cur = null; P.curName = ''; cur().p.play(name, { fade: 0 }); P.cur.stopFading().setEffectiveWeight(1); state.time = Math.min(state.time, clipLen());
  pose(0);
}
// the clip at its time (frozen), or running on; the hands laid over it
function pose(dt) {
  const m = cur(), P = m.p.person, a = P.actions[state.clip];
  m.H.before();
  if (state.frozen) { a.paused = false; a.time = state.time; m.p.update(0); }
  else { a.paused = false; m.p.update(dt * state.speed); state.time = a.time; }
  m.H.after();
  if (m.harmonica) { m.p.root.updateMatrixWorld(true); placeHarmonicaOn(m.p, m.harmonica, STAGE.harp); }
}
const LOOK = {
  whole: () => [[0.9, 1.25, 2.6], [0, 0.95, 0]],
  L: () => bonesLook('WristL', 0.65), R: () => bonesLook('WristR', 0.65),
  elbowL: () => bonesLook('LowerArmL', 0.7, -1), elbowR: () => bonesLook('LowerArmR', 0.7, -1),
  back: () => [[-0.6, 1.4, -2.2], [0, 1, 0]],
};
function bonesLook(bone, dist, side = 1) {
  const m = cur(), b = m.p.bones[bone]; m.p.root.updateMatrixWorld(true);
  const at = b.getWorldPosition(new THREE.Vector3());
  return [[at.x + 0.35 * dist * side * (bone.endsWith('L') ? 1 : -1), at.y + 0.3 * dist, at.z + dist], at.toArray()];
}
function look(name) { const [p, t] = LOOK[name] ? LOOK[name]() : LOOK.whole(); camera.position.set(...p); controls.target.set(...t); controls.update(); }

// ── flying the view from the keyboard: W A S D along the way it faces, Space up, C down ───────────────────────────────
const FLY = { KeyW: [0, 0, 1], KeyS: [0, 0, -1], KeyA: [-1, 0, 0], KeyD: [1, 0, 0], Space: [0, 1, 0], KeyC: [0, -1, 0] }, keys = new Set();
addEventListener('keydown', (e) => { if (!FLY[e.code] || e.ctrlKey || e.metaKey || e.altKey) return; keys.add(e.code); if (e.code === 'Space') { e.preventDefault(); if (document.activeElement) document.activeElement.blur(); } });
addEventListener('keyup', (e) => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function fly(dt) {
  if (!keys.size) return; let fx = 0, fy = 0, fz = 0; for (const k of keys) { const v = FLY[k]; fx += v[0]; fy += v[1]; fz += v[2]; }
  camera.getWorldDirection(_f); _f.y = 0; _f.normalize(); _r.crossVectors(_f, UP).normalize();
  _s.set(0, 0, 0).addScaledVector(_f, fz).addScaledVector(_r, fx); _s.y = fy; _s.multiplyScalar(0.9 * dt);
  camera.position.add(_s); controls.target.add(_s);
}

// ── the numbers being edited ──────────────────────────────────────────────────────────────────────────────────────────
function handOf(who = state.who, clip = state.clip, side = state.tab) {
  const pl = DATA.players[who] || (DATA.players[who] = {}), c = pl[clip] || (pl[clip] = {});
  return c[side] || (c[side] = cleanHand(null));
}
const changed = () => { state.dirty = true; say(); worstCache = null; };
let saveWord = '';
function say(text) { if (text !== undefined) saveWord = text; }

// how far the elbows bend at this frame, and the worst through the clip
let worstCache = null;
function worst() {
  if (worstCache && worstCache.who === state.who && worstCache.clip === state.clip) return worstCache;
  const m = cur(), P = m.p.person, a = P.actions[state.clip], len = clipLen(), keep = state.time, o = { who: state.who, clip: state.clip, L: { bend: 0, at: 0 }, R: { bend: 0, at: 0 } };
  for (let i = 0; i < 24; i++) {
    const t = len * i / 24; m.H.before(); a.time = t; m.p.update(0); m.H.after();
    const A = m.H.arms(); for (const s of ['L', 'R']) if (A[s] && A[s].bend > o[s].bend) o[s] = { bend: A[s].bend, at: t };
  }
  state.time = keep; pose(0);
  return (worstCache = o);
}
function warnings() {
  const W = worst(), now = cur().H.arms(), lines = [];
  for (const s of ['L', 'R']) if (W[s].bend > ELBOW.warn) lines.push(`${PLAYERS[state.who].hands[s].split(' (')[0]}: the elbow bends ${Math.round(W[s].bend)} degrees at ${W[s].at.toFixed(2)} s; the arm folds in past about ${ELBOW.warn}. Move the hand away from the shoulder, or swing the elbow.`);
  const w = $('warn'); w.hidden = !lines.length; w.textContent = lines.join(' ');
  const b = $('bend'); if (b) b.innerHTML = ['L', 'R'].map((s) => `${s === 'L' ? 'Left' : 'Right'} elbow: <b class="${now[s].bend > ELBOW.warn ? 'over' : ''}">${Math.round(now[s].bend)}</b> now, <b class="${W[s].bend > ELBOW.warn ? 'over' : ''}">${Math.round(W[s].bend)}</b> at worst in this clip`).join(' &nbsp;·&nbsp; ');
}

// ── the menu ──────────────────────────────────────────────────────────────────────────────────────────────────────────
function paintMenu() {
  $('who').innerHTML = Object.entries(PLAYERS).map(([id, d]) => `<button class="chip${id === state.who ? ' on' : ''}" data-who="${id}">${d.name}</button>`).join('');
  const P = PLAYERS[state.who];
  const tabs = [['clip', 'Clip and frame'], ['L', P.hands.L], ['R', P.hands.R], ['save', 'Save']];
  $('tabs').innerHTML = tabs.map(([id, l]) => `<button class="tab${state.tab === id ? ' on' : ''}" data-tab="${id}" role="tab">${l}</button>`).join('');
  paintDrawer();
}
const row = (id, label, min, max, step, val, unit) => `<label class="ha-row"><span>${label}</span><input type="range" data-k="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><output>${(+val).toFixed(step < 1 ? 2 : 0)}${unit}</output></label>`;
function paintDrawer() {
  const d = $('drawer'), P = PLAYERS[state.who], t = state.tab;
  d.hidden = false;
  if (t === 'clip') {
    d.innerHTML = `<div class="ha-btns">${P.clips.map((c) => `<button class="ha-btn${c === state.clip ? ' on' : ''}" data-clip="${c}">${c.replace(/_/g, ' ')}</button>`).join('')}</div>
      <div class="ha-btns"><button class="ha-btn${state.frozen ? ' on' : ''}" id="freeze">${state.frozen ? 'Frozen (press to play)' : 'Playing (press to freeze)'}</button></div>
      ${row('time', 'Frame (seconds)', 0, clipLen(), 0.01, state.time, ' s')}${row('speed', 'Playing speed', 0.1, 1.5, 0.05, state.speed, 'x')}
      <div class="ha-bend" id="bend"></div>
      <div class="ha-btns"><button class="ha-btn" data-look="whole">Whole player</button><button class="ha-btn" data-look="L">Left hand</button><button class="ha-btn" data-look="R">Right hand</button><button class="ha-btn" data-look="elbowL">Left elbow</button><button class="ha-btn" data-look="elbowR">Right elbow</button><button class="ha-btn" data-look="back">From behind</button></div>
      <p class="ha-note">Drag to turn the view, W A S D to fly, Space up, C down.</p>`;
  } else if (t === 'L' || t === 'R') {
    const h = handOf();
    d.innerHTML = `<h2>${P.hands[t]} <small>${state.clip.replace(/_/g, ' ')}, its own numbers</small></h2><div class="ha-bend" id="bend"></div>
      <div class="ha-grid"><div><div class="ha-h">Move the hand (the arm follows)</div>${row('off0', 'To his left', -20, 20, 0.25, h.off[0], ' cm')}${row('off1', 'Up', -20, 20, 0.25, h.off[1], ' cm')}${row('off2', 'Forward', -20, 20, 0.25, h.off[2], ' cm')}
        <div class="ha-h">The elbow</div>${row('elbow', 'Swing it round', -120, 120, 1, h.elbow, '°')}</div>
      <div><div class="ha-h">Turn the hand</div>${row('rot0', 'About x', -120, 120, 1, h.rot[0], '°')}${row('rot1', 'About y', -120, 120, 1, h.rot[1], '°')}${row('rot2', 'About z', -120, 120, 1, h.rot[2], '°')}
        <div class="ha-h">Curl</div>${row('fingers', 'Fingers', -60, 90, 1, h.curl.fingers, '°')}${row('thumb', 'Thumb', -60, 90, 1, h.curl.thumb, '°')}</div></div>
      <div class="ha-btns"><button class="ha-btn" data-look="${t}">Look at this hand</button><button class="ha-btn" data-look="elbow${t}">Look at its elbow</button><button class="ha-btn" id="freezeB">${state.frozen ? 'Frozen' : 'Playing'}</button><button class="ha-btn" id="handAll">Use for all this player's clips</button><button class="ha-btn" id="handZero">Back to the clip's own</button></div>`;
  } else {
    d.innerHTML = `<h2>Save <small>models/people/hands.json: the game reads it when the band is made</small></h2>
      <div class="ha-btns"><button class="ha-btn" id="save">Save into the game</button><button class="ha-btn" id="down">Download the file</button><button class="ha-btn" id="reload">Back to what's saved</button></div>
      <p class="ha-note" id="saved">${saveWord || (state.dirty ? 'Changes not saved yet.' : 'Nothing changed since the file was read.')}</p>
      <p class="ha-note">On this machine Save needs the little save script running: node ~/pw/bandit-math/rigs/town/save_server.cjs. Without it the file is downloaded instead.</p>`;
  }
  warnings();
}
function setK(k, v) {
  if (k === 'time') { state.time = v; pose(0); return; }
  if (k === 'speed') { state.speed = v; return; }
  const h = handOf();
  if (k.startsWith('off')) h.off[+k[3]] = v; else if (k.startsWith('rot')) h.rot[+k[3]] = v; else if (k === 'elbow') h.elbow = v; else if (k === 'fingers') h.curl.fingers = v; else if (k === 'thumb') h.curl.thumb = v;
  setHands(DATA); changed(); pose(0);
}
$('drawer').addEventListener('input', (e) => { const k = e.target.dataset && e.target.dataset.k; if (!k) return; const v = +e.target.value; const step = +e.target.step; e.target.nextElementSibling.textContent = v.toFixed(step < 1 ? 2 : 0) + e.target.nextElementSibling.textContent.replace(/^[-\d.]+/, ''); setK(k, v); warnings(); });
const download = (text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'hands.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
async function save({ downloadOnly = false } = {}) {
  const text = handsText(DATA);
  if (LOCAL && !downloadOnly) {
    try { const r = await fetch(SAVE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: text }); if (r.ok) { state.dirty = false; say('Saved into the game (models/people/hands.json). Reload the game to see it.'); paintDrawer(); return 'server'; } } catch (e) { /* not running: downloaded instead */ }
  }
  download(text); state.dirty = false; say('Downloaded hands.json: hand it over to put it in the game.'); paintDrawer(); return 'download';
}
document.addEventListener('click', async (e) => {
  const t = e.target; if (!t.closest) return;
  const w = t.closest('[data-who]'); if (w) { showWho(w.dataset.who); return; }
  const tb = t.closest('[data-tab]'); if (tb) { state.tab = state.tab === tb.dataset.tab && tb.dataset.tab !== 'L' && tb.dataset.tab !== 'R' ? state.tab : tb.dataset.tab; paintMenu(); return; }
  const c = t.closest('[data-clip]'); if (c) { showClip(c.dataset.clip); paintDrawer(); return; }
  const l = t.closest('[data-look]'); if (l) { look(l.dataset.look); return; }
  if (t.id === 'freeze' || t.id === 'freezeB') { state.frozen = !state.frozen; if (!state.frozen) state.time = cur().p.person.actions[state.clip].time; paintDrawer(); return; }
  if (t.id === 'handAll') { const h = handOf(); for (const cl of PLAYERS[state.who].clips) handOf(state.who, cl, state.tab); for (const cl of PLAYERS[state.who].clips) DATA.players[state.who][cl][state.tab] = JSON.parse(JSON.stringify(h)); changed(); pose(0); return; }
  if (t.id === 'handZero') { DATA.players[state.who][state.clip][state.tab] = cleanHand(null); setHands(DATA); changed(); pose(0); paintDrawer(); return; }
  if (t.id === 'save') { await save(); return; }
  if (t.id === 'down') { await save({ downloadOnly: true }); return; }
  if (t.id === 'reload') { const r = await fetch(GAME + 'models/people/hands.json', { cache: 'no-cache' }); DATA = cleanHands(r.ok ? await r.json() : {}); setHands(DATA); state.dirty = false; say(''); worstCache = null; pose(0); paintDrawer(); }
});

// ── run ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
let last = performance.now(), n = 0, tFps = last;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  fly(dt); controls.update();
  if (!state.frozen || keysPosed) pose(dt);
  renderer.render(scene, camera);
  if (++n >= 30) { $('hud').textContent = `${Math.round(n * 1000 / (t - tFps))} fps`; n = 0; tFps = t; if (!state.frozen) { const tl = $('drawer').querySelector('[data-k="time"]'); if (tl) { tl.value = state.time; tl.nextElementSibling.textContent = state.time.toFixed(2) + ' s'; } warnings(); } }
}
const keysPosed = false;
(async () => {
  try {
    resize(); await build();
    state.tab = 'clip'; showWho('fiddler');
    $('loading').classList.add('gone'); $('loading').hidden = true;
    requestAnimationFrame(loop);
    window.HA.ready = true;
  } catch (e) { console.error(e); if (window.oops) window.oops(e); }
})();
window.HA = {
  ready: false, state, PLAYERS,
  who: (id, clip) => showWho(id, clip), clip: (c) => { showClip(c); paintDrawer(); }, freeze: (t) => { state.frozen = true; state.time = t; pose(0); paintDrawer(); },
  set: (side, h, { who = state.who, clip = state.clip } = {}) => { const pl = DATA.players[who] || (DATA.players[who] = {}); (pl[clip] || (pl[clip] = {}))[side] = cleanHand(h); setHands(DATA); changed(); pose(0); },
  look, cam: (p, t) => { camera.position.set(...p); controls.target.set(...t); controls.update(); }, arms: () => cur().H.arms(), worst: () => { worstCache = null; const w = worst(); return { L: w.L, R: w.R }; }, data: () => DATA, text: () => handsText(DATA), save, tab: (t) => { state.tab = t; paintMenu(); },
  pieces: () => { const out = {}; const m = cur(); for (const n of ['WristL', 'WristR', 'LowerArmL', 'LowerArmR']) out[n] = m.p.bones[n].getWorldPosition(new THREE.Vector3()).toArray(); return out; },
};
