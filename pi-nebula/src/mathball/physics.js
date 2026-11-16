// MATHBALL'S BALLS, moving: shot out of the wall ports, bouncing, rolling, knocking into each other and the players,
// carried, thrown into a goal. Plain numbers (no three.js), so node can test them (pi-nebula/tests/mathball.test.mjs).
//
// THE WEIGHTED BALL (the game's maker, AR2-4/5: "as they settle they should always show the majority of the number (so
// within maybe 20 degrees of looking straight at the camera) ... I'd keep the numbers upright once the ball is done
// bouncing around (kind of like it is weighted) ... if the camera is looking at them they don't appear to be moving on
// their own ... the balls should all spin to be easily readable when they are out of view ... not an always facing
// billboard"). Each ball carries its number on two opposite sides (its own +z and -z), upright along its own +y.
//   - Flying and rolling fast it tumbles as any ball does.
//   - Rolling slower than PHYS.settle it rights itself as a ball weighted under its number would: it ROLLS (the ball
//     moves as it turns: nothing slides) toward the side of it facing the camera, number upright, and may spin a little
//     about its upright, as a rolling ball does after a knock. It comes to rest only once the side facing the camera is
//     within PHYS.restAngle of it, upright (the test holds every resting ball to 20 degrees).
//   - At rest and in view it never turns. Out of view (the game says which balls the camera sees) a ball whose number
//     has turned away from the camera, because the player has walked round, turns back to face it, quietly.
//
// THE FRAME: the court's (court.js): metres, its middle on the floor at the origin, y up.
//   const world = makeBalls({ rand })
//   world.add(ball) -> ball      a ball: { id, num, p: [x, y, z], v, q: [x, y, z, w] (its turn), w (its spin, rad/s, about
//                                the world's axes), mode: 'air' | 'roll' | 'rest' | 'held' | 'fly' | 'in' | 'gone' }
//   world.launch(port, ball, rand)  out of a port (court.js PORTS), across the court
//   world.step(dt, { eye, sees(ball), people: [{ x, z, vx, vz }] })   eye: the camera's point (where the balls face);
//                                sees(ball): is it in view; people: cylinders that knock the balls
//   world.throwTo(ball, from, to, T)   a lob from `from` reaching `to` T seconds later (a ball in the hand)
//   facing(ball, eye) -> { angle, tilt }   degrees between the side facing the eye and the eye; how far off upright
import { COURT, WALLS } from './court.js';

export const PHYS = {
  g: 9.81, r: COURT.ball.r,
  eFloor: 0.58, eWall: 0.62, eBall: 0.82, ePerson: 0.5,
  roll: 0.55,          // m/s lost each second rolling (round two's 0.5: they roll a good way)
  scrub: 0.12,         // the share of its speed along the floor a ball loses at each bounce
  settle: 1.05,        // m/s: rolling slower than this, a ball starts to right itself
  turn: 3.2,           // how quickly it rights itself (1/s: the share of what is left each second, as a rate)
  most: 3.4,           // the fastest it rolls or spins while righting itself (rad/s)
  restAngle: 4,        // degrees: it comes to rest once its number faces the camera within this
  restSpeed: 0.035,    // m/s
  outTurn: 4.0,        // rad/s: how fast a ball out of view turns back to face the camera
  outOf: 12,           // degrees: a resting ball out of view turns once it is this far off
  person: 0.3,         // a player's half width at the legs (m)
  hz: 120,             // steps a second
};
const R = PHYS.r;

// ── small vector and turn helpers ([x, y, z] and [x, y, z, w]) ─────────────────────────────────────────────────────
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qnorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
export function qaxis(ax, ang) { const l = len(ax) || 1, s = Math.sin(ang / 2) / l; return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; }
// a vector turned by a quaternion
export function qrot(q, v) {
  const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
// the quaternion of a frame whose own axes are X, Y, Z (unit, right-handed) in the world
function qframe(X, Y, Z) {
  const m00 = X[0], m11 = Y[1], m22 = Z[2], tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(Y[2] - Z[1]) / s, (Z[0] - X[2]) / s, (X[1] - Y[0]) / s, 0.25 * s]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * s, (Y[0] + X[1]) / s, (Z[0] + X[2]) / s, (Y[2] - Z[1]) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(Y[0] + X[1]) / s, 0.25 * s, (Z[1] + Y[2]) / s, (Z[0] - X[2]) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(Z[0] + X[2]) / s, (Z[1] + Y[2]) / s, 0.25 * s, (X[1] - Y[0]) / s]; }
  return qnorm(q);
}
// a random turn (even over all turns)
export function qrand(rand) { const u = rand(), v = rand(), w = rand(), a = Math.sqrt(1 - u), b = Math.sqrt(u); return [a * Math.sin(2 * Math.PI * v), a * Math.cos(2 * Math.PI * v), b * Math.sin(2 * Math.PI * w), b * Math.cos(2 * Math.PI * w)]; }
// the rotation from a to b as an axis times its angle (the shortest way)
function rotvec(qa, qb) {
  let d = qmul(qb, qconj(qa)); if (d[3] < 0) d = d.map((x) => -x);
  const s = Math.hypot(d[0], d[1], d[2]); if (s < 1e-9) return [0, 0, 0];
  const ang = 2 * Math.atan2(s, d[3]); return [d[0] / s * ang, d[1] / s * ang, d[2] / s * ang];
}
const DEG = 180 / Math.PI, UP = [0, 1, 0];

// ── where a ball's number should face: the camera, upright ─────────────────────────────────────────────────────────
// the turn that shows side `side` (+1: its +z, -1: its -z) straight to the eye, the number upright (no lean as the
// camera sees it). The back's number is printed mirrored round the ball, so it reads the same way up from behind.
function goalTurn(p, eye, side) {
  const f = norm([eye[0] - p[0], eye[1] - p[1], eye[2] - p[2]]);
  let up = [UP[0] - f[0] * f[1], UP[1] - f[1] * f[1], UP[2] - f[2] * f[1]];
  if (len(up) < 1e-3) up = [0, 0, -1];
  up = norm(up);
  const Z = side > 0 ? f : [-f[0], -f[1], -f[2]], Y = up, X = cross(Y, Z);
  return qframe(X, Y, Z);
}
// which side faces the eye more, and the turn that would show it squarely
function bestGoal(b, eye) {
  const z = qrot(b.q, [0, 0, 1]), f = norm([eye[0] - b.p[0], eye[1] - b.p[1], eye[2] - b.p[2]]);
  const side = dot(z, f) >= 0 ? 1 : -1;
  return goalTurn(b.p, eye, side);
}
// how a ball faces the eye: the angle between the side nearest the eye and the eye (degrees), and how far its number
// leans from upright as the eye sees it (degrees)
export function facing(b, eye) {
  const f = norm([eye[0] - b.p[0], eye[1] - b.p[1], eye[2] - b.p[2]]), z = qrot(b.q, [0, 0, 1]), y = qrot(b.q, [0, 1, 0]);
  const side = dot(z, f) >= 0 ? 1 : -1, angle = Math.acos(Math.min(1, Math.abs(dot(z, f)))) * DEG;
  // (the lean: the ball's up against the eye's up, both laid flat across the line of sight)
  let up = [UP[0] - f[0] * f[1], UP[1] - f[1] * f[1], UP[2] - f[2] * f[1]]; up = norm(up);
  const yy = norm([y[0] - f[0] * dot(y, f), y[1] - f[1] * dot(y, f), y[2] - f[2] * dot(y, f)]);
  const tilt = Math.acos(Math.max(-1, Math.min(1, dot(yy, up)))) * DEG;
  return { angle, tilt, side };
}

// ── the balls ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function makeBalls({ rand = Math.random } = {}) {
  const list = [];
  const W = {
    list,
    add(b) { Object.assign(b, { p: b.p || [0, R, 0], v: b.v || [0, 0, 0], q: b.q || qrand(rand), w: b.w || [0, 0, 0], mode: b.mode || 'air', settleT: 0, still: 0 }); list.push(b); return b; },
    remove(b) { const i = list.indexOf(b); if (i >= 0) list.splice(i, 1); },
    // out of a port, across the court: its own way swung up to 30 degrees either side, a little up, 4 to 7 m/s
    launch(port, b, r = rand) {
      const yaw = (r() - 0.5) * 1.05, pitch = 0.08 + r() * 0.3, sp = 4.2 + r() * 2.8, c = Math.cos(yaw), s = Math.sin(yaw), [nx, , nz] = port.n;
      const dx = nx * c - nz * s, dz = nz * c + nx * s;
      b.p = [port.at[0] + port.n[0] * (R + 0.05), port.at[1], port.at[2] + port.n[2] * (R + 0.05)];
      b.v = [dx * sp * Math.cos(pitch), sp * Math.sin(pitch), dz * sp * Math.cos(pitch)];
      b.q = qrand(r); b.w = [(r() - 0.5) * 9, (r() - 0.5) * 9, (r() - 0.5) * 9]; b.mode = 'air'; b.settleT = 0; b.still = 0;
      return b;
    },
    // a lob from the hand reaching `to` T seconds later (through the goal's mouth)
    throwTo(b, from, to, T) {
      b.p = [...from]; b.mode = 'fly'; b.fly = { from: [...from], to: [...to], T, t: 0 };
      b.v = [(to[0] - from[0]) / T, (to[1] - from[1] + 0.5 * PHYS.g * T * T) / T, (to[2] - from[2]) / T];
      const h = norm([b.v[0], 0, b.v[2]]); b.w = [h[2] * -9, 0, -h[0] * -9];   // (a backspin, as a thrown ball has)
    },
    step(dt, ctx = {}) {
      const n = Math.max(1, Math.ceil(dt * PHYS.hz)), h = dt / n;
      for (let k = 0; k < n; k++) stepOnce(h, ctx);
    },
  };

  function stepOnce(dt, { eye = [0, 2.4, 9], sees = () => true, people = [] }) {
    for (const b of list) {
      if (b.mode === 'held' || b.mode === 'gone') continue;
      if (b.mode === 'fly') {
        // a thrown ball flies its lob exactly (the goal decides what happens when it gets there: game.js)
        b.fly.t += dt; b.v[1] -= PHYS.g * dt;
        for (let i = 0; i < 3; i++) b.p[i] += b.v[i] * dt;
        spin(b, dt);
        continue;
      }
      if (b.mode === 'in') {
        // into the goal's pocket: on along its way, slowing, dropping to the pocket's floor
        b.v[0] *= Math.exp(-3 * dt); b.v[2] *= Math.exp(-3 * dt); b.v[1] -= PHYS.g * dt;
        for (let i = 0; i < 3; i++) b.p[i] += b.v[i] * dt;
        if (b.p[1] < R) { b.p[1] = R; b.v[1] = Math.abs(b.v[1]) * 0.35; }
        spin(b, dt);
        continue;
      }
      if (b.mode === 'rest') {
        // at rest: out of view, turned back to face the camera (quietly); in view, never moved by itself
        if (!sees(b) && facing(b, eye).angle > PHYS.outOf) b.mode = 'turn';
        else continue;
      }
      if (b.mode === 'turn') {
        if (sees(b)) { b.mode = 'rest'; continue; }     // (caught turning: it stops where it is)
        const e = rotvec(b.q, bestGoal(b, eye)), a = len(e), stepA = Math.min(a, PHYS.outTurn * dt);
        if (a > 1e-6) b.q = qnorm(qmul(qaxis(e, stepA), b.q));
        if (a - stepA < 0.5 / DEG) b.mode = 'rest';
        continue;
      }
      if (b.mode === 'air') {
        b.v[1] -= PHYS.g * dt;
        for (let i = 0; i < 3; i++) b.p[i] += b.v[i] * dt;
        if (b.p[1] < R && b.v[1] < 0) {
          b.p[1] = R;
          if (-b.v[1] > 0.9) {
            b.v[1] = -PHYS.eFloor * b.v[1]; b.v[0] *= 1 - PHYS.scrub; b.v[2] *= 1 - PHYS.scrub;
            const wr = rolling(b); b.w = [wr[0] * 0.7 + b.w[0] * 0.3, b.w[1] * 0.6, wr[2] * 0.7 + b.w[2] * 0.3];
            b.bounced = (b.bounced || 0) + 1;
          } else { b.v[1] = 0; b.mode = 'roll'; b.w = rolling(b, b.w[1]); }
        }
        spin(b, dt);
      } else if (b.mode === 'roll') {
        b.p[1] = R; b.v[1] = 0;
        const sp = Math.hypot(b.v[0], b.v[2]);
        if (sp >= PHYS.settle) {
          // rolling: slowing steadily, turning as it rolls, its spin about its upright dying away
          const s2 = sp - PHYS.roll * dt; b.v[0] *= s2 / sp; b.v[2] *= s2 / sp;
          b.w = rolling(b, b.w[1] * Math.exp(-2 * dt)); b.settleT = 0;
        } else righting(b, dt, eye);
        b.p[0] += b.v[0] * dt; b.p[2] += b.v[2] * dt;
        spin(b, dt);
        if (b.mode === 'roll' && b.settleT > 0) {
          const sp2 = Math.hypot(b.v[0], b.v[2]), f = facing(b, eye);
          b.still = sp2 < PHYS.restSpeed && f.angle < PHYS.restAngle && f.tilt < PHYS.restAngle ? b.still + dt : 0;
          if (b.still > 0.12) { b.mode = 'rest'; b.v = [0, 0, 0]; b.w = [0, 0, 0]; b.restAt = { eye: [...eye], angle: f.angle, tilt: f.tilt }; }
        }
      }
      walls(b);
    }
    // balls knocking each other
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) knock(list[i], list[j]);
    // the players' legs knocking the balls
    for (const P of people) for (const b of list) kick(b, P);
  }

  // spinning: the turn moved on by the spin
  function spin(b, dt) { const wl = len(b.w); if (wl > 1e-6) b.q = qnorm(qmul(qaxis(b.w, wl * dt), b.q)); }
  // the spin a ball rolling without slipping has (plus `yaw` about its upright): v = r (w x up)
  function rolling(b, yaw = 0) { return [b.v[2] / R, yaw, -b.v[0] / R]; }

  // THE WEIGHTED BALL righting itself: the turn still to make (to the side facing the camera, upright) is split into
  // a part about a level axis, which it ROLLS (so it moves along the floor as it turns: a weighted ball rocks to rest),
  // and a part about its upright, which it spins. Both run at a rate that shrinks as the turn left shrinks (so it eases
  // to rest), never faster than PHYS.most; the speed it still had runs down into the roll.
  function righting(b, dt, eye) {
    b.settleT += dt;
    const e = rotvec(b.q, bestGoal(b, eye));
    const ey = e[1], eh = [e[0], 0, e[2]], ah = len(eh);
    const k = PHYS.turn * (b.settleT > 4 ? 2 : 1);     // (a ball still not there after 4 s hurries: it never rocks for ever)
    let wh = [eh[0] * k, 0, eh[2] * k], wy = ey * k;
    const wl = Math.hypot(wh[0], wh[2]);
    if (wl > PHYS.most) { wh = [wh[0] / wl * PHYS.most, 0, wh[2] / wl * PHYS.most]; }
    if (Math.abs(wy) > PHYS.most) wy = Math.sign(wy) * PHYS.most;
    // the roll the righting wants, as a speed along the floor: v = r (w x up), and (wx, 0, wz) x (0, 1, 0) = (-wz, 0, wx).
    // Both the spin and the speed ease from what the ball had to what it wants (no jolt); the spin is kept even where
    // a wall or another ball stops it moving (it slips round against them: it always gets there)
    const want = [-R * wh[2], 0, R * wh[0]], blend = Math.min(1, dt * 6);
    b.v[0] += (want[0] - b.v[0]) * blend; b.v[2] += (want[2] - b.v[2]) * blend;
    b.w = [b.w[0] + (wh[0] - b.w[0]) * blend, b.w[1] + (wy - b.w[1]) * blend, b.w[2] + (wh[2] - b.w[2]) * blend];
    if (ah < 1e-4 && Math.abs(ey) < 1e-4) { b.v[0] *= 0.5; b.v[2] *= 0.5; }
  }

  // the court's walls: the octagon (a goal's mouth is part of its wall for a loose ball: only a thrown one goes in)
  function walls(b) {
    for (const Wl of WALLS) {
      const d = Wl.n[0] * (b.p[0] - Wl.A[0]) + Wl.n[1] * (b.p[2] - Wl.A[1]) - R;
      if (d >= 0) continue;
      b.p[0] -= Wl.n[0] * d; b.p[2] -= Wl.n[1] * d;
      const vn = b.v[0] * Wl.n[0] + b.v[2] * Wl.n[1];
      if (vn < 0) {
        b.v[0] -= (1 + PHYS.eWall) * vn * Wl.n[0]; b.v[2] -= (1 + PHYS.eWall) * vn * Wl.n[1];
        b.w[1] += (b.v[0] * Wl.u[0] + b.v[2] * Wl.u[1]) * 0.8;   // (a knock off a wall sets it spinning a little)
        if (b.mode === 'rest' || b.mode === 'turn') b.mode = 'roll';
      }
    }
  }
  function knock(a, b) {
    const free = (o) => o.mode === 'air' || o.mode === 'roll' || o.mode === 'rest' || o.mode === 'turn';
    if (!free(a) || !free(b)) return;
    const dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], dz = b.p[2] - a.p[2], d = Math.hypot(dx, dy, dz);
    if (d >= 2 * R || d < 1e-6) return;
    const nx = dx / d, ny = dy / d, nz = dz / d, push = (2 * R - d) / 2;
    a.p[0] -= nx * push; a.p[2] -= nz * push; b.p[0] += nx * push; b.p[2] += nz * push;
    const vn = (b.v[0] - a.v[0]) * nx + (b.v[1] - a.v[1]) * ny + (b.v[2] - a.v[2]) * nz;
    if (vn < -0.02) {
      const J = -(1 + PHYS.eBall) * vn / 2;
      a.v[0] -= J * nx; a.v[1] -= J * ny; a.v[2] -= J * nz; b.v[0] += J * nx; b.v[1] += J * ny; b.v[2] += J * nz;
      for (const o of [a, b]) { if (o.mode !== 'air') { o.v[1] = 0; o.mode = 'roll'; o.settleT = 0; } o.w[1] += (rand() - 0.5) * 2; }
    }
  }
  // a player's legs: a ball in the way is pushed out of it and knocked on (it takes on some of the player's speed)
  function kick(b, P) {
    if (!(b.mode === 'air' || b.mode === 'roll' || b.mode === 'rest' || b.mode === 'turn') || b.p[1] > 1.6) return;
    const dx = b.p[0] - P.x, dz = b.p[2] - P.z, d = Math.hypot(dx, dz), m = R + PHYS.person;
    if (d >= m || d < 1e-6) return;
    const nx = dx / d, nz = dz / d;
    b.p[0] = P.x + nx * m; b.p[2] = P.z + nz * m;
    const rv = (b.v[0] - (P.vx || 0)) * nx + (b.v[2] - (P.vz || 0)) * nz;
    if (rv < 0) {
      b.v[0] -= (1 + PHYS.ePerson) * rv * nx; b.v[2] -= (1 + PHYS.ePerson) * rv * nz;
      if (b.mode !== 'air') { b.mode = 'roll'; b.settleT = 0; }
    }
  }
  return W;
}

// where a thrown ball should go to fly into a goal: a lob whose time grows with the distance
export function lobTime(from, to) { const d = Math.hypot(to[0] - from[0], to[2] - from[2]); return Math.max(0.55, Math.min(1.5, 0.42 + d * 0.085)); }
