// THE DASHBOARD'S SHAPE AND ITS SCREENS SET UP IN IT: plain sums, no three.js (consoles.js draws the dashboard from
// them; the checks read them, tests/dash.test.mjs; the flying's numbers, src/fleet.js `dash`, are shown on the middle
// one of these screens).
//
// THE GAME'S MAKER (2026-11-20, DASH2-1): "How about you put the information from those 3 little screens there? Those
// 3 little screens look like they got glued on the top of the dashboard. They are covering over the other screens.
// That doesn't look good. Having a permanent 6 x 7 = doesn't look good either. So maybe we can just put the content of
// the 3 small screens in the 6x7. If there is still a lot of blank dashboard then lets move the screens up." (And
// before, DASH1-3: "It might be cool to have the life support and radar up at the same level as the new metrics", and
// the screens should curve as the dashboard does.)
//
// SO, ON A SHIP THAT ASKS FOR IT (its COCKPIT.dash.up, kit/ships/<ship>-built.js): its dashboard's face is too short
// for its screens and sits below the seat's view, with the dashboard's long blank top above it. Its three screens (the
// life support before the pilot, the middle screen, the terminal before the other seat) move up out of the face into
// the dashboard's top, each set into it, along its curve: either into the top as it is (`riser` none), or into a
// raised face of the dashboard's own (`riser`: the top steps up just behind the hood, its face leaning back toward the
// windscreen, the screens set into that face, its top running on to the windscreen's foot). The face below is left
// with its switches. The middle screen is the flight's (its face 'flight': dark until src/flying.js shows the flight's
// numbers on it).
//
//   dashShape(o)      the dashboard's arc and section for its options o (consoles.js has the options' words): { seats, w,
//                     bow, depth, h, knee, toe, deckY, R (the arc's radius at its near edge), T (half its angle), seatsAt,
//                     shelf, face, fs, fe, top (the run its screens are set into, when it has o.up), outline }
//   arcAt(R, s, y, th)  a point of it: s forward of the near edge, at height y, th round the arc (its own frame)
//   cockpitDash(o)    the dashboard's options as a cockpit puts it (set.js cockpitPlan): turned round to face the seats,
//                     its top deck running on to the windscreen's foot; o: { seats, gap, canopy, dash }
//   upOf(S, up)       the screens set up in its top, in its own frame: up { riser: { s0 (its foot, forward of the near
//                     edge), len (its face's length), lean (radians back from upright) } | none, u (how far up the run
//                     their pictures' middles are), screens: [{ face, x (its middle along the arc, the dashboard's own
//                     x), w (its picture's width), aspect (2) }] } -> [{ face, x, w, h (its picture's height), th, mid (its
//                     picture's middle), n (out of its face), up (up its face) }]
//   shipUp(C, base)   the same in a ship's own kit frame (x to port, y up from its ground line, z to the nose), from its
//                     COCKPIT C (kit/ships/<ship>-built.js) and how high its cockpit's floor is (`base`: its deck + C.floor):
//                     { cz (the middle of the dashboard's arc: x = 0, z = cz), R, lean, screens: [{ face, x, w, h, hb (its
//                     bezel's height), mid, n, up, x0, x1 (its bezel's ends) }] }
export const MFD_BEZEL = 0.012, MFD_KEYS = 0.022;   // (look.js mfd: the bezel round a screen's picture, the row of keys under it)
// (how far out of its face a screen's picture is: look.js mfd, its bezel's slab and the picture on it; and how far out
// of the face a screen's back is mounted, as consoles.js mounts the face's own)
export const MFD_FRONT = 0.0215, MOUNT_OFF = 0.002;

export function dashShape(o = {}) {
  const seats = o.seats === 3 ? 3 : 2, w = o.w ?? (seats === 3 ? 3.0 : 2.0), bow = o.bow ?? 0.17, depth = o.depth ?? 0.7, h = o.h ?? 1.12, knee = o.knee ?? 0.66, toe = o.toe ?? 0.45, deckY = o.deckY ?? h;
  const R = (w * w / 4 + bow * bow) / (2 * bow), T = Math.asin(w / 2 / R);
  const seatsAt = o.seatsAt || (seats === 3 ? [-1, 0, 1] : [-0.5, 0.5]);
  const fs = 0.12, fe = fs + (h - 0.02 - knee - 0.12);   // (the face of screens rises at 45 degrees from the shelf to the hood)
  const shelf = [[0, knee + 0.09], [fs, knee + 0.12]], face = [[fs, knee + 0.12], [fe, h - 0.02]];
  // (the top deck: from the hood to the windscreen's foot; with a raised face, it steps up just behind the hood)
  const hood = [fe + 0.06, h + 0.06], deckAt = (s) => hood[1] + (deckY - hood[1]) * (s - hood[0]) / (depth - hood[0]);
  const rz = o.up && o.up.riser, rise = rz ? [[rz.s0, deckAt(rz.s0)], [rz.s0 + rz.len * Math.sin(rz.lean), deckAt(rz.s0) + rz.len * Math.cos(rz.lean)]] : null;
  const top = o.up ? (rise || (o.up.on === 'face' ? face : [hood, [depth, deckY]])) : null;
  const outline = [
    [toe, 0, 'body'], [depth, 0, null], [depth, deckY, 'body'], ...(rise ? [[rise[1][0], rise[1][1], 'deck'], [rise[0][0], rise[0][1], 'top']] : []), [hood[0], hood[1], 'deck'], [fe - 0.02, h + 0.05, 'black'], [fe - 0.04, h + 0.02, 'black'],
    [fe, h - 0.02, 'black'], [fs, knee + 0.12, 'top'], [0, knee + 0.09, 'body'], [-0.03, knee + 0.07, 'black'], [-0.03, knee + 0.04, 'black'],
    [0, knee, 'black'], [0.1, knee - 0.02, 'body'], [toe, 0.4, 'body'],
  ];
  return { seats, w, bow, depth, h, knee, toe, deckY, R, T, seatsAt, shelf, face, fs, fe, top, rise, outline };
}
// a point on the arc: s forward of the near edge, at height y, at angle th round the arc
export const arcAt = (R, s, y, th) => [(R + s) * Math.sin(th), y, R - (R + s) * Math.cos(th)];
// the dashboard's options as a cockpit puts it: as set.js cockpitPlan does (its canopy and gap as there)
export function cockpitDash({ seats = 2, gap = 0.5, canopy = {}, dash = {} } = {}) {
  const three = seats === 3, xs = three ? [1, 0, -1] : [0.5, -0.5], cy = canopy.y ?? 1.2, cz = canopy.z ?? 1.6;
  const o = { seats: three ? 3 : 2, seatsAt: xs.map((x) => -x), depth: cz - gap - 0.005, deckY: cy - 0.01, ...dash };
  // (the screens are given in the ship's own x, to port, as the seats are: the dashboard is turned round)
  if (dash.up) o.up = { ...dash.up, screens: dash.up.screens.map((q) => ({ ...q, x: -q.x })) };
  return o;
}
// a point u along a run of the section (from a to b in (s, y)), `off` out of it, at angle th: and which way is out of
// it and up it there (the dashboard's own frame)
export function onTop(S, [a, b], u, th, off = 0) {
  const ds = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(ds, dy), es = ds / L, ey = dy / L;
  // (out of the run: toward the seats and up, as the outline runs b to a; up it: from a toward b)
  const ns = -ey, ny = es, s = a[0] + es * u + ns * off, y = a[1] + ey * u + ny * off, st = Math.sin(th), ct = Math.cos(th);
  return { at: arcAt(S.R, s, y, th), n: [ns * st, ny, -ns * ct], up: [es * st, ey, -es * ct], s, y, len: L, lean: Math.atan2(es, ey) };
}
export function upOf(S, up) {
  const run = S.top, r = S.R + (run[0][0] + run[1][0]) / 2;
  return up.screens.map(({ face, x, w, aspect = 2 }) => {
    const h = w / aspect, u = up.u ?? (h / 2 + MFD_KEYS + MFD_BEZEL + 0.012);
    // (its turn round the arc: where its middle line meets the run's middle)
    const th = Math.asin(Math.max(-1, Math.min(1, x / r))), q = onTop(S, run, u, th, MOUNT_OFF), m = onTop(S, run, u, th, MOUNT_OFF + MFD_FRONT);
    return { face, x, w, h, th, at: q.at, mid: m.at, n: q.n, up: q.up, lean: q.lean, hb: h + 2 * MFD_BEZEL + MFD_KEYS };
  });
}
export function shipUp(C, base) {
  const o = cockpitDash({ seats: C.seats ?? 2, gap: C.gap, canopy: C.canopy, dash: C.dash }), S = dashShape(o);
  if (!o.up) return null;
  const z0 = C.seatsZ + C.gap, cz = z0 - S.R;
  // (the dashboard is turned round: its x is the ship's -x, its z the ship's z0 - z)
  const toKit = (p) => [-p[0], base + p[1], z0 - p[2]], dirKit = (v) => [-v[0], v[1], -v[2]];
  return { cz, R: S.R, S, screens: upOf(S, o.up).map((q) => {
    const r = Math.hypot(q.mid[0], q.mid[2] - S.R), half = (q.w / 2 + MFD_BEZEL);
    return { face: q.face, x: -q.x, w: q.w, h: q.h, hb: q.hb, lean: q.lean, mid: toKit(q.mid), n: dirKit(q.n), up: dirKit(q.up), x0: -q.x - half * Math.cos(q.th), x1: -q.x + half * Math.cos(q.th), r };
  }) };
}
