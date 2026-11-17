// THE MATHBALL LAB: the game's maker's way to sort the rule sets ("Feel free to give me a way to sort the difficulty of
// questions if that helps", 2026-11-16). Every rule set of the game's own ladder (src/mathball/ladder.js), in the
// order the game climbs them, each with an example court drawn from above: the four goals' first rules, eight balls the
// ports could shoot out (dealt by the game's own rules: each fits a goal and never all four), which goals each fits,
// and the rules a goal may change to. Drag a set, or use its arrows; Copy the order gives the ORDER line for
// ladder.js (and puts it in the box, to copy by hand where the clipboard is shut). The order is kept in this browser
// until it is copied or reset. Nothing here is a copy of the game's code: it imports the game's ladder, rules and court.
import { SETS, ORDER } from '../../src/mathball/ladder.js';
import { ruleOf, goalsFor, dealable, checkSet } from '../../src/mathball/rules.js';
import { CORNERS, GOALS, GOAL_CSS, BALL_COLOURS, COURT } from '../../src/mathball/court.js';

const KEEP = 'mathball-lab.order';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STRANDS = { number: 'Counting and number sense', mul: 'Multiplication', div: 'Division' };
const gradeWords = (g) => (g < 10 ? 'kindergarten' : g >= 90 ? 'algebra 1' : ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][Math.floor(g / 10) - 1] + ' grade');
let seed = 1;
const rng = (s) => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };

// the order: the game's (ORDER), or this browser's last; every set the ladder file has, the ones left out after the line
function load() {
  let order = [...ORDER], out = Object.keys(SETS).filter((k) => !ORDER.includes(k));
  try { const v = JSON.parse(localStorage.getItem(KEEP) || 'null'); if (v && Array.isArray(v.order)) { order = v.order.filter((k) => SETS[k]); out = Object.keys(SETS).filter((k) => !order.includes(k)); } } catch (e) { /* (blocked: the game's order) */ }
  return { order, out };
}
let S = load();
const keep = () => { try { localStorage.setItem(KEEP, JSON.stringify({ order: S.order })); } catch (e) { /* */ } };

// ── an example court, from above ──────────────────────────────────────────────────────────────────────────────────
function deal(set, rand) {
  const pool = dealable(set.goals, set.pool), out = [];
  // (one ball for each goal first, then any)
  for (let g = 0; g < 4; g++) { const c = pool.filter((b) => goalsFor(set.goals, b).includes(g) && !out.includes(b)); if (c.length) out.push(c[Math.floor(rand() * c.length)]); }
  while (out.length < 8 && out.length < pool.length) { const b = pool[Math.floor(rand() * pool.length)]; if (!out.includes(b)) out.push(b); }
  return out;
}
function courtSvg(set, balls, rand) {
  const s = 11, pad = 12, top = 30, W = (COURT.hx * 2) * s + pad * 2, H = (COURT.hz * 2) * s + top * 2;
  const X = (x) => (x + COURT.hx) * s + pad, Y = (z) => (z + COURT.hz) * s + top;
  let svg = `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="An example court: ${esc(set.goals.map((r) => ruleOf(r).say).join(', '))}">`;
  svg += `<polygon points="${CORNERS.map(([x, z]) => `${X(x).toFixed(1)},${Y(z).toFixed(1)}`).join(' ')}" fill="#0b1119" stroke="#4fb6ff" stroke-width="2"/>`;
  svg += `<circle cx="${X(0)}" cy="${Y(0)}" r="${1.2 * s}" fill="none" stroke="#c9d3de" stroke-width="1.2" opacity="0.7"/>`;
  // the goals: a bar on each slanted wall in its colour, its rule outside the court in that corner (west goals' words
  // from the left edge, east goals' to the right edge; north ones over the court, south ones under it)
  GOALS.forEach((g, i) => {
    const c = GOAL_CSS[g.colour], ux = g.u[0] * 1.2, uz = g.u[1] * 1.2, R = ruleOf(set.goals[i]);
    svg += `<line x1="${X(g.mid[0] - ux)}" y1="${Y(g.mid[1] - uz)}" x2="${X(g.mid[0] + ux)}" y2="${Y(g.mid[1] + uz)}" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`;
    const east = g.mid[0] > 0, north = g.mid[1] < 0, words = R.sign.length === 2 ? `${R.sign[0]} ${R.sign[1]}` : R.sign[0];
    svg += `<text x="${east ? W - 4 : 4}" y="${north ? 13 : H - 9}" fill="${c}" font-size="12" font-weight="700" text-anchor="${east ? 'end' : 'start'}">${esc(words)}</text>`;
  });
  // the balls: spread over the court, never on top of each other or the goals' words
  const spots = [];
  for (const b of balls) {
    let p = null;
    for (let k = 0; k < 80 && !p; k++) {
      const x = (rand() - 0.5) * 7.4, z = (rand() - 0.5) * 11.5;
      if (spots.every((q) => Math.hypot(q[0] - x, q[1] - z) > 1.5)) p = [x, z];
    }
    p = p || [(rand() - 0.5) * 6, (rand() - 0.5) * 10]; spots.push(p);
    const col = BALL_COLOURS[spots.length % BALL_COLOURS.length], r = 0.62 * s, t = String(b);
    svg += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="${r}" fill="${col}" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>`;
    svg += `<text x="${X(p[0])}" y="${Y(p[1]) + 0.5}" fill="#fff" font-size="${t.length > 2 ? 8 : 10.5}" font-weight="800" text-anchor="middle" dominant-baseline="middle">${esc(t)}</text>`;
  }
  return svg + '</svg>';
}

// ── the cards ──────────────────────────────────────────────────────────────────────────────────────────────────────
const list = document.getElementById('sets');
function card(key, i, out) {
  const set = SETS[key], rand = rng(seed * 7919 + key.length * 131 + key.charCodeAt(0)), balls = deal(set, rand);
  const all = dealable(set.goals, set.pool), c = checkSet(set.goals, all);
  const goals = set.goals.map((r, g) => `<span style="--c:${GOAL_CSS[GOALS[g].colour]}">${esc(ruleOf(r).say)}</span>`).join('');
  const rows = balls.map((b) => { const fit = goalsFor(set.goals, b); return `<tr><td>${esc(b)}</td>${set.goals.map((r, g) => (fit.includes(g) ? `<td class="y" style="--c:${GOAL_CSS[GOALS[g].colour]}">&#10003;</td>` : '<td class="no">&middot;</td>')).join('')}<td>${fit.length}</td></tr>`; }).join('');
  const li = document.createElement('li');
  li.className = 'set' + (out ? ' is-out' : ''); li.dataset.key = key;
  li.innerHTML = `<div class="grip"><span class="n">${out ? '&ndash;' : i + 1}</span><span class="handle" title="Drag to move" aria-hidden="true">&#9776;</span>
      <button type="button" data-move="-1" aria-label="Move ${esc(set.short)} up"${i === 0 && !out ? ' disabled' : ''}>&#9650;</button>
      <button type="button" data-move="1" aria-label="Move ${esc(set.short)} down">&#9660;</button></div>
    <div class="court">${courtSvg(set, balls, rand)}</div>
    <div class="info"><h2>${esc(set.name)}<span class="check${c.ok ? '' : ' bad'}">${c.ok ? 'the ball check passes' : 'the ball check FAILS'}</span></h2>
      <p class="line">${esc(set.line)}</p>
      <p class="meta">${out ? '<b>Left out of the game.</b> ' : `<b>Level ${i + 1} of ${S.order.length}.</b> `}On Mathwood's school guide: ${esc(STRANDS[set.strand] || set.strand)}, about ${gradeWords(set.grade)} (${set.grade}). ${all.length} balls it can deal; ${c.choice} of them fit two goals or more.</p>
      <div class="goals">${goals}</div>
      <table class="fits"><thead><tr><th>Ball</th>${GOALS.map((g) => `<th style="color:${GOAL_CSS[g.colour]}">${g.colour}</th>`).join('')}<th>goals</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="spares">As the light bar reaches a goal, its rule can change to: ${esc([...set.goals, ...set.spares].map((r) => ruleOf(r).say).join(', '))} (one the balls on the court still suit).</p></div>`;
  return li;
}
function render() {
  list.innerHTML = '';
  S.order.forEach((k, i) => list.appendChild(card(k, i, false)));
  const d = document.createElement('li'); d.className = 'divider'; d.textContent = 'Left out: the sets below this line are not in the game'; d.dataset.key = '|'; list.appendChild(d);
  S.out.forEach((k, i) => list.appendChild(card(k, i, true)));
  document.getElementById('out').value = line();
}
const line = () => `export const ORDER = [${S.order.map((k) => `'${k}'`).join(', ')}];`;

// ── moving them ────────────────────────────────────────────────────────────────────────────────────────────────────
// the whole list as one run, the divider in it: moving is splicing that run
const run = () => [...S.order, '|', ...S.out];
function setRun(r) { const i = r.indexOf('|'); if (i < 1) { note('Keep at least one set in the game.'); return; } S.order = r.slice(0, i); S.out = r.slice(i + 1); keep(); render(); note(''); }
list.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-move]'); if (!b) return;
  const key = b.closest('li').dataset.key, r = run(), i = r.indexOf(key), j = i + +b.dataset.move;
  if (j < 0 || j >= r.length) return;
  [r[i], r[j]] = [r[j], r[i]]; setRun(r);
  const again = list.querySelector(`li[data-key="${key}"] button[data-move="${b.dataset.move}"]`); if (again && !again.disabled) again.focus();
});
// dragging by the handle, with a finger or the mouse: the set under the pointer is marked, letting go puts it there
let drag = null;
list.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('.handle'); if (!h) return;
  const li = h.closest('li.set'); drag = { key: li.dataset.key, li, over: null };
  li.classList.add('is-drag'); e.preventDefault();
  try { h.setPointerCapture(e.pointerId); } catch (err) { /* (a pointer already gone: the moves still come to the list) */ }
});
// the set under the pointer; above the whole list it is the first, below it the last (the page may have scrolled
// the list away from under a finger held near the top or bottom); in a gap between two sets, none
const setAt = (x, y) => {
  const el = document.elementFromPoint(x, y), li = el && el.closest('#sets > li'); if (li) return li;
  const all = [...list.querySelectorAll('#sets > li')]; if (!all.length) return null;
  if (y < all[0].getBoundingClientRect().top) return all[0];
  if (y > all[all.length - 1].getBoundingClientRect().bottom) return all[all.length - 1];
  return null;
};
const mark = (li) => {
  for (const x of list.querySelectorAll('.is-over')) x.classList.remove('is-over');
  drag.over = li.dataset.key !== drag.key ? li : null; if (drag.over) drag.over.classList.add('is-over');
};
list.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const li = setAt(e.clientX, e.clientY); if (li) mark(li);
  // (near the window's edge, it scrolls)
  if (e.clientY < 60) scrollBy(0, -12); else if (e.clientY > innerHeight - 60) scrollBy(0, 12);
});
const endDrag = (e) => {
  if (!drag) return;
  if (e && e.type === 'pointerup') { const li = setAt(e.clientX, e.clientY); if (li) mark(li); }
  const { key, over } = drag; drag = null;
  for (const x of list.querySelectorAll('.is-drag, .is-over')) x.classList.remove('is-drag', 'is-over');
  // (it takes the marked set's place: dragged down, it goes after it; dragged up, before it)
  if (over) { const r = run(), j = r.indexOf(over.dataset.key); r.splice(r.indexOf(key), 1); r.splice(j, 0, key); setRun(r); }
};
list.addEventListener('pointerup', endDrag); list.addEventListener('pointercancel', endDrag);

// ── copying ────────────────────────────────────────────────────────────────────────────────────────────────────────
const note = (s) => { document.getElementById('note').textContent = s; };
document.getElementById('copy').addEventListener('click', async () => {
  const text = line(), box = document.getElementById('out'); box.value = text;
  let ok = false;
  try { await Promise.race([navigator.clipboard.writeText(text), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 1500))]); ok = true; } catch (e) { ok = false; }
  if (!ok) { box.focus(); box.select(); try { ok = document.execCommand('copy'); } catch (e) { ok = false; } }
  note(ok ? 'Copied. Paste it over the ORDER line in pi-nebula/src/mathball/ladder.js (it is in the box too).' : 'Copying did not work here: the line is in the box, selected; copy it from there.');
});
document.getElementById('reset').addEventListener('click', () => { try { localStorage.removeItem(KEEP); } catch (e) { /* */ } S = load(); S.order = [...ORDER]; S.out = Object.keys(SETS).filter((k) => !ORDER.includes(k)); render(); note('Back to the order the game has now.'); });
document.getElementById('deal').addEventListener('click', () => { seed++; render(); });
render();
window.MBLAB = { order: () => [...S.order], out: () => [...S.out], line };
