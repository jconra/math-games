// One "Work it out" box in the lock-box panel (the boxes are made in workout.js; panel.js mounts this one in place of
// the equation box when the plan says so, and the session around it is the same: the coins, "Next problem", the next
// box sliding in).
//
// The page is the lock box's own: the steps card (the order of operations, or the rung's rule and a worked example),
// the paper (the beginning, then each line as it is worked), the mat with the expression in the biggest type, Old Hob,
// and the tray of four answers. Each step of the box is played in turn:
//   "Which part first?"  the parts that could be worked are in the tray; a wrong one shakes, Hob says which rule it
//                        broke ("× and ÷ come before + and −: 4 × 2 first") and its part flashes on the mat; the right
//                        one is boxed in gold on the mat and its rule lights on the steps card
//   the part             big in the middle of the mat (the focus: "4 × 2 = ?", "5² means ?"), four answers; a wrong
//                        one shakes and Hob nudges; the right one drops into the slot, and the line is written again
//                        with the answer in place (and on the paper, with the part worked beside it)
// Ask Hob: the rule for this step and its row on the card (a pick), the help for the part (a times skip-count, the
// number line for a sum with negatives, what a power means), then the right answer glows. Nothing is timed on screen.
// When one number is left the review stays on the mat: the whole working, line under line, and ONE button.
//
// What it tells the skill model (strand.js): each part that is plain arithmetic is an answer in its own strand
// (workCredit), timed; the box is one answer in order of operations or exponents, right when every pick and every
// part of the strand's own skill was right the first time with no more than the first hint; timed until solved.
//
//   mountWorkBox(kit, ctx) -> the box's controller (the same shape as panel.js mountBox's)
//     kit: { HOB_SVG, STAR, STAR_PAY? }  the panel's drawings
//     ctx: { info, tier, problem, plan, top, bodies, opts, session, skillRider, finished, nextLabel(), where, K }

import { workCredit, recordPart } from './strand.js';
import { recordPlan } from './levelplan.js';
import { ORDER_RULES, toText } from './workout.js';
import { TIER_NAME, starsFor, goldFor } from './box.js';
import { answerTimer } from '../ui/answertimer.js';
import { showNumberLine } from '../ui/numberline.js';
import { partSum } from '../math/jobsums.js';

const PART_RIGHT_MS = 650;    // a right answer sits in its slot this long before the line is written again
const PICK_RIGHT_MS = 450;    // a right "which part first?" shows its gold box this long before the part is asked
const WIDE_SCREEN = '(min-width: 901px) and (min-height: 521px)';
const LEAVE_AFTER_S = 60;     // "Skip this box" shows after this long (or once Hob has given an answer away)

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// math text to HTML: 2^3 as a raised 3, 1/8 as a fraction
export const wkHTML = (s) => esc(s)
  .replace(/\^([−-]?\d+)/g, '<sup class="wk-sup">$1</sup>')
  .replace(/(\d+)\/(\d+)/g, '<span class="wk-fr"><span>$1</span><span>$2</span></span>');
function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isOp = (p) => ['+', '−', '×', '÷'].includes(p);

export function mountWorkBox(kit, ctx) {
  const { info, tier, problem, plan, top, bodies, opts, session, skillRider, finished } = ctx;
  const K = ctx.K ?? 1;
  const order = problem.map === 'order';
  const steps = problem.steps;

  // ----- the page -----
  const body = h('div', `lbx-body lbx-tier-${tier} wk`);
  body.style.setProperty('--k', K.toFixed(3));
  const stepsEl = h('section', 'lbx-steps');
  stepsEl.setAttribute('aria-label', order ? 'The order' : 'The rule');
  body.appendChild(stepsEl);
  const paper = h('section', 'lbx-paper');
  paper.innerHTML = `<div class="lbx-start"><span class="lbx-start-k">Beginning</span><span class="lbx-start-l">${wkHTML(problem.start)}</span></div>
    <div class="lbx-ledger" aria-label="your working"></div>`;
  body.appendChild(paper);
  const stageEl = h('section', 'lbx-stage');
  stageEl.innerHTML = `<div class="lbx-workwrap"><div class="lbx-work"><div class="wk-line"></div></div>
      <div class="lbx-focus" hidden aria-live="polite"></div></div>
    <div class="lbx-hob"><span class="lbx-hob-face">${kit.HOB_SVG}</span><span class="lbx-hob-say" aria-live="polite"></span></div>
    <button class="lbx-leave" type="button" hidden>Skip this box</button>`;
  body.appendChild(stageEl);
  const tray = h('section', 'lbx-tray');
  tray.innerHTML = `<button class="lbx-undo lbx-side-btn" type="button" disabled><span>Undo</span><kbd>U</kbd></button>
    <div class="lbx-grid partgrid"></div>
    <button class="lbx-ask lbx-side-btn" type="button"><span>Ask Hob</span><kbd>H</kbd></button>
    <button class="lbx-nextbtn" type="button" hidden><span class="lbl">Next problem</span><kbd>Enter</kbd></button>`;
  body.appendChild(tray);
  const $ = (s) => body.querySelector(s);
  const lineEl = $('.wk-line'), workEl = $('.lbx-work'), focusEl = $('.lbx-focus'), ledgerEl = $('.lbx-ledger'), grid = $('.lbx-grid');
  const say = $('.lbx-hob-say'), askBtn = $('.lbx-ask'), nextBtn = $('.lbx-nextbtn'), leaveBtn = $('.lbx-leave');

  // the top strip shows this box
  top.querySelector('.lbx-tier').textContent = TIER_NAME[tier];
  top.querySelector('.lbx-rung').innerHTML = `${esc(ctx.where)} · ${esc(plan && plan.title ? `${plan.title} · ${problem.name || ''}` : `Work it out · ${problem.name || ''}`)}${opts.dev || opts.debug ? ` <small>${esc(problem.rung)}</small>` : ''}`;

  // ----- state -----
  let phase = 'anim', gone = false, recorded = false, solved = false;
  let si = 0;                   // the step being played
  let wrongs = 0, xSlips = 0, hintLevel = 0;
  let stepHint = 0;             // Ask Hob on this step: 1 the rule or the help, 2 the answer glows
  let keyFn = null;             // keys 1-4 for the step's buttons
  const openedAt = performance.now();
  let lastAction = performance.now();
  const boxClock = answerTimer();
  let boxTime = null;
  let expr = steps[0].expr;     // the line on the mat now

  function hob(text, mood = '') {
    say.innerHTML = text ? wkHTML(text) : '';
    say.dataset.mood = mood;
    say.classList.remove('fresh'); void say.offsetWidth; say.classList.add('fresh');
  }

  // ----- the top strip: one tumbler per step, the stars as they stand -----
  function renderTop() {
    if (gone) return;
    const tum = top.querySelector('.lbx-tumblers');
    if (tum.children.length !== steps.length) tum.innerHTML = steps.map(() => '<i class="tum"></i>').join('');
    [...tum.children].forEach((t, i) => t.classList.toggle('down', i < si));
    top.querySelector('.lbx-par').textContent = `step ${Math.min(si + 1, steps.length)} of ${steps.length}`;
    const s = starsFor(steps.length + wrongs, steps.length, hintLevel);
    const starsEl = top.querySelector('.lbx-stars');
    starsEl.innerHTML = [1, 2, 3].map((i) => kit.STAR(i <= s)).join('');
    starsEl.setAttribute('aria-label', `${s} stars`);
  }

  // ----- the steps card: the order of operations (or the rung's rule), and a worked example -----
  let cardShown = 'open';
  function buildCard() {
    const wide = typeof matchMedia === 'function' && matchMedia(WIDE_SCREEN).matches;
    cardShown = session.cardPref || (wide ? 'open' : 'folded');
    // (an order box: the four rules, then an example; an exponent box: its rule and a worked example)
    const rows = order ? ORDER_RULES.map((r) => ({ n: r.n, id: r.id, label: r.label })) : [];
    const sep = problem.rung === 'P5' ? '<b>,</b> ' : '<b>=</b> ';   // (P5's example is a pattern: 2^0 = 1, 2^−1 = 1/2, ...)
    const ex = `<p class="wk-ex"><span>Example</span> ${problem.example.map((t, i) => `${i ? sep : ''}${wkHTML(t)}`).join(' ')}</p>`;
    stepsEl.innerHTML = `<button class="st-bar" type="button" aria-expanded="false">
        <span class="st-title">${order ? 'The order' : 'How it works'}</span><span class="st-mini" aria-hidden="true">${rows.map((r) => `<i data-n="${r.n}">${r.n}</i>`).join('')}</span>
        <span class="st-nowtxt"></span><span class="st-chev" aria-hidden="true"></span></button>
      <div class="st-card">
        <p class="st-rule">${wkHTML(problem.rule)}</p>
        ${rows.length ? `<ol class="st-list">${rows.map((r) => `<li class="st-row" data-n="${r.n}" data-id="${r.id}"><span class="st-n">${r.n}</span>
          <span class="st-txt">${wkHTML(r.label)}</span><span class="st-note"></span></li>`).join('')}</ol>` : ''}${ex}
      </div>`;
    stepsEl.querySelector('.st-bar').addEventListener('click', () => {
      cardShown = stepsEl.classList.contains('open') ? 'folded' : 'open';
      session.cardPref = cardShown;
      setCard();
    });
    stepsEl.querySelector('.st-card').addEventListener('click', () => stepsEl.classList.toggle('all'));
    setCard();
    if (!order) { stepsEl.classList.add('all'); stepsEl.querySelector('.st-nowtxt').textContent = problem.name; }
  }
  function setCard() {
    const open = cardShown !== 'folded';
    stepsEl.classList.toggle('open', open);
    stepsEl.classList.toggle('folded', !open);
    stepsEl.querySelector('.st-bar').setAttribute('aria-expanded', String(open));
    requestAnimationFrame(() => { if (!gone) fitLine(); });
  }
  // the rule a step follows, lit on the card (done: the rules already used in this box get a tick)
  const used = new Set();
  function lightRule(id, { light = false } = {}) {
    if (!order) return;
    stepsEl.querySelectorAll('.st-row').forEach((row) => {
      const rid = row.dataset.id;
      const state = rid === id ? 'now' : used.has(rid) ? 'done' : '';
      row.dataset.state = state;
      const mini = stepsEl.querySelector(`.st-mini i[data-n="${row.dataset.n}"]`);
      if (mini) mini.dataset.state = state;
    });
    const r = ORDER_RULES.find((x) => x.id === id);
    stepsEl.querySelector('.st-nowtxt').innerHTML = r ? `<b>${r.n}</b> ${esc(r.short)}` : '';
    if (light) {
      if (cardShown === 'folded') { cardShown = 'open'; setCard(); }
      const row = stepsEl.querySelector(`.st-row[data-id="${id}"]`);
      if (row) { row.classList.remove('lit'); void row.offsetWidth; row.classList.add('lit'); }
    }
  }

  // ----- the line on the mat: the expression, a part boxed in gold (on), or flashed red (no) -----
  function drawLine(pieces, { span = null, cls = 'on', fresh = null } = {}) {
    let html = '';
    pieces.forEach((p, i) => {
      if (span && i === span[0]) html += `<span class="wk-grp ${cls}">`;
      const sp = i > 0 && (isOp(p) || isOp(pieces[i - 1])) ? ' wk-gap' : '';
      if (p.startsWith('^')) html += `<sup class="wk-sup wk-t" data-i="${i}">${esc(p.slice(1))}</sup>`;
      else html += `<span class="wk-t${isOp(p) ? ' wk-op' : ''}${sp}${fresh === i || fresh === 'all' ? ' wk-new' : ''}" data-i="${i}">${wkHTML(p)}</span>`;
      if (span && i === span[1]) html += '</span>';
    });
    lineEl.innerHTML = html;
    fitLine();
  }
  function fitLine() {
    lineEl.style.fontSize = '';
    const room = workEl.clientWidth - 12;
    let size = parseFloat(getComputedStyle(lineEl).fontSize) || 44;
    while (lineEl.scrollWidth > room && size > 22) { size -= 2; lineEl.style.fontSize = `${size}px`; }
  }

  // ----- the paper: the beginning, then each line as it is worked, with the part worked beside it -----
  function ledgerRow(text, note) {
    ledgerEl.querySelectorAll('.wk-lg.now').forEach((r) => r.classList.remove('now'));
    const row = h('div', 'wk-lg now', `<span class="wk-lg-eq">=</span><span class="wk-lg-txt">${wkHTML(text)}</span>${note ? `<span class="wk-lg-note">${wkHTML(note)}</span>` : ''}`);
    ledgerEl.appendChild(row);
    ledgerEl.scrollTop = ledgerEl.scrollHeight;
  }

  // ----- the focus: the part being worked, big in the middle of the mat -----
  function showFocus(step) {
    body.classList.add('focus-on');
    focusEl.hidden = false;
    focusEl.className = 'lbx-focus';
    const of = steps.filter((s) => s.kind === 'part').length;
    const k = steps.slice(0, si + 1).filter((s) => s.kind === 'part').length;
    focusEl.innerHTML = `<div class="fq-cap">${wkHTML(step.cap || 'Work it out')}${of > 1 ? ` <span class="fq-of">${k} of ${of}</span>` : ''}</div>
      <div class="fq-q"><span class="fq-sum"><span class="wk-m">${wkHTML(step.q)}</span></span><span class="fq-eq${step.eq.length > 1 ? ' fq-words' : ''}">${esc(step.eq)}</span><span class="fq-slot">?</span></div>
      <div class="fq-nl"></div>`;
    fitFocus();
  }
  function hideFocus() { focusEl.hidden = true; focusEl.innerHTML = ''; body.classList.remove('focus-on'); }
  function fitFocus() {
    const q = focusEl.querySelector('.fq-q');
    if (!q) return;
    q.style.fontSize = '';
    const room = focusEl.clientWidth - 16;
    let size = parseFloat(getComputedStyle(q).fontSize) || 60;
    while (q.scrollWidth > room && size > 22) { size -= 2; q.style.fontSize = `${size}px`; }
  }
  function showLine(line) {
    const box = focusEl.querySelector('.fq-nl');
    if (!box || box.childElementCount) return;
    try {
      const wide = typeof matchMedia === 'function' && matchMedia(WIDE_SCREEN).matches;
      const w = Math.round(Math.max(240, Math.min(wide ? 760 : 420, (focusEl.clientWidth || 400) - 12)));
      showNumberLine(box, { start: line.start, change: line.change, reveal: false, animate: false, theme: 'dark', size: wide ? 'full' : 'compact', width: w, backing: false });
    } catch (e) { console.error(e); }
  }

  // ----- the tray: the step's choices (keys 1-4); long ones shrink to fit their button -----
  function buttons(choices, onPick) {
    grid.innerHTML = '';
    const btns = choices.map((c, i) => {
      const b = h('button', 'lbx-move partpick wkpick', `<span class="lbl">${wkHTML(c.text)}</span><kbd>${i + 1}</kbd>`);
      b.type = 'button';
      b.dataset.right = c.right ? '1' : '0';
      b.addEventListener('click', () => onPick(c, b));
      grid.appendChild(b);
      return b;
    });
    grid.classList.toggle('three', btns.length === 3);
    requestAnimationFrame(() => btns.forEach((b) => {
      const l = b.querySelector('.lbl');
      let size = parseFloat(getComputedStyle(l).fontSize) || 30;
      while (l.scrollWidth > b.clientWidth - 24 && size > 14) { size -= 2; l.style.fontSize = `${size}px`; }
    }));
    keyFn = (i) => { const b = btns[i]; if (b && !b.disabled) b.click(); };
    return btns;
  }

  // ----- the steps, one after another -----
  function next() {
    if (gone) return;
    stepHint = 0;
    askBtn.classList.remove('bounce');
    renderTop();
    if (si >= steps.length) { review(); return; }
    const step = steps[si];
    if (step.kind === 'pick') askPick(step); else askPart(step);
  }

  // which part first?
  function askPick(step) {
    phase = 'parts';
    hideFocus();
    drawLine(step.expr);
    lightRule(null);
    const firsts = steps.slice(0, si).filter((s) => s.kind === 'pick').length;
    hob(firsts === 0 ? 'Which part do you work out first?' : 'Which part next?', 'hint');
    let first = true;
    const btns = buttons(step.choices, (c, b) => {
      if (phase !== 'parts' || b.disabled || gone) return;
      lastAction = performance.now();
      if (c.right) {
        if (first) first = false;
        phase = 'anim';
        b.classList.add('right');
        btns.forEach((o) => { o.disabled = true; });
        keyFn = null;
        drawLine(step.expr, { span: c.span });
        used.add(step.rule);
        lightRule(step.rule);
        hob('');
        setTimeout(() => { if (!gone) { si++; next(); } }, PICK_RIGHT_MS * Math.max(0.6, K));
        return;
      }
      if (first) { first = false; xSlips++; }
      wrongs++;
      b.classList.add('shake', 'used');
      b.disabled = true;
      drawLine(step.expr, { span: c.span, cls: 'no' });
      setTimeout(() => { if (!gone && phase === 'parts' && steps[si] === step) drawLine(step.expr); }, 900);
      hob(c.why || 'Not that one first.', 'warn');
      renderTop();
    });
    btns.forEach((b) => { b.disabled = false; });
  }

  // a part: worked out with four answers
  function askPart(step) {
    phase = 'parts';
    drawLine(step.expr, { span: step.span });
    showFocus(step);
    if (order && step.rule) { used.add(step.rule); lightRule(step.rule); }   // (the rule this part follows, lit on the card)
    if (si === 0 || steps[si - 1].kind !== 'pick') hob(si === 0 ? (order ? 'Work it out.' : 'Your turn.') : '', 'hint');
    const cr = workCredit(step), clock = answerTimer();
    let first = true;
    const firstPick = (right) => {
      if (!first) return;
      first = false;
      const t = clock.stop();
      if (cr && cr.x) { if (!right) xSlips++; }
      else if (cr) { try { recordPart(skillRider, cr, { right, ...t }); } catch (e) { console.error(e); } }
    };
    stopStep = () => clock.cancel();
    const btns = buttons(step.choices, (c, b) => {
      if (phase !== 'parts' || b.disabled || gone) return;
      lastAction = performance.now();
      firstPick(c.right);
      if (c.right) {
        phase = 'anim';
        b.classList.add('right');
        btns.forEach((o) => { o.disabled = true; });
        keyFn = null;
        const slot = focusEl.querySelector('.fq-slot');
        if (slot) { slot.innerHTML = wkHTML(step.answer); slot.classList.add('got'); }
        hob('');
        setTimeout(() => {
          if (gone) return;
          // the line written again with the answer in place, and on the paper
          // (the new number glows: on an order box the one put in place, past a bracket put round a negative; on an
          // exponent box the whole new line)
          const at = step.span ? step.span[0] : null;
          const fresh = !order ? 'all' : at !== null && step.after[at] === '(' ? at + 1 : at;
          drawLine(step.after, { fresh });
          ledgerRow(toText(step.after), `${step.q} ${step.eq === '=' ? '=' : 'means'} ${step.answer}`);
          expr = step.after;
          si++;
          if (si >= steps.length) solvedNow();
          next();
        }, PART_RIGHT_MS * Math.max(0.6, K));
        return;
      }
      wrongs++;
      b.classList.add('shake', 'used');
      b.disabled = true;
      hob(c.nudge || 'Not that one.', 'warn');
      if (step.line) showLine(step.line);
      renderTop();
    });
    btns.forEach((b) => { b.disabled = false; });
  }
  let stopStep = null;

  function askHob() {
    if (gone || phase !== 'parts') return;
    lastAction = performance.now();
    askBtn.classList.remove('bounce');
    const step = steps[si];
    stepHint = Math.min(2, stepHint + 1);
    hintLevel = Math.max(hintLevel, stepHint === 2 ? 3 : 1);   // (box.js's levels: 3 = the answer was shown)
    if (step.kind === 'pick') {
      if (stepHint === 1) { hob(step.help[0], 'hint'); lightRule(step.rule, { light: true }); }
      else { hob(step.help[1], 'hint'); grid.querySelector('[data-right="1"]')?.classList.add('glow'); }
    } else if (stepHint === 1) { hob(step.help, 'hint'); if (step.line) showLine(step.line); }
    else { hob(`It's ${step.answer}.`, 'hint'); grid.querySelector('[data-right="1"]')?.classList.add('glow'); }
    renderTop();
  }

  function solvedNow() { solved = true; if (!boxTime) boxTime = boxClock.stop(); }

  // ----- the review: the whole working, line under line, and one button -----
  function review() {
    phase = 'review';
    hideFocus();
    keyFn = null;
    body.classList.add('reviewing');
    paper.querySelector('.lbx-start').classList.add('lit');
    const L = problem.lines;
    const notes = steps.filter((s) => s.kind === 'part').map((s) => `${s.q} ${s.eq === '=' ? '=' : 'means'} ${s.answer}`);
    workEl.innerHTML = `<div class="wk-rv">${L.map((t, i) => `<div class="wk-rv-row${i === L.length - 1 ? ' wk-rv-last' : ''}">
        <span class="wk-rv-eq">${i ? '=' : ''}</span><span class="wk-rv-txt${i === L.length - 1 ? ' wk-rv-final' : ''}">${wkHTML(t)}</span>
        <span class="wk-rv-note">${i ? wkHTML(notes[i - 1] || '') : ''}</span></div>`).join('')}
      <div class="rv-ok">${wkHTML(`${problem.start} = ${problem.answer}.`)} Worked out, one part at a time!</div></div>`;
    fitReview();
    hob(xSlips || wrongs ? `${problem.answer}. You worked it out.` : `${problem.answer}. Every step right!`, 'good');
    lightRule(null);
    renderTop();
    nextBtn.hidden = false;
    nextBtn.querySelector('.lbl').textContent = ctx.nextLabel();
    nextBtn.disabled = false;
    requestAnimationFrame(() => nextBtn.focus({ preventScroll: true }));
  }
  function fitReview() {
    const rv = workEl.querySelector('.wk-rv');
    if (!rv) return;
    rv.style.fontSize = '';
    const wrap = $('.lbx-workwrap');
    let size = parseFloat(getComputedStyle(rv).fontSize) || 30;
    // (too wide: a line wider than the review's own box; too tall: taller than the mat)
    for (let g = 0; g < 30 && size > 13 && (rv.scrollWidth > rv.clientWidth + 1 || rv.offsetHeight > wrap.clientHeight - 6); g++) {
      size -= 1.5;
      rv.style.fontSize = `${size}px`;
    }
  }
  function goOn() {
    if (phase !== 'review' || gone) return;
    lastAction = performance.now();
    nextBtn.disabled = true;
    paper.querySelector('.lbx-start').classList.remove('lit');
    finish();
  }

  // ----- the result, as box.js finish gives one; the skill model hears the box (strand.js) -----
  function result({ left = false } = {}) {
    const ok = solved && !left;
    const par = steps.length, moves = par + wrongs;
    const stars = ok ? starsFor(moves, par, hintLevel) : 0;
    return { solved: ok, stars, gold: ok ? goldFor(tier, stars) : 0, moves, par, rung: problem.rung, clean: ok && xSlips === 0 && hintLevel <= 1,
      hints: hintLevel, left, traps: [], tools: [], arith: [], wrongPicks: wrongs, productSlips: 0, partSlips: 0 };
  }
  let credited = false;
  function credit(res) {
    if (credited) return;
    credited = true;
    try {
      const t = boxTime || boxClock.stop();
      recordPlan(skillRider, plan, problem, { right: !!(res.solved && res.clean), size: steps.length, ...t });
    } catch (e) { console.error(e); }
  }
  function finish({ left = false } = {}) {
    if (gone) return;
    gone = true;
    recorded = true;
    phase = left ? 'done' : 'open';
    clearInterval(tick);
    stopStep?.();
    const res = result({ left });
    credit(res);
    finished({ ...res, tier }, ctrl);
  }
  function leave() {
    if (gone || !['parts', 'anim'].includes(phase) || solved) return;
    hob('That one goes back in the pile.', 'warn');
    finish({ left: true });
  }

  // ----- keys: 1-4 the buttons, H Ask Hob, Enter the next problem -----
  function onKey(e, k) {
    if (phase === 'parts') {
      if (/^[1-4]$/.test(k)) { e.preventDefault(); keyFn?.(Number(k) - 1); }
      else if (k === 'h' || k === '?') askHob();
      return;
    }
    if (phase === 'review' && (k === ' ' || k === 'enter')) { e.preventDefault(); goOn(); }
  }

  const refit = () => requestAnimationFrame(() => { if (gone) return; if (phase === 'review') fitReview(); else { fitLine(); fitFocus(); } });
  const resizeWatch = typeof ResizeObserver === 'function' ? new ResizeObserver(refit) : null;
  resizeWatch?.observe(workEl);
  nextBtn.addEventListener('click', goOn);
  askBtn.addEventListener('click', askHob);
  leaveBtn.addEventListener('click', leave);
  // the Ask Hob button bounces after 15 s with nothing tapped; "Skip this box" after a minute or an answer given away
  const tick = setInterval(() => {
    if (gone) return;
    const idle = (performance.now() - lastAction) / 1000;
    askBtn.classList.toggle('bounce', phase === 'parts' && idle > 15 && stepHint < 2);
    leaveBtn.hidden = !(((performance.now() - openedAt) / 1000 > LEAVE_AFTER_S || hintLevel >= 3 || opts.dev) && phase === 'parts');
  }, 1000);

  // for the panel and the rigs: the box as the panel's debug handle reads it
  const B = {
    get par() { return steps.length; },
    get solved() { return solved; },
    get moves() { return steps.length + wrongs; },
    get hintLevel() { return hintLevel; },
    get step() { return si; },
    lineText: () => toText(expr),
    buttons: null,
  };
  const ctrl = {
    body, stageEl, B, problem, level: problem.level ?? plan.level, tier, plan,
    phase: () => phase,
    // Work it out on the part being worked out ("4 × 2", "5 × 5 × 5": src/math/jobsums.js partSum); "which part first?",
    // a power's meaning ("5² means ?") or a root: none (the tools' entry instead)
    workSum: () => { const st = steps[si]; return !gone && phase === 'parts' && st && st.kind === 'part' && st.eq === '=' ? partSum(st.q) : null; },
    setPhase: (p) => { phase = p; },
    numberLine: () => !!focusEl.querySelector('.fq-nl svg, .fq-nl canvas'),
    steps: () => null,
    cardShown: () => cardShown,
    onKey,
    hob,
    fit: () => refit(),
    destroy() {
      gone = true;
      clearInterval(tick);
      boxClock.cancel();
      stopStep?.();
      resizeWatch?.disconnect();
    },
    // "Done for now" mid-box: an unsolved box isn't counted; one solved (its review up) is kept and paid
    stop() {
      if (gone) return null;
      gone = true;
      clearInterval(tick);
      stopStep?.();
      if (!solved || recorded) return null;
      recorded = true;
      const res = result();
      credit(res);
      return { ...res, tier };
    },
  };

  // ----- first draw -----
  bodies.appendChild(body);
  buildCard();
  renderTop();
  drawLine(expr);
  (async () => { await sleep(80); if (!gone) next(); })();
  return ctrl;
}
