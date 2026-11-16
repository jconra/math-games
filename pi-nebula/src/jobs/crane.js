// THE CRANE OPERATOR JOB, at the operator's chair: the smelter's crane worked by sums, for credits. The game's maker,
// 2026-11-16: "I suppose it could just be an optional job that asked questions to help calculate crane movements" and
// "if they want to make credits then math will be involved. So they have 2 options pop up. Each when they look at the
// sides of the operator area. Free control or crane operator job." This is the second option (the first, free
// control with no sums, is src/cranedrive.js; FREE below is its place among the jobs).
//
// THE ANSWERS ARE THE MOVES. The crane does one canister's trip at a time, the round's own trips (the ship's full
// canisters to the wall, empties from the rack onto the ship, the drained ones back to the rack: planned here by
// tripFrom). Each trip is a list of moves; at each level some of them are asked (how far along the rail, how far
// down, how long at this speed ...) and the rest the crane does by itself. A right answer and the crane makes that
// move, by exactly the answer (src/jobs/cranelink.js works the live crane, kit/crane-drive.js); a wrong one, and a
// faint path shows where that answer would have taken it, and Help glows. The numbers are read from the hangar:
// the rail's metre marks (the wall rail from its west end, the ship rail from the turntable), the hook's height on
// the chair's screens, the rated load on the crane's plate, the canisters' weights (the pay slips' load: one weight
// for the crane's whole round). Before an asked move the crane lines itself up on the level's marks (a whole metre,
// a tenth), and after it, onto the place itself: so "18 m to 6 m" is exactly 12 m.
//
// The ladder, easiest first (Mathwood's school guide in brackets): counting the canisters to move and the metre hops
// (0); counting along the rail (6); reading the rail's marks (10); distances along the rail (18); the hook up and
// down (24); up and down as plus and minus (34: Mathwood's own negatives card, src/math/negatives.js makeCard, on
// the hook's real move); time from speed (40); tenths along the rail and up and down (48); time from speed in halves
// and tenths (52); weights against the crane's limit (56); how many trips (60: and Mathwood's whole-crates word
// problems told through SETTING); routes along and across (70); route times (78).
// Mathwood's makers tell what they fit (the trips in whole canisters, the plus and minus); the moves are this job's
// own makers (MAKERS), written the way Mathwood's are: the wrong answers are the slips kids really make, each with
// one plain line why.
//
//   tripFrom(site, P, rand)   the next trip from a planned state: { name, story, c, steps } (P changed to its end)
//   the makers read `live` (src/jobs/cranelink.js now()): live.ask(kind, opts) reserves the next move of a kind and
//   gives its numbers; without it (node, the levels page) a maker's numbers are its own ("from the log")
import { dec } from '../../../mathwood-valley/src/math/counterkit.js';
import { makeCard, classify as signSlip } from '../../../mathwood-valley/src/math/negatives.js';
import { ownOrder } from './engine.js';
import { DRIVE } from '../../kit/crane-drive.js';

const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
const METRE = ['metre', 'metres'], SEC = ['second', 'seconds'], TONNE = ['tonne', 'tonnes'], TRIP = ['trip', 'trips'], CAN = ['canister', 'canisters'];
export const RATED = DRIVE.rated;     // tonnes: the crane's plate (kit/crane-drive.js, kit/smelter.js PLATE)
export const EMPTY = DRIVE.canister;  // tonnes: an empty canister
export const CHANGE_AT = 1000;   // (a plus-or-minus answer's button value: the change plus this, so it is above zero)
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
const t1 = (x) => dec(Math.round(x * 10), 1, { trim: true });          // 6.6 -> "6.6", 12 -> "12"
const kit = (rand) => ({ int: (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)), pick: (a) => a[Math.floor(rand() * a.length)], chance: (p) => rand() < p });
// a face for an answer button: the number big (as the level reads it), its unit small
const t2 = (x) => dec(Math.round(x * 100), 2, { trim: true });   // 13.95 -> "13.95", 12 -> "12"
const F = (v, unit, { sign = false } = {}) => { const n = r2(v), big = (sign && n > 0 ? '+' : '') + (n < 0 ? '−' : '') + t2(Math.abs(n)); return { v: n, big, small: Math.abs(n) === 1 ? unit[0] : unit[1], label: `${big} ${Math.abs(n) === 1 ? unit[0] : unit[1]}` }; };

// ── the places, in words, and on the rail's marks ────────────────────────────────────────────────────────────────
// (the wall rail's marks from its west end; the ship rail's from the turntable)
export function marksOf(site) {
  const w0 = site.rail.wall[0], z0 = site.turn[1];
  return { wall: (x) => x - w0, ship: (z) => z - z0, turn: site.turn[0] - w0 };
}
const sockName = (site, k) => { const K = site.sockets, cols = [...new Set(K.map((s) => s.at[0].toFixed(2)))].sort((a, b) => a - b); return `socket ${cols.indexOf(K[k].at[0].toFixed(2)) * 2 + (K[k].upper ? 2 : 1)}`; };
const bayName = (j) => `bay ${j + 1} of the rack`;
// a place on the Miner in words: top or bottom; the ship's end (the wall's end, toward the turntable, or the far end:
// each end's trays slide out toward it); and its side, the rack's or the sockets' (the eight places are all different)
const sideOf = (site, x) => { const rack = site.bays.length ? site.bays.reduce((q, b) => q + b.at[0], 0) / site.bays.length : site.shipX + 1; return (x - site.shipX) * (rack - site.shipX) > 0 ? 'the rack\'s' : 'the sockets\''; };
export const mountName = (site, i, noun = 'canister') => { const m = site.mounts[i]; return `the ${m.upper ? 'top' : 'bottom'} ${noun} on ${sideOf(site, m.at[0])} side at the ship's ${m.out[1] < 0 ? 'wall' : 'far'} end`; };

// ── the trips: what the round would do next, as moves ────────────────────────────────────────────────────────────
// P: { x, z, yaw, slide, hoist, held, cans: [{ where, i, fill }] } (a planned state: where things will be once the
// moves already given are done). A step: { kind: 'along' | 'slide' | 'hoist' | 'push' | 'turn' | 'grab' | 'wait' |
// 'trip', ... }; 'along' moves the trolley on its leg, 'push' the carriage into or out of a socket (slowly).
export function tripFrom(site, P, rand = Math.random) {
  const M = site.mounts, K = site.sockets, B = site.bays, half = site.can.half, lift = site.can.lift || 0, seat = site.can.seat, clear = site.can.clear, rise = site.can.rise;
  const steps = [], leg = () => (Math.abs(Math.sin(P.yaw)) > 0.5 ? 'ship' : 'wall'), W = marksOf(site);
  const who = (where, i) => P.cans.findIndex((q) => q.where === where && q.i === i);
  const ore = (c) => P.cans[c].fill > 1e-6;
  const over = (list, i) => list.findIndex((q, j) => j !== i && q.upper && !list[i].upper && Math.abs(q.at[0] - list[i].at[0]) < 0.1 && Math.abs(q.at[2] - list[i].at[2]) < 0.1);
  const under = (list, i) => list.findIndex((q, j) => j !== i && !q.upper && list[i].upper && Math.abs(q.at[0] - list[i].at[0]) < 0.1 && Math.abs(q.at[2] - list[i].at[2]) < 0.1);
  const mReach = (i) => { const o = over(M, i); return o < 0 || who('mount', o) < 0; }, kReach = (k) => { const o = over(K, k); return o < 0 || who('socket', o) < 0; };
  // moves, each from where the last left it
  const along = (to, what) => { const lg = leg(), from = lg === 'wall' ? P.x : P.z; if (Math.abs(to - from) < 1e-6) return; steps.push({ kind: 'along', leg: lg, from, to, mark: lg === 'wall' ? W.wall(from) : W.ship(from), markTo: lg === 'wall' ? W.wall(to) : W.ship(to), what }); if (lg === 'wall') P.x = to; else P.z = to; };
  // (where the hook is when a move up, down or across starts: [x, z, the beam's heading, height], for the faint path of
  // a wrong answer about a move still ahead of the crane)
  const hookAt = () => [P.x + Math.sin(P.yaw) * P.slide, P.z + Math.cos(P.yaw) * P.slide, P.yaw, P.hoist];
  const slide = (to, what, push = false) => { if (Math.abs(to - P.slide) < 1e-6) return; steps.push({ kind: push ? 'push' : 'slide', from: P.slide, to, what, at: hookAt() }); P.slide = to; };
  const hoist = (to, what) => { if (Math.abs(to - P.hoist) < 1e-6) return; steps.push({ kind: 'hoist', from: P.hoist, to, what, carrying: P.held >= 0, at: hookAt() }); P.hoist = to; };
  const up = () => { hoist(site.carry, 'the top'); slide(0, 'the beam\'s middle'); };
  const toLeg = (lg) => {
    if (leg() === lg) return;
    up(); along(leg() === 'wall' ? site.turn[0] : site.turn[1], 'the turntable');   // (the turntable on the leg it is on now)
    steps.push({ kind: 'turn', to: lg }); P.yaw += lg === 'ship' ? Math.PI / 2 : -Math.PI / 2;
    if (lg === 'ship') P.z = site.turn[1]; else P.x = site.turn[0];
  };
  const slideFor = (x, z) => (x - P.x) * Math.sin(P.yaw) + (z - P.z) * Math.cos(P.yaw);
  const grab = (how, what, c) => { steps.push({ kind: 'grab', how, what, c, fill: c >= 0 ? P.cans[c].fill : 0 }); };
  // ── the moves at each kind of place ──
  function takeFromMount(i) {
    const m = M[i], o = [m.at[0] + m.out[0], m.at[2] + m.out[1]], c = who('mount', i), what = mountName(site, i);
    toLeg('ship'); up(); along(o[1], what); slide(slideFor(o[0], o[1]), `${sideOf(site, o[0])} side of the ship`);
    steps.push({ kind: 'wait', for: 'tray', i });
    hoist(m.at[1] + lift, what); grab('shut', what, c); P.held = c; P.cans[c].where = 'held';
    up();
  }
  function putOnMount(i) {
    const m = M[i], o = [m.at[0] + m.out[0], m.at[2] + m.out[1]], c = P.held, what = mountName(site, i, 'mount');
    toLeg('ship'); up(); along(o[1], what); slide(slideFor(o[0], o[1]), `${sideOf(site, o[0])} side of the ship`);
    steps.push({ kind: 'wait', for: 'tray', i });
    hoist(m.at[1] + lift, what); grab('open', what, c); P.cans[c].where = 'mount'; P.cans[c].i = i; P.held = -1;
    up();
  }
  function takeFromBay(j) {
    const b = B[j], c = who('bay', j);
    toLeg('wall'); up(); along(b.at[0], bayName(j)); slide(slideFor(b.at[0], b.at[2]), bayName(j));
    hoist(b.at[1], `the canister in ${bayName(j)}`); grab('shut', `the canister in ${bayName(j)}`, c); P.held = c; P.cans[c].where = 'held';
    up();
  }
  function putInBay(j) {
    const b = B[j], c = P.held;
    toLeg('wall'); up(); along(b.at[0], bayName(j)); slide(slideFor(b.at[0], b.at[2]), bayName(j));
    hoist(b.at[1], bayName(j)); grab('open', bayName(j), c); P.cans[c].where = 'bay'; P.cans[c].i = j; P.held = -1;
    up();
  }
  function putInSocket(k) {
    const s = K[k], c = P.held, n = s.n, what = sockName(site, k);
    const Wt = [s.at[0] + n[0] * (half + clear), s.at[2] + n[1] * (half + clear)], Dk = [s.at[0] + n[0] * (half - seat), s.at[2] + n[1] * (half - seat)];
    toLeg('wall'); up(); along(Wt[0], what); slide(slideFor(Wt[0], Wt[1]), `in front of ${what}`);
    hoist(s.at[1], what); steps.push({ kind: 'wait', for: 'iris', k });
    slide(slideFor(Dk[0], Dk[1]), what, true); steps.push({ kind: 'wait', for: 'dogs', k });
    grab('open', what, c); P.cans[c].where = 'socket'; P.cans[c].i = k; P.held = -1;
    P.cans[c].fill = 0;   // (drained by the time the crane comes back for it: the live crane waits for it if not)
    hoist(s.at[1] + rise, `just over the canister in ${what}`); slide(slideFor(Wt[0], Wt[1]), `in front of ${what}`);
    up();
  }
  function takeFromSocket(k) {
    const s = K[k], c = who('socket', k), n = s.n, what = sockName(site, k);
    const Wt = [s.at[0] + n[0] * (half + clear), s.at[2] + n[1] * (half + clear)], Dk = [s.at[0] + n[0] * (half - seat), s.at[2] + n[1] * (half - seat)];
    toLeg('wall'); up(); along(Wt[0], what); slide(slideFor(Wt[0], Wt[1]), `in front of ${what}`);
    steps.push({ kind: 'wait', for: 'drained', c });
    hoist(s.at[1] + rise, `just over the canister in ${what}`); slide(slideFor(Dk[0], Dk[1]), `over the canister in ${what}`);
    hoist(s.at[1], `the canister in ${what}`); grab('shut', `the canister in ${what}`, c);
    steps.push({ kind: 'wait', for: 'held', c }); P.held = c; P.cans[c].where = 'held';
    slide(slideFor(Wt[0], Wt[1]), `out of ${what}`, true);
    up();
  }
  // ── which trip (the round's order of things: kit/crane-plan.js planFrom's, one trip at a time) ──
  const onShipFull = M.map((_, i) => i).filter((i) => who('mount', i) >= 0 && ore(who('mount', i))).sort((a, b) => M[b].upper - M[a].upper);
  const freeSock = K.map((_, k) => k).filter((k) => who('socket', k) < 0 && kReach(k)).sort((a, b) => (K[a].upper - K[b].upper) || Math.abs(K[a].at[0] - site.turn[0]) - Math.abs(K[b].at[0] - site.turn[0]));
  const goodSock = freeSock.filter((k) => !K[k].upper || who('socket', under(K, k)) >= 0);
  const freeMount = M.map((_, i) => i).filter((i) => who('mount', i) < 0 && mReach(i) && (!M[i].upper || who('mount', under(M, i)) >= 0)).sort((a, b) => M[a].upper - M[b].upper);
  const freeBay = B.map((_, j) => j).filter((j) => who('bay', j) < 0).sort((a, b) => Math.abs(B[a].at[0] - site.turn[0]) - Math.abs(B[b].at[0] - site.turn[0]));
  const bayEmpty = B.map((_, j) => j).filter((j) => who('bay', j) >= 0 && !ore(who('bay', j))).sort((a, b) => Math.abs(B[a].at[0] - site.turn[0]) - Math.abs(B[b].at[0] - site.turn[0]));
  const drained = K.map((_, k) => k).filter((k) => who('socket', k) >= 0 && !ore(who('socket', k)) && kReach(k)).sort((a, b) => K[b].upper - K[a].upper);
  let name, story, c = -1, count = 0, from = null, to = null;
  if (P.held >= 0) {
    c = P.held;
    if (ore(c) && (goodSock[0] ?? freeSock[0]) != null) { const k = goodSock[0] ?? freeSock[0]; name = 'unload'; story = `Take the canister in the grab to ${sockName(site, k)}.`; putInSocket(k); to = sockName(site, k); }
    else if (!ore(c) && freeMount.length && !onShipFull.length) { const i = freeMount[0]; name = 'load'; story = 'Put the empty canister in the grab onto the ship.'; putOnMount(i); }
    else if (freeBay.length) { name = 'clear'; story = 'Put the canister in the grab on the rack.'; putInBay(freeBay[0]); }
    else return null;
  } else if (onShipFull.length && (goodSock[0] ?? freeSock[0]) != null && onShipFull.some(mReach)) {
    const i = onShipFull.find(mReach), k = goodSock[0] ?? freeSock[0];
    c = who('mount', i); count = onShipFull.length; name = 'unload'; from = mountName(site, i); to = sockName(site, k);
    story = `Take ${from} to ${to}.`;
    steps.push({ kind: 'trip', name, count, what: 'full canisters on the Miner' });
    takeFromMount(i); putInSocket(k);
  } else if (!onShipFull.length && freeMount.length && bayEmpty.length) {
    const j = bayEmpty[0], i = freeMount[0];
    c = who('bay', j); count = freeMount.length; name = 'load'; from = bayName(j);
    story = `Take the empty canister in ${from} onto the ship.`;
    steps.push({ kind: 'trip', name, count, what: 'free mounts on the Miner' });
    takeFromBay(j); putOnMount(i);
  } else if (drained.length && freeBay.length) {
    const k = drained[0], j = freeBay[0];
    c = who('socket', k); count = K.filter((_, q) => who('socket', q) >= 0).length; name = 'clear'; from = sockName(site, k); to = bayName(j);
    story = `Take the drained canister in ${from} back to ${to}.`;
    steps.push({ kind: 'trip', name, count, what: 'canisters at the wall' });
    takeFromSocket(k); putInBay(j);
  } else return null;
  return { name, story, c, count, from, to, steps };
}

// ── the setting for Mathwood's makers (the whole-crates word problems: canisters and trips) ──────────────────────
const FOLK = [{ name: 'Crane Hand Pia', she: true }, { name: 'Dock Chief Ibarra', she: false }, { name: 'Miner Kestrel', she: true }, { name: 'Engineer Okafor', she: false }];
export const SETTING = {
  folk: FOLK,
  things: [{ key: 'canisters', unit: CAN, shape: 'can' }],
  share: [
    { key: 'ore', thing: TONNE, box: CAN, story: ({ total, groups, f }) => `${f.name} has ${total} tonnes of ore to send to the smelter, shared evenly into ${groups} canisters.`, ask: 'How many tonnes go in each canister?' },
  ],
  crates: [
    { key: 'trips', box: TRIP, story: ({ total, per, f }) => `${f.name} has ${total} tonnes of ore for the smelter. A canister holds ${per} tonnes, and the crane takes one canister a trip.`, ask: 'How many trips will the crane make so all the ore gets to the wall?' },
    { key: 'racks', box: ['rack', 'racks'], story: ({ total, per }) => `${total} empty canisters are coming in. A rack holds ${per} canisters.`, ask: 'How many racks are needed so every canister has a bay?' },
  ],
};

// ── the makers ───────────────────────────────────────────────────────────────────────────────────────────────────
// each: { strand, at(step), make(step, { rand, live }) }. live.ask(kind, opts) -> the next move of that kind, its
// numbers already on the level's marks, reserved for this question (src/jobs/cranelink.js), or null
const fromLive = (live, kind, opts) => (live && live.ask ? live.ask(kind, opts) : null);
// a move along the rail invented for a question from the log: a start and an end on the level's marks
function madeAlong(t, prec, most = 26) {
  const step = prec, n = Math.round(most / step);
  for (let k = 0; k < 40; k++) { const a = t.int(0, n) * step, b = t.int(0, n) * step; if (Math.abs(a - b) >= Math.max(1, step * 3) && Math.abs(a - b) <= most) return { leg: 'wall', mark: r2(a), markTo: r2(b), what: t.pick(LOG_STOPS), from: null, to: null }; }
  return { leg: 'wall', mark: 18, markTo: 6, what: 'the next stop' };
}
const railWords = (s) => (s.leg === 'wall' ? 'the wall rail' : 'the ship rail');
// (a question from the log names no real place: its marks are made up)
const LOG_STOPS = ['the next stop', 'a canister waiting there', 'the stop on the work order'];
const rowsOfMove = (s, said) => [[s.leg === 'wall' ? 'Wall rail' : 'Ship rail', `at the ${t1(s.mark)} m mark`], ['To', `${s.what}, the ${t1(s.markTo)} m mark`], [said, '?']];

export const MAKERS = {
  // ── counting the canisters to move: a trip's start (the canisters drawn as they are) ──
  // step 1  up to 5; step 2  up to 8 (8 came in: how many still to move)
  count: {
    strand: 'number', at: (step) => (step <= 1 ? 0 : 6),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), most = step <= 1 ? 5 : 8, s = fromLive(live, 'trip', { most });
      const n = s ? s.count : t.int(step <= 1 ? 1 : 2, most), what = s ? s.what : 'full canisters on the Miner';
      const ASK = s ? { 'full canisters on the Miner': 'How many full canisters are still on the Miner?', 'free mounts on the Miner': 'How many mounts on the Miner are empty?', 'canisters at the wall': 'How many canisters are plugged in at the wall?' }
        : { 'full canisters on the Miner': 'How many full canisters are on the work order?' };   // (made up: not the Miner outside)
      const look = s && s.name === 'clear' ? 'empty' : s && s.name === 'load' ? 'none' : 'full';
      const slots = Array(n).fill(look === 'none' ? 'none' : look);
      return ownOrder({
        key: `count:${s ? s.name : 'log'}`, story: s ? `Work order: ${s.story}` : 'A work order from the log.', ask: ASK[what] || `How many ${what}?`,
        right: F(n, CAN), slips: [{ ...F(n + 1, CAN), why: 'One too many. Touch each one once as you count.' }, { ...F(n - 1, CAN), why: 'One short. Touch each one once as you count.' }, { ...F(n + 2, CAN), why: 'Too many. Count again, one at a time.' }],
        rightWhy: `${u(n, CAN)}: the crane sets off with the first`,
        picFirst: true, help: { title: 'Count them', pic: { kind: 'cans', place: look === 'none' ? 'ship' : look === 'empty' ? 'wall' : 'ship', slots }, line: 'Touch each one once as you count: 1, 2, 3 ...' },
        own: { strand: 'number', at: step <= 1 ? 0 : 6 }, facts: { kind: 'count', step: s && s.id, n, live: !!s },
      }, rand, 3);
    },
  },
  // ── the metre hops along the rail (counting) ──
  // step 1  up to 5 hops; step 2  up to 10
  hops: {
    strand: 'number', at: (step) => (step <= 1 ? 2 : 8),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), most = step <= 1 ? 5 : 10, s = fromLive(live, 'along', { prec: 1, most }) || (() => { const n = t.int(2, most), a = t.int(n, 26); return { leg: 'wall', mark: a, markTo: a - n, what: t.pick(LOG_STOPS) }; })();
      const n = Math.round(Math.abs(s.markTo - s.mark)), dir = s.markTo > s.mark ? 1 : -1;
      return ownOrder({
        key: 'hops', story: `The trolley must go along ${railWords(s)} to ${s.what}.`, ask: 'How many metres is that? Count the hops.',
        right: F(n, METRE), slips: [{ ...F(n + 1, METRE), why: 'That counts the marks, not the hops between them. Count the hops.' }, { ...F(n - 1, METRE), why: 'One short: count every hop, the last one too.' }, { ...F(n + 2, METRE), why: 'Too many. Count each hop once.' }],
        rightWhy: `${u(n, METRE)}: the trolley goes ${n} hops`,
        picFirst: true, help: { title: 'Count the hops', pic: { kind: 'rail', from: s.mark, to: s.markTo, hops: true, what: s.what, leg: s.leg }, line: 'Each hop is one metre, from one mark to the next. Count the hops from the trolley to the place.' },
        own: { strand: 'number', at: step <= 1 ? 2 : 8 }, facts: { kind: 'along', step: s.id, n, dir, live: s.id != null },
      }, rand, 3);
    },
  },
  // ── reading the rail's metre marks ──
  mark: {
    strand: 'number', at: () => 10,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'along', { prec: 1, most: 26, near: 0.45, least: 2 }) || (() => { const m0 = t.int(2, 26); let h = t.int(0, 27); while (Math.abs(h - m0) < 3) h = t.int(0, 27); return { leg: 'wall', mark: h, markTo: m0, what: t.pick(LOG_STOPS) }; })();
      const m = Math.round(s.markTo), here = Math.round(s.mark);
      const flip = m >= 10 && m % 10 !== Math.floor(m / 10) % 10 ? Number(String(m).split('').reverse().join('')) : null;
      return ownOrder({
        key: 'mark', story: `The trolley is on ${railWords(s)}, going to ${s.what}. The crane stops on a metre mark, then lines itself up.`, ask: `Which mark is ${s.what} nearest to?`,
        right: { v: m, big: String(m), small: 'm mark', label: `the ${m} m mark` },
        slips: [{ v: m + 1, big: String(m + 1), small: 'm mark', label: `the ${m + 1} m mark`, why: 'One mark too far. Find the place, then read the number on the mark above it.' },
          { v: m - 1, big: String(m - 1), small: 'm mark', label: `the ${m - 1} m mark`, why: 'One mark short. Read the number on the mark right above the place.' },
          ...(here !== m && here > 0 ? [{ v: here, big: String(here), small: 'm mark', label: `the ${here} m mark`, why: `${here} is the mark the trolley is at now. Find the mark over ${s.what}.` }] : []),
          ...(flip != null && flip !== m && flip <= 27 ? [{ v: flip, big: String(flip), small: 'm mark', label: `the ${flip} m mark`, why: `The digits are the other way round: it is ${m}.` }] : []),
          { v: m + 2, big: String(m + 2), small: 'm mark', label: `the ${m + 2} m mark`, why: 'Two marks too far. Read the number on the mark right above the place.' }].filter((x) => x.v > 0),
        rightWhy: `${cap(s.what)} is nearest the ${m} m mark`,
        picFirst: true, help: { title: 'Read the marks', pic: { kind: 'rail', from: s.mark, to: s.markTo, read: true, what: s.what, leg: s.leg }, line: 'The numbers count the metres from the start of the rail. Find the place, then read the mark above it.' },
        own: { strand: 'number', at: 10 }, facts: { kind: 'along', step: s.id, to: m, live: s.id != null },
      }, rand);
    },
  },
  // ── distances along the rail ──
  // step 1  whole metres (18 m mark to 6 m mark); step 2  tenths (18 to 11.4)
  rail: {
    strand: 'words', at: (step) => (step <= 1 ? 18 : 48),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), prec = step <= 1 ? 1 : 0.1, s = fromLive(live, 'along', { prec, most: 27, least: prec === 1 ? 2 : 0.5 }) || madeAlong(t, prec);
      const a = s.mark, b = s.markTo, d = r2(Math.abs(b - a)), sum = r2(a + b);
      const pt = prec < 1 && Math.round(d * 10) % 10 !== 0;
      return ownOrder({
        key: `rail:${step}`, story: `The trolley is at the ${t1(a)} m mark on ${railWords(s)}. ${cap(s.what)} is at the ${t1(b)} m mark.`, ask: 'How many metres must the trolley go?',
        right: F(d, METRE),
        slips: [{ ...F(sum, METRE), why: `That adds the two marks. The way between them is the bigger take away the smaller: ${t1(Math.max(a, b))} − ${t1(Math.min(a, b))}.` },
          { ...F(b, METRE), why: `${t1(b)} is the mark it goes to. How far is it from the ${t1(a)} m mark?` },
          { ...F(a, METRE), why: `${t1(a)} is where the trolley is now. How far to the ${t1(b)} m mark?` },
          { ...F(d + prec, METRE), why: prec === 1 ? 'One metre too far: count on from the smaller mark.' : 'A tenth too far. Line the points up and take away.' },
          { ...F(Math.max(prec, d - prec), METRE), why: prec === 1 ? 'One metre short: count on from the smaller mark.' : 'A tenth short. Line the points up and take away.' },
          ...(pt ? [{ ...F(r2(d * 10), METRE), why: `The point went missing: ${t1(d)}, not ${t1(d * 10)}.` }] : [])],
        rightWhy: `${t1(Math.max(a, b))} − ${t1(Math.min(a, b))} = ${u(d, METRE)}`, sum: { op: 'sub', a: Math.max(a, b), b: Math.min(a, b) },
        help: { title: 'The rail is a number line', pic: { kind: 'rail', from: a, to: b, gap: true, what: s.what, leg: s.leg }, line: 'Where it is going take away where it is: the bigger mark minus the smaller.', steps: [`${t1(Math.max(a, b))} − ${t1(Math.min(a, b))} = ?`] },
        own: { strand: prec === 1 ? 'words' : 'dec', at: prec === 1 ? 18 : 48 }, credit: [{ strand: 'sub', at: prec === 1 ? 14 : 45, weight: 0.5 }], facts: { kind: 'along', step: s.id, d, live: s.id != null },
      }, rand);
    },
  },
  // ── the hook up and down ──
  // step 1  whole metres; step 2  tenths
  hoist: {
    strand: 'words', at: (step) => (step <= 1 ? 24 : 48),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), prec = step <= 1 ? 1 : 0.1, s = fromLive(live, 'hoist', { prec, least: prec }) || (() => { const a = prec === 1 ? 6 : 6.3, b = prec === 1 ? t.int(1, 4) : t.pick([0.7, 2.3, 3.7, 2.2]); return { from: a, to: b, what: t.pick(['a canister below it', 'the height on the work order']), carrying: false }; })();
      const a = s.from, b = s.to, d = r2(Math.abs(b - a)), down = b < a, sum = r2(a + b);
      return ownOrder({
        key: `hoist:${step}`, story: `The hook is ${t1(a)} m up${s.carrying ? ', with the canister' : ''}. It must go ${down ? 'down' : 'up'} to ${s.what}, ${t1(b)} m up.`, ask: `How far ${down ? 'down' : 'up'} must the hook go?`,
        right: F(d, METRE),
        slips: [{ ...F(sum, METRE), why: `That adds the two heights. The way between is the bigger take away the smaller: ${t1(Math.max(a, b))} − ${t1(Math.min(a, b))}.` },
          { ...F(b, METRE), why: `${t1(b)} m is the height it goes to, not how far it goes.` }, { ...F(a, METRE), why: `${t1(a)} m is how high it is now.` },
          { ...F(d + prec, METRE), why: 'One step of the scale too far. Count again from the lower height.' }, { ...F(Math.max(prec, d - prec), METRE), why: 'One step of the scale short.' }],
        rightWhy: `${t1(Math.max(a, b))} − ${t1(Math.min(a, b))} = ${u(d, METRE)} ${down ? 'down' : 'up'}`, sum: { op: 'sub', a: Math.max(a, b), b: Math.min(a, b) },
        help: { title: 'The hoist\'s scale', pic: { kind: 'hoist', from: a, to: b, what: s.what }, line: 'The hook\'s height is on the chair\'s screens. How far it goes is the higher height take away the lower.', steps: [`${t1(Math.max(a, b))} − ${t1(Math.min(a, b))} = ?`] },
        own: { strand: prec === 1 ? 'words' : 'dec', at: prec === 1 ? 24 : 48 }, credit: [{ strand: 'sub', at: prec === 1 ? 14 : 45, weight: 0.5 }], facts: { kind: 'hoist', step: s.id, d, live: s.id != null },
      }, rand);
    },
  },
  // ── up and down as plus and minus: Mathwood's negatives card (its slips) on the hook's real move ──
  change: {
    strand: 'number', at: () => 34,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'hoist', { prec: 1, least: 2 }) || (() => { const a = 6, b = t.int(1, 4); return { from: a, to: b, what: 'a canister below it' }; })();
      const a = Math.round(s.from), b = Math.round(s.to), c = b - a;
      // (where it ends take away where it starts: the change, plus up, minus down)
      const card = makeCard(b, '-', a, { size: 4, rand });
      const WHY = { way: 'That adds the heights. The change is where it ends take away where it starts.', sign: `Right size, wrong way: ${c < 0 ? '+' : '−'}${Math.abs(c)} would take the hook ${c < 0 ? 'up' : 'down'}. It goes ${c < 0 ? 'down, so it is minus' : 'up, so it is plus'}.`,
        drop: 'That adds the sizes and drops the signs. The change is where it ends take away where it starts.', start: 'That starts on the wrong side. Ends minus starts.',
        near: 'One off: count the metres on the hoist\'s scale again.' };
      // (a change can be minus: the buttons' values are kept above zero by CHANGE_AT, as the engine keeps only counts)
      const coins = card.targets.map((x) => ({ ...F(x.n, METRE, { sign: true }), v: CHANGE_AT + x.n, good: x.good, why: x.good ? '' : WHY[x.trap] || WHY[signSlip(b, '-', a, x.n)] || 'Count the metres from where the hook is to where it goes, and say which way.' }));
      const right = coins.find((x) => x.good);
      return ownOrder({
        key: 'change', story: `On the hoist's scale, up is plus and down is minus. The hook is at ${a} m; it goes to ${s.what}, at ${b} m.`, ask: 'What is the change in the hook\'s height?',
        right, slips: coins.filter((x) => !x.good),
        rightWhy: `${b} − ${a} = ${c > 0 ? '+' : '−'}${Math.abs(c)}: ${Math.abs(c)} m ${c < 0 ? 'down' : 'up'}`,
        help: { title: 'Up is plus, down is minus', pic: { kind: 'hoist', from: a, to: b, what: s.what, signed: true }, line: 'Where it ends take away where it starts. Going down makes it minus.', steps: [`${b} − ${a} = ?`] },
        own: { strand: 'number', at: 34 }, credit: [{ strand: 'sub', at: 20, weight: 0.5 }], facts: { kind: 'hoist', step: s.id, change: c, offset: CHANGE_AT, live: s.id != null },
      }, rand);
    },
  },
  // ── time from speed ──
  // step 1  whole metres at 1 or 2 m a second; step 2  halves and tenths (7.5 m at 0.5 m a second)
  time: {
    strand: 'words', at: (step) => (step <= 1 ? 40 : 52),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), speeds = step <= 1 ? [1, 2] : [0.5, 1.5, 0.6, 0.8, 1.2], prec = step <= 1 ? 1 : 0.1;
      const s = fromLive(live, 'time', { prec, speeds, least: 1.5 }) || (() => { const v = t.pick(speeds), n = t.int(3, 12); return { leg: 'wall', mark: 20, markTo: r2(20 - n * v), what: 'the next stop', speed: v }; })();
      const d = r2(Math.abs(s.markTo - s.mark)), v = s.speed, secs = r2(d / v);
      return ownOrder({
        key: `time:${step}`, story: `${cap(s.what)} is ${t1(d)} m along ${railWords(s)} from the trolley. The trolley runs at ${t1(v)} ${v === 1 ? 'metre' : 'metres'} a second.`, ask: 'How many seconds will it take?',
        right: F(secs, SEC),
        slips: [{ ...F(r2(d * v), SEC), why: `That multiplies. Each second covers ${t1(v)} m: how many of those fit in ${t1(d)} m? ${t1(d)} ÷ ${t1(v)}.` },
          { ...F(d, SEC), why: `${t1(d)} is the metres. At ${t1(v)} m a second it takes ${t1(d)} ÷ ${t1(v)} seconds.` },
          { ...F(secs + 1, SEC), why: 'One second too many. Count the seconds as the metres add up.' }, { ...F(Math.max(1, secs - 1), SEC), why: 'One second short.' },
          ...(v < 1 ? [{ ...F(r2(secs / 10), SEC), why: 'The point went the wrong way: a slow trolley takes MORE seconds than metres.' }] : [])],
        rightWhy: `${t1(d)} ÷ ${t1(v)} = ${u(secs, SEC)}`, sum: { op: 'div', a: d, b: v },
        help: { title: 'A second at a time', pic: { kind: 'speed', d, v }, line: `Every second the trolley goes ${t1(v)} m. How many seconds make ${t1(d)} m?`, steps: [`${t1(d)} ÷ ${t1(v)} = ?`] },
        own: { strand: v < 1 || d % 1 ? 'dec' : 'words', at: step <= 1 ? 40 : 52 }, credit: [{ strand: 'div', at: step <= 1 ? 29 : 55, weight: 0.5 }], facts: { kind: 'time', step: s.id, d, v, secs, live: s.id != null },
      }, rand);
    },
  },
  // ── across the beam (the carriage to the ship's side) ──
  slide: {
    strand: 'dec', at: () => 48,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'slide', { prec: 0.1, least: 0.3 }) || { from: 0, to: t.pick([1.2, -1.2, 0.8]), what: 'the rack\'s side of the ship' };
      const a = s.from, b = s.to, d = r2(Math.abs(b - a));
      return ownOrder({
        key: 'slide', story: `The carriage runs along the trolley's beam; its marks count from the middle. It is at ${t1(a)} m and must go to ${t1(b)} m, over ${s.what}.`, ask: 'How far does the carriage move?',
        right: F(d, METRE), slips: [{ ...F(r2(Math.abs(a) + Math.abs(b)) === d ? r2(d + 0.2) : r2(Math.abs(a) + Math.abs(b)), METRE), why: 'Take away the smaller from the bigger: where it goes and where it is.' }, { ...F(Math.abs(b), METRE), why: 'That is where it goes, not how far.' }, { ...F(d + 0.1, METRE), why: 'A tenth too far.' }],
        rightWhy: `${u(d, METRE)} across`, sum: { op: 'sub', a: Math.max(a, b), b: Math.min(a, b) },
        help: { title: 'Across the beam', pic: { kind: 'beam', from: a, to: b }, line: 'The beam\'s marks are a short number line. How far apart are the two marks?', steps: [`${t1(Math.max(a, b))} − ${t1(Math.min(a, b))} = ?`] },
        own: { strand: 'dec', at: 48 }, facts: { kind: 'slide', step: s.id, d, live: s.id != null },
      }, rand);
    },
  },
  // ── weights against the crane's limit (the plate on its beam says RATED) ──
  // step 1  how much the hook lifts (the canister and its ore); step 2  how much more it could lift
  weight: {
    strand: 'dec', at: (step) => (step <= 1 ? 56 : 58),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'weight', {}) || { ore: t.pick([1.2, 1.5, 0.8, 2.1, 1.4]), fill: 1, what: 'the canister' };
      const ore = r1(s.ore * s.fill), all = r1(EMPTY + ore), spare = r1(RATED - all), more = t.chance(0.4) && step > 1;
      const ask = more ? `The plate on the crane says ${RATED} t. How much more could the hook lift with this canister on it?` : `How much will the hook lift? (The plate on the crane says ${RATED} t.)`;
      const right = more ? F(spare, TONNE) : F(all, TONNE);
      const slips = more
        ? [{ ...F(r1(RATED - ore), TONNE), why: `That leaves out the canister's own ${t1(EMPTY)} t. Add it on first.` }, { ...F(all, TONNE), why: `${t1(all)} t is the load. The question is what is left of the ${RATED} t.` }, { ...F(r1(spare + 0.1), TONNE), why: 'A tenth off. Line the points up and take away.' }]
        : [{ ...F(ore, TONNE), why: `That is the ore only. The canister weighs ${t1(EMPTY)} t as well.` }, { ...F(r1(ore * 10 + EMPTY), TONNE), why: 'The point went missing in the ore.' }, { ...F(r1(all + 0.1), TONNE), why: 'A tenth too much. Line the points up and add.' }, { ...F(r1(RATED - all), TONNE), why: `That is what is left of the ${RATED} t. The question is the load itself.` }];
      return ownOrder({
        key: `weight:${more ? 'spare' : 'load'}`, story: `Before it lifts, the crane weighs its load. ${cap(s.what)} weighs ${t1(EMPTY)} t empty and has ${t1(ore)} t of ore in it.`, ask,
        right, slips,
        rightWhy: more ? `${t1(EMPTY)} + ${t1(ore)} = ${t1(all)} t; ${RATED} − ${t1(all)} = ${u(spare, TONNE)} to spare: it lifts` : `${t1(EMPTY)} + ${t1(ore)} = ${u(all, TONNE)}, under ${RATED} t: it lifts`,
        sum: more ? [{ op: 'add', a: EMPTY, b: ore, say: 'First the load: the canister and its ore' }, { op: 'sub', a: RATED, b: all, say: `Then what is left of the ${RATED} t` }] : { op: 'add', a: EMPTY, b: ore },
        help: { title: 'Weighing the load', pic: { kind: 'plate', empty: EMPTY, ore, rated: RATED, more }, line: more ? 'First the load (the canister and its ore), then take it away from what the plate says.' : 'The hook lifts the canister and the ore in it: add the two.', steps: more ? [`${t1(EMPTY)} + ${t1(ore)} = ?`, `${RATED} − that = ?`] : [`${t1(EMPTY)} + ${t1(ore)} = ?`] },
        own: { strand: 'dec', at: more ? 58 : 56 }, credit: [{ strand: 'add', at: 45, weight: 0.5 }], facts: { kind: 'weight', step: s.id, all, spare, more, live: s.id != null }, size: more ? 2 : 1,
      }, rand);
    },
  },
  // ── how many trips: the round's swap, canister by canister ──
  trips: {
    strand: 'mul', at: () => 60,
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'trip', { most: 8 });
      const toWall = s && s.name === 'unload' ? s.count : t.int(3, 8), n = 8, all = toWall + 2 * n;
      return ownOrder({
        key: 'trips', story: `${s ? 'Work order' : 'From the log'}: ${toWall} full ${toWall === 1 ? 'canister goes' : 'canisters go'} from the Miner to the wall, then ${n} empties from the rack onto the Miner, then the ${n} drained ones back to the rack. The crane carries one canister a trip.`,
        ask: 'How many trips is that in all?',
        right: F(all, TRIP), slips: [{ ...F(toWall + n, TRIP), why: `That leaves out one lot of ${n}. There are three lots: ${toWall}, ${n} and ${n}.` }, { ...F(3 * n, TRIP), why: `Only ${toWall} go to the wall this time, not ${n}.` }, { ...F(all + 1, TRIP), why: 'One too many. Add the three lots.' }, { ...F(toWall * n, TRIP), why: 'That multiplies. Each canister is one trip: add the lots.' }].filter((x) => x.v !== all),
        rightWhy: `${toWall} + ${n} + ${n} = ${u(all, TRIP)}`, sum: [{ op: 'add', a: toWall, b: n, say: 'First the canisters to the wall and the empties onto the ship' }, { op: 'add', a: toWall + n, b: n, say: 'Then the drained ones back to the rack' }],
        help: { title: 'One canister a trip', pic: { kind: 'trips', lots: [toWall, n, n] }, line: 'Each canister is one trip. Add up the three lots.', steps: [`${toWall} + ${n} = ?`, `that + ${n} = ?`] },
        own: { strand: 'add', at: 30 }, credit: [], facts: { kind: 'trip', step: s && s.id, all, live: !!s },
      }, rand);
    },
  },
  // ── routes along and across: the whole way to a canister, as the hook goes ──
  // step 1  how far in all; step 2  how long in all, at the rails' and the beam's speeds
  route: {
    strand: 'dec', at: (step) => (step <= 1 ? 70 : 78),
    make(step, { rand = Math.random, live = null } = {}) {
      const t = kit(rand), s = fromLive(live, 'route', { prec: 0.1 }) || (() => { const a = t.pick([18, 20.3, 22.6]), b = 11.4, c = t.pick([8.6, 15]), x = 1.2; return { legs: [{ leg: 'wall', mark: a, markTo: b, what: 'the turntable' }, { leg: 'ship', mark: 0, markTo: c, what: 'the canister\'s mark' }], across: { from: 0, to: x }, what: 'the canister on the ship\'s tray' }; })();
      const L = s.legs.map((g) => r2(Math.abs(g.markTo - g.mark))), X = r2(Math.abs(s.across.to - s.across.from)), all = r2(L.reduce((p, q) => p + q, 0) + X);
      const time = step > 1, V = 2, VX = 0.6, secs = r2(L.reduce((p, q) => p + q / V, 0) + X / VX);
      const lines = [...s.legs.map((g) => [g.leg === 'wall' ? 'Wall rail' : 'Ship rail', `${t1(g.mark)} → ${t1(g.markTo)} m`]), ['Across', `${t1(s.across.from)} → ${t1(s.across.to)} m`], [time ? 'Time' : 'In all', '?']];
      const right = time ? F(secs, SEC) : F(all, METRE);
      const slips = time
        ? [{ ...F(r2(all / V), SEC), why: `The carriage is slower: across goes at ${VX} m a second, not ${V}.` }, { ...F(all, SEC), why: 'That is the metres. Each part takes its metres ÷ its speed.' }, { ...F(r2(secs - X / VX), SEC), why: 'That leaves out the carriage\'s part, across the beam.' }, { ...F(r2(secs + 1), SEC), why: 'A second too many. Add up each part\'s time.' }]
        : [{ ...F(r2(all - X), METRE), why: 'That leaves out the carriage\'s part, across the beam.' }, { ...F(r2(s.legs.reduce((p, g) => p + g.markTo, 0) + s.across.to), METRE), why: 'That adds the marks themselves. Each part is the way between its two marks.' }, { ...F(r2(all + 0.1), METRE), why: 'A tenth too far. Line up the points and add.' }, { ...F(r2(all - L[0]), METRE), why: 'That leaves out the wall rail\'s part.' }];
      const sums = time ? s.legs.map((g, i) => ({ op: 'div', a: L[i], b: V, say: `${g.leg === 'wall' ? 'The wall rail' : 'The ship rail'}: ${t1(L[i])} m at ${V} m a second` })).concat([{ op: 'div', a: X, b: VX, say: `Across: ${t1(X)} m at ${VX} m a second` }])
        : s.legs.map((g, i) => ({ op: 'sub', a: Math.max(g.mark, g.markTo), b: Math.min(g.mark, g.markTo), say: `${g.leg === 'wall' ? 'The wall rail' : 'The ship rail'}: from ${t1(g.mark)} to ${t1(g.markTo)}` }));
      return ownOrder({
        key: `route:${time ? 'time' : 'far'}`, story: `The way to ${s.what}: along the wall rail to the turntable, a quarter turn, out along the ship rail, then the carriage across the beam.${time ? ` The trolley runs at ${V} m a second on the rails, the carriage at ${VX} m a second across.` : ''}`,
        ask: time ? 'How many seconds does the whole way take (the turn left out)?' : 'How far does the hook go in all (the turn left out)?',
        right, slips, lines,
        rightWhy: time ? `${[...L.map((q) => `${t1(q)} ÷ ${V}`), `${t1(X)} ÷ ${VX}`].join(' + ')} = ${u(secs, SEC)}` : `${[...L.map(t1), t1(X)].join(' + ')} = ${u(all, METRE)}`,
        sum: sums.length > 1 ? sums : sums[0],
        help: { title: 'The way, part by part', pic: { kind: 'route', legs: s.legs, across: s.across, time, V, VX }, line: time ? 'Each part: its metres ÷ its speed. Then add the times.' : 'Each part is the way between its two marks. Then add the parts.', steps: time ? ['Each part: metres ÷ speed', 'Then add the times'] : ['Each part: the bigger mark − the smaller', 'Then add the parts'] },
        own: { strand: 'dec', at: time ? 78 : 70 }, credit: [{ strand: 'add', at: 50, weight: 0.5 }], facts: { kind: 'route', step: s.id, all, secs, time, live: s.id != null }, size: time ? 3 : 2,
      }, rand);
    },
  },
};
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ── the ladder: easiest first ────────────────────────────────────────────────────────────────────────────────────
const M = (maker, step, w = 1) => ({ maker, step, w });
const Wd = (step, types, w = 1) => ({ maker: 'words', step, types, w });
export const PLACE = {
  id: 'crane', name: 'The crane operator job', short: 'Crane', math: 'Moving the crane by sums: marks, distances, heights, speeds, weights, trips', pic: 'smelter', job: null,
  line: 'Work the smelter\'s ceiling crane: every right answer is the crane\'s next move.',
  levels: [
    { id: 'cCount', title: 'Counting canisters to move', line: 'Up to 5: the canisters to move, the metre hops', grade: 0, strand: 'number', gen: { mix: [M('count', 1), M('hops', 1, 2)] } },
    { id: 'cHops', title: 'Counting along the rail', line: 'Up to 10 metre hops; 8 came in', grade: 6, strand: 'number', gen: { mix: [M('hops', 2, 2), M('count', 2)] } },
    { id: 'cMarks', title: 'Reading the rail\'s metre marks', line: 'Which mark is socket 5 under?', grade: 10, strand: 'number', gen: { mix: [M('mark', 1, 2), M('hops', 2)] } },
    { id: 'cAlong', title: 'Distances along the rail', line: 'From the 18 m mark to the 6 m mark', grade: 18, strand: 'words', gen: { mix: [M('rail', 1, 2), M('mark', 1)] } },
    { id: 'cHoist', title: 'The hook up and down', line: 'The hook is 6 m up; the canister 1 m up', grade: 24, strand: 'words', gen: { mix: [M('hoist', 1, 2), M('rail', 1)] } },
    { id: 'cChange', title: 'Up and down as plus and minus', line: 'From 6 m to 1 m is a change of −5', grade: 34, strand: 'number', gen: { mix: [M('change', 1, 2), M('hoist', 1), M('rail', 1)] } },
    { id: 'cSpeed', title: 'Time from speed', line: '12 m at 2 m a second', grade: 40, strand: 'words', gen: { mix: [M('time', 1, 2), M('rail', 1)] } },
    { id: 'cTenths', title: 'Tenths along, up and down', line: 'From the 18 m mark to 11.4; the hook from 6.3 m to 3.7', grade: 48, strand: 'dec', gen: { mix: [M('rail', 2, 1.5), M('hoist', 2, 1.5), M('slide', 1)] } },
    { id: 'cHalves', title: 'Time from speed in tenths', line: '7.5 m at half a metre a second', grade: 52, strand: 'dec', gen: { mix: [M('time', 2, 2), M('rail', 2)] } },
    { id: 'cWeight', title: 'Weights against the crane\'s limit', line: 'A 0.4 t canister with 1.6 t of ore; the plate says 3 t', grade: 56, strand: 'dec', gen: { mix: [M('weight', 2, 2), M('rail', 2), M('hoist', 2)] } },
    { id: 'cTrips', title: 'How many trips', line: 'One canister a trip; whole canisters for the ore', grade: 60, strand: 'words', gen: { mix: [M('trips', 1, 1.5), Wd(7, ['share']), M('weight', 2)] } },
    { id: 'cRoute', title: 'Routes along and across', line: 'Along the wall rail, round, out along the ship rail, across', grade: 70, strand: 'dec', gen: { mix: [M('route', 1, 2), M('time', 2)] } },
    { id: 'cRouteTime', title: 'Route times', line: 'The whole way at 2 m a second, 0.6 across', grade: 78, strand: 'dec', gen: { mix: [M('route', 2, 2), M('route', 1)] } },
  ],
};

// ── THE JOB'S QUEUE OF MOVES (what joins a question to a move; src/jobs/cranelink.js runs it on the live crane) ──────
// The trips are planned ahead from where everything will be once the moves already given are done (tripFrom), as a
// queue. A maker asks for the next move of its kind (ask): its numbers are put on the level's marks (a whole metre, a
// tenth) and it is held for that question. A right answer (right) gives the moves up to and including it as the
// live crane's autopilot steps (kit/crane-drive.js go): the asked one by exactly the answer's numbers, with the crane
// lining itself up onto the marks before it and onto the place after it; the moves no question asked about, the
// crane makes by itself. A question that held no move lets the crane make its next move.
//   const Q = makeJobQueue(site, { start: () => state, oreOf: () => tonnes })   state: the live crane's (stateAt's shape)
//   Q.ask(kind, opts) -> numbers for the question (with .id), or null     kinds: 'along', 'time', 'hoist', 'slide',
//                        'weight', 'trip', 'route'; opts: { prec, most, least, near, speeds }
//   Q.right(id) -> the autopilot's steps          Q.reserved, Q.queue, Q.cursor
const rnd2 = (x) => Math.round(x * 100) / 100;
const roundTo = (x, p) => rnd2(Math.round(x / p) * p);
export function makeJobQueue(site, { start, oreOf = () => 1.2 } = {}) {
  const queue = [];
  let cursor = 0, planned = null, ids = 0;
  const Q = { queue, reserved: null, get cursor() { return cursor; }, get planned() { return planned; } };
  function begin() {
    const S = start(), held = S.cans.findIndex((q) => q.where === 'held');
    planned = { x: S.x, z: S.z, yaw: S.yaw, slide: S.slide, hoist: S.hoist, held, cans: S.cans.map((q) => ({ where: q.where, i: q.i, fill: q.fill })) };
    // (where it is now is a little odd: up and the carriage home first)
    if (Math.abs(S.hoist - site.carry) > 1e-3) { queue.push({ kind: 'hoist', from: S.hoist, to: site.carry, what: 'the top', carrying: held >= 0, id: ids++ }); planned.hoist = site.carry; }
    if (Math.abs(S.slide) > 1e-3) { queue.push({ kind: 'slide', from: S.slide, to: 0, what: 'the beam\'s middle', id: ids++ }); planned.slide = 0; }
  }
  function more() {
    let T = tripFrom(site, planned);
    if (!T) {
      // (nothing left to move: the Miner is back from a run with its canisters full, as at the end of a round)
      for (const q of planned.cans) if (q.where === 'mount') q.fill = 1;
      queue.push({ kind: 'refill', id: ids++ });
      T = tripFrom(site, planned);
      if (!T) return false;
    }
    for (const s of T.steps) queue.push({ ...s, trip: T, id: ids++ });
    return true;
  }
  // the next move from the cursor that passes `test`, planning up to two more trips for it -> its index, or -1
  function findFrom(test, from = cursor) {
    for (let k = from, made = 0; ; k++) {
      while (k >= queue.length) { if (made >= 2 || !more()) return -1; made++; }
      if (test(queue[k], k)) return k;
    }
  }
  const speedFor = (d, speeds) => { for (const v of speeds) { const s = d / v; if (Math.abs(s - Math.round(s)) < 1e-6 && s >= 2 && s <= 40) return v; } return null; };
  // a route: along a leg to the turntable, the turn, out along the other leg, the carriage across
  function routeAt(i) {
    const a = queue[i];
    let j = i + 1;
    while (j < queue.length && queue[j].kind !== 'turn') { if (queue[j].kind !== 'hoist') return null; j++; }
    if (j >= queue.length) return null;
    j++;
    while (j < queue.length && queue[j].kind !== 'along') { if (queue[j].kind !== 'hoist') return null; j++; }
    if (j >= queue.length) return null;
    const b = queue[j]; j++;
    if (j >= queue.length || queue[j].kind !== 'slide') return null;
    const across = queue[j], to = queue.slice(j + 1).find((q) => q.kind === 'hoist' || q.kind === 'trip');
    return { legs: [a, b], across, end: j, what: to && to.kind === 'hoist' ? to.what : across.what };
  }
  // (planning again from where the crane is now: after a move that could not be made)
  Q.restart = function restart() { queue.length = 0; cursor = 0; planned = null; Q.reserved = null; };
  // the kinds of question the crane's next move could be asked as: ['along'], ['along', 'route'], ['hoist'], ['grab'],
  // ['trip'] ... (the moves it makes by itself, the waits and the turns, are passed over)
  const moving = (s) => s.kind === 'along' || s.kind === 'hoist' || s.kind === 'slide' || (s.kind === 'grab' && s.how === 'shut' && s.c >= 0);
  const kinds = (k) => { const s = queue[k]; return s.kind === 'grab' ? ['grab'] : s.kind === 'along' ? (s.what === 'the turntable' && routeAt(k) ? ['along', 'route'] : ['along']) : [s.kind]; };
  Q.peek = function peek() {
    if (!planned) begin();
    const k = findFrom((s) => moving(s) || s.kind === 'trip');
    if (k < 0) return [];
    // (at a trip's start: the trip itself, to be counted, or its first move)
    if (queue[k].kind === 'trip') { const m = findFrom(moving, k + 1); return ['trip', ...(m >= 0 ? kinds(m) : [])]; }
    return kinds(k);
  };
  // the next few moves' kinds, in order (a level none of whose questions suits the very next move asks about the first
  // move one of them does suit; the crane makes the ones before it by itself)
  Q.ahead = function ahead(n = 8) {
    if (!planned) begin();
    const out = [];
    for (let k = cursor; out.length < n;) {
      k = findFrom((s) => moving(s) || s.kind === 'trip', k);
      if (k < 0) break;
      if (queue[k].kind === 'trip') { const m = findFrom(moving, k + 1); out.push(['trip', ...(m >= 0 ? kinds(m) : [])]); k = m >= 0 ? m + 1 : k + 1; } else { out.push(kinds(k)); k++; }
    }
    return out;
  };
  Q.ask = function ask(kind, o = {}) {
    if (!planned) begin();
    const prec = o.prec || 1;
    let k = -1, out = null;
    if (kind === 'along' || kind === 'time') {
      k = findFrom((s) => {
        if (s.kind !== 'along') return false;
        const a = roundTo(s.mark, prec), b = roundTo(s.markTo, prec), d = Math.abs(b - a);
        if (o.near != null && Math.abs(s.markTo - b) > o.near) return false;
        if (Math.abs(s.markTo - b) > prec / 2 + 1e-9 || d < (o.least || prec) - 1e-9) return false;
        return kind === 'time' ? !!speedFor(Math.min(d, o.most || Infinity), o.speeds || [1, 2]) : true;
      });
      if (k < 0) return null;
      const s = queue[k];
      let a = roundTo(s.mark, prec);
      const b = roundTo(s.markTo, prec);
      // (a long way at the youngest levels: the crane does most of it by itself, the last `most` metres are asked)
      if (o.most && Math.abs(b - a) > o.most) a = rnd2(b - Math.sign(b - a) * o.most);
      out = { leg: s.leg, mark: a, markTo: b, what: s.what };
      if (kind === 'time') out.speed = speedFor(Math.abs(b - a), o.speeds || [1, 2]);
    } else if (kind === 'hoist') {
      k = findFrom((s) => s.kind === 'hoist' && Math.abs(roundTo(s.to, prec) - s.to) <= Math.max(prec / 2, 0.06) + 1e-9 && Math.abs(roundTo(s.to, prec) - roundTo(s.from, prec)) >= (o.least || prec) - 1e-9 && roundTo(s.to, prec) > 0);
      if (k < 0) return null;
      const s = queue[k];
      out = { from: roundTo(s.from, prec), to: roundTo(s.to, prec), what: s.what, carrying: !!s.carrying, at: s.at || null };
    } else if (kind === 'slide') {
      k = findFrom((s) => s.kind === 'slide' && Math.abs(roundTo(s.to, prec) - roundTo(s.from, prec)) >= (o.least || prec) - 1e-9);
      if (k < 0) return null;
      const s = queue[k];
      out = { from: roundTo(s.from, prec), to: roundTo(s.to, prec), what: s.what, at: s.at || null };
    } else if (kind === 'weight') {
      k = findFrom((s) => s.kind === 'grab' && s.how === 'shut' && s.c >= 0);
      if (k < 0) return null;
      const s = queue[k];
      out = { ore: oreOf(), fill: s.fill, what: s.what };
    } else if (kind === 'trip') {
      k = findFrom((s) => s.kind === 'trip' && (!o.most || s.count <= o.most));
      if (k < 0) return null;
      const s = queue[k];
      out = { name: s.name, count: s.count, what: s.what, story: s.trip.story };
    } else if (kind === 'route') {
      k = findFrom((s, i) => s.kind === 'along' && s.what === 'the turntable' && !!routeAt(i));
      if (k < 0) return null;
      const R = routeAt(k);
      out = { legs: R.legs.map((g) => ({ leg: g.leg, mark: roundTo(g.mark, prec), markTo: roundTo(g.markTo, prec), what: g.what })), across: { from: roundTo(R.across.from, prec), to: roundTo(R.across.to, prec) }, what: R.what, end: R.end };
    } else return null;
    Q.reserved = { ...out, kind, k, id: queue[k].id, prec };
    return { ...out, id: queue[k].id };
  };
  // the autopilot's steps for the moves from the cursor up to and including index `last`
  const alongOf = (leg, mark) => (leg === 'wall' ? site.rail.wall[0] + mark : site.turn[1] + mark);
  function stepsOf(s, asked) {
    switch (s.kind) {
      case 'along': {
        if (!asked || (asked.kind !== 'along' && asked.kind !== 'time' && asked.kind !== 'route')) return [{ axis: 'along', to: s.to }];
        let a = asked.mark, b = asked.markTo;
        if (asked.kind === 'route') { const g = asked.legs.find((x) => x.leg === s.leg); a = g.mark; b = g.markTo; }
        return [{ axis: 'along', to: alongOf(s.leg, a) }, { axis: 'along', to: alongOf(s.leg, b), v: asked.kind === 'time' ? asked.speed : undefined, asked: true }, { axis: 'along', to: s.to }];
      }
      case 'hoist': return asked && asked.kind === 'hoist' ? [{ axis: 'hoist', to: asked.from }, { axis: 'hoist', to: asked.to, asked: true }, { axis: 'hoist', to: s.to }] : [{ axis: 'hoist', to: s.to }];
      case 'slide': return asked && asked.kind === 'slide' ? [{ axis: 'slide', to: asked.from }, { axis: 'slide', to: asked.to, asked: true }, { axis: 'slide', to: s.to }]
        : asked && asked.kind === 'route' ? [{ axis: 'slide', to: asked.across.to, asked: true }, { axis: 'slide', to: s.to }] : [{ axis: 'slide', to: s.to }];
      case 'push': return [{ axis: 'slide', to: s.to, v: 0.2 }];
      case 'turn': return [{ turn: true }];
      case 'grab': return [{ grab: s.how }];
      case 'wait': return [{ until: s.for === 'tray' ? (D) => D.state.tray[s.i] > 0.999 : s.for === 'iris' ? (D) => D.state.iris[s.k] > 0.999 : s.for === 'dogs' ? (D) => D.state.lit[s.k] > 0.999 : s.for === 'drained' ? (D) => D.state.cans[s.c].fill <= 0 : (D) => D.held === s.c, waiting: s.for }];
      case 'refill': return [{ until: (D) => { for (const q of D.state.cans) if (q.where === 'mount') q.fill = 1; return true; }, refill: true }];
      default: return [];
    }
  }
  function upTo(last, asked = null) {
    const out = [];
    for (let k = cursor; k <= last && k < queue.length; k++) out.push(...stepsOf(queue[k], asked && k >= asked.k && k <= (asked.end ?? asked.k) ? asked : null));
    cursor = Math.max(cursor, last + 1);
    return out;
  }
  // the moves before the one a question holds, which the crane makes by itself: made as the card comes, so the crane is
  // where the card says by the time it is read
  Q.before = function before() {
    const R = Q.reserved;
    return R && R.k > cursor ? upTo(R.k - 1) : [];
  };
  // a right answer: the moves up to and including the one it held (a weight: through the lift; a trip: the first move;
  // a route: the whole way); a question that held none: the next move
  Q.right = function right(id) {
    if (!planned) begin();
    const R = Q.reserved;
    let steps;
    if (id != null && R && R.id === id) {
      let last = R.k;
      if (R.kind === 'weight') { const k = findFrom((s, i) => i > R.k && s.kind === 'hoist', R.k + 1); last = k >= 0 ? k : R.k; }
      else if (R.kind === 'route') last = R.end;
      else if (R.kind === 'trip') { const k = findFrom((s, i) => i > R.k && (s.kind === 'along' || s.kind === 'hoist'), R.k + 1); last = k >= 0 ? k : R.k; }
      steps = upTo(last, R);
    } else {
      const k = findFrom((s) => s.kind === 'along' || s.kind === 'hoist' || s.kind === 'slide' || s.kind === 'push');
      steps = k >= 0 ? upTo(k) : [];
    }
    Q.reserved = null;
    return steps;
  };
  return Q;
}

// THE OPERATOR AREA: the operator's chair in the smelter's control room. Its two options are its two sides (as you
// sit: the yellow stick on the left, the red on the right); which one comes up is the side you look at.
export const OPERATOR = { piece: 'opChair', local: [0, 0, -0.95], face: [0, 1] };
// which of the job's makers can ask about which kind of move (route: the way out to a canister, from the turntable)
const SUITS = { hops: ['along'], mark: ['along'], rail: ['along'], time: ['along'], hoist: ['hoist'], change: ['hoist'], slide: ['slide'], weight: ['grab'], trips: ['trip'], count: ['trip'], route: ['route'], words: [] };
// the level's makers that suit the crane's next move, one of them by weight; none: null (Mathwood's own pick)
function pickAsk(mix, { rand = Math.random, live = null } = {}) {
  const ahead = live && live.ahead ? live.ahead() : live && live.peek ? [live.peek()] : [];
  let fits = [];
  for (const next of ahead) { fits = mix.filter((a) => (SUITS[a.maker] || []).some((k) => next.includes(k))); if (fits.length) break; }
  if (!fits.length) return null;
  // (a question about no move, Mathwood's word problems, comes as often as its weight says, whatever the move)
  const all = fits.concat(mix.filter((a) => !(SUITS[a.maker] || []).length));
  let r = rand() * all.reduce((q, a) => q + (a.w ?? 1), 0);
  for (const a of all) if ((r -= a.w ?? 1) <= 0) return a;
  return all[all.length - 1];
}
export const JOB = {
  id: 'crane', name: 'Crane operator job', short: 'Crane', open: true, pickAsk,
  pair: 'operator', side: 'right', spot: OPERATOR, near: 2.3, seated: true,
  sign: 'Crane operator job', hint: 'Right answers move the crane: credits for each',
  place: PLACE, setting: SETTING, makers: MAKERS, card: 'workorder',
};
export const FREE = {
  id: 'craneFree', name: 'Free control', short: 'Free control', open: true, drive: true, place: null,
  pair: 'operator', side: 'left', spot: OPERATOR, near: 2.3, seated: true,
  sign: 'Free control', signSub: 'Just for fun', hint: 'Drive the crane by hand: no credits, just for fun',
};
