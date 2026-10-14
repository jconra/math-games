// DRAWING THE TOWER: one box per board (a 2x4: 3.5 by 1.5 inches), nail heads at every joint, the board being placed,
// the glowing twins (where a board just nailed could be matched on the other walls: see-through gold boards with
// bright edges, grey when there is no wood or room for them), the sway during the wind test, and the prize on top (a
// windmill head with sails) once the tower stands tall enough.
// The tower's numbers are in feet (tower.js); here they become metres (FT).
import * as THREE from 'three';
import { worldBoards, faceSegments, faceToWorld, FACE_NORMAL, cornerXZ } from './tower.js';
import { findJoints, touch } from './frame.js';
import { boardTexture } from './wood.js';
import { FT } from './scene.js';

const BW = 3.5 / 12, BT = 1.5 / 12;       // board width and thickness, feet
const POST = 3.5 / 12;                     // corner posts are drawn 3.5 inches square (the board doubled up there)

export function makeTowerView(scene) {
  const group = new THREE.Group(); scene.add(group);
  // a few timbers so neighbouring boards don't all look the same
  const tints = [[184, 138, 90], [168, 122, 78], [194, 150, 100], [158, 114, 72]];
  const mats = tints.map((t, i) => new THREE.MeshLambertMaterial({ map: boardTexture(101 + i * 17, t) }));
  const heldMat = new THREE.MeshLambertMaterial({ map: boardTexture(5, [214, 170, 110]), emissive: 0x6b4a12, emissiveIntensity: 0.5 });
  const pickMat = new THREE.MeshLambertMaterial({ map: mats[0].map, emissive: 0x2e6b88, emissiveIntensity: 0.55 });
  const nailGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.01, 6); nailGeo.rotateX(Math.PI / 2);
  const nails = new THREE.InstancedMesh(nailGeo, new THREE.MeshLambertMaterial({ color: 0x2c2826 }), 600);
  nails.count = 0; nails.frustumCulled = false; group.add(nails);
  const nailBase = [];     // { p: world position (m), y (ft) }

  const boards = new Map();   // key -> { mesh, a, b (world m, at rest), z (outward), y0, y1 (ft), src, face, corner }
  const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

  function boxFor(len, wide, thick) {
    const g = new THREE.BoxGeometry(len * FT, wide * FT, thick * FT);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 8);   // grain at its true size
    return g;
  }
  // place a box between two world points (metres), its thin side facing out along z
  const tmpX = new THREE.Vector3(), tmpY = new THREE.Vector3(), tmpZ = new THREE.Vector3(), tmpM = new THREE.Matrix4();
  function pose(mesh, a, b, z) {
    tmpX.subVectors(b, a); const L = tmpX.length(); tmpX.divideScalar(L || 1);
    tmpZ.copy(z).addScaledVector(tmpX, -tmpZ.copy(z).dot(tmpX)); if (tmpZ.lengthSq() < 1e-6) tmpZ.set(0, 0, 1); tmpZ.normalize();
    tmpY.crossVectors(tmpZ, tmpX); tmpM.makeBasis(tmpX, tmpY, tmpZ);
    mesh.position.addVectors(a, b).multiplyScalar(0.5); mesh.quaternion.setFromRotationMatrix(tmpM);
  }

  // how far out from the corner line each wall board sits: boards nailed over others sit a layer further out
  function layersOf(tower) {
    const out = new Map();
    for (let w = 0; w < tower.walls.length; w++) {
      const segs = faceSegments(tower, w).filter((s) => !s.post);
      segs.forEach((s, i) => {
        let L = 0;
        for (let j = 0; j < i; j++) if (touch(s, segs[j]).length) L = Math.max(L, out.get(segs[j].id) || 0);
        out.set(s.id, Math.min(L + 1, 4));
      });
    }
    return out;
  }
  const outward = (k, layer) => (POST / 2 + BT * (layer - 0.5) + 0.004) * FT;

  function rebuild(tower) {
    const W = tower.W;
    for (const b of boards.values()) { group.remove(b.mesh); b.mesh.geometry.dispose(); }
    boards.clear();
    const layers = layersOf(tower);
    for (const wb of worldBoards(tower)) {
      const post = wb.face < 0;
      const mesh = new THREE.Mesh(post ? boxFor(wb.len, POST, POST) : boxFor(wb.len, BW, BT), mats[hash(wb.src.id) % mats.length]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      let z, a, b;
      if (post) {
        const [cx, cz] = cornerXZ(W, wb.corner); z = new THREE.Vector3(cx, 0, cz).normalize();
        a = new THREE.Vector3(wb.a.X * FT, wb.a.Y * FT, wb.a.Z * FT); b = new THREE.Vector3(wb.b.X * FT, wb.b.Y * FT, wb.b.Z * FT);
      } else {
        const n = FACE_NORMAL[wb.face]; z = new THREE.Vector3(n[0], 0, n[1]); const off = outward(wb.face, layers.get(wb.src.id) || 1);
        a = new THREE.Vector3(wb.a.X * FT, wb.a.Y * FT, wb.a.Z * FT).addScaledVector(z, off); b = new THREE.Vector3(wb.b.X * FT, wb.b.Y * FT, wb.b.Z * FT).addScaledVector(z, off);
      }
      pose(mesh, a, b, z);
      mesh.userData = { key: wb.key, src: wb.src, face: wb.face, corner: wb.corner };
      group.add(mesh);
      boards.set(wb.key, { mesh, a, b, z, y0: wb.a.Y, y1: wb.b.Y, src: wb.src, face: wb.face, corner: wb.corner, len: wb.len, mat: mesh.material });
    }
    // nail heads: three at every joint, on the outermost board there
    nailBase.length = 0;
    for (let k = 0; k < 4; k++) {
      const segs = faceSegments(tower, k), n = FACE_NORMAL[k], z = new THREE.Vector3(n[0], 0, n[1]);
      for (const h of findJoints(segs)) {
        const wallItems = h.items.filter((it) => !segs[it.s].post);
        if (!wallItems.length) continue;
        const L = Math.max(...wallItems.map((it) => layers.get(segs[it.s].id) || 1));
        const w = faceToWorld(W, k, h.x, h.y), off = outward(k, L) + BT / 2 * FT + 0.002;
        const tx = new THREE.Vector3(k === 0 ? 1 : k === 2 ? -1 : 0, 0, k === 1 ? -1 : k === 3 ? 1 : 0);
        for (const [dx, dy] of [[-0.03, 0.02], [0.03, 0.02], [0, -0.025]]) {
          const p = new THREE.Vector3(w.X * FT, Math.max(0.03, h.y * FT + dy), w.Z * FT).addScaledVector(z, off).addScaledVector(tx, dx);
          nailBase.push({ p, y: h.y, z });
        }
      }
    }
    placeNails(null);
  }
  const q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), tmpP = new THREE.Vector3();
  function placeNails(sway) {
    nails.count = Math.min(nailBase.length, 600);
    for (let i = 0; i < nails.count; i++) {
      const nb = nailBase[i]; tmpP.copy(nb.p); if (sway) tmpP.add(sway(nb.y));
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nb.z); tmpM.compose(tmpP, q, one); nails.setMatrixAt(i, tmpM);
    }
    nails.instanceMatrix.needsUpdate = true;
  }

  // the wind test's sway: sway(yFeet) -> a world offset in metres. null puts everything back at rest
  const sa = new THREE.Vector3(), sb = new THREE.Vector3();
  function setSway(sway) {
    for (const b of boards.values()) {
      if (b.falling) continue;
      if (!sway) { pose(b.mesh, b.a, b.b, b.z); continue; }
      sa.copy(b.a).add(sway(b.y0)); sb.copy(b.b).add(sway(b.y1)); pose(b.mesh, sa, sb, b.z);
    }
    placeNails(sway);
  }

  // the board being placed, on face k (of a tower W feet wide) at wall coordinates (x, y), angle ang, len feet
  let held = null;
  function showHeld(W, k, x, y, ang, len, isPost) {
    if (W === null) { if (held) { group.remove(held); held.geometry.dispose(); held = null; } return; }
    if (!held || held.userData.len !== len || held.userData.isPost !== isPost) {
      if (held) { group.remove(held); held.geometry.dispose(); }
      held = new THREE.Mesh(isPost ? boxFor(len, POST, POST) : boxFor(len, BW, BT), heldMat); held.userData = { len, isPost }; held.castShadow = true; group.add(held);
    }
    const n = FACE_NORMAL[k], z = new THREE.Vector3(n[0], 0, n[1]), off = isPost ? 0 : outward(k, 4.5);
    const A = faceToWorld(W, k, x, y), B = faceToWorld(W, k, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    pose(held, new THREE.Vector3(A.X * FT, A.Y * FT, A.Z * FT).addScaledVector(z, off), new THREE.Vector3(B.X * FT, B.Y * FT, B.Z * FT).addScaledVector(z, off), z);
  }

  // the twins: list [{ kind: 'post', corner, y, len } | { kind: 'wall', face, x, y, ang, len }, with ok (true: gold and
  // tappable, false: grey)]. Each gets a see-through box with dark edges (so it reads against the pale sky as well as
  // the hillside) inside a fatter soft glow; meshes carry userData.ghost = index.
  const ghostGroup = new THREE.Group(); group.add(ghostGroup);
  const ghostMat = { ok: new THREE.MeshBasicMaterial({ color: 0xffa31a, transparent: true, opacity: 0.62, depthWrite: false }),
    grey: new THREE.MeshBasicMaterial({ color: 0x8c877e, transparent: true, opacity: 0.4, depthWrite: false }) };
  const ghostGlow = new THREE.MeshBasicMaterial({ color: 0xffc23d, transparent: true, opacity: 0.24, depthWrite: false });
  const ghostEdge = { ok: new THREE.LineBasicMaterial({ color: 0x7a4300, transparent: true, opacity: 0.9, depthWrite: false }),
    grey: new THREE.LineBasicMaterial({ color: 0x4a463f, transparent: true, opacity: 0.6, depthWrite: false }) };
  let ghostFade = 1;
  let ghostKey = '';
  function setGhosts(list, W) {
    // (rebuilt only when something about them changed)
    const key = W + '|' + list.map((g) => [g.kind, g.face, g.corner, g.x, g.y, g.ang, g.len, g.ok].join(',')).join(';');
    if (key === ghostKey) return;
    ghostKey = key;
    for (const m of [...ghostGroup.children]) { ghostGroup.remove(m); m.geometry.dispose(); m.children.forEach((c) => c.geometry.dispose()); }
    list.forEach((g, i) => {
      const post = g.kind === 'post', geo = post ? boxFor(g.len, POST, POST) : boxFor(g.len, BW, BT), key = g.ok ? 'ok' : 'grey';
      const mesh = new THREE.Mesh(geo, ghostMat[key]); mesh.renderOrder = 5;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), ghostEdge[key]); edges.renderOrder = 6; edges.raycast = () => {};
      mesh.add(edges);
      if (g.ok) {
        const glow = new THREE.Mesh(post ? boxFor(g.len + 0.25, POST * 2.6, POST * 2.6) : boxFor(g.len + 0.25, BW * 2.6, BT * 3), ghostGlow);
        glow.renderOrder = 4; glow.raycast = () => {}; mesh.add(glow);
      }
      let a, b, z;
      if (post) {
        const [cx, cz] = cornerXZ(W, g.corner); z = new THREE.Vector3(cx, 0, cz).normalize();
        a = new THREE.Vector3(cx * FT, g.y * FT, cz * FT); b = new THREE.Vector3(cx * FT, (g.y + g.len) * FT, cz * FT);
      } else {
        const n = FACE_NORMAL[g.face], off = outward(g.face, 2); z = new THREE.Vector3(n[0], 0, n[1]);
        const A = faceToWorld(W, g.face, g.x, g.y), B = faceToWorld(W, g.face, g.x + Math.cos(g.ang) * g.len, g.y + Math.sin(g.ang) * g.len);
        a = new THREE.Vector3(A.X * FT, A.Y * FT, A.Z * FT).addScaledVector(z, off); b = new THREE.Vector3(B.X * FT, B.Y * FT, B.Z * FT).addScaledVector(z, off);
      }
      pose(mesh, a, b, z);
      mesh.userData = { ghost: i, ok: g.ok };
      ghostGroup.add(mesh);
    });
  }
  // fade: 1 shown, 0 gone (they fade out when ignored)
  function fadeGhosts(f) { ghostFade = f; ghostGroup.visible = f > 0.01; }

  // light up the boards (by their source board) that a tap picked
  function highlight(src) { for (const b of boards.values()) b.mesh.material = b.src === src ? pickMat : b.mat; }

  // the prize: a windmill head with four sails, turning, on top of the tower
  const head = new THREE.Group(); head.visible = false; group.add(head);
  {
    const iron = new THREE.MeshLambertMaterial({ color: 0x4a4038 }), cloth = new THREE.MeshLambertMaterial({ color: 0xefe6d0, side: THREE.DoubleSide }), wood = mats[2];
    // (the deck is sized to the tower's width when the head is shown)
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
  function showHead(on, topFt, faceAz = 0, W = 6) {
    head.visible = on;
    if (on) { head.position.set(0, topFt * FT + 0.04, 0); head.rotation.y = faceAz; head.userData.deck.scale.set((W + 0.8) * FT, 1, (W + 0.8) * FT); }
  }

  let time = 0;
  function update(dt, windLevel) {
    time += dt;
    if (head.visible) head.userData.hub.rotation.z -= dt * (0.6 + windLevel * 3);
    // the twins breathe gently, so they read as "not built yet"
    const pulse = 0.75 + 0.25 * Math.sin(time * 3.2);
    ghostMat.ok.opacity = 0.62 * (0.8 + 0.2 * pulse) * ghostFade; ghostGlow.opacity = 0.3 * pulse * ghostFade; ghostEdge.ok.opacity = 0.9 * ghostFade;
    ghostMat.grey.opacity = 0.4 * ghostFade; ghostEdge.grey.opacity = 0.6 * ghostFade;
  }

  return { group, boards, rebuild, setSway, showHeld, highlight, showHead, update, setGhosts, fadeGhosts,
    meshes: () => [...boards.values()].map((b) => b.mesh), ghostMeshes: () => (ghostGroup.visible ? ghostGroup.children : []), nails };
}
