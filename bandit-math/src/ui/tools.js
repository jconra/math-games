// THE TOOLS: one button in the HUD's corner (by the Menu button), from any job, with the two tools the agreed design asks
// for (2026-10-21):
//   WORK IT OUT   the sum on the question in front of the kid, worked in columns on paper (src/ui/longwork.js): adding
//                 and taking away a column at a time (the board carries and borrows by itself), long multiplication and
//                 long division, one highlighted spot at a time with 4 choices. The numbers come from the question:
//                 the job says what its sum is (the store and the deliveries: their order's own sum, which counts as
//                 their worked area always has), or the sum is read off the job's card ("7 × 8 = ?", "83 − 33"). On a
//                 story (the store's word problems) it first asks "What do we work out?", so reading the story is still
//                 the kid's. A question with no sum on it (a clock to read, a series to finish) says so on the button.
//   THE TIMES CHART   12 x 12, every fact the rider has answered anywhere coloured: green answered right, red missed
//                 (src/math/facts.js chart: red ones come back soon); src/ui/timeschart.js draws it.
// Work it out from a field job's card is help only: nothing is counted (the job's own answer still is). The game waits
// while a tool is open (onOpen / onClose: main.js pauses), and Esc or the close button puts it away.
//
//   const T = makeTools({ hud, rider, sum, own, speak, onOpen, onClose })
//     hud     the HUD (src/ui/hud.js): the button goes in its top-right corner, by Menu
//     rider() the rider now; sum() -> the question's sum now: { op: 'add' | 'sub' | 'mul' | 'div', a, b, ask, setup,
//             own } or null (main.js asks the job at work, else reads the HUD's card with longwork.js sumFrom)
//     own(sum)  opens a job's own worked area for a sum with own: true (the store's or the deliveries' order)
//     canOpen() false while the tools can't open (the title, the menu or a lock box is up)
//     speak(text) | null   read-aloud for a rider who is read to
//   T.el (the button), T.open(anchor) (the little menu; anchor: another button it opens from, the lock box's own, whose
//   panel the menu, the sheet and the chart then go over), T.work(), T.chart(), T.close(), T.busy() (a tool is up),
//   T.state() (for rigs), T.dispose()
// z-index: the menu 34 (over the order slip 30, the worked area 31 and the completion page 33; under the times chart's
// button 35 and the chart 40).

import { workOf, needsLong } from '../math/longwork.js';
import { chart as factChart } from '../math/facts.js';
import { openLongWork } from './longwork.js';
import { showChart, closeChart, isChartOpen, markCount, ensureChartCss } from './timeschart.js';

const CSS_HREF = new URL('./tools.css', import.meta.url).href;
function ensureCss() {
  if (typeof document === 'undefined' || document.querySelector('link[data-bm-tools]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS_HREF; l.dataset.bmTools = '1'; document.head.appendChild(l);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SIGN = { add: '+', sub: '−', mul: '×', div: '÷' };
export const ICON_TOOLS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 17.8 15.6 5.7l2.7 2.7L6.2 20.5H3.5z" fill="currentColor"/><path d="m16.6 4.7 1.5-1.5a1.3 1.3 0 0 1 1.8 0l.9.9a1.3 1.3 0 0 1 0 1.8l-1.5 1.5z" fill="currentColor" opacity="0.75"/><path d="M13 21h8M17 18.5V21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

// "What do we work out?" for a sum read off a story: the right sum and the same two numbers with the other three signs
export function setupFor(sum) {
  const { op, a, b } = sum;
  const why = {
    add: 'Adding puts them together. Picture the story again: is it putting together?',
    sub: 'Taking away finds what is left, or how many more. Picture the story again.',
    mul: 'Times is so many lots of the same. Picture the story again: are there equal lots?',
    div: 'Dividing shares out, or finds how many lots fit. Picture the story again.',
  };
  const label = (o) => (o === 'sub' && a < b) || (o === 'div' && b === 0) ? null : `${a} ${SIGN[o]} ${b}`;
  const choices = ['add', 'sub', 'mul', 'div'].map((o) => ({ o, label: label(o) })).filter((c) => c.label)
    .map((c) => ({ label: c.label, good: c.o === op, why: c.o === op ? '' : why[c.o] }));
  return { ask: 'What do we work out?', choices };
}
// the words on the Work it out button for a sum (a story's sum is not given away: "the sum on this order")
export function sumLabel(sum) {
  if (!sum) return 'Nothing to work out on paper here';
  if (sum.setup || sum.own) return 'The sum on this question';
  return `${sum.a} ${SIGN[sum.op] || '?'} ${sum.b}`;
}

export function makeTools({ hud, rider = () => null, sum = () => null, own = () => false, canOpen = () => true, speak = null, onOpen = () => {}, onClose = () => {} } = {}) {
  ensureCss(); ensureChartCss();
  const corner = hud && hud.el ? hud.el.querySelector('.bmh-corner') : null;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'bmtl-btn'; btn.title = 'Tools: Work it out, the times chart';
  btn.innerHTML = `${ICON_TOOLS}<span>Tools</span>`;
  if (corner) corner.appendChild(btn); else { btn.classList.add('is-loose'); document.body.appendChild(btn); }
  let menu = null, panel = null, chartOn = false, held = false, menuSum = null;
  const T = { el: btn };

  function hold(on) {
    if (!on && typeof document !== 'undefined') document.body.classList.remove('bmtl-over');
    if (on === held) return;
    held = on;
    try { (on ? onOpen : onClose)(); } catch (e) { console.error(e); }
  }

  // ── THE LITTLE MENU ────────────────────────────────────────────────────────────────────────────────────────────
  function closeMenu() {
    if (!menu) return;
    removeEventListener('keydown', onKey, true);
    removeEventListener('pointerdown', onDown, true);
    menu.remove(); menu = null;
    btn.classList.remove('is-on');
  }
  const onKey = (e) => {
    if (!menu) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); hold(false); return; }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '1') { e.preventDefault(); e.stopPropagation(); T.work(); }
    else if (e.key === '2') { e.preventDefault(); e.stopPropagation(); T.chart(); }
  };
  let anchorEl = null;
  const onDown = (e) => { if (menu && !menu.contains(e.target) && !btn.contains(e.target) && !(anchorEl && anchorEl.contains(e.target))) { closeMenu(); hold(false); } };
  T.open = (anchor = null) => {
    if (menu) { closeMenu(); hold(false); return; }
    if (panel || chartOn || !canOpen()) return;
    // (from a button over a panel, the lock box's own: the menu, the sheet and the chart go over that panel)
    const at = anchor && anchor.getBoundingClientRect ? anchor : btn;
    if (at !== btn) document.body.classList.add('bmtl-over');
    anchorEl = at === btn ? null : at;
    const s = menuSum = safeSum();   // (read now, before the game waits: a paused game has no question up)
    const r = rider(), n = markCount(r ? factChart(r) : null);
    menu = document.createElement('div');
    menu.className = 'bmtl-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `<b class="bmtl-head">Tools</b>
      <button type="button" class="bmtl-item" data-tool="work" role="menuitem"${s ? '' : ' disabled'}>
        <span class="bmtl-ic">${SVG_WORK}</span><span class="bmtl-t"><b>Work it out</b><small>${esc(sumLabel(s))}</small></span><kbd>1</kbd></button>
      <button type="button" class="bmtl-item" data-tool="chart" role="menuitem">
        <span class="bmtl-ic">${SVG_CHART}</span><span class="bmtl-t"><b>Times chart</b><small>${n.green || n.red ? `${n.green} green · ${n.red} red` : 'Your facts turn green and red'}</small></span><kbd>2</kbd></button>`;
    document.body.appendChild(menu);
    const b = at.getBoundingClientRect();
    menu.style.top = `${Math.round(b.bottom + 8)}px`;
    menu.style.right = `${Math.max(8, Math.round(innerWidth - b.right))}px`;
    menu.addEventListener('click', (e) => {
      const it = e.target.closest('.bmtl-item'); if (!it || it.disabled) return;
      if (it.dataset.tool === 'work') T.work(); else T.chart();
    });
    btn.classList.add('is-on');
    addEventListener('keydown', onKey, true);
    addEventListener('pointerdown', onDown, true);
    hold(true);
  };
  function safeSum() { try { const s = sum(); return s && SIGN[s.op] && Number.isFinite(s.a) && Number.isFinite(s.b) ? s : null; } catch (e) { console.warn(e); return null; } }

  // ── WORK IT OUT ──────────────────────────────────────────────────────────────────────────────────────────────────
  T.work = () => {
    const s = menu ? menuSum : safeSum();
    closeMenu();
    if (!s) { hold(false); return false; }
    if (s.own) { hold(false); return !!own(s); }   // (the job's own worked area: it counts, and it pauses nothing)
    let work = null;
    try { work = workOf(s.op === 'div' ? { op: 'div', n: s.a, d: s.b } : s); } catch (e) { console.warn(e); }
    if (!work) { hold(false); return false; }
    hold(true);
    const slip = !!document.querySelector('.bmo.is-on');
    panel = openLongWork(document.body, {
      work, setup: s.setup ? setupFor(s) : null, title: 'Work it out', ask: s.ask || '', closeLabel: 'Close', free: !slip, speak,
      onDone: () => { setTimeout(() => { panel = null; hold(false); }, 0); },
      onClose: () => { panel = null; hold(false); },
    });
    // (the panel goes by itself after the last line: its onDone above lets the game go on)
    return true;
  };

  // ── THE TIMES CHART ──────────────────────────────────────────────────────────────────────────────────────────────
  T.chart = () => {
    closeMenu();
    const r = rider();
    hold(true);
    chartOn = true;
    showChart(document.body, { marks: factChart(r || {}), side: 'left', onClose: () => { chartOn = false; hold(false); } });
    return true;
  };

  T.close = () => { closeMenu(); if (panel) { panel.close(); panel = null; } if (chartOn && isChartOpen()) closeChart(); chartOn = false; hold(false); };
  T.busy = () => !!(menu || panel || chartOn);
  T.state = () => ({ menu: !!menu, work: panel ? panel.state() : null, chart: chartOn, sum: safeSum(), label: sumLabel(safeSum()) });
  T.dispose = () => { T.close(); btn.remove(); };
  btn.addEventListener('click', (e) => { e.currentTarget.blur(); T.open(); });
  // (no long sums the job can't name: needsLong is the job's business, kept here only so a rig can ask)
  T.needsLong = needsLong;
  return T;
}

const SVG_WORK = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="4" width="22" height="25" rx="2" fill="#f6edd6" stroke="#6b4614" stroke-width="1.6"/><path d="M9 11h9M9 16h9M9 21h13" stroke="#8a7558" stroke-width="1.4"/><path d="M9 23.5h13" stroke="#2b2219" stroke-width="1.6"/></svg>';
const SVG_CHART = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="4" width="24" height="24" rx="2" fill="#f6edd6" stroke="#6b4614" stroke-width="1.6"/><path d="M12 4v24M20 4v24M4 12h24M4 20h24" stroke="#8a7558" stroke-width="1"/><rect x="12.5" y="12.5" width="7" height="7" fill="#629640" opacity="0.8"/><rect x="20.5" y="12.5" width="7" height="7" fill="#c45238" opacity="0.8"/><rect x="4.5" y="20.5" width="7" height="7" fill="#629640" opacity="0.8"/></svg>';
