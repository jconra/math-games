// THE BAND'S CARD: the saloon band's songs, picked at the front of its stage (src/stage.js; main.js opens it on E or a
// tap on the prompt). A dark card at the right of the screen (the bottom on a phone) in two columns: "The band's own"
// songs with "Take a break" under them, and "Old fiddle tunes"; a row for each song, with a picture and its name (so a
// rider who can't read yet can pick one too), the one playing marked "playing now"; on a break, "Play again" first,
// across the top. One tap (or its key: 1 to 9, 0 and - along the number row, B, Enter) asks the band and the card
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
  // Stagecoach Boogie: a stagecoach wheel, spinning (the spokes and the speed lines behind it)
  boogie: S('<circle cx="18" cy="17" r="9"/><circle cx="18" cy="17" r="1.8" fill="currentColor" stroke="none"/><path d="M18 8v18M9 17h18M11.6 10.6l12.8 12.8M24.4 10.6L11.6 23.4M2 12h5M1 17h5M2 22h5"/>'),
  // Lonesome Trail: the moon over a hill
  lonesome: S('<path d="M20 5a8 8 0 1 0 7 11 6.5 6.5 0 0 1-7-11z"/><path d="M3 27q8-7 15-3t11 1"/>'),
  // the old fiddle tunes: Soldier's Joy, a drum and its sticks; Old Joe Clark, a banjo; Arkansas Traveler, the road
  // into the hills; Sally Goodin, a pie; Cripple Creek, the creek; Devil's Dream, a fiddle going quick; Fisher's
  // Hornpipe, a fish
  soldiers: S('<ellipse cx="16" cy="13" rx="10" ry="3.5"/><path d="M6 13v9q10 6 20 0v-9M10 16.5l3 7M22 16.5l-3 7M16 17v8"/><path d="M19 8l8-5M13 8L5 3"/>'),
  joeclark: S('<circle cx="11.5" cy="20.5" r="7"/><circle cx="11.5" cy="20.5" r="2.5"/><path d="M16.5 15.5L27 5"/><path d="M24.5 3.5l3.5 3.5"/>'),
  arkansas: S('<path d="M5 29l9-14M27 29l-9-14M16 27v-2.5M16 21.5v-2M16 17v-1.5"/><path d="M2 13q5-6 10-1 3-4 7-1 4-5 11 1"/>'),
  sally: S('<path d="M4 18h24l-3.5 7h-17z"/><path d="M5 18q11-11 22 0"/><path d="M11 14.5l1.5 2M16 12.5v3M21 14.5l-1.5 2"/>'),
  cripple: S('<path d="M3 11q3.5-3 7 0t7 0 7 0 6 0M3 17q3.5-3 7 0t7 0 7 0 6 0M3 23q3.5-3 7 0t7 0 7 0 6 0"/>'),
  devils: S('<path d="M12 5h5v4q4 1.5 4 6t-4 6v4h-5v-4q-4-1.5-4-6t4-6z"/><path d="M14.5 3v24M24 6l4-2M25 11l4 0M24 16l4 2"/>'),
  fishers: S('<path d="M3 16q8-9 18 0-10 9-18 0z"/><path d="M21 16l7-5.5v11z"/><circle cx="8.5" cy="15" r="1.2" fill="currentColor" stroke="none"/>'),
  // Oh! Susanna: a teardrop ("don't you cry for me"); Camptown Races: a horseshoe
  susanna: S('<path d="M16 4q-8 11-8 16a8 8 0 0 0 16 0q0-5-8-16z"/><path d="M12.5 21a3.5 3.5 0 0 0 3.5 3.5"/>'),
  camptown: S('<path d="M9 27V15a7 7 0 0 1 14 0v12"/><path d="M5 27h7M20 27h7M9 18h2M9 23h2M21 18h2M21 23h2"/>'),
  // William Tell: an arrow through an apple; The Mountain King: a mountain with a crown on it
  tell: S('<circle cx="16" cy="18" r="8"/><path d="M16 10q1-4 4-5"/><path d="M2 18h28M26 15l4 3-4 3M3 15.5l2 2.5-2 2.5"/>'),
  // Drunken Sailor: a ship's wheel; Wellerman: a whale's tail over the sea
  sailor: S('<circle cx="16" cy="16" r="8"/><circle cx="16" cy="16" r="2"/><path d="M16 3v26M3 16h26M6.8 6.8l18.4 18.4M25.2 6.8L6.8 25.2"/>'),
  wellerman: S('<path d="M16 22V12q-2-5-10-6 2 6 10 6 8 0 10-6-8 1-10 6"/><path d="M2 25q3.5-3 7 0t7 0 7 0 7 0"/>'),
  // Blow the Man Down: an anchor; Haul Away Joe: a coil of rope; Shenandoah: a river winding off between hills
  blowman: S('<circle cx="16" cy="6" r="2.5"/><path d="M16 8.5V28M10 13h12M5 19q1 9 11 9t11-9M3 21l2-3 3 2M29 21l-2-3-3 2"/>'),
  haulaway: S('<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="7.5"/><circle cx="16" cy="16" r="4"/><path d="M27 16q2 6 3 12"/>'),
  shenandoah: S('<path d="M2 13q6-8 12-2 5-6 16 1"/><path d="M14 30q-3-6 3-9t1-9"/><path d="M20 30q-3-6 3-9t-1-9"/>'),
  mountain: S('<path d="M2 28l10-14 5 6 4-5 9 13z"/><path d="M8 9V4l3 2.5L13.5 3l2.5 3.5L19 4v5z"/>'),
  fiddle: S('<path d="M12 5h5v4q4 1.5 4 6t-4 6v4h-5v-4q-4-1.5-4-6t4-6z"/><path d="M14.5 3v24M5 26L27 8"/>'),
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
  function row(r, i) {
    const pic = BAND_PICS[r.id] || (r.group === 'old' ? BAND_PICS.fiddle : BAND_PICS.again), cls = ['bmb-row', r.id === 'again' ? 'is-main' : '', r.id === 'break' ? 'is-break' : '', r.on ? 'is-on' : ''].filter(Boolean).join(' ');
    return `<button class="${cls}" type="button" data-i="${i}">${pic}<span class="bmb-what"><b>${esc(r.label)}</b>`
      + `${r.sub || r.on ? `<small><span class="bmb-sub">${esc(r.sub || '')}</span>${r.on ? '<span class="bmb-tag">playing now</span>' : ''}</small>` : ''}</span>`
      + `${r.keyName ? `<kbd class="bmb-key">${esc(r.keyName)}</kbd>` : ''}</button>`;
  }
  // "Play again" across the top; the band's own songs and the break in the first column, the old tunes in the second
  function draw() {
    const at = rows.map((r, i) => [r, i]), own = at.filter(([r]) => r.group === 'own'), old = at.filter(([r]) => r.group === 'old');
    const top = at.filter(([r]) => r.id === 'again'), brk = at.filter(([r]) => r.id === 'break'), other = at.filter(([r]) => !r.group && r.id !== 'again' && r.id !== 'break');
    const col = (title, list) => `<div class="bmb-col"><h3 class="bmb-group">${title}</h3>${list.map(([r, i]) => row(r, i)).join('')}</div>`;
    list.innerHTML = top.map(([r, i]) => row(r, i)).join('')
      + `<div class="bmb-cols">${col('The band\'s own', [...own, ...other, ...brk])}${old.length ? col('Old fiddle tunes', old) : ''}</div>`;
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
