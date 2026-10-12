// TOWN LIFE: a dozen chickens about the town square and the buildings, so the town isn't empty. Each one has a spot of
// its own near a building or the square: it walks a few steps, pecks at the ground, stands and looks about, and when
// the player, the horse or the dog comes close it scatters (running, wings flapping), then settles and wanders back.
// The chickens are Tripo models (models/animals/chicken_white|gold|black.glb), rigged and given their clips in
// Blender (~/pw/bandit-math/rigs/animals/chicken_rig.py): Idle, Walk, Peck, Run. Their legs keep to the ground: a clip
// plays at the pace over its stride (CHICKEN.stride, measured on the feet).
//
//   townLife(W, dt, P, D)   the one call the game makes each frame: the flock is made on the first call (its files load
//                           in the background, nothing shows until they have) and moved after. P: the player (or null:
//                           on the title screen the chickens just potter about), D: the dog (or null). dt 0: held still
//   townLifeNow()           the flock townLife made (or null)
//   makeTownLife({ W, scene, count, spots }) -> T   the same flock for a page of its own:
//     T.update(dt, P, D)    T.ready (a promise)    T.chickens (their records)    T.state()    T.dispose()
//   loadChickens(base) -> Promise<lib>;  makeChicken(lib, kind) -> { root, play(name, fade, speed), update(dt), clip }
//   CHICKEN                 the numbers: how many, how big, how fast, how near something scares one
// Cheap: nothing is made new each frame, and the far ones are moved a few times a second (or not at all out of sight).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export const CHICKEN = {
  count: 12,
  kinds: ['white', 'white', 'gold', 'gold', 'gold', 'black'],   // picked at random: more white and gold than black
  size: [0.88, 1.08],          // each one this much smaller or bigger than the file's hen (0.42 m to the top of the comb)
  stride: { Walk: 0.235, Run: 0.906 },   // m/s the Walk and Run clips carry it at speed 1 (measured: a foot that is down stays put)
  walk: [0.2, 0.34],           // m/s a pottering chicken goes
  run: [1.7, 2.4],             // m/s a scattering one
  runFrom: 0.75,               // m/s: faster than this it runs (the Walk clip would have to go faster than about 3x)
  roam: 6,                     // it wanders this far from its spot (m)
  // how close a mover scares it (m): a person on foot, a horse, the dog; half as far if the mover is standing still
  scare: { foot: 3, horse: 5.5, dog: 3.6 },
  panic: 2.2,                  // a chicken that bolts sets off the others this close to it (m)
  calm: [1.0, 1.8],            // seconds it runs before it settles (it keeps running while the mover is still close)
  ruffleAt: 1.8,               // seconds into its Idle clip just before it ruffles its wings (2.0 to 2.5 s)
  settle: [1.2, 2.6],          // seconds it stands (and shakes its feathers) after a scare, counted from when it stops
  shadowNear: 15,              // only the chickens this close to the camera's target cast a shadow (m): a 0.4 m bird's
                               // shadow can't be seen further off, and each one is another thing to draw
  turn: { walk: 5, run: 10 },  // radians a second it turns
  // from the camera's target (the player): every frame within near, a few times a second out to far, rarely beyond, and
  // not drawn past gone
  near: 35, far: 80, gone: 150,
};
const GAME = new URL('../', import.meta.url).href;      // (src/ -> the game's own folder)
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const rnd = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function loadChickens(base = GAME, kinds = ['white', 'gold', 'black']) {
  let b = String(base); if (!b.endsWith('/')) b += '/';
  const dir = /animals\/$/.test(b) ? b : b + 'models/animals/';
  const lib = { kinds: {} };
  return Promise.all(kinds.map((k) => loader.loadAsync(dir + 'chicken_' + k + '.glb').then((g) => { lib.kinds[k] = { scene: g.scene, clips: g.animations }; })))
    .then(() => lib);
}

export function makeChicken(lib, kind, { shadows = true } = {}) {
  const k = lib.kinds[kind] || Object.values(lib.kinds)[0];
  const root = new THREE.Group(); root.name = 'chicken-' + kind;
  const model = cloneSkinned(k.scene); root.add(model);
  const meshes = [];
  model.traverse((o) => { if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = false; meshes.push(o); } });
  const mixer = new THREE.AnimationMixer(model), actions = {};
  for (const c of k.clips) actions[c.name] = mixer.clipAction(c);
  let cur = null, curName = '';
  const ch = {
    root, model, mixer, actions, kind, shadow: shadows,
    get clip() { return curName; },
    // its shadow on or off (only changed when it changes)
    setShadow(on) { if (on === ch.shadow) return; ch.shadow = on; for (const m of meshes) m.castShadow = on; },
    play(name, fade = 0.2, speed = 1) {
      const act = actions[name]; if (!act) return false;
      if (cur === act) { act.setEffectiveTimeScale(speed); return true; }
      act.reset(); act.setEffectiveTimeScale(speed).setEffectiveWeight(1); if (fade > 0) act.fadeIn(fade); act.play();
      if (cur) { if (fade > 0) cur.fadeOut(fade); else cur.stop(); }
      cur = act; curName = name; return true;
    },
    update(dt) { mixer.update(dt); },
  };
  ch.play('Idle', 0); mixer.update(Math.random() * 3);     // (a flock shouldn't move in step)
  return ch;
}

// where the chickens live: in the square and beside the buildings' doors (out of the doorway, a few metres to the side)
function spotsOf(W) {
  const p = W.places, out = [];
  const sq = p.square || p.spawn;
  if (sq) out.push({ x: sq.x + 4, z: sq.z + 2, r: CHICKEN.roam + 1, share: 3 });
  for (const [k, share] of [['store', 3], ['stable', 3], ['cabin', 2], ['sheriff', 1]]) {
    const b = p[k]; if (!b || !b.door) continue;
    const dx = b.door.x - b.x, dz = b.door.z - b.z, d = Math.hypot(dx, dz) || 1, ox = dx / d, oz = dz / d;
    // out from the door, then to one side: the first of these places that isn't in a wall
    for (const [f, s] of [[4, 4], [4, -4], [6, 0], [3, 6], [3, -6]]) {
      const x = b.door.x + ox * f - oz * s, z = b.door.z + oz * f + ox * s;
      if (!W.blocked(x, z)) { out.push({ x, z, r: CHICKEN.roam, share }); break; }
    }
  }
  return out;
}

export function makeTownLife({ W, scene = W.scene, count = W.tier === 'potato' ? 8 : CHICKEN.count, spots = null }) {
  const T = { chickens: [], ready: null, loaded: false };
  const shadows = W.tier !== 'potato';
  const S = spots || spotsOf(W);
  // the movers that scare chickens: their places and how fast they go (kept from frame to frame, made once)
  const movers = [0, 1, 2].map(() => ({ on: false, x: 0, z: 0, px: 0, pz: 0, vx: 0, vz: 0, v: 0, scare: 0, seen: false }));
  T.ready = loadChickens(GAME).then((lib) => {
    const total = S.reduce((a, s) => a + s.share, 0) || 1;
    let made = 0;
    S.forEach((s, i) => {
      const n = i === S.length - 1 ? count - made : Math.round(count * s.share / total);
      for (let j = 0; j < n && made < count; j++, made++) {
        const kind = CHICKEN.kinds[Math.floor(Math.random() * CHICKEN.kinds.length)];
        const ch = makeChicken(lib, kind, { shadows });
        ch.root.scale.setScalar(rnd(CHICKEN.size[0], CHICKEN.size[1]));
        const c = { ch, home: s, x: s.x, z: s.z, h: Math.random() * Math.PI * 2, v: 0, want: 0, state: 'stand', t: rnd(0.5, 3),
          tx: 0, tz: 0, from: -1, acc: 0, n: 0 };
        // a free place near its spot to start from
        for (let k = 0; k < 12; k++) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * s.r * 0.8, x = s.x + Math.sin(a) * r, z = s.z + Math.cos(a) * r;
          if (!W.blocked(x, z) && W.waterAt(x, z) < 0.2) { c.x = x; c.z = z; break; }
        }
        ch.root.position.set(c.x, W.heightAt(c.x, c.z), c.z); ch.root.rotation.y = c.h;
        scene.add(ch.root); T.chickens.push(c);
      }
    });
    T.loaded = true;
  }).catch((e) => console.warn('town life: the chickens could not load', e));

  // a new place to walk to, near its spot (and not in a wall or the creek)
  function pickTarget(c) {
    const s = c.home;
    for (let k = 0; k < 8; k++) {
      // mostly a short way from where it is, drawn back toward its spot when it has strayed
      const a = Math.random() * Math.PI * 2, r = rnd(0.5, 2.2);
      let x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r;
      const dh = Math.hypot(x - s.x, z - s.z);
      if (dh > s.r) { x = s.x + (x - s.x) * s.r / dh * 0.8; z = s.z + (z - s.z) * s.r / dh * 0.8; }
      if (!W.blocked(x, z) && W.waterAt(x, z) < 0.2) { c.tx = x; c.tz = z; return true; }
    }
    return false;
  }
  function begin(c, state) {
    c.state = state;
    if (state === 'walk') { if (!pickTarget(c)) return begin(c, 'stand'); c.want = rnd(CHICKEN.walk[0], CHICKEN.walk[1]); }
    else if (state === 'peck') { c.want = 0; c.v = 0; c.t = 1.4 * Math.ceil(rnd(1.01, 4)); c.ch.play('Peck', 0.2); }
    else if (state === 'stand') { c.want = 0; c.v = 0; c.t = rnd(2, 6); }
    else if (state === 'settle') {
      // it slows to a stop, then stands and shakes its feathers (animate starts Idle just before its ruffle)
      c.want = 0; c.t = rnd(CHICKEN.settle[0], CHICKEN.settle[1]); c.ruffled = false;
    }
    else if (state === 'run') { c.want = rnd(CHICKEN.run[0], CHICKEN.run[1]); c.t = rnd(CHICKEN.calm[0], CHICKEN.calm[1]); }
  }
  // the clip for its pace (Walk or Run at the speed that keeps its feet on the ground), or for what it is doing standing
  function animate(c) {
    const ch = c.ch, st = CHICKEN.stride;
    if (c.v > 0.04) {
      if (c.v < CHICKEN.runFrom) ch.play('Walk', 0.15, c.v / st.Walk);
      else ch.play('Run', 0.12, c.v / st.Run);
    } else if (c.state === 'peck') ch.play('Peck', 0.2);
    else if (c.state === 'settle' && !c.ruffled) {
      // stopped after a scare: Idle from just before its wing ruffle (once; play() keeps Idle going if it is on already)
      ch.play('Idle', 0.2); ch.actions.Idle.time = CHICKEN.ruffleAt; c.ruffled = true;
    } else ch.play('Idle', 0.25);
  }
  // the movers this frame: the player (on foot or on the horse), the horse when nobody rides it, the dog
  function setMover(m, dt, x, z, scare) {
    if (!m.seen) { m.px = x; m.pz = z; m.seen = true; }
    m.vx = dt > 0 ? (x - m.px) / dt : 0; m.vz = dt > 0 ? (z - m.pz) / dt : 0; m.v = Math.hypot(m.vx, m.vz);
    if (m.v > 40) { m.v = m.vx = m.vz = 0; }   // (a jump to another place isn't speed)
    m.px = x; m.pz = z; m.x = x; m.z = z; m.scare = scare; m.on = true;
  }
  function readMovers(dt, P, D) {
    for (let i = 0; i < movers.length; i++) movers[i].on = false;
    if (P && P.position) setMover(movers[0], dt, P.position.x, P.position.z, P.onHorse ? CHICKEN.scare.horse : CHICKEN.scare.foot);
    else movers[0].seen = false;
    const H = P && !P.onHorse && P.horse && P.horse.root;
    if (H) setMover(movers[1], dt, H.position.x, H.position.z, CHICKEN.scare.horse); else movers[1].seen = false;
    if (D && D.dog) setMover(movers[2], dt, D.position.x, D.position.z, CHICKEN.scare.dog); else movers[2].seen = false;
  }
  // the nearest mover close enough to scare this chicken (its index, or -1)
  function threat(c) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < movers.length; i++) {
      const m = movers[i]; if (!m.on) continue;
      const d = Math.hypot(c.x - m.x, c.z - m.z), r = m.scare * (m.v > 0.4 ? 1 : 0.5);
      if (d < r && d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function think(c, dt) {
    const s = c.home;
    const th = threat(c);
    if (th >= 0 && c.state !== 'run') {
      begin(c, 'run'); c.from = th;
      // one bolts, and the ones beside it go too
      for (let i = 0; i < T.chickens.length; i++) {
        const o = T.chickens[i];
        if (o !== c && o.state !== 'run' && Math.hypot(o.x - c.x, o.z - c.z) < CHICKEN.panic) { begin(o, 'run'); o.from = th; }
      }
    }
    let wantH = c.h;
    switch (c.state) {
      case 'run': {
        const m = movers[c.from];
        if (m && m.on) {
          // away from it, with a little dodge either way, and back toward its spot if it has run far
          wantH = Math.atan2(c.x - m.x, c.z - m.z) + Math.sin(c.n * 0.07) * 0.4;
          // something coming faster than it can run: out of its way, to the side, rather than straight ahead of it
          if (m.v > c.v + 0.5) {
            const side = m.vx * (c.z - m.z) - m.vz * (c.x - m.x) > 0 ? 1 : -1;
            wantH = Math.atan2(c.x - m.x - side * m.vz, c.z - m.z + side * m.vx);
          }
          const dh = Math.hypot(c.x - s.x, c.z - s.z);
          if (dh > s.r * 1.8) wantH += wrap(Math.atan2(s.x - c.x, s.z - c.z) - wantH) * 0.5;
          if (Math.hypot(c.x - m.x, c.z - m.z) < m.scare * 1.3) c.t = Math.max(c.t, 0.3);   // (still too close: keep going)
        }
        if ((c.t -= dt) <= 0) begin(c, 'settle');
        break;
      }
      case 'walk': {
        const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
        wantH = Math.atan2(dx, dz);
        if (d < 0.15) begin(c, Math.random() < 0.6 ? 'peck' : 'stand');
        else if (d < 0.5) c.want = Math.max(0.12, Math.min(c.want, d * 0.6));   // (slowing as it gets there)
        break;
      }
      case 'peck': case 'stand':
        if ((c.t -= dt) <= 0) begin(c, 'walk');
        break;
      case 'settle':   // (its time counts once it has stopped, so the feather shake is seen)
        if (c.v <= 0.04 && (c.t -= dt) <= 0) begin(c, 'walk');
        break;
      default: break;
    }
    // turn, then go: a step into a wall turns it instead
    const turn = c.state === 'run' ? CHICKEN.turn.run : CHICKEN.turn.walk;
    c.h += wrap(wantH - c.h) * Math.min(1, turn * dt);
    c.v += (c.want - c.v) * Math.min(1, (c.want > c.v ? 7 : 5) * dt);
    if (c.v > 0.02) {
      const step = c.v * dt, nx = c.x + Math.sin(c.h) * step, nz = c.z + Math.cos(c.h) * step;
      if (!W.blocked(nx, nz) && W.waterAt(nx, nz) < 0.3) { c.x = nx; c.z = nz; }
      else { c.h += (c.n & 1 ? 1 : -1) * 1.2; if (c.state === 'walk') begin(c, 'stand'); }
    }
    c.n++;
    animate(c);
    const r = c.ch.root;
    r.position.set(c.x, W.heightAt(c.x, c.z), c.z); r.rotation.y = c.h;
  }

  const target = new THREE.Vector3();
  T.update = (dt, P = null, D = null) => {
    if (!T.loaded || dt <= 0) return;
    readMovers(dt, P, D);
    if (W.camTarget) target.copy(W.camTarget); else if (P && P.position) target.copy(P.position);
    for (let i = 0; i < T.chickens.length; i++) {
      const c = T.chickens[i], d = Math.hypot(c.x - target.x, c.z - target.z);
      c.ch.root.visible = d < CHICKEN.gone;
      c.ch.setShadow(shadows && d < CHICKEN.shadowNear);
      // near ones every frame; further ones a few times a second (each in its own time, so they don't all go at once)
      c.acc += dt;
      const every = d < CHICKEN.near ? 0 : d < CHICKEN.far ? 0.12 : 0.6;
      if (c.acc < every) continue;
      const step = Math.min(c.acc, 0.6); c.acc = 0;
      think(c, step);
      if (c.ch.root.visible) c.ch.update(step);
    }
  };
  T.state = () => T.chickens.map((c) => ({ kind: c.ch.kind, state: c.state, clip: c.ch.clip, v: +c.v.toFixed(2), x: +c.x.toFixed(2), z: +c.z.toFixed(2) }));
  T.dispose = () => { for (const c of T.chickens) { c.ch.mixer.stopAllAction(); c.ch.root.removeFromParent(); } T.chickens.length = 0; };
  return T;
}

// the game's one call: a flock for the world, made the first time and moved every frame after (townLifeNow(): that
// flock, for a rig or a test page: T.state(), T.chickens)
let life = null;
export const townLifeNow = () => life;
export function townLife(W, dt, P = null, D = null) {
  if (!W) return null;
  if (!life || life.W !== W) { life = makeTownLife({ W }); life.W = W; }
  life.update(dt, P, D);
  return life;
}
