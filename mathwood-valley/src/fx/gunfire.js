// GUNFIRE at a hold-up (src/missions/wagonjob.js): the gang's revolvers and what their shots do, all made once and
// reused, so a shot costs no new geometry or material and nothing to put away:
//   the guns       one revolver (the range's, src/revolver.js makeGunModel, its parts merged into one shape) drawn for
//                  every rider at once: an instanced mesh, each rider's gun put in his fist each frame (one draw)
//   a flash        a soft bright star at the muzzle for a blink (a few sprites sharing one picture and one material)
//   smoke          a puff or two drifting off the muzzle (a small pool of sprites, each faded on its own)
//   splinters      a shot into the wagon's boards: a spray of little slivers of wood that tumble down and lie a moment
//                  (an instanced mesh: one draw for all of them)
//   dust           a shot into the dirt by the wheels: a puff of trail dust (src/fx/dust.js, pooled)
// No blood, no people hit: the shots go into the air, the wagon's boards or the ground.
//
//   const F = makeGunfire({ scene, tier, W })   tier: 'potato' | 'normal' | 'gaming' (fewer splinters and smoke on
//                       potato); W: the world, whose warm-up (W.warmFor) builds the shaders ahead, so the first shot
//                       doesn't stall a frame
//   F.guns(list, n)     each frame: the first n of [{ pos, dir, side }], the fists holding a gun (dir: the way the
//                       forearm points; side: the rider's own left, a Vector3, for which way is up on the gun); the
//                       rest are put away
//   F.muzzle(i, out)    where the muzzle of gun i (in this frame's list) is
//   F.flash(at, dir, far)   the flash and the smoke at a muzzle; far: m from the camera (a far one is drawn a little
//                       bigger, so it still reads as a shot from 30 m off)
//   F.splinters(at, out)   slivers off the boards at `at`, flying out along `out` (the board's face, outward)
//   F.dust(at)          a puff of dust on the ground at `at`
//   F.update(dt)        each frame;  F.state() for rigs;  F.dispose()
//   GUNFIRE             the sizes and timings
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeGunModel, puffPicture, GRIP } from '../revolver.js';
import { makeDust, DUST } from './dust.js';

export const GUNFIRE = {
  guns: 12,          // revolvers drawn at most (a hold-up's bunch is 9 at most, a few more riding in)
  scale: 1.8,        // drawn this much bigger than life, so it reads from the saddle at 10 to 40 m
  flash: 0.07,       // s a muzzle flash shows
  flashSize: 0.5,    // m across (at least `flashFar` of the distance from the camera)
  flashFar: 0.028,
  flashes: 4,        // in the pool
  smoke: { n: 8, life: 1.2, size: 0.55 },   // puffs in the pool, s each lasts, m across at its biggest
  slivers: { n: 48, per: 10, life: 1.8, speed: [1.5, 3.5] },   // in the pool, a shot's worth, s each lasts, m/s out
  potato: { per: 5, smoke: 1 },               // the potato tier: fewer slivers a shot, one puff of smoke
};

let gunGeo = null, gunMat = null, flashMap = null, smokeMap = null, sliverGeo = null, sliverMat = null;
// the revolver as one shape (its parts in place, the colours painted on its corners), and one material for it
function gunShape() {
  if (gunGeo) return gunGeo;
  const m = makeGunModel();
  m.gun.updateMatrixWorld(true);
  const parts = [];
  m.gun.traverse((o) => { if (o.isMesh) parts.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
  gunGeo = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  m.gun.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  m.metal.dispose(); m.matte.dispose();
  gunMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.5, flatShading: true });
  return gunGeo;
}

export function makeGunfire({ scene, tier = 'normal', W = null }) {
  const G = GUNFIRE, low = tier === 'potato';
  // ── THE GUNS ───────────────────────────────────────────────────────────────────────────────────────────────────
  const guns = new THREE.InstancedMesh(gunShape(), gunMat, G.guns);
  guns.name = 'gang-guns'; guns.frustumCulled = false; guns.castShadow = false; guns.count = 0;
  scene.add(guns);
  const muzzles = [];   // (this frame's: the muzzle of each gun drawn)
  for (let i = 0; i < G.guns; i++) muzzles.push(new THREE.Vector3());
  const MUZZLE = new THREE.Vector3(0, 0.047, 0.19), GRIP_AT = new THREE.Vector3(...GRIP.at);
  const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _o = new THREE.Vector3(), _s = new THREE.Vector3();
  const F = {};
  F.guns = (list, count = list.length) => {
    const n = Math.min(count, list.length, G.guns);
    for (let i = 0; i < n; i++) {
      const { pos, dir, side } = list[i];
      // the gun's frame: forward (+z) along the forearm, its top (+y) square to that and to his side, so held up it
      // faces back at him and held out it is level; the grip's middle in the middle of the fist
      _z.copy(dir).normalize();
      _y.crossVectors(_z, side); if (_y.lengthSq() < 1e-6) _y.set(0, 1, 0); _y.normalize();
      _x.crossVectors(_y, _z).normalize();
      _m.makeBasis(_x, _y, _z);
      _s.setScalar(G.scale);
      _o.copy(GRIP_AT).multiplyScalar(G.scale).applyMatrix4(_m);   // (the grip's middle, turned: off the gun's origin)
      _m.scale(_s).setPosition(pos.x - _o.x, pos.y - _o.y, pos.z - _o.z);
      guns.setMatrixAt(i, _m);
      muzzles[i].copy(MUZZLE).applyMatrix4(_m);
    }
    guns.count = n;
    if (n) guns.instanceMatrix.needsUpdate = true;
  };
  F.muzzle = (i, out = new THREE.Vector3()) => out.copy(muzzles[i] || muzzles[0]);

  // ── THE FLASH AND THE SMOKE ────────────────────────────────────────────────────────────────────────────────────
  if (!flashMap) { flashMap = puffPicture('rgba(255,250,220,1)', 'rgba(255,170,60,0.85)'); smokeMap = puffPicture('rgba(235,232,225,0.75)', 'rgba(200,196,188,0.35)'); }
  const flashMat = new THREE.SpriteMaterial({ map: flashMap, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false });
  const flashes = [];
  for (let i = 0; i < G.flashes; i++) { const s = new THREE.Sprite(flashMat); s.visible = false; s.name = 'muzzle-flash'; scene.add(s); flashes.push({ s, t: 0 }); }
  const puffs = [];
  for (let i = 0; i < G.smoke.n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeMap, depthWrite: false, transparent: true, opacity: 0 }));
    s.visible = false; scene.add(s); puffs.push({ s, t: 9, v: new THREE.Vector3() });
  }
  let shots = 0;
  F.flash = (at, dir, far = 0) => {
    shots++;
    const f = flashes.reduce((a, b) => (b.t < a.t ? b : a));   // (the one done longest: none is ever made new)
    f.t = G.flash; f.s.position.copy(at).addScaledVector(dir, 0.05); f.s.visible = true;
    f.s.scale.setScalar(Math.max(G.flashSize, far * G.flashFar) * (0.8 + Math.random() * 0.4)); flashMat.rotation = Math.random() * 6;
    for (let k = 0, n = 0; k < puffs.length && n < (low ? G.potato.smoke : 2); k++) {
      const p = puffs[k]; if (p.t < G.smoke.life) continue;
      p.s.position.copy(at).addScaledVector(dir, 0.1 * (n + 1));
      p.v.copy(dir).multiplyScalar(0.7 + Math.random() * 0.5).add(_o.set((Math.random() - 0.5) * 0.25, 0.3, (Math.random() - 0.5) * 0.25));
      p.t = -n * 0.05; p.s.visible = false; n++;
    }
  };

  // ── SPLINTERS AND DUST ─────────────────────────────────────────────────────────────────────────────────────────
  if (!sliverGeo) {
    sliverGeo = new THREE.BoxGeometry(0.045, 0.03, 0.2);
    sliverMat = new THREE.MeshStandardMaterial({ color: 0xe2c08a, roughness: 0.9, metalness: 0 });   // (fresh wood: paler than the weathered boards)
  }
  const slivers = new THREE.InstancedMesh(sliverGeo, sliverMat, G.slivers.n);
  slivers.name = 'splinters'; slivers.frustumCulled = false; slivers.castShadow = false; slivers.visible = false;
  scene.add(slivers);
  const bits = [];
  for (let i = 0; i < G.slivers.n; i++) bits.push({ t: 9, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), floor: 0, rest: false });
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < G.slivers.n; i++) slivers.setMatrixAt(i, zero);
  let ground = () => 0;
  const _e0 = new THREE.Euler();
  F.ground = (fn) => { ground = fn; };   // (the ground's height under a point: where a sliver comes to rest)
  F.splinters = (at, out) => {
    const per = low ? G.potato.per : G.slivers.per, [s0, s1] = G.slivers.speed;
    for (let k = 0, n = 0; k < bits.length && n < per; k++) {
      const b = bits[k]; if (b.t < G.slivers.life) continue;
      b.t = 0; b.rest = false; b.p.copy(at);
      b.v.copy(out).multiplyScalar(s0 + Math.random() * (s1 - s0)).add(_o.set((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2));
      b.q.setFromEuler(_e0.set(Math.random() * 6, Math.random() * 6, 0));
      b.w.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
      b.floor = ground(at.x, at.z) + 0.02;
      n++;
    }
    slivers.visible = true;
  };
  const dust = makeDust(scene);
  dust.puff({ x: 0, y: -1000, z: 0 }, { n: DUST.most });   // (its pool filled now, deep under the ground, not at the first shot)
  F.dust = (at) => dust.puff(at, { n: low ? 3 : 5, size: 0.55, up: 0.6 });
  // (the shaders built ahead, in the background: a gun, a flash, a puff and a sliver drawn nowhere, then let go)
  if (W && W.warmFor) {
    const g = new THREE.Group(), tmp = [new THREE.InstancedMesh(gunGeo, gunMat, 1), new THREE.InstancedMesh(sliverGeo, sliverMat, 1)];
    g.add(...tmp, new THREE.Sprite(flashMat), new THREE.Sprite(puffs[0].s.material));
    const done = () => { for (const m of tmp) m.dispose(); };
    Promise.resolve(W.warmFor(g)).then(done, done);
  }

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _sc = new THREE.Vector3();
  F.update = (dt) => {
    for (const f of flashes) if (f.t > 0) { f.t -= dt; if (f.t <= 0) f.s.visible = false; }
    for (const p of puffs) {
      if (p.t >= G.smoke.life) continue;
      p.t += dt;
      if (p.t < 0) continue;
      const f = p.t / G.smoke.life;
      p.s.visible = f < 1;
      p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-dt * 1.6)); p.v.y += dt * 0.1;
      p.s.scale.setScalar(0.1 + f * G.smoke.size);
      p.s.material.opacity = 0.45 * (1 - f) * Math.min(1, p.t * 12);
    }
    if (slivers.visible) {
      let live = 0;
      for (let i = 0; i < bits.length; i++) {
        const b = bits[i];
        if (b.t >= G.slivers.life) continue;
        b.t += dt; live++;
        if (!b.rest) {
          b.v.y -= 9.8 * dt; b.p.addScaledVector(b.v, dt);
          _q.setFromEuler(_e.set(b.w.x * dt, b.w.y * dt, b.w.z * dt)); b.q.multiply(_q);
          if (b.p.y <= b.floor) { b.p.y = b.floor; b.rest = true; }
        }
        // (lying a moment, then shrinking away)
        const f = b.t / G.slivers.life, k = f < 0.7 ? 1 : Math.max(0, 1 - (f - 0.7) / 0.3);
        slivers.setMatrixAt(i, _m.compose(b.p, b.q, _sc.setScalar(k)));
        if (b.t >= G.slivers.life) slivers.setMatrixAt(i, zero);
      }
      slivers.instanceMatrix.needsUpdate = true;
      if (!live) slivers.visible = false;
    }
    dust.update(dt);
  };
  F.state = () => ({ guns: guns.count, shots, flashes: flashes.filter((f) => f.t > 0).length, smoke: puffs.filter((p) => p.t < G.smoke.life).length,
    slivers: bits.filter((b) => b.t < G.slivers.life).length, dust: dust.busy });
  F.dispose = () => {
    guns.removeFromParent(); guns.dispose();   // (the gun's shape and material are kept for the next hold-up)
    for (const f of flashes) f.s.removeFromParent();
    flashMat.dispose();
    for (const p of puffs) { p.s.removeFromParent(); p.s.material.dispose(); }
    slivers.removeFromParent(); slivers.dispose();
    dust.dispose();
  };
  return F;
}
