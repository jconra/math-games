// THE WIND TEST AS SHOWN: the frame calculation (frame.js windTest, run off the page's thread in wind-worker.js) says
// what every gust does; this plays it out on the hilltop and then says what happened.
//
//   * The gusts come in the order the calculation gives them: for each stage (breeze, stiff wind, gust, big gust), the
//     wind from each side where something gave way, or, where nothing gave, the side that strained the tower most.
//   * As each wind rises from its side, every board is tinted by its strain (green easy, yellow at half, red at its
//     limit and past), the nailed joints get coloured spots the same way, and the frame bends by how far each board's
//     ends really move (drawn several times larger, so the eye can see it). Strain grows with the wind speed squared, so
//     the colours climb as the wind rises. A small legend and the stage's name, with where the wind comes from, sit on
//     top of the view.
//   * When something gives: the broken parts flash red, a crack, the boards that come down because of it fall (fall.js:
//     only those, the rest stands), the miller calls out what went, and the rest carries on through the same wind with
//     its new strain. A big collapse can be several breaks in one wind: the first that brings boards down plays in full
//     with the miller's call (a few nails pulling out first, with nothing falling, play quickly), the rest quickly.
//   * While a wind rises toward a break, the colours are scaled so the part about to give reaches red just as it gives
//     (its strain at the peak over the worst part's: where it is about to break), not every board that the break will
//     drag past its limit.
//   * A part that can't even hold up its own weight (a tier post standing on nothing, with no beam under it) gives way
//     before the first breeze rises, in still air: those breaks (calm, from the calculation) play first, and the
//     miller names what was missing.
//   * At the end: the card. The height left standing after the big gust, what happened in plain words, flour for every
//     foot left standing (and the sails, with five more sacks, at 16 ft or more), and the miller's advice from the break
//     that cost the most height. Then: "Keep building" (what stands stays, the boards that came down whole go back on
//     the pile, snapped ones are kindling) or "Start fresh"; with nothing left standing, "Try again".
//
// main.js wires it: makeTestRun(app, hooks) with the view, the fall, the miller's voice, the camera's watching spot,
// the best record and what the buttons do (see `hooks` below). frame(dt) runs every animation frame.
import { STAGES, boardRole } from './frame.js';
import { towerHeight, planeName, planeSegments, planeKey, parseKey, planesOf, faceOfPlane, isPost, MAX_W, floorsAcross } from './tower.js';
import { pointGap, isKnee } from './touch.js';
import { trianglesOf } from './questions.js';
import { wind, FT } from './scene.js';
import { fmt, fmtBase, fmtStat } from './build.js';
import * as sound from './sound.js';

export const TARGET_FT = 16;       // a tower standing this tall after the wind earns the windmill head and its sails
// flour: a sack for every foot left standing, and five more for the sails
export const flourFor = (h) => Math.floor(h + 1e-6) + (h >= TARGET_FT ? 5 : 0);

// how a wind is played (seconds): it rises, holds at its peak, and eases off; a short lull before the next one
const RISE = 1.1, PEAK = 1.7, HOLD = 2.25, EASE = 0.6, LULL = 0.3;
// a break: the red flash before the boards drop, then a moment for them to fall (the first break in a wind in full,
// any that follow it quickly), and a moment to see the rest carry on before the wind eases
const FLASH = [0.6, 0.3], SETTLE = [1.5, 0.55], AFTER = 1.0;
// still air before the first breeze, when something gives under its own weight: a moment to see it, then it goes
const CALM = 0.9;
// the bending is drawn this many times larger than it really is, but never more than this many feet at any end
const BEND_X = 5, BEND_MOST = 1.6;

const $ = (id) => document.getElementById(id);
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lo = (b) => Math.min(b.a.Y, b.b.Y), hi = (b) => Math.max(b.a.Y, b.b.Y);
const isLevelB = (b) => Math.abs(b.a.Y - b.b.Y) < 0.14 * (b.len || 1);
const isUprightB = (b) => isPost(b) || Math.hypot(b.b.X - b.a.X, b.b.Z - b.a.Z) < 0.14 * (b.len || 1);
// a board doing a post's job: straight up, or leaning in toward the tower's middle by up to about 20 degrees (a tapered
// storey's post: its top nearer the middle than its foot, on the same side). A brace that steep, in a narrow wall, runs
// from one side of its wall to the other instead, so it is not one.
function postLike(b) {
  if (isUprightB(b)) return true;
  if (Math.hypot(b.b.X - b.a.X, b.b.Z - b.a.Z) > 0.375 * (b.len || 1)) return false;
  const [f, t] = b.a.Y <= b.b.Y ? [b.a, b.b] : [b.b, b.a];
  return ['X', 'Z'].every((c) => Math.abs(t[c] - f[c]) < 0.01 || ((Math.abs(t[c]) < 0.01 || Math.sign(t[c]) === Math.sign(f[c])) && Math.abs(t[c]) < Math.abs(f[c])));
}
// where a board is at height y (its X and Z there)
const atHeight = (b, y) => { const k = Math.abs(b.b.Y - b.a.Y) < 1e-9 ? 0 : Math.max(0, Math.min(1, (y - b.a.Y) / (b.b.Y - b.a.Y))); return { X: b.a.X + (b.b.X - b.a.X) * k, Z: b.a.Z + (b.b.Z - b.a.Z) * k }; };
const heightOf = (boards) => boards.reduce((h, b) => Math.max(h, b.a.Y, b.b.Y), 0);
const andList = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
const num = (v) => fmt(v).replace(' ft', '');

// hooks: {
//   towerView, fall (tower3d.js and fall.js), say(text, opts), gesture(name, ms), hideSay(),
//   viewAz() (where the camera stands round the tower now), watch({ az, miller }) (the camera's watching spot and the
//   miller's place, upwind), record(height, W, D) -> { best, newBest } (the best height and its base),
//   showHead(tower) (the windmill head and sails on what stands), keep({ keep: Set of ids, back: [lengths], kindling })
//   (Keep building), fresh(line) (a fresh yard, the miller saying line) }
export function makeTestRun(app, hooks) {
  const { towerView, fall } = hooks;
  let run = null;          // the test being played (below)
  let worker = null, workerBad = false, jobs = 0;
  const waiting = new Map();

  // ── the calculation, off the page's thread ────────────────────────────────────────────────────────────────────────
  // (or right here if a worker can't start: then the page holds still a moment while it works. A worker that hasn't
  // answered in WORKER_WAIT, or whose answer can't be read, is given up on the same way, so the page never sits on
  // "Here comes the wind" for good.)
  const WORKER_WAIT = 6000;     // ms: the sums take well under a second even on a slow phone; this is a lot of slack
  function calculate(tower, done) {
    const t0 = performance.now();
    const here = () => import('./frame.js').then((F) => done(F.windTest(tower), performance.now() - t0, false));
    if (workerBad || typeof Worker === 'undefined') { setTimeout(here, 30); return; }
    const giveUp = () => {
      workerBad = true;
      try { if (worker) worker.terminate(); } catch (e) { /* gone already */ }
      worker = null;
      const fs = [...waiting.values()]; waiting.clear(); fs.forEach((f) => f(null));
    };
    try {
      if (!worker) {
        worker = new Worker(new URL('./wind-worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => { const f = waiting.get(e.data && e.data.id); waiting.delete(e.data && e.data.id); if (f) f(e.data.result); };
        worker.onerror = (e) => { if (e.preventDefault) e.preventDefault(); giveUp(); };
        worker.onmessageerror = () => giveUp();
      }
      const id = ++jobs;
      const timer = setTimeout(() => { if (waiting.has(id)) giveUp(); }, WORKER_WAIT);
      waiting.set(id, (result) => { clearTimeout(timer); if (result) done(result, performance.now() - t0, true); else here(); });
      worker.postMessage({ id, tower: JSON.parse(JSON.stringify(tower)) });
    } catch (err) { workerBad = true; setTimeout(here, 30); }
  }

  // ── start: the wind is called ─────────────────────────────────────────────────────────────────────────────────────
  function start() {
    const tower = app.tower;
    $('stage-name').textContent = 'Here comes the wind'; $('stage-sub').textContent = 'from every side';
    $('stage-bar').style.width = '0%'; $('stage').hidden = false; $('legend').hidden = true;
    calculate(tower, (result, wallMs, inWorker) => {
      if (app.phase !== 'test' || app.tower !== tower || run) return;
      begin(tower, result, { wallMs, inWorker });
    });
  }
  function begin(tower, result, timing) {
    const t0 = JSON.parse(JSON.stringify(tower));
    run = {
      result, timing, tower: t0, byId: new Map(t0.boards.map((b) => [b.id, b])),
      up: new Set(t0.boards.map((b) => b.id)),       // what stands right now, as the test plays
      gi: -1, g: null, t: 0, phase: 'lull', env: 0, ev: 0, evT: 0, evStep: 'flash', easeT: 0, leads: new Set(), calmN: 0, calmShow: false,
      target: null, disp: new Map(), flash: null,     // what the colours and the bending head for, what they are now, and
                                                     // the parts flashing red
      log: [],                                       // every break as it played: { gust, ev, before, after (heights) }
      h0: heightOf(t0.boards), done: false, endT: 0,
    };
    // the watching spot, side on to the wind that decides it (the break that cost the most, else the hardest wind)
    hooks.watch(watchSpot(result));
    $('legend').hidden = false;
    nextGust();
  }

  // the wind of each gust, shown as it is played
  function nextGust() {
    const r = run.result;
    run.gi++;
    if (run.gi >= r.gusts.length || !run.up.size) { run.phase = 'end'; run.endT = 0; return; }
    const g = run.g = r.gusts[run.gi];
    run.t = 0; run.phase = 'rise'; run.ev = 0; run.evT = 0; run.evStep = 'flash'; run.easeT = 0; run.flash = null; run.started = false;
    // which breaks play in full, with the miller's call: in still air and in the wind, the first that brings boards
    // down (else the first)
    const evs = g.events, calmN = evs.filter((e) => e.calm).length;
    const leadOf = (i0, i1) => { for (let i = i0; i < i1; i++) if (evs[i].fell.length && !evs[i].note) return i; return i0 < i1 ? i0 : -1; };
    run.calmN = calmN; run.leads = new Set([leadOf(0, calmN), leadOf(calmN, evs.length)].filter((i) => i >= 0));
    wind.dir.set(g.dir.X, 0, g.dir.Z);
    $('stage-bar').style.width = ((g.stage + 1) / STAGES.length * 100) + '%';
    if (calmN) {
      // still air first: the tower under its own weight (drawn at full strength: there is no wind to grow with)
      run.phase = 'calm'; run.calmShow = true;
      aim(scaled(g.calm || { strain: {}, joints: [], move: {} }, evs[0].util));
      $('stage-name').textContent = 'Still air'; $('stage-sub').textContent = 'no wind yet: her own weight';
      return;
    }
    windUp();
  }
  // the wind rising: its name, and the colours heading for its peak
  function windUp() {
    const g = run.g;
    run.t = 0; run.phase = 'rise'; run.calmShow = false;
    aim(windTarget(g));
    $('stage-name').textContent = g.name;
    $('stage-sub').textContent = `${g.mph} mph from the ${g.from}`;
  }
  // A wind's peak numbers, as the colours rise toward them. If something gives in it, the strain is scaled so the part
  // about to give reaches 1 (red) just as it gives: the state when the first part reaches its limit, not the peak the
  // sums found with that part still holding (a part that can no longer hold itself up drags everything nailed to it far
  // past its limit in those sums, and those boards then stand).
  // The same holds between breaks: the numbers after one break, with the next still to come, are scaled by that next
  // break's own number (the part that gives next reaches red as it gives).
  function windTarget(g) {
    const breaks = g.events.some((e) => !e.calm && !e.note);
    return scaled({ strain: g.strain, joints: g.joints, move: g.move }, breaks && g.peak ? g.peak.util : 1);
  }
  function scaled(part, util) {
    if (!(util > 1)) return part;
    const k = 1 / util, strain = {};
    for (const id in part.strain) strain[id] = part.strain[id] * k;
    return { strain, joints: (part.joints || []).map((j) => ({ ...j, util: j.util * k })), move: part.move };
  }
  // what the colours and the bending head for: the strain, joints and movement at the wind's peak. (They grow with the
  // wind speed squared on the way there.) The bending is drawn BEND_X times larger, less if that would throw an end more
  // than BEND_MOST feet.
  function aim(part) {
    let most = 0;
    for (const id in part.move) for (const e of part.move[id]) most = Math.max(most, Math.hypot(e[0], e[1], e[2]));
    run.target = { ...part, gain: Math.min(BEND_X, BEND_MOST / Math.max(1e-6, most)) };
  }

  // ── every frame ──────────────────────────────────────────────────────────────────────────────────────────────────
  let lastCrack = 0, lastThud = 0;
  function frame(dt) {
    // the fall goes on while it has anything falling (through the card, too)
    if (fall.running) {
      const ev = fall.update(dt, wind.dir), now = performance.now();
      if (ev.pops && now - lastCrack > 70) { sound.crack(); lastCrack = now; }
      if (ev.hits && now - lastThud > 90) { sound.thud(ev.bigHit); lastThud = now; }
    }
    if (!run || run.done || app.phase !== 'test') return;
    run.t += dt;
    const g = run.g;
    switch (run.phase) {
      case 'calm': {
        // the breaks in still air, one after another (the one that brings boards down in full, after a moment to see
        // the tower as it is), then the wind rises on what is left
        run.env = 0; run.evT += dt;
        if (run.ev >= run.calmN || !run.up.size) {
          run.ev = run.calmN; run.evStep = 'flash'; run.evT = 0; run.started = false;
          if (run.up.size) windUp(); else { run.phase = 'ease'; run.easeT = EASE; }
          break;
        }
        const full = run.leads.has(run.ev) ? 0 : 1;
        if (!run.started) { if (run.evT >= (run.ev === 0 ? CALM : 0)) { run.started = true; startBreak(); } }
        else if (run.evStep === 'flash' && run.evT >= FLASH[full]) { dropBreak(); run.evStep = 'settle'; run.evT = 0; }
        else if (run.evStep === 'settle' && run.evT >= SETTLE[full]) { run.ev++; run.started = false; run.evT = 0; }
        break;
      }
      case 'rise':
        run.env = smooth(run.t / RISE);
        if (run.t >= PEAK) { if (run.ev < g.events.length) { run.phase = 'events'; startBreak(); } else run.phase = 'hold'; }
        break;
      case 'hold':
        run.env = 1;
        if (run.t >= HOLD) { run.phase = 'ease'; run.easeT = 0; }
        break;
      case 'events': {
        run.env = 1; run.evT += dt;
        const first = run.leads.has(run.ev) ? 0 : 1;
        if (run.evStep === 'flash' && run.evT >= FLASH[first]) { dropBreak(); run.evStep = 'settle'; run.evT = 0; }
        else if (run.evStep === 'settle' && run.evT >= SETTLE[first]) {
          run.ev++;
          if (run.ev < g.events.length && run.up.size) startBreak();
          else { run.phase = 'after'; run.evT = 0; }
        }
        break;
      }
      case 'after':
        run.env = 1; run.evT += dt;
        if (run.evT >= AFTER || !run.up.size) { run.phase = 'ease'; run.easeT = 0; }
        break;
      case 'ease':
        run.easeT += dt; run.env = 1 - smooth(run.easeT / EASE);
        if (run.easeT >= EASE) { run.phase = 'lull'; run.t = 0; }
        break;
      case 'lull':
        run.env = 0;
        if (run.t >= LULL) nextGust();
        break;
      case 'end':
        run.env = 0; run.endT += dt;
        // (once what fell has come to rest)
        if ((fall.settled() && run.endT > 0.5) || run.endT > 7) { finish(); return; }
        break;
    }
    // the wind on the hill and in the ears: rising and easing with the gust, a few surges in it
    const surge = 0.8 + 0.2 * Math.sin(run.t * 5.3) * Math.sin(run.t * 1.7 + 0.5);
    wind.level = g ? (g.mph / 60) * run.env * surge : 0.05;
    sound.setWind(Math.max(0.05, wind.level));
    draw(dt);
  }

  // the colours and the bending, easing toward the wind's numbers as it rises and falls
  function draw(dt) {
    // (in still air the weight's own strain is shown as it is: there is no wind for it to grow with)
    const T = run.target, e2 = run.phase === 'calm' && run.calmShow ? 1 : run.env * run.env, k = Math.min(1, dt * 14);
    const flutter = 0.94 + 0.06 * Math.sin(run.t * 5.3) * Math.sin(run.t * 1.7 + 0.5);
    for (const id of run.up) {
      const d = run.disp.get(id) || { s: 0, m: [[0, 0, 0], [0, 0, 0]] };
      const s = T && T.strain[id] !== undefined ? T.strain[id] * e2 : 0, mv = T && T.move[id];
      d.s += (s - d.s) * k;
      for (let e = 0; e < 2; e++) for (let a = 0; a < 3; a++) { const want = mv ? mv[e][a] * e2 * T.gain * flutter : 0; d.m[e][a] += (want - d.m[e][a]) * k; }
      run.disp.set(id, d);
    }
    const flashF = run.flash ? run.flash.f() : 0;
    const bendOf = (id) => { const d = run.up.has(id) && run.disp.get(id); return d ? d.m : null; };
    towerView.setBend(bendOf);
    towerView.setStrain((id) => (run.up.has(id) ? run.disp.get(id)?.s ?? 0 : undefined), flashF ? (id) => (run.flash.ids.has(id) ? flashF : 0) : null);
    towerView.setSpots(T ? T.joints : [], bendOf, (u) => u * e2);
  }

  // ── a break ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // the broken parts flash red with a crack; the miller calls out what went (the first break in a wind)
  function startBreak() {
    const ev = run.g.events[run.ev], before = towerNow();
    run.evT = 0; run.evStep = 'flash';
    const lead = run.leads.has(run.ev), ids = new Set(ev.broke.length ? ev.broke : ev.fell), t0 = performance.now(), dur = FLASH[lead ? 0 : 1] * 1000;
    run.flash = { ids, f: () => { const x = (performance.now() - t0) / dur; return x > 1.6 ? 0 : 0.55 + 0.45 * Math.sin(x * Math.PI * 4) ** 2; } };
    const size = Math.min(1, 0.25 + ev.fell.length / 10);
    sound.snap(size);
    if (ev.kind === 'tip' || ev.fell.length >= 8) setTimeout(() => sound.crash(), 120);
    const w = words(ev, before, run.g);
    run.log.push({ gust: run.g, ev, words: w, before: heightOf(before.boards), called: lead || ev.kind === 'tip', full: lead });
    if (lead || ev.kind === 'tip') { hooks.say(w.call, { force: true, times: 99, ms: 2600, key: 'call' }); hooks.gesture(ev.fell.length >= 4 ? 'HitRecieve' : 'Interact', 1200); }
  }
  // the boards that come down because of it fall (only those); the rest carries on with the strain it has now
  function dropBreak() {
    const ev = run.g.events[run.ev], before = towerNow();
    const falling = ev.fell.filter((id) => run.up.has(id));
    for (const id of falling) run.up.delete(id);
    if (falling.length) fall.drop({ tower: before, view: towerView, falling, windDir: wind.dir.clone(), breakAt: ev.at });
    run.log[run.log.length - 1].after = heightOf(towerNow().boards);
    // (the last break in still air: what is left stands quiet until the wind rises; its numbers come with the wind)
    const next = run.g.events[run.ev + 1];
    if (ev.calm && run.ev === run.calmN - 1) run.calmShow = false;
    else aim(next ? scaled(ev.after, next.util) : ev.after);
    run.flash = { ids: new Set(ev.broke.filter((id) => run.up.has(id))), f: () => 0 };
  }
  const towerNow = () => ({ W: run.tower.W, D: run.tower.D, boards: run.tower.boards.filter((b) => run.up.has(b.id)) });

  // ── the end: the card ────────────────────────────────────────────────────────────────────────────────────────────
  function finish() {
    run.done = true;
    app.phase = 'result'; wind.level = 0.1; sound.setWind(0.1);
    $('stage').hidden = true; $('legend').hidden = true;
    const r = run.result, standing = r.standing, h = r.height, { W, D } = run.tower;
    towerView.setStrain(null); towerView.setSpots(null); towerView.setBend(null);
    towerView.nailsFor(new Set(standing.boards.map((b) => b.id)));
    const nothing = !standing.boards.length || h <= 0;
    const { best, newBest } = hooks.record(h, W, D);
    // (the bar's Height says what still stands, as the card does)
    if ($('height')) $('height').innerHTML = fmtStat(h);
    if (h >= TARGET_FT) hooks.showHead(standing);
    const sacks = flourFor(h), story = storyOf(), advice = adviceOf();
    // (something gave but she still stands to her full height: "She stood, but something gave"; only a tower where
    // nothing at all gave is "She stood!")
    const whole = !nothing && h >= run.h0 - 0.01, sails = h >= TARGET_FT ? ' Sails up!' : '';
    const title = r.stood ? 'She stood!' + sails : whole ? 'She stood, but something gave.' + sails
      : nothing ? 'Down she came!' : `${fmt(h)} still standing!` + sails;
    // what came down: whole boards go back on the pile, snapped ones are kindling
    const fellIds = run.tower.boards.filter((b) => !standing.boards.some((s) => s.id === b.id)).map((b) => b.id);
    const snapped = new Set(); for (const L of run.log) if (L.ev.kind === 'snap' || L.ev.kind === 'buckle') L.ev.broke.forEach((id) => snapped.add(id));
    const back = fellIds.filter((id) => !snapped.has(id)).map((id) => run.byId.get(id).len), kindling = fellIds.length - back.length;
    run.card = { title, story, advice, h, sacks, back: back.length, kindling };
    const card = $('result'); card.classList.add('is-side'); card.classList.remove('is-folded');
    card.innerHTML = `<button class="fold" id="r-fold" aria-label="Fold the card down" title="Fold the card down"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
      <h2>${title}</h2><p class="sub">${story}</p>
      <div class="stat"><div><small>Left standing</small><div class="big">${fmt(h)}</div></div><div><small>Base</small><div class="big">${fmtBase(W, D, true)}</div></div><div><small>Best</small><div class="big">${fmt(best.height)}</div></div></div>
      <div class="sacks">${SACK}<div><b>The miller pays ${sacks} sack${sacks === 1 ? '' : 's'} of flour</b><br><small>${newBest && h > 0 ? `A new best height, with the stones ${fmtBase(W, D)}!` : 'A sack for every foot left standing' + (h >= TARGET_FT ? ', and five more for the sails' : '')}</small></div></div>
      <p class="miller">"${advice}"</p>
      ${!nothing && fellIds.length ? `<p class="pile-note">${pileNote(back.length, kindling)}</p>` : ''}
      <div class="row">${nothing ? '<button class="btn go" id="r-again">Try again</button>' : '<button class="btn" id="r-fresh">Start fresh</button><button class="btn go" id="r-keep">Keep building</button>'}</div>`;
    card.hidden = false;
    const again = $('r-again'), keep = $('r-keep'), fresh = $('r-fresh');
    // (on a phone: fold the card down to its title and buttons, to see the tower, and open it again)
    $('r-fold').onclick = () => { const f = card.classList.toggle('is-folded'); $('r-fold').setAttribute('aria-label', f ? 'Open the card' : 'Fold the card down'); };
    const keepIds = new Set(standing.boards.map((b) => b.id));
    if (again) again.onclick = () => { card.hidden = true; end(); hooks.fresh(advice); };
    if (fresh) fresh.onclick = () => { card.hidden = true; end(); hooks.fresh('Fresh lumber\'s on the sawhorses.'); };
    if (keep) keep.onclick = () => { card.hidden = true; end(); hooks.keep({ keep: keepIds, back, kindling }); };
  }
  const pileNote = (n, k) => cap((n ? `${n === 1 ? 'the board' : `the ${n} boards`} that came down whole ${n === 1 ? 'goes' : 'go'} back on your pile if you keep building` : '')
    + (n && k ? '; ' : '') + (k ? `${k === 1 ? 'the one' : k} that snapped ${k === 1 ? 'is' : 'are'} kindling` : '') + '.');
  // the test is over (the card's buttons): the next yard is main.js's
  function end() { run = null; fall.clear(); wind.level = 0.06; }

  // ── words ───────────────────────────────────────────────────────────────────────────────────────────────────────
  // what happened, stage by stage: "Breeze: the lone board on top bent over and blew off. Stiff wind and gust: the rest
  // held (19 ft). Big gust: the wind tipped the whole tower over on its stones." The breaks of one wind are told as one
  // clause: what started it (a post standing on nothing, else the first break), then, if that brought nothing down
  // itself, what did ("a post standing on a beam pulled its toe-nails out, then the 2 × 3 tier racked and folded
  // over"), and how many more boards came down. Breaks in still air, before any wind, come first ("Before the wind:").
  function storyOf() {
    const r = run.result;
    // (a foot that slid on the dirt with nothing coming down is only a note: she still stood)
    if (r.stood) { const n = run.log.find((L) => L.ev.note); return 'Through the breeze and every gust, from all four sides' + (n ? `, though ${n.words.base}` : '') + '.'; }
    const out = []; let held = [], gave = false, gone = false, hNow = run.h0;
    const flushHeld = () => { if (held.length) out.push(`${cap(andList(held.map((n, i) => (i ? n.toLowerCase() : n))))}: ${gave ? `the rest held (${fmt(hNow)})` : 'she held'}.`); held = []; };
    const tell = (label, breaks) => {
      const { cause, lead } = causeOf(breaks), left = breaks[breaks.length - 1].after;
      const then = lead !== cause && lead.ev.fell.length ? `, then ${lead.words.base}` : '';
      const named = new Set([...cause.ev.broke, ...(then ? lead.ev.broke : [])]);
      const extra = ['tip', 'loose'].includes(cause.ev.kind) ? 0 : breaks.reduce((n, L) => n + L.ev.fell.filter((id) => !named.has(id)).length, 0);
      const more = breaks.length - 1 - (then ? 1 : 0);
      const all = breaks.reduce((n, L) => n + L.ev.fell.length, 0);
      const rest = cause.ev.nofoot && all ? `: ${all} board${all === 1 ? '' : 's'} came down`
        : extra > 0 ? `, and ${extra} more board${extra === 1 ? '' : 's'} came down with it` : more > 0 ? `, and ${more} more part${more === 1 ? '' : 's'} gave way` : '';
      let line = `${label}: ${cause.words.base}${then}${rest}.`;
      if (left <= 0 && cause.ev.kind !== 'tip') line += ' Nothing was left standing.';
      out.push(line); gave = true; hNow = left;
      if (left <= 0) gone = true;
    };
    const still = run.log.filter((L) => L.ev.calm && !L.ev.note);
    if (still.length) tell('Before the wind', still);
    STAGES.forEach((st, si) => {
      if (gone) return;
      const breaks = run.log.filter((L) => L.gust.stage === si && !L.ev.note && !L.ev.calm);
      if (!breaks.length) { if (r.stages[si] && !r.stages[si].empty) held.push(st.name); return; }
      flushHeld();
      tell(st.name, breaks);
    });
    flushHeld();
    return out.join(' ');
  }
  // In the breaks of one wind (or of still air): the cause (a break naming posts that stood on nothing, else the first)
  // and the lead (the first that brought boards down, else the first): the one played in full, with the miller's call.
  function causeOf(breaks) {
    const cause = breaks.find((L) => L.ev.nofoot && L.ev.nofoot.length) || breaks[0];
    const lead = breaks.find((L) => L.ev.fell.length && !L.ev.note) || breaks[0];
    return { cause, lead };
  }
  // the miller's advice: about the wind that cost the most height (the first, on a tie), told from what started it;
  // a tower that stood hears how close it came
  function adviceOf() {
    const r = run.result, h = r.height;
    if (!run.log.length) {
      const top = h >= TARGET_FT ? 'Now that\'s a windmill. She\'ll grind flour all summer.' : `Good and stout. Reach ${TARGET_FT} feet and I'll put the sails on her.`;
      return top + closeCall();
    }
    let worst = null, most = -1;
    const groups = new Map();
    for (const L of run.log) { const key = L.ev.calm ? 'calm' : L.gust; (groups.get(key) || groups.set(key, []).get(key)).push(L); }
    for (const in1 of groups.values()) {
      const lost = in1[0].before - (in1[in1.length - 1].after ?? in1[0].before);
      if (lost > most + 0.01) { most = lost; worst = causeOf(in1).cause; }
    }
    return worst.words.advice;
  }
  // how near the tower that stood came to giving, in the big gust
  function closeCall() {
    const big = run.result.gusts.filter((g) => g.stage === STAGES.length - 1).sort((a, b) => b.peak.util - a.peak.util)[0];
    if (!big || !big.peak || big.peak.util < 0.7) return '';
    const p = big.peak, pct = Math.round(p.util * 100), b = p.id ? run.byId.get(p.id) : null;
    const role = b ? boardRole(run.tower, b) : 'a board';
    const what = p.kind === 'tip' ? 'she came within ' + (100 - pct) + '% of tipping over'
      : p.kind === 'rack' ? `${role} leaned ${pct}% as far as it can before the storey folds`
        : p.kind === 'bend' ? `${role} with its top free leaned ${pct}% as far as it can`
          : p.kind === 'nails' || p.kind === 'butt' || p.kind === 'footing' ? `the nails holding ${role} were at ${pct}% of what they hold`
            : `${role} was at ${pct}% of what it holds`;
    return ` In the big gust ${what}: the closest she came to giving.`;
  }

  // one break in words: { call (the miller's shout as it goes), what (for the story: what gave, and how many more boards
  // came down with it), base (what gave, alone), advice }
  function words(ev, before, g) {
    const lost = ev.fell.length, broke = ev.broke.length;
    const tail = lost > broke && !['tip', 'loose'].includes(ev.kind) ? `, and ${lost - broke} more board${lost - broke === 1 ? '' : 's'} came down with it` : '';
    const w = wordsOf(ev, before, g);
    return { ...w, base: w.what, what: w.what + tail };
  }
  function wordsOf(ev, before, g) {
    const tail = '';
    const byId = (id) => before.boards.find((b) => b.id === id) || run.byId.get(id);
    // posts standing on nothing (no beam under their feet): that is what to say, whatever gave first
    if (ev.nofoot && ev.nofoot.length) return nofootWords(ev, before, g);
    // in still air, before any wind: it couldn't hold up its own weight
    if (ev.calm && ev.kind !== 'loose') {
      const w = wordsOf({ ...ev, calm: false }, before, g);
      // (a top that leans over in still air was not blown: it fell over, held only at its foot)
      if (ev.kind === 'bend') return { call: 'That one can\'t stand by itself!', what: `${w.what.replace(/ (bent over and blew off|bent over)/, ' leaned over and fell')}, under its own weight`,
        advice: 'A board held only at its foot, leaning, can\'t even hold up its own weight: its nails let it fold over. Nail its top to something too. Height only counts if it stands.' };
      return { call: 'She can\'t hold her own weight!', what: `${w.what}, under her own weight`,
        advice: `That gave way under its own weight, before any wind blew. ${w.advice}` };
    }
    const b = ev.broke.length ? byId(ev.broke[0]) : null, role = b ? boardRole(before, b) : 'a board';
    const Role = cap(role.replace(/^an? /, ''));
    // nails that twisted loose and left a hinge: nothing came down, the board turns on its nails there now
    if (ev.hinge) return { call: 'A joint worked loose!', what: `the nails holding ${role} twisted loose, and it turns on them there now`,
      advice: 'The nails at a corner twisted loose: the boards there turned on them like a gate on its hinges. A long brace corner to corner in that wall keeps the corner square, so its nails don\'t have to.' };
    switch (ev.kind) {
      case 'bend': {
        // (on top: standing on the top of the rest, or lapped onto it and sticking up past everything else, off the
        // ground: a lone board nailed a foot down the top post is still the lone board on top)
        // (judged against the tower as built, not what is left of it: a tier's brace left standing on the beams after its
        // tier folded is not a lone board on top)
        const others = run.tower.boards.filter((o) => o.id !== (b && b.id)), H = heightOf(others);
        const onTop = b && (lo(b) >= H - 0.3 || (lo(b) > 0.3 && hi(b) > H + 0.5));
        const was = b ? boardRole(run.tower, b) : role;
        if (b && !onTop && was !== role && !/post/.test(was)) return { call: `${cap(was.replace(/^an? /, ''))} fell over!`, what: `${was} left standing by itself bent over`,
          advice: 'What a collapse leaves standing by itself, held only at its foot, just bends over in the wind. Brace every wall, so nothing comes down in the first place.' };
        if (onTop) return { call: `The ${isUprightB(b) ? 'board' : 'piece'} on top blew off!`, what: `the lone board on top bent over and blew off${tail}`,
          advice: `A lone board stood on top is only a flag in the wind: nothing holds its top, so ${g.stage === 0 ? 'the first breeze' : 'the ' + g.name.toLowerCase()} bent it right over. Height only counts if it stands: tie a top in with crosspieces and braces, or save the wood for the walls.` };
        const post = !b || isUprightB(b) || /post/.test(role);
        return { call: post ? 'A post bent over!' : `${Role} bent over!`, what: `${post ? 'a post' : role} with its top free bent over${tail}`,
          advice: post ? 'A post with its top free just bends over in the wind. Tie the posts\' tops together with crosspieces, and brace every wall.'
            : 'A board with its top end free, held only at its foot, just bends over in the wind. Nail its top to something too, or saw off what sticks out.' };
      }
      case 'rack': return rackWords(ev, before, g, tail);
      case 'tip': {
        const span = Math.abs(g.dir.X) > 0.5 ? before.W : before.D;
        return { call: 'She\'s going over!', what: 'the wind tipped the whole tower over on its stones',
          advice: span >= MAX_W - 1e-6 ? 'She went over in one piece. The stones can\'t go any wider than 8 feet, so build her lower, or narrower up top.'
            : `Too narrow a base for her height: the wind from the ${g.from} tipped her over the ${fmt(span)} way. Set the stones wider${before.W !== before.D ? ' that way' : ''}, or build her lower.` };
      }
      case 'snap': case 'buckle': {
        const how = ev.kind === 'snap' ? 'snapped' : 'buckled under the squeeze';
        const where = b ? ` in ${planeName(before, planeKeyFor(b), false)}` : '';
        const advice = /brace/.test(role) ? 'A long brace squeezed in a gust buckles the thin way. A shorter bay, or a second brace crossing it, holds it straighter.'
          : /post/.test(role) ? 'A post bending the thin way snapped. Brace it in both walls it stands in, so it can\'t bend either way.'
            : /beam/.test(role) ? 'A beam carrying a tier bent too far. Stand the tier\'s posts near the beam\'s ends, or prop its middle.'
              : 'Something snapped. Braces near 45 degrees spread the load, so no one board takes it all.';
        return { call: `${Role} ${ev.kind === 'snap' ? 'snapped' : 'buckled'}!`, what: `${role} ${how}${where}${tail}`, advice };
      }
      case 'nails': {
        if (/toe-nails/.test(ev.text)) {
          const post = /standing on/.test(ev.text);
          return { call: 'Toe-nails pulled out!', what: `${ev.text}${tail}`,
            advice: post ? toeAdvice(before, b)
              : 'A beam resting on a crosspiece is only toe-nailed at its end. Lay the beams right across, onto the crosspieces at both ends, and brace the tier above them.' };
        }
        if (/knee/.test(ev.text) || role === 'a knee brace') return { call: 'The knee brace let go!', what: `the nails in a knee brace pulled out${tail}`, advice: 'Knee braces help, but their nails take a beating in a big gust. A long brace corner to corner holds better.' };
        return { call: 'The nails pulled out!', what: `the nails holding ${role} pulled out${tail}`, advice: 'The nails at a joint pulled out. Braces near 45 degrees spread the load, so no one joint takes it all.' };
      }
      case 'butt': return { call: 'That joint pulled apart!', what: `two boards butted end to end pulled apart${tail}`, advice: 'Two boards end to end hardly hold. Nail a crosspiece or a brace over the joint.' };
      case 'footing': {
        const dirt = /bare ground/.test(ev.text);
        return { call: dirt ? 'Her foot slid!' : 'A foot came off its stone!', what: `${ev.text}${tail}`,
          advice: dirt ? 'A board resting on the dirt can\'t brace anything: it just slides. Nail its foot to a post on a stone.'
            : 'A foot tore loose from its stone: the wind lifted that side. Brace down to every stone, or set the stones wider.' };
      }
      case 'loose': return { call: 'That wasn\'t nailed to anything!', what: ev.text,
        advice: 'Every board has to be nailed to something that reaches the ground. One touching nothing just falls.' };
      default: return { call: 'Something gave!', what: `${ev.text}${tail}`, advice: 'Something gave. Braces near 45 degrees spread the load best.' };
    }
  }
  const planeKeyFor = (b) => (b.n === 'X' ? planeKey('X', b.a.X) : planeKey('Z', b.a.Z));

  // The storey (or tier) whose posts stand at height y: its posts (straight up, or leaning in a little), its footprint
  // there, how high its posts reach, its name ("the 2 × 3 tier" when it stands above the ground on less than the stones'
  // footprint, else "the storey") and its four walls, each with whether it had a long brace across that storey.
  function tierAt(before, y) {
    const posts = before.boards.filter((b) => postLike(b) && Math.abs(lo(b) - y) < 0.1);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, top = Infinity;
    for (const p of posts) { const q = atHeight(p, y); x0 = Math.min(x0, q.X); x1 = Math.max(x1, q.X); z0 = Math.min(z0, q.Z); z1 = Math.max(z1, q.Z); top = Math.min(top, hi(p)); }
    const tier = posts.length > 0 && y > 0.3 && (x1 - x0 < before.W - 0.01 || z1 - z0 < before.D - 0.01);
    const name = !posts.length ? 'that storey' : tier ? `the ${num(x1 - x0)} × ${num(z1 - z0)} tier` : y > 0.3 ? 'that storey' : 'the bottom storey';
    const walls = !posts.length ? [] : [['Z', z1, 'front wall', x1 - x0], ['Z', z0, 'back wall', x1 - x0], ['X', x1, 'right side', z1 - z0], ['X', x0, 'left side', z1 - z0]]
      .filter(([ax, off], i, all) => all.findIndex((w) => w[0] === ax && Math.abs(w[1] - off) < 1e-6) === i)
      .map(([ax, off, wall, wide]) => {
        const k = planeKey(ax, off);
        const braces = planeSegments(before, k).filter((sg) => !sg.post && !isLevelB(sg.src) && !postLike(sg.src) && Math.min(sg.ay, sg.by) < top - 0.3 && Math.max(sg.ay, sg.by) > y + 0.3);
        return { k, name: wall, braced: braces.some((sg) => !isKnee(sg, wide)) };
      });
    return { posts, x0, x1, z0, z1, y, top, tier, name, walls };
  }
  const wallsNamed = (ws) => 'its ' + andList(ws.map((w) => w.name)).replace(/ wall and /g, ' and ') + (ws.length > 1 && ws.every((w) => / wall$/.test(w.name)) ? 's' : '');
  // the advice when a post standing on a beam pulled its toe-nails out: about the tier's walls as they really were
  function toeAdvice(before, post) {
    const T = post ? tierAt(before, lo(post)) : null;
    const base = 'A post standing on a beam is only toe-nailed at its foot, and toe-nails pull out easily.';
    if (!T || !T.walls.length) return `${base} Brace that tier corner to corner, so the push goes down the braces instead of prying the foot up.`;
    const open = T.walls.filter((w) => !w.braced);
    if (open.length === T.walls.length) return `${base} ${cap(T.name)} had no braces: brace every wall of it corner to corner, so the push goes down the braces instead of prying the foot up.`;
    if (open.length) return `${base} ${cap(T.name)} had no brace in ${wallsNamed(open)}: brace every wall of it corner to corner, so the push goes down the braces instead of prying the foot up.`;
    // every wall braced: the toe-nails were simply asked too much. A brace's foot nailed down beside a post's foot adds
    // its own toe-nails, so a post with no brace foot at its own foot is the place to start.
    const footOf = (b) => (b.a.Y <= b.b.Y ? b.a : b.b);
    const bare = T.posts.filter((p) => { const f = footOf(p); return !before.boards.some((o) => o !== p && !isLevelB(o) && !postLike(o) && Math.hypot(footOf(o).X - f.X, footOf(o).Y - f.Y, footOf(o).Z - f.Z) < 0.25); });
    if (bare.length) return `${cap(T.name)} was braced corner to corner in every wall, but the wind still pried a post's foot up off its beam: three toe-nails only hold so much. Start a brace at the foot of every post of it, so the brace's nails share the pull, or build her top lower.`;
    return `${cap(T.name)} was braced corner to corner in every wall, with a brace at every post's foot, but the wind still pried a foot up off its beam: toe-nails only hold so much. Stand its posts nearer the beams' ends, right over the crosspieces, or build her top lower.`;
  }
  // posts standing on nothing (no beam under their feet): which tier, which side, and what to do
  function nofootWords(ev, before, g) {
    const posts = ev.nofoot.map((id) => before.boards.find((b) => b.id === id) || run.byId.get(id)).filter(Boolean);
    const y = posts.length ? Math.min(...posts.map(lo)) : 8, T = tierAt(before.boards.some((b) => posts.includes(b)) ? before : run.tower, y);
    const all = (f) => posts.length && posts.every(f);
    const side = all((p) => p.a.X < -0.01) ? ' on the left' : all((p) => p.a.X > 0.01) ? ' on the right' : all((p) => p.a.Z > 0.01) ? ' at the front' : all((p) => p.a.Z < -0.01) ? ' at the back' : '';
    const one = posts.length === 1;
    const who = T.tier ? `${T.name}'s post${one ? '' : 's'}${side}` : `${one ? 'a post' : 'the posts'}${side}`, what = T.tier ? 'the tier' : 'it';
    return { call: one ? 'Nothing under that post!' : 'Nothing under those posts!',
      what: `${who} stood on nothing, with no beam under ${one ? 'it' : 'them'}, and ${what} ${ev.calm ? 'fell under its own weight' : `gave way in the ${g.name.toLowerCase()}`}`,
      advice: `Every post of a tier needs a beam or a crosspiece right under its foot. ${cap(who)} had nothing under ${one ? 'it' : 'them'}: lay a beam across the storey below, from crosspiece to crosspiece, and stand ${one ? 'the post' : 'the posts'} on it.` };
  }

  // A storey (or a tier) that racked, in words. The storey: the posts standing where it leaned, between the floor
  // under that spot and the one over it (the ground, the beams, every level board). A tier: its posts stand above the
  // ground on a smaller footprint than the stones (a 2 × 3 tier on beams). The walls that had to hold it square are the
  // ones the wind blows along (from the west or east: the walls facing front and back); each either had a long brace
  // corner to corner in that storey or it didn't.
  // The walls checked are the two walls of the storey's footprint (at the racked height) that the wind blows along,
  // whether or not posts still stand in them: a wall with one post (or none) left is missing a corner post; a wall the
  // posts lean across (a storey tapering in) leans too, and a leaning wall can't take a brace this round. The advice
  // comes from those walls; the physics' own words (a knee brace...) only when there were no walls to look at.
  function rackWords(ev, before, g, tail) {
    const y = ev.at.Y, top = heightOf(before.boards);
    // the posts of the storey: boards standing straight up or leaning in a little (a tapered storey), across that height
    const posts = before.boards.filter((b) => postLike(b) && lo(b) < y + 0.05 && hi(b) > y - 0.05);
    const floors = [...new Set([0, ...before.boards.filter(isLevelB).map((b) => +((b.a.Y + b.b.Y) / 2).toFixed(2))])].sort((a, c) => a - c);
    const y0 = Math.max(...floors.filter((f) => f <= y + 0.05)), y1 = Math.min(top, ...floors.filter((f) => f > y + 0.3));
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, foot = Infinity;
    for (const p of posts) { const q = atHeight(p, y); x0 = Math.min(x0, q.X); x1 = Math.max(x1, q.X); z0 = Math.min(z0, q.Z); z1 = Math.max(z1, q.Z); foot = Math.min(foot, lo(p)); }
    const tier = posts.length && foot > 0.3 && (x1 - x0 < before.W - 0.01 || z1 - z0 < before.D - 0.01);
    // its name: "the 2 × 3 tier", or which storey ("the top storey"), or "the tower" when it is only one storey high
    const under = floors.filter((f) => f < top - 0.5), i = Math.max(0, under.filter((f) => f <= y0 + 0.05).length - 1), n = under.length;
    const storey = n < 2 ? 'the tower' : `the ${i === n - 1 ? 'top' : i === 0 ? 'bottom' : n === 3 ? 'middle' : ['second', 'third', 'fourth', 'fifth', 'sixth'][i - 1] || 'middle'} storey`;
    // (one post left of a tier, after the rest of it went: what was left of it)
    const place = tier ? (x1 - x0 < 0.25 || z1 - z0 < 0.25 ? 'what was left of the tier' : `the ${num(x1 - x0)} × ${num(z1 - z0)} tier`) : storey;
    // the walls the wind blows along (the two of the footprint), and whether each had a brace there
    const along = Math.abs(g.dir.X) > 0.5 ? 'Z' : 'X';
    const keys = !posts.length ? [] : [...new Set((along === 'Z' ? [z1, z0] : [x1, x0]).map((o) => planeKey(along, o)))];     // (front first, then back; right, then left)
    const wallName = (k) => {
      if (!tier && faceOfPlane(before, k) >= 0) return planeName(before, k).replace(/^the /, '');
      const off = +k.slice(2), side = along === 'Z' ? (Math.abs(off - z1) < 1e-3 ? 'front' : Math.abs(off - z0) < 1e-3 ? 'back' : null) : (Math.abs(off - x1) < 1e-3 ? 'right side' : Math.abs(off - x0) < 1e-3 ? 'left side' : null);
      return side ? side + (side.endsWith('side') ? '' : ' wall') : planeName(before, k).replace(/^the /, '');
    };
    const walls = keys.map((k) => {
      const off = parseKey(k).off, segs = planeSegments(before, k), wide = along === 'Z' ? x1 - x0 : z1 - z0;
      const braces = segs.filter((s) => !s.post && !isLevelB(s.src) && !postLike(s.src) && Math.min(s.ay, s.by) < y1 - 0.3 && Math.max(s.ay, s.by) > y0 + 0.3);
      const long = braces.filter((s) => !isKnee(s, wide));
      // the posts standing in this wall, and the ones that only pass through its line here, leaning across it
      const inWall = posts.filter((p) => planesOf(p).includes(k));
      const across = posts.filter((p) => !inWall.includes(p) && Math.abs((along === 'Z' ? atHeight(p, y).Z : atHeight(p, y).X) - off) < 0.1);
      const withFloors = [...segs, ...floorsAcross(before, k)];
      return { k, name: wallName(k), braced: long.length > 0, closes: long.some((s) => trianglesOf(withFloors, s.id).length > 0), knee: braces.length > long.length,
        leans: across.length > 0 && inWall.length < 2, short: inWall.length < 2 && !across.length };
    });
    const open = walls.filter((w) => !w.braced), leaning = walls.filter((w) => w.leans), short = walls.filter((w) => w.short);
    const named = (ws) => (tier || ws.length === 1 ? 'its ' : 'the ') + andList(ws.map((w) => w.name)).replace(/ wall and /g, ' and ') + (ws.length > 1 && ws.every((w) => / wall$/.test(w.name)) ? 's' : '');
    // (in the wind it really happened in: a knee-braced storey can go in the stiff wind, not only in the big gust)
    const inWind = !g || !g.name ? 'in a big gust' : g.stage === 0 ? 'even in a breeze' : `in a ${g.name.toLowerCase()}`;
    const KNEE = `Knee braces help, but a short brace can't hold a storey square ${inWind}. A long brace corner to corner holds better.`;
    let advice;
    if (!walls.length) advice = /knee/.test(ev.text) ? KNEE : `${cap(place)} leaned too far and folded over. Brace every wall corner to corner, near 45 degrees.`;
    else if (leaning.length) advice = `${cap(place)}'s posts lean in, so ${named(leaning)} ${leaning.length > 1 ? 'lean' : 'leans'} too, and a leaning wall can't take a brace. To narrow her as she rises, set the next storey in on beams with its posts straight up, and brace every wall.`;
    else if (short.length) advice = `${cap(place)} was missing a corner post in ${named(short)}, so nothing held that wall square. Every corner needs its post, and every wall its brace.`;
    else if (open.length === walls.length) advice = open.some((w) => w.knee) ? KNEE
      : `${cap(place)} had no brace in ${named(open)}, the walls the wind from the ${g.from} blows along, so it folded over. ${tier ? 'A tier needs its own long braces, corner to corner, just like the base.' : 'Every storey needs a long brace corner to corner in those walls, near 45 degrees.'}`;
    else if (open.length) advice = `${cap(place)} had no brace in ${named(open)}, so it folded there, though ${named(walls.filter((w) => w.braced))} had one. Every wall the wind blows along needs its own brace.`;
    else if (!walls.some((w) => w.closes)) advice = `${cap(place)} had a brace, but its end stopped short of the corner, so the square could still fold. Set a brace's ends right on the corners.`;
    else advice = `${cap(place)} had its braces, but still leaned too far. A second brace crossing the first, or a shorter storey, stiffens her.`;
    return { call: tier ? 'The tier\'s folding!' : 'She\'s racking over!', what: `${place} racked and folded over${tail}`, advice };
  }

  // ── the camera's watching spot ───────────────────────────────────────────────────────────────────────────────────
  // Along one of the clear lines between the trees, as square on to the wind that decides it as the lines allow (a
  // tower that tips falls away downwind: seen side on, its fall shows long, not end on as a heap), and of those the
  // nearest to round the corner from where the camera was. (From the side where downwind is to the left of the screen,
  // so a fall lands clear of the card, which sits on the right.) The miller steps back upwind, out from under it.
  function watchSpot(result) {
    let decide = null, lost = -1, hNow = heightOf(run.tower.boards);
    for (const g of result.gusts) for (const ev of g.events) {
      const after = heightAfter(ev);
      if (hNow - after > lost + 0.01) { lost = hNow - after; decide = g; }
    }
    if (!decide) decide = result.gusts.filter((g) => g.stage === STAGES.length - 1).sort((a, b) => b.peak.util - a.peak.util)[0] || result.gusts[result.gusts.length - 1];
    const dX = decide ? decide.dir.X : 1, dZ = decide ? decide.dir.Z : 0;
    const side = dZ ? Math.PI / 2 : 0;      // (side on to a wind along X: looking along Z)
    const wantAz = hooks.viewAz() + 0.65, clear = [0.62, -0.55, 1.58, 2.78, -1.85, -0.2];
    const near = (a) => a + Math.round((wantAz - a) / (Math.PI * 2)) * Math.PI * 2;
    const score = (a) => (1 - Math.abs(Math.cos(a - side))) * 3 + Math.abs(near(a) - wantAz) * 0.15 + (dX * Math.cos(a) - dZ * Math.sin(a) > 0.3 ? 0.6 : 0);
    const az = near(clear.slice().sort((a, b) => score(a) - score(b))[0]);
    const r = Math.max(run.tower.W, run.tower.D) / 2 * FT + 2.4, px = -dZ, pz = dX, toCam = Math.sign(px * Math.sin(az) + pz * Math.cos(az)) || 1;
    return { az, miller: { x: -dX * r + px * toCam * 1.6, z: -dZ * r + pz * toCam * 1.6 } };
  }
  // the height left once a break's boards are gone (the boards that fell in it and in every break before it)
  function heightAfter(ev) {
    const gone = new Set();
    for (const g of run.result.gusts) for (const e of g.events) { e.fell.forEach((id) => gone.add(id)); if (e === ev) return heightOf(run.tower.boards.filter((b) => !gone.has(b.id))); }
    return 0;
  }

  // what the camera frames (feet): { H (how tall), across (how wide), X, Z (its middle) }: the tower as built while it
  // stands; at the end what stands and the boards lying round it; closer in on the pile once it is all down
  // (narrow: a phone held upright, where the boards round the tower would shrink it to a speck: just what stands)
  function framing(narrow = false) {
    const t = app.tower, wide = Math.max(t.W, t.D);
    if (!run) return { H: Math.max(8, towerHeight(t)), across: wide, X: 0, Z: 0 };
    const down = !run.up.size && fall.sinceDrop > 0.8;
    if (!down && !run.done) return { H: Math.max(8, run.h0), across: wide, X: 0, Z: 0 };
    if (!down && narrow) return { H: Math.max(9, run.result.height + 2), across: wide, X: 0, Z: 0, pile: true };
    // (the boards on the ground: where they lie, and the tower's own footprint if any of it stands)
    let x0 = run.up.size ? -t.W / 2 : Infinity, x1 = run.up.size ? t.W / 2 : -Infinity, z0 = run.up.size ? -t.D / 2 : Infinity, z1 = run.up.size ? t.D / 2 : -Infinity;
    for (const st of fall.sticks) for (const p of st.p) { x0 = Math.min(x0, p.x / FT); x1 = Math.max(x1, p.x / FT); z0 = Math.min(z0, p.z / FT); z1 = Math.max(z1, p.z / FT); }
    if (!Number.isFinite(x0)) { x0 = -t.W / 2; x1 = t.W / 2; z0 = -t.D / 2; z1 = t.D / 2; }
    const across = Math.max(wide, Math.hypot(x1 - x0, z1 - z0) * 0.85);
    return { H: down ? Math.max(6, across * 0.45) : Math.max(9, run.result.height + 2), across, X: (x0 + x1) / 2, Z: (z0 + z1) / 2, pile: fall.sticks.length > 0, down };
  }

  // for the rigs (window.WM.test())
  function state() {
    if (!run) return null;
    return { phase: run.phase, gust: run.gi, of: run.result.gusts.length, stage: run.g ? run.g.name : null, from: run.g ? run.g.from : null, env: +run.env.toFixed(3),
      up: run.up.size, falling: fall.sticks.length, breaks: run.log.map((L) => ({ stage: L.gust.name, from: L.gust.from, kind: L.ev.kind, calm: !!L.ev.calm, called: L.called, full: L.full, call: L.words.call, what: L.words.what, broke: L.ev.broke, fell: L.ev.fell.length, before: L.before, after: L.after })),
      height: run.result.height, stood: run.result.stood, ms: run.result.ms, wallMs: Math.round(run.timing.wallMs), inWorker: run.timing.inWorker, card: run.card || null,
      shown: [...run.up].slice(0, 400).map((id) => [id, +(run.disp.get(id)?.s ?? 0).toFixed(3)]) };
  }

  return { start, frame, framing, state, get running() { return !!run && !run.done; }, get result() { return run && run.result; } };
}

const SACK = '<svg viewBox="0 0 32 32"><path d="M9 6c2 2 12 2 14 0l-1 4c4 3 6 9 5 15-1 4-5 5-11 5S6 29 5 25c-1-6 1-12 5-15z" fill="#efe6d0" stroke="#7a5530" stroke-width="1.5"/><path d="M10 10c3 1 9 1 12 0" stroke="#7a5530" stroke-width="1.5" fill="none"/><text x="16" y="23" text-anchor="middle" font-size="7" font-family="Smokum, Georgia, serif" fill="#7a5530">FLOUR</text></svg>';
