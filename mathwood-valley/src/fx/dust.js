// DUST: a little puff of trail dust kicked up off the ground (a bandit knocked from the saddle landing, a shot going
// into the dirt behind one who ducked). A few soft round sprites that swell, drift and fade in about a second; the
// picture is made once and shared.
//
//   const D = makeDust(scene)
//   D.puff(at, { n, size, up })   at: { x, y, z } on the ground; n puffs (default 6), size (m, default 0.9), up: how
//                                 fast they rise (m/s)
//   D.update(dt)                  each frame (nothing to do once every puff has faded)
//   D.busy                        a puff is still showing
//   D.dispose()
import * as THREE from 'three';

let picture = null;
function dustPicture() {
  if (picture) return picture;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(214,190,150,0.9)'); g.addColorStop(0.5, 'rgba(190,164,124,0.45)'); g.addColorStop(1, 'rgba(170,146,110,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  picture = new THREE.CanvasTexture(cv); picture.colorSpace = THREE.SRGBColorSpace;
  return picture;
}

export const DUST = { life: 1.1, most: 12 };

export function makeDust(scene) {
  const puffs = [];
  const D = { get busy() { return puffs.some((p) => p.t < p.life); } };
  D.puff = (at, { n = 6, size = 0.9, up = 0.5 } = {}) => {
    for (let i = 0; i < n; i++) {
      let p = puffs.find((q) => q.t >= q.life);
      if (!p) {
        if (puffs.length >= DUST.most) break;
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustPicture(), depthWrite: false, transparent: true, opacity: 0 }));
        scene.add(s); p = { s, t: 0, life: 0, v: new THREE.Vector3(), size: 1 };
        puffs.push(p);
      }
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6, out = 0.6 + Math.random() * 0.8;
      p.s.position.set(at.x + Math.cos(a) * 0.15, at.y + 0.15 + Math.random() * 0.1, at.z + Math.sin(a) * 0.15);
      p.v.set(Math.cos(a) * out, up * (0.6 + Math.random() * 0.8), Math.sin(a) * out);
      p.t = -i * 0.02; p.life = DUST.life * (0.8 + Math.random() * 0.4); p.size = size * (0.7 + Math.random() * 0.6);
      p.s.visible = false;
    }
  };
  D.update = (dt) => {
    for (const p of puffs) {
      if (p.t >= p.life) continue;
      p.t += dt;
      if (p.t < 0) continue;
      const f = Math.min(1, p.t / p.life);
      p.s.visible = f < 1;
      p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-dt * 2.5));
      p.s.scale.setScalar(p.size * (0.35 + f * 0.9));
      p.s.material.opacity = 0.55 * (1 - f) * Math.min(1, p.t * 10);
    }
  };
  D.dispose = () => { for (const p of puffs) { p.s.removeFromParent(); p.s.material.dispose(); } puffs.length = 0; };
  return D;
}
