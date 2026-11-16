// THE CRANE'S ROUND, AS A TIMETABLE. One round of the smelter's ore line is worked out ahead, once, as a list of
// moves with their start and end times; where everything is at any moment is then read off it (valueAt, canAt). So
// nothing is kept from frame to frame but a clock: the round can be looked up at any time, run fast for a film, or
// left alone while nobody is watching, and it costs a few look-ups a frame. No three.js here: node tests it
// (tests/crane.test.mjs) and the smelter job reads the load from it (src/jobs/smelter.js).
//
// THE ROUND (the game's maker's, 2026-11-05: "a ceiling crane started grabbing the canisters off the ship and
// connecting them to the wall socket ... when the full canisters were removed it could grab some empty canisters from
// a stack and load them back on the ship"):
//   unload   each full canister off the ship into a free socket (upper row off the ship first: a lower one cannot come
//            up past one above it; lower sockets first: an upper one cannot be reached over a docked lower... the
//            other way round), where it drains into the crusher
//   load     the empties from the rack onto the ship's mounts (lower mounts first)
//   clear    the drained canisters from the sockets to the rack (upper sockets first): they are the next round's
//            empties, which is what lets the round go on for ever
//   pause    the Miner "away on its run": nothing moves; then its canisters are full again, and round again
//
// HOW A CANISTER IS HANDLED (kit/smelter.js says why the crane is made this way):
//   at the ship    the mount's tray slides the canister out sideways (the ship's own move); the open cradle comes
//                  down on it, the latch takes its lug, the arms slide round under it, up it goes, the tray slides home
//   on the rail    carried high (site.carry), hanging along the trolley's beam. From the ship's leg to the wall's leg
//                  the trolley stops on the turntable, which turns it a quarter turn: the canister now points at the wall
//   at a socket    the iris opens; down to the socket's height just clear of its mouth; the carriage's last half
//                  metre along the beam pushes it in end-on (slowly); the collar's ring lights; arms open, latch off,
//                  cradle up. It drains: its strips shorten, its rings go from amber to blue, the display counts down
//   on the rack    set down between its neighbours (the arms slide round, they do not swing out)
//
//   planCycle(site, state) -> plan    site: the places (below); state: { bayYaw: [...] } how each rack canister lies
//   valueAt(track, t)                 a moving thing's value at time t (plan.T.x, .z, .yaw, .disc, .slide, .hoist,
//                                     .arms, .latch, .tray[i], .iris[k], .lit[k])
//   canAt(plan, c, t)                 where canister c is: { where: 'mount' | 'held' | 'socket' | 'bay', i, yaw, rel }
//   fillAt(plan, c, t)                how full it is, 1 to 0
//   loadAt(plan, t)                   the load in plain numbers, for the job's pay slip
//   gateAt(plan, t)                   the patch of floor the crane is working over (or about to), or null
export const SPEED = {
  travel: { v: 2.0, a: 0.8 },      // the trolley along the rail: metres a second, and how fast it gets there
  hoist: { v: 1.1, a: 0.8 },       // the cradle up and down
  set: { v: 0.22, a: 0.3 },        // the last of a set-down
  slide: { v: 0.6, a: 0.5 },       // the carriage along the beam
  push: { v: 0.2, a: 0.15 },       // the same, pushing a canister into a collar or drawing it out
  turn: 4.5,                       // the turntable's quarter turn (seconds)
  arms: 1.8, latch: 0.7, clamp: 0.6, iris: 1.4, tray: 5,
  drain: 75,                       // a canister emptying into the crusher
  settle: 0.5,                     // a breath between one move and the next
  pause: 45, refill: 12, rest: 8,  // between rounds: the Miner away; its canisters filling again; then a moment
};
const TAU = Math.PI * 2, QUARTER = Math.PI / 2;
// a move of `d` at up to v, speeding up and slowing down at a: [how long, the share of that spent speeding up]
export function moveTime(d, { v, a }) { const ramp = v / a; return d >= v * ramp ? [d / v + ramp, ramp / (d / v + ramp)] : [2 * Math.sqrt(d / a), 0.5]; }
// how far along (0..1) a move is at share x of its time: speeding up for k of it, steady, slowing down for k
export function along(x, k) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  if (k < 1e-4) return x;
  const c = 1 / (2 * k * (1 - k));
  return x < k ? c * x * x : x > 1 - k ? 1 - c * (1 - x) * (1 - x) : (x - k / 2) / (1 - k);
}
export function valueAt(track, t) {
  const S = track.segs; if (!S.length) return track.v0;
  let i = Math.min(track.i || 0, S.length - 1);
  while (i > 0 && S[i].t0 > t) i--;
  while (i < S.length - 1 && S[i + 1].t0 <= t) i++;
  track.i = i;
  const s = S[i];
  return t <= s.t0 ? s.a : t >= s.t1 ? s.b : s.a + (s.b - s.a) * along((t - s.t0) / (s.t1 - s.t0), s.k);
}
// (the last entry of a time-ordered list that has begun by t; each list keeps where it last looked)
function lastAt(list, t) {
  let i = Math.min(list.i || 0, list.length - 1);
  while (i > 0 && list[i].t0 > t) i--;
  while (i < list.length - 1 && list[i + 1].t0 <= t) i++;
  list.i = i; return list[i];
}
const near0 = (a) => { a = ((a % TAU) + TAU) % TAU; return a > Math.PI ? a - TAU : a; };   // an angle as -180..180 degrees

// THE SITE (plain numbers, metres, the station's frame: x east, z south, y up; angles about up, 0 = pointing +z):
//   carry          a carried canister's middle line (height)
//   wallZ, shipX   the two legs' lines; turn: [x, z] where they meet; home: [x, z] where the trolley parks (wall leg)
//   mounts[i]      { at: [x, y, z] the canister's middle on its mount, yaw: the way its +z end points, out: [dx, dz]
//                    the tray's slide, upper: on the upper row }
//   sockets[k]     { at: [x, y, z] the middle of the collar's mouth, n: [nx, nz] the way it faces, upper }
//   bays[j]        { at: [x, y, z] the canister's middle on the rack }
//   can            { half: half its length, seat: how far in its end sits, clear: how far off the mouth it comes down,
//                    rise: how far the cradle lifts off a docked canister before backing away (both keep the cradle
//                    out from under whatever stands out of the wall above), lift: how far a tray lifts it off its
//                    mount before sliding out }
export function planCycle(site, state = {}, speed = SPEED) {
  const S = speed, { half, seat, clear } = site.can, lift = site.can.lift || 0, rise = site.can.rise || 0, M = site.mounts, K = site.sockets, B = site.bays;
  const track = (v0) => ({ v0, last: v0, end: 0, segs: [] });
  const T = { x: track(site.home[0]), z: track(site.home[1]), yaw: track(0), disc: track(0), slide: track(0), hoist: track(site.carry), arms: track(0), latch: track(0),
    tray: M.map(() => track(0)), iris: K.map(() => track(0)), lit: K.map(() => track(0)) };
  // a stretch of a track from t0 (or when the track is next free) taking `time`, speeding up for share k of it
  const seg = (tr, t0, to, time, k = 0.3) => { t0 = Math.max(t0, tr.end); if (Math.abs(to - tr.last) < 1e-9) return t0; tr.segs.push({ t0, t1: t0 + time, a: tr.last, b: to, k }); tr.last = to; tr.end = t0 + time; return tr.end; };
  const move = (tr, t0, to, kin) => { const [time, k] = moveTime(Math.abs(to - tr.last), kin); return seg(tr, t0, to, time, k); };
  const even = 1e-5;   // (a share so small the move is at one speed: the trays, which the kit's own heavy doors ease)

  // the canisters: 0..n-1 start on the mounts (full), the rest on the rack (empty)
  const nM = M.length, bayYaw = state.bayYaw || B.map(() => 0);
  const cans = [...M.map((m, i) => ({ spans: [{ t0: 0, where: 'mount', i, yaw: m.yaw }], fill: [{ t0: 0, t1: 0, a: 1, b: 1 }] })),
    ...B.map((b, j) => ({ spans: [{ t0: 0, where: 'bay', i: j, yaw: bayYaw[j] }], fill: [{ t0: 0, t1: 0, a: 0, b: 0 }] }))];
  const yawOf = (c) => cans[c].spans[cans[c].spans.length - 1].yaw;
  const gates = [], phases = [], docks = [];
  let leg = 'wall', t = 0;

  // ── the trolley along the rail, to `p` on a leg; `yawTo`: how it must be turned when it gets to the other leg ──
  // -> { last: when its last straight run began, end: when it arrived }
  function travel(to, p, t0, yawTo = null) {
    if (to === leg) {
      const tr = to === 'wall' ? T.x : T.z;
      // (straight over the turntable: its piece of rail must lie along this leg)
      if (to === 'wall' && (tr.last - site.turn[0]) * (p - site.turn[0]) < 0 && Math.abs(Math.sin(T.disc.last)) > 1e-6) throw new Error('crane plan: the turntable lies across the way');
      return { last: Math.max(t0, tr.end), end: move(tr, t0, p, S.travel) };
    }
    // (to the turntable, a quarter turn with it, on along the other leg; the carriage is home before the turn)
    const a = leg === 'wall' ? move(T.x, t0, site.turn[0], S.travel) : move(T.z, t0, site.turn[1], S.travel);
    const by = yawTo != null ? near0(yawTo - T.yaw.last) : to === 'ship' ? QUARTER : near0(-T.yaw.last);
    if (Math.abs(Math.abs(by) - QUARTER) > 1e-6) throw new Error('crane plan: not a quarter turn (' + by + ')');
    const t1 = Math.max(a, T.slide.end) + S.settle * 0.5;
    seg(T.disc, t1, T.disc.last + by, S.turn, 0.35); const t2 = seg(T.yaw, t1, T.yaw.last + by, S.turn, 0.35) + S.settle * 0.5;
    leg = to;
    return { last: t2, end: to === 'wall' ? move(T.x, t2, p, S.travel) : move(T.z, t2, p, S.travel) };
  }
  // where the carriage must stand along the beam for the hoist to hang over [x, z]
  const slideFor = (x, z) => (x - T.x.last) * Math.sin(T.yaw.last) + (z - T.z.last) * Math.cos(T.yaw.last);
  const put = (c, t0, span) => cans[c].spans.push({ t0, ...span });
  // (the patch of floor under a canister lying along x or along z, `wide` more across it and `long` more along it)
  const gate = (t0, x, z, alongX, wide = 0, long = 0) => { const g = { t0, t1: t0, x, z, hx: alongX ? half + long : 0.5 + wide, hz: alongX ? 0.5 + wide : half + long }; gates.push(g); return g; };

  // ── at a mount ──
  const outOf = (m) => [m.at[0] + m.out[0], m.at[2] + m.out[1]];
  function toMount(i, carrying) {
    const m = M[i], P = outOf(m);
    const r = travel('ship', P[1], t, carrying == null ? null : m.yaw - carrying.rel);
    const tS = move(T.slide, r.last, slideFor(P[0], P[1]), S.slide);
    // (its tray out as the crane comes, the patch under it kept clear from then until the tray is home again)
    const t0 = Math.max(r.last, T.tray[i].end), tT = seg(T.tray[i], Math.max(t0, r.end - S.tray), 1, S.tray, even);
    const g = gate(Math.max(t0, r.end - S.tray) - 0.6, (m.at[0] + P[0]) / 2, (m.at[2] + P[1]) / 2, Math.abs(Math.sin(T.yaw.last)) > 0.5, Math.hypot(m.out[0], m.out[1]) / 2);
    return { m, at: Math.max(r.end, tS, tT) + S.settle, g };
  }
  function fromMount(c, i) {
    const { m, at, g } = toMount(i, null);
    let tt = move(T.hoist, at, m.at[1] + lift, S.hoist);
    tt = seg(T.latch, tt + 0.2, 1, S.latch); tt = seg(T.arms, tt, 1, S.arms) + 0.3;
    put(c, tt, { where: 'held', rel: near0(m.yaw - T.yaw.last) });
    t = move(T.hoist, tt, site.carry, S.hoist);
    g.t1 = seg(T.tray[i], tt + 1.6, 0, S.tray, even) + 0.3;
    move(T.slide, t, 0, S.slide);
  }
  function ontoMount(c, i) {
    const rel = cans[c].spans[cans[c].spans.length - 1].rel, { m, at, g } = toMount(i, { rel });
    let tt = move(T.hoist, at, m.at[1] + lift + 0.3, S.hoist); tt = move(T.hoist, tt, m.at[1] + lift, S.set);
    tt = seg(T.arms, tt + 0.2, 0, S.arms); tt = seg(T.latch, tt, 0, S.latch) + 0.2;
    put(c, tt, { where: 'mount', i, yaw: m.yaw });
    t = move(T.hoist, tt, site.carry, S.hoist);
    g.t1 = seg(T.tray[i], tt + 1.5, 0, S.tray, even) + 0.3;
    move(T.slide, t, 0, S.slide);
  }
  // ── at a socket: the canister's middle when it is docked, and when it waits just clear of the mouth ──
  const docked = (k) => [K[k].at[0] + K[k].n[0] * (half - seat), K[k].at[2] + K[k].n[1] * (half - seat)];
  const waiting = (k) => [K[k].at[0] + K[k].n[0] * (half + clear), K[k].at[2] + K[k].n[1] * (half + clear)];
  function intoSocket(c, k) {
    const s = K[k], W = waiting(k), D = docked(k), alongX = Math.abs(s.n[0]) > 0.5;
    const r = travel('wall', alongX ? T.x.last : W[0], t);
    const tS = move(T.slide, r.last, slideFor(W[0], W[1]), S.slide);
    const tI = seg(T.iris[k], Math.max(r.last, r.end - S.iris - 1), 1, S.iris, 0.3);
    const at = Math.max(r.end, tS, tI) + S.settle, g = gate(at - 0.6, (W[0] + D[0]) / 2, (W[1] + D[1]) / 2, alongX, 0, (seat + clear) / 2);
    let tt = move(T.hoist, at, s.at[1], S.hoist);
    tt = move(T.slide, tt + 0.2, slideFor(D[0], D[1]), S.push);                        // (pushed in end-on)
    // (seated: it is the socket's from now; the collar takes hold, its ring coming on; then it drains)
    put(c, tt, { where: 'socket', i: k, yaw: T.yaw.last + cans[c].spans[cans[c].spans.length - 1].rel }); docks.push({ t0: tt, t1: Infinity, k, c });
    tt = seg(T.lit[k], tt, 1, S.clamp);
    cans[c].fill.push({ t0: tt + 1, t1: tt + 1 + S.drain, a: 1, b: 0 });
    tt = seg(T.arms, tt + 0.3, 0, S.arms); tt = seg(T.latch, tt, 0, S.latch) + 0.2;
    // (the cradle up off it, back out from the wall, then all the way up)
    tt = move(T.hoist, tt, s.at[1] + rise, S.hoist); tt = move(T.slide, tt, slideFor(W[0], W[1]), S.slide);
    t = g.t1 = move(T.hoist, tt, site.carry, S.hoist);
    move(T.slide, t, 0, S.slide);
  }
  function outOfSocket(c, k) {
    const s = K[k], W = waiting(k), D = docked(k), alongX = Math.abs(s.n[0]) > 0.5;
    const r = travel('wall', alongX ? T.x.last : D[0], t);
    const tS = move(T.slide, r.last, slideFor(W[0], W[1]), S.slide);
    const at = Math.max(r.end, tS) + S.settle, g = gate(at - 0.6, (W[0] + D[0]) / 2, (W[1] + D[1]) / 2, alongX, 0, (seat + clear) / 2);
    // (the open cradle down clear of the wall to just over the docked canister, in over it, and down onto it)
    let tt = move(T.hoist, at, s.at[1] + rise, S.hoist); tt = move(T.slide, tt, slideFor(D[0], D[1]), S.slide);
    tt = move(T.hoist, tt + 0.1, s.at[1] + 0.25, S.hoist); tt = move(T.hoist, tt, s.at[1], S.set);
    tt = seg(T.latch, tt + 0.2, 1, S.latch); tt = seg(T.arms, tt, 1, S.arms);
    // (the cradle has it: the collar lets go, its ring going dark)
    tt += 0.2; put(c, tt, { where: 'held', rel: near0(yawOf(c) - T.yaw.last) }); docks.find((d) => d.k === k && d.t1 === Infinity).t1 = tt;
    tt = seg(T.lit[k], tt, 0, S.clamp);
    tt = move(T.slide, tt + 0.2, slideFor(W[0], W[1]), S.push);                        // (drawn out end-on)
    t = g.t1 = move(T.hoist, tt + 0.2, site.carry, S.hoist);
    seg(T.iris[k], tt + 0.6, 0, S.iris, 0.3);
    move(T.slide, t, 0, S.slide);
  }
  // ── on the rack ──
  function toBay(j) {
    const b = B[j], r = travel('wall', b.at[0], t), tS = move(T.slide, r.last, slideFor(b.at[0], b.at[2]), S.slide);
    const at = Math.max(r.end, tS) + S.settle;
    return { b, at, g: gate(at - 0.6, b.at[0], b.at[2], Math.abs(Math.sin(T.yaw.last)) > 0.5) };
  }
  function fromBay(c, j) {
    const { b, at, g } = toBay(j);
    let tt = move(T.hoist, at, b.at[1], S.hoist);
    tt = seg(T.latch, tt + 0.2, 1, S.latch); tt = seg(T.arms, tt, 1, S.arms) + 0.3;
    put(c, tt, { where: 'held', rel: near0(yawOf(c) - T.yaw.last) });
    t = g.t1 = move(T.hoist, tt, site.carry, S.hoist);
    move(T.slide, t, 0, S.slide);
  }
  function ontoBay(c, j) {
    const rel = cans[c].spans[cans[c].spans.length - 1].rel, { b, at, g } = toBay(j);
    let tt = move(T.hoist, at, b.at[1] + 0.3, S.hoist); tt = move(T.hoist, tt, b.at[1], S.set);
    tt = seg(T.arms, tt + 0.2, 0, S.arms); tt = seg(T.latch, tt, 0, S.latch) + 0.2;
    put(c, tt, { where: 'bay', i: j, yaw: T.yaw.last + rel });
    t = g.t1 = move(T.hoist, tt, site.carry, S.hoist);
    move(T.slide, t, 0, S.slide);
  }

  // ── the round ──
  const idx = (n) => [...Array(n).keys()];
  const fromTurn = (k) => Math.hypot(K[k].at[0] - site.turn[0], K[k].at[2] - site.turn[1]);
  const fromWall = (i) => Math.abs(M[i].at[2] - site.wallZ) * 100 - M[i].at[0];               // (the wall's side first, then front before back)
  const upperFirst = idx(nM).sort((a, b) => (M[b].upper - M[a].upper) || fromWall(a) - fromWall(b));
  const lowerFirst = idx(nM).sort((a, b) => (M[a].upper - M[b].upper) || fromWall(a) - fromWall(b));
  const sockLower = idx(K.length).sort((a, b) => (K[a].upper - K[b].upper) || fromTurn(a) - fromTurn(b));
  const sockUpper = idx(K.length).sort((a, b) => (K[b].upper - K[a].upper) || fromTurn(a) - fromTurn(b));
  const bayNear = idx(B.length).sort((a, b) => Math.abs(B[a].at[0] - site.turn[0]) - Math.abs(B[b].at[0] - site.turn[0]));
  const order = { unload: [], load: [], clear: [] }, inSocket = new Map(), onMount = new Map(), inBay = new Map();
  t = S.rest; phases.push({ name: 'unload', t0: 0 });
  upperFirst.forEach((i, n) => { const k = sockLower[n]; fromMount(i, i); intoSocket(i, k); inSocket.set(k, i); order.unload.push([i, k]); });
  phases.push({ name: 'load', t0: t });
  bayNear.forEach((j, n) => { const i = lowerFirst[n], c = nM + j; fromBay(c, j); ontoMount(c, i); onMount.set(i, c); order.load.push([j, i]); });
  phases.push({ name: 'clear', t0: t });
  sockUpper.forEach((k, n) => { const j = bayNear[n], c = inSocket.get(k); outOfSocket(c, k); ontoBay(c, j); inBay.set(j, c); order.clear.push([k, j]); });
  // home; the Miner away; its canisters full again, one after another
  t = travel('wall', site.home[0], t).end;
  if (Math.abs(near0(T.yaw.last)) > 1e-6) throw new Error('crane plan: the trolley does not come home the way it left');
  phases.push({ name: 'pause', t0: t }); t += S.pause;
  phases.push({ name: 'refill', t0: t });
  idx(nM).forEach((i, n) => { const c = onMount.get(i), a = t + n * S.refill / (nM + 1); cans[c].fill.push({ t0: a, t1: a + 2 * S.refill / (nM + 1), a: 0, b: 1 }); });
  t += S.refill + S.rest;
  phases.forEach((p, n) => { p.t1 = n + 1 < phases.length ? phases[n + 1].t0 : t; });
  gates.sort((a, b) => a.t0 - b.t0); docks.sort((a, b) => a.t0 - b.t0);
  for (const d of docks) if (d.t1 === Infinity) throw new Error('crane plan: a canister was left in a socket');
  // who is where when the round ends: the next round's canisters on the mounts and on the rack, and how the rack's lie
  const next = { onMount: idx(nM).map((i) => onMount.get(i)), inBay: idx(B.length).map((j) => inBay.get(j)), bayYaw: idx(B.length).map((j) => near0(yawOf(inBay.get(j)))) };
  return { length: t, T, cans, gates, docks, phases, order, next, site };
}

// where canister c is at time t, and how full
export function canAt(plan, c, t) { return lastAt(plan.cans[c].spans, t); }
export function fillAt(plan, c, t) { const f = lastAt(plan.cans[c].fill, t); return t >= f.t1 ? f.b : t <= f.t0 ? f.a : f.a + (f.b - f.a) * (t - f.t0) / (f.t1 - f.t0); }
// the canister docked in each socket at time t (or -1), by socket
export function dockedAt(plan, t) { const out = plan.site.sockets.map(() => -1); for (const d of plan.docks) if (t >= d.t0 && t < d.t1) out[d.k] = d.c; return out; }
// the patch of floor the crane is working over at time t, or is about to within `ahead` seconds: { x, z, hx, hz }
export function gateAt(plan, t, ahead = 0) { for (const g of plan.gates) { if (g.t0 - ahead > t) break; if (t < g.t1) return g; } return null; }
export function phaseAt(plan, t) { return plan.phases.find((p) => t >= p.t0 && t < p.t1) || plan.phases[plan.phases.length - 1]; }
// THE LOAD IN PLAIN NUMBERS, for the pay slip: how many canisters the ship carries; how many of the ones on it are
// full; how many are docked and what each display reads (percent left); how many empties are on the rack
export function loadAt(plan, t) {
  const n = plan.site.mounts.length, out = { canisters: n, phase: phaseAt(plan, t).name, onShip: 0, fullOnShip: 0, docked: [], drained: 0, onRack: 0, carried: 0 };
  plan.cans.forEach((_, c) => {
    const at = canAt(plan, c, t), f = fillAt(plan, c, t);
    if (at.where === 'mount') { out.onShip++; if (f > 0.5) out.fullOnShip++; }
    else if (at.where === 'socket') { out.docked.push({ socket: at.i, percent: Math.round(f * 100) }); if (f <= 0) out.drained++; }
    else if (at.where === 'bay') out.onRack++; else out.carried++;
  });
  out.docked.sort((a, b) => a.socket - b.socket);
  return out;
}
