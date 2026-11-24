// A CAPTAIN'S RUN, joined to the game (src/missions.js is the plain part; src/contract.js the contract's card and
// src/trip.js the trip itself, both loaded only when wanted, so the station costs what it did):
//   - a captain's "Interested" brings up their contract (missions.on); signed, it is kept with the crew member, the
//     Miner waits on its pad (crane.awayHeld), a line on the floor leads to it, and the captain says so and walks to
//     the ship to wait by its way in (the game's maker, 2026-11-18: "once you agree to a contract with the captain then
//     they will say "Glad to have you, I will meet you at the ship". Then they will start walking to the ship and wait
//     by the door. You can walk with them or run there and get in the pilots seat or go eat a burrito and then go meet
//     them. But I want as little of black screen, magically appear in the game as possible");
//   - the run starts from the pilot's seat and nowhere else: in the ship's cockpit a prompt comes up, as at a job (Sit
//     down, E). There is no "shall we go now", and nobody is put in the seat behind a dark screen;
//   - home, the share waits at the smelter's controls: the smelter job's first card there is the payout card
//     (payoutCard: the panel's `card` hook), its prompt says so (hint), and a line on the floor leads to it; the right
//     answer brings the pay, whatever was picked before it;
//   - signed as the ship's engineer, THE CORE'S TUNING is out at the rocks, a step of the trip itself (src/missions.js
//     'tune', src/trip.js, src/tune.js): nothing here in the hangar or at the smelter knows of it, but for telling the
//     trip which of its two moments was picked when the contract was signed (tuneWhen), and giving the crew member's
//     walking back to them while they are on their feet out there (the trip's `holds`).
//   - CAPTAIN HALE'S RESCUE RUN (src/missions.js 'rescue') the same way, its ship the Medic: she says so and waits by
//     its ramp, the line leads to it, the run starts from its pilot's seat (or, signed only as its engineer, from its
//     cockpit), and home the share waits at the triage desk in the medical centre (the medical job's first card there).
//     The Medic is flown by the one shared ship piece with its own hull as its keeper (src/shiphull.js: keeperOf), and
//     meets the other hangars with a keeper of its own for the run (src/visit.js: visitOf); the Miner's crane is left
//     to its own round.
//   - CAPTAIN VEGA'S EXPLORING RUN (src/missions.js 'explore') the same way, its ship the Explorer, by its airstair; the
//     run's plan (src/exploreplan.js planOf: its scenario and places, from the contract's seed, whether the station's
//     radio tower is repaired, and what the crew member has found before) is made as they sit down; home, the share
//     waits AT THE EXPLORER'S OWN SURVEY TABLE aboard (payAt 'survey': its prompt there, Start (E), and the payout card
//     on the survey table's own card, asked at the crew member's level at the table), the line leading to it.
//
//   - THE HAULER'S SUPPLY RUN TO THE OLD STATION (src/missions.js 'supply') the same way: ITS OWN CAPTAIN'S CONTRACT
//     (the game's maker, 2026-11-23, HAUL1-1 C; src/life.js HAULER_CAPTAIN, by the docking port), offered on the same
//     card once the old station has been found (the mission's `offered`; until then the captain has no run to ask
//     about, and with the Hauler for sale to this crew member the card is the sale's line alone). Signed, the captain
//     says so and waits BY THE DOCKING PORT (meetSpot: the Hauler lies out across the bridge, where nobody of the station
//     walks), and is aboard from the moment the crew member sits down, as the other captains are. What stays AT THE
//     SHIPPING DESK'S COMPUTER IN CARGO (the mission's `desk`) is the Loadmaster's work (src/supplyrun.js: the five
//     questions and the forklift theirs, or Cargo's crew's) and the share (the cargo job's first card there, deskLive,
//     as a mining run's waits at the smelter's controls and a rescue's at the triage desk). The run starts from the
//     Hauler's pilot's seat once the supplies are worked out, the line leading across the bridge; its keeper is the
//     dock's own hull (src/shiphull.js `dock`); paid, it can be signed for again as a plain hauling run.
//
//   - A SHIP BOUGHT, AND TAKEN OUT AS YOUR OWN (src/own.js has the game's maker's words; src/contract.js the cards):
//     every captain's card has the ship's sale as its last line (saleFor: the price, how many credits short, or the
//     buying itself: the credits spent and the ship kept with the crew member), the Hauler's captain's too (for sale
//     once the crew member's bridge out to it is built). An owned Hauler has a second button on the shipping computer's
//     prompt (deskMore), where its own run is begun. IN THE COCKPIT OF A SHIP
//     THAT IS THEIRS, with no contract on it, the seat's prompt reads "Your Miner: take it out" (Take it out, E) and
//     brings up the owner's card (ownCard): a run of their own, which starts at once from the seat they are standing by
//     (the same trip, `own`: no captain aboard, the hired crew for the jobs left to them, more cards for their own jobs),
//     or just flying (startFree: out, round the station and back, nothing asked and nothing paid). An own run is never
//     left signed in a hangar's ship: given up, or the page loaded again in the middle of it, it is gone and the seat
//     offers again. The Hauler's own run is begun at the shipping computer, where its load is worked out, and is kept as
//     the supply contract is until it is flown. Going to a captain for a contract is exactly as it was, owned or not.
//
//   const mission = makeMission({ W, walls, input, boarding, crane, jobs, guide, outside, people, crew, save, body, put, lib })
//   mission.update(dt, P, playing) -> true while a trip has the player (seated: no walking, the trip's camera); on
//                                    their feet out at the rocks, tuning the core, their walking is their own: false
//   mission.aim(camera, dt), mission.late()     the trip's camera and its last word on the picture
//   mission.stop()                               the crew screen: a trip given up, a card put away
//   mission.payoutCard(at), mission.hint(at)     where the share waits (at: the job's id: 'smelter', or 'medical' for a
//                                                rescue: src/missions.js payAt)
//   mission.offer(id), mission.start(), mission.state(), mission.trip   (the rigs)
import * as THREE from 'three';
import { missions, missionOf, contractOf, sign, signOwn, tearUp, freeFlight, collect, payoutOrder, tuneWhen, seedOf, MISSIONS, stationFound, supplyRuns } from './missions.js';
import { saleOf, buy, owns } from './own.js';
import { bridgeStands } from './jobs/dock.js';
import { CAPTAINS } from './lines.js';
import { ROSTER } from './life.js';
import * as E from './jobs/engine.js';
import { JOB as smelter } from './jobs/smelter.js';
import { JOB as medical } from './jobs/medical.js';
import { makeHull } from './shiphull.js';
import { shipOf as shipFacts, flightOf } from './fleet.js';
import { makeVisit } from './visit.js';
import { planOf, foundOf } from './exploreplan.js';
import { antennaRepaired } from './jobs/antenna.js';
import { JOB as survey } from './jobs/survey.js';
import { JOB as cargo } from './jobs/cargo.js';
import { openPanel } from './jobs/panel.js';

// (the line on the floor: to the run's ship, and to where the share waits)
const LINE = { ship: '#ffd560', payout: '#ff8a3a' };
// THE STATION JOBS WHERE A RUN'S SHARE WAITS (src/missions.js `payAt`): its payout card is the first card there (the
// panel's `card` hook), asked at the crew member's own level of that job
const PAY_AT = { smelter, medical, survey, cargo };
// (where each run goes, as the seat's prompt says it)
const PLACE_WORDS = { field: 'the rocks', planet: 'the planet', explore: 'the edge of the charts', oldstation: 'the old station' };
const nameOfShip = (id) => (shipFacts(id) || {}).name || 'ship';
const shipName = (M) => nameOfShip(M.ship);
// (the run each ship flies: its captain's, and the owner's own)
const runOfShip = (id) => Object.values(MISSIONS).find((M) => M.ship === id) || null;
// (a run of the Miner's: its crane holds it on its pad for the run, and takes its canisters off it after)
const minerRun = (m) => !!m && MISSIONS[m.id].ship === 'miner';

export function makeMission({ W, walls, input = null, boarding, crane, jobs, guide, outside = null, visit = null, people = () => null, crew = () => null, save = () => {}, body = () => null, put = () => {}, lib = null, supply = () => null, dock = null, inCargo = () => false }) {
  let card = null, trip = null, loading = false, playing = false, lastRun = null, toast = null, toastT = 0, lineTo = null;
  // (a captain as they are called: the station's person, or before its people are aboard the roster's own entry)
  const nameOf = (id) => { const p = people(); const P = (p && p.list.find((x) => x.id === id)) || ROSTER.find((d) => d.id === id); return (P && P.name) || 'The captain'; };
  const fail = (e) => { console.error(e); if (window.oops) window.oops(e); };

  // ── the seat's prompt (the job prompt's own look) and a word at the top when a share is waiting ──
  const prompt = document.createElement('div'); prompt.className = 'pnj-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pnj-pw"><b>Pilot\'s seat</b><small>Sit at the controls and fly the Miner out</small></div><button type="button" class="pnj-go">Sit down<kbd>E</kbd></button>';
  // (signed for the drill and not the pilot's seat: the captain's own pilot flies; the crew member rides out)
  let prompted = null;
  // (IN THE COCKPIT OF A SHIP THAT IS THEIRS, no contract on it: the seat offers it, and the owner's card comes up)
  let ownAt = null;
  const promptOwn = (ship) => {
    const key = 'own:' + ship; if (key === prompted) return; prompted = key;
    prompt.querySelector('.pnj-go').hidden = false;
    prompt.querySelector('b').textContent = 'Pilot\'s seat';
    prompt.querySelector('small').textContent = `Your ${nameOfShip(ship)}: take it out`;
    prompt.querySelector('.pnj-go').innerHTML = 'Take it out<kbd>E</kbd>';
  };
  // (the seat's button, pressed: the run signed for, or the owner's card)
  const seatGo = () => (ownAt ? ownCard(ownAt) : start());
  // (signed only as the ship's engineer: no seat is theirs, the two chairs are the crew's (src/trip.js); they tell the
  // crew they are aboard, and the run begins with them on their feet)
  const promptFor = (m) => {
    const M = MISSIONS[m.id], ship = shipName(M), to = PLACE_WORDS[M.place] || 'the rocks';
    // (a supply run whose supplies are not worked out yet: nothing to fly out with; the seat says so and offers nothing)
    const wait = loadWait(m);
    const pilot = m.roles.includes('pilot'), seat = pilot || m.roles.includes('drill'), key = m.id + ':' + (wait ? 'wait' : pilot ? 'pilot' : seat ? 'seat' : 'ready'); if (key === prompted) return; prompted = key;
    prompt.querySelector('.pnj-go').hidden = !!wait;
    if (wait) { prompt.querySelector('b').textContent = `The ${ship}'s cockpit`; prompt.querySelector('small').textContent = wait; return; }
    prompt.querySelector('b').textContent = pilot ? 'Pilot\'s seat' : `The ${ship}'s cockpit`;
    prompt.querySelector('small').textContent = pilot ? `Sit at the controls and fly the ${ship} out` : seat ? `Sit down and ride out to ${to} with the crew` : `Tell the crew you are aboard: they fly out to ${to}`;
    prompt.querySelector('.pnj-go').innerHTML = (seat ? 'Sit down' : 'Ready') + '<kbd>E</kbd>';
  };
  document.body.appendChild(prompt);
  // (THE SUPPLY RUN'S LOAD: worked out (the Loadmaster's five questions done, or Cargo's crew's run), it loads itself once
  // the crew member has left Cargo, src/supplyrun.js; not worked out yet, the Hauler has nothing to take: the words)
  function loadWait(m) {
    if (!m || !MISSIONS[m.id].desk) return null;
    const S = supply(), r = S && S.contractRun ? S.contractRun(m.run) : null;
    return r && (r.worked || r.done) ? null : 'The supplies are not worked out yet: the shipping computer in Cargo, down the lift';
  }
  prompt.querySelector('.pnj-go').addEventListener('click', () => seatGo());
  addEventListener('keydown', (e) => { if (!prompt.hidden && playing && !trip && !card && (e.key === 'e' || e.key === 'E' || e.key === 'Enter')) { e.preventDefault(); seatGo(); } });

  // ── WHO KEEPS EACH SHIP'S HULL WHERE IT IS FLOWN AND STANDS (src/flying.js `hull`): the Miner's crane (its canisters
  // ride on it), or the ship's own shared hull (src/shiphull.js), made once and kept for the game, as the Flight Lab
  // has it. A run asks its keeper to let the ship go (depart), to have it home (arrive) and to put it back (back): the
  // crane's own, for the Miner; nothing more to do for a ship with no crane ──
  const hulls = new Map();
  function keeperOf(id) {
    if (id === 'miner') return crane;
    if (!hulls.has(id)) {
      // (the ship at the dock, the Hauler: its hull is the dock's own group, src/dockwalk.js `hull`)
      const s = boarding.ships.find((q) => q.id === id), H = s ? makeHull({ W, id, kit: s.flight, boarding, dock: (s.dock && s.dock.hull) || null, eyes: () => { const pp = people(); return pp && pp.eyes ? pp.eyes() : []; } }) : null;
      if (H) Object.assign(H, { depart: () => true, arrive: () => null, back: () => { H.fly(null); return true; }, aboard: () => {} });
      hulls.set(id, H);
    }
    return hulls.get(id);
  }
  // THE OTHER HANGARS AS EACH FLOWN SHIP MEETS THEM (src/visit.js: the alarm, the ships parked there shoved and put
  // back): the game's own for the Miner; for another ship one of its own, made as it sets off on a run and stepped
  // each frame here (late); the run over, any ship it shoved is put back and it is let go (its dark beacons in the
  // other hangars with it), with the run's ship home in its own hangar
  const visits = new Map();
  function visitOf(id) {
    if (id === 'miner' || !flightOf(id)) return visit;
    // (a ship that docks goes into no hangar: nothing parked there is met)
    if (flightOf(id).dock) return null;
    if (!visits.has(id)) visits.set(id, makeVisit({ W, boarding, outside, people, cfg: flightOf(id), crane }));
    return visits.get(id);
  }
  let lastDt = 1 / 60;
  // (the run's ship, as its name is said; a contract's ship)
  const shipOf = (m) => (m ? MISSIONS[m.id].ship : 'miner');
  // ── where the captain waits: by the ship's way in, on the hangar's floor wherever the ship stands (off every patch
  // the station's people keep off); nowhere while the ship is in the air. Worked out again only when the ship stands
  // somewhere else, or the run is another ship's. THE MINER: by its belly lift, a step out from the ship's side beside
  // the lift's foot. A SHIP WITH WAYS IN THAT COME DOWN TO THE FLOOR (the Medic's ramp and crew door): a step out
  // beyond the foot of one, to one side of it, clear of it as it comes down ──
  // (its port side first, where the lift's open side is; a ship set down hard by a wall on that side: the other side.
  // skip: the n-th place that can be stood on, for a captain who found no way to an earlier one)
  // THE SHIP AT THE DOCK (the Hauler: src/fleet.js `dock`) lies out across the bridge, where nobody of the station walks:
  // its captain waits BY THE DOCKING PORT, in the terminal beside the port's doorway (the way out to the ship; never in
  // the doorway itself, nor in the airlock, where the dock's own job is done): the station's own named places, the
  // airlock and from it toward the galley, `dockOut` m along and `dockSide` m to a side of that line, turned to the room
  const MEET = { nose: [1.4, 2.6, 3.8], port: [4.7, 5.4, -4.7, -5.4], out: [2.6, 3.4], side: [1.4, -1.4, 2.4, -2.4, 0], dockOut: [6.9, 7.7], dockSide: [1.6, 2.5, -1.6] };      // (m from the ship's middle, in its own frame; the Miner's lift's foot is 2.6 m to port; beyond a way's foot, and to its side)
  let meetKey = null, meetAll = [];
  function meetSpot(skip = 0) {
    // (in the air: nowhere to wait by it. Down again, wherever, there is: the pilot may still be in the seat)
    const id = shipOf(contractOf(crew())), docks = !!(flightOf(id) && flightOf(id).dock), K = docks ? null : keeperOf(id);
    const fl = trip && trip.fly; if (fl ? !fl.S.landed : K && K.aloft) return null;
    const key = id + ':' + String(boarding.stands ?? 0);
    if (key !== meetKey && docks) {
      meetKey = key; meetAll = [];
      const A = W.R.places?.airlock, G = W.R.places?.galley, pp = people(); if (!A || !G) return null;
      const L = Math.hypot(G[0] - A[0], G[2] - A[2]) || 1, ux = (G[0] - A[0]) / L, uz = (G[2] - A[2]) / L;
      for (const side of MEET.dockSide) for (const out of MEET.dockOut) {
        const s = walls.snap(A[0] + ux * out - uz * side, A[1] + 0.4, A[2] + uz * out + ux * side, 0.5);
        if (s && Math.abs(s.y - A[1]) < 0.3 && !(pp && pp.noGo(s.x, s.z))) meetAll.push({ pos: s, heading: Math.atan2(G[0] - s.x, G[2] - s.z) });
      }
    }
    if (key !== meetKey) {
      meetKey = key; meetAll = [];
      const at = W.R.places?.ships?.[id], pp = people(); if (!at || !at.at) return null;
      const nose = at.nose === '-x' ? -1 : 1, D = (K && K.standing) || null, e = W.R.places?.entrances?.[id];
      const keep = (p) => {
        if (D) p.applyMatrix4(D);
        const s = walls.snap(p.x, 0.4, p.z, 0.5);
        if (!s || s.y > 0.3 || (pp && pp.noGo(s.x, s.z))) return;
        // (facing the way people come into the hangar)
        meetAll.push({ pos: s, heading: e ? Math.atan2(e[0] - s.x, e[2] - s.z) : 0 });
      };
      if (id === 'miner') {
        // (parked nose out along +x, its port side is toward -z)
        for (const port of MEET.port) for (const fwd of MEET.nose) keep(new THREE.Vector3(at.at[0] + nose * fwd, 0, at.at[2] - nose * port));
      } else {
        // (each way in, in the ship's own order: its middle where it senses people, and out from the ship's middle)
        const S = boarding.ships.find((q) => q.id === id), ways = S ? S.ways : [];
        for (const Dw of ways) {
          const dx = Dw.sense.x - at.at[0], dz = Dw.sense.z - at.at[2], L = Math.hypot(dx, dz) || 1, ox = dx / L, oz = dz / L;
          for (const out of MEET.out) for (const side of MEET.side) keep(new THREE.Vector3(Dw.sense.x + ox * out - oz * side, 0, Dw.sense.z + oz * out + ox * side));
        }
      }
    }
    return meetAll.length ? meetAll[skip % meetAll.length] : null;
  }
  const meet = (id) => { const pp = people(); if (pp && pp.captain.meet) pp.captain.meet(id, meetSpot); };
  // (a run nobody walks to the ship for: a run of the crew member's own, whose captain stays in the station)
  const walksTo = (m) => !!m && !m.own;

  // ── the line on the floor: to the run's ship with a contract signed (its first way in once its cabin is in, its
  // hangar till then), to where the share waits (the mission's payAt job) with a share waiting ──
  function lead(where) {
    const P = body(); if (!P || !guide) return;
    const m = contractOf(crew());
    // (the ship at the dock: across the bridge, to just inside its crew door; from Cargo no line leads there (only the
    // lift goes up): the cargo game's own last words say the way)
    if (where === 'own' ? !!(runOfShip(ownLead) || {}).desk : where === 'ship' && m && MISSIONS[m.id].desk) {
      const sp = dock && dock.spots ? dock.spots() : null;
      if (sp && !inCargo()) { guide.to(new THREE.Vector3(...sp.inside), { near: 1.2, label: 'mission', colour: LINE.ship }, P.pos); lineTo = 'dock'; }
      return;
    }
    if (where === 'ship' || where === 'own') {
      // ('own': to a ship that is theirs, no contract signed: `ownLead`)
      const id = where === 'own' ? ownLead : shipOf(m), sp = boarding.spots(id), e = W.R.places?.entrances?.[id];
      const at = sp && sp.ways && sp.ways[0] ? new THREE.Vector3(...sp.ways[0]) : e ? walls.snap(e[0] + 3, e[1] + 0.4, e[2], 4) : null;
      if (at) { guide.to(at, { near: 1.6, label: 'mission', colour: LINE.ship }, P.pos); lineTo = where === 'own' ? (sp ? 'ownLift' : 'ownHangar') : sp ? 'lift' : 'hangar'; }
    } else {
      const job = (m && MISSIONS[m.id].payAt) || 'smelter', s = jobs.spots.find((x) => x.job.id === job);
      // (the shipping computer is down the lift, in Cargo: a line only from there)
      if (job === 'cargo' && !inCargo()) { lineTo = null; return; }
      // (an exploring run's: the survey table aboard the Explorer, where it stands)
      const T = job === 'survey' ? boarding.core(shipOf(m), 'survey') : null;
      if (T) { guide.to(T.pos, { near: 1.0, label: 'mission', colour: LINE.payout }, P.pos); lineTo = job; }
      else if (s) { guide.to(s.pos, { near: 1.6, label: 'mission', colour: LINE.payout }, P.pos); lineTo = job; }
    }
  }

  // ── THE SHIP'S SALE, as its captain's card has it (src/own.js): what it costs this crew member now; the buying (the
  // credits spent, the ship kept with them, saved at once, the wallet told); take: what "Take your Miner out" does ──
  const bridgeUp = () => { const c = crew(); return !!(c && bridgeStands(c)); };
  let lastBuy = null;
  function saleFor(ship, take = null, onBought = null) {
    return {
      now: () => saleOf(crew(), ship, { bridge: bridgeUp() }),
      buy: () => {
        const c = crew(), r = c ? buy(c, ship, { bridge: bridgeUp() }) : { ok: false };
        if (r.ok) { save(c); if (jobs.wallet) jobs.wallet(); lastBuy = { ship, price: r.price, credits: r.credits }; if (onBought) onBought(); }
        return !!r.ok;
      },
      take,
    };
  }
  // (the crew member led to a ship that is theirs, no contract signed: the line to its way in, a word at the top)
  let ownLead = null;
  function leadOwn(ship) {
    ownLead = ship; lead('own');
    toastUp(runOfShip(ship) && runOfShip(ship).desk ? `The ${nameOfShip(ship)} is at the dock, across the bridge. Take it out from its pilot's seat.` : `The ${nameOfShip(ship)} is in its hangar. Take it out from its pilot's seat.`, `Your ${nameOfShip(ship)}`);
  }
  // (?tune=arrive or ?tune=leave in the address: this run's tuning of the core then, for trying each)
  const tuneRand = () => { const want = new URLSearchParams(location.search).get('tune'); return want === 'arrive' ? () => 0 : want === 'leave' ? () => 0.999 : Math.random; };

  // ── the contract ──
  // (mode: the captain's offer, 'contract'; their ship's sale alone, 'sale': a captain with no run to offer yet, the
  // Hauler's before the old station is found; the owner's own card, 'own'. Left out: the captain's offer, or the sale
  // alone while their run is not offered. atDesk: brought up at the run's own desk, where no captain stands: the shipping
  // computer's "Your Hauler": src/contract.js)
  function offer(captain, { mode = null, atDesk = false } = {}) {
    const M = missionOf(captain.id), c = crew();
    if (!M || !c || card || trip) return false;
    if (!mode) mode = missions.open(captain.id, c) ? 'contract' : 'sale';
    if (mode === 'contract' && contractOf(c)) return false;
    card = 'loading';
    const desk = !!M.desk;
    const p = people(); if (p && !atDesk) p.captain.hold(captain.id, 90);
    import('./contract.js').then(({ openContract }) => {
      if (card !== 'loading') return;
      const was = input ? input.enabled : true; if (input) input.enabled = false;
      const done = () => { card = null; if (input) input.enabled = was && playing; };
      // (a supply run after the first: the same contract, as a plain hauling run)
      const Mc = desk && M.aboutAgain && supplyRuns(c) > 0 ? { ...M, about: M.aboutAgain, name: 'Hauling run' } : M;
      // (the supply run's cargo run begun with the contract, the one call that starts it: src/supplyrun.js; the
      // Loadmaster's own at the computer, or Cargo's crew's, already worked out and loading. own: a run of the crew
      // member's own, begun at the computer itself, its Loadmaster's questions half as many again: src/jobs/cargolink.js)
      // (what comes next: on the captain's contract the captain says it, as the other three do, and nothing else is put
      // over their words; on a run of their own, begun at the computer where nobody speaks, a word at the top)
      const begunAtDesk = (m, roles, own) => {
        const S = supply(); if (S && S.contract) { const r = S.contract(roles.includes('cargo'), { own }); if (r) m.run = r.n; }
        save(c);
        if (own) toastUp(roles.includes('cargo') ? 'Your run is on. The supplies are yours to work out: start at this computer.' : 'Your run is on. Cargo\'s crew loads the Hauler: up the lift, across the bridge and aboard.');
      };
      const K = CAPTAINS[captain.id] || {};
      card = openContract(document.body, { mission: desk ? { ...Mc, saleAbout: 'The Hauler waits at the dock, across the bridge. Bought, it is yours to fly round the station whenever you like. Hauling runs of your own start once the old station is found.' } : Mc,
        captain: captain.name || nameOf(captain.id), mode,
        // THE SHIP'S SALE: bought, its captain says so; "Take your Miner out": the line to it, and its seat offers it; at
        // the Hauler's own desk: this card turns to the owner's, where its own run is begun (its load is worked out there)
        sale: saleFor(M.ship,
          () => { if (atDesk) return 'own'; done(); const pp = people(); if (pp) pp.captain.release(captain.id, 30); leadOwn(M.ship); return null; },
          () => { const pp = people(); if (pp && !atDesk) pp.captain.say(captain.id, `The ${shipName(M)} is yours. Take it out whenever you like.`); }),
        own: atDesk ? {
          get run() { return stationFound(c) && !contractOf(c); },
          get why() { const on = contractOf(c); return !stationFound(c) ? 'Hauling runs of your own start once the old station is found. Until then the Hauler is yours to fly round the station.' : on && on.state === 'payout' ? 'Your pay from the last run is still waiting: a run of your own can start once you have collected it.' : 'You have a contract on. A run of your own can start once it is done and paid.'; },
          fly: false, note: 'Just flying, for no pay: from the Hauler\'s pilot\'s seat, any time.',
          onRun: (roles) => { done(); const m = signOwn(c, M.id, roles, Date.now(), tuneRand()); if (m) begunAtDesk(m, roles, true); },
          onFly: () => {},
        } : null,
        onSign: (roles) => {
          done();
          const m = sign(c, M.id, roles, Date.now(), tuneRand()); if (!m) return;
          // (a run whose load is worked out at a desk, the supply run: its cargo run begins with the contract)
          if (desk) begunAtDesk(m, roles, false); else save(c);
          if (M.ship === 'miner') { crane.awayHeld = true; if (crane.mode === 'away') crane.arrive(); }      // (found parked and ready)
          // (he says so, turned to the crew member while he says it, and then walks to his ship; the Hauler's captain,
          // with the Loadmaster's work theirs: where that is done; and no line to the ship until its load is worked out)
          const pp = people();
          if (pp) { pp.captain.say(captain.id, (desk && roles.includes(M.desk) && K.signedLoad) || K.signed); pp.captain.hold(captain.id, 3); }
          meet(captain.id); meeting = captain.id;
          if (!loadWait(m)) lead('ship');
        },
        onLater: () => {
          done(); if (atDesk) return;
          if (mode === 'contract') missions.declined(captain.id);
          // (their ship just bought from the sale's card: they have said so already)
          const pp = people(), bought = mode === 'sale' && owns(c, M.ship);
          if (pp) { if (!bought) pp.captain.say(captain.id, (mode === 'sale' && K.sale && K.sale.no) || K.no); pp.captain.release(captain.id, 30); }
        } });
    }).catch((e) => { card = null; fail(e); });
    return true;
  }
  // ── THE OWNER'S CARD, at the pilot's seat of a ship that is theirs (src/contract.js `own`): a run of their own, begun
  // and flown at once from where they stand, or just flying. The Hauler's own run is begun at the shipping computer
  // (its load is worked out there): here it is the flying alone, and the card says where the run starts ──
  function ownCard(ship) {
    const M = runOfShip(ship), c = crew();
    if (!M || !c || !owns(c, ship) || card || trip || loading) return false;
    card = 'loading';
    import('./contract.js').then(({ openContract }) => {
      if (card !== 'loading') return;
      const was = input ? input.enabled : true; if (input) input.enabled = false;
      const done = () => { card = null; if (input) input.enabled = was && playing; };
      const on = contractOf(c), desk = !!M.desk, run = !on && !desk;
      card = openContract(document.body, { mission: M, captain: `Your ${nameOfShip(ship)}`, mode: 'own',
        sale: { now: () => saleOf(c, ship, { bridge: bridgeUp() }) },
        own: { run, fly: true,
          why: run ? '' : desk ? (stationFound(c) ? 'The Hauler is yours to fly round the station. A supply run of your own starts at the shipping computer in Cargo, where its load is worked out.' : 'The Hauler is yours to fly round the station. Hauling runs of your own start once the old station is found.')
            : on && on.state === 'payout' ? `The ${nameOfShip(ship)} is yours to fly round the station. Your pay from the last run is still waiting: a run of your own can start once you have collected it.`
              : `The ${nameOfShip(ship)} is yours to fly round the station. You have a contract on: a run of your own can start once it is done and paid.`,
          note: 'Just flying: out, round the station and back. Nothing is asked and nothing is paid.',
          // (the paint of its hull, picked here: the card's Paint button, src/shippaint.js)
          paint: W.shipPaint ? W.shipPaint.card(ship) : null,
          onRun: (roles) => {
            done();
            const m = signOwn(c, M.id, roles, Date.now(), tuneRand()); if (!m) return;
            save(c);
            if (M.ship === 'miner') crane.awayHeld = true;
            if (!start()) { tearUp(c); save(c); }
          },
          onFly: () => { done(); startFree(ship); } },
        onLater: () => { done(); } });
    }).catch((e) => { card = null; fail(e); });
    return true;
  }
  missions.on((captain, yes) => { if (yes && missions.ready(captain.id)) offer(captain); });
  // THE CAPTAINS WITH NO RUN TO OFFER YET (src/missions.js state 'wait' | 'sale'): is their ship for sale to this crew
  // member meanwhile (the Hauler: their bridge out to it built, and not theirs already)? Then that is what they offer
  missions.sells((id, c) => { const M = missionOf(id), S = M && c ? saleOf(c, M.ship, { bridge: !!bridgeStands(c) }) : null; return !!(S && S.open && !S.owned); });
  // ── A RUN WITH A DESK OF ITS OWN (the supply run and the shipping computer: src/missions.js `desk`): where its load is
  // worked out and its share waits. The contract itself is its captain's, up on the main deck (it was offered at this
  // desk until the Hauler had a captain: the desk's Start is the cargo job's own again). deskOpen(at): is that run
  // offered now, to this crew member (the old station found, no contract of theirs on)? deskHint(at): the job's prompt
  // line there for now: who has the contract and where, the share waiting, or what the run waits for ──
  const deskOf = (at) => Object.values(MISSIONS).find((q) => q.desk === at) || null;
  // THAT RUN'S CAPTAIN, LOOKED FOR. The station has only its nearest few people about at once, and nobody comes back
  // where the player is looking or right beside them (src/people.js PRESENCE): a captain the game has just told the
  // player to go and find "by the docking port" was as often as not out of the way when they got there, and stayed so
  // for as long as they stood and waited. So whenever this crew member is told where the supply run is to be had (as
  // they come aboard, on the shipping computer's line, on the pay slip's last card) the people are told too, as when a
  // captain's line is picked on a jobs board (people.captain.seek: that captain is kept about however many are
  // nearer, and is the one who speaks up when walked up to); done with as their offer begins. (Asked for before the
  // station's people are aboard, it is done once they are: update, below. false: nobody is looked for any more.)
  let wantSeek = null;
  const seekCaptain = (id) => { wantSeek = id; };
  function deskOpen(at) { const M = deskOf(at), c = crew(); return !!(M && c && !contractOf(c) && missions.open(M.captain, c)); }
  // (a contract of that desk's signed and not flown yet, with the desk's own job among its jobs: the Loadmaster's)
  function deskSigned(at) { const M = deskOf(at), c = crew(), m = c && contractOf(c); return !!(M && m && m.id === M.id && m.state === 'signed' && m.roles.includes(at)); }
  function deskHint(at) {
    const M = deskOf(at), c = crew(), m = c && contractOf(c); if (!M || !c) return null;
    if (m && m.id === M.id && m.state === 'payout') return hint(at);
    if (m && m.id === M.id && m.state === 'signed') {
      const S = supply(), r = S && S.contractRun ? S.contractRun(m.run) : null;
      if (r && (r.worked || r.done)) return r.done ? 'The Hauler is loaded: up the lift, across the bridge and aboard' : m.roles.includes('cargo') ? 'Load the pallets with the forklift, or leave them to Cargo\'s crew' : 'Cargo\'s crew is loading the Hauler: up the lift, across the bridge and aboard';
      return null;
    }
    if (deskOpen(at)) { const pp = people(); if (!pp || pp.captain.seeking !== M.captain) seekCaptain(M.captain); }
    if (deskOpen(at)) return supplyRuns(c) > 0 ? `${nameOf(M.captain)} has a hauling run: up the lift, by the docking port` : `${nameOf(M.captain)} has the supply contract: up the lift, by the docking port`;
    return null;
  }
  // (a word at the top for a moment: the supply run's own, where to go next; a ship that is theirs)
  const toastEl = document.createElement('div'); toastEl.className = 'pnj-prompt pmt-wide'; toastEl.hidden = true; toastEl.style.cssText = 'top: max(70px, env(safe-area-inset-top)); bottom: auto; pointer-events: none;';
  toastEl.innerHTML = '<div class="pnj-pw"><b>Supply run</b><small></small></div>'; document.body.appendChild(toastEl);
  function toastUp(w, title = 'Supply run') { toastEl.querySelector('b').textContent = title; toastEl.querySelector('small').textContent = w; toastEl.hidden = false; toastT = 7; }
  // THE SHIPPING COMPUTER'S SECOND BUTTON (src/jobs/index.js `more`): a Hauler that is this crew member's own, "Your
  // Hauler": it brings up the owner's own card, where a supply run of their own is begun (its load is worked out here),
  // once the old station is found. Not while a supply run is on there: the computer is that run's. (The Hauler's sale
  // was here too until it had a captain: it is on the captain's card now, as every ship's is; one bought here before is
  // theirs as ever.) -> { words, small, on() } or null
  function deskMore(at) {
    const M = deskOf(at), c = crew(); if (!M || !c || card || trip) return null;
    const S = saleOf(c, M.ship, { bridge: bridgeUp() }), m = contractOf(c);
    if (!S || !S.owned || (m && m.id === M.id)) return null;
    return { words: `Your ${S.name}`, small: 'Take it out', on: () => offer({ id: M.captain, name: `Your ${S.name}` }, { mode: 'own', atDesk: true }) };
  }
  // THE SHIPPING COMPUTER'S CARD while a supply run's share waits there (the cargo job's panel, src/jobs/index.js
  // `links`): the payout card first, as at the smelter's controls; paid, a last card saying so. null: nothing waits, the
  // computer is the cargo game's own (src/jobs/cargolink.js)
  function deskLive(at) {
    const c = crew(), m = c && contractOf(c);
    if (!m || m.state !== 'payout' || MISSIONS[m.id].payAt !== at) return null;
    let paid = null; const own = !!m.own;
    return { card: () => (paid ? null : payoutCard(at)), head: (o) => payoutHead(o),
      right: (q) => { if (q && q.order && q.order.payout != null) { paid = { pay: q.order.payout, first: !!(m.payout && m.payout.first) }; if (!own) seekCaptain(deskOf(at).captain); } },
      over: () => (paid ? { html: `<header class="pnj-cardtop is-slip"><span class="pnj-icon is-bar" aria-hidden="true"></span><b>Pay slip</b><small>Paid</small></header><p class="pnj-story pcc-end"><b>${paid.pay.toLocaleString('en-US')} credits paid.</b></p><p class="pnj-story pcc-end2">${paid.first ? 'The old station has its fuel cells, its food and its spare parts. Its lights are on again.' : 'Another load delivered to the old station.'} ${own ? 'Another run of your own whenever you like: Your Hauler, at this computer.' : `${nameOf(deskOf(at).captain)} has another run whenever you want one: up the lift, by the docking port.`}</p>`, buttons: [{ label: 'Done' }] } : null),
      close() {} };
  }

  // ── the trip: from the seat, by the crew member's own sitting down ──
  let meeting = null;
  function start() {
    const c = crew(), m = c && contractOf(c);
    if (!m || m.state !== 'signed' || trip || loading || card || !body()) return false;
    // (never from anywhere else: nobody is put in the seat without being seen to get there)
    if (boarding.where(body().pos) !== MISSIONS[m.id].ship + '/cockpit') return false;
    // (a supply run: its supplies worked out; whatever is not in the containers yet goes in as the Hauler is boarded)
    if (loadWait(m)) return false;
    if (MISSIONS[m.id].desk) { const S = supply(); if (S && S.depart) S.depart(m.run); }
    letGo();      // (the crew still aboard from the run before: gone as the next run begins)
    loading = true; prompt.hidden = true;
    if (input) input.enabled = false;
    import('./trip.js').then(({ startTrip }) => {
      loading = false;
      if (!playing) { if (input) input.enabled = false; return; }
      // (tune: signed as the ship's engineer, when its core's tuning comes out at the rocks; walk: on their feet there
      // their walking is their own again, and the trip's once more when they sit down)
      // (keeper: who keeps the run's ship's hull where it is flown, the Miner's crane or the ship's own: keeperOf)
      // (seed: the planet a run to a planet goes to, kept with the contract; lib: the crew kit, for whoever sleeps in its pods)
      // (input: the keys and the thumb stick, for walking on a planet's ground, src/rescue.js: the trip walks them there)
      // (plan: an exploring run's, from its seed and what is so for this crew member now: src/exploreplan.js)
      const plan = MISSIONS[m.id].legs ? planOf(seedOf(c), { antenna: antennaRepaired(c), found: foundOf(c) }) : null;
      // (dock: the Hauler's bridge, let go and taken again; pallets: what a supply run carries; again: the old station
      // saved before)
      const Mn = MISSIONS[m.id], S = supply(), cr = Mn.desk && S && S.contractRun ? S.contractRun(m.run) : null;
      trip = startTrip({ W, walls, boarding, crane, keeper: keeperOf(MISSIONS[m.id].ship), jobs, guide, outside, visit: visitOf(MISSIONS[m.id].ship), people, crew: c, save, body, put, captainName: m.own ? `The ${shipName(Mn)}` : nameOf(m.captain), seed: seedOf(c), lib, input, plan,
        dock, pallets: cr ? cr.pallets : 0, again: supplyRuns(c) > 0,
        walk: (on) => { if (input) input.enabled = !!on && playing; } }, { mission: MISSIONS[m.id], roles: m.roles, tune: tuneWhen(c),
        // (a run of the crew member's own, in a ship they bought: no captain aboard, the hired crew, more cards: src/trip.js)
        own: !!m.own,
        onEnd: (r) => {
          const mine = MISSIONS[m.id].ship === 'miner', v = visits.get(MISSIONS[m.id].ship);
          if (v) { for (const w of v.views) if (w.O.moved) v.reset(w.cfg.id); v.dispose(); visits.delete(MISSIONS[m.id].ship); }
          lastRun = { ...r, aboard: undefined }; if (mine) crane.awayHeld = false;
          // (home: the crew stay aboard where they are until the crew member has left the ship)
          if (r.aboard) kept = { A: r.aboard, captain: r.captain, ship: MISSIONS[m.id].ship };
          if (input) input.enabled = playing;
          // (home: the share waits; the captain, who waited by the ship, goes on with his day from where he is)
          if (r.payout) { lead('payout'); const pp = people(); if (pp && pp.captain.meet && walksTo(m)) pp.captain.meet(m.captain, null); meeting = null; }
          else if (mine) crane.awayHeld = true;
        } });
      api.trip = trip;
    }).catch((e) => { loading = false; if (input) input.enabled = playing; fail(e); });
    return true;
  }

  // ── JUST FLYING (src/trip.js `free`; the game's maker: "You have to buy the ship if you want to fly it at your
  // leisure", and "it's not math so you don't get money"): a ship that is theirs taken out of its hangar, or off its
  // dock, round the station and back, from its pilot's seat. Nothing is signed, asked or paid, and a contract of theirs
  // with another captain is left as it is ──
  function startFree(ship) {
    const c = crew(), m = c && contractOf(c);
    if (!c || !owns(c, ship) || trip || loading || card || !body()) return false;
    if (boarding.where(body().pos) !== ship + '/cockpit') return false;
    // (a run signed for this very ship: its seat is that run's)
    if (m && m.state === 'signed' && MISSIONS[m.id].ship === ship) return false;
    loading = true; prompt.hidden = true;
    if (input) input.enabled = false;
    letGo();      // (the crew still aboard from the run before: gone as the next flight begins)
    const held = !!crane.awayHeld; if (ship === 'miner') crane.awayHeld = true;
    import('./trip.js').then(({ startTrip }) => {
      loading = false;
      if (!playing) { if (input) input.enabled = false; if (ship === 'miner') crane.awayHeld = held; return; }
      trip = startTrip({ W, walls, boarding, crane, keeper: keeperOf(ship), jobs, guide, outside, visit: visitOf(ship), people, crew: c, save, body, put, captainName: `The ${nameOfShip(ship)}`, lib, input, dock,
        walk: (on) => { if (input) input.enabled = !!on && playing; } }, { mission: freeFlight(ship), roles: ['pilot'], tune: null, free: true,
        onEnd: (r) => {
          const v = visits.get(ship);
          if (v) { for (const w of v.views) if (w.O.moved) v.reset(w.cfg.id); v.dispose(); visits.delete(ship); }
          if (r.aboard) r.aboard.dispose();
          lastRun = { ...r, aboard: undefined, free: true }; if (ship === 'miner') crane.awayHeld = held;
          if (input) input.enabled = playing;
        } });
      api.trip = trip;
    }).catch((e) => { loading = false; if (ship === 'miner') crane.awayHeld = held; if (input) input.enabled = playing; fail(e); });
    return true;
  }

  // ── where the share of the run waits (the smelter's controls for a mining run, the triage desk for a rescue): the
  // first card at that job, asked at the crew member's own level there ──
  function payoutCard(at = 'smelter') {
    const c = crew(), m = c && contractOf(c);
    if (!m || m.state !== 'payout' || (MISSIONS[m.id].payAt || 'smelter') !== at || !PAY_AT[at]) return null;
    const J = PAY_AT[at];
    E.register(J);
    const v = E.level(c, J), L = J.place.levels[v ? v.i : 0] || J.place.levels[0];
    const order = payoutOrder(m, L.grade || 0);
    return { job: at, order, lv: null, level: { id: 'payout', grade: L.grade || 0 }, worth: { pay: m.payout.pay, secs: null }, misses: 0, picked: new Set(), done: false, t0: Date.now(),
      // (a miss never loses the pay: the right answer brings all of it, whenever it comes)
      answer(q, i) {
        const coin = q.order.coins[i]; if (!coin || q.done) return null;
        if (!coin.good) { q.misses++; q.picked.add(i); return { right: false, first: q.misses === 1, pay: 0, worth: m.payout.pay, credits: E.credits(c), moved: 0, why: coin.why }; }
        q.done = true;
        const r = collect(c); save(c);
        if (guide && guide.active === 'mission') guide.clear();
        return { right: true, first: q.misses === 0, pay: r.pay, worth: r.pay, credits: r.credits, moved: 0, up: false, down: false, level: null, why: q.order.rightWhy };
      } };
  }
  // (its top, at a job whose own cards are not pay slips (the triage desk's are patient charts): a pay slip's, as at the
  // smelter's controls)
  // (a run of the crew member's own: "Your own run", and the pay is no share: src/missions.js)
  const payoutHead = (o) => (o && o.payout != null && o.facts && (o.facts.from === 'Your share' || o.facts.from === 'Your own run') ? `<header class="pnj-cardtop is-slip"><span class="pnj-icon is-bar" aria-hidden="true"></span><b>Pay slip</b><small>${o.facts.from}</small></header>` : null);
  const hint = (at = 'smelter') => { const m = contractOf(crew()); return m && m.state === 'payout' && (MISSIONS[m.id].payAt || 'smelter') === at ? `Your ${m.own ? 'pay' : 'share'} is waiting: ${m.payout.pay.toLocaleString('en-US')} credits` : null; };

  // ── THE EXPLORER'S SURVEY TABLE, where an exploring run's share waits (payAt 'survey'): standing at it aboard, the
  // table's prompt (as a job spot's: Start, E); pressed, the job panel with the survey table's own card and, as its first
  // card, the payout card (the smelter's way: payoutCard). Paid, the panel goes by itself; Done puts it away unpaid, the
  // share still waiting ──
  const table = { prompt: document.createElement('div'), panel: null };
  table.prompt.className = 'pnj-prompt'; table.prompt.hidden = true;
  table.prompt.innerHTML = '<div class="pnj-pw"><b>Survey table</b><small></small></div><button type="button" class="pnj-go">Start<kbd>E</kbd></button>';
  document.body.appendChild(table.prompt);
  table.prompt.querySelector('.pnj-go').addEventListener('click', () => tableOpen());
  addEventListener('keydown', (e) => { if (!table.prompt.hidden && !table.panel && playing && (e.key === 'e' || e.key === 'E' || e.key === 'Enter')) { e.preventDefault(); tableOpen(); } });
  const TABLE_NEAR = 1.2;
  function tableAt(P) {
    const c = crew(), m = c && contractOf(c);
    if (!P || !m || m.state !== 'payout' || MISSIONS[m.id].payAt !== 'survey' || trip || card) return null;
    const T = boarding.core(MISSIONS[m.id].ship, 'survey');
    return T && boarding.where(P.pos) === T.room && Math.abs(P.pos.y - T.pos.y) < 1 && Math.hypot(P.pos.x - T.pos.x, P.pos.z - T.pos.z) < TABLE_NEAR ? T : null;
  }
  function tableOpen() {
    const c = crew(); if (table.panel || !c || !tableAt(body())) return false;
    table.prompt.hidden = true; if (input) input.enabled = false; tw.fresh = true;
    let paid = false;
    table.panel = openPanel(document.body, { job: survey, crew: c, onSave: () => save(c), onCredits: () => {},
      live: { card: () => (paid ? null : payoutCard('survey')), head: (o) => payoutHead(o), right: (q) => { if (q && q.order && q.order.payout != null) { paid = true; setTimeout(() => { if (table.panel) table.panel.close(); }, 1200); } } },
      onClose: () => { table.panel = null; if (input) input.enabled = playing; } });
    return true;
  }
  // (the camera while the table's card is up: their own eyes over the table, the table clear of the card: left of it on a
  // wide screen, above it on a phone; as at the ship's core, src/tune.js)
  const tw = { at: new THREE.Vector3(), look: new THREE.Vector3(), cam: new THREE.Vector3(), camLook: new THREE.Vector3(), fresh: true, d: new THREE.Vector3() };
  function tableAim(camera, dt) {
    const T = boarding.core(shipOf(contractOf(crew())), 'survey'), P = body(); if (!T || !P) return;
    const dx = T.look.x - P.pos.x, dz = T.look.z - P.pos.z, L = Math.hypot(dx, dz) || 1, fx = dx / L, fz = dz / L, tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640;
    tw.at.set(P.pos.x - fx * 0.15, P.pos.y + 1.5, P.pos.z - fz * 0.15);
    if (tall) tw.look.set(T.look.x, T.look.y - 0.5, T.look.z); else tw.look.set(T.look.x - fz * 0.5, T.look.y + 0.1, T.look.z + fx * 0.5);
    if (tw.fresh) { tw.cam.copy(camera.position); tw.camLook.copy(camera.position).add(camera.getWorldDirection(tw.d)); tw.fresh = false; }
    const k = 1 - Math.exp(-5 * dt); tw.cam.lerp(tw.at, k); tw.camLook.lerp(tw.look, k);
    camera.position.copy(tw.cam); camera.lookAt(tw.camLook);
  }
  function tableShut() { if (table.panel) { const p = table.panel; table.panel = null; p.close(true); } table.prompt.hidden = true; }
  function tableStep(P) {
    if (table.panel) return;
    const T = playing && !jobs.panel ? tableAt(P) : null;
    if (T) table.prompt.querySelector('small').textContent = hint('survey') || 'Your share is waiting';
    table.prompt.hidden = !T;
  }

  let synced = null, tail = null, tailT = 0, stoodAt = boarding.stands ?? 0, deskT = 0;
  // THE CREW ABOARD AFTER A RUN (src/aboard.js, handed over by the trip as it ends): drawn where the ship stands, going
  // about as they do, until the crew member is off the ship; then gone, and the captain back in the station
  let kept = null;
  const letGo = () => { if (!kept) return; kept.A.dispose(); const pp = people(); if (pp && pp.aboard && kept.captain) pp.aboard(kept.captain, false); kept = null; };
  const api = {
    trip: null, offer: (id) => offer({ id, name: nameOf(id) }), start, payoutCard, payoutHead, hint, meetSpot, keeperOf, deskOpen, deskHint, deskLive, deskSigned, deskMore,
    // (a ship that is theirs: the owner's card at its seat, just flying; its sale as the cards have it; the last bought)
    ownCard, startFree, saleOf: (ship) => saleOf(crew(), ship, { bridge: bridgeUp() }), get lastBuy() { return lastBuy; }, get card() { return card && card !== 'loading' ? card : null; }, get lastRun() { return lastRun; },
    update(dt, P, isPlaying = true) {
      playing = isPlaying && !!P; lastDt = dt;
      const c = crew(); let m = c ? contractOf(c) : null;
      // (a run of their own in a hangar's ship is never left signed: given up, or the page loaded again in the middle
      // of it, it is gone, and the ship's seat offers again)
      if (m && m.own && m.state === 'signed' && !MISSIONS[m.id].desk && !trip && !loading) { tearUp(c); save(c); m = null; }
      // (a crew member come aboard with a contract already signed: the Miner waits for them; a line once, to where they are wanted)
      if (c && synced !== c.id + ':' + (m ? m.state : '')) {
        const first = synced == null || !String(synced).startsWith(c.id + ':'); synced = c.id + ':' + (m ? m.state : '');
        crane.awayHeld = !!(m && m.state === 'signed' && minerRun(m));
        // (never to a ship whose load is not worked out yet: the supply run's Loadmaster's work comes first, in Cargo)
        if (first && playing && m && !trip && !(m.state === 'signed' && loadWait(m))) lead(m.state === 'signed' ? 'ship' : 'payout');
        // (the old station found and no supply run made yet: who has its contract and where, said once as they come
        // aboard; and whenever that run is on offer to them as they come aboard its captain is kept about to be found:
        // seekCaptain, above; another crew member's captain is looked for no more)
        if (first && playing && !m && !trip && stationFound(c) && supplyRuns(c) === 0) toastUp(`${nameOf(MISSIONS.supply.captain)} has a contract: supplies for the old station. Find the captain by the docking port, in the terminal.`);
        if (first && playing && !trip) seekCaptain(!m && missions.open(MISSIONS.supply.captain, c) ? MISSIONS.supply.captain : false);
      }
      if (wantSeek != null && people() && people().captain.seek) { const cap = people().captain; if (wantSeek) cap.seek(wantSeek); else if (cap.seeking === MISSIONS.supply.captain) cap.seek(null); wantSeek = null; }
      // (a contract signed, whenever it was signed: its captain is on his way to the ship, or waiting by it, once the
      // station's people are aboard; any other state: he is not)
      const want = m && m.state === 'signed' && walksTo(m) ? m.captain : null;
      if (want !== meeting && people()) { if (meeting && people().captain.meet) people().captain.meet(meeting, null); meeting = want; if (want) meet(want); }
      // (the line reached the hangar: on to the lift's foot, once the ship's cabin is in; the ship stood somewhere else
      // (set back in its proper place while the crew member was away): the line to its lift where it is now)
      if (lineTo === 'hangar' && guide.active === 'mission' && m && boarding.spots(shipOf(m))) lead('ship');
      if (lineTo === 'ownHangar' && guide.active === 'mission' && ownLead && boarding.spots(ownLead)) lead('own');
      // (a supply run signed and its supplies worked out: the line to the Hauler from wherever they are on the main deck,
      // looked for now and then until they are aboard; a share waiting at the shipping computer: its line once in Cargo)
      if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.hidden = true; }
      if (playing && m && MISSIONS[m.id].desk && !trip && !card && guide && guide.active !== 'mission' && (deskT -= dt) <= 0) {
        deskT = 3;
        const aboard = (boarding.where(P.pos) || '').startsWith(MISSIONS[m.id].ship + '/');
        if (m.state === 'signed' && !aboard && !loadWait(m)) lead('ship'); else if (m.state === 'payout' && inCargo()) lead('payout');
      }
      if (stoodAt !== (boarding.stands ?? 0)) { stoodAt = boarding.stands ?? 0; if (lineTo === 'lift' && guide.active === 'mission' && !trip && playing) lead('ship'); }
      if (trip) {
        if (playing) trip.update(dt);
        // (done: the captain's last words stay up a few seconds more)
        if (trip.done) { tail = trip; tailT = 8; trip = null; api.trip = null; }
        prompt.hidden = true;
        // (the trip has them, in the seat or at the core with its card up; on their feet out at the rocks, tuning the
        // core, their walking is their own)
        return !!trip && trip.holds;
      }
      if (tail) { tail.update(dt); tailT -= dt; if (tailT <= 0) tail = null; }
      if (kept) { const w = P ? boarding.where(P.pos) : null; if (!w || !w.startsWith(kept.ship + '/')) letGo(); else kept.A.update(dt, { player: P }); }
      // the pilot's seat: in the cockpit with a contract signed
      const here = playing && !card && !loading && !jobs.panel ? boarding.where(P.pos) : null;
      const at = !!here && !!m && m.state === 'signed' && here === MISSIONS[m.id].ship + '/cockpit' && !(minerRun(m) && crane.mode === 'out');
      // (the cockpit of a ship that is theirs, no run signed for it: the seat offers it; never the Miner while its crane
      // is being worked by hand)
      const mineId = !at && here && here.endsWith('/cockpit') ? here.slice(0, -'/cockpit'.length) : null;
      ownAt = mineId && owns(c, mineId) && !(m && m.state === 'signed' && MISSIONS[m.id].ship === mineId) && !(mineId === 'miner' && ['out', 'live', 'handover'].includes(crane.mode)) ? mineId : null;
      if (at) promptFor(m); else if (ownAt) promptOwn(ownAt);
      prompt.hidden = !at && !ownAt;
      tableStep(P);
      return loading || !!table.panel;
    },
    aim(camera, dt) { if (trip) trip.aim(camera, dt); else if (table.panel) tableAim(camera, dt); },
    late() {
      if (trip) trip.late(); else if (kept) { const S = boarding.ships.find((q) => q.id === kept.ship); if (S && S.M) kept.A.late(S.M, W.scene); }
      for (const v of visits.values()) v.update(lastDt, W.camera);
    },
    // (the crew aboard, to be walked round: src/aboard.js; and the crew member's own clip, sitting on a seat aboard)
    get others() { const A = trip ? trip.crew : kept ? kept.A : null; return A ? A.others : null; },
    get clip() { return trip ? trip.clip : null; },
    // (in the seat on a run, or at the ship's core with its card up: seen through their own eyes, their body put away)
    get seated() { return !!(trip && trip.seated) || !!table.panel; },
    stop() { letGo(); if (trip) { trip.abort(); trip = null; api.trip = null; } { const c = crew(), m = c && contractOf(c); if (m && m.own && m.state === 'signed' && !MISSIONS[m.id].desk) { tearUp(c); save(c); } } if (card && card.close) { card.close(); card = null; } prompt.hidden = true; toastEl.hidden = true; tableShut(); playing = false; },
    get table() { return { prompt: !table.prompt.hidden, panel: table.panel ? table.panel.state() : null }; },
    state: () => ({ contract: contractOf(crew()), trip: trip ? trip.state() : null, tune: trip && trip.tune ? trip.tune.state() : null, card: card && card.state ? card.state() : null, prompt: !prompt.hidden, promptWords: prompt.hidden ? null : prompt.textContent, ownAt, loading, lastRun, awayHeld: !!crane.awayHeld, line: guide ? guide.active : null, lineTo,
      meeting: meeting && people() && people().captain.meeting ? people().captain.meeting(meeting) : null }),
  };
  return api;
}
