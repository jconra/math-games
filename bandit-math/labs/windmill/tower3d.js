// DRAWING THE TOWER: one box per board (a 2x4: 3.5 by 1.5 inches, its wide face looking along its n), nail heads at
// every joint, the board being placed (and a faint sheet showing the plane it lies in), the glowing twins (where a board
// just nailed could be matched round the tower: see-through gold boards with bright edges, grey when there is no wood or
// nothing to nail them to), the wind test (each board tinted by its strain, green easy to red breaking, a coloured spot
// on every nailed joint, the frame bent by how far each board's ends move, and a red flash on a part that gives), and
// the prize on top (a windmill head with sails) once the tower stands tall enough.
// The tower's numbers are in feet (tower.js); here they become metres (FT).
//
// Where a board is drawn: its centre line lies in its plane, but boards nailed over others in the same plane sit a layer
// further out (away from the tower's middle), clear of the posts they are nailed to. A board that only rests on others
// (a beam across the top of the storey below, with the next tier's posts standing on it) sits right on its plane. Where
// a board's end meets another board's side and the two would run into each other, the end is drawn stopping at that
// board's face (a post's foot on top of the beam, a beam's end against the back of the crosspiece).
// A board in a leaning wall is drawn tilted with it: its thin side faces along the wall's normal (e_n - t·e_Y), and a
// board nailed over others is pushed out along that same normal. A leg where two walls meet is drawn on its line, as a
// post is.
import * as THREE from 'three';
import { isPost, planesOf, planeKeyOf, planeNormal, parseKey, toPlane, towerHeight, leanOf, wallsInUse, isCornerLine, wallPlanesOf } from './tower.js';
import { touch, touch3, joints3, pointGap, TOL } from './touch.js';
import { boardTexture } from './wood.js';
import { FT } from './scene.js';

const BW = 3.5 / 12, BT = 1.5 / 12;       // board width and thickness, feet
// the board in hand is drawn this far out from its plane (feet: a layer out, over the posts there), so the page puts its
// handles and circles there too
export const HELD_OFF = BW / 2 + BT / 2 + 0.01;
const V = (p) => new THREE.Vector3(p.X * FT, p.Y * FT, p.Z * FT);
// which way a board's wide face looks: its wall's normal, e_n tipped back by its lean (PLANES ARE X OR Z FAMILIES)
const nVec = (n, t = 0) => (n === 'X' ? new THREE.Vector3(1, -t, 0) : new THREE.Vector3(0, -t, 1)).normalize();
const boardN = (b) => nVec(b.n, leanOf(b));
const P3 = (n) => new THREE.Vector3(n.X, n.Y, n.Z);

// where every board is drawn: Map id -> { a, b (feet, world, the drawn ends), off (feet out from its plane), side (the
// unit vector it is pushed out along) }, and on the map itself `spacers`: the little wood blocks filling a gap between a
// board and something it is nailed to [{ at (feet, world: the block's middle), along, side (unit vectors), l, w, th
// (feet: along the board, across it, and thick) }]
// The layers on a wall: the posts and legs on the wall's own line; boards nailed over them (crosspieces, braces) one
// layer out, their faces on the posts' faces; a board steps a further layer out only where it truly crosses another
// board's middle with its own middle (the second brace of an X) or lies along one (a lap); boards that only meet at
// their ends (two braces meeting at a post, a brace's end on a crosspiece) stay side by side in the same layer, the end
// stopping at the other's face. At most two layers out. Wherever a board still sits off something it is nailed to (a
// crosspiece over a post turned the other way, the second brace of an X at the posts), a spacer block fills the gap.
const END_T = 0.3;       // feet: a touch this near a board's end is at its end (it meets there), not across its middle
const LAYER_CAP = BW / 2 + BT / 2 + BT + 0.006;   // the furthest out a board is drawn: two layers over a turned post
export function layout(t) {
  const out = new Map(), boards = t.boards, walls = wallsInUse(t), line = new Set(boards.filter((b) => isCornerLine(t, b, walls)));
  const order = new Map(boards.map((b, i) => [b, i]));
  // how far a post (or leg) reaches out from a plane's centre (its outer face): by which way it faces
  const reach = new Map();     // `${id}|${key}` -> feet
  for (const b of line) for (const k of wallPlanesOf(t, b, walls)) reach.set(b.id + '|' + k, (parseKey(k).axis === b.n ? BT : BW) / 2);
  const reachOf = (o, key) => reach.get(o.id + '|' + key) ?? 0;
  const byPlane = new Map();
  for (const b of boards) for (const k of planesOf(b)) (byPlane.get(k) || byPlane.set(k, []).get(k)).push(b);
  const mid = (tt, len) => tt > END_T && tt < len - END_T;
  // (a post standing on this board's middle is on top of it, not under it)
  const standsOn = (cs, b) => cs.every((c) => c.tj < TOL && c.ti > TOL && c.ti < b.len - TOL);
  for (const b of boards) {
    if (line.has(b)) { out.set(b.id, { a: { ...b.a }, b: { ...b.b }, off: 0, side: boardN(b) }); continue; }
    const key = planeKeyOf(b), mates = byPlane.get(key) || [], me = seg(b, key);
    let off = -1;
    for (const o of mates) {
      if (o === b) continue;
      const post = line.has(o);
      if (!post && order.get(o) > order.get(b)) continue;      // (only boards nailed before it lie under it)
      const cs = touch(me, seg(o, key)); if (!cs.length) continue;
      if (post) { if (!standsOn(cs, b)) off = Math.max(off, reachOf(o, key) + BT / 2 + 0.002); continue; }
      const Lo = out.get(o.id);
      // across its middle, or lying along it: a layer out over it; meeting at an end: beside it, in its layer
      const over = cs.length >= 2 || cs.some((c) => mid(c.ti, b.len) && mid(c.tj, o.len));
      off = Math.max(off, over ? Lo.off + BT + 0.002 : Lo.off);
    }
    out.set(b.id, { a: { ...b.a }, b: { ...b.b }, off: Math.min(Math.max(off, 0), LAYER_CAP), side: P3(planeNormal(key, (b.a.Y + b.b.Y) / 2)) });
  }
  // the spacers: every pair nailed together on a wall whose faces stand apart
  const spacers = [];
  for (const [key, mates] of byPlane) {
    for (const b of mates) {
      if (line.has(b) || planeKeyOf(b) !== key) continue;
      const Lb = out.get(b.id), me = seg(b, key);
      for (const o of mates) {
        if (o === b) continue;
        const post = line.has(o);
        if (!post && (planeKeyOf(o) !== key || order.get(o) > order.get(b))) continue;     // (each pair once)
        const cs = touch(me, seg(o, key)); if (!cs.length) continue;
        if (post && standsOn(cs, b)) continue;
        // (the inner board's outer face, and the outer board's inner face, along the wall's normal)
        let inFace, outFace, outer = b, oT = (c) => c.ti;
        if (post) { inFace = reachOf(o, key); outFace = Lb.off - BT / 2; }
        else {
          const Lo = out.get(o.id), [lo, hi] = Lo.off <= Lb.off ? [Lo, Lb] : [Lb, Lo];
          if (hi === Lo) { outer = o; oT = (c) => c.tj; }
          inFace = lo.off + BT / 2; outFace = hi.off - BT / 2;
        }
        const gap = outFace - inFace;
        if (gap < 0.006) continue;
        const Lout = out.get(outer.id), d = new THREE.Vector3(outer.b.X - outer.a.X, outer.b.Y - outer.a.Y, outer.b.Z - outer.a.Z).normalize();
        const l = Math.min(BW, outer.len), w = BW * 0.9;
        for (const c of cs) {
          // (centred on the joint, kept within the outer board's length)
          const tt = Math.max(l / 2, Math.min(outer.len - l / 2, oT(c)));
          const at = new THREE.Vector3(outer.a.X, outer.a.Y, outer.a.Z).addScaledVector(d, tt).addScaledVector(Lout.side, inFace + gap / 2);
          spacers.push({ at, along: d.clone(), side: Lout.side.clone(), l, w, th: gap, ids: [b.id, o.id] });
        }
      }
    }
  }
  out.spacers = spacers;
  // ends meeting another board's side: stop at its face. (A brace's end stops at a horizontal board or a post, a
  // horizontal board's at a post, never the other way round; two horizontal boards of different walls meeting end to end
  // at a corner are each nailed to the post there, and are left as they are.)
  const rank = (o) => (line.has(o) ? 2 : Math.abs(o.a.Y - o.b.Y) < 0.05 ? 1 : 0);
  for (const b of boards) {
    const L = out.get(b.id);
    for (const o of boards) {
      if (o === b || rank(o) < rank(b)) continue;
      for (const c of touch3(b, o)) {
        const end = c.ti < TOL ? 'a' : c.ti > b.len - TOL ? 'b' : null;
        if (!end || c.butt) continue;
        if ((c.tj < END_T || c.tj > o.len - END_T) && planeKeyOf(o) !== planeKeyOf(b) && !line.has(o)) continue;
        const adj = endToFace(b, L, end, o, out.get(o.id));
        if (adj !== null) { const p = L[end], d = dirFrom(b, end); p.X += d.x * adj; p.Y += d.y * adj; p.Z += d.z * adj; }
      }
    }
  }
  return out;
}
const seg = (b, key) => { const A = toPlane(key, b.a), B = toPlane(key, b.b); return { ax: A.u, ay: A.y, bx: B.u, by: B.y, len: b.len }; };
// the unit vector out of board b at its end e (pointing away from its middle)
function dirFrom(b, e) {
  const d = new THREE.Vector3(b.b.X - b.a.X, b.b.Y - b.a.Y, b.b.Z - b.a.Z).normalize();
  return e === 'a' ? d.negate() : d;
}
const axesOf = (b) => {
  const d = new THREE.Vector3(b.b.X - b.a.X, b.b.Y - b.a.Y, b.b.Z - b.a.Z).normalize(), n = boardN(b);
  n.addScaledVector(d, -n.dot(d)); if (n.lengthSq() < 1e-6) n.set(0, 0, 1); n.normalize();
  return { d, n, w: new THREE.Vector3().crossVectors(n, d) };
};
// half of a board's box across direction v (feet); Infinity when the board runs along v
function halfAcross(ax, v) { if (Math.abs(v.dot(ax.d)) > 0.3) return Infinity; return Math.abs(v.dot(ax.n)) * BT / 2 + Math.abs(v.dot(ax.w)) * BW / 2; }
// how far (feet, + outward) board b's end e must move to stop at board o's near face, or null if they don't run into
// each other there (o lies a layer out, beside it)
function endToFace(b, Lb, e, o, Lo) {
  const d = dirFrom(b, e), ao = axesOf(o), ab = axesOf(b);
  if (Math.abs(d.dot(ao.d)) > 0.7) return null;                           // (end to end along a line: a butt)
  const shift = (L) => L.side.clone().multiplyScalar(L.off);
  const E = V(Lb[e]).divideScalar(FT).add(shift(Lb));
  const oa = new THREE.Vector3(o.a.X, o.a.Y, o.a.Z).add(shift(Lo)), od = ao.d;
  const s = Math.max(0, Math.min(o.len, E.clone().sub(oa).dot(od))), C = oa.clone().addScaledVector(od, s);
  for (const v of [ab.n, ab.w]) {
    const hb = halfAcross(ab, v) === Infinity ? 0 : halfAcross(ab, v), ho = halfAcross(ao, v);
    if (ho !== Infinity && Math.abs(C.clone().sub(E).dot(v)) > hb + ho - 0.003) return null;   // (beside it)
  }
  const hd = halfAcross(ao, d); if (hd === Infinity) return null;
  const adj = C.clone().sub(E).dot(d) - hd;
  return Math.abs(adj) < 0.5 ? adj : null;
}

export function makeTowerView(scene) {
  const group = new THREE.Group(); scene.add(group);
  // a few timbers so neighbouring boards don't all look the same
  const tints = [[184, 138, 90], [168, 122, 78], [194, 150, 100], [158, 114, 72]];
  const mats = tints.map((t, i) => new THREE.MeshLambertMaterial({ map: boardTexture(101 + i * 17, t) }));
  const heldMat = new THREE.MeshLambertMaterial({ map: boardTexture(5, [214, 170, 110]), emissive: 0x6b4a12, emissiveIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const pickMat = new THREE.MeshLambertMaterial({ map: mats[0].map, emissive: 0x2e6b88, emissiveIntensity: 0.55 });
  const nailGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.01, 6); nailGeo.rotateX(Math.PI / 2);
  const nails = new THREE.InstancedMesh(nailGeo, new THREE.MeshLambertMaterial({ color: 0x2c2826 }), 900);
  nails.count = 0; nails.frustumCulled = false; group.add(nails);
  const nailBase = [];     // { p: world position (m), y (ft), z (which way it looks) }

  const spacerGroup = new THREE.Group(); group.add(spacerGroup);
  const boards = new Map();   // id -> { mesh, a, b (world m, as drawn at rest), z (its face's outward look), y0, y1 (ft), src, len }
  const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

  function boxFor(len, wide, thick) {
    const g = new THREE.BoxGeometry(len * FT, wide * FT, thick * FT);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 8);   // grain at its true size
    return g;
  }
  // place a box between two world points (metres), its thin side facing along z
  const tmpX = new THREE.Vector3(), tmpY = new THREE.Vector3(), tmpZ = new THREE.Vector3(), tmpM = new THREE.Matrix4();
  function pose(mesh, a, b, z) {
    tmpX.subVectors(b, a); const L = tmpX.length(); tmpX.divideScalar(L || 1);
    tmpZ.copy(z).addScaledVector(tmpX, -tmpZ.copy(z).dot(tmpX)); if (tmpZ.lengthSq() < 1e-6) tmpZ.set(0, 0, 1); tmpZ.normalize();
    tmpY.crossVectors(tmpZ, tmpX); tmpM.makeBasis(tmpX, tmpY, tmpZ);
    mesh.position.addVectors(a, b).multiplyScalar(0.5); mesh.quaternion.setFromRotationMatrix(tmpM);
  }
  // a board's drawn ends in metres, from its layout
  const drawnEnds = (L) => { const s = L.side.clone().multiplyScalar(L.off * FT); return [V(L.a).add(s), V(L.b).add(s)]; };

  let lastLayout = new Map();
  function rebuild(tower) {
    for (const b of boards.values()) { group.remove(b.mesh); b.mesh.geometry.dispose(); }
    boards.clear();
    for (const m of tinted.values()) m.dispose();
    tinted.clear();
    const lay = layout(tower); lastLayout = lay; focus = null;
    for (const b of tower.boards) {
      const L = lay.get(b.id), [a, e] = drawnEnds(L), len = a.distanceTo(e) / FT;
      const mesh = new THREE.Mesh(boxFor(len, BW, BT), mats[hash(b.id) % mats.length]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      const z = boardN(b);
      pose(mesh, a, e, z);
      mesh.userData = { key: b.id, src: b };
      group.add(mesh);
      boards.set(b.id, { mesh, a, b: e, z: isPost(b) ? z : L.side.clone(), y0: L.a.Y, y1: L.b.Y, src: b, len, mat: mesh.material });
    }
    // nail heads: three at every joint, on the outer face of the outermost board there (none where posts only stand on
    // each other, or on the ground)
    // the spacer blocks, plain wood, under the nails where a board sits out from what it is nailed to
    for (const m of [...spacerGroup.children]) { spacerGroup.remove(m); m.geometry.dispose(); }
    for (const sp of lay.spacers || []) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sp.l * FT, sp.w * FT, sp.th * FT), mats[3]);
      m.castShadow = true; m.receiveShadow = true;
      const x = sp.along.clone(), z = sp.side.clone(); z.addScaledVector(x, -z.dot(x)).normalize();
      m.quaternion.setFromRotationMatrix(tmpM.makeBasis(x, new THREE.Vector3().crossVectors(z, x), z));
      m.position.copy(sp.at).multiplyScalar(FT); m.userData = { spacer: true, ids: sp.ids }; m.raycast = () => {};
      spacerGroup.add(m);
    }
    nailBase.length = 0;
    const walls = wallsInUse(tower);
    for (const h of joints3(tower.boards)) {
      if (h.ground) continue;
      let best = null;
      for (const it of h.items) { const b = tower.boards[it.i]; if (isCornerLine(tower, b, walls)) continue; const L = lay.get(b.id); if (!best || L.off > best.L.off) best = { b, L, t: it.t }; }
      if (!best) continue;
      const { b, L } = best, d = new THREE.Vector3(b.b.X - b.a.X, b.b.Y - b.a.Y, b.b.Z - b.a.Z).normalize();
      const out = L.side.clone(), w = new THREE.Vector3().crossVectors(out, d).normalize();
      const at = new THREE.Vector3(h.X, h.Y, h.Z).add(out.clone().multiplyScalar(L.off + BT / 2 + 0.006)).multiplyScalar(FT);
      for (const [dx, dy] of [[-0.03, 0.02], [0.03, 0.02], [0, -0.025]]) {
        const p = at.clone().addScaledVector(d, dx).addScaledVector(w, dy);
        if (p.y < 0.02) p.y = 0.02;
        nailBase.push({ p, y: h.Y, z: out, ids: h.items.map((it) => tower.boards[it.i].id) });
      }
    }
    placeNails();
  }
  const q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), tmpP = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1);
  // the nail heads; keep (a Set of board ids, or none: all): only the joints where two or more of those boards still
  // meet (after the wind test, what fell takes its nails with it)
  function placeNails(keep) {
    let n = 0;
    for (const nb of nailBase) {
      if (n >= 900) break;
      if (keep && nb.ids.filter((id) => keep.has(id)).length < 2) continue;
      tmpP.copy(nb.p); q.setFromUnitVectors(zAxis, nb.z); tmpM.compose(tmpP, q, one); nails.setMatrixAt(n++, tmpM);
    }
    nails.count = n;
    nails.instanceMatrix.needsUpdate = true;
    // (a spacer goes with its boards: only where both still stand)
    for (const m of spacerGroup.children) m.visible = !keep || m.userData.ids.every((id) => keep.has(id));
  }

  // ── the wind test ─────────────────────────────────────────────────────────────────────────────────────────────────
  // The frame bent by the wind: bend(id) -> [[dx, dy, dz], [dx, dy, dz]], how far (feet, already drawn larger than real
  // so the eye can see it) the board's a end and b end have moved, or null for none. bend null puts everything back at
  // rest. Boards that are falling (fall.js moves them) are left alone.
  const sa = new THREE.Vector3(), sb = new THREE.Vector3();
  function setBend(bend) {
    for (const b of boards.values()) {
      if (b.falling) continue;
      const m = bend && bend(b.src.id);
      if (!m) { pose(b.mesh, b.a, b.b, b.z); continue; }
      sa.set(m[0][0], m[0][1], m[0][2]).multiplyScalar(FT).add(b.a); sb.set(m[1][0], m[1][1], m[1][2]).multiplyScalar(FT).add(b.b);
      pose(b.mesh, sa, sb, b.z);
    }
  }
  // where a board is drawn right now (metres): its two ends, a then b, as the mesh stands (bent or not). fall.js starts a
  // falling board from here.
  const ux = new THREE.Vector3();
  function drawnNow(id) {
    const b = boards.get(id); if (!b) return null;
    ux.set(1, 0, 0).applyQuaternion(b.mesh.quaternion).multiplyScalar(b.len * FT / 2);
    return [b.mesh.position.clone().sub(ux), b.mesh.position.clone().add(ux)];
  }
  // The strain colour: green at 0 (easy), yellow at 0.5, red at 1 (at its limit) and past.
  const cGreen = new THREE.Color(0x38b84a), cYellow = new THREE.Color(0xf2cf2e), cRed = new THREE.Color(0xe0321e), cFlash = new THREE.Color(0xff2a14);
  function strainColor(s, out) {
    s = Math.max(0, s || 0);
    return s <= 0.5 ? out.copy(cGreen).lerp(cYellow, s / 0.5) : out.copy(cYellow).lerp(cRed, Math.min(1, (s - 0.5) / 0.5));
  }
  // Each board gets its own tinted copy of its wood while the test runs (the grain shows through the colour).
  // strain(id) -> 0.. (or undefined: plain wood); flash(id) -> 0..1 (a part giving way flashes bright red). strain null
  // puts every board back to plain wood. A board that is falling is plain wood again.
  const tinted = new Map(), tmpC = new THREE.Color();
  function setStrain(strain, flash) {
    for (const b of boards.values()) {
      const s = strain && !b.falling ? strain(b.src.id) : undefined;
      if (s === undefined) { if (b.mesh.material !== b.mat && b.mesh.material !== pickMat) b.mesh.material = b.mat; continue; }
      let m = tinted.get(b.mesh);
      if (!m) { m = new THREE.MeshLambertMaterial({ map: b.mat.map }); tinted.set(b.mesh, m); }
      b.mesh.material = m;
      strainColor(s, tmpC);
      // (past its limit it pulses, so a part about to go catches the eye)
      const over = s > 1 ? 0.5 + 0.5 * Math.sin(time * 14) : 0, f = flash ? flash(b.src.id) || 0 : 0;
      m.color.setRGB(1, 1, 1).lerp(tmpC, 0.72);
      m.emissive.copy(tmpC).multiplyScalar(0.24 + over * 0.3);
      if (f > 0) { m.color.lerp(cFlash, f); m.emissive.copy(cFlash).multiplyScalar(0.25 + 0.75 * f); }
    }
  }
  // The nailed joints during the test: a coloured spot on each (the same colours), on the outer face of the outermost
  // board there, moving with the frame as it bends. joints: the physics' list [{ X, Y, Z (feet), util }] (or null to hide
  // the spots: the nail heads come back); bend: as setBend; strainOf(util) -> the strain to colour it by now.
  const spotGeo = new THREE.SphereGeometry(0.05, 12, 8);
  const spotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const spots = new THREE.InstancedMesh(spotGeo, spotMat, 600);
  spots.count = 0; spots.frustumCulled = false; spots.visible = false; spots.renderOrder = 2; group.add(spots);
  spots.setColorAt(0, tmpC.set(0xffffff)); spots.raycast = () => {};
  // (each joint list is worked out once: where its spot sits at rest, and which boards pass through it, how far along)
  const plans = new WeakMap(), tmpS = new THREE.Vector3();
  function planOf(joints) {
    let plan = plans.get(joints); if (plan) return plan;
    plan = joints.map((j) => {
      const P = { X: j.X, Y: j.Y, Z: j.Z }, near = [];
      let out = null;
      for (const b of boards.values()) {
        if (b.falling) continue;
        const g = pointGap(P, b.src); if (g.d > TOL * 1.6) continue;
        near.push({ id: b.src.id, f: Math.max(0, Math.min(1, g.t / (b.src.len || 1))) });
        const L = lastLayout.get(b.src.id);
        if (L && !isPost(b.src) && (!out || L.off > out.off)) out = L;
      }
      const base = new THREE.Vector3(j.X, Math.max(0.12, j.Y), j.Z);
      if (out) base.addScaledVector(out.side, out.off + BT / 2);
      return { base: base.multiplyScalar(FT), near };
    });
    plans.set(joints, plan);
    return plan;
  }
  function setSpots(joints, bend, strainOf) {
    spots.visible = !!joints; nails.visible = !joints; spacerGroup.visible = !joints;
    if (!joints) return;
    const plan = planOf(joints);
    spots.count = Math.min(plan.length, 600);
    for (let i = 0; i < spots.count; i++) {
      const pl = plan[i]; tmpP.copy(pl.base);
      if (bend && pl.near.length) {
        tmpS.set(0, 0, 0); let n = 0;
        for (const it of pl.near) { const m = bend(it.id); if (!m) continue; n++; tmpS.x += m[0][0] + (m[1][0] - m[0][0]) * it.f; tmpS.y += m[0][1] + (m[1][1] - m[0][1]) * it.f; tmpS.z += m[0][2] + (m[1][2] - m[0][2]) * it.f; }
        if (n) tmpP.addScaledVector(tmpS, FT / n);
      }
      tmpM.compose(tmpP, q.identity(), one); spots.setMatrixAt(i, tmpM);
      strainColor(strainOf ? strainOf(joints[i].util) : joints[i].util, tmpC); spots.setColorAt(i, tmpC);
    }
    spots.instanceMatrix.needsUpdate = true; if (spots.instanceColor) spots.instanceColor.needsUpdate = true;
  }

  // the board being placed: { a, b (world feet), n, key (its plane), len, glowA, glowB } or null. Drawn a layer out
  // from its plane (over the posts there), never further: from the side you see just where it is. An end that touches
  // a board (or the ground) glows green.
  let held = null;
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x3ee05a, transparent: true, opacity: 0.55, depthWrite: false });
  const glowGeo = new THREE.BoxGeometry(0.42 * FT, BW * 1.7 * FT, BT * 2.6 * FT);
  const glows = [new THREE.Mesh(glowGeo, glowMat), new THREE.Mesh(glowGeo, glowMat)];
  for (const g of glows) { g.renderOrder = 6; g.raycast = () => {}; g.visible = false; group.add(g); }
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpD = new THREE.Vector3();
  function showHeld(h) {
    if (!h) { if (held) { group.remove(held); held.geometry.dispose(); held = null; } glows.forEach((g) => { g.visible = false; }); return; }
    if (!held || held.userData.len !== h.len) {
      if (held) { group.remove(held); held.geometry.dispose(); }
      held = new THREE.Mesh(boxFor(h.len, BW, BT), heldMat); held.userData = { len: h.len }; held.castShadow = true; group.add(held);
    }
    // (a post, or a leg (h.line), is drawn on its line; anything else a layer out from its wall, along the wall's normal)
    const post = (Math.abs(h.a.X - h.b.X) < 1e-6 && Math.abs(h.a.Z - h.b.Z) < 1e-6) || !!h.line, nrm = planeNormal(h.key, (h.a.Y + h.b.Y) / 2);
    const off = post ? 0 : HELD_OFF, s = P3(nrm).multiplyScalar(off * FT), z = boardN(h);
    tmpA.copy(V(h.a)).add(s); tmpB.copy(V(h.b)).add(s);
    pose(held, tmpA, tmpB, z);
    // (each glow sits over the last few inches of its end)
    tmpD.subVectors(tmpB, tmpA).normalize().multiplyScalar(0.17 * FT);
    const pulse = 0.45 + 0.25 * Math.sin(time * 7);
    glowMat.opacity = pulse;
    [[h.glowA, tmpA, 1], [h.glowB, tmpB, -1]].forEach(([on, p, sg], i) => {
      const g = glows[i]; g.visible = !!on; if (!on) return;
      const c = p.clone().addScaledVector(tmpD, sg), e = p.clone().addScaledVector(tmpD, sg * 2);
      pose(g, p, e, z); g.position.copy(c);
    });
  }

  // the plane a held board lies in: a faint sheet over the footprint, from the ground to above the work, and a brighter
  // line across the stones on the ground. plane: { key, half (feet each side of the middle), top (feet) } or null
  const sheetMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.85, depthWrite: false });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffe7a8, transparent: true, opacity: 0.45, depthWrite: false });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sheetMat); sheet.renderOrder = 3; sheet.raycast = () => {};
  const groundLine = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lineMat); groundLine.renderOrder = 3; groundLine.raycast = () => {};
  const sheetEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)), edgeMat); sheetEdge.renderOrder = 3; sheetEdge.raycast = () => {};
  // (a leaning plane: the sheet tips about its line on the ground, by the wall's lean: an inner group turned about the
  // plane's level direction, so the sheet's up runs up the wall's slope, e_Y + t·e_n)
  const tilt = new THREE.Group(); tilt.add(sheet, sheetEdge);
  const planeGroup = new THREE.Group(); planeGroup.add(tilt, groundLine); planeGroup.visible = false; group.add(planeGroup);
  function showPlane(p) {
    planeGroup.visible = !!p; if (!p) return;
    // (seen end on, the sheet is a line through the board: brighter, so you see which plane it is on as it moves)
    sheetMat.opacity = p.endOn ? 0.16 : 0.07; edgeMat.opacity = p.endOn ? 0.75 : 0.35;
    const { axis, off, t } = parseKey(p.key), w = p.half * 2 * FT, h = p.top * Math.sqrt(1 + t * t) * FT;
    planeGroup.position.set(axis === 'X' ? off * FT : 0, 0, axis === 'Z' ? off * FT : 0);
    planeGroup.rotation.y = axis === 'X' ? Math.PI / 2 : 0;
    tilt.rotation.x = Math.atan(t);
    sheet.scale.set(w, h, 1); sheet.position.set(0, h / 2, 0);
    sheetEdge.scale.set(w, h, 1); sheetEdge.position.set(0, h / 2, 0);
    groundLine.scale.set(w + 0.25, 0.025, 0.05); groundLine.position.set(0, 0.02, 0);
  }

  // the twins: list [{ a, b, len, n, ok (true: gold and tappable, false: grey) }]. Each gets a see-through box with dark
  // edges (so it reads against the pale sky as well as the hillside) inside a fatter soft glow; meshes carry
  // userData.ghost = index.
  const ghostGroup = new THREE.Group(); group.add(ghostGroup);
  const ghostMat = { ok: new THREE.MeshBasicMaterial({ color: 0xffa31a, transparent: true, opacity: 0.62, depthWrite: false }),
    grey: new THREE.MeshBasicMaterial({ color: 0x8c877e, transparent: true, opacity: 0.4, depthWrite: false }) };
  const ghostGlow = new THREE.MeshBasicMaterial({ color: 0xffc23d, transparent: true, opacity: 0.24, depthWrite: false });
  const ghostEdge = { ok: new THREE.LineBasicMaterial({ color: 0x7a4300, transparent: true, opacity: 0.9, depthWrite: false }),
    grey: new THREE.LineBasicMaterial({ color: 0x4a463f, transparent: true, opacity: 0.6, depthWrite: false }) };
  let ghostFade = 1, ghostKey = '';
  function setGhosts(list) {
    // (rebuilt only when something about them changed)
    const key = list.map((g) => [g.a.X, g.a.Y, g.a.Z, g.b.X, g.b.Y, g.b.Z, g.n, g.t || 0, g.ok].join(',')).join(';');
    if (key === ghostKey) return;
    ghostKey = key;
    for (const m of [...ghostGroup.children]) { ghostGroup.remove(m); m.geometry.dispose(); m.children.forEach((c) => c.geometry.dispose()); }
    list.forEach((g, i) => {
      const geo = boxFor(g.len, BW, BT), k = g.ok ? 'ok' : 'grey';
      const mesh = new THREE.Mesh(geo, ghostMat[k]); mesh.renderOrder = 5;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), ghostEdge[k]); edges.renderOrder = 6; edges.raycast = () => {};
      mesh.add(edges);
      if (g.ok) {
        const glow = new THREE.Mesh(boxFor(g.len + 0.25, BW * 2.6, BT * 3), ghostGlow);
        glow.renderOrder = 4; glow.raycast = () => {}; mesh.add(glow);
      }
      const post = (Math.abs(g.a.X - g.b.X) < 1e-6 && Math.abs(g.a.Z - g.b.Z) < 1e-6) || !!g.line;
      const s = P3(planeNormal(planeKeyOf(g), (g.a.Y + g.b.Y) / 2)).multiplyScalar(post ? 0 : (BW / 2 + BT / 2 + 0.004) * FT);
      pose(mesh, V(g.a).add(s), V(g.b).add(s), boardN(g));
      mesh.userData = { ghost: i, ok: g.ok };
      ghostGroup.add(mesh);
    });
  }
  // fade: 1 shown, 0 gone (they fade out when ignored)
  function fadeGhosts(f) { ghostFade = f; ghostGroup.visible = f > 0.01; }

  // The boards the result card is talking about glow (a warm pulsing gold over their wood) while the card is open. ids:
  // a list or Set of board ids, or null for none. Fallen boards lying on the ground glow too.
  const focusMat = new THREE.MeshLambertMaterial({ map: mats[0].map, emissive: 0xffb020, emissiveIntensity: 0.6 });
  let focus = null;
  function setFocus(ids) {
    const next = ids && [...ids].length ? new Set(ids) : null;
    const same = (!next && !focus) || (next && focus && next.size === focus.size && [...next].every((id) => focus.has(id)));
    if (same) return;
    focus = next;
    for (const b of boards.values()) {
      if (focus && focus.has(b.src.id)) b.mesh.material = focusMat;
      else if (b.mesh.material === focusMat) b.mesh.material = b.mat;
    }
  }
  // light up the board that a tap picked
  function highlight(src) { for (const b of boards.values()) b.mesh.material = b.src === src ? pickMat : b.mat; }

  // the prize: a windmill head with four sails, turning, on top of the tower
  const head = new THREE.Group(); head.visible = false; group.add(head);
  {
    const iron = new THREE.MeshLambertMaterial({ color: 0x4a4038 }), cloth = new THREE.MeshLambertMaterial({ color: 0xefe6d0, side: THREE.DoubleSide }), wood = mats[2];
    // (the deck is sized to the top of the tower when the head is shown)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 1), wood); head.add(deck); head.userData.deck = deck;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.7, 8), new THREE.MeshLambertMaterial({ color: 0x6d4b2b })); cap.position.y = 0.4; head.add(cap);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.45, 8), new THREE.MeshLambertMaterial({ color: 0x5b3f2c })); roof.position.y = 0.97; head.add(roof);
    const hub = new THREE.Group(); hub.position.set(0, 0.45, 0.62); head.add(hub);
    hub.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8).rotateX(Math.PI / 2), iron));
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; hub.add(arm);
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.05), wood); spar.position.y = 1.1; arm.add(spar);
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6), cloth); sail.position.set(0.3, 1.3, 0.02); sail.rotation.y = 0.15; arm.add(sail);
    }
    head.userData.hub = hub;
    head.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  // the head on the top of the tower: sized to the boards up there (a setback tower's narrow top gets a small deck)
  function showHead(on, tower, faceAz = 0) {
    head.visible = on && !!tower;
    if (!head.visible) return;
    const top = towerHeight(tower), up = tower.boards.filter((b) => Math.max(b.a.Y, b.b.Y) > top - 1.5);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const b of up) for (const p of [b.a, b.b]) { x0 = Math.min(x0, p.X); x1 = Math.max(x1, p.X); z0 = Math.min(z0, p.Z); z1 = Math.max(z1, p.Z); }
    head.position.set((x0 + x1) / 2 * FT, top * FT + 0.04, (z0 + z1) / 2 * FT); head.rotation.y = faceAz;
    head.userData.deck.scale.set((x1 - x0 + 0.8) * FT, 1, (z1 - z0 + 0.8) * FT);
  }

  let time = 0;
  function update(dt, windLevel) {
    time += dt;
    if (head.visible) head.userData.hub.rotation.z -= dt * (0.6 + windLevel * 3);
    // the twins breathe gently, so they read as "not built yet"
    const pulse = 0.75 + 0.25 * Math.sin(time * 3.2);
    ghostMat.ok.opacity = 0.62 * (0.8 + 0.2 * pulse) * ghostFade; ghostGlow.opacity = 0.3 * pulse * ghostFade; ghostEdge.ok.opacity = 0.9 * ghostFade;
    ghostMat.grey.opacity = 0.4 * ghostFade; ghostEdge.grey.opacity = 0.6 * ghostFade;
    if (focus) focusMat.emissiveIntensity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(time * 4.5));
  }

  return { group, boards, rebuild, setBend, setStrain, setSpots, drawnNow, strainColor, nailsFor: placeNails, showHeld, showPlane, highlight, showHead, update, setGhosts, fadeGhosts, setFocus,
    focused: () => (focus ? [...focus] : []), spacers: () => spacerGroup.children,
    layout: () => lastLayout, meshes: () => [...boards.values()].map((b) => b.mesh), ghostMeshes: () => (ghostGroup.visible ? ghostGroup.children : []), nails };
}
