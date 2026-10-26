// THE FALL: when something gives in the wind test, the boards that come down become loose sticks (each board's two ends
// are two weights held a fixed distance apart: a "Verlet" stick, the simplest kind of rigid piece that can tumble),
// while the rest of the tower stands and the test carries on. That can happen several times in one test (the lone
// board on top in the breeze, a tier in the stiff wind...): each drop adds its sticks, and the earlier ones keep lying
// where they landed. The nailed joints become pins tying one stick's spot to another's, so a square with no brace folds
// like the parallelogram it is, and a braced one tips over in one piece. Pins pop: the broken joint first, the joints to
// boards that stay standing right away (the falling part tears free of them), the footings on the windward side (they
// lift), the rest when they are stretched hard or when their board hits the ground. Dust puffs where things land.
// Boards only hit the ground, not each other (simple and plenty for a fall).
//   const F = makeFall(scene, { ground })   scene: where the puffs go (the boards stay the tower view's); ground(x, z):
//     the ground's height in metres in that scene's frame (the hilltop's own by default: scene.js groundY)
//   F.drop(...), F.update(dt, windDir), F.settled(), F.clear(), F.dispose() (the puffs out of the scene)
import * as THREE from 'three';
import { joints3 } from './touch.js';
import { FT, groundY } from './scene.js';
import { softDot } from './wood.js';

const G = 9.8;

export function makeFall(scene, { ground = groundY } = {}) {
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

  // drop: tower (the data: the boards standing just before this), view (tower3d), falling (the ids that come down now),
  // the wind's direction, and where the break was (world, feet) so that joint goes first. Each falling board starts
  // where it is drawn right now (bent by the wind); the boards that stay are left to the view.
  let lastDrop = 0;
  function drop({ tower, view, falling, windDir, breakAt }) {
    running = true; lastDrop = time;
    const byKey = new Map(), fresh = [];
    let top = 0;
    for (const key of falling) {
      const b = view.boards.get(key); if (!b || b.falling) continue;
      const ends = view.drawnNow(key); if (!ends) continue;
      const [p0, p1] = ends, len = p0.distanceTo(p1);
      top = Math.max(top, p0.y, p1.y);
      const st = { key, b, p: [p0, p1], q: [p0.clone(), p1.clone()], len, side: b.z.clone(), spin: 0, roll: 0, landed: false, pins: [], born: time };
      b.falling = true; sticks.push(st); fresh.push(st); byKey.set(key, st);
    }
    if (!fresh.length) return 0;
    // a little push to start: the wind leaning on it, more at the top
    for (const st of fresh) for (let i = 0; i < 2; i++) st.q[i].addScaledVector(windDir, -0.005 * (0.3 + st.p[i].y / Math.max(1, top)));
    // the joints of the boards that stood, in the world (touch.js: where boards' centre lines meet, in any plane); a
    // joint's spot is where the falling board there is drawn now
    const made = [];
    for (const h of joints3(tower.boards)) {
      const items = h.items.map((it) => { const src = tower.boards[it.i], st = byKey.get(src.id); return { st, f: st ? Math.max(0, Math.min(1, it.t / (src.len || 1))) : 0 }; });
      const fall = items.filter((i) => i.st), standing = items.length - fall.length;
      if (!fall.length) continue;
      const at = fall[0].st.p[0].clone().lerp(fall[0].st.p[1], fall[0].f);
      for (const f of fall) f.u = nearestU(f.st, at);
      const nearBreak = breakAt && Math.hypot(h.X - breakAt.X, h.Y - breakAt.Y, h.Z - breakAt.Z) < 2;
      const life = time + (nearBreak ? 0 : h.ground ? (at.dot(windDir) < 0 ? 0.05 + Math.random() * 0.2 : 0.9 + Math.random() * 1.2)
        : standing ? 0.15 + Math.random() * 0.35 : 1.6 + Math.random() * 2.2);
      if (h.ground || standing) for (const f of fall) made.push({ a: f, fixed: at.clone(), life, ground: h.ground });
      for (let i = 1; i < fall.length; i++) made.push({ a: fall[0], b: fall[i], life, at });
    }
    // each pin keeps the distance its two spots started at (the joint holds them as they were nailed)
    for (const p of made) { p.a.st.pins.push(p); if (p.b) p.b.st.pins.push(p); p.rest = (p.b ? pointOf(p.b, tmpB) : p.fixed).distanceTo(pointOf(p.a, tmpA)); pins.push(p); }
    return fresh.length;
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
    for (const st of sticks) {
      const push = Math.max(0, 1.4 - (time - st.born)) * 2.2;     // the gust still shoving for the first moments
      for (let i = 0; i < 2; i++) {
        const p = st.p[i], q = st.q[i];
        tmp.subVectors(p, q).multiplyScalar(0.995);    // velocity (a little air drag)
        q.copy(p);
        p.add(tmp); p.y -= G * dt * dt;
        if (push) p.addScaledVector(windDir, push * (0.4 + p.y * 0.12) * dt * dt);
      }
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
        const p = st.p[i], q = st.q[i], gy = ground(p.x, p.z) + 0.03;
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
  // has everything come to rest (since the last drop)?
  function settled() {
    if (!running) return true;
    const since = time - lastDrop;
    if (since < 2.5) return false;
    if (since > 6) return true;
    let v = 0; for (const st of sticks) for (let i = 0; i < 2; i++) v = Math.max(v, st.p[i].distanceTo(st.q[i]));
    return v < 0.002;
  }
  // everything back: the fallen boards belong to the view again (it puts them where they go, or they are gone)
  function clear() {
    for (const st of sticks) st.b.falling = false;
    sticks.length = 0; pins.length = 0; running = false; time = 0; lastDrop = 0;
  }
  function dispose() { for (const P of puffs) { scene.remove(P.s); P.s.material.dispose(); } puffs.length = 0; }
  return { drop, update, settled, clear, dispose, get time() { return time; }, get sinceDrop() { return time - lastDrop; }, get running() { return running; }, sticks };
}
