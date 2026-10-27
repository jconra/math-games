// The order slip at the general store counter: a parchment slip over the right of the screen (the bottom on a phone) with
// the customer's story, the question, and 3 or 4 coins to pick from (keys 1 to 3 or 1 to 4). A wrong coin shakes and goes dull, and
// the slip shows one plain line about that slip and the picture for that kind of problem (src/ui/storepics.js); then the
// kid picks again. A right coin glows, the coins fly from it into the slip's purse and it counts up, and the slip slides
// away for the next customer's. No buttons between orders; "Done for now" (or Esc) stops.
//
//   const U = makeStoreSlip(root, { onPick(i), onDone(), onDraw(), onWork() })
//   U.show(order, { filled, pic, read, lead, note })   a new slip slides in (filled: orders filled this sitting, for the
//                                 corner; pic: a picture to show from the start ({ svg, title, line }: the youngest riders'
//                                 picture stories); read: show "Read it to me" (the browser's voice reads order.read);
//                                 lead: a picture that is part of the question, above the coins (the grandfather clock
//                                 to read, the coins to count: src/ui/counterpics.js); note: a quiet word in the corner,
//                                 e.g. "finding your level").
//                                 An order with a sum too big for the head (order.long) shows "Work it out" (onWork:
//                                 the job opens the worked area, src/ui/longwork.js); so does any order with a sum
//                                 (order.work) on a phone, where the slip covers the tools strip and its Work it out
//                                 (onWork: the job opens the tools' one). order.wide: word coins, two a row)
//   U.speak(text)                 read a line out loud in the browser's voice (read-aloud for riders who can't read yet)
//   U.wrong(i, { why, pic, inLead })   coin i was wrong: shake it, dull it, show the reason and the picture ({ svg,
//                                 title, line }); inLead: the picture takes the lead picture's place (the clock with
//                                 its minutes written in, where the clock was), and only its words go below
//   U.drawn(pic, { inLead })      the picture without a reason (the kid asked for it: "Draw it")
//   U.offerDraw(on)               the "Draw it" button, offered after a long think
//   U.right(i, { line, gold, from, to, note, news, paid }) -> Promise   coin i was right: glow, the line, coins fly, count up
//                                 (paid: the words for the gold instead of '+3 gold tip', e.g. '+6 gold for your eggs')
//                                 (news: a badge or a new title won with this order, a line under the tip)
//   U.equation(i, { line })       the top step: the equation picked is right; "now crack it" shows (the lock box opens next)
//   U.leave() -> Promise          the slip slides away
//   U.waiting(text)               a quiet line while nobody is at the counter ("Here comes Rosa Vega…")
//   U.purse(n)                    the gold shown in the slip's purse
//   U.busy                        true while a right answer's coins are flying (picks are ignored)
//   U.el, U.dispose()
// z-index 30: over the HUD (12), under the counters' panels (32), the times chart (35) and the lock box (60).

import { flagCard } from './flag.js';

const CSS_HREF = new URL('./storeslip.css', import.meta.url).href;
const FONTS_HREF = new URL('./fonts/fonts.css', import.meta.url).href;
function ensureCss() {
  for (const [href, key] of [[FONTS_HREF, 'bmFonts'], [CSS_HREF, 'bmSlip']]) {
    if (document.querySelector(`link[data-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`)) continue;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset[key] = '1'; document.head.appendChild(l);
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const COIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#e2ad4c"/><circle cx="12" cy="12" r="7.4" fill="none" stroke="#a8742a" stroke-width="1.6"/></svg>';
const PENCIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" fill="#e2ad4c" stroke="#3b260c" stroke-width="1.5" stroke-linejoin="round"/><path d="M5.2 15.4l3.4 3.4" stroke="#3b260c" stroke-width="1.5"/></svg>';
const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#3b260c"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#3b260c" stroke-width="1.7" stroke-linecap="round"/></svg>';

// A line as it should be said out loud: '$3.45' -> '3 dollars and 45 cents', '35¢' -> '35 cents', '2 h 30 min' ->
// '2 hours 30 minutes', × ÷ − as words.
export function sayable(text) {
  return String(text || '')
    .replace(/\$(\d+)\.(\d\d)\b/g, (m, d, c) => (Number(d) === 0 ? `${Number(c)} cents` : Number(c) === 0 ? `${d} dollars` : `${d} dollars and ${Number(c)} cents`))
    .replace(/\$(\d+)/g, '$1 dollars').replace(/(\d+)¢/g, '$1 cents').replace(/\b1 dollars\b/g, '1 dollar').replace(/\b1 cents\b/g, '1 cent')
    .replace(/(\d+) h (\d+) min\b/g, '$1 hours $2 minutes').replace(/(\d+) min\b/g, '$1 minutes').replace(/\b1 hours\b/g, '1 hour')
    .replace(/×/g, ' times ').replace(/÷/g, ' divided by ').replace(/−/g, ' minus ');
}
// The browser's own voice, for reading a story out loud to a rider who can't read yet (the maker's recorded voice,
// src/audio/readaloud.js, says counting cards; a whole story needs the browser's). Returns false when there's none.
export function speakLine(text) {
  try {
    const S = globalThis.speechSynthesis, Utt = globalThis.SpeechSynthesisUtterance;
    if (!S || !Utt || !text) return false;
    S.cancel();
    const u = new Utt(sayable(text));
    u.rate = 0.92; u.lang = 'en-US';
    S.speak(u);
    return true;
  } catch (e) { return false; }
}
export const canSpeak = () => { try { return !!(globalThis.speechSynthesis && globalThis.SpeechSynthesisUtterance); } catch (e) { return false; } };

export const SLIP = {
  flyMs: 650,        // a coin's flight from the picked coin to the purse
  countMs: 550,      // the purse counting up
  thanksMs: 1300,    // the right answer's line stays this long (with the coins) before the slip slides away
  leaveMs: 320,      // the slip sliding away
  picLeast: 84,      // px: the shortest a wrong pick's picture is shrunk to, to fit the slip on a short screen
};

export function makeStoreSlip(root = document.body, { onPick = () => {}, onDone = () => {}, onDraw = () => {}, onWork = () => {} } = {}) {
  ensureCss();
  const el = document.createElement('div');
  el.className = 'bmo';
  el.innerHTML = `<div class="bmo-wait" aria-live="polite"></div>
    <section class="bmo-slip" aria-label="Order slip" aria-live="polite">
      <header class="bmo-top">
        <div class="bmo-from"><small>Order from</small><b></b></div>
        <div class="bmo-purse" title="Your gold">${COIN}<b>0</b></div>
        <button type="button" class="bmo-done">Done for now<kbd>Esc</kbd></button>
      </header>
      <p class="bmo-story"></p>
      <p class="bmo-ask"></p>
      <figure class="bmo-lead" hidden><div class="bmo-leadsvg"></div></figure>
      <div class="bmo-tools"><button type="button" class="bmo-work" hidden>${PENCIL}<span>Work it out</span></button><button type="button" class="bmo-read" hidden>${SPEAKER}<span>Read it to me</span></button></div>
      <div class="bmo-coins" role="group" aria-label="Pick the answer"></div>
      <div class="bmo-help" hidden><p class="bmo-why"></p><figure class="bmo-pic"><figcaption></figcaption><div class="bmo-svg"></div><p class="bmo-picline"></p></figure></div>
      <button type="button" class="bmo-draw" hidden>Draw it for me</button>
      <p class="bmo-thanks" hidden></p>
      <footer class="bmo-foot"><span class="bmo-filled"></span><span class="bmo-keys">keys 1 to 4 pick a coin</span></footer>
    </section>
    <div class="bmo-fly"></div>`;
  root.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const slip = $('.bmo-slip'), coinsEl = $('.bmo-coins'), help = $('.bmo-help'), drawBtn = $('.bmo-draw'), thanks = $('.bmo-thanks');
  const purseN = $('.bmo-purse b'), purseEl = $('.bmo-purse'), fly = $('.bmo-fly'), waitEl = $('.bmo-wait');
  let order = null, busy = false, shown = 0, disposed = false;
  // "Confusing?" on the slip: the story, the coins, the ones already tried and the right one (src/ui/flag.js)
  flagCard($('.bmo-tools'), () => (order ? { text: `${order.story || ''} ${order.ask || ''}`, choices: (order.coins || []).map((c) => c.label), right: ((order.coins || []).find((c) => c.good) || {}).label,
    picked: [...coinsEl.querySelectorAll('.bmo-coin.is-wrong')].map((b) => (order.coins[+b.dataset.i] || {}).label) } : null),
    { style: 'position:static;transform:none;margin-left:auto;align-self:center' });   // (in the row with "Read it to me", at its right end)

  $('.bmo-done').addEventListener('click', () => onDone());
  drawBtn.addEventListener('click', () => onDraw());
  const workBtn = $('.bmo-work'), readBtn = $('.bmo-read');
  workBtn.addEventListener('click', () => { if (!busy) onWork(); });
  readBtn.addEventListener('click', () => { if (order) speakLine(order.read || `${order.story} ${order.ask}`); });
  coinsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.bmo-coin'); if (!b || b.disabled || busy) return;
    onPick(Number(b.dataset.i));
  });
  const onKey = (e) => {
    if (!order || busy || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!el.classList.contains('is-on') || document.querySelector('.bms, .lbx, .bml:not(.is-out), .tch:not(.out), .bmtl-menu')) return;   // (a panel, the worked area, the times chart or the tools' menu is over it)
    const k = /^Digit([1-4])$/.exec(e.code) || /^Numpad([1-4])$/.exec(e.code);
    if (!k) return;
    const b = coinsEl.querySelector(`[data-i="${Number(k[1]) - 1}"]`);
    if (b && !b.disabled) { e.preventDefault(); onPick(Number(k[1]) - 1); }
  };
  addEventListener('keydown', onKey);

  const U = { el, get busy() { return busy; } };
  U.purse = (n) => { shown = n; purseN.textContent = String(n); };
  U.waiting = (text) => { waitEl.textContent = text || ''; waitEl.classList.toggle('is-on', !!text); };

  let reading = false;   // (a rider who can't read yet: the why of a wrong pick is said out loud too)
  U.show = (o, { filled = 0, pic = null, read = false, lead = null, note = '' } = {}) => {
    order = o; busy = false; reading = !!read;
    el.classList.add('is-on');
    U.waiting('');
    $('.bmo-from b').textContent = o.who.name;
    $('.bmo-story').textContent = o.story;
    $('.bmo-ask').textContent = o.ask;
    const wide = !!(o.equation || o.wide);
    slip.classList.toggle('is-eq', wide);
    coinsEl.classList.toggle('is-eq', wide);
    // (on a phone the slip covers the tools strip: its own button stands in for the strip's Work it out)
    workBtn.hidden = !(o.long || (o.work && typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches));
    readBtn.hidden = !(read && canSpeak());
    coinsEl.innerHTML = o.coins.map((c, i) => `<button type="button" class="bmo-coin${wide ? ' is-eq' : ''}" data-i="${i}" aria-label="${esc(c.label)}">
        <span class="bmo-face"><b${!wide && String(c.big).length > 5 ? ' class="is-long"' : ''}>${esc(c.big)}</b>${c.small ? `<small>${esc(c.small)}</small>` : ''}</span><kbd>${i + 1}</kbd></button>`).join('');
    // a picture that is part of the question (the clock to read, the coins to count), above the coins
    const leadEl = $('.bmo-lead');
    leadEl.hidden = !(lead && lead.svg);
    $('.bmo-leadsvg').innerHTML = lead && lead.svg ? lead.svg : '';
    slip.classList.toggle('has-lead', !!(lead && lead.svg));
    help.hidden = true; drawBtn.hidden = true; thanks.hidden = true;
    slip.classList.remove('has-help');
    $('.bmo-keys').textContent = `keys 1 to ${o.coins.length} pick a coin`;
    slip.scrollTop = 0;   // (a slip scrolled down to the last one's picture would open with its header cut off)
    $('.bmo-filled').textContent = (filled ? `${filled} order${filled === 1 ? '' : 's'} filled` : 'First order of the day') + (note ? ` · ${note}` : '');
    slip.classList.remove('is-out', 'is-in');
    void slip.offsetWidth;
    slip.classList.add('is-in');
    // (the youngest riders' picture stories: the things to count show from the start, no reason line)
    slip.classList.toggle('is-picfirst', !!pic);
    if (pic) showPic(pic, '');
  };
  U.speak = (text) => speakLine(text);

  function showPic(pic, why, { inLead = false } = {}) {
    $('.bmo-why').textContent = why || '';
    $('.bmo-why').hidden = !why;
    $('.bmo-pic figcaption').textContent = pic.title || '';
    const lead = inLead && !$('.bmo-lead').hidden;
    if (lead) $('.bmo-leadsvg').innerHTML = pic.svg || '';
    $('.bmo-svg').innerHTML = lead ? '' : pic.svg || '';
    $('.bmo-picline').textContent = pic.line || '';
    help.hidden = false;
    drawBtn.hidden = true;
    slip.classList.add('has-help');   // (a phone's sheet grows up to the HUD to hold the reason and the picture)
    help.classList.remove('is-pop'); void help.offsetWidth; help.classList.add('is-pop');
    // on a short screen the reason and the picture land below the coins: on a window (not a phone's sheet, where the
    // picture keeps its size and the slip scrolls) the picture shrinks to fit (down to SLIP.picLeast px tall); what
    // still doesn't fit is brought up into view
    const svg = $('.bmo-svg svg');
    if (svg) svg.style.maxHeight = '';
    requestAnimationFrame(() => {
      const over = slip.scrollHeight - slip.clientHeight;
      if (svg && over > 0 && roomy()) svg.style.maxHeight = `${Math.max(SLIP.picLeast, svg.getBoundingClientRect().height - over - 2)}px`;
      seeEnd(help);
    });
  }
  // (the slip's window layout, not a phone's: storeslip.css's two phone layouts start below these sizes)
  const roomy = () => innerWidth > 760 && innerHeight > 480;
  // scrolls the slip (only the slip) so the part just shown sits in view, its top first if it can't all fit. Never so
  // far that the story's first line goes under the pinned header (on a window; on a phone too for a wrong pick's
  // reason and picture): the kid is still reading it (the rest of the picture is a scroll away)
  function seeEnd(part) {
    requestAnimationFrame(() => {
      const s = slip.getBoundingClientRect(), r = part.getBoundingClientRect();
      if (r.bottom <= s.bottom - 4 && r.top >= s.top) return;
      let by = Math.min(r.bottom - s.bottom + 12, r.top - s.top - 8);
      if (part === help || roomy()) by = Math.min(by, $('.bmo-story').getBoundingClientRect().top - $('.bmo-top').getBoundingClientRect().bottom - 2);
      if (by > 0) slip.scrollBy({ top: by, behavior: 'smooth' });
    });
  }
  U.wrong = (i, { why, pic, inLead = false }) => {
    const b = coinsEl.querySelector(`[data-i="${i}"]`);
    if (b) { b.classList.remove('is-shake'); void b.offsetWidth; b.classList.add('is-shake', 'is-wrong'); b.disabled = true; }
    showPic(pic, why, { inLead });
    if (reading && why) speakLine(why);
  };
  U.drawn = (pic, { inLead = false } = {}) => showPic(pic, '', { inLead });
  U.offerDraw = (on) => { drawBtn.hidden = !on || !help.hidden; };

  // the coins fly from the picked coin to the purse, which counts up from `from` to `to`
  async function coinsFly(src, from, to) {
    const a = src.getBoundingClientRect(), z = purseEl.getBoundingClientRect();
    const n = Math.max(1, Math.min(8, to - from));
    for (let k = 0; k < n; k++) {
      const c = document.createElement('span');
      c.className = 'bmo-flycoin'; c.innerHTML = COIN;
      const x0 = a.left + a.width / 2 + (Math.random() - 0.5) * 30, y0 = a.top + a.height / 2 + (Math.random() - 0.5) * 16;
      c.style.left = `${x0}px`; c.style.top = `${y0}px`;
      c.style.setProperty('--dx', `${z.left + z.width * 0.25 - x0}px`); c.style.setProperty('--dy', `${z.top + z.height / 2 - y0}px`);
      c.style.animationDelay = `${k * 60}ms`; c.style.animationDuration = `${SLIP.flyMs}ms`;
      fly.appendChild(c);
      setTimeout(() => c.remove(), SLIP.flyMs + k * 60 + 50);
    }
    await sleep(SLIP.flyMs * 0.8);
    purseEl.classList.remove('is-bump'); void purseEl.offsetWidth; purseEl.classList.add('is-bump');
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => {
        if (disposed) return res();
        const f = Math.min(1, (performance.now() - t0) / SLIP.countMs);
        purseN.textContent = String(Math.round(from + (to - from) * f));
        if (f < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    shown = to;
  }
  U.right = async (i, { line, gold = 0, from = shown, to = shown, note = '', news = [], paid = '' } = {}) => {
    busy = true;
    const b = coinsEl.querySelector(`[data-i="${i}"]`);
    for (const x of coinsEl.querySelectorAll('.bmo-coin')) { x.disabled = true; if (x !== b) x.classList.add('is-fade'); }
    if (b) b.classList.add('is-right');
    drawBtn.hidden = true; workBtn.hidden = true; readBtn.hidden = true;
    thanks.innerHTML = `<b>${esc(line || '')}</b>${gold ? `<span class="bmo-tip">${paid ? esc(paid) : `+${gold} gold tip`}${note ? ` · ${esc(note)}` : ''}</span>` : ''}`
      + news.map((t) => `<span class="bmo-news">${esc(t)}</span>`).join('');
    // the working and the tip are what matter now: the wrong pick's picture folds away so they show on a short screen
    help.hidden = true;
    thanks.hidden = false;
    seeEnd(thanks);
    const t0 = performance.now();
    if (gold && b) await coinsFly(b, from, to); else U.purse(to);
    const left = SLIP.thanksMs - (performance.now() - t0);
    if (left > 0) await sleep(left);
  };
  U.equation = (i, { line }) => {
    busy = true;
    const b = coinsEl.querySelector(`[data-i="${i}"]`);
    for (const x of coinsEl.querySelectorAll('.bmo-coin')) { x.disabled = true; if (x !== b) x.classList.add('is-fade'); }
    if (b) b.classList.add('is-right');
    drawBtn.hidden = true;
    thanks.innerHTML = `<b>${esc(line)}</b><span class="bmo-tip">Now crack it in the lock box: what is x?</span>`;
    thanks.hidden = false;
  };
  U.leave = async () => {
    order = null;
    slip.classList.remove('is-in'); slip.classList.add('is-out');
    await sleep(SLIP.leaveMs);
    busy = false;
  };
  U.hide = () => { order = null; busy = false; el.classList.remove('is-on'); slip.classList.remove('is-in'); U.waiting(''); };
  U.dispose = () => { disposed = true; removeEventListener('keydown', onKey); el.remove(); };
  return U;
}
