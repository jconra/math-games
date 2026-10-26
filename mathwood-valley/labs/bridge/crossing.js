// THE BRIDGE TEST AS SHOWN: the frame calculation (frame.js crossTest, run off the page's thread in cross-worker.js)
// says what every load does at every half foot of its crossing; this plays it out on the river and then says what
// happened. It follows the windmill lab's testrun.js (the strain colours, the bending drawn larger, a break flashing red
// before what it held falls, a card at the end), with loads rolling across instead of gusts.
//   * The ratings go in order, lightest first: a person, horse and rider, the covered wagon, the freight wagon, the cattle
//     drive (frame.js LOADS, each with its weight). Each walks (or rolls) on from the west bank, across the deck, and off
//     the east bank, at an easy pace. As it goes, every board is tinted by its strain (green easy, yellow at half, red at
//     its limit), the joints get coloured spots, and the frame bends by how far each board's ends really move (drawn
//     several times larger: the card says how far it really sagged).
//   * When something gives, it gives where the sums say: the broken parts flash red, a crack, what they held up falls into
//     the river, the engineer calls out what went; the load carries on if the deck under it still stands, or turns back to
//     the bank if it doesn't (nobody is hurt), and then the heavier loads don't try.
//   * A load with no room (a board across the bridge lower than it is tall) stays on the bank.
//   * At the end, the card: the heaviest load carried across (the rating), the gold the engineer pays for it, what
//     happened in plain words, and what to change, from the break that stopped it (the boards it talks about glow).
//     Then "Keep building" (what stands stays; boards that fell whole go back on the pile, snapped ones are kindling;
//     fallen deck planks go back on the plank pile) or "Start fresh".
//   * THE CARD'S OBJECT (for main.js and rigs): { title, story, advice, focusIds, rating, gold, sag, back, kindling }
// hooks: { towerView, deckView, loads, fall, say(text, opts), gesture(name, ms), record(rating, S) -> { best, newBest },
//   keep({ keep: Set of ids, back: [lengths], planksBack, kindling }), fresh(line), view(): the fall's view of boards,
//   words(text) (optional: the ways named as the host's world has them), pay(rating) (optional: what the engineer
//   pays: { gold, line, sub }; else frame.js LOADS gold), done(card) (optional: the card is up) }
// C.dispose(): the worker let go (the builder put away)
import { LOADS } from './frame.js';
import { lenWords, lenLabel, spellUnits, placeWords, roleOf, PLANK, crossesMid, encodeBridge } from './bridge.js';
import * as sound from '../windmill/sound.js';

const $ = (id) => document.getElementById(id);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
// how fast each load is played (feet a second): a walk, a horse's walk, wagons, the herd a bit quicker (it is long)
const SPEED = { person: 4.5, horse: 5.5, covered: 5, freight: 5, cattle: 7 };
const APPROACH = 7;                 // feet: how far back on the west bank each load starts
const FLASH = [0.65, 0.3], SETTLE = [1.5, 0.5], LULL = 0.9, BACK = 1.8, ACROSS = 0.9;
const BEND_X = 8, BEND_MOST = 1.0;  // the bending drawn this many times larger, but never more than this (feet) at any end
const lb = (n) => `${n.toLocaleString('en-US')} lb`;
const TOP = 3.5 / 24 + PLANK.t;     // the deck's top above its boards' line (a plank's thickness on a 2x4's top edge)

export function makeCrossing(app, hooks) {
  const { towerView, deckView, loads, fall } = hooks;
  let run = null, worker = null, workerBad = false, jobs = 0, current = null;

  // ── the calculation, off the page's thread (each part arrives as soon as it is worked out) ──────────────────────
  const WORKER_WAIT = 9000;
  function calculate(bridge, onPart) {
    const here = () => import('./frame.js').then((F) => { F.crossTest(bridge, { onPart }); });
    if (workerBad || typeof Worker === 'undefined') { setTimeout(here, 30); return; }
    const giveUp = () => { workerBad = true; try { if (worker) worker.terminate(); } catch (e) { /* gone */ } worker = null; if (current && !current.any) { current = null; here(); } };
    try {
      if (!worker) {
        worker = new Worker(new URL('./cross-worker.js', import.meta.url), { type: 'module' });
        worker.onerror = (e) => { if (e.preventDefault) e.preventDefault(); giveUp(); };
        worker.onmessageerror = () => giveUp();
      }
      const id = ++jobs; current = { id, any: false };
      worker.onmessage = (e) => { const d = e.data; if (!current || d.id !== current.id) return; if (d.part) { current.any = true; onPart(d.part); } };
      setTimeout(() => { if (current && current.id === id && !current.any) giveUp(); }, WORKER_WAIT);
      worker.postMessage({ id, bridge: JSON.parse(JSON.stringify(bridge)) });
    } catch (err) { workerBad = true; setTimeout(here, 30); }
  }

  // ── start: "Send it across" ──────────────────────────────────────────────────────────────────────────────────
  function start() {
    const br = app.tower, snap = JSON.parse(JSON.stringify({ S: br.S, D: br.D, boards: br.boards, deck: br.deck }));
    const all = [...snap.boards, ...(snap.deck ? snap.deck.planks : [])];
    run = { bridge: snap, byId: new Map(all.map((b) => [b.id, b])), up: new Set(all.map((b) => b.id)), calm: null, crossings: [], rating: -1,
      i: -1, phase: 'wait', t: 0, x: 0, k: -1, evs: [], ev: 0, evT: 0, evStep: 'flash', flash: null, target: null, disp: new Map(), log: [], done: false, t0: performance.now() };
    stage('The engineer works out the sums', 'for every load, every half foot of the way', 0);
    $('legend').hidden = false;
    calculate(snap, (p) => {
      if (!run || run.bridge !== snap) return;
      if (p.part === 'calm') run.calm = p.calm;
      else if (p.part === 'crossing') { run.crossings[p.index] = p.crossing; run.rating = p.rating; }
    });
  }
  function stage(name, sub, frac) {
    $('stage-name').textContent = name; $('stage-sub').textContent = sub; $('stage-bar').style.width = Math.round(frac * 100) + '%'; $('stage').hidden = false;
  }

  // ── every frame ──────────────────────────────────────────────────────────────────────────────────────────────
  let lastCrack = 0, lastThud = 0;
  function frame(dt) {
    if (fall.running) {
      const ev = fall.update(dt, ZERO), now = performance.now();
      if (ev.pops && now - lastCrack > 70) { sound.crack(); lastCrack = now; }
      if (ev.hits && now - lastThud > 90) { sound.thud(ev.bigHit); lastThud = now; }
    }
    if (!run || run.done || app.phase !== 'test') return;
    run.t += dt;
    const cr = run.crossings[run.i];
    switch (run.phase) {
      case 'wait':
        if (!run.calm) break;
        if (run.calm.events.length) { run.evs = batched(run.calm.events); run.ev = 0; run.evT = 0; run.evStep = 'flash'; run.started = false; run.phase = 'calm'; aim(run.calm); stage('Her own weight', 'before anything crosses', 0); }
        else { aim(run.calm); next(); }
        break;
      case 'calm': if (playBreaks(dt, true)) { aim(run.calm); if (run.calm.down) { run.phase = 'end'; run.t = 0; } else next(); } break;
      case 'sums':
        if (run.crossings[run.i]) begin();
        else if (run.t > 0.6) stage('The engineer works out the sums', `for the ${LOADS[run.i].short}`, run.i / LOADS.length);
        break;
      case 'go': {
        if (!cr || !cr.steps.length) { run.phase = 'end'; run.t = 0; break; }
        const L = LOADS[run.i], last = cr.steps[cr.steps.length - 1];
        run.x += SPEED[L.key] * dt;
        // the steps passed: one with breaks in it stops the load there while they play
        while (run.k + 1 < cr.steps.length && cr.steps[run.k + 1].x <= run.x) {
          run.k++;
          const st = cr.steps[run.k];
          if (st.events.length) { run.x = st.x; run.evs = batched(st.events); run.ev = 0; run.evT = 0; run.evStep = 'flash'; run.started = false; run.phase = 'breaks'; break; }
        }
        if (run.phase !== 'go') break;
        if (!cr.made && run.k === cr.steps.length - 1) { run.phase = 'back'; run.t = 0; break; }
        if (cr.made && run.x > last.x + 2) { run.phase = 'across'; run.t = 0; say(acrossLine(L), 2200); sound.chime(); break; }
        aimAt(run.x);
        break;
      }
      case 'breaks':
        if (playBreaks(dt, false)) {
          if (!cr.made && run.k === cr.steps.length - 1) { run.phase = 'back'; run.t = 0; }
          else { run.phase = 'go'; aimAt(run.x); }
        }
        break;
      case 'back':
        // (the deck gave way under it: it turns back to the bank, and the heavier loads don't try)
        loads.back(LOADS[run.i].key, run.t / BACK);
        run.x -= 3 * dt;
        if (run.t >= BACK) { loads.hide(); run.phase = 'end'; run.t = 0; }
        break;
      case 'across': if (run.t >= ACROSS) next(); break;
      case 'blocked': if (run.t >= 2.6) { run.phase = 'end'; run.t = 0; } break;
      case 'end':
        if ((fall.settled() && run.t > 0.4) || run.t > 7) { finish(); return; }
        break;
    }
    if (run.i >= 0 && LOADS[run.i] && loads.shown === LOADS[run.i].key && run.phase !== 'back') {
      const moving = run.phase === 'go' ? SPEED[LOADS[run.i].key] : 0;
      loads.place(LOADS[run.i].key, run.x, deckAt); loads.update(dt, moving);
    } else if (run.phase === 'back' && loads.shown) { loads.place(LOADS[run.i].key, run.x, deckAt); loads.update(dt, 0); }
    draw(dt);
  }
  const ZERO = { x: 0, y: 0, z: 0, clone() { return { ...this }; } };
  // a collapse, many breaks at one spot: the first two play one by one, the rest come down together
  function batched(evs) {
    if (evs.length <= 3) return evs;
    const rest = evs.slice(2), broke = [...new Set(rest.flatMap((e) => e.broke))], fell = [...new Set(rest.flatMap((e) => e.fell))];
    return [...evs.slice(0, 2), { kind: 'collapse', at: rest[0].at, broke, fell, util: rest[0].util, id: rest[0].id, many: rest.length }];
  }
  // the next load: the stage, its figure on the bank (or, with no room for it, a word from the engineer)
  function next() {
    run.i++; run.t = 0; run.k = -1;
    if (run.calm && run.calm.down) { run.phase = 'end'; return; }
    if (run.i >= LOADS.length || (run.i > 0 && run.crossings[run.i - 1] && !run.crossings[run.i - 1].made)) { run.phase = 'end'; return; }
    if (run.crossings[run.i]) begin(); else run.phase = 'sums';
  }
  function begin() {
    const cr = run.crossings[run.i], L = LOADS[run.i];
    // (nothing to cross on, or no way across worked out: no load starts, and the card says what happened)
    if (!cr || !L || (!cr.blocked && !cr.nodeck && !(cr.steps && cr.steps.length))) { run.phase = 'end'; run.t = 0; return; }
    stage(`${L.name} · ${lb(L.lb)}`, `rating ${run.i + 1} of ${LOADS.length}`, (run.i + 1) / LOADS.length);
    if (cr.blocked || cr.nodeck) {
      run.phase = 'blocked'; run.t = 0;
      run.log.push({ i: run.i, blocked: cr.blocked, nodeck: cr.nodeck });
      say(cr.nodeck ? 'There\'s no deck to cross on.' : `No room! The ${L.short} won't fit under that.`, 2600);
      run.focus = cr.blocked || [];
      return;
    }
    // the bending drawn larger: the same gain all the way across this load
    let most = 0; for (const st of cr.steps) for (const id in st.move) for (const e of st.move[id]) most = Math.max(most, Math.abs(e[0]), Math.abs(e[1]), Math.abs(e[2]));
    run.gain = Math.min(BEND_X, BEND_MOST / Math.max(1e-6, most));
    run.x = cr.steps[0].x - APPROACH; run.phase = 'go';
    loads.show(L.key); loads.place(L.key, run.x, deckAt);
    if (run.i === 0) say('Here comes the first one across.', 2200);
  }
  const acrossLine = (L) => ({ person: 'Across, dry feet!', horse: 'The horse made it over!', covered: 'The covered wagon\'s across!', freight: 'Five thousand pounds, and she held!', cattle: 'The whole herd\'s across!' }[L.key]);
  function say(text, ms = 2600) { hooks.say(spellUnits(text), { force: true, times: 99, ms, key: 'call' }); }

  // ── the breaks at one spot, one after another: the first in full, the rest quickly ─────────────────────────────
  // returns true when they have all played
  function playBreaks(dt, calm) {
    run.evT += dt;
    if (run.ev >= run.evs.length || !run.up.size) return true;
    const full = run.ev === 0 ? 0 : 1, ev = run.evs[run.ev];
    if (!run.started) { if (run.evT >= (calm && run.ev === 0 ? 0.8 : 0)) { run.started = true; run.evT = 0; startBreak(ev, run.ev === 0); } return false; }
    if (run.evStep === 'flash' && run.evT >= FLASH[full]) { dropBreak(ev); run.evStep = 'settle'; run.evT = 0; }
    else if (run.evStep === 'settle' && run.evT >= SETTLE[full]) { run.ev++; run.started = false; run.evT = 0; run.evStep = 'flash'; }
    return false;
  }
  function startBreak(ev, lead) {
    const ids = new Set(ev.broke.length ? ev.broke : ev.fell), t0 = performance.now(), dur = FLASH[lead ? 0 : 1] * 1000;
    run.flash = { ids, f: () => { const x = (performance.now() - t0) / dur; return x > 1.6 ? 0 : 0.55 + 0.45 * Math.sin(x * Math.PI * 4) ** 2; } };
    sound.snap(Math.min(1, 0.25 + ev.fell.length / 10));
    if (ev.fell.length >= 8) setTimeout(() => sound.crash(), 120);
    const w = words(ev, run.i);
    run.log.push({ i: run.i, ev, words: w, x: run.x });
    if (lead) { say(w.call, 2400); hooks.gesture('Interact', 1200); }
    // (the colours: what gives at its limit as it gives)
    if (run.target) for (const id of ids) run.target.strain[id] = Math.max(run.target.strain[id] || 0, 1);
  }
  function dropBreak(ev) {
    const before = standingNow(), falling = ev.fell.filter((id) => run.up.has(id));
    for (const id of falling) run.up.delete(id);
    if (falling.length) fall.drop({ tower: before, view: hooks.view(), falling, windDir: ZERO, breakAt: ev.at });
    run.flash = { ids: new Set(ev.broke.filter((id) => run.up.has(id))), f: () => 0 };
    // (and the colours settle to what is left)
    const cr = run.crossings[run.i];
    if (cr && run.k >= 0) aim(cr.steps[run.k]); else if (run.calm) aim(run.calm);
  }
  const standingNow = () => ({ S: run.bridge.S, D: run.bridge.D, boards: [...run.byId.values()].filter((b) => run.up.has(b.id)) });

  // ── the colours and the bending ────────────────────────────────────────────────────────────────────────────────
  function aim(part) { run.target = { strain: { ...(part.strain || {}) }, joints: part.joints || [], move: part.move || {} }; }
  // between two steps: each board's strain and movement in between, the way the load is (before the deck: her own weight)
  function aimAt(x) {
    const cr = run.crossings[run.i]; if (!cr) return;
    const s = cr.steps, k = run.k;
    if (k < 0) { const a = run.calm || s[0], b = s[0], f = smooth(1 - (s[0].x - x) / APPROACH); run.target = mix(a, b, Math.max(0, f)); return; }
    if (k + 1 >= s.length) { aim(s[k]); return; }
    const a = s[k], b = s[k + 1], f = Math.max(0, Math.min(1, (x - a.x) / Math.max(1e-6, b.x - a.x)));
    run.target = mix(a, b.events.length ? preBreak(a, b) : b, f);
  }
  // (the step a break comes at, as the load reaches it: what is about to give, red; the rest as just before)
  function preBreak(a, b) { const strain = { ...a.strain }; for (const ev of b.events.slice(0, 1)) for (const id of ev.broke) strain[id] = Math.max(strain[id] || 0, 1); return { strain, joints: a.joints, move: a.move }; }
  function mix(a, b, f) {
    const strain = {}, move = {};
    for (const id in b.strain) strain[id] = (a.strain[id] ?? b.strain[id]) * (1 - f) + b.strain[id] * f;
    for (const id in b.move) { const p = a.move[id] || b.move[id], q = b.move[id]; move[id] = [0, 1].map((e) => [0, 1, 2].map((c) => p[e][c] * (1 - f) + q[e][c] * f)); }
    return { strain, joints: f < 0.5 ? a.joints : b.joints, move };
  }
  function draw(dt) {
    const T = run.target, k = Math.min(1, dt * 10), g = run.gain || BEND_X;
    for (const id of run.up) {
      const d = run.disp.get(id) || { s: 0, m: [[0, 0, 0], [0, 0, 0]] };
      const s = T && T.strain[id] !== undefined ? T.strain[id] : 0, mv = T && T.move[id];
      d.s += (s - d.s) * k;
      for (let e = 0; e < 2; e++) for (let a = 0; a < 3; a++) { const want = mv ? mv[e][a] * g : 0; d.m[e][a] += (want - d.m[e][a]) * k; }
      run.disp.set(id, d);
    }
    const flashF = run.flash ? run.flash.f() : 0;
    const bendOf = (id) => { const d = run.up.has(id) && run.disp.get(id); return d ? d.m : null; };
    const strainOf = (id) => (run.up.has(id) ? run.disp.get(id)?.s ?? 0 : undefined), flashOf = flashF ? (id) => (run.flash.ids.has(id) ? flashF : 0) : null;
    towerView.setBend(bendOf); deckView.setBend(bendOf);
    towerView.setStrain(strainOf, flashOf); deckView.setStrain(strainOf, flashOf);
    towerView.setSpots(T ? T.joints : [], bendOf, (u) => u);
  }
  // the deck's top at X (feet), as drawn now (its sag drawn larger, as the boards are): the bank's top past the edges,
  // a short ramp up onto the deck
  function deckAt(X) {
    const br = run.bridge, h = br.S / 2; if (!br.deck) return 0;
    const top = br.deck.y + TOP;
    if (Math.abs(X) > h + 1) return 0;
    if (Math.abs(X) > h) return top * (h + 1 - Math.abs(X));
    // (the planks either side of X: how far they have sagged, as drawn)
    let best = null, d0 = Infinity;
    for (const p of br.deck.planks) { if (!run.up.has(p.id)) continue; const dd = Math.abs(p.X - X); if (dd < d0) { d0 = dd; best = p; } }
    const m = best && run.disp.get(best.id);
    return top + (m ? (m.m[0][1] + m.m[1][1]) / 2 : 0);
  }

  // ── the end: the card ───────────────────────────────────────────────────────────────────────────────────────────
  function finish() {
    run.done = true; app.phase = 'result';
    $('stage').hidden = true; $('legend').hidden = true;
    towerView.setStrain(null); towerView.setSpots(null); towerView.setBend(null); deckView.setStrain(null); deckView.setBend(null);
    towerView.nailsFor(new Set([...run.up]));
    loads.hide();
    const br = run.bridge, rating = run.rating, L = rating >= 0 ? LOADS[rating] : null;
    const { best, newBest } = hooks.record(rating, br.S);
    const paid = hooks.pay ? hooks.pay(rating) : null;
    const gold = paid ? paid.gold : L ? L.gold : 0;
    const cw = hooks.words || ((s) => s);
    const crs = run.crossings.filter(Boolean), last = crs[crs.length - 1];
    const sag = L ? crs[rating].sag : 0;
    const told = adviceOf();
    const story = cw(spellUnits(storyOf())), advice = cw(spellUnits(told.advice)), focusIds = told.focus || [];
    const all = rating === LOADS.length - 1;
    const anyFell = [...run.byId.keys()].some((id) => !run.up.has(id));
    const title = all ? 'She carried every load!' : L ? `She carried the ${L.short}!` : anyFell ? 'Down she came!' : last && last.blocked ? 'No room to cross!' : 'Nothing crossed.';
    // what came down: boards that fell whole go back on the pile; snapped ones are kindling; planks go back on theirs
    const fellIds = [...run.byId.keys()].filter((id) => !run.up.has(id));
    const snapped = new Set(); for (const Lg of run.log) if (Lg.ev && (Lg.ev.kind === 'snap' || Lg.ev.kind === 'buckle' || Lg.ev.kind === 'bow' || Lg.ev.kind === 'collapse')) Lg.ev.broke.forEach((id) => snapped.add(id));
    const boardsFell = fellIds.filter((id) => !run.byId.get(id).plank), planksFell = fellIds.filter((id) => run.byId.get(id).plank);
    const back = boardsFell.filter((id) => !snapped.has(id)).map((id) => run.byId.get(id).len), kindling = boardsFell.length - back.length;
    const planksBack = planksFell.filter((id) => !snapped.has(id)).length;
    run.card = { title, story, advice, focusIds, rating, gold, sag, back: back.length, kindling, planksBack };
    const badges = LOADS.map((l, i) => `<span class="rt${i <= rating ? ' is-made' : crs[i] ? ' is-failed' : ''}" title="${l.name}: ${lb(l.lb)}">${i <= rating ? '✓ ' : ''}${l.short}</span>`).join('');
    const card = $('result'); card.classList.add('is-side'); card.classList.remove('is-folded');
    card.innerHTML = `<button class="fold" id="r-fold" aria-label="Fold the card down" title="Fold the card down"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
      <h2>${title}</h2><div class="ratings">${badges}</div><p class="sub" data-focus="${focusIds.join(' ')}">${story}</p>
      <div class="stat"><div><small>Carried</small><div class="big">${L ? lb(L.lb) : '0 lb'}</div></div><div><small>Gap</small><div class="big">${units(lenLabel(br.S))}</div></div><div><small>Sag</small><div class="big">${L ? units(sagLabel(sag)) : '–'}</div></div></div>
      <div class="sacks">${COIN}<div><b>${paid ? paid.line : gold ? `The engineer pays ${gold} gold` : 'No pay this time'}</b><br><small>${paid ? paid.sub : gold ? `for carrying the ${L.short}${newBest ? ': a new best!' : ''}` : 'Get a person across for the first pay'}</small></div></div>
      <p class="miller" data-focus="${focusIds.join(' ')}">"${advice}"</p>
      ${fellIds.length && run.up.size ? `<p class="pile-note">${pileNote(back.length, kindling, planksBack)}</p>` : ''}
      <div class="foot"><p class="copy-row"><button class="btn small" id="r-copy" title="Copies a code for this bridge, to send it to someone">Copy this bridge</button> <small id="r-copied"></small></p>
      <div class="row">${!run.up.size ? '<button class="btn go" id="r-again">Try again</button>' : '<button class="btn" id="r-fresh">Start fresh</button><button class="btn go" id="r-keep">Keep building</button>'}</div></div>`;
    card.hidden = false;
    const again = $('r-again'), keep = $('r-keep'), fresh = $('r-fresh');
    $('r-fold').onclick = () => { const f = card.classList.toggle('is-folded'); $('r-fold').setAttribute('aria-label', f ? 'Open the card' : 'Fold the card down'); };
    // (the link opens the bridge lab with this bridge put up, wherever the builder is: the lab page or the game)
    const code = encodeBridge(br), link = new URL('./index.html', import.meta.url).href + '?bridge=' + code;
    $('r-copy').onclick = async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(link); ok = true; } catch (e) { /* (no clipboard here: shown to copy by hand) */ }
      if (!ok) window.prompt('Copy this link:', link);
      $('r-copied').textContent = ok ? 'Copied: paste it in a message' : '';
    };
    const keepIds = new Set([...run.up]);
    if (again) again.onclick = () => { card.hidden = true; end(); hooks.fresh(advice); };
    if (fresh) fresh.onclick = () => { card.hidden = true; end(); hooks.fresh('Fresh lumber\'s stacked by the bank.'); };
    if (keep) keep.onclick = () => { card.hidden = true; end(); hooks.keep({ keep: keepIds, back, planksBack, kindling }); };
    run.after = run.up.size ? { keep: { keep: keepIds, back, planksBack, kindling } } : { fresh: true };
    if (hooks.done) hooks.done(run.card);
  }
  const sagLabel = (ft) => { const inch = ft * 12; return inch < 0.1 ? 'under ⅛ in.' : inch < 1 ? `${(Math.round(inch * 8) / 8).toString().replace(/^0\./, '.')} in.`.replace('.125', '⅛').replace('.25', '¼').replace('.375', '⅜').replace('.5', '½').replace('.625', '⅝').replace('.75', '¾').replace('.875', '⅞') : lenLabel(ft); };
  const units = (txt) => txt.replace(/ ?(ft|in\.?)(?![a-z])/g, '<span class="u"> $1</span>');
  const pileNote = (n, k, p) => cap([n ? `${n === 1 ? 'the board' : `the ${n} boards`} that fell whole ${n === 1 ? 'goes' : 'go'} back on your pile` : '', k ? `${k === 1 ? 'the one' : k} that snapped ${k === 1 ? 'is' : 'are'} kindling` : '', p ? `${p} deck plank${p === 1 ? '' : 's'} back on the plank pile` : ''].filter(Boolean).join('; ') + ' if you keep building.');
  function end() { run = null; fall.clear(); loads.hide(); }

  // ── words ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // the story, load by load: "A person (180 lb) crossed. Horse and rider (1,300 lb): with its front 9 feet out, the
  // diagonal on the front near the east bank pulled its nails, and 6 boards fell into the river."
  function storyOf() {
    const out = [], br = run.bridge;
    const still = run.log.filter((Lg) => Lg.i === -1 && Lg.ev);
    if (still.length) out.push(`Before anything crossed, ${still[0].words.what}${fellTail(still)}, under her own weight.`);
    for (let i = 0; i < run.crossings.length; i++) {
      const cr = run.crossings[i]; if (!cr) continue;
      const L = LOADS[i], head = `${L.name} (${lb(L.lb)})`;
      if (cr.nodeck) { out.push(`${head}: there was no deck to cross on.`); continue; }
      if (cr.blocked) { const b = run.byId.get(cr.blocked[0]); out.push(`${head}: no room. ${cap(placeWords(br, b))} was in the way.`); continue; }
      const breaks = run.log.filter((Lg) => Lg.i === i && Lg.ev);
      if (cr.made) { out.push(breaks.length ? `${head} crossed, though ${breaks[0].words.what}.` : `${head} crossed.`); continue; }
      // (where the load's weight was: its middle, by its weights, from the west bank)
      const xs = (breaks[0] ? breaks[0].x : cr.stopAt), mid = L.parts.reduce((m, p) => m + p.dx * p.lb, 0) / L.parts.reduce((m, p) => m + p.lb, 0);
      const at = Math.round((xs + mid + br.S / 2) * 2) / 2, who = L.key === 'person' ? 'the walker' : L.key === 'cattle' ? 'the herd' : L.key === 'horse' ? 'the horse' : 'the wagon';
      const spot = at <= 0.5 ? `with ${who} just coming onto the deck` : at >= br.S - 0.5 ? `with ${who} almost across` : Math.abs(at - br.S / 2) < 1 ? `with ${who} in the middle` : `with ${who} ${lenWords(at)} out`;
      out.push(`${head}: ${spot}, ${breaks[0] ? breaks[0].words.what : 'the deck under it was gone'}${fellTail(breaks)}. It turned back to the bank.`);
    }
    return out.join(' ');
  }
  // (what fell with it: boards, and deck planks counted on their own)
  function fellTail(breaks) {
    const named = new Set(breaks[0] ? breaks[0].ev.broke : []), ids = new Set(breaks.flatMap((Lg) => Lg.ev.fell.filter((id) => !named.has(id))));
    const k = [...ids].filter((id) => run.byId.get(id) && run.byId.get(id).plank).length, n = ids.size - k;
    const parts = [n ? `${n} more board${n === 1 ? '' : 's'}` : '', k ? `${k} deck plank${k === 1 ? '' : 's'}` : ''].filter(Boolean);
    return parts.length ? `, and ${parts.join(' and ')} fell into the river` : '';
  }
  // what to change, from the break that stopped the heaviest load (else how close she came)
  function adviceOf() {
    const crs = run.crossings.filter(Boolean), last = crs[crs.length - 1], br = run.bridge;
    if (last && last.nodeck) return { advice: 'Lay the deck first: horizontal boards from bank to bank on both sides, then "Lay the deck".' };
    if (last && last.blocked) {
      const L = LOADS[crs.length - 1], b = run.byId.get(last.blocked[0]);
      return { advice: `The ${L.short} is ${lenWords(L.wide)} wide and ${lenWords(L.tall)} tall, and ${placeWords(br, b)} is in its way. Take it down, or put it higher than ${lenWords(L.tall)} above the deck, or brace the sides below the deck instead.`, focus: last.blocked.slice(0, 6) };
    }
    // (the first break under the load that turned back; else one under her own weight; else one a load came through)
    const first = (last && !last.made && run.log.find((Lg) => Lg.ev && Lg.i === crs.length - 1)) || run.log.find((Lg) => Lg.ev && Lg.i === -1);
    if (first) return { advice: first.words.advice, focus: first.words.focus };
    const passed = run.log.find((Lg) => Lg.ev);
    if (passed && rating() < LOADS.length - 1) return { advice: passed.words.advice, focus: passed.words.focus };
    // everything it tried, it carried: how close she came under the heaviest
    const peak = last && last.peak;
    if (rating() === LOADS.length - 1) return { advice: `Now that's a bridge. She carried the whole herd${closeWords(peak)}.`, focus: peak && peak.id ? [peak.id] : [] };
    return { advice: `Good and stout${closeWords(peak)}.`, focus: [] };
  }
  const rating = () => run.rating;
  function closeWords(p) {
    if (!p || !p.id || p.util < 0.6) return '';
    const b = run.byId.get(p.id), pct = Math.round(p.util * 100), name = b ? placeWords(run.bridge, b) : 'a board';
    return p.kind === 'nails' || p.kind === 'toe' || p.kind === 'butt' ? `: the nails holding ${name} were at ${pct}% of what they hold` : p.kind === 'slide' ? `: the foot of ${name} came within ${100 - pct}% of sliding`
      : p.kind === 'bow' ? `: she came within ${100 - pct}% of bowing out sideways` : `: ${name} was at ${pct}% of what it holds`;
  }
  // one break in words: { call (the engineer's shout), what (for the story), advice, focus (the boards it is about) }
  function words(ev, li) {
    const br = run.bridge, L = LOADS[li] || null, b = ev.id ? run.byId.get(ev.id) : ev.broke[0] ? run.byId.get(ev.broke[0]) : null;
    const role = b ? roleOf(br, b) : 'board', place0 = b ? placeWords(br, b) : 'a board', focus = ev.broke.length ? ev.broke : ev.fell;
    // (mid-sentence, a place with a comma in it closes with one: "the board on the front, 4 feet out, pulled out")
    const place = place0, placeMid = /,/.test(place0) ? place0 + ',' : place0;
    const under = L ? ` under the ${L.short}` : '';
    switch (ev.kind) {
      case 'snap':
        if (role === 'deck plank') return { call: 'A plank cracked!', what: `a deck plank cracked${under}`, focus,
          advice: 'A deck plank cracked: the hooves and wheels pressed on its middle, with the full width of the bridge between the boards under it. Run a horizontal board along the middle of the bridge, at the height of the bottom boards, so the planks rest on it too and span half as far.' };
        if (/horizontal|bottom|top|cross/.test(role)) return { call: `The ${role} snapped!`, what: `${placeMid} snapped${under}`, focus,
          advice: `${cap(placeMid)} was carrying the weight by bending, with nothing holding it up close by. Put a post or a diagonal under that spot so it makes a triangle: then the boards pull and push instead of bending, and they are many times stronger that way.` };
        return { call: `The ${role} snapped!`, what: `${placeMid} snapped`, focus,
          advice: `${cap(placeMid)} bent until it snapped: something pushed on its middle. Nail its ends right where other boards meet, so it pushes or pulls straight along itself.` };
      case 'buckle': return { call: `The ${role} buckled!`, what: `${placeMid} buckled under the squeeze`, focus,
        advice: `${cap(placeMid)} was squeezed end to end until it bowed out and buckled: a long board being squeezed bends out sideways, and the longer it is, the sooner. Shorten it: nail a post or a diagonal to its middle, or put a second board alongside to share the squeeze.` };
      case 'bow':
        // (what bows is the slanted boards pushing up from the banks: each a long board squeezed end to end)
        if (b && Math.abs(b.a.Y - b.b.Y) > 0.5) {
          const n = (ev.ids || []).length;
          return { call: 'The struts are bowing!', what: `${n > 1 ? `${placeMid} and the struts beside it` : placeMid} bowed out sideways under the squeeze${under}`, focus: ev.ids && ev.ids.length ? ev.ids : focus,
            advice: `${cap(placeMid)} pushes up from the bank, squeezed end to end. A long board squeezed that hard bows out sideways in the middle, the way a ruler does when you push its ends together. Nail a board across the struts halfway along, so each one is only half as long to bow, and they hold far more.` };
        }
        return { call: 'She\'s bowing out sideways!', what: `the bridge bowed out sideways${under}`, focus: ev.ids && ev.ids.length ? ev.ids : focus,
        advice: 'The squeezed boards bowed out sideways, and the bridge leaned over like a card table folding. Nothing held the two sides square across the bridge. Brace across it: a diagonal from one side to the other, under the deck or overhead out of the way, so the sides make triangles that way too.' };
      case 'nails': {
        // (a board already crossed by another through both middles: its panel has its X, so more of them, closer)
        const crossed = b && [...run.byId.values()].some((o) => o !== b && !o.plank && crossesMid(o, b));
        return { call: 'The nails pulled out!', what: `the nails holding ${placeMid} pulled out`, focus,
          advice: crossed ? `The nails at that joint pulled out: ${placeMid} carried more than its three nails hold there (about 750 pounds), even with its panel crossed in an X. Spread the load over more boards: diagonals every foot or two (a lattice), so each joint carries less.`
            : `The nails at that joint pulled out: ${placeMid} carried more than its three nails hold there (about 750 pounds). Share the load: add a second diagonal across that panel to make an X, or more boards meeting at that joint, so each one carries less.` };
      }
      case 'toe':
        if (role === 'deck plank') return { call: 'A plank pulled loose!', what: `a deck plank's nails pulled out of the board under it${under}`, focus,
          advice: 'A deck plank pulled loose from the board it rests on: the boards under the deck twisted or sagged away from it. Stiffen the bottom boards: diagonals and posts that hold them up close together.' };
        return { call: 'Toe-nails pulled out!', what: `the toe-nails holding ${place} pulled out`, focus,
          advice: `${cap(place)} only rested its end on the side of another board, held by a few slanted nails. Lap it onto the other board's face instead, so it is nailed straight through, or set it on top.` };
      case 'butt': return { call: 'That joint pulled apart!', what: 'two boards butted end to end pulled apart', focus,
        advice: 'Two boards butted end to end pulled apart: an end only touching an end hardly holds. Lap them side by side a foot or more and nail them together.' };
      case 'hinge': return { call: 'A joint twisted loose!', what: `the nails holding ${placeMid} twisted loose, and it turns on them now`, focus,
        advice: 'The nails at a corner twisted loose, and the boards turned like a gate on its hinges: a square with no diagonal folds. A diagonal corner to corner makes two triangles, and a triangle can\'t fold.' };
      case 'slide': {
        // (where it rests on the stone, said as that: "the end of the bottom board ... resting on the west stone's top")
        const stone = `the ${ev.bank > 0 ? 'east' : 'west'} stone's ${ev.face ? 'wall' : 'top'}`;
        return { call: 'Her foot slid!', what: `the end of ${placeMid} resting on ${stone} slid along it, and what it held came loose`, focus: ev.slid || focus,
          advice: ev.face ? `The end of ${place} slid along ${stone}: it only pressed on the wall sideways. Set a pushing board's end square into the wall, so it pushes straight into the stone.`
            : `The end of ${place} slid along ${stone}: on the flat top only rubbing holds it. Set a pushing board's foot in a notch in the stone wall, below the top, so it pushes into the stone, or tie the two banks' boards together across the middle so they hold each other.` };
      }
      case 'loose': return { call: 'That wasn\'t held by anything!', what: 'some boards were not held by anything that reaches a bank, and fell', focus,
        advice: 'Every board has to be nailed to something that reaches a bank. One held by nothing just falls.' };
      case 'collapse': return { call: 'She\'s coming down!', what: 'the rest gave way', focus, advice: 'Down she came. Triangles spread the load, so no one board takes it all.' };
      default: return { call: 'Something gave!', what: 'something gave way', focus, advice: 'Something gave. Triangles spread the load best.' };
    }
  }

  function state() {
    if (!run) return null;
    const cr = run.crossings[run.i];
    return { phase: run.phase, i: run.i, load: LOADS[run.i] ? LOADS[run.i].key : null, x: +run.x.toFixed(2), k: run.k, rating: run.rating, up: run.up.size, falling: fall.sticks.length,
      have: run.crossings.map((c) => !!c), made: run.crossings.map((c) => (c ? c.made : null)), card: run.card || null, ms: Math.round(performance.now() - run.t0),
      breaks: run.log.filter((Lg) => Lg.ev).map((Lg) => ({ i: Lg.i, kind: Lg.ev.kind, broke: Lg.ev.broke, fell: Lg.ev.fell.length, call: Lg.words.call, x: Lg.x })),
      shown: [...run.up].slice(0, 300).map((id) => [id, +(run.disp.get(id)?.s ?? 0).toFixed(3)]), steps: cr ? cr.steps.length : 0 };
  }
  // the card's choice made without a tap (the builder put away with the card up): what its main button does, as plain
  // data for the builder to carry out -> { keep: {...} } (what fell taken away) or { fresh: true }, or null (no card)
  function settle() {
    if (!run || !run.done || !run.after) return null;
    const a = run.after; $('result').hidden = true; end(); return a;
  }
  function dispose() { run = null; current = null; try { if (worker) worker.terminate(); } catch (e) { /* gone */ } worker = null; }
  return { start, frame, state, settle, dispose, get running() { return !!run && !run.done; }, get card() { return (run && run.card) || null; }, get result() { return run ? { calm: run.calm, crossings: run.crossings, rating: run.rating } : null; } };
}

const COIN = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#f0c24a" stroke="#8a6414" stroke-width="2"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="#b8891f" stroke-width="1.5"/><text x="16" y="20.5" text-anchor="middle" font-size="11" font-family="Smokum, Georgia, serif" fill="#7a5410">G</text></svg>';
