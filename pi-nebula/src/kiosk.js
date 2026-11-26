// THE SHIP STORE'S KIOSK: the one place in the station where a ship is bought. A cash machine's cabinet with a screen,
// against a wall of a hallway (kit/furniture.js kiosk; where it stands is its line in kit/rooms/station.json). The game's
// maker (2026-11-24): "I am also thinking that maybe we should have a ship sales screen somewhere, rather then adding
// that on the end of the captain's card. Maybe in a blank spot in the hallway we can have a ship store kiosk that lets
// you browse the ships and shows their prices and lets you pick the colors and stuff. Then if you buy one it will be in
// the hanger (or docked). But, if you go to the captain you can still work for them and their ship will be in the
// hanger in that case." And: "The kiosk can just be a screen on the wall somewhere. Or you can build a little something
// around it like an ATM type thing."
//
// WALKED UP TO, as the jobs board's small copies are: a prompt comes up ("Ship store", Open, E, or its button) and the
// store's screen opens along the bottom of the screen. On it:
//   - THE FOUR SHIPS, a tab each with its price (src/own.js STORE and PRICES, the one place they are kept), the cheapest
//     first; the one picked is SHOWN FROM OUTSIDE, the real ship in its hangar (the Hauler at the dock), as the paint card
//     shows it (src/shippaint.js view; no second viewer).
//   - ITS PAINT: the same nine swatches, free (kit/ships/paints.js). A ship not theirs yet is shown in the paint picked,
//     which it is bought in; nothing is kept until it is bought. A ship that is theirs is repainted at once and kept, as
//     on the owner's card at its seat.
//   - THE SALE, in the words the captains' cards had: "Buy the Miner: 60,000 credits" and Buy, pressed once asking
//     "Buy the Miner for 60,000 credits?" (Yes, buy it / No); short of credits how many more; the Hauler "For sale once
//     the bridge out to it is built"; bought, "The Miner is yours" and "Take your Miner out" (the line on the floor to
//     it). Bought, the credits are spent and the ship is theirs in its hangar (the Hauler at the dock), in that paint
//     (src/mission.js buyShip).
//
//   const K = makeKiosk({ W, walls, input, mission, shipPaint, crane, crew, bridge, quiet })
//     crane: the smelter's crane (src/crane.js): the Miner, away on a haul of its own when it is looked at, is home at once
//     quiet(): something else's prompt or question is up (the kiosk's waits)
//   K.update(dt, P, playing)   each frame: the prompt near the kiosk
//   K.open() / K.close() / K.pick(ship) / K.paint(id) / K.buy() / K.state()   (the rigs: GAME.kiosk); K.at: where to stand
import * as THREE from 'three';
import { piecesOf } from './people.js';
import { STORE, saleOf, saleWords } from './own.js';
import { paintOf } from './paint.js';
import { PAINTS, FACTORY, hullColour, paintById } from '../kit/ships/paints.js';
import { KIOSK } from '../kit/furniture.js';

// near the kiosk: the spot to stand, out from its front (m); how near it the prompt comes up, and how much the view must
// be turned toward it (as the jobs board's small copies: src/jobsboard.js BOARD)
export const STAND = { out: 0.9, near: 2.4, facing: 0.25 };

const CSS = `
.psk { position: fixed; left: 50%; bottom: max(10px, env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 26; width: min(720px, calc(100vw - 16px)); max-height: calc(100vh - 20px); overflow-y: auto;
  padding: 12px 14px 14px; background: rgba(12, 16, 22, 0.94); box-shadow: inset 0 0 0 2px rgba(150, 210, 250, 0.7); clip-path: var(--oct);
  --ink: #eef1f4; --dim: #a7b0ba; --cyan: #8fd3ff; --line: rgba(150, 210, 250, 0.36); --accent: #8fd3ff; --accent-ink: #06202e; --cut: 14px;
  --oct: polygon(var(--cut) 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, var(--cut) 100%, 0 calc(100% - var(--cut)), 0 var(--cut));
  font: 400 16px/1.35 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: var(--ink); -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.psk[hidden] { display: none; }
.psk * { box-sizing: border-box; }
.psk button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
.psk-top { display: flex; align-items: baseline; gap: 10px; padding-bottom: 8px; margin-bottom: 10px; border-bottom: 1px solid var(--line); }
.psk-top b { font-size: 19px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cyan); }
.psk-top small { flex: 1; font-size: 13px; color: var(--dim); letter-spacing: 0.04em; }
.psk-x { flex: none; width: 40px; height: 40px; margin: -6px -6px -6px auto; font-size: 22px !important; line-height: 1; color: #cfeaff !important; background: rgba(255, 255, 255, 0.06) !important; clip-path: var(--oct); --cut: 8px; }
.psk-ships { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 0 0 10px; }
.psk-ship { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 54px; padding: 4px 2px; background: rgba(150, 210, 250, 0.07) !important; box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.25); clip-path: var(--oct); --cut: 8px; }
.psk-ship b { font-size: 15px; letter-spacing: 0.05em; text-transform: uppercase; }
.psk-ship small { font-size: 13px; color: var(--dim); }
.psk-ship.is-on { background: rgba(150, 210, 250, 0.2) !important; box-shadow: inset 0 0 0 2px var(--cyan); }
.psk-ship.is-on small { color: #dff2ff; }
.psk-ship.is-mine small { color: #ffd560; }
.psk-paintline { margin: 0 0 6px; font-size: 13px; color: var(--dim); }
.psk-paintline b { color: var(--ink); font-weight: 600; }
.psk-paints { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 6px; margin: 0 0 12px; }
.psk-paint { height: 44px; padding: 0; background: var(--c) !important; clip-path: var(--oct); --cut: 8px; box-shadow: inset 0 0 0 2px rgba(6, 8, 12, 0.55); }
.psk-paint:hover { box-shadow: inset 0 0 0 2px rgba(232, 243, 252, 0.9); }
.psk-paint.is-on { box-shadow: inset 0 0 0 3px var(--cyan), inset 0 0 0 5px rgba(6, 8, 12, 0.85); }
.psk-sale { display: flex; align-items: center; gap: 10px; padding-top: 10px; border-top: 1px solid var(--line); }
.psk-sale span { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; }
.psk-sale span b { font-size: 16px; letter-spacing: 0.03em; color: #ffffff; }
.psk-sale span small { font-size: 13px; color: var(--dim); }
.psk-sale button { flex: none; min-height: 46px; padding: 6px 16px; font-size: 14px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; clip-path: var(--oct); --cut: 8px; }
.psk-buy, .psk-take { color: var(--accent-ink) !important; background: var(--accent) !important; }
.psk-no { background: rgba(40, 47, 56, 0.92) !important; box-shadow: inset 0 0 0 1.5px var(--line); }
body:has(.psk:not([hidden])) .pnj-prompt { visibility: hidden; }
@media (hover: none) and (pointer: coarse) { .psk kbd { display: none; } }
@media (max-width: 640px) { .psk { padding: 10px 10px 12px; } .psk-top small { display: none; } .psk-ship b { font-size: 13px; letter-spacing: 0.02em; } .psk-ship small { font-size: 12px; }
  .psk-paints { grid-template-columns: repeat(5, minmax(0, 1fr)); } .psk-paint { height: 42px; } .psk-sale { flex-wrap: wrap; } .psk-sale button { flex: 1 1 auto; } }
`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const say = (n) => Number(n).toLocaleString('en-US');
// (the sale's line: src/own.js saleWords; its buttons here)
const BUTTONS = { owned: (S) => [['psk-take', `Take your ${S.name} out`]], closed: () => [], short: () => [], sure: () => [['psk-buy', 'Yes, buy it'], ['psk-no', 'No']], can: () => [['psk-buy', 'Buy']] };
const saleLine = (S, o) => { const L = saleWords(S, o); return { ...L, buttons: BUTTONS[L.kind](S) }; };

export function makeKiosk({ W, walls, input = null, usable = null, mission, shipPaint, crane = null, crew = () => null, bridge = () => false, quiet = () => false }) {
  if (!document.getElementById('psk-css')) { const st = document.createElement('style'); st.id = 'psk-css'; st.textContent = CSS; document.head.appendChild(st); }
  const K = piecesOf(W.R).find((x) => x.piece === 'kiosk');
  const api = { at: null, isOpen: false, near: false, update() {}, open() {}, close() {}, state: () => null };
  if (!K) { console.info('ship store: the station has no kiosk'); return api; }
  const mid = new THREE.Vector3().setFromMatrixPosition(K.M), out = new THREE.Vector3(0, 0, 1).transformDirection(K.M);
  const at = walls.snap(mid.x + out.x * (KIOSK.d + STAND.out), 0.4, mid.z + out.z * (KIOSK.d + STAND.out), 1.2) || new THREE.Vector3(mid.x + out.x, mid.y, mid.z + out.z);
  api.at = at; api.room = K.room; api.facing = Math.atan2(-out.x, -out.z);

  // ── the prompt (the jobs board's look: src/jobsboard.js .pjb-prompt) ──
  const prompt = document.createElement('div');
  prompt.className = 'pjb-prompt psk-prompt'; prompt.hidden = true;
  prompt.innerHTML = '<div class="pjb-pw"><b>Ship store</b><small>Browse the ships and their prices</small></div><button type="button" class="pjb-open">Open<kbd>E</kbd></button>';
  document.body.appendChild(prompt);
  prompt.querySelector('.pjb-open').addEventListener('click', () => open());

  // ── the store's screen ──
  const el = document.createElement('div');
  el.className = 'psk'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Ship store');
  document.body.appendChild(el);
  let isOpen = false, ship = STORE[0], sure = false, wasInput = true, playing = false, near = false, held = null;
  const picked = {};      // (the paint picked here for each ship not theirs yet, this visit)
  const saleNow = (id = ship) => saleOf(crew(), id, { bridge: !!bridge() });
  const paintNow = (id = ship) => (saleNow(id).owned ? paintOf(crew(), id) : picked[id] || FACTORY);
  // (the ship picked shown from outside, in the paint picked for it; the Miner away on a haul of its own is home at once,
  // as when its contract is signed)
  function show() {
    if (ship === 'miner' && crane) { if (held == null) { held = !!crane.awayHeld; crane.awayHeld = true; } if (crane.mode === 'away' || crane.mode === 'landing') crane.arrive(); }
    for (const id of STORE) shipPaint.preview(id, null); shipPaint.preview(ship, paintNow()); shipPaint.view(ship);
  }
  function draw() {
    const S = saleNow(), L = saleLine(S, { sure }), on = paintNow(), P = paintById(on) || PAINTS[0];
    el.innerHTML = `<header class="psk-top"><b>Ship store</b><small></small><button type="button" class="psk-x" aria-label="Close (Esc)">&times;</button></header>
      <div class="psk-ships" role="tablist">${STORE.map((id) => { const s = saleNow(id); return `<button type="button" class="psk-ship${id === ship ? ' is-on' : ''}${s.owned ? ' is-mine' : ''}" role="tab" aria-selected="${id === ship}" data-ship="${id}"><b>${esc(s.name)}</b><small>${s.owned ? 'Yours' : say(s.price)}</small></button>`; }).join('')}</div>
      <p class="psk-paintline">Paint: <b class="psk-paintname">${esc(P.name)}</b>${S.owned ? '' : ' · free'}</p>
      <div class="psk-paints" role="radiogroup" aria-label="The paint of its hull">${PAINTS.map((p) => `<button type="button" class="psk-paint${p.id === on ? ' is-on' : ''}" role="radio" aria-checked="${p.id === on}" data-paint="${esc(p.id)}" title="${esc(p.name)}" aria-label="${esc(p.name)}" style="--c:${esc(hullColour(ship, p.id))}"></button>`).join('')}</div>
      <div class="psk-sale" data-sale="${L.kind}"><span><b>${esc(L.head)}</b><small>${esc(L.sub)}</small></span>${L.buttons.map(([c, w]) => `<button type="button" class="${c}">${esc(w)}</button>`).join('')}</div>`;
    el.querySelector('.psk-x').addEventListener('click', () => close());
    for (const b of el.querySelectorAll('.psk-ship')) b.addEventListener('click', () => pick(b.dataset.ship));
    for (const b of el.querySelectorAll('.psk-paint')) b.addEventListener('click', () => paint(b.dataset.paint));
    const buy = el.querySelector('.psk-buy'), no = el.querySelector('.psk-no'), take = el.querySelector('.psk-take');
    if (buy) buy.addEventListener('click', () => { if (!sure) { sure = true; draw(); return; } sure = false; doBuy(); });
    if (no) no.addEventListener('click', () => { sure = false; draw(); });
    if (take) take.addEventListener('click', () => { const id = ship; close(); mission.leadOwn(id); });
  }
  function pick(id) { if (!isOpen || !STORE.includes(id)) return false; ship = id; sure = false; show(); draw(); return true; }
  function paint(id) {
    if (!isOpen || !paintById(id)) return false;
    // (theirs: repainted and kept at once, as at its seat; not yet: the paint it would be bought in)
    if (saleNow().owned) shipPaint.pick(ship, id); else picked[ship] = id;
    show(); draw(); return true;
  }
  let lastBuy = null;
  function doBuy() {
    const r = mission.buyShip(ship, picked[ship] && picked[ship] !== FACTORY ? picked[ship] : null);
    lastBuy = { ship, ok: !!r.ok, why: r.why || null };
    show(); draw();
  }
  function onKey(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (sure) { sure = false; draw(); } else close(); return; }
    // (the arrows go from ship to ship; never the buying: that is only ever its own button, pressed twice)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const i = STORE.indexOf(ship), n = STORE.length; pick(STORE[(i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n]); }
  }
  function open() {
    if (isOpen || !playing || (mission && mission.busy)) return false;
    isOpen = true; sure = false; el.hidden = false; prompt.hidden = true;
    if (input) { wasInput = input.enabled; input.enabled = false; }
    addEventListener('keydown', onKey, true);
    show(); draw();
    return true;
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; sure = false; el.hidden = true;
    removeEventListener('keydown', onKey, true);
    for (const id of STORE) shipPaint.preview(id, null);
    shipPaint.view(null);
    if (crane && held != null) { crane.awayHeld = held; held = null; }
    if (input) input.enabled = wasInput;
  }
  addEventListener('keydown', (e) => {
    if (!playing || isOpen) return;
    if (near && !prompt.hidden && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); e.stopImmediatePropagation(); open(); }
  }, true);
  // (a mouse: over the kiosk's cabinet, while its prompt is up, the hand, and a click opens the store as E does:
  // src/usable.js; its cabinet as kit/furniture.js kiosk builds it, from the wall out)
  if (usable) usable.add({ name: 'kiosk', ready: () => near && !prompt.hidden && !isOpen, use: () => open(),
    shape: { box: [-KIOSK.half, 0, 0, KIOSK.half, KIOSK.top, KIOSK.d], matrix: K.M } });
  const _d = new THREE.Vector3();
  api.update = (dt, P, isPlaying = true) => {
    playing = isPlaying && !!P;
    if (!playing) { if (isOpen) close(); prompt.hidden = true; near = false; return; }
    W.camera.getWorldDirection(_d); _d.y = 0; _d.normalize();
    const dx = mid.x - P.pos.x, dz = mid.z - P.pos.z, d = Math.hypot(at.x - P.pos.x, at.z - P.pos.z);
    near = d < STAND.near && Math.abs(P.pos.y - at.y) < 1.5 && (d < 0.8 || (_d.x * dx + _d.z * dz) / (Math.hypot(dx, dz) || 1) > STAND.facing);
    prompt.hidden = !near || isOpen || !!quiet() || !!(mission && mission.busy);
  };
  Object.assign(api, { open, close, pick, paint,
    buy: () => { const b = el.querySelector('.psk-buy'); if (b) b.click(); return !!b; },
    get isOpen() { return isOpen; }, get near() { return near; }, get lastBuy() { return lastBuy; },
    state: () => ({ open: isOpen, ship, sure, paint: paintNow(), sale: saleNow(), shown: el.querySelector('.psk-sale') ? el.querySelector('.psk-sale').dataset.sale : null,
      words: isOpen ? el.innerText.replace(/\n+/g, ' | ') : '', prompt: !prompt.hidden, near, list: STORE.map((id) => ({ ...saleNow(id), paint: paintNow(id) })) }) });
  return api;
}
