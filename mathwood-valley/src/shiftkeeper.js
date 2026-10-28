// THE SHIFT KEEPER: the game's side of the shifts (the logic and the words are src/shifts.js). It hears the jobs'
// events (main.js hands it every Hob event first), counts the rounds of each job's shift, and when a shift is done:
//   - the job's person thanks the rider in their speech card (src/jobfolk.js JF.thank; Miss Opal's own card at the
//     range; the storekeeper's card over the store's door), in place of the job's usual thank-you just then
//   - a tip of about one round's pay goes in the purse (a toast says who gave it)
//   - a short, gentle fanfare (src/audio/fanfare.js)
//   - the shift counts toward the job's belt buckle (about one round's worth: SHIFT_JOBS credit)
//   - the jobs board stamps the job's notice "Done for today" (it asks done(id))
//   - Old Hob suggests another job that's still open, and the jobs board's hoofprints lead to it (JB.pick)
// Then the job asks open(id) before dealing another round (a new bunch, a new flock, the next customer...), and the
// person says their polite no (helloFor, decline). At the next sunrise in the game every shift starts fresh; picking a
// done job on the jobs board ("Ask for more work") starts a fresh one at once (ask).
//
//   const SK = makeShiftKeeper({ W, rider, hud, hob, audio, folk, board, range, player, busy, current, working, jobOn,
//     refresh, ends, store })
//     folk(), board(), range(): the job folk (JF), the jobs board (JB), the bottle range (SR), or null; player(): P;
//     busy(): true while a sit-down job, a panel or a builder has the rider (Hob's suggestion waits for it to end);
//     current(): the job the rider is at or chose (main.js jobNow); working(): the job asking a question where the
//     rider is (main.js askingJob); jobOn(id): the job is on for this rider (not turned off, and in this ride);
//     ends: { [id]: () => {} } what a job does when its shift ends, beyond what it does itself (the fishing's rod put
//     down); store(): where the storekeeper's card shows ({ x, z }: the store's door)
//   SK.heard(name, data) -> true when the event's usual thank-you gives way to the shift's own (data.shiftEnd)
//   SK.open(id), SK.left(id), SK.done(id)   may the job deal another round; rounds left today; done for the day
//   SK.ask(id)          picked on the jobs board ("Ask for more work"): a fresh shift now
//   SK.decline(id)      the person's polite no (said once in a while, however often it is asked for)
//   SK.helloFor(personId)   the polite no in place of a person's hello while their job is done for today, or null
//   SK.update(dt)       each frame of play: the sunrise, the ending's steps, the HUD's counter
//   SK.state(), SK.dev { end(id) (finish the job's shift now), day() (a sunrise now), set(id, n, of) (today's shift at
//                       n rounds done, of long) }
import { SHIFT_BY, SHIFT_JOBS, ROUND_OF, shiftOf, countRound, resetShift, isDone, roundsLeft, newDay, startRide, crossedSunrise,
  thanksLine, declineLines, hobLine, ensureShift, shiftsOf, pickNext } from './shifts.js';
import { saveRider, earn, countJob, JOBS } from './save.js';
import { playFanfare } from './audio/fanfare.js';

export const KEEPER = {
  quiet: 10,       // s after a shift's end in which the job's own batch thank-you gives way to the shift's
  toast: 2.6,      // s after the end before the tip's toast (the job's own toasts for its last round go first) ...
  freeToast: 2.4,  // ... and at least this long after a counter or a slip has closed (its own note goes first)
  hob: 3.6,        // s after the end before Old Hob suggests the next job ...
  freeHob: 1.5,    // ... and at least this long after the rider is free (a sit-down job put away)
  close: 1.4,      // s after the end before a sit-down job is put away by the keeper (the fishing rod)
  show: 9,         // s the finished shift's counter stays on the HUD
  declineEvery: 5, // s: the polite no at most this often
};

// who thanks the rider for each job, by the giver's id (src/shifts.js SHIFT_JOBS giver): the name for the toast and
// Hob's line
const NAMES = { boss: 'Cal Wheeler', vet: 'Doc Pruitt', wife: 'Mrs. Haskell', driver: 'Gus', naturalist: 'Miss Wren', deputy: 'Deputy Mills',
  fisherman: 'Old Walt', marksman: 'Miss Opal', storekeeper: 'The storekeeper', foreman: 'The foreman' };
// a job person's id (src/jobfolkplan.js) to the job they give
const PERSON_JOB = { boss: 'roundup', vet: 'sheep', wife: 'pigs', driver: 'wagon', naturalist: 'deer', deputy: 'loot', fisherman: 'fishing' };

export function makeShiftKeeper({ W, rider, hud, hob, audio = null, folk = () => null, board = () => null, range = () => null, player = () => null,
  busy = () => false, current = () => null, working = () => null, jobOn = () => true, refresh = () => {}, ends = {}, store = () => null, foreman = () => false }) {
  const SK = {};
  startRide(rider);
  saveRider(rider);
  let lastEnd = null;          // { id, at }: the last shift ended (its batch's own thank-you gives way)
  let ending = null;           // { id, t, data, toast, hob, closed, said } the ending's steps under way
  let time = 0, hourWas = Number.isFinite(W && W.hour) ? W.hour : null;
  const declined = {};         // id -> when its polite no was last said
  const thanksN = {};          // id -> how many shift thank-yous said this ride (they take turns)
  const on = (id) => !!SHIFT_BY[id] && jobOn(id);

  SK.open = (id) => !on(id) || !isDone(rider, id);
  SK.done = (id) => on(id) && isDone(rider, id);
  SK.left = (id) => (on(id) ? roundsLeft(rider, id) : Infinity);

  // ── COUNTING ───────────────────────────────────────────────────────────────────────────────────────────────────
  SK.heard = (name, data = {}) => {
    const id = ROUND_OF[name];
    if (id && on(id) && !(data && data.ambush)) {   // (a hold-up on the road is the wagon's own business, never a round)
      const r = countRound(rider, id);
      saveRider(rider);
      if (r && r.ended) { end(id, data); return true; }
    }
    // (a job's own batch thank-you that comes with the shift's end: the shift's own takes its place)
    if (lastEnd && SHIFT_BY[lastEnd.id].batch === name && time - lastEnd.at < KEEPER.quiet) return true;
    return false;
  };

  // ── THE ENDING ─────────────────────────────────────────────────────────────────────────────────────────────────
  function giverOf(id, data) { const j = SHIFT_BY[id]; return j.giver === 'foreman' && data && data.camp ? data.camp : j.giver; }
  function end(id, data) {
    const j = SHIFT_BY[id];
    lastEnd = { id, at: time };
    ending = { id, t: 0, free: 0, data: data || {}, toast: false, hob: false, closed: false, said: false };
    // the tip, and the shift's credit toward the job's buckle
    const e = earn(rider, j.tip);
    const c = countJob(rider, j.buckle, j.credit);
    saveRider(rider);
    refresh();
    if (c && c.buckle && JOBS.some((x) => x.id === j.buckle)) hud.buckle(c.buckle, { delay: (KEEPER.toast + 1.2) * 1000 });
    if (e && e.newTitle) setTimeout(() => hud.toast(`You're a ${e.newTitle} now!`, 'gold'), (KEEPER.toast + 3) * 1000);
    playFanfare(audio);
    // the thank-you: in the person's card as soon as nothing else is said (a panel or a counter over the game: once it
    // has gone); the range's Miss Opal once the six-shooter is put away (update)
    const k = thanksN[id] = (thanksN[id] ?? -1) + 1, line = thanksLine(id, k + Math.floor(Math.random() * 2));
    ending.line = line;
    if (j.giver !== 'marksman') { thank(id, line, data); ending.said = true; }
  }
  function thank(id, text, data) {
    const JF = folk(), j = SHIFT_BY[id];
    if (j.giver === 'storekeeper') { const s = store(); return !!(JF && s && JF.thank({ id: 'storekeeper', name: NAMES.storekeeper, x: s.x, z: s.z }, text)); }
    return !!(JF && JF.thank(giverOf(id, data), text));
  }
  // Old Hob's next job: one still open today, not started yet if there is one, else the nearest; the sheriff's lock
  // boxes when every job is done
  function nextJob(after) {
    const JB = board(), P = player(), at = P && P.position;
    const list = [];
    for (const j of SHIFT_JOBS) {
      if (j.id === after || !on(j.id) || isDone(rider, j.id)) continue;
      if (JB && JB.jobs && !JB.jobs.some((b) => b.id === j.id)) continue;
      const g = JB && JB.where ? JB.where(j.id) : null;
      let d = g && at ? Math.hypot(g.x - at.x, g.z - at.z) : 1e6;
      if (g && g.stable) d += 1e5;   // (a job that needs a saddled horse the rider hasn't got: after the rest)
      list.push({ id: j.id, started: shiftOf(rider, j.id).n > 0, d });
    }
    return pickNext(list) || 'boxes';
  }
  function suggest(id) {
    const next = nextJob(id), JB = board();
    const j = SHIFT_BY[id], who = j.giver === 'foreman' ? NAMES.foreman : NAMES[j.giver];
    if (hob && hob.say) hob.say(hobLine(next, who), 6500, { first: true });
    if (JB && JB.pick) JB.pick(next, { quiet: true });
    if (ending) ending.next = next;
  }
  function endingStep(dt) {
    if (!ending) return;
    const E = ending, j = SHIFT_BY[E.id];
    E.t += dt;
    E.free = busy() ? 0 : E.free + dt;   // (how long the rider has been free of a counter, a slip or a panel)
    if (!E.toast && E.t >= KEEPER.toast && E.free >= Math.min(E.t, KEEPER.freeToast)) { E.toast = true; hud.toast(`Done for today! ${j.giver === 'foreman' ? NAMES.foreman : NAMES[j.giver]} tips you ${j.tip} gold`, 'gold'); }
    if (!E.closed && E.t >= KEEPER.close) { E.closed = true; const f = ends[E.id]; if (f) try { f(); } catch (e) { console.warn('shifts: the job could not be put away', e); } }
    // (Miss Opal: her card over her head once the six-shooter is put away)
    if (!E.said && j.giver === 'marksman') { const SR = range(); if (!SR) E.said = true; else if (!SR.active && SR.say) { SR.say([E.line]); E.said = true; } }
    if (!E.hob && E.t >= KEEPER.hob && E.free >= Math.min(E.t, KEEPER.freeHob)) { E.hob = true; suggest(E.id); }
    if (E.toast && E.hob && E.said && E.t > KEEPER.show) ending = null;
  }

  // ── THE POLITE NO ──────────────────────────────────────────────────────────────────────────────────────────────
  // (far: the person isn't by the rider, as the deputy at a gang camp out in the valley: the words in a note instead)
  SK.decline = (id, { who = null, far = false } = {}) => {
    if (!SK.done(id)) return false;
    if (declined[id] != null && time - declined[id] < KEEPER.declineEvery) return true;
    declined[id] = time;
    const j = SHIFT_BY[id], L = declineLines(id), JF = folk();
    if (far) { hud.toast(`${NAMES[j.giver] || 'They'}: ${L.join(' ')}`); return true; }
    if (j.giver === 'marksman') { const SR = range(); if (SR && SR.say) SR.say(L); return true; }
    if (j.giver === 'storekeeper') { const s = store(); if (JF && s) JF.thank({ id: 'storekeeper', name: NAMES.storekeeper, x: s.x, z: s.z }, L.join(' ')); return true; }
    if (JF) JF.say(who || j.giver, L);
    return true;
  };
  SK.helloFor = (personId) => {
    const id = PERSON_JOB[personId] || (foreman(personId) ? 'delivery' : null);
    if (!id || !SK.done(id)) return null;
    declined[id] = time;
    return declineLines(id);
  };

  // ── PICKED ON THE JOBS BOARD: a fresh shift now ────────────────────────────────────────────────────────────────
  SK.ask = (id) => {
    if (!SHIFT_BY[id]) return false;
    resetShift(rider, id);
    saveRider(rider);
    if (ending && ending.id === id) ending = null;
    if (lastEnd && lastEnd.id === id) lastEnd = null;
    return true;
  };

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  let hudT = 0;
  SK.update = (dt) => {
    time += dt;
    // the sun coming up in the game: a new day, every shift fresh
    const h = W && Number.isFinite(W.hour) ? W.hour : null;
    if (h != null && hourWas != null && crossedSunrise(hourWas, h)) {
      const any = SHIFT_JOBS.some((j) => on(j.id) && isDone(rider, j.id));
      newDay(rider); saveRider(rider);
      if (any && hob && hob.say) hob.say("Sun's up, partner! There's fresh work on the jobs board.", 5000);
    }
    hourWas = h;
    endingStep(dt);
    if ((hudT -= dt) > 0) return;
    hudT = 0.25;
    // the counter on the HUD: the job the rider is at (or chose), once its shift has begun or a question is up there;
    // a shift just finished stays a while
    let id = ending && ending.t < KEEPER.show ? ending.id : current();
    if (!on(id)) id = null;
    let rec = id ? shiftOf(rider, id) : null;
    if (rec && !(rec.n > 0 || rec.done || working() === id)) rec = null;
    if (rec && rec.n === 0 && !rec.done) rec = ensureShift(rider, id);   // (its length fixed once the kid is at it)
    hud.shift(rec ? { label: SHIFT_BY[id].label, n: rec.n, of: rec.of, done: rec.done } : null);
  };

  SK.state = () => ({ day: shiftsOf(rider).day, date: shiftsOf(rider).date, ending: ending ? { id: ending.id, t: +ending.t.toFixed(2), next: ending.next || null, line: ending.line } : null,
    jobs: Object.fromEntries(SHIFT_JOBS.filter((j) => on(j.id)).map((j) => [j.id, { ...shiftOf(rider, j.id) }])) });
  SK.dev = {
    // finish the job's shift now, as its last round would
    end: (id) => { if (!on(id)) return false; const r = ensureShift(rider, id); if (r.done) return false; r.n = r.of - 1; return SK.heard(SHIFT_BY[id].round, {}); },
    day: () => { newDay(rider); saveRider(rider); return shiftsOf(rider).day; },
    // put today's shift at n rounds done (and, given, `of` long): for rigs that test something past a shift's end
    set: (id, n = 0, of = null) => { if (!SHIFT_BY[id]) return null; const r = ensureShift(rider, id); r.n = Math.max(0, Math.round(n)); if (of != null) r.of = Math.max(1, Math.round(of)); r.done = r.n >= r.of; saveRider(rider); return { ...r }; },
  };
  SK.dispose = () => { hud.shift(null); };
  return SK;
}
