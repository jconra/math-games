// THE MANE AND TAIL: hair cards. A few dozen narrow strips laid over the neck and hanging from the dock, each drawn
// with a picture of hair strands (drawn in code: strands of different lengths and shades, solid at the roots, ragged at
// the tips) whose see-through gaps are cut by alpha (with alpha to coverage, so the cut edges are smoothed by the
// screen's multisampling). Every corner of every card is skinned to the bones under it (the mane to the neck's and the
// head's, as the body is there; the tail down the tail's chain), so they move with every clip, and the vertex shader
// adds a little life on top: a tail held out stiff by a clip sags under its own weight and streams back at speed, and
// both ripple. Colour, length and pinto white come from the coat recipe, the same code as the coat (coat.js COMMON).
//
//   buildHair(shape) -> { geometry, tris, cards }     once per model (shape from prepareHorse)
//   hairMaterial(shape, coatUniforms) -> material     per horse: shares the coat's uniforms, so a new recipe recolours both
//   attachHair(body, geometry, material) -> mesh      a skinned mesh on the body's own skeleton (one more draw)
//   material.hair.uniforms.uTime / uSpeed / uBackW    per frame: the clock, how fast the horse is going (m/s), and
//                                                     which way is behind it (world)
import * as THREE from 'three';
import { COMMON, LIGHT_HOOK } from './coat.js';

export const HAIR = {
  mane: { cards: 18, rows: 6, length: 0.42, width: [0.075, 0.1], lift: [0.008, 0.03] },   // down the near side of the neck
  crest: { cards: 9, rows: 3, length: 0.09, width: [0.07, 0.08], lift: [0.006, 0.015] },   // a short fringe on the far side
  forelock: { cards: 3, rows: 5, length: 0.2, width: [0.05, 0.07], lift: [0.006, 0.016] },
  tail: { cards: 16, centre: 3, rows: 7, end: 0.5, width: [0.08, 0.15], radius: [0.045, 0.1] },                    // the tail reaches about the hocks
};
const KIND = { mane: 0, forelock: 1, tail: 2, crest: 3 };
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
        out.root.push(root.x, root.y, root.z);
      }
      if (k > 0) { const i0 = base + (k - 1) * 2; out.index.push(i0, i0 + 1, i0 + 3, i0, i0 + 3, i0 + 2); }
    });
    cards++;
  }
  // skinned as the body is at the nearest corner
  const skinBody = (r) => { const v = r.v; return { i: [SI.getComponent(v, 0), SI.getComponent(v, 1), SI.getComponent(v, 2), SI.getComponent(v, 3)], w: [SW.getComponent(v, 0), SW.getComponent(v, 1), SW.getComponent(v, 2), SW.getComponent(v, 3)] }; };
  // a strand laid over the body: from a start, down with gravity (pushed off to one side at first, and a little back or
  // forward), each step put back onto the body's surface and lifted off it a little more toward the tip
  function drape(start, cfg, { side = 1, push = 0.7, back = 0.15, len = cfg.length, filter = notTail } = {}) {
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
      rows.push({ c: p.clone(), n, v, w: cfg.width[0] + (cfg.width[1] - cfg.width[0]) * s });
    }
    const wave = (R() - 0.5) * 0.03, ph = R() * 6.28;
    rows.forEach((r, k) => {
      const a = (k < rows.length - 1 ? rows[k + 1].c.clone().sub(r.c) : r.c.clone().sub(rows[k - 1].c)).normalize();
      r.across = new THREE.Vector3().crossVectors(r.n, a).normalize();
      const s = k / (rows.length - 1);
      r.c.addScaledVector(r.across, wave * Math.sin(s * 2.6 + ph) * s);    // (each lock swings a little to one side)
    });
    return rows;
  }

  // THE MANE: along the crest from the withers to the poll, falling down the near (left) side, with a short fringe on
  // the far side so the crest is covered from both sides
  const { neckO, neckA, neckL, up, midX, withersT } = shape;
  const rest = shape.rest, n = rest.length / 3, neckV = [];
  for (let v = 0; v < n; v++) {
    if (shape.W.legs[v] + shape.W.tail[v] > 0.3 || shape.W.ear[v] > 0.2 || Math.abs(rest[v * 3] - midX) > 0.07) continue;
    const d = S.pos(v).sub(neckO), t = d.dot(neckA); if (t < withersT - 0.05 || t > neckL - 0.02) continue;
    neckV.push([v, t, d.dot(up)]);
  }
  const crestPoint = (t) => { let best = -1, bh = -9; for (const [v, tv, h] of neckV) if (Math.abs(tv - t) < 0.03 && h > bh) { bh = h; best = v; } return best; };
  const t0 = withersT + 0.04, t1 = neckL - 0.07;
  for (let i = 0; i < HAIR.mane.cards; i++) {
    const t = t0 + (t1 - t0) * (i + 0.5 * R()) / HAIR.mane.cards, v = crestPoint(t); if (v < 0) continue;
    const start = S.pos(v).addScaledVector(V(1, 0, 0), 0.008);
    const len = HAIR.mane.length * (0.7 + 0.3 * Math.sin(Math.PI * Math.min(1, (t - t0) / (t1 - t0) * 1.15))) * (0.78 + 0.34 * R());
    card(drape(start, HAIR.mane, { side: 1, push: 0.9, back: 0.12, len }), 'mane', skinBody);
  }
  for (let i = 0; i < HAIR.crest.cards; i++) {
    const t = t0 + (t1 - t0) * (i + 0.5) / HAIR.crest.cards, v = crestPoint(t); if (v < 0) continue;
    card(drape(S.pos(v).addScaledVector(V(1, 0, 0), -0.004), HAIR.crest, { side: -1, push: 1.0, back: 0.1 }), 'crest', skinBody);
  }
  // THE FORELOCK: from between the ears, down over the forehead
  const head = (v) => shape.W.head[v] > 0.5 && shape.W.ear[v] < 0.15;
  for (let i = 0; i < HAIR.forelock.cards; i++) {
    const dx = (i - (HAIR.forelock.cards - 1) / 2) * 0.022;
    const v = S.nearest(V(midX + dx, shape.poll.y + 0.03, shape.poll.z + 0.07), head); if (v < 0) continue;
    const rows = drape(S.pos(v), HAIR.forelock, { side: Math.sign(dx) || 0.001, push: 0.2, back: -0.5, filter: head, len: HAIR.forelock.length * (0.85 + 0.3 * R()) });
    card(rows, 'forelock', skinBody);
  }

  // THE TAIL: strands rooted round the dock, hanging down the tail's chain of bones and on below its last bone to about
  // the hocks, fanning out a little toward the ends; skinned along the chain
  const B = shape.bones, chainNames = ['Tail1', 'Tail2', 'Tail3', 'Tail4', 'Tail5', 'Tail6', 'Tail7'].filter((nm) => B[nm]);
  const chain = chainNames.map((nm) => B[nm].clone()), last = chain[chain.length - 1];
  const end = V(last.x, Math.min(HAIR.tail.end, last.y - 0.1), last.z - 0.04);
  const pts = [...chain, end], cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = cum[cum.length - 1];
  const at = (s) => {   // a place along the chain, 0..1: point, direction, and the bones round it
    const d = s * total; let j = 0; while (j < pts.length - 2 && cum[j + 1] < d) j++;
    const f = Math.min(1, Math.max(0, (d - cum[j]) / (cum[j + 1] - cum[j])));
    const p = pts[j].clone().lerp(pts[j + 1], f), dir = pts[j + 1].clone().sub(pts[j]).normalize();
    const bi = (k) => names.indexOf(chainNames[Math.min(k, chainNames.length - 1)]);
    const sk = j + 1 < chainNames.length ? { i: [bi(j), bi(j + 1), 0, 0], w: [1 - f, f, 0, 0] } : { i: [bi(chainNames.length - 1), 0, 0, 0], w: [1, 0, 0, 0] };
    return { p, dir, sk };
  };
  const X = V(1, 0, 0);
  const tailCard = (phi, s0, plane, endJit) => {
    const rows = [], N = HAIR.tail.rows;
    for (let k = 0; k < N; k++) {
      const a = k / (N - 1), s = s0 + (1 - s0) * a * endJit, P = at(s);
      let b1 = new THREE.Vector3().crossVectors(P.dir, X).normalize(); if (b1.z > 0) b1.negate();   // (pointing away from the rump)
      const radial = b1.clone().multiplyScalar(Math.cos(phi)).addScaledVector(X, Math.sin(phi));
      const r = HAIR.tail.radius[0] + (HAIR.tail.radius[1] - HAIR.tail.radius[0]) * a;
      const c = P.p.clone().addScaledVector(radial, plane ? r * 0.3 : r);
      const across = plane ? radial.clone() : new THREE.Vector3().crossVectors(radial, P.dir).normalize();
      rows.push({ c, n: radial, across, w: HAIR.tail.width[0] + (HAIR.tail.width[1] - HAIR.tail.width[0]) * a, sk: P.sk });
    }
    card(rows, 'tail', (r) => r.sk);
  };
  for (let i = 0; i < HAIR.tail.cards; i++) {
    const phi = -2.2 + 4.4 * (i + 0.3 + 0.4 * R()) / HAIR.tail.cards;
    tailCard(phi, 0.06 + 0.22 * R(), false, 0.9 + 0.1 * R());
  }
  for (let i = 0; i < HAIR.tail.centre; i++) tailCard((i - 1) * 0.9, 0.08 + 0.1 * R(), true, 0.95 + 0.05 * R());

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
attribute vec3 aRoot;     // where its root is, at rest (for its colour and pinto white)
uniform float uTime;
uniform float uSpeed;
uniform vec3 uBackW;
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
  float len = mix( 0.32, 0.85, isTail );
  vec3 sdW = normalize( ( modelMatrix * vec4( hairStrand, 0.0 ) ).xyz );
  float sag = 1.0 - max( 0.0, -sdW.y );
  float spd = min( uSpeed, 12.0 );
  vec3 off = vec3( 0.0, -1.0, 0.0 ) * sag * a2 * len * 0.55 * isTail;
  off += uBackW * a2 * len * spd * 0.022 * isTail;
  vec3 sideW = normalize( cross( sdW, vec3( 0.0, 1.0, 0.0 ) ) + vec3( 0.0001 ) );
  float wave = sin( uTime * ( 2.0 + 0.4 * spd ) - a * 4.5 + aHair.z * 6.2832 );
  off += sideW * wave * a2 * len * ( 0.03 + 0.012 * spd ) * mix( 0.35, 1.0, isTail );
  off += vec3( 0.0, 1.0, 0.0 ) * ( 1.0 - isTail ) * a * spd * 0.0025 * ( 0.6 + 0.4 * wave );
  hairW.xyz += off;
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
vec4 tx = texture2D( uHairTex, vec2( vHairV.y * 0.6 + vHairV.z * 5.37, min( hv, 1.0 ) ) );
float hEdge = smoothstep( 0.0, 0.2, vHairV.y ) * ( 1.0 - smoothstep( 0.8, 1.0, vHairV.y ) );
float hPx = length( vViewPosition ) * uPx;
float hA = tx.a * mix( 1.0, hEdge, 0.85 ) * ( 1.0 - smoothstep( 0.97, 1.0, hv ) );
hA = clamp( hA * ( 1.0 + 2.0 * smoothstep( 0.002, 0.02, hPx ) ), 0.0, 1.0 );   // (far off, the picture's smaller copies thin the hair out: thicken it back)
diffuseColor.a = hA;
// the colour: the recipe's, strand by strand (from the picture), darker at the roots and lighter at the tips
float hStrand = tx.r;
vec3 hc = uManeCol * ( 1.0 + uHair.z * ( hStrand - 0.6 ) * 1.3 );
hc *= mix( 1.0 - uHair.x, 1.0 + uHair.y, smoothstep( 0.0, 1.0, hAlong ) );
// pinto white where the strand grows from white skin (judged at its root; whole strands, no outlines)
vec3 hRootN = hTail > 0.5 ? normalize( vec3( 0.0, 0.25, -1.0 ) ) : ( vHairV.w > 0.5 && vHairV.w < 1.5 ? FACE_F : normalize( vec3( 0.35, 0.9, 0.0 ) ) );
float hW = whiteAt( vRootR, hRootN, hTail, vHairV.w > 0.5 && vHairV.w < 1.5 ? 1.0 : 0.0, 0.5, 1.0 - hTail );
vec3 hWhite = uWhiteCol * ( 0.9 + 0.12 * hStrand );
hc = mix( hc, hWhite, hW );
// a grey's mane: silver, white strands mixed through the dark
if ( uGrey.x > 0.001 ) hc = mix( hc, uWhiteCol * ( 0.75 + 0.3 * hStrand ), smoothstep( 0.45, 0.75, hStrand + uGrey.x * 0.25 - 0.1 ) * smoothstep( 0.2, 0.6, uGrey.x ) );
diffuseColor.rgb = hc;
coatAlbedo = hc;
float hLum = dot( hc, vec3( 0.2126, 0.7152, 0.0722 ) );
furCool = vec3( 0.03, 0.036, 0.05 ) * ( 1.0 - smoothstep( 0.02, 0.1, hLum ) );
furSpec = 0.15;
furSheen = 0.2 * uFur.z;
// the highlight breaks up strand by strand: each strand's shine a little stronger or weaker, and shifted along it
furShine = uHair.w * 0.9 * ( 0.3 + 1.4 * hStrand * hStrand );
hairShift = ( hStrand - 0.55 ) * 0.7;
furShinePow = 70.0;
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
  const u = { ...coatU, uHairTex: { value: hairTexture(renderer) }, uTime: { value: 0 }, uSpeed: { value: 0 }, uBackW: { value: new THREE.Vector3(0, 0, -1) } };
  const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, alphaTest: 0.35, roughness: 0.55, metalness: 0 });
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
      .replace('#include <normal_fragment_begin>', HAIR_FRAG_NORMAL);
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
