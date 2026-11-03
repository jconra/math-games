// THE AIR: a few hundred faint specks drifting in a box round the viewer (the box moves with the view, and a speck
// that falls out of one side comes back in the other), so a room never looks vacuum-clean. One draw.
import * as THREE from 'three';

export function makeDust(count = 360, size = 7) {
  const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) { pos[i * 3 + k] = (Math.random() - 0.5) * size; vel[i * 3 + k] = (Math.random() - 0.5) * 0.04; }
    vel[i * 3 + 1] -= 0.01;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // (a soft round speck, not a hard square pixel)
  const c = document.createElement('canvas'); c.width = c.height = 32; const cg = c.getContext('2d'), gr = cg.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cg.fillStyle = gr; cg.fillRect(0, 0, 32, 32);
  const m = new THREE.PointsMaterial({ color: 0xfff1d8, map: new THREE.CanvasTexture(c), size: 0.022, sizeAttenuation: true, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.name = 'dust';
  const centre = new THREE.Vector3();
  // keep the specks round `eye`, inside the room's height (y0..y1)
  pts.userData.update = (dt, eye, y0 = 0.05, y1 = 2.95) => {
    centre.copy(eye); const h = size / 2;
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 3; k++) {
        let v = pos[i * 3 + k] + vel[i * 3 + k] * dt; const c = k === 0 ? centre.x : k === 1 ? centre.y : centre.z;
        if (v < c - h) v += size; else if (v > c + h) v -= size;
        pos[i * 3 + k] = v;
      }
      if (pos[i * 3 + 1] < y0) pos[i * 3 + 1] = y1; else if (pos[i * 3 + 1] > y1) pos[i * 3 + 1] = y0;
      // (a speck right in front of the eye would be a big blur: send it to the far side of the box)
      const dx = pos[i * 3] - centre.x, dy = pos[i * 3 + 1] - centre.y, dz = pos[i * 3 + 2] - centre.z;
      if (dx * dx + dy * dy + dz * dz < 0.8) { pos[i * 3] = centre.x - Math.sign(dx || 1) * h * 0.9; pos[i * 3 + 2] = centre.z - Math.sign(dz || 1) * h * 0.9; }
    }
    g.attributes.position.needsUpdate = true;
  };
  return pts;
}
