// THE MINER IN ANOTHER SHIP'S HANGAR: the alarm, the red lights, the people running about, and the parked ship that
// gets shoved. (That the other two hangars can be flown into at all, what the Miner bumps into in them, how a shoved
// ship moves, and when the alarm's moment is, are plain numbers: src/flymodel.js OTHERS, visiting, pushOthers,
// stepOther. The ship's own "Safety violation" in the cockpit is the flying's: src/flying.js.)
//
// THE GAME'S MAKER (2026-11-18; asked "Should the Miner be able to fly in through the other two hangar doors?" he
// chose "Let it fly in and look round (the ships parked in there would need to be things it bumps into)"): "Lol, I'm
// sure kids will try to do this and it will make them laugh, so why not. I think it would be good if people can go in
// and then you would hear an alarm and red lights started spinning around in the hanger and people started running
// around and it started saying "Safety Violation" over and over in your cockpit. It would even be appropriate for the
// other ship to get moved around if they rammed it. But it would be reset the next time they entered into the other
// hanger. No need for damage or anything like that."
//
// SO, WHILE ANY OF THE FLOWN SHIP IS PAST ANOTHER HANGAR'S DOOR LINE (and not a moment longer: it all stops when the
// last of it is out again):
//   - THE ALARM SOUNDS, made by the game's own sound code (sound.alarm: two notes turn and turn about, no file), heard
//     as coming from the middle of that hangar.
//   - RED LIGHTS SPIN ROUND IN THAT HANGAR. Four beacons hang under its roof trusses (they are there, dark, all the
//     time: a few triangles drawn with the hangar). Lit, each throws two red beams that turn, a red patch that sweeps
//     the floor under it, and the whole hangar is washed red in time with them. All of it is drawn on top, glowing:
//     no lamp is added to the scene, so the station's saved light, its materials and its files are untouched, and
//     nothing casts a shadow. (The wash: seen from outside, a red pane across the door's opening; from inside, the
//     whole picture, cockpit and all.) It turns slowly on purpose: a little over one pulse a second.
//   - THE PEOPLE IN THAT HANGAR RUN ABOUT (src/people.js runAbout): each to another of the places people stand in on
//     that floor, and on again when they get there. They never choose a place under the flown ship or near the parked
//     one (under its wings neither), never a way that passes under either, and whoever one of the two is over when
//     the alarm starts, or the flown ship comes over, runs clear at once. THE PARKED SHIP WAITS FOR NOBODY (the game's
//     maker, 2026-11-19: "Aren't they supposed to be running away? If they are just standing there then then maybe
//     they deserve to be hit."): rammed, it slides whoever is beside it, and whoever it comes over is pushed out of
//     its way (flymodel.js pushedTo, people.js push). When the alarm stops they finish their run and go on with their day.
//   - NO BANNER, NO SCORE, NO DAMAGE, NO TIMER: nothing else happens. The few words along the top (the flying's own)
//     say whose hangar it is; the seat never lets the pilot out there.
//
// THE PARKED SHIP, SHOVED: where it is, is drawn every frame (its own room of the station and its own moving parts,
// by one move from where it is parked: a turn about straight up and a move across the floor, src/standing.js). Its
// cabin, its ways in, the walls a person feels and the patches the people keep off are told where it stands
// (boarding.stand, as for the Miner set down by hand) when it comes to rest, and a few times a second while it slides.
// What does not follow: the shade it throws on the floor in the hangar's saved light, and the fuel hose on the floor,
// both of which stay where it parks (the station's files; the same is true of the Miner).
//
// THE RESET ("it would be reset the next time they entered into the other hanger"): the moment the game already has
// for setting a hangar out afresh. Once the flown ship is out of that hangar and the hangar is not being drawn (flown
// away from, or looked at from somewhere it cannot be seen), its ship is back where it is parked, with everything
// that follows it. So it is never seen to jump back, and whoever next comes in, on foot or flying, finds it in its place.
//
// A PHONE'S WAY OF DRAWING THE STATION FROM OUTSIDE (src/outside.js: plain stand-ins behind the other hangar doors):
// lined up with another hangar's door and close, that hangar is asked for as the real one (outside.near), well before
// the ship is at the door; the stand-in fades away over it.
//
//   const visit = makeVisit({ W, boarding, outside, people })     people: () -> the station's people, or null
//   visit.others                 the ships parked in the other hangars, as the flying shoves them (flymodel.js makeOther)
//   visit.fly(F)                 the flying now (src/flying.js), or null
//   visit.update(dt, camera)     once a frame, after the camera is set and before the picture
//   visit.alarm                  the hangar the alarm is on in (its facts: flymodel.js OTHERS), or null
//   visit.focus                  where the flown ship is while it is about the station (the people nearest it are
//                                the ones about), or null
//   visit.reset(id)              a ship put back where it is parked at once (the rigs)
//   visit.state()                for the rigs: what is on, what has been asked for
import * as THREE from 'three';
import * as M from './flymodel.js';
import { sound } from './sound.js';
import { DOOR } from '../kit/outside-plan.js';

// lamps: where the beacons hang, along the hangar from its back (x, under the trusses there) and either side of its
// middle line (m); y: how high. turn: radians a second. beam: how long, how wide at its end, how far it dips. pool: the
// red patch on the floor (its reach, m). wash: the least and the most of the red wash. sound: the alarm's own.
// run: how often the people are looked at (s). tell: how often a sliding ship's place is told to the cabin and the
// walls (s). real: a phone's real hangar: how near its door (m out from the door's line) and how nearly on its line
// (m to the side) the ship is when it is asked for, and when it is let go again. room, low: how much room round the
// flown ship the people keep (m), and how low it has to be (m, its feet over the floor) for them to mind it.
export const ALARM = {
  lamps: { x: [33, 49], z: [-6, 6], y: 9.2 }, turn: 3.4, beam: { len: 15, r: 2.3, dip: 0.36, glow: 0.2 }, pool: { r: 11, glow: 0.2 }, wash: [0.015, 0.07], colour: 0xff2a14,
  sound: { volume: 0.55, near: 12, far: 160, notes: [640, 480], beat: 0.42 }, run: 0.4, tell: 0.3, real: { out: 38, side: 13, outGo: 48, sideGo: 16 }, room: 1.3, low: 3.6,
};

export function makeVisit({ W, boarding = null, outside = null, people = () => null }) {
  const others = M.OTHERS.map(M.makeOther);
  // ── each parked ship as it is drawn: its own room, the moving parts that are its alone, its hangar ──
  const views = others.map((O) => {
    const cfg = O.cfg, zone = W.room(cfg.room), hangar = W.room(cfg.hangar);
    const mine = new Set(), shared = new Set();
    for (const D of W.built.doors) for (const leaf of D.leaves) for (const im of leaf.meshes || []) (D.zone === cfg.room ? mine : shared).add(im);
    // (drawn, told: where it was last drawn and last told to be; parked, as the station has it, nothing is touched)
    return { O, cfg, zone, hangar, meshes: [...mine].filter((im) => !shared.has(im)), D: new THREE.Matrix4(), drawn: keyOf(O), told: [O.p[0], O.p[1], O.yaw], tellT: 0, clearT: 0, home: M.makeOther(cfg) };
  }).filter((v) => v.zone && v.hangar);
  const counts = { alarms: 0, stops: 0, resets: 0, waits: 0, tells: 0, ran: 0, pushed: 0, soundAsked: 0, soundHeard: 0 };
  let flying = null, alarm = null, siren = null, sirenFor = null, phase = 0, runT = 0, near = null;
  const focus = new THREE.Vector3(); let focusOn = false;

  // the ship drawn where it is: one move from where it is parked (null: parked)
  function keyOf(O) { return O.p[0].toFixed(4) + ',' + O.p[1].toFixed(4) + ',' + O.yaw.toFixed(5); }
  function draw(v) {
    const k = keyOf(v.O); if (v.drawn === k) return; v.drawn = k;
    const e = M.otherElements(v.O);
    if (e) v.D.fromArray(e); else v.D.identity();
    v.zone.group.matrixAutoUpdate = false; v.zone.group.matrix.copy(v.D); v.zone.group.matrixWorldNeedsUpdate = true;
    for (const im of v.meshes) { im.matrixAutoUpdate = false; im.matrix.copy(v.D); im.matrixWorldNeedsUpdate = true; }
  }
  // ... and told to its cabin, its ways in, the walls and (through boarding.stands) the people's patches. (Not for a
  // hair's breadth: a ship pressed against its hangar's wall by the flown one trembles, and nobody need hear of that.)
  function tell(v) {
    const O = v.O, T = v.told, home = !M.otherStand(O);
    if (Math.abs(O.p[0] - T[0]) < (home ? 1e-9 : 0.03) && Math.abs(O.p[1] - T[1]) < (home ? 1e-9 : 0.03) && Math.abs(O.yaw - T[2]) < (home ? 1e-9 : 0.004)) return;
    v.told = [O.p[0], O.p[1], O.yaw]; counts.tells++;
    if (boarding && boarding.stand) boarding.stand(v.cfg.id, home ? null : v.D.clone());
  }
  function reset(v) { M.resetOther(v.O); draw(v); tell(v); counts.resets++; }

  // ── THE BEACONS: dark, hung under each hangar's trusses, drawn with it ──
  const red = new THREE.Color(ALARM.colour), A = ALARM;
  const lampAt = (cfg) => A.lamps.x.flatMap((x) => A.lamps.z.map((dz) => [x, A.lamps.y, cfg.at[2] + dz]));
  const owned = [];
  const own = (o) => { owned.push(o); return o; };
  const bodyGeo = (() => {
    // (a short stem from the truss, a cap, and the glass dome under it)
    const parts = [[new THREE.CylinderGeometry(0.05, 0.05, 0.34, 6).translate(0, 0.33, 0), 0x2a2e34], [new THREE.CylinderGeometry(0.2, 0.24, 0.12, 12).translate(0, 0.1, 0), 0x3a3f47], [new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, 0.05, 0), 0x4a1410]];
    const pos = [], col = [], idx = [], c = new THREE.Color();
    for (const [g, hex] of parts) { const base = pos.length / 3; c.set(hex); for (let i = 0; i < g.attributes.position.count; i++) { pos.push(g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i)); col.push(c.r, c.g, c.b); } for (const i of g.index.array) idx.push(base + i); g.dispose(); }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.setIndex(idx); return own(out);
  })();
  const bodyMat = own(new THREE.MeshBasicMaterial({ vertexColors: true }));
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
  for (const v of views) {
    const L = lampAt(v.cfg), im = new THREE.InstancedMesh(bodyGeo, bodyMat, L.length); im.name = 'alarm beacons';
    L.forEach((p, i) => im.setMatrixAt(i, _m.makeTranslation(p[0], p[1], p[2])));
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); v.hangar.group.add(im); v.lamps = L; v.beacons = im;
  }
  // ── LIT: the beams, the domes' glow, the patches on the floor, the wash. One set, hung on whichever hangar the alarm
  // is on in; not in the scene at all otherwise. Made the first time it is wanted. ──
  let lit = null;
  function makeLit() {
    const g = new THREE.Group(); g.name = 'alarm lights';
    const glowMat = (opacity) => own(new THREE.MeshBasicMaterial({ color: red, vertexColors: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false }));
    // a beam: a cone from the lamp along +x, bright at the lamp and fading to nothing at its end
    const cone = own(new THREE.CylinderGeometry(A.beam.r, 0.14, A.beam.len, 14, 4, true).rotateZ(-Math.PI / 2).translate(A.beam.len / 2, 0, 0));
    { const P = cone.attributes.position, c = new Float32Array(P.count * 3); for (let i = 0; i < P.count; i++) { const k = Math.pow(Math.max(0, 1 - P.getX(i) / A.beam.len), 1.6); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; } cone.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    const beams = new THREE.InstancedMesh(cone, glowMat(A.beam.glow), 8); beams.frustumCulled = false; beams.renderOrder = 6;
    // a dome, lit
    const dome = own(new THREE.SphereGeometry(0.27, 10, 6)); { const n = dome.attributes.position.count, c = new Float32Array(n * 3).fill(1); dome.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    const domes = new THREE.InstancedMesh(dome, glowMat(0.95), 4); domes.frustumCulled = false; domes.renderOrder = 6;
    // a patch on the floor: two fans of red, one under each beam, brightest part way out, nothing at their edges
    const pool = own((() => {
      const pos = [], col = [], idx = [], rings = [[0.04, 0.2], [0.3, 1], [0.65, 0.55], [1, 0]], spans = [[-0.5, 0], [-0.25, 0.75], [0, 1], [0.25, 0.75], [0.5, 0]];
      for (const side of [0, Math.PI]) {
        const base = pos.length / 3;
        for (const [a, ka] of spans) for (const [r, kr] of rings) { pos.push(Math.cos(side + a) * r * A.pool.r, 0, -Math.sin(side + a) * r * A.pool.r); const k = ka * kr; col.push(k, k, k); }
        for (let i = 0; i + 1 < spans.length; i++) for (let j = 0; j + 1 < rings.length; j++) { const a = base + i * rings.length + j, b = a + rings.length; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      }
      const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.setIndex(idx); return out;
    })());
    const poolMat = glowMat(A.pool.glow); poolMat.polygonOffset = true; poolMat.polygonOffsetFactor = -2; poolMat.polygonOffsetUnits = -2;
    const pools = new THREE.InstancedMesh(pool, poolMat, 4); pools.frustumCulled = false; pools.renderOrder = 5;
    // the wash: a pane across the door's opening (seen from outside), and the whole picture (from inside)
    const paneMat = own(new THREE.MeshBasicMaterial({ color: red, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false }));
    const pane = new THREE.Mesh(own(new THREE.PlaneGeometry(DOOR.w, DOOR.h).rotateY(Math.PI / 2)), paneMat); pane.renderOrder = 7;
    const allMat = own(new THREE.ShaderMaterial({ uniforms: { c: { value: red.clone() }, a: { value: 0 } }, vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: 'uniform vec3 c; uniform float a;\nvoid main() {\n  gl_FragColor = vec4(c * a, 1.0);\n  #include <tonemapping_fragment>\n  #include <colorspace_fragment>\n}',
      blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    const all = new THREE.Mesh(own(new THREE.PlaneGeometry(2, 2)), allMat); all.frustumCulled = false; all.renderOrder = 9999;
    g.add(pools, beams, domes, pane, all);
    // (each glowing thing is drawn once, both its faces together: it only adds light; the pane or the whole picture, never both)
    return { g, beams, domes, pools, pane, paneMat, all, allMat, tris: (cone.index.count / 3) * 8 + (dome.index.count / 3) * 4 + (pool.index.count / 3) * 4 + 2, draws: 4 };
  }
  function light(v, camera) {
    if (!lit) lit = makeLit();
    if (lit.g.parent !== W.scene) W.scene.add(lit.g);
    v.lamps.forEach((p, i) => {
      const a = phase + i * 0.9;
      for (const half of [0, 1]) lit.beams.setMatrixAt(i * 2 + half, _m.compose(_p.set(p[0], p[1], p[2]), _q.setFromEuler(_e.set(0, a + half * Math.PI, -A.beam.dip, 'YZX')), _one));
      lit.domes.setMatrixAt(i, _m.makeTranslation(p[0], p[1] + 0.02, p[2]));
      lit.pools.setMatrixAt(i, _m.compose(_p.set(p[0], v.cfg.at[1] + 0.05, p[2]), _q.setFromEuler(_e.set(0, a, 0)), _one));
    });
    lit.beams.instanceMatrix.needsUpdate = true; lit.domes.instanceMatrix.needsUpdate = true; lit.pools.instanceMatrix.needsUpdate = true;
    // (the wash rises and falls as the beams come round: twice a turn)
    const k = A.wash[0] + (A.wash[1] - A.wash[0]) * (0.5 + 0.5 * Math.cos(2 * phase)), inside = v.hangar.box.containsPoint(camera.position) && camera.position.x < DOOR.x + 0.4;
    lit.pane.position.set(DOOR.x - 0.35, v.cfg.at[1] + DOOR.h / 2, v.cfg.at[2]); lit.pane.visible = !inside; lit.paneMat.opacity = k * 1.6;
    lit.all.visible = inside; lit.allMat.uniforms.a.value = k;
  }
  function dark() { if (lit && lit.g.parent) lit.g.parent.remove(lit.g); }

  // ── the people of that hangar, kept running; never under the flown ship, never in the shoved one ──
  const hull = (() => { let a0 = 0, a1 = 0, r1 = 0; for (const p of M.MINER.points) { a0 = Math.min(a0, p[0]); a1 = Math.max(a1, p[0]); r1 = Math.max(r1, Math.abs(p[2])); } return { a0, a1, r1 }; })();
  const _w = [0, 0, 0];
  // where the people on a hangar's floor stand: [[x, z], ...]
  function feetOn(v) {
    const pp = people(), B = v.hangar.box, out = []; if (!pp) return out;
    for (const P of pp.list) if (!P.hidden && !P.away && P.pos.y < 2.4 && P.pos.x > B.min.x && P.pos.x < B.max.x && P.pos.z > B.min.z && P.pos.z < B.max.z) out.push([P.pos.x, P.pos.z]);
    return out;
  }
  // (under the flown ship, while it is low; and anywhere near the parked ship, under its wings too: while the alarm
  // is on it may be shoved at any moment)
  function avoidFor(S, v) {
    const low = S.p[1] < A.low;
    return (pos) => {
      if (low) { const r = M.unturn(S.q, [pos.x - S.p[0], 0, pos.z - S.p[2]]); if (r[0] > hull.a0 - A.room && r[0] < hull.a1 + A.room && Math.abs(r[2]) < hull.r1 + A.room) return true; }
      _w[0] = pos.x; _w[1] = 1; _w[2] = pos.z; return M.insideOther(v.O, _w, M.SHOVE.person + 0.5);
    };
  }

  const api = {
    others, views,
    get alarm() { return alarm; }, get focus() { return focusOn ? focus : null; }, get near() { return near; },
    fly(F) { flying = F || null; },
    update(dt, camera = W.camera) {
      const S = flying && flying.on ? flying.S : null, there = S ? M.visiting(S) : null;
      // the ships: sliding on, drawn where they are, told where they stand
      for (const v of views) {
        const O = v.O, was = M.otherStill(O);
        // (it waits for nobody: whoever it comes over as it slides is pushed out of its way)
        if (!was) { M.stepOther(O, dt); const pp = people(); if (pp && pp.push) counts.pushed += pp.push(v.hangar.box, (pos) => M.pushedTo(O, [pos.x, pos.z])); }
        draw(v);
        if (M.otherStill(O)) tell(v); else if ((v.tellT -= dt) <= 0) { v.tellT = A.tell; tell(v); }
        // THE RESET: the flown ship out of this hangar, and the hangar not being drawn. (Never onto anyone: whoever
        // stands where the ship parks is sent off it first, unseen, and it is put back once they are clear.)
        if (O.moved && there !== v.cfg && !v.hangar.group.visible && (v.clearT -= dt) <= 0) {
          const pp = people(), on = (pos) => { _w[0] = pos.x; _w[1] = 1; _w[2] = pos.z; return M.insideOther(v.home, _w, 0.6); };
          if (pp && feetOn(v).some(([x, z]) => on({ x, z }))) { v.clearT = A.run; if (pp.flee) pp.flee(v.cfg.at[0], v.cfg.at[2], 0, 2.5, { inside: on }); counts.waits++; } else reset(v);
        }
      }
      // the alarm: on while it is in there, off the moment it is out
      if (there !== alarm) {
        if (siren) { siren.stop(); siren = null; }
        if (alarm) counts.stops++;
        alarm = there; sirenFor = null; runT = 0;
        if (alarm) counts.alarms++; else dark();
      }
      if (alarm) {
        const v = views.find((q) => q.cfg === alarm);
        phase += A.turn * dt;
        if (v) {
          light(v, camera);
          // (the sound, asked for until the page may make one: a tap or a key has to have come first)
          if (!siren) { if (sirenFor !== alarm) { sirenFor = alarm; counts.soundAsked++; } siren = sound.alarm({ at: { x: (alarm.bay.x0 + DOOR.x) / 2, y: 4, z: alarm.at[2] }, ...A.sound }); if (siren) counts.soundHeard++; }
          if ((runT -= dt) <= 0) { runT = A.run; const pp = people(); if (pp && pp.runAbout) counts.ran = Math.max(counts.ran, pp.runAbout(alarm.hangar, { avoid: avoidFor(S, v) })); }
        }
      }
      // where the people gather: about the flown ship, while it is about the station
      focusOn = !!S && !S.landed && M.boxDist(S.p) < 200;
      if (focusOn) focus.set(S.p[0], Math.max(0, Math.min(3, S.p[1])), S.p[2]);
      // a phone's real hangar: lined up with another hangar's door and close, or in it
      let want = null;
      if (S && !S.landed) for (const o of M.OTHERS) { const R = A.real, held = near === o.hangar, dx = S.p[0] - DOOR.x, dz = Math.abs(S.p[2] - o.at[2]); if (dx < (held ? R.outGo : R.out) && dz < (held ? R.sideGo : R.side)) want = o.hangar; }
      near = want; if (outside) outside.near = near;
    },
    reset(id = null) { for (const v of views) if (!id || v.cfg.id === id) reset(v); },
    state: () => ({ alarm: alarm ? alarm.id : null, siren: !!siren, lights: !!(lit && lit.g.parent), wash: lit && lit.g.parent ? +(lit.all.visible ? lit.allMat.uniforms.a.value : lit.paneMat.opacity).toFixed(3) : 0, washAll: !!(lit && lit.g.parent && lit.all.visible), near, focus: focusOn, ...counts,
      ships: views.map((v) => ({ id: v.cfg.id, moved: v.O.moved, still: M.otherStill(v.O), p: v.O.p.map((x) => +x.toFixed(2)), yaw: +(v.O.yaw * 180 / Math.PI).toFixed(1), hit: +v.O.hit.toFixed(1), from: [+(v.O.p[0] - v.cfg.at[0]).toFixed(2), +(v.O.p[1] - v.cfg.at[2]).toFixed(2)], seen: v.hangar.group.visible })),
      cost: lit ? { draws: lit.draws, tris: lit.tris } : null, beacons: views.reduce((n, v) => n + v.lamps.length, 0), beaconTris: (bodyGeo.index.count / 3) * 4 }),
    dispose() { if (siren) siren.stop(); dark(); for (const v of views) v.hangar.group.remove(v.beacons); for (const o of owned) o.dispose(); },
  };
  return api;
}
