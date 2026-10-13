// THE PIECES MADE IN CODE for the cabin: the ones no free model fitted (a braided rug, the hanging lanterns, dog beds, a
// rifle rack, a cast-iron stove) and the belt-buckle keepsakes (steer horns, a cracked safe door, a sheep bell, a carved
// pig, wanted posters, a freight sign). Plain shapes with a few pictures drawn on canvases, so they cost nothing to
// download. Each stands on y = 0 (or hangs from its own middle, for a wall piece), its front facing +z, real size.
//
//   makePiece(kind, opts) -> THREE.Group, with .tick(dt, t) when it moves or flickers, .lights (its PointLights)
//   makeKeepsake(job, tier) -> THREE.Group      tier: 'tin' | 'copper' | 'silver' | 'gold' (a later buckle dresses it up)
//   disposeTree(object)     frees the shapes, materials and pictures of a group made here (or any group)
import * as THREE from 'three';

const TIER_COL = { tin: 0xa9aba6, copper: 0xb8713f, silver: 0xd5d7dc, gold: 0xd9a830 };
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
function canvasTex(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };

// a soft round glow (bright in the middle, fading to nothing), for a flame
let glowTex = null;
function glowPicture() {
  if (glowTex) return glowTex;
  glowTex = canvasTex(64, 64, (x) => {
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  });
  glowTex.shared = true;   // (kept for every lantern and stove; freed with the cabin: see disposeShared)
  return glowTex;
}
export function disposeShared() { if (glowTex) { glowTex.dispose(); glowTex = null; } }

// a tube that narrows from r0 to r1 along a curve (a horn)
function taperTube(curve, r0, r1, seg = 16, rad = 8) {
  const pos = [], idx = [], fr = curve.computeFrenetFrames(seg, false), p = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, r = r0 + (r1 - r0) * t; curve.getPointAt(t, p);
    for (let j = 0; j <= rad; j++) { const a = j / rad * Math.PI * 2; v.copy(fr.normals[i]).multiplyScalar(Math.cos(a) * r).addScaledVector(fr.binormals[i], Math.sin(a) * r).add(p); pos.push(v.x, v.y, v.z); }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ── THE FURNISHINGS ──────────────────────────────────────────────────────────────────────────────────────────────
const MAKERS = {
  // a braided oval rag rug: rings of faded reds, blues and creams (the edge cut round: alphaTest)
  rug({ size = [2.1, 1.4] } = {}) {
    const tex = canvasTex(512, 342, (x, w, h) => {
      // a braid is three strands of rag twisted together, coiled round and round: each ring a run of one or two
      // colours, the colours changing every few rings as the rags ran out (muted, washed-out home dyes)
      const cols = ['#7d4a3c', '#b9a682', '#53627a', '#9a6a45', '#cdbf9f', '#6e3d34', '#677255', '#a48d6c', '#8a7a62'];
      let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const R = 34; let run = [cols[0], cols[1]];
      for (let k = 0; k < R; k++) {
        if (k % 3 === 0) run = [cols[Math.floor(rnd() * cols.length)], cols[Math.floor(rnd() * cols.length)]];
        const f = 1 - k / R, rx = w / 2 * f, ry = h / 2 * f; if (rx < 4) break;
        x.fillStyle = run[k % 2]; x.beginPath(); x.ellipse(w / 2, h / 2, rx, ry, 0, 0, Math.PI * 2); x.fill();
        // the strands: little slanted stitches round each ring, light and dark
        const step = 0.1 / Math.max(0.12, f);
        for (let a = 0; a < Math.PI * 2; a += step) {
          const px = w / 2 + Math.cos(a) * rx * 0.985, py = h / 2 + Math.sin(a) * ry * 0.985, d = (k % 2 ? 1 : -1) * 0.9;
          x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(px, py); x.lineTo(px - Math.cos(a + d) * 4.5, py - Math.sin(a + d) * 4.5); x.stroke();
          x.strokeStyle = 'rgba(255,240,210,0.12)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px + 1.5, py); x.lineTo(px + 1.5 - Math.cos(a + d) * 3.5, py - Math.sin(a + d) * 3.5); x.stroke();
        }
      }
    });
    const g = new THREE.PlaneGeometry(size[0], size[1]); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, std(0xffffff, { map: tex, roughness: 1, alphaTest: 0.5, transparent: false }));
    m.position.y = 0.012; m.receiveShadow = true;
    const grp = new THREE.Group(); grp.add(m); return grp;
  },
  // two hanging oil lanterns with a warm light each (as the walk-in test's): where SLOT.lanterns.looks says
  lanterns({ at = [[-0.69, 2.84, -1.75], [1.44, 2.84, -1.0]], power = 3.2 } = {}) {
    const grp = new THREE.Group(); grp.lights = []; const flames = [];
    const metal = std(0x2a2520, { roughness: 0.6, metalness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x3a2814, emissive: 0xff8a30, emissiveIntensity: 0.25, roughness: 0.15, transparent: true, opacity: 0.45, depthWrite: false });
    const flameM = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
    const glowM = new THREE.SpriteMaterial({ map: glowPicture(), color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 });
    const G = { body: new THREE.CylinderGeometry(0.055, 0.065, 0.16, 12), flame: new THREE.SphereGeometry(1, 10, 8), bar: new THREE.BoxGeometry(0.008, 0.18, 0.008),
      cap: new THREE.ConeGeometry(0.085, 0.07, 12), base: new THREE.CylinderGeometry(0.075, 0.075, 0.025, 12), cord: new THREE.CylinderGeometry(0.005, 0.005, 0.2, 4) };
    for (const p of at) {
      const lamp = new THREE.PointLight(0xffc488, power, 9, 1.4); lamp.position.set(p[0], p[1], p[2]); grp.add(lamp); grp.lights.push(lamp);
      const g = new THREE.Group(); g.position.set(p[0], p[1], p[2]);
      const flame = new THREE.Mesh(G.flame, flameM); flame.scale.set(0.014, 0.032, 0.014); flame.position.y = -0.02; g.add(flame); flames.push(flame);
      const glow = new THREE.Sprite(glowM); glow.scale.set(0.42, 0.42, 1); glow.position.y = -0.02; g.add(glow);
      for (let k = 0; k < 4; k++) { const bar = new THREE.Mesh(G.bar, metal); bar.position.set(Math.cos(k * Math.PI / 2 + 0.4) * 0.07, 0, Math.sin(k * Math.PI / 2 + 0.4) * 0.07); g.add(bar); }
      const cap = new THREE.Mesh(G.cap, metal); cap.position.y = 0.125;
      const base = new THREE.Mesh(G.base, metal); base.position.y = -0.095;
      const cord = new THREE.Mesh(G.cord, metal); cord.position.y = 0.26;
      g.add(new THREE.Mesh(G.body, glass), cap, base, cord); grp.add(g);
    }
    // a gentle flicker (each lamp its own)
    grp.tick = (dt, t) => grp.lights.forEach((l, i) => { const f = 1 + 0.05 * Math.sin(t * 7.3 + i * 2) + 0.03 * Math.sin(t * 17.1 + i); l.intensity = power * f; flames[i].scale.y = 0.032 * f; });
    return grp;
  },
  // a round dog bed: a stuffed rim round a soft cushion, in a faded red and cream check
  dogbed({ r = 0.34, tint = '#8e3b30' } = {}) {
    const tex = canvasTex(64, 64, (x, w) => {
      x.fillStyle = '#d9cbb0'; x.fillRect(0, 0, w, w); x.fillStyle = tint; x.globalAlpha = 0.75;
      for (let k = 0; k < 4; k++) { x.fillRect(k * 16, 0, 8, w); x.fillRect(0, k * 16, w, 8); }
    }, { repeat: [4, 1] });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 10, 28), std(0xffffff, { map: tex, roughness: 1 }));
    rim.rotation.x = -Math.PI / 2; rim.position.y = 0.09; rim.castShadow = rim.receiveShadow = true;
    const pad = mesh(new THREE.CylinderGeometry(r, r * 0.97, 0.08, 28), std(0xb9a98c, { roughness: 1 }), 0, 0.045, 0);
    const grp = new THREE.Group(); grp.add(rim, pad); return grp;
  },
  // a rack on the wall: a board, three pegs high and three low, two rifles across them (wood stocks, dark steel)
  rifles() {
    const grp = new THREE.Group(), wood = std(0x6b4527, { roughness: 0.7 }), dark = std(0x3b2414, { roughness: 0.6 }), steel = std(0x30302e, { roughness: 0.45, metalness: 0.7 });
    grp.add(mesh(new THREE.BoxGeometry(1.3, 0.12, 0.03), dark, 0, 0.32, 0.015), mesh(new THREE.BoxGeometry(1.3, 0.12, 0.03), dark, 0, -0.18, 0.015));
    for (const px of [-0.5, 0, 0.5]) for (const py of [0.3, -0.2]) grp.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8).rotateX(Math.PI / 2), wood, px, py - 0.04, 0.07));
    for (const [y, flip] of [[0.235, 1], [-0.265, -1]]) {
      const r = new THREE.Group(); r.position.set(0, y, 0.085); r.scale.x = flip;
      const stock = new THREE.Shape(); stock.moveTo(-0.62, -0.06); stock.lineTo(-0.62, 0.035); stock.lineTo(-0.3, 0.02); stock.lineTo(-0.2, 0.02); stock.lineTo(-0.2, -0.02); stock.lineTo(-0.36, -0.03); stock.lineTo(-0.5, -0.07); stock.lineTo(-0.62, -0.06);
      r.add(mesh(new THREE.ExtrudeGeometry(stock, { depth: 0.035, bevelEnabled: false }).translate(0, 0, -0.0175), wood));
      r.add(mesh(new THREE.BoxGeometry(0.2, 0.05, 0.04), steel, -0.1, 0.005, 0));          // the action
      r.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.68, 8).rotateZ(Math.PI / 2), steel, 0.34, 0.015, 0));   // the barrel
      r.add(mesh(new THREE.BoxGeometry(0.42, 0.035, 0.034), wood, 0.2, -0.012, 0));        // the fore-end
      r.add(mesh(new THREE.TorusGeometry(0.035, 0.007, 6, 12, Math.PI), steel, -0.16, -0.035, 0).rotateZ(Math.PI));   // the lever loop
      grp.add(r);
    }
    return grp;
  },
  // a cast-iron box stove on four legs, a fire glowing through its grate, a kettle on top, the pipe up through the roof
  stove({ power = 2.2 } = {}) {
    const grp = new THREE.Group(); grp.lights = [];
    const iron = std(0x232120, { roughness: 0.55, metalness: 0.55 }), trim = std(0x3a3532, { roughness: 0.45, metalness: 0.7 });
    for (const [x, z] of [[-0.24, -0.18], [0.24, -0.18], [-0.24, 0.18], [0.24, 0.18]]) grp.add(mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.16, 8), iron, x, 0.08, z));
    grp.add(mesh(new THREE.BoxGeometry(0.6, 0.5, 0.46), iron, 0, 0.41, 0));
    grp.add(mesh(new THREE.BoxGeometry(0.66, 0.035, 0.52), trim, 0, 0.675, 0), mesh(new THREE.BoxGeometry(0.64, 0.03, 0.5), trim, 0, 0.17, 0));
    // the door's grate: bars over a glowing fire (the fire unlit, so it glows in the dark)
    const fire = new THREE.MeshBasicMaterial({ color: 0xff7a24 }); fire.userData.glow = true;
    const fireM = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), fire); fireM.position.set(0, 0.41, 0.232); grp.add(fireM);
    for (let k = -2; k <= 2; k++) grp.add(mesh(new THREE.BoxGeometry(0.018, 0.22, 0.02), trim, k * 0.065, 0.41, 0.24));
    grp.add(mesh(new THREE.BoxGeometry(0.36, 0.025, 0.025), trim, 0, 0.52, 0.24), mesh(new THREE.BoxGeometry(0.36, 0.025, 0.025), trim, 0, 0.3, 0.24));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowPicture(), color: 0xff7a30, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
    glow.scale.set(0.7, 0.5, 1); glow.position.set(0, 0.41, 0.3); grp.add(glow);
    // the kettle, and the pipe (out the back of the top, a bend, then straight up past the roof)
    grp.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.13, 14), trim, 0.13, 0.76, 0.05), mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6).rotateZ(1.0), trim, 0.22, 0.79, 0.05));
    grp.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 4.6, 14), iron, -0.12, 0.69 + 2.3, -0.1));
    const light = new THREE.PointLight(0xff8a3c, power, 6, 1.6); light.position.set(0, 0.45, 0.45); grp.add(light); grp.lights.push(light);
    grp.tick = (dt, t) => { const f = 1 + 0.12 * Math.sin(t * 9.1) + 0.07 * Math.sin(t * 23.7) + 0.05 * Math.sin(t * 3.3); light.intensity = power * f; glow.material.opacity = 0.5 + 0.1 * f; fire.color.setRGB(1, 0.42 + 0.06 * f, 0.13); };
    return grp;
  },
};
export function makePiece(kind, opts) { const f = MAKERS[kind]; if (!f) throw new Error('no such piece: ' + kind); const g = f(opts); g.name = kind; return g; }

// ── THE KEEPSAKES (one per job, from its first belt buckle; the buckle's metal shows on each one) ─────────────────────
const KEEP = {
  // a longhorn's horns on a wooden plaque, with a little metal plate in the buckle's metal
  cattle(tier) {
    const grp = new THREE.Group(), wood = std(0x5a3a22, { roughness: 0.7 }), horn = std(0xd8c7a3, { roughness: 0.45 }), tip = std(0x3a3128, { roughness: 0.4 });
    const plaque = new THREE.Shape(); plaque.moveTo(-0.22, -0.18); plaque.quadraticCurveTo(-0.3, 0, -0.2, 0.2); plaque.lineTo(0.2, 0.2); plaque.quadraticCurveTo(0.3, 0, 0.22, -0.18); plaque.quadraticCurveTo(0, -0.28, -0.22, -0.18);
    grp.add(mesh(new THREE.ExtrudeGeometry(plaque, { depth: 0.04, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 }), wood, 0, 0, 0));
    grp.add(mesh(new THREE.SphereGeometry(0.11, 14, 10).scale(1.15, 0.8, 0.7), std(0xcab48a, { roughness: 0.6 }), 0, 0.03, 0.08));
    for (const s of [-1, 1]) {
      const c = new THREE.CubicBezierCurve3(new THREE.Vector3(0.08 * s, 0.05, 0.1), new THREE.Vector3(0.45 * s, 0.02, 0.16), new THREE.Vector3(0.7 * s, 0.12, 0.12), new THREE.Vector3(0.85 * s, 0.3, 0.08));
      grp.add(mesh(taperTube(c, 0.05, 0.012, 20, 10), horn));
      const end = c.getPoint(1); grp.add(mesh(new THREE.SphereGeometry(0.013, 8, 6), tip, end.x, end.y, end.z));
    }
    grp.add(mesh(new THREE.BoxGeometry(0.16, 0.045, 0.01), std(TIER_COL[tier] || TIER_COL.tin, { metalness: 0.8, roughness: 0.3 }), 0, -0.15, 0.055));
    return grp;
  },
  // a safe's heavy door, blown off its hinges: dented, a crack across it, the dial still on, leaning on the wall
  boxes(tier) {
    const grp = new THREE.Group(), iron = std(0x2d3b33, { roughness: 0.5, metalness: 0.5 }), brass = std(TIER_COL[tier] || TIER_COL.tin, { metalness: 0.85, roughness: 0.3 });
    const tex = canvasTex(256, 320, (x, w, h) => {
      x.fillStyle = '#2d3b33'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#c9a54a'; x.lineWidth = 6; x.strokeRect(18, 18, w - 36, h - 36);
      x.fillStyle = '#c9a54a'; x.font = 'bold 30px Georgia, serif'; x.textAlign = 'center'; x.fillText('SAFE CO.', w / 2, 70);
      x.strokeStyle = '#0c0f0d'; x.lineWidth = 5; x.beginPath(); x.moveTo(30, 200); x.lineTo(80, 180); x.lineTo(110, 215); x.lineTo(160, 190); x.lineTo(190, 230); x.lineTo(230, 210); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,0.15)'; x.lineWidth = 2; x.beginPath(); x.moveTo(30, 203); x.lineTo(80, 183); x.lineTo(110, 218); x.lineTo(160, 193); x.lineTo(190, 233); x.stroke();
    });
    const face = [iron, iron, iron, iron, std(0xffffff, { map: tex, roughness: 0.5, metalness: 0.4 }), iron];
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.09), face); door.castShadow = door.receiveShadow = true; door.position.y = 0.31; grp.add(door);
    grp.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 20).rotateX(Math.PI / 2), brass, 0, 0.36, 0.055));
    grp.add(mesh(new THREE.BoxGeometry(0.12, 0.02, 0.03), brass, 0, 0.22, 0.06));
    for (const y of [0.12, 0.5]) grp.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 8), iron, -0.27, y, 0));
    return grp;
  },
  // a sheep's bell on a leather strap
  sheep(tier) {
    const grp = new THREE.Group(), pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.035 + 0.045 * t * t, -0.11 * t)); }
    grp.add(mesh(new THREE.LatheGeometry(pts, 16), std(TIER_COL[tier] || TIER_COL.tin, { metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide }), 0, 0, 0.06));
    grp.add(mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 16, Math.PI), std(0x4a2e1b), 0, 0.02, 0.06));
    grp.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), std(0x3a3632, { metalness: 0.6 }), 0, -0.11, 0.06));
    grp.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6).rotateX(Math.PI / 2), std(0x6b4527), 0, 0.06, 0.03));
    return grp;
  },
  // a carved wooden pig on a little shelf
  pigs(tier) {
    const grp = new THREE.Group(), wood = std(0xb58a5a, { roughness: 0.6 }), dark = std(0x5a3a22);
    grp.add(mesh(new THREE.BoxGeometry(0.4, 0.03, 0.18), dark, 0, 0, 0.09));
    const pig = new THREE.Group(); pig.position.set(0, 0.015, 0.1);
    pig.add(mesh(new THREE.SphereGeometry(0.06, 14, 10).scale(1.4, 1, 1), wood, 0, 0.075, 0));
    pig.add(mesh(new THREE.SphereGeometry(0.04, 12, 8), wood, 0.08, 0.09, 0), mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.025, 10).rotateZ(Math.PI / 2), wood, 0.125, 0.085, 0));
    for (const z of [-0.025, 0.025]) pig.add(mesh(new THREE.ConeGeometry(0.014, 0.03, 6), wood, 0.075, 0.13, z));
    for (const [x, z] of [[-0.05, -0.03], [0.05, -0.03], [-0.05, 0.03], [0.05, 0.03]]) pig.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.03, 6), wood, x, 0.015, z));
    pig.add(mesh(new THREE.BoxGeometry(0.06, 0.004, 0.02), std(TIER_COL[tier] || TIER_COL.tin, { metalness: 0.8, roughness: 0.3 }), 0, 0.003, 0.07));
    pig.rotation.y = -0.4; grp.add(pig);
    return grp;
  },
  // wanted posters pinned to the wall: one for the tin buckle, one more for each buckle after it
  bandits(tier) {
    const n = Math.max(1, ['tin', 'copper', 'silver', 'gold'].indexOf(tier) + 1), grp = new THREE.Group();
    const names = ['BLACK BART', 'DUTCH KELLY', 'SNAKE-EYE JO', 'THE KID'];
    for (let i = 0; i < n; i++) {
      const tex = canvasTex(160, 220, (x, w, h) => {
        x.fillStyle = '#d9c79a'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a1d12'; x.textAlign = 'center';
        x.font = 'bold 30px Georgia, serif'; x.fillText('WANTED', w / 2, 36);
        x.fillStyle = '#4a3a2a'; x.beginPath(); x.arc(w / 2, 92, 30, 0, Math.PI * 2); x.fill(); x.fillRect(w / 2 - 42, 120, 84, 40);
        x.fillStyle = '#2a1d12'; x.fillRect(w / 2 - 44, 70, 88, 8); x.fillRect(w / 2 - 28, 54, 56, 18);   // (the hat)
        x.font = 'bold 15px Georgia, serif'; x.fillText(names[i], w / 2, 182); x.font = '13px Georgia, serif'; x.fillText('CAUGHT', w / 2, 204);
        x.strokeStyle = 'rgba(120,20,10,0.8)'; x.lineWidth = 5; x.beginPath(); x.moveTo(20, 60); x.lineTo(w - 20, 160); x.moveTo(w - 20, 60); x.lineTo(20, 160); x.stroke();
      });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.44), std(0xffffff, { map: tex, roughness: 1 })); p.receiveShadow = true;
      p.position.set((i % 2 ? 0.2 : -0.2), i > 1 ? -0.48 : 0, 0.01 + i * 0.002); p.rotation.z = (i % 2 ? -0.04 : 0.05); grp.add(p);
    }
    return grp;
  },
  // a brass counter bell on a little wooden base (raise: stood on an upturned crate this high, till there's a table)
  orders(tier, { raise = 0 } = {}) {
    const grp = new THREE.Group(), brass = std(TIER_COL[tier] === TIER_COL.tin ? 0xc9a24a : TIER_COL[tier], { metalness: 0.85, roughness: 0.3 }), wood = std(0x5a3a22, { roughness: 0.7 });
    if (raise) grp.add(crateStack(raise));
    grp.add(mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.025, 20), wood, 0, raise + 0.0125, 0));
    grp.add(mesh(new THREE.SphereGeometry(0.06, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), brass, 0, raise + 0.025, 0));
    grp.add(mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.03, 8), brass, 0, raise + 0.095, 0), mesh(new THREE.SphereGeometry(0.012, 10, 8), brass, 0, raise + 0.112, 0));
    return grp;
  },
  // the freight company's painted sign
  deliveries() {
    const tex = canvasTex(512, 128, (x, w, h) => {
      x.fillStyle = '#3d4a3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d8c48a'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
      x.fillStyle = '#e9d9a6'; x.textAlign = 'center'; x.font = 'bold 38px Georgia, serif'; x.fillText('FREIGHT & EXPRESS', w / 2, 64); x.font = '22px Georgia, serif'; x.fillText('AGENT', w / 2, 100);
    });
    const grp = new THREE.Group(); grp.add(mesh(new THREE.BoxGeometry(1.0, 0.25, 0.03), [std(0x3d4a3a), std(0x3d4a3a), std(0x3d4a3a), std(0x3d4a3a), std(0xffffff, { map: tex }), std(0x3d4a3a)], 0, 0, 0.015));
    return grp;
  },
};
// plank crates standing in for a table: two stacked (the top one turned a little) when the height wants more than one
// crate. Board sides drawn on a canvas (planks with dark gaps and grain) and battens along the edges, as shipping crates.
function crateStack(height) {
  const grp = new THREE.Group();
  const tex = canvasTex(256, 256, (x, w, h) => {
    const planks = 4, ph = h / planks;
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < planks; i++) {
      const t = 0.85 + rnd() * 0.25;
      x.fillStyle = `rgb(${Math.round(150 * t)}, ${Math.round(112 * t)}, ${Math.round(70 * t)})`; x.fillRect(0, i * ph, w, ph);
      x.strokeStyle = 'rgba(70, 45, 25, 0.35)'; x.lineWidth = 1.5;
      for (let k = 0; k < 6; k++) { const y = i * ph + 6 + rnd() * (ph - 12); x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + rnd() * 6 - 3, w * 0.7, y + rnd() * 6 - 3, w, y); x.stroke(); }
      x.fillStyle = 'rgba(40, 25, 12, 0.85)'; x.fillRect(0, i * ph, w, 3);   // (the gap between two planks)
    }
    x.fillStyle = 'rgba(30, 20, 12, 0.9)'; for (const [cx, cy] of [[22, 20], [w - 22, 20], [22, h - 20], [w - 22, h - 20]]) { x.beginPath(); x.arc(cx, cy, 3, 0, Math.PI * 2); x.fill(); }
  });
  const side = std(0xffffff, { map: tex, roughness: 0.9 }), batten = std(0x6e5034, { roughness: 0.85 });
  const one = (w, h, d, y, turn) => {
    const c = new THREE.Group(); c.position.y = y; c.rotation.y = turn;
    c.add(mesh(new THREE.BoxGeometry(w, h, d), side, 0, h / 2, 0));
    const b = 0.035;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.add(mesh(new THREE.BoxGeometry(b, h, b), batten, sx * (w / 2 - b / 2 + 0.006), h / 2, sz * (d / 2 - b / 2 + 0.006)));
    for (const yy of [b / 2, h - b / 2]) for (const sz of [-1, 1]) c.add(mesh(new THREE.BoxGeometry(w, b, 0.012), batten, 0, yy, sz * (d / 2 + 0.006)));
    return c;
  };
  if (height > 0.55) { const lo = height * 0.55; grp.add(one(0.5, lo, 0.4, 0, 0)); grp.add(one(0.42, height - lo, 0.34, lo, 0.18)); }
  else grp.add(one(0.42, height, 0.34, 0, 0));
  return grp;
}
export function makeKeepsake(job, tier, opts) { const f = KEEP[job]; if (!f) return null; const g = f(tier, opts); g.name = 'keepsake-' + job; return g; }

// frees everything a group holds (shapes, materials, their pictures) and takes it out of the scene; pictures shared by
// every piece (the glow) are kept (disposeShared frees them)
export function disposeTree(root) {
  const mats = new Set(), geos = new Set();
  root.traverse((o) => { if (o.geometry) geos.add(o.geometry); if (o.material) for (const m of [].concat(o.material)) mats.add(m); });
  for (const g of geos) g.dispose();
  for (const m of mats) { for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap']) if (m[k] && !m[k].shared) m[k].dispose(); m.dispose(); }
  root.removeFromParent();
}
