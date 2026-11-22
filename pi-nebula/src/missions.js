// THE MISSIONS: crewing a captain's ship on a trip out (mining first; exploring and rescue to come). This file is the
// plain part of it, with no page and no three.js, so node can test it (pi-nebula/tests/missions.test.mjs): the
// contract and its roles, the trip's steps, what a haul the crew flew is worth and each share of it, what is kept with
// the crew member, and the payout card. In the game: src/mission.js joins it to the station (the captain, the pilot's
// seat, the smelter's controls), src/contract.js is the contract's card, and src/trip.js is the trip itself, loaded
// only when one starts.
//
// THE GAME'S MAKER (2026-11-17): "when someone is talking with a mining captain about going on a mission, the captain
// should offer you a contract. It might say '10% for piloting to location / 20% for operating the drill / 20% for
// serving as engineer' so then if the ore is worth 10000, and the contract said they get 50% of it, then they would
// make 5,000 credits. But that would involve all the work from that mission. Since the mission would probably take 10
// minutes, they should make about 1/6 of what a 50,000 ship costs, so about 8,300 credits. If they are doing a contract
// and they are only selecting to be a pilot, then it should drastically cut down the amount of time the mission takes
// (to just 2 minutes). So the whole 'drilling asteroids' and 'engineering problems' can be skipped. Maybe there can
// just be a short cut-scene of the ship doing the work and then it will be giving you a problem to calculate the jump
// to get back to the station. Then you only get 10% from the contract."
//
// A MISSION IS DATA (MISSIONS): its captain and ship, its roles and their shares, one plain line on how it pays, and
// its steps in order. Each KIND of step that is flown has one runner in src/trip.js ('leave', 'jump', 'work', 'land');
// a step names the role that does it, and a role whose game is not made yet (ROLES: `ready`) is done by the captain's
// own crew. So another captain's trip is another entry here with its own steps, and a new role's game switches on with
// its flag.
//
// THE ENGINEER'S STEP, 'tune', IS DONE ON FOOT, OUT AT THE FAR PLACE. The game's maker's first description of a
// mining run (2026-11-16): "The process repeats until your canisters are full. Then you are released back into the ship
// and if you signed up for engineering then the captain tells you the core needs to be adjusted. So you go back to
// mechanical and answer so questions there. Then you make your way back up to the pilot seat to jump the ship back
// home." And (2026-11-19): "I want the player to have to run back to mechanical and click on something (press E)", and
// "We can make the reactor need tuning before or after missions (so it isn't always the same exact sequence). This
// should be used for the explore, medical, and cargo missions too". Asked which moment he meant (2026-11-19, evening):
// "I was thinking it would be when you are at the foreign destination. So either right after you arrive at the
// asteroids, or sometime before you jump back home", and "Tune at the remote location (so its a more desperate
// situation)".
// SO a mission that lists a 'tune' step has it once a run, at the place the run goes to: ON ARRIVAL there ('arrive':
// right after the jump out, before any of the work) or BEFORE THE JUMP HOME ('leave': the work done). One or the other
// is picked as the contract is signed (pickTune: even chances) and kept with it (`tune`). The step is listed once in
// the mission's data and stepsFor puts it at this run's moment, by the run's two jumps, so nothing of it is the mining
// run's alone. The crew member gets up out of their seat there, walks back through the ship to its own core (found by
// name in the ship's blueprint: coreIn) and answers its cards; src/tune.js is that part, run by src/trip.js as one of
// the trip's own steps. The ship stays where it is meanwhile. Nothing at the station knows of it: the seat in the
// hangar starts the run as ever and the share at the smelter is as ever. With the engineer's job left to the
// captain's own crew nothing of it is seen or heard.
//
// THE MONEY (the game's maker, 2026-11-18: "It's as simple as add up what they came back with and multiply each type
// of metal with what it is worth and that's what you get paid"). What comes home is a STORE: so many tonnes of each
// metal (src/drill.js: the crew member's own drilling, or the captain's own driller working the same field by the
// same rules: the Miner's eight canisters, a tonne of ONE metal to a canister, "the canisters don't mix ore"). With
// all eight full it is whole tonnes of each metal. Headed home early, each part-full canister's level is rounded to
// the nearest 1/8 of a tonne ("to make the math easier"), and that rounded store is what is sold and paid. It sells
// for each metal's tonnes times what a tonne of it sells for, added up (src/jobs/smelter.js sellsFor, the one price
// list). The crew member's pay is their roles' shares of that, added up: the pilot's 10% of
// an 18,000 credit haul is 1,800 credits. NOTHING ELSE ENTERS IT: no answer to any card changes what comes home or
// what it sells for. The jump's three lamps only show where the pilot is in the jump (green for a card right at the
// first pick, amber after a miss). The cards on a run are not paid one by one: the share is the pay for all the work
// of the run.
//
// KEPT WITH THE CREW MEMBER (save.js keeps any field): crew.mission, one at a time:
//   { id, captain, roles: [...], state: 'signed', signed }                the contract signed, the run not flown yet
//   (signed as engineer on a mission with a 'tune' step: also `tune`: 'arrive' | 'leave', when the core's tuning comes)
//   { ..., state: 'payout', payout: { n, canisters, tonnes, lots: [{ metal, tonnes, price, pay }] (the plain sum,
//     metal by metal, the most tonnes first), sold, share, pay, at } }   home: the share waiting at the smelter's controls
// A reload in the middle of a trip finds the contract still signed. Collected, the mission is cleared and the captain
// asks again.
//
//   import { missions } from './missions.js'
//   missions.state(id, crew)         a captain's offer, for this crew member: 'new' (not asked yet) | 'asked' |
//                                    'interested' | 'declined' (this visit only), or from their contract: 'signed' |
//                                    'payout'
//   missions.answer(captain, yes)    the player's answer to a captain's offer (captain: { id, name, ship, mission })
//   missions.on(fn)                  fn(captain, yes) after it (src/mission.js opens the contract)
//                                    (there is no "shall we go now": a contract signed, the captain walks to their ship,
//                                    and the run starts when the crew member sits down in its seat)
//   missions.ready(id)               whether that captain's mission can be flown (its data is here)
import { ownOrder, earn, jobTally } from './jobs/engine.js';
import { haulOf, flownHaul, sellsFor, lotsWords, tonnesWords, inEighths, eighthsText, eighthsOf } from './jobs/smelter.js';

// ── the roles: what each does, its share of what the haul sells for (percent), whether its game is made yet (one flag:
// until then the captain's own crew member does it), and who that is ──
// (look: how the captain's crew member for a job looks aboard, a crew kit recipe as the station's people's are: src/aboard.js;
// worn as its ship's crew wear theirs, aboardOf: a crew with a standard uniform (kit/positions.js CREWS: the Medic's) in
// the role's colour, the role's id being its position; the Miner's crew in their own clothes)
export const ROLES = {
  pilot: { id: 'pilot', name: 'Pilot', does: 'piloting to the rocks and home', share: 10, ready: true, crew: 'Pilot Juno',
    look: { suit: 'atlantis2', head: 't3', hair: 'ponytail', colours: { job: 'miner', skin: '#c48a62', hair: '#2a1a12' } } },
  drill: { id: 'drill', name: 'Drill operator', does: 'operating the drill', share: 20, ready: true, crew: 'Miner Kestrel',
    look: { suit: 'smelter', head: 't6', hair: 'curlyShort', colours: { job: 'miner', skin: '#8d5a3b', hair: '#3b2a1e' } } },
  engineer: { id: 'engineer', name: 'Engineer', does: 'serving as engineer', share: 20, ready: true, crew: 'Engineer Okafor',
    look: { suit: 'atlantis1', head: 't8', hair: 'buzz', colours: { job: 'miner', uniform: '#f0892e', skin: '#47291a', hair: '#17110d' } } },
  // (the rescue run's own job: each stasis pod's lock, src/podlock.js. Not in the run yet (walking down the ramp to the
  // pods is still to come), so the captain's own medic does it)
  medic: { id: 'medic', name: 'Medic', does: 'opening the stasis pods', share: 20, ready: false, crew: 'Medic Teo',
    look: { suit: 'atlantis1', head: 't2', hair: 'coil', colours: { job: 'medic', skin: '#86522f', hair: '#17110d' } } },
};
// A ROLE AS ONE MISSION HAS IT: its own crew member for it (who does it for that captain, and how they look) and its own
// words for what it does, where the mission says (MISSIONS[..].jobs); otherwise the role as above. Its share and
// whether its game is made are the role's own, whoever's run it is.
export const roleOf = (M, id) => (M && M.jobs && M.jobs[id] ? { ...ROLES[id], ...M.jobs[id], share: ROLES[id].share, ready: ROLES[id].ready } : ROLES[id]);
const rolesFor = (M) => Object.fromEntries(Object.keys(ROLES).map((id) => [id, roleOf(M, id)]));
export const CARDS = 3;      // the cards of a jump (its three lamps: distance, charge, go)
export const LAMPS = ['Distance', 'Charge', 'Go'];

// ── the missions ──
// steps: { id, kind, role (who does it), ... }; kinds: 'leave' (flown out of the hangar and clear of the station, by
// hand or on autopilot: src/flying.js), 'jump' (the jump
// computer: `cards` cards, then the jump `to` the field or home),
// 'work' (at the field: the roles that work there, and how long the crew takes when the player has none of them),
// 'land' (home: flown in through the bay door and set down on the pad, the haul aboard),
// 'tune' (on foot, at the far place: the ship's reactor core tuned by its engineer, `cards` cards at the core; `when`:
// the moments of a run it may come at, one of them picked for each run: 'arrive', 'leave')
// (the contract's card says what the run is (`about`) and how it pays (`paid`); the share is paid at the controls of a
// station job (`payAt`: its job's id), where the payout card waits)
export const MISSIONS = {
  mining: {
    id: 'mining', captain: 'ruiz', ship: 'miner', name: 'Mining run', roles: ['pilot', 'drill', 'engineer'], payAt: 'smelter', place: 'field',
    about: 'The Miner flies out to the rocks, fills its 8 canisters with ore and comes home. Each job on the run earns a share of what the haul sells for.',
    paid: 'You are paid your share of what the haul sells for, at the smelter\'s controls, when you are back.',
    steps: [
      { id: 'out', kind: 'leave', secs: 4 },
      { id: 'jumpOut', kind: 'jump', role: 'pilot', cards: CARDS, to: 'field' },
      // (the core's tuning, out at the rocks: listed once; stepsFor puts it on arrival or before the jump home)
      { id: 'core', kind: 'tune', role: 'engineer', cards: CARDS, when: ['arrive', 'leave'] },
      { id: 'field', kind: 'work', roles: ['drill'], secs: 18 },
      { id: 'jumpHome', kind: 'jump', role: 'pilot', cards: CARDS, to: 'home' },
      { id: 'home', kind: 'land', secs: 5 },
    ],
  },
  // CAPTAIN HALE'S RESCUE RUN (the plan: ~/pw/space-math/RESCUE_PLAN.md). Out of the Medic's hangar, the jump, out of
  // the wormhole above a planet made from the run's seed (src/planet/: its ground, a crashed ship and 3 to 6 stasis pods
  // beside it, someone asleep in each), the Medic set down beside the wreck, everyone in the pods brought aboard, the
  // jump home, down in the Medic's hangar; paid so much for each person brought home (RESCUE). 'rescue': all that is
  // done at the planet, by her own crew until its parts are made (her pilot sets the Medic down, her medic opens the
  // pods and the rescued come aboard): src/rescue.js. The core's tuning is out there too, as on the mining run.
  rescue: {
    id: 'rescue', captain: 'hale', ship: 'medic', name: 'Rescue run', roles: ['pilot', 'medic', 'engineer'], payAt: 'medical', place: 'planet',
    about: 'The Medic flies out to a planet where a crew is stranded by their crashed ship, asleep in stasis pods, brings everyone aboard and comes home. Each job on the run earns a share of what the rescue pays.',
    paid: 'You are paid your share of the rescue, at the triage desk in the medical centre, when you are back.',
    // (her own crew, for the jobs left to them: their names and how they look aboard; the pilot's words for this run)
    jobs: {
      pilot: { does: 'piloting to the planet and home', crew: 'Pilot Cass', she: true, look: { suit: 'atlantis2', head: 't9', hair: 'wavy', colours: { job: 'medic', skin: '#d9a37f', hair: '#4a2f1d' } } },
      medic: { crew: 'Medic Teo', she: false },
      engineer: { crew: 'Engineer Mara', she: true, look: { suit: 'atlantis2', head: 't7', hair: 'afro', colours: { job: 'medic', skin: '#663b22', hair: '#17110d' } } },
    },
    steps: [
      { id: 'out', kind: 'leave', secs: 4 },
      { id: 'jumpOut', kind: 'jump', role: 'pilot', cards: CARDS, to: 'planet' },
      { id: 'core', kind: 'tune', role: 'engineer', cards: CARDS, when: ['arrive', 'leave'] },
      { id: 'site', kind: 'rescue', roles: ['medic'] },
      { id: 'jumpHome', kind: 'jump', role: 'pilot', cards: CARDS, to: 'home' },
      { id: 'home', kind: 'land', secs: 5 },
    ],
  },
  // (the other captains' trips go here, each its own data: exploring for Captain Vega)
};
// WHAT A RESCUE PAYS (the game's maker, 2026-11-22, RESC1-2: "It needs to be a similar payout to what a mining mission
// pays. So it would be nice to know how long it takes and use that to figure out how much it should pay. But it should
// always pay the same per person. If there are more people then that is just getting lucky."). One amount for each
// person brought home, the same on every rescue; how many there are is the planet's (3 to 6 pods: src/planet/pods.js),
// never an answer's. Set from the two runs' lengths and the mining run's pay: ~/pw/space-math/RESCUE_2.md.
export const RESCUE = { perPerson: 6000 };
MISSIONS.rescue.perPerson = RESCUE.perPerson;
// (who the jump computer's cards speak of on her run: her and her crew; src/jobs/pilot.js folkFor)
MISSIONS.rescue.folk = [{ name: 'Captain Hale', she: true }, ...Object.values(MISSIONS.rescue.jobs).map((j) => ({ name: j.crew, she: !!j.she }))];
export const missionOf = (captainId) => Object.values(MISSIONS).find((M) => M.captain === captainId) || null;

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const say = (n) => Number(n).toLocaleString('en-US');

// ── the contract ──
// the roles of a mission as the contract shows them: [{ ...role, open }], open: the player can sign for it
export const rolesOf = (M) => M.roles.map((id) => ({ ...roleOf(M, id), open: !!ROLES[id].ready }));
// the roles a crew member may sign for, of those asked (in the mission's own order); none asked: every open one
export function openRoles(M, asked = null) {
  const open = M.roles.filter((id) => ROLES[id].ready);
  return asked ? open.filter((id) => asked.includes(id)) : open;
}
// the share of a set of roles, in percent of what the haul sells for; and the pay it comes to, in whole credits
export const shareOf = (roleIds) => roleIds.reduce((s, id) => s + (ROLES[id] ? ROLES[id].share : 0), 0);
export const payOf = (sold, percent) => Math.round(sold * percent / 100);
// "Pilot", "Pilot and drill operator", "Pilot, drill operator and engineer"
export function rolesWords(roleIds) {
  const names = roleIds.map((id, i) => (i ? ROLES[id].name.toLowerCase() : ROLES[id].name));
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
// who does each role on a trip: the crew member (their name) for the roles they signed for, the captain's own crew for
// the rest (aboardOf: the crew member of his who comes along, and the captain himself)
export const crewFor = (M, mine, name = 'You', captain = null) => {
  const A = aboardOf(M, mine, captain ? { id: 'captain', name: captain } : null);
  return M.roles.map((id) => { const who = A.find((a) => a.jobs.includes(id)); return { role: id, name: mine.includes(id) ? name : who ? who.name : roleOf(M, id).crew, you: mine.includes(id) }; });
};

// WHO IS ABOARD A SHIP ON A RUN, AND WHAT EACH DOES (the game's maker, 2026-11-18: "The best scenario is that the
// captain and another crew member get on with you ... The idea is that it's a ship with a crew of 3"; and 2026-11-19:
// "if you are just an engineer, then the other 2 models can just sit in the chairs the entire time. But if you were a
// pilot, driller and engineer, then when you get up to go work in the back then you should see someone else walking,
// sitting, or laying down in the ship. Later on when you can hire crew for your own ship I want you to be able to see
// them on your ship, even if they are just along for the ride"). Besides the crew member: the captain, and one of his
// crew, the one whose job comes first of those the crew member left (the mission's own order: pilot, drill, engineer;
// all three signed for: his pilot, along for the ride). That one does that job; the captain does any other left.
// -> [{ id, name, short (the name said: 'Juno', 'Ruiz'), captain, jobs: [role ids] }]: the captain first. (Hired crew
// would be more of these, each with their own jobs or none.)
export function aboardOf(M, mine, captain = null) {
  // (the roles as this mission has them: its captain's own crew member for each)
  const ROLES = rolesFor(M);
  const left = M.roles.filter((id) => !mine.includes(id)), first = left[0] || M.roles[0];
  const crewName = ROLES[first].crew, cap = captain || { id: M.captain, name: 'The captain' };
  const short = (n) => String(n).split(' ').pop();
  return [
    { id: cap.id, name: cap.name, short: short(cap.name), captain: true, jobs: left.slice(1), look: cap.id },
    { id: 'crew-' + first, name: crewName, short: short(crewName), captain: false, jobs: left.length ? [first] : [], look: ROLES[first].look ? { ...ROLES[first].look, position: first, crew: M.ship } : null },
  ];
}

// the trip's steps for a crew member with these roles: each step, and whether it is theirs to do (`mine`: their role,
// its game made) or the crew's. `when`: this run's moment for the core's tuning ('arrive' | 'leave': tuneWhen), if the
// tuning is theirs; the 'tune' step is then among the steps, at that moment (`at`), and otherwise left out
export function stepsFor(M, mine, when = null) {
  const steps = M.steps.filter((s) => s.kind !== 'tune').map((s) => {
    const roles = s.role ? [s.role] : s.roles || [];
    return { ...s, mine: roles.some((id) => mine.includes(id) && ROLES[id].ready) };
  });
  const t = when ? tuneFor(M, mine) : null;
  if (t && (t.when || []).includes(when)) {
    // (on arrival: right after the jump out to the far place. Before leaving it: right before the jump home)
    const i = when === 'leave' ? steps.findIndex((s) => s.kind === 'jump' && s.to === 'home') : steps.findIndex((s) => s.kind === 'jump' && s.to !== 'home') + 1;
    if (i > 0) steps.splice(i, 0, { ...t, mine: true, at: when });
  }
  return steps;
}
// THE CORE'S TUNING (the top of this file). A mission's 'tune' step, if it lists one; that step for a crew member with
// these roles, if it is theirs to do; and which of its moments this run's comes at (pickTune, as the contract is signed)
export const tuneOf = (M) => (M && M.steps.find((s) => s.kind === 'tune')) || null;
export function tuneFor(M, mine) { const s = tuneOf(M); return s && mine.includes(s.role) && ROLES[s.role].ready ? s : null; }
// A SHIP'S OWN CORE, in its blueprint (kit/ships/<ship>.blueprint.json: the plan its cabin is built from): the reactor in
// its engineering room, found by name as the cabin's furnishing finds it (kit/ships/cabin-furnish.js: the room of kind
// 'engineering', its machine named a reactor, or its first machine). So every ship has its core where its own plan has
// it, and no mission says where. -> { room (the room's id), item (the reactor's), stand: [x, z] (where a person stands
// before it: a spot of the room's clear floor at least CORE.out from it, CORE.room from the room's walls and from
// everything else standing on its floor: squarely before one of its sides if any such spot is, the nearest to it,
// and of spots as near the one nearest its middle),
// look: [x, y, z] (the middle of it, y above the room's floor) }, in the ship's own frame; null: a ship with no such
// room or machine, or no floor to stand on. (src/boarding.js core puts it where the ship stands.)
export const CORE = { out: 0.45, room: 0.2, step: 0.125 };
export function coreIn(bp) {
  const room = bp && (bp.rooms || []).find((r) => r.kind === 'engineering'); if (!room) return null;
  const items = (bp.items || []).filter((it) => it.room === room.id), machines = items.filter((it) => it.kind === 'machine');
  const it = machines.find((m) => /reactor/i.test(m.name || '')) || machines[0]; if (!it) return null;
  const [X0, Z0, X1, Z1] = room.rect, mx = (it.rect[0] + it.rect[2]) / 2, mz = (it.rect[1] + it.rect[3]) / 2;
  const far = (r, x, z) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3]));      // (from a fitting's plan to a point)
  const others = items.filter((o) => o !== it && o.y == null);
  // (the spots tried: on the plan's own eighths of a metre)
  const from = (v) => Math.ceil((v + CORE.room - 1e-9) / CORE.step) * CORE.step;
  let best = null;
  for (let x = from(X0); x <= X1 - CORE.room + 1e-9; x += CORE.step) for (let z = from(Z0); z <= Z1 - CORE.room + 1e-9; z += CORE.step) {
    const d = far(it.rect, x, z); if (d < CORE.out - 1e-9 || others.some((o) => far(o.rect, x, z) < CORE.room - 1e-9)) continue;
    // (squarely before one of its sides first; then the nearest; then the nearest to its middle)
    const square = (x >= it.rect[0] && x <= it.rect[2]) || (z >= it.rect[1] && z <= it.rect[3]);
    const k = [square ? 0 : 1, Math.round(d * 1000), Math.round(Math.hypot(x - mx, z - mz) * 1000)];
    if (!best || k[0] < best.k[0] || (k[0] === best.k[0] && (k[1] < best.k[1] || (k[1] === best.k[1] && k[2] < best.k[2])))) best = { k, at: [+x.toFixed(3), +z.toFixed(3)] };
  }
  if (!best) return null;
  return { room: room.id, item: it.id, floor: room.floor || 0, stand: best.at, look: [mx, Math.min(+it.h || 1.8, 1.9) * 0.5, mz] };
}
export function pickTune(M, mine, rand = Math.random) { const s = tuneFor(M, mine), W = s ? s.when || [] : []; return W.length ? W[Math.min(W.length - 1, Math.floor(rand() * W.length))] : null; }

// ── what a run brings home ──
// what a store would sell for, and the pay of a share of it (the plain sum; the tests, the notes, the contract's card)
export function forecast({ store = {}, roles = ['pilot'] } = {}) {
  const S = sellsFor(store), share = shareOf(roles);
  return { tonnes: S.tonnes, lots: S.lots, sold: S.pay, share, pay: payOf(S.pay, share) };
}

// ── kept with the crew member ──
// their mission as kept (tidied: a mission and roles this build knows), or null
export function contractOf(crew) {
  const m = crew && crew.mission;
  if (!isObj(m) || !MISSIONS[m.id]) return null;
  const M = MISSIONS[m.id], roles = Array.isArray(m.roles) ? M.roles.filter((id) => m.roles.includes(id)) : [];
  if (!roles.length) return null;
  if (m.state === 'payout' && isObj(m.payout) && Number.isFinite(+m.payout.pay) && +m.payout.pay >= 0) return m;
  return m.state === 'signed' ? m : null;
}
// the contract signed for these roles (only roles whose game is made) -> the mission as kept, or null (none of them
// can be signed for, or another mission is still on)
// (signed as its engineer: when this run's tuning of the core comes, picked now and kept: `tune`)
export function sign(crew, missionId, roleIds, now = Date.now(), rand = Math.random, seedRand = Math.random) {
  const M = MISSIONS[missionId];
  if (!M || !crew || contractOf(crew)) return null;
  const roles = openRoles(M, roleIds);
  if (!roles.length) return null;
  const tune = pickTune(M, roles, rand);
  // (a run to a planet: which planet, its seed, picked now and kept, so a reload goes to the same one: src/planet/kinds.js
  // newSeed's own way, any seed from 1 to 999,999)
  const seed = M.place === 'planet' ? 1 + Math.floor(seedRand() * 999999) : null;
  crew.mission = { id: M.id, captain: M.captain, roles, state: 'signed', signed: now, ...(tune ? { tune } : {}), ...(seed ? { seed } : {}) };
  return crew.mission;
}
// the planet a contract's run goes to (its seed), or null (a run that goes to no planet, or no contract)
export function seedOf(crew) { const m = contractOf(crew); return m && MISSIONS[m.id].place === 'planet' ? (Number.isFinite(+m.seed) && +m.seed > 0 ? Math.floor(+m.seed) : 1) : null; }
// WHEN THE CORE'S TUNING COMES ON THIS CREW MEMBER'S RUN: 'arrive' or 'leave' (the top of this file), or null (not
// their job, or no run to fly). It is what was picked as the contract was signed.
// (CONTRACTS KEPT FROM BEFORE THE TUNING WAS MOVED OUT TO THE ROCKS, when it was done in the hangar 'before' the run or
// 'after' it: 'before' is now on arrival and 'after' before the jump home; one whose core was already tuned in the
// hangar (`tuned`) has no tuning left; one home already with its share waiting has none either, and the share is not
// held for it. A contract that names no moment this build knows gets the step's first.)
const WHEN_WAS = { before: 'arrive', after: 'leave' };
export function tuneWhen(crew) {
  const m = contractOf(crew);
  if (!m || m.state !== 'signed' || m.tuned) return null;
  const s = tuneFor(MISSIONS[m.id], m.roles), W = s ? s.when || [] : []; if (!W.length) return null;
  const w = WHEN_WAS[m.tune] || m.tune;
  return W.includes(w) ? w : W[0];
}
// home from the run: the haul's facts set for every slip about it (flownHaul: its store), and the crew member's share
// of what it sells for waiting at the smelter's controls. n: the haul's number (src/crane.js arrive); store: the
// tonnes of each metal that came home (all eight canisters full: whole tonnes; headed home early: the rounded store,
// in eighths of a tonne). -> the payout, or null (no contract signed)
// A RESCUE (a mission with `perPerson`): people, how many were brought home; the pay is so much for each of them
// (RESCUE), the crew member's share of that: { kind: 'rescue', people, per, sold (what the rescue paid), share, pay, at }
export function land(crew, { n = 0, store = {}, people = 0, now = Date.now() } = {}) {
  const m = contractOf(crew);
  if (!m || m.state !== 'signed') return null;
  const M = MISSIONS[m.id];
  if (M.perPerson) {
    const k = Math.max(0, Math.floor(+people || 0)), sold = k * M.perPerson, share = shareOf(m.roles);
    m.state = 'payout';
    m.payout = { kind: 'rescue', people: k, per: M.perPerson, sold, share, pay: payOf(sold, share), at: now };
    return m.payout;
  }
  flownHaul(n, { store });
  const H = haulOf(n), share = shareOf(m.roles);
  m.state = 'payout';
  m.payout = { n: H.n, canisters: H.canisters, tonnes: H.tonnes, lots: H.lots.map((L) => ({ metal: L.metal.name, tonnes: L.tonnes, price: L.price, pay: L.pay })), sold: H.pay, share, pay: payOf(H.pay, share), at: now };
  return m.payout;
}
// the share collected: the credits arrive as a job's pay does (the crew member's credits, a tally of its own), and the
// mission is done. -> { pay, credits } or null (nothing waiting)
export function collect(crew) {
  const m = contractOf(crew);
  if (!m || m.state !== 'payout') return null;
  const pay = Math.max(0, Math.floor(+m.payout.pay || 0));
  const credits = earn(crew, m.id, pay);
  jobTally(crew, m.id).n++;      // (the runs flown and paid)
  delete crew.mission;
  return { pay, credits };
}
// (the contract given up before the run: the rigs and the tests)
export function tearUp(crew) { if (crew) delete crew.mission; }

// ── THE PAYOUT CARD, at the smelter's controls. It shows the plain sum, as a slip: each metal that came home, its
// tonnes, what a tonne of it sells for and what that comes to; what the haul sold for; the crew member's share. Under
// it the crew member works out (or, for the youngest, counts) something of this haul that suits their own level
// there, and the pay arrives with the right answer. A miss never loses the pay.
//   grade   the school-guide point of the smelter level they are on (0 starting kindergarten .. 80 eighth grade):
//           under 20   COUNT: the canisters the crew brought home (the youngest: the four on one side of the Miner),
//                      drawn as they came home: a canister with metal in it lit, an empty one dark
//           20 to 43   ADD: what each metal sold for, added up: what the haul sold for (one metal only: its tonnes
//                      times what a tonne sold for; a part of a tonne, home early: what one part sells for, then so
//                      many of them)
//           44 to 57   A PART: their share as tenths of what it sold for (1/10 of 18,000)
//           58 on      PERCENT: their share's percent of what it sold for (10% of 18,000)
//           (from 44 on, where the share is not a whole number of credits: ADD, and the card says the pay is to the
//           nearest credit)
//   m: the crew member's mission as kept, its payout waiting (contractOf)
//   -> an order in the job panel's own shape (engine.js ownOrder), with `payout` (the pay it brings) and `form`
const CREDIT = ['credit', 'credits'], CAN = ['canister', 'canisters'];
const N = (n, unit) => ({ v: n, big: say(n), small: n === 1 ? unit[0] : unit[1], label: `${say(n)} ${n === 1 ? unit[0] : unit[1]}` });
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const payoutForm = (grade) => (grade < 20 ? 'count' : grade < 44 ? 'add' : grade < 58 ? 'part' : 'percent');
// a payout's lots (one kept from before a haul was a store of several metals: its one metal's ore, sold by the tonne)
const lotsOf = (P) => (Array.isArray(P.lots) && P.lots.length ? P.lots : [{ metal: P.metal || 'iron', tonnes: P.oreTonnes || 6, price: Math.round((P.sold || 0) / (P.oreTonnes || 6)), pay: P.sold || 0 }]);
// the slip's rows: the plain sum. ask: which row is the one asked for ('sold' or 'pay': shown as "?"), or none
export function payoutLines(P, ask = null) {
  // (a rescue's: how many came home, what each is worth, what the rescue paid, the share)
  if (P.kind === 'rescue') return [['Brought home', `${P.people} ${P.people === 1 ? 'person' : 'people'}`], ['Each person', `${say(P.per)} credits`], ['The rescue paid', ask === 'sold' ? '?' : `${say(P.sold)} credits`], ['Your share', `${P.share}%`], ['Your pay', ask ? '?' : `${say(P.pay)} credits`]];
  const lots = lotsOf(P), e = inEighths(lots);
  // (a row is one sum, kept short enough for one line on a phone: "3 tonnes × 3,000 = 9,000"; home early, an eighth
  // as a fraction: "2 5/8 tonnes × 2,000 = 5,250", "3/4 tonne × 4,000 = 3,000")
  return [...lots.map((L) => [cap(L.metal), `${e ? eighthsText(L.tonnes) : L.tonnes} ${L.tonnes === 1 || (e && L.tonnes < 1) ? 'tonne' : 'tonnes'} × ${say(L.price)} = ${say(L.pay)}`]),
    ['Sold for', ask === 'sold' ? '?' : `${say(P.sold)} credits`], ['Your share', `${P.share}%`], ['Your pay', ask ? '?' : `${say(P.pay)} credits`]];
}
// the canisters as they came home, drawn for counting: one metal to a canister, so a metal's tonnes fill that many
// canisters and its part of a tonne lies in one more; the rest came home empty -> ['full', ..., 'empty', ...]
function cansOf(P) {
  const lit = Math.min(P.canisters, lotsOf(P).reduce((a, L) => a + Math.ceil(L.tonnes - 1e-9), 0));
  return [...Array(lit).fill('full'), ...Array(P.canisters - lit).fill('empty')];
}
// A RESCUE'S PAYOUT CARD, at the triage desk: the same four forms by the same levels. COUNT the people brought home;
// TIMES, so many people at so much each (what the rescue paid); A PART and PERCENT of what the rescue paid, as a haul's
// (the forms below, in the rescue's own words). Every rescue pays a whole number of credits to every share (so much a
// person is a whole thousand), so the share is always asked.
const PEOPLE = ['person', 'people'];
function rescueOrder(m, grade, rand, paid) {
  const P = m.payout, n = P.people, per = P.per, form = payoutForm(grade), top = { from: 'Your share' };
  const done = (o) => Object.assign(o, { payout: P.pay, form });
  if (form === 'count') {
    return done(ownOrder({
      key: 'payout:people',
      story: `Your crew is home. The rescue paid ${say(P.sold)} credits. Your share is ${say(P.pay)} credits.`,
      ask: 'How many people did your crew bring home?',
      right: N(n, PEOPLE),
      slips: [
        { ...N(n + 1, PEOPLE), slip: 'off', why: 'One too many. Count again, touching each one once.' },
        { ...N(n - 1, PEOPLE), slip: 'off', why: 'One short. Count again, touching each one once.' },
        { ...N(n + 2, PEOPLE), slip: 'off', why: 'Too many. Count again, touching each one once.' },
      ],
      rightWhy: `${say(n)} people. ${paid}`,
      lines: payoutLines(P),
      picFirst: true, help: { title: 'Count them', pic: { kind: 'people', n }, line: 'Touch each person once as you count: 1, 2, 3 ...' },
      own: { strand: 'number', at: 6 }, facts: { ...top, form, n, pay: P.pay },
    }, rand, 3));
  }
  if (form === 'add') {
    // (so many people at so much each: the rescue's pay)
    return done(ownOrder({
      key: 'payout:perPerson',
      story: `Your crew is home with ${n} people from the pods. The rescue pays ${say(per)} credits for each person.`,
      ask: 'How many credits did the rescue pay?',
      right: N(P.sold, CREDIT),
      slips: [
        { ...N(per, CREDIT), slip: 'one', why: `${say(per)} credits is for one person. There are ${n} people.` },
        { ...N(per + n, CREDIT), slip: 'added', why: `That adds the people to the pay. Each person is ${say(per)} credits: multiply.` },
        { ...N(P.sold + per, CREDIT), slip: 'groupOff', why: `That is one person too many. There are ${n} people.` },
        { ...N(P.sold - per, CREDIT), slip: 'groupOff', why: `That is one person short. There are ${n} people.` },
      ].filter((s) => s.v > 0),
      rightWhy: `${n} × ${say(per)} = ${say(P.sold)} credits. ${paid}`,
      sum: { op: 'mul', a: n, b: per },
      lines: payoutLines(P, 'sold'),
      help: { title: 'Person by person', pic: { kind: 'people', n }, line: `Each person brought home is ${say(per)} credits: ${n} lots of ${say(per)}.`, steps: [`${n} lots of ${say(per)}: ${n} × ${say(per)}`] },
      own: { strand: 'words', at: 26 }, facts: { ...top, form, n, per, pay: P.pay },
    }, rand));
  }
  return null;
}
export function payoutOrder(m, grade = 0, rand = Math.random) {
  const P = m.payout, who = rolesWords(m.roles), tenths = P.share / 10, lots = P.kind === 'rescue' ? [] : lotsOf(P);
  // (what the whole came to, in its own words: a haul sold, a rescue paid)
  const SOLD = P.kind === 'rescue' ? 'The rescue paid' : 'The haul sold for';
  if (P.kind === 'rescue') { const r = rescueOrder(m, grade, rand, `Your share, ${P.share}%, is ${say(P.pay)} credits.`); if (r) return r; }
  // (A HALF CREDIT: a haul headed home early can sell for an odd 125 credits (1/8 of a tonne of nickel is 375), and a
  // tenth of that is not a whole credit. The pay is in whole credits, as it always was (payOf: to the nearest one), the
  // card says so, and it asks what the haul sold for rather than a share that does not come out whole)
  const even = Number.isInteger(P.sold * P.share / 100), form = even || payoutForm(grade) === 'count' ? payoutForm(grade) : 'add';
  const top = { from: 'Your share' };
  const done = (o) => Object.assign(o, { payout: P.pay, form });
  // (what the right answer's line says: the pay, in every form)
  const paid = `Your share, ${P.share}%, is ${say(P.pay)} credits${even ? '' : ', to the nearest credit'}.`;
  const home = lots.length ? `Your crew is home with ${lotsWords(lots)}` : 'Your crew is home';
  if (form === 'count') {
    // (the youngest: one side of the Miner, four canisters; a little older: all eight)
    const side = grade < 6, n = side ? P.canisters / 2 : P.canisters, cans = cansOf(P), allFull = P.tonnes >= P.canisters;
    return done(ownOrder({
      key: `payout:count:${side ? 'side' : 'all'}`,
      // (a question is told in canisters or in tonnes, never both: this one counts canisters, so its story does too)
      story: `Your crew is home${allFull ? ' with its canisters full' : ''}. The haul sold for ${say(P.sold)} credits. Your share is ${say(P.pay)} credits${even ? '' : ', to the nearest credit'}.`,
      ask: side ? 'How many canisters are on this side of the Miner?' : 'How many canisters did your crew bring home?',
      right: N(n, CAN),
      slips: [
        { ...N(n + 1, CAN), slip: 'off', why: 'One too many. Count again, touching each one once.' },
        { ...N(n - 1, CAN), slip: 'off', why: 'One short. Count again, touching each one once.' },
        { ...N(n + 2, CAN), slip: 'off', why: 'Too many. Count again, touching each one once.' },
      ],
      rightWhy: `${say(n)} canisters. ${paid}`,
      lines: payoutLines(P),
      picFirst: true, help: { title: 'Count them', pic: { kind: 'cans', place: side ? 'row' : 'ship', slots: cans.slice(0, n) }, line: 'Touch each canister once as you count: 1, 2, 3 ...' },
      own: { strand: 'number', at: side ? 0 : 6 }, facts: { ...top, form, n, pay: P.pay },
    }, rand, 3));
  }
  if (form === 'add' && lots.length > 1) {
    // (what each metal sold for, added up)
    const pays = lots.map((L) => L.pay), step = Math.max(...lots.map((L) => L.price));
    const chain = pays.slice(1).map((p, i) => ({ op: 'add', a: pays.slice(0, i + 1).reduce((x, y) => x + y, 0), b: p, say: i ? 'Then the next' : 'First two of them' }));
    return done(ownOrder({
      key: 'payout:add',
      story: `${home}.`,
      ask: 'How many credits did the haul sell for?',
      right: N(P.sold, CREDIT),
      slips: [
        { ...N(pays[0], CREDIT), slip: 'part', why: `That is only the ${lots[0].metal}. Add what the ${lots.length === 2 ? lots[1].metal : 'others'} sold for.` },
        { ...N(P.sold - pays[pays.length - 1], CREDIT), slip: 'part', why: `That leaves out the ${lots[lots.length - 1].metal}. Add every metal.` },
        { ...N(P.sold + step, CREDIT), slip: 'off', why: 'That is too much. Add them again, the thousands first.' },
        { ...N(P.sold + 1000, CREDIT), slip: 'off', why: 'A thousand too many. Add them again, the thousands first.' },
        ...(P.sold > 1000 ? [{ ...N(P.sold - 1000, CREDIT), slip: 'off', why: 'A thousand short. Add them again, the thousands first.' }] : []),
      ],
      rightWhy: `${pays.map(say).join(' + ')} = ${say(P.sold)} credits. ${paid}`, sum: chain.length === 1 ? chain[0] : chain,
      lines: payoutLines(P, 'sold'),
      help: { title: 'Metal by metal', line: 'The haul sold for what each of its metals sold for, added up.', steps: [pays.map(say).join(' + ')] },
      own: { strand: 'add', at: 30 }, facts: { ...top, form, sold: P.sold, pay: P.pay }, size: Math.min(3, lots.length - 1),
    }, rand));
  }
  if (form === 'add') {
    // (one metal: its tonnes times what a tonne of it sold for; with a part of a tonne, home early: what one part
    // of a tonne sold for, then so many of them: 2 5/8 tonnes are 21 eighths)
    const L = lots[0], t = L.tonnes, per = L.price, whole = Number.isInteger(t), e = inEighths(lots), f = e && !whole ? eighthsOf(t) : null, tw = (x) => tonnesWords(x, e), ts = e ? eighthsText(t) : say(t);
    return done(ownOrder({
      key: 'payout:times',
      story: `${home}. Each tonne of ${L.metal} sold for ${say(per)} credits.`,
      ask: 'How many credits did the haul sell for?',
      right: N(P.sold, CREDIT),
      slips: [
        { ...N(per, CREDIT), slip: 'one', why: `${say(per)} credits is what one tonne sold for. There ${t <= 1 ? 'is' : 'are'} ${tw(t)}.` },
        { ...N(per + Math.round(t), CREDIT), slip: 'added', why: `That adds the tonnes to the price. Every tonne sold for ${say(per)} credits: multiply.` },
        { ...N(P.sold + per, CREDIT), slip: 'groupOff', why: `That is a tonne too many. There ${t <= 1 ? 'is' : 'are'} ${tw(t)}.` },
        ...(P.sold - per > 0 ? [{ ...N(P.sold - per, CREDIT), slip: 'groupOff', why: `That is a tonne short. There ${t <= 1 ? 'is' : 'are'} ${tw(t)}.` }] : []),
      ],
      rightWhy: f ? `1/${f.d} of a tonne sold for ${say(per)} ÷ ${f.d} = ${say(per / f.d)}; ${f.n} × ${say(per / f.d)} = ${say(P.sold)} credits. ${paid}` : `${ts} × ${say(per)} = ${say(P.sold)} credits. ${paid}`,
      sum: f ? [{ op: 'div', a: per, b: f.d, say: `First what 1/${f.d} of a tonne sold for` }, { op: 'mul', a: f.n, b: per / f.d, say: `Then ${tw(t)} ${f.n === 1 ? 'is one of those' : `${t > 1 ? 'are' : 'is'} ${f.n} of those`}` }] : { op: 'mul', a: t, b: per },
      lines: payoutLines(P, 'sold'),
      help: { title: 'Tonne by tonne', ...(whole && t <= 8 ? { pic: { kind: 'tonnes', n: t, price: per } } : {}),
        line: f ? `Every tonne of ${L.metal} sold for ${say(per)} credits, so 1/${f.d} of a tonne sold for ${say(per)} ÷ ${f.d}. ${cap(tw(t))} ${t > 1 ? 'are' : 'is'} ${f.n} of those.` : `Every tonne of ${L.metal} sold for ${say(per)} credits: ${ts} lots of ${say(per)}.`,
        steps: f ? [`1/${f.d} of a tonne: ${say(per)} ÷ ${f.d}`, `${f.n} of those: that × ${f.n}`] : [`${ts} lots of ${say(per)}: ${ts} × ${say(per)}`] },
      own: { strand: 'words', at: 26 }, facts: { ...top, form, t, per, pay: P.pay }, ...(f ? { size: 2 } : {}),
    }, rand));
  }
  const one = P.sold / 10;   // (a tenth of what it sold for: every share is so many tenths)
  if (form === 'part') {
    const half = tenths === 5, frac = half ? '1/2' : `${tenths}/10`;
    return done(ownOrder({
      key: 'payout:part',
      story: `${SOLD} ${say(P.sold)} credits. Your share is ${frac} of it.`,
      ask: 'How many credits is your share?',
      right: N(P.pay, CREDIT),
      slips: [
        { ...N(P.sold - P.pay, CREDIT), slip: 'rest', why: `That is the rest of it, the crew's and the captain's. Your share is ${frac} of the ${say(P.sold)} credits.` },
        ...(tenths > 1 && !half ? [{ ...N(one, CREDIT), slip: 'onePart', why: `${say(one)} credits is one tenth. Your share is ${tenths} tenths.` }] : []),
        { ...N(P.sold / 100, CREDIT), slip: 'tooSmall', why: `That cuts the ${say(P.sold)} credits into 100 parts. ${half ? 'A half is 2 equal parts.' : 'Tenths are 10 equal parts.'}` },
        { ...N(half ? P.sold / 4 : P.pay + one, CREDIT), slip: 'partOff', why: half ? 'That is a quarter. A half is one of 2 equal parts.' : `That is ${tenths + 1} tenths. Your share is ${tenths}.` },
        { ...N(P.sold - 10, CREDIT), slip: 'subtracted', why: `That takes 10 away. Cut the ${say(P.sold)} credits into ${half ? 2 : 10} equal parts instead.` },
        { ...N(P.pay + 1000, CREDIT), slip: 'off', why: 'A thousand too many. Work it out again.' },
      ].filter((s) => Number.isInteger(s.v)),
      rightWhy: half ? `${say(P.sold)} ÷ 2 = ${say(P.pay)} credits` : tenths === 1 ? `${say(P.sold)} ÷ 10 = ${say(P.pay)} credits` : `One tenth is ${say(P.sold)} ÷ 10 = ${say(one)}; ${tenths} tenths are ${tenths} × ${say(one)} = ${say(P.pay)} credits`,
      sum: half ? { op: 'div', a: P.sold, b: 2 } : tenths === 1 ? { op: 'div', a: P.sold, b: 10 } : [{ op: 'div', a: P.sold, b: 10, say: 'First one tenth of it' }, { op: 'mul', a: one, b: tenths, say: `Then ${tenths} tenths` }],
      lines: [...payoutLines(P, 'pay').slice(0, -2), ['Your share', `${frac} of it`], ['Your pay', '?']],
      help: { title: 'Cut into equal parts', pic: { kind: 'sharebar', whole: P.sold, n: half ? 1 : tenths, d: half ? 2 : 10 },
        line: half ? `A half means the ${say(P.sold)} credits cut into 2 equal parts, and one of them yours.` : `${frac} means the ${say(P.sold)} credits cut into 10 equal parts, and ${tenths === 1 ? 'one of them' : `${tenths} of them`} yours.`,
        steps: half ? [`One of the 2 equal parts: ${say(P.sold)} ÷ 2`] : tenths === 1 ? [`One of the 10 equal parts: ${say(P.sold)} ÷ 10`] : [`First one tenth: ${say(P.sold)} ÷ 10`, `Then ${tenths} tenths: that × ${tenths}`] },
      own: { strand: 'frac', at: 40 }, facts: { ...top, form, sold: P.sold, share: P.share, pay: P.pay }, size: tenths > 1 && !half ? 2 : 1,
    }, rand));
  }
  return done(ownOrder({
    key: 'payout:percent',
    story: `${SOLD} ${say(P.sold)} credits. Your contract pays you ${P.share}% of it.`,
    ask: 'How many credits is your pay?',
    right: N(P.pay, CREDIT),
    slips: [
      { ...N(P.sold - P.pay, CREDIT), slip: 'rest', why: `That is the other ${100 - P.share}%: the crew's and the captain's.` },
      { ...N(P.share, CREDIT), slip: 'percentCount', why: `${P.share}% isn't ${P.share} credits. It means ${P.share} out of every 100: 10% of ${say(P.sold)} is ${say(one)}.` },
      ...(tenths > 1 ? [{ ...N(one, CREDIT), slip: 'tenOnly', why: `${say(one)} credits is 10%. ${P.share}% is ${tenths} lots of that.` }] : [{ ...N(P.sold / 100, CREDIT), slip: 'onePercent', why: `That is 1%: one part in 100. 10% is one part in 10.` }]),
      { ...N(P.pay + one, CREDIT), slip: 'tenOff', why: `That is 10% too much: ${P.share + 10}%.` },
      { ...N(P.pay / 2, CREDIT), slip: 'half', why: `That is ${P.share / 2}%, half of your share.` },
      { ...N(P.pay + 1000, CREDIT), slip: 'off', why: 'A thousand too many. Work it out again.' },
    ].filter((s) => Number.isInteger(s.v)),
    rightWhy: tenths === 1 ? `10% of ${say(P.sold)} is ${say(P.sold)} ÷ 10 = ${say(P.pay)} credits` : `10% of ${say(P.sold)} is ${say(one)}, so ${P.share}% is ${tenths} × ${say(one)} = ${say(P.pay)} credits`,
    sum: tenths === 1 ? { op: 'div', a: P.sold, b: 10, say: '10% is a tenth of it' } : [{ op: 'div', a: P.sold, b: 10, say: 'First 10%: a tenth of it' }, { op: 'mul', a: one, b: tenths, say: `Then ${P.share}% is ${tenths} lots of 10%` }],
    lines: [...payoutLines(P, 'pay').slice(0, -2), ['Your share', `${who}: ${P.share}%`], ['Your pay', '?']],
    help: { title: 'Ten percent first', pic: { kind: 'sharebar', whole: P.sold, n: tenths, d: 10, pct: true },
      line: `10% is one part in ten. Find 10% of the ${say(P.sold)} credits${tenths === 1 ? '' : `, then take ${tenths} lots of it`}.`,
      steps: tenths === 1 ? [`10% of it: ${say(P.sold)} ÷ 10`] : [`First 10%: ${say(P.sold)} ÷ 10`, `Then ${P.share}%: that × ${tenths}`] },
    own: { strand: 'pct', at: 58 }, facts: { ...top, form, sold: P.sold, share: P.share, pay: P.pay }, size: tenths > 1 ? 2 : 1,
  }, rand));
}

// ── the captains' offers, this visit, and the crew member's own contract ──
function makeMissions() {
  const states = new Map(), fns = [];
  const tell = (list, captain, yes) => { for (const f of list) { try { f(captain, yes); } catch (e) { console.error(e); } } };
  return {
    state(id, crew = null) { const m = crew ? contractOf(crew) : null; return m && m.captain === id ? m.state : states.get(id) || 'new'; },
    asked(id) { if (!states.has(id)) states.set(id, 'asked'); },
    answer(captain, yes) { states.set(captain.id, yes ? 'interested' : 'declined'); tell(fns, captain, yes); },
    // (the contract's card put away unsigned: the offer stays open, and the captain asks again another time)
    declined(id) { states.set(id, 'declined'); },
    on(fn) { fns.push(fn); },
    ready: (id) => !!missionOf(id),
  };
}
export const missions = makeMissions();
