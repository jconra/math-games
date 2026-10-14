// THE CRASH: when the wind test breaks the tower, every board that falls becomes a loose stick (its two ends are two
// weights held a fixed distance apart: a "Verlet" stick, the simplest kind of rigid piece that can tumble). The nailed
// joints become pins tying one stick's spot to another's, so a square with no brace folds like the parallelogram it
// is, and a braced one tips over in one piece. Pins pop: the broken joint first, the footings on the windward side
// (they lift), the rest when they are stretched hard or when their board hits the ground. Dust puffs where things land.
// Boards only hit the ground, not each other (simple and plenty for a crash).
import * as THREE from 'three';
import { faceSegments, faceToWorld } from './tower.js';
import { findJoints } from './frame.js';
import { FT, groundY } from './scene.js';
import { softDot } from './wood.js';

const G = 9.8;

export function makeFall(scene) {
  const sticks = [], pins = [];
  let time = 0, running = false, events = { pops: 0, hits: 0, bigHit: 0 };
  // dust puffs, reused
  const puffMat = new THREE.SpriteMaterial({ map: softDot(64), color: 0xcdb48e, transparent: true, depthWrite: false, opacity: 0 });
  const puffs = []; for (let i = 0; i < 48; i++) { const s = new THREE.Sprite(puffMat.clone()); s.visible = false; scene.add(s); puffs.push({ s, age: 9, life: 1 }); }
  let puffNext = 0;
  function puff(p, size = 1) {
    const P = puffs[puffNext++ % puffs.length]; P.s.position.copy(p); P.s.position.y += 0.15; P.age = 0; P.life = 1 + Math.random() * 0.8; P.size = size; P.s.visible = true;
    P.drift = new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.35, (Math.random() - 0.5) * 0.6);
  }

  // start: tower (the data), view (tower3d), keys of the boards that fall, the wind's direction, the sway in effect
  // when it broke, and where the break was (world, feet) so that joint goes first
  function start({ tower, view, falling, windDir, sway, breakAt }) {
    clear(view); running = true; time = 0;
    const byKey = new Map();
    let top = 0;
    for (const key of falling) {
      const b = view.boards.get(key); if (!b) continue;
      const off0 = sway ? sway(b.y0) : new THREE.Vector3(), off1 = sway ? sway(b.y1) : new THREE.Vector3();
      const p0 = b.a.clone().add(off0), p1 = b.b.clone().add(off1);
      // (every stick keeps its board's true length: the lower end where the lean put it, the upper one along the lean)
      const len = b.a.distanceTo(b.b), [lo, hi] = p0.y <= p1.y ? [p0, p1] : [p1, p0];
      hi.sub(lo).setLength(len).add(lo);
      top = Math.max(top, p0.y, p1.y);
      const st = { key, b, p: [p0, p1], q: [p0.clone(), p1.clone()], len, side: b.z.clone(), spin: 0, roll: 0, landed: false, pins: [] };
      b.falling = true; sticks.push(st); byKey.set(key, st);
    }
    // a little push to start: the wind leaning on it, more at the top
    for (const st of sticks) for (let i = 0; i < 2; i++) st.q[i].addScaledVector(windDir, -0.005 * (0.3 + st.p[i].y / Math.max(1, top)));
    // the joints, face by face
    const keyOf = (s, k) => (s.post ? s.src.id + ':c' + s.corner : s.src.id + ':' + k);
    for (let k = 0; k < 4; k++) {
      const segs = faceSegments(tower, k);
      for (const h of findJoints(segs)) {
        const w = faceToWorld(tower.W, k, h.x, h.y), at = new THREE.Vector3(w.X * FT, w.Y * FT, w.Z * FT);
        if (sway) at.add(sway(h.y));
        // (each board's spot nearest the joint: boards nailed face to face sit a few centimetres apart)
        const items = h.items.map((it) => { const st = byKey.get(keyOf(segs[it.s], k)); return { st, u: st ? nearestU(st, at) : 0 }; });
        const fall = items.filter((i) => i.st), standing = items.length - fall.length;
        if (!fall.length) continue;
        const nearBreak = breakAt && Math.hypot(w.X - breakAt.X, w.Y - breakAt.Y, w.Z - breakAt.Z) < 2;
        const life = nearBreak ? 0 : h.ground ? (at.dot(windDir) < 0 ? 0.05 + Math.random() * 0.2 : 0.9 + Math.random() * 1.2)
          : standing ? 0.15 + Math.random() * 0.35 : 1.6 + Math.random() * 2.2;
        if (h.ground || standing) for (const f of fall) pins.push({ a: f, fixed: at.clone(), life, ground: h.ground });
        for (let i = 1; i < fall.length; i++) pins.push({ a: fall[0], b: fall[i], life, at });
      }
    }
    // each pin keeps the distance its two spots started at (the joint holds them as they were nailed)
    for (const p of pins) { p.a.st.pins.push(p); if (p.b) p.b.st.pins.push(p); p.rest = (p.b ? pointOf(p.b, tmpB) : p.fixed).distanceTo(pointOf(p.a, tmpA)); }
  }
  function nearestU(st, at) {
    const d = tmp.subVectors(st.p[1], st.p[0]), L2 = d.lengthSq() || 1;
    return Math.max(0, Math.min(1, tmpA.subVectors(at, st.p[0]).dot(d) / L2));
  }

  const tmp = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  const pointOf = (it, out) => out.copy(it.st.p[0]).lerp(it.st.p[1], it.u);
  function popPin(p) { if (p.dead) return; p.dead = true; events.pops++; puffAt(p); }
  function puffAt(p) { if (Math.random() < 0.35) puff(p.fixed || pointOf(p.a, tmpA), 0.5); }

  function step(dt, windDir) {
    time += dt;
    const push = Math.max(0, 1.4 - time) * 2.2;     // the gust still shoving for the first moments
    for (const st of sticks) for (let i = 0; i < 2; i++) {
      const p = st.p[i], q = st.q[i];
      tmp.subVectors(p, q).multiplyScalar(0.995);    // velocity (a little air drag)
      q.copy(p);
      p.add(tmp); p.y -= G * dt * dt;
      if (push) p.addScaledVector(windDir, push * (0.4 + p.y * 0.12) * dt * dt);
    }
    for (const p of pins) if (!p.dead && time > p.life) popPin(p);
    for (let it = 0; it < 8; it++) {
      for (const st of sticks) {
        tmp.subVectors(st.p[1], st.p[0]); const d = tmp.length() || 1e-6, corr = (d - st.len) / d / 2;
        st.p[0].addScaledVector(tmp, corr); st.p[1].addScaledVector(tmp, -corr);
      }
      for (const p of pins) {
        if (p.dead) continue;
        pointOf(p.a, tmpA);
        const target = p.b ? pointOf(p.b, tmpB) : p.fixed;
        tmp.subVectors(target, tmpA);
        const len = tmp.length(), err = Math.abs(len - p.rest);
        if (it === 7 && err > 0.09) { popPin(p); continue; }      // stretched past what the nails hold
        if (len < 1e-6) continue;
        tmp.multiplyScalar((len - p.rest) / len);
        const ua = p.a.u, wa = (1 - ua) ** 2 + ua ** 2;
        const wb = p.b ? (1 - p.b.u) ** 2 + p.b.u ** 2 : 0;
        const lam = 1 / (wa + wb);
        p.a.st.p[0].addScaledVector(tmp, lam * (1 - ua)); p.a.st.p[1].addScaledVector(tmp, lam * ua);
        if (p.b) { p.b.st.p[0].addScaledVector(tmp, -lam * (1 - p.b.u)); p.b.st.p[1].addScaledVector(tmp, -lam * p.b.u); }
      }
      // the ground
      for (const st of sticks) for (let i = 0; i < 2; i++) {
        const p = st.p[i], q = st.q[i], gy = groundY(p.x, p.z) + 0.03;
        if (p.y < gy) {
          const vy = (p.y - q.y) / dt;
          if (it === 0 && vy < -2.2) {
            events.hits++; events.bigHit = Math.max(events.bigHit, Math.min(1, -vy / 8));
            if (!st.landed || Math.random() < 0.3) puff(p, 0.8 + Math.min(1.2, -vy / 6));
            st.landed = true; st.spin = (Math.random() - 0.5) * 8;
            for (const pin of st.pins) if (!pin.dead && Math.random() < 0.55) popPin(pin);
          }
          p.y = gy;
          if (it === 0) {
            q.y = p.y + Math.min(0, vy) * dt * 0.25;                  // a small bounce
            q.x += (p.x - q.x) * 0.3; q.z += (p.z - q.z) * 0.3;      // and the ground's friction
          }
        }
      }
    }
  }

  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), M = new THREE.Matrix4();
  function update(dt, windDir) {
    events = { pops: 0, hits: 0, bigHit: 0 };
    if (running) {
      const n = 3; for (let i = 0; i < n; i++) step(Math.min(dt, 1 / 30) / n, windDir);
      for (const st of sticks) {
        X.subVectors(st.p[1], st.p[0]).normalize();
        st.roll += st.spin * dt; st.spin *= 0.97;
        Z.copy(st.side).addScaledVector(X, -st.side.dot(X)); if (Z.lengthSq() < 1e-5) Z.set(0, 1, 0).addScaledVector(X, -X.y); Z.normalize();
        Z.applyAxisAngle(X, st.spin * dt); st.side.copy(Z);
        Y.crossVectors(Z, X); M.makeBasis(X, Y, Z);
        st.b.mesh.position.addVectors(st.p[0], st.p[1]).multiplyScalar(0.5); st.b.mesh.quaternion.setFromRotationMatrix(M);
      }
    }
    for (const P of puffs) {
      if (P.age > P.life) { P.s.visible = false; continue; }
      P.age += dt; const k = P.age / P.life;
      P.s.position.addScaledVector(P.drift, dt); P.s.scale.setScalar((0.4 + k * 1.6) * P.size);
      P.s.material.opacity = 0.75 * (1 - k) * Math.min(1, k * 8);
    }
    return events;
  }
  // has everything come to rest?
  function settled() {
    if (!running) return true;
    if (time < 2.5) return false;
    if (time > 6) return true;
    let v = 0; for (const st of sticks) for (let i = 0; i < 2; i++) v = Math.max(v, st.p[i].distanceTo(st.q[i]));
    return v < 0.002;
  }
  function clear(view) {
    for (const st of sticks) st.b.falling = false;
    sticks.length = 0; pins.length = 0; running = false;
  }
  return { start, update, settled, clear, get time() { return time; }, get running() { return running; }, sticks };
}
