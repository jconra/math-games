// flag.js: the small feedback pieces on screen (what they send is src/feedback.js).
//
//   flagCard(el, info, { style })   a small "Confusing?" chip on a question card. Tapping it marks the question there
//                                 and then (what was asked, the choices, what was picked so far, the right answer) and
//                                 offers a one-line note; the mark is sent with the note, or on its own when the note
//                                 is skipped or left (about 25 s). One line per card:
//                                   flagCard(cardEl, () => ({ text, choices, right, picked, strand, pct, job }))
//                                 info() may leave any of them out (the job comes from the game, the strand, the point
//                                 and the answers picked lately from the last answers recorded, the text from the card),
//                                 or return null when the card isn't a question just now (the chip hides).
//                                 Calling it again on the same card only swaps info (a card rebuilt each question).
//   flagAsker(asker, job, card)   the same chip for a builder's question card (labs/*/builder.js): wraps the asker's
//                                 asked(q) and answered(q, right) in place and returns it. card() -> the card element
//                                 (siteCard by default: the card of the build site open now)
//   rateJob(job)                  a thumbs up / down chip low in the middle for a job just finished; it fades by itself
//   menuRows({ report })          the pause menu's "Tell us" (or "Maker's note" with ?maker) and the share switch:
//                                 -> [tellButton, tellBox, shareButton] to put among the menu's buttons
//
// Nothing here ever blocks play: no screen to click through, the game keeps going while a note is typed, and the keys
// typed into a note never reach the game (they are stopped before any of the game's own key listeners).

import { FB } from '../feedback.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plain = (t) => String(t == null ? '' : t).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const cap = (t, n) => { const s = plain(t); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const NO_NAMES = "Please don't put names in here.";
export const JOB_WORDS = { roundup: 'the round-up', sheep: 'doctoring the sheep', pigs: 'penning the pigs', store: 'the store counter',
  delivery: 'the delivery', wagon: 'guarding the wagon', deer: 'the deer photographs', range: 'the bottle range', loot: "the gang's loot",
  boxes: 'the lock boxes', windmill: 'building the windmill', bridge: 'building the bridge', fishing: 'fishing' };
export const FLAG = { noteMs: 25000, rateMs: 9000, rateAgainMs: 10 * 60000 };

// ── STYLE ───────────────────────────────────────────────────────────────────────────────────────────────────────
function ensureCss() {
  if (typeof document === 'undefined' || document.getElementById('bmfb-css')) return;
  const s = document.createElement('style'); s.id = 'bmfb-css';
  s.textContent = `
:root { --bmfb-paper: #f6ecd6; --bmfb-ink: #2c1d12; --bmfb-ink2: #5d4a36; --bmfb-edge: #a8865a; --bmfb-btn: #6d4b2b; --bmfb-btn-hi: #82593a; --bmfb-cream: #f4e8cf; --bmfb-good: #4f7a32; }
.bmfb-flag { position: absolute; right: 10px; bottom: 0; transform: translateY(55%); z-index: 4; pointer-events: auto; cursor: pointer;
  font: 600 12px/1 Bitter, Georgia, serif; color: var(--bmfb-ink2); background: var(--bmfb-paper); border: 1px solid var(--bmfb-edge);
  border-radius: 999px; padding: 4px 9px; box-shadow: 0 1px 3px rgba(0,0,0,0.25); opacity: 0.88; white-space: nowrap; }
.bmfb-flag:hover { opacity: 1; color: var(--bmfb-ink); }
.bmfb-flag[hidden] { display: none; }
.bmfb-flag.is-marked { color: var(--bmfb-cream); background: var(--bmfb-btn); border-color: #3b2a1e; opacity: 1; }
@media (pointer: coarse) { .bmfb-flag { font-size: 13px; padding: 6px 11px; } }
.bmfb-note { position: fixed; z-index: 95; width: min(330px, calc(100vw - 32px)); box-sizing: border-box; padding: 10px 12px 9px;
  background: var(--bmfb-paper); color: var(--bmfb-ink); border: 1px solid var(--bmfb-edge); border-radius: 10px;
  box-shadow: 0 6px 22px rgba(0,0,0,0.35); font: 500 14px/1.3 Bitter, Georgia, serif; pointer-events: auto; }
.bmfb-note b { display: block; font-weight: 700; margin-bottom: 6px; }
.bmfb-note .bmfb-row { display: flex; gap: 6px; }
.bmfb-note input { flex: 1; min-width: 0; font: 500 15px Bitter, Georgia, serif; padding: 6px 8px; border: 1px solid var(--bmfb-edge);
  border-radius: 6px; background: #fffaf0; color: var(--bmfb-ink); }
.bmfb-note small, .bmfb-tell small.bmfb-nonames { display: block; margin-top: 5px; font-size: 12px; color: var(--bmfb-ink2); }
.bmfb-note button, .bmfb-tell button { font: 600 14px Bitter, Georgia, serif; color: var(--bmfb-cream); background: var(--bmfb-btn);
  border: 1px solid #3b2a1e; border-radius: 6px; padding: 6px 11px; cursor: pointer; }
.bmfb-note button:hover, .bmfb-tell button:hover { background: var(--bmfb-btn-hi); }
.bmfb-note .bmfb-x { position: absolute; top: 4px; right: 5px; padding: 1px 7px; background: transparent; color: var(--bmfb-ink2); border: 0; font-size: 18px; }
.bmfb-note .bmfb-x:hover { background: transparent; color: var(--bmfb-ink); }
.bmfb-rate { position: fixed; left: 50%; bottom: 132px; z-index: 34; transform: translate(-50%, 8px); opacity: 0; pointer-events: none;
  display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 14px; border-radius: 999px; background: rgba(36, 24, 14, 0.88);
  color: #f1e6cc; font: 600 14px Bitter, Georgia, serif; border: 1px solid #8a6a3a; transition: opacity 0.35s, transform 0.35s; white-space: nowrap; }
.bmfb-rate.is-on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
.bmfb-rate button { display: grid; place-items: center; width: 36px; height: 32px; padding: 0; border-radius: 999px; cursor: pointer;
  background: #6d4b2b; border: 1px solid #3b2a1e; color: #f4e8cf; }
.bmfb-rate button:hover { background: #82593a; }
.bmfb-rate svg { width: 19px; height: 19px; }
@media (max-width: 760px), (max-height: 480px) { .bmfb-rate { bottom: auto; top: 30%; font-size: 13px; } .bmfb-rate button { width: 42px; height: 38px; } }
.bmfb-tell { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 8px; background: rgba(255, 250, 235, 0.55); border: 1px solid var(--bmfb-edge); }
.bmfb-tell[hidden] { display: none; }
.bmfb-tell textarea { width: 100%; box-sizing: border-box; min-height: 72px; resize: vertical; font: 500 15px/1.35 Bitter, Georgia, serif;
  padding: 7px 9px; border: 1px solid var(--bmfb-edge); border-radius: 6px; background: #fffaf0; color: var(--bmfb-ink); }
.bmfb-tell .bmfb-row { display: flex; align-items: center; gap: 12px; }
.bms-menu .bmfb-tell button { width: auto; flex: none; padding: 7px 18px; font-size: 15px; text-align: center; }
.bmfb-tell .bmfb-sent { color: var(--bmfb-good); font-weight: 700; }
.bmfb-tell .bmfb-what { font-size: 12px; color: var(--bmfb-ink2); }
`;
  document.head.appendChild(s);
}

// ── KEYS TYPED INTO A NOTE NEVER REACH THE GAME ─────────────────────────────────────────────────────────────────
// (on the window, in the capture phase, added when this module loads: before every one of the game's own key
// listeners, so W, digits, U, H or Esc typed in a note neither move the rider nor press a lock-box button. Stopping
// the event this early still lets the letter be typed.)
const typing = (e) => !!(e.target && e.target.closest && e.target.closest('[data-bmfb-type]'));
function guard(e) {
  if (!typing(e)) return;
  e.stopImmediatePropagation();
  if (e.type !== 'keydown') return;
  if (e.key === 'Escape') { e.preventDefault(); e.target.blur(); return; }   // (Esc lets go of the box; a second Esc closes the menu)
  if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    const go = e.target.closest('[data-bmfb-form]'); const b = go && go.querySelector('[data-bmfb-send]'); if (b) b.click();
  }
}
try { if (typeof addEventListener === 'function') for (const t of ['keydown', 'keyup', 'keypress']) addEventListener(t, guard, true); } catch (e) { /* (no page) */ }
// (a tap or a click on these never reaches the valley or the card under them as a pick, a shot or a drag)
const hush = (el) => { for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'dblclick']) el.addEventListener(t, (e) => e.stopPropagation()); };

// ── "CONFUSING?" ON A QUESTION CARD ─────────────────────────────────────────────────────────────────────────────
function gather(el, info) {
  let o = null;
  try { o = typeof info === 'function' ? info() : info; } catch (e) { o = null; }
  o = o && typeof o === 'object' ? { ...o } : {};
  let c = {}; try { c = FB.context() || {}; } catch (e) { c = {}; }
  const job = o.job || c.job || null;
  const recent = FB.recent(90000).filter((a) => !job || !a.job || a.job === job);
  const last = recent[recent.length - 1] || null;
  const own = el.querySelector(':scope > .bmfb-flag');
  let text = o.text;
  if (text == null) { try { text = (el.innerText || el.textContent || '').replace(own ? own.textContent : '', ''); } catch (e) { text = ''; } }
  return {
    job, strand: o.strand ?? (last ? last.strand : null), pct: o.pct ?? (last ? last.pct : null), step: o.step ?? null,
    text: cap(text, 900), choices: Array.isArray(o.choices) ? o.choices.slice(0, 12).map((x) => cap(x, 80)) : null,
    picked: Array.isArray(o.picked) ? o.picked.slice(0, 12).map((x) => (typeof x === 'string' ? cap(x, 80) : x)) : recent.slice(-6).map((a) => ({ strand: a.strand, pct: a.pct, right: a.right })),
    right: o.right == null ? null : typeof o.right === 'object' ? o.right : cap(o.right, 120),
    hint: o.hint ? cap(o.hint, 300) : null, place: c.place || null, tier: c.tier || null,
  };
}

let note = null;   // the one note box open now
function closeNote(send = true) {
  if (!note) return;
  const n = note; note = null;
  clearTimeout(n.timer); removeEventListener('resize', n.place);
  n.box.remove();
  if (send) FB.send('question', { ...n.q, note: n.input.value.trim().slice(0, 300) || null });
  n.chip.textContent = send ? 'Sent, thanks!' : 'Confusing?';
  setTimeout(() => { n.chip.classList.remove('is-marked'); n.chip.textContent = 'Confusing?'; }, send ? 2200 : 0);
}
function openNote(chip, q) {
  closeNote(true);
  const box = document.createElement('div'); box.className = 'bmfb-note'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'A note about this question');
  box.dataset.bmfbForm = '1';
  box.innerHTML = `<button type="button" class="bmfb-x" aria-label="No note">×</button><b>Marked, thank you! Want to say why?</b>
    <div class="bmfb-row"><input type="text" maxlength="300" data-bmfb-type="1" placeholder="What was confusing?" aria-label="What was confusing"><button type="button" data-bmfb-send="1">Send</button></div>
    <small>${NO_NAMES}</small>`;
  hush(box);
  document.body.appendChild(box);
  const input = box.querySelector('input');
  // beside the card when there is room (the card's hint line under it stays in view), else under the chip, else above
  const card = chip.parentNode && chip.parentNode.getBoundingClientRect ? chip.parentNode : chip;
  const place = () => {
    const r = chip.getBoundingClientRect(), c = card.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight, vw = innerWidth, vh = innerHeight;
    const yy = Math.min(Math.max(8, c.top), vh - h - 8);
    let x, y;
    if (c.right + 10 + w <= vw - 16) { x = c.right + 10; y = yy; }
    else if (c.left - 10 - w >= 16) { x = c.left - 10 - w; y = yy; }
    else { x = Math.min(Math.max(16, r.right - w), vw - w - 16); y = r.bottom + 8; if (y + h > vh - 8) y = Math.max(8, r.top - h - 8); }
    box.style.left = `${x}px`; box.style.top = `${y}px`;
  };
  place();
  note = { box, input, chip, q, place, timer: setTimeout(() => closeNote(true), FLAG.noteMs) };
  addEventListener('resize', place);
  // (typing holds the box open; it goes off by itself a while after the last key)
  input.addEventListener('input', () => { if (!note) return; clearTimeout(note.timer); note.timer = setTimeout(() => closeNote(true), FLAG.noteMs * 2); });
  box.querySelector('[data-bmfb-send]').addEventListener('click', () => closeNote(true));
  box.querySelector('.bmfb-x').addEventListener('click', () => closeNote(true));
  // (no focus on a touch screen: the keyboard would cover the game; a click into the box brings it up)
  if (!(matchMedia && matchMedia('(pointer: coarse)').matches)) setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (e) { /* */ } }, 30);
}

export function flagCard(el, info = null, { style = '', show = null } = {}) {
  try {
    if (!el || typeof document === 'undefined') return null;
    ensureCss();
    if (el._bmFlag) { el._bmFlag.info = info; if (show) el._bmFlag.show = show; el._bmFlag.attach(); return el._bmFlag.chip; }
    const chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'bmfb-flag'; chip.textContent = 'Confusing?';
    chip.title = 'Mark this question as confusing'; if (style) chip.style.cssText = style;
    hush(chip);
    const F = { chip, info, show };
    chip.addEventListener('click', (e) => {
      e.preventDefault(); chip.blur();
      if (chip.classList.contains('is-marked')) { if (note && note.chip === chip) closeNote(true); return; }
      const q = gather(el, F.info);
      chip.classList.add('is-marked'); chip.textContent = 'Marked';
      openNote(chip, q);
    });
    try { if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; } catch (e) { /* */ }
    const visible = () => { let on = true; try { on = !F.show || !!F.show(); } catch (e) { on = true; } if (chip.hidden === on) chip.hidden = !on; };
    F.attach = () => { if (chip.parentNode !== el) el.appendChild(chip); visible(); };
    F.attach();
    // (a card whose insides are rebuilt for each question gets the chip back; a card that changes kind shows or hides it)
    new MutationObserver(() => F.attach()).observe(el, { childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    el._bmFlag = F;
    return chip;
  } catch (e) { return null; }
}

// a build site's question card (src/buildsite.js opens a lab's builder in a .bsite overlay; its card is #question,
// or #card at the dock)
export const siteCard = () => (typeof document === 'undefined' ? null : document.querySelector('.bsite #question, .bsite #card'));
export function flagAsker(asker, job, card = siteCard) {
  try {
    if (!asker || asker._bmFlagged) return asker;
    let q = null, picks = [];
    const label = (x) => {
      if (!x) return null;
      if (x.answerLabel != null) return plain(x.answerLabel);
      if (Array.isArray(x.labels) && Array.isArray(x.choices)) { const i = x.choices.map(String).indexOf(String(x.answer)); if (i >= 0) return plain(x.labels[i]); }
      return x.answer == null ? null : plain(`${x.answer}${x.unit || ''}`);
    };
    const info = () => (!q ? {} : { job, text: plain(`${q.title || ''} ${q.prompt || ''}`), step: q.level || q.step || null, picked: picks.slice(),
      choices: Array.isArray(q.labels) ? q.labels.map(plain) : Array.isArray(q.choices) ? q.choices.map((c) => plain(`${c}${q.unit || ''}`)) : null, right: label(q) });
    const asked = asker.asked, answered = asker.answered;
    asker.asked = function (x, ...rest) {
      q = x || null; picks = [];
      const r = asked ? asked.call(this, x, ...rest) : undefined;
      try { const el = card(); if (el) flagCard(el, info, { style: 'top:8px;bottom:auto;transform:none' }); } catch (e) { /* (the chip is a help, never in the way) */ }
      return r;
    };
    if (answered) asker.answered = function (x, right, ...rest) { picks.push(right ? 'right' : 'wrong'); return answered.call(this, x, right, ...rest); };
    asker._bmFlagged = true;
  } catch (e) { /* */ }
  return asker;
}

// ── THUMBS UP OR DOWN WHEN A JOB ENDS ───────────────────────────────────────────────────────────────────────────
const THUMB = (down) => `<svg viewBox="0 0 24 24" aria-hidden="true"${down ? ' style="transform:rotate(180deg)"' : ''}><path d="M2.5 10.5h4v10h-4zM8.5 20.5V10.4l4.2-7.1c.4-.6 1.2-.8 1.8-.4 1 .6 1.4 1.8 1.1 2.9l-1 3.7h5.2c1.3 0 2.3 1.2 2 2.5l-1.6 6.8c-.3 1.6-1.7 2.7-3.3 2.7z" fill="currentColor"/></svg>`;
let rateEl = null, rateT = 0;
const rated = {};
export function rateJob(job, { force = false } = {}) {
  try {
    if (!job || typeof document === 'undefined') return false;
    const t = Date.now();
    if (!force && rated[job] && t - rated[job] < FLAG.rateAgainMs) return false;   // (not every wave of the same job)
    rated[job] = t;
    ensureCss();
    if (!rateEl) {
      rateEl = document.createElement('div'); rateEl.className = 'bmfb-rate'; rateEl.setAttribute('role', 'group');
      hush(rateEl); document.body.appendChild(rateEl);
      rateEl.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-up]'); if (!b) return;
        FB.send('rate', { job: rateEl.dataset.job, up: b.dataset.up === '1' });
        rateEl.innerHTML = '<span>Thanks, partner!</span>';
        clearTimeout(rateT); rateT = setTimeout(() => rateEl.classList.remove('is-on'), 1400);
      });
    }
    rateEl.dataset.job = job;
    rateEl.innerHTML = `<span>Did you like ${esc(JOB_WORDS[job] || 'that job')}?</span><button type="button" data-up="1" aria-label="Thumbs up" title="I liked it">${THUMB(false)}</button><button type="button" data-up="0" aria-label="Thumbs down" title="Not much">${THUMB(true)}</button>`;
    rateEl.setAttribute('aria-label', `Rate ${JOB_WORDS[job] || 'that job'}`);
    void rateEl.offsetWidth;
    rateEl.classList.add('is-on');
    clearTimeout(rateT); rateT = setTimeout(() => rateEl.classList.remove('is-on'), FLAG.rateMs);
    return true;
  } catch (e) { return false; }
}
export const rateShown = () => !!(rateEl && rateEl.classList.contains('is-on'));

// ── THE PAUSE MENU: TELL US, AND THE SHARE SWITCH ───────────────────────────────────────────────────────────────
const SHARE_LINE = 'Sends how answers go (right or not, and how long), which jobs are played, and how smooth the game runs. No names.';
export function menuRows({ report = () => ({}) } = {}) {
  ensureCss();
  const maker = FB.maker();
  const name = maker ? "Maker's note" : 'Tell us';
  const tell = document.createElement('button'); tell.type = 'button';
  tell.innerHTML = `${name}<small>${maker ? 'A note for the to-do list, with where you are' : 'Something to tell the people making the game'}</small>`;
  const box = document.createElement('div'); box.className = 'bmfb-tell'; box.hidden = true; box.dataset.bmfbForm = '1';
  box.innerHTML = `<textarea maxlength="1500" data-bmfb-type="1" aria-label="${name}" placeholder="${maker ? 'What to fix or add' : 'A bug, an idea, something you liked'}"></textarea>
    <small class="bmfb-nonames">${NO_NAMES}</small>
    <div class="bmfb-row"><button type="button" data-bmfb-send="1">Send</button><span class="bmfb-what">Where you are in the game is sent with it.</span></div>`;
  const area = box.querySelector('textarea'), sendB = box.querySelector('[data-bmfb-send]'), what = box.querySelector('.bmfb-what');
  tell.addEventListener('click', () => { box.hidden = !box.hidden; if (!box.hidden) setTimeout(() => { try { area.focus({ preventScroll: false }); } catch (e) { /* */ } }, 20); });
  sendB.addEventListener('click', () => {
    const text = area.value.trim().slice(0, 1500);
    if (!text) { area.focus(); return; }
    let r = {}; try { r = report() || {}; } catch (e) { r = { report: 'could not be made: ' + e.message }; }
    FB.send(maker ? 'note' : 'tell', { text, ...r });
    area.value = '';
    what.textContent = 'Sent, thank you!'; what.className = 'bmfb-what bmfb-sent';
    setTimeout(() => { if (what.isConnected) { what.textContent = 'Where you are in the game is sent with it.'; what.className = 'bmfb-what'; } }, 4000);
  });
  const share = document.createElement('button'); share.type = 'button';
  const words = () => { share.setAttribute('aria-pressed', String(FB.sharing())); share.innerHTML = `Share play data to help make the game better: ${FB.sharing() ? 'on' : 'off'}<small>${SHARE_LINE}</small>`; };
  words();
  share.addEventListener('click', () => { FB.setSharing(!FB.sharing()); words(); });
  return [tell, box, share];
}
