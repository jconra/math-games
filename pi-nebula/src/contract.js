// A CAPTAIN'S CONTRACT, the card (the game's maker, 2026-11-17: "the captain should offer you a contract. It might
// say '10% for piloting to location / 20% for operating the drill / 20% for serving as engineer'"). The mission's
// roles with their shares (src/missions.js: data), which of them the crew member is signing for, the share that comes
// to, and one plain line on how it is paid. A role whose game is not made yet is the captain's own crew's this trip and
// cannot be picked; with more than one role open, each open one is a switch (at least one stays on). Sign, or Not now
// (the offer stays open). The job panel's glass; along the bottom on a phone. Loaded only when a captain's offer is
// taken up (src/mission.js).
//
// A SHIP THAT IS YOURS (src/own.js has the game's maker's words). Ships are bought at the ship store's kiosk in the
// hallway (src/kiosk.js), never on a captain's card. With the ship theirs, the captain's card has one more line under
// his offer (`sale`, its owned state): "The Miner is yours" and "Take your Miner out"; the offer above it is exactly as
// it was, owned or not. THE OWNER'S CARD (`mode: 'own'`: at the pilot's seat of a ship that is
// theirs, or from that button) is the same card turned to a run of their own: each of the three jobs is theirs or one
// of their own crew's (src/own.js crewOf: those who agreed to join it; a tap on a job goes through You and each of them
// not already on another job; with no crew all three are theirs), one line "Along for the ride" with the rest of their
// crew to tap on or off, as many as the ship has seats for (src/own.js SEATS), what they keep (the operating costs, 25%,
// always taken out, and the share of each job their crew does), and its buttons: Start the run, Just fly (no pay), Not now. Where a run of their own cannot start (`own.run` false: the Hauler before the old station
// is found, a contract still on) it says why and offers the flying alone.
// THE PAINT OF ITS HULL (`own.paint`: src/shippaint.js, src/paintcard.js; the game's maker: "Its colour: pick the paint
// of its hull"): the owner's card has a Paint button, which turns the card (`mode: 'paint'`) to a row of swatches along
// the bottom of the screen with the ship shown above it; a swatch tapped repaints the ship at once; Done, back.
//
//   const C = openContract(root, { mission, captain, onSign(roleIds), onLater(), sale, own, mode })   C.close(), C.el, C.state()
//     sale: { now() -> the ship's sale for this crew member (src/own.js saleOf: is it theirs, its name),
//             take() -> 'own' (this card turns to the owner's) or anything else (the caller has seen to it) }
//     own:  { run (a run of their own can start here), why (it cannot: the words), fly (just flying can start here),
//             note (where else the other of the two starts), crew ([{ id, name }]: their own crew), seats (how many of
//             them the ship takes), onRun(roleIds, { jobs: { [role]: id }, along: [ids] }), onFly(),
//             paint (its hull's paint can be picked here: src/paintcard.js has its shape; none: no Paint button) }
import { rolesOf, shareOf, payOf, crewFor, ownShare, OPS } from './missions.js';
import { paintCss, paintHtml, paintButton } from './paintcard.js';

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
.pmc-take { color: var(--accent-ink) !important; background: var(--accent) !important; }
.pmc-btns.is-own { flex-wrap: wrap; }
.pmc-along { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 6px 0 6px; padding: 8px 12px; background: rgba(255, 255, 255, 0.03); box-shadow: inset 0 0 0 1px rgba(196, 220, 240, 0.16); clip-path: var(--oct); --cut: 8px; }
.pmc-along > b { font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); }
.pmc-along > span { flex: 1 1 auto; display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.pmc-along small { font-size: 13px; color: var(--faint); }
.pmc-mate { min-height: 36px; padding: 4px 12px; font-size: 14px !important; font-weight: 700; color: var(--ink); background: rgba(40, 47, 56, 0.92) !important; box-shadow: inset 0 0 0 1.5px var(--line); clip-path: var(--oct); --cut: 6px; }
.pmc-mate.is-on { color: var(--accent-ink) !important; background: var(--accent) !important; box-shadow: none; }
.pmc-mate:disabled { opacity: 0.45; cursor: default; }
.pmc-btns.is-own .pmc-sign { flex: 1 1 100%; }
@media (hover: none) and (pointer: coarse) { .pmc kbd { display: none; } }
@media (max-width: 640px) { .pmc { place-items: end center; padding: 8px; } .pmc-card { padding: 12px 12px 12px; } .pmc-top b { font-size: 17px; } .pmc-role { grid-template-columns: 1fr auto; row-gap: 4px; } .pmc-role i { grid-column: 1 / -1; min-width: 0; } .pmc-what { font-size: 14px; } .pmc-sale { flex-wrap: wrap; } .pmc-sale button { flex: 1 1 auto; } }
`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const say = (n) => Number(n).toLocaleString('en-US');
// ("Bo takes 10%", "Bo takes 10% and Ana 20%", "Bo takes 10%, Ana 20% and Tess 20%")
const listOf = (L) => (L.length <= 1 ? L.join('') : `${L.slice(0, -1).join(', ')} and ${L[L.length - 1]}`);
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
  // (mode: the captain's offer, or the owner's own card)
  let closed = false, mode = mode0;
  const el = document.createElement('div');
  el.className = 'pmc'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  root.appendChild(el);
  // (the ship, as it is said: the sale's own name for it)
  const shipName = () => { const S = sale && sale.now ? sale.now() : null; return (S && S.name) || M.shipName || 'ship'; };
  // ── A SHIP THAT IS THEIRS: one line, under the captain's offer (none for a ship that is not: it is sold at the kiosk) ──
  function saleHtml() {
    const S = sale && sale.now ? sale.now() : null; if (!S || !S.owned) return '';
    const ship = esc(S.name);
    return `<div class="pmc-sale" data-sale="owned"><span><b>The ${ship} is yours</b><small>Take it out any time, from its pilot's seat.</small></span><button type="button" class="pmc-take">Take your ${ship} out</button></div>`;
  }
  function wireSale() { const take = el.querySelector('.pmc-take'); if (take) take.addEventListener('click', () => takeOut()); }
  // (the owner's button: this card turns to their own, or the caller has seen to it and the card is put away)
  function takeOut() { if (closed || !sale || !sale.take) return; const r = sale.take(); if (r === 'own' && own) { mode = 'own'; draw(); } else close(); }

  function draw() {
    el.setAttribute('aria-label', mode === 'contract' ? `${captain}'s contract` : `Your ${shipName()}`);
    el.classList.toggle('is-paint', mode === 'paint');
    if (mode === 'paint') return drawPaint();
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
  function wireRoles() { for (const b of el.querySelectorAll('button.pmc-role')) b.addEventListener('click', () => { const id = b.dataset.role; if (mode === 'own') { nextWho(id); draw(); return; } if (mine.has(id)) { if (mine.size > 1) mine.delete(id); } else mine.add(id); draw(); }); }
  // ── THE OWNER'S CARD: a run of their own (each job theirs, or one of their own crew's; the rest of their crew along
  // for the ride, as many as the ship has room for), or just flying ──
  // (who does each job: { [role]: a crew member's id }, none: theirs; who rides along: their ids. own.crew: the crew
  // member's own crew, [{ id, name }]; own.seats: how many of them the ship takes)
  const mates = (own && Array.isArray(own.crew) ? own.crew : []), seats = own && Number.isFinite(own.seats) ? own.seats : 0;
  const who = {}, along = [];
  const nameOf = (id) => (mates.find((p) => p.id === id) || {}).name || 'Someone';
  const aboardN = () => Object.keys(who).length + along.length;
  // (a job tapped: the next of You and each of the crew not already on another job, in the order they joined)
  function nextWho(role) {
    const now = who[role] || null, free = [null, ...mates.map((p) => p.id).filter((id) => id === now || !Object.entries(who).some(([r, w]) => r !== role && w === id))];
    const next = free[(free.indexOf(now) + 1) % free.length];
    if (next) { who[role] = next; mine.delete(role); const k = along.indexOf(next); if (k >= 0) along.splice(k, 1); } else { delete who[role]; mine.add(role); }
    while (aboardN() > seats && along.length) along.pop();
  }
  // (one of the rest of the crew tapped on the ride's line: along, or not; on only with a seat free)
  function toggleAlong(id) {
    const k = along.indexOf(id);
    if (k >= 0) along.splice(k, 1); else if (!Object.values(who).includes(id) && mates.some((p) => p.id === id) && aboardN() < seats) along.push(id);
  }
  function drawOwn() {
    const ship = esc(shipName()), run = !!(own && own.run), fly = !!(own && own.fly);
    const keep = ownShare(M, [...mine]), jobs = M.roles.filter((id) => who[id]).map((id) => ({ role: id, name: nameOf(who[id]), share: roles.find((r) => r.id === id).share }));
    const about = String(M.about).replace(/ Each job on the run earns a share of [^.]+\.$/, '');
    const rest = mates.filter((p) => !Object.values(who).includes(p.id));
    el.innerHTML = `<section class="pmc-card">
      <header class="pmc-top"><b>Your ${ship}</b><small>${run ? 'A run of your own' : 'Yours to fly'}</small></header>
      ${run ? `<p class="pmc-what">${esc(about)} What ${brings(M)} is yours, less the operating costs and the share of anyone on your crew who does a job.</p>
      <div class="pmc-roles">${roles.map((r) => {
    const on = mine.has(r.id), inner = `<span><b>${esc(r.name)}</b><small>${esc(r.does)}</small></span><em>${on ? '' : r.share + '%'}</em><i>${on ? 'You' : esc(nameOf(who[r.id]))}</i>`;
    return r.open && mates.length ? `<button type="button" class="pmc-role${on ? ' is-mine' : ''}" data-role="${r.id}" aria-pressed="${on}">${inner}</button>` : `<div class="pmc-role${on ? ' is-mine' : ' is-crew'}" data-role="${r.id}">${inner}</div>`;
  }).join('')}</div>
      ${mates.length ? `<div class="pmc-along"><b>Along for the ride</b><span>${rest.length ? rest.map((p) => { const on = along.includes(p.id), off = !on && aboardN() >= seats; return `<button type="button" class="pmc-mate${on ? ' is-on' : ''}" data-mate="${esc(p.id)}" aria-pressed="${on}"${off ? ' disabled' : ''}>${esc(p.name)}</button>`; }).join('') : '<small>Everyone on your crew has a job.</small>'}</span>${rest.length ? `<small>${aboardN()} of ${seats} seats</small>` : ''}</div>` : ''}
      <p class="pmc-note">${mates.length ? `Tap a job to give it to someone on your crew, or to take it back.${mine.size ? ' The jobs you do yourself ask about half as many questions again as on a captain\'s contract.' : ' Your crew does every job: you ride along, and the pay slip is yours to work out.'}` : 'Nobody is on your crew yet, so all three jobs are yours. To ask someone to join it, tap them on the station. The jobs ask about half as many questions again as on a captain\'s contract.'}</p>
      <div class="pmc-pay"><b>You keep ${keep}% of what ${brings(M)}</b>
        <p>Operating costs take ${OPS.pct}%: fuel, maintenance and insurance.${jobs.length ? ` ${esc(listOf(jobs.map((c, i) => (i ? `${c.name} ${c.share}%` : `${c.name} takes ${c.share}%`))))}.` : ''} ${esc(String(M.paid).replace(/You are paid your share of [^,]+,/, 'You are paid'))}</p>
        <p>${exampleOf(M, keep)}</p></div>`
    : `<p class="pmc-what">${esc((own && own.why) || '')}</p>`}
      ${own && own.note ? `<p class="pmc-note">${esc(own.note)}</p>` : ''}
      <div class="pmc-btns is-own">${run ? '<button type="button" class="pmc-sign">Start the run<kbd>E</kbd></button>' : ''}${fly ? `<button type="button" class="${run ? 'pmc-later pmc-fly' : 'pmc-sign pmc-fly'}">Just fly${run ? '' : '<kbd>E</kbd>'}</button>` : ''}${paint ? paintButton(paint.list()) : ''}<button type="button" class="pmc-later pmc-notnow">Not now<kbd>Esc</kbd></button></div>
    </section>`;
    const go = el.querySelector('.pmc-sign:not(.pmc-fly)'), fl = el.querySelector('.pmc-fly'), pt = el.querySelector('.pmc-topaint');
    if (go) go.addEventListener('click', sign);
    if (fl) fl.addEventListener('click', flyOut);
    if (pt) pt.addEventListener('click', toPaint);
    el.querySelector('.pmc-notnow').addEventListener('click', later);
    for (const b of el.querySelectorAll('.pmc-mate')) b.addEventListener('click', () => { toggleAlong(b.dataset.mate); draw(); });
    wireRoles();
  }
  // ── THE PAINT CARD (src/paintcard.js): the ship shown from outside, a swatch for each paint; one tapped is on at once ──
  const paint = own && own.paint ? own.paint : null;
  if (paint) paintCss();
  function toPaint() { if (closed || mode !== 'own' || !paint) return; mode = 'paint'; paint.view(true); draw(); }
  function fromPaint() { if (closed || mode !== 'paint') return; paint.view(false); mode = 'own'; draw(); }
  function drawPaint() {
    el.innerHTML = paintHtml(shipName(), paint.list());
    for (const b of el.querySelectorAll('.pmc-paint')) b.addEventListener('click', () => { if (closed) return; paint.pick(b.dataset.paint); draw(); });
    el.querySelector('.pmc-paintdone').addEventListener('click', fromPaint);
  }
  function close() { if (closed) return; if (mode === 'paint') paint.view(false); closed = true; removeEventListener('keydown', onKey, true); el.classList.remove('is-on'); setTimeout(() => el.remove(), 220); }
  function sign() {
    if (closed) return;
    const ids = M.roles.filter((id) => mine.has(id));
    if (mode === 'own') { if (!own || !own.run) return; close(); own.onRun(ids, { jobs: { ...who }, along: [...along] }); return; }
    close(); onSign(ids);
  }
  function flyOut() { if (closed || mode !== 'own' || !own || !own.fly) return; close(); own.onFly(); }
  function later() { if (closed) return; close(); onLater(); }
  function onKey(e) {
    if (closed) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (mode === 'paint') fromPaint(); else later(); }
    else if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
      e.preventDefault(); e.stopImmediatePropagation();
      if (mode === 'paint') { fromPaint(); return; }
      if (mode === 'contract') sign(); else if (mode === 'own') { if (own && own.run) sign(); else flyOut(); }
    }
  }
  addEventListener('keydown', onKey, true);
  draw();
  requestAnimationFrame(() => el.classList.add('is-on'));
  return { el, close, sign, later, takeOut, flyOut, toPaint, fromPaint,
    // (the rigs: a job tapped, a swatch tapped)
    paint: (id) => { const b = el.querySelector(`.pmc-paint[data-paint="${id}"]`); if (b) b.click(); return !!b; },
    tap: (id) => { const b = el.querySelector(`button.pmc-role[data-role="${id}"]`); if (b) b.click(); return !!b; },
    state: () => ({ mode, mine: [...mine], share: mode === 'own' ? ownShare(M, [...mine]) : shareOf([...mine]),
      sale: sale && sale.now ? (() => { const S = sale.now(), d = el.querySelector('.pmc-sale'); return S ? { ...S, shown: d ? d.dataset.sale : null, words: d ? d.querySelector('span').textContent : '' } : null; })() : null,
      own: own ? { run: !!own.run, fly: !!own.fly, paint: paint ? (paint.list().find((p) => p.on) || {}).id : null } : null,
      roles: roles.map((r) => ({ id: r.id, share: r.share, open: r.open, who: mine.has(r.id) ? 'You' : mode === 'own' ? nameOf(who[r.id]) : r.by || r.crew })),
      along: along.map(nameOf), seats, crew: mates.map((p) => p.name) }),
    // (the rigs: one of the crew tapped on the ride's line)
    ride: (id) => { const b = el.querySelector(`.pmc-mate[data-mate="${id}"]`), ok = !!b && !b.disabled; if (ok) b.click(); return ok; } };
}
