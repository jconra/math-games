// THE ENGINEERING LAB: the engineer's questions by themselves, on the game's own job card (src/jobs/panel.js) with the
// engineer's display on it (src/jobs/engview.js) and the engineer's own ladder (src/jobs/engineer.js): nothing here is
// a copy, so a change to the questions or the display shows here as it will in the game. The questions are not in the
// mining run yet; this is where they are tried.
// The game's maker (2026-11-19): "I like the idea of the engineering covering questions about volume, area, and edges.
// I imagine something like a display with some kind of cube configuration (depending on the level). So a basic level
// could just show a 2d box and ask what its height is and what its length is. The levels would progress through area
// and volume. The high levels could show a cluster of cubes (the more, the harder) in 3d that can spin around. The
// questions can claim that the cubes are fuel pellets that need a containment field or something."
//
// What is the lab's own:
//   - "New question": another question of the level in hand (in the game the next card comes after a right answer);
//   - the list of the fifteen levels beside the card, to read (the level in hand is lit; the card's own arrows move it);
//   - nobody is paid here, as on a captain's run (the pay there is the share of the haul);
//   - whoever is in the lab starts on level 1, not at a level found for them, and THE LEVEL IS KEPT: an answer, right
//     or wrong, does not move it (in the game four right in five climb a level and a miss with the bar empty drops
//     one); only the card's arrows do. The card says so ("Kept"), and its Levels button can turn that off.
//   - on a phone the card starts right under the top line (in the game it lies along the bottom of the screen, the
//     ship's room in view above it), the same size as it is in the game.
// Address switches: ?level=cluster  start on that level; ?seed=7  the same questions each time (for pictures);
// ?keep=0  the level moves by itself as in the game.
// window.ENGLAB: { ready, job, crew, link, panel(), view(), state(), again() }.
import * as E from '../../src/jobs/engine.js';
import { JOB } from '../../src/jobs/engineer.js';
import { engineerLink } from '../../src/jobs/engview.js';
import { openPanel } from '../../src/jobs/panel.js';
import { setLevelAt, setKeep } from '../../../mathwood-valley/src/levels/model.js';
import { seeded } from '../../../mathwood-valley/src/levels/kit.js';

const Q = new URLSearchParams(location.search), $ = (id) => document.getElementById(id);
const crew = { id: 'engineering-lab', name: 'Engineer' };
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
function where() {
  const v = E.level(crew, JOB), L = LV[v.i];
  for (const li of $('ladder').children) li.classList.toggle('is-now', li.dataset.id === L.id);
  $('note').textContent = panel ? `Level ${v.i + 1} of ${v.n}: ${L.title}. ${L.line}.` : 'Done for now. New question brings the core display back.';
}

// the card: the game's own panel, with the engineer's display put on each new card
const link = engineerLink(), put = link.play;
link.play = (o, ui) => { put(o, ui); where(); };
if (Q.has('seed')) {
  // (the same questions each time: the cards dealt here, from a seed, by the game's own dealing)
  const rand = seeded(+Q.get('seed') || 1); let last = null;
  link.card = () => { const q = E.deal(crew, JOB, { rand, last }); last = q.order.ask_ || null; return q; };
}
let panel = null;
function again() {
  if (panel) { const old = panel; panel = null; old.close(true); }
  panel = openPanel(document.body, { job: JOB, crew, live: link, pay: false, onClose: () => { panel = null; where(); } });
  where();
}
$('new').addEventListener('click', again);

window.ENGLAB = { ready: false, job: JOB, crew, link, again, panel: () => panel, view: () => link.view(),
  state: () => ({ panel: panel ? panel.state() : null, view: link.view() ? link.view().state() : null, note: $('note').textContent }) };
again();
$('loading').remove();
window.ENGLAB.ready = true;
