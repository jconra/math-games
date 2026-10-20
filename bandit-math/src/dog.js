// THE DOG: follows the player a little to one side and behind, at a trot beside someone walking and a gallop beside
// someone running or riding (and to catch up), and is brought round out of sight if left far behind, as a horse is.
// When the player stops it sits down (Sit_Down, then Sit: haunches on the ground, back legs folded under, front legs
// straight and planted), and after a while of nothing happening it lies down (Lie_Down, Lie). Those clips and its Trot
// were made for the game in Blender (~/pw/bandit-math/rigs/animals/build_dog_clips.py; the pug's on its own skeleton by
// farm_dogclips.py there: its lie is a sploot, back legs stretched out behind). Its legs keep to the ground at
// every pace (gaitFor in actors/animals.js). Its name is on a small tag above its head.
//
//   const D = makeDog({ W, scene, animals, kind: 'shiba' | 'husky' | 'pug', name, follow: () => P.position })
//     follow(): where the one it follows is (a Vector3 on the ground). animals: the loaded library (the kind is loaded
//     here if it isn't yet: D.ready is a promise)
//   D.update(dt)       every frame;  D.shift({ dx, dz }): moved with the player as it stands (the valley's ends)
//   D.setName(name)    a new name on the tag;  D.tagOn = false hides the tag (D.tag: the sprite; it fades out far off)
//   D.dog              the animal (from makeAnimal; null until loaded);  D.position: where it is
//   D.state()          what it is doing, for a HUD or a test: { x, z, speed, gait, pose: 'stand'|'sit'|'lie', sit, ... }
//   D.dispose()
//   makeTag(name)      the name tag on its own (a sprite with .setText(name)), for the dogs waiting at the cabin
import * as THREE from 'three';
import { makeAnimal } from './actors/animals.js';

export const DOG = {
  side: 1.5, back: 1.6,          // where it keeps to: this far to the side and behind the one it follows (m)
  sitAfter: 1.2,                 // seconds after the player stops before it sits
  lieAfter: 14,                  // ... and before it lies down (counted from when it stopped)
  near: 1.1,                     // it stops this close to its spot
  top: 16,                       // its fastest (m/s: a horse at full gallop is 13; past about 4.6 m/s for the shiba and
                                 // 6.8 for the husky its legs can't keep up, so its feet slide a little)
  lost: 70,                      // further than this behind: brought round out of sight
  tagH: 0.028,                   // the name tag's height on screen (about 2.6% of the view's height: 24 px of 900)
  tagUp: 0.25,                   // ... and how far above the top of its head the tag floats (m)
};
// The breeds the general store sells, and how each one differs from DOG. The pug (the farm pack's, with clips made for
// it: actors/animals.js FARM_KINDS) is small and slow: its short legs trot where the others walk, and past about 4 m/s
// they can't keep up, so it falls behind a running horse and is brought round. dogKind(kind): a saved dog's kind as one
// the game can load (an unknown one, from an old or edited save, is a Shiba).
export const DOG_KINDS = ['shiba', 'husky', 'pug'];
export const BREED = { pug: { top: 4, side: 1.15, back: 1.2, near: 0.9, tagUp: 0.14 } };
export const dogKind = (kind) => (DOG_KINDS.includes(kind) ? kind : 'shiba');
const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the name tag: a little rounded label drawn on a canvas, shown as a sprite (always facing the camera)
export function makeTag(name) {
  const cv = document.createElement('canvas'), tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // (the same size on screen near or far: sizeAttenuation off makes its scale a share of the view's height, not metres)
  // (drawn over everything, as the sum cards are, so a grass blade or a fence post never cuts through the name)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false, fog: false, sizeAttenuation: false });
  const s = new THREE.Sprite(mat); s.name = 'dog-tag'; s.renderOrder = 10; s.center.set(0.5, 0);
  s.setText = (text) => {
    const px = 64, font = `600 ${px * 0.62}px Georgia, 'Times New Roman', serif`, ctx = cv.getContext('2d');
    ctx.font = font; const w = Math.ceil(ctx.measureText(text).width + px * 0.7), h = px;
    cv.width = w; cv.height = h;
    ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const r = h * 0.32; ctx.fillStyle = 'rgba(38,26,16,0.78)';
    ctx.beginPath(); ctx.moveTo(r, 0); ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r); ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r); ctx.fill();
    ctx.fillStyle = '#f6e7c4'; ctx.fillText(text, w / 2, h * 0.54);
    tex.needsUpdate = true; s.scale.set(DOG.tagH * w / h, DOG.tagH, 1);
  };
  s.setText(name);
  return s;
}

export function makeDog({ W, scene, animals, kind = 'shiba', name = 'Dog', follow }) {
  kind = dogKind(kind);
  const C = { ...DOG, ...(BREED[kind] || {}) };      // (this breed's settings)
  const D = { dog: null, kind, name, position: new THREE.Vector3(), tagOn: true };
  const tag = D.tag = makeTag(name); tag.visible = false; scene.add(tag);   // (shown once the dog is there)
  let x = 0, z = 0, heading = 0, speed = 0, stillT = 0, side = 1, lead = null, leadSpeed = 0;
  let pose = 'stand', poseT = 0, headUp = 0;            // pose: standing (or moving), sitting or lying; poseT: how long
  const last = new THREE.Vector3(), tmp = new THREE.Vector3(), head = new THREE.Vector3();
  let started = false, disposed = false;   // (disposed: the ride ended while the dog was still loading; it never arrives)
  D.ready = animals.need(kind).then(() => {
    if (disposed) return;
    const a = D.dog = makeAnimal(animals, kind); scene.add(a.root);
    // how far the top of its head is above the head bone (the tag goes over the head wherever the clips put it)
    a.root.updateMatrixWorld(true); headUp = a.tall - a.bones.Head.getWorldPosition(head).y;
  }).catch((e) => console.warn('dog: no', kind, e));
  D.setName = (n) => { D.name = n; tag.setText(n); };

  // where it means to be: beside and behind the one it follows (the way they are going), or just beside them when stopped
  function spot(L, out) {
    const h = lead === null ? 0 : lead, s = Math.sin(h), c = Math.cos(h);
    const back = leadSpeed > 0.5 ? C.back + Math.min(2.5, leadSpeed * 0.15) : 0.4;
    // its side: the left (+x turned) unless the way there is blocked
    return out.set(L.x + c * C.side * side - s * back, 0, L.z - s * C.side * side - c * back);
  }
  function walk(h, step) {
    const s = Math.sin(h), c = Math.cos(h), n = Math.max(1, Math.ceil(step / 0.25)), d = step / n; let got = 0;
    for (let i = 0; i < n; i++) {
      const nx = x + s * d, nz = z + c * d;
      if (!W.blocked(nx, nz)) { x = nx; z = nz; got += d; } else if (!W.blocked(nx, z)) { x = nx; got += Math.abs(s * d); } else if (!W.blocked(x, nz)) { z = nz; got += Math.abs(c * d); } else break;
    }
    return got;
  }
  function bringRound(L) {
    const h = lead === null ? 0 : lead;
    for (const t of [Math.PI, Math.PI + 0.6, Math.PI - 0.6, Math.PI / 2, -Math.PI / 2]) for (const r of [18, 12, 7, 3]) {
      const nx = L.x + Math.sin(h + t) * r, nz = L.z + Math.cos(h + t) * r;
      if (!W.blocked(nx, nz)) { x = nx; z = nz; heading = h; return; }
    }
    x = L.x; z = L.z;
  }
  // sitting and lying: a once-through clip to get down, then the loop (held on its last pose if the loop isn't there)
  function settle(a, to, dt) {
    if (pose !== to) {
      pose = to; poseT = 0;
      if (!a.play(to === 'sit' ? 'Sit_Down' : 'Lie_Down', { fade: 0.2, once: true })) a.play(to === 'sit' ? 'Sit' : 'Lie', { fade: 0.4 });
      return;
    }
    poseT += dt;
    const down = a.actions[to === 'sit' ? 'Sit_Down' : 'Lie_Down'];
    if (down && poseT > down.getClip().duration - 0.1) a.play(to === 'sit' ? 'Sit' : 'Lie', { fade: 0.15 });
  }

  D.update = (dt) => {
    dt = Math.min(Math.max(dt, 0), 0.1);
    const L = follow(); if (!L) return;
    // the one it follows: which way they're heading and how fast (from where they were)
    if (!started) { started = true; last.copy(L); spot(L, tmp); x = tmp.x; z = tmp.z; if (W.blocked(x, z)) bringRound(L); }   // (it starts at its place beside them)
    const mv = Math.hypot(L.x - last.x, L.z - last.z), v = dt > 0 ? mv / dt : 0;
    leadSpeed = damp(leadSpeed, Math.min(v, 30), 6, dt);
    if (mv > 0.004) lead = lead === null ? Math.atan2(L.x - last.x, L.z - last.z) : lead + wrap(Math.atan2(L.x - last.x, L.z - last.z) - lead) * (1 - Math.exp(-5 * dt));
    if (mv > 20) bringRound(L);                                            // (they jumped: so does the dog)
    last.copy(L);
    const a = D.dog;
    if (!a) return;
    const goal = spot(L, tmp);
    if (W.blocked(goal.x, goal.z)) { side = -side; spot(L, goal); }
    const dx = goal.x - x, dz = goal.z - z, d = Math.hypot(dx, dz), toLead = Math.hypot(L.x - x, L.z - z);
    if (toLead > C.lost) { bringRound(L); }
    // how fast: keep pace with the leader near the spot, faster the further off it is
    let target = 0;
    if (d > C.near) target = Math.min(C.top, leadSpeed * (d > 3 ? 1.15 : 0.95) + Math.max(0, d - C.near) * 1.4);
    if (leadSpeed < 0.3 && d < C.near + 0.8) target = 0;
    // somewhere to go: up it gets (the clips blend from sitting or lying into its pace)
    if (target > 0) { stillT = 0; pose = 'stand'; poseT = 0; }
    speed = target > speed ? Math.min(target, speed + 14 * dt) : Math.max(target, speed - 12 * dt);
    if (speed > 0.05) {
      // toward the spot, round anything in the way
      const want = Math.atan2(dx, dz); let h = want;
      for (const t of [0, 0.5, -0.5, 1, -1, 1.6, -1.6]) { const g = want + t; if (!W.blocked(x + Math.sin(g) * 1, z + Math.cos(g) * 1)) { h = g; break; } }
      heading += wrap(h - heading) * (1 - Math.exp(-9 * dt));
      walk(heading, speed * dt);
    } else if (toLead > 0.6 && pose === 'stand') {                         // stopped: turned toward the one it follows
      heading += wrap(Math.atan2(L.x - x, L.z - z) - heading) * (1 - Math.exp(-3 * dt));
    }
    // sits when everyone has stopped for a moment, lies down when nothing happens for a while
    stillT = target === 0 && speed < 0.1 && leadSpeed < 0.25 ? stillT + dt : 0;
    if (stillT > C.lieAfter && a.actions.Lie) settle(a, 'lie', dt);
    else if (stillT > C.sitAfter && a.actions.Sit && pose !== 'lie') settle(a, 'sit', dt);
    else if (pose === 'stand') a.pace(speed);
    const y = W.heightAt(x, z);
    a.root.position.set(x, y, z);
    a.root.rotation.set(0, heading, 0);
    a.update(dt);
    a.root.updateMatrixWorld(true);
    D.position.set(x, y, z);
    // the tag over its head, fading out far off
    a.bones.Head.getWorldPosition(head);
    tag.position.set(head.x, head.y + headUp + C.tagUp, head.z);
    const camD = W.camTarget ? tag.position.distanceTo(W.camTarget) : 0;
    tag.material.opacity = camD > 40 ? Math.max(0, 1 - (camD - 40) / 15) : 1; tag.visible = tag.material.opacity > 0.02 && D.tagOn;
  };
  // moved with the player as it stands (the way round at the valley's ends: src/world.js W.wrap)
  D.shift = ({ dx = 0, dz = 0 }) => { x += dx; z += dz; last.x += dx; last.z += dz; if (D.dog) { D.dog.root.position.x += dx; D.dog.root.position.z += dz; D.dog.root.position.y = W.heightAt(x, z); } };
  D.state = () => ({ x: +x.toFixed(2), z: +z.toFixed(2), speed: +speed.toFixed(2), gait: D.dog ? D.dog.clip : 'Idle', pose,
    sit: pose === 'stand' ? 0 : 1, name: D.name, kind, loaded: !!D.dog });
  D.dispose = () => { disposed = true; if (D.dog) D.dog.dispose(); tag.removeFromParent(); tag.material.map.dispose(); tag.material.dispose(); };
  return D;
}
