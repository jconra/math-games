// THE WINDMILL JOB: the miller on the mill hill west of the stable, his mill, and the tower the rider builds him there.
// Meeting him and pressing E (or tapping the prompt) opens the windmill lab's builder right there on the hill (the
// build-site frame: src/buildsite.js; the builder: labs/windmill/builder.js): the lumber panel, the board in hand and its
// arrows, the twins, his questions (the levels place 'building', up to level 7: src/buildasker.js levelAsker), the wind
// test. What is built is kept per rider (rider.builds.windmill: the tower, the lumber left, the boards earned) and
// stands on the hill while the builder is put away, drawn in a few draw calls.
//
// The mill: the miller's mill house (models/town/mill.glb, real size, one mesh) stands on the west side of the hill's
// top, its porch looking at the tower. While the builder is up and the camera walks round the far side, the mill fades
// out of the way (as the lab's own mill house hides) and back.
//
// The flour (src/mill.js keeps the books): a wind test pays sacks of flour for the feet that stood higher than any tower
// the miller has paid for before (and five for the sails the first time she reaches 16 ft), and a tower whose last
// test left 16 ft or more standing carries the sails, turning in the wind, and grinds a sack every minute or so of play
// (quicker the taller she stands). The sacks (made in code: the loot's sack shape, cream cloth printed FLOUR) stack up
// on the mill's porch; walking past the porch puts them in the saddlebags, and the townsfolk buy them at the general
// store's counter, as word problems like the eggs (src/math/goods.js: flour).
//
// Done for the checklist: a tower that stood through the wind 18 ft high (completion.js setWindmill), and the "Windmill
// tower" belt buckle counts the best height stood, in feet (save.js JOBS 'tower': 4, 10, 16, 18).
//
//   const J = makeWindmillJob({ W, folk, rider, sites, player, hud, refresh, on, speak, audio })
//     sites: the game's build sites (makeBuildSites); player(): the player (P: walking past the porch picks the flour
//     up); hud: the game's HUD (toasts, buckles); refresh(): the purse and the
//     saddlebags line again; on: the job is on for this rider (save.js jobOn: off, the miller has no prompt and no
//     hello, and what was built still stands); speak(text): the miller's questions read out (main.js: for a rider who
//     can't read yet, skill.js readAloud); audio: the game's sound (src/audio/audio.js), lent to the builder for its
//     saws, hammers and wind, or null
//   J.update(dt)        each frame while riding (the miller standing by, the sails, the grinding, the porch)
//   J.site, J.miller (his person), J.builder (the open builder, or null: its .handle is the lab's WM handle), J.on
//   J.where()           where the job is (the miller), for the jobs board and the trail
//   J.helloKey()        which of the miller's hellos fits now (src/jobfolkplan.js: start, building, sails, done)
//   J.state(), J.dev: { flour(n) (sacks onto the porch), stood(h) (paid as if a test left h ft standing), millAt,
//     millLocal (the mill's own frame) }, J.dispose()
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HILL } from '../world/objects/landforms.js';
import { makePerson } from './actors/folk.js';
import { saveRider, countJob, jobCount } from './save.js';
import { shownOnce } from './showme.js';
import { setWindmill } from './completion.js';
import { homestead, GOODS } from './math/goods.js';
import { testPay, grind, sailsUp, stackSpots, payLine, feetOf, FLOUR, DONE_FT } from './mill.js';
import { levelAsker, mergeStatic, mowSite } from './buildsite.js';
import { flagAsker } from './ui/flag.js';
import { mountWindmill } from '../labs/windmill/builder.js';
import { makeYard } from '../labs/windmill/scene.js';
import { makeTowerView } from '../labs/windmill/tower3d.js';
import { towerHeight } from '../labs/windmill/tower.js';
import * as millSound from '../labs/windmill/sound.js';

export const MILL = {
  x: HILL.x, z: HILL.z,               // the tower's middle: the middle of the mill hill's flat top
  miller: { x: 3.4, z: 1.6, face: Math.PI / 2 },   // where the miller waits (m from the tower's middle; facing east,
                                      // toward the stable and the town, where riders come up from)
  look: { outfit: 'casual_m', palette: ['#e6dcc6', '#6b5843', '#3b2a1e', '#d8ccb2'], skin: 3, hair: 8, hat: true },   // (the lab's miller: dusted with flour)
  saveAfter: 1.5,                     // s after the last change before the rider is saved (and always on closing)
  // the mill house: its middle (m from the tower's middle: north-west, on the hill's top, clear of the lumber pile and
  // the stones), turned so its porch (the model's +Z) looks at the tower; its ground the lowest under its corners, sunk
  // a little (its stone footing takes up the slope)
  // (scale: the model as made was a little small for a person (its door reached a rider's shoulder): drawn 1.5 times
  // its size, set back from the tower to keep the same room in front of its porch)
  house: { x: -7.2, z: -5.2, half: [3.7, 2.9], sink: 0.09, mow: 6.0, block: 0.25, scale: 1.5 },
  pickup: { x: 0.45, z: 4.0 },          // in the mill's own frame: in front of the porch, where the sacks are picked up
  clear: 3.6,                          // m: the mill fades out while it stands this near the line from the builder's
                                       // camera to the tower (or the camera is inside it), and back when it doesn't
  fade: 3,                             // how quickly it fades (a whole fade in a third of a second)
  sailsFace: Math.PI / 2,              // the sails look east, toward the town
  wind: 0.25,                          // how hard the valley's breeze turns them (the lab's wind level: 0 still, 1 a gust)
  saveEvery: 30,                       // s between saves while flour is being ground
};
const GAME = new URL('../', import.meta.url).href;
const loader = new GLTFLoader();
const loads = {};
const loadMill = (lo) => { const url = `${GAME}models/town/${lo ? 'lo/' : ''}mill.glb`; return loads[url] || (loads[url] = loader.loadAsync(url).then((g) => g.scene)); };

// ── THE FLOUR SACK (made in code once, shared): the loot's burlap sack (src/missions/loot.js lootParts), a little
// plumper, in cream cotton printed FLOUR in dark ink round the front, a blue band near its tied top ──────────────────
let SACK = null;
function sackParts() {
  if (SACK) return SACK;
  const prof = [[0, 0], [0.19, 0.01], [0.26, 0.08], [0.28, 0.22], [0.26, 0.36], [0.18, 0.46], [0.07, 0.52], [0.045, 0.56], [0.075, 0.61], [0.05, 0.64], [0, 0.65]]
    .map(([r, y]) => new THREE.Vector2(r * 0.82, y * 0.85));   // (0.46 m across, 0.55 m tall: two rows fit the porch)
  const geometry = new THREE.LatheGeometry(prof, 14); geometry.scale(1, 1, 0.78); geometry.computeVertexNormals();
  // the cloth: u goes round the sack (0 at +Z, 0.5 at -Z), v up its profile point by point (the belly is v 0.2 .. 0.4)
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#e2d6b8'; c.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${120 + (i % 7) * 10},${100 + (i % 5) * 9},70,${0.05 + (i % 3) * 0.02})`; c.fillRect((i * 97) % 512, (i * 61) % 256, 2, 1); }
  c.fillStyle = '#4b6a8f'; c.fillRect(0, 256 * (1 - 0.62), 512, 9); c.fillRect(0, 256 * (1 - 0.62) + 14, 512, 4);
  c.fillStyle = '#3a2a1c'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = 'bold 44px Georgia, serif'; c.fillText('FLOUR', 256, 256 * (1 - 0.31));
  c.font = '600 17px Georgia, serif'; c.fillText('MILL HILL', 256, 256 * (1 - 0.2));
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  SACK = { geometry, material: new THREE.MeshLambertMaterial({ map, color: 0xe6dfcf }) };
  return SACK;
}

export function makeWindmillJob({ W, folk, rider, sites, player = () => null, hud = null, refresh = () => {}, on = true, speak = null, audio = null }) {
  const J = { builder: null, on: !!on };
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  const site = J.site = sites.add({
    id: 'windmill', x: MILL.x, z: MILL.z, prompt: 'Help the miller build his tower',
    meet: () => { if (!J.on || !miller || J.builder) return null; const p = miller.root.position; return { x: p.x, z: p.z }; },
    css: ['labs/windmill/windmill.css?v=26'],
    mow: { r: 5.5, fade: 3 },   // (the stones, the pile and the tower's foot out of the tall meadow)
    mount, closed,
  });
  const { group, origin } = site;
  const builds = () => { if (!rider.builds || typeof rider.builds !== 'object') rider.builds = {}; return rider.builds; };
  // the rider's windmill record (made when missing); saved(): it, once a tower has been built
  const rec = () => { const b = builds(); if (!b.windmill || typeof b.windmill !== 'object') b.windmill = {}; return b.windmill; };
  const saved = () => { const b = builds().windmill; return b && typeof b === 'object' && b.tower ? b : null; };

  // ── what stands on the hill: the footing stones, the lumber pile left on its sawhorses, the tower as built ────────
  const yard = makeYard(group, { ground: site.groundY });
  // (drawn by the lab's own drawing, then merged: one mesh for each material, so a tall tower is a few draw calls; the
  // sails' hub merged on its own, so it can turn)
  const shown = makeTowerView(group);
  const head = shown.group.children.find((o) => o.userData && o.userData.hub) || null, hub = head && head.userData.hub;
  let merged = null, hubMerged = null, sails = false;
  function unmerge() {
    if (hubMerged) { hubMerged.undo(); hubMerged = null; }
    if (merged) { merged.undo(); merged = null; }
  }
  function showTower() {
    const b = saved();
    unmerge();
    if (b) yard.setStones(b.tower.W, b.tower.D ?? b.tower.W);
    yard.setPile(b && b.lumber && Number.isFinite(b.lumber.full) ? b.lumber.full : 28);
    shown.rebuild(b ? b.tower : { W: 6, D: 6, boards: [] });
    shown.nails.visible = true; shown.group.visible = true;
    sails = !!b && sailsUp(b, towerHeight(b.tower));
    shown.showHead(sails, sails ? b.tower : null, MILL.sailsFace);
    if (hub) hub.visible = false;
    merged = mergeStatic([shown.group, ...yard.stones, yard.pile], group);
    if (hub && sails) { hub.visible = true; hubMerged = mergeStatic([hub], hub); }
  }
  showTower();

  // ── the mill house ──────────────────────────────────────────────────────────────────────────────────────────────
  const H = MILL.house, rot = Math.atan2(-H.x, -H.z), hc = Math.cos(rot), hs = Math.sin(rot);
  // the mill's own frame -> the world (metres), and back
  const millAt = (lx, lz) => ({ x: MILL.x + H.x + hc * lx + hs * lz, z: MILL.z + H.z - hs * lx + hc * lz });
  const millLocal = (x, z) => { const dx = x - MILL.x - H.x, dz = z - MILL.z - H.z; return { x: hc * dx - hs * dz, z: hs * dx + hc * dz }; };
  let gy = Infinity;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) { const p = millAt(sx * H.half[0], sz * H.half[1]); gy = Math.min(gy, W.heightAt(p.x, p.z)); }
  const house = new THREE.Group(); house.name = 'mill-house';
  house.position.set(MILL.x + H.x, gy - H.sink, MILL.z + H.z); house.rotation.y = rot;
  house.visible = false;   // (until the model is in: then it fades in if it is in view, so it never pops)
  W.scene.add(house);
  let houseMesh = null, houseMats = [], fadeK = 0, fadeTo = 1;
  loadMill(W.tier !== 'gaming').then((scn) => {
    if (disposed) return;
    const m = scn.clone(); m.name = 'mill-model';
    m.scale.setScalar(H.scale || 1);
    m.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = shadows;
      o.material = o.material.clone(); houseMats.push(o.material);   // (its own, to fade without touching the loaded one)
      if (o.material.map) o.material.map.anisotropy = 4;
    });
    house.add(m); houseMesh = m;
    fadeK = 0; setFade(0); house.visible = true;
  }).catch((e) => console.warn('windmill: the mill could not load', e));
  // the mill's ground mown (no tall meadow through its porch), and walkers kept out of it
  const unmow = mowSite(W, MILL.x + H.x, MILL.z + H.z, { r: H.mow, fade: 2 });
  const offBlock = W.addBlocker ? W.addBlocker((x, z) => { const l = millLocal(x, z); return Math.abs(l.x) < H.half[0] + H.block && Math.abs(l.z) < H.half[1] + H.block; }) : () => {};
  // a fade: k 0 (gone) .. 1 (all there); the sacks on the porch fade with it
  function setFade(k) {
    const op = Math.max(0, Math.min(1, k)), see = op < 0.999;
    for (const m of [...houseMats, sackMat]) { if (!m) continue; m.transparent = see; m.opacity = op; m.depthWrite = !see || op > 0.5; }
    house.visible = op > 0.004;
  }

  // ── the flour on the porch ──────────────────────────────────────────────────────────────────────────────────────
  const S = sackParts(), sackMat = S.material.clone();
  const sacks = new THREE.InstancedMesh(S.geometry, sackMat, FLOUR.porch);
  sacks.castShadow = sacks.receiveShadow = shadows; sacks.name = 'mill-flour'; sacks.count = 0;
  house.add(sacks);
  // (each spot's sack grows into place one after another as the miller pays or the mill grinds, and shrinks away as
  // it is picked up: nothing pops on the porch. grow[i]: 0 gone .. 1 there; shownSacks: how many are wanted there now)
  const grow = new Float32Array(FLOUR.porch), spots = stackSpots(FLOUR.porch);
  let shownSacks = -1, sackAnim = false;
  const M4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), p4 = new THREE.Vector3(), s4 = new THREE.Vector3();
  function stackSacks(now = false) {
    const b = saved() || rec(), n = Math.min(FLOUR.porch, Math.floor((b.porch || 0) + 1e-6));
    if (n === shownSacks && !now) return;
    shownSacks = n;
    if (now) for (let i = 0; i < FLOUR.porch; i++) grow[i] = i < n ? 1 : 0;
    sackAnim = true; animSacks(0);
  }
  function animSacks(dt) {
    if (!sackAnim) return;
    let moving = false, last = -1;
    for (let i = 0; i < FLOUR.porch; i++) {
      const want = i < shownSacks ? 1 : 0;
      if (grow[i] !== want) {
        if (want && i > 0 && grow[i - 1] < 0.5) moving = true;   // (the one before it first)
        else { grow[i] = want ? Math.min(1, grow[i] + dt * 4) : Math.max(0, grow[i] - dt * 5); moving = true; }
      }
      if (grow[i] > 0) last = i;
    }
    for (let i = 0; i <= last; i++) {
      const sp = spots[i], k = grow[i], ease = k * k * (3 - 2 * k);
      // (the printed front, at u = 0.5, is the sack's -Z: turned round to face out over the porch's edge; growing, it
      // settles down onto the porch from a hand's breadth up)
      e4.set(0, Math.PI + sp.ry, 0); q4.setFromEuler(e4); p4.set(sp.x, sp.y + (1 - ease) * 0.25, sp.z); s4.setScalar(Math.max(0.001, ease));
      M4.compose(p4, q4, s4); sacks.setMatrixAt(i, M4);
    }
    sacks.count = last + 1; sacks.instanceMatrix.needsUpdate = true;
    if (sacks.count) sacks.computeBoundingSphere();
    sackAnim = moving;
  }
  stackSacks(true);

  // ── the miller (his name tag and hello: the job folk, src/jobfolk.js, while the job is on) ─────────────────────
  let miller = null;
  try {
    miller = makePerson(folk, { ...MILL.look, shadows: true });
    const m = MILL.miller, x = MILL.x + m.x, z = MILL.z + m.z;
    miller.root.position.set(x, W.heightAt(x, z), z); miller.root.rotation.y = m.face;
    miller.play('Idle', { fade: 0 });
    W.scene.add(miller.root);
  } catch (e) { console.warn('windmill: the miller could not be made', e); }
  J.miller = miller;

  // ── paying for what stood (the builder's wind test) ───────────────────────────────────────────────────────────────
  const after = [];   // what to say once the builder is put away (the HUD is away meanwhile): [fn]
  function pay(h) {
    const b = rec(), before = +b.paid || 0;
    const r = testPay(h, before);
    b.paid = r.paid; b.stood = { height: +h.toFixed(3), at: Date.now() };
    if (r.sacks) b.porch = (+b.porch || 0) + r.sacks;
    // the checklist (an 18 ft tower standing is the windmill done) and the buckle (the best height stood, in feet)
    setWindmill(rider, feetOf(h));
    const more = feetOf(h) - jobCount(rider, 'tower');
    if (more > 0) { const c = countJob(rider, 'tower', more); if (c.buckle && hud) after.push(() => hud.buckle(c.buckle, { delay: 900 })); }
    if (r.sacks) after.push(() => hud && hud.toast(`${r.sacks} sack${r.sacks === 1 ? '' : 's'} of flour on the miller's porch: walk past to pick them up`, 'gold'));
    saveRider(rider);
    stackSacks();
    return { sacks: r.sacks, line: payLine(r.sacks, h, before) };
  }

  // ── the builder, mounted at the site ─────────────────────────────────────────────────────────────────────────
  let saveT = 0;
  function mount(ctx) {
    millSound.setBed(false);   // (the lab's hilltop bed of birds and far-off work: the valley has its own sounds)
    if (audio && audio.need) audio.need('windmill', true);   // (the game's sound kept awake while the builder is up)
    unmerge();
    shown.group.visible = false;
    const b = saved(), eye = ctx.camera.position;
    let headUp = false;
    const B = J.builder = mountWindmill({
      root: ctx.root, scene: group, origin, camera: ctx.camera, fit: ctx.fit, canvasRect: ctx.canvasRect,
      // (the yard's own frame step, and the mill fading out of the way of the camera: eye and look in the site's frame)
      yard: { ...yard, update: (dt, look, eyeAt) => { yard.update(dt); millInWay(eyeAt, look); } },
      groundY: site.groundY, low: W.tier === 'potato',
      asker: flagAsker(levelAsker(rider, { most: 'g7' }), 'windmill'),   // (the levels' 'building' place; the windmill's builder asks up to level 7)
      // ("Confusing?" on its question card: src/ui/flag.js)
      best: { read: () => ({ height: 0, W: 0, D: 0, ...((b && b.best) || {}) }), write: () => { saveT = 0.01; } },
      start: b ? { tower: b.tower, lumber: b.lumber, bonus: b.bonus } : null,
      // (the builder's camera starts on the side the rider came from, so the glide doesn't swing round the hill)
      az: Math.atan2(eye.x - origin.x, eye.z - origin.z),
      escape: () => ctx.leave('esc'),
      // (a board nailed or taken down: the miller takes the sails down while she is built on, below)
      changed: (what) => { saveT = MILL.saveAfter; if (what === 'tower' && headUp) { headUp = false; B.towerView.showHead(false); } },
      pay, speak,
      // (Show me plays by itself the first time this rider opens the builder: src/showme.js)
      showMe: shownOnce(builds, 'windmill', () => saveRider(rider)),
      // (the saw, the hammer and the wind through the game's own sound and volume: no second sound of the lab's own)
      sound: audio && audio.ready ? { ready: (fn) => audio.ready(fn) } : null,
      // (the miller standing on the hill is the one in the builder: he walks round the tower from where he is)
      miller: miller ? (scene) => { const w = miller.root.getWorldPosition(new THREE.Vector3()); scene.add(miller.root); miller.root.position.copy(w).sub(origin); return miller; } : null,
      dropMiller: (m) => { const w = m.root.getWorldPosition(new THREE.Vector3()); W.scene.add(m.root); m.root.position.copy(w); },
    });
    // (the sails stay on her as the builder opens, turning, till the tower is built on: nothing on the hill changes)
    if (sails && b) { B.towerView.showHead(true, b.tower, MILL.sailsFace); headUp = true; }
    // (put away: a result card's own button first, so what is saved is what stood; then saved, then off the page)
    const dispose = B.dispose;
    B.dispose = () => { try { B.settle(); } catch (e) { console.error('windmill: settling the builder', e); } keep(); dispose(); };
    return B;
  }
  // the tower, the lumber and the boards earned, as they are now, into the rider's save (the flour books stay as they
  // are). Never in the middle of the wind test or with its card up: then on the way out (B.settle first).
  function keep() {
    if (!J.builder) return;
    const b = rec();
    Object.assign(b, J.builder.snapshot(), { at: Date.now() });
    saveRider(rider);
    saveT = 0;
  }
  function closed() {
    J.builder = null; saveT = 0;
    if (audio && audio.need) audio.need('windmill', false);
    fadeTo = 1;
    showTower(); stackSacks();
    for (const f of after.splice(0)) { try { f(); } catch (e) { console.error(e); } }
    refresh();
  }
  // the mill fades out while it stands between the builder's camera and the tower, or round the camera itself
  function millInWay(eye, look) {
    if (!eye || !houseMesh) return;
    const mx = H.x, mz = H.z, ex = eye.x, ez = eye.z, lx = look ? look.x : 0, lz = look ? look.z : 0;
    const dx = lx - ex, dz = lz - ez, L2 = dx * dx + dz * dz || 1;
    const u = ((mx - ex) * dx + (mz - ez) * dz) / L2, t = Math.max(0, Math.min(1, u));
    const d = Math.hypot(ex + dx * t - mx, ez + dz * t - mz);
    const inWay = (u > -0.1 && u < 0.92 && d < MILL.clear) || Math.hypot(ex - mx, ez - mz) < MILL.clear + 1;
    fadeTo = inWay ? 0 : 1;
  }

  // ── each frame ─────────────────────────────────────────────────────────────────────────────────────────────────
  let grindSave = 0, pickWarned = false, disposed = false;
  const at = new THREE.Vector3();
  J.update = (dt) => {
    if (saveT > 0 && (saveT -= dt) <= 0) { if (J.builder && J.builder.phase !== 'build') saveT = 0.5; else keep(); }
    if (miller && !J.builder && miller.root.parent === W.scene) miller.update(dt);
    // the mill fading in (when its model arrives, or after standing out of the builder's view) and out
    animSacks(dt);
    if (houseMesh) {
      if (!J.builder) fadeTo = 1;
      const was = fadeK;
      fadeK += Math.sign(fadeTo - fadeK) * Math.min(Math.abs(fadeTo - fadeK), dt * MILL.fade);
      if (fadeK !== was) setFade(fadeK);
    }
    // the sails turn (merged with the tower, the hub on its own); with the sails up, the mill grinds
    const b = saved();
    if (sails && hub && !J.builder) hub.rotation.z -= dt * (0.6 + MILL.wind * 3);
    if (b && sails) {
      const n = grind(b, dt, towerHeight(b.tower));
      if (n) stackSacks();
      if ((grindSave += dt) > MILL.saveEvery) { grindSave = 0; saveRider(rider); }
    }
    // walking past the porch: the sacks into the saddlebags
    pickUp(player());
  };
  function pickUp(P) {
    const b = saved() || rec(), n = Math.floor((b.porch || 0) + 1e-6);
    if (!P || J.builder || n <= 0 || !P.position) return;
    const pk = millAt(MILL.pickup.x, MILL.pickup.z);
    if (Math.hypot(P.position.x - pk.x, P.position.z - pk.z) > FLOUR.reach) { pickWarned = false; return; }
    const g = homestead(rider).goods, room = GOODS.flour.bag - (g.flour || 0), take = Math.min(n, room);
    if (take <= 0) { if (!pickWarned && hud) hud.toast('Your saddlebags are full of flour: sell some at the general store', 'warn'); pickWarned = true; return; }
    g.flour = (g.flour || 0) + take; b.porch = Math.max(0, (b.porch || 0) - take);
    saveRider(rider); stackSacks(); refresh();
    if (hud) hud.toast(`+${take} sack${take === 1 ? '' : 's'} of flour in your saddlebags${take < n ? ' (they\'re full)' : ': sell them at the general store'}`, 'good');
  }

  // which of the miller's hellos fits now (src/jobfolkplan.js: his `hellos`): no tower yet; a tower short of the sails;
  // the sails up; an 18 ft tower stood
  J.helloKey = () => {
    const b = saved(), r = rec();
    if ((+r.paid || 0) >= DONE_FT) return 'done';
    if (sails) return 'sails';
    return b && b.tower.boards.length ? 'building' : 'start';
  };
  // where the job is, for the jobs board and the trail: the miller
  J.where = () => { const p = miller ? miller.root.getWorldPosition(at) : origin; return { x: p.x, z: p.z }; };
  J.state = () => {
    const b = saved(), r = rec();
    return { draws: merged ? merged.draws + (hubMerged ? hubMerged.draws : 0) : null, merged: merged ? merged.count : 0, open: !!J.builder, on: J.on,
      saved: b ? { boards: b.tower.boards.length, height: b.height, lumber: b.lumber } : null,
      flour: { paid: +r.paid || 0, stood: r.stood || null, porch: +(+r.porch || 0).toFixed(3), shown: Math.max(0, shownSacks), bags: homestead(rider).goods.flour || 0 },
      sails, mill: { loaded: !!houseMesh, fade: +fadeK.toFixed(3), visible: house.visible, x: house.position.x, z: house.position.z, rot },
      pickup: millAt(MILL.pickup.x, MILL.pickup.z),
      miller: miller && { x: miller.root.position.x, z: miller.root.position.z, parent: miller.root.parent && miller.root.parent.name } };
  };
  // (for rigs: sacks on the porch now; a test stood at h feet, as if the wind had been called)
  J.dev = {
    flour(n = 6) { const b = rec(); b.porch = Math.max(0, (+b.porch || 0) + n); saveRider(rider); stackSacks(); return b.porch; },
    stood(h) { const r = pay(h); for (const f of after.splice(0)) f(); showTower(); return r; },
    millLocal, millAt,
  };
  J.dispose = () => {
    disposed = true;
    if (miller) { miller.root.parent && miller.root.parent.remove(miller.root); }
    unmerge();
    group.remove(shown.group);
    yard.dispose();
    W.scene.remove(house);
    sacks.dispose(); sackMat.dispose(); for (const m of houseMats) m.dispose();
    offBlock(); unmow();
  };
  return J;
}
