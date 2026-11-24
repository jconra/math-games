// CHALLENGE ANYONE (src/mathball/challenge.js): asked, a person says yes and is sent to wait at the arena; the card's
// opponent is them at their own skill; a round's end calls onEnd with the scores; leaving after a game sends them back
// to their day; never coming, they give up; busy, they say why and do not come. A stand-in station: people with the
// few things challenge.js reads, and a people.send/say that write down what was asked of them.
//   node --test pi-nebula/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeChallenges, challenger, challengePlayed, challengeLeft, WAIT, SAYS } from '../src/mathball/challenge.js';
import { skillOf } from '../src/mathball/skill.js';

// a point, as much of THREE.Vector3 as is used
const V = (x, y, z) => ({ x, y, z, clone() { return V(this.x, this.y, this.z); }, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; }, distanceTo(o) { return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); }, toArray() { return [this.x, this.y, this.z]; } });
function station() {
  const said = [], sent = [];
  const mk = (id, name, more = {}) => ({ id, name, def: { id, name, look: 'look-' + id }, pos: V(0, 0, 30), act: { kind: 'stand', phase: 'do' }, ...more });
  const list = [mk('medic', 'Ana'), mk('cook', 'Bo'), mk('radio-rhea', 'Rhea', { home: 'tower' }), mk('rescued-1', '', { rescued: { state: 'bed', look: 'sleeper-3' } }),
    mk('hale', 'Captain Hale', { cap: { meet: () => null } }), mk('guard', 'Tess', { act: { kind: 'scan', phase: 'do' } }), mk('vega', 'Captain Vega', { hidden: true })];
  const people = {
    list, said, sent,
    say: (P, w) => said.push([P.id, w]),
    send: (P, what) => { sent.push([P.id, what ? what.spot.name : null]); P.sent = what || null; if (what) P.act = { kind: 'stand', phase: 'go', sent: true, spot: what.spot }; else P.act = { kind: 'sit', phase: 'go' }; return true; },
  };
  const jobs = { spots: [{ job: { id: 'arena' }, pos: V(8, 0, 18.9) }], panel: null, near: null };
  const G = makeChallenges({ people: () => people, jobs, player: () => ({ pos: V(8, 0, 25) }) });
  // (the walk there: they arrive)
  const arrive = (P) => { P.pos = P.act.spot.pos.clone(); P.act.phase = 'do'; P.sent = null; };
  return { G, people, jobs, arrive, P: (id) => list.find((q) => q.id === id) };
}

test('challenged, a person says yes, is sent to the arena and waits there; the card has them at their own skill', () => {
  const { G, people, arrive, P } = station();
  assert.equal(G.skillOf('medic'), skillOf('medic'));
  assert.equal(G.challenge('medic'), true);
  assert.deepEqual(people.said.at(-1), ['medic', SAYS.yes]);
  assert.deepEqual(people.sent.at(-1), ['medic', 'the arena']);
  // (the place they wait: on the court by the ring, turned to it)
  const s = P('medic').act.spot;
  assert.ok(Math.hypot(s.pos.x - 8, s.pos.z - 18.9) < 4, 'near the ring');
  G.update(1); arrive(P('medic')); G.update(1);
  assert.equal(G.state().on.there, true);
  const C = challenger();
  assert.equal(C.id, 'medic'); assert.equal(C.name, 'Ana'); assert.equal(C.skill, skillOf('medic')); assert.equal(C.challenge, true); assert.equal(C.look, 'look-medic');
  // (asked again: still on)
  assert.equal(G.challenge('medic'), true);
  assert.deepEqual(people.said.at(-1), ['medic', SAYS.there]);
});

test('a round against them calls onEnd with the scores; leaving after a game sends them back to their day', () => {
  const { G, people, arrive, P } = station();
  const ends = []; G.onEnd = (r) => ends.push(r);
  G.challenge('cook'); arrive(P('cook'));
  challenger();                                  // (the arena's game opened with them: the wait is held)
  for (let i = 0; i < 400; i++) G.update(1);     // (well past giving up: they do not, while the game is open)
  assert.ok(G.state().on, 'still on while the player is at the game');
  challengePlayed({ opponent: 'cook', mine: 9, theirs: 7, won: true });
  assert.deepEqual(ends, [{ opponent: 'cook', mine: 9, theirs: 7, won: true }]);
  challengeLeft('cook');
  assert.equal(G.state().on, null);
  assert.deepEqual(people.sent.at(-1), ['cook', null]);
});

test('left without a game, they wait on; never coming, they give up and go on with their day', () => {
  const { G, people, arrive, P } = station();
  G.challenge('medic'); arrive(P('medic'));
  challenger(); challengeLeft('medic');           // (the card looked at, Leave: no game yet)
  assert.ok(G.state().on);
  for (let t = 0; t < WAIT.giveUp - 5; t++) G.update(1);
  assert.ok(G.state().on, 'still waiting');
  for (let t = 0; t < 10; t++) G.update(1);
  assert.equal(G.state().on, null);
  assert.equal(G.state().gaveUp, 1);
  assert.deepEqual(people.said.at(-1), ['medic', SAYS.giveUp]);
  assert.deepEqual(people.sent.at(-1), ['medic', null]);
});

test('they cannot come when busy: a bubble says why in plain words, and challenge() is false', () => {
  const { G, people } = station();
  const no = (id, words) => { const n = people.said.length; assert.equal(G.challenge(id), false, id); if (words) assert.deepEqual(people.said.at(-1), [id, words]); else assert.equal(people.said.length, n, id + ' said nothing'); };
  no('radio-rhea', SAYS.post.tower);    // (at their post in the control room)
  no('rescued-1', SAYS.bed);            // (in a ward bed)
  no('hale', SAYS.ship);                // (a captain waiting at their ship for the player's run)
  no('guard', SAYS.scan);               // (on the scanner)
  no('vega', null);                     // (out of the station: aboard a ship, on a run)
  no('nobody', null);
  assert.equal(G.state().on, null);
});

test('one challenge at a time: asking another sends the first back to their day', () => {
  const { G, people } = station();
  G.challenge('medic'); G.challenge('cook');
  assert.equal(G.state().on.id, 'cook');
  assert.ok(people.sent.some(([id, w]) => id === 'medic' && w === null));
});
