// FRIENDSHIP: a meter for everyone on the station, kept with each crew member's own progress (no three.js, so the
// tests run it in Node: tests/friends.test.mjs). src/friendcard.js is the card that shows it (a tap on a person);
// src/people.js THE WARD reads it for the rescued (stay or leave).
//
// THE GAME'S MAKER (2026-11-23 and 24): "I was hoping that there would be an opportunity to develop a friendship with
// a survivor if you liked thier style or something and they might stay." "We talked about having a friendship meter.
// I think it should be 2/5 or 3/10 friend strength and they won't leave the station, maybe the equivalent of talking
// to them 6 times or asking them to play a couple games of Mathball." "Everyone gets a meter." "I think talks should be
// spaced, maybe you can get another one after 5 minutes. It's supposed to be like an ongoing relationship you're
// developing." "I'd say that a survivor should stay at least 15 minutes from the last time you've interacted
// (clicked) with them. Sure you could see them later."
//
// SO:
//   - every person has a meter of FRIENDS.pips (10) pips, kept per crew member (crew.friends: { [person id]: { p: pips,
//     talk: when the last talk that counted was, tap: when they were last tapped } }, times in ms on the wall clock);
//   - a talk fills FRIENDS.talk (half a pip); another talk with the same person fills nothing until FRIENDS.talkGap
//     (5 minutes) after the last one that did; a game of Mathball against them fills FRIENDS.game (one and a half), won
//     or lost; nothing ever takes from it;
//   - a rescued survivor at FRIENDS.stays (3) or more stays on the station for good; under it, they leave once
//     FRIENDS.leave (15 minutes) have passed since the player last tapped them, or since they came, if never tapped;
//   - at FRIENDS.crew (5) or more a person would say yes to joining the crew (agreesToCrew: nothing asks it yet);
//   - who left is kept (crew.departed: [{ id, name, look, position, pips, at }]), to be met again one day.
// MINUTES ARE THE WALL CLOCK'S (Date.now, saved with the crew member), so they pass while the game is closed too.
// To count only the minutes played instead, `now` below is the one line to change (a clock that only runs in play).
//
//   FRIENDS                      the numbers
//   meterOf(crew, id)            -> { p, talk, tap } (a fresh one, not kept, if they have none)
//   add(crew, id, pips, why, now) -> the pips now (at most FRIENDS.pips; nothing for a 0 or less)
//   talk(crew, id, now)          -> { counted, pips, wait }: counted, half a pip; else wait (ms) till one would count
//   talkWait(crew, id, now)      -> ms until a talk would count again (0: now)
//   tap(crew, id, now)           a tap on them: its time kept
//   staysForGood(crew, id)       -> true at FRIENDS.stays or more
//   leavesAt(crew, id, came)     -> ms on the wall clock a rescued survivor leaves (Infinity: they stay)
//   left(crew, who, now)         one who left the station: kept in crew.departed (and their ward record let go)
//   makeFriends({ crew, save, now })  -> the game's: add(id, pips, why), pips(id), agreesToCrew(id), and the rest
//                                     for the current crew member, saved as it changes
export const FRIENDS = { pips: 10, talk: 0.5, game: 1.5, stays: 3, crew: 5, talkGap: 5 * 60e3, leave: 15 * 60e3, departedMost: 200 };
// THE CLOCK: the wall clock (minutes pass while the game is closed). The one line to change.
export const now = () => Date.now();

const tidyPips = (v) => Math.max(0, Math.min(FRIENDS.pips, Math.round((+v || 0) * 2) / 2));
function table(crew) {
  if (!crew) return {};
  if (!crew.friends || typeof crew.friends !== 'object' || Array.isArray(crew.friends)) crew.friends = {};
  return crew.friends;
}
export function meterOf(crew, id) {
  const m = crew && crew.friends && typeof crew.friends === 'object' ? crew.friends[id] : null;
  return m && typeof m === 'object' ? { p: tidyPips(m.p), talk: +m.talk || 0, tap: +m.tap || 0 } : { p: 0, talk: 0, tap: 0 };
}
function keep(crew, id) {
  const T = table(crew), m = meterOf(crew, id);
  T[id] = m; return m;
}
export function add(crew, id, pips, why = '', t = now()) {
  if (!crew || !id) return 0;
  const m = keep(crew, id);
  if (pips > 0) { m.p = tidyPips(m.p + pips); m.last = t; if (why) m.why = String(why).slice(0, 24); }
  return m.p;
}
export function talkWait(crew, id, t = now()) {
  const m = meterOf(crew, id);
  return m.talk ? Math.max(0, m.talk + FRIENDS.talkGap - t) : 0;
}
export function talk(crew, id, t = now()) {
  const wait = talkWait(crew, id, t);
  if (wait > 0) return { counted: false, pips: meterOf(crew, id).p, wait };
  const p = add(crew, id, FRIENDS.talk, 'talk', t);
  keep(crew, id).talk = t;
  return { counted: true, pips: p, wait: FRIENDS.talkGap };
}
export function tap(crew, id, t = now()) { if (crew && id) keep(crew, id).tap = t; }
export const staysForGood = (crew, id) => meterOf(crew, id).p >= FRIENDS.stays;
export const agreesToCrew = (crew, id) => meterOf(crew, id).p >= FRIENDS.crew;
export function leavesAt(crew, id, came = 0) {
  if (staysForGood(crew, id)) return Infinity;
  return Math.max(+came || 0, meterOf(crew, id).tap) + FRIENDS.leave;
}
export function left(crew, who, t = now()) {
  if (!crew || !who) return null;
  const rec = { id: who.id || null, name: who.name || '', look: who.look || null, position: who.position || null, pips: meterOf(crew, who.id).p, at: t };
  if (!Array.isArray(crew.departed)) crew.departed = [];
  if (!crew.departed.some((d) => d && d.id && d.id === rec.id)) crew.departed.push(rec);
  if (crew.departed.length > FRIENDS.departedMost) crew.departed.splice(0, crew.departed.length - FRIENDS.departedMost);
  if (Array.isArray(crew.ward) && rec.id) crew.ward = crew.ward.filter((r) => !(r && r.id === rec.id));
  return rec;
}
// (minutes and seconds, plainly: "4 min", "1 min", "less than a minute")
export function waitWords(ms) {
  const m = Math.ceil(ms / 60e3);
  return ms <= 0 ? 'now' : ms < 60e3 ? 'less than a minute' : m + ' min';
}

// NAMES FOR THE RESCUED: nobody on the station knows theirs until they say it; each is given one as they come home
// (kept with their record), none of them a name of the station's own people: those who walk it (src/life.js ROSTER),
// those at work in the control room and in Cargo (ROOM_CREW), the captains' crews (src/missions.js ROLES) and
// Mathball's own players (tests/friends.test.mjs holds the list to that)
export const RESCUED_NAMES = ['Nora', 'Emil', 'Rosa', 'Joss', 'Mira', 'Dev', 'June', 'Kip', 'Lena', 'Abe', 'Zara', 'Sid', 'Iris', 'Cal', 'Pru', 'Omar', 'Nina', 'Ned', 'Elsa', 'Rafi', 'Bea', 'Lou', 'Hugo', 'Yara'];
export function nameFor(taken = [], rand = Math.random) {
  const free = RESCUED_NAMES.filter((n) => !taken.includes(n));
  const L = free.length ? free : RESCUED_NAMES;
  return L[Math.floor(rand() * L.length) % L.length];
}
// (a stable name for an old saved record that had none: from its own numbers)
export function nameOf(seed) {
  let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return RESCUED_NAMES[h % RESCUED_NAMES.length];
}

// THE GAME'S: for the crew member playing now (crew() -> their record), each change saved (save(crew))
export function makeFriends({ crew = () => null, save = () => {}, clock = now } = {}) {
  const log = [];
  const C = () => crew();
  const kept = (c) => { if (c) save(c); };
  const api = {
    FRIENDS,
    add(id, pips, why = '') { const c = C(); if (!c || !id) return 0; const p = add(c, id, pips, why, clock()); log.push({ id, pips, why, now: p }); if (log.length > 50) log.shift(); kept(c); return p; },
    pips: (id) => meterOf(C(), id).p,
    meter: (id) => meterOf(C(), id),
    agreesToCrew: (id) => agreesToCrew(C(), id),
    staysForGood: (id) => staysForGood(C(), id),
    talk(id) { const c = C(); if (!c || !id) return { counted: false, pips: 0, wait: 0 }; const r = talk(c, id, clock()); if (r.counted) { log.push({ id, pips: FRIENDS.talk, why: 'talk', now: r.pips }); kept(c); } return r; },
    talkWait: (id) => talkWait(C(), id, clock()),
    tap(id) { const c = C(); if (!c || !id) return; tap(c, id, clock()); kept(c); },
    leavesAt: (id, came) => leavesAt(C(), id, came),
    left(who) { const c = C(); if (!c) return null; const r = left(c, who, clock()); kept(c); return r; },
    now: () => clock(),
    log,
  };
  return api;
}
