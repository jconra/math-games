// THE ANGLER and the tackle: one of the game's people (the farmer, cowboy hat and all) at the end of the dock, a cane
// rod in the right hand that bends as a fish pulls, the reel under it with its handle turning while you reel, the
// line, and a red-and-white bobber. If the game's people can't load, a plain figure stands in.
//   makeAngler(scene, { person, at }) -> A (after the person has loaded). scene: what it all goes in (the lab: its scene;
//     the game: the dock's frame, turned to face its lake: everything here is in that frame). person: one of the game's
//     people already made (the game: the rider's own look), else the lab's angler is made; at: where they stand
//     (default ANGLER, the lab's dock)
//     A.root            the person (place and turn it)
//     A.play(clip, opts)   the person's clip ('Idle', 'Lasso_Throw' once, 'Lasso_Pull' ...)
//     A.update(dt, { yaw, pitch, bend, pull, spin })   the rod: yaw (radians, 0 = straight out, -Z), pitch (up from
//                       level), bend (0 straight .. 1 bent hard), pull (a direction the tip bends toward), spin (reel
//                       handle turns a second)
//     A.tip             the rod tip (world), A.butt
//     A.setLine(points) the line through these world points; A.bobber (a Group; place it)
import * as THREE from 'three';
import { ANGLER } from './scene.js';

const GAME = new URL('../../', import.meta.url).href;
export const ROD_LEN = 2.5;
export const HOLD = 'Idle';                   // the clip played while waiting (the rod is held at the hip)

export async function makeAngler(scene, { person = null, at = ANGLER } = {}) {
  if (!person) try {
    const { loadFolk, makePerson } = await import('../../src/actors/folk.js');
    const lib = await loadFolk(GAME);
    person = makePerson(lib, { outfit: 'farmer_m', palette: 'drifter', skin: 3, hair: 2, hat: true });
    person.play(HOLD, { fade: 0 });
  } catch (err) {
    console.warn('fishing lab: the game\'s people did not load, using a plain angler', err);
    const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: 0x8b5a3a });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 4, 8), mat); body.position.y = 0.95; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshLambertMaterial({ color: 0xc68d62 })); head.position.y = 1.62; g.add(head);
    person = { root: g, bones: {}, play() { return false; }, update() {} };
  }
  person.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  person.root.position.copy(at); person.root.rotation.y = Math.PI;      // (people face +Z; the lake is -Z)
  scene.add(person.root);

  // ── the rod: a tapered cane drawn along a curve, rebuilt in place each frame ──────────────────────────────────────
  const RINGS = 16, SIDES = 5;
  const rodPos = new Float32Array(RINGS * SIDES * 3), rodCol = new Float32Array(RINGS * SIDES * 3), rodIdx = [];
  for (let i = 0; i < RINGS; i++) {
    const t = i / (RINGS - 1), cork = t < 0.13, wrap = !cork && Math.abs((t * 9) % 1 - 0.5) < 0.06;
    const c = cork ? [0.62, 0.45, 0.27] : wrap ? [0.25, 0.12, 0.08] : [0.85 - t * 0.12, 0.7 - t * 0.1, 0.4 - t * 0.06];
    for (let k = 0; k < SIDES; k++) rodCol.set(c, (i * SIDES + k) * 3);
    if (i < RINGS - 1) for (let k = 0; k < SIDES; k++) { const a = i * SIDES + k, b = i * SIDES + (k + 1) % SIDES, c2 = a + SIDES, d = b + SIDES; rodIdx.push(a, c2, b, b, c2, d); }
  }
  const rodGeo = new THREE.BufferGeometry();
  rodGeo.setAttribute('position', new THREE.BufferAttribute(rodPos, 3)); rodGeo.setAttribute('color', new THREE.BufferAttribute(rodCol, 3)); rodGeo.setIndex(rodIdx);
  const rod = new THREE.Mesh(rodGeo, new THREE.MeshLambertMaterial({ vertexColors: true })); rod.castShadow = true; rod.frustumCulled = false; scene.add(rod);
  // the reel: a spool across the rod under the handle, and its turning handle
  const reel = new THREE.Group(); scene.add(reel);
  const metal = new THREE.MeshLambertMaterial({ color: 0x8f8a7e });
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.035, 14).rotateZ(Math.PI / 2), metal); reel.add(spool);
  const crank = new THREE.Group(); crank.position.x = 0.025; reel.add(crank);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.008), metal); arm.position.y = 0.03; crank.add(arm);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.025, 6).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2a2018 })); knob.position.set(0.014, 0.058, 0); crank.add(knob);
  reel.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // ── the line and the bobber ────────────────────────────────────────────────────────────────────────────────────────
  const MAXP = 64, linePos = new Float32Array(MAXP * 3);
  const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3)); lineGeo.setDrawRange(0, 0);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf4f1e6, transparent: true, opacity: 0.85 })); line.frustumCulled = false; line.renderOrder = 4; scene.add(line);
  const bobber = new THREE.Group(); scene.add(bobber);
  const R = 0.055;
  const top = new THREE.Mesh(new THREE.SphereGeometry(R, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xd8321e })); bobber.add(top);
  const bot = new THREE.Mesh(new THREE.SphereGeometry(R, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xf2efe6 })); bobber.add(bot);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6), new THREE.MeshLambertMaterial({ color: 0xd8321e })); stick.position.y = R + 0.03; bobber.add(stick);
  bobber.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  bobber.visible = false;

  // where the right hand holds: the middle of the fist (as the game's lasso does)
  const hand = new THREE.Vector3(), tmp = new THREE.Vector3();
  // (the bones' world places, into the scene's own frame: in the game the dock's frame is turned to its lake)
  function handPoint(v) {
    const b = person.bones || {}, w = b.WristR, m = b.Middle1R;
    if (!w) return v.copy(person.root.position).add(new THREE.Vector3(0.25, 0.95, -0.2));
    w.getWorldPosition(v); scene.worldToLocal(v); if (!m) return v;
    m.getWorldPosition(tmp); scene.worldToLocal(tmp); tmp.sub(v); const len = tmp.length();
    return v.addScaledVector(tmp, 0.5 + (len > 1e-4 ? 0.03 / len : 0));
  }
  const dir = new THREE.Vector3(), p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), pt = new THREE.Vector3(), tan = new THREE.Vector3(), nrm = new THREE.Vector3(), bin = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  let spinA = 0;
  const A = {
    root: person.root, person, bobber, line,
    tip: new THREE.Vector3(), butt: new THREE.Vector3(),
    play: (clip, opts) => person.play(clip, opts),
    hand: (v = new THREE.Vector3()) => handPoint(v),
    setLine(points) {
      const n = Math.min(points.length, MAXP);
      for (let i = 0; i < n; i++) linePos.set([points[i].x, points[i].y, points[i].z], i * 3);
      lineGeo.attributes.position.needsUpdate = true; lineGeo.setDrawRange(0, n); line.visible = n > 1;
    },
    update(dt, { yaw = 0, pitch = 0.6, bend = 0.1, pull = null, spin = 0 } = {}) {
      person.update(dt);
      person.root.updateMatrixWorld(true);
      handPoint(hand);
      // the rod points out from the hand: turned by yaw, raised by pitch; the butt a little behind the hand
      dir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      p0.copy(hand).addScaledVector(dir, -0.28);
      p1.copy(p0).addScaledVector(dir, ROD_LEN * 0.55);
      p2.copy(p0).addScaledVector(dir, ROD_LEN);
      // bent: the far end droops toward the pull (the line), more toward the tip
      const pd = pull ? pull.clone().normalize() : new THREE.Vector3(0, -1, 0);
      p2.addScaledVector(pd, ROD_LEN * 0.42 * bend); p1.addScaledVector(pd, ROD_LEN * 0.08 * bend);
      // (keep its length about the same: pull the tip back in along the curve)
      p2.sub(p0).setLength(ROD_LEN * (1 - 0.07 * bend)).add(p0);
      A.butt.copy(p0); A.tip.copy(p2);
      for (let i = 0; i < RINGS; i++) {
        const t = i / (RINGS - 1), u = 1 - t;
        pt.set(0, 0, 0).addScaledVector(p0, u * u).addScaledVector(p1, 2 * u * t).addScaledVector(p2, t * t);
        tan.set(0, 0, 0).addScaledVector(p1.clone().sub(p0), 2 * u).addScaledVector(p2.clone().sub(p1), 2 * t).normalize();
        nrm.crossVectors(tan, UP); if (nrm.lengthSq() < 1e-6) nrm.set(1, 0, 0); nrm.normalize(); bin.crossVectors(nrm, tan);
        const r = t < 0.13 ? 0.017 : 0.011 * (1 - t) + 0.0032;
        for (let k = 0; k < SIDES; k++) {
          const a = k / SIDES * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r;
          rodPos.set([pt.x + nrm.x * c + bin.x * s, pt.y + nrm.y * c + bin.y * s, pt.z + nrm.z * c + bin.z * s], (i * SIDES + k) * 3);
        }
      }
      rodGeo.attributes.position.needsUpdate = true; rodGeo.computeVertexNormals(); rodGeo.computeBoundingSphere();
      // the reel hangs under the rod just ahead of the cork, its spool across the rod
      reel.position.copy(p0).addScaledVector(dir, 0.36).addScaledVector(bin, -0.045);
      reel.lookAt(reel.position.clone().add(dir)); reel.rotateX(Math.PI / 2);
      spinA += spin * dt * Math.PI * 2; crank.rotation.x = spinA;
    },
    // fading in or out (0 gone .. 1 there): the person (the game's people fade by a screen pattern), the rod, the reel,
    // the line and the bobber (see-through). The game fades its angler in as the camera comes to the dock, and out as
    // it goes back to the rider
    setFade(f) {
      f = Math.max(0, Math.min(1, f));
      if ('fade' in person) person.fade = f; else person.root.visible = f > 0.5;
      for (const o of [rod, reel, line, bobber]) o.traverse((m) => { if (!m.material) return; if (m.material.userData.op == null) m.material.userData.op = m.material.opacity; m.material.transparent = f < 1 || m === line; m.material.opacity = m.material.userData.op * f; m.visible = f > 0.01 && (m !== line || line.visible); });
      for (const o of [rod, reel]) o.visible = f > 0.01;
    },
    // everything taken out of the scene (the person too, unless keepPerson: the host lent it)
    dispose({ keepPerson = false } = {}) {
      for (const o of [rod, reel, line, bobber]) { o.removeFromParent(); o.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }); }
      if (!keepPerson) { person.root.removeFromParent(); if (person.dispose) person.dispose(); }
    },
  };
  return A;
}
