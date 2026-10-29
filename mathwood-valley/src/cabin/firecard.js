// THE FIRE'S CARD: the few fireside sums before a fire is lit in the cabin's hearth (firemath.js deals them), low on the
// screen so the fireplace stays in view. One sum at a time with its answers (a key under each: 1 to 4); a wrong pick
// gets the topic's plain line and its picture (ten-frames, a number line: src/ui/counthelp.js) and costs nothing, the
// kid just picks again; "Show me" brings the picture up any time, and it comes up by itself when the kid has been
// stuck a while. A right pick ticks green and the next sum slides in; after the last the card goes and the fire
// catches (the reward is the fire itself: no result screen). "Not now" or Esc puts it away.
//
//   const K = openFireCard({ parent, rider, save, onLit, onClose })
//   K.pick(i)        picks answer i (0-based; the rigs, and the keys 1 to 4)
//   K.state()        { map, step, card (its text), index, of, helper, line, answers }
//   K.close()
import { fireCards, wrongLine, nudgeLine, helpPicture, FIRE_MATH } from './firemath.js';
import { showCountHelp } from '../ui/counthelp.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function openFireCard({ parent, rider, save = () => {}, onLit = () => {}, onClose = () => {} }) {
  const set = fireCards(rider); save(rider);   // (asking the skill model may start a strand's baseline: kept)
  const el = document.createElement('div'); el.className = 'bmc-fire'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Light a fire');
  el.innerHTML = `<div class="bmcf-head"><span class="bmcf-title">${esc(set.title)}</span><span class="bmcf-dots" aria-hidden="true"></span></div>
    <p class="bmcf-lead">${esc(set.lead)}</p>
    <div class="bmcf-sum" aria-live="polite"></div>
    <div class="bmcf-answers"></div>
    <p class="bmcf-line" aria-live="polite"></p>
    <div class="bmcf-help"></div>
    <div class="bmcf-foot"><button type="button" class="bmcf-show">Show me</button><button type="button" class="bmcf-close">Not now</button></div>`;
  parent.appendChild(el);
  const $ = (s) => el.querySelector(s);
  let i = 0, help = null, stuckT = 0, closed = false, busy = false, line = '';
  const card = () => set.cards[i];
  function showHelp(o) { if (help) help.remove(); help = null; const pic = helpPicture(set, card(), o); if (pic) help = showCountHelp($('.bmcf-help'), pic); }
  function draw() {
    const c = card();
    $('.bmcf-dots').innerHTML = set.cards.map((_, k) => `<i class="${k < i ? 'is-done' : k === i ? 'is-now' : ''}"></i>`).join('');
    $('.bmcf-sum').textContent = `${c.text} = ?`;
    $('.bmcf-answers').innerHTML = c.targets.map((t, k) => `<span class="bmcf-a"><button type="button" data-k="${k}">${esc(t.label != null ? t.label : t.n)}</button><kbd>${k + 1}</kbd></span>`).join('');
    $('.bmcf-answers').querySelectorAll('button').forEach((b) => { b.onclick = () => pick(+b.dataset.k); });
    line = ''; $('.bmcf-line').textContent = '';
    if (help) { help.remove(); help = null; }
    stuckT = 0;
    el.classList.remove('is-next'); void el.offsetWidth; el.classList.add('is-next');
  }
  function pick(k) {
    if (closed || busy) return;
    const c = card(), t = c.targets[k]; if (!t) return;
    const b = $(`.bmcf-answers button[data-k="${k}"]`);
    if (!t.good) {
      // (no cost: the line and the picture, the answer shown on it, and pick again)
      if (b) { b.disabled = true; b.classList.add('is-wrong'); }
      line = wrongLine(set, c, t.n); $('.bmcf-line').textContent = line;
      showHelp({ reveal: true, picked: t.n });
      stuckT = -999;
      return;
    }
    if (b) b.classList.add('is-right');
    busy = true;
    setTimeout(() => {
      busy = false; if (closed) return;
      i++;
      if (i >= set.cards.length) { closed = true; el.classList.add('is-lit'); onLit(); setTimeout(() => el.remove(), 450); detach(); return; }
      draw();
    }, 520);
  }
  // stuck a while: a nudge and the picture, the answer kept hidden
  const tick = setInterval(() => {
    if (closed) return;
    stuckT += 0.5;
    if (stuckT >= FIRE_MATH.stuck && !help) { line = nudgeLine(set, card()); $('.bmcf-line').textContent = line; showHelp({ reveal: false }); }
  }, 500);
  $('.bmcf-show').onclick = () => { if (!help) { showHelp({ reveal: false }); const n = nudgeLine(set, card()); if (n && !line) $('.bmcf-line').textContent = n; } };
  const close = () => { if (closed) return; closed = true; el.remove(); detach(); onClose(); };
  $('.bmcf-close').onclick = close;
  // the keys: 1 to 4 pick, Esc puts it away (before the game's own Esc opens its menu)
  const key = (e) => {
    if (closed) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    const n = /^Digit([1-9])$/.exec(e.code) || /^Numpad([1-9])$/.exec(e.code);
    if (n) { e.preventDefault(); e.stopImmediatePropagation(); pick(+n[1] - 1); }
  };
  addEventListener('keydown', key, true);
  function detach() { clearInterval(tick); removeEventListener('keydown', key, true); }
  draw();
  return {
    el, pick, close,
    get open() { return !closed; },
    state: () => ({ map: set.map, step: set.step, card: card() ? card().text : null, answer: card() ? card().answer : null, index: i, of: set.cards.length, helper: !!help, line, answers: card() ? card().targets.map((t) => t.n) : [] }),
  };
}
