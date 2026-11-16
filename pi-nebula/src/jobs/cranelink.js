// THE CRANE OPERATOR JOB AND THE CRANE: what joins the job's questions (src/jobs/crane.js) to the live crane
// (src/crane.js take/give, kit/crane-drive.js). While the job is up the crane is worked by the answers:
//   - the moves are planned ahead and held for the questions by the job's queue (crane.js makeJobQueue): a question
//     asks about the next move of its kind, its numbers on the level's marks;
//   - a right answer (right) and the crane makes the moves up to and including that one, the asked one by exactly
//     the answer, lining itself up on the marks before it and on the place after it; a question that asked about no
//     move (one from the log, one of Mathwood's word problems) lets the crane make its next move;
//   - a wrong answer (wrong) shows, faintly, the path that answer would have taken it (along the rail, up or down,
//     across), for a few seconds;
//   - Done: the crane goes up out of wherever it is and the round takes over (src/crane.js give).
// The view is the one that follows the load (src/cranedrive.js followCam), kept clear of the panel; the readouts the
// numbers come from (the rail's mark, the hook's height, the load, the plate) are on a small strip at the top left, as
// on the chair's screens.
//
//   const link = craneLink({ crane, W, walls })    the panel's `live` (src/jobs/panel.js): link.now() for the makers,
//   link.right(q, coin), link.wrong(q, coin), link.update(dt), link.aim(camera, dt), link.close(); link.state() (rigs)
import * as THREE from 'three';
import { makeJobQueue, marksOf } from './crane.js';
import { followCam, readout, ensureCss } from '../cranedrive.js';
import { DRIVE } from '../../kit/crane-drive.js';

export function craneLink({ crane, W, walls }) {
  if (!crane || !crane.on) return null;
  crane.take();
  const site = crane.L.site, marks = marksOf(site);
  const Q = makeJobQueue(site, { start: () => crane.live.state, oreOf: () => crane.oreOf() });
  const cam = followCam(W, walls, site);
  cam.zoom = 8.5;
  let closed = false, waiting = [];

  // ── the questions ask, a right answer moves ───────────────────────────────────────────────────────────────────
  const ask = (kind, opts) => (crane.live ? Q.ask(kind, opts) : null);
  function go(steps) { if (!steps.length) return; if (crane.live) crane.live.go(steps); else waiting.push(...steps); }
  function right(q) {
    const f = q && q.order && q.order.facts;
    if (!crane.live) return;   // (the crane still finishing its move as the job began: nothing to move yet)
    go(Q.right(f && f.step != null ? f.step : null));
    clearGhost();
  }

  // ── a wrong answer: the path it would have taken, faintly ─────────────────────────────────────────────────────
  const ghost = new THREE.Group(); ghost.name = 'crane job: the path a wrong answer would take'; W.scene.add(ghost);
  const lineMat = new THREE.LineDashedMaterial({ color: 0xffa04a, dashSize: 0.22, gapSize: 0.14, transparent: true, opacity: 0.9, depthTest: false, toneMapped: false });
  const boxMat = new THREE.MeshBasicMaterial({ color: 0xffa04a, transparent: true, opacity: 0.3, depthWrite: false, depthTest: false, toneMapped: false });
  const boxGeo = new THREE.BoxGeometry(0.75, 0.3, 1.35);
  let ghostT = 0;
  function clearGhost() { for (const o of [...ghost.children]) { ghost.remove(o); if (o.geometry && o.geometry !== boxGeo) o.geometry.dispose(); } ghostT = 0; }
  function drawPath(points, endYaw) {
    clearGhost();
    const g = new THREE.BufferGeometry().setFromPoints(points), L = new THREE.Line(g, lineMat); L.computeLineDistances(); L.renderOrder = 5; ghost.add(L);
    const b = new THREE.Mesh(boxGeo, boxMat); b.position.copy(points[points.length - 1]); b.rotation.y = endYaw; b.renderOrder = 5; ghost.add(b);
    lineMat.opacity = 0.9; boxMat.opacity = 0.3; ghostT = 3.2;
  }
  const alongOf = (leg, mark) => (leg === 'wall' ? site.rail.wall[0] + mark : site.turn[1] + mark);
  function wrong(q, coin) {
    const f = q && q.order && q.order.facts, R = Q.reserved, D = crane.live;
    if (!f || !R || f.step !== R.id || !D || !coin) return;
    const val = f.offset ? coin.v - f.offset : coin.v, S = D.state, yaw = S.yaw;
    const hk = new THREE.Vector3(S.x + Math.sin(yaw) * S.slide, S.hoist, S.z + Math.cos(yaw) * S.slide);
    if (R.kind === 'along' || R.kind === 'time') {
      // (from where the asked move starts, as far as the wrong answer says, the way it was going)
      const dir = Math.sign(R.markTo - R.mark) || 1, end = q.order.key === 'mark' ? val : R.mark + dir * (R.kind === 'time' ? val * R.speed : val);
      const y = Math.max(hk.y, 1), P = (m) => { const a = alongOf(R.leg, m); return R.leg === 'wall' ? new THREE.Vector3(a, y, site.wallZ) : new THREE.Vector3(site.shipX, y, a); };
      drawPath([P(R.mark), P(end)], R.leg === 'wall' ? 0 : Math.PI / 2);
    } else if (R.kind === 'hoist') {
      const down = R.to < R.from, endY = f.change != null ? R.from + val : R.from + (down ? -val : val);
      drawPath([hk.clone().setY(R.from), hk.clone().setY(Math.max(0.05, Math.min(site.carry + 1.5, endY)))], yaw);
    } else if (R.kind === 'slide') {
      const dir = Math.sign(R.to - R.from) || 1, b = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      drawPath([hk.clone(), hk.clone().addScaledVector(b, dir * val)], yaw);
    } else if (R.kind === 'route' && q.order.key !== 'route:time') {
      // (along the way it would go, as far as the wrong answer's metres reach)
      const y = site.carry, way = [];
      for (const g of R.legs) for (const m of [g.mark, g.markTo]) way.push(g.leg === 'wall' ? new THREE.Vector3(alongOf('wall', m), y, site.wallZ) : new THREE.Vector3(site.shipX, y, alongOf('ship', m)));
      const last = way[way.length - 1]; way.push(last.clone().add(new THREE.Vector3(R.across.to - R.across.from, 0, 0)));
      let left = val; const P = [way[0].clone()];
      for (let i = 1; i < way.length && left > 0; i++) { const d = way[i - 1].distanceTo(way[i]); if (d < 1e-6) continue; const t = Math.min(1, left / d); P.push(way[i - 1].clone().lerp(way[i], t)); left -= d * t; }
      if (P.length > 1) drawPath(P, 0);
    }
  }

  // ── the readouts strip (the numbers the questions are read from) ──────────────────────────────────────────────
  ensureCss();
  const chip = document.createElement('div'); chip.className = 'pcd pcd-chip is-on';
  chip.innerHTML = `<dl class="pcd-reads"><div><dt>Rail</dt><dd data-r="rail"></dd></div><div><dt>Hook</dt><dd data-r="hook"></dd></div><div><dt>Load</dt><dd data-r="load"></dd></div><div class="pcd-plate"><dt>Rated</dt><dd>${DRIVE.rated} t</dd></div></dl>`;
  document.body.appendChild(chip);
  function update(dt) {
    if (closed) return;
    const D = crane.live;
    if (D && waiting.length) { D.go(waiting); waiting = []; }
    // (a move that could not be made: the plan starts again from where the crane really is)
    if (D && D.failed && !D.busy) { console.info('crane job: a move could not be made (' + (D.failed.why || D.failed.axis || '') + '); planning again from here'); D.failed = null; Q.restart(); }
    if (D) { const w = readout(D.read()); for (const key of ['rail', 'hook', 'load']) { const dd = chip.querySelector(`[data-r="${key}"]`); if (dd.textContent !== w[key]) dd.textContent = w[key]; } }
    if (ghostT > 0) { ghostT -= dt; const a = Math.max(0, Math.min(1, ghostT / 1.2)); lineMat.opacity = 0.9 * a; boxMat.opacity = 0.3 * a; if (ghostT <= 0) clearGhost(); }
  }
  // the view: following the load, kept clear of the panel (left of it on a wide screen, above it on a phone)
  function aim(camera, dt) {
    const S = crane.live ? crane.live.state : crane.L.state(crane.t);
    cam.aim(camera, S, dt, { shift: innerHeight > innerWidth * 1.05 || innerWidth <= 640 ? [0, -0.26] : [0.22, 0] });
  }
  function close() {
    if (closed) return;
    closed = true; clearGhost(); W.scene.remove(ghost); chip.remove();
    crane.give();
  }
  const peek = () => (crane.live ? Q.peek() : null);
  const now = () => ({ ask, peek, rated: DRIVE.rated, site, marks });
  return { now, right, wrong, update, aim, close, Q, state: () => ({ cursor: Q.cursor, queued: Q.queue.length, reserved: Q.reserved && { ...Q.reserved }, busy: crane.live ? crane.live.busy : null, steps: crane.live ? crane.live.steps : null, failed: crane.live ? crane.live.failed : null, mode: crane.mode, ghost: ghostT > 0 }) };
}
