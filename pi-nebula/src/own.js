// A SHIP OF YOUR OWN: buying one, and what owning it changes. The plain part, with no page and no three.js, so node can
// test it (pi-nebula/tests/own.test.mjs): the prices, the crew member's own ships as kept, the price check and the
// spend, and how many more cards a job asks on a run of your own. In the game: src/kiosk.js is the ship store, where
// every ship is bought; src/contract.js shows the owner's own card, src/mission.js joins it to the station (the shipping
// computer, the pilot's seat of a ship that is yours), src/missions.js has the owner's pay and the hired crew's shares,
// src/trip.js flies the run and the flight.
//
// THE GAME'S MAKER, in his words:
//   - "You have to buy the ship if you want to fly it at your leisure." (2026-11-20)
//   - "If the player buys a mining ship then they can hire a crew if they wish, and take the ship out as much as they
//     want to." (2026-11-16)
//   - Whose ship (2026-11-22, BUY1-1): "I think the most simple thing is to just have the existing ships in their
//     hangers the way they are now and you can now take it out any time you want and possibly customize it. But I think
//     that if you go to the Captain for a contract then it should be just like it is now."
//   - What a run of your own pays (BUY1-2: the whole haul is yours; any crew you hire for the jobs you skip take their
//     shares): "I feel like the amount of questions that you are asked should probably go up by about 50% if you take
//     it out yourself. So you can make more, but you do more math. If you take a crew then you pay them, and you get
//     less math questions."
//   - The Hauler (BUY1-4): for sale "Once the bridge is built"; bought, flown round the station; hauling runs after the
//     other station is found. And earlier: "You can go on the hauler, but not fly it unless you have a contract to fly
//     it, or if you bought the hauler."
//   - Free flying pays nothing: "Flying to the various asteroids might be fun, but it's not math so you don't get money."
//
// SO:
//   - EACH SHIP HAS ONE PRICE (PRICES: the plan he read, ~/pw/space-math/BUYING_1.md: "the Explorer cheapest; the Medic
//     and the Miner 50,000 to 60,000; the Hauler about 80,000"). Every ship is bought at ONE PLACE, THE SHIP STORE'S
//     KIOSK in the hallway (src/kiosk.js; the game's maker, 2026-11-24: "maybe we should have a ship sales screen
//     somewhere, rather then adding that on the end of the captain's card. Maybe in a blank spot in the hallway we can
//     have a ship store kiosk that lets you browse the ships and shows their prices and lets you pick the colors and
//     stuff. Then if you buy one it will be in the hanger (or docked)."), its list in STORE's order; the Hauler once this
//     crew member's bridge to it is built; short of credits the kiosk says how many more are needed and nothing else
//     changes. No captain's card and no shipping computer sells a ship any more.
//   - BOUGHT, the credits are spent and the ship is the crew member's: kept with them (crew.ships: its id), so each crew
//     member on a device owns their own. The ship stays in its hangar as it is, and its captain goes on offering his
//     contracts on it exactly as before.
//   - YOURS, IT IS TAKEN OUT ANY TIME from its pilot's seat: a run of your own (the same run as the captain's; the whole
//     of what it brings is yours but for the operating costs, 25%, and the share of each job one of your own crew does:
//     src/missions.js signOwn, shareFor), or just flying, round the station and back, for no pay (src/trip.js `free`).
//   - ON A RUN OF YOUR OWN, THE JOBS YOU DO ASK ABOUT HALF AS MANY CARDS AGAIN (moreCards): more cards, not harder ones.
//     A job's turns are counted in the order they come on the run, and the odd half card goes to the first, the third
//     ... of them: a turn of 3 cards asks 5, the next 4, the next 5; a turn of 1 card asks 2, the next 1, the next 2; the
//     Loader's 5 ask 8. Where each comes, for each job of each run: src/missions.js OWN RUNS.
export const PRICES = { explorer: 50000, medic: 55000, miner: 60000, hauler: 80000 };
// (the ships as they are said: the fleet's own names, src/fleet.js; kept here too so this file needs nothing else)
export const SHIP_NAMES = { explorer: 'Explorer', medic: 'Medic', miner: 'Miner', hauler: 'Hauler' };
// THE KIOSK'S LIST, in the order it shows them: the cheapest first, by PRICES
export const STORE = Object.keys(PRICES).sort((a, b) => PRICES[a] - PRICES[b]);
const whole = (v) => Math.max(0, Math.floor(+v || 0));

// the crew member's own ships, as kept (tidied: ships this build knows, each once)
export function shipsOf(crew) {
  const L = crew && Array.isArray(crew.ships) ? crew.ships : [];
  return Object.keys(PRICES).filter((id) => L.includes(id));
}
export const owns = (crew, ship) => shipsOf(crew).includes(ship);

// THE KIOSK'S LIST for this crew member: each ship's sale (saleOf, below), in STORE's order
export const storeOf = (crew, { bridge = true } = {}) => STORE.map((ship) => saleOf(crew, ship, { bridge }));
// A SHIP'S SALE, for this crew member, as the kiosk says it:
//   { ship, name, price, owned, open (for sale to them now), why (not open: what it waits for), credits (theirs),
//     short (how many more they need; 0: enough), can (it can be bought now) }
// bridge: has this crew member built the bridge to the Hauler (src/jobs/dock.js bridgeStands)? The Hauler is for sale
// only then; every other ship from the start.
export function saleOf(crew, ship, { bridge = true } = {}) {
  const price = PRICES[ship];
  if (price == null) return null;
  const owned = owns(crew, ship), open = ship !== 'hauler' || !!bridge, credits = whole(crew && crew.credits), short = Math.max(0, price - credits);
  return { ship, name: SHIP_NAMES[ship], price, owned, open, why: open ? '' : 'once the bridge out to it is built', credits, short, can: !owned && open && short === 0 };
}
// THE SALE'S LINE, as the kiosk says it (S: saleOf; sure: Buy pressed once, so it asks once more before it spends), in
// the words the captains' cards had -> { kind: 'owned' | 'closed' | 'short' | 'sure' | 'can', head, sub }
const say = (n) => Number(n).toLocaleString('en-US'), credit = (n) => (n === 1 ? 'credit' : 'credits');
export function saleWords(S, { sure = false } = {}) {
  const ship = S.name;
  if (S.owned) return { kind: 'owned', head: `The ${ship} is yours`, sub: 'Take it out any time, from its pilot\'s seat.' };
  if (!S.open) return { kind: 'closed', head: `The ${ship}: ${say(S.price)} credits`, sub: `For sale ${S.why}.` };
  if (S.short > 0) return { kind: 'short', head: `Buy the ${ship}: ${say(S.price)} credits`, sub: `You have ${say(S.credits)}. You need ${say(S.short)} more ${credit(S.short)}.` };
  if (sure) return { kind: 'sure', head: `Buy the ${ship} for ${say(S.price)} credits?`, sub: `You will have ${say(S.credits - S.price)} ${credit(S.credits - S.price)} left.` };
  return { kind: 'can', head: `Buy the ${ship}: ${say(S.price)} credits`, sub: `You have ${say(S.credits)} ${credit(S.credits)}.` };
}
// BOUGHT: the price spent from the crew member's credits and the ship kept with them (crew.ships; what was paid and
// when, crew.bought[ship]) -> { ok: true, price, credits (left), ships }, or { ok: false, why: 'unknown' | 'owned' |
// 'closed' | 'short', short }: nothing changed
export function buy(crew, ship, { bridge = true, now = Date.now() } = {}) {
  const S = saleOf(crew, ship, { bridge });
  if (!crew || !S) return { ok: false, why: 'unknown', short: 0 };
  if (S.owned) return { ok: false, why: 'owned', short: 0 };
  if (!S.open) return { ok: false, why: 'closed', short: S.short };
  if (S.short > 0) return { ok: false, why: 'short', short: S.short };
  crew.credits = S.credits - S.price;
  crew.ships = [...shipsOf(crew), ship];
  crew.bought = { ...(crew.bought && typeof crew.bought === 'object' && !Array.isArray(crew.bought) ? crew.bought : {}), [ship]: { at: now, price: S.price } };
  return { ok: true, price: S.price, credits: crew.credits, ships: shipsOf(crew) };
}

// YOUR OWN CREW (the game's maker, 2026-11-24: "Once you own a ship I think you should be able to ask people if they
// want to be part of your crew, and the friendship meter should determine if they say yes"; and of the hired hands
// there were before, "I feel like just the friend mechanic will be fine"):
//   - ONCE THIS CREW MEMBER OWNS A SHIP, a tap on a person (src/friendcard.js) has one more choice, "Join my crew". They
//     say yes at FRIENDS.crew (5) pips or more (src/friends.js agreesToCrew), and no, kindly, under it; nothing changes
//     on a no, and they may be asked again whenever the player likes.
//   - THE FIVE CAPTAINS SAY NO, in their own words, whatever their meter: each has a ship of their own and stands in the
//     station offering its contracts, so none can be aboard yours as well (a helper's call, not his: the one line
//     in askCrew that says so is the one place it is made).
//   - WHO AGREED IS KEPT with the crew member's own progress (crew.myCrew: [{ id, name, look, at }], in the order they
//     agreed; look: what src/aboard.js builds them from aboard, a station person's roster id or a rescued survivor's own
//     look). No limit on how many, and nobody is let go: he asked for neither.
//   - ON A RUN OF YOUR OWN each of its three jobs is yours or one of them's, and any others ride along, as many as the
//     ship has room for (SEATS); src/missions.js signOwn, src/contract.js the owner's card.
// HOW MANY OF YOUR CREW A SHIP TAKES ON A RUN, besides you: every place to sit or lie in its rooms (src/aboardplan.js
// placesOf, from its blueprint: the Miner 6, the Medic 8, the Explorer 7, the Hauler 7) less your own; the Medic keeps
// four more for the people it brings home (6 pods at most: its two patient beds and four of those places;
// src/rescueplan.js restOrder). tests/own.test.mjs holds these to the blueprints.
export const SEATS = { explorer: 6, medic: 3, miner: 5, hauler: 6 };
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
// the crew member's own crew, as kept (tidied: each person once, with an id)
export function crewOf(crew) {
  const L = crew && Array.isArray(crew.myCrew) ? crew.myCrew : [], seen = new Set(), out = [];
  for (const p of L) { if (!isObj(p) || !p.id || seen.has(p.id)) continue; seen.add(p.id); out.push({ id: String(p.id), name: String(p.name || 'Someone'), look: p.look ?? p.id, at: +p.at || 0 }); }
  return out;
}
export const onCrew = (crew, id) => crewOf(crew).some((p) => p.id === id);
// ASKED TO JOIN THE CREW: who = { id, name, look, captain (a captain of the station's) }; pips: their meter now ->
//   { yes, why: 'joined' | 'already' | 'ship' (no ship of the crew member's yet) | 'captain' | 'friends' (under 5) }
//   (yes: kept with the crew member: crew.myCrew)
export function askCrew(crew, who, pips, { need = 5, now = Date.now() } = {}) {
  if (!crew || !who || !who.id) return { yes: false, why: 'unknown' };
  if (!shipsOf(crew).length) return { yes: false, why: 'ship' };
  if (onCrew(crew, who.id)) return { yes: true, why: 'already' };
  if (who.captain) return { yes: false, why: 'captain' };
  if (!(+pips >= need)) return { yes: false, why: 'friends' };
  crew.myCrew = [...crewOf(crew), { id: String(who.id), name: String(who.name || 'Someone'), look: who.look ?? who.id, at: now }];
  return { yes: true, why: 'joined' };
}

// HOW MANY CARDS A TURN OF A JOB ASKS ON A RUN OF YOUR OWN: half as many again as the captain's contract asks (n), the
// odd half card going to the job's first, third, fifth ... turn of the run (turn: 0 for its first)
export const OWN = { more: 1.5 };
export const moreCards = (n, turn = 0) => (n > 0 ? (turn % 2 === 0 ? Math.ceil(n * OWN.more) : Math.floor(n * OWN.more)) : 0);
