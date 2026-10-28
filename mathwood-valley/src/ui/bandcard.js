// THE BAND'S CARD: the saloon band's songs, picked at the front of its stage (src/stage.js; main.js opens it on E or a
// tap on the prompt). A small dark card at the right of the screen (the bottom on a phone): a row for each song, with a
// picture and its name (so a rider who can't read yet can pick one too), the one playing marked "playing now", and "Take
// a break" under them; on a break, "Play again" first. One tap (or its key: 1 to 4, B, Enter) asks the band and the card
// closes: the answer comes from the stage, in a speech bubble. The game goes on behind it (nothing pauses): Esc, a tap
// anywhere off the card, or walking away from the stage (main.js) closes it.
//
//   const C = makeBandCard({ onPick(id), onClose() })   onPick: a row was picked ('break', 'again' or a song's id)
//   C.open(rows)            shows the card with these rows (src/bandplan.js bandChoices); open again: redrawn
//   C.close()               slides it away (onClose is called)
//   C.isOpen, C.el
// z-index 30: over the HUD (12), under the counters' panels (32), the times chart (35) and the lock box (60).
import { choiceForKey } from '../bandplan.js';

const CSS_HREF = new URL('./bandcard.css', import.meta.url).href;
const FONTS_HREF = new URL('./fonts/fonts.css', import.meta.url).href;
function ensureCss() {
  for (const [href, key] of [[FONTS_HREF, 'bmFonts'], [CSS_HREF, 'bmBand']]) {
    if (document.querySelector(`link[data-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`)) continue;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset[key] = '1'; document.head.appendChild(l);
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// the rows' pictures (brass line drawings on the dark card)
const S = (body) => `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const BAND_PICS = {
  // Easy Afternoon: the sun
  easy: S('<circle cx="16" cy="16" r="5.5"/><path d="M16 4v3.5M16 24.5V28M4 16h3.5M24.5 16H28M7.5 7.5l2.5 2.5M22 22l2.5 2.5M7.5 24.5L10 22M22 10l2.5-2.5"/>'),
  // Dusty Boots: a cowboy boot
  boots: S('<path d="M11 4h8v12l7 3.5q3 1.5 3 4.5v2H8l1-9z"/><path d="M8 26h21M11 9h8"/>'),
  // Prairie Waltz: two notes turning round each other
  waltz: S('<path d="M9 22V9l12-3v13"/><circle cx="7" cy="22" r="2.6" fill="currentColor" stroke="none"/><circle cx="19" cy="19" r="2.6" fill="currentColor" stroke="none"/><path d="M5 28q11 3 22-4"/>'),
  // Lonesome Trail: the moon over a hill
  lonesome: S('<path d="M20 5a8 8 0 1 0 7 11 6.5 6.5 0 0 1-7-11z"/><path d="M3 27q8-7 15-3t11 1"/>'),
  // Take a break: a tin cup, steaming
  break: S('<path d="M8 14h13v8a5 5 0 0 1-5 5h-3a5 5 0 0 1-5-5z"/><path d="M21 16h2.5a3 3 0 0 1 0 6H21"/><path d="M11 5q-1.5 2 0 4M15.5 4q-1.5 2.5 0 5"/>'),
  // Play again: a play mark in a ring
  again: S('<circle cx="16" cy="16" r="12"/><path d="M13 10.5l9 5.5-9 5.5z" fill="currentColor"/>'),
};

export function makeBandCard({ onPick = () => {}, onClose = () => {} } = {}) {
  ensureCss();
  const el = document.createElement('div');
  el.className = 'bmb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'The band');
  el.innerHTML = `<div class="bmb-card"><div class="bmb-top"><div class="bmb-head"><small>The saloon band</small><b>Ask for a song</b></div>
    <button class="bmb-x" type="button" aria-label="Close" title="Close (Esc)"><svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
    <div class="bmb-rows"></div></div>`;
  document.body.appendChild(el);
  const card = el.querySelector('.bmb-card'), list = el.querySelector('.bmb-rows');
  let rows = [], openAt = 0, hideT = null;
  const C = { el, isOpen: false };
  function draw() {
    list.innerHTML = rows.map((r, i) => {
      const pic = BAND_PICS[r.id] || BAND_PICS.again, cls = ['bmb-row', r.id === 'again' ? 'is-main' : '', r.id === 'break' ? 'is-break' : '', r.on ? 'is-on' : ''].filter(Boolean).join(' ');
      return `<button class="${cls}" type="button" data-i="${i}">${pic}<span class="bmb-what"><b>${esc(r.label)}</b>`
        + `${r.sub || r.on ? `<small>${esc(r.sub || '')}${r.on ? '<span class="bmb-tag">playing now</span>' : ''}</small>` : ''}</span>`
        + `${r.keyName ? `<kbd class="bmb-key">${esc(r.keyName)}</kbd>` : ''}</button>`;
    }).join('');
  }
  function pick(r) {
    if (!r || !C.isOpen) return;
    try { onPick(r.id); } catch (e) { console.error(e); }
    C.close();
  }
  list.addEventListener('click', (e) => { const b = e.target.closest('.bmb-row'); if (b) pick(rows[+b.dataset.i]); });
  el.querySelector('.bmb-x').addEventListener('click', () => C.close());
  // keys: its rows' keys pick, Esc (and E, which opened it) close; everything else goes on to the game (walking away)
  const onKey = (e) => {
    if (!C.isOpen || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' || e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) C.close(); return; }
    const r = choiceForKey(rows, e.code);
    if (r) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) pick(r); }
  };
  // a tap or a click anywhere off the card closes it (and still reaches the game: a thumb on the stick walks away)
  const onDown = (e) => { if (C.isOpen && performance.now() - openAt > 250 && !card.contains(e.target)) C.close(); };
  C.open = (r) => {
    rows = r || []; draw();
    if (C.isOpen) return;
    C.isOpen = true; openAt = performance.now();
    if (hideT) { clearTimeout(hideT); hideT = null; }
    el.classList.remove('is-out'); el.classList.add('is-on');
    requestAnimationFrame(() => { if (C.isOpen) el.classList.add('is-in'); });
    addEventListener('keydown', onKey, true);
    addEventListener('pointerdown', onDown, true);
  };
  C.close = () => {
    if (!C.isOpen) return;
    C.isOpen = false;
    removeEventListener('keydown', onKey, true);
    removeEventListener('pointerdown', onDown, true);
    el.classList.remove('is-in'); el.classList.add('is-out');
    hideT = setTimeout(() => { hideT = null; if (!C.isOpen) el.classList.remove('is-on', 'is-out'); }, 220);
    try { onClose(); } catch (e) { console.error(e); }
  };
  C.dispose = () => { C.close(); el.remove(); };
  return C;
}
