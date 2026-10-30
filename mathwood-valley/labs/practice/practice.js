// practice.js: the practice page. Tabs per place; each place's levels; a level's questions as cards with the real
// choices (cards.js makes them with the game's own makers); and an adaptive mode with a throwaway rider (never saved)
// driven by the game's own level model (src/levels/model.js), to watch placement and the 80% staircase.
//
// URL: ?place=roundup&level=by5&seed=123&into=2 opens that card; &mode=adaptive opens the adaptive mode.

import { PLACES, PLACE } from '../../src/levels/places.js';
import { levelFor, recordLevel, stateOf, pctOf } from '../../src/levels/model.js';
import { STRAND } from '../../src/math/strands.js';
import { makeCard, cardText, LAB_CHOICES } from './cards.js';
import { makeQuestion } from '../../src/math/graphs.js';
import { openGraphCard } from '../../src/ui/graphcard.js';
import { seeded } from '../../src/levels/kit.js';

const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
};
const newSeed = () => 1 + Math.floor(Math.random() * 999999);
const isLab = (placeId, levelId) => (LAB_CHOICES[placeId] || []).includes(levelId);

// ---- state ----------------------------------------------------------------------------------------------------------

const qs = new URLSearchParams(location.search);
const S = {
  place: PLACE[qs.get('place')] ? qs.get('place') : PLACES[0].id,
  mode: qs.get('mode') === 'adaptive' ? 'adaptive' : 'levels',
  level: null, seed: null, into: null,
  riders: {},   // placeId -> { rider, log: [], age }
};
if (qs.get('level') && PLACE[S.place].levels.some((L) => L.id === qs.get('level'))) {
  S.level = qs.get('level');
  S.seed = Number(qs.get('seed')) || newSeed();
  S.into = qs.get('into') != null && qs.get('into') !== '' ? Number(qs.get('into')) : null;
}

function syncUrl() {
  const p = new URLSearchParams();
  p.set('place', S.place);
  if (S.mode === 'adaptive') p.set('mode', 'adaptive');
  else if (S.level) { p.set('level', S.level); p.set('seed', S.seed); if (S.into != null) p.set('into', S.into); }
  try { history.replaceState(null, '', `${location.pathname}?${p}`); } catch (e) { /* (a file: page) */ }
}
const cardUrl = (c) => `${location.origin}${location.pathname}?place=${c.place}&level=${c.level}&seed=${c.seed}&into=${c.into}`;

// ---- theme -----------------------------------------------------------------------------------------------------------

function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  const dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  $('#theme').textContent = dark ? 'Light' : 'Dark';
}
let theme = null;
try { theme = localStorage.getItem('bm-practice-theme'); } catch (e) { /* */ }
applyTheme(theme);
$('#theme').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('bm-practice-theme', theme); } catch (e) { /* */ }
  applyTheme(theme);
});

// ---- toast and copy ---------------------------------------------------------------------------------------------------

let toastT = 0;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied the card: paste it anywhere'); return; } catch (e) { /* fall back */ }
  const ta = h('textarea', { style: 'position:fixed;left:-9999px;top:0' }); ta.value = text; document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* */ }
  ta.remove();
  if (ok) toast('Copied the card: paste it anywhere'); else window.prompt('Copy this:', text);
}

// ---- tabs -------------------------------------------------------------------------------------------------------------

function renderTabs() {
  const nav = $('#tabs'); nav.textContent = '';
  for (const P of PLACES) {
    nav.append(h('button', { class: 'tab', type: 'button', 'aria-selected': P.id === S.place ? 'true' : 'false',
      onclick: () => { if (S.place === P.id) return; S.place = P.id; S.level = null; S.into = null; render(); window.scrollTo(0, 0); } }, P.short));
  }
}

// ---- a card -----------------------------------------------------------------------------------------------------------
// renderCard(card, { onDone(right, shown) }) -> element. The parts come one after another; a part is right when it
// was got with no wrong tap. The card is right when every part was; "Show answer" makes it shown (no answer, as in
// the game a card answered after the help is practice).

function renderCard(c, { onDone = null, title = null } = {}) {
  const P = PLACE[c.place], L = P.levels.find((x) => x.id === c.level), li = P.levels.indexOf(L);
  const el = h('article', { class: 'card paper' });
  el.append(h('div', { class: 'card-top' },
    h('span', { class: 'lvl' }, title || `${li + 1}. ${L.title} `, h('small', {}, ` ${P.short}`)),
    h('span', { class: 'seed' }, `seed ${c.seed} · into ${c.into}`)));
  if (c.story) el.append(h('p', { class: 'story' }, c.story));
  if (c.pic) el.append(h('div', { class: 'picwrap', html: c.pic }));
  const partsEl = h('div', { class: 'parts' });
  el.append(partsEl);
  if (c.lab) el.append(h('p', { class: 'labnote' }, 'The game solves this box with moves; these answer choices are made by the practice page.'));
  if (c.kind) el.append(h('p', { class: 'how' }, `customer: ${c.kind}`));

  let shown = false, allRight = true, finished = false;
  const tools = h('div', { class: 'tools' });
  const showBtn = h('button', { class: 'link', type: 'button', onclick: () => { shown = true; cur && cur.reveal(); } }, 'Show answer');
  const hintBtn = h('button', { class: 'link', type: 'button', onclick: () => cur && cur.hint() }, 'Hint');
  tools.append(showBtn, hintBtn,
    h('button', { class: 'link warn', type: 'button', onclick: () => copy(`${cardText(c, P, L)}\n${cardUrl(c)}`) }, 'Confusing?'));
  el.append(tools);

  let cur = null;
  const next = (k) => {
    if (k >= c.parts.length) { finished = true; showBtn.disabled = true; hintBtn.disabled = true; if (onDone) onDone(allRight && !shown, shown); return; }
    cur = renderPart(c.parts[k], c.parts.length > 1 ? k + 1 : 0, (right) => { if (!right) allRight = false; next(k + 1); });
    partsEl.append(cur.el);
  };
  next(0);
  el.cardDone = () => finished;
  return el;
}

function renderPart(p, num, done) {
  const el = h('div', { class: 'part' });
  el.append(h('p', { class: 'ask' }, num ? `${num}. ` : '', p.ask));
  const how = p.mode === 'many' ? 'Tap every right one.' : p.mode === 'order' ? 'Tap them in order.' : '';
  if (how) el.append(h('p', { class: 'how' }, how));
  const box = h('div', { class: 'choices' });
  const say = h('div', { class: 'say', hidden: true });
  el.append(box, say);
  let wrongs = 0, over = false, k = 0;
  const picked = [];
  const btns = p.choices.map((ch, i) => h('button', { class: 'ch', type: 'button', onclick: () => tap(i) }, ch.label));
  box.append(...btns);
  const goods = p.choices.map((x, i) => i).filter((i) => p.choices[i].good);
  const left = () => goods.filter((i) => !btns[i].classList.contains('right'));

  function tell(cls, head, why, ans) {
    say.hidden = false; say.className = `say ${cls}`; say.textContent = '';
    say.append(h('b', {}, head));
    if (why) say.append(h('span', { class: 'why' }, why));
    if (ans) say.append(h('span', { class: 'ans' }, ans));
  }
  function finish() {
    if (over) return;
    over = true; btns.forEach((b) => (b.disabled = true));
    const ok = wrongs === 0;
    let extra = p.right && p.right !== p.answer ? p.right : '';
    if (!ok && lastWhy && extra.includes(lastWhy)) extra = extra.replace(lastWhy, '').replace(/^[\s·]+|[\s·]+$/g, '');
    if (ok) tell('ok', 'Right!', '', extra);
    else tell('no', 'Done, with a miss.', lastWhy, `The answer: ${p.answer}${extra ? ` · ${extra}` : ''}`);
    done(ok);
  }
  let lastWhy = '';
  function tap(i) {
    if (over) return;
    const ch = p.choices[i];
    if (p.mode === 'order') {
      if (i === p.order[k]) { btns[i].classList.add('right'); btns[i].disabled = true; btns[i].append(h('span', { class: 'ord' }, String(k + 1))); picked.push(i); k++; if (k >= p.order.length) finish(); else say.hidden = true; }
      else { wrongs++; lastWhy = p.whyAt ? p.whyAt(i, picked) : ''; tell('no', 'Not that one yet.', lastWhy, ''); }
      return;
    }
    if (p.mode === 'one') {
      if (ch.good) btns[i].classList.add('right');
      else { wrongs++; lastWhy = ch.why; btns[i].classList.add('wrong'); goods.forEach((g) => btns[g].classList.add('right')); }
      finish();
      return;
    }
    // many: every right one, the misses explained as they come
    if (ch.good) { btns[i].classList.add('right'); btns[i].disabled = true; if (!left().length) finish(); else if (!wrongs) say.hidden = true; }
    else { wrongs++; lastWhy = ch.why; btns[i].classList.add('wrong'); btns[i].disabled = true; tell('no', 'Not that one.', ch.why, `${left().length} more to find`); }
  }
  return {
    el,
    hint() { if (!over) tell('', 'Hint', p.help || 'No hint from the game for this one.', ''); },
    reveal() {
      if (over) return;
      if (p.mode === 'order') p.order.forEach((i, n) => { if (!btns[i].classList.contains('right')) { btns[i].classList.add('shown'); btns[i].append(h('span', { class: 'ord' }, String(n + 1))); } });
      else goods.forEach((g) => btns[g].classList.add('shown'));
      wrongs = Math.max(1, wrongs);
      over = true; btns.forEach((b) => (b.disabled = true));
      tell('', 'The answer', '', `${p.answer}${p.right && p.right !== p.answer ? ` · ${p.right}` : ''}`);
      done(false);
    },
  };
}

// ---- the Professor's chalkboard (graphs): the game's own graph card in the card column ---------------------------------
// The grid is tapped, not answered from a list, so the card is the game's (src/ui/graphcard.js), a sitting of five as at
// the saloon's chalkboard, placed in the page instead of over the valley. Put away or finished: a fresh sitting.
let GC = null;   // the graph card up now (closed quietly before the page is drawn again)
function graphSitting(host, { gen, seed, title, record = () => {}, onClose = () => {} }) {
  const rand = seeded(seed >>> 0), avoid = new Set();
  host.classList.add('graphhost');
  const C = openGraphCard({ parent: host, title,
    next: (i) => { const q = makeQuestion(gen(), rand, { i, avoid }); avoid.add(`${q.x},${q.y}`); return q; },
    record: (q, right) => record(right),
    onDone: () => 'Splendid! Five done.',
    onClose: () => { if (GC !== C) return; GC = null; onClose(); } });
  GC = C;
  return C;
}

// ---- the levels mode --------------------------------------------------------------------------------------------------

function levelRow(P, L, i, onPick, current) {
  const st = STRAND[L.strand];
  return h('li', {}, h('button', { class: 'lv', type: 'button', 'aria-current': current ? 'true' : 'false', onclick: onPick },
    h('span', { class: 'n' }, String(i + 1)),
    h('span', { class: 't' }, L.title, isLab(P.id, L.id) ? h('span', { class: 'lab', title: 'answer choices made by the practice page' }, 'lab choices') : null),
    h('span', {}, h('span', { class: 'l' }, L.line), h('br'), h('span', { class: 'g' }, `${L.id} · ${st ? st.name || L.strand : L.strand} ${L.grade} · ${L.count || 5} to pass`))));
}

function renderLevels(root, P) {
  const cols = h('div', { class: 'cols' });
  const list = h('ul', { class: 'levels paper' });
  P.levels.forEach((L, i) => list.append(levelRow(P, L, i, () => {
    S.level = L.id; S.seed = newSeed(); S.into = null; render();
    if (matchMedia('(max-width: 760px)').matches) setTimeout(() => $('#cardcol') && $('#cardcol').scrollIntoView({ block: 'start' }), 30);
  }, L.id === S.level)));
  const right = h('div', { id: 'cardcol' });
  cols.append(list, right);
  root.append(cols);
  if (!S.level) { right.append(h('div', { class: 'paper empty' }, 'Pick a level to see its questions.')); return; }
  if (P.id === 'graphs') {
    const L = P.levels.find((x) => x.id === S.level), li = P.levels.indexOf(L), host = h('div', {});
    right.append(host, h('p', { class: 'how' }, `${li + 1}. ${L.title}: five a sitting, as at the saloon's chalkboard. "Show me" walks the grid; "Not now" starts a fresh five.`));
    graphSitting(host, { gen: () => L.gen, seed: S.seed, title: `${li + 1}. ${L.title}`, onClose: () => { S.seed++; render(); } });
    return;
  }
  let c;
  try { c = makeCard(P.id, S.level, S.seed, { into: S.into }); }
  catch (e) { console.error(e); right.append(h('div', { class: 'paper empty' }, `This level failed to make a question: ${e.message}`)); return; }
  right.append(renderCard(c));
  right.append(h('div', { class: 'bar' },
    h('button', { class: 'btn', type: 'button', onclick: () => { S.seed = S.seed + 1; S.into = null; render(); } }, 'Next'),
    h('button', { class: 'btn alt', type: 'button', onclick: () => { S.seed = newSeed(); S.into = null; render(); } }, 'New examples')));
}

// ---- the adaptive mode ------------------------------------------------------------------------------------------------

const T0 = Date.UTC(2026, 0, 5, 15);
function riderOf(placeId) {
  if (!S.riders[placeId]) S.riders[placeId] = { rider: { skill: { v: 1, migrated: 1, strands: {} } }, log: [], age: '', clock: 0, seed: newSeed() };
  return S.riders[placeId];
}

function renderAdaptive(root, P) {
  const R = riderOf(P.id);
  const now = () => T0 + (R.clock++) * 60000;
  const q = levelFor(R.rider, P.id, { now: T0 + R.clock * 60000 });
  const st = stateOf(R.rider, P.id);
  const pct = pctOf(R.rider, P.id) ?? 0;
  const hist = (st && st.h ? st.h : []).slice(-20);
  const rights = hist.filter((x) => x[0]).length;

  const record = (right, how) => {
    const before = levelFor(R.rider, P.id, { now: T0 + R.clock * 60000 });
    const res = recordLevel(R.rider, P.id, { right, level: before.id, now: now() });
    const after = P.levels[res.i];
    const moved = res.moved > 0 ? `up to ${res.i + 1}. ${after.title}` : res.moved < 0 ? `down to ${res.i + 1}. ${after.title}` : `stays (${Math.round(res.into * 100) / 100} of ${after.count || 5})`;
    R.log.unshift({ right, at: before.i + 1, title: before.level.title, moved, placed: res.justPlaced, how, placing: before.placing });
    if (R.log.length > 60) R.log.length = 60;
    R.seed++;
    render();
  };

  const cols = h('div', { class: 'cols adaptive' });
  const panel = h('section', { class: 'rider paper' });
  panel.append(h('h3', {}, 'Throwaway rider'),
    h('p', { class: 'how' }, 'Not saved. Answers move this rider with the game’s own level model: one level per right answer while finding the level, then the 80% staircase.'));
  panel.append(h('div', { class: 'stat' },
    h('span', { class: 'big' }, `${pct}%`),
    h('span', {}, h('b', {}, `Level ${q.i + 1} of ${q.n}: `), q.level.title, ' ', q.placing ? h('span', { class: 'placing' }, 'finding the level') : null)));
  panel.append(h('div', { class: 'meter' }, h('i', { style: `width:${pct}%` })));
  const into = h('div', { class: 'into', title: 'right answers banked toward the next level' });
  for (let k = 0; k < q.count; k++) into.append(h('i', { class: k < Math.floor(q.into) ? 'on' : '' }));
  panel.append(h('div', { class: 'how' }, `Into this level: ${Math.round(q.into * 100) / 100} of ${q.count}`), into);
  panel.append(h('div', { class: 'how' }, hist.length ? `Last ${hist.length} answers: ${rights} right (${Math.round((100 * rights) / hist.length)}%)` : 'No answers yet.'));
  const last = h('div', { class: 'last' });
  for (const [r, id] of hist) { const i = P.levels.findIndex((L) => L.id === id); last.append(h('span', { class: r ? 'r' : 'w', title: `${r ? 'right' : 'wrong'} at ${i + 1}. ${id}` }, String(i + 1))); }
  panel.append(last);
  panel.append(h('div', { class: 'bar' },
    h('button', { class: 'btn good', type: 'button', onclick: () => record(true, 'button') }, 'Answer right'),
    h('button', { class: 'btn bad', type: 'button', onclick: () => record(false, 'button') }, 'Answer wrong')));
  const age = h('select', { 'aria-label': 'Age (head start)' },
    h('option', { value: '' }, 'no age'), ...[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((a) => h('option', { value: String(a) }, `age ${a}`)));
  age.value = R.age;
  panel.append(h('div', { class: 'row' }, 'Start a new rider:', age,
    h('button', { class: 'btn alt', type: 'button', onclick: () => {
      const a = age.value; delete S.riders[P.id]; const N = riderOf(P.id); N.age = a; if (a) N.rider.age = Number(a); render();
    } }, 'New rider')));
  const log = h('ol', { class: 'log' });
  for (const e of R.log) log.append(h('li', {}, h('b', {}, e.right ? 'Right' : 'Wrong'), ` at ${e.at}. ${e.title}${e.placing ? ' (finding)' : ''}: ${e.moved}${e.placed ? ', placed' : ''}${e.how === 'button' ? '' : ' · on a card'}`));
  if (R.log.length) panel.append(log);

  const right = h('div', { id: 'cardcol' });
  if (P.id === 'graphs') {
    // (each first answer moves the rider at once, as in the game; the panel catches up when the five are done)
    const host = h('div', {});
    right.append(host, h('p', { class: 'how' }, 'Five a sitting: each first answer moves the throwaway rider (a "Show me" first is not counted). The panel updates after the five.'));
    graphSitting(host, { seed: R.seed, title: 'Graph practice',
      gen: () => levelFor(R.rider, P.id, { now: T0 + R.clock * 60000 }).level.gen,
      record: (right) => {
        const before = levelFor(R.rider, P.id, { now: T0 + R.clock * 60000 });
        const res = recordLevel(R.rider, P.id, { right, level: before.id, now: now() });
        const after = P.levels[res.i];
        R.log.unshift({ right, at: before.i + 1, title: before.level.title, moved: res.moved > 0 ? `up to ${res.i + 1}. ${after.title}` : res.moved < 0 ? `down to ${res.i + 1}. ${after.title}` : 'stays', placed: res.justPlaced, how: 'card', placing: before.placing });
      },
      onClose: () => { R.seed++; render(); } });
    cols.append(panel, right); root.append(cols);
    return;
  }
  let c;
  try { c = makeCard(P.id, q.id, R.seed, { into: Math.floor(q.into), count: q.count }); }
  catch (e) { console.error(e); right.append(h('div', { class: 'paper empty' }, `This level failed to make a question: ${e.message}`)); }
  if (c) {
    right.append(renderCard(c, { onDone: (ok, shown) => {
      if (shown) { R.log.unshift({ right: false, at: q.i + 1, title: q.level.title, moved: 'answer shown: not counted', how: 'card' }); }
      setTimeout(() => (shown ? (R.seed++, render()) : record(ok, 'card')), shown ? 1600 : 1300);
    } }));
    right.append(h('p', { class: 'how' }, 'Answer the card (one answer a card: right with no wrong tap) or use the buttons. A shown answer is not counted.'));
  }
  cols.append(panel, right);
  root.append(cols);
}

// ---- the page ---------------------------------------------------------------------------------------------------------

function render() {
  if (GC) { const g = GC; GC = null; g.close(); }   // (its key listeners go with it)
  renderTabs();
  const P = PLACE[S.place];
  const root = $('#main'); root.textContent = '';
  root.append(h('div', { class: 'place-head' }, h('h2', {}, P.name), h('p', {}, `${P.math}: ${P.line} ${P.levels.length} levels.`)));
  const modes = h('div', { class: 'modes', role: 'group', 'aria-label': 'Mode' },
    h('button', { type: 'button', 'aria-pressed': S.mode === 'levels' ? 'true' : 'false', onclick: () => { S.mode = 'levels'; render(); } }, 'Levels'),
    h('button', { type: 'button', 'aria-pressed': S.mode === 'adaptive' ? 'true' : 'false', onclick: () => { S.mode = 'adaptive'; render(); } }, 'Adaptive'));
  root.append(modes);
  if (S.mode === 'adaptive') renderAdaptive(root, P); else renderLevels(root, P);
  syncUrl();
}

render();
