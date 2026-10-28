// RIDERS: people on horseback out on the trail, for "Protect the wagon" (src/missions/wagonjob.js): the gang's bandits
// and the townsfolk riding along with the wagon. Bandits and townsfolk look alike on purpose (the same outfits, colours,
// horses and neckerchiefs, drawn from one pool): the number each one wears is the only way to tell them apart, so the
// kid has to do the math. Each rider wears a number twice: on a cream card floating over the hat (the same size on
// screen near or far, like the cattle numbers) and painted on the saddlebags.
//
// The horse is an animal from actors/animals.js with a saddle on its back; the person is a folk.js person sat in the
// saddle at the fixed offset (seatRider in actors/seat.js, as the player rides) playing Ride or Ride_Gallop at the
// horse's own clip speed, so the two stay in step. The horse's clip and its speed come from gaitFor, so a hoof that is
// down stays put on the ground at any pace.
//
// Poses made here in code (no Blender clips needed):
//   tipHat()   a townsman lifts his hat an inch and nods ("Not me, partner"); about a second and a half
//   fall(at)   pulled from the saddle by a lasso toward `at` (where the roper is): the rider tips off the far side's
//              opposite way, toward the rope, and lands face down on the ground beside the trail
//   (then)     hogtied: lying face down, wrists behind the back and the ankles drawn up to them, a short rope between,
//              with a little wriggle now and then. The riderless horse gallops off.
//   fall(at, { shot: true })   knocked from the saddle by the six-shooter (src/gun.js; no blood): he tumbles off the far
//              side, away from the shooter, in a puff of dust, lies flat a moment, sits up dazed with his hat askew, and
//              puts his hands up. The riderless horse trots off. (Getting up and walking to the sheriff: the job's.)
//   duck()     a townsman shot at by mistake ducks down in the saddle as the shot goes over, and comes back up
//
//   const kit = await loadRiderKit({ animals, base })   loads the horses and two saddles (once a ride)
//   const r = makeRider(kit, { W, folk, scene, look, horse, coat, saddle, kerchief, shadows })
//     look: { outfit, palette, skin, hair } (folk.js); horse: 'horse' | 'horseWhite'; coat: a tint ('#c9b6a0'); saddle:
//     0 or 1 (plain, tooled); kerchief: a colour. Leave them out for a random pick from the shared pool (RIDER_LOOKS)
//   r.x, r.z, r.heading (radians, facing (sin, cos)), r.speed (m/s): where it is; move it with r.steer or set them
//   r.steer(gx, gz, v, dt)   turn toward a point and go at v m/s (a horse's turning limits; steps round what blocks)
//   r.update(dt)             each frame after moving it: the horse's clip, the seat, the poses
//   r.setNumber(text)        the number on the card and the saddlebags (null: none)
//   r.label                  the card (a THREE.Sprite; the mission places and sizes it each frame)
//   r.top()                  the height (world y) just over the hat, where the card sits
//   r.neck(v), r.neckRadius  where a lasso loop goes round the rider's neck (for lasso.js)
//   r.person, r.horse        the folk.js person and the animal
//   r.mode                   'ride' | 'fall' | 'down' (hogtied on the ground, or sitting with his hands up) | 'gone'
//   r.tipHat(), r.fall(at, { onDown, shot }), r.duck(), r.shot (true once knocked down by a shot)
//   r.show(on)               drawn, or put out of sight (far from the player)
//   r.dispose()
//   RIDERS                   the sizes and timings
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { makePerson } from './folk.js';
import { makeAnimal, saddleOn, gaitFor, COATS } from './animals.js';
import { makeHorse as makeSteed, horseDial } from './horses.js';
import { rollPenHorse } from '../horsepenplan.js';
import { seatRider } from './seat.js';
import { makeDust } from '../fx/dust.js';

export const RIDERS = {
  turn: [[0, 2.2], [3, 1.6], [8, 1.0], [13, 0.8]],   // the fastest a horse turns (radians a second) at a speed (m/s)
  accel: 4, brake: 5,     // m/s each second
  most: 11,               // the fastest a rider gallops (m/s)
  fall: 0.75,             // seconds from the saddle to the ground
  tie: 0.9,               // ... and then to hogtied
  lieUp: 0.19,            // metres the root of a body lying face down sits over the ground (clears the knees)
  tip: 1.5,               // seconds a hat tip takes
  card: [320, 128],       // the number card's canvas (pixels)
  overHat: 0.42,          // metres from the neck to the card's foot (just over the hat's crown)
  bolt: 7,                // seconds a riderless horse gallops off before it is put away
  // knocked from the saddle by a shot (seconds): the tumble to the ground, lying flat, sitting up, a dazed moment, the
  // hands going up; then sitting with them up. out: metres from the horse's middle he lands; trot: the riderless
  // horse's pace (m/s), going off for bolt seconds at it
  shot: { tumble: 0.8, lie: 0.55, sit: 0.7, dazed: 0.7, hands: 0.45, out: 1.7, trot: 4.2, bolt: 10 },
  duck: 1.2,              // seconds a duck takes: down fast, back up slowly
};

// the shared pool of looks: bandits and townsfolk are both drawn from it, so a look never gives the answer away
export const RIDER_LOOKS = {
  outfits: ['adventurer_m', 'casual_m', 'farmer_m', 'worker_m', 'adventurer_f', 'casual_f', 'adventurer_m', 'casual_m'],
  palettes: ['drifter', 'rancher', 'outlaw', 'homestead', 'prairie', 'townsman', 'mustard', 'sage'],
  kerchiefs: ['#8e2f25', '#2f4a6b', '#c9b48a', '#3a3a36', '#6b2f4a', '#4f6b3a', '#a0662e'],
  horses: ['horse', 'horse', 'horseWhite'],
};
const SADDLE_FILES = ['basic', 'battle'];
const GAME = new URL('../../', import.meta.url).href;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const ease = (t) => t * t * (3 - 2 * t);
function lerpTable(tab, v) {
  if (v <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (v <= tab[i][0]) { const [a, x] = tab[i - 1], [b, y] = tab[i]; return x + (y - x) * (v - a) / (b - a); }
  return tab[tab.length - 1][1];
}

// (made once for the whole visit and shared by every ride's riders)
const kits = [];
export function loadRiderKit({ animals, base = GAME } = {}) {
  let c = kits.find((x) => x.animals === animals && x.base === base);
  if (!c) {
    c = { animals, base, p: makeKit(animals, base) };
    kits.push(c);
    c.p.catch(() => { const i = kits.indexOf(c); if (i >= 0) kits.splice(i, 1); });
  }
  return c.p;
}
async function makeKit(animals, base) {
  await Promise.all(['horse', 'horseWhite'].map((k) => animals.need(k)));
  await animals.need('steed').catch(() => null);   // (the new horse, for the governor's top level: makeRider)
  const saddles = await Promise.all(SADDLE_FILES.map((f) => loader.loadAsync(base + 'models/saddles/' + f + '.glb').then((g) => g.scene).catch(() => null)));
  return { animals, saddles, bagGeo: bagGeometry(), kerchiefGeo: kerchiefGeometry() };
}

// ── THE NUMBER CARD ──────────────────────────────────────────────────────────────────────────────────────────────────
// a cream card with the number in dark ink (the same for bandits and townsfolk), as the cattle wear
export function makeCard() {
  const [W, H] = RIDERS.card, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  const s = new THREE.Sprite(mat); s.center.set(0.5, 0); s.renderOrder = 1000; s.name = 'rider-number';
  s.userData = { cv, tex, text: null, wide: 1 };
  return s;
}
export function drawCard(s, text, { font = '700 84px Bitter, Georgia, serif', ink = '#2b2219', paper = 'rgba(246, 237, 214, 0.96)', edge = 'rgba(92, 64, 36, 0.95)' } = {}) {
  const key = text + '|' + font + ink + paper;
  if (s.userData.text === key) return;
  s.userData.text = key;
  const { cv, tex } = s.userData, c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  c.font = font;
  const w = Math.min(W - 8, Math.max(H * 1.05, c.measureText(text).width + 56)), x0 = (W - w) / 2;
  c.fillStyle = paper; c.strokeStyle = edge; c.lineWidth = 6;
  c.beginPath(); c.roundRect(x0 + 4, 6, w - 8, H - 12, 26); c.fill(); c.stroke();
  s.userData.wide = w / W;
  c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, W / 2, H / 2 + 5);
  tex.needsUpdate = true;
}

// ── THE SADDLEBAGS: a leather bag hanging on each side behind the saddle, the number painted on both ─────────────────
// One box bent a little over the horse's back; its sides show the canvas (left half: the left bag, right half: the
// right one), its top and ends are plain leather.
function bagGeometry() {
  const g = new THREE.BoxGeometry(0.62, 0.34, 0.3, 1, 1, 1);
  // the two sides (+x and -x faces) get the number; every other face reads a plain leather corner of the canvas
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i, u = uv.getX(k), v = uv.getY(k);
    if (f === 0) uv.setXY(k, 0.5 + u * 0.5, v);          // +x: its own left half... (the right bag, seen from the right)
    else if (f === 1) uv.setXY(k, u * 0.5, v);           // -x: the left bag
    else uv.setXY(k, 0.02, 0.02);
  }
  return g;
}
function drawBag(cv, text) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.fillStyle = '#5a3b22'; c.fillRect(0, 0, W, H);
  for (const x0 of [0, W / 2]) {
    c.strokeStyle = '#3b2615'; c.lineWidth = 6; c.strokeRect(x0 + 8, 8, W / 2 - 16, H - 16);   // the stitched edge
    c.fillStyle = '#4a301b'; c.fillRect(x0 + 8, 8, W / 2 - 16, H * 0.26);                       // the flap
    if (text) {
      // a cream patch sewn on below the flap, the number big in dark ink on it (as on the cards over the hats), so it
      // still reads from a rider's distance against the brown leather
      const px = x0 + 16, py = H * 0.3, pw = W / 2 - 32, ph = H * 0.62;
      c.fillStyle = '#f2e6c8'; c.strokeStyle = '#2b1a0c'; c.lineWidth = 4;
      c.beginPath(); c.roundRect(px, py, pw, ph, 10); c.fill(); c.stroke();
      c.fillStyle = '#2b2219'; c.font = `800 ${Math.round(ph * 0.92)}px Bitter, Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(text, x0 + W / 4, py + ph / 2 + 3, pw - 8);
    }
  }
}
// a neckerchief: a soft triangle hanging at the throat, tied behind
function kerchiefGeometry() {
  const g = new THREE.ConeGeometry(0.105, 0.17, 4, 1, true);
  g.rotateY(Math.PI / 4); g.rotateX(Math.PI); g.scale(1.25, 1, 0.55);
  g.translate(0, -0.03, 0.06);
  return g;
}

// THE TIED POSE, laid over the standing Idle clip each frame (amount 0..1): the knees bent so the feet come up behind,
// the arms back with the wrists together at the small of the back. Angles in each bone's own frame as the pack built
// it, found by trying them (tests/riders.html RIDE.lab): an upper arm's z swings it back and its y turns it in behind
// the back; a forearm's x bends the elbow across the back; a shin's x (positive) folds the shin up behind the thigh, so
// lying face down the feet stand about 0.3 m over the backs of the knees, toward the wrists; a thigh's x (positive)
// lifts the knees off the ground a little
export const TIE = { thigh: 0.2, knee: 2.0, arm: [0, -2.6, 0.3], fore: [1.8, 0, 0] };
const _tq = new THREE.Quaternion(), _tq0 = new THREE.Quaternion(), _tq1 = new THREE.Quaternion(), _tpq = new THREE.Quaternion();
const _te = new THREE.Euler(), _tp = new THREE.Vector3();
export function tiePose(person, amount, T = TIE) {
  if (amount <= 0) return;
  const b = person.bones;
  for (const [s, sg] of [['L', 1], ['R', -1]]) {
    const up = b['UpperLeg' + s], lo = b['LowerLeg' + s], foot = b['Foot' + s];
    if (up) { _tq.setFromEuler(_te.set(T.thigh * amount, 0, 0)); up.quaternion.multiply(_tq); }
    if (lo && up) {
      up.updateMatrixWorld(true); lo.getWorldQuaternion(_tq0);
      _tq.setFromEuler(_te.set(T.knee * amount, 0, 0)); lo.quaternion.multiply(_tq);   // (a shin's own x bends the knee back)
      lo.updateMatrixWorld(true); lo.getWorldQuaternion(_tq1);
      if (foot) {
        // the feet are bones of their own, not children of the shins: each is moved to the end of its shin, where the
        // knee now puts it, and turned as far as the shin turned
        lo.localToWorld(_tp.set(0, Math.max(0.3, lo.position.length()), 0));
        foot.parent.updateMatrixWorld(true); foot.parent.worldToLocal(_tp);
        foot.position.copy(_tp);
        foot.parent.getWorldQuaternion(_tpq);
        _tq.copy(_tpq).invert().multiply(_tq1.multiply(_tq0.invert())).multiply(_tpq);   // (the shin's turn, in the foot's parent's frame)
        foot.quaternion.premultiply(_tq);
      }
    }
    const ua = b['UpperArm' + s], la = b['LowerArm' + s];
    if (ua) { _tq.setFromEuler(_te.set(T.arm[0] * amount, T.arm[1] * sg * amount, T.arm[2] * sg * amount)); ua.quaternion.multiply(_tq); }
    if (la) { _tq.setFromEuler(_te.set(T.fore[0] * amount, T.fore[1] * sg * amount, T.fore[2] * sg * amount)); la.quaternion.multiply(_tq); }
  }
}

// THE TUCK of the tumble (laid over the standing Idle clip with tiePose, as the tied pose is): the knees drawn up
export const TUCK = { thigh: -1.7, knee: 1.9, arm: [0, 0, 0], fore: [0, 0, 0] };
// SITTING ON THE GROUND (sitLegs): each thigh and shin pointed out in front, a little out to his side and a touch down,
// in the person's own frame (x: out to his left, y: up, z: forward)
export const SIT_LEGS = { thigh: [0.22, -0.08, 1], shin: [0.06, -0.1, 1] };
// HANDS UP (amount 0..1 blended over whatever the clip has the arms doing): each upper arm out to the side and up, the
// elbows about shoulder high, the forearms straight up, the hands by the head. The directions are in the person's own
// frame (x: out to his left, y: up, z: forward). The walk to the sheriff's office keeps them up too (src/missions/wagonjob.js)
export const HANDS_UP = { arm: [0.85, 0.42, 0.12], fore: [0.1, 1, 0.12] };
const _hq = new THREE.Quaternion(), _hx = new THREE.Vector3(), _hy = new THREE.Vector3(), _hz = new THREE.Vector3(), _hd = new THREE.Vector3();
const _hb = new THREE.Quaternion(), _hp = new THREE.Quaternion(), _ht = new THREE.Quaternion(), _h0 = new THREE.Quaternion(), _hby = new THREE.Vector3();
// a bone turned (part of the way: k) so that it points (its own +y, along it to its child) along the world direction dir
function pointAlong(bone, dir, k) {
  dir.normalize();
  bone.getWorldQuaternion(_hb);
  _hby.set(0, 1, 0).applyQuaternion(_hb);
  _ht.setFromUnitVectors(_hby, dir).multiply(_hb);
  bone.parent.getWorldQuaternion(_hp);
  _h0.copy(bone.quaternion);
  _ht.premultiply(_hp.invert());
  bone.quaternion.slerpQuaternions(_h0, _ht, k);
  bone.updateMatrixWorld(true);
}
// the legs out in front, sitting (amount 0..1 over whatever the clip has them doing): each thigh and shin pointed, then
// the foot (a bone of its own under the root, not the shin's child) put at the end of its shin and turned as far as
// the shin turned, as tiePose does
const _lq0 = new THREE.Quaternion(), _lq1 = new THREE.Quaternion(), _lpq = new THREE.Quaternion(), _lt = new THREE.Quaternion(), _lp = new THREE.Vector3();
export function sitLegs(person, k = 1, L = SIT_LEGS) {
  if (k <= 0) return;
  const b = person.bones;
  person.root.updateMatrixWorld(true);
  person.root.getWorldQuaternion(_hq);
  _hx.set(1, 0, 0).applyQuaternion(_hq); _hy.set(0, 1, 0).applyQuaternion(_hq); _hz.set(0, 0, 1).applyQuaternion(_hq);
  for (const [s, sg] of [['L', 1], ['R', -1]]) {
    const up = b['UpperLeg' + s], lo = b['LowerLeg' + s], foot = b['Foot' + s];
    if (!up || !lo) continue;
    lo.getWorldQuaternion(_lq0);
    pointAlong(up, _hd.copy(_hx).multiplyScalar(sg * L.thigh[0]).addScaledVector(_hy, L.thigh[1]).addScaledVector(_hz, L.thigh[2]), k);
    pointAlong(lo, _hd.copy(_hx).multiplyScalar(sg * L.shin[0]).addScaledVector(_hy, L.shin[1]).addScaledVector(_hz, L.shin[2]), k);
    if (!foot) continue;
    lo.getWorldQuaternion(_lq1);
    lo.localToWorld(_lp.set(0, Math.max(0.3, lo.position.length()), 0));
    foot.parent.updateMatrixWorld(true); foot.parent.worldToLocal(_lp);
    foot.position.copy(_lp);
    foot.parent.getWorldQuaternion(_lpq);
    _lt.copy(_lpq).invert().multiply(_lq1.multiply(_lq0.invert())).multiply(_lpq);   // (the shin's turn, in the foot's parent's frame)
    foot.quaternion.premultiply(_lt);
  }
}
export function handsUp(person, k, H = HANDS_UP) {
  if (k <= 0) return;
  const b = person.bones;
  person.root.updateMatrixWorld(true);
  person.root.getWorldQuaternion(_hq);
  _hx.set(1, 0, 0).applyQuaternion(_hq); _hy.set(0, 1, 0).applyQuaternion(_hq); _hz.set(0, 0, 1).applyQuaternion(_hq);
  for (const [s, sg] of [['L', 1], ['R', -1]]) {
    const ua = b['UpperArm' + s], la = b['LowerArm' + s];
    if (!ua || !la) continue;
    pointAlong(ua, _hd.copy(_hx).multiplyScalar(sg * H.arm[0]).addScaledVector(_hy, H.arm[1]).addScaledVector(_hz, H.arm[2]), k);
    pointAlong(la, _hd.copy(_hx).multiplyScalar(sg * H.fore[0]).addScaledVector(_hy, H.fore[1]).addScaledVector(_hz, H.fore[2]), k);
  }
}

// ── A RIDER ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export function makeRider(kit, { W, folk, scene = W.scene, look = null, horse = null, coat = null, saddle = null, kerchief = null, shadows = true } = {}) {
  const L = RIDER_LOOKS;
  const lk = { outfit: pick(L.outfits), palette: pick(L.palettes), skin: Math.floor(Math.random() * 8), hair: Math.floor(Math.random() * 11), ...(look || {}) };
  const person = makePerson(folk, { ...lk, shadows });
  // (the governor's horse dial at its top, every: the road's and the jobs' riders on the new horse too, in a common or
  // less common coat from the pen's pool, one pool for bandits and townsfolk alike so a coat never gives the answer away;
  // else the pack's horses, tinted, as always. It only changes at a hiding moment, and riders are made out of sight)
  const dial = !horse && W ? horseDial(W) : null;
  const st = dial && dial.every && kit.animals.kinds && kit.animals.kinds.steed ? makeSteed(kit.animals, { recipe: roadCoat(), size: 1, tier: dial.look, shadows }) : null;
  const a = st ? st.a : makeAnimal(kit.animals, horse || pick(L.horses), { shadows, tint: coat || pick(COATS) });
  // (the new horse's coat has its own dissolve, which fadeAll (src/wagon.js) can't reach: it fades with its rider)
  if (st) { const d = Object.getOwnPropertyDescriptor(person, 'fade'); if (d && d.set) Object.defineProperty(person, 'fade', { configurable: true, enumerable: true, get: d.get, set(f) { d.set.call(person, f); st.fade = f; } }); }
  const sad = kit.saddles[saddle ?? Math.floor(Math.random() * kit.saddles.length)] || kit.saddles.find(Boolean);
  if (sad) saddleOn(a, sad.clone(), { shadows });
  scene.add(a.root, person.root);

  // the saddlebags on the seat bone (they ride the back through every clip, as the saddle does)
  const bagCv = document.createElement('canvas'); bagCv.width = 256; bagCv.height = 96;
  const bagTex = new THREE.CanvasTexture(bagCv); bagTex.colorSpace = THREE.SRGBColorSpace; bagTex.anisotropy = 4;
  const bag = new THREE.Mesh(kit.bagGeo, new THREE.MeshStandardMaterial({ map: bagTex, roughness: 0.85 }));
  bag.castShadow = shadows; bag.name = 'saddlebags';
  {
    // behind the saddle, hanging over both sides, level in the horse's own space: from there into the seat bone's
    const s = a.info.seat.at, m = new THREE.Matrix4().makeTranslation(s[0], s[1] - 0.12, s[2] - 0.5).premultiply(a.seatRest.clone().invert());
    m.decompose(bag.position, bag.quaternion, bag.scale);
    a.bones[a.info.seat.bone].add(bag);
  }
  // the neckerchief on the neck bone
  const kmat = new THREE.MeshStandardMaterial({ color: kerchief || pick(L.kerchiefs), roughness: 0.9, side: THREE.DoubleSide });
  const kc = new THREE.Mesh(kit.kerchiefGeo, kmat); kc.castShadow = false; kc.name = 'neckerchief';
  if (person.bones.Neck) person.bones.Neck.add(kc);

  const label = makeCard();
  scene.add(label); label.visible = false;

  const R = {
    person, horse: a, label, look: lk, x: 0, z: 0, heading: 0, speed: 0, yawRate: 0, pitch: 0, mode: 'ride', neckRadius: 0.12,
    height: 2.6,                            // (for anything that sizes by height: rider and horse together)
    ring: { y: 1.25, radius: 0.55 },        // (the target ring: round the rider's chest, in the person's own space)
  };
  let gait = 'Idle', clipSpeed = 1, tip = 0, fall = null, down = null, bolt = 0, wriggle = Math.random() * 10, duck = 0, knock = null, dust = null;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  R.setNumber = (text) => {
    R.number = text;
    if (text) drawCard(label, text);
    drawBag(bagCv, text); bagTex.needsUpdate = true;
  };
  R.setNumber(null);
  R.neck = (v = new THREE.Vector3()) => { const b = person.bones.Neck || person.bones.Head; return b ? b.getWorldPosition(v) : person.root.getWorldPosition(v).setY(v.y + 2.4); };
  R.top = () => R.neck(tmp).y + RIDERS.overHat;
  R.place = (x, z, heading) => { R.x = x; R.z = z; R.heading = heading; placeHorse(0); };

  // turn toward (gx, gz) and go at v: a horse's turn (tighter slow than fast), easing speed up and down, stepping round
  // anything that blocks (a fence, a building, steep ground) by trying a little to either side
  R.steer = (gx, gz, v, dt) => {
    if (R.mode !== 'ride' && R.mode !== 'bolt') return;
    const dx = gx - R.x, dz = gz - R.z, d = Math.hypot(dx, dz);
    const want = d > 0.05 ? Math.atan2(dx, dz) : R.heading;
    const diff = wrapA(want - R.heading), max = lerpTable(RIDERS.turn, R.speed);
    const rate = Math.max(-max, Math.min(max, diff * 2.5));
    R.yawRate = damp(R.yawRate, rate, 6, dt);
    R.heading = wrapA(R.heading + R.yawRate * dt);
    // slow for a sharp turn, never overshoot a close spot
    let target = Math.min(RIDERS.most, v);
    if (Math.abs(diff) > 1.2) target = Math.min(target, 2.5);
    R.speed = target > R.speed ? Math.min(target, R.speed + RIDERS.accel * dt) : Math.max(target, R.speed - RIDERS.brake * dt);
    const step = R.speed * dt;
    for (const t of [0, 0.35, -0.35, 0.8, -0.8, 1.3, -1.3]) {
      const h = R.heading + t, nx = R.x + Math.sin(h) * step, nz = R.z + Math.cos(h) * step;
      if (!W.blocked(nx, nz) && !W.blocked(nx + Math.sin(h) * 1.2, nz + Math.cos(h) * 1.2) && W.waterAt(nx, nz) < 0.5) {
        R.x = nx; R.z = nz; if (t) R.heading = wrapA(R.heading + t * Math.min(1, 3 * dt)); return;
      }
    }
    R.speed *= 0.5;   // (boxed in: it slows and turns on the next frames)
  };

  // the horse's place, slope and lean from x, z and heading
  function placeHorse(dt) {
    const s = Math.sin(R.heading), c = Math.cos(R.heading);
    const y = W.heightAt(R.x, R.z), yf = W.heightAt(R.x + s * 1.1, R.z + c * 1.1), yb = W.heightAt(R.x - s * 1.1, R.z - c * 1.1);
    const pitch = -Math.atan2(yf - yb, 2.2), roll = Math.max(-0.12, Math.min(0.12, -R.yawRate * R.speed * 0.012));
    R.pitch = dt ? damp(R.pitch, pitch, 8, dt) : pitch;
    R.roll = dt ? damp(R.roll || 0, roll, 5, dt) : roll;
    a.root.position.set(R.x, Math.max(y, (yf + yb) / 2), R.z);
    a.root.rotation.set(R.pitch, R.heading, R.roll, 'YXZ');
  }
  // the horse's clip for its speed, and the rider's riding clip at the same clip speed, in step
  function clips() {
    const v = R.speed;
    if (v < 0.2) { a.play('Idle', { fade: 0.35 }); gait = 'Idle'; clipSpeed = 0.2; }
    else { const [clip, sp] = gaitFor(a, v, gait); gait = clip || 'Walk'; clipSpeed = sp; a.play(gait, { fade: 0.3, speed: sp }); }
    if (R.mode !== 'ride') return;
    const ride = gait === 'Gallop' ? 'Ride_Gallop' : 'Ride';
    person.play(person.clips.includes(ride) ? ride : 'Idle', { fade: 0.25, speed: gait === 'Idle' ? 0.2 : clipSpeed });
  }
  function syncRide() {
    const ha = a.actions[a.clip], ra = person.person && person.person.cur;
    if (!ha || !ra || gait === 'Idle') return;
    const d = ra.getClip().duration; if (Math.abs(d - ha.getClip().duration) < 0.02) ra.time = ha.time % d;
  }

  // ── THE HAT TIP ─────────────────────────────────────────────────────────────────────────────────────────────────
  R.tipHat = () => { if (R.mode === 'ride') tip = RIDERS.tip; };
  // ── THE DUCK (a wrong one shot at: the shot goes over his head) ────────────────────────────────────────────────
  R.duck = () => { if (R.mode === 'ride') { duck = RIDERS.duck; tip = 0; } };
  const _dq = new THREE.Quaternion(), _dp = new THREE.Quaternion(), _dq2 = new THREE.Quaternion(), _da = new THREE.Vector3();
  // a bone bent about a world axis (in its parent's frame), as the player's waist turns (src/player.js)
  function bendAbout(bone, axis, angle) {
    if (!bone || !bone.parent) return;
    bone.parent.getWorldQuaternion(_dp);
    _dq2.setFromAxisAngle(axis, angle);
    bone.quaternion.premultiply(_dp.clone().invert().multiply(_dq2).multiply(_dp));
    bone.updateMatrixWorld(true);
  }
  function poseDuck(dt) {
    if (duck <= 0) return;
    duck = Math.max(0, duck - dt);
    const f = 1 - duck / RIDERS.duck, k = f < 0.18 ? ease(f / 0.18) : ease(Math.max(0, Math.min(1, 1 - (f - 0.45) / 0.55)));   // (down fast, held, up slowly)
    person.root.updateMatrixWorld(true);
    person.root.getWorldQuaternion(_dq); _da.set(1, 0, 0).applyQuaternion(_dq);   // (his left: bending about it tips him forward)
    const b = person.bones;
    bendAbout(b.Abdomen, _da, 0.55 * k);
    bendAbout(b.Chest, _da, 0.35 * k);
    bendAbout(b.Head, _da, 0.25 * k);
  }
  const _q = new THREE.Quaternion(), _e = new THREE.Euler();
  function poseTip(dt) {
    if (tip <= 0) return;
    tip = Math.max(0, tip - dt);
    const f = 1 - tip / RIDERS.tip, k = Math.sin(Math.min(1, f) * Math.PI);   // up and back down
    const b = person.bones;
    // the right hand up to the front of the hat's brim, the elbow out to the side: whatever the riding clip had the arm
    // doing, the arm is aimed there (a two-bone reach), blended in and out
    if (b.UpperArmR && b.LowerArmR && b.WristR && b.Head) reach(b.UpperArmR, b.LowerArmR, b.WristR, b.Head, k);
    if (b.Head) { _q.setFromEuler(_e.set(0.25 * k, 0, 0)); b.Head.quaternion.multiply(_q); }
    const hat = person.hat;
    if (hat) { hat.position.y = (hat.userData.y0 ?? (hat.userData.y0 = hat.position.y)) + 0.05 * k; hat.rotation.x = -0.35 * k; }
  }
  // aims the upper arm and the forearm (each bone's length runs along its own +y) so the wrist comes to the hat's brim
  const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _T = new THREE.Vector3(), _W = new THREE.Vector3(), _d = new THREE.Vector3(), _pole = new THREE.Vector3();
  const _rq = new THREE.Quaternion(), _fw = new THREE.Vector3(), _rt = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function reach(upper, lower, wrist, head, k) {
    person.root.updateMatrixWorld(true);
    upper.getWorldPosition(_S); lower.getWorldPosition(_E); wrist.getWorldPosition(_W);
    const a = _S.distanceTo(_E), bl = _E.distanceTo(_W);
    person.root.getWorldQuaternion(_rq);
    _fw.set(0, 0, 1).applyQuaternion(_rq); _rt.set(-1, 0, 0).applyQuaternion(_rq);
    head.getWorldPosition(_T).addScaledVector(_up, 0.1).addScaledVector(_rt, 0.12).addScaledVector(_fw, 0.12);
    _d.subVectors(_T, _S); const d = Math.min(_d.length(), (a + bl) * 0.995); _d.normalize();
    _pole.copy(_rt).addScaledVector(_fw, 0.5).addScaledVector(_up, -0.3);
    _pole.addScaledVector(_d, -_pole.dot(_d)).normalize();
    const along = (a * a - bl * bl + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - along * along));
    _E.copy(_S).addScaledVector(_d, along).addScaledVector(_pole, h);
    _T.copy(_S).addScaledVector(_d, d);
    aim(upper, _E.clone().sub(_S), k);
    upper.updateMatrixWorld(true);
    lower.getWorldPosition(_W);
    aim(lower, _T.sub(_W), k);
  }
  const _bq = new THREE.Quaternion(), _pq2 = new THREE.Quaternion(), _y = new THREE.Vector3(), _q0 = new THREE.Quaternion();
  function aim(bone, dir, k) {
    bone.getWorldQuaternion(_bq);
    _y.set(0, 1, 0).applyQuaternion(_bq);
    _q.setFromUnitVectors(_y, dir.normalize()).multiply(_bq);       // (the bone's turn in the world, then into its parent's)
    bone.parent.getWorldQuaternion(_pq2);
    _q.premultiply(_pq2.invert());
    _q0.copy(bone.quaternion);
    bone.quaternion.slerpQuaternions(_q0, _q, k);
  }

  // ── PULLED FROM THE SADDLE, THEN HOGTIED ────────────────────────────────────────────────────────────────────────
  // at: where the roper is (a Vector3 or { x, z }); onDown(): called once the rider is tied on the ground
  R.fall = (at, { onDown = null, shot = false } = {}) => {
    if (R.mode !== 'ride') return false;
    if (shot) return knockDown(at, onDown);
    R.mode = 'fall'; tip = 0;
    person.root.updateWorldMatrix(true, false);
    // the side toward the roper, a body's length from the horse's middle
    const toX = at.x - R.x, toZ = at.z - R.z, side = Math.sign(Math.cos(R.heading) * toX - Math.sin(R.heading) * toZ) || 1;
    const out = 1.5, lx = R.x + Math.cos(R.heading) * side * out, lz = R.z - Math.sin(R.heading) * side * out;
    // lying face down, the head toward the roper (as if dragged that way), feet behind
    const head = Math.atan2(at.x - lx, at.z - lz), fit = lieOn(lx, lz, head);
    fall = { t: 0, from: person.root.position.clone(), fromQ: person.root.quaternion.clone(), to: new THREE.Vector3(lx, fit.y, lz), tilt: fit.tilt, head, onDown };
    person.play('Idle', { fade: 0.2 });
    // the horse, riderless, gallops off away from the roper
    R.mode = 'fall'; bolt = RIDERS.bolt; R.boltDir = Math.atan2(R.x - at.x, R.z - at.z) + side * 0.5;
    if (person.hat && person.hat.userData.y0 != null) { person.hat.position.y = person.hat.userData.y0; person.hat.rotation.x = 0; }
    return true;
  };
  // ── KNOCKED FROM THE SADDLE BY A SHOT, THEN HANDS UP ─────────────────────────────────────────────────────────────
  // He goes off the far side from the shooter, tumbling, lands flat on his back with his feet toward the shooter (a puff
  // of dust), sits up dazed with his hat knocked askew, and puts his hands up, facing the shooter. Placed by his hips
  // (whatever the clip does with the root): the hips follow the arc, then sit on the ground.
  const _kh = new THREE.Vector3(), _kq = new THREE.Quaternion(), _kq2 = new THREE.Quaternion(), _kq3 = new THREE.Quaternion(), _ke = new THREE.Euler();
  const _kx = new THREE.Vector3(1, 0, 0), _ky = new THREE.Vector3(0, 1, 0);
  function knockDown(at, onDown) {
    R.mode = 'fall'; R.shot = true; tip = 0; duck = 0;
    const T = RIDERS.shot;
    person.root.updateMatrixWorld(true);
    const toX = at.x - R.x, toZ = at.z - R.z, side = -(Math.sign(Math.cos(R.heading) * toX - Math.sin(R.heading) * toZ) || 1);   // (away from the shooter)
    const lx = R.x + Math.cos(R.heading) * side * T.out, lz = R.z - Math.sin(R.heading) * side * T.out;
    const face = Math.atan2(at.x - lx, at.z - lz);
    const hips = person.bones.Hips ? person.bones.Hips.getWorldPosition(new THREE.Vector3()) : person.root.position.clone().setY(person.root.position.y + 1);
    knock = { t: 0, from: hips, fromQ: person.root.quaternion.clone(), to: new THREE.Vector3(lx, W.heightAt(lx, lz) + 0.13, lz), face, onDown, landed: false, done: false,
      roll: new THREE.Vector3(lx - R.x, 0, lz - R.z).normalize() };
    person.play('Idle', { fade: 0.15 });
    if (person.hat && person.hat.userData.y0 != null) { person.hat.position.y = person.hat.userData.y0; person.hat.rotation.x = 0; }
    // the horse, riderless, trots off away from the shooter
    bolt = T.bolt; R.boltDir = Math.atan2(R.x - at.x, R.z - at.z) - side * 0.5; R.trot = true;
    return true;
  }
  // his hips put at `want` (the clip and poses already laid on): the root moved by however far the hips are off
  function hipsAt(want) {
    person.root.updateMatrixWorld(true);
    if (!person.bones.Hips) { person.root.position.copy(want); return; }
    person.bones.Hips.getWorldPosition(_kh);
    person.root.position.add(_kh.subVectors(want, _kh));
    person.root.updateMatrixWorld(true);
  }
  // sitting facing the shooter, leaning back by a (radians: about -1.45 is flat on his back, the feet up)
  const lean = (face, a) => _kq.setFromAxisAngle(_ky, face).multiply(_kq2.setFromAxisAngle(_kx, a));
  function stepKnock(dt) {
    const K = knock, T = RIDERS.shot; K.t += dt;
    const t1 = T.tumble, t2 = t1 + T.lie, t3 = t2 + T.sit, t4 = t3 + T.dazed, t5 = t4 + T.hands;
    person.update(dt);
    if (K.t < t1) {
      // the tumble: an arc off the horse, rolling over once along the way, knees tucked
      const f = K.t / t1, e = ease(f);
      const at = new THREE.Vector3().lerpVectors(K.from, K.to, e); at.y += Math.sin(f * Math.PI) * 0.5;
      person.root.quaternion.slerpQuaternions(K.fromQ, lean(K.face, -1.45), e).premultiply(_kq3.setFromAxisAngle(K.roll, -Math.PI * 2 * e));
      tiePose(person, Math.sin(f * Math.PI), TUCK);
      hipsAt(at);
      return;
    }
    if (!K.landed) { K.landed = true; if (!dust) dust = makeDust(scene); dust.puff({ x: K.to.x, y: K.to.y - 0.13, z: K.to.z }, { n: 7, size: 1.1 }); }
    if (K.t < t2) person.root.quaternion.copy(lean(K.face, -1.45));
    else if (K.t < t3) person.root.quaternion.copy(lean(K.face, -1.45 + 1.33 * ease((K.t - t2) / T.sit)));   // (sitting up)
    else person.root.quaternion.copy(lean(K.face, -0.12));
    sitLegs(person, 1);
    // dazed: his head wobbles a moment; then the hands go up
    const b = person.bones;
    if (K.t >= t2 && b.Head) {
      const w = Math.max(0, 1 - Math.max(0, K.t - t3) / (T.dazed + T.hands)) * Math.min(1, (K.t - t2) / 0.3);
      b.Head.quaternion.multiply(_kq3.setFromEuler(_ke.set(0.15 * w * Math.sin(K.t * 7), 0, 0.25 * w * Math.sin(K.t * 4.5))));
    }
    hipsAt(K.to);
    if (K.t >= t4) handsUp(person, ease(Math.min(1, (K.t - t4) / T.hands)));
    if (K.t >= t2) askew(Math.min(1, (K.t - t2) / 0.25));
    if (K.t >= t5 && !K.done) {
      K.done = true; R.mode = 'down'; down = { t: 0, sit: true };
      const cb = K.onDown; if (cb) cb();
    }
  }
  // his hat knocked askew by the fall (tipped over one ear and back)
  function askew(k) {
    const hat = person.hat; if (!hat) return;
    const y0 = hat.userData.y0 ?? (hat.userData.y0 = hat.position.y);
    hat.position.y = y0 + 0.03 * k; hat.rotation.set(-0.25 * k, 0, 0.42 * k);
  }
  // sitting with his hands up: a little sway, and now and then a look round
  function stepSit(dt) {
    down.t += dt; wriggle += dt;
    person.root.quaternion.copy(lean(knock.face, -0.12 + 0.03 * Math.sin(wriggle * 1.3)));
    person.update(dt);
    sitLegs(person, 1);
    const b = person.bones;
    if (b.Head) b.Head.quaternion.multiply(_kq3.setFromEuler(_ke.set(0, 0.35 * Math.sin(wriggle * 0.5) ** 3, 0)));
    hipsAt(knock.to);
    handsUp(person, 1);
    askew(1);
  }

  // the rope from the wrists to the ankles, made once the rider is down
  let rope = null;
  function tieRope() {
    const b = person.bones; if (!b.WristL || !b.FootL) return;
    person.root.updateMatrixWorld(true);
    const w = b.WristL.getWorldPosition(new THREE.Vector3()).add(b.WristR.getWorldPosition(tmp)).multiplyScalar(0.5);
    const f = b.FootL.getWorldPosition(new THREE.Vector3()).add(b.FootR.getWorldPosition(tmp2)).multiplyScalar(0.5);
    const len = w.distanceTo(f);
    const g = new THREE.CylinderGeometry(0.018, 0.018, Math.max(0.05, len), 5, 1); g.translate(0, len / 2, 0);
    rope = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.9 }));
    rope.position.copy(w); rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), f.sub(w).normalize());
    // (kept with the person, so the wriggle moves it too)
    person.root.worldToLocal(rope.position); rope.quaternion.premultiply(person.root.getWorldQuaternion(_q).invert());
    person.root.add(rope);
  }
  // lying face down from (lx, lz) toward `head` on the ground as it really is there: the body tilts with the ground under
  // its knees, hips and head, and is lifted clear of any bump between. (Lying down, the feet end is at the root: the
  // knees are about 0.5 m from it, the hips 0.9 m and the head 1.55 m.)
  const _n = new THREE.Vector3(), _skyUp = new THREE.Vector3(0, 1, 0);
  function lieOn(lx, lz, head) {
    const fx = Math.sin(head), fz = Math.cos(head), rx = Math.cos(head), rz = -Math.sin(head), sc = person.root.scale.y || 1;
    const spots = [[0.5, 0], [1.55, 0], [0.9, -0.3], [0.9, 0.3], [0.5, -0.2], [0.5, 0.2], [1.2, 0]];
    const hs = spots.map(([d, sd]) => W.heightAt(lx + (fx * d + rx * sd) * sc, lz + (fz * d + rz * sd) * sc));
    const along = (hs[1] - hs[0]) / (1.05 * sc), across = (hs[3] - hs[2]) / (0.6 * sc);
    const md = spots.reduce((a, s) => a + s[0], 0) / spots.length, mh = hs.reduce((a, h) => a + h, 0) / hs.length;
    const plane = (d, sd) => mh + along * (d - md) * sc + across * sd * sc;
    let lift = 0; spots.forEach(([d, sd], i) => { lift = Math.max(lift, hs[i] - plane(d, sd)); });
    _n.set(-(along * fx + across * rx), 1, -(along * fz + across * rz)).normalize();
    return { y: plane(0, 0) + RIDERS.lieUp + lift, tilt: new THREE.Quaternion().setFromUnitVectors(_skyUp, _n) };
  }
  const _down = new THREE.Quaternion();
  function stepFall(dt) {
    fall.t += dt;
    const f = Math.min(1, fall.t / RIDERS.fall), e = ease(f), to = fall.to;
    _down.setFromEuler(_e.set(Math.PI / 2, fall.head, 0, 'YXZ')).premultiply(fall.tilt);
    person.root.position.lerpVectors(fall.from, to, e); person.root.position.y += Math.sin(f * Math.PI) * 0.35;
    person.root.quaternion.slerpQuaternions(fall.fromQ, _down, ease(Math.min(1, f * 1.2)));
    const tieF = Math.max(0, Math.min(1, (fall.t - RIDERS.fall * 0.6) / RIDERS.tie));
    person.update(dt);
    tiePose(person, tieF);
    if (fall.t >= RIDERS.fall + RIDERS.tie) {
      R.mode = 'down'; down = { t: 0, base: person.root.position.clone(), q: person.root.quaternion.clone() };
      tieRope();
      const cb = fall.onDown; fall = null; if (cb) cb();
    }
  }
  function stepDown(dt) {
    down.t += dt; wriggle += dt;
    // a wriggle every few seconds: a little roll side to side
    const w = Math.max(0, Math.sin(wriggle * 0.9)) ** 8 * Math.sin(wriggle * 14) * 0.07;
    person.root.quaternion.copy(down.q).multiply(_q.setFromEuler(_e.set(0, w, 0)));
    person.update(dt);
    tiePose(person, 1);
  }

  R.steed = st;   // (the new horse, when the governor has every horse new: its look by how far it is from the player)
  R.update = (dt) => {
    if (st && W.camTarget) st.look(W.camTarget);
    if (R.mode === 'ride') {
      placeHorse(dt); clips();
      a.update(dt); person.update(dt); syncRide();
      seatRider(a, person);
      poseTip(dt);
      poseDuck(dt);
      return;
    }
    if (dust) dust.update(dt);
    // the riderless horse gallops off, then is put away
    if (bolt > 0) {
      bolt -= dt;
      const v = R.trot ? Math.min(RIDERS.shot.trot, R.speed + 3 * dt) : Math.min(9, R.speed + 6 * dt);   // (a shot one's horse trots off)
      R.speed = v; R.heading = wrapA(R.heading + wrapA(R.boltDir - R.heading) * Math.min(1, 2 * dt));
      const nx = R.x + Math.sin(R.heading) * v * dt, nz = R.z + Math.cos(R.heading) * v * dt;
      if (!W.blocked(nx, nz)) { R.x = nx; R.z = nz; }
      placeHorse(dt); clips(); a.update(dt);
      if (bolt <= 0) a.root.visible = false;
    }
    if (R.mode === 'fall') { if (knock) stepKnock(dt); else stepFall(dt); }
    else if (R.mode === 'down') { if (knock) stepSit(dt); else stepDown(dt); }
  };
  R.horseGone = () => bolt <= 0;
  // shown or put out of sight (far from the player: nothing of it is drawn or moved meanwhile)
  R.show = (on) => { person.root.visible = on; a.root.visible = on && !(R.mode !== 'ride' && bolt <= 0); if (!on) label.visible = false; };
  R.dispose = () => {
    R.mode = 'gone';
    label.removeFromParent(); label.material.dispose(); label.userData.tex.dispose();
    // (the bag's and the kerchief's materials are let go, not disposed: the shader programs they share with every other
    // rider stay built, so the next rider that comes into range draws without building them again in one frame)
    bag.removeFromParent(); bagTex.dispose();
    kc.removeFromParent();
    if (rope) { rope.removeFromParent(); rope.geometry.dispose(); rope.material.dispose(); }
    if (dust) { dust.dispose(); dust = null; }
    if (st) st.dispose(); else a.dispose();
    person.dispose();
  };
  return R;
}
// a coat for a rider's new horse: the pen's pool, its common and less common part
function roadCoat() {
  for (let k = 0; k < 24; k++) { const h = rollPenHorse(1 + Math.floor(Math.random() * 1e6)); if (h.rarity === 'common' || h.rarity === 'less') return h.recipe; }
  return 'bay';
}
