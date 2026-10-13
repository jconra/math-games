// THE BOX CAMERA: a big, clunky camera of the 1880s, made in code: a varnished wooden box with brass corners, a
// leather bellows out to the front board and a brass lens, the black focusing cloth hanging over the back, on a
// wooden tripod; a flash-powder tray on a rod above it, which goes off with a white flash and a puff of smoke when a
// picture is taken. For the deer photographs job (src/missions/deerjob.js).
//
// Each material's pieces are merged into one shape, so the camera is a handful of draws; the three tripod legs are
// their own pieces so they can fold and spread. Real size: the tripod head stands 1.15 m up, the lens about 1.3 m.
//
//   const K = makeBoxCamera({ scene })
//   K.root          the whole camera on its tripod: put it on the ground (K.place), facing +Z as made
//   K.place(x, y, z, yaw)   stand it there (y: the ground's height), looking toward yaw (radians, as three's rotation.y)
//   K.spread(t)     the legs: 0 folded together, 1 spread and standing (the head stays put and the feet swing out, so
//                   it can be shown unfolding)
//   K.eye(v)        where an eye looks through the ground glass (behind the box), in the world
//   K.lens(v)       the front of the lens, in the world
//   K.flash()       the flash powder goes off: a white flash at the tray and a puff of smoke that rises and spreads
//   K.update(dt)    each frame (the smoke)
//   K.pack()        a folded copy (the box and the tripod's legs strapped together) to hang on a saddle; shares the
//                   shapes and materials
//   K.dispose()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const KIT = {
  head: 1.15,          // m: the tripod's head above the ground
  leg: 1.24,           // m: a leg's length
  splay: 0.34,         // radians a leg leans out when spread
  folded: 0.035,       // ... and when folded
  smoke: 2.6,          // s a puff of smoke lasts
  puffs: 7,            // smoke sprites in a puff
};

// the materials (shared by every camera made)
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const std = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  MATS = {
    wood: std('#b5743c', 0.42),          // the varnished box and the front board (a warm honey mahogany)
    pale: std('#a77a4c', 0.75),          // the tripod's legs and head (plain wood, less varnish)
    brass: std('#e2b85a', 0.35, 0.35),   // (mostly not metal to the light: with no reflections to show, a metal reads near black)
    leather: std('#5a3020', 0.8),        // the bellows
    cloth: std('#151311', 1),            // the focusing cloth
    iron: std('#34302c', 0.5, 0.6),      // the flash rod and tray
    glass: std('#0b1216', 0.08, 0.3),
  };
  return MATS;
}

// a box w x h x d centred at (x, y, z), optionally turned
function box(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z); return g;
}
// a round bar of radius r and length l along z, centred at (x, y, z)
function barZ(r, l, x, y, z, seg = 16) { const g = new THREE.CylinderGeometry(r, r, l, seg); g.rotateX(Math.PI / 2); g.translate(x, y, z); return g; }
function barY(r, l, x, y, z, seg = 8) { const g = new THREE.CylinderGeometry(r, r, l, seg); g.translate(x, y, z); return g; }

// the camera's head (everything above the tripod's legs), in metres, facing +Z, its base on y = 0 (the tripod's top)
let SHAPES = null;
function shapes() {
  if (SHAPES) return SHAPES;
  const by = { wood: [], pale: [], brass: [], leather: [], cloth: [], iron: [], glass: [] };
  // the tripod's head: a round wooden plate with a brass screw
  { const g = new THREE.CylinderGeometry(0.11, 0.12, 0.035, 18); g.translate(0, 0.0175, 0); by.pale.push(g); }
  by.brass.push(barY(0.025, 0.02, 0, 0.045, 0, 12));
  // the bed the bellows rides on, out to the front
  by.wood.push(box(0.2, 0.022, 0.42, 0, 0.046, 0.08));
  by.brass.push(box(0.012, 0.012, 0.4, -0.085, 0.062, 0.08), box(0.012, 0.012, 0.4, 0.085, 0.062, 0.08));
  // the back box (the ground glass is in its back)
  const bz = -0.08, bh = 0.25, by0 = 0.057;
  by.wood.push(box(0.26, bh, 0.15, 0, by0 + bh / 2, bz));
  // brass corners on the back box
  for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) by.brass.push(box(0.045, 0.045, 0.045, sx * 0.124, by0 + sy * bh + (sy ? -0.02 : 0.02), bz + sz * 0.066));
  // ... and on the front board's corners
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) by.brass.push(box(0.035, 0.035, 0.03, sx * 0.092, by0 + 0.115 + sy * 0.1, 0.26 + 0.014));
  // the bellows: leather folds narrowing toward the front board
  const folds = 6, z0 = bz + 0.075, z1 = 0.26;
  for (let i = 0; i < folds; i++) {
    const t = (i + 0.5) / folds, z = z0 + (z1 - z0) * t, s = 0.22 - 0.06 * t, w = (i % 2 ? 0.94 : 1) * s;
    by.leather.push(box(w, w, (z1 - z0) / folds * 1.02, 0, by0 + 0.125 - 0.02 * t, z));
  }
  // the front board and the lens: a brass barrel with a ring at the front, dark glass
  by.wood.push(box(0.2, 0.22, 0.025, 0, by0 + 0.115, z1 + 0.012));
  by.brass.push(barZ(0.048, 0.1, 0, by0 + 0.11, z1 + 0.075, 20), barZ(0.056, 0.018, 0, by0 + 0.11, z1 + 0.12, 20), barZ(0.04, 0.03, 0, by0 + 0.11, z1 + 0.035, 20));
  by.glass.push(barZ(0.042, 0.004, 0, by0 + 0.11, z1 + 0.13, 20));
  // the focusing cloth: folded back over the rear of the box's top and hanging a little way down behind it (kept
  // narrower than the box, so its varnished sides and brass corners show from the chase camera)
  by.cloth.push(box(0.2, 0.025, 0.12, 0, by0 + bh + 0.014, bz - 0.03));
  by.cloth.push(box(0.2, 0.15, 0.02, 0, by0 + bh - 0.06, bz - 0.095, -0.1));
  // the flash: an iron rod up from the side of the box, a long shallow tray on top, a brass trigger at its foot
  by.iron.push(barY(0.008, 0.42, -0.16, by0 + 0.2, bz, 8));
  by.iron.push(box(0.03, 0.02, 0.03, -0.145, by0 + 0.03, bz));
  by.iron.push(box(0.24, 0.012, 0.07, -0.16, by0 + 0.415, bz + 0.01));
  by.iron.push(box(0.24, 0.025, 0.006, -0.16, by0 + 0.425, bz + 0.045), box(0.24, 0.025, 0.006, -0.16, by0 + 0.425, bz - 0.025));
  by.brass.push(box(0.025, 0.04, 0.025, -0.16, by0 + 0.4, bz));
  SHAPES = {};
  for (const k of Object.keys(by)) SHAPES[k] = mergeGeometries(by[k], false);
  // a leg: a plain wooden bar from the head down (its top at y = 0), with a brass foot
  const leg = [box(0.04, KIT.leg, 0.026, 0, -KIT.leg / 2, 0)];
  SHAPES.leg = mergeGeometries(leg, false);
  SHAPES.tray = { x: -0.16, y: by0 + 0.44, z: bz + 0.01 };
  SHAPES.eye = { x: 0, y: by0 + 0.12, z: bz - 0.25 };
  SHAPES.lens = { x: 0, y: by0 + 0.11, z: z1 + 0.13 };
  return SHAPES;
}

// the smoke's soft round puff and the flash's glow (drawn once, shared)
let PUFF = null, GLOW = null;
function puffTex() {
  if (PUFF) return PUFF;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.45, 'rgba(240,238,232,0.6)'); g.addColorStop(1, 'rgba(230,228,222,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  PUFF = new THREE.CanvasTexture(c); PUFF.colorSpace = THREE.SRGBColorSpace; return PUFF;
}
function glowTex() {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,250,235,0.85)'); g.addColorStop(1, 'rgba(255,240,210,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  GLOW = new THREE.CanvasTexture(c); GLOW.colorSpace = THREE.SRGBColorSpace; return GLOW;
}

function headGroup(shadows) {
  const S = shapes(), M = mats(), g = new THREE.Group();
  for (const k of ['wood', 'pale', 'brass', 'leather', 'cloth', 'iron', 'glass']) {
    const m = new THREE.Mesh(S[k], M[k]); m.castShadow = shadows; m.receiveShadow = shadows; g.add(m);
  }
  return g;
}

export function makeBoxCamera({ scene }) {
  const S = shapes(), M = mats();
  const root = new THREE.Group(); root.name = 'box-camera';
  const head = headGroup(true); head.position.y = KIT.head; root.add(head);
  const legs = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group(); pivot.position.y = KIT.head; pivot.rotation.y = i * (Math.PI * 2 / 3) + Math.PI / 3;
    const m = new THREE.Mesh(S.leg, M.pale); m.castShadow = true; pivot.add(m);
    root.add(pivot); legs.push({ pivot, m });
  }
  scene.add(root);

  // the smoke and the flash's glow
  const smoke = [];
  for (let i = 0; i < KIT.puffs; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), transparent: true, depthWrite: false, opacity: 0, fog: true }));
    s.visible = false; s.renderOrder = 5; scene.add(s); smoke.push({ s, t: 9, vx: 0, vy: 0, vz: 0 });
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
  glow.visible = false; glow.renderOrder = 6; scene.add(glow);
  let glowT = 9;

  const K = { root, head, legs: legs.map((l) => l.m) };
  K.spread = (t) => {
    t = Math.max(0, Math.min(1, t));
    const a = KIT.folded + (KIT.splay - KIT.folded) * t;
    for (const l of legs) l.m.rotation.x = a;   // (each pivot is turned to its own side: leaning out on x swings the foot outward)
  };
  K.spread(1);
  K.place = (x, y, z, yaw) => { root.position.set(x, y, z); root.rotation.set(0, yaw, 0); root.updateMatrixWorld(true); };
  const _v = new THREE.Vector3();
  const at = (p, v) => head.localToWorld(v.set(p.x, p.y, p.z));
  K.eye = (v = new THREE.Vector3()) => at(S.eye, v);
  K.lens = (v = new THREE.Vector3()) => at(S.lens, v);
  K.tray = (v = new THREE.Vector3()) => at(S.tray, v);
  K.flash = () => {
    root.updateMatrixWorld(true);
    K.tray(_v);
    glow.position.copy(_v); glow.scale.setScalar(0.1); glow.visible = true; glowT = 0;
    smoke.forEach((p, i) => {
      p.t = -i * 0.04; p.s.position.copy(_v);
      const a = Math.random() * Math.PI * 2;
      p.vx = Math.cos(a) * 0.25; p.vz = Math.sin(a) * 0.25; p.vy = 0.45 + Math.random() * 0.35;
      p.s.visible = false; p.s.material.opacity = 0; p.s.material.rotation = Math.random() * 6;
    });
  };
  K.update = (dt) => {
    if (glowT < 1) {
      glowT += dt;
      const t = glowT / 0.35; glow.visible = t < 1;
      glow.scale.setScalar(0.3 + 2.4 * Math.min(1, t * 3)); glow.material.opacity = Math.max(0, 1 - t) ** 1.5;
    }
    for (const p of smoke) {
      if (p.t >= KIT.smoke) continue;
      p.t += dt; if (p.t < 0) continue;
      const k = p.t / KIT.smoke;
      p.s.visible = k < 1;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt * (1 - k * 0.6); p.s.position.z += p.vz * dt;
      p.s.scale.setScalar(0.18 + 0.9 * Math.sqrt(k));
      p.s.material.opacity = 0.85 * Math.min(1, p.t * 8) * (1 - k) ** 1.4;
    }
  };
  K.busy = () => glowT < 1 || smoke.some((p) => p.t < KIT.smoke);
  // a folded copy to strap behind a saddle: the box on its side and the legs bundled under it
  const straps = [];   // (each copy's own strap shape: freed with the camera)
  K.pack = () => {
    const g = new THREE.Group(); g.name = 'box-camera-pack';
    const h = headGroup(true); h.scale.setScalar(0.85); h.rotation.set(0, Math.PI / 2, 0); g.add(h);
    // (the legs bundled down the horse's left flank like a rifle in its scabbard: from beside the saddle back and down)
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(S.leg, M.pale); m.castShadow = true;
      m.rotation.set(1.2, 0, 0); m.position.set(0.36 + (i % 2) * 0.03, -0.02 - i * 0.025, 0.5);
      g.add(m);
    }
    // a strap round the bundle
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16), M.leather); straps.push(strap.geometry);
    strap.position.set(0.375, -0.24, -0.06); strap.rotation.set(1.2 - Math.PI / 2, 0, 0); g.add(strap);
    return g;
  };
  K.dispose = () => {
    root.removeFromParent(); glow.removeFromParent(); glow.material.dispose();
    for (const p of smoke) { p.s.removeFromParent(); p.s.material.dispose(); }
    for (const g of straps) g.dispose(); straps.length = 0;
  };
  return K;
}
