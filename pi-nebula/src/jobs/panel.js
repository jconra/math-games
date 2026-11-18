// THE JOB PANEL: one question at a time, over the station, beside the job's own props (the serving counter, the
// triage desk). The same eight-sided glass as the title screen.
//
//   the top strip    the job's name, the level with its arrows (Mathwood's level tool: ◀ 9 of 14: Recipes made bigger ▶,
//                    a thin bar for the right answers toward the next level, "Kept ·" and no bar when the level is kept;
//                    the arrows stop at the levels chosen), and "Done" (Esc)
//   the card         the job's scene (a recipe card in the galley, a patient chart at the triage desk, a pay slip at
//                    the smelter: its rows in place of the story where the order has them), the story and the
//                    question, and for the youngest the things to count drawn on it
//   the answers      four buttons, each the number big and its unit small under it. No key numbers on them (keys 1 to
//                    4 still pick). A wrong pick shakes and goes dull with one plain line why, and the Help button
//                    glows; a right one lights up, its credits fly to the count, and the next card slides in by itself
//                    (no result screen, nothing to press)
//   Help             always one click away (key H): the picture for THIS question (Mathwood's drawings), one line on
//                    how to go about it, the sums in order with the numbers filled in, and "Work it out on paper", which
//                    opens Mathwood's worked sheet (src/ui/longwork.js) on the question's own sums. It never opens by
//                    itself, has an X, and Esc closes it. Using it never costs credits.
//   Levels           left of Help: the job's levels to ask and keep to these levels (ui/levels.js), over the panel,
//                    which keeps no keys while it is up; the card is dealt again when it closes, if the level moved
//
//   const J = openPanel(root, { job, crew, live, onClose, onSave, onCredits })    J.close(), J.state() (for rigs),
//   J.pick(i), J.help(), J.step(dir). live: a function giving what the job's props are doing right now (the smelter's
//   load in the hangar), or an object joined to them (the crane operator job: src/jobs/cranelink.js): { now() for the
//   makers, right(q, coin) and wrong(q, coin) told of each pick, close() }; asked once for each new question; or null.
//   Such an object may also (the dock's bridge, src/jobs/docklink.js): head(o) draw the card's top; play(o, ui) answer
//   a question by doing (the squares to brace: it fills ui.answers and calls ui.pick(0) when done; the order's `play`
//   keeps keys and clicks from picking before); over() end the job's run with a card of its own ({ html, buttons }).
//   An order may bring its picture drawn (o.lead) and coins that are pictures (c.svg).
//   Such an object may also bring a card of its own in place of one of the level's: card() -> null, or a question
//   ready made ({ order, level: { id, grade }, worth, misses: 0, picked: new Set(), done: false, answer(q, i, { ms,
//   helped }) -> what engine.js answer gives }): the share of a run waiting at the smelter's controls (src/mission.js).
//   pay: false: the job's cards pay nothing by themselves (the pilot's seat on a captain's run, whose share is the pay
//   for all of it: src/trip.js); the level and the kinds of math hear them as ever.
import * as E from './engine.js';
import { helpPicture } from './pics.js';
import { openLongWork } from '../../../mathwood-valley/src/ui/longwork.js';
import { workOf, sumWords } from '../../../mathwood-valley/src/math/longwork.js';
import { openJobLevels } from '../ui/levels.js';

const CSS = new URL('./jobs.css', import.meta.url).href;
export function ensureCss() {
  if (document.querySelector('link[data-pnj]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.pnj = '1'; document.head.appendChild(l);
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const PANEL = { nextMs: 1350, shakeMs: 420 };

export function openPanel(root, { job, crew, live = null, pay = true, onClose = () => {}, onSave = () => {}, onCredits = () => {} } = {}) {
  ensureCss();
  const el = document.createElement('div');
  el.className = 'pnj';
  el.dataset.job = job.id;   // (a job's own styles: the dock's, src/jobs/dock.css)
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', job.name);
  el.innerHTML = `<section class="pnj-panel">
      <header class="pnj-top">
        <div class="pnj-name"><b>${esc(job.name)}</b><span class="pnj-cr" aria-label="Credits"><i aria-hidden="true"></i><em></em></span></div>
        <div class="pnj-level">
          <button type="button" class="pnj-arrow" data-dir="-1" aria-label="An easier level">&#9664;</button>
          <div class="pnj-lv"><span class="pnj-lvwords"></span><span class="pnj-bar"><i></i></span></div>
          <button type="button" class="pnj-arrow" data-dir="1" aria-label="A harder level">&#9654;</button>
        </div>
        <button type="button" class="pnj-x" aria-label="Done for now (Esc)">Done<kbd>Esc</kbd></button>
      </header>
      <div class="pnj-stage"><article class="pnj-card"></article></div>
      <div class="pnj-answers" role="group" aria-label="Pick the answer"></div>
      <p class="pnj-line" aria-live="polite"></p>
      <div class="pnj-foot"><button type="button" class="pnj-levels" aria-label="Levels to ask, and keep to them"><svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.5 1.5v13M11.5 1.5v13M4.5 4.5h7M4.5 8h7M4.5 11.5h7"/></svg>Levels</button><button type="button" class="pnj-helpbtn" data-askhelp>Help<kbd>H</kbd></button></div>
      <aside class="pnj-help" hidden>
        <header><b class="pnj-htitle">Help</b><button type="button" class="pnj-hx" aria-label="Close the help (Esc)">&#10005;</button></header>
        <div class="pnj-pic"></div><p class="pnj-hline"></p><ol class="pnj-steps"></ol>
        <button type="button" class="pnj-paper">Work it out on paper</button>
      </aside>
    </section>`;
  root.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const card = $('.pnj-card'), answers = $('.pnj-answers'), line = $('.pnj-line'), helpEl = $('.pnj-help'), helpBtn = $('.pnj-helpbtn');
  let q = null, busy = false, closed = false, helpOn = false, helped = false, t0 = 0, sheet = null, lastAsk = null;

  // ── the top strip ─────────────────────────────────────────────────────────────────────────────────────────────
  function showCredits(bump = 0) {
    const n = E.credits(crew);
    $('.pnj-cr em').textContent = `${n} ${n === 1 ? 'credit' : 'credits'}`;
    if (bump) { const c = $('.pnj-cr'); c.classList.remove('is-bump'); void c.offsetWidth; c.classList.add('is-bump'); }
  }
  function showLevel(flash = '') {
    const v = E.level(crew, job);
    if (!v) return;
    $('.pnj-lvwords').textContent = flash || `${v.kept ? 'Kept · ' : ''}Level ${v.i + 1} of ${v.n}: ${v.title}`;
    $('.pnj-lv').title = v.note;
    $('.pnj-lv').classList.toggle('is-flash', !!flash);
    $('.pnj-lv').classList.toggle('is-kept', !!v.kept);
    $('.pnj-bar i').style.width = `${Math.round((v.placing ? 0 : v.fill) * 100)}%`;
    $('.pnj-bar').classList.toggle('is-placing', v.placing);
    const [dn, up] = el.querySelectorAll('.pnj-arrow');
    dn.disabled = !v.canDown; up.disabled = !v.canUp; dn.hidden = up.hidden = !v.pick;
  }
  el.querySelectorAll('.pnj-arrow').forEach((b) => b.addEventListener('click', () => step(+b.dataset.dir)));
  // the job's levels to ask and keep to these levels (ui/levels.js), over the panel; the card dealt again on closing if
  // the level the next question comes from moved
  let levelsSheet = null;
  $('.pnj-levels').addEventListener('click', () => {
    if (busy || levelsSheet || closed) return;
    levelsSheet = openJobLevels(document.body, crew, { jobs: [job], job: job.id, onChange: () => onSave(),
      onClose: (moved) => { levelsSheet = null; if (closed) return; if (moved) next({ slide: 1 }); else showLevel(); } });
  });
  function step(dir) {
    if (busy) return null;
    const v = E.step(crew, job, dir);
    if (!v) return null;
    onSave();
    next({ slide: dir });
    return v;
  }

  // ── the card ──────────────────────────────────────────────────────────────────────────────────────────────────
  // (a job joined to its props may draw its card's top itself: the dock's bridge plan, which ring it is on)
  const own = live && typeof live === 'object' ? live : null;
  function sceneHtml(o) {
    const top = own && own.head ? own.head(o) : null;
    if (top) return top;
    const who = o.who || null;
    if (job.card === 'chart') {
      return `<header class="pnj-cardtop is-chart"><span class="pnj-icon is-cross" aria-hidden="true"></span><b>Patient chart</b><small>Triage</small></header>
        ${who ? `<dl class="pnj-chart"><div><dt>Patient</dt><dd>${esc(who.name)}</dd></div>${who.why ? `<div><dt>In for</dt><dd>${esc(who.why)}</dd></div>` : ''}</dl>` : ''}`;
    }
    if (job.card === 'crane') {
      // (the crane game: a move the crane is about to make, to be verified)
      const now = !!(o.facts && o.facts.live);
      return `<header class="pnj-cardtop is-order"><span class="pnj-icon is-hook" aria-hidden="true"></span><b>Crane check</b><small>${now ? 'Verify the next move' : 'From the log'}</small></header>`;
    }
    if (job.card === 'payslip') {
      // (a count taken from the hangar as the slip was made says so; a slip may say what it is about, "This haul"; any
      // other slip is someone's load from the log)
      const now = !!(o.facts && o.facts.live), from = o.facts && o.facts.from;
      return `<header class="pnj-cardtop is-slip"><span class="pnj-icon is-bar" aria-hidden="true"></span><b>Pay slip</b><small>${from ? esc(from) : now ? 'The hangar, right now' : who ? `${esc(who.name)}'s load` : 'From the log'}</small></header>`;
    }
    if (job.card === 'jump') {
      // (the pilot's seat: on a run its top is the trip's own, with the jump's three lamps: src/trip.js head)
      return `<header class="pnj-cardtop is-jump"><span class="pnj-icon is-jump" aria-hidden="true"></span><b>Jump computer</b><small>Work out the jump</small></header>`;
    }
    return `<header class="pnj-cardtop is-recipe"><span class="pnj-icon is-pot" aria-hidden="true"></span><b>Galley order</b><small>${who ? `from ${esc(who.name)}` : 'Recipe card'}</small></header>`;
  }
  // an order with rows of its own (the whole pay slip): the rows are the story, set out as the slip
  const storyHtml = (o) => (o.lines && o.lines.length
    ? `<dl class="pnj-chart is-slip">${o.lines.map(([k, v]) => `<div${v === '?' ? ' class="is-ask"' : ''}><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
    : `<p class="pnj-story">${esc(o.story)}</p>`);
  function draw(o) {
    const pic = o.picFirst ? helpPicture(o) : null;
    // (a job's own question may bring its picture with it, drawn: o.lead, the dock's panel with its gap)
    const lead = o.lead || (pic && pic.svg) || '';
    el.dataset.key = o.key || '';   // (which maker made the card: a job's props may draw for it, the crane game's grid)
    card.innerHTML = `${sceneHtml(o)}
      ${storyHtml(o)}
      ${lead ? `<div class="pnj-pic is-lead">${lead}</div>` : ''}
      <p class="pnj-ask">${esc(o.ask)}</p>`;
    answers.innerHTML = '';
    answers.classList.toggle('is-wide', o.coins.some((c) => String(c.big).length > 7));
    // (answers that are pictures, the panes the dock offers: the picture on the button, its words for a screen reader)
    answers.classList.toggle('is-pics', o.coins.some((c) => c.svg));
    o.coins.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pnj-coin'; b.dataset.i = String(i);
      b.setAttribute('aria-label', c.label);
      b.innerHTML = c.svg ? `<span class="pnj-coinpic">${c.svg}</span>` : `<b>${esc(c.big)}</b>${c.small ? `<small>${esc(c.small)}</small>` : ''}`;
      b.addEventListener('click', () => pick(i));
      answers.appendChild(b);
    });
    line.textContent = ''; line.className = 'pnj-line';
    // (a job's own way of answering, in place of the buttons: the dock's squares to brace, which pick when all are)
    if (own && own.play) own.play(o, { card, answers, line, pick });
    waitReady();
  }
  // (a job joined to its props may need them in place before a card can be answered: the crane operator job's crane
  // getting to where the card starts. Its answers wait, dimmed, with a line saying why; live.ready() -> true, or
  // { ok: false, why })
  let waitTimer = 0;
  function waitReady() {
    clearInterval(waitTimer); waitTimer = 0;
    const ready = live && typeof live === 'object' && live.ready;
    if (!ready) { answers.classList.remove('is-waiting'); return; }
    const check = () => {
      if (closed) { clearInterval(waitTimer); waitTimer = 0; return; }
      let v = true;
      try { v = ready(); } catch (e) { v = true; }
      const ok = v === true || !!(v && v.ok), was = answers.classList.contains('is-waiting');
      answers.classList.toggle('is-waiting', !ok);
      if (!ok) { const why = (v && v.why) || 'Getting ready...'; if (line.textContent !== why) { line.textContent = why; line.className = 'pnj-line is-wait'; } return; }
      clearInterval(waitTimer); waitTimer = 0;
      if (was) { if (line.classList.contains('is-wait')) { line.textContent = ''; line.className = 'pnj-line'; } t0 = performance.now(); }
    };
    check();
    if (answers.classList.contains('is-waiting')) waitTimer = setInterval(check, 150);
  }
  function next({ slide = 0 } = {}) {
    closeSheet();
    // (a job whose props come to an end, the dock's try after its last ring: its own last card in place of a question)
    const end = own && own.over ? own.over() : null;
    if (end) { showEnd(end, slide); return; }
    el.classList.remove('is-over');
    const deal = () => {
      let now = null;
      const read = live ? (typeof live === 'function' ? live : live.now) : null;
      if (read) { try { now = read(); } catch (e) { console.warn('Pi Nebula: the job could not read its props', e); } }
      // (a card the job's props bring ready made, in place of one of the level's)
      let made = null;
      if (own && own.card) { try { made = own.card(); } catch (e) { console.warn('Pi Nebula: the job could not bring its card', e); } }
      q = made || E.deal(crew, job, { last: lastAsk, live: now });
      if (!made) lastAsk = q.order.ask_ || null;
      onSave();
      helped = helpOn; t0 = performance.now();
    };
    if (slide) {
      // (no picks while the cards change over: the buttons on screen are still the last card's)
      const show = () => {
        // (a job joined to its props deals its card only once they are still: the crane game's next move is worked out
        // from where the crane has got to)
        if (holdDeal) deal();
        busy = true;
        card.classList.remove('is-done');
        card.classList.add('is-out');
        setTimeout(() => { if (closed) return; card.classList.remove('is-out'); draw(q.order); busy = false; t0 = performance.now(); card.classList.add('is-in'); setTimeout(() => card.classList.remove('is-in'), 400); if (helpOn) fillHelp(); }, 260);
      };
      const holdDeal = !!(live && typeof live === 'object' && live.ready);
      if (!holdDeal) deal();
      // (a job joined to its props that is not ready for the new card, the crane still on its way to where the card
      // starts: the last card stays, its buttons shut, until it is; then the new card comes, matching the picture)
      if (readyNow()) show(); else holdFor(show);
    } else if (live && typeof live === 'object' && live.ready && !readyNow()) {
      // (the first card of a job joined to its props that are not ready yet: dealt once they are, its line meanwhile)
      card.innerHTML = ''; answers.innerHTML = '';
      holdFor(() => { deal(); draw(q.order); if (helpOn) fillHelp(); });
      const v = (() => { try { return live.ready(); } catch (e) { return null; } })();
      line.textContent = (v && v.why) || 'Getting ready...'; line.className = 'pnj-line is-wait';
    } else { deal(); draw(q.order); if (helpOn) fillHelp(); }
    showLevel(); helpBtn.classList.remove('is-nudge');
  }
  // the end card: { html (its card), buttons: [{ label, again }] }: a button with `again` starts over (again() first, then
  // a new question), one without is Done
  function showEnd(end, slide) {
    q = null;
    const put = () => {
      card.classList.remove('is-done', 'is-out');
      card.innerHTML = end.html;
      answers.innerHTML = ''; answers.classList.remove('is-waiting', 'is-wide', 'is-pics');
      for (const B of end.buttons || []) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pnj-coin pnj-endbtn' + (B.again ? ' is-again' : '');
        b.innerHTML = `<b>${esc(B.label)}</b>`;
        b.addEventListener('click', () => { if (closed) return; if (B.again) { B.again(); next({ slide: 1 }); } else close(); });
        answers.appendChild(b);
      }
      line.textContent = ''; line.className = 'pnj-line';
      if (helpOn) help(false);
      el.classList.add('is-over'); helpBtn.classList.remove('is-nudge');
      busy = false;
      card.classList.add('is-in'); setTimeout(() => card.classList.remove('is-in'), 400);
    };
    if (!slide) { put(); return; }
    busy = true; card.classList.add('is-out');
    setTimeout(() => { if (!closed) put(); }, 260);
  }
  function readyNow() {
    const ready = live && typeof live === 'object' && live.ready;
    if (!ready) return true;
    try { const v = ready(); return v === true || !!(v && v.ok); } catch (e) { return true; }
  }
  function holdFor(then) {
    clearInterval(waitTimer);
    // (not busy, as the cards are not changing over yet: the last card's buttons are shut by is-waiting; the card itself
    // says it is done, faded, so its picture of where things were is not taken for where they are now)
    busy = false;
    answers.classList.add('is-waiting');
    card.classList.add('is-done');
    const top = card.querySelector('.pnj-cardtop small'); if (top) top.textContent = 'Done';
    waitTimer = setInterval(() => {
      if (closed) { clearInterval(waitTimer); waitTimer = 0; return; }
      if (!readyNow()) return;
      clearInterval(waitTimer); waitTimer = 0;
      then();
    }, 150);
  }

  // ── an answer ─────────────────────────────────────────────────────────────────────────────────────────────────
  function pick(i) {
    if (busy || !q || q.done || closed || answers.classList.contains('is-waiting')) return null;
    // (a question answered by doing, the dock's squares to brace: picked by the job once it is done, never by a key)
    if (q.order.play && !q.order.played) return null;
    const btn = answers.children[i];
    if (!btn || btn.classList.contains('is-dull')) return null;
    const r = q.answer ? q.answer(q, i, { ms: performance.now() - t0, helped }) : E.answer(crew, job, q, i, { ms: performance.now() - t0, helped, pay });
    if (!r) return null;
    onSave();
    // (a job joined to its props hears each pick: the crane operator job's crane makes the move, or shows the wrong one's path)
    const coin = q.order.coins[i];
    if (live && typeof live === 'object') { try { (r.right ? live.right : live.wrong)?.(q, coin); } catch (e) { console.warn('Pi Nebula: the job\'s props could not take the answer', e); } }
    if (r.right) {
      busy = true;
      btn.classList.add('is-right');
      line.textContent = q.order.rightWhy || 'Right!'; line.className = 'pnj-line is-right';
      if (r.pay) fly(btn, r.pay);
      showCredits(r.pay); onCredits(r.credits, r.pay);
      if (r.up) showLevel('Up a level!');
      else if (r.down) showLevel('A level easier for now');
      else showLevel();
      setTimeout(() => { if (closed) return; next({ slide: 1 }); }, PANEL.nextMs);
    } else {
      btn.classList.add('is-wrong', 'is-dull');
      setTimeout(() => btn.classList.remove('is-wrong'), PANEL.shakeMs);
      line.textContent = r.why || 'Not that one. Try another.'; line.className = 'pnj-line is-wrong';
      helpBtn.classList.add('is-nudge');
      if (r.down) showLevel();
    }
    return r;
  }
  // the credits fly from the button to the count
  function fly(from, pay) {
    const a = from.getBoundingClientRect(), b = $('.pnj-cr').getBoundingClientRect();
    const chip = document.createElement('span');
    chip.className = 'pnj-fly'; chip.textContent = `+${pay}`;
    chip.style.left = `${a.left + a.width / 2}px`; chip.style.top = `${a.top + a.height / 2}px`;
    document.body.appendChild(chip);
    requestAnimationFrame(() => { chip.style.transform = `translate(${b.left + 20 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(0.7)`; chip.style.opacity = '0.2'; });
    setTimeout(() => chip.remove(), 900);
  }

  // ── help ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const stepsOf = (o) => {
    if (o.help && o.help.steps) return o.help.steps.map((s) => ({ text: s }));
    const s = o.sum; if (!s) return [];
    const list = s.chain || [s];
    const ORD = ['First', 'Then', 'Then', 'Then'];
    return list.map((x, i) => {
      const w = sumWords(x).split(' '), c = x.carried || {};
      if (c.a != null) w[0] = '?';
      if (c.b != null) w[w.length - 1] = '?';
      const say = x.say ? x.say : list.length > 1 ? `${ORD[i] || 'Then'}` : 'The sum';
      return { text: `${say}: ${w.join(' ')}` };
    });
  };
  function fillHelp() {
    if (!q) return;
    const o = q.order, pic = helpPicture(o);
    $('.pnj-htitle').textContent = pic.title || 'Help';
    // (a picture already on the card, the things to count, isn't drawn twice)
    $('.pnj-pic:not(.is-lead)').innerHTML = o.picFirst ? '' : pic.svg || '';
    $('.pnj-hline').textContent = pic.line || '';
    const st = stepsOf(o);
    $('.pnj-steps').innerHTML = st.map((s) => `<li>${esc(s.text)}</li>`).join('');
    $('.pnj-steps').hidden = !st.length;
    $('.pnj-paper').hidden = !o.sum;
  }
  function help(on = !helpOn) {
    helpOn = !!on && !!q;   // (no question, the try's end card: nothing to help with)
    helpEl.hidden = !helpOn; el.classList.toggle('is-help', helpOn);
    helpBtn.setAttribute('aria-pressed', String(helpOn));
    // (help opens under the answers: on a tall card, the dock's with its picture, below the panel's fold, so it is
    // brought into view)
    if (helpOn) { helped = true; helpBtn.classList.remove('is-nudge'); fillHelp(); requestAnimationFrame(() => { if (helpOn) helpEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }); } else closeSheet();
    return helpOn;
  }
  helpBtn.addEventListener('click', () => help());
  $('.pnj-hx').addEventListener('click', () => help(false));
  // Mathwood's worked sheet, on the question's own sums (it stays as a small note once worked)
  function closeSheet() { if (sheet) { try { sheet.close(); } catch (e) { /* gone */ } sheet = null; } }
  $('.pnj-paper').addEventListener('click', () => {
    const s = q && q.order.sum; if (!s) return;
    closeSheet();
    let work = null, chain = null;
    try {
      if (s.chain) chain = s.chain.map((x) => ({ work: workOf(x), sum: x, say: x.say || '', carried: x.carried || null }));
      else work = workOf(s);
    } catch (e) { console.warn(e); return; }
    sheet = openLongWork(document.body, { work, chain, title: 'Work it out', ask: q.order.ask, closeLabel: 'Close', free: true, stay: true,
      onClose: () => { sheet = null; }, onGone: () => { sheet = null; } });
  });

  // ── keys and closing ──────────────────────────────────────────────────────────────────────────────────────────
  function onKey(e) {
    if (closed) return;
    if (document.querySelector('.bml:not(.is-out)')) return;   // (the worked sheet has the keys while it is up)
    if (levelsSheet) return;                                     // (and the levels sheet: ui/levels.js)
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (helpOn) help(false); else close(); return; }
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); help(); return; }
    if (/^[1-4]$/.test(e.key)) { e.preventDefault(); pick(+e.key - 1); }
  }
  addEventListener('keydown', onKey, true);
  $('.pnj-x').addEventListener('click', () => close());
  // (silent: the panel goes without its job ending: the crane game's switch to free control)
  function close(silent = false) {
    if (closed) return;
    closed = true; closeSheet(); clearInterval(waitTimer);
    if (levelsSheet) { const L = levelsSheet; levelsSheet = null; L.close(); }
    removeEventListener('keydown', onKey, true);
    el.classList.add('is-going');
    setTimeout(() => el.remove(), 250);
    if (!silent) onClose();
  }

  if (live && typeof live === 'object' && live.mount) live.mount(el);
  showCredits(); next();
  requestAnimationFrame(() => el.classList.add('is-on'));
  return {
    el, close, pick, help, step,
    state: () => ({ job: job.id, level: q && q.level.id, levelN: E.level(crew, job), story: q && q.order.story, ask: q && q.order.ask, coins: q ? q.order.coins.map((c) => ({ label: c.label, good: c.good })) : [],
      key: q && q.order.key, facts: q && q.order.facts,
      right: q ? q.order.coins.findIndex((c) => c.good) : -1, busy, waiting: answers.classList.contains('is-waiting'), help: helpOn, done: q && q.done, credits: E.credits(crew), sheet: !!sheet }),
  };
}
