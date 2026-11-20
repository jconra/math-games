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
// person and THE CHARACTER MAKER round them (below), rows to pick a ready-made look and a height (THE HEIGHT, below), a
// button to their job levels (ui/levels.js: each job's range of levels and "keep to these levels"), and the words.
// Nothing here opens by itself.
// THE STARTING DIFFICULTY (the engine's row on the new crew member's form, Easy, Medium or Hard, in place of the age it
// asked before): where each job's questions begin until the crew member's answers say more. Hard starts near the top
// of each job's ladder (the game's maker: "Start grown-ups higher"); Mathwood's src/math/skill.js STARTS says how high.
import { showTitle as showShared, esc, ICONS } from '../../../shared/title/title.js';
import * as save from '../save.js';
import { GAME_NAME, STATION_NAME } from '../name.js';
import { LOOKS, lookById, recipeOf } from '../looks.js';
import { pictureFor, picKey, coming, onPicture, wantPicture, keepPictures, kit, onKit } from '../portraits.js';
import { ROWS, step, withPart, withColour, withLook, isMade, skinInRange } from '../maker.js';
import { SIZES, BAND_COLOURS } from '../../kit/crew.js';

const P = 'cst';
const SHEET = new URL('./title.css?v=7', import.meta.url).href;

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

// A look's picture: the face on cards, the whole person where the stylesheet asks for it (.cst-full). The ready-made
// looks' pictures are stored (portraits.js, assets/looks/) and arrive all together as the page opens: an empty frame
// until then, which then fills every frame showing that look. A look the player has made (THE CHARACTER MAKER) is
// drawn in the browser: until its own picture is in, its frame shows the picture it was changed from, a little dimmed
// (.is-coming), and is filled the same way when the new one arrives.
const shown = new Map();      // the looks whose pictures are on the screen, by their pictures' name
const vars = (look) => ['face', 'body'].map((k) => { const u = pictureFor(look, k); return `--${k}:${u ? `url('${u}')` : 'none'}`; }).join(';');
const pic = (look) => {
  const l = { ...(look || {}), id: lookById(look && look.id).id }, key = picKey(l);
  shown.set(key, l);
  return `<span class="${P}-pic${coming(l) ? ' is-coming' : ''}" data-look="${esc(key)}" style="${vars(l)}"></span>`;
};
onPicture((key) => {
  const l = shown.get(key); if (!l) return;
  for (const el of document.querySelectorAll(`.${P}-pic`)) if (el.getAttribute('data-look') === key) { el.setAttribute('style', vars(l)); el.classList.toggle('is-coming', coming(l)); }
});

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
  // (the whole name on one bold line, the station's own name small under it: a short name, "Pi" mustn't shrink)
  return `<span class="${P}-badge">${BADGE}</span>
    <h1 class="${P}-name"><b>${esc(GAME_NAME)}</b><i>${esc(STATION_NAME)}</i></h1>`;
}

// the row of ready-made looks (on the chosen crew member's panel: pick one and it is saved at once, as it is: whatever
// the maker had changed is let go). `cur` is the look worn as made, or null for a crew member who has changed theirs.
const lookRow = (cur, at) => `<div class="${P}-looks is-small" role="radiogroup" aria-label="Ready-made looks" data-nav="radio">
  ${LOOKS.map((l) => `<button class="${P}-look" role="radio" aria-checked="${l.id === cur}" tabindex="${l.id === (cur || at) ? 0 : -1}"
      data-act="setlook" data-id="${l.id}" data-k="setlook:${l.id}">
    <span class="${P}-face">${pic({ id: l.id })}</span><span class="${P}-lname">${esc(l.name)}</span></button>`).join('')}
</div>`;

// THE CHARACTER MAKER (2026-11-19; the game's maker: "It would be great if it showed the character and had arrows to
// the sides for hear, head, and body. And then some color options for hair, skin, and body"; and eye colour and
// freckles: "Why not, people usually like customizing characters"). The rules are maker.js's: which parts a player may
// wear and which go together. Here: the whole person in a window with an arrow at each side for the hair, the head and
// the body (the one before, the next one, coming round at the ends), their face close in the window's corner (an eye
// colour or freckles cannot be seen on the whole person at that size), and beside them the colours as swatches. Every
// press is saved at once with the crew member (their look), the person is drawn again (portraits.js: the part is
// fetched then, if nobody has worn it yet) and the game builds them so (main.js).
// ANY COLOUR (the game's maker, the same day: "for the color can we get a + that opens up the color picker so we can
// have other colors?"): each colour row ends in a "+" swatch, which is the browser's own colour picker (a colour input
// laid unseen over the swatch, so a tap or a click on it, or Enter on it from the keyboard, opens the picker as the
// browser does on that device). The colour picked is worn at once, while the picker is still open (the person drawn
// again as it moves), and saved when the picker closes; the "+" then wears that colour itself and is the row's chosen
// swatch, and it starts the picker from there the next time. A skin colour picked is brought inside the skin's range
// first (maker.js skinInRange: never white or near white).
// THE ARROWS wait for the crew kit's list of parts (a moment after the page opens): shown, not yet pressable.
// The player reads "Body" for an outfit (the game's maker's word), never "outfit", "uniform" or "suit".
const HAIR_WORDS = ['black', 'dark brown', 'brown', 'chestnut', 'light brown', 'dark blond', 'blond', 'red', 'gray', 'silver'];
const TINTS = [
  { id: 'hair', word: 'Hair color', said: (i) => HAIR_WORDS[i] },
  { id: 'skin', word: 'Skin', said: (i, n) => `${i + 1} of ${n}, light to dark` },
  { id: 'uniform', word: 'Body color', said: (i) => Object.keys(BAND_COLOURS)[i] },
  { id: 'eyes', word: 'Eye color', said: (i, n) => `${i + 1} of ${n}` },
];
const wornOf = (R) => ({ suit: R.suit, head: R.head, hair: R.hair == null ? null : R.hair });
const arrow = (row, dir, ready) => `<button class="${P}-arrow is-${row.id} ${dir < 0 ? 'is-prev' : 'is-next'}" data-act="part" data-id="${row.id}" data-v="${dir}"
    data-k="part:${row.id}:${dir}" aria-label="${row.word}: ${dir < 0 ? 'the one before' : 'the next one'}"${ready ? '' : ' disabled'}>${ICONS.chevron}<b>${row.word}</b></button>`;
// (a colour dark enough that a white "+" reads on it)
const isDark = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 150; };
const HEX = /^#[0-9a-f]{6}$/i;
const swatches = (T, cur) => {
  const list = save.SWATCHES[T.id], on = list.indexOf(cur), own = on < 0 && HEX.test(cur || '');      // (own: a colour picked with the "+")
  return `<section><h3 class="${P}-label">${T.word}</h3>
    <div class="${P}-swatches" role="radiogroup" aria-label="${T.word}" data-nav="radio">
      ${list.map((c, i) => `<button class="${P}-swatch" role="radio" aria-checked="${i === on}" tabindex="${i === (on < 0 ? 0 : on) ? 0 : -1}" style="--c:${c}"
          aria-label="${T.word}: ${esc(T.said(i, list.length) || i + 1)}" data-act="tint" data-id="${T.id}" data-v="${c}" data-k="tint:${T.id}:${i}"><i></i></button>`).join('')}
      <label class="${P}-swatch ${P}-pick${own ? ` is-on ${isDark(cur) ? 'is-dark' : 'is-light'}` : ''}"${own ? ` style="--c:${cur}"` : ''} title="Any color">
        <i></i>${ICONS.plus}<input type="color" value="${HEX.test(cur || '') ? cur : '#7a8a9a'}" data-pick="${T.id}" data-k="pick:${T.id}" aria-label="${T.word}: pick any color"></label>
    </div></section>`;
};
const frecklesRow = (on) => `<div class="${P}-heights ${P}-two" role="radiogroup" aria-label="Freckles" data-nav="radio">
  ${[[0, 'No'], [1, 'Yes']].map(([v, word]) => `<button class="${P}-agech is-skip" role="radio" aria-checked="${!!on === !!v}" tabindex="${!!on === !!v ? 0 : -1}"
      data-act="freckles" data-v="${v}" data-k="freckles:${v}">${word}</button>`).join('')}
</div>`;
function makerHtml(p) {
  const lib = kit(), R = recipeOf(p.look, lib), col = R.colours || {};
  return `<div class="${P}-maker">
    <div class="${P}-stage" role="group" aria-label="Your character: hair, head and body" data-nav="grid">
      <span class="${P}-face ${P}-full">${pic(p.look)}</span>
      <span class="${P}-face ${P}-close">${pic(p.look)}</span>
      ${ROWS.map((row) => arrow(row, -1, !!lib) + arrow(row, 1, !!lib)).join('')}
    </div>
    <div class="${P}-tints">
      ${TINTS.map((T) => swatches(T, col[T.id] || null)).join('')}
      <section><h3 class="${P}-label">Freckles</h3>${frecklesRow(col.freckles)}</section>
      <section><h3 class="${P}-label">Height</h3>${heightRow(sizeOf(p.look), 'setsize')}</section>
    </div>
  </div>`;
}
// a crew member's look changed in the maker: saved now, drawn again (the picture it had stands in till then)
function lookChanged(ctx, p, next) {
  const old = p.look;
  p.look = next;
  wantPicture(next, { from: old, now: true });
  ctx.changed(p);
  ctx.keepFocus(() => { ctx.draw.players(); ctx.draw.panel(); });
}
// ANY COLOUR: a colour from a row's "+" (its picker). While the picker is open (done false: it tells of every move)
// the colour is worn and the person drawn again, the panel left as it is, since drawing the panel again would take the
// picker's own input away from under it; when it closes (done) the look is saved and the panel drawn afresh. (A browser
// that never says the picker closed: saved a moment after its last move.)
let pickSoon = 0;
function colourPicked(ctx, input, done) {
  const p = ctx.current(), what = input.getAttribute('data-pick');
  if (!p || !save.SWATCHES[what] || !HEX.test(input.value)) return;
  const v = what === 'skin' ? skinInRange(input.value) : input.value.toLowerCase();
  const old = p.look, next = withColour(old, what, v, lookById(old.id).recipe), moved = JSON.stringify(next) !== JSON.stringify(old);
  clearTimeout(pickSoon);
  if (done) {
    if (moved) lookChanged(ctx, p, next);
    else { ctx.changed(p); ctx.keepFocus(() => { ctx.draw.players(); ctx.draw.panel(); }); }
    return;
  }
  if (!moved) return;
  p.look = next;
  wantPicture(next, { from: old, now: true });
  // (the window, the close face and their card now show this look; the "+" wears the colour, and is the row's choice)
  const key = picKey(next);
  shown.set(key, { ...next });
  for (const el of ctx.el.querySelectorAll(`.${P}-stage .${P}-pic, .${P}-rider[aria-checked="true"] .${P}-pic`)) { el.setAttribute('data-look', key); el.setAttribute('style', vars(next)); el.classList.toggle('is-coming', coming(next)); }
  const mark = input.parentElement;
  for (const b of mark.parentElement.querySelectorAll('[role="radio"]')) b.setAttribute('aria-checked', 'false');
  mark.style.setProperty('--c', v); mark.classList.add('is-on'); mark.classList.toggle('is-dark', isDark(v)); mark.classList.toggle('is-light', !isDark(v));
  pickSoon = setTimeout(() => ctx.changed(p), 1200);
}

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
    const id = lookById(p.look && p.look.id).id;
    return `<div class="${P}-crew">
      <p class="${P}-line">You start in your room. Walk around the station and see who is there.</p>
      ${makerHtml(p)}
      <section><h3 class="${P}-label">Ready-made looks</h3>${lookRow(isMade(p.look) ? null : id, id)}</section>
      <section><h3 class="${P}-label">Job levels</h3>
        <button class="${P}-btn ${P}-joblevels" data-act="joblevels" data-k="joblevels">Levels to ask at each job</button>
        <p class="${P}-startline">Which levels each job asks, and whether the game moves you up and down by itself.</p></section>
    </div>`;
  },
  actions: {
    // the job levels (ui/levels.js), for the chosen crew member: every job with questions, a tab each
    joblevels(ctx) {
      const p = ctx.current();
      if (!p) return;
      // (and the pilot's seat's, the drill's and the engineer's, whose cards come up on a captain's run: src/jobs/pilot.js,
      // drill.js, engineer.js)
      Promise.all([import('../jobs/index.js'), import('./levels.js'), import('../jobs/pilot.js'), import('../jobs/drill.js'), import('../jobs/engineer.js')]).then(([J, L, P, D, G]) => {
        L.openJobLevels(document.body, p, { jobs: [...J.JOBS, P.JOB, D.JOB, G.JOB], onChange: (x) => ctx.changed(x || p), onClose: () => ctx.focusKey('joblevels', false) });
      }).catch((e) => console.error('Pi Nebula: the job levels could not open', e));
    },
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
    // a ready-made look for the chosen crew member, as it is (the height kept), saved straight away
    setlook(ctx, data) {
      const p = ctx.current();
      if (!p || !LOOKS.some((l) => l.id === data.id) || (p.look && p.look.id === data.id && !isMade(p.look))) return;
      lookChanged(ctx, p, withLook(p.look, data.id));
    },
    // THE CHARACTER MAKER: an arrow (the hair, the head or the body before or after the one worn) ...
    part(ctx, data) {
      const p = ctx.current(), lib = kit(), row = ROWS.find((r) => r.id === data.id), dir = +data.v < 0 ? -1 : 1;
      if (!p || !lib || !row) return;
      const worn = wornOf(recipeOf(p.look, lib)), next = step(lib.list.parts, row.part, worn, dir);
      if (next === worn[row.part]) return;
      lookChanged(ctx, p, withPart(p.look, row.part, next, lookById(p.look.id).recipe));
      // (the one after it in the same direction is fetched now, so the next press finds it here)
      const after = step(lib.list.parts, row.part, { ...worn, [row.part]: next }, dir);
      if (after && lib.entry(row.part, after)) lib.part(row.part, after).catch(() => {});
    },
    // ... a colour (hair, skin, the body's, the eyes'), one of the swatches ...
    tint(ctx, data) {
      const p = ctx.current(), list = save.SWATCHES[data.id];
      if (!p || !list || !list.includes(data.v)) return;
      const own = lookById(p.look.id).recipe, next = withColour(p.look, data.id, data.v, own);
      if (JSON.stringify(next) !== JSON.stringify(p.look)) lookChanged(ctx, p, next);
    },
    // ... and freckles, or none
    freckles(ctx, data) {
      const p = ctx.current(); if (!p) return;
      const next = withColour(p.look, 'freckles', +data.v ? 1 : 0, lookById(p.look.id).recipe);
      if (JSON.stringify(next) !== JSON.stringify(p.look)) lookChanged(ctx, p, next);
    },
  },
  // (ANY COLOUR: each row's "+" is a colour input of the browser's own, heard here: every move of its picker, and its close)
  panelReady(panelEl, ctx) {
    for (const input of panelEl.querySelectorAll('input[data-pick]')) {
      input.addEventListener('input', () => colourPicked(ctx, input, false));
      input.addEventListener('change', () => colourPicked(ctx, input, true));
    }
  },
  // (the saved crew's made looks: their pictures kept for the next visit, any not yet drawn drawn; and the arrows come
  // alive when the crew kit's list of parts is in)
  begin(ctx) {
    keepPictures(ctx.players.map((x) => x.look));
    onKit(() => { if (ctx.S.view !== 'new' && ctx.current()) ctx.keepFocus(() => ctx.draw.panel()); });
  },
  grownLine: (p) => esc(aboard(p.last)),
  grownFacts: (p, ctx) => `<dt>Joined</dt><dd>${esc(day(p.made))}</dd>${ctx.difficultyFacts(p)}`,
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
    formLine: 'A name, a look, where to start and a height',
    difficultySmall: 'where the jobs\' questions begin',
    difficultyLine: (id) => ({
      easy: 'Easy: the very first questions. Counting, and small sums.',
      medium: 'Medium: around third-grade math. Trays, shares and times tables.',
      hard: 'Hard: around sixth-grade math. Ratios, decimals and percent. For grown-ups.',
    }[id] || ''),
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
  let T = null;
  // (whoever is on the crew now: their made looks' pictures are the ones kept for the next visit)
  const onChange = (p) => { if (T) keepPictures(T.ctx.players.map((x) => x.look)); if (opts.onChange) opts.onChange(p); };
  T = showShared(root, theme, { players: opts.players, build: opts.build, onStart: opts.onStart, onChange });
  return T;
}
