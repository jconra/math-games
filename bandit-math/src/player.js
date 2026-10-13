// THE PLAYER: the rider on foot and on their horse, with the chase camera (camera.js) and the lasso (lasso.js).
//
// On foot: WASD or the arrows (or the thumb stick) walk the way the camera looks, Shift runs; the legs are played at the
// speed that matches the ground going by (the clip's speed = how fast they move / how far the clip carries them in a
// second, STRIDE in folk.js), so the feet don't slide. The ground's height comes from the world; buildings, fences, tree
// trunks, cliffs and deep water stop them (the world's blocked()), tested in short steps so nothing is walked through.
//
// The horse: H whistles it over (it trots, or gallops from far off, and stops beside you). E gets on when the rider owns a
// saddle (else a short message says where to get one), and off again. Riding: a walk (2 m/s, a light push on the stick),
// a trot (about 6 m/s: the Walk clip sped up, as the pack has no trot) and, with Shift, a gallop (13 m/s). A horse turns
// like a horse: it can turn tighter slow than fast, eases into and out of a turn, leans into it, slows for a sharp one,
// and pitches with the slope under it. The rider is seated every frame at a fixed offset from the saddle on the horse's
// back bone (seatRider in actors/seat.js) and plays Ride or Ride_Gallop in step with the horse's Walk or Gallop.
//
// The lasso: P.throwLasso(target, { good, onCaught, onMissed }) walks or rides closer first if the target is out of reach
// (about 15 m), turns to it, swings, throws (Lasso_Swing, Lasso_Throw), and the loop flies to the neck (lasso.js). From
// the saddle only the upper body throws: the riding clip keeps the hips and legs and the lasso clip takes the rest.
//
//   const P = makePlayer({ W, scene, folk, animals, rider, input, camera, say })
//     W: the world (src/world.js); scene: where to add things (default W.scene); folk, animals: the loaded libraries
//     (loadFolk, loadAnimals); rider: the saved rider (rider.look, rider.owned.saddle / .horse, from save.js; only read);
//     input: makeInput(canvas); camera: the game's PerspectiveCamera (moved here each frame); say(text): shows a short
//     message (default: a little note at the bottom of the screen); horseAt: { x, z, rot } where the horse waits at
//     first (default: beside the stable door)
//   P.update(dt)        each frame: reads the input, moves, animates, places the camera and keeps W.camTarget on the
//                       player; then the game calls W.update(dt) and W.render()
//   P.position          the player's feet (on the horse: the horse's), a Vector3 kept up to date: read it, don't set it
//   P.heading, P.speed  the way they face (radians, facing (sin, cos)), m/s
//   P.onHorse, P.canRide (owns a saddle), P.horse (the horse, from makeAnimal; null until loaded), P.person, P.cam
//   P.mount(), P.dismount(), P.callHorse()     as E and H do
//   P.horseCameAt  when (performance.now()) a whistled horse last pulled up beside the player
//   P.horsePickedAt  when another horse was last picked at the stable (it waits there);  P.horseComing  whistled, on its way
//   P.downAt       when the rider last got down off the horse
//   P.throwLasso(target, { good, onCaught, onMissed, onLand, onCancel, hold, lead }) -> true if started (false: a throw
//                       is already under way). Moving the player away (keys or stick) while they are still walking up
//                       to a far target, or P.cancelLasso() / P.teleport() before the throw is settled, calls onCancel
//                       instead of onCaught / onMissed. The rest: see lasso.js
//   P.lassoBusy, P.cancelLasso()
//   P.teleport(x, z, rot)   to another place at once (the horse comes along if being ridden)
//   P.refreshOwned()    looks at rider.owned again now (it is also checked a few times a second): a saddle bought puts
//                       it on the horse; another horse swaps it
//   P.setLook(look)     a new look for the rider (a new person, same place)
//   P.state()           what it is doing, for a HUD or a test
//   P.enabled           false: stands still and ignores the keys (a panel is open); the camera still follows
//   P.dispose()
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { makePerson } from './actors/folk.js';
import { makeAnimal, saddleOn, gaitFor } from './actors/animals.js';
import { makeSeat, sideOf } from './actors/seat.js';
import { makeCamera } from './camera.js';
import { makeLasso } from './lasso.js';

export const MOVE = {
  walk: 1.6, run: 4.6,              // on foot, m/s (a brisk walk; Shift: a run)
  footAccel: 9, footTurn: 10,       // m/s each second; radians a second
  horse: {
    walk: 2, trot: 6, gallop: 13,   // m/s
    accel: 3.2, gallopAccel: 4.5, brake: 6,   // m/s each second
    // the fastest it can turn (radians a second) at a speed (m/s): tight at a walk, wide at a gallop
    turn: [[0, 2.3], [2, 2.1], [6, 1.45], [13, 0.9]],
    // the fastest it will go while the way wanted is this far round from where it faces (radians: m/s), easing down
    // between: a slight turn is taken at a gallop, a sharp one at a trot, turning right round at a walk
    turnSpeed: [[0.6, 13], [1.0, 6], [1.6, 3]],
    lean: 0.012,                    // how far it leans into a turn
    come: { gallop: 11, trot: 6, walk: 2, near: 3.0, far: 220 },   // coming when called: speeds, where it stops, and how far
                                    // off it is brought round behind you first (it doesn't cross the whole valley)
  },
  reach: 15, throwFrom: 12,         // the lasso's reach (m); from out of reach, walk or ride up to this
  mountNear: 4.5,                   // E gets on from this close (m)
};
// which clip, how fast, at a speed. On foot: exact (speed / STRIDE). The horse: the animals' own rule (gaitFor in
// actors/animals.js): Walk, then Gallop, each played at speed / its stride, so a hoof that is down stays put. The pack's
// gallop is short-strided (4.55 m/s at speed 1), so the trot (6 m/s) is its gallop at 1.3x, and past about 11 m/s the
// clip stops speeding up (2.4x, the animals' own limit) and the hooves slide a little at the top of a gallop. (Letting
// it go faster measured no better: the pack's gallop slides a little on its own, more the faster it plays.)
export const GAITS = {
  person: { walkBelow: 2.7, least: 0.45, most: 2 },   // (on foot the clips match the ground exactly: speed / STRIDE, kept within least..most)
};
export const SADDLE_FILES = { plain: 'basic', tooled: 'battle', silver: 'fancy' };
// THE MOUNTS the stable has (their names and prices: HORSES and PRICES.horse in shop.js): which animal, a coat tint laid
// over it (makeAnimal's tint), and its own paces (m/s; unset: MOVE.horse's). Each pace is kept to what its clips play
// with the hooves planted (gaitFor: a clip is played at pace / stride, up to `most` times its own speed): the farm
// horse's gallop is short-strided (3.49 m/s at speed 1), so it may play its gallop a little quicker (most) to reach 11;
// the donkey is the slow joke mount. (The bay's and the white's 13 m/s gallop is past their planted top of about
// 11 m/s, as it always was: see GAITS below.)
export const HORSE_LOOKS = {
  bay: { kind: 'horse' },
  white: { kind: 'horseWhite' },
  palomino: { kind: 'horseWhite', tint: '#f3d394' },
  midnight: { kind: 'horse', tint: '#615753' },
  chestnut: { kind: 'farmHorse', walk: 2, trot: 5.5, gallop: 11, most: { Gallop: 3.2 } },
  donkey: { kind: 'donkey', walk: 1.6, trot: 4, gallop: 8 },
};
export const HORSE_KINDS = Object.fromEntries(Object.entries(HORSE_LOOKS).map(([id, h]) => [id, h.kind]));
export const SAY = { saddle: 'You need a saddle - the stable sells them', whistle: 'You whistle for your horse', here: 'Your horse is right here',
  unreachable: "Can't get any closer to that one from here" };

const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lerpTable = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1][1]; };
const saddleLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const SADDLES = {};          // kind -> Promise of the loaded scene (shared; each horse gets a copy)
const GAME = new URL('../', import.meta.url).href;
// the riding clips' parts: the hips and legs (kept from the riding clip while throwing from the saddle), the rest
const LEGS = /^(Root|Body|Hips|UpperLeg[LR]|LowerLeg[LR]|Foot[LR]|PT[LR])\./;
const SWING_S = 1.0;         // Lasso_Swing's length: one turn of the hand overhead (seconds)
const STEP = 1 / 120;        // the longest step the moving is worked out in (a 30 fps frame is taken as four)

// a short note at the bottom of the screen, when the game hasn't given its own way to say things
function defaultSay() {
  let el = null, timer = 0;
  return (text) => {
    if (!el) {
      el = document.createElement('div');
      el.style.cssText = 'position:fixed;left:50%;bottom:12%;transform:translateX(-50%);z-index:30;pointer-events:none;'
        + 'background:rgba(30,20,12,.82);color:#f3e6c8;font:600 16px/1.3 Georgia,serif;padding:9px 16px;border-radius:7px;'
        + 'box-shadow:0 2px 10px rgba(0,0,0,.35);transition:opacity .35s;opacity:0;max-width:86vw;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = text; el.style.opacity = '1'; clearTimeout(timer);
    timer = setTimeout(() => { el.style.opacity = '0'; }, 2600);
  };
}

export function makePlayer({ W, scene = W.scene, folk, animals, rider = {}, input, camera, say = null, horseAt = null, base = GAME }) {
  const tell = say || defaultSay();
  const owned = () => (rider && rider.owned) || {};
  const pos = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const sp = W.places.spawn; pos.set(sp.x, W.heightAt(sp.x, sp.z), sp.z);
  if (input) input.camera = camera;

  const P = {
    position: pos, heading: sp.rot || 0, speed: 0, enabled: true, person: null, horse: null, mode: 'foot',
    get onHorse() { return P.mode === 'horse' || P.mode === 'mounting'; },
    get canRide() { return !!owned().saddle; },
    get lassoBusy() { return !!job || lasso.busy; },
  };
  const cam = P.cam = makeCamera({ camera, W, input });
  const lasso = P.lasso = makeLasso({ scene, W });

  // ── THE PERSON ──────────────────────────────────────────────────────────────────────────────────────────────
  let person = null, seat = null, layer = null, layerName = '', twist = 0;
  function makeRider(look) {
    const p = makePerson(folk, { outfit: 'farmer_m', palette: 'drifter', ...(look || {}) });
    p.root.position.copy(pos); p.root.rotation.y = P.heading; scene.add(p.root);
    return p;
  }
  function setPerson(p) {
    if (person) person.dispose();
    person = P.person = p; seat = makeSeat(person); layer = null; layerName = '';
  }
  setPerson(makeRider(rider && rider.look));
  const has = (name) => person.clips.includes(name);
  const pa = () => person.person;              // (the world's Person under it: its mixer and actions)
  // a clip cut to the hips and legs ('legs') or to the rest ('arms'), made once per person and kept with its actions
  function part(name, which) {
    const key = name + '_' + which, P2 = pa(); if (P2.actions[key]) return key;
    const full = P2.actions[name]; if (!full) return null;
    const clip = full.getClip(), tracks = clip.tracks.filter((t) => LEGS.test(t.name) === (which === 'legs'));
    P2.actions[key] = P2.mixer.clipAction(new THREE.AnimationClip(key, clip.duration, tracks));
    return key;
  }
  // the upper-body layer over the riding clip (null: none)
  function setLayer(name, { once = false, fade = 0.2 } = {}) {
    if (layerName === (name || '')) return;
    if (layer) layer.fadeOut(fade);
    layer = null; layerName = name || '';
    const key = name && part(name, 'arms'); if (!key) return;
    const a = pa().actions[key];
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
    a.setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play(); layer = a;
  }
  // where the rope leaves the right hand: the middle of the fist (halfway from the wrist to the knuckles, and 3 cm on)
  function handPoint(v) {
    const b = person.bones, w = b.WristR, m = b.Middle1R;
    if (!w) return person.root.getWorldPosition(v).setY(v.y + 1.4);
    w.getWorldPosition(v); if (!m) return v;
    m.getWorldPosition(tmp2); tmp2.sub(v);                               // (wrist to knuckles)
    const len = tmp2.length(); v.addScaledVector(tmp2, 0.5 + (len > 1e-4 ? 0.03 / len : 0));
    return v;
  }

  // ── THE HORSE ───────────────────────────────────────────────────────────────────────────────────────────────
  // H: { a: the animal, x, z, heading, speed, yawRate, pitch, roll, mode: 'stand' | 'come' | 'ridden', ... }
  let H = null, horseId = null, saddleKind = null, pendingMount = false, pendingDismount = false;
  let disposed = false;   // set by P.dispose: a horse or saddle still loading then is never added to the scene
  function homeSpot() {
    if (horseAt) return { x: horseAt.x, z: horseAt.z, rot: horseAt.rot || 0 };
    const s = W.places.stable; if (!s) return { x: sp.x + 4, z: sp.z, rot: sp.rot };
    const along = { x: Math.cos(s.rot), z: -Math.sin(s.rot) };       // (along the front, to the building's left)
    for (const d of [4, 5.5, -4, -5.5, 7, -7]) { const x = s.door.x + along.x * d, z = s.door.z + along.z * d; if (clearFor(x, z, s.rot + Math.PI / 2)) return { x, z, rot: s.rot + Math.PI / 2 }; }
    return { x: s.door.x, z: s.door.z, rot: s.rot };
  }
  // room for a horse standing here facing h: its middle, nose and tail clear
  const NOSE = 1.0;                // (the horse's chest, ahead of its middle: kept clear as it moves)
  const clearFor = (x, z, h) => !W.blocked(x, z) && !W.blocked(x + Math.sin(h) * 1.15, z + Math.cos(h) * 1.15) && !W.blocked(x - Math.sin(h) * 1.1, z - Math.cos(h) * 1.1);
  async function makeHorse(id) {
    horseId = id;
    const look = HORSE_LOOKS[id] || HORSE_LOOKS.bay, kind = look.kind;
    try { await animals.need(kind); } catch (e) { console.warn('player: no horse', kind, e); return; }
    if (disposed || horseId !== id) return;                            // (the ride ended, or another was asked for meanwhile)
    const a = makeAnimal(animals, kind, look.tint ? { tint: look.tint } : {});
    if (look.most) a.info = { ...a.info, gait: { ...(a.info.gait || {}), most: { ...((a.info.gait && a.info.gait.most) || {}), ...look.most } } };
    // (another horse picked at the stable waits there, saddled; one swapped while riding is under the rider at once)
    let at = H && P.onHorse ? { x: H.x, z: H.z, rot: H.heading } : homeSpot();
    if (H && !P.onHorse) P.horsePickedAt = performance.now();   // (just bought or picked: E by the stable gets on it)
    if (H) { if (seat.horse === H.a) seat.horse = a; H.a.dispose(); }     // (a new horse while riding: the rider moves across)
    scene.add(a.root);
    H = { a, x: at.x, z: at.z, heading: at.rot, speed: 0, yawRate: 0, pitch: 0, roll: 0, mode: H ? H.mode : 'stand', idleT: 4 + Math.random() * 4, stuck: 0, best: Infinity, gait: 'Idle' };
    P.horse = a; P.horseId = id; saddleKind = null; placeHorse(0);
    refreshSaddle();
  }
  async function refreshSaddle() {
    const want = owned().saddle || null;
    if (!H || want === saddleKind) return;
    saddleKind = want;
    if (!want) { saddleOn(H.a, null); return; }
    const file = SADDLE_FILES[want] || SADDLE_FILES.plain;
    try {
      const sc = await (SADDLES[file] || (SADDLES[file] = saddleLoader.loadAsync(base + 'models/saddles/' + file + '.glb').then((g) => g.scene)));
      if (!disposed && saddleKind === want && H) saddleOn(H.a, sc.clone());
    } catch (e) { console.warn('player: saddle', want, e); saddleKind = null; }
  }
  Object.defineProperty(P, 'horseComing', { get: () => !!H && H.mode === 'come' });
  P.refreshOwned = () => {
    const id = HORSE_LOOKS[owned().horse] ? owned().horse : 'bay';
    if (id !== horseId) makeHorse(id); else refreshSaddle();
  };
  // the paces of the horse being ridden now (m/s): its own, else MOVE.horse's
  const pace = (name) => { const l = HORSE_LOOKS[horseId]; return (l && l[name]) || MOVE.horse[name]; };
  P.refreshOwned();

  // the horse's place, slope and lean, from its x, z and heading
  function placeHorse(dt) {
    const a = H.a, s = Math.sin(H.heading), c = Math.cos(H.heading);
    const y = W.heightAt(H.x, H.z), yf = W.heightAt(H.x + s * 1.1, H.z + c * 1.1), yb = W.heightAt(H.x - s * 1.1, H.z - c * 1.1);
    const pitch = -Math.atan2(yf - yb, 2.2), roll = Math.max(-0.14, Math.min(0.14, -H.yawRate * H.speed * MOVE.horse.lean));
    H.pitch = dt ? damp(H.pitch, pitch, 8, dt) : pitch; H.roll = dt ? damp(H.roll, roll, 5, dt) : roll;
    a.root.position.set(H.x, Math.max(y, (yf + yb) / 2), H.z);
    a.root.rotation.set(H.pitch, H.heading, H.roll, 'YXZ');
  }
  // move a walker (or the horse) by step along direction h, in short steps; it slides along what blocks it.
  // front: also keep this far ahead clear (a horse's nose). Returns how far it got
  function walk(o, h, step, front = 0) {
    const s = Math.sin(h), c = Math.cos(h); let done = 0;
    const n = Math.max(1, Math.ceil(Math.abs(step) / 0.25)), d = step / n;
    const free = (x, z) => !W.blocked(x, z) && (!front || !W.blocked(x + s * front, z + c * front));
    for (let i = 0; i < n; i++) {
      const nx = o.x + s * d, nz = o.z + c * d;
      if (free(nx, nz)) { o.x = nx; o.z = nz; done += Math.abs(d); continue; }
      if (free(nx, o.z)) { o.x = nx; done += Math.abs(s * d); continue; }      // (sliding along a wall or a fence)
      if (free(o.x, nz)) { o.z = nz; done += Math.abs(c * d); continue; }
      break;
    }
    return done;
  }

  // ── WHAT THE PLAYER WANTS: from the keys and stick, or walking up to a lasso target ─────────────────────────────
  // -> { dir: world heading wanted (or null), mag 0..1, run }
  function wanted() {
    if (!P.enabled || !input || !input.enabled) return { dir: null, mag: 0, run: false };
    const m = input.move; if (m.mag < 0.08) return { dir: null, mag: 0, run: input.run };
    // the stick's or keys' push, turned by the camera's yaw: forward is the way the camera looks
    const yaw = cam.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    const wx = fx * m.y + rx * m.x, wz = fz * m.y + rz * m.x;
    return { dir: Math.atan2(wx, wz), mag: m.mag, run: input.run };
  }

  // ── THE LASSO JOB: walk up, turn, throw ──────────────────────────────────────────────────────────────────────
  let job = null;           // { target, opts, t, thrown }
  const targetPos = (t, v) => (t.root ? t.root.getWorldPosition(v) : v.copy(t.position));
  P.throwLasso = (target, opts = {}) => {
    if (job || lasso.busy || !target || seat.busy() || P.mode === 'mounting' || P.mode === 'dismounting') return false;
    job = { target, opts, t: 0, thrown: false };
    return true;
  };
  P.cancelLasso = () => { if (job && !job.thrown && job.opts.onCancel) job.opts.onCancel(); job = null; lasso.cancel(); };
  function startThrow() {
    const o = job.opts; job.thrown = true;
    // the loop overhead turns with the hand: in Lasso_Swing the right hand circles once a second, counterclockwise seen
    // from above, starting out to the right of the head (so the loop lies the way the hand is from that circle's middle)
    const spin = has('Lasso_Swing') ? (t) => (P.onHorse && H ? H.heading + twist : P.heading) + Math.PI * 2 * t / SWING_S - Math.PI / 2 : null;
    lasso.throw({ target: job.target, good: o.good !== false, hold: o.hold, lead: o.lead,
      hand: (v) => handPoint(v), leader: () => pos, spin,
      onLand: o.onLand, onCaught: o.onCaught, onMissed: o.onMissed, onCancel: o.onCancel });
  }
  // the lasso job's say over movement this frame: null (the player's own), or { dir, mag, run, stop }
  function lassoControl(dt, want) {
    if (!job) return null;
    job.t += dt;
    const tp = targetPos(job.target, tmp), d = Math.hypot(tp.x - pos.x, tp.z - pos.z), dir = Math.atan2(tp.x - pos.x, tp.z - pos.z);
    if (!job.thrown) {
      if (want.mag > 0.3 && job.t > 0.25 && d > MOVE.reach) { const f = job.opts.onCancel; job = null; if (f) f(); return null; }   // (walked away from it)
      // getting no nearer (a fence or a building in the way)? given up, with a word, rather than running on the spot
      if (d < (job.best ?? Infinity) - 0.5) { job.best = d; job.stuckT = 0; } else job.stuckT = (job.stuckT || 0) + dt;
      if (job.t > 20 || job.stuckT > 2.5) { const f = job.opts.onCancel; job = null; tell(SAY.unreachable); if (f) f(); return null; }
      if (d > MOVE.reach || (job.closing && d > MOVE.throwFrom)) { job.closing = true;
        return { dir, mag: 1, run: P.onHorse ? d > 40 : d > 8, approach: true }; }
      startThrow();
    }
    if (!lasso.busy) { job = null; return null; }
    job.face = dir;
    // on foot: stand and throw (free to walk again once the loop has landed); on a horse: the rider keeps control
    if (!P.onHorse && (lasso.phase === 'swing' || lasso.phase === 'throw' || lasso.phase === 'fly')) return { dir, mag: 0, run: false, face: true };
    return null;
  }

  // ── KEYS: E and H ───────────────────────────────────────────────────────────────────────────────────────────
  P.callHorse = () => {
    if (!H) return;
    if (P.onHorse) return;
    const d = Math.hypot(H.x - pos.x, H.z - pos.z);
    if (d < MOVE.horse.come.near + 1) { tell(SAY.here); H.mode = 'stand'; return; }
    tell(SAY.whistle);
    if (d > MOVE.horse.come.far) bringRound(40);
    H.mode = 'come'; H.stuck = 0; H.best = Infinity; H.comeT = 0; H.goal = null;
  };
  // the horse put down out of sight behind the camera, `back` metres from the player, to come in from there
  function bringRound(back) {
    const yaw = cam.yaw;
    for (const turn of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, Math.PI]) {
      const h = yaw + Math.PI + turn;
      for (const b of [back, back * 0.7, back * 0.45]) {
        const x = pos.x + Math.sin(h) * b, z = pos.z + Math.cos(h) * b;
        if (clearFor(x, z, h + Math.PI)) { H.x = x; H.z = z; H.heading = h + Math.PI; H.speed = 0; placeHorse(0); return true; }
      }
    }
    return false;
  }
  P.mount = () => {
    if (P.mode !== 'foot' || !H || seat.busy()) return false;
    if (!P.canRide) { tell(SAY.saddle); return false; }
    const d = Math.hypot(H.x - pos.x, H.z - pos.z);
    if (d > MOVE.mountNear) { pendingMount = true; if (H.mode !== 'come') P.callHorse(); return false; }
    if (job && !job.thrown) P.cancelLasso();
    pendingMount = false; H.mode = 'ridden'; H.speed = 0; H.yawRate = 0; P.horsePickedAt = 0;
    P.mode = 'mounting'; P.speed = 0;
    person.play(has('Ride') ? 'Ride' : 'Idle', { fade: 0.25, speed: 0.2 });
    seat.mount(H.a, { time: Math.min(0.75, 0.42 + d * 0.07), onDone: () => { P.mode = 'horse'; P.heading = H.heading; } });   // (a longer hop from further off)
    return true;
  };
  P.dismount = () => {
    if (P.mode !== 'horse' || seat.busy()) return false;
    if (H.speed > 2.5) { pendingDismount = true; return false; }     // (reined in first: off when it has slowed)
    pendingDismount = false; setLayer(null);
    let spot = null;
    for (const side of [1, -1]) { const v = sideOf(H.a, new THREE.Vector3(), side, 1.25); if (!W.blocked(v.x, v.z)) { spot = v; break; } }
    if (!spot) spot = new THREE.Vector3(H.x - Math.sin(H.heading) * 2, 0, H.z - Math.cos(H.heading) * 2);
    spot.y = W.heightAt(spot.x, spot.z);
    P.mode = 'dismounting'; H.mode = 'stand'; H.speed = 0; H.yawRate = 0; H.idleT = 3;
    seat.dismount(spot, { onDone: () => { P.mode = 'foot'; P.downAt = performance.now(); pos.copy(spot); P.heading = H.heading; P.speed = 0; person.root.rotation.set(0, P.heading, 0); person.play('Idle', { fade: 0.25 }); } });
    return true;
  };
  P.teleport = (x, z, rot = P.heading) => {
    const y = W.heightAt(x, z);
    if (P.onHorse && H) { H.x = x; H.z = z; H.heading = rot; H.speed = 0; H.yawRate = 0; placeHorse(0); }
    else { pos.set(x, y, z); P.speed = 0; person.root.position.copy(pos); person.root.rotation.set(0, rot, 0); }
    P.heading = rot; cam.snap(); pendingMount = false; P.cancelLasso();
  };
  P.setLook = (look) => {
    const riding = P.mode === 'horse'; if (riding) P.mode = 'foot';
    setPerson(makeRider(look));
    if (riding) { P.mode = 'mounting'; person.play(has('Ride') ? 'Ride' : 'Idle', { fade: 0 }); seat.mount(H.a, { time: 0.01, onDone: () => { P.mode = 'horse'; } }); }
  };

  // ── EACH FRAME ──────────────────────────────────────────────────────────────────────────────────────────────
  let ownedCheck = 0, groundV = 0;            // (groundV: the ground covered on foot, m/s)
  P.update = (dt) => {
    dt = Math.min(Math.max(dt, 0), 0.1);
    if ((ownedCheck -= dt) <= 0) { ownedCheck = 0.25; P.refreshOwned(); }
    if (P.enabled && input && input.enabled) {
      if (input.tap('KeyE')) { if (P.mode === 'horse') P.dismount(); else if (P.mode === 'foot') P.mount(); }
      if (input.tap('KeyH')) P.callHorse();
    }
    if (pendingMount && H && P.mode === 'foot' && Math.hypot(H.x - pos.x, H.z - pos.z) <= MOVE.mountNear && H.speed < 1) P.mount();
    if (pendingDismount) P.dismount();
    // the moving, in short steps (a long frame is taken as several): the push is read the way the camera looks and the
    // camera swings round behind the way they go, so the two are stepped together, the same at any frame rate
    const n = Math.max(1, Math.ceil(dt / STEP - 1e-6)), h = dt / n;
    for (let i = 0; i < n; i++) {
      let want = wanted();
      if (pendingMount && want.mag > 0.3) pendingMount = false;         // (walked off: not waiting to get on any more)
      const lc = lassoControl(h, want); if (lc) want = lc;
      if (P.mode === 'foot') footStep(h, want);
      else if (P.mode === 'horse') rideStep(h, want);
      if (H && H.mode !== 'ridden') horseAlone(h);
      if (H && (P.mode === 'horse' || P.mode === 'mounting')) { pos.x = H.x; pos.z = H.z; }
      if (P.mode === 'horse' || P.mode === 'foot') cam.swing(h, { heading: P.mode === 'horse' ? H.heading : P.heading, onHorse: P.mode === 'horse', speed: P.mode === 'horse' ? H.speed : P.speed });
    }
    if (H) placeHorse(dt);
    animate(dt);
    if (H) H.a.update(dt);
    person.update(dt);
    syncRide();
    if (P.mode === 'foot') { person.root.position.copy(pos); person.root.rotation.set(0, P.heading, 0); person.root.updateMatrixWorld(true); }
    else { seat.update(dt); turnToThrow(dt); }
    if (P.mode === 'horse' || P.mode === 'mounting') { pos.set(H.x, H.a.root.position.y, H.z); }
    lasso.update(dt);
    cam.update(dt, { at: pos, heading: P.mode === 'horse' ? H.heading : P.heading, onHorse: P.mode === 'horse' || P.mode === 'mounting', speed: P.mode === 'horse' ? H.speed : P.speed });
  };

  function footStep(dt, want) {
    let target = 0;
    if (want.dir !== null) {
      const diff = wrap(want.dir - P.heading);
      P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), MOVE.footTurn * dt));
      target = (want.run ? MOVE.run : MOVE.walk) * Math.min(1, want.mag * 1.25) * (Math.abs(diff) > 1.8 ? 0.3 : 1);
    }
    if (want.face && job && job.face !== undefined) {
      const diff = wrap(job.face - P.heading); P.heading = wrap(P.heading + Math.sign(diff) * Math.min(Math.abs(diff), 8 * dt));
    }
    if (W.waterAt(pos.x, pos.z) > 0.3) target *= 0.55;                 // (wading)
    const v0 = P.speed;
    P.speed = target > P.speed ? Math.min(target, P.speed + MOVE.footAccel * dt) : Math.max(target, P.speed - MOVE.footAccel * 1.5 * dt);
    const v = (v0 + P.speed) / 2;                                      // (the frame's average speed: the same ground covered at any frame rate)
    let got = 0;
    if (v > 0.01) {
      const o = { x: pos.x, z: pos.z }; got = walk(o, P.heading, v * dt);
      if (got < v * dt * 0.3) P.speed = Math.min(P.speed, got / Math.max(dt, 1e-4) + 0.3);   // (held up: ready to set off again)
      pos.x = o.x; pos.z = o.z;
    }
    // the ground really covered (m/s, eased a little): the legs are played from this, so pushing into a wall or deep
    // water stands still rather than walking on the spot, and sliding along a fence walks at the pace it goes
    groundV = damp(groundV, got / Math.max(dt, 1e-4), 25, dt);
    // not through the horse standing there: out to the edge of its body (a line from its rump to its chest, 0.7 m round)
    if (H && H.mode !== 'ridden') {
      const s = Math.sin(H.heading), c = Math.cos(H.heading), ax = H.x - s * 1.0, az = H.z - c * 1.0, bx = H.x + s * 0.9, bz = H.z + c * 0.9;
      const t = Math.max(0, Math.min(1, ((pos.x - ax) * (bx - ax) + (pos.z - az) * (bz - az)) / 3.61));
      const qx = ax + (bx - ax) * t, qz = az + (bz - az) * t, dx = pos.x - qx, dz = pos.z - qz, d = Math.hypot(dx, dz);
      if (d < 0.7) { const k = d > 1e-4 ? (0.7 - d) / d : 0, nx = pos.x + (d > 1e-4 ? dx * k : c * 0.7), nz = pos.z + (d > 1e-4 ? dz * k : -s * 0.7); if (!W.blocked(nx, nz)) { pos.x = nx; pos.z = nz; } }
    }
    pos.y = W.heightAt(pos.x, pos.z);
  }

  function rideStep(dt, want) {
    const M = MOVE.horse;
    let target = 0, wantRate = 0;
    if (pendingDismount) want = { dir: null, mag: 0, run: false };     // (asked to get off: reined in, whatever the keys say)
    if (want.dir !== null) {
      const diff = wrap(want.dir - H.heading), max = lerpTable(M.turn, H.speed);
      wantRate = Math.max(-max, Math.min(max, diff * 3));
      target = want.run ? pace('gallop') : want.mag < 0.55 ? pace('walk') : pace('trot');
      if (want.approach && !want.run) target = pace('trot');
      target = Math.min(target, lerpTable(M.turnSpeed, Math.abs(diff)));   // (slowing for a sharp turn)
    }
    turnHorse(dt, wantRate, want.dir !== null ? 7 : 10);
    if (W.waterAt(H.x, H.z) > 0.3) target *= 0.65;
    const up = target > pace('trot') ? M.gallopAccel : M.accel, v0 = H.speed;
    H.speed = target > H.speed ? Math.min(target, H.speed + up * dt) : Math.max(target, H.speed - M.brake * dt);
    moveHorse(dt, want.dir, v0);
    P.speed = H.speed; P.heading = H.heading;
  }

  // the horse's turn: its rate of turning eased toward the rate wanted (k: how quickly), and its heading moved on by the
  // frame's average rate (so it turns as far in a second at any frame rate)
  function turnHorse(dt, wantRate, k) {
    const r0 = H.yawRate; H.yawRate = damp(H.yawRate, wantRate, k, dt);
    H.heading = wrap(H.heading + (r0 + H.yawRate) / 2 * dt);
  }
  // the horse moved on along its heading. Something in the way ahead (a fence, a wall, a trunk): it turns along it, the
  // nearest way either side that is clear (first the side the rider wants), slowing to a walk, as a horse veers off a
  // fence; with no way clear it stops. want: the heading wanted (or null); v0: its speed at the start of the frame (it
  // moves on by the frame's average speed)
  function moveHorse(dt, want, v0 = H.speed) {
    if (H.speed <= 0.01 && v0 <= 0.01) return;
    const reach = NOSE + Math.min(1.6, H.speed * 0.12);
    // (points all along the way ahead: a fence's band or a thin trunk can sit anywhere between its middle and its nose)
    const ahead = (h) => { const s = Math.sin(h), c = Math.cos(h); for (const d of [0.1, 0.25, 0.45, NOSE, reach]) if (W.blocked(H.x + s * d, H.z + c * d)) return true; return false; };
    if (ahead(H.heading)) {
      const first = want === null ? 1 : Math.sign(wrap(want - H.heading)) || 1;
      let turn = null;
      for (const t of [0.3, 0.6, 0.9, 1.3, 1.8, 2.4]) {
        for (const side of [first, -first]) { if (!ahead(H.heading + t * side)) { turn = t * side; break; } }
        if (turn !== null) break;
      }
      if (turn !== null) { H.heading = wrap(H.heading + Math.sign(turn) * Math.min(Math.abs(turn), 3 * dt)); H.speed = Math.min(H.speed, MOVE.horse.walk + 1.5); }
      else H.speed = Math.max(0, H.speed - 25 * dt);
      v0 = H.speed;
    }
    const v = (v0 + H.speed) / 2, o = { x: H.x, z: H.z }, got = walk(o, H.heading, v * dt, NOSE);
    if (got < v * dt * 0.3) H.speed = got / Math.max(dt, 1e-4);   // (stopped by it: stands, rather than walking on the spot)
    H.x = o.x; H.z = o.z;
  }

  // the horse on its own: standing about (now and then grazing), or coming when called
  function horseAlone(dt) {
    const M = MOVE.horse, C = M.come;
    if (H.mode === 'come') {
      H.comeT += dt;
      const d = Math.hypot(pos.x - H.x, pos.z - H.z);
      // where it means to stop: beside the player, the player at its left side (where a rider gets on), standing the way
      // it came in; worked out afresh while it is far off, then kept (unless the player moves off) so it can settle
      if (!H.goal || d > 12 || Math.hypot(pos.x - H.goal.px, pos.z - H.goal.pz) > 2.5) {
        const ux = (pos.x - H.x) / (d || 1), uz = (pos.z - H.z) / (d || 1), lx = uz, lz = -ux;   // (l: its left as it comes)
        H.goal = { x: pos.x - ux * 0.4 - lx * 1.7, z: pos.z - uz * 0.4 - lz * 1.7, px: pos.x, pz: pos.z };
        if (W.blocked(H.goal.x, H.goal.z)) { H.goal.x = pos.x - ux * 0.4 + lx * 1.7; H.goal.z = pos.z - uz * 0.4 + lz * 1.7; }
        if (W.blocked(H.goal.x, H.goal.z)) { H.goal.x = pos.x - ux * 2.6; H.goal.z = pos.z - uz * 2.6; }
      }
      const dx = H.goal.x - H.x, dz = H.goal.z - H.z, gd = Math.hypot(dx, dz);
      let target = gd > 30 ? Math.min(C.gallop, pace('gallop')) : gd > 10 ? Math.min(C.trot, pace('trot')) : Math.min(C.walk, pace('walk'), gd * 1.2);
      if (gd <= 0.8 || d < 1.6) { target = 0; if (H.speed < 0.3) { H.mode = 'stand'; H.idleT = 6; H.goal = null; P.horseCameAt = performance.now(); } }
      // steer: straight for the player if the way is clear, else the nearest clear heading either side
      const want = Math.atan2(dx, dz); let h = want;
      for (const t of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.7, -1.7, 2.3, -2.3]) {
        const g = want + t, s = Math.sin(g), c = Math.cos(g);
        if (!W.blocked(H.x + s * 2, H.z + c * 2) && !W.blocked(H.x + s * 4, H.z + c * 4)) { h = g; break; }
      }
      const diff = wrap(h - H.heading), max = lerpTable(M.turn, H.speed);
      turnHorse(dt, Math.max(-max, Math.min(max, diff * 3)), 7);
      if (Math.abs(diff) > 1.4 && gd > 2) target = Math.min(target, C.walk);
      if (gd < 2.5 && Math.abs(diff) > 1.2) target = 0;            // (right beside the spot but facing away: just stop)
      const v0 = H.speed;
      H.speed = target > H.speed ? Math.min(target, H.speed + M.gallopAccel * dt) : Math.max(target, H.speed - M.brake * dt);
      moveHorse(dt, h, v0);
      // stuck behind something: getting no nearer for a few seconds? brought round behind the player instead
      if (d < H.best - 1) { H.best = d; H.stuck = 0; } else H.stuck += dt;
      if (H.stuck > 3.5 && d > C.near + 2) { bringRound(Math.min(25, d)); H.stuck = 0; H.best = Infinity; H.goal = null; }
    } else {
      const v0 = H.speed; H.speed = Math.max(0, H.speed - M.brake * dt); H.yawRate = damp(H.yawRate, 0, 6, dt);
      moveHorse(dt, null, v0);
      // now and then a different idle: head down to graze, a shake
      if (H.speed < 0.2 && (H.idleT -= dt) <= 0) {
        const pick = Math.random(); H.idleT = 5 + Math.random() * 7;
        H.idle = pick < 0.45 ? 'Eating' : pick < 0.65 ? 'Idle_Headlow' : pick < 0.8 ? 'Idle_2' : 'Idle';
      }
    }
  }

  // ── CLIPS ───────────────────────────────────────────────────────────────────────────────────────────────────
  function horseGait() {
    const v = H.speed, a = H.a;
    // (an idle this animal has no clip for, the farm horse's grazing: it just stands)
    if (v < 0.2) { const idle = H.mode === 'ridden' ? 'Idle' : (H.idle || 'Idle'); a.play(a.actions[idle] ? idle : 'Idle', { fade: 0.35 }); H.gait = 'Idle'; H.clipSpeed = 0.2; return; }
    H.idle = null;
    const [clip, speed] = gaitFor(a, v, H.gait);
    H.gait = clip || 'Walk'; H.clipSpeed = speed;
    a.play(H.gait, { fade: 0.3, speed });
  }
  function personGait() {
    const G = GAITS.person, v = groundV;
    if (v < 0.12) return ['Idle', 1];
    // the clip's speed = how fast they go / how far the clip carries them in a second at speed 1 (STRIDE): no sliding feet
    const st = person.stride || { Walk: 1.318, Run: 2.994 }, run = v >= G.walkBelow;
    return run ? ['Run', Math.max(G.least, Math.min(G.most, v / st.Run))] : ['Walk', Math.max(G.least, Math.min(G.most, v / st.Walk))];
  }
  // which lasso clip the throw's phase calls for (null: none); with stand-ins when the Blender clips aren't there
  function lassoClip() {
    const ph = lasso.phase;
    if (ph === 'swing') return has('Lasso_Swing') ? ['Lasso_Swing', false] : ['Wave', false];
    if (ph === 'throw' || ph === 'fly' || (ph === 'tangle' && lasso.t < 0.5)) return has('Lasso_Throw') ? ['Lasso_Throw', true] : ['Interact', true];
    if (ph === 'catch' || ph === 'held') return has('Lasso_Pull') ? ['Lasso_Pull', false] : null;
    return null;
  }
  function animate() {
    if (H) horseGait();
    const lc = lassoClip();
    if (P.mode === 'foot') {
      const [g, s] = personGait();
      if (lc && (g === 'Idle' || lasso.phase !== 'held')) person.play(lc[0], { fade: 0.2, once: lc[1] });
      else person.play(g, { fade: 0.25, speed: s });
    } else if (P.mode === 'horse') {
      if (!has('Ride')) { person.play('Idle', { fade: 0.25 }); return; }
      // the rider's clip at the horse's clip speed (Ride is as long as the bay's Walk, Ride_Gallop as its Gallop); a
      // horse whose loop is longer or shorter (the farm horse, the donkey) has the rider's clip sped to keep in step
      const ride = H.gait === 'Gallop' ? 'Ride_Gallop' : 'Ride', s = H.gait === 'Idle' ? 0.2 : (H.clipSpeed || 1) * loopRatio(ride);
      if (lc) { person.play(part(ride, 'legs'), { fade: 0.2, speed: s }); setLayer(lc[0], { once: lc[1] }); }
      else { person.play(ride, { fade: 0.25, speed: s }); setLayer(null); }
    }
  }
  // the rider's clip kept in step with the horse's (both loops are as long): the same place in the stride
  function syncRide() {
    if (P.mode !== 'horse' || !H) return;
    const ha = H.a.actions[H.a.clip], ra = pa().cur;
    if (!ha || !ra || H.gait === 'Idle') return;
    const d = ra.getClip().duration, hd = ha.getClip().duration;
    if (Math.abs(d - hd) < 0.02) ra.time = ha.time % d;
    else if (ra.getClip().name.startsWith('Ride')) ra.time = (ha.time % hd) / hd * d;   // (the same share of the stride)
  }
  // the rider's loop over the horse's (the same gait's), so the two go round together
  function loopRatio(ride) {
    const ra = pa().actions[ride], ha = H && H.a.actions[H.gait === 'Gallop' ? 'Gallop' : 'Walk'];
    return ra && ha ? ra.getClip().duration / ha.getClip().duration : 1;
  }
  // from the saddle, the body turns at the waist toward what it is throwing at (up to about 75 degrees either way)
  const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _iq = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  function turnToThrow(dt) {
    const ph = lasso.phase, on = P.mode === 'horse' && job && ph !== 'idle' && ph !== 'reel';
    let want = 0;
    if (on) { const tp = targetPos(job.target, tmp); want = Math.max(-1.3, Math.min(1.3, wrap(Math.atan2(tp.x - pos.x, tp.z - pos.z) - H.heading))); }
    twist = damp(twist, want, 6, dt);
    const b = person.bones.Abdomen; if (!b || Math.abs(twist) < 0.01) return;
    b.parent.getWorldQuaternion(_pq);
    _q.setFromAxisAngle(Y, twist); b.quaternion.premultiply(_iq.copy(_pq).invert().multiply(_q).multiply(_pq));   // (about the world's up, in its parent's frame)
    b.updateMatrixWorld(true);
  }

  P.state = () => ({
    mode: P.mode, speed: +P.speed.toFixed(2), heading: +P.heading.toFixed(3), x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), clip: person.clip,
    layer: layerName, lasso: lasso.phase, job: job ? (job.thrown ? 'thrown' : 'approach') : null,
    horse: H ? { id: horseId, kind: H.a.kind, mode: H.mode, x: +H.x.toFixed(2), z: +H.z.toFixed(2), speed: +H.speed.toFixed(2), gait: H.gait, clip: H.a.clip, clipSpeed: +(H.clipSpeed || 0).toFixed(2), saddle: saddleKind, dist: +Math.hypot(H.x - pos.x, H.z - pos.z).toFixed(2) } : null,
    canRide: P.canRide, cam: { yaw: +cam.yaw.toFixed(3), pitch: +cam.pitch.toFixed(3), zoom: +cam.zoom.toFixed(2) },
  });
  P.dispose = () => { disposed = true; lasso.dispose(); person.dispose(); if (H) H.a.dispose(); };
  return P;
}
