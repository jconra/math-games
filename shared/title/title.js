// shared/title/title.js: the title screen's engine. Every game in this repo that has saved players imports this one
// file; what a game says and draws on the screen comes in through its THEME.
//
//   import { showTitle } from '../../shared/title/title.js';
//   const T = showTitle(root, theme, { players, build, onStart(player), onChange(player) })
//   T.setProgress(0.4, 'Planting trees')   // the world's loading progress, 0..1 (the start button waits for 1)
//   T.nudge()                              // some small piece of loading finished: the bar moves on a little
//   T.hide(); T.show(); T.player()
//
// It floats over the live world while that loads behind it. What is on it: the game's name; a card for each saved
// player and "new player" (a name, a look, skin and hair if the game has them, an optional age); the chosen player's
// panel; the start button, which can be pressed while the world still loads (it then waits and goes by itself when
// loading reaches 1; if setProgress is never called the world is taken as ready); a small build number; and a folded
// Grown-ups corner (a row per player; delete a player). Every change is saved straight away through the theme's save.
//
// Keyboard: Tab moves between controls, arrow keys move within a group (players, looks, ages, colours), Space or Enter
// picks, Escape closes the Grown-ups corner or the new-player form. The start button has focus at the start, so a
// returning player can just press Enter.
//
// THE NAMES IN THE PAGE. The engine was lifted out of Mathwood Valley's title screen, and Mathwood's stylesheet, tests
// and rigs find things by name, so the names stayed: a player's card is `rider`, the list `riders`, the start button
// `ride`. Each game puts its own short prefix on the class names (theme.prefix: `bmt` for Mathwood), so two games'
// stylesheets never meet. A control says what it does with data-act (and data-id, data-v); data-k names it so keyboard
// focus can be put back after a redraw; data-nav="radio|grid" marks a group the arrow keys move in.
//
// THE THEME (everything a game says or draws; every part but `save` and `looks` may be left out):
//   prefix        the class prefix, 'bmt'
//   css           the stylesheet's address (the screen stays invisible until it has loaded)
//   words         { screen, who, players, newPlayer, formTitle, formLine, name, nameHolder(pick), anyName, pickLook,
//                   look, skin, hair, age, ageSmall, ageSaid, skip, cancel, create, createAs(pick), start, waiting,
//                   starting, makeFirst, loading, ready, grown, grownIntro, noPlayers, saved, blocked, blockedLong,
//                   deletePlayer, deleteAsk(nameHtml), keep, del, close, build(n) }   (see WORDS below for each)
//   icons         { runner: the little figure on the loading bar, ...any of ICONS to replace }
//   brand()       -> html for the name's corner
//   save          { load() -> players, save(p), make(name, look) -> p, remove(id), works() -> bool, max }
//   looks         [{ id, name, hair?, ... }] the looks on the new-player form
//   skins, hairs  ['#rrggbb', ...] colour dots on the form (leave out for none)
//   names         ready names for a player who types none
//   ages          the ages offered (5 reads "5 or under", 16 "16+")
//   portrait(look)            -> html of a player's picture (inside a framed box)
//   lookOf(draft, lookDef)    -> the look a new player gets from the form
//   lookCardOf(lookDef, draft)-> the look shown on one look's card
//   when(last)                -> words for when a player last played
//   cardSaid(p)               -> the card read out (already escaped)
//   cardBody(p, chosen)       -> html on the card under the name
//   panelLine(p)              -> html beside the name in the panel's header
//   panel(p, ctx)             -> html of the chosen player's panel under its header
//   panelReady(panelEl, ctx)  called after the panel is drawn (to listen to something in it)
//   draft(players)            -> extra fields for a fresh form
//   formTones(draft, ctx)     -> html after the skin and hair dots (Mathwood's hat switch)
//   formAge(draft, ctx)       -> html under the age row
//   formMore(draft, ctx)      -> html of extra form sections
//   created(p, draft)         fill in a new player from the form's extra fields, before the first save
//   actionsBefore(p, state)   -> html of extra buttons before the start button
//   grownLine(p)              -> html after the name in a Grown-ups row
//   grownFacts(p, ctx)        -> html of <dt>/<dd> pairs in a Grown-ups row
//   grownButtons(p, ctx)      -> html of buttons in a Grown-ups row, before Delete
//   actions       { name(ctx, data) } what the theme's own controls do (data-act="name")
//   begin(ctx)                called once after the first draw
// ctx = { el, P, S, players, opts, current(), changed(p), keepFocus(fn), focusKey(k, scroll), draw: { players, panel,
//         actions, foot, sheet, all }, agePick(cur, kind, label), ageSelect(p), icons, esc, fmt }

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }

// The engine's own small drawings (a theme may replace any of them, and adds `runner`).
export const ICONS = {
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.6l3.1 3.1L13 4.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  chevron: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5L10 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  people: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><circle cx="5.6" cy="5" r="2.4"/><path d="M1.2 13.6c.3-3 2.1-4.6 4.4-4.6s4.1 1.6 4.4 4.6z"/><circle cx="11.4" cy="5.8" r="2"/><path d="M10.3 9.4c.4-.1.8-.2 1.1-.2 2 0 3.4 1.4 3.6 4.1h-3.9c-.1-1.6-.4-2.9-.8-3.9z"/></svg>',
  info: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 7.2v4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="4.8" r="1.1" fill="currentColor"/></svg>',
  // a plain dot, for a theme that brings no runner of its own
  runner: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="currentColor"/></svg>',
};

// The ages the new-player form offers (optional). 5 stands for "5 or under" and 16 for "16 or older" (it reads "16+").
export const AGES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
export const ageWord = (a) => (a == null ? 'not set' : a >= 16 ? '16+' : String(a));

// Every word the engine itself puts on the screen, in plain neutral form. A theme replaces the ones it wants.
const WORDS = {
  screen: 'Title screen',                    // the screen's name, read out
  who: 'Who is playing?',                    // over the players' cards
  players: 'Players',                        // the group's name, read out
  newPlayer: 'New player',                   // the card under the players
  formTitle: 'New player',                   // the form's header
  formLine: 'Name, look, and you start',     // beside it
  name: 'Name',
  nameHolder: (pick) => `${pick}, or type one`,   // inside the empty name box
  anyName: 'Player',                         // the last resort for a name
  pickLook: 'Pick a look',
  look: 'Look',
  skin: 'Skin', hair: 'Hair',
  age: 'Age', ageSmall: 'if you like', ageSaid: 'Age, if you like', skip: 'Skip',
  cancel: 'Cancel',
  create: 'Start',                           // the form's go button
  createAs: (pick) => `as ${pick}`,          // small, after it, while no name is typed
  start: 'START',                            // the start button
  waiting: 'Getting ready…',                 // pressed while the world still loads
  starting: 'Starting…',                     // pressed and going
  makeFirst: 'Make a player first',
  loading: 'Loading',                        // when setProgress gave no words
  ready: 'Ready',
  grown: 'Grown-ups',
  grownIntro: 'How each player is doing. Everything stays on this device; nothing is sent anywhere.',
  noPlayers: 'No players yet.',
  saved: 'Progress is saved in this browser.',
  blocked: 'This browser is blocking saves, so progress lasts only until this tab closes.',
  blockedLong: 'This browser is blocking saves: progress lasts only until this tab closes.',
  deletePlayer: 'Delete player',
  deleteAsk: (name) => `Delete ${name} for good? Their progress goes too. This can't be undone.`,
  keep: 'Keep', del: 'Delete', close: 'Close',
  build: (n) => `build ${n}`,
};

// The stylesheet is added once, and the screen stays invisible until it has loaded.
function ensureStyles(href, done) {
  if (!href) { done(); return; }
  href = new URL(href, document.baseURI).href;
  let link = [...document.querySelectorAll('link[rel="stylesheet"]')].find(l => l.href === href);
  if (link && link.sheet) { done(); return; }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    document.head.appendChild(link);
  }
  let called = false;
  const once = () => { if (!called) { called = true; done(); } };
  link.addEventListener('load', once); link.addEventListener('error', once);
  setTimeout(once, 2500);   // never stay invisible, even if the load event is missed
}

const none = () => '';

export function showTitle(root, theme, opts = {}) {
  root = root || document.body;
  if (!theme || !theme.save || !Array.isArray(theme.looks) || !theme.looks.length) throw new Error('showTitle: the theme needs a save and at least one look');
  const P = theme.prefix || 'bmt';
  const W = { ...WORDS, ...(theme.words || {}) };
  const ICON = { ...ICONS, ...(theme.icons || {}) };
  const save = theme.save;
  const LOOKS = theme.looks, SKINS = theme.skins || [], HAIRS = theme.hairs || [], NAMES = theme.names || [];
  const ages = theme.ages || AGES;
  const portrait = theme.portrait || none;
  const lookOf = theme.lookOf || ((d, l) => ({ ...l, skin: d.skin, hair: d.hair }));
  const lookCardOf = theme.lookCardOf || ((l, d) => lookOf({ ...d, look: l.id, hair: d.hairPicked ? d.hair : l.hair }, l));
  const acts = theme.actions || {};

  const players = Array.isArray(opts.players) ? opts.players : save.load();
  const build = opts.build == null ? '' : String(opts.build);
  const onStart = opts.onStart || (() => {});
  const onChange = opts.onChange || (() => {});

  const S = {
    sel: players[0] ? players[0].id : null,
    view: players.length ? 'settings' : 'new',
    draft: null,
    sheet: false,       // false | 'grown': the Grown-ups corner is open
    confirmDel: null,
    load: { known: false, f: 1, text: '' },
    waiting: false,     // the start button was pressed before the world finished loading
    riding: false,      // onStart has been called; the screen ignores clicks until show()
    visible: true,
    saveOk: save.works(),
  };

  const el = document.createElement('div');
  el.className = `${P} is-hidden`;
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', W.screen);
  el.innerHTML = `
    <div class="${P}-scrim"></div>
    <div class="${P}-left">
      <div class="${P}-brand">${theme.brand ? theme.brand() : ''}</div>
      <h2 class="${P}-label">${W.who}</h2>
      <div class="${P}-riders" role="radiogroup" aria-label="${esc(W.players)}" data-nav="radio"></div>
    </div>
    <div class="${P}-right">
      <div class="${P}-panel"></div>
      <div class="${P}-actions"></div>
    </div>
    <div class="${P}-foot"></div>
    <div class="${P}-sheet" role="dialog" aria-modal="true" hidden></div>`;
  root.appendChild(el);
  const $ = (q) => el.querySelector(q);
  const ridersEl = $(`.${P}-riders`), panelEl = $(`.${P}-panel`), actionsEl = $(`.${P}-actions`), footEl = $(`.${P}-foot`), sheetEl = $(`.${P}-sheet`);

  const current = () => players.find(r => r.id === S.sel) || null;
  const canMakeMore = () => players.length < (save.max || 6);

  // Re-draws a part of the screen and puts keyboard focus back on the same control.
  function keepFocus(fn) {
    const a = document.activeElement;
    const k = a && el.contains(a) ? a.getAttribute('data-k') : null;
    fn();
    if (k) {
      const n = el.querySelector(`[data-k="${CSS.escape(k)}"]`);
      if (n && n !== document.activeElement) n.focus({ preventScroll: true });
    }
  }
  function focusKey(k, scroll = true) {
    const n = el.querySelector(`[data-k="${CSS.escape(k)}"]`);
    if (n) n.focus({ preventScroll: !scroll });
  }

  // the optional age as a row of round buttons ("Skip" first); kind names the action
  function agePick(cur, kind, label) {
    return `<div class="${P}-agepick" role="radiogroup" aria-label="${label}" data-nav="radio">
      <button class="${P}-agech is-skip" role="radio" aria-checked="${cur == null}" tabindex="${cur == null ? 0 : -1}" data-act="${kind}" data-v="" data-k="${kind}:-">${W.skip}</button>
      ${ages.map((a) => `<button class="${P}-agech" role="radio" aria-checked="${cur === a}" tabindex="${cur === a ? 0 : -1}" aria-label="${a >= 16 ? '16 or older' : a <= 5 ? '5 or under' : a}"
          data-act="${kind}" data-v="${a}" data-k="${kind}:${a}">${ageWord(a)}</button>`).join('')}
    </div>`;
  }
  // a player's age as a drop-down, for a Grown-ups row (the engine saves a change to it)
  function ageSelect(r) {
    return `<label class="${P}-agesel"><select data-sel="age" data-id="${esc(r.id)}" data-k="agesel:${esc(r.id)}" aria-label="${esc(r.name)}'s age">
            <option value=""${r.age == null ? ' selected' : ''}>Not set</option>
            ${ages.map((a) => `<option value="${a}"${r.age === a || (a === 16 && r.age != null && r.age > 16) || (a === 5 && r.age != null && r.age < 5) ? ' selected' : ''}>${a <= 5 ? '5 or under' : ageWord(a)}</option>`).join('')}
          </select></label>`;
  }

  const draw = {};
  const ctx = {
    el, P, S, players, opts, current, keepFocus, focusKey, draw, agePick, ageSelect, icons: ICON, esc, fmt,
    // a player changed: saved now, and the game is told
    changed(r) { save.save(r); try { onChange(r); } catch (e) { console.error(e); } },
  };

  // ---- the players' cards ----
  function renderRiders() {
    const cards = players.map(r => {
      const on = r.id === S.sel && S.view !== 'new';
      return `<button class="${P}-rider" role="radio" aria-checked="${on}" tabindex="${on || (!S.sel && r === players[0]) ? 0 : -1}"
          data-act="pick" data-id="${esc(r.id)}" data-k="rider:${esc(r.id)}" aria-label="${theme.cardSaid ? theme.cardSaid(r) : esc(r.name)}">
        <span class="${P}-face">${portrait(r.look)}</span>
        <span class="${P}-rname">${esc(r.name)}</span>
        <span class="${P}-when">${theme.when ? theme.when(r.last) : ''}</span>
        ${theme.cardBody ? theme.cardBody(r, on) : ''}
      </button>`;
    }).join('');
    const more = canMakeMore()
      ? `<button class="${P}-newrider" data-act="new" data-k="new" ${S.view === 'new' ? 'aria-current="true"' : ''}><span class="${P}-plus">${ICON.plus}</span><span>${W.newPlayer}</span></button>`
      : '';
    ridersEl.innerHTML = cards + more;
    ridersEl.classList.toggle('is-many', players.length >= 4);   // smaller cards when the family is big
    // If no card can take focus (all on -1), let the first one.
    if (players.length && !ridersEl.querySelector(`.${P}-rider[tabindex="0"]`)) ridersEl.querySelector(`.${P}-rider`).tabIndex = 0;
  }

  // ---- the chosen player's panel / the new-player form ----
  function renderSettings(r) {
    return `
      <div class="${P}-head"><h2><em>${esc(r.name)}</em></h2><p>${theme.panelLine ? theme.panelLine(r) : ''}</p></div>
      ${theme.panel ? theme.panel(r, ctx) : ''}`;
  }

  // Names a new player can start with without typing one (a child who can't read yet taps the go button): one not taken.
  const freeName = (taken) => NAMES.find((n) => !taken.has(n.toLowerCase())) || `${W.anyName} ${taken.size + 1}`;
  function freshDraft() {
    const look = LOOKS[players.length % LOOKS.length];
    return { name: '', pick: freeName(new Set(players.map((x) => String(x.name || '').toLowerCase()))), look: look.id,
      skin: SKINS.length ? SKINS[(2 + players.length) % SKINS.length] : null, hair: look.hair, hairPicked: false, age: null,
      ...(theme.draft ? theme.draft(players) : {}) };
  }
  function draftLook() {
    const d = S.draft, l = LOOKS.find(x => x.id === d.look) || LOOKS[0];
    return lookOf(d, l);
  }
  const goWords = (d) => `${W.create}${d.name.trim() ? '' : ` <small>${W.createAs(esc(d.pick || W.anyName))}</small>`}`;

  function renderForm() {
    const d = S.draft;
    const looks = LOOKS.map(l => `
      <button class="${P}-look" role="radio" aria-checked="${d.look === l.id}" tabindex="${d.look === l.id ? 0 : -1}"
          data-act="look" data-id="${l.id}" data-k="look:${l.id}">
        <span class="${P}-face">${portrait(lookCardOf(l, d))}</span>
        <span class="${P}-lname">${esc(l.name)}</span>
      </button>`).join('');
    const dots = (list, kind, cur, label) => (list.length ? `
      <div class="${P}-tone"><span>${label}</span><div role="radiogroup" aria-label="${label}" data-nav="radio" style="display:flex;gap:8px">
        ${list.map((c, i) => `<button class="${P}-dot" role="radio" aria-checked="${c === cur}" tabindex="${c === cur ? 0 : -1}" aria-label="${label} ${i + 1}"
          style="background:${c}" data-act="${kind}" data-v="${c}" data-k="${kind}:${i}"></button>`).join('')}
      </div></div>` : '');
    const tones = `${dots(SKINS, 'skin', d.skin, W.skin)}${dots(HAIRS, 'hair', d.hairPicked ? d.hair : null, W.hair)}
          ${theme.formTones ? theme.formTones(d, ctx) : ''}`;
    return `
      <div class="${P}-head"><h2>${W.formTitle}</h2><p>${W.formLine}</p></div>
      <div class="${P}-form">
        <div class="${P}-who">
          <span class="${P}-face ${P}-preview">${portrait(draftLook())}</span>
          <label class="${P}-field"><span>${W.name}</span>
            <input class="${P}-input" data-k="name" maxlength="16" autocomplete="off" spellcheck="false" placeholder="${esc(W.nameHolder(d.pick || W.anyName))}" value="${esc(d.name)}"></label>
        </div>
        <section>
          <h3 class="${P}-label">${W.pickLook}</h3>
          <div class="${P}-looks" role="radiogroup" aria-label="${W.look}" data-nav="radio">${looks}</div>
        </section>
        ${tones.trim() ? `<div class="${P}-tones">${tones}</div>` : ''}
        <section>
          <h3 class="${P}-label">${W.age} <small>${W.ageSmall}</small></h3>
          ${agePick(d.age, 'age', W.ageSaid)}
          ${theme.formAge ? theme.formAge(d, ctx) : ''}
        </section>
        ${theme.formMore ? theme.formMore(d, ctx) : ''}
        <div class="${P}-formbtns">
          ${players.length ? `<button class="${P}-btn" data-act="cancel" data-k="cancel">${W.cancel}</button>` : ''}
          <button class="${P}-btn go" data-act="create" data-k="create">${goWords(d)}</button>
        </div>
      </div>`;
  }

  function renderPanel() {
    const r = current();
    if (S.view === 'new' || !r) {
      if (!S.draft) S.draft = freshDraft();
      panelEl.innerHTML = renderForm();
      const input = panelEl.querySelector(`.${P}-input`);
      input.addEventListener('input', () => {
        S.draft.name = input.value;
        // (no name typed: the go button uses the picked one, so a child who can't read can start alone)
        const go = panelEl.querySelector('[data-act="create"]');
        if (go) go.innerHTML = goWords({ name: input.value, pick: S.draft.pick });
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); act('create', {}); }
      });
    } else {
      panelEl.innerHTML = renderSettings(r);
    }
    if (theme.panelReady) theme.panelReady(panelEl, ctx);
  }

  // ---- the start button, any buttons the theme adds, and the line under them ----
  function whyNot(r) {
    return r ? '' : W.makeFirst;
  }
  const ready = () => !S.load.known || S.load.f >= 1;

  function renderActions() {
    const r = current();
    if (S.view === 'new' || !r) { actionsEl.innerHTML = ''; actionsEl.hidden = true; return; }
    actionsEl.hidden = false;
    const why = whyNot(r);
    const label = S.riding ? W.starting : S.waiting ? W.waiting : W.start;
    actionsEl.innerHTML = `
      ${theme.actionsBefore ? theme.actionsBefore(r, S) : ''}
      <button class="${P}-ride ${S.waiting ? 'is-waiting' : ''}" data-act="ride" data-k="ride" ${why || S.riding ? 'disabled' : ''}
          aria-describedby="${P}-status"><i class="${P}-fill"></i><span>${label}</span></button>
      <div class="${P}-status" id="${P}-status" aria-live="polite">${why
        ? `<span class="${P}-why">${ICON.info}${why}</span>`
        : `<div class="${P}-load"><span class="${P}-bar"><i></i>${ICON.runner}</span><span class="${P}-loadtext"></span></div>`}</div>`;
    paintLoad();
  }

  // THE BAR NEVER STANDS STILL (the game's maker, 2026-11-03, on a slow connection: "it would be best if it was always
  // creeping forward, even if artificially. Or if it could measure progress at a finer detail. It seems pretty jumpy and
  // stays in one spot for a while right now"). What is shown eases up to the real figure, then creeps on slowly toward a
  // little short of where the next step is likely to put it (it slows as it nears that, so it never runs ahead of the
  // work); each file that finishes downloading (nudge) moves it a little more. It never goes back, except for a new start
  // (a second load after the first, such as a warm-up).
  const BAR = { shown: 0, nudges: 0, raf: 0, last: 0 };
  const room = (f) => Math.min(0.12, (1 - f) * 0.6);
  function barStep(now) {
    BAR.raf = 0;
    const dt = BAR.last ? Math.min(0.1, (now - BAR.last) / 1000) : 1 / 60; BAR.last = now;
    const f = Math.max(0, Math.min(1, S.load.f));
    if (f >= 1) BAR.shown = 1;
    else if (BAR.shown < f) BAR.shown += (f - BAR.shown) * Math.min(1, dt * 6);   // (catching up with the work)
    else { const cap = f + room(f); BAR.shown += (cap - BAR.shown) * Math.min(1, dt * 0.09); }   // (creeping on)
    paintLoad();
    if (BAR.shown < 1 && S.visible) BAR.raf = requestAnimationFrame(barStep);
    else BAR.last = 0;
  }
  function barGo() { if (!BAR.raf && S.load.known && S.visible) BAR.raf = requestAnimationFrame(barStep); }

  // Updates just the loading bar and its words (called often while the world loads).
  let doneTimer = 0;
  function paintLoad() {
    const f = Math.max(0, Math.min(1, S.load.f)), at = f >= 1 ? 1 : Math.min(0.99, Math.max(0, BAR.shown));
    const pct = Math.floor(at * 100), wide = (at * 100).toFixed(1) + '%';
    const load = actionsEl.querySelector(`.${P}-load`);
    const fill = actionsEl.querySelector(`.${P}-fill`);
    if (fill) fill.style.width = S.waiting ? wide : '0';
    if (!load) return;
    const bar = load.querySelector(`.${P}-bar i`), runner = load.querySelector(`.${P}-bar svg`), text = load.querySelector(`.${P}-loadtext`);
    if (!S.load.known) { load.style.display = 'none'; return; }
    load.style.display = '';
    bar.style.width = wide;
    if (runner) runner.style.left = wide;
    if (f >= 1) {
      text.textContent = W.ready;
      if (!doneTimer) doneTimer = setTimeout(() => { const l = actionsEl.querySelector(`.${P}-load`); if (l) l.classList.add('is-done'); }, 1400);
    } else {
      clearTimeout(doneTimer); doneTimer = 0; load.classList.remove('is-done');
      text.textContent = `${S.load.text || W.loading} · ${pct}%`;
    }
  }

  function renderFoot() {
    footEl.innerHTML = `
      <button class="${P}-grown" data-act="grown" data-k="grown" aria-expanded="${S.sheet === 'grown'}">${ICON.people}${W.grown}</button>
      ${build ? `<span class="${P}-build">${esc(W.build(build))}</span>` : ''}
      ${S.saveOk ? '' : `<span class="${P}-warn">${W.blocked}</span>`}`;
  }

  // ---- Grown-ups corner (a sheet over the screen) ----
  function grownRow(r) {
    const confirm = S.confirmDel === r.id ? `
      <div class="${P}-confirm" role="alert"><span>${W.deleteAsk(`<b>${esc(r.name)}</b>`)}</span>
        <button class="${P}-btn" data-act="keep" data-k="keep:${esc(r.id)}">${W.keep}</button>
        <button class="${P}-btn danger" data-act="delyes" data-id="${esc(r.id)}" data-k="delyes:${esc(r.id)}">${W.del}</button></div>` : '';
    return `<div class="${P}-row">
      <span class="${P}-face">${portrait(r.look)}</span>
      <h3>${esc(r.name)}<small>${theme.grownLine ? theme.grownLine(r) : ''}</small></h3>
      <dl class="${P}-facts">
        ${theme.grownFacts ? theme.grownFacts(r, ctx) : `<dt>${W.age}</dt><dd>${ageSelect(r)}</dd>`}
      </dl>
      <div class="${P}-rowbtns">
        ${theme.grownButtons ? theme.grownButtons(r, ctx) : ''}
        ${S.confirmDel === r.id ? '' : `<button class="${P}-del" data-act="del" data-id="${esc(r.id)}" data-k="del:${esc(r.id)}">${W.deletePlayer}</button>`}
      </div>
      ${confirm}
    </div>`;
  }

  function renderSheet() {
    sheetEl.hidden = !S.sheet;
    if (!S.sheet) { sheetEl.innerHTML = ''; return; }
    sheetEl.setAttribute('aria-label', W.grown);
    sheetEl.innerHTML = `<div class="${P}-card">
      <header><h2>${W.grown}</h2><button class="${P}-x" data-act="ungrown" data-k="ungrown" aria-label="${W.close}">${ICON.close}</button></header>
      <p>${W.grownIntro}</p>
      <div class="${P}-ledger">${players.map(grownRow).join('') || `<div class="${P}-empty">${W.noPlayers}</div>`}</div>
      <div class="${P}-cardfoot">${S.saveOk ? W.saved : W.blockedLong}${build ? ` · ${esc(W.build(build))}` : ''}</div>
    </div>`;
  }

  function renderAll() {
    keepFocus(() => { renderRiders(); renderPanel(); renderActions(); renderFoot(); renderSheet(); });
  }
  draw.players = renderRiders; draw.panel = renderPanel; draw.actions = renderActions; draw.foot = renderFoot; draw.sheet = renderSheet; draw.all = renderAll;

  // ---- what each control does ----
  function rideNow() {
    const r = current();
    if (!r || whyNot(r) || S.riding) return;
    S.waiting = false; S.riding = true;
    r.last = Date.now();
    save.save(r);
    keepFocus(renderActions);
    let out;
    try { out = onStart(r); } catch (e) { S.riding = false; keepFocus(renderActions); throw e; }
    if (out && typeof out.then === 'function') out.then(null, (e) => { S.riding = false; keepFocus(renderActions); console.error(e); });
  }

  function act(what, data) {
    if (S.riding && what !== 'grown' && what !== 'ungrown') return;
    const r = current();
    switch (what) {
      case 'pick': {
        if (S.sel === data.id && S.view === 'settings') return;
        S.sel = data.id; S.view = 'settings'; S.waiting = false;
        renderAll();
        try { onChange(current()); } catch (e) { console.error(e); }
        return;
      }
      case 'new':
        if (!canMakeMore()) return;
        S.view = 'new'; S.draft = freshDraft(); S.waiting = false;
        renderAll();
        focusKey('name');
        return;
      case 'cancel':
        if (!players.length) return;
        S.view = 'settings'; S.draft = null;
        renderAll();
        focusKey(S.sel ? `rider:${S.sel}` : 'new');
        return;
      case 'look': {
        const l = LOOKS.find(x => x.id === data.id);
        if (!l) return;
        S.draft.look = l.id;
        if (!S.draft.hairPicked) S.draft.hair = l.hair;
        keepFocus(renderPanel);
        return;
      }
      case 'skin': S.draft.skin = data.v; keepFocus(renderPanel); return;
      case 'hair': S.draft.hair = data.v; S.draft.hairPicked = true; keepFocus(renderPanel); return;
      case 'age': S.draft.age = data.v ? Math.round(+data.v) : null; keepFocus(renderPanel); return;
      case 'create': {
        const name = (S.draft && S.draft.name || '').trim() || (S.draft && S.draft.pick) || '';
        if (!name || !canMakeMore()) { focusKey('name'); return; }
        const nr = save.make(name, draftLook());
        nr.age = S.draft.age == null ? null : S.draft.age;   // (optional)
        if (theme.created) theme.created(nr, S.draft);
        players.push(nr);
        save.save(nr);
        S.saveOk = save.works();
        S.sel = nr.id; S.view = 'settings'; S.draft = null;
        renderAll();
        focusKey('ride');
        try { onChange(nr); } catch (e) { console.error(e); }
        return;
      }
      case 'ride':
        if (!r || whyNot(r)) return;
        if (ready()) { rideNow(); return; }
        S.waiting = !S.waiting;   // a second press while waiting calls it off
        keepFocus(renderActions);
        return;
      case 'grown':
        S.sheet = S.sheet === 'grown' ? false : 'grown'; S.confirmDel = null;
        renderFoot(); renderSheet();
        if (S.sheet) focusKey('ungrown');
        return;
      case 'ungrown':
        S.sheet = false; S.confirmDel = null;
        renderFoot(); renderSheet();
        focusKey('grown');
        return;
      case 'del': S.confirmDel = data.id; renderSheet(); focusKey(`keep:${data.id}`); return;
      case 'keep': { const id = S.confirmDel; S.confirmDel = null; renderSheet(); if (id) focusKey(`del:${id}`); return; }
      case 'delyes': {
        const id = data.id;
        save.remove(id);
        const i = players.findIndex(x => x.id === id);
        if (i >= 0) players.splice(i, 1);
        S.confirmDel = null;
        if (S.sel === id) {
          S.sel = players[0] ? players[0].id : null;
          S.waiting = false;
          if (!players.length) { S.view = 'new'; S.draft = freshDraft(); }
          try { onChange(current()); } catch (e) { console.error(e); }
        }
        renderAll();
        focusKey('ungrown');
        return;
      }
      default:
        if (typeof acts[what] === 'function') acts[what](ctx, data);
    }
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !el.contains(b) || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
    act(b.getAttribute('data-act'), { id: b.getAttribute('data-id'), v: b.getAttribute('data-v') });
  });
  // a player's age, picked in the Grown-ups corner
  sheetEl.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-sel="age"]');
    if (!sel) return;
    const r = players.find(x => x.id === sel.getAttribute('data-id'));
    if (!r) return;
    r.age = sel.value ? Math.round(+sel.value) : null;
    keepFocus(() => { renderSheet(); renderPanel(); });
    ctx.changed(r);
  });
  // a click on the dark backdrop of the Grown-ups sheet closes it
  sheetEl.addEventListener('click', (e) => { if (e.target === sheetEl) act('ungrown', {}); });

  // Escape closes the Grown-ups corner or the new-player form, even when nothing has keyboard focus.
  const onEscape = (e) => {
    if (e.key !== 'Escape' || !S.visible) return;
    if (e.target !== document.body && !el.contains(e.target)) return;   // another panel's Escape, not ours
    if (S.sheet) { e.preventDefault(); act(S.confirmDel ? 'keep' : 'ungrown', {}); return; }
    if (S.view === 'new' && players.length) { e.preventDefault(); act('cancel', {}); }
  };
  document.addEventListener('keydown', onEscape);

  // Arrow keys move within a group; in a radio group (players, looks, colours, ages) they also pick.
  el.addEventListener('keydown', (e) => {
    if (!S.visible || e.key === 'Escape') return;
    const keys = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };
    if (!(e.key in keys)) return;
    const nav = e.target.closest && e.target.closest('[data-nav]');
    if (!nav || e.target.tagName === 'INPUT') return;
    const radio = nav.getAttribute('data-nav') === 'radio';
    // in a radio group only the choices take part (not, say, the new-player button below the cards)
    const items = [...nav.querySelectorAll(radio ? '[role="radio"]' : '[data-k]')]
      .filter(n => n.getAttribute('aria-disabled') !== 'true' && !n.disabled && n.closest('[data-nav]') === nav);
    const at = items.indexOf(e.target);
    if (at < 0) return;
    let step = keys[e.key];
    if (nav.getAttribute('data-nav') === 'grid' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      // move a whole row in a grid of cards: to the card in the next row up or down that sits nearest side to
      // side (the rows can hold different numbers of cards)
      const r0 = e.target.getBoundingClientRect(), cx = r0.left + r0.width / 2;
      const cards = [...nav.querySelectorAll('[data-k]')].map(n => ({ n, r: n.getBoundingClientRect() }))
        .filter(({ r }) => (step > 0 ? r.top >= r0.bottom - 2 : r.bottom <= r0.top + 2));
      const rowY = cards.length ? (step > 0 ? Math.min(...cards.map(c => c.r.top)) : Math.max(...cards.map(c => c.r.top))) : 0;
      const row = cards.filter(c => Math.abs(c.r.top - rowY) < 4);
      row.sort((a, b) => Math.abs(a.r.left + a.r.width / 2 - cx) - Math.abs(b.r.left + b.r.width / 2 - cx));
      const to = row.length ? row[0].n : null;
      e.preventDefault();
      if (to && to.getAttribute('aria-disabled') !== 'true') to.focus();
      return;
    }
    e.preventDefault();
    const next = items[(at + step + items.length) % items.length];
    next.focus();
    if (radio && next.getAttribute('aria-checked') !== 'true') next.click();
  });

  // ---- start ----
  renderAll();
  if (theme.begin) theme.begin(ctx);
  const firstFocus = () => { if (S.view === 'new') focusKey('name', false); else focusKey('ride', false); };   // no scrolling: the name stays in view
  ensureStyles(theme.css, () => {
    if (!S.visible) return;
    el.classList.remove('is-hidden');
    firstFocus();
  });

  let goneTimer = 0;
  const api = {
    el,
    // Fades the screen out (call it once the game takes over).
    hide() {
      S.visible = false; S.sheet = false; S.waiting = false;
      el.classList.add('is-hidden');
      el.inert = true;
      clearTimeout(goneTimer);
      goneTimer = setTimeout(() => { if (!S.visible) el.classList.add('is-gone'); }, 500);
    },
    // Brings it back (after a game), with the players' latest saved progress.
    show() {
      clearTimeout(goneTimer);
      const stored = save.load();
      const live = new Map(players.map(r => [r.id, r]));
      const next = stored.map(s => live.get(s.id) || s);   // keep the game's live player objects; follow the saved order
      players.splice(0, players.length, ...next);
      if (!current()) S.sel = players[0] ? players[0].id : null;
      if (!players.length) { S.view = 'new'; S.draft = freshDraft(); }
      S.visible = true; S.riding = false; S.waiting = false; S.sheet = false; S.confirmDel = null;
      S.saveOk = save.works();
      el.inert = false;
      el.classList.remove('is-gone');
      renderAll();
      void el.offsetWidth;   // let the browser see it before fading in
      el.classList.remove('is-hidden');
      firstFocus();
    },
    // The world's loading progress behind the title: fraction 0..1, and a few words on what it is doing.
    setProgress(fraction, text) {
      const f = Number(fraction);
      S.load.known = true;
      S.load.f = Number.isFinite(f) ? Math.max(0, Math.min(1, f)) : 0;
      if (text != null) S.load.text = String(text);
      if (S.load.f < BAR.shown - 0.3) BAR.shown = S.load.f;   // (a new start: a second load after the first)
      paintLoad(); barGo();
      if (S.load.f >= 1 && S.waiting) rideNow();
    },
    // A file finished downloading, or some other small piece of the work is done: the bar moves on a little (never past
    // what the next step is likely to show).
    nudge() {
      const f = S.load.f; if (!S.load.known || f >= 1) return;
      const cap = f + room(f); if (BAR.shown < cap) BAR.shown += (cap - BAR.shown) * 0.05;
      barGo();
    },
    // The player whose card is picked (or null).
    player: () => current(),
    // For a theme's own pages: the same handles the theme's hooks get.
    ctx,
  };
  return api;
}
