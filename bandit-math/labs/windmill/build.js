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
//   * LEANING WALLS: seen end on, a board that is not level shows as a line, and a handle sits on its top end: drag that
//     in or out and its whole wall leans about its foot (the foot stays put), by the half inch for every foot up, 7 at most,
//     and more readily onto the lean of a wall already standing there (so the next board joins the leaning wall). A
//     level board seen end on is only a dot: pushed in or out, it lands in the wall of the boards it meets at that
//     height, leaning or not (a crosspiece slid in between two leaning legs takes their wall's lean). A post (or a leg,
//     the line where two walls meet) works as a post always has: it is held in whichever of its two walls faces the
//     view, and its swing handles act there, so swinging its top seen from the side leans it in the front wall's
//     direction; near upright, the swing goes by the half inch for every foot up, and onto the lean of a wall standing at its
//     foot (so a corner leg lands on the line where two leaning walls meet). A piece brought to a corner of a leaning
//     wall lies along that corner's line (continuing the lean from the top of the leg below), and a level piece between
//     two leaning legs settles at the height where they stand just its length apart (cut it to the width you want).
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
// (PLANES ARE X OR Z FAMILIES: the held board's plane is a key like 'Z:1.5' or 'Z:3~-1.5'; its own coordinates on it are
// (x, y) = (u, y) of tower.js, true lengths up a leaning wall. In-plane work is 2D, as v2's walls were; the plane's offset
// and lean are what is new.)
import { SNAP, BOARD_FT, MIN_W, MAX_W, LEAN_MAX, LEAN_STEP, planeSegments, planesOf, planeKey, parseKey, toPlane, planeHalf, faceOfPlane, planesInUse, crossings, crossKey, boardOnPlane, planeName, wallSpan, floorsAcross,
  isPost, offsetAt, wallsInUse, isCornerLine, onLeanGrid, kOfT, tOfK, snapK, leanWords, fromPlane, faceWalls, inFootprint, spotTaken, planeKeyOf, wallPlanesOf, secondWall, lenLabel, lenWords, leanRate } from './tower.js';
import { trianglesOf } from './questions.js';
import { touch, touch3, findJoints, isKnee, contactsOf as contactsIn3D, pointGap, TOL } from './touch.js';
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
// a wall's lean in words: "2½ inches in for every foot up" (k: inches a foot, by the half inch; dir 'in' or 'out')
export const rateWords = leanRate;
// a lean's words without the "leaning" in front (the tag by the board): "1½ inches in for every foot up", "upright"
const bareLean = (w) => w.replace(/^leaning /, '');
// the base in words: "6 ft × 4 ft" (short: "6 × 4 ft")
const num = (v) => { const f = Math.floor(v + 1e-6); return Math.abs(v - f - 0.5) < 1e-6 ? (f || '') + '½' : String(Math.round(v * 10) / 10); };
export const fmtBase = (W, D, short = false) => (short ? `${num(W)} × ${num(D)} ft` : `${fmt(W)} × ${fmt(D)}`);
const SCRAP = 0.5;      // an offcut shorter than this is kindling, not lumber
// leaning a wall by its top, seen end on: at least this many pixels of finger (or mouse) for each half inch a foot
const LEAN_PX = 18, LEAN_PX_MOUSE = 10;
// seen face on below 40 degrees off square, end on past 50 (between: as it was)
const FACE_ON = 40 * DEG, END_ON = 50 * DEG;
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
    if (app.showSpot) app.showSpot(worldOf(app.held));
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
          // (let go on the view: it stays on the plane it was put on; let go still at its start spot, the view climbs to
          // it if it is out of sight, never before: carried on further, the view must stay where the finger aims)
          app.held.fresh = false;
          if (app.held.start && !app.held.left && app.showSpot) app.showSpot(worldOf(app.held));
        }
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
    // (where the builder left off: the board starts there, ready to swing and nail, unless carried on further)
    const spot = startSpot(p.len);
    if (spot) Object.assign(app.held, spot, { start: spot });
    renderPanel(); app.select(null); app.dirty = true;
    app.onTakeUp && app.onTakeUp();
    return p;
  }
  // ── where a new board starts: where the builder left off ────────────────────────────────────────────────────────
  // Most often the next board builds on the last one nailed by hand (app.lastHand), so a piece taken from the lumber
  // starts there, its foot on the higher end of that board, in its wall (its lean too):
  //   * after a post or a leg: standing on its top, going on up along its line (the next level's post or leg)
  //   * after a brace (any other rising board): straight up its wall from its top end; where that end is nailed partway
  //     up a post or leg, on up that post's or leg's line from its top
  //   * after a horizontal board: straight up from one of its ends, the end with nothing standing on it yet first (then
  //     the end nearer the view); where a post or leg stops at that end, going on up its line
  // It must not stand off the footprint or inside another board: where a post or leg already goes on up from that spot
  // (a brace's top end nailed partway up a post), it stands on that post's top instead, on the same line; otherwise
  // the next choice, and with none, it is carried in from the lumber as always. -> the held board's { key, x, y, ang, n,
  // leg } or null
  function startSpot(len) {
    const t = T(), L = app.lastHand;
    if (!L || !t.boards.includes(L)) return null;
    const walls = wallsInUse(t), leans = [...walls].some((k) => parseKey(k).k !== 0), kind = app.face % 2 ? 'X' : 'Z';
    const unit = (a, b) => { const d = { X: b.X - a.X, Y: b.Y - a.Y, Z: b.Z - a.Z }, l = Math.hypot(d.X, d.Y, d.Z) || 1; return { X: d.X / l, Y: d.Y / l, Z: d.Z / l }; };
    const up = (a, b) => (b.Y >= a.Y ? [a, b] : [b, a]);
    const lineOf = (o) => isCornerLine(t, o, walls);
    let nested = false;
    // a candidate: the board from foot along dir, held in the wall `key` (a line board in whichever of its walls faces
    // the view, else its own): fine if over the footprint and in no other board's spot
    const tryOn = (foot, dir, keys, n, line) => {
      const a = foot, b = { X: foot.X + dir.X * len, Y: foot.Y + dir.Y * len, Z: foot.Z + dir.Z * len }, g = { a, b, len };
      if (!inFootprint(t, a, leans) || !inFootprint(t, b, leans) || b.Y < a.Y + 0.5) return null;
      // (inside a post or leg going on up there: on up from that one's top instead, lined up on the same line)
      const inside = t.boards.find((o) => { const cs = touch3(g, o); return cs.length >= 2 && Math.abs(cs[1].ti - cs[0].ti) > 0.3; });
      if (inside) return lineOf(inside) && !nested ? (nested = true, onLine(inside)) : null;
      if (spotTaken(t, g)) return null;
      const key = keys.find((k) => k[0] === kind) || keys[0], A = toPlane(key, a), B = toPlane(key, b);
      const h = { key, x: A.u, y: A.y, ang: Math.atan2(B.y - A.y, B.u - A.u), endOn: false, n: n || key[0], leg: false };
      h.leg = line && Math.abs(Math.cos(h.ang)) > 1e-6;
      return h;
    };
    // straight up a wall from a point on it (up its slope, in a leaning wall)
    const upWall = (key, p) => { const q = toPlane(key, p); return unit(fromPlane(key, q.u, q.y), fromPlane(key, q.u, q.y + 1)); };
    // going on up a post's or leg's line from its top
    const onLine = (o) => { const [lo, hi] = up(o.a, o.b); return tryOn(hi, unit(lo, hi), wallPlanesOf(t, o, walls), o.n, true); };
    if (Math.abs(L.a.Y - L.b.Y) > 0.25) {
      if (lineOf(L)) return onLine(L);
      const key = planeKeyOf(L), [, hi] = up(L.a, L.b);
      // (its top end nailed partway up a post or leg: that is the line to go on up, from the post's or leg's top)
      const host = t.boards.find((o) => o !== L && lineOf(o) && up(o.a, o.b)[1].Y > hi.Y + 0.3 && pointGap(hi, o).d < TOL);
      if (host) return onLine(host);
      return tryOn(hi, upWall(key, hi), [key], null, false);
    }
    // a horizontal board: its ends, the free one first, then the nearer one
    const key = planeKeyOf(L), near = (p, q) => Math.hypot(p.X - q.X, p.Y - q.Y, p.Z - q.Z) < 0.35;
    const standing = (E) => t.boards.some((o) => o !== L && Math.abs(o.a.Y - o.b.Y) > 0.25 && near(up(o.a, o.b)[0], E));
    const ends = [L.a, L.b].map((E) => ({ E, free: !standing(E), d: app.camDist ? app.camDist(E) : 0 })).sort((p, q) => (q.free - p.free) || (p.d - q.d));
    for (const { E } of ends) {
      nested = false;
      // (a post or leg stopping right at that end: on up its line)
      const below = t.boards.find((o) => o !== L && lineOf(o) && near(up(o.a, o.b)[1], E));
      const h = below ? onLine(below) : tryOn({ ...E }, upWall(key, E), [key], null, false);
      if (h) return h;
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

  // ── the held board on its plane ──────────────────────────────────────────────────────────────────────────────────
  // (h.x, h.y): its a end on the plane h.key; h.ang its angle there; the far end len feet along
  const endsOf = (h) => ({ ax: h.x, ay: h.y, bx: h.x + Math.cos(h.ang) * h.len, by: h.y + Math.sin(h.ang) * h.len });
  const segOf = (h) => ({ id: '__held', ...endsOf(h), len: h.len });
  const upright = (h) => Math.abs(Math.cos(h.ang)) < 1e-6;
  // a board held like a post: straight up its wall, or a LEG (h.leg: leaning across its wall too, by a lean a wall can
  // have, so it lies in two walls). It is held in whichever of its two walls faces the view, and keeps its own (h.n).
  const lineLike = (h) => upright(h) || !!h.leg;
  // the held board in the world: { id, a, b, len, n, t?, leg? }
  // (a post keeps the way its wide face looks (h.n) when it moves over to its other plane: the view turning round it
  // never turns the post itself, which bends easily only its thin way. A leg held in its other wall keeps its own wall's
  // lean, read from its ends.)
  const worldOf = (h) => {
    const w = boardOnPlane(h.key, h.x, h.y, h.ang, h.len);
    if (h.n && lineLike(h)) {
      w.n = h.n;
      if (h.n !== h.key[0]) {
        delete w.t;
        const dy = w.b.Y - w.a.Y, r = Math.abs(dy) > 1e-6 ? (across(h.n, w.b) - across(h.n, w.a)) / dy : 0;
        if (onLeanGrid(r) && kOfT(r)) w.t = tOfK(kOfT(r));
      }
    }
    if (h.leg) w.leg = true;
    return { id: '__held', ...w };
  };
  // how far out of square the view is from a plane (0: face on, PI/2: end on). (A leaning plane's level direction is
  // its family's, so this holds for it too.)
  const offSquare = (key) => { const nAz = key[0] === 'Z' ? 0 : Math.PI / 2; return Math.acos(Math.min(1, Math.abs(Math.cos(app.viewAz() - nAz)))); };
  // the plane's offset, and a world point's coordinate across it (PLANES ARE X OR Z FAMILIES)
  const offOf = (key) => parseKey(key).off;
  const across = (key, p) => (key[0] === 'Z' ? p.Z : p.X);
  const axisHalf = (axis) => (axis === 'Z' ? T().D / 2 : T().W / 2);
  // the held board's foot (its lower end) and top, in the world
  const footOf = (w) => (w.a.Y <= w.b.Y ? w.a : w.b), topOf = (w) => (w.a.Y <= w.b.Y ? w.b : w.a);
  // is the held board level (a dot seen end on: no top to lean by)?
  const levelH = (h) => Math.abs(Math.sin(h.ang)) * h.len < 0.75;

  // everything on the held board's plane: its boards, where boards crossing it pass through, the ground, and (on an
  // outer wall) the corner lines over the stones
  function context(key = app.held ? app.held.key : app.facingPlane()) {
    // (a leaning plane through the stones' edge is an outer wall only where its boards, or the board in hand, come down
    // to the ground there: a tier's leaning wall on beams is an inside wall, with no stones or corner lines on it)
    const t = T(), segs = planeSegments(t, key), half = planeHalf(t, key), h = app.held;
    const outer = faceOfPlane(t, key, h && h.key === key ? footOf(worldOf(h)).Y : null) >= 0;
    const cross = crossings(t, key).map((c) => ({ x: c.u, y: c.y, src: c.src }));
    const lines = [{ ax: -60, ay: 0, bx: 60, by: 0, len: 120, ground: true }];
    if (outer) for (const u of [-half, half]) lines.push(...cornerLines(key, u));
    return { key, segs, cross, lines, half, outer };
  }
  // The corner lines of an outer wall at u = ±half (in its own coordinates): from the stone up the line where it meets
  // each wall in use standing on the stones round that corner (an upright side wall: straight up this wall; a leaning
  // one: slanting in or out with it, the line a corner leg lies on). None in use there: straight up.
  function cornerLines(key, u) {
    const t = T(), { axis, t: tP } = parseKey(key), other = axis === 'Z' ? 'X' : 'Z', c = axis === 'Z' ? u : -u, sg = axis === 'Z' ? 1 : -1;
    const leans = [];
    for (const k of wallsInUse(t)) { const q = parseKey(k); if (q.axis === other && Math.abs(q.off - c) < 1e-3 && !leans.includes(q.k)) leans.push(q.k); }
    if (!leans.length) leans.push(0);
    const sP = Math.sqrt(1 + tP * tP), top = 400 / sP;
    return leans.map((k2) => {
      const bx = u + sg * tOfK(k2) * top;
      return { ax: u, ay: 0, bx, by: 400, len: Math.hypot(bx - u, 400), corner: true, k: k2 };
    });
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
    // (heights go to the half foot: on a leaning wall y runs up its slope, so a whole number of feet up it is a little more)
    const sK = Math.sqrt(1 + parseKey(h.key).t ** 2), snapY = (v) => snapTo(v / sK) * sK;
    const dx = Math.cos(h.ang) * h.len, dy = Math.sin(h.ang) * h.len;
    let best = null;
    const consider = (ox, oy, score, along, e) => { if (!best || score < best.score) best = { ox, oy, score, along, e }; };
    const tips = [...segs.flatMap((s) => [[s.ax, s.ay], [s.bx, s.by]]), ...ctx.cross.map((c) => [c.x, c.y])];
    const joints = jointsHere(ctx);
    // (an upright board's foot that settles on anything within a fifth of a foot of a post's top goes onto the post's
    // top: a board stood on the top post stands on the post, not on the end of the brace that reaches up beside it a
    // few inches lower. Only that close: a joint half a foot along, where a beam crosses, is still its own spot)
    // (and a leg's foot, the same way, onto the top of the leg below it on its line: the lean goes on up)
    const up = Math.abs(Math.cos(h.ang)) < 1e-6 || !!h.leg, lowEnd = dy >= 0 ? 0 : 1;
    const walls = up ? wallsInUse(T()) : null, along = (s) => Math.abs((s.bx - s.ax) * dy - (s.by - s.ay) * dx) < 0.02 * s.len * h.len;
    const postTops = up ? segs.filter((s) => s.post || (s.leg && along(s) && isCornerLine(T(), s.src, walls))).map((s) => (s.ay > s.by ? [s.ax, s.ay] : [s.bx, s.by])) : [];
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
        let to = horiz ? snapTo(v) : snapY(v), near = 0.3;
        for (const [px, py] of tips) { const on = horiz ? Math.abs(py - fixed) < 0.05 : Math.abs(px - fixed) < 0.05, q = horiz ? px : py; if (on && Math.abs(q - v) < near) { near = Math.abs(q - v); to = q; } }
        return to;
      };
      if (s && Math.abs(s.ay - s.by) < 1e-6) nx = along(nx + ox, s.ay, true) - ox;
      else if (s && Math.abs(s.ax - s.bx) < 1e-6) ny = along(ny + oy, s.ax, false) - oy;
    } else { nx = snapTo(nx); ny = snapY(ny); }
    if (postTops.length) {
      const fx = nx + (lowEnd ? dx : 0), fy = ny + (lowEnd ? dy : 0);
      for (const [px, py] of postTops) if (Math.hypot(px - fx, py - fy) < 0.2) { nx += px - fx; ny += py - fy; break; }
    }
    // a level board between two legs of a tapering (or flaring) wall: it settles at the height where they stand just
    // its length apart, the middle between them, if that is near where it was put
    if (Math.abs(dy) < 1e-9) { const f = fitBetween(segs, nx, ny, dx, sK); if (f) { nx = f.x; ny = f.y; } }
    // never below the ground
    const low = Math.min(ny, ny + dy); if (low < 0) ny -= low;
    h.x = nx; h.y = ny;
    ghostSnap(h);
  }
  // How far apart the legs of a tapering (or flaring) wall stand at a level board's height, either side of its middle:
  // feet, or null when no leg there slants in the wall (between upright posts the board's own length says it all).
  // s: the board on the plane { ax, ay, bx, by }.
  function legGap(key, s) {
    const walls = wallsInUse(T()), y = s.ay, m = (s.ax + s.bx) / 2;
    let L = null, R = null, slant = false;
    for (const p of planeSegments(T(), key)) {
      if (!(p.post || (p.leg && isCornerLine(T(), p.src, walls)))) continue;
      const lo = Math.min(p.ay, p.by), hi = Math.max(p.ay, p.by); if (y < lo - 0.25 || y > hi + 0.25 || hi - lo < 0.5) continue;
      const u = p.ax + (p.bx - p.ax) * (y - p.ay) / (p.by - p.ay);
      if (u <= m && (!L || u > L.u)) L = { u, p }; if (u >= m && (!R || u < R.u)) R = { u, p };
    }
    if (!L || !R || L.p === R.p) return null;
    for (const q of [L.p, R.p]) if (Math.abs(q.bx - q.ax) > 1e-3) slant = true;
    return slant ? R.u - L.u : null;
  }
  // A level board (its a end at (x, y), reaching dx along the wall) near two legs of its wall, at least one of them
  // slanting in the wall (the wall's own corners leaning toward each other, or apart): the place where its ends land on
  // both, the middle between them, or null. Where the legs stand just its length apart, if that is on them; past their
  // tops (a piece a hair short for the top of a tapering storey), at their tops, if its ends still touch both there.
  // (Upright posts stand the same distance apart all the way up, so between two of them nothing moves.)
  function fitBetween(segs, x, y, dx, sK = 1) {
    const walls = wallsInUse(T()), legs = segs.filter((s) => s.leg && !s.post && Math.abs(s.by - s.ay) > 0.5 && isCornerLine(T(), s.src, walls));
    if (!legs.length) return null;
    const lines = [...legs, ...segs.filter((s) => s.post)];
    const uAt = (s, yy) => s.ax + (s.bx - s.ax) * (yy - s.ay) / (s.by - s.ay);
    const lo = Math.min(x, x + dx), hi = Math.max(x, x + dx), len = Math.abs(dx);
    // (a height a hair off a half inch, from the legs' rounded ends, goes onto it)
    const halfInch = (yy) => { const Y = yy / sK, r = Math.round(Y * 24) / 24; return Math.abs(Y - r) < 1e-3 ? r * sK : yy; };
    let best = null;
    for (const L of lines) for (const R of lines) {
      if (L === R || (!legs.includes(L) && !legs.includes(R))) continue;
      const uL = uAt(L, y), uR = uAt(R, y);
      if (uL >= uR || Math.abs(uL - lo) > 0.6 || Math.abs(uR - hi) > 0.6) continue;
      // the gap between them changes along y at this rate; where it is len:
      const g0 = uR - uL, rate = (uAt(R, y + 1) - uAt(L, y + 1)) - g0;
      if (Math.abs(rate) < 1e-6) continue;
      const lo2 = Math.max(Math.min(L.ay, L.by), Math.min(R.ay, R.by)), hi2 = Math.min(Math.max(L.ay, L.by), Math.max(R.ay, R.by));
      const yy = clamp(y + (len - g0) / rate, lo2, hi2);
      const gap = uAt(R, yy) - uAt(L, yy);
      if (Math.abs(yy - y) > 0.75 || yy < 0 || Math.abs(gap - len) / 2 > 0.17) continue;
      const d = Math.abs(yy - y);
      if (!best || d < best.d) { const mid = (uAt(L, yy) + uAt(R, yy)) / 2; best = { d, x: dx >= 0 ? mid - len / 2 : mid + len / 2, y: halfInch(yy) }; }
    }
    return best;
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
  // swing: one end stays put (pivot), the other follows the pointer's direction. leg: the board was a post or a leg when
  // the swing began: near upright it leans by the half inch a foot (see legSwing)
  function snapSwing(h, pivotEnd, px, py, leg = false) {
    const ctx = context(h.key), { segs, lines } = ctx;
    const e = endsOf(h);
    const P = pivotEnd === 'a' ? { x: e.ax, y: e.ay } : { x: e.bx, y: e.by };
    const raw = Math.atan2(py - P.y, px - P.x);
    // where a circle of the board's length round the pivot crosses other boards, the corner lines and the ground, or
    // passes through a board crossing the plane. (A post or leg being leaned: a line through the pivot itself, the
    // corner line it stands on, the post under it or the ground, is no place to swing onto: it would hold it upright.)
    let best = null;
    const tryAt = (q) => { const a = Math.atan2(q.y - P.y, q.x - P.x), diff = Math.abs(angDiff(a, raw)); if (diff < 9 * DEG && (!best || diff < best.diff)) best = { a, diff }; };
    for (const s of [...segs, ...lines]) { if (leg && Math.hypot(nearestOn(s, P.x, P.y).x - P.x, nearestOn(s, P.x, P.y).y - P.y) < 0.05) continue; for (const q of circleHits(P, h.len, s)) tryAt(q); }
    for (const c of ctx.cross) if (Math.abs(Math.hypot(c.x - P.x, c.y - P.y) - h.len) < 0.25) tryAt(c);
    // a post or leg near upright, with no board there to swing onto: it leans by the half inch a foot (legSwing)
    if (leg && !best) {
      const a = legSwing(h, P, raw);
      if (a !== null) {
        if (pivotEnd === 'a') h.ang = a;
        else { h.x = P.x + Math.cos(a) * h.len; h.y = P.y + Math.sin(a) * h.len; h.ang = a + Math.PI; }
        h.ang = Math.atan2(Math.sin(h.ang), Math.cos(h.ang));
        if (!h.n) h.n = h.key[0];
        h.leg = !upright(h); h.asLeg = true;
        return;
      }
    }
    h.asLeg = false;            // (swung as a brace is: see the pivot's settling in the view's pointermove)
    if (leg) h.leg = false;     // (onto a board, or past the steepest lean: a brace now, swung the usual way)
    if (best) h.steep = false;
    let a = best ? best.a : Math.round(raw / (5 * DEG)) * 5 * DEG;
    if (P.y + Math.sin(a) * h.len < -0.01) { const g = circleHits(P, h.len, lines[0]); if (g.length) { g.sort((u, v) => Math.abs(angDiff(Math.atan2(u.y - P.y, u.x - P.x), raw)) - Math.abs(angDiff(Math.atan2(v.y - P.y, v.x - P.x), raw))); a = Math.atan2(g[0].y - P.y, g[0].x - P.x); } else a = P.x < 0 ? 0 : Math.PI; }
    if (pivotEnd === 'a') h.ang = a;
    else { h.x = P.x + Math.cos(a) * h.len; h.y = P.y + Math.sin(a) * h.len; h.ang = a + Math.PI; }
    h.ang = Math.atan2(Math.sin(h.ang), Math.cos(h.ang));
  }
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  // A post or leg swung in the wall facing the view leans across the wall seen end on (the other one it lies in): the
  // pointer's direction from the pivot P, raw, as a lean of that wall, k inches a foot, snapped to the half inch, and
  // onto the lean of a wall in use standing at its foot when within an inch and a quarter (so a corner leg lands on the
  // line where two leaning walls meet). -> the board's angle on its plane, from the pivot to its other end, or null
  // past the steepest lean (then it swings as a brace does).
  function legSwing(h, P, raw) {
    const { axis, t: tP } = parseKey(h.key), other = axis === 'Z' ? 'X' : 'Z', sg = axis === 'Z' ? 1 : -1, sP = Math.sqrt(1 + tP * tP);
    const up = Math.sin(raw), side = Math.cos(raw);
    // (past the steepest lean: h.steep, so the builder is told why it stopped leaning and swings as a brace now)
    h.steep = true;
    if (Math.abs(up) < 0.2) return null;
    const r = sg * side * sP / up;
    if (Math.abs(r) > (LEAN_MAX + 0.75) / 12) return null;
    h.steep = false;
    let k = snapK(r * 12);
    // (the walls of the other family standing at the foot: the pivot when it is the low end, else the free end)
    const Pw = fromPlaneKey(h.key, P.x, P.y), foot = up > 0 ? Pw : fromPlaneKey(h.key, P.x + side * h.len, P.y + up * h.len);
    let bd = 1.25, there = false;
    // (a wall going on up from there: a board of it at the foot, reaching higher; the level below's walls only end there)
    const goesOn = (w) => planeSegments(T(), w).some((sg) => Math.max(sg.src.a.Y, sg.src.b.Y) > foot.Y + 0.5 && pointGap(foot, sg.src).d < 0.25);
    for (const w of wallsInUse(T())) {
      const q = parseKey(w); if (q.axis !== other || !q.k) continue;
      if (Math.abs(offsetAt(w, foot.Y) - across(w, foot)) > 0.1) continue;
      if (goesOn(w)) there = true;
      const d = Math.abs(r * 12 - q.k); if (d < bd) { bd = d; k = q.k; }
    }
    // (a leaning wall of that family already stands at its foot and this lean is not its lean: the board can only be a
    // brace in its own wall there (tower.js wallsInUse), so it swings as a brace does)
    if (there && bd === 1.25) return null;
    const s = up > 0 ? 1 : -1;
    return Math.atan2(sP * s, sg * tOfK(k) * s);
  }
  const fromPlaneKey = (key, u, y) => fromPlane(key, u, y);
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
    for (const k of wallsInUse(t)) if (k[0] === axis) offs.push(offOf(k));     // (upright walls only, here)
    for (const o of offs) if (Math.abs(o - v) < near) { near = Math.abs(o - v); to = o; }
    return clamp(to, -half, half);
  }
  // Pushed in or out with walls that lean about (or a board on a leaning wall): where its wall settles. v: where the
  // board's middle would stand across (feet, its family's axis), Ym: its middle's height. A board that is not level
  // keeps its wall's lean: the place its foot stands across goes onto a wall in use with that same lean if one is within
  // a quarter foot there, else the half foot. A level board (a dot seen end on) lands in any wall in use passing within
  // a quarter foot of it at its height, leaning or not, taking that wall's lean; else it keeps its own. Never past the
  // stones at its foot (on the ground) or past what the steepest lean reaches (higher up). -> the plane's key
  function snapPlane(h, v, Ym) {
    const axis = h.key[0], { t: t0, k: k0 } = parseKey(h.key), w = worldOf(h), level = Math.abs(w.a.Y - w.b.Y) < 1e-6;
    const Yf = Math.min(w.a.Y, w.b.Y) + (Ym - (w.a.Y + w.b.Y) / 2), vf = v + t0 * (Yf - Ym), half = axisHalf(axis);
    const reach = half + (Yf > 0.2 ? LEAN_MAX / 12 * Yf : 0);
    let best = null, near = 0.25;
    const offer = (key, at, from) => { const d = Math.abs(at - from); if (d < near && Math.abs(at) <= reach + 1e-6) { near = d; best = key; } };
    for (const k of wallsInUse(T())) {
      const q = parseKey(k); if (q.axis !== axis) continue;
      if (q.k === k0) offer(k, offsetAt(k, Yf), vf);
      else if (level) offer(k, offsetAt(k, Ym), v);
    }
    if (best) return best;
    // (the stones' edges and the middle, at the foot; else the half foot. Where this family's outer walls lean, the half
    // foot is counted in from each of them as it stands at that height, and the middle is the middle between them, so
    // the board's wall can be set "1 ft in from the front" of a leaning front wall, as its name then says)
    const outer = [1, -1].map((sg) => { const f = axis === 'Z' ? (sg > 0 ? 0 : 2) : (sg > 0 ? 1 : 3), ws = faceWallsOf(f); return ws.length ? offsetAt(ws[0], Yf) : sg * half; });
    let to, n2 = 0.25;
    if (outer[0] !== half || outer[1] !== -half) {
      // (counted from the nearer one only, so the steps read whole half feet from the wall the name goes by)
      const [o, sg] = Math.abs(outer[0] - vf) <= Math.abs(outer[1] - vf) ? [outer[0], 1] : [outer[1], -1];
      to = o - sg * snapTo((o - vf) * sg);
      for (const q of [outer[0], (outer[0] + outer[1]) / 2, outer[1]]) if (Math.abs(q - vf) < n2) { n2 = Math.abs(q - vf); to = q; }
    } else {
      to = snapTo(vf);
      for (const o of [-half, 0, half]) if (Math.abs(o - vf) < n2) { n2 = Math.abs(o - vf); to = o; }
    }
    to = clamp(to, -reach, reach);
    // (a horizontal board that lands in no wall stands in an upright one: it can't show a lean of its own, and a lean
    // kept from the wall it left would name a wall that isn't there)
    return level ? planeKey(axis, to) : planeKey(axis, to - t0 * Yf, k0);
  }
  // the outer walls in use standing on face f's line of stones (tower.js faceWalls: the upright one first)
  const faceWallsOf = (f) => faceWalls(T(), f);
  // are there walls of this family that lean, or does the held board's own wall lean? (if not: everything in and out
  // goes as it always did)
  const leaningAbout = (h) => parseKey(h.key).k !== 0 || [...wallsInUse(T())].some((k) => k[0] === h.key[0] && parseKey(k).k !== 0);
  // move the held board onto the plane `off` of its kind (or the plane key `off`), its a end at in-plane height y (its
  // place along the plane kept): an end that comes near a joint or a board crossing the new plane lands on it, else the
  // half foot
  function snapInOut(h, off, y) {
    h.key = typeof off === 'string' ? off : planeKey(h.key[0], off);
    const ctx = context(h.key), dx = Math.cos(h.ang) * h.len, dy = Math.sin(h.ang) * h.len;
    const pts = [...jointsHere(ctx), ...ctx.segs.flatMap((s) => [{ x: s.ax, y: s.ay }, { x: s.bx, y: s.by }])];
    let best = null;
    for (const [ex, ey] of [[h.x, y], [h.x + dx, y + dy]]) for (const q of pts) { const d = Math.hypot(q.x - ex, q.y - ey); if (d < 0.45 && (!best || d < best.d)) best = { d, ox: q.x - ex, oy: q.y - ey }; }
    // (the half foot of height: on a leaning wall, y runs up its slope)
    const sK = Math.sqrt(1 + parseKey(h.key).t ** 2);
    let ny = best ? y + best.oy : snapTo(y / sK) * sK;
    if (best) h.x += best.ox;
    const low = Math.min(ny, ny + dy); if (low < 0) ny -= low;
    h.y = ny; h.ghost = false;
  }
  // Lean the held board's wall about its foot (seen end on, its top dragged to stand at `at` across and Y high): the
  // lean the drag asks for, k inches a foot, by the half inch (7 at most, in or out), and onto the lean of a wall in
  // use standing at its foot when within an inch and a quarter of it (the board joins that wall). The foot stays put and
  // the board keeps its place and angle on its wall.
  function leanTo(h, foot, at, Y) {
    const axis = h.key[0], rise = Y - foot.Y;
    if (rise < 0.3) return;
    const r = (at - across(h.key, foot)) / rise, k0 = parseKey(h.key).k;
    // (with a little give: the lean moves on to the next half inch only once the drag is well past the middle between)
    let k = Math.abs(r * 12 - k0) < LEAN_STEP * 0.75 ? k0 : snapK(r * 12), key = null, bd = 1.25;
    for (const w of wallsInUse(T())) {
      const q = parseKey(w); if (q.axis !== axis || !q.k) continue;
      if (Math.abs(offsetAt(w, foot.Y) - across(w, foot)) > 0.1) continue;
      const d = Math.abs(r * 12 - q.k); if (d < bd) { bd = d; k = q.k; key = w; }
    }
    if (!key) {
      // (the same lean as now: nothing moves)
      if (k === parseKey(h.key).k) return;
      key = planeKey(axis, across(h.key, foot) - tOfK(k) * foot.Y, k);
    }
    if (key === h.key) return;
    placeFoot(h, key, foot);
  }
  // the held board onto the plane `key`, its foot (lower end) at the world point `foot`, its angle on its wall kept
  function placeFoot(h, key, foot) {
    const w = worldOf(h), aIsFoot = w.a.Y <= w.b.Y, F = toPlane(key, foot);
    h.key = key;
    if (aIsFoot) { h.x = F.u; h.y = F.y; } else { h.x = F.u - Math.cos(h.ang) * h.len; h.y = F.y - Math.sin(h.ang) * h.len; }
    h.ghost = false;
    sound.clatter(h.len * 0.5, 'set', undefined, 0.2);
  }
  // which way the held board is seen: face on (slide and swing on its plane) or end on (push it in and out), with a
  // little give round 45 degrees. A post seen end on from one of its planes is face on in the other: it moves over to
  // that one (so from the side it slides along the side's plane). Not while a finger is moving it.
  function updateView(h) {
    if (!h || (gesture && gesture.kind === 'grab')) return;
    const off = offSquare(h.key);
    if (lineLike(h)) {
      if (off > END_ON) {
        const w = worldOf(h);
        if (isPost(w)) { const mid = w.a; if (!h.n) h.n = h.key[0]; h.key = crossKey(h.key, mid); const p = toPlane(h.key, mid); h.x = p.u; }
        else {
          // a leg (or a board straight up a leaning wall): over to its other wall, where it leans the way it does
          const other = planesOf(w).find((k) => k !== h.key);
          if (other) {
            if (!h.n) h.n = h.key[0];
            const A = toPlane(other, w.a), B = toPlane(other, w.b);
            h.key = other; h.x = A.u; h.y = A.y; h.ang = Math.atan2(B.y - A.y, B.u - A.u); h.leg = !upright(h);
          }
        }
      }
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
      // (a board starting where the builder left off stays there while the finger is still near where it came onto the
      // view; carried on further, it goes where the finger takes it, as always)
      if (h.start && !h.left) {
        const r = el.view.getBoundingClientRect();
        if (!h.entry) h.entry = { x: cx, y: cy };
        if (Math.hypot(cx - h.entry.x, cy - h.entry.y) < Math.max(70, Math.min(0.3 * r.width, START_REACH))) { app.dirty = true; return; }
        // (from here on it is a piece carried in as always: nothing of its start spot kept)
        h.left = true; h.n = undefined; h.leg = false; h.turned = false;
      }
      h.key = app.pickPlane(cx, cy, h.len);
      const p = app.toPlane(h.key, cx, cy); if (!p) return;
      const ctx = context(h.key);
      // (the corner lines of an outer wall: straight up from the stones, or slanting with the leaning walls round them)
      const corners = ctx.lines.filter((l) => l.corner);
      const uOn = (l, y) => l.ax + (l.bx - l.ax) * (y - l.ay) / (l.by - l.ay);
      // (how near counts: two thirds of the way to the middle of the wall at that height, 1.3 ft at most)
      const us = corners.map((l) => uOn(l, p.y)), uL = Math.max(-ctx.half, ...us.filter((u, i) => corners[i].ax < 0)), uR = Math.min(ctx.half, ...us.filter((u, i) => corners[i].ax > 0));
      const hw = corners.length && uR > uL ? (corners.some((l) => l.bx !== l.ax) ? (uR - uL) / 2 : ctx.half) : ctx.half;
      let near = null, nd = Math.min(1.3, hw * 0.68);
      for (const l of corners) { const d = Math.abs(p.x - uOn(l, p.y)); if (d < nd) { nd = d; near = l; } }
      h.ang = near !== null ? Math.atan2(near.by - near.ay, near.bx - near.ax) : 0;
      // the pointer holds the board's middle (an upright one: a bit below its middle, so it can reach the ground)
      let mx = p.x - Math.cos(h.ang) * h.len / 2, my = p.y - Math.sin(h.ang) * h.len * (near !== null ? 0.35 : 0.5);
      h.leg = false;
      if (near !== null) {
        // an upright board by a corner settles onto the ground, or onto the top of the post standing there (on a
        // slanting corner line: along the line, onto the top of the leg below, so the lean goes on up)
        let base = 0, bu = near.ax;
        for (const s of ctx.segs) {
          if (Math.abs(s.ax - uOn(near, s.ay)) >= 0.01 || Math.abs(s.bx - uOn(near, s.by)) >= 0.01) continue;
          const top = Math.max(s.ay, s.by); if (top <= p.y + 1.5 && top > base) { base = top; bu = s.ay > s.by ? s.ax : s.bx; }
        }
        mx = near.bx === near.ax ? near.ax : bu; my = base;
        if (near.bx !== near.ax) { h.leg = true; h.n = h.key[0]; }
      }
      h.endOn = false;
      snapMove(h, mx, my);
    }
    app.dirty = true;
  }

  // ── near the top or bottom of the view while dragging a board: climb the tower ────────────────────────────────────
  // (only once the finger has gone on into the band beyond where it pressed: a handle near the top of the view, a tall
  // board's top or a leg's, is grabbed and swung there without the view climbing away under it)
  function edgeWatch(cy, top = 0.12, bot = 0.9) {
    const r = el.view.getBoundingClientRect(), fy = (cy - r.top) / r.height, f0 = gesture && gesture.fy0 !== undefined ? gesture.fy0 : 0.5;
    app.autoScroll = fy < top && fy < Math.min(top, f0) - EDGE_GIVE ? 1 : fy > bot && fy > Math.max(bot, f0) + EDGE_GIVE ? -1 : 0;
  }
  const EDGE_GIVE = 0.03;     // of the view's height: how far past the press (or the band's edge) the finger must go
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
  // (No overhang is offered where what would be left between the nails is shorter than half a foot: the saw never
  // makes a piece shorter than that, so no stub of a few inches can be fitted inside a corner of legs.)
  function overhangOf(len, ts, top) {
    if (ts.length < 2) return [];
    const lo = Math.max(0, Math.min(...ts)), hi = Math.min(len, Math.max(...ts)), out = [];
    if (hi - lo < SCRAP - 1e-6) return out;
    if (lo > 0.12 && top !== 'a') out.push({ end: 'a', t0: 0, t1: lo });
    if (len - hi > 0.12 && top !== 'b') out.push({ end: 'b', t0: hi, t1: len });
    return out;
  }
  const topEnd = (a, b) => (Math.abs(a.X - b.X) < 0.1 * Math.hypot(a.X - b.X, a.Y - b.Y, a.Z - b.Z) + 1e-9 && Math.abs(a.Z - b.Z) < 0.1 * Math.hypot(a.X - b.X, a.Y - b.Y, a.Z - b.Z) + 1e-9 ? (b.Y > a.Y ? 'b' : 'a') : null);
  // the held board's overhangs
  // (a leg's top above its last crosspiece is no overhang either: the next leg goes on up from there)
  const legTop = (a, b) => (b.Y > a.Y ? 'b' : 'a');
  function heldOverhang() { const h = app.held; if (!h) return []; const w = worldOf(h); return overhangOf(h.len, contactsOf(h).map((c) => c.t), lineLike(h) && !upright(h) ? legTop(w.a, w.b) : topEnd(w.a, w.b)); }
  // a nailed board's overhangs: { board, list }
  function nailedOverhang(src) {
    if (!src || !T().boards.includes(src)) return null;
    const ts = contactsIn3D(src, T().boards).map((c) => c.t), line = !isPost(src) && isCornerLine(T(), src);
    return { board: src, list: overhangOf(src.len, ts, line ? legTop(src.a, src.b) : topEnd(src.a, src.b)) };
  }
  // saw a board off at t (feet from its a end), keeping the part on the far side of `end`
  function sawOff(len, o, nailed = false) { sound.saw(len, o.t1 - o.t0); const off = o.t1 - o.t0; const kept = addOffcut(off); renderPanel(); app.onSawOff && app.onSawOff(off, kept, nailed); }
  function cutHeld(o) {
    const h = app.held; if (!h) return;
    const s = segOf(h), dx = (s.bx - s.ax) / s.len, dy = (s.by - s.ay) / s.len, before = h.len;
    if (o.end === 'a') { h.x = s.ax + dx * o.t1; h.y = s.ay + dy * o.t1; h.len -= o.t1; }
    else h.len = o.t0;
    h.piece.len = h.len; h.piece.full = false; h.fresh = false; h.hist = []; h.cutNow = true;
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
  // the end handles stay inside the view (inView): an end up under the top bar, or off the screen, has its handle held
  // short of it. A press on the board between that handle and the real end means that handle. -> 'a', 'b' or null
  const HANDLE_TOP = 58;
  const inViewOf = (r, q, m = 18) => ({ x: clamp(q.x, m, r.width - m), y: clamp(q.y, HANDLE_TOP, r.height - m) });
  function handleBeyond(h, cx, cy) {
    const r = el.view.getBoundingClientRect(), s = segOf(h), p = { x: cx - r.left, y: cy - r.top };
    const ends = { a: heldScreen(h, s.ax, s.ay), b: heldScreen(h, s.bx, s.by) };
    const lean = h.endOn && !levelH(h) ? (Math.sin(h.ang) > 0 ? 'b' : 'a') : null;
    for (const end of ['a', 'b']) {
      if (h.endOn && end !== lean) continue;
      const E = ends[end], H = inViewOf(r, E);
      if (Math.hypot(E.x - H.x, E.y - H.y) < 6) continue;
      if (distToSeg(p, H, E) < 26 && Math.hypot(p.x - H.x, p.y - H.y) > 16) return end;
    }
    return null;
  }

  // ── the view's pointers: handles, stones, overhangs, walking round, zooming, taps ───────────────────────────────
  const pointers = new Map();          // every finger or mouse button down on the view: id -> { x, y }
  let gesture = null;                  // what the one pointer that started it is doing
  const now = () => performance.now();
  const TAP_MS = 300;                  // a press on the held board shorter than this, that hardly moves, is a tap
  // would the held board lie right on top of another one, along its line over most of it (more than half the shorter
  // one)? Two boards can't fill one spot: it can't be nailed there. (A splice lapping a little along a leg's line is
  // fine.)
  function doubled(t, g) {
    const len = Math.hypot(g.b.X - g.a.X, g.b.Y - g.a.Y, g.b.Z - g.a.Z) || 1, d = { X: (g.b.X - g.a.X) / len, Y: (g.b.Y - g.a.Y) / len, Z: (g.b.Z - g.a.Z) / len };
    const along = (p) => (p.X - g.a.X) * d.X + (p.Y - g.a.Y) * d.Y + (p.Z - g.a.Z) * d.Z;
    const off = (p) => { const s = along(p); return Math.hypot(p.X - g.a.X - s * d.X, p.Y - g.a.Y - s * d.Y, p.Z - g.a.Z - s * d.Z); };
    return t.boards.some((o) => {
      if (off(o.a) > 0.1 || off(o.b) > 0.1) return false;
      const s0 = along(o.a), s1 = along(o.b), over = Math.min(len, Math.max(s0, s1)) - Math.max(0, Math.min(s0, s1));
      return over > 0.5 * Math.min(len, o.len);
    });
  }
  // ── Undo with a board in hand: its last move ─────────────────────────────────────────────────────────────────────
  // Every slide, swing, lean or turn of the held board keeps how it was before (h.hist), so Undo takes the last one
  // back; with none left, Undo puts the board back on the pile. (A saw cut changes the wood itself: it clears them.)
  const SNAP_SKIP = new Set(['piece', 'hist', 'cutNow']);
  const snapOfHeld = (h) => { const o = {}; for (const k of Object.keys(h)) if (!SNAP_SKIP.has(k)) o[k] = h[k]; return o; };
  const sameHeld = (h, o) => ['key', 'x', 'y', 'ang', 'n', 'leg', 'endOn', 'len'].every((k) => (typeof h[k] === 'number' ? Math.abs(h[k] - o[k]) < 1e-9 : h[k] === o[k]));
  function keepHist(o) { const h = app.held; if (!h || !o || sameHeld(h, o)) return; (h.hist || (h.hist = [])).push(o); if (h.hist.length > 40) h.hist.shift(); }
  function undoHeld() {
    const h = app.held; if (!h || !h.hist || !h.hist.length) return false;
    const o = h.hist.pop();
    for (const k of Object.keys(h)) if (!SNAP_SKIP.has(k) && !(k in o)) delete h[k];
    Object.assign(h, o); sound.clatter(h.len * 0.6, 'set', undefined, 0.35); app.dirty = true;
    return true;
  }
  function startGrab(mode, e, extra = {}) {
    const h = app.held; if (!h) return;
    extra = { snap: snapOfHeld(h), snapPiece: h.piece, ...extra };
    e.preventDefault(); e.stopPropagation(); sound.audioOn();
    updateView(h);
    let g;
    if (mode === 'move' && h.endOn) {
      // seen end on: in and out (across its plane) and up and down, on the plane at right angles through its middle
      const w = worldOf(h), mid = { X: (w.a.X + w.b.X) / 2, Y: (w.a.Y + w.b.Y) / 2, Z: (w.a.Z + w.b.Z) / 2 }, cross = crossKey(h.key, mid);
      const hit = app.toWorld(cross, e.clientX, e.clientY); if (!hit) return;
      g = { kind: 'grab', mode: 'inout', cross, o0: offOf(h.key) - across(h.key, hit), y0: h.y - hit.Y,
        // (on or among leaning walls: where its middle stands across and how high, and its a end's height)
        m0: offsetAt(h.key, mid.Y) - across(h.key, hit), ym0: mid.Y - hit.Y, ya0: w.a.Y - hit.Y };
    } else if (mode !== 'move' && h.endOn) {
      // seen end on, its top's handle: lean its wall about its foot, the top following the finger on the plane at right
      // angles through the top (so it moves just as far as the finger does, however far behind the foot it stands)
      const w = worldOf(h), foot = footOf(w), top = topOf(w), cross = crossKey(h.key, top);
      const hit = app.toWorld(cross, e.clientX, e.clientY); if (!hit) return;
      // (how far a half inch a foot moves the top on the screen: on a phone, a short board seen from afar moves a few
      // pixels a step, too fine for a finger, so the finger's move counts for less, LEAN_PX pixels a step at least)
      const step = LEAN_STEP / 12 * Math.max(0.3, top.Y - foot.Y), ax = h.key[0], P0 = app.worldToScreen(top.X, top.Y, top.Z);
      const P1 = app.worldToScreen(top.X + (ax === 'X' ? step : 0), top.Y, top.Z + (ax === 'Z' ? step : 0));
      const px = Math.hypot(P1.x - P0.x, P1.y - P0.y), want = e.pointerType === 'mouse' ? LEAN_PX_MOUSE : LEAN_PX;
      g = { kind: 'grab', mode: 'lean', cross, foot, dA: across(h.key, top) - across(h.key, hit), dY: top.Y - hit.Y, a0: across(h.key, hit), gain: px > 0 && px < want ? px / want : 1 };
    } else {
      const p = app.toPlane(h.key, e.clientX, e.clientY); if (!p) return;
      g = { kind: 'grab', mode, ox: h.x - p.x, oy: h.y - p.y, legSwing: mode !== 'move' && lineLike(h) };
    }
    const vr = el.view.getBoundingClientRect();
    gesture = { ...g, id: e.pointerId, x: e.clientX, y: e.clientY, t0: now(), moved: false, fy0: (e.clientY - vr.top) / vr.height, ...extra };
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
  el.nailBtn.addEventListener('click', () => { if (app.held && contactsOf(app.held).length && !doubled(T(), worldOf(app.held))) app.nail(); });

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
      // a press on the part of the board beyond a handle held inside the view (its real end is up under the top bar, or
      // off the screen): that handle, as if pressed right on it
      const beyond = handleBeyond(h, e.clientX, e.clientY);
      if (beyond) { startGrab(beyond, e); return; }
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
      if (pointers.size >= 2) { const [p, q] = [...pointers.values()]; app.setZoom(gesture.z0 * gesture.d0 / Math.max(20, Math.hypot(p.x - q.x, p.y - q.y))); app.pinchAt = now(); }
      return;
    }
    if (!gesture || e.pointerId !== gesture.id) return;
    if (gesture.kind === 'grab') {
      const h = app.held; if (!h) return;
      if (!gesture.moved && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) < 6) return;
      if (gesture.mode === 'inout') {
        const hit = app.toWorld(gesture.cross, e.clientX, e.clientY); if (!hit) return;
        gesture.moved = true; h.fresh = false;
        if (!leaningAbout(h)) snapInOut(h, snapOffset(h.key[0], across(h.key, hit) + gesture.o0), hit.Y + gesture.y0);
        else {
          const key = snapPlane(h, across(h.key, hit) + gesture.m0, hit.Y + gesture.ym0), { t } = parseKey(key);
          snapInOut(h, key, (hit.Y + gesture.ya0) * Math.sqrt(1 + t * t));
        }
        edgeWatch(e.clientY); app.dirty = true; return;
      }
      if (gesture.mode === 'lean') {
        const hit = app.toWorld(gesture.cross, e.clientX, e.clientY); if (!hit) return;
        gesture.moved = true; h.fresh = false;
        leanTo(h, gesture.foot, gesture.a0 + (across(h.key, hit) - gesture.a0) * gesture.gain + gesture.dA, hit.Y + gesture.dY);
        app.dirty = true; return;
      }
      const p = app.toPlane(h.key, e.clientX, e.clientY); if (!p) return;
      gesture.moved = true; h.fresh = false;
      if (gesture.mode !== 'move' && !gesture.pivoted) {
        // (a post or leg about to be leaned keeps its foot where it rests on a board: settling the pivot onto a joint is
        // for braces, and a tier's post set in along its beam would jump onto the beam's end. If the swing goes on past
        // the steepest lean into a brace, the pivot settles then.)
        const pe = gesture.mode === 'a' ? 'b' : 'a';
        gesture.pivoted = true; gesture.keepFoot = gesture.legSwing && contactsOf(h).some((c) => c.end === pe && c.other);
        if (!gesture.keepFoot) snapPivot(h, pe);
      }
      if (gesture.mode === 'move') { snapMove(h, p.x + gesture.ox, p.y + gesture.oy); edgeWatch(e.clientY); }
      else {
        const pe = gesture.mode === 'a' ? 'b' : 'a';
        snapSwing(h, pe, p.x, p.y, gesture.legSwing); h.ghost = false;
        if (gesture.keepFoot && !h.asLeg) { gesture.keepFoot = false; snapPivot(h, pe); snapSwing(h, pe, p.x, p.y, gesture.legSwing); }
        // (a leg leaning by the half inch: its top only moves sideways, never needs the view to climb)
        if (gesture.legSwing && h.asLeg) stopEdge(); else edgeWatch(e.clientY, 0.1, 0.92);
      }
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
    if (app.held) app.held.steep = false;
    const hist = g.kind === 'grab' && app.held && g.snap && app.held.piece === g.snapPiece ? g.snap : null;
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
    if (hist && app.held && !app.held.cutNow) keepHist(hist);
    if (app.held) delete app.held.cutNow;
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
  el.view.addEventListener('wheel', (e) => { e.preventDefault(); app.setZoom(app.zoom * Math.exp(e.deltaY * 0.0012)); app.pinchAt = now(); }, { passive: false });

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
    h.turned = true; h.leg = false;
    const mx = h.x + Math.cos(h.ang) * h.len / 2, my = h.y + Math.sin(h.ang) * h.len / 2;
    h.ang = steps[i] * DEG; snapMove(h, mx - Math.cos(h.ang) * h.len / 2, my - Math.sin(h.ang) * h.len / 2); h.fresh = false; app.dirty = true;
    sound.clatter(h.len * 0.6, 'set', undefined, 0.35);
  }

  // a brace (not level, not upright, not a knee brace: on a narrow plane a short brace reaching post to post counts)
  // that closes no triangle on its plane, with an end stopping close to a joint but not on it: [{ x, y }] the contact
  // at that end (the quick drop that leaves a brace's foot half a foot off the corner, nailed to the post a little way up)
  function cornerMiss(h, cs) {
    if (lineLike(h)) return [];     // (a post or a leg is no brace)
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
    // (seen end on, the end handles hide, but a board that is not level keeps one on its top end: drag it to lean the wall)
    const leanEnd = show && h.endOn && !levelH(h) ? (Math.sin(h.ang) > 0 ? 'b' : 'a') : null;
    el.gMove.hidden = !show; el.gA.hidden = !show || (h.endOn && leanEnd !== 'a'); el.gB.hidden = !show || (h.endOn && leanEnd !== 'b');
    el.gA.classList.toggle('is-lean', leanEnd === 'a'); el.gB.classList.toggle('is-lean', leanEnd === 'b');
    el.nailBtn.hidden = !show; el.view.classList.toggle('is-holding', show); el.view.classList.toggle('is-endon', show && h.endOn);
    if (!show) el.view.classList.remove('is-short');
    let out = '', hint = '';
    overTags = []; heldInfo = null;
    showUpNext(building);
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
      // (and zooming in on it, or letting it go off to one side, the view slides after it: never under a finger moving it)
      if (!carrying && (!gesture || gesture.kind === 'pinch') && app.keepInView) app.keepInView(A, B, r, !!gesture);
      const inView = (q, m = 18) => inViewOf(r, q, m);
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
      // (seen end on, the lean handle sits on the top end, or past it along the board when the board is short there)
      let leanAt = null;
      if (leanEnd) {
        const T0 = leanEnd === 'a' ? A : B, F0 = leanEnd === 'a' ? B : A, sl = Math.hypot(T0.x - F0.x, T0.y - F0.y) || 1;
        const push = Math.max(0, 46 - sl / 2);
        leanAt = inView({ x: T0.x + (T0.x - F0.x) / sl * push, y: T0.y + (T0.y - F0.y) / sl * push });
      }
      place(el.gMove, moveAt); place(el.gA, leanEnd === 'a' ? leanAt : inView(A)); place(el.gB, leanEnd === 'b' ? leanAt : inView(B));
      // (every label from here on keeps clear of the others, the check and the handles)
      const tag = tagPlacer(r, [box(nailAt, 54), box(moveAt, 42), ...(h.endOn ? (leanAt ? [box(leanAt, 40)] : []) : [box(inView(A), 34), box(inView(B), 34)])]);
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
        // (at an end with its handle on it, the handle itself turns green: one signal, no ring. A ring only where the
        // board's middle crosses or meets another board, or at an end with no handle, seen end on)
        if (c.end && (!h.endOn || c.end === leanEnd)) continue;
        rings += `<circle class="joint" cx="${P.x}" cy="${P.y}" r="12"/>`;
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
        // a level board between two legs of a wall that tapers (or flares): how far apart the legs stand at its height,
        // so a piece can be cut to fit them ("legs 4 ft apart here")
        const gap = !h.endOn && Math.abs(s.ay - s.by) < 1e-6 ? legGap(h.key, s) : null;
        if (gap) {
          const words = `legs ${fmt(gap)} apart here`, gw = words.length * 7 + 20;
          const tg = tag(gw, 22, [[40, 90], [40, -90], [100, 0], [-40, 90], [-40, -90], [130, 0]].map(([n, a]) => ({ x: M.x + nx * n + tx * a, y: M.y + ny * n + ty * a })));
          tags += `<g class="len gap"><rect x="${tg.x - gw / 2}" y="${tg.y - 11}" width="${gw}" height="22" rx="6"/><text x="${tg.x}" y="${tg.y + 4}">${words}</text></g>`;
        }
      }
      // a post or leg swung on past the steepest lean: it swings as a brace from there, and a tag by its moving end says why
      if (h.steep && gesture && gesture.kind === 'grab' && gesture.legSwing && !h.endOn) {
        const E = gesture.mode === 'a' ? A : B, words = `steepest: ${LEAN_MAX} inches for every foot up`, w = words.length * 7 + 22;
        const tt = tag(w, 24, [[0, -40], [0, 40], [w / 2 + 30, 0], [-w / 2 - 30, 0], [0, -70]].map(([dx, dy]) => ({ x: E.x + dx, y: E.y + dy })));
        tags += `<g class="planetag is-lean"><rect x="${tt.x - w / 2}" y="${tt.y - 12}" width="${w}" height="24" rx="12"/><text x="${tt.x}" y="${tt.y + 5}">${words}</text></g>`;
      }
      // seen end on: which plane it is on, right by it ("1½ ft in from the front"; "front wall, leaning 2 inches in for every foot up";
      // a board that could lean but doesn't: "front wall, upright")
      const wHeld = worldOf(h), footY = Math.min(wHeld.a.Y, wHeld.b.Y);
      planeText = planeName(t, h.key, true, footY);
      // (never over the check or a handle: if there is no free spot by it, the name in the chip at the top says it)
      // While its top is being dragged to lean the wall, how it leans goes right above the handle, by the finger,
      // never spared (on a phone the name has no room by the board): "2 inches in for every foot up", "upright".
      const leaning = h.endOn && leanAt && gesture && gesture.kind === 'grab' && gesture.mode === 'lean';
      if (leaning) {
        const comma = planeText.indexOf(', leaning'), words = comma >= 0 ? bareLean(planeText.slice(comma + 2)) : 'upright';
        const w = Math.max(80, words.length * 7.2 + 22);
        const tt = tag(w, 26, [[0, -46], [0, -76], [-w / 2 - 34, 0], [w / 2 + 34, 0], [0, 46]].map(([dx, dy]) => ({ x: leanAt.x + dx, y: leanAt.y + dy })));
        tags += `<g class="planetag is-lean is-drag"><rect x="${tt.x - w / 2}" y="${tt.y - 13}" width="${w}" height="26" rx="13"/><text x="${tt.x}" y="${tt.y + 5}">${words}</text></g>`;
      } else if (h.endOn) {
        const words = planeText + (leanEnd && !parseKey(h.key).k ? ', upright' : '');
        const w = Math.max(96, words.length * 7.4 + 22);
        const tt = tag(w, 24, [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 1.7], [0, -1.7], [0, 2.4], [0, -2.4]].map(([a, b]) => ({ x: M.x + a * (w / 2 + 30), y: M.y + b * 52 })), true);
        if (tt) tags += `<g class="planetag${parseKey(h.key).k ? ' is-lean' : ''}"><rect x="${tt.x - w / 2}" y="${tt.y - 12}" width="${w}" height="24" rx="12"/><text x="${tt.x}" y="${tt.y + 5}">${words}</text></g>`;
      } else if (lineLike(h) && !isPost(wHeld)) {
        // a leg, face on: how it leans across the wall seen end on ("1½ inches in for every foot up"), by its top
        // (only where that is a wall it can lean with: tower.js secondWall)
        const ps = planesOf(wHeld), sw = secondWall(t, wHeld), other = ps[0] === h.key ? sw : sw === h.key ? ps[0] : null, lw = other && parseKey(other).k ? bareLean(leanWords(t, other, footY)) : null;
        if (lw) {
          // (by its top's handle as drawn: a top up under the bar has its handle held lower, and the words go by that)
          const T0 = inView(wHeld.a.Y <= wHeld.b.Y ? B : A), w = Math.max(96, lw.length * 7 + 22);
          // (never spared: how it leans is what the builder is setting; a narrow phone finds it a place to one side)
          const tt = tag(w, 24, [[0, -40], [0, 40], [w / 2 + 30, 0], [-w / 2 - 30, 0], [-w / 2 + 20, -40], [w / 2 - 20, -40], [-w / 2 + 20, 40], [w / 2 - 20, 40], [0, -70]].map(([dx, dy]) => ({ x: T0.x + dx, y: T0.y + dy })));
          if (tt) tags += `<g class="planetag is-lean"><rect x="${tt.x - w / 2}" y="${tt.y - 12}" width="${w}" height="24" rx="12"/><text x="${tt.x}" y="${tt.y + 5}">${lw}</text></g>`;
        }
      }
      out += tags;
      const dup = cs.length > 0 && doubled(t, wHeld), ok = cs.length > 0 && !dup;
      el.nailBtn.disabled = !ok;
      hint = dup ? 'A board is already right there: slide it off that one first'
        : h.fresh && h.start && !h.left ? 'It starts where you left off · carry it further to put it somewhere else'
        : h.endOn ? (leanEnd ? (ok ? 'Seen end on: drag it in or out · drag its top to lean the wall · ✓ to nail' : 'Seen end on: drag it in or out, or drag its top to lean the wall')
          : ok ? 'Seen end on: drag it in or out · ✓ to nail it' : 'Seen end on: drag it in or out, onto a board')
        : h.steep && gesture && gesture.legSwing ? `Past the steepest lean (${LEAN_MAX} inches for every foot up): it swings as a brace now`
        : !ok ? 'Touch it to a board or the ground to nail it'
        : miss.length ? 'Slide or swing its end onto the corner, so it makes a triangle'
        : over.length ? 'Tap ✂ saw off (or the pale end) to cut it at the joint, or ✓ to nail it'
        : h.ghost ? 'Lined up with its twin: ✓ to nail it'
        : h.leg ? 'A leg: swing its top to lean it · turn a quarter to lean it the other way · ✓ to nail it'
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
    if (!hint && building && el.upNext && !el.upNext.hidden && upUsed < 2) hint = 'Put it up: the board on the bench starts where you left off';
    if (hint !== hintText) { hintText = hint; el.hint.textContent = hint; }
  }

  return { freshStack, renderPanel, frame, putBack, undoHeld, returnPiece, contactsOf, cut, takeUp, snapMove, snapSwing, snapInOut, snapOffset, snapPlane, leanTo, lineLike, toBench, turnHeld, payFor, woodFor, addOffcut,
    heldOverhang, cutHeld, nailedOverhang, cutNailed, fullCount, giveBoard, cornerMiss, jointsHere, context, worldOf, flash, groups,
    get heldInfo() { return heldInfo; }, get planeText() { return planeText; }, get cutAt() { return cutAt; }, set cutAt(v) { cutAt = v; renderPanel(); } };
}
