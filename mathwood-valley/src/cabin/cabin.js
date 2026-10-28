// THE PLAYER'S CABIN: a cabin built in code like the town's other buildings (world/objects/codebuildings.js: the
// two-room log house unless the layout names another design, which the Town Lab's New look changes), the rider's home
// once bought. Dad: "I'd prefer to have the door opening controlled manually (press 'E' to open/close). Then I'd want the
// player to move forward the same way they always do ... Once they are in the door the camera moves to 1st person. But
// the door stays open unless they shut it."
//   - its doors are the town's (world/objects/doorkeeper.js): E at the doorway opens or shuts one, and the cabin's stay
//     open until the player shuts them (the shops' shut themselves once you have gone)
//   - walking up the porch and in is the game's own walking, at its own pace: nothing moves the player for them
//   - crossing a doorway into a room the camera eases to the player's eyes (first person), and back behind them on the
//     way out; looking about is the same drag (or the stick) as anywhere
//
// FOR SALE: until a rider buys it (catalog.js PRICES.cabin) the cabin wears a "For sale" sign and its doors are locked.
// At its door spot with the gold the prompt says "Buy the cabin"; one press buys it. Without the gold, a small card says
// how much more is needed. Before that the rider camps by the creek behind it (camp.js), where the dogs wait. Bought: a
// SOLD board goes up on the sign, the windows light at night, and the sign and the camp are taken away once out of sight.
//
// INSIDE, in first person: look at a slot (slots.js, placed by the design's rooms: layout.js) and a see-through look at
// its piece shows with its name, price and what it is; E buys it and it grows into place. At the table you open your lock
// boxes. The belt-buckle keepsakes hang in their spots once earned. The dogs at home (homedogs.js) are on their beds
// inside once there are dog beds, else on the porch (or by the camp's fire before the cabin is bought). The dog that
// follows you waits by the porch steps while you're inside (main.js reads C.dogWait).
//
//   const C = makeCabin({ W, renderer, camera, animals, rider, hud, input, audio, player, follower, onBuy, onLockbox })
//   C.ready                       a promise: the cabin's things are stood in it
//   C.inside                      the player is in its rooms (or the camera still easing back out): main.js then calls
//                                 C.update instead of its own doors and the player's update
//   C.busy                        always false
//   C.indoor                      inside with its doors shut (the town's sounds muffled)
//   C.prompt()                    the town door prompt at the cabin's spot: 'Buy the cabin: 600 gold' (not yet bought,
//                                 the gold there), else null (bought: its door has its own prompt)
//   C.owned                       the rider owns it (main.js: no counter at its spot then)
//   C.markLabel                   the compass's name for it ('Your cabin' or 'The cabin for sale')
//   C.dogWait                     while the player is inside: where the dog that follows waits (a Vector3), else null
//   C.enter()                     not yet bought: buys it. Bought: (rigs and the dev buttons) stands the player just
//                                 inside its front door, facing in
//   C.leave({ to })               to: { x, z, rot } somewhere else in town (the menu's "back to town": at once)
//   C.update(dt)                  each frame while C.inside: the player's own update, then the first person camera, what
//                                 is looked at, the prompt and E
//   C.render()                    draws the frame (the valley's: W.render)
//   C.town(dt)                    each frame of play: the sign, the camp, the dogs at home, the pieces near or far
//   C.dogsChanged()               the rider's dogs changed (bought one, took another along)
//   C.state()                     for a rig;  C.dev: { buy(id), give(id), own(on), look(x, z, yaw, pitch) }
//   C.dispose()
import * as THREE from 'three';
import { makeHome, NEAR } from './interior.js';
import { makeHomeDog } from './homedogs.js';
import { makeSaleSign } from './forsale.js';
import { makeCamp } from './camp.js';
import { SLOTS, ownedPieces, nextPiece, buyPiece, homeDogs } from './slots.js';
import { spend, saveRider, KEEPSAKES, BUCKLES, BUCKLE_NAMES, buckleOf, jobWords, JOBS } from '../save.js';
import { PRICES } from '../catalog.js';
import { CAM } from '../camera.js';

// FIRST PERSON inside: the eyes over the feet, the field of view, how fast the camera eases in and out; what E reaches
// INDOORS, THE VALLEY LEFT UNDRAWN WHEN NO OPENING IS IN VIEW: facing a log wall the whole valley behind it would be
// drawn all the same. While none of the room's openings (its windows' glass, its doorways: R.openings) is on screen,
// with a margin round the edges, the camera's far limit is pulled in to just past the room, so the valley is left out
// by the usual out-of-view check; the moment one comes near the screen's edge it goes back out, before any of the
// outside could show. And all the while inside, the sun's shadows are drawn again a few times a second, not every frame.
//
// PORTALS: and while some are in view, only what can be seen through them is drawn: each opening on screen (a window's
// glass, a doorway: R.portals) and the eyes make a narrow view of their own (four sides, from the eyes through the
// opening's four edges), and every outdoor thing whose bounds fall outside all of those views is left out of the frame
// (its layer 0 put off, so nothing else's own showing and hiding is touched; back on the moment it can be seen, and as
// soon as the player is out). The things looked at are gathered again every PORTAL.every seconds.
export const INDOOR = { margin: 1.25, far: 14, shadowEvery: 0.4 };
export const PORTAL = { every: 1, grow: 0.15, skinned: 1.2 };   // (s; m added round each opening; m added to a body's bounds)
export const FP = {
  eye: 1.62, fov: 68, ease: 0.38,     // m; degrees (the town's is 55); s to ease all the way in or out
  pitch: 1.3,                         // how far a drag tilts the view up and down (the chase camera's tilt, scaled)
  reach: 3.0, aim: 0.36,              // how far off and how far from the middle of the view (radians) E picks a slot
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
  ui.innerHTML = '<div class="bmc-dot" hidden></div><div class="bmc-card" hidden></div>';
  document.body.appendChild(ui);
  const dotEl = ui.querySelector('.bmc-dot'), cardEl = ui.querySelector('.bmc-card');
  const pl = W.places.cabin, CODE = W.V && W.V.CODE;

  let R = null, disposed = false, inRoom = false, fpT = 0, focus = null, dogs = [], dogsWhere = '', dogsDirty = true, told = false, building = null;
  const C = {
    get inside() { return inRoom || fpT > 0.02; }, busy: false,
    get indoor() { return inRoom && !!R && !R.code.anyOpen(); },
    get owned() { return ownsHome(); },
    get markLabel() { return ownsHome() ? 'Your cabin' : 'The cabin for sale'; },
    dogWait: null,
  };
  const ownsHome = () => !!(rider.owned && rider.owned.home === 'cabin');
  const owned = () => ownedPieces(rider);
  const night = () => { const n = W.night; return typeof n === 'number' && Number.isFinite(n) ? n : 0; };
  if (CODE) CODE.cabinLocked = () => !ownsHome();   // (its doors: locked till it is bought, world/objects/doorkeeper.js)
  const lights = () => { if (W.lights && W.lights.set) W.lights.set('cabin', ownsHome() ? 1 : 0); };   // (its windows lit at night once it's yours)

  // ── STANDING IN THE VALLEY: the pieces in the code-built cabin (made again if the Town Lab gives it a new look) ──
  let sign = null, camp = null, clock = 0;
  function build() {
    if (building) return building;
    building = makeHome({ W, renderer, base: BASE }).then((home) => {
      building = null;
      if (disposed) { home.dispose(); return; }
      if (R) { clearDogs(); if (sign) { sign.dispose(); sign = null; } R.dispose(); }
      R = home;
      // (its spot in the valley: before the porch's steps, where the buy prompt and the compass point)
      const st = R.toWorld(R.layout.steps.x, 0, R.layout.steps.z); pl.door = { x: st.x, z: st.z };
      sync(); lights();
      if (!ownsHome()) { putSign(); putCamp(); }
      dogsDirty = true;
    }).catch((e) => { building = null; console.error('cabin: the player\'s cabin could not be furnished', e); });
    return building;
  }
  C.ready = build();
  function putSign() {
    if (sign || !R) return;
    sign = makeSaleSign({ price: PRICES.cabin });
    const g = sign.group, S = R.layout.sign;
    g.position.set(S.x, R.floorUnder(S.x, S.z), S.z); g.rotation.y = S.rot;
    R.group.add(g);
  }
  function putCamp() { if (!camp) camp = makeCamp({ W, camera, audio, frame: pl }); }
  // is a spot (the valley's) in the camera's view? (a little wider than the screen, so nothing goes at its edge)
  const frustum = new THREE.Frustum(), projM = new THREE.Matrix4(), sphere = new THREE.Sphere();
  function inView(p, r = 2) {
    camera.updateMatrixWorld(); projM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projM);
    sphere.center.copy(p); sphere.radius = r * 1.6; return frustum.intersectsSphere(sphere);
  }

  // ── THE DOGS AT HOME: on their beds, on the porch, or by the camp's fire ──
  function clearDogs() { for (const d of dogs) d.dispose(); dogs = []; }
  function whereDogs() { return !ownsHome() ? 'camp' : owned().includes('dogbeds') ? 'beds' : 'porch'; }
  function placeDogs() {
    clearDogs(); dogsDirty = false;
    const home = homeDogs(rider).filter((d) => !d.following);
    dogsWhere = whereDogs() + ':' + home.map((d) => d.kind + d.name).join(',');
    if (!R || !home.length) return;
    const where = whereDogs();
    if (where === 'beds') {
      const spots = R.bedSpots(home.length);
      home.forEach((d, i) => { const q = spots[i]; dogs.push(makeHomeDog({ animals, kind: d.kind, name: d.name, scene: R.inner, spot: { x: q.x, y: q.y, z: q.z, rot: q.rot + Math.PI * 0.5 }, mode: 'bed', floor: (x, z) => R.floorUnder(x, z), push: (b) => R.pushOut(b, { radius: 0.24 }), lit: R.lit, others: () => dogs })); });
      dogs.frame = 'cabin';
    } else if (where === 'porch') {
      home.forEach((d, i) => { const [x, z, turn] = R.layout.porchDogs[i % R.layout.porchDogs.length], y = R.floorUnder(x, z); dogs.push(makeHomeDog({ animals, kind: d.kind, name: d.name, scene: R.group, spot: { x, y, z, rot: turn }, mode: 'porch', floor: () => y })); });
      dogs.frame = 'cabin';
    } else if (camp) {
      camp.dogSpots(home.length).forEach((q, i) => { const d = home[i]; dogs.push(makeHomeDog({ animals, kind: d.kind, name: d.name, scene: W.scene, spot: q, mode: 'porch', floor: () => q.y })); });
      dogs.frame = 'valley';
    }
  }
  // the dogs move to their new place only while neither the old place nor the new one is in view (nothing pops)
  function dogSpotOf(where) {
    if (where === 'camp') return camp ? new THREE.Vector3(camp.spot.x, W.heightAt(camp.spot.x, camp.spot.z), camp.spot.z) : null;
    if (!R) return null;
    const m = R.layout.main, s = R.layout.steps;
    return where === 'beds' ? R.toWorld((m.x0 + m.x1) / 2, 1.2, (m.z0 + m.z1) / 2) : R.toWorld(s.x, 1.2, s.z);
  }
  function maybeMoveDogs(force = false) {
    const key = whereDogs() + ':' + homeDogs(rider).filter((d) => !d.following).map((d) => d.kind + d.name).join(',');
    if (!dogsDirty && key === dogsWhere) return;
    if (!force && dogs.length) {
      const was = dogSpotOf(dogsWhere.split(':')[0]), now = dogSpotOf(whereDogs());
      if ((was && inView(was, 4)) || (now && inView(now, 4))) return;
    }
    placeDogs();
  }
  C.dogsChanged = () => { dogsDirty = true; };

  // ── LABELS DRAWN THROUGH WALLS (a steer's number, a sheep's, a rider's slip, a dog's name: drawn over everything so
  // grass and fences never hide them): while the cabin has the player they are hidden by its walls like anything else
  // outside (seen through the windows and the door only), and drawn through again once the player is out ──
  const throughWalls = new Set();
  function wallsHide(on) {
    if (!on) { for (const m of throughWalls) m.depthTest = false; throughWalls.clear(); return; }
    W.scene.traverse((o) => {
      const m = o.material; if (!m || Array.isArray(m) || m.depthTest !== false || throughWalls.has(m)) return;
      for (let q = o; q; q = q.parent) if (R && q === R.inner) return;   // (the room's own: the names of the dogs on their beds)
      m.depthTest = true; throughWalls.add(m);
    });
  }

  // ── THE TOWN, EACH FRAME: the sign, the camp, the dogs, the pieces near or far, and whether the player is inside ──
  let nearOn = true, townT = 0, wasOwned = ownsHome();
  const atL = new THREE.Vector3();
  C.town = (dt) => {
    clock += dt;
    if (R && R.stale()) build();   // (built again: the Town Lab's New look)
    if (!R) return;
    const P = player(), at = P ? P.position : null;
    if (at) R.toLocal(at.x, at.y, at.z, atL);
    const d = at ? Math.hypot(at.x - pl.x, at.z - pl.z) : 0;
    // (in one of its rooms: past a doorway; the camera eases to first person, C.update)
    const was = inRoom; inRoom = !!at && P.mode === 'foot' && R.inside(atL.x, atL.z);
    if (inRoom !== was) { wallsHide(inRoom); C.dogWait = inRoom ? R.toWorld(R.layout.wait.x, 0, R.layout.wait.z) : null; { const D = follower(); if (D) D.tagOn = !inRoom; } if (inRoom) arrived(); }
    const want = inRoom || d < (nearOn ? NEAR.hide : NEAR.show);
    if (want !== nearOn) { nearOn = want; R.near(want); }
    R.update(dt, { night: night() });
    if (wasOwned !== ownsHome()) { wasOwned = ownsHome(); lights(); }
    if (sign) sign.update(dt, clock);
    if (camp && d < 160) camp.update(dt, clock);
    if ((townT -= dt) < 0) {
      townT = 0.5;
      // bought: the sign (with its SOLD board) and the camp are taken away once out of sight
      if (ownsHome() && sign && !inRoom && d > 12 && !inView(R.toWorld(R.layout.sign.x, 1.2, R.layout.sign.z), 2)) { sign.dispose(); sign = null; }
      // (the camp goes with the dogs that waited there: both only while the camp and the dogs' new place are out of view)
      if (ownsHome() && camp && !inView(new THREE.Vector3(camp.spot.x, W.heightAt(camp.spot.x, camp.spot.z) + 0.6, camp.spot.z), 4) && (!at || Math.hypot(at.x - camp.spot.x, at.z - camp.spot.z) > 20)) {
        const to = dogSpotOf(whereDogs());
        if (dogs.frame !== 'valley' || !dogs.length || !to || !inView(to, 4)) { camp.dispose(); camp = null; dogsDirty = true; maybeMoveDogs(true); }
      }
      maybeMoveDogs();
    }
    // the dogs at home: they get up as you come near (the porch's and the camp's), greet you inside
    if (at && (dogs.frame === 'valley' || nearOn)) {
      const here = dogs.frame === 'cabin' ? { x: atL.x, z: atL.z, heading: (P ? P.heading : 0) - R.yaw } : { x: at.x, z: at.z, heading: P ? P.heading : 0 };
      for (const g of dogs) g.update(dt, here);
    }
    // in town: the card at the door of a cabin still for sale
    if (!inRoom && P) doorCard(P);
  };
  // at its door spot: a cabin not bought yet, and not enough gold for it: a card says what it costs and how much more to go
  let cardShown = '';
  function doorCard(P) {
    const foot = P.mode === 'foot', pd = pl.door, near = Math.hypot(P.position.x - pd.x, P.position.z - pd.z) < (foot ? 3.4 : 4.6);
    let html = '';
    if (near && !ownsHome() && rider.gold < PRICES.cabin) {
      html = `<b>This cabin is for sale</b><span class="bmc-price">${COIN}${PRICES.cabin}</span><small>A home of your own: rooms to furnish, a porch, a bed for your dogs.</small><em>${PRICES.cabin - rider.gold} more gold to go</em>`;
    }
    if (html !== cardShown) { cardShown = html; cardEl.innerHTML = html; cardEl.hidden = !html; cardEl.classList.toggle('is-door', !!html); }
  }
  C.prompt = () => {
    if (!R || ownsHome()) return null;   // (bought: its door has its own prompt, the keeper's)
    return rider.gold >= PRICES.cabin ? `Buy the cabin: ${PRICES.cabin} gold` : null;
  };
  function buy() {
    if (ownsHome()) return true;
    if (!spend(rider, PRICES.cabin)) { hud.toast(`${PRICES.cabin - rider.gold} more gold for the cabin. Rope some cattle or crack a lock box.`, 'warn'); return false; }
    const o = rider.owned || (rider.owned = {}); o.home = 'cabin'; saveRider(rider);
    if (sign) sign.sold();
    hud.toast(`The cabin is yours! −${PRICES.cabin} gold. Press E at its door to go in.`, 'gold');
    onBuy('cabin'); lights();
    dogsDirty = true; cardEl.hidden = true; cardShown = '';
    return true;
  }
  // in through a doorway: a keepsake won out on this ride hung, the dogs greet you, a word about what to buy next
  let greetDone = false;
  function arrived() {
    if (!R) return;
    R.keepsakes(keepsakesOf(rider));
    greetDone = false; greet();
    if (!told) { told = true; const n = nextPiece(rider); if (n) hud.toast(n.price <= rider.gold ? `Look round: there's room for ${a(n.name)}.` : `Saving up? Next for the cabin: ${n.name.toLowerCase()}, ${n.price} gold.`, 'gold'); }
  }
  function greet() {
    if (greetDone) return; greetDone = true;
    if (dogs.frame === 'cabin' && whereDogs() === 'beds') dogs.forEach((h, i) => (h.ready || Promise.resolve()).then(() => setTimeout(() => { if (inRoom) h.greet(i, dogs.length); }, 300 + i * 350)));
  }
  C.enter = () => {
    if (disposed || !R) return;
    if (!ownsHome()) { buy(); return; }
    // (rigs and the dev buttons: just inside the front door, facing in; the door left as it is)
    const P = player(); if (!P) return;
    const f = R.layout.front, w = R.toWorld(f.x - f.ox * 1.1, 0, f.z - f.oz * 1.1);
    P.teleport(w.x, w.z, Math.atan2(-f.ox, -f.oz) + R.yaw);
  };
  C.leave = ({ to = null } = {}) => {
    const P = player(); if (!P || !to) return;
    P.teleport(to.x, to.z, to.rot); inRoom = false; fpT = 0; settle(P);
  };

  // ── FIRST PERSON: the chase camera's pose (P.update placed it) eased toward the player's eyes ──
  const thirdP = new THREE.Vector3(), thirdQ = new THREE.Quaternion(), eyeP = new THREE.Vector3(), eyeQ = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ');
  const smooth = (t) => t * t * (3 - 2 * t);
  let fovWas = null;
  function firstPerson(P, dt) {
    fpT = Math.max(0, Math.min(1, fpT + (inRoom ? 1 : -1) * dt / FP.ease));
    const k = smooth(fpT);
    if (P.person) P.person.fade = Math.max(0, 1 - k * 2);   // (the rider's own body gone by half way)
    if (fovWas == null) fovWas = camera.fov;
    if (k <= 0) { settle(P); return; }
    const cam = P.cam;
    thirdP.copy(camera.position); thirdQ.copy(camera.quaternion);
    eyeP.set(P.position.x, P.position.y + FP.eye, P.position.z);
    const yaw = cam ? cam.yaw : P.heading, pitch = cam ? THREE.MathUtils.clamp((CAM.pitch - cam.pitch) * FP.pitch, -1.25, 1.25) : 0;
    eul.set(pitch, yaw + Math.PI, 0, 'YXZ'); eyeQ.setFromEuler(eul);
    camera.position.lerpVectors(thirdP, eyeP, k); camera.quaternion.slerpQuaternions(thirdQ, eyeQ, k);
    const fov = fovWas + (FP.fov - fovWas) * k;
    if (Math.abs(camera.fov - fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }
  // the valley left out while no opening is in view (INDOOR); the shadows a few times a second
  const hv = new THREE.Vector3();
  let farWas = null, shadowWas = null, shadowT = 0;
  function indoors(dt) {
    const on = fpT > 0.9 && inRoom;
    if (on && shadowWas == null) shadowWas = renderer.shadowMap.autoUpdate;
    if (on) { renderer.shadowMap.autoUpdate = false; if ((shadowT -= dt) <= 0) { shadowT = INDOOR.shadowEvery; renderer.shadowMap.needsUpdate = true; } }
    else if (shadowWas != null) { renderer.shadowMap.autoUpdate = shadowWas; shadowWas = null; }
    let seen = !on;
    if (on) { camera.updateMatrixWorld(); for (const p of R.openings()) { R.toWorld(p[0], p[1], p[2], hv).project(camera); if (hv.z < 1 && Math.abs(hv.x) < INDOOR.margin && Math.abs(hv.y) < INDOOR.margin) { seen = true; break; } } }
    if (!seen) { if (farWas == null) farWas = camera.far; if (camera.far !== INDOOR.far) { camera.far = INDOOR.far; camera.updateProjectionMatrix(); } }
    else if (farWas != null) { camera.far = farWas; farWas = null; camera.updateProjectionMatrix(); }
    if (on && seen) portalCull(dt); else uncull();
  }
  // ── THE PORTALS (above) ──
  const culled = new Set(), sph = new THREE.Sphere(), views = [], pv = [0, 1, 2, 3].map(() => new THREE.Vector3()), pc = new THREE.Vector3(), cw = new THREE.Vector3();
  let things = [], thingsT = 0;
  function gather() {
    things = [];
    const mine = R.code.group;
    W.scene.traverse((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || o.frustumCulled === false) return;
      for (let a = o; a; a = a.parent) if (a === mine) return;   // (the cabin's own: the room, its pieces, its dogs)
      things.push(o);
    });
  }
  function frustumThrough(rect) {
    // (the four sides from the eyes through the opening's edges, a little wider; each faces in, toward its middle)
    pc.set(rect.c[0], rect.c[1], rect.c[2]); R.toWorld(pc.x, pc.y, pc.z, pc);
    rect.corners.forEach((q, i) => { R.toWorld(q[0], q[1], q[2], pv[i]); pv[i].sub(pc).multiplyScalar(1 + PORTAL.grow / Math.max(0.3, pv[i].length())).add(pc); });
    const F = views.length < 16 ? new THREE.Frustum() : null; if (!F) return null;
    for (let i = 0; i < 4; i++) {
      const a = pv[i], b = pv[(i + 1) % 4], P = F.planes[i];
      P.setFromCoplanarPoints(cw, a, b); if (P.distanceToPoint(pc) < 0) P.negate();
    }
    F.planes[4].setFromNormalAndCoplanarPoint(hv.subVectors(pc, cw).normalize(), cw);   // (in front of the eyes)
    F.planes[5].set(new THREE.Vector3(0, 0, 0), 1);   // (no far side)
    return F;
  }
  function portalCull(dt) {
    if ((thingsT -= dt) <= 0) { thingsT = PORTAL.every; gather(); }
    views.length = 0; cw.copy(camera.position);
    for (const rect of R.portals()) {
      let on = false;
      for (const q of rect.corners) { R.toWorld(q[0], q[1], q[2], hv).project(camera); if (hv.z < 1 && Math.abs(hv.x) < INDOOR.margin && Math.abs(hv.y) < INDOOR.margin) { on = true; break; } }
      if (!on) continue;
      const F = frustumThrough(rect); if (F) views.push(F);
    }
    for (const o of things) {
      const g = o.geometry; let bs = o.isInstancedMesh || o.isSkinnedMesh ? (o.boundingSphere || (o.computeBoundingSphere && (o.computeBoundingSphere(), o.boundingSphere))) : g && (g.boundingSphere || (g.computeBoundingSphere(), g.boundingSphere));
      if (!bs) continue;
      sph.copy(bs).applyMatrix4(o.matrixWorld); if (o.isSkinnedMesh) sph.radius += PORTAL.skinned;
      let see = false; for (const F of views) if (F.intersectsSphere(sph)) { see = true; break; }
      if (see) { if (culled.has(o)) { o.layers.enable(0); culled.delete(o); } }
      else if (!culled.has(o) && o.layers.isEnabled(0)) { o.layers.disable(0); culled.add(o); }
    }
  }
  function uncull() { if (!culled.size) return; for (const o of culled) o.layers.enable(0); culled.clear(); }
  // back to the town's camera as it was (out, or carried away)
  function settle(P) {
    uncull();
    if (farWas != null) { camera.far = farWas; farWas = null; camera.updateProjectionMatrix(); }
    if (shadowWas != null) { renderer.shadowMap.autoUpdate = shadowWas; shadowWas = null; }
    if (P && P.person) P.person.fade = 1;
    if (fovWas != null && camera.fov !== fovWas) { camera.fov = fovWas; camera.updateProjectionMatrix(); }
    fovWas = null; dotEl.hidden = true;
  }

  // ── WHAT YOU LOOK AT INSIDE (first person): a slot, the table, a keepsake ──
  const fwd = new THREE.Vector3(), eye = new THREE.Vector3(), tmp = new THREE.Vector3(), qInv = new THREE.Quaternion();
  function pickFocus() {
    R.toLocal(camera.position.x, camera.position.y, camera.position.z, eye);
    camera.getWorldDirection(fwd); qInv.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -R.yaw); fwd.applyQuaternion(qInv);
    let best = null, bestS = Infinity;
    const consider = (kind, id, p, reach = FP.reach) => {
      tmp.set(p[0], p[1], p[2]).sub(eye); const d = tmp.length(); if (d > reach || d < 0.05) return;
      const ang = tmp.angleTo(fwd); if (ang > FP.aim) return;
      const s = ang + d * 0.04; if (s < bestS) { bestS = s; best = { kind, id }; }
    };
    const have = owned();
    // (the porch's rockers: looked at out through the open front door, from just inside)
    for (const s of SLOTS) { const q = R.spec(s.id); for (const p of q.looks) consider(have.includes(s.id) ? 'piece' : 'slot', s.id, p, s.id === 'porch' ? 4.2 : FP.reach); }
    // (the counter bell stands on the table: once there is one, looking there is the table's, for its lock boxes)
    for (const k of keepsakesOf(rider)) { const p = R.keepLook(k.job); if (p && !(k.job === 'orders' && have.includes('table'))) consider('keepsake', k.job, p, 3.6); }
    return best;
  }
  // (the card and the prompt are drawn again only when what you look at changes, or the gold does)
  function showFocus(f, force = false) {
    const k = f ? f.kind + ':' + f.id : null, was = focus ? focus.kind + ':' + focus.id : null;
    focus = f;
    if (R) R.ghost(f && f.kind === 'slot' ? f.id : null);
    if (k === was && !force) return;
    if (!f) { cardEl.hidden = true; hud.prompt(null); return; }
    let card = '', prompt = null;
    if (f.kind === 'slot') {
      const s = R.spec(f.id), short = s.price - rider.gold;
      card = `<b>${esc(s.name)}</b><span class="bmc-price">${COIN}${s.price}</span><small>${esc(s.line)}</small>`
        + (short > 0 ? `<em>${short} more gold to go</em>` : '');
      prompt = short > 0 ? null : `Buy ${a(s.name)}`;
    } else if (f.kind === 'piece') {
      if (f.id === 'table') { const n = (rider.lockboxes || []).length; prompt = n ? `Open a lock box (${n} in your saddlebags)` : null; if (!n) card = '<b>Your table</b><small>Win a lock box on the round-up, then open it here.</small>'; }
    } else if (f.kind === 'keepsake') {
      const kk = KEEPSAKES[f.id], b = buckleOf(rider, f.id);
      card = `<b>${esc(kk.name)}</b><small>${esc(BUCKLE_NAMES[b.tier] || '')} buckle: ${esc(jobWords(f.id, b.count))}</small>`;
    }
    cardEl.innerHTML = card; cardEl.hidden = !card; cardEl.classList.remove('is-door');
    hud.prompt(prompt);
  }
  // ("a rag rug", "an iron stove"; a name that already counts itself or is plural takes none: "two lanterns", "dog beds")
  const a = (name) => (/^(a|two|an) /i.test(name) || (/[^s]s$/i.test(name) && !/ and /i.test(name)) ? name.toLowerCase() : (/^[aeiou]/i.test(name) ? 'an ' : 'a ') + name.toLowerCase());
  function act() {
    const f = focus; if (!f) return;
    if (f.kind === 'slot') {
      const s = R.spec(f.id), r = buyPiece(rider, f.id, spend, saveRider);
      if (r === 'short') { hud.toast(`${s.price - rider.gold} more gold for ${a(s.name)}. Rope some cattle or crack a lock box.`, 'warn'); return; }
      if (r !== 'bought') return;
      R.ghost(null); sync();
      Promise.resolve().then(() => setTimeout(() => R && R.pop(f.id), 0));
      hud.toast(`${s.name} for the cabin! −${s.price} gold`, 'gold');
      onBuy(f.id);
      if (f.id === 'dogbeds') { placeDogs(); greetDone = false; greet(); }
      showFocus(pickFocus(), true);
      return;
    }
    if (f.kind === 'piece' && f.id === 'table') {
      const bx = (rider.lockboxes || [])[0]; if (!bx) return;
      onLockbox({ tier: bx.tier, from: 'loot' }, { own: true, after: () => showFocus(focus, true) });
    }
  }
  function sync() {
    if (!R) return;
    // (the pieces' shaders built as they come, for the valley's lights: the first look in through the door doesn't stall)
    const home = R;
    R.furnish(owned(), { dogs: homeDogs(rider).filter((d) => !d.following).length }).then(() => { if (R === home && W.warmFor) W.warmFor(home.group); }).catch(() => {});
    R.keepsakes(keepsakesOf(rider));
  }

  // ── EACH FRAME WHILE THE PLAYER IS INSIDE (or the camera still easing out): the player's own walking, then the eyes ──
  let gold = rider.gold;
  C.update = (dt) => {
    const P = player(); if (!P || !R) return;
    const e = I.enabled && I.tap('KeyE');   // (E read before the player's own update, which would take it for the horse)
    P.update(dt);
    firstPerson(P, dt);
    indoors(dt);
    const fp = fpT > 0.6;
    dotEl.hidden = !fp;
    // what E does: a slot, the table, a keepsake (looked at); else the door at hand (the keeper's), open or shut
    const f = fp ? pickFocus() : null;
    showFocus(f, gold !== rider.gold);
    if (!f) {
      const DK = CODE && CODE.doors, kd = DK && P.mode === 'foot' ? DK.near(P.position.x, P.position.z) : null;
      hud.prompt(kd ? (kd.open ? 'Close the door' : 'Open the door') : null);
      if (kd && e) DK.use(kd.door, !kd.open);
    } else if (e) act();
    gold = rider.gold;
  };
  C.render = () => W.render();

  // ── for rigs and the dev buttons ──
  C.state = () => ({ inside: C.inside, inRoom, fp: +fpT.toFixed(2), home: ownsHome(), door: R ? R.code.doors.map((q) => +q.t.toFixed(2)) : [],
    at: R ? { x: +atL.x.toFixed(2), z: +atL.z.toFixed(2) } : null,
    focus: focus ? { ...focus } : null, owned: owned(), shown: R ? R.shown : [], keepsakes: keepsakesOf(rider).map((k) => k.job + ':' + k.tier),
    dogs: dogs.map((d) => d.state()), dogsAt: dogsWhere.split(':')[0], sign: sign ? (sign.isSold ? 'sold' : 'for sale') : null, camp: camp ? { x: +camp.spot.x.toFixed(1), z: +camp.spot.z.toFixed(1), local: camp.spot.local } : null,
    near: nearOn, ready: !!R, preset: R ? R.code.look.preset : null });
  C.dev = {
    // (stand inside at a spot of its frame, looking yaw (its frame: 0 toward +z) and pitch up)
    look(x, z, yaw = 0, pitch = 0) { const P = player(); if (!P || !R) return; const w = R.toWorld(x, 0, z); P.teleport(w.x, w.z, yaw + R.yaw); if (P.cam) { P.cam.yaw = yaw + R.yaw; P.cam.pitch = CAM.pitch - pitch / FP.pitch; } },
    give(id) { const o = rider.owned || (rider.owned = {}); o.cabin = [...new Set([...ownedPieces(rider), id])]; saveRider(rider); sync(); if (id === 'dogbeds') dogsDirty = true; },
    own(on = true) { const o = rider.owned || (rider.owned = {}); if (on) o.home = 'cabin'; else delete o.home; saveRider(rider); if (!on) { putSign(); putCamp(); } dogsDirty = true; lights(); },
    buy(id) { focus = { kind: 'slot', id }; act(); },
    moveDogs() { placeDogs(); },
    get interior() { return R; }, get camp() { return camp; }, get sign() { return sign; },
  };
  C.dispose = () => {
    disposed = true;
    if (inRoom) wallsHide(false);
    settle(player());
    clearDogs();
    if (sign) { sign.dispose(); sign = null; }
    if (camp) { camp.dispose(); camp = null; }
    if (R) R.dispose();
    R = null;
    if (CODE && CODE.cabinLocked) CODE.cabinLocked = null;
    ui.remove();
  };
  return C;
}
