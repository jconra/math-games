// CHALLENGE ANYONE: a game of Mathball against one particular person of the station (the game's maker, 2026-11-24:
// "the idea with Mathball is that you are competing against someone ... you could challenge players that had high
// skill"; and a game against someone makes you better friends: "asking them to play a couple games of Mathball").
// On the pattern of a captain whose contract is signed ("Glad to have you, I will meet you at the ship", and they walk
// there and wait): asked, the person says yes in a bubble, walks to the arena and waits there, by the ring inside its
// door; the arena's start card has them as the one to play (with their skill), and the round is against them, in
// their own look (src/mathball/index.js). If the player never comes they give up after a while (WAIT.giveUp) and go
// on with their day; once the player has played them and leaves the arena, they go back to their day too.
// They cannot come when they are already busy in a way that keeps them (CANT): a bubble says why, in plain words.
//
//   GAME.mathball = makeChallenges({ people, jobs, player })    (src/main.js)
//     .skillOf(personId) -> 1..10       (skill.js)
//     .challenge(personId) -> true if they took it up
//     .onEnd = null | fn({ opponent, mine, theirs, won })   called as each round against them ends
//     .update(dt)    each frame (their walk, their wait, giving up)      .state()  for the rigs
//   For src/mathball/index.js: challenger() (who is waiting, as a card's opponent), challengePlayed(r), challengeLeft(id)
// The one thing it asks of src/people.js is people.send (there already): a place to go and stand, and the look there.
import { skillOf } from './skill.js';
import { COURT, SPOTS } from './court.js';

// the place they wait: on the court, a little to the side of the ring and up from it, turned to it (court metres:
// court.js, x across, z down the court to the door); giveUp: s from yes to giving up when the player never comes
// (the round against them, and the player at the arena's card, hold it off); look: m, they watch the player this near
export const WAIT = { at: [2.2, SPOTS.ring[1] - 2.5], giveUp: 180, look: 14 };
// WHAT THEY SAY (plain words)
export const SAYS = {
  yes: 'Sure! I will meet you at the arena.',
  again: 'I am on my way to the arena!',
  there: 'I am at the arena, ready when you are!',
  giveUp: 'Maybe another time. I have to get on with my day.',
  bed: 'I need to rest in my bed for now.',
  scan: 'Not now, I am in the middle of a scan.',
  ship: 'Not now, we have a run to fly. I am waiting at my ship.',
  post: { tower: 'I cannot leave the control room right now.', store: 'I cannot leave Cargo right now.' },
  busy: 'Not now, I am busy. Ask me again later!',
};

let LIVE = null;   // (the one made in the game: index.js asks it who is waiting)

export function makeChallenges({ people = () => null, jobs = null, player = () => null } = {}) {
  let C = null;   // the challenge on now: { id, P, t, there, rounds, at }
  const S = { asked: 0, yes: 0, no: 0, gaveUp: 0, ended: 0, last: null };
  const api = { skillOf: (id) => skillOf(id, findP(id)), challenge, onEnd: null, update, state };
  LIVE = api;
  function findP(id) { const pp = people(); return pp ? pp.list.find((q) => q.id === id) || null : null; }
  const arena = () => (jobs && jobs.spots ? jobs.spots.find((s) => s.job.id === 'arena') : null);
  // the place they wait, in the station (the court stands square to the station: court.js COURT.mid)
  function spot() {
    const s = arena(); if (!s) return null;
    const ring = s.pos, x = COURT.mid[0] + WAIT.at[0], z = COURT.mid[2] + WAIT.at[1];
    return { name: 'the arena', pos: ring.clone().set(x, ring.y, z), heading: Math.atan2(ring.x - x, ring.z - z) };
  }
  // they watch the player once the player is near (their eyes and head: people.js SENT's watch)
  const watch = (out) => { const B = player(); if (!B || !C || B.pos.distanceTo(C.P.pos) > WAIT.look) return false; out.set(B.pos.x, B.pos.y + 1.5, B.pos.z); return true; };
  const say = (P, words) => { const pp = people(); if (pp && P && !P.hidden && !P.away) pp.say(P, words, { kind: 'talk' }); };
  // why they cannot come now, in plain words (null: they can); '' : they cannot, and nobody sees them to say so
  function cant(P) {
    if (P.hidden) return '';                                              // (aboard a ship, out on a run, at the court already)
    if (P.home) return SAYS.post[P.home] || SAYS.busy;                    // (the control room's and Cargo's: at their posts)
    if (P.rescued && P.rescued.state !== 'about') return SAYS.bed;        // (one of the rescued, in the ward)
    if (P.act && (P.act.kind === 'scan' || P.act.kind === 'scanMedic')) return SAYS.scan;
    if (P.checkup) return SAYS.scan;                                      // (waiting their turn at the big scanner)
    if (P.cap && P.cap.meet) return SAYS.ship;                            // (a captain waiting at their ship for the player)
    if (P.scripted || P.fleeing || P.sent || (P.act && P.act.sent)) return SAYS.busy;   // (the forklift, called elsewhere)
    return null;
  }
  function challenge(id) {
    S.asked++;
    const pp = people(), P = findP(id);
    if (!pp || !pp.send || !P) { S.no++; S.last = { id, no: 'nobody' }; return false; }
    if (C && C.P === P) { say(P, C.there ? SAYS.there : SAYS.again); return true; }
    if (jobs && jobs.panel && jobs.near === 'arena') { S.no++; S.last = { id, no: 'playing' }; say(P, SAYS.busy); return false; }
    const why = cant(P);
    if (why != null) { S.no++; S.last = { id, no: why || 'out of sight' }; if (why) say(P, why); return false; }
    const s = spot();
    if (!s) { S.no++; S.last = { id, no: 'no arena' }; return false; }
    // (one challenge at a time: anyone asked before goes back to their day)
    if (C) drop('another');
    if (!pp.send(P, { spot: s, watch })) { S.no++; S.last = { id, no: 'send' }; return false; }
    C = { id, P, t: 0, there: false, rounds: 0, at: s };
    S.yes++; S.last = { id, yes: true };
    say(P, SAYS.yes);
    return true;
  }
  function drop(why) {
    const pp = people(); const P = C && C.P; C = null; S.ended++; S.last = { ...(S.last || {}), ended: why };
    if (pp && P) pp.send(P, null);
  }
  function update(dt) {
    if (!C) return;
    const P = C.P, a = P.act;
    // (at the court with the player, playing or at its cards: the wait is held)
    if (LIVE_OPEN.id === C.id) return;
    C.t += dt;
    if (!C.there && a && a.sent && a.phase === 'do' && P.pos.distanceTo(C.at.pos) < 1) C.there = true;
    // (taken off for something else meanwhile, or gone from the station: no longer)
    if (!P.hidden && !P.sent && !(a && a.sent)) { drop('elsewhere'); return; }
    if (C.t > WAIT.giveUp) { say(P, SAYS.giveUp); S.gaveUp++; drop('gave up'); }
  }
  function state() {
    return { ...S, on: C ? { id: C.id, name: C.P.name, skill: skillOf(C.id, C.P), there: C.there, t: +C.t.toFixed(1), rounds: C.rounds, act: C.P.act ? C.P.act.kind + ':' + (C.P.act.phase || '') : null, walking: !!C.P.walking, away: !!C.P.away, hidden: !!C.P.hidden, pos: C.P.pos.toArray().map((v) => +v.toFixed(2)), to: C.at.pos.toArray().map((v) => +v.toFixed(2)) } : null };
  }
  api._C = () => C;
  api._drop = drop;
  return api;
}

// ── for src/mathball/index.js ─────────────────────────────────────────────────────────────────────────────────────
const LIVE_OPEN = { id: null };
// who is waiting at the arena (on their way there, or there), as the card's opponent; null: nobody
export function challenger() {
  const C = LIVE && LIVE._C(); if (!C) return null;
  const P = C.P, def = P.def || {};
  LIVE_OPEN.id = C.id;
  return { id: C.id, name: P.name || def.name || 'Your friend', line: '', skill: skillOf(C.id, P), challenge: true, look: def.look || def.recipe || null, def };
}
// a round against them ended: the rest of the game is told (GAME.mathball.onEnd)
export function challengePlayed(r) {
  const C = LIVE && LIVE._C(); if (C && C.id === r.opponent) C.rounds++;
  if (LIVE && typeof LIVE.onEnd === 'function') { try { LIVE.onEnd(r); } catch (e) { console.warn('Mathball: onEnd', e); } }
}
// the player left the arena's game: once they have played them, the person goes back to their day; if not, they wait on
export function challengeLeft(id) {
  LIVE_OPEN.id = null;
  const C = LIVE && LIVE._C(); if (!C || C.id !== id) return;
  if (C.rounds > 0) LIVE._drop('played');
}
