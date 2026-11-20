// THE HAULER'S CONTAINERS, A BOX OR A TANK AT RANDOM (the game's maker, HAUL3-1 2026-11-20, of which mix of boxes and
// tanks: "I would just do it randomly"): each of its eight container places gets a ribbed steel box or an eight-sided
// tank (kit/ships/cargo-container.js LOOKS ribbed and tank), one or the other at even odds, each place on its own,
// drawn when the Hauler is made (src/haulerdock.js; the Ship Lab's Mix chip, kit/ships/hauler-built.js LAB.menu). Plain
// data: node tests it (pi-nebula/tests/dockwalk.test.mjs).
//   drawMix(names, rand) -> { place name: 'ribbed' | 'tank' }   rand: () -> 0..1 (Math.random, or a rig's own)
export const MIX_LOOKS = ['ribbed', 'tank'];
export function drawMix(names, rand = Math.random) {
  const out = {};
  for (const n of names) out[n] = MIX_LOOKS[rand() < 0.5 ? 0 : 1];
  return out;
}
