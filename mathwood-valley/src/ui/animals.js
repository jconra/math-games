// "YOUR ANIMALS" (the menu): every animal the rider owns with its hearts (src/treats.js BOND), and the total: the love that
// is tracked, shown. A reward only: hearts never go down. The game's maker: "I haven't seen any indication of the total love."
//
//   animalRows(rider) -> { total, most, groups: [{ title, rows: [{ id, name, what, hearts, half, full }] }] }   (pure)
//   openAnimals(root, rider) -> the panel (src/shop.js makePanel: its X or Esc closes it)
import { BOND, bondOf, treatsOf } from '../treats.js';
import { ownedHorses, horseLook } from '../mounts.js';
import { animalsOf, ANIMALS, YOUNG } from '../math/goods.js';
import { heartSVG } from './treaticons.js';
import { makePanel } from '../shop.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const row = (rider, id, name, what) => { const b = bondOf(rider, id); return { id, name, what, hearts: b.hearts, half: b.half, full: b.full }; };
export function animalRows(rider) {
  treatsOf(rider);
  const o = rider.owned || {};
  const horses = ownedHorses(rider).map((h) => { const id = h.id || h, L = horseLook(rider, id); return row(rider, id, (L && L.name) || 'Your horse', L && L.kind === 'donkey' ? 'Donkey' : 'Horse'); });
  const seen = new Set(), dogs = [];
  for (const d of [...(Array.isArray(o.dogs) ? o.dogs : []), o.dog]) { if (!d || !d.kind || seen.has(d.kind)) continue; seen.add(d.kind); dogs.push(row(rider, 'dog:' + d.kind, d.name || 'Your dog', 'Dog')); }
  const farm = animalsOf(rider).map((a) => row(rider, `${a.kind}:${a.name}`, a.name, a.young ? YOUNG[a.kind][0].toUpperCase() + YOUNG[a.kind].slice(1) : ANIMALS[a.kind].name));
  const groups = [{ title: 'Horses', rows: horses, tip: 'An apple or a carrot by the head' }, { title: 'Dogs', rows: dogs, tip: 'Jerky from the store' }, { title: 'Farm animals', rows: farm, tip: 'Pigs love apples, sheep love carrots' }].filter((g) => g.rows.length);
  const all = groups.flatMap((g) => g.rows);
  return { total: all.reduce((a, r) => a + r.hearts, 0), most: all.length * BOND.hearts, groups };
}
const heartsHtml = (r) => Array.from({ length: BOND.hearts }, (_, i) => heartSVG(i < r.hearts ? 1 : i === r.hearts && r.half ? 0.5 : 0)).join('');
export function openAnimals(root, rider) {
  const A = animalRows(rider);
  let h = '';
  if (!A.groups.length) h = '<p class="bms-tip">No animals of your own yet. The stable sells horses, and the general store sells dogs and farm animals.</p>';
  else h = `<p class="bma-total"><span class="bma-big">${heartSVG(1)}<b>${A.total}</b></span> of ${A.most} hearts</p>`;
  for (const g of A.groups) h += `<h3 class="bms-h">${esc(g.title)}</h3><p class="bms-tip">${esc(g.tip)}</p>` + g.rows.map((r) => `<div class="bms-row" data-animal="${esc(r.id)}"><div class="bms-what"><b>${esc(r.name)}</b><small>${esc(r.what)}${r.full ? ': loves you all the way' : ''}</small></div><div class="bms-act"><span class="bma-hearts" aria-label="${r.hearts} of ${BOND.hearts} hearts">${heartsHtml(r)}</span></div></div>`).join('');
  h += `<p class="bms-tip">Treats and pets fill the hearts, a little each day. Hearts never go down.</p>`;
  const body = document.createElement('div'); body.className = 'bma'; body.innerHTML = h;
  return makePanel({ title: 'Your animals', sub: 'All the love so far', body, root, wide: false });
}
