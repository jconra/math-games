// THE MANE AND TAIL: hair cards. A few dozen narrow strips laid over the neck and hanging from the dock, each drawn
// with a picture of hair strands (drawn in code: strands of different lengths and shades, solid at the roots, ragged at
// the tips) whose see-through gaps are cut by alpha (with alpha to coverage, so the cut edges are smoothed by the
// screen's multisampling). Every corner of every card is skinned to the bones under it (the mane to the neck's and the
// head's, as the body is there; the tail down the tail's chain), so they move with every clip, and the vertex shader
// adds a little life on top: the tail bends about its root toward hanging down (and back, with speed), so a tail a clip
// holds out stiff arcs down; the mane lifts at speed; both ripple. Colour, length and pinto white come from the coat recipe, the same code as the coat (coat.js COMMON).
//
//   buildHair(shape) -> { geometry, tris, cards }     once per model (shape from prepareHorse)
//   hairMaterial(shape, coatUniforms) -> material     per horse: shares the coat's uniforms, so a new recipe recolours both
//   attachHair(body, geometry, material) -> mesh      a skinned mesh on the body's own skeleton (one more draw)
//   material.hair.uniforms.uTime / uSpeed / uBackW / uDockW   per frame: the clock, how fast the horse is going (m/s),
//                                                     which way is behind it, and where the tail's root is (world)
import * as THREE from 'three';
import { COMMON, LIGHT_HOOK } from './coat.js';

export const HAIR = {
  // the mane: rooted on one line along the top of the neck (the crest, smoothed), 1.5 cm inside the skin, from just
  // behind the ears to the withers, neighbours overlapping by well over half; shortest at the poll and longest mid-neck;
  // most of it down the near (left) side, some over to the far side. Narrow at the root, widest a third of the way down
  mane: { cards: 34, rows: 6, length: 0.42, width: [0.115, 0.085], lift: [-0.015, 0.028], farShare: 0.1 },
  crest: { cards: 10, rows: 3, length: 0.08, width: [0.09, 0.08], lift: [-0.012, 0.01] },   // a short fringe on the far side
  forelock: { cards: 3, rows: 4, length: 0.12, width: [0.04, 0.022] },                       // short, off the face, fading out
  // the tail: a bundle of cards crossed round its middle line (full from every angle) and a light fan round it, held off
  // the rump, narrow at the dock and fanning a little toward the end, which reaches the middle of the hind cannons
  tail: { crossed: 4, fan: 8, rows: 9, end: 0.36, radius: [0.035, 0.085, 0.115], off: 0.06 },
};
const KIND = { mane: 0, forelock: 1, tail: 2, crest: 3, tailFan: 2.25 };   // (the fan: a tail card, drawn lighter)
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// the nearest corner of the body to a point (a grid of 4 cm cells)
function surfaceIndex(shape) {
  const { rest, nrm, W } = shape, n = rest.length / 3, C = 0.04, cells = new Map();
  const key = (i, j, k) => i + ',' + j + ',' + k;
  for (let v = 0; v < n; v++) {
    if (shape.sculptedHair && (W.tail[v] > 0.5)) continue;     // (not onto a sculpted tail's strands)
    const k = key(Math.floor(rest[v * 3] / C), Math.floor(rest[v * 3 + 1] / C), Math.floor(rest[v * 3 + 2] / C));
    let a = cells.get(k); if (!a) cells.set(k, (a = [])); a.push(v);
  }
  const nearest = (p, filter = null) => {
    let best = -1, bd = Infinity;
    const ci = Math.floor(p.x / C), cj = Math.floor(p.y / C), ck = Math.floor(p.z / C);
    for (let r = 1; r <= 3 && best < 0; r++) {
      for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) for (let k = ck - r; k <= ck + r; k++) {
        const a = cells.get(key(i, j, k)); if (!a) continue;
        for (const v of a) {
          if (filter && !filter(v)) continue;
          const dx = rest[v * 3] - p.x, dy = rest[v * 3 + 1] - p.y, dz = rest[v * 3 + 2] - p.z, d = dx * dx + dy * dy + dz * dz;
          if (d < bd) { bd = d; best = v; }
        }
      }
    }
    return best;
  };
  const pos = (v) => V(rest[v * 3], rest[v * 3 + 1], rest[v * 3 + 2]);
  const nor = (v) => V(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]);
  return { nearest, pos, nor };
}
function rand(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

export function buildHair(shape) {
  const S = surfaceIndex(shape), R = rand(11);
  const Minv = shape.M.clone().invert();
  const names = shape.boneNames, SI = shape.skinIndex, SW = shape.skinWeight;
  const out = { pos: [], nrm: [], si: [], sw: [], hair: [], strand: [], root: [], index: [] };
  let cards = 0;
  const notTail = (v) => shape.W.tail[v] < 0.3;
  // one card from a centre line: rows of (centre, surface normal, across direction, width), skinned per row
  function card(rows, kind, skinOf) {
    const base = out.pos.length / 3, phase = R(), root = rows[0].c;
    rows.forEach((r, k) => {
      const a = (k < rows.length - 1 ? rows[k + 1].c.clone().sub(r.c) : r.c.clone().sub(rows[k - 1].c)).normalize();
      const along = k / (rows.length - 1);
      const sk = skinOf(r, along);
      for (const side of [0, 1]) {
        const p = r.c.clone().addScaledVector(r.across, (side - 0.5) * r.w).applyMatrix4(Minv);
        out.pos.push(p.x, p.y, p.z);
        out.nrm.push(r.n.x, r.n.y, r.n.z);
        out.si.push(...sk.i); out.sw.push(...sk.w);
        out.hair.push(along, side, phase, KIND[kind]);
        out.strand.push(a.x, a.y, a.z);
        const an = r.axis || root;      // (the tail: the point on its middle line at this row; the rest: the card's root)
        out.root.push(an.x, an.y, an.z);
      }
      if (k > 0) { const i0 = base + (k - 1) * 2; out.index.push(i0, i0 + 1, i0 + 3, i0, i0 + 3, i0 + 2); }
    });
    cards++;
  }
  // skinned as the body is at the nearest corner
  const skinBody = (r) => { const v = r.v; return { i: [SI.getComponent(v, 0), SI.getComponent(v, 1), SI.getComponent(v, 2), SI.getComponent(v, 3)], w: [SW.getComponent(v, 0), SW.getComponent(v, 1), SW.getComponent(v, 2), SW.getComponent(v, 3)] }; };
  // a strand laid over the body: from a start, down with gravity (pushed off to one side at first, and a little back or
  // forward), each step put back onto the body's surface and lifted off it a little more toward the tip
  function drape(start, cfg, { side = 1, push = 0.7, back = 0.15, len = cfg.length, filter = notTail, hang = true, sway = 1 } = {}) {
    const rows = [], N = cfg.rows;
    let p = start.clone();
    for (let k = 0; k < N; k++) {
      const s = k / (N - 1);
      if (k > 0) {
        const v0 = S.nearest(p, filter), n0 = v0 >= 0 ? S.nor(v0) : V(0, 0, 0);
        const gdir = V(side * push * (1 - s) * (1 - s), -1, -back);
        gdir.addScaledVector(n0, -gdir.dot(n0)).normalize();
        p.addScaledVector(gdir, len / (N - 1));
      }
      let v = S.nearest(p, filter); if (v < 0) v = rows.length ? rows[rows.length - 1].v : S.nearest(p);
      const n = S.nor(v), sp = S.pos(v);
      const lift = cfg.lift[0] + (cfg.lift[1] - cfg.lift[0]) * s;
      p.addScaledVector(n, lift - p.clone().sub(sp).dot(n));
      // (hair hangs: a row never sits higher than the one before it, wherever the surface leads; but never under the skin)
      if (hang && rows.length) {
        const prev = rows[rows.length - 1].c;
        if (p.y > prev.y - 0.004 * s) {
          p.y = prev.y - 0.004 * s - 0.002;
          const v2 = S.nearest(p, filter), n2 = S.nor(v2), under = lift - p.clone().sub(S.pos(v2)).dot(n2);
          if (under > 0) p.addScaledVector(n2, under);
        }
      }
      // (narrow at the root, widest a third of the way down, a little narrower again at the tip)
      rows.push({ c: p.clone(), n, v, w: (cfg.width[0] + (cfg.width[1] - cfg.width[0]) * s) * (0.3 + 0.7 * THREE.MathUtils.smoothstep(s, 0, 0.35)) });
    }
    const wave = (R() - 0.5) * 0.03 * sway, ph = R() * 6.28;
    rows.forEach((r, k) => {
      const a = (k < rows.length - 1 ? rows[k + 1].c.clone().sub(r.c) : r.c.clone().sub(rows[k - 1].c)).normalize();
      r.across = new THREE.Vector3().crossVectors(r.n, a).normalize();
      const s = k / (rows.length - 1);
      r.c.addScaledVector(r.across, wave * Math.sin(s * 2.6 + ph) * s);    // (each lock swings a little to one side)
    });
    return rows;
  }

  // THE MANE: the crest line first (the top of the neck at each place along it, every centimetre, smoothed over 7 cm and
  // set on the neck's middle), then the cards rooted on it, from just behind the ears to the withers
  const { neckO, neckA, neckL, up, midX, withersT } = shape;
  const rest = shape.rest, n = rest.length / 3, neckV = [];
  for (let v = 0; v < n; v++) {
    if (shape.W.legs[v] + shape.W.tail[v] > 0.3 || shape.W.ear[v] > 0.2 || Math.abs(rest[v * 3] - midX) > 0.04) continue;
    const d = S.pos(v).sub(neckO), t = d.dot(neckA); if (t < withersT - 0.08 || t > neckL + 0.02) continue;
    neckV.push([v, t, d.dot(up)]);
  }
  const crestPoint = (t) => { let best = -1, bh = -9; for (const [v, tv, h] of neckV) if (Math.abs(tv - t) < 0.02 && h > bh) { bh = h; best = v; } return best; };
  const raw = [];
  for (let t = withersT - 0.05; t <= neckL; t += 0.01) { const v = crestPoint(t); if (v >= 0) raw.push([t, S.pos(v)]); }
  const line = raw.map(([t], i) => {
    const near = raw.slice(Math.max(0, i - 3), i + 4), p = near.reduce((acc, [, q]) => acc.add(q), V(0, 0, 0)).divideScalar(near.length);
    p.x = midX; return [t, p];
  });
  const crestAt = (t) => {
    if (t <= line[0][0]) return line[0][1].clone();
    for (let i = 1; i < line.length; i++) if (line[i][0] >= t) { const [t0, p0] = line[i - 1], [t1, p1] = line[i]; return p0.clone().lerp(p1, (t - t0) / (t1 - t0)); }
    return line[line.length - 1][1].clone();
  };
  const tPoll = neckL - 0.05, tWith = withersT + 0.07, M = HAIR.mane;
  for (let i = 0; i < M.cards; i++) {
    const u = Math.min(1, Math.max(0, (i + (R() - 0.5) * 0.4) / (M.cards - 1))), t = tPoll + (tWith - tPoll) * u;
    const far = R() < M.farShare ? -1 : 1;
    // shortest at the poll, longest mid-neck, a little shorter again at the withers
    const len = M.length * (0.12 + 0.88 * THREE.MathUtils.smoothstep(u, 0, 0.42) * (1 - 0.32 * THREE.MathUtils.smoothstep(u, 0.72, 1))) * (0.88 + 0.24 * R()) * (far < 0 ? 0.8 : 1);
    card(drape(crestAt(t), M, { side: far, push: 0.9, back: 0.1, len }), 'mane', skinBody);
  }
  for (let i = 0; i < HAIR.crest.cards; i++) {
    // (the fringe starts a little behind the poll and stops short of the withers, where the top line flattens)
    const t = tPoll - 0.04 + (tWith + 0.12 - tPoll + 0.04) * (i + 0.5) / HAIR.crest.cards;
    card(drape(crestAt(t), HAIR.crest, { side: -1, push: 1.0, back: 0.1 }), 'crest', skinBody);
  }
  // THE FORELOCK: two or three short locks from between the ears, angled off the face (not lying on it), down the
  // forehead, fanning a little apart and fading out at their tips, short of the star
  const head = (v) => shape.W.head[v] > 0.5 && shape.W.ear[v] < 0.15;
  const F = HAIR.forelock, fa = shape.faceA, ff = shape.faceF;
  for (let i = 0; i < F.cards; i++) {
    const k = i - (F.cards - 1) / 2, v = S.nearest(V(shape.mid0 + k * 0.014, shape.poll.y + 0.03, shape.poll.z + 0.04), head); if (v < 0) continue;
    const root = S.pos(v).addScaledVector(S.nor(v), -0.008);
    const dir = fa.clone().multiplyScalar(Math.cos(0.42)).addScaledVector(ff, Math.sin(0.42)).addScaledVector(V(1, 0, 0), k * 0.18).normalize();
    const across = new THREE.Vector3().crossVectors(ff, dir).normalize(), L = F.length * (0.85 + 0.3 * R()), rows = [];
    for (let j = 0; j < F.rows; j++) {
      const s2 = j / (F.rows - 1);
      const c = root.clone().addScaledVector(dir, L * s2).addScaledVector(V(0, -1, 0), 0.025 * s2 * s2);
      rows.push({ c, n: ff.clone(), across, v, w: F.width[0] + (F.width[1] - F.width[0]) * s2 });
    }
    card(rows, 'forelock', skinBody);
  }

  // THE TAIL: a bundle down the tail's chain of bones and on below its last bone to the middle of the hind cannons. Its
  // middle line is held behind the rump (the buttock's back, measured from the mesh at each height, plus a gap), narrow
  // at the dock and fanning a little toward the end. Cards crossed round the middle line make it full from every angle; a
  // light fan of cards round the outside softens its outline. Skinned along the chain.
  const B = shape.bones, chainNames = ['Tail1', 'Tail2', 'Tail3', 'Tail4', 'Tail5', 'Tail6', 'Tail7'].filter((nm) => B[nm]);
  const chain = chainNames.map((nm) => B[nm].clone()), last = chain[chain.length - 1];
  const T = HAIR.tail, X = V(1, 0, 0);
  const end = V(last.x, Math.min(T.end, last.y - 0.1), last.z - 0.04);
  // the back of the rump at a height: the backmost body corner near the middle (not the tail's own), over the hindquarters
  const rumpAt = (y) => {
    let zmin = Infinity;
    for (let v = 0; v < n; v++) {
      if (shape.W.tail[v] > 0.2 || Math.abs(rest[v * 3] - midX) > 0.1 || Math.abs(rest[v * 3 + 1] - y) > 0.03 || rest[v * 3 + 2] > -0.3) continue;
      zmin = Math.min(zmin, rest[v * 3 + 2]);
    }
    return zmin;
  };
  const rad = (a) => (a < 0.5 ? T.radius[0] + (T.radius[1] - T.radius[0]) * THREE.MathUtils.smoothstep(a, 0, 0.5) : T.radius[1] + (T.radius[2] - T.radius[1]) * (a - 0.5) * 2);
  const pts = [...chain, end].map((p, i, arr) => {
    const a = i / (arr.length - 1), q = p.clone(), rz = rumpAt(q.y);
    if (Number.isFinite(rz)) q.z = Math.min(q.z, q.z + (rz - T.off - rad(a) * 0.7 - q.z) * THREE.MathUtils.smoothstep(a, 0.12, 0.35));
    return q;
  });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = cum[cum.length - 1];
  const at = (s) => {   // a place along the (held off) chain, 0..1: point, direction, and the bones round it
    const d = s * total; let j = 0; while (j < pts.length - 2 && cum[j + 1] < d) j++;
    const f = Math.min(1, Math.max(0, (d - cum[j]) / (cum[j + 1] - cum[j])));
    const p = pts[j].clone().lerp(pts[j + 1], f), dir = pts[j + 1].clone().sub(pts[j]).normalize();
    const bi = (k) => names.indexOf(chainNames[Math.min(k, chainNames.length - 1)]);
    const sk = j + 1 < chainNames.length ? { i: [bi(j), bi(j + 1), 0, 0], w: [1 - f, f, 0, 0] } : { i: [bi(chainNames.length - 1), 0, 0, 0], w: [1, 0, 0, 0] };
    return { p, dir, sk };
  };
  const tailCard = (phi, s0, crossed, endJit, wJit) => {
    const rows = [], N = T.rows;
    for (let k = 0; k < N; k++) {
      const a = k / (N - 1), s = s0 + (1 - s0) * a * endJit, P = at(s);
      let b1 = new THREE.Vector3().crossVectors(P.dir, X).normalize(); if (b1.z > 0) b1.negate();   // (pointing away from the rump)
      const radial = b1.clone().multiplyScalar(Math.cos(phi)).addScaledVector(X, Math.sin(phi));
      const r = rad(s);
      // a crossed card lies through the middle, as wide as the bundle; a fan card lies round its outside
      const c = crossed ? P.p.clone() : P.p.clone().addScaledVector(radial, r * 0.85);
      const across = crossed ? radial.clone() : new THREE.Vector3().crossVectors(radial, P.dir).normalize();
      const w = crossed ? r * 2 : r * 1.1 * wJit;
      rows.push({ c, n: crossed ? b1 : radial, across, w, sk: P.sk, axis: P.p.clone() });
    }
    card(rows, crossed ? 'tail' : 'tailFan', (r) => r.sk);
  };
  for (let i = 0; i < T.crossed; i++) tailCard(i * Math.PI / T.crossed + 0.2, 0.0, true, 0.96 + 0.04 * R(), 1);
  for (let i = 0; i < T.fan; i++) tailCard(-Math.PI + 2 * Math.PI * (i + 0.5 + 0.3 * (R() - 0.5)) / T.fan, 0.05 + 0.1 * R(), false, 0.85 + 0.15 * R(), 0.85 + 0.3 * R());

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nrm, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(out.si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(out.sw, 4));
  g.setAttribute('aHair', new THREE.Float32BufferAttribute(out.hair, 4));
  g.setAttribute('aStrand', new THREE.Float32BufferAttribute(out.strand, 3));
  g.setAttribute('aRoot', new THREE.Float32BufferAttribute(out.root, 3));
  g.setIndex(out.index);
  g.computeBoundingSphere();
  return { geometry: g, tris: out.index.length / 3, cards, bytes: out.pos.length / 3 * (12 + 12 + 8 + 16 + 16 + 12 + 12) };
}

// ── the picture of hair: strands running down (v: 0 at the root, 1 at the longest tip), solid at the roots, of
// different lengths and shades, tapering and thinning toward their tips; it tiles across ────────────────────────────
let HAIR_TEX = null;
export function hairTexture(renderer) {
  if (HAIR_TEX) return HAIR_TEX;
  const W = 128, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), R = rand(7);
  g.clearRect(0, 0, W, H);
  g.lineCap = 'round';
  const strand = (x0, len, wid, l, ph, amp, fr, a) => {
    for (const ox of [-W, 0, W]) {
      g.beginPath();
      for (let y = 0; y <= len; y += 4) { const x = x0 + ox + Math.sin(y * fr + ph) * amp * (y / H); if (y === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      const v = Math.round(255 * l);
      g.strokeStyle = `rgba(${v},${v},${v},${a})`; g.lineWidth = wid; g.stroke();
    }
  };
  // a dense, darker under-layer near the roots, then the strands over it
  for (let i = 0; i < 120; i++) strand(R() * W, H * (0.25 + 0.3 * R()), 2 + R() * 2, 0.35 + 0.25 * R(), R() * 6.3, 1 + R() * 2, 0.02, 1);
  for (let i = 0; i < 320; i++) {
    const len = H * (0.3 + 0.7 * Math.pow(R(), 1.25));
    strand(R() * W, len, 0.8 + R() * 1.6, 0.45 + 0.55 * R(), R() * 6.3, 0.8 + R() * 3, 0.012 + R() * 0.02, 1);
  }
  // the tips: thin the last stretch of every column out to nothing, unevenly
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, t = y / H;
    if (y < 8) { if (d[i + 3] < 255) { const k = d[i + 3] / 255; d[i] = d[i] * k + 110 * (1 - k); d[i + 1] = d[i + 1] * k + 110 * (1 - k); d[i + 2] = d[i + 2] * k + 110 * (1 - k); d[i + 3] = 255; } }
    d[i + 3] *= 1 - Math.max(0, (t - 0.9) / 0.1);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = false; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = renderer ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 1;
  t.name = 'hair strands';
  HAIR_TEX = t; t.bytes = W * H * 4 * 4 / 3;
  return t;
}

const HAIR_VERT_PARS = /* glsl */`
attribute vec4 aHair;     // root-to-tip, across the card (0/1), the card's own random, kind (mane, forelock, tail, crest)
attribute vec3 aStrand;   // the way the strand runs, at rest
attribute vec3 aRoot;     // where its root is, at rest (for its colour and pinto white); the tail: its middle line here
uniform float uTime;
uniform float uSpeed;
uniform vec3 uBackW;
uniform vec3 uDockW;      // where the tail's root is, in the world, this frame (the tail bends about it)
uniform vec3 uDockR;      // ... and at rest, in the horse's own space
uniform mat4 uRestM;
varying vec4 vHairV;
varying vec3 vRootR;
varying vec3 vStrandV;
`;
const HAIR_VERT_MAIN = /* glsl */`
vec3 hairStrand = aStrand;
#ifdef USE_SKINNING
  hairStrand = ( skinMatrix * vec4( hairStrand, 0.0 ) ).xyz;
#endif
vStrandV = normalize( ( modelViewMatrix * vec4( hairStrand, 0.0 ) ).xyz );
vHairV = aHair;
vRootR = aRoot;
`;
// where the card ends up: skinned, then (in the world) a sag under its own weight where a clip holds the tail out, a
// stream backward with speed, and a ripple travelling down the strands
const HAIR_PROJECT = /* glsl */`
vec4 hairW = modelMatrix * vec4( transformed, 1.0 );
{
  float a = aHair.x, a2 = a * a;
  float isTail = step( 1.5, aHair.w ) * step( aHair.w, 2.5 );
  float spd = min( uSpeed, 12.0 );
  vec3 sdW = normalize( ( modelMatrix * vec4( hairStrand, 0.0 ) ).xyz );
  if ( isTail > 0.5 ) {
    // the tail: bent about the dock, more toward its tip, toward hanging down (and back, with speed). Turning each
    // point about the dock keeps the tail its length, so a tail a clip holds out stiff arcs down instead of stretching
    // (the turn is worked out from the tail's middle line at this height, so its whole width turns as one piece and the
    // cone keeps its shape)
    vec3 offR = ( uRestM * vec4( position, 1.0 ) ).xyz - aRoot;
    vec3 offP = offR / uRestM[ 0 ][ 0 ];
    #ifdef USE_SKINNING
      offP = ( skinMatrix * vec4( offP, 0.0 ) ).xyz;
    #endif
    vec3 axisW = hairW.xyz - ( modelMatrix * vec4( offP, 0.0 ) ).xyz;
    vec3 v = hairW.xyz - uDockW;
    vec3 va = axisW - uDockW;
    vec3 dir = normalize( va + vec3( 0.0, -0.0001, 0.0 ) );
    // standing and walking, toward hanging (a little back); galloping, toward streaming back (a little down), the root
    // lifted with it: the turn reaches further up the tail the faster it goes
    // (standing or walking the turn aims at the tail's own resting way, as it hangs clear of the rump in the model, so a
    // clip that already lets it hang changes nothing)
    float run = smoothstep( 2.5, 8.0, spd );
    vec3 hangW = normalize( mat3( modelMatrix ) * ( aRoot - uDockR ) + vec3( 0.0, -0.0001, 0.0 ) );
    vec3 target = normalize( mix( hangW, uBackW + vec3( 0.0, -0.22, 0.0 ), run ) );
    vec3 k = cross( dir, target );
    float kl = length( k );
    if ( kl > 0.0001 ) {
      k /= kl;
      float phi = acos( clamp( dot( dir, target ), -1.0, 1.0 ) ) * clamp( a * 1.3 + run * 0.35, 0.0, 1.0 ) * mix( 0.8, 0.85, run );
      v = v * cos( phi ) + cross( k, v ) * sin( phi ) + k * dot( k, v ) * ( 1.0 - cos( phi ) );
    }
    hairW.xyz = uDockW + v;
  } else {
    // the mane lifts and streams back a little at speed
    hairW.xyz += ( vec3( 0.0, 1.0, 0.0 ) * a * 0.006 + uBackW * a2 * 0.004 ) * spd;
  }
  // a ripple travelling down the strands, livelier with speed
  float len = mix( 0.32, 1.0, isTail );
  vec3 sideW = normalize( cross( sdW, vec3( 0.0, 1.0, 0.0 ) ) + vec3( 0.0001 ) );
  float wave = sin( uTime * ( 2.0 + 0.4 * spd ) - a * 4.5 + aHair.z * 6.2832 );
  hairW.xyz += sideW * wave * a2 * len * ( 0.022 + 0.006 * spd ) * mix( 0.35, 1.0, isTail );
  hairW.xyz += vec3( 0.0, 1.0, 0.0 ) * wave * a2 * len * 0.012 * smoothstep( 2.5, 8.0, spd ) * isTail;   // (a streaming tail also lifts and falls)
}
vec4 mvPosition = viewMatrix * hairW;
gl_Position = projectionMatrix * mvPosition;
`;
const HAIR_FRAG_PARS = /* glsl */`
uniform sampler2D uHairTex;
uniform vec2 uHairLen;     // how long the mane and the tail are (a share of the cards' length)
float hairShift = 0.0;
varying vec4 vHairV;
varying vec3 vRootR;
varying vec3 vStrandV;
`;
const HAIR_FRAG_COLOR = /* glsl */`
float hAlong = vHairV.x;
float hTail = step( 1.5, vHairV.w ) * step( vHairV.w, 2.5 );
float hLen = clamp( mix( uHairLen.x, uHairLen.y, hTail ), 0.2, 1.0 );
float hv = hAlong / hLen;                                   // (a shorter mane: the picture's strands end sooner)
// (the picture's strands thin out toward its bottom: a tail uses its fuller top part, so it stays full to its end,
// which the strip's own length and a ragged cut decide)
vec4 tx = texture2D( uHairTex, vec2( vHairV.y * 0.6 + vHairV.z * 5.37, min( hv, 1.0 ) * mix( 0.88, 0.6, hTail ) ) );
float hEdge = smoothstep( 0.0, 0.3, vHairV.y ) * ( 1.0 - smoothstep( 0.7, 1.0, vHairV.y ) );   // (the card's sides thin out: no straight edges)
float hFore = step( 0.5, vHairV.w ) * step( vHairV.w, 1.5 );
float hFan = step( 2.1, vHairV.w ) * step( vHairV.w, 2.4 );
float hPx = length( vViewPosition ) * uPx;
float hA = tx.a * mix( 1.0, hEdge, 0.9 + 0.1 * hAlong ) * ( 1.0 - smoothstep( 0.8 + 0.17 * tx.r, 1.0, hv ) );
hA *= smoothstep( 0.0, mix( 0.16, 0.05, hTail ), hAlong );                 // (and fade in from the root: no straight top edge)
hA *= 1.0 - hFore * smoothstep( 0.35, 1.0, hAlong );                      // (the forelock fades out toward its tips)
hA *= 1.0 - 0.35 * hFan;                                                   // (the tail's outer fan: lighter)
hA = clamp( hA * ( 1.0 + 2.0 * smoothstep( 0.002, 0.02, hPx ) ), 0.0, 1.0 );   // (far off, the picture's smaller copies thin the hair out: thicken it back)
// a smooth ramp, not a hard cut: alpha to coverage turns it into a dithered, soft edge
float hairAlpha = smoothstep( 0.12, 0.62, hA );
diffuseColor.a = hairAlpha;
// the colour: the recipe's, strand by strand (from the picture), darker at the roots and lighter at the tips
float hStrand = tx.r;
vec3 hc = uManeCol * ( 1.0 + uHair.z * ( hStrand - 0.6 ) * 1.3 );
hc *= mix( 1.0 - uHair.x, 1.0 + uHair.y, smoothstep( 0.0, 1.0, hAlong ) );
// pinto white where the strand grows from white skin (judged at its root, moved a little strand by strand, so a mane
// goes from dark to white over a ragged stretch, not on a straight cut; whole strands, no outlines)
vec3 hRootP = ( hTail > 0.5 ? TAIL_ROOT : vRootR ) + NECK_A * ( hStrand - 0.55 ) * 0.14 + vec3( 0.0, ( vHairV.z - 0.5 ) * 0.06, 0.0 );
vec3 hRootN = hTail > 0.5 ? normalize( vec3( 0.0, 0.25, -1.0 ) ) : ( vHairV.w > 0.5 && vHairV.w < 1.5 ? FACE_F : normalize( vec3( 0.35, 0.9, 0.0 ) ) );
float hW = whiteAt( hRootP, hRootN, hTail, vHairV.w > 0.5 && vHairV.w < 1.5 ? 1.0 : 0.0, 0.5, 1.0 - hTail );
vec3 hWhite = uWhiteCol * ( 0.9 + 0.12 * hStrand );
hc = mix( hc, hWhite, hW );
// a grey's mane: silver, white strands mixed through the dark
if ( uGrey.x > 0.001 ) hc = mix( hc, uWhiteCol * ( 0.75 + 0.3 * hStrand ), smoothstep( 0.45, 0.75, hStrand + uGrey.x * 0.25 - 0.1 ) * smoothstep( 0.2, 0.6, uGrey.x ) );
diffuseColor.rgb = hc;
// (the "parts" debug view: the cards by kind: mane red, forelock green, tail blue, far-side fringe yellow)
if ( uMask > 0.5 && uMask < 1.5 ) diffuseColor.rgb = vHairV.w < 0.5 ? vec3( 0.8, 0.05, 0.05 ) : vHairV.w < 1.5 ? vec3( 0.05, 0.8, 0.05 ) : vHairV.w < 2.5 ? vec3( 0.05, 0.1, 0.9 ) : vec3( 0.9, 0.8, 0.05 );
coatAlbedo = diffuseColor.rgb;
float hLum = dot( hc, vec3( 0.2126, 0.7152, 0.0722 ) );
furCool = vec3( 0.03, 0.036, 0.05 ) * ( 1.0 - smoothstep( 0.02, 0.1, hLum ) );
furSpec = 0.15;
furSheen = 0.2 * uFur.z;
// the highlight breaks up strand by strand: each strand's shine a little stronger or weaker, and shifted along it
furShine = uHair.w * 0.9 * ( 0.3 + 1.4 * hStrand * hStrand );
hairShift = ( hStrand - 0.55 ) * 0.7;
furShinePow = 70.0;
furEdge = 0.0;
furRough = 0.55;
`;
const HAIR_FRAG_NORMAL = /* glsl */`
#include <normal_fragment_begin>
#ifdef DOUBLE_SIDED
  normal *= faceDirection;      // (the normals are the hair's volume, not the card's face: the same from both sides)
#endif
{
  vec3 T = vStrandV - normal * dot( vStrandV, normal );
  T = dot( T, T ) > 1e-6 ? normalize( T ) : vStrandV;
  furT = normalize( T + normal * hairShift );
}
`;

export function hairMaterial(shape, coatU, renderer) {
  const u = { ...coatU, uHairTex: { value: hairTexture(renderer) }, uTime: { value: 0 }, uSpeed: { value: 0 }, uBackW: { value: new THREE.Vector3(0, 0, -1) }, uDockW: { value: new THREE.Vector3() }, uDockR: { value: (shape.bones.Tail1 || shape.bones.Tail2).clone() } };
  const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, alphaTest: 0.04, roughness: 0.55, metalness: 0 });
  m.alphaToCoverage = true;
  m.name = 'hair';
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + HAIR_VERT_PARS)
      .replace('#include <skinnormal_vertex>', '#include <skinnormal_vertex>\n' + HAIR_VERT_MAIN)
      .replace('#include <project_vertex>', HAIR_PROJECT);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HAIR_FRAG_PARS + COMMON.replace('SHAPE_CONSTANTS', shape.glsl))
      .replace('#include <lights_physical_pars_fragment>', LIGHT_HOOK)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + HAIR_FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = furRough;')
      .replace('#include <normal_fragment_begin>', HAIR_FRAG_NORMAL)
      // (three.js sets an opaque material's alpha to 1 just before writing it, which would leave alpha to coverage
      // nothing to work with: put the hair's own back)
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a = hairAlpha;');
  };
  m.customProgramCacheKey = () => 'horsehair:' + shape.key;
  m.hair = { uniforms: u };
  return m;
}

export function attachHair(body, geometry, material) {
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = 'hair';
  mesh.bind(body.skeleton, body.bindMatrix);
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
  body.parent.add(mesh);
  return mesh;
}
