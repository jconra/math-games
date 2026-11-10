// flag.js: the small feedback pieces on screen (what they send is src/feedback.js).
//
//   flagCard(el, info, { show })  marks a question card: what is asked there and then (what was asked, the choices,
//                                 what was picked so far, the right answer). Nothing is drawn on the card any more:
//                                 the old "Confusing?" chip's job is now the help button's ("?", top corner:
//                                 src/ui/helpmenu.js), whose form fills in the question on screen from these cards and
//                                 sends it the same way the chip's mark was sent (FB.send('question', ...)). One line
//                                 per card:
//                                   flagCard(cardEl, () => ({ text, choices, right, picked, strand, pct, job }))
//                                 info() may leave any of them out (the job comes from the game, the strand, the point
//                                 and the answers picked lately from the last answers recorded, the text from the card),
//                                 or return null when the card isn't a question just now. show() (optional) says whether
//                                 it counts now. Calling it again on the same card only swaps info (a card rebuilt each
//                                 question).
//   flagAsker(asker, job, card)   the same for a builder's question card (labs/*/builder.js): wraps the asker's
//                                 asked(q) and answered(q, right) in place and returns it. card() -> the card element
//                                 (siteCard by default: the card of the build site open now)
//   questionNow(job)              the question on screen now, gathered from the marked card that can be seen (the one
//                                 for this job first), or null
//   sendQuestion(data)            sends a question's report (the help menu's form: helpplan.js reportOf)
//   rateJob(job)                  a thumbs up / down chip low in the middle for a job just finished; it fades by itself
//   menuRows({ report })          the pause menu's "Tell us" (or "Maker's note" with ?maker) and the share switch:
//                                 -> [tellButton, tellBox, shareButton] to put among the menu's buttons
//   NO_NAMES, hush(el), ensureCss()   for the help menu's form (the same words, the same taps kept off the game)
//
// Nothing here ever blocks play, and the keys typed into a note never reach the game (they are stopped before any of
// the game's own key listeners: anything marked data-bmfb-type, the help menu's box too).

import { FB } from '../feedback.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plain = (t) => String(t == null ? '' : t).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const cap = (t, n) => { const s = plain(t); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
export const NO_NAMES = "Please don't put names in here.";
export const JOB_WORDS = { roundup: 'the round-up', sheep: 'doctoring the sheep', pigs: 'penning the pigs', store: 'the store counter',
  delivery: 'the delivery', wagon: 'guarding the wagon', deer: 'the deer photographs', range: 'the bottle range', loot: "the gang's loot",
  boxes: 'the lock boxes', windmill: 'building the windmill', bridge: 'building the bridge', fishing: 'fishing' };
export const FLAG = { rateMs: 9000, rateAgainMs: 10 * 60000 };

// ── STYLE ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function ensureCss() {
  if (typeof document === 'undefined' || document.getElementById('bmfb-css')) return;
  const s = document.createElement('style'); s.id = 'bmfb-css';
  s.textContent = `
:root { --bmfb-paper: #f6ecd6; --bmfb-ink: #2c1d12; --bmfb-ink2: #5d4a36; --bmfb-edge: #a8865a; --bmfb-btn: #6d4b2b; --bmfb-btn-hi: #82593a; --bmfb-cream: #f4e8cf; --bmfb-good: #4f7a32; }
.bmfb-tell small.bmfb-nonames { display: block; margin-top: 5px; font-size: 12px; color: var(--bmfb-ink2); }
.bmfb-tell button { font: 600 14px Bitter, Georgia, serif; color: var(--bmfb-cream); background: var(--bmfb-btn);
  border: 1px solid #3b2a1e; border-radius: 6px; padding: 6px 11px; cursor: pointer; }
.bmfb-tell button:hover { background: var(--bmfb-btn-hi); }
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
export const hush = (el) => { for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'dblclick']) el.addEventListener(t, (e) => e.stopPropagation()); };

// ── THE QUESTION CARDS: what the help menu's form fills in ─────────────────────────────────────────────────────────
function gather(el, o) {
  o = o && typeof o === 'object' ? { ...o } : {};
  let c = {}; try { c = FB.context() || {}; } catch (e) { c = {}; }
  const job = o.job || c.job || null;
  const recent = FB.recent(90000).filter((a) => !job || !a.job || a.job === job);
  const last = recent[recent.length - 1] || null;
  let text = o.text;
  if (text == null) { try { text = el.innerText || el.textContent || ''; } catch (e) { text = ''; } }
  return {
    job, strand: o.strand ?? (last ? last.strand : null), pct: o.pct ?? (last ? last.pct : null), step: o.step ?? null,
    text: cap(text, 900), choices: Array.isArray(o.choices) ? o.choices.slice(0, 12).map((x) => cap(x, 80)) : null,
    picked: Array.isArray(o.picked) ? o.picked.slice(0, 12).map((x) => (typeof x === 'string' ? cap(x, 80) : x)) : recent.slice(-6).map((a) => ({ strand: a.strand, pct: a.pct, right: a.right })),
    right: o.right == null ? null : typeof o.right === 'object' ? o.right : cap(o.right, 120),
    hint: o.hint ? cap(o.hint, 300) : null, place: c.place || null, tier: c.tier || null,
  };
}

const cards = new Set();   // the marked cards: { el, info, show, at (the order they were marked in) }
let marks = 0;
// can it be seen now: on the page, not hidden or faded out (a slip slid away keeps its place in the page), on screen
function seen(el) {
  if (!el || !el.isConnected) return false;
  try {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (e.hidden) return false;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  } catch (e) { return false; }
}
export function flagCard(el, info = null, { show = null } = {}) {
  try {
    if (!el || typeof document === 'undefined') return null;
    let F = el._bmFlag;
    if (!F) { F = { el, info, show }; el._bmFlag = F; cards.add(F); }
    F.info = info; if (show) F.show = show; F.at = ++marks;
    return el;
  } catch (e) { return null; }
}
// the question on screen now: the marked cards that can be seen and say they are a question (info() not null, show()
// not false), this job's first, then the one marked last
export function questionNow(job = null) {
  if (typeof document === 'undefined') return null;
  const up = [];
  for (const F of cards) {
    if (!F.el.isConnected) continue;
    try { if (F.show && !F.show()) continue; } catch (e) { continue; }
    if (!seen(F.el)) continue;
    let o = null; try { o = typeof F.info === 'function' ? F.info() : F.info; } catch (e) { o = null; }
    if (F.info != null && o == null) continue;   // (the card isn't a question just now)
    up.push({ F, q: gather(F.el, o) });
  }
  if (!up.length) return null;
  up.sort((a, b) => (Number(b.q.job === job) - Number(a.q.job === job)) || b.F.at - a.F.at);
  return up[0].q;
}
// a question's report, sent as the old chip's mark was (src/feedback.js: kind 'question')
export const sendQuestion = (data) => FB.send('question', data);

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
      try { const el = card(); if (el) flagCard(el, info); } catch (e) { /* (the mark is a help, never in the way) */ }
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
