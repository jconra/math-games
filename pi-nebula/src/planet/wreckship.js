// THE CRASHED SHIP, DRAWN (its plain numbers: src/planet/wreck.js). One of our four ships built by the kit's own
// layout code from its own room file and pieces (kit/rooms/ship-<ship>-built.json, kit/ships/<ship>-built.js: the
// same builders the Ship Lab and the station use, nothing of their geometry copied or changed), posed as after a hard
// landing by the ship's own pose (its gear up and its wells shut, the Miner's arms folded), its parts drawn as they
// stand into one list of triangles per kind of surface, broken apart, and its pieces laid on the ground beside the
// landing place in another crew's colours.
//
// THE KINDS OF SURFACE, each piece one draw of each: the painted skin (the kit's grime material, the ship's own
// streaks and dirt, its own dirt amount kept apart from our ship's), the canopy's dark glass, and everything that
// glowed or showed a screen, now dark (its lights are out). The ship's markings are left off (they are our station's).
// Drawn as the planet's own things are (src/planet/cover.js onGround): the planet's curve, the sun and sky's light from
// the ground's light picture where each piece lies, the same haze. Its skin is seen from both sides: from inside, where
// a break opens it, it is dark, and its paint is scorched dark along the breaks.
//
//   const W = await makeWreck({ land, ship, pieces, seed })   before the planet is drawn: built, broken, placed, and the
//                                                            ground under it cleared (no trees or plants through it);
//                                                            no ship or pieces given: the seed's (wreck.js wreckFor)
//   W.draw({ scene, ground, sky, paint })                    once the planet is made (its ground's shared settings);
//                                                            no paint given: the seed's
//   W.paint(id)                                              another of the colours (src/planet/wreck.js PAINTS)
//   W.group, W.site, W.plan, W.stats { ms, buildMs, breakMs, placeMs, tris, draws, pieces }, W.dispose()
//   W.world                                                  [{ tris }]: each piece's triangles where it lies (x, y, z
//                                                            corners), as cleared under (the stasis pods keep off them)
import * as THREE from 'three';
import { SKY_GLSL } from './cloudSky.js';
import { HAZE_GLSL } from './ground.js';
import { HAZE_SKY_GLSL } from './cover.js';
import { castsShadow } from './groundshadow.js';
import { wreckPlan, breakApart, wreckSite, settle, clearUnder, recolour, PAINTS, wreckFor, WRECK_SHIPS } from './wreck.js';

const KIT = new URL('../../kit/', import.meta.url).href;
const MODULES = { explorer: 'explorer-built.js', miner: 'miner-built.js', medic: 'medic-built.js', hauler: 'hauler-built.js' };
// each ship as it lies after coming down hard: its gear up and its wells shut, the Miner's arms folded and its
// canisters on their mounts (each ship's own LAB.pose, "for pictures part way")
export const CRASH_POSE = { explorer: { gear: 1, doors: 1 }, miner: { gear: 1, doors: 1, arms: 1, canisters: true }, medic: { gear: 1 }, hauler: { gear: 1 } };
// the bake of the corners' darkness (kit/bake.js): coarser than the Ship Lab's (0.08 m, 24 rays), it is made each time
export const WRECK_BAKE = { voxel: 0.12, rays: 12 };
// the grime on it: dirtier than our own ships (each ship's own LAB.dirt 'Lots')
const DIRT = 'Lots';
// the surfaces' kinds by the kit's material names (the kit names each mesh by its material: 'solid', 'eb:strut:nose:solid')
const KIND = (name) => { const k = name.split(':').pop(); return k === 'solid' || k === 'solidInst' || k === 'floor' ? 'skin' : k === 'glass' ? 'glass' : k === 'decal' ? null : 'dark'; };
const ATTRS = { skin: { normal: 3, uv: 2, color: 3, aRMW: 3, aAO: 1, aBake: 3 }, glass: { normal: 3 }, dark: { normal: 3 } };
const DEFAULT = { normal: [0, 1, 0], uv: [0, 0], color: [1, 1, 1], aRMW: [0.6, 0, 0.5], aAO: [1], aBake: [0, 0, 0] };

// the ship's parts as they stand, in its own frame: { skin, glass, dark } soups (src/planet/wreck.js breakApart)
function flatten(B) {
  const lists = { skin: [], glass: [], dark: [] }, m = new THREE.Matrix4();
  B.group.updateMatrixWorld(true);
  B.group.traverse((o) => {
    if (!o.isMesh) return;
    const kind = KIND(o.name); if (!kind) return;
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); if (Math.abs(m.determinant()) < 1e-9) continue; lists[kind].push({ g: o.geometry, M: m.clone().premultiply(o.matrixWorld), i }); }
    } else lists[kind].push({ g: o.geometry, M: o.matrixWorld.clone(), i: -1 });
  });
  const soups = {}, v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const [kind, list] of Object.entries(lists)) {
    let nv = 0; for (const { g } of list) nv += g.index ? g.index.count : g.attributes.position.count;
    if (!nv) continue;
    const S = { position: { size: 3, array: new Float32Array(nv * 3) } };
    for (const [a, z] of Object.entries(ATTRS[kind])) S[a] = { size: z, array: new Float32Array(nv * z) };
    let w = 0;
    for (const { g, M, i } of list) {
      nm.getNormalMatrix(M);
      const idx = g.index ? g.index.array : null, cnt = idx ? idx.length : g.attributes.position.count, P = g.attributes.position;
      // (an instanced leaf's own baked light, for every vertex of it)
      const ib = i >= 0 && g.attributes.iBake ? [g.attributes.iBake.getX(i), g.attributes.iBake.getY(i), g.attributes.iBake.getZ(i)] : null;
      for (let q = 0; q < cnt; q++, w++) {
        const k = idx ? idx[q] : q;
        v.fromBufferAttribute(P, k).applyMatrix4(M); S.position.array.set([v.x, v.y, v.z], w * 3);
        for (const [a, z] of Object.entries(ATTRS[kind])) {
          const src = g.attributes[a], dst = S[a].array;
          if (a === 'normal') { if (src) v.fromBufferAttribute(src, k).applyMatrix3(nm).normalize(); else v.set(0, 1, 0); dst.set([v.x, v.y, v.z], w * 3); continue; }
          if (a === 'aBake' && !src && ib) { dst.set(ib, w * 3); continue; }
          if (src) for (let c = 0; c < z; c++) dst[w * z + c] = src.array[k * src.itemSize + c];
          else dst.set(DEFAULT[a], w * z);
        }
      }
    }
    soups[kind] = S;
  }
  return soups;
}
const boxOf = (soups) => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const S of Object.values(soups)) { const P = S.position.array; for (let i = 0; i < P.length; i += 3) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], P[i + c]); max[c] = Math.max(max[c], P[i + c]); } }
  return { min, max };
};

// THE PLANET'S WAYS for the wreck's materials (as src/planet/cover.js onGround does for the rocks and plants, for a mesh
// placed by its own matrix): the ground's light picture where the piece lies (its sun and its sky), the planet's curve,
// the haze; its skin seen from inside dark, scorched along the breaks. (kind: 'skin', 'glass', 'dark')
function onGround(mat, { ground, sky, kind }) {
  const U = ground.U, prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey && mat.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    Object.assign(sh.uniforms, { uL: U.uL, uP: U.uP, uN: U.uN, uCam: U.uCam, uCurve: U.uCurve, uHaze: U.uHaze, uHazeH: U.uHazeH, uHazeBase: U.uHazeBase });
    if (sky) Object.assign(sh.uniforms, sky.uniforms);
    // (no light from its strips: they are out; the corners' darkness keeps the sun off what is inside the hull)
    if (sh.uniforms.uBakeGain) sh.uniforms.uBakeGain = { value: 0 };
    if (sh.uniforms.uAODirect) sh.uniforms.uAODirect = { value: 1 };
    sh.vertexShader = 'uniform sampler2D uL; uniform float uP, uN, uCurve; uniform vec3 uCam; attribute float aBreak;\nvarying float vSun, vSky, vBreak; varying vec3 vPlace;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec2 at = vec2(modelMatrix[3][0], modelMatrix[3][2]); vec4 ls = texture2D(uL, (at + 0.5 * uP) / uP + 0.5 / uN); vSun = ls.r; vSky = ls.g; vBreak = aBreak; }`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 wp = modelMatrix * vec4(transformed, 1.0); vec2 d = wp.xz - uCam.xz; vPlace = wp.xyz;
          mvPosition.xyz -= (viewMatrix * vec4(0.0, dot(d, d) * uCurve, 0.0, 0.0)).xyz; gl_Position = projectionMatrix * mvPosition; }`);
    // (lit: how much of the sun and sky reach it: all of it, but along a break (scorched) and inside the hull (a face
    // seen from its back), where hardly any does: there is no shadow from the hull itself, so it is taken off here)
    let f = 'varying float vSun, vSky, vBreak; varying vec3 vPlace;\n' + (sky ? SKY_GLSL + HAZE_GLSL : '') + sh.fragmentShader.replace('void main() {', 'void main() {\n  float lit = 1.0;');
    f = f.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin
      .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= vSun * lit;')
      .replace(/irradiance \+= getHemisphereLightIrradiance/g, 'irradiance += vSky * (0.2 + 0.8 * lit) * getHemisphereLightIrradiance'));
    if (kind === 'skin') f = f.replace('#include <lights_physical_fragment>', `
      { float burn = 1.0 - smoothstep(0.04, 1.0, vBreak);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.027, 0.025), burn * 0.9);
        lit = 1.0 - 0.8 * burn;
        if (!gl_FrontFacing) { diffuseColor.rgb = vec3(0.03, 0.028, 0.026); metalnessFactor = 0.0; roughnessFactor = 0.95; lit = 0.0; } }
      #include <lights_physical_fragment>`);
    if (sky) f = f.replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeSky(vPlace), hazeAmt(cameraPosition, vPlace));\n#include <tonemapping_fragment>').replace('void main() {', HAZE_SKY_GLSL + '\nvoid main() {');
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => prevKey() + '|wreck-' + kind + (sky ? '-air' : '');
  if (kind === 'skin') mat.side = THREE.DoubleSide;
  return mat;
}

// ITS SHADOW on the ground: each piece's skin casts, as everything standing on the planet does (src/planet/groundshadow.js).

const say = (t0) => Math.round(performance.now() - t0);
export async function makeWreck({ land, ship = null, pieces = null, seed = land.seed }) {
  const t0 = performance.now(), own = wreckFor(seed);
  ship = WRECK_SHIPS.includes(ship) ? ship : own.ship;
  pieces = pieces === 2 || pieces === 3 ? pieces : own.pieces;
  const [L, C, S] = await Promise.all([import(KIT + 'layout.js'), import(KIT + 'ships/built-common.js'), import(KIT + 'ships/' + MODULES[ship])]);
  const room = await L.loadRoom(KIT + `rooms/ship-${ship}-built.json`);
  const tLoad = performance.now();
  // built by the kit's own layout code; its meshes only read here (one stand-in material for them all)
  const stand = new THREE.MeshBasicMaterial(), mats = new Proxy({}, { get: () => stand });
  const B = L.buildRoom(room, mats, { bake: WRECK_BAKE, compact: false });
  S.LAB.pose(B, CRASH_POSE[ship], { updateDoors: L.updateDoors, person: { position: new THREE.Vector3(0, -100, 0) }, jets: [] });
  const soups = flatten(B), bakeMs = B.stats.bake.ms;
  B.dispose(); stand.dispose();
  const tBuild = performance.now();
  // broken, placed, and the ground under it cleared
  const box = boxOf(soups), plan = wreckPlan(seed, box, { ship, pieces });
  const broken = breakApart(soups, plan);
  const tBreak = performance.now();
  const parts = broken.pieces.map((pc) => {
    const all = Object.values(pc).map((s) => s.position.array), n = all.reduce((t, a) => t + a.length, 0), pts = new Float32Array(n);
    let o = 0; for (const a of all) { pts.set(a, o); o += a.length; }
    const b = boxOf(pc);
    return { pts, pivot: [0, 1, 2].map((c) => (b.min[c] + b.max[c]) / 2) };
  });
  const site = wreckSite(land, seed), placed = settle(parts, land, site, plan);
  const world = placed.mats.map((m, k) => { const M = new THREE.Matrix4().fromArray(m), P = parts[k].pts, out = new Float32Array(P.length), v = new THREE.Vector3(); for (let i = 0; i < P.length; i += 3) { v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(M); out[i] = v.x; out[i + 1] = v.y; out[i + 2] = v.z; } return { tris: out }; });
  const cleared = clearUnder(land, world);
  const tPlace = performance.now();

  const group = new THREE.Group(); group.name = 'planet:wreck';
  let tris = 0; for (const pc of broken.pieces) for (const s of Object.values(pc)) tris += s.position.array.length / 9;
  const stats = { ship, pieces: broken.pieces.length, loadMs: Math.round(tLoad - t0), buildMs: Math.round(tBuild - tLoad), bakeMs, breakMs: Math.round(tBreak - tBuild), placeMs: Math.round(tPlace - tBreak), ms: say(t0), tris: Math.round(tris), trisShip: broken.stats.trisIn, cut: broken.stats.cut, draws: 0, gap: placed.gap, low: placed.low, cleared };
  const geos = [], materials = [];
  let skinGeos = [];
  const W = {
    ship, plan, site: placed.site, placed, group, stats, paintId: null, world, shades: [],
    draw({ scene, ground, sky = null, sunDir = null, paint = null }) {
      const td = performance.now();
      const shadow = !!(sunDir && ground.shadows);
      const M = C.grimeMaterials({}, { dirt: (S.LAB.dirt || {})[DIRT] ?? 0.9, streaks: S.STREAKS, deck: S.DECK, grime: { dirt: { value: (S.LAB.dirt || {})[DIRT] ?? 0.9 } }, key: 'wreckgrime-' + ship });
      const byKind = {
        skin: onGround(M.solid, { ground, sky, kind: 'skin' }),
        glass: onGround(M.glass, { ground, sky, kind: 'glass' }),
        dark: onGround(new THREE.MeshStandardMaterial({ color: 0x16191d, roughness: 0.55, metalness: 0.1 }), { ground, sky, kind: 'dark' }),
      };
      // (its own spots of the picture marked, so no shadow is drawn over it: src/planet/groundshadow.js castsShadow)
      for (const m of Object.values(byKind)) castsShadow(m);
      materials.push(...Object.values(byKind));
      broken.pieces.forEach((pc, k) => {
        for (const [kind, s] of Object.entries(pc)) {
          const g = new THREE.BufferGeometry();
          for (const [a, A] of Object.entries(s)) g.setAttribute(a, new THREE.BufferAttribute(A.array, A.size));
          g.computeBoundingSphere(); g.boundingSphere.radius += 30;   // (the curve draws it lower the further off it is)
          if (kind === 'skin') { g.userData.color0 = s.color.array.slice(); skinGeos.push(g); }
          const mesh = new THREE.Mesh(g, byKind[kind]); mesh.name = `wreck:${k}:${kind}`;
          mesh.matrixAutoUpdate = false; mesh.matrix.fromArray(placed.mats[k]); mesh.matrixWorldNeedsUpdate = true;
          if (kind === 'glass') mesh.renderOrder = 2;
          group.add(mesh); geos.push(g); stats.draws++;
          if (kind === 'skin' && shadow) { W.shades.push(ground.shadows.add(mesh)); stats.draws++; }
        }
      });
      W.paint(paint);
      scene.add(group);
      stats.drawMs = say(td);
      return W;
    },
    paint(id) {
      if (!PAINTS[id]) id = own.paint;
      W.paintId = id;
      for (const g of skinGeos) { const a = g.attributes.color; recolour(g.userData.color0, id, { out: a.array }); a.needsUpdate = true; }
    },
    dispose() { for (const s of W.shades) s.dispose(); W.shades = []; group.removeFromParent(); for (const g of geos) g.dispose(); for (const m of materials) m.dispose(); skinGeos = []; },
  };
  return W;
}
