// THE BRIDGE JOB IN PLAIN NUMBERS (no three.js, so the tests run it as it is): what the engineer pays, the bridge's
// fingerprint (a rating holds for the bridge it was worked out for), the ways named as the valley has them, where the
// builder's camera starts, and the travellers' two ways across the western river (over the bridge; by the crossing
// upriver, for those the bridge doesn't carry). src/bridgejob.js is the job, src/bridgetraffic.js the travellers.

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

// Each from its town side to its far side, as [x, z] points. THE BRIDGE: the road up from the town's west trail
// (landpath10), to the north abutment, over the bridge's deck (its middle line, x -339.2), down the far bank's road
// (landpath8) to the south. Nothing else crosses at the ravine (there is no ford beside it). UPRIVER, the travellers'
// usual way across: the road that leaves the valley's west road about 100 m west of the bridge road's turn
// (landpath13) and wades the river where it comes down from the north-west (landpath14, about 190 m west-north-west of
// the bridge), then on west along the far bank toward the misty west end (landpath15). That way starts a little down
// its road from the west road (a wagon dissolving in there is clear of the valley's own wagons on it: src/traffic.js).
const NORTH = [[-337.5, -81.3], [-337.5, -72], [-337.5, -63]];
const SOUTH = [[-348.1, -15.6], [-350.6, -12.5], [-353.4, -9.4], [-356.4, -6.3], [-359.4, -3.1]];
export const ROUTES = {
  bridge: [...NORTH, [-337.7, -53], [-338.6, -48.6], [-339.2, -46.2], [-339.2, -42.25], [-339.2, -38.3], [-339.9, -36.5], [-341.9, -34.4], [-343.3, -28.1], [-344.7, -21.9], ...SOUTH],
  upriver: [[-453.1, -140], [-459.4, -134.3], [-465.6, -128.1], [-471.9, -121.9], [-478.1, -115.6], [-484.4, -109.4], [-490.6, -103.1], [-496.9, -96.9],
    [-503.1, -90.9], [-509.4, -85.7], [-515.6, -80.7], [-525, -73.9], [-528.1, -72.4], [-531.3, -71.1], [-534.4, -70.2], [-543.8, -68.9], [-553.1, -68.8],
    [-562.5, -68.8], [-571.9, -68.8], [-581.3, -68.8], [-590.6, -68.8], [-600, -68.8]],
};
// where each way crosses the river (the middle of the ravine's gap; the shallows upriver): its travellers come and go
// while the player is near there
export const CROSS_AT = { bridge: [-339.2, -42.25], upriver: [-524, -74.5] };
// which way a traveller takes: upriver, unless the bridge carries its kind, and then over the bridge about half the
// time (BRIDGE_SHARE), so the road upriver keeps its own travellers once there is a bridge
export const BRIDGE_SHARE = 0.5;
export const wayFor = (carried, rand = Math.random) => (carried && rand() < BRIDGE_SHARE ? 'bridge' : 'upriver');
