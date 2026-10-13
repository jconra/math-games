// THE PLAYER'S CABIN: the log cabin in town is the rider's home. Walk up to its door and press E (or tap the prompt): a
// short fade, and you stand just inside, in first person at eye height. Mouse: drag to look, or click once to look
// with the mouse freely (Esc lets go); WASD or the arrows step about, Shift hurries. Phone: the thumb stick on the left
// steps, a drag on the right looks. The walls and the furniture stop you. E at the door: a fade, and you stand at the
// foot of the porch steps in town, facing out. Only the cabin is drawn while you're in it (the valley waits).
//
// The cabin has fixed slots for furnishings (slots.js: a rug, lanterns, a painting, dog beds, a table and chairs, porch
// rockers, a bed, a rifle rack, a stove), cheap to costly. Look at an empty slot: a see-through look at the piece shows
// in its place, with its name, its price and what it is in a small card; E (or a tap on the prompt) buys it, and it
// grows into place. Bought pieces are saved with the rider (rider.owned.cabin) and are there every time you come home.
// At the table you open your lock boxes. The belt-buckle keepsakes (save.js KEEPSAKES) hang in their spots once earned.
// The dogs at home (homedogs.js) are on their beds inside once there are dog beds, else on the porch outside; the dog
// that follows you comes in with you. The porch rockers, once bought, stand on the town cabin's porch too.
//
//   const C = makeCabin({ W, renderer, camera, animals, rider, hud, input, audio, player, follower, onBuy, onLockbox })
//     player(): the player (P, from player.js); follower(): the dog following you (D, from dog.js) or null
//     onBuy(id): a piece was bought (the purse is redrawn); onLockbox(box, { own }): open a lock box (main.js does it)
//   C.inside, C.busy              in the cabin (draw it with C.render, step it with C.update), fading in or out
//   C.enter(), C.leave({ to })     to: { x, z, rot } somewhere else in town to come out at (the menu's "back to town")
//   C.update(dt), C.render()       each frame while inside
//   C.town(dt)                     each frame in town: the porch dogs
//   C.dogsChanged()                the rider's dogs changed (bought one, took another along)
//   C.state()                      for a rig: { inside, at, focus, owned, dogs, ... };  C.dev: { buy(id), give(id), look(x, z, yaw, pitch) }
//   C.dispose()
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeInterior } from './interior.js';
import { makeHomeDog } from './homedogs.js';
import { disposeTree } from './pieces.js';
import { SLOTS, SLOT, ownedPieces, nextPiece, buyPiece, homeDogs } from './slots.js';
import { spend, saveRider, KEEPSAKES, BUCKLES, BUCKLE_NAMES, buckleOf, jobWords, JOBS } from '../save.js';

export const FP = {
  eye: 1.65, radius: 0.26, balls: [0.62, 1.3], step: 0.42,   // eyes above the feet, the body's size, the highest step
  walk: 1.7, hurry: 3.2,                                      // m/s
  mouse: 0.0022, drag: 0.0042, touchDrag: 0.005,              // radians per pixel: free mouse look, a mouse drag, a finger
  fov: 70,                                                    // degrees up and down on a wide screen (a tall one sees ~60 across)
  reach: 3.0, aim: 0.36,                                      // how far off and how far from the middle of the view (radians) E picks
  fade: 280,                                                  // ms each way
  start: { x: 0.24, z: 0.12, yaw: 0 },                        // just inside the door, facing into the room
  door: [[0.24, 2.4, 0.66], [0.24, 1.6, 0.66]],               // where you look to use the door (high and low on it)
};
const BASE = new URL('../../', import.meta.url).href;
const CSS_HREF = new URL('./cabin.css', import.meta.url).href;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#e2ad4c"/><circle cx="12" cy="12" r="7.4" fill="none" stroke="#a8742a" stroke-width="1.6"/></svg>';

// the keepsakes a rider has earned: [{ job, tier }] (tier: the buckle they hold for that job)
export function keepsakesOf(rider) {
  const out = [];
  for (const j of JOBS) {
    const k = KEEPSAKES[j.id]; if (!k) continue;
    const b = buckleOf(rider, j.id);
    if (b.tier && BUCKLES.indexOf(b.tier) >= BUCKLES.indexOf(k.from || 'tin')) out.push({ job: j.id, tier: b.tier });
  }
  return out;
}

export function makeCabin({ W, renderer, camera, animals, rider, hud, input: I, audio = null, player = () => null, follower = () => null, onBuy = () => {}, onLockbox = () => {} }) {
  if (!document.querySelector('link[data-bm-cabin]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS_HREF; l.dataset.bmCabin = '1'; document.head.appendChild(l); }
  const ui = document.createElement('div'); ui.className = 'bmc';
  ui.innerHTML = '<div class="bmc-fade"><span></span></div><div class="bmc-dot" hidden></div><div class="bmc-card" hidden></div>';
  document.body.appendChild(ui);
  const fadeEl = ui.querySelector('.bmc-fade'), dotEl = ui.querySelector('.bmc-dot'), cardEl = ui.querySelector('.bmc-card');
  const canvas = renderer.domElement;

  let R = null, Rp = null, inside = false, busy = false, disposed = false;
  const me = { x: 0, y: 0.8, z: 0, yaw: 0, pitch: -0.05, heading: Math.PI };
  let focus = null, dogsIn = [], porchDogs = [], told = false, doorT = 0, leaving = false;
  const saved = { fov: camera.fov, near: camera.near, shadows: renderer.shadowMap.enabled };
  const C = { get inside() { return inside; }, get busy() { return busy; } };

  // ── fading ──
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function fade(on, text = '') {
    fadeEl.querySelector('span').textContent = text;
    fadeEl.classList.toggle('is-on', on);
    await wait(FP.fade + 20);
  }

  // ── the camera inside ──
  function fitFov() {
    const a = innerWidth / innerHeight;
    const fov = a >= 1 ? FP.fov : Math.min(95, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30)) / a)));
    if (camera.fov !== fov || camera.near !== 0.05 || camera.aspect !== a) { camera.fov = fov; camera.near = 0.05; camera.aspect = a; camera.updateProjectionMatrix(); }
  }
  function placeCamera() { camera.position.set(me.x, me.y + FP.eye, me.z); camera.rotation.set(me.pitch, me.yaw, 0, 'YXZ'); camera.updateMatrixWorld(); }

  // ── free mouse look (a click on the view while inside; Esc lets go) ──
  // (not under test automation: headless Chrome runs out of memory when a locked pointer is then dragged by a script)
  const onClick = () => { if (inside && !busy && !I.touch && !navigator.webdriver && document.pointerLockElement !== canvas) { try { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* (not allowed here) */ } } };
  const onMouse = (e) => { if (!inside || document.pointerLockElement !== canvas || !I.enabled) return; me.yaw -= e.movementX * FP.mouse; me.pitch = THREE.MathUtils.clamp(me.pitch - e.movementY * FP.mouse, -1.4, 1.4); };
  let listening = false;
  function listen(on) {
    if (on === listening) return; listening = on;
    if (on) { canvas.addEventListener('click', onClick); addEventListener('mousemove', onMouse); }
    else { canvas.removeEventListener('click', onClick); removeEventListener('mousemove', onMouse); if (document.pointerLockElement === canvas) document.exitPointerLock(); }
  }

  // ── the dogs ──
  const owned = () => ownedPieces(rider);
  function clearDogs(list) { for (const d of list) d.dispose(); list.length = 0; }
  function dogsInside() {
    clearDogs(dogsIn);
    const all = homeDogs(rider), beds = owned().includes('dogbeds'), home = all.filter((d) => !d.following);
    if (beds) {
      const spots = R.bedSpots(home.length);
      home.forEach((d, i) => { const s = spots[i]; const h = makeHomeDog({ animals, kind: d.kind, name: d.name, scene: R.scene, spot: { x: s.x, y: s.y, z: s.z, rot: s.rot + Math.PI * 0.5 }, mode: 'bed', floor: (x, z) => R.floorUnder(x, z, 1.6), push: (b) => R.pushOut(b, { radius: 0.24, balls: [0.32] }), lit: R.lit, others: () => dogsIn }); dogsIn.push(h); h.ready.then(() => setTimeout(() => h.greet(i, home.length), 400 + i * 350)); });
    }
    const f = all.find((d) => d.following);
    if (f && follower()) dogsIn.push(makeHomeDog({ animals, kind: f.kind, name: f.name, scene: R.scene, spot: { x: me.x + 0.5, y: me.y, z: me.z + 0.3, rot: Math.PI }, mode: 'follow', floor: (x, z) => R.floorUnder(x, z, 1.6), push: (b) => R.pushOut(b, { radius: 0.22, balls: [0.32] }), lit: R.lit, others: () => dogsIn }));
  }

  // ── the town cabin's porch: where the porch dogs lie and the rockers stand (found on the town's own cabin model) ──
  let porch = null;
  const caster = new THREE.Raycaster();
  function findPorch() {
    const pl = W.places.cabin; if (!pl) return null;
    const o = W.V && W.V.TOWN && W.V.TOWN.village && W.V.TOWN.village.objs && W.V.TOWN.village.objs.get('cabin');
    let model = null; if (o && o.group) o.group.traverse((m) => { if (m.isMesh && !(m.material && m.material.visible === false) && m.geometry && m.geometry.type !== 'BoxGeometry') model = model || o.group; });
    if (!model) return null;   // (its model is still loading)
    model.updateMatrixWorld(true);
    const f = [Math.sin(pl.rot), Math.cos(pl.rot)], r = [Math.cos(pl.rot), -Math.sin(pl.rot)], ground = W.heightAt(pl.door.x, pl.door.z);
    // a spot on the porch: `along` m to the right of the door's line, `out` m in front of the cabin's middle
    const at = (along, out) => {
      const x = pl.x + r[0] * along + f[0] * out, z = pl.z + r[1] * along + f[1] * out;
      caster.set(new THREE.Vector3(x, ground + 2.4, z), new THREE.Vector3(0, -1, 0)); caster.far = 4;
      const hit = caster.intersectObject(model, true).find((h) => h.object.isMesh && h.object.geometry.type !== 'BoxGeometry');
      return { x, z, y: hit ? hit.point.y : ground, hit: !!hit };
    };
    // the porch floor's own height: the lowest of a row of spots along it (a crate or a barrel stands higher)
    const ys = [-2, -1, 0, 1, 2].map((k) => at(k, pl.d / 2 * 0.62)).filter((h) => h.hit).map((h) => h.y);
    return { at, rot: pl.rot, f, r, floor: ys.length ? Math.min(...ys) : null };
  }
  const PORCH = { dogs: [[1.0, 0.5], [0.2, 0.66], [1.9, 0.68]], rockers: [[-2.6, 0.62, 0.35], [2.9, 0.62, -0.35]] };   // (shares of the half-depth; along in m; a rocker's turn)
  // a spot on the porch's floor near the one asked for (not on a crate or a barrel standing there)
  function porchSpot(along, share) {
    const pl = W.places.cabin;
    for (const k of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) { const h = porch.at(along + k, pl.d / 2 * share); if (porch.floor === null || Math.abs(h.y - porch.floor) < 0.1) return h; }
    return porch.at(along, pl.d / 2 * share);
  }
  function townDogs() {
    clearDogs(porchDogs);
    if (owned().includes('dogbeds')) return;
    porch = porch || findPorch(); if (!porch) return;
    homeDogs(rider).filter((d) => !d.following).forEach((d, i) => {
      const [along, share] = PORCH.dogs[i % PORCH.dogs.length], s = porchSpot(along, share);
      porchDogs.push(makeHomeDog({ animals, kind: d.kind, name: d.name, scene: W.scene, spot: { x: s.x, y: s.y, z: s.z, rot: porch.rot + (i ? -0.4 : 0.3) }, mode: 'porch', floor: () => s.y }));
    });
  }
  let rockers = null, rockersP = null;
  function townRockers() {
    const want = owned().includes('porch');
    if (!want) { if (rockers) rockers.visible = false; return; }
    if (rockers) { rockers.visible = true; return; }
    porch = porch || findPorch(); if (!porch || rockersP) return;
    rockersP = new GLTFLoader().loadAsync(BASE + 'models/furniture/' + SLOT.porch.file + '.glb').then((g) => {
      if (disposed) { disposeTree(g.scene); return; }
      const tpl = g.scene, b = new THREE.Box3().setFromObject(tpl), size = b.getSize(new THREE.Vector3()), mid = b.getCenter(new THREE.Vector3());
      const s = SLOT.porch.fit / Math.max(size.x, size.z);
      rockers = new THREE.Group(); rockers.name = 'porch-rockers'; rockers.userData.tpl = tpl;
      for (const [along, share, turn] of PORCH.rockers) {
        const p = porchSpot(along, share), c = tpl.clone(); c.scale.setScalar(s); c.position.set(-mid.x * s, -b.min.y * s, -mid.z * s);
        const holder = new THREE.Group(); holder.add(c); holder.position.set(p.x, p.y, p.z); holder.rotation.y = porch.rot + turn;
        c.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
        rockers.add(holder);
      }
      W.scene.add(rockers);
    }).catch((e) => console.warn('cabin: no porch rockers', e));
  }
  let townTry = 0;
  C.town = (dt) => {
    if (inside) return;
    if (!porch && (townTry -= dt) < 0) { townTry = 1; porch = findPorch(); if (porch) { townDogs(); townRockers(); } }
    const P = player(), at = P ? P.position : null;
    // (far off they lie still on the porch: no need to step them)
    const pl = W.places.cabin, far = at && pl && Math.hypot(at.x - pl.x, at.z - pl.z) > 90;
    if (!far) for (const d of porchDogs) d.update(dt, at);
  };
  C.dogsChanged = () => { townDogs(); if (inside && R) dogsInside(); };

  // ── going in and coming out ──
  function sync() {
    R.furnish(owned(), { dogs: homeDogs(rider).filter((d) => !d.following).length });
    R.keepsakes(keepsakesOf(rider));
  }
  C.enter = async () => {
    if (inside || busy || disposed) return;
    busy = true;
    const P = player(); if (P) P.enabled = false;
    hud.prompt(null);
    await fade(true, R ? '' : 'Home sweet home');
    try {
      if (!R) R = await (Rp = Rp || makeInterior({ renderer, tier: W.tier, base: BASE }));
    } catch (e) { console.error('cabin: the inside could not load', e); busy = false; if (P) P.enabled = true; await fade(false); hud.toast('The cabin door is stuck. Try again in a moment.', 'warn'); Rp = null; return; }
    if (disposed) return;
    sync();
    // (when dogs will come and greet you the view starts tipped down a little, so they sit in sight in front of you)
    const greeters = owned().includes('dogbeds') && homeDogs(rider).some((d) => !d.following);
    Object.assign(me, { x: FP.start.x, z: FP.start.z, yaw: FP.start.yaw, pitch: greeters ? -0.2 : -0.05, heading: Math.PI });
    me.y = R.floorUnder(me.x, me.z, 2);
    R.setDoor(0); doorT = 0; leaving = false;
    I.takeLook(); I.pick.length = 0;
    dogsInside();
    inside = true;
    saved.fov = camera.fov; saved.near = camera.near; saved.shadows = renderer.shadowMap.enabled;
    fitFov(); placeCamera();
    if (audio) audio.hold('cabin', true);
    // (the compass and the job's card belong to the valley: they wait outside, still up to date when you come out)
    hud.touch(false); hud.el.classList.add('is-home');
    dotEl.hidden = false; listen(true);
    C.render();
    await fade(false);
    busy = false;
    if (!told) { told = true; const n = nextPiece(rider); if (n) hud.toast(n.price <= rider.gold ? `Look round: there's room for ${a(n.name)}.` : `Saving up? Next for the cabin: ${n.name.toLowerCase()}, ${n.price} gold.`, 'gold'); }
  };
  // ("a rag rug", "an iron stove"; a name that already counts itself or is plural takes none: "two lanterns", "dog beds")
  const a = (name) => (/^(a|two|an) /i.test(name) || (/[^s]s$/i.test(name) && !/ and /i.test(name)) ? name.toLowerCase() : (/^[aeiou]/i.test(name) ? 'an ' : 'a ') + name.toLowerCase());
  C.leave = async ({ to = null } = {}) => {
    if (!inside || busy) return;
    busy = true; leaving = true;
    showFocus(null); hud.prompt(null);
    await fade(true);
    finishLeave(to);
    await fade(false);
    busy = false;
  };
  function finishLeave(to) {
    inside = false; leaving = false;
    clearDogs(dogsIn); if (R) { R.ghost(null); R.setDoor(0); }
    listen(false); dotEl.hidden = true;
    camera.fov = saved.fov; camera.near = saved.near; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.shadowMap.enabled = saved.shadows;
    const P = player();
    if (P) {
      const pl = W.places.cabin, s = to || { x: pl.door.x, z: pl.door.z, rot: pl.rot };
      P.teleport(s.x, s.z, s.rot); P.enabled = true; if (P.cam && P.cam.snap) P.cam.snap();
    }
    I.takeLook(); I.pick.length = 0;
    if (audio) audio.hold('cabin', false);
    hud.touch(I.touch); hud.el.classList.remove('is-home');
  }

  // ── what you look at: the door, the table, a slot, a keepsake ──
  const fwd = new THREE.Vector3(), eye = new THREE.Vector3(), tmp = new THREE.Vector3();
  function pickFocus() {
    eye.set(me.x, me.y + FP.eye, me.z);
    fwd.set(-Math.sin(me.yaw) * Math.cos(me.pitch), Math.sin(me.pitch), -Math.cos(me.yaw) * Math.cos(me.pitch));
    let best = null, bestS = Infinity;
    const consider = (kind, id, p, reach = FP.reach) => {
      tmp.set(p[0], p[1], p[2]).sub(eye); const d = tmp.length(); if (d > reach || d < 0.05) return;
      const ang = tmp.angleTo(fwd); if (ang > FP.aim) return;
      const s = ang + d * 0.04; if (s < bestS) { bestS = s; best = { kind, id }; }
    };
    for (const p of FP.door) consider('door', 'door', p, 2.6);
    const have = owned();
    for (const s of SLOTS) for (const p of s.looks) consider(have.includes(s.id) ? 'piece' : 'slot', s.id, p, s.id === 'porch' ? 3.4 : FP.reach);
    // (the counter bell stands on the table: once there is one, looking there is the table's, for its lock boxes)
    for (const k of keepsakesOf(rider)) if (KEEP_LOOK[k.job] && !(k.job === 'orders' && have.includes('table'))) consider('keepsake', k.job, KEEP_LOOK[k.job], 3.6);
    return best;
  }
  const KEEP_LOOK = { cattle: [0.24, 3.05, 0.55], boxes: [1.75, 1.15, -2.55], sheep: [1.12, 2.3, 0.55], pigs: [2.85, 2.05, -1.9], bandits: [-2.3, 2.35, -1.75], deliveries: [-1.55, 3.0, 0.55], orders: [2.3, 1.65, -0.62] };
  // (the card and the prompt are drawn again only when what you look at changes, or the gold does)
  function showFocus(f, force = false) {
    const k = f ? f.kind + ':' + f.id : null, was = focus ? focus.kind + ':' + focus.id : null;
    focus = f;
    if (R) R.ghost(f && f.kind === 'slot' ? f.id : null);
    if (k === was && !force) return;
    if (!f) { cardEl.hidden = true; hud.prompt(null); return; }
    let card = '', prompt = null;
    if (f.kind === 'door') prompt = 'Go outside';
    else if (f.kind === 'slot') {
      const s = SLOT[f.id], short = s.price - rider.gold;
      card = `<b>${esc(s.name)}</b><span class="bmc-price">${COIN}${s.price}</span><small>${esc(s.line)}</small>`
        + (short > 0 ? `<em>${short} more gold to go</em>` : '');
      prompt = short > 0 ? null : `Buy ${a(s.name)}`;
    } else if (f.kind === 'piece') {
      if (f.id === 'table') { const n = (rider.lockboxes || []).length; prompt = n ? `Open a lock box (${n} in your saddlebags)` : null; if (!n) card = '<b>Your table</b><small>Win a lock box on the round-up, then open it here.</small>'; }
    } else if (f.kind === 'keepsake') {
      const k = KEEPSAKES[f.id], b = buckleOf(rider, f.id);
      card = `<b>${esc(k.name)}</b><small>${esc(BUCKLE_NAMES[b.tier] || '')} buckle: ${esc(jobWords(f.id, b.count))}</small>`;
    }
    cardEl.innerHTML = card; cardEl.hidden = !card;
    hud.prompt(prompt);
  }
  function act() {
    const f = focus; if (!f) return;
    if (f.kind === 'door') { C.leave(); return; }
    if (f.kind === 'slot') {
      const s = SLOT[f.id], r = buyPiece(rider, f.id, spend, saveRider);
      if (r === 'short') { hud.toast(`${s.price - rider.gold} more gold for ${a(s.name)}. Rope some cattle or crack a lock box.`, 'warn'); return; }
      if (r !== 'bought') return;
      R.ghost(null); sync();
      Promise.resolve().then(() => setTimeout(() => R && R.pop(f.id), 0));
      hud.toast(`${s.name} for the cabin! −${s.price} gold`, 'gold');
      onBuy(f.id);
      if (f.id === 'dogbeds') { dogsInside(); townDogs(); }
      if (f.id === 'porch') townRockers();
      showFocus(pickFocus(), true);
      return;
    }
    if (f.kind === 'piece' && f.id === 'table') {
      const bx = (rider.lockboxes || [])[0]; if (!bx) return;
      onLockbox({ tier: bx.tier, from: 'loot' }, { own: true, after: () => showFocus(focus, true) });
    }
  }

  // ── each frame inside ──
  // (the game stops calling update while it is paused, so a gap between frames means it was: see below)
  let wasLive = false, lastFrame = 0;
  C.update = (dt) => {
    if (!inside || !R) return;
    const t = performance.now();
    if (t - lastFrame > 250) wasLive = false;
    lastFrame = t;
    dt = Math.min(dt, 0.05);
    const live = I.enabled && !busy;
    if (live) {
      const l = I.takeLook(), k = I.touch ? FP.touchDrag : FP.drag;
      if (l.dx || l.dy) { me.yaw -= l.dx * k; me.pitch = THREE.MathUtils.clamp(me.pitch - l.dy * k, -1.4, 1.4); }
      I.pick.length = 0; I.takeZoom();
      const f = I.move.y * I.move.mag, s = I.move.x * I.move.mag, len = Math.hypot(f, s);
      if (len > 0.05) {
        const sp = (I.run ? FP.hurry : FP.walk) * dt, sy = Math.sin(me.yaw), cy = Math.cos(me.yaw), n = Math.ceil(sp * len / 0.05);
        for (let i = 0; i < n; i++) { me.x += (-sy * f + cy * s) * sp / n; me.z += (-cy * f - sy * s) * sp / n; R.pushOut(me, FP); }
        me.heading = Math.atan2(-sy * f + cy * s, -cy * f - sy * s);
      } else R.pushOut(me, FP);
      const fl = R.floorUnder(me.x, me.z, me.y + FP.step);
      me.y = fl > me.y ? THREE.MathUtils.damp(me.y, fl, 18, dt) : Math.max(fl, me.y - 4 * dt);
      // (after the menu or any pause the game took the prompt away: drawn again on the first frame back)
      showFocus(pickFocus(), gold !== rider.gold || !wasLive);
      if (I.tap('KeyE')) act();
    }
    wasLive = live;
    if (leaving) { doorT = Math.min(1, doorT + dt / 0.45); R.setDoor(doorT); }
    R.update(dt);
    const at = { x: me.x, z: me.z, heading: me.yaw + Math.PI };
    for (const d of dogsIn) d.update(dt, at);
    fitFov(); placeCamera();
    gold = rider.gold;
  };
  let gold = rider.gold;
  C.render = () => {
    if (!R) return;
    renderer.shadowMap.enabled = true;
    renderer.toneMappingExposure = 1.0;
    renderer.render(R.scene, camera);
  };

  // ── for rigs and the dev buttons ──
  C.state = () => ({ inside, busy, at: { x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(2), pitch: +me.pitch.toFixed(2) },
    focus: focus ? { ...focus } : null, owned: owned(), shown: R ? R.shown : [], keepsakes: keepsakesOf(rider).map((k) => k.job + ':' + k.tier),
    dogsIn: dogsIn.map((d) => d.state()), porchDogs: porchDogs.map((d) => d.state()), rockers: !!(rockers && rockers.visible), porch: !!porch });
  C.dev = {
    look(x, z, yaw = me.yaw, pitch = me.pitch) { Object.assign(me, { x, z, yaw, pitch }); if (R) me.y = R.floorUnder(x, z, 2); placeCamera(); },
    give(id) { const o = rider.owned || (rider.owned = {}); o.cabin = [...new Set([...ownedPieces(rider), id])]; saveRider(rider); if (R) sync(); if (id === 'dogbeds') { if (inside) dogsInside(); townDogs(); } if (id === 'porch') townRockers(); },
    buy(id) { focus = { kind: 'slot', id }; act(); },
    get interior() { return R; },
  };
  C.dispose = () => {
    disposed = true;
    if (inside) finishLeave(null);
    listen(false);
    clearDogs(dogsIn); clearDogs(porchDogs);
    if (rockers) { disposeTree(rockers.userData.tpl); rockers.removeFromParent(); rockers = null; }
    if (R) R.dispose(); else if (Rp) Rp.then((r) => r.dispose()).catch(() => {});
    R = null; Rp = null;
    ui.remove();
  };
  return C;
}
