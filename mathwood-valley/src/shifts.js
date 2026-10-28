// SHIFTS: every job ends after a shift of rounds. The job's person thanks the rider in their speech card, tips about one
// round's pay, a short fanfare plays, the shift counts toward the job's belt buckle, its notice on the jobs board is
// stamped "Done for today", and Old Hob suggests another job that's still open (his hoofprints lead there). After
// that the person politely declines more work today, until the next sunrise in the game, or until the job is picked
// on the jobs board ("Ask for more work"), which opens a fresh shift at once. A shift left halfway keeps its count
// until the day ends. The windmill and the bridge end on their own and have no shift; nor do the sheriff's lock boxes.
//
// This file is the plain logic and the words (no page, no three.js: the tests load it as it is). The game's side (the
// thank-you, the tip, the board, Hob) is src/shiftkeeper.js.
//
// A ROUND is one go at the job, as the kid sees it: a bunch of cattle corralled, a sheep healed, a pig penned, an order
// filled, a card of bottles shot, a photo taken, a fish landed; on the long trips a delivery made, a stash of loot
// handed back, a gang seen off the wagon. Each job says which game event counts a round (`round`).
//
// HOW LONG A SHIFT IS (shiftLength): the regular jobs run 5 to 10 rounds, most riders 6 to 8; the long trips 3 to 5.
// Younger or slower riders get the short end, quick riders the long end. "Pace" (0 short .. 1 long) comes from:
//   - how often the rider has been right lately at this job's place (the levels model's last answers there,
//     src/levels/model.js `h`; with too few, every job's last answers, save.js stats.recent; with too few of those, the
//     middle). 65% right or less is the short end, 98% or more the long end, the 80% the levels aim for near the middle;
//   - at a sit-down job, how many of those were fast (the levels' fast flag): a little longer for a quick hand;
//   - the rider's age, when a grown-up gave one: 5 and under caps the pace at the short end, rising to no cap at 9.
// The length is fixed when the day's shift starts, so the counter on the HUD never jumps about.
//
// WHAT A RIDER KEEPS (rider.shifts, saved with the rider; save.js fixRider runs cleanShifts):
//   { day, date, jobs: { sheep: { day, n, of, done }, ... } }
//   day    the game day the rider is on (it goes up at each sunrise in the game, and on a ride started on a later
//          calendar day than the last: a kid who comes back tomorrow finds the jobs open again)
//   date   the calendar day ('2026-10-28') the rider last rode out on
//   jobs   per job: the game day its shift belongs to, the rounds done that day (n), the shift's length (of) and
//          whether it is done for the day. A record from an earlier day counts as a fresh shift.
// Old saves have none of it and start fresh.
//
//   SHIFT_JOBS, SHIFT, shiftLength(rider, id), pace(rider, id)
//   cleanShifts(v), shiftsOf(rider), today(rider), shiftOf(rider, id) (read: a fresh one for a past day, not stored),
//   ensureShift(rider, id) (today's record, made if needed: its length fixed then), countRound(rider, id) -> { n, of,
//   done, ended } (ended: this round finished the shift), resetShift(rider, id), isDone(rider, id), roundsLeft(rider, id),
//   newDay(rider), startRide(rider, now) -> true when a new calendar day began a new game day, crossedSunrise(from, to),
//   thanksLine(id, k), declineLines(id), counterText(id, rec), dateKey(ms), pickNext(list)

export const SHIFT = {
  regular: [5, 10],    // rounds in a regular job's shift: the short end, the long end (most riders land on 6 to 8)
  long: [3, 5],        // ... and on the long trips (deliveries, the gang's loot, the wagon)
  middle: 0.45,        // the pace when nothing is known about the rider yet (7 rounds, 4 on a long trip)
  acc: [0.65, 0.98],   // right share at the place: at or under the first is the short end, at or over the second the long
  fastShare: 0.25,     // how much the fast answers add at a sit-down job (the share fast, times this)
  recent: 20,          // the place's last answers looked at
  least: 6,            // ... at least this many, else the rider's answers everywhere (save.js stats.recent) ...
  leastAll: 10,        // ... at least this many of those, else the middle
  age: [5, 9],         // an age given: at the first or under, the pace is capped at the short end; from the second, no cap
  sunrise: 5,          // the hour (W.hour) a new day starts (the sun is up from about 5:00, src/world.js)
  jump: 2,             // hours: a clock moved further than this in one step (a ride starting, ?hour=) is not the sun rising
};

// The jobs with a shift. id: the jobs board's (src/jobsboard.js BOARD_JOBS); place: the levels' place
// (src/levels/places.js), for the rider's pace; long: a long trip; round: the game event (src/hob.js events, and a few
// of the shift's own: 'storeFilled', 'rangeCard', 'fishLanded') that counts one round; batch: the event a job's own
// batch ends with, whose usual thank-you gives way to the shift's own when the two come together; buckle: the job's
// count in save.js JOBS (the shift's credit goes there: `credit` of it, about one round's worth); tip: gold, about one
// round's pay; giver: who thanks the rider (a job person's id in src/jobfolkplan.js, 'marksman' for Miss Opal at the
// range, 'storekeeper' for the store, 'foreman' for the camp's own); label: the HUD's counter ("Sheep healed 4/7").
export const SHIFT_JOBS = [
  { id: 'roundup', place: 'roundup', round: 'waveDone', batch: 'waveDone', buckle: 'cattle', credit: 5, tip: 12, giver: 'boss', label: 'Bunches corralled', name: 'the round-up' },
  { id: 'sheep', place: 'sheep', round: 'sheepHealed', batch: 'flockDone', buckle: 'sheep', credit: 1, tip: 5, giver: 'vet', label: 'Sheep healed', name: 'the sick sheep' },
  { id: 'pigs', place: 'pigs', round: 'pigPenned', batch: 'pigsDone', buckle: 'pigs', credit: 1, tip: 4, giver: 'wife', label: 'Pigs penned', name: 'the loose pigs' },
  { id: 'store', place: 'store', round: 'storeFilled', batch: 'storeDone', buckle: 'orders', credit: 1, tip: 5, giver: 'storekeeper', label: 'Orders filled', name: 'the store counter', sit: true },
  { id: 'range', place: 'range', round: 'rangeCard', batch: null, buckle: 'targets', credit: 2, tip: 5, giver: 'marksman', label: 'Cards shot', name: 'the bottle range', sit: true },
  { id: 'deer', place: 'deer', round: 'deerRight', batch: 'deerDone', buckle: 'photos', credit: 1, tip: 4, giver: 'naturalist', label: 'Photos taken', name: 'the deer photos', sit: true },
  { id: 'fishing', place: 'fishing', round: 'fishLanded', batch: null, buckle: 'fish', credit: 1, tip: 5, giver: 'fisherman', label: 'Fish landed', name: 'fishing', sit: true },
  { id: 'delivery', place: 'deliveries', long: true, round: 'deliveryDone', batch: 'deliveryDone', buckle: 'deliveries', credit: 1, tip: 12, giver: 'foreman', label: 'Deliveries made', name: 'the deliveries', sit: true },
  { id: 'loot', place: 'loot', long: true, round: 'lootDone', batch: 'lootDone', buckle: 'loot', credit: 2, tip: 15, giver: 'deputy', label: 'Stashes returned', name: "the gang's loot", sit: true },
  { id: 'wagon', place: 'wagon', long: true, round: 'gangDone', batch: 'banditsDone', buckle: 'bandits', credit: 4, tip: 15, giver: 'driver', label: 'Gangs seen off', name: 'the wagon' },
];
export const SHIFT_BY = Object.fromEntries(SHIFT_JOBS.map((j) => [j.id, j]));
// the round events, to the job they count for
export const ROUND_OF = Object.fromEntries(SHIFT_JOBS.map((j) => [j.round, j.id]));

// ── THE WORDS ────────────────────────────────────────────────────────────────────────────────────────────────────
// The job person's thank-you at the end of a shift: warm, plain, of the time and place (said in turn, never the same
// twice running). Plain words for young readers.
export const THANKS = {
  roundup: ['My cattle are all corralled! You made my day, partner.', "That's every head of mine cut out for today. Couldn't have done it without you!",
    "Corral's full and my brand's all accounted for. Much obliged!", "Finest day's roping I've seen all season. Thank you kindly!"],
  sheep: ['Every last one of my sheep is on the mend. You made my day!', 'Thank you so much for healing my sheep, partner!',
    "That's the healthiest flock in the territory now. I'm much obliged.", 'Good doctoring today! Those sheep owe you their wool.'],
  pigs: ["Every pig's back where it belongs. Bless you, dear!", "My pigs are all penned and the gate's tied fast. Thank you kindly!",
    'You saved my whole afternoon! Those pigs mind you better than they mind me.', "That's every pig penned for today. I'll tell the whole valley about you!"],
  store: ['Every order filled! You kept my counter running all day. Thank you!', 'The townsfolk all went home happy. Much obliged for minding the store!',
    'Fine work at the counter today. Here is a little extra for your trouble.'],
  range: ["That's a full day's shooting! Fine work, sharpshooter.", "Not a bottle left standing. I'm proud of you!",
    "You'd have done fine in the Wild West shows. Rest that arm now!"],
  deer: ['What a splendid set of pictures! My book is coming along beautifully.', 'Thank you so much! These deer will be the finest pages in my book.',
    'That is all the pictures I need today. You have a real eye for it!'],
  fishing: ["That's a fine day's fishing! Best day on my dock in years.", 'You have a knack for this, partner. Thank you for the company!',
    "Hang up that rod, partner. That's a full day's catch!"],
  delivery: ['That is everything we needed. You kept the whole camp fed!', "Our camp's stocked up for days. Much obliged, partner!",
    'Fine hauling today! The whole crew sends their thanks.'],
  loot: ["Every family's got their goods back. The whole town thanks you!", "That's the gang's loot all handed back for today. Fine work, partner!",
    "You've done the law proud today. Much obliged!"],
  wagon: ['My freight got through safe all day, thanks to you!', "That's the road cleared for today. I'm much obliged, partner!",
    'No gang can touch this wagon with you riding along. Thank you kindly!'],
};
// ... and once the shift is done, the polite no (the first line every time, the second as it fits the job)
export const DECLINE = "That's all I need for today, partner. Come back tomorrow!";
const DECLINE_MORE = {
  roundup: 'My cattle are all in the corral.', sheep: 'The flock is resting easy.', pigs: 'Every pig is penned.', store: 'The counter is quiet now.',
  range: 'The shelf is swept clean.', deer: 'My book has all the deer pictures it needs today.', fishing: 'Let the fish rest a spell.',
  delivery: 'We are stocked up.', loot: 'The gang has nothing left to give back today.', wagon: 'The freight is safe for today.',
};
// Old Hob's suggestion, by the job he sends the rider to (and the sheriff's lock boxes when every job is done)
export const NEXT = {
  roundup: "The trail boss could use a hand with his cattle", sheep: "Doc Pruitt's sheep need doctoring", pigs: "Mrs. Haskell's pigs are loose again",
  store: 'The general store could use a hand at the counter', range: "Miss Opal's got bottles lined up at the range",
  deer: 'Miss Wren wants more deer pictures for her book', fishing: "The fish are biting off Walt's dock", delivery: 'The camps need supplies hauled',
  loot: "The deputy's got loot to bring back", wagon: "Gus has freight to get through on the road", boxes: "The sheriff's got lock boxes piling up",
};
export const thanksLine = (id, k = 0) => { const L = THANKS[id] || ['Thank you kindly, partner!']; return L[((k % L.length) + L.length) % L.length]; };
export const declineLines = (id) => [DECLINE, ...(DECLINE_MORE[id] ? [DECLINE_MORE[id]] : [])];
export function hobLine(id, giverName = '') {
  const what = NEXT[id] || 'There is more work in town';
  return `${giverName ? `${giverName} is mighty grateful. ` : 'Good work today! '}${what}: follow my hoofprints.`;
}
// the HUD's counter: 'Sheep healed 4/7', or 'Sheep healed 7/7 · done for today'
export function counterText(id, rec) {
  const j = SHIFT_BY[id]; if (!j || !rec) return '';
  return `${j.label} ${Math.min(rec.n, rec.of)}/${rec.of}${rec.done ? ' · done for today' : ''}`;
}

// ── HOW LONG A SHIFT IS ──────────────────────────────────────────────────────────────────────────────────────────
const num = (v, d = 0) => { v = Number(v); return Number.isFinite(v) ? v : d; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// 0 (the short end) .. 1 (the long end): see HOW LONG A SHIFT IS above
export function pace(rider, id) {
  const j = SHIFT_BY[id];
  const places = rider && isObj(rider.levels) && isObj(rider.levels.places) ? rider.levels.places : {};
  const s = j && isObj(places[j.place]) ? places[j.place] : null;
  const h = s && Array.isArray(s.h) ? s.h.filter(Array.isArray).slice(-SHIFT.recent) : [];
  let quick = SHIFT.middle;
  if (h.length >= SHIFT.least) {
    const right = h.filter((x) => x[0]).length / h.length;
    quick = clamp((right - SHIFT.acc[0]) / (SHIFT.acc[1] - SHIFT.acc[0]), 0, 1);
    // (a sit-down job's fast answers: a quick hand gets a little more)
    if (j.sit) { const fast = h.filter((x) => x[0] && x[2]).length / h.length; quick = clamp(quick + fast * SHIFT.fastShare, 0, 1); }
  } else {
    const all = rider && rider.stats && Array.isArray(rider.stats.recent) ? rider.stats.recent : [];
    if (all.length >= SHIFT.leastAll) {
      const right = all.filter(Boolean).length / all.length;
      quick = clamp((right - SHIFT.acc[0]) / (SHIFT.acc[1] - SHIFT.acc[0]), 0, 1);
    }
  }
  const age = rider && rider.age != null && rider.age !== '' ? Math.round(num(rider.age, NaN)) : NaN;   // (no age given: no cap)
  const cap = Number.isFinite(age) ? clamp((age - SHIFT.age[0]) / (SHIFT.age[1] - SHIFT.age[0]), 0, 1) : 1;
  return Math.min(cap, quick);
}
export function shiftLength(rider, id) {
  const j = SHIFT_BY[id]; if (!j) return 0;
  const [lo, hi] = j.long ? SHIFT.long : SHIFT.regular;
  return lo + Math.round((hi - lo) * pace(rider, id));
}

// ── WHAT A RIDER KEEPS ───────────────────────────────────────────────────────────────────────────────────────────
const whole = (v) => Math.max(0, Math.round(num(v)));
// a saved shifts object, well formed (anything missing or broken: a fresh start)
export function cleanShifts(v) {
  const o = isObj(v) ? v : {};
  const jobs = {};
  for (const [k, r] of Object.entries(isObj(o.jobs) ? o.jobs : {})) {
    if (!isObj(r)) continue;
    const of = whole(r.of);
    jobs[k] = { day: whole(r.day), n: whole(r.n), of: of || 1, done: !!r.done };
  }
  return { day: whole(o.day), date: typeof o.date === 'string' ? o.date : '', jobs };
}
export function shiftsOf(rider) {
  if (!rider) return cleanShifts(null);
  if (!isObj(rider.shifts) || !isObj(rider.shifts.jobs)) rider.shifts = cleanShifts(rider.shifts);
  return rider.shifts;
}
export const today = (rider) => shiftsOf(rider).day;
// today's shift for a job: the one kept, or a fresh one (not stored) when the kept one is from an earlier day
export function shiftOf(rider, id) {
  const S = shiftsOf(rider), r = S.jobs[id];
  if (r && r.day === S.day) return r;
  return { day: S.day, n: 0, of: shiftLength(rider, id), done: false };
}
// today's shift for a job, stored (its length is fixed from here on)
export function ensureShift(rider, id) {
  const S = shiftsOf(rider);
  if (!S.jobs[id] || S.jobs[id].day !== S.day) S.jobs[id] = { day: S.day, n: 0, of: Math.max(1, shiftLength(rider, id)), done: false };
  return S.jobs[id];
}
export const isDone = (rider, id) => !!SHIFT_BY[id] && shiftOf(rider, id).done;
// rounds still to go in today's shift (Infinity for a job with no shift)
export function roundsLeft(rider, id) {
  if (!SHIFT_BY[id]) return Infinity;
  const r = shiftOf(rider, id);
  return r.done ? 0 : Math.max(0, r.of - r.n);
}
// one round done: -> { n, of, done, ended } (ended: this round finished the shift); a round after the shift is done
// (the last pig of a batch still loose, say) changes nothing
export function countRound(rider, id) {
  if (!SHIFT_BY[id]) return null;
  const r = ensureShift(rider, id);
  if (r.done) return { n: r.n, of: r.of, done: true, ended: false };
  r.n++;
  const ended = r.n >= r.of;
  if (ended) r.done = true;
  return { n: r.n, of: r.of, done: r.done, ended };
}
// picked on the jobs board: a fresh shift at once (its length worked out again)
export function resetShift(rider, id) {
  const S = shiftsOf(rider);
  if (!SHIFT_BY[id]) return null;
  S.jobs[id] = { day: S.day, n: 0, of: Math.max(1, shiftLength(rider, id)), done: false };
  return S.jobs[id];
}
// a new game day: every job's shift is fresh (the old records count as past days)
export function newDay(rider) { const S = shiftsOf(rider); S.day++; return S.day; }
export function dateKey(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// a ride starting: a later calendar day than the last ride's is a new game day. -> true when it was
export function startRide(rider, now = Date.now()) {
  const S = shiftsOf(rider), key = dateKey(now), was = S.date;
  S.date = key;
  if (was && was !== key) { S.day++; return true; }
  return false;
}
// the game's clock went from `from` to `to` (hours, 0..24) in one step: did the sun come up? (a jump of more than
// SHIFT.jump hours, as when a ride sets the clock to the morning, is not a sunrise)
export function crossedSunrise(from, to, at = SHIFT.sunrise) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
  const step = (((to - from) % 24) + 24) % 24;
  if (step <= 0 || step > SHIFT.jump) return false;
  const after = (((at - from) % 24) + 24) % 24;   // (hours from `from` forward to the sunrise)
  return after > 0 && after <= step;
}
// Old Hob's next job: from [{ id, started, d }] (the open jobs: started today or not, how far off), one not started
// today first, then the nearest
export function pickNext(list) {
  const open = (list || []).filter((x) => x && x.id);
  if (!open.length) return null;
  open.sort((a, b) => (!!a.started === !!b.started ? num(a.d, 1e9) - num(b.d, 1e9) : a.started ? 1 : -1));
  return open[0].id;
}
