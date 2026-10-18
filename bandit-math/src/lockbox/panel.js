// The lock-box panel: a calm full-screen page over the paused game where the kid cracks boxes by solving for x
// with "same move on both sides" buttons, one box straight after another.
//
//   openLockbox(root, { rider, box: { tier, from }, onBox, onDone, next })
//     from: 'sheriff' (seized boxes at the desk), 'loot' (the saddlebags) or 'practice' ("Just lock boxes" on the title)
//     -> { el, close() }
//   onBox(result)   (optional) runs as each box finishes, solved or set aside: the caller pays the gold and records
//                   it right then (save.js earn + recordLockbox), so gold is saved the moment it is earned. It may
//                   return { newTitle, badge } for the panel to show on the coin animation.
//                   result = { solved, stars, gold, moves, par, rung, tier, clean, left, hints }
//   onDone(totals)  runs once, when the kid presses "Done for now" (or Esc), or the saddlebags run out:
//                   { solved (any box solved), boxes (how many), played, gold (all of it), stars, moves, par, rung,
//                     tier, clean, left, hints (the last box's), results: [each box], paid (true when onBox ran) }.
//                   With no onBox, the caller pays totals.gold here instead. A box already solved whose check or
//                   lid is still playing when the kid stops is paid first (onBox), so stopping never loses gold;
//                   a box not yet solved isn't counted.
//   next(lastResult) (optional) -> the next box { tier, from }, or null to stop. Without it: a seized box from the
//                   sheriff is followed by another forever; boxes from the saddlebags (from 'loot') go through what
//                   is in rider.lockboxes, then the panel closes by itself.
//
// One box, top to bottom: the top strip (box name, one brass tumbler per move of par, the stars, the gold, "Done for
// now"), the steps card (the six rules, the step being worked lit), the pinned start line and the ledger on ruled
// paper, the big working line (numbers are round coins, x-terms are cards; "=" is a brass hinge pin), Old Hob's
// caption, and the button tray (keys 1-4, U undo, H hint).
// When x stands alone the check plays by itself: x drops into the start line, each side works itself out, both land
// on the same number, the lid opens, the coins fly into the gold, and the next box slides in. No timer anywhere.
//
// Adding a negative and a positive is where kids slip (−10 + 18 worked as −28), so:
//   - the first few times a move makes such a sum (one that starts below zero or crosses it: −10 + 18, 5 − 8; plain
//     taking away like 84 − 12 doesn't count), a number line under the working line shows the hop
//     (src/ui/numberline.js), and the Rule hint shows it for the sum the hinted move will make;
//   - the check flashes the hop whenever a side comes down to such a sum (−16 + 18, 5 − 8; not plain 63 − 6);
//   - on level 5 ("do the arithmetic", review boxes) the kid picks the tidied line from 3 cards after each move:
//     the right one, a sign slip and one side forgotten (tidy.js). A wrong card shows the number line with the
//     kid's pick marked; so does waiting about 8 seconds.
//
// It writes nothing to storage itself: it changes rider.topics.algebra in place (the ladder); the caller saves the
// rider (save.js recordLockbox does that) in onBox, or after onDone.

import {
  lineText, sideText, termText, termBody, termNeg, moveLabel, moveNote, fracText, isSolved, F, evalSide, evalTerm, applyMove,
  MINUS, TIMES,
} from './engine.js';
import { RUNG, generate, makeRng, verdictOf } from './generate.js';
import { makeAlgebra, ARITH_LEVEL } from './algebra.js';
import { makeBox, TIER_NAME, targetsOf } from './box.js';
import { tidyChoices, slipLine, sumsOf } from './tidy.js';
import { bracketProducts, productNudge, productHelp } from './products.js';
import { GOLDEN_RULE, STEPS, SKIP_WORD, cardMode, currentStep } from './steps.js';
import { showNumberLine, watchHesitation, layoutNumberLine } from '../ui/numberline.js';
import { SAFECRACKER_BOXES } from '../save.js';

const TIDY_HESITATE_MS = 8000;   // on the do-the-arithmetic level, the number line comes up after this long without a pick
const CHECK_STEP_MS = 560;       // the check: each side's next working-out step (times the box's speed)
const CHECK_SUM_MS = 700;        // ...a side's sum (−9 + 16) stays up at least this long while its hop works it out
const CHECK_LAND_MS = 750;       // ...and once the hop lands, the side's answer and the landing show together this long
const REWARD_MS = 1900;          // the lid open and the coins flying, before the next box slides in
const SLIDE_MS = 480;            // the next box sliding in
const QUICK_AFTER = 3;           // once this many boxes are open in one sitting, the kid has seen how the check goes:
const QUICK = 0.65;              // ...the check's steps and the coins run at this share of their time (the number-line
                                 // hop keeps its full time: that one is for learning)

// The sums worth a number line: the number already there is negative (−10 + 18) or the answer crosses zero (5 − 8).
// Plain taking away (84 − 12, 40 − 4) is adding a negative too, but it isn't the slip the picture is for, and the
// line's few showings are kept for the sums that are.
const weakSpot = (a, b) => Math.sign(a) !== Math.sign(b) && a + b !== 0 && (a < 0 || Math.sign(a + b) !== Math.sign(a));

const CSS_HREF = new URL('./lockbox.css', import.meta.url).href;

// Adds the panel's stylesheet once; resolves when it has loaded (or failed), so the first draw is measured with it.
let cssReady = null;
function ensureCss() {
  if (cssReady) return cssReady;
  const old = document.querySelector('link[data-lockbox-css]');
  if (old) return (cssReady = Promise.resolve());
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  link.dataset.lockboxCss = '1';
  cssReady = new Promise((res) => {
    link.addEventListener('load', res);
    link.addEventListener('error', res);
    setTimeout(res, 3000);
  });
  document.head.appendChild(link);
  return cssReady;
}

// ---------- small helpers ----------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Math text to HTML: every x becomes an italic serif x.
const mathHTML = (s) => esc(s).replace(/x/g, '<i class="x">x</i>').replace(/·/g, '<b class="dot">·</b>');
// Plain words with an x in them (the steps card): only a lone x is the letter x.
const wordsHTML = (s) => esc(s).replace(/(^|[^A-Za-z])x(?![A-Za-z])/g, '$1<i class="x">x</i>');
function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const whole = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? n : 0; };

// ---------- drawing pieces ----------

const HOB_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#2c1d12"/>
<path d="M7 21c3-1 6-1.6 9-1.8L18 9c1-3 11-3 12 0l2 10.2c3 .2 6 .8 9 1.8-5 2.2-29 2.2-34 0z" fill="#c8963e"/>
<path d="M17 18.5c4 .9 10 .9 14 0" stroke="#7a5524" stroke-width="2" fill="none"/>
<path d="M15.5 22.5c.5 5 2 8 3 9 1.5 6 9.5 6 11 0 1-1 2.5-4 3-9-5.5 1.3-11.5 1.3-17 0z" fill="#e9c999"/>
<path d="M14.5 27c1 11 6 15 9.5 15s8.5-4 9.5-15c-2 3-4 4-9.5 4s-7.5-1-9.5-4z" fill="#ece3d2"/>
<circle cx="20.3" cy="25.4" r="1.2" fill="#2c1d12"/><circle cx="27.7" cy="25.4" r="1.2" fill="#2c1d12"/></svg>`;

const KEY_SVG = `<svg viewBox="0 0 120 48" aria-hidden="true"><circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" stroke-width="7"/>
<rect x="38" y="20" width="76" height="8" rx="3" fill="currentColor"/><rect x="90" y="27" width="7" height="13" fill="currentColor"/>
<rect x="104" y="27" width="7" height="9" fill="currentColor"/></svg>`;

const STAR = (on) => `<svg viewBox="0 0 24 24" class="${on ? 'on' : ''}" aria-hidden="true"><path d="M12 2.2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.1l-6 3.5 1.5-6.8L2.3 9.2l6.9-.7z"/></svg>`;

const COIN_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="#e2ad4c" stroke="#8a5f22" stroke-width="1.6"/>
<circle cx="12" cy="12" r="7" fill="none" stroke="#a8742a" stroke-width="1.1"/><path d="M9.5 9.5h5M9.5 14.5h5M12 7.5v9" stroke="#7a5524" stroke-width="1.4" stroke-linecap="round"/></svg>`;

const BAG_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 11h18l2 15c0 2-1 3-3 3H8c-2 0-3-1-3-3z" fill="#9b6a3a" stroke="#4a2f17" stroke-width="1.5"/>
<path d="M7 11c0-4 4-7 9-7s9 3 9 7" fill="none" stroke="#4a2f17" stroke-width="2"/><path d="M6 15h20" stroke="#4a2f17" stroke-width="1.5"/>
<rect x="13.5" y="15" width="5" height="5" rx="1" fill="#e2ad4c"/></svg>`;
const NUGGET_SVG = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 9l2-5 5-1 4 3 0 5-4 3-5-1z" fill="#e8b84a" stroke="#8a6420" stroke-width="1"/><path d="M6 6l3-1" stroke="#fff3c4" stroke-width="1.2"/></svg>`;

function chestSVG() {
  return `<svg viewBox="0 0 240 190" class="lbx-chest" aria-hidden="true">
  <g class="nuggets">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<circle class="ng ng${i}" cx="${92 + i * 8}" cy="92" r="${5 + (i % 3)}"/>`).join('')}</g>
  <rect x="34" y="88" width="172" height="84" rx="6" class="body"/>
  <rect x="34" y="88" width="172" height="12" class="band"/>
  <rect x="62" y="88" width="14" height="84" class="strap"/><rect x="164" y="88" width="14" height="84" class="strap"/>
  <rect x="106" y="104" width="28" height="30" rx="4" class="plate"/><circle cx="120" cy="116" r="4.5" class="hole"/>
  <rect x="117.5" y="118" width="5" height="10" class="hole"/>
  <g class="lid"><path d="M34 88 V62 Q120 22 206 62 V88 Z" class="lidtop"/><rect x="62" y="40" width="14" height="48" class="strap"/>
  <rect x="164" y="40" width="14" height="48" class="strap"/><rect x="34" y="80" width="172" height="8" class="band"/></g>
  ${[44, 196].map((x) => [98, 162].map((y) => `<circle cx="${x}" cy="${y}" r="3" class="rivet"/>`).join('')).join('')}</svg>`;
}

// A side written out as HTML, with a real fraction bar under a whole group over a number ((5x − 10)/2).
const fracBarHTML = (top, bottom) => `<span class="mfrac"><span class="mfrac-t">${top}</span><span class="mfrac-b">${esc(bottom)}</span></span>`;
function sideHTML(side) {
  if (!side.length) return '0';
  return side.map((t, i) => {
    if (t.t === 'b' && t.p.d > 1) {
      const neg = termNeg(t);
      const sign = i === 0 ? (neg ? MINUS : '') : neg ? ` ${MINUS} ` : ' + ';
      const n = Math.abs(t.p.n);
      return `${esc(sign)}${n === 1 ? '' : n}${fracBarHTML(mathHTML(sideText(t.in)), t.p.d)}`;
    }
    return mathHTML(termText(t, i === 0));
  }).join('');
}

// One chip for one term. first = it starts its side (no "+" in front).
function chipEl(t, first) {
  if (t.t === 'q') { const e = h('span', 'chip coin blank', '?'); return e; }
  if (t.t === 'b' && t.p.d > 1) {
    // a whole group over a number: the chips sit on top of a fraction bar
    const neg = termNeg(t);
    const e = h('span', 'chip brk over');
    const sign = neg ? MINUS : first ? '' : '+';
    if (sign) e.appendChild(h('span', 'brk-p', esc(sign)));
    const fr = h('span', 'over-fr');
    const top = h('span', 'over-top');
    t.in.forEach((u, j) => top.appendChild(chipEl(u, j === 0)));
    fr.appendChild(top);
    fr.appendChild(h('span', 'over-bot', esc(String(t.p.d))));
    e.appendChild(fr);
    return e;
  }
  if (t.t === 'b') {
    const neg = termNeg(t);
    const p = t.p.abs();
    const e = h('span', 'chip brk');
    const sign = neg ? MINUS : first ? '' : '+';
    e.appendChild(h('span', 'brk-p', esc(sign + (p.isOne() ? '' : fracText(p)))));
    e.appendChild(h('span', 'paren', '('));
    t.in.forEach((u, j) => e.appendChild(chipEl(u, j === 0)));
    e.appendChild(h('span', 'paren', ')'));
    return e;
  }
  const neg = termNeg(t);
  const sign = neg ? MINUS : first ? '' : '+';
  const zero = t.v.isZero();
  if (t.t === 'n') {
    const e = h('span', `chip coin ${zero ? 'zero' : neg ? 'neg' : 'pos'}`);
    e.innerHTML = `<span class="face">${t.v.isInt() ? esc(sign + Math.abs(t.v.n)) : `${esc(sign)}<span class="fr"><span>${Math.abs(t.v.n)}</span><span>${t.v.d}</span></span>`}</span>`;
    if ((sign + Math.abs(t.v.n)).length >= 3) e.classList.add('wide');
    return e;
  }
  const a = Math.abs(t.v.n), d = t.v.d;
  const top = `${a === 1 ? '' : a}<i class="x">x</i>`;
  const e = h('span', `chip card ${neg ? 'neg' : 'pos'}`);
  e.innerHTML = `<span class="face">${esc(sign)}${d === 1 ? top : `<span class="fr"><span>${top}</span><span>${d}</span></span>`}</span>`;
  return e;
}

function sideEl(side, name) {
  const e = h('span', `wside wside-${name}`);
  if (!side.length) { e.appendChild(chipEl({ t: 'n', v: F(0) }, true)); return e; }
  side.forEach((t, i) => {
    const c = chipEl(t, i === 0);
    c.dataset.side = name; c.dataset.i = i;
    e.appendChild(c);
  });
  return e;
}

function hingeEl() {
  return h('span', 'hinge', `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" class="pin"/>
  <circle cx="20" cy="20" r="14.5" class="pin-in"/><rect x="10" y="13.5" width="20" height="4.2" rx="2" class="bar"/>
  <rect x="10" y="22.3" width="20" height="4.2" rx="2" class="bar"/></svg><span class="sr">equals</span>`);
}

// A side of the start line with the key put in for x, as HTML: the key's number is lit (4·2 − 6, −(−3) + 1).
// It reads the same as engine.js keySteps' first step.
function keyInHTML(side, x) {
  const xs = x.n < 0 || !x.isInt() ? `(${fracText(x)})` : fracText(x);
  const val = (s) => `<b class="ck-val">${esc(s)}</b>`;
  const part = (t, lead) => {
    if (t.t === 'n' || t.t === 'q') return esc(t.t === 'q' ? fracText(x).replace(MINUS, '') : termBody(t));
    if (t.t === 'x') {
      const a = t.v.abs();
      const k = lead && !termNeg(t) ? fracText(x) : xs;
      if (a.d === 1) return a.isOne() ? val(k) : `${a.n}<b class="dot">${TIMES}</b>${val(xs)}`;
      return a.n === 1 ? `${val(k)}/${a.d}` : `${a.n}<b class="dot">${TIMES}</b>${val(xs)}/${a.d}`;
    }
    const inner = t.in.map((u, j) => (j === 0 ? (termNeg(u) ? MINUS : '') : termNeg(u) ? ` ${MINUS} ` : ' + ') + part(u, j === 0)).join('');
    if (t.p.d > 1) return fracBarHTML(inner, t.p.d);
    return `${t.p.abs().isOne() ? '' : esc(String(Math.abs(t.p.n)))}(${inner})`;
  };
  return side.map((t, i) => {
    const neg = t.t === 'q' ? x.n < 0 : termNeg(t);
    return (i === 0 ? (neg ? MINUS : '') : neg ? ` ${MINUS} ` : ' + ') + part(t, i === 0);
  }).join('');
}

// ---------- the panel ----------

export function openLockbox(root = document.body, opts = {}) {
  const { rider = null, box: firstInfo = {}, onDone = () => {}, onBox = null, next = null } = opts;
  ensureCss();
  const rng = makeRng(opts.seed ?? ((Math.random() * 2 ** 32) >>> 0));

  // the ladder state lives in the rider (or a scratch object when there is no rider, e.g. the test page)
  let algState;
  if (rider) {
    if (!rider.topics || typeof rider.topics !== 'object') rider.topics = {};
    if (!rider.topics.algebra || typeof rider.topics.algebra !== 'object') rider.topics.algebra = {};
    algState = rider.topics.algebra;
  } else algState = opts.algebraState || {};
  const alg = makeAlgebra(algState, { rng });

  // ----- the session: boxes back to back until "Done for now" -----
  const session = { results: [], gold: 0, solved: 0, unpaid: 0, cardPref: null, n: 0 };
  const own = firstInfo.from === 'loot';
  // the rest of the saddlebags, after the first box (each is opened in turn; one set aside stays in the bags)
  const bag = own && rider && Array.isArray(rider.lockboxes) ? rider.lockboxes.filter((b) => b && typeof b === 'object').map((b) => ({ tier: b.tier })) : [];
  { const i = bag.findIndex((b) => b.tier === firstInfo.tier); if (i >= 0) bag.splice(i, 1); else bag.shift(); }
  function nextInfo(last) {
    if (typeof next === 'function') { try { return next(last) || null; } catch (e) { console.error(e); return null; } }
    if (own) { const b = bag.shift(); return b ? { tier: b.tier, from: 'loot' } : null; }
    return { tier: last?.tier || firstInfo.tier, from: firstInfo.from || 'sheriff' };
  }
  const purseNow = () => (rider ? whole(rider.gold) : 0) + session.unpaid;

  // ----- the frame: the wood panel and its top strip stay put while the boxes slide through -----
  const el = h('div', 'lbx');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Lock box: solve for x');
  el.tabIndex = -1;
  const panel = h('div', 'lbx-panel');
  el.appendChild(panel);
  const top = h('header', 'lbx-top');
  top.innerHTML = `<div class="lbx-name"><span class="lbx-tier"></span><span class="lbx-rung"></span></div>
    <div class="lbx-lock" title="One tumbler per move of par"><div class="lbx-tumblers"></div><div class="lbx-par"></div></div>
    <div class="lbx-right"><div class="lbx-stars" aria-label="stars"></div>
      <div class="lbx-purse" title="Your gold"><span class="lbx-purse-coin">${COIN_SVG}</span><b class="lbx-purse-n">0</b></div>
      <button class="lbx-done" type="button">Done for now<kbd>Esc</kbd></button></div>`;
  panel.appendChild(top);
  const bodies = h('div', 'lbx-bodies');
  panel.appendChild(bodies);
  const flyLayer = h('div', 'lbx-fly');
  el.appendChild(flyLayer);
  const purseEl = top.querySelector('.lbx-purse'), purseN = top.querySelector('.lbx-purse-n');
  const doneBtn = top.querySelector('.lbx-done');
  purseN.textContent = String(purseNow());

  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  el.focus({ preventScroll: true });

  let closed = false;
  let cur = null;   // the box being worked (mountBox's controller)

  // ===================================================================================================================
  // One box: its page (steps card, paper, mat, tray), its moves and hints, the check and the lid.
  // finished(result, ctrl) is called once when it is solved and checked, or set aside.
  // ===================================================================================================================
  function mountBox(info, { problem: forced = null, finished }) {
    const tier = TIER_NAME[info.tier] ? info.tier : 'iron';
    let problem;
    if (forced) problem = forced;
    else if (opts.rung && RUNG[opts.rung]) {
      // a chosen rung (the test page, a dev shortcut); the result is still recorded in the ladder
      const p = generate(opts.rung, { rng, size: opts.size ?? 2, recent: algState.recent || [] });
      if (p && algState.recent) { algState.recent.push(p.key); if (algState.recent.length > 20) algState.recent.splice(0, algState.recent.length - 20); }
      problem = p ? { ...p, level: opts.level ?? 4, size: opts.size ?? 2, review: false, tier } : alg.next(tier);
    } else problem = alg.next(tier);
    const rung = RUNG[problem.rung];
    const stage = rung.stage;
    const level = opts.level ?? problem.level ?? 4;
    const B = makeBox(problem, { stage, level, rng, fav: alg.fav(), tier });
    const speed = opts.speed ?? alg.speed(problem.rung);   // seconds per move
    const K = speed / 0.8;                                // animation time scale
    const pickMode = problem.mode !== 'moves';
    const verdictMode = !!rung.verdicts;

    // ----- build the page -----
    const body = h('div', `lbx-body lbx-tier-${tier}`);
    body.style.setProperty('--k', K.toFixed(3));
    el.style.setProperty('--k', K.toFixed(3));
    el.className = el.className.replace(/\blbx-tier-\w+/g, '').trim() + ` lbx-tier-${tier}`;
    el.setAttribute('aria-label', `${TIER_NAME[tier]}: solve for x`);

    const stepsEl = h('section', 'lbx-steps');
    stepsEl.setAttribute('aria-label', 'The steps');
    body.appendChild(stepsEl);

    const paper = h('section', 'lbx-paper');
    paper.innerHTML = `<div class="lbx-start"><span class="lbx-start-k">Beginning</span><span class="lbx-start-l"></span></div>
      <div class="lbx-ledger" aria-label="your working"></div>`;
    body.appendChild(paper);

    const stageEl = h('section', 'lbx-stage');
    stageEl.innerHTML = `<div class="lbx-workwrap"><div class="lbx-work"></div><div class="lbx-picwrap"></div><div class="lbx-calcs"></div></div>
      <div class="lbx-rotate">Turn your phone sideways for bigger numbers</div>
      <div class="lbx-hob"><span class="lbx-hob-face">${HOB_SVG}</span><span class="lbx-hob-say" aria-live="polite"></span></div>
      <button class="lbx-leave" type="button" hidden>Skip this box</button>
      <div class="lbx-hurry" aria-hidden="true"><span class="lbx-kb">Enter or click: hurry</span><span class="lbx-tap">Tap: hurry</span></div>`;
    body.appendChild(stageEl);

    const tray = h('section', 'lbx-tray');
    tray.innerHTML = `<button class="lbx-undo lbx-side-btn" type="button"><span>Undo</span><kbd>U</kbd></button>
      <div class="lbx-grid"></div>
      <button class="lbx-ask lbx-side-btn" type="button"><span>Ask Hob</span><kbd>H</kbd></button>
      <div class="lbx-verdicts" ${verdictMode ? '' : 'hidden'}>
        <button type="button" data-verdict="all">Infinitely many solutions<small>every number works</small></button><button type="button" data-verdict="none">No solution<small>no number works</small></button></div>`;
    body.appendChild(tray);

    const $ = (s) => body.querySelector(s);
    const work = $('.lbx-work'), calcs = $('.lbx-calcs'), ledgerEl = $('.lbx-ledger'), grid = $('.lbx-grid');
    const say = $('.lbx-hob-say'), pics = $('.lbx-picwrap');
    const nlBox = h('div', 'lbx-nl');   // the number line's spot: in the ledger, right under the newest line
    if (rung.pictures) body.classList.add('has-pics');
    const leaveBtn = $('.lbx-leave'), undoBtn = $('.lbx-undo'), askBtn = $('.lbx-ask');
    $('.lbx-start-l').innerHTML = `${sideHTML(problem.start.L)} = ${sideHTML(problem.start.R)}`;

    // the top strip shows this box
    top.querySelector('.lbx-tier').textContent = TIER_NAME[tier];
    const where = { sheriff: 'Sheriff’s desk', loot: 'Saddlebags', practice: 'Just lock boxes' }[info.from] || 'Lock box';
    const skippedNow = session.results.filter((r) => !r.solved).length;   // (skipped boxes stay in the bags)
    const more = info.from === 'loot' && typeof next !== 'function'
      ? (bag.length ? ` · ${bag.length} more` : skippedNow ? ` · last one · ${skippedNow} skipped` : ' · the last one') : '';
    top.querySelector('.lbx-rung').innerHTML = `${esc(where + more)} · ${esc(rung.name)}${opts.dev || opts.debug ? ` <small>${esc(problem.rung)}</small>` : ''}`;
    top.querySelector('.lbx-tumblers').innerHTML = '';

    // ----- state -----
    let phase = 'play';          // play | anim | tidy | check | open | done
    let ff = false;              // fast-forward the current animation
    let gone = false;            // this box is finished (or the panel closed)
    let recorded = false;        // B.finish has run and the ladder has it
    const openedAt = performance.now();
    let lastAction = performance.now();
    let unhelpful = 0;
    const seenThisBox = new Set();

    const wait = async (ms) => {
      const end = performance.now() + ms * K;
      while (!ff && !gone && performance.now() < end) await sleep(Math.min(40, end - performance.now()));
    };

    function hob(text, mood = '') {
      say.textContent = text || '';
      say.dataset.mood = mood;
      say.classList.remove('fresh'); void say.offsetWidth; say.classList.add('fresh');
    }

    // ----- top strip -----
    function renderTop() {
      if (gone) return;
      const tum = top.querySelector('.lbx-tumblers');
      const par = B.par;
      const down = pickMode ? (B.solved ? 1 : 0) : Math.max(0, Math.min(par, par - B.togo));
      if (tum.children.length !== par) tum.innerHTML = Array.from({ length: par }, () => '<i class="tum"></i>').join('');
      [...tum.children].forEach((t, i) => t.classList.toggle('down', i < down));
      top.querySelector('.lbx-par').textContent = pickMode ? 'one try for 3 stars' : `par ${par} · moves ${B.moves}`;
      const s = pickMode ? Math.max(1, 3 - B.wrongPicks) : B.starsNow();
      const starsEl = top.querySelector('.lbx-stars');
      starsEl.innerHTML = [1, 2, 3].map((i) => STAR(i <= s)).join('');
      starsEl.setAttribute('aria-label', `${s} stars`);
      leaveBtn.hidden = !(B.canLeave((performance.now() - openedAt) / 1000) || opts.dev) || !['play', 'tidy', 'brackets'].includes(phase);
    }

    // ----- the steps card -----
    // Open on hard equations, folded into a small "Steps" bar on easy ones and on stamped rungs, faded near mastery;
    // the kid's own fold or unfold holds for the rest of the session.
    const stepState = {};
    let cardShown = 'folded';
    function buildSteps() {
      if (pickMode || !B.plan) { stepsEl.hidden = true; body.classList.add('no-steps'); return; }
      const mode = cardMode({ hard: B.plan.hard, stamped: (algState.stamped || []).includes(problem.rung), level: (algState.levels || {})[problem.rung] ?? 2 });
      cardShown = session.cardPref || mode;
      stepsEl.innerHTML = `<button class="st-bar" type="button" aria-expanded="false">
          <span class="st-title">Steps</span><span class="st-mini" aria-hidden="true">${STEPS.map((s) => `<i data-n="${s.n}">${s.n}</i>`).join('')}</span>
          <span class="st-nowtxt"></span><span class="st-chev" aria-hidden="true"></span></button>
        <div class="st-card">
          <p class="st-rule">${esc(GOLDEN_RULE)}</p>
          <ol class="st-list">${STEPS.map((s) => `<li class="st-row" data-n="${s.n}"><span class="st-n">${s.n}</span>
            <span class="st-txt">${wordsHTML(s.label)}</span><span class="st-note"></span></li>`).join('')}</ol>
        </div>`;
      stepsEl.querySelector('.st-bar').addEventListener('click', () => {
        const open = !stepsEl.classList.contains('open');
        cardShown = open ? 'open' : 'folded';
        session.cardPref = cardShown;
        setCard();
      });
      // on a phone the open card shows only the step being worked; a tap shows all six
      stepsEl.querySelector('.st-card').addEventListener('click', () => stepsEl.classList.toggle('all'));
      setCard();
      renderSteps();
    }
    function setCard() {
      const open = cardShown !== 'folded';
      stepsEl.classList.toggle('open', open);
      stepsEl.classList.toggle('folded', !open);
      stepsEl.classList.toggle('faded', cardShown === 'faded');
      if (!open) stepsEl.classList.remove('all');
      stepsEl.querySelector('.st-bar').setAttribute('aria-expanded', String(open));
      requestAnimationFrame(() => { if (!gone) fitLine(); });
    }
    function renderSteps({ checked = false } = {}) {
      if (pickMode || !B.plan) return;
      const st = B.steps({ checked });
      for (const s of st) {
        const row = stepsEl.querySelector(`.st-row[data-n="${s.n}"]`);
        const mini = stepsEl.querySelector(`.st-mini i[data-n="${s.n}"]`);
        const was = stepState[s.n];
        row.dataset.state = s.state;
        mini.dataset.state = s.state;
        if (was && was !== 'done' && s.state === 'done') { row.classList.remove('tick'); void row.offsetWidth; row.classList.add('tick'); }
        row.querySelector('.st-note').innerHTML = s.state === 'skip' ? `${esc(s.skip)} – ${SKIP_WORD}` : s.note ? wordsHTML(s.note) : '';
        if (s.state !== 'now') row.classList.remove('lit');
        stepState[s.n] = s.state;
      }
      const now = currentStep(st);
      stepsEl.querySelector('.st-nowtxt').innerHTML = now ? `<b>${now.n}</b> ${wordsHTML(now.short)}` : '';
      stepsEl.classList.toggle('alldone', !now);
    }
    // hint 1 lights the step being worked (and opens the card if it was folded)
    function lightStep(n) {
      if (pickMode || !n) return;
      if (cardShown === 'folded') { cardShown = 'open'; setCard(); }
      stepsEl.classList.remove('faded');
      const row = stepsEl.querySelector(`.st-row[data-n="${n}"]`);
      if (row) { row.classList.remove('lit'); void row.offsetWidth; row.classList.add('lit'); }
    }

    // ----- the ledger -----
    // Lines in the order they were written; undone lines are gone, struck lines (rewound by a jam) are crossed out,
    // and after a rewind the line we went back to is written again. Under each line: the move that came next.
    function sideCell(side, move, name) {
      const cell = h('span', `lg-side lg-${name}`);
      const box = h('span', 'lg-box');
      const txt = h('span', 'lg-txt', sideHTML(side));
      box.appendChild(txt);
      if (move && (move.k === 'div')) { box.classList.add('lg-div'); box.appendChild(h('span', 'lg-under lg-den', esc(fracText(move.f)))); }
      else if (move && move.k !== 'dist' && move.k !== 'comb') box.appendChild(h('span', 'lg-under', mathHTML(moveLabel(move))));
      cell.appendChild(box);
      return cell;
    }
    // pending = { move, mid }: while the kid picks the tidied line, the untidy line (4x − 6 + 6 = −8x + 18 + 6) is
    // written as the newest row, with the move under the line before it.
    function renderLedger(pending = null) {
      ledgerEl.innerHTML = '';
      const ents = B.ledger.map((e, i) => ({ ...e, i })).filter((e) => !e.undone);
      const rows = [];
      let prev = null;
      for (const e of ents) {
        if (e.i === 0) { rows.push({ e, again: false }); prev = e; continue; }
        if (e.parent !== prev.i) rows.push({ e: { ...B.ledger[e.parent], i: e.parent }, again: true });
        rows.push({ e, again: false });
        prev = e;
      }
      // after a jam the last rows are crossed out: write the line we went back to again, so the bottom row is always
      // the line being worked
      if (rows[rows.length - 1].e.i !== B.index) rows.push({ e: { ...B.entry, i: B.index }, again: true });
      if (pending) rows.push({ e: { line: pending.mid, move: pending.move, closer: null, struck: false, i: -1, parent: B.index }, again: false, raw: true });
      rows.forEach((r, k) => {
        const nxt = rows[k + 1];
        const move = nxt && !nxt.again && nxt.e.parent === r.e.i ? nxt.e.move : null;
        const row = h('div', 'lg-row');
        if (r.e.struck) row.classList.add('struck');
        if (r.again) row.classList.add('again');
        if (r.e.closer === false) row.classList.add('amber');
        if (k === rows.length - 1 && !r.e.struck) row.classList.add('now');
        if (r.raw) row.classList.add('raw');
        row.appendChild(h('span', 'lg-dot', r.e.closer === false ? '•' : ''));
        row.appendChild(sideCell(r.e.line.L, move, 'L'));
        row.appendChild(h('span', 'lg-eq', '='));
        row.appendChild(sideCell(r.e.line.R, move, 'R'));
        row.appendChild(h('span', 'lg-note', r.again ? 'back up to here' : r.raw ? 'tidy it up' : move ? mathHTML(moveNote(move)) : ''));
        ledgerEl.appendChild(row);
      });
      if (nl) ledgerEl.appendChild(nlBox);
      ledgerEl.scrollTop = ledgerEl.scrollHeight;
    }

    // ----- the working line -----
    function renderLine(l, cls = '') {
      work.innerHTML = '';
      const line = h('div', `wline ${cls}`);
      line.appendChild(sideEl(l.L, 'L'));
      line.appendChild(hingeEl());
      line.appendChild(sideEl(l.R, 'R'));
      work.appendChild(line);
      fitLine();
      if (cls === 'mid') pics.classList.add('moving');
      else { pics.classList.remove('moving'); renderPictures(l); }
      return line;
    }
    // Shrink the line to fit the width, never below the floor; it never wraps onto two lines.
    function fitLine() {
      const line = work.querySelector('.wline');
      if (!line) return;
      const max = parseFloat(getComputedStyle(el).getPropertyValue('--work-max')) || 44;
      const floor = 28;
      let size = max;
      line.style.fontSize = `${size}px`;
      const room = work.clientWidth - 8;
      while (line.scrollWidth > room && size > floor) { size -= 2; line.style.fontSize = `${size}px`; }
      // "tight" (the turn-your-phone note) is only judged on a settled line, not the wider one shown mid-move
      const mid = line.classList.contains('mid');
      if (line.scrollWidth > room) {
        const s = room / line.scrollWidth;
        line.style.transform = `scale(${s.toFixed(3)})`;
        if (!mid) body.classList.add('tight');
      } else { line.style.transform = ''; if (!mid) body.classList.remove('tight'); }
      placePictures();
    }

    // ----- the picture row: saddlebag = x, nugget = 1 (all-positive rungs only) -----
    // Each term's pictures sit directly under its chip, all on one row just below the line. They hide while a move
    // plays and come back under the new line.
    let picLine = null;
    function renderPictures(l) {
      if (!rung.pictures) return;
      const ok = [...l.L, ...l.R].every((t) => (t.t === 'n' && t.v.n >= 0 && t.v.isInt() && t.v.n <= 20)
        || (t.t === 'x' && t.v.n > 0 && t.v.n <= 9) || t.t === 'q');
      pics.innerHTML = '';
      pics.classList.toggle('fade', problem.rung === 'R4');
      pics.classList.toggle('off', !ok);
      picLine = ok ? l : null;
      if (!ok) return;
      for (const name of ['L', 'R']) {
        l[name].forEach((t, i) => {
          const c = h('span', 'pic-term');
          c.dataset.side = name; c.dataset.i = i;
          if (t.t === 'x') {
            for (let k = 0; k < t.v.n; k++) c.insertAdjacentHTML('beforeend', `<span class="pic-bag">${BAG_SVG}${t.v.d > 1 ? `<b>÷${t.v.d}</b>` : ''}</span>`);
          } else if (t.t === 'n') {
            for (let k = 0; k < t.v.n; k++) c.insertAdjacentHTML('beforeend', `<span class="pic-ng">${NUGGET_SVG}</span>`);
            if (t.v.n === 0) c.insertAdjacentHTML('beforeend', '<span class="pic-zero">nothing</span>');
          } else return;
          pics.appendChild(c);
        });
      }
      placePictures();
    }
    function placePictures() {
      if (!picLine || !pics.children.length) return;
      const line = work.querySelector('.wline');
      if (!line) return;
      const wr = $('.lbx-workwrap').getBoundingClientRect();
      const topY = line.getBoundingClientRect().bottom - wr.top + 14;
      for (const g of pics.children) {
        const c = work.querySelector(`.wside-${g.dataset.side} > [data-i="${g.dataset.i}"]`);
        if (!c) continue;
        const r = c.getBoundingClientRect();
        g.style.left = `${(r.left + r.right) / 2 - wr.left}px`;
        g.style.top = `${topY}px`;
      }
    }
    // tapping or hovering a chip lights its pictures, and the other way round
    function linkHover(e, on) {
      const t = e.target.closest('[data-side][data-i]');
      if (!t) return;
      const sel = `[data-side="${t.dataset.side}"][data-i="${t.dataset.i}"]`;
      body.querySelectorAll(sel).forEach((n) => n.classList.toggle('lit', on));
    }
    stageEl.addEventListener('pointerover', (e) => linkHover(e, true));
    stageEl.addEventListener('pointerout', (e) => linkHover(e, false));

    // ----- the tray -----
    function renderTray() {
      grid.innerHTML = '';
      grid.classList.remove('tidy');
      grid.style.height = '';
      grid.classList.toggle('picks', pickMode);
      if (pickMode) {
        problem.choices.forEach((v, i) => {
          const b = h('button', `lbx-move pick ${problem.mode === 'key' ? 'keypick' : ''}`);
          b.type = 'button';
          b.innerHTML = problem.mode === 'key' ? `<span class="keyicon">${KEY_SVG}</span><span class="lbl">${v}</span><kbd>${i + 1}</kbd>`
            : `<span class="chip coin pos"><span class="face">${v}</span></span><kbd>${i + 1}</kbd>`;
          b.dataset.value = v;
          b.addEventListener('click', () => choose(v, b));
          grid.appendChild(b);
        });
        return;
      }
      const bb = B.buttons;
      let shown = 0;
      bb.slots.forEach((s, i) => {
        if (!s) { grid.appendChild(h('span', 'lbx-move empty', '')); return; }
        shown++;
        const b = h('button', `lbx-move ${s.move.k === 'add' ? 'row-add' : 'row-mul'}`);
        b.type = 'button';
        const wide = s.move.k === 'dist' || s.move.k === 'comb';
        if (wide) b.classList.add('wordy');
        const icon = s.move.k === 'flip' ? '<span class="flipicon" aria-hidden="true"></span>' : '';
        b.innerHTML = `${icon}<span class="lbl">${mathHTML(s.label)}</span><kbd>${shown}</kbd>`;
        b.dataset.key = s.key;
        b.dataset.move = s.id;
        b.addEventListener('click', () => press(i));
        grid.appendChild(b);
      });
      // a new kind of button gets one line from Hob the first time it shows up
      for (const s of bb.slots.filter(Boolean)) {
        const kind = s.move.k === 'add' ? `add${s.move.term.t}` : s.move.k;
        if (alg.seenTool(kind) || seenThisBox.has(kind)) continue;
        seenThisBox.add(kind);
        const line = { addx: 'New: x-terms can move too.', div: 'New: ÷ splits both sides evenly.', mul: 'New: · multiplies both sides.',
          flip: 'New: ·(−1) flips every chip over.', dist: 'New: open the brackets (distribute).', comb: 'New: like terms can join up.' }[kind];
        if (line && B.moves > 0 && !['warn', 'hint', 'good'].includes(say.dataset.mood)) { hob(line); break; }   // (never over a hint or praise)
      }
    }
    function setTrayEnabled(on) {
      body.classList.toggle('busy', !on);
      // (a coin or key already tried and wrong stays out of play)
      grid.querySelectorAll('button').forEach((b) => { b.disabled = !on || b.classList.contains('used'); });
      undoBtn.disabled = !on || B.trail.length < 2 || pickMode;
      askBtn.disabled = !on;
      body.querySelectorAll('.lbx-verdicts button').forEach((b) => { b.disabled = !on; });
    }

    // ----- animations -----
    function chipAt(side, i) { return work.querySelector(`.wside-${side} > [data-i="${i}"]`); }
    function calcTag(text, nearEls, kind) {
      const wr = $('.lbx-workwrap').getBoundingClientRect();
      const rs = nearEls.filter(Boolean).map((n) => n.getBoundingClientRect());
      if (!rs.length) return null;
      const x = (Math.min(...rs.map((r) => r.left)) + Math.max(...rs.map((r) => r.right))) / 2 - wr.left;
      const y = Math.min(...rs.map((r) => r.top)) - wr.top;
      const t = h('span', `calc ${kind || ''}`, mathHTML(text));
      t.style.left = `${x}px`;
      t.style.top = `${y}px`;
      calcs.appendChild(t);
      // keep it inside the stage, and step it up above any sum it would cover (dividing prints one per term)
      const tr = t.getBoundingClientRect();
      const dx = tr.left < wr.left + 4 ? wr.left + 4 - tr.left : tr.right > wr.right - 4 ? wr.right - 4 - tr.right : 0;
      if (dx) t.style.left = `${x + dx}px`;
      for (let guard = 0; guard < 4; guard++) {
        const a = t.getBoundingClientRect();
        const hit = [...calcs.children].find((o) => {
          if (o === t || o.classList.contains('gone')) return false;
          const b = o.getBoundingClientRect();
          return a.left < b.right + 4 && a.right > b.left - 4 && a.top < b.bottom + 3 && a.bottom > b.top - 3;
        });
        if (!hit) break;
        t.style.top = `${parseFloat(t.style.top) - (a.bottom - hit.getBoundingClientRect().top) - 6}px`;
      }
      return t;
    }
    function wobble() {
      const hg = work.querySelector('.hinge');
      if (!hg) return;
      hg.classList.remove('wobble'); void hg.offsetWidth; hg.classList.add('wobble');
    }

    // tc: the tidied-line cards on the do-the-arithmetic level (the kid picks one after the twins land, before any
    // chips merge); judge: judges the press (B.press), called once the kid has picked, or by press() straight away
    async function animateMove(res, tc = null, judge = null) {
      ff = false;
      calcs.innerHTML = '';
      const m = res.move;
      if (m.k === 'add') {
        // the coin splits into twins that land on both sides at the same moment
        renderLine(res.mid, 'mid');
        for (const s of ['L', 'R']) chipAt(s, res.mid[s].length - 1)?.classList.add('twin');
        await wait(380);
        if (tc) { await tidyStage(tc, m); ff = false; }
        if (judge) judge();
        // the first few times a sum mixes a negative and a positive, the number line shows the hop
        const mix = mixedSum(res.before, m);
        if (mix && !nl && alg.numberLineDue()) { showNL(mix.a, mix.b); alg.sawNumberLine(); }
        for (const s of ['L', 'R']) {
          for (const ev of res.ev[s]) {
            const a = ev.a !== undefined ? chipAt(s, ev.a) : null, b = chipAt(s, ev.b);
            if (ev.kind === 'zero') { a?.classList.add('poof'); b?.classList.add('poof'); calcTag(ev.text, [a, b], 'zero'); }
            else if (ev.kind === 'merge') {
              if (a && b) {
                const dx = a.getBoundingClientRect().left - b.getBoundingClientRect().left;
                b.style.setProperty('--dx', `${dx}px`);
                b.classList.add('slide');
              }
              calcTag(ev.text, [a, b], 'merge');
            }
          }
        }
        await wait(520);
      } else if (m.k === 'div' || m.k === 'mul' || m.k === 'flip') {
        const line = renderLine(res.before, 'mid');
        if (m.k === 'div') {
          for (const s of ['L', 'R']) {
            const side = line.querySelector(`.wside-${s}`);
            side.classList.add('over');
            side.insertAdjacentHTML('beforeend', `<span class="den">${esc(fracText(m.f))}</span>`);
          }
          await wait(420);
          for (const s of ['L', 'R']) {
            res.ev[s].forEach((ev) => {
              const a = chipAt(s, ev.a);
              const before = res.before[s][ev.a], after = res.out[s].slice(ev.to, ev.to + ev.n);
              if (before && after.length) calcTag(`${termBody(before) === '0' ? '0' : (termNeg(before) ? MINUS : '') + termBody(before)} ÷ ${fracText(m.f).length > 1 && m.f.n < 0 ? `(${fracText(m.f)})` : fracText(m.f)} = ${sideText(after)}`, [a], 'merge');
            });
          }
        } else if (m.k === 'flip') {
          line.querySelectorAll('.chip').forEach((c) => c.classList.add('flipping'));
          calcTag(`${TIMES}(${MINUS}1): every chip flips`, [line], 'merge');
        } else {
          for (const s of ['L', 'R']) {
            line.querySelector(`.wside-${s}`).insertAdjacentHTML('beforeend', `<span class="times">${esc(moveLabel(m))}</span>`);
          }
          await wait(300);
          for (const s of ['L', 'R']) {
            res.ev[s].forEach((ev) => {
              const before = res.before[s][ev.a], after = res.out[s].slice(ev.to, ev.to + ev.n);
              if (before && after.length) calcTag(`${(termNeg(before) ? MINUS : '') + termBody(before)} ${TIMES} ${m.f.n < 0 ? `(${fracText(m.f)})` : fracText(m.f)} = ${sideText(after)}`, [chipAt(s, ev.a)], 'merge');
            });
          }
        }
        await wait(560);
      } else if (m.k === 'dist' && res.asked) {
        // the kid has worked out every product already: the new terms just settle in
        await wait(120);
      } else if (m.k === 'dist' || m.k === 'comb') {
        renderLine(res.before, 'mid');
        for (const s of ['L', 'R']) {
          for (const ev of res.ev[s]) {
            const els = ev.kind === 'expand' ? [chipAt(s, ev.a)] : [...work.querySelectorAll(`.wside-${s} > .chip`)];
            els.forEach((c) => c?.classList.add('pulse'));
            calcTag(ev.text, els, 'merge');
            // combining two numbers of opposite signs gets the number line too, the first few times
            const v = ev.kind === 'join' && ev.t === 'n' && ev.vals;
            if (v && v.length === 2 && Math.sign(v[0]) !== Math.sign(v[1]) && v[0] + v[1] !== 0 && !nl && alg.numberLineDue()) {
              showNL(v[0], v[1]);
              alg.sawNumberLine();
            }
          }
        }
        await wait(800);
      }
      if (gone) return;
      // the new line, the hinge wobbles and settles
      const line = renderLine(res.out, 'settle');
      // the new line can come out bigger than the in-between one (fewer chips to fit): keep the printed sums above it
      const lineTop = line.getBoundingClientRect().top - $('.lbx-workwrap').getBoundingClientRect().top;
      calcs.querySelectorAll('.calc').forEach((c) => { if (parseFloat(c.style.top) > lineTop) c.style.top = `${lineTop}px`; });
      for (const s of ['L', 'R']) for (const ev of res.ev[s] || []) {
        if (ev.kind === 'merge' && ev.to >= 0) chipAt(s, ev.to)?.classList.add('pop');
      }
      if (m.k === 'flip') line.querySelectorAll('.chip').forEach((c) => c.classList.add('unflip'));
      wobble();
      setTimeout(() => calcs.querySelectorAll('.calc').forEach((c) => c.classList.add('gone')), ff ? 0 : 700 * K);
      await wait(260);
      ff = false;
    }

    // ----- the number line, sketched in the ledger right under the newest line -----
    // (on the paper rather than the mat, so the working line never moves or gets covered)
    let nl = null;
    function clearNL() {
      if (nl) { try { nl.remove(); } catch (e) { /* already gone */ } nl = null; }
      nlBox.remove();
      body.classList.remove('nl-on');
    }
    // extra: numberline.js options (picked = the kid's wrong answer marked on the line; reveal = false hides the landing)
    function showNL(start, change, extra = {}) {
      clearNL();
      try {
        body.classList.add('nl-on');
        ledgerEl.appendChild(nlBox);
        // the room on the paper; on a phone the sketch has a height cap, so it is laid out wider and drawn smaller,
        // which keeps it the full width of the paper
        const cs = getComputedStyle(nlBox);
        const room = Math.max(240, nlBox.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
        const maxH = parseFloat(cs.getPropertyValue('--nl-max-h')) || 0;
        let width = room;
        for (let i = 0; maxH && i < 3; i++) {
          const L = layoutNumberLine({ start, change, ...extra, width, size: 'full' });
          if (L.H * room / L.W <= maxH + 1) break;
          width = Math.round(Math.min(room * 1.7, room * L.H / maxH));   // never so wide the words get tiny
        }
        nl = showNumberLine(nlBox, { start, change, theme: 'light', width, ...extra });
        ledgerEl.scrollTop = ledgerEl.scrollHeight;
      } catch (e) { console.error(e); nl = null; body.classList.remove('nl-on'); }
    }
    // The sum a move makes that starts below zero or crosses it (−10 + 18, 5 − 8), or null (see weakSpot).
    function mixedSum(line, move) {
      const got = sumsOf(line, move);
      return got?.sums.find((x) => x.kind === 'n' && weakSpot(x.a, x.b)) || null;
    }

    // ----- do the arithmetic (level 5): the kid picks the tidied line -----
    // The untidy line stays on the mat and in the ledger; the tray holds three lines laid out the same way. A wrong
    // card shakes, Hob says which sum went wrong, and the number line shows it with the kid's pick marked. Resolves
    // once the right card is picked.
    let tidyKey = null;    // keys 1-3 while the cards are up
    let tidyHelp = null;   // Ask Hob while the cards are up
    function tidyStage(tc, move) {
      return new Promise((resolve) => {
        phase = 'tidy';
        renderLedger({ move, mid: tc.mid });
        const keepH = grid.offsetHeight;
        grid.style.height = `${keepH}px`;   // the tray keeps its height, so nothing above it moves
        grid.innerHTML = '';
        grid.classList.add('tidy');
        body.classList.remove('busy');
        askBtn.disabled = false;
        hob('Tidy it up. Which line is right?', 'hint');
        // the sum most worth a picture: a negative and a positive first
        const pictureSum = tc.sums.find((x) => x.kind === 'n' && weakSpot(x.a, x.b)) || tc.sums.find((x) => x.kind === 'n' && x.mixed && x.c !== 0) || tc.sums.find((x) => x.kind === 'n') || null;
        const hes = watchHesitation({
          after: TIDY_HESITATE_MS,
          onShow: () => { if (phase === 'tidy' && pictureSum && !nl) showNL(pictureSum.a, pictureSum.b, { reveal: false }); },
        });
        const btns = tc.cards.map((c, i) => {
          const b = h('button', 'lbx-move tidycard', `<span class="lbl">${mathHTML(c.text)}</span><kbd>${i + 1}</kbd>`);
          b.type = 'button';
          b.dataset.right = c.right ? '1' : '0';
          b.addEventListener('click', () => pick(c, b));
          grid.appendChild(b);
          return b;
        });
        // (the cards stay, greyed, until the tray is redrawn after the move, so the tray never changes height mid-move)
        const done = () => {
          hes.cancel();
          tidyKey = null; tidyHelp = null;
          phase = 'anim';
          body.classList.add('busy');
          askBtn.disabled = true;
          resolve();
        };
        stopTidy = () => { hes.cancel(); tidyKey = null; tidyHelp = null; resolve(); };
        function pick(c, b) {
          if (phase !== 'tidy' || b.disabled) return;
          lastAction = performance.now();
          hes.answered();
          if (B.tidyPick(c)) {
            b.classList.add('right');
            btns.forEach((o) => { o.disabled = true; });
            hob('');
            setTimeout(done, 380 * K);
            return;
          }
          b.classList.add('shake', 'used');
          b.disabled = true;
          hob(slipLine(c, move), 'warn');
          if (c.tag !== 'oneside' && c.sum?.kind === 'n') showNL(c.sum.a, c.sum.b, c.wrongValue !== null ? { picked: c.wrongValue } : {});
          else if (pictureSum && !nl) showNL(pictureSum.a, pictureSum.b);
          renderTop();
        }
        tidyKey = (i) => { const b = btns[i]; if (b && !b.disabled) b.click(); };
        tidyHelp = () => {
          lastAction = performance.now();
          hob('Work out each sum on its own.', 'hint');
          if (pictureSum) showNL(pictureSum.a, pictureSum.b, { reveal: false });
        };
      });
    }
    let stopTidy = null;
    let distRedraw = null;   // redraws the bracket arcs when the mat changes size

    // ----- open the brackets by hand -----
    // A line runs from the number outside the brackets to each term inside, with "5·x" and "5·8" written under them;
    // the tray asks one product at a time (four answers). A right pick fills the product in; a wrong one shakes, Hob
    // gives a nudge and the right answer stays to pick. Wrong picks cost no move and no stars. Resolves once every
    // product is in.
    function bracketStage(qs) {
      return new Promise((resolve) => {
        phase = 'brackets';
        calcs.innerHTML = '';
        body.classList.add('brackets-on');
        renderLine(B.line, '');
        const wrap = $('.lbx-workwrap');
        const layer = h('div', 'lbx-dist');
        wrap.appendChild(layer);
        const keepH = grid.offsetHeight;
        grid.style.height = `${keepH}px`;   // the tray keeps its height, so nothing above it moves
        body.classList.remove('busy');
        askBtn.disabled = false;
        undoBtn.disabled = true;
        // the arcs and the labels under the terms
        const labels = [];
        const draw = () => {
          layer.innerHTML = '';
          labels.length = 0;
          const wr = wrap.getBoundingClientRect();
          const lineEl = work.querySelector('.wline');
          const lineBottom = lineEl.getBoundingClientRect().bottom - wr.top;
          const NS = 'http://www.w3.org/2000/svg';
          const svg = document.createElementNS(NS, 'svg');
          svg.setAttribute('class', 'dist-arcs');
          svg.setAttribute('width', String(wr.width));
          svg.setAttribute('height', String(wr.height));
          svg.innerHTML = '<defs><marker id="dist-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="dist-head"/></marker></defs>';
          layer.appendChild(svg);
          const labelY = lineBottom + (wr.width < 600 ? 38 : 64);
          qs.forEach((q, k) => {
            const chip = chipAt(q.side, q.index);
            if (!chip) return;
            const pEl = chip.querySelector(':scope > .brk-p');
            const inner = chip.querySelectorAll(':scope > .chip')[q.j];
            if (!pEl || !inner) return;
            const pr = pEl.getBoundingClientRect(), ir = inner.getBoundingClientRect();
            const x0 = (pr.left + pr.right) / 2 - wr.left, y0 = pr.bottom - wr.top + 4;
            const x1 = (ir.left + ir.right) / 2 - wr.left, y1 = labelY - 2;
            const path = document.createElementNS(NS, 'path');
            // drops from the outside number and lands straight down on the label, so the lines fan out
            const bend = (y1 - y0) * 0.6;
            path.setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)} C${x0.toFixed(1)} ${(y0 + bend).toFixed(1)} ${x1.toFixed(1)} ${(y1 - bend).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`);
            path.setAttribute('class', 'dist-arc');
            path.setAttribute('marker-end', 'url(#dist-head)');
            path.dataset.k = k;
            svg.appendChild(path);
            const lab = h('span', 'dist-lab', `<span class="dist-q">${mathHTML(q.under)}</span><span class="dist-a">?</span>`);
            lab.style.left = `${x1}px`;
            lab.style.top = `${labelY}px`;
            lab.dataset.k = k;
            layer.appendChild(lab);
            labels[k] = { lab, path };
          });
        };
        draw();
        distRedraw = () => { draw(); mark(); };
        let k = 0, btns = [];
        const mark = () => {
          labels.forEach((L, i) => {
            if (!L) return;
            L.lab.classList.toggle('now', i === k);
            L.path.classList.toggle('now', i === k);
            if (i < k) { L.lab.classList.add('done'); L.path.classList.add('done'); L.lab.querySelector('.dist-a').innerHTML = mathHTML(qs[i].answer); }
          });
        };
        const ask = () => {
          const q = qs[k];
          mark();
          hob(`${q.prompt} = ?`, 'hint');
          grid.innerHTML = '';
          btns = q.choices.map((c, i) => {
            const b = h('button', 'lbx-move prodpick', `<span class="lbl">${mathHTML(c.text)}</span><kbd>${i + 1}</kbd>`);
            b.type = 'button';
            b.dataset.right = c.right ? '1' : '0';
            b.addEventListener('click', () => pick(c, b));
            grid.appendChild(b);
            return b;
          });
        };
        const finish = () => {
          tidyKey = null; tidyHelp = null; stopTidy = null; distRedraw = null;
          layer.remove();
          body.classList.remove('brackets-on');
          grid.style.height = '';
          hob('');
          resolve();
        };
        stopTidy = () => { tidyKey = null; tidyHelp = null; distRedraw = null; layer.remove(); resolve(); };
        function pick(c, b) {
          if (phase !== 'brackets' || b.disabled) return;
          lastAction = performance.now();
          const q = qs[k];
          if (c.right) {
            b.classList.add('right');
            btns.forEach((o) => { o.disabled = true; });
            k++;
            mark();
            if (k < qs.length) { hob('Right.', 'good'); setTimeout(() => { if (!gone) ask(); }, 420 * K); }
            else { hob(`${sideText(qs.map((x) => x.product))}. Brackets open.`, 'good'); setTimeout(() => { if (!gone) finish(); }, 700 * K); }
            return;
          }
          B.productPick(false);
          b.classList.add('shake', 'used');
          b.disabled = true;
          hob(productNudge(q, c), 'warn');
        }
        tidyKey = (i) => { const b = btns[i]; if (b && !b.disabled) b.click(); };
        tidyHelp = () => { lastAction = performance.now(); hob(productHelp(qs[k]), 'hint'); };
        ask();
      });
    }

    // ----- what happens on a press -----
    async function press(i) {
      if (phase !== 'play' || gone) return;
      const s = B.buttons?.slots?.[i];
      if (!s) return;
      phase = 'anim';
      setTrayEnabled(false);
      lastAction = performance.now();
      body.querySelectorAll('.glow').forEach((n) => n.classList.remove('glow'));
      clearNL();
      // the move starts playing at once; the search that judges it (up to a few tenths of a second on the longest
      // rungs) runs while the coins are in the air. On the do-the-arithmetic level it waits until the kid has picked
      // the tidied line.
      // open the brackets by hand: each product is asked first (the move itself is judged and counted as usual)
      let asked = false;
      if (s.move.k === 'dist') {
        const qs = bracketProducts(B.line, { rng });
        if (qs.length) { await bracketStage(qs); asked = true; if (gone) return; phase = 'anim'; setTrayEnabled(false); }
      }
      const shown = applyMove(B.line, s.move, true);
      const tc = level >= ARITH_LEVEL ? tidyChoices(B.line, s.move, { rng, fav: alg.favArith() }) : null;
      let res = null;
      const judge = () => { if (!res) res = B.press(s.move); };
      const anim = animateMove({ move: s.move, before: B.line, mid: shown.mid || null, out: shown.out, ev: shown.ev, asked }, tc, judge);
      if (!tc) { await nextFrame(); await nextFrame(); judge(); }
      await anim;
      judge();
      if (gone) return;
      renderLedger();
      renderTop();
      renderSteps();
      if (res.solved) {
        hob(`x = ${fracText(B.keyTest()?.x ?? F(0))}. Check the solution in the beginning equation.`, 'good');
        await sleep(420 * K);
        runCheck();
        return;
      }
      if (res.closer) { if (res.shortcut) hob('A shortcut! That works too.', 'good'); else hob(''); unhelpful = 0; }
      else {
        unhelpful++;
        if (res.opposite) {
          const num = [...res.out.L, ...res.out.R].find((t) => t.t === 'n');
          hob(`The opposite of x is ${fracText(num.v)}. Not done yet.`, 'warn');
        } else hob(notCloserLine(res), 'warn');
      }
      if (res.jam) {
        await sleep(500 * K);
        hob("Box jammed. Let's back up.", 'warn');
        panel.classList.add('jam');
        await sleep(650);
        panel.classList.remove('jam');
        if (gone) return;
        calcs.innerHTML = '';
        clearNL();
        renderLine(B.line, 'settle');
        wobble();
        renderLedger();
        renderSteps();
        B.makeButtons();
        renderTray();
        renderTop();
        showHint(B.hintAt(1), true);
      } else {
        B.makeButtons();
        renderTray();
      }
      phase = 'play';
      setTrayEnabled(true);
      renderTop();
    }

    function notCloserLine(res) {
      const evs = [...(res.ev.L || []), ...(res.ev.R || [])];
      const grew = evs.some((e) => e.kind === 'merge' && /=\s*[−-]?\d/.test(e.text) && (() => {
        const nums = e.text.match(/\d+/g)?.map(Number) || [];
        return nums.length >= 3 && nums[nums.length - 1] > Math.max(nums[0], nums[1]);
      })());
      if (res.tag === 'part') return "Part of it. x isn't alone.";
      if (res.tag === 'undo') return 'That undo doesn’t match.';
      if (res.tag === 'inside') return res.before && [...res.before.L, ...res.before.R].some((t) => t.t === 'b' && t.p.d > 1)
        ? 'That number is stuck over the bar. Clear the division first.' : 'That number is inside brackets.';
      if (grew) return 'That got bigger, not gone.';
      return 'Legal, but not closer.';
    }

    function undo() {
      if (phase !== 'play' || pickMode) return;
      if (!B.undo()) return;
      lastAction = performance.now();
      calcs.innerHTML = '';
      clearNL();
      renderLine(B.line, 'settle');
      wobble();
      renderLedger();
      renderSteps();
      B.makeButtons();
      renderTray();
      renderTop();
      hob('Taken back. The press still counts.');
      setTrayEnabled(true);
    }

    // ----- hints -----
    function showHint(hint, auto = false) {
      body.querySelectorAll('.wiggle,.peek,.glow').forEach((n) => n.classList.remove('wiggle', 'peek', 'glow'));
      clearNL();
      hob(hint.text, 'hint');
      if (hint.level === 1) {
        for (const t of hint.targets) chipAt(t.side, t.index)?.classList.add('wiggle');
        lightStep(hint.step);
      } else if (hint.level === 2) {
        for (const t of hint.targets) {
          const c = chipAt(t.side, t.index);
          if (!c) continue;
          c.classList.add('wiggle');
          if (hint.flip) {   // the coin flips to show its opposite face
            const peek = chipEl({ t: hint.flip.term.t, v: hint.flip.term.v }, false);
            peek.classList.add('peekface');
            c.classList.add('peek');
            c.appendChild(peek);
          }
        }
        // when that move will add a negative and a positive, the number line shows how the sum works out
        const mix = hint.move ? mixedSum(B.line, hint.move) : null;
        if (mix) showNL(mix.a, mix.b);
      } else if (hint.level === 3) {
        const b = grid.querySelector(`[data-key="${CSS.escape(hint.key || '')}"]`);
        if (b) b.classList.add('glow');
        for (const t of hint.targets) chipAt(t.side, t.index)?.classList.add('wiggle');
      }
      if (!auto) renderTop();
    }
    function askHob() {
      if (phase === 'tidy' || phase === 'brackets') { tidyHelp?.(); return; }
      if (phase !== 'play') return;
      lastAction = performance.now();
      askBtn.classList.remove('bounce');
      if (pickMode) { const hh = B.hint(); hob(hh.text, 'hint'); if (hh.level === 3) grid.querySelector(`[data-value="${problem.answer}"]`)?.classList.add('glow'); renderTop(); return; }
      showHint(B.hint());
      renderTop();
    }

    // ----- R15: infinitely many solutions / no solution -----
    function verdict(v) {
      if (phase !== 'play') return;
      lastAction = performance.now();
      const r = B.verdict(v);
      renderTop();
      if (r.ok) {
        hob(v === 'all' ? 'Both sides match, so every number works: infinitely many solutions!' : 'x is gone and the numbers differ: no solution!', 'good');
        renderSteps({ checked: true });
        phase = 'anim';
        setTrayEnabled(false);
        setTimeout(() => finish(), 700 * K);
        return;
      }
      if (!r.shown) hob('Not clear yet. Keep tidying.', 'warn');
      else hob(r.shown === 'all' ? 'Both sides match. Look again.' : 'Those numbers never match. Look again.', 'warn');
    }

    // ----- warm-up rungs: pick a coin or a key -----
    async function choose(v, btn) {
      if (phase !== 'play') return;
      phase = 'anim';
      setTrayEnabled(false);
      lastAction = performance.now();
      const r = B.choose(v);
      const L = problem.start.L, R = problem.start.R;
      const tryLine = problem.mode === 'key'
        ? { L: L.map((t) => (t.t === 'x' ? { t: 'q' } : t)), R }
        : problem.start;
      const line = renderLine(tryLine, 'mid');
      line.querySelectorAll('.blank').forEach((c) => { c.classList.remove('blank'); c.classList.add('pos', 'twin'); c.innerHTML = `<span class="face">${v}</span>`; });
      await sleep(380 * K);
      const lv = evalSide(L, F(v)), rv = evalSide(R, F(v));
      calcTag(`${sideText(L).replace('?', v).replace(/^x/, v)} = ${fracText(lv)}`, [line.querySelector('.wside-L')], 'merge');
      calcTag(`${sideText(R).replace('?', v)} = ${fracText(rv)}`, [line.querySelector('.wside-R')], 'merge');
      await sleep(700 * K);
      if (gone) return;
      renderTop();
      if (r.ok) {
        wobble();
        line.querySelector('.hinge')?.classList.add('locked');
        hob(`${fracText(lv)} = ${fracText(rv)}. Balanced!`, 'good');
        await sleep(600 * K);
        finish();
        return;
      }
      btn.classList.add('shake', 'used');
      work.querySelector('.wline')?.classList.add('tilt');
      hob(problem.mode === 'key' ? `x = ${v} makes ${fracText(lv)}, not ${fracText(rv)}.` : `That side makes ${fracText(problem.start.L.some((t) => t.t === 'q') ? lv : rv)}, the other ${fracText(problem.start.L.some((t) => t.t === 'q') ? rv : lv)}.`, 'warn');
      await sleep(900 * K);
      if (gone) return;
      calcs.innerHTML = '';
      renderLine(problem.start);
      phase = 'play';
      setTrayEnabled(true);
      btn.disabled = true;
    }

    // ----- the check: x drops into the BEGINNING equation and each side works itself out, a step at a time: the kid
    // taps Next (or Enter / Space) to see the next step, so the working and the number-line hops can be read -----
    let nextGo = null;           // the check's Next: resolves the wait for the next step
    const goNext = () => { if (nextGo) { const f = nextGo; nextGo = null; f(); } };
    // Both sides run their steps together (4·2 − 6 → 8 − 6 → 2); a side that comes down to a negative and a positive
    // (−16 + 18) flashes the number-line hop under it. Both land on the same number, the hinge locks, the lid opens.
    async function runCheck() {
      if (gone) return;
      const kt = problem.kind === 'all' || problem.kind === 'none' ? null : B.keyTest();
      if (!kt) { finish(); return; }
      phase = 'check';
      ff = false;
      setTrayEnabled(false);
      body.classList.add('checking');
      calcs.innerHTML = '';
      clearNL();
      pics.classList.add('off');
      paper.querySelector('.lbx-start').classList.add('lit');
      const val = fracText(kt.x);
      const steps = { L: kt.left, R: kt.right };
      work.innerHTML = `<div class="ck">
        <div class="ck-head"><span class="ck-key">${KEY_SVG}<b>${esc(val)}</b></span><span class="ck-title">${mathHTML('x =')} <b class="ck-n">${esc(val)}</b> in the beginning equation</span></div>
        <div class="ck-line"><div class="ck-side" data-s="L"><span class="ck-txt">${sideHTML(problem.start.L)}</span></div>${hingeEl().outerHTML}<div class="ck-side" data-s="R"><span class="ck-txt">${sideHTML(problem.start.R)}</span></div></div>
        <div class="ck-nls"><div class="ck-nl" data-s="L"></div><div class="ck-nl" data-s="R"></div></div>
        <button type="button" class="ck-next" hidden>Next</button></div>`;
      // the first few boxes of a sitting say so right under the check, where the kid is looking (later, and on a
      // phone, only the quiet note in the corner)
      body.classList.toggle('hurry-near', session.solved < QUICK_AFTER);
      const sideBox = (s) => work.querySelector(`.ck-side[data-s="${s}"]`);
      const setText = (s, html, cls = '') => {
        const t = h('span', `ck-txt ${cls}`, html);
        const old = sideBox(s).querySelector('.ck-txt');
        old.replaceWith(t);
      };
      fitCheck();
      const q = 1;
      const nextBtn = work.querySelector('.ck-next');
      nextBtn.addEventListener('click', (e) => { e.stopPropagation(); goNext(); });
      // wait for the kid's Next (the button shows, labelled as given)
      const next = (label = 'Next') => new Promise((res) => {
        if (gone) { res(); return; }
        nextBtn.textContent = label; nextBtn.hidden = false; nextBtn.focus({ preventScroll: true });
        nextGo = () => { nextBtn.hidden = true; res(); };
      });
      await wait(520);
      if (gone) return;
      // the key's number drops in for every x
      for (const s of ['L', 'R']) setText(s, keyInHTML(problem.start[s], kt.x), 'in');
      fitCheck();
      await next();
      // then the working out, a step at a time on both sides together
      const longest = Math.max(steps.L.length, steps.R.length);
      for (let k = 1; k < longest && !gone; k++) {
        const hops = [];
        for (const s of ['L', 'R']) {
          if (k >= steps[s].length) continue;
          const last = k === steps[s].length - 1;
          // a sum that starts below zero or crosses it (−16 + 18) stays on its side while the hop under it works it
          // out; the side turns into the answer when the hop lands, so the picture comes before the result
          const pair = last ? twoTerms(steps[s][k - 1]) : null;
          if (pair && weakSpot(pair[0], pair[1])) {
            sideBox(s).classList.add('hopping');
            hops.push({ s, line: flashHop(s, pair[0], pair[1]), html: mathHTML(steps[s][k]) });
          } else setText(s, mathHTML(steps[s][k]), last ? 'in final' : 'in');
        }
        fitCheck();
        if (!hops.length) { if (k < longest - 1) await next(); continue; }
        await hopsLanded(hops.map((hp) => hp.line));
        if (gone) break;
        for (const hp of hops) { sideBox(hp.s).classList.remove('hopping'); setText(hp.s, hp.html, 'in final landed'); }
        fitCheck();
        if (k < longest - 1) await next();
      }
      if (gone) return;
      // both sides land on the same number: the key fits
      const a = steps.L[steps.L.length - 1], b = steps.R[steps.R.length - 1];
      const same = a === b;
      B.keyResult(same);
      for (const s of ['L', 'R']) sideBox(s).classList.add(same ? 'match' : 'miss');
      work.querySelector('.ck-line .hinge')?.classList.add('locked');
      hob(`${a} = ${b}. It checks out!`, 'good');
      renderSteps({ checked: true });
      await next('Open it');
      paper.querySelector('.lbx-start').classList.remove('lit');
      if (!gone) finish();
    }
    // "−16 + 18" -> [-16, 18]; anything that isn't two whole numbers -> null
    function twoTerms(s) {
      const m = String(s).replace(/\s+/g, '').match(/^([−-]?\d+)([+−-])(\d+)$/);
      if (!m) return null;
      const a = Number(m[1].replace('−', '-'));
      const b = Number(m[3]) * (m[2] === '+' ? 1 : -1);
      return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
    }
    // -> the number line's handle (its done promise resolves when the hop lands), or null
    function flashHop(s, a, b) {
      const box = work.querySelector(`.ck-nl[data-s="${s}"]`);
      if (!box) return null;
      box.innerHTML = '';
      try {
        const w = Math.max(200, Math.min(420, box.clientWidth || 300));
        const line = showNumberLine(box, { start: a, change: b, theme: 'dark', size: 'compact', width: w, animate: K >= 0.7, backing: true });
        box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
        return line;
      } catch (e) { console.error(e); return null; }
    }
    // waits until every hop has landed (Enter or a tap finishes them at once); a hop drawn finished straight away
    // still leaves its sum up for a moment first
    async function hopsLanded(lines) {
      const t0 = performance.now();
      let landed = false;
      Promise.all(lines.map((l) => l?.done || null)).then(() => { landed = true; });
      while (!gone && !landed) {
        if (ff) { lines.forEach((l) => l?.finish?.()); break; }
        await sleep(40);
      }
      while (!gone && !ff && performance.now() - t0 < CHECK_SUM_MS * K) await sleep(40);
    }
    // the check line shrinks to fit like the working line does
    function fitCheck() {
      const line = work.querySelector('.ck-line');
      if (!line) return;
      line.style.fontSize = '';
      const room = work.clientWidth - 8;
      let size = parseFloat(getComputedStyle(line).fontSize) || 36;
      while (line.scrollWidth > room && size > 16) { size -= 2; line.style.fontSize = `${size}px`; }
    }

    // ----- the box is finished: record it, and hand it to the session (coins, then the next box) -----
    function finish({ left = false } = {}) {
      if (gone) return;
      gone = true;
      recorded = true;
      phase = left ? 'done' : 'open';
      clearInterval(tick);
      stopTidy?.();
      clearNL();
      const result = B.finish({ left });
      alg.record(result);
      setTrayEnabled(false);
      finished({ ...result, tier }, ctrl);
    }
    function leave() {
      if (gone || !['play', 'tidy', 'brackets'].includes(phase)) return;
      hob('That one goes back in the pile.', 'warn');
      finish({ left: true });
    }

    // ----- keys: 1-4 buttons, U undo, H hint, Space/Enter skip ahead during an animation -----
    function onKey(e, k) {
      if (phase === 'tidy' || phase === 'brackets') {
        if (/^[1-4]$/.test(k)) { e.preventDefault(); tidyKey?.(Number(k) - 1); }
        else if (k === 'h' || k === '?') askHob();
        return;
      }
      if (phase === 'check') { if (k === ' ' || k === 'enter') { e.preventDefault(); goNext(); } return; }
      if (phase === 'anim') { if (k === ' ' || k === 'enter') { e.preventDefault(); ff = true; } return; }
      if (phase !== 'play') return;
      if (/^[1-4]$/.test(k)) {
        e.preventDefault();
        const i = Number(k) - 1;
        if (pickMode) { const b = grid.querySelectorAll('button')[i]; if (b && !b.disabled) b.click(); }
        else {
          // number keys follow the visible buttons in reading order (empty slots are skipped)
          const slots = B.buttons.slots.map((s, j) => (s ? j : -1)).filter((j) => j >= 0);
          if (slots[i] !== undefined) press(slots[i]);
        }
      } else if (k === 'u') undo();
      else if (k === 'h' || k === '?') askHob();
    }

    // refit the working line whenever its room changes (the stylesheet arriving, a window resize, the phone turning)
    let fitQueued = false;
    const refit = () => {
      if (fitQueued) return;
      fitQueued = true;
      requestAnimationFrame(() => { fitQueued = false; if (gone) return; if (phase === 'check') fitCheck(); else { fitLine(); distRedraw?.(); } });
    };
    const resizeWatch = typeof ResizeObserver === 'function' ? new ResizeObserver(refit) : null;
    resizeWatch?.observe(work);

    // a tap anywhere fast-forwards a move or the check while it plays (it never adds a move)
    body.addEventListener('pointerdown', () => { if (phase === 'anim') ff = true; });
    undoBtn.addEventListener('click', undo);
    askBtn.addEventListener('click', askHob);
    leaveBtn.addEventListener('click', leave);
    body.querySelectorAll('.lbx-verdicts button').forEach((b) => b.addEventListener('click', () => verdict(b.dataset.verdict)));

    // the ? button bounces after 15 s idle or 2 unhelpful moves (it never shows anything by itself);
    // "Skip this box" appears after 60 s or the second hint
    const tick = setInterval(() => {
      if (gone || closed) return;
      const idle = (performance.now() - lastAction) / 1000;
      if (phase === 'play' && (idle > 15 || unhelpful >= 2) && B.hintLevel < 3) askBtn.classList.add('bounce');
      else askBtn.classList.remove('bounce');
      leaveBtn.hidden = !(B.canLeave((performance.now() - openedAt) / 1000) || opts.dev) || !['play', 'tidy', 'brackets'].includes(phase);
    }, 1000);

    const ctrl = {
      body, stageEl, B, problem, level, tier,
      phase: () => phase,
      setPhase: (p) => { phase = p; },
      numberLine: () => !!nl,
      steps: () => (B.plan ? B.steps() : null),
      cardShown: () => cardShown,
      onKey,
      hob,
      fit: () => fitLine(),
      // the panel is closing or this box slid away: stop everything it runs
      destroy() {
        gone = true;
        clearInterval(tick);
        stopTidy?.();
        resizeWatch?.disconnect();
        clearNL();
      },
      // "Done for now" in the middle of a box: an unsolved box isn't counted (stopping costs nothing). A box already
      // solved, whose check or lid is still playing, is kept: it is recorded here and returned for the session to
      // pay, with no animation. -> that box's result, or null
      stop() {
        if (gone) return null;
        gone = true;
        clearInterval(tick);
        stopTidy?.();
        if (!B.solved || recorded) return null;
        recorded = true;
        const result = B.finish();
        alg.record(result);
        return { ...result, tier };
      },
    };

    // ----- first draw -----
    bodies.appendChild(body);
    buildSteps();
    renderLine(problem.start, 'settle');
    renderLedger();
    renderTray();
    renderTop();
    setTrayEnabled(true);
    const intro = {
      balance: 'Both sides are equal. Which number goes in the gap?',
      key: 'Which number for x makes both sides equal?',
    }[problem.mode] || ({
      R2: 'Dark coins are negative numbers.', R5: 'Negatives get their own box now.', R8: 'A lone −x is the opposite of x.',
      R9b: 'The whole top is divided. Clear the division first.', R10: 'Brackets hold things together.', R11: 'Only like terms can join.', R12: 'x on both sides this time.',
      R15: 'Some equations: every number is a solution. Some: no solution.',
    }[problem.rung] || 'Get x alone. Same move on both sides.');
    hob(intro);
    // once the fonts arrive the line may need a new fit
    if (document.fonts?.ready) document.fonts.ready.then(() => { if (!gone) refit(); });
    ensureCss().then(() => { if (!gone) refit(); });
    return ctrl;
  }

  // ===================================================================================================================
  // The session: a finished box pays, the coins fly, and the next box slides in.
  // ===================================================================================================================

  // what the caller sees for one box
  const publicResult = (r) => ({ solved: r.solved, stars: r.stars, gold: r.gold, moves: r.moves, par: r.par, rung: r.rung,
    tier: r.tier, clean: r.clean, left: r.left, hints: r.hints });

  // a finished box joins the session's results and is paid (onBox), or kept for onDone to pay -> onBox's note
  function payOut(result) {
    const pub = publicResult(result);
    session.results.push(pub);
    session.n++;
    if (result.solved) { session.solved++; session.gold += result.gold; }
    let note = null;
    if (onBox) {
      try { note = onBox(pub) || null; } catch (e) { console.error(e); }
    } else if (result.solved) session.unpaid += result.gold;
    return { pub, note };
  }

  async function boxFinished(result, ctrl) {
    if (closed) return;
    const before = purseNow();
    const parBefore = whole(rider?.stats?.parBoxes);
    const { pub, note } = payOut(result);
    const after = purseNow();
    const nx = nextInfo(pub);
    if (result.solved) await reward(ctrl, result, { before, after, parBefore, note, last: !nx });
    else await sleep(500);
    if (closed) return;
    if (!nx) { end(own ? 'empty' : 'done'); return; }
    slideTo(nx);
  }

  // what the last box from the saddlebags says: the bags are empty, or the boxes skipped on the way are still in them
  // (read from the rider's own list once onBox has taken the solved ones out; without onBox, from this session)
  function lastBagNote() {
    const left = onBox && rider && Array.isArray(rider.lockboxes) ? rider.lockboxes.length : session.results.filter((r) => !r.solved).length;
    if (!left) return 'That was the last box in the saddlebags.';
    return left === 1 ? 'The one you skipped is still in the saddlebags.' : `The ${left} you skipped are still in the saddlebags.`;
  }

  // The lid opens on the mat, the coins fly from the box into the gold and it counts up; the stars and the
  // Safecracker count show for a moment. Enter, Space or a tap hurries it.
  function reward(ctrl, result, { before, after, parBefore, note, last }) {
    return new Promise((resolve) => {
      const stageEl = ctrl.stageEl;
      const q = session.solved > QUICK_AFTER ? QUICK : 1;   // (this box is counted already: the same boxes as the check)
      const atPar = result.moves <= result.par;
      const parNow = whole(rider?.stats?.parBoxes);
      let safe = '';
      if (atPar && rider?.stats) {
        if (parBefore < SAFECRACKER_BOXES && parNow >= SAFECRACKER_BOXES) safe = 'Safecracker badge!';
        else if (parNow < SAFECRACKER_BOXES) safe = `At par · Safecracker ${parNow} / ${SAFECRACKER_BOXES}`;
        else safe = 'At par';
      } else if (atPar) safe = 'At par';
      const lines = [safe, note?.newTitle ? `You’re a ${note.newTitle} now!` : '', note?.badge && !/Safecracker/.test(safe) ? `${note.badge} badge!` : '',
        last && own ? lastBagNote() : ''].filter(Boolean);
      const wrap = h('div', 'lbx-reward');
      wrap.innerHTML = `<div class="rw-stars">${[1, 2, 3].map((i) => STAR(i <= result.stars)).join('')}</div>
        ${chestSVG()}
        <div class="rw-gold">+${result.gold} gold</div>
        ${lines.map((t) => `<div class="rw-note">${esc(t)}</div>`).join('')}`;
      stageEl.appendChild(wrap);
      ctrl.body.classList.add('opened');
      requestAnimationFrame(() => wrap.classList.add('go'));
      let hurry = false;
      ctrl.hurry = () => { hurry = true; };
      // the coins: from the chest to the purse in the top strip, each one adding its share as it lands
      const n = Math.max(4, Math.min(14, Math.round(result.gold / 3)));
      const gain = Math.max(0, after - before);
      let shown = before;
      purseN.textContent = String(before);
      const chest = wrap.querySelector('.lbx-chest');
      const t0 = performance.now();
      const fly = () => {
        const from = chest.getBoundingClientRect(), to = purseEl.getBoundingClientRect();
        const fx = from.left + from.width / 2, fy = from.top + from.height * 0.42;
        const tx = to.left + 14, ty = to.top + to.height / 2;
        for (let i = 0; i < n; i++) {
          const c = h('span', 'fly-coin', COIN_SVG);
          flyLayer.appendChild(c);
          // a gentle bow from the chest up to the purse, never above the purse (it sits at the top of the panel)
          const jx = (Math.random() - 0.5) * 90, lift = 40 + Math.random() * 60;
          const mx = (fx + tx) / 2 + jx, my = Math.max(ty + 18, (fy + ty) / 2 - lift);
          const delay = hurry ? 0 : (420 + i * 70) * q;
          const dur = hurry ? 200 : 620 * q;
          const anim = c.animate([
            { transform: `translate(${fx}px, ${fy}px) scale(0.6)`, opacity: 0 },
            { transform: `translate(${fx + jx * 0.3}px, ${fy - 24}px) scale(1)`, opacity: 1, offset: 0.15 },
            { transform: `translate(${mx}px, ${my}px) scale(1)`, opacity: 1, offset: 0.55 },
            { transform: `translate(${tx}px, ${ty}px) scale(0.75)`, opacity: 1 },
          ], { duration: dur, delay, easing: 'cubic-bezier(.35,.1,.45,1)', fill: 'both' });
          anim.onfinish = () => {
            c.remove();
            shown = i === n - 1 ? after : Math.min(after, before + Math.round(gain * (i + 1) / n));
            purseN.textContent = String(shown);
            purseEl.classList.remove('bump'); void purseEl.offsetWidth; purseEl.classList.add('bump');
            // the last coin is in: nothing is left to hurry, so the note goes
            if (i === n - 1) ctrl.body.classList.add('counted');
          };
        }
      };
      setTimeout(fly, 120);
      const finishUp = () => { purseN.textContent = String(after); ctrl.hurry = null; resolve(); };
      const tickWait = () => {
        if (closed) { resolve(); return; }
        const el2 = performance.now() - t0;
        if ((hurry && el2 > 650) || el2 > REWARD_MS * q + (lines.length > 1 ? 500 : 0)) { finishUp(); return; }
        setTimeout(tickWait, 50);
      };
      setTimeout(tickWait, 50);
    });
  }

  // the next box slides in from the right while this one slides out to the left
  function slideTo(info) {
    const old = cur;
    old.setPhase('done');
    old.body.classList.add('leaving');
    cur = mountBox(info, { finished: boxFinished });
    cur.body.classList.add('entering');
    void cur.body.offsetWidth;
    requestAnimationFrame(() => { cur.body.classList.remove('entering'); });
    setTimeout(() => { old.destroy(); old.body.remove(); }, SLIDE_MS + 60);
    el.focus({ preventScroll: true });
  }

  function totals(why) {
    const rs = session.results;
    const last = rs[rs.length - 1] || null;
    const lastSolved = [...rs].reverse().find((r) => r.solved) || null;
    return {
      solved: session.solved > 0, boxes: session.solved, played: rs.length, gold: session.gold,
      stars: lastSolved ? lastSolved.stars : 0,
      moves: last ? last.moves : 0, par: last ? last.par : 0, rung: last ? last.rung : null,
      tier: last ? last.tier : (TIER_NAME[firstInfo.tier] ? firstInfo.tier : 'iron'),
      clean: last ? last.clean : false, left: session.solved === 0, hints: last ? last.hints : 0,
      results: rs.slice(), paid: !!onBox, ended: why,
    };
  }

  // the end of the session: "Done for now", the saddlebags ran out, or close() from the game
  function end(why) {
    if (closed) return;
    closed = true;
    // a box solved a moment ago (its check still playing) is paid now, not lost
    if (cur) { const kept = cur.stop(); if (kept) payOut(kept); cur.destroy(); }
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    el.classList.remove('in');
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
    try { onDone(totals(why)); } catch (e) { console.error(e); }
  }

  // ----- keys for the whole panel: Esc is "Done for now"; the rest go to the box. The game underneath hears no key
  // presses while this is open; key releases still reach it, so a key held down when the box opened doesn't stay
  // stuck down. -----
  function onKey(e) {
    if (closed) return;
    e.stopPropagation();
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { e.preventDefault(); end('done'); return; }
    if (cur && cur.phase() === 'open') { if (k === 'enter' || k === ' ') { e.preventDefault(); cur.hurry?.(); } return; }
    cur?.onKey(e, k);
  }
  const onResize = () => cur?.fit();
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onResize);
  doneBtn.addEventListener('click', () => end('done'));
  bodies.addEventListener('pointerdown', () => { if (cur && cur.phase() === 'open') cur.hurry?.(); });

  // ----- the first box -----
  cur = mountBox(firstInfo, { problem: opts.problem || null, finished: boxFinished });

  const handle = {
    el,
    close: () => end('closed'),
    // for test rigs: the box being worked and its phase (play | anim | tidy | check | open | done)
    debug: {
      get box() { return cur.B; },
      get problem() { return cur.problem; },
      get level() { return cur.level; },
      phase: () => (closed ? 'done' : cur.phase()),
      algebra: alg,
      numberLine: () => cur.numberLine(),
      steps: () => cur.steps(),
      card: () => cur.cardShown(),
      session: () => ({ ...totals('now'), n: session.n }),
    },
  };
  if (opts.debug) window.__lockbox = handle;
  return handle;
}

// re-exported so callers only import from this file if they like
export { isSolved, verdictOf, targetsOf, evalTerm };
