// ANIMALS: the horses, cattle, deer, dogs and wolves (Quaternius' animal pack, prepared into models/animals/ by
// ~/pw/bandit-math/rigs/animals_bm.mjs: one skinned mesh each, its colours in the vertices, so an animal draws in one go).
// The files keep the pack's own size; animals.json says how much to scale each one to its real size, which way it faces
// (+Z, all of them), where a saddle sits, where a rope goes round the neck, and how fast each walk and gallop carries it.
//
//   loadAnimals(base, { kinds }) -> Promise<lib>   base: the game's folder (default: found from this file), its models/
//                                                  folder, or the animals folder itself. kinds: only these (default: all)
//   lib.need(kind) -> Promise                       loads one more kind later
//   makeAnimal(lib, kind, { shadows, tint }) -> animal
//                tint: a colour laid over the whole coat (multiplied: '#e8dccb' a shade paler and warmer, '#b0a49a' darker),
//                so a herd isn't all one cow. Without it every animal of a kind shares one material
//     .root        place and turn it: standing on y = 0, facing +Z, real size (the model inside is scaled)
//     .play(name, { fade, speed, once })   crossfades to a clip (the same one again only changes its speed)
//     .update(dt)  steps its clips
//     .height      metres at the shoulder (withers); .tall to the top of the head; .length nose to tail
//     .stride      { Walk, Gallop } (the dogs: + Trot): metres a second the clip carries it at speed 1, measured on the
//                  feet that are down (play at speed = pace / stride and the feet keep to the ground)
//     .pace(v, idle)   plays the clip for going at v m/s, at the speed that keeps its feet on the ground (gaitFor
//                  below), blending into it over a quarter second; idle: the clip when it stands (default Idle)
//     .seat(v)     where the saddle sits on the back, in the world, this frame (it rides the back as it moves)
//     .neck(v)     where a rope loops round the neck, in the world, this frame; .neckRadius in metres
//     .saddle      the saddle it wears (see saddleOn), or null
//     .bones       { name: bone } (three.js drops the dots: FrontShoulder.L is bones.FrontShoulderL)
//     .clips       the clip names: Idle, Idle_2, Idle_Headlow, Walk, Gallop, Gallop_Jump, Jump_toIdle, Eating, Death,
//                  Idle_HitReact1, Idle_HitReact2, and Attack_Headbutt + Attack_Kick (hooves) or Attack (dogs, wolf).
//                  There is no trot: Walk sped up stands in for one. The dogs also have a Trot, Sit_Down and Lie_Down
//                  (once: standing to sitting, sitting to lying) and Sit and Lie (loops), made for the game in Blender
//                  (~/pw/bandit-math/rigs/animals/build_dog_clips.py).
//                  The farm animals (FARM_KINDS, a different pack on its own skeleton) have Idle, Walk, WalkSlow,
//                  Gallop (that pack's run), Jump and Death; the pug also has Trot, Sit_Down, Sit, Lie_Down and Lie
//                  (its lie is a sploot, back legs stretched out behind). Their bones: Body, Torso (the seat), Neck,
//                  Head (the rope loops round the neck just behind it), FrontFoot / BackFoot (hooves and paws).
//   gaitFor(animal, v, current) -> [clip, speed]   the clip and its speed for going at v m/s (see GAIT)
//   saddleOn(animal, saddleScene)   hangs a saddle on the back (it follows the back through every clip)
//   sitOn(animal, person, { dt })   puts a rider on it each frame (on the saddle's seat when it wears one)
//   seatOf(animal, v)               where a rider sits on it, in the world, this frame
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { softShade } from './shading.js';

export const KINDS = ['horse', 'horseWhite', 'donkey', 'cow', 'bull', 'deer', 'stag', 'shiba', 'husky', 'wolf'];
// the farm pack (models/animals/farm/, from the pack's .blend files): not in the world yet, except the pug as a dog
export const FARM_KINDS = ['farmCow', 'farmHorse', 'pig', 'sheep', 'pug'];
// coat tints for a herd (makeAnimal's tint): as made, then paler and darker, warmer and duller, so no two cows match
export const COATS = ['#ffffff', '#f2e2cc', '#c9b6a0', '#e6c7a6', '#a8968a', '#d9cfc4', '#8f7f72', '#fff0dc'];
const GAME = new URL('../../', import.meta.url).href;      // (src/actors/ -> the game's own folder)

// GAITS: which clip an animal plays at a pace, and how fast. Within a gait the clip's speed is exactly the pace over the
// clip's stride, so a foot that is down stays put on the ground. Walk covers the slow paces and, sped up, stands in for a
// trot (the dogs have a Trot of their own: then Walk, Trot, Gallop); Gallop takes over at gallopAt (a share of the
// Gallop's own pace: slower than that a gallop looks like slow motion), or sooner if the gait below would have to go
// faster than `most` to get there, and hands back a little lower (back), so an animal going at about that pace doesn't
// flicker between the two. A clip is never played faster than `most`: past that the legs can't keep up and the feet
// slide (only a dog chasing a galloping horse goes that fast). animals.json can change any of these for one kind
// ("gait": { ... }).
export const GAIT = {
  still: 0.05,              // m/s: slower than this it stands
  trotAt: 0.6,              // Trot (where there is one) from this share of its stride
  gallopAt: 0.62,           // Gallop from this share of its stride (a cow: 0.62 x 3.4 m/s = 2.1 m/s, the Walk at 3x)
  back: 0.88,               // ... and back down a gait below this share of the pace it went up at
  most: { Walk: 3, Trot: 2.4, Gallop: 2.4 },
};
const mostOf = (g, clip) => (g.most && g.most[clip]) ?? GAIT.most[clip];
// (worked out into `out`, so the game's every-frame use makes nothing new)
function gaitInto(animal, v, current, out) {
  const st = animal.stride, g = animal.info.gait || {};
  if (v < (g.still ?? GAIT.still)) { out.clip = null; out.speed = 1; return out; }
  const back = g.back ?? GAIT.back, below = st.Trot ? 'Trot' : 'Walk';
  const toTrot = st.Trot ? Math.min((g.trotAt ?? GAIT.trotAt) * st.Trot, mostOf(g, 'Walk') * st.Walk) : Infinity;
  const toGallop = Math.min((g.gallopAt ?? GAIT.gallopAt) * st.Gallop, mostOf(g, below) * st[below]);
  let clip = 'Walk';
  if (v >= (current === 'Gallop' ? toGallop * back : toGallop)) clip = 'Gallop';
  else if (st.Trot && v >= (current === 'Trot' || current === 'Gallop' ? toTrot * back : toTrot)) clip = 'Trot';
  out.clip = clip; out.speed = Math.min(mostOf(g, clip), v / st[clip]);
  return out;
}
export function gaitFor(animal, v, current = animal.clip) {
  const o = gaitInto(animal, v, current, { clip: null, speed: 1 });
  return [o.clip, o.speed];
}
const _gait = { clip: null, speed: 1 };

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// the animals folder, from whichever folder the caller had to hand
function folderOf(base) {
  let b = String(base || GAME); if (!b.endsWith('/')) b += '/';
  if (/animals\/$/.test(b)) return b;
  if (/models\/$/.test(b)) return b + 'animals/';
  return b + 'models/animals/';
}

export async function loadAnimals(base, { kinds = null } = {}) {
  const dir = folderOf(base);
  const res = await fetch(dir + 'animals.json'); if (!res.ok) throw new Error('animals.json: ' + res.status);
  const info = (await res.json()).kinds;
  const lib = { dir, info, kinds: {}, loading: {} };
  lib.need = (kind) => {
    if (!info[kind]) return Promise.reject(new Error('no such animal: ' + kind));
    return lib.loading[kind] || (lib.loading[kind] = loader.loadAsync(dir + info[kind].file).then((g) => {
      // a shared material for every animal of a kind: the colours are in the vertices
      g.scene.traverse((o) => { if (o.isMesh && o.material) { o.material.vertexColors = true; o.material.roughness = 0.75; o.geometry = softShade(o.geometry); } });
      lib.kinds[kind] = { scene: g.scene, clips: g.animations, info: info[kind] };
      return lib.kinds[kind];
    }, (e) => { delete lib.loading[kind]; throw e; }));   // (a failed load is forgotten: the next need tries again)
  };
  await Promise.all((kinds || Object.keys(info)).map(lib.need));
  return lib;
}

export function makeAnimal(lib, kind, { shadows = true, tint = null } = {}) {
  const k = lib.kinds[kind];
  if (!k) throw new Error(lib.info[kind] ? `animal ${kind} is not loaded yet (lib.need('${kind}'))` : 'no such animal: ' + kind);
  const info = k.info;
  const root = new THREE.Group(); root.name = kind;
  const model = cloneSkinned(k.scene); model.scale.setScalar(info.scale); root.add(model);
  let mesh = null; const bones = {};
  model.traverse((o) => {
    if (o.isSkinnedMesh) {
      mesh = o; o.castShadow = shadows; o.receiveShadow = shadows;
      if (tint !== null && tint !== undefined) { o.material = o.material.clone(); o.material.color.set(tint); }
    }
    if (o.isBone) bones[o.name] = o;
  });
  const mixer = new THREE.AnimationMixer(model);
  const actions = {}; for (const c of k.clips) actions[c.name] = mixer.clipAction(c);
  let cur = null, curName = '';
  const seatBone = bones[info.seat.bone], seatAt = new THREE.Vector3().fromArray(info.seat.offset);
  const neckBone = bones[info.lasso.bone];
  const a = {
    root, model, mesh, bones, kind, info, mixer, actions,
    height: info.height, tall: info.tall, length: info.length, stride: info.stride, neckRadius: info.lasso.radius,
    clips: Object.keys(actions),
    get clip() { return curName; },
    play(name, { fade = 0.25, speed = 1, once = false } = {}) {
      const act = actions[name]; if (!act) return false;
      if (cur === act) { act.setEffectiveTimeScale(speed); return true; }
      act.reset(); act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); act.clampWhenFinished = once;
      act.setEffectiveTimeScale(speed).setEffectiveWeight(1); if (fade > 0) act.fadeIn(fade); act.play();
      if (cur) { if (fade > 0) cur.fadeOut(fade); else cur.stop(); }
      cur = act; curName = name; return true;
    },
    update(dt) { mixer.update(dt); },
    pace(v, idle = 'Idle') {
      gaitInto(a, v, curName, _gait);
      const name = _gait.clip || idle;
      if (cur === actions[name]) { if (_gait.clip) cur.setEffectiveTimeScale(_gait.speed); return true; }   // (no change of clip)
      return a.play(name, { fade: 0.25, speed: _gait.clip ? _gait.speed : 1 });
    },
    // (both read the bones as last drawn or last updated: call after update(dt) and root.updateMatrixWorld())
    seat(v = new THREE.Vector3()) { return seatBone.localToWorld(v.copy(seatAt)); },
    neck(v = new THREE.Vector3()) { return neckBone.getWorldPosition(v); },
    // (each animal's skeleton is its own copy, with a bone texture the renderer makes for it: freed here too)
    dispose() {
      mixer.stopAllAction(); mixer.uncacheRoot(model); if (tint !== null && tint !== undefined) mesh.material.dispose();
      model.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose(); });
      root.removeFromParent();
    },
  };
  // the seat bone as it stands at the start of Idle (the pose the seat was measured in), in the animal's own space: a
  // saddle is fitted to it once and then rides the bone
  actions.Idle.play(); mixer.update(0); model.updateMatrixWorld(true);
  a.seatRest = root.matrixWorld.clone().invert().multiply(seatBone.matrixWorld); actions.Idle.stop();
  a.saddle = null;
  a.play('Idle', { fade: 0 }); mixer.update(Math.random() * 2);        // (a herd shouldn't breathe in step)
  // a wider bound than the standing pose, so a galloping or falling animal isn't dropped at the screen's edge
  model.updateMatrixWorld(true); mesh.computeBoundingSphere(); mesh.boundingSphere.radius *= 1.35;
  return a;
}

// A SADDLE on an animal's back (the saddles, models/saddles/: horn toward +Z, real size in metres, the origin the
// point that rests on the back). It is hung on the back bone, fitted once to where the seat was measured, so it rides
// the back through every clip; it shows whether anybody is riding or not. saddle: the loaded file's scene (or a copy of
// it, for a second horse). at: a nudge in metres in the animal's own space ([across, up, forward]) if one ever needs it.
// Returns the holder (animal.saddle); saddleOn(animal, null) takes it off again.
//   SADDLE.seat: the low point of the seat in the saddle's own space, where a rider sits
export const SADDLE = { seat: [0, 0.145, -0.03] };
const _m = new THREE.Matrix4();
export function saddleOn(animal, saddle, { at = [0, 0, 0], shadows = true } = {}) {
  if (animal.saddle) { animal.saddle.removeFromParent(); animal.saddle = null; }
  if (!saddle) return null;
  const holder = new THREE.Group(); holder.name = 'saddle'; holder.add(saddle);
  saddle.traverse((o) => { if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = shadows; } });
  const s = animal.info.seat.at;
  // where it goes in the animal's own space (level, horn forward, metres), then into the bone's space as it stood then
  _m.makeTranslation(s[0] + at[0], s[1] + at[1], s[2] + at[2]).premultiply(animal.seatRest.clone().invert());
  _m.decompose(holder.position, holder.quaternion, holder.scale);
  animal.bones[animal.info.seat.bone].add(holder);
  return (animal.saddle = holder);
}

// A RIDER on an animal's back: turns the person to face where the animal faces and moves them so their hips sit over the
// seat: the saddle's when it wears one, else the bare back. Call it every frame after both have been updated (it reads
// the bones as they are now), with both added to the scene.
//   lift: how far the Hips bone sits above the seat (metres for a grown-up; scaled with the person). The default is
//         RIDE_HIPS for the person's skeleton: sitting astride in the Ride clips, the Hips bone is 3.7 cm above the low
//         point between the legs on the men's skeleton and 11.8 cm on the women's (measured), plus 4 cm the trousers and
//         the seat's give take up. (The formal dress's skirt hangs straight down: she isn't one to put on a horse.)
//   dt:   the frame's time. Given, the rider's own movement in the clip (the bob at a walk, the rise out of the saddle at
//         a gallop) still shows: it is the hips' place averaged over about `follow` seconds that is held over the seat.
//         Left out, the hips are pinned to the seat every frame. (A first call, or one after a break, always pins.)
export const RIDE_HIPS = { m: 0.08, f: 0.16 };
const _seat = new THREE.Vector3(), _hips = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _w = new THREE.Vector3();
const held = new WeakMap();      // person -> { at: the hips' averaged place in the person's own space, animal, time }
export function seatOf(animal, v = new THREE.Vector3()) {
  if (animal.saddle) return animal.saddle.localToWorld(v.fromArray(SADDLE.seat));
  return animal.seat(v);
}
export function sitOn(animal, person, { lift = RIDE_HIPS[person.body] ?? RIDE_HIPS.m, dt = 0, follow = 0.8 } = {}) {
  const root = person.root, parent = root.parent;
  const hips = person.bones.Hips; if (!hips) return;
  animal.root.updateWorldMatrix(true, true);
  animal.root.getWorldQuaternion(_q);
  if (parent) { parent.getWorldQuaternion(_pq); root.quaternion.copy(_pq.invert().multiply(_q)); } else root.quaternion.copy(_q);
  root.updateWorldMatrix(true, true);
  // the hips in the person's own space this frame, and the place held over the seat
  root.worldToLocal(hips.getWorldPosition(_hips));
  const now = performance.now(); let h = held.get(person);
  if (!h) held.set(person, (h = { at: new THREE.Vector3(), animal: null, time: 0 }));
  if (!dt || h.animal !== animal || now - h.time > 500) h.at.copy(_hips);
  else h.at.lerp(_hips, 1 - Math.exp(-dt / follow));
  h.animal = animal; h.time = now;
  seatOf(animal, _seat);
  root.getWorldScale(_w); _seat.y += lift * _w.y;
  // move the root by however far the held place is from the seat
  root.localToWorld(_hips.copy(h.at));
  root.getWorldPosition(_w).add(_seat).sub(_hips);
  if (parent) parent.worldToLocal(_w);
  root.position.copy(_w); root.updateWorldMatrix(false, true);
}
