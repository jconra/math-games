// THE CREW LAB'S SWEEPS (2026-11-15; the game's maker: "you can always feel free to use the same method to look for
// problems too, such as making sure necks are centered in collars and heads aren't poking through hair"). Two
// measurements of one person, each made at the outfit's rest (the bones as they were before any clip: a Line-up tile's
// person keeps them, c.rest), in the Head bone's frame (metres; x their left, y up, z forward), the frame the kit's
// collar is measured in (kit/crew.js THE COLLAR FIT). Used by the sweep rigs (~/pw/space-math/rigs/crewlab-lineup/
// sweep.cjs), which walk the Line-ups; nothing in the lab calls them.
//   neckOf(c)  THE NECK IN ITS COLLAR: the neck where it comes out of the collar (its points the Head bone carries
//              under half of, from the collar's rim to 10 mm above it, each way round) against the collar's outside
//              there. Each of 72 steps round: the gap from the neck's outside to the collar's outside (mm; under 0 the
//              neck stands out past the collar there: the 2026-11-15 picture, a neck too far back, out through the back
//              of the collar). Returns { front, back, left, right } (the least gap within 30 degrees of each way, mm;
//              the front's often the chin over a high collar, not the neck), least and leastAt (the least gap round the
//              sides and the back, 45 degrees off ahead and further, and where: degrees, 0 ahead, 90 their left, 180 behind),
//              forward (mm the head would come forward to even the front and the back: (front - back) / 2) and side
//              (mm to their left to even the sides), or null (no collar, no neck: a helmet, an open collar)
//   pokeOf(c)  THE HEAD THROUGH ITS HAIR: every scalp point the hair covers (looked at from the skull's centre: the hair
//              there in every direction round it, 3 degree steps, so the hair's edge doesn't count; the ears left out),
//              against the hair's inner layer and its outside in that direction. Returns { points (scalp points under
//              hair), inner (points out past the inner layer by over 1 mm), innerMm (the most), outer (points out past
//              the hair's outside by over 0.5 mm: skin showing through), outerMm, worst: [azimuth, elevation] of the
//              deepest } or null (no hair mesh)
import * as THREE from 'three';

const _v = new THREE.Vector3(), F = new THREE.Matrix4();
const DEG = 180 / Math.PI;
// (a person's bones put at rest for a measurement, and back as they were after)
function atRest(c, fn) {
  if (!c.rest) throw new Error('sweeps: a person with no rest kept (a Line-up tile\'s person keeps it)');
  const was = c.rest.map(([b]) => [b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
  for (const [b, p, q, s] of c.rest) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(s); }
  c.root.updateMatrixWorld(true);
  try { return fn(); } finally { c.rest.forEach(([b], i) => { b.position.copy(was[i][0]); b.quaternion.copy(was[i][1]); b.scale.copy(was[i][2]); }); c.root.updateMatrixWorld(true); }
}
// (a skinned mesh's points at the pose now, in the Head bone's frame; and how much of each the Head bone carries)
function pointsOf(m, head, withShare) {
  const n = m.geometry.attributes.position.count, P = new Float32Array(n * 3);
  F.copy(head.matrixWorld).invert();
  for (let i = 0; i < n; i++) { m.getVertexPosition(i, _v); _v.applyMatrix4(m.matrixWorld).applyMatrix4(F).toArray(P, i * 3); }
  if (!withShare) return { P, n };
  const bones = m.skeleton.bones, rides = bones.map((b) => { for (let p = b; p; p = p.parent) if (p === head) return true; return false; });
  const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, HW = new Float32Array(n);
  for (let i = 0; i < n; i++) { let w = 0; for (let k = 0; k < 4; k++) if (rides[si.getComponent(i, k)]) w += sw.getComponent(i, k); HW[i] = w; }
  return { P, n, HW };
}

export function neckOf(c) {
  const C = c.collar, m = c.meshes.head;
  if (!C || !m || c.meshes.visor) return null;
  return atRest(c, () => {
    const { P, n, HW } = pointsOf(m, c.bones.Head, true), nt = C.nt;
    const NR = new Float32Array(nt).fill(-Infinity), WL = new Float32Array(nt).fill(Infinity);
    // (the collar's centre on its rim's highest level; each step round its rim, and its outside there)
    const top = Math.max(...C.rim), kt = Math.min(C.ny - 1, Math.round((top - C.y0) / C.step)), cx = C.cx[kt], cz = C.cz[kt];
    for (let j = 0; j < nt; j++) if (C.rim[j] > -Infinity) WL[j] = C.wall[Math.min(C.ny - 1, Math.round((C.rim[j] - C.y0) / C.step))][j];
    // (the neck's skin sliced level by level, every 5 mm as the collar is, each slice sampled along its length: the
    // farthest out each step round, from each step's rim to 10 mm above it)
    const I = m.geometry.index, cnt = I ? I.count : n, lo = Math.min(...C.rim.filter((v) => v > -Infinity)), hi = top + 0.010, pts = [];
    for (let t = 0; t + 2 < cnt; t += 3) {
      const ia = I ? I.getX(t) : t, ib = I ? I.getX(t + 1) : t + 1, ic = I ? I.getX(t + 2) : t + 2;
      if ((HW[ia] + HW[ib] + HW[ic]) / 3 >= 0.5) continue;
      const ya = P[ia * 3 + 1], yb = P[ib * 3 + 1], yc = P[ic * 3 + 1], y0 = Math.min(ya, yb, yc), y1 = Math.max(ya, yb, yc);
      if (y1 < lo || y0 > hi) continue;
      for (let k = Math.max(0, Math.ceil((Math.max(y0, lo) - C.y0) / 0.0025)); C.y0 + k * 0.0025 <= Math.min(y1, hi); k++) {
        const y = C.y0 + k * 0.0025; pts.length = 0;
        for (const [u, v] of [[ia, ib], [ib, ic], [ic, ia]]) {
          const yu = P[u * 3 + 1], yv = P[v * 3 + 1]; if ((yu - y) * (yv - y) > 0 || yu === yv) continue;
          const f = (y - yu) / (yv - yu); pts.push(P[u * 3] + (P[v * 3] - P[u * 3]) * f, P[u * 3 + 2] + (P[v * 3 + 2] - P[u * 3 + 2]) * f);
        }
        if (pts.length < 4) continue;
        const kk = Math.min(C.ny - 1, Math.max(0, Math.round((y - C.y0) / C.step)));
        for (let q = 0; q <= 4; q++) {
          const x = pts[0] + (pts[2] - pts[0]) * q / 4, z = pts[1] + (pts[3] - pts[1]) * q / 4, dx = x - C.cx[kk], dz = z - C.cz[kk];
          const j = Math.floor((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI) * nt) % nt;
          if (!(C.rim[j] > -Infinity) || y < C.rim[j] || y > C.rim[j] + 0.010) continue;
          NR[j] = Math.max(NR[j], Math.hypot(dx, dz));
        }
      }
    }
    const gap = Array.from(NR, (r, j) => (r > -Infinity && WL[j] < Infinity ? (WL[j] - r) * 1000 : null));
    const at = (j) => Math.round(-180 + (j + 0.5) * 360 / nt);
    // (the least within 30 degrees of a way: 0 ahead, 90 their left, 180 behind, -90 their right)
    const way = (d) => { let m0 = null; for (let j = 0; j < nt; j++) { const a = Math.abs(((at(j) - d + 540) % 360) - 180); if (a <= 30 && gap[j] != null) m0 = m0 == null ? gap[j] : Math.min(m0, gap[j]); } return m0; };
    const front = way(0), back = way(180), left = way(90), right = way(-90);
    // (the least all round but the front, where the chin may stand over a high collar: the sides and the back)
    let least = null, leastAt = null; gap.forEach((g, j) => { if (g != null && Math.abs(at(j)) > 45 && (least == null || g < least)) { least = g; leastAt = at(j); } });
    if (least == null) return null;
    const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
    return { front: r1(front), back: r1(back), left: r1(left), right: r1(right), least: r1(least), leastAt,
      forward: front != null && back != null ? r1((front - back) / 2) : null, side: left != null && right != null ? r1((left - right) / 2) : null,
      round: gap.filter((g) => g != null).length, centre: [cx, cz] };
  });
}

const STEP = 3, NA = 360 / STEP, NE = 180 / STEP;
export function pokeOf(c) {
  const hm = c.meshes.head, hairs = []; c.root.traverse((o) => { if (o.isSkinnedMesh && o.userData.part === 'hair') hairs.push(o); });
  if (!hm || !hairs.length) return null;
  return atRest(c, () => {
    const head = c.bones.Head, H = pointsOf(hm, head, true);
    // (the skull's centre: the middle of the head's top 12 cm, side to side and front to back, 9 cm under its top)
    let x0 = Infinity, x1 = -Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < H.n; i++) if (H.HW[i] > 0.5) y1 = Math.max(y1, H.P[i * 3 + 1]);
    for (let i = 0; i < H.n; i++) { if (H.HW[i] <= 0.5 || H.P[i * 3 + 1] < y1 - 0.12) continue; x0 = Math.min(x0, H.P[i * 3]); x1 = Math.max(x1, H.P[i * 3]); z0 = Math.min(z0, H.P[i * 3 + 2]); z1 = Math.max(z1, H.P[i * 3 + 2]); }
    const O = [(x0 + x1) / 2, y1 - 0.09, (z0 + z1) / 2];
    const bin = (x, y, z) => {
      const dx = x - O[0], dy = y - O[1], dz = z - O[2], r = Math.hypot(dx, dy, dz);
      const a = Math.floor(((Math.atan2(dx, dz) * DEG + 360) % 360) / STEP) % NA, e = Math.min(NE - 1, Math.floor((Math.asin(Math.max(-1, Math.min(1, dy / r))) * DEG + 90) / STEP));
      return [e * NA + a, r];
    };
    const lo = new Float32Array(NA * NE).fill(Infinity), hi = new Float32Array(NA * NE).fill(-Infinity);
    const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
    for (const m of hairs) {
      const { P } = pointsOf(m, head, false), I = m.geometry.index, cnt = I ? I.count : P.length / 3;
      for (let t = 0; t + 2 < cnt; t += 3) {
        const ia = I ? I.getX(t) : t, ib = I ? I.getX(t + 1) : t + 1, ic = I ? I.getX(t + 2) : t + 2;
        A.fromArray(P, ia * 3); B.fromArray(P, ib * 3); Cc.fromArray(P, ic * 3);
        // (each triangle sampled about every 1.5 mm)
        const L = Math.max(A.distanceTo(B), B.distanceTo(Cc), Cc.distanceTo(A)), k = Math.min(40, Math.max(1, Math.ceil(L / 0.0015)));
        for (let u = 0; u <= k; u++) for (let v = 0; v <= k - u; v++) {
          const w = k - u - v, x = (A.x * u + B.x * v + Cc.x * w) / k, y = (A.y * u + B.y * v + Cc.y * w) / k, z = (A.z * u + B.z * v + Cc.z * w) / k;
          const [b, r] = bin(x, y, z); if (r < lo[b]) lo[b] = r; if (r > hi[b]) hi[b] = r;
        }
      }
    }
    // (covered: the hair there and in every direction round it)
    const covered = (b) => { const e = Math.floor(b / NA), a = b % NA; for (let de = -1; de <= 1; de++) for (let da = -1; da <= 1; da++) { const ee = e + de; if (ee < 0 || ee >= NE) return false; if (!(lo[ee * NA + ((a + da + NA) % NA)] < Infinity)) return false; } return true; };
    const out = { points: 0, inner: 0, innerMm: 0, outer: 0, outerMm: 0, worst: null, centre: O };
    for (let i = 0; i < H.n; i++) {
      if (H.HW[i] < 0.5) continue;
      const x = H.P[i * 3], y = H.P[i * 3 + 1], z = H.P[i * 3 + 2], [b, r] = bin(x, y, z);
      if (!covered(b)) continue;
      // (the ears left out: to either side, below 20 degrees up)
      const az = Math.atan2(x - O[0], z - O[2]) * DEG, el = Math.asin((y - O[1]) / r) * DEG;
      if (Math.abs(Math.abs(az) - 90) < 35 && el < 20) continue;
      out.points++;
      const di = (r - lo[b]) * 1000, dout = (r - hi[b]) * 1000;
      if (di > 1) { out.inner++; out.innerMm = Math.max(out.innerMm, di); }
      if (dout > 0.5) { out.outer++; if (dout > out.outerMm) { out.outerMm = dout; out.worst = [Math.round(az), Math.round(el)]; } }
    }
    out.innerMm = Math.round(out.innerMm * 10) / 10; out.outerMm = Math.round(out.outerMm * 10) / 10;
    return out;
  });
}
