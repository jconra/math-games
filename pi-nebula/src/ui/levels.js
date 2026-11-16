// THE JOB LEVELS: for each station job, the levels its questions may come from and whether the game moves the level by
// itself. The game's maker, 2026-11-16 (for both games): "a range selector at the top that had a min and max value (kind
// of like a price filter on Amazon) ... There should also be a setting in the menu to disable adaptive level changes.
// So if someone wants to really practice for a test, they can set it to the type of math questions they want without
// it always going up to the next one."
//
// One sheet over the station, in the job panel's dark glass: a tab for each job (when more than one is shown), where
// the crew member is on its ladder, LEVELS TO ASK (the two-handled slider Mathwood's levels page has too:
// shared/levelrange.js; the names of the levels at its ends show as the handles move, and the ladder's list below greys
// the levels outside it as they go), and KEEP TO THESE LEVELS (off at the start: the game moves the level up and down by
// itself, inside the range; on, the level stays where it is and only the arrows by the level move it, inside the range).
// The levels themselves are Mathwood's (src/levels/model.js setRange, setKeep), saved with the crew member straight away.
// It never opens by itself: the Levels button by a job's level (jobs/panel.js), and the crew screen's (ui/title.js).
//
//   const L = openJobLevels(root, crew, { jobs, job, onChange(crew), onClose(changed) })   L.close(), L.el
//     jobs      the jobs to show (each a jobs/*.js JOB with a place; jobs without one, or not open yet, are left out)
//     job       the tab to open on (a job id), else the first
//     onChange  after every change (the caller saves the crew member)
//     onClose   with true when a job's next question would now come from another level (the panel deals again)
//   Esc, the X or a click on the dark backdrop closes it.
import { makeLevelRange, rangeWords } from '../../../shared/levelrange.js';
import { register } from '../jobs/engine.js';
import { rangeOf, setRange, setKeep, setAllOn, stateOf, levelHere } from '../../../mathwood-valley/src/levels/model.js';

const CSS = new URL('./levels.css', import.meta.url).href;
function ensureCss() {
  if (document.querySelector('link[data-pnl]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.pnl = '1'; document.head.appendChild(l);
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOCK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="7" width="10" height="7.5" rx="1.2" fill="currentColor"/></svg>';

// Where the crew member is at a job, in plain words (the level the next question comes from, inside the range).
export function whereWords(crew, job) {
  const P = job.place, n = P.levels.length, s = stateOf(crew, P.id);
  const id = levelHere(crew, P.id), k = P.levels.findIndex((L) => L.id === id), L = P.levels[k];
  if (!s) return `Not played yet: you'd start at level ${k + 1} of ${n}, ${L.title}.`;
  if (s.keep === true) return `Kept on level ${k + 1} of ${n}: ${L.title}. Only the arrows by the level move it.`;
  if (!s.placed) return `Finding your level: trying level ${k + 1} of ${n}, ${L.title}.`;
  return `You're on level ${k + 1} of ${n}: ${L.title}.`;
}

export function openJobLevels(root, crew, { jobs = [], job = null, onChange = () => {}, onClose = () => {} } = {}) {
  ensureCss();
  const list = jobs.filter((j) => j && j.place && j.open !== false);
  for (const j of list) register(j);
  if (!list.length) return null;
  const S = { job: list.some((j) => j.id === job) ? job : list[0].id, note: '' };
  const was = new Map(list.map((j) => [j.id, stateOf(crew, j.place.id) ? levelHere(crew, j.place.id) : null]));
  let closed = false, slider = null;
  const back = document.activeElement;

  const el = document.createElement('div');
  el.className = 'pnl';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Job levels');
  root.appendChild(el);

  const jobOf = () => list.find((j) => j.id === S.job);
  function draw({ focus = null } = {}) {
    const J = jobOf(), P = J.place, R = rangeOf(crew, P.id), here = levelHere(crew, P.id);
    const hereI = P.levels.findIndex((L) => L.id === here), set = !R.full || R.holes.length > 0;
    const tabs = list.length > 1 ? `<div class="pnl-tabs" role="tablist" aria-label="Jobs">${list.map((j) => `<button type="button" class="pnl-tab" role="tab"
        aria-selected="${j.id === S.job}" tabindex="${j.id === S.job ? 0 : -1}" data-do="tab" data-id="${j.id}">${esc(j.short || j.name)}</button>`).join('')}</div>` : '';
    el.innerHTML = `<section class="pnl-card">
      <header class="pnl-head"><div><h2>${esc(J.name)}</h2><small>${esc(crew.name || '')}${list.length > 1 ? '' : ': its levels'}</small></div>
        <button type="button" class="pnl-x" data-do="close" aria-label="Close (Esc)">&#10005;</button></header>
      ${tabs}
      <p class="pnl-where">${esc(whereWords(crew, J))}</p>
      <div class="pnl-range">
        <div class="pnl-rhead"><h3>Levels to ask</h3>${set ? '<button type="button" class="pnl-chip" data-do="all">Every level</button>' : '<small>Drag either end to ask fewer</small>'}</div>
        <div class="pnl-slider"></div>
        <div class="pnl-keep">
          <button type="button" class="pnl-switch" role="switch" aria-checked="${R.keep}" data-do="keep">${LOCK}<span>Keep to these levels</span><b>${R.keep ? 'On' : 'Off'}</b></button>
          <small>${R.keep ? 'On: you stay on your level. Only the arrows by the level move it, and only inside these levels.'
            : 'Off: the game moves you up and down by itself, inside these levels. On: you stay on your level, say to practise for a test.'}</small>
        </div>
        ${S.note ? `<p class="pnl-note" role="status">${esc(S.note)}</p>` : ''}
      </div>
      <ol class="pnl-list" aria-label="${esc(J.name)}: its levels, easiest first">${P.levels.map((L, i) => `<li data-i="${i}" class="${i < R.lo || i > R.hi || R.holes.includes(L.id) ? 'is-off' : ''}${i === hereI ? ' is-here' : ''}">
        <span class="pnl-n">${i + 1}</span><span class="pnl-t">${esc(L.title)}</span>${i === hereI ? '<em>you</em>' : ''}</li>`).join('')}</ol>
    </section>`;
    slider = makeLevelRange({ n: P.levels.length, lo: R.lo, hi: R.hi, here: hereI, name: (i) => P.levels[i].title, label: `${J.name}: the levels to ask`,
      onInput: (lo, hi) => { for (const li of el.querySelectorAll('.pnl-list li')) { const i = +li.dataset.i; li.classList.toggle('is-off', i < lo || i > hi); } },
      onChange: (lo, hi) => {
        const k = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null;
        if (setRange(crew, P.id, P.levels[lo].id, P.levels[hi].id)) { S.note = `${rangeWords(lo, hi, P.levels.length)} on.`; changed(); }
        draw({ focus: k === 'lo' || k === 'hi' ? `.lr-thumb[data-k="${k}"]` : null });
      } });
    el.querySelector('.pnl-slider').appendChild(slider.el);
    if (focus) { const f = el.querySelector(focus); if (f) f.focus({ preventScroll: true }); }
  }
  function changed() { try { onChange(crew); } catch (e) { console.error(e); } }

  function act(what, b) {
    const J = jobOf(), P = J.place;
    if (what === 'close') { close(); return; }
    if (what === 'tab') { if (b.dataset.id !== S.job) { S.job = b.dataset.id; S.note = ''; draw({ focus: `.pnl-tab[data-id="${S.job}"]` }); } return; }
    if (what === 'all') { if (setAllOn(crew, P.id)) { S.note = 'Every level is on.'; changed(); } draw({ focus: '.lr-thumb[data-k="lo"]' }); return; }
    if (what === 'keep') {
      const on = !rangeOf(crew, P.id).keep;
      if (setKeep(crew, P.id, on)) { S.note = on ? 'Kept: the level stays where it is.' : 'The game moves the level by itself again.'; changed(); }
      draw({ focus: '[data-do="keep"]' });
    }
  }
  el.addEventListener('click', (e) => {
    if (e.target === el) { close(); return; }
    const b = e.target.closest('[data-do]');
    if (b && el.contains(b)) act(b.dataset.do, b);
  });
  // Esc closes this sheet only (the job panel under it keeps its own keys while it is up: panel.js); arrows move
  // between the job tabs
  function onKey(e) {
    if (closed) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    const t = e.target;
    if (t && t.classList && t.classList.contains('pnl-tab') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const i = list.findIndex((j) => j.id === S.job), j = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
      act('tab', { dataset: { id: j.id } });
    }
  }
  addEventListener('keydown', onKey, true);

  function close() {
    if (closed) return;
    closed = true;
    removeEventListener('keydown', onKey, true);
    el.remove();
    try { if (back && back.focus && document.contains(back)) back.focus({ preventScroll: true }); } catch (e) { /* the opener is gone */ }
    const moved = list.some((j) => was.get(j.id) !== (stateOf(crew, j.place.id) ? levelHere(crew, j.place.id) : null));
    try { onClose(moved); } catch (e) { console.error(e); }
  }

  draw({ focus: list.length > 1 ? `.pnl-tab[data-id="${S.job}"]` : '.lr-thumb[data-k="lo"]' });
  return { el, close };
}
