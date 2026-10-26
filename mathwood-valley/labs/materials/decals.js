// DECALS: a picture stamped onto a surface that's already there, like a sticker. three.js's DecalGeometry takes a box
// (where the stamp goes, which way it faces, how big) and cuts out the triangles of the target mesh that fall inside
// it, clipped to the box's sides, with new UVs that map the picture across the box. The result is a thin new mesh that
// hugs the boards exactly (into the gaps, over the lap of each board) and is drawn a hair in front (polygonOffset).
// Here the decals get the same weathering as the walls, so a poster under the eaves picks up the same streaks.
//
// The cut is only as slow as the mesh is big, so it is done on the triangles near the stamp, not the whole cabin.

import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { weather } from './weather.js';

const _ray = new THREE.Raycaster(), _ptr = new THREE.Vector2(), _o = new THREE.Object3D();

export class Decals {
  constructor({ scene, camera, canvas, targets, controls, stamps, topAt, onChange }) {
    Object.assign(this, { scene, camera, canvas, targets, controls, stamps, topAt, onChange });
    this.group = new THREE.Group(); this.group.name = 'decals'; scene.add(this.group);
    this.list = []; this.scale = 1; this.armed = null; this.drag = null;
    this.preview = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    this.preview.visible = false; scene.add(this.preview);
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
  }
  // each decal its own material (sharing the picture), told the height of the roof edge above it for its streaks
  material(key, top) {
    const m = new THREE.MeshStandardMaterial({ map: this.stamps[key].tex, transparent: true, depthWrite: false, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    return weather(m, { top });
  }
  hit(e, objs) {
    const r = this.canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
    if (document.elementFromPoint(e.clientX, e.clientY) !== this.canvas) return null;   // over a panel
    _ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    _ray.setFromCamera(_ptr, this.camera);
    const h = _ray.intersectObjects(objs, false)[0];
    if (!h || !h.face) return null;
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    if (Math.abs(n.y) < 0.6) { n.y = 0; n.normalize(); }   // on a wall: stand the stamp upright (lap boards lean a little)
    return { point: h.point.clone(), normal: n, object: h.object };
  }
  // the stamp's size and turn (it looks back along the surface's normal; "up" stays world up on a wall)
  pose(key, point, normal) {
    const S = this.stamps[key], s = this.scale;
    _o.position.copy(point); _o.lookAt(point.clone().add(normal)); _o.updateMatrix();
    return { size: new THREE.Vector3(S.w * s, S.h * s, 0.3), rot: _o.rotation.clone() };
  }
  // only the triangles near the stamp: a small mesh for DecalGeometry to cut
  near(mesh, point, radius) {
    const g = mesh.geometry, P = g.attributes.position.array, N = g.attributes.normal.array, I = g.index.array, r2 = radius * radius;
    const pos = [], nor = [];
    for (let t = 0; t < I.length; t += 3) {
      let close = false;
      for (let c = 0; c < 3 && !close; c++) { const i = I[t + c] * 3; if ((P[i] - point.x) ** 2 + (P[i + 1] - point.y) ** 2 + (P[i + 2] - point.z) ** 2 < r2) close = true; }
      if (!close) {   // a big triangle can cover the stamp with all three corners far away: test its middle too
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        const mx = (P[a] + P[b] + P[c]) / 3, my = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, mz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
        const span = Math.max(Math.abs(P[a] - P[b]), Math.abs(P[a + 1] - P[b + 1]), Math.abs(P[a + 2] - P[b + 2]), Math.abs(P[a] - P[c]), Math.abs(P[a + 1] - P[c + 1]), Math.abs(P[a + 2] - P[c + 2]));
        if ((mx - point.x) ** 2 + (my - point.y) ** 2 + (mz - point.z) ** 2 < (radius + span) ** 2) close = true;
      }
      if (close) for (let c = 0; c < 3; c++) { const i = I[t + c] * 3; pos.push(P[i], P[i + 1], P[i + 2]); nor.push(N[i], N[i + 1], N[i + 2]); }
    }
    const sub = new THREE.BufferGeometry();
    sub.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sub.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return new THREE.Mesh(sub);
  }
  place(key, point, normal, object) {
    const { size, rot } = this.pose(key, point, normal);
    const geos = [];
    for (const mesh of (object ? [object] : this.targets)) {
      const sub = this.near(mesh, point, Math.hypot(size.x, size.y) * 0.6 + 0.2);
      if (sub.geometry.attributes.position.count) geos.push(new DecalGeometry(sub, point, rot, size));
      sub.geometry.dispose();
    }
    const geo = geos.find((g) => g.attributes.position.count) || geos[0];
    if (!geo) return null;
    const top = this.topAt(point.x + normal.x * 0.1, point.z + normal.z * 0.1);
    const m = new THREE.Mesh(geo, this.material(key, top)); m.receiveShadow = true; m.renderOrder = 2;
    m.userData = { key, point: point.clone(), normal: normal.clone(), object };
    this.group.add(m); this.list.push(m);
    this.onChange && this.onChange();
    return m;
  }
  remove(m) { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); this.list = this.list.filter((x) => x !== m); this.onChange && this.onChange(); }
  clear() { for (const m of [...this.list]) this.remove(m); }
  // placing at a point given in code (the starting decals): find the surface by casting back along the normal
  stampAt(key, point, normal) {
    _ray.set(point.clone().addScaledVector(normal, 0.6), normal.clone().negate());
    const h = _ray.intersectObjects(this.targets, false)[0];
    if (!h) return null;
    return this.place(key, h.point, normal, h.object);
  }
  showPreview(key, h) {
    const p = this.preview, S = this.stamps[key];
    if (!h) { p.visible = false; return; }
    p.material.map = S.tex; p.material.needsUpdate = true;
    p.scale.set(S.w * this.scale, S.h * this.scale, 1);
    p.position.copy(h.point).addScaledVector(h.normal, 0.03); p.lookAt(h.point.clone().addScaledVector(h.normal, 1));
    p.visible = true;
  }
  // ── the pointer: drag a stamp from the panel onto a wall; or tap a stamp, then tap a wall; drag a decal to move it, off
  // the cabin to remove it
  beginStamp(key, e) { this.drag = { key, fromPanel: true, moved: false, x: e.clientX, y: e.clientY }; this.controls.enabled = false; }
  down(e) {
    if (this.armed) {
      const h = this.hit(e, this.targets);
      if (h) { this.place(this.armed, h.point, h.normal, h.object); }
      this.armed = null; this.onChange && this.onChange(); e.stopPropagation(); return;
    }
    const d = this.hit(e, this.list);
    if (d) {
      const m = d.object; m.visible = false;
      this.drag = { key: m.userData.key, mesh: m, moved: false, x: e.clientX, y: e.clientY };
      this.controls.enabled = false; this.showPreview(m.userData.key, d);
    }
  }
  move(e) {
    if (!this.drag) return;
    if (Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 6) this.drag.moved = true;
    this.drag.h = this.hit(e, this.targets);
    this.showPreview(this.drag.key, this.drag.h);
  }
  up() {
    const d = this.drag; if (!d) return;
    this.drag = null; this.controls.enabled = true; this.preview.visible = false;
    if (d.fromPanel && !d.moved) { this.armed = d.key; this.onChange && this.onChange(); return; }   // a tap: armed for the next tap on a wall
    if (d.mesh) {
      if (!d.moved) { d.mesh.visible = true; return; }
      this.remove(d.mesh);
    }
    if (d.h) this.place(d.key, d.h.point, d.h.normal, d.h.object);
  }
}
