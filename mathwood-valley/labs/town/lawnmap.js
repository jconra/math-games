// THE TOWN LAB'S LAWN TINT: a faint green over the ground wherever lawn grass is painted, to be seen from any height and on any
// tier (the lawn's own tufts are drawn only near the camera, and never on potato). The strokes drawn in order on a picture, as
// they'd plant: a lawn stroke paints, a later clear rubs out (not a fence's or a rock's, which take away only their own), and
// the picture laid over the ground on a sheet that follows the land. Lab only: nothing here is in the game.
//   makeLawnMap({ THREE, scene, heightAt, PLANT }) -> { mesh, update(strokes, live), painted(x, z) (rigs) }
//   update: the sheet made again from the planting's strokes (live: the stroke being painted, not in the list yet)
import { plantSorts } from '../../world/objects/plantviews.js';

const PER_M = 2, STEP = 3, LIFT = 0.3, TINT = '#7fe05a', OPACITY = 0.3, MOST = 2048;
export function makeLawnMap({ THREE, scene, heightAt, PLANT }) {
  const SORT = plantSorts(PLANT), cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: OPACITY, depthWrite: false, fog: false, toneMapped: false }));
  mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 20; scene.add(mesh);
  let box = null, k = PER_M;
  const line = (s) => { const P = s.pts; g.lineWidth = s.r * 2 * k; g.beginPath(); g.moveTo((P[0][0] - box.x0) * k, (P[0][1] - box.z0) * k); if (P.length < 2) g.lineTo((P[0][0] - box.x0) * k + 0.01, (P[0][1] - box.z0) * k); for (let i = 1; i < P.length; i++) g.lineTo((P[i][0] - box.x0) * k, (P[i][1] - box.z0) * k); g.stroke(); };
  function update(strokes, live = null) {
    const list = live ? [...strokes, live] : strokes, lawn = list.filter((s) => s.mode !== 'clear' && s.kind === PLANT.LAWN_KIND);
    if (!lawn.length) { mesh.visible = false; box = null; return; }
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const s of lawn) for (const p of s.pts) { x0 = Math.min(x0, p[0] - s.r); x1 = Math.max(x1, p[0] + s.r); z0 = Math.min(z0, p[1] - s.r); z1 = Math.max(z1, p[1] + s.r); }
    x0 -= 2; z0 -= 2; x1 += 2; z1 += 2;
    const w = x1 - x0, d = z1 - z0; k = Math.min(PER_M, MOST / Math.max(w, d));
    const same = box && box.x0 === x0 && box.z0 === z0 && box.x1 === x1 && box.z1 === z1;
    box = { x0, z0, x1, z1 };
    if (cv.width !== Math.ceil(w * k) || cv.height !== Math.ceil(d * k)) { cv.width = Math.ceil(w * k); cv.height = Math.ceil(d * k); tex.dispose(); }
    g.clearRect(0, 0, cv.width, cv.height); g.lineCap = g.lineJoin = 'round'; g.strokeStyle = TINT;
    for (const s of list) {
      if (s.mode === 'clear') { if (SORT.fence(s.kind) || SORT.rock(s.kind)) continue; g.globalCompositeOperation = 'destination-out'; line(s); }
      else if (s.kind === PLANT.LAWN_KIND) { g.globalCompositeOperation = 'source-over'; line(s); }
    }
    g.globalCompositeOperation = 'source-over'; tex.needsUpdate = true;
    if (!same) {   // (the sheet, following the land)
      const nx = Math.max(1, Math.ceil(w / STEP)), nz = Math.max(1, Math.ceil(d / STEP)), pos = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2), idx = [];
      for (let j = 0, o = 0; j <= nz; j++) for (let i = 0; i <= nx; i++, o++) { const x = x0 + w * i / nx, z = z0 + d * j / nz; pos.set([x, heightAt(x, z) + LIFT, z], o * 3); uv.set([i / nx, 1 - j / nz], o * 2); }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, e = c + 1; idx.push(a, c, b, b, c, e); }
      mesh.geometry.dispose(); mesh.geometry = new THREE.BufferGeometry();
      mesh.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); mesh.geometry.setIndex(idx);
    }
    mesh.visible = true;
  }
  // (rigs: is the tint on at this spot?)
  const painted = (x, z) => { if (!box || !mesh.visible || x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) return false; return g.getImageData(Math.floor((x - box.x0) * k), Math.floor((z - box.z0) * k), 1, 1).data[3] > 128; };
  return { mesh, update, painted };
}
