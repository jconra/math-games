// THE WORKED AREA: long multiplication and long division worked out a step at a time on a sheet of paper, opened from a
// store order or a supply slip whose sum is too big to do in your head (16 × 7 hands-days, 112 ÷ 5 crates), and from
// the tools button in any job (src/ui/tools.js: Work it out), which also works adding and taking away in columns (the
// carrying and borrowing written by the board itself). The math and the slips are src/math/longwork.js; this is the
// panel.
//
// One sheet, top to bottom: "Work it out" with the order's question in small, the board (the sum laid out as on paper:
// the division bracket with the divisor outside, or the two numbers with × and the bar), the step's question in the
// biggest type on the sheet ("How many times does 5 go into 11?") with the place its answer goes marked on the board
// (a dashed box with a ?) and the digits it uses lit, four answers to tap (keys 1 to 4), and one line under them.
// A right answer goes on the board, and what follows from it is written in and said in that line ("2 goes on top.
// 2 × 5 = 10, under the 11. 11 − 10 = 1. Bring down the 2: 12."), then the next question comes up by itself. A wrong
// one shakes and goes dull, the line gives a one-line nudge for that slip, and a helper strip shows (the 5s up to 45
// with where 11 falls; for a times step, counting up in that number): pick again, nothing is lost. The strip also comes
// up by itself after a long think. The board never shows an answer before it is picked.
// The sum is on the board from the start: the sheet never asks which sum it is, it teaches it. After the board: the word
// answer from the story ("23 crates"), when the job asks it (final). Then the finished sum stays a moment and the sheet
// goes by itself.
// DECIMALS (src/math/longwork.js): a point is drawn at the corner of the digit in front of it, as on squared paper (the
// answer's in the kid's ink once it's placed), a $ in front of dollars, a 0 put on the end to line the points up in its
// own colour (brass). The step that puts the point back in a product rings the whole answer row (its digits stay in
// view); dividing by a decimal starts with the sum as given in big type over the empty board ("6 ÷ 0.5"), the four
// sums it's the same as to pick, then the board.
//
// SUMS IN STEPS (Work it out on a question answered with one coin that takes two sums or more: the bill, then the
// change): the sheet works each sum on a board of its own, in turn. A strip under the title lists them ("1  3 × $2.25",
// "2  $20.00 − ?": a number still to be found is a ?); each sum starts with what it finds, in plain words ("First the
// cost of 3 tins: 3 × $2.25"), its finished line stays a moment, and the next board comes up with the answer carried
// into it, written in green ("Then the change from $20: $20.00 − $6.75 (the $6.75 from sum 1)").
//
//   const L = openLongWork(root, { work, chain, final, title, ask, speak, closeLabel, top, onOwn, onTap, onDone, onClose })
//     work      src/math/longwork.js workMul / workDiv / workAdd / workSub (workOf)
//     chain     [{ work, sum, say, carried }] in place of work: sums in steps (src/math/jobsums.js: sum is the step as
//               the question puts it, say what it finds, carried: { a?: k, b?: k } its numbers that are sum k's answer)
//     top       true: over the lock box (z-index 70; the keys are the sheet's even with the box under it)
//     onOwn     () => void, or null: a small "Type my own sum" button in the top strip (the tools open their entry)
//     closeLabel   the close button's words ('Back to the slip'; the tools say 'Close')
//     free      true: no slip beside it (the tools in a field job): the sheet takes the middle of the screen
//     final     { ask, choices: [{ label, good, why }], line } or null: the word answer, after the board
//     ask       the order's question, small at the top; title: the sheet's name ('Work it out')
//     speak     (text) => void, or null: each question is said out loud (read-aloud for the youngest riders)
//     onTap({ part: 'work' | 'final', i, right, first, helped, fact, choice, timed: { ms, hidden, idle } })
//       (helped: the helper strip, which marks the answer, was up before this step's first tap: not a right first try)
//     onDone({ clean, taps, misses, ms, hidden, idle, final: the final choice's index or -1 })   the last step done
//     onClose()  closed without finishing ("Back to the slip" or Esc): nothing more is counted
//   L.el, L.close(), L.state() (for rigs: { part, i, ask, choices, busy, done, slot, w (the sum in steps being worked),
//   of, sums: [{ words, done }] })
// z-index 31: over the order slip (30), under the counters' panels (32), the times chart (35) and the lock box (60);
// opened over the lock box (top), 70.

import { answerTimer } from './answertimer.js';
import { sumWords } from '../math/longwork.js';

const CSS_HREF = new URL('./longwork.css', import.meta.url).href;
const FONTS_HREF = new URL('./fonts/fonts.css', import.meta.url).href;
// (the sheet's own stylesheet and fonts; the hand-typed sum's entry, src/ui/ownsum.js, uses them too)
export function ensureCss() {
  for (const [href, key] of [[FONTS_HREF, 'bmFonts'], [CSS_HREF, 'bmLong']]) {
    if (document.querySelector(`link[data-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`)) continue;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset[key] = '1'; document.head.appendChild(l);
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// the sheet on top (the last one opened that is still up: the entry to type a sum, opened over the store's own worked
// area, hears the keys, not the worked area under it)
export const topSheet = () => { const all = document.querySelectorAll('.bml:not(.is-out)'); return all.length ? all[all.length - 1] : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const LONGWORK = {
  nextMs: 1250,     // a right answer's line stays this long before the next question comes up
  doneMs: 1900,     // the finished sum stays this long before the sheet goes
  nextSumMs: 1700,  // sums in steps: a finished sum stays this long before the next one's board comes up
  helpMs: 10000,    // ms without a pick before the helper strip comes up by itself
  cellMost: 54,     // px: the biggest a board square gets (it shrinks to fit the sheet)
  cellLeast: 24,    // ...and the smallest
};

export function openLongWork(root = document.body, { work, chain = null, final = null, title = 'Work it out', ask = '', speak = null,
  closeLabel = 'Back to the slip', free = false, top = false, onOwn = null, onTap = () => {}, onDone = () => {}, onClose = () => {} } = {}) {
  ensureCss();
  // the sums worked here: one, or a sum in steps (each its own board, in turn)
  const works = chain && chain.length ? chain.map((x) => ({ ...x })) : [{ work, sum: null, say: '', carried: null }];
  const many = works.length > 1;
  // the parts in order: each sum's board steps, the word answer (optional)
  const parts = [];
  works.forEach((W, w) => W.work.steps.forEach((s, i) => parts.push({ part: 'work', w, i, ask: s.ask, choices: s.choices, step: s, wide: !!s.wide })));
  if (final) parts.push({ part: 'final', w: works.length - 1, i: 0, ask: final.ask, choices: final.choices, wide: true, line: final.line });

  const el = document.createElement('div');
  el.className = `bml${free ? ' is-free' : ''}${top ? ' is-top' : ''}${many ? ' is-chain' : ''}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', title);
  el.innerHTML = `<section class="bml-sheet">
      <header class="bml-top"><div class="bml-title"><b>${esc(title)}</b><small>${esc(ask)}</small></div>
        ${onOwn ? '<button type="button" class="bml-own">Type my own sum</button>' : ''}
        <button type="button" class="bml-x">${esc(closeLabel)}<kbd>Esc</kbd></button></header>
      ${many ? '<ol class="bml-chain" aria-label="The sums, in order"></ol>' : ''}
      <div class="bml-boardwrap"><div class="bml-board" aria-hidden="true"></div><p class="bml-note"></p></div>
      <p class="bml-ask" aria-live="polite"></p>
      <div class="bml-choices" role="group" aria-label="Pick the answer"></div>
      <p class="bml-line" aria-live="polite"></p>
      <div class="bml-help" hidden></div>
      <footer class="bml-foot"><span class="bml-count"></span><span class="bml-keys">keys 1 to 4 pick</span></footer>
    </section>`;
  root.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const boardEl = $('.bml-board'), askEl = $('.bml-ask'), choicesEl = $('.bml-choices'), lineEl = $('.bml-line'), helpEl = $('.bml-help');
  let wNow = 0, work_ = works[0].work, B = work_.board;

  let k = 0, busy = false, closed = false, finished = false, misses = 0, taps = 0, clean = true;
  const firstTried = new Set();
  const helpedAt = new Set();   // (the steps the helper strip was shown on before their first tap)
  const whole = answerTimer(), tap = answerTimer();
  let helpT = null, finalPick = -1;

  // ── THE STRIP OF SUMS (sums in steps): each as the question puts it, a number still to be found a ? ────────────────
  const chainEl = $('.bml-chain');
  const answerText = (W) => { const m = / = (.+)$/.exec(W.work.line || ''); return m ? m[1] : ''; };
  // a sum's words, a carried number a ? until the sum it comes from is done (done: how many sums are done)
  function sumText(w, done) {
    const W = works[w];
    if (!W.sum) return (W.work.line || '').split(' = ')[0];
    const words = sumWords(W.sum), c = W.carried || {}, m = / ([+−×÷]) /.exec(words);
    if (!m) return words;
    const left = c.a != null && c.a >= done ? '?' : words.slice(0, m.index), right = c.b != null && c.b >= done ? '?' : words.slice(m.index + 3);
    return `${left} ${m[1]} ${right}`;
  }
  function showChain(done = wNow) {
    if (!chainEl) return;
    chainEl.innerHTML = works.map((W, w) => `<li class="bml-ch${w < done ? ' is-done' : w === done ? ' is-now' : ''}"><i>${w + 1}</i><span>${esc(sumText(w, done))}</span>${w < done ? `<b>= ${esc(answerText(W))}</b>` : ''}</li>`).join('');
  }
  // the words a sum in steps starts with: what it finds, the sum, and where a carried number came from
  const ORD = ['First', 'Then', 'Then', 'Then', 'Then', 'Last'];
  function sumIntro(w) {
    const W = works[w], c = W.carried || {};
    const from = [...new Set([c.a, c.b].filter((x) => x != null))].map((x) => `the ${answerText(works[x])} from sum ${x + 1}`);
    return `${W.say || ORD[Math.min(w, ORD.length - 1)]}: ${sumText(w, w)}${from.length ? ` (${from.join(' and ')})` : ''}.`;
  }

  // ── THE BOARD ──────────────────────────────────────────────────────────────────────────────────────────────────
  // every cell and line of a sum's board is made once; showing a step only switches classes (so nothing jumps). A sum
  // in steps builds the next sum's board when it comes up.
  let cellEls = [], ruleEls = [], slotEl = null;
  function buildBoard(w) {
    wNow = w; work_ = works[w].work; B = work_.board;
    boardEl.innerHTML = '';
    cellEls = B.cells.map((c) => {
      const d = document.createElement('span');
      d.className = `bml-cell is-${c.kind}${c.tone ? ` is-${c.tone}` : ''}`;
      d.textContent = c.ch;
      d.style.setProperty('--r', c.r); d.style.setProperty('--c', c.c);
      boardEl.appendChild(d);
      return d;
    });
    ruleEls = B.rules.map((r) => {
      const d = document.createElement('span');
      d.className = `bml-rule is-${r.kind}`;
      d.style.setProperty('--r', r.r); d.style.setProperty('--c0', r.c0); d.style.setProperty('--n', r.c1 - r.c0 + 1);
      if (r.kind === 'bracket') d.innerHTML = '<svg viewBox="0 0 12 40" preserveAspectRatio="none" aria-hidden="true"><path d="M2 0 Q12 20 2 40" fill="none" stroke="currentColor" stroke-width="2.6" vector-effect="non-scaling-stroke"/></svg>';
      boardEl.appendChild(d);
      return d;
    });
    slotEl = document.createElement('span'); slotEl.className = 'bml-slot'; slotEl.textContent = '?'; boardEl.appendChild(slotEl);
    boardEl.style.setProperty('--rows', B.rows); boardEl.style.setProperty('--cols', B.cols);
    markCarried(w);
    fit();
  }
  // the numbers carried in from an earlier sum, in green on the board: the row (or the divisor) whose number they are
  function markCarried(w) {
    const c = works[w].carried;
    if (!c) return;
    const want = [c.a, c.b].map((x, i) => (x == null ? null : [works[w].sum.a, works[w].sum.b][i])).filter((v) => v != null);
    if (!want.length) return;
    const NUM = new Set(['given', 'pad', 'point', 'unit', 'divisor']), rows = new Map();
    B.cells.forEach((x, i) => {
      if (!NUM.has(x.kind) || x.from > work_.first) return;
      const key = `${x.r}|${x.kind === 'divisor' ? 'd' : 'n'}`;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(i);
    });
    const taken = new Set();
    for (const v of want) {
      for (const [key, idx] of rows) {
        if (taken.has(key)) continue;
        const cs = idx.map((i) => B.cells[i]).sort((p, q) => p.c - q.c || (p.kind === 'point') - (q.kind === 'point'));
        const text = cs.map((x) => (x.kind === 'point' ? '.' : /\d/.test(x.ch) ? x.ch : '')).join('');
        if (!text || Math.abs(Number(text) - v) > 1e-9) continue;
        taken.add(key);
        idx.forEach((i) => cellEls[i].classList.add('is-carried'));
        break;
      }
    }
  }

  // the board's step for part k: a work step -> its index, the final -> all done
  const boardStep = (kk) => { const p = parts[kk]; if (!p) return work_.steps.length; return p.part === 'work' ? p.i : work_.steps.length; };
  const MARK = new Set(['from', 'point', 'unit']);   // (cells that are marks, never lit: the tick, a point, the $)
  function showBoard(kk, { fresh = false, lit: light = true, at = null } = {}) {
    const s = at != null ? at : boardStep(kk);
    const visible = s >= work_.first;
    el.classList.toggle('is-blank', !visible);
    B.cells.forEach((c, i) => {
      const on = visible && s >= c.from, off = c.off != null && s >= c.off;
      const e = cellEls[i];
      const was = e.classList.contains('is-on');
      e.classList.toggle('is-on', on);
      e.classList.toggle('is-off', on && off);
      if (on && !was && fresh) { e.classList.remove('is-new'); void e.offsetWidth; e.classList.add('is-new'); }
    });
    B.rules.forEach((r, i) => { const e = ruleEls[i]; const was = e.classList.contains('is-on'); const on = visible && s >= r.from; e.classList.toggle('is-on', on); if (on && !was && fresh) { e.classList.remove('is-new'); void e.offsetWidth; e.classList.add('is-new'); } });
    const p = at != null ? null : parts[kk], st = p && p.part === 'work' ? p.step : null;
    // the digits this step uses, lit; the place its answer goes, marked
    const lit = new Set(st && light ? st.focus.map(([r, c]) => `${r},${c}`) : []);
    B.cells.forEach((c, i) => cellEls[i].classList.toggle('is-focus', lit.has(`${c.r},${c.c}`) && !MARK.has(c.kind) && cellEls[i].classList.contains('is-on')));
    if (st && st.slot && light) {
      slotEl.style.setProperty('--r', st.slot.r); slotEl.style.setProperty('--c', st.slot.c); slotEl.style.setProperty('--w', st.slot.w);
      slotEl.classList.toggle('is-ring', !!st.slot.ring);   // (the point's step: a ring round the answer, its digits in view)
      slotEl.classList.add('is-on');
    } else slotEl.classList.remove('is-on');
    // (the board not up yet, the sum as given in big type: dividing by a decimal before its points move)
    $('.bml-note').textContent = !visible && st && st.note ? st.note : '';
  }
  // the board's squares: as big as fits the sheet (on a phone, the sheet's width; on a window, a share of its height)
  function fit() {
    const wrap = $('.bml-boardwrap');
    const w = wrap.clientWidth - 8, h = Math.max(120, innerHeight * (innerWidth < 760 ? (many ? 0.32 : 0.36) : (many ? 0.38 : 0.42)));
    const cell = Math.max(LONGWORK.cellLeast, Math.min(LONGWORK.cellMost, Math.floor(w / B.cols), Math.floor(h / B.rows)));
    boardEl.style.setProperty('--cell', cell + 'px');
  }
  const onResize = () => fit();
  addEventListener('resize', onResize);

  // ── A STEP ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function showPart(fresh = false) {
    const p = parts[k];
    busy = false;
    showBoard(k, { fresh });
    const st = p.step;
    // (a sum in steps: its first step says what the sum finds, then the step's own words)
    const lead = many && p.part === 'work' && p.i === 0 ? sumIntro(p.w) : '';
    const intro = [lead, st && st.intro ? st.intro : ''].filter(Boolean).join(' ');
    askEl.innerHTML = (lead ? `<small class="bml-say">${esc(lead)}</small>` : '') + (st && st.intro ? `<small>${esc(st.intro)}</small>` : '') + esc(p.ask);
    choicesEl.classList.toggle('is-wide', !!p.wide);
    choicesEl.innerHTML = p.choices.map((c, i) => `<button type="button" class="bml-choice" data-i="${i}" aria-label="${esc(c.label)}"><b>${esc(c.label)}</b><kbd>${i + 1}</kbd></button>`).join('');
    $('.bml-keys').textContent = `keys 1 to ${p.choices.length} pick`;
    $('.bml-count').textContent = many && p.part === 'work' ? `Sum ${p.w + 1} of ${works.length} · step ${p.i + 1} of ${works[p.w].work.steps.length}` : `Step ${k + 1} of ${parts.length}`;
    helpEl.hidden = true; helpEl.innerHTML = '';
    clearTimeout(helpT);
    if (helperFor(p)) helpT = setTimeout(() => { if (!closed && !busy && parts[k] === p) showHelp(p, null); }, LONGWORK.helpMs);
    tap.lap();
    if (speak) { try { speak((intro ? intro + ' ' : '') + p.ask); } catch (e) { /* (no voice) */ } }
  }
  // the helper strip for a step: the divisor's multiples (where the number falls between them), or counting up in a
  // times step's number; the point's step counts the digits after the point. Never for the word answer (its help is
  // the nudge line).
  function helperFor(p) {
    const st = p && p.step;
    if (!st) return null;
    if (st.kind === 'div') {
      const m = /go into (\d+)/.exec(st.ask), cur = m ? +m[1] : 0, d = work_.d;
      const list = Array.from({ length: 10 }, (_, j) => j * d);
      const fit = Math.floor(cur / d), left = cur - fit * d, many = fit === 1 ? `one ${d} fits` : `${fit} ${d}s fit`;
      const note = fit === 0 ? `${cur} is less than ${d}: no ${d}s fit at all.`
        : left === 0 ? `${cur} is exactly ${fit} × ${d}, so ${many}, and nothing is left.`
        : `${cur} comes after ${fit * d} (${fit} × ${d}) and before ${(fit + 1) * d}, so ${many}, and ${left} is left.`;
      return { title: `The ${d}s`, items: list.map((v, j) => ({ top: `${j} × ${d}`, v, mark: v <= cur && (j === 9 || list[j + 1] > cur) })), note, cur };
    }
    if (st.kind === 'mul' || st.kind === 'carry' || st.kind === 'zero' || st.kind === 'lead') {
      const m = /(\d+) × (\d+)/.exec(st.ask); if (!m) return null;
      const b = +m[1], a = +m[2];
      return { title: `Counting up in ${b}s`, items: Array.from({ length: Math.max(1, Math.min(9, a)) }, (_, j) => ({ top: `${j + 1}`, v: b * (j + 1), mark: false })), note: st.kind === 'carry' ? 'Then add the number you carried.' : `${a} of them: the last one is ${b} × ${a}.` };
    }
    if (st.kind === 'sum') return { title: 'Adding the rows', items: [], note: 'Add the ones column first, then the tens, then the hundreds. When a column passes 9, carry the 1 to the next column.' };
    if (st.kind === 'point' && st.count) {   // (the digits after the point in each number, and in all: the answer gets that many)
      const all = st.count.reduce((a, x) => a + x.places, 0);
      return { title: 'Digits after the point', items: [...st.count.map((x) => ({ top: x.n, v: x.places, mark: false })), { top: 'in all', v: all, mark: true }],
        note: `Count ${all} digit${all === 1 ? '' : 's'} in from the right of the answer, and the point goes there.` };
    }
    if (st.kind === 'move') return { title: 'Moving the points', items: [], note: 'Times both numbers by 10 for each place the point moves: the sum gets bigger on both sides, and the answer stays the same.' };
    if (st.kind === 'add') {   // (counting on from the top digit: the strip shows the numbers after it)
      const m = /^(\d+)(?: \+ (\d+))?/.exec(st.ask), x = m ? +m[1] : 0, add = st.answer - x;
      return { title: `Counting on from ${x}`, items: Array.from({ length: Math.max(1, Math.min(10, add)) }, (_, j) => ({ top: `+${j + 1}`, v: x + j + 1, mark: false })), note: `${add} more after ${x}: the last one is the answer.` };
    }
    if (st.kind === 'sub') {   // (counting back from the top digit)
      const m = /^(\d+) − (\d+)/.exec(st.ask), x = m ? +m[1] : 0, y = m ? +m[2] : 0;
      return { title: `Counting back from ${x}`, items: Array.from({ length: Math.max(1, Math.min(10, y)) }, (_, j) => ({ top: `−${j + 1}`, v: x - j - 1, mark: false })), note: `${y} back from ${x}: the last one is the answer.` };
    }
    return null;
  }
  function showHelp(p, why) {
    const h = helperFor(p);
    let html = '';
    if (h) {
      html += `<b class="bml-helpt">${esc(h.title)}</b>`;
      if (h.items.length) html += `<div class="bml-strip">${h.items.map((x) => `<span class="${x.mark ? 'is-mark' : ''}"><small>${esc(x.top)}</small>${x.v}</span>`).join('')}</div>`;
      if (h.note && (why || p.step.kind !== 'div')) html += `<p>${esc(h.note)}</p>`;
    }
    if (!html) return;
    // (the strip marks the answer's multiple, or ends on it: a tap after it is helped, not a right first try)
    if (h && h.items.length) helpedAt.add(k);
    helpEl.innerHTML = html; helpEl.hidden = false;
    helpEl.classList.remove('is-pop'); void helpEl.offsetWidth; helpEl.classList.add('is-pop');
  }

  async function pick(i) {
    if (busy || closed || finished) return;
    const p = parts[k], c = p.choices[i]; if (!c) return;
    const b = choicesEl.querySelector(`[data-i="${i}"]`);
    if (!b || b.disabled) return;
    const first = !firstTried.has(k), helped = helpedAt.has(k);
    firstTried.add(k);
    taps++;
    if (first && helped) clean = false;   // (worked with the strip's help: the sum isn't clean)
    const timed = tap.lap();
    try { onTap({ part: p.part, i: p.i, right: !!c.good, first, helped, fact: p.step ? p.step.fact : null, choice: i, timed }); } catch (e) { console.error(e); }
    if (!c.good) {
      misses++; clean = false;
      b.classList.remove('is-shake'); void b.offsetWidth; b.classList.add('is-shake', 'is-wrong'); b.disabled = true;
      lineEl.className = 'bml-line is-why';
      lineEl.textContent = c.why || 'Not that one. Look again.';
      showHelp(p, c.why);
      return;
    }
    busy = true;
    clearTimeout(helpT);
    for (const x of choicesEl.querySelectorAll('.bml-choice')) { x.disabled = true; if (x !== b) x.classList.add('is-fade'); }
    b.classList.add('is-right');
    if (p.part === 'final') finalPick = i;
    const st = p.step;
    lineEl.className = 'bml-line is-done';
    lineEl.textContent = p.part === 'final' ? (p.line || c.label) : st.done;
    helpEl.hidden = true;
    // the answer goes on the board (the next step's view shows it)
    if (k + 1 < parts.length && parts[k + 1].w !== p.w) {
      // a sum in steps: this sum is done. Its finished board and line stay a moment, its answer goes on the strip, then
      // the next sum's board comes up with that answer carried into it
      showBoard(k, { fresh: true, lit: false, at: work_.steps.length });
      await sleep(LONGWORK.nextMs + Math.min(900, lineEl.textContent.length * 9));
      if (closed) return;
      showChain(p.w + 1);
      lineEl.className = 'bml-line is-done is-sum';
      lineEl.textContent = `Sum ${p.w + 1} done: ${work_.line}.`;
      $('.bml-count').textContent = `Sum ${p.w + 1} of ${works.length} done`;
      await sleep(LONGWORK.nextSumMs);
      if (closed) return;
      k++;
      buildBoard(parts[k].w);
      showChain();
      lineEl.className = 'bml-line'; lineEl.textContent = '';
      showPart(true);
      return;
    }
    if (k + 1 < parts.length) {
      showBoard(k + 1, { fresh: true, lit: false });   // (the answer goes on; the next step's digits light when it is asked)
      await sleep(LONGWORK.nextMs + Math.min(900, lineEl.textContent.length * 9));
      if (closed) return;
      k++;
      lineEl.className = 'bml-line'; lineEl.textContent = '';
      showPart(true);
      return;
    }
    // the last step: the finished sum stays a moment, then the sheet goes
    finished = true;
    showBoard(parts.length, { fresh: true, lit: false });
    showChain(works.length);
    el.classList.add('is-finished');
    $('.bml-count').textContent = work_.line;
    const t = whole.stop();
    try { onDone({ clean, taps, misses, ms: t.ms, hidden: t.hidden, idle: t.idle, final: finalPick }); } catch (e) { console.error(e); }
    await sleep(LONGWORK.doneMs);
    close(false);
  }

  choicesEl.addEventListener('click', (e) => { const b = e.target.closest('.bml-choice'); if (b) pick(Number(b.dataset.i)); });
  $('.bml-x').addEventListener('click', () => close(true));
  if (onOwn) $('.bml-own').addEventListener('click', (e) => { e.currentTarget.blur(); if (!closed && !finished) { try { onOwn(); } catch (err) { console.error(err); } } });
  const onKey = (e) => {
    if (closed || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!top && document.querySelector('.bms, .lbx')) return;   // (a counter's panel or the lock box is over it; opened over the box, the keys are the sheet's)
    if (topSheet() !== el) return;   // (another sheet over this one, the entry to type a sum: its keys)
    // (the tools' sheet, in the middle of the screen or over the box: no key reaches what is under it, a builder's
    // walk-away keys included)
    if (free || top) e.stopPropagation();
    if (e.repeat) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!finished) close(true); return; }
    const m = /^Digit([1-9])$/.exec(e.code) || /^Numpad([1-9])$/.exec(e.code);
    if (!m) return;
    e.preventDefault(); e.stopPropagation();
    pick(Number(m[1]) - 1);
  };
  addEventListener('keydown', onKey, true);

  function close(byKid) {
    if (closed) return;
    closed = true;
    clearTimeout(helpT);
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', onResize);
    whole.cancel(); tap.cancel();
    el.classList.remove('is-in'); el.classList.add('is-out');
    setTimeout(() => el.remove(), 260);
    if (byKid && !finished) { try { onClose(); } catch (e) { console.error(e); } }
  }

  buildBoard(0);
  showChain();
  showPart(false);
  requestAnimationFrame(() => { fit(); el.classList.add('is-in'); });
  return {
    el,
    close: () => close(false),
    state: () => {
      const p = parts[k];
      return { part: p.part, i: p.i, k, of: parts.length, ask: p.ask, choices: p.choices.map((c) => ({ label: c.label, good: !!c.good })), busy, done: finished, closed,
        slot: p.step && p.step.slot ? p.step.slot : null, line: lineEl.textContent, misses, taps,
        w: wNow, sums: works.map((W, w) => ({ words: sumText(w, finished ? works.length : wNow), line: W.work.line, say: W.say || '' })), intro: (askEl.querySelector('small') || {}).textContent || '' };
    },
  };
}
