// THE TREES on the worlds with plants: two of the Terrain Lab's (its Tree Lab's oak and pine, the lighter "sparse" ones
// its phones get: assets/planet/oak.glb, pine.glb), recoloured the way the ground plants are, and drawn the Terrain
// Lab's way (jconra.com's src/objects/forest.js, followed here, not copied): the trees near the camera are the models
// themselves, every other one is a ready-made picture of itself (an octahedral imposter: src/planet/imposter.js,
// copied), the picture taken from many directions at once when the planet is made, and between the two a dithered
// crossfade, so nothing pops. The game's maker, 2026-11-20 (PLAN1-2 B): "One or two kinds of tree too, recoloured",
// and "You can probably use the same LOD system that the terrain lab has".
//
// Followed from the Terrain Lab's forest: the circle of models sits ahead of the camera (the trees you look at, not the
// ones behind); close by (40 m) a tree is a model whichever way you look; each tree changes at its own distance (spread),
// so the change comes a tree at a time, not as a line across a wood; past the most models a tier allows, the furthest
// ease into their pictures first; the pictures 192 pixels a view (never less, for trees: the game's maker's rule for the
// Terrain Lab), fewer views on the lower tiers; on its lowest tier (potato) no models at all, every tree its picture,
// the views fewer still and without the depth each pixel of a picture carries (cheaper on a weak graphics chip).
//
// The planet's own: the ground repeats every 2 km, so every tree is drawn at the ground's copies of it round the camera,
// out to the tier's reach, up to 2 km (shrinking away to nothing at its edge; past that the ground carries the woods'
// colour: ground.js);
// the planet's curve; the ground's own light where each tree stands (its long shadows, its hollows: the light picture,
// as the rocks and plants have it); the haze; and the colours: each tree's whole colour turned to one of the planet's
// leaf colours, as the ground plants' are (src/planet/cover.js planetTurn), the same in the model and its picture.
// Each kind's model is loaded only for a world that has that kind (about 1 MB each).
//
//   const trees = await makeTrees({ renderer, land, look, ground, quality, sky })   (null when the world has none)
//   trees.group; trees.update(camera); trees.stats { trees, models, kinds, bakeMs, loadMs }; trees.dispose()
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bakeImposterSteps, imposterMaterial } from './imposter.js';
import { onGround, TURN_GLSL, HAZE_SKY_GLSL, turnOf, planetTurn } from './cover.js';
import { SKY_GLSL } from './cloudSky.js';
import { HAZE_GLSL } from './ground.js';
import { TREES } from './kinds.js';
import { TREE_STRIDE, wrapD } from './land.js';

// per tier (the game's own three: src/station.js), after the Terrain Lab's own tiers (its src/valley.js TIER_SET: potato,
// normal, gaming): meshAt, band: the models out to meshAt metres ahead, crossfading over band; grid: views across the
// picture (each 192 pixels); depth: each picture's pixel set at its own depth (off on the lowest, as the Terrain Lab's
// potato has it); reach: how far off a tree is drawn at all (up to 2,048 m: the four copies of each drawn cover that
// much round the camera); most: the most trees drawn as models at once. (The models' reach is shorter than the Terrain Lab's:
// High has its normal tier's 150 m, Medium 100 m. Measured on a small graphics chip, standing at the edge of the
// thickest woods, the models were nearly all the trees' cost, each one's leaf cards drawn over each other: 300 of
// them added 24 ms to a frame where all 14,000 trees as pictures added 5.5 ms.)
export const TREE_QUALITY = {
  low: { meshAt: 0, band: 0, grid: 8, cell: 192, depth: false, reach: 1200, most: 0 },
  medium: { meshAt: 100, band: 80, grid: 12, cell: 192, depth: true, reach: 1700, most: 120 },
  high: { meshAt: 150, band: 100, grid: 14, cell: 192, depth: true, reach: 2000, most: 250 },
};
// the Terrain Lab's: the circle of models this share of meshAt ahead; each tree's own distance within half of spread
// either side; close by, a model whichever way you look; the leaves' normals bent half way up
const AHEAD = 0.6, SPREAD = 0.5, CLOSE = 40, SOFTEN = 0.5;

// ── a tree's model, loaded once a visit (like the plant sheet) ──────────────────────────────────────────────────
const models = new Map();
function loadTree(file) {
  if (models.has(file)) return models.get(file);
  const p = new GLTFLoader().loadAsync(new URL(`../../assets/planet/${file}.glb`, import.meta.url).href).then((g) => {
    const root = g.scene; root.updateMatrixWorld(true);
    // its foot: the lowest point of the trunk and branches (a leaf card can droop below it: the Terrain Lab's forest)
    const box = new THREE.Box3().setFromObject(root), part = new THREE.Box3(); let foot = Infinity;
    root.traverse((o) => { if (o.isMesh && !(o.material.alphaTest > 0 || o.material.transparent || /lea[fv]/i.test(o.material.name || ''))) foot = Math.min(foot, part.setFromObject(o).min.y); });
    const meshes = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material; m.side = THREE.DoubleSide; if (m.map) m.map.anisotropy = 4; if (m.transparent) { m.alphaTest = 0.5; m.transparent = false; }
      meshes.push({ geometry: o.geometry, material: m, local: o.matrixWorld.clone() });
    });
    return { root, meshes, tall: box.max.y - box.min.y, baseY: Number.isFinite(foot) ? Math.max(box.min.y, foot) : box.min.y };
  });
  models.set(file, p); p.catch(() => models.delete(file));
  return p;
}

// the models a kind of world has, fetched now (while its ground is being made: src/planet/planet.js makeLandAsync)
export function preloadTrees(kind) {
  if (kind && kind.cover.trees) for (const k of kind.cover.trees.kinds) loadTree(TREES[k.tree].file).catch(() => {});
}

// a change to the imposter's shader text, which must find what it changes exactly once (or it says so, loudly)
function swap(text, from, to, what) {
  const n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`trees: the far trees' shader changed (${what}: found ${n} times)`);
  return text.replace(from, () => to);
}
// THE FAR PICTURE made the planet's: the ground's copies of the tree round the camera, shrinking at the reach, the
// curve, the ground's light, the haze, the colours
function planetImposter(mat, { ground, sky, turn, reach }) {
  const U = ground.U, u = mat.uniforms;
  let v = mat.vertexShader, f = mat.fragmentShader;
  v = swap(v, 'attribute vec3 iPos;', 'attribute vec3 iPos0; uniform float uPw, uCurve, uReach; varying vec3 vPlanetP;', 'its place');
  v = swap(v, 'attribute float iScale;', 'attribute float iScale0;', 'its size');
  v = swap(v, 'attribute float iFade;', 'attribute float iFade0;', 'its fade');
  v = swap(v, 'void main() {', `void main() {
        // (the ground repeats, so each tree is drawn four times over: where its copy is nearest the camera, and the copy
        // past that on the other side of the camera across, along, and both: so it is drawn out to 2 km whichever way you
        // look. Which of the four this is: its number among them. Each shrinks to nothing at the reach.)
        int copy = gl_InstanceID - (gl_InstanceID / 4) * 4;
        vec2 near0 = cameraPosition.xz + mod(iPos0.xz - cameraPosition.xz + 0.5 * uPw, uPw) - 0.5 * uPw;
        vec2 other = near0 + vec2(near0.x < cameraPosition.x ? uPw : -uPw, near0.y < cameraPosition.z ? uPw : -uPw);
        vec3 iPos = vec3(copy == 1 || copy == 3 ? other.x : near0.x, iPos0.y, copy >= 2 ? other.y : near0.y);
        float iFade = copy == 0 ? iFade0 : 1.0;                            // (only the nearest is ever near enough to be a model)
        vec2 dFoot = iPos.xz - cameraPosition.xz;
        float iScale = iScale0 * (1.0 - smoothstep(uReach * 0.85, uReach, length(dFoot)));`, 'its main');
  v = swap(v, 'vec4 mv = viewMatrix * vec4(world, 1.0);', `vPlanetP = world;
        world.y -= dot(dFoot, dFoot) * uCurve;                              // the planet's curve, as the ground under it drops
        vec4 mv = viewMatrix * vec4(world, 1.0);`, 'its curve');
  f = 'varying vec3 vPlanetP; uniform float uHue, uSat, uLight;\n' + TURN_GLSL + '\n' + (sky ? SKY_GLSL + HAZE_GLSL + HAZE_SKY_GLSL : '') + f;
  // the ground's light where it stands: the sun (its long shadows) on the sun's light, the sky it sees on the sky's
  f = swap(f, 'float landSun = 1.0, landAll = 1.0;', 'float landSun = 1.0, landAll = 1.0, planetSky = texture2D(landShade, vLand / landShadeSize + 0.5).g;', 'its light');
  f = swap(f, 'irradiance += mix(hemisphereLights[0].groundColor', 'irradiance += planetSky * mix(hemisphereLights[0].groundColor', 'its sky light');
  f = swap(f, 'vec3 albedo = mix(col.rgb / max(col.a, 0.001) * vTint, calmCol, calm);', 'vec3 albedo = mix(planetTurn(col.rgb / max(col.a, 0.001), uHue, uSat, uLight) * vTint, calmCol, calm);', 'its colour');
  if (sky) f = swap(f, '#include <tonemapping_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, hazeSky(vPlanetP), hazeAmt(cameraPosition, vPlanetP));\n        #include <tonemapping_fragment>', 'its haze');
  mat.vertexShader = v; mat.fragmentShader = f;
  Object.assign(u, { uPw: U.uP, uCurve: U.uCurve, uReach: { value: reach }, uHue: { value: turn.hue }, uSat: { value: turn.sat }, uLight: { value: turn.light },
    uHaze: U.uHaze, uHazeH: U.uHazeH, uHazeBase: U.uHazeBase });
  if (sky) Object.assign(u, sky.uniforms);
  // the light picture as the Terrain Lab's "land shade": its sun in red, its sky in green (the sky taken above instead
  // of the Terrain Lab's darkening of the whole colour)
  u.landShade.value = U.uL.value; u.landShadeSize.value = U.uP.value; u.landShadeK.value.set(1, 0, 0, 1);
  mat.needsUpdate = true;
  return mat;
}

const switchHash = (x, z) => { const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return v - Math.floor(v); };   // (a tree's own 0..1 from where it stands: the Terrain Lab's)

export async function makeTrees({ renderer, land, look, ground, quality = 'medium', sky = null }) {
  const T0 = land.kind.cover.trees, count = land.trees.length / TREE_STRIDE;
  if (!T0 || !count) return null;
  const t0 = performance.now(), Q = TREE_QUALITY[quality] || TREE_QUALITY.medium, P = land.width, A = land.trees;
  const group = new THREE.Group(); group.name = 'planet:trees';
  const leaves = look.leaves || [{ hue: 300, sat: 1.3, light: 1 }];
  const sunDir = new THREE.Vector3(...look.sun).normalize(), el = Math.asin(sunDir.y) * 180 / Math.PI;
  // only the kinds this world has, each loaded once
  const used = T0.kinds.map((k, i) => i).filter((i) => { for (let n = 0; n < count; n++) if (A[n * TREE_STRIDE + 5] === i) return true; return false; });
  const loaded = await Promise.all(used.map((i) => loadTree(TREES[T0.kinds[i].tree].file)));
  const t1 = performance.now();
  const stats = { trees: count, models: 0, kinds: used.length, loadMs: Math.round(t1 - t0), bakeMs: 0, buildMs: 0 };
  const built = [], shades = [], Y = new THREE.Vector3(0, 1, 0);
  let canopy = [0, 0, 0], canopyW = 0;
  used.forEach((ki, n) => {
    const kind = T0.kinds[ki], M = loaded[n], turn = turnOf(leaves[kind.leaf] || leaves[0]);
    // the far picture: baked now, from the model as it is (its colours turned when drawn, as the model's are)
    const tb = performance.now(), it = bakeImposterSteps(renderer, M.root, { grid: Q.grid, cell: Q.cell, hemi: true, upNormals: true });
    let bake; for (;;) { const s = it.next(); if (s.done) { bake = s.value; break; } }
    stats.bakeMs += performance.now() - tb;
    // this kind's trees, with what each is drawn with: its foot, its size (metres a model's unit), turn, tint
    const list = [];
    for (let k = 0; k < count; k++) {
      const o = k * TREE_STRIDE; if (A[o + 5] !== ki) continue;
      const s = A[o + 3] / M.tall, x = A[o], z = A[o + 2];
      list.push({ x, y: A[o + 1] - M.baseY * s, z, s, yaw: A[o + 4], tint: 0.86 + 0.28 * switchHash(z * 0.37, x * 0.71), sw: switchHash(x, z) });
    }
    const geo = new THREE.InstancedBufferGeometry(), quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.setAttribute('uv', quad.attributes.uv);
    const iPos = new Float32Array(list.length * 3), iYaw = new Float32Array(list.length), iScale = new Float32Array(list.length), iTint = new Float32Array(list.length * 3), iFade = new Float32Array(list.length).fill(1);
    list.forEach((t, k) => { iPos.set([t.x, t.y, t.z], k * 3); iYaw[k] = t.yaw; iScale[k] = t.s; iTint.fill(t.tint, k * 3, k * 3 + 3); });
    // (four copies of each tree, one after another: each tree's own numbers shared by its four, `per` 4)
    const per = (a, n) => new THREE.InstancedBufferAttribute(a, n, false, 4);
    geo.setAttribute('iPos0', per(iPos, 3)); geo.setAttribute('iYaw', per(iYaw, 1)); geo.setAttribute('iScale0', per(iScale, 1)); geo.setAttribute('iTint', per(iTint, 3));
    const fade = per(iFade, 1); fade.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('iFade0', fade);
    geo.instanceCount = list.length * 4;
    const mat = planetImposter(imposterMaterial(bake, { sunDir, blend: true, depth: Q.depth, shadows: false, soften: SOFTEN, wind: 0, glow: 0, sheen: 1 }), { ground, sky, turn, reach: Q.reach });
    mat.uniforms.blendDist.value = 300;
    mat.uniforms.lowSun.value = 1 - THREE.MathUtils.smoothstep(el, 8, 30);    // (a low sun: the Terrain Lab's lean of the far trees' light)
    const imposter = new THREE.Mesh(geo, mat); imposter.frustumCulled = false; imposter.name = 'trees:' + kind.tree;
    group.add(imposter);
    // the near models: one instanced draw for each of the model's parts (trunk and branches, leaves)
    const meshes = [];
    if (Q.meshAt > 0 && Q.most > 0) for (const part of M.meshes) {
      const m2 = onGround(part.material.clone(), { ground, sky, reach: 1e7, fade: true, soften: SOFTEN, plant: { hue: { value: turn.hue }, sat: { value: turn.sat }, light: { value: turn.light }, sway: { value: 0 }, clock: { value: 0 } } });
      const g2 = part.geometry.clone(), mf = new THREE.InstancedBufferAttribute(new Float32Array(Q.most), 1); mf.setUsage(THREE.DynamicDrawUsage); g2.setAttribute('iFade', mf);
      const im = new THREE.InstancedMesh(g2, m2, Q.most); im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Q.most * 3), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
      im.userData = { local: part.local, fade: mf };
      group.add(im); meshes.push(im);
      // (its shadow on the ground, its leaves cut out of their picture: src/planet/groundshadow.js)
      if (ground.shadows) shades.push(ground.shadows.add(im, { map: m2.alphaTest > 0 && m2.map ? m2.map : null }));
    }
    built.push({ kind, list, imposter, fade, meshes, bake, near: [] });
    // the woods' colour from afar: the leaves' own (their picture's average) turned as the trees' are, by how many
    const leaf = planetTurn(TREES[kind.tree].leaf, turn.hue, turn.sat, turn.light);
    canopy = canopy.map((c, i) => c + leaf[i] * list.length); canopyW += list.length;
  });
  // the ground carries the woods on past the trees' reach, in their colour (darker: the crowns shade themselves)
  if (canopyW) { ground.U.uCanopy.value.setRGB(...canopy.map((c) => c / canopyW * 0.7)); ground.U.uTreeFar.value = Q.reach; }

  // ── which trees are models, as the camera moves (the Terrain Lab's forest's assign, on the repeating ground) ────
  let lastX = Infinity, lastZ = Infinity;
  const fwd = new THREE.Vector3(), M4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), col = new THREE.Color();
  function assign(camera) {
    const D = Q.meshAt, B = Q.band / 2; if (!(D > 0) || !built.some((b) => b.meshes.length)) return;
    camera.getWorldDirection(fwd); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    const eye = camera.position, cx = eye.x + fwd.x * D * AHEAD, cy = eye.y, cz = eye.z + fwd.z * D * AHEAD;
    if ((cx - lastX) ** 2 + (cz - lastZ) ** 2 < 4) return;
    lastX = cx; lastZ = cz;
    const S = SPREAD, C = Math.min(CLOSE, D * 0.25), nearK = C > 0 ? Math.max(1, (D * (1 - S / 2) - B) / C) : 0, reach = D * (1 + S / 2) + B;
    // the trees near enough to be models, of every kind together (the tier's most is for the whole wood, as the
    // Terrain Lab's is)
    const cand = [];
    built.forEach((b, bi) => {
      for (const k of b.near) b.fade.array[k] = 1;                        // last time's: whole pictures again
      b.near = [];
      const list = b.list;
      for (let k = 0; k < list.length; k++) {
        const t = list[k], dx = wrapD(t.x - cx, P), dz = wrapD(t.z - cz, P); if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
        const dy = t.y - cy, d0 = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d0 >= reach) continue;
        const Dk = D * (1 + S * (t.sw - 0.5)), rx = wrapD(t.x - eye.x, P), rz = wrapD(t.z - eye.z, P), ry = t.y - eye.y, dCam = Math.sqrt(rx * rx + ry * ry + rz * rz);
        const d = nearK > 0 ? Math.min(d0, dCam * nearK) : d0;
        if (d < Dk + B) cand.push([bi, k, d, Dk, dCam - 0.4 * (rx * fwd.x + rz * fwd.z), rx, rz]);
      }
    });
    const cap = Q.most;
    // nearest first: more than fit, the nearest win, those ahead over those behind; and drawn in that order, the near
    // ones hide what is behind them before it is coloured in
    cand.sort((p, q) => p[4] - q[4]);
    const n = Math.min(cap, cand.length), ease = Math.min(cap * 0.2, cand.length - cap), used = built.map(() => 0);
    for (let i = 0; i < n; i++) {
      const [bi, k, d, Dk, , rx, rz] = cand[i], b = built[bi], t = b.list[k], slot = used[bi]++;
      let f = B > 0 ? THREE.MathUtils.clamp((Dk + B - d) / (2 * B), 0, 1) : d < Dk ? 1 : 0;
      if (ease > 0) f = Math.min(f, (n - i) / (ease + 1));                 // (over the most: the last ones already eased into their pictures)
      b.fade.array[k] = 1 - f; b.near.push(k);
      // (the model where the picture is: the copy nearest the camera)
      q4.setFromAxisAngle(Y, t.yaw); s3.setScalar(t.s); p3.set(eye.x + rx, t.y, eye.z + rz); M4.compose(p3, q4, s3);
      col.setScalar(t.tint);
      for (const m of b.meshes) { m.setMatrixAt(slot, M4.clone().multiply(m.userData.local)); m.userData.fade.array[slot] = f; m.setColorAt(slot, col); }
    }
    built.forEach((b, bi) => {
      for (const m of b.meshes) { m.count = used[bi]; m.instanceMatrix.needsUpdate = true; m.userData.fade.needsUpdate = true; m.instanceColor.needsUpdate = true; }
      b.fade.needsUpdate = true;
    });
    stats.models = n;
  }
  stats.bakeMs = Math.round(stats.bakeMs);
  stats.buildMs = Math.round(performance.now() - t0);
  return {
    group, stats, built,
    update(camera) { assign(camera); },
    relayNow(camera) { lastX = lastZ = Infinity; assign(camera); },
    dispose() {
      for (const s of shades) s.dispose();
      for (const b of built) {
        b.imposter.geometry.dispose(); b.imposter.material.dispose(); b.imposter.material.userData.depthMaterial?.dispose();
        b.bake.targets.forEach((t) => t.dispose());
        for (const m of b.meshes) { m.geometry.dispose(); m.material.dispose(); m.dispose(); }
      }
      ground.U.uTreeFar.value = 1e9;
    },
  };
}
