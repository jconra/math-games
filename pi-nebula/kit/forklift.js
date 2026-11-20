// HIS FORKLIFT (kit/places-plan.js FORKLIFT has the game's maker's words, where it parks and how big it stands): his
// own model, made in Tripo, drawn as he made it: one mesh, one material (his picture of its colours), 6,229 triangles,
// one draw. Nothing of the kit cuts or bakes it: it is a file fetched only when it is wanted (in the game the first
// time the player steps into the lift, as Cargo's people are made then: src/cargoforklift.js; in the Kit Lab when it is
// shown).
//   const F = await loadForklift()     the file, fetched once (a second call has the same answer)
//   const f = standForklift(F, { at, floor, yaw })
//       f.group   a copy of it (his geometry and material, shared by every copy) and the shade under it, standing with
//                 the middle of its foot at [at[0], floor, at[1]] (the station's frame), turned by yaw
//       f.solid   what stops a person (src/walls.js parts: the station's frame): his triangles where it stands, and a
//                 block knee high over its forks, which lie lower than a person's body is felt
//       f.light(env, k)   its shine: the room's own picture of itself, and how much
//       f.dispose()       the solid's geometries (the file's own are kept for the next copy)
//   F.facts   { tris, draws, texture [w, h], textureMB (on the graphics card, with its smaller copies), size [long,
//             tall, wide] (m, as it stands), scale }
// THE SHADE: the station draws no shadows (people.js puts a soft dark patch under each person). Under the forklift lies
// a patch the shape of its own foot: its triangles seen from straight above, the nearer the floor the darker, softened,
// so its wheels and its forks sit on the floor. Worked out once from his triangles when the file comes (a few ms), one
// more draw of two triangles.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FORKLIFT, forkliftScale, STORE } from './places-plan.js';

export const FORKLIFT_FILE = new URL('../assets/cargo/forklift.glb', import.meta.url).href;
// the shade: how far it spreads past the foot (m), its picture's pixels a metre, how high a part still darkens the
// floor (m), how dark it is at most, how soft (pixels, each of two passes)
const SHADE = { pad: 0.45, px: 40, reach: 1.1, dark: 0.72, soft: 4 };
// the block over the forks: how high (m; over the body's lowest felt height, src/walls.js BODY.heights)
const FORK_BLOCK = 0.75;

let fetched = null;
export function loadForklift() {
  if (fetched) return fetched;
  fetched = new GLTFLoader().loadAsync(FORKLIFT_FILE).then((g) => {
    const k = forkliftScale(), src = g.scene;
    src.scale.setScalar(k); src.updateMatrixWorld(true);
    // (its foot on y = 0, the middle of its foot at x = z = 0)
    const box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3());
    src.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const template = new THREE.Group(); template.name = 'forklift'; template.add(src); template.updateMatrixWorld(true);
    let mesh = null, tris = 0, draws = 0;
    src.traverse((o) => { if (o.isMesh) { mesh = mesh || o; draws++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
    const mat = mesh.material, img = mat.map && mat.map.image;
    const tw = img ? img.width : 0, th = img ? img.height : 0;
    // (his triangles in the template's frame, once: for the shade and for the solid)
    const local = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const facts = { tris: Math.round(tris), draws: draws + 1, texture: [tw, th], textureMB: +(tw * th * 4 * 4 / 3 / 1048576).toFixed(1), size: [+size.x.toFixed(3), +size.y.toFixed(3), +size.z.toFixed(3)], scale: +k.toFixed(4) };
    return { template, mesh, mat, local, shade: shadeOf(local, size), forks: forkBlock(src), facts };
  }).catch((e) => { fetched = null; throw e; });
  return fetched;
}

// the block over its forks, in the template's frame (his units turned into where they stand)
function forkBlock(src) {
  const [x0, x1, z0, z1] = FORKLIFT.forks, k = forkliftScale(), o = src.position;
  const g = new THREE.BoxGeometry((x1 - x0) * k, FORK_BLOCK, (z1 - z0) * k);
  g.translate(((x0 + x1) / 2) * k + o.x, FORK_BLOCK / 2, ((z0 + z1) / 2) * k + o.z);
  return g;
}

// the shade's picture: his triangles from above, darkest where nearest the floor, softened (black, its darkness in
// the alpha)
function shadeOf(geo, size) {
  const W = size.x + SHADE.pad * 2, D = size.z + SHADE.pad * 2, cw = Math.ceil(W * SHADE.px), ch = Math.ceil(D * SHADE.px);
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); g.globalCompositeOperation = 'darken';
  const p = geo.attributes.position.array, ix = geo.index ? geo.index.array : null, n = ix ? ix.length : p.length / 3;
  const X = (x) => (x + W / 2) * SHADE.px, Z = (z) => (z + D / 2) * SHADE.px;
  for (let t = 0; t < n; t += 3) {
    const a = (ix ? ix[t] : t) * 3, b = (ix ? ix[t + 1] : t + 1) * 3, c = (ix ? ix[t + 2] : t + 2) * 3;
    const low = Math.min(p[a + 1], p[b + 1], p[c + 1]); if (low > SHADE.reach) continue;
    const v = Math.round(255 * (1 - (1 - low / SHADE.reach) ** 1.5));
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath(); g.moveTo(X(p[a]), Z(p[a + 2])); g.lineTo(X(p[b]), Z(p[b + 2])); g.lineTo(X(p[c]), Z(p[c + 2])); g.closePath(); g.fill();
  }
  // softened: two passes of a box blur, across and down, on the darkness
  const im = g.getImageData(0, 0, cw, ch), d = im.data, a0 = new Float32Array(cw * ch), a1 = new Float32Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) a0[i] = 1 - d[i * 4] / 255;
  const R = SHADE.soft, blur = (src, dst, dx, dy, len, lines) => {
    for (let l = 0; l < lines; l++) {
      let acc = 0; const at = (i) => (dx ? l * cw + i : i * cw + l);
      for (let i = -R; i <= R; i++) acc += i >= 0 && i < len ? src[at(i)] : 0;
      for (let i = 0; i < len; i++) { dst[at(i)] = acc / (2 * R + 1); const o = i - R, e = i + R + 1; if (o >= 0) acc -= src[at(o)]; if (e < len) acc += src[at(e)]; }
    }
  };
  for (let pass = 0; pass < 2; pass++) { blur(a0, a1, 1, 0, cw, ch); blur(a1, a0, 0, 1, ch, cw); }
  for (let i = 0; i < cw * ch; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 0; d[i * 4 + 3] = Math.round(255 * Math.min(1, a0[i]) * SHADE.dark); }
  g.globalCompositeOperation = 'copy'; g.putImageData(im, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  const plane = new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  return { geo: plane, mat, tex };
}

export function standForklift(F, { at = FORKLIFT.at, floor = STORE.floor, yaw = FORKLIFT.yaw } = {}) {
  const group = new THREE.Group(); group.name = 'forklift';
  const copy = F.template.clone(); group.add(copy);
  const shade = new THREE.Mesh(F.shade.geo, F.shade.mat); shade.position.y = 0.012; shade.renderOrder = -1; shade.name = 'forklift:shade'; group.add(shade);
  group.position.set(at[0], floor, at[1]); group.rotation.set(0, yaw, 0); group.updateMatrixWorld(true);
  const M = new THREE.Matrix4().makeRotationY(yaw).setPosition(at[0], floor, at[1]);
  const solid = [F.local.clone().applyMatrix4(M), F.forks.clone().applyMatrix4(M)];
  return {
    group, solid,
    light(env, k = 1.25) { F.mat.envMap = env || null; F.mat.envMapIntensity = k; F.mat.needsUpdate = true; },
    dispose() { for (const g of solid) g.dispose(); },
  };
}
