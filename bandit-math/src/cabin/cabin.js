// THE PLAYER'S CABIN: the log cabin in town is the rider's home, once bought. It stands in the valley like everything
// else (interior.js): no fade and no scene of its own. Walk up to its door and press E (or tap the prompt, or just walk
// on into the steps): the rider climbs the porch steps, the door swings open, and the camera slides from behind the
// rider in through the doorway to their eyes: first person inside. The door swings shut behind. Mouse: drag to look, or
// click once to look with the mouse freely (Esc lets go); WASD or the arrows step about, Shift hurries. Phone: the thumb
// stick on the left steps, a drag on the right looks. The walls and the furniture stop you. The village shows through
// the windows and the open door, its sounds and the band's music go on (a little muffled with the door shut), and the
// valley's light (its sun, its day and night) comes in. To go out: look at the door and press E, or walk into it: the
// door opens, the rider walks out and down the steps, and the camera slides back out behind them.
//
// FOR SALE: until a rider buys it (catalog.js PRICES.cabin) the cabin wears a "For sale" sign and its door is locked. At
// the door with the gold the prompt says "Buy the cabin"; one press buys it and walks in. Without the gold, a small card
// says how much more is needed. Before that the rider camps by the creek behind it (camp.js: a bedroll and a small
// fire), where the dogs wait. Bought: a SOLD board goes up on the sign, and the sign and the camp are taken away once
// they are out of sight. A rider from before the cabin was for sale who has any furniture has it as bought (save.js).
//
// The cabin has fixed slots for furnishings (slots.js: a rug, lanterns, a painting, dog beds, a table and chairs, porch
// rockers, a bed, a rifle rack, a stove), cheap to costly. Look at an empty slot: a see-through look at the piece shows
// in its place, with its name, its price and what it is in a small card; E (or a tap on the prompt) buys it, and it
// grows into place. Bought pieces are saved with the rider (rider.owned.cabin). At the table you open your lock boxes.
// The belt-buckle keepsakes (save.js KEEPSAKES) hang in their spots once earned (one won out on this ride is hung as you
// walk in). The dogs at home (homedogs.js) are on their beds inside once there are dog beds, else on the porch (or by
// the camp's fire before the cabin is bought). The dog that follows you waits by the porch steps while you're inside
// (main.js reads C.dogWait).
//
//   const C = makeCabin({ W, renderer, camera, animals, rider, hud, input, audio, player, follower, onBuy, onLockbox })
//     player(): the player (P, from player.js); follower(): the dog following you (D, from dog.js) or null
//     onBuy(id): a piece (or 'cabin', the cabin itself) was bought (the purse is redrawn); onLockbox(box, { own, after })
//   C.ready                       a promise: the cabin is stood in the valley
//   C.inside                      the cabin has the player: walking in, inside, or walking out (main.js then calls
//                                 C.update instead of moving the player itself, and skips the town's doors)
//   C.busy                        walking in or out (prompts wait)
//   C.indoor                      inside with the door shut (the town's sounds muffled)
//   C.prompt()                    the words for the town door prompt at the cabin ('Go into your cabin', 'Buy the
//                                 cabin: 600 gold'), or null (not ready, or short of gold: the card says so)
//   C.markLabel                   the compass's name for it ('Your cabin' or 'The cabin for sale')
//   C.dogWait                     while the cabin has the player: where the dog that follows waits (a Vector3), else null
//   C.enter(), C.leave({ to })    to: { x, z, rot } somewhere else in town to come out at (the menu's "back to town": at once)
//   C.update(dt)                  each frame while C.inside (moves the player, the camera, the door)
//   C.render()                    draws the frame (the valley's: W.render)
//   C.town(dt)                    each frame of play: the sign, the camp, the dogs at home, the inside's things near or far
//   C.dogsChanged()               the rider's dogs changed (bought one, took another along)
//   C.state()                     for a rig;  C.dev: { buy(id), give(id), own(on), look(x, z, yaw, pitch) }
//   C.dispose()
import * as THREE from 'three';
import { makeHome, loadHomeModel, NEAR } from './interior.js';
import { makeIndoor } from './indoor.js';
import { makeHomeDog } from './homedogs.js';
import { makeSaleSign } from './forsale.js';
import { makeCamp } from './camp.js';
import { playDoor } from './doorsound.js';
import { SLOTS, SLOT, ownedPieces, nextPiece, buyPiece, homeDogs } from './slots.js';
import { spend, saveRider, KEEPSAKES, BUCKLES, BUCKLE_NAMES, buckleOf, jobWords, JOBS } from '../save.js';
import { PRICES } from '../catalog.js';

export const FP = {
  eye: 1.65, radius: 0.26, balls: [0.62, 1.3], step: 0.42,   // eyes above the feet, the body's size, the highest step
  walk: 1.7, hurry: 3.2,                                      // m/s
  mouse: 0.0022, drag: 0.0042, touchDrag: 0.005,              // radians per pixel: free mouse look, a mouse drag, a finger
  fov: 70, near: 0.06,                                        // degrees up and down on a wide screen (a tall one sees ~60
                                                              // across); the near plane inside (the walls are close)
  reach: 3.0, aim: 0.36,                                      // how far off and how far from the middle of the view (radians) E picks
  door: [[0.24, 2.4, 0.66], [0.24, 1.6, 0.66]],               // where you look to use the door (high and low on it)
  doorX: 0.24,                                                // the door's middle across the cabin (its own frame)
};
// THE WALK IN AND OUT (the cabin's own frame: the door on the +z side at z 0.64, the porch out to about 3)
export const WALK = {
  speed: 1.35,                // m/s, a steady walk up the steps
  inside: -0.75,              // where the walk in ends (z): clear of the door's swing (it swings into the room, 1.13 m
                              // round its hinge), so it can shut behind the rider; the walk out starts from here too
  back: 2.1, up: 1.85,        // the camera behind the rider on the way: this far back and this high over their feet
  opensAt: 1.6,               // the door starts to open with the rider this far from it
  swing: 0.55,                // seconds to swing open or shut
  push: 0.3,                  // seconds walking into the door (inside) or the steps (outside) before it opens
};
const BASE = new URL('../../', import.meta.url).href;
const CSS_HREF = new URL('./cabin.css', import.meta.url).href;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#e2ad4c"/><circle cx="12" cy="12" r="7.4" fill="none" stroke="#a8742a" stroke-width="1.6"/></svg>';
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

loadHomeModel(BASE).catch(() => {});   // (the walk-in cabin's model starts loading as the game boots: there by the ride)

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
  const canvas = renderer.domElement;
  const pl = W.places.cabin;

  let R = null, disposed = false;
  let phase = 'town';                         // 'town' | 'in' (walking in) | 'inside' | 'out' (walking out)
  const me = { x: 0, y: 0.82, z: 0, yaw: 0, pitch: -0.05 };   // (inside: the cabin's own frame)
  let focus = null, dogs = [], dogsWhere = '', dogsDirty = true, told = false, doorT = 0, doorTo = 0, doorWas = 0, pushT = 0;
  const saved = { fov: camera.fov, near: camera.near };
  const C = {
    get inside() { return phase !== 'town'; }, get busy() { return phase === 'in' || phase === 'out'; },
    get indoor() { return phase === 'inside' && doorT < 0.05; },
    get markLabel() { return ownsHome() ? 'Your cabin' : 'The cabin for sale'; },
    dogWait: null,
  };
  const ownsHome = () => !!(rider.owned && rider.owned.home === 'cabin');
  const owned = () => ownedPieces(rider);
  const night = () => { const n = W.night; return typeof n === 'number' && Number.isFinite(n) ? n : 0; };

  // ── STANDING IN THE VALLEY ──
  let sign = null, camp = null, clock = 0, indoor = null;   // (indoor: the valley left undrawn inside while no window is in view)
  C.ready = makeHome({ W, renderer, base: BASE }).then((home) => {
    if (disposed) { home.dispose(); return; }
    R = home;
    try { indoor = makeIndoor({ R, camera, renderer }); } catch (e) { console.warn('cabin: the openings could not be found', e); }
    sync();
    if (!ownsHome()) { putSign(); putCamp(); }
    dogsDirty = true;
  }).catch((e) => { console.error('cabin: the walk-in cabin could not be stood in the valley', e); });
  function putSign() {
    if (sign || !R) return;
    sign = makeSaleSign({ price: PRICES.cabin });
    const g = sign.group, x = FP.doorX + 2.3, z = R.porch.foot + 0.8;
    g.position.set(x, groundLocal(x, z), z); g.rotation.y = -0.35;
    R.group.add(g);
  }
  function putCamp() { if (!camp) camp = makeCamp({ W, camera, audio, frame: pl }); }
  // the ground's height in the cabin's frame (its pad is level, but the land round the porch may not be)
  const _w = new THREE.Vector3(), _l = new THREE.Vector3();
  function groundLocal(x, z) { R.toWorld(x, 0, z, _w); return W.heightAt(_w.x, _w.z) - R.group.position.y; }
  // is a spot (the valley's) in the camera's view? (a little wider than the screen, so nothing goes at its edge)
  const frustum = new THREE.Frustum(), projM = new THREE.Matrix4(), sphere = new THREE.Sphere();
  function inView(p, r = 2) {
    camera.updateMatrixWorld(); projM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(projM);
    sphere.center.copy(p); sphere.radius = r * 1.6; return frustum.intersectsSphere(sphere);
  }

  // ── THE DOGS AT HOME: on their beds, on the porch, or by the camp's fire ──
  function clearDogs() { for (const d of dogs) d.dispose(); dogs = []; }
  function whereDogs() { return !ownsHome() ? 'camp' : owned().includes('dogbeds') ? 'beds' : 'porch'; }
  const PORCH_DOGS = [[1.25, 1.75, 0.3], [-0.85, 1.95, -0.4], [2.0, 2.25, 0.1]];   // (x, z on the porch, a turn)
  function placeDogs() {
    clearDogs(); dogsDirty = false;
    const home = homeDogs(rider).filter((d) => !d.following);
    dogsWhere = whereDogs() + ':' + home.map((d) => d.kind + d.name).join(',');
    if (!R || !home.length) return;
    const where = whereDogs();
    if (where === 'beds') {
      const spots = R.bedSpots(home.length);
      home.forEach((d, i) => { const s = spots[i]; dogs.push(makeHomeDog({ animals, kind: d.kind, name: d.name, scene: R.inner, spot: { x: s.x, y: s.y, z: s.z, rot: s.rot + Math.PI * 0.5 }, mode: 'bed', floor: (x, z) => R.floorUnder(x, z, 1.6), push: (b) => R.pushOut(b, { radius: 0.24, balls: [0.32] }), lit: R.lit, others: () => dogs })); });
      dogs.frame = 'cabin';
    } else if (where === 'porch') {
      home.forEach((d, i) => { const [x, z, turn] = PORCH_DOGS[i % PORCH_DOGS.length], y = R.floorUnder(x, z, 2) || R.porch.y; dogs.push(makeHomeDog({ animals, kind: d.kind, name: d.name, scene: R.group, spot: { x, y, z, rot: turn }, mode: 'porch', floor: () => y })); });
      dogs.frame = 'cabin';
    } else if (camp) {
      camp.dogSpots(home.length).forEach((s, i) => { const d = home[i]; dogs.push(makeHomeDog({ animals, kind: d.kind, name: d.name, scene: W.scene, spot: s, mode: 'porch', floor: () => s.y })); });
      dogs.frame = 'valley';
    }
  }
  // the dogs move to their new place only while neither the old place nor the new one is in view (nothing pops)
  function dogSpotOf(where) {
    if (where === 'camp') return camp ? new THREE.Vector3(camp.spot.x, W.heightAt(camp.spot.x, camp.spot.z), camp.spot.z) : null;
    return R ? R.toWorld(0.5, 1.2, where === 'beds' ? -0.8 : 1.9) : null;
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

  // ── THE TOWN, EACH FRAME: the sign, the camp, the dogs, the inside's things near or far ──
  let nearOn = true, townT = 0;
  const atL = new THREE.Vector3();
  C.town = (dt) => {
    clock += dt;
    if (!R) return;
    const P = player(), at = P ? P.position : null;
    const d = at ? Math.hypot(at.x - pl.x, at.z - pl.z) : 0;
    const want = phase !== 'town' || d < (nearOn ? NEAR.hide : NEAR.show);
    if (want !== nearOn) { nearOn = want; R.near(want); }
    if (indoor) { if (nearOn && !indoor.ready) indoor.prepare(1); if (phase === 'town') indoor.update(false); }
    R.update(dt, { night: night() });
    // the door eases toward open or shut (with its creak and its thump, heard from the door)
    if (doorTo !== doorWas) { if (phase !== 'town') playDoor(audio, doorTo > doorWas ? 'open' : 'shut', R.toWorld(FP.doorX, 1.9, 0.64)); doorWas = doorTo; }
    if (doorT !== doorTo) { const step = Math.min(dt, 0.05) / WALK.swing; doorT = doorTo > doorT ? Math.min(doorTo, doorT + step) : Math.max(doorTo, doorT - step); R.setDoor(doorT); }
    if (sign) sign.update(dt, clock);
    if (camp && d < 160) camp.update(dt, clock);
    if ((townT -= dt) < 0) {
      townT = 0.5;
      if (phase !== 'town') wallsHide(true);
      // bought: the sign (with its SOLD board) and the camp are taken away once out of sight
      if (ownsHome() && sign && phase !== 'out' && !inView(R.toWorld(FP.doorX + 2.3, 1.2, R.porch.foot + 0.8), 2) && (phase !== 'town' || d > 12)) { sign.dispose(); sign = null; }
      // (the camp goes with the dogs that waited there: both only while the camp and the dogs' new place are out of view)
      if (ownsHome() && camp && !inView(new THREE.Vector3(camp.spot.x, W.heightAt(camp.spot.x, camp.spot.z) + 0.6, camp.spot.z), 4) && (!at || Math.hypot(at.x - camp.spot.x, at.z - camp.spot.z) > 20)) {
        const to = dogSpotOf(whereDogs());
        if (dogs.frame !== 'valley' || !dogs.length || !to || !inView(to, 4)) { camp.dispose(); camp = null; dogsDirty = true; maybeMoveDogs(true); }
      }
      maybeMoveDogs();
    }
    // the dogs at home: they get up as you come near (the porch's and the camp's), greet you inside
    if (at && (dogs.frame === 'valley' || nearOn)) {
      if (dogs.frame === 'cabin') { R.toLocal(at.x, at.y, at.z, atL); }
      const here = phase === 'inside' ? { x: me.x, z: me.z, heading: me.yaw + Math.PI } : (phase === 'in' || phase === 'out') && dogs.frame === 'cabin' ? { x: rp.x, z: rp.z, heading: rp.h }
        : dogs.frame === 'cabin' ? { x: atL.x, z: atL.z, heading: (P ? P.heading : 0) - R.yaw } : { x: at.x, z: at.z, heading: P ? P.heading : 0 };
      for (const g of dogs) g.update(dt, here);
    }
    // in town: the card at the door of a cabin still for sale; walking on into the steps goes in
    if (phase === 'town' && P) doorCard(P, dt);
  };
  // at the door: a cabin not bought yet, and not enough gold for it: a card says what it costs and how much more to go
  let cardShown = '';
  function doorCard(P, dt) {
    // (on horseback too, a little further out for the horse's length: the card shows the same, so a rider short of
    // gold always hears why nothing happens at the door)
    const foot = P.mode === 'foot', pd = W.places.cabin.door, near = Math.hypot(P.position.x - pd.x, P.position.z - pd.z) < (foot ? 3.4 : 4.6);
    let html = '';
    if (near && !ownsHome() && rider.gold < PRICES.cabin) {
      html = `<b>This cabin is for sale</b><span class="bmc-price">${COIN}${PRICES.cabin}</span><small>A home of your own: rooms to furnish, a porch, a bed for your dogs.</small><em>${PRICES.cabin - rider.gold} more gold to go</em>`;
    }
    if (html !== cardShown) { cardShown = html; cardEl.innerHTML = html; cardEl.hidden = !html; cardEl.classList.toggle('is-door', !!html); }
    // walking on into the porch steps from the door: in you go (a cabin that is yours)
    if (near && foot && ownsHome() && P.enabled !== false && I.enabled && I.move && I.move.mag > 0.5) {
      R.toLocal(P.position.x, 0, P.position.z, _l);
      const h = wrap((P.heading - R.yaw) - Math.PI);   // (0: facing straight at the door, -z in the cabin's frame)
      pushT = Math.abs(_l.x - FP.doorX) < 1.2 && Math.abs(h) < 0.6 && P.speed < 0.6 ? pushT + dt : 0;
      if (pushT > WALK.push) { pushT = 0; C.enter(); }
    } else pushT = 0;
  }
  C.prompt = () => {
    if (!R || phase !== 'town') return null;
    if (ownsHome()) return 'Go into your cabin';
    return rider.gold >= PRICES.cabin ? `Buy the cabin: ${PRICES.cabin} gold` : null;
  };

  // ── THE CAMERA: in the cabin's frame, written to the valley's camera ──
  const qY = new THREE.Quaternion(), camL = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }, eul = new THREE.Euler(0, 0, 0, 'YXZ');
  const lookM = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);
  function fpQuat(yaw, pitch, out = new THREE.Quaternion()) { eul.set(pitch, yaw, 0, 'YXZ'); return out.setFromEuler(eul); }
  function lookQuat(from, to, out = new THREE.Quaternion()) { lookM.lookAt(from, to, UP); return out.setFromRotationMatrix(lookM); }
  function fpFov() { const a = innerWidth / innerHeight; return a >= 1 ? FP.fov : Math.min(95, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30)) / a))); }
  function setCamera(pos, quat, fov, near) {
    R.toWorld(pos.x, pos.y, pos.z, camera.position);
    qY.setFromAxisAngle(UP, R.yaw); camera.quaternion.copy(qY).multiply(quat);
    const a = innerWidth / innerHeight;
    if (Math.abs(camera.fov - fov) > 1e-3 || camera.near !== near || camera.aspect !== a) { camera.fov = fov; camera.near = near; camera.aspect = a; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }
  // the camera's pose now, in the cabin's frame
  function cameraLocal(out) {
    R.toLocal(camera.position.x, camera.position.y, camera.position.z, out.pos);
    qY.setFromAxisAngle(UP, -R.yaw); out.quat.copy(qY).multiply(camera.quaternion);
    return out;
  }

  // ── FREE MOUSE LOOK (a click on the view while inside; Esc lets go) ──
  // (not under test automation: headless Chrome runs out of memory when a locked pointer is then dragged by a script)
  const onClick = () => { if (phase === 'inside' && !I.touch && !navigator.webdriver && document.pointerLockElement !== canvas) { try { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* (not allowed here) */ } } };
  const onMouse = (e) => { if (phase !== 'inside' || document.pointerLockElement !== canvas || !I.enabled) return; me.yaw -= e.movementX * FP.mouse; me.pitch = THREE.MathUtils.clamp(me.pitch - e.movementY * FP.mouse, -1.4, 1.4); };
  let listening = false;
  function listen(on) {
    if (on === listening) return; listening = on;
    if (on) { canvas.addEventListener('click', onClick); addEventListener('mousemove', onMouse); }
    else { canvas.removeEventListener('click', onClick); removeEventListener('mousemove', onMouse); if (document.pointerLockElement === canvas) document.exitPointerLock(); }
  }

  // ── THE WALK: the rider along a few points (the cabin's frame), feet on the steps and floors ──
  let walk = null;
  function makeWalk(pts) {
    const lens = [0]; for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    const total = lens[lens.length - 1] || 1e-3;
    const at = (s) => {
      s = Math.max(0, Math.min(total, s)); let i = 1; while (i < pts.length - 1 && lens[i] < s) i++;
      const k = (s - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]), a = pts[i - 1], b = pts[i];
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, h: Math.atan2(b.x - a.x, b.z - a.z) };
    };
    return { pts, lens, total, at, s: 0 };
  }
  const feet = (x, z, fromY) => Math.max(R.floorUnder(x, z, fromY), groundLocal(x, z));
  // the rider seen walking: the walk clip at the pace, placed in the valley (P.update is not called meanwhile)
  const rp = { x: 0, y: 0, z: 0, h: 0 };
  function placeRider(P, dt, v) {
    const pe = P.person;
    if (pe) {
      const st = (pe.stride && pe.stride.Walk) || 1.318;
      pe.play(v > 0.08 ? 'Walk' : 'Idle', { fade: 0.25, speed: v > 0.08 ? Math.max(0.6, Math.min(1.5, v / st)) : 1 });
      pe.update(dt);
      R.toWorld(rp.x, rp.y, rp.z, pe.root.position); pe.root.rotation.set(0, rp.h + R.yaw, 0); pe.root.updateMatrixWorld(true);
    }
    R.toWorld(rp.x, 0, rp.z, _w); P.position.set(_w.x, W.heightAt(_w.x, _w.z), _w.z); P.heading = rp.h + R.yaw; P.speed = v;
    W.camTarget.copy(P.position);
  }

  // ── GOING IN ──
  let cam0 = null, chase = null, greetDone = false;
  C.enter = () => {
    if (phase !== 'town' || disposed || !R) return;
    const P = player(); if (!P) return;
    if (!ownsHome()) {
      if (!spend(rider, PRICES.cabin)) { hud.toast(`${PRICES.cabin - rider.gold} more gold for the cabin. Rope some cattle or crack a lock box.`, 'warn'); return; }
      const o = rider.owned || (rider.owned = {}); o.home = 'cabin'; saveRider(rider);
      if (sign) sign.sold();
      hud.toast(`The cabin is yours! −${PRICES.cabin} gold`, 'gold');
      onBuy('cabin');
      dogsDirty = true;
    }
    cardEl.hidden = true; cardShown = '';
    R.keepsakes(keepsakesOf(rider));   // (a keepsake won out in the valley on this ride is hung before the door opens)
    const L = R.toLocal(P.position.x, 0, P.position.z), dx = FP.doorX, foot = R.porch.foot;
    const pts = [{ x: L.x, z: L.z }];
    if (Math.hypot(L.x - dx, L.z - (foot + 0.55)) > 0.3) pts.push({ x: dx, z: foot + 0.55 });
    pts.push({ x: dx, z: 1.05 }, { x: dx, z: 0.3 }, { x: dx, z: WALK.inside });
    walk = makeWalk(pts);
    rp.x = L.x; rp.z = L.z; rp.y = feet(L.x, L.z, 1.2); rp.h = (P.heading || 0) - R.yaw;
    saved.fov = camera.fov; saved.near = camera.near;
    cam0 = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }; cameraLocal(cam0); cam0.fov = camera.fov;
    P.enabled = false; if (P.cam) P.cam.enabled = false; if (P.cancelLasso) P.cancelLasso();
    phase = 'in'; doorTo = doorT; greetDone = false;
    wallsHide(true);
    C.dogWait = R.toWorld(dx + 1.7, 0, foot + 1.4);
    { const D = follower(); if (D) D.tagOn = false; }   // (its name tag shows through walls: hidden while you're in)
    hud.prompt(null); hud.touch(false); hud.el.classList.add('is-home');
    I.takeLook(); I.pick.length = 0;
  };
  // the dogs on their beds come and say hello once you're in
  function greet() {
    if (greetDone) return; greetDone = true;
    if (dogs.frame === 'cabin' && whereDogs() === 'beds') dogs.forEach((h, i) => (h.ready || Promise.resolve()).then(() => setTimeout(() => { if (phase === 'inside') h.greet(i, dogs.length); }, 300 + i * 350)));
  }

  // ── COMING OUT ──
  C.leave = ({ to = null } = {}) => {
    if (phase === 'town' || disposed || !R) return;
    if (to) { finish(to); return; }           // (the menu's "back to town": straight there)
    if (phase !== 'inside') return;
    const P = player(); if (!P) return;
    const dx = FP.doorX, foot = R.porch.foot, pd = W.places.cabin.door, out = R.toLocal(pd.x, 0, pd.z);
    // (first to a spot clear of the door's swing on its line; it opens as the rider gets there)
    walk = makeWalk([{ x: me.x, z: me.z }, { x: dx, z: Math.min(me.z, WALK.inside) }, { x: dx, z: 0.9 }, { x: dx, z: foot + 0.4 }, { x: out.x, z: out.z }]);
    rp.x = me.x; rp.z = me.z; rp.y = me.y; rp.h = me.yaw + Math.PI;
    showFocus(null); hud.prompt(null); listen(false); dotEl.hidden = true;
    // where the chase camera will stand when the rider is down the steps (worked out now, so the slide ends on it)
    chase = null;
    if (P.cam) {
      const end = R.toWorld(out.x, 0, out.z), at = new THREE.Vector3(end.x, W.heightAt(end.x, end.z), end.z), tgt = W.camTarget.clone();
      const keepFov = camera.fov, keepNear = camera.near;
      camera.fov = saved.fov; camera.near = saved.near; camera.updateProjectionMatrix();
      P.cam.enabled = true; P.cam.snap(); P.cam.update(0, { at, heading: R.yaw, onHorse: false, speed: 0 }); P.cam.enabled = false; P.cam.snap();
      chase = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }; cameraLocal(chase);
      W.camTarget.copy(tgt); camera.fov = keepFov; camera.near = keepNear; camera.updateProjectionMatrix();
    }
    phase = 'out';
  };
  function finish(to = null) {
    const P = player();
    phase = 'town'; walk = null; doorTo = 0; C.dogWait = null;
    wallsHide(false);
    { const D = follower(); if (D) D.tagOn = true; }
    focus = null; cardEl.hidden = true; cardShown = ''; hud.prompt(null);
    listen(false); dotEl.hidden = true;
    camera.fov = saved.fov; camera.near = saved.near; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    if (R) R.ghost(null);
    if (P) {
      const s = to || { x: W.places.cabin.door.x, z: W.places.cabin.door.z, rot: R ? R.yaw : pl.rot };
      if (P.person) P.person.fade = 1;
      P.teleport(s.x, s.z, s.rot); P.enabled = true; if (P.cam) { P.cam.enabled = true; P.cam.snap(); }
    }
    I.takeLook(); I.pick.length = 0;
    hud.touch(I.touch); hud.el.classList.remove('is-home');
  }

  // ── WHAT YOU LOOK AT INSIDE: the door, the table, a slot, a keepsake ──
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
  const KEEP_LOOK = { cattle: [1.6, 2.5, -2.7], boxes: [1.75, 1.15, -2.55], sheep: [1.12, 2.3, 0.55], pigs: [2.85, 2.05, -1.9], bandits: [-2.3, 2.35, -1.75], deliveries: [-1.55, 3.0, 0.55], orders: [2.3, 1.65, -0.62], tower: [2.85, 1.75, -0.45], loads: [2.85, 1.75, 0.25], fish: [-0.62, 2.0, -2.75],
    targets: [2.85, 1.75, -1.22], loot: [0.55, 0.35, -2.4] };   // (where each keepsake is looked at: its card shows)
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
    if (f.kind === 'door') { C.leave(); return; }
    if (f.kind === 'slot') {
      const s = SLOT[f.id], r = buyPiece(rider, f.id, spend, saveRider);
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
    R.furnish(owned(), { dogs: homeDogs(rider).filter((d) => !d.following).length });
    R.keepsakes(keepsakesOf(rider));
  }

  // ── EACH FRAME WHILE THE CABIN HAS THE PLAYER ──
  const camP = new THREE.Vector3(), camQ = new THREE.Quaternion(), tq = new THREE.Quaternion(), tp = new THREE.Vector3(), look = new THREE.Vector3();
  let wasLive = false, lastFrame = 0, gold = rider.gold;
  C.update = (dt) => {
    if (phase === 'town' || !R) return;
    const P = player(); if (!P) return;
    dt = Math.min(dt, 0.05);
    if (phase === 'in' || phase === 'out') walkStep(P, dt);
    else insideStep(P, dt);
    if (indoor) indoor.update(phase === 'inside', dt);   // (after the camera is placed)
  };
  function walkStep(P, dt) {
    const w = walk, v = WALK.speed;
    w.s = Math.min(w.total, w.s + v * dt);
    const q = w.at(w.s), u = w.s / w.total;
    rp.x = q.x; rp.z = q.z;
    rp.h += wrap(q.h - rp.h) * (1 - Math.exp(-10 * dt));
    const fy = feet(q.x, q.z, rp.y + 0.45);
    rp.y = fy > rp.y ? THREE.MathUtils.damp(rp.y, fy, 16, dt) : Math.max(fy, rp.y - 3 * dt);
    placeRider(P, dt, w.s < w.total ? v : 0);
    const doorS = w.lens[phase === 'in' ? w.lens.length - 2 : 1];   // (where along the walk the door's line is)
    if (phase === 'in') {
      if (w.s > doorS - WALK.opensAt) doorTo = 1;
      if (w.s > doorS + 0.45) doorTo = 0;
      // the camera: from where it was, round behind the rider, then in through the door to their eyes
      const ka = smooth(0, 0.3, u), kb = smooth(0.5, 0.97, u);
      tp.set(rp.x - Math.sin(rp.h) * WALK.back, rp.y + WALK.up, rp.z - Math.cos(rp.h) * WALK.back);
      look.set(rp.x + Math.sin(rp.h) * 1.6, rp.y + 1.35, rp.z + Math.cos(rp.h) * 1.6);
      lookQuat(tp, look, tq);
      camP.lerpVectors(cam0.pos, tp, ka); camQ.slerpQuaternions(cam0.quat, tq, ka);
      const greeters = whereDogs() === 'beds' && dogs.length;
      camP.lerp(tp.set(rp.x, rp.y + FP.eye, rp.z), kb); camQ.slerp(fpQuat(rp.h + Math.PI, greeters ? -0.2 : -0.05, tq), kb);
      setCamera(camP, camQ, THREE.MathUtils.lerp(cam0.fov, fpFov(), kb), kb > 0.5 ? FP.near : saved.near);
      if (P.person) P.person.fade = 1 - smooth(0.5, 0.82, kb);
      if (w.s >= w.total) {   // in: first person from here
        phase = 'inside';
        me.x = rp.x; me.z = rp.z; me.y = R.floorUnder(rp.x, rp.z, rp.y + 1); me.yaw = rp.h + Math.PI; me.pitch = greeters ? -0.2 : -0.05;
        if (P.person) P.person.fade = 0;
        listen(true); dotEl.hidden = false; wasLive = false;
        I.takeLook(); I.pick.length = 0;
        greet();
        if (!told) { told = true; const n = nextPiece(rider); if (n) hud.toast(n.price <= rider.gold ? `Look round: there's room for ${a(n.name)}.` : `Saving up? Next for the cabin: ${n.name.toLowerCase()}, ${n.price} gold.`, 'gold'); }
      }
    } else {
      if (w.s >= w.lens[1] - 0.25 && w.s < w.lens[2]) doorTo = 1;
      // the camera: out of their eyes to behind them, through the door, and on to where the chase camera will be,
      // looking ahead of them at first and at their head by the end (where the chase camera looks)
      const ke = 1 - smooth(0.08, 0.42, u), kc = chase ? smooth(0.5, 1, u) : 0;
      tp.set(rp.x - Math.sin(rp.h) * WALK.back, rp.y + WALK.up, rp.z - Math.cos(rp.h) * WALK.back);
      if (chase) tp.lerp(chase.pos, kc);
      look.set(rp.x + Math.sin(rp.h) * 1.6, rp.y + 1.35, rp.z + Math.cos(rp.h) * 1.6);
      look.lerp(_l.set(rp.x, rp.y + 1.55, rp.z), kc);
      lookQuat(tp, look, camQ); camP.copy(tp);
      if (kc > 0.995) camQ.copy(chase.quat);
      camP.lerp(tp.set(rp.x, rp.y + FP.eye, rp.z), ke); camQ.slerp(fpQuat(wrap(me.yaw + wrap(rp.h + Math.PI - me.yaw) * smooth(0, 0.25, u)), me.pitch * (1 - smooth(0, 0.25, u)), tq), ke);
      setCamera(camP, camQ, THREE.MathUtils.lerp(fpFov(), saved.fov, smooth(0.08, 0.42, u)), ke > 0.5 ? FP.near : saved.near);
      if (w.s > w.lens[2] && camP.z > 1.0) doorTo = 0;   // (shut behind once the camera is out past it)
      if (P.person) P.person.fade = smooth(0.12, 0.38, u);
      if (w.s >= w.total) finish();
    }
  }
  function insideStep(P, dt) {
    const t = performance.now();
    if (t - lastFrame > 250) wasLive = false;   // (the game stops calling update while paused: drawn again on the first frame back)
    lastFrame = t;
    const live = I.enabled;
    let pushing = false;
    if (live) {
      const l = I.takeLook(), k = I.touch ? FP.touchDrag : FP.drag;
      if (l.dx || l.dy) { me.yaw -= l.dx * k; me.pitch = THREE.MathUtils.clamp(me.pitch - l.dy * k, -1.4, 1.4); }
      I.pick.length = 0; I.takeZoom();
      const f = I.move.y * I.move.mag, s = I.move.x * I.move.mag, len = Math.hypot(f, s);
      if (len > 0.05) {
        const sp = (I.run ? FP.hurry : FP.walk) * dt, sy = Math.sin(me.yaw), cy = Math.cos(me.yaw), n = Math.ceil(sp * len / 0.05);
        const x0 = me.x, z0 = me.z;
        for (let i = 0; i < n; i++) { me.x += (-sy * f + cy * s) * sp / n; me.z += (-cy * f - sy * s) * sp / n; R.pushOut(me, FP); }
        // walking into the shut door: it opens and out you go
        const dz = (-cy * f - sy * s);
        pushing = me.z > 0.22 && Math.abs(me.x - FP.doorX) < 0.5 && dz > 0.6 * len && Math.hypot(me.x - x0, me.z - z0) < sp * len * 0.3;
      } else R.pushOut(me, FP);
      const fl = R.floorUnder(me.x, me.z, me.y + FP.step);
      me.y = fl > me.y ? THREE.MathUtils.damp(me.y, fl, 18, dt) : Math.max(fl, me.y - 4 * dt);
      showFocus(pickFocus(), gold !== rider.gold || !wasLive);
      if (I.tap('KeyE')) act();
    }
    pushT = pushing ? pushT + dt : 0;
    if (pushT > WALK.push) { pushT = 0; C.leave(); return; }
    wasLive = live;
    // the player stands where you are (for everything else in the valley); the rest of the player (the horse) goes on
    R.toWorld(me.x, 0, me.z, _w); P.position.set(_w.x, P.position.y, _w.z);
    P.update(dt);
    if (P.person) P.person.fade = 0;
    setCamera(tp.set(me.x, me.y + FP.eye, me.z), fpQuat(me.yaw, me.pitch, camQ), fpFov(), FP.near);
    gold = rider.gold;
  }
  C.render = () => W.render();

  // ── for rigs and the dev buttons ──
  C.state = () => ({ phase, inside: phase !== 'town', busy: C.busy, home: ownsHome(), at: { x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(2), pitch: +me.pitch.toFixed(2) },
    walk: walk ? { s: +walk.s.toFixed(2), total: +walk.total.toFixed(2) } : null, door: +doorT.toFixed(2),
    focus: focus ? { ...focus } : null, owned: owned(), shown: R ? R.shown : [], keepsakes: keepsakesOf(rider).map((k) => k.job + ':' + k.tier),
    dogs: dogs.map((d) => d.state()), dogsAt: dogsWhere.split(':')[0], sign: sign ? (sign.isSold ? 'sold' : 'for sale') : null, camp: camp ? { x: +camp.spot.x.toFixed(1), z: +camp.spot.z.toFixed(1), local: camp.spot.local } : null,
    near: nearOn, ready: !!R, porch: R ? R.porch : null });
  C.dev = {
    look(x, z, yaw = me.yaw, pitch = me.pitch) { me.x = x; me.z = z; me.yaw = yaw; me.pitch = pitch; if (R) me.y = R.floorUnder(x, z, 2); },
    give(id) { const o = rider.owned || (rider.owned = {}); o.cabin = [...new Set([...ownedPieces(rider), id])]; saveRider(rider); sync(); if (id === 'dogbeds') dogsDirty = true; },
    own(on = true) { const o = rider.owned || (rider.owned = {}); if (on) o.home = 'cabin'; else delete o.home; saveRider(rider); if (!on) { putSign(); putCamp(); } dogsDirty = true; },
    buy(id) { focus = { kind: 'slot', id }; act(); },
    moveDogs() { placeDogs(); },
    get interior() { return R; }, get indoor() { return indoor; }, get camp() { return camp; }, get sign() { return sign; },
  };
  C.dispose = () => {
    disposed = true;
    if (phase !== 'town') finish(null);
    if (indoor) { indoor.update(false); indoor = null; }
    listen(false);
    clearDogs();
    if (sign) { sign.dispose(); sign = null; }
    if (camp) { camp.dispose(); camp = null; }
    if (R) R.dispose();
    R = null;
    ui.remove();
  };
  return C;
}
