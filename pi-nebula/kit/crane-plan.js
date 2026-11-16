// THE CRANE'S ROUND, AS A TIMETABLE. One round of the smelter's ore line is worked out ahead, once, as a list of
// moves with their start and end times; where everything is at any moment is then read off it (valueAt, canAt). So
// nothing is kept from frame to frame but a clock: the round can be looked up at any time, run fast for a film, or
// left alone while nobody is watching, and it costs a few look-ups a frame. No three.js here: node tests it
// (tests/crane.test.mjs) and the smelter job reads the load from it (src/jobs/smelter.js).
//
// THE CRANE is a bridge crane (kit/smelter.js): the bridge rolls along the hangar (x), the trolley along the bridge
// (z, across the hangar), the hoist up and down, and the cradle turns the canister itself. The game's maker,
// 2026-11-16: "I think it would be better if the system could move in all 3 axis at the same time ... So when it
// picks up a canister it can start moving it in 3 different axis at once". So every trip moves x, z and the turn
// together, and the lift off a place runs on into the travel once the load is clear of what is round it.
//
// THE ROUND (the game's maker, 2026-11-05: "a ceiling crane started grabbing the canisters off the ship and
// connecting them to the wall socket ... when the full canisters were removed it could grab some empty canisters from
// a stack and load them back on the ship"; 2026-11-16: "once the crane work is done it shouldn't automatically start
// again. Now the ship is ready to go out"):
//   unload   each full canister off the ship into a free socket (upper ones off the ship first: a lower one cannot
//            come up past one above it; lower sockets first), where it drains into the crusher
//   load     the empties from the rack onto the ship's mounts (lower mounts first)
//   clear    the drained canisters from the sockets to the rack (upper sockets first): they are the next haul's
//            empties
//   done     home, and nothing moves: the Miner is ready to go out. The next round is the next haul's, after the
//            Miner has landed again (src/crane.js)
//
// HOW A CANISTER IS HANDLED (kit/smelter.js says why the crane is made this way):
//   at the ship    the mount's tray slides the canister out sideways (the ship's own move); the open cradle comes
//                  down on it, turned along it, the latch takes its lug, the arms slide round under it, up it goes,
//                  the tray slides home
//   on the way     carried high (site.carry): the bridge, the trolley and the cradle's turn all at once
//   at a socket    the canister turned end on to the wall; the iris opens; down to the socket's height just clear of
//                  its mouth; the trolley's last half metre pushes it in end-on (slowly); the collar's ring lights;
//                  arms open, latch off, cradle up. It drains: its strips shorten, its rings go from amber to blue,
//                  the display counts down
//   on the rack    set down between its neighbours (the arms slide round, they do not swing out)
//
//   planCycle(site, state) -> plan    site: the places (below); state: { bayYaw: [...] } how each rack canister lies
//                                     (and yaw: the cradle's); plan.next is how things are when it is done
//   planFrom(site, from) -> plan      the round taken up from a snapshot: after someone drove the crane by hand
//   stateAt(plan, t)                  everything at time t as plain numbers (the snapshot planFrom starts from)
//   cleanAt(plan, t)                  the next moment nothing is half done (when someone may take the controls)
//   valueAt(track, t)                 a moving thing's value at time t (plan.T.x, .z, .yaw, .hoist, .arms, .latch,
//                                     .tray[i], .iris[k], .lit[k])
//   canAt(plan, c, t)                 where canister c is: { where: 'mount' | 'held' | 'socket' | 'bay', i, yaw, rel }
//   fillAt(plan, c, t)                how full it is, 1 to 0
//   loadAt(plan, t)                   the load in plain numbers, for the job's pay slip
//   steadyAt(plan, t, ahead)          for how many seconds each of those numbers stays as it is
//   gateAt(plan, t)                   the patch of floor the crane is working over (or about to), or null
//   startOf(site, state)              the standard start: full canisters on the ship, empties on the rack
export const SPEED = {
  bridge: { v: 2.0, a: 0.8 },      // the bridge along the hangar (x): metres a second, and how fast it gets there
  trolley: { v: 1.5, a: 0.8 },     // the trolley along the bridge (y on the grid, z in the station)
  hoist: { v: 1.0, a: 0.8 },       // the cradle up and down
  turn: { v: 0.5, a: 0.5 },        // the cradle's turn (radians a second: a quarter turn in about 4 s)
  set: { v: 0.22, a: 0.3 },        // the last of a set-down
  push: { v: 0.2, a: 0.15 },       // the trolley pushing a canister into a collar or drawing it out
  arms: 1.8, latch: 0.7, clamp: 0.6, iris: 1.4, tray: 5,
  drain: 75,                       // a canister emptying into the crusher
  settle: 0.5,                     // a breath between one move and the next
  rest: 8,                         // before the first trip of a round
  clearOff: 0.8,                   // metres short of the top the lift is when the travel sets off (all axes at once)
};
const TAU = Math.PI * 2;
// a move of `d` at up to v, speeding up and slowing down at a: [how long, the share of that spent speeding up]
export function moveTime(d, { v, a }) { const ramp = v / a; return d >= v * ramp ? [d / v + ramp, ramp / (d / v + ramp)] : [2 * Math.sqrt(d / a), 0.5]; }
// how far along (0..1) a move is at share x of its time: speeding up for k of it, steady, slowing down for k
export function along(x, k) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  if (k < 1e-4) return x;
  const c = 1 / (2 * k * (1 - k));
  return x < k ? c * x * x : x > 1 - k ? 1 - c * (1 - x) * (1 - x) : (x - k / 2) / (1 - k);
}
// the share of its time at which a move is `f` (0..1) of the way
function shareAt(f, k) { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (along(m, k) < f) lo = m; else hi = m; } return (lo + hi) / 2; }
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
export const near0 = (a) => { a = ((a % TAU) + TAU) % TAU; return a > Math.PI ? a - TAU : a; };   // an angle as -180..180 degrees
// the turn of the cradle nearest `from` that lies along `axis` (either way: the cradle is the same end for end)
export const alongNear = (axis, from) => { let a = axis + Math.round((from - axis) / Math.PI) * Math.PI; return a; };

// THE SITE (plain numbers, metres, the station's frame: x east, z south, y up; angles about up, 0 = pointing +z):
//   carry          a carried canister's middle line (height): the hook as high as it goes
//   rail           { y: the runways' rail top, x: [lo, hi] where the bridge (and so the hook) may be along the hangar,
//                  z: [lo, hi] where the trolley may be along the bridge }
//   home           [x, z] where the crane parks
//   mounts[i]      { at: [x, y, z] the canister's middle on its mount, yaw: the way its +z end points, out: [dx, dz]
//                    the tray's slide, upper: on the upper row }
//   sockets[k]     { at: [x, y, z] the middle of the collar's mouth, n: [nx, nz] the way it faces, upper }
//   bays[j]        { at: [x, y, z] the canister's middle on the rack }
//   can            { half: half its length, seat: how far in its end sits, clear: how far off the mouth it comes down,
//                    rise: how far the cradle lifts off a docked canister before backing away (both keep the cradle
//                    out from under whatever stands out of the wall above), lift: how far a tray lifts it off its
//                    mount before sliding out }
// THE PLANNER: the crane's moves as timetable entries, from a given start. The round (planCycle) and a round picked up
// from wherever someone left things (planFrom) are both made of these moves; only where they start differs.
//   init   { x, z, yaw, hoist, arms, latch, tray: [..], iris: [..], lit: [..],
//            cans: [{ where: 'mount' | 'socket' | 'bay' | 'held', i, yaw, rel, fill }] }   (a snapshot: stateAt)
function makePlanner(site, init, speed) {
  const S = speed, { half, seat, clear } = site.can, lift = site.can.lift || 0, rise = site.can.rise || 0, M = site.mounts, K = site.sockets, B = site.bays;
  const track = (v0) => ({ v0, last: v0, end: 0, segs: [] });
  const T = { x: track(init.x), z: track(init.z), yaw: track(init.yaw), hoist: track(init.hoist), arms: track(init.arms), latch: track(init.latch),
    tray: M.map((_, i) => track(init.tray[i])), iris: K.map((_, k) => track(init.iris[k])), lit: K.map((_, k) => track(init.lit[k])) };
  // a stretch of a track from t0 (or when the track is next free) taking `time`, speeding up for share k of it
  const seg = (tr, t0, to, time, k = 0.3) => { t0 = Math.max(t0, tr.end); if (Math.abs(to - tr.last) < 1e-9) return t0; tr.segs.push({ t0, t1: t0 + time, a: tr.last, b: to, k }); tr.last = to; tr.end = t0 + time; return tr.end; };
  const move = (tr, t0, to, kin) => { const [time, k] = moveTime(Math.abs(to - tr.last), kin); return seg(tr, t0, to, time, k); };
  const even = 1e-5;   // (a share so small the move is at one speed: the trays, which the kit's own heavy doors ease)

  // the canisters, where they start and how full; a docked one with ore in it goes on draining
  const cans = init.cans.map((q) => ({ spans: [{ t0: 0, where: q.where, i: q.i, yaw: q.yaw, rel: q.rel }], fill: [{ t0: 0, t1: 0, a: q.fill, b: q.fill }] }));
  const docks = [];
  init.cans.forEach((q, c) => { if (q.where !== 'socket') return; docks.push({ t0: 0, t1: Infinity, k: q.i, c }); if (q.fill > 0) cans[c].fill.push({ t0: 0, t1: q.fill * S.drain, a: q.fill, b: 0 }); });
  const last = (c) => cans[c].spans[cans[c].spans.length - 1];
  const gates = [], phases = [];
  const P = { S, M, K, B, T, cans, docks, gates, phases, seg, move, last, t: 0 };

  // ── the crane's moves ──
  // the hook over [X, Z], the cradle turned to `yaw` (or left as it is), x, z and the turn all at once -> when there
  function travel(X, Z, yaw, t0) {
    const a = move(T.x, t0, X, S.bridge), b = move(T.z, t0, Z, S.trolley), c = yaw == null ? t0 : move(T.yaw, t0, yaw, S.turn);
    return Math.max(a, b, c);
  }
  // up to the carrying height from wherever it is, and from (when the load is clear of what is round it) on to [X, Z]
  // with the cradle turning to `yaw`: -> when it gets there
  function upAndOver(X, Z, yaw, t0) {
    const h0 = T.hoist.last, t1 = move(T.hoist, t0, site.carry, S.hoist), sg = T.hoist.segs[T.hoist.segs.length - 1];
    let go = t1;
    if (sg && sg.t1 === t1 && site.carry - h0 > S.clearOff + 0.05) go = sg.t0 + (sg.t1 - sg.t0) * shareAt((site.carry - S.clearOff - h0) / (site.carry - h0), sg.k);
    // (the patch a load was just taken from is watched until the load is well up)
    if (P.liftGate) { const g = P.liftGate; P.liftGate = null; const high = site.carry - 1.5; g.t1 = Math.max(g.t1, sg && sg.t1 === t1 && h0 < high ? sg.t0 + (sg.t1 - sg.t0) * shareAt((high - h0) / (site.carry - h0), sg.k) + 0.3 : t0); }
    return Math.max(t1, travel(X, Z, yaw, go));
  }
  // the cradle's turn for a canister at a place lying along `axis`, nearest the way it is now
  const turnFor = (axis) => alongNear(axis, T.yaw.last);
  // (the patch of floor under a canister lying along x or along z, `wide` more across it and `long` more along it)
  const gate = (t0, x, z, alongX, wide = 0, long = 0) => { const g = { t0, t1: t0, x, z, hx: alongX ? half + long : 0.5 + wide, hz: alongX ? 0.5 + wide : half + long }; gates.push(g); return g; };
  const put = (c, t0, span) => cans[c].spans.push({ t0, ...span });
  // (a canister set down on a mount lies as its mount wants it, or end for end: the way it was carried)
  const mountYaw = (m, yaw) => (Math.cos(yaw - m.yaw) >= 0 ? m.yaw : near0(m.yaw + Math.PI));
  const isAlongX = (yaw) => Math.abs(Math.sin(yaw)) > 0.5;

  // ── at a mount ──
  const outOf = (m) => [m.at[0] + m.out[0], m.at[2] + m.out[1]];
  function toMount(i, rel) {
    const m = M[i], Q = outOf(m), yaw = turnFor(m.yaw - (rel || 0));
    const arrive = upAndOver(Q[0], Q[1], yaw, P.t);
    // (its tray out as the crane comes, the patch under it kept clear from then until the tray is home again)
    const t0 = Math.max(P.t, T.tray[i].end), tT = seg(T.tray[i], Math.max(t0, arrive - S.tray), 1, S.tray, even);
    const g = gate(Math.max(t0, arrive - S.tray) - 0.6, (m.at[0] + Q[0]) / 2, (m.at[2] + Q[1]) / 2, isAlongX(m.yaw), Math.hypot(m.out[0], m.out[1]) / 2);
    return { m, at: Math.max(arrive, tT) + S.settle, g };
  }
  function fromMount(c, i) {
    const { m, at, g } = toMount(i, 0);
    let tt = move(T.hoist, at, m.at[1] + lift, S.hoist);
    tt = seg(T.latch, tt + 0.2, 1, S.latch); tt = seg(T.arms, tt, 1, S.arms) + 0.3;
    put(c, tt, { where: 'held', rel: near0(last(c).yaw - T.yaw.last) });
    P.t = tt;
    g.t1 = seg(T.tray[i], tt + 1.6, 0, S.tray, even) + 0.3; P.liftGate = g;
    return { g, i };
  }
  function ontoMount(c, i) {
    const rel = last(c).rel || 0, { m, at, g } = toMount(i, rel);
    let tt = move(T.hoist, at, m.at[1] + lift + 0.3, S.hoist); tt = move(T.hoist, tt, m.at[1] + lift, S.set);
    tt = seg(T.arms, tt + 0.2, 0, S.arms); tt = seg(T.latch, tt, 0, S.latch) + 0.2;
    put(c, tt, { where: 'mount', i, yaw: mountYaw(m, T.yaw.last + rel) });
    // (straight up, the tray home under it once the open arms are clear of the canister's crown)
    P.t = move(T.hoist, tt, site.carry, S.hoist);
    g.t1 = seg(T.tray[i], tt + 1.5, 0, S.tray, even) + 0.3;
  }
  // ── at a socket: the canister's middle when it is docked, and when it waits just clear of the mouth ──
  const docked = (k) => [K[k].at[0] + K[k].n[0] * (half - seat), K[k].at[2] + K[k].n[1] * (half - seat)];
  const waiting = (k) => [K[k].at[0] + K[k].n[0] * (half + clear), K[k].at[2] + K[k].n[1] * (half + clear)];
  const axisOf = (k) => Math.atan2(K[k].n[0], K[k].n[1]);
  function intoSocket(c, k) {
    const s = K[k], W = waiting(k), D = docked(k), alongX = Math.abs(s.n[0]) > 0.5;
    const arrive = upAndOver(W[0], W[1], turnFor(axisOf(k)), P.t);
    const tI = seg(T.iris[k], Math.max(P.t, arrive - S.iris - 1), 1, S.iris, 0.3);
    const at = Math.max(arrive, tI) + S.settle, g = gate(at - 0.6, (W[0] + D[0]) / 2, (W[1] + D[1]) / 2, alongX, 0, (seat + clear) / 2);
    let tt = move(T.hoist, at, s.at[1], S.hoist);
    tt = alongX ? move(T.x, tt + 0.2, D[0], S.push) : move(T.z, tt + 0.2, D[1], S.push);    // (pushed in end-on)
    // (seated: it is the socket's from now; the collar takes hold, its ring coming on; then it drains)
    put(c, tt, { where: 'socket', i: k, yaw: near0(T.yaw.last + (last(c).rel || 0)) }); docks.push({ t0: tt, t1: Infinity, k, c });
    tt = seg(T.lit[k], tt, 1, S.clamp);
    const f0 = cans[c].fill[cans[c].fill.length - 1].b;
    if (f0 > 0) cans[c].fill.push({ t0: tt + 1, t1: tt + 1 + S.drain * f0, a: f0, b: 0 });
    tt = seg(T.arms, tt + 0.3, 0, S.arms); tt = seg(T.latch, tt, 0, S.latch) + 0.2;
    // (the cradle up off it, back out from the wall, then all the way up)
    tt = move(T.hoist, tt, s.at[1] + rise, S.hoist);
    tt = alongX ? move(T.x, tt, W[0], S.trolley) : move(T.z, tt, W[1], S.trolley);
    P.t = g.t1 = move(T.hoist, tt, site.carry, S.hoist);
  }
  function outOfSocket(c, k) {
    const s = K[k], W = waiting(k), D = docked(k), alongX = Math.abs(s.n[0]) > 0.5;
    const arrive = upAndOver(W[0], W[1], turnFor(last(c).yaw), P.t);
    const at = arrive + S.settle, g = gate(at - 0.6, (W[0] + D[0]) / 2, (W[1] + D[1]) / 2, alongX, 0, (seat + clear) / 2);
    // (the open cradle down clear of the wall to just over the docked canister, in over it, and down onto it)
    let tt = move(T.hoist, at, s.at[1] + rise, S.hoist);
    tt = alongX ? move(T.x, tt, D[0], S.trolley) : move(T.z, tt, D[1], S.trolley);
    tt = move(T.hoist, tt + 0.1, s.at[1] + 0.25, S.hoist); tt = move(T.hoist, tt, s.at[1], S.set);
    tt = seg(T.latch, tt + 0.2, 1, S.latch); tt = seg(T.arms, tt, 1, S.arms);
    // (the cradle has it: the collar lets go, its ring going dark)
    tt += 0.2; put(c, tt, { where: 'held', rel: near0(last(c).yaw - T.yaw.last) }); docks.find((d) => d.k === k && d.t1 === Infinity).t1 = tt;
    tt = seg(T.lit[k], tt, 0, S.clamp);
    tt = alongX ? move(T.x, tt + 0.2, W[0], S.push) : move(T.z, tt + 0.2, W[1], S.push);    // (drawn out end-on)
    P.t = g.t1 = tt + 0.2; P.liftGate = g;
    seg(T.iris[k], tt + 0.6, 0, S.iris, 0.3);
  }
  // ── on the rack ──
  function toBay(j, rel) {
    const b = B[j], arrive = upAndOver(b.at[0], b.at[2], turnFor((B[j].yaw ?? 0) - (rel || 0)), P.t);
    const at = arrive + S.settle;
    return { b, at, g: gate(at - 0.6, b.at[0], b.at[2], false) };
  }
  function fromBay(c, j) {
    const { b, at, g } = toBay(j, 0);
    let tt = move(T.hoist, at, b.at[1], S.hoist);
    tt = seg(T.latch, tt + 0.2, 1, S.latch); tt = seg(T.arms, tt, 1, S.arms) + 0.3;
    put(c, tt, { where: 'held', rel: near0(last(c).yaw - T.yaw.last) });
    // (the patch is watched until the load is well up: it lifts as the next trip sets off)
    P.t = g.t1 = tt; P.liftGate = g;
  }
  function ontoBay(c, j) {
    const rel = last(c).rel || 0, { b, at, g } = toBay(j, rel);
    let tt = move(T.hoist, at, b.at[1] + 0.3, S.hoist); tt = move(T.hoist, tt, b.at[1], S.set);
    tt = seg(T.arms, tt + 0.2, 0, S.arms); tt = seg(T.latch, tt, 0, S.latch) + 0.2;
    put(c, tt, { where: 'bay', i: j, yaw: near0(T.yaw.last + rel) });
    P.t = g.t1 = move(T.hoist, tt, site.carry, S.hoist);
  }
  // ── the round's orders of things (what is in the way decides them) ──
  const idx = (n) => [...Array(n).keys()];
  const fromHome = (k) => Math.hypot(K[k].at[0] - site.home[0], K[k].at[2] - site.home[1]);
  const shipMid = M.length ? [M.reduce((q, m) => q + m.at[0], 0) / M.length, M.reduce((q, m) => q + m.at[2], 0) / M.length] : [0, 0];
  const nearFirst = (i) => (K[0] ? Math.hypot(M[i].at[0] - K[0].at[0], M[i].at[2] - K[0].at[2]) : 0);
  const ORDER = {
    upperFirst: idx(M.length).sort((a, b) => (M[b].upper - M[a].upper) || nearFirst(a) - nearFirst(b)),
    lowerFirst: idx(M.length).sort((a, b) => (M[a].upper - M[b].upper) || nearFirst(a) - nearFirst(b)),
    sockLower: idx(K.length).sort((a, b) => (K[a].upper - K[b].upper) || fromHome(a) - fromHome(b)),
    sockUpper: idx(K.length).sort((a, b) => (K[b].upper - K[a].upper) || fromHome(a) - fromHome(b)),
    bayNear: idx(B.length).sort((a, b) => Math.hypot(B[a].at[0] - shipMid[0], B[a].at[2] - shipMid[1]) - Math.hypot(B[b].at[0] - shipMid[0], B[b].at[2] - shipMid[1])),
  };
  // home, and done: the Miner ready to go out
  function finish() {
    P.t = upAndOver(site.home[0], site.home[1], turnFor(0), P.t) + S.settle;
    phases.push({ name: 'done', t0: P.t });
    phases.forEach((p, n) => { p.t1 = n + 1 < phases.length ? phases[n + 1].t0 : Infinity; });
    gates.sort((a, b) => a.t0 - b.t0); docks.sort((a, b) => a.t0 - b.t0);
    for (const d of docks) if (d.t1 === Infinity) throw new Error('crane plan: a canister was left in a socket');
  }
  Object.assign(P, { travel, upAndOver, fromMount, ontoMount, intoSocket, outOfSocket, fromBay, ontoBay, ORDER, idx, finish, docked, waiting });
  return P;
}

// the standard start of a round: the crane parked, the cradle up and open; the Miner's canisters full on its mounts,
// the rack's empty in its bays (state.bayYaw: how each lies; state.yaw: the cradle's turn)
export function startOf(site, state = {}) {
  const M = site.mounts, K = site.sockets, B = site.bays, bayYaw = state.bayYaw || B.map((b) => b.yaw ?? 0);
  return { x: site.home[0], z: site.home[1], yaw: state.yaw || 0, hoist: site.carry, arms: 0, latch: 0,
    tray: M.map(() => 0), iris: K.map(() => 0), lit: K.map(() => 0),
    cans: [...M.map((m, i) => ({ where: 'mount', i, yaw: m.yaw, fill: 1 })), ...B.map((b, j) => ({ where: 'bay', i: j, yaw: bayYaw[j], fill: 0 }))] };
}

export function planCycle(site, state = {}, speed = SPEED) {
  const P = makePlanner(site, startOf(site, state), speed), { S, M, B, phases, ORDER, idx } = P, nM = M.length;
  const { upperFirst, lowerFirst, sockLower, sockUpper, bayNear } = ORDER;
  const order = { unload: [], load: [], clear: [] }, inSocket = new Map(), onMount = new Map(), inBay = new Map();
  P.t = S.rest; phases.push({ name: 'unload', t0: 0 });
  upperFirst.forEach((i, n) => { const k = sockLower[n]; P.fromMount(i, i); P.intoSocket(i, k); inSocket.set(k, i); order.unload.push([i, k]); });
  phases.push({ name: 'load', t0: P.t });
  bayNear.forEach((j, n) => { const i = lowerFirst[n], c = nM + j; P.fromBay(c, j); P.ontoMount(c, i); onMount.set(i, c); order.load.push([j, i]); });
  phases.push({ name: 'clear', t0: P.t });
  sockUpper.forEach((k, n) => { const j = bayNear[n], c = inSocket.get(k); P.outOfSocket(c, k); P.ontoBay(c, j); inBay.set(j, c); order.clear.push([k, j]); });
  P.finish();
  // who is where when the round ends: the ship's canisters, the rack's, and how the rack's lie
  const next = { onMount: idx(nM).map((i) => onMount.get(i)), inBay: idx(B.length).map((j) => inBay.get(j)), bayYaw: idx(B.length).map((j) => near0(P.last(inBay.get(j)).yaw)), yaw: near0(P.T.yaw.last) };
  return { length: P.t, T: P.T, cans: P.cans, gates: P.gates, docks: P.docks, phases, order, next, site };
}

// THE ROUND TAKEN UP FROM WHEREVER THINGS ARE (after someone has driven the crane by hand, or worked it by the crane
// game's sums): `from` is a snapshot (stateAt's shape) with the cradle up (site.carry) and nothing half done (the arms
// and the latch open or shut; the trays home; an iris open and a collar holding only where a canister is docked).
// From there the crane does what the round would: whatever it holds goes where it belongs (ore in it: a free socket;
// empty: a free mount on the ship, else the rack), then the ship's full canisters to the wall, empties from the rack
// onto the ship, the drained ones from the wall to the rack; and when every mount holds an empty one and the wall is
// clear, home: done. What is in the way decides the order, as in the round: a lower mount or socket is only reached
// with the one above it empty, so a canister in the way is moved first.
export function planFrom(site, from, speed = SPEED) {
  const P = makePlanner(site, from, speed), { S, M, K, B, cans, phases, ORDER } = P;
  const at = (c) => P.last(c);
  const fillNow = (c) => { const f = cans[c].fill[cans[c].fill.length - 1]; return P.t >= f.t1 ? f.b : P.t <= f.t0 ? f.a : f.a + (f.b - f.a) * (P.t - f.t0) / (f.t1 - f.t0); };
  const ore = (c) => fillNow(c) > 1e-6;
  // who is where
  const onMount = M.map(() => -1), inSocket = K.map(() => -1), inBay = B.map(() => -1);
  let held = -1;
  cans.forEach((q, c) => { const a = at(c); if (a.where === 'mount') onMount[a.i] = c; else if (a.where === 'socket') inSocket[a.i] = c; else if (a.where === 'bay') inBay[a.i] = c; else held = c; });
  // the one over each (the same place, the upper row) and under each
  const twin = (list, i, up) => list.findIndex((q, j) => j !== i && !!q.upper === up && Math.abs(q.at[0] - list[i].at[0]) < 0.1 && Math.abs(q.at[2] - list[i].at[2]) < 0.1);
  const mOver = M.map((m, i) => (m.upper ? -1 : twin(M, i, true))), mUnder = M.map((m, i) => (m.upper ? twin(M, i, false) : -1));
  const kOver = K.map((s, k) => (s.upper ? -1 : twin(K, k, true))), kUnder = K.map((s, k) => (s.upper ? twin(K, k, false) : -1));
  // can the cradle get to it? (nothing on the one over it)
  const mReach = (i) => mOver[i] < 0 || onMount[mOver[i]] < 0, kReach = (k) => kOver[k] < 0 || inSocket[kOver[k]] < 0;
  // where to put one: a free socket (lower first, and an upper only over a filled lower, unless the lower cannot be had)
  const freeSocket = () => ORDER.sockLower.find((k) => inSocket[k] < 0 && kReach(k) && (kUnder[k] < 0 || inSocket[kUnder[k]] >= 0)) ?? ORDER.sockLower.find((k) => inSocket[k] < 0 && kReach(k));
  // ... a free mount to load (lower first; an upper only over a filled lower)
  const freeMount = () => ORDER.lowerFirst.find((i) => onMount[i] < 0 && mReach(i) && (mUnder[i] < 0 || onMount[mUnder[i]] >= 0));
  const freeBay = () => ORDER.bayNear.find((j) => inBay[j] < 0);
  const fullOnShip = () => ORDER.upperFirst.filter((i) => onMount[i] >= 0 && ore(onMount[i]));
  const phase = (name) => { if (!phases.length || phases[phases.length - 1].name !== name) phases.push({ name, t0: P.t }); };
  const order = { unload: [], load: [], clear: [] };
  // putting down what it holds
  let cameFrom = -1;   // (the socket the held canister was just drawn out of: it does not wait there again)
  function putAway() {
    const c = held;
    const toMount = (i) => { P.ontoMount(c, i); onMount[i] = c; held = -1; }, toSocket = (k) => { P.intoSocket(c, k); inSocket[k] = c; held = -1; };
    if (ore(c)) {
      const k = freeSocket();
      if (k != null) return toSocket(k);
    } else if (!fullOnShip().length) {
      const i = freeMount();
      if (i != null) return toMount(i);
    }
    // (nowhere better for now: the rack; an empty one on the ship where it is in nobody's way (not over a canister
    // with ore in it); with those full, an empty one waits in a free socket, where it is cleared from later like a
    // drained one; else any free mount)
    const j = freeBay();
    if (j != null) { P.ontoBay(c, j); inBay[j] = c; held = -1; return; }
    if (!ore(c)) {
      const i = ORDER.lowerFirst.find((q) => onMount[q] < 0 && mReach(q) && (mUnder[q] < 0 || (onMount[mUnder[q]] >= 0 && !ore(onMount[mUnder[q]]))));
      if (i != null) return toMount(i);
      const k = ORDER.sockLower.find((q) => q !== cameFrom && inSocket[q] < 0 && kReach(q));
      if (k != null) return toSocket(k);
    }
    const i = ORDER.lowerFirst.find((q) => onMount[q] < 0 && mReach(q));
    if (i != null) return toMount(i);
    throw new Error('crane plan: nowhere to put down canister ' + c);
  }
  const take = { mount: (i) => { const c = onMount[i]; P.fromMount(c, i); onMount[i] = -1; held = c; cameFrom = -1; }, socket: (k) => { const c = inSocket[k]; P.outOfSocket(c, k); inSocket[k] = -1; held = c; cameFrom = k; }, bay: (j) => { const c = inBay[j]; P.fromBay(c, j); inBay[j] = -1; held = c; cameFrom = -1; } };
  if (held >= 0) phase(ore(held) ? 'unload' : 'load');
  for (let guard = 0; ; guard++) {
    if (guard > 400) throw new Error('crane plan: the round from here does not end (' + JSON.stringify({ onMount, inSocket, inBay, held, full: cans.map((_, c) => +fillNow(c).toFixed(2)) }) + ')');
    if (held >= 0) { putAway(); continue; }
    // 1. the ore to the wall: full canisters off the ship (one in the way first) and off the rack
    const fullShip = fullOnShip();
    if (fullShip.length && freeSocket() != null) {
      const i = fullShip.find(mReach);
      if (i != null) { phase('unload'); order.unload.push(i); take.mount(i); continue; }
      // (a full one under an empty one: the empty one goes to the rack first, or waits in a free socket)
      const over = fullShip.map((q) => mOver[q]).find((u) => u >= 0 && onMount[u] >= 0);
      if (over != null) { phase('unload'); take.mount(over); continue; }
    }
    const fullBay = ORDER.bayNear.find((j) => inBay[j] >= 0 && ore(inBay[j]));
    if (fullBay != null && freeSocket() != null) { phase('unload'); take.bay(fullBay); continue; }
    // 2. empties onto the ship, once no ore is left on it
    if (!fullShip.length) {
      const i = freeMount();
      if (i != null) {
        const j = ORDER.bayNear.find((q) => inBay[q] >= 0 && !ore(inBay[q]));
        if (j != null) { phase('load'); order.load.push([j, i]); take.bay(j); continue; }
        const k = ORDER.sockUpper.find((q) => inSocket[q] >= 0 && kReach(q) && !ore(inSocket[q]));
        if (k != null) { phase('load'); take.socket(k); continue; }
      }
      // (a free lower mount under a filled upper one: the upper one's canister down onto the lower first)
      const blocked = ORDER.lowerFirst.find((q) => onMount[q] < 0 && !mReach(q));
      if (blocked != null && i == null) { phase('load'); take.mount(mOver[blocked]); continue; }
    }
    // 3. the drained ones from the wall (upper ones first)
    const k = ORDER.sockUpper.find((q) => inSocket[q] >= 0 && kReach(q) && !ore(inSocket[q]));
    if (k != null) { phase('clear'); order.clear.push(k); take.socket(k); continue; }
    // ... or wait for one still draining
    const ends = inSocket.filter((c) => c >= 0).map((c) => cans[c].fill[cans[c].fill.length - 1].t1).filter((t1) => t1 > P.t - 1e-9);
    if (ends.length) { P.t = Math.max(P.t, Math.min(...ends) + S.settle); continue; }
    // 4. done: every mount filled, nothing at the wall, no ore anywhere
    if (onMount.every((c) => c >= 0) && !fullOnShip().length) break;
    // (fewer canisters than mounts, or a canister still full on the rack with the wall full: nothing more can be done)
    if (inSocket.every((c) => c < 0) && !inBay.some((c) => c >= 0 && !ore(c))) break;
    throw new Error('crane plan: nothing more it can do, and the round is not done (' + JSON.stringify({ onMount, inSocket, inBay }) + ')');
  }
  if (!phases.length) phases.push({ name: 'clear', t0: 0 });
  phases[0].t0 = 0;
  P.finish();
  const next = { onMount: [...onMount], inBay: [...inBay], bayYaw: inBay.map((c) => (c >= 0 ? near0(P.last(c).yaw) : 0)), yaw: near0(P.T.yaw.last) };
  return { length: P.t, T: P.T, cans, gates: P.gates, docks: P.docks, phases, order, next, site, from: true };
}

// where canister c is at time t, and how full
export function canAt(plan, c, t) { return lastAt(plan.cans[c].spans, t); }
export function fillAt(plan, c, t) { const f = lastAt(plan.cans[c].fill, t); return t >= f.t1 ? f.b : t <= f.t0 ? f.a : f.a + (f.b - f.a) * (t - f.t0) / (f.t1 - f.t0); }
// EVERYTHING AT TIME t, as plain numbers: the shape kit/crane.js poses from, the crane by hand starts from
// (kit/crane-drive.js), and planFrom takes up again. A held canister's yaw is the cradle's and its own turn (rel).
// `into`: an object to fill in again (a frame's worth of nothing new)
export function stateAt(plan, t, into = null) {
  const T = plan.T, v = (tr) => valueAt(tr, t), S = into || { tray: [], iris: [], lit: [], cans: [] };
  S.x = v(T.x); S.z = v(T.z); S.yaw = v(T.yaw); S.hoist = v(T.hoist); S.arms = v(T.arms); S.latch = v(T.latch);
  T.tray.forEach((tr, i) => { S.tray[i] = v(tr); }); T.iris.forEach((tr, k) => { S.iris[k] = v(tr); }); T.lit.forEach((tr, k) => { S.lit[k] = v(tr); });
  plan.cans.forEach((_, c) => {
    const a = canAt(plan, c, t), q = S.cans[c] || (S.cans[c] = {});
    q.where = a.where; q.i = a.i; q.rel = a.rel; q.yaw = a.where === 'held' ? S.yaw + a.rel : a.yaw; q.fill = fillAt(plan, c, t);
  });
  return S;
}
// THE NEXT MOMENT NOTHING IS HALF DONE, from t (within `ahead` seconds), or null: the arms and the latch shut on a held
// canister or open with none, every tray, iris and collar still (out or home, open or shut). Someone taking the
// controls takes them then.
export function cleanAt(plan, t, ahead = 40, step = 0.05) {
  const T = plan.T, still = (tr, u) => { const x = valueAt(tr, u); return Math.abs(x) < 1e-6 || Math.abs(x - 1) < 1e-6; };
  for (let u = t; u <= Math.min(plan.length, t + ahead) + 1e-9; u += step) {
    if (!still(T.arms, u) || !still(T.latch, u) || T.tray.some((tr) => !still(tr, u)) || T.iris.some((tr) => !still(tr, u)) || T.lit.some((tr) => !still(tr, u))) continue;
    const held = plan.cans.some((_, c) => canAt(plan, c, u).where === 'held'), grip = valueAt(T.arms, u) > 0.5 && valueAt(T.latch, u) > 0.5, open = valueAt(T.arms, u) < 0.5 && valueAt(T.latch, u) < 0.5;
    if (held ? !grip : !open) continue;
    return Math.min(u, plan.length);
  }
  return null;
}
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
// HOW LONG THE LOAD STAYS AS IT IS: for each of the pay slip's counts, the seconds (up to `ahead`, looked at every
// `step`) before the timetable changes it, so the job can ask about a number that is still true when it is answered
export function steadyAt(plan, t, ahead = 60, step = 5) {
  const counts = (L) => ({ onShip: L.onShip, fullOnShip: L.fullOnShip, docked: L.docked.length, drained: L.drained, onRack: L.onRack });
  const now = counts(loadAt(plan, t)), out = {};
  for (const k in now) out[k] = ahead;
  for (let s = step; s <= ahead; s += step) {
    const then = counts(loadAt(plan, Math.min(plan.length, t + s)));
    for (const k in now) if (out[k] === ahead && then[k] !== now[k]) out[k] = s - step;
  }
  return out;
}
