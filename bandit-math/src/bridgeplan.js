// THE BRIDGE JOB IN PLAIN NUMBERS (no three.js, so the tests run it as it is): what the engineer pays, the bridge's
// fingerprint (a rating holds for the bridge it was worked out for), the ways named as the valley has them, where the
// builder's camera starts, and the two ways across the western river at the crossing (over the bridge; through the
// ford). src/bridgejob.js is the job, src/bridgetraffic.js the travellers on the crossing road.

// gold for each rating (labs/bridge/frame.js LOADS: person, horse and rider, covered wagon, freight wagon, cattle drive),
// each heavier one paying the difference: the whole top rating is 200 (the doubled economy: a long build, a few sittings)
export const PAY = [10, 30, 60, 120, 200];

// what a test of a bridge that carried `rating` pays when `paid` was already paid for (frame.js LOADS indexes; -1 none)
export function payFor(rating, paid, pay = PAY) {
  const had = paid >= 0 ? pay[Math.min(paid, pay.length - 1)] : 0, now = rating >= 0 ? pay[Math.min(rating, pay.length - 1)] : 0;
  return Math.max(0, now - had);
}

// a bridge's fingerprint: its boards and its deck (a test's rating holds for this bridge only)
export function bridgeSig(bridge, deck) {
  const r = (v) => Math.round(v * 100);
  return (bridge.boards || []).map((b) => [b.a.X, b.a.Y, b.a.Z, b.b.X, b.b.Y, b.b.Z].map(r).join(',')).sort().join(';') + '|' + (deck | 0);
}

// the ways, as the valley has them (the lab's frame turned a quarter: its east is south here, its south is west)
export const WAYS = { east: 'south', west: 'north', south: 'west', north: 'east' };
export const wordsHere = (s) => String(s).replace(/\b(north|south|east|west)/gi, (m) => { const w = WAYS[m.toLowerCase()]; return m[0] === m[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w; });

// the angle round the bridge the builder's camera starts at (its frame: 0 looks from the lab's south side, the west
// here): a view of the bridge's east side, a little round toward the end the rider stands at (az), so the engineer (on
// the west side) stands beyond the bridge, not between it and the camera
export function sideView(az) {
  let best = 0, bd = Infinity;
  for (const a of [Math.PI - 0.45, -Math.PI + 0.45]) { const d = Math.abs(Math.atan2(Math.sin(a - az), Math.cos(a - az))); if (d < bd) { bd = d; best = a; } }
  return best;
}

// north to south. The road up from the town's west trail (landpath10), to the north abutment, over the bridge's deck
// (its middle line, x -339.2), down the far bank's road (landpath8) to the south; the ford: from the road on the north
// bank down the ford's lane (landforms.js FORD), through the water and up, back to the road on the far side
const NORTH = [[-337.5, -81.3], [-337.5, -72], [-337.5, -63]];
const SOUTH = [[-348.1, -15.6], [-350.6, -12.5], [-353.4, -9.4], [-356.4, -6.3], [-359.4, -3.1]];
export const ROUTES = {
  bridge: [...NORTH, [-337.7, -53], [-338.6, -48.6], [-339.2, -46.2], [-339.2, -42.25], [-339.2, -38.3], [-339.9, -36.5], [-341.9, -34.4], [-343.3, -28.1], [-344.7, -21.9], ...SOUTH],
  ford: [...NORTH, [-338.6, -61], [-343, -59.6], [-348, -56.8], [-351.6, -52.4], [-353.1, -47.4], [-353.4, -42.3], [-353.2, -37.2], [-352.4, -31.6], [-351, -26], [-349.2, -20.6], [-347.6, -17.2], ...SOUTH.slice(1)],
};
export const routeOf = (onBridge) => (onBridge ? ROUTES.bridge : ROUTES.ford);
