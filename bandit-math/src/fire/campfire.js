// A CAMPFIRE: the flame in a camp's ring of stones, a warm glow on the ground round it, and a quiet crackle.
//
// The flame is yomotsu's volumetric fire (./VolumetricFire.js, MIT; the same one the Shipwrecked game's campfire used,
// by way of the jconra.com fire lab), with its own two pictures (./firetex.png: the flame's colours by height and
// distance from the middle; ./nzw.png: a table of random numbers for its noise). Each fire gets its own copy of the
// material, so its own clock: two fires never flicker in step. Like the fire lab's wreck fires, the column tips its
// top a little toward the camera, so a camera looking down on it sees the side of a flame rather than a hollow ring.
//
// No light is added to the scene (a PointLight a fire would make every lit material in the valley costlier): the glow
// is a soft orange patch laid on the ground under the fire, added to what is there (brighter, never darker), that
// flickers with the flame. The crackle is a loop made sample by sample (fireSamples in src/audio/nature.js, its FIRE
// settings tuned by ear on the Sound Lab's creek and campfire page): mostly tiny crackles in little bursts, now and then
// a bigger pop with a woody knock, a log settling once in a while. Positioned at the fire, heard within
// CAMPFIRE.sound.hear metres; each fire starts the loop at its own place and plays it a touch faster or slower, so two
// fires never crackle alike. Away from the fire nothing is worked out: the flame isn't sliced or drawn past
// CAMPFIRE.near metres or behind the camera, and the sound sleeps.
//
//   const F = makeCampfire({ W, scene, camera, x, z, y, width, audio, id })
//     x, z: the middle of the ring; y: the height of the embers (the flame's foot); width: the flame's width (metres);
//     audio: the game's sound (src/audio/audio.js), or null for none; id: a name for its need() (one per fire)
//   F.update(dt, time)   each frame (time: seconds since the game began)
//   F.burning            true while the flame is being drawn (near and in view)
//   F.mesh               the flame's mesh; F.glow the glow's
//   F.dispose()
import * as THREE from 'three';
import VolumetricFire from './VolumetricFire.js';
import { fireSamples } from '../audio/nature.js';

export const CAMPFIRE = {
  box: [2, 4, 2],        // the volume, in its own units (the Shipwrecked campfire's): 2 wide, 4 tall; the flame you see is
                         // about two thirds of the box's height
  slice: 0.5,            // the distance between slices, in the same units (fewer slices = cheaper, coarser)
  near: 140,             // metres: further off than this the flame isn't drawn at all (a fire that size is a speck there)
  lean: 0.8,             // how far the column tips toward the camera at most (radians) ...
  leanPer: 1.1,          // ... as this many times the camera's angle down onto the fire
  glow: { r: 2.8, strength: 0.42, flicker: 0.22, colour: 0xff8a3a },   // the patch on the ground: reach (m), how bright,
                                                                     // how much it flickers (a share of strength)
  sound: { hear: 30, level: 0.165, ref: 2.0, rolloff: 1.3 },   // within hear metres; its level at the fire (the loop now peaks at 0.67, so as loud in town as before)
  bright: 0.9,           // extra brightness for the valley's daylight (the shader's own "flash" punch held on: 0.9 is
                         // nearly twice as bright as the fire lab's night flames, which read pale against a sunlit meadow)
};

// the crackle's loop, made once per sound context (every fire plays the same one, each from its own place)
const loops = new WeakMap();
function fireLoop(ctx) {
  let buf = loops.get(ctx);
  if (!buf) { const d = fireSamples(ctx.sampleRate); buf = ctx.createBuffer(1, d.length, ctx.sampleRate); buf.copyToChannel(d, 0); loops.set(ctx, buf); }
  return buf;
}

// (the flame's two pictures sit beside this file)
VolumetricFire.texturePath = new URL('./', import.meta.url).href;

// the glow's picture: a soft round patch, bright in the middle, gone at the edge (white: the colour comes from the material)
let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const c = cv.getContext('2d'), g = c.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.75)'); g.addColorStop(0.6, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, N, N);
  glowTex = new THREE.CanvasTexture(cv); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

const _fax = new THREE.Vector3(), _fq = new THREE.Quaternion(), _fe = new THREE.Euler(), _v = new THREE.Vector3();
let fireN = 0;

export function makeCampfire({ W, scene = W.scene, camera, x, z, y = null, width = 0.8, audio = null, id = null }) {
  const C = CAMPFIRE, base = y ?? W.heightAt(x, z), name = id || `campfire-${++fireN}`;
  // THE FLAME: box units scaled so the box is `width` across
  const s = width / C.box[0];
  const fire = new VolumetricFire(C.box[0], C.box[1], C.box[2], C.slice, camera);
  fire.mesh.material = fire.mesh.material.clone();   // (its own clock; the pictures stay shared)
  fire.mesh.material.uniforms.flash.value = C.bright;
  fire.mesh.name = name;
  fire.mesh.renderOrder = 20;              // (added light: drawn after the solid world)
  fire.mesh.frustumCulled = false;         // (its slices are made again each frame, so three's bounds would be stale)
  fire.mesh.scale.set(s, s, s);
  fire.mesh.position.set(x, base + C.box[1] * s / 2, z);
  fire.mesh.visible = false;
  scene.add(fire.mesh);
  const phase = Math.random() * 40, yaw = Math.random() * Math.PI * 2;

  // THE GLOW: a little sheet laid over the ground (a 9 x 9 grid that follows the land), added to what is under it
  const R = C.glow.r, n = 8, pos = [], uv = [], idx = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const gx = x - R + 2 * R * i / n, gz = z - R + 2 * R * j / n;
    pos.push(gx, W.heightAt(gx, gz) + 0.04, gz); uv.push(i / n, 1 - j / n);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * (n + 1) + i; idx.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2); }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx);
  const gm = new THREE.MeshBasicMaterial({ map: glowTexture(), color: C.glow.colour, transparent: true, opacity: C.glow.strength,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const glow = new THREE.Mesh(gg, gm); glow.name = name + '-glow'; glow.renderOrder = 3; glow.visible = false;
  scene.add(glow);

  // THE CRACKLE: made the first time the fire is heard; a panner at the fire, a gain to fade it in and out
  let snd = null;
  const rate = 0.94 + Math.random() * 0.12;   // (this fire's own speed for the loop)
  function makeSound(ctx, out) {
    const pan = ctx.createPanner();
    pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = C.sound.ref; pan.rolloffFactor = C.sound.rolloff; pan.maxDistance = 10000;
    const py = base + 0.3;
    if (pan.positionX) { pan.positionX.value = x; pan.positionY.value = py; pan.positionZ.value = z; } else pan.setPosition(x, py, z);
    const fade = ctx.createGain(); fade.gain.value = 0;
    pan.connect(fade).connect(out);
    snd = { ctx, pan, fade, bed: null };
  }
  function soundOn(on) {
    if (!snd) return;
    const t = snd.ctx.currentTime;
    snd.fade.gain.setTargetAtTime(on ? C.sound.level : 0, t, 0.4);
    if (on && !snd.bed) {
      const src = snd.ctx.createBufferSource(), buf = fireLoop(snd.ctx);
      src.buffer = buf; src.loop = true; src.playbackRate.value = rate; src.connect(snd.pan); src.start(t, Math.random() * buf.duration);
      snd.bed = { stop: (dt = 0) => { try { src.stop(snd.ctx.currentTime + dt); src.disconnect(); } catch (e) { /* (gone) */ } } };
    }
    if (!on && snd.bed) { const b = snd.bed; snd.bed = null; setTimeout(() => b.stop(0.05), 1500); }
  }

  let hearing = false, burning = false, t = 0;
  const F = { mesh: fire.mesh, glow, get burning() { return burning; } };
  F.update = (dt, time = (t += dt)) => {
    const cp = camera.position, dx = cp.x - x, dz = cp.z - z, d = Math.hypot(dx, dz);
    // drawn when near and not behind the camera (a fire just off the edge of the view can still light the ground in it)
    _v.set(x - cp.x, base + 0.5 - cp.y, z - cp.z);
    const ahead = camera.getWorldDirection(_fax).dot(_v) > -C.glow.r;
    const want = d < C.near && ahead;
    if (want !== burning) { burning = want; fire.mesh.visible = glow.visible = want; }
    if (burning) {
      // tip the top toward the camera, more the more steeply it looks down (none when level with the fire)
      const down = Math.atan2(cp.y - base - 0.5, Math.max(0.5, d));
      const lean = -Math.min(C.lean, Math.max(0, down) * C.leanPer);
      if (d > 0.001) { _fax.set(dz / d, 0, -dx / d); _fq.setFromAxisAngle(_fax, lean); }
      fire.mesh.quaternion.setFromEuler(_fe.set(0, yaw, 0)).premultiply(_fq);
      fire.mesh.updateMatrixWorld();
      fire.update(time + phase);
      // the glow breathes with the flame: two slow waves and a quick one
      const f = 0.55 * Math.sin(time * 7.3 + phase) + 0.3 * Math.sin(time * 13.1 + phase * 2) + 0.15 * Math.sin(time * 23.7);
      gm.opacity = C.glow.strength * (1 + C.glow.flicker * f);
    }
    // the crackle, within earshot
    if (audio) {
      const hear = d < C.sound.hear;
      if (hear !== hearing) { hearing = hear; audio.need(name, hear); if (!hear) soundOn(false); }
      if (hear && audio.ctx && !snd) makeSound(audio.ctx, audio.out);
      if (hear && snd && audio.running && !snd.bed) soundOn(true);
    }
  };
  F.dispose = () => {
    scene.remove(fire.mesh); scene.remove(glow);
    fire.mesh.geometry.dispose(); fire.mesh.material.dispose(); gg.dispose(); gm.dispose();
    if (audio) audio.need(name, false);
    if (snd) { if (snd.bed) snd.bed.stop(0.05); setTimeout(() => { try { snd.fade.disconnect(); snd.pan.disconnect(); } catch (e) { /* (gone) */ } }, 400); }
  };
  return F;
}
