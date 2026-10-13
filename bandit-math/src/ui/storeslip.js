// The order slip at the general store counter: a parchment slip over the right of the screen (the bottom on a phone) with
// the customer's story, the question, and 3 or 4 coins to pick from (keys 1-4). A wrong coin shakes and goes dull, and
// the slip shows one plain line about that slip and the picture for that kind of problem (src/ui/storepics.js); then the
// kid picks again. A right coin glows, the coins fly from it into the slip's purse and it counts up, and the slip slides
// away for the next customer's. No buttons between orders; "Done for now" (or Esc) stops.
//
//   const U = makeStoreSlip(root, { onPick(i), onDone(), onDraw() })
//   U.show(order, { filled })     a new slip slides in (filled: orders filled this sitting, for the corner)
//   U.wrong(i, { why, pic })      coin i was wrong: shake it, dull it, show the reason and the picture ({ svg, title, line })
//   U.drawn(pic)                  the picture without a reason (the kid asked for it: "Draw it")
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

export const SLIP = {
  flyMs: 650,        // a coin's flight from the picked coin to the purse
  countMs: 550,      // the purse counting up
  thanksMs: 1300,    // the right answer's line stays this long (with the coins) before the slip slides away
  leaveMs: 320,      // the slip sliding away
};

export function makeStoreSlip(root = document.body, { onPick = () => {}, onDone = () => {}, onDraw = () => {} } = {}) {
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

  $('.bmo-done').addEventListener('click', () => onDone());
  drawBtn.addEventListener('click', () => onDraw());
  coinsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.bmo-coin'); if (!b || b.disabled || busy) return;
    onPick(Number(b.dataset.i));
  });
  const onKey = (e) => {
    if (!order || busy || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!el.classList.contains('is-on') || document.querySelector('.bms, .lbx')) return;   // (a panel is over it)
    const k = /^Digit([1-4])$/.exec(e.code) || /^Numpad([1-4])$/.exec(e.code);
    if (!k) return;
    const b = coinsEl.querySelector(`[data-i="${Number(k[1]) - 1}"]`);
    if (b && !b.disabled) { e.preventDefault(); onPick(Number(k[1]) - 1); }
  };
  addEventListener('keydown', onKey);

  const U = { el, get busy() { return busy; } };
  U.purse = (n) => { shown = n; purseN.textContent = String(n); };
  U.waiting = (text) => { waitEl.textContent = text || ''; waitEl.classList.toggle('is-on', !!text); };

  U.show = (o, { filled = 0 } = {}) => {
    order = o; busy = false;
    el.classList.add('is-on');
    U.waiting('');
    $('.bmo-from b').textContent = o.who.name;
    $('.bmo-story').textContent = o.story;
    $('.bmo-ask').textContent = o.ask;
    slip.classList.toggle('is-eq', !!o.equation);
    coinsEl.classList.toggle('is-eq', !!o.equation);
    coinsEl.innerHTML = o.coins.map((c, i) => `<button type="button" class="bmo-coin${o.equation ? ' is-eq' : ''}" data-i="${i}" aria-label="${esc(c.label)}">
        <span class="bmo-face"><b>${esc(c.big)}</b>${c.small ? `<small>${esc(c.small)}</small>` : ''}</span><kbd>${i + 1}</kbd></button>`).join('');
    help.hidden = true; drawBtn.hidden = true; thanks.hidden = true;
    slip.scrollTop = 0;   // (a slip scrolled down to the last one's picture would open with its header cut off)
    $('.bmo-filled').textContent = filled ? `${filled} order${filled === 1 ? '' : 's'} filled` : 'First order of the day';
    slip.classList.remove('is-out', 'is-in');
    void slip.offsetWidth;
    slip.classList.add('is-in');
  };

  function showPic(pic, why) {
    $('.bmo-why').textContent = why || '';
    $('.bmo-why').hidden = !why;
    $('.bmo-pic figcaption').textContent = pic.title || '';
    $('.bmo-svg').innerHTML = pic.svg || '';
    $('.bmo-picline').textContent = pic.line || '';
    help.hidden = false;
    drawBtn.hidden = true;
    help.classList.remove('is-pop'); void help.offsetWidth; help.classList.add('is-pop');
    // on a short screen the reason and the picture land below the coins: bring them up into view
    seeEnd(help);
  }
  // scrolls the slip (only the slip) so the part just shown sits in view, its top first if it can't all fit
  function seeEnd(part) {
    requestAnimationFrame(() => {
      const s = slip.getBoundingClientRect(), r = part.getBoundingClientRect();
      if (r.bottom <= s.bottom - 4 && r.top >= s.top) return;
      const by = Math.min(r.bottom - s.bottom + 12, r.top - s.top - 8);
      if (by > 0) slip.scrollBy({ top: by, behavior: 'smooth' });
    });
  }
  U.wrong = (i, { why, pic }) => {
    const b = coinsEl.querySelector(`[data-i="${i}"]`);
    if (b) { b.classList.remove('is-shake'); void b.offsetWidth; b.classList.add('is-shake', 'is-wrong'); b.disabled = true; }
    showPic(pic, why);
  };
  U.drawn = (pic) => showPic(pic, '');
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
    drawBtn.hidden = true;
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
