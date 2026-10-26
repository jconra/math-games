// INDOORS, THE VALLEY LEFT UNDRAWN WHEN NO WINDOW IS IN VIEW: inside the walk-in cabin, facing a log wall, the whole
// valley behind it was still drawn (about 500 draws on the gaming tier, the same as outdoors). Where the room's
// openings are (its windows, its doorway) is found once, by rays from the middle of the room out through points on its
// four walls (a point whose ray meets no log is an opening); then, each frame inside, while none of those points is
// on screen (with a margin round the edges), the camera's far limit is pulled in to just past the room, so everything
// outside is left out by the usual out-of-view check. The moment an opening comes near the edge of the screen the far
// limit goes back out, before any of the outside could show through it, so nothing ever pops in view. And all the while
// inside, the valley's shadows (most of the draws: the sun's shadow pass draws everything that casts one, wherever the
// camera looks) are drawn again a few times a second instead of every frame (INDOOR.shadowEvery): the sun moves slowly,
// the room is still, and what moves outside is seen small through a window.
//
//   const I = makeIndoor({ R, camera, renderer })   R: the cabin (src/cabin/interior.js makeHome)
//   I.prepare(ms)        a little more of the finding of the openings (up to ms a frame while the cabin is near; all
//                        told some tens of ms)
//   I.ready              the openings found
//   I.update(inside, dt) each frame after the camera is placed; inside false: the far limit and the shadows as they were
//   I.state()            for rigs: { ready, holes, culled }
import * as THREE from 'three';

export const INDOOR = {
  step: 0.1,          // m between the points tried on each wall (finer than a window pane between its bars)
  low: 0.4, high: 2.7,    // m over the floor the points go from and to (the windows and the doorway are in between)
  past: 0.7,          // m past the wall a ray has to get with nothing in its way to call it an opening
  margin: 1.25,       // how far past the screen's edges an opening still counts as in view (1 = the edge itself)
  far: 14,            // m: the camera's far limit while no opening is in view (the room fits well inside it)
  shadowEvery: [0.25, 0.5],   // s between the shadows drawn again inside: a window in view, none in view
};

export function makeIndoor({ R, camera, renderer = null }) {
  const I = { ready: false };
  const meshes = [];
  R.cabin.traverse((o) => {
    if (!o.isMesh) return;
    for (let q = o; q; q = q.parent) if (/door|sign/i.test(q.name || '')) return;   // (the door swings: its gap counts as open)
    meshes.push(o);
  });
  // the room: the inside surfaces' box, in the cabin's own frame
  const box = new THREE.Box3(), v = new THREE.Vector3(), inv = new THREE.Matrix4().copy(R.group.matrixWorld).invert(), m = new THREE.Matrix4();
  R.group.updateMatrixWorld(true);
  for (const o of meshes) {
    const names = [].concat(o.material).map((x) => (x && x.name) || '').join(' ');
    if (!/inside/.test(names)) continue;
    o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; m.multiplyMatrices(inv, o.matrixWorld);
    for (let k = 0; k < 8; k++) box.expandByPoint(v.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(m));
  }
  // the points tried: on each wall a grid, INDOOR.step apart, from INDOOR.low to INDOOR.high over the floor; the rays
  // all start from the room's middle at eye height
  const holes = [], walls = [];
  const c = box.isEmpty() ? null : box.getCenter(new THREE.Vector3());
  if (c) {
    const S = INDOOR.step, y0 = box.min.y, ys = [];
    c.y = y0 + 1.6;
    for (let y = y0 + INDOOR.low; y <= y0 + INDOOR.high; y += S) ys.push(y);
    const along = (lo, hi) => { const a = []; for (let u = lo + S / 2; u < hi; u += S) a.push(u); return a; };
    // a wall: its axis (0 x, 2 z), where it stands on that axis, the axis along it (u) and its points' u and y
    for (const [ax, w] of [[2, box.min.z], [2, box.max.z], [0, box.min.x], [0, box.max.x]]) {
      const ua = ax === 2 ? 0 : 2, us = ax === 2 ? along(box.min.x, box.max.x) : along(box.min.z, box.max.z);
      walls.push({ ax, w, ua, us, ys, shut: new Uint8Array(us.length * ys.length) });
    }
  }
  const total = walls.reduce((n, W) => n + W.shut.length, 0);
  // HOW THE OPENINGS ARE FOUND: a point on a wall is an opening when the ray from the room's middle to it, and on
  // INDOOR.past metres past it, meets nothing. Rather than cast that many rays (each one tested against every triangle
  // of the cabin, some 4,500 rays by 15,000 triangles: seconds of work), each triangle is drawn once onto each wall as
  // seen from the room's middle (cut where it passes behind the middle), and every wall point it covers is tested
  // against that one triangle: the same answer as the rays (the same faces count: a one-sided face only from its front,
  // as the ray caster has it), in a few tens of milliseconds.
  const tris = [];   // (the meshes still to draw: [mesh, the cabin's frame from its own, flipped, side per triangle])
  if (c) {
    const inv = new THREE.Matrix4().copy(R.group.matrixWorld).invert();
    for (const o of meshes) {
      const mm = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      const g = o.geometry, ix = g.index, n = ix ? ix.count : g.attributes.position.count;
      const mats = [].concat(o.material), groups = Array.isArray(o.material) && g.groups.length ? g.groups : [{ start: 0, count: n, materialIndex: 0 }];
      for (const gr of groups) {
        const mat = mats[gr.materialIndex]; if (!mat) continue;
        tris.push({ o, mm, flip: mm.determinant() < 0, side: mat.side, at: Math.max(0, gr.start), end: Math.min(n, gr.start + gr.count) });
      }
    }
  }
  const pastL = INDOOR.past / (R.group.matrixWorld.getMaxScaleOnAxis() || 1);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C3 = new THREE.Vector3(), nrm = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const P = [A, B, C3], poly = new Float64Array(4 * 2), tv = new Float64Array(3), clip = new Float64Array(4 * 3);
  const T_MIN = 0.005;   // (how far toward a wall from the middle a triangle has to be to be drawn on it)
  function drawOn(W, side) {
    const { ax, w, ua, us, ys, shut } = W, ca = c.getComponent(ax), cu = c.getComponent(ua), cy = c.y, span = w - ca;
    // the triangle cut to the part in front of the middle (toward this wall): up to 4 corners
    let k = 0;
    for (let i = 0; i < 3; i++) tv[i] = (P[i].getComponent(ax) - ca) / span;
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3, a = P[i], b = P[j], ta = tv[i], tb = tv[j];
      if (ta >= T_MIN) { clip[k * 3] = a.getComponent(ua); clip[k * 3 + 1] = a.y; clip[k * 3 + 2] = ta; k++; }
      if ((ta >= T_MIN) !== (tb >= T_MIN)) {
        const f = (T_MIN - ta) / (tb - ta);
        clip[k * 3] = a.getComponent(ua) + (b.getComponent(ua) - a.getComponent(ua)) * f; clip[k * 3 + 1] = a.y + (b.y - a.y) * f; clip[k * 3 + 2] = T_MIN; k++;
      }
    }
    if (k < 3) return;
    // seen from the middle, onto the wall
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < k; i++) {
      const t = clip[i * 3 + 2], u = cu + (clip[i * 3] - cu) / t, v = cy + (clip[i * 3 + 1] - cy) / t;
      poly[i * 2] = u; poly[i * 2 + 1] = v;
      if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    let area = 0; for (let i = 0; i < k; i++) { const j = (i + 1) % k; area += poly[i * 2] * poly[j * 2 + 1] - poly[j * 2] * poly[i * 2 + 1]; }
    if (Math.abs(area) < 1e-12) return;   // (edge on: no ray meets it)
    const sg = area > 0 ? 1 : -1, S = INDOOR.step;
    const i0 = Math.max(0, Math.ceil((u0 - us[0]) / S - 1e-9)), i1 = Math.min(us.length - 1, Math.floor((u1 - us[0]) / S + 1e-9));
    const j0 = Math.max(0, Math.ceil((v0 - ys[0]) / S - 1e-9)), j1 = Math.min(ys.length - 1, Math.floor((v1 - ys[0]) / S + 1e-9));
    if (i0 > i1 || j0 > j1) return;
    const nc = nrm.dot(c), nk = nrm.dot(A) - nc;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cell = j * us.length + i; if (shut[cell]) continue;
      const u = us[i], v = ys[j];
      let inside = true;
      for (let q = 0; q < k && inside; q++) { const r = (q + 1) % k; if (((poly[r * 2] - poly[q * 2]) * (v - poly[q * 2 + 1]) - (poly[r * 2 + 1] - poly[q * 2 + 1]) * (u - poly[q * 2])) * sg < -1e-12) inside = false; }
      if (!inside) continue;
      // the ray from the middle to this point: which way it meets the face, and how far along
      const dx = (ua === 0 ? u : w) - c.x, dy = v - cy, dz = (ua === 2 ? u : w) - c.z;
      const dn = nrm.x * dx + nrm.y * dy + nrm.z * dz;
      if (dn === 0 || (side === THREE.FrontSide && dn > 0) || (side === THREE.BackSide && dn < 0)) continue;
      const s = nk / dn, len = Math.hypot(dx, dy, dz);
      if (s > 0 && s <= 1 + pastL / len) shut[cell] = 1;
    }
  }
  let tri = 0, ti = 0;
  I.prepare = (ms = 2) => {
    if (I.ready) return;
    const t0 = performance.now();
    while (ti < tris.length) {
      const T = tris[ti], g = T.o.geometry, ix = g.index, pos = g.attributes.position;
      if (tri < T.at) tri = T.at;
      for (; tri + 2 < T.end; tri += 3) {
        for (let q = 0; q < 3; q++) P[q].fromBufferAttribute(pos, ix ? ix.getX(tri + q) : tri + q).applyMatrix4(T.mm);
        nrm.crossVectors(e1.subVectors(B, A), e2.subVectors(C3, A));
        if (T.flip) nrm.negate();   // (a mirrored mesh: its faces' fronts as the ray caster sees them, in the mesh's own frame)
        for (const W of walls) drawOn(W, T.side);
        if (((tri / 3) & 63) === 0 && performance.now() - t0 >= ms) { tri += 3; return; }
      }
      ti++; tri = 0;
    }
    for (const W of walls) for (let j = 0; j < W.ys.length; j++) for (let i = 0; i < W.us.length; i++) {
      if (W.shut[j * W.us.length + i]) continue;
      const x = W.ax === 0 ? W.w : W.us[i], z = W.ax === 2 ? W.w : W.us[i];
      holes.push(R.toWorld(x, W.ys[j], z));
    }
    I.ready = true;
  };
  // each frame inside: an opening on screen (or near it), or not
  const pv = new THREE.Vector3();
  let farWas = null, culled = false, shadowT = 0, shadowsHeld = false;
  const sm = renderer && renderer.shadowMap;
  I.update = (inside, dt = 0) => {
    let cull = false;
    if (inside && I.ready && holes.length) {
      cull = true;
      camera.updateMatrixWorld();
      const M = INDOOR.margin;
      for (const h of holes) {
        pv.copy(h).applyMatrix4(camera.matrixWorldInverse);
        if (pv.z > 0.05) continue;   // (behind the camera)
        pv.applyMatrix4(camera.projectionMatrix);
        if (Math.abs(pv.x) < M && Math.abs(pv.y) < M) { cull = false; break; }
      }
    }
    if (cull && !culled) { farWas = camera.far; camera.far = INDOOR.far; camera.updateProjectionMatrix(); culled = true; }
    else if (!cull && culled) { camera.far = farWas; camera.updateProjectionMatrix(); culled = false; }
    if (sm) {
      if (inside && !shadowsHeld) { shadowsHeld = true; sm.autoUpdate = false; shadowT = 0; }
      else if (!inside && shadowsHeld) { shadowsHeld = false; sm.autoUpdate = true; }
      if (shadowsHeld && (shadowT -= dt) <= 0) { shadowT = INDOOR.shadowEvery[culled ? 1 : 0]; sm.needsUpdate = true; }
    }
  };
  I.state = () => ({ ready: I.ready, holes: holes.length, tried: I.ready ? total : 0, of: total, culled, holeAt: (i) => holes[i] });
  return I;
}
