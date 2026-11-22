// THE EXPLORE LAB: the exploring run's pieces, tried by themselves before the run is made (the plan:
// ~/pw/space-math/EXPLORE_PLAN.md). Its first piece: the surveyor's cards at the Explorer's survey table, on the game's
// own job card (src/jobs/panel.js) with the surveyor's own ladder (src/jobs/survey.js) and pictures
// (src/jobs/surveyview.js): nothing here is a copy, so a change to the cards shows here as it will in the game.
// The game's maker (2026-11-20): "it makes sense to me to use the survey table and pick up an area of interest (by doing
// some math) and then jump again to the new location and then make the discovery"; the cards: charts, averages,
// chance, and points on the map.
//
// What is the lab's own:
//   - "New card": another card of the level in hand (in the game the next card comes after a right answer);
//   - the list of the levels beside the card, to read (the level in hand is lit; a tap on one goes to it, as the card's
//     own arrows do);
//   - nobody is paid here, as on a captain's run (the pay there is the share of what the survey is worth);
//   - whoever is in the lab starts on level 1, not at a level found for them, and THE LEVEL IS KEPT: an answer, right
//     or wrong, does not move it (in the game four right in five climb a level and a miss with the bar empty drops
//     one); only the card's arrows do. The card says so ("Kept"), and its Levels button can turn that off.
//   - on a phone the card starts right under the top line (in the game it lies along the bottom of the screen), the
//     same size as it is in the game.
// Address switches: ?level=average  start on that level; ?seed=7  the same cards each time (for pictures);
// ?keep=0  the level moves by itself as in the game.
// window.EXPLAB: { ready, job, crew, link, panel(), state(), again(), go(levelId) }.
import * as E from '../../src/jobs/engine.js';
import { JOB } from '../../src/jobs/survey.js';
import { surveyLink } from '../../src/jobs/surveyview.js';
import { openPanel } from '../../src/jobs/panel.js';
import { setLevelAt, setKeep } from '../../../mathwood-valley/src/levels/model.js';
import { seeded } from '../../../mathwood-valley/src/levels/kit.js';

const Q = new URLSearchParams(location.search), $ = (id) => document.getElementById(id);
const crew = { id: 'explore-lab', name: 'Surveyor' };
// (the card and the ladder sit under this page's top line, however many rows it wraps to)
const topBar = () => document.documentElement.style.setProperty('--lab-top', $('top').offsetHeight + 'px');
new ResizeObserver(topBar).observe($('top')); topBar();
E.register(JOB);
const LV = JOB.place.levels;
setLevelAt(crew, JOB.place.id, LV.some((L) => L.id === Q.get('level')) ? Q.get('level') : LV[0].id);
// (the level stays where the arrows put it: here an answer, right or wrong, does not move it; ?keep=0: it moves as in the game)
if (Q.get('keep') !== '0') setKeep(crew, JOB.place.id, true);

// the ladder, to read
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
$('ladder').innerHTML = LV.map((L, i) => `<li data-id="${L.id}"><b>${i + 1}</b><span>${esc(L.title)}</span><small>${esc(L.line)}</small></li>`).join('');
for (const li of $('ladder').children) li.addEventListener('click', () => go(li.dataset.id));
function where() {
  const v = E.level(crew, JOB), L = LV[v.i];
  for (const li of $('ladder').children) li.classList.toggle('is-now', li.dataset.id === L.id);
  $('note').textContent = panel ? `Level ${v.i + 1} of ${v.n}: ${L.title}. ${L.line}.` : 'Done for now. New card brings the survey table back.';
}

// the card: the game's own panel, its top the survey table's
const link = surveyLink();
link.play = () => where();
if (Q.has('seed')) {
  // (the same cards each time: dealt here, from a seed, by the game's own dealing)
  const rand = seeded(+Q.get('seed') || 1); let last = null;
  link.card = () => { const q = E.deal(crew, JOB, { rand, last }); last = q.order.ask_ || null; return q; };
}
let panel = null;
function again() {
  if (panel) { const old = panel; panel = null; old.close(true); }
  panel = openPanel(document.body, { job: JOB, crew, live: link, pay: false, onClose: () => { panel = null; where(); } });
  where();
}
// (a level picked from the list: there, and a new card of it)
function go(id) {
  if (!LV.some((L) => L.id === id)) return false;
  setLevelAt(crew, JOB.place.id, id);
  if (Q.get('keep') !== '0') setKeep(crew, JOB.place.id, true);
  again();
  return true;
}
$('new').addEventListener('click', again);

window.EXPLAB = { ready: false, job: JOB, crew, link, again, go, panel: () => panel, state: () => ({ panel: panel ? panel.state() : null, note: $('note').textContent }) };
again();
$('loading').remove();
window.EXPLAB.ready = true;
