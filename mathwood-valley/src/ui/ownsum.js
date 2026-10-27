// TYPE YOUR OWN SUM: Work it out's entry for a sum typed by hand (src/ui/tools.js), when there is no question on screen,
// or it has no sum for the columns (a clock to read, a series, a move to pick), or the kid wants a different one ("Type
// my own sum" on the worked sheet). The same sheet of paper as the worked area (src/ui/longwork.css):
//   the first number, the sign (+ − × ÷), the second number, each a big box to tap; a pad of digits with a point, a $
//   and a key to rub out; one friendly line; and "Work it out", which runs the same guided columns on it.
// The box being typed in is lit; picking a sign moves on to the second number. Whole numbers and decimals, up to 6
// digits before the point and 2 after (src/math/jobsums.js OWN); dollars with the $. What the columns can't do gets a
// plain line instead of a sum: a bigger number taken from a smaller ("The bigger number goes on top", and a button to
// swap them), dividing by 0.
// The keyboard does it all too: digits, the point, $, Backspace (Delete empties the box), + - * x / for the sign, Tab
// or the arrows to the other box, Enter to work it out, Esc to close.
//
//   const E = openOwnSum(root, { start, why, free, top, speak, onWork(sum), onClose() })
//     start   { a, op, b } as typed ('20', 'sub', '6.75'), or null (all empty, the first box lit)
//     why     a line to show at the start, or ''
//     free    true: no slip beside it (the middle of the screen, over a light shade); top: over the lock box
//     onWork(sum)   "Work it out" with a sum the columns can do (src/math/jobsums.js ownSum)
//     onClose()     closed without working one (Close, Esc)
//   E.el, E.kind ('own'), E.close() (quietly: no onClose), E.state() (for rigs: { a, op, b, at, why }), E.type(text)
//   (for rigs: each character as a key would be)
// z-index as the worked area's (31; over the lock box, 70).

import { ensureCss, topSheet } from './longwork.js';
import { ownSum, ownNumber, OWN } from '../math/jobsums.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SIGN = { add: '+', sub: '−', mul: '×', div: '÷' };
const KEY_SIGN = { '+': 'add', '-': 'sub', '−': 'sub', '*': 'mul', 'x': 'mul', 'X': 'mul', '×': 'mul', '/': 'div', '÷': 'div' };
const PAD = ['7', '8', '9', 'back', '4', '5', '6', '$', '1', '2', '3', '.', '0', 'clear'];
const BACK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m12 9 5 6m0-6-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export function openOwnSum(root = document.body, { start = null, why = '', free = true, top = false, speak = null, onWork = () => {}, onClose = () => {} } = {}) {
  ensureCss();
  const v = { a: String(start && start.a != null ? start.a : ''), b: String(start && start.b != null ? start.b : '') };
  let op = start && SIGN[start.op] ? start.op : null, at = v.a && op ? 'b' : 'a', closed = false, swap = false;

  const el = document.createElement('div');
  el.className = `bml bmn${free ? ' is-free' : ''}${top ? ' is-top' : ''}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Type your own sum');
  el.innerHTML = `<section class="bml-sheet bmn-sheet">
      <header class="bml-top"><div class="bml-title"><b>Type your own sum</b><small>Any sum you like, worked in columns</small></div>
        <button type="button" class="bml-x">Close<kbd>Esc</kbd></button></header>
      <div class="bmn-sum">
        <button type="button" class="bmn-num" data-at="a" aria-label="The first number"><small>First number</small><span class="bmn-v"></span></button>
        <div class="bmn-signs" role="group" aria-label="The sign">${Object.entries(SIGN).map(([k, s]) => `<button type="button" class="bmn-sign" data-op="${k}" aria-label="${{ add: 'plus', sub: 'take away', mul: 'times', div: 'divided by' }[k]}">${s}</button>`).join('')}</div>
        <button type="button" class="bmn-num" data-at="b" aria-label="The second number"><small>Second number</small><span class="bmn-v"></span></button>
      </div>
      <div class="bmn-pad" role="group" aria-label="Digits">${PAD.map((k) => `<button type="button" class="bmn-key${k.length > 1 || k === '$' || k === '.' ? ' is-tool' : ''}${k === '0' ? ' is-zero' : ''}${k === 'clear' ? ' is-clear' : ''}" data-k="${k}" aria-label="${{ back: 'Rub out', clear: 'Empty the box', $: 'Dollars', '.': 'Point' }[k] || k}">${k === 'back' ? BACK_SVG : k === 'clear' ? 'Empty' : k}</button>`).join('')}</div>
      <p class="bmn-why" aria-live="polite"></p>
      <div class="bmn-go-row"><button type="button" class="bmn-swap" hidden>Swap them</button><button type="button" class="bmn-go">Work it out</button></div>
      <footer class="bml-foot"><span>Up to ${OWN.digits} digits, and ${OWN.places} after a point</span><span class="bml-keys">type digits and + − × ÷, Enter works it out</span></footer>
    </section>`;
  root.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const whyEl = $('.bmn-why'), swapBtn = $('.bmn-swap');
  const boxes = { a: $('.bmn-num[data-at="a"]'), b: $('.bmn-num[data-at="b"]') };

  function say(text, warn = true) {
    whyEl.textContent = text || '';
    whyEl.classList.toggle('is-warn', !!text && warn);
    if (text && warn) { whyEl.classList.remove('is-pop'); void whyEl.offsetWidth; whyEl.classList.add('is-pop'); }
  }
  function draw() {
    for (const k of ['a', 'b']) {
      const t = v[k];
      boxes[k].querySelector('.bmn-v').textContent = t || '';
      boxes[k].classList.toggle('is-on', at === k);
      boxes[k].classList.toggle('is-empty', !t);
    }
    el.querySelectorAll('.bmn-sign').forEach((b) => b.classList.toggle('is-on', b.dataset.op === op));
    swapBtn.hidden = !swap;
  }
  function flash(where) {
    const e = where === 'op' ? $('.bmn-signs') : boxes[where];
    if (!e) return;
    e.classList.remove('is-shake'); void e.offsetWidth; e.classList.add('is-shake');
  }
  // one key, from the pad or the keyboard
  function key(k) {
    if (closed) return;
    swap = false;
    const t = v[at];
    if (/^\d$/.test(k) || k === '.') {
      // (a point with nothing before it gets its 0: .5 is written 0.5; no 0 in front of a whole number: 05 is 5)
      let next = k === '.' ? (t.includes('.') ? null : t.replace('$', '') ? `${t}.` : `${t}0.`) : /^\$?0$/.test(t) ? t.slice(0, -1) + k : t + k;
      if (next == null) { say('A number has one point at most.'); draw(); return; }
      const n = ownNumber(next);
      if (n.why) { say(n.why); flash(at); draw(); return; }
      v[at] = next;
      say('');
    } else if (k === '$') {
      v[at] = t.startsWith('$') ? t.slice(1) : `$${t}`;
      say('');
    } else if (k === 'back') {
      v[at] = t.slice(0, -1);
      if (v[at] === '$') v[at] = '';
      say('');
    } else if (k === 'clear') {
      v[at] = '';
      say('');
    }
    draw();
  }
  function sign(o) {
    if (closed || !SIGN[o]) return;
    op = o; swap = false;
    if (at === 'a' && v.a) at = 'b';
    say('');
    draw();
  }
  function go() {
    if (closed) return;
    const r = ownSum(v.a, op, v.b);
    if (r.sum) { onWork(r.sum); return; }
    swap = !!r.swap;
    if (r.at === 'a' || r.at === 'b') at = r.at;
    say(r.why);
    flash(r.at);
    draw();
  }

  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  boxes.a.addEventListener('click', () => { at = 'a'; draw(); });
  boxes.b.addEventListener('click', () => { at = 'b'; draw(); });
  el.querySelectorAll('.bmn-sign').forEach((b) => b.addEventListener('click', (e) => { e.currentTarget.blur(); sign(b.dataset.op); }));
  el.querySelectorAll('.bmn-key').forEach((b) => b.addEventListener('click', (e) => { e.currentTarget.blur(); key(b.dataset.k); }));
  $('.bmn-go').addEventListener('click', (e) => { e.currentTarget.blur(); go(); });
  swapBtn.addEventListener('click', () => { [v.a, v.b] = [v.b, v.a]; swap = false; say(''); draw(); });
  $('.bml-x').addEventListener('click', () => close(true));
  const onKey = (e) => {
    if (closed || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!top && document.querySelector('.bms, .lbx')) return;   // (a counter's panel or the lock box is over it)
    if (topSheet() !== el) return;   // (a sheet over the entry hears the keys)
    e.stopPropagation();   // (no key reaches what is under the entry: the job, a builder's walk-away keys)
    const k = e.key;
    let used = true;
    if (k === 'Escape') close(true);
    else if (k === 'Enter' || k === '=') go();
    else if (/^\d$/.test(k) || k === '.' || k === '$') key(k);
    else if (k === 'Backspace') key('back');
    else if (k === 'Delete') key('clear');
    else if (KEY_SIGN[k]) sign(KEY_SIGN[k]);
    else if (k === 'Tab' || k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') { at = at === 'a' ? 'b' : 'a'; draw(); }
    else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  };
  addEventListener('keydown', onKey, true);

  function close(byKid) {
    if (closed) return;
    closed = true;
    removeEventListener('keydown', onKey, true);
    el.classList.remove('is-in'); el.classList.add('is-out');
    setTimeout(() => el.remove(), 260);
    if (byKid) { try { onClose(); } catch (e) { console.error(e); } }
  }

  draw();
  if (why) say(why, false);
  requestAnimationFrame(() => el.classList.add('is-in'));
  if (speak) { try { speak('Type your own sum: the first number, a sign, then the second number.'); } catch (e) { /* (no voice) */ } }
  return {
    el, kind: 'own',
    close: () => close(false),
    type: (text) => { for (const ch of String(text)) { if (KEY_SIGN[ch] && ch !== 'x' && ch !== 'X') sign(KEY_SIGN[ch]); else if (ch === '\n') go(); else if (ch !== ' ') key(ch); } },
    state: () => ({ own: true, a: v.a, op, b: v.b, at, why: whyEl.textContent, swap, closed }),
  };
}
