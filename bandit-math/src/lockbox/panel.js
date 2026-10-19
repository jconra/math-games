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
// now"), the steps card (the six rules, the step being worked lit; open on a wide screen, a compact strip on a
// phone), the pinned start line and the ledger on ruled paper, the big working line (numbers are round coins,
// x-terms are cards; "=" is a brass hinge pin), Old Hob's caption, and the button tray (keys 1-4, U undo, H hint).
//
// Every step is worked by the kid (parts.js): after a move is picked, the part it cancels goes by itself (4x − 4x is
// struck out, 9x ÷ 9 leaves x), and each part left to work out is asked one at a time, big in the middle of the mat
// (the focus): lines run from the chips it comes from to the sum, "5x − 4x = ?", in the largest type on the screen,
// with four answers in the tray. A sum of two numbers shows a number line as a picture (where it starts and which
// way it goes, not where it lands). A wrong answer shakes, Hob gives a one-line nudge, and the right one stays to
// pick; it costs no move and no star. Opening brackets asks each product the same way (products.js).
// When x stands alone the check is a review that stays on screen: the beginning equation with the solution put in,
// each side worked out, the number lines drawn finished, both sides matching. ONE button, "Next problem" (Enter),
// opens the lid, pays, and the next box slides in. No timer anywhere.
//
// Inequalities (the rungs after the equations, ineq.js) play the same way on "rooms" (two sides, or three for
// 3x − 9 < 6x < 3x + 12; two inequalities joined by "or" are worked one after the other). Multiplying or dividing
// by a negative turns the sign round: the kid answers which way the sign points after every × or ÷, Hob and the
// steps card say why. The answer is given on a number line: four pictures, open or closed circles, shaded between
// or outward.
//
// Adding a negative and a positive is where kids slip (−10 + 18 worked as −28): the Rule hint shows the number line
// for the sum the hinted move will make, and the review draws the hop under a side that comes down to such a sum.
//
// It writes nothing to storage itself: it changes rider.topics.algebra in place (the ladder); the caller saves the
// rider (save.js recordLockbox does that) in onBox, or after onDone.

import {
  lineText, sideText, termText, termBody, termNeg, moveLabel, moveNote, fracText, isSolved, F, evalSide, evalTerm, applyMove,
  MINUS, TIMES,
} from './engine.js';
import { RUNG, generate, makeRng, verdictOf } from './generate.js';
import { makeAlgebra } from './algebra.js';
import { makeBox, TIER_NAME, targetsOf } from './box.js';
import { sumsOf } from './tidy.js';
import { bracketProducts, productNudge, productHelp } from './products.js';
import { partsOf, partNudge, partHelp } from './parts.js';
import { makeIneqBox } from './ineqbox.js';
import * as Q from './ineq.js';
import { setLineSVG } from './setline.js';
import { GOLDEN_RULE, STEPS, SKIP_WORD, cardMode, currentStep } from './steps.js';
import { showNumberLine, layoutNumberLine } from '../ui/numberline.js';
import { SAFECRACKER_BOXES } from '../save.js';

const PART_RIGHT_MS = 650;       // a part answered right: the answer sits in its slot this long before the next part
const AUTO_MS = 750;             // the parts that work themselves out (4x − 4x struck out) show this long first
const REWARD_MS = 1000;          // after "Next problem": the lid open and the coins flying, before the next box slides in
const SLIDE_MS = 480;            // the next box sliding in
const QUICK_AFTER = 3;           // once this many boxes are open in one sitting, the kid has seen the coins fly:
const QUICK = 0.7;               // ...they run at this share of their time
const WIDE_SCREEN = '(min-width: 901px) and (min-height: 521px)';   // a screen with room for the steps card open
const ROOM_NAME = { L: 'left side', R: 'right side' };
const WORKING = ['play', 'parts', 'brackets'];   // the phases where the kid is working the box (Skip shows)

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
    const ineqMode = problem.mode === 'ineq';   // an inequality (ineq.js): rooms, signs, the number-line answer
    const B = ineqMode ? makeIneqBox(problem, { stage, level, rng, fav: alg.fav(), tier }) : makeBox(problem, { stage, level, rng, fav: alg.fav(), tier });
    const speed = opts.speed ?? alg.speed(problem.rung);   // seconds per move
    const K = speed / 0.8;                                // animation time scale
    const pickMode = problem.mode !== 'moves' && !ineqMode;
    const verdictMode = !!rung.verdicts;
    // what the inequality mode adds to the shared flow (null on an equation box)
    const IB = ineqMode ? {
      roomName(room) {
        const ci = 'AB'.indexOf(room[0]), c = B.line.chains[ci] || B.line.chains[0];
        const name = Q.roomName(c, Number(room.slice(1)));
        return B.line.chains.length > 1 ? `${name}, ${ci === 0 ? 'first' : 'second'} part` : name;
      },
      partsOf: (before, move, r) => Q.chainParts(before, move, { rng: r }),
      // the sign question answered: the signs on the mat turn round (or stay)
      setRel(q) {
        work.querySelectorAll(`.rel[data-r="${q.room}"]`).forEach((e, i) => {
          if (e.textContent === q.rels[i]) return;
          e.textContent = q.rels[i];
          e.classList.remove('turn'); void e.offsetWidth; e.classList.add('turn');
        });
      },
      signNudge: Q.signNudge,
      signHelp: Q.signHelp,
      // a sign turned round: the steps card shows the flip rule from now on
      flipNoted(res) {
        const fl = stepsEl.querySelector('.st-flip');
        if (fl) { fl.hidden = false; fl.classList.remove('flash'); void fl.offsetWidth; fl.classList.add('flash'); }
        hob(`${res.label} is a negative number, so the sign turned round.`, 'good');
      },
      solvedChain: () => linePick(),
      chainDone(res) {
        const set = Q.chainSet(res.out.chains[res.ci]);
        hob(`One part done: ${set ? Q.setText(set) : 'x alone'}. Now the other one.`, 'good');
      },
    } : null;

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
    stageEl.innerHTML = `<div class="lbx-workwrap"><div class="lbx-work"></div>
        <div class="lbx-focus" hidden aria-live="polite"></div>
        <div class="lbx-picwrap"></div><div class="lbx-calcs"></div><svg class="lbx-links" aria-hidden="true"></svg></div>
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
        <button type="button" data-verdict="all">Infinitely many solutions<small>every number works</small></button><button type="button" data-verdict="none">No solution<small>no number works</small></button></div>
      <button class="lbx-nextbtn" type="button" hidden><span class="lbl">Next problem</span><kbd>Enter</kbd></button>`;
    body.appendChild(tray);

    const $ = (s) => body.querySelector(s);
    const work = $('.lbx-work'), calcs = $('.lbx-calcs'), ledgerEl = $('.lbx-ledger'), grid = $('.lbx-grid');
    const focusEl = $('.lbx-focus'), linksEl = $('.lbx-links'), nextBtn = $('.lbx-nextbtn');
    const say = $('.lbx-hob-say'), pics = $('.lbx-picwrap');
    const nlBox = h('div', 'lbx-nl');   // the number line's spot: in the ledger, right under the newest line
    if (rung.pictures) body.classList.add('has-pics');
    const leaveBtn = $('.lbx-leave'), undoBtn = $('.lbx-undo'), askBtn = $('.lbx-ask');
    $('.lbx-start-l').innerHTML = ineqMode ? mathHTML(Q.stateText(problem.start)) : `${sideHTML(problem.start.L)} = ${sideHTML(problem.start.R)}`;
    if (ineqMode) { body.classList.add('ineq'); if (problem.start.chains.length > 1) body.classList.add('ineq-or'); }

    // the top strip shows this box
    top.querySelector('.lbx-tier').textContent = TIER_NAME[tier];
    const where = { sheriff: 'Sheriff’s desk', loot: 'Saddlebags', practice: 'Just lock boxes' }[info.from] || 'Lock box';
    const skippedNow = session.results.filter((r) => !r.solved).length;   // (skipped boxes stay in the bags)
    const more = info.from === 'loot' && typeof next !== 'function'
      ? (bag.length ? ` · ${bag.length} more` : skippedNow ? ` · last one · ${skippedNow} skipped` : ' · the last one') : '';
    top.querySelector('.lbx-rung').innerHTML = `${esc(where + more)} · ${esc(rung.name)}${opts.dev || opts.debug ? ` <small>${esc(problem.rung)}</small>` : ''}`;
    top.querySelector('.lbx-tumblers').innerHTML = '';

    // ----- state -----
    let phase = 'play';          // play | anim | parts | brackets | review | open | done
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
      leaveBtn.hidden = !(B.canLeave((performance.now() - openedAt) / 1000) || opts.dev) || !WORKING.includes(phase);
    }

    // ----- the steps card -----
    // Open on hard equations, folded into a small "Steps" bar on easy ones and on stamped rungs, faded near mastery;
    // the kid's own fold or unfold holds for the rest of the session.
    const stepState = {};
    let cardShown = 'folded';
    function buildSteps() {
      if (pickMode || !B.plan) { stepsEl.hidden = true; body.classList.add('no-steps'); return; }
      const mode = cardMode({ hard: B.plan.hard, stamped: (algState.stamped || []).includes(problem.rung), level: (algState.levels || {})[problem.rung] ?? 2 });
      // on a wide screen there is room: the card starts open (quiet near mastery); a phone keeps the compact strip
      const wide = typeof matchMedia === 'function' && matchMedia(WIDE_SCREEN).matches;
      cardShown = session.cardPref || (wide && mode === 'folded' ? 'open' : mode);
      // (an inequality has its own card: ineq.js INEQ_STEPS, with the flip rule showing once a sign has turned)
      const CARD = B.cardSteps || STEPS;
      stepsEl.innerHTML = `<button class="st-bar" type="button" aria-expanded="false">
          <span class="st-title">Steps</span><span class="st-mini" aria-hidden="true">${CARD.map((s) => `<i data-n="${s.n}">${s.n}</i>`).join('')}</span>
          <span class="st-nowtxt"></span><span class="st-chev" aria-hidden="true"></span></button>
        <div class="st-card">
          <p class="st-rule">${esc(B.goldenRule || GOLDEN_RULE)}</p>
          ${ineqMode ? `<p class="st-flip" hidden>${esc(Q.FLIP_RULE)}</p>` : ''}
          <ol class="st-list">${CARD.map((s) => `<li class="st-row" data-n="${s.n}"><span class="st-n">${s.n}</span>
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
      if (ineqMode) { renderLedgerIneq(); return; }
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

    // an inequality's ledger: one row per line (both parts of an "or"), the move written beside it
    function renderLedgerIneq() {
      const rows = B.ledger.map((e, i) => ({ ...e, i })).filter((e) => !e.undone);
      if (rows[rows.length - 1].i !== B.index) rows.push({ ...B.entry, i: B.index, again: true });
      rows.forEach((e, k) => {
        const nxt = rows[k + 1];
        const move = nxt && !nxt.again && nxt.parent === e.i ? nxt.move : null;
        const row = h('div', 'lg-row lg-ineq');
        if (e.struck) row.classList.add('struck');
        if (e.again) row.classList.add('again');
        if (e.closer === false) row.classList.add('amber');
        if (k === rows.length - 1 && !e.struck) row.classList.add('now');
        row.appendChild(h('span', 'lg-dot', e.closer === false ? '•' : ''));
        row.appendChild(h('span', 'lg-wide', `<span class="lg-txt">${mathHTML(Q.stateText(e.line))}</span>`));
        const every = e.line.chains[e.line.active].rooms.length === 3 ? 'every room' : 'both sides';
        const note = e.again ? 'back up to here' : move ? `${mathHTML(move.k === 'flip' ? `·(${MINUS}1)` : moveLabel(move))} ${every}${nxt.flipped ? ', sign turned' : ''}` : '';
        row.appendChild(h('span', 'lg-note', note));
        ledgerEl.appendChild(row);
      });
      ledgerEl.scrollTop = ledgerEl.scrollHeight;
    }

    // ----- the working line -----
    const drawLine = (l, cls = '') => (ineqMode ? renderIneq(l, cls) : renderLine(l, cls));
    // An inequality: its rooms with a brass sign between each two; two inequalities joined by "or" sit one above the
    // other, the one being worked bright.
    function renderIneq(state, cls = '') {
      work.innerHTML = '';
      const wrap = h('div', `wineq ${cls}`);
      state.chains.forEach((c, ci) => {
        if (ci > 0) wrap.appendChild(h('div', 'w-or', 'or'));
        const line = h('div', `wline ${cls}`);
        if (state.chains.length > 1) line.classList.add(Q.chainSolved(c) ? 'solved' : ci === state.active ? 'active' : 'idle');
        c.rooms.forEach((room, i) => {
          if (i > 0) line.appendChild(h('span', 'rel', esc(c.rels[i - 1])));
          line.appendChild(sideEl(room, Q.roomId(ci, i)));
        });
        line.querySelectorAll('.rel').forEach((r) => { r.dataset.r = Q.relId(ci); });
        wrap.appendChild(line);
      });
      work.appendChild(wrap);
      fitLine();
      return wrap;
    }
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
    // (the two lines of an "or" share one size)
    function fitLine() {
      const lines = [...work.querySelectorAll('.wline')];
      if (!lines.length) return;
      const max = parseFloat(getComputedStyle(body).getPropertyValue('--work-max')) || 44;
      const floor = ineqMode ? 22 : 28;
      let size = max;
      const setSize = (v) => lines.forEach((l) => { l.style.fontSize = `${v}px`; });
      const widest = () => Math.max(...lines.map((l) => l.scrollWidth));
      setSize(size);
      const room = work.clientWidth - 8;
      while (widest() > room && size > floor) { size -= 2; setSize(size); }
      // "tight" (the turn-your-phone note) is only judged on a settled line, not the wider one shown mid-move
      const mid = lines[0].classList.contains('mid');
      const w = widest();
      if (w > room) {
        const sc = room / w;
        lines.forEach((l) => { l.style.transform = `scale(${sc.toFixed(3)})`; });
        if (!mid) body.classList.add('tight');
      } else { lines.forEach((l) => { l.style.transform = ''; }); if (!mid) body.classList.remove('tight'); }
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
      grid.classList.remove('tidy', 'partgrid', 'nlgrid');
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

    // ----- a move with nothing for the kid to work out (opening brackets, once the products are in): it settles -----
    async function animateMove(res) {
      ff = false;
      calcs.innerHTML = '';
      const m = res.move;
      if (m.k === 'dist' && res.asked) await wait(120);   // (the kid has worked out every product already)
      else if (m.k === 'dist' || m.k === 'comb') {
        renderLine(res.before, 'mid');
        for (const s of ['L', 'R']) {
          for (const ev of res.ev[s]) {
            const els = ev.kind === 'expand' ? [chipAt(s, ev.a)] : [...work.querySelectorAll(`.wside-${s} > .chip`)];
            els.forEach((c) => c?.classList.add('pulse'));
            calcTag(ev.text, els, 'merge');
          }
        }
        await wait(800);
      }
      if (gone) return;
      await settleLine(res.out);
    }
    // the new line, the hinge wobbles and settles
    async function settleLine(out) {
      if (gone) return;
      const line = drawLine(out, 'settle');
      // the new line can come out bigger than the in-between one (fewer chips to fit): keep the printed sums above it
      const lineTop = line.getBoundingClientRect().top - $('.lbx-workwrap').getBoundingClientRect().top;
      calcs.querySelectorAll('.calc').forEach((c) => { if (parseFloat(c.style.top) > lineTop) c.style.top = `${lineTop}px`; });
      wobble();
      setTimeout(() => calcs.querySelectorAll('.calc').forEach((c) => c.classList.add('gone')), ff ? 0 : 500 * K);
      await wait(260);
      ff = false;
    }

    // ----- the number line, sketched in the ledger right under the newest line (the Rule hint) -----
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

    // ----- the focus: the part being worked, big in the middle of the mat -----
    // The caption says where it comes from (the move, the side), lines run from the chips it is made of to the sum,
    // and the sum is written in the biggest type on the screen with a slot for the answer.
    let linkPairs = null;   // () -> [[fromEl, toEl]], redrawn when the mat changes size
    let partKey = null;     // keys 1-4 while a part or a product is asked
    let partHelpFn = null;  // Ask Hob while a part or a product is asked
    let stopParts = null;   // ends a part stage early (the box finished, or the panel closed)
    let partsSeen = 0;      // parts asked on this box (the first gets Hob's "your turn")
    // autos: the parts that work themselves out, listed instead of a question (4x − 4x = 0 ✓)
    // lead: a few words before the big ones; eq: what stands between the sum and its slot ('=' / 'turns into'), or null
    // for no slot at all
    function showFocus({ cap = '', tokens = [], answer = '?', cls = '', autos = null, lead = '', eq = '=' }) {
      body.classList.add('focus-on');
      focusEl.hidden = false;
      focusEl.className = `lbx-focus ${cls}`;
      const main = autos
        ? `<div class="fq-autos">${autos.map((a, i) => `<div class="fq-auto" data-k="${i}">${mathHTML(a.text)}<span class="fq-tick">${a.kind === 'zero' ? 'cancels' : a.kind === 'free' ? 'x on its own' : '✓'}</span></div>`).join('')}</div>`
        : `${lead ? `<div class="fq-lead">${lead}</div>` : ''}<div class="fq-q"><span class="fq-sum">${tokens.map((t, i) => `<span class="fq-t" data-k="${i}">${mathHTML(t.text)}</span>`).join('')}</span>`
          + `${eq ? `<span class="fq-eq${eq.length > 1 ? ' fq-words' : ''}">${esc(eq)}</span><span class="fq-slot">${answer}</span>` : ''}</div><div class="fq-nl"></div>`;
      focusEl.innerHTML = `${cap ? `<div class="fq-cap">${cap}</div>` : ''}${main}`;
      fitFocus();
    }
    function hideFocus() {
      body.classList.remove('den-on');
      focusEl.hidden = true;
      focusEl.innerHTML = '';
      body.classList.remove('focus-on');
      linkPairs = null;
      clearLinks();
      body.querySelectorAll('.chip.src').forEach((c) => c.classList.remove('src'));
    }
    // the sum shrinks to fit the mat's width (never below the floor)
    function fitFocus() {
      const q = focusEl.querySelector('.fq-q, .fq-autos');
      if (!q) return;
      q.style.fontSize = '';
      const room = focusEl.clientWidth - 16;
      let size = parseFloat(getComputedStyle(q).fontSize) || 60;
      while (q.scrollWidth > room && size > 22) { size -= 2; q.style.fontSize = `${size}px`; }
    }
    function clearLinks() { linksEl.innerHTML = ''; }
    function drawLinks() {
      clearLinks();
      const pairs = linkPairs ? linkPairs() : [];
      if (!pairs.length) return;
      const wr = $('.lbx-workwrap').getBoundingClientRect();
      linksEl.setAttribute('width', String(Math.round(wr.width)));
      linksEl.setAttribute('height', String(Math.round(wr.height)));
      let html = '<defs><marker id="fq-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="fq-head"/></marker></defs>';
      for (const [a, b] of pairs) {
        const ar = a.getBoundingClientRect(), br2 = b.getBoundingClientRect();
        const x0 = (ar.left + ar.right) / 2 - wr.left, y0 = ar.bottom - wr.top + 3;
        const x1 = (br2.left + br2.right) / 2 - wr.left, y1 = br2.top - wr.top - 3;
        if (y1 - y0 < 8) continue;
        const bend = (y1 - y0) * 0.55;
        html += `<path class="fq-link" marker-end="url(#fq-head)" d="M${x0.toFixed(1)} ${y0.toFixed(1)} C${x0.toFixed(1)} ${(y0 + bend).toFixed(1)} ${x1.toFixed(1)} ${(y1 - bend).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}"/>`;
      }
      linksEl.innerHTML = html;
    }
    // the number line as a picture under the sum: where it starts and which way it goes, not where it lands
    function showFocusLine(sum) {
      const box = focusEl.querySelector('.fq-nl');
      if (!box) return;
      box.innerHTML = '';
      try {
        const wide = typeof matchMedia === 'function' && matchMedia(WIDE_SCREEN).matches;
        const w = Math.round(Math.max(240, Math.min(wide ? 760 : 420, (focusEl.clientWidth || 400) - 12)));
        showNumberLine(box, { start: sum.start, change: sum.change, reveal: false, animate: false, theme: 'dark',
          size: wide ? 'full' : 'compact', width: w, backing: false });
      } catch (e) { console.error(e); }
    }
    // the mark of the move beside a side: the ÷ under it, the · next to it
    const sideMark = (room, kind) => work.querySelector(`.wside-${room} > .${kind === 'den' ? 'den' : 'times'}`);

    // ----- working out each part of a move (parts.js) -----
    // The new terms land (or the ÷ goes under each side), the parts that cancel go by themselves, then each part is
    // asked in the focus with four answers in the tray. Resolves once every part is in (or the box is gone).
    // shownLine(P) draws the line the parts point into; onShown runs once it is on the mat.
    async function workParts(P, onShown) {
      const move = P.move;
      phase = 'anim';
      ff = false;
      calcs.innerHTML = '';
      const line = drawLine(P.shown, 'mid');
      if (move.k === 'add') {
        for (const s of P.rooms) chipAt(s, P.shown[s].length - 1)?.classList.add('twin');
      } else if (move.k === 'comb') {
        for (const q of P.qs) q.at.forEach((i) => chipAt(q.room, i)?.classList.add('pulse'));
      } else {
        for (const s of P.rooms) {
          const side = line.querySelector(`.wside-${s}`);
          if (!side) continue;
          if (move.k === 'div') {
            side.classList.add('over');
            side.insertAdjacentHTML('beforeend', `<span class="den">${esc(fracText(move.f))}</span>`);
            body.classList.add('den-on');   // (room under the line for the ÷ while the parts are asked)
          }
          else side.insertAdjacentHTML('beforeend', `<span class="times">${mathHTML(moveLabel(move))}</span>`);
        }
      }
      // the focus takes the room under the line from the start, so the line stays put while the parts are worked
      const note = P.note || moveNote(move);
      if (P.autos.length || P.qs.length) showFocus({ cap: mathHTML(note), autos: P.autos.length ? P.autos : [] });
      await nextFrame(); await nextFrame();
      onShown?.();
      await wait(420);
      if (gone) return;
      // the parts that work themselves out: a pair that cancels is struck out, x left on its own appears
      for (const a of P.autos) playAuto(a, move);
      if (P.autos.length) {
        linkPairs = () => P.autos.flatMap((a, k) => {
          const to = focusEl.querySelector(`.fq-auto[data-k="${k}"]`);
          return to ? a.at.map((i) => chipAt(a.room, i)).filter(Boolean).map((c) => [c, to]) : [];
        });
        drawLinks();
        await wait(AUTO_MS);
        ff = false;
        clearLinks();
        linkPairs = null;
      }
      // the rest, one at a time, big in the middle
      for (let k = 0; k < P.qs.length && !gone; k++) await askPart(P.qs[k], k, P.qs.length, move, P);
      if (!gone) hideFocus();
    }
    function playAuto(a, move) {
      const els = a.at.map((i) => chipAt(a.room, i)).filter(Boolean);
      // (what each one comes to is written in the focus, with a line from its chips)
      if (a.kind === 'zero') {
        els.forEach((c) => { c.classList.add('struck'); c.insertAdjacentHTML('beforeend', '<i class="strike" aria-hidden="true"></i>'); });
        setTimeout(() => { if (!gone) els.forEach((c) => c.classList.add('poof')); }, (AUTO_MS - 150) * K);
      } else if (a.kind === 'plain' && move.k === 'add') {
        setTimeout(() => { if (!gone) els[0]?.classList.add('poof'); }, (AUTO_MS - 150) * K);
      } else {
        els.forEach((c) => c.classList.add('src'));
        setTimeout(() => { if (!gone) replaceChip(a.room, a.at[0], a.result); }, (AUTO_MS - 150) * K);
      }
    }
    // a chip on the mat becomes its answer (one chip, or a few for brackets that open by themselves)
    function replaceChip(room, i, terms) {
      const old = chipAt(room, i);
      if (!old) return null;
      let e;
      if (terms.length === 1) e = chipEl(terms[0], i === 0);
      else { e = h('span', 'chip-group'); terms.forEach((t, j) => e.appendChild(chipEl(t, i === 0 && j === 0))); }
      e.dataset.side = room; e.dataset.i = i;
      e.classList.add('pop');
      old.replaceWith(e);
      return e;
    }
    const roomLabel = (room) => (ineqMode ? IB.roomName(room) : ROOM_NAME[room] || '');
    function askPart(q, k, n, move, P) {
      return new Promise((resolve) => {
        phase = 'parts';
        partsSeen++;
        const srcEls = q.at.map((i) => chipAt(q.room, i)).filter(Boolean);
        srcEls.forEach((c) => c.classList.add('src'));
        const where = q.kind === 'sign' ? 'the sign' : roomLabel(q.room);
        showFocus({ cap: `${mathHTML(P.note || moveNote(move))} · <b>${esc(where)}</b>${n > 1 ? ` <span class="fq-of">${k + 1} of ${n}</span>` : ''}`,
          tokens: q.tokens, cls: q.kind === 'sign' ? 'fq-signq' : '', eq: q.eq || '=' });
        linkPairs = () => q.tokens.map((t, j) => {
          const from = t.from === 'den' || t.from === 'times' ? sideMark(q.room, t.from)
            : t.from === 'rel' ? work.querySelector(`.rel[data-r="${q.room}"]`) : chipAt(q.room, t.from);
          const to = focusEl.querySelector(`.fq-t[data-k="${j}"]`);
          return from && to ? [from, to] : null;
        }).filter(Boolean);
        requestAnimationFrame(() => { if (!gone && phase === 'parts') drawLinks(); });
        if (q.line) showFocusLine(q.line);
        // the four answers, in the tray (it keeps its height, so nothing above it moves)
        const keepH = grid.offsetHeight;
        grid.style.height = `${keepH}px`;
        grid.innerHTML = '';
        grid.classList.add('partgrid');
        body.classList.remove('busy');
        askBtn.disabled = false;
        undoBtn.disabled = true;
        hob(partsSeen === 1 ? 'Your turn: work out each part.' : '', 'hint');
        const btns = q.choices.map((c, i) => {
          const b = h('button', 'lbx-move partpick', `<span class="lbl">${mathHTML(c.text)}</span><kbd>${i + 1}</kbd>`);
          b.type = 'button';
          b.dataset.right = c.right ? '1' : '0';
          b.addEventListener('click', () => pick(c, b));
          grid.appendChild(b);
          return b;
        });
        const done = () => { partKey = null; partHelpFn = null; stopParts = null; resolve(); };
        function pick(c, b) {
          if (phase !== 'parts' || b.disabled || gone) return;
          lastAction = performance.now();
          if (B.partPick(c.right, q, c)) {
            phase = 'anim';
            b.classList.add('right');
            btns.forEach((o) => { o.disabled = true; });
            const slot = focusEl.querySelector('.fq-slot');
            if (slot) { slot.innerHTML = mathHTML(q.answer); slot.classList.add('got'); }
            hob('');
            clearLinks();
            linkPairs = null;
            srcEls.forEach((x) => x.classList.remove('src'));
            // the chips on the mat become the answer
            if (q.kind === 'sign') IB.setRel?.(q);
            else {
              replaceChip(q.room, q.at[0], [q.result]);
              q.at.slice(1).forEach((i) => chipAt(q.room, i)?.classList.add('poof'));
            }
            setTimeout(() => { if (!gone) done(); }, PART_RIGHT_MS * Math.max(0.6, K));
            return;
          }
          b.classList.add('shake', 'used');
          b.disabled = true;
          hob(q.kind === 'sign' ? IB.signNudge(q, c) : partNudge(q, c), 'warn');
        }
        partKey = (i) => { const b = btns[i]; if (b && !b.disabled) b.click(); };
        partHelpFn = () => { lastAction = performance.now(); hob(q.kind === 'sign' ? IB.signHelp(q) : partHelp(q), 'hint'); };
        stopParts = () => { partKey = null; partHelpFn = null; resolve(); };
      });
    }

    let distRedraw = null;   // redraws the bracket arcs when the mat changes size

    // ----- open the brackets by hand -----
    // A line runs from the number outside the brackets to each term inside, with "5·x" and "5·8" written under them;
    // the product being asked is written big in the focus, with four answers in the tray. A right pick fills the
    // product in; a wrong one shakes, Hob gives a nudge and the right answer stays to pick. Wrong picks cost no move and
    // no stars. Resolves once every product is in.
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
        grid.classList.add('partgrid');
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
          const labelY = lineBottom + (wr.width < 600 ? 18 : 46);
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
        let k = 0, btns = [];
        const mark = () => {
          labels.forEach((L, i) => {
            if (!L) return;
            L.lab.classList.toggle('now', i === k);
            L.path.classList.toggle('now', i === k);
            if (i < k) { L.lab.classList.add('done'); L.path.classList.add('done'); L.lab.querySelector('.dist-a').innerHTML = mathHTML(qs[i].answer); }
          });
        };
        distRedraw = () => { draw(); mark(); drawLinks(); };
        const ask = () => {
          const q = qs[k];
          mark();
          // the product, big in the focus, with a line from its label under the bracket
          showFocus({ cap: `Open the brackets · ${k + 1} of ${qs.length}`, tokens: [{ text: `${q.prompt}` }] });
          linkPairs = () => { const L = labels[k]; const to = focusEl.querySelector('.fq-t'); return L && to ? [[L.lab, to]] : []; };
          requestAnimationFrame(() => { if (!gone && phase === 'brackets') drawLinks(); });
          hob(k === 0 ? 'Multiply each term inside by the number outside.' : '', 'hint');
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
        const end = () => {
          partKey = null; partHelpFn = null; stopParts = null; distRedraw = null;
          layer.remove();
          hideFocus();
          body.classList.remove('brackets-on');
          grid.style.height = '';
          grid.classList.remove('partgrid');
          hob('');
          resolve();
        };
        stopParts = () => { partKey = null; partHelpFn = null; distRedraw = null; layer.remove(); resolve(); };
        function pick(c, b) {
          if (phase !== 'brackets' || b.disabled) return;
          lastAction = performance.now();
          const q = qs[k];
          if (c.right) {
            b.classList.add('right');
            btns.forEach((o) => { o.disabled = true; });
            const slot = focusEl.querySelector('.fq-slot');
            if (slot) { slot.innerHTML = mathHTML(q.answer); slot.classList.add('got'); }
            clearLinks();
            k++;
            mark();
            if (k < qs.length) { hob(''); setTimeout(() => { if (!gone) ask(); }, PART_RIGHT_MS * Math.max(0.6, K)); }
            else { hob(`${sideText(qs.map((x) => x.product))}. Brackets open.`, 'good'); setTimeout(() => { if (!gone) end(); }, 750 * K); }
            return;
          }
          B.productPick(false);
          b.classList.add('shake', 'used');
          b.disabled = true;
          hob(productNudge(q, c), 'warn');
        }
        partKey = (i) => { const b = btns[i]; if (b && !b.disabled) b.click(); };
        partHelpFn = () => { lastAction = performance.now(); hob(productHelp(qs[k]), 'hint'); };
        ask();
        // (the arcs are drawn once the focus has taken its room, so they start from where the line now sits)
        requestAnimationFrame(() => { if (!gone && phase === 'brackets') distRedraw?.(); });
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
      const before = B.line;
      // open the brackets by hand: each product is asked first (the move itself is judged and counted as usual)
      let asked = false;
      if (s.move.k === 'dist' && !ineqMode) {
        const qs = bracketProducts(before, { rng });
        if (qs.length) { await bracketStage(qs); asked = true; if (gone) return; phase = 'anim'; setTrayEnabled(false); }
      }
      // the move is judged as soon as it is on the mat (the search takes up to a few tenths of a second on the longest
      // rungs); then the kid works out each part it changed, and the line settles into the one the move makes
      let res = null;
      const judge = () => { if (!res) res = B.press(s.move); };
      const P = ineqMode ? IB.partsOf(before, s.move, rng) : partsOf(before, s.move, { rng });
      if (P) {
        if (!ineqMode) P.rooms = ['L', 'R'];
        await workParts(P, judge);
        judge();
        if (gone) return;
        await settleLine(res.out);
      } else {
        const shown = applyMove(before, s.move, true);
        const anim = animateMove({ move: s.move, before, out: shown.out, ev: shown.ev, asked });
        await nextFrame(); await nextFrame(); judge();
        await anim;
      }
      if (gone) return;
      renderLedger();
      renderTop();
      renderSteps();
      if (ineqMode && res.flipped) IB.flipNoted(res);
      if (res.solved) {
        if (ineqMode) { IB.solvedChain(res); return; }
        hob(`x = ${fracText(B.keyTest()?.x ?? F(0))}. Check it in the beginning equation.`, 'good');
        review();
        return;
      }
      if (ineqMode && res.chainDone) IB.chainDone(res);
      else if (res.closer) { if (res.shortcut) hob('A shortcut! That works too.', 'good'); else if (!res.flipped) hob(''); unhelpful = 0; }
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
        drawLine(B.line, 'settle');
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
      const evs = ineqMode ? [] : [...(res.ev.L || []), ...(res.ev.R || [])];
      const grew = evs.some((e) => e.kind === 'merge' && /=\s*[−-]?\d/.test(e.text) && (() => {
        const nums = e.text.match(/\d+/g)?.map(Number) || [];
        return nums.length >= 3 && nums[nums.length - 1] > Math.max(nums[0], nums[1]);
      })());
      if (res.tag === 'part') return "Part of it. x isn't alone.";
      if (res.tag === 'undo') return 'That undo doesn’t match.';
      if (res.tag === 'inside') return !ineqMode && res.before && [...res.before.L, ...res.before.R].some((t) => t.t === 'b' && t.p.d > 1)
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
      drawLine(B.line, 'settle');
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
        const mix = hint.move && !ineqMode ? mixedSum(B.line, hint.move) : null;
        if (mix) showNL(mix.a, mix.b);
      } else if (hint.level === 3) {
        const b = grid.querySelector(`[data-key="${CSS.escape(hint.key || '')}"]`);
        if (b) b.classList.add('glow');
        for (const t of hint.targets) chipAt(t.side, t.index)?.classList.add('wiggle');
      }
      if (!auto) renderTop();
    }
    function askHob() {
      if (phase === 'parts' || phase === 'brackets' || phase === 'nlpick') { partHelpFn?.(); return; }
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
        review({ verdict: v });
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
        phase = 'review';
        showNext();
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

    // ----- the review: the check stays on screen, with one button to go on -----
    // x goes into the BEGINNING equation; each side is worked out underneath, step by step, all at once; a side that
    // comes down to a negative and a positive (−16 + 18) has its number line drawn finished under it; both sides land
    // on the same number and the hinge locks. Then ONE button: "Next problem" (Enter) opens the lid, pays, moves on.
    function review({ verdict: v = null } = {}) {
      if (gone) return;
      phase = 'review';
      setTrayEnabled(false);
      calcs.innerHTML = '';
      clearNL();
      hideFocus();
      pics.classList.add('off');
      body.classList.add('reviewing');
      const kt = !v && problem.kind === 'one' ? B.keyTest() : null;
      if (kt) {
        paper.querySelector('.lbx-start').classList.add('lit');
        const val = fracText(kt.x);
        const steps = { L: kt.left, R: kt.right };
        const work1 = Math.max(steps.L.length, steps.R.length) - 1;   // rows of working before the two answers
        const cell = (s, k) => {
          const st = steps[s];
          if (k === 0) return `<div class="rv-c rv-in">${keyInHTML(problem.start[s], kt.x)}</div>`;
          if (k >= st.length - 1) return '<div class="rv-c"></div>';
          return `<div class="rv-c">${mathHTML(st[k])}</div>`;
        };
        // a number line under a side whose last sum starts below zero or crosses it
        const hopOf = (s) => { const st = steps[s]; const pair = st.length >= 2 ? twoTerms(st[st.length - 2]) : null; return pair && weakSpot(pair[0], pair[1]) ? pair : null; };
        const hops = { L: hopOf('L'), R: hopOf('R') };
        let rows = '';
        for (let k = 0; k < Math.max(1, work1); k++) rows += `${cell('L', k)}<div class="rv-mid">${k === 0 ? hingeEl().outerHTML : ''}</div>${cell('R', k)}`;
        if (hops.L || hops.R) rows += `<div class="rv-c rv-nl" data-s="L"></div><div class="rv-mid"></div><div class="rv-c rv-nl" data-s="R"></div>`;
        const a = steps.L[steps.L.length - 1], b = steps.R[steps.R.length - 1];
        const same = a === b;
        B.keyResult(same);
        const lock = hingeEl();
        if (same) lock.classList.add('locked');
        rows += `<div class="rv-c rv-final ${same ? 'match' : 'miss'}">${mathHTML(a)}</div><div class="rv-mid">${lock.outerHTML}</div><div class="rv-c rv-final ${same ? 'match' : 'miss'}">${mathHTML(b)}</div>`;
        work.innerHTML = `<div class="rv">
          <div class="rv-head"><span class="ck-key">${KEY_SVG}<b>${esc(val)}</b></span><span class="rv-title">${mathHTML('x =')} <b class="ck-n">${esc(val)}</b> in the beginning equation</span></div>
          <div class="rv-grid">${rows}</div>
          <div class="rv-ok">${same ? `Both sides make ${esc(a)}. It checks out!` : 'The sides don’t match.'}</div></div>`;
        for (const s of ['L', 'R']) {
          if (!hops[s]) continue;
          const box = work.querySelector(`.rv-nl[data-s="${s}"]`);
          try {
            const w = Math.max(200, Math.min(420, box.clientWidth || 300));
            showNumberLine(box, { start: hops[s][0], change: hops[s][1], theme: 'dark', size: 'compact', width: w, animate: false, backing: false });
          } catch (e) { console.error(e); }
        }
        hob(`${a} = ${b}. It checks out!`, 'good');
        fitReview();
      } else if (v) {
        const line = work.querySelector('.wline');
        line?.querySelector('.hinge')?.classList.add('locked');
        work.insertAdjacentHTML('beforeend', `<div class="rv-verdict">${v === 'all'
          ? 'Both sides are the same, whatever <i class="x">x</i> is: <b>infinitely many solutions</b>.'
          : '<i class="x">x</i> is gone and the numbers don’t match: <b>no solution</b>.'}</div>`);
      }
      renderSteps({ checked: true });
      showNext();
    }
    // "−16 + 18" -> [-16, 18]; anything that isn't two whole numbers -> null
    function twoTerms(s) {
      const m = String(s).replace(/\s+/g, '').match(/^([−-]?\d+)([+−-])(\d+)$/);
      if (!m) return null;
      const a = Number(m[1].replace('−', '-'));
      const b = Number(m[3]) * (m[2] === '+' ? 1 : -1);
      return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
    }
    // the review shrinks to fit the mat (a phone's mat is short)
    function fitReview() {
      const rv = work.querySelector('.rv, .iv');
      if (!rv) return;
      rv.style.fontSize = '';
      const wrap = $('.lbx-workwrap');
      let size = parseFloat(getComputedStyle(rv).fontSize) || 30;
      for (let guard = 0; guard < 30 && size > 13 && (rv.scrollWidth > wrap.clientWidth - 8 || rv.offsetHeight > wrap.clientHeight - 6); guard++) {
        size -= 1.5;
        rv.style.fontSize = `${size}px`;
      }
    }
    // ----- an inequality's answer: pick the number line that shows it -----
    // Four pictures in the tray (open or filled circles, shaded one way or the other, between or outward), all on the
    // same stretch of the line. A wrong one shakes and Hob says what it shows; the right one leads to the review.
    function linePick() {
      if (gone) return;
      phase = 'nlpick';
      const set = B.answerSet();
      const { win, choices } = B.lineChoices();
      const marks = [...new Set([...choices.flatMap((c) => c.set.flatMap((pc) => [pc.lo, pc.hi])).filter((v) => v !== null), 0, Math.ceil(win.lo), Math.floor(win.hi)])];
      body.classList.add('nl-picking');   // (a phone hides the working line meanwhile: the question says it)
      showFocus({ cap: 'The answer on a number line', lead: 'Which number line shows', tokens: [{ text: Q.setText(set) }], eq: null, cls: 'fq-nlq' });
      grid.style.height = '';
      grid.innerHTML = '';
      grid.classList.add('nlgrid');
      body.classList.remove('busy');
      askBtn.disabled = false;
      undoBtn.disabled = true;
      hob('Filled circle or open? Which way does it go?', 'hint');
      const wide = typeof matchMedia === 'function' && matchMedia(WIDE_SCREEN).matches;
      // drawn at the size the button shows it, so the numbers under the line stay readable
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length || 1;
      const cellW = Math.max(200, Math.min(640, Math.round((grid.clientWidth - 14 * (cols - 1)) / cols - (wide ? 56 : 20))));
      const btns = choices.map((c, i) => {
        const b = h('button', 'lbx-move nlpick', `${setLineSVG(c.set, win, { width: cellW, height: wide ? 62 : 46, marks })}<kbd>${i + 1}</kbd>`);
        b.type = 'button';
        b.dataset.right = c.right ? '1' : '0';
        b.setAttribute('aria-label', `number line ${i + 1}`);
        b.addEventListener('click', () => pick(c, b));
        grid.appendChild(b);
        return b;
      });
      function pick(c, b) {
        if (phase !== 'nlpick' || b.disabled || gone) return;
        lastAction = performance.now();
        if (B.pickLine(c)) {
          phase = 'anim';
          b.classList.add('right');
          btns.forEach((o) => { o.disabled = true; });
          hob('That’s it.', 'good');
          partKey = null; partHelpFn = null;
          setTimeout(() => { if (!gone) reviewIneq(); }, 700 * Math.max(0.6, K));
          return;
        }
        b.classList.add('shake', 'used');
        b.disabled = true;
        hob(Q.lineNudge(set, c), 'warn');
        renderTop();
      }
      partKey = (i) => { const b = btns[i]; if (b && !b.disabled) b.click(); };
      partHelpFn = () => { lastAction = performance.now(); hob(Q.LINE_HELP, 'hint'); };
      renderSteps();
      renderTop();
    }

    // The review of an inequality: the answer drawn on its number line, and a number from the shaded part put into the
    // beginning, each room worked out, the signs holding.
    function reviewIneq() {
      if (gone) return;
      phase = 'review';
      setTrayEnabled(false);
      calcs.innerHTML = '';
      hideFocus();
      body.classList.remove('nl-picking');
      body.classList.add('reviewing');
      paper.querySelector('.lbx-start').classList.add('lit');
      const kt = B.keyTest();
      const { win } = B.lineChoices();
      const wide = typeof matchMedia === 'function' && matchMedia(WIDE_SCREEN).matches;
      const c = problem.start.chains[kt.ci];
      const X = F(kt.x);
      const val = fracText(X);
      const n = c.rooms.length;
      const depth = Math.max(...kt.rows.map((r) => r.length));
      let cells = '';
      for (let k = 0; k < Math.max(1, depth - 1); k++) {
        c.rooms.forEach((room, i) => {
          if (i) cells += `<div class="rv-mid iv-rel">${k === 0 ? esc(c.rels[i - 1]) : ''}</div>`;
          const st = kt.rows[i];
          cells += k === 0 ? `<div class="rv-c rv-in">${keyInHTML(room, X)}</div>` : `<div class="rv-c">${k < st.length - 1 ? mathHTML(st[k]) : ''}</div>`;
        });
      }
      c.rooms.forEach((room, i) => {
        if (i) cells += `<div class="rv-mid iv-rel">${esc(c.rels[i - 1])}</div>`;
        cells += `<div class="rv-c rv-final ${kt.ok ? 'match' : 'miss'}">${mathHTML(kt.values[i])}</div>`;
      });
      const cols = Array.from({ length: n }, () => 'minmax(0, 1fr)').join(' auto ');
      const truth = kt.values.map((v, i) => (i ? ` ${kt.rels[i - 1]} ${v}` : v)).join('');
      work.innerHTML = `<div class="iv">
        <div class="iv-ans"><span class="iv-k">The answer</span><b>${mathHTML(Q.setText(kt.set))}</b></div>
        <div class="iv-line">${setLineSVG(kt.set, win, { width: wide ? 760 : 360, height: wide ? 86 : 66, theme: 'mat' })}</div>
        <div class="iv-check">Check a number from the shaded part: <b>${mathHTML(`x = ${val}`)}</b>${problem.start.chains.length > 1 ? ` in ${mathHTML(Q.chainText(c))}` : ''}</div>
        <div class="rv-grid iv-grid" style="grid-template-columns: ${cols}">${cells}</div>
        <div class="rv-ok">${kt.ok ? `${esc(truth)} is true. It checks out!` : 'That doesn’t hold.'}</div></div>`;
      B.keyResult(kt.ok);
      hob(kt.ok ? `x = ${val} makes it true. It checks out!` : 'Hmm, that number doesn’t work.', kt.ok ? 'good' : 'warn');
      renderSteps({ checked: true });
      fitReview();
      showNext();
    }

    // the one button at the end
    function showNext() {
      body.classList.add('reviewing');
      nextBtn.hidden = false;
      const last = own && typeof next !== 'function' && !bag.length;
      nextBtn.querySelector('.lbl').textContent = last ? 'Finish' : 'Next problem';
      nextBtn.disabled = false;
      requestAnimationFrame(() => nextBtn.focus({ preventScroll: true }));
    }
    function goOn() {
      if (phase !== 'review' || gone) return;
      lastAction = performance.now();
      nextBtn.disabled = true;
      paper.querySelector('.lbx-start').classList.remove('lit');
      finish();
    }

    // ----- the box is finished: record it, and hand it to the session (coins, then the next box) -----
    function finish({ left = false } = {}) {
      if (gone) return;
      gone = true;
      recorded = true;
      phase = left ? 'done' : 'open';
      clearInterval(tick);
      stopParts?.();
      clearNL();
      const result = B.finish({ left });
      alg.record(result);
      setTrayEnabled(false);
      finished({ ...result, tier }, ctrl);
    }
    function leave() {
      if (gone || !WORKING.includes(phase)) return;
      hob('That one goes back in the pile.', 'warn');
      finish({ left: true });
    }

    // ----- keys: 1-4 buttons, U undo, H hint, Space/Enter skip ahead during an animation, Enter: next problem -----
    function onKey(e, k) {
      if (phase === 'parts' || phase === 'brackets' || phase === 'nlpick') {
        if (/^[1-4]$/.test(k)) { e.preventDefault(); partKey?.(Number(k) - 1); }
        else if (k === 'h' || k === '?') askHob();
        return;
      }
      if (phase === 'review') { if (k === ' ' || k === 'enter') { e.preventDefault(); goOn(); } return; }
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
      requestAnimationFrame(() => {
        fitQueued = false;
        if (gone) return;
        if (phase === 'review') { fitReview(); return; }
        fitLine();
        fitFocus();
        if (distRedraw) distRedraw(); else if (linkPairs) drawLinks();
      });
    };
    const resizeWatch = typeof ResizeObserver === 'function' ? new ResizeObserver(refit) : null;
    resizeWatch?.observe(work);

    // a tap anywhere fast-forwards a move while it plays (it never adds a move)
    body.addEventListener('pointerdown', () => { if (phase === 'anim') ff = true; });
    nextBtn.addEventListener('click', goOn);
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
      leaveBtn.hidden = !(B.canLeave((performance.now() - openedAt) / 1000) || opts.dev) || !WORKING.includes(phase);
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
        stopParts?.();
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
        stopParts?.();
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
    drawLine(problem.start, 'settle');
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
      I1: 'Less than, more than: get x alone, same as always.', I2: 'Watch the sign when you × or ÷ by a negative.',
      I3: 'Three rooms: whatever you do to one, do to every room.', I4: '“Or”: two inequalities. Solve each one.',
    }[problem.rung] || (ineqMode ? 'Get x alone, the same move on every side.' : 'Get x alone. Same move on both sides.'));
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

  // After "Next problem": the lid opens on the mat, the coins fly from the box into the gold and it counts up; the
  // stars and the Safecracker count show for a moment (about a second). Enter, Space or a tap hurries it.
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
          const delay = hurry ? 0 : (140 + i * 40) * q;
          const dur = hurry ? 200 : 460 * q;
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
        if ((hurry && el2 > 450) || el2 > REWARD_MS * q + (lines.length > 1 ? 400 : 0)) { finishUp(); return; }
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
    // for test rigs: the box being worked and its phase (play | anim | parts | brackets | nlpick | review | open | done)
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
