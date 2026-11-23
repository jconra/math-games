// CAPTAIN VEGA'S EXPLORING RUN, ITS PLAN (plain: no page and no three.js, so node can test it: tests/explore.test.mjs).
// src/missions.js 'explore' is the run as a mission (its contract, its steps, its pay); this is what each run is about:
// its scenario, how many jumps out, where each comes out, what the sensor operator's scan there leads to, the finding at
// the end, and what Captain Vega says along the way. src/trip.js flies it; src/explore.js is each place out there.
//
// THE GAME'S MAKER (2026-11-22, EXPL1-1): "I would like it if there are a couple different scenarios, so it's not
// always the exact same thing. I expect that finding something on the ground will be different from finding a valuable
// asteroid field in space. But it should all be the process of following a weak signal, a hunch, or looking in some yet
// unexplored area. Maybe Capt Vega can say something about a mysterious deviation in gravity in this sector that we
// want to examine more closely. But each mystery should be answered with more questions and some kind of finding. A new
// world where question about mysterious mass was asked. A wrecked crew where a mysterious faint signal was detected. A
// alien artifact from a rumor or some writing that was found. It doesn't always have to be the same amount of jumps and
// finding more information and jumping. Some can be more or less. Lets just keep it interesting". His pick there (C):
// the land below is surveyed, and the scan also picks up a signal from further off, which the next jump follows.
// (RESC3-1): "For the explorer the 3rd job is the sensor operator, to help find the next location to jump to and
// discover the secrets (detect radio signals, scan asteroid fields, detect mysterious gravity)". (EXPL1-2, the station
// in distress): "I think maybe it should be quickly discovered after the radio tower is repaired. And if the radio tower
// is not repaired I think Capt Vega should mention that we might be able to find more signals if the radio tower was
// built." (STA2-3 A, at the other station): the Explorer flies round it and looks; its people talk by radio and say what
// they need; jump home.
//
// SO A RUN IS A SCENARIO (SCENARIOS), picked by chance from the run's seed (kept with the contract as it is signed, so a
// reload flies the same one), and so many LEGS: each leg a jump out to a place and the sensor operator's scan there.
// Every leg but the last comes out above some land nobody has mapped (a moon, a canyon world, a meadow world: the
// Planet Lab's own planets), and its scan of the land below picks up the next lead from further off (the signal
// clearer, the pull stronger, the writing pointing on): a jump to it. The last leg comes out at the finding, and its
// scan finds it:
//   world      a mysterious mass ("a strange pull" on the instruments): a new world nobody has charted, named as it is
//              found (one of the six names the station's speakers say: src/announce.js), 1 to 3 jumps
//   wreck      a faint signal: a crashed ship on a planet, its crew asleep in their stasis pods (the rescue run's own
//              wreck and pods); a find only, the Medic's run is the rescue; 2 or 3 jumps
//   field      a hunch about the edge of the sector nobody has mapped: a rich asteroid field out in space; 1 or 2 jumps
//   artifact   an old trader's rumour of writing on a moon: the writing found, pointing on, and a thing standing on a
//              planet that nobody we know could have made; 2 or 3 jumps
//   distress   only once the station's radio tower is repaired, on the next exploring run (then never again): a call
//              for help it heard, traced on a moon to open space and an old station there in distress; the Explorer
//              flies round it, its people say by radio what they need; 2 jumps
// Where a scan finds the finding on the ground a beam rises on it (the rescue's way to the wreck: src/planet/guide.js)
// and the crew's pilot flies over toward it; out in space the field or the station is there to fly to and round.
// While the tower is not repaired Vega says, at the finding, that with it they might hear more signals.
//
// NO ANSWER CHANGES ANY OF IT: what is found is the run's, from its seed, as what a mining haul brings home is.
//
//   planOf(seed, { antenna, found })   -> the run: { seed, scenario, legs: [{ i, last, place, lead }], find, name, talk }
//       antenna: the station's radio tower is repaired (antennaUp); found: what this crew member has found already
//       (their crew.explored: the distress call is heard once, a world's name is not given twice)
//   antennaUp(crew)                    the one flag read from the radio tower's repair (its job: another helper's)
//   foundOf(crew), keepFind(crew, plan)   what has been found, kept with the crew member
import { rng, subSeed } from './planet/noise.js';
import { newSeed } from './planet/kinds.js';

// THE STATION'S RADIO TOWER, REPAIRED: one saved value, kept with the crew member by the tower's own repair job at the
// control room's radio desk (src/jobs/antenna.js, another helper's, built at the same time as this: its job's own
// record, crew.jobs.antenna = { repaired: true, ... }, read there by antennaRepaired(crew)). Read here the same way and
// defensively, without that file: anything else (or nothing: the tower's job not in this build) is not repaired.
export const antennaUp = (crew) => !!(crew && crew.jobs && typeof crew.jobs === 'object' && crew.jobs.antenna && crew.jobs.antenna.repaired === true);

// the six names the station's speakers can say of a new world (src/announce.js 'planet-...': recorded)
export const WORLD_NAMES = ['Kepler Blue', 'Ora', 'New Tethys', 'Vesper', 'Lumen', 'Halcyon'];

// THE PLACES a leg comes out at: above land (a planet's kind, src/planet/kinds.js), or out in space
//   land: { where: 'land', kind, seed, show: null | 'wreck' | 'artifact' }   space: { where: 'space', show: 'field' | 'station', seed }
// THE LINES (Vega's, in a bubble, as every captain's on a run: src/lines.js RUN_TALK). {player}: the crew member's name;
// {sensor}: whoever scans (the crew member, or his own sensor operator); {pilot}: his own pilot; {name}: a new world's
export const SCENARIOS = {
  world: {
    id: 'world', name: 'A new world', legs: [1, 3], noun: 'the strange pull', finds: 'a new world', place: 'world',
    out: ['Clear of the station. Something out here pulls on our instruments, a lot of mass where the charts show nothing. Work out the jump, pilot.'],
    crewOut: ['Clear of the station. Something out here pulls on our instruments. {pilot}, take us toward it.'],
    arrive: ['A moon nobody has mapped. Scan the land below, {sensor}.', 'Rock and dust, and no name on any chart. Scan the land below, {sensor}.'],
    lead: ['The pull doesn\'t come from this moon. It\'s stronger further out. What could be that heavy? Plot the jump, pilot.', 'Stronger again, and still further out. What is it? Plot the jump, pilot.'],
    there: ['Look at that! Land, right where the pull is. Scan it, {sensor}.'],
    found: ['Air, water and plants: a world people could live on, and nobody knew it was here! I\'ll call it {name}.', 'How did nobody ever chart a whole world? What else is out here that we can\'t see?'],
  },
  wreck: {
    id: 'wreck', name: 'A faint signal', legs: [2, 3], noun: 'the faint signal', finds: 'a wrecked ship', place: 'wreck',
    out: ['Clear of the station. Our scanner caught a faint signal out this way, too weak to read. Work out the jump, pilot.'],
    crewOut: ['Clear of the station. Our scanner caught a faint signal out this way. {pilot}, take us toward it.'],
    arrive: ['Nothing here but rock. Scan the land below, {sensor}. Maybe the signal bounces off it.', 'Still faint. Scan the land below, {sensor}.'],
    lead: ['There it is again, a little clearer, from further on. It repeats: somebody made it. Plot the jump, pilot.', 'It\'s a ship\'s beacon, very weak. It comes from further on. Plot the jump, pilot.'],
    there: ['The signal is strong here. It comes from the ground. Scan the land below, {sensor}.'],
    found: ['A crashed ship! Its stasis pods are still running. Someone is asleep in them.', 'Who are they, and how long have they been here? Captain Hale must hear of this.'],
  },
  field: {
    id: 'field', name: 'The edge of the map', legs: [1, 2], noun: 'the edge of the map', finds: 'a rich asteroid field', place: 'field',
    out: ['Clear of the station. Nobody has mapped the edge of this sector. I have a hunch about it. Work out the jump, pilot.'],
    crewOut: ['Clear of the station. Nobody has mapped the edge of this sector. {pilot}, take us out there.'],
    arrive: ['A moon nobody has mapped. Scan the land below, {sensor}.'],
    lead: ['Metal dust in the craters, blown here from further out. Where did it come from? Plot the jump, pilot.'],
    there: ['Look at all those rocks! Scan them, {sensor}.'],
    found: ['Ore in every rock, and nobody has a claim out here! Captain Ruiz will want to hear of this.', 'But how did so much metal end up in one place?'],
  },
  artifact: {
    id: 'artifact', name: 'The old trader\'s rumour', legs: [2, 3], noun: 'the writing', finds: 'something nobody we know made', place: 'artifact',
    out: ['Clear of the station. An old trader told me of strange marks on a moon out this way. Work out the jump, pilot.'],
    crewOut: ['Clear of the station. An old trader told me of strange marks on a moon out this way. {pilot}, take us there.'],
    arrive: ['This could be the moon he meant. Scan the land below, {sensor}.', 'More rock. Scan the land below, {sensor}.'],
    lead: ['There are the marks, cut into the rock in long lines. Writing! And it points further out. Plot the jump, pilot.', 'The same writing again, pointing on, further still. Plot the jump, pilot.'],
    there: ['The writing pointed here. Scan the land below, {sensor}.'],
    found: ['There! Something stands down there that nobody we know could have made.', 'Who left it here, and what does the writing say?'],
  },
  distress: {
    id: 'distress', name: 'A call for help', legs: [2, 2], noun: 'the call', finds: 'a station in distress', place: 'station', needs: 'antenna', once: true,
    out: ['Clear of the station. The radio tower heard a call for help from out this way. Work out the jump, pilot.'],
    crewOut: ['Clear of the station. The radio tower heard a call for help from out this way. {pilot}, take us toward it.'],
    arrive: ['The call is louder here. Scan the land below, {sensor}. It may be bouncing off this moon.'],
    lead: ['Not from here. It comes from further on, out in open space. Plot the jump, pilot.'],
    there: ['A station! Nobody knew there was another one out here.'],
    found: ['Hold on, we hear you. We\'ll go home and bring help.'],
    // (its people on the radio, as the Explorer flies round it: STA2-3 A)
    radio: ['Explorer, we hear you! Our power is failing and we are running short of food.', 'Our old supply ship broke down years ago. Can you bring us fuel cells, food and spare parts?'],
  },
};
export const SCENARIO_IDS = Object.keys(SCENARIOS);
// (by chance: the four of the game's maker's own words, each as likely; the distress call only as said above)
const CHANCE = ['world', 'wreck', 'field', 'artifact'];
// the line while the station's radio tower is not repaired (his EXPL1-2), said once a run, at the finding
export const TOWER_LINE = 'If the station\'s radio tower were working, we might hear more signals out here.';
// the lines every run shares: the finding done, the jump home asked for
export const COMMON = {
  homeward: ['Let\'s take this home. Work out the jump, pilot.'],
  homewardCrew: ['Let\'s take this home. {pilot}, the jump is yours.'],
};

// what this crew member has found on Vega's runs (kept with them: crew.explored = { runs, worlds: [names], distress })
export function foundOf(crew) {
  const e = crew && crew.explored && typeof crew.explored === 'object' ? crew.explored : {};
  return { runs: Math.max(0, Math.floor(+e.runs || 0)), worlds: Array.isArray(e.worlds) ? e.worlds.filter((w) => WORLD_NAMES.includes(w)) : [], distress: !!e.distress, finds: Array.isArray(e.finds) ? e.finds.slice(-20) : [] };
}
// home from a run: what it found, kept (a world's name not given again; the call for help heard)
export function keepFind(crew, plan) {
  if (!crew || !plan) return null;
  const f = foundOf(crew);
  f.runs++;
  if (plan.scenario === 'world' && plan.name && !f.worlds.includes(plan.name)) f.worlds.push(plan.name);
  if (plan.scenario === 'distress') f.distress = true;
  f.finds.push({ scenario: plan.scenario, seed: plan.seed, ...(plan.name ? { name: plan.name } : {}) });
  crew.explored = f;
  return f;
}

// THE RUN, from its seed. antenna: the radio tower repaired; found: foundOf(crew)
export function planOf(seed, { antenna = false, found = null } = {}) {
  const s = Math.max(1, Math.floor(+seed || 1)), R = rng(subSeed(s, 'explore')), F = found || foundOf(null);
  const id = antenna && !F.distress ? 'distress' : CHANCE[Math.min(CHANCE.length - 1, Math.floor(R() * CHANCE.length))];
  const S = SCENARIOS[id], n = S.legs[0] + Math.min(S.legs[1] - S.legs[0], Math.floor(R() * (S.legs[1] - S.legs[0] + 1)));
  // (each place's own seed, from the run's: a planet of the kind asked for)
  const seedR = rng(subSeed(s, 'explore places')), kindSeed = (kind) => newSeed(kind, seedR);
  // (the land below on the way: a moon most of the time, now and then a canyon world)
  const wayKind = () => (seedR() < 0.7 ? 'moon' : 'canyon');
  const legs = [];
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    let place;
    if (!last) { const kind = wayKind(); place = { where: 'land', kind, seed: kindSeed(kind), show: null }; }
    else if (S.place === 'world') place = { where: 'land', kind: 'meadow', seed: kindSeed('meadow'), show: null };
    else if (S.place === 'wreck') { const kind = seedR() < 0.5 ? 'canyon' : seedR() < 0.5 ? 'moon' : 'meadow'; place = { where: 'land', kind, seed: kindSeed(kind), show: 'wreck' }; }
    else if (S.place === 'artifact') { const kind = seedR() < 0.6 ? 'canyon' : 'moon'; place = { where: 'land', kind, seed: kindSeed(kind), show: 'artifact' }; }
    else place = { where: 'space', show: S.place === 'field' ? 'field' : 'station', seed: 1 + Math.floor(seedR() * 999999) };
    // (the lead the jump to this place follows, said in the jump computer's cards: src/jobs/pilot.js)
    legs.push({ i, last, place, lead: S.noun, scan: !(last && place.show === 'station') });
  }
  // (a new world's name: one this crew member has not found yet, if any is left)
  let name = null;
  if (id === 'world') { const left = WORLD_NAMES.filter((w) => !F.worlds.includes(w)), L = left.length ? left : WORLD_NAMES; name = L[Math.floor(R() * L.length)]; }
  return { seed: s, scenario: id, name, legs, places: n, antenna: !!antenna, find: { kind: S.place, what: S.finds }, talk: talkOf(S, { antenna }) };
}

// THE RUN'S LINES, for the trip (src/trip.js: RUN_TALK's shape, one list for each moment): the run's own on top of the
// ones every exploring run has (src/lines.js RUN_TALK.explore)
function talkOf(S, { antenna }) {
  return { out: S.out, crewOut: S.crewOut, arrive: S.arrive, lead: S.lead, there: S.there, found: S.found, radio: S.radio || [], tower: antenna ? [] : [TOWER_LINE], homeward: COMMON.homeward, homewardCrew: COMMON.homewardCrew };
}

// THE STATION'S NEWS OF A FINDING (src/trip.js, home): a new world is the station's own 'planet' news (its recorded
// line names it: src/announce.js); anything else found is a 'find', its words a line no clip says (shown, the chime
// first: announce.js TEXT LINES, the rescue's outcome's way), in the manner of the recorded news, and what the station's
// people say of it (src/lines.js 'find-1'). -> { kind, ... } for news.add, or null
const ON = { moon: 'on a cratered moon', meadow: 'on a meadow world', canyon: 'in a canyon world' };
export function findNews(plan) {
  if (!plan) return null;
  if (plan.scenario === 'world') return plan.name ? { kind: 'planet', planet: plan.name } : null;
  const end = plan.legs[plan.legs.length - 1].place, on = ON[end.kind] || 'out past the charts';
  const what = { wreck: `a crashed ship ${on}, its crew asleep in their stasis pods`, artifact: `something nobody we know could have made, standing ${on}`,
    field: 'a rich asteroid field past the edge of the charts', distress: 'an old station far out in open space, its people in need of help' }[plan.scenario];
  if (!what) return null;
  return { kind: 'find', ship: 'Explorer', captain: 'Captain Vega', what, text: `News from the Explorer. Captain Vega's crew has found ${what}.` };
}

// WHAT A RUN PAYS (the game's maker, RESC1-2, of the rescue: "It needs to be a similar payout to what a mining mission
// pays. So it would be nice to know how long it takes and use that to figure out how much it should pay"; and of the
// exploring run, EXP-2: "I feel like now we just get paid for the knowledge we bring back"). So much for each place
// explored (each jump out and what was learned there), the same on every run: a run of more jumps is longer and pays
// more. Set from the run's length against the mining run's: ~/pw/space-math/EXPLORE_2.md.
export const EXPLORE = { perPlace: 9000 };
