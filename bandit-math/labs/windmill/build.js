// BUILDING: the lumber panel on the left (the fresh stack on the bench with its tape measure and saw, the cut pieces
// waiting, grouped by length) and everything a finger or the mouse does on the view:
//   * the footing stones (the first step, before any board is nailed): drag one in or out to set the base, half a foot
//     to 8 feet each way, by the half foot. Its distance across (X) sets the width W, its distance along the sides (Z)
//     the depth D, so a stone dragged straight out to the side widens the tower and one dragged toward you deepens it
//   * a piece dragged from the panel onto the view puts its first end in a SOCKET: the socket nearest the finger on the
//     screen (a point on the half foot on the ground within the stones, or along a board at half-foot steps from either
//     of its ends: tower.js socketsOf). It stands straight up from there to start with. The socket end has a gold ring:
//     drag it to another socket (the board keeps how far over its free end stands).
//   * its FREE END has an open ring: drag it and the board turns about its socket in the plane facing the view, its
//     length kept, the end on the half foot over the ground from the socket. As soon as the board can reach another
//     board near where the finger takes the end (its line passing through that board within its length), it CONNECTS:
//     the ring turns green and the board lies right through that spot (the joint, a green circle). A board too long for
//     that spot sticks out past the joint (drawn pale, with the saw line) and stays green while the end slides on along
//     the board it is over; a board too short to reach a board never connects there.
//   * four ARROWS, drawn lying on the ground's directions in the upper part of the view (so they turn as the view walks
//     round): the green pair moves the free end half a foot across X (right and left), the blue pair half a foot along Z
//     (front and back); its height follows from the board's length. An arrow that lands the board on another board
//     connects it there, as a drag does.
//   * ✓ (fixed at the bottom right) nails it. A board sticking out past its joint by any amount then offers "Saw off the
//     extra": the offcut goes back to the pile rounded DOWN to the half foot (under half a foot: kindling). Or keep it.
//     Carry the board back onto the panel (or Undo) to put it back on the pile.
//   * anywhere else: drag to walk round the tower (sideways) and climb it (up and down); two fingers or the wheel zoom.
//     The camera is free whether or not a board is held: nothing here squares or swings the view. A tap picks a glowing
//     twin (builds it: main.js takes any twin within a fingertip of the tap) or a nailed board (to take it down, or saw
//     its overhang off).
// A finger on the cut pieces: straight up and down scrolls the panel; any other way, or onto the view, lifts the piece.
import { SNAP, BOARD_FT, MIN_W, MAX_W, inFootprint, spotTaken, lenLabel, lenWords, leanRate, socketsOf, freeEnd, reachOn, connectTo, connectAlong, offcutOf, along as alongB, isPost } from './tower.js';
import { touch3, contactsOf as contactsIn3D, pointGap, TOL } from './touch.js';
import * as sound from './sound.js';

const DEG = Math.PI / 180;
const snapTo = (v, s = SNAP) => Math.round(v / s) * s;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// lengths the way a carpenter writes them on a label: whole feet "4 ft", halves "4½ ft", anything else (a board sawn
// off at a joint) to the nearest inch, "4 ft 3 in." (the period: a bare "in" doesn't read as inches); the same length
// said in a sentence, the units spelled out: "4 feet", "4½ feet", "1 foot 7 inches", "7 inches" (tower.js's own words,
// so a wording change is made in one place)
export const fmt = lenLabel, fmtWords = lenWords;
// a length for the stats bar, as HTML, its units small so a height like 25 ft 10 in. fits a phone's bar
export const fmtStat = (ft) => fmt(ft).replace(/ ?(ft|in\.)/g, '<span class="u">$1</span>');
// where a point is from the middle of the base, to the nearest inch, in words for the top bar: "1 ft left · 1 ft front ·
// 7 ft 9 in. up" (the right and front as seen from the front of the tower; "0" on the middle line). The same numbers
// with the opposite words are the mirror image. -> [across, front/back, up] as label text
// (each size rounded, not the signed value: Math.round takes -2 ft 4½ in. to -2 ft 4 in. but +2 ft 4½ in. to 2 ft 5 in.,
// and a mirror image must read the same numbers)
export function whereWords(p) {
  const r = (v) => Math.sign(v) * Math.round(Math.abs(v) * 12) / 12, side = (v, pos, neg) => (Math.abs(r(v)) < 1e-9 ? '0' : fmt(Math.abs(r(v))) + ' ' + (v > 0 ? pos : neg));
  return [side(p.X, 'right', 'left'), side(p.Z, 'front', 'back'), fmt(Math.max(0, r(p.Y))) + ' up'];
}
// a rate in words: "2½ inches in for every foot up" (k: inches a foot; dir: 'in', 'out', ...)
export const rateWords = leanRate;
// the base in words: "6 ft × 4 ft" (short: "6 × 4 ft")
const num = (v) => { const f = Math.floor(v + 1e-6); return Math.abs(v - f - 0.5) < 1e-6 ? (f || '') + '½' : String(Math.round(v * 10) / 10); };
export const fmtBase = (W, D, short = false) => (short ? `${num(W)} × ${num(D)} ft` : `${fmt(W)} × ${fmt(D)}`);
const SCRAP = 0.5;      // an offcut shorter than this is kindling, not lumber
const CONNECT_PX = 38, KEEP_PX = 56;    // pixels: a free end this near where it would connect connects (stays: KEEP_PX)
const SOCKET_PX = 60;   // pixels: a socket this near the finger takes the board's first end
const STONE_PULL = 0.35; // feet: a footing stone's spot counts this much nearer the finger than it is (socketAt)
const START_REACH = 160;    // pixels: a piece carried this far onto the view leaves its start spot and follows the finger

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
  // "Put it up": the board on the bench (a fresh one, or a piece put there to cut) goes straight up where the builder
  // left off (startSpot), with no carry: one tap per board when building on up. Shown only when there is such a spot.
  function upNext() {
    if (app.phase !== 'build' || app.held || !L.bench || !startSpot(L.bench.len)) return;
    const p = takeUp({ len: L.bench.len, pick: () => L.bench }, true); if (!p || !app.held) return;
    app.held.fresh = false; upUsed++;
    app.dirty = true;
  }
  if (el.upNext) el.upNext.addEventListener('click', () => { sound.audioOn(); upNext(); });
  // (whether it shows: worked out again only when something it depends on changes)
  let upKey = '', upUsed = 0;
  function showUpNext(building) {
    if (!el.upNext) return;
    const Lh = app.lastHand, k = [building, !!app.held, L.bench ? L.bench.len : 0, Lh ? Lh.id : '', T().boards.length, Lh && T().boards.includes(Lh), app.face].join('|');
    if (k === upKey) return; upKey = k;
    el.upNext.hidden = !(building && !app.held && L.bench && startSpot(L.bench.len));
  }
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
        else if (app.held) {
          // (let go on the view: it stays on the plane it was put on; the view stays where the builder left it)
          app.held.fresh = false;
        }
        app.dirty = true;
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
  }
  wireDrag(el.benchBoard, { get len() { return L.bench ? L.bench.len : 0; }, pick: () => L.bench }, true);


  // lift a piece off the panel into the builder's hands: its first end in the socket nearest the finger (or where the
  // builder left off), straight up
  function takeUp(src, fromBench) {
    const p = src.pick(); if (!p) return null;          // (spent on a twin meanwhile)
    if (app.held) putBack();
    if (fromBench) nextBench();
    else L.pieces = L.pieces.filter((q) => q !== p);
    sound.clatter(p.len, 'pick');
    const spot = startSpot(p.len);
    app.held = { piece: p, len: p.len, A: { X: 0, Y: 0, Z: 0 }, on: null, B: { X: 0, Y: p.len, Z: 0 }, con: null, fresh: true };
    if (spot) Object.assign(app.held, spot, { start: true });
    renderPanel(); app.select(null); app.dirty = true;
    return p;
  }
  // ── where a new board starts: where the builder left off ────────────────────────────────────────────────────────
  // The next board most often builds on the last one nailed by hand (app.lastHand): a piece taken from the lumber (or
  // put up with "Put it up") starts in a socket at that board's top end (a post or a brace: going on up from its top;
  // a horizontal board: at an end with nothing standing on it yet first, then the end nearer the view), standing
  // straight up. Not off the footprint, not where a board already stands. -> { A, on, B } or null
  function startSpot(len) {
    const t = T(), Lh = app.lastHand;
    if (!Lh || !t.boards.includes(Lh)) return null;
    const ends = [{ E: Lh.a, s: 0 }, { E: Lh.b, s: Lh.len }];
    const standing = (E) => t.boards.some((o) => o !== Lh && Math.abs(o.a.Y - o.b.Y) > 0.25 && Math.hypot(...['X', 'Y', 'Z'].map((k) => (o.a.Y <= o.b.Y ? o.a : o.b)[k] - E[k])) < 0.35);
    if (Math.abs(Lh.a.Y - Lh.b.Y) > 0.25) ends.sort((p, q) => q.E.Y - p.E.Y).splice(1);
    else ends.sort((p, q) => (standing(p.E) - standing(q.E)) || ((app.camDist ? app.camDist(p.E) : 0) - (app.camDist ? app.camDist(q.E) : 0)));
    for (const { E } of ends) {
      const A = { X: E.X, Y: E.Y, Z: E.Z }, B = { X: E.X, Y: E.Y + len, Z: E.Z }, g = { a: A, b: B, len };
      if (!inFootprint(t, B) || spotTaken(t, g)) continue;
      // (inside a post going on up from there: no)
      if (t.boards.some((o) => { const cs = touch3(g, o); return cs.length >= 2 && Math.abs(cs[1].ti - cs[0].ti) > 0.3; })) continue;
      return { A, on: Lh, B, con: null };
    }
    return null;
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

  // ── the held board: a socket and a free end ─────────────────────────────────────────────────────────────────────
  // h.A: its socket (world feet), h.on: the board the socket is on (null: the ground), h.B: its free end, h.con: where
  // the free end has connected ({ o, s, P (the joint), past (how far it sticks out past it), b }) or null.
  const worldOf = (h) => ({ id: '__held', a: { ...h.A }, b: { ...h.B }, len: h.len });
  const sub = (p, q) => ({ X: p.X - q.X, Y: p.Y - q.Y, Z: p.Z - q.Z });
  const d3 = (p, q) => Math.hypot(p.X - q.X, p.Y - q.Y, p.Z - q.Z);
  // the boards the socket sits on (a free end never connects back onto them right there)
  const atSocket = (h) => T().boards.filter((o) => pointGap(h.A, o).d < TOL);
  // the sockets, worked out again only when the tower changes
  let sockKey = '', socks = [];
  function sockets() {
    const t = T(), k = t.W + '|' + t.D + '|' + t.boards.map((b) => b.id + ':' + b.len).join(',');
    if (k !== sockKey) { sockKey = k; socks = socketsOf(t); }
    return socks;
  }
  // the socket nearest a screen point (page pixels): within `px` of it (Infinity: the nearest anywhere), a nearer one
  // to the eye winning a near tie. -> socket or null
  // A footing stone's own spot (the ground socket at a corner) pulls: the stone is drawn well over a foot across, so a
  // board dropped on it means the stone, not the dirt half a foot in front of its middle. The corner counts nearer by
  // the size of STONE_PULL feet on the screen there, and wins a near tie with the ground sockets round it (on a phone
  // the half-foot sockets are only a few pixels apart, and the one nearer the eye used to win the tie).
  function socketAt(cx, cy, px = SOCKET_PX) {
    const r = el.view.getBoundingClientRect(), x = cx - r.left, y = cy - r.top, t = T();
    const corner = (s) => !s.on && Math.abs(s.Y) < 1e-6 && Math.abs(Math.abs(s.X) - t.W / 2) < 1e-6 && Math.abs(Math.abs(s.Z) - t.D / 2) < 1e-6;
    let best = null;
    for (const s of sockets()) {
      const P = app.worldToScreen(s.X, s.Y, s.Z); if (P.behind) continue;
      let d = Math.hypot(P.x - x, P.y - y);
      const stone = corner(s);
      if (stone) { const Q = app.worldToScreen(s.X + STONE_PULL, s.Y, s.Z), Q2 = app.worldToScreen(s.X, s.Y, s.Z + STONE_PULL); d = Math.max(0, d - Math.max(Math.hypot(Q.x - P.x, Q.y - P.y), Math.hypot(Q2.x - P.x, Q2.y - P.y))); }
      if (d > px) continue;
      const depth = app.camDist ? app.camDist(s) : 0;
      const tie = best && Math.abs(d - best.d) <= 8;
      const wins = !best || d < best.d - 8 || (tie && (stone && !best.s.on ? true : best.stone && !s.on ? false : depth < best.depth - 0.05));
      if (wins) best = { s, d, depth, stone };
    }
    return best ? best.s : null;
  }
  // how far over its free end stands from its socket, on the half foot (dx across X, dz along Z), and which way it goes
  // (up: 1, down: -1)
  const runOf = (h) => ({ dx: snapTo(h.B.X - h.A.X), dz: snapTo(h.B.Z - h.A.Z), up: h.B.Y >= h.A.Y - 1e-6 ? 1 : -1 });
  // the free end set by its run from the socket (the height from its length); a run too long for it is brought in, by
  // the half foot, until the board reaches. Then, if the board now passes through another board, it connects there.
  function setRun(h, dx, dz, up = 1) {
    let B = null;
    for (let i = 0; i < 40 && !B; i++) {
      B = freeEnd(h.A, h.len, dx, dz, up) || (up < 0 ? freeEnd(h.A, h.len, dx, dz, 1) : null);
      if (!B) { if (Math.abs(dx) >= Math.abs(dz)) dx -= Math.sign(dx) * SNAP; else dz -= Math.sign(dz) * SNAP; }
    }
    h.B = B || { X: h.A.X, Y: h.A.Y + h.len, Z: h.A.Z };
    connectHere(h);
  }
  // does the board as it lies pass through another board? Then it connects there (its line squared onto that spot)
  function connectHere(h) {
    const c = connectAlong(T(), h.A, h.B, h.len, { skip: atSocket(h) });
    h.con = c ? { o: c.o, s: c.s, P: c.P, past: c.past, b: c.b } : null;
    if (c) h.B = c.b;
  }
  // its first end into a socket, its free end keeping how far over it stood
  function placeSocket(h, S) {
    const { dx, dz, up } = runOf(h);
    h.A = { X: S.X, Y: S.Y, Z: S.Z }; h.on = S.on || null;
    setRun(h, dx, dz, up);
  }
  // the four arrows: the free end to the next half foot along X or Z, counted from the tower's middle (so free ends
  // stepped by arrows from different sockets meet: 1 ft, 1½ ft, never 11 in. then 1 ft 5 in.); its height from its
  // length. false when it can't reach.
  const nextHalf = (x, sg) => (sg > 0 ? Math.floor(x / SNAP + 1e-6) + 1 : Math.ceil(x / SNAP - 1e-6) - 1) * SNAP;
  function arrow(ax, sg) {
    const h = app.held; if (!h || app.phase !== 'build') return false;
    // (from where the free end really is, the other way left as it is)
    const before = snapOfHeld(h), { up } = runOf(h), dx = h.B.X - h.A.X, dz = h.B.Z - h.A.Z;
    const nx = ax === 'X' ? nextHalf(h.B.X, sg) - h.A.X : dx, nz = ax === 'Z' ? nextHalf(h.B.Z, sg) - h.A.Z : dz;
    if (!freeEnd(h.A, h.len, nx, nz, up) && !freeEnd(h.A, h.len, nx, nz, 1)) { sound.clatter(h.len * 0.3, 'set', undefined, 0.12); h.tooFar = now(); app.dirty = true; return false; }
    setRun(h, nx, nz, up);
    h.fresh = false; h.start = false; keepHist(before);
    sound.clatter(h.len * 0.4, 'set', undefined, h.con ? 0.35 : 0.18); app.dirty = true;
    return true;
  }
  // Dragging the free end: the board turns about its socket in the upright plane facing the view, following
  // the finger. Where the free end would connect to a board near the finger (its line through that board within its
  // length, the end within CONNECT_PX of the finger on the screen; KEEP_PX to stay on the board it is on), it connects;
  // else it stands on the half foot over the ground from the socket.
  function dragFree(h, cx, cy) {
    const r = el.view.getBoundingClientRect(), fx = cx - r.left, fy = cy - r.top;
    const skip = atSocket(h);
    let best = null;
    for (const o of T().boards) {
      if (skip.includes(o)) continue;
      const span = reachOn(h.A, h.len, o); if (!span) continue;
      const at = (s) => { const c = connectTo(h.A, h.len, o, s); if (!c) return null; const P = app.worldToScreen(c.b.X, c.b.Y, c.b.Z); return P.behind ? null : { s, c, d: Math.hypot(P.x - fx, P.y - fy) }; };
      let b = null;
      const n = Math.max(2, Math.ceil((span[1] - span[0]) / 0.25));
      for (let i = 0; i <= n; i++) { const q = at(span[0] + (span[1] - span[0]) * i / n); if (q && (!b || q.d < b.d)) b = q; }
      if (!b) continue;
      for (let k = -6; k <= 6; k++) { const s = Math.min(span[1], Math.max(span[0], b.s + k / 24)), q = at(s); if (q && q.d < b.d) b = q; }
      const lim = h.con && h.con.o === o ? KEEP_PX : CONNECT_PX;
      if (b.d < lim && (!best || b.d < best.d)) best = { o, span, ...b };
    }
    if (best) {
      // where along that board: right where the board just reaches (no overhang), at the board's end, or to the inch
      let s = Math.round(best.s * 12) / 12;
      for (const e of [best.span[0], best.span[1], 0, d3(best.o.a, best.o.b)]) if (Math.abs(e - best.s) < 2.5 / 12 && e >= best.span[0] - 1e-9 && e <= best.span[1] + 1e-9) { s = e; break; }
      const c = connectTo(h.A, h.len, best.o, s) || best.c;
      const was = h.con && h.con.o === best.o;
      h.B = c.b; h.con = { o: best.o, s, P: c.P, past: c.past, b: c.b };
      if (!was) sound.clatter(h.len * 0.5, 'set', undefined, 0.35);
      return;
    }
    // free: the finger's spot on the upright plane facing the view through the socket, the board pointing there
    const ray = app.rayAt(cx, cy), f0 = app.viewDir(); if (!ray) return;
    const fl = Math.hypot(f0.X, f0.Z) || 1, f = { X: f0.X / fl, Y: 0, Z: f0.Z / fl };
    const den = ray.d.X * f.X + ray.d.Y * f.Y + ray.d.Z * f.Z; if (Math.abs(den) < 1e-6) return;
    const t = ((h.A.X - ray.O.X) * f.X + (h.A.Y - ray.O.Y) * f.Y + (h.A.Z - ray.O.Z) * f.Z) / den;
    const Q = { X: ray.O.X + ray.d.X * t, Y: ray.O.Y + ray.d.Y * t, Z: ray.O.Z + ray.d.Z * t }, v = sub(Q, h.A), l = Math.hypot(v.X, v.Y, v.Z) || 1;
    h.con = null;
    setRun(h, snapTo(v.X / l * h.len), snapTo(v.Z / l * h.len), v.Y >= -0.05 * l ? 1 : -1);
    // (a run that lands it right through a board connects it there: setRun; it is not the board near the finger, so
    // only when it truly passes through)
  }
  // a freshly dragged-in board under the pointer: its socket the one nearest the finger, standing straight up
  function placeAtPointer(cx, cy, fresh) {
    const h = app.held; if (!h) return;
    if (fresh && h.fresh) {
      // (a board starting where the builder left off stays there while the finger is still near where it came onto the
      // view; carried on further, it goes where the finger takes it, as always)
      if (h.start && !h.left) {
        const r = el.view.getBoundingClientRect();
        if (!h.entry) h.entry = { x: cx, y: cy };
        if (Math.hypot(cx - h.entry.x, cy - h.entry.y) < Math.max(70, Math.min(0.3 * r.width, START_REACH))) { app.dirty = true; return; }
        h.left = true; h.start = false;
      }
      const S = socketAt(cx, cy, Infinity);
      if (S) { h.A = { X: S.X, Y: S.Y, Z: S.Z }; h.on = S.on || null; h.B = { X: S.X, Y: S.Y + h.len, Z: S.Z }; connectHere(h); }
    }
    app.dirty = true;
  }

  // ── near the top or bottom of the view while dragging: climb the tower ─────────────────────────────────────────────
  // (only once the finger has gone on into the band beyond where it pressed: a handle near the top of the view is grabbed
  // and moved there without the view climbing away under it)
  function edgeWatch(cy, top = 0.12, bot = 0.9) {
    const r = el.view.getBoundingClientRect(), fy = (cy - r.top) / r.height, f0 = gesture && gesture.fy0 !== undefined ? gesture.fy0 : 0.5;
    app.autoScroll = fy < top && fy < Math.min(top, f0) - EDGE_GIVE ? 1 : fy > bot && fy > Math.max(bot, f0) + EDGE_GIVE ? -1 : 0;
  }
  const EDGE_GIVE = 0.03;     // of the view's height: how far past the press (or the band's edge) the finger must go
  function stopEdge() { app.autoScroll = 0; }

  // ── where the held board touches ─────────────────────────────────────────────────────────────────────────────────
  // [{ X, Y, Z, t (feet along it from its socket), end ('a': the socket, 'b': the free end, or null), other }]
  function contactsOf(h) { return contactsIn3D(worldOf(h), T().boards); }

  // ── overhang: the part of a nailed board past the last board (or the ground) it is nailed to ──────────────────────
  // len: its length; ts: feet along it (from its a end) where it touches others; top: which end is up for an upright
  // board (null otherwise). Returns [{ end: 'a' | 'b', t0, t1 }] (the stretch that sticks out), only when it is nailed
  // at two places or more. The top of a post standing up past its last crosspiece is no overhang: that is where the
  // next crosspiece (or the next post) goes. (None where what would be left between the nails is under half a foot.)
  function overhangOf(len, ts, top) {
    if (ts.length < 2) return [];
    const lo = Math.max(0, Math.min(...ts)), hi = Math.min(len, Math.max(...ts)), out = [];
    if (hi - lo < SCRAP - 1e-6) return out;
    if (lo > 0.12 && top !== 'a') out.push({ end: 'a', t0: 0, t1: lo });
    if (len - hi > 0.12 && top !== 'b') out.push({ end: 'b', t0: hi, t1: len });
    return out;
  }
  const topEnd = (a, b) => (Math.abs(a.X - b.X) < 0.1 * d3(a, b) + 1e-9 && Math.abs(a.Z - b.Z) < 0.1 * d3(a, b) + 1e-9 ? (b.Y > a.Y ? 'b' : 'a') : null);
  // a nailed board's overhangs: { board, list }
  function nailedOverhang(src) {
    if (!src || !T().boards.includes(src)) return null;
    const ts = contactsIn3D(src, T().boards).map((c) => c.t);
    return { board: src, list: overhangOf(src.len, ts, topEnd(src.a, src.b)) };
  }
  // an offcut back on the pile, rounded down to the half foot (under half a foot: kindling). -> the length kept, or 0
  function keepOffcut(past) {
    const k = offcutOf(past);
    if (k) { const p = newPiece(k); p.fresh = true; L.pieces.push(p); }
    renderPanel(); return k;
  }
  function cutNailed(src, o) {
    const before = src.len, d = { X: (src.b.X - src.a.X) / src.len, Y: (src.b.Y - src.a.Y) / src.len, Z: (src.b.Z - src.a.Z) / src.len };
    const at = (t) => { const r = (v) => Math.round(v * 1e6) / 1e6 || 0; return { X: r(src.a.X + d.X * t), Y: r(src.a.Y + d.Y * t), Z: r(src.a.Z + d.Z * t) }; };
    if (o.end === 'a') { src.a = at(o.t1); src.len -= o.t1; } else { src.b = at(o.t0); src.len = o.t0; }
    const off = o.t1 - o.t0; sound.saw(before, off); const kept = keepOffcut(off);
    app.onSawOff && app.onSawOff(off, kept, true);
    app.onTowerChanged && app.onTowerChanged(src, `Sawed ${fmt(off)} off`);
  }
  // ── after ✓: saw off the extra? ─────────────────────────────────────────────────────────────────────────────────
  // A board nailed sticking out past the joint at its free end (by any amount): the bar offers to saw it off right at
  // the joint (one tap), or to keep it. rec: the board just nailed (its b end is the free end), con: where it connected.
  let trim = null;
  // how: why an open offer closed ('saw', 'keep', or anything else: undo, a board picked up...), told to app.onTrimClosed
  function offerTrim(rec, con, how = 'other') {
    const was = trim;
    trim = con && con.past > 0.01 ? { rec, P: con.P, past: con.past } : null;
    if (was && was !== trim && app.onTrimClosed) app.onTrimClosed(was.rec, how);
    if (!el.trimBar) return;
    el.trimBar.hidden = !trim; el.view.classList.toggle('is-trimming', !!trim);
    if (!trim) return;
    const k = offcutOf(trim.past);
    el.trimHint.textContent = `It sticks out ${fmtWords(trim.past)} past the joint. ${k ? `Sawed off, ${fmtWords(k)} goes back on the pile` : 'Sawed off, it is too short to keep: kindling'}${k && Math.abs(k - trim.past) > 0.01 ? ' (the rest is sawdust)' : ''}.`;
  }
  function sawTrim() {
    const tr = trim; if (!tr || !T().boards.includes(tr.rec)) { offerTrim(null); return; }
    const src = tr.rec, before = src.len, nl = d3(src.a, tr.P);
    src.b = { ...tr.P }; src.len = Math.round(nl * 1e6) / 1e6;
    sound.saw(before, tr.past); const kept = keepOffcut(tr.past);
    offerTrim(null, null, 'saw');
    app.onSawOff && app.onSawOff(tr.past, kept, false);
    app.onTowerChanged && app.onTowerChanged(src, `Sawed ${fmt(tr.past)} off`);
  }
  if (el.trimSaw) el.trimSaw.addEventListener('click', () => { sound.audioOn(); sawTrim(); });
  if (el.trimKeep) el.trimKeep.addEventListener('click', () => { offerTrim(null, null, 'keep'); app.dirty = true; });

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
  let overTags = [];     // the "saw off" tags drawn last frame (view pixels), so a tap on one saws
  let selectTapAt = 0;   // when a tap last picked out a nailed board
  const distToSeg = (p, A, B) => { const vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy || 1, t = clamp(((p.x - A.x) * vx + (p.y - A.y) * vy) / L2, 0, 1); return Math.hypot(A.x + vx * t - p.x, A.y + vy * t - p.y); };
  // the held board as drawn, a layer out from its line (posts on their line): a world point -> the screen
  const heldOff = (h) => (Math.abs(h.A.X - h.B.X) < 1e-6 && Math.abs(h.A.Z - h.B.Z) < 1e-6 ? null : app.heldOut ? app.heldOut(worldOf(h)) : null);
  const heldScreen = (h, p) => { const o = heldOff(h); return o ? app.worldToScreen(p.X + o.X, p.Y + o.Y, p.Z + o.Z) : app.worldToScreen(p.X, p.Y, p.Z); };
  // the handles stay inside the view: an end up under the top bar, or off the screen, has its handle held short of it
  const HANDLE_TOP = 58, HANDLE_BOT = 32;
  const inViewOf = (r, q, m = 18) => ({ x: clamp(q.x, m, r.width - m), y: clamp(q.y, HANDLE_TOP, r.height - Math.max(m, HANDLE_BOT)) });

  // ── the view's pointers: handles, arrows, stones, overhangs, walking round, zooming, taps ─────────────────────────
  const pointers = new Map();          // every finger or mouse button down on the view: id -> { x, y }
  let gesture = null;                  // what the one pointer that started it is doing
  const now = () => performance.now();
  // would the held board lie right on top of another one, along its line over most of it (more than half the shorter
  // one)? Two boards can't fill one spot: it can't be nailed there.
  function doubled(t, g) {
    const len = d3(g.a, g.b) || 1, d = { X: (g.b.X - g.a.X) / len, Y: (g.b.Y - g.a.Y) / len, Z: (g.b.Z - g.a.Z) / len };
    const alongG = (p) => (p.X - g.a.X) * d.X + (p.Y - g.a.Y) * d.Y + (p.Z - g.a.Z) * d.Z;
    const off = (p) => { const s = alongG(p); return Math.hypot(p.X - g.a.X - s * d.X, p.Y - g.a.Y - s * d.Y, p.Z - g.a.Z - s * d.Z); };
    return t.boards.some((o) => {
      if (off(o.a) > 0.1 || off(o.b) > 0.1) return false;
      const s0 = alongG(o.a), s1 = alongG(o.b), over = Math.min(len, Math.max(s0, s1)) - Math.max(0, Math.min(s0, s1));
      return over > 0.5 * Math.min(len, o.len);
    });
  }
  // ── Undo with a board in hand: its last move ─────────────────────────────────────────────────────────────────────
  // Every move of the held board (its socket, its free end, an arrow) keeps how it was before (h.hist), so Undo takes the
  // last one back; with none left, Undo puts the board back on the pile.
  const snapOfHeld = (h) => ({ A: { ...h.A }, on: h.on, B: { ...h.B }, con: h.con ? { ...h.con } : null });
  const sameHeld = (h, o) => d3(h.A, o.A) < 1e-9 && d3(h.B, o.B) < 1e-9;
  function keepHist(o) { const h = app.held; if (!h || !o || sameHeld(h, o)) return; (h.hist || (h.hist = [])).push(o); if (h.hist.length > 40) h.hist.shift(); }
  function undoHeld() {
    const h = app.held; if (!h || !h.hist || !h.hist.length) return false;
    Object.assign(h, h.hist.pop()); sound.clatter(h.len * 0.6, 'set', undefined, 0.35); app.dirty = true;
    return true;
  }
  function startGrab(mode, e) {
    const h = app.held; if (!h || app.phase !== 'build') return;
    e.preventDefault(); e.stopPropagation(); sound.audioOn();
    const vr = el.view.getBoundingClientRect();
    gesture = { kind: 'grab', mode, snap: snapOfHeld(h), snapPiece: h.piece, id: e.pointerId, x: e.clientX, y: e.clientY, t0: now(), moved: false, fy0: (e.clientY - vr.top) / vr.height };
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { el.view.setPointerCapture(e.pointerId); } catch (err) { /* (a synthetic event has nothing to capture) */ }
  }
  el.gA.addEventListener('pointerdown', (e) => startGrab('socket', e));
  el.gB.addEventListener('pointerdown', (e) => startGrab('free', e));
  // the arrows: a tap moves the free end half a foot (a press held down repeats)
  const ARROWS = [['X', 1], ['X', -1], ['Z', 1], ['Z', -1]];
  let arrowRepeat = null;
  (el.arrows || []).forEach((node, i) => {
    node.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); sound.audioOn();
      const [ax, sg] = ARROWS[i]; arrow(ax, sg);
      clearInterval(arrowRepeat); clearTimeout(arrowRepeat);
      arrowRepeat = setTimeout(() => { arrowRepeat = setInterval(() => { if (!app.held || !arrow(ax, sg)) clearInterval(arrowRepeat); }, 160); }, 450);
    });
    const stop = () => { clearInterval(arrowRepeat); clearTimeout(arrowRepeat); arrowRepeat = null; };
    node.addEventListener('pointerup', stop); node.addEventListener('pointercancel', stop); node.addEventListener('pointerleave', stop);
  });
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
  const canNail = (h) => !!h && contactsOf(h).length > 0 && !doubled(T(), worldOf(h));
  el.nailBtn.addEventListener('click', () => {
    const h = app.held; if (!canNail(h)) return;
    const con = h.con; offerTrim(null);
    const rec = app.nail();
    if (rec && con && con.past > 0.01) offerTrim(rec, { ...con, P: { ...con.P } });
  });

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
      // on (or near) the held board: the end nearer the finger, as if pressed right on its ring
      const r = el.view.getBoundingClientRect(), p = { x: e.clientX - r.left, y: e.clientY - r.top };
      const A = inViewOf(r, heldScreen(h, h.A)), B = inViewOf(r, heldScreen(h, h.B));
      if (distToSeg(p, A, B) < 24) { startGrab(Math.hypot(p.x - A.x, p.y - A.y) < Math.hypot(p.x - B.x, p.y - B.y) * 0.6 ? 'socket' : 'free', e); return; }
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
      gesture.moved = true; h.fresh = false; h.start = false;
      if (gesture.mode === 'socket') {
        gesture.at = { x: e.clientX, y: e.clientY };
        const S = socketAt(e.clientX, e.clientY);
        if (S && (S.X !== h.A.X || S.Y !== h.A.Y || S.Z !== h.A.Z)) { placeSocket(h, S); sound.clatter(h.len * 0.4, 'set', undefined, 0.15); }
      } else dragFree(h, e.clientX, e.clientY);
      edgeWatch(e.clientY);
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
    if (g.kind === 'grab' && app.held && app.held.piece === g.snapPiece) {
      // carried off the view (onto the lumber panel): back to the pile
      const r = el.view.getBoundingClientRect();
      if (g.moved && e.type === 'pointerup' && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) putBack();
      else if (g.moved) keepHist(g.snap);
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

  // ── the joints just nailed flash green ───────────────────────────────────────────────────────────────────────────
  let flashes = [];      // [{ X, Y, Z, t0 }]
  function flash(points) { const t0 = now(); flashes.push(...points.map((p) => ({ X: p.X, Y: p.Y, Z: p.Z, t0 }))); }

  // ── drawing over the view: handles, arrows, joints, the overhang, the stones' tape ──────────────────────────────
  const place = (n, p) => { n.style.transform = `translate(${p.x}px, ${p.y}px)`; };
  // labels over the view that keep clear of each other (and of the handles): each tries its spots in turn and takes
  // the first free one, else the first one pulled inside the view (or, for a label that can be spared, none: null).
  function tagPlacer(r, avoid = []) {
    const taken = [...avoid];
    const free = (b) => b.x > 2 && b.x + b.w < r.width - 2 && b.y > 56 && b.y + b.h < r.height - 2
      && !taken.some((t) => b.x < t.x + t.w && b.x + b.w > t.x && b.y < t.y + t.h && b.y + b.h > t.y);
    return (w, h, spots, spare = false) => {
      let c = spots.find((q) => free({ x: q.x - w / 2, y: q.y - h / 2, w, h }));
      if (!c && spare) return null;
      if (!c) {
        const overlap = (q) => taken.reduce((sum, t) => sum + Math.max(0, Math.min(q.x + w / 2, t.x + t.w) - Math.max(q.x - w / 2, t.x)) * Math.max(0, Math.min(q.y + h / 2, t.y + t.h) - Math.max(q.y - h / 2, t.y)), 0);
        const inside = spots.map((q) => ({ x: clamp(q.x, w / 2 + 4, r.width - w / 2 - 4), y: clamp(q.y, 58 + h / 2, r.height - h / 2 - 4) }));
        c = inside.reduce((best, q) => (overlap(q) < overlap(best) - 1 ? q : best), inside[0]);
      }
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
      if (o.tag !== false) {
        const c = place(96, 24, [-28, 28, -52, 52, -76, 76].map((d) => ({ x: M.x + nx * d, y: M.y + ny * d }))), txt = o.words || '✂ saw off ' + fmt(o.t1 - o.t0);
        out += `<g class="overtag"><rect x="${c.x - 48}" y="${c.y - 12}" width="96" height="24" rx="12"/><text x="${c.x}" y="${c.y + 4}">${txt}</text></g>`;
        if (!o.words) overTags.push({ end: o.end, x: c.x - 48, y: c.y - 12, w: 96, h: 24 });
      }
    }
    return out;
  }
  // The four arrows: lying on the ground's directions as the camera sees them at the middle of the tower, drawn round a
  // spot in the upper part of the view: the green pair along X (right +, left -), the blue pair along Z (front +, back
  // -). Each a fat arrow ARROW_FT long in that picture, scaled so the longer pair is ARROW_PX on the screen.
  // -> { C (the middle, view pixels), tips: [{ x, y } x4] (where each arrow's hit spot goes), svg }
  const ARROW_PX = 64;
  function arrowsAt(r) {
    const look = app.lookAt ? app.lookAt() : { X: 0, Y: 0, Z: 0 };
    const O = app.worldToScreen(look.X, look.Y, look.Z), PX = app.worldToScreen(look.X + 1, look.Y, look.Z), PZ = app.worldToScreen(look.X, look.Y, look.Z + 1);
    let ex = { x: PX.x - O.x, y: PX.y - O.y }, ez = { x: PZ.x - O.x, y: PZ.y - O.y };
    const k = ARROW_PX / Math.max(1e-6, Math.hypot(ex.x, ex.y), Math.hypot(ez.x, ez.y));
    ex = { x: ex.x * k, y: ex.y * k }; ez = { x: ez.x * k, y: ez.y * k };
    // (never squashed flatter than a third of its length, so a pair seen nearly edge on can still be hit)
    const fat = (e) => { const l = Math.hypot(e.x, e.y); return l < ARROW_PX * 0.45 ? { x: e.x / (l || 1) * ARROW_PX * 0.45, y: (e.y / (l || 1)) * ARROW_PX * 0.45 } : e; };
    ex = fat(ex); ez = fat(ez);
    const top = el.hint && !el.hint.hidden && el.hint.textContent ? el.hint.getBoundingClientRect().bottom - r.top : 80;
    const C = { x: r.width / 2, y: clamp(Math.max(top + ARROW_PX + 12, r.height * 0.26), 120, r.height * 0.45) };
    // an arrow along u (a unit pair in the picture), w the other pair: a shaft from 0.25 to 0.7 and a head to 1.05
    const shape = (u, w, s) => {
      const P = (a, b) => ({ x: C.x + s * (u.x * a) + w.x * b, y: C.y + s * (u.y * a) + w.y * b });
      return [P(0.28, -0.13), P(0.68, -0.13), P(0.68, -0.3), P(1.05, 0), P(0.68, 0.3), P(0.68, 0.13), P(0.28, 0.13)];
    };
    const tips = [], svg = [];
    ARROWS.forEach(([ax, sg]) => {
      const u = ax === 'X' ? ex : ez, w = ax === 'X' ? ez : ex, pts = shape(u, w, sg);
      tips.push({ x: C.x + sg * u.x * 0.66, y: C.y + sg * u.y * 0.66 });
      svg.push(`<polygon class="arrow3d ${ax === 'X' ? 'is-x' : 'is-z'}" points="${pts.map((q) => q.x.toFixed(1) + ',' + q.y.toFixed(1)).join(' ')}"/>`);
    });
    return { C, tips, svg: svg.join('') };
  }
  // the held board's state this frame, for main.js (its ends' green glow)
  let heldInfo = null;
  let hintText = '';
  function frame() {
    const h = app.held, svg = el.overlay, building = app.phase === 'build', t = T();
    const show = !!h && building;
    el.gA.hidden = !show; el.gB.hidden = !show;
    (el.arrows || []).forEach((n) => { n.hidden = !show; });
    el.nailBtn.hidden = !show; el.view.classList.toggle('is-holding', show);
    // (a question card open never closes it: the bar only hides under the card and comes back after)
    const asking = app.phase === 'question';
    if (trim && ((!building && !asking) || h || app.selected || !T().boards.includes(trim.rec))) offerTrim(null);
    if (el.trimBar && trim) el.trimBar.hidden = asking;
    let out = '', hint = '';
    overTags = []; heldInfo = null;
    showUpNext(building);
    // the footing stones (until the first board is nailed): a handle on each, and a tape along the two near sides
    const stones = building && app.stonesOpen() && !h;
    const corner = (c) => [[-t.W / 2, t.D / 2], [t.W / 2, t.D / 2], [t.W / 2, -t.D / 2], [-t.W / 2, -t.D / 2]][c];
    el.stoneHandles.forEach((n, c) => { n.hidden = !stones; if (stones) { const [X, Z] = corner(c); place(n, app.worldToScreen(X, 0.2, Z)); } });
    if (stones) {
      // the side facing you, and the side round the corner nearest the view
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
      const r = el.view.getBoundingClientRect(), w = worldOf(h);
      const A = heldScreen(h, h.A), B = heldScreen(h, h.B);
      const nailAt = (() => { const b = el.nailBtn.getBoundingClientRect(); return { x: b.x + b.width / 2 - r.left, y: b.y + b.height / 2 - r.top }; })();
      const inView = (q, m = 18) => { const v = inViewOf(r, q, m); return Math.hypot(v.x - nailAt.x, v.y - nailAt.y) < 52 ? { x: nailAt.x - 52, y: v.y } : v; };
      const Ah = inView(A), Bh = inView(B);
      place(el.gA, Ah); place(el.gB, Bh);
      // while the socket end is being moved: the sockets near the finger, as small dots
      if (gesture && gesture.kind === 'grab' && gesture.mode === 'socket' && gesture.at) {
        const fx = gesture.at.x - r.left, fy = gesture.at.y - r.top;
        for (const s of sockets()) { const P = app.worldToScreen(s.X, s.Y, s.Z); if (!P.behind && Math.hypot(P.x - fx, P.y - fy) < 110) out += `<circle class="sock" cx="${P.x.toFixed(1)}" cy="${P.y.toFixed(1)}" r="3.5"/>`; }
      }
      // the arrows, and their hit spots
      const arr = arrowsAt(r);
      out += arr.svg;
      (el.arrows || []).forEach((n, i) => place(n, arr.tips[i]));
      const cs = contactsOf(h), tag = tagPlacer(r, [box(nailAt, 54), box(Ah, 40), box(Bh, 40), ...arr.tips.map((q) => box(q, 50))]);
      let rings = '', tags = '';
      // the joint where the free end connected (a green circle), and the part past it (pale, the saw line)
      if (h.con) {
        const P = heldScreen(h, h.con.P);
        if (h.con.past > 0.01) {
          const L0 = h.len - h.con.past;
          out += drawOverhang((tt) => heldScreen(h, alongB(w, tt)), [{ end: 'b', t0: L0, t1: h.len, words: 'past ' + fmt(h.con.past) }], tag);
        }
        rings += `<circle class="joint" cx="${P.x}" cy="${P.y}" r="13"/>`;
      }
      // every other spot where it touches a board along the way (not at its ends): a green circle
      for (const c of cs) {
        if (c.end || (h.con && d3(c, h.con.P) < 0.35)) continue;
        const P = heldScreen(h, c); rings += `<circle class="joint" cx="${P.x}" cy="${P.y}" r="11"/>`;
      }
      out += rings + tags;
      const dup = cs.length > 0 && doubled(t, w), ok = cs.length > 0 && !dup;
      el.nailBtn.disabled = !ok;
      const tooFar = h.tooFar && now() - h.tooFar < 1800;
      hint = dup ? 'A board is already right there: move it off that one first'
        : tooFar ? 'Too short to reach any further over that way'
        : h.start && !h.left && h.fresh ? 'It starts where you left off · carry it further to put it somewhere else'
        : gesture && gesture.kind === 'grab' && gesture.mode === 'socket' ? 'Moving its foot to a spot on the half foot'
        : h.con && h.con.past > 0.01 ? `Connected, sticking out ${fmt(h.con.past)} past the joint · ✓ to nail it`
        : h.con ? 'Connected · ✓ to nail it'
        : 'Drag its free end onto a board, or tap the arrows · ✓ to nail it';
      hint = `${fmt(h.len)} board · ${hint}`;
      heldInfo = { glowA: cs.some((c) => c.end === 'a'), glowB: !!h.con || cs.some((c) => c.end === 'b') };
      el.gA.classList.toggle('is-touching', false); el.gB.classList.toggle('is-touching', heldInfo.glowB);
    } else if (building && app.selected) {
      const n = nailedOverhang(app.selected);
      if (n && n.list.length) { out += drawOverhang((tt) => boardScreen(n.board, tt), n.list); hint = 'Tap ✂ saw off (or the pale end) to cut it off'; }
    }
    // the board just nailed, offered a trim: its extra drawn pale with the saw line
    if (building && !h && trim && T().boards.includes(trim.rec)) {
      const b = trim.rec, L0 = d3(b.a, trim.P);
      out += drawOverhang((tt) => boardScreen(b, tt), [{ end: 'b', t0: L0, t1: b.len, tag: false }]);
    }
    // the joints just nailed: a green ring that swells and fades
    if (flashes.length) {
      const tn = now(); flashes = flashes.filter((f) => tn - f.t0 < 900);
      for (const f of flashes) {
        const k = (tn - f.t0) / 900, P = app.worldToScreen(f.X, f.Y, f.Z); if (P.behind) continue;
        out += `<circle class="flash" cx="${P.x}" cy="${P.y}" r="${10 + k * 22}" style="opacity:${(1 - k).toFixed(2)}"/>`;
      }
    }
    // the twins with no wood or no room: say why, small, by their middle (each tag clear of the others). A lit twin seen
    // end on (only a dot on the screen) gets a bold gold ring where it is, so it can be seen and tapped.
    if (building && !h) {
      const r = el.view.getBoundingClientRect(), tag = tagPlacer(r);
      for (const g of app.ghostList()) {
        if (!g.ok) continue;
        const A = app.worldToScreen(g.a.X, g.a.Y, g.a.Z), B = app.worldToScreen(g.b.X, g.b.Y, g.b.Z);
        if (A.behind || B.behind || Math.hypot(B.x - A.x, B.y - A.y) > 26) continue;
        out += `<circle class="twinend" cx="${(A.x + B.x) / 2}" cy="${(A.y + B.y) / 2}" r="13"/>`;
      }
      const saidWhy = new Set();   // (each reason once: one "no wood left" tag, not one per twin)
      for (const g of app.ghostList()) {
        if (g.ok || !g.reason || saidWhy.has(g.reason)) continue;
        const P = app.worldToScreen((g.a.X + g.b.X) / 2, (g.a.Y + g.b.Y) / 2, (g.a.Z + g.b.Z) / 2);
        if (P.behind || P.x < 40 || P.x > r.width - 40 || P.y < 60 || P.y > r.height - 10) continue;
        const c = tag(108, 19, [[0, 0], [0, -24], [0, 24], [0, -48], [0, 48], [-70, 0], [70, 0]].map(([dx, dy]) => ({ x: P.x + dx, y: P.y + dy })));
        out += `<g class="ghosttag"><rect x="${c.x - 54}" y="${c.y - 10}" width="108" height="19" rx="9"/><text x="${c.x}" y="${c.y + 4}">${g.reason}</text></g>`;
        saidWhy.add(g.reason);
      }
    }
    svg.innerHTML = out;
    if (!hint && building && trim) hint = 'Saw off the extra, or keep it';
    if (!hint && building) hint = app.idleHint ? app.idleHint() : '';
    if (!hint && building && el.upNext && !el.upNext.hidden && upUsed < 2) hint = 'Put it up: the board on the bench starts where you left off';
    if (hint !== hintText) { hintText = hint; el.hint.textContent = hint; }
  }

  return { freshStack, renderPanel, frame, putBack, undoHeld, returnPiece, contactsOf, cut, takeUp, toBench, payFor, woodFor, addOffcut, arrow, dragFree, placeSocket, socketAt, sockets, setRun,
    nailedOverhang, cutNailed, fullCount, giveBoard, worldOf, flash, groups, offerTrim, sawTrim, canNail,
    get trim() { return trim; }, get heldInfo() { return heldInfo; }, get cutAt() { return cutAt; }, set cutAt(v) { cutAt = v; renderPanel(); } };
}
