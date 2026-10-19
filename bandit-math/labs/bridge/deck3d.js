// THE DECK, drawn: one 2 by 8 inch plank per deck plank (bridge.js planksFor), lying flat across the two bottom-board
// lines, resting on top of them (each plank's line in the data is DECK_LIFT above theirs; drawn, its underside sits on
// their top edges). During the test each plank is tinted by its strain and bends with the frame, as tower3d.js does the
// boards; fall.js drops planks as it drops boards (the same { boards, drawnNow } a falling board is read from).
import * as THREE from 'three';
import { boardTexture } from '../windmill/wood.js';
import { PLANK, DECK_LIFT } from './bridge.js';
import { FT } from './scene.js';

const TOP = 3.5 / 24;      // feet: from a board's line up to its top edge (a 2x4 on edge)

export function makeDeckView(scene, strainColor) {
  const group = new THREE.Group(); scene.add(group);
  const mats = [0, 1, 2].map((i) => new THREE.MeshLambertMaterial({ map: boardTexture(201 + i * 13, [176 - i * 8, 132 - i * 6, 86 - i * 4]) }));
  const boards = new Map();      // id -> { mesh, a, b (metres, at rest), z (its face's look: up), len, src, mat, falling }
  const lift = TOP + PLANK.t / 2 - DECK_LIFT;     // (how much higher a plank is drawn than its line)
  function rebuild(deck) {
    for (const b of boards.values()) { group.remove(b.mesh); b.mesh.geometry.dispose(); if (b.tint) b.tint.dispose(); }
    boards.clear();
    if (!deck) return;
    deck.planks.forEach((p, i) => {
      const g = new THREE.BoxGeometry(p.len * FT, PLANK.t * FT, PLANK.w * FT), uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * p.len / 8);
      const mesh = new THREE.Mesh(g, mats[i % 3]); mesh.castShadow = true; mesh.receiveShadow = true;
      const a = new THREE.Vector3(p.a.X, p.a.Y + lift, p.a.Z).multiplyScalar(FT), b = new THREE.Vector3(p.b.X, p.b.Y + lift, p.b.Z).multiplyScalar(FT);
      pose(mesh, a, b); mesh.userData = { key: p.id, src: p, plank: true };
      group.add(mesh);
      boards.set(p.id, { mesh, a, b, z: new THREE.Vector3(0, 1, 0), len: p.len, src: p, mat: mesh.material, falling: false });
    });
  }
  // a plank's box between two points (metres), its wide face up
  const tx = new THREE.Vector3(), ty = new THREE.Vector3(), tz = new THREE.Vector3(), tm = new THREE.Matrix4();
  function pose(mesh, a, b) {
    tx.subVectors(b, a).normalize(); ty.set(0, 1, 0).addScaledVector(tx, -tx.y).normalize(); tz.crossVectors(tx, ty);
    tm.makeBasis(tx, ty, tz); mesh.quaternion.setFromRotationMatrix(tm); mesh.position.addVectors(a, b).multiplyScalar(0.5);
  }
  const sa = new THREE.Vector3(), sb = new THREE.Vector3();
  function setBend(bend) {
    for (const b of boards.values()) {
      if (b.falling) continue;
      const m = bend && bend(b.src.id);
      if (!m) { pose(b.mesh, b.a, b.b); continue; }
      sa.set(m[0][0], m[0][1], m[0][2]).multiplyScalar(FT).add(b.a); sb.set(m[1][0], m[1][1], m[1][2]).multiplyScalar(FT).add(b.b);
      pose(b.mesh, sa, sb);
    }
  }
  const tmpC = new THREE.Color(), cFlash = new THREE.Color(0xff2a14);
  function setStrain(strain, flash) {
    for (const b of boards.values()) {
      const s = strain && !b.falling ? strain(b.src.id) : undefined;
      if (s === undefined) { b.mesh.material = b.mat; continue; }
      if (!b.tint) b.tint = new THREE.MeshLambertMaterial({ map: b.mat.map });
      b.mesh.material = b.tint; strainColor(s, tmpC);
      const f = flash ? flash(b.src.id) || 0 : 0;
      b.tint.color.setRGB(1, 1, 1).lerp(tmpC, 0.72); b.tint.emissive.copy(tmpC).multiplyScalar(0.24);
      if (f > 0) { b.tint.color.lerp(cFlash, f); b.tint.emissive.copy(cFlash).multiplyScalar(0.25 + 0.75 * f); }
    }
  }
  const ux = new THREE.Vector3();
  function drawnNow(id) {
    const b = boards.get(id); if (!b) return null;
    ux.set(1, 0, 0).applyQuaternion(b.mesh.quaternion).multiplyScalar(b.len * FT / 2);
    return [b.mesh.position.clone().sub(ux), b.mesh.position.clone().add(ux)];
  }
  // the deck's top at X (feet), at rest: where the loads walk (the bank's top past the edges)
  return { group, boards, rebuild, setBend, setStrain, drawnNow, meshes: () => [...boards.values()].map((b) => b.mesh), lift };
}
