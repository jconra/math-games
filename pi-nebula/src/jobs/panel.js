// THE JOB PANEL: one question at a time, over the station, beside the job's own props (the serving counter, the
// triage desk). The same eight-sided glass as the title screen.
//
//   the top strip    the job's name, the level with its arrows (Mathwood's level tool: ◀ 9 of 14: Recipes made bigger ▶,
//                    a thin bar for the right answers toward the next level), and "Done" (Esc)
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
//
//   const J = openPanel(root, { job, crew, live, onClose, onSave, onCredits })    J.close(), J.state() (for rigs),
//   J.pick(i), J.help(), J.step(dir). live: a function giving what the job's props are doing right now (the smelter's
//   load in the hangar), or an object joined to them (the crane operator job: src/jobs/cranelink.js): { now() for the
//   makers, right(q, coin) and wrong(q, coin) told of each pick, close() }; asked once for each new question; or null
import * as E from './engine.js';
import { helpPicture } from './pics.js';
import { openLongWork } from '../../../mathwood-valley/src/ui/longwork.js';
import { workOf, sumWords } from '../../../mathwood-valley/src/math/longwork.js';

const CSS = new URL('./jobs.css', import.meta.url).href;
export function ensureCss() {
  if (document.querySelector('link[data-pnj]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.dataset.pnj = '1'; document.head.appendChild(l);
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const PANEL = { nextMs: 1350, shakeMs: 420 };

export function openPanel(root, { job, crew, live = null, onClose = () => {}, onSave = () => {}, onCredits = () => {} } = {}) {
  ensureCss();
  const el = document.createElement('div');
  el.className = 'pnj';
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
      <div class="pnj-foot"><button type="button" class="pnj-helpbtn" data-askhelp>Help<kbd>H</kbd></button></div>
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
    $('.pnj-lvwords').textContent = flash || `Level ${v.i + 1} of ${v.n}: ${v.title}`;
    $('.pnj-lv').title = v.note;
    $('.pnj-lv').classList.toggle('is-flash', !!flash);
    $('.pnj-bar i').style.width = `${Math.round((v.placing ? 0 : v.fill) * 100)}%`;
    $('.pnj-bar').classList.toggle('is-placing', v.placing);
    const [dn, up] = el.querySelectorAll('.pnj-arrow');
    dn.disabled = !v.canDown; up.disabled = !v.canUp; dn.hidden = up.hidden = !v.pick;
  }
  el.querySelectorAll('.pnj-arrow').forEach((b) => b.addEventListener('click', () => step(+b.dataset.dir)));
  function step(dir) {
    if (busy) return null;
    const v = E.step(crew, job, dir);
    if (!v) return null;
    onSave();
    next({ slide: dir });
    return v;
  }

  // ── the card ──────────────────────────────────────────────────────────────────────────────────────────────────
  function sceneHtml(o) {
    const who = o.who || null;
    if (job.card === 'chart') {
      return `<header class="pnj-cardtop is-chart"><span class="pnj-icon is-cross" aria-hidden="true"></span><b>Patient chart</b><small>Triage</small></header>
        ${who ? `<dl class="pnj-chart"><div><dt>Patient</dt><dd>${esc(who.name)}</dd></div>${who.why ? `<div><dt>In for</dt><dd>${esc(who.why)}</dd></div>` : ''}</dl>` : ''}`;
    }
    if (job.card === 'workorder') {
      // (the crane operator job: a move of the crane's that is about to be made, or one from the log)
      const now = !!(o.facts && o.facts.live);
      return `<header class="pnj-cardtop is-order"><span class="pnj-icon is-hook" aria-hidden="true"></span><b>Work order</b><small>${now ? 'The crane, right now' : 'From the log'}</small></header>`;
    }
    if (job.card === 'payslip') {
      // (a count taken from the hangar as the slip was made says so; any other slip is someone's load from the log)
      const now = !!(o.facts && o.facts.live);
      return `<header class="pnj-cardtop is-slip"><span class="pnj-icon is-bar" aria-hidden="true"></span><b>Pay slip</b><small>${now ? 'The hangar, right now' : who ? `${esc(who.name)}'s load` : 'From the log'}</small></header>`;
    }
    return `<header class="pnj-cardtop is-recipe"><span class="pnj-icon is-pot" aria-hidden="true"></span><b>Galley order</b><small>${who ? `from ${esc(who.name)}` : 'Recipe card'}</small></header>`;
  }
  // an order with rows of its own (the whole pay slip): the rows are the story, set out as the slip
  const storyHtml = (o) => (o.lines && o.lines.length
    ? `<dl class="pnj-chart is-slip">${o.lines.map(([k, v]) => `<div${v === '?' ? ' class="is-ask"' : ''}><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
    : `<p class="pnj-story">${esc(o.story)}</p>`);
  function draw(o) {
    const pic = o.picFirst ? helpPicture(o) : null;
    card.innerHTML = `${sceneHtml(o)}
      ${storyHtml(o)}
      ${pic && pic.svg ? `<div class="pnj-pic is-lead">${pic.svg}</div>` : ''}
      <p class="pnj-ask">${esc(o.ask)}</p>`;
    answers.innerHTML = '';
    answers.classList.toggle('is-wide', o.coins.some((c) => String(c.big).length > 7));
    o.coins.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pnj-coin'; b.dataset.i = String(i);
      b.setAttribute('aria-label', c.label);
      b.innerHTML = `<b>${esc(c.big)}</b>${c.small ? `<small>${esc(c.small)}</small>` : ''}`;
      b.addEventListener('click', () => pick(i));
      answers.appendChild(b);
    });
    line.textContent = ''; line.className = 'pnj-line';
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
    let now = null;
    const read = live ? (typeof live === 'function' ? live : live.now) : null;
    if (read) { try { now = read(); } catch (e) { console.warn('Pi Nebula: the job could not read its props', e); } }
    q = E.deal(crew, job, { last: lastAsk, live: now });
    lastAsk = q.order.ask_ || null;
    onSave();
    helped = helpOn; t0 = performance.now();
    if (slide) {
      // (no picks while the cards change over: the buttons on screen are still the last card's)
      busy = true;
      card.classList.add('is-out');
      setTimeout(() => { if (closed) return; card.classList.remove('is-out'); draw(q.order); busy = false; t0 = performance.now(); card.classList.add('is-in'); setTimeout(() => card.classList.remove('is-in'), 400); }, 260);
    } else draw(q.order);
    showLevel(); helpBtn.classList.remove('is-nudge');
    if (helpOn) fillHelp();
  }

  // ── an answer ─────────────────────────────────────────────────────────────────────────────────────────────────
  function pick(i) {
    if (busy || !q || q.done || closed || answers.classList.contains('is-waiting')) return null;
    const btn = answers.children[i];
    if (!btn || btn.classList.contains('is-dull')) return null;
    const r = E.answer(crew, job, q, i, { ms: performance.now() - t0, helped });
    if (!r) return null;
    onSave();
    // (a job joined to its props hears each pick: the crane operator job's crane makes the move, or shows the wrong one's path)
    const coin = q.order.coins[i];
    if (live && typeof live === 'object') { try { (r.right ? live.right : live.wrong)?.(q, coin); } catch (e) { console.warn('Pi Nebula: the job\'s props could not take the answer', e); } }
    if (r.right) {
      busy = true;
      btn.classList.add('is-right');
      line.textContent = q.order.rightWhy || 'Right!'; line.className = 'pnj-line is-right';
      fly(btn, r.pay);
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
    helpOn = !!on;
    helpEl.hidden = !helpOn; el.classList.toggle('is-help', helpOn);
    helpBtn.setAttribute('aria-pressed', String(helpOn));
    if (helpOn) { helped = true; helpBtn.classList.remove('is-nudge'); fillHelp(); } else closeSheet();
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
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (helpOn) help(false); else close(); return; }
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); help(); return; }
    if (/^[1-4]$/.test(e.key)) { e.preventDefault(); pick(+e.key - 1); }
  }
  addEventListener('keydown', onKey, true);
  $('.pnj-x').addEventListener('click', () => close());
  function close() {
    if (closed) return;
    closed = true; closeSheet();
    removeEventListener('keydown', onKey, true);
    el.classList.add('is-going');
    setTimeout(() => el.remove(), 250);
    onClose();
  }

  showCredits(); next();
  requestAnimationFrame(() => el.classList.add('is-on'));
  return {
    el, close, pick, help, step,
    state: () => ({ job: job.id, level: q && q.level.id, levelN: E.level(crew, job), story: q && q.order.story, ask: q && q.order.ask, coins: q ? q.order.coins.map((c) => ({ label: c.label, good: c.good })) : [],
      key: q && q.order.key, facts: q && q.order.facts,
      right: q ? q.order.coins.findIndex((c) => c.good) : -1, busy, waiting: answers.classList.contains('is-waiting'), help: helpOn, done: q && q.done, credits: E.credits(crew), sheet: !!sheet }),
  };
}
