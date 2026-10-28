// THE HOLD-UPS' PLAN, in plain numbers (no three.js, so the tests can load it): which gang rides next, where the riders
// ride round a held-up wagon, the road it stands on, which wagon a gang jumps (on the way, or sent by the jobs board),
// how many waves a hold-up has, how the wagon's health wears, how often the gang's guns go off, and the driver's words.
// Used by src/missions/wagonjob.js; tested in tests/wagonjob.test.mjs (and the gangs by tests/series.test.mjs and the
// levels rigs).

import { pickFact, pickTable } from '../math/facts.js';
import { TABLE_ORDER } from '../math/series.js';
import { isOn } from '../levels/model.js';
import { slotFiles, slotTakes } from '../audio/clipslots.js';
import { shiftLength, pace } from '../shifts.js';

// ── WHICH GANG RIDES NEXT ────────────────────────────────────────────────────────────────────────────────────────────
// From the rider's level here (q: src/levels/model.js levelFor 'wagon'): odds and evens, a table's gang, or a
// missing-number card. A gang level's own table, but once placed every third gang (n: gangs dealt this ride, counting
// this one) is an earlier table the rider has met on the way (the weak ones more: src/math/facts.js pickTable),
// recorded at that table's own level; the any-table level picks every gang that way. A table's first two gangs reach
// up to x10 (met: the times trainer's gangs of it so far), then x12.
//   chooseGang(rider, q, { n, lastTable, lastFact, met }) -> { kind: 'parity', want, top, level, count }
//     | { kind: 'rule', table, reach, level, count } | { kind: 'missing', fact: { t, a, upTo }, key, level, count }
export const GANG = { riders: 8, reviewEvery: 3 };   // riders in a gang (a hold-up's own count: gangSize); a review every 3rd
export function chooseGang(rider, q, { n = 1, lastTable = null, lastFact = null, met = () => 0, rand = Math.random } = {}) {
  const g = q.level.gen, count = GANG.riders;
  if (g.kind === 'parity') return { kind: 'parity', want: g.want, top: g.top, level: q.id, count };
  if (g.kind === 'missing') {
    const f = pickFact(rider, { tables: TABLE_ORDER.filter((t) => t <= g.upTo), upTo: g.upTo, from: 2, last: lastFact, rand });
    return { kind: 'missing', fact: { t: f ? f.a : 7, a: f ? f.b : 8, upTo: g.upTo }, key: f ? f.key : null, level: q.id, count };
  }
  let t = g.table, level = q.id;
  if (!t) t = pickTable(rider, g.open, { last: lastTable, rand }) || g.open[0];
  else if (!q.placing && n % GANG.reviewEvery === 0 && g.open.length > 1) {
    // (an earlier table whose gang level a grown-up switched off on the levels page isn't reviewed either)
    const r = pickTable(rider, g.open.filter((x) => x !== t && isOn(rider, 'wagon', `g${x}`)), { last: lastTable, rand });
    if (r) { t = r; level = `g${r}`; }
  }
  return { kind: 'rule', table: t, reach: met(t) < 2 ? 10 : 12, level, count };
}

// where each rider rides round the held-up wagon: [side (1 left, -1 right), metres out from the road's middle, metres
// ahead of the wagon (behind: negative)]. The first few are dealt first: close in front and beside, the rest behind.
export const SLOTS = [[1, 6, 5], [-1, 6.5, 3], [1, 9, -3], [-1, 9.5, -5], [1, 6, -10], [-1, 7, -11], [1, 11, 9], [-1, 11, 8],
  [1, 12, -15], [-1, 12, -16], [1, 8, 14], [-1, 8, -21]];

// "not in the 6-herd" from the times trainer reads "not in the 6-Gang" out here
export const gangLine = (line) => String(line || '').replace(/(\d+)-herd/g, '$1-Gang');

// the sacks a roped bandit drops for his number: 24 in the 6-Gang drops 4 sacks of 6 (on a missing-number card the
// number IS how many sacks of the table); an odds-and-evens bandit drops his number in pairs (8: 4 sacks of 2; 7: 3,
// the odd one kept), none past 24 (too many to lay out)
export function sacksFor(n, table, kind = 'rule') {
  if (!table) return { sacks: 0, per: 0 };
  if (kind === 'missing') return { sacks: n, per: table };
  if (kind === 'parity') return { sacks: n <= 24 ? Math.floor(n / 2) : 0, per: 2 };
  return n % table === 0 ? { sacks: n / table, per: table } : { sacks: 0, per: table };
}

// ── AN OPEN ROAD: a stretch of the road through the valley, the way a wagon goes along it ──────────────────────────
// Points [[x, z], ...] evenly spaced along it (about a metre apart), in the order the wagon goes.
//   road.at(s, out) at s metres along (any s: past either end, straight on from the end) -> { x, z, h (heading: facing
//                   (sin h, cos h)), nx, nz (one metre to the left-hand side) }
//   road.length, road.nearest(x, z) -> s, road.track(x, z, s, win) -> s (the nearest within win metres of s: cheap),
//   road.gap(a, b) -> b - a
export function makeOpenRoad(points) {
  const n = points.length, X = new Float64Array(n), Z = new Float64Array(n), H = new Float64Array(n);
  for (let i = 0; i < n; i++) { X[i] = points[i][0]; Z[i] = points[i][1]; }
  let length = 0; for (let i = 1; i < n; i++) length += Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
  const seg = length / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) { const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1); H[i] = Math.atan2(X[j] - X[k], Z[j] - Z[k]); }
  const road = { length, points, n, open: true };
  road.at = (s, out = {}) => {
    let x, z, h;
    if (s <= 0) { h = H[0]; x = X[0] + Math.sin(h) * s; z = Z[0] + Math.cos(h) * s; }
    else if (s >= length) { h = H[n - 1]; x = X[n - 1] + Math.sin(h) * (s - length); z = Z[n - 1] + Math.cos(h) * (s - length); }
    else {
      const u = s / seg, i = Math.min(n - 2, Math.floor(u)), f = u - i, dh = Math.atan2(Math.sin(H[i + 1] - H[i]), Math.cos(H[i + 1] - H[i]));
      x = X[i] + (X[i + 1] - X[i]) * f; z = Z[i] + (Z[i + 1] - Z[i]) * f; h = H[i] + dh * f;
    }
    out.x = x; out.z = z; out.h = h; out.nx = Math.cos(h); out.nz = -Math.sin(h);
    return out;
  };
  road.nearest = (x, z) => { let best = 0, bd = Infinity; for (let i = 0; i < n; i++) { const d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } } return best * seg; };
  road.track = (x, z, s, win = 30) => {
    const i0 = Math.round(s / seg), w = Math.ceil(win / seg); let best = s, bd = Infinity;
    for (let k = -w; k <= w; k++) { const i = Math.max(0, Math.min(n - 1, i0 + k)), d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < bd) { bd = d; best = i * seg; } }
    return best;
  };
  road.gap = (a, b) => b - a;
  return road;
}

// ── HOLD-UPS: a gang jumps a wagon travelling the long roads ───────────────────────────────────────────────────────
// Out on the road through the valley, well away from the town, a gang rides up on a travelling wagon: it pulls up, the
// driver shouts "Help!", and the player rides over and ropes the bandits (the gang's numbers at the rider's own level).
// It happens now and then on the way (the player out on the long roads), and at once when "Protect the wagon" is
// picked on the jobs board (the nearest good wagon out of town: boardPick). A hold-up comes in waves (HOLDUP below);
// with 3 to 5 roped a wave's riders ride off, and after the last the driver thanks the player, pays a little and
// drives on the way it was going. "Protect the wagon" turned off for the rider: no hold-ups.
export const AMBUSH = {
  out: 170,           // m along the road from the town square: a wagon further out than this is on the long roads
  player: 130,        // m: the player too must be out this far along the road ...
  roadNear: 45,       // ... and no further than this from its middle
  from: 45, to: 175,  // m from the player to the wagon: near enough to see, not right on top of them
  first: 45,          // s out on the long roads before the first hold-up of a ride
  every: [110, 220],  // s out on the long roads between one hold-up and the next
  riders: [6, 9],     // riders in the bunch for a gang wearing a table's multiples (about half are the gang: 3 to 5)
  most: 5,            // bandits roped that see a wave off (any more ride off with the rest)
  bonus: 10,          // gold the driver pays the player at the end, on top of each wave's usual pay
  wait: 150,          // s the gang holds a wagon up for a player who doesn't come; then the driver makes a run for it
                      // (one the jobs board sent waits for the player: it is the job picked)
  far: 240,           // m: the player further than this from the hold-up (once they have been there): the driver makes
                      // a run for it
  helpEvery: 3.5,     // s between the driver's shouts of "Help!" ...
  helpNear: 20,       // ... till the player is this close (m)
  // the driver's recorded shouts (src/audio/clipslots.js, slot helpBandits: the game maker's four takes, sounds/voice/help_1..4 .ogg
  // and .m4a): one at a time at random (never the same twice running), positioned at the wagon, his bubble saying that
  // take's words; then helpRest s of quiet before the next. With no sound the bubble shows "Help!" alone
  helpClips: slotFiles('helpBandits'),
  helpTakes: slotTakes('helpBandits'),
  helpRest: 2.5,
  spawn: [70, 190],   // m along the road from the wagon the gang rides in from (the nearest out of the player's sight)
  hold: 26,           // m: wagons and travellers coming up behind (or toward) a held-up wagon wait this far short of it
  open: 0.65,         // the share of the ground round the wagon that must be clear for the riders (no thick trees)
  jobs: 70,           // m: none held up this near the round-up's pasture or the corral (two jobs' questions at once there)
  mist: 0.1,          // the most mist at the wagon (W.fogAt, the banks at the valley's ends): none held up in it, unseen
  // the jobs board's hold-up: a wagon out of town (AMBUSH.out) but no further than `boardFar` m along the road from the
  // square (riding there is part of the job: not too long); none on the road just then: one is sent there, out of
  // sight, at one of `send` m out from the square (either side); `again`: s after one ends before the next is sent
  boardFar: 330, send: [210, 240, 270, 300, 190], again: 20,
  // the driver's shout in his bubble with no recorded take to go with it (no sound, or a woman driving: the game maker's voice
  // is a man's, src/audio/shouts.js)
  words: { help: 'Help!' },
};
// how many riders ride up for a gang
export const gangSize = (rand = Math.random) => AMBUSH.riders[0] + Math.floor(rand() * (AMBUSH.riders[1] - AMBUSH.riders[0] + 1));
// the player is out on the long roads: pu metres along the road (the nearest point), off metres from its middle,
// square: where the town square is along it
export const outOnRoad = ({ pu, off, square }) => Math.abs(pu - square) >= AMBUSH.player && off <= AMBUSH.roadNear;
// which travelling wagon a gang jumps, or null. Each candidate: { u (m along the road), dist (m from the player), made
// (drawn), onRoad (on its way, not pulling off or standing at a spot), held, ended, plan (it means to pull off in
// town), seen (in the player's view), open (the share of the ground round it that is clear), mist (W.fogAt there),
// atJob (within AMBUSH.jobs of the pasture or the corral), male (a man drives it: his recorded shouts go with it) }.
// Out on the long roads, near enough to see and not on top of the player, with room round it for the riders; one in
// view first, then one a man drives, then the one nearest a middling distance.
const fits = (t) => t.onRoad && !t.held && !t.ended && !t.plan && (t.open ?? 1) >= AMBUSH.open && (t.mist ?? 0) <= AMBUSH.mist && !t.atJob;
export function ambushPick(list, { square }) {
  const ok = list.filter((t) => t.made && fits(t) && Math.abs(t.u - square) >= AMBUSH.out && t.dist >= AMBUSH.from && t.dist <= AMBUSH.to);
  if (!ok.length) return null;
  ok.sort((a, b) => (b.seen ? 1 : 0) - (a.seen ? 1 : 0) || (b.male ? 1 : 0) - (a.male ? 1 : 0) || Math.abs(a.dist - 100) - Math.abs(b.dist - 100));
  return ok[0];
}
// the jobs board's hold-up: which travelling wagon, or null (then one is sent: AMBUSH.send). The same candidates as
// ambushPick's, drawn or not (the traffic draws it as the player comes near); out of town but within AMBUSH.boardFar of
// the square, the nearest to the player (a man driving first, among those about as near)
export function boardPick(list, { square }) {
  const ok = list.filter((t) => fits(t) && Math.abs(t.u - square) >= AMBUSH.out && Math.abs(t.u - square) <= AMBUSH.boardFar);
  if (!ok.length) return null;
  const score = (t) => t.dist - (t.male ? 40 : 0);
  ok.sort((a, b) => score(a) - score(b));
  return ok[0];
}

// ── A HOLD-UP: WAVES, THE WAGON'S HEALTH, THE GUNS, THE THANKS ───────────────────────────────────────────────────────
// A hold-up is a small shift: a few waves of the gang, one after the other (each a gang with its rule card, the same
// math and help as ever), a short quiet between, then the driver's thanks and the pay. How many waves: the shifts' pace
// rules (src/shifts.js SHIFT.holdup: 2 for the youngest or slower riders, 3 for most, 4 for quick ones).
// The wagon has a health bar. While the player is with it and a wave is on, each bandit of the wave who has ridden in
// and is still loose wears it down a little each second; an arrest stops his share at once, a wrong pick costs nothing
// more than the time. The wear is worked out so that a kid arresting at about the pace expected at their level
// (perArrest, by the same pace) gets through every wave with most of the bar left (wear: the share it takes), and only
// a kid who leaves the gang alone a long while (minutes) sees it empty. Empty: "they grab the box": a bandit takes the
// strongbox off the wagon, the gang rides off, the hold-up ends early with the smaller pay, the driver is all right and
// says so. Nothing is taken from the player.
export const HOLDUP = {
  between: 6,          // s of quiet after a wave before the next gang rides in
  health: 100,         // the wagon's health at the start of a hold-up (it carries on from wave to wave)
  perArrest: [18, 9],  // s an arrest takes, as expected: at the slow end of the pace (a young or slower kid) .. the quick end
                       // (reading the numbers, picking, riding into reach, the throw and the fall)
  wear: 0.3,           // the share of the bar a whole hold-up at that pace wears off (three times as slow still gets through)
  bandits: 4,          // bandits in a wave, as the wear is worked out (a wave has 3 to 5)
  low: 0.3,            // the bar under this share: it goes orange and the driver's shouts come again
  pay: { grabbed: 4 }, // gold the driver pays when the box was grabbed (AMBUSH.bonus when the wagon got through safe)
  // the guns: everyone in the bunch rides with a revolver out, so a gun never tells who is a bandit (the number does).
  // Now and then one fires: into the air, or into the wagon's boards or the dirt by its wheels (never toward the
  // player). The more bandits loose, the more shots: each loose one's worth every `every` s (at random), from a rider
  // picked at random; `air` of them into the air; `ping`: a shot at the wagon that glances off the iron tyre instead
  shots: { every: 4.5, air: 0.55, near: 26, ping: 0.2, clear: 3 },
  // the driver's thank-you at the end: one of the game maker's recorded takes (src/audio/shouts.js VOICE_CLIPS), its own words in
  // his bubble, never the same words twice running. A woman driving: the words alone
  thanks: [
    { clip: 'thankya_kindly_1', says: 'Thank ya kindly!' }, { clip: 'thankya_kindly_2', says: 'Thank ya kindly!' },
    { clip: 'thankya_kindly_3', says: 'Thank ya kindly!' }, { clip: 'thankya_partner_1', says: 'Aw, thank ya, partner!' },
    { clip: 'obliged_1', says: 'Aw, much obliged!' }, { clip: 'obliged_2', says: 'Much obliged!' },
    { clip: 'obliged_partner_1', says: 'Much obliged, partner!' }, { clip: 'lifesaver_1', says: "You're a real life saver!" },
  ],
  // the box grabbed: he's all right and says so (no take of this: the words alone), then his recorded thanks for trying
  grabbed: "I'm all right, partner! They only got the strongbox.",
  grabbedThanks: { clip: 'obliged_partner_1', says: 'Much obliged, partner!' },
};
// how many waves a hold-up has, for this rider (the shifts' pace: 2 to 4)
export const holdUpWaves = (rider) => shiftLength(rider, 'wagon');
// the s an arrest is expected to take this rider (HOLDUP.perArrest by the shifts' pace)
export const perArrest = (rider) => { const [slow, quick] = HOLDUP.perArrest; return slow + (quick - slow) * pace(rider, 'wagon'); };
// health points a second each loose bandit wears off: a hold-up of `waves` waves of HOLDUP.bandits, each arrested
// `per` s after the last (so the loose ones go g, g-1 .. 1), wears HOLDUP.wear of the bar
export function wearRate(per, waves) {
  const g = HOLDUP.bandits, looseSeconds = Math.max(1, waves) * Math.max(1, per) * g * (g + 1) / 2;
  return HOLDUP.health * HOLDUP.wear / looseSeconds;
}
// the health after dt seconds with `loose` bandits loose (never under 0)
export const wearStep = (health, loose, rate, dt) => Math.max(0, health - Math.max(0, loose) * rate * Math.max(0, dt));
// the driver's thank-you take: never the same words as the last one (last: the words said last time)
export function pickThanks(last = null, rand = Math.random) {
  const L = HOLDUP.thanks, ok = L.filter((t) => t.says !== last);
  const from = ok.length ? ok : L;
  return from[Math.floor(rand() * from.length) % from.length];
}
// how long till the next shot: `loose` bandits loose (none: no shots)
export const shotGap = (loose, rand = Math.random) => (loose > 0 ? HOLDUP.shots.every / loose * (0.5 + rand()) : Infinity);
