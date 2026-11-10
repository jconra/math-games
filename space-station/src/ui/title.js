// The space game's title screen: the SHARED engine (shared/title/title.js, which Mathwood Valley's title also runs
// on) with this game's theme: its words, its pictures of the crew looks, its eight-sided frames (title.css), its own
// saved crew (save.js). How the screen works (cards, the new-player form, the start button that waits for the
// loading, the Grown-ups corner, the keyboard) is the engine's, so a change to a menu there reaches both games.
//
//   import { showTitle } from './ui/title.js';
//   const T = showTitle(root, { players, build, onStart(player), onChange(player) })
//   T.setProgress(0.4, 'Building the rooms'); T.nudge(); T.hide(); T.show(); T.player()
//
// What this game adds to the engine: the look pictures (looks.js), a panel for the chosen crew member with the whole
// person and rows to change their look and their height (THE HEIGHT, below), and the words. Nothing here opens by itself.
import { showTitle as showShared, esc } from '../../../shared/title/title.js';
import * as save from '../save.js';
import { GAME_NAME } from '../name.js';
import { LOOKS, lookById } from '../looks.js';
import { pictureOf, onPicture } from '../portraits.js';
import { SIZES } from '../../kit/crew.js';

const P = 'cst';
const SHEET = new URL('./title.css?v=2', import.meta.url).href;

// THE HEIGHT (2026-11-10; the game's maker: "Maybe we can offer a size option, but I don't think we need new models"):
// three steps of the crew kit's SIZES, saved with the crew member as their look's `size` (Medium is left out, so a crew
// member saved before this is Medium), and laid over the look's recipe (looks.js recipeOf): the whole person scaled.
const HEIGHTS = [['shorter', 'Shorter'], ['medium', 'Medium'], ['taller', 'Taller']].map(([k, word]) => ({ k, word, v: SIZES[k] }));
const sizeOf = (look) => { const v = look && +look.size; return HEIGHTS.some((h) => h.v === v) ? v : 1; };
const heightRow = (cur, act) => `<div class="${P}-heights" role="radiogroup" aria-label="Height" data-nav="radio">
  ${HEIGHTS.map((h) => `<button class="${P}-agech is-skip" role="radio" aria-checked="${cur === h.v}" tabindex="${cur === h.v ? 0 : -1}"
      data-act="${act}" data-v="${h.v}" data-k="${act}:${h.k}">${h.word}</button>`).join('')}
</div>`;
const withSize = (look, v) => { const l = { ...(look || {}) }; if (v === 1) delete l.size; else l.size = v; return l; };

// Ready names for a crew member who types none (a child who cannot read yet just taps "Come aboard").
const NAMES = ['Rookie', 'Comet', 'Scout', 'Pixel', 'Ace', 'Sparks', 'Jet', 'Echo', 'Dash', 'Rocket', 'Nova', 'Orbit'];

// A look's picture: the face on cards, the whole person where the stylesheet asks for it (.cst-full). The pictures are
// drawn in the browser from the crew kit (portraits.js) while the station loads: an empty frame until its picture
// arrives, which then fills every frame showing that look.
const vars = (id) => ['face', 'body'].map((k) => { const u = pictureOf(id, k); return `--${k}:${u ? `url('${u}')` : 'none'}`; }).join(';');
const pic = (look) => {
  const id = lookById(look && look.id).id;
  return `<span class="${P}-pic" data-look="${id}" style="${vars(id)}"></span>`;
};
onPicture((id) => { for (const el of document.querySelectorAll(`.${P}-pic[data-look="${id}"]`)) el.setAttribute('style', vars(id)); });

function dayStart(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
const day = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
// When a crew member last played, in words.
function aboard(last) {
  if (!last) return 'New crew';
  const days = Math.round((dayStart(Date.now()) - dayStart(last)) / 864e5);
  if (days <= 0) return 'Played today';
  if (days === 1) return 'Played yesterday';
  if (days < 7) return `Played ${days} days ago`;
  return 'Played ' + new Date(last).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// The name's corner: a small eight-sided badge (a ringed planet in a window) and the name, its last word heavy.
const BADGE = `<svg viewBox="0 0 48 48" aria-hidden="true">
  <path d="M15 3h18l12 12v18L33 45H15L3 33V15z" fill="none" stroke="currentColor" stroke-width="2"/>
  <circle cx="24" cy="24" r="7.5" fill="currentColor"/>
  <ellipse cx="24" cy="24" rx="15.5" ry="4.2" transform="rotate(-24 24 24)" fill="none" stroke="currentColor" stroke-width="2"/>
</svg>`;
function brand() {
  const words = GAME_NAME.trim().split(/\s+/), last = words.pop();
  return `<span class="${P}-badge">${BADGE}</span>
    <h1 class="${P}-name">${words.length ? `<span>${esc(words.join(' '))}</span> ` : ''}<b>${esc(last)}</b></h1>`;
}

// the row of looks (on the chosen crew member's panel: pick another and it is saved at once)
const lookRow = (cur) => `<div class="${P}-looks is-small" role="radiogroup" aria-label="Look" data-nav="radio">
  ${LOOKS.map((l) => `<button class="${P}-look" role="radio" aria-checked="${l.id === cur}" tabindex="${l.id === cur ? 0 : -1}"
      data-act="setlook" data-id="${l.id}" data-k="setlook:${l.id}">
    <span class="${P}-face">${pic(l)}</span><span class="${P}-lname">${esc(l.name)}</span></button>`).join('')}
</div>`;

const theme = {
  prefix: P,
  css: SHEET,
  save,
  looks: LOOKS,
  names: NAMES,
  // (no skin and hair dots: a look here is a whole ready-made person, shown as a picture made ahead of time)
  portrait: pic,
  lookOf: (draft, look) => withSize({ id: look.id }, draft.size || 1),      // what is saved with a new crew member
  lookCardOf: (look) => ({ id: look.id }),
  // a fresh form starts on a look no saved crew member has (two children's crew don't look the same by accident), Medium
  draft(players) {
    const used = new Set(players.map((p) => p.look && p.look.id)), free = LOOKS.find((l) => !used.has(l.id));
    return free ? { look: free.id, size: 1 } : { size: 1 };
  },
  // the Height row on the new crew member's form
  formMore: (d) => `<section><h3 class="${P}-label">Height</h3>${heightRow(d.size || 1, 'size')}</section>`,
  brand,
  when: aboard,
  cardSaid: (p) => `${esc(p.name)}, ${esc(aboard(p.last).toLowerCase())}`,
  panelLine: (p) => esc(aboard(p.last)),
  panel(p) {
    const cur = lookById(p.look && p.look.id).id;
    return `<div class="${P}-crew">
      <span class="${P}-face ${P}-full">${pic(p.look)}</span>
      <div class="${P}-about">
        <p class="${P}-line">You start in your room. Walk around the station and see who is there.</p>
        <section><h3 class="${P}-label">Look</h3>${lookRow(cur)}</section>
        <section><h3 class="${P}-label">Height</h3>${heightRow(sizeOf(p.look), 'setsize')}</section>
      </div>
    </div>`;
  },
  actions: {
    // the height on the new crew member's form
    size(ctx, data) {
      const v = +data.v; if (!ctx.S.draft || !HEIGHTS.some((h) => h.v === v)) return;
      ctx.S.draft.size = v;
      ctx.keepFocus(() => ctx.draw.panel());
    },
    // another height for the chosen crew member, saved straight away
    setsize(ctx, data) {
      const p = ctx.current(), v = +data.v;
      if (!p || !HEIGHTS.some((h) => h.v === v) || sizeOf(p.look) === v) return;
      p.look = withSize(p.look, v);
      ctx.changed(p);
      ctx.keepFocus(() => ctx.draw.panel());
    },
    // another look for the chosen crew member, saved straight away
    setlook(ctx, data) {
      const p = ctx.current();
      if (!p || !LOOKS.some((l) => l.id === data.id) || (p.look && p.look.id === data.id)) return;
      p.look = { ...(p.look || {}), id: data.id };
      ctx.changed(p);
      ctx.keepFocus(() => { ctx.draw.players(); ctx.draw.panel(); });
    },
  },
  grownLine: (p) => esc(aboard(p.last)),
  grownFacts: (p, ctx) => `<dt>Joined</dt><dd>${esc(day(p.made))}</dd><dt>Age</dt><dd>${ctx.ageSelect(p)}</dd>`,
  icons: {
    // the little ship that rides the loading bar
    runner: '<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M1 8l5-5h8l9 5-9 5H6z" fill="currentColor"/><path d="M6 3L3 0h5zM6 13l-3 3h5z" fill="currentColor" opacity=".7"/></svg>',
  },
  words: {
    screen: `${GAME_NAME}: title screen`,
    // (plain words a young reader knows; "aboard" is kept for the one button that starts the game)
    who: 'Who is playing?',
    players: 'Crew',
    newPlayer: 'New crew member',
    formTitle: 'New crew member',
    formLine: 'Pick a name, a look and a height',
    nameHolder: (pick) => `Type a name, or be ${pick}`,
    anyName: 'Crew',
    pickLook: 'Pick your look',
    create: 'Join the crew',
    start: 'GO ABOARD',
    waiting: 'Docking…',
    starting: 'Going aboard…',
    makeFirst: 'Make a crew member first',
    loading: 'Powering up',
    ready: 'Station ready',
    grownIntro: 'Who is on the crew. Everything stays on this device; nothing is sent anywhere.',
    noPlayers: 'No crew yet.',
    saved: 'The crew is saved in this browser.',
    blocked: 'This browser is blocking saves, so the crew lasts only until this tab closes.',
    blockedLong: 'This browser is blocking saves: the crew lasts only until this tab closes.',
    deletePlayer: 'Delete crew member',
    deleteAsk: (name) => `Delete ${name} for good? Everything they have saved goes too. This can't be undone.`,
  },
};

export function showTitle(root, opts = {}) {
  return showShared(root, theme, { players: opts.players, build: opts.build, onStart: opts.onStart, onChange: opts.onChange });
}
