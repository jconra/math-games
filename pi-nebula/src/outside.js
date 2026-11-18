// THE STATION'S OUTSIDE, IN THE GAME: the plated hull, the girders and wings, the reactor and the cargo dock
// (kit/outside.js, the station's own look: kit/hull-look.js STATION_LOOK) round the real rooms. It is seen from the
// windows and out of the hangar doors while walking about, and from a ship flown outside (src/flying.js).
//
// THE GAME'S MAKER (2026-11-18): the lit windows should change between visits ("It makes it feel more lived in if
// things change"): a fresh `seed` each time the game starts.
//
// WHAT HAD TO BE SETTLED to put it in (the list is ~/pw/space-math/STATION_OUTSIDE.md, "Not in the game, and why"):
//   - HOW FAR THE CAMERA SEES: 700 m now (src/station.js SEES; it was 120 m and cut the far solar wing off).
//   - NO SUN IN THE GAME'S SCENE. A lamp added to the scene would light the rooms as well, so the sun is worked out
//     inside the hull's own materials (sunlit below): the game's sky's sun (world/sky.js DIR.sun), the Hull Lab's
//     colour and strength. The rooms are untouched.
//   - THE ROOMS' HAZE: none on the hull (its materials are told so; kit/outside.js `fog: false` for the rest).
//   - WHAT THE METAL MIRRORS: the sky, pictured once here without its sun's disc (as the Hull Lab does), given to the
//     hull's materials alone. The rooms still mirror themselves.
//   - THE WHITE STAND-IN WALLS (the station file's rooms 'skin-n' and 'skin-s': the outside as it was seen from the
//     quarters corridor and from the terminal): the hull stands 7 cm outside them and hides them, so they are not drawn
//     at all while the hull is.
//   - PUT AWAY when it should not be seen: while a ship is out at the rocks (W.alone: the station is not there), and
//     while the dock's bridge job has the camera outside the docking port (W.seenFrom: that job draws its own piece of
//     hull round the port, and is as it was).
//   - SEEN FROM OUTSIDE (a ship flown out): the rooms drawn are the ones behind each real opening that faces the
//     camera (the three hangars from the hangar side, the terminal from its window's side, ...), and the flown ship's
//     own hangar always (its thruster pods and canisters are drawn with it).
//
//   const outside = addOutside(W, { seed })
//   outside.update(camera)      once a frame, before W.frame
//   outside.flying = shipRoomId | null    a ship flown (the room it is parked in), or none
//   outside.out                 true while the camera is out in space (a flown ship's, past the hull)
//   outside.triangles()         the hull's and the gear's triangles as plain lists (what a flying ship bumps into)
import * as THREE from 'three';
import { hullMaterials } from '../kit/hull.js';
import { buildOutside } from '../kit/outside.js';
import { STATION_LOOK } from '../kit/hull-look.js';
import { OPENINGS } from '../kit/outside-plan.js';
import { DIR } from '../world/sky.js';

export const SUN = { colour: 0xfff0dc, strength: 3.3 };      // the Hull Lab's own sun
const SKINS = /^skin-/;

// the sun, worked out in a material of its own accord: one more light in its sums, from the sky's sun
function sunlit(m, uni) {
  const before = m.onBeforeCompile, key = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
  // (three's own name for the lit point changed at r158: either is served)
  const old = /GeometricContext geometry/.test(THREE.ShaderChunk.lights_fragment_begin);
  const call = old ? 'RE_Direct( sunLight, geometry, material, reflectedLight );' : 'RE_Direct( sunLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  m.onBeforeCompile = (sh, r) => {
    if (before) before.call(m, sh, r);
    sh.uniforms.uSunDir = uni.dir; sh.uniforms.uSunCol = uni.col;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunDir; uniform vec3 uSunCol;')
      .replace('#include <lights_fragment_begin>', `#include <lights_fragment_begin>
      { IncidentLight sunLight; sunLight.color = uSunCol; sunLight.direction = normalize( ( viewMatrix * vec4( uSunDir, 0.0 ) ).xyz ); sunLight.visible = true;
        ${call} }`);
  };
  m.customProgramCacheKey = () => (key ? key() : '') + '|sunlit';
  m.needsUpdate = true;
}

export function addOutside(W, { seed = Math.floor(Math.random() * 1e6) } = {}) {
  const t0 = performance.now();
  const mats = hullMaterials(STATION_LOOK);
  const out = buildOutside(STATION_LOOK, mats, { inside: true, seed, fog: false });
  const gear = out.group.getObjectByName('outside:gear');
  const sun = { dir: { value: DIR.sun.clone().normalize() }, col: { value: new THREE.Color(SUN.colour).multiplyScalar(SUN.strength) } };
  const lit = [mats.band, mats.tiers, mats.trim, gear && gear.material].filter(Boolean);
  for (const m of [mats.band, mats.tiers, mats.trim, mats.windows]) m.fog = false;
  for (const m of lit) sunlit(m, sun);
  out.group.name = 'outside'; W.scene.add(out.group);

  // what the metal mirrors: the sky alone, its sun's disc left out (the sun's light already gives the metal its glint)
  let mirror = null;
  function mirrorSky() {
    const rt = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType }), cc = new THREE.CubeCamera(1, 6000, rt);
    const dome = W.sky.object.getObjectByName('sky:dome'), U = (dome && dome.material && dome.material.uniforms) || {}, disc = U.uSunR ? U.uSunR.value : 0;
    const shown = W.scene.children.filter((o) => o.visible && o !== W.sky.object), env = W.scene.environment, fog = W.scene.fog;
    for (const o of shown) o.visible = false;
    if (U.uSunR) U.uSunR.value = 1e-5;
    W.scene.environment = null; W.scene.fog = null;
    cc.update(W.renderer, W.scene);
    W.scene.environment = env; W.scene.fog = fog;
    if (U.uSunR) U.uSunR.value = disc;
    for (const o of shown) o.visible = true;
    const t = W.pmrem.fromCubemap(rt.texture); if (mirror) mirror.dispose(); mirror = t; rt.dispose();
    for (const m of lit) { m.envMap = t.texture; m.needsUpdate = true; }
  }
  mirrorSky();

  // the room behind each real opening, and the way the opening faces
  const _p = new THREE.Vector3();
  const openings = OPENINGS.map((o) => { const z = W.zoneAt(_p.set(o.at[0] - o.out[0] * 1.5, o.at[1] + Math.min(1, o.h / 2), o.at[2] - o.out[2] * 1.5)); return { at: new THREE.Vector3(o.at[0], o.at[1] + o.h / 2, o.at[2]), out: new THREE.Vector3(...o.out), room: z ? z.id : null }; }).filter((o) => o.room);
  const hangars = new Set(W.built.zones.filter((z) => /^hangar/.test(z.id)).map((z) => z.id));
  const wanted = new Set();
  const api = {
    group: out.group, seed, flying: null, out: false, shown: true, off: false, mats,      // (off: put away, for the cost rigs' before and after)
    ms: 0,
    get stats() { return out.stats; },
    update(camera = W.camera) {
      const shown = !W.alone && !W.seenFrom && !api.off;
      api.shown = out.group.visible = shown;
      // (a flown ship's camera, out past the hull: in none of the hangars' own boxes)
      let outThere = false;
      if (shown && api.flying) { outThere = true; for (const z of W.built.zones) if (hangars.has(z.id) && z.box.containsPoint(camera.position)) { outThere = false; break; } }
      api.out = outThere;
      if (outThere) {
        wanted.clear();
        for (const o of openings) if (_p.copy(camera.position).sub(o.at).dot(o.out) > 0.5) wanted.add(o.room);
        const mine = W.room(api.flying); for (const w of (mine && mine.with) || []) wanted.add(w);
      }
    },
    triangles() {
      const lists = [];
      out.group.traverse((o) => { if (o.isMesh && o.geometry.index && /^(hull:(band|tiers|trim)|outside:(gear|glow))$/.test(o.name)) lists.push({ position: o.geometry.attributes.position.array, index: o.geometry.index.array }); });
      return lists;
    },
    dispose() { W.rooms = null; out.dispose(); mats.dispose(); if (mirror) mirror.dispose(); },
  };
  // the last word on which rooms are drawn: the stand-in walls put away under the hull; from out in space, the rooms
  // behind the openings that face the camera
  W.rooms = (z, drawn) => {
    if (!api.shown) return drawn;
    if (SKINS.test(z.id)) return false;
    if (!api.out) return drawn;
    return z.with ? z.with.some((w) => wanted.has(w)) : wanted.has(z.id);
  };
  api.ms = Math.round(performance.now() - t0);
  return api;
}
