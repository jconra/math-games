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
// A RUN OF YOUR OWN, IN A SHIP YOU BOUGHT (src/own.js has the game's maker's words and the prices). It is the same run,
// started from the ship's own pilot's seat (the Hauler's at the shipping computer, where its load is worked out), and
// kept the same way: crew.mission with `own: true` and `crew` (who of your own crew is aboard, and the jobs they do):
//   - EACH OF ITS THREE JOBS IS YOURS OR ONE OF YOUR CREW'S (signOwn; your crew: those who agreed to join it, src/own.js
//     crewOf). The game's maker, 2026-11-24: "If you want to go on a mission and you have people who have agreed to be
//     your crew then you should be able to ask them if they want to be a Pilot, Engineer, or Mission Work. I suspect
//     most players will just want to do everything themselves, and the crew will just be along for the ride, which is
//     completely fine. If you ask your crew to do all the jobs then I think you should only be able to make 20-30% of
//     the profit." With no crew all three are yours. All three may be your crew's: you ride along and are asked nothing
//     until the pay. Your other crew may come along for the ride, as many as the ship has room for (src/own.js SEATS),
//     and take no share. (There are no hired hands any more: "just the friend mechanic will be fine".)
//   - WHAT THE RUN BRINGS (shareFor, ownPart): THE OPERATING COSTS, OPS.pct (25%), always ("I think operating costs
//     should always be taken out ... So as a captain yourself, if you do all the work now you can make 75%"; he named
//     them "fuel, maintenance, insurance": one row); each job one of your crew does, that job's own share (ROLES: 10% or
//     20%, as a contract pays it); the rest yours: 75% doing all three, down to 25% with your crew doing all three. Every
//     part in whole credits, yours what is left, so the parts add up to what the run brought to the credit.
//   - HOME, THE PAY SLIP (ownPayOrder) shows the operating costs, your crew's pay and yours, and its question is about
//     paying your crew ("you still have to do a math question about paying the crew at the end"), or, with none of
//     them paid, about the operating costs; at the crew member's level, as every slip's question is.
//   - THE CAPTAIN IS NOT ABOARD (aboardOf `own`): he stays in the station, offering his contracts as ever. Aboard are
//     you and your crew who came, each seen in their own look, doing their job or along for the ride, and none of them
//     seen in the station meanwhile. The few words that guide the run are the ship's own.
//   - A RUN MADE AND PAID RAISES FRIENDSHIP (collect): everyone who was aboard goes up one pip ("if you work for a
//     captain than everyone on that mission goes up a point (or if you are the captain too)"): on a captain's contract
//     the captain and the crew member of his who came; on a run of your own your crew who came. A run given up adds
//     nothing.
//   - YOUR OWN JOBS ASK ABOUT HALF AS MANY CARDS AGAIN (stepsFor `own`, src/own.js moreCards; more cards, never harder
//     ones; a job your crew does asks you nothing, as on a contract). Exactly where, for each job of each run:
//       PILOT (all four runs)     each jump's cards: 5 for the first jump of the run, 4 for the next, 5, 4 ... (a
//                                 contract: 3 each). The Miner's, the Medic's and the Hauler's two jumps: 5 out, 4 home,
//                                 9 for 6. The Explorer's: 5, 4, 5 ... through its 1 to 3 jumps out and the jump home.
//                                 The jump still has its three lamps: a lamp with two cards lights at its second
//                                 (lampPlan). The Medic's one card at the planet (the sensors find the wreck) stays one.
//       ENGINEER (all four)       the core's tuning: 5 cards (a contract: 3).
//       DRILL OPERATOR (Miner)    the rock scan as each rock is taken: 2 cards at the first rock, 1 at the second, 2 at
//                                 the third ... (a contract: 1 a rock). (rockCards)
//       PARAMEDIC (Medic)         the pods' locks: 2 locks on pod 1, 1 on pod 2, 2 on pod 3 ... (a contract: 1 a pod).
//       SENSOR OPERATOR (Explorer) the scan at each place: 5 cards at the first place, 4 at the second, 5 at the third
//                                 (a contract: 3 each).
//       LOADMASTER (Hauler)       the shipping computer: 8 questions (a contract: 5): the five that work out the load,
//                                 then the first three of the next load's (src/jobs/cargolink.js).
//   - JUST FLYING (src/trip.js `free`, freeFlight below) is no run: nothing is signed, asked or paid.
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
import { EXPLORE } from './exploreplan.js';
import { owns, moreCards, SHIP_NAMES, crewOf, SEATS } from './own.js';
import { add as addPips } from './friends.js';
import { HAULER_CAPTAIN } from './life.js';

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
  // (the rescue run's own job, the paramedic's (the game's maker, 2026-11-22, RESC3-1: "The medical one can be the
  // paramedic ... For the paramedic the questions are to open the pods"): down the Medic's ramp to the stasis pods and
  // each pod's lock, src/podlock.js, at the planet: src/rescue.js. Its id stays 'medic', as contracts already kept name it)
  medic: { id: 'medic', name: 'Paramedic', does: 'opening the stasis pods', share: 20, ready: true, crew: 'Paramedic Teo',
    look: { suit: 'atlantis1', head: 't2', hair: 'coil', colours: { job: 'medic', skin: '#86522f', hair: '#17110d' } } },
  // (the exploring run's own job: the sensor operator's scan at the Explorer's survey table, src/jobs/survey.js; the
  // game's maker, RESC3-1: "For the explorer the 3rd job is the sensor operator, to help find the next location to jump
  // to and discover the secrets (detect radio signals, scan asteroid fields, detect mysterious gravity)")
  sensor: { id: 'sensor', name: 'Sensor operator', does: 'scanning for where to go next', share: 20, ready: true, crew: 'Sensor operator Arlo',
    look: { suit: 'civilian', head: 't10', hair: 'crop', colours: { job: 'explorer', skin: '#e0b08f', hair: '#5a3a22' } } },
  // (the supply run's own job, THE LOADMASTER'S (the game's maker, 2026-11-23, HAUL1-2 B: "Loadmaster"; its id stays
  // 'cargo', as contracts already kept name it): working out how much to pack at the shipping computer and loading the
  // pallets with the forklift, in Cargo before the Hauler leaves: the cargo game, src/supplyrun.js, src/jobs/cargo.js;
  // the game's maker, STA2-5: "you go to the computer, do the questions to calculate out how much of the supplies you
  // need to pack ... Then you go get in the forklift and load some pallets onto the containers")
  cargo: { id: 'cargo', name: 'Loadmaster', does: 'working out and loading the supplies', share: 20, ready: true, crew: 'Loadmaster Hob',
    look: { suit: 'smelter', head: 't2', hair: 'coil', colours: { job: 'hauler', skin: '#86522f', hair: '#17110d' } } },
};
// A ROLE AS ONE MISSION HAS IT: its own crew member for it (who does it for that captain, and how they look) and its own
// words for what it does, where the mission says (MISSIONS[..].jobs); otherwise the role as above. Its share and
// whether its game is made are the role's own, whoever's run it is.
export const roleOf = (M, id) => (M && M.jobs && M.jobs[id] ? { ...ROLES[id], ...M.jobs[id], share: ROLES[id].share, ready: ROLES[id].ready } : ROLES[id]);
const rolesFor = (M) => Object.fromEntries(Object.keys(ROLES).map((id) => [id, roleOf(M, id)]));
export const CARDS = 3;      // the cards of a jump (its three lamps: distance, charge, go)
export const LAMPS = ['Distance', 'Charge', 'Go'];
// A JUMP OF MORE THAN THREE CARDS (a run of your own: OWN RUNS above) still has its three lamps: the cards are shared
// out among them, the first lamps taking the odd ones (4 cards: 2, 1, 1; 5: 2, 2, 1), and a lamp lights with the last
// of its cards. lampPlan(n): how many cards each lamp takes; lampAt(i, n): the lamp the i-th card (from 0) belongs to
export const lampPlan = (n) => LAMPS.map((_, k) => Math.floor(n / LAMPS.length) + (k < n % LAMPS.length ? 1 : 0));
export function lampAt(i, n) { const P = lampPlan(n); let k = 0, at = 0; while (k < P.length - 1 && i >= at + P[k]) { at += P[k]; k++; } return k; }
// (the drill operator's rock scans and the paramedic's locks on a run of your own: how many at the k-th rock or pod, from 0)
export const rockCards = (k) => moreCards(1, k);

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
  // jump home, down in the Medic's hangar; paid so much for each person brought home (RESCUE). Its three jobs (the
  // game's maker, 2026-11-22, RESC3-1: "all the missions should have pilot and engineer. The medical one can be the
  // paramedic"): 'rescue' is all that is done at the planet, src/rescue.js: the pilot's way down to the wreck (the
  // sensors' card, then flying down) and the paramedic's pods (each one's lock); the rescued come aboard by themselves.
  // The core's tuning is out there too, as on the mining run.
  rescue: {
    id: 'rescue', captain: 'hale', ship: 'medic', name: 'Rescue run', roles: ['pilot', 'medic', 'engineer'], payAt: 'medical', place: 'planet',
    about: 'The Medic flies out to a planet where a crew is stranded by their crashed ship, asleep in stasis pods, brings everyone aboard and comes home. Each job on the run earns a share of what the rescue pays.',
    paid: 'You are paid your share of the rescue, at the triage desk in the medical centre, when you are back.',
    // (her own crew, for the jobs left to them: their names and how they look aboard; the pilot's words for this run)
    jobs: {
      pilot: { does: 'piloting to the planet and home', crew: 'Pilot Cass', she: true, look: { suit: 'atlantis2', head: 't9', hair: 'wavy', colours: { job: 'medic', skin: '#d9a37f', hair: '#4a2f1d' } } },
      medic: { crew: 'Paramedic Teo', she: false },
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
  // CAPTAIN VEGA'S EXPLORING RUN (the plan: ~/pw/space-math/EXPLORE_PLAN.md; what each run is about: src/exploreplan.js).
  // Out of the Explorer's hangar; a jump out to where a lead points; there, the sensor operator's scan at the survey
  // table ('scan': src/jobs/survey.js, on foot at the table as the engineer is at the core) finds the next lead or the
  // finding; 1 to 3 jumps out as the run's scenario has it (`legs`: stepsFor repeats the jump and the scan for each); the
  // core's tuning out there; the jump home and the landing in its own hangar; paid so much for each place explored
  // (EXPLORE), at the survey table aboard. Its crew wear their own clothes (his EXPL1-3 A: kit/positions.js CREWS).
  explore: {
    id: 'explore', captain: 'vega', ship: 'explorer', name: 'Exploring run', roles: ['pilot', 'sensor', 'engineer'], payAt: 'survey', place: 'explore', legs: true,
    about: 'The Explorer follows a lead past the edge of the charts: a faint signal, a hunch, a strange pull. Wherever it jumps, the sensor operator scans for the next lead, until something is found. Each job on the run earns a share of what the run pays.',
    paid: 'You are paid your share of the run, at the Explorer\'s survey table, when you are back.',
    jobs: {
      pilot: { does: 'piloting out and home', crew: 'Pilot Wren', she: true, look: { suit: 'dockWorker', head: 't7', hair: 'braidcrown', colours: { job: 'explorer', skin: '#b5805a', hair: '#2a1a12' } } },
      sensor: { crew: 'Sensor operator Arlo', she: false },
      engineer: { crew: 'Engineer Nia', she: true, look: { suit: 'spaceWoman', head: 't3', hair: 'q_bob', colours: { job: 'explorer', skin: '#7a4a2c', hair: '#17110d' } } },
    },
    steps: [
      { id: 'out', kind: 'leave', secs: 4 },
      { id: 'jumpOut', kind: 'jump', role: 'pilot', cards: CARDS, to: 'lead' },
      { id: 'core', kind: 'tune', role: 'engineer', cards: CARDS, when: ['arrive', 'leave'] },
      // (at each place: the scan, `cards` cards at the survey table; at the last, the finding)
      { id: 'scan', kind: 'scan', role: 'sensor', cards: CARDS },
      { id: 'jumpHome', kind: 'jump', role: 'pilot', cards: CARDS, to: 'home' },
      { id: 'home', kind: 'land', secs: 5 },
    ],
  },
  // THE HAULER'S SUPPLY RUN TO THE OLD STATION (the plan: STATION2_PLAN.md in the helpers' notes, its pieces 6 to 10; the
  // game's maker, HAUL3-6: "you don't fly it until you discover the other station and need to bring supplies to it.
  // After that then you can go on hauling missions as much as you want to make money. It does have a dock, that is what
  // the bridge is for."; HAUL4-1: "You can go on the hauler, but not fly it unless you have a contract to fly it").
  // IT IS THE HAULER'S OWN CAPTAIN'S CONTRACT (the game's maker, 2026-11-23, HAUL1-1 C: "The Hauler gets a captain of
  // its own, who walks the station like Ruiz, Hale and Vega and comes along on the run."; who that is: src/life.js
  // HAULER_CAPTAIN, by the docking port): offered as the other three offer theirs, on the same card; signed, the captain
  // says so and waits by the docking port, and comes along in the captain's place aboard. (Before the Hauler had a
  // captain the contract was the shipping clerk's, at his desk, and a first mate spoke on the run: the captain has that
  // place now, and those lines; there is no first mate any more.)
  // `offered`: only once the old station has been found (Captain Vega's run that follows the call for help:
  // src/exploreplan.js foundOf `distress`); until then its captain has no run to offer (missions.state: 'wait'). And
  // again as often as wanted afterwards, as a plain hauling run for pay.
  // `desk`: THE SHIPPING DESK'S COMPUTER IN CARGO, where the run's load is worked out and where its share waits.
  // Its three jobs (RESC3-1: "all the missions should have pilot and engineer"): the pilot, the engineer, and THE
  // LOADMASTER (HAUL1-2 B), whose work is the cargo game in Cargo before the Hauler leaves (src/supplyrun.js: signed for
  // it, the crew member works out the load at the computer and drives the forklift; otherwise Cargo's crew loads). Then
  // aboard across the bridge; the Hauler undocks and flies clear ('leave': the same flying, from a dock); the jump; out
  // of the wormhole by the old station ('deliver': src/oldstationsite.js: flown to its old bridge and docked, by hand or
  // on autopilot; across their bridge on foot into the old station, where its people take the supplies and its lights
  // come back up; aboard again and away); the core's tuning out there; the jump home and the docking at our own bridge
  // ('land'). Paid so much for each pallet of supplies delivered (SUPPLY). Aboard: its captain and one of its crew, as
  // on every captain's run (aboardOf).
  supply: {
    id: 'supply', captain: HAULER_CAPTAIN.id, desk: 'cargo', ship: 'hauler', name: 'Supply run', roles: ['pilot', 'engineer', 'cargo'], payAt: 'cargo', place: 'oldstation',
    offered: (crew) => stationFound(crew),
    about: 'Tangent Station called for help: fuel cells, food and spare parts. The supplies are worked out and loaded down in Cargo. Then the Hauler flies them out, docks at Tangent Station\'s bridge, and comes home. Each job on the run earns a share of what the run pays.',
    paid: 'You are paid your share of the run, at the shipping computer in Cargo, when you are back.',
    // (after the first run, the old station saved: the same run as a plain hauling run)
    aboutAgain: 'Tangent Station trades with us now. A load for it is worked out and packed down in Cargo. Then the Hauler flies it out, docks at Tangent Station\'s bridge, and comes home. Each job on the run earns a share of what the run pays.',
    jobs: {
      pilot: { does: 'piloting to Tangent Station and home', crew: 'Pilot Remy', she: false, look: { suit: 'atlantis1', head: 't1', hair: 'shortFull', colours: { job: 'hauler', uniform: '#3f8fe8', skin: '#e0b08f', hair: '#5a3a22' } } },
      engineer: { crew: 'Engineer Sol', she: true, look: { suit: 'atlantis2', head: 't7', hair: 'afro', colours: { job: 'hauler', uniform: '#f0892e', skin: '#663b22', hair: '#17110d' } } },
      cargo: { crew: 'Loadmaster Hob', she: false },
    },
    steps: [
      { id: 'out', kind: 'leave', secs: 4 },
      { id: 'jumpOut', kind: 'jump', role: 'pilot', cards: CARDS, to: 'oldstation' },
      { id: 'core', kind: 'tune', role: 'engineer', cards: CARDS, when: ['arrive', 'leave'] },
      // (at the old station: the docking is the pilot's; everything else there is everyone's)
      { id: 'site', kind: 'deliver', roles: ['pilot'] },
      { id: 'jumpHome', kind: 'jump', role: 'pilot', cards: CARDS, to: 'home' },
      { id: 'home', kind: 'land', secs: 5 },
    ],
  },
};
// WHAT A SUPPLY RUN PAYS: so much for each pallet of supplies delivered (a run loads 3 or 4: src/supplyrun.js RUN), the
// same on every run. Set from the run's length beside a mining run's, as the rescue's was (the game's maker, RESC1-2;
// the helpers' notes, HAULRUN_1.md, have the sums).
export const SUPPLY = { perPallet: 7000 };
MISSIONS.supply.perPallet = SUPPLY.perPallet;
// (who the jump computer's cards speak of on the Hauler's run: its captain and crew; src/jobs/pilot.js folkFor)
MISSIONS.supply.folk = [{ name: HAULER_CAPTAIN.name, she: !!HAULER_CAPTAIN.she }, ...Object.values(MISSIONS.supply.jobs).map((j) => ({ name: j.crew, she: !!j.she }))];
// IS THE SUPPLY RUN OFFERED? Once the old station has been found (kept with the crew member by the exploring run that
// found it: crew.explored.distress, src/exploreplan.js keepFind; read here as that file's foundOf reads it). And has
// this crew member already made a run there (the station saved: crew.supply.runs, kept by land below)?
export const stationFound = (crew) => !!(crew && crew.explored && typeof crew.explored === 'object' && crew.explored.distress);
export const supplyRuns = (crew) => Math.max(0, Math.floor(+(crew && crew.supply && typeof crew.supply === 'object' && crew.supply.runs) || 0));
// WHAT AN EXPLORING RUN PAYS: so much for what it finds, and so much more for each place explored (src/exploreplan.js
// EXPLORE)
MISSIONS.explore.perPlace = EXPLORE.perPlace; MISSIONS.explore.findPays = EXPLORE.find;
MISSIONS.explore.folk = [{ name: 'Captain Vega', she: false }, ...Object.values(MISSIONS.explore.jobs).map((j) => ({ name: j.crew, she: !!j.she }))];
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
// IS A CAPTAIN'S RUN OFFERED TO THIS CREW MEMBER NOW? Every run from the start, but one that says when (a mission's
// `offered`: the supply run, once the old station is found)
const offeredTo = (captainId, crew) => { const M = missionOf(captainId); return !M || !M.offered || !!M.offered(crew); };
// JUST FLYING, IN A SHIP THAT IS YOURS (OWN RUNS, the top of this file): out of its hangar (or off its dock), round the
// station and back. The trip's own two flown steps and nothing between them: no jump, no cards, no crew, no pay. It is
// no mission of anyone's (not in MISSIONS) and nothing of it is kept with the crew member.
export const freeFlight = (ship) => ({ id: 'free', free: true, ship, name: `Your ${SHIP_NAMES[ship] || 'ship'}`, roles: ['pilot'], place: 'station', captain: null,
  steps: [{ id: 'out', kind: 'leave', secs: 4 }, { id: 'home', kind: 'land', secs: 5 }] });

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
export const crewFor = (M, mine, name = 'You', captain = null, { own = false, crew = [] } = {}) => {
  const A = aboardOf(M, mine, captain ? { id: 'captain', name: captain } : null, { own, crew });
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
// (ON A RUN OF YOUR OWN, `own`: no captain. Aboard are your own crew who came (`crew`: the run's own, signOwn: [{ id,
// name, look, jobs }]), each doing their job or along for the ride, in their own look; nobody else)
// (friend: the id their friendship meter is kept by: a station person's own; the captain's crew member, who walks no
// station, by their name: friendOf)
export function aboardOf(M, mine, captain = null, { own = false, crew = [] } = {}) {
  // (the roles as this mission has them: its captain's own crew member for each)
  const ROLES = rolesFor(M);
  const left = M.roles.filter((id) => !mine.includes(id)), first = left[0] || M.roles[0];
  if (own) return (crew || []).map((p) => ({ id: p.id, name: p.name, short: p.name, captain: false, mate: true, friend: p.id, jobs: M.roles.filter((r) => (p.jobs || []).includes(r)), look: p.look ?? p.id }));
  const crewName = ROLES[first].crew, cap = captain || { id: M.captain, name: 'The captain' };
  const short = (n) => String(n).split(' ').pop();
  return [
    // (look: a captain of the station's own, by their id; a run's lead who walks no station, by their own look)
    { id: cap.id, name: cap.name, short: short(cap.name), captain: true, friend: M.captain, jobs: left.slice(1), look: cap.look || cap.id },
    { id: 'crew-' + first, name: crewName, short: short(crewName), captain: false, friend: friendOf(crewName), jobs: left.length ? [first] : [], look: ROLES[first].look ? { ...ROLES[first].look, position: first, crew: M.ship } : null },
  ];
}
// (a captain's crew member's meter, by their name: 'Pilot Juno' -> 'crew-pilot-juno')
export const friendOf = (name) => 'crew-' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// the trip's steps for a crew member with these roles: each step, and whether it is theirs to do (`mine`: their role,
// its game made) or the crew's. `when`: this run's moment for the core's tuning ('arrive' | 'leave': tuneWhen), if the
// tuning is theirs; the 'tune' step is then among the steps, at that moment (`at`), and otherwise left out
// own: a run of your own (OWN RUNS, the top of this file): each of your own turns with cards asks half as many again
// (`was`: what a contract asks there)
export function stepsFor(M, mine, when = null, plan = null, { own = false } = {}) {
  const steps = legSteps(M, plan).filter((s) => s.kind !== 'tune').map((s) => {
    const roles = s.role ? [s.role] : s.roles || [];
    return { ...s, mine: roles.some((id) => mine.includes(id) && ROLES[id].ready) };
  });
  const t = when ? tuneFor(M, mine) : null;
  if (t && (t.when || []).includes(when)) {
    // (on arrival: right after the jump out to the far place. Before leaving it: right before the jump home)
    const i = when === 'leave' ? steps.findIndex((s) => s.kind === 'jump' && s.to === 'home') : steps.findIndex((s) => s.kind === 'jump' && s.to !== 'home') + 1;
    if (i > 0) steps.splice(i, 0, { ...t, mine: true, at: when });
  }
  if (own) {
    // (a job's turns counted in the order they come on the run: src/own.js moreCards)
    const turns = {};
    for (const s of steps) { if (!s.mine || !s.cards || !s.role) continue; const k = turns[s.role] || 0; turns[s.role] = k + 1; s.was = s.cards; s.cards = moreCards(s.cards, k); }
  }
  return steps;
}
// AN EXPLORING RUN'S LEGS (a mission with `legs`: src/exploreplan.js planOf): the jump out and the scan, once for each
// place the run goes to, in turn (`leg`: which; the first keeps its own ids, the next 'jumpOut2', 'scan2' ...); a place
// with nothing to scan (the station in distress, out in open space) has a scan of no cards: the finding alone. Any
// other mission, or no plan: its steps as they are.
export function legSteps(M, plan = null) {
  if (!M.legs || !plan || !Array.isArray(plan.legs) || !plan.legs.length) return M.steps;
  const out = [], jump = M.steps.find((s) => s.kind === 'jump' && s.to !== 'home'), scan = M.steps.find((s) => s.kind === 'scan');
  for (const s of M.steps) {
    if (s === scan) continue;
    if (s !== jump) { out.push(s); continue; }
    plan.legs.forEach((L, i) => {
      const k = i ? String(i + 1) : '';
      out.push({ ...jump, id: jump.id + k, leg: i });
      if (scan) out.push({ ...scan, id: scan.id + k, leg: i, last: !!L.last, cards: L.scan === false ? 0 : scan.cards });
    });
  }
  return out;
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
  return standBefore(room, it, items);
}
// A SHIP'S SURVEY TABLE, in its blueprint, the same way (the exploring run's scan: src/tune.js): the holo table of its
// science room (by its kind, 'holo', or a name with "survey" in it), and where a person stands before it; look: the
// middle of its top. null: a ship with none (only the Explorer has one).
export function surveyIn(bp) {
  const room = bp && (bp.rooms || []).find((r) => r.kind === 'science'); if (!room) return null;
  const items = (bp.items || []).filter((it) => it.room === room.id);
  const it = items.find((m) => m.kind === 'holo') || items.find((m) => /survey/i.test(m.name || '')); if (!it) return null;
  const C = standBefore(room, it, items); if (C) C.look[1] = Math.min(+it.h || 0.9, 1.2);
  return C;
}
// (where a person stands before a fitting of a room, as the top of this part says)
function standBefore(room, it, items) {
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
  // (a run of your own may have no job of yours: your crew does all three. One begun before there was a crew of your
  // own, with hired hands, and not flown yet, is gone (its pay, if it was home, is paid as it was))
  if (!roles.length && !m.own) return null;
  if (m.own && m.state === 'signed' && !Array.isArray(m.crew)) return null;
  // (a contract kept from before its run had the captain it has now: the supply run's, signed at the shipping desk when
  // it was the shipping clerk's, is the Hauler's captain's from here on, wherever it had got to)
  if (m.captain !== M.captain) m.captain = M.captain;
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
  const seed = M.place === 'planet' || M.legs ? 1 + Math.floor(seedRand() * 999999) : null;
  crew.mission = { id: M.id, captain: M.captain, roles, state: 'signed', signed: now, ...(tune ? { tune } : {}), ...(seed ? { seed } : {}) };
  return crew.mission;
}
// A RUN OF YOUR OWN, BEGUN (OWN RUNS, the top of this file): in a ship the crew member owns, for the jobs they do
// themselves (roleIds: any of them, none at all too; only jobs whose game is made); every other job of the run one of
// their own crew's (pick.jobs: { [role]: person id }, each a different one of src/own.js crewOf), and pick.along: the
// others of their crew who come along for the ride (no job, no share), as many as the ship has room for, with those
// doing jobs (src/own.js SEATS). Kept as a contract is (the same seed, the same moment picked for the core's tuning),
// with `own: true` and `crew`: [{ id, name, look, jobs: [role] }], those with a job first, in the run's own order of
// jobs. The Hauler's own run exists only once the old station has been found (the game's maker, BUY1-4).
// -> the mission as kept, or null (not their ship, another mission still on, a job nobody does, someone not on their
// crew or on two jobs, more of them than the ship has room for)
export function signOwn(crew, missionId, roleIds, now = Date.now(), rand = Math.random, seedRand = Math.random, pick = {}) {
  const M = MISSIONS[missionId];
  if (!M || !crew || !owns(crew, M.ship) || contractOf(crew) || (M.desk && !stationFound(crew))) return null;
  const mine = openRoles(M, roleIds || []), mates = crewOf(crew), byId = new Map(mates.map((p) => [p.id, p]));
  const jobs = isObj(pick && pick.jobs) ? pick.jobs : {}, along = Array.isArray(pick && pick.along) ? pick.along : [];
  const aboard = [], used = new Set();
  for (const role of M.roles) {
    if (mine.includes(role)) continue;
    const p = byId.get(jobs[role]); if (!p || used.has(p.id)) return null;
    used.add(p.id); aboard.push({ id: p.id, name: p.name, look: p.look, jobs: [role] });
  }
  for (const id of along) { const p = byId.get(id); if (!p || used.has(p.id)) return null; used.add(p.id); aboard.push({ id: p.id, name: p.name, look: p.look, jobs: [] }); }
  if (aboard.length > (SEATS[M.ship] ?? 0)) return null;
  const tune = pickTune(M, mine, rand);
  const seed = M.place === 'planet' || M.legs ? 1 + Math.floor(seedRand() * 999999) : null;
  crew.mission = { id: M.id, captain: M.captain, roles: mine, state: 'signed', signed: now, own: true, crew: aboard, ...(tune ? { tune } : {}), ...(seed ? { seed } : {}) };
  return crew.mission;
}
// the operating costs of a run of your own, in percent of what it brings (the game's maker: "operating costs" (fuel,
// maintenance, insurance), "always taken out")
export const OPS = { pct: 25 };
// your crew on a run of your own who do its jobs, each with the share they take: [{ role, id, name, share }], in the
// run's own order of jobs (a contract: nobody; along for the ride: nobody's share)
export function crewJobsOf(m) {
  const M = m && MISSIONS[m.id]; if (!M || !m.own || !Array.isArray(m.crew)) return [];
  const out = [];
  for (const role of M.roles) { const p = m.crew.find((q) => q && Array.isArray(q.jobs) && q.jobs.includes(role)); if (p) out.push({ role, id: p.id, name: p.name, share: ROLES[role].share }); }
  return out;
}
// THE CREW MEMBER'S SHARE OF WHAT A RUN BRINGS, in percent: a contract's, their jobs' shares added up; a run of their own,
// what is left once the operating costs and their crew's jobs' shares are taken
export const shareFor = (m) => (m && m.own ? 100 - OPS.pct - crewJobsOf(m).reduce((a, h) => a + h.share, 0) : shareOf(m ? m.roles : []));
// (what the owner keeps when their crew does these jobs (the jobs not theirs), before anything is signed: the owner's
// card, src/contract.js)
export const ownShare = (M, mine) => 100 - OPS.pct - shareOf(M.roles.filter((id) => !mine.includes(id)));
// A PAYOUT OF A RUN OF YOUR OWN (sold: what the run brought): the operating costs, each of the crew's pay for their job,
// and what is left, yours; all in whole credits, and adding up to what it brought, to the credit:
//   { own: true, ops, opsPct, crew: [{ role, id, name, share, pay }], along: [names], share (yours, percent), pay (yours) }
const ownPart = (m, sold) => {
  if (!m.own) return {};
  const ops = payOf(sold, OPS.pct), jobs = crewJobsOf(m).map((h) => ({ ...h, pay: payOf(sold, h.share) }));
  const along = (Array.isArray(m.crew) ? m.crew : []).filter((p) => !(p.jobs || []).length).map((p) => p.name);
  return { own: true, ops, opsPct: OPS.pct, crew: jobs, along, share: shareFor(m), pay: sold - ops - jobs.reduce((a, h) => a + h.pay, 0) };
};
// (the friendship meters of everyone who was aboard a run: a run of your own, your crew who came; a captain's contract,
// the captain and the crew member of his who came)
export function aboardIds(m) {
  const M = m && MISSIONS[m.id]; if (!M) return [];
  if (m.own) return (Array.isArray(m.crew) ? m.crew : []).map((p) => p.id).filter(Boolean);
  return aboardOf(M, m.roles || [], { id: M.captain, name: 'The captain' }).map((a) => a.friend).filter(Boolean);
}
// the planet a contract's run goes to (its seed), or null (a run that goes to no planet, or no contract)
export function seedOf(crew) { const m = contractOf(crew); return m && (MISSIONS[m.id].place === 'planet' || MISSIONS[m.id].legs) ? (Number.isFinite(+m.seed) && +m.seed > 0 ? Math.floor(+m.seed) : 1) : null; }
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
export function land(crew, { n = 0, store = {}, people = 0, places = 0, find = null, pallets = 0, now = Date.now() } = {}) {
  const m = contractOf(crew);
  if (!m || m.state !== 'signed') return null;
  const M = MISSIONS[m.id];
  // (AN EXPLORING RUN, a mission with `perPlace`: places, how many places it explored; so much for what it found and so
  // much for each place (EXPLORE): { kind: 'explore', places, per, base (what the finding pays), sold (what the run
  // paid), share, pay, at, find (what it found) })
  if (M.perPlace) {
    const k = Math.max(1, Math.floor(+places || 1)), base = M.findPays || 0, sold = base + k * M.perPlace, share = shareFor(m);
    m.state = 'payout';
    m.payout = { kind: 'explore', places: k, per: M.perPlace, base, sold, share, pay: payOf(sold, share), at: now, ...(find ? { find: String(find) } : {}), ...ownPart(m, sold) };
    return m.payout;
  }
  // (A SUPPLY RUN, a mission with `perPallet`: pallets, how many it delivered; so much for each (SUPPLY): { kind:
  // 'supply', pallets, per, sold (what the run paid), share, pay, at, first (the run that saved the old station) }; and
  // the crew member's runs there counted: crew.supply.runs)
  if (M.perPallet) {
    const k = Math.max(1, Math.floor(+pallets || 1)), sold = k * M.perPallet, share = shareFor(m), first = supplyRuns(crew) === 0;
    crew.supply = { ...(crew.supply && typeof crew.supply === 'object' ? crew.supply : {}), runs: supplyRuns(crew) + 1 };
    m.state = 'payout';
    m.payout = { kind: 'supply', pallets: k, per: M.perPallet, sold, share, pay: payOf(sold, share), at: now, ...(first ? { first: true } : {}), ...ownPart(m, sold) };
    return m.payout;
  }
  if (M.perPerson) {
    const k = Math.max(0, Math.floor(+people || 0)), sold = k * M.perPerson, share = shareFor(m);
    m.state = 'payout';
    m.payout = { kind: 'rescue', people: k, per: M.perPerson, sold, share, pay: payOf(sold, share), at: now, ...ownPart(m, sold) };
    return m.payout;
  }
  flownHaul(n, { store });
  const H = haulOf(n), share = shareFor(m);
  m.state = 'payout';
  m.payout = { n: H.n, canisters: H.canisters, tonnes: H.tonnes, lots: H.lots.map((L) => ({ metal: L.metal.name, tonnes: L.tonnes, price: L.price, pay: L.pay })), sold: H.pay, share, pay: payOf(H.pay, share), at: now, ...ownPart(m, H.pay) };
  return m.payout;
}
// the share collected: the credits arrive as a job's pay does (the crew member's credits, a tally of its own), and the
// mission is done; and everyone who was aboard goes up one pip (aboardIds: OWN RUNS, the top of this file; kept with
// the crew member, src/friends.js; who they were: aboardIds). -> { pay, credits } or null (nothing waiting)
export const RUN_PIP = 1;
export function collect(crew, now = Date.now()) {
  const m = contractOf(crew);
  if (!m || m.state !== 'payout') return null;
  const pay = Math.max(0, Math.floor(+m.payout.pay || 0));
  const credits = earn(crew, m.id, pay);
  jobTally(crew, m.id).n++;      // (the runs flown and paid)
  for (const id of aboardIds(m)) addPips(crew, id, RUN_PIP, 'run', now);
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
// A RUN OF YOUR OWN FROM BEFORE YOUR CREW WAS YOUR OWN, ON THE PAY SLIP (P.own, P.hired, no P.ops: one home in a save
// from then, its pay still waiting; every run of your own now has ownPayOrder's slip). Nothing on it is anyone's
// "share" but the hired crew's, and what is left is the owner's: the slip's last rows (shareRows), the right answer's
// line (paidWords), the slip's own words turned (ownWords: "your crew" is "your ship", who may be aboard it alone), and
// which form is asked (formFor: with nobody hired all of it is theirs, so there is no part or percent of it to work
// out, and the card asks what the run brought instead)
// (A RUN OF YOUR OWN WITH A CREW OF YOUR OWN (P.ops: ownPart): its last rows are the operating costs, each of the crew
// who did a job and their pay, and yours (crewRows); a payout from before, with hired hands (P.hired), as it was)
const crewRows = (P, ask) => [['Operating costs', `${P.opsPct}%: ${ask === 'ops' ? '?' : `${say(P.ops)} credits`}`],
  ...(P.crew || []).map((h) => [`${ROLES[h.role] ? ROLES[h.role].name : h.role}: ${h.name}`, ask === 'crew' ? `${h.share}%` : `${h.share}%: ${say(h.pay)} credits`]),
  ...(ask === 'crew' ? [['Your crew\'s pay', '?']] : []), ['Yours', `${P.share}%`], ['Your pay', ask ? '?' : `${say(P.pay)} credits`]];
const shareRows = (P, ask) => (P.own && P.ops != null ? crewRows(P, ask) : [...(P.own ? [...(P.hired && P.hired.length ? [['Hired crew', `${100 - P.share}%`]] : []), ['Yours', P.share >= 100 ? 'All of it' : `${P.share}%`]] : [['Your share', `${P.share}%`]]), ['Your pay', ask ? '?' : `${say(P.pay)} credits`]]);
const paidWords = (P, even = true) => { const to = even ? '' : ', to the nearest credit'; return P.own ? (P.share >= 100 ? `All of it is yours: ${say(P.pay)} credits${to}.` : `What is left, ${P.share}%, is yours: ${say(P.pay)} credits${to}.`) : `Your share, ${P.share}%, is ${say(P.pay)} credits${to}.`; };
const ownWords = (P, w) => (P.own ? String(w).replace(/\b([Yy])our crew\b/g, '$1our ship').replace(/\bYour share is\b/g, 'Your pay is') : w);
const formFor = (P, grade) => { const f = payoutForm(grade); return P.own && P.share >= 100 && (f === 'part' || f === 'percent') ? 'add' : f; };
const fromOf = (P) => (P.own ? 'Your own run' : 'Your share');
// the slip's rows: the plain sum. ask: which row is the one asked for ('sold' or 'pay': shown as "?"), or none
export function payoutLines(P, ask = null) {
  // (a rescue's: how many came home, what each is worth, what the rescue paid, the share)
  if (P.kind === 'rescue') return [['Brought home', `${P.people} ${P.people === 1 ? 'person' : 'people'}`], ['Each person', `${say(P.per)} credits`], ['The rescue paid', ask === 'sold' ? '?' : `${say(P.sold)} credits`], ...shareRows(P, ask)];
  // (a supply run's: how many pallets it delivered, what each is worth, what the run paid, the share)
  if (P.kind === 'supply') return [['Delivered', `${P.pallets} ${P.pallets === 1 ? 'pallet' : 'pallets'}`], ['Each pallet', `${say(P.per)} credits`], ['The run paid', ask === 'sold' ? '?' : `${say(P.sold)} credits`], ...shareRows(P, ask)];
  // (an exploring run's: how many places it explored, what each is worth, what the run paid, the share)
  if (P.kind === 'explore') return [...(P.base ? [['What it found', `${say(P.base)} credits`]] : []), ['Places explored', `${P.places} ${P.places === 1 ? 'place' : 'places'}`], [P.base ? 'Each place, more' : 'Each place', `${say(P.per)} credits`], ['The run paid', ask === 'sold' ? '?' : `${say(P.sold)} credits`], ...shareRows(P, ask)];
  const lots = lotsOf(P), e = inEighths(lots);
  // (a row is one sum, kept short enough for one line on a phone: "3 tonnes × 3,000 = 9,000"; home early, an eighth
  // as a fraction: "2 5/8 tonnes × 2,000 = 5,250", "3/4 tonne × 4,000 = 3,000")
  return [...lots.map((L) => [cap(L.metal), `${e ? eighthsText(L.tonnes) : L.tonnes} ${L.tonnes === 1 || (e && L.tonnes < 1) ? 'tonne' : 'tonnes'} × ${say(L.price)} = ${say(L.pay)}`]),
    ['Sold for', ask === 'sold' ? '?' : `${say(P.sold)} credits`], ...shareRows(P, ask)];
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
// AN EXPLORING RUN'S, at the Explorer's survey table: the same, so many places explored at so much each (PER_WORDS).
// A SUPPLY RUN'S, at the shipping computer: the same, so many pallets delivered at so much each.
const PEOPLE = ['person', 'people'], PLACES = ['place', 'places'], PALLETS = ['pallet', 'pallets'];
const PER_WORDS = {
  rescue: { n: (P) => P.people, unit: PEOPLE, pic: 'people', key: 'people', perKey: 'perPerson', home: (n) => `Your crew is home with ${n} people from the pods.`, pays: 'The rescue pays', paid: 'the rescue', ask: 'How many people did your crew bring home?', each: 'person', one: 'for one person', many: 'people', title: 'Person by person', brought: 'Each person brought home is', count: 'Touch each person once as you count: 1, 2, 3 ...' },
  supply: { n: (P) => P.pallets, unit: PALLETS, pic: 'pallets', key: 'pallets', perKey: 'perPallet', home: (n) => `Your crew is home. It took ${n === 1 ? 'one pallet' : `${n} pallets`} of supplies to Tangent Station.`, pays: 'The run pays', paid: 'the run', ask: 'How many pallets did your crew deliver?', each: 'pallet', one: 'for one pallet', many: 'pallets', title: 'Pallet by pallet', brought: 'Each pallet delivered is', count: 'Touch each pallet once as you count: 1, 2, 3 ...' },
  explore: { n: (P) => P.places, unit: PLACES, pic: 'places', key: 'places', perKey: 'perPlace', home: (n) => `Your crew is home from ${n === 1 ? 'one place' : `${n} places`} nobody had explored.`, pays: 'The run pays', paid: 'the run', ask: 'How many places did your crew explore?', each: 'place', one: 'for one place', many: 'places', title: 'Place by place', brought: 'Each place explored is', count: 'Touch each place once as you count: 1, 2, 3 ...' },
};
function rescueOrder(m, grade, rand, paid) {
  const P = m.payout, U = PER_WORDS[P.kind] || PER_WORDS.rescue, n = U.n(P), per = P.per, form = formFor(P, grade), top = { from: fromOf(P) };
  // (a run of your own: the slip's story and question in the owner's words)
  const done = (o) => Object.assign(o, { payout: P.pay, form }), own = (o) => (P.own ? { ...o, story: ownWords(P, o.story), ask: ownWords(P, o.ask) } : o);
  if (form === 'count') {
    return done(ownOrder(own({
      key: 'payout:' + U.key,
      story: `Your crew is home. ${U.paid[0].toUpperCase() + U.paid.slice(1)} paid ${say(P.sold)} credits. Your share is ${say(P.pay)} credits.`,
      ask: U.ask,
      right: N(n, U.unit),
      slips: [
        { ...N(n + 1, U.unit), slip: 'off', why: 'One too many. Count again, touching each one once.' },
        ...(n > 1 ? [{ ...N(n - 1, U.unit), slip: 'off', why: 'One short. Count again, touching each one once.' }] : []),
        { ...N(n + 2, U.unit), slip: 'off', why: 'Too many. Count again, touching each one once.' },
        ...(n > 1 ? [] : [{ ...N(n + 3, U.unit), slip: 'off', why: 'Too many. Count again, touching each one once.' }]),
      ],
      rightWhy: `${say(n)} ${n === 1 ? U.unit[0] : U.unit[1]}. ${paid}`,
      lines: payoutLines(P),
      picFirst: true, help: { title: 'Count them', pic: { kind: U.pic, n }, line: U.count },
      own: { strand: 'number', at: 6 }, facts: { ...top, form, n, pay: P.pay },
    }), rand, 3));
  }
  // (AN EXPLORING RUN'S: what the finding pays, and so much more for each place explored: two steps, the places first)
  if (form === 'add' && P.base) {
    const places = n * per, pl = n === 1 ? 'one place' : `${n} places`;
    return done(ownOrder(own({
      key: 'payout:findAndPlaces',
      story: `${U.home(n)} The run pays ${say(P.base)} credits for what it found, and ${say(per)} credits more for each place explored.`,
      ask: 'How many credits did the run pay?',
      right: N(P.sold, CREDIT),
      slips: [
        { ...N(P.base, CREDIT), slip: 'findOnly', why: `That is only what it found. Add ${say(per)} credits for each place explored.` },
        { ...N(places, CREDIT), slip: 'placesOnly', why: `That is only the places. Add the ${say(P.base)} credits for what it found.` },
        ...(n > 1 ? [{ ...N(P.base + per, CREDIT), slip: 'onePlace', why: `That counts one place. Your crew explored ${pl}: ${n} × ${say(per)}.` }] : []),
        { ...N(P.sold + per, CREDIT), slip: 'groupOff', why: `That is one place too many. Your crew explored ${pl}.` },
        { ...N(P.base + per + n, CREDIT), slip: 'added', why: `That adds the places to the pay. Each place is ${say(per)} credits: multiply.` },
      ].filter((s) => s.v > 0 && s.v !== P.sold),
      rightWhy: `${n} × ${say(per)} = ${say(places)}; ${say(P.base)} + ${say(places)} = ${say(P.sold)} credits. ${paid}`,
      sum: [{ op: 'mul', a: n, b: per, say: 'First the places' }, { op: 'add', a: P.base, b: places, say: 'Then what it found as well' }],
      lines: payoutLines(P, 'sold'),
      help: { title: 'What it found, then the places', pic: { kind: U.pic, n }, line: `${say(per)} credits for each place explored: ${n} ${n === 1 ? 'lot' : 'lots'} of ${say(per)}. Then add the ${say(P.base)} credits for what it found.`,
        steps: [`The places: ${n} × ${say(per)}`, `Then what it found as well: ${say(P.base)} + that`] },
      own: { strand: 'words', at: 30 }, facts: { ...top, form, n, per, base: P.base, pay: P.pay }, size: 2,
    }), rand));
  }
  if (form === 'add') {
    // (so many people at so much each: the rescue's pay; so many places: an exploring run's)
    const are = n === 1 ? `There is ${n} ${U.each}` : `There are ${n} ${U.many}`;
    return done(ownOrder(own({
      key: 'payout:' + U.perKey,
      story: `${U.home(n)} ${U.pays} ${say(per)} credits for each ${U.each}.`,
      ask: `How many credits did ${U.paid} pay?`,
      right: N(P.sold, CREDIT),
      slips: [
        ...(n > 1 ? [{ ...N(per, CREDIT), slip: 'one', why: `${say(per)} credits is ${U.one}. ${are}.` }] : []),
        { ...N(per + n, CREDIT), slip: 'added', why: `That adds the ${U.many} to the pay. Each ${U.each} is ${say(per)} credits: multiply.` },
        { ...N(P.sold + per, CREDIT), slip: 'groupOff', why: `That is one ${U.each} too many. ${are}.` },
        { ...N(P.sold - per, CREDIT), slip: 'groupOff', why: `That is one ${U.each} short. ${are}.` },
        ...(n > 1 ? [] : [{ ...N(P.sold + 2 * per, CREDIT), slip: 'groupOff', why: `That is two ${U.many} too many. ${are}.` }]),
      ].filter((s) => s.v > 0),
      rightWhy: `${n} × ${say(per)} = ${say(P.sold)} credits. ${paid}`,
      sum: { op: 'mul', a: n, b: per },
      lines: payoutLines(P, 'sold'),
      help: { title: U.title, pic: { kind: U.pic, n }, line: `${U.brought} ${say(per)} credits: ${n} ${n === 1 ? 'lot' : 'lots'} of ${say(per)}.`, steps: [`${n} ${n === 1 ? 'lot' : 'lots'} of ${say(per)}: ${n} × ${say(per)}`] },
      own: { strand: 'words', at: 26 }, facts: { ...top, form, n, per, pay: P.pay },
    }), rand));
  }
  return null;
}
// A RUN OF YOUR OWN'S PAY SLIP (OWN RUNS, the top of this file; P.ops: ownPart). Its rows: what the run brought, as
// every slip's; the operating costs; each of your crew who did a job, their share and pay; yours. Its question is
// about PAYING YOUR CREW when any of them did a job, and about THE OPERATING COSTS when none did, at the crew member's
// level by the same four forms as every slip (payoutForm):
//   COUNT    the crew who did a job, to be paid (a figure each); none: what the run paid cut into four parts, one the
//            operating costs', and the parts that are yours counted
//   ADD      two or three of the crew: their pay added up; one: the operating costs and their pay, what is paid out in
//            all; none: what is left once the operating costs are paid (a take-away)
//   A PART   your crew's pay, as tenths of what the run brought (their jobs' shares: 1/10 a pilot, 2/10 the others; all
//            three 5/10, a half); none: the operating costs, a quarter of it
//   PERCENT  the same in percent: your crew's 10% to 50%; none: the operating costs' 25%
// (a part or a percent that does not come to whole credits, a haul home early: ADD, as a contract's slip does)
// The pay that arrives with the right answer is yours, always.
const listWords = (L) => (L.length <= 1 ? L.join('') : `${L.slice(0, -1).join(', ')} and ${L[L.length - 1]}`);
const PEOPLE_N = ['person', 'people'], PARTS = ['part', 'parts'];
const COSTS = 'The operating costs (fuel, maintenance and insurance)';
function ownPayOrder(m, grade, rand) {
  const P = m.payout, jobs = P.crew || [], n = jobs.length, crewPay = jobs.reduce((a, h) => a + h.pay, 0), crewPct = jobs.reduce((a, h) => a + h.share, 0);
  const SOLD = P.kind === 'rescue' ? 'The rescue paid' : P.kind ? 'The run paid' : 'The haul sold for', top = { from: 'Your own run' };
  const whole = (pct) => Number.isInteger(P.sold * pct / 100);
  let form = payoutForm(grade);
  if ((form === 'part' || form === 'percent') && !(n ? whole(10) : whole(OPS.pct))) form = 'add';
  const done = (o) => Object.assign(o, { payout: P.pay, form });
  const yours = `Your pay is the rest: ${say(P.pay)} credits.`, names = listWords(jobs.map((h) => h.name));
  const head = `You are home. ${SOLD} ${say(P.sold)} credits.`;
  if (form === 'count' && n) {
    return done(ownOrder({
      key: 'payout:own:crew',
      story: `${head} Each of your crew who did a job is paid for it.`,
      ask: 'How many of your crew do you pay?',
      right: N(n, PEOPLE_N),
      slips: [
        { ...N(n + 1, PEOPLE_N), slip: 'off', why: 'One too many. Count again, touching each one once.' },
        ...(n > 1 ? [{ ...N(n - 1, PEOPLE_N), slip: 'off', why: 'One short. Count again, touching each one once.' }] : []),
        { ...N(n + 2, PEOPLE_N), slip: 'off', why: 'Too many. Count again, touching each one once.' },
        ...(n > 1 ? [] : [{ ...N(n + 3, PEOPLE_N), slip: 'off', why: 'Too many. Count again, touching each one once.' }]),
      ],
      rightWhy: `${n === 1 ? `One: ${names}` : `${n}: ${names}`}. ${yours}`,
      lines: payoutLines(P),
      picFirst: true, help: { title: 'Count them', pic: { kind: 'people', n }, line: 'Touch each one once as you count: 1, 2, 3 ...' },
      own: { strand: 'number', at: 6 }, facts: { ...top, form, n, pay: P.pay },
    }, rand, 3));
  }
  if (form === 'count') {
    return done(ownOrder({
      key: 'payout:own:parts',
      story: `${head} It is cut into 4 equal parts. One part pays the operating costs: fuel, maintenance and insurance. The rest is yours.`,
      ask: 'How many parts are yours?',
      right: N(3, PARTS),
      slips: [
        { ...N(4, PARTS), slip: 'all', why: 'That counts the costs\' part too. Count only the parts that say yours.' },
        { ...N(1, PARTS), slip: 'costs', why: 'That is the costs\' part. Count the parts that say yours.' },
        { ...N(2, PARTS), slip: 'off', why: 'One short. Count again, touching each one once.' },
      ],
      rightWhy: `3 parts. ${yours}`,
      lines: payoutLines(P),
      picFirst: true, help: { title: 'Count them', pic: { kind: 'parts', whole: P.sold, d: 4, costs: 1 }, line: 'Touch each part that says yours once as you count: 1, 2, 3 ...' },
      own: { strand: 'number', at: 6 }, facts: { ...top, form, n: 3, pay: P.pay },
    }, rand, 3));
  }
  if (form === 'add' && n > 1) {
    const pays = jobs.map((h) => h.pay), chain = pays.slice(1).map((p, i) => ({ op: 'add', a: pays.slice(0, i + 1).reduce((x, y) => x + y, 0), b: p, say: i ? 'Then the next' : 'First two of them' }));
    return done(ownOrder({
      key: 'payout:own:crewAdd',
      story: `${head} ${listWords(jobs.map((h) => `${h.name} is paid ${say(h.pay)} credits`))}.`,
      ask: 'How many credits do you pay your crew?',
      right: N(crewPay, CREDIT),
      slips: [
        { ...N(pays[0], CREDIT), slip: 'part', why: `That is only what ${jobs[0].name} is paid. Add ${n === 2 ? `${jobs[1].name}'s` : 'the others\''} too.` },
        { ...N(crewPay + P.ops, CREDIT), slip: 'costs', why: 'That adds the operating costs as well. Only your crew\'s pay.' },
        { ...N(crewPay + 1000, CREDIT), slip: 'off', why: 'A thousand too many. Add them again, the thousands first.' },
        ...(crewPay > 1000 ? [{ ...N(crewPay - 1000, CREDIT), slip: 'off', why: 'A thousand short. Add them again, the thousands first.' }] : []),
      ],
      rightWhy: `${pays.map(say).join(' + ')} = ${say(crewPay)} credits. ${yours}`, sum: chain.length === 1 ? chain[0] : chain,
      lines: payoutLines(P, 'crew'),
      help: { title: 'Pay each one', line: `Your crew's pay is what each of them is paid, added up: ${names}.`, steps: [pays.map(say).join(' + ')] },
      own: { strand: 'add', at: 30 }, facts: { ...top, form, n, pay: P.pay }, size: Math.min(3, n - 1),
    }, rand));
  }
  if (form === 'add' && n === 1) {
    const h = jobs[0], out = P.ops + h.pay;
    return done(ownOrder({
      key: 'payout:own:paidOut',
      story: `${head} ${COSTS} are ${say(P.ops)} credits, and ${h.name} is paid ${say(h.pay)} credits.`,
      ask: `How many credits do you pay out, for the operating costs and ${h.name}?`,
      right: N(out, CREDIT),
      slips: [
        { ...N(h.pay, CREDIT), slip: 'part', why: `That is only ${h.name}'s pay. Add the operating costs too.` },
        { ...N(P.ops, CREDIT), slip: 'part', why: `That is only the operating costs. Add ${h.name}'s pay too.` },
        { ...N(out + 1000, CREDIT), slip: 'off', why: 'A thousand too many. Add them again, the thousands first.' },
        { ...N(P.pay, CREDIT), slip: 'rest', why: 'That is what is left for you. Add up what is paid out.' },
      ],
      rightWhy: `${say(P.ops)} + ${say(h.pay)} = ${say(out)} credits. ${yours}`, sum: { op: 'add', a: P.ops, b: h.pay },
      lines: payoutLines(P, 'pay'),
      help: { title: 'All that is paid out', line: `The operating costs, and ${h.name}'s pay: add them.`, steps: [`${say(P.ops)} + ${say(h.pay)}`] },
      own: { strand: 'add', at: 30 }, facts: { ...top, form, n, pay: P.pay },
    }, rand));
  }
  if (form === 'add') {
    return done(ownOrder({
      key: 'payout:own:afterCosts',
      story: `${head} ${COSTS} are ${say(P.ops)} credits. The rest is yours.`,
      ask: 'How many credits are yours?',
      right: N(P.pay, CREDIT),
      slips: [
        { ...N(P.ops, CREDIT), slip: 'costs', why: 'That is the operating costs. Take them away from what the run brought.' },
        { ...N(P.sold + P.ops, CREDIT), slip: 'added', why: 'That adds the costs on. Take them away instead.' },
        { ...N(P.pay + 1000, CREDIT), slip: 'off', why: 'A thousand too many. Take it away again, the thousands first.' },
        ...(P.pay > 1000 ? [{ ...N(P.pay - 1000, CREDIT), slip: 'off', why: 'A thousand short. Take it away again, the thousands first.' }] : []),
      ],
      rightWhy: `${say(P.sold)} − ${say(P.ops)} = ${say(P.pay)} credits.`, sum: { op: 'sub', a: P.sold, b: P.ops },
      lines: payoutLines(P, 'pay'),
      help: { title: 'Take the costs away', line: `What the run brought, less the operating costs: ${say(P.sold)} − ${say(P.ops)}.`, steps: [`${say(P.sold)} − ${say(P.ops)}`] },
      own: { strand: 'words', at: 30 }, facts: { ...top, form, n: 0, pay: P.pay },
    }, rand));
  }
  const one = P.sold / 10, pct = form === 'percent';
  if (n) {
    // (your crew's pay: so many tenths of what the run brought, or that many tens of percent)
    const t = crewPct / 10, half = t === 5 && !pct, frac = half ? '1/2' : `${t}/10`, part = pct ? `${crewPct}%` : frac;
    const each = jobs.map((h) => `${h.name} ${pct ? `${h.share}%` : `${h.share / 10}/10`}`).join(', ');
    return done(ownOrder({
      key: pct ? 'payout:own:crewPct' : 'payout:own:crewPart',
      story: `${SOLD} ${say(P.sold)} credits. Your crew's ${n === 1 ? 'job takes' : 'jobs take'} ${part} of it (${each}).`,
      ask: 'How many credits do you pay your crew?',
      right: N(crewPay, CREDIT),
      slips: [
        { ...N(P.pay, CREDIT), slip: 'rest', why: `That is your own pay. Your crew's is ${part} of the ${say(P.sold)} credits.` },
        ...(pct ? [{ ...N(crewPct, CREDIT), slip: 'percentCount', why: `${crewPct}% isn't ${crewPct} credits. It means ${crewPct} out of every 100: 10% of ${say(P.sold)} is ${say(one)}.` }] : []),
        ...(t > 1 && !half ? [{ ...N(one, CREDIT), slip: 'onePart', why: `${say(one)} credits is ${pct ? '10%' : 'one tenth'}. Your crew's is ${part}.` }] : [{ ...N(P.sold / 100, CREDIT), slip: 'tooSmall', why: `That cuts the ${say(P.sold)} credits into 100 parts. ${half ? 'A half is 2 equal parts.' : 'Tenths are 10 equal parts.'}` }]),
        { ...N(half ? P.sold / 4 : crewPay + one, CREDIT), slip: 'partOff', why: half ? 'That is a quarter. A half is one of 2 equal parts.' : `That is ${pct ? `${crewPct + 10}%` : `${t + 1}/10`}. Your crew's is ${part}.` },
        { ...N(crewPay + P.ops, CREDIT), slip: 'costs', why: 'That adds the operating costs as well. Only your crew\'s pay.' },
        { ...N(crewPay + 1000, CREDIT), slip: 'off', why: 'A thousand too many. Work it out again.' },
      ].filter((s) => Number.isInteger(s.v)),
      rightWhy: half ? `${say(P.sold)} ÷ 2 = ${say(crewPay)} credits. ${yours}` : t === 1 ? `${pct ? '10%' : '1/10'} of ${say(P.sold)} is ${say(P.sold)} ÷ 10 = ${say(crewPay)} credits. ${yours}` : `${pct ? '10%' : 'One tenth'} is ${say(P.sold)} ÷ 10 = ${say(one)}; ${part} is ${t} × ${say(one)} = ${say(crewPay)} credits. ${yours}`,
      sum: half ? { op: 'div', a: P.sold, b: 2 } : t === 1 ? { op: 'div', a: P.sold, b: 10 } : [{ op: 'div', a: P.sold, b: 10, say: pct ? 'First 10%: a tenth of it' : 'First one tenth of it' }, { op: 'mul', a: one, b: t, say: `Then ${part}` }],
      lines: payoutLines(P, 'crew'),
      help: { title: pct ? 'Ten percent first' : 'Cut into equal parts', pic: { kind: 'sharebar', whole: P.sold, n: half ? 1 : t, d: half ? 2 : 10, pct, top: `${SOLD.toLowerCase()} ${say(P.sold)} credits`, foot: 'your crew\'s pay' },
        line: pct ? `10% is one part in ten. Find 10% of the ${say(P.sold)} credits${t === 1 ? '' : `, then take ${t} lots of it`}.` : half ? `A half means the ${say(P.sold)} credits cut into 2 equal parts, and one of them your crew's.` : `${frac} means the ${say(P.sold)} credits cut into 10 equal parts, and ${t === 1 ? 'one of them' : `${t} of them`} your crew's.`,
        steps: half ? [`One of the 2 equal parts: ${say(P.sold)} ÷ 2`] : t === 1 ? [`${say(P.sold)} ÷ 10`] : [`First ${pct ? '10%' : 'one tenth'}: ${say(P.sold)} ÷ 10`, `Then ${part}: that × ${t}`] },
      own: pct ? { strand: 'pct', at: 58 } : { strand: 'frac', at: 40 }, facts: { ...top, form, sold: P.sold, share: crewPct, pay: P.pay }, size: t > 1 && !half ? 2 : 1,
    }, rand));
  }
  // (none of your crew did a job: the operating costs, a quarter of it, or 25%)
  const part = pct ? `${OPS.pct}%` : '1/4';
  return done(ownOrder({
    key: pct ? 'payout:own:costsPct' : 'payout:own:costsPart',
    story: `${SOLD} ${say(P.sold)} credits. ${COSTS} take ${part} of it.`,
    ask: 'How many credits are the operating costs?',
    right: N(P.ops, CREDIT),
    slips: [
      { ...N(P.pay, CREDIT), slip: 'rest', why: `That is the other ${pct ? '75%' : '3/4'}: yours. The costs are ${part} of it.` },
      ...(pct ? [{ ...N(OPS.pct, CREDIT), slip: 'percentCount', why: `25% isn't 25 credits. It means 25 out of every 100: a quarter of it.` }] : []),
      { ...N(one, CREDIT), slip: 'tenth', why: `That is ${pct ? '10%' : 'a tenth'}. ${pct ? '25% is a quarter' : 'A quarter is one of 4 equal parts'}.` },
      { ...N(P.sold / 2, CREDIT), slip: 'half', why: `That is a half. ${pct ? '25% is a quarter' : 'A quarter is one of 4 equal parts'}.` },
      { ...N(P.sold - 4, CREDIT), slip: 'subtracted', why: `That takes 4 away. Cut the ${say(P.sold)} credits into 4 equal parts instead.` },
      { ...N(P.ops + 1000, CREDIT), slip: 'off', why: 'A thousand too many. Work it out again.' },
    ].filter((s) => Number.isInteger(s.v)),
    rightWhy: `${pct ? '25% is a quarter: ' : ''}${say(P.sold)} ÷ 4 = ${say(P.ops)} credits. ${yours}`,
    sum: { op: 'div', a: P.sold, b: 4, say: pct ? '25% is a quarter of it' : 'One of 4 equal parts' },
    lines: payoutLines(P, 'ops'),
    help: { title: pct ? '25% is a quarter' : 'Cut into equal parts', pic: { kind: 'sharebar', whole: P.sold, n: 1, d: 4, top: `${SOLD.toLowerCase()} ${say(P.sold)} credits`, foot: 'the operating costs' },
      line: `${pct ? '25% is 25 out of every 100: a quarter. ' : ''}A quarter means the ${say(P.sold)} credits cut into 4 equal parts, and one of them the operating costs.`, steps: [`One of the 4 equal parts: ${say(P.sold)} ÷ 4`] },
    own: pct ? { strand: 'pct', at: 58 } : { strand: 'frac', at: 40 }, facts: { ...top, form, sold: P.sold, share: OPS.pct, pay: P.pay },
  }, rand));
}
export function payoutOrder(m, grade = 0, rand = Math.random) {
  if (m.payout && m.payout.own && m.payout.ops != null) return ownPayOrder(m, grade, rand);
  const P = m.payout, per = P.kind === 'rescue' || P.kind === 'explore' || P.kind === 'supply', who = rolesWords(m.roles), tenths = P.share / 10, lots = per ? [] : lotsOf(P);
  // (what the whole came to, in its own words: a haul sold, a rescue paid, an exploring run paid)
  const SOLD = P.kind === 'rescue' ? 'The rescue paid' : P.kind === 'explore' || P.kind === 'supply' ? 'The run paid' : 'The haul sold for';
  if (per) { const r = rescueOrder(m, grade, rand, paidWords(P)); if (r) return r; }
  // (A HALF CREDIT: a haul headed home early can sell for an odd 125 credits (1/8 of a tonne of nickel is 375), and a
  // tenth of that is not a whole credit. The pay is in whole credits, as it always was (payOf: to the nearest one), the
  // card says so, and it asks what the haul sold for rather than a share that does not come out whole)
  const even = Number.isInteger(P.sold * P.share / 100), form = even || formFor(P, grade) === 'count' ? formFor(P, grade) : 'add';
  const top = { from: fromOf(P) };
  const done = (o) => Object.assign(o, { payout: P.pay, form });
  // (what the right answer's line says: the pay, in every form)
  const paid = paidWords(P, even);
  const home = ownWords(P, lots.length ? `Your crew is home with ${lotsWords(lots)}` : 'Your crew is home');
  // (a run of your own, someone hired: what they take, as the slip's part and percent forms say it)
  const O = P.own ? { tenths: 10 - tenths, pct: 100 - P.share } : null;
  if (form === 'count') {
    // (the youngest: one side of the Miner, four canisters; a little older: all eight)
    const side = grade < 6, n = side ? P.canisters / 2 : P.canisters, cans = cansOf(P), allFull = P.tonnes >= P.canisters;
    return done(ownOrder({
      key: `payout:count:${side ? 'side' : 'all'}`,
      // (a question is told in canisters or in tonnes, never both: this one counts canisters, so its story does too)
      story: ownWords(P, `Your crew is home${allFull ? ' with its canisters full' : ''}. The haul sold for ${say(P.sold)} credits. Your share is ${say(P.pay)} credits${even ? '' : ', to the nearest credit'}.`),
      ask: side ? 'How many canisters are on this side of the Miner?' : ownWords(P, 'How many canisters did your crew bring home?'),
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
      story: O ? `${SOLD} ${say(P.sold)} credits. The crew you hired take ${O.tenths}/10 of it, so ${frac} of it is yours.` : `${SOLD} ${say(P.sold)} credits. Your share is ${frac} of it.`,
      ask: O ? 'How many credits are yours?' : 'How many credits is your share?',
      right: N(P.pay, CREDIT),
      slips: [
        { ...N(P.sold - P.pay, CREDIT), slip: 'rest', why: O ? `That is what your hired crew take. Yours is ${frac} of the ${say(P.sold)} credits.` : `That is the rest of it, the crew's and the captain's. Your share is ${frac} of the ${say(P.sold)} credits.` },
        ...(tenths > 1 && !half ? [{ ...N(one, CREDIT), slip: 'onePart', why: `${say(one)} credits is one tenth. ${O ? 'Yours' : 'Your share'} is ${tenths} tenths.` }] : []),
        { ...N(P.sold / 100, CREDIT), slip: 'tooSmall', why: `That cuts the ${say(P.sold)} credits into 100 parts. ${half ? 'A half is 2 equal parts.' : 'Tenths are 10 equal parts.'}` },
        { ...N(half ? P.sold / 4 : P.pay + one, CREDIT), slip: 'partOff', why: half ? 'That is a quarter. A half is one of 2 equal parts.' : `That is ${tenths + 1} tenths. ${O ? 'Yours' : 'Your share'} is ${tenths}.` },
        { ...N(P.sold - 10, CREDIT), slip: 'subtracted', why: `That takes 10 away. Cut the ${say(P.sold)} credits into ${half ? 2 : 10} equal parts instead.` },
        { ...N(P.pay + 1000, CREDIT), slip: 'off', why: 'A thousand too many. Work it out again.' },
      ].filter((s) => Number.isInteger(s.v)),
      rightWhy: half ? `${say(P.sold)} ÷ 2 = ${say(P.pay)} credits` : tenths === 1 ? `${say(P.sold)} ÷ 10 = ${say(P.pay)} credits` : `One tenth is ${say(P.sold)} ÷ 10 = ${say(one)}; ${tenths} tenths are ${tenths} × ${say(one)} = ${say(P.pay)} credits`,
      sum: half ? { op: 'div', a: P.sold, b: 2 } : tenths === 1 ? { op: 'div', a: P.sold, b: 10 } : [{ op: 'div', a: P.sold, b: 10, say: 'First one tenth of it' }, { op: 'mul', a: one, b: tenths, say: `Then ${tenths} tenths` }],
      lines: [...payoutLines(P, 'pay').slice(0, -2), [O ? 'Yours' : 'Your share', `${frac} of it`], ['Your pay', '?']],
      help: { title: 'Cut into equal parts', pic: { kind: 'sharebar', whole: P.sold, n: half ? 1 : tenths, d: half ? 2 : 10 },
        line: half ? `A half means the ${say(P.sold)} credits cut into 2 equal parts, and one of them yours.` : `${frac} means the ${say(P.sold)} credits cut into 10 equal parts, and ${tenths === 1 ? 'one of them' : `${tenths} of them`} yours.`,
        steps: half ? [`One of the 2 equal parts: ${say(P.sold)} ÷ 2`] : tenths === 1 ? [`One of the 10 equal parts: ${say(P.sold)} ÷ 10`] : [`First one tenth: ${say(P.sold)} ÷ 10`, `Then ${tenths} tenths: that × ${tenths}`] },
      own: { strand: 'frac', at: 40 }, facts: { ...top, form, sold: P.sold, share: P.share, pay: P.pay }, size: tenths > 1 && !half ? 2 : 1,
    }, rand));
  }
  return done(ownOrder({
    key: 'payout:percent',
    story: O ? `${SOLD} ${say(P.sold)} credits. The crew you hired take ${O.pct}% of it. The other ${P.share}% is yours.` : `${SOLD} ${say(P.sold)} credits. Your contract pays you ${P.share}% of it.`,
    ask: 'How many credits is your pay?',
    right: N(P.pay, CREDIT),
    slips: [
      { ...N(P.sold - P.pay, CREDIT), slip: 'rest', why: O ? `That is the ${O.pct}% your hired crew take.` : `That is the other ${100 - P.share}%: the crew's and the captain's.` },
      { ...N(P.share, CREDIT), slip: 'percentCount', why: `${P.share}% isn't ${P.share} credits. It means ${P.share} out of every 100: 10% of ${say(P.sold)} is ${say(one)}.` },
      ...(tenths > 1 ? [{ ...N(one, CREDIT), slip: 'tenOnly', why: `${say(one)} credits is 10%. ${P.share}% is ${tenths} lots of that.` }] : [{ ...N(P.sold / 100, CREDIT), slip: 'onePercent', why: `That is 1%: one part in 100. 10% is one part in 10.` }]),
      { ...N(P.pay + one, CREDIT), slip: 'tenOff', why: `That is 10% too much: ${P.share + 10}%.` },
      { ...N(P.pay / 2, CREDIT), slip: 'half', why: O ? `That is ${P.share / 2}%, half of what is yours.` : `That is ${P.share / 2}%, half of your share.` },
      { ...N(P.pay + 1000, CREDIT), slip: 'off', why: 'A thousand too many. Work it out again.' },
    ].filter((s) => Number.isInteger(s.v)),
    rightWhy: tenths === 1 ? `10% of ${say(P.sold)} is ${say(P.sold)} ÷ 10 = ${say(P.pay)} credits` : `10% of ${say(P.sold)} is ${say(one)}, so ${P.share}% is ${tenths} × ${say(one)} = ${say(P.pay)} credits`,
    sum: tenths === 1 ? { op: 'div', a: P.sold, b: 10, say: '10% is a tenth of it' } : [{ op: 'div', a: P.sold, b: 10, say: 'First 10%: a tenth of it' }, { op: 'mul', a: one, b: tenths, say: `Then ${P.share}% is ${tenths} lots of 10%` }],
    lines: [...payoutLines(P, 'pay').slice(0, -2), O ? ['Yours', `${P.share}%`] : ['Your share', `${who}: ${P.share}%`], ['Your pay', '?']],
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
    // (a run of the crew member's own, in a ship of theirs, is no contract of the captain's: they ask as ever)
    // A CAPTAIN WHOSE RUN IS NOT OFFERED YET (a mission's `offered`: the Hauler's, until the old station is found) has
    // nothing to ask: 'wait'. (No captain sells a ship: the ship store's kiosk does, src/kiosk.js.)
    state(id, crew = null) {
      const m = crew ? contractOf(crew) : null; if (m && m.captain === id && !m.own) return m.state;
      if (crew && !offeredTo(id, crew)) return 'wait';
      return states.get(id) || 'new';
    },
    open: (id, crew) => offeredTo(id, crew),
    asked(id) { if (!states.has(id)) states.set(id, 'asked'); },
    answer(captain, yes) { states.set(captain.id, yes ? 'interested' : 'declined'); tell(fns, captain, yes); },
    // (the contract's card put away unsigned: the offer stays open, and the captain asks again another time)
    declined(id) { states.set(id, 'declined'); },
    on(fn) { fns.push(fn); },
    ready: (id) => !!missionOf(id),
  };
}
export const missions = makeMissions();
