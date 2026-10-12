// THE LASSO: the rope, drawn in code, and the throw from start to end. The player (player.js) walks or rides into reach,
// turns, and plays the clips (Lasso_Swing, Lasso_Throw, Lasso_Pull) by reading L.phase; this file draws the rope from
// the right hand and flies the loop. A right pick: the loop drops over the target's neck, pulls tight, and the rope
// stays taut from the hand while the target is led along (it follows when the player moves off, and is hauled in a
// little when they stand). A wrong pick: the loop lands on the head but tangles, slides off and drops to the ground,
// and the rope goes slack; about a second and a half later it is reeled back in.
//
//   const L = makeLasso({ scene, W })
//   L.throw({ target, hand, leader, good, onLand, onCaught, onMissed, hold, lead, spin })  -> true if thrown (false: busy)
//     target  what is roped: an animal from makeAnimal (its neck(v) and neckRadius are used), a person from makePerson
//             (its Neck bone), or anything with a .root (Object3D) or a .position (Vector3), and maybe .height
//     hand()  -> Vector3: where the rope leaves the thrower's hand this frame (the player gives it)
//     leader() -> Vector3: where the thrower is (their feet; a led target is kept within the rope's length of it)
//     good    a right pick? (the target IS the answer: the lasso just shows it)
//     onLand(good)      the moment the loop reaches the target
//     onCaught(handle)  a right pick: the loop has pulled tight. handle: { target, release(), held, lead, length }
//     onMissed()        a wrong pick: called once the tangled loop has dropped (about 1.5 s after it landed)
//     onCancel()        the throw was called off before it was settled (L.cancel(): the player jumped elsewhere)
//     hold    seconds the rope stays on after the catch before the loop is slipped off (default 3; Infinity: until
//             handle.release()). lead (default true): while held, the target is led along: its .root moved, turned and
//             set walking (play('Walk') if it has clips) when the rope pulls; false: the game moves it itself
//     spin(t) -> the way (radians, as rotation.y) the loop lies from the hand t seconds into the swing, so it turns in
//             step with the hand's own circle in Lasso_Swing (the player gives it); left out, it spins on its own
//   L.update(dt)      every frame after the thrower has been updated (it reads the hand's bone)
//   L.phase           'idle' | 'swing' | 'throw' | 'fly' | 'catch' | 'held' | 'tangle' | 'reel'
//   L.t               seconds into the phase;  L.busy: not idle;  L.cancel(): drop it all at once (reels in, no calls)
//   LASSO             the timings and sizes (seconds, metres)
import * as THREE from 'three';

export const LASSO = {
  swing: 1.0,            // the loop spun overhead (Lasso_Swing is one second: once through)
  release: 0.40,         // into Lasso_Throw, when the arm comes forward past the shoulder and lets go (0.38-0.42 s in the clip)
  windBack: 0.18,        // ... after the arm has gone back first (the loop swung round behind on the right)
  flyMin: 0.32, flyMax: 0.8, flySpeed: 21,   // the loop's flight: distance / flySpeed, kept between these
  tighten: 0.25,         // the loop pulling tight round the neck
  hold: 3,               // the rope kept on after a catch (a default: the game can release sooner)
  tangle: 1.5,           // a wrong pick: tangled on the head, then dropped
  reel: 0.45,            // the rope coiled back in
  loop: 0.62,            // the loop's radius while it is swung (metres)
  open: 0.72,            // ... and as it flies
  spin: 2.3,             // turns a second, overhead
  rope: 0.02,            // the rope's own radius (a fat 4 cm across, so it reads against the grass from 9 m back)
  haul: 0.7,             // metres a second a held target is hauled in while the thrower stands still
  near: 3.2,             // ... down to this many metres
};

const POINTS = 96, SIDES = 6;
const ease = (t) => t * t * (3 - 2 * t), easeOut = (t) => 1 - (1 - t) * (1 - t);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// a tube along a line of points, its corners moved every frame (made once: no new geometry while it flies)
function makeRope() {
  const pos = new Float32Array(POINTS * SIDES * 3), nor = new Float32Array(POINTS * SIDES * 3), idx = [];
  for (let i = 0; i < POINTS - 1; i++) for (let s = 0; s < SIDES; s++) {
    const a = i * SIDES + s, b = i * SIDES + (s + 1) % SIDES, c = a + SIDES, d = b + SIDES;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xe6d3a3, emissive: 0x3a2e1c, roughness: 0.9, metalness: 0 }));
  mesh.name = 'lasso'; mesh.frustumCulled = false; mesh.castShadow = true; mesh.visible = false;
  const T = new THREE.Vector3(), N = new THREE.Vector3(), Bn = new THREE.Vector3(), prevT = new THREE.Vector3(), q = new THREE.Quaternion(), o = new THREE.Vector3();
  // lay the tube along pts (count of them used; the rest folded onto the last)
  mesh.lay = (pts, count, radius) => {
    count = Math.max(2, Math.min(POINTS, count));
    for (let i = 0; i < POINTS; i++) {
      const k = Math.min(i, count - 1), p = pts[k];
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(count - 1, k + 1)];
      T.subVectors(b, a); if (T.lengthSq() < 1e-12) T.copy(prevT.lengthSq() ? prevT : o.set(0, 0, 1)); T.normalize();
      if (i === 0) { N.set(0, 1, 0); if (Math.abs(T.y) > 0.9) N.set(1, 0, 0); N.sub(o.copy(T).multiplyScalar(N.dot(T))).normalize(); }
      else { q.setFromUnitVectors(prevT, T); N.applyQuaternion(q); N.sub(o.copy(T).multiplyScalar(N.dot(T))).normalize(); }   // (carried along the bends: no twist)
      prevT.copy(T); Bn.crossVectors(T, N);
      for (let s = 0; s < SIDES; s++) {
        const ang = (s / SIDES) * Math.PI * 2, c = Math.cos(ang), sn = Math.sin(ang), j = (i * SIDES + s) * 3;
        const nx = N.x * c + Bn.x * sn, ny = N.y * c + Bn.y * sn, nz = N.z * c + Bn.z * sn;
        pos[j] = p.x + nx * radius; pos[j + 1] = p.y + ny * radius; pos[j + 2] = p.z + nz * radius;
        nor[j] = nx; nor[j + 1] = ny; nor[j + 2] = nz;
      }
    }
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  };
  return mesh;
}

export function makeLasso({ scene, W }) {
  const rope = makeRope(); scene.add(rope);
  const pts = Array.from({ length: POINTS }, () => new THREE.Vector3());
  const L = { phase: 'idle', t: 0, busy: false, rope, target: null };
  let job = null;           // the throw under way: its options and what it has worked out
  const H = new THREE.Vector3(), C = new THREE.Vector3(), Nk = new THREE.Vector3(), P0 = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), axis = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();

  // where on the target the loop goes, this frame
  function neckOf(t, out) {
    if (t.neck) return t.neck(out);
    if (t.bones && t.bones.Neck) return t.bones.Neck.getWorldPosition(out);
    if (t.root) { t.root.getWorldPosition(out); out.y += (t.height || 1.2) * 0.9; return out; }
    out.copy(t.position || out); out.y += (t.height || 1.2) * 0.9; return out;
  }
  const neckRadius = (t) => t.neckRadius || (t.bones && t.bones.Neck ? 0.09 : 0.22);
  function forwardOf(t, out) {
    const r = t.root; if (!r) return out.set(0, 0, 1);
    r.updateWorldMatrix(true, false); const e = r.matrixWorld.elements; return out.set(e[8], 0, e[10]).normalize();
  }
  const rootPos = (t, out) => (t.root ? t.root.getWorldPosition(out) : out.copy(t.position));

  // a ring of n points round centre c, in the plane across normal nrm, radius r (wobble: a ragged, tangled ring),
  // starting at the point nearest `near` (where the rope's knot is), written into pts from index k; returns the next index
  function ring(k, c, nrm, r, n, near, wobble = 0, time = 0) {
    axis.copy(nrm).normalize();
    u.subVectors(near, c); u.sub(tmp.copy(axis).multiplyScalar(u.dot(axis)));
    if (u.lengthSq() < 1e-8) u.set(1, 0, 0).sub(tmp.copy(axis).multiplyScalar(axis.x));
    u.normalize(); v.crossVectors(axis, u);
    for (let i = 0; i <= n && k < POINTS; i++, k++) {
      const a = (i / n) * Math.PI * 2, rr = r * (1 + wobble * (0.22 * Math.sin(3 * a + time * 7) + 0.12 * Math.sin(5 * a - time * 11)));
      pts[k].copy(c).addScaledVector(u, Math.cos(a) * rr).addScaledVector(v, Math.sin(a) * rr);
      if (wobble) pts[k].y += wobble * 0.06 * Math.sin(4 * a + time * 9);
    }
    return k;
  }
  // a rope from a to b in n points, hanging down by sag in the middle (a parabola: near enough a rope's curve)
  function span(k, a, b, n, sag, floorAt = null) {
    for (let i = 0; i < n && k < POINTS; i++, k++) {
      const f = i / (n - 1); pts[k].lerpVectors(a, b, f); pts[k].y -= sag * 4 * f * (1 - f);
      if (floorAt) { const g = floorAt(pts[k].x, pts[k].z) + 0.02; if (pts[k].y < g) pts[k].y = g; }
    }
    return k;
  }
  const ground = (x, z) => W.heightAt(x, z);
  const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  L.throw = ({ target, hand, leader, good = true, onLand, onCaught, onMissed, onCancel, hold = LASSO.hold, lead = true, spin = null } = {}) => {
    if (L.busy || !target || !hand) return false;
    job = { target, hand, leader, good, onLand, onCaught, onMissed, onCancel, hold, lead, spin, from: new THREE.Vector3(), mid: new THREE.Vector3(),
      fly: 0.5, length: 6, handle: null, drop: new THREE.Vector3(), led: false, ang: 0 };
    L.target = target; set('swing'); rope.visible = true; return true;
  };
  function set(phase) { L.phase = phase; L.t = 0; L.busy = phase !== 'idle'; if (phase === 'idle') { rope.visible = false; job = null; L.target = null; } }
  // (cancelled before it was settled either way, onCancel says so: the game isn't left waiting for a catch or a miss)
  L.cancel = () => {
    if (!job || L.phase === 'idle' || L.phase === 'reel') return;
    const unsettled = L.phase !== 'held', f = job.onCancel;
    if (job.handle) job.handle.held = false; stopLead(); set('reel');
    if (unsettled) fire(f);
  };
  function stopLead() {
    if (job && job.led && job.target.play) job.target.play('Idle', { fade: 0.3 });
    if (job) job.led = false;
  }
  const fire = (fn, ...a) => { if (fn) try { fn(...a); } catch (e) { console.error(e); } };

  L.update = (dt) => {
    if (!job) return;
    L.t += dt;
    const t = job.target;
    job.hand(H);
    let k = 0;
    switch (L.phase) {
      case 'swing': case 'throw': {
        // spun overhead: the loop's middle circles the hand, a little above it, turning with the hand (counterclockwise
        // seen from above). Throwing, it is swung back round behind on the right as the arm goes back, then whipped
        // forward round the right side and out toward the target as the arm comes through
        neckOf(t, Nk); const toT = Math.atan2(Nk.x - H.x, Nk.z - H.z);
        let ang, lift = 0.22;
        if (L.phase === 'swing') { ang = job.ang = job.spin ? job.spin(L.t) : L.t * LASSO.spin * Math.PI * 2; }
        else {
          const from = wrapA(job.ang - toT), back = -2.4;                  // (relative to the target: 0 straight at it, - its right)
          ang = L.t < LASSO.windBack ? toT + from + (back - from) * ease(L.t / LASSO.windBack)
            : toT + back * (1 - ease(Math.min(1, (L.t - LASSO.windBack) / (LASSO.release - LASSO.windBack))));
          lift = 0.22 - 0.25 * Math.min(1, L.t / LASSO.release);
        }
        C.set(H.x + Math.sin(ang) * LASSO.loop * 0.85, H.y + lift, H.z + Math.cos(ang) * LASSO.loop * 0.85);
        tmp.set(Math.sin(ang) * 0.25, 1, Math.cos(ang) * 0.25);           // (tilted a little, out from the hand)
        k = span(0, H, P0.copy(C).addScaledVector(tmp2.subVectors(H, C).setY(0).normalize(), LASSO.loop), 4, 0);
        k = ring(k, C, tmp, LASSO.loop, 30, H);
        if (L.phase === 'swing' && L.t >= LASSO.swing) set('throw');
        else if (L.phase === 'throw' && L.t >= LASSO.release) {
          job.from.copy(C); const d = job.from.distanceTo(Nk);
          job.fly = Math.max(LASSO.flyMin, Math.min(LASSO.flyMax, d / LASSO.flySpeed));
          set('fly');
        }
        break;
      }
      case 'fly': {
        // along an arc from where it left the hand to the neck, opening out and turning to drop over the head
        neckOf(t, Nk); const f = Math.min(1, L.t / job.fly), e = easeOut(f), d = job.from.distanceTo(Nk);
        job.mid.lerpVectors(job.from, Nk, 0.5); job.mid.y += 0.6 + d * 0.18;
        C.copy(job.from).multiplyScalar((1 - e) * (1 - e)).addScaledVector(job.mid, 2 * e * (1 - e)).addScaledVector(Nk, e * e);
        forwardOf(t, tmp2); tmp.copy(up).lerp(tmp2, ease(f) * 0.7).normalize();
        const r = LASSO.loop + (LASSO.open - LASSO.loop) * Math.min(1, f * 2);
        tmp2.copy(C); tmp2.addScaledVector(v.subVectors(H, C).setY(0).normalize(), r);   // (the knot: the near side of the loop)
        k = span(0, H, tmp2, 26, 0.12 + d * 0.03, ground);
        k = ring(k, C, tmp, r, 30, H);
        if (f >= 1) {
          job.length = Math.max(LASSO.near, flat(rootPos(t, tmp), job.leader ? job.leader() : H));
          fire(job.onLand, job.good);
          set(job.good ? 'catch' : 'tangle');
          if (job.good) {
            const handle = job.handle = { target: t, held: true, lead: job.lead, length: job.length,
              release: () => { if (handle.held) { handle.held = false; stopLead(); if (L.phase === 'held' || L.phase === 'catch') set('reel'); } } };
          } else job.drop.copy(Nk);
        }
        break;
      }
      case 'catch': case 'held': {
        // tight round the neck, the rope straight from the hand
        neckOf(t, Nk); const f = Math.min(1, L.t / LASSO.tighten), nr = neckRadius(t) * 1.08;
        const r = L.phase === 'held' ? nr : LASSO.open + (nr - LASSO.open) * ease(f);
        forwardOf(t, tmp2); tmp.copy(tmp2).addScaledVector(up, 0.6).normalize();
        C.copy(Nk);
        const knot = tmp2.copy(C).addScaledVector(v.subVectors(H, C).normalize(), r);
        // slack: how much nearer the target is than the rope's length (both measured feet to feet), when it isn't pulling
        const d = H.distanceTo(knot), slack = L.phase === 'held' && job.leader ? Math.max(0, job.handle.length - flat(rootPos(t, P0), job.leader())) : 0;
        k = span(0, H, knot, 30, 0.03 + d * 0.004 + Math.min(1.2, slack * 0.35), ground);
        k = ring(k, C, tmp, r, 18, H);
        if (L.phase === 'catch' && f >= 1) { set('held'); fire(job.onCaught, job.handle); }
        else if (L.phase === 'held') {
          if (job.lead && job.handle.held) leadTarget(dt);
          if (job.handle.held && L.t >= job.hold) job.handle.release();
        }
        break;
      }
      case 'tangle': {
        // caught on the head but not round the neck: a ragged loop that wobbles, slips off and drops to the ground
        neckOf(t, Nk); const f = Math.min(1, L.t / LASSO.tangle), slip = ease(Math.max(0, (f - 0.3) / 0.7));
        if (slip <= 0) job.drop.copy(Nk);
        C.copy(job.drop); const gy = ground(C.x, C.z) + 0.03;
        C.y = Nk.y + (gy - Nk.y) * slip; if (slip <= 0) C.copy(Nk);
        forwardOf(t, tmp2); tmp.copy(tmp2).lerp(up, 0.4 + slip * 0.6).normalize();
        const r = 0.5 + slip * 0.08;
        const knot = tmp2.copy(C).addScaledVector(v.subVectors(H, C).setY(0).normalize(), r);
        const d = H.distanceTo(knot);
        k = span(0, H, knot, 30, 0.4 + d * 0.12 + slip * d * 0.2, ground);
        k = ring(k, C, tmp, r, 26, H, 1 - slip * 0.5, L.t);
        if (f >= 1) { set('reel'); fire(job.onMissed); }
        break;
      }
      case 'reel': {
        // coiled back in: the loop drawn back to the hand along the ground, closing as it comes
        if (L.t < dt + 1e-6) job.from.copy(C.lengthSq() ? C : H);
        const f = Math.min(1, L.t / LASSO.reel), e = ease(f);
        C.lerpVectors(job.from, H, e); C.y = Math.max(C.y, ground(C.x, C.z) + 0.03);
        const r = Math.max(0.12, 0.5 * (1 - e));
        const knot = tmp2.copy(C).addScaledVector(v.subVectors(H, C).setY(0).normalize(), r);
        k = span(0, H, knot, 20, 0.3 * (1 - e), ground);
        k = ring(k, C, up, r, 16, H);
        if (f >= 1) { set('idle'); return; }
        break;
      }
    }
    rope.lay(pts, k, LASSO.rope);
  };

  // A HELD TARGET LED ALONG: kept within the rope's length of the thrower (pulled after them when they move off),
  // hauled in a little while they stand, turned to face the pull, walking while it is pulled
  const lastLeader = new THREE.Vector3(); let still = 0;
  function leadTarget(dt) {
    const t = job.target, h = job.handle; if (!t.root || !job.leader) return;
    const me = job.leader(); rootPos(t, P0);
    if (lastLeader.distanceToSquared(me) < 1e-6) still += dt; else still = 0;
    lastLeader.copy(me);
    if (still > 0.4) h.length = Math.max(LASSO.near, h.length - LASSO.haul * dt);
    const dx = me.x - P0.x, dz = me.z - P0.z, d = Math.hypot(dx, dz);
    let moved = 0;
    if (d > h.length) {
      const step = Math.min(d - h.length, 14 * dt), nx = P0.x + dx / d * step, nz = P0.z + dz / d * step;
      if (!W.blocked(nx, nz)) { t.root.position.x = nx; t.root.position.z = nz; t.root.position.y = W.heightAt(nx, nz); moved = step / Math.max(dt, 1e-4); }
    }
    if (d > 0.5) {   // turned toward the pull (gently)
      const want = Math.atan2(dx, dz), cur = t.root.rotation.y, diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
      if (moved > 0.05 || Math.abs(diff) > 0.6) t.root.rotation.y = cur + diff * (1 - Math.exp(-4 * dt));
    }
    if (t.play) {
      if (moved > 0.15) { const s = t.stride || { Walk: 1, Gallop: 3 }, gal = moved > 2.2;
        t.play(gal ? 'Gallop' : 'Walk', { speed: Math.max(0.6, Math.min(gal ? 1.8 : 2.4, moved / (gal ? s.Gallop : s.Walk))), fade: 0.2 }); job.led = true; }
      else if (job.led) { t.play('Idle', { fade: 0.3 }); job.led = false; }
    }
  }

  L.dispose = () => { rope.removeFromParent(); rope.geometry.dispose(); rope.material.dispose(); };
  return L;
}
