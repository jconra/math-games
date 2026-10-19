// THE WORKED AREA: long multiplication and long division worked out a step at a time on a sheet of paper, opened from a
// store order or a supply slip whose sum is too big to do in your head (16 × 7 hands-days, 112 ÷ 5 crates). The math
// and the slips are src/math/longwork.js; this is the panel.
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
// Before the board: what to work out, from the story ("112 ÷ 5", "8 × 2 × 7"), when the job asks it (setup). After it:
// the word answer from the story ("23 crates"), when the job asks it (final). Then the finished sum stays a moment
// and the sheet goes by itself.
//
//   const L = openLongWork(root, { work, setup, final, title, ask, speak, onTap, onDone, onClose })
//     work      src/math/longwork.js workMul / workDiv
//     setup     { ask, choices: [{ label, good, why }] } or null    final: { ask, choices, line } or null
//     ask       the order's question, small at the top; title: the sheet's name ('Work it out')
//     speak     (text) => void, or null: each question is said out loud (read-aloud for the youngest riders)
//     onTap({ part: 'setup' | 'work' | 'final', i, right, first, helped, fact, choice, timed: { ms, hidden, idle } })
//       (helped: the helper strip, which marks the answer, was up before this step's first tap: not a right first try)
//     onDone({ clean, taps, misses, ms, hidden, idle, final: the final choice's index or -1 })   the last step done
//     onClose()  closed without finishing ("Back to the slip" or Esc): nothing more is counted
//   L.el, L.close(), L.state() (for rigs: { part, i, ask, choices, busy, done, slot })
// z-index 31: over the order slip (30), under the counters' panels (32), the times chart (35) and the lock box (60).

import { answerTimer } from './answertimer.js';

const CSS_HREF = new URL('./longwork.css', import.meta.url).href;
const FONTS_HREF = new URL('./fonts/fonts.css', import.meta.url).href;
function ensureCss() {
  for (const [href, key] of [[FONTS_HREF, 'bmFonts'], [CSS_HREF, 'bmLong']]) {
    if (document.querySelector(`link[data-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`)) continue;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset[key] = '1'; document.head.appendChild(l);
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const LONGWORK = {
  nextMs: 1250,     // a right answer's line stays this long before the next question comes up
  doneMs: 1900,     // the finished sum stays this long before the sheet goes
  helpMs: 10000,    // ms without a pick before the helper strip comes up by itself
  cellMost: 54,     // px: the biggest a board square gets (it shrinks to fit the sheet)
  cellLeast: 24,    // ...and the smallest
};

export function openLongWork(root = document.body, { work, setup = null, final = null, title = 'Work it out', ask = '', speak = null,
  onTap = () => {}, onDone = () => {}, onClose = () => {} } = {}) {
  ensureCss();
  // the parts in order: the setup (optional), the board's steps, the word answer (optional)
  const parts = [];
  if (setup) parts.push({ part: 'setup', i: 0, ask: setup.ask, choices: setup.choices, wide: true });
  work.steps.forEach((s, i) => parts.push({ part: 'work', i, ask: s.ask, choices: s.choices, step: s, wide: false }));
  if (final) parts.push({ part: 'final', i: 0, ask: final.ask, choices: final.choices, wide: true, line: final.line });

  const el = document.createElement('div');
  el.className = 'bml';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', title);
  el.innerHTML = `<section class="bml-sheet">
      <header class="bml-top"><div class="bml-title"><b>${esc(title)}</b><small>${esc(ask)}</small></div>
        <button type="button" class="bml-x">Back to the slip<kbd>Esc</kbd></button></header>
      <div class="bml-boardwrap"><div class="bml-board" aria-hidden="true"></div><p class="bml-setupnote"></p></div>
      <p class="bml-ask" aria-live="polite"></p>
      <div class="bml-choices" role="group" aria-label="Pick the answer"></div>
      <p class="bml-line" aria-live="polite"></p>
      <div class="bml-help" hidden></div>
      <footer class="bml-foot"><span class="bml-count"></span><span class="bml-keys">keys 1 to 4 pick</span></footer>
    </section>`;
  root.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const boardEl = $('.bml-board'), askEl = $('.bml-ask'), choicesEl = $('.bml-choices'), lineEl = $('.bml-line'), helpEl = $('.bml-help');
  const B = work.board;

  let k = 0, busy = false, closed = false, finished = false, misses = 0, taps = 0, clean = true;
  const firstTried = new Set();
  const helpedAt = new Set();   // (the steps the helper strip was shown on before their first tap)
  const whole = answerTimer(), tap = answerTimer();
  let helpT = null, finalPick = -1;

  // ── THE BOARD ──────────────────────────────────────────────────────────────────────────────────────────────────
  // every cell and line is made once; showing a step only switches classes (so nothing jumps)
  const cellEls = B.cells.map((c) => {
    const d = document.createElement('span');
    d.className = `bml-cell is-${c.kind}`;
    d.textContent = c.ch;
    d.style.setProperty('--r', c.r); d.style.setProperty('--c', c.c);
    boardEl.appendChild(d);
    return d;
  });
  const ruleEls = B.rules.map((r) => {
    const d = document.createElement('span');
    d.className = `bml-rule is-${r.kind}`;
    d.style.setProperty('--r', r.r); d.style.setProperty('--c0', r.c0); d.style.setProperty('--n', r.c1 - r.c0 + 1);
    if (r.kind === 'bracket') d.innerHTML = '<svg viewBox="0 0 12 40" preserveAspectRatio="none" aria-hidden="true"><path d="M2 0 Q12 20 2 40" fill="none" stroke="currentColor" stroke-width="2.6" vector-effect="non-scaling-stroke"/></svg>';
    boardEl.appendChild(d);
    return d;
  });
  const slotEl = document.createElement('span'); slotEl.className = 'bml-slot'; slotEl.textContent = '?'; boardEl.appendChild(slotEl);
  boardEl.style.setProperty('--rows', B.rows); boardEl.style.setProperty('--cols', B.cols);

  // the board's step for part k: setup -> -1 (nothing shown yet), a work step -> its index, the final -> all done
  const boardStep = (kk) => { const p = parts[kk]; if (!p) return work.steps.length; return p.part === 'setup' ? -1 : p.part === 'work' ? p.i : work.steps.length; };
  function showBoard(kk, { fresh = false, lit: light = true } = {}) {
    const s = boardStep(kk);
    const visible = s >= work.first;
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
    const p = parts[kk], st = p && p.part === 'work' ? p.step : null;
    // the digits this step uses, lit; the place its answer goes, marked
    const lit = new Set(st && light ? st.focus.map(([r, c]) => `${r},${c}`) : []);
    B.cells.forEach((c, i) => cellEls[i].classList.toggle('is-focus', lit.has(`${c.r},${c.c}`) && c.kind !== 'from' && cellEls[i].classList.contains('is-on')));
    B.cells.forEach((c, i) => { if (c.kind === 'from') cellEls[i].classList.toggle('is-focus', false); });
    if (st && st.slot && light) {
      slotEl.style.setProperty('--r', st.slot.r); slotEl.style.setProperty('--c', st.slot.c); slotEl.style.setProperty('--w', st.slot.w);
      slotEl.classList.add('is-on');
    } else slotEl.classList.remove('is-on');
  }
  // the board's squares: as big as fits the sheet (on a phone, the sheet's width; on a window, a share of its height)
  function fit() {
    const wrap = $('.bml-boardwrap');
    const w = wrap.clientWidth - 8, h = Math.max(120, innerHeight * (innerWidth < 760 ? 0.36 : 0.42));
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
    $('.bml-setupnote').textContent = p.part === 'setup' ? 'The sum goes here once you pick it.' : '';
    askEl.innerHTML = (st && st.intro ? `<small>${esc(st.intro)}</small>` : '') + esc(p.ask);
    choicesEl.classList.toggle('is-wide', !!p.wide);
    choicesEl.innerHTML = p.choices.map((c, i) => `<button type="button" class="bml-choice" data-i="${i}" aria-label="${esc(c.label)}"><b>${esc(c.label)}</b><kbd>${i + 1}</kbd></button>`).join('');
    $('.bml-keys').textContent = `keys 1 to ${p.choices.length} pick`;
    $('.bml-count').textContent = `Step ${k + 1} of ${parts.length}`;
    helpEl.hidden = true; helpEl.innerHTML = '';
    clearTimeout(helpT);
    if (helperFor(p)) helpT = setTimeout(() => { if (!closed && !busy && parts[k] === p) showHelp(p, null); }, LONGWORK.helpMs);
    tap.lap();
    if (speak) { try { speak(((st && st.intro) ? st.intro + ' ' : '') + p.ask); } catch (e) { /* (no voice) */ } }
  }
  // the helper strip for a step: the divisor's multiples (where the number falls between them), or counting up in a
  // times step's number. Never for the setup or the word answer (their help is the nudge line).
  function helperFor(p) {
    const st = p && p.step;
    if (!st) return null;
    if (st.kind === 'div') {
      const m = /go into (\d+)/.exec(st.ask), cur = m ? +m[1] : 0, d = work.d;
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
    lineEl.textContent = p.part === 'setup' ? `${c.label}: let's work it out.` : p.part === 'final' ? (p.line || c.label) : st.done;
    helpEl.hidden = true;
    // the answer goes on the board (the next step's view shows it)
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
    el.classList.add('is-finished');
    $('.bml-count').textContent = work.line;
    const t = whole.stop();
    try { onDone({ clean, taps, misses, ms: t.ms, hidden: t.hidden, idle: t.idle, final: finalPick }); } catch (e) { console.error(e); }
    await sleep(LONGWORK.doneMs);
    close(false);
  }

  choicesEl.addEventListener('click', (e) => { const b = e.target.closest('.bml-choice'); if (b) pick(Number(b.dataset.i)); });
  $('.bml-x').addEventListener('click', () => close(true));
  const onKey = (e) => {
    if (closed || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.bms, .lbx')) return;   // (a counter's panel or the lock box is over it)
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

  fit();
  showPart(false);
  requestAnimationFrame(() => { fit(); el.classList.add('is-in'); });
  return {
    el,
    close: () => close(false),
    state: () => {
      const p = parts[k];
      return { part: p.part, i: p.i, k, of: parts.length, ask: p.ask, choices: p.choices.map((c) => ({ label: c.label, good: !!c.good })), busy, done: finished, closed,
        slot: p.step && p.step.slot ? p.step.slot : null, line: lineEl.textContent, misses, taps };
    },
  };
}
