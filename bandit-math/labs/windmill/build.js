// BUILDING: the lumber panel on the left (the board on the bench with its tape measure and saw, the cut pieces waiting)
// and everything a finger or the mouse does on the view:
//   * the footing stones (the first step, before any board is nailed): drag one in or out to set how far apart they
//     stand, half a foot to 8 feet, by the half foot; the square stays square
//   * a piece dragged from the panel onto the tower: slide it (the round handle in its middle), swing it about either
//     end (the handles at its ends), tap its middle to turn it a step, tap the gold check to nail it, carry it back
//     onto the panel (or Undo) to put it back on the pile. While a board is
//     held, its length and the angles where it meets other boards are drawn over the view, and the spots where it will
//     be nailed glow. A part sticking out past the last board it meets (an overhang) is drawn pale with a saw line at
//     the joint: tap it (or its "saw off" label) to saw it off right there. (A post's top above its last crosspiece is
//     not an overhang: the next crosspiece or post goes there.)
//   * anywhere else: drag to walk round the tower (sideways) and climb it (up and down); two fingers or the wheel zoom.
//     A tap picks a glowing twin (builds it: main.js takes any twin within a fingertip of the tap) or a nailed board (to
//     take it down, or saw its overhang off).
//
// Snapping, so a shaky finger still builds square: positions go to the half foot; an end that comes near a joint (a
// corner's foot, where a post meets a crosspiece) lands right on it from furthest off, then one near another board's
// end, a corner line, the ground or a board's edge; an angle goes to every 5 degrees, or to exactly where the free end
// lands on a board. Before a swing, the end it swings about settles onto a joint if it is near one (from up to 2 feet
// off when the board is just the length of the slant between two joints), so a brace dropped a little off the corner
// still braces corner to corner (a brace whose end stops near a corner without sitting on it gets a red ring: it makes
// no triangle there). A board standing straight up on a wall's left or right edge becomes a corner post. A held board
// the same length as a glowing twin on this wall snaps onto it.
//
// On a narrow screen a long held board can run off the view: once nothing is dragging it, the view backs off until both
// its ends are in reach. Labels over the view (lengths, angles, saw-offs, why a twin is grey) keep clear of each other
// and of the handles; a "saw off" label can be tapped as well as the pale end it names.
// A finger on the cut pieces: straight up and down scrolls the panel; any other way, or onto the view, lifts the piece.
import { SNAP, BOARD_FT, MIN_W, MAX_W, faceSegments, postSide, ends, cornerXZ, faceToWorld } from './tower.js';
import { trianglesOf } from './questions.js';
import { touch, findJoints, isKnee } from './frame.js';
import * as sound from './sound.js';

const DEG = Math.PI / 180;
const snapTo = (v, s = SNAP) => Math.round(v / s) * s;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// lengths the way a carpenter says them: whole feet "4 ft", halves "4½ ft", anything else (a board sawn off at a joint)
// to the nearest inch, "4 ft 3 in"
export function fmt(ft) {
  const inches = Math.round(ft * 12), f = Math.floor(inches / 12), i = inches % 12;
  if (i === 0) return f + ' ft';
  if (i === 6) return (f || '') + '½ ft';
  return (f ? f + ' ft ' : '') + i + ' in';
}
const SCRAP = 0.5;      // an offcut shorter than this is kindling, not lumber

export function makeBuild(app) {
  const el = app.el;
  let nextId = 1;
  const newPiece = (len, full = false) => ({ id: 'w' + nextId++, len, full });
  const L = app.lumber;
  const W = () => app.tower.W;

  // ── the panel ────────────────────────────────────────────────────────────────────────────────────────────────────
  let cutAt = 4;
  function freshStack(n) {
    L.stack = n; L.pieces = []; L.bench = null; nextBench(); cutAt = 4; renderPanel();
  }
  function nextBench() { if (L.stack > 0) { L.stack--; L.bench = newPiece(BOARD_FT, true); } else L.bench = null; }
  // one more fresh board (a right answer's reward): onto the stack, and up onto the bench if the bench is empty
  function giveBoard() { L.stack++; if (!L.bench) nextBench(); renderPanel(); }
  function fullCount() { return L.stack + (L.bench && L.bench.full ? 1 : 0); }

  function renderPanel() {
    el.count.textContent = fullCount();
    el.countWord.textContent = fullCount() === 1 ? 'full board left' : 'full boards left';
    const b = L.bench;
    el.bench.hidden = !b; el.benchEmpty.hidden = !!b; el.benchLabel.hidden = !b;
    if (!b) el.cutBtn.disabled = true;
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
    // (the panel keeps its place when the pieces are redrawn: lifting one off a scrolled panel doesn't jump it back up)
    const pxFt = Math.min(15, (el.pieces.clientWidth || 120) > 160 ? 15 : 11), keep = el.panel ? el.panel.scrollTop : 0;
    el.pieces.innerHTML = '';
    L.pieces.sort((a, b) => b.len - a.len);
    for (const p of L.pieces) {
      const d = document.createElement('div'); d.className = 'piece' + (p.fresh ? ' is-new' : ''); p.fresh = false;
      d.innerHTML = `<div class="stick" style="height:${p.len * pxFt}px"></div><span>${fmt(p.len)}</span>`;
      d.title = 'Drag onto the tower. Tap to put it on the bench and cut it.';
      wireDrag(d, p); el.pieces.appendChild(d);
    }
    el.piecesEmpty.hidden = L.pieces.length > 0;
    if (el.panel) el.panel.scrollTop = keep;
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
    sound.audioOn(); sound.saw(b.len, cutAt);
    const lo = newPiece(cutAt), hi = newPiece(b.len - cutAt); lo.fresh = hi.fresh = true;
    L.pieces.push(lo, hi);
    nextBench(); cutAt = Math.min(4, (L.bench ? L.bench.len : 8) - SNAP);
    el.benchBoard.classList.remove('is-cut'); void el.benchBoard.offsetWidth; el.benchBoard.classList.add('is-cut');
    renderPanel(); app.onCut && app.onCut(lo, hi);
  }
  el.cutBtn.addEventListener('click', cut);
  // put a waiting piece on the bench to cut it smaller (a fresh board there goes back on the stack). (A piece already
  // gone, built into a twin by another finger a moment ago, stays gone.)
  function toBench(p) {
    if (!L.pieces.includes(p)) { renderPanel(); return; }
    if (L.bench) { if (L.bench.full) L.stack++; else L.pieces.push(L.bench); }
    L.pieces = L.pieces.filter((q) => q !== p); L.bench = p; cutAt = snapTo(p.len / 2); sound.clatter(p.len, 'set'); renderPanel();
  }

  // ── wood for the twins, and offcuts ──────────────────────────────────────────────────────────────────────────────
  // an offcut goes among the cut pieces; a scrap shorter than half a foot is kindling (gone)
  function addOffcut(len) {
    if (len < SCRAP - 1e-6) return false;
    const p = newPiece(len); p.fresh = true; L.pieces.push(p); return true;
  }
  // where the wood for a board `len` feet long would come from, without taking it, the way a builder saves lumber: a
  // cut piece just that long, else the shortest cut piece long enough (sawn down; one waiting on the bench counts),
  // else a fresh board sawn to length (from the stack, or the one on the bench)
  function woodFor(len) {
    const exact = L.pieces.find((p) => Math.abs(p.len - len) < 0.01);
    if (exact) return { piece: exact };
    const longer = L.pieces.filter((p) => p.len > len + 0.01).sort((a, b) => a.len - b.len)[0];
    const onBench = L.bench && !L.bench.full && L.bench.len > len - 0.01 ? L.bench : null;
    if (onBench && (!longer || onBench.len <= longer.len)) return { bench: true, cut: onBench.len > len + 0.01 };
    if (longer) return { piece: longer, cut: true };
    if (len <= BOARD_FT + 1e-6) {
      if (L.stack > 0) return { fresh: 'stack' };
      if (L.bench && L.bench.full) return { fresh: 'bench' };
    }
    return null;
  }
  // take it, sawing what has to be sawn: { cut (it was sawn), from (what it was cut from) }, or null with no wood
  function payFor(len) {
    const w = woodFor(len); if (!w) return null;
    let from = BOARD_FT;
    if (w.piece) { L.pieces = L.pieces.filter((q) => q !== w.piece); from = w.piece.len; }
    else if (w.fresh === 'stack') L.stack--;
    else if (w.fresh === 'bench') nextBench();
    else if (w.bench) { from = L.bench.len; L.bench = null; nextBench(); }
    const cut = from - len > 0.01;
    if (cut) { sound.saw(from, len); addOffcut(from - len); }
    renderPanel();
    return { cut, from };
  }

  // ── dragging a piece (or the whole board on the bench) from the panel onto the tower ─────────────────────────────
  let dragJustEnded = false, carrying = false;     // (carrying: a piece is being dragged in from the panel)
  function wireDrag(node, piece, fromBench = false) {
    node.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || app.phase !== 'build') return;
      // (a finger on a cut piece: a swipe straight up or down that stays on the panel scrolls it, by hand, since the
      // pieces don't let the browser scroll; any other way, or as soon as the finger crosses onto the view whatever
      // way it went, the piece is lifted. A panel with nothing to scroll lifts the piece whichever way it goes.)
      const finger = e.pointerType === 'touch' && !fromBench, panel = el.panel;
      const canScroll = finger && panel && panel.scrollHeight > panel.clientHeight + 2, top0 = panel ? panel.scrollTop : 0;
      e.preventDefault();
      sound.audioOn();
      const sx = e.clientX, sy = e.clientY; let dragging = false, scrolling = false, ghost = null, onView = false, lifted = null, dropped = false;
      // (listening on the window: the panel redraws its pieces while one is being dragged)
      const move = (ev) => {
        if (ev.pointerId !== e.pointerId || dropped) return;
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!dragging && !scrolling && Math.hypot(dx, dy) < 7) return;
        if (!dragging && canScroll && ev.clientX < panel.getBoundingClientRect().right - 2 && (scrolling || Math.abs(dx) < Math.abs(dy) * 0.45)) {
          scrolling = true; panel.scrollTop = top0 - dy; return;
        }
        if (!dragging) {
          dragging = true; ghost = document.createElement('div'); ghost.className = 'ghost-piece';
          ghost.innerHTML = `<div class="stick"></div><span>${fmt(piece.len)}</span>`; document.body.appendChild(ghost); node.classList.add('is-lifted');
          app.onDragStart && app.onDragStart(); carrying = true;
        }
        ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
        const r = el.view.getBoundingClientRect();
        const over = ev.clientX > r.left + 4 && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
        if (over && !onView) {
          onView = true; lifted = takeUp(piece, fromBench);
          if (!lifted) { dropped = true; ghost.remove(); ghost = null; node.classList.remove('is-lifted'); carrying = false; return; }
        }
        if (onView && app.held) { ghost.style.opacity = over ? 0 : 1; if (over) { placeAtPointer(ev.clientX, ev.clientY, true); edgeWatch(ev.clientY); } }
      };
      const up = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        node.classList.remove('is-lifted'); if (ghost) ghost.remove(); stopEdge(); carrying = false;
        if (dropped || scrolling) return;
        if (!dragging) { if (!fromBench && ev.type === 'pointerup') toBench(piece); return; }
        dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 50);
        const r = el.view.getBoundingClientRect();
        const over = ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
        // (carried back onto the panel: the piece that was lifted goes back on the pile)
        if (!over && app.held && lifted && app.held.piece === lifted) putBack();
        app.dirty = true;
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
  }
  wireDrag(el.benchBoard, { get len() { return L.bench ? L.bench.len : 0; }, bench: true }, true);

  // lift a piece off the panel into the builder's hands
  function takeUp(piece, fromBench) {
    if (!fromBench && !L.pieces.includes(piece)) return null;     // (spent on a twin meanwhile)
    if (app.held) putBack();
    let p = piece;
    if (fromBench) { p = L.bench; if (!p) return null; nextBench(); }
    else L.pieces = L.pieces.filter((q) => q !== p);
    sound.clatter(p.len, 'pick');
    app.held = { piece: p, len: p.len, x: W() / 2, y: 0, ang: Math.PI / 2, fresh: true };
    renderPanel(); app.select(null); app.dirty = true;
    app.onTakeUp && app.onTakeUp();
    return p;
  }
  // the held board back onto the panel
  function putBack() {
    const h = app.held; if (!h) return;
    if (h.piece.full && h.len >= BOARD_FT - 1e-6 && !L.bench) L.bench = h.piece;
    else if (h.piece.full && h.len >= BOARD_FT - 1e-6) L.stack++;
    else { h.piece.full = false; h.piece.len = h.len; L.pieces.push(h.piece); }
    sound.clatter(h.len, 'set');
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
      { ax: 0, ay: 0, bx: 0, by: 400, corner: true }, { ax: W(), ay: 0, bx: W(), by: 400, corner: true },
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

  // the joints on this wall where a brace's end wants to sit: the foot of each corner, and every spot where boards
  // already meet (a post and a crosspiece, two boards' ends)
  function jointsHere() {
    const { segs } = context(), out = [{ x: 0, y: 0 }, { x: W(), y: 0 }];
    for (const j of findJoints(segs)) if (!out.some((q) => Math.hypot(q.x - j.x, q.y - j.y) < 0.05)) out.push({ x: j.x, y: j.y });
    return out;
  }
  const JOINT_SNAP = 0.8;     // feet: an end this close to a joint lands right on it
  function nearestJoint(x, y, within = JOINT_SNAP) {
    let best = null, bd = within;
    for (const j of jointsHere()) { const d = Math.hypot(j.x - x, j.y - y); if (d < bd) { bd = d; best = j; } }
    return best;
  }

  // slide: the board's end a goes to (x, y), then the best snap for either end shifts the whole board
  function snapMove(h, x, y) {
    const { segs, lines } = context();
    const dx = Math.cos(h.ang) * h.len, dy = Math.sin(h.ang) * h.len;
    let best = null;
    const consider = (ox, oy, score, along, e) => { if (!best || score < best.score) best = { ox, oy, score, along, e }; };
    const tips = segs.flatMap((s) => [[s.ax, s.ay], [s.bx, s.by]]);
    const joints = jointsHere();
    [[x, y], [x + dx, y + dy]].forEach(([ex, ey], e) => {
      // joints (a corner's foot, a post meeting a crosspiece: strongest, from furthest), the ends of other boards, then
      // their length, the corner lines and the ground
      for (const j of joints) { const d = Math.hypot(j.x - ex, j.y - ey); if (d < JOINT_SNAP) consider(j.x - ex, j.y - ey, d * 0.45, null, e); }
      for (const [px, py] of tips) { const d = Math.hypot(px - ex, py - ey); if (d < 0.55) consider(px - ex, py - ey, d * 0.6, null, e); }
      for (const s of [...segs, ...lines]) {
        const c = nearestOn(s, ex, ey), d = Math.hypot(c.x - ex, c.y - ey);
        if (d < 0.45) consider(c.x - ex, c.y - ey, d + 0.08, s, e);
      }
    });
    let nx = x, ny = y;
    if (best) {
      nx += best.ox; ny += best.oy;
      // slid along a level or upright line: the end on it goes to another board's end on that line if one is close (a
      // joint), else to the half foot along it
      const s = best.along, ox = best.e ? dx : 0, oy = best.e ? dy : 0;
      const along = (v, fixed, horiz) => {
        let to = snapTo(v), near = 0.55;
        for (const [px, py] of tips) { const on = horiz ? Math.abs(py - fixed) < 0.05 : Math.abs(px - fixed) < 0.05, q = horiz ? px : py; if (on && Math.abs(q - v) < near) { near = Math.abs(q - v); to = q; } }
        return to;
      };
      if (s && Math.abs(s.ay - s.by) < 1e-6) nx = along(nx + ox, s.ay, true) - ox;
      else if (s && Math.abs(s.ax - s.bx) < 1e-6) ny = along(ny + oy, s.ax, false) - oy;
    } else { nx = snapTo(nx); ny = snapTo(ny); }
    // never below the ground
    const low = Math.min(ny, ny + dy); if (low < 0) ny -= low;
    h.x = nx; h.y = ny;
    ghostSnap(h);
  }
  // before a swing: the end it swings about, if it is near a joint, settles right onto it (so a board dropped a little
  // off the corner still braces corner to corner)
  // A board just as long as the slant between two joints (a brace cut to reach a bay corner to corner, like the 5 ft
  // brace in a bay 3 ft wide and 4 ft tall) settles its pivot onto the nearer joint of that pair from further off (2
  // feet), so dropping it level in the bay and swinging one end up still lands it corner to corner.
  function snapPivot(h, pivotEnd) {
    const e = ends(h), P = pivotEnd === 'a' ? { x: e.ax, y: e.ay } : { x: e.bx, y: e.by };
    const js = jointsHere();
    let j = null, bd = 2.05;
    for (const q of js) {
      const d = Math.hypot(q.x - P.x, q.y - P.y); if (d >= bd) continue;
      if (js.some((o) => Math.abs(o.x - q.x) > 0.3 && Math.abs(o.y - q.y) > 0.3 && Math.abs(Math.hypot(o.x - q.x, o.y - q.y) - h.len) < 0.12)) { j = q; bd = d; }
    }
    j = j || nearestJoint(P.x, P.y); if (!j || Math.hypot(j.x - P.x, j.y - P.y) < 0.01) return;
    h.x += j.x - P.x; h.y += j.y - P.y;
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
    if (P.y + Math.sin(a) * h.len < -0.01) { const g = circleHits(P, h.len, lines[2]); if (g.length) { g.sort((u, v) => Math.abs(angDiff(Math.atan2(u.y - P.y, u.x - P.x), raw)) - Math.abs(angDiff(Math.atan2(v.y - P.y, v.x - P.x), raw))); a = Math.atan2(g[0].y - P.y, g[0].x - P.x); } else a = P.x < W() / 2 ? 0 : Math.PI; }
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
  // a held board the same length as a glowing twin on this wall, brought near it, settles right onto it
  function twinSpots(len) {
    const k = app.face, out = [];
    for (const g of app.ghostList()) {
      if (!g.ok || Math.abs(g.len - len) > 0.01) continue;
      if (g.kind === 'wall' && g.face === k) { const e = ends(g); out.push(e); }
      else if (g.kind === 'post' && (g.corner === k || g.corner === (k + 1) % 4)) { const x = g.corner === k ? 0 : W(); out.push({ ax: x, ay: g.y, bx: x, by: g.y + g.len }); }
    }
    return out;
  }
  function ghostSnap(h) {
    const s = segOf(h);
    for (const g of twinSpots(h.len)) {
      for (const [a, b] of [[[g.ax, g.ay], [g.bx, g.by]], [[g.bx, g.by], [g.ax, g.ay]]]) {
        if (Math.hypot(a[0] - s.ax, a[1] - s.ay) < 0.7 && Math.hypot(b[0] - s.bx, b[1] - s.by) < 0.7) {
          h.x = a[0]; h.y = a[1]; h.ang = Math.atan2(b[1] - a[1], b[0] - a[0]); h.ghost = true; return;
        }
      }
    }
    h.ghost = false;
  }

  // a freshly dragged-in board under the pointer: upright near a corner line, else level, unless already turned
  function placeAtPointer(cx, cy, fresh) {
    const h = app.held; if (!h) return;
    const p = app.toWall(cx, cy); if (!p) return;
    if (fresh && h.fresh) {
      const w = W(), nearCorner = Math.min(Math.abs(p.x), Math.abs(p.x - w)) < Math.min(1.3, w * 0.34);
      h.ang = nearCorner ? Math.PI / 2 : 0;
      // the pointer holds the board's middle (an upright one: a bit below its middle, so it can reach the ground)
      let mx = p.x - Math.cos(h.ang) * h.len / 2, my = p.y - Math.sin(h.ang) * h.len * (nearCorner ? 0.35 : 0.5);
      if (nearCorner) {
        // an upright board by a corner settles onto the ground, or onto the top of the post already standing there
        const cx = Math.abs(p.x) < Math.abs(p.x - w) ? 0 : w;
        let base = 0;
        for (const s of context().segs) if (s.post && Math.abs(s.ax - cx) < 0.01) { const top = Math.max(s.ay, s.by); if (top <= p.y + 1.5 && top > base) base = top; }
        mx = cx; my = base;
      }
      snapMove(h, mx, my);
    }
    app.dirty = true;
  }

  // ── near the top or bottom of the view while dragging a board: climb the tower ────────────────────────────────────
  function edgeWatch(cy) {
    const r = el.view.getBoundingClientRect(), fy = (cy - r.top) / r.height;
    app.autoScroll = fy < 0.12 ? 1 : fy > 0.9 ? -1 : 0;
  }
  function stopEdge() { app.autoScroll = 0; }

  // ── overhang: the part of a board past the last board (or the ground) it is nailed to ────────────────────────────
  // seg: the board as a segment; hits: where it touches others [{ x, y }]. Returns [{ end: 'a' | 'b', t0, t1 }] in feet
  // along the board from its a end (the stretch that sticks out), only when it is nailed at two places or more. The
  // top of a post standing up past its last crosspiece is no overhang: that is where the next crosspiece (or the next
  // post) goes.
  function overhangOf(seg, hits) {
    if (hits.length < 2) return [];
    const dx = (seg.bx - seg.ax) / seg.len, dy = (seg.by - seg.ay) / seg.len;
    const ts = hits.map((c) => clamp((c.x - seg.ax) * dx + (c.y - seg.ay) * dy, 0, seg.len));
    const lo = Math.min(...ts), hi = Math.max(...ts), out = [];
    if (hi - lo < 0.3) return out;
    const upright = Math.abs(dx) < 0.1, top = dy > 0 ? 'b' : 'a';
    if (lo > 0.12 && !(upright && top === 'a')) out.push({ end: 'a', t0: 0, t1: lo });
    if (seg.len - hi > 0.12 && !(upright && top === 'b')) out.push({ end: 'b', t0: hi, t1: seg.len });
    return out;
  }
  // the held board's overhangs
  function heldOverhang() { const h = app.held; return h ? overhangOf(segOf(h), contactsOf(h)) : []; }
  // a nailed board's overhangs: { face (where to draw it), seg, list }. A corner post counts the boards on both walls
  // that meet at its corner.
  function nailedOverhang(src) {
    const t = app.tower; if (!src) return null;
    let faces, seg;
    const k = t.walls.findIndex((w) => w.includes(src));
    if (k >= 0) faces = [k];
    else { const c = t.corners.findIndex((cl) => cl.includes(src)); if (c < 0) return null; faces = [c, (c + 3) % 4]; }
    const hits = [];
    for (const f of faces) {
      const segs = faceSegments(t, f), me = segs.find((s) => s.src === src);
      if (!seg || f === app.face) seg = me;
      for (const o of [...segs.filter((s) => s.src !== src), { ax: -100, ay: 0, bx: 100, by: 0, len: 200 }]) for (const c of touch(me, o)) hits.push({ x: 0, y: 0, t: c.ti });
    }
    // (along the board: the hits' t are already feet from its a end, the same on both walls for a post)
    const pts = hits.map((h) => ({ x: seg.ax + (seg.bx - seg.ax) * h.t / seg.len, y: seg.ay + (seg.by - seg.ay) * h.t / seg.len }));
    const face = faces.includes(app.face) ? app.face : faces[0];
    return { face, seg, list: overhangOf(seg, pts) };
  }
  // saw a board off at t (feet from its a end), keeping the part on the far side of `end`
  function sawOff(len, o, nailed = false) { sound.saw(len, o.t1 - o.t0); const off = o.t1 - o.t0; const kept = addOffcut(off); renderPanel(); app.onSawOff && app.onSawOff(off, kept, nailed); }
  function cutHeld(o) {
    const h = app.held; if (!h) return;
    const s = segOf(h), dx = (s.bx - s.ax) / s.len, dy = (s.by - s.ay) / s.len, before = h.len;
    if (o.end === 'a') { h.x = s.ax + dx * o.t1; h.y = s.ay + dy * o.t1; h.len -= o.t1; }
    else h.len = o.t0;
    h.piece.len = h.len; h.piece.full = false; h.fresh = false;
    sawOff(before, o); app.dirty = true;
  }
  function cutNailed(src, o) {
    const before = src.len;
    if (src.ang === undefined) { if (o.end === 'a') src.y += o.t1; src.len = o.end === 'a' ? src.len - o.t1 : o.t0; }
    else {
      const e = ends(src), dx = (e.bx - e.ax) / src.len, dy = (e.by - e.ay) / src.len;
      if (o.end === 'a') { src.x = e.ax + dx * o.t1; src.y = e.ay + dy * o.t1; src.len -= o.t1; } else src.len = o.t0;
    }
    sawOff(before, o, true); app.onTowerChanged && app.onTowerChanged(src, `Sawed ${fmt(o.t1 - o.t0)} off`);
  }
  // which overhang (if any) the screen point is on: the pale part itself, or its "saw off" tag
  function overhangAt(cx, cy, face, seg, list) {
    const r = el.view.getBoundingClientRect(), px = cx - r.left, py = cy - r.top;
    for (const o of list) {
      const u0 = o.t0 / seg.len, u1 = o.t1 / seg.len;
      const A = app.toScreen(face, seg.ax + (seg.bx - seg.ax) * u0, seg.ay + (seg.by - seg.ay) * u0), B = app.toScreen(face, seg.ax + (seg.bx - seg.ax) * u1, seg.ay + (seg.by - seg.ay) * u1);
      const vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy || 1, t = clamp(((px - A.x) * vx + (py - A.y) * vy) / L2, 0, 1);
      if (Math.hypot(A.x + vx * t - px, A.y + vy * t - py) < 16) return o;
    }
    const tag = overTags.find((q) => px > q.x - 6 && px < q.x + q.w + 6 && py > q.y - 6 && py < q.y + q.h + 6);
    return (tag && list.find((o) => o.end === tag.end)) || null;
  }
  let overTags = [];     // the "saw off" tags drawn last frame (view pixels), so a tap on one saws
  let selectTapAt = 0;   // when a tap last picked out a nailed board

  // ── the view's pointers: handles, stones, overhangs, walking round, zooming, taps ───────────────────────────────
  const pointers = new Map();          // every finger or mouse button down on the view: id -> { x, y }
  let gesture = null;                  // what the one pointer that started it is doing
  const now = () => performance.now();
  function startGrab(mode, e, extra = {}) {
    const h = app.held; if (!h) return;
    e.preventDefault(); e.stopPropagation(); sound.audioOn();
    const p = app.toWall(e.clientX, e.clientY); if (!p) return;
    gesture = { kind: 'grab', mode, ox: h.x - p.x, oy: h.y - p.y, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, ...extra };
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.view.setPointerCapture(e.pointerId); } catch (err) { /* (a synthetic event has nothing to capture) */ }
  }
  for (const [node, mode] of [[el.gMove, 'move'], [el.gA, 'a'], [el.gB, 'b']]) node.addEventListener('pointerdown', (e) => startGrab(mode, e));
  // the footing stones' handles: drag one in or out
  el.stoneHandles.forEach((node, c) => node.addEventListener('pointerdown', (e) => {
    if (app.phase !== 'build' || !app.stonesOpen()) return;
    e.preventDefault(); e.stopPropagation(); sound.audioOn();
    // (the width follows the square through the pointer, kept the same distance from it as when grabbed)
    const g = app.toGround(e.clientX, e.clientY);
    gesture = { kind: 'stone', corner: c, id: e.pointerId, off: g ? W() / 2 - Math.max(Math.abs(g.X), Math.abs(g.Z)) : 0 };
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.view.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    node.classList.add('is-active');
  }));
  el.nailBtn.addEventListener('click', () => { if (app.held && contactsOf(app.held).length) app.nail(); });

  el.view.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, .gz, .card, .bar, input')) return;
    if (!['build', 'test', 'result'].includes(app.phase)) return;
    sound.audioOn();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.view.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    if (pointers.size === 2) {
      // a second finger: pinch to zoom (unless the first one is moving a board or a stone)
      if (gesture && (gesture.kind === 'grab' || gesture.kind === 'stone')) return;
      if (gesture && gesture.kind === 'orbit') app.orbitRelease(0);
      const [p, q] = [...pointers.values()];
      gesture = { kind: 'pinch', d0: Math.max(20, Math.hypot(p.x - q.x, p.y - q.y)), z0: app.zoom };
      return;
    }
    if (pointers.size > 2) return;
    const h = app.held;
    if (h && app.phase === 'build') {
      // on (or near) the held board: slide it (a tap on its overhang, or on the overhang's tag, saws that off instead)
      const cut = overhangAt(e.clientX, e.clientY, app.face, segOf(h), heldOverhang());
      const p = app.toWall(e.clientX, e.clientY), s = segOf(h);
      if (cut || (p && (() => { const c = nearestOn(s, p.x, p.y); return Math.hypot(c.x - p.x, c.y - p.y) < Math.max(0.7, app.pxToFt(26)); })())) { startGrab('move', e, { cut, body: true }); return; }
    }
    gesture = { kind: 'pending', id: e.pointerId, x: e.clientX, y: e.clientY, t: now(), lx: e.clientX, ly: e.clientY, lt: now(), vx: 0 };
  });
  el.view.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture && gesture.kind === 'pinch') {
      if (pointers.size >= 2) { const [p, q] = [...pointers.values()]; app.setZoom(gesture.z0 * gesture.d0 / Math.max(20, Math.hypot(p.x - q.x, p.y - q.y))); }
      return;
    }
    if (!gesture || e.pointerId !== gesture.id) return;
    if (gesture.kind === 'grab') {
      const h = app.held, p = app.toWall(e.clientX, e.clientY); if (!h || !p) return;
      if (!gesture.moved && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) < 6) return;
      gesture.moved = true; h.fresh = false;
      if (gesture.mode !== 'move' && !gesture.pivoted) { gesture.pivoted = true; snapPivot(h, gesture.mode === 'a' ? 'b' : 'a'); }
      if (gesture.mode === 'move') { snapMove(h, p.x + gesture.ox, p.y + gesture.oy); edgeWatch(e.clientY); }
      else { snapSwing(h, gesture.mode === 'a' ? 'b' : 'a', p.x, p.y); h.ghost = false; const r = el.view.getBoundingClientRect(), fy = (e.clientY - r.top) / r.height; app.autoScroll = fy < 0.1 ? 1 : fy > 0.92 ? -1 : 0; }
      app.dirty = true;
    } else if (gesture.kind === 'stone') {
      const g = app.toGround(e.clientX, e.clientY); if (!g) return;
      const w = clamp(snapTo(2 * (Math.max(Math.abs(g.X), Math.abs(g.Z)) + gesture.off)), MIN_W, MAX_W);
      if (w !== W()) app.setWidth(w, true);
    } else if (gesture.kind === 'pending' || gesture.kind === 'orbit') {
      if (gesture.kind === 'pending' && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) < 7) return;
      if (gesture.kind === 'pending') { gesture.kind = 'orbit'; app.select(null); }
      const t = now(), dt = Math.max(1, t - gesture.lt), dx = e.clientX - gesture.lx, dy = e.clientY - gesture.ly;
      app.orbit(dx, dy);
      gesture.vx = gesture.vx * 0.5 + (dx / dt) * 0.5; gesture.lx = e.clientX; gesture.ly = e.clientY; gesture.lt = t;
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (gesture && gesture.kind === 'pinch') { if (pointers.size < 2) gesture = null; return; }
    if (!gesture || e.pointerId !== gesture.id) return;
    const g = gesture; gesture = null; stopEdge();
    if (g.kind === 'grab' && !g.moved && e.type === 'pointerup') {
      // a tap: on an overhang (or the round handle at its end) saws it off; on the middle turns the board
      const endCut = g.mode !== 'move' && heldOverhang().find((o) => o.end === g.mode);
      if (g.cut || endCut) cutHeld(g.cut || endCut);
      else if (g.mode === 'move') turnHeld();
    } else if (g.kind === 'grab' && g.mode === 'move' && e.type === 'pointerup') {
      // carried off the view (onto the lumber panel): back to the pile
      const r = el.view.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) putBack();
    } else if (g.kind === 'stone') {
      el.stoneHandles[g.corner].classList.remove('is-active'); app.onStonesSet && app.onStonesSet();
    } else if (g.kind === 'orbit') {
      app.orbitRelease(now() - g.lt < 80 ? g.vx : 0);
    } else if (g.kind === 'pending' && e.type === 'pointerup' && now() - g.t < 700) tapAt(e.clientX, e.clientY);
    app.dirty = true;
  };
  el.view.addEventListener('pointerup', endPointer); el.view.addEventListener('pointercancel', endPointer);
  el.view.addEventListener('wheel', (e) => { e.preventDefault(); app.setZoom(app.zoom * Math.exp(e.deltaY * 0.0012)); }, { passive: false });

  // a tap with nothing in hand: the selected board's overhang (saw it off), else whatever is under it (main.js decides:
  // a twin is built, a board is picked out). A tap hard on the heels of the one that picked the board out, or the
  // second tap of a double tap on a twin, is never a saw cut: it was meant as a double tap.
  function tapAt(cx, cy) {
    if (app.phase !== 'build') return;
    if (app.selected && !app.held && now() - selectTapAt > 500 && !(app.twinDoubleTap && app.twinDoubleTap(cx, cy))) {
      const n = nailedOverhang(app.selected);
      const o = n && overhangAt(cx, cy, n.face, n.seg, n.list);
      if (o) { cutNailed(app.selected, o); return; }
    }
    const was = app.selected;
    app.tapAt(cx, cy);
    if (app.selected && app.selected !== was) selectTapAt = now();
  }

  // turn the held board a step round its middle: upright, 45, level, 135
  function turnHeld() {
    const h = app.held; if (!h) return;
    const steps = [90, 45, 0, 135], now = ((Math.round(h.ang / DEG) % 180) + 180) % 180;
    let i = steps.findIndex((s) => Math.abs(s - now) < 3); i = (i + 1) % steps.length;
    const mx = h.x + Math.cos(h.ang) * h.len / 2, my = h.y + Math.sin(h.ang) * h.len / 2;
    h.ang = steps[i] * DEG; snapMove(h, mx - Math.cos(h.ang) * h.len / 2, my - Math.sin(h.ang) * h.len / 2); h.fresh = false; app.dirty = true;
    sound.clatter(h.len * 0.6, 'set', undefined, 0.35);
  }

  // a brace (not level, not upright, not a knee brace: on a narrow wall a short brace reaching post to post counts)
  // that closes no triangle, with an end stopping close to a joint but not on it: [{ x, y }] the contact at that end
  // (the quick drop that leaves a brace's foot half a foot off the corner, nailed to the post a little way up)
  function cornerMiss(h, cs) {
    const s = segOf(h), a = Math.abs(Math.atan2(s.by - s.ay, s.bx - s.ax)) * 180 / Math.PI, lean = Math.min(a, 180 - a);
    if (lean < 5 || lean > 85 || isKnee(s, W()) || cs.length < 2) return [];
    if (trianglesOf([...context().segs, s], '__held').length) return [];
    const dx = (s.bx - s.ax) / s.len, dy = (s.by - s.ay) / s.len, along = (c) => (c.x - s.ax) * dx + (c.y - s.ay) * dy;
    const sorted = [...cs].sort((p, q) => along(p) - along(q)), joints = jointsHere(), out = [];
    for (const c of [sorted[0], sorted[sorted.length - 1]]) {
      let d = Infinity; for (const j of joints) d = Math.min(d, Math.hypot(j.x - c.x, j.y - c.y));
      if (d > 0.15 && d < 1.25 && !out.includes(c)) out.push(c);
    }
    return out;
  }
  // what the held board will be nailed to: [{ x, y, other (seg or line), angle (degrees, 0..90) }]
  function contactsOf(h) {
    const { segs, lines } = context(), s = segOf(h), out = [];
    for (const o of [...segs, lines[2]]) for (const c of touch(s, o)) {
      const a1 = Math.atan2(s.by - s.ay, s.bx - s.ax), a2 = Math.atan2(o.by - o.ay, o.bx - o.ax);
      let d = Math.abs(angDiff(a1, a2)) / DEG; if (d > 90) d = 180 - d;
      out.push({ x: c.x, y: c.y, other: o, angle: d });
    }
    return out;
  }

  // ── drawing over the view: handles, the length, the angles, the nails, overhangs, the stones' tape ───────────────
  const place = (n, p) => { n.style.transform = `translate(${p.x}px, ${p.y}px)`; };
  // labels over the view that keep clear of each other (and of the handles): each tries its spots in turn and takes
  // the first free one, else the first one pulled inside the view. -> place(w, h, spots) -> the centre used
  function tagPlacer(r, avoid = []) {
    const taken = [...avoid];
    const free = (b) => b.x > 2 && b.x + b.w < r.width - 2 && b.y > 56 && b.y + b.h < r.height - 2
      && !taken.some((t) => b.x < t.x + t.w && b.x + b.w > t.x && b.y < t.y + t.h && b.y + b.h > t.y);
    return (w, h, spots) => {
      let c = spots.find((q) => free({ x: q.x - w / 2, y: q.y - h / 2, w, h }));
      if (!c) c = { x: clamp(spots[0].x, w / 2 + 4, r.width - w / 2 - 4), y: clamp(spots[0].y, 58 + h / 2, r.height - h / 2 - 4) };
      taken.push({ x: c.x - w / 2, y: c.y - h / 2, w, h });
      return c;
    };
  }
  const box = (q, size) => ({ x: q.x - size / 2, y: q.y - size / 2, w: size, h: size });
  // an overhang: pale, with the saw line where it comes off, and how much (its label placed by `place`)
  function drawOverhang(face, seg, list, place) {
    let out = '';
    if (!place) place = tagPlacer(el.view.getBoundingClientRect());
    for (const o of list) {
      const P = (u) => app.toScreen(face, seg.ax + (seg.bx - seg.ax) * u / seg.len, seg.ay + (seg.by - seg.ay) * u / seg.len);
      const A = P(o.t0), B = P(o.t1), J = o.end === 'a' ? B : A, M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      const ux = B.x - A.x, uy = B.y - A.y, ul = Math.hypot(ux, uy) || 1, nx = -uy / ul, ny = ux / ul;
      out += `<line class="over" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/>`;
      out += `<line class="sawline" x1="${J.x - nx * 15}" y1="${J.y - ny * 15}" x2="${J.x + nx * 15}" y2="${J.y + ny * 15}"/>`;
      const c = place(96, 24, [-28, 28, -52, 52, -76, 76].map((d) => ({ x: M.x + nx * d, y: M.y + ny * d }))), txt = '✂ saw off ' + fmt(o.t1 - o.t0);
      out += `<g class="overtag"><rect x="${c.x - 48}" y="${c.y - 12}" width="96" height="24" rx="12"/><text x="${c.x}" y="${c.y + 4}">${txt}</text></g>`;
      overTags.push({ end: o.end, x: c.x - 48, y: c.y - 12, w: 96, h: 24 });
    }
    return out;
  }
  let hintText = '';
  function frame() {
    const h = app.held, svg = el.overlay, building = app.phase === 'build';
    const show = !!h && building && (!app.facingWall || app.facingWall());
    for (const g of [el.gMove, el.gA, el.gB]) g.hidden = !show;
    el.nailBtn.hidden = !show; el.view.classList.toggle('is-holding', show);
    let out = '', hint = '';
    overTags = [];
    // the footing stones (until the first board is nailed): a handle on each, and the tape between the near two
    const stones = building && app.stonesOpen() && !h;
    el.stoneHandles.forEach((n, c) => { n.hidden = !stones; if (stones) { const [X, Z] = cornerXZ(W(), c); place(n, app.worldToScreen(X, 0.2, Z)); } });
    if (stones) {
      const k = app.face, [X0, Z0] = cornerXZ(W(), k), [X1, Z1] = cornerXZ(W(), (k + 1) % 4);
      const n = [[0, 1], [1, 0], [0, -1], [-1, 0]][k], off = 1.4;
      const A = app.worldToScreen(X0 + n[0] * off, 0.05, Z0 + n[1] * off), B = app.worldToScreen(X1 + n[0] * off, 0.05, Z1 + n[1] * off);
      const a0 = app.worldToScreen(X0, 0.05, Z0), b0 = app.worldToScreen(X1, 0.05, Z1);
      out += `<line class="tapeleg" x1="${a0.x}" y1="${a0.y}" x2="${A.x}" y2="${A.y}"/><line class="tapeleg" x1="${b0.x}" y1="${b0.y}" x2="${B.x}" y2="${B.y}"/>`;
      out += `<line class="tape" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/>`;
      const M = { x: (A.x + B.x) / 2, y: Math.max(A.y, B.y) + 22 };
      out += `<g class="tapetag"><rect x="${M.x - 60}" y="${M.y - 14}" width="120" height="27" rx="7"/><text x="${M.x}" y="${M.y + 5}">${fmt(W())} apart</text></g>`;
      hint = 'Drag a stone in or out to set the base';
    }
    if (show) {
      const k = app.face, s = segOf(h), r = el.view.getBoundingClientRect();
      const A = app.toScreen(k, s.ax, s.ay), B = app.toScreen(k, s.bx, s.by), M = app.toScreen(k, (s.ax + s.bx) / 2, (s.ay + s.by) / 2);
      // (a long board on a narrow screen: the view backs off until both its ends are in sight, once nothing is being
      // dragged; and the handles always stay inside the view)
      if (!gesture && !carrying && app.fitHeld) app.fitHeld(A, B, r);
      const inView = (q, m = 18) => ({ x: clamp(q.x, m, r.width - m), y: clamp(q.y, 58, r.height - m) });
      place(el.gMove, inView(M, 22)); place(el.gA, inView(A)); place(el.gB, inView(B));
      const over = heldOverhang(), cs = contactsOf(h), miss = cornerMiss(h, cs);
      // the nail button beside the board, on whichever side has room
      const inside = (q) => q.x > 28 && q.x < r.width - 28 && q.y > 70 && q.y < r.height - 28;
      let nx = -(B.y - A.y), ny = B.x - A.x; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      if (!inside({ x: M.x - nx * 64, y: M.y - ny * 64 }) && inside({ x: M.x + nx * 64, y: M.y + ny * 64 })) { nx = -nx; ny = -ny; }
      const nailAt = { x: clamp(M.x - nx * 64, 28, r.width - 28), y: clamp(M.y - ny * 64, 70, r.height - 28) };
      place(el.nailBtn, nailAt);
      // (every label from here on keeps clear of the others, the check and the three handles)
      const tag = tagPlacer(r, [box(nailAt, 54), box(inView(M, 22), 42), box(inView(A), 34), box(inView(B), 34)]);
      let tags = '';
      // the joints it will make, with the angle at each
      for (const c of cs) {
        const P = app.toScreen(k, c.x, c.y);
        // the arc between the held board and the other one, on the side the held board actually runs
        const far = Math.hypot(s.ax - c.x, s.ay - c.y) > Math.hypot(s.bx - c.x, s.by - c.y) ? A : B;
        const u1 = Math.atan2(far.y - P.y, far.x - P.x);
        const O1 = app.toScreen(k, c.other.ax, c.other.ay), O2 = app.toScreen(k, c.other.bx, c.other.by);
        let u2 = Math.atan2(O2.y - O1.y, O2.x - O1.x);
        if (Math.abs(angDiff(u2, u1)) > Math.PI / 2) u2 += Math.PI;
        const rr = 24, sweep = angDiff(u2, u1) > 0 ? 1 : 0;
        const x1 = P.x + Math.cos(u1) * rr, y1 = P.y + Math.sin(u1) * rr, x2 = P.x + Math.cos(u2) * rr, y2 = P.y + Math.sin(u2) * rr;
        const mid = u1 + angDiff(u2, u1) / 2;
        const square = Math.abs(c.angle - 90) < 0.5;
        if (square) {
          const q = 12, ax = Math.cos(u1) * q, ay = Math.sin(u1) * q, bx = Math.cos(u2) * q, by = Math.sin(u2) * q;
          out += `<path class="arc sq" d="M${P.x + ax} ${P.y + ay} L${P.x + ax + bx} ${P.y + ay + by} L${P.x + bx} ${P.y + by}"/>`;
        } else if (c.angle > 0.5) out += `<path class="arc" d="M${x1} ${y1} A${rr} ${rr} 0 0 ${sweep} ${x2} ${y2}"/>`;
        if (c.angle > 0.5) {
          const t = tag(42, 21, [41, 60, 80].map((d) => ({ x: P.x + Math.cos(mid) * d, y: P.y + Math.sin(mid) * d })));
          tags += `<g class="ang${square ? ' is-square' : ''}"><rect x="${t.x - 21}" y="${t.y - 11}" width="42" height="21" rx="5"/><text x="${t.x}" y="${t.y + 4}">${Math.round(c.angle)}°</text></g>`;
        }
        out += `<circle class="nail" cx="${P.x}" cy="${P.y}" r="6"/>`;
      }
      // a brace whose end stops near a corner without sitting on it makes no triangle there, so the wall can still
      // fold: a red ring on that end, its words a little way in along the board
      for (const m of miss) {
        const P = app.toScreen(k, m.x, m.y);
        out += `<circle class="miss" cx="${P.x}" cy="${P.y}" r="15"/>`;
        let tx = M.x - P.x, ty = M.y - P.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let px = -ty, py = tx; if (py < 0) { px = -px; py = -py; }
        const spots = [[110, 28], [110, -28], [60, 44], [60, -44], [0, 40], [0, -40]].map(([a, b]) => ({ x: P.x + tx * Math.min(a, tl * 0.8) + px * b, y: P.y + ty * Math.min(a, tl * 0.8) + py * b }));
        const t = tag(112, 21, spots);
        tags += `<g class="misstag"><rect x="${t.x - 56}" y="${t.y - 11}" width="112" height="21" rx="10"/><text x="${t.x}" y="${t.y + 4}">not on a corner</text></g>`;
      }
      // the overhang, pale, with the saw line where it would come off
      out += drawOverhang(k, s, over, tag);
      // the length, beside the board on the side away from the check
      {
        const ul = Math.hypot(B.x - A.x, B.y - A.y) || 1, tx = (B.x - A.x) / ul, ty = (B.y - A.y) / ul;
        const t = tag(68, 24, [[40, 0], [68, 0], [40, 55], [40, -55], [96, 0], [-40, 55], [-40, -55], [68, 90], [68, -90]].map(([n, a]) => ({ x: M.x + nx * n + tx * a, y: M.y + ny * n + ty * a })));
        tags += `<g class="len"><rect x="${t.x - 34}" y="${t.y - 13}" width="68" height="24" rx="6"/><text x="${t.x}" y="${t.y + 4}">${fmt(h.len)}</text></g>`;
      }
      out += tags;
      const ok = cs.length > 0;
      el.nailBtn.disabled = !ok;
      hint = !ok ? 'Touch it to a board or the ground to nail it'
        : miss.length ? 'Slide or swing its end onto the corner, so it makes a triangle'
        : over.length ? 'Tap ✂ saw off (or the pale end) to cut it at the joint, or ✓ to nail it'
        : h.ghost ? 'Lined up with its twin: ✓ to nail it'
        : postSide(h, W()) !== null ? 'Corner post, straight up: ✓ to nail it' : 'Tap ✓ to nail it';
    } else if (building && app.selected) {
      const n = nailedOverhang(app.selected);
      if (n && n.list.length) { out += drawOverhang(n.face, n.seg, n.list); hint = 'Tap ✂ saw off (or the pale end) to cut it off'; }
    }
    // the twins with no wood or no room: say why, small, by their middle (each tag clear of the others)
    if (building && !h) {
      const r = el.view.getBoundingClientRect(), tag = tagPlacer(r);
      for (const g of app.ghostList()) {
        if (g.ok || !g.reason) continue;
        let P;
        if (g.kind === 'post') { const [X, Z] = cornerXZ(W(), g.corner); P = app.worldToScreen(X, g.y + g.len / 2, Z); }
        else { const w = faceToWorld(W(), g.face, g.x + Math.cos(g.ang) * g.len / 2, g.y + Math.sin(g.ang) * g.len / 2); P = app.worldToScreen(w.X, w.Y, w.Z); }
        if (P.behind || P.x < 40 || P.x > r.width - 40 || P.y < 60 || P.y > r.height - 10) continue;
        const c = tag(108, 19, [[0, 0], [0, -24], [0, 24], [0, -48], [0, 48], [-70, 0], [70, 0]].map(([dx, dy]) => ({ x: P.x + dx, y: P.y + dy })));
        out += `<g class="ghosttag"><rect x="${c.x - 54}" y="${c.y - 10}" width="108" height="19" rx="9"/><text x="${c.x}" y="${c.y + 4}">${g.reason}</text></g>`;
      }
    }
    svg.innerHTML = out;
    if (!hint && building) hint = app.idleHint ? app.idleHint() : '';
    if (hint !== hintText) { hintText = hint; el.hint.textContent = hint; }
  }

  return { freshStack, renderPanel, frame, putBack, returnPiece, contactsOf, cut, takeUp, snapMove, snapSwing, toBench, turnHeld, payFor, woodFor, addOffcut,
    heldOverhang, cutHeld, nailedOverhang, cutNailed, fullCount, giveBoard, cornerMiss, jointsHere, get cutAt() { return cutAt; }, set cutAt(v) { cutAt = v; renderPanel(); } };
}
