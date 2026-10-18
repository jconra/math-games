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
//     that cost the most height (the wind is a stage, as the story tells it). Then: "Keep building" (what stands stays,
//     the boards that came down whole go back on the pile, snapped ones are kindling) or "Start fresh"; with nothing
//     left standing, "Try again".
//   * Walls that LEAN: the words know a leg from a post (a corner leg leaning with two walls), name a storey by where its
//     legs stand, and say what a leaning wall the wind blew along was doing when it folded with no brace: its legs
//     drawing together as they climb (that helps, but legs only hold a wall square where they meet at a point), drawing
//     apart (leaning out: it folds sooner), or the whole wall tipped over (that braces nothing). A lean-out tower that
//     tips caught the wind high up on its wide top; a tower on leaning legs just short of 16 ft hears why (a leaning leg
//     reaches less high than it is long). A tower with nothing leaning is worded as before walls could lean.
//   * THE CARD'S OBJECT (CONTRACT with main.js / tower3d.js): when the card opens, testRun.card (also state().card, and
//     hooks.cardOpen(card) if main.js gives that hook) is
//       { title, story, advice, focusIds, h, sacks, back, kindling }
//     focusIds: the ids of the boards the card's main sentence and its advice are about (the posts that stood on
//     nothing, the legs of the level that racked, the board that snapped or pulled its nails...), for the page to make
//     glow on the tower while the card is open. Absent or empty: none (a tower that tipped is the whole tower; a tower
//     that stood with nothing near its limit). Some of them may have fallen: they lie in the fallen pile. The story and
//     advice paragraphs carry the same ids in data-focus (space-separated), for rigs to read; nothing taps them: the
//     page (main.js) keeps those boards glowing the whole time the card is open.
//   * The words: "level" for a storey or tier ("a narrower level" for a tier set in on horizontal boards), horizontal /
//     vertical for a board's direction, lengths spelled out in sentences ("1 foot 7 inches"), boards named by where they
//     are ("the 4 short posts at the back, 15½ feet up"), never by a footprint's size. A tower that TIPPED went over in
//     one piece, base and all, and the card says so: posts that stood on nothing are blamed only when they gave way
//     themselves or the break was up where they stand (nofootCause).
//
// main.js wires it: makeTestRun(app, hooks) with the view, the fall, the miller's voice, the camera's watching spot,
// the best record and what the buttons do (see `hooks` below). frame(dt) runs every animation frame.
import { STAGES, boardRole } from './frame.js';
import { towerHeight, planeName, planeSegments, planeKey, planeKeyOf, parseKey, planesOf, faceOfPlane, isPost, MAX_W, floorsAcross, wallsInUse, isCornerLine, offsetAt, wallSpan, lenWords, lenLabel, spellUnits, isTurnedFam, famOfKey } from './tower.js';
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
// from one side of its wall to the other instead, so it is not one. Given the tower (and its walls in use), a LEG does
// a post's job too, however it leans, in or out: the line where two walls meet (a tapered tower's corner leg).
function postLike(b, tower = null, walls = null) {
  if (isUprightB(b)) return true;
  if (tower && walls && isCornerLine(tower, b, walls)) return true;
  if (Math.hypot(b.b.X - b.a.X, b.b.Z - b.a.Z) > 0.375 * (b.len || 1)) return false;
  const [f, t] = b.a.Y <= b.b.Y ? [b.a, b.b] : [b.b, b.a];
  return ['X', 'Z'].every((c) => Math.abs(t[c] - f[c]) < 0.01 || ((Math.abs(t[c]) < 0.01 || Math.sign(t[c]) === Math.sign(f[c])) && Math.abs(t[c]) < Math.abs(f[c])));
}
// where a board is at height y (its X and Z there)
const atHeight = (b, y) => { const k = Math.abs(b.b.Y - b.a.Y) < 1e-9 ? 0 : Math.max(0, Math.min(1, (y - b.a.Y) / (b.b.Y - b.a.Y))); return { X: b.a.X + (b.b.X - b.a.X) * k, Z: b.a.Z + (b.b.Z - b.a.Z) * k }; };
const heightOf = (boards) => boards.reduce((h, b) => Math.max(h, b.a.Y, b.b.Y), 0);
const andList = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
// THE WORDS (every kid-facing line here): a storey or a tier is a "level" (a tier set in on horizontal boards is "a
// narrower level"); a board's direction is "horizontal" or "vertical", never "level"; boards are posts (vertical), legs
// (leaning posts), braces (slanting) and horizontal boards (the frame's crosspieces and beams); lengths in a sentence
// are spelled out ("1 foot 7 inches"), on a label "1 ft 7 in." (tower.js lenWords, lenLabel). Boards are named by WHERE
// they are ("the 4 short posts at the back, 15½ feet up"), never by a footprint's size.
// a height in a sentence, to the half foot: "12 feet up"
const upWords = (y) => `${lenWords(Math.round(y * 2) / 2)} up`;
// the frame's names for boards (frame.js boardRole, its event texts), in the words the player knows
const kidText = (txt) => spellUnits(String(txt).replace(/\b(a|the|that) (?:beam|crosspiece)\b/g, '$1 horizontal board').replace(/\b(beam|crosspiece)s\b/g, 'horizontal boards')
  .replace(/\bno beam\b/g, 'no horizontal board').replace(/\bstoreys?\b/g, (m) => (m.endsWith('s') ? 'levels' : 'level')));
// Which side of the tower a set of boards stands on, from their middles: "back", "front left", "left", or "middle"
// (all of them near the middle), or '' (spread across it).
function sideOf(bs, t) {
  const mid = bs.map((b) => ({ X: (b.a.X + b.b.X) / 2, Z: (b.a.Z + b.b.Z) / 2 })), all = (f) => mid.length && mid.every(f), e = 0.05;
  const fb = all((p) => p.Z > e) ? 'front' : all((p) => p.Z < -e) ? 'back' : '', lr = all((p) => p.X > e) ? 'right' : all((p) => p.X < -e) ? 'left' : '';
  if (fb || lr) return [fb, lr].filter(Boolean).join(' ');
  return all((p) => Math.abs(p.X) < t.W / 4 + e && Math.abs(p.Z) < t.D / 4 + e) ? 'middle' : '';
}
const atSide = (side) => (!side ? '' : side === 'middle' ? ' in the middle' : /^(front|back)/.test(side) ? ` at the ${side}` : ` on the ${side}`);
// a set of boards named by where they are: { head: "the 4 short posts at the back", up: "15½ feet up" (or '' on the
// ground), noun: 'post' } -> say(g) "the 4 short posts at the back, 15½ feet up"; mid-sentence, said(g, true) closes it
// with a comma. legs: the boards that are legs.
function groupOf(bs, t, legs = () => false) {
  const n = bs.length, noun = bs.every((b) => legs(b)) ? 'leg' : bs.every((b) => isUprightB(b) || legs(b)) ? (bs.some(legs) ? 'leg' : 'post')
    : bs.every(isLevelB) ? 'horizontal board' : bs.every((b) => !isLevelB(b) && !isUprightB(b)) ? 'brace' : 'board';
  const short = /post|leg/.test(noun) && bs.every((b) => (b.len || 8) <= 4.5) ? 'short ' : '';
  const y = Math.min(...bs.map(lo));
  const head = `the ${n > 1 ? n + ' ' : ''}${short}${noun}${n > 1 ? 's' : ''}${atSide(sideOf(bs, t))}`;
  return { head, up: y > 0.3 ? upWords(y) : '', noun, n };
}
const said = (g, mid = false) => (g.up ? `${g.head}, ${g.up}${mid ? ',' : ''}` : g.head);
// sides of the tower in a list: "its front and back", "its right and left sides", "its front and right side"
const sidesList = (names) => (names.length > 1 && names.every((x) => / side$/.test(x)) ? andList(names.map((x) => x.replace(/ side$/, ''))) + ' sides' : andList(names));
// Walls that LEAN: does the tower have any? A tower with none is worded exactly as before walls could lean (the words
// below keep that path apart). A leg: a board that is not straight up and lies where two walls meet, leaning with them.
const anyLeans = (walls) => [...walls].some((k) => parseKey(k).k !== 0);
const isLegB = (t, b, walls) => !isPost(b) && isCornerLine(t, b, walls);
// The wall of one family (axis 'Z': walls like the front; 'X': like the sides) that the posts and legs standing at s
// across that family (at height Y) lie in: the one most of them share (a leaning wall's own key), else the upright
// wall there. posts: boards doing a post's job.
function wallAt(posts, axis, s, Y, walls) {
  const n = new Map();
  for (const p of posts) {
    const q = atHeight(p, Y); if (Math.abs((axis === 'Z' ? q.Z : q.X) - s) > 0.1) continue;
    const k = planesOf(p).find((x) => x[0] === axis && walls.has(x)); if (k) n.set(k, (n.get(k) || 0) + 1);
  }
  let best = null; for (const [k, c] of n) if (!best || c > n.get(best)) best = k;
  return best || planeKey(axis, s);
}

// hooks: {
//   towerView, fall (tower3d.js and fall.js), say(text, opts), gesture(name, ms), hideSay(),
//   viewAz() (where the camera stands round the tower now), watch({ az, miller }) (the camera's watching spot and the
//   miller's place, upwind), record(height, W, D) -> { best, newBest } (the best height and its base),
//   showHead(tower) (the windmill head and sails on what stands), keep({ keep: Set of ids, back: [lengths], kindling })
//   (Keep building), fresh(line) (a fresh yard, the miller saying line), cardOpen(card) (optional: the card just opened,
//   with its focusIds: see THE CARD'S OBJECT above) }
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
    if (lead || ev.kind === 'tip') { hooks.say(spellUnits(w.call), { force: true, times: 99, ms: 2600, key: 'call' }); hooks.gesture(ev.fell.length >= 4 ? 'HitRecieve' : 'Interact', 1200); }
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
    const sacks = flourFor(h), story = spellUnits(storyOf()), told = adviceOf(), advice = spellUnits(told.advice), focusIds = told.focus || [];
    // (something gave but she still stands to her full height: "She stood, but something gave"; only a tower where
    // nothing at all gave is "She stood!")
    const whole = !nothing && h >= run.h0 - 0.01, sails = h >= TARGET_FT ? ' Sails up!' : '';
    const title = r.stood ? 'She stood!' + sails : whole ? 'She stood, but something gave.' + sails
      : nothing ? 'Down she came!' : `${lenLabel(h)} still standing!` + sails;
    // what came down: whole boards go back on the pile, snapped ones are kindling
    const fellIds = run.tower.boards.filter((b) => !standing.boards.some((s) => s.id === b.id)).map((b) => b.id);
    const snapped = new Set(); for (const L of run.log) if (L.ev.kind === 'snap' || L.ev.kind === 'buckle') L.ev.broke.forEach((id) => snapped.add(id));
    const back = fellIds.filter((id) => !snapped.has(id)).map((id) => run.byId.get(id).len), kindling = fellIds.length - back.length;
    run.card = { title, story, advice, focusIds, h, sacks, back: back.length, kindling };
    const card = $('result'); card.classList.add('is-side'); card.classList.remove('is-folded');
    card.innerHTML = `<button class="fold" id="r-fold" aria-label="Fold the card down" title="Fold the card down"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
      <h2>${title}</h2><p class="sub" data-focus="${focusIds.join(' ')}">${story}</p>
      <div class="stat"><div><small>Left standing</small><div class="big">${units(fmt(h))}</div></div><div><small>Base</small><div class="big">${units(fmtBase(W, D, true))}</div></div><div><small>Best</small><div class="big">${units(fmt(best.height))}</div></div></div>
      <div class="sacks">${SACK}<div><b>The miller pays ${sacks} sack${sacks === 1 ? '' : 's'} of flour</b><br><small>${newBest && h > 0 ? `A new best height, with the stones ${fmtBase(W, D)}!` : 'A sack for every foot left standing' + (h >= TARGET_FT ? ', and five more for the sails' : '')}</small></div></div>
      <p class="miller" data-focus="${focusIds.join(' ')}">"${advice}"</p>
      ${!nothing && fellIds.length ? `<p class="pile-note">${pileNote(back.length, kindling)}</p>` : ''}
      <div class="row">${nothing ? '<button class="btn go" id="r-again">Try again</button>' : '<button class="btn" id="r-fresh">Start fresh</button><button class="btn go" id="r-keep">Keep building</button>'}</div>`;
    card.hidden = false;
    if (hooks.cardOpen) hooks.cardOpen(run.card);
    const again = $('r-again'), keep = $('r-keep'), fresh = $('r-fresh');
    // (on a phone: fold the card down to its title and buttons, to see the tower, and open it again)
    $('r-fold').onclick = () => { const f = card.classList.toggle('is-folded'); $('r-fold').setAttribute('aria-label', f ? 'Open the card' : 'Fold the card down'); };
    const keepIds = new Set(standing.boards.map((b) => b.id));
    if (again) again.onclick = () => { card.hidden = true; end(); hooks.fresh(advice); };
    if (fresh) fresh.onclick = () => { card.hidden = true; end(); hooks.fresh('Fresh lumber\'s on the sawhorses.'); };
    if (keep) keep.onclick = () => { card.hidden = true; end(); hooks.keep({ keep: keepIds, back, kindling }); };
  }
  // (the card's big numbers with their units small, as the stats bar has them, so "15 ft 11 in" keeps to one line; the
  // space stays in the text, so it still reads "15 ft 11 in")
  const units = (txt) => txt.replace(/ ?(ft|in\.?)(?![a-z])/g, '<span class="u"> $1</span>');
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
    const flushHeld = () => { if (held.length) out.push(`${cap(andList(held.map((n, i) => (i ? n.toLowerCase() : n))))}: ${gave ? `the rest held (${lenWords(hNow)})` : 'she held'}.`); held = []; };
    const tell = (label, breaks) => {
      const { cause, lead } = causeOf(breaks), left = breaks[breaks.length - 1].after;
      const then = lead !== cause && lead.ev.fell.length ? `, then ${lead.words.base}` : '';
      const named = new Set([...cause.ev.broke, ...(then ? lead.ev.broke : [])]);
      const extra = ['tip', 'loose'].includes(cause.ev.kind) ? 0 : breaks.reduce((n, L) => n + L.ev.fell.filter((id) => !named.has(id)).length, 0);
      const more = breaks.length - 1 - (then ? 1 : 0);
      const all = breaks.reduce((n, L) => n + L.ev.fell.length, 0);
      const rest = nofootCause(cause.ev) && all ? `: ${all} board${all === 1 ? '' : 's'} came down`
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
  // Did posts standing on nothing cause this break? An event names the posts that stood on nothing (frame.js nofoot)
  // whenever they come down in it, even when something else brought them down. They are what to talk about only when
  // they gave way themselves (among what broke), or in still air, or when the break was up where they stand (their
  // level folding). Not when the whole tower tipped, or the levels under them gave way: then the card says that.
  function nofootCause(ev) {
    if (!ev.nofoot || !ev.nofoot.length || ev.kind === 'tip') return false;
    if (ev.calm || ev.broke.some((id) => ev.nofoot.includes(id))) return true;
    const feet = ev.nofoot.map((id) => run.byId.get(id)).filter(Boolean).map(lo);
    return !!feet.length && ev.at.Y >= Math.min(...feet) - 0.5;
  }
  // In the breaks of one wind (or of still air): the cause (a break naming posts that stood on nothing, else the first)
  // and the lead (the first that brought boards down, else the first): the one played in full, with the miller's call.
  function causeOf(breaks) {
    const cause = breaks.find((L) => nofootCause(L.ev)) || breaks[0];
    const lead = breaks.find((L) => L.ev.fell.length && !L.ev.note) || breaks[0];
    return { cause, lead };
  }
  // the miller's advice: about the wind that cost the most height (the first, on a tie), told from what started it;
  // a tower that stood hears how close it came. (A wind: a stage, as the story tells it, so the advice is about the
  // clause the story tells for it: the big gust's first break, not a brace left standing alone that blew off later in
  // the same stage from another side.)
  function adviceOf() {
    const r = run.result, h = r.height;
    if (!run.log.length) {
      // (a tower on leaning legs just short of the mark: a leg that leans reaches less high than it is long, the math
      // of the slope questions; 8 ft legs leaning 1½ in a foot both ways stand 7 ft 10½ in)
      const WS = wallsInUse(run.tower), short = Math.round((TARGET_FT - h) * 12);
      const legs = h < TARGET_FT && short <= 6 && short > 0 && run.tower.boards.some((b) => isLegB(run.tower, b, WS));
      const top = h >= TARGET_FT ? 'Now that\'s a windmill. She\'ll grind flour all summer.'
        : legs ? `Good and stout, and only ${short} inch${short === 1 ? '' : 'es'} short of ${TARGET_FT} feet: a leg that leans reaches a little less high than it is long. Reach ${TARGET_FT} feet and I'll put the sails on her.`
          : `Good and stout. Reach ${TARGET_FT} feet and I'll put the sails on her.`;
      const near = closeCall();
      return { advice: top + near.words, focus: near.focus };
    }
    let worst = null, most = -1;
    const groups = new Map();
    for (const L of run.log) { const key = L.ev.calm ? 'calm' : L.gust.stage; (groups.get(key) || groups.set(key, []).get(key)).push(L); }
    for (const in1 of groups.values()) {
      const lost = in1[0].before - (in1[in1.length - 1].after ?? in1[0].before);
      if (lost > most + 0.01) { most = lost; worst = causeOf(in1).cause; }
    }
    return { advice: worst.words.advice, focus: worst.words.focus };
  }
  // how near the tower that stood came to giving, in the big gust
  function closeCall() {
    const big = run.result.gusts.filter((g) => g.stage === STAGES.length - 1).sort((a, b) => b.peak.util - a.peak.util)[0];
    if (!big || !big.peak || big.peak.util < 0.7) return { words: '', focus: [] };
    const p = big.peak, pct = Math.round(p.util * 100), b = p.id ? run.byId.get(p.id) : null;
    const role = b ? kidText(boardRole(run.tower, b)) : 'a board';
    // (a leg leans as it is built: what counts is how far it swayed from that)
    const what = p.kind === 'tip' ? 'she came within ' + (100 - pct) + '% of tipping over'
      : p.kind === 'rack' ? `${role} ${/leg/.test(role) ? 'swayed' : 'leaned'} ${pct}% as far as it can before that level folds`
        : p.kind === 'bend' ? `${role} with its top free leaned ${pct}% as far as it can`
          : p.kind === 'nails' || p.kind === 'butt' || p.kind === 'footing' ? `the nails holding ${role} were at ${pct}% of what they hold`
            : `${role} was at ${pct}% of what it holds`;
    return { words: ` In the big gust ${what}: the closest she came to giving.`, focus: p.kind !== 'tip' && b ? [b.id] : [] };
  }

  // one break in words: { call (the miller's shout as it goes), what (for the story: what gave, and how many more boards
  // came down with it), base (what gave, alone), advice }
  function words(ev, before, g) {
    const lost = ev.fell.length, broke = ev.broke.length;
    const tail = lost > broke && !['tip', 'loose'].includes(ev.kind) ? `, and ${lost - broke} more board${lost - broke === 1 ? '' : 's'} came down with it` : '';
    const w = wordsOf(ev, before, g);
    // (the boards the words are about, to glow on the tower while the card is open: what gave way; nothing for a tip,
    // which is the whole tower)
    const focus = w.focus || (ev.kind === 'tip' ? [] : ev.broke.length ? ev.broke : ev.fell);
    return { ...w, focus: [...new Set(focus)], base: w.what, what: w.what + tail };
  }
  function wordsOf(ev, before, g) {
    const tail = '';
    const byId = (id) => before.boards.find((b) => b.id === id) || run.byId.get(id);
    // posts standing on nothing (no beam under their feet): that is what to say, whatever gave first
    if (nofootCause(ev)) return nofootWords(ev, before, g);
    // in still air, before any wind: it couldn't hold up its own weight
    if (ev.calm && ev.kind !== 'loose') {
      // (walls leaning out one way so far that her weight sat past her stones: no wind did that)
      if (ev.kind === 'tip') return { call: 'She\'s tipping over!', what: 'she leaned out past her stones and tipped over under her own weight',
        advice: 'She leaned so far one way that her weight sat out past her stones, and over she went before any wind blew. Lean her legs alike on every side, so her weight stays over the middle, or lean them less.' };
      const w = wordsOf({ ...ev, calm: false }, before, g);
      // (a top that leans over in still air was not blown: it fell over, held only at its foot)
      if (ev.kind === 'bend') return { call: 'That one can\'t stand by itself!', what: `${w.what.replace(/ (bent over and blew off|bent over)/, ' leaned over and fell')}, under its own weight`,
        advice: 'A board held only at its foot, leaning, can\'t even hold up its own weight: its nails let it fold over. Nail its top to something too. Height only counts if it stands.' };
      return { call: 'She can\'t hold her own weight!', what: `${w.what}, under her own weight`,
        advice: `That gave way under its own weight, before any wind blew. ${w.advice}` };
    }
    const b = ev.broke.length ? byId(ev.broke[0]) : null, raw = b ? boardRole(before, b) : 'a board', role = kidText(raw);
    const Role = cap(role.replace(/^an? /, ''));
    // nails that twisted loose and left a hinge: nothing came down, the board turns on its nails there now
    if (ev.hinge) return { call: 'A joint worked loose!', what: `the nails holding ${role} twisted loose, and it turns on them there now`,
      advice: 'The nails at a corner twisted loose: the boards there turned on them like a gate on its hinges. A long brace corner to corner on that side keeps the corner square, so its nails don\'t have to.' };
    switch (ev.kind) {
      case 'bend': {
        // (on top: standing on the top of the rest, or lapped onto it and sticking up past everything else, off the
        // ground: a lone board nailed a foot down the top post is still the lone board on top)
        // (judged against the tower as built, not what is left of it: a tier's brace left standing on the beams after its
        // tier folded is not a lone board on top)
        const others = run.tower.boards.filter((o) => o.id !== (b && b.id)), H = heightOf(others);
        const onTop = b && (lo(b) >= H - 0.3 || (lo(b) > 0.3 && hi(b) > H + 0.5));
        const was = b ? kidText(boardRole(run.tower, b)) : role;
        if (b && !onTop && was !== role && !/post|leg/.test(was)) return { call: `${cap(was.replace(/^an? /, ''))} fell over!`, what: `${was} left standing by itself bent over`,
          advice: 'What a collapse leaves standing by itself, held only at its foot, just bends over in the wind. Brace every side, so nothing comes down in the first place.' };
        if (onTop) return { call: `The ${isUprightB(b) ? 'board' : 'piece'} on top blew off!`, what: `the lone board on top bent over and blew off${tail}`,
          advice: `A lone board stood on top is only a flag in the wind: nothing holds its top, so ${g.stage === 0 ? 'the first breeze' : 'the ' + g.name.toLowerCase()} bent it right over. Height only counts if it stands: tie a top in with horizontal boards and braces, or save the wood for the levels below.` };
        // (a leg, leaning where two walls meet, is told as a post is: its top wants tying in)
        const leg = /leg/.test(role), post = !b || isUprightB(b) || /post/.test(role) || leg, P = leg ? 'leg' : 'post';
        return { call: post ? `A ${P} bent over!` : `${Role} bent over!`, what: `${post ? 'a ' + P : role} with its top free bent over${tail}`,
          advice: post ? `A ${P} with its top free just bends over in the wind. Tie the ${P}s' tops together with horizontal boards, and brace every side.`
            : 'A board with its top end free, held only at its foot, just bends over in the wind. Nail its top to something too, or saw off what sticks out.' };
      }
      case 'rack': return rackWords(ev, before, g, tail);
      case 'tip': {
        const span = Math.abs(g.dir.X) > 0.5 ? before.W : before.D;
        // (walls leaning out past the stones: on both sides, her top stood wider than her stones, catching the wind high
        // up; on one side only, she leaned over past them)
        let x0 = 0, x1 = 0, z0 = 0, z1 = 0;
        for (const o of before.boards) for (const q of [o.a, o.b]) { x0 = Math.min(x0, q.X); x1 = Math.max(x1, q.X); z0 = Math.min(z0, q.Z); z1 = Math.max(z1, q.Z); }
        // (only walls that lean reach out past the stones: a board nailed on the outside face of an upright wall sticks out
        // an inch or three, and that is no lean)
        const out = anyLeans(wallsInUse(before)) ? 0.3 : Infinity;
        const past = [x1 > before.W / 2 + out, x0 < -before.W / 2 - out, z1 > before.D / 2 + out, z0 < -before.D / 2 - out];
        const wider = (past[0] && past[1]) || (past[2] && past[3]), oneSide = !wider && past.some(Boolean);
        const more = span >= MAX_W - 1e-6 ? ', or build her lower' : `, set the stones wider${before.W !== before.D ? ' that way' : ''}, or build her lower`;
        // (a tip takes the whole tower at once, base and all: the card says so, so a tower that went red all over in
        // one moment reads as what it was)
        return { call: 'She\'s going over!', what: 'the wind tipped the whole tower over on its stones, base and all', focus: [],
          advice: wider ? `Her legs lean out, so her top stood wider than her stones and caught the wind high up: the wind from the ${g.from} tipped her over. Lean her legs in instead${more}.`
            : oneSide ? `She leaned out past her stones on one side, and the wind from the ${g.from} tipped her over. Lean her legs alike on every side, so her top stays over her stones${more}.`
            : span >= MAX_W - 1e-6 ? 'She went over in one piece. The stones can\'t go any wider than 8 feet, so build her lower, or keep her top light.'
            : `She went over in one piece: the wind from the ${g.from} pushed so hard up high that it lifted the stones on the side it came from. Her stones stand only ${lenWords(span)} apart that way, under a tower ${lenWords(heightOf(before.boards))} tall. Set the stones wider${before.W !== before.D ? ' that way' : ''}, build her lower, or put fewer boards up top: every board up high catches the wind far above the stones.` };
      }
      case 'snap': case 'buckle': {
        const how = ev.kind === 'snap' ? 'snapped' : 'buckled under the squeeze';
        // (where it was: its side or corner of the tower, and how high it started)
        const where = b ? `${atSide(sideOf([b], before))}${lo(b) > 0.3 ? ', ' + upWords(lo(b)) : ''}` : '';
        const advice = /brace/.test(role) ? 'A long brace squeezed in a gust buckles the thin way. A shorter bay, or a second brace crossing it, holds it straighter.'
          : /post|leg/.test(role) ? `A ${/leg/.test(role) ? 'leg' : 'post'} bending the thin way snapped. Brace it both ways, front to back and side to side, so it can't bend either way.`
            : /beam/.test(raw) ? 'A horizontal board carrying a narrower level bent too far. Stand that level\'s posts near the board\'s ends, or prop its middle.'
              : 'Something snapped. Braces near 45 degrees spread the load, so no one board takes it all.';
        return { call: `${Role} ${ev.kind === 'snap' ? 'snapped' : 'buckled'}!`, what: `${role} ${how}${where}${tail}`, advice };
      }
      case 'nails': {
        if (/toe-nails/.test(ev.text)) {
          const post = /standing on/.test(ev.text);
          return { call: 'Toe-nails pulled out!', what: `${kidText(ev.text)}${tail}`,
            advice: post ? toeAdvice(before, b)
              : 'A horizontal board whose end only rests on another is held there by toe-nails alone. Lay it right across the top of the level below, onto the boards at both sides, and brace the level above it.' };
        }
        if (/knee/.test(ev.text) || role === 'a knee brace') return { call: 'The knee brace let go!', what: `the nails in a knee brace pulled out${tail}`, advice: 'Knee braces help, but their nails take a beating in a big gust. A long brace corner to corner holds better.' };
        return { call: 'The nails pulled out!', what: `the nails holding ${role} pulled out${tail}`, advice: 'The nails at a joint pulled out. Braces near 45 degrees spread the load, so no one joint takes it all.' };
      }
      case 'butt': return { call: 'That joint pulled apart!', what: `two boards butted end to end pulled apart${tail}`,
        advice: /leg/.test(role) ? 'A leg standing on the end of the leg below hardly holds to it. Nail a brace over the joint, from the leg below up onto the leg above, so the wind can\'t pry them apart.'
          : 'Two boards end to end hardly hold. Nail a horizontal board or a brace across the joint.' };
      case 'footing': {
        const dirt = /bare ground/.test(ev.text), rested = /(slid on|lifted off) its stone/.test(ev.text);
        // (a foot that only rested on its stone: nothing standing there could be strapped down, so it slid or lifted)
        if (rested) return { call: /slid/.test(ev.text) ? 'Her foot slid!' : 'A foot lifted off its stone!', what: `${kidText(ev.text)}${tail}`,
          advice: 'That foot only rested on its stone: only a post or a leg standing on a stone is strapped down, and the boards beside it are nailed to its foot. Stand a post or a leg on every stone, and nail every foot there to it.' };
        // (a corner leg's strap: a leg leaning far sits on its stone at a slant, and its strap holds it less well; a leg
        // leaning only a little sways nearly as much as a post, and pries at its foot)
        let advice = dirt ? 'A board resting on the dirt can\'t brace anything: it just slides. Nail its foot to a post on a stone.'
          : 'A foot tore loose from its stone: the wind lifted that side. Brace down to every stone, or set the stones wider.';
        if (!dirt && b && /tore loose/.test(ev.text) && /leg/.test(role)) {
          const rise = Math.abs(b.b.Y - b.a.Y) || 1, slant = Math.hypot(b.b.X - b.a.X, b.b.Z - b.a.Z) / rise, most = Math.max(Math.abs(b.b.X - b.a.X), Math.abs(b.b.Z - b.a.Z)) / rise;
          if (slant > 0.364) advice = 'A leg leaning that far stands on its stone at a slant, and its strap holds it far less well than a post\'s. Lean it less, or brace down to every stone so the braces share the pull.';
          else if (most < 1 / 12 + 1e-6) advice = 'Her legs lean in only a little, so she sways nearly as much as a straight tower, and that pried a foot up off its stone. Brace every side down to the stones, or lean the legs in more.';
          else advice = 'A leg\'s foot tore loose from its stone: the wind lifted that side. Brace every side down to the stones, so the braces share the pull.';
        }
        return { call: dirt ? 'Her foot slid!' : 'A foot came off its stone!', what: `${kidText(ev.text)}${tail}`, advice };
      }
      case 'loose': return { call: 'That wasn\'t nailed to anything!', what: kidText(ev.text),
        advice: 'Every board has to be nailed to something that reaches the ground. One touching nothing just falls.' };
      default: return { call: 'Something gave!', what: `${kidText(ev.text)}${tail}`, advice: 'Something gave. Braces near 45 degrees spread the load best.' };
    }
  }

  // The level (a storey, or a tier: a narrower level) whose posts stand at height y: its posts (straight up, or leaning in
  // a little), its footprint there, how high its posts reach, its name by where it is ("the narrower level 8 feet up at
  // the back" when it stands above the ground on less than the stones' footprint, else "that level") and its four walls,
  // each with whether it had a long brace across that level.
  // (Its posts may be LEGS leaning with walls that lean: its walls are then the leaning walls they stand in, found from
  // the legs, and its size is read at its foot. Heights are the world's.)
  function tierAt(before, y) {
    const WS = wallsInUse(before), leans = anyLeans(WS);
    const posts = before.boards.filter((b) => postLike(b, before, WS) && Math.abs(lo(b) - y) < 0.1);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, top = Infinity;
    for (const p of posts) { const q = atHeight(p, y); x0 = Math.min(x0, q.X); x1 = Math.max(x1, q.X); z0 = Math.min(z0, q.Z); z1 = Math.max(z1, q.Z); top = Math.min(top, hi(p)); }
    const tier = posts.length > 0 && y > 0.3 && (x1 - x0 < before.W - 0.01 || z1 - z0 < before.D - 0.01);
    const name = !posts.length ? 'that level' : tier ? narrower(posts, before, y) : y > 0.3 ? 'that level' : 'the bottom level';
    const walls = !posts.length ? [] : [['Z', z1, 'front', x1 - x0], ['Z', z0, 'back', x1 - x0], ['X', x1, 'right side', z1 - z0], ['X', x0, 'left side', z1 - z0]]
      .filter(([ax, off], i, all) => all.findIndex((w) => w[0] === ax && Math.abs(w[1] - off) < 1e-6) === i)
      .map(([ax, off, wall, wide]) => {
        const k = leans ? wallAt(posts, ax, off, y, WS) : planeKey(ax, off);
        const braces = planeSegments(before, k).filter((sg) => !sg.post && !isLevelB(sg.src) && !postLike(sg.src, before, WS) && lo(sg.src) < top - 0.3 && hi(sg.src) > y + 0.3);
        // (with leaning walls, a knee is judged against the span between the legs at the brace, as in rackWords)
        return { k, name: wall, braced: braces.some((sg) => !isKnee(sg, leans ? wallSpan(before, k, sg) : wide)) };
      });
    return { posts, x0, x1, z0, z1, y, top, tier, name, walls };
  }
  const wallsNamed = (ws) => 'its ' + sidesList(ws.map((w) => w.name));
  // the advice when a post standing on a beam pulled its toe-nails out: about the tier's walls as they really were (a
  // leg standing on a beam, the same)
  function toeAdvice(before, post) {
    const T = post ? tierAt(before, lo(post)) : null, P = post && isLegB(before, post, wallsInUse(before)) ? 'leg' : 'post';
    const base = `A ${P} standing on a horizontal board is only toe-nailed at its foot, and toe-nails pull out easily.`;
    if (!T || !T.walls.length) return `${base} Brace that level corner to corner, so the push goes down the braces instead of prying the foot up.`;
    const open = T.walls.filter((w) => !w.braced);
    if (open.length === T.walls.length) return `${base} ${cap(T.name)} had no braces: brace every side of it corner to corner, so the push goes down the braces instead of prying the foot up.`;
    if (open.length) return `${base} ${cap(T.name)} had no brace across ${wallsNamed(open)}: brace every side of it corner to corner, so the push goes down the braces instead of prying the foot up.`;
    // every wall braced: the toe-nails were simply asked too much. A brace's foot nailed down beside a post's foot adds
    // its own toe-nails, so a post with no brace foot at its own foot is the place to start.
    const footOf = (b) => (b.a.Y <= b.b.Y ? b.a : b.b);
    const WS = wallsInUse(before), bare = T.posts.filter((p) => { const f = footOf(p); return !before.boards.some((o) => o !== p && !isLevelB(o) && !postLike(o, before, WS) && Math.hypot(footOf(o).X - f.X, footOf(o).Y - f.Y, footOf(o).Z - f.Z) < 0.25); });
    if (bare.length) return `${cap(T.name)} was braced corner to corner on every side, but the wind still pried a ${P}'s foot up off the board under it: three toe-nails only hold so much. Start a brace at the foot of every ${P} of it, so the brace's nails share the pull, or build her top lower.`;
    return `${cap(T.name)} was braced corner to corner on every side, with a brace at every ${P}'s foot, but the wind still pried a foot up off the board under it: toe-nails only hold so much. Stand its ${P}s nearer the ends of the boards under them, right over the sides of the level below, or build her top lower.`;
  }
  // posts standing on nothing (no horizontal board under their feet): named by where they are, and what to do, in plain
  // carpentry ("lay a horizontal board across the top of the level below, right under their feet")
  function nofootWords(ev, before, g) {
    const posts = ev.nofoot.map((id) => before.boards.find((b) => b.id === id) || run.byId.get(id)).filter(Boolean);
    const src = before.boards.some((b) => posts.includes(b)) ? before : run.tower, WS = wallsInUse(src);
    const G = groupOf(posts, src, (p) => isLegB(src, p, WS)), one = G.n === 1, P = G.noun === 'horizontal board' ? 'board' : G.noun;
    const them = one ? 'it' : 'them', their = one ? 'its foot' : 'their feet';
    return { call: one ? `Nothing under that ${P}!` : `Nothing under those ${P}s!`, focus: posts.map((p) => p.id),
      what: `${said(G, true)} stood on nothing, with no horizontal board under ${their}, and ${one ? 'it' : 'they'} ${ev.calm ? `gave way under ${one ? 'its' : 'their'} own weight` : `gave way in the ${g.name.toLowerCase()}`}`,
      advice: `Every ${/post|leg/.test(P) ? P : 'board standing up'} needs something solid right under its foot. ${cap(said(G, true))} had nothing under ${them}: lay a horizontal board across the top of the level below, right under ${their}, nail it down at both ends, and stand ${one ? 'the ' + P : 'the ' + P + 's'} on it.` };
  }
  // A narrower level named by where it stands: "the narrower level 8 feet up at the back" (its posts' feet at y; the side
  // when they all stand to one side of the tower's middle)
  function narrower(posts, t, y) { return `the narrower level ${upWords(y)}${atSide(sideOf(posts, t))}`; }

  // A storey (or a tier) that racked, in words. The storey: the posts standing where it leaned, between the floor
  // under that spot and the one over it (the ground, the beams, every level board). A tier: its posts stand above the
  // ground on a smaller footprint than the stones (a 2 × 3 tier on beams). The walls that had to hold it square are the
  // ones the wind blows along (from the west or east: the walls facing front and back); each either had a long brace
  // corner to corner in that storey or it didn't.
  // The walls checked are the two walls of the storey's footprint (at the racked height) that the wind blows along,
  // whether or not posts still stand in them: a wall with one post (or none) left is missing a corner post; a wall the
  // posts lean across without standing in it would have to lean with them. The advice comes from those walls; the
  // physics' own words (a knee brace...) only when there were no walls to look at.
  // Walls that LEAN (a tower with any: the rest of it is worded as it always was): the storey's legs stand in leaning
  // walls, so its walls are the ones its legs lie in, and its size is read at its foot ("the 4 × 4 tier", however narrow
  // it gets). A wall the wind blows along can lean in three ways that matter: its legs drawing together as they climb
  // (a taper: that helps, through the joints, but legs only hold a wall square where they meet at a point), drawing apart
  // (leaning out: it folds even sooner than a square one), or the whole wall tipped over with its legs parallel (that
  // doesn't brace it at all). With no brace, each folds; the advice says which.
  function rackWords(ev, before, g, tail) {
    const y = ev.at.Y, top = heightOf(before.boards), WS = wallsInUse(before), leans = anyLeans(WS);
    const pl = (b) => postLike(b, before, WS);
    // the posts of the storey: boards standing straight up or leaning in a little (a tapered storey), or legs, across
    // that height
    const posts = before.boards.filter((b) => pl(b) && lo(b) < y + 0.05 && hi(b) > y - 0.05);
    const floors = [...new Set([0, ...before.boards.filter(isLevelB).map((b) => +((b.a.Y + b.b.Y) / 2).toFixed(2))])].sort((a, c) => a - c);
    const y0 = Math.max(...floors.filter((f) => f <= y + 0.05)), y1 = Math.min(top, ...floors.filter((f) => f > y + 0.3));
    const yF = leans ? y0 : y;      // (where its footprint is read: at its floor when walls lean; atHeight keeps to a board's own ends)
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, foot = Infinity;
    for (const p of posts) { const q = atHeight(p, yF); x0 = Math.min(x0, q.X); x1 = Math.max(x1, q.X); z0 = Math.min(z0, q.Z); z1 = Math.max(z1, q.Z); foot = Math.min(foot, lo(p)); }
    // (its size, for its name: at its foot when its posts slant, so a storey narrowing as it climbs is named by what it
    // stands on, "the 4 × 4 tier")
    let sx = x1 - x0, sz = z1 - z0;
    // (each leg read at its own foot, the lowest point of it: a tier on leaning legs is named by what it stands on, not
    // by how narrow it is at the crosspieces over the spot that racked)
    if (posts.some((p) => !isPost(p))) {
      let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
      for (const p of posts) { const q = p.a.Y <= p.b.Y ? p.a : p.b; a0 = Math.min(a0, q.X); a1 = Math.max(a1, q.X); c0 = Math.min(c0, q.Z); c1 = Math.max(c1, q.Z); }
      sx = a1 - a0; sz = c1 - c0;
    }
    // (legs standing in leaning walls that reach down to the ground: the tower narrowing as it climbs, one storey on
    // another, not a tier set in on beams)
    const reachesGround = (k) => planeSegments(before, k).some((s) => lo(s.src) < 0.3);
    const climbs = leans && posts.some((p) => isLegB(before, p, WS) && planesOf(p).some((k) => parseKey(k).k && WS.has(k) && reachesGround(k)));
    const tier = !climbs && posts.length && foot > 0.3 && (sx < before.W - 0.01 || sz < before.D - 0.01);
    // its name: "the 2 × 3 tier", or which storey ("the top storey"), or "the tower" when it is only one storey high
    // (with walls that lean, a storey starts where its posts or legs start: crosspieces fitted where the legs stand their
    // length apart often sit below the legs' tops, and the bit of leg above them is no storey)
    const starts = leans ? [...new Set([0, ...before.boards.filter(pl).map(lo).filter((f) => f > 0.3).map((f) => +f.toFixed(2))])].sort((a, c) => a - c) : floors;
    // (leaning: the level is the one whose legs stand across the height that racked, read where it racked, not at the
    // horizontal boards under it: those may sit below the legs' tops, in the level underneath)
    const under = starts.filter((f) => f < top - 0.5), i = Math.max(0, under.filter((f) => f <= (leans ? y : y0) + 0.05).length - 1), n = under.length;
    const storey = n < 2 ? 'the tower' : `the ${i === n - 1 ? 'top' : i === 0 ? 'bottom' : n === 3 ? 'middle' : ['second', 'third', 'fourth', 'fifth', 'sixth'][i - 1] || 'middle'} level`;
    // (a narrower level by where it stands, never by its size; one post left of it, after the rest of it went: what was
    // left of it)
    const place = tier ? (sx < 0.25 || sz < 0.25 ? 'what was left of the narrower level' : narrower(posts, before, foot)) : storey;
    // the walls the wind blows along (the two of the footprint), and whether each had a brace there
    const along = Math.abs(g.dir.X) > 0.5 ? 'Z' : 'X';
    const keys = !posts.length ? [] : [...new Set((along === 'Z' ? [z1, z0] : [x1, x0]).map((o) => (leans ? wallAt(posts, along, o, yF, WS) : planeKey(along, o))))];     // (front first, then back; right, then left)
    // (a side by where it is: "front", "right side"; one inside the tower, "the inside frame 1 foot in from the front")
    const wallName = (k) => wallName0(k).replace(/^(the )?(front|back) wall\b/, '$1$2').replace(/\bwall\b/g, 'frame');
    const wallName0 = (k) => {
      // (a leaning outer wall, standing on the stones' line, is the front wall (or a side) at any height, however far in
      // it has come by then; its lean is left out: the advice says how it leans)
      if (leans && !tier && parseKey(k).k && faceOfPlane(before, k) >= 0) return planeName(before, k, true).split(',')[0];
      // (a leaning wall by where it stands at the storey's foot, without its lean: the advice says how it leans)
      const off = leans ? offsetAt(k, yF) : +k.slice(2), upright = leans ? planeKey(along, off) : k;
      if (!tier && faceOfPlane(before, upright) >= 0) return planeName(before, upright).replace(/^the /, '');
      const side = along === 'Z' ? (Math.abs(off - z1) < 1e-3 ? 'front' : Math.abs(off - z0) < 1e-3 ? 'back' : null) : (Math.abs(off - x1) < 1e-3 ? 'right side' : Math.abs(off - x0) < 1e-3 ? 'left side' : null);
      return side || planeName(before, upright).replace(/^the /, '');
    };
    const walls = keys.map((k) => {
      // (how wide the wall is that a brace braces: the storey's width; with leaning walls, the span between the legs
      // either side of the brace at its middle (tower.js wallSpan), as the builder's own knee check reads it: legs
      // drawing together leave a short leg-to-leg brace in a narrow storey no knee)
      const segs = planeSegments(before, k), wide = along === 'Z' ? x1 - x0 : z1 - z0, span = (sg) => (leans ? wallSpan(before, k, sg) : wide);
      const braces = segs.filter((s) => !s.post && !pl(s.src) && !isLevelB(s.src) && lo(s.src) < y1 - 0.3 && hi(s.src) > y0 + 0.3);
      const long = braces.filter((s) => !isKnee(s, span(s)));
      // the posts standing in this wall, and the ones that only pass through its line here, leaning across it
      const inWall = posts.filter((p) => planesOf(p).includes(k));
      const across = posts.filter((p) => !inWall.includes(p) && Math.abs((along === 'Z' ? atHeight(p, y).Z : atHeight(p, y).X) - offsetAt(k, y)) < 0.1);
      const withFloors = [...segs, ...floorsAcross(before, k)];
      // (how its legs stand: how far apart along the wall at the storey's foot and at its top)
      const uOf = (p, Y) => (along === 'Z' ? atHeight(p, Y).X : atHeight(p, Y).Z);
      const spread = (Y) => { const us = inWall.map((p) => uOf(p, Y)); return us.length > 1 ? Math.max(...us) - Math.min(...us) : 0; };
      const yT = Math.min(y1, ...inWall.map(hi)), w0 = leans ? spread(y0) : 0, w1 = leans ? spread(yT) : 0;
      // (do its legs run on up to meet at a point, a pyramid's? two legs in this wall whose tops stand together)
      const tops = leans ? segs.filter((s) => s.leg && isCornerLine(before, s.src, WS)).map((s) => (s.ay >= s.by ? { u: s.ax, y: s.ay } : { u: s.bx, y: s.by })) : [];
      const point = tops.some((p, a) => tops.some((q, c) => c > a && Math.abs(p.y - q.y) < 0.35 && Math.abs(p.u - q.u) < 0.35 && tops.some((r) => Math.abs(r.u - p.u) > 1)));
      return { k, name: wallName(k), braced: long.length > 0, closes: long.some((s) => trianglesOf(withFloors, s.id).length > 0), knee: braces.length > long.length,
        leans: across.length > 0 && inWall.length < 2, short: inWall.length < 2 && !across.length,
        narrows: inWall.length > 1 && w1 < w0 - 0.1, point: point && inWall.length > 1 && w1 < w0 - 0.1, widens: inWall.length > 1 && w1 > w0 + 0.1, tilted: parseKey(k).k !== 0 };
    });
    const open = walls.filter((w) => !w.braced), leaning = walls.filter((w) => w.leans), short = walls.filter((w) => w.short);
    // (inside walls each keep their "the": "the inside wall 1 foot in from the front and the inside wall ...")
    const named = (ws) => (ws.length > 1 && ws.some((w) => /^inside /.test(w.name)) ? andList(ws.map((w) => 'the ' + w.name))
      : (tier || ws.length === 1 ? 'its ' : 'the ') + sidesList(ws.map((w) => w.name)));
    const them = (ws) => (ws.length > 1 ? 'those sides' : 'that side');
    // (in the wind it really happened in: a knee-braced storey can go in the stiff wind, not only in the big gust)
    const inWind = !g || !g.name ? 'in a big gust' : g.stage === 0 ? 'even in a breeze' : `in a ${g.name.toLowerCase()}`;
    const KNEE = `Knee braces help, but a short brace can't keep a level from folding ${inWind}. A long brace corner to corner holds better.`;
    const P = posts.some((p) => isLegB(before, p, WS)) ? 'leg' : 'post', blows = (ws) => `the side${ws.length > 1 ? 's' : ''} the wind from the ${g.from} blows along`;
    // A TURNED level (TURN.md): its posts stand in turned walls, every one of them slanting to the wind, so every one
    // of them helps hold it square; named "the turned level 8 feet up", its walls by whether they had a brace there.
    const turnedPosts = posts.filter((p) => isTurnedFam(p.n));
    if (turnedPosts.length && turnedPosts.length >= posts.length / 2) {
      const foot2 = Math.min(...turnedPosts.map(lo)), tplace = `the turned level ${upWords(foot2)}`;
      const tw = [...new Set(turnedPosts.flatMap((p) => planesOf(p).filter((k) => isTurnedFam(famOfKey(k)))))].filter((k) => turnedPosts.filter((p) => planesOf(p).includes(k)).length >= 2);
      const braced = (k) => planeSegments(before, k).some((sg) => !sg.post && !pl(sg.src) && !isLevelB(sg.src) && lo(sg.src) < y1 - 0.3 && hi(sg.src) > y0 + 0.3 && !isKnee(sg, wallSpan(before, k, sg)));
      const openT = tw.filter((k) => !braced(k));
      const tadvice = !tw.length ? `${cap(tplace)} leaned too far and folded over. Brace each of its sides from a post's foot up to the next post.`
        : openT.length === tw.length ? `${cap(tplace)} had no braces, so it folded over. A turned level needs its own braces, just like the base: one on each of its sides, from a post's foot up to the next post.`
        : openT.length ? `${cap(tplace)} had no brace on ${openT.length === 1 ? 'one of its sides' : `${openT.length} of its sides`}, so it folded there. With the wind coming at its corner, every side of a turned level works: brace them all.`
        : `${cap(tplace)} had its braces, but still leaned too far. A second brace crossing the first, or a shorter level, stiffens it.`;
      return { call: 'That level\'s folding!', what: `${tplace} racked and folded over${tail}`, advice: tadvice, focus: ev.broke };
    }
    let advice;
    if (!walls.length) advice = /knee/.test(ev.text) ? KNEE : `${cap(place)} leaned too far and folded over. Brace every side corner to corner, near 45 degrees.`;
    else if (leaning.length) advice = `The posts of ${place} lean across ${named(leaning)} without standing in ${leaning.length > 1 ? 'them' : 'it'}, so nothing held ${leaning.length > 1 ? 'them' : 'it'} square. Lean ${them(leaning)} to match the posts (look along ${leaning.length > 1 ? 'each' : 'it'} and drag a board's top in or out), or stand the posts straight up, and brace every side.`;
    // (legs that run on up to meet at a point hold their walls square, as a pyramid does: what folded was a long stretch
    // of leg bending between two horizontal boards, braced or not)
    else if (walls.some((w) => w.point)) { const ws = walls.filter((w) => w.point), gap = y1 - y0;
      advice = `Her legs meet at a point at the top, which holds ${named(ws)} square, but in ${place} the long legs bent between horizontal boards ${lenWords(Math.round(gap * 2) / 2)} apart, and it folded over. Nail more horizontal boards across the legs, closer together, or brace ${them(ws)} higher up.`; }
    else if (short.length) advice = `${cap(place)} was missing a corner ${P} on ${named(short)}, so nothing held ${them(short)} square. Every corner needs its ${P}, and every side its brace.`;
    else if (open.length === walls.length) advice = open.some((w) => w.knee) ? KNEE
      : open.some((w) => w.narrows) ? `The legs of ${place} lean in toward each other on ${named(open)}, ${blows(open)}. That helps, but legs only hold a side square where they meet at a point, and with no brace it folded over. Brace ${them(open)} corner to corner too, just like a straight tower.`
      : open.some((w) => w.widens) ? `The legs of ${place} lean out, away from each other, on ${named(open)}, ${blows(open)}, and with no brace it folded over: a side that widens as it climbs folds even sooner than a square one. Brace ${them(open)} too; leaning out, a side soon grows too wide for a board to reach corner to corner, so run a brace from each leg's foot up to the horizontal board over it.`
      : open.some((w) => w.tilted) ? `${cap(place)} had no brace across ${named(open)}, ${blows(open)}, so it folded over. Leaning a side over doesn't brace it: ${tier ? 'a narrower level needs its own long braces, corner to corner, leaning or not.' : 'every level needs a long brace corner to corner on those sides, leaning or not.'}`
      : `${cap(place)} had no brace across ${named(open)}, ${blows(open)}, so it folded over. ${tier ? 'A narrower level needs its own long braces, corner to corner, just like the base.' : 'Every level needs a long brace corner to corner on those sides, near 45 degrees.'}`;
    else if (open.length) advice = `${cap(place)} had no brace across ${named(open)}, so it folded there, though ${named(walls.filter((w) => w.braced))} had one. Every side the wind blows along needs its own brace.`;
    else if (!walls.some((w) => w.closes)) advice = `${cap(place)} had a brace, but its end stopped short of the corner, so the square could still fold. Set a brace's ends right on the corners.`;
    else advice = `${cap(place)} had its braces, but still leaned too far. A second brace crossing the first, or a shorter level, stiffens her.`;
    return { call: tier ? 'That level\'s folding!' : 'She\'s racking over!', what: `${place} racked and folded over${tail}`, advice, focus: ev.broke };
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
  // (how far the tower reaches: the stones, and walls leaning out past them, so a tower leaning out stays in view)
  function framing(narrow = false) {
    const t = app.tower, reach = (boards) => {
      let x0 = -t.W / 2, x1 = t.W / 2, z0 = -t.D / 2, z1 = t.D / 2;
      for (const b of boards) for (const p of [b.a, b.b]) { x0 = Math.min(x0, p.X); x1 = Math.max(x1, p.X); z0 = Math.min(z0, p.Z); z1 = Math.max(z1, p.Z); }
      return { x0, x1, z0, z1, wide: Math.max(x1 - x0, z1 - z0), wx: x1 - x0, wz: z1 - z0, X: (x0 + x1) / 2, Z: (z0 + z1) / 2 };
    };
    // (wx, wz: how far it reaches across X and Z, so the camera can tell how wide it looks from where it stands)
    if (!run) { const r = reach(t.boards); return { H: Math.max(8, towerHeight(t)), across: r.wide, wx: r.wx, wz: r.wz, X: r.X, Z: r.Z }; }
    const down = !run.up.size && fall.sinceDrop > 0.8;
    const built = reach(run.tower.boards), left = reach(run.result.standing.boards);
    if (!down && !run.done) return { H: Math.max(8, run.h0), across: built.wide, wx: built.wx, wz: built.wz, X: built.X, Z: built.Z };
    if (!down && narrow) return { H: Math.max(9, run.result.height + 2), across: left.wide, wx: left.wx, wz: left.wz, X: left.X, Z: left.Z, pile: true };
    // (the boards on the ground: where they lie, and what stands of the tower, if any of it does)
    let x0 = run.up.size ? left.x0 : Infinity, x1 = run.up.size ? left.x1 : -Infinity, z0 = run.up.size ? left.z0 : Infinity, z1 = run.up.size ? left.z1 : -Infinity;
    for (const st of fall.sticks) for (const p of st.p) { x0 = Math.min(x0, p.x / FT); x1 = Math.max(x1, p.x / FT); z0 = Math.min(z0, p.z / FT); z1 = Math.max(z1, p.z / FT); }
    if (!Number.isFinite(x0)) { x0 = -t.W / 2; x1 = t.W / 2; z0 = -t.D / 2; z1 = t.D / 2; }
    const across = Math.max(left.wide, Math.hypot(x1 - x0, z1 - z0) * 0.85);
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

  return { start, frame, framing, state, get running() { return !!run && !run.done; }, get result() { return run && run.result; }, get card() { return (run && run.card) || null; } };
}

const SACK = '<svg viewBox="0 0 32 32"><path d="M9 6c2 2 12 2 14 0l-1 4c4 3 6 9 5 15-1 4-5 5-11 5S6 29 5 25c-1-6 1-12 5-15z" fill="#efe6d0" stroke="#7a5530" stroke-width="1.5"/><path d="M10 10c3 1 9 1 12 0" stroke="#7a5530" stroke-width="1.5" fill="none"/><text x="16" y="23" text-anchor="middle" font-size="7" font-family="Smokum, Georgia, serif" fill="#7a5530">FLOUR</text></svg>';
