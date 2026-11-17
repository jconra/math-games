// A ROUND OF MATHBALL, as plain numbers (no three.js, no page): the balls coming out of the ports, the four goals and
// their rules, the light bar's lap and the rule it changes at each goal, the scores, and the other player's brain.
// The page (src/mathball/index.js) draws it and walks the player; node plays whole rounds with a stand-in player
// (src/mathball/sim.js) to check the other player is fair (pi-nebula/tests/mathball.test.mjs).
//
// THE RULES OF PLAY (the game's maker, 2026-11-16):
//   - "whoever gets the most balls into the right goals wins"; a ball thrown into a goal it doesn't fit bounces back
//     out (nobody scores; a plain line says why);
//   - a round is one lap of the light bar, two minutes: as the bar reaches the spot over a goal (every 30 s, the
//     first at 15 s), that goal's rule changes, once the game has checked the balls on the court (rules.js pickChange:
//     every ball keeps a goal it fits, none fits every goal);
//   - balls are shot out of the wall ports (eight at the start, a new one a moment after each is scored), and only
//     balls that fit at least one goal and never all four are dealt.
// THE OTHER PLAYER (CH-10): one of the station's crew. "It keeps up with the player and has a chance at winning, but
// neither player should steamroll the other one ... They can also grab a ball that the player has passed over a bunch of
// times so the player doesn't feel stuck ... moving around turning even if it is waiting for its next chance." So:
//   - its PACE follows the player's: it aims to score at the player's own rate (what they scored in earlier rounds,
//     then this round's as it goes) times its level's share (OTHER.levels), pulled back when it is ahead and pushed on
//     when it is behind (OTHER.band); it waits for its next go, roaming, until its pace says go;
//   - it is sometimes wrong (its level's accuracy), as a person is;
//   - a ball the player has passed over OTHER.passed times (it was in view and they picked another) is the one it
//     goes for next;
//   - waiting, it never stands still: it jogs, sidesteps and turns to watch the balls and the player.
//
//   const G = makeRound({ set, rand, other: { level }, youRate })
//   G.step(dt, { eye, sees, you: { x, z, vx, vz, heading } })   eye/sees: physics.js's; you: the player's feet now
//   G.pick(id) / G.throwAt(goal) / G.drop()                      the player's moves (a click on a ball, on a goal)
//   G.you.want -> { to: [x, z] | null, face: heading | null, run }   where the player should go (the page walks them)
//   G.take() -> [events]   'launch' {ball, port}, 'got' {who, ball}, 'throw' {who, ball, goal}, 'score' {who, ball,
//                          goal, from}, 'bounce' {who, ball, goal, why}, 'change' {goal, from, to, strand}, 'fade'
//                          {ball}, 'taken' {ball} (the player's ball was taken), 'end' {you, them}
//   G.barS() / G.next()    the light bar: metres along its track; the next goal it reaches and the share of the way
import { COURT, GOALS, PORTS, STATIONS, SPOTS, barAt, clampIn } from './court.js';
import { ruleOf, fits, goalsFor, dealable, pickChange } from './rules.js';
import { makeBalls, lobTime, PHYS } from './physics.js';

export const ROUND = {
  start: 8, most: 8, least: 6,     // balls dealt at the start; the most and the fewest on the court
  gapStart: 0.42,                  // s between the first balls
  again: [1.2, 2.6],               // s before a new ball comes after one is scored or faded
  reach: 0.75,                     // m: near enough to pick a ball up
  wind: 0.22,                      // s the throw takes from facing the goal to the ball leaving the hand
  facing: 0.5,                     // rad: facing the goal this nearly, the throw goes
  hold: [0.48, 1.08, 0.18],        // where a held ball is: out to the side, up, forward of the feet (m)
  fade: 0.8,                       // s a swapped-out ball takes to fade
};
// THE OTHER PLAYER'S LEVELS: easier, a match, harder (the player picks one to start a round)
export const OTHER = {
  levels: [
    { key: 'easy', share: 0.76, acc: 0.74, run: 3.5 },
    { key: 'even', share: 0.9, acc: 0.85, run: 3.9 },
    { key: 'hard', share: 1.06, acc: 0.93, run: 4.3 },
  ],
  band: { at: 2, ahead: 0.62, behind: 1.4, step: 0.12 },   // ahead by 2 or more: slower; behind by 2 or more: quicker
  passed: 3,                       // a ball passed over this many times is the one it goes for
  think: [0.35, 0.9],              // s it takes to choose a goal once it holds a ball
  roam: [0.8, 1.8],                // s between new spots while it waits
  keep: 1.1,                       // m it keeps off the player
  youRate: 5,                      // right balls a minute a player is guessed to score before any are seen
};

const pick = (a, rand) => a[Math.floor(rand() * a.length)];
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const free = (b) => b.mode === 'air' || b.mode === 'roll' || b.mode === 'rest' || b.mode === 'turn';
const COLOURS = 6;

export function makeRound({ set, rand = Math.random, other = {}, youRate = OTHER.youRate } = {}) {
  const lv = OTHER.levels[Math.max(0, Math.min(2, other.level ?? 1))];
  const world = makeBalls({ rand });
  const spares = [...new Set([...set.goals, ...set.spares])];
  const G = {
    set, t: 0, phase: 'play', world, balls: world.list, events: [],
    goals: GOALS.map((g, i) => ({ i, rule: set.goals[i], flash: 0, was: null })),
    score: { you: 0, them: 0 }, tries: { you: 0, them: 0 }, changes: 0, stranded: 0,
    you: { x: SPOTS.player[0], z: SPOTS.player[1], vx: 0, vz: 0, heading: Math.PI, holding: null, target: null, aim: null, wind: 0, want: { to: null, face: null, run: true } },
    other: { x: SPOTS.other[0], z: SPOTS.other[1], vx: 0, vz: 0, heading: 0, mode: 'roam', holding: null, target: null, aim: null, t: 0, roamTo: null, roamT: 0, nextAt: 2.5, anim: null, level: lv.key, last: null },
    youRate, lv,
  };
  let nextId = 1, dealQ = [], changed = new Set(), recent = [];
  const emit = (type, o = {}) => G.events.push({ type, t: G.t, ...o });
  G.take = () => { const e = G.events; G.events = []; return e; };
  const rules = () => G.goals.map((g) => g.rule);
  const onCourt = () => G.balls.filter((b) => b.mode !== 'gone' && b.mode !== 'in' && !b.fading);

  // ── dealing ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // a number for a new ball: one that fits a goal and not all four, not on the court already, not dealt lately, and
  // for the goals that have the fewest balls now
  function chooseNum() {
    const R = rules(), live = onCourt(), here = new Set(live.map((b) => String(b.num)));
    let cands = dealable(R, set.pool).filter((n) => !here.has(String(n)));
    if (!cands.length) cands = dealable(R, set.pool);
    const per = R.map((r) => live.filter((b) => fits(r, b.num)).length), least = Math.min(...per);
    const scored = cands.map((n) => {
      const gs = goalsFor(R, n);
      let s = rand() * 2;
      if (gs.some((g) => per[g] === least)) s += 3;           // (feeds a goal that is short of balls)
      if (gs.length >= 2) s += 0.8;                           // (a choice of goals is the game's heart)
      if (recent.includes(String(n))) s -= 2.5;               // (not the same numbers over and over)
      return { n, s };
    }).sort((a, b) => b.s - a.s);
    const n = scored[0].n; recent.push(String(n)); if (recent.length > 10) recent.shift();
    return n;
  }
  function colourFor() {
    const used = onCourt().map((b) => b.colour), n = [...Array(COLOURS).keys()].filter((c) => !used.includes(c));
    return n.length ? pick(n, rand) : Math.floor(rand() * COLOURS);
  }
  // a port away from the players (a ball shot at someone's head is no fun)
  function portFor() {
    const ok = PORTS.filter((p) => Math.hypot(p.at[0] - G.you.x, p.at[2] - G.you.z) > 2.2 && Math.hypot(p.at[0] - G.other.x, p.at[2] - G.other.z) > 2.2);
    return pick(ok.length ? ok : PORTS, rand);
  }
  function deal(at) { dealQ.push(at); }
  function launchOne() {
    const b = world.add({ id: nextId++, num: chooseNum(), colour: colourFor(), passed: 0, born: G.t });
    const port = portFor(); world.launch(port, b, rand); emit('launch', { ball: b.id, port: port.i });
  }
  for (let i = 0; i < ROUND.start; i++) deal(0.3 + i * ROUND.gapStart);

  // ── the player's moves ──────────────────────────────────────────────────────────────────────────────────────────
  const byId = (id) => G.balls.find((b) => b.id === id && b.mode !== 'gone');
  G.pick = (id) => {
    if (G.phase !== 'play') return false;
    const b = byId(id); if (!b || !free(b) || b.fading) return false;
    if (G.you.holding === b) return true;
    if (G.you.holding) G.drop();
    // (every other ball in view on the court a while: passed over once more)
    for (const o of onCourt()) if (o !== b && free(o) && o.seen && G.t - o.born > 3) o.passed++;
    G.you.target = b; G.you.aim = null; G.you.wind = 0;
    return true;
  };
  G.throwAt = (gi) => {
    if (G.phase !== 'play' || !G.you.holding || !GOALS[gi]) return false;
    G.you.aim = gi; G.you.wind = 0; G.you.target = null; return true;
  };
  G.drop = () => {
    const b = G.you.holding; if (!b) return;
    G.you.holding = null; G.you.aim = null;
    b.mode = 'air'; b.v = [Math.sin(G.you.heading) * 0.8, 0.5, Math.cos(G.you.heading) * 0.8]; b.settleT = 0;
  };

  // where a ball held by someone is: out to their side, at hip height
  function carry(P, b) {
    const [s, y, f] = ROUND.hold, h = P.heading, fx = Math.sin(h), fz = Math.cos(h), rx = -fz, rz = fx;
    b.p = [P.x + rx * s + fx * f, y, P.z + rz * s + fz * f]; b.v = [P.vx || 0, 0, P.vz || 0];
  }
  function grab(P, who, b) {
    b.mode = 'held'; b.owner = who; b.w = [0, 0, 0]; P.holding = b; P.target = null; P.grabT = G.t;
    emit('got', { who, ball: b.id });
    if (who === 'them' && G.you.target === b) { G.you.target = null; emit('taken', { ball: b.id }); }
  }
  function release(P, who, gi) {
    const b = P.holding, g = GOALS[gi], from = [...b.p];
    P.holding = null; P.aim = null;
    b.owner = who; world.throwTo(b, from, g.aim, lobTime(from, g.aim));
    b.fly.goal = gi; b.fly.rule = G.goals[gi].rule; b.fly.who = who; b.fly.at = [P.x, P.z];
    G.tries[who]++;
    emit('throw', { who, ball: b.id, goal: gi });
  }
  // a thrown ball arriving at its goal: in (its rule at the moment of the throw) or back out
  function arrive(b) {
    const gi = b.fly.goal, g = GOALS[gi], who = b.fly.who, rule = ruleOf(b.fly.rule);
    if (fits(rule, b.num)) {
      b.mode = 'in'; b.v = [-g.n[0] * 1.6, -0.5, -g.n[1] * 1.6]; b.inAt = G.t;
      G.score[who]++; G.goals[gi].flash = 1;
      emit('score', { who, ball: b.id, num: b.num, goal: gi, rule: rule.id, from: b.fly.at, why: rule.why(b.num) });
      if (who === 'them') G.other.last = G.t;
      deal(G.t + ROUND.again[0] + rand() * (ROUND.again[1] - ROUND.again[0]));
    } else {
      // spat back out onto the court
      b.mode = 'air'; b.settleT = 0; b.owner = null;
      const sp = 3 + rand() * 1.5, side = (rand() - 0.5) * 1.6;
      b.v = [g.n[0] * sp + g.u[0] * side, 2.4, g.n[1] * sp + g.u[1] * side];
      b.p = [g.mid[0] + g.n[0] * (PHYS.r + 0.5), Math.max(b.p[1], 0.6), g.mid[1] + g.n[1] * (PHYS.r + 0.5)];
      b.w = [(rand() - 0.5) * 10, (rand() - 0.5) * 6, (rand() - 0.5) * 10];
      G.goals[gi].flash = -1;
      emit('bounce', { who, ball: b.id, num: b.num, goal: gi, rule: rule.id, why: rule.why(b.num) });
      // (a rule that changed while it flew may have left it with no goal, or every goal: then it is swapped out)
      const n = goalsFor(rules(), b.num).length;
      if (n === 0 || n === GOALS.length) { b.fading = G.t; emit('fade', { ball: b.id }); deal(G.t + ROUND.fade + 0.4); G.stranded++; }
    }
    b.fly = null;
  }

  // ── the rules changing as the bar reaches each goal ─────────────────────────────────────────────────────────────
  function change(gi) {
    const live = onCourt().filter((b) => b.mode !== 'fly' && b.mode !== 'held');
    const held = [G.you.holding, G.other.holding].filter(Boolean).map((b) => b.num);
    const ch = pickChange(rules(), gi, set.pool, live.map((b) => b.num), { held, rand, spares, theme: set.goals });
    if (!ch) { emit('change', { goal: gi, from: G.goals[gi].rule, to: G.goals[gi].rule, strand: [] }); return; }
    const from = G.goals[gi].rule;
    G.goals[gi].was = from; G.goals[gi].rule = ch.rule; G.goals[gi].flash = 1; G.changes++;
    const strand = live.filter((b) => ch.strand.includes(b.num));
    for (const b of strand) { b.fading = G.t; emit('fade', { ball: b.id }); deal(G.t + ROUND.fade + 0.4 + rand() * 0.8); }
    G.stranded += strand.length;
    emit('change', { goal: gi, from, to: ch.rule, strand: strand.map((b) => b.num) });
  }

  // ── the other player ────────────────────────────────────────────────────────────────────────────────────────────
  const O = G.other;
  // its pace: right balls a minute it aims for (the player's, times its share, pulled in when it leads)
  function paceNow() {
    const mins = G.t / 60, seen = mins > 0.25 ? G.score.you / mins : null;
    const yr = seen == null ? G.youRate : (G.youRate * 0.5 + seen * 0.5 * Math.min(1, mins / 1.2) + G.youRate * 0.5 * (1 - Math.min(1, mins / 1.2)));
    const gap = G.score.them - G.score.you, B = OTHER.band;
    let k = 1;
    if (gap >= B.at) k = Math.max(0.35, B.ahead - B.step * (gap - B.at));
    else if (gap <= -B.at) k = Math.min(2.2, B.behind + B.step * (-gap - B.at));
    return Math.max(1.2, yr * lv.share * k);
  }
  // a spot to jog to while it waits: somewhere near the balls and the middle, never on top of the player
  function roamSpot() {
    for (let k = 0; k < 12; k++) {
      const x = (rand() - 0.5) * 7, z = (rand() - 0.5) * 12;
      if (Math.hypot(x - G.you.x, z - G.you.z) < 2.2) continue;
      const [cx, cz] = clampIn(x, z, 0.8); return [cx, cz];
    }
    return clampIn(-G.you.x * 0.5, -G.you.z * 0.5, 0.8);
  }
  function chooseBall() {
    const cand = onCourt().filter((b) => free(b) && b !== G.you.target && !b.fading && b.p[1] < 1.6);
    if (!cand.length) return null;
    const passed = cand.filter((b) => b.passed >= OTHER.passed).sort((a, b) => b.passed - a.passed);
    if (passed.length) return passed[0];
    // the nearest, give or take (and not right under the player's nose)
    return cand.map((b) => ({ b, d: Math.hypot(b.p[0] - O.x, b.p[2] - O.z) + rand() * 2.5 + (Math.hypot(b.p[0] - G.you.x, b.p[2] - G.you.z) < 1.6 ? 4 : 0) }))
      .sort((a, b) => a.d - b.d)[0].b;
  }
  function chooseGoal(b) {
    const R = rules(), right = goalsFor(R, b.num), wrong = R.map((_, i) => i).filter((i) => !right.includes(i));
    if ((rand() < lv.acc || !wrong.length) && right.length) {
      // a right goal: the nearer one, mostly
      return right.map((i) => ({ i, d: Math.hypot(GOALS[i].mid[0] - O.x, GOALS[i].mid[1] - O.z) + rand() * 4 })).sort((a, c) => a.d - c.d)[0].i;
    }
    return pick(wrong, rand);
  }
  function moveTo(P, tx, tz, speed, dt, keepOff = null) {
    let dx = tx - P.x, dz = tz - P.z; const d = Math.hypot(dx, dz);
    let vx = 0, vz = 0;
    if (d > 0.05) { const s = Math.min(speed, d * 3); vx = dx / d * s; vz = dz / d * s; }
    // (round the player, never through them)
    if (keepOff) {
      const ox = P.x - keepOff.x, oz = P.z - keepOff.z, od = Math.hypot(ox, oz);
      if (od < OTHER.keep + 0.6 && od > 1e-3) { const push = (OTHER.keep + 0.6 - od) * 4; vx += ox / od * push; vz += oz / od * push; }
    }
    const a = 1 - Math.exp(-10 * dt);
    P.vx += (vx - P.vx) * a; P.vz += (vz - P.vz) * a;
    let nx = P.x + P.vx * dt, nz = P.z + P.vz * dt;
    [nx, nz] = clampIn(nx, nz, 0.45);
    if (keepOff) { const ox = nx - keepOff.x, oz = nz - keepOff.z, od = Math.hypot(ox, oz); if (od < OTHER.keep * 0.75 && od > 1e-3) { nx = keepOff.x + ox / od * OTHER.keep * 0.75; nz = keepOff.z + oz / od * OTHER.keep * 0.75; } }
    P.vx = (nx - P.x) / Math.max(dt, 1e-4); P.vz = (nz - P.z) / Math.max(dt, 1e-4);
    P.x = nx; P.z = nz;
    return d;
  }
  // (well behind, it hurries: runs faster and chooses quicker, a tenth more for every ball past the band's 2, at most a
  // third: so even the easier one keeps a quick player's game close)
  const hurry = () => { const gap = G.score.you - G.score.them; return gap > OTHER.band.at ? Math.min(1.35, 1 + 0.1 * (gap - OTHER.band.at + 1)) : 1; };
  function turnTo(P, h, dt, rate = 7) { const d = wrapA(h - P.heading); P.heading = wrapA(P.heading + Math.sign(d) * Math.min(Math.abs(d), rate * dt)); return Math.abs(d); }
  function otherStep(dt) {
    O.t += dt;
    const you = G.you;
    if (O.mode === 'cheer') { O.vx *= 0.8; O.vz *= 0.8; if (O.t > 1.1) { O.mode = 'roam'; O.t = 0; O.roamTo = null; } return; }
    if (O.holding) {
      // aiming: turn to the goal, then throw
      if (O.aim == null) { O.aim = chooseGoal(O.holding); O.t = 0; O.think = (OTHER.think[0] + rand() * (OTHER.think[1] - OTHER.think[0])) / hurry(); }
      const g = GOALS[O.aim], h = Math.atan2(g.mid[0] - O.x, g.mid[1] - O.z), off = turnTo(O, h, dt);
      moveTo(O, O.x, O.z, 0, dt, you);
      carry(O, O.holding);
      O.mode = O.t > O.think - 0.3 ? 'throw' : 'aim';
      if (O.t >= O.think && off < ROUND.facing) { release(O, 'them', O.aim); O.mode = 'roam'; O.t = 0; O.roamTo = null; O.thrownAt = G.t; }
      return;
    }
    // going for a ball, once its pace says it is time
    // (it sets off for a ball in time to have it in hand when its pace says: as far ahead as the run to it takes)
    if (!O.target) { const c = chooseBall(); if (c && G.t >= O.nextAt - (Math.hypot(c.p[0] - O.x, c.p[2] - O.z) / (lv.run * hurry()) + 0.35)) O.target = c; }
    if (O.target && (!free(O.target) || O.target.fading || O.target === you.target)) O.target = null;
    if (O.target) {
      const b = O.target;
      moveTo(O, b.p[0], b.p[2], lv.run * hurry(), dt, you);
      turnTo(O, Math.atan2(O.vx, O.vz), dt, 9);
      O.mode = 'fetch';
      if (Math.hypot(b.p[0] - O.x, b.p[2] - O.z) < ROUND.reach + 0.1 && b.p[1] < 1.6) {
        grab(O, 'them', b);
        // the next go: a ball in its hands again one right ball's worth of its pace from now (60 / pace seconds,
        // counting its misses as goes too)
        O.nextAt = G.t + (60 / paceNow()) * lv.acc * (0.85 + rand() * 0.3);
      }
      return;
    }
    // waiting: jogging about, turned to watch the balls and the player (never just standing)
    O.mode = 'roam';
    if (!O.roamTo || O.roamT <= 0 || Math.hypot(O.roamTo[0] - O.x, O.roamTo[1] - O.z) < 0.3) { O.roamTo = roamSpot(); O.roamT = OTHER.roam[0] + rand() * (OTHER.roam[1] - OTHER.roam[0]); }
    O.roamT -= dt;
    moveTo(O, O.roamTo[0], O.roamTo[1], 1.9, dt, you);
    // (it watches the player while they hold a ball, about to throw; else the nearest ball: so it turns as it goes,
    // sidestepping)
    const near = onCourt().filter(free).sort((a, b) => Math.hypot(a.p[0] - O.x, a.p[2] - O.z) - Math.hypot(b.p[0] - O.x, b.p[2] - O.z))[0];
    const lookAt = near && !you.holding ? near.p : [you.x, 0, you.z];
    turnTo(O, Math.atan2(lookAt[0] - O.x, lookAt[2] - O.z), dt, 3.5);
  }

  // ── the player (the page walks them; here, what they should do next) ──────────────────────────────────────────
  function youStep(dt, P) {
    const Y = G.you;
    if (P) { Y.x = P.x; Y.z = P.z; Y.vx = P.vx || 0; Y.vz = P.vz || 0; Y.heading = P.heading ?? Y.heading; }
    Y.want = { to: null, face: null, run: true };
    if (Y.holding) {
      carry(Y, Y.holding);
      if (Y.aim != null) {
        const g = GOALS[Y.aim], h = Math.atan2(g.mid[0] - Y.x, g.mid[1] - Y.z);
        Y.want.face = h;
        if (Math.abs(wrapA(h - Y.heading)) < ROUND.facing) { Y.wind += dt; if (Y.wind >= ROUND.wind) release(Y, 'you', Y.aim); }
      }
      return;
    }
    const b = Y.target;
    if (b && (!free(b) || b.fading)) { Y.target = null; return; }
    if (b) {
      Y.want.to = [b.p[0], b.p[2]];
      if (Math.hypot(b.p[0] - Y.x, b.p[2] - Y.z) < ROUND.reach && b.p[1] < 1.6) grab(Y, 'you', b);
    }
  }

  // ── the clock ───────────────────────────────────────────────────────────────────────────────────────────────────
  G.step = (dt, { eye = [0, 2.5, 9], sees = () => true, you = null } = {}) => {
    if (G.phase === 'end') { world.step(dt, { eye, sees, people: [] }); return; }
    G.t += dt;
    // new balls, as they come due (never more than the court holds)
    dealQ.sort((a, b) => a - b);
    while (dealQ.length && dealQ[0] <= G.t) { dealQ.shift(); if (onCourt().length < ROUND.most) launchOne(); }
    if (onCourt().length < ROUND.least && !dealQ.length && G.t < COURT.bar.lap - 4) deal(G.t + 0.5);
    // the bar reaching a goal: its rule changes
    for (const st of STATIONS) if (G.t >= st.t && !changed.has(st.goal)) { changed.add(st.goal); change(st.goal); }
    youStep(dt, you);
    otherStep(dt);
    // the balls (seen: in view now, for the passed-over count)
    for (const b of G.balls) b.seen = sees(b);
    world.step(dt, { eye, sees, people: [{ x: G.you.x, z: G.you.z, vx: G.you.vx, vz: G.you.vz }, { x: O.x, z: O.z, vx: O.vx, vz: O.vz }] });
    for (const b of G.balls) {
      if (b.mode === 'fly' && b.fly.t >= b.fly.T) arrive(b);
      if (b.mode === 'in' && G.t - b.inAt > 0.7) { b.mode = 'gone'; }
      if (b.fading && G.t - b.fading > ROUND.fade) b.mode = 'gone';
    }
    for (let i = G.balls.length - 1; i >= 0; i--) if (G.balls[i].mode === 'gone') world.remove(G.balls[i]);
    for (const g of G.goals) g.flash *= Math.exp(-2.2 * dt);
    // the end: the bar back over the door, and nothing still in the air
    if (G.t >= COURT.bar.lap && !G.balls.some((b) => b.mode === 'fly')) {
      G.phase = 'end';
      if (G.you.holding) G.drop();
      if (O.holding) { const b = O.holding; O.holding = null; b.mode = 'air'; b.v = [0, 0.5, 0]; }
      O.mode = G.score.them > G.score.you ? 'cheer' : 'roam'; O.t = 0;
      emit('end', { you: G.score.you, them: G.score.them });
    }
  };
  G.barS = () => barAt(G.t);
  G.next = () => {
    const st = STATIONS.find((s) => s.t > G.t);
    if (!st) return { goal: null, k: Math.min(1, (G.t - STATIONS[STATIONS.length - 1].t) / (COURT.bar.lap - STATIONS[STATIONS.length - 1].t)) };
    const prev = STATIONS.filter((s) => s.t <= G.t).pop(), t0 = prev ? prev.t : 0;
    return { goal: st.goal, k: (G.t - t0) / (st.t - t0), left: st.t - G.t };
  };
  // the player's guessed rate after this round (right balls a minute), for the next one
  G.rateAfter = () => { const mins = Math.max(0.5, Math.min(G.t, COURT.bar.lap) / 60); return Math.max(1, Math.min(20, G.youRate * 0.5 + (G.score.you / mins) * 0.5)); };
  return G;
}
