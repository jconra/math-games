// THE SUPPLY RUN TO THE OTHER STATION, ITS CARGO PART (2026-11-22, the game's maker, STA2-5: "What makes the most sense
// to me is you go to the computer, do the questions to calculate out how much of the supplies you need to pack. Maybe
// 5 questions. Then you go get in the forklift and load some pallets onto the containers. If someone is really bad at
// driving, Id say they can get off the forklift and the ship will automatically be loaded once they leave. So then they
// can go up the elevator and board the hauler and everything will be ready for takeoff.")
//   1. THE COMPUTER: the shipping desk's own computer in Cargo works out how much to pack, five questions (the job
//      src/jobs/cargo.js): N pallets, two to a container.
//   2. THE CONTAINERS' DOORS OPEN (kit/containerdoors.js): containers 03 and 02 in the cargo slots (kit/places-plan.js
//      LOAD).
//   3. THE FORKLIFT: the player drives it (src/cargodrive.js) and loads N of the pallets waiting on the loading floor,
//      each just inside a container's doors. GOT OFF before they are all in (2026-11-23, the game's maker, CARGO1-1, B:
//      "Cargo's loader walks over, gets on the forklift and drives the rest into the containers while you watch (when
//      you leave Cargo, whatever is left is loaded at once)."): Cargo's loader is asked to (forklift.loader,
//      src/cargoforklift.js), and all of the rest go in at once when the player leaves Cargo. Until the loader has
//      climbed on, the player can get back on and go on loading (gotOn()). Should the loader not come or not manage
//      it, the rest load themselves as they did before: a pallet at a time where nobody sees it go.
//   4. LOADED: the doors shut (once the forklift is clear of them), and the line says the Hauler is ready: up the lift,
//      across the bridge, aboard. The containers go out to the Hauler: what was loaded in them is gone from Cargo the
//      next time nobody sees it.
// THE CONTRACT that starts it is the supply run's (src/missions.js 'supply', offered at this same computer once the old
// station has been found: src/mission.js deskStart): signed, R.contract(loader) is the ONE CALL that starts the run
// (startRun(crew), kept with the crew member, as their other jobs' tallies are: crew.jobs.cargo.run). Signed as the
// run's Loader, the computer's questions and the forklift are theirs, as above; otherwise it is Cargo's crew's run
// (`byCrew`): worked out already, its doors open, and its pallets go in as the rest of a run got off does (where nobody
// sees, and all at once when the crew member leaves Cargo). As the Hauler is boarded for the run whatever is not in yet
// goes in (R.depart). Until the old station is found the computer still starts a run of its own, any time, as before.
//
//   startRun(crew, { rand }) -> the run           runOf(crew) -> the run on now, or null (none, or one already done)
//   the run: { n (the crew member's runs so far), pallets (3 or 4: how many to load), slots (the containers, LOAD.slots),
//              worked (the computer's questions done), loaded (how many stand in the containers), done, shipped }
//   const R = makeSupplyRun({ crew, save, forklift, doors })    in the game
//   R.update(dt, { inCargo, feet })   each frame; R.open() the slots whose doors are open; R.hold() Cargo's people leave
//   the forklift parked (it waits for the player); R.wants() pallets still to load; R.status() for the forklift's words;
//   R.worked() the computer's questions are done; R.gotOff() the player got off the forklift (gotOn(): back on it);
//   R.line() the last line
import { LOAD, CARGO } from '../kit/places-plan.js';

export const RUN = { pallets: [3, 4], every: 1.2 };   // (how many pallets a run loads; a pallet loading itself at most this often, s)
const tally = (crew) => { if (!crew.jobs || typeof crew.jobs !== 'object') crew.jobs = {}; return (crew.jobs.cargo = crew.jobs.cargo && typeof crew.jobs.cargo === 'object' ? crew.jobs.cargo : {}); };
// the run on now: started and not yet loaded (a run read back from an older save is put right)
export function runOf(crew) {
  const r = crew && crew.jobs && crew.jobs.cargo && crew.jobs.cargo.run;
  if (!r || typeof r !== 'object' || r.done) return null;
  r.pallets = RUN.pallets.includes(r.pallets) ? r.pallets : RUN.pallets[0];
  r.slots = LOAD.slots.slice(0, Math.ceil(r.pallets / LOAD.each));
  r.loaded = Number.isInteger(r.loaded) ? Math.max(0, Math.min(r.pallets, r.loaded)) : 0;
  r.worked = !!r.worked;
  return r;
}
// THE ONE CALL THAT STARTS IT (the supply contract, later): a new run, how many pallets it loads picked now (the
// computer's five questions then work their way to that number at any level)
export function startRun(crew, { rand = Math.random } = {}) {
  const t = tally(crew), n = (Number.isInteger(t.runs) ? t.runs : 0) + 1;
  const pallets = RUN.pallets[Math.floor(rand() * RUN.pallets.length)];
  t.runs = n;
  t.run = { n, pallets, slots: LOAD.slots.slice(0, Math.ceil(pallets / LOAD.each)), worked: false, loaded: 0, done: false, shipped: false, began: Date.now() };
  return t.run;
}
// the last run, done or not (for the words after it is loaded)
export const lastRun = (crew) => (crew && crew.jobs && crew.jobs.cargo && crew.jobs.cargo.run) || null;

// THE LOADING FLOOR KEPT CLEAR while a worked-out run's doors are open: Cargo's people's spots in front of the
// containers, by the pallets waiting and the loading floor's talking spot (src/life.js: 'containers', 'pallets', the
// first of the 'cargo' talks) are not used meanwhile (people.js leaves a spot alone that has failed twice: `bad`, set so
// and put back as it was after), so the forklift is not left waiting for someone standing at their work in its way.
// Anyone already there finishes what they are doing and goes.
export const KEEP_CLEAR = { spots: ['containers', 'pallets'], talks: [['cargo', 0]] };
export function makeSupplyRun({ crew = () => null, save = () => {}, forklift, bridge = () => true, people = () => null }) {
  // (the containers' doors: made with Cargo's pallets, the first time the player steps into the lift)
  const D = () => forklift.doors || null;
  let wait = 0, handed = false, banner = null, shipT = 0, was = null, kept = null;
  // (the loading floor's spots left alone, or used again: kept, the spots and their `bad` as they were)
  function keepClear(on) {
    const pp = people(); if (!pp || !!kept === on) return;
    if (on) {
      kept = [];
      for (const g of KEEP_CLEAR.spots) for (const s of (pp.groups && pp.groups[g]) || []) if (s) { kept.push([s, s.bad]); s.bad = 2; }
      for (const [g, i] of KEEP_CLEAR.talks) { const T = pp.talks && pp.talks[g] && pp.talks[g][i]; if (T) { kept.push([T, T.bad]); T.bad = 2; } }
    } else { for (const [s, b] of kept) s.bad = b; kept = null; }
  }
  const R = {
    run: () => { const c = crew(); return c ? runOf(c) : null; },
    // the containers whose doors are open: the run's, once the computer has worked it out, until it is loaded
    open() { const r = R.run(); return r && r.worked ? r.slots : []; },
    // (Cargo's people leave the forklift parked while a worked-out run waits for the player)
    hold() { const r = R.run(); return !!(r && r.worked); },
    wants() { const r = R.run(); return !!(r && r.worked && r.loaded < r.pallets); },
    status() { const r = R.run(); return r ? { pallets: r.pallets, loaded: r.loaded, left: r.pallets - r.loaded, open: r.worked, slots: r.slots } : null; },
    // the forklift's prompt, walking up to it
    forkliftWords() { const s = R.status(); return s && s.open ? `Load the supplies: ${s.left} ${s.left === 1 ? 'pallet' : 'pallets'} to go` : null; },
    // THE COMPUTER OPENED (src/jobs/cargolink.js): the run on now, or a new one (the last one's containers gone out to the
    // Hauler first, if they had not yet)
    begin() {
      const c = crew(); if (!c) return null;
      let r = runOf(c);
      if (!r) {
        const last = lastRun(c);
        if (last && last.done && !last.shipped) { if (forklift.stock) forklift.stock.ship(true); last.shipped = true; }
        r = startRun(c); save(c);
      }
      return r;
    },
    // THE SUPPLY CONTRACT SIGNED (src/mission.js): its run, the one on now or a new one; loader: the crew member signed
    // as the run's Loader (the computer and the forklift are theirs); not: Cargo's crew's, worked out and loading
    // (own: a run of the crew member's own, in a Hauler they bought: kept with the run, so its Loader's questions are
    // half as many again whenever the computer is opened: src/jobs/cargolink.js)
    contract(loader, { own = false } = {}) {
      const c = crew(); if (!c) return null;
      const r = R.begin(); if (!r) return null;
      if (own) r.own = true; else delete r.own;
      if (!loader) { r.byCrew = true; r.worked = true; handed = true; banner = { t: 0, title: 'Cargo\'s crew load the Hauler', words: `${r.pallets} pallets for the old station go into the containers without you. The Hauler will be ready: up the lift, across the bridge, aboard.` }; }
      save(c);
      return r;
    },
    // the run a contract began (its number, kept with the contract), done or not; null: no such run
    contractRun(n) { const c = crew(), r = c ? lastRun(c) : null; return r && (n == null || r.n === n) ? r : null; },
    // THE HAULER BOARDED FOR THE RUN: whatever of a worked-out run is not in the containers yet goes in now (the crew
    // member has left Cargo), the run is loaded, and its containers are gone out to the Hauler
    depart(n) {
      const c = crew(), r = c ? lastRun(c) : null; if (!r || (n != null && r.n !== n)) return false;
      if (forklift.stock) { while (forklift.stock.count() < r.pallets && forklift.stock.loadOne([], true)); }
      r.loaded = r.pallets; r.done = true; r.flown = true; handed = false; save(c);
      return true;
    },
    // the computer's five questions are done: the doors open
    worked() { const c = crew(), r = R.run(); if (!c || !r) return; r.worked = true; save(c); },
    // got off the forklift before the run is loaded: Cargo's loader loads the rest from now on (and the player is told so)
    gotOff() {
      const r = R.run(); if (!(r && r.worked && r.loaded < r.pallets)) return;
      handed = true; const left = r.pallets - r.loaded, pp = people(), O = pp && pp.list ? pp.list.find((q) => q.id === CARGO.loader) : null, who = (O && O.name) || 'Cargo\'s loader';
      banner = { t: 0, title: `${who} loads the rest`, words: `${who} drives the other ${left === 1 ? 'pallet' : `${left} pallets`} into the containers. Watch, or go on up the lift: the Hauler will be ready.` };
    },
    // back on the forklift before the loader has climbed on: the loading is the player's again
    gotOn() { const r = R.run(); if (r && !r.byCrew && handed) { handed = false; banner = null; } },
    get handed() { return handed; },
    get kept() { return kept ? kept.length : 0; },
    line: () => banner,
    update(dt, { inCargo = false, feet = [] } = {}) {
      const c = crew(); if (!c || !forklift || !forklift.stock) return;
      const r = runOf(c), key = c.id;
      if (key !== was) { was = key; handed = false; banner = null; }
      if (r && r.worked) {
        // (a run kept from before the page was loaded again: what was loaded is in the containers again)
        if (forklift.stock.count() < r.loaded) forklift.stock.putLoaded(r.loaded);
        const n = forklift.stock.count();
        if (n !== r.loaded) { r.loaded = Math.min(r.pallets, n); save(c); }
        // THE REST LOAD THEMSELVES: got off, a pallet at a time where nobody sees; the player gone from Cargo, all at once
        if (r.loaded < r.pallets && (handed || !inCargo) && !(forklift.hand && forklift.hand.on)) {
          wait -= dt;
          if (!inCargo) { while (forklift.stock.count() < r.pallets && forklift.stock.loadOne([], true)); }
          // (CARGO'S LOADER drives them in, in sight: asked each frame the run wants it; not come, or given up: as before)
          else if (forklift.loader && forklift.loader.ask(r.pallets - r.loaded)) wait = RUN.every;
          else if (wait <= 0) { wait = RUN.every; forklift.stock.loadOne(feet); }
          const m = forklift.stock.count(); if (m !== r.loaded) { r.loaded = Math.min(r.pallets, m); save(c); }
        }
        if (r.loaded >= r.pallets) {
          r.done = true; r.at = Date.now(); handed = false; save(c);
          banner = { t: 0, title: 'The Hauler is loaded', bridge: bridge(), words: R.readyWords() };
        }
      }
      keepClear(!!(r && r.worked));
      // the doors: open while the run is worked and not loaded; shut once it is, the forklift clear of them
      const doors = D();
      if (doors) for (const k of LOAD.slots) {
        const on = !!(r && r.worked && r.slots.includes(k));
        if (on) doors.set(k, true);
        else if (doors.isOpen(k) && forklift.stock.clearOf(k)) doors.set(k, false);
      }
      // THE CONTAINERS GO OUT TO THE HAULER: shut and loaded, what is in them is gone the next time nobody sees it
      const last = lastRun(c);
      if (last && last.done && !last.shipped && LOAD.slots.every((k) => !doors || doors.shut(k))) {
        shipT += dt;
        // (inside shut containers: nobody sees them go)
        if (shipT > 1 && forklift.stock.count() > 0) forklift.stock.ship(true);
        if (forklift.stock.count() === 0) { last.shipped = true; save(c); shipT = 0; }
      }
      if (banner) banner.t += dt;
    },
    // THE LAST LINE (his words: "So then they can go up the elevator and board the hauler and everything will be
    // ready for takeoff"); the bridge to the Hauler is the dock's job, and it may not be built yet
    readyWords() {
      return bridge() ? 'The Hauler is loaded and ready for takeoff. Up the lift to the main deck, out across the bridge and aboard.'
        : 'The Hauler is loaded and ready for takeoff. The bridge out to it is the docking bridge job, by the airlock on the main deck: build it to go aboard.';
    },
  };
  return R;
}
