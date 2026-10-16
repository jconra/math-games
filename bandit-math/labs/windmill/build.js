// BUILDING: the lumber panel on the left (the fresh stack on the bench with its tape measure and saw, the cut pieces
// waiting, grouped by length) and everything a finger or the mouse does on the view:
//   * the footing stones (the first step, before any board is nailed): drag one in or out to set the base, half a foot
//     to 8 feet each way, by the half foot. Its distance across (X) sets the width W, its distance along the sides (Z)
//     the depth D, so a stone dragged straight out to the side widens the tower and one dragged toward you deepens it
//   * a piece dragged from the panel onto the tower lies on an upright PLANE: the plane kind facing the view (planes
//     parallel to the front wall when you look at the front or the back, parallel to the sides from a side), the
//     nearest such plane to you that already has a board within reach of the piece, else the outer wall facing you.
//     Looking at its plane face on, slide it (the round handle in its middle), swing it about either end (the handles
//     at its ends), tap its middle to turn it a step, tap the gold check to nail it, carry it back onto the panel (or
//     Undo) to put it back on the pile.
//   * IN AND OUT: turn the view a quarter (so you see the held board end on) and grab it again: now dragging moves its
//     plane in and out over the stones (and up and down); the swing handles hide. Its plane is drawn faintly, with its
//     name ("1½ ft in from the front"). A post stands in two planes at once, so seen from the side it simply slides on
//     its other plane (that is how a post gets set in from a wall). The view decides with a little give, so it does not
//     flicker at 45 degrees: face on below 40 degrees off square, end on past 50.
//   * while a board is held, every spot where it will be nailed shows a bold GREEN circle (a board in its own plane, a
//     board crossing its plane, the ground), and its ends glow green where they touch; an end close to a board but not
//     touching gets an open red ring ("not touching"); a brace end stopping near a corner without sitting on it gets a
//     red ring too ("not on a corner"). Nailing flashes the joints green. The angles where it meets boards in its plane
//     are drawn as before. A part sticking out past the last board it meets (an overhang) is drawn pale with a saw line
//     at the joint: tap it (or its "saw off" label) to saw it off right there. (A post's top above its last crosspiece is
//     not an overhang: the next crosspiece or post goes there.)
//   * anywhere else: drag to walk round the tower (sideways) and climb it (up and down); two fingers or the wheel zoom.
//     The camera is free whether or not a board is held: nothing here squares or swings the view. A tap picks a glowing
//     twin (builds it: main.js takes any twin within a fingertip of the tap) or a nailed board (to take it down, or saw
//     its overhang off).
//
// Snapping, so a shaky finger still builds square: positions go to the half foot; an end that comes near a joint (a
// corner's foot, where a post meets a crosspiece, where a board crosses the plane) lands right on it from furthest off,
// then one near another board's end, a corner line, the ground or a board's edge; an angle goes to every 5 degrees, or
// to exactly where the free end lands on a board (in the plane, or crossing it). Before a swing, the end it swings
// about settles onto a joint if it is near one (from up to 2 feet off when the board is just the length of the slant
// between two joints). Pushed in or out, a plane snaps to the half foot and onto the planes other boards already stand
// in, never past the stones, and an end that comes near a board crossing the new plane lands on it. A held board the
// same length as a glowing twin on its plane snaps onto it.
//
// On a narrow screen a long held board can run off the view: once nothing is dragging it, the view backs off until both
// its ends are in reach. Labels over the view (lengths, angles, saw-offs, why a twin is grey) keep clear of each other
// and of the handles; a "saw off" label can be tapped as well as the pale end it names.
// A finger on the cut pieces: straight up and down scrolls the panel; any other way, or onto the view, lifts the piece.
//
// (PLANES ARE X OR Z: the held board's plane is a key like 'Z:1.5'; its own coordinates on it are (x, y) = (u, y) of
// tower.js. In-plane work is 2D, as v2's walls were; only the plane's offset is new.)
import { SNAP, BOARD_FT, MIN_W, MAX_W, planeSegments, planesOf, planeKey, parseKey, toPlane, planeHalf, faceOfPlane, planesInUse, crossings, crossKey, boardOnPlane, planeName, wallSpan, floorsAcross } from './tower.js';
import { trianglesOf } from './questions.js';
import { touch, findJoints, isKnee, contactsOf as contactsIn3D, pointGap, TOL } from './touch.js';
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
// a length for the stats bar, as HTML, its units small so a height like 25 ft 10 in fits a phone's bar
export const fmtStat = (ft) => fmt(ft).replace(/ ?(ft|in)\b/g, '<span class="u">$1</span>');
// the base in words: "6 ft × 4 ft" (short: "6 × 4 ft")
const num = (v) => { const f = Math.floor(v + 1e-6); return Math.abs(v - f - 0.5) < 1e-6 ? (f || '') + '½' : String(Math.round(v * 10) / 10); };
export const fmtBase = (W, D, short = false) => (short ? `${num(W)} × ${num(D)} ft` : `${fmt(W)} × ${fmt(D)}`);
const SCRAP = 0.5;      // an offcut shorter than this is kindling, not lumber
const FACE_ON = 40 * DEG, END_ON = 50 * DEG;   // seen face on below 40 degrees off square, end on past 50 (between: as it was)

export function makeBuild(app) {
  const el = app.el;
  let nextId = 1;
  const newPiece = (len, full = false) => ({ id: 'w' + nextId++, len, full });
  const L = app.lumber;
  const T = () => app.tower;

  // ── the panel ────────────────────────────────────────────────────────────────────────────────────────────────────
  let cutAt = 4;
  function freshStack(n) {
    L.stack = n; L.pieces = []; L.bench = null; nextBench(); cutAt = 4; renderPanel();
  }
  function nextBench() { if (L.stack > 0) { L.stack--; L.bench = newPiece(BOARD_FT, true); } else L.bench = null; }
  // one more fresh board (a right answer's reward): onto the stack, and up onto the bench if the bench is empty
  function giveBoard() { L.stack++; if (!L.bench) nextBench(); renderPanel(); }
  function fullCount() { return L.stack + (L.bench && L.bench.full ? 1 : 0); }
  // the cut pieces grouped by length, longest first: [{ len, list }]. A group's key is the length rounded to a
  // thousandth of a foot (a brace sawn off at a slanting joint is 2.3431... ft), and lifting from a group must pick by
  // that same key (pieceKey), never by the rounded length itself
  const pieceKey = (len) => Math.round(len * 1000) / 1000;
  function groups() {
    const m = new Map();
    for (const p of L.pieces) { const k = pieceKey(p.len); (m.get(k) || m.set(k, []).get(k)).push(p); }
    return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([len, list]) => ({ len, list }));
  }

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
      // (the fresh stack is drawn as a stack: more boards behind the one on top)
      el.benchBoard.classList.toggle('is-stack', b.full && fullCount() > 1);
      // the tape: a tick every half foot, a number every foot
      let ticks = '';
      for (let f = 0; f <= b.len + 1e-6; f += 0.5) ticks += `<i class="${f % 1 ? 'half' : 'foot'}" style="bottom:${f * pxFt}px">${f % 1 || !f ? '' : '<b>' + f + '</b>'}</i>`;
      el.tape.innerHTML = ticks; el.tape.style.height = (b.len * pxFt) + 'px';
      cutAt = Math.min(Math.max(SNAP, cutAt), b.len - SNAP);
      const canCut = b.len > SNAP * 1.5;
      el.saw.hidden = !canCut; el.cutBtn.disabled = !canCut;
      el.saw.style.bottom = (cutAt * pxFt) + 'px';
      el.sawLabel.innerHTML = `${fmt(cutAt)} <span>|</span> ${fmt(b.len - cutAt)}`;
      el.benchLabel.innerHTML = b.full ? `8 ft board <b>×${fullCount()}</b>` : fmt(b.len) + ' piece';
    }
    // (the panel keeps its place when the pieces are redrawn: lifting one off a scrolled panel doesn't jump it back up)
    const narrow = (el.pieces.clientWidth || 120) <= 160, pxFt = narrow ? 9 : 13, keep = el.panel ? el.panel.scrollTop : 0;
    el.pieces.innerHTML = '';
    // each length is one little stack, "×N" beside it; dragging from it lifts one
    for (const g of groups()) {
      const n = g.list.length, shown = Math.min(n, 4), d = document.createElement('div');
      d.className = 'piece' + (g.list.some((p) => p.fresh) ? ' is-new' : ''); g.list.forEach((p) => { p.fresh = false; });
      d.dataset.len = g.len; d.dataset.n = n;
      let sticks = '';
      for (let i = 0; i < shown; i++) sticks += `<i style="height:${g.len * pxFt}px;left:${i * 5}px;bottom:${i * 2}px"></i>`;
      d.innerHTML = `<div class="pile" style="width:${(narrow ? 12 : 16) + (shown - 1) * 5}px;height:${g.len * pxFt + (shown - 1) * 2}px">${sticks}</div><span>${fmt(g.len)}${n > 1 ? `<b>×${n}</b>` : ''}</span>`;
      d.title = 'Drag one onto the tower. Tap to put one on the bench and cut it.';
      wireDrag(d, { len: g.len, pick: () => L.pieces.find((p) => pieceKey(p.len) === g.len) || null });
      el.pieces.appendChild(d);
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
    if (!p || !L.pieces.includes(p)) { renderPanel(); return; }
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
  // src: { len, pick() -> the piece to lift (one of its group), or null if none is left }
  function wireDrag(node, src, fromBench = false) {
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
          ghost.innerHTML = `<div class="stick"></div><span>${fmt(src.len)}</span>`; document.body.appendChild(ghost); node.classList.add('is-lifted');
          app.onDragStart && app.onDragStart(); carrying = true;
        }
        ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
        const r = el.view.getBoundingClientRect();
        const over = ev.clientX > r.left + 4 && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
        if (over && !onView) {
          onView = true; lifted = takeUp(src, fromBench);
          if (!lifted) { dropped = true; ghost.remove(); ghost = null; node.classList.remove('is-lifted'); carrying = false; return; }
        }
        if (onView && app.held) { ghost.style.opacity = over ? 0 : 1; if (over) { placeAtPointer(ev.clientX, ev.clientY, true); edgeWatch(ev.clientY); } }
      };
      const up = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
        node.classList.remove('is-lifted'); if (ghost) ghost.remove(); stopEdge(); carrying = false;
        if (dropped || scrolling) return;
        if (!dragging) { if (!fromBench && ev.type === 'pointerup') toBench(src.pick()); return; }
        dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 50);
        const r = el.view.getBoundingClientRect();
        const over = ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
        // (carried back onto the panel: the piece that was lifted goes back on the pile)
        if (!over && app.held && lifted && app.held.piece === lifted) putBack();
        else if (app.held) app.held.fresh = false;     // (let go on the view: it stays on the plane it was put on)
        app.dirty = true;
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
  }
  wireDrag(el.benchBoard, { get len() { return L.bench ? L.bench.len : 0; }, pick: () => L.bench }, true);

  // lift a piece off the panel into the builder's hands (on the outer wall facing the view until the pointer finds its
  // plane)
  function takeUp(src, fromBench) {
    const p = src.pick(); if (!p) return null;          // (spent on a twin meanwhile)
    if (app.held) putBack();
    if (fromBench) nextBench();
    else L.pieces = L.pieces.filter((q) => q !== p);
    sound.clatter(p.len, 'pick');
    app.held = { piece: p, len: p.len, key: app.facingPlane(), x: 0, y: 0, ang: Math.PI / 2, fresh: true, endOn: false };
    renderPanel(); app.select(null); app.dirty = true;
    app.onTakeUp && app.onTakeUp();
    return p;
  }
  // the held board back onto the panel (a whole board onto the stack, a cut one joins its group)
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

  // ── the held board on its plane ──────────────────────────────────────────────────────────────────────────────────
  // (h.x, h.y): its a end on the plane h.key; h.ang its angle there; the far end len feet along
  const endsOf = (h) => ({ ax: h.x, ay: h.y, bx: h.x + Math.cos(h.ang) * h.len, by: h.y + Math.sin(h.ang) * h.len });
  const segOf = (h) => ({ id: '__held', ...endsOf(h), len: h.len });
  const upright = (h) => Math.abs(Math.cos(h.ang)) < 1e-6;
  // the held board in the world: { id, a, b, len, n }
  // (a post keeps the way its wide face looks (h.n) when it moves over to its other plane: the view turning round it
  // never turns the post itself, which bends easily only its thin way)
  const worldOf = (h) => { const w = boardOnPlane(h.key, h.x, h.y, h.ang, h.len); if (h.n && upright(h)) w.n = h.n; return { id: '__held', ...w }; };
  // how far out of square the view is from a plane (0: face on, PI/2: end on)
  const offSquare = (key) => { const nAz = key[0] === 'Z' ? 0 : Math.PI / 2; return Math.acos(Math.min(1, Math.abs(Math.cos(app.viewAz() - nAz)))); };
  // the plane's offset, and a world point's coordinate across it (PLANES ARE X OR Z)
  const offOf = (key) => parseKey(key).off;
  const across = (key, p) => (key[0] === 'Z' ? p.Z : p.X);
  const axisHalf = (axis) => (axis === 'Z' ? T().D / 2 : T().W / 2);

  // everything on the held board's plane: its boards, where boards crossing it pass through, the ground, and (on an
  // outer wall) the corner lines over the stones
  function context(key = app.held ? app.held.key : app.facingPlane()) {
    const t = T(), segs = planeSegments(t, key), half = planeHalf(t, key), outer = faceOfPlane(t, key) >= 0;
    const cross = crossings(t, key).map((c) => ({ x: c.u, y: c.y, src: c.src }));
    const lines = [{ ax: -60, ay: 0, bx: 60, by: 0, len: 120, ground: true }];
    if (outer) for (const u of [-half, half]) lines.push({ ax: u, ay: 0, bx: u, by: 400, len: 400, corner: true });
    return { key, segs, cross, lines, half, outer };
  }
  function nearestOn(s, px, py) {
    const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / L2));
    return { x: s.ax + dx * t, y: s.ay + dy * t, t };
  }

  // the joints on a plane where a brace's end wants to sit: the stones (on an outer wall), every spot where boards
  // already meet in it, and every spot where a board crosses it
  function jointsHere(ctx = context()) {
    const out = ctx.outer ? [{ x: -ctx.half, y: 0 }, { x: ctx.half, y: 0 }] : [];
    const add = (x, y) => { if (!out.some((q) => Math.hypot(q.x - x, q.y - y) < 0.05)) out.push({ x, y }); };
    for (const j of findJoints(ctx.segs)) add(j.x, j.y);
    for (const c of ctx.cross) add(c.x, c.y);
    return out;
  }
  const JOINT_SNAP = 0.8;     // feet: an end this close to a joint lands right on it
  function nearestJoint(x, y, within = JOINT_SNAP, ctx) {
    let best = null, bd = within;
    for (const j of jointsHere(ctx)) { const d = Math.hypot(j.x - x, j.y - y); if (d < bd) { bd = d; best = j; } }
    return best;
  }

  // slide: the board's end a goes to (x, y), then the best snap for either end shifts the whole board
  function snapMove(h, x, y) {
    const ctx = context(h.key), { segs, lines } = ctx;
    const dx = Math.cos(h.ang) * h.len, dy = Math.sin(h.ang) * h.len;
    let best = null;
    const consider = (ox, oy, score, along, e) => { if (!best || score < best.score) best = { ox, oy, score, along, e }; };
    const tips = [...segs.flatMap((s) => [[s.ax, s.ay], [s.bx, s.by]]), ...ctx.cross.map((c) => [c.x, c.y])];
    const joints = jointsHere(ctx);
    // (an upright board's foot that settles on anything within a fifth of a foot of a post's top goes onto the post's
    // top: a board stood on the top post stands on the post, not on the end of the brace that reaches up beside it a
    // few inches lower. Only that close: a joint half a foot along, where a beam crosses, is still its own spot)
    const up = Math.abs(Math.cos(h.ang)) < 1e-6, lowEnd = dy >= 0 ? 0 : 1;
    const postTops = up ? segs.filter((s) => s.post).map((s) => (s.ay > s.by ? [s.ax, s.ay] : [s.bx, s.by])) : [];
    [[x, y], [x + dx, y + dy]].forEach(([ex, ey], e) => {
      // joints (a corner's foot, a post meeting a crosspiece, a board crossing the plane: strongest, from furthest), the
      // ends of other boards, then their length, the corner lines and the ground
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
      // joint), else to the half foot along it. (Close: under a third of a foot, so the half foot next to a board's end
      // can still be had: a setback tier's post stands half a foot in from the wall below.)
      const s = best.along, ox = best.e ? dx : 0, oy = best.e ? dy : 0;
      const along = (v, fixed, horiz) => {
        let to = snapTo(v), near = 0.3;
        for (const [px, py] of tips) { const on = horiz ? Math.abs(py - fixed) < 0.05 : Math.abs(px - fixed) < 0.05, q = horiz ? px : py; if (on && Math.abs(q - v) < near) { near = Math.abs(q - v); to = q; } }
        return to;
      };
      if (s && Math.abs(s.ay - s.by) < 1e-6) nx = along(nx + ox, s.ay, true) - ox;
      else if (s && Math.abs(s.ax - s.bx) < 1e-6) ny = along(ny + oy, s.ax, false) - oy;
    } else { nx = snapTo(nx); ny = snapTo(ny); }
    if (postTops.length) {
      const fx = nx + (lowEnd ? dx : 0), fy = ny + (lowEnd ? dy : 0);
      for (const [px, py] of postTops) if (Math.hypot(px - fx, py - fy) < 0.2) { nx += px - fx; ny += py - fy; break; }
    }
    // never below the ground
    const low = Math.min(ny, ny + dy); if (low < 0) ny -= low;
    h.x = nx; h.y = ny;
    ghostSnap(h);
  }
  // before a swing: the end it swings about, if it is near a joint, settles right onto it (so a board dropped a little
  // off the corner still braces corner to corner)
  // A board just as long as the slant between two joints (a brace cut to reach a bay corner to corner, like the 5 ft
  // brace in a bay 3 ft wide and 4 ft tall) settles its pivot onto the nearer joint of that pair from further off (2
  // feet), so dropping it level in the bay and swinging one end up still lands it corner to corner. Only a pair in the
  // bay the board is in counts: between the floor under its middle and the floor over it (a board lying on a floor is
  // in the bay above it), so a tier's brace never jumps to a slant in the storey below. An end already sitting right on
  // a joint stays where it is.
  function snapPivot(h, pivotEnd) {
    const e = endsOf(h), P = pivotEnd === 'a' ? { x: e.ax, y: e.ay } : { x: e.bx, y: e.by };
    const ctx = context(h.key), js = jointsHere(ctx);
    if (js.some((q) => Math.hypot(q.x - P.x, q.y - P.y) < 0.02)) return;
    const floors = [0, ...ctx.segs.filter((s) => !s.post && Math.abs(s.ay - s.by) < 0.05).map((s) => s.ay),
      ...ctx.cross.filter((c) => c.src && Math.abs(c.src.a.Y - c.src.b.Y) < 0.05).map((c) => c.y)];
    const ymid = (e.ay + e.by) / 2, fb = Math.max(...floors.filter((f) => f <= ymid + 0.1)), above = floors.filter((f) => f > ymid + 0.1);
    const fa = above.length ? Math.min(...above) : Infinity, inBay = (q) => q.y > fb - 0.05 && q.y < fa + 0.05;
    let j = null, bd = 2.05;
    for (const q of js) {
      const d = Math.hypot(q.x - P.x, q.y - P.y); if (d >= bd || !inBay(q)) continue;
      if (js.some((o) => inBay(o) && Math.abs(o.x - q.x) > 0.3 && Math.abs(o.y - q.y) > 0.3 && Math.abs(Math.hypot(o.x - q.x, o.y - q.y) - h.len) < 0.12)) { j = q; bd = d; }
    }
    j = j || nearestJoint(P.x, P.y, JOINT_SNAP, ctx); if (!j || Math.hypot(j.x - P.x, j.y - P.y) < 0.01) return;
    h.x += j.x - P.x; h.y += j.y - P.y;
  }
  // swing: one end stays put (pivot), the other follows the pointer's direction
  function snapSwing(h, pivotEnd, px, py) {
    const ctx = context(h.key), { segs, lines } = ctx;
    const e = endsOf(h);
    const P = pivotEnd === 'a' ? { x: e.ax, y: e.ay } : { x: e.bx, y: e.by };
    const raw = Math.atan2(py - P.y, px - P.x);
    // where a circle of the board's length round the pivot crosses other boards, the corner lines and the ground, or
    // passes through a board crossing the plane
    let best = null;
    const tryAt = (q) => { const a = Math.atan2(q.y - P.y, q.x - P.x), diff = Math.abs(angDiff(a, raw)); if (diff < 9 * DEG && (!best || diff < best.diff)) best = { a, diff }; };
    for (const s of [...segs, ...lines]) for (const q of circleHits(P, h.len, s)) tryAt(q);
    for (const c of ctx.cross) if (Math.abs(Math.hypot(c.x - P.x, c.y - P.y) - h.len) < 0.25) tryAt(c);
    let a = best ? best.a : Math.round(raw / (5 * DEG)) * 5 * DEG;
    if (P.y + Math.sin(a) * h.len < -0.01) { const g = circleHits(P, h.len, lines[0]); if (g.length) { g.sort((u, v) => Math.abs(angDiff(Math.atan2(u.y - P.y, u.x - P.x), raw)) - Math.abs(angDiff(Math.atan2(v.y - P.y, v.x - P.x), raw))); a = Math.atan2(g[0].y - P.y, g[0].x - P.x); } else a = P.x < 0 ? 0 : Math.PI; }
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
  // a held board the same length as a glowing twin on its plane, brought near it, settles right onto it
  function twinSpots(len, key) {
    const out = [];
    for (const g of app.ghostList()) {
      if (!g.ok || Math.abs(g.len - len) > 0.01 || !planesOf(g).includes(key)) continue;
      const A = toPlane(key, g.a), B = toPlane(key, g.b); out.push({ ax: A.u, ay: A.y, bx: B.u, by: B.y });
    }
    return out;
  }
  function ghostSnap(h) {
    const s = segOf(h);
    for (const g of twinSpots(h.len, h.key)) {
      for (const [a, b] of [[[g.ax, g.ay], [g.bx, g.by]], [[g.bx, g.by], [g.ax, g.ay]]]) {
        if (Math.hypot(a[0] - s.ax, a[1] - s.ay) < 0.7 && Math.hypot(b[0] - s.bx, b[1] - s.by) < 0.7) {
          h.x = a[0]; h.y = a[1]; h.ang = Math.atan2(b[1] - a[1], b[0] - a[0]); h.ghost = true; return;
        }
      }
    }
    h.ghost = false;
  }

  // ── in and out: the held board's plane pushed over the stones (seen end on) ──────────────────────────────────────
  // where a plane's offset settles: onto a plane other boards already stand in (or the stones' edge, or the middle) if
  // one is within a quarter foot, else the half foot; never past the stones. (A quarter foot: every half foot then has
  // the same reach, so the half foot either side of the middle, where a 1 × 1 top's walls stand, is as easy to land
  // on as the middle itself.)
  function snapOffset(axis, v) {
    const half = axisHalf(axis), t = T();
    let to = snapTo(v), near = 0.25;
    const offs = [-half, 0, half];
    for (const k of planesInUse(t)) if (k[0] === axis) offs.push(offOf(k));
    for (const o of offs) if (Math.abs(o - v) < near) { near = Math.abs(o - v); to = o; }
    return clamp(to, -half, half);
  }
  // move the held board onto the plane `off` of its kind, its a end at height y (its place along the plane kept): an
  // end that comes near a joint or a board crossing the new plane lands on it, else the half foot
  function snapInOut(h, off, y) {
    h.key = planeKey(h.key[0], off);
    const ctx = context(h.key), dx = Math.cos(h.ang) * h.len, dy = Math.sin(h.ang) * h.len;
    const pts = [...jointsHere(ctx), ...ctx.segs.flatMap((s) => [{ x: s.ax, y: s.ay }, { x: s.bx, y: s.by }])];
    let best = null;
    for (const [ex, ey] of [[h.x, y], [h.x + dx, y + dy]]) for (const q of pts) { const d = Math.hypot(q.x - ex, q.y - ey); if (d < 0.45 && (!best || d < best.d)) best = { d, ox: q.x - ex, oy: q.y - ey }; }
    let ny = best ? y + best.oy : snapTo(y);
    if (best) h.x += best.ox;
    const low = Math.min(ny, ny + dy); if (low < 0) ny -= low;
    h.y = ny; h.ghost = false;
  }
  // which way the held board is seen: face on (slide and swing on its plane) or end on (push it in and out), with a
  // little give round 45 degrees. A post seen end on from one of its planes is face on in the other: it moves over to
  // that one (so from the side it slides along the side's plane). Not while a finger is moving it.
  function updateView(h) {
    if (!h || (gesture && gesture.kind === 'grab')) return;
    const off = offSquare(h.key);
    if (upright(h)) {
      if (off > END_ON) { const mid = worldOf(h).a; if (!h.n) h.n = h.key[0]; h.key = crossKey(h.key, mid); const p = toPlane(h.key, mid); h.x = p.u; }
      h.endOn = false; return;
    }
    h.n = null;     // (a board that isn't upright lies flat in its plane: its face looks across it)
    if (h.endOn && off < FACE_ON) h.endOn = false;
    else if (!h.endOn && off > END_ON) h.endOn = true;
  }

  // a freshly dragged-in board under the pointer: on the plane the pointer finds (main.js pickPlane), upright near a
  // corner of the stones (on an outer wall: where corner posts go), else level, unless already turned
  function placeAtPointer(cx, cy, fresh) {
    const h = app.held; if (!h) return;
    if (fresh && h.fresh) {
      h.key = app.pickPlane(cx, cy, h.len);
      const p = app.toPlane(h.key, cx, cy); if (!p) return;
      const ctx = context(h.key);
      const postU = ctx.outer ? [-ctx.half, ctx.half] : [];
      let near = null, nd = Math.min(1.3, ctx.half * 0.68);
      for (const u of postU) { const d = Math.abs(p.x - u); if (d < nd) { nd = d; near = u; } }
      h.ang = near !== null ? Math.PI / 2 : 0;
      // the pointer holds the board's middle (an upright one: a bit below its middle, so it can reach the ground)
      let mx = p.x - Math.cos(h.ang) * h.len / 2, my = p.y - Math.sin(h.ang) * h.len * (near !== null ? 0.35 : 0.5);
      if (near !== null) {
        // an upright board by a corner settles onto the ground, or onto the top of the post standing there
        let base = 0;
        for (const s of ctx.segs) if (s.post && Math.abs(s.ax - near) < 0.01) { const top = Math.max(s.ay, s.by); if (top <= p.y + 1.5 && top > base) base = top; }
        mx = near; my = base;
      }
      h.endOn = false;
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

  // ── where the held board touches: the green circles ──────────────────────────────────────────────────────────────
  // [{ x, y (on its plane), X, Y, Z (world), t (feet along it from its a end), end ('a', 'b' or null), other (a board,
  //    or null for the ground), seg (the other on this plane, when it lies in it: for the angle), angle (degrees 0..90,
  //    or null across planes) }]
  function contactsOf(h) {
    const me = worldOf(h), out = [], ground = { ax: -60, ay: 0, bx: 60, by: 0, len: 120, ground: true };
    for (const c of contactsIn3D(me, T().boards)) {
      const q = toPlane(h.key, c);
      let seg = null;
      if (!c.other) seg = ground;
      else if (planesOf(c.other).includes(h.key)) { const A = toPlane(h.key, c.other.a), B = toPlane(h.key, c.other.b); seg = { ax: A.u, ay: A.y, bx: B.u, by: B.y, len: c.other.len }; }
      let angle = null;
      if (seg) { angle = Math.abs(angDiff(h.ang, Math.atan2(seg.by - seg.ay, seg.bx - seg.ax))) / DEG; if (angle > 90) angle = 180 - angle; }
      out.push({ x: q.u, y: q.y, X: c.X, Y: c.Y, Z: c.Z, t: c.t, end: c.end, other: c.other, seg, angle });
    }
    return out;
  }
  // an end that comes close to a board but doesn't touch it: [{ end, x, y, d }] (a red ring: "not touching"). (A board
  // it is already nailed to elsewhere doesn't count: an end sticking out past it is an overhang, not a near miss.)
  function nearMisses(h, cs) {
    const me = worldOf(h), out = [], mine = new Set(cs.map((c) => c.other));
    for (const [end, p] of [['a', me.a], ['b', me.b]]) {
      if (cs.some((c) => c.end === end)) continue;
      let d = p.Y > TOL && !mine.has(null) ? p.Y : Infinity;
      for (const o of T().boards) if (!mine.has(o)) d = Math.min(d, pointGap(p, o).d);
      if (d > TOL && d < 0.75) { const q = toPlane(h.key, p); out.push({ end, x: q.u, y: q.y, d }); }
    }
    return out;
  }

  // ── overhang: the part of a board past the last board (or the ground) it is nailed to ────────────────────────────
  // len: its length; ts: feet along it (from its a end) where it touches others; top: which end is up for an upright
  // board (null otherwise). Returns [{ end: 'a' | 'b', t0, t1 }] (the stretch that sticks out), only when it is nailed
  // at two places or more. The top of a post standing up past its last crosspiece is no overhang: that is where the
  // next crosspiece (or the next post) goes.
  function overhangOf(len, ts, top) {
    if (ts.length < 2) return [];
    const lo = Math.max(0, Math.min(...ts)), hi = Math.min(len, Math.max(...ts)), out = [];
    if (hi - lo < 0.3) return out;
    if (lo > 0.12 && top !== 'a') out.push({ end: 'a', t0: 0, t1: lo });
    if (len - hi > 0.12 && top !== 'b') out.push({ end: 'b', t0: hi, t1: len });
    return out;
  }
  const topEnd = (a, b) => (Math.abs(a.X - b.X) < 0.1 * Math.hypot(a.X - b.X, a.Y - b.Y, a.Z - b.Z) + 1e-9 && Math.abs(a.Z - b.Z) < 0.1 * Math.hypot(a.X - b.X, a.Y - b.Y, a.Z - b.Z) + 1e-9 ? (b.Y > a.Y ? 'b' : 'a') : null);
  // the held board's overhangs
  function heldOverhang() { const h = app.held; if (!h) return []; const w = worldOf(h); return overhangOf(h.len, contactsOf(h).map((c) => c.t), topEnd(w.a, w.b)); }
  // a nailed board's overhangs: { board, list }
  function nailedOverhang(src) {
    if (!src || !T().boards.includes(src)) return null;
    const ts = contactsIn3D(src, T().boards).map((c) => c.t);
    return { board: src, list: overhangOf(src.len, ts, topEnd(src.a, src.b)) };
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
    const before = src.len, d = { X: (src.b.X - src.a.X) / src.len, Y: (src.b.Y - src.a.Y) / src.len, Z: (src.b.Z - src.a.Z) / src.len };
    const at = (t) => { const r = (v) => Math.round(v * 1e6) / 1e6 || 0; return { X: r(src.a.X + d.X * t), Y: r(src.a.Y + d.Y * t), Z: r(src.a.Z + d.Z * t) }; };
    if (o.end === 'a') { src.a = at(o.t1); src.len -= o.t1; } else { src.b = at(o.t0); src.len = o.t0; }
    sawOff(before, o, true); app.onTowerChanged && app.onTowerChanged(src, `Sawed ${fmt(o.t1 - o.t0)} off`);
  }
  // a point along a board on the screen: the held one a layer out from its plane, as drawn
  const heldScreen = (h, u, y) => app.planeToScreen(h.key, u, y, !upright(h));
  const boardScreen = (b, t) => { const k = t / b.len; return app.worldToScreen(b.a.X + (b.b.X - b.a.X) * k, b.a.Y + (b.b.Y - b.a.Y) * k, b.a.Z + (b.b.Z - b.a.Z) * k); };
  // which overhang (if any) the screen point is on: the pale part itself, or its "saw off" tag. at(t) -> screen point
  function overhangAt(cx, cy, at, list) {
    const r = el.view.getBoundingClientRect(), px = cx - r.left, py = cy - r.top;
    for (const o of list) {
      const A = at(o.t0), B = at(o.t1);
      const vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy || 1, t = clamp(((px - A.x) * vx + (py - A.y) * vy) / L2, 0, 1);
      if (Math.hypot(A.x + vx * t - px, A.y + vy * t - py) < 16) return o;
    }
    const tag = overTags.find((q) => px > q.x - 6 && px < q.x + q.w + 6 && py > q.y - 6 && py < q.y + q.h + 6);
    return (tag && list.find((o) => o.end === tag.end)) || null;
  }
  const heldAt = (h) => { const s = segOf(h); return (t) => heldScreen(h, s.ax + (s.bx - s.ax) * t / s.len, s.ay + (s.by - s.ay) * t / s.len); };
  let overTags = [];     // the "saw off" tags drawn last frame (view pixels), so a tap on one saws
  let selectTapAt = 0;   // when a tap last picked out a nailed board
  // how far (view pixels) a screen point is from the held board as drawn
  function pxFromHeld(h, cx, cy) {
    const r = el.view.getBoundingClientRect(), s = segOf(h), A = heldScreen(h, s.ax, s.ay), B = heldScreen(h, s.bx, s.by);
    return distToSeg({ x: cx - r.left, y: cy - r.top }, A, B);
  }
  const distToSeg = (p, A, B) => { const vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy || 1, t = clamp(((p.x - A.x) * vx + (p.y - A.y) * vy) / L2, 0, 1); return Math.hypot(A.x + vx * t - p.x, A.y + vy * t - p.y); };

  // ── the view's pointers: handles, stones, overhangs, walking round, zooming, taps ───────────────────────────────
  const pointers = new Map();          // every finger or mouse button down on the view: id -> { x, y }
  let gesture = null;                  // what the one pointer that started it is doing
  const now = () => performance.now();
  const TAP_MS = 300;                  // a press on the held board shorter than this, that hardly moves, is a tap
  function startGrab(mode, e, extra = {}) {
    const h = app.held; if (!h) return;
    e.preventDefault(); e.stopPropagation(); sound.audioOn();
    updateView(h);
    let g;
    if (mode === 'move' && h.endOn) {
      // seen end on: in and out (across its plane) and up and down, on the plane at right angles through its middle
      const w = worldOf(h), mid = { X: (w.a.X + w.b.X) / 2, Y: (w.a.Y + w.b.Y) / 2, Z: (w.a.Z + w.b.Z) / 2 }, cross = crossKey(h.key, mid);
      const hit = app.toWorld(cross, e.clientX, e.clientY); if (!hit) return;
      g = { kind: 'grab', mode: 'inout', cross, o0: offOf(h.key) - across(h.key, hit), y0: h.y - hit.Y };
    } else {
      const p = app.toPlane(h.key, e.clientX, e.clientY); if (!p) return;
      g = { kind: 'grab', mode, ox: h.x - p.x, oy: h.y - p.y };
    }
    gesture = { ...g, id: e.pointerId, x: e.clientX, y: e.clientY, t0: now(), moved: false, ...extra };
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.view.setPointerCapture(e.pointerId); } catch (err) { /* (a synthetic event has nothing to capture) */ }
  }
  for (const [node, mode] of [[el.gMove, 'move'], [el.gA, 'a'], [el.gB, 'b']]) node.addEventListener('pointerdown', (e) => startGrab(mode, e));
  // the footing stones' handles: drag one in or out (across sets W, along the sides sets D). The stone follows the finger
  // where the ground is seen well; where it is seen nearly edge on (the depth, from the front: a foot of it is a few
  // pixels on a phone), the finger moves it at most STONE_PX pixels per foot, so the half foot can be set by hand.
  el.stoneHandles.forEach((node, c) => node.addEventListener('pointerdown', (e) => {
    if (app.phase !== 'build' || !app.stonesOpen()) return;
    e.preventDefault(); e.stopPropagation(); sound.audioOn();
    // (a nudge too small to reach the next half foot is kept, so a few small nudges add up)
    const t = T(), rest = stoneRest && stoneRest.W === t.W && stoneRest.D === t.D ? stoneRest : null;
    gesture = { kind: 'stone', corner: c, id: e.pointerId, lx: e.clientX, ly: e.clientY, w: rest ? rest.w : t.W, d: rest ? rest.d : t.D };
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
      // on (or near) the held board: slide it, or push it in and out when it is seen end on (a tap on its overhang, or
      // on the overhang's tag, saws that off instead)
      const cut = !h.endOn && overhangAt(e.clientX, e.clientY, heldAt(h), heldOverhang());
      if (cut || pxFromHeld(h, e.clientX, e.clientY) < (h.endOn ? 34 : 26)) { startGrab('move', e, { cut, body: true }); return; }
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
      const h = app.held; if (!h) return;
      if (!gesture.moved && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) < 6) return;
      if (gesture.mode === 'inout') {
        const hit = app.toWorld(gesture.cross, e.clientX, e.clientY); if (!hit) return;
        gesture.moved = true; h.fresh = false;
        snapInOut(h, snapOffset(h.key[0], across(h.key, hit) + gesture.o0), hit.Y + gesture.y0);
        edgeWatch(e.clientY); app.dirty = true; return;
      }
      const p = app.toPlane(h.key, e.clientX, e.clientY); if (!p) return;
      gesture.moved = true; h.fresh = false;
      if (gesture.mode !== 'move' && !gesture.pivoted) { gesture.pivoted = true; snapPivot(h, gesture.mode === 'a' ? 'b' : 'a'); }
      if (gesture.mode === 'move') { snapMove(h, p.x + gesture.ox, p.y + gesture.oy); edgeWatch(e.clientY); }
      else { snapSwing(h, gesture.mode === 'a' ? 'b' : 'a', p.x, p.y); h.ghost = false; const r = el.view.getBoundingClientRect(), fy = (e.clientY - r.top) / r.height; app.autoScroll = fy < 0.1 ? 1 : fy > 0.92 ? -1 : 0; }
      app.dirty = true;
    } else if (gesture.kind === 'stone') {
      stoneStep(gesture, e.clientX - gesture.lx, e.clientY - gesture.ly); gesture.lx = e.clientX; gesture.ly = e.clientY;
      const w = clamp(snapTo(gesture.w), MIN_W, MAX_W), d = clamp(snapTo(gesture.d), MIN_W, MAX_W);
      if (w !== T().W || d !== T().D) app.setBase(w, d, true);
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
      // a tap: on an overhang (or the round handle at its end) saws it off; on the middle turns the board. (Only a quick
      // one: a press held longer is a small nudge, too small to move the board off its half foot, and does nothing.)
      if (now() - g.t0 > TAP_MS) { app.dirty = true; return; }
      const endCut = g.mode !== 'move' && g.mode !== 'inout' && heldOverhang().find((o) => o.end === g.mode);
      if (g.cut || endCut) cutHeld(g.cut || endCut);
      else if (g.mode === 'move' || g.mode === 'inout') turnHeld();
    } else if (g.kind === 'grab' && (g.mode === 'move' || g.mode === 'inout') && e.type === 'pointerup') {
      // carried off the view (onto the lumber panel): back to the pile
      const r = el.view.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) putBack();
    } else if (g.kind === 'stone') {
      stoneRest = { W: T().W, D: T().D, w: g.w, d: g.d };
      el.stoneHandles[g.corner].classList.remove('is-active'); app.onStonesSet && app.onStonesSet();
    } else if (g.kind === 'orbit') {
      app.orbitRelease(now() - g.lt < 80 ? g.vx : 0);
    } else if (g.kind === 'pending' && e.type === 'pointerup' && now() - g.t < 700) tapAt(e.clientX, e.clientY);
    app.dirty = true;
  };
  el.view.addEventListener('pointerup', endPointer); el.view.addEventListener('pointercancel', endPointer);
  // A stone moved by (dx, dy) pixels: how far its corner goes out along the ground each way. On the screen a foot out
  // across (X) and a foot out along the sides (Z) are two arrows from the stone; the finger's move is split between them
  // (each way: its part across the other arrow, over that arrow's own length across it), each length at least STONE_PX,
  // so a way seen nearly edge on is slowed to STONE_PX pixels per foot. The base is the stones' distance apart: twice
  // the corner's way out. (g.w, g.d: the base, before it is rounded to the half foot.)
  const STONE_PX = 40;
  let stoneRest = null;                // where the last stone drag left the base before rounding: { W, D (as set), w, d }
  function stoneStep(g, dx, dy) {
    const sx = g.corner === 1 || g.corner === 2 ? 1 : -1, sz = g.corner === 0 || g.corner === 1 ? 1 : -1;
    const X = sx * g.w / 2, Z = sz * g.d / 2, P = app.worldToScreen(X, 0, Z), PX = app.worldToScreen(X + sx, 0, Z), PZ = app.worldToScreen(X, 0, Z + sz);
    if (P.behind || PX.behind || PZ.behind) return;
    const aX = [PX.x - P.x, PX.y - P.y], aZ = [PZ.x - P.x, PZ.y - P.y];
    const perp = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [-a[1] / l, a[0] / l]; };
    const way = (a, other) => {
      const n = perp(other), k = a[0] * n[0] + a[1] * n[1], f = dx * n[0] + dy * n[1];
      return f / (Math.sign(k || 1) * Math.max(Math.abs(k), STONE_PX));
    };
    g.w = clamp(g.w + 2 * way(aX, aZ), MIN_W, MAX_W); g.d = clamp(g.d + 2 * way(aZ, aX), MIN_W, MAX_W);
  }
  el.view.addEventListener('wheel', (e) => { e.preventDefault(); app.setZoom(app.zoom * Math.exp(e.deltaY * 0.0012)); }, { passive: false });

  // a tap with nothing in hand: the selected board's overhang (saw it off), else whatever is under it (main.js decides:
  // a twin is built, a board is picked out). A tap hard on the heels of the one that picked the board out, or the
  // second tap of a double tap on a twin, is never a saw cut: it was meant as a double tap.
  function tapAt(cx, cy) {
    if (app.phase !== 'build') return;
    if (app.selected && !app.held && now() - selectTapAt > 500 && !(app.twinDoubleTap && app.twinDoubleTap(cx, cy))) {
      const n = nailedOverhang(app.selected);
      const o = n && overhangAt(cx, cy, (t) => boardScreen(n.board, t), n.list);
      if (o) { cutNailed(app.selected, o); return; }
    }
    const was = app.selected;
    app.tapAt(cx, cy);
    if (app.selected && app.selected !== was) selectTapAt = now();
  }

  // turn the held board a step round its middle: upright, 45, level, 135. (The first tap on a piece just brought onto
  // the tower stands it straight up, whatever way it came: a post for a tier arrives level, away from the stones.)
  function turnHeld() {
    const h = app.held; if (!h) return;
    const steps = [90, 45, 0, 135], cur = ((Math.round(h.ang / DEG) % 180) + 180) % 180;
    let i = steps.findIndex((s) => Math.abs(s - cur) < 3); i = (i + 1) % steps.length;
    if (!h.turned && cur !== 90) i = 0;
    h.turned = true;
    const mx = h.x + Math.cos(h.ang) * h.len / 2, my = h.y + Math.sin(h.ang) * h.len / 2;
    h.ang = steps[i] * DEG; snapMove(h, mx - Math.cos(h.ang) * h.len / 2, my - Math.sin(h.ang) * h.len / 2); h.fresh = false; app.dirty = true;
    sound.clatter(h.len * 0.6, 'set', undefined, 0.35);
  }

  // a brace (not level, not upright, not a knee brace: on a narrow plane a short brace reaching post to post counts)
  // that closes no triangle on its plane, with an end stopping close to a joint but not on it: [{ x, y }] the contact
  // at that end (the quick drop that leaves a brace's foot half a foot off the corner, nailed to the post a little way up)
  function cornerMiss(h, cs) {
    const s = segOf(h), a = Math.abs(Math.atan2(s.by - s.ay, s.bx - s.ax)) * 180 / Math.PI, lean = Math.min(a, 180 - a);
    const ctx = context(h.key);
    if (lean < 5 || lean > 85 || isKnee(s, wallSpan(T(), h.key, s)) || cs.length < 2) return [];
    if (trianglesOf([...ctx.segs, ...floorsAcross(T(), h.key), s], '__held').length) return [];
    const dx = (s.bx - s.ax) / s.len, dy = (s.by - s.ay) / s.len, along = (c) => (c.x - s.ax) * dx + (c.y - s.ay) * dy;
    const sorted = [...cs].sort((p, q) => along(p) - along(q)), joints = jointsHere(ctx), out = [];
    for (const c of [sorted[0], sorted[sorted.length - 1]]) {
      let d = Infinity; for (const j of joints) d = Math.min(d, Math.hypot(j.x - c.x, j.y - c.y));
      if (d > 0.15 && d < 1.25 && !out.includes(c)) out.push(c);
    }
    return out;
  }

  // ── the joints just nailed flash green ───────────────────────────────────────────────────────────────────────────
  let flashes = [];      // [{ X, Y, Z, t0 }]
  function flash(points) { const t0 = now(); flashes.push(...points.map((p) => ({ X: p.X, Y: p.Y, Z: p.Z, t0 }))); }

  // ── drawing over the view: handles, the length, the angles, the nails, overhangs, the stones' tape ───────────────
  const place = (n, p) => { n.style.transform = `translate(${p.x}px, ${p.y}px)`; };
  // labels over the view that keep clear of each other (and of the handles): each tries its spots in turn and takes
  // the first free one, else the first one pulled inside the view (or, for a label that can be spared, none: null).
  // -> place(w, h, spots, spare) -> the centre used
  function tagPlacer(r, avoid = []) {
    const taken = [...avoid];
    const free = (b) => b.x > 2 && b.x + b.w < r.width - 2 && b.y > 56 && b.y + b.h < r.height - 2
      && !taken.some((t) => b.x < t.x + t.w && b.x + b.w > t.x && b.y < t.y + t.h && b.y + b.h > t.y);
    return (w, h, spots, spare = false) => {
      let c = spots.find((q) => free({ x: q.x - w / 2, y: q.y - h / 2, w, h }));
      if (!c && spare) return null;
      if (!c) c = { x: clamp(spots[0].x, w / 2 + 4, r.width - w / 2 - 4), y: clamp(spots[0].y, 58 + h / 2, r.height - h / 2 - 4) };
      taken.push({ x: c.x - w / 2, y: c.y - h / 2, w, h });
      return c;
    };
  }
  const box = (q, size) => ({ x: q.x - size / 2, y: q.y - size / 2, w: size, h: size });
  // an overhang: pale, with the saw line where it comes off, and how much (its label placed by `place`). at(t): a point
  // along the board on the screen
  function drawOverhang(at, list, place) {
    let out = '';
    if (!place) place = tagPlacer(el.view.getBoundingClientRect());
    for (const o of list) {
      const A = at(o.t0), B = at(o.t1), J = o.end === 'a' ? B : A, M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      const ux = B.x - A.x, uy = B.y - A.y, ul = Math.hypot(ux, uy) || 1, nx = -uy / ul, ny = ux / ul;
      out += `<line class="over" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/>`;
      out += `<line class="sawline" x1="${J.x - nx * 15}" y1="${J.y - ny * 15}" x2="${J.x + nx * 15}" y2="${J.y + ny * 15}"/>`;
      const c = place(96, 24, [-28, 28, -52, 52, -76, 76].map((d) => ({ x: M.x + nx * d, y: M.y + ny * d }))), txt = '✂ saw off ' + fmt(o.t1 - o.t0);
      out += `<g class="overtag"><rect x="${c.x - 48}" y="${c.y - 12}" width="96" height="24" rx="12"/><text x="${c.x}" y="${c.y + 4}">${txt}</text></g>`;
      overTags.push({ end: o.end, x: c.x - 48, y: c.y - 12, w: 96, h: 24 });
    }
    return out;
  }
  // the held board's state this frame, for main.js (its ends' green glow, the plane sheet)
  let heldInfo = null;
  let hintText = '', planeText = '';
  function frame() {
    const h = app.held, svg = el.overlay, building = app.phase === 'build', t = T();
    if (h && building) updateView(h);
    const show = !!h && building;
    el.gMove.hidden = !show; el.gA.hidden = el.gB.hidden = !show || h.endOn;
    el.nailBtn.hidden = !show; el.view.classList.toggle('is-holding', show); el.view.classList.toggle('is-endon', show && h.endOn);
    if (!show) el.view.classList.remove('is-short');
    let out = '', hint = '';
    overTags = []; heldInfo = null;
    // the footing stones (until the first board is nailed): a handle on each, and a tape along the two near sides
    const stones = building && app.stonesOpen() && !h;
    const corner = (c) => [[-t.W / 2, t.D / 2], [t.W / 2, t.D / 2], [t.W / 2, -t.D / 2], [-t.W / 2, -t.D / 2]][c];
    el.stoneHandles.forEach((n, c) => { n.hidden = !stones; if (stones) { const [X, Z] = corner(c); place(n, app.worldToScreen(X, 0.2, Z)); } });
    if (stones) {
      // the wall facing you, and the side round the corner nearest the view
      const k = app.face, az = app.viewAz(), side = Math.sin(az - [0, Math.PI / 2, Math.PI, -Math.PI / 2][k]) > 0 ? (k + 1) % 4 : (k + 3) % 4;
      for (const f of [k, side]) {
        const [X0, Z0] = corner(f), [X1, Z1] = corner((f + 1) % 4), n = [[0, 1], [1, 0], [0, -1], [-1, 0]][f], off = 1.4;
        const A = app.worldToScreen(X0 + n[0] * off, 0.05, Z0 + n[1] * off), B = app.worldToScreen(X1 + n[0] * off, 0.05, Z1 + n[1] * off);
        const a0 = app.worldToScreen(X0, 0.05, Z0), b0 = app.worldToScreen(X1, 0.05, Z1);
        if (A.behind || B.behind) continue;
        out += `<line class="tapeleg" x1="${a0.x}" y1="${a0.y}" x2="${A.x}" y2="${A.y}"/><line class="tapeleg" x1="${b0.x}" y1="${b0.y}" x2="${B.x}" y2="${B.y}"/>`;
        out += `<line class="tape" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/>`;
        const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 + (f === k ? 22 : 0) }, wide = f % 2 ? t.D : t.W;
        out += `<g class="tapetag${f === k ? '' : ' is-side'}"><rect x="${M.x - 34}" y="${M.y - 13}" width="68" height="25" rx="7"/><text x="${M.x}" y="${M.y + 5}">${fmt(wide)}</text></g>`;
      }
      hint = `Base ${fmtBase(t.W, t.D)}. Drag a stone in or out to set it`;
    }
    if (show) {
      const s = segOf(h), r = el.view.getBoundingClientRect();
      const A = heldScreen(h, s.ax, s.ay), B = heldScreen(h, s.bx, s.by), M = heldScreen(h, (s.ax + s.bx) / 2, (s.ay + s.by) / 2);
      // (a long board on a narrow screen: the view backs off until both its ends are in sight, once nothing is being
      // dragged; and the handles always stay inside the view)
      if (!gesture && !carrying && app.fitHeld && !h.endOn) app.fitHeld(A, B, r);
      const inView = (q, m = 18) => ({ x: clamp(q.x, m, r.width - m), y: clamp(q.y, 58, r.height - m) });
      const cs = contactsOf(h), over = h.endOn ? [] : heldOverhang(), miss = h.endOn ? [] : cornerMiss(h, cs), loose = nearMisses(h, cs);
      // the nail button beside the board, on whichever side has room (seen end on: to its right)
      const inside = (q) => q.x > 28 && q.x < r.width - 28 && q.y > 70 && q.y < r.height - 28;
      let nx = -(B.y - A.y), ny = B.x - A.x; const nl = Math.hypot(nx, ny); if (nl < 8) { nx = -1; ny = 0; } else { nx /= nl; ny /= nl; }
      if (!inside({ x: M.x - nx * 64, y: M.y - ny * 64 }) && inside({ x: M.x + nx * 64, y: M.y + ny * 64 })) { nx = -nx; ny = -ny; }
      const nailAt = { x: clamp(M.x - nx * 64, 28, r.width - 28), y: clamp(M.y - ny * 64, 70, r.height - 28) };
      place(el.nailBtn, nailAt);
      // a short piece on the screen (a 2 ft crosspiece on a phone) would hide under its handles: its end handles become
      // open rings round its ends, and the slide handle steps off it to the side away from the check
      const short = !h.endOn && nl < 110;
      el.view.classList.toggle('is-short', short);
      const moveAt = inView(short ? { x: M.x + nx * 34, y: M.y + ny * 34 } : M, 22);
      place(el.gMove, moveAt); place(el.gA, inView(A)); place(el.gB, inView(B));
      // (every label from here on keeps clear of the others, the check and the handles)
      const tag = tagPlacer(r, [box(nailAt, 54), box(moveAt, 42), ...(h.endOn ? [] : [box(inView(A), 34), box(inView(B), 34)])]);
      let tags = '', rings = '';
      // the joints it will make: a bold green circle at each, and the angle where it meets a board on its own plane
      // (one angle per joint: where it meets a post and a crosspiece at once, the crosspiece's, as a carpenter reads
      // a brace; and none at all rather than one sitting on a handle)
      const spots = [];
      for (const c of cs) {
        const o = spots.find((q) => Math.hypot(q.x - c.x, q.y - c.y) < 0.35);
        const level = c.seg && Math.abs(c.seg.ay - c.seg.by) < 0.05 * (c.seg.len || 1);
        if (!o) spots.push({ ...c, level });
        else { if (c.end) o.end = c.end; if (c.angle !== null && (o.angle === null || (level && !o.level))) Object.assign(o, { seg: c.seg, angle: c.angle, level }); }
      }
      for (const c of spots) {
        const P = heldScreen(h, c.x, c.y);
        if (c.seg && c.angle !== null && !h.endOn) {
          // the arc between the held board and the other one, on the side the held board actually runs
          const far = Math.hypot(s.ax - c.x, s.ay - c.y) > Math.hypot(s.bx - c.x, s.by - c.y) ? A : B;
          const u1 = Math.atan2(far.y - P.y, far.x - P.x);
          const O1 = heldScreen(h, c.seg.ax, c.seg.ay), O2 = heldScreen(h, c.seg.bx, c.seg.by);
          let u2 = Math.atan2(O2.y - O1.y, O2.x - O1.x);
          if (Math.abs(angDiff(u2, u1)) > Math.PI / 2) u2 += Math.PI;
          const rr = 26, sweep = angDiff(u2, u1) > 0 ? 1 : 0;
          const x1 = P.x + Math.cos(u1) * rr, y1 = P.y + Math.sin(u1) * rr, x2 = P.x + Math.cos(u2) * rr, y2 = P.y + Math.sin(u2) * rr;
          const mid = u1 + angDiff(u2, u1) / 2;
          const square = Math.abs(c.angle - 90) < 0.5;
          if (square) {
            const q = 14, ax = Math.cos(u1) * q, ay = Math.sin(u1) * q, bx = Math.cos(u2) * q, by = Math.sin(u2) * q;
            out += `<path class="arc sq" d="M${P.x + ax} ${P.y + ay} L${P.x + ax + bx} ${P.y + ay + by} L${P.x + bx} ${P.y + by}"/>`;
          } else if (c.angle > 0.5) out += `<path class="arc" d="M${x1} ${y1} A${rr} ${rr} 0 0 ${sweep} ${x2} ${y2}"/>`;
          const tt = c.angle > 0.5 && tag(42, 21, [44, 62, 82].map((d) => ({ x: P.x + Math.cos(mid) * d, y: P.y + Math.sin(mid) * d })), true);
          if (tt) tags += `<g class="ang${square ? ' is-square' : ''}"><rect x="${tt.x - 21}" y="${tt.y - 11}" width="42" height="21" rx="5"/><text x="${tt.x}" y="${tt.y + 4}">${Math.round(c.angle)}°</text></g>`;
        }
        // (at an end the round handle sits on the spot: the ring goes round it, and the handle itself turns green)
        rings += `<circle class="joint${c.end && !h.endOn ? ' is-end' : ''}" cx="${P.x}" cy="${P.y}" r="${c.end && !h.endOn ? (short ? 17 : 22) : 12}"/>`;
      }
      // an end close to a board but not on it: an open red ring, "not touching"
      for (const m of loose) {
        const P = heldScreen(h, m.x, m.y);
        rings += `<circle class="miss" cx="${P.x}" cy="${P.y}" r="15"/>`;
        const tt = tag(100, 21, [[0, -30], [0, 30], [62, 0], [-62, 0]].map(([dx, dy]) => ({ x: P.x + dx, y: P.y + dy })));
        tags += `<g class="misstag"><rect x="${tt.x - 50}" y="${tt.y - 11}" width="100" height="21" rx="10"/><text x="${tt.x}" y="${tt.y + 4}">not touching</text></g>`;
      }
      // a brace whose end stops near a corner without sitting on it makes no triangle there, so the wall can still
      // fold: a red ring on that end, its words a little way in along the board
      for (const m of miss) {
        const P = heldScreen(h, m.x, m.y);
        rings += `<circle class="miss" cx="${P.x}" cy="${P.y}" r="15"/>`;
        let tx = M.x - P.x, ty = M.y - P.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let px = -ty, py = tx; if (py < 0) { px = -px; py = -py; }
        const spots = [[110, 28], [110, -28], [60, 44], [60, -44], [0, 40], [0, -40]].map(([a, b]) => ({ x: P.x + tx * Math.min(a, tl * 0.8) + px * b, y: P.y + ty * Math.min(a, tl * 0.8) + py * b }));
        const tt = tag(112, 21, spots);
        tags += `<g class="misstag"><rect x="${tt.x - 56}" y="${tt.y - 11}" width="112" height="21" rx="10"/><text x="${tt.x}" y="${tt.y + 4}">not on a corner</text></g>`;
      }
      // the overhang, pale, with the saw line where it would come off
      out += drawOverhang(heldAt(h), over, tag);
      out += rings;
      // the length, beside the board on the side away from the check
      {
        const ul = Math.hypot(B.x - A.x, B.y - A.y) || 1, tx = (B.x - A.x) / ul, ty = (B.y - A.y) / ul;
        const tt = tag(68, 24, [[40, 0], [68, 0], [40, 55], [40, -55], [96, 0], [-40, 55], [-40, -55], [68, 90], [68, -90]].map(([n, a]) => ({ x: M.x + nx * n + tx * a, y: M.y + ny * n + ty * a })));
        tags += `<g class="len"><rect x="${tt.x - 34}" y="${tt.y - 13}" width="68" height="24" rx="6"/><text x="${tt.x}" y="${tt.y + 4}">${fmt(h.len)}</text></g>`;
      }
      // seen end on: which plane it is on, right by it ("1½ ft in from the front")
      planeText = planeName(t, h.key, true);
      // (never over the check or a handle: if there is no free spot by it, the name in the chip at the top says it)
      if (h.endOn) {
        const w = Math.max(96, planeText.length * 7.4 + 22);
        const tt = tag(w, 24, [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 1.7], [0, -1.7], [0, 2.4], [0, -2.4]].map(([a, b]) => ({ x: M.x + a * (w / 2 + 30), y: M.y + b * 52 })), true);
        if (tt) tags += `<g class="planetag"><rect x="${tt.x - w / 2}" y="${tt.y - 12}" width="${w}" height="24" rx="12"/><text x="${tt.x}" y="${tt.y + 5}">${planeText}</text></g>`;
      }
      out += tags;
      const ok = cs.length > 0;
      el.nailBtn.disabled = !ok;
      hint = h.endOn ? (ok ? 'Seen end on: drag it in or out · ✓ to nail it' : 'Seen end on: drag it in or out, onto a board')
        : !ok ? 'Touch it to a board or the ground to nail it'
        : miss.length ? 'Slide or swing its end onto the corner, so it makes a triangle'
        : over.length ? 'Tap ✂ saw off (or the pale end) to cut it at the joint, or ✓ to nail it'
        : h.ghost ? 'Lined up with its twin: ✓ to nail it'
        : 'Tap ✓ to nail it · turn a quarter to push it in or out';
      heldInfo = { glowA: cs.some((c) => c.end === 'a'), glowB: cs.some((c) => c.end === 'b'), endOn: h.endOn };
      el.gA.classList.toggle('is-touching', heldInfo.glowA); el.gB.classList.toggle('is-touching', heldInfo.glowB);
      el.gMove.classList.toggle('is-touching', h.endOn && ok);
    } else if (building && app.selected) {
      const n = nailedOverhang(app.selected);
      if (n && n.list.length) { out += drawOverhang((tt) => boardScreen(n.board, tt), n.list); hint = 'Tap ✂ saw off (or the pale end) to cut it off'; }
    }
    if (!show) planeText = '';
    // the joints just nailed: a green ring that swells and fades
    if (flashes.length) {
      const tn = now(); flashes = flashes.filter((f) => tn - f.t0 < 900);
      for (const f of flashes) {
        const k = (tn - f.t0) / 900, P = app.worldToScreen(f.X, f.Y, f.Z); if (P.behind) continue;
        out += `<circle class="flash" cx="${P.x}" cy="${P.y}" r="${10 + k * 22}" style="opacity:${(1 - k).toFixed(2)}"/>`;
      }
    }
    // the twins with no wood or no room: say why, small, by their middle (each tag clear of the others). A lit twin seen
    // end on (only a dot on the screen, sitting on whatever is in front of it) gets a bold gold ring where it is, so it
    // can be seen and tapped (main.js gives it any tap within a fingertip of it).
    if (building && !h) {
      const r = el.view.getBoundingClientRect(), tag = tagPlacer(r);
      for (const g of app.ghostList()) {
        if (!g.ok) continue;
        const A = app.worldToScreen(g.a.X, g.a.Y, g.a.Z), B = app.worldToScreen(g.b.X, g.b.Y, g.b.Z);
        if (A.behind || B.behind || Math.hypot(B.x - A.x, B.y - A.y) > 26) continue;
        out += `<circle class="twinend" cx="${(A.x + B.x) / 2}" cy="${(A.y + B.y) / 2}" r="13"/>`;
      }
      for (const g of app.ghostList()) {
        if (g.ok || !g.reason) continue;
        const P = app.worldToScreen((g.a.X + g.b.X) / 2, (g.a.Y + g.b.Y) / 2, (g.a.Z + g.b.Z) / 2);
        if (P.behind || P.x < 40 || P.x > r.width - 40 || P.y < 60 || P.y > r.height - 10) continue;
        const c = tag(108, 19, [[0, 0], [0, -24], [0, 24], [0, -48], [0, 48], [-70, 0], [70, 0]].map(([dx, dy]) => ({ x: P.x + dx, y: P.y + dy })));
        out += `<g class="ghosttag"><rect x="${c.x - 54}" y="${c.y - 10}" width="108" height="19" rx="9"/><text x="${c.x}" y="${c.y + 4}">${g.reason}</text></g>`;
      }
    }
    svg.innerHTML = out;
    if (!hint && building) hint = app.idleHint ? app.idleHint() : '';
    if (hint !== hintText) { hintText = hint; el.hint.textContent = hint; }
  }

  return { freshStack, renderPanel, frame, putBack, returnPiece, contactsOf, cut, takeUp, snapMove, snapSwing, snapInOut, snapOffset, toBench, turnHeld, payFor, woodFor, addOffcut,
    heldOverhang, cutHeld, nailedOverhang, cutNailed, fullCount, giveBoard, cornerMiss, jointsHere, context, worldOf, flash, groups,
    get heldInfo() { return heldInfo; }, get planeText() { return planeText; }, get cutAt() { return cutAt; }, set cutAt(v) { cutAt = v; renderPanel(); } };
}
