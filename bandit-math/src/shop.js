// THE SHOPS: walk up to a building's door and press E (or tap the prompt) to open its counter as a simple panel over the
// paused game. There is no inside in 3D: each counter is a panel.
//   stable          saddles (any one lets you ride; the horse wears the one you pick) and horses: the bay comes free, the
//                   others are bought (each has its name, coat and paces: player.js HORSE_LOOKS), the one picked is ridden
//   general store   "Mind the counter": the word-problem job (src/missions/store.js: townsfolk bring order slips); and
//                   dogs: a Shiba, a Husky or the pug (the cheap joke pick), each named by the kid; more than one can be
//                   bought, and the one picked follows you while the others wait at home; and hats (src/hats.js): bought
//                   once, worn at once, swapped back and forth free
//   sheriff's desk  open the lock boxes you won, or crack seized boxes for the sheriff's pay (as many as you like)
//   cabin           your table: open the lock boxes you won
//
// Every price and pay amount in the game is in the tables right below, so they can be tuned in one place after
// watching the kids play.
//
//   const S = makeShops({ W, rider, onOpen, onClose, onBuy, onLockbox, onStoreJob, say, extra })
//     extra: more rows for a counter from elsewhere: { store: { html(), click(what, id, body) -> undefined (not its
//     button) | { note, bought }, input(e), keydown(e, body) } } (the homestead's farm animals: src/homestead.js)
//     onStoreJob(): "Mind the counter" was picked at the general store (the panel has closed; main.js starts the job)
//     onOpen() / onClose(): the game pauses and resumes; onBuy(what): something was bought (the player looks at
//     rider.owned again, the HUD's purse is redrawn); onLockbox(box, { own, after }): open a lock box (main.js
//     does it: it pays, records and calls after(result) when the box closes); say(text, kind): a short note
//   S.door(position) -> { id, prompt } for the door the player stands at (within PRICES.doorReach), or null
//   S.open(id), S.close(), S.isOpen
//
//   makePanel({ title, sub, body, onClose, wide }) -> { el, body, close() }: the plain panel the counters use (the
//   pause menu in main.js uses it too). Esc, the x, or a click on the dimmed backdrop closes it.
//   boxTier(rider)  the lock-box tier that suits the rider's place on the solving-for-x ladder
import { spend, saveRider } from './save.js';
import { TIER_NAME, TIER_GOLD } from './lockbox/index.js';
import { RUNG_IDS, RUNG } from './lockbox/generate.js';
import { HATS, hatOf, hatIcon } from './hats.js';
import { PALETTES } from './actors/folk.js';

// ── PRICES AND PAY (gold) ─────────────────────────────────────────────────────────────────────────────────────────
export const PRICES = {
  saddle: { plain: 15, tooled: 60, silver: 150 },   // the first saddle is cheap and quick; fancier ones cost more
  horse: { donkey: 20, chestnut: 60, palomino: 100, white: 150, midnight: 200 },   // the bay comes free; the donkey is the joke mount
  hat: { white: 20, straw: 30, bowler: 50, ranger: 80, cattleman: 120, sombrero: 200 },   // the old cowboy hat comes free
  dog: { shiba: 60, husky: 60, pug: 25 },           // the pug is the cheap joke pick
};
export const PAY = {
  catch: 2,           // each right steer roped
  hardEvery: 8,       // ... plus 1 for every this many steps up the times ladder (the 7s pay more than the 2s)
  negEvery: 2,        // ... or every this many steps up the positive & negative ladder
  wave: 5,            // a finished wave
  firstDay: 10,       // a rider's very first finished wave (the plain saddle is in reach at once)
  // the general store's counter (word problems): an order takes about half a minute to read and work out, so a tip is
  // worth a steer or two
  order: 3,           // each order filled
  orderEvery: 3,      // ... plus 1 for every this many steps up the word-problem ladder
  orderFirst: 1,      // ... plus 1 when the first coin picked was the right one
};
// lock-box tiers by the rider's solving-for-x rung: from each rung up (tin 10, iron 20, brass 35, vault 60 at 3 stars)
export const BOX_TIER = [['R0a', 'tin'], ['R5', 'iron'], ['R10', 'brass'], ['R14', 'vault']];
export const DOOR_REACH = 3.4;   // metres from a door's spot where its prompt shows

export const SADDLES = [
  { id: 'plain', name: 'Plain saddle', line: 'Plain brown leather. Any saddle lets you ride.' },
  { id: 'tooled', name: 'Tooled saddle', line: 'Black leather, tooled by hand.' },
  { id: 'silver', name: 'Silver saddle', line: 'Tooled, with silver and turquoise conchos.' },
];
export const HORSES = [
  { id: 'bay', name: 'Chester the bay', line: 'Your trusty bay. Gallops fast. Free.' },
  { id: 'donkey', name: 'Jasper the donkey', line: 'Slow as molasses and twice as stubborn, but he\'ll get you there.' },
  { id: 'chestnut', name: 'Copper the chestnut', line: 'A steady farm horse with a red-brown coat. Gallops a little slower.' },
  { id: 'palomino', name: 'Goldie the palomino', line: 'A golden coat that shines in the sun. Gallops fast.' },
  { id: 'white', name: 'Willow the white horse', line: 'A white horse, the talk of the valley. Gallops fast.' },
  { id: 'midnight', name: 'Midnight', line: 'A black horse, dark as a moonless night. Gallops fast.' },
];
export const DOGS = [
  { id: 'shiba', name: 'Shiba', line: 'Quick and clever. Keeps up on foot and on the trail.' },
  { id: 'husky', name: 'Husky', line: 'Strong and tireless. Keeps up with a galloping horse.' },
  { id: 'pug', name: 'Pug', line: 'He won\'t herd anything, but he\'s loyal.' },
];
export const DOG_NAMES = ['Biscuit', 'Dusty', 'Scout', 'Pepper', 'Rusty', 'Bandit', 'Maple', 'Boots'];

// which door is which, and what its prompt says
export const COUNTERS = {
  stable: { place: 'stable', prompt: 'Talk to the stable keeper', title: 'The Stable', sub: 'Saddles and horses' },
  store: { place: 'store', prompt: 'Visit the general store', title: 'General Store', sub: 'Orders, dogs, farm animals and hats' },
  sheriff: { place: 'sheriff', prompt: "Sheriff's desk", title: "Sheriff's Office", sub: 'Lock boxes and bounties' },
  cabin: { place: 'cabin', prompt: 'Sit at your cabin table', title: 'Your Cabin', sub: 'Open your lock boxes at the table' },
};

export function boxTier(rider) {
  const rung = (rider && rider.topics && rider.topics.algebra && rider.topics.algebra.rung) || 'R1';
  const i = Math.max(0, RUNG_IDS.indexOf(RUNG[rung] ? rung : 'R1'));
  let tier = 'tin';
  for (const [from, t] of BOX_TIER) if (i >= RUNG_IDS.indexOf(from)) tier = t;
  return tier;
}

const CSS_HREF = new URL('./ui/shop.css', import.meta.url).href;
function ensureCss() {
  if (document.querySelector('link[data-bm-shop]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS_HREF; l.dataset.bmShop = '1'; document.head.appendChild(l);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#e2ad4c"/><circle cx="12" cy="12" r="7.4" fill="none" stroke="#a8742a" stroke-width="1.6"/></svg>';

// ── THE PLAIN PANEL ──────────────────────────────────────────────────────────────────────────────────────────────
let openPanels = 0;
export function makePanel({ title = '', sub = '', body = '', onClose = () => {}, wide = false, root = document.body } = {}) {
  ensureCss();
  const el = document.createElement('div');
  el.className = 'bms' + (wide ? ' is-wide' : '');
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title);
  el.innerHTML = `<div class="bms-dim"></div><div class="bms-card">
    <button class="bms-x" type="button" aria-label="Close" title="Close (Esc)"><svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
    <h2 class="bms-title">${esc(title)}</h2>${sub ? `<div class="bms-sub">${esc(sub)}</div>` : ''}<div class="bms-body"></div></div>`;
  const bodyEl = el.querySelector('.bms-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  root.appendChild(el);
  openPanels++;
  let closed = false;
  const onKey = (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); P.close(); }
  };
  const P = {
    el, body: bodyEl,
    close() {
      if (closed) return; closed = true; openPanels--;
      removeEventListener('keydown', onKey, true);
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 200);
      try { onClose(); } catch (e) { console.error(e); }
    },
  };
  // (Esc is listened for in the capture phase, added when the panel opens: a lock box opened from the panel closes
  // the panel first, so the two never both want it)
  addEventListener('keydown', onKey, true);
  el.querySelector('.bms-x').addEventListener('click', () => P.close());
  el.querySelector('.bms-dim').addEventListener('click', () => P.close());
  requestAnimationFrame(() => el.classList.add('is-in'));
  // first button gets the keyboard, so Enter works at once (without the page scrolling)
  setTimeout(() => { if (!closed) { const b = bodyEl.querySelector('button:not([disabled]), input'); if (b) b.focus({ preventScroll: true }); } }, 30);
  return P;
}
export const anyPanelOpen = () => openPanels > 0;

// ── THE COUNTERS ─────────────────────────────────────────────────────────────────────────────────────────────────
export function makeShops({ W, rider, onOpen = () => {}, onClose = () => {}, onBuy = () => {}, onLockbox = () => {}, onStoreJob = null, say = () => {}, extra = null }) {
  let panel = null, openId = null;
  const S = { get isOpen() { return !!panel; }, get openId() { return openId; } };

  S.door = (pos) => {
    let best = null, bd = DOOR_REACH;
    for (const [id, c] of Object.entries(COUNTERS)) {
      const pl = W.places[c.place]; if (!pl || !pl.door) continue;
      const d = Math.hypot(pos.x - pl.door.x, pos.z - pl.door.z);
      if (d < bd) { bd = d; best = { id, prompt: c.prompt, dist: d }; }
    }
    return best;
  };

  const owned = () => rider.owned || (rider.owned = {});
  const saddlesOwned = () => {
    const o = owned();
    const list = Array.isArray(o.saddles) ? o.saddles.filter((s) => PRICES.saddle[s] != null) : [];
    if (o.saddle && !list.includes(o.saddle)) list.push(o.saddle);
    return list;
  };
  // the dogs a rider owns, one of each breed: owned.dogs [{ kind, name }] (a save from before there was a list has only
  // owned.dog, the one that follows you, so the list is made from it); the one with you carries its latest name
  const dogsOwned = () => {
    const o = owned();
    const list = Array.isArray(o.dogs) ? o.dogs.filter((d) => d && typeof d === 'object' && PRICES.dog[d.kind] != null && d.name) : [];
    if (o.dog && o.dog.kind && !list.some((d) => d.kind === o.dog.kind)) list.unshift({ kind: o.dog.kind, name: o.dog.name });
    return list.map((d) => (o.dog && d.kind === o.dog.kind ? { kind: d.kind, name: o.dog.name } : { kind: d.kind, name: d.name }));
  };
  const breedName = (kind) => (DOGS.find((d) => d.id === kind) || DOGS[0]).name;
  const horsesOwned = () => {
    const o = owned();
    const list = Array.isArray(o.horses) ? o.horses.filter((h) => h === 'bay' || PRICES.horse[h] != null) : [];
    if (!list.includes('bay')) list.unshift('bay');
    if (o.horse && !list.includes(o.horse)) list.push(o.horse);
    return list;
  };
  const price = (n) => `<span class="bms-price">${COIN}<b>${n}</b></span>`;
  const short = (n) => `Need ${n - rider.gold} more`;

  function row({ name, line, right, extra = '', pic = '' }) {
    return `<div class="bms-row">${pic}<div class="bms-what"><b>${esc(name)}</b><small>${esc(line)}</small>${extra}</div><div class="bms-act">${right}</div></div>`;
  }
  // the hats a rider owns: the old cowboy hat always, and those bought (owned.hats)
  const hatsOwned = () => {
    const o = owned();
    const list = Array.isArray(o.hats) ? o.hats.filter((h) => PRICES.hat[h] != null) : [];
    return ['cowboy', ...new Set(list)];
  };
  // the old hat's colour: the rider's palette's hat colour, as the title screen draws it
  const palHat = () => (PALETTES[rider.look && rider.look.palette] || PALETTES.drifter)[3];

  // ── each counter's content ──
  const BUILD = {
    stable(note) {
      const have = saddlesOwned(), on = owned().saddle;
      let h = `<h3 class="bms-h">Saddles</h3>`;
      for (const s of SADDLES) {
        const cost = PRICES.saddle[s.id];
        let right;
        if (on === s.id) right = `<span class="bms-tag is-on">On your horse</span>`;
        else if (have.includes(s.id)) right = `<button type="button" data-do="use-saddle" data-id="${s.id}">Put it on</button>`;
        else right = `${price(cost)}<button type="button" data-do="buy-saddle" data-id="${s.id}" ${rider.gold < cost ? 'disabled' : ''}>${rider.gold < cost ? short(cost) : 'Buy'}</button>`;
        h += row({ name: s.name, line: s.line, right });
      }
      h += `<h3 class="bms-h">Horses</h3>`;
      const hs = horsesOwned(), ride = owned().horse || 'bay';
      for (const x of HORSES) {
        const cost = PRICES.horse[x.id] || 0;
        let right;
        if (ride === x.id) right = `<span class="bms-tag is-on">Riding this one</span>`;
        else if (hs.includes(x.id)) right = `<button type="button" data-do="use-horse" data-id="${x.id}">Ride this one</button>`;
        else right = `${price(cost)}<button type="button" data-do="buy-horse" data-id="${x.id}" ${rider.gold < cost ? 'disabled' : ''}>${rider.gold < cost ? short(cost) : 'Buy'}</button>`;
        h += row({ name: x.name, line: x.line, right });
      }
      const fingers = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;   // (a phone or tablet: its buttons, not keys)
      h += fingers ? `<p class="bms-tip">Horse whistles your horse over · On / off gets on and off · push the thumb stick to its edge to gallop</p>`
        : `<p class="bms-tip"><kbd>H</kbd> whistles your horse over · <kbd>E</kbd> gets on and off · <kbd>Shift</kbd> gallops</p>`;
      return note + h;
    },
    store(note) {
      const mine = dogsOwned(), dog = owned().dog;
      let h = '';
      // the job at the counter: townsfolk bring order slips (word problems), each one filled tips gold
      if (onStoreJob) {
        const n = (rider.stats && rider.stats.jobs && rider.stats.jobs.orders) || 0;
        h += `<h3 class="bms-h">Mind the counter</h3>` + row({ name: 'Fill the townsfolk\'s orders',
          line: `Read each order slip and pick the right coin. Every order filled earns a tip.${n ? ` ${n} filled so far.` : ''}`,
          right: `<button type="button" data-do="store-job" class="is-main">Mind the counter</button>` });
      }
      h += `<h3 class="bms-h">${mine.length > 1 ? 'Your dogs' : 'A dog to ride with'}</h3>`;
      for (const d of mine) {
        if (dog && d.kind === dog.kind) {
          h += `<div class="bms-row"><div class="bms-what"><b>${esc(d.name)} the ${esc(breedName(d.kind))}</b><small>Follows you everywhere. Want a new name?</small>
            <div class="bms-name"><input type="text" maxlength="12" value="${esc(d.name)}" aria-label="Your dog's name" data-name="rename"></div></div>
            <div class="bms-act"><button type="button" data-do="rename">Rename</button></div></div>`;
        } else {
          h += row({ name: `${d.name} the ${breedName(d.kind)}`, line: 'Waiting at home.', right: `<button type="button" data-do="take-dog" data-id="${d.kind}">Take ${esc(d.name)}</button>` });
        }
      }
      // the breeds not owned yet: one row, pick a breed and name it (the first one the rider can afford is picked)
      const left = DOGS.filter((d) => !mine.some((m) => m.kind === d.id));
      if (left.length) {
        if (!left.some((d) => d.id === S.dogKind)) S.dogKind = (left.find((d) => rider.gold >= PRICES.dog[d.id]) || left[0]).id;
        const pick = DOGS.find((d) => d.id === S.dogKind), cost = PRICES.dog[pick.id];
        h += `<div class="bms-row is-tall"><div class="bms-what"><b>${mine.length ? 'Another dog' : 'A dog'}</b><small>${esc(pick.line)}</small>
          <div class="bms-kinds" role="radiogroup" aria-label="Which dog">${left.map((d) => `<button type="button" role="radio" aria-checked="${pick.id === d.id}" data-do="kind" data-id="${d.id}" class="${pick.id === d.id ? 'is-on' : ''}">${d.name}</button>`).join('')}</div>
          <div class="bms-name"><input type="text" maxlength="12" placeholder="Name your dog" value="${esc(S.dogName || '')}" aria-label="Your new dog's name" data-name="new"></div></div>
          <div class="bms-act">${price(cost)}<button type="button" data-do="buy-dog" ${rider.gold < cost ? 'disabled' : ''}>${rider.gold < cost ? short(cost) : 'Buy'}</button></div></div>`;
      }
      // hats: the one on your head, the ones you own (put one on), and the rest with a price
      if (extra && extra.store) h += extra.store.html();   // (the farm animals)
      h += `<h3 class="bms-h">Hats</h3>`;
      const hats = hatsOwned(), wearing = hatOf(rider.look);
      for (const x of HATS) {
        const cost = PRICES.hat[x.id] || 0;
        let right;
        if (wearing === x.id) right = `<span class="bms-tag is-on">On your head</span>`;
        else if (hats.includes(x.id)) right = `<button type="button" data-do="wear-hat" data-id="${x.id}">Wear it</button>`;
        else right = `${price(cost)}<button type="button" data-do="buy-hat" data-id="${x.id}" ${rider.gold < cost ? 'disabled' : ''}>${rider.gold < cost ? short(cost) : 'Buy'}</button>`;
        h += row({ name: x.name, line: x.line, right, pic: hatIcon(x.id, x.colour || palHat()) });
      }
      return note + h;
    },
    sheriff(note) {
      const mine = rider.lockboxes || [];
      const tier = boxTier(rider);
      let h = `<h3 class="bms-h">Your lock boxes</h3>`;
      h += mine.length
        ? row({ name: boxesLine(mine), line: 'Won on the round-up. Crack one open here.', right: `<button type="button" data-do="open-own">Open one</button>` })
        : row({ name: 'None yet', line: 'Finish a round-up wave to win one.', right: '' });
      h += `<h3 class="bms-h">Seized boxes</h3>`;
      h += row({ name: `${TIER_NAME[tier]}`, line: `The sheriff pays up to ${TIER_GOLD[tier]} gold for each one you crack. There are always more.`,
        right: `<button type="button" data-do="open-seized" class="is-main">Crack one</button>` });
      h += `<p class="bms-tip">Lock boxes pay the most gold. Solve for x with the buttons: do the same to both sides.</p>`;
      return note + h;
    },
    cabin(note) {
      const mine = rider.lockboxes || [];
      let h = `<h3 class="bms-h">The table</h3>`;
      h += mine.length
        ? row({ name: boxesLine(mine), line: 'Open them here, nice and quiet.', right: `<button type="button" data-do="open-own" class="is-main">Open one</button>` })
        : row({ name: 'No lock boxes yet', line: 'Finish a round-up wave to win one, or crack seized boxes at the sheriff’s desk.', right: '' });
      return note + h;
    },
  };
  function boxesLine(list) {
    const n = {}; for (const b of list) n[b.tier] = (n[b.tier] || 0) + 1;
    return Object.entries(n).map(([t, k]) => `${k} × ${TIER_NAME[t] || t}`).join(', ');
  }

  // ── opening, drawing, and what the buttons do ──
  S.open = (id, note = '') => {
    if (!COUNTERS[id]) return;
    if (panel) panel.close();
    openId = id;
    const c = COUNTERS[id];
    onOpen(id);
    panel = makePanel({ title: c.title, sub: c.sub, onClose: () => { panel = null; openId = null; onClose(id); } });
    panel.el.dataset.counter = id;
    draw(note);
    panel.body.addEventListener('click', onClick);
    panel.body.addEventListener('input', (e) => { if (e.target.matches('[data-name="new"]')) S.dogName = e.target.value; });
    for (const t of ['input', 'keydown']) panel.body.addEventListener(t, (e) => { const x = extra && extra[openId]; if (x && x[t]) x[t](e, panel.body); });
    panel.body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-name]')) { const b = panel.body.querySelector(e.target.dataset.name === 'rename' ? '[data-do="rename"]' : '[data-do="buy-dog"]'); if (b && !b.disabled) b.click(); } });
  };
  S.close = () => { if (panel) panel.close(); };
  function draw(note = '') {
    if (!panel) return;
    const keep = document.activeElement && panel.el.contains(document.activeElement) ? document.activeElement.dataset.do + ':' + (document.activeElement.dataset.id || '') : null;
    const n = note ? `<div class="bms-note">${esc(note)}</div>` : '';
    panel.body.innerHTML = `<div class="bms-purse">${COIN}<b>${rider.gold}</b> gold</div>` + BUILD[openId](n);
    if (keep) { const [d, i] = keep.split(':'); const b = panel.body.querySelector(`[data-do="${d}"]${i ? `[data-id="${i}"]` : ''}`); if (b && !b.disabled) b.focus({ preventScroll: true }); }
    // (on a small screen the panel scrolls: a note just said, "Snowy is yours!", is brought into view)
    const ne = note && panel.body.querySelector('.bms-note'); if (ne && ne.scrollIntoView) ne.scrollIntoView({ block: 'nearest' });
  }
  function onClick(e) {
    const b = e.target.closest('button[data-do]'); if (!b || b.disabled) return;
    const what = b.dataset.do, id = b.dataset.id, o = owned();
    // (another counter's rows: their buttons are theirs)
    const x = extra && extra[openId] && extra[openId].click ? extra[openId].click(what, id, panel.body) : undefined;
    if (x !== undefined) { if (x && x.bought) onBuy(x.bought); draw((x && x.note) || ''); return; }
    if (what === 'buy-saddle') {
      if (!spend(rider, PRICES.saddle[id])) { draw('Not enough gold yet.'); return; }
      o.saddles = [...new Set([...saddlesOwned(), id])]; o.saddle = id; saveRider(rider);
      // (the counter's own note says it: no toast on top of it, as at the sheriff's desk)
      onBuy('saddle');
      draw(`The ${SADDLES.find((s) => s.id === id).name.toLowerCase()} is on your horse. Press H to whistle for it.`);
    } else if (what === 'use-saddle') {
      o.saddle = id; saveRider(rider); onBuy('saddle'); draw();
    } else if (what === 'buy-horse') {
      if (!spend(rider, PRICES.horse[id])) { draw('Not enough gold yet.'); return; }
      o.horses = [...new Set([...horsesOwned(), id])]; o.horse = id; saveRider(rider);
      const nm = HORSES.find((h) => h.id === id).name;
      onBuy('horse'); draw(saddlesOwned().length ? `${nm} is yours, saddled up by the stable.` : `${nm} is yours, waiting by the stable. You'll need a saddle to ride.`);
    } else if (what === 'use-horse') {
      o.horses = horsesOwned(); o.horse = id; saveRider(rider); onBuy('horse'); draw();
    } else if (what === 'buy-hat') {
      if (!spend(rider, PRICES.hat[id])) { draw('Not enough gold yet.'); return; }
      o.hats = [...new Set([...hatsOwned().filter((h) => h !== 'cowboy'), id])];
      rider.look = { ...(rider.look || {}), hatStyle: id, hat: true }; saveRider(rider);
      onBuy('hat');
      draw(`The ${HATS.find((x) => x.id === id).name.toLowerCase()} is on your head. It suits you!`);
    } else if (what === 'wear-hat') {
      rider.look = { ...(rider.look || {}), hatStyle: id, hat: true }; saveRider(rider); onBuy('hat'); draw();
    } else if (what === 'kind') {
      S.dogKind = id; draw();
    } else if (what === 'buy-dog') {
      const kind = S.dogKind, cost = PRICES.dog[kind]; if (cost == null) return;
      const input = panel.body.querySelector('[data-name="new"]');
      const name = cleanName(input && input.value) || DOG_NAMES[Math.floor(Math.random() * DOG_NAMES.length)];
      if (!spend(rider, cost)) { draw('Not enough gold yet.'); return; }
      const before = o.dog;
      o.dogs = [...dogsOwned(), { kind, name }]; o.dog = { kind, name }; S.dogName = ''; saveRider(rider);
      onBuy('dog');
      draw(before ? `${name} is yours! ${before.name} heads home to wait, and ${name} trots out with you.` : `${name} is yours! ${name} wags and trots out to wait by you.`);
    } else if (what === 'take-dog') {
      const d = dogsOwned().find((x) => x.kind === id); if (!d) return;
      o.dogs = dogsOwned(); o.dog = { kind: d.kind, name: d.name }; saveRider(rider); onBuy('dog'); draw(`${d.name} comes along with you.`);
    } else if (what === 'rename') {
      const input = panel.body.querySelector('[data-name="rename"]');
      const name = cleanName(input && input.value); if (!name || !o.dog) return;
      o.dogs = dogsOwned().map((x) => (x.kind === o.dog.kind ? { kind: x.kind, name } : x)); o.dog = { ...o.dog, name }; saveRider(rider); onBuy('dog'); draw(`Your dog answers to ${name} now.`);
    } else if (what === 'open-own') {
      const box = (rider.lockboxes || [])[0]; if (!box) return;
      const back = openId; panel.close();
      onLockbox({ tier: box.tier, from: 'loot' }, { own: true, after: (r) => S.open(back, resultNote(r)) });
    } else if (what === 'open-seized') {
      const back = openId; panel.close();
      onLockbox({ tier: boxTier(rider), from: 'sheriff' }, { own: false, after: (r) => S.open(back, resultNote(r)) });
    } else if (what === 'store-job') {
      panel.close();
      if (onStoreJob) onStoreJob();
    }
  }
  function resultNote(r) {
    if (!r) return '';
    if (r.solved && r.boxes > 1) return `Cracked ${r.boxes} boxes, +${r.gold} gold.`;
    if (r.solved) return `Cracked it! ${r.stars} star${r.stars === 1 ? '' : 's'}, +${r.gold} gold.`;
    return 'You left that box. It will keep.';
  }
  S.redraw = () => draw();
  S.dispose = () => S.close();
  return S;
}
function cleanName(s) { return String(s || '').replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, 12); }
