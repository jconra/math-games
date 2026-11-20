// A PLANET, ready to look at and fly over: its ground made from a seed (src/planet/land.js, in a worker when it
// can be), its sky, its sun and sky light, its ground's picture (src/planet/ground.js) and what stands on it
// (src/planet/cover.js). The Planet Lab shows it by itself; the medical and exploring runs will come out of the
// wormhole above one.
//
//   const land = await makeLandAsync(seed, kind)            the ground's numbers, made away from the page
//   const planet = await makePlanet({ renderer, scene, land, quality })
//   planet.update(camera, dt) each frame;  planet.dispose()
//   planet.land, planet.ground, planet.cover, planet.sky, planet.exposure (for the renderer), planet.stats
//
// THE SKY: no air (the moon), the game's own sky (world/sky.js: the ringed planet, the nebulae, the stars) and its
// sun; with air, the Terrain Lab's cloud sky in the planet's own colours (src/planet/cloudSky.js), its sun where the
// seed put it, and the ground fading into it with distance.
import * as THREE from 'three';
import { makeLand, finishLand } from './land.js';
import { makeGround } from './ground.js';
import { makeCloudSky } from './cloudSky.js';
import { makeCover } from './cover.js';
import { createSky } from '../../world/sky.js';

// the ground's numbers for a seed, made in a worker (the page keeps drawing); here on the page if workers can't
let worker = null, asks = 0;
const waiting = new Map();
export function makeLandAsync(seed, kind = null) {
  try {
    if (!worker) {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => { const w = waiting.get(e.data.id); if (!w) return; waiting.delete(e.data.id); if (e.data.error) w.bad(new Error(e.data.error)); else w.ok(finishLand(e.data.land)); };
      worker.onerror = (e) => { for (const w of waiting.values()) w.bad(e); waiting.clear(); worker = null; };
    }
    const id = ++asks;
    return new Promise((ok, bad) => { waiting.set(id, { ok, bad }); worker.postMessage({ id, seed, kind }); })
      .catch(() => makeLand(seed, { kind }));
  } catch (e) { return Promise.resolve(makeLand(seed, { kind })); }
}

const srgb = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);

export async function makePlanet({ renderer, scene, land, quality = 'medium' }) {
  const t0 = performance.now(), P = land.palette, look = { ...P }, parts = [];
  // ── the sky ────────────────────────────────────────────────────────────────────────────────────────────────────
  let sky = null, dome = null;
  if (!land.kind.air) {
    sky = createSky(renderer, { quality }); scene.add(sky.object); parts.push(sky.object);
    look.sun = sky.DIR.sun.toArray();
  } else {
    const A = P.air;
    dome = makeCloudSky({ radius: 9000 });
    const u = dome.uniforms, sun = new THREE.Vector3(...P.sun).normalize();
    u.skyZenith.value.copy(srgb(A.zenith)); u.skyHorizon.value.copy(srgb(A.horizon)); u.skyToward.value.copy(srgb(A.toward));
    u.glowCol.value.copy(srgb(A.glow)); u.sunDirSky.value.copy(sun); u.sunDisc.value.copy(srgb(P.sunColor)).multiplyScalar(9);
    u.cloudLit.value.copy(srgb(A.cloud)); u.cloudLitAway.value.copy(srgb(A.cloud)).multiplyScalar(0.82);
    u.cloudCover.value = A.clouds; u.cloudHeight.value = 1800; u.cloudScale.value = 1100;
    scene.add(dome.mesh); parts.push(dome.mesh);
    look.sun = P.sun;
  }
  // ── the sun and the sky's light, for what stands on the ground (lit as the ground is: src/planet/ground.js) ─────
  const sunDir = new THREE.Vector3(...look.sun).normalize();
  const sunLight = new THREE.DirectionalLight(srgb(P.sunColor), P.sunPower * Math.PI);
  sunLight.position.copy(sunDir).multiplyScalar(100); sunLight.target.position.set(0, 0, 0);
  const skyLight = new THREE.HemisphereLight(srgb(P.ambient.sky), srgb(P.ambient.ground), P.ambient.power * Math.PI);
  scene.add(sunLight, sunLight.target, skyLight); parts.push(sunLight, sunLight.target, skyLight);
  // ── the ground ─────────────────────────────────────────────────────────────────────────────────────────────────
  const ground = makeGround({ renderer, land, look, quality, sky: dome });
  scene.add(ground.mesh); parts.push(ground.mesh);
  // ── what stands on it ──────────────────────────────────────────────────────────────────────────────────────────
  const cover = await makeCover({ land, look, ground, quality, sky: dome });
  scene.add(cover.group); parts.push(cover.group);

  const stats = { landMs: land.ms, groundMs: ground.stats.buildMs, lightMs: ground.stats.lightMs, coverMs: cover.stats.buildMs, ms: 0 };
  stats.ms = Math.round(performance.now() - t0);
  let clock = 0;
  return {
    land, ground, cover, sky, dome, stats, sunDir, exposure: P.exposure,
    update(camera, dt) {
      clock += dt;
      ground.update(camera);
      cover.update(camera, dt);
      if (sky) sky.update(dt);
      if (dome) dome.update(camera, dt);
    },
    dispose() { for (const p of parts) scene.remove(p); ground.dispose(); cover.dispose(); if (sky) sky.dispose(); if (dome) { dome.mesh.geometry.dispose(); dome.mesh.material.dispose(); } },
  };
}
