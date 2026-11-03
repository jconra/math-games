// A SOFT DARK BLOB under small animals (the game's maker, 2026-10-31, of the chickens: "a soft dark blob that travels under
// them"): one flat instanced draw for a whole flock, a small soft-edged picture made here, on every tier (the sun's real shadow
// is far too dear for a bird, and potato has none). Each blob leans with the ground it's on.
//   const B = makeBlobs({ scene, most })   B.begin()   B.put(x, y, z, r, dx, dz)   B.end()   B.dispose()
//     put: at (x, y, z) on the ground, r metres across its middle to its edge; dx, dz: how much the ground rises a metre along x
//     and along z.   B.mesh, B.count (rigs)
import * as THREE from 'three';

export const BLOB = { dark: 0.42, lift: 0.035 };   // (how dark at its middle; m over the ground, so it doesn't fight the ground's own surface)
let shared = null;
function material() {
  if (shared) return shared;
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), f = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(0.45, 'rgba(0,0,0,0.8)'); f.addColorStop(0.75, 'rgba(0,0,0,0.3)'); f.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = f; g.fillRect(0, 0, S, S);
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map, color: 0xffffff, transparent: true, opacity: BLOB.dark, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  return (shared = { mat, geo });
}

export function makeBlobs({ scene, most = 16 }) {
  const { mat, geo } = material(), mesh = new THREE.InstancedMesh(geo, mat, most), M = new THREE.Matrix4(), e = M.elements;
  mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false; mesh.name = 'blob-shadows'; mesh.renderOrder = 1;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  let n = 0;
  return {
    mesh, get count() { return mesh.count; },
    begin() { n = 0; },
    put(x, y, z, r, dx = 0, dz = 0) {
      if (n >= most) return;
      // (a flat sheet leaned to the ground: across it along x and z, up by the ground's rise)
      e[0] = r; e[1] = r * dx; e[2] = 0; e[4] = 0; e[5] = 1; e[6] = 0; e[8] = 0; e[9] = r * dz; e[10] = r; e[12] = x; e[13] = y + BLOB.lift; e[14] = z;
      mesh.setMatrixAt(n++, M);
    },
    end() { mesh.count = n; mesh.visible = n > 0; mesh.instanceMatrix.needsUpdate = true; },
    dispose() { mesh.removeFromParent(); mesh.dispose(); },
  };
}
