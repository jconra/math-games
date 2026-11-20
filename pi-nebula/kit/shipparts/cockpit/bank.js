// THE DASHBOARD'S SHAPE AND THE ROW OF SCREENS ON ITS TOP: plain sums, no three.js (consoles.js draws the dashboard
// from them; the checks read them, tests/dash.test.mjs; the flying's display, src/fleet.js `dash`, stands on the same
// curve).
//
// THE GAME'S MAKER (2026-11-20, DASH1-3, C "Move them up beside the new display"): "It might be cool to have the life
// support and radar up at the same level as the new metrics that you have. ... One thing that is kind of bugging me is
// that the new displays (tiny ship, speed, and distance) are in a perfect line, while the displays under them are
// curving. If that dashboard is curved, the the tiny ship should also be curved."
//
// SO, ON A SHIP THAT ASKS FOR IT (its COCKPIT.dash.bank, kit/ships/<ship>-built.js), the two screens that stood on the
// dashboard's face either side of the sum (the life support before the pilot, and the one before the other seat, which
// the questions called the radar: its face is the terminal's lines) stand up on the dashboard's top instead, beside the
// flying's display, at its level, all along the dashboard's curve. The sum stays on the face. What they stand on is the
// top deck (or, where the deck falls away from the seats, the hood).
//
//   dashShape(o)      the dashboard's arc and section for its options o (consoles.js has the options' words): { seats, w,
//                     bow, depth, h, knee, toe, deckY, R (the arc's radius at its near edge), T (half its angle), seatsAt,
//                     shelf, face, fs, fe, outline }
//   arcAt(R, s, y, th)  a point of it: s forward of the near edge, at height y, th round the arc (its own frame)
//   topAt(S, s)       how high its top is s forward of the near edge (the hood, then the deck down or up to the
//                     windscreen's foot); null in front of the hood
//   cockpitDash(o)    the dashboard's options as a cockpit puts it (set.js cockpitPlan): turned round to face the seats,
//                     its top deck running on to the windscreen's foot; o: { seats, gap, canopy, dash }
//   bankOf(S, bank)   the row's screens standing on the top: bank { s (how far forward of the near edge their feet stand),
//                     lean (radians back from upright), screens: [{ face, x (its middle along the arc, the dashboard's own
//                     x), w (its picture's width) }] } -> [{ face, x, w, h (its picture's height), th, foot (the middle of
//                     its bezel's bottom edge), up (from the foot up its middle), span: [x0, x1] (its bezel's ends) }]
//   shipBank(C, base) the same in a ship's own kit frame (x to port, y up from its ground line, z to the nose), from its
//                     COCKPIT C (kit/ships/<ship>-built.js) and how high its cockpit's floor is (`base`: its deck + C.floor):
//                     { cz (the middle of the dashboard's arc: x = 0, z = cz), R, s, y (the feet's height), r (their
//                     circle's radius), screens: [{ face, x0, x1, xm, w, h, hb (its bezel's height) }] }
export const MFD_BEZEL = 0.012, MFD_KEYS = 0.022;   // (look.js mfd: the bezel round a screen's picture, the row of keys under it)

export function dashShape(o = {}) {
  const seats = o.seats === 3 ? 3 : 2, w = o.w ?? (seats === 3 ? 3.0 : 2.0), bow = o.bow ?? 0.17, depth = o.depth ?? 0.7, h = o.h ?? 1.12, knee = o.knee ?? 0.66, toe = o.toe ?? 0.45, deckY = o.deckY ?? h;
  const R = (w * w / 4 + bow * bow) / (2 * bow), T = Math.asin(w / 2 / R);
  const seatsAt = o.seatsAt || (seats === 3 ? [-1, 0, 1] : [-0.5, 0.5]);
  const fs = 0.12, fe = fs + (h - 0.02 - knee - 0.12);   // (the face of screens rises at 45 degrees from the shelf to the hood)
  const shelf = [[0, knee + 0.09], [fs, knee + 0.12]], face = [[fs, knee + 0.12], [fe, h - 0.02]];
  const outline = [
    [toe, 0, 'body'], [depth, 0, null], [depth, deckY, 'body'], [fe + 0.06, h + 0.06, 'deck'], [fe - 0.02, h + 0.05, 'black'], [fe - 0.04, h + 0.02, 'black'],
    [fe, h - 0.02, 'black'], [fs, knee + 0.12, 'top'], [0, knee + 0.09, 'body'], [-0.03, knee + 0.07, 'black'], [-0.03, knee + 0.04, 'black'],
    [0, knee, 'black'], [0.1, knee - 0.02, 'body'], [toe, 0.4, 'body'],
  ];
  return { seats, w, bow, depth, h, knee, toe, deckY, R, T, seatsAt, shelf, face, fs, fe, outline };
}
// a point on the arc: s forward of the near edge, at height y, at angle th round the arc
export const arcAt = (R, s, y, th) => [(R + s) * Math.sin(th), y, R - (R + s) * Math.cos(th)];
// the top: the hood's top (from its lip to where the deck starts), then the deck to the windscreen's foot
export function topAt(S, s) {
  const a = S.fe - 0.02, b = S.fe + 0.06;
  if (s < a) return null;
  if (s <= b) return S.h + 0.05 + 0.01 * (s - a) / (b - a);
  return S.h + 0.06 + (S.deckY - S.h - 0.06) * Math.min(1, (s - b) / (S.depth - b));
}
// the dashboard's options as a cockpit puts it: as set.js cockpitPlan does (its canopy and gap as there)
export function cockpitDash({ seats = 2, gap = 0.5, canopy = {}, dash = {} } = {}) {
  const three = seats === 3, xs = three ? [1, 0, -1] : [0.5, -0.5], cy = canopy.y ?? 1.2, cz = canopy.z ?? 1.6;
  const o = { seats: three ? 3 : 2, seatsAt: xs.map((x) => -x), depth: cz - gap - 0.005, deckY: cy - 0.01, ...dash };
  // (the row's screens are given in the ship's own x, to port, as the seats are: the dashboard is turned round)
  if (dash.bank) o.bank = { ...dash.bank, screens: dash.bank.screens.map((q) => ({ ...q, x: -q.x })) };
  return o;
}
export function bankOf(S, bank) {
  const { s, lean } = bank, y = topAt(S, s), r = S.R + s, cl = Math.cos(lean), sl = Math.sin(lean);
  return bank.screens.map(({ face, x, w, aspect = 2 }) => {
    const th = Math.asin(Math.max(-1, Math.min(1, x / r))), foot = arcAt(S.R, s, y, th), h = w / aspect, half = (w + 2 * MFD_BEZEL) / 2 / r;
    // (up its middle: upright, leaned back toward the nose (away from the seats, -z here), turned with the arc)
    const up = [sl * Math.sin(th), cl, -sl * Math.cos(th)];
    return { face, x, w, h, th, foot, up, hb: h + 2 * MFD_BEZEL + MFD_KEYS, span: [r * Math.sin(th - half), r * Math.sin(th + half)] };
  });
}
export function shipBank(C, base) {
  const o = cockpitDash({ seats: C.seats ?? 2, gap: C.gap, canopy: C.canopy, dash: C.dash }), S = dashShape(o), b = o.bank;
  if (!b) return null;
  const z0 = C.seatsZ + C.gap, cz = z0 - S.R, y = base + topAt(S, b.s);
  return { cz, R: S.R, s: b.s, y, r: S.R + b.s, lean: b.lean,
    screens: bankOf(S, b).map((q) => ({ face: q.face, x0: -q.span[1], x1: -q.span[0], xm: -q.x, w: q.w, h: q.h, hb: q.hb })) };
}
