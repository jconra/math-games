// A STAND-IN PLAYER for whole rounds of Mathball played in node (the tests: is the other player fair to slow and quick
// players alike?), and the rounds themselves. Plain numbers, no page.
//   const P = simPlayer({ speed, think, aim, acc, rand, avoid })   speed: m/s running; think: [least, most] seconds to
//          choose a ball once free; aim: [least, most] seconds to choose a goal once holding one; acc: the share of
//          throws that go to a goal the ball fits; avoid(num): a ball this player will never pick (passes it over)
//   playRound(G, P, { dt }) -> { you, them, t, tries }   the round played to its end
import { GOALS } from './court.js';
import { goalsFor } from './rules.js';

const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function simPlayer({ speed = 4.6, think = [1, 3], aim = [0.6, 2], acc = 0.85, rand = Math.random, avoid = null } = {}) {
  const S = { x: 0, z: 6.3, vx: 0, vz: 0, heading: Math.PI, wait: think[0], choose: 0, picked: 0 };
  const span = (r) => r[0] + rand() * (r[1] - r[0]);
  return {
    S,
    step(G, dt) {
      const Y = G.you;
      // (a moment's thought before choosing again, after each throw, and after a ball is taken from under its nose)
      const busy = !!(Y.holding || Y.target);
      if (S.busy && !busy) S.wait = span(think);
      S.busy = busy;
      S.wait -= dt; S.choose -= dt;
      // free: after a moment's thought, the nearest ball it is willing to take
      if (!Y.holding && !Y.target && S.wait <= 0) {
        const cand = G.balls.filter((b) => ['air', 'roll', 'rest', 'turn'].includes(b.mode) && !b.fading && b !== G.other.target && !(avoid && avoid(b.num)));
        const b = cand.sort((a, c) => Math.hypot(a.p[0] - S.x, a.p[2] - S.z) - Math.hypot(c.p[0] - S.x, c.p[2] - S.z))[0];
        if (b && G.pick(b.id)) { S.choose = span(aim); S.picked++; }
        else S.wait = 0.4;
      }
      // holding: after a moment's thought, a goal (a right one, mostly)
      if (Y.holding && Y.aim == null && !Y.toss && S.choose <= 0) {
        const right = goalsFor(G.goals.map((g) => g.rule), Y.holding.num), wrong = GOALS.map((g, i) => i).filter((i) => !right.includes(i));
        const gi = rand() < acc || !wrong.length ? right[Math.floor(rand() * right.length)] : wrong[Math.floor(rand() * wrong.length)];
        G.throwAt(gi);
      }
      // moving: running straight to the ball; turning quickly to the goal
      const w = Y.want;
      let vx = 0, vz = 0;
      if (w.to) { const dx = w.to[0] - S.x, dz = w.to[1] - S.z, d = Math.hypot(dx, dz); if (d > 0.05) { const s = Math.min(speed, d * 4); vx = dx / d * s; vz = dz / d * s; S.heading = Math.atan2(dx, dz); } }
      if (w.face != null) { const d = wrapA(w.face - S.heading); S.heading = wrapA(S.heading + Math.sign(d) * Math.min(Math.abs(d), 9 * dt)); }
      S.vx = vx; S.vz = vz; S.x += vx * dt; S.z += vz * dt;
      // (the court's walls: kept a person's width in)
      S.x = Math.max(-4.4, Math.min(4.4, S.x)); S.z = Math.max(-8.3, Math.min(8.3, S.z));
      return { x: S.x, z: S.z, vx: S.vx, vz: S.vz, heading: S.heading };
    },
  };
}

// a round played to its end; the camera behind the player (the balls face it), seeing what is ahead of them
export function playRound(G, P, { dt = 1 / 30, most = 200 } = {}) {
  for (let t = 0; t < most && G.phase !== 'end'; t += dt) {
    const S = P.S, eye = [S.x - Math.sin(S.heading) * 3, 2.6, S.z - Math.cos(S.heading) * 3];
    const sees = (b) => { const dx = b.p[0] - eye[0], dz = b.p[2] - eye[2]; return (dx * Math.sin(S.heading) + dz * Math.cos(S.heading)) / (Math.hypot(dx, dz) || 1) > 0.55; };
    const you = P.step(G, dt);
    G.step(dt, { eye, sees, you });
  }
  return { you: G.score.you, them: G.score.them, t: G.t, tries: { ...G.tries } };
}
