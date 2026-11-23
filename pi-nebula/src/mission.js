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
import { missions, missionOf, contractOf, sign, collect, payoutOrder, tuneWhen, seedOf, MISSIONS } from './missions.js';
import { CAPTAINS } from './lines.js';
import * as E from './jobs/engine.js';
import { JOB as smelter } from './jobs/smelter.js';
import { JOB as medical } from './jobs/medical.js';
import { makeHull } from './shiphull.js';
import { shipOf as shipFacts, flightOf } from './fleet.js';
import { makeVisit } from './visit.js';

// (the line on the floor: to the run's ship, and to where the share waits)
const LINE = { ship: '#ffd560', payout: '#ff8a3a' };
// THE STATION JOBS WHERE A RUN'S SHARE WAITS (src/missions.js `payAt`): its payout card is the first card there (the
// panel's `card` hook), asked at the crew member's own level of that job
const PAY_AT = { smelter, medical };
// (where each run goes, as the seat's prompt says it)
const PLACE_WORDS = { field: 'the rocks', planet: 'the planet' };
const shipName = (M) => (shipFacts(M.ship) || {}).name || 'ship';
// (a run of the Miner's: its crane holds it on its pad for the run, and takes its canisters off it after)
const minerRun = (m) => !!m && MISSIONS[m.id].ship === 'miner';

export function makeMission({ W, walls, input = null, boarding, crane, jobs, guide, outside = null, visit = null, people = () => null, crew = () => null, save = () => {}, body = () => null, put = () => {}, lib = null }) {
  let card = null, trip = null, loading = false, playing = false, lastRun = null, toast = null, toastT = 0, lineTo = null;
  const nameOf = (id) => { const p = people(); const P = p && p.list.find((x) => x.id === id); return (P && P.name) || 'The captain'; };
  const fail = (e) => { console.error(e); if (window.oops) window.oops(e); };

  // ── the seat's prompt (the job prompt's own look) and a word at the top when a share is waiting ──
  const prompt = document.createElement('div'); prompt.className = 'pnj-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pnj-pw"><b>Pilot\'s seat</b><small>Sit at the controls and fly the Miner out</small></div><button type="button" class="pnj-go">Sit down<kbd>E</kbd></button>';
  // (signed for the drill and not the pilot's seat: the captain's own pilot flies; the crew member rides out)
  let prompted = null;
  // (signed only as the ship's engineer: no seat is theirs, the two chairs are the crew's (src/trip.js); they tell the
  // crew they are aboard, and the run begins with them on their feet)
  const promptFor = (m) => {
    const M = MISSIONS[m.id], ship = shipName(M), to = PLACE_WORDS[M.place] || 'the rocks';
    const pilot = m.roles.includes('pilot'), seat = pilot || m.roles.includes('drill'), key = m.id + ':' + (pilot ? 'pilot' : seat ? 'seat' : 'ready'); if (key === prompted) return; prompted = key;
    prompt.querySelector('b').textContent = pilot ? 'Pilot\'s seat' : `The ${ship}'s cockpit`;
    prompt.querySelector('small').textContent = pilot ? `Sit at the controls and fly the ${ship} out` : seat ? `Sit down and ride out to ${to} with the crew` : `Tell the crew you are aboard: they fly out to ${to}`;
    prompt.querySelector('.pnj-go').innerHTML = (seat ? 'Sit down' : 'Ready') + '<kbd>E</kbd>';
  };
  document.body.appendChild(prompt);
  prompt.querySelector('.pnj-go').addEventListener('click', () => start());
  addEventListener('keydown', (e) => { if (!prompt.hidden && playing && !trip && (e.key === 'e' || e.key === 'E' || e.key === 'Enter')) { e.preventDefault(); start(); } });

  // ── WHO KEEPS EACH SHIP'S HULL WHERE IT IS FLOWN AND STANDS (src/flying.js `hull`): the Miner's crane (its canisters
  // ride on it), or the ship's own shared hull (src/shiphull.js), made once and kept for the game, as the Flight Lab
  // has it. A run asks its keeper to let the ship go (depart), to have it home (arrive) and to put it back (back): the
  // crane's own, for the Miner; nothing more to do for a ship with no crane ──
  const hulls = new Map();
  function keeperOf(id) {
    if (id === 'miner') return crane;
    if (!hulls.has(id)) {
      const s = boarding.ships.find((q) => q.id === id), H = s ? makeHull({ W, id, kit: s.flight, boarding, eyes: () => { const pp = people(); return pp && pp.eyes ? pp.eyes() : []; } }) : null;
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
  const MEET = { nose: [1.4, 2.6, 3.8], port: [4.7, 5.4, -4.7, -5.4], out: [2.6, 3.4], side: [1.4, -1.4, 2.4, -2.4, 0] };      // (m from the ship's middle, in its own frame; the Miner's lift's foot is 2.6 m to port; beyond a way's foot, and to its side)
  let meetKey = null, meetAll = [];
  function meetSpot(skip = 0) {
    // (in the air: nowhere to wait by it. Down again, wherever, there is: the pilot may still be in the seat)
    const id = shipOf(contractOf(crew())), K = keeperOf(id);
    const fl = trip && trip.fly; if (fl ? !fl.S.landed : K && K.aloft) return null;
    const key = id + ':' + String(boarding.stands ?? 0);
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

  // ── the line on the floor: to the run's ship with a contract signed (its first way in once its cabin is in, its
  // hangar till then), to where the share waits (the mission's payAt job) with a share waiting ──
  function lead(where) {
    const P = body(); if (!P || !guide) return;
    const m = contractOf(crew());
    if (where === 'ship') {
      const id = shipOf(m), sp = boarding.spots(id), e = W.R.places?.entrances?.[id];
      const at = sp && sp.ways && sp.ways[0] ? new THREE.Vector3(...sp.ways[0]) : e ? walls.snap(e[0] + 3, e[1] + 0.4, e[2], 4) : null;
      if (at) { guide.to(at, { near: 1.6, label: 'mission', colour: LINE.ship }, P.pos); lineTo = sp ? 'lift' : 'hangar'; }
    } else {
      const job = (m && MISSIONS[m.id].payAt) || 'smelter', s = jobs.spots.find((x) => x.job.id === job);
      if (s) { guide.to(s.pos, { near: 1.6, label: 'mission', colour: LINE.payout }, P.pos); lineTo = job; }
    }
  }

  // ── the contract ──
  function offer(captain) {
    const M = missionOf(captain.id), c = crew();
    if (!M || !c || card || trip || contractOf(c)) return false;
    card = 'loading';
    const p = people(); if (p) p.captain.hold(captain.id, 90);
    import('./contract.js').then(({ openContract }) => {
      if (card !== 'loading') return;
      const was = input ? input.enabled : true; if (input) input.enabled = false;
      const done = () => { card = null; if (input) input.enabled = was && playing; };
      card = openContract(document.body, { mission: M, captain: captain.name || nameOf(captain.id),
        onSign: (roles) => {
          done();
          // (?tune=arrive or ?tune=leave in the address: this run's tuning of the core then, for trying each)
          const want = new URLSearchParams(location.search).get('tune'), m = sign(c, M.id, roles, Date.now(), want === 'arrive' ? () => 0 : want === 'leave' ? () => 0.999 : Math.random); if (!m) return;
          save(c);
          if (M.ship === 'miner') { crane.awayHeld = true; if (crane.mode === 'away') crane.arrive(); }      // (found parked and ready)
          // (he says so, turned to the crew member while he says it, and then walks to his ship)
          const K = CAPTAINS[captain.id] || {}, pp = people();
          if (pp) { pp.captain.say(captain.id, K.signed); pp.captain.hold(captain.id, 3); }
          meet(captain.id); meeting = captain.id;
          lead('ship');
        },
        onLater: () => { done(); missions.declined(captain.id); const pp = people(); if (pp) { pp.captain.say(captain.id, (CAPTAINS[captain.id] || {}).no); pp.captain.release(captain.id, 30); } } });
    }).catch((e) => { card = null; fail(e); });
    return true;
  }
  missions.on((captain, yes) => { if (yes && missions.ready(captain.id)) offer(captain); });

  // ── the trip: from the seat, by the crew member's own sitting down ──
  let meeting = null;
  function start() {
    const c = crew(), m = c && contractOf(c);
    if (!m || m.state !== 'signed' || trip || loading || card || !body()) return false;
    // (never from anywhere else: nobody is put in the seat without being seen to get there)
    if (boarding.where(body().pos) !== MISSIONS[m.id].ship + '/cockpit') return false;
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
      trip = startTrip({ W, walls, boarding, crane, keeper: keeperOf(MISSIONS[m.id].ship), jobs, guide, outside, visit: visitOf(MISSIONS[m.id].ship), people, crew: c, save, body, put, captainName: nameOf(m.captain), seed: seedOf(c), lib, input,
        walk: (on) => { if (input) input.enabled = !!on && playing; } }, { mission: MISSIONS[m.id], roles: m.roles, tune: tuneWhen(c),
        onEnd: (r) => {
          const mine = MISSIONS[m.id].ship === 'miner', v = visits.get(MISSIONS[m.id].ship);
          if (v) { for (const w of v.views) if (w.O.moved) v.reset(w.cfg.id); v.dispose(); visits.delete(MISSIONS[m.id].ship); }
          lastRun = { ...r, aboard: undefined }; if (mine) crane.awayHeld = false;
          // (home: the crew stay aboard where they are until the crew member has left the ship)
          if (r.aboard) kept = { A: r.aboard, captain: r.captain, ship: MISSIONS[m.id].ship };
          if (input) input.enabled = playing;
          // (home: the share waits; the captain, who waited by the ship, goes on with his day from where he is)
          if (r.payout) { lead('payout'); const pp = people(); if (pp && pp.captain.meet) pp.captain.meet(m.captain, null); meeting = null; }
          else if (mine) crane.awayHeld = true;
        } });
      api.trip = trip;
    }).catch((e) => { loading = false; if (input) input.enabled = playing; fail(e); });
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
  const payoutHead = (o) => (o && o.payout != null && o.facts && o.facts.from === 'Your share' ? '<header class="pnj-cardtop is-slip"><span class="pnj-icon is-bar" aria-hidden="true"></span><b>Pay slip</b><small>Your share</small></header>' : null);
  const hint = (at = 'smelter') => { const m = contractOf(crew()); return m && m.state === 'payout' && (MISSIONS[m.id].payAt || 'smelter') === at ? `Your share is waiting: ${m.payout.pay.toLocaleString('en-US')} credits` : null; };

  let synced = null, tail = null, tailT = 0, stoodAt = boarding.stands ?? 0;
  // THE CREW ABOARD AFTER A RUN (src/aboard.js, handed over by the trip as it ends): drawn where the ship stands, going
  // about as they do, until the crew member is off the ship; then gone, and the captain back in the station
  let kept = null;
  const letGo = () => { if (!kept) return; kept.A.dispose(); const pp = people(); if (pp && pp.aboard) pp.aboard(kept.captain, false); kept = null; };
  const api = {
    trip: null, offer: (id) => offer({ id, name: nameOf(id) }), start, payoutCard, payoutHead, hint, meetSpot, keeperOf, get card() { return card && card !== 'loading' ? card : null; }, get lastRun() { return lastRun; },
    update(dt, P, isPlaying = true) {
      playing = isPlaying && !!P; lastDt = dt;
      const c = crew(), m = c ? contractOf(c) : null;
      // (a crew member come aboard with a contract already signed: the Miner waits for them; a line once, to where they are wanted)
      if (c && synced !== c.id + ':' + (m ? m.state : '')) {
        const first = synced == null || !String(synced).startsWith(c.id + ':'); synced = c.id + ':' + (m ? m.state : '');
        crane.awayHeld = !!(m && m.state === 'signed' && minerRun(m));
        if (first && playing && m && !trip) lead(m.state === 'signed' ? 'ship' : 'payout');
      }
      // (a contract signed, whenever it was signed: its captain is on his way to the ship, or waiting by it, once the
      // station's people are aboard; any other state: he is not)
      const want = m && m.state === 'signed' ? m.captain : null;
      if (want !== meeting && people()) { if (meeting && people().captain.meet) people().captain.meet(meeting, null); meeting = want; if (want) meet(want); }
      // (the line reached the hangar: on to the lift's foot, once the ship's cabin is in; the ship stood somewhere else
      // (set back in its proper place while the crew member was away): the line to its lift where it is now)
      if (lineTo === 'hangar' && guide.active === 'mission' && m && boarding.spots(shipOf(m))) lead('ship');
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
      const at = playing && m && m.state === 'signed' && !card && !loading && !jobs.panel && boarding.where(P.pos) === MISSIONS[m.id].ship + '/cockpit' && !(minerRun(m) && crane.mode === 'out');
      if (at) promptFor(m);
      prompt.hidden = !at;
      return loading;
    },
    aim(camera, dt) { if (trip) trip.aim(camera, dt); },
    late() {
      if (trip) trip.late(); else if (kept) { const S = boarding.ships.find((q) => q.id === kept.ship); if (S && S.M) kept.A.late(S.M, W.scene); }
      for (const v of visits.values()) v.update(lastDt, W.camera);
    },
    // (the crew aboard, to be walked round: src/aboard.js; and the crew member's own clip, sitting on a seat aboard)
    get others() { const A = trip ? trip.crew : kept ? kept.A : null; return A ? A.others : null; },
    get clip() { return trip ? trip.clip : null; },
    // (in the seat on a run, or at the ship's core with its card up: seen through their own eyes, their body put away)
    get seated() { return !!(trip && trip.seated); },
    stop() { letGo(); if (trip) { trip.abort(); trip = null; api.trip = null; } if (card && card.close) { card.close(); card = null; } prompt.hidden = true; playing = false; },
    state: () => ({ contract: contractOf(crew()), trip: trip ? trip.state() : null, tune: trip && trip.tune ? trip.tune.state() : null, card: card && card.state ? card.state() : null, prompt: !prompt.hidden, loading, lastRun, awayHeld: !!crane.awayHeld, line: guide ? guide.active : null, lineTo,
      meeting: meeting && people() && people().captain.meeting ? people().captain.meeting(meeting) : null }),
  };
  return api;
}
