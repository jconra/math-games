// THE FORKLIFT LAP IN CARGO, IN THE GAME (2026-11-22, the game's maker: "It would be cool to have the game with the
// forklift too where if you go down there an employee might say they can do a lap in 30 seconds or whatever and you can
// get the forklift to a position and it will count down and time you. Maybe there can be some waypoints at the corners
// that you have to hit to make the time official."). The rules, as plain numbers: kit/forkliftlap.js; where its start
// box and its four waypoints are painted: kit/places-plan.js LAP (kit/store.js paints them, so the Kit Lab's Cargo has
// them too). Here:
//   THE LOADER SAYS SO   the one of Cargo's people who drives the forklift most (LAP.who) tells a player who comes near
//                        how fast a lap they do, and where to start: two bubbles, words only (src/lines.js LAP_TALK),
//                        after any hello of theirs. Not while a supply run is being loaded, and not from the
//                        forklift's seat. For a while after, Cargo's people leave the forklift parked for the player.
//   THE START            on the forklift (src/cargodrive.js), stopped on the start box behind its line: 3, 2, 1, GO in
//                        the middle of the view, the forklift held still meanwhile; the clock starts at GO.
//   THE LAP              the clock along the top with the four waypoints (lit as each is hit, struck out if passed by)
//                        and the time to beat; on the floor the next waypoint's square lit and pulsing with a column of
//                        light over it (the guide line's own: src/guide.js), the ones hit green, the ones missed red.
//   THE FINISH           back over the line: the card, the time official or not (and which waypoints were missed), set
//                        against the loader's, and what the loader says of it (on the card, and in a bubble if they are
//                        in sight).
// IT PAYS NOTHING (it is not math; the game's maker, of free flight: "it's not math so you don't get money"), and it is
// never in the supply run's way: while a worked-out run waits to be loaded (src/supplyrun.js hold()), the box starts
// nothing.
// THE BEST TIMES (2026-11-23, the game's maker: "Each crew member's own best official lap is kept and shown on the clock
// and on the card ('Your best: 56.8 s')", and "a small board by the forklift's bay with the best lap on it and whose it
// is"): src/lapbest.js has the rules. A crew member's best is kept with them (saved at once) and shown under the
// loader's time on the clock and on every card; the board on the wall behind the forklift's bay (kit/store.js lapBoard,
// kit/lapboard.js) is written afresh whenever Cargo comes into view, a lap is kept or another crew member plays.
// THE PEOPLE WATCH (the game's maker: "anyone in the area should get out of the way and watch... near the finish line"):
// src/cargowatch.js. Stopped on the start box, everyone is called to the finish line; the countdown waits (the forklift
// held still, "Wait: the lane is being cleared.") while anyone is in the lane in its way, RULES.wait seconds at most;
// one of them cheers at the finish.
//
//   const lap = makeCargoLap({ W, forklift, cargo, run, people, crew, save, crews })
//                                crew(): the crew member playing; save(crew): keeps them; crews(): every crew member
//                                saved on this device (the board's best)
//   lap.update(dt, P, playing)   each frame, after the forklift's own (src/cargodrive.js update)
//   lap.hold()                   Cargo's people leave the forklift parked (the loader has just told the player of it)
//   lap.stop()                   off at once (the crew screen)
//   lap.state()                  for the rigs
import * as THREE from 'three';
import { LAP, STORE } from '../kit/places-plan.js';
import { makeLap, GATES, LINE, BOX } from '../kit/forkliftlap.js';
import { makeLapBoard } from '../kit/lapboard.js';
import { makeCargoWatch } from './cargowatch.js';
import { bestOf, keepLap, boardOf, seconds } from './lapbest.js';
import { LAP_TALK } from './lines.js';
import { BEACON_VERT, BEACON_FRAG, beaconGeometry } from './guide.js';

const CSS = new URL('./cargolap.css', import.meta.url).href;
function ensureCss() {
  if (document.querySelector('link[data-pcl]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.pcl = '1'; document.head.appendChild(l);
}
// THE LOADER'S WORD: within `near` (m) of them for `wait` seconds, not again for `again` seconds; a bubble's time is its
// reading time and `gap` more; `hold`: for this long after, Cargo's people leave the forklift parked (s)
// THE CARD stays `card` seconds (or till the next countdown); GO stays `go` seconds
// THE MARKS over the paint: how high over the floor (m), the lit line's width (m); the column of light [across, tall]
export const SHOW = { near: 3.3, wait: 0.5, again: 80, gap: 0.5, hold: 150, card: 10, go: 0.9, y: 0.02, band: 0.16, beacon: [0.9, 2.8] };
const COL = { next: [1.0, 0.62, 0.2], hit: [0.25, 0.95, 0.5], miss: [1.0, 0.3, 0.22], pale: [0.75, 0.86, 1.0] };
const READ = (w) => Math.min(8, 1.6 + w.length * 0.055);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (o[k] ?? m));
// a time as it is said and shown: its tenth left off when it is a whole number of seconds
const secs = (t) => (Math.abs(t - Math.round(t)) < 0.05 ? String(Math.round(t)) : t.toFixed(1));

// A MARK LIT ON THE FLOOR over its paint: its lines aglow, a little light spreading in from them; added to what is
// under it, hidden by whatever stands on it
const MARK_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const MARK_FRAG = `
  uniform vec3 uColour; uniform float uOpacity, uTime, uPulse, uBand; uniform vec2 uSize; varying vec2 vUv;
  void main() {
    vec2 d = min(vUv, 1.0 - vUv) * uSize; float edge = min(d.x, d.y);
    float band = 1.0 - smoothstep(uBand, uBand + 0.1, edge), spread = 0.13 * (1.0 - smoothstep(0.0, 1.3, edge));
    float a = (band * 0.75 + spread) * mix(1.0, 0.62 + 0.38 * sin(uTime * 5.0), uPulse) * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColour, a);
  }`;

export function makeCargoLap({ W, forklift, cargo, run = null, people = () => null, crew = () => null, save = () => {}, crews = () => [] }) {
  ensureCss();
  const L = makeLap(), crowd = makeCargoWatch({ people, forklift });
  // a lap may be started: no supply run waiting to be loaded
  const can = () => !(run && run.hold && run.hold());

  // ── on the screen ────────────────────────────────────────────────────────────────────────────────────────────
  const el = document.createElement('div');
  el.className = 'pcl'; el.hidden = true;
  el.innerHTML = `
    <div class="pcl-clock" hidden><span class="pcl-time"><b>0.0</b><small>s</small></span>
      <span class="pcl-side"><span class="pcl-pips" role="img">${GATES.map((g) => `<i>${g.n}</i>`).join('')}</span><span class="pcl-beat"></span><span class="pcl-mine" hidden></span></span></div>
    <div class="pcl-count" hidden></div>
    <div class="pcl-card" role="status" hidden><span class="pcl-tag"></span><span class="pcl-big"><b></b><small>s</small></span><span class="pcl-vs"></span><span class="pcl-miss"></span><span class="pcl-best" hidden></span><span class="pcl-say"></span><span class="pcl-who"></span></div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s), clockEl = $('.pcl-clock'), countEl = $('.pcl-count'), cardEl = $('.pcl-card'), pips = [...el.querySelectorAll('.pcl-pips i')];
  let goT = 0, cardT = 0, shownTime = '', shownPips = '';
  const pop = (e) => { e.classList.remove('is-pop'); void e.offsetWidth; e.classList.add('is-pop'); };
  const showing = () => { el.hidden = clockEl.hidden && countEl.hidden && cardEl.hidden; };
  const loader = () => { const pp = people(); return (pp && pp.list.find((q) => q.id === LAP.who)) || null; };
  const loaderName = () => { const O = loader(); return (O && O.name) || 'Cargo\'s loader'; };
  function count(n) { countEl.textContent = n ? String(n) : 'GO!'; countEl.classList.toggle('is-go', !n); countEl.hidden = false; pop(countEl); if (!n) goT = SHOW.go; cardEl.hidden = true; showing(); }
  function clock() {
    const s = L.s, t = s.clock.toFixed(1);
    if (t !== shownTime) { shownTime = t; $('.pcl-time b').textContent = t; }
    const k = s.hit.map((h, i) => (h ? 'h' : s.missed[i] ? 'm' : i === s.next ? 'n' : '-')).join('');
    if (k !== shownPips) {
      shownPips = k;
      pips.forEach((p, i) => { p.className = k[i] === 'h' ? 'is-hit' : k[i] === 'm' ? 'is-miss' : k[i] === 'n' ? 'is-next' : ''; });
      $('.pcl-pips').setAttribute('aria-label', `Corners hit: ${s.hit.filter(Boolean).length} of ${GATES.length}`);
    }
  }
  // THE CARD, and what the loader says of the lap
  const list = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  // THE BEST TIMES: the crew member's own (kept with them, only an official lap), and the board's
  const mineWords = (b, isNew = false) => (b == null ? '' : `Your best: ${seconds(b)} s` + (isNew ? ' (new!)' : ''));
  let board = null, boardFor = null;
  function writeBoard() {
    if (!board) return;
    const c = crew(), all = (crews() || []).filter((x) => !c || x.id !== c.id);
    board.set(boardOf(c ? [...all, c] : all, { name: loaderName(), time: LAP.time }));
    S.board = board.shown;
  }
  function card(r) {
    const who = loaderName(), kind = !r.official ? 'missed' : r.beat ? 'beat' : 'slower';
    // (kept before the card is written: an official lap that is their best so far is their best from now on)
    const c = crew(), kept = keepLap(c, r);
    if (c && r.official) { save(c); writeBoard(); }
    $('.pcl-best').textContent = mineWords(kept.best, kept.isNew); $('.pcl-best').hidden = kept.best == null; $('.pcl-best').classList.toggle('is-new', kept.isNew);
    S.best = kept;
    const words = fill(pick(LAP_TALK[kind]), { time: secs(r.time), secs: secs(r.loader) });
    cardEl.className = 'pcl-card ' + (!r.official ? 'is-not' : r.beat ? 'is-beat is-official' : 'is-official');
    $('.pcl-tag').textContent = r.official ? 'Official lap' : 'Not official';
    $('.pcl-big b').textContent = r.time.toFixed(1);
    $('.pcl-vs').textContent = !r.official ? `${who}'s lap: ${secs(r.loader)} s.` : r.beat ? `You beat ${who}'s ${secs(r.loader)} s by ${secs(r.by)} s!` : r.by === 0 ? `The same as ${who}'s ${secs(r.loader)} s. So close!` : `${who}'s lap: ${secs(r.loader)} s. You were ${secs(-r.by)} s behind.`;
    $('.pcl-miss').textContent = r.official ? '' : `You missed ${r.missed.length > 1 ? 'corners' : 'corner'} ${list(r.missed.map(String))}.`;
    $('.pcl-miss').hidden = r.official;
    $('.pcl-say').textContent = '“' + words + '”'; $('.pcl-who').textContent = who;
    cardEl.hidden = false; pop(cardEl); cardT = SHOW.card; clockEl.hidden = true; showing();
    S.card = { tag: $('.pcl-tag').textContent, time: r.time, vs: $('.pcl-vs').textContent, miss: $('.pcl-miss').textContent, best: $('.pcl-best').textContent, say: words };
    // (and in a bubble over them, where they are in sight; and a cheer from one of the others watching at the line)
    const pp = people(), O = loader();
    if (pp && O && !O.hidden && !O.away && O.shown) pp.say(O, words, { kind: 'talk' });
    S.cheer = crowd.cheer(kind);
  }

  // ── on the floor: the marks lit over their paint, and the column of light over the one to drive to ─────────────
  const zone = W.room('store');
  let marks = null, beacon = null, markT = 0, afterT = 0;
  function makeMarks() {
    const g = new THREE.Group(); g.name = 'forklift lap';
    const mark = ([x0, x1, z0, z1], band = SHOW.band) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
        vertexShader: MARK_VERT, fragmentShader: MARK_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        uniforms: { uColour: { value: new THREE.Color(...COL.next) }, uOpacity: { value: 0 }, uTime: { value: 0 }, uPulse: { value: 0 }, uBand: { value: band }, uSize: { value: new THREE.Vector2(x1 - x0, z1 - z0) } } }));
      m.position.set((x0 + x1) / 2, STORE.floor + SHOW.y, (z0 + z1) / 2); m.renderOrder = 3; m.visible = false; g.add(m);
      return { m, u: m.material.uniforms, to: 0 };
    };
    const lx = LINE.at[0];
    marks = { g, box: mark(LAP.box), line: mark([lx - 0.14, lx + 0.14, LAP.lane[0], LAP.lane[1]], 9), gates: GATES.map((G) => mark(G.box)) };
    beacon = new THREE.Mesh(beaconGeometry(SHOW.beacon), new THREE.ShaderMaterial({ vertexShader: BEACON_VERT, fragmentShader: BEACON_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColour: { value: new THREE.Color(...COL.next) } } }));
    beacon.renderOrder = 4; beacon.name = 'forklift lap: the light over the next waypoint'; beacon.visible = false; g.add(beacon);
    zone.group.add(g);
  }
  const set = (M, col, to, pulse = 0) => { M.to = to; if (to > 0) { M.u.uColour.value.setRGB(...col); M.u.uPulse.value = pulse; } };
  function light(dt, driving) {
    if (!marks) { if (!driving || !zone) return; makeMarks(); }
    markT += dt;
    const s = L.s, ok = driving && can(), M = marks;
    let at = null;
    if (s.phase === 'run') {
      afterT = 6;
      set(M.box, COL.next, 0); set(M.line, COL.next, s.next >= GATES.length ? 0.9 : 0, 1);
      M.gates.forEach((G, i) => (s.hit[i] ? set(G, COL.hit, 0.75) : s.missed[i] ? set(G, COL.miss, 0.7) : i === s.next ? set(G, COL.next, 1, 1) : set(G, COL.pale, 0.16)));
      at = s.next < GATES.length ? GATES[s.next].at : [LINE.at[0], (LAP.box[2] + LAP.box[3]) / 2];
    } else if (s.phase === 'count') {
      set(M.box, COL.next, 0.95); set(M.line, COL.next, 0.9); M.gates.forEach((G) => set(G, COL.pale, 0.16)); afterT = 0;
    } else {
      // (a lap just done: its waypoints stay lit as they ended a few seconds, the line green for an official lap, red
      // for one that is not; then, on the forklift with a lap to be had, the start box glows softly)
      afterT = Math.max(0, afterT - dt);
      if (afterT > 0 && s.result && driving) { M.gates.forEach((G, i) => (s.hit[i] ? set(G, COL.hit, 0.75) : set(G, COL.miss, 0.7))); set(M.line, s.result.official ? COL.hit : COL.miss, 0.9); set(M.box, COL.hit, 0); }
      else { M.gates.forEach((G) => set(G, COL.next, 0)); set(M.line, COL.next, 0); set(M.box, COL.next, ok ? 0.5 : 0, 1); }
    }
    for (const X of [M.box, M.line, ...M.gates]) {
      const u = X.u, o = u.uOpacity.value + Math.sign(X.to - u.uOpacity.value) * Math.min(Math.abs(X.to - u.uOpacity.value), dt * 3.5);
      u.uOpacity.value = o; u.uTime.value = markT; X.m.visible = o > 0.004;
    }
    const bu = beacon.material.uniforms, bo = bu.uOpacity.value + Math.sign((at ? 1 : 0) - bu.uOpacity.value) * Math.min(1, dt * 3.5);
    bu.uOpacity.value = Math.max(0, Math.min(1, bo)); bu.uTime.value = markT; beacon.visible = bu.uOpacity.value > 0.004;
    if (at) beacon.position.set(at[0], STORE.floor + 0.02, at[1]);
  }

  // ── the loader's word to a player who comes near ───────────────────────────────────────────────────────────────
  const S = { offers: 0, laps: 0, official: 0, beat: 0, off: 0, last: null, card: null, best: null, board: null, cheer: null, waits: 0, waited: 0 };
  let now = 0, said = -1e9, nearT = 0, seq = null, held = -1;
  function offer(dt, P, playing) {
    const pp = people(), O = loader();
    if (!pp || !O || !P || !playing || cargo.on || !can() || O.hidden || O.away) { seq = null; nearT = 0; return; }
    const d = Math.hypot(P.pos.x - O.pos.x, P.pos.z - O.pos.z), level = Math.abs(P.pos.y - O.pos.y) < 1.2;
    if (seq) {
      // (the second bubble once the first has been read; left off if the player has walked away)
      seq.t -= dt;
      if (seq.t > 0) return;
      if (seq.i >= seq.lines.length || d > SHOW.near * 2.5 || !level) { seq = null; return; }
      const w = seq.lines[seq.i++]; pp.say(O, w, { kind: 'talk', secs: READ(w) }); seq.t = READ(w) + SHOW.gap;
      return;
    }
    // (on their feet, in sight; not on the forklift themselves, not in the middle of a talk)
    const free = O.shown && !O.convo && !(O.act && (O.act.kind === 'drive' || O.act.kind === 'talk'));
    nearT = free && level && d < SHOW.near ? nearT + dt : 0;
    if (nearT < SHOW.wait || now - said < SHOW.again) return;
    // (after their hello, if they are saying one)
    if (pp.bubbles.live.has(O)) return;
    said = now; held = now + SHOW.hold; S.offers++;
    seq = { lines: pick(LAP_TALK.offer).map((w) => fill(w, { secs: secs(LAP.time) })), i: 0, t: 0 };
  }

  // ── each frame ───────────────────────────────────────────────────────────────────────────────────────────────
  function update(dt, P, playing) {
    now += dt;
    const D = playing && forklift.hand.on ? forklift.hand.drive() : null, driving = !!D && cargo.on;
    if (driving) {
      // (is anyone in the lane in its way: asked only while it matters, stopped on the box or waiting there)
      const s = D.s, ask = L.s.phase === 'wait' || (L.s.phase === 'idle' && L.s.on && L.s.on.on), clear = !ask || crowd.clear().clear;
      const ev = L.step(s, s.v, dt, { can: can(), carrying: s.carry != null, clear });
      // (stopped on the start box: everyone to the finish line to watch; the countdown waits while one is in the lane)
      if (ev.called) crowd.call();
      if (ev.wait) S.waits++;
      if (ev.count) { if (ev.count === 3) S.waited = +L.s.waited.toFixed(2); count(ev.count); }
      if (ev.go) { count(0); clockEl.hidden = false; shownTime = shownPips = ''; $('.pcl-beat').textContent = `${loaderName()}: ${secs(LAP.time)} s`; const b = bestOf(crew()); $('.pcl-mine').textContent = mineWords(b); $('.pcl-mine').hidden = b == null; showing(); }
      if (ev.finish) { S.laps++; if (ev.finish.official) S.official++; if (ev.finish.beat) S.beat++; S.last = ev.finish; card(ev.finish); }
      if (ev.off) { S.off++; clockEl.hidden = true; countEl.hidden = true; showing(); }
      if (L.s.phase === 'run') clock();
    } else if (L.cancel()) { S.off++; clockEl.hidden = true; countEl.hidden = true; showing(); }
    if (goT > 0 && (goT -= dt) <= 0 && L.s.phase !== 'count') { countEl.hidden = true; showing(); }
    if (cardT > 0 && (cardT -= dt) <= 0) { cardEl.hidden = true; showing(); }
    offer(dt, P, playing);
    light(dt, driving);
    crowd.update(dt, { driving, s: D ? D.s : null, phase: L.s.phase });
    // THE BOARD: made the first time Cargo is in view, written afresh as it comes into view and when another crew member plays
    if (zone && zone.group.visible) {
      const c = crew(), key = c ? c.id : '';
      if (!board) { board = makeLapBoard(); zone.group.add(board.mesh); boardFor = null; }
      if (boardFor !== key) { boardFor = key; writeBoard(); }
    } else boardFor = null;
  }
  // THE FORKLIFT'S OWN WORDS along the bottom, while the lap has something to say (src/cargodrive.js hint)
  const WHY = { face: 'Turn it to face the line.', back: 'Back up: its forks behind the line.', forward: 'A little further, up to the line.', side: 'Into the middle of the box.' };
  function hint() {
    const s = L.s;
    if (s.phase === 'wait') return 'Wait: the lane is being cleared.';
    if (s.phase === 'count') return 'Get ready…';
    if (s.phase === 'run') return s.next < GATES.length ? `Round the racks: corner ${GATES[s.next].n} is next.` : 'Back over the start line!';
    // (a lap just done, its card still up, the forklift rolling on over the line: how to go again)
    if (cardT > 0 && !(s.on && s.on.on)) return 'To go again, back onto the START box.';
    if (s.on && s.on.in) return s.on.on ? 'Stop here for a timed lap.' : WHY[s.on.why];
    return null;
  }
  cargo.hint = hint; cargo.brake = () => L.held;
  function stop() { L.cancel(); crowd.release(); clockEl.hidden = countEl.hidden = cardEl.hidden = true; goT = cardT = 0; seq = null; boardFor = null; showing(); }
  return { update, stop, hold: () => now < held, lap: L, crowd,
    state: () => ({ ...S, crowd: crowd.state(), mine: bestOf(crew()), phase: L.s.phase, n: L.s.n, clock: +L.s.clock.toFixed(2), hit: [...L.s.hit], missed: [...L.s.missed], next: L.s.next, on: L.s.on, result: L.s.result, can: can(), hold: now < held, saying: !!seq,
      shown: { clock: !clockEl.hidden, count: countEl.hidden ? null : countEl.textContent, card: !cardEl.hidden, time: $('.pcl-time b').textContent, beat: $('.pcl-beat').textContent, mine: $('.pcl-mine').hidden ? null : $('.pcl-mine').textContent, pips: shownPips },
      marks: marks ? { box: +marks.box.u.uOpacity.value.toFixed(2), line: +marks.line.u.uOpacity.value.toFixed(2), gates: marks.gates.map((G) => +G.u.uOpacity.value.toFixed(2)), beacon: beacon.visible ? beacon.position.toArray().map((v) => +v.toFixed(2)) : null } : null }) };
}
