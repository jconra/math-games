// A CAPTAIN'S CONTRACT, the card (the game's maker, 2026-11-17: "the captain should offer you a contract. It might
// say '10% for piloting to location / 20% for operating the drill / 20% for serving as engineer'"). The mission's
// roles with their shares (src/missions.js: data), which of them the crew member is signing for, the share that comes
// to, and one plain line on how it is paid. A role whose game is not made yet is the captain's own crew's this trip and
// cannot be picked; with more than one role open, each open one is a switch (at least one stays on). Sign, or Not now
// (the offer stays open). The job panel's glass; along the bottom on a phone. Loaded only when a captain's offer is
// taken up (src/mission.js).
//
// BUYING THE SHIP, AND A SHIP THAT IS YOURS (src/own.js has the game's maker's words). Under the captain's offer the card
// has ONE MORE LINE, the ship's sale (`sale`): "Buy the Miner: 60,000 credits" with its button (pressed once it asks
// "Buy the Miner for 60,000 credits?", Yes or No, so nothing that dear is spent by a slip of the thumb); short of
// credits, how many more are needed and no button; bought, "The Miner is yours" and "Take your Miner out". The offer
// above it is exactly as it was, owned or not. THE OWNER'S CARD (`mode: 'own'`: at the pilot's seat of a ship that is
// theirs, or from that button) is the same card turned to a run of their own: each of the three jobs is theirs or a
// hired crew member's (the tag says who, and what the hired one takes), what they keep, and its buttons: Start the run,
// Just fly (no pay), Not now. Where a run of their own cannot start (`own.run` false: the Hauler before the old station
// is found, a contract still on) it says why and offers the flying alone. A card with nothing to sign (`mode: 'sale'`:
// the shipping computer before the old station is found) is the sale's line alone.
//
//   const C = openContract(root, { mission, captain, onSign(roleIds), onLater(), sale, own, mode })   C.close(), C.el, C.state()
//     sale: { now() -> the ship's sale for this crew member (src/own.js saleOf), buy() -> true once bought,
//             take() -> 'own' (this card turns to the owner's) or anything else (the caller has seen to it) }
//     own:  { run (a run of their own can start here), why (it cannot: the words), fly (just flying can start here),
//             note (where else the other of the two starts), onRun(roleIds), onFly() }
import { rolesOf, shareOf, payOf, crewFor, ownShare } from './missions.js';

const CSS = `
.pmc { position: fixed; inset: 0; z-index: 26; display: grid; place-items: center; padding: 12px; background: rgba(4, 6, 10, 0.45); opacity: 0; transition: opacity 0.2s ease;
  --ink: #eef1f4; --dim: #a7b0ba; --faint: #78818b; --line: rgba(196, 220, 240, 0.36); --accent: #ffc83c; --accent-ink: #1c1205; --cut: 14px;
  --oct: polygon(var(--cut) 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, var(--cut) 100%, 0 calc(100% - var(--cut)), 0 var(--cut));
  font: 400 16px/1.4 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: var(--ink); -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.pmc.is-on { opacity: 1; }
.pmc * { box-sizing: border-box; }
.pmc button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
.pmc-card { width: min(560px, 100%); max-height: 100%; overflow-y: auto; padding: 16px 18px 16px; background: rgba(15, 19, 25, 0.95); box-shadow: inset 0 0 0 2px rgba(255, 205, 60, 0.75); clip-path: var(--oct); }
.pmc-top { display: flex; align-items: baseline; gap: 10px; padding-bottom: 8px; margin-bottom: 10px; border-bottom: 1px dashed rgba(255, 205, 60, 0.45); }
.pmc-top b { font-size: 20px; letter-spacing: 0.08em; text-transform: uppercase; color: #ffd560; }
.pmc-top small { font-size: 13px; color: var(--dim); letter-spacing: 0.06em; text-transform: uppercase; }
.pmc-what { margin: 0 0 10px; font-size: 15px; color: #dfe6ee; }
.pmc-roles { display: grid; gap: 6px; margin: 0 0 6px; }
.pmc-role { display: grid; grid-template-columns: 1fr auto auto; align-items: center; column-gap: 12px; width: 100%; min-height: 50px; padding: 6px 12px; text-align: left;
  background: rgba(255, 255, 255, 0.05) !important; box-shadow: inset 0 0 0 1px rgba(196, 220, 240, 0.2); clip-path: var(--oct); --cut: 8px; }
.pmc-role span { display: flex; flex-direction: column; min-width: 0; }
.pmc-role b { font-size: 15px; letter-spacing: 0.06em; text-transform: uppercase; }
.pmc-role small { font-size: 13px; color: var(--dim); }
.pmc-role em { font-style: normal; font-size: 22px; font-weight: 800; }
.pmc-role i { font-style: normal; min-width: 112px; padding: 5px 8px; text-align: center; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--dim); background: rgba(0, 0, 0, 0.3); clip-path: var(--oct); --cut: 6px; }
.pmc-role.is-mine { background: rgba(255, 200, 60, 0.14) !important; box-shadow: inset 0 0 0 2px rgba(255, 205, 60, 0.8); }
.pmc-role.is-mine i { color: var(--accent-ink); background: var(--accent); }
.pmc-role.is-crew { opacity: 0.8; cursor: default; }
button.pmc-role:hover { box-shadow: inset 0 0 0 2px rgba(232, 243, 252, 0.9); }
.pmc-note { margin: 0 0 10px; font-size: 13px; color: var(--faint); }
.pmc-pay { margin: 0 0 12px; padding: 10px 12px; background: rgba(120, 190, 240, 0.08); box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.3); clip-path: var(--oct); --cut: 8px; }
.pmc-pay b { display: block; font-size: 17px; color: #ffd560; }
.pmc-pay p { margin: 4px 0 0; font-size: 14px; color: #dfe6ee; }
.pmc-btns { display: flex; gap: 10px; }
.pmc-btns button { flex: 1 1 0; height: 48px; font-size: 15px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; clip-path: var(--oct); --cut: 9px; }
.pmc-sign { color: var(--accent-ink) !important; background: var(--accent) !important; }
.pmc-later { background: rgba(40, 47, 56, 0.92) !important; box-shadow: inset 0 0 0 1.5px var(--line); }
.pmc kbd { font: 700 10px/1 inherit; font-family: inherit; padding: 3px 5px; margin-left: 8px; border-radius: 3px; background: rgba(0, 0, 0, 0.2); vertical-align: 2px; }
.pmc-sale { display: flex; align-items: center; gap: 10px; margin: 12px 0 0; padding: 10px 0 0; border-top: 1px dashed rgba(255, 205, 60, 0.45); }
.pmc-sale span { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; }
.pmc-sale b { font-size: 15px; letter-spacing: 0.04em; color: #ffd560; }
.pmc-sale small { font-size: 13px; color: var(--dim); }
.pmc-sale button { flex: none; min-height: 44px; padding: 6px 14px; font-size: 14px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; clip-path: var(--oct); --cut: 8px; }
.pmc-buy, .pmc-take { color: var(--accent-ink) !important; background: var(--accent) !important; }
.pmc-no { background: rgba(40, 47, 56, 0.92) !important; box-shadow: inset 0 0 0 1.5px var(--line); }
.pmc-sale.is-only { margin-top: 0; padding-top: 0; border-top: 0; margin-bottom: 12px; }
.pmc-btns.is-own { flex-wrap: wrap; }
.pmc-btns.is-own .pmc-sign { flex: 1 1 100%; }
@media (hover: none) and (pointer: coarse) { .pmc kbd { display: none; } }
@media (max-width: 640px) { .pmc { place-items: end center; padding: 8px; } .pmc-card { padding: 12px 12px 12px; } .pmc-top b { font-size: 17px; } .pmc-role { grid-template-columns: 1fr auto; row-gap: 4px; } .pmc-role i { grid-column: 1 / -1; min-width: 0; } .pmc-what { font-size: 14px; } .pmc-sale { flex-wrap: wrap; } .pmc-sale button { flex: 1 1 auto; } }
`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const say = (n) => Number(n).toLocaleString('en-US');
// (what a run brings, as each kind of run says it; and its example: an ordinary load of the Miner's eight tonnes, the
// game's maker's own sum: 4 × 2,000 + 2 × 3,000 + 2 × 5,000; a rescue's: so much for each person brought home, four of
// them; an exploring run's: so much for each place explored, two of them; a supply run's: so much for each pallet of
// supplies delivered, four of them)
const brings = (M) => (M.perPerson ? 'the rescue pays' : M.perPlace || M.perPallet ? 'the run pays' : 'the haul sells for');
const sampleOf = (M) => (M.perPerson ? 4 * M.perPerson : M.perPlace ? (M.findPays || 0) + 2 * M.perPlace : M.perPallet ? 4 * M.perPallet : 24000);
const exampleOf = (M, share) => {
  const sample = sampleOf(M), pay = say(payOf(sample, share));
  return M.perPerson ? `The rescue pays ${say(M.perPerson)} credits for each person brought home. Four people come to ${say(sample)} credits and pay you ${pay} credits.`
    : M.perPlace ? `The run pays ${M.findPays ? `${say(M.findPays)} credits for what it finds and ${say(M.perPlace)} more` : `${say(M.perPlace)} credits`} for each place explored. Two places come to ${say(sample)} credits and pay you ${pay} credits.`
      : M.perPallet ? `The run pays ${say(M.perPallet)} credits for each pallet of supplies delivered. Four pallets come to ${say(sample)} credits and pay you ${pay} credits.`
        : `A haul that sells for ${say(sample)} credits pays you ${pay} credits.`;
};

export function openContract(root, { mission: M, captain = 'The captain', onSign = () => {}, onLater = () => {}, sale = null, own = null, mode: mode0 = 'contract' } = {}) {
  if (!document.getElementById('pmc-css')) { const st = document.createElement('style'); st.id = 'pmc-css'; st.textContent = CSS; document.head.appendChild(st); }
  const roles = rolesOf(M), open = roles.filter((r) => r.open), pick = open.length > 1;
  const mine = new Set(open.map((r) => r.id));   // (every open role at first)
  // (mode: the captain's offer, the owner's own card, or the sale's line alone; sure: the buy button pressed once)
  let closed = false, mode = mode0, sure = false;
  const el = document.createElement('div');
  el.className = 'pmc'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  root.appendChild(el);
  // (the ship, as it is said: the sale's own name for it)
  const shipName = () => { const S = sale && sale.now ? sale.now() : null; return (S && S.name) || M.shipName || 'ship'; };
  // ── THE SHIP'S SALE: one line, under the captain's offer (or alone) ──
  function saleHtml(only = false) {
    const S = sale && sale.now ? sale.now() : null; if (!S) return '';
    const ship = esc(S.name), cls = `pmc-sale${only ? ' is-only' : ''}`;
    if (S.owned) return `<div class="${cls}" data-sale="owned"><span><b>The ${ship} is yours</b><small>Take it out any time, from its pilot's seat.</small></span><button type="button" class="pmc-take">Take your ${ship} out</button></div>`;
    if (!S.open) return `<div class="${cls}" data-sale="closed"><span><b>The ${ship}: ${say(S.price)} credits</b><small>For sale ${esc(S.why)}.</small></span></div>`;
    if (S.short > 0) return `<div class="${cls}" data-sale="short"><span><b>Buy the ${ship}: ${say(S.price)} credits</b><small>You have ${say(S.credits)}. You need ${say(S.short)} more ${S.short === 1 ? 'credit' : 'credits'}.</small></span></div>`;
    if (sure) return `<div class="${cls}" data-sale="sure"><span><b>Buy the ${ship} for ${say(S.price)} credits?</b><small>You will have ${say(S.credits - S.price)} ${S.credits - S.price === 1 ? 'credit' : 'credits'} left.</small></span><button type="button" class="pmc-buy">Yes, buy it</button><button type="button" class="pmc-no">No</button></div>`;
    return `<div class="${cls}" data-sale="can"><span><b>Buy the ${ship}: ${say(S.price)} credits</b><small>You have ${say(S.credits)} credits.</small></span><button type="button" class="pmc-buy">Buy</button></div>`;
  }
  function wireSale() {
    const buy = el.querySelector('.pmc-buy'), no = el.querySelector('.pmc-no'), take = el.querySelector('.pmc-take');
    if (buy) buy.addEventListener('click', () => { if (closed) return; if (!sure) { sure = true; draw(); return; } sure = false; if (sale.buy) sale.buy(); draw(); });
    if (no) no.addEventListener('click', () => { sure = false; draw(); });
    if (take) take.addEventListener('click', () => takeOut());
  }
  // (the owner's button: this card turns to their own, or the caller has seen to it and the card is put away)
  function takeOut() { if (closed || !sale || !sale.take) return; const r = sale.take(); if (r === 'own' && own) { mode = 'own'; sure = false; draw(); } else close(); }

  function draw() {
    el.setAttribute('aria-label', mode === 'contract' ? `${captain}'s contract` : `Your ${shipName()}`);
    if (mode === 'sale') return drawSale();
    if (mode === 'own') return drawOwn();
    const share = shareOf([...mine]);
    // (who does each job left to the crew: the ship has a crew of three, the captain and one of his crew with the crew
    // member: src/missions.js aboardOf)
    const by = Object.fromEntries(crewFor(M, [...mine], 'You', captain).map((c) => [c.role, c.name]));
    for (const r of roles) r.by = by[r.id] || r.crew;
    el.innerHTML = `<section class="pmc-card">
      <header class="pmc-top"><b>${esc(M.name)}</b><small>${esc(captain)}'s contract</small></header>
      <p class="pmc-what">${esc(M.about)}</p>
      <div class="pmc-roles">${roles.map((r) => {
    const on = mine.has(r.id), inner = `<span><b>${esc(r.name)}</b><small>${esc(r.does)}</small></span><em>${r.share}%</em><i>${on ? 'You' : esc(r.by)}</i>`;
    return r.open && pick ? `<button type="button" class="pmc-role${on ? ' is-mine' : ''}" data-role="${r.id}" aria-pressed="${on}">${inner}</button>`
      : `<div class="pmc-role ${on ? 'is-mine' : 'is-crew'}" data-role="${r.id}">${inner}</div>`;
  }).join('')}</div>
      <p class="pmc-note">${roles.some((r) => !r.open) ? `${esc(roles.filter((r) => !r.open).map((r) => r.crew).join(' and '))} of ${esc(captain)}'s own crew ${roles.filter((r) => !r.open).length === 1 ? 'does the other job' : 'do the other jobs'} this trip.` : ''}${pick ? ' Tap a job to take it or leave it to the crew.' : ''}</p>
      <div class="pmc-pay"><b>Your share: ${share}% of what ${brings(M)}</b>
        <p>${esc(M.paid)}</p>
        <p>${exampleOf(M, share)}</p></div>
      <div class="pmc-btns"><button type="button" class="pmc-sign">Sign<kbd>E</kbd></button><button type="button" class="pmc-later">Not now<kbd>Esc</kbd></button></div>
      ${saleHtml()}
    </section>`;
    el.querySelector('.pmc-sign').addEventListener('click', sign);
    el.querySelector('.pmc-later').addEventListener('click', later);
    wireRoles(); wireSale();
  }
  function wireRoles() { for (const b of el.querySelectorAll('button.pmc-role')) b.addEventListener('click', () => { const id = b.dataset.role; if (mine.has(id)) { if (mine.size > 1) mine.delete(id); } else mine.add(id); draw(); }); }
  // ── THE SALE'S LINE ALONE: nothing to sign here (the shipping computer before the old station is found) ──
  function drawSale() {
    el.innerHTML = `<section class="pmc-card">
      <header class="pmc-top"><b>The ${esc(shipName())}</b><small>${esc(captain)}</small></header>
      <p class="pmc-what">${esc(M.saleAbout || '')}</p>
      ${saleHtml(true)}
      <div class="pmc-btns"><button type="button" class="pmc-later">Not now<kbd>Esc</kbd></button></div>
    </section>`;
    el.querySelector('.pmc-later').addEventListener('click', later);
    wireSale();
  }
  // ── THE OWNER'S CARD: a run of their own (each job theirs, or a hired crew member's), or just flying ──
  function drawOwn() {
    const ship = esc(shipName()), run = !!(own && own.run), fly = !!(own && own.fly);
    const keep = ownShare(M, [...mine]), hired = crewFor(M, [...mine], 'You', null, { own: true }).filter((c) => !c.you);
    const by = Object.fromEntries(hired.map((c) => [c.role, c.name]));
    const about = String(M.about).replace(/ Each job on the run earns a share of [^.]+\.$/, '');
    el.innerHTML = `<section class="pmc-card">
      <header class="pmc-top"><b>Your ${ship}</b><small>${run ? 'A run of your own' : 'Yours to fly'}</small></header>
      ${run ? `<p class="pmc-what">${esc(about)} What ${brings(M)} is yours, less the share of anyone you hire.</p>
      <div class="pmc-roles">${roles.map((r) => {
    const on = mine.has(r.id), inner = `<span><b>${esc(r.name)}</b><small>${esc(r.does)}</small></span><em>${on ? '' : r.share + '%'}</em><i>${on ? 'You' : 'Hired: ' + esc(String(by[r.id] || r.crew).split(' ').pop())}</i>`;
    return r.open ? `<button type="button" class="pmc-role${on ? ' is-mine' : ''}" data-role="${r.id}" aria-pressed="${on}">${inner}</button>` : `<div class="pmc-role is-crew" data-role="${r.id}">${inner}</div>`;
  }).join('')}</div>
      <p class="pmc-note">Tap a job to do it yourself or to hire for it. The jobs you do yourself ask about half as many questions again as on a captain's contract.</p>
      <div class="pmc-pay"><b>You keep ${keep >= 100 ? 'all' : keep + '%'} of what ${brings(M)}</b>
        <p>${hired.length ? `${esc(hired.map((c) => `${c.name} takes ${roles.find((r) => r.id === c.role).share}%`).join(', and '))}. ` : 'Nobody hired: you do all three jobs. '}${esc(String(M.paid).replace(/You are paid your share of [^,]+,/, 'You are paid'))}</p>
        <p>${exampleOf(M, keep)}</p></div>`
    : `<p class="pmc-what">${esc((own && own.why) || '')}</p>`}
      ${own && own.note ? `<p class="pmc-note">${esc(own.note)}</p>` : ''}
      <div class="pmc-btns is-own">${run ? '<button type="button" class="pmc-sign">Start the run<kbd>E</kbd></button>' : ''}${fly ? `<button type="button" class="${run ? 'pmc-later pmc-fly' : 'pmc-sign pmc-fly'}">Just fly${run ? '' : '<kbd>E</kbd>'}</button>` : ''}<button type="button" class="pmc-later pmc-notnow">Not now<kbd>Esc</kbd></button></div>
    </section>`;
    const go = el.querySelector('.pmc-sign:not(.pmc-fly)'), fl = el.querySelector('.pmc-fly');
    if (go) go.addEventListener('click', sign);
    if (fl) fl.addEventListener('click', flyOut);
    el.querySelector('.pmc-notnow').addEventListener('click', later);
    wireRoles();
  }
  function close() { if (closed) return; closed = true; removeEventListener('keydown', onKey, true); el.classList.remove('is-on'); setTimeout(() => el.remove(), 220); }
  function sign() {
    if (closed || mode === 'sale') return;
    const ids = M.roles.filter((id) => mine.has(id));
    if (mode === 'own') { if (!own || !own.run) return; close(); own.onRun(ids); return; }
    close(); onSign(ids);
  }
  function flyOut() { if (closed || mode !== 'own' || !own || !own.fly) return; close(); own.onFly(); }
  function later() { if (closed) return; close(); onLater(); }
  function onKey(e) {
    if (closed) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (sure) { sure = false; draw(); } else later(); }
    else if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
      e.preventDefault(); e.stopImmediatePropagation();
      // (never the buying: that is only ever its own button, pressed twice)
      if (mode === 'contract') sign(); else if (mode === 'own') { if (own && own.run) sign(); else flyOut(); }
    }
  }
  addEventListener('keydown', onKey, true);
  draw();
  requestAnimationFrame(() => el.classList.add('is-on'));
  return { el, close, sign, later, takeOut, flyOut,
    // (the rigs: the buy button pressed, a job tapped)
    buy: () => { const b = el.querySelector('.pmc-buy'); if (b) b.click(); return !!b; },
    tap: (id) => { const b = el.querySelector(`button.pmc-role[data-role="${id}"]`); if (b) b.click(); return !!b; },
    state: () => ({ mode, mine: [...mine], share: mode === 'own' ? ownShare(M, [...mine]) : shareOf([...mine]), sure,
      sale: sale && sale.now ? (() => { const S = sale.now(), d = el.querySelector('.pmc-sale'); return S ? { ...S, shown: d ? d.dataset.sale : null, words: d ? d.querySelector('span').textContent : '' } : null; })() : null,
      own: own ? { run: !!own.run, fly: !!own.fly } : null,
      roles: roles.map((r) => ({ id: r.id, share: r.share, open: r.open, who: mine.has(r.id) ? 'You' : mode === 'own' ? 'Hired: ' + r.crew : r.by || r.crew })) }) };
}
