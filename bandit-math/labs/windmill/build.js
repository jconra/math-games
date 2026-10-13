// BUILDING: the lumber panel on the left (the board on the bench with its tape measure and saw, the cut pieces waiting)
// and putting a piece up on the tower: drag it onto the wall, slide it (the round handle in its middle), swing it about
// either end (the handles at its ends), nail it. While a board is held, its length and the angles where it meets other
// boards are drawn over the view, and the spots where it will be nailed glow.
//
// Snapping, so a shaky finger still builds square: positions go to the half foot; an end that comes near another
// board's end, a corner line, the ground or a board's edge lands right on it; an angle goes to every 5 degrees, or to
// exactly where the free end lands on a board. A board standing straight up on a wall's left or right edge becomes a
// corner post. The faint dashed boards are where a piece of the same length would mirror one on the next wall.
import { W, SNAP, BOARD_FT, faceSegments, postSide } from './tower.js';
import { touch } from './frame.js';
import * as sound from './sound.js';

const DEG = Math.PI / 180;
const snapTo = (v, s = SNAP) => Math.round(v / s) * s;
const fmt = (ft) => { const w = Math.floor(ft + 1e-6), h = ft - w > 0.25; return (w ? w : '') + (h ? '½' : '') + (w || h ? '' : '0') + ' ft'; };
export { fmt };

export function makeBuild(app) {
  const el = app.el;
  let nextId = 1;
  const newPiece = (len, full = false) => ({ id: 'w' + nextId++, len, full });
  const L = app.lumber;

  // ── the panel ────────────────────────────────────────────────────────────────────────────────────────────────────
  let cutAt = 4;
  function freshStack(n) {
    L.stack = n; L.pieces = []; L.bench = null; nextBench(); cutAt = 4; renderPanel();
  }
  function nextBench() { if (L.stack > 0) { L.stack--; L.bench = newPiece(BOARD_FT, true); } else L.bench = null; }
  function fullCount() { return L.stack + (L.bench && L.bench.full ? 1 : 0); }

  function renderPanel() {
    el.count.textContent = fullCount();
    el.countWord.textContent = fullCount() === 1 ? 'full board left' : 'full boards left';
    const b = L.bench;
    el.bench.hidden = !b; el.benchEmpty.hidden = !!b;
    if (b) {
      const h = el.benchBoard.parentElement.clientHeight || 300, pxFt = h / BOARD_FT;
      el.benchBoard.style.height = (b.len * pxFt) + 'px';
      el.benchBoard.dataset.len = b.len;
      // the tape: a tick every half foot, a number every foot
      let ticks = '';
      for (let f = 0; f <= b.len + 1e-6; f += 0.5) ticks += `<i class="${f % 1 ? 'half' : 'foot'}" style="bottom:${f * pxFt}px">${f % 1 || !f ? '' : '<b>' + f + '</b>'}</i>`;
      el.tape.innerHTML = ticks; el.tape.style.height = (b.len * pxFt) + 'px';
      cutAt = Math.min(Math.max(SNAP, cutAt), b.len - SNAP);
      const canCut = b.len > SNAP * 1.5;
      el.saw.hidden = !canCut; el.cutBtn.disabled = !canCut;
      el.saw.style.bottom = (cutAt * pxFt) + 'px';
      el.sawLabel.innerHTML = `${fmt(cutAt)} <span>|</span> ${fmt(b.len - cutAt)}`;
      el.benchLabel.textContent = b.full ? 'Fresh 8 ft board' : fmt(b.len) + ' piece';
    }
    el.pieces.innerHTML = '';
    const pxFt = Math.min(15, (el.pieces.clientWidth || 120) > 160 ? 15 : 11);
    L.pieces.sort((a, b) => b.len - a.len);
    for (const p of L.pieces) {
      const d = document.createElement('div'); d.className = 'piece' + (p.fresh ? ' is-new' : ''); p.fresh = false;
      d.innerHTML = `<div class="stick" style="height:${p.len * pxFt}px"></div><span>${fmt(p.len)}</span>`;
      d.title = 'Drag onto the tower. Tap to put it on the bench and cut it.';
      wireDrag(d, p); el.pieces.appendChild(d);
    }
    el.piecesEmpty.hidden = L.pieces.length > 0;
    app.onLumber && app.onLumber(fullCount());
  }
  // the saw line: drag it up and down the board (snaps to the half foot), then Cut
  el.saw.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); sound.audioOn(); el.saw.setPointerCapture(e.pointerId); sawDragged = true;
    const move = (ev) => {
      const r = el.benchBoard.getBoundingClientRect(), b = L.bench; if (!b) return;
      const ft = (r.bottom - ev.clientY) / r.height * b.len;
      cutAt = Math.min(b.len - SNAP, Math.max(SNAP, snapTo(ft))); renderPanel();
    };
    const up = () => { el.saw.removeEventListener('pointermove', move); el.saw.removeEventListener('pointerup', up); el.saw.removeEventListener('pointercancel', up); };
    el.saw.addEventListener('pointermove', move); el.saw.addEventListener('pointerup', up); el.saw.addEventListener('pointercancel', up);
  });
  // a tap on the board moves the saw there
  let sawDragged = false;
  el.benchBoard.addEventListener('click', (e) => {
    if (dragJustEnded || sawDragged || e.target.closest('.saw')) { sawDragged = false; return; }
    const r = el.benchBoard.getBoundingClientRect(), b = L.bench; if (!b) return;
    cutAt = Math.min(b.len - SNAP, Math.max(SNAP, snapTo((r.bottom - e.clientY) / r.height * b.len))); renderPanel();
  });
  function cut() {
    const b = L.bench; if (!b || b.len <= SNAP * 1.5) return;
    sound.audioOn(); sound.saw();
    const lo = newPiece(cutAt), hi = newPiece(b.len - cutAt); lo.fresh = hi.fresh = true;
    L.pieces.push(lo, hi);
    nextBench(); cutAt = Math.min(4, (L.bench ? L.bench.len : 8) - SNAP);
    el.benchBoard.classList.remove('is-cut'); void el.benchBoard.offsetWidth; el.benchBoard.classList.add('is-cut');
    renderPanel(); app.onCut && app.onCut(lo, hi);
  }
  el.cutBtn.addEventListener('click', cut);
  // put a waiting piece on the bench to cut it smaller (a fresh board there goes back on the stack)
  function toBench(p) {
    if (L.bench) { if (L.bench.full) L.stack++; else L.pieces.push(L.bench); }
    L.pieces = L.pieces.filter((q) => q !== p); L.bench = p; cutAt = snapTo(p.len / 2); sound.clunk(); renderPanel();
  }

  // ── dragging a piece (or the whole board on the bench) from the panel onto the tower ─────────────────────────────
  let dragJustEnded = false;
  function wireDrag(node, piece, fromBench = false) {
    node.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || app.phase !== 'build') return;
      e.preventDefault(); sound.audioOn();
      const sx = e.clientX, sy = e.clientY; let dragging = false, ghost = null, onView = false;
      // (listening on the window: the panel redraws its pieces while one is being dragged)
      const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 7) return;
        if (!dragging) {
          dragging = true; ghost = document.createElement('div'); ghost.className = 'ghost-piece';
          ghost.innerHTML = `<div class="stick"></div><span>${fmt(piece.len)}</span>`; document.body.appendChild(ghost); node.classList.add('is-lifted');
        }
        ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
        const r = el.view.getBoundingClientRect();
        const over = ev.clientX > r.left + 4 && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
        if (over && !onView) { onView = true; takeUp(piece, fromBench); }
        if (onView && app.held) { ghost.style.opacity = over ? 0 : 1; if (over) { placeAtPointer(ev.clientX, ev.clientY, true); edgeWatch(ev.clientX, ev.clientY); } }
      };
      const up = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        node.classList.remove('is-lifted'); if (ghost) ghost.remove(); stopEdge();
        if (!dragging) { if (!fromBench) toBench(piece); return; }
        dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 50);
        const r = el.view.getBoundingClientRect();
        const over = ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
        if (!over && app.held && app.held.piece === piece) putBack();
        app.dirty = true;
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
  }
  wireDrag(el.benchBoard, { get len() { return L.bench ? L.bench.len : 0; }, bench: true }, true);

  // lift a piece off the panel into the builder's hands
  function takeUp(piece, fromBench) {
    if (app.held) putBack();
    let p = piece;
    if (fromBench) { p = L.bench; if (!p) return; nextBench(); }
    else L.pieces = L.pieces.filter((q) => q !== p);
    app.held = { piece: p, len: p.len, x: W / 2, y: 0, ang: Math.PI / 2, fresh: true };
    renderPanel(); app.select(null); app.dirty = true;
  }
  // the held board back onto the panel
  function putBack() {
    const h = app.held; if (!h) return;
    if (h.piece.full && h.piece.len === BOARD_FT && !L.bench) L.bench = h.piece;
    else if (h.piece.full && h.piece.len === BOARD_FT) L.stack++;
    else L.pieces.push(h.piece);
    app.held = null; renderPanel(); app.dirty = true;
  }
  // a board taken down goes back: a whole one onto the stack, a cut one among the pieces
  function returnPiece(len) {
    if (len >= BOARD_FT - 1e-6) { if (!L.bench) L.bench = newPiece(BOARD_FT, true); else L.stack++; }
    else { const p = newPiece(len); p.fresh = true; L.pieces.push(p); }
    renderPanel();
  }

  // ── where things are on the wall: the current face's boards, the corner lines, the ground ───────────────────────
  function context() {
    const k = app.face, segs = faceSegments(app.tower, k);
    const lines = [
      { ax: 0, ay: 0, bx: 0, by: 400, corner: true }, { ax: W, ay: 0, bx: W, by: 400, corner: true },
      { ax: -40, ay: 0, bx: 40, by: 0, len: 80, ground: true }];
    lines[0].len = lines[1].len = 400;
    return { k, segs, lines };
  }
  const segOf = (h) => { const bx = h.x + Math.cos(h.ang) * h.len, by = h.y + Math.sin(h.ang) * h.len; return { id: '__held', ax: h.x, ay: h.y, bx, by, len: h.len }; };
  function nearestOn(s, px, py) {
    const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / L2));
    return { x: s.ax + dx * t, y: s.ay + dy * t, t };
  }

  // slide: the board's end a goes to (x, y), then the best snap for either end shifts the whole board
  function snapMove(h, x, y) {
    const { segs, lines } = context();
    const dx = Math.cos(h.ang) * h.len, dy = Math.sin(h.ang) * h.len;
    let best = null;
    const consider = (ox, oy, score, along) => { if (!best || score < best.score) best = { ox, oy, score, along }; };
    for (const [ex, ey] of [[x, y], [x + dx, y + dy]]) {
      // ends of other boards (strongest), then their length, the corner lines and the ground
      for (const s of segs) for (const [px, py] of [[s.ax, s.ay], [s.bx, s.by]]) { const d = Math.hypot(px - ex, py - ey); if (d < 0.55) consider(px - ex, py - ey, d * 0.6); }
      for (const s of [...segs, ...lines]) {
        const c = nearestOn(s, ex, ey), d = Math.hypot(c.x - ex, c.y - ey);
        if (d < 0.45) consider(c.x - ex, c.y - ey, d + 0.08, s);
      }
    }
    let nx = x, ny = y;
    if (best) {
      nx += best.ox; ny += best.oy;
      // slid along a level or upright line: keep to the half foot along it
      const s = best.along;
      if (s && Math.abs(s.ay - s.by) < 1e-6) nx = snapTo(nx);
      else if (s && Math.abs(s.ax - s.bx) < 1e-6) ny = snapTo(ny);
    } else { nx = snapTo(nx); ny = snapTo(ny); }
    // never below the ground
    const low = Math.min(ny, ny + dy); if (low < 0) ny -= low;
    h.x = nx; h.y = ny;
    ghostSnap(h);
  }
  // swing: one end stays put (pivot), the other follows the pointer's direction
  function snapSwing(h, pivotEnd, px, py) {
    const { segs, lines } = context();
    const e = { ax: h.x, ay: h.y, bx: h.x + Math.cos(h.ang) * h.len, by: h.y + Math.sin(h.ang) * h.len };
    const P = pivotEnd === 'a' ? { x: e.ax, y: e.ay } : { x: e.bx, y: e.by };
    const raw = Math.atan2(py - P.y, px - P.x);
    // where a circle of the board's length round the pivot crosses other boards, the corner lines and the ground
    let best = null;
    for (const s of [...segs, ...lines]) {
      for (const q of circleHits(P, h.len, s)) {
        const a = Math.atan2(q.y - P.y, q.x - P.x), diff = Math.abs(angDiff(a, raw));
        if (diff < 9 * DEG && (!best || diff < best.diff)) best = { a, diff };
      }
    }
    let a = best ? best.a : Math.round(raw / (5 * DEG)) * 5 * DEG;
    if (P.y + Math.sin(a) * h.len < -0.01) { const g = circleHits(P, h.len, lines[2]); if (g.length) { g.sort((u, v) => Math.abs(angDiff(Math.atan2(u.y - P.y, u.x - P.x), raw)) - Math.abs(angDiff(Math.atan2(v.y - P.y, v.x - P.x), raw))); a = Math.atan2(g[0].y - P.y, g[0].x - P.x); } else a = P.x < W / 2 ? 0 : Math.PI; }
    if (pivotEnd === 'a') h.ang = a;
    else { h.x = P.x + Math.cos(a) * h.len; h.y = P.y + Math.sin(a) * h.len; h.ang = a + Math.PI; }
    h.ang = Math.atan2(Math.sin(h.ang), Math.cos(h.ang));
  }
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  function circleHits(C, r, s) {
    const dx = s.bx - s.ax, dy = s.by - s.ay, fx = s.ax - C.x, fy = s.ay - C.y;
    const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), Cc = fx * fx + fy * fy - r * r, D = B * B - 4 * A * Cc;
    if (D < 0 || !A) return [];
    const out = [];
    for (const t of [(-B - Math.sqrt(D)) / (2 * A), (-B + Math.sqrt(D)) / (2 * A)]) if (t >= -0.01 && t <= 1.01) out.push({ x: s.ax + dx * t, y: s.ay + dy * t });
    return out;
  }
  // the mirrored ghosts: boards of the same length on the next wall (mirror mode) or the opposite wall, mirrored (four)
  function ghosts(len) {
    const k = app.face, out = [];
    const src = app.tower.mode === 'mirror' ? faceSegments(app.tower, (k + 1) % 4) : faceSegments(app.tower, (k + 2) % 4).map((s) => ({ ...s, ax: W - s.ax, bx: W - s.bx }));
    const here = faceSegments(app.tower, k);
    for (const s of src) {
      if (s.post || Math.abs(s.len - len) > 0.01) continue;
      if (here.some((q) => Math.hypot(q.ax - s.ax, q.ay - s.ay) + Math.hypot(q.bx - s.bx, q.by - s.by) < 0.2 || Math.hypot(q.ax - s.bx, q.ay - s.by) + Math.hypot(q.bx - s.ax, q.by - s.ay) < 0.2)) continue;
      out.push(s);
    }
    return out;
  }
  function ghostSnap(h) {
    const s = segOf(h);
    for (const g of ghosts(h.len)) {
      for (const [a, b, flip] of [[[g.ax, g.ay], [g.bx, g.by], false], [[g.bx, g.by], [g.ax, g.ay], true]]) {
        if (Math.hypot(a[0] - s.ax, a[1] - s.ay) < 0.7 && Math.hypot(b[0] - s.bx, b[1] - s.by) < 0.7) {
          h.x = a[0]; h.y = a[1]; h.ang = Math.atan2(b[1] - a[1], b[0] - a[0]); h.ghost = true; return;
        }
        void flip;
      }
    }
    h.ghost = false;
  }

  // a freshly dragged-in board under the pointer: upright near a corner line, else level, unless already turned
  function placeAtPointer(cx, cy, fresh) {
    const h = app.held; if (!h) return;
    const p = app.toWall(cx, cy); if (!p) return;
    if (fresh && h.fresh) {
      const nearCorner = Math.min(Math.abs(p.x), Math.abs(p.x - W)) < 1.3;
      h.ang = nearCorner ? Math.PI / 2 : 0;
      // the pointer holds the board's middle (an upright one: a bit below its middle, so it can reach the ground)
      let mx = p.x - Math.cos(h.ang) * h.len / 2, my = p.y - Math.sin(h.ang) * h.len * (nearCorner ? 0.35 : 0.5);
      if (nearCorner) {
        // an upright board by a corner settles onto the ground, or onto the top of the post already standing there
        const cx = Math.abs(p.x) < Math.abs(p.x - W) ? 0 : W;
        let base = 0;
        for (const s of context().segs) if (s.post && Math.abs(s.ax - cx) < 0.01) { const top = Math.max(s.ay, s.by); if (top <= p.y + 1.5 && top > base) base = top; }
        mx = cx; my = base;
      }
      snapMove(h, mx, my);
    }
    app.dirty = true;
  }

  // ── at a wall's left or right edge while dragging: wait a moment, then go round the corner to the next wall ─────
  // (only once the pointer has been well inside the view in this drag: every drag from the panel comes in over the
  // left edge, and that must not send the tower round)
  let edgeTimer = null, edgeDir = 0, edgeArmed = false;
  function edgeWatch(cx, cy) {
    const r = el.view.getBoundingClientRect(), fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height;
    app.autoScroll = fy < 0.12 ? 1 : fy > 0.9 ? -1 : 0;
    if (fx > 0.18 && fx < 0.82) edgeArmed = true;
    const dir = !edgeArmed ? 0 : fx < 0.07 ? -1 : fx > 0.93 ? 1 : 0;
    if (dir !== edgeDir) { stopEdge(true); edgeDir = dir; if (dir) edgeTimer = setTimeout(() => { edgeTimer = null; goRound(dir); }, 450); }
  }
  function stopEdge(keepScroll) { if (edgeTimer) clearTimeout(edgeTimer); edgeTimer = null; edgeDir = 0; if (!keepScroll) { app.autoScroll = 0; edgeArmed = false; } }
  function goRound(dir) {
    if (!app.held) return;
    app.turn(dir); edgeArmed = false; edgeDir = 0;
    const h = app.held;
    // the board comes round onto the new wall's near edge
    const mid = dir > 0 ? 1.2 : W - 1.2;
    h.x = mid - Math.cos(h.ang) * h.len / 2; snapMove(h, h.x, h.y);
    el.view.classList.add('is-rounding'); setTimeout(() => el.view.classList.remove('is-rounding'), 600);
  }

  // ── handles on the held board, and dragging on the view ─────────────────────────────────────────────────────────
  let grab = null;       // { mode: 'move' | 'a' | 'b', ox, oy (move: pointer to end a, in feet) }
  function startGrab(mode, e) {
    const h = app.held; if (!h) return;
    e.preventDefault(); e.stopPropagation(); sound.audioOn();
    const p = app.toWall(e.clientX, e.clientY); if (!p) return;
    grab = { mode, ox: h.x - p.x, oy: h.y - p.y, id: e.pointerId };
    h.fresh = false;
    el.view.setPointerCapture(e.pointerId);
  }
  for (const [node, mode] of [[el.gMove, 'move'], [el.gA, 'a'], [el.gB, 'b']]) node.addEventListener('pointerdown', (e) => startGrab(mode, e));
  el.view.addEventListener('pointerdown', (e) => {
    if (app.phase !== 'build' || e.target.closest('button, .gz, .card, .bar')) return;
    sound.audioOn();
    const h = app.held;
    if (h) {
      // on (or near) the held board: slide it. Elsewhere: nothing (so a stray tap doesn't throw it away)
      const p = app.toWall(e.clientX, e.clientY), s = segOf(h);
      if (p) { const c = nearestOn(s, p.x, p.y); if (Math.hypot(c.x - p.x, c.y - p.y) < Math.max(0.7, app.pxToFt(26))) { startGrab('move', e); return; } }
      return;
    }
    // no board in hand: a tap on a nailed board picks it out
    tapStart = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  let tapStart = null;
  el.view.addEventListener('pointermove', (e) => {
    if (!grab || e.pointerId !== grab.id) return;
    const h = app.held, p = app.toWall(e.clientX, e.clientY); if (!h || !p) return;
    if (grab.mode === 'move') { snapMove(h, p.x + grab.ox, p.y + grab.oy); edgeWatch(e.clientX, e.clientY); }
    else { snapSwing(h, grab.mode === 'a' ? 'b' : 'a', p.x, p.y); h.ghost = false; const r = el.view.getBoundingClientRect(), fy = (e.clientY - r.top) / r.height; app.autoScroll = fy < 0.1 ? 1 : fy > 0.92 ? -1 : 0; }
    app.dirty = true;
  });
  const endGrab = (e) => {
    if (grab && e.pointerId === grab.id) { grab = null; stopEdge(); app.dirty = true; return; }
    if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) < 8 && performance.now() - tapStart.t < 600) app.pickAt(e.clientX, e.clientY);
    tapStart = null;
  };
  el.view.addEventListener('pointerup', endGrab); el.view.addEventListener('pointercancel', endGrab);

  // turn the held board a step round its middle: upright, 45, level, 135
  function turnHeld() {
    const h = app.held; if (!h) return;
    const steps = [90, 45, 0, 135], now = ((Math.round(h.ang / DEG) % 180) + 180) % 180;
    let i = steps.findIndex((s) => Math.abs(s - now) < 3); i = (i + 1) % steps.length;
    const mx = h.x + Math.cos(h.ang) * h.len / 2, my = h.y + Math.sin(h.ang) * h.len / 2;
    h.ang = steps[i] * DEG; snapMove(h, mx - Math.cos(h.ang) * h.len / 2, my - Math.sin(h.ang) * h.len / 2); h.fresh = false; app.dirty = true;
  }

  // what the held board will be nailed to: [{ x, y, other (seg or line), angle (degrees, 0..90) }]
  function contactsOf(h) {
    const { segs, lines } = context(), s = segOf(h), out = [];
    for (const o of [...segs, lines[2]]) for (const c of touch(s, o)) {
      const a1 = Math.atan2(s.by - s.ay, s.bx - s.ax), a2 = Math.atan2(o.by - o.ay, o.bx - o.ax);
      let d = Math.abs(angDiff(a1, a2)) / DEG; if (d > 90) d = 180 - d;
      out.push({ x: c.x, y: c.y, other: o, angle: d });
    }
    // an upright board on a corner line is a post: it stands on the ground or on the post below
    return out;
  }

  // ── drawing over the view: gizmo handles, the length, the angles, the nails, the ghosts ─────────────────────────
  function frame() {
    const h = app.held, svg = el.overlay;
    const show = !!h && app.phase === 'build';
    for (const g of [el.gMove, el.gA, el.gB]) g.hidden = !show;
    el.heldBar.hidden = !show; el.view.classList.toggle('is-holding', show);
    if (!show) { svg.innerHTML = ''; return; }
    const k = app.face, s = segOf(h);
    const A = app.toScreen(k, s.ax, s.ay), B = app.toScreen(k, s.bx, s.by), M = app.toScreen(k, (s.ax + s.bx) / 2, (s.ay + s.by) / 2);
    const place = (n, p) => { n.style.transform = `translate(${p.x}px, ${p.y}px)`; };
    place(el.gMove, M); place(el.gA, A); place(el.gB, B);
    let out = '';
    // the ghosts
    for (const g of ghosts(h.len)) {
      const a = app.toScreen(k, g.ax, g.ay), b = app.toScreen(k, g.bx, g.by);
      out += `<line class="ghost" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    }
    // the length, beside the board
    const nx = -(B.y - A.y), ny = B.x - A.x, nl = Math.hypot(nx, ny) || 1, off = 30;
    const lx = M.x + nx / nl * off, ly = M.y + ny / nl * off;
    out += `<g class="len"><rect x="${lx - 30}" y="${ly - 13}" width="60" height="24" rx="6"/><text x="${lx}" y="${ly + 4}">${fmt(h.len)}</text></g>`;
    // the joints it will make, with the angle at each
    const cs = contactsOf(h);
    for (const c of cs) {
      const P = app.toScreen(k, c.x, c.y);
      // the arc between the held board and the other one, on the side the held board actually runs
      const far = Math.hypot(s.ax - c.x, s.ay - c.y) > Math.hypot(s.bx - c.x, s.by - c.y) ? A : B;
      let u1 = Math.atan2(far.y - P.y, far.x - P.x);
      const O1 = app.toScreen(k, c.other.ax, c.other.ay), O2 = app.toScreen(k, c.other.bx, c.other.by);
      let u2 = Math.atan2(O2.y - O1.y, O2.x - O1.x);
      if (Math.abs(angDiff(u2, u1)) > Math.PI / 2) u2 += Math.PI;
      const r = 24, sweep = angDiff(u2, u1) > 0 ? 1 : 0;
      const x1 = P.x + Math.cos(u1) * r, y1 = P.y + Math.sin(u1) * r, x2 = P.x + Math.cos(u2) * r, y2 = P.y + Math.sin(u2) * r;
      const mid = u1 + angDiff(u2, u1) / 2, tx = P.x + Math.cos(mid) * (r + 17), ty = P.y + Math.sin(mid) * (r + 17);
      const square = Math.abs(c.angle - 90) < 0.5;
      if (square) {
        const q = 12, ax = Math.cos(u1) * q, ay = Math.sin(u1) * q, bx = Math.cos(u2) * q, by = Math.sin(u2) * q;
        out += `<path class="arc sq" d="M${P.x + ax} ${P.y + ay} L${P.x + ax + bx} ${P.y + ay + by} L${P.x + bx} ${P.y + by}"/>`;
      } else if (c.angle > 0.5) out += `<path class="arc" d="M${x1} ${y1} A${r} ${r} 0 0 ${sweep} ${x2} ${y2}"/>`;
      if (c.angle > 0.5) out += `<g class="ang${square ? ' is-square' : ''}"><rect x="${tx - 21}" y="${ty - 11}" width="42" height="21" rx="5"/><text x="${tx}" y="${ty + 4}">${Math.round(c.angle)}°</text></g>`;
      out += `<circle class="nail" cx="${P.x}" cy="${P.y}" r="6"/>`;
    }
    svg.innerHTML = out;
    const ok = cs.length > 0;
    el.nailBtn.disabled = !ok;
    el.heldHint.textContent = ok ? (h.ghost ? 'Lined up with the board on the next wall' : postSide(h) !== null ? 'Corner post: straight up, 90°' : '') : 'Touch it to a board or the ground to nail it';
  }

  el.nailBtn.addEventListener('click', () => { if (app.held && contactsOf(app.held).length) app.nail(); });
  el.turnBtn.addEventListener('click', turnHeld);
  el.backBtn.addEventListener('click', () => { putBack(); sound.clunk(); });

  return { freshStack, renderPanel, frame, putBack, returnPiece, contactsOf, cut, takeUp, snapMove, snapSwing, toBench, get cutAt() { return cutAt; }, set cutAt(v) { cutAt = v; renderPanel(); } };
}
