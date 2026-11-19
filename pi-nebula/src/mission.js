// A CAPTAIN'S RUN, joined to the game (src/missions.js is the plain part; src/contract.js the contract's card and
// src/trip.js the trip itself, both loaded only when wanted, so the station costs what it did):
//   - a captain's "Interested" brings up their contract (missions.on); signed, it is kept with the crew member, the
//     Miner waits on its pad (crane.awayHeld), a line on the floor leads to it, and the captain asks whether to go now;
//   - the run starts from the captain's "Let's go" (missions.onGo) or from the pilot's seat: in the ship's cockpit a
//     prompt comes up, as at a job (Start, E);
//   - home, the share waits at the smelter's controls: the smelter job's first card there is the payout card
//     (payoutCard: the panel's `card` hook), its prompt says so (hint), and a line on the floor leads to it; the right
//     answer brings the pay, whatever was picked before it.
//
//   const mission = makeMission({ W, walls, input, boarding, crane, jobs, guide, outside, people, crew, save, body, put })
//   mission.update(dt, P, playing) -> true while a trip has the player (seated: no walking, the trip's camera)
//   mission.aim(camera, dt), mission.late()     the trip's camera and its last word on the picture
//   mission.stop()                               the crew screen: a trip given up, a card put away
//   mission.payoutCard(), mission.hint()         the smelter's controls
//   mission.offer(id), mission.start(from), mission.state(), mission.trip   (the rigs)
import * as THREE from 'three';
import { missions, missionOf, contractOf, sign, collect, payoutOrder, MISSIONS } from './missions.js';
import { CAPTAINS } from './lines.js';
import * as E from './jobs/engine.js';
import { JOB as smelter } from './jobs/smelter.js';

const LINE = { miner: '#ffd560', payout: '#ff8a3a' };

export function makeMission({ W, walls, input = null, boarding, crane, jobs, guide, outside = null, people = () => null, crew = () => null, save = () => {}, body = () => null, put = () => {} }) {
  let card = null, trip = null, loading = false, askIn = -1, askWho = null, playing = false, lastRun = null, toast = null, toastT = 0, lineTo = null;
  const nameOf = (id) => { const p = people(); const P = p && p.list.find((x) => x.id === id); return (P && P.name) || 'The captain'; };
  const fail = (e) => { console.error(e); if (window.oops) window.oops(e); };

  // ── the seat's prompt (the job prompt's own look) and a word at the top when a share is waiting ──
  const prompt = document.createElement('div'); prompt.className = 'pnj-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pnj-pw"><b>Pilot\'s seat</b><small>Sit at the controls and fly the Miner out</small></div><button type="button" class="pnj-go">Sit down<kbd>E</kbd></button>';
  // (signed for the drill and not the pilot's seat: the captain's own pilot flies; the crew member rides out)
  const promptFor = (m) => { const pilot = m.roles.includes('pilot'); prompt.querySelector('b').textContent = pilot ? 'Pilot\'s seat' : 'The Miner\'s cockpit'; prompt.querySelector('small').textContent = pilot ? 'Sit at the controls and fly the Miner out' : 'Sit down and ride out to the rocks with the crew'; };
  document.body.appendChild(prompt);
  prompt.querySelector('.pnj-go').addEventListener('click', () => start('seat'));
  addEventListener('keydown', (e) => { if (!prompt.hidden && playing && !trip && (e.key === 'e' || e.key === 'E' || e.key === 'Enter')) { e.preventDefault(); start('seat'); } });

  // ── the line on the floor: to the Miner with a contract signed, to the smelter's controls with a share waiting ──
  function lead(where) {
    const P = body(); if (!P || !guide) return;
    if (where === 'miner') {
      const sp = boarding.spots('miner'), e = W.R.places?.entrances?.miner;
      const at = sp && sp.ways && sp.ways[0] ? new THREE.Vector3(...sp.ways[0]) : e ? walls.snap(e[0] + 3, e[1] + 0.4, e[2], 4) : null;
      if (at) { guide.to(at, { near: 1.6, label: 'mission', colour: LINE.miner }, P.pos); lineTo = sp ? 'lift' : 'hangar'; }
    } else {
      const s = jobs.spots.find((x) => x.job.id === 'smelter');
      if (s) { guide.to(s.pos, { near: 1.6, label: 'mission', colour: LINE.payout }, P.pos); lineTo = 'smelter'; }
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
          const m = sign(c, M.id, roles); if (!m) return;
          save(c); crane.awayHeld = true;
          if (crane.mode === 'away') crane.arrive();      // (found parked and ready)
          const K = CAPTAINS[captain.id] || {}, pp = people();
          if (pp) { pp.captain.say(captain.id, K.signed); pp.captain.hold(captain.id, 8); askIn = 1.6; askWho = captain.id; }
          lead('miner');
        },
        onLater: () => { done(); missions.declined(captain.id); const pp = people(); if (pp) { pp.captain.say(captain.id, (CAPTAINS[captain.id] || {}).no); pp.captain.release(captain.id, 30); } } });
    }).catch((e) => { card = null; fail(e); });
    return true;
  }
  missions.on((captain, yes) => { if (yes && missions.ready(captain.id)) offer(captain); });
  missions.onGo((captain, yes) => { if (yes) start('captain'); });

  // ── the trip ──
  function start(from = 'seat') {
    const c = crew(), m = c && contractOf(c);
    if (!m || m.state !== 'signed' || trip || loading || card || !body()) return false;
    loading = true; prompt.hidden = true;
    if (input) input.enabled = false;
    import('./trip.js').then(({ startTrip }) => {
      loading = false;
      if (!playing) { if (input) input.enabled = false; return; }
      trip = startTrip({ W, walls, boarding, crane, jobs, guide, outside, crew: c, save, body, put, captainName: nameOf(m.captain) }, { mission: MISSIONS[m.id], roles: m.roles, from,
        onEnd: (r) => {
          lastRun = r; crane.awayHeld = false;
          if (input) input.enabled = playing;
          if (r.payout) { lead('payout'); const pp = people(); if (pp && pp.stage && pp.groups && pp.groups.minerShip) { const s = pp.groups.minerShip.find((x) => x && !x.who); if (s) try { pp.stage.put(m.captain, s, 0, 40); } catch (e) { /* he stays where he is */ } } }
          else crane.awayHeld = true;
        } });
      api.trip = trip;
    }).catch((e) => { loading = false; if (input) input.enabled = playing; fail(e); });
    return true;
  }

  // ── the smelter's controls: the share of the run, waiting ──
  function payoutCard() {
    const c = crew(), m = c && contractOf(c);
    if (!m || m.state !== 'payout') return null;
    E.register(smelter);
    const v = E.level(c, smelter), L = smelter.place.levels[v ? v.i : 0] || smelter.place.levels[0];
    const order = payoutOrder(m, L.grade || 0);
    return { job: 'smelter', order, lv: null, level: { id: 'payout', grade: L.grade || 0 }, worth: { pay: m.payout.pay, secs: null }, misses: 0, picked: new Set(), done: false, t0: Date.now(),
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
  const hint = () => { const m = contractOf(crew()); return m && m.state === 'payout' ? `Your share is waiting: ${m.payout.pay.toLocaleString('en-US')} credits` : null; };

  let synced = null, tail = null, tailT = 0;
  const api = {
    trip: null, offer: (id) => offer({ id, name: nameOf(id) }), start, payoutCard, hint, get card() { return card && card !== 'loading' ? card : null; }, get lastRun() { return lastRun; },
    update(dt, P, isPlaying = true) {
      playing = isPlaying && !!P;
      const c = crew(), m = c ? contractOf(c) : null;
      // (a crew member come aboard with a contract already signed: the Miner waits for them; a line once, to where they are wanted)
      if (c && synced !== c.id + ':' + (m ? m.state : '')) {
        const first = synced == null || !String(synced).startsWith(c.id + ':'); synced = c.id + ':' + (m ? m.state : '');
        crane.awayHeld = !!(m && m.state === 'signed');
        if (first && playing && m && !trip) lead(m.state === 'signed' ? 'miner' : 'payout');
      }
      if (askIn >= 0) { askIn -= dt; if (askIn < 0) { const pp = people(); if (pp && playing && !trip) pp.captain.askGo(askWho); } }
      // (the line reached the hangar: on to the lift's foot, once the ship's cabin is in)
      if (lineTo === 'hangar' && guide.active === 'mission' && boarding.spots('miner')) lead('miner');
      if (trip) {
        if (playing) trip.update(dt);
        // (done: the captain's last words stay up a few seconds more)
        if (trip.done) { tail = trip; tailT = 8; trip = null; api.trip = null; }
        prompt.hidden = true;
        return !!trip;
      }
      if (tail) { tail.update(dt); tailT -= dt; if (tailT <= 0) tail = null; }
      // the pilot's seat: in the cockpit with a contract signed
      const at = playing && m && m.state === 'signed' && !card && !loading && !jobs.panel && boarding.where(P.pos) === MISSIONS[m.id].ship + '/cockpit' && crane.mode !== 'out';
      if (at && prompt.hidden) promptFor(m);
      prompt.hidden = !at;
      return loading;
    },
    aim(camera, dt) { if (trip) trip.aim(camera, dt); },
    late() { if (trip) trip.late(); },
    get seated() { return !!(trip && trip.seated); },
    stop() { if (trip) { trip.abort(); trip = null; api.trip = null; } if (card && card.close) { card.close(); card = null; } prompt.hidden = true; playing = false; },
    state: () => ({ contract: contractOf(crew()), trip: trip ? trip.state() : null, card: card && card.state ? card.state() : null, prompt: !prompt.hidden, loading, lastRun, awayHeld: !!crane.awayHeld, line: guide ? guide.active : null }),
  };
  return api;
}
