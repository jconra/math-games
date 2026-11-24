// THE PAINT CARD: the owner's card (src/contract.js `own`) turned to the paint of the ship's hull. A small card along
// the bottom of the screen, with the ship itself shown above it from outside (src/shippaint.js: the view), a row of
// swatches, one for each paint (kit/ships/paints.js; the first is the ship's own), and Done. A swatch tapped repaints
// the ship at once and is kept with the crew member at once: there is nothing to confirm and nothing to pay. Done (or
// E, or Esc) goes back to the owner's card.
//
//   paint (the owner's card's `own.paint`, from src/shippaint.js card(ship)):
//     { list() -> [{ id, name, c ('#rrggbb': the hull in that paint), on }], pick(id) -> true if it is now on,
//       view(on) (the ship shown from outside while the card is up) }
//   paintHtml(shipName, list) -> the card's inside;   paintCss() puts the card's look in the page, once
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `
.pmc.is-paint { place-items: end center; background: none; }
.pmc.is-paint .pmc-card { width: min(600px, 100%); padding-bottom: 14px; }
.pmc-paints { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 6px; margin: 0 0 12px; }
.pmc-paint { height: 54px; padding: 0; background: var(--c) !important; clip-path: var(--oct); --cut: 9px; box-shadow: inset 0 0 0 2px rgba(6, 8, 12, 0.55); }
.pmc-paint:hover { box-shadow: inset 0 0 0 2px rgba(232, 243, 252, 0.9); }
.pmc-paint.is-on { box-shadow: inset 0 0 0 3px #ffd560, inset 0 0 0 5px rgba(6, 8, 12, 0.85); }
.pmc-topaint i { display: inline-block; width: 14px; height: 14px; margin-right: 8px; vertical-align: -2px; background: var(--c); box-shadow: inset 0 0 0 1.5px rgba(232, 243, 252, 0.7); }
body:has(.pmc.is-paint) .pnj-prompt { visibility: hidden; }
@media (max-width: 640px) { .pmc-paints { grid-template-columns: repeat(5, minmax(0, 1fr)); } .pmc-paint { height: 48px; } }
`;
export function paintCss(doc = document) {
  if (doc.getElementById('pmc-paint-css')) return;
  const st = doc.createElement('style'); st.id = 'pmc-paint-css'; st.textContent = CSS; doc.head.appendChild(st);
}
// the Paint button on the owner's card: a small square of the paint that is on, and the word
export const paintButton = (list) => { const on = list.find((p) => p.on) || list[0]; return `<button type="button" class="pmc-later pmc-topaint"><i style="--c:${esc(on.c)}"></i>Paint</button>`; };
// the paint card's inside: the ship's name, the paint that is on by name, the swatches, Done
export function paintHtml(shipName, list) {
  const on = list.find((p) => p.on) || list[0];
  return `<section class="pmc-card pmc-paintcard">
      <header class="pmc-top"><b>Your ${esc(shipName)}</b><small>Paint: <span class="pmc-paintname">${esc(on.name)}</span></small></header>
      <div class="pmc-paints" role="radiogroup" aria-label="The paint of its hull">${list.map((p) => `<button type="button" class="pmc-paint${p.on ? ' is-on' : ''}" role="radio" aria-checked="${p.on ? 'true' : 'false'}" data-paint="${esc(p.id)}" title="${esc(p.name)}" aria-label="${esc(p.name)}" style="--c:${esc(p.c)}"></button>`).join('')}</div>
      <div class="pmc-btns"><button type="button" class="pmc-sign pmc-paintdone">Done<kbd>E</kbd></button></div>
    </section>`;
}
