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
//     own hangar always (its thruster pods and canisters are drawn with it). That is the best quality only; at the
//     others (a phone's) the flown ship's hangar alone is drawn and the other openings get plain stand-ins (below).
//   - FLOWN INTO ANOTHER SHIP'S HANGAR (the game's maker, 2026-11-18: "Lol, I'm sure kids will try to do this and it
//     will make them laugh, so why not"; src/visit.js):
//       the flown ship is still drawn in there: its own room, and what hangs on its own hangar's room and rides with
//       it (its pods, its canisters). That hangar's own walls and floor, two walls away and out of sight, are put away
//       meanwhile (`bulk` below), so being in another hangar costs that hangar and the ship, not two hangars;
//       on a phone, the hangar the ship is lined up with and close to (outside.near) is the real one well before it
//       is at the door. The change is never seen to happen: a dark pane just inside the door goes dark over the
//       stand-in, the real hangar takes its place behind the dark, and the pane clears (FADE seconds in all), as if
//       the hangar's lights had come on; and the other way round once the ship has gone off again.
//
//   const outside = addOutside(W, { seed })
//   outside.update(camera, dt)  once a frame, before W.frame
//   outside.flying = shipRoomId | null    a ship flown (the room it is parked in), or none
//   outside.near = hangarId | null        the other hangar a flown ship is lined up with and close to, or in (src/visit.js)
//   outside.out                 true while the camera is out in space (a flown ship's, past the hull)
//   outside.triangles()         the hull's and the gear's triangles as plain lists (what a flying ship bumps into), and
//                               a plain box for each small ship parked on a roof pad
//   outside.jets                the small ships on the roof's pads this time (src/roofjets.js): [{ pad, at, yaw }];
//                               outside.jetsDrawn: true once their file has come and they are drawn
//   outside.jetCopy()           a promise of one more of them, for the control room's fly-past (src/lift.js)
//   outside.hauler              the Hauler waiting outside at the dock (src/haulerdock.js; the game's maker, HAUL-3
//                               2026-11-20): lit as the hull is, drawn whenever the outside is and while the dock's job
//                               has the camera out there; a plain box of it in triangles()
import * as THREE from 'three';
import { hullMaterials } from '../kit/hull.js';
import { shieldMaterial } from '../kit/materials.js';
import { buildOutside } from '../kit/outside.js';
import { STATION_LOOK } from '../kit/hull-look.js';
import { OPENINGS } from '../kit/outside-plan.js';
import { DIR } from '../world/sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { JET, jetsFor, jetBox } from './roofjets.js';
import { makeHaulerAtDock } from './haulerdock.js';

export const SUN = { colour: 0xfff0dc, strength: 3.3 };      // the Hull Lab's own sun
export const FADE = 0.9;      // a phone's stand-in for a hangar giving way to the real one, and back: the dark and the clearing (s)
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

  // THE SMALL SHIPS ON THE ROOF'S PADS (src/roofjets.js has the game's maker's words): one file, fetched a few seconds
  // after the outside is made, drawn once for each pad that has one this time; lit by the same sun and mirroring the
  // same sky as the hull
  const jets = jetsFor(seed), jetGroup = new THREE.Group(), jetOwned = []; jetGroup.name = 'outside:jets'; out.group.add(jetGroup);
  let jetsDrawn = false, jetFile = null;
  // (the file, fetched once, the first time it is wanted: by the pads, or by the control room's fly-past, src/lift.js)
  const loadJet = () => jetFile || (jetFile = new Promise((done, fail) => new GLTFLoader().load(new URL(JET.file, import.meta.url).href, (g) => {
    const src = g.scene, size = new THREE.Box3().setFromObject(src).getSize(new THREE.Vector3()), k = JET.long / Math.max(1e-6, size.x), mats = new Set();
    src.traverse((o) => { if (o.isMesh) { mats.add(o.material); jetOwned.push(o.geometry); } });
    for (const m of mats) { m.fog = false; sunlit(m, sun); if (mirror) m.envMap = mirror.texture; m.needsUpdate = true; lit.push(m); jetOwned.push(m); if (m.map) jetOwned.push(m.map); }
    done({ src, k });
  }, undefined, fail)));
  const jetTimer = jets.length ? setTimeout(() => loadJet().then(({ src, k }) => {
    jets.forEach((j) => { const o = src.clone(); o.scale.setScalar(k); o.position.set(j.at[0], j.at[1], j.at[2]); o.rotation.set(0, j.yaw, 0); o.name = 'outside:jet ' + j.pad; jetGroup.add(o); });
    jetsDrawn = true;
  }).catch((e) => console.warn('the roof\'s small ships did not come: ' + (e && e.message ? e.message : e))), JET.wait) : null;

  // THE HAULER WAITING AT THE DOCK (src/haulerdock.js): built a few seconds after the outside is made, lit by the same
  // sun and mirroring the same sky as the hull
  const hauler = makeHaulerAtDock(W, { light: (m) => { if (!m.isMeshStandardMaterial) return; sunlit(m, sun); if (mirror) m.envMap = mirror.texture; m.needsUpdate = true; lit.push(m); } });

  // the room behind each real opening, and the way the opening faces
  const _p = new THREE.Vector3();
  const openings = OPENINGS.map((o) => { const z = W.zoneAt(_p.set(o.at[0] - o.out[0] * 1.5, o.at[1] + Math.min(1, o.h / 2), o.at[2] - o.out[2] * 1.5)); return { src: o, at: new THREE.Vector3(o.at[0], o.at[1] + o.h / 2, o.at[2]), out: new THREE.Vector3(...o.out), room: z ? z.id : null }; }).filter((o) => o.room);
  const hangars = new Set(W.built.zones.filter((z) => /^hangar/.test(z.id)).map((z) => z.id));
  const wanted = new Set();

  // SEEN FROM OUTSIDE ON A PHONE (any quality but 'high'): only the flown ship's own hangar is drawn. Behind every other
  // real opening that faces the camera stands something plain: a dim room and a shield for a hangar door, a dark pane
  // for a window. (All three hangars and their ships at once are 2.1 million triangles, two and a half times the most
  // the game draws walking about: ~/pw/space-math/FLYING_1.md.)
  const cheap = W.quality !== 'high', standIns = [];
  const stand = new THREE.Group(); stand.name = 'outside:stand-ins'; stand.visible = false; out.group.add(stand);
  const owned = [];
  if (cheap) {
    const dim = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }), shield = shieldMaterial(); owned.push(dim, shield);
    const lin = (hex) => new THREE.Color(hex).toArray();
    const mesh = (quads, mat) => {
      const pos = [], col = [], uv = [], idx = [];
      quads.forEach(([pts, c], k) => { for (const [i, p] of pts.entries()) { pos.push(...p); col.push(...c); uv.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0); } idx.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      owned.push(g); return new THREE.Mesh(g, mat);
    };
    for (const o of openings) {
      const O = o.src, [ox, , oz] = O.out, ax = oz ? 1 : 0, az = ox ? 1 : 0, y0 = O.at[1], y1 = O.at[1] + O.h;
      // a point of the opening: s along it (-1..1 of half its width), d metres in from its face
      const at = (s, y, d, half = O.w / 2) => [O.at[0] + ax * s * half - ox * d, y, O.at[2] + az * s * half - oz * d];
      const g = new THREE.Group(), door = O.w > 10;
      let room = null, sh = null, curtain = null;
      if (door) {
        const h = O.w / 2 + 2.8, top = 10.9, deep = 39, wall = lin(0x1b2027), floor = lin(0x2b313a);
        room = mesh([[[at(-1, 0, 0.4, h), at(1, 0, 0.4, h), at(1, 0, deep, h), at(-1, 0, deep, h)], floor], [[at(-1, top, 0.4, h), at(1, top, 0.4, h), at(1, top, deep, h), at(-1, top, deep, h)], wall],
          [[at(-1, 0, 0.4, h), at(-1, 0, deep, h), at(-1, top, deep, h), at(-1, top, 0.4, h)], wall], [[at(1, 0, 0.4, h), at(1, 0, deep, h), at(1, top, deep, h), at(1, top, 0.4, h)], wall],
          [[at(-1, 0, deep, h), at(1, 0, deep, h), at(1, top, deep, h), at(-1, top, deep, h)], lin(0x12161c)]], dim); g.add(room);
        sh = mesh([[[at(-1, y0, 0.3), at(1, y0, 0.3), at(1, y1, 0.3), at(-1, y1, 0.3)], [1, 1, 1]]], shield); sh.renderOrder = 5; g.add(sh);
        // (THE CURTAIN: a dark pane across the opening, in the depth of the door's own frame and in front of its shield, for the moment the stand-in gives way
        // to the real hangar or takes its place again: the hangar goes dark, the two change places behind the dark,
        // and it clears. So nothing is ever seen to appear: k below)
        const cm = new THREE.MeshBasicMaterial({ color: 0x151a21, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide, forceSinglePass: true }); owned.push(cm);
        curtain = mesh([[[at(-1, y0, -0.45), at(1, y0, -0.45), at(1, y1, -0.45), at(-1, y1, -0.45)], [1, 1, 1]]], cm); curtain.renderOrder = 6; curtain.visible = false; g.add(curtain);
      } else g.add(mesh([[[at(-1, y0, 0.3), at(1, y0, 0.3), at(1, y1, 0.3), at(-1, y1, 0.3)], lin(0x0c131b)]], dim));
      // (k: 1, the stand-in; 0, the real room; between, the curtain: dark by DARK, the change made there, clear again by 0)
      g.visible = false; stand.add(g); standIns.push({ o, g, room, sh, curtain, k: 1 });
    }
  }
  const DARK = 0.62;
  // THE FLOWN SHIP'S OWN HANGAR, while the camera is in another: the room's own walls, floor and fittings (each kind of
  // them one mesh, the room's merged pieces) are put away, and what hangs on the room beside them (the ship's pods and
  // canisters, the crane) stays
  const hangarAt = (p) => { for (const z of W.built.zones) if (hangars.has(z.id) && z.box.containsPoint(p)) return z.id; return null; };
  let bulkOff = null;
  function bulk(zoneId) {
    if (zoneId === bulkOff) return;
    for (const id of [bulkOff, zoneId]) { const z = id && W.room(id); if (z) for (const o of z.group.children) if (o.isMesh && z.merged && z.merged[o.name] === o.geometry) o.visible = id !== zoneId; }
    bulkOff = zoneId;
  }
  const mine = new Set();
  const api = {
    group: out.group, seed, flying: null, near: null, out: false, shown: true, off: false, mats,      // (off: put away, for the cost rigs' before and after)
    jets, get jetsDrawn() { return jetsDrawn; },
    // one more of the same small ship, for something of the game's own (its own copy, at its size, drawn with the same
    // sun and the same sky in its metal): the control room's fly-past (src/lift.js)
    jetCopy: () => loadJet().then(({ src, k }) => { const o = src.clone(); o.scale.setScalar(k); return o; }),
    ms: 0, cheap, hauler,
    get stats() { return out.stats; },
    update(camera = W.camera, dt = 1 / 60) {
      const shown = !W.alone && !W.seenFrom && !api.off;
      api.shown = out.group.visible = shown;
      // (the Hauler: with the outside, and while the dock's job has the camera out at the port, W.seenFrom)
      hauler.show(!W.alone && !api.off);
      // (a flown ship's camera, out past the hull: in none of the hangars' own boxes)
      const camIn = shown && api.flying ? hangarAt(camera.position) : null, outThere = !!(shown && api.flying) && !camIn;
      api.out = outThere; stand.visible = outThere && cheap;
      // the flown ship's own rooms (its own, and the hangar it is drawn with): always drawn while it is flown
      mine.clear();
      if (shown && api.flying) { const z = W.room(api.flying); mine.add(api.flying); for (const w of (z && z.with) || []) mine.add(w); }
      // (in another hangar, past its door's own line: the flown ship's own hangar's walls and floor put away. Just
      // outside that door, where a hangar's box still reaches, its own door may be in sight along the wall: left whole.)
      const home = [...mine].find((id) => hangars.has(id)) || null;
      const within = !!camIn && camIn !== home && openings.some((o) => o.room === camIn && _p.copy(camera.position).sub(o.at).dot(o.out) < 0);
      bulk(within && home ? home : null);
      if (outThere) {
        wanted.clear();
        for (const id of mine) if (hangars.has(id)) wanted.add(id);
        const facing = (o) => _p.copy(camera.position).sub(o.at).dot(o.out) > 0.5;
        if (!cheap) { for (const o of openings) if (facing(o)) wanted.add(o.room); }
        else for (const s of standIns) {
          // (a phone: the hangar the ship is close to is the real one; the others' stand-ins as ever. The change is made
          // behind the curtain, when it is quite dark)
          if (s.curtain) {
            const real = s.o.room === api.near, k = s.k = Math.max(0, Math.min(1, s.k + (real ? -1 : 1) * dt / FADE));
            const isReal = k <= DARK, c = isReal ? k / DARK : (1 - k) / (1 - DARK);
            if (isReal) wanted.add(s.o.room);
            s.room.visible = s.sh.visible = !isReal;
            s.curtain.visible = k > 0 && k < 1; s.curtain.material.opacity = c * c * (3 - 2 * c);
          }
          s.g.visible = (s.curtain ? s.k > 0 : true) && !mine.has(s.o.room) && facing(s.o);
        }
      } else if (cheap) for (const s of standIns) if (s.curtain && s.o.room === camIn) s.k = 0;      // (in it: the real one, and nothing to clear on the way out)
    },
    triangles() {
      const lists = [];
      out.group.traverse((o) => { if (o.isMesh && o.geometry.index && /^(hull:(band|tiers|trim)|outside:(gear|glow))$/.test(o.name)) lists.push({ position: o.geometry.attributes.position.array, index: o.geometry.index.array }); });
      for (const j of jets) lists.push(jetBox(j));
      const hb = hauler.box(); if (hb) lists.push(hb);
      return lists;
    },
    dispose() { W.rooms = null; bulk(null); if (jetTimer) clearTimeout(jetTimer); hauler.dispose(); for (const o of [...owned, ...jetOwned]) o.dispose(); out.dispose(); mats.dispose(); if (mirror) mirror.dispose(); },
  };
  // the last word on which rooms are drawn: the stand-in walls put away under the hull; from out in space, the rooms
  // behind the openings that face the camera; and a flown ship's own rooms wherever the camera is (in another ship's
  // hangar too)
  W.rooms = (z, drawn) => {
    if (!api.shown) return drawn;
    if (SKINS.test(z.id)) return false;
    if (!api.out) return drawn || mine.has(z.id);
    return z.with ? z.with.some((w) => wanted.has(w)) : wanted.has(z.id);
  };
  api.ms = Math.round(performance.now() - t0);
  return api;
}
