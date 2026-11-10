// THE SHIP LAB'S DRAWINGS: the deck plan (from above, nose to the left, the ship's left (port) at the bottom, as
// his deck plan) and the side section (from the ship's left, nose to the left, as his section view), on one scale
// and lined up, over the space the shell has inside. Editing happens on the plan:
//   drag a room's wall (every room's wall on that line moves with it, and its doors), drag an item or a door
//   (a door snaps onto the nearest wall); a tap selects; drag empty space to move the view; wheel or pinch to zoom;
//   double-click (or double-tap) to fit.
import { ROOM_KINDS, ITEM_KINDS, doorWall, doorReach, hangs, wallsAt, snap, normRect, HEAD, CEIL, outlineOf } from './blueprint.js';

const COL = {
  bg: '#0a0f16', grid: 'rgba(120,150,180,0.10)', grid1: 'rgba(120,150,180,0.20)', mid: 'rgba(159,220,255,0.35)',
  top: '#16202c', topEdge: '#2f3d50', hull: '#222d3a', hullEdge: '#4a5b70',
  bands: [[0, '#3a2a2a'], [1.0, '#4a3c26'], [2.0, '#2d4a48'], [2.5, '#3c5368']], raised: '#45365c',
  floorLine: 'rgba(232,238,245,0.75)', headLine: '#f2b547', ceilLine: '#4fd6ff',
  door: '#ffe08a', outer: '#ffb347', sel: '#ffffff', bad: 'rgba(255,64,64,0.6)', badLine: '#ff5050', text: '#e8eef5', dim: '#9fb0c2',
};
const FONT = 'system-ui, "Segoe UI", Roboto, "DejaVu Sans", sans-serif';

export class Plan {
  constructor(canvas, hooks) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.h = hooks;   // hooks: { data(), select(sel), edit(fn, live), commit(), tip(text) }
    this.mode = 'plan'; this.V = { s: 40, cz: 0, cx: 0, ch: 1.4 }; this.P = null; this.S = null; this.fitted = false;
    this.show = { space: true, checks: true };
    this.ptrs = new Map(); this.drag = null; this.hImg = null; this.hFor = null;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    canvas.addEventListener('dblclick', () => { this.fit(); this.draw(); });
  }
  // the drawing's region (CSS px) and what it shows: 'plan' or 'both' (the plan above the side section)
  place(x, y, w, h, mode) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    Object.assign(this.c.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', display: w > 0 && h > 0 ? 'block' : 'none' });
    this.c.width = Math.max(1, Math.round(w * dpr)); this.c.height = Math.max(1, Math.round(h * dpr)); this.dpr = dpr;
    this.W = w; this.H = h; const changed = this.mode !== mode; this.mode = mode;
    const top = 8;
    if (mode === 'both') { const ph = Math.round((h - top) * 0.56); this.P = { x: 0, y: top, w, h: ph }; this.S = { x: 0, y: top + ph, w, h: h - top - ph }; }
    else { this.P = { x: 0, y: top, w, h: h - top }; this.S = null; }
    if (!this.fitted || changed) this.fit();
  }
  fit() {
    const P = this.P, S = this.S; if (!P) return;
    let s = Math.min(P.w / 18.4, P.h / 7.4); if (S) s = Math.min(s, S.h / 6.9);
    this.V = { s, cz: -0.1, cx: 0, ch: 1.3 }; this.fitted = true;
  }
  // world <-> screen
  pX(z) { return this.P.x + this.P.w / 2 - (z - this.V.cz) * this.V.s; }
  pY(x) { return this.P.y + this.P.h / 2 + (x - this.V.cx) * this.V.s; }
  sY(h) { return this.S.y + this.S.h / 2 - (h - this.V.ch) * this.V.s; }
  world(sx, sy) { return { z: this.V.cz - (sx - this.P.x - this.P.w / 2) / this.V.s, x: this.V.cx + (sy - this.P.y - this.P.h / 2) / this.V.s }; }
  inPlan(sx, sy) { const P = this.P; return P && sx >= P.x && sx <= P.x + P.w && sy >= P.y && sy <= P.y + P.h; }
  zoomAt(sx, sy, k) {
    const V = this.V, s2 = Math.max(6, Math.min(400, V.s * k)), kk = s2 / V.s;
    // (keep the point under the pointer where it is, along; across too on the plan)
    const zc = V.cz - (sx - this.P.x - this.P.w / 2) / V.s; V.cz = zc + (V.cz - zc) / kk;
    if (this.inPlan(sx, sy)) { const xc = V.cx + (sy - this.P.y - this.P.h / 2) / V.s; V.cx = xc + (V.cx - xc) / kk; }
    V.s = s2; this.draw();
  }

  // ── pointer: drag a wall, an item or a door; tap to select; drag elsewhere to move the view ────────────────────────
  hit(sx, sy, touch) {
    const D = this.h.data(); if (!D.bp || !this.inPlan(sx, sy)) return null;
    const { bp } = D, w = this.world(sx, sy), tol = (touch ? 16 : 8) / this.V.s;
    // doors first (they sit on walls), then items, then walls, then rooms
    for (const d of bp.doors || []) {
      const wl = doorWall(bp, d) || { along: d.hatch ? 'hatch' : 'z', x: d.at[0], span: [d.at[1] - d.width / 2, d.at[1] + d.width / 2], rect: [d.at[0] - d.width / 2, d.at[1] - d.width / 2, d.at[0] + d.width / 2, d.at[1] + d.width / 2] };
      const near = d.hatch ? w.x > wl.rect[0] - tol && w.x < wl.rect[2] + tol && w.z > wl.rect[1] - tol && w.z < wl.rect[3] + tol : wl.along === 'z' ? Math.abs(w.x - (wl.x ?? d.at[0])) < tol && w.z > wl.span[0] - tol && w.z < wl.span[1] + tol : Math.abs(w.z - (wl.z ?? d.at[1])) < tol && w.x > wl.span[0] - tol && w.x < wl.span[1] + tol;
      if (near) return { type: 'door', id: d.id };
    }
    for (const it of [...(bp.items || [])].reverse()) { const r = it.rect; if (w.x >= r[0] && w.x <= r[2] && w.z >= r[1] && w.z <= r[3]) return { type: 'item', id: it.id }; }
    // walls: prefer the selected room's
    const sel = D.sel, order = [...bp.rooms].sort((a, b) => (sel?.type === 'room' && b.id === sel.id) - (sel?.type === 'room' && a.id === sel.id));
    for (const r of order) {
      const [x0, z0, x1, z1] = r.rect, inZ = w.z > z0 - tol && w.z < z1 + tol, inX = w.x > x0 - tol && w.x < x1 + tol;
      if (inZ && Math.abs(w.x - x0) < tol) return { type: 'wall', id: r.id, side: 0 };
      if (inZ && Math.abs(w.x - x1) < tol) return { type: 'wall', id: r.id, side: 2 };
      if (inX && Math.abs(w.z - z0) < tol) return { type: 'wall', id: r.id, side: 1 };
      if (inX && Math.abs(w.z - z1) < tol) return { type: 'wall', id: r.id, side: 3 };
    }
    for (const r of [...bp.rooms].reverse()) { const q = r.rect; if (w.x > q[0] && w.x < q[2] && w.z > q[1] && w.z < q[3]) return { type: 'room', id: r.id }; }
    return null;
  }
  down(e) {
    this.c.setPointerCapture(e.pointerId);
    this.ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY, x0: e.offsetX, y0: e.offsetY });
    if (this.ptrs.size === 2) { this.drag = null; this.pinch = 0; return; }
    const touch = e.pointerType === 'touch', h = this.hit(e.offsetX, e.offsetY, touch), D = this.h.data();
    // a double tap fits the view
    const now = performance.now(); if (touch && now - (this.lastTap || 0) < 300 && !h) { this.fit(); this.draw(); } this.lastTap = now;
    this.drag = { h, moved: false, sx: e.offsetX, sy: e.offsetY };
    if (h && (h.type === 'item' || h.type === 'door' || h.type === 'wall')) {
      const w = this.world(e.offsetX, e.offsetY);
      if (h.type === 'item') { const it = D.bp.items.find((i) => i.id === h.id); this.drag.off = [w.x - it.rect[0], w.z - it.rect[1]]; }
      if (h.type === 'wall') this.drag.group = this.wallGroup(D.bp, h);
    }
  }
  // a wall: this room's side, and every room's side on the same line that meets it, and the doors on them
  wallGroup(bp, h) {
    const r = bp.rooms.find((q) => q.id === h.id), k = h.side, v = r.rect[k], along = k === 0 || k === 2 ? [1, 3] : [0, 2];
    const lo = r.rect[along[0]], hi = r.rect[along[1]], members = [];
    for (const q of bp.rooms) for (const s of k === 0 || k === 2 ? [0, 2] : [1, 3]) {
      if (Math.abs(q.rect[s] - v) > 1e-6) continue;
      if (Math.min(hi, q.rect[along[1]]) - Math.max(lo, q.rect[along[0]]) < -1e-6) continue;
      members.push({ id: q.id, side: s });
    }
    const doors = (bp.doors || []).filter((d) => { const w = doorWall(bp, d); return w && (k === 0 || k === 2 ? w.along === 'z' && Math.abs(w.x - v) < 1e-6 : w.along === 'x' && Math.abs(w.z - v) < 1e-6); }).map((d) => d.id);
    return { members, doors, axis: k === 0 || k === 2 ? 'x' : 'z', from: v };
  }
  move(e) {
    const p = this.ptrs.get(e.pointerId); if (!p) { this.hover(e); return; }
    const dx = e.offsetX - p.x, dy = e.offsetY - p.y; p.x = e.offsetX; p.y = e.offsetY;
    if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch) this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / this.pinch); this.pinch = d; return;
    }
    const g = this.drag; if (!g) return;
    if (!g.moved && Math.hypot(e.offsetX - g.sx, e.offsetY - g.sy) < 4) return;
    g.moved = true;
    const h = g.h, w = this.world(e.offsetX, e.offsetY);
    if (!h || h.type === 'room') { this.V.cz += dx / this.V.s; if (this.inPlan(g.sx, g.sy)) this.V.cx -= dy / this.V.s; else this.V.ch += dy / this.V.s; this.draw(); return; }
    if (h.type === 'item') this.h.edit((bp) => {
      const it = bp.items.find((i) => i.id === h.id); if (!it) return;
      const W = it.rect[2] - it.rect[0], L = it.rect[3] - it.rect[1], x0 = snap(w.x - g.off[0], 0.25), z0 = snap(w.z - g.off[1], 0.25);
      it.rect = [x0, z0, x0 + W, z0 + L];
      const r = bp.rooms.find((q) => x0 + W / 2 > q.rect[0] && x0 + W / 2 < q.rect[2] && z0 + L / 2 > q.rect[1] && z0 + L / 2 < q.rect[3]); if (r) it.room = r.id;
    }, true);
    if (h.type === 'wall') this.h.edit((bp) => {
      const G = g.group, v = snap(G.axis === 'x' ? w.x : w.z, 0.5);
      // (no room thinner than half a metre)
      for (const m of G.members) { const r = bp.rooms.find((q) => q.id === m.id), o = r.rect[m.side < 2 ? m.side + 2 : m.side - 2]; if (m.side < 2 ? v > o - 0.5 : v < o + 0.5) return; }
      for (const m of G.members) bp.rooms.find((q) => q.id === m.id).rect[m.side] = v;
      for (const id of G.doors) { const d = bp.doors.find((q) => q.id === id); if (d) d.at[G.axis === 'x' ? 0 : 1] = v; }
    }, true);
    if (h.type === 'door') this.h.edit((bp) => {
      const d = bp.doors.find((q) => q.id === h.id); if (!d) return;
      // (a hatch slides about its room's floor, on the half grid)
      if (d.hatch) { d.at = [snap(w.x, 0.25), snap(w.z, 0.25)]; return; }
      const hits = wallsAt(bp, w.x, w.z, 0.6); if (!hits.length) return;
      const best = hits[0];
      if (best.along === 'z') d.at = [best.x, snap(w.z, 0.25)]; else d.at = [snap(w.x, 0.25), best.z];
      if (d.rooms?.[1] === 'outside') { d.rooms = [best.room, 'outside']; return; }
      const on = hits.filter((q) => q.along === best.along && Math.abs((q.x ?? q.z) - (best.x ?? best.z)) < 1e-6).map((q) => q.room);
      d.rooms = on.length >= 2 ? [on[0], on[1]] : [on[0], on[0]];
    }, true);
  }
  up(e) {
    const g = this.drag; this.ptrs.delete(e.pointerId);
    if (this.ptrs.size) return; this.drag = null;
    if (!g) return;
    if (!g.moved) this.h.select(g.h && g.h.type !== 'wall' ? { type: g.h.type, id: g.h.id } : g.h ? { type: 'room', id: g.h.id } : null);
    else if (g.h && g.h.type !== 'room') this.h.commit();
  }
  hover(e) {
    if (e.pointerType !== 'mouse') return;
    const h = this.hit(e.offsetX, e.offsetY, false);
    this.c.style.cursor = !h ? 'grab' : h.type === 'wall' ? (h.side === 0 || h.side === 2 ? 'ns-resize' : 'ew-resize') : h.type === 'room' ? 'pointer' : 'move';
  }

  // ── drawing ─────────────────────────────────────────────────────────────────────────────────────────────────────
  draw() {
    const g = this.g, D = this.h.data(); if (!this.P) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = COL.bg; g.fillRect(0, 0, this.W, this.H);
    if (!D.space) return;
    this.drawPlan(D);
    if (this.S) this.drawSide(D);
  }
  clip(R) { const g = this.g; g.save(); g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip(); }
  poly(pts, map) { const g = this.g; g.beginPath(); pts.forEach((p, i) => { const [X, Y] = map(p); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); }
  // a plan rect [x0, z0, x1, z1] on screen: [left, top, width, height]
  sr(r) { const X0 = this.pX(r[3]), X1 = this.pX(r[1]), Y0 = this.pY(r[0]), Y1 = this.pY(r[2]); return [X0, Y0, X1 - X0, Y1 - Y0]; }
  drawPlan(D) {
    const g = this.g, { space, bp, result, sel } = D, P = this.P, s = this.V.s, mp = ([x, z]) => [this.pX(z), this.pY(x)];
    this.clip(P);
    // the ship grid: half-metre lines, a stronger line each metre, the middle line
    const w0 = this.world(P.x + P.w, P.y), w1 = this.world(P.x, P.y + P.h);
    g.lineWidth = 1;
    for (let z = Math.floor(w0.z * 2) / 2; z <= w1.z; z += 0.5) { g.strokeStyle = Math.abs(z % 1) < 1e-6 ? COL.grid1 : COL.grid; g.beginPath(); g.moveTo(this.pX(z), P.y); g.lineTo(this.pX(z), P.y + P.h); g.stroke(); }
    for (let x = Math.floor(w0.x * 2) / 2; x <= w1.x; x += 0.5) { g.strokeStyle = Math.abs(x % 1) < 1e-6 ? COL.grid1 : COL.grid; g.beginPath(); g.moveTo(P.x, this.pY(x)); g.lineTo(P.x + P.w, this.pY(x)); g.stroke(); }
    // the ship from above, and its hull cut at the deck
    g.fillStyle = COL.top; g.strokeStyle = COL.topEdge;
    for (const p of space.outlines.top) { this.poly(p, mp); g.fill(); g.stroke(); }
    g.fillStyle = COL.hull; g.strokeStyle = COL.hullEdge;
    for (const p of space.outlines.hullAtDeck) { this.poly(p, mp); g.fill(); g.stroke(); }
    // the space inside: each 0.1 m by its clear height, and the outlines at the floor, head height and the ceiling
    if (this.show.space) {
      g.save(); g.imageSmoothingEnabled = false;
      const H = space.H, c = H.cell, A = P.x + P.w / 2 + this.V.cz * s, B = P.y + P.h / 2 - this.V.cx * s;
      g.setTransform(0, c * s * this.dpr, -c * s * this.dpr, 0, (A - H.z0 * s) * this.dpr, (B + H.x0 * s) * this.dpr);
      g.drawImage(this.heightImage(space), 0, 0); g.restore();
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const lines = [['floor', COL.floorLine, []], ['head', COL.headLine, [5, 4]], ['ceiling', COL.ceilLine, []]];
      for (const [k, col, dash] of lines) { g.strokeStyle = col; g.lineWidth = 1.4; g.setLineDash(dash); for (const p of space.outlines[k]) { this.poly(p, mp); g.stroke(); } }
      g.setLineDash([]);
    }
    // the middle line
    g.strokeStyle = COL.mid; g.setLineDash([3, 5]); g.beginPath(); g.moveTo(P.x, this.pY(0)); g.lineTo(P.x + P.w, this.pY(0)); g.stroke(); g.setLineDash([]);
    // the shell's door (or doors: the space file's list, when it has one; a sealed one, when the blueprint has only one
    // ramp, dashed)
    for (const sd of space.doors?.list || [space.doors?.port].filter(Boolean)) {
      const sealed = bp?.ramps === 'one' && sd.kind === 'ramp' && sd.side === 'starboard';
      g.strokeStyle = COL.outer; g.lineWidth = 3; if (sealed) g.setLineDash([6, 5]); g.beginPath(); g.moveTo(this.pX(sd.z[0]), this.pY(sd.face)); g.lineTo(this.pX(sd.z[1]), this.pY(sd.face)); g.stroke(); g.setLineDash([]);
    }
    // (a belly door: its opening's outline, dashed)
    const bd = space.doors?.belly; if (bd) { g.strokeStyle = COL.outer; g.lineWidth = 2; g.setLineDash([4, 3]); const [X, Y, W, H] = this.sr([bd.x[0], bd.z[0], bd.x[1], bd.z[1]]); g.strokeRect(X, Y, W, H); g.setLineDash([]); }
    if (bp) this.drawBlueprint(D);
    this.legend(P);
    g.restore();
  }
  heightImage(space) {
    if (this.hFor === space) return this.hImg;
    const H = space.H, cv = document.createElement('canvas'); cv.width = H.nx; cv.height = H.nz;
    const cx = cv.getContext('2d'), im = cx.createImageData(H.nx, H.nz), hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const bands = COL.bands.map(([t, h]) => [t, hex(h)]), raised = hex(COL.raised);
    for (let b = 0; b < H.nz; b++) for (let a = 0; a < H.nx; a++) {
      const n = a + H.nx * b, T = H.topCm[n] / 100, F = H.floorCm[n] / 100, o = n * 4;
      if (T <= 0) { im.data[o + 3] = 0; continue; }
      let col = bands[0][1]; for (const [t, cc] of bands) if (T - F >= t) col = cc;
      if (F > 0) col = col.map((v, i) => Math.round(v * 0.45 + raised[i] * 0.55));
      im.data.set([...col, 255], o);
    }
    cx.putImageData(im, 0, 0); this.hImg = cv; this.hFor = space; return cv;
  }
  legend(P) {
    const g = this.g, items = [[COL.bands[3][1], '2.5 m+'], [COL.bands[2][1], '2.0–2.5'], [COL.bands[1][1], '1–2 m'], [COL.raised, 'raised floor']];
    const fs = 11, x0 = P.x + 8, y0 = P.y + P.h - 8 - fs * 1.3; let x = x0;
    g.font = `500 ${fs}px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'right'; g.fillStyle = COL.dim;
    g.fillText('◀ nose   ▼ left (port)', P.x + P.w - 8, y0); g.textAlign = 'left';
    if (!this.show.space) return;
    for (const [c, t] of items) { g.fillStyle = c; g.fillRect(x, y0 - 5, 12, 10); g.fillStyle = COL.dim; g.fillText(t, x + 15, y0); x += 22 + g.measureText(t).width; }
    for (const [c, t, dash] of [[COL.floorLine, 'floor', []], [COL.headLine, 'head height', [4, 3]], [COL.ceilLine, 'ceiling', []]]) {
      g.strokeStyle = c; g.setLineDash(dash); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + 14, y0); g.stroke(); g.setLineDash([]);
      g.fillStyle = COL.dim; g.fillText(t, x + 17, y0); x += 26 + g.measureText(t).width;
    }
  }
  drawBlueprint(D) {
    const g = this.g, { bp, result, sel } = D, s = this.V.s, fs = Math.max(9, Math.min(14, s * 0.3));
    const bad = this.show.checks && result ? result.marks : [];
    // rooms: filled by kind, walls drawn
    for (const r of bp.rooms) {
      const K = ROOM_KINDS[r.kind] || { color: '#888' }, [X, Y, W, H] = this.sr(r.rect);
      g.fillStyle = K.color + '30'; g.fillRect(X, Y, W, H);
    }
    // the marks of the checks that fail: the cells, under the furniture's outlines
    for (const m of bad) if (m.rect && ['floor', 'head', 'ceiling', 'headroom', 'corridor'].includes(m.check)) { const [X, Y, W, H] = this.sr(m.rect); g.fillStyle = COL.bad; g.fillRect(X, Y, W, H); }
    // items: those standing on the floor, then the hanging ones over them (a light fill, a dashed outline, their tag in
    // a corner so the one under shows too)
    const standing = (bp.items || []).filter((it) => !hangs(it)), hanging = (bp.items || []).filter(hangs);
    for (const it of standing) {
      const K = ITEM_KINDS[it.kind] || { color: '#999', tag: '?' }, [X, Y, W, H] = this.sr(it.rect);
      g.fillStyle = K.color + 'c8'; g.strokeStyle = '#0a0f16'; g.lineWidth = 1;
      if (it.cut) {
        // (corners cut off its plan: its real outline, so a diagonal face shows as one)
        g.beginPath(); outlineOf(it).forEach(([x, z], i) => { const [px, py] = this.sr([x, z, x, z]); if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.closePath(); g.fill(); g.stroke();
      } else { g.fillRect(X, Y, W, H); g.strokeRect(X + 0.5, Y + 0.5, W - 1, H - 1); }
      if (Math.min(W, H) > fs * 1.2) { g.fillStyle = '#0a0f16'; g.font = `700 ${Math.round(fs * 0.85)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(K.tag, X + W / 2, Y + H / 2); }
    }
    for (const it of hanging) {
      const K = ITEM_KINDS[it.kind] || { color: '#999', tag: '?' }, [X, Y, W, H] = this.sr(it.rect);
      g.fillStyle = K.color + '40'; g.fillRect(X, Y, W, H);
      g.strokeStyle = K.color; g.lineWidth = 2; g.setLineDash([5, 3]); g.strokeRect(X + 1.5, Y + 1.5, W - 3, H - 3); g.setLineDash([]);
      if (Math.min(W, H) > fs * 1.2) { g.font = `700 ${Math.round(fs * 0.7)}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'top'; g.lineWidth = 3; g.strokeStyle = 'rgba(10,15,22,0.85)'; g.strokeText(K.tag, X + 4, Y + 3); g.fillStyle = K.color; g.fillText(K.tag, X + 4, Y + 3); }
    }
    // walls, then the doors over them
    for (const r of bp.rooms) {
      const K = ROOM_KINDS[r.kind] || { color: '#888' }, [X, Y, W, H] = this.sr(r.rect);
      g.strokeStyle = K.color; g.lineWidth = 2; g.strokeRect(X, Y, W, H);
    }
    for (const d of bp.doors || []) {
      const w = doorWall(bp, d), outer = d.rooms?.[1] === 'outside';
      // (a hatch: its square in the floor, an X across it)
      if (d.hatch) { const hw = d.width / 2, [X, Y, W, H] = this.sr([d.at[0] - hw, d.at[1] - hw, d.at[0] + hw, d.at[1] + hw]); g.strokeStyle = outer ? COL.outer : COL.door; g.lineWidth = 2.5; g.setLineDash(w ? [] : [3, 3]); g.strokeRect(X, Y, W, H); g.beginPath(); g.moveTo(X, Y); g.lineTo(X + W, Y + H); g.moveTo(X + W, Y); g.lineTo(X, Y + H); g.stroke(); g.setLineDash([]); continue; }
      // (the pockets: where its open leaves park, a thin line along the wall either side of it)
      if (w && !outer) for (const [lo, hi] of doorReach(d, w).pockets) {
        g.strokeStyle = COL.door + '99'; g.lineWidth = 2; g.setLineDash([2, 2]); g.beginPath();
        if (w.along === 'z') { g.moveTo(this.pX(lo), this.pY(w.x)); g.lineTo(this.pX(hi), this.pY(w.x)); } else { g.moveTo(this.pX(w.z), this.pY(lo)); g.lineTo(this.pX(w.z), this.pY(hi)); }
        g.stroke(); g.setLineDash([]);
      }
      const seg = w ? (w.along === 'z' ? [[this.pX(w.span[0]), this.pY(w.x)], [this.pX(w.span[1]), this.pY(w.x)]] : [[this.pX(w.z), this.pY(w.span[0])], [this.pX(w.z), this.pY(w.span[1])]]) : [[this.pX(d.at[1]) - d.width * s / 2, this.pY(d.at[0])], [this.pX(d.at[1]) + d.width * s / 2, this.pY(d.at[0])]];
      g.strokeStyle = COL.bg; g.lineWidth = 6; g.beginPath(); g.moveTo(...seg[0]); g.lineTo(...seg[1]); g.stroke();
      g.strokeStyle = outer ? COL.outer : COL.door; g.lineWidth = 3; g.setLineDash(w ? [] : [3, 3]); g.beginPath(); g.moveTo(...seg[0]); g.lineTo(...seg[1]); g.stroke(); g.setLineDash([]);
      for (const p of seg) { g.fillStyle = outer ? COL.outer : COL.door; g.beginPath(); g.arc(p[0], p[1], 2.5, 0, Math.PI * 2); g.fill(); }
    }
    // room names and sizes
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const r of bp.rooms) {
      const [X, Y, W, H] = this.sr(r.rect), w = r.rect[2] - r.rect[0], l = r.rect[3] - r.rect[1];
      if (r.kind === 'corridor' && Math.min(W, H) < fs * 3) continue;
      const name = r.name || r.id, size = `${l} × ${w} m`;
      g.font = `700 ${fs}px ${FONT}`;
      const fitsName = g.measureText(name).width < W - 4, ty = Y + H / 2;
      const short = fitsName ? name : name.split(/[ /]/)[0];
      const label = (t, y, f) => { g.font = f; g.lineWidth = 3; g.strokeStyle = 'rgba(10,15,22,0.85)'; g.strokeText(t, X + W / 2, y); g.fillStyle = COL.text; g.fillText(t, X + W / 2, y); };
      if (H > fs * 2.6 && g.measureText(short).width < W + 8) { label(short, ty - fs * 0.6, `700 ${fs}px ${FONT}`); label(size, ty + fs * 0.65, `500 ${Math.round(fs * 0.85)}px ${FONT}`); }
      else if (g.measureText(short).width < W + 8) label(short, ty, `700 ${fs}px ${FONT}`);
    }
    // the other marks: doors, rooms not reached, overlaps, rooms too small
    for (const m of bad) {
      if (m.check === 'pockets' && m.rect) { const [X, Y, W, H] = this.sr(m.rect); g.fillStyle = COL.badLine; g.fillRect(X - 1, Y - 1, W + 2, H + 2); }
      if (m.check === 'doors' && m.at) { const X = this.pX(m.at[1]), Y = this.pY(m.at[0]); g.strokeStyle = COL.badLine; g.lineWidth = 2.5; g.beginPath(); g.arc(X, Y, 9, 0, Math.PI * 2); g.moveTo(X - 5, Y - 5); g.lineTo(X + 5, Y + 5); g.moveTo(X + 5, Y - 5); g.lineTo(X - 5, Y + 5); g.stroke(); }
      if ((m.check === 'walk' || m.check === 'fit' || m.check === 'sizes') && m.rect) { const [X, Y, W, H] = this.sr(m.rect); g.strokeStyle = COL.badLine; g.lineWidth = 2.5; g.setLineDash([6, 4]); g.strokeRect(X + 2, Y + 2, W - 4, H - 4); g.setLineDash([]); }
    }
    // the selection
    if (sel) {
      const o = sel.type === 'room' ? bp.rooms.find((r) => r.id === sel.id) : sel.type === 'item' ? bp.items.find((i) => i.id === sel.id) : null;
      if (o) { const [X, Y, W, H] = this.sr(o.rect); g.strokeStyle = COL.sel; g.lineWidth = 2; g.setLineDash([5, 3]); g.strokeRect(X - 2, Y - 2, W + 4, H + 4); g.setLineDash([]); }
      if (sel.type === 'door') { const d = bp.doors.find((q) => q.id === sel.id); if (d) { g.strokeStyle = COL.sel; g.lineWidth = 2; g.beginPath(); g.arc(this.pX(d.at[1]), this.pY(d.at[0]), 10, 0, Math.PI * 2); g.stroke(); } }
    }
  }
  drawSide(D) {
    const g = this.g, { space, bp, result } = D, S = this.S, s = this.V.s, deck = space.deck, ms = ([z, y]) => [this.pX(z), this.sY(y - deck)];
    this.clip(S);
    g.fillStyle = '#0c131c'; g.fillRect(S.x, S.y, S.w, S.h);
    g.strokeStyle = 'rgba(79,182,255,0.35)'; g.beginPath(); g.moveTo(S.x, S.y + 0.5); g.lineTo(S.x + S.w, S.y + 0.5); g.stroke();
    // half-metre lines up and along
    const w0 = this.world(S.x + S.w, 0), w1 = this.world(S.x, 0);
    for (let z = Math.floor(w0.z * 2) / 2; z <= w1.z; z += 0.5) { g.strokeStyle = Math.abs(z % 1) < 1e-6 ? COL.grid1 : COL.grid; g.beginPath(); g.moveTo(this.pX(z), S.y); g.lineTo(this.pX(z), S.y + S.h); g.stroke(); }
    // the ship from the side, its hull cut down the middle line, and the clear inside there
    g.fillStyle = COL.top; g.strokeStyle = COL.topEdge; for (const p of space.section.side) { this.poly(p, ms); g.fill(); g.stroke(); }
    g.fillStyle = COL.hull; g.strokeStyle = COL.hullEdge; for (const p of space.section.hull) { this.poly(p, ms); g.fill(); g.stroke(); }
    if (this.show.space) { g.fillStyle = COL.bands[3][1]; for (const p of space.section.clear) { this.poly(p, ms); g.fill(); } }
    // the ground, the deck, head height and the ceiling
    const hl = (h, col, dash, t) => { g.strokeStyle = col; g.setLineDash(dash); g.lineWidth = 1.2; g.beginPath(); g.moveTo(S.x, this.sY(h)); g.lineTo(S.x + S.w, this.sY(h)); g.stroke(); g.setLineDash([]); g.fillStyle = col; g.font = `500 10.5px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText(t, S.x + S.w - 6, this.sY(h) - 1); };
    hl(-deck, '#5a6b7e', [], `ground (the deck ${deck} m up)`); hl(0, COL.floorLine, [], 'deck'); hl(HEAD, COL.headLine, [5, 4], 'head height 2.0'); hl(CEIL, COL.ceilLine, [2, 3], 'ceiling 2.5');
    if (bp) {
      const bad = this.show.checks && result ? result.marks : [];
      // items from the side (all of them, see-through), then the rooms' boxes
      // (a hanging item at its own height, dashed round)
      for (const it of bp.items || []) {
        const K = ITEM_KINDS[it.kind] || { color: '#999' }, r = bp.rooms.find((q) => q.id === it.room), f = (r?.floor || 0) + +(it.y || 0);
        const X0 = this.pX(it.rect[3]), X1 = this.pX(it.rect[1]), Y0 = this.sY(f + it.h), Y1 = this.sY(f);
        g.fillStyle = K.color + '70'; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
        if (hangs(it)) { g.strokeStyle = K.color; g.lineWidth = 1.2; g.setLineDash([4, 3]); g.strokeRect(X0, Y0, X1 - X0, Y1 - Y0); g.setLineDash([]); }
      }
      for (const r of bp.rooms) {
        const K = ROOM_KINDS[r.kind] || { color: '#888' }, f = r.floor || 0, top = typeof r.ceiling === 'number' ? r.ceiling : r.ceiling === 'canopy' ? HEAD : CEIL;
        const X0 = this.pX(r.rect[3]), X1 = this.pX(r.rect[1]), Y0 = this.sY(f + top), Y1 = this.sY(f);
        g.strokeStyle = K.color; g.lineWidth = 1.6; g.setLineDash(r.ceiling === 'canopy' ? [4, 3] : []); g.strokeRect(X0, Y0, X1 - X0, Y1 - Y0); g.setLineDash([]);
      }
      // the marks, along: red under the deck for the floor, at head height or the ceiling for those
      for (const m of bad) {
        if (!m.rect || !['floor', 'head', 'ceiling', 'headroom'].includes(m.check)) continue;
        const h = m.check === 'floor' ? 0 : m.check === 'ceiling' ? CEIL : HEAD, X0 = this.pX(m.rect[3]), X1 = this.pX(m.rect[1]);
        g.fillStyle = COL.badLine; g.fillRect(X0, this.sY(h) - 3, Math.max(2, X1 - X0), 6);
      }
      // the names along the top of the boxes
      g.font = `600 ${Math.max(9, Math.min(12, s * 0.26))}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top';
      const taken = [];
      for (const r of bp.rooms) {
        if (r.kind === 'corridor') continue;
        const X0 = this.pX(r.rect[3]), X1 = this.pX(r.rect[1]), t = (r.name || r.id).split(/[ /]/)[0], tw = g.measureText(t).width, a = (X0 + X1) / 2 - tw / 2 - 3, b = (X0 + X1) / 2 + tw / 2 + 3;
        if (taken.some(([p, q]) => a < q && b > p)) continue;
        if (tw < X1 - X0) { taken.push([a, b]); g.lineWidth = 3; g.strokeStyle = 'rgba(10,15,22,0.85)'; g.strokeText(t, (X0 + X1) / 2, this.sY(CEIL) + 3); g.fillStyle = COL.text; g.fillText(t, (X0 + X1) / 2, this.sY(CEIL) + 3); }
      }
    }
    g.font = `600 11px ${FONT}`; g.fillStyle = COL.dim; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText('Side section down the middle line, seen from the left (port) side', S.x + 8, S.y + 5);
    g.restore();
  }
}
