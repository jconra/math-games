// THE LOOK-TO-USE SPOTS' RULES: inside a building, the things that can be used (the store's counter, its food barrels,
// its hats, the dog on its bed; the sheriff's pile of lock boxes) each have a small "E: ..." prompt, shown over the one
// most directly in front of the player: the way the view looks, within reach. Turning toward another one moves the
// prompt to it; only one shows at a time. The game maker: "It will show the E over different areas that are most
// directly in front of you." No three.js here (the game side is src/usespots.js), so the tests can run it as it is.
//
// A building's spots are in its recipe file's anchors (labs/buildings/store.js, sheriff.js: anchors.spots), in its own
// frame, so the game and the Building Lab read the same list: [{ id, at: [x, y, z], use, reach, words }]
//   at     where the prompt floats (over the barrel, the hat pegs, the counter top)
//   use    what the facing is aimed at and the reach measured to, on the floor just in front of the thing: a point
//          [x, z], or a stretch [x0, z0, x1, z1] for something long (the counter's front, the row of hat pegs)
//   reach  metres from `use` the player may stand (USE.reach when left out)
//   r      a point spot's size (m round it, USE.r when left out): aimed anywhere at it is aimed at it (the dog's bed,
//          seen across the room, is in front though its middle is a little off the view's line)
//   words  the prompt's words as the lab shows them (the game says its own, which may change: "Buy the six-shooter")
//
//   USE                       the dials
//   offAngle(at, face, p)     degrees between the way the view looks (face: { x, z }, any length) and the way from the
//                             player (at) to p ({ x, z })
//   aimAt(at, face, s)        where on a spot the view is aimed: { x, z, angle, dist (to that point), reach (how far the
//                             spot's nearest point is) }; a stretch the view's line crosses is dead ahead where it crosses
//   pickSpot(spots, at, face, { current, reach, cone, keep, perMetre }) -> the spot most in front, or null
//     spots: [{ id, x, z } | { id, x0, z0, x1, z1 }, reach?] in the world; current: the one shown last frame, kept
//     unless another is `keep` degrees more in front (so the prompt doesn't flicker between two side by side)
//   spotScore(at, face, s, o)  how far off in front it is (degrees, plus perMetre a metre away), or Infinity when it is
//                             out of reach or outside the cone
//   ACT, pickAction(cands, at, face, { current })   THE ONE E, OUTDOORS AND IN (the game maker: "the E action should be
//                             to whatever is the closest to the spot right in front of the player"): of every E action in
//                             reach this frame (cands: [{ key, at: { x, z } or null (one with no place of its own: the deer
//                             camera set up where you stand) }]), the one nearest the spot right in front of the player:
//                             the least off the view's line (actionOff: its distance to the side of it, a little for how far
//                             along it, a thing behind far off); two about as near (ACT.tie): the one more in front; the
//                             one chosen last frame (current: its key) kept unless another is ACT.keep nearer
//   inFrame(spot, F)          a spot of a building's anchors carried into the world by its frame F: { place(x, z) ->
//                             [wx, wz], y0 } -> { id, x, z (or x0, z0, x1, z1), at: { x, y, z }, reach, words }

export const USE = {
  reach: 3.5,       // m from a spot's `use` within which it can be used (inside the store's door the hat pegs, across
                    // the room, are 3 m off; the cabin's own first person reaches 3)
  r: 0.3,           // m: a point spot's size round its `use` point
  cone: 50,         // degrees either side of the way the view looks that a spot counts as in front
  keep: 9,          // degrees: the spot shown keeps the prompt unless another is this much more in front
  perMetre: 4,      // degrees a metre further off counts as (two equally in front: the nearer one)
  near: 0.4,        // m: standing this close to a spot's `use`, it counts as dead ahead (the way to it is no way)
};

const DEG = 180 / Math.PI;
export function offAngle(at, face, p) {
  const dx = p.x - at.x, dz = p.z - at.z, d = Math.hypot(dx, dz), f = Math.hypot(face.x, face.z);
  if (d < 1e-6 || f < 1e-9) return 0;
  const c = (dx * face.x + dz * face.z) / (d * f);
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}
const isStretch = (s) => Number.isFinite(s.x0) && Number.isFinite(s.x1);

export function aimAt(at, face, s) {
  if (!isStretch(s)) {
    const d = Math.hypot(s.x - at.x, s.z - at.z), r = s.r ?? USE.r;
    return { x: s.x, z: s.z, angle: Math.max(0, offAngle(at, face, s) - (d > r ? Math.asin(r / d) * DEG : 90)), dist: d, reach: d };
  }
  const ax = s.x0, az = s.z0, bx = s.x1 - s.x0, bz = s.z1 - s.z0, L2 = bx * bx + bz * bz || 1e-9;
  // (its nearest point to the player: the reach)
  const t0 = Math.max(0, Math.min(1, ((at.x - ax) * bx + (at.z - az) * bz) / L2)), reach = Math.hypot(ax + bx * t0 - at.x, az + bz * t0 - at.z);
  // (the view's line from the player crossing it: at + u face = a + t b, u >= 0, t in 0..1)
  const det = bx * face.z - face.x * bz;
  if (Math.abs(det) > 1e-9) {
    const t = (face.z * (at.x - ax) - face.x * (at.z - az)) / det, u = (bz * (at.x - ax) - bx * (at.z - az)) / det;
    if (t >= 0 && t <= 1 && u >= 0) { const x = ax + bx * t, z = az + bz * t; return { x, z, angle: 0, dist: Math.hypot(x - at.x, z - at.z), reach }; }
  }
  // (else its end nearer the view's line)
  const A = { x: s.x0, z: s.z0 }, B = { x: s.x1, z: s.z1 }, qa = offAngle(at, face, A), qb = offAngle(at, face, B), E = qa <= qb ? A : B;
  return { x: E.x, z: E.z, angle: Math.min(qa, qb), dist: Math.hypot(E.x - at.x, E.z - at.z), reach };
}

export function spotScore(at, face, s, o = {}) {
  const reach = s.reach ?? o.reach ?? USE.reach, cone = o.cone ?? USE.cone, per = o.perMetre ?? USE.perMetre, near = o.near ?? USE.near;
  const q = aimAt(at, face, s);
  if (q.reach > reach) return Infinity;
  const a = q.reach < near ? 0 : q.angle;
  if (a > cone) return Infinity;
  return a + per * q.dist;
}

export function pickSpot(spots, at, face, o = {}) {
  let best = null, bs = Infinity, cs = Infinity;
  for (const s of spots || []) {
    const v = spotScore(at, face, s, o);
    if (v < bs) { bs = v; best = s; }
    if (o.current && s === o.current) cs = v;
  }
  // (the one already shown stays, unless another is clearly more in front)
  if (o.current && cs < Infinity && best !== o.current && bs > cs - (o.keep ?? USE.keep)) return o.current;
  return best;
}

export const ACT = {
  along: 0.15,      // how much a metre further along the view counts against a thing, against a metre to the side of it
  behind: 1.5,      // m added to a thing behind the player (its whole distance counts, not just its side)
  tie: 0.15,        // two things about as near the view's line: the one more directly in front
  keep: 0.25,       // the action chosen last frame stays unless another is this much nearer (no flicker between two)
  blind: 1.0,       // how near an action with no place of its own (setting the camera up where you stand) counts:
                    // anything faced close by comes first (Miss Wren, to give her camera back)
};
// how far a thing at p is from the spot right in front of the player: its distance off the view's line, and a little for
// how far along it (the nearer of two in line); a thing behind, all its distance and more
export function actionOff(at, face, p) {
  if (!p) return ACT.blind;
  const fl = Math.hypot(face.x, face.z) || 1, fx = face.x / fl, fz = face.z / fl, dx = p.x - at.x, dz = p.z - at.z;
  const t = dx * fx + dz * fz;
  if (t < 0) return Math.hypot(dx, dz) + ACT.behind;
  return Math.abs(dx * fz - dz * fx) + ACT.along * t;
}
export function pickAction(cands, at, face, { current = null } = {}) {
  let best = null, bd = Infinity, ba = Infinity, cur = null, cd = Infinity;
  for (const c of cands || []) {
    const d = actionOff(at, face, c.at), a = c.at ? offAngle(at, face, c.at) : 90;
    if (d < bd - ACT.tie || (Math.abs(d - bd) <= ACT.tie && a < ba)) { best = c; bd = d; ba = a; }
    if (current != null && c.key === current) { cur = c; cd = d; }
  }
  if (cur && best !== cur && bd > cd - ACT.keep) return cur;
  return best;
}

export function inFrame(spot, F) {
  const u = spot.use || [spot.at[0], spot.at[2]], [ax, az] = F.place(spot.at[0], spot.at[2]);
  const out = { id: spot.id, at: { x: ax, y: F.y0 + spot.at[1], z: az }, reach: spot.reach ?? USE.reach, words: spot.words || '' };
  if (u.length >= 4) { const [x0, z0] = F.place(u[0], u[1]), [x1, z1] = F.place(u[2], u[3]); Object.assign(out, { x0, z0, x1, z1, x: (x0 + x1) / 2, z: (z0 + z1) / 2 }); }
  else { const [x, z] = F.place(u[0], u[1]); Object.assign(out, { x, z }); if (spot.r != null) out.r = spot.r; }
  return out;
}
