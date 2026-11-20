// THE LIFT'S RULES, as plain sums (no page, no three.js: node tests them, tests/lift.test.mjs). The box and its stops
// are kit/places-plan.js's; the game's lift (src/lift.js) asks these.
//   stopIn(p)                  the stop whose box a point (feet: [x, y, z] or {x, y, z}) is inside, or null
//   carry(p, heading, from, to) the same spot and the same way round in another stop's box: { at: [x, y, z], heading }
//   choices(from)              the stops a player in this one can pick, top to bottom as on a lift's panel
//   boxPoint(id, [x, y, z])    a point given in a stop's box (its doorway toward +z) where it is in the station
//   outOf(id)                  the heading of a player looking out of a stop's doorway
//   placeOf(p)                 which of the three places a point is in: 'tower', 'store' or 'deck' (by its height)
//   dirOf(from, to)            'up' or 'down'
//   words(from, to)            what the lift says while it goes: "Going up to the control room"
//   RIDE                       how long each part of a ride takes (s)
import { LIFT, STOPS, TOWER, STORE } from '../kit/places-plan.js';

export { STOPS };
export const RIDE = { shut: 1.1, go: 1.3, open: 0.9 };
const byId = (id) => STOPS.find((s) => s.id === id) || null;
const xyz = (p) => (Array.isArray(p) ? p : [p.x, p.y, p.z]);
// a point in a stop's own frame (its doorway toward +z, as the box is drawn), and back
function toBox(S, [x, y, z]) { const dx = x - S.at[0], dz = z - S.at[2], th = S.turn * Math.PI / 2; return [dx * Math.cos(th) - dz * Math.sin(th), y - S.at[1], dx * Math.sin(th) + dz * Math.cos(th)]; }
function fromBox(S, [lx, ly, lz]) { const th = S.turn * Math.PI / 2; return [S.at[0] + lx * Math.cos(th) + lz * Math.sin(th), S.at[1] + ly, S.at[2] - lx * Math.sin(th) + lz * Math.cos(th)]; }

// inside a box: within its clear floor (a little slack, so feet against a wall count) and standing on its floor
export function stopIn(p, slack = 0.08) {
  const q = xyz(p);
  for (const S of STOPS) {
    const [lx, ly, lz] = toBox(S, q);
    if (Math.abs(lx) <= LIFT.clear + slack && Math.abs(lz) <= LIFT.clear + slack && ly > -0.4 && ly < 1.2) return S.id;
  }
  return null;
}
export function carry(p, heading, from, to) {
  const A = byId(from), B = byId(to); if (!A || !B) return null;
  return { at: fromBox(B, toBox(A, xyz(p))), heading: heading + (B.turn - A.turn) * Math.PI / 2 };
}
export const choices = (from) => STOPS.filter((s) => s.id !== from);
// a point given in a stop's box (its doorway toward +z, [across, up, toward the doorway]) where it is in the station
export const boxPoint = (id, local) => { const S = byId(id); return S ? fromBox(S, local) : null; };
// the way a player faces looking out of a stop's doorway (a heading)
export const outOf = (id) => { const S = byId(id); return S ? S.turn * Math.PI / 2 : 0; };
export function placeOf(p) { const y = xyz(p)[1]; return y > TOWER.floor - 4 ? 'tower' : y < STORE.floor + STORE.h ? 'store' : 'deck'; }
export function dirOf(from, to) { const i = STOPS.findIndex((s) => s.id === from), j = STOPS.findIndex((s) => s.id === to); return j < i ? 'up' : 'down'; }
const TO = { tower: 'to the control room', deck: 'to the main deck', store: 'to the store room' };
export const words = (from, to) => `Going ${dirOf(from, to)} ${TO[to] || ''}`.trim();
