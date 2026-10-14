// save.js: the riders (one per kid) and everything they keep between visits.
//
// All riders live in the browser's localStorage under ONE key, as a small JSON blob:
//   { version: 1, riders: [Rider, ...] }
// Every storage touch is wrapped in try/catch. When the browser blocks storage (a private window, cookies off,
// a full disk), the game keeps working from a copy in memory; progress then lasts until the tab closes, and
// storageWorks() says so, so the title screen can warn about it.
//
// Gold is saved the moment it is earned (earn() writes straight away), so closing the tab never loses a payout.
//
// Rider = {
//   id, name,
//   look:     { outfit: 'farmer_m', palette: 'drifter', skin: '#c68d62', hair: '#3f2a1b', hat: true }
//             (outfit = a people model file; the fields match the actors' makePerson options)
//   gold,     spending money
//   bounty,   all the gold ever earned; it never goes down, and the rider's title comes from it
//   mode:     'lasso' | 'shoot'    (picked on the title screen only, then fixed for the whole ride)
//   topicsOn: { counting, adding, taking, times, dividing, algebra }   which math topics are ticked (true/false)
//   topics:   { times: {...}, algebra: {...} }   each math module keeps its own progress object in here
//   missions: { roundup, wagon, hunt, loot }    which missions are ticked
//   owned:    { saddle: null|'plain'|'tooled'|'silver', horse: 'bay', dog: null|{ kind, name } }
//             (+ cabin: ['rug', 'bed', ...] the furnishings bought for the cabin, once any are: src/cabin/slots.js)
//             (+ animals: [{ kind, name, young?, age? }], goods: { eggs, wool, milk } in the saddlebags, yard: { eggs, wool,
//               milk } waiting behind the cabin: the homestead's farm animals, once there are any: src/math/goods.js)
//   lockboxes: [{ tier }, ...]   unopened boxes in the saddlebags
//   stats:    { answered, right, recent: [1,0,...],          every answer, recent = the last 50 (1 right, 0 wrong)
//               byMode: { lasso: {answered, right, recent}, shoot: {...} },   the same, split by mode (for the badges)
//               boxes, parBoxes,                             lock boxes solved, and solved in the fewest moves
//               jobs: { cattle, boxes, sheep, orders, pigs, bandits, deliveries } }   how much of each job was done (the
//                                                            belt buckles come from these; see JOBS below)
//   badges:   ['Top Hand', ...]   badges once earned stay earned
//   album:    [{ eq, x, img, at, rung }]   the deer photographs taken (src/ui/album.js), once there are any
//   made, last   when the rider was made and last rode out (ms since 1970; last is 0 until the first ride)
// }

import { cleanAnimals, cleanGoods } from './math/goods.js';

const VERSION = 1;
let KEY = 'bandit-math.riders';

// How many answers the accuracy badges look back over, and how many a rider needs before one can be earned.
export const RECENT = 50;
export const BADGE_MIN = 30;
export const BADGE_PCT = 0.9;
// Lock boxes solved in the fewest possible moves before the Safecracker badge.
export const SAFECRACKER_BOXES = 10;
// The lock-box tiers (lockbox/box.js TIER_GOLD). A saved box of any other tier (an old or hand-edited save) is read
// as an iron one, so the box the panel opens is the one taken out of the saddlebags when it is solved.
export const BOX_TIERS = ['tin', 'iron', 'brass', 'vault'];
export function cleanBoxes(list) {
  return (Array.isArray(list) ? list : []).filter(b => b && typeof b === 'object')
    .map(b => (BOX_TIERS.includes(b.tier) ? b : { ...b, tier: 'iron' }));
}
// A device holds this many riders at most (the title screen hides "New rider" after that).
export const MAX_RIDERS = 6;

// Titles by fame (all-time gold earned; shown as "fame", stored as rider.bounty so old saves still load):
// the lowest fame each title needs.
export const TITLES = [
  [0, 'Greenhorn'], [100, 'Drifter'], [300, 'Wrangler'], [700, 'Deputy'],
  [1500, 'Sheriff'], [3000, 'Marshal'], [6000, 'Legend'],
];

// The math topics in the order the title screen shows them. `ready` = playable in this build.
export const TOPICS = [
  { id: 'counting', name: 'Counting', ages: '4-6', ready: true },      // off until ticked; progress in topics.counting (src/math/counting.js), made when first played
  { id: 'adding', name: 'Adding', ages: '5-8', ready: true },          // ... topics.adding (src/math/adding.js)
  { id: 'taking', name: 'Taking away', ages: '6-8', ready: true },     // ... topics.taking (src/math/taking.js)
  { id: 'times', name: 'Times tables', ages: '7-10', ready: true },
  { id: 'dividing', name: 'Dividing', ages: '8-11', ready: true },    // off until ticked; progress in topics.dividing (src/math/dividing.js), made when first played
  { id: 'negatives', name: 'Positive & negative', ages: '11-13', ready: true },   // off until ticked; progress in topics.negatives, made when first played
  { id: 'algebra', name: 'Solving for x', ages: '11+', ready: true },
];

// The missions in the order the title screen shows them.
export const MISSIONS = [
  { id: 'roundup', name: 'Round-up', line: 'Rope the right numbers', ready: true },
  { id: 'wagon', name: 'Protect the wagon', line: 'Ride shotgun and keep the cargo safe', ready: true },
  { id: 'hunt', name: 'Deer photographs', line: 'Snap the deer with the answer', ready: true },   // (the id stays 'hunt': older saves keep their tick)
  { id: 'loot', name: 'Loot the gang', line: 'Take back what the gang stole', ready: true },   // (src/missions/loot.js; its ladder in topics.loot)
];

// ---- jobs and belt buckles -----------------------------------------------------------------------------------
// Each job a rider can do is counted in rider.stats.jobs: the work finished (a steer roped and sent to the corral, a
// lock box cracked). How often a rider is right stays with the Top Hand / Sharpshooter / Safecracker badges. Every job has a western belt buckle in four
// metals, earned at the counts in `at`: [tin, copper, silver, gold]. The first comes in a kid's first sitting and gold
// is a long way off. ready = the job exists in this build; the others are counted the day they arrive but stay off
// the rider card until then. `words` = how one and many read ("1 steer corralled", "50 cattle corralled").
//   cattle: a wave of the round-up has 4 to 6 right steers and takes a minute or two, so tin (10) comes after two or
//     three waves on the first ride, copper (50) after about ten waves, silver (200) after weeks of rides, gold (500)
//     is the long goal (about a hundred waves).
//   boxes: a lock box is a whole equation (half a minute to a few minutes), one comes with every wave and the sheriff
//     always has more, so the steps are about half the cattle's: tin after five boxes, gold after 250.
//   sheep: a flock has one or two sick sheep and takes a few minutes, so tin (5) comes after three or four flocks on a
//     first visit to the farm; still a first guess until the job has been played for real.
//   orders: an order at the general store counter is one word problem (about half a minute with the reading), so a
//     sitting of ten to fifteen minutes fills fifteen to twenty-five: tin (10) in the first sitting, copper (40) after
//     three or four, silver (150) and gold (400) the long goals. A first guess, like sheep's, until it's been played.
//   pigs: a batch is five pigs and takes a few minutes of herding, so tin (10) comes after two batches on a first
//     visit; still a first guess until the job has been played for real.
//   deliveries: a delivery is an order worked out at the store and two rides (out to a camp and back), two or three
//     minutes, so tin (3) comes in a first sitting and copper (10) after a few; a first guess until it's been played.
//   loot: a bundle of the gang's loot handed back (one sharing problem); a trip is 2 or 3 bundles and a ride out and
//     back (three or four minutes), so tin (5) comes on the second trip; a first guess until it's been played.
//   targets: a bottle or tin can shot down at the target range (Shooting mode only: mode 'shoot', so a lasso rider's card
//     doesn't show it unless they have some); a string of five cards is ten to fifteen right targets in two or three
//     minutes, so tin (15) comes with the first string or two and copper (60) after a few sittings; a first guess.
//   bandits: a gang's wave on the wagon road has 3 to 5 bandits and takes a couple of minutes, so tin (3) comes with
//     the first wave and copper (15) after four or five; still a first guess until it's been played for real.
export const BUCKLES = ['tin', 'copper', 'silver', 'gold'];
export const BUCKLE_NAMES = { tin: 'Tin', copper: 'Copper', silver: 'Silver', gold: 'Gold' };
export const JOBS = [
  { id: 'cattle', name: 'Cattle corralled', words: ['steer corralled', 'cattle corralled'], at: [10, 50, 200, 500], ready: true },
  { id: 'boxes', name: 'Lock boxes cracked', words: ['lock box cracked', 'lock boxes cracked'], at: [5, 25, 100, 250], ready: true },
  { id: 'sheep', name: 'Sheep healed', words: ['sheep healed', 'sheep healed'], at: [5, 20, 75, 200], ready: true },
  { id: 'orders', name: 'Orders filled', words: ['order filled', 'orders filled'], at: [10, 40, 150, 400], ready: true },
  { id: 'pigs', name: 'Pigs penned', words: ['pig penned', 'pigs penned'], at: [10, 50, 200, 500], ready: true },
  { id: 'bandits', name: 'Bandits brought in', words: ['bandit brought in', 'bandits brought in'], at: [3, 15, 50, 150], ready: true },
  { id: 'deliveries', name: 'Deliveries made', words: ['delivery made', 'deliveries made'], at: [3, 10, 30, 100], ready: true },
  { id: 'loot', name: 'Loot returned', words: ['bundle of loot returned', 'bundles of loot returned'], at: [5, 20, 60, 150], ready: true },
  { id: 'targets', name: 'Targets hit', words: ['target hit', 'targets hit'], at: [15, 60, 250, 600], ready: true, mode: 'shoot' },
];

// The keepsake each job puts in the rider's cabin (src/cabin/: slots.js has its spot, pieces.js its shape). `from` =
// the buckle that brings it; later buckles can dress it up (the cabin decides how). `where` is a description in words
// (shown nowhere today; slots.js has the real spot).
// The steer horns, safe door, sheep bell and wanted posters were asked for; the pig and the delivery ones are
// stand-ins until someone picks.
export const KEEPSAKES = {
  cattle: { name: 'Steer horns', where: 'over the cabin door', from: 'tin' },
  boxes: { name: 'A cracked safe door', where: 'leaning by the hearth', from: 'tin' },
  sheep: { name: 'A sheep bell', where: 'hanging by the door', from: 'tin' },
  orders: { name: 'A brass counter bell', where: 'on the table', from: 'tin', standIn: true },
  pigs: { name: 'A carved wooden pig', where: 'on the mantel', from: 'tin', standIn: true },
  bandits: { name: 'Wanted posters', where: 'on the wall, one more for each buckle', from: 'tin' },
  deliveries: { name: 'A freight company sign', where: 'on the porch', from: 'tin', standIn: true },
  loot: { name: 'A recovered strongbox', where: 'on the floor against the back wall', from: 'tin', standIn: true },
  targets: { name: 'A row of shot-up tin cans', where: 'on a shelf over the table', from: 'tin', standIn: true },
};

// The period looks a new rider can pick from: a people model, one of the clothes palettes (the same names as the
// actors' PALETTES), and a default hair colour. Every look can wear the cowboy hat (look.hat, on by default).
export const LOOKS = [
  { id: 'cowhand', name: 'Cowhand', outfit: 'farmer_m', palette: 'drifter', hair: '#3f2a1b' },
  { id: 'rancher', name: 'Rancher', outfit: 'farmer_m', palette: 'rancher', hair: '#5c3a22' },
  { id: 'homesteader', name: 'Homesteader', outfit: 'farmer_m', palette: 'homestead', hair: '#2b1d14' },
  { id: 'explorer', name: 'Explorer', outfit: 'adventurer_m', palette: 'sage', hair: '#3f2a1b' },
  { id: 'trailblazer', name: 'Trailblazer', outfit: 'adventurer_f', palette: 'mustard', hair: '#7b4524' },
  { id: 'settler', name: 'Settler', outfit: 'casual_f', palette: 'prairie', hair: '#2b1d14' },
];
// Skin and hair colours to pick from (picked from the actors' SKINS and HAIRS lists, light to dark / dark to fair).
export const SKINS = ['#efcfb8', '#dba982', '#c68d62', '#a96c43', '#6b3d24'];
export const HAIRS = ['#16110d', '#3f2a1b', '#7b4524', '#b98a52', '#d8b878'];

// ---- storage -------------------------------------------------------------------------------------------------

// The latest blob, kept in memory. It is the fallback when storage is blocked, and it wins over storage whenever
// the last write to storage failed (so a full disk can't roll a rider back to an older save).
let memory = null;
let lastWriteOk = true;
let lastReadOk = true;

// Use a different storage key (test pages do this so they never touch real riders). Clears the memory copy.
export function useSaveKey(key) {
  KEY = String(key || 'bandit-math.riders');
  memory = null; lastWriteOk = true; lastReadOk = true;
}

// True while the browser is really keeping our saves (false in a private window with storage blocked, etc).
export function storageWorks() {
  try {
    const s = globalThis.localStorage;
    if (!s) return false;
    const probe = KEY + '.probe';
    s.setItem(probe, '1'); s.removeItem(probe);
    return lastWriteOk && lastReadOk;
  } catch (e) { return false; }
}

function emptyBlob() { return { version: VERSION, riders: [] }; }

function readBlob() {
  let blob = null;
  try {
    const raw = globalThis.localStorage.getItem(KEY);
    lastReadOk = true;
    if (raw) {
      try { blob = JSON.parse(raw); } catch (e) {
        // A damaged save: keep the broken text under a side key so it can be rescued by hand, then start fresh.
        console.warn('Bandit Math: the saved riders could not be read; kept a copy under', KEY + '.broken');
        try { globalThis.localStorage.setItem(KEY + '.broken', raw); } catch (e2) { /* nothing more we can do */ }
        blob = null;
      }
    }
  } catch (e) { lastReadOk = false; }
  if (!lastReadOk || !lastWriteOk) {
    if (memory) return JSON.parse(JSON.stringify(memory));   // a copy, so edits only land when saved
    return blob && Array.isArray(blob.riders) ? blob : emptyBlob();
  }
  if (!blob || !Array.isArray(blob.riders)) blob = emptyBlob();
  return blob;
}

function writeBlob(blob) {
  blob.version = VERSION;
  // The memory copy is a deep copy, so later changes to live rider objects don't leak into it until saved.
  try { memory = JSON.parse(JSON.stringify(blob)); } catch (e) { /* a rider with a loop in it; keep the old copy */ }
  try {
    globalThis.localStorage.setItem(KEY, JSON.stringify(blob));
    lastWriteOk = true;
    return true;
  } catch (e) {
    lastWriteOk = false;
    return false;
  }
}

// ---- riders ----------------------------------------------------------------------------------------------------

function num(v, dflt = 0) { v = Number(v); return Number.isFinite(v) ? v : dflt; }
function whole(v) { return Math.max(0, Math.round(num(v))); }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function bits(list) { return (Array.isArray(list) ? list : []).map(b => (b ? 1 : 0)).slice(-RECENT); }
function tally(t) { t = obj(t); return { answered: whole(t.answered), right: whole(t.right), recent: bits(t.recent) }; }

// The job counts from a saved stats object, every one a whole number (a missing one is 0; jobs a newer build added
// are kept). A save from before the counts existed gets credit for the work it already holds: every right answer
// so far was a steer roped (the round-up was the only job that asked questions), and stats.boxes is the lock boxes
// solved. The boxes count never trails stats.boxes (both go up together in recordLockbox).
function jobsFor(stats) {
  stats = obj(stats);
  const had = !!stats.jobs && typeof stats.jobs === 'object' && !Array.isArray(stats.jobs);
  const jobs = obj(stats.jobs), out = {};
  for (const k in jobs) out[k] = whole(jobs[k]);
  for (const j of JOBS) out[j.id] = whole(jobs[j.id]);
  if (!had) out.cattle = Math.max(out.cattle, whole(stats.right));
  out.boxes = Math.max(out.boxes, whole(stats.boxes));
  return out;
}

function makeId() {
  return 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function lookFor(look) {
  look = obj(look);
  const known = LOOKS.find(l => l.outfit === look.outfit && l.palette === look.palette) || LOOKS[0];
  return {
    ...look,
    outfit: typeof look.outfit === 'string' ? look.outfit : known.outfit,
    palette: typeof look.palette === 'string' ? look.palette : known.palette,
    skin: typeof look.skin === 'string' ? look.skin : SKINS[2],
    hair: typeof look.hair === 'string' ? look.hair : known.hair,
    hat: look.hat !== false,
  };
}

// Fills in anything a rider is missing (an older save, a hand-edited one) without throwing away what is there.
// Unknown fields are kept as they are, so a newer build's data survives a trip through an older one.
export function fixRider(r) {
  r = obj(r);
  const topicsOn = obj(r.topicsOn), missions = obj(r.missions), owned = obj(r.owned), stats = obj(r.stats);
  const byMode = obj(stats.byMode);
  const out = {
    ...r,
    id: typeof r.id === 'string' && r.id ? r.id : makeId(),
    name: String(r.name == null ? 'Rider' : r.name).trim().slice(0, 16) || 'Rider',
    look: lookFor(r.look),
    gold: whole(r.gold),
    bounty: whole(r.bounty),
    mode: r.mode === 'shoot' ? 'shoot' : 'lasso',
    topicsOn: {},
    topics: { ...obj(r.topics) },
    missions: {},
    owned: {
      ...owned,
      saddle: owned.saddle == null ? null : String(owned.saddle),
      horse: typeof owned.horse === 'string' ? owned.horse : 'bay',
      dog: owned.dog && typeof owned.dog === 'object' ? owned.dog : null,
      // the cabin's furnishings bought (slot ids, src/cabin/slots.js), only when the rider has any
      ...(owned.cabin !== undefined ? { cabin: [...new Set((Array.isArray(owned.cabin) ? owned.cabin : []).filter(c => typeof c === 'string'))] } : {}),
      // the homestead's animals and their goods (src/math/goods.js), only when the rider has any
      ...(owned.animals !== undefined ? { animals: cleanAnimals(owned.animals) } : {}),
      ...(owned.goods !== undefined ? { goods: cleanGoods(owned.goods) } : {}),
      ...(owned.yard !== undefined ? { yard: cleanGoods(owned.yard, { parts: true }) } : {}),
    },
    lockboxes: cleanBoxes(r.lockboxes),
    stats: {
      ...stats,
      ...tally(stats),
      byMode: { ...byMode, lasso: tally(byMode.lasso), shoot: tally(byMode.shoot) },
      boxes: whole(stats.boxes),
      parBoxes: whole(stats.parBoxes),
      jobs: jobsFor(stats),
    },
    badges: (Array.isArray(r.badges) ? r.badges : []).filter(b => typeof b === 'string'),
    made: num(r.made, Date.now()),
    last: num(r.last, 0),
  };
  // Bounty is every coin ever earned, so it can never be less than the gold in hand.
  if (out.bounty < out.gold) out.bounty = out.gold;
  out.topics.times = obj(out.topics.times);
  out.topics.algebra = obj(out.topics.algebra);
  for (const t of TOPICS) out.topicsOn[t.id] = t.id in topicsOn ? !!topicsOn[t.id] : (t.id === 'times' || t.id === 'algebra');
  for (const m of MISSIONS) out.missions[m.id] = m.id in missions ? !!missions[m.id] : m.id === 'roundup';
  // Keep any extra topic or mission flags a newer build added.
  for (const k in topicsOn) if (!(k in out.topicsOn)) out.topicsOn[k] = !!topicsOn[k];
  for (const k in missions) if (!(k in out.missions)) out.missions[k] = !!missions[k];
  return out;
}

// All saved riders, most recently ridden first. Never throws.
export function loadRiders() {
  try {
    const blob = readBlob();
    const riders = blob.riders.map(fixRider);
    riders.sort((a, b) => (b.last - a.last) || (a.made - b.made));
    return riders;
  } catch (e) {
    console.warn('Bandit Math: could not load riders', e);
    return [];
  }
}

// Writes this rider now (adds it if it is new). Returns true if the browser really kept it.
export function saveRider(rider) {
  if (!rider || !rider.id) return false;
  try {
    const blob = readBlob();
    const copy = JSON.parse(JSON.stringify(rider));
    const i = blob.riders.findIndex(r => r && r.id === rider.id);
    if (i >= 0) blob.riders[i] = copy; else blob.riders.push(copy);
    return writeBlob(blob);
  } catch (e) {
    console.warn('Bandit Math: could not save the rider', e);
    return false;
  }
}

// A fresh rider with every default filled in. It is NOT saved until saveRider() is called.
// look = { outfit, palette, skin, hair } (any part may be left out).
export function newRider(name, look) {
  return fixRider({ id: makeId(), name, look, made: Date.now(), last: 0 });
}

export function deleteRider(id) {
  try {
    const blob = readBlob();
    blob.riders = blob.riders.filter(r => r && r.id !== id);
    return writeBlob(blob);
  } catch (e) {
    console.warn('Bandit Math: could not delete the rider', e);
    return false;
  }
}

// ---- titles and badges -------------------------------------------------------------------------------------

export function titleOf(rider) {
  const b = whole(rider && rider.bounty);
  let name = TITLES[0][1];
  for (const [at, t] of TITLES) if (b >= at) name = t;
  return name;
}

// The next title up and how much more bounty it needs, or null at the top.  -> { title, at, toGo }
export function nextTitle(rider) {
  const b = whole(rider && rider.bounty);
  for (const [at, t] of TITLES) if (at > b) return { title: t, at, toGo: at - b };
  return null;
}

// How often the rider has been right lately.  mode = 'lasso' | 'shoot' | undefined (all answers).
// -> { right, of, pct }  (pct is 0..100, or null before any answers)
export function accuracyOf(rider, mode) {
  const st = rider && rider.stats ? rider.stats : {};
  const t = mode ? (st.byMode && st.byMode[mode]) || {} : st;
  const recent = Array.isArray(t.recent) ? t.recent : [];
  const right = recent.reduce((s, b) => s + (b ? 1 : 0), 0);
  return { right, of: recent.length, pct: recent.length ? Math.round((100 * right) / recent.length) : null, answered: whole(t.answered) };
}

// The badges this rider qualifies for right now (not counting ones kept from before).
function earnedNow(rider) {
  const out = [];
  const st = (rider && rider.stats) || {};
  const byMode = st.byMode || {};
  const sharp = (t) => {
    if (!t || whole(t.answered) < BADGE_MIN) return false;
    const recent = Array.isArray(t.recent) ? t.recent.slice(-RECENT) : [];
    if (recent.length < BADGE_MIN) return false;
    const right = recent.reduce((s, b) => s + (b ? 1 : 0), 0);
    return right / recent.length >= BADGE_PCT;
  };
  if (sharp(byMode.lasso)) out.push('Top Hand');
  if (sharp(byMode.shoot)) out.push('Sharpshooter');
  if (whole(st.parBoxes) >= SAFECRACKER_BOXES) out.push('Safecracker');
  return out;
}

const BADGE_ORDER = ['Top Hand', 'Sharpshooter', 'Safecracker'];

// Every badge the rider holds: once earned, a badge stays, even if their accuracy dips later.
export function badgesOf(rider) {
  const have = new Set([...(Array.isArray(rider && rider.badges) ? rider.badges : []), ...earnedNow(rider)]);
  return BADGE_ORDER.filter(b => have.has(b)).concat([...have].filter(b => !BADGE_ORDER.includes(b)));
}

// Stamps any newly earned badges onto the rider; returns the new ones.
function stampBadges(rider) {
  if (!Array.isArray(rider.badges)) rider.badges = [];
  const fresh = earnedNow(rider).filter(b => !rider.badges.includes(b));
  rider.badges.push(...fresh);
  return fresh;
}

// ---- job counts and belt buckles -----------------------------------------------------------------------------

function jobInfo(id) {
  return JOBS.find(j => j.id === id) || { id: String(id), name: String(id), words: [String(id), String(id)], at: JOBS[0].at, ready: false };
}

// How many times this rider has done a job (0 for a job never done, or not known).
export function jobCount(rider, id) {
  const jobs = rider && rider.stats && rider.stats.jobs;
  return jobs && typeof jobs === 'object' ? whole(jobs[id]) : 0;
}

// A count in words: (cattle, 1) -> '1 steer corralled', (cattle, 50) -> '50 cattle corralled'.
export function jobWords(id, n) {
  const w = jobInfo(id).words;
  return `${whole(n).toLocaleString('en-US')} ${whole(n) === 1 ? w[0] : w[1]}`;
}

// The belt buckle a rider holds for a job, and the next one up.
// -> { job, name, count, tier: null | 'tin' | 'copper' | 'silver' | 'gold', from, next: { tier, at, toGo } | null }
//    tier is null before the first (tin) buckle; from = the count the buckle held was won at (0 before tin), so
//    from -> next.at is the stretch a progress bar shows; next is null once gold is won.
export function buckleOf(rider, id) {
  const job = jobInfo(id), count = jobCount(rider, id);
  let i = -1;
  job.at.forEach((at, k) => { if (count >= at) i = k; });
  const n = i + 1 < BUCKLES.length ? i + 1 : -1;
  return {
    job: job.id, name: job.name, count,
    tier: i >= 0 ? BUCKLES[i] : null,
    from: i >= 0 ? job.at[i] : 0,
    next: n >= 0 ? { tier: BUCKLES[n], at: job.at[n], toGo: job.at[n] - count } : null,
  };
}

// The buckles for every job this build has, in the rider card's order.
export function bucklesOf(rider) {
  // (a job only one mode has, the target range's in Shooting mode, shows for a rider in that mode, or once they have some)
  return JOBS.filter(j => j.ready && (!j.mode || (rider && rider.mode) === j.mode || jobCount(rider, j.id) > 0)).map(j => buckleOf(rider, j.id));
}

// The progress line under a buckle: '37 / 50 to copper', or '512 · Gold buckle' at the top.
export function buckleProgress(b) {
  if (!b) return '';
  if (!b.next) return `${whole(b.count).toLocaleString('en-US')} · ${BUCKLE_NAMES[b.tier] || 'Gold'} buckle`;
  return `${whole(b.count).toLocaleString('en-US')} / ${b.next.at.toLocaleString('en-US')} to ${b.next.tier}`;
}

// Adds n to a job's count (no save). -> the buckle just won (buckleOf's result), or null.
function bumpJob(rider, id, n) {
  if (!rider.stats || typeof rider.stats !== 'object') rider.stats = fixRider(rider).stats;
  const st = rider.stats;
  if (!st.jobs || typeof st.jobs !== 'object' || Array.isArray(st.jobs)) st.jobs = jobsFor(st);
  const before = buckleOf(rider, id).tier;
  st.jobs[id] = whole(st.jobs[id]) + whole(n);
  const now = buckleOf(rider, id);
  return now.tier !== before ? now : null;
}

// Counts a finished piece of work (a steer corralled, a sheep healed...) and saves.
// -> { count, buckle }   buckle = the belt buckle this very count won (for a toast), or null.
// Lock boxes are counted by recordLockbox, so the pay path counts each box once.
export function countJob(rider, id, n = 1) {
  const buckle = bumpJob(rider, id, n);
  saveRider(rider);
  return { count: jobCount(rider, id), buckle };
}

// ---- gold and answers ----------------------------------------------------------------------------------------

// Pays the rider: adds to gold AND bounty, then saves straight away.
// -> { gold, bounty, title, newTitle }   newTitle is the title just reached (for a cheer), or null
export function earn(rider, gold) {
  const n = whole(gold);
  const before = titleOf(rider);
  rider.gold = whole(rider.gold) + n;
  rider.bounty = whole(rider.bounty) + n;
  const title = titleOf(rider);
  saveRider(rider);
  return { gold: rider.gold, bounty: rider.bounty, title, newTitle: title !== before ? title : null };
}

// Spends gold if the rider has enough. -> true if paid (and saved), false if not enough.
export function spend(rider, gold) {
  const n = num(gold, NaN);
  if (!Number.isFinite(n) || n < 0) return false;
  const cost = Math.round(n);
  if (whole(rider.gold) < cost) return false;
  rider.gold = whole(rider.gold) - cost;
  saveRider(rider);
  return true;
}

function pushTally(t, right) {
  t.answered = whole(t.answered) + 1;
  t.right = whole(t.right) + (right ? 1 : 0);
  t.recent = bits(t.recent);
  t.recent.push(right ? 1 : 0);
  if (t.recent.length > RECENT) t.recent.splice(0, t.recent.length - RECENT);
}

// Records one math answer (right = true/false) in the rider's all-time count, their last-50 list, and the list
// for the mode they are riding in (lasso or shoot, which the two accuracy badges use). Saves.
// -> { pct, badge }   pct = last-50 accuracy 0..100; badge = a badge earned by this very answer, or null
export function recordAnswer(rider, right) {
  if (!rider.stats || typeof rider.stats !== 'object') rider.stats = fixRider(rider).stats;
  const st = rider.stats;
  pushTally(st, right);
  if (!st.byMode || typeof st.byMode !== 'object') st.byMode = {};
  const mode = rider.mode === 'shoot' ? 'shoot' : 'lasso';
  if (!st.byMode[mode]) st.byMode[mode] = tally(null);
  pushTally(st.byMode[mode], right);
  const fresh = stampBadges(rider);
  saveRider(rider);
  return { pct: accuracyOf(rider).pct, badge: fresh[0] || null };
}

// Records a finished lock box. result = the lock-box panel's onDone result: { solved, stars, moves, par }.
// A box counts "at par" when it was solved in the fewest possible moves (moves <= par; or 3 stars if the
// move counts are missing). Ten at par earn the Safecracker badge. A solved box is also the lock-box job's count
// (stats.jobs.boxes), so it can win a belt buckle. Saves.  -> { atPar, badge, buckle }
export function recordLockbox(rider, result) {
  result = obj(result);
  if (!rider.stats || typeof rider.stats !== 'object') rider.stats = fixRider(rider).stats;
  const st = rider.stats;
  let atPar = false, buckle = null;
  if (result.solved) {
    buckle = bumpJob(rider, 'boxes', 1);   // (before stats.boxes goes up: an old save's count starts from it)
    st.boxes = whole(st.boxes) + 1;
    const moves = num(result.moves, NaN), par = num(result.par, NaN);
    atPar = Number.isFinite(moves) && Number.isFinite(par) ? moves <= par : num(result.stars) >= 3;
    if (atPar) st.parBoxes = whole(st.parBoxes) + 1;
  }
  const fresh = stampBadges(rider);
  saveRider(rider);
  return { atPar, badge: fresh[0] || null, buckle };
}
