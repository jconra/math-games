// THE CHECKLIST: everything a rider can DO in the game as one list, so a grown-up can say "get to 100%" or pin a goal
// ("Silver buckle: cattle corralled"). It counts what a kid does, never how hard their math is: a kid who can't read yet
// can still fill it, one rope, one hat and one camp at a time. Each item is one point; the percent is the points done.
// Pure: no page, no three.js, no storage (the caller saves); tests/completion.test.mjs checks it.
//
// The groups, and how each item is checked (from what the rider already keeps, so an old save gets credit at once):
//   buckles   every job's four belt buckles (save.js JOBS and BUCKLES: the counts in rider.stats.jobs)
//   buy       everything for sale: the saddles and horses at the stable (every coat), the hats and dogs at the general
//             store, one of each farm animal (bought, or a thank-you lamb, piglet or calf) and each piece of cabin
//             furniture (src/cabin/slots.js); the cabin itself once it can be bought (COMING.cabin); the six-shooter
//             only for a rider with "Bandits: lasso or revolver" on (src/gun.js) or who has bought it
//   collect   deer photographs (rider.stats.jobs.photos, or the album), the keepsakes in the cabin (a job's tin buckle,
//             then seen at home: rider.found.keepsake), the gang's loot caches (the loot handed back: rider.topics.loot
//             trips, and an old save's woods; or an old hideout reached: rider.found.hideout)
//   places    the camps out in the valley (ridden up to: rider.found.place), and the places still to come (COMING): the
//             windmill (done at an 18 ft tower standing), the bridge, the fishing hole
// An entry for something the game doesn't have yet waits in COMING: it isn't shown or counted until its switch is on,
// so 100% always means everything there is today. Likewise a job a grown-up turned off (save.js jobOn): its buckles,
// keepsake, photos or hideouts (and a pig or sheep that only its thank-you unlocks) leave the list, except what is
// already done, so 100% stays in reach.
//
//   completion(rider, { all })   -> { pct, done, total, groups: [{ id, name, pct, done, total, items }], items, coming }
//                                   Item = { id, name, group, sub, done, have, need, hint, how }
//                                   (have/need: how far along, e.g. 37 of 50 cattle; for a thing to buy, the gold in
//                                   hand toward its price; hint = how = one plain line saying how to get it)
//                                   pct is a whole number (rounded) that only reads 100 when every item is done.
//                                   all: also the entries still waiting in COMING and those of jobs turned off.
//                                   coming: the names of the COMING entries, for a "more to come" line
//   unlocked(rider)   -> [Item] done now but not yet in rider.done; adds them to rider.done (the caller saves and toasts).
//                        The first call for a rider with no rider.done takes everything already done as announced and
//                        returns [] (an old save gets no flood of toasts); the caller saves then too. An item that is
//                        one of the rider's goals comes back with goal: true (and the goal is stamped doneAt).
//   goalChoices(rider) -> [Goal]   the grown-ups' goal picker: a short list, not every item. One row per job's buckles
//                         ('goal:buckles:<job>': it aims at the next buckle not won yet, and moves on to the next one when
//                         it is won; tiers: the four buckles, each { tier, id, done, need }, so one exact buckle can be
//                         pinned by its 'buckle:<job>:<tier>' id), one for everything to buy ('goal:buy': 12 / 30 bought),
//                         one per collection ('goal:collect:<photos|keepsake|hideout>') and one for every place
//                         ('goal:places'). Only goals not reached yet; the jobs under way first.
//   goalsOf(rider)     -> [Goal]   rider.goals with their progress now (old goals on an item the picker no longer offers
//                         read as the goal that holds it: save.js upgradeGoals)
//                         Goal = { id, name, have, need, done, pct, hint, group, sub, line, of, tiers? }
//                         line = progressLine: the progress in words, to show beside the bar; of = the item id it is
//                         aimed at now, for its picture (a buckle's next tier, or 'buy:all', 'collect:photos', 'place:all')
//   progressLine(item) -> "37 / 50" | "45 / 60 gold" | "You have the gold!" (not bought yet: never "60 / 60") | "Not yet" | "Done"
//   setGoal(rider, id) -> true when it is pinned (a goal's id, or a buckle's; another item's id pins the goal holding it) (MOST_GOALS at most; a goal already reached makes room for a new
//                         one); false for an unknown or finished item, or with MOST_GOALS unfinished goals pinned
//   clearGoal(rider, id) -> true when it was pinned
//   notice(rider, { place, hideout, home })   what the world sees the rider do (src/ui/completion.js calls it about
//                        once a second): place = a camp's id ridden up to ('cow'), hideout = a gang hideout's id reached,
//                        home = inside the cabin (the keepsakes earned so far are seen). -> true when something changed
//   markFound(rider, kind, id), found(rider)   the rider.found lists ('place' | 'hideout' | 'keepsake')
//   setWindmill(rider, feet)   the tallest tower the rider has had standing through the wind test (src/windmilljob.js)
//   CAMP_PLACES, HIDEOUTS, COMING, MOST_GOALS, GROUPS
//
// Rider fields (save.js keeps unknown fields as they are; everything here is read defensively):
//   rider.done    ['buckle:cattle:tin', ...]   the items already announced
//   rider.goals   [{ id, at, doneAt? }]        the goals pinned (at: when, ms since 1970): 'goal:...' or 'buckle:...' ids
//   rider.found   { place: ['camp-cow'], hideout: ['hollow'], keepsake: ['cattle'], windmill: feet }
// Item ids never change once shipped (goals and rider.done keep them): 'buckle:<job>:<tier>', 'buy:<kind>:<id>'
// (saddle, horse, hat, dog, animal, furniture, cabin, gun), 'collect:<kind>:<id>' (photos, keepsake, hideout), 'place:<id>'.
import { JOBS, BUCKLES, BUCKLE_NAMES, KEEPSAKES, jobCount, jobOn, goalIdOf, upgradeGoals } from './save.js';
import { PRICES, SADDLES, HORSES, DOGS, REVOLVER } from './catalog.js';
import { gunOn, ownsGun } from './gun.js';
import { HATS } from './hats.js';
import { SLOTS } from './cabin/slots.js';
import { ANIMALS, KINDS } from './math/goods.js';

// The places out in the valley, copied from the files that draw them (they need three.js, which the node tests can't
// load): the camps (src/camps.js CAMPS) and the gang's hideouts (src/missions/loot.js CACHES). The test checks the copies.
export const CAMP_PLACES = [
  { id: 'cow', name: 'The Bar T cow camp', where: 'out west of town' },
  { id: 'hollis', name: 'The Hollis family camp', where: 'out east, past the pasture' },
  { id: 'survey', name: 'The surveyors\' camp', where: 'up north, across the creek from the farm' },
];
export const HIDEOUTS = [
  { id: 'hollow', name: 'The hollow by the western woods' },
  { id: 'timber', name: 'The timber past the farm' },
  { id: 'thicket', name: 'The thicket above the lake' },
  { id: 'meadow', name: 'The far meadow' },
  { id: 'pines', name: 'The pines past the cow camp' },
];

// Entries for things the game doesn't have yet. Turn one on the day its thing ships (and set the rider field it reads).
export const COMING = {
  cabin: true,       // buying the cabin itself (src/catalog.js PRICES.cabin): done at rider.owned.home === 'cabin'
  windmill: true,    // the windmill on the mill hill (src/windmilljob.js): done at an 18 ft tower standing (setWindmill)
  bridge: true,      // the bridge over the west river (src/bridgejob.js): done at markFound(rider, 'place', 'bridge'), a bridge that carries horse and rider
  fishing: true,     // the dock on the lake south of town (src/fishingjob.js): done at markFound(rider, 'place', 'fishing'), the first fish landed
};
export const WINDMILL_FEET = 18;   // the windmill's tower counts as done at this height standing (a good, tall tower)
export const MOST_GOALS = 2;       // goals a grown-up can pin on a rider at once
// deer photographs: the counts that are each an item (the album holds 24 prints: src/ui/album.js ALBUM.max)
export const PHOTO_STEPS = [1, 6, 12, 24];

export const GROUPS = [
  { id: 'buckles', name: 'Belt buckles' },
  { id: 'buy', name: 'Things to buy' },
  { id: 'collect', name: 'Collections' },
  { id: 'places', name: 'Places' },
];

// how each job's buckles are won, in a line
const JOB_HOW = {
  cattle: 'Rope the right numbers at the round-up in the pasture.',
  boxes: 'Crack lock boxes at the sheriff\'s desk or at your cabin table.',
  sheep: 'Heal the sick sheep at the farm north of town.',
  orders: 'Mind the counter at the general store and fill the orders.',
  pigs: 'Pen the loose pigs at the farm.',
  bandits: 'Pick Protect the wagon on the jobs board, ride to the held-up wagon and rope the gang.',
  deliveries: 'Take an order from a camp\'s foreman, make it up at the store and ride the crates out.',
  loot: 'Loot the gang: the deputy outside the sheriff\'s office says where the stash is.',
  targets: 'Shoot bottles and tin cans at the target range on the east edge of town.',
  tower: 'Build the miller a windmill tower on the mill hill that stands in the wind: every foot it stands counts.',
  loads: 'Build the engineer\'s bridge over the west river and send loads across it.',
  fish: 'Fish off the dock at the lake south of town: every fish landed counts.',
};
// where each keepsake hangs (save.js KEEPSAKES has its name and the buckle that brings it)
const KEEP_WHERE = {
  cattle: 'on the back wall', boxes: 'by the stove', sheep: 'by the door', orders: 'on the table',
  pigs: 'on a shelf', bandits: 'on the wall', deliveries: 'high on the front wall', loot: 'by the back wall',
  targets: 'on a shelf over the table', tower: 'on the windowsill over the table', loads: 'on a shelf by the front corner',
  fish: 'on the back wall',
};
const FARM_HOW = {
  hen: (p) => `The general store sells hens for ${p} gold.`,
  pig: (p) => `Pen a whole batch of pigs at the farm and the farmer thanks you with a piglet. Then the store sells pigs (${p} gold).`,
  sheep: (p) => `Heal a whole flock at the farm and the farmer thanks you with a lamb. Then the store sells sheep (${p} gold).`,
  cow: (p) => `Rope whole waves at the round-up and the rancher thanks you with a calf. Then the store sells milk cows (${p} gold).`,
};

const whole = (v) => { v = Number(v); return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0; };
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const strs = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []);
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// what the rider has found (read only: a missing or damaged field reads as empty)
export function found(rider) {
  const f = obj(rider && rider.found);
  return { place: strs(f.place), hideout: strs(f.hideout), keepsake: strs(f.keepsake), windmill: whole(f.windmill) };
}
// adds one id to a rider.found list. -> true when it is new (the caller saves)
export function markFound(rider, kind, id) {
  if (!rider || !['place', 'hideout', 'keepsake'].includes(kind) || typeof id !== 'string' || !id) return false;
  const f = rider.found = { ...obj(rider.found) };
  const list = strs(f[kind]);
  if (list.includes(id)) { f[kind] = list; return false; }
  f[kind] = [...list, id];
  return true;
}
export function setWindmill(rider, feet) {
  if (!rider) return false;
  const f = rider.found = { ...obj(rider.found) }, ft = whole(feet);
  if (ft <= whole(f.windmill)) return false;
  f.windmill = ft; return true;
}

// the things a rider owns, each as a set of ids (an old save's single fields read as part of the list)
function ownedSets(rider) {
  const o = obj(rider && rider.owned), look = obj(rider && rider.look);
  const saddles = new Set(strs(o.saddles)); if (typeof o.saddle === 'string') saddles.add(o.saddle);
  const horses = new Set(strs(o.horses)); if (typeof o.horse === 'string') horses.add(o.horse);
  const hats = new Set(strs(o.hats)); if (typeof look.hatStyle === 'string') hats.add(look.hatStyle);
  const dogs = new Set((Array.isArray(o.dogs) ? o.dogs : []).map((d) => d && d.kind).filter((k) => typeof k === 'string'));
  if (o.dog && typeof o.dog.kind === 'string') dogs.add(o.dog.kind);
  const animals = new Set((Array.isArray(o.animals) ? o.animals : []).map((a) => a && a.kind).filter((k) => typeof k === 'string'));
  const furniture = new Set(strs(o.cabin));
  const unlocked = new Set(strs(obj(o.farm).unlocked));   // (the farm kinds the store sells this rider: src/math/goods.js)
  return { saddles, horses, hats, dogs, animals, furniture, unlocked, home: o.home === 'cabin', gold: whole(rider && rider.gold) };
}

// every entry on the checklist, worked out for this rider now. live: false = waiting in COMING. by: the jobs (save.js
// MISSIONS ids) it takes; while a grown-up has every one of them turned off it is off: true and left out (an item already
// done stays in, so nothing earned is lost and 100% stays reachable)
function allItems(rider) {
  const out = [], own = ownedSets(rider), F = found(rider);
  const add = (group, sub, id, name, how, have, need, done, live = true, by = null) => {
    need = Math.max(1, whole(need)); have = Math.min(whole(have), need);
    const off = !done && Array.isArray(by) && by.length > 0 && !by.some((m) => jobOn(rider, m));
    out.push({ id, name, group, sub, done: !!done, have: done ? need : have, need, hint: how, how, live, ...(off ? { off: true } : {}) });
  };
  // a thing to buy: done once owned; until then the gold in hand toward its price
  const buy = (sub, kind, id, name, price, how, has, live = true, by = null) => add('buy', sub, `buy:${kind}:${id}`, name, how, own.gold, price, has, live, by);

  // the belt buckles: every job the game has (the target range is for every rider: no job is one mode's only)
  for (const j of JOBS) {
    if (!j.ready) continue;
    const n = jobCount(rider, j.id);
    BUCKLES.forEach((tier, k) => add('buckles', j.name, `buckle:${j.id}:${tier}`, `${BUCKLE_NAMES[tier]} buckle: ${lower(j.name)}`,
      JOB_HOW[j.id] || `${j.name}: keep at it.`, n, j.at[k], n >= j.at[k], true, j.by));
  }

  // the cabin (once it can be bought), and everything for sale
  buy('Your cabin', 'cabin', 'home', 'Your own cabin', PRICES.cabin, `The cabin in town is for sale: ${PRICES.cabin} gold. Walk up to its door.`, own.home, COMING.cabin);
  for (const s of SADDLES) buy('Saddles', 'saddle', s.id, s.name, PRICES.saddle[s.id], `The stable sells it for ${PRICES.saddle[s.id]} gold.`, own.saddles.has(s.id));
  for (const h of HORSES) {
    if (PRICES.horse[h.id] == null) continue;   // (the donkey comes free: every rider's first)
    buy('Horses', 'horse', h.id, h.name, PRICES.horse[h.id], `The stable sells ${h.id === 'donkey' ? 'him' : 'this one'} for ${PRICES.horse[h.id]} gold.`, own.horses.has(h.id));
  }
  for (const h of HATS) {
    if (PRICES.hat[h.id] == null) continue;     // (the old cowboy hat comes free)
    buy('Hats', 'hat', h.id, h.name, PRICES.hat[h.id], `The general store sells it for ${PRICES.hat[h.id]} gold.`, own.hats.has(h.id));
  }
  // a dog: one counts (any breed); more are the rider's own choice (the game's maker: "just 1 dog. More are optional")
  const cheap = DOGS.filter((d) => PRICES.dog[d.id] != null).sort((x, y) => PRICES.dog[x.id] - PRICES.dog[y.id])[0];
  if (cheap) buy('Dogs', 'dog', 'any', 'A dog of your own', PRICES.dog[cheap.id], `The general store has dogs from ${PRICES.dog[cheap.id]} gold. Pick any; you name it.`, own.dogs.size > 0);
  // (a pig or a sheep is for sale once its job's thank-you has come: with that job turned off and the kind not unlocked
  // yet, it can't be had)
  const FARM_JOB = { pig: 'pigs', sheep: 'sheep' };
  for (const k of KINDS) {
    const A = ANIMALS[k], by = FARM_JOB[k] && !own.unlocked.has(k) ? [FARM_JOB[k]] : null;
    buy('Farm animals', 'animal', k, k === 'cow' ? 'A milk cow' : `A ${A.name.toLowerCase()}`, A.price, FARM_HOW[k](A.price), own.animals.has(k), true, by);
  }
  for (const s of SLOTS) buy('Cabin furniture', 'furniture', s.id, s.name, s.price, `In your cabin, look at its empty spot and press E: ${s.price} gold.`, own.furniture.has(s.id));
  // the six-shooter: on the list only for a rider whose grown-up set "Bandits: lasso or revolver" (src/gun.js), or who
  // has it already (nothing bought leaves the list)
  buy('The six-shooter', 'gun', REVOLVER.id, REVOLVER.name, PRICES.revolver, `The general store sells it for ${PRICES.revolver} gold.`, ownsGun(rider));
  if (!ownsGun(rider) && !gunOn(rider)) out[out.length - 1].off = true;

  // collections: deer photographs, the keepsakes, the gang's hideouts
  const album = Array.isArray(rider && rider.album) ? rider.album.length : 0;
  const photos = Math.max(jobCount(rider, 'photos'), album);
  for (const n of PHOTO_STEPS) {
    add('collect', 'Deer photographs', `collect:photos:${n}`, n === 1 ? 'A deer photograph' : n >= PHOTO_STEPS[PHOTO_STEPS.length - 1] ? `A full album: ${n} deer photographs` : `${n} deer photographs`,
      'Borrow Miss Wren\'s camera (she waits near the deer) and photograph the deer with the answer.', photos, n, photos >= n, true, ['hunt']);
  }
  for (const j of JOBS) {
    const k = KEEPSAKES[j.id]; if (!j.ready || !k) continue;
    const at = j.at[Math.max(0, BUCKLES.indexOf(k.from))], n = jobCount(rider, j.id), won = n >= at;
    const seen = F.keepsake.includes(j.id);
    const how = won ? `It's waiting ${KEEP_WHERE[j.id] || 'in your cabin'}: go into your cabin to see it.`
      : `Win the ${(BUCKLE_NAMES[k.from] || 'first').toLowerCase()} buckle for ${lower(j.name)}, then go into your cabin to see it ${KEEP_WHERE[j.id] || ''}.`.replace(/ \.$/, '.');
    add('collect', 'Keepsakes', `collect:keepsake:${j.id}`, k.name, how, won ? at : n, at, won && seen, true, j.by);
  }
  // (the gang's caches, counted by the loot handed back: each cache is somewhere new, so the rows keep the old hideouts'
  // ids for old saves and their goals, and a hideout an old save reached still counts as its row)
  const L = obj(rider && rider.topics && rider.topics.loot), trips = whole(L.trips) + whole(L.woods);
  HIDEOUTS.forEach((h, i) => {
    const done = F.hideout.includes(h.id) || trips > i;
    add('collect', 'Loot caches', `collect:hideout:${h.id}`, i === 0 ? 'A cache of loot handed back' : `${i + 1} caches of loot handed back`,
      'Loot the gang: their caches are hidden in camps well out of town. Hand the loot back at the sheriff\'s office.', done ? 1 : 0, 1, done, true, ['loot']);
  });

  // places: the camps, then the ones still to come
  for (const c of CAMP_PLACES) {
    const done = F.place.includes('camp-' + c.id);
    add('places', 'Camps', `place:camp-${c.id}`, c.name, `Ride out to it: ${c.where}.`, done ? 1 : 0, 1, done);
  }
  add('places', 'The windmill', 'place:windmill', `The windmill: an ${WINDMILL_FEET} ft tower standing`,
    `Build the windmill's tower and keep it standing in the wind: ${WINDMILL_FEET} feet tall.`, F.windmill, WINDMILL_FEET, F.windmill >= WINDMILL_FEET, COMING.windmill, ['windmill']);
  add('places', 'The bridge', 'place:bridge', 'The bridge over the west river', 'Build the engineer a bridge over the west river that carries horse and rider.', F.place.includes('bridge') ? 1 : 0, 1, F.place.includes('bridge'), COMING.bridge, ['bridge']);
  add('places', 'The fishing dock', 'place:fishing', 'The fishing dock', 'Fish off the dock at the lake south of town (the path past the saloon) and land a fish.', F.place.includes('fishing') ? 1 : 0, 1, F.place.includes('fishing'), COMING.fishing, ['fishing']);
  return out;
}

// a whole percent, rounded, that reads 100 only when everything is done (and never 0 once something is)
const pctOf = (done, total) => (!total || done <= 0 ? 0 : done >= total ? 100 : Math.min(99, Math.max(1, Math.round((100 * done) / total))));

export function completion(rider, { all = false } = {}) {
  const every = allItems(rider);
  const items = all ? every : every.filter((i) => i.live && !i.off);
  const groups = GROUPS.map((g) => {
    const list = items.filter((i) => i.group === g.id), done = list.filter((i) => i.done).length;
    return { id: g.id, name: g.name, pct: pctOf(done, list.length), done, total: list.length, items: list };
  }).filter((g) => g.total > 0);
  const done = items.filter((i) => i.done).length;
  // (buying the cabin is a switch: on now, it is a thing to buy like the others; switched off it would be left out of
  // "more to come", as it was while every rider had the cabin from the start)
  const coming = every.filter((i) => !i.live && i.id !== 'buy:cabin:home').map((i) => i.name);
  return { pct: pctOf(done, items.length), done, total: items.length, groups, items, coming };
}

// the pinned goals (only well-formed ones, on today's ids: an old goal on an item the picker no longer offers is moved,
// in rider.goals too, to the goal that holds it: save.js upgradeGoals)
function goalList(rider) {
  if (!rider || !Array.isArray(rider.goals)) return [];
  const up = upgradeGoals(rider.goals);
  if (up.length !== rider.goals.length || up.some((g, k) => g !== rider.goals[k])) rider.goals = up;
  return up;
}

// ── THE GOALS A GROWN-UP CAN PIN ─────────────────────────────────────────────────────────────────────────────────
const COLLECT_GOALS = [
  { kind: 'photos', name: 'Deer photographs', line: 'A full album of deer photographs' },
  { kind: 'keepsake', name: 'Keepsakes', line: 'Every keepsake in the cabin', hint: 'Win a job\'s first buckle, then go into your cabin to see its keepsake.' },
  { kind: 'hideout', name: 'Loot caches', line: `${HIDEOUTS.length} caches of loot handed back` },
];
// every goal the picker has, each with the checklist items it holds (buckles: every tier, a job turned off included,
// so a goal pinned on it still reads; the rest: what is on the list now)
function goalSets(rider) {
  const every = allItems(rider), on = every.filter((i) => i.live && !i.off), out = [];
  for (const j of JOBS) {
    const items = every.filter((i) => i.group === 'buckles' && i.id.startsWith(`buckle:${j.id}:`));
    if (items.length === BUCKLES.length) out.push({ id: `goal:buckles:${j.id}`, kind: 'buckles', job: j, items, on: items.some((i) => !i.off) });
  }
  const buy = on.filter((i) => i.group === 'buy');
  if (buy.length) out.push({ id: 'goal:buy', kind: 'count', name: 'Buy everything', group: 'buy', sub: 'Things to buy', of: 'buy:all', items: buy,
    hint: 'Everything for sale: saddles and horses at the stable, hats, dogs and farm animals at the store, and the cabin and its furniture.' });
  for (const c of COLLECT_GOALS) {
    const items = on.filter((i) => i.id.startsWith(`collect:${c.kind}:`));
    if (items.length) out.push({ id: `goal:collect:${c.kind}`, kind: c.kind === 'photos' ? 'last' : 'count', name: c.line, group: 'collect', sub: c.name, of: `collect:${c.kind}`, items, hint: c.hint || items[0].hint });
  }
  const places = on.filter((i) => i.group === 'places');
  if (places.length) out.push({ id: 'goal:places', kind: 'count', name: 'Visit every place', group: 'places', sub: 'Places', of: 'place:all', items: places,
    hint: 'Ride out to every camp, stand the windmill, build the bridge and land a fish at the dock.' });
  return out;
}
// a goal from goalSets, with its progress now
function goalView(set) {
  if (set.kind === 'buckles') {
    const j = set.job, next = set.items.find((i) => !i.done), last = set.items[set.items.length - 1];
    const tiers = set.items.map((i) => ({ tier: i.id.split(':')[2], id: i.id, done: i.done, need: i.need }));
    const at = next || last;
    return { id: set.id, name: next ? at.name : `Every buckle: ${lower(j.name)}`, group: 'buckles', sub: j.name, job: j.id,
      have: at.have, need: at.need, done: !next, pct: next ? pctOf(at.have, at.need) : 100, hint: at.hint, line: progressLine(at), of: at.id, tiers };
  }
  let have, need;
  if (set.kind === 'last') { const l = set.items[set.items.length - 1]; have = l.have; need = l.need; }
  else { have = set.items.filter((i) => i.done).length; need = set.items.length; }
  const done = set.items.every((i) => i.done);
  return { id: set.id, name: set.name, group: set.group, sub: set.sub, have, need, done, pct: done ? 100 : pctOf(have, need), hint: set.hint,
    line: done ? 'Done' : `${have.toLocaleString('en-US')} / ${need.toLocaleString('en-US')}`, of: set.of };
}
// one pinned goal's progress: a goal's id or a buckle's (null for an id the game doesn't have)
function viewOf(rider, id, sets = goalSets(rider), every = null) {
  if (id.startsWith('goal:')) { const s = sets.find((x) => x.id === id); return s ? goalView(s) : null; }
  const i = (every || allItems(rider)).find((x) => x.id === id);
  return i ? { id: i.id, name: i.name, have: i.have, need: i.need, done: i.done, pct: i.done ? 100 : pctOf(i.have, i.need), hint: i.hint,
    group: i.group, sub: i.sub, line: progressLine(i), of: i.id } : null;
}

export function unlocked(rider) {
  if (!rider) return [];
  const now = completion(rider).items.filter((i) => i.done);
  if (!Array.isArray(rider.done)) { rider.done = now.map((i) => i.id); return []; }
  const had = new Set(rider.done.filter((d) => typeof d === 'string'));
  const fresh = now.filter((i) => !had.has(i.id));
  if (!fresh.length) return [];
  rider.done = [...had, ...fresh.map((i) => i.id)];
  const goals = goalList(rider);
  const sets = goals.some((g) => g.id.startsWith('goal:')) ? goalSets(rider) : [];
  for (const g of goals) {
    if (g.doneAt) continue;
    const set = sets.find((s) => s.id === g.id);
    if (!set) {
      const i = fresh.find((x) => x.id === g.id);
      if (i) { i.goal = true; g.doneAt = Date.now(); }
      continue;
    }
    // a goal holding several items: a job's buckles is reached at each buckle won (and then aims at the next one), the
    // rest when the last of their items is done
    const mine = fresh.filter((x) => set.items.some((s) => s.id === x.id)), v = goalView(set);
    if (!mine.length) continue;
    if (set.kind === 'buckles') mine[0].goal = true;
    else if (v.done) mine[mine.length - 1].goal = true;
    if (v.done) g.doneAt = Date.now();
  }
  return fresh;
}

export function goalChoices(rider) {
  const list = goalSets(rider).filter((s) => s.kind !== 'buckles' || s.on).map(goalView).filter((g) => !g.done);
  // (the jobs under way first, then the ones not started; the other goals after the buckles, as the checklist has them)
  const rank = (g) => (g.group !== 'buckles' ? 2 : g.tiers.some((t) => t.done) || g.have > 0 ? 0 : 1);
  return list.map((g, k) => [g, k]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);
}

// how far along an item is, in words: "37 / 50", "45 / 60 gold", "You have the gold!" (a thing to buy, the gold in
// hand: not bought yet, so never "60 / 60"), "Not yet" (a place or a hideout), "Done"
export function progressLine(item) {
  if (!item) return '';
  const n = (v) => Math.round(v).toLocaleString('en-US');
  if (item.done) return 'Done';
  if (item.group === 'buy') return item.have >= item.need ? 'You have the gold!' : `${n(item.have)} / ${n(item.need)} gold`;
  if (item.need <= 1) return 'Not yet';
  return `${n(item.have)} / ${n(item.need)}`;
}

export function goalsOf(rider) {
  const list = goalList(rider); if (!list.length) return [];
  const sets = goalSets(rider), every = allItems(rider);
  return list.map((g) => viewOf(rider, g.id, sets, every)).filter(Boolean);
}

export function setGoal(rider, id) {
  if (!rider || typeof id !== 'string') return false;
  id = goalIdOf(id);
  // (a goal from the picker, or one exact buckle on the list now)
  const ok = id.startsWith('goal:') ? goalChoices(rider).find((g) => g.id === id)
    : id.startsWith('buckle:') ? completion(rider).items.find((i) => i.id === id && !i.done) : null;
  if (!ok) return false;
  let list = goalList(rider);
  if (list.some((g) => g.id === id)) return true;
  if (list.length >= MOST_GOALS) {
    // (a goal already reached makes room: the oldest reached one goes)
    const done = new Set(goalsOf(rider).filter((g) => g.done).map((g) => g.id));
    const i = list.findIndex((g) => done.has(g.id));
    if (i < 0) return false;
    list = list.filter((_, k) => k !== i);
  }
  rider.goals = [...list, { id, at: Date.now() }];
  return true;
}

export function clearGoal(rider, id) {
  if (typeof id !== 'string') return false;
  id = goalIdOf(id);
  const list = goalList(rider);
  if (!list.some((g) => g.id === id)) return false;
  rider.goals = list.filter((g) => g.id !== id);
  return true;
}

export function notice(rider, { place = null, hideout = null, home = false } = {}) {
  if (!rider) return false;
  let changed = false;
  if (place && CAMP_PLACES.some((c) => c.id === place)) changed = markFound(rider, 'place', 'camp-' + place) || changed;
  if (hideout && HIDEOUTS.some((h) => h.id === hideout)) changed = markFound(rider, 'hideout', hideout) || changed;
  if (home) {
    for (const j of JOBS) {
      const k = KEEPSAKES[j.id]; if (!j.ready || !k) continue;
      if (jobCount(rider, j.id) >= j.at[Math.max(0, BUCKLES.indexOf(k.from))]) changed = markFound(rider, 'keepsake', j.id) || changed;
    }
  }
  return changed;
}
