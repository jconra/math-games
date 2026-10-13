// THE TOWER AS DATA: what has been built, and where every board sits in the world. No drawing here and no three.js, so
// node can load it for the tests (rigs) as well as the page.
//
// The tower is square, W feet on a side, standing on four corners. Distances are in FEET (the boards are 8-foot boards
// and the math talks in feet); the page turns feet into metres only when it draws.
//
// Each of the four outside faces is looked at from outside, with its own flat "wall" coordinates: x from 0 at the left
// corner to W at the right corner, y up from the ground. Faces go round the tower: 0 front, 1 right side, 2 back,
// 3 left side, so the right edge of one face is the left edge of the next.
//
// Two building modes:
//   'mirror'  you build the FRONT wall and the SIDE wall; the back is the front's mirror image and the far side the
//             side's. One cut piece builds both twins (the miller cuts the twin from his own pile).
//   'four'    every face is built on its own (and the lumber stack is doubled to make up for it).
// A board standing straight up on a face's left or right edge is a CORNER POST: it belongs to the corner, so it is part
// of both faces that meet there. In mirror mode one post placed on any corner is put up on all four corners (the two
// mirrors together reach every corner).
//
// A wall board is { id, x, y, ang, len }: one end at (x, y), lying at angle ang (radians, 0 = level pointing right,
// PI/2 = straight up), len feet long. A corner post is { id, y, len }: standing from height y.

export const W = 6;                 // the tower is 6 feet square
export const BOARD_FT = 8;          // a fresh board from the stack
export const BOARDS = 12;           // full boards in a fresh stack (mirror mode; four-wall mode gets twice as many)
export const SNAP = 0.5;            // cuts and positions snap to half a foot
export const POST_TOL = 0.06;       // how close to a corner line (and to plumb) a board must be to count as a corner post

export function newTower(mode = 'mirror') {
  return { mode, walls: mode === 'mirror' ? [[], []] : [[], [], [], []], corners: mode === 'mirror' ? [[]] : [[], [], [], []] };
}

// which wall list a face shows, and whether it is shown mirrored (the back and the far side, in mirror mode)
export function faceWall(t, k) { return t.mode === 'mirror' ? { wall: k % 2, flip: k >= 2 } : { wall: k, flip: false }; }
export function cornerList(t, c) { return t.mode === 'mirror' ? t.corners[0] : t.corners[c]; }

// a wall board's two ends (a is (x, y), b is the far end)
export function ends(b) {
  return { ax: b.x, ay: b.y, bx: b.x + Math.cos(b.ang) * b.len, by: b.y + Math.sin(b.ang) * b.len };
}

// is this wall board actually a corner post (straight up on a face's left or right edge)? -> null, 0 (left) or 1 (right)
export function postSide(b) {
  if (Math.abs(Math.abs(b.ang) - Math.PI / 2) > 0.01) return null;
  const e = ends(b), x = (e.ax + e.bx) / 2;
  if (Math.abs(x) < POST_TOL) return 0;
  if (Math.abs(x - W) < POST_TOL) return 1;
  return null;
}

// everything on one face, in that face's own wall coordinates, as plain segments { id, ax, ay, bx, by, len, post, src }.
// Corner posts come from the corners at the face's two edges; wall boards from its wall (mirrored when the face is).
export function faceSegments(t, k) {
  const out = [], { wall, flip } = faceWall(t, k);
  for (const b of t.walls[wall]) {
    const e = ends(b);
    const s = flip ? { ax: W - e.ax, ay: e.ay, bx: W - e.bx, by: e.by } : e;
    out.push({ id: b.id, ...s, len: b.len, post: false, src: b });
  }
  for (const [c, x] of [[k, 0], [(k + 1) % 4, W]]) {
    for (const p of cornerList(t, c)) out.push({ id: p.id + '@' + c, ax: x, ay: p.y, bx: x, by: p.y + p.len, len: p.len, post: true, corner: c, src: p });
  }
  return out;
}

// a point on face k (wall x, height y) -> the world, still in feet: { X, Y, Z } with the tower's middle at X = Z = 0 and
// the front face toward +Z
export function faceToWorld(k, x, y) {
  const h = W / 2;
  switch (k) {
    case 0: return { X: -h + x, Y: y, Z: h };
    case 1: return { X: h, Y: y, Z: h - x };
    case 2: return { X: h - x, Y: y, Z: -h };
    default: return { X: -h, Y: y, Z: -h + x };
  }
}
// the outward direction of face k, and the world corner c
export const FACE_NORMAL = [[0, 1], [1, 0], [0, -1], [-1, 0]];      // [X, Z]
export function cornerXZ(c) { const h = W / 2; return [[-h, h], [h, h], [h, -h], [-h, -h]][c]; }

// every board of the whole tower in the world (feet), with no twins counted twice:
// { key, a: {X,Y,Z}, b: {X,Y,Z}, len, face (or -1 for a post), corner (posts), src, faceAng (the angle on its face) }
export function worldBoards(t) {
  const out = [];
  for (let k = 0; k < 4; k++) {
    const { wall, flip } = faceWall(t, k);
    for (const b of t.walls[wall]) {
      const e = ends(b);
      const ax = flip ? W - e.ax : e.ax, bx = flip ? W - e.bx : e.bx;
      out.push({ key: b.id + ':' + k, a: faceToWorld(k, ax, e.ay), b: faceToWorld(k, bx, e.by), len: b.len, face: k, src: b,
        faceAng: Math.atan2(e.by - e.ay, bx - ax) });
    }
  }
  for (let c = 0; c < 4; c++) {
    const [X, Z] = cornerXZ(c);
    for (const p of cornerList(t, c)) out.push({ key: p.id + ':c' + c, a: { X, Y: p.y, Z }, b: { X, Y: p.y + p.len, Z }, len: p.len, face: -1, corner: c, src: p });
  }
  return out;
}

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
  const n = newTower(t.mode);
  t.walls.forEach((w, i) => { n.walls[i] = w.filter((b) => { const e = ends(b); return keep(e.ay, e.by); }); });
  t.corners.forEach((c, i) => { n.corners[i] = c.filter((p) => keep(p.y, p.y + p.len)); });
  return n;
}

export function cloneTower(t) { return JSON.parse(JSON.stringify(t)); }
