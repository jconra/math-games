// THE PLAYER: the rider on foot and on their horse, with the chase camera (camera.js) and the lasso (lasso.js).
//
// On foot: WASD or the arrows (or the thumb stick) walk the way the camera looks, Shift runs; the legs are played at the
// speed that matches the ground going by (the clip's speed = how fast they move / how far the clip carries them in a
// second, STRIDE in folk.js), so the feet don't slide. The ground's height comes from the world; buildings, fences, tree
// trunks, cliffs and deep water stop them (the world's blocked()), tested in short steps so nothing is walked through.
//
// The horse: H whistles it over (it trots, or gallops from far off, and stops beside you). E gets on when the rider owns a
// saddle (else a short message says where to get one), and off again. Riding: a walk (2 m/s on the bay, a light push on
// the stick), a trot (6 m/s on the bay: the Gallop clip played slowly, as the pack has no trot) and, with Shift, a gallop
// (13 m/s on the bay; each of the stable's horses has its own paces and size: src/catalog.js LADDER). A horse turns
// like a horse: it can turn tighter slow than fast, eases into and out of a turn, leans into it, slows for a sharp one,
// and pitches with the slope under it. The rider is seated every frame at a fixed offset from the saddle on the horse's
// back bone (seatRider in actors/seat.js) and plays Ride or Ride_Gallop in step with the horse's Walk or Gallop.
//
// The six-shooter (a rider whose grown-up turned it on, and who bought it: src/gun.js): P.shoot(target, ...) works as
// the throw does, from farther off, with the gun in the rider's own right hand (src/sixgun.js).
// The lasso: P.throwLasso(target, { good, onCaught, onMissed }) walks or rides closer first if the target is out of reach
// (about 15 m), turns to it, swings, throws (Lasso_Swing, Lasso_Throw), and the loop flies to the neck (lasso.js). From
// the saddle only the upper body throws: the riding clip keeps the hips and legs and the lasso clip takes the rest.
//
//   const P = makePlayer({ W, scene, folk, animals, rider, input, camera, say })
//     W: the world (src/world.js); scene: where to add things (default W.scene); folk, animals: the loaded libraries
//     (loadFolk, loadAnimals); rider: the saved rider (rider.look, rider.owned.saddle / .horse and the rider's own horses:
//     src/mounts.js; only read);
//     input: makeInput(canvas); camera: the game's PerspectiveCamera (moved here each frame); say(text): shows a short
//     message (default: a little note at the bottom of the screen); horseAt: { x, z, rot } where the horse waits at
//     first (default: beside the stable door)
//   P.update(dt)        each frame: reads the input, moves, animates, places the camera and keeps W.camTarget on the
//                       player; then the game calls W.update(dt) and W.render()
//   P.position          the player's feet (on the horse: the horse's), a Vector3 kept up to date: read it, don't set it
//   P.heading, P.speed  the way they face (radians, facing (sin, cos)), m/s
//   P.onHorse, P.canRide (owns a saddle and a horse), P.horse (the horse, from makeAnimal; null until loaded, and while
//   the rider has none: every rider starts on foot), P.person, P.cam
//   P.mount(), P.dismount(), P.callHorse()     as E and H do
//   P.horseCameAt  when (performance.now()) a whistled horse last pulled up beside the player
//   P.horsePickedAt  when another horse was last picked at the stable (it waits there);  P.horseComing  whistled, on its way
//   P.downAt       when the rider last got down off the horse
//   P.horseEat(s)  a treat handed over: the standing horse munches for s seconds (false: it isn't standing still)
//   P.eager        set while the ridden horse has full hearts (src/feeding.js): it comes faster to the whistle
//   P.throwLasso(target, { good, onCaught, onMissed, onLand, onCancel, hold, lead }) -> true if started (false: a throw
//                       is already under way). Moving the player away (keys or stick) while they are still walking up
//                       to a far target, or P.cancelLasso() / P.teleport() before the throw is settled, calls onCancel
//                       instead of onCaught / onMissed. The rest: see lasso.js
//   P.lassoBusy, P.cancelLasso()
//   P.shoot(target, { good, onFire, onLand, onCancel }) -> true if started: the six-shooter for bandits (src/gun.js,
//                       src/sixgun.js), as the lasso: rides or walks up first if the target is out of the gun's reach
//                       (GUNPLAY.reach), turns to it, brings the gun up in the right hand (the gun clip: the upper body
//                       only from the saddle) and fires; onFire() at the shot (the job plays the sound), onLand(good) as
//                       the bullet gets there (the job knocks him down, or he ducks). The gun stays up a moment, then is
//                       put away. Cancelled as the lasso is (P.cancelLasso: onCancel, if it hasn't fired yet)
//   P.gunBusy           the gun is being brought up or has just fired
//   P.teleport(x, z, rot)   to another place at once (the horse comes along if being ridden)
//   P.moveHorse(x, z)   the horse left standing (not ridden) moved there at once (false: none, or being ridden)
//   P.shift({ dx, dy, dz })  moved as it stands, the horse and the camera with it (the way round at the valley's ends)
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
import { makeAnimal, saddleOn, gaitFor, GAIT } from './actors/animals.js';
import { makeHorse as makeSteed, HORSE_KIND, onHorseDial } from './actors/horses.js';
import { PRESETS } from './actors/horsecoats.js';
import { makeSeat, sideOf } from './actors/seat.js';
import { LADDER } from './catalog.js';
import { horseLook, ridden } from './mounts.js';
import { makeCamera } from './camera.js';
import { makeLasso } from './lasso.js';
import { makeHeldGun } from './sixgun.js';
import { GUNPLAY } from './gun.js';
import { pushFromWagons } from './wagon.js';

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
// how big the player and the horse are to a wagon (m; src/wagon.js pushFromWagons): on foot, round the feet; the horse,
// circles along it (at these metres ahead of its middle: from the head to the rump)
export const WAGON_R = { foot: 0.35, horse: 0.45, along: [1.2, 0.3, -0.6, -1.0] };
// which clip, how fast, at a speed. On foot: exact (speed / STRIDE). The horse: the animals' own rule (gaitFor in
// actors/animals.js): Walk, then Gallop, each played at speed / its stride, so a hoof that is down stays put. The pack's
// gallop is short-strided (4.55 m/s at speed 1, times the horse's size), so the trot (6 m/s x size) is its gallop at
// 1.3x. The animals' own limit (2.4x) would stop the clip speeding up past about 10.9 m/s x size and the hooves would
// slide at the top of a gallop, so each of the stable's horses may play its gallop as fast as its own top speed needs
// (gallopCap below: 2.78x for Copper to 3.15x for Midnight), and its hooves stay planted. ?gallopcap=2.4 in the address
// puts every horse back on the old limit, to watch the two side by side.
export const GAITS = {
  person: { walkBelow: 2.7, least: 0.45, most: 2 },   // (on foot the clips match the ground exactly: speed / STRIDE, kept within least..most)
};
export const SADDLE_FILES = { plain: 'basic', tooled: 'battle', silver: 'fancy' };
// THE MOUNTS the stable has (their names and prices: HORSES and PRICES.horse in catalog.js; what each one is: LADDER
// there): which animal (the steed, the new horse, or the donkey), its coat (a preset in actors/horsecoats.js) and size,
// and its paces (m/s): the price buys size and speed. The donkey is the slow joke mount, as he was.
export const HORSE_LOOKS = Object.fromEntries(Object.entries(LADDER).map(([id, L]) => [id, { ...L }]));
export const HORSE_KINDS = Object.fromEntries(Object.entries(HORSE_LOOKS).map(([id, h]) => [id, h.kind]));
// the fastest a horse's gallop clip may play (times its own speed): planted at its own top speed (its gallop over its
// gallop stride), never under the animals' own limit; ?gallopcap=2.4 puts every horse on the old limit instead
const GALLOP_CAP = (() => { try { const v = +new URLSearchParams(location.search).get('gallopcap'); return v > 0 ? v : null; } catch (e) { return null; } })();
export function gallopCap(look, stride) {
  if (GALLOP_CAP) return GALLOP_CAP;
  return Math.max(GAIT.most.Gallop, Math.ceil(look.gallop / stride * 100) / 100);
}
// the turn table and the speed allowed while turning, reaching a fast horse's own gallop: its top speed turns as the
// bay's 13 m/s did, and a slight turn is still taken at full gallop
export function turnTables(gallop, M = MOVE.horse) {
  const g = Math.max(gallop || 0, M.turn[M.turn.length - 1][0]);
  return { turn: [...M.turn.slice(0, -1), [g, M.turn[M.turn.length - 1][1]]], turnSpeed: [[M.turnSpeed[0][0], Math.max(g, M.turnSpeed[0][1])], ...M.turnSpeed.slice(1)] };
}
// the standing horse's idles, now and then (its share of the picks): grazing, head low, a shake, and (the steed) a look
// left or right or an ear flick, played once
// the old pack horse dressed as near a coat as it goes (the governor's 'old' horse, the potato start: world/governor.js):
// the pack's white horse for a grey or a light coat (tinted with the coat's colour, paled), its brown one for a bay or a
// chestnut, and darker for a black
function oldPackOf(look) {
  const r = typeof look.coat === 'string' ? (PRESETS[look.coat] || PRESETS.bay) : (look.coat || PRESETS.bay);
  const hex = /^#[0-9a-f]{6}$/i.test(r.base || '') ? r.base : '#7a3f20', n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  if ((r.grey || 0) > 0.4) return { kind: 'horseWhite' };
  if (lum > 0.4) return { kind: 'horseWhite', tint: '#' + c.map((v) => Math.round(v + (255 - v) * 0.45).toString(16).padStart(2, '0')).join('') };
  if (lum < 0.1) return { kind: 'horse', tint: '#615753' };
  return { kind: 'horse' };
}
// a horse with full hearts (src/treats.js BOND), whistled: it gallops at its own top speed from this far (m) off, trots
// from this far, and trots and walks this much faster than the usual come
const EAGER = { gallopPast: 16, trotPast: 6, trot: 1.25, walk: 1.4 };
const IDLES = [['Eating', 0.4], ['Idle_Headlow', 0.15], ['Idle_2', 0.12], ['LookLeft', 0.08], ['LookRight', 0.08], ['EarFlick', 0.07], ['Idle', 0.1]];
const ONCE = new Set(['LookLeft', 'LookRight', 'EarFlick']);
export const SAY = { saddle: 'You need a saddle - the stable sells them', whistle: 'You whistle for your horse', here: 'Your horse is right here',
  unreachable: "Can't get any closer to that one from here",
  noHorse: "No horse to whistle for yet - the stable sells them, Jasper the donkey for 30 gold" };   // (every rider starts on foot)

const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lerpTable = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1][1]; };
const saddleLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const SADDLES = {};          // kind -> Promise of the loaded scene (shared; each horse gets a copy)
const GAME = new URL('../', import.meta.url).href;
// the riding clips' parts: the hips and legs (kept from the riding clip while throwing from the saddle), the rest
const LEGS = /^(Root|Body|Hips|UpperLeg[LR]|LowerLeg[LR]|Foot[LR]|PT[LR])\./;
const SWING_S = 1.0;         // Lasso_Swing's length: one turn of the hand overhead (seconds)
const GUN_CLIP = 'Idle_Gun_Pointing';   // the six-shooter held out (the range's hand is posed in it too: src/revolver.js)
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
    get canRide() { return !!owned().saddle && !!ridden(rider); },   // (a saddle, and a horse to put it on)
    get lassoBusy() { return !!job || lasso.busy; },
  };
  const cam = P.cam = makeCamera({ camera, W, input });
  const lasso = P.lasso = makeLasso({ scene, W });

  // ── THE PERSON ──────────────────────────────────────────────────────────────────────────────────────────────
  let person = null, seat = null, layer = null, layerName = '', twist = 0, held = null;
  function makeRider(look) {
    const p = makePerson(folk, { outfit: 'farmer_m', palette: 'drifter', ...(look || {}) });
    p.root.position.copy(pos); p.root.rotation.y = P.heading; scene.add(p.root);
    return p;
  }
  function setPerson(p) {
    if (person) person.dispose();
    person = P.person = p; seat = makeSeat(person); layer = null; layerName = '';
    if (held) { held.show(false); held.fitted = null; }   // (the six-shooter goes into the new body's hand the next time it is up)
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
  let H = null, horseId = null, saddleKind = null, pendingMount = false, pendingDismount = false, dismountSpot = null;
  let disposed = false;   // set by P.dispose: a horse or saddle still loading then is never added to the scene
  let playerMade = false; // (set once the player is made: a horse that appears after that was just bought)
  function homeSpot() {
    if (horseAt) return { x: horseAt.x, z: horseAt.z, rot: horseAt.rot || 0 };
    const s = W.places.stable; if (!s) return { x: sp.x + 4, z: sp.z, rot: sp.rot };
    const along = { x: Math.cos(s.rot), z: -Math.sin(s.rot) };       // (along the front, to the building's left)
    for (const d of [4, 5.5, -4, -5.5, 7, -7]) { const x = s.door.x + along.x * d, z = s.door.z + along.z * d; if (clearFor(x, z, s.rot + Math.PI / 2)) return { x, z, rot: s.rot + Math.PI / 2 }; }
    return { x: s.door.x, z: s.door.z, rot: s.rot };
  }
  // room for a horse standing here facing h: its middle, nose and tail clear. BODY: how big the horse is against the bay
  // (a steed's size; the donkey 1, as he always was): every metre round the horse's body below grows with it
  let BODY = 1;
  const NOSE = 1.0;                // (the bay's chest, ahead of its middle: kept clear as it moves; times BODY)
  const clearFor = (x, z, h) => !W.blocked(x, z) && !W.blocked(x + Math.sin(h) * 1.15 * BODY, z + Math.cos(h) * 1.15 * BODY) && !W.blocked(x - Math.sin(h) * 1.1 * BODY, z - Math.cos(h) * 1.1 * BODY);
  // the look of a horse id: the stable's ladder or one of the rider's own (src/mounts.js); any id it doesn't know rides
  // the bay
  const lookOf = (id) => horseLook(rider, id);
  async function makeHorse(id) {
    horseId = id;
    const look = lookOf(id) || HORSE_LOOKS.donkey, kind = look.kind;
    // (the governor's horse dial at 'old': the old pack horse instead of the new one, at the same size and paces)
    const asOld = kind === HORSE_KIND && !!dial && dial.player === 'old', pack = asOld ? oldPackOf(look) : null;
    try { await animals.need(pack ? pack.kind : kind); } catch (e) { console.warn('player: no horse', kind, e); return; }
    if (disposed || horseId !== id) return;                            // (the ride ended, or another was asked for meanwhile)
    // the new horse (actors/horses.js: its coat, its far look, its hair) at its size; the donkey as he is
    const steed = kind === HORSE_KIND && !asOld ? makeSteed(animals, { recipe: look.coat || 'bay', size: look.size || 1, tier: (dial && dial.look) || W.tier }) : null;
    const a = steed ? steed.a : pack ? makeAnimal(animals, pack.kind, { size: look.size || 1, ...(pack.tint ? { tint: pack.tint } : {}) }) : makeAnimal(animals, kind, look.tint ? { tint: look.tint } : {});
    const most = look.most || (steed || pack ? { Gallop: gallopCap(look, a.stride.Gallop) } : null);
    if (most) a.info = { ...a.info, gait: { ...(a.info.gait || {}), most: { ...((a.info.gait && a.info.gait.most) || {}), ...most } } };
    // (another horse picked at the stable waits there, saddled; one swapped while riding is under the rider at once)
    let at = H && P.onHorse ? { x: H.x, z: H.z, rot: H.heading } : homeSpot();
    if ((H || playerMade) && !P.onHorse) P.horsePickedAt = performance.now();   // (just bought or picked, the first one too: E by the stable gets on it)
    if (H) { if (seat.horse === H.a) seat.horse = a; if (H.steed) H.steed.dispose(); else H.a.dispose(); }     // (a new horse while riding: the rider moves across)
    BODY = steed || pack ? a.size : 1; TURN = turnTables(look.gallop); builtAs = pack ? 'old' : 'new';
    scene.add(a.root);
    H = { a, steed, big: !!(steed || pack), x: at.x, z: at.z, heading: at.rot, speed: 0, yawRate: 0, pitch: 0, roll: 0, mode: H ? H.mode : 'stand', idleT: 4 + Math.random() * 4, stuck: 0, best: Infinity, gait: 'Idle' };
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
    const id = ridden(rider);
    if (id === horseId) { refreshSaddle(); return; }
    if (id) { makeHorse(id); return; }
    // (no horse: on foot until one is bought)
    horseId = null; P.horseId = null;
    if (H && !P.onHorse) { if (H.steed) H.steed.dispose(); else H.a.dispose(); H = null; P.horse = null; }
  };
  let saidNoHorse = 0;   // (when the rider was last told there's no horse yet: not every key press)
  const noHorse = () => { if (ridden(rider) || performance.now() - saidNoHorse < 4000) return; saidNoHorse = performance.now(); tell(SAY.noHorse); };
  // the paces of the horse being ridden now (m/s): its own, else MOVE.horse's; its turn tables (turnTables)
  const pace = (name) => { const l = lookOf(horseId); return (l && l[name]) || MOVE.horse[name]; };
  let TURN = turnTables(MOVE.horse.gallop);
  // THE GOVERNOR'S HORSE DIAL (actors/horses.js horseDial): the new horse's look distances, and on the weakest machines
  // the player's own horse the old pack horse. It changes only at a hiding moment (a menu, the title, the cabin, the end
  // mist), so the horse is swapped there and then (read before the first horse is made: the call comes at once)
  let dial = null, builtAs = null;
  const offDial = onHorseDial(W, (v) => {
    const was = dial; dial = v;
    if (H && H.steed) H.steed.setLook(v.look);
    const want = v.player === 'old' ? 'old' : 'new', L = horseId && lookOf(horseId);
    if (was && H && L && L.kind === HORSE_KIND && builtAs && builtAs !== want) { const id = horseId; horseId = null; makeHorse(id); }
  });
  P.refreshOwned(); playerMade = true;

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

  let fpFaded = false;   // (the body faded for first person: src/camera.js FIRST)
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
  P.cancelLasso = () => {
    if (job && (!job.thrown || (job.gun && !gunS.fired)) && job.opts.onCancel) job.opts.onCancel();
    if (job && job.gun) { gunS.phase = 'idle'; gunS.up = 0; }
    job = null; lasso.cancel();
  };
  // THE SIX-SHOOTER: gunS.phase 'idle' | 'draw' (coming up, turning to him) | 'fly' (fired: the bullet on its way);
  // up: seconds the gun stays in the hand; target: what it is pointed at
  const gunS = { phase: 'idle', t: 0, up: 0, target: null, fired: false, fly: 0 };
  P.shoot = (target, opts = {}) => {
    if (job || lasso.busy || !target || seat.busy() || P.mode === 'mounting' || P.mode === 'dismounting' || gunS.phase !== 'idle') return false;
    job = { target, opts, t: 0, thrown: false, gun: true };
    return true;
  };
  Object.defineProperty(P, 'gunBusy', { get: () => gunS.phase !== 'idle' });
  function startShot() {
    job.thrown = true;
    gunS.phase = 'draw'; gunS.t = 0; gunS.fired = false; gunS.target = job.target; gunS.up = GUNPLAY.draw + GUNPLAY.hold;
    if (!held) held = P.held = makeHeldGun({ scene });
  }
  // each frame after the body is posed: the gun into the hand once the gun clip is fully in, the shot, the bullet
  function gunStep(dt) {
    if (held) held.update(dt);
    if (gunS.up <= 0) { if (held) held.show(false); return; }
    gunS.up -= dt; gunS.t += dt;
    if (held && held.fitted !== person && gunS.t > 0.2) held.fit(person);
    if (held) held.show(gunS.t > 0.12 && gunS.up > 0.05);
    if (gunS.phase === 'draw' && gunS.t >= GUNPLAY.draw && job && job.gun) {
      // fired: the flash and the smoke, the job's sound; the bullet gets there a moment later
      gunS.fired = true; gunS.phase = 'fly';
      if (held) held.fire();
      const tp = targetPos(job.target, tmp);
      gunS.fly = Math.hypot(tp.x - pos.x, tp.z - pos.z) / GUNPLAY.bullet;
      if (job.opts.onFire) job.opts.onFire();
    } else if (gunS.phase === 'fly' && (gunS.fly -= dt) <= 0) {
      gunS.phase = 'idle';
      const o = job && job.gun ? job.opts : null; job = null;
      if (o && o.onLand) o.onLand(o.good !== false);
    }
    if (gunS.up <= 0) { gunS.target = null; if (held) held.show(false); }
  }
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
      if (want.mag > 0.3 && job.t > 0.25 && d > (job.gun ? GUNPLAY.reach : MOVE.reach)) { const f = job.opts.onCancel; job = null; if (f) f(); return null; }   // (walked away from it)
      // getting no nearer (a fence or a building in the way)? given up, with a word, rather than running on the spot
      if (d < (job.best ?? Infinity) - 0.5) { job.best = d; job.stuckT = 0; } else job.stuckT = (job.stuckT || 0) + dt;
      if (job.t > 20 || job.stuckT > 2.5) { const f = job.opts.onCancel; job = null; tell(SAY.unreachable); if (f) f(); return null; }
      const reach = job.gun ? GUNPLAY.reach : MOVE.reach, from = job.gun ? GUNPLAY.from : MOVE.throwFrom;
      if (d > reach || (job.closing && d > from)) { job.closing = true;
        return { dir, mag: 1, run: P.onHorse ? d > 40 : d > 8, approach: true }; }
      if (job.gun) startShot(); else startThrow();
    }
    if (job.gun) {
      // (the gun: on foot, stand and face him while it comes up; from the saddle the rider keeps the reins)
      job.face = dir;
      if (!P.onHorse && gunS.phase === 'draw') return { dir, mag: 0, run: false, face: true };
      return null;
    }
    if (!lasso.busy) { job = null; return null; }
    job.face = dir;
    // on foot: stand and throw (free to walk again once the loop has landed); on a horse: the rider keeps control
    if (!P.onHorse && (lasso.phase === 'swing' || lasso.phase === 'throw' || lasso.phase === 'fly')) return { dir, mag: 0, run: false, face: true };
    return null;
  }

  // ── KEYS: E and H ───────────────────────────────────────────────────────────────────────────────────────────
  P.callHorse = () => {
    if (!H) { noHorse(); return; }
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
    if (P.mode === 'foot' && !H) { noHorse(); return false; }
    if (P.mode === 'foot' && W.codeIndoors && W.codeIndoors(pos.x, pos.y + 1, pos.z)) return false;   // (inside a building: the horse is out beyond its walls)
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
    // (beside it, clear of its body: further out from a bigger horse)
    for (const side of [1, -1]) { const v = sideOf(H.a, new THREE.Vector3(), side, 1.25 * BODY); if (!W.blocked(v.x, v.z)) { spot = v; break; } }
    if (!spot) spot = new THREE.Vector3(H.x - Math.sin(H.heading) * 2 * BODY, 0, H.z - Math.cos(H.heading) * 2 * BODY);
    spot.y = W.heightAt(spot.x, spot.z);
    P.mode = 'dismounting'; H.mode = 'stand'; H.speed = 0; H.yawRate = 0; H.idleT = 3;
    dismountSpot = spot;   // (the valley's wrap moves it along: P.shift)
    seat.dismount(spot, { onDone: () => { P.mode = 'foot'; P.downAt = performance.now(); pos.copy(spot); P.heading = H.heading; P.speed = 0; person.root.rotation.set(0, P.heading, 0); person.play('Idle', { fade: 0.25 }); } });
    return true;
  };
  // a treat handed over (src/feeding.js): the horse standing beside the rider lowers its head and munches for `seconds`
  // (its Eating clip, else its head-low idle), then goes on as before. false: it isn't standing still just now
  P.horseEat = (seconds = 3) => {
    if (!H || H.mode !== 'stand' || H.speed > 0.3 || P.mode === 'horse' || P.mode === 'mounting' || P.mode === 'dismounting') return false;
    const name = H.a.actions.Eating ? 'Eating' : H.a.actions.Idle_Headlow ? 'Idle_Headlow' : 'Idle';
    H.idle = name; H.idleT = seconds;
    return true;
  };
  P.eager = false;   // (full hearts: comes faster to the whistle; src/feeding.js sets it)
  // the horse left standing (not ridden) moved to (x, z) at once, as it stands
  P.moveHorse = (x, z) => { if (!H || P.mode === 'horse' || P.mode === 'mounting' || P.mode === 'dismounting') return false; H.x = x; H.z = z; H.speed = 0; H.yawRate = 0; placeHorse(0); return true; };
  P.teleport = (x, z, rot = P.heading) => {
    const y = W.heightAt(x, z);
    if (P.onHorse && H) { H.x = x; H.z = z; H.heading = rot; H.speed = 0; H.yawRate = 0; placeHorse(0); }
    else { pos.set(x, y, z); P.speed = 0; person.root.position.copy(pos); person.root.rotation.set(0, rot, 0); }
    P.heading = rot; cam.snap(); pendingMount = false; P.cancelLasso();
  };
  // moved as it stands, by (dx, dy, dz), the horse and the camera with it (out of the mist at one end of the valley and
  // into the other's: src/world.js W.wrap): nothing about the view or the gait changes, so nothing jumps. The horse
  // comes too only with the rider on it (or getting on or off): a horse left standing in town stays where it was left
  P.shift = ({ dx = 0, dy = 0, dz = 0 }) => {
    pos.x += dx; pos.y += dy; pos.z += dz;
    const withHorse = P.mode === 'horse' || P.mode === 'mounting' || P.mode === 'dismounting';
    if (withHorse && dismountSpot && P.mode === 'dismounting') { dismountSpot.x += dx; dismountSpot.y += dy; dismountSpot.z += dz; }
    if (withHorse) seat.shift(dx, dy, dz);
    if (H && withHorse) { H.x += dx; H.z += dz; H.a.root.position.x += dx; H.a.root.position.y += dy; H.a.root.position.z += dz; }
    person.root.position.x += dx; person.root.position.y += dy; person.root.position.z += dz;
    cam.shift(dx, dy, dz); P.cancelLasso();
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
    gunStep(dt);
    lasso.update(dt);
    cam.update(dt, { at: pos, heading: P.mode === 'horse' ? H.heading : P.heading, onHorse: P.mode === 'horse' || P.mode === 'mounting', speed: P.mode === 'horse' ? H.speed : P.speed, seat: H && H.big ? H.a.info.seat.at[1] : null });
    // (first person, src/camera.js FIRST: the rider's own body gone by half way in, back on the way out; touched only
    // while it is in or coming back, so a job fading the rider itself (the dock) is left alone)
    if (cam.fp > 0) { person.fade = Math.max(0, 1 - cam.fp * 2); fpFaded = true; } else if (fpFaded) { person.fade = 1; fpFaded = false; }
    if (H && H.steed) H.steed.look(camera.position);   // (the full or the far look, by how far off it is)
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
    // not through the horse standing there: out to the edge of its body (a line from its rump to its chest, 0.7 m round,
    // for the bay; times its size)
    if (H && H.mode !== 'ridden') {
      const B = BODY, rr = 0.7 * B, s = Math.sin(H.heading), c = Math.cos(H.heading), ax = H.x - s * 1.0 * B, az = H.z - c * 1.0 * B, bx = H.x + s * 0.9 * B, bz = H.z + c * 0.9 * B;
      const t = Math.max(0, Math.min(1, ((pos.x - ax) * (bx - ax) + (pos.z - az) * (bz - az)) / (3.61 * B * B)));
      const qx = ax + (bx - ax) * t, qz = az + (bz - az) * t, dx = pos.x - qx, dz = pos.z - qz, d = Math.hypot(dx, dz);
      if (d < rr) { const k = d > 1e-4 ? (rr - d) / d : 0, nx = pos.x + (d > 1e-4 ? dx * k : c * rr), nz = pos.z + (d > 1e-4 ? dz * k : -s * rr); if (!W.blocked(nx, nz)) { pos.x = nx; pos.z = nz; } }
    }
    // not through a wagon or its team either: out to its edge (src/wagon.js pushFromWagons)
    { const o = pushFromWagons(pos.x, pos.z, WAGON_R.foot, W); if (o) { const nx = o.x - pos.x, nz = o.z - pos.z; pos.x = o.x; pos.z = o.z; slideRound(pos, nx, nz, P.heading, v * dt, WAGON_R.foot); } }
    pos.y = W.heightAt(pos.x, pos.z);
  }

  function rideStep(dt, want) {
    const M = MOVE.horse;
    let target = 0, wantRate = 0;
    if (pendingDismount) want = { dir: null, mag: 0, run: false };     // (asked to get off: reined in, whatever the keys say)
    if (want.dir !== null) {
      const diff = wrap(want.dir - H.heading), max = lerpTable(TURN.turn, H.speed);
      wantRate = Math.max(-max, Math.min(max, diff * 3));
      target = want.run ? pace('gallop') : want.mag < 0.55 ? pace('walk') : pace('trot');
      if (want.approach && !want.run) target = pace('trot');
      target = Math.min(target, lerpTable(TURN.turnSpeed, Math.abs(diff)));   // (slowing for a sharp turn)
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
  // (veer: the side it turned to last, kept while the way ahead stays blocked and the rider pushes straight on. Picked
  // afresh each step, "the side the rider wants" flips with every small turn when the rider wants straight ahead, and
  // a horse pushed straight at a fence's end stood there turning a hair this way and that, never getting off it)
  let veer = 0;
  function moveHorse(dt, want, v0 = H.speed) {
    if (H.speed <= 0.01 && v0 <= 0.01) { offWagons(); return; }   // (standing: a wagon may still roll up against it)
    const nose = NOSE * BODY, reach = nose + Math.min(1.6, H.speed * 0.12);
    // (points all along the way ahead: a fence's band or a thin trunk can sit anywhere between its middle and its nose)
    const ahead = (h) => { const s = Math.sin(h), c = Math.cos(h); for (const d of [0.1, 0.25, 0.45, nose, reach]) if (W.blocked(H.x + s * d, H.z + c * d)) return true; return false; };
    if (ahead(H.heading)) {
      const lean = want === null ? 0 : wrap(want - H.heading);
      const first = Math.abs(lean) > 0.35 ? Math.sign(lean) : veer || Math.sign(lean) || 1;
      let turn = null;
      for (const t of [0.3, 0.6, 0.9, 1.3, 1.8, 2.4]) {
        for (const side of [first, -first]) { if (!ahead(H.heading + t * side)) { turn = t * side; break; } }
        if (turn !== null) break;
      }
      if (turn !== null) { veer = Math.sign(turn); H.heading = wrap(H.heading + veer * Math.min(Math.abs(turn), 3 * dt)); H.speed = Math.min(H.speed, MOVE.horse.walk + 1.5); }
      else H.speed = Math.max(0, H.speed - 25 * dt);
      v0 = H.speed;
    } else veer = 0;
    const v = (v0 + H.speed) / 2, o = { x: H.x, z: H.z }, got = walk(o, H.heading, v * dt, nose);
    if (got < v * dt * 0.3) H.speed = got / Math.max(dt, 1e-4);   // (stopped by it: stands, rather than walking on the spot)
    H.x = o.x; H.z = o.z;
    offWagons(v * dt);
  }
  // not through a wagon or its team: the horse's body (circles from its head to its rump, each WAGON_R.horse round)
  // put out to the wagon's edge by the most any of them is in
  function offWagons(step = 0) {
    let bx = 0, bz = 0, most = 0;
    for (const f0 of WAGON_R.along) {
      const f = f0 * BODY, px = H.x + Math.sin(H.heading) * f, pz = H.z + Math.cos(H.heading) * f, q = pushFromWagons(px, pz, WAGON_R.horse * BODY, W);
      if (q && Math.hypot(q.x - px, q.z - pz) > most) { most = Math.hypot(q.x - px, q.z - pz); bx = q.x - px; bz = q.z - pz; }
    }
    if (most > 0 && !W.blocked(H.x + bx, H.z + bz)) {
      H.x += bx; H.z += bz;
      if (step > 0) { const q = { x: H.x, z: H.z }; slideRound(q, bx, bz, H.heading, step, WAGON_R.horse * BODY, Math.max(...WAGON_R.along) * BODY); H.x = q.x; H.z = q.z; }
    }
  }
  // heading straight into a wagon's side (as when one has stopped in the road ahead, its driver waiting for you):
  // slide along that side toward the way you lean (else the way last taken), so pressing on gets round it rather
  // than standing nose to nose with the team. Glancing into it slides along by itself already. (p: moved in place;
  // nx, nz: the way it was just pushed out; reach: how far ahead of p to check the way is clear, for the horse's head)
  let slideSide = 1;
  function slideRound(p, nx, nz, heading, step, r, reach = 0) {
    const n = Math.hypot(nx, nz); if (n < 1e-5 || step <= 0) return;
    nx /= n; nz /= n;
    const hx = Math.sin(heading), hz = Math.cos(heading);
    if (hx * nx + hz * nz > -0.6) return;
    const tx = -nz, tz = nx, lean = hx * tx + hz * tz;
    if (Math.abs(lean) > 0.1) slideSide = Math.sign(lean);
    const qx = p.x + tx * slideSide * step * 0.8, qz = p.z + tz * slideSide * step * 0.8;
    const fx = qx + hx * reach, fz = qz + hz * reach;
    if (!W.blocked(qx, qz) && !W.blocked(fx, fz) && !pushFromWagons(qx, qz, r, W)) { p.x = qx; p.z = qz; } else slideSide = -slideSide;
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
      // (a horse with full hearts, P.eager (src/feeding.js): at its own top gallop, from nearer, and trots in closer)
      const E = P.eager ? EAGER : null;
      let target = gd > (E ? E.gallopPast : 30) ? (E ? pace('gallop') : Math.min(C.gallop, pace('gallop'))) : gd > (E ? E.trotPast : 10) ? Math.min(C.trot * (E ? E.trot : 1), pace('trot') * (E ? E.trot : 1)) : Math.min(C.walk * (E ? E.walk : 1), pace('walk') * (E ? E.walk : 1), gd * 1.2);
      if (gd <= 0.8 || d < 1.6) { target = 0; if (H.speed < 0.3) { H.mode = 'stand'; H.idleT = 6; H.goal = null; P.horseCameAt = performance.now(); } }
      // steer: straight for the player if the way is clear, else the nearest clear heading either side
      const want = Math.atan2(dx, dz); let h = want;
      for (const t of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.7, -1.7, 2.3, -2.3]) {
        const g = want + t, s = Math.sin(g), c = Math.cos(g);
        if (!W.blocked(H.x + s * 2, H.z + c * 2) && !W.blocked(H.x + s * 4, H.z + c * 4)) { h = g; break; }
      }
      const diff = wrap(h - H.heading), max = lerpTable(TURN.turn, H.speed);
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
      // now and then a different idle: head down to graze, a shake, a look round or an ear flick (played once: then the
      // next pick comes when it has finished)
      if (H.speed < 0.2 && (H.idleT -= dt) <= 0) {
        let pick = Math.random(), name = 'Idle';
        for (const [n, w] of IDLES) { if ((pick -= w) <= 0) { name = n; break; } }
        if (!H.a.actions[name]) name = name === 'Eating' || name === 'Idle_Headlow' || name === 'Idle_2' ? name : 'Idle';
        H.idle = name;
        H.idleT = ONCE.has(name) && H.a.actions[name] ? H.a.actions[name].getClip().duration + 0.2 : 5 + Math.random() * 7;
      }
    }
  }

  // ── CLIPS ───────────────────────────────────────────────────────────────────────────────────────────────────
  function horseGait() {
    const v = H.speed, a = H.a;
    // (an idle this animal has no clip for, the farm horse's grazing: it just stands)
    if (v < 0.2) { const idle = H.mode === 'ridden' ? 'Idle' : (H.idle || 'Idle'), name = a.actions[idle] ? idle : 'Idle'; a.play(name, { fade: 0.35, once: ONCE.has(name) }); H.gait = 'Idle'; H.clipSpeed = 0.2; return; }
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
  // the gun clip while the six-shooter is up (on foot, walking off puts it away)
  function gunClip() { return gunS.up > 0 && has(GUN_CLIP) ? [GUN_CLIP, false] : null; }
  function animate() {
    if (H) horseGait();
    if (P.mode === 'foot' && gunS.up > 0 && gunS.phase === 'idle' && personGait()[0] !== 'Idle') gunS.up = 0;
    const lc = lassoClip() || gunClip();
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
    const ph = lasso.phase, gunAt = P.mode === 'horse' && gunS.up > 0 && gunS.target ? gunS.target : null;
    const on = gunAt || (P.mode === 'horse' && job && !job.gun && ph !== 'idle' && ph !== 'reel');
    let want = 0;
    if (on) { const tp = targetPos(gunAt || job.target, tmp); want = Math.max(-1.3, Math.min(1.3, wrap(Math.atan2(tp.x - pos.x, tp.z - pos.z) - H.heading))); }
    twist = damp(twist, want, 6, dt);
    const b = person.bones.Abdomen; if (!b || Math.abs(twist) < 0.01) return;
    b.parent.getWorldQuaternion(_pq);
    _q.setFromAxisAngle(Y, twist); b.quaternion.premultiply(_iq.copy(_pq).invert().multiply(_q).multiply(_pq));   // (about the world's up, in its parent's frame)
    b.updateMatrixWorld(true);
  }

  P.state = () => ({
    mode: P.mode, speed: +P.speed.toFixed(2), heading: +P.heading.toFixed(3), x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), clip: person.clip,
    layer: layerName, lasso: lasso.phase, job: job ? (job.thrown ? 'thrown' : 'approach') : null, gun: gunS.phase, gunUp: +gunS.up.toFixed(2),
    horse: H ? { id: horseId, kind: H.a.kind, size: H.a.size || 1, cap: +((H.a.info.gait && H.a.info.gait.most && H.a.info.gait.most.Gallop) || GAIT.most.Gallop).toFixed(2), look: H.steed ? H.steed.lookNow.coat : null, mode: H.mode, x: +H.x.toFixed(2), z: +H.z.toFixed(2), speed: +H.speed.toFixed(2), gait: H.gait, clip: H.a.clip, clipSpeed: +(H.clipSpeed || 0).toFixed(2), saddle: saddleKind, dist: +Math.hypot(H.x - pos.x, H.z - pos.z).toFixed(2) } : null,
    canRide: P.canRide, cam: { yaw: +cam.yaw.toFixed(3), pitch: +cam.pitch.toFixed(3), zoom: +cam.zoom.toFixed(2) },
  });
  P.dispose = () => { disposed = true; offDial(); lasso.dispose(); if (held) held.dispose(); person.dispose(); if (H) { if (H.steed) H.steed.dispose(); else H.a.dispose(); } };
  return P;
}
