// THE SHIP'S DASHBOARD, ITS NUMBERS: the plain part (no page and no three.js, so node tests it: tests/dash.test.mjs).
// The picture of it is src/flying.js (every ship's, from its own data in src/fleet.js: `dash`).
//
// THE GAME'S MAKER (2026-11-19, LAND-4, B: "In the cockpit, a hologram standing on the sill in front of the pilot beside
// the speed; from behind, floating beside the ship."), and: "You should use that big unused dashboard area. Like 1/3 of
// the screen is being unused in the screenshot. I'd move the speed down into it and put the tiny ship in a display
// there (and probably just show it all the time. There is no reason to waste all that space. Also just having the
// speed seems pretty basic. I can't tell what is on the lower screens, maybe they should move up a bit or we need more
// screens in the big unused area, but we should show more information like fuel or distance traveled or canisters
// full, time in route, something more than one number." And NOW-4, B: "A fuel gauge for show: it goes down as you fly,
// and there is always enough for the run."
//
// SO THE DASHBOARD READS, each a plain number with its unit:
//   SPEED          how fast the ship is going, m/s (as the speed's screen always said)
//   FUEL           a gauge and the tank's percent: full at the start; it goes down as the ship flies, a little for
//                  each second in the air and a little for each metre flown; and THERE IS ALWAYS ENOUGH: below LOW it
//                  goes down more and more slowly, and it never reaches FLOOR, however long anyone flies
//   DISTANCE       how far the ship has flown since it lifted off (the jump through the wormhole is not flown: it
//                  adds nothing), m, and km from 1,000 m
//   CANISTERS FULL on a mining run: how many of its canisters are full ("3 of 8"); none on a flight with no run (the
//                  Flight Lab)
//   FLIGHT TIME    since it lifted off, in minutes and seconds
//
//   const D = makeDash()                     a full tank, nothing flown
//   stepDash(D, { p, dt, flying })           each frame: p where the ship is now (any frame of metres; a move of more
//                                            than JUMPED in one step is a place changed, not flown), flying: in the air
//                                            (not standing on a floor)
//   dashRows(D, run)                         what the dashboard says: [{ id, label, value, unit, gauge }]; run: null, or
//                                            { cans: [full, of] }
//
// AND WHERE IT STANDS, CURVED (the game's maker, 2026-11-20, DASH1-3: "One thing that is kind of bugging me is that the
// new displays (tiny ship, speed, and distance) are in a perfect line, while the displays under them are curving. If
// that dashboard is curved, the the tiny ship should also be curved."): its three screens each a flat glass of their
// own, standing along the dashboard's curve and turned to face its middle, as the screens of the dashboard's face are
// (kit/shipparts/cockpit/consoles.js), with the life support and the screen beside it standing in the same row
// (kit/shipparts/cockpit/bank.js).
//   dashLayout(CW, CH)                       where things are on its picture (px)
//   dashCuts(L)                              where along its picture (0 .. 1, left to right as the seat sees it) one
//                                            screen's glass ends and the next one's begins: half way across each gap
//   dashPanels(P, cz, cuts)                  each screen's glass placed: P { at (the middle of its foot), w, h, lean }
//                                            (src/fleet.js `dash`), cz the dashboard's curve's middle (x = 0, z = cz, the
//                                            ship's kit frame) -> [{ u0, u1, phi (its turn), w (its glass's width), h,
//                                            foot, up, corners }]
export const FUEL = { perSec: 0.0006, perMetre: 0.00012, low: 0.3, floor: 0.12 };
// (a move longer than this in one step is the ship put somewhere else: the jump, a part skipped, the lab's buttons)
export const JUMPED = 20;
// (how quickly the speed read off the ship's moves settles, s)
export const EASE = 0.12;

export function makeDash() { return { fuel: 1, dist: 0, secs: 0, speed: 0, began: false, last: null }; }
export function resetDash(D) { Object.assign(D, makeDash()); return D; }

// the tank, after `use` of it at full rate: the same, more and more slowly below LOW, never down to FLOOR
export function burn(fuel, use) {
  const F = FUEL;
  if (use <= 0) return fuel;
  let f = fuel;
  if (f > F.low) { const d = Math.min(use, f - F.low); f -= d; use -= d; }
  if (use > 0) f = F.floor + (f - F.floor) * Math.exp(-use / (F.low - F.floor));
  return Math.max(F.floor, f);
}

export function stepDash(D, { p = null, dt = 0, flying = false } = {}) {
  let moved = 0;
  if (p && D.last) {
    const d = Math.hypot(p[0] - D.last[0], p[1] - D.last[1], p[2] - D.last[2]);
    if (d <= JUMPED) moved = d; else D.speed = 0;
    if (d <= JUMPED && dt > 0) D.speed += (d / dt - D.speed) * Math.min(1, dt / EASE);
  } else if (dt > 0) D.speed += (0 - D.speed) * Math.min(1, dt / EASE);
  if (p) D.last = [p[0], p[1], p[2]];
  if (flying) D.began = true;
  if (D.began) D.secs += dt;
  if (flying) { D.dist += moved; D.fuel = burn(D.fuel, FUEL.perSec * dt + FUEL.perMetre * moved); }
  return D;
}

// the words, each a plain number with its unit
export const speedText = (v) => String(Math.round(Math.max(0, v)));
export const fuelText = (f) => String(Math.round(Math.max(0, Math.min(1, f)) * 100));
export function distText(m) {
  m = Math.max(0, m);
  if (m < 1000) return [String(Math.round(m)), 'm'];
  const km = m / 1000;
  return [km < 100 ? km.toFixed(1) : Math.round(km).toLocaleString('en-US'), 'km'];
}
export function timeText(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min ${sec} s`;
  return `${sec} s`;
}

// WHAT THE DASHBOARD SAYS, in its order: the speed and the fuel, then how far, the canisters (on a run) and how long
export function dashRows(D, run = null) {
  const [dv, du] = distText(D.dist);
  const rows = [
    { id: 'speed', label: 'SPEED', value: speedText(D.speed), unit: 'm/s' },
    { id: 'fuel', label: 'FUEL', value: fuelText(D.fuel), unit: '%', gauge: Math.max(0, Math.min(1, D.fuel)) },
    { id: 'dist', label: 'DISTANCE', value: dv, unit: du },
  ];
  if (run && run.cans) rows.push({ id: 'cans', label: 'CANISTERS FULL', value: `${run.cans[0]} of ${run.cans[1]}`, unit: '' });
  rows.push({ id: 'time', label: 'FLIGHT TIME', value: timeText(D.secs), unit: '' });
  return rows;
}

// where things are on the display's picture (px): three screens in a row, the first square for the tiny ship (its
// picture `pic`, its caption under it), then the speed and the fuel, then the rest
export function dashLayout(CW, CH) {
  const m = Math.round(CH * 0.05), gap = Math.round(CH * 0.05), side = CH - 2 * m, w1 = Math.round(side * 1.22), rest = CW - 2 * m - w1 - 2 * gap;
  const s1 = { x: m, y: m, w: w1, h: side }, s2 = { x: s1.x + w1 + gap, y: m, w: Math.round(rest * 0.45), h: side };
  const s3 = { x: s2.x + s2.w + gap, y: m, w: CW - m - (s2.x + s2.w + gap), h: side };
  const pad = Math.round(CH * 0.03), capH = Math.round(CH * 0.13);
  return { CW, CH, s: [s1, s2, s3], pad, cap: { x: s1.x, y: s1.y + side - capH, w: w1, h: capH }, pic: { x: s1.x + pad, y: s1.y + pad, w: w1 - 2 * pad, h: side - 2 * pad - capH } };
}
export function dashCuts(L) {
  const [a, b, c] = L.s;
  return [0, (a.x + a.w + b.x) / 2 / L.CW, (b.x + b.w + c.x) / 2 / L.CW, 1];
}
export function dashPanels(P, cz, cuts) {
  const r = Math.hypot(P.at[0], P.at[2] - cz), mid = Math.atan2(P.at[0], P.at[2] - cz), sl = Math.sin(P.lean), cl = Math.cos(P.lean);
  // (along the curve from its left end, the port side as the seat sees it: x grows to port)
  const phiAt = (u) => mid + (0.5 - u) * P.w / r;
  const out = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    // (a flat glass across its stretch of the curve: its two ends on the curve, so the next glass's end meets it)
    const u0 = cuts[i], u1 = cuts[i + 1], a = phiAt(u0), b = phiAt(u1), phi = (a + b) / 2, w = 2 * r * Math.sin((a - b) / 2), rc = r * Math.cos((a - b) / 2);
    const foot = [rc * Math.sin(phi), P.at[1], cz + rc * Math.cos(phi)], up = [sl * Math.sin(phi), cl, sl * Math.cos(phi)], across = [Math.cos(phi), 0, -Math.sin(phi)];
    const corners = [];
    for (const e of [-0.5, 0.5]) for (const k of [0, 1]) corners.push([0, 1, 2].map((j) => foot[j] + across[j] * e * w + up[j] * k * P.h));
    out.push({ u0, u1, phi, w, h: P.h, foot, up, corners });
  }
  return out;
}
