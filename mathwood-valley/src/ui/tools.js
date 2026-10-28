// THE TOOLS: a small strip along the bottom of the screen while riding, always laid out (no menu to open first), with
// the two tools the agreed design asks for (2026-10-21) and the level tool (2026-10-21, for Sunday):
//   WORK IT OUT   the sum on what is on screen now, worked in columns on paper (src/ui/longwork.js): adding and taking
//                 away a column at a time (the board carries and borrows by itself), long multiplication and long
//                 division, one highlighted spot at a time with 4 choices. Every job hands over the sum of the part it
//                 is on (J.workSum(): src/math/jobsums.js; the store and the deliveries: their order's own sum, which
//                 counts as their worked area always has; a delivery's second part, a lock box's part being asked, a
//                 builder's card): the range's "closest to 58 + 24" gives 58 + 24 (the estimate stays the kid's), a
//                 blank to fill or a story gives its sum too, filled in: the sheet opens straight on the columns and
//                 teaches it (2026-10-26: no "What do we work out?" first, a kid who taps for help is helped). Decimals
//                 and money too (2.6 × 6, $1.30 + $5.75: src/math/longwork.js puts the points back). A question answered
//                 with one coin that takes two sums (the cost of 3 tins, then the change from $20) is walked in steps,
//                 the first sum's answer carried into the second. The button's words don't give a story's sum away
//                 ("The sum on this question"); the kid still answers the question itself.
//                 It is never dimmed: nothing to read on screen (riding about, a clock to read, a series to finish)
//                 opens the entry to type a sum by hand (src/ui/ownsum.js; "Type your own sum" on the button), and a
//                 sheet that read one has a small "Type my own sum" too, for a different one.
//   THE TIMES CHART   12 x 12, every fact the rider has answered anywhere coloured: red missed, yellow right once since,
//                 green known (src/math/facts.js chart: red ones come back soon); src/ui/timeschart.js draws it.
//   THE LEVEL TOOL   for the place the rider is at: "‹ 27: Odd steps going down ›". The arrows step the rider's level
//                 there down and up (what the levels page's "Start here" did), each level's title showing as they go;
//                 the small bar under it fills with right answers toward the next level (src/ui/leveltool.js). A rider
//                 made with "Let the rider pick levels" off has no arrows: the title and the bar still show.
// Work it out from a field job's card is help only: nothing is counted (the job's own answer still is). The game waits
// while a tool is open (onOpen / onClose: main.js pauses), and Esc or the close button puts it away. Opened over the lock
// box (its own Work it out button: the HUD is under the box), the sheet goes over the box.
// The strip sits low in the middle on a computer, and on a phone just above the touch buttons (clear of the job card at
// the top and the thumb stick's corner): tools.css.
//
//   const T = makeTools({ hud, rider, sum, own, canOpen, speak, onOpen, onClose, place, onLevel })
//     hud     the HUD (src/ui/hud.js): the strip goes in it (it hides with it)
//     rider() the rider now; sum() -> the sum on screen now: { op: 'add' | 'sub' | 'mul' | 'div', a, b, money, cash,
//             ask, story, own }, sums in steps { chain: [...], ask, story }, or null (main.js asks the job at work: its
//             workSum()); story: the sum isn't written on the question (the button doesn't say it)
//     own(sum)  opens a job's own worked area for a sum with own: true (the store's or the deliveries' order); false:
//             it couldn't just then (already up): the entry opens instead
//     canOpen() false while the tools can't open (the title, the menu or a lock box is up)
//     speak(text) | null   read-aloud for a rider who is read to
//     place()   the levels place the rider is at now (src/levels/places.js id), or null: the level tool hides
//     onLevel(placeId, view)   the rider's level there was stepped by hand (main.js saves the rider)
//   T.el (the strip), T.update() (main.js calls it a few times a second: the sum's label, the place and its level),
//   T.work() (the lock box's and a builder's own Work it out buttons call it too), T.own() (the entry, empty),
//   T.treat({ kind, n, name, busy } | null) the apple button (busy: dimmed, the horse munching) (src/feeding.js; onTreat() when it is pressed),
//   T.chart(), T.step(dir) (the level tool's arrows), T.close(), T.busy() (a tool is up), T.state() (for rigs:
//   { work: the sheet's state, own: the entry's, chart, sum, label, level }), T.dispose()

import { workOf, needsLong, sumWords } from '../math/longwork.js';
import { chart as factChart } from '../math/facts.js';
import { openLongWork } from './longwork.js';
import { openOwnSum } from './ownsum.js';
import { showChart, closeChart, isChartOpen, ensureChartCss } from './timeschart.js';
import { levelTool, stepLevel } from './leveltool.js';
import { TREAT_ICON } from './treaticons.js';

const CSS_HREF = new URL('./tools.css', import.meta.url).href;
function ensureCss() {
  if (typeof document === 'undefined' || document.querySelector('link[data-bm-tools]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS_HREF; l.dataset.bmTools = '1'; document.head.appendChild(l);
}
const SIGN = { add: '+', sub: '−', mul: '×', div: '÷' };

// the words on the Work it out button for a sum (a story's sum is not given away: "the sum on this question"); with
// none on screen, the entry to type one (never a word that says a question is too small for it)
export function sumLabel(sum) {
  if (!sum) return 'Type your own sum';
  if (sum.chain) return 'The sums on this question';
  if (sum.story || sum.own) return 'The sum on this question';
  return sumWords(sum);
}
// a sum handed over, checked: a plain one, or sums in steps whose every step is a sum
const isSum = (s) => !!s && !!SIGN[s.op] && Number.isFinite(s.a) && Number.isFinite(s.b);
export function readSum(s) {
  if (!s) return null;
  if (Array.isArray(s.chain)) return s.chain.length && s.chain.every(isSum) ? s : null;
  return isSum(s) ? s : null;
}

export function makeTools({ hud, rider = () => null, sum = () => null, own = () => false, canOpen = () => true, speak = null, onOpen = () => {}, onClose = () => {}, place = () => null, onLevel = () => {}, onTreat = () => {} } = {}) {
  ensureCss(); ensureChartCss();
  const bar = document.createElement('div');
  bar.className = 'bmtl-bar';
  bar.innerHTML = `<div class="bmtl-pair">
      <button type="button" class="bmtl-b bmtl-work" aria-label="Work it out">${SVG_WORK}<span class="bmtl-t"><b>Work it out</b><small></small></span></button>
      <button type="button" class="bmtl-b bmtl-chart" aria-label="Times chart">${SVG_CHART}<span class="bmtl-t"><b>Times chart</b></span></button>
      <button type="button" class="bmtl-b bmtl-treat" hidden><span class="bmtl-ti"></span><span class="bmtl-t"><b></b><small></small></span><i class="bmtl-tn"></i></button>
    </div>
    <div class="bmtl-level" hidden>
      <button type="button" class="bmtl-step" data-dir="-1" aria-label="A level down">${ARROW_L}</button>
      <div class="bmtl-lv"><span class="bmtl-lvt"></span><span class="bmtl-lvbar"><i></i></span></div>
      <button type="button" class="bmtl-step" data-dir="1" aria-label="A level up">${ARROW_R}</button>
    </div>`;
  const root = hud && hud.el ? hud.el : document.body;
  root.appendChild(bar);
  const q = (sel) => bar.querySelector(sel);
  const workBtn = q('.bmtl-work'), chartBtn = q('.bmtl-chart'), workSmall = q('.bmtl-work small');
  const levelEl = q('.bmtl-level'), lvText = q('.bmtl-lvt'), lvFill = q('.bmtl-lvbar i'), lvBox = q('.bmtl-lv');
  const downBtn = q('.bmtl-step[data-dir="-1"]'), upBtn = q('.bmtl-step[data-dir="1"]');
  let panel = null, chartOn = false, held = false, lastSum = null, lvKey = '', lvView = null, sumKey = null;
  const T = { el: bar };

  function hold(on) {
    if (on === held) return;
    held = on;
    try { (on ? onOpen : onClose)(); } catch (e) { console.error(e); }
  }
  function safeSum() { try { return readSum(sum()); } catch (e) { console.warn(e); return null; } }

  // ── WORK IT OUT ──────────────────────────────────────────────────────────────────────────────────────────────────
  // (the sum is read before the game waits: a paused game has no question up)
  T.work = () => {
    if (panel) { panel.close(); panel = null; hold(false); return false; }
    if (!canOpen() && !chartOn) return false;
    const s = safeSum();
    if (chartOn) closeChartNow();
    if (s && s.own) {   // (the job's own worked area: it counts, and it pauses nothing; already up: the entry instead)
      hold(false);
      let opened = false;
      try { opened = !!own(s); } catch (e) { console.error(e); }
      if (opened) return true;
      hold(true);
      return openOwn();
    }
    hold(true);
    return s ? openWork(s) : openOwn();
  };
  T.own = () => {
    if (panel) { panel.close(); panel = null; }
    if (!canOpen() && !chartOn) return false;
    if (chartOn) closeChartNow();
    hold(true);
    return openOwn();
  };
  // where the sheet goes: beside the store's slip when it is up, over the lock box when that is up, else the middle (and
  // the middle, over a shade, when a job's own worked area is up already: the entry over it)
  const placing = () => ({ free: !document.querySelector('.bmo.is-on') || !!document.querySelector('.bml:not(.is-out)'), top: !!document.querySelector('.lbx') });
  // the columns for a sum (or sums in steps); mine: one the kid typed
  function openWork(s, mine = false) {
    let work = null, chain = null;
    try {
      if (s.chain) chain = s.chain.map((x) => ({ work: workOf(x), sum: x, say: x.say || '', carried: x.carried || null }));
      else work = workOf(s);
    } catch (e) { console.warn(e); }
    if (chain ? chain.some((x) => !x.work) : !work) return openOwn();   // (nothing the columns can do with it: the entry)
    panel = openLongWork(document.body, {
      work, chain, title: 'Work it out', ask: mine ? 'Your own sum' : s.ask || '', closeLabel: 'Close', ...placing(), speak,
      onOwn: () => { const p = panel; panel = null; if (p) p.close(); openOwn(); },
      onDone: () => { setTimeout(() => { panel = null; hold(false); }, 0); },
      onClose: () => { panel = null; hold(false); },
    });
    // (the panel goes by itself after the last line: its onDone above lets the game go on)
    return true;
  }
  // the entry to type a sum by hand; "Work it out" on it opens that sum's columns
  function openOwn() {
    panel = openOwnSum(document.body, { ...placing(), speak,
      onWork: (mine) => { const p = panel; panel = null; if (p) p.close(); openWork(mine, true); },
      onClose: () => { panel = null; hold(false); },
    });
    return true;
  }

  // ── THE TIMES CHART ──────────────────────────────────────────────────────────────────────────────────────────────
  function closeChartNow() { if (chartOn && isChartOpen()) closeChart(); chartOn = false; }
  T.chart = () => {
    if (chartOn) { closeChartNow(); hold(false); return false; }
    if (!canOpen() && !panel) return false;
    if (panel) { panel.close(); panel = null; }
    const r = rider();
    hold(true);
    chartOn = true;
    showChart(document.body, { marks: factChart(r || {}), side: 'left', onClose: () => { chartOn = false; hold(false); } });
    return true;
  };

  // ── THE LEVEL TOOL ───────────────────────────────────────────────────────────────────────────────────────────────
  function showLevel(v) {
    lvView = v;
    const key = v ? `${v.place}|${v.id}|${v.into}|${v.placing}|${v.pick}|${v.canDown}|${v.canUp}` : '';
    if (key === lvKey) return;
    lvKey = key;
    levelEl.hidden = !v;
    if (!v) return;
    lvText.textContent = v.words;
    lvBox.title = `${v.name}: ${v.note}`;
    lvBox.setAttribute('aria-label', `${v.name}, level ${v.words}. ${v.note}`);
    lvFill.style.width = `${Math.round(v.fill * 100)}%`;
    levelEl.classList.toggle('is-placing', v.placing);
    levelEl.classList.toggle('is-fixed', !v.pick);
    downBtn.hidden = upBtn.hidden = !v.pick;
    downBtn.disabled = !v.canDown; upBtn.disabled = !v.canUp;
  }
  T.step = (dir) => {
    const r = rider(), id = lvView && lvView.place;
    if (!r || !id) return null;
    const v = stepLevel(r, id, dir);
    if (!v) return null;
    showLevel(v);
    levelEl.classList.remove('is-moved'); void levelEl.offsetWidth; levelEl.classList.add('is-moved');
    try { onLevel(id, v); } catch (e) { console.error(e); }
    return v;
  };

  // the strip now: the sum's label on Work it out, the place's level (cheap: only what changed is written)
  T.update = () => {
    const s = held ? lastSum : safeSum();
    lastSum = s;
    const k = sumLabel(s);
    if (k !== sumKey) {
      sumKey = k;
      workBtn.classList.toggle('is-own', !s);   // (no sum on screen: the entry to type one; never dimmed)
      workSmall.textContent = k;
      workBtn.title = `Work it out: ${k}`;
    }
    if (held) return;
    let pid = null;
    try { pid = place(); } catch (e) { console.warn(e); }
    const r = rider();
    showLevel(pid && r ? levelTool(r, pid) : null);
  };

  // ── THE APPLE BUTTON (src/feeding.js): up beside the two tools while a horse's head is in reach and there's a treat in
  // the saddlebags; o = { kind: 'apple' | 'carrot', n (how many), name (the horse's) } or null to put it away. A tap or a
  // click (or G) gives the treat; it never pauses the game
  const treatBtn = q('.bmtl-treat');
  const fingers = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  T.treat = (o) => {
    treatBtn.hidden = !o;
    if (!o) return;
    treatBtn.classList.toggle('is-busy', !!o.busy);   // (the horse still munching the last one)
    const word = o.kind === 'carrot' ? 'carrot' : 'apple';
    treatBtn.dataset.kind = word;
    treatBtn.querySelector('.bmtl-ti').innerHTML = TREAT_ICON[word];
    treatBtn.querySelector('b').textContent = `Give ${word === 'apple' ? 'an apple' : 'a carrot'}`;
    treatBtn.querySelector('small').textContent = `to ${o.name || 'the horse'}${fingers() ? '' : ' · G'}`;
    treatBtn.querySelector('.bmtl-tn').textContent = String(o.n);
    treatBtn.setAttribute('aria-label', `Give ${word === 'apple' ? 'an apple' : 'a carrot'} to ${o.name || 'the horse'} (${o.n} left)`);
  };
  treatBtn.addEventListener('click', (e) => { e.currentTarget.blur(); try { onTreat(); } catch (err) { console.error(err); } });
  T.close = () => { if (panel) { panel.close(); panel = null; } closeChartNow(); hold(false); };
  T.busy = () => !!(panel || chartOn);
  T.state = () => ({ work: panel && panel.kind !== 'own' ? panel.state() : null, own: panel && panel.kind === 'own' ? panel.state() : null,
    chart: chartOn, sum: safeSum(), label: sumLabel(safeSum()), level: lvView });
  T.dispose = () => { T.close(); bar.remove(); };
  // (a tap on a tool never reaches the valley: the round-up's rope and the range's six-shooter listen there)
  bar.addEventListener('pointerdown', (e) => e.stopPropagation());
  workBtn.addEventListener('click', (e) => { e.currentTarget.blur(); T.work(); });
  chartBtn.addEventListener('click', (e) => { e.currentTarget.blur(); T.chart(); });
  for (const b of [downBtn, upBtn]) b.addEventListener('click', (e) => { e.currentTarget.blur(); T.step(+b.dataset.dir); });
  // (no long sums the job can't name: needsLong is the job's business, kept here only so a rig can ask)
  T.needsLong = needsLong;
  return T;
}

const ARROW_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 7.5 12l7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SVG_WORK = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="4" width="22" height="25" rx="2" fill="#f6edd6" stroke="#6b4614" stroke-width="1.6"/><path d="M9 11h9M9 16h9M9 21h13" stroke="#8a7558" stroke-width="1.4"/><path d="M9 23.5h13" stroke="#2b2219" stroke-width="1.6"/></svg>';
const SVG_CHART = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="4" width="24" height="24" rx="2" fill="#f6edd6" stroke="#6b4614" stroke-width="1.6"/><path d="M12 4v24M20 4v24M4 12h24M4 20h24" stroke="#8a7558" stroke-width="1"/><rect x="12.5" y="12.5" width="7" height="7" fill="#629640" opacity="0.8"/><rect x="20.5" y="12.5" width="7" height="7" fill="#c45238" opacity="0.8"/><rect x="4.5" y="20.5" width="7" height="7" fill="#629640" opacity="0.8"/></svg>';
