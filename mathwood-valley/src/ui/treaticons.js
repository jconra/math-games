// The horses' treats, drawn small (src/treats.js): an apple and a carrot for the treat counter by the gold (src/ui/hud.js),
// the apple button on the tools strip (src/ui/tools.js) and the general store's rows (src/shop.js); and the hearts for
// the stable's "Your horses" list.
export const TREAT_ICON = {
  apple: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.6c-1.6-1.2-4.6-1.5-6.3.4C3.4 10.6 4.3 15.6 6.6 18.4c1.4 1.7 3 2.6 4.2 2.1.5-.2.8-.3 1.2-.3s.7.1 1.2.3c1.2.5 2.8-.4 4.2-2.1 2.3-2.8 3.2-7.8.9-10.4-1.7-1.9-4.7-1.6-6.3-.4z" fill="#c8202a" stroke="#5a0d10" stroke-width="1"/><path d="M12 7.8c0-1.8.5-3.4 1.6-4.6" fill="none" stroke="#5b3a1c" stroke-width="1.5" stroke-linecap="round"/><path d="M13.4 4.6c1.6-1.4 3.8-1.4 4.8-.6-1.2 1.6-3.2 2-4.8.6z" fill="#5f9a32" stroke="#2f4f16" stroke-width="0.6"/><ellipse cx="8.6" cy="11" rx="1.4" ry="2.2" fill="#fff" opacity="0.35" transform="rotate(20 8.6 11)"/></svg>',
  carrot: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.6 8.4c-1.9-1.9-4.6-1.1-6 .9L3.4 19.4c-.6 1 .2 1.8 1.2 1.2l10.1-6.2c2-1.4 2.8-4.1.9-6z" fill="#ec7a1c" stroke="#7a3606" stroke-width="1"/><path d="M8.6 12.6l1.6 1M7 15.4l1.4.9M10.8 10.6l1.2 1" stroke="#a54a0a" stroke-width="0.9" stroke-linecap="round"/><path d="M15.4 8.6c.4-2.4 1.6-4.4 3.4-5.6M16.2 9.4c1.6-1 3.8-1.4 5.4-1M15.8 9c.8-1.8 2.6-3 4.4-3.4" fill="none" stroke="#4f8a26" stroke-width="1.6" stroke-linecap="round"/></svg>',
};
// a heart, full, half or empty (the bond: src/treats.js BOND)
const HEART = 'M12 20.6C6 16.4 2.6 13 2.6 9.2 2.6 6.4 4.8 4.2 7.4 4.2c1.9 0 3.6 1 4.6 2.6 1-1.6 2.7-2.6 4.6-2.6 2.6 0 4.8 2.2 4.8 5 0 3.8-3.4 7.2-9.4 11.4z';
let halfN = 0;
export function heartSVG(fill) {   // fill: 1 full, 0.5 half, 0 empty
  if (fill >= 1) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART}" fill="#e0324a" stroke="#6e0f1c" stroke-width="1.2"/></svg>`;
  if (fill <= 0) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART}" fill="none" stroke="#c9a77a" stroke-width="1.4" opacity="0.7"/></svg>`;
  const id = 'bmhh' + (++halfN);
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><clipPath id="${id}"><rect x="0" y="0" width="12" height="24"/></clipPath></defs><path d="${HEART}" fill="none" stroke="#c9a77a" stroke-width="1.4" opacity="0.7"/><path d="${HEART}" fill="#e0324a" clip-path="url(#${id})"/></svg>`;
}
