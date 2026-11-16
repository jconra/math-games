// THE CRANE GAME AND THE CRANE: what joins the crane game's cards (src/jobs/crane.js) to the live crane (src/crane.js
// take/give, kit/crane-drive.js), and the operator's screen round them (the game's maker, 2026-11-16: "the crane system
// should be able to function automatically. But if the player goes to the chair then it could say the system is having a
// malfunction, please verify crane operations ... identifying the coordinates of the pods with a overhead camera and a
// overlaid grid ... It would be cool to see short cinematic with each answer to show the crane moving").
//   - THE SCREEN: a strip over the top of the view, the crane system's own: the fault, which check this is (five answers
//     each), what the round is at, and two switches: Free control (the crane by hand: src/cranedrive.js) and View.
//   - THE VIEW FROM ABOVE: while a card waits for its answer, the camera looks straight down on the hangar (from very
//     high, with a narrow lens, so it is as flat as a plan) and the GRID is laid over it: the metres from the hangar's
//     south-west corner, the quadrants, the crane and the place it is going to, the numbers the card asks about.
//   - THE FILM: a right answer and the crane makes that move, and the camera follows it there; then back to the grid.
//   - A WRONG ANSWER shows on the grid where it would have taken the crane, faintly, for a few seconds.
//   - THE MAGIC (the game's maker: "maybe some of the canisters should magically appear in the sockets during the
//     game"): after each right answer some of the round's other canisters take their places, so that one check of five
//     moves a whole part of the round along (unloading, loading, clearing).
//   - Done: the crane goes up out of wherever it is and the round takes over (src/crane.js give).
//
//   const link = craneLink({ crane, W, walls, onFree })   the panel's `live` (src/jobs/panel.js): link.now() for the
//   makers, link.right(q, coin), link.wrong(q, coin), link.ready(), link.update(dt), link.aim(camera, dt),
//   link.mount(el), link.close(keep); link.state() (rigs)
import * as THREE from 'three';
import { makeGame, toGrid, fromGrid, gridOf, quadrantOf, placeOf, magicMoves, GAME, SPEEDS } from './crane.js';
import { followCam, viewCam, ensureCss, VIEWS as DRIVE_VIEWS, VIEW_NAMES } from '../cranedrive.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// the views of the game: from above with the grid (while a card waits; the film follows the crane while it moves), and
// free control's (following the load, the crane's own camera, the wall cameras)
export const VIEWS = ['grid', ...DRIVE_VIEWS];
const NAMES = { grid: 'From above, with the grid', ...VIEW_NAMES };
// the camera from above: its height, how near it clips (just over the bridge's top: the roof and its lamps left out)
export const TOP = { height: 2000, over: 9.36, margin: 2.5 };
const PHASE = { unload: 'Unloading the ship', load: 'Loading the empties', clear: 'Clearing the sockets', move: 'Moving a canister', test: 'Test lifts' };
const ROMAN = ['I', 'II', 'III', 'IV'];

export function craneLink({ crane, W, walls, onFree = null }) {
  if (!crane || !crane.on) return null;
  crane.take();
  ensureCss();
  const site = crane.site, G = gridOf(site);
  const live = () => crane.live;
  const Q = makeGame(site, { state: () => crane.live.state });
  const cam = followCam(W, site);
  let closed = false, clock = 0, view = 0, card = null, moving = false, lastBusy = false, ghost = null, waitT = -9;
  let check = { n: 0, of: GAME.questions, phase: null, done: false, bannerT: -9, verified: 0 }, magicDue = 0, trip = null, film = null;
  const filmAt = new THREE.Vector3(), filmLook = new THREE.Vector3(), _w = new THREE.Vector3(), _l = new THREE.Vector3();

  // ── the moves: the cards ask, a right answer moves ────────────────────────────────────────────────────────────
  const untilOf = (s) => (typeof s.until === 'string' ? { until: s.until === 'tray' ? (D) => D.state.tray[s.i] > 0.999 : s.until === 'lit' ? (D) => D.state.lit[s.k] > 0.999 : (D) => D.held === s.c, patience: 12 } : s);
  function go(steps) { const D = live(); if (!D || !steps.length) return; D.go(steps.map(untilOf)); }
  function ask(kind, opts) {
    const D = live(); if (!D) return null;
    const r = Q.ask(kind, opts);
    if (!r) return null;
    card = r; trip = Q.trip;
    if (!check.phase) check.phase = trip && trip.phase;
    go(Q.before());
    // (the canister it is about blinks; or the socket it goes to)
    crane.target = r.what === 'pick' ? { can: r.c } : r.place && r.place.kind === 'socket' ? { socket: r.place.i } : { can: r.c };
    crane.places = r.what === 'drop' && r.place && r.place.kind !== 'socket' ? [{ kind: r.place.kind, i: r.place.i, look: 'near' }] : [];
    return r;
  }
  function right(q) {
    const D = live(); if (!D) return;
    const f = (q && q.order && q.order.facts) || {};
    ghost = null;
    let steps;
    if (f.step != null && Q.reserved && Q.reserved.id === f.step) {
      // (an answer of a time: the move at that speed, steady, so it takes just that long)
      const v = f.straight ? straightV(Q.reserved) : f.both ? { x: SPEEDS.x, z: SPEEDS.y } : f.even ? (f.speed === SPEEDS.h && Q.reserved.kind === 'lower' ? { hoist: SPEEDS.h } : f.axis === 'y' ? { z: SPEEDS.y } : { x: SPEEDS.x }) : null;
      steps = Q.right(null, { even: !!(f.even || f.both || f.straight), v });
    } else steps = Q.skip();
    // (the trip's last asked move: the rest of it too, the crane then still while the next card is worked out)
    if (Q.left() === 0) steps = steps.concat(Q.rest());
    go(steps);
    moving = true;
    // (the film: from where the crane is to where the answered move ends)
    const S = D.state, last = steps.filter((st) => st.asked && st.to).pop() || steps.find((st) => st.to);
    film = last ? { from: [S.x, S.hoist, S.z], to: [last.to.x ?? S.x, last.to.hoist ?? S.hoist, last.to.z ?? S.z], t: 0, fresh: true } : null;
    check.n++; magicDue++;
    if (check.n >= check.of) { check.done = true; }
  }
  // (straight across: both parts at speeds in step, so the canister goes in a straight line at the bridge's speed)
  function straightV(R) { const dx = Math.abs(R.to[0] - R.from[0]), dy = Math.abs(R.to[1] - R.from[1]), d = Math.hypot(dx, dy) || 1, T = d / SPEEDS.x; return { x: Math.max(0.05, dx / T), z: Math.max(0.05, dy / T) }; }
  // a wrong answer: where it would have taken the crane, on the grid
  function wrong(q, coin) {
    const f = (q && q.order && q.order.facts) || {}, R = card;
    if (!R || !coin || f.step !== R.id) return;
    const v = f.offset ? coin.v - f.offset : coin.v, said = `${coin.big}${coin.small ? ' ' + coin.small : ''}`;
    if (R.kind === 'over') {
      let to = null;
      if (f.quad) { const c = [[0.75, 0.75], [0.25, 0.75], [0.25, 0.25], [0.75, 0.25]][v - 1]; if (c) to = [G.size[0] * c[0], G.size[1] * c[1]]; }
      else if (f.axis === 'both' && Array.isArray(f.to)) to = [Math.floor(v / 100), v % 100];
      else if (f.axis === 'x' || f.axis === 'y') {
        const i = f.axis === 'x' ? 0 : 1, dir = Math.sign(R.to[i] - R.from[i]) || 1, at = [...R.from];
        at[i] = q.order.key === 'read' ? v : f.T != null ? R.from[i] + dir * v * (i ? SPEEDS.y : SPEEDS.x) : R.from[i] + dir * v;
        to = at;
      }
      if (to) ghost = { kind: 'over', from: R.from, to, label: said, t: clock };
    } else if (R.kind === 'lower') {
      const h = f.change != null ? R.from + v : f.T != null ? R.from - v * SPEEDS.h : R.from - v;
      ghost = { kind: 'lower', h, label: said, t: clock };
    } else ghost = { kind: 'turn', label: said, t: clock };
  }

  // ── the magic: some of the round's other canisters take their places as the check goes on ──────────────────────
  function magic(n) {
    const D = live(); if (!D || !trip) return 0;
    const S = D.state, keepPlace = trip.to ? { kind: trip.to.kind, i: trip.to.i } : null;
    let done = 0;
    for (let k = 0; k < n; k++) {
      const [m] = magicMoves(site, S, check.phase, trip.c, keepPlace); if (!m) break;
      const q = S.cans[m.c], was = { where: q.where, i: q.i };
      if (was.where === 'socket') { S.lit[was.i] = 0; }
      if (was.where === 'mount') S.tray[was.i] = 0;
      q.where = m.to.where; q.i = m.to.i; q.rel = undefined;
      if (m.to.where === 'socket') { const P = placeOf(site, 'socket', m.to.i); q.yaw = P.axis; S.lit[m.to.i] = 1; S.iris[m.to.i] = 1; }
      else if (m.to.where === 'mount') q.yaw = site.mounts[m.to.i].yaw;
      else q.yaw = site.bays[m.to.i].yaw ?? 0;
      done++;
    }
    return done;
  }
  // (how many are left for the magic in this check's part of the round)
  function magicLeft() {
    const D = live(); if (!D || !trip) return 0;
    const S = { ...D.state, cans: D.state.cans.map((q) => ({ ...q })), lit: [...D.state.lit], iris: [...D.state.iris], tray: [...D.state.tray] }, keepPlace = trip.to ? { kind: trip.to.kind, i: trip.to.i } : null;
    let n = 0;
    for (; n < 16; n++) { const [m] = magicMoves(site, S, check.phase, trip.c, keepPlace); if (!m) break; const q = S.cans[m.c]; q.where = m.to.where; q.i = m.to.i; }
    return n;
  }

  // ── the operator's screen: the crane system's strip ───────────────────────────────────────────────────────────
  const strip = document.createElement('div');
  strip.className = 'pcg';
  strip.innerHTML = `<div class="pcg-sys"><b>Crane system</b><span class="pcg-fault">Fault reported: please verify crane operations</span><span class="pcg-check"></span></div>
    <div class="pcg-btns">${onFree ? '<button type="button" class="pcg-free" aria-label="Free control: drive the crane by hand">Free control</button>' : ''}<button type="button" class="pcg-view" aria-label="Change the view (V)">View<kbd>V</kbd></button></div>
    <div class="pcg-banner" hidden></div><p class="pcg-viewname"></p>`;
  document.body.appendChild(strip);
  document.body.classList.add('pcg-on');   // (the strip sits where the Crew button is: that hides while it is up)
  const $ = (s) => strip.querySelector(s);
  if (onFree) $('.pcg-free').addEventListener('click', () => { if (!closed) onFree(); });
  $('.pcg-view').addEventListener('click', () => nextView());
  function nextView() { view = (view + 1) % VIEWS.length; cam.fresh(); const n = $('.pcg-viewname'); n.textContent = NAMES[VIEWS[view]] || ''; n.classList.remove('is-show'); void n.offsetWidth; n.classList.add('is-show'); }
  const onKey = (e) => { if (closed || e.repeat) return; if (e.code === 'KeyV') { e.preventDefault(); nextView(); } };
  addEventListener('keydown', onKey, true);
  let stripKey = '';
  function showStrip() {
    const D = live(), S = D ? D.state : null;
    const docked = S ? S.cans.filter((q) => q.where === 'socket').length : 0, onShip = S ? S.cans.filter((q) => q.where === 'mount').length : 0;
    const ph = check.phase || (trip && trip.phase) || 'unload';
    const where = ph === 'unload' ? `${docked} of ${site.sockets.length} docked` : ph === 'load' ? `${onShip} of ${site.mounts.length} on the ship` : '';
    const dots = Array.from({ length: check.of }, (_, i) => `<i class="${i < check.n ? 'is-done' : ''}"></i>`).join('');
    const key = `${check.n}|${ph}|${where}|${check.verified}|${crane.mode}`;
    if (key === stripKey) return; stripKey = key;
    $('.pcg-check').innerHTML = `<span class="pcg-dots" aria-label="Check ${Math.min(check.n + 1, check.of)} of ${check.of}">${dots}</span><small>${esc(PHASE[ph] || '')}${where ? ': ' + esc(where) : ''}</small>`;
    $('.pcg-fault').textContent = crane.mode === 'landing' ? 'The Miner is landing: stand by' : check.verified ? `Crane operations verified (${check.verified}). Checking again` : 'Fault reported: please verify crane operations';
  }
  function banner(text) { const b = $('.pcg-banner'); b.innerHTML = text; b.hidden = false; b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop'); check.bannerT = clock; }

  // ── the grid over the view from above ─────────────────────────────────────────────────────────────────────────
  const cv = document.createElement('canvas'); cv.className = 'pcg-grid'; document.body.appendChild(cv);
  const g2 = cv.getContext('2d');
  const top = { k: 20, cx: 0, cz: 0, rect: null, on: false };
  // where the grid's metres land on the screen: the free part of it (the panel's side, or above it on a phone)
  function freeRect() {
    const w = innerWidth, h = innerHeight, p = document.querySelector('.pnj-panel'), r = p && p.getBoundingClientRect(), s = strip.getBoundingClientRect();
    const t0 = Math.min(h * 0.4, s.bottom + 6);
    if (r && r.width > 0) { if (r.left > w * 0.35) return { x: 8, y: t0, w: r.left - 16, h: h - t0 - 8 }; return { x: 8, y: t0, w: w - 16, h: Math.max(80, r.top - t0 - 8) }; }
    return { x: 8, y: t0, w: w - 16, h: h - t0 - 8 };
  }
  // what the view from above frames: the whole grid (the quadrants, reading it), or the move (the crane and the place)
  function frameOf() {
    const all = { x0: 0, x1: G.size[0], y0: 0, y1: G.size[1] };
    if (!card || card.kind !== 'over') return all;
    const key = cardKey();
    if (/^(quad|pair|read)/.test(key)) return all;
    const r = freeRect(); if (r.w / G.size[0] > 14) return all;   // (wide enough to show it all)
    const a = card.from, b = card.aim || card.to, m = 3;
    let x0 = Math.min(a[0], b[0]) - m, x1 = Math.max(a[0], b[0]) + m, y0 = Math.min(a[1], b[1]) - m, y1 = Math.max(a[1], b[1]) + m;
    if (x1 - x0 < 12) { const c = (x0 + x1) / 2; x0 = c - 6; x1 = c + 6; }
    if (y1 - y0 < 8) { const c = (y0 + y1) / 2; y0 = c - 4; y1 = c + 4; }
    return { x0, x1, y0, y1 };
  }
  const cardKey = () => { const p = document.querySelector('.pnj'); return (p && p.dataset.key) || ''; };
  function aimTop(camera) {
    const r = freeRect(), F = frameOf(), w = F.x1 - F.x0 + TOP.margin * 2, h = F.y1 - F.y0 + TOP.margin * 2;
    const k = Math.min(r.w / w, r.h / h);
    const [gx, gy] = [(F.x0 + F.x1) / 2, (F.y0 + F.y1) / 2], [X, Z] = fromGrid(site, gx, gy);
    // (the free part's middle is off the screen's middle: the picture is shifted there, the camera itself staying over
    // the hangar, so the station still knows the hangar is the room being looked at)
    const ox = Math.round(r.x + r.w / 2 - innerWidth / 2), oy = Math.round(r.y + r.h / 2 - innerHeight / 2);
    top.k = k; top.cx = X; top.cz = Z; top.ox = ox; top.oy = oy; top.rect = r; top.on = true;
    const fov = 2 * Math.atan(innerHeight / k / 2 / TOP.height) * 180 / Math.PI;
    camera.up.set(0, 0, -1); camera.position.set(top.cx, TOP.height, top.cz); camera.lookAt(top.cx, 0, top.cz); camera.up.set(0, 1, 0);
    const vo = camera.view;
    if (!vo || !vo.enabled || vo.offsetX !== -ox || vo.offsetY !== -oy || vo.fullWidth !== innerWidth || vo.fullHeight !== innerHeight) camera.setViewOffset(innerWidth, innerHeight, -ox, -oy, innerWidth, innerHeight);
    if (Math.abs(camera.fov - fov) > 1e-6 || camera.near !== TOP.height - TOP.over) { camera.fov = fov; camera.near = TOP.height - TOP.over; camera.far = TOP.height + 2; camera.updateProjectionMatrix(); }
    crane.view = 'top';
  }
  const SX = (X) => innerWidth / 2 + top.ox + (X - top.cx) * top.k, SY = (Z) => innerHeight / 2 + top.oy + (Z - top.cz) * top.k;
  const gsx = (gx) => SX(fromGrid(site, gx, 0)[0]), gsy = (gy) => SY(fromGrid(site, 0, gy)[1]);
  function drawGrid() {
    const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = g2; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    if (!top.on) return;
    const [X, Y] = G.size, D = live(), S = D ? D.state : crane.L.state(crane.t), here = toGrid(site, S.x, S.z), key = cardKey();
    const r = top.rect, every = top.k > 16 ? 1 : 2, label = top.k > 24 ? 1 : top.k > 11 ? 2 : 5;
    g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
    // the lines: every metre (or two), every five stronger
    for (let x = 0; x <= X; x += every) { g.strokeStyle = x % 5 ? 'rgba(140, 220, 255, 0.22)' : 'rgba(170, 230, 255, 0.5)'; g.lineWidth = x % 5 ? 1 : 1.6; g.beginPath(); g.moveTo(gsx(x), gsy(0)); g.lineTo(gsx(x), gsy(Y)); g.stroke(); }
    for (let y = 0; y <= Y; y += every) { g.strokeStyle = y % 5 ? 'rgba(140, 220, 255, 0.22)' : 'rgba(170, 230, 255, 0.5)'; g.lineWidth = y % 5 ? 1 : 1.6; g.beginPath(); g.moveTo(gsx(0), gsy(y)); g.lineTo(gsx(X), gsy(y)); g.stroke(); }
    // the quadrants: the middle lines and their numbers
    if (/^quad/.test(key)) {
      g.strokeStyle = 'rgba(255, 210, 120, 0.95)'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(gsx(X / 2), gsy(0)); g.lineTo(gsx(X / 2), gsy(Y)); g.moveTo(gsx(0), gsy(Y / 2)); g.lineTo(gsx(X), gsy(Y / 2)); g.stroke();
      g.font = `800 ${Math.max(22, top.k * 4)}px "Segoe UI", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255, 220, 140, 0.55)';
      [[0.75, 0.75], [0.25, 0.75], [0.25, 0.25], [0.75, 0.25]].forEach(([fx, fy], i) => g.fillText(ROMAN[i], gsx(X * fx), gsy(Y * fy)));
    }
    // the squares to count, along the asked axis
    if (card && card.kind === 'over' && /^count/.test(key) && (card.axis === 'x' || card.axis === 'y')) {
      const i = card.axis === 'x' ? 0 : 1, a = Math.min(card.from[i], card.to[i]), b = Math.max(card.from[i], card.to[i]), o = card.from[1 - i];
      for (let v = a, n = 0; v < b - 1e-6; v++, n++) { g.fillStyle = n % 2 ? 'rgba(255, 180, 80, 0.32)' : 'rgba(255, 210, 120, 0.2)'; if (i === 0) g.fillRect(gsx(v), gsy(o + 0.5), gsx(v + 1) - gsx(v), gsy(o - 0.5) - gsy(o + 0.5)); else g.fillRect(gsx(o - 0.5), gsy(v + 1), gsx(o + 0.5) - gsx(o - 0.5), gsy(v) - gsy(v + 1)); }
    }
    g.restore();
    // the numbers along the edges (x under the grid, y on its left)
    g.font = `700 ${Math.max(11, Math.min(15, top.k * 0.6))}px "Segoe UI", system-ui, sans-serif`; g.fillStyle = 'rgba(210, 240, 255, 0.95)'; g.shadowColor = '#000'; g.shadowBlur = 3;
    const bx = Math.min(r.y + r.h - 4, gsy(0) + 16), lx = Math.max(r.x + 14, gsx(0) - 14);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (let x = 0; x <= X; x += label) { const sx = gsx(x); if (sx > r.x + 10 && sx < r.x + r.w - 10) g.fillText(String(x), sx, bx); }
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let y = 0; y <= Y; y += label) { const sy = gsy(y); if (sy > r.y + 10 && sy < r.y + r.h - 10) g.fillText(String(y), lx + 8, sy); }
    g.textAlign = 'left'; g.fillStyle = '#ffd29e'; g.fillText('x →', Math.min(r.x + r.w - 40, gsx(X) - 30), bx - 18); g.fillText('y ↑', lx - 6, Math.max(r.y + 12, gsy(Y) + 12));
    g.shadowBlur = 0;
    // the crane: a crosshair on the hook, and its numbers
    const cx = gsx(here[0]), cy = gsy(here[1]);
    g.strokeStyle = '#ffb35c'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.moveTo(cx - 16, cy); g.lineTo(cx + 16, cy); g.moveTo(cx, cy - 16); g.lineTo(cx, cy + 16); g.stroke();
    // the place it is about: a pulsing ring; the numbers the card gives, by them
    if (card && card.kind === 'over') {
      const a = card.aim || card.to, tx = gsx(a[0]), ty = gsy(a[1]), p = 10 + 4 * Math.sin(clock * 5);
      g.strokeStyle = '#ffe14a'; g.lineWidth = 3; g.beginPath(); g.arc(tx, ty, p, 0, Math.PI * 2); g.stroke();
      if (!/^(quad|read|pair)/.test(key)) {
        tag(g, cx + 14, cy - 14, card.axis === 'y' ? `y = ${num(card.from[1])}` : card.axis === 'x' ? `x = ${num(card.from[0])}` : `(${num(card.from[0])}, ${num(card.from[1])})`, '#ffb35c');
        tag(g, tx + 14, ty + 20, card.axis === 'y' ? `y = ${num(card.to[1])}` : card.axis === 'x' ? `x = ${num(card.to[0])}` : `(${num(card.to[0])}, ${num(card.to[1])})`, '#ffe14a');
      }
      if (/^(both|straight)/.test(key)) { g.setLineDash([6, 5]); g.strokeStyle = 'rgba(255, 225, 74, 0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(gsx(card.to[0]), gsy(card.to[1])); g.stroke(); g.setLineDash([]); }
    }
    // the hoist's scale: on the left of the free part, for a card about the height
    if (card && card.kind === 'lower') scale(g, r, S.hoist, card);
    // a wrong answer's way, fading
    if (ghost && clock - ghost.t < 3.2) {
      const a = Math.max(0, 1 - (clock - ghost.t) / 3.2);
      g.globalAlpha = a;
      if (ghost.kind === 'over') { const fx = gsx(ghost.from[0]), fy = gsy(ghost.from[1]), qx = gsx(ghost.to[0]), qy = gsy(ghost.to[1]); g.setLineDash([7, 6]); g.strokeStyle = '#ff9a4a'; g.lineWidth = 3; g.beginPath(); g.moveTo(fx, fy); g.lineTo(qx, qy); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(qx, qy, 11, 0, Math.PI * 2); g.stroke(); tag(g, qx + 14, qy - 14, ghost.label, '#ff9a4a'); }
      else if (ghost.kind === 'lower' && card) scale(g, r, S.hoist, card, ghost);
      g.globalAlpha = 1;
    }
  }
  const num = (v) => String(Math.round(v * 100) / 100);
  function tag(g, x, y, text, col) {
    g.font = '700 14px "Segoe UI", system-ui, sans-serif'; const w = g.measureText(text).width + 12;
    g.fillStyle = 'rgba(8, 14, 20, 0.85)'; g.fillRect(x, y - 11, w, 22); g.strokeStyle = col; g.lineWidth = 1.5; g.strokeRect(x, y - 11, w, 22);
    g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(text, x + 6, y + 1);
  }
  // the hoist's scale: 0 to 7 m, the grab where it is, the place's height; a wrong answer's height faintly
  function scale(g, r, h, R, gh = null) {
    const x = r.x + 46, y0 = r.y + r.h - 30, y1 = Math.max(r.y + 20, y0 - 300), Y = (v) => y0 - (v / 7) * (y0 - y1);
    g.fillStyle = 'rgba(8, 14, 20, 0.8)'; g.fillRect(x - 40, y1 - 14, 120, y0 - y1 + 28);
    g.strokeStyle = 'rgba(170, 230, 255, 0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
    g.font = '700 12px "Segoe UI", system-ui, sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(210, 240, 255, 0.95)';
    for (let v = 0; v <= 7; v++) { g.beginPath(); g.moveTo(x - 6, Y(v)); g.lineTo(x + 6, Y(v)); g.stroke(); g.fillText(`${v} m`, x - 9, Y(v)); }
    if (gh) { g.strokeStyle = '#ff9a4a'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(x + 10, Y(R.from)); g.lineTo(x + 10, Y(Math.max(0, gh.h))); g.stroke(); g.setLineDash([]); tag(g, x + 18, Y(Math.max(0, gh.h)), gh.label, '#ff9a4a'); return; }
    g.fillStyle = '#ffb35c'; g.fillRect(x + 8, Y(h) - 5, 22, 10); g.textAlign = 'left'; g.fillText(`grab ${num(h)}`, x + 34, Y(h));
    g.fillStyle = '#ffe14a'; g.fillRect(x + 8, Y(R.to) - 4, 16, 8); g.fillText(`${num(R.to)}`, x + 34, Y(R.to) + (Math.abs(Y(R.to) - Y(h)) < 14 ? 14 : 0));
  }

  // ── each frame ──────────────────────────────────────────────────────────────────────────────────────────────
  function update(dt) {
    if (closed) return;
    clock += dt;
    // (sat down while the Miner was landing: the crane is taken once it is down)
    if (crane.mode === 'round') crane.take();
    const D = live();
    if (D) {
      D.byHand = false; D.rules.people = true;
      // (a move that could not be made: the trip planned again from where the crane is)
      if (D.failed && !D.busy) { console.info('crane game: a move could not be made (' + (D.failed.why || '') + '); planning again from here'); D.failed = null; Q.restart(); go(Q.rest()); card = null; }
      // (while a card waits for the crane, the moves it makes by itself go quicker: an asked one never)
      D.hurry = clock - waitT < 0.4 ? 2 : 1;
      if (lastBusy && !D.busy) {
        moving = false; film = null;
        // the magic, spread over the check: what is left of this part of the round, a share each answer
        if (magicDue) { const left = Math.max(1, check.of - check.n + 1), n = Math.ceil(magicLeft() / left); magic(check.done ? 16 : n * magicDue); magicDue = 0; }
        if (check.done) {
          check.verified++;
          banner(`<b>Crane operations verified</b><span>${esc(PHASE[check.phase] || 'The check')}: done.</span>`);
          check = { n: 0, of: GAME.questions, phase: null, done: false, bannerT: clock, verified: check.verified };
        }
      }
      lastBusy = D.busy;
      L_aid(D);
    }
    if (!$('.pcg-banner').hidden && clock - check.bannerT > 3) $('.pcg-banner').hidden = true;
    showStrip();
    drawGrid();
  }
  // the docking lights while the game drives: lined up with the place the card is about
  function L_aid(D) { D.aimAt = card && card.place ? { kind: card.place.kind, i: card.place.i, at: card.place.at } : null; }

  // ── the camera ──────────────────────────────────────────────────────────────────────────────────────────────
  function aim(camera, dt) {
    const D = live(), S = D ? D.state : crane.L.state(crane.t), v = VIEWS[view];
    const busy = D && D.busy;
    if (v === 'grid' && !busy && !moving && crane.mode !== 'landing') { aimTop(camera); return; }
    top.on = false; crane.view = null;
    if (camera.view && camera.view.enabled) camera.clearViewOffset();
    if (camera.near !== 0.03 || camera.far !== 120) { camera.near = 0.03; camera.far = 120; camera.updateProjectionMatrix(); }
    const shift = innerHeight > innerWidth * 1.05 || innerWidth <= 640 ? [0, -0.22] : [0.18, 0];
    if (v === 'grid' && film) { filmCam(camera, S, dt, shift); return; }
    cam.aim(camera, S, dt, { fixed: v === 'grid' || v === 'follow' ? null : viewCam(crane, v), shift });
  }
  // THE FILM of an answered move: from beside its way (the hangar's middle side of it), far enough to see it all,
  // looking at the hook as it goes; for a move up or down, from beside the hook at its middle height
  function filmCam(camera, S, dt, shift) {
    const F = film, mid = [(F.from[0] + F.to[0]) / 2, (F.from[1] + F.to[1]) / 2, (F.from[2] + F.to[2]) / 2];
    const dx = F.to[0] - F.from[0], dz = F.to[2] - F.from[2], len = Math.hypot(dx, dz);
    const cx = (site.rail.x[0] + site.rail.x[1]) / 2, cz = (site.rail.z[0] + site.rail.z[1]) / 2;
    let px, pz, d;
    if (len > 0.8) {
      px = -dz / len; pz = dx / len;
      if ((cx - mid[0]) * px + (cz - mid[2]) * pz < 0) { px = -px; pz = -pz; }   // (toward the hangar's middle)
      d = Math.max(7, len * 0.75 + 3);
      _w.set(mid[0] + px * d - dx * 0.15, Math.max(2.6, Math.min(7.8, Math.max(F.from[1], F.to[1]) - 0.5)), mid[2] + pz * d - dz * 0.15);
    } else {
      const ax = cx - mid[0], az = cz - mid[2], L = Math.hypot(ax, az) || 1; px = ax / L; pz = az / L; d = 7;
      _w.set(mid[0] + px * d + pz * 2, Math.max(2.2, mid[1] + 0.8), mid[2] + pz * d - px * 2);
    }
    _w.x = Math.max(site.rail.x[0] - 1.2, Math.min(site.rail.x[1] + 1.2, _w.x)); _w.z = Math.max(site.rail.z[0] - 0.6, Math.min(site.rail.z[1] + 0.6, _w.z));
    _l.set(S.x * 0.65 + mid[0] * 0.35, S.hoist - 0.6, S.z * 0.65 + mid[2] * 0.35);
    if (shift) { const fx = _l.x - _w.x, fz = _l.z - _w.z, L = Math.hypot(fx, fz) || 1, k = Math.hypot(fx, fz); _l.x += (-fz / L) * shift[0] * k; _l.z += (fx / L) * shift[0] * k; _l.y += shift[1] * k; }
    if (F.fresh) { filmAt.copy(_w); filmLook.copy(_l); F.fresh = false; }
    const k1 = 1 - Math.exp(-2.5 * dt), k2 = 1 - Math.exp(-6 * dt);
    filmAt.lerp(_w, k1); filmLook.lerp(_l, k2);
    if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
    camera.position.copy(filmAt); camera.lookAt(filmLook);
  }

  // ── the panel's side of it ──────────────────────────────────────────────────────────────────────────────────
  const now = () => ({ ask, peek: () => (live() ? Q.peek() : null), pass: () => { const D = live(); if (D) go(Q.skip()); }, site });
  // (a card can be answered once the crane is where it starts: until then the panel dims its answers and says so)
  function ready() {
    const D = live();
    if (crane.mode === 'landing') return { ok: false, why: 'The Miner is landing: the crane waits.' };
    if (!D) return { ok: false, why: 'The crane is finishing its move...' };
    if (!D.busy && !moving) return true;
    waitT = clock;
    return { ok: false, why: D.notes.some((n) => n.key === 'people') ? 'The crane is waiting: someone is under it.' : moving ? 'The crane is moving...' : 'The crane is getting into place...' };
  }
  // (the panel's card says which maker it is: the grid draws for it)
  function mount(el) { el.classList.add('is-crane'); }
  function close(keep = false) {
    if (closed) return;
    closed = true; removeEventListener('keydown', onKey, true);
    strip.remove(); cv.remove(); document.body.classList.remove('pcg-on');
    crane.target = null; crane.places = []; crane.view = null;
    if (W.camera.view && W.camera.view.enabled) W.camera.clearViewOffset();
    W.camera.near = 0.03; W.camera.far = 120; W.camera.updateProjectionMatrix();
    if (crane.drive) { crane.drive.hurry = 1; crane.drive.byHand = true; crane.drive.rules.people = false; crane.drive.aimAt = null; if (!keep) crane.drive.stop(); }
    if (!keep) crane.give();
  }
  return { now, right, wrong, ready, update, aim, mount, close, Q,
    get view() { return VIEWS[view]; }, setView(n) { const i = VIEWS.indexOf(n); if (i >= 0) { view = i; cam.fresh(); } },
    state: () => ({ trip: Q.trip && { c: Q.trip.c, phase: Q.trip.phase, from: Q.trip.from, to: Q.trip.to }, card: card && { kind: card.kind, axis: card.axis, from: card.from, to: card.to }, reserved: Q.reserved && { id: Q.reserved.id, kind: Q.reserved.kind }, left: Q.left(), busy: live() ? live().busy : null, failed: live() ? live().failed : null, mode: crane.mode, check: { ...check }, view: VIEWS[view], top: top.on, ghost: !!ghost }) };
}
