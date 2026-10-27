// THE STONE LAB: stone walls built stone by stone in code (stonewall.js, which the game can use as it is), drawn with
// the Material Lab's stone texture and weathering shader (moss, grime, darker rounded edges), under the same sun and sky.
// This file: the scene, the light, the panel, the stats, and what goes with each shape (a door and bars for the jail, a
// plain building on the foundation).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeTextures, setStone, STONE_LOOKS } from '../materials/textures.js';
import { makeRubbleTexture } from './stonetex.js?v=4';
import { U, weather } from '../materials/weather.js';
import { buildStoneWall, stoneEdges, stoneRecipe, RECIPE_DEFAULTS, SHAPES, STYLES, PALETTES, MORTARS } from './stonewall.js?v=4';

const $ = (s, el = document) => el.querySelector(s);
const num = (n) => Math.round(n).toLocaleString('en-US');

// ── renderer, scene, camera, light (the Material Lab's) ───────────────────────────────────────────────────────────────
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 0.6; controls.maxDistance = 60;
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.012;
const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x5a4a34, 1.0);
scene.add(sun, sun.target, hemi);

// the building's recipe (what a town would keep for it) is the first part of this; the rest is how the lab shows it
const state = {
  ...RECIPE_DEFAULTS,
  wire: false, stone: 'rubble', moss: 0.45, grime: 0.45, az: 200, hour: 15.5, shadows: true,
};
// the rock textures on offer: this lab's own (plain warm grey with blotches, faint strata, a few pits and lichen
// clusters), or any of the Material Lab's looks
const LOOKS = { rubble: { label: 'Rubble (this lab)', rough: 0.93 }, ...STONE_LOOKS };

// the sun: compass direction and time of day (as in the Material Lab)
const SKY_DAY = new THREE.Color(0x9cbbe0), SKY_DUSK = new THREE.Color(0xd99a72), SUN_DAY = new THREE.Color(0xfff3e2), SUN_LOW = new THREE.Color(0xffa060);
const sunDir = new THREE.Vector3();
let viewCentre = new THREE.Vector3(0, 1.3, 0), viewExt = 6;
function applyLight() {
  const az = state.az * Math.PI / 180, day = Math.sin(Math.PI * (state.hour - 6) / 12);
  const el = Math.max(0.035, day) * 62 * Math.PI / 180;
  sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();   // +x east, -z north
  const k = THREE.MathUtils.smoothstep(Math.sin(el), 0.04, 0.55);
  sun.color.copy(SUN_LOW).lerp(SUN_DAY, k); sun.intensity = 1.0 + 2.4 * k;
  const sky = SKY_DUSK.clone().lerp(SKY_DAY, k).multiplyScalar(0.55 + 0.45 * k);
  hemi.color.copy(sky).lerp(new THREE.Color(1, 1, 1), 0.25); hemi.intensity = 0.9 + 0.8 * k;
  scene.background = sky; scene.fog = new THREE.Fog(sky, 45, 140);
  sun.position.copy(viewCentre).addScaledVector(sunDir, 40); sun.target.position.copy(viewCentre); sun.target.updateMatrixWorld();
  Object.assign(sun.shadow.camera, { left: -viewExt, right: viewExt, top: viewExt, bottom: -viewExt, near: 1, far: 90 }); sun.shadow.camera.updateProjectionMatrix();
  sun.castShadow = state.shadows;
}
function applyWeather() {
  U.uMossAmt.value = state.moss; U.uGrimeAmt.value = state.grime;
  if (mats.stone) mats.stone.wireframe = state.wire;
  if (wall) mats.stone.userData.top.value = wall.top;
}

// ── the wall and what goes with it ────────────────────────────────────────────────────────────────────────────────────
let T, RT, wall = null, ground, groundGeo;
const mats = {}, group = new THREE.Group(); scene.add(group);
const extras = new THREE.Group(); scene.add(extras);
const stats = { ms: 0, texMs: 0 };
// the rock texture: this lab's own, or one of the Material Lab's looks (painted into its textures)
function useLook(k) {
  state.stone = LOOKS[k] ? k : 'rubble';
  if (state.stone === 'rubble') { mats.stone.map = RT.map; mats.stone.normalMap = RT.normalMap; }
  else { setStone(T, state.stone); mats.stone.map = T.stone; mats.stone.normalMap = T.stoneN; }
  mats.stone.roughness = LOOKS[state.stone].rough; mats.stone.needsUpdate = true;
}
function rebuild() {
  if (wall) { wall.stone.dispose(); wall.mortar.dispose(); }
  for (const m of [...group.children]) group.remove(m);
  for (const m of [...extras.children]) { extras.remove(m); m.geometry.dispose(); }
  wall = buildStoneWall(stoneRecipe(state), { texMean: state.stone === 'rubble' ? RT.mean : T.stoneMean });
  const rb = $('#recipe'); if (rb) rb.textContent = JSON.stringify(stoneRecipe(state));
  const s = new THREE.Mesh(wall.stone, mats.stone), m = new THREE.Mesh(wall.mortar, mats.stone);
  s.name = 'stones'; m.name = 'mortar';
  for (const x of [s, m]) { x.castShadow = x.receiveShadow = true; group.add(x); }
  addExtras();
  bakeGround();
  applyWeather(); updateStats();
}
// the jail's door (planks, iron straps, a small barred grille) and window bars; a plain building on the foundation
function addExtras() {
  const wood = [], iron = [];
  const put = (list, w, h, d, at, U, N, dy = 0) => {
    const g = new THREE.BoxGeometry(w, h, d), M = new THREE.Matrix4();
    const X = new THREE.Vector3(...U), Z = new THREE.Vector3(...N), Y = new THREE.Vector3().crossVectors(Z, X);
    M.makeBasis(X, Y, Z).setPosition(at[0], at[1] + dy, at[2]);
    g.applyMatrix4(M); list.push(g);
  };
  for (const op of wall.openings) {
    if (op.through) continue;
    const back = op.depth - 0.03, at = (u, v, d) => [op.centre[0] + op.U[0] * u - op.N[0] * d, op.centre[1] + v, op.centre[2] + op.U[2] * u - op.N[2] * d];
    if (op.kind === 'door') {
      const nP = 5, pw = op.w / nP;
      for (let i = 0; i < nP; i++) put(wood, pw - 0.008, op.h - 0.02, 0.05, at(-op.w / 2 + pw * (i + 0.5), 0, back), op.U, op.N);
      for (const v of [-0.62, 0.0, 0.62]) put(iron, op.w - 0.04, 0.06, 0.012, at(0, v * op.h / 2 * 1.3, back - 0.03), op.U, op.N);
      for (const u of [-0.06, 0, 0.06]) put(iron, 0.014, 0.2, 0.014, at(u, op.h * 0.27, back - 0.035), op.U, op.N);
      put(iron, 0.18, 0.016, 0.014, at(0, op.h * 0.27 + 0.1, back - 0.035), op.U, op.N); put(iron, 0.18, 0.016, 0.014, at(0, op.h * 0.27 - 0.1, back - 0.035), op.U, op.N);
    } else {
      const nb = Math.max(3, Math.round(op.w / 0.11));
      for (let i = 1; i < nb; i++) put(iron, 0.018, op.h + 0.04, 0.018, at(-op.w / 2 + op.w * i / nb, 0, 0.06), op.U, op.N);
      put(iron, op.w + 0.03, 0.02, 0.022, at(0, op.h * 0.2, 0.06), op.U, op.N);
    }
  }
  // a dry chimney's stovepipe: dark iron, a rim at its top
  if (wall.pipe) {
    const { x, y, z, r, h } = wall.pipe, pipe = new THREE.CylinderGeometry(r, r, h, 14, 1, true), rim = new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.03, 14);
    pipe.translate(x, y + h / 2 - 0.05, z); rim.translate(x, y + h - 0.05, z); iron.push(pipe, rim);
  }
  const B = wall.building;
  if (B) {
    const w = B.x1 - B.x0, d = B.z1 - B.z0, h = 2.4, cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    const body = new THREE.BoxGeometry(w, h, d); body.translate(cx, B.y + h / 2, cz); wood.push(body);
    // the roof: a solid gable block (its triangle ends in wood, its slopes in roofing), overhanging 30 cm all round
    const rise = 1.1, y = B.y + h, ov = 0.3;
    const sh = new THREE.Shape([new THREE.Vector2(-(B.z1 + ov), y - 0.12), new THREE.Vector2(-(B.z0 - ov), y - 0.12), new THREE.Vector2(-cz, y + rise)]);
    const rg = new THREE.ExtrudeGeometry(sh, { depth: w + 2 * ov, bevelEnabled: false });
    rg.rotateY(Math.PI / 2); rg.translate(B.x0 - ov, 0, 0);
    const rm = new THREE.Mesh(rg, [mats.wood, mats.roof]); rm.castShadow = rm.receiveShadow = true; extras.add(rm);
  }
  for (const [list, mat] of [[wood, B ? mats.wood : mats.door], [iron, mats.iron]]) {
    if (!list.length) continue;
    const g = mergeGeometries(list.map((x) => (x.index ? x.toNonIndexed() : x)).map((x) => { for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k); return x; }));
    const mesh = new THREE.Mesh(g, mat); mesh.castShadow = mesh.receiveShadow = true; extras.add(mesh);
  }
}
// the ground: grass, worn to dirt round the foot of the wall
// (and shaded where it meets the wall, so the wall stands in the ground instead of on a line)
function bakeGround() {
  const P = groundGeo.attributes.position, A = groundGeo.attributes.aTintPaint, O = groundGeo.attributes.aAO, b = wall.box;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i), d = Math.hypot(Math.max(b.min.x - x, 0, x - b.max.x), Math.max(b.min.z - z, 0, z - b.max.z));
    A.array[i * 4] = 0.85 * (1 - THREE.MathUtils.smoothstep(d, 0.1, 1.1));
    O.array[i] = 0.55 + 0.45 * THREE.MathUtils.smoothstep(d, 0, 0.7);
  }
  A.needsUpdate = O.needsUpdate = true;
}

// ── views: where the camera starts for each shape ─────────────────────────────────────────────────────────────────────
const VIEWS = {
  wall: { c: [0, 1.25, 0], off: [0.6, 0.35, 8.6] },
  corner: { c: [-0.3, 1.05, -0.2], off: [5.6, 2.0, 6.2] },
  chimney: { c: [0, 2.6, 0], off: [5.6, 1.4, 9.0] },
  jail: { c: [0, 1.3, 0], off: [5.8, 2.3, 8.2] },
  foundation: { c: [0, 1.0, 0], off: [6.6, 2.6, 8.4] },
  fieldwall: { c: [0, 0.5, 0], off: [4.6, 2.4, 10.2] },
};
function applyView(moveCamera = true) {
  const V = VIEWS[state.shape];
  viewCentre = new THREE.Vector3(...V.c);
  const b = wall.box; viewExt = Math.max(b.max.x - b.min.x, b.max.z - b.min.z, b.max.y) * 0.75 + 1.5;
  const back = Math.min(2.6, Math.max(1, 1.15 / camera.aspect));
  if (moveCamera) { controls.target.copy(viewCentre); camera.position.copy(viewCentre).add(new THREE.Vector3(...V.off).multiplyScalar(back)); controls.update(); }
  applyLight();
}

// ── the panel ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const R_ = (label, key, min, max, step, fmt = (v) => (+v).toFixed(2), live = false) => ({ label, key, min, max, step, fmt, live });
const cm = (v) => (v * 100).toFixed(1) + ' cm', mm = (v) => (+v).toFixed(2) + ' m';
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const fmtAz = (v) => Math.round(v) + '° ' + COMPASS[Math.round(v / 45) % 8];
const fmtHour = (v) => { const h = Math.floor(v), m = Math.round((v - h) * 60); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? 'am' : 'pm'); };
const WALL_SLIDERS = [R_('Stone size', 'size', 0.15, 0.6, 0.01, mm), R_('Irregularity', 'irregularity', 0, 1, 0.01), R_('Joint width', 'joint', 0, 0.05, 0.001, cm), R_('Mortar depth', 'mortarDepth', 0, 0.05, 0.001, cm),
  R_('Colour mix', 'colourMix', 0, 1, 0.01), R_('Bulge', 'bulge', 0, 2, 0.01)];
const LOOK_SLIDERS = [R_('Moss', 'moss', 0, 1, 0.01, undefined, true), R_('Grime', 'grime', 0, 1, 0.01, undefined, true), R_('Edge darkening', 'uEdgeDark', 0, 1, 0.01, undefined, true),
  R_('Edge width', 'uEdgeDarkW', 0.005, 0.1, 0.0025, cm, true), R_('Bevel light', 'uBevel', 0, 1.5, 0.01, undefined, true)];
const LIGHT_SLIDERS = [R_('Sun direction', 'az', 0, 359, 1, fmtAz, true), R_('Time of day', 'hour', 5.5, 19.5, 0.25, fmtHour, true)];
const getV = (k) => (k[0] === 'u' && U[k] ? U[k].value : state[k]);
let rebuildTimer = 0;
function setV(k, v) {
  if (k[0] === 'u' && U[k]) U[k].value = v; else state[k] = v;
  if (['az', 'hour', 'shadows'].includes(k)) applyLight();
  else if (['moss', 'grime', 'wire'].includes(k) || k[0] === 'u') applyWeather();
  else if (k === 'stone') { useLook(v); rebuild(); }
  else { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 30); }   // the wall's own options: build it again
}
const panel = $('#panel');
function buildPanel() {
  const slider = (r) => `<div class="row" data-key="${r.key}"><label for="r-${r.key}">${r.label}</label><input type="range" id="r-${r.key}" min="${r.min}" max="${r.max}" step="${r.step}" value="${getV(r.key)}"><output>${r.fmt(getV(r.key))}</output></div>`;
  const picks = (attr, obj) => `<div class="picks">${Object.entries(obj).map(([k, S]) => `<button class="btn" data-${attr}="${k}" title="${S.note || S.label}">${S.label}</button>`).join('')}</div>`;
  panel.innerHTML = `<h1>Stone Lab</h1><p class="sub">Stone walls built stone by stone, in code. <a href="../">All labs</a></p>
  <details class="sec" open><summary>Wall</summary><div class="body">
    <div class="lbl">Shape</div>${picks('shape', SHAPES)}
    <div class="lbl">Style</div>${picks('style', STYLES)}
    <div class="seedrow"><label for="seed">Seed</label><input id="seed" type="number" min="1" step="1" value="${state.seed}"><button class="btn" id="newSeed">New seed</button></div>
    ${WALL_SLIDERS.map(slider).join('')}
    <div class="row two"><label for="s-pal">Stone colours</label><select id="s-pal"><option value="auto">Its own (by shape and style)</option>${Object.entries(PALETTES).map(([k, L]) => `<option value="${k}">${L.label}</option>`).join('')}</select></div>
    <div class="row two"><label for="s-mortar">Mortar</label><select id="s-mortar">${Object.entries(MORTARS).map(([k, L]) => `<option value="${k}">${L.label}</option>`).join('')}</select></div>
    <div class="row two"><label for="s-stone">Stone texture</label><select id="s-stone">${Object.entries(LOOKS).map(([k, L]) => `<option value="${k}">${L.label}</option>`).join('')}</select></div>
    <div class="row check"><label><input type="checkbox" id="wire"> Wireframe (see the triangles)</label></div>
    <div class="lbl">This building's recipe</div><pre class="recipe" id="recipe"></pre>
    <p class="note">Everything that makes this stonework its own, small enough for the town to keep one per building.</p>
    <details class="how"><summary>How it works</summary>
      <p>Each block of wall is <b>unrolled</b> into one long strip, all the way round its footprint, the stones are laid out flat on the strip, and the strip is folded back round the corners. A stone that crosses a corner folds with it: that is a corner stone.</p>
      <p><b>Mortared</b>: odd-shaped stones laid flat in rough rows that keep breaking, the way rubble walls were built. Rows are every height (0.6 to 1.4 times the average) and their beds tilt up and down. About a third of the stones stand two rows tall, some are split into two smaller ones, and now and then a little wedge stone sits where a joint meets the bed below. Every stone has two or three corners knocked off, each at its own angle, and joints are kept away from the joints in the row below. Each stone bulges out 15 to 20% of its height and sticks out by its own amount. The corner stones are the same stones, long and short in turn on each face, folding round the corner (both halves share the fold exactly); so are the stones beside a door or window. In an inside corner the two faces take turns course by course: one face's stone runs into the corner and the other's butts against it. A lintel goes over each opening and a sill under a window, fitted to the rows. The coping is closed slabs: their undersides all sit on the wall top, their sides are drawn where they meet, and a chip never reaches past the wall line.</p>
      <p><b>Mortar</b>: one family for every mortared building: light lime, grey (the usual) or dark, set back 3.5 cm, with a shadow band under each stone. The dry styles have no mortar: their gaps show a deep warm grey-brown, set well back.</p>
      <p><b>Dry-stacked</b>: the way a person builds with stones they found. The wall keeps a lumpy top line. At its lowest dip, stones from a pile of forty flat field stones are tried there, laid on their beds or tipped a little; the one that leaves the least empty space under it is kept, and the top line moves up over it. Where nothing fits, a small stone is knocked to fit the gap. One over two: a stone whose end would sit right over the end of the stone under it counts as a poor fit, so no joint runs straight up the wall. No mortar: the gaps show the backing in the mortar's colour, set well back.</p>
      <p><b>Ledgestone</b>: the same stacking with thin slabs, 20 cm to over a metre long, thicker at one end than the other, their ends broken off, a thick one now and then.</p>
      <p><b>Colours</b>: one palette per building (a base colour, a second, a darker grey and a rust-tan), drifting slowly across the wall so like stones gather; each stone lighter or darker by one number for all three channels.</p>
      <p>A stone's face is a <b>fan</b> of triangles round its centre, and the centre is pushed out (the bulge): a six-sided stone is six triangles. Its sides are only drawn where they show: in an opening, round a sill, along the edge of the top stones. Every corner knows how far it is from the stone's outline, so the shader darkens and rounds the edges with no extra triangles.</p>
      <p>The colours are warm greys, tan and buff. A stone takes one and is made lighter or darker by one number for all three channels (one each would change its colour).</p>
    </details>
  </div></details>
  <details class="sec" open><summary>Look</summary><div class="body">${LOOK_SLIDERS.map(slider).join('')}
    <details class="how"><summary>How it works</summary><p>This lab's own rock texture (blotches, faint strata, a few pits, lichen in clusters) or one of the Material Lab's, with the Material Lab's weathering shader. Each stone reads its own window of the texture, projected onto the wall (no hand-made UVs). Moss grows on what faces up; rain streaks start under the coping and the window sills (each corner knows the ledge above it); mud is splashed up the bottom 40 cm. Edge darkening and bevel light work from each corner's distance to the stone's outline.</p></details>
  </div></details>
  <details class="sec"${window.innerWidth < 760 ? '' : ' open'}><summary>Light</summary><div class="body">${LIGHT_SLIDERS.map(slider).join('')}
    <div class="row check"><label><input type="checkbox" id="shadows" checked> Shadows</label></div></div></details>`;
  panel.querySelectorAll('.row[data-key]').forEach((row) => {
    const k = row.dataset.key, r = [...WALL_SLIDERS, ...LOOK_SLIDERS, ...LIGHT_SLIDERS].find((x) => x.key === k), inp = $('input', row), out = $('output', row);
    inp.addEventListener('input', () => { out.textContent = r.fmt(inp.value); setV(k, +inp.value); });
  });
  panel.addEventListener('click', (e) => {
    const sh = e.target.closest('[data-shape]'); if (sh) { state.shape = sh.dataset.shape; rebuild(); applyView(); syncPanel(); }
    const sy = e.target.closest('[data-style]'); if (sy) { state.style = sy.dataset.style; rebuild(); syncPanel(); }
  });
  $('#seed').addEventListener('change', (e) => setV('seed', Math.max(1, Math.round(+e.target.value) || 1)));
  $('#newSeed').addEventListener('click', () => { state.seed = 1 + Math.floor(Math.random() * 99999); $('#seed').value = state.seed; rebuild(); });
  $('#s-stone').addEventListener('change', (e) => setV('stone', e.target.value));
  $('#s-pal').addEventListener('change', (e) => setV('palette', e.target.value));
  $('#s-mortar').addEventListener('change', (e) => setV('mortar', e.target.value));
  $('#wire').addEventListener('change', (e) => setV('wire', e.target.checked));
  $('#shadows').addEventListener('change', (e) => setV('shadows', e.target.checked));
  $('#panelToggle').addEventListener('click', () => { const c = panel.classList.toggle('closed'); $('#panelToggle').setAttribute('aria-expanded', String(!c)); });
}
function syncPanel() {
  panel.querySelectorAll('[data-shape]').forEach((b) => b.classList.toggle('on', b.dataset.shape === state.shape));
  panel.querySelectorAll('[data-style]').forEach((b) => b.classList.toggle('on', b.dataset.style === state.style));
  panel.querySelectorAll('.row[data-key]').forEach((row) => {
    const k = row.dataset.key, r = [...WALL_SLIDERS, ...LOOK_SLIDERS, ...LIGHT_SLIDERS].find((x) => x.key === k);
    $('input', row).value = getV(k); $('output', row).textContent = r.fmt(getV(k));
  });
  $('#seed').value = state.seed; $('#s-stone').value = state.stone; $('#s-pal').value = state.palette; $('#s-mortar').value = state.mortar; $('#wire').checked = state.wire; $('#shadows').checked = state.shadows;
}

// ── the stats box ─────────────────────────────────────────────────────────────────────────────────────────────────────
let frames = 0, fpsT = performance.now(), fps = 0;
function wallTris() { return wall.tris.stone + wall.tris.mortar; }
function updateStats() {
  if (!wall) return;
  const I = renderer.info.render, ex = extras.children.reduce((n, m) => n + (Array.isArray(m.material) ? m.material.length : 1), 0);
  $('#stats').innerHTML = `<div class="t">Stone Lab</div>
    ${SHAPES[state.shape].label} · ${STYLES[state.style].label} · seed ${state.seed}<br>
    stones <b>${num(wall.stones)}</b> · triangles <b>${num(wallTris())}</b><br>
    &nbsp; ${num(wall.tris.stone)} stone (<b>${(wall.tris.stone / wall.stones).toFixed(1)}</b> a stone) + ${num(wall.tris.mortar)} mortar<br>
    draw calls <b>2</b> for the wall${ex ? ` (+${ex} for ${wall.building ? 'the building' : wall.pipe ? 'the stovepipe' : 'the door and bars'})` : ''} · <b>${I.calls}</b> in the frame<br>
    built in <b>${wall.ms.toFixed(1)}</b> ms · fps <b>${fps}</b>`;
}
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; }
  const sheet = window.innerWidth <= 760 && !panel.classList.contains('closed');
  if (sheet) camera.setViewOffset(w, h, 0, h * 0.22, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
// the camera never goes inside the stonework (zooming toward a target in the middle of a building would take it
// through the roof into the hollow inside): if it is within 15 cm of being inside a block of wall, it is moved back out
// along its line to the target
const _cv = new THREE.Vector3();
function insideWall(p) {
  if (!wall || !wall.solid) return false;
  if (wall.building) { const B = wall.building; if (p.x > B.x0 - 0.15 && p.x < B.x1 + 0.15 && p.z > B.z0 - 0.15 && p.z < B.z1 + 0.15 && p.y < B.y + 3.8) return true; }
  for (const S of wall.solid) {
    if (p.y < S.y0 - 0.15 || p.y > Math.max(S.y1, wall.top) + 0.15) continue;
    const t = Math.min(1, Math.max(0, (p.y - S.y0) / (S.y1 - S.y0))), L = S.loop0.map((a, i) => [a[0] + (S.loop1[i][0] - a[0]) * t, a[1] + (S.loop1[i][1] - a[1]) * t]);
    let inside = false, dmin = Infinity;
    for (let i = 0, j = L.length - 1; i < L.length; j = i++) {
      const a = L[i], b = L[j];
      if ((a[1] > p.z) !== (b[1] > p.z) && p.x < (b[0] - a[0]) * (p.z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      const ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez || 1, u = Math.max(0, Math.min(1, ((p.x - a[0]) * ex + (p.z - a[1]) * ez) / l2));
      dmin = Math.min(dmin, Math.hypot(p.x - a[0] - ex * u, p.z - a[1] - ez * u));
    }
    if (inside || dmin < 0.15) return true;
  }
  return false;
}
function keepOutside() {
  if (!insideWall(camera.position)) return;
  _cv.subVectors(camera.position, controls.target).normalize();
  for (let i = 0; i < 80 && insideWall(camera.position); i++) camera.position.addScaledVector(_cv, 0.05);
}
function loop() {
  requestAnimationFrame(loop);
  resize(); controls.update(); keepOutside();
  renderer.render(scene, camera);
  frames++; const t = performance.now();
  if (t - fpsT > 500) { fps = Math.round(frames * 1000 / (t - fpsT)); frames = 0; fpsT = t; updateStats(); }
}

(async () => {
  try {
    buildPanel();
    const t0 = performance.now();
    T = await makeTextures({});
    RT = makeRubbleTexture();
    stats.texMs = performance.now() - t0;
    U.uNoise.value = T.noise;
    // the stone lab's weathering starts: a little moss, darker rounded edges, the sky light kept out of the joints
    // weathering that reads from a normal distance, worked out in wall space (it runs across stones and joints alike):
    // moss a dull olive, in big patches low down (the bottom 30 cm stays damp), on the shady side, and on what faces up
    // (sills, the shoulder); rain streaks running 0.4 to 1.2 m down from the coping and the sills; mud splashed up, the
    // bottom of the wall about 30% darker and browner, fading out by half a metre; a thin dark edge round each stone
    U.uMossAmt.value = state.moss; U.uMossUp.value = 0.55; U.uMossShade.value = 0.5; U.uMossLow.value = 0.9; U.uMossHeight.value = 0.35; U.uMossTuck.value = 0.2; U.uMossBreak.value = 0.8;
    U.uMossColor.value.set('#5d6236'); U.uMossSoft.value = 0.07;
    U.uGrimeAmt.value = state.grime; U.uStreakLen.value = 0.7; U.uStreakScale.value = 1.15; U.uSplashH.value = 0.45; U.uCornerDirt.value = 0.3; U.uDirtBand.value = 0.6;
    U.uEdgeDark.value = 0.25; U.uEdgeDarkW.value = 0.02; U.uBevel.value = 0.4; U.uAOAmt.value = 1.0;
    // the sky's light on the stone kept mostly grey: a blue fill turned the shady sides navy
    U.uSkyGrey.value = 0.75;
    mats.stone = stoneEdges(weather(new THREE.MeshStandardMaterial({ map: RT.map, normalMap: RT.normalMap, roughness: 0.93 }), { tint: true, ao: true }));
    // the walls cast their shadows from the faces that face the sun (the default is the faces turned away): where a wall
    // meets the ground, or another wall in an inside corner, the two surfaces touch, and a shadow drawn from the far face
    // lets a thin line of light leak along the join
    mats.stone.shadowSide = THREE.FrontSide;
    useLook(state.stone);
    mats.wood = new THREE.MeshStandardMaterial({ color: 0xa88a6a, roughness: 0.9, side: THREE.DoubleSide });   // the plain building
    mats.door = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.9 });                            // the jail door's planks
    mats.roof = new THREE.MeshStandardMaterial({ color: 0x4d4844, roughness: 0.92, side: THREE.DoubleSide });
    mats.iron = new THREE.MeshStandardMaterial({ color: 0x2e2a27, roughness: 0.55, metalness: 0.6 });
    const G = groundGeo = new THREE.PlaneGeometry(60, 60, 120, 120); G.rotateX(-Math.PI / 2);
    G.setAttribute('aAO', new THREE.BufferAttribute(new Float32Array(G.attributes.position.count).fill(1), 1));
    G.setAttribute('aTintPaint', new THREE.BufferAttribute(new Float32Array(G.attributes.position.count * 4), 4));
    T.ground.repeat.set(15, 15);
    mats.ground = weather(new THREE.MeshStandardMaterial({ map: T.ground, roughness: 0.97 }), { ground: true, tint: true, ao: true });
    ground = new THREE.Mesh(G, mats.ground); ground.receiveShadow = true; scene.add(ground);
    rebuild(); syncPanel(); resize(); applyView();
    renderer.compile(scene, camera);
    $('#loading').classList.add('gone');
    loop();
    setTimeout(() => { SL.ready = true; }, 300);
  } catch (e) { console.error(e); if (window.oops) window.oops(e); }
})();

// for the test rigs (and the curious): drive the lab from the console
window.SL = {
  ready: false, state, U,
  set(k, v) { setV(k, v); syncPanel(); },
  // build with several options at once, and stand the camera at that shape's view
  build(o = {}) { clearTimeout(rebuildTimer); if (o.stone && o.stone !== state.stone) useLook(o.stone); Object.assign(state, o); rebuild(); applyView(); syncPanel(); return this.info; },
  cam(pos, tgt) { camera.position.set(...pos); controls.target.set(...tgt); controls.update(); keepOutside(); },
  get recipe() { return stoneRecipe(state); },
  get info() { return wall && { recipe: stoneRecipe(state), shape: state.shape, style: state.style, seed: state.seed, stones: wall.stones, tris: wall.tris, trisPerStone: wall.tris.stone / wall.stones, ms: wall.ms, texMs: stats.texMs, calls: renderer.info.render.calls }; },
  get renderer() { return renderer; },
};
