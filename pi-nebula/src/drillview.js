// THE DRILL OPERATOR'S GAME, drawn and played (src/drill.js is the plain part: the rocks, the ore, the holes, the
// canisters; src/jobs/drill.js the question asked as a rock is scanned). Used by a captain's run at the asteroid field
// (src/trip.js, for a crew member who signed for the drill) and by itself in pi-nebula/labs/drill/. Nothing here is
// built or loaded until one of them asks.
//
// THE GAME'S MAKER (2026-11-17): "If in your contract you are a drill operator then you get switched to a view for
// that game. Maybe it is outside of the ship, and you get a holographic overlay of asteroids around you, you get to
// pick one ... The pilot approaches it. It asks a math question about the ore fraction or estimated weight as it scans
// it. Then you point at the spots on the asteroid and the claw grabs it and wherever you click on it the drill makes a
// hole and it starts filling up your canisters. An overlay shows how full you are. You press a button when done and
// then click another asteroid to have the pilot fly over to it. The process repeats until your canisters are full."
// "I do like the idea of a projection showing the ore glowing inside. And also have different kinds of ore." "It would
// be cool to be able to rotate the asteroid with the claw and then point at the area to drill. We don't necessarily
// need to deform the asteroid. But we should reduce the amount of the glowing ore inside from that area. Small rocks
// should probably float away from the drilling point. And eventually the rock should crumble to pieces."
//
// HOW IT IS DONE, plainly:
//   - THE SHIP is the Miner built fresh from its own layout (kit/rooms/ship-miner-built.json, as the Ship Lab builds
//     it): legs up, its own two arms live. It stands still at `at`; flying over to a rock is the rock coming to the
//     claw while the eye moves from the looking view (behind the ship and a little above) to the working view (close
//     on the rock in the claw).
//   - LOOKING: the rocks in reach are laid out on the screen so each can be tapped on any screen (a phone's tall one
//     too), each drawn larger than life with a thin ring round it and a small tag (the metal's symbol and name): the
//     scan's picture of it. The ore inside is the glow: its colour is the metal, how much of it is how rich. A FIELD
//     IS A MIX OF METALS (src/drill.js FIELD), each with its own colour and tag; the tag's number is what a canister
//     of that ore sells for. A rock with a streak of a dearer metal glows in both colours, and its tag names both.
//   - THE CANISTERS, top left: the drill sorts the ore by metal, the dearest first along the row, so each canister
//     shows the colours of what is in it, and under them what the load would sell for so far (a canister is sold as
//     the metal there is most of in it: src/drill.js canistersOf).
//   - THE GLOW is one batch of soft points for every lump of ore in every rock, added to the picture; a lump on the far
//     side of its rock is dimmer, so turning the rock shows where the ore is thick. A lump's glow is as big and bright
//     as the ore left in it, so a hole visibly thins it.
//   - DRILLING: the claw holds the rock, the cutter waits just above its top. A drag up or down the screen turns the
//     claw's wrist: the hand and the rock go round together, the fingers shut on the rock's own surface. A drag across
//     is a turn the wrist cannot make: the fingers ease open, the rock turns in the open hand, and they shut on it
//     again as the finger lifts. Tap a spot: the claw brings that spot under the cutter (by its wrist, and where the
//     wrist cannot, by shifting its hold; never with a finger left under the cutter), the cutter comes down, chips
//     drift away from the hole, the glow near it fades and the canisters fill, and the claw turns the rock back as it
//     was, so the hole is seen where it was tapped. The rock
//     keeps its shape; each hole is a dark spot, and cracks spread along its facets hole by hole. After its last hole
//     it breaks into pieces that float off.
//   - CHEAP: the ship as built (39 draws); each rock in reach one small mesh; the far rocks and pebbles one batch; the
//     glow one batch of points; chips and pieces one batch. No lamps of its own but one sun.
//
//   const ship = await buildShip()                      the Miner, for outside (once; kept by whoever asked)
//   const V = makeDrillView({ scene, camera, renderer, root, ship, at, crew, save, metal, ore, rich, rand, ask, onDone, onSay })
//       metal: a field of that one metal only (the Drill Lab), else the mix; ore: [a, d], the part of a tonne of ore a
//       canister holds on this trip (the jump out's: src/missions.js), for what a canister sells for
//       onDone({ load (the metal in each canister), lots, sells, metal (the one metal, or 'mixed'), rich, stats, secs })
//   V.update(dt); V.aim(camera, dt)   each frame;   V.close()   put away (the ship is the caller's to keep or dispose)
//   V.run (src/drill.js makeRun), V.state() and V.rig (the rigs: where things are on the screen)
import * as THREE from 'three';
import { buildRoom, updateDoors, loadRoom } from '../kit/layout.js';
import { makeMaterials } from '../kit/materials.js';
import * as MB from '../kit/ships/miner-built.js';
import { openPanel } from './jobs/panel.js';
import { JOB as SCAN } from './jobs/drill.js';
import { makeRun, DRILL, ORE, seeded, holeWorth, canistersOf, canPrice, loadSells } from './drill.js';
import { lotsWords } from './jobs/smelter.js';
import { DIR } from '../world/sky.js';

// the eye, in the ship's own frame (x to port, y up, z to the nose; metres): looking for a rock (behind the ship and a
// little above), and working one (close on the rock in the claw, from ahead, to port and above: side on to the claw's
// hand, so the hand is seen holding the rock and going round with it, the cutter above them); on a wide screen and
// on a tall one
export const VIEWS = {
  look: { eye: [0, 12, -30], look: [0, 4.6, 40], fov: 46 }, lookTall: { eye: [0, 17, -40], look: [0, 12.5, 40], fov: 60 },
  work: { eye: [4.6, 8.0, 17.1], look: [0.1, 3.0, 8.5], fov: 36 }, workTall: { eye: [4.9, 8.4, 17.9], look: [0.25, 3.5, 8.5], fov: 46 },
};
// where the rocks in reach are laid out on the screen while looking: [x, y] from -1 to 1 across and up the screen, and
// how far off (metres from the eye); slot by slot (src/drill.js: a rock's place)
const SLOTS = {
  wide: [[0.04, 0.2, 46], [-0.34, 0.5, 60], [0.4, 0.56, 64], [-0.6, 0.02, 50], [0.68, 0.14, 54], [-0.74, -0.52, 42], [0.76, -0.46, 44]],
  tall: [[0.02, 0.3, 60], [-0.5, 0.38, 72], [0.5, 0.58, 76], [-0.52, -0.02, 62], [0.56, 0.2, 66], [-0.58, -0.4, 54], [0.6, -0.24, 56]],
};
const SEEN = { small: 0.062, medium: 0.078, big: 0.096 };   // a rock's radius while looking, as a part of the screen's shorter side
const HELD = { small: 1.02, medium: 1.13, big: 1.25 };      // its radius in the claw, metres (the claw is made for 1.15)
const T = { arrive: 1.3, fly: 2.3, turn: 0.45, cut: 0.95, breakUp: 1.7, release: 1.3, back: 1.2, full: 2.8 };   // seconds
const CAM_RATE = 2.4, SUN_K = 1.7, TRUE_R = 1.1;

const CSS = `
.pdr { position: fixed; inset: 0; z-index: 21; pointer-events: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; cursor: default;
  font: 400 16px/1.35 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: #eef1f4; overflow: hidden; }
.pdr * { box-sizing: border-box; }
.pdr-touch { position: absolute; inset: 58px 0 0 0; pointer-events: auto; touch-action: none; }
.pdr-done { pointer-events: auto; }
.pdr-cans { position: absolute; left: max(12px, env(safe-area-inset-left)); top: max(64px, calc(env(safe-area-inset-top) + 64px)); padding: 8px 12px 9px; background: rgba(13, 17, 23, 0.84); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.34); pointer-events: none;
  clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px); }
.pdr-cans small { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #a7b0ba; }
.pdr-cans b { font-size: 22px; font-weight: 800; }
.pdr-row { display: flex; gap: 4px; margin-top: 4px; }
.pdr-row i { width: 15px; height: 24px; border: 1.5px solid #9fb2c4; border-radius: 3px; background: rgba(255, 255, 255, 0.04); }
.pdr-cans em { display: block; margin-top: 5px; font-style: normal; font-size: 12.5px; color: #cfd8e2; } .pdr-cans em b { font-size: 14px; font-weight: 800; color: #ffe08a; }
.pdr-cans em:empty { display: none; }
.pdr-rock { position: absolute; right: max(12px, env(safe-area-inset-right)); top: max(64px, calc(env(safe-area-inset-top) + 64px)); padding: 7px 12px 8px; text-align: right; background: rgba(13, 17, 23, 0.84); box-shadow: inset 0 0 0 1.5px rgba(110, 225, 255, 0.5); pointer-events: none;
  clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px); }
.pdr-rock small { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #8fdcf5; }
.pdr-rock b { font-size: 22px; font-weight: 800; } .pdr-rock span { font-size: 14px; color: #cfd8e2; margin-left: 5px; }
.pdr-rock em { display: block; font-style: normal; font-size: 12.5px; color: #ffe08a; }
.pdr-hint { position: absolute; left: 50%; bottom: max(22px, env(safe-area-inset-bottom)); transform: translateX(-50%); max-width: min(560px, calc(100vw - 24px)); padding: 9px 18px 10px; text-align: center; font-size: 17px; font-weight: 600; background: rgba(13, 17, 23, 0.86); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.3); pointer-events: none; text-wrap: balance;
  clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px); }
.pdr-hint:empty, .pdr [hidden], .pdr.has-panel .pdr-hint { display: none; }
.pdr-done { position: absolute; right: max(14px, env(safe-area-inset-right)); bottom: max(22px, env(safe-area-inset-bottom)); height: 48px; padding: 0 18px; font: inherit; font-size: 15px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #06202b; background: #6ee1ff; border: 0; cursor: pointer;
  clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px); }
.pdr-big { position: absolute; left: 50%; top: 24%; transform: translateX(-50%); padding: 10px 22px; text-align: center; white-space: nowrap; font-size: 22px; font-weight: 800; letter-spacing: 0.05em; color: #1c1205; background: #ffc83c; pointer-events: none; animation: pdr-pop 0.5s ease;
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px); }
.pdr-big small { display: block; font-size: 14px; letter-spacing: 0.03em; }
@keyframes pdr-pop { from { transform: translateX(-50%) scale(0.6); opacity: 0; } }
.pdr-tag { position: absolute; left: 0; top: 0; pointer-events: none; will-change: transform; }
.pdr-tag i { position: absolute; left: 0; top: 0; border-radius: 50%; border: 1.5px dashed rgba(110, 225, 255, 0.75); background: rgba(90, 210, 255, 0.04); transform: translate(-50%, -50%); }
.pdr-tag.is-hot i { border: 2.5px solid #9fe9ff; background: rgba(90, 210, 255, 0.09); }
.pdr-tag.is-rich i { border-color: rgba(255, 226, 150, 0.95); }
.pdr-tag u { position: absolute; left: 0; width: 1.5px; background: rgba(110, 225, 255, 0.7); transform: translateX(-50%); }
.pdr-tag span { position: absolute; left: 0; transform: translateX(-50%); padding: 2px 8px 3px; white-space: nowrap; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: #dff6ff; background: rgba(4, 22, 32, 0.78); box-shadow: inset 0 0 0 1.2px rgba(110, 225, 255, 0.8); border-radius: 3px; }
.pdr-tag span b { color: var(--ore, #6ee1ff); margin-right: 5px; font-size: 13px; }
.pdr-tag span em { font-style: normal; margin-left: 6px; color: #ffe08a; } .pdr-tag span b + b { margin: 0 0 0 4px; }
.pdr-tag.is-rich span { box-shadow: inset 0 0 0 1.5px #ffd77a; color: #fff3cf; }
@media (max-width: 640px) {
  .pdr-hint { font-size: 15px; padding: 8px 12px 9px; bottom: max(14px, env(safe-area-inset-bottom)); }
  .pdr-done { bottom: max(92px, calc(env(safe-area-inset-bottom) + 92px)); right: 50%; transform: translateX(50%); white-space: nowrap; }
  .pdr-cans { top: max(108px, calc(env(safe-area-inset-top) + 108px)); } .pdr-rock { top: max(108px, calc(env(safe-area-inset-top) + 108px)); }
  .pdr-big { font-size: 18px; top: 290px; white-space: normal; width: max-content; max-width: calc(100vw - 20px); } .pdr-cans b, .pdr-rock b { font-size: 19px; }
}
.pdr.is-lab .pdr-cans, .pdr.is-lab .pdr-rock { top: calc(var(--pdr-top, 48px) + 8px); }
@media (min-width: 641px) { .pdr.has-panel .pdr-rock { display: none; } }
@media (min-width: 641px) { .pdr.has-panel .pdr-big { left: 30%; } }
`;

// ── the Miner, for outside: built from its own layout as the Ship Lab builds it, legs up, arms folded ──
export async function buildShip() {
  const room = await loadRoom(new URL('../kit/rooms/ship-miner-built.json', import.meta.url));
  const mats = MB.grimeMaterials(makeMaterials(), { dirt: 0.85 });
  const built = buildRoom(room, mats, { bake: { voxel: 0.08, rays: 24 } });
  MB.LAB.pose(built, { gear: 1, doors: 1 }, { updateDoors });
  for (const D of built.doors) if (D.piece === 'mbArm') { D.t = D.target = 1; D.work = 0; D.grip = 0; }
  built.armsAs = null; MB.armStep(built, 'stowed', 0);
  return { built, mats, dispose() { built.dispose(); for (const m of new Set(Object.values(mats))) if (m && m.dispose) m.dispose(); } };
}

// ── a rock's shape: a twenty-sided ball split up, pushed in and out by a few slow waves and a handful of craters ──
function shapeOf(seed) {
  const r = seeded(seed * 7 + 11), S = { a: r() * 9, b: r() * 9, c: r() * 9, sq: [0.9 + r() * 0.22, 0.8 + r() * 0.2, 0.9 + r() * 0.22], craters: [] };
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) { const z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z); S.craters.push({ d: new THREE.Vector3(s * Math.cos(a), z, s * Math.sin(a)), a: 0.26 + r() * 0.3, h: 0.05 + r() * 0.07 }); }
  return S;
}
function radiusAt(S, n) {
  let s = 1 + 0.13 * Math.sin(n.x * 3.1 + S.a) * Math.cos(n.y * 2.7 + S.b) + 0.09 * Math.sin(n.z * 5.3 + S.c + n.x * 2.2) + 0.05 * Math.sin(n.y * 9.1 + S.a * 2);
  for (const k of S.craters) { const t = Math.acos(Math.max(-1, Math.min(1, n.dot(k.d)))) / k.a; if (t < 1) s -= k.h * (1 - t * t); else if (t < 1.3) s += k.h * 0.3 * (1 - (t - 1) / 0.3); }
  return s;
}
function rockGeo(S, detail) {
  const g = new THREE.IcosahedronGeometry(1, detail), P = g.attributes.position, n = new THREE.Vector3(), bary = new Float32Array(P.count * 3), face = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) {
    n.fromBufferAttribute(P, i).normalize(); const r = radiusAt(S, n);
    P.setXYZ(i, n.x * r * S.sq[0], n.y * r * S.sq[1], n.z * r * S.sq[2]);
    bary[i * 3 + (i % 3)] = 1;
    const f = Math.floor(i / 3), h1 = Math.abs(Math.sin(f * 12.9898 + S.a * 3.1) * 43758.5453) % 1, h2 = Math.abs(Math.sin(f * 78.233 + S.b * 1.7) * 24634.6345) % 1;
    face[i * 2] = h1; face[i * 2 + 1] = h2;
  }
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g.setAttribute('aBary', new THREE.BufferAttribute(bary, 3)); g.setAttribute('aFace', new THREE.BufferAttribute(face, 2));
  g.computeBoundingSphere();
  return g;
}
const ROCK_VERT = `
attribute vec3 aBary; attribute vec2 aFace; varying vec3 vW; varying vec3 vL; varying vec3 vB; varying vec2 vF;
void main() {
  vL = position; vB = aBary; vF = aFace;
  #ifdef USE_INSTANCING
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  #else
  vec4 w = modelMatrix * vec4(position, 1.0);
  #endif
  vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
}`;
const ROCK_FRAG = `
uniform vec3 uSun; uniform vec3 uTint; uniform float uSunK; uniform float uLamp;
#ifdef HELD
uniform float uCrack; uniform vec3 uHoles[8]; uniform int uHoleN; uniform vec3 uGlow; uniform vec3 uSq; uniform float uScan;
#endif
varying vec3 vW; varying vec3 vL; varying vec3 vB; varying vec2 vF;
void main() {
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
  float d = max(dot(n, uSun), 0.0);
  vec3 base = uTint * (0.72 + 0.56 * vF.x);
  vec3 c = base * (0.06 + uSunK * d) + base * vec3(0.16, 0.2, 0.27) * max(0.45 - 0.55 * dot(n, uSun), 0.0);
  c += base * uLamp * pow(max(dot(n, normalize(cameraPosition - vW)), 0.0), 1.5);      // (the scan's own lamp: a rock's facets read from every side)
  #ifdef HELD
  float e = min(vB.x, min(vB.y, vB.z)), w = fwidth(e);
  float crack = (1.0 - smoothstep(w * 0.7, w * 2.0, e)) * step(vF.y, uCrack);
  c = mix(c, vec3(0.004), crack * 0.92) + uGlow * crack * 0.22 * uCrack;
  vec3 ld = normalize(vL / uSq);
  for (int i = 0; i < 8; i++) {
    if (i >= uHoleN) break;
    float a = dot(ld, uHoles[i]), h = smoothstep(0.984, 0.990, a);
    c = mix(c, vec3(0.003), h) + uGlow * smoothstep(0.972, 0.984, a) * (1.0 - h) * 0.7;
  }
  float band = 1.0 - smoothstep(0.0, 0.07, abs(vL.y - (uScan * 2.6 - 1.3)));
  c += vec3(0.25, 0.85, 1.0) * band * step(0.001, uScan) * 0.8;
  #endif
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const GLOW_VERT = `
attribute vec3 aC; attribute vec4 aCol; attribute float aSize; attribute float aR;
uniform float uPx; varying vec3 vCol; varying float vK;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0), c = modelMatrix * vec4(aC, 1.0);
  float depth = dot(w.xyz - c.xyz, normalize(cameraPosition - c.xyz)) / max(aR, 0.001);
  vK = aCol.a * mix(0.3, 1.0, smoothstep(-0.7, 0.55, depth)); vCol = aCol.rgb;
  vec4 mv = viewMatrix * w; float dist = max(0.1, -mv.z);
  mv.xyz += normalize(-mv.xyz) * aR * 1.25;      // toward the eye: drawn over its own rock, behind anything nearer
  gl_Position = projectionMatrix * mv; gl_PointSize = clamp(aSize * uPx / dist, 2.0, 240.0);
}`;
const GLOW_FRAG = `
varying vec3 vCol; varying float vK;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0; float r2 = dot(p, p); if (r2 > 1.0) discard;
  float a = exp(-r2 * 3.2) * (1.0 - r2) * vK;
  gl_FragColor = vec4(vCol * a + vec3(1.0) * a * a * a * 0.22, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const SIZE_WORD = { small: 'a small rock', medium: 'a middling rock', big: 'a big rock' };

export function makeDrillView({ scene, camera, renderer, root = document.body, ship, at = new THREE.Matrix4(), crew = { id: 'lab', name: 'Driller' }, save = () => {}, metal = null, ore = [3, 4], rich = false, rand = Math.random, ask = true, lab = false, onDone = () => {}, onSay = () => {} }) {
  const say = (n) => Math.round(n).toLocaleString('en-US'), sellsFor = (m) => canPrice(m, ore);
  if (!document.getElementById('pdr-css')) { const st = document.createElement('style'); st.id = 'pdr-css'; st.textContent = CSS; document.head.appendChild(st); }
  const run = makeRun({ rand, metal, rich }), built = ship.built;
  const G = new THREE.Group(); G.name = 'drill'; G.matrixAutoUpdate = false; G.matrix.copy(at); G.updateMatrixWorld(true); scene.add(G); G.add(built.group);
  const atInv = at.clone().invert(), atQ = new THREE.Quaternion().setFromRotationMatrix(at), atQi = atQ.clone().invert();
  const sunW = DIR.sun.clone().normalize();
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.3); sun.position.copy(new THREE.Vector3().setFromMatrixPosition(at)).addScaledVector(sunW, 200); sun.target.position.setFromMatrixPosition(at); scene.add(sun, sun.target);
  const was = { near: camera.near, far: camera.far, fov: camera.fov };

  // ── the rocks' materials: the ones in reach and far off; the one in the claw (its holes, its cracks, the scan) ──
  const uni = (lamp) => ({ uSun: { value: sunW }, uTint: { value: new THREE.Color(0.082, 0.076, 0.071) }, uSunK: { value: SUN_K }, uLamp: { value: lamp } });
  const fieldMat = new THREE.ShaderMaterial({ uniforms: uni(0.45), vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG });
  const heldMat = new THREE.ShaderMaterial({ defines: { HELD: '' }, vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG,
    uniforms: { ...uni(1.25), uCrack: { value: 0 }, uHoles: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0, 1, 0)) }, uHoleN: { value: 0 }, uGlow: { value: new THREE.Color(1, 1, 1) }, uSq: { value: new THREE.Vector3(1, 1, 1) }, uScan: { value: 0 } } });

  // ── far rocks and pebbles, one batch (the field is in the planet's rings: plenty of them, none to be reached) ──
  const far = (() => {
    const r = seeded(4242), g = rockGeo(shapeOf(5), 1), n = 90, im = new THREE.InstancedMesh(g, fieldMat, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const big = i < 26, a = r() * Math.PI * 2, d = big ? 120 + r() * 300 : 26 + r() * 90, y = (r() - 0.45) * (big ? 150 : 46), k = big ? 4 + r() * 13 : 0.25 + r() * 0.9;
      p.set(Math.sin(a) * d, 4 + y, Math.cos(a) * d + (big ? 0 : 10));
      // (none on the ship, none between the eye and the rock being worked)
      if (!big && Math.hypot(p.x, p.z - 6) < 16) p.z += 30;
      e.set(r() * 6, r() * 6, r() * 6); q.setFromEuler(e); s.set(k * (0.8 + r() * 0.5), k * (0.7 + r() * 0.4), k);
      im.setMatrixAt(i, m.compose(p, q, s));
    }
    im.frustumCulled = false; im.name = 'drill: far rocks'; G.add(im);
    return im;
  })();

  // ── the rocks in reach: one small mesh each ──
  const seen = new Map();   // rock.id -> { rock, mesh, S, pos, scale, q, from, slotPos, slotScale, in }
  const lookCam = new THREE.PerspectiveCamera(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const tall = () => innerHeight > innerWidth * 1.05 || innerWidth <= 640;
  const viewOf = (name) => VIEWS[name + (tall() ? 'Tall' : '')];
  // where a slot is, in the ship's frame, and how big a rock of that size is drawn there
  function slotPlace(slot, size, out) {
    const V = viewOf('look'), [x, y, d] = (tall() ? SLOTS.tall : SLOTS.wide)[slot % DRILL.field];
    lookCam.fov = V.fov; lookCam.aspect = innerWidth / innerHeight; lookCam.near = 1; lookCam.far = 500; lookCam.updateProjectionMatrix();
    lookCam.position.set(...V.eye); lookCam.lookAt(...V.look); lookCam.updateMatrixWorld(true);
    _v.set(x, y, 0.5).unproject(lookCam).sub(lookCam.position).normalize();
    out.pos.copy(lookCam.position).addScaledVector(_v, d);
    // (its radius a part of the screen's shorter side)
    const depth = d * _v.dot(_v2.set(0, 0, -1).applyQuaternion(lookCam.quaternion)), halfH = Math.tan(V.fov * Math.PI / 360) * depth, shorter = Math.min(1, lookCam.aspect);
    out.scale = SEEN[size] * 2 * halfH * shorter;
    return out;
  }
  function addSeen(rock, drift = false) {
    const S = shapeOf(rock.shape), mesh = new THREE.Mesh(rockGeo(S, 2), fieldMat), r = seeded(rock.shape + 3);
    const o = { rock, mesh, S, pos: new THREE.Vector3(), scale: 1, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)), slotPos: new THREE.Vector3(), slotScale: 1, in: drift ? 0 : 1, spin: (r() - 0.5) * 0.12, glow: 1 };
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.name = 'drill: rock ' + rock.id; G.add(mesh);
    for (const L of rock.lumps) L.show = L.ore;
    seen.set(rock.id, o); place(o); return o;
  }
  function place(o) { const p = slotPlace(o.rock.slot, o.rock.size, { pos: o.slotPos, scale: 1 }); o.slotScale = p.scale; }
  function dropSeen(id) { const o = seen.get(id); if (!o) return; G.remove(o.mesh); o.mesh.geometry.dispose(); seen.delete(id); }
  function syncSeen() {
    for (const rock of run.rocks) if (!seen.has(rock.id)) addSeen(rock, !!rock.fresh);
    for (const id of [...seen.keys()]) if (!run.rocks.some((r) => r.id === id) && !(H && H.rock.id === id)) dropSeen(id);
  }

  // ── the glow: one batch of soft points, a point for every lump of ore and one between each two of a vein ──
  const GN = 640, glow = (() => {
    const g = new THREE.BufferGeometry();
    for (const [k, n] of [['position', 3], ['aC', 3], ['aCol', 4], ['aSize', 1], ['aR', 1]]) { const a = new THREE.BufferAttribute(new Float32Array(GN * n), n); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); }
    const mat = new THREE.ShaderMaterial({ uniforms: { uPx: { value: 600 } }, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.name = 'drill: the ore\'s glow'; pts.renderOrder = 5; G.add(pts);
    return pts;
  })();
  const colOf = new Map(Object.entries(ORE).map(([k, v]) => [k, new THREE.Color(v.glow)]));
  let glowN = 0;
  function glowOf(o, rockR, k) {
    const A = glow.geometry.attributes, rock = o.rock, sq = o.S.sq; let col = colOf.get(rock.metal) || colOf.get('copper');
    const put = (p, ore, ore0) => {
      if (glowN >= GN || ore0 <= 0) return;
      const f = Math.max(0, ore / ore0), amt = Math.min(1.5, Math.sqrt(Math.max(0, ore) / 0.11));
      if (f < 0.02) return;
      _v.set(p[0] * sq[0], p[1] * sq[1], p[2] * sq[2]).multiplyScalar(0.92 * o.scale).applyQuaternion(o.q).add(o.pos);
      A.position.setXYZ(glowN, _v.x, _v.y, _v.z); A.aC.setXYZ(glowN, o.pos.x, o.pos.y, o.pos.z);
      A.aCol.setXYZW(glowN, col.r, col.g, col.b, k * (0.1 + 0.5 * amt)); A.aSize.setX(glowN, rockR * (0.2 + 0.21 * Math.cbrt(ore0 / 0.11)) * (0.5 + 0.5 * Math.min(1.2, f))); A.aR.setX(glowN, rockR);
      glowN++;
    };
    let prev = null;
    for (const L of rock.lumps) {
      col = colOf.get(L.metal || rock.metal) || colOf.get('copper');      // (a streak glows in its own metal's colour)
      put(L.p, L.show, L.ore0);
      if (prev && prev.vein === L.vein) put([(prev.p[0] + L.p[0]) / 2, (prev.p[1] + L.p[1]) / 2, (prev.p[2] + L.p[2]) / 2], Math.min(prev.show, L.show) * 0.7, Math.min(prev.ore0, L.ore0) * 0.7);
      prev = L;
    }
  }

  // ── chips from the hole, and the pieces of a rock breaking up: one batch of small lumps ──
  const CN = 72, chips = new THREE.InstancedMesh(rockGeo(shapeOf(9), 0), fieldMat, CN), bits = [];
  chips.frustumCulled = false; chips.name = 'drill: chips'; chips.count = 0; G.add(chips);
  function chip(p, v, size, life) { if (bits.length >= CN) bits.shift(); bits.push({ p: p.clone(), v: v.clone(), size, life, t: 0, spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(4), rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0) }); }
  const _e = new THREE.Euler(), _s = new THREE.Vector3();
  function stepChips(dt) {
    for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.t += dt; if (b.t >= b.life) { bits.splice(i, 1); continue; } b.p.addScaledVector(b.v, dt); b.rot.x += b.spin.x * dt; b.rot.y += b.spin.y * dt; }
    chips.count = bits.length;
    bits.forEach((b, i) => { const k = b.size * Math.min(1, (b.life - b.t) / 0.5); _q.setFromEuler(b.rot); chips.setMatrixAt(i, _m.compose(b.p, _q, _s.set(k, k * 0.8, k))); });
    chips.instanceMatrix.needsUpdate = true;
  }

  // ── the rock in the claw ──
  let H = null;   // { rock, o (its seen record), mesh, R (its radius, metres), q, from: { pos, scale } }
  const heldPos = new THREE.Vector3(0, 2.94, 8.54), cutDir = new THREE.Vector3(0, 1, 0);
  const armDoors = built.doors.filter((D) => D.piece === 'mbArm');
  const sideOf = (D) => ((D.leaves[0] && D.leaves[0].meshes[0].name.split(':')[2]) || '');
  const clawD = armDoors.find((D) => sideOf(D) === MB.ARMS.claw), cutD = armDoors.find((D) => D !== clawD);
  built.rockOn = true; built.armsAs = null;
  // (where the arms' own stand-in rock is: ours takes its place, and the stand-in is never drawn)
  function standIn() {
    const r = built.rocks && Object.values(built.rocks)[0]; if (!r) return;
    r.visible = false; _m.multiplyMatrices(built.group.matrix, r.matrix); heldPos.setFromMatrixPosition(_m);
  }
  // (the way from the rock's middle to the cutter's wheel, in the ship's frame)
  const _box = new THREE.Box3();
  function findCutter() {
    for (const L of cutD ? cutD.leaves : []) {
      const im = L.meshes[0]; if (!/wheel/.test(im.name) || !im.visible) continue;
      if (!im.geometry.boundingBox) im.geometry.computeBoundingBox();
      im.getMatrixAt(L.index, _m); _box.copy(im.geometry.boundingBox).getCenter(_v).applyMatrix4(_m).applyMatrix4(built.group.matrix);
      _v.sub(heldPos); if (_v.lengthSq() > 0.01) cutDir.copy(_v).normalize();
      return;
    }
  }
  function hold(o) {
    const rock = o.rock, mesh = new THREE.Mesh(rockGeo(o.S, 3), heldMat);
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.name = 'drill: the rock in the claw'; G.add(mesh);
    o.mesh.visible = false;
    const U = heldMat.uniforms; U.uSq.value.set(...o.S.sq); U.uGlow.value.copy(colOf.get(rock.metal) || colOf.get('copper')); U.uHoleN.value = 0; U.uCrack.value = 0; U.uScan.value = 0;
    // (free: the rock is not in the hand's hold, it turns by itself; turn: how far the wrist has turned the hand;
    // qPalm: how the rock lies in the hand; grip: the fingers' angles shut on it as it lies; loose: the fingers eased open)
    H = { rock, o, mesh, R: HELD[rock.size], from: { pos: o.pos.clone(), scale: o.scale }, turnFrom: new THREE.Quaternion(), turnTo: new THREE.Quaternion(),
      free: true, turn: 0, qPalm: new THREE.Quaternion(), grip: null, loose: 0, looseWant: 0, pend: new THREE.Quaternion(), pending: false, settle: 0, vel: 0, shift: false, t0: 0, t1: 0, back: null };
    if (!cutKnown) cutterHome();
  }
  // THE HAND AND THE ROCK. The claw's wrist turns the hand about its own length (kit/ships/miner-built.js armAngles:
  // over.turn), and the rock's middle is on that line: so the hand and the rock go round together, as a wrist turns
  // what it holds, the fingers shut on the rock all the while. A drag along the way the wrist turns does that. A drag
  // the other way is a turn the wrist cannot make: the fingers ease open, the rock turns in the open hand, and they
  // shut again on its new surface (worked out against the rock's own shape: MB.gripOn).
  const LOOSE = 0.5, CUT_UP = 0.72, CLEAR = 25 * Math.PI / 180;
  const clawSide = MB.ARMS.claw, clawDesign = MB.ARMS.design, _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pp = new THREE.Vector3(), _ps = new THREE.Vector3(), _pq2 = new THREE.Quaternion();
  const overOf = (turn) => ({ [clawSide]: { turn } });
  // (the palm's way round, in the ship's frame, for a turn of the wrist)
  function palmQ(turn, out = new THREE.Quaternion()) { const M = MB.palmOf(built, overOf(turn)); if (!M) return out.identity(); _pm.multiplyMatrices(built.group.matrix, M).decompose(_pp, out, _ps); return out; }
  // (the line the wrist turns about, and which way a turn counts along it)
  const wristAxis = new THREE.Vector3(0, 0, 1); let wristSign = 1, cutKnown = false;
  function wristHome() {
    const q0 = palmQ(0), q1 = palmQ(0.3); wristAxis.set(0, 0, 1).applyQuaternion(q0).normalize();
    q1.multiply(q0.invert()); wristSign = (q1.x * wristAxis.x + q1.y * wristAxis.y + q1.z * wristAxis.z) * (q1.w < 0 ? -1 : 1) >= 0 ? 1 : -1;
  }
  // (where the cutter comes down: read once from the arm's own pose with its wheel on the rock)
  function cutterHome() {
    if (!cutD || !clawD) return; const was = [cutD.work, cutD.t, clawD.work, clawD.t];
    cutD.work = clawD.work = 1; cutD.t = clawD.t = 0; MB.armShow(built, spin); standIn(); findCutter();
    [cutD.work, cutD.t, clawD.work, clawD.t] = was; MB.armShow(built, spin); standIn();
    wristHome(); cutKnown = true;
  }
  // the fingers' angles shut on the rock as it lies in the hand now
  const _gp = new THREE.Vector3(), _gq = new THREE.Quaternion();
  function gripNow() {
    const S = H.o.S, at = MB.CLAWS[clawDesign].rock, R = H.R; _gq.copy(H.qPalm).invert();
    return MB.gripOn(clawDesign, (p) => {
      _gp.set(p.x, p.y, p.z - at).applyQuaternion(_gq).multiplyScalar(1 / R); _gp.set(_gp.x / S.sq[0], _gp.y / S.sq[1], _gp.z / S.sq[2]);
      const L = _gp.length(); return L < radiusAt(S, _gp.multiplyScalar(1 / (L || 1)));
    }, { hinge: 0.2 });
  }
  // the hand takes hold of the rock as it lies
  function regrip() { palmQ(H.turn, _pq); H.qPalm.copy(_pq.invert()).multiply(H.o.q); const t0 = performance.now(); H.grip = gripNow(); H.gripMs = performance.now() - t0; H.looseWant = 0; H.free = false; H.pending = false; H.pend.identity(); }
  // is a finger where the cutter comes down, with the wrist turned this far? (each finger stands at its knuckle's
  // place round the hand)
  function fingerUnder(turn) {
    palmQ(turn, _pq); _gp.copy(cutDir).applyQuaternion(_pq.invert()); const a = Math.atan2(_gp.y, _gp.x);
    return MB.CLAWS[clawDesign].knuckles.some((K) => { let d = Math.abs(a - K.phi * Math.PI / 180) % (Math.PI * 2); if (d > Math.PI) d = Math.PI * 2 - d; return d < CLEAR; });
  }
  // the turn of the wrist nearest to `turn` that leaves the cutter's place clear of the fingers
  function clearTurn(turn) { for (let d = 0; d < Math.PI; d += 0.02) { if (!fingerUnder(turn + d)) return turn + d; if (!fingerUnder(turn - d)) return turn - d; } return turn; }
  // the wrist turned by a drag: the hand and the rock together
  function wristBy(phi) { if (!H || H.free) return; H.turn += phi * wristSign; }
  // a turn the wrist cannot make: the fingers ease open and the rock turns in the open hand
  function looseBy(q) { if (!H) return; H.pend.premultiply(q); H.pending = true; H.free = true; H.looseWant = 1; H.settle = 0.22; H.vel = 0; }
  function dropHeld() { if (!H) return; G.remove(H.mesh); H.mesh.geometry.dispose(); const id = H.rock.id; H = null; dropSeen(id); }

  // ── the picture over it: the canisters, the rock in the claw, the hint, the button, a tag for each rock in reach ──
  const el = document.createElement('div'); el.className = 'pdr' + (lab ? ' is-lab' : '');
  el.innerHTML = `<div class="pdr-touch"></div><div class="pdr-tags"></div><div class="pdr-cans"><small>Canisters full</small><b></b><div class="pdr-row">${'<i></i>'.repeat(DRILL.cans)}</div><em></em></div>
    <div class="pdr-rock" hidden><small></small><b></b><span></span><em></em></div><div class="pdr-big" hidden></div><div class="pdr-hint"></div><button type="button" class="pdr-done" hidden>Done with this rock</button>`;
  root.appendChild(el);
  const $ = (s) => el.querySelector(s), tagsEl = $('.pdr-tags'), cansB = $('.pdr-cans b'), cansI = [...el.querySelectorAll('.pdr-row i')], rockEl = $('.pdr-rock'), hintEl = $('.pdr-hint'), doneEl = $('.pdr-done'), bigEl = $('.pdr-big');
  const sellsEl = $('.pdr-cans em');
  const tags = new Map();
  function tagOf(o) {
    let t = tags.get(o.rock.id); if (t) return t;
    const M = ORE[o.rock.metal] || ORE.copper; t = document.createElement('div'); t.className = 'pdr-tag' + (o.rock.rich ? ' is-rich' : '');
    const A = o.rock.also ? ORE[o.rock.also] : null;
    t.innerHTML = `<i></i><u></u><span><b>${esc(M.sym)}</b>${esc(cap(o.rock.metal))}${A ? ` +<b style="color: ${A.glow}">${esc(A.sym)}</b>` : ''}<em>${say(sellsFor(o.rock.metal))}</em></span>`; t.style.setProperty('--ore', M.glow);
    tagsEl.appendChild(t); tags.set(o.rock.id, t); return t;
  }
  // (the line along the bottom: what to do now; or, for a few seconds, what just happened)
  let hintFor = '', hintT = 0;
  const hint = (w, secs = 0) => { if (secs) { hintT = secs; hintEl.textContent = w; } else { hintFor = w; if (hintT <= 0 && hintEl.textContent !== w) hintEl.textContent = w; } };
  let bigT = 0; const shownOre = {};
  const big = (html, secs = 3.2) => { bigEl.innerHTML = html; bigEl.hidden = false; bigT = secs; };

  // ── the game's state ──
  const V = { stage: 'arrive', t: 0, sub: '', subT: 0, clock: 0, scanDone: false, first: false, hot: null, log: [], richSaid: false, lastHole: null };
  let panel = null, closeIn = -1, armsWant = 'reach', spin = 0, scanT = 0, closed = false, cutCap = 1;
  const cam = { eye: new THREE.Vector3(), look: new THREE.Vector3(), fov: 46, fresh: true }, want = { eye: new THREE.Vector3(), look: new THREE.Vector3(), fov: 46 };
  const go = (stage) => { V.stage = stage; V.t = 0; V.sub = ''; V.subT = 0; V.log.push(stage); };

  // ── the scan's question: the job panel with one of the drill ladder's cards, about the rock in the claw ──
  const link = {
    now: () => (H ? { rock: { metal: H.rock.metal, also: H.rock.also, size: H.rock.size, holes: H.rock.holes, rich: H.rock.rich }, cans: { full: run.full, of: DRILL.cans } } : null),
    head: () => `<header class="pnj-cardtop is-jump"><span class="pnj-icon is-jump" aria-hidden="true"></span><b>Rock scan</b><small>${H ? esc(cap(H.rock.metal)) + (H.rock.also ? ' with a streak of ' + esc(H.rock.also) : '') + ', ' + SIZE_WORD[H.rock.size] : ''}</small></header>`,
    right(q) { V.first = q.misses === 0; closeIn = 0.95; },
  };
  function openScan() {
    V.scanDone = false; V.first = false; closeIn = -1;
    if (!ask) { scanned(false); return; }
    panel = openPanel(root, { job: SCAN, crew, live: link, pay: false, onSave: () => save(crew), onCredits: () => {}, onClose: () => { if (panel) { panel = null; scanned(V.first); } } });
    el.classList.add('has-panel');
  }
  function scanned(first) {
    if (V.scanDone) return; V.scanDone = true; el.classList.remove('has-panel');
    const tuned = run.scanned(first);
    if (tuned) { onSay('tuned'); hint('Right at the first try! This rock gives a quarter more.', 4); }
  }
  // (put away: while it fades it takes no taps, so the first tap on the rock is the rock's)
  const closePanel = () => { if (!panel) return; const p = panel; panel = null; for (const c of p.el.children) c.style.pointerEvents = 'none'; p.close(true); el.classList.remove('has-panel'); };

  // ── picking, drilling, letting go ──
  function pick(id) {
    if (V.stage !== 'look') return false;
    const o = seen.get(id); if (!o || !run.pick(id)) return false;
    hold(o); go('fly'); onSay(o.rock.rich ? 'rich' : 'pick', { ore: o.rock.metal });
    if (o.rock.rich) big('A rich rock!<small>Titanium. Its canisters pay double.</small>', 4);
    return true;
  }
  // a hole at a direction of the rock's own (src/drill.js's frame): the rock turns to bring it under the cutter
  function drillAt(dir) {
    if (V.stage !== 'drill' || V.sub || !H || H.rock.left <= 0) return false;
    if (H.free) return false;
    const S = H.o.S, d = _v.set(dir[0] * S.sq[0], dir[1] * S.sq[1], dir[2] * S.sq[2]).normalize().clone();
    H.turnFrom.copy(H.o.q); _v2.copy(d).applyQuaternion(H.o.q);
    H.turnTo.setFromUnitVectors(_v2, cutDir).multiply(H.o.q);
    // how far round the wrist's own line the spot is from the cutter (the wrist can make that part of the turn), and
    // whether that is all of it (the spot and the cutter the same way along the hand)
    const a = wristAxis, sa = _v2.dot(a), ca = cutDir.dot(a);
    const s2 = _v2.clone().addScaledVector(a, -sa), c2 = cutDir.clone().addScaledVector(a, -ca);
    const round = s2.lengthSq() > 1e-6 && c2.lengthSq() > 1e-6 ? Math.atan2(_v.crossVectors(s2, c2).dot(a), s2.dot(c2)) : 0;
    const want = H.turn + round * wristSign, clear = clearTurn(want);
    H.shift = Math.abs(sa - ca) > 0.035 || Math.abs(clear - want) > 0.01;
    H.t0 = H.turn; H.t1 = clear; H.back = { qPalm: H.qPalm.clone(), grip: H.grip }; H.vel = 0;
    if (H.shift) { H.looseWant = 1; H.free = true; }
    V.sub = 'turn'; V.subT = 0; V.dir = [dir[0], dir[1], dir[2]]; doneEl.hidden = true;
    return true;
  }
  function letGo() { if (V.stage !== 'drill' || V.sub) return false; run.letGo(); go('release'); armsWant = 'reach'; doneEl.hidden = true; rockEl.hidden = true; return true; }
  // (let go on the finger's lift, not on the click a browser makes of it: a tap straight after a drag gets no click on
  // some phones; the click still serves the keyboard)
  doneEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  doneEl.addEventListener('pointerup', (e) => { e.stopPropagation(); letGo(); });
  doneEl.addEventListener('click', (e) => { e.stopPropagation(); letGo(); });

  // ── where things are on the screen ──
  const proj = (p, out) => { _v.copy(p).applyMatrix4(at).project(camera); out.x = (_v.x * 0.5 + 0.5) * innerWidth; out.y = (-_v.y * 0.5 + 0.5) * innerHeight; out.z = _v.z; return out; };
  const pxOf = (p, r) => { const d = _v.copy(p).applyMatrix4(at).sub(camera.position).dot(_v2.set(0, 0, -1).applyQuaternion(camera.quaternion)); return r / Math.max(0.1, d) / Math.tan(camera.fov * Math.PI / 360) * innerHeight / 2; };
  const scr = { x: 0, y: 0, z: 0 };
  function rockUnder(x, y) {
    let best = null, bd = Infinity;
    for (const o of seen.values()) { if (!o.mesh.visible || o.in < 0.6) continue; proj(o.pos, scr); const r = Math.max(30, pxOf(o.pos, o.scale) * 1.3), d = Math.hypot(scr.x - x, scr.y - y); if (scr.z < 1 && d < r && d < bd) { bd = d; best = o; } }
    return best;
  }
  // a tap on the rock in the claw -> the spot's direction in the rock's own frame, or null
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function spotAt(x, y) {
    if (!H) return null;
    ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(H.mesh, false)[0]; if (!hit) return null;
    const p = H.mesh.worldToLocal(hit.point.clone()), S = H.o.S;
    const d = new THREE.Vector3(p.x / S.sq[0], p.y / S.sq[1], p.z / S.sq[2]).normalize();
    return [d.x, d.y, d.z];
  }
  // THE ROCK TURNED BY A DRAG. A drag along the way the wrist turns (up and down the screen, as the working view
  // stands) is the wrist's: the hand and the rock go round together. A drag across that is the other turn: the
  // fingers ease open and the rock turns in the open hand. Which it is, is settled as the drag begins.
  const _up = new THREE.Vector3(), _right = new THREE.Vector3(), DRAG = 0.0085;
  function dragAxes() { _up.set(0, 1, 0).applyQuaternion(camera.quaternion).applyQuaternion(atQi); _right.set(1, 0, 0).applyQuaternion(camera.quaternion).applyQuaternion(atQi); const ua = _up.dot(wristAxis), ra = _right.dot(wristAxis), n = Math.hypot(ua, ra) || 1; return [ua / n, ra / n]; }
  // (which turn a drag that way is: 'wrist' or 'shift')
  function dragKind(dx, dy) { const [ua, ra] = dragAxes(); return Math.abs(dx * ua + dy * ra) >= Math.abs(dx * ra - dy * ua) ? 'wrist' : 'shift'; }
  function turnBy(dx, dy, kind = dragKind(dx, dy)) {
    if (!H || V.stage !== 'drill' || V.sub) return;
    const [ua, ra] = dragAxes();
    if (kind === 'wrist') { if (H.free) return; const phi = (dx * ua + dy * ra) * DRAG; wristBy(phi); H.vel = phi * wristSign; return; }
    _q.setFromAxisAngle(_up, dx * DRAG); _pq2.setFromAxisAngle(_right, dy * DRAG).multiply(_q); looseBy(_pq2);
  }
  let down = null;
  function onDown(e) { if (panel) return; down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, lx: e.clientX, ly: e.clientY }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) { /* a rig's made-up pointer */ } }
  function onMove(e) {
    if (!down || down.id !== e.pointerId) { if (V.stage === 'look' && e.pointerType === 'mouse') { const o = rockUnder(e.clientX, e.clientY); V.hot = o ? o.rock.id : null; e.currentTarget.style.cursor = o ? 'pointer' : 'default'; } return; }
    if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 9) down.moved = true;
    if (down.moved && V.stage === 'drill' && !V.sub) { if (!down.kind) down.kind = H && H.free ? 'shift' : dragKind(e.clientX - down.x, e.clientY - down.y); turnBy(e.clientX - down.lx, e.clientY - down.ly, down.kind); if (down.kind === 'shift' && H) H.settle = 9; }
    down.lx = e.clientX; down.ly = e.clientY; down.at = performance.now();
  }
  function onUp(e) {
    if (!down || down.id !== e.pointerId) return;
    const d = down; down = null;
    if (d.moved) { if (H && d.kind === 'shift') H.settle = 0; else if (H && performance.now() - (d.at || 0) > 90) H.vel = 0; return; }
    if (V.stage === 'look') { const o = rockUnder(e.clientX, e.clientY); if (o) pick(o.rock.id); }
    else if (V.stage === 'drill' && !V.sub) { const s = spotAt(e.clientX, e.clientY); if (s) drillAt(s); }
  }
  function onKey(e) {
    if (panel || V.stage !== 'drill' || V.sub) return;
    const k = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] }[e.key];
    if (k) { e.preventDefault(); turnBy(k[0], k[1]); if (H) H.vel = 0; }
  }
  // (the taps and drags are taken below the game's own row of buttons along the top)
  const pad = el.querySelector('.pdr-touch');
  pad.addEventListener('pointerdown', onDown); pad.addEventListener('pointermove', onMove); pad.addEventListener('pointerup', onUp); pad.addEventListener('pointercancel', () => { down = null; });
  addEventListener('keydown', onKey);
  const onSize = () => { for (const o of seen.values()) place(o); };
  addEventListener('resize', onSize);

  syncSeen();
  for (const o of seen.values()) { o.pos.copy(o.slotPos); o.scale = o.slotScale; }

  const HINTS = { arrive: 'The scan lights up the ore inside each rock: the colour is the metal, more glow is more ore.', look: 'Tap a rock to fly over to it. Its number is what a canister of that ore sells for.', fly: 'The pilot flies you over.', grab: 'The claw takes the rock.', scan: 'Scanning the rock.',
    drill: 'Drag to turn the rock in the claw. Tap a spot to drill there.', breakUp: 'The rock breaks up.', release: 'The claw lets the rock go.', back: 'Looking for the next rock.', full: '' };
  // (what a hole found: the metal there was most of, and any other worth a word)
  const HOLE_WORDS = (h) => {
    if (h.wasted) return 'Bare rock. Nothing there.';
    const by = Object.entries(h.by || {}).sort((a, b) => b[1] - a[1]), [m, t] = by[0] || ['', h.took], more = by[1] && by[1][1] >= 0.05 ? ` And some ${by[1][0]}.` : '';
    return (t < 0.2 ? `A little ${m} ore.` : t < 0.5 ? `Good ${m} ore.` : `A thick vein of ${m}!`) + more;
  };

  function update(dt) {
    if (closed) return;
    V.clock += dt; V.t += dt;
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) hintEl.textContent = hintFor; }
    if (bigT > 0) { bigT -= dt; if (bigT <= 0) bigEl.hidden = true; }
    if (closeIn >= 0) { closeIn -= dt; if (closeIn < 0) { closePanel(); scanned(V.first); } }
    // the arms
    const cutting = V.stage === 'drill' && V.sub === 'cut';
    spin += dt * MB.ARMS.spin * (cutting ? 2.6 : 0.5);
    // (the hand: the wrist's turn, a flick of it running on a little; the fingers easing open and shut)
    if (H) {
      if (!down && H.vel && !H.free && V.stage === 'drill' && !V.sub) { H.turn += H.vel * Math.min(1, dt * 60); H.vel *= Math.exp(-dt * 5); if (Math.abs(H.vel) < 0.0006) H.vel = 0; }
      const goal = H.looseWant * LOOSE; H.loose = goal > H.loose ? Math.min(goal, H.loose + dt * LOOSE / 0.14) : Math.max(goal, H.loose - dt * LOOSE / 0.2);
    }
    const over = H && clawD && H.grip ? { [clawSide]: { turn: H.turn, hold: H.grip, loose: H.loose } } : null;
    MB.armStep(built, armsWant, dt, { spin, over });
    // (the cutter waits just above the rock, clear of the fingers as they go round, and comes down only to cut)
    if (cutD) {
      const cutNow = V.stage === 'drill' && (V.sub === 'down' || V.sub === 'cut');
      cutCap = cutNow ? Math.min(1, cutCap + dt * 1.5) : Math.max(CUT_UP, cutCap - dt * 1.5);
      if (cutD.work > cutCap) { cutD.work = cutCap; MB.armShow(built, spin, over); }
    }
    standIn();
    const gripped = clawD ? (clawD.grip || 0) >= 1 : true, onRock = cutD ? (cutD.work || 0) >= 1 : true, cutReady = cutD ? (cutD.work || 0) >= CUT_UP - 0.001 : true, cutClear = cutD ? (cutD.work || 0) <= CUT_UP + 0.04 : true;

    // the stages
    const S = V.stage;
    if (S === 'arrive') { hint(HINTS.arrive); if (V.t > T.arrive) go('look'); }
    else if (S === 'look') hint(HINTS.look);
    else if (S === 'fly') {
      hint(HINTS.fly);
      const k = ease(V.t / T.fly), o = H.o;
      o.pos.lerpVectors(H.from.pos, heldPos, k); o.scale = H.from.scale + (H.R - H.from.scale) * k;
      if (V.t >= T.fly) { go('grab'); armsWant = 'work'; scanT = 0; H.o.pos.copy(heldPos); H.turn = 0; regrip(); openScan(); }
    } else if (S === 'grab') {
      hint(panel ? HINTS.scan : HINTS.grab);
      H.o.pos.copy(heldPos); H.o.scale = H.R; scanT += dt; heldMat.uniforms.uScan.value = V.scanDone ? 0 : 0.02 + (scanT * 0.55) % 1;
      if (V.scanDone && gripped && cutReady) { go('drill'); heldMat.uniforms.uScan.value = 0; }
    } else if (S === 'drill') {
      H.o.pos.copy(heldPos);
      if (!V.sub) { hint(HINTS.drill); doneEl.hidden = false; }
      else if (V.sub === 'turn') {
        // (the wrist brings the spot under the cutter, the hand and the rock together; where the wrist cannot, the
        // fingers ease open first, the rock turns in the open hand, and they shut on it again)
        if (!H.shift || H.loose >= LOOSE * 0.8) {
          V.subT += dt; const k = ease(V.subT / T.turn); H.turn = H.t0 + (H.t1 - H.t0) * k; if (H.shift) H.o.q.slerpQuaternions(H.turnFrom, H.turnTo, k);
          if (V.subT >= T.turn) { if (H.shift) regrip(); V.sub = 'down'; V.subT = 0; }
        }
      } else if (V.sub === 'down') {
        if (onRock && H.loose <= 0.02) {
          // the hole is made: the ore near it goes to the canisters
          const h = run.drill(V.dir); V.sub = 'cut'; V.subT = 0; V.hole = h; V.lastHole = h ? { took: +h.took.toFixed(3), by: h.by, wasted: h.wasted, left: h.left } : null;
          if (h) {
            const U = heldMat.uniforms, n = H.rock.made.length; U.uHoles.value[Math.min(7, n - 1)].set(...H.rock.made[n - 1]); U.uHoleN.value = Math.min(8, n);
            V.crackTo = Math.min(1, n / H.rock.holes) * 0.62;
            hint(HOLE_WORDS(h), 2.2);
            if (H.rock.rich && run.rich && !V.richSaid) { V.richSaid = true; big('Titanium aboard!<small>Its canisters pay double.</small>'); onSay('richAboard'); }
          }
        }
      } else if (V.sub === 'cut') {
        V.subT += dt;
        // chips drift away from the hole
        if (Math.random() < dt * 16) { const p = heldPos.clone().addScaledVector(cutDir, H.R * 0.95), v = cutDir.clone().multiplyScalar(0.7 + Math.random() * 1.1).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.3)); chip(p, v, 0.05 + Math.random() * 0.09, 1.6 + Math.random() * 1.6); }
        if (V.subT >= T.cut) {
          const h = V.hole; V.sub = 'turnBack'; V.subT = 0; V.hole = null;
          if (h && h.done) { go('full'); armsWant = 'stowed'; doneEl.hidden = true; rockEl.hidden = true; big(`All ${DRILL.cans} canisters are full!<small>${esc(cap(lotsWords(lotsOf(run.load()))))}</small>`, T.full); onSay('full'); }
          else if (h && h.broke) { go('breakUp'); armsWant = 'reach'; doneEl.hidden = true; rockEl.hidden = true; breakUp(); }
        }
      }
      else if (V.sub === 'turnBack') {
        // (the claw turns the rock back as it was: the hole is seen where it was tapped, the glow round it thinner)
        if (H.shift && V.subT === 0) { H.looseWant = 1; H.free = true; }
        if (cutClear && (!H.shift || H.loose >= LOOSE * 0.8)) {
          V.subT += dt; const k = ease(V.subT / T.turn); H.turn = H.t1 + (H.t0 - H.t1) * k; if (H.shift) H.o.q.slerpQuaternions(H.turnTo, H.turnFrom, k);
          if (V.subT >= T.turn) { if (H.shift) { H.qPalm.copy(H.back.qPalm); H.grip = H.back.grip; H.looseWant = 0; H.free = false; } V.sub = ''; }
        }
      }
      // (a drag across the wrist's way: the rock turns in the open hand, and the fingers shut on it when the finger lifts)
      if (!V.sub && H.free) {
        if (H.pending && H.loose >= LOOSE * 0.6) { H.o.q.premultiply(H.pend).normalize(); H.pend.identity(); H.pending = false; }
        if (!H.pending) { H.settle -= dt; if (H.settle <= 0) regrip(); }
      }
      const U = heldMat.uniforms; if (V.crackTo != null) U.uCrack.value += (V.crackTo - U.uCrack.value) * Math.min(1, dt * 4);
    } else if (S === 'breakUp') { hint(HINTS.breakUp); if (V.t > T.breakUp) { dropHeld(); go('back'); } }
    else if (S === 'release') {
      hint(HINTS.release);
      if (H) { const k = ease(V.t / T.release); H.o.pos.copy(heldPos).addScaledVector(_v.set(0.25, 0.1, 1).normalize(), k * 14); H.o.scale = H.R * (1 - 0.5 * k); }
      if (V.t > T.release) { dropHeld(); go('back'); }
    } else if (S === 'back') { hint(HINTS.back); syncSeen(); if (V.t > T.back) go('look'); }
    else if (S === 'full') {
      if (H && V.t > 0.6) { const k = ease((V.t - 0.6) / 1.4); H.o.pos.copy(heldPos).addScaledVector(_v.set(0.25, 0.1, 1).normalize(), k * 14); }
      if (V.t > T.full && !V.ended) { V.ended = true; const load = run.load(), lots = lotsOf(load); onDone({ load, lots, sells: loadSells(load, ore), rich: load.includes('titanium'), richField: run.richField, stats: { ...run.stats }, secs: V.clock, metal: lots.length === 1 ? lots[0].metal : 'mixed' }); }
    }

    // the rocks in reach: each at its place (one just come drifts in); the one in the claw where the claw has it
    const looking = S === 'look' || S === 'arrive' || S === 'back';
    for (const o of seen.values()) {
      if (H && o === H.o) continue;
      if (o.in < 1) o.in = Math.min(1, o.in + dt / 1.6);
      const k = ease(o.in);
      o.glow += ((looking ? 1 : 0) - o.glow) * Math.min(1, dt * 2.6);
      // (drawn larger than life while looking, the scan's picture of it; at its true size while another is worked)
      o.pos.copy(o.slotPos); o.pos.z += (1 - k) * 90; o.pos.y += (1 - k) * 14; o.scale = (TRUE_R + (o.slotScale - TRUE_R) * ease(o.glow)) * (0.4 + 0.6 * k);
      _q.setFromAxisAngle(_v.set(0.3, 1, 0.1).normalize(), o.spin * dt); o.q.premultiply(_q);
      o.mesh.matrix.compose(o.pos, o.q, _s.setScalar(o.scale)); o.mesh.matrixWorldNeedsUpdate = true;
    }
    if (H && !H.free && H.grip) H.o.q.copy(palmQ(H.turn, _pq)).multiply(H.qPalm);
    if (H) { H.mesh.visible = S !== 'breakUp'; H.mesh.matrix.compose(H.o.pos, H.o.q, _s.setScalar(H.o.scale)); H.mesh.matrixWorldNeedsUpdate = true; }
    // the glow follows the ore left
    glowN = 0;
    for (const o of seen.values()) {
      for (const L of o.rock.lumps) { if (L.show == null) L.show = L.ore; L.show += (L.ore - L.show) * Math.min(1, dt * 3.2); }
      if (H && o === H.o) { if (S !== 'breakUp') glowOf(o, o.scale, 1.15); } else glowOf(o, o.scale, (0.5 + 0.5 * o.glow) * ease(o.in));
    }
    const A = glow.geometry.attributes; glow.geometry.setDrawRange(0, glowN); for (const k of ['position', 'aC', 'aCol', 'aSize', 'aR']) A[k].needsUpdate = true;
    stepChips(dt);

    // the canisters: each shows the colours of what is in it (the drill sorts the ore by metal, the dearest first);
    // full, each is the one colour of the metal it is sold as
    for (const m of Object.keys(run.ore)) { const a = shownOre[m] || 0, b = run.ore[m]; shownOre[m] = Math.abs(b - a) < 0.004 ? b : a + (b - a) * Math.min(1, dt * 2.5); }
    const row = canistersOf(S === 'full' ? run.ore : shownOre), sealed = S === 'full';
    cansB.textContent = `${run.full} of ${DRILL.cans}`;
    cansI.forEach((c, i) => {
      const k = row[i]; let at = 0; const stops = [];
      for (const [m, t] of sealed && k.metal ? [[k.metal, 1]] : k.parts) { const col = (ORE[m] || ORE.copper).glow, to = Math.min(100, at + t * 100); stops.push(`${col} ${at.toFixed(1)}% ${to.toFixed(1)}%`); at = to; }
      const bg = stops.length ? `linear-gradient(to top, ${stops.join(', ')}, rgba(255, 255, 255, 0.04) ${at.toFixed(1)}%)` : '';
      if (c._bg !== bg) { c._bg = bg; c.style.background = bg; }
    });
    // (what the load would sell for so far: its full canisters, each as the metal there is most of in it)
    const worth = row.reduce((sum, k) => sum + (k.fill >= 1 - 1e-6 && k.metal ? sellsFor(k.metal) : 0), 0), wt = worth > 0 ? `Sells for <b>${say(worth)}</b>${sealed ? '' : ' so far'}` : '';
    if (sellsEl._t !== wt) { sellsEl._t = wt; sellsEl.innerHTML = wt; }
    if (H && (V.stage === 'grab' || V.stage === 'drill')) {
      const A = H.rock.also ? ORE[H.rock.also] : null;
      rockEl.hidden = false; rockEl.querySelector('small').textContent = `${(ORE[H.rock.metal] || {}).sym || ''} ${cap(H.rock.metal)}${A ? ' + ' + A.sym + ' ' + cap(H.rock.also) : ''}`; rockEl.querySelector('b').textContent = String(H.rock.left); rockEl.querySelector('span').textContent = H.rock.left === 1 ? 'hole left' : 'holes left';
      rockEl.querySelector('em').textContent = `A canister sells for ${say(sellsFor(H.rock.metal))}${A ? ' (' + H.rock.also + ': ' + say(sellsFor(H.rock.also)) + ')' : ''}`;
    }
  }
  // a load's lots, the most canisters first: [{ metal, canisters }]
  function lotsOf(load) { const n = {}; for (const m of load) n[m] = (n[m] || 0) + 1; return Object.entries(n).map(([m, c]) => ({ metal: m, canisters: c })).sort((a, b) => b.canisters - a.canisters || sellsFor(b.metal) - sellsFor(a.metal)); }
  // the rock breaks into pieces that float off
  function breakUp() {
    if (!H) return;
    for (let i = 0; i < 16; i++) { const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); chip(heldPos.clone().addScaledVector(d, H.R * 0.45), d.multiplyScalar(0.9 + Math.random() * 1.6), H.R * (0.2 + Math.random() * 0.26), T.breakUp + 0.6 + Math.random()); }
    onSay('broke');
  }

  // ── the eye, and the tags that follow the rocks ──
  function aim(cameraIn = camera, dt = 1 / 60) {
    if (closed) return;
    const S = V.stage, working = !(S === 'look' || S === 'arrive' || S === 'back'), P = viewOf(working ? 'work' : 'look');
    want.eye.set(...P.eye); want.look.set(...P.look); want.fov = P.fov;
    if (working && panel) {
      // (clear of the job panel: it covers the right of a wide screen and the bottom of a tall one)
      if (tall()) { want.look.y -= 2.7; want.fov = P.fov + 8; } else { _v.subVectors(want.look, want.eye).normalize(); _v2.crossVectors(_v, _s.set(0, 1, 0)).normalize(); want.look.addScaledVector(_v2, 2.9); want.fov = P.fov + 6; }
    }
    if (cam.fresh) { cam.eye.copy(want.eye); cam.look.copy(want.look); cam.fov = want.fov; cam.fresh = false; }
    else { const k = 1 - Math.exp(-CAM_RATE * dt); cam.eye.lerp(want.eye, k); cam.look.lerp(want.look, k); cam.fov += (want.fov - cam.fov) * k; }
    cameraIn.position.copy(cam.eye).applyMatrix4(at); cameraIn.up.set(0, 1, 0); cameraIn.lookAt(_v.copy(cam.look).applyMatrix4(at));
    if (Math.abs(cameraIn.fov - cam.fov) > 0.01 || cameraIn.far !== 900) { cameraIn.fov = cam.fov; cameraIn.near = 0.3; cameraIn.far = 900; cameraIn.aspect = innerWidth / innerHeight; cameraIn.updateProjectionMatrix(); }
    cameraIn.updateMatrixWorld(true);
    glow.material.uniforms.uPx.value = renderer.getDrawingBufferSize(ndc).y / (2 * Math.tan(cam.fov * Math.PI / 360));
    // the tags
    const show = S === 'look' || S === 'arrive' || S === 'back';
    for (const [id, t] of tags) if (!seen.has(id)) { t.remove(); tags.delete(id); }
    for (const o of seen.values()) {
      const t = tagOf(o), on = show && o.mesh.visible && o.in > 0.85 && !(H && H.o === o);
      t.hidden = !on; if (!on) continue;
      proj(o.pos, scr); const r = Math.max(22, pxOf(o.pos, o.scale) * 1.22);
      t.style.transform = `translate(${scr.x.toFixed(1)}px, ${scr.y.toFixed(1)}px)`; t.classList.toggle('is-hot', V.hot === o.rock.id);
      const ring = t.firstChild, line = ring.nextSibling, word = line.nextSibling;
      ring.style.width = ring.style.height = (r * 2).toFixed(0) + 'px'; line.style.top = r.toFixed(0) + 'px'; line.style.height = '9px'; word.style.top = (r + 9).toFixed(0) + 'px';
    }
  }

  function close() {
    if (closed) return; closed = true;
    closePanel(); removeEventListener('keydown', onKey); removeEventListener('resize', onSize); el.remove();
    for (const id of [...seen.keys()]) dropSeen(id);
    if (H) { G.remove(H.mesh); H.mesh.geometry.dispose(); H = null; }
    G.remove(built.group); scene.remove(G, sun, sun.target);
    far.geometry.dispose(); chips.geometry.dispose(); glow.geometry.dispose(); glow.material.dispose(); fieldMat.dispose(); heldMat.dispose();
    camera.near = was.near; camera.far = was.far; camera.fov = was.fov; camera.updateProjectionMatrix();
  }

  // (the rigs: what is where on the screen; a careful driller's next spot among those that can be seen)
  const rig = {
    rocks: () => [...seen.values()].filter((o) => !(H && H.o === o)).map((o) => { proj(o.pos, scr); return { id: o.rock.id, slot: o.rock.slot, metal: o.rock.metal, also: o.rock.also, sells: sellsFor(o.rock.metal), rich: o.rock.rich, size: o.rock.size, grade: o.rock.grade, ore: +o.rock.lumps.reduce((s, L) => s + L.ore, 0).toFixed(3), x: Math.round(scr.x), y: Math.round(scr.y), r: Math.round(pxOf(o.pos, o.scale)) }; }),
    // the best spot facing the eye: [{ x, y, worth }] best first
    spots(n = 400) {
      if (!H) return [];
      const out = [], S = H.o.S, toEye = camera.position.clone().applyMatrix4(atInv).sub(H.o.pos).normalize();
      for (let i = 0; i < n; i++) {
        const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653, d = [r * Math.cos(a), y, r * Math.sin(a)];
        const n3 = new THREE.Vector3(d[0], d[1], d[2]), g = new THREE.Vector3(d[0] * S.sq[0], d[1] * S.sq[1], d[2] * S.sq[2]).multiplyScalar(radiusAt(S, n3) * H.o.scale).applyQuaternion(H.o.q);
        if (g.clone().normalize().dot(toEye) < 0.74) continue;      // (well inside the rock's outline as the eye sees it)
        proj(g.add(H.o.pos), scr); out.push({ x: Math.round(scr.x), y: Math.round(scr.y), worth: +holeWorth(H.rock, d).toFixed(4), dir: d });
      }
      return out.sort((p, q) => q.worth - p.worth);
    },
    pick, drillAt, letGo, turnBy, dragKind,
    hand: () => (H ? { turn: +H.turn.toFixed(3), loose: +H.loose.toFixed(2), free: H.free, shift: H.shift, axis: wristAxis.toArray().map((x) => +x.toFixed(3)), sign: wristSign, cut: cutDir.toArray().map((x) => +x.toFixed(3)), at: heldPos.toArray().map((x) => +x.toFixed(2)), under: fingerUnder(H.turn), grip: H.grip, gripMs: +(H.gripMs || 0).toFixed(2), cutter: cutD ? +cutD.work.toFixed(2) : null } : null),
    probe: (x, y) => ({ spot: spotAt(x, y), over: (document.elementFromPoint(x, y) || {}).className || null, stage: V.stage, sub: V.sub, down: !!down }),
  };
  return { el, run, update, aim, close, rig, get panel() { return panel; }, get stage() { return V.stage; },
    state: () => ({ stage: V.stage, sub: V.sub, t: +V.t.toFixed(2), clock: +V.clock.toFixed(2), cans: +run.cans.toFixed(3), full: run.full, ore: Object.fromEntries(Object.entries(run.ore).map(([m, t]) => [m, +t.toFixed(3)])), load: run.load(), sells: loadSells(run.load().filter(Boolean), ore), rich: run.rich, richField: run.richField, stats: { ...run.stats }, lastHole: V.lastHole,
      held: H ? { id: H.rock.id, metal: H.rock.metal, also: H.rock.also, left: H.rock.left, holes: H.rock.holes, tuned: H.rock.tuned, ore: +H.rock.lumps.reduce((s, L) => s + L.ore, 0).toFixed(3) } : null,
      panel: panel ? panel.state() : null, hint: hintEl.textContent, done: !doneEl.hidden, glow: glowN, chips: bits.length, arms: armDoors.map((D) => ({ t: +D.t.toFixed(2), work: +(D.work || 0).toFixed(2), grip: +(D.grip || 0).toFixed(2) })), log: V.log.slice(-14) }) };
}
