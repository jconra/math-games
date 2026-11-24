// THE PAINT OF A SHIP THAT IS YOURS: whose it is to pick, and how it is kept. The plain part, with no page and no
// three.js, so node tests it (pi-nebula/tests/paint.test.mjs). The paints themselves, what of a hull is paint, and how
// it is laid on a ship: kit/ships/paints.js. In the game: src/shippaint.js lays each ship's paint for the crew member
// playing and shows the ship while it is picked; src/paintcard.js is the row of swatches on the owner's card.
//
// THE GAME'S MAKER, asked what he would want to change on a ship that is his (2026-11-23): "Its colour: pick the paint
// of its hull." (Of buying one, 2026-11-22: "you can now take it out any time you want and possibly customize it.")
//
// SO:
//   - ONLY A SHIP THAT IS THEIRS (src/own.js: bought, kept in the crew member's `ships`) can be painted by a crew
//     member; any other is in its own paint for them, whatever is written in their save.
//   - THE PAINT IS KEPT WITH THE CREW MEMBER, FOR THAT SHIP (crew.paints: { miner: 'olive' }; the ship's own paint is
//     kept as nothing at all). Each crew member on a device has their own: one's olive Miner is another's Miner as it
//     was built.
//   - IT COSTS NOTHING (COST: no word of his says it should; one number to change).
//   - THE SHIP IS THE SAME SHIP WHOEVER FLIES IT: on a captain's contract in a ship that is theirs, it is in their paint.
import { PAINTS, FACTORY, SHIP_IDS, paintById, tidyPaint, hullColour } from '../kit/ships/paints.js';
import { owns } from './own.js';

export { PAINTS, FACTORY };
// what a paint costs, credits
export const COST = 0;

// the crew member's paints as kept, tidied: ships this build knows, paints of the set, never the ship's own
export function paintsOf(crew) {
  const P = crew && crew.paints && typeof crew.paints === 'object' && !Array.isArray(crew.paints) ? crew.paints : {}, out = {};
  for (const ship of SHIP_IDS) { const id = typeof P[ship] === 'string' ? tidyPaint(P[ship]) : FACTORY; if (id !== FACTORY) out[ship] = id; }
  return out;
}
// may this crew member paint this ship: only one that is theirs
export const mayPaint = (crew, ship) => SHIP_IDS.includes(ship) && owns(crew, ship);
// the paint this ship is in for this crew member: theirs if the ship is theirs, else its own
export const paintOf = (crew, ship) => (mayPaint(crew, ship) ? paintsOf(crew)[ship] || FACTORY : FACTORY);
// PICKED: the paint kept with the crew member for that ship -> { ok: true, paint }, or { ok: false, why: 'unknown'
// (no such ship or paint) | 'notyours' }: nothing changed. (The caller saves the crew member.)
export function setPaint(crew, ship, id) {
  if (!crew || !SHIP_IDS.includes(ship) || !paintById(id)) return { ok: false, why: 'unknown' };
  if (!mayPaint(crew, ship)) return { ok: false, why: 'notyours' };
  const P = paintsOf(crew);
  if (id === FACTORY) delete P[ship]; else P[ship] = id;
  crew.paints = P;
  return { ok: true, paint: id };
}
// THE SWATCHES for a ship, as the owner's card shows them: every paint of the set with the colour the hull shows in it
// (the first, the ship's own skin), and which one is on for this crew member
export const swatchesOf = (crew, ship) => { const on = paintOf(crew, ship); return PAINTS.map((p) => ({ id: p.id, name: p.name, c: hullColour(ship, p.id), on: p.id === on })); };
