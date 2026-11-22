// A CAPTAIN'S CONTRACT, the card (the game's maker, 2026-11-17: "the captain should offer you a contract. It might
// say '10% for piloting to location / 20% for operating the drill / 20% for serving as engineer'"). The mission's
// roles with their shares (src/missions.js: data), which of them the crew member is signing for, the share that comes
// to, and one plain line on how it is paid. A role whose game is not made yet is the captain's own crew's this trip and
// cannot be picked; with more than one role open, each open one is a switch (at least one stays on). Sign, or Not now
// (the offer stays open). The job panel's glass; along the bottom on a phone. Loaded only when a captain's offer is
// taken up (src/mission.js).
//
//   const C = openContract(root, { mission, captain, onSign(roleIds), onLater() })   C.close(), C.el, C.state()
import { rolesOf, shareOf, payOf, crewFor } from './missions.js';

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
@media (hover: none) and (pointer: coarse) { .pmc kbd { display: none; } }
@media (max-width: 640px) { .pmc { place-items: end center; padding: 8px; } .pmc-card { padding: 12px 12px 12px; } .pmc-top b { font-size: 17px; } .pmc-role { grid-template-columns: 1fr auto; row-gap: 4px; } .pmc-role i { grid-column: 1 / -1; min-width: 0; } .pmc-what { font-size: 14px; } }
`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const say = (n) => Number(n).toLocaleString('en-US');

export function openContract(root, { mission: M, captain = 'The captain', onSign = () => {}, onLater = () => {} } = {}) {
  if (!document.getElementById('pmc-css')) { const st = document.createElement('style'); st.id = 'pmc-css'; st.textContent = CSS; document.head.appendChild(st); }
  const roles = rolesOf(M), open = roles.filter((r) => r.open), pick = open.length > 1;
  const mine = new Set(open.map((r) => r.id));   // (every open role at first)
  let closed = false;
  const el = document.createElement('div');
  el.className = 'pmc'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', `${captain}'s contract`);
  root.appendChild(el);
  function draw() {
    // (the example: an ordinary load of the Miner's eight tonnes, the game's maker's own sum: 4 × 2,000 + 2 × 3,000 + 2 × 5,000;
    // a rescue's: so much for each person brought home, four of them; an exploring run's: so much for each place
    // explored, two of them)
    const share = shareOf([...mine]), sample = M.perPerson ? 4 * M.perPerson : M.perPlace ? 2 * M.perPlace : 24000;
    // (who does each job left to the crew: the ship has a crew of three, the captain and one of his crew with the crew
    // member: src/missions.js aboardOf)
    const by = Object.fromEntries(crewFor(M, [...mine], 'You', captain).map((c) => [c.role, c.name]));
    for (const r of roles) r.crew = by[r.id] || r.crew;
    el.innerHTML = `<section class="pmc-card">
      <header class="pmc-top"><b>${esc(M.name)}</b><small>${esc(captain)}'s contract</small></header>
      <p class="pmc-what">${esc(M.about)}</p>
      <div class="pmc-roles">${roles.map((r) => {
    const on = mine.has(r.id), inner = `<span><b>${esc(r.name)}</b><small>${esc(r.does)}</small></span><em>${r.share}%</em><i>${on ? 'You' : esc(r.crew)}</i>`;
    return r.open && pick ? `<button type="button" class="pmc-role${on ? ' is-mine' : ''}" data-role="${r.id}" aria-pressed="${on}">${inner}</button>`
      : `<div class="pmc-role ${on ? 'is-mine' : 'is-crew'}" data-role="${r.id}">${inner}</div>`;
  }).join('')}</div>
      <p class="pmc-note">${roles.some((r) => !r.open) ? `${esc(roles.filter((r) => !r.open).map((r) => r.crew).join(' and '))} of ${esc(captain)}'s own crew ${roles.filter((r) => !r.open).length === 1 ? 'does the other job' : 'do the other jobs'} this trip.` : ''}${pick ? ' Tap a job to take it or leave it to the crew.' : ''}</p>
      <div class="pmc-pay"><b>Your share: ${share}% of what the ${M.perPerson ? 'rescue pays' : M.perPlace ? 'run pays' : 'haul sells for'}</b>
        <p>${esc(M.paid)}</p>
        <p>${M.perPerson ? `The rescue pays ${say(M.perPerson)} credits for each person brought home. Four people come to ${say(sample)} credits and pay you ${say(payOf(sample, share))} credits.` : M.perPlace ? `The run pays ${say(M.perPlace)} credits for each place explored. Two places come to ${say(sample)} credits and pay you ${say(payOf(sample, share))} credits.` : `A haul that sells for ${say(sample)} credits pays you ${say(payOf(sample, share))} credits.`}</p></div>
      <div class="pmc-btns"><button type="button" class="pmc-sign">Sign<kbd>E</kbd></button><button type="button" class="pmc-later">Not now<kbd>Esc</kbd></button></div>
    </section>`;
    el.querySelector('.pmc-sign').addEventListener('click', sign);
    el.querySelector('.pmc-later').addEventListener('click', later);
    for (const b of el.querySelectorAll('button.pmc-role')) b.addEventListener('click', () => { const id = b.dataset.role; if (mine.has(id)) { if (mine.size > 1) mine.delete(id); } else mine.add(id); draw(); });
  }
  function close() { if (closed) return; closed = true; removeEventListener('keydown', onKey, true); el.classList.remove('is-on'); setTimeout(() => el.remove(), 220); }
  function sign() { if (closed) return; const ids = M.roles.filter((id) => mine.has(id)); close(); onSign(ids); }
  function later() { if (closed) return; close(); onLater(); }
  function onKey(e) {
    if (closed) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); later(); } else if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); sign(); }
  }
  addEventListener('keydown', onKey, true);
  draw();
  requestAnimationFrame(() => el.classList.add('is-on'));
  return { el, close, sign, later, state: () => ({ mine: [...mine], share: shareOf([...mine]), roles: roles.map((r) => ({ id: r.id, share: r.share, open: r.open, who: mine.has(r.id) ? 'You' : r.crew })) }) };
}
