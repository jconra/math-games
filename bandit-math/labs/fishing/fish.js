// LOW-POLY FISH, made in code: a body of rings around a line from the nose to the tail, the tail fin, the fin on its
// back, the side fins and the one underneath, each kind with its own shape and colouring (every triangle one colour,
// so the facets show):
//   perch    deep golden body with dark bars down its sides, orange fins underneath
//   trout    slim olive body, pale spots and a few red ones, a pinkish side stripe, white belly
//   bass     green, a heavy body and big head, a broken dark stripe along its side
//   catfish  grey-brown, a wide flat head with whiskers, a forked tail, no scales, a few dark specks
// makeFish(kind, length) -> F: F.root (the nose at its origin, the body along -Z, back up +Y), F.wiggle (0 still ..
// 1 thrashing: how far the back half swings side to side), F.speed (swings a second), F.update(dt), F.length,
// F.setLift(v) (a little light of its own: a fish held up against the light still shows its colours), F.dispose().
// Metres: a fish 3/4 of a foot long is made 0.229 m long.
// makeFish(kind, length, { under }): under = { surface: { value: y }, colour: THREE.Color } for water that is drawn
// solid (the game's lake: its ground painted as water, nothing under it to see): a fish below the surface is drawn as
// if it lay on the surface (its depth sorted there, so the water never hides it, while the dock, the reeds and the
// angler in front of it still do) and tinted toward the water's colour the deeper it is, so it reads as under water.
// The lab's see-through lake needs none of it.
import * as THREE from 'three';

const C = (hex) => new THREE.Color(hex);
const STYLE = {
  perch: { H: 0.27, W: 0.12, back: '#57622a', side: '#c9a43a', belly: '#efe2b8', fin: '#d77a2a', bar: '#4a4a22' },
  trout: { H: 0.2, W: 0.11, back: '#4c5a34', side: '#8d9a62', belly: '#f1e9d4', fin: '#c97a52', spot: '#e9dc94', red: '#c2452f', stripe: '#c9867a' },
  bass: { H: 0.26, W: 0.14, back: '#3b5226', side: '#7f9a4e', belly: '#ece6c6', fin: '#6b7d42', band: '#2e3a1c' },
  catfish: { H: 0.17, W: 0.17, back: '#4d4a46', side: '#8b847a', belly: '#e8e2d6', fin: '#5b544c', speck: '#2f2b28' },
};
// body height and width along the fish (s: 0 the nose .. 1 where the tail fin starts), as fractions of the deepest
const PROFILE = {
  default: { h: [[0, 0.22], [0.07, 0.58], [0.2, 0.9], [0.4, 1], [0.62, 0.78], [0.82, 0.42], [1, 0.2]], w: [[0, 0.3], [0.08, 0.75], [0.25, 1], [0.5, 0.85], [0.8, 0.4], [1, 0.18]] },
  catfish: { h: [[0, 0.35], [0.08, 0.72], [0.28, 0.95], [0.45, 1], [0.7, 0.66], [1, 0.2]], w: [[0, 0.85], [0.1, 1], [0.3, 0.95], [0.6, 0.55], [1, 0.14]] },
};
const lerpTable = (tab, s) => { for (let i = 1; i < tab.length; i++) if (s <= tab[i][0]) { const [a, va] = tab[i - 1], [b, vb] = tab[i]; return va + (vb - va) * (s - a) / (b - a); } return tab[tab.length - 1][1]; };
// a repeatable random number per triangle, for spots
const hash = (a, b, c = 0) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };

// build the geometry: one colour a triangle (non-indexed), positions in metres
function fishGeometry(kind, L) {
  const S = STYLE[kind], P = PROFILE[kind] || PROFILE.default;
  const H = S.H * L, W = S.W * L, BODY = 0.8;            // the body ends 80% of the way back; the tail fin is the rest
  const STN = [0, 0.05, 0.13, 0.25, 0.38, 0.52, 0.66, 0.8, 0.92, 1], R = 10;
  const pos = [], col = [];
  const ring = STN.map((s) => {
    const h = lerpTable(P.h, s) * H / 2, w = lerpTable(P.w, s) * W / 2, z = -s * BODY * L, lift = kind === 'catfish' ? -0.15 * h : 0.05 * h;
    const pts = [];
    for (let k = 0; k < R; k++) { const a = k / R * Math.PI * 2; pts.push(new THREE.Vector3(Math.sin(a) * w, Math.cos(a) * h + lift, z)); }
    return pts;
  });
  const tri = (a, b, c, colour) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); for (let i = 0; i < 3; i++) col.push(colour.r, colour.g, colour.b); };
  const back = C(S.back), side = C(S.side), belly = C(S.belly), fin = C(S.fin), dark = C('#141210'), white = C('#f4efe2');
  // the colour of the skin at station s, angle a (0 the top of the back, PI the belly), for triangle number id
  function skin(s, a, id) {
    const up = Math.cos(a);
    let c = up > 0.45 ? back.clone() : up < -0.5 ? belly.clone() : side.clone();
    if (up > 0.15 && up <= 0.45) c = back.clone().lerp(side, 0.5);
    if (s < 0.14 && up > -0.5) c.multiplyScalar(0.86);                                        // the head a shade darker
    const sideOn = up < 0.6 && up > -0.45;
    if (kind === 'perch' && sideOn && s > 0.2 && s < 0.82 && Math.floor(s * 11) % 2 === 0) c = C(S.bar).lerp(c, 0.25);
    if (kind === 'trout') {
      if (Math.abs(up) < 0.18 && s > 0.15 && s < 0.85) c = C(S.stripe).lerp(c, 0.35);
      const h = hash(s * 31, a * 17, id);
      if (up > -0.3 && h < 0.16) c = C(S.spot); else if (sideOn && h > 0.95) c = C(S.red);
    }
    if (kind === 'bass' && Math.abs(up) < 0.32 && s > 0.12 && s < 0.9 && hash(s * 13, 1, id) < 0.7) c = C(S.band);
    if (kind === 'catfish' && up > -0.4 && hash(s * 23, a * 7, id) < 0.12) c = C(S.speck);
    return c;
  }
  // the body: quads between rings, split into two triangles; the nose closed with a fan
  const nose = new THREE.Vector3(0, ring[0][0].y * 0 + (kind === 'catfish' ? -0.05 * H : 0), 0.012 * L);
  for (let k = 0; k < R; k++) tri(nose, ring[0][(k + 1) % R], ring[0][k], skin(0, (k + 0.5) / R * Math.PI * 2, k));
  for (let i = 0; i < STN.length - 1; i++) for (let k = 0; k < R; k++) {
    const a = ring[i][k], b = ring[i][(k + 1) % R], c = ring[i + 1][k], d = ring[i + 1][(k + 1) % R];
    const sMid = (STN[i] + STN[i + 1]) / 2, ang = (k + 0.5) / R * Math.PI * 2;
    // the eyes: the triangles high on the side, just behind the nose
    const eye = i === 1 && (k === 2 || k === R - 3);
    const cc = eye ? dark : skin(sMid, ang, i * R + k);
    tri(a, c, b, eye ? dark : cc); tri(b, c, d, eye ? (kind === 'catfish' ? dark : white) : cc);
  }
  // the tail end closed, and the tail fin: two lobes (forked deeper on the catfish and trout)
  const last = ring[ring.length - 1], zT = -BODY * L, cT = new THREE.Vector3(0, last[0].y * 0.2, zT);
  for (let k = 0; k < R; k++) tri(cT, last[k], last[(k + 1) % R], back);
  const fork = kind === 'catfish' ? 0.55 : kind === 'trout' ? 0.35 : 0.15, tl = 0.22 * L, th = H * (kind === 'catfish' ? 0.55 : 0.62);
  const t0 = new THREE.Vector3(0, H * 0.06, zT + 0.01 * L), t1 = new THREE.Vector3(0, -H * 0.06, zT + 0.01 * L);
  const up = new THREE.Vector3(0, th, zT - tl), dn = new THREE.Vector3(0, -th, zT - tl), mid = new THREE.Vector3(0, 0, zT - tl * (1 - fork));
  const tf = fin.clone().lerp(back, 0.35);
  tri(t0, up, mid, tf); tri(t1, mid, dn, tf); tri(t0, mid, t1, tf);
  // the fin on the back (two on the perch: the front one spiny and tall)
  const topAt = (s) => lerpTable(P.h, s) * H / 2 + 0.05 * lerpTable(P.h, s) * H / 2;
  const dorsal = (s0, s1, hgt, c) => {
    const a = new THREE.Vector3(0, topAt(s0) * 0.95, -s0 * BODY * L), b = new THREE.Vector3(0, topAt(s1) * 0.95, -s1 * BODY * L);
    const tip = new THREE.Vector3(0, topAt((s0 + s1) / 2) + hgt * H, -(s0 + (s1 - s0) * 0.35) * BODY * L);
    tri(a, tip, b, c);
  };
  if (kind === 'perch') { dorsal(0.22, 0.5, 0.42, C('#6a6430')); dorsal(0.52, 0.75, 0.28, fin.clone().lerp(back, 0.5)); }
  else if (kind === 'catfish') { dorsal(0.3, 0.45, 0.42, fin); dorsal(0.78, 0.86, 0.12, fin); }
  else dorsal(0.28, 0.6, kind === 'bass' ? 0.42 : 0.3, fin.clone().lerp(back, 0.4));
  // the side fins (just behind the head, sticking out and back) and the one underneath near the tail
  const pz = -0.2 * BODY * L, py = -lerpTable(P.h, 0.2) * H * 0.22;
  for (const sx of [1, -1]) {
    const base = new THREE.Vector3(sx * lerpTable(P.w, 0.2) * W * 0.45, py, pz), b2 = base.clone().add(new THREE.Vector3(0, -0.03 * H, -0.09 * L));
    const tip = base.clone().add(new THREE.Vector3(sx * 0.1 * L, -0.12 * H, -0.12 * L));
    tri(base, tip, b2, fin); tri(base, b2, tip, fin);
    // the pair underneath, further back
    const pb = new THREE.Vector3(sx * 0.02 * L, -lerpTable(P.h, 0.42) * H / 2 * 0.92, -0.42 * BODY * L);
    const pb2 = pb.clone().add(new THREE.Vector3(0, 0, -0.07 * L)), ptip = pb.clone().add(new THREE.Vector3(sx * 0.05 * L, -0.1 * H, -0.09 * L));
    tri(pb, ptip, pb2, fin); tri(pb, pb2, ptip, fin);
  }
  const aBase = (s) => new THREE.Vector3(0, -lerpTable(P.h, s) * H / 2 * 0.95, -s * BODY * L);
  tri(aBase(0.66), new THREE.Vector3(0, -lerpTable(P.h, 0.72) * H / 2 - 0.22 * H, -0.74 * BODY * L), aBase(0.84), fin);
  // the catfish's whiskers: four long thin ones from the corners of its mouth, two short ones underneath
  if (kind === 'catfish') {
    for (const sx of [1, -1]) {
      const m = new THREE.Vector3(sx * 0.03 * L, -0.02 * H, 0), m2 = m.clone().add(new THREE.Vector3(0, -0.012 * L, 0));
      const tip = new THREE.Vector3(sx * 0.16 * L, -0.08 * H, -0.12 * L);
      tri(m, tip, m2, dark); tri(m, m2, tip, dark);
      const c0 = new THREE.Vector3(sx * 0.012 * L, -0.12 * H, -0.01 * L), c1 = c0.clone().add(new THREE.Vector3(0, 0, -0.01 * L)), ct = new THREE.Vector3(sx * 0.03 * L, -0.38 * H, 0.02 * L);
      tri(c0, ct, c1, dark); tri(c0, c1, ct, dark);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// one material a fish, so each wiggles on its own: the back half swings side to side, more toward the tail
function wiggleMaterial(L, under = null) {
  const u = { uTime: { value: Math.random() * 10 }, uAmp: { value: 0.15 }, uFreq: { value: 7 }, uLen: { value: L }, uLift: { value: 0 } };
  if (under) Object.assign(u, { uSurf: under.surface, uWater: { value: under.colour } });
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform float uTime, uAmp, uFreq, uLen;\n' + (under ? 'uniform float uSurf; varying float vBelow;\n' : '') + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float tt = clamp(-position.z / uLen, 0.0, 1.2);
      float sway = sin(uTime * uFreq - tt * 5.5) * uAmp * uLen * 0.25 * (0.08 + tt * tt);
      transformed.x += sway;`);
    // (lifted: a little light of its own, so a fish held up with the sun behind it still shows its colours)
    sh.fragmentShader = 'uniform float uLift;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
      gl_FragColor.rgb += diffuseColor.rgb * uLift;`);
    if (under) {
      // (where it is on the screen stays; how near it is goes by the point on the surface above it)
      sh.vertexShader = sh.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>
      { vec4 wp = modelMatrix * vec4(transformed, 1.0); vBelow = max(0.0, uSurf - wp.y);
        vec4 up = wp; up.y = max(wp.y, uSurf + 0.015);
        vec4 cs = projectionMatrix * viewMatrix * up;
        gl_Position = vec4(gl_Position.xy / gl_Position.w * cs.w, cs.z, cs.w); }`);
      sh.fragmentShader = 'uniform vec3 uWater; varying float vBelow;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uWater, clamp(0.25 + vBelow * 1.1, 0.0, 0.8) * step(0.003, vBelow));`);
    }
  };
  m.customProgramCacheKey = () => (under ? 'fish-wiggle-under' : 'fish-wiggle');
  m.userData.u = u;
  return m;
}

// (one geometry per kind and length, shared by the fish made of it; the last of them disposed lets it go: the swimmers
// come in random lengths, so a cache kept forever grew by a few shapes every time the rod came out)
const cache = new Map();   // key -> { geo, n (fish using it) }
// (shapes let go one a frame, not all at once as the rod goes down: freeing many buffers in one frame stalls the
// graphics card a moment later)
const freeing = [];
const freeNext = () => { const g = freeing.shift(); if (g) g.dispose(); if (freeing.length) setTimeout(freeNext, 16); };
const freeSoon = (g) => { freeing.push(g); if (freeing.length === 1) setTimeout(freeNext, 16); };
export function makeFish(kind, length, { under = null } = {}) {
  const key = kind + ':' + length.toFixed(4);
  if (!cache.has(key)) cache.set(key, { geo: fishGeometry(kind, length), n: 0 });
  const held = cache.get(key); held.n++;
  const geo = held.geo, mat = wiggleMaterial(length, under);
  let gone = false;
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = false;
  const root = new THREE.Group(); root.add(mesh);
  const F = {
    root, mesh, kind, length, wiggle: 0.15, speed: 7,
    // a little light of its own (0 none): the game lifts a fish held up to look at, so it reads whatever the sun does
    setLift(v) { mat.userData.u.uLift.value = v; },
    update(dt) { const u = mat.userData.u; u.uTime.value += dt; u.uAmp.value += (F.wiggle - u.uAmp.value) * Math.min(1, dt * 6); u.uFreq.value = F.speed; },
    dispose() {
      mat.dispose(); root.removeFromParent();
      if (gone) return; gone = true;
      if (--held.n <= 0 && cache.get(key) === held) { cache.delete(key); freeSoon(geo); }
    },
  };
  return F;
}
