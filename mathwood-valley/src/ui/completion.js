// THE CHECKLIST ON SCREEN (the list itself is src/completion.js): the "What's left" page, the small toast when an item
// is checked off, and the goals a grown-up pinned, in the HUD's top right corner with their progress.
//
//   openWhatsLeft(root, rider, { onClose, pin, onChange })   the "What's left" page over everything (the title's rider
//            card or the pause menu opens it): the percent, the pinned goals, then every group with what's still to do,
//            each item saying how to get it, and what's done as small ticks. pin: true opens the goal picker instead
//            ("Set a goal": the grown-ups' corner): the goals pinned with Unpin, then the short list of goals to pin
//            (src/completion.js goalChoices): a row per job with its four buckles as chips (the row pins the next buckle
//            not won, a chip that exact one), buy everything, a row per collection, every place; onChange(rider) after a
//            pin changed (the caller saves).
//            Esc, the x, or a click on the dimmed backdrop closes it. -> { el, close(), redraw() }
//   toastUnlock(hud, item, { pct, audio })   the toast for an item (or a list of items) checked off: small, at the top
//            middle, with a soft two-note chime (audio: src/audio/audio.js's). Toasts queue and wait while a question
//            is up (makeChecklist's busy), and several at once go up as one.
//   makeChecklist({ hud, audio, rider, busy, save, world })   what main.js makes for a ride:
//            busy(): true while a question is up (a lock box, a slip, the counter, a wave under way): toasts wait
//            save(): saves the rider; world: { place(), hideout(), home() } what the rider is at now (a camp's id, a
//            gang hideout's id, inside the cabin), looked at about once a second (src/completion.js notice)
//     -> { check() (look for items checked off now; call after anything is bought or done), corner (the goals'
//          element), dispose() }
//   ensureChecklistCss()
//
// Every piece is page elements only (no 3D). The toast and the goals corner never take a click.
// z-index: the toast 34 (over the HUD 12, the store slip 30 and the counters' panels 32; under the times chart 35);
// the goals corner 13 (just over the HUD); the page 33 (over the title 20 and the counters).
import {
  completion, unlocked, goalsOf, goalChoices, setGoal, clearGoal, notice, progressLine, MOST_GOALS,
} from '../completion.js';
import { buckleSVG, ICON } from './hud.js';
import { hatIcon } from '../hats.js';
import { JOBS, BUCKLES, BUCKLE_NAMES } from '../save.js';

export const TOAST = {
  show: 3400,        // ms a toast stays up
  gap: 450,          // ms between two toasts
  look: 1000,        // ms between looks at the world (the camps, the hideouts, the cabin) and the goals' progress
  level: 0.07,       // the chime's loudness into the game's master volume
};

const CSS_HREF = new URL('./completion.css', import.meta.url).href;
const FONTS_HREF = new URL('./fonts/fonts.css', import.meta.url).href;
export function ensureChecklistCss() {
  if (typeof document === 'undefined') return;
  for (const [href, key] of [[FONTS_HREF, 'bmFonts'], [CSS_HREF, 'bmChecklist']]) {
    if (document.querySelector(`link[data-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`)) continue;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset[key] = '1'; document.head.appendChild(l);
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ── LITTLE PICTURES ──────────────────────────────────────────────────────────────────────────────────────────────
const COAT = { donkey: '#8e8070', chestnut: '#a2532c', palomino: '#e2b866', white: '#efe9dd', midnight: '#2c2523', bay: '#7a4a2a' };
const DOG_COAT = { shiba: '#d9873f', husky: '#b9c0c6', pug: '#d8bf94' };
const svg = (inner, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"${extra}>${inner}</svg>`;
const PIC = {
  saddle: svg('<path d="M4 9.5c2.6 0 4-2 8-2s5.4 2 8 2c.6 0 1 .5.8 1.1-.8 2.6-2.8 4.4-5.8 4.9V19h-2v-3.4c-.3 0-.7.1-1 .1s-.7 0-1-.1V19H9v-3.5c-3-.5-5-2.3-5.8-4.9C3 10 3.4 9.5 4 9.5z" fill="currentColor"/><path d="M14.6 6.2c.4-1.4 1.6-2.2 2.9-2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>'),
  camera: svg('<rect x="3" y="7" width="18" height="12" rx="2" fill="currentColor"/><rect x="8" y="4.5" width="8" height="3.5" rx="1" fill="currentColor"/><circle cx="12" cy="13" r="3.6" fill="#1d140c"/><circle cx="12" cy="13" r="2" fill="currentColor" opacity="0.6"/>'),
  keepsake: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="12,6.4 13.7,10 17.6,10.3 14.6,12.8 15.6,16.6 12,14.5 8.4,16.6 9.4,12.8 6.4,10.3 10.3,10" fill="currentColor"/>'),
  hideout: svg('<path d="M4 10.4Q4 6 12 6t8 4.4z" fill="currentColor"/><rect x="4" y="10.4" width="16" height="9" rx="1" fill="currentColor"/><path d="M8.5 6.6v12.8M15.5 6.6v12.8" stroke="#1d140c" stroke-width="1" opacity="0.6"/><rect x="10.6" y="11.6" width="2.8" height="3.4" rx="0.5" fill="#1d140c"/>'),
  camp: svg('<path d="M12 3.6L2.6 19.6h18.8z" fill="currentColor"/><path d="M12 9.6l-3.6 10h7.2z" fill="#1d140c"/><path d="M12 3.6l-1.6-1.6M12 3.6l1.6-1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
  place: svg('<path d="M12 21.5s-6.8-6.6-6.8-11.6a6.8 6.8 0 0 1 13.6 0c0 5-6.8 11.6-6.8 11.6z" fill="currentColor"/><circle cx="12" cy="9.8" r="2.6" fill="#1d140c"/>'),
  windmill: svg('<path d="M10.6 21.5l.9-11h1l.9 11z" fill="currentColor"/><path d="M12 9.6L12 2.4l2.4 5.8zM12 9.6l7.2 0-5.8 2.4zM12 9.6l0 7.2-2.4-5.8zM12 9.6l-7.2 0 5.8-2.4z" fill="currentColor"/>'),
  // a ladder-back chair, side on
  furniture: svg('<path d="M6.4 2.8h2.3v8.3h8.9v2.5h-1.2v7.2h-2.3v-7.2H8.7v7.2H6.4z" fill="currentColor"/><path d="M8.7 5.2h3.2M8.7 8.2h3.2" stroke="currentColor" stroke-width="1.5"/>'),
  hen: svg('<path d="M9.4 6.6c0-1.6 1-2.8 2.4-2.8 1 0 1.6.6 1.9 1.4l1.8.5-1.6 1.1c.2.7.2 1.3 0 1.9l4.8-2.4c.4 4-1 9.2-6.7 10.4-4.2.9-7-1.6-7-4.4 0-2.6 2.1-4 4.4-5.7z" fill="currentColor"/><path d="M10.6 17.4v3M13.4 17.2v3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="11.7" cy="6.2" r="0.8" fill="#1d140c"/><path d="M10.8 3.9l.5-1.6 1 1.2.9-1.2.3 1.7" fill="#d9503c"/>'),
  pig: svg('<path d="M5.6 8L4.8 3.8 9 6.4zM18.4 8l.8-4.2L15 6.4z" fill="currentColor"/><circle cx="12" cy="12.4" r="7.6" fill="currentColor"/><ellipse cx="12" cy="15" rx="3.4" ry="2.4" fill="#1d140c" opacity="0.35"/><circle cx="10.8" cy="15" r="0.7" fill="#1d140c"/><circle cx="13.2" cy="15" r="0.7" fill="#1d140c"/><circle cx="9.4" cy="10.4" r="0.85" fill="#1d140c"/><circle cx="14.6" cy="10.4" r="0.85" fill="#1d140c"/>'),
  sheep: svg('<path d="M7 18c-2.6 0-4-1.8-4-3.8 0-1.6.9-2.6 2-3-.3-2.2 1.4-3.8 3.2-3.6C8.9 5.8 10.4 5 12 5s3.1.8 3.8 2.6c1.8-.2 3.5 1.4 3.2 3.6 1.1.4 2 1.4 2 3 0 2-1.4 3.8-4 3.8z" fill="currentColor"/><path d="M8.6 18v3M15.4 18v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><ellipse cx="12" cy="12" rx="2.6" ry="3" fill="#1d140c" opacity="0.55"/>'),
  cow: svg('<path d="M3 6.2c1.6 1.4 3.4 1.6 4.8 1.2h8.4c1.4.4 3.2.2 4.8-1.2-.6 2.6-2.6 3.8-4.6 3.6l-.8 7.6Q14 21 12 21t-3.6-3.6L7.6 9.8C5.6 10 3.6 8.8 3 6.2z" fill="currentColor"/><circle cx="10" cy="12" r="0.9" fill="#1d140c"/><circle cx="14" cy="12" r="0.9" fill="#1d140c"/><ellipse cx="12" cy="17.6" rx="2.6" ry="1.8" fill="#1d140c" opacity="0.35"/>'),
  tick: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8.4l3 3 6.6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pin: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1.8h4l-.6 4.6 2.6 2.4H4l2.6-2.4zM8 8.8v5.4" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
};
// the picture for an item, from its id. aim: a goal's buckle not won yet shows in its own metal, dimmed (the buckle
// being aimed at), where the list shows an empty outline
function picFor(item, { aim = false } = {}) {
  const [kind, a, b] = String(item.of || item.id).split(':');
  if (kind === 'buckle') return `<span class="bmk-pic is-buckle${!item.done && aim ? ' is-aim' : ''}">${buckleSVG(item.done || aim ? b : null, a)}</span>`;
  if (kind === 'buy') {
    if (a === 'hat') return `<span class="bmk-pic is-hat">${hatIcon(b)}</span>`;
    if (a === 'horse') return `<span class="bmk-pic" style="color:${COAT[b] || COAT.bay}">${ICON.horse}</span>`;
    if (a === 'dog') return `<span class="bmk-pic" style="color:${DOG_COAT[b] || '#d9873f'}">${ICON.dog}</span>`;
    if (a === 'saddle') return `<span class="bmk-pic is-${b}">${PIC.saddle}</span>`;
    if (a === 'animal') return `<span class="bmk-pic is-animal">${PIC[b] || PIC.hen}</span>`;
    if (a === 'cabin') return `<span class="bmk-pic">${ICON.cabin}</span>`;
    if (a === 'all') return `<span class="bmk-pic">${ICON.coin}</span>`;
    return `<span class="bmk-pic">${PIC.furniture}</span>`;
  }
  if (kind === 'collect') return `<span class="bmk-pic">${a === 'photos' ? PIC.camera : a === 'keepsake' ? PIC.keepsake : PIC.hideout}</span>`;
  if (kind === 'place') return `<span class="bmk-pic">${a.startsWith('camp') ? PIC.camp : a === 'windmill' ? PIC.windmill : PIC.place}</span>`;
  return `<span class="bmk-pic">${PIC.place}</span>`;
}
const jobOf = (id) => JOBS.find((j) => j.id === id);
// (progressLine: "37 / 50" for a count, the gold toward a price for a thing to buy: src/completion.js)
const bar = (pct) => `<span class="bmk-bar"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span>`;

// ── THE "WHAT'S LEFT" PAGE ───────────────────────────────────────────────────────────────────────────────────────
function goalsHtml(rider, pin, { short = false } = {}) {
  const goals = goalsOf(rider);
  if (!goals.length) return pin ? `<p class="bmk-note">Pin up to ${MOST_GOALS} goals for ${esc(rider.name || 'this rider')}: tap <b>Pin</b> by anything below. They show on the rider's card and in the corner while riding.</p>` : '';
  return `<section class="bmk-goals"><h3 class="bmk-h"><span>Goals</span></h3>${goals.map((g) => `<div class="bmk-goal${g.done ? ' is-done' : ''}">
    ${picFor(g, { aim: true })}<div class="bmk-what"><b>${esc(g.name)}</b>${g.done ? '<small>Reached!</small>' : short ? '' : `<small>${esc(g.hint)}</small>`}${g.done ? '' : `<span class="bmk-prog">${bar(g.pct)}<em>${esc(g.line)}</em></span>`}</div>
    ${pin ? `<button type="button" class="bmk-btn" data-unpin="${esc(g.id)}">Unpin</button>` : ''}</div>`).join('')}</section>`;
}
function itemRow(item, { noHint = false } = {}) {
  const prog = item.need > 1 || item.group === 'buy' ? `<span class="bmk-prog">${bar(Math.floor((100 * item.have) / item.need))}<em>${esc(progressLine(item))}</em></span>` : '';
  return `<div class="bmk-row" data-id="${esc(item.id)}">${picFor(item)}<div class="bmk-what"><b>${esc(item.name)}</b>${noHint ? '' : `<small>${esc(item.hint)}</small>`}${prog}</div></div>`;
}
// one row for a job's four buckles: the ones won in their metal, the rest as outlines, and the way to the next (a job
// a grown-up turned off has only its buckles already won on the list: the row says it is off)
function buckleRow(job, items) {
  const byTier = Object.fromEntries(items.map((i) => [i.id.split(':')[2], i]));
  const next = items.find((i) => !i.done), off = items.length < BUCKLES.length;
  const pics = BUCKLES.map((t, k) => { const won = !!(byTier[t] && byTier[t].done); return `<span class="bmk-bk${won ? ' is-won' : ''}" title="${esc(`${BUCKLE_NAMES[t]} at ${fmt(job.at[k])}`)}">${buckleSVG(won ? t : null, job.id)}</span>`; }).join('');
  return `<div class="bmk-row is-job${next ? '' : off ? ' is-off' : ' is-all'}" data-id="${esc(next ? next.id : items[0].id)}"><div class="bmk-bks">${pics}</div>
    <div class="bmk-what"><b>${esc(job.name)}</b>${next
    ? `<small>${esc(next.hint)}</small><span class="bmk-prog">${bar(Math.floor((100 * next.have) / next.need))}<em>${fmt(next.have)} / ${fmt(next.need)} to ${esc(BUCKLE_NAMES[next.id.split(':')[2]].toLowerCase())}</em></span>`
    : off ? '<small>This job is turned off for now: the buckles won stay on the list.</small>' : '<small>All four buckles won!</small>'}</div></div>`;
}
function groupHtml(g) {
  const subs = [];
  for (const i of g.items) { let s = subs.find((x) => x.name === i.sub); if (!s) subs.push(s = { name: i.sub, items: [] }); s.items.push(i); }
  let h = `<section class="bmk-group" data-group="${esc(g.id)}"><h3 class="bmk-h"><span>${esc(g.name)}</span><em>${g.done} / ${g.total}</em>${bar(g.pct)}</h3>`;
  if (g.id === 'buckles') {
    // (the jobs not started yet sit after the ones under way, so what's close comes first)
    const rows = subs.map((s) => ({ s, job: jobOf(s.items[0].id.split(':')[1]) })).filter((x) => x.job);
    const order = (x) => (x.s.items.every((i) => i.done) ? 2 : x.s.items[0].have > 0 ? 0 : 1);
    rows.sort((a, b) => order(a) - order(b));
    h += rows.map(({ s, job }) => buckleRow(job, s.items)).join('');
  } else {
    for (const s of subs) {
      const left = s.items.filter((i) => !i.done), done = s.items.filter((i) => i.done);
      // (the same how-to on every row, like the gang's hideouts: said once, under the heading)
      const same = left.length > 1 && left.every((i) => i.hint === left[0].hint) ? left[0].hint : null;
      h += `<div class="bmk-sub"><h4>${esc(s.name)}${left.length ? '' : ' <span class="bmk-all">all done</span>'}</h4>${same ? `<p class="bmk-subhow">${esc(same)}</p>` : ''}`;
      h += left.map((i) => itemRow(i, { noHint: !!same })).join('');
      if (done.length) h += `<div class="bmk-done">${done.map((i) => `<span>${PIC.tick}${esc(i.name)}</span>`).join('')}</div>`;
      h += '</div>';
    }
  }
  return h + '</section>';
}
function pageHtml(rider) {
  const c = completion(rider);
  return `<header class="bmk-head"><h2 class="bmk-title">What's left</h2>
      <div class="bmk-subtitle">${esc(rider.name || 'Rider')}'s checklist: everything there is to do, buy and find</div>
      <div class="bmk-total"><b>${c.pct}%</b>${bar(c.pct)}<span>${c.done} of ${c.total} done</span></div></header>
    ${goalsHtml(rider, false)}
    ${c.groups.map((g) => groupHtml(g)).join('')}
    ${c.coming.length ? `<p class="bmk-coming">More to come, and they'll join the list when they're here: ${esc(c.coming.join(', '))}.</p>` : ''}`;
}

// ── THE GOAL PICKER ("Set a goal") ───────────────────────────────────────────────────────────────────────────────
// A short list: a row per job (its name, how far to the next buckle, its four buckles as chips), then one row each for
// buying everything, each collection and every place. A row's Pin pins the goal; a buckle chip pins that one buckle.
const FULL = `disabled title="${MOST_GOALS} goals are pinned: unpin one first"`;
function pinBtn(id, pinned, full) {
  return `<button type="button" class="bmk-btn${pinned ? ' is-on' : ''}" data-${pinned ? 'unpin' : 'pin'}="${esc(id)}" ${!pinned && full ? FULL : ''}>${PIC.pin}<span>${pinned ? 'Pinned' : 'Pin'}</span></button>`;
}
function choiceRow(g, { pinnedIds, full }) {
  if (g.tiers) {
    const tier = (id) => id.split(':')[2];
    const chips = g.tiers.map((t) => {
      const name = BUCKLE_NAMES[t.tier], on = pinnedIds.has(t.id);
      if (t.done) return `<span class="bmk-chip is-won" title="${esc(`${name}: won`)}">${buckleSVG(t.tier, g.job)}</span>`;
      return `<button type="button" class="bmk-chip${on ? ' is-on' : ''}" data-${on ? 'unpin' : 'pin'}="${esc(t.id)}" ${!on && full ? FULL : `title="${esc(`${on ? 'Unpin' : 'Pin'} the ${name.toLowerCase()} buckle (${fmt(t.need)})`)}"`} aria-label="${esc(`${name} buckle`)}">${buckleSVG(t.tier, g.job)}</button>`;
    }).join('');
    return `<div class="bmk-choice is-job" data-goal="${esc(g.id)}"><div class="bmk-what"><b>${esc(g.sub)}</b><em>${esc(g.line)} to ${esc(BUCKLE_NAMES[tier(g.of)].toLowerCase())}</em></div>
      <div class="bmk-chips">${chips}</div>${pinBtn(g.id, pinnedIds.has(g.id), full)}</div>`;
  }
  return `<div class="bmk-choice" data-goal="${esc(g.id)}">${picFor(g, { aim: true })}<div class="bmk-what"><b>${esc(g.name)}</b>
    <span class="bmk-prog">${bar(g.pct)}<em>${esc(g.line)}</em></span></div>${pinBtn(g.id, pinnedIds.has(g.id), full)}</div>`;
}
function pickerHtml(rider) {
  const goals = goalsOf(rider), pinnedIds = new Set(goals.map((g) => g.id));
  const opts = { pinnedIds, full: goals.filter((g) => !g.done).length >= MOST_GOALS };
  const list = goalChoices(rider), jobs = list.filter((g) => g.tiers), rest = list.filter((g) => !g.tiers);
  return `<header class="bmk-head"><h2 class="bmk-title">Set a goal</h2>
      <div class="bmk-subtitle">Up to ${MOST_GOALS} goals for ${esc(rider.name || 'this rider')}: they show on the rider's card and in the corner while riding</div></header>
    ${goals.length ? goalsHtml(rider, true, { short: true }) : ''}
    <section class="bmk-pick">
      ${jobs.length ? `<h3 class="bmk-h"><span>Belt buckles</span><em>Pin a job for its next buckle, or tap a buckle</em></h3>${jobs.map((g) => choiceRow(g, opts)).join('')}` : ''}
      ${rest.length ? `<h3 class="bmk-h"><span>Buy, collect and explore</span></h3>${rest.map((g) => choiceRow(g, opts)).join('')}` : ''}
      ${list.length ? '' : '<p class="bmk-note">Everything is done: there is no goal left to pin.</p>'}
    </section>`;
}

export function openWhatsLeft(root, rider, { onClose = () => {}, pin = false, onChange = () => {} } = {}) {
  ensureChecklistCss();
  root = root || document.body;
  const el = document.createElement('div');
  el.className = 'bmk';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', pin ? 'Set a goal' : "What's left");
  el.innerHTML = `<div class="bmk-dim"></div><div class="bmk-card">
    <button class="bmk-x" type="button" aria-label="Close" title="Close (Esc)"><svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
    <div class="bmk-body"></div></div>`;
  const body = el.querySelector('.bmk-body'), card = el.querySelector('.bmk-card');
  const draw = () => { const top = card.scrollTop; body.innerHTML = pin ? pickerHtml(rider) : pageHtml(rider); card.scrollTop = top; };
  draw();
  root.appendChild(el);
  let closed = false;
  const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); P.close(); } };
  const P = {
    el, redraw: draw,
    close() {
      if (closed) return; closed = true;
      removeEventListener('keydown', onKey, true);
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 200);
      try { onClose(); } catch (e) { console.error(e); }
    },
  };
  addEventListener('keydown', onKey, true);
  el.querySelector('.bmk-x').addEventListener('click', () => P.close());
  el.querySelector('.bmk-dim').addEventListener('click', () => P.close());
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-pin], button[data-unpin]'); if (!b || b.disabled) return;
    const changed = b.dataset.pin ? setGoal(rider, b.dataset.pin) : clearGoal(rider, b.dataset.unpin);
    if (changed) { try { onChange(rider); } catch (err) { console.error(err); } }
    draw();
  });
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => { if (!closed) el.querySelector('.bmk-x').focus({ preventScroll: true }); }, 30);
  return P;
}

// ── THE TOAST ────────────────────────────────────────────────────────────────────────────────────────────────────
// One element for the page, a queue, and one toast up at a time. busy() (from makeChecklist) holds the queue while a
// question is up; whatever piled up meanwhile goes up as one toast.
const Q = { list: [], el: null, timer: 0, up: false, busy: () => false, audio: null, pct: null };
function toastEl() {
  if (Q.el && Q.el.isConnected) return Q.el;
  ensureChecklistCss();
  Q.el = document.createElement('div'); Q.el.className = 'bmk-toast'; Q.el.setAttribute('role', 'status'); Q.el.setAttribute('aria-live', 'polite');
  document.body.appendChild(Q.el);
  return Q.el;
}
export function toastUnlock(hud, item, { pct = null, audio = null } = {}) {
  const items = (Array.isArray(item) ? item : [item]).filter(Boolean);
  if (!items.length) return;
  for (const i of items) Q.list.push({ item: i, pct });
  if (audio) Q.audio = audio;
  pump();
}
function pump() {
  clearTimeout(Q.timer);
  if (Q.up || !Q.list.length) return;
  if (Q.busy()) { Q.timer = setTimeout(pump, 300); return; }
  const batch = Q.list.splice(0);
  // a goal reached goes first, on its own; the rest go up together
  const goal = batch.find((b) => b.item.goal);
  if (goal) { const rest = batch.filter((b) => b !== goal); Q.list.unshift(...rest); show([goal]); } else show(batch);
}
const names = (list) => (list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
function show(batch) {
  const el = toastEl(), first = batch[0].item, pct = batch[batch.length - 1].pct;
  const goal = !!first.goal;
  const head = goal ? 'Goal reached!' : batch.length > 1 ? `${batch.length} checked off` : 'Checked off';
  const list = batch.map((b) => b.item.name);
  const text = batch.length > 3 ? `${names(list.slice(0, 3).concat([`${batch.length - 3} more`]))}` : names(list);
  el.className = 'bmk-toast' + (goal ? ' is-goal' : '');
  el.innerHTML = `${picFor({ ...first, done: true })}<span class="bmk-toast-text"><small>${esc(head)}</small><b>${esc(text)}</b></span>${pct != null ? `<span class="bmk-toast-pct"><b>${pct}%</b><small>done</small></span>` : ''}`;
  void el.offsetWidth;   // (so the drop-in plays again for the next one)
  el.classList.add('is-on');
  Q.up = true;
  chime(Q.audio, goal);
  setTimeout(() => {
    el.classList.remove('is-on');
    setTimeout(() => { Q.up = false; pump(); }, TOAST.gap + 300);
  }, TOAST.show);
}
// a soft two-note chime (a goal: four notes up), plucked and short, with a tick of noise on each so it reads as a
// little bell rather than a beep
function chime(audio, big) {
  if (!audio || !audio.ready) return;
  audio.need('checklist', true);
  setTimeout(() => audio.need('checklist', false), 1600);
  audio.ready((ctx, out) => {
    const play = () => {
      if (!audio.running) return;
      const notes = big ? [784, 988, 1175, 1568] : [880, 1319], step = big ? 0.11 : 0.12;
      let t = ctx.currentTime + 0.03;
      const nodes = [];
      for (const [k, f] of notes.entries()) {
        const g = ctx.createGain(), lv = TOAST.level * (k === notes.length - 1 ? 1 : 0.8);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lv, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0004, t + 0.55);
        g.connect(out); nodes.push(g);
        for (const [m, a] of [[1, 1], [2, 0.18], [3.01, 0.06]]) {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
          const og = ctx.createGain(); og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + 0.6); nodes.push(o, og);
        }
        t += step;
      }
      setTimeout(() => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* gone */ } } }, (t - ctx.currentTime + 0.8) * 1000);
    };
    // (the context may be asleep: it wakes on need(), which takes a moment)
    const a = performance.now();
    const wait = () => { if (ctx.state === 'running') play(); else if (performance.now() - a < 700) setTimeout(wait, 40); };
    wait();
  });
}

// ── THE GOALS IN THE CORNER, AND THE RIDE'S CHECKS ───────────────────────────────────────────────────────────────
export function makeChecklist({ hud = null, audio = null, rider, busy = () => false, save = () => {}, world = {} }) {
  ensureChecklistCss();
  Q.busy = busy; Q.audio = audio;
  const corner = document.createElement('div');
  corner.className = 'bmk-corner'; corner.hidden = true;
  document.body.appendChild(corner);
  let last = '';
  // (a phone held upright: just each goal's picture, bar and count, so the box stays small)
  const small = typeof matchMedia === 'function' ? matchMedia('(max-width: 480px)') : { matches: false };
  function drawCorner() {
    const goals = goalsOf(rider);
    const off = !goals.length || (hud && hud.el && hud.el.classList.contains('is-hidden'));
    corner.hidden = !!off;
    if (off) return;
    corner.classList.toggle('is-small', small.matches);
    const html = `<div class="bmk-corner-h">${goals.length > 1 ? 'Goals' : 'Goal'}</div>` + goals.map((g) => `<div class="bmk-cg${g.done ? ' is-done' : ''}" title="${esc(g.name)}">${picFor(g, { aim: true })}
      <div class="bmk-cg-what"><b>${esc(g.name)}</b><span class="bmk-prog">${bar(g.pct)}<em>${g.done ? 'Reached!' : esc(g.line.replace(/ gold$/, ''))}</em></span></div></div>`).join('');
    if (html !== last) { corner.innerHTML = html; last = html; }
    placeCorner();
  }
  // under the Menu button; when the job's card (or the line under it) reaches across to it, as on a phone or a narrow
  // window, the box moves down under the card instead
  function placeCorner() {
    if (corner.hidden) return;
    const job = hud && hud.jobEl, base = innerWidth <= 760 || innerHeight <= 480 ? 52 : 62;
    let top = base;
    if (job) {
      const r = job.getBoundingClientRect(), left = innerWidth - corner.offsetWidth - 20;
      if (r.height > 2 && r.right > left && r.top < base + corner.offsetHeight) top = Math.max(base, Math.round(r.bottom + 8));
    }
    if (corner.style.top !== top + 'px') corner.style.top = top + 'px';
  }
  const watchJob = hud && hud.jobEl && typeof ResizeObserver === 'function' ? new ResizeObserver(() => placeCorner()) : null;
  if (watchJob) watchJob.observe(hud.jobEl);
  function check() {
    if (!rider) return;
    const first = !Array.isArray(rider.done);
    const fresh = unlocked(rider);
    if (first || fresh.length) save();
    if (fresh.length) toastUnlock(hud, fresh, { pct: completion(rider).pct, audio });
    drawCorner();
  }
  function look() {
    try {
      const changed = notice(rider, { place: world.place ? world.place() : null, hideout: world.hideout ? world.hideout() : null, home: world.home ? !!world.home() : false });
      if (changed) save();
      check();
    } catch (e) { console.warn('checklist: could not look', e); }
  }
  const timer = setInterval(look, TOAST.look);
  check();
  return {
    check, corner,
    dispose() {
      clearInterval(timer); corner.remove(); if (watchJob) watchJob.disconnect();
      // (toasts still waiting are let go with the ride; one up finishes on its own)
      Q.list.length = 0; Q.busy = () => false;
    },
  };
}
