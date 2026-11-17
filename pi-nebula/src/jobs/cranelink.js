// THE CRANE GAME AND THE CRANE: what joins the crane game's cards (src/jobs/crane.js) to the live crane (src/crane.js
// take/give, kit/crane-drive.js), and the operator's screen round them (the game's maker, 2026-11-16: "the crane system
// should be able to function automatically. But if the player goes to the chair then it could say the system is having a
// malfunction, please verify crane operations ... identifying the coordinates of the pods with a overhead camera and a
// overlaid grid ... It would be cool to see short cinematic with each answer to show the crane moving").
//   - THE SCREEN: a strip over the top of the view, the crane system's own: the fault, which check this is (five answers
//     each), what the round is at, and two switches: Free control (the crane by hand: src/cranedrive.js) and View.
//   - THE VIEW FROM ABOVE: while a card waits for its answer, the camera looks straight down on the hangar (from very
//     high, with a narrow lens, so it is as flat as a plan) with the bay door at the top (the game's maker: "I want
//     'up' to be towards the hanger door"), and the GRID is laid over it: the metres from the back corner on the left
//     as you come in (src/jobs/crane.js gridOf), the quadrants, the crane and the place it is going to, the numbers
//     the card asks about, a finding card's four marks.
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
import { makeGame, toGrid, fromGrid, gridOf, placeOf, magicMoves, GAME } from './crane.js';
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
  let closed = false, clock = 0, view = 0, card = null, moving = false, lastBusy = false, ghost = null, waitT = -9, blink = null;
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
    // (the canister it is about blinks; or the socket it goes to; never for a card that asks where it is: update())
    blink = r.what === 'pick' ? { can: r.c } : r.place && r.place.kind === 'socket' ? { socket: r.place.i } : { can: r.c };
    crane.target = blink;
    crane.places = r.what === 'drop' && r.place && r.place.kind !== 'socket' ? [{ kind: r.place.kind, i: r.place.i, look: 'near' }] : [];
    return r;
  }
  function right(q) {
    const D = live(); if (!D) return;
    const f = (q && q.order && q.order.facts) || {};
    ghost = null;
    let steps;
    if (f.step != null && Q.reserved && Q.reserved.id === f.step) steps = Q.right(null);
    else steps = Q.skip();
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
  // a wrong answer: where it would have taken the crane, on the grid
  function wrong(q, coin) {
    const f = (q && q.order && q.order.facts) || {}, R = card;
    if (!R || !coin || f.step !== R.id) return;
    const v = f.offset ? coin.v - f.offset : coin.v, said = `${coin.big}${coin.small ? ' ' + coin.small : ''}`;
    if (R.kind === 'over') {
      let to = null;
      const i = f.axis === 'y' ? 1 : 0, dir = Math.sign(R.to[i] - R.from[i]) || 1, along = (d) => { const at = [...R.from]; at[i] = R.from[i] + dir * d; return at; };
      if (f.mode === 'quad') { const c = [[0.75, 0.75], [0.25, 0.75], [0.25, 0.25], [0.75, 0.25]][v - 1]; if (c) to = [G.size[0] * c[0], G.size[1] * c[1]]; }
      else if (f.mode === 'pair') to = [Math.floor(v / 100), v % 100];
      else if (f.mode === 'find') { const m = (f.marks || [])[v - 1]; if (m) to = m.at; }
      else if (f.mode === 'both') { const sx = Math.sign(R.to[0] - R.from[0]) || 1, sy = Math.sign(R.to[1] - R.from[1]) || 1; to = [R.from[0] + sx * Math.floor(v / 100), R.from[1] + sy * (v % 100)]; }
      else if (f.mode === 'read') { to = [...R.from]; to[i] = v; }
      else if (f.mode === 'signed') { to = [...R.from]; to[i] = R.from[i] + v; }
      else if (f.mode === 'legs') to = along(v - (f.leg1 || 0));
      else if (f.mode === 'along') to = along(v);
      if (to) ghost = { kind: 'over', from: R.from, to, label: said, t: clock };
    } else if (R.kind === 'lower') {
      const h = f.mode === 'change' ? R.from + v : R.from - v;
      ghost = { kind: 'lower', h, label: said, t: clock };
    }
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
    // (two lines, two counts: this check's answers as dots, then how far the round's part has got)
    $('.pcg-check').innerHTML = `<span class="pcg-answers"><em>Check</em><span class="pcg-dots" aria-label="Answer ${Math.min(check.n + 1, check.of)} of ${check.of}">${dots}</span></span><small>${esc(PHASE[ph] || '')}${where ? ': ' + esc(where) : ''}</small>`;
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
    if (/^(quad|pair|read|find|where)/.test(key)) return all;
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
    top.k = k; top.cx = X; top.cz = Z; top.gx = gx; top.gy = gy; top.ox = ox; top.oy = oy; top.rect = r; top.on = true;
    const fov = 2 * Math.atan(innerHeight / k / 2 / TOP.height) * 180 / Math.PI;
    // (the screen's up is the grid's y, toward the bay door; its right is then the grid's x)
    camera.up.set(G.y[0], 0, G.y[1]); camera.position.set(top.cx, TOP.height, top.cz); camera.lookAt(top.cx, 0, top.cz); camera.up.set(0, 1, 0);
    const vo = camera.view;
    if (!vo || !vo.enabled || vo.offsetX !== -ox || vo.offsetY !== -oy || vo.fullWidth !== innerWidth || vo.fullHeight !== innerHeight) camera.setViewOffset(innerWidth, innerHeight, -ox, -oy, innerWidth, innerHeight);
    if (Math.abs(camera.fov - fov) > 1e-6 || camera.near !== TOP.height - TOP.over) { camera.fov = fov; camera.near = TOP.height - TOP.over; camera.far = TOP.height + 2; camera.updateProjectionMatrix(); }
    crane.view = 'top';
  }
  // where a grid point lands on the screen: x to the right, y up, from the grid point over the picture's middle
  const gsx = (gx) => innerWidth / 2 + top.ox + (gx - top.gx) * top.k, gsy = (gy) => innerHeight / 2 + top.oy - (gy - top.gy) * top.k;
  function drawGrid() {
    const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = g2; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    if (!top.on) return;
    const [X, Y] = G.size, D = live(), S = D ? D.state : crane.L.state(crane.t), here = toGrid(site, S.x, S.z), key = cardKey();
    // (a line every metre, as the cards count in whole metres, unless the picture is far too small for them)
    const r = top.rect, every = top.k > 7 ? 1 : 2, label = top.k > 24 ? 1 : top.k > 11 ? 2 : 5;
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
    // (which way is which in the hangar: the bay door at the top, the way in at the foot)
    g.font = '700 11px "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255, 210, 158, 0.85)';
    if (gsy(Y) - 8 > r.y + 4) g.fillText('BAY DOOR', gsx(X / 2), gsy(Y) - 8);
    if (gsy(0) - 10 < r.y + r.h - 4) g.fillText('WAY IN', gsx(X / 2), gsy(0) - 10);
    g.shadowBlur = 0;
    // the crane: a crosshair on the hook, and its numbers
    const cx = gsx(here[0]), cy = gsy(here[1]);
    g.strokeStyle = '#ffb35c'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.moveTo(cx - 16, cy); g.lineTo(cx + 16, cy); g.moveTo(cx, cy - 16); g.lineTo(cx, cy + 16); g.stroke();
    // the place it is about: a pulsing ring (not for a card that asks where it is, nor one with marks to choose from);
    // the numbers the card gives, by them
    if (card && card.kind === 'over') {
      // (a card about a place rings the place itself; one about a move, the spot the crane stops at: in front of a socket)
      const a = /^(quad|read|pair|find)/.test(key) ? card.aim || card.to : card.to, tx = gsx(a[0]), ty = gsy(a[1]), p = 12 + 5 * Math.sin(clock * 5), hide = /^(where|find)/.test(key);
      if (!hide) {
        // (a dark edge under the yellow ring: the hangar's own yellow, the pad's rings and the bridge, would hide it)
        g.strokeStyle = 'rgba(0, 0, 0, 0.8)'; g.lineWidth = 8; g.beginPath(); g.arc(tx, ty, p, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = '#ffe14a'; g.lineWidth = 3.5; g.beginPath(); g.arc(tx, ty, p, 0, Math.PI * 2); g.stroke();
      }
      // (a finding card's four marks, lettered)
      if (/^find/.test(key) && card.marks) for (const m of card.marks) {
        const mx = gsx(m.at[0]), my = gsy(m.at[1]);
        g.fillStyle = 'rgba(8, 14, 20, 0.85)'; g.beginPath(); g.arc(mx, my, 13, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#9fe8ff'; g.lineWidth = 2.5; g.stroke();
        g.font = '800 15px "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#eaf8ff'; g.fillText(m.letter, mx, my + 1);
      }
      const P2 = (q) => `(${num(q[0])}, ${num(q[1])})`;
      if (/^(where)/.test(key)) tag(g, cx + 14, cy - 14, P2(card.from), '#ffb35c');
      else if (!/^(quad|read|pair|find)/.test(key)) {
        tag(g, cx + 14, cy - 14, card.axis === 'y' ? `y = ${num(card.from[1])}` : card.axis === 'x' ? `x = ${num(card.from[0])}` : P2(card.from), '#ffb35c');
        tag(g, tx + 14, ty + 20, card.axis === 'y' ? `y = ${num(card.to[1])}` : card.axis === 'x' ? `x = ${num(card.to[0])}` : P2(card.to), '#ffe14a');
      }
      // (how far along x and along y: the two ways to go, one after the other)
      if (/^both/.test(key)) { g.setLineDash([6, 5]); g.strokeStyle = 'rgba(255, 225, 74, 0.85)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(gsx(card.to[0]), cy); g.lineTo(gsx(card.to[0]), gsy(card.to[1])); g.stroke(); g.setLineDash([]); }
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
    // (after a wrong reading: the way to read it, the grid line from the blinking canister down to the x numbers, or
    // across to the y numbers, as the wrong answer's words say)
    if (ghost && card && card.kind === 'over' && /^(read|pair)/.test(key) && clock - ghost.t < 6) {
      const a = card.aim || card.to, tx = gsx(a[0]), ty = gsy(a[1]), ax = card.axis;
      g.save(); g.setLineDash([5, 5]); g.strokeStyle = '#9fe8ff'; g.lineWidth = 2.5; g.beginPath();
      if (ax !== 'y') { g.moveTo(tx, ty + 14); g.lineTo(tx, Math.min(r.y + r.h - 20, gsy(0))); }
      if (ax !== 'x') { g.moveTo(tx - 14, ty); g.lineTo(Math.max(r.x + 22, gsx(0)), ty); }
      g.stroke(); g.restore();
    }
  }
  const num = (v) => String(Math.round(v * 100) / 100);
  function tag(g, x, y, text, col) {
    g.font = '700 14px "Segoe UI", system-ui, sans-serif'; const w = g.measureText(text).width + 12;
    g.fillStyle = 'rgba(8, 14, 20, 0.85)'; g.fillRect(x, y - 11, w, 22); g.strokeStyle = col; g.lineWidth = 1.5; g.strokeRect(x, y - 11, w, 22);
    g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(text, x + 6, y + 1);
  }
  // the hoist's scale: 0 to 7 m, the grab where it is, the place's height; a wrong answer's height faintly. A gauge of
  // its own, titled, on the right of the picture in amber: up the screen is y on the grid, so the height is kept apart
  // from the grid's own numbers
  function scale(g, r, h, R, gh = null) {
    // (its foot clear of the grid's x numbers along the bottom)
    const x = r.x + r.w - 112, y0 = r.y + r.h - 52, y1 = Math.max(r.y + 46, y0 - 300), Y = (v) => y0 - (v / 7) * (y0 - y1);
    g.fillStyle = 'rgba(14, 10, 4, 0.88)'; g.fillRect(x - 46, y1 - 40, 150, y0 - y1 + 54);
    g.strokeStyle = 'rgba(255, 179, 92, 0.85)'; g.lineWidth = 1.5; g.strokeRect(x - 46, y1 - 40, 150, y0 - y1 + 54);
    g.font = '800 12px "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd29e'; g.fillText('HEIGHT', x + 29, y1 - 24);
    g.strokeStyle = 'rgba(255, 210, 160, 0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
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
      // (the canister or socket the card is about blinks, but not for a card that asks where it is: that is the sum)
      const want = /^where/.test(cardKey()) ? null : blink;
      if (crane.target !== want) crane.target = want;
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
  // (where the film camera stands: beside the move, toward the hangar's middle, but where it can see the move: candidate
  // places round it, each one's lines to the move's start, middle and end walked through the crane's own voxels (the
  // station as built), and none hanging over something (the Miner's hull, the rack: it would fill the picture's
  // foreground); the best kept, the first choice when they are as good)
  function filmSpot(F, mid, dx, dz, len) {
    const cx = (site.rail.x[0] + site.rail.x[1]) / 2, cz = (site.rail.z[0] + site.rail.z[1]) / 2;
    const V = (() => { try { return crane.voxels(); } catch (e) { return null; } })();
    const inside = (x, z) => x > site.rail.x[0] - 1.2 && x < site.rail.x[1] + 1.2 && z > site.rail.z[0] - 0.6 && z < site.rail.z[1] + 0.6;
    const at = (o) => (len > 0.8 ? [mid[0] + o.px * o.d - dx * 0.15, o.y, mid[2] + o.pz * o.d - dz * 0.15] : [mid[0] + o.px * o.d + o.pz * 2, o.y, mid[2] + o.pz * o.d - o.px * 2]);
    const low = Math.max(0.6, Math.min(F.from[1], F.to[1]) - 0.6);
    const looks = [[F.to[0], low, F.to[2]], [mid[0], low, mid[2]], [F.from[0], Math.max(0.6, F.from[1] - 0.6), F.from[2]]];
    // (half a voxel a step: a wall's shell is one voxel thick; the last 1.4 m, the move's own load and place, not walked)
    const clear = (p, q) => {
      if (!V) return true;
      const ex = q[0] - p[0], ey = q[1] - p[1], ez = q[2] - p[2], L = Math.hypot(ex, ey, ez), n = Math.floor((L - 1.4) / 0.05);
      for (let i = 0; i <= n; i++) { const k = (i * 0.05) / L; if (V.full(p[0] + ex * k, p[1] + ey * k, p[2] + ez * k)) return false; }
      return true;
    };
    // (how much of the picture round the move it sees: lines to each look point and to points round it, across and up
    // and down as the picture shows them; something big just in front of the camera blocks many of them)
    const OFF = [[0, 0], [1.6, 0], [-1.6, 0], [0, 1.1], [0, -1.1], [1.1, 0.8], [-1.1, 0.8], [1.1, -0.8], [-1.1, -0.8]];
    const sees = (p) => {
      let n = 0;
      for (const q of looks) {
        const fx = q[0] - p[0], fz = q[2] - p[2], fl = Math.hypot(fx, fz) || 1, rx = -fz / fl, rz = fx / fl;
        for (const [ox, oy] of OFF) if (clear(p, [q[0] + rx * ox, q[1] + oy, q[2] + rz * ox])) n++;
      }
      return n;
    };
    // (nothing within arm's reach of the camera, and nothing under it: the Miner's hull, the rack, the catwalk)
    const near = (p) => { if (!V) return false; for (const [dx2, dy2, dz2] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [0.7, -0.7, 0], [-0.7, -0.7, 0], [0, -0.7, 0.7], [0, -0.7, -0.7]]) for (const r2 of [0.6, 1.2, 1.8]) if (V.full(p[0] + dx2 * r2, p[1] + dy2 * r2, p[2] + dz2 * r2)) return true; return false; };
    const over = (p) => { if (!V) return false; for (let y = p[1] - 0.4; y > 0.4; y -= 0.1) for (const [ox, oz] of [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) if (V.full(p[0] + ox, y, p[2] + oz)) return true; return false; };
    let first, d, y;
    if (len > 0.8) {
      first = Math.atan2(dx / len, -dz / len);   // (the way across the move: px = -dz / len, pz = dx / len)
      if ((cx - mid[0]) * (-dz / len) + (cz - mid[2]) * (dx / len) < 0) first += Math.PI;   // (toward the hangar's middle)
      d = Math.max(7, len * 0.75 + 3); y = Math.max(2.6, Math.min(7.8, Math.max(F.from[1], F.to[1]) - 0.5));
    } else { first = Math.atan2(cz - mid[2], cx - mid[0]); d = 8.5; y = Math.max(2.2, mid[1] + 0.8); }
    let best = null, bestScore = -Infinity;
    for (const turn of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.2, -2.2, Math.PI]) for (const [dd, yy] of [[d, y], [d, y + 1.6], [d * 0.75, y + 1.2], [d * 1.3, y + 0.8]]) {
      const a = first + turn, o = { px: Math.cos(a), pz: Math.sin(a), d: dd, y: Math.min(7.8, yy) }, p = at(o);
      if (!inside(p[0], p[2]) || (V && V.full(p[0], p[1], p[2]))) continue;
      const score = sees(p) * 2 - (near(p) ? 20 : 0) - (over(p) ? 12 : 0) - Math.abs(turn) * 1.5 - (dd === d && yy === y ? 0 : 1);
      if (score > bestScore) { best = o; bestScore = score; }
    }
    return best || { px: Math.cos(first), pz: Math.sin(first), d, y };
  }
  function filmCam(camera, S, dt, shift) {
    const F = film, mid = [(F.from[0] + F.to[0]) / 2, (F.from[1] + F.to[1]) / 2, (F.from[2] + F.to[2]) / 2];
    const dx = F.to[0] - F.from[0], dz = F.to[2] - F.from[2], len = Math.hypot(dx, dz);
    if (!F.spot) F.spot = filmSpot(F, mid, dx, dz, len);
    const o = F.spot;
    if (len > 0.8) _w.set(mid[0] + o.px * o.d - dx * 0.15, o.y, mid[2] + o.pz * o.d - dz * 0.15);
    else _w.set(mid[0] + o.px * o.d + o.pz * 2, o.y, mid[2] + o.pz * o.d - o.px * 2);
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
  const now = () => ({ ask, peek: () => (live() ? Q.peek() : null), pass: () => { const D = live(); if (D) go(Q.skip()); }, only: (kinds) => Q.only(kinds), preview: () => (live() ? Q.preview() : null), leg1: () => Q.leg1(), site });
  // (a card can be answered once the crane is where it starts: until then the panel dims its answers and says so)
  function ready() {
    const D = live();
    if (crane.mode === 'landing') return { ok: false, why: 'The Miner is landing: the crane waits.' };
    if (!D) return { ok: false, why: 'The crane is finishing its move...' };
    // (the next card comes once the "verified" banner has gone: it covers the grid the card is about)
    if (!$('.pcg-banner').hidden && clock - check.bannerT < 2.6) return { ok: false, why: 'Crane operations verified!' };
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
