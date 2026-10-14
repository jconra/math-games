// THE TOWER AS DATA: what has been built, and where every board sits in the world. No drawing here and no three.js, so
// node can load it for the tests (rigs) as well as the page.
//
// The tower is square, t.W feet on a side, standing on four footing stones at its corners. The width is the first
// thing a builder settles (drag the stones in or out, half a foot to 8 feet); it stays with the tower, so every
// function here reads it from the tower (or is handed it). Distances are in FEET (the boards are 8-foot boards and the
// math talks in feet); the page turns feet into metres only when it draws.
//
// Each of the four outside faces is looked at from outside, with its own flat "wall" coordinates: x from 0 at the left
// corner to W at the right corner, y up from the ground. Faces go round the tower: 0 front, 1 right side, 2 back,
// 3 left side, so the right edge of one face is the left edge of the next. Every wall is built on its own, board by
// board, and every board comes off the lumber stack. (The page offers the matching spots on the other walls as
// glowing "twins" to build with one tap: twinsOf below.)
//
// A board standing straight up on a face's left or right edge is a CORNER POST: it belongs to the corner, so it is part
// of both faces that meet there.
//
// A wall board is { id, x, y, ang, len }: one end at (x, y), lying at angle ang (radians, 0 = level pointing right,
// PI/2 = straight up), len feet long. A corner post is { id, y, len }: standing from height y.

export const START_W = 6;           // a new lab starts with the stones 6 feet apart
export const MIN_W = 0.5, MAX_W = 8; // how close and how far apart the stones can be set
export const BOARD_FT = 8;          // a fresh board from the stack
export const BOARDS = 28;           // full boards in a fresh stack (every board on the tower comes out of it: a 16 ft
                                    // tower braced corner to corner on a 6 ft base takes 24, so a few to spare)
export const SNAP = 0.5;            // cuts and positions snap to half a foot
export const POST_TOL = 0.06;       // how close to a corner line (and to plumb) a board must be to count as a corner post

export function newTower(w = START_W) {
  return { W: w, walls: [[], [], [], []], corners: [[], [], [], []] };
}

// a wall board's two ends (a is (x, y), b is the far end)
export function ends(b) {
  return { ax: b.x, ay: b.y, bx: b.x + Math.cos(b.ang) * b.len, by: b.y + Math.sin(b.ang) * b.len };
}

// is this wall board actually a corner post (straight up on a face's left or right edge)? -> null, 0 (left) or 1 (right)
export function postSide(b, w) {
  if (Math.abs(Math.abs(b.ang) - Math.PI / 2) > 0.01) return null;
  const e = ends(b), x = (e.ax + e.bx) / 2;
  if (Math.abs(x) < POST_TOL) return 0;
  if (Math.abs(x - w) < POST_TOL) return 1;
  return null;
}

// everything on one face, in that face's own wall coordinates, as plain segments { id, ax, ay, bx, by, len, post, src }.
// Corner posts come from the corners at the face's two edges; wall boards from its own wall.
export function faceSegments(t, k) {
  const out = [];
  for (const b of t.walls[k]) out.push({ id: b.id, ...ends(b), len: b.len, post: false, src: b });
  for (const [c, x] of [[k, 0], [(k + 1) % 4, t.W]]) {
    for (const p of t.corners[c]) out.push({ id: p.id + '@' + c, ax: x, ay: p.y, bx: x, by: p.y + p.len, len: p.len, post: true, corner: c, src: p });
  }
  return out;
}

// a point on face k (wall x, height y) of a tower w feet wide -> the world, still in feet: { X, Y, Z } with the
// tower's middle at X = Z = 0 and the front face toward +Z
export function faceToWorld(w, k, x, y) {
  const h = w / 2;
  switch (k) {
    case 0: return { X: -h + x, Y: y, Z: h };
    case 1: return { X: h, Y: y, Z: h - x };
    case 2: return { X: h - x, Y: y, Z: -h };
    default: return { X: -h, Y: y, Z: -h + x };
  }
}
// the outward direction of face k, and the world corner c
export const FACE_NORMAL = [[0, 1], [1, 0], [0, -1], [-1, 0]];      // [X, Z]
export function cornerXZ(w, c) { const h = w / 2; return [[-h, h], [h, h], [h, -h], [-h, -h]][c]; }

// every board of the whole tower in the world (feet):
// { key, a: {X,Y,Z}, b: {X,Y,Z}, len, face (or -1 for a post), corner (posts), src, faceAng (the angle on its face) }
export function worldBoards(t) {
  const out = [];
  for (let k = 0; k < 4; k++) {
    for (const b of t.walls[k]) {
      const e = ends(b);
      out.push({ key: b.id + ':' + k, a: faceToWorld(t.W, k, e.ax, e.ay), b: faceToWorld(t.W, k, e.bx, e.by), len: b.len, face: k, src: b,
        faceAng: Math.atan2(e.by - e.ay, e.bx - e.ax) });
    }
  }
  for (let c = 0; c < 4; c++) {
    const [X, Z] = cornerXZ(t.W, c);
    for (const p of t.corners[c]) out.push({ key: p.id + ':c' + c, a: { X, Y: p.y, Z }, b: { X, Y: p.y + p.len, Z }, len: p.len, face: -1, corner: c, src: p });
  }
  return out;
}
export const boardCount = (t) => t.walls.reduce((n, w) => n + w.length, 0) + t.corners.reduce((n, c) => n + c.length, 0);
// all the wood in the tower, feet (its weight is this times the wood's weight per foot)
export const woodFeet = (t) => t.walls.flat().concat(t.corners.flat()).reduce((n, b) => n + b.len, 0);

// how tall the tower is: the top of its highest board
export function towerHeight(t) {
  let h = 0;
  for (const wb of worldBoards(t)) h = Math.max(h, wb.a.Y, wb.b.Y);
  return h;
}

// a copy of the tower keeping only the boards whose top is at or under the given height (what is left standing when
// everything above a broken joint falls)
export function trimTower(t, top) {
  const keep = (y0, y1) => Math.max(y0, y1) <= top + 0.05;
  const n = newTower(t.W);
  t.walls.forEach((w, i) => { n.walls[i] = w.filter((b) => { const e = ends(b); return keep(e.ay, e.by); }); });
  t.corners.forEach((c, i) => { n.corners[i] = c.filter((p) => keep(p.y, p.y + p.len)); });
  return n;
}

export function cloneTower(t) { return JSON.parse(JSON.stringify(t)); }

// ── twins: where a board just nailed would be matched on the other walls ─────────────────────────────────────────────
// A builder squaring up a tower wants the same board on every wall, because the wind comes from every side:
//   a corner post  -> the same post (same height, same length) on the other three corners
//   a wall board   -> each pair of opposite walls is a mirror pair (the back is the front's mirror image, so seen
//                     through the tower a brace on the back lies parallel to the one on the front; the same for the
//                     two sides), and the front and the right side match as seen from outside. So the front and right
//                     side carry the board as it is, the back and left side its mirror image, whichever wall it was
//                     first nailed on.
// Returns [{ kind: 'post', corner, y, len } | { kind: 'wall', face, x, y, ang, len }], the opposite wall first, not
// yet checked for room or wood.
export function twinsOf(t, rec, where) {
  const out = [];
  if (rec.ang === undefined) {
    for (const d of [2, 1, 3]) out.push({ kind: 'post', corner: (where.corner + d) % 4, y: rec.y, len: rec.len });
    return out;
  }
  const k = where.face, half = (f) => (f < 2 ? 0 : 1);
  for (const d of [2, 1, 3]) {
    const f = (k + d) % 4;
    const b = half(f) === half(k) ? { x: rec.x, ang: rec.ang } : { x: t.W - rec.x, ang: norm(Math.PI - rec.ang) };
    out.push({ kind: 'wall', face: f, x: b.x, y: rec.y, ang: b.ang, len: rec.len });
  }
  return out;
}
const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// is a spot already taken? (a board lying along the same line and overlapping it by more than a hair)
export function spotTaken(t, g) {
  if (g.kind === 'post') return t.corners[g.corner].some((p) => Math.min(p.y + p.len, g.y + g.len) - Math.max(p.y, g.y) > 0.3);
  const e = ends(g), dx = (e.bx - e.ax) / g.len, dy = (e.by - e.ay) / g.len;
  return t.walls[g.face].some((b) => {
    const f = ends(b), off = Math.max(Math.abs((f.ax - e.ax) * dy - (f.ay - e.ay) * dx), Math.abs((f.bx - e.ax) * dy - (f.by - e.ay) * dx));
    if (off > 0.2) return false;
    const t0 = (f.ax - e.ax) * dx + (f.ay - e.ay) * dy, t1 = (f.bx - e.ax) * dx + (f.by - e.ay) * dy;
    return Math.min(g.len, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > 0.3;
  });
}
