// THE BARKEEP (the game's maker: "Probably a bartender too"): Gus, behind the saloon's bar, polishing a glass with a cloth
// (his clip: Bar_Polish, models/people/clips_crowd_m.glb, made in Blender round the same glass and cloth by
// ~/pw/bandit-math/rigs/clips/barkeep_clips.py; the glass rides his left wrist bone and the cloth his right by
// src/barkeepplan.js). He stands a step back from the bar's back face, facing over it into the hall; when the rider
// comes up to the bar he turns toward them (his body a little, his head the rest), and back to his glass when they go.
// Behind the bar only: the crowd keeps the bar's ends clear for him (labs/buildings/saloon.js anchors.crowd).
// He is made and drawn with the saloon's crowd (src/saloonfolk.js calls him): made once its clips are in near the
// saloon, drawn only while its inside is loaded and seen.
//
//   const K = makeBarkeep({ folk, scene })
//   K.update(dt, { hall, frame, frameYaw, show, make, pos })   hall: the saloon's object; frame: its matrixWorld;
//                     show: its inside loaded and seen; make: near enough (and the clips in) to make him; pos: the rider
//   K.state()         for rigs: { made, shown, x, z, turn, look, clip }
//   K.dispose()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makePerson } from './actors/folk.js';
import { BARKEEP, GLASS, CLOTH, glassHold } from './barkeepplan.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const UPY = new THREE.Vector3(0, 1, 0);

// the glass (a tumbler, a thick base: pale and clear) and the cloth (a crumpled white rag), each one small mesh
function makeGlass() {
  const G = GLASS, pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(G.r0, 0), new THREE.Vector2(G.r0 * 1.01, 0.014), new THREE.Vector2(G.r1, G.h), new THREE.Vector2(G.r1 * 0.93, G.h), new THREE.Vector2(G.r0 * 0.9, 0.018)];
  const geo = new THREE.LatheGeometry(pts, 12);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe8efed, roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.34, depthWrite: false }));
  m.name = 'barkeep glass'; m.renderOrder = 1; return m;
}
function makeCloth() {
  const [w, h, d] = CLOTH.size, geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + 0.4 * Math.abs(Math.sin(i * 1.7))), p.getY(i) * (0.85 + 0.3 * Math.abs(Math.cos(i * 2.3))), p.getZ(i) * (0.7 + 0.5 * Math.abs(Math.sin(i * 0.9))));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.95 }));
  m.name = 'barkeep cloth'; return m;
}
// HIS APRON (a critic: in an all-white jacket he read as a modern waiter): a white bib apron from his chest to his knees,
// stood a little off the body's own front (measured from the mesh in its bind pose, so it fits whichever outfit he
// wears) and skinned to his skeleton as his clothes are (each corner takes the bones of the nearest point of his
// clothes), so it bends with him as he leans over the glass
const APRON = { colour: 0xede8dd, bib: [0.22, 0.3], skirt: [0.4, 0.46], off: 0.016, bend: 1.4 };
function makeApron(body) {
  const mesh = body.mesh, B = body.bones; if (!B.Hips || !B.Neck || !B.LowerLegL || !mesh.isSkinnedMesh) return [];
  mesh.skeleton.pose(); body.root.updateMatrixWorld(true);
  const G = mesh.geometry, pos = G.attributes.position, kind = G.attributes._kind, si = G.attributes.skinIndex, sw = G.attributes.skinWeight;
  const v = new THREE.Vector3(), y = (b) => b.getWorldPosition(v).y;
  const neck = y(B.Neck), waist = y(B.Hips) + 0.06, knee = y(B.LowerLegL) - 0.04;
  // (his clothes in the bind pose, in the world: the top's and the trousers' points)
  const pts = []; for (let i = 0; i < pos.count; i++) { const k = kind ? Math.round(kind.getX(i)) : 3; if (k === 3 || k === 4) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); pts.push([v.x, v.y, v.z, i]); } }
  const front = (y0, y1, half) => { let z = -9; for (const q of pts) if (q[1] > y0 && q[1] < y1 && Math.abs(q[0]) < half && q[2] > z) z = q[2]; return z; };
  const top = neck - 0.13, zb = front(waist, top, 0.12) + APRON.off, zs = front(knee, waist, 0.2) + APRON.off + 0.01;
  // a sheet n columns across, r rows, from y0 (width w0) to y1 (width w1) at z, its sides bent back round the body
  const sheet = (y0, y1, w0, w1, z, n, r) => {
    const g = new THREE.PlaneGeometry(1, 1, n, r), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i), t = p.getY(i) + 0.5, w = w0 + (w1 - w0) * t, x = u * w; p.setXYZ(i, x, y0 + (y1 - y0) * t, z - APRON.bend * x * x); }
    return g;
  };
  const geo = mergeGeometries([sheet(waist - 0.01, top, APRON.bib[1], APRON.bib[0], zb, 2, 3), sheet(knee, waist + 0.03, APRON.skirt[1], APRON.skirt[0], zs, 6, 3)]);
  const p = geo.attributes.position, n = p.count, idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4), inv = mesh.matrixWorld.clone().invert();
  for (let i = 0; i < n; i++) {
    let best = null, bd = Infinity; const x = p.getX(i), yy = p.getY(i), z = p.getZ(i);
    for (const q of pts) { const d = (q[0] - x) ** 2 + (q[1] - yy) ** 2 + (q[2] - z) ** 2; if (d < bd) { bd = d; best = q[3]; } }
    for (let c = 0; c < 4; c++) { idx[i * 4 + c] = si.getComponent(best, c); wt[i * 4 + c] = sw.getComponent(best, c); }
    v.set(x, yy, z).applyMatrix4(inv); p.setXYZ(i, v.x, v.y, v.z);   // (into the body mesh's own space)
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: APRON.colour, roughness: 0.92, side: THREE.DoubleSide });
  mat.userData.indoorLit = true;   // (lit like the room he stands in: world/valley.js sunShadeAll)
  const m = new THREE.SkinnedMesh(geo, mat); m.name = 'barkeep apron'; m.castShadow = false; m.frustumCulled = false;
  m.position.copy(mesh.position); m.quaternion.copy(mesh.quaternion); m.scale.copy(mesh.scale);
  mesh.parent.add(m); m.bind(mesh.skeleton, mesh.bindMatrix);
  return [m];
}

export function makeBarkeep({ folk, scene }) {
  let body = null, glass = null, cloth = null, apron = [], shown = false, turn = 0, look = 0, at = null;
  const K = {};
  const QL = new THREE.Quaternion(), V = new THREE.Vector3(), INV = new THREE.Matrix4();
  function make() {
    const L = BARKEEP.look;
    body = makePerson(folk, { outfit: L.outfit, palette: L.palette, skin: L.skin, hair: L.hair, hat: L.hat, shadows: false });
    body.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    apron = makeApron(body);
    if (!body.play('Bar_Polish', { fade: 0 })) body.play('Idle', { fade: 0 });
    glass = makeGlass(); cloth = makeCloth();
    for (const m of [glass, cloth]) m.material.userData.indoorLit = true;   // (lit like the room: world/valley.js sunShadeAll)
    const B = body.bones;
    if (B.WristL) { glass.matrixAutoUpdate = false; glass.matrix.fromArray(glassHold()); B.WristL.add(glass); }
    if (B.WristR) { cloth.position.fromArray(CLOTH.at); B.WristR.add(cloth); }
    body.root.visible = false; scene.add(body.root);
  }
  K.update = (dt, { hall, frame, frameYaw, show, make: canMake, pos }) => {
    if (!hall || !frame) { if (body) body.root.visible = false; shown = false; return; }
    if (!body && canMake) make();
    if (!body) return;
    shown = !!show; body.root.visible = shown;
    if (!shown) return;
    // where he stands: a step back from the bar's back face (the bar runs along z; its customers' side is +x), facing
    // over it into the hall
    const A = hall.code.B.anchors.bar, x = A.keeper[0] + 0.45 - BARKEEP.back, z = A.keeper[2];
    at = { x, z };
    body.root.position.set(x, A.keeper[1], z).applyMatrix4(frame);
    // (the rider near the bar, in front of it: he turns to them, his body up to `turn`, his head the rest)
    let want = 0;
    if (pos) {
      INV.copy(frame).invert(); V.set(pos.x, pos.y, pos.z).applyMatrix4(INV);
      const dx = V.x - x, dz = V.z - z, d = Math.hypot(dx, dz);
      if (d < BARKEEP.near && V.x > A.from[0] - 0.2) want = wrap(Math.atan2(dx, dz) - Math.PI / 2);
    }
    const bodyWant = Math.max(-BARKEEP.turn, Math.min(BARKEEP.turn, want)), headWant = Math.max(-BARKEEP.head, Math.min(BARKEEP.head, want - bodyWant));
    const e = Math.min(1, dt * BARKEEP.ease);
    turn += (bodyWant - turn) * e; look += (headWant - look) * e;
    body.root.rotation.y = frameYaw + Math.PI / 2 + turn;
    body.update(dt);
    // (the head on the clip after the mixer: people.js puts these bones back before its next update, so it never piles up)
    const B = body.bones;
    if (Math.abs(look) > 0.01 && B.Neck && B.Head) {
      QL.setFromAxisAngle(UPY, look * 0.4); B.Neck.quaternion.multiply(QL);
      QL.setFromAxisAngle(UPY, look * 0.6); B.Head.quaternion.multiply(QL);
    }
  };
  K.state = () => ({ made: !!body, shown, x: at && +at.x.toFixed(2), z: at && +at.z.toFixed(2), turn: +turn.toFixed(2), look: +look.toFixed(2), clip: body ? body.clip : null });
  K.dispose = () => {
    if (!body) return;
    for (const m of [glass, cloth, ...apron]) if (m) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); }
    body.root.removeFromParent(); body.dispose(); body = glass = cloth = null; apron = [];
  };
  return K;
}
