// stats.js: a rider's stats page. First THE PLACES (src/levels/model.js: each place in the game has one kind of math and
// one ladder of levels): how far up its ladder the rider is, the level they're on, how many of the last answers were
// right and a small line day by day, with the levels page (src/ui/levels.js) a tap away from each. Then THE KINDS OF
// MATH, by school year: each kind (a strand, src/math/strands.js) with its level as a bar, what the
// rider is working on there, how many of the last answers were right, the average time an answer takes (sit-down
// questions only: lock boxes, the store's slips) and a small line of the level day by day; the rider's completion
// (src/completion.js, when the game has it); and a few totals.
//
//   const page = openStats(root, rider, { onClose, face, completion, whatsLeft })
//   page.close()
//     root        where the page goes (document.body; it covers the screen, z-index 50: over the title, the pause menu
//                 and the counters, under the lock box)
//     face        the rider's face as an SVG string (title.js faceSVG), for the header
//     completion  the src/completion.js module, if the caller has it; else it is loaded here (and left out if the game
//                 has none yet)
//     whatsLeft   (rider) -> void: what "What's left" does; else src/ui/completion.js openWhatsLeft is used, this page
//                 closing first and coming back when that one closes
//   Esc, the close button or a click on the dark backdrop closes it (onClose is called once).
//
// The numbers come from src/math/skill.js (stats, meaning) and the rider's saved strands; nothing here changes the
// rider (the levels page it opens can: ticks and "Start here"). Pure helpers for the tests: placeRows(rider),
// statRows(rider), overview(rider), fmtTime(ms), spark(history, w, h), lately(s).

import { stats as strandStats, meaning, STRANDS } from '../math/skill.js';
import { placeStats, stateOf } from '../levels/model.js';
import { PLACE } from '../levels/places.js';
import { openLevels, picSVG } from './levels.js';

const DAY = 86400000;
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const strandsOf = (rider) => (isObj(rider) && isObj(rider.skill) && isObj(rider.skill.strands) ? rider.skill.strands : {});

// ---- the numbers (pure) ------------------------------------------------------------------------------------------

// How long an answer takes, in words: '4.2 s', '23 s', '1 min 5 s'.
export function fmtTime(ms) {
  const s = Number(ms) / 1000;
  if (!Number.isFinite(s) || s <= 0) return '';
  if (s < 9.95) return `${s.toFixed(1)} s`;
  if (s < 59.5) return `${Math.round(s)} s`;
  const m = Math.floor(Math.round(s) / 60), r = Math.round(s) % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

// The share right of a strand's last answers: { right, of } (of = 0 before any).
export function lately(s) {
  const h = isObj(s) && Array.isArray(s.h) ? s.h : [];
  return { right: h.reduce((a, x) => a + (Array.isArray(x) && x[0] ? 1 : 0), 0), of: h.length };
}

// The calendar day number (skill.js dayOf) back to a date, for "since Oct 3".
function dayDate(day) { return new Date(day * DAY + new Date(day * DAY).getTimezoneOffset() * 60000); }
function shortDate(day) { return dayDate(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

// The small line of a strand's level day by day, as SVG points in a w x h box. Days are spaced by the calendar (a week
// away shows as a gap), and the height fits the line's own range (at least 20 points tall, so a small wobble stays
// small). -> { points: 'x,y x,y ...', last: [x, y], one: true when there is a single day }
export function spark(history, w = 120, h = 28) {
  const pts = (Array.isArray(history) ? history : []).filter((p) => p && Number.isFinite(p.day) && Number.isFinite(p.pct));
  if (!pts.length) return { points: '', last: null, one: false };
  const pad = 3;
  if (pts.length === 1) { const y = h / 2; return { points: `${pad},${y} ${w - pad},${y}`, last: [w - pad, y], one: true }; }
  const d0 = pts[0].day, d1 = pts[pts.length - 1].day, span = Math.max(1, d1 - d0);
  let lo = Math.min(...pts.map((p) => p.pct)), hi = Math.max(...pts.map((p) => p.pct));
  if (hi - lo < 20) { const mid = (hi + lo) / 2; lo = mid - 10; hi = mid + 10; }
  const X = (d) => pad + ((d - d0) / span) * (w - 2 * pad);
  const Y = (v) => h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad);
  const xy = pts.map((p) => [Math.round(X(p.day) * 10) / 10, Math.round(Y(p.pct) * 10) / 10]);
  return { points: xy.map((p) => p.join(',')).join(' '), last: xy[xy.length - 1], one: false };
}

// Has the rider shown anything in a strand yet: an answer, a level placed, or progress read from earlier rides? (A job
// that only looked a strand up, to choose its question, meets it with a starting guess: that is not a level to show.)
function shown(x, s) { return x.answered > 0 || x.placed || (isObj(s) && s.old === true); }

// One row a strand the rider has shown something in, in the registry's order: skill.js stats() plus what the rider is
// working on, the last answers, the time per answer and the change over the days kept.
export function statRows(rider) {
  const raw = strandsOf(rider);
  return strandStats(rider).filter((x) => shown(x, raw[x.strand])).map((x) => {
    const s = raw[x.strand] || {};
    const l = lately(s);
    const h = x.history || [];
    const first = h[0], last = h[h.length - 1];
    return {
      ...x,
      working: meaning(x.strand, x.pct),
      lately: l,
      time: x.avgMs ? fmtTime(x.avgMs) : '',
      timed: Array.isArray(s.t) ? s.t.length : 0,
      change: first && last && h.length > 1 ? { by: last.pct - first.pct, since: first.day } : null,
      old: s.old === true && !x.answered,
      lastAt: Number(s.last) || 0,
      // only light extra credits so far (a share story far above a young rider, say): a little practice, but the
      // level itself hasn't been looked for yet, so the row doesn't say "Finding the level" for ever
      light: !!(x.finding && x.answered > 0 && Number.isFinite(x.counted) && x.counted === 0),
    };
  });
}

// One row a place the rider has played (or brought from an earlier ride's save), in the levels page's order: how far
// up its ladder (pct), the level on (its number and title), placement still running, the last answers, the change
// over the days kept, and what a grown-up set (levels skipped, "Start here"). -> rows, and `unplayed`: the other places
export function placeRows(rider) {
  const all = placeStats(rider, { all: true });
  const rows = all.filter((x) => x.pct != null && (x.answered > 0 || (stateOf(rider, x.place) || {}).old)).map((x) => {
    const P = PLACE[x.place], s = stateOf(rider, x.place) || {};
    const k = P.levels.findIndex((L) => L.id === x.id);
    const h = x.history || [], first = h[0], last = h[h.length - 1];
    const set = [];
    if (x.off.length) set.push(`${x.off.length} level${x.off.length === 1 ? '' : 's'} skipped`);
    if (x.start) { const j = P.levels.findIndex((L) => L.id === x.start); if (j >= 0) set.push(`started at level ${j + 1}`); }
    return {
      ...x, line: P.line, n: k + 1, of: P.levels.length,
      lately: { right: (s.h || []).reduce((a, y) => a + (y && y[0] ? 1 : 0), 0), of: (s.h || []).length },
      time: x.avgMs ? fmtTime(x.avgMs) : '',
      change: first && last && h.length > 1 ? { by: last.pct - first.pct, since: first.day } : null,
      old: s.old === true && !x.answered, set,
    };
  });
  const seen = new Set(rows.map((x) => x.place));
  rows.unplayed = all.filter((x) => !seen.has(x.place)).map((x) => ({ place: x.place, name: x.name, short: x.short }));
  return rows;
}

// The totals across every strand: answers on the jobs (the rider's all-time count; save.js recordAnswer), right in the
// last 50 of them, the lock boxes solved (each one answer, counted apart: save.js recordLockbox), the average time of a
// sit-down answer, the days played, and the strands not tried yet.
export function overview(rider) {
  const raw = strandsOf(rider), st = isObj(rider && rider.stats) ? rider.stats : {};
  const times = [], days = new Set();
  const rows = new Set(statRows(rider).map((x) => x.strand));   // (a strand only looked up, with no answer, counts for nothing)
  for (const id of rows) {
    const s = isObj(raw[id]) ? raw[id] : {};
    for (const t of Array.isArray(s.t) ? s.t : []) if (Array.isArray(t) && Number(t[0]) > 0) times.push(Number(t[0]));
    for (const d of Array.isArray(s.days) ? s.days : []) if (Array.isArray(d) && Number.isFinite(+d[0])) days.add(+d[0]);
  }
  const recent = Array.isArray(st.recent) ? st.recent : [];
  return {
    answered: Math.max(0, Math.round(Number(st.answered) || 0)),
    boxes: Math.max(0, Math.round(Number(st.boxes) || 0)),
    recent: { right: recent.reduce((a, b) => a + (b ? 1 : 0), 0), of: recent.length },
    avgMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    days: days.size,
    unmet: STRANDS.filter((d) => !rows.has(d.id)).map((d) => ({ id: d.id, name: d.name })),
  };
}

// ---- the page ----------------------------------------------------------------------------------------------------

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
const pctOf = (v) => Math.max(0, Math.min(100, Number(v) || 0));

const X_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const COMPASS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.6 8.4l-2.2 5-5 2.2 2.2-5z" fill="currentColor"/></svg>';

let cssAsked = false;
function ensureCss() {
  if (cssAsked || typeof document === 'undefined') return;
  cssAsked = true;
  const href = new URL('./stats.css', import.meta.url).href;
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.href === href)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = href;
  document.head.appendChild(link);
}

function rowHTML(x) {
  const sp = spark(x.history, 116, 26);
  const line = sp.points
    ? `<svg class="bmst-spark" viewBox="0 0 116 26" aria-hidden="true"><polyline points="${sp.points}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>${sp.last ? `<circle cx="${sp.last[0]}" cy="${sp.last[1]}" r="2.6" fill="currentColor"/>` : ''}</svg>`
    : '';
  const ch = x.change;
  const chText = ch ? (ch.by > 0 ? `up ${ch.by} since ${shortDate(ch.since)}` : ch.by < 0 ? `down ${-ch.by} since ${shortDate(ch.since)}` : `steady since ${shortDate(ch.since)}`)
    : x.history.length === 1 ? 'first day' : '';
  const facts = [];
  if (x.lately.of) facts.push(`${x.lately.right} of ${x.lately.of} right lately`);
  else facts.push(x.old ? 'from earlier rides' : 'no answers yet');
  if (x.time) facts.push(`${x.time} an answer`);
  const tag = x.light ? 'A little practice so far' : x.finding ? 'Finding the level' : '';
  const said = `${x.name}: ${x.pct}%${tag ? `, ${tag.toLowerCase()}` : ''}. Working on ${x.working}. ${facts.join(', ')}. ${chText}`;
  return `<li class="bmst-row${x.finding ? ' is-finding' : ''}" aria-label="${esc(said)}">
      <div class="bmst-top"><b class="bmst-name">${esc(x.name)}</b>${tag ? `<span class="bmst-tag">${COMPASS}${tag}</span>` : ''}<span class="bmst-pct">${x.pct}%</span></div>
      <div class="bmst-bar" aria-hidden="true"><i style="width:${pctOf(x.pct)}%"></i></div>
      <div class="bmst-work">Working on: ${esc(x.working)}</div>
      <div class="bmst-meta"><span class="bmst-facts">${facts.map(esc).join(' · ')}</span>
        <span class="bmst-trend">${line}<small>${esc(chText)}</small></span></div>
    </li>`;
}

function placeHTML(x) {
  const sp = spark(x.history, 116, 26);
  const line = sp.points
    ? `<svg class="bmst-spark" viewBox="0 0 116 26" aria-hidden="true"><polyline points="${sp.points}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>${sp.last ? `<circle cx="${sp.last[0]}" cy="${sp.last[1]}" r="2.6" fill="currentColor"/>` : ''}</svg>`
    : '';
  const ch = x.change;
  const chText = ch ? (ch.by > 0 ? `up ${ch.by} since ${shortDate(ch.since)}` : ch.by < 0 ? `down ${-ch.by} since ${shortDate(ch.since)}` : `steady since ${shortDate(ch.since)}`)
    : x.history.length === 1 ? 'first day' : '';
  const facts = [];
  if (x.lately.of) facts.push(`${x.lately.right} of ${x.lately.of} right lately`);
  else facts.push(x.old ? 'from earlier rides' : 'no answers yet');
  if (x.time) facts.push(`${x.time} an answer`);
  const tag = x.finding ? 'Finding the level' : '';
  const said = `${x.name}, ${x.math}: ${x.pct}%${tag ? `, ${tag.toLowerCase()}` : ''}. Level ${x.n} of ${x.of}, ${x.title}. ${facts.join(', ')}. ${x.set.join(', ')}. ${chText}`;
  return `<li class="bmst-row bmst-placerow${x.finding ? ' is-finding' : ''}" aria-label="${esc(said)}">
      <div class="bmst-top"><span class="bmst-pic" aria-hidden="true">${picSVG(x.pic)}</span><b class="bmst-name">${esc(x.short)}</b><span class="bmst-kind">${esc(x.math)}</span>${tag ? `<span class="bmst-tag">${COMPASS}${tag}</span>` : ''}<span class="bmst-pct">${x.pct}%</span></div>
      <div class="bmst-bar" aria-hidden="true"><i style="width:${pctOf(x.pct)}%"></i></div>
      <div class="bmst-work">Level ${x.n} of ${x.of}: ${esc(x.title)}${x.set.length ? ` <span class="bmst-set">(${esc(x.set.join(', '))})</span>` : ''}</div>
      <div class="bmst-meta"><span class="bmst-facts">${facts.map(esc).join(' · ')}<button type="button" class="bmst-lv" data-do="levels" data-place="${esc(x.place)}">Levels</button></span>
        <span class="bmst-trend">${line}<small>${esc(chText)}</small></span></div>
    </li>`;
}

function completionHTML(c) {
  if (!c) return '';
  const groups = (Array.isArray(c.groups) ? c.groups : []).map((g) => `
      <div class="bmst-grp"><span>${esc(g.name)}</span><em>${fmt(g.done)} / ${fmt(g.total)}</em><span class="bmst-minibar"><i style="width:${pctOf(g.pct)}%"></i></span></div>`).join('');
  return `<section class="bmst-tile bmst-comp" aria-label="Completion ${pctOf(c.pct)}%">
      <div class="bmst-k">Completion</div>
      <div class="bmst-v">${Math.round(pctOf(c.pct))}<small>%</small></div>
      <div class="bmst-bar"><i style="width:${pctOf(c.pct)}%"></i></div>
      ${groups ? `<div class="bmst-grps">${groups}</div>` : ''}
      <button type="button" class="bmst-btn" data-do="left">What's left</button>
    </section>`;
}

export function openStats(root, rider, opts = {}) {
  ensureCss();
  root = root || document.body;
  const onClose = typeof opts.onClose === 'function' ? opts.onClose : () => {};
  const back = document.activeElement;
  let comp = isObj(opts.completion) ? opts.completion : null, closed = false;

  const el = document.createElement('div');
  el.className = 'bmst';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', `${rider && rider.name ? rider.name : 'Rider'}'s stats`);
  root.appendChild(el);

  function draw() {
    const rows = statRows(rider), ov = overview(rider), places = placeRows(rider);
    let c = null;
    try { c = comp && typeof comp.completion === 'function' ? comp.completion(rider) : null; } catch (e) { console.warn('Bandit Math: completion could not be read', e); }
    const tiles = `
      ${completionHTML(c)}
      <section class="bmst-tile"><div class="bmst-k">Answers</div><div class="bmst-v">${fmt(ov.answered + ov.boxes)}</div>
        <div class="bmst-s">${ov.boxes ? `${fmt(ov.boxes)} lock box${ov.boxes === 1 ? '' : 'es'} among them${ov.recent.of ? '<br>' : ''}` : ''}${ov.recent.of
          ? `${ov.boxes ? 'Jobs: ' : ''}${ov.recent.right} of the last ${ov.recent.of} right` : ov.boxes ? '' : 'none yet'}</div></section>
      <section class="bmst-tile"><div class="bmst-k">Average answer</div><div class="bmst-v">${ov.avgMs ? esc(fmtTime(ov.avgMs)) : '–'}</div>
        <div class="bmst-s">${ov.avgMs ? 'lock boxes and the store’s slips' : 'timed at lock boxes and the store'}</div></section>
      <section class="bmst-tile"><div class="bmst-k">Days played</div><div class="bmst-v">${ov.days || !(ov.answered + ov.boxes) ? fmt(ov.days) : '–'}</div>
        <div class="bmst-s">${ov.days || !(ov.answered + ov.boxes) ? '' : 'counted from the next ride on · '}${rows.length ? `${rows.length} kind${rows.length === 1 ? '' : 's'} of math so far` : 'just starting'}</div></section>`;
    const list = rows.length
      ? `<ul class="bmst-rows">${rows.map(rowHTML).join('')}</ul>`
      : `<p class="bmst-empty">${COMPASS}<span>Nothing answered yet. The game finds the level of each kind of math by itself the first time it comes up, so the first few questions may feel too easy or too hard for a minute.</span></p>`;
    const placeList = places.length
      ? `<ul class="bmst-rows">${places.map(placeHTML).join('')}</ul>${places.unplayed.length ? `<p class="bmst-unmet"><b>Not played yet:</b> ${places.unplayed.map((u) => esc(u.short)).join(' · ')}</p>` : ''}`
      : `<p class="bmst-empty">${COMPASS}<span>No place played yet. Each place finds your level on its own ladder the first time you play there: one level up for every right answer.</span></p>`;
    const unmet = ov.unmet.length && rows.length
      ? `<p class="bmst-unmet"><b>Not tried yet:</b> ${ov.unmet.map((u) => esc(u.name)).join(' · ')}</p>` : '';
    el.innerHTML = `<div class="bmst-card">
      <header class="bmst-head">
        ${opts.face ? `<span class="bmst-face">${opts.face}</span>` : ''}
        <div><h2>${esc(rider && rider.name ? rider.name : 'Rider')}<span>’s stats</span></h2>
          <p>Each place’s % is how far up its own ladder of levels you are. The kinds of math below go by school year: 0% is starting kindergarten, 100% the end of algebra 1.</p></div>
        <button type="button" class="bmst-btn bmst-levels" data-do="levels">Levels</button>
        <button type="button" class="bmst-x" data-do="close" aria-label="Close">${X_ICON}</button>
      </header>
      <div class="bmst-tiles">${tiles}</div>
      <h3 class="bmst-h">Places</h3>
      ${placeList}
      <h3 class="bmst-h bmst-h2">Kinds of math</h3>
      ${list}
      ${unmet}
      <p class="bmst-how">The game keeps each level where about 4 answers in 5 are right: a right answer moves it up a little, a miss moves it down a bit more. So a level dipping after a few misses is the game finding the right questions, not a step back. Quick answers count double only from x on both sides at the lock boxes and from dollars and cents at the store.</p>
    </div>`;
  }

  // (handing over to the what's-left page: no onClose yet, it comes when this page, opened again after it, closes)
  function close(handover = false) {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    el.remove();
    if (handover) return;
    try { if (back && back.focus && document.contains(back)) back.focus({ preventScroll: true }); } catch (e) { /* the opener is gone */ }
    try { onClose(); } catch (e) { console.error(e); }
  }
  function whatsLeft() {
    if (typeof opts.whatsLeft === 'function') { close(); opts.whatsLeft(rider); return; }
    import('./completion.js').then((m) => {
      if (closed || typeof m.openWhatsLeft !== 'function') return;
      close(true);
      m.openWhatsLeft(root, rider, { onClose: () => openStats(root, rider, opts) });
    }).catch((e) => console.warn('Bandit Math: the what\'s-left page is not there yet', e));
  }
  // Esc closes this page only (the title's and the game's own Esc handlers never see it)
  function onKey(e) {
    if (e.key !== 'Escape' || document.querySelector('.bmlv')) return;   // (the levels page open over this one: its Esc)
    e.preventDefault(); e.stopPropagation();
    close();
  }
  document.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (e) => {
    if (e.target === el) { close(); return; }
    const b = e.target.closest('[data-do]');
    if (!b) return;
    if (b.dataset.do === 'close') close();
    else if (b.dataset.do === 'left') whatsLeft();
    else if (b.dataset.do === 'levels') {
      // the levels page over this one (z 52); this page draws again with any change when it closes
      openLevels(root, rider, { place: b.dataset.place || undefined, speak: opts.speak, onChange: opts.onChange,
        onClose: () => { if (closed) return; draw(); const f = el.querySelector(b.dataset.place ? `[data-do="levels"][data-place="${b.dataset.place}"]` : '.bmst-levels'); if (f) f.focus({ preventScroll: true }); } });
    }
  });

  draw();
  if (!comp) {
    import('../completion.js').then((m) => {
      if (closed || typeof m.completion !== 'function') return;
      comp = m;
      const had = el.contains(document.activeElement);
      draw();
      if (had) { const x = el.querySelector('.bmst-x'); if (x) x.focus({ preventScroll: true }); }
    }).catch(() => { /* the game has no completion yet: the page leaves it out */ });
  }
  const x = el.querySelector('.bmst-x');
  if (x) x.focus({ preventScroll: true });
  return { el, close, redraw: draw };
}
