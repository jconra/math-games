// hud.js: what sits over the valley while riding: the purse (gold, bounty, title, badges, lock boxes in the saddlebags),
// the compass strip along the top (the cabin, the job and your horse on it), the round-up's rule card and the gentle
// "not me, partner" line under it, short notes at the bottom, the "E - Talk to the stable keeper" prompt by a door,
// Old Hob's captions, the touch buttons, and a small fps readout for ?perf.
//
//   const H = makeHud(root, { onMenu, onPrompt, onTouch(code) })
//     root: the page element to build in (no CSS transform on it: the times chart is placed over it, position fixed)
//     onMenu(): the Menu button (Esc does the same in main.js); onPrompt(): a click or tap on the door prompt
//     onTouch(code): a touch button ('KeyF' rope, 'KeyH' horse, 'KeyE' on/off)
//   H.show(on)                 shown while riding, hidden on the title screen
//   H.purse({ gold, bounty, title, next, badges, boxes, goods, treats })   the purse; gold going up pops a "+n" coin by
//                              it; goods: the homestead's goods in the saddlebags, as words ('30 eggs · 6 qt milk to sell');
//                              treats: { apple, carrot } the horses' treats in the saddlebags (src/treats.js), a small
//                              counter by the gold
//   H.toast(text, kind)        a short note at the bottom for a couple of seconds (kind: 'good' | 'gold' | 'warn')
//   H.prompt(text | null, at)  the door prompt ('E' then the words), or null to hide it; at: { x, y } on the page, the
//                              prompt floats just over that point (a spot inside a building: src/usespots.js)
//   H.rule({ main, sub, kind, buttons, speak }) | H.rule(null)   the rule card under the compass ("Rope the 6-herd");
//                              buttons: [{ label, onClick }] (a "Show me" for the number line); speak: a function that
//                              reads the card aloud again (a small speaker button in the card's corner; none without
//                              it); returns the card element
//   H.ruleEl                   the rule card element (the times chart keeps it in view)
//   H.hint({ say, line, skip, also }) | H.hint(null)   the line under the rule card after a wrong pick: skip is the
//                              trainer's skip-count list, where the wrong number is a string like '(27)'
//   H.hintEl                   that line's element (the times chart keeps clear of it)
//   H.jobEl                    the rule card and the line under it together: the times chart's "Peek" button goes
//                              under it (so it never covers the line) and the chart keeps it in view
//   H.helpEl                   a box at the bottom middle for the number line (the negatives topic); each helper in it
//                              gets an X, and Esc closes it. H.closeHelp(), H.helpOpen()
//   H.compass(yaw, marks)      marks: [{ id, icon: 'cabin'|'job'|'horse'|'dog', bearing, dist, label }] (radians,
//                              as three's rotation.y: facing (sin, cos))
//   H.caption(text, ms) | H.caption(null)   Old Hob's caption (hob.js says what)
//   H.touch(on)                the round touch buttons;  H.fireWord('Rope' | 'Shoot')  the big one's word
//   H.callHorse(on)            the "call your horse" button (bottom right, with its key: H), while the horse is far off
//                              or out of view; with the touch buttons up, their Horse button lights up instead
//   H.perf(text | null)        the ?perf readout
//   H.buckle(b, { delay })     a belt buckle just won (save.js countJob / recordLockbox's buckle): a short note with
//                              the buckle drawn in it, low in the middle, for about three seconds; nothing to click
//   H.shift({ label, n, of, done }) | H.shift(null)   the shift counter of the job in progress (src/shifts.js), in the
//                              purse under the gold: 'Sheep healed 4/7' and a pip for each round; done: the day's shift is
//                              over ('done for today', the pips all lit)
//   H.meter({ label, value, sub, low }) | H.meter(null)   a health bar right under the rule card (a hold-up's wagon:
//                              src/missions/wagonjob.js): a little wagon, the label, the bar (value 0..1; low: it goes
//                              orange) and a short line after it ('Wave 2 of 3'); H.meter.hit() flashes it a moment
//   H.meterEl                  its element
//   H.dispose()
//
// It is all page elements (no 3D), with pointer-events off except on the buttons, so clicks fall through to the valley.
// z-index stays under 35: the times chart's "Peek" button is 35 and the chart 40; the title is 20, the lock box 60.
// The one exception is the belt-buckle note (70): it is on the page itself, above the lock-box panel, so a buckle
// won there (or in "Just lock boxes", with the HUD put away) shows too. It never takes a click.

import { BUCKLE_NAMES, jobWords } from '../save.js';
import { TREAT_ICON } from './treaticons.js';

const CSS_HREF = new URL('./hud.css', import.meta.url).href;
const FONTS_HREF = new URL('./fonts/fonts.css', import.meta.url).href;

function ensureCss() {
  for (const [href, key] of [[FONTS_HREF, 'bmFonts'], [CSS_HREF, 'bmHud']]) {
    if (document.querySelector(`link[data-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`)) continue;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset[key] = '1'; document.head.appendChild(l);
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// little drawings
export const ICON = {
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#e2ad4c"/><circle cx="12" cy="12" r="7.4" fill="none" stroke="#a8742a" stroke-width="1.6"/><path d="M12 7.2v9.6M9.6 9.4c0-1.2 1.1-1.9 2.4-1.9s2.4.7 2.4 1.7c0 2.5-4.8 1.6-4.8 4.2 0 1.1 1.1 1.8 2.4 1.8s2.4-.7 2.4-1.9" fill="none" stroke="#6b4614" stroke-width="1.5" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 16 16" aria-hidden="true"><polygon points="8,0.8 9.9,5 14.5,5.2 10.9,8.3 12.3,13 8,10.4 3.7,13 5.1,8.3 1.5,5.2 6.1,5" fill="currentColor"/></svg>',
  box: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="12" rx="1.6" fill="#7a5530" stroke="#3b2a1e" stroke-width="1.2"/><rect x="3" y="5" width="18" height="5" rx="1.4" fill="#8f6639" stroke="#3b2a1e" stroke-width="1.2"/><rect x="10" y="9" width="4" height="5" rx="0.8" fill="#e2ad4c"/></svg>',
  cabin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5L12 4l9 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M5.5 10.5V20h13v-9.5" fill="currentColor" opacity="0.9"/><rect x="10.2" y="14" width="3.6" height="6" fill="#1d140c"/></svg>',
  job: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round"><ellipse cx="13.5" cy="8" rx="7.5" ry="4.4" stroke-width="2.2"/><path d="M7.6 11c-1.6 2.2-1.4 4.6.6 5.9 2.1 1.3 2.2 3.4.4 5.6" stroke-width="2.2"/></svg>',
  horse: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21c0-4 1-7.5 3.5-10L8 7.8 9.6 6l2.6 1.6C14 4.6 17.5 3.5 19 5c.6 3.4-.6 5.6-2.4 6.6l2.6 3.6-1.6 1.6-3.6-2.4c-.6 2-1 4-1 6.6z" fill="currentColor"/><circle cx="15.6" cy="7.2" r="0.9" fill="#1d140c"/></svg>',
  dog: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l1.5-5 3 3.2h5L17.5 4 19 9c1 2 1 4.5 0 6.5-1.4 3-4 4.5-7 4.5s-5.6-1.5-7-4.5c-1-2-1-4.5 0-6.5z" fill="currentColor"/><circle cx="9.4" cy="11.5" r="1" fill="#1d140c"/><circle cx="14.6" cy="11.5" r="1" fill="#1d140c"/><ellipse cx="12" cy="15" rx="1.5" ry="1" fill="#1d140c"/></svg>',
  // a small speaker with two sound waves (the card's "read it again" button)
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.2h3.6L12.4 5v14l-4.8-4.2H4z" fill="currentColor"/><path d="M15.4 9.2a4 4 0 0 1 0 5.6M17.9 6.6a7.6 7.6 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};
// Old Hob's face: the same old-timer as in the lock-box panel (a wide hat, a white beard)
export const HOB_FACE = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#2c1d12"/>
<path d="M7 21c3-1 6-1.6 9-1.8L18 9c1-3 11-3 12 0l2 10.2c3 .2 6 .8 9 1.8-5 2.2-29 2.2-34 0z" fill="#c8963e"/>
<path d="M17 18.5c4 .9 10 .9 14 0" stroke="#7a5524" stroke-width="2" fill="none"/>
<path d="M15.5 22.5c.5 5 2 8 3 9 1.5 6 9.5 6 11 0 1-1 2.5-4 3-9-5.5 1.3-11.5 1.3-17 0z" fill="#e9c999"/>
<path d="M14.5 27c1 11 6 15 9.5 15s8.5-4 9.5-15c-2 3-4 4-9.5 4s-7.5-1-9.5-4z" fill="#ece3d2"/>
<circle cx="20.3" cy="25.4" r="1.2" fill="#2c1d12"/><circle cx="27.7" cy="25.4" r="1.2" fill="#2c1d12"/></svg>`;

// ── BELT BUCKLES ─────────────────────────────────────────────────────────────────────────────────────────────────
// A western trophy buckle for a job (save.js JOBS): an oval plate with a rope edge, a sunk middle with a little
// engraving, the job's sign raised in the middle (a longhorn for cattle, a sprung padlock for lock boxes, a bell for
// sheep, a flour sack for store orders, a pig, a star for bandits, a wagon wheel for deliveries, a strongbox for the
// loot, a windmill for the tower, a truss bridge for the loads carried across, a leaping fish for the fish landed). The
// metal says the tier; the better buckles carry more: rivets on tin and copper, turquoise stones on silver, turquoise
// and tiny stars on gold. tier = null draws the buckle still to win, as a faint outline. The title screen's rider card
// and the toast below both use it.
const METAL = {
  tin: { hi: '#c4cacd', mid: '#7c858a', lo: '#3f464b', ink: '#262b2f' },   // dull pewter, so it never passes for silver
  copper: { hi: '#f7c4a0', mid: '#c26d3c', lo: '#6a3214', ink: '#3f1d0a' },
  silver: { hi: '#ffffff', mid: '#cdd5da', lo: '#7a848c', ink: '#3f474e' },
  gold: { hi: '#fff1b4', mid: '#dfab44', lo: '#865914', ink: '#4f3208' },
};
// each job's sign, drawn about the buckle's middle (32, 22), then scaled up there by SIGN_BIG (1.3 unless listed:
// the longhorn's horns and the padlock's loop would touch the rope edge)
const SIGN_BIG = { cattle: 1.12, boxes: 1.18 };
const SIGN = {
  cattle: (f, ink) => `<path d="M14.6 13.4C17 17.6 22 17.8 26.2 16.8H37.8C42 17.8 47 17.6 49.4 13.4 47.6 19.6 42 20.6 37.2 19.8H26.8C22 20.6 16.4 19.6 14.6 13.4Z" fill="${f}" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M26.4 18.4L22.6 20.6 26.9 21.4ZM37.6 18.4L41.4 20.6 37.1 21.4Z" fill="${f}" stroke="${ink}" stroke-width="0.7" stroke-linejoin="round"/>
    <path d="M26.3 17.4H37.7L35.6 27.6Q32 32.2 28.4 27.6Z" fill="${f}" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round"/>
    <circle cx="29.7" cy="21.6" r="0.85" fill="${ink}"/><circle cx="34.3" cy="21.6" r="0.85" fill="${ink}"/>
    <circle cx="30.7" cy="28.1" r="0.7" fill="${ink}"/><circle cx="33.3" cy="28.1" r="0.7" fill="${ink}"/>`,
  boxes: (f, ink) => `<path d="M27.4 19.2V14.6A4.6 4.6 0 0 1 36.6 14.6V16" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M27.4 19.2V14.6A4.6 4.6 0 0 1 36.6 14.6V16" fill="none" stroke="${f}" stroke-width="2" stroke-linecap="round"/>
    <rect x="24.2" y="19" width="15.6" height="11.6" rx="2" fill="${f}" stroke="${ink}" stroke-width="0.8"/>
    <circle cx="32" cy="23.6" r="1.6" fill="${ink}"/><path d="M31.3 24.2H32.7L33.1 27.6H30.9Z" fill="${ink}"/>`,
  sheep: (f, ink) => `<path d="M32 12.8C31 12.8 30.4 13.5 30.4 14.4V15C26.8 16 25.7 19.6 25.5 24.2L24 27.4H40L38.5 24.2C38.3 19.6 37.2 16 33.6 15V14.4C33.6 13.5 33 12.8 32 12.8Z" fill="${f}" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M26.8 23.4H37.2" stroke="${ink}" stroke-width="0.7" opacity="0.6"/><circle cx="32" cy="29.4" r="1.8" fill="${f}" stroke="${ink}" stroke-width="0.8"/>`,
  // a tied flour sack, for the orders filled at the general store
  orders: (f, ink) => `<path d="M27.6 17.6C25 20.6 24.4 26.6 26.4 29.4Q32 31 37.6 29.4C39.6 26.6 39 20.6 36.4 17.6Z" fill="${f}" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M27.8 17.6L26.2 13.4Q29 15 32 14.2Q35 15 37.8 13.4L36.2 17.6Z" fill="${f}" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M27.4 17.6H36.6" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/><path d="M28.6 22.6Q32 21.4 35.4 22.6M28.4 25.8Q32 24.8 35.6 25.8" fill="none" stroke="${ink}" stroke-width="0.7" opacity="0.6"/>`,
  pigs: (f, ink) => `<path d="M25.4 17.4L24.6 12.6 29 15.4ZM38.6 17.4L39.4 12.6 35 15.4Z" fill="${f}" stroke="${ink}" stroke-width="0.7" stroke-linejoin="round"/>
    <circle cx="32" cy="22.6" r="7.6" fill="${f}" stroke="${ink}" stroke-width="0.8"/><circle cx="29.3" cy="20.4" r="0.8" fill="${ink}"/><circle cx="34.7" cy="20.4" r="0.8" fill="${ink}"/>
    <ellipse cx="32" cy="25.4" rx="3.4" ry="2.3" fill="${f}" stroke="${ink}" stroke-width="0.8"/><circle cx="30.8" cy="25.4" r="0.6" fill="${ink}"/><circle cx="33.2" cy="25.4" r="0.6" fill="${ink}"/>`,
  // a bottle and a tin can, for the targets hit at the range
  targets: (f, ink) => `<path d="M26.6 11.6H29.8V14.6C29.8 15.6 32.4 17 32.4 19.6V31H24V19.6C24 17 26.6 15.6 26.6 14.6Z" fill="${f}" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M26.2 11.6H30.2" stroke="${ink}" stroke-width="1.4" stroke-linecap="round"/><path d="M25.6 22.4H30.8V27.2H25.6Z" fill="none" stroke="${ink}" stroke-width="0.7" opacity="0.65"/>
    <rect x="33.6" y="20.4" width="7" height="10.6" rx="1" fill="${f}" stroke="${ink}" stroke-width="0.8"/><path d="M33.6 22.4H40.6M33.6 29H40.6" stroke="${ink}" stroke-width="0.7" opacity="0.65"/>`,
  bandits: (f, ink) => {
    const p = [];
    for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 6, d = i % 2 ? 4.3 : 8.6; p.push(`${(32 + d * Math.cos(a)).toFixed(2)},${(22 + d * Math.sin(a)).toFixed(2)}`); }
    const tips = [];
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 3; tips.push(`<circle cx="${(32 + 8.9 * Math.cos(a)).toFixed(2)}" cy="${(22 + 8.9 * Math.sin(a)).toFixed(2)}" r="1.2" fill="${f}" stroke="${ink}" stroke-width="0.6"/>`); }
    return `<polygon points="${p.join(' ')}" fill="${f}" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round"/>${tips.join('')}<circle cx="32" cy="22" r="2.2" fill="none" stroke="${ink}" stroke-width="0.8"/>`;
  },
  deliveries: (f, ink) => {
    const s = [];
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; s.push(`M${(32 + 2 * Math.cos(a)).toFixed(2)} ${(22 + 2 * Math.sin(a)).toFixed(2)}L${(32 + 7.4 * Math.cos(a)).toFixed(2)} ${(22 + 7.4 * Math.sin(a)).toFixed(2)}`); }
    return `<path d="${s.join('')}" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/><path d="${s.join('')}" stroke="${f}" stroke-width="1.1" stroke-linecap="round"/>
      <circle cx="32" cy="22" r="8.2" fill="none" stroke="${ink}" stroke-width="3.2"/><circle cx="32" cy="22" r="8.2" fill="none" stroke="${f}" stroke-width="2"/>
      <circle cx="32" cy="22" r="2.4" fill="${f}" stroke="${ink}" stroke-width="0.8"/>`;
  },
  // a windmill, for the feet of tower that stood: a tower narrowing as it rises, its four sails turned a little
  tower: (f, ink) => {
    const sails = [];
    for (let i = 0; i < 4; i++) {
      const a = 0.4 + (i * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a), px = (d, w) => `${(32 + d * c - w * s).toFixed(2)},${(17 + d * s + w * c).toFixed(2)}`;
      sails.push(`<polygon points="${px(1.6, 0)} ${px(9, 0)} ${px(9, 2.8)} ${px(2.6, 2.4)}" fill="${f}" stroke="${ink}" stroke-width="0.7" stroke-linejoin="round"/>`);
    }
    return `<path d="M27.6 31.6L30.4 17.4H33.6L36.4 31.6Z" fill="${f}" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round"/>
      <path d="M28.8 25.4H35.2M29.4 22H34.6" stroke="${ink}" stroke-width="0.7" opacity="0.7"/>${sails.join('')}<circle cx="32" cy="17" r="1.5" fill="${f}" stroke="${ink}" stroke-width="0.8"/>`;
  },
  // a little truss bridge on its two stone abutments, for the loads carried across the engineer's bridge
  loads: (f, ink) => {
    const truss = 'M24.6 25.2L28 19H36L39.4 25.2M28 19V25.2M32 19V25.2M36 19V25.2M28 19L32 25.2M36 19L32 25.2';
    return `<rect x="21.8" y="26.4" width="4" height="5.2" rx="0.5" fill="${f}" stroke="${ink}" stroke-width="0.8"/><rect x="38.2" y="26.4" width="4" height="5.2" rx="0.5" fill="${f}" stroke="${ink}" stroke-width="0.8"/>
      <path d="${truss}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="${truss}" fill="none" stroke="${f}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="23.2" y="24.8" width="17.6" height="2" rx="0.4" fill="${f}" stroke="${ink}" stroke-width="0.8"/>`;
  },
  // a fish leaping, for the fish landed off the dock
  fish: (f, ink) => `<path d="M24.6 22L20.4 17.4 21.6 22 20.4 26.6Z" fill="${f}" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M24 22Q30 15.2 37.4 19.4Q40.6 21.2 41.4 22Q40.6 22.8 37.4 24.6Q30 28.8 24 22Z" fill="${f}" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M29.6 18.4L31.6 15.4 33.8 18M30.4 25.8L31.8 27.8 33 25.8" fill="${f}" stroke="${ink}" stroke-width="0.7" stroke-linejoin="round"/>
    <path d="M34.8 19.6Q33.6 22 34.8 24.4" fill="none" stroke="${ink}" stroke-width="0.7" opacity="0.7"/><circle cx="37.8" cy="21.3" r="0.85" fill="${ink}"/>`,
  // a strongbox, its lid domed, two iron bands and a lock, for the gang's loot handed back
  loot: (f, ink) => `<path d="M24.2 18.6Q24.2 14 32 14Q39.8 14 39.8 18.6Z" fill="${f}" stroke="${ink}" stroke-width="0.8" stroke-linejoin="round"/>
    <rect x="24.2" y="18.6" width="15.6" height="10.8" rx="1" fill="${f}" stroke="${ink}" stroke-width="0.8"/>
    <path d="M28.2 14.6V29.4M35.8 14.6V29.4" stroke="${ink}" stroke-width="0.8" opacity="0.7"/>
    <rect x="30.5" y="19.8" width="3" height="3.8" rx="0.6" fill="${ink}"/>`,
};
const signAt = (sign, job, f, ink) => { const k = SIGN_BIG[job] || 1.3; return `<g transform="translate(32 22) scale(${k}) translate(-32 -22)">${sign(f, ink)}</g>`; };
let buckleN = 0;   // each drawing gets its own shading names, so many buckles can share a page
export function buckleSVG(tier, job = 'cattle') {
  const sign = SIGN[job] || SIGN.cattle;
  const m = METAL[tier];
  if (!m) {
    const f = 'rgba(244, 232, 207, 0.1)', ink = 'rgba(244, 232, 207, 0.42)';
    return `<svg viewBox="0 0 64 44" aria-hidden="true" class="bk-none">
      <ellipse cx="32" cy="22" rx="30.4" ry="20.4" fill="rgba(255, 238, 205, 0.04)" stroke="rgba(244, 232, 207, 0.34)" stroke-width="1.2" stroke-dasharray="3 2.4"/>
      <ellipse cx="32" cy="22" rx="24.4" ry="15.2" fill="none" stroke="rgba(244, 232, 207, 0.16)" stroke-width="1"/>
      ${signAt(sign, job, f, ink)}</svg>`;
  }
  const id = 'bk' + (++buckleN);
  const stone = (x) => tier === 'silver' || tier === 'gold'
    ? `<circle cx="${x}" cy="22" r="2.6" fill="#2f9c90" stroke="${m.ink}" stroke-width="0.8"/><circle cx="${x - 0.8}" cy="21.1" r="0.8" fill="#b8f0e6"/>`
    : `<circle cx="${x}" cy="22" r="1.7" fill="url(#${id}a)" stroke="${m.ink}" stroke-width="0.7"/>`;
  const scroll = (k) => `<path d="M${32 + k * 15.4} 18.2C${32 + k * 17.6} 15.6 ${32 + k * 20.8} 16 ${32 + k * 20.8} 18.4M${32 + k * 15.4} 25.8C${32 + k * 17.6} 28.4 ${32 + k * 20.8} 28 ${32 + k * 20.8} 25.6" fill="none" stroke="${m.ink}" stroke-width="0.75" stroke-linecap="round" opacity="0.55"/>`;
  const stars = tier === 'gold' ? [[32, 4.6], [32, 39.4]].map(([x, y]) => `<path d="M${x} ${y - 2.2}L${x + 0.7} ${y - 0.7}L${x + 2.2} ${y}L${x + 0.7} ${y + 0.7}L${x} ${y + 2.2}L${x - 0.7} ${y + 0.7}L${x - 2.2} ${y}L${x - 0.7} ${y - 0.7}Z" fill="#fffbe6" stroke="${m.lo}" stroke-width="0.4"/>`).join('') : '';
  return `<svg viewBox="0 0 64 44" aria-hidden="true" class="bk-${tier}">
    <defs>
      <linearGradient id="${id}a" x1="0.2" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="${m.hi}"/><stop offset="0.5" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient>
      <linearGradient id="${id}b" x1="0.3" y1="1" x2="0.5" y2="0"><stop offset="0" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient>
    </defs>
    <ellipse cx="32" cy="23" rx="31" ry="20.6" fill="rgba(0, 0, 0, 0.35)"/>
    <ellipse cx="32" cy="22" rx="30.6" ry="20.4" fill="url(#${id}a)" stroke="${m.lo}" stroke-width="0.9"/>
    <ellipse cx="32" cy="22" rx="26.8" ry="17.3" fill="none" stroke="${m.ink}" stroke-width="3.2" opacity="0.5"/>
    <ellipse cx="32" cy="22" rx="26.8" ry="17.3" fill="none" stroke="${m.hi}" stroke-width="2.2" stroke-dasharray="2.2 1.4"/>
    <ellipse cx="32" cy="22" rx="24.3" ry="15.1" fill="url(#${id}b)" stroke="${m.lo}" stroke-width="0.8"/>
    ${scroll(-1)}${scroll(1)}${stone(11.4)}${stone(52.6)}
    ${signAt(sign, job, `url(#${id}a)`, m.ink)}
    <path d="M7.4 15.2C11.6 7.6 21.6 3.4 32 3.4" fill="none" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" opacity="0.5"/>
    ${stars}</svg>`;
}

// how much of the compass strip one radian takes (the strip shows about 100 degrees either side)
const COMPASS_SPAN = 1.75;
// a basket of eggs: the homestead's goods in the saddlebags
// the meter's little wagon: a covered wagon side on, a strongbox at its tail
const METER_WAGON = '<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M5 13.5L4 4.6c3-2 5.6-2 7.6-.2 2.3-1.9 4.5-1.9 6.8 0 2-1.8 4.6-1.8 7.6.2l-1 8.9z" fill="#f2e8d2" stroke="#3b2a1e" stroke-width="1.1" stroke-linejoin="round"/>'
  + '<rect x="3" y="13.2" width="24.5" height="3.6" rx="0.8" fill="#8b5e34" stroke="#3b2a1e" stroke-width="1"/><rect x="25" y="9.4" width="5" height="4" rx="0.6" fill="#5a3a22" stroke="#2b1d12" stroke-width="0.9"/><path d="M26.4 9.4v4M28.6 9.4v4" stroke="#c9a24f" stroke-width="0.8"/>'
  + '<g fill="none" stroke="#3b2a1e" stroke-width="1.6"><circle cx="8" cy="19.2" r="3.4"/><circle cx="22.5" cy="19.2" r="3.4"/></g><circle cx="8" cy="19.2" r="0.9" fill="#3b2a1e"/><circle cx="22.5" cy="19.2" r="0.9" fill="#3b2a1e"/></svg>';
const GOODS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="9" cy="10" rx="3" ry="3.8" fill="#f2e8d2" stroke="#3b2a1e" stroke-width="1"/><ellipse cx="14.5" cy="9.5" rx="3" ry="3.8" fill="#efe2c4" stroke="#3b2a1e" stroke-width="1"/><path d="M3 12h18l-2.4 8H5.4z" fill="#8b6a3e" stroke="#3b2a1e" stroke-width="1.2" stroke-linejoin="round"/><path d="M6 15h12M7 18h10" stroke="#5b4428" stroke-width="1"/></svg>';

export function makeHud(root, { onMenu = () => {}, onPrompt = () => {}, onTouch = () => {} } = {}) {
  ensureCss();
  root = root || document.body;
  const el = document.createElement('div');
  el.className = 'bmh is-hidden';
  el.innerHTML = `
    <div class="bmh-purse" aria-live="polite">
      <div class="bmh-gold">${ICON.coin}<b class="bmh-gold-n">0</b><span>gold</span><span class="bmh-treats" hidden title="Treats for the horses in your saddlebags"></span></div>
      <div class="bmh-rank"><span class="bmh-title">Greenhorn</span><span class="bmh-bounty"></span></div>
      <div class="bmh-next"></div>
      <div class="bmh-badges"></div>
      <div class="bmh-bag" hidden>${ICON.box}<span></span></div>
      <div class="bmh-bag bmh-goods" hidden>${GOODS_ICON}<span></span></div>
      <div class="bmh-shift" hidden><span class="bmh-shift-text"></span><span class="bmh-shift-pips" aria-hidden="true"></span></div>
    </div>
    <div class="bmh-top">
      <div class="bmh-compass" aria-hidden="true"><div class="bmh-ticks"></div><div class="bmh-marks"></div><i class="bmh-notch"></i></div>
      <div class="bmh-job">
        <div class="bmh-rule" hidden><button class="bmh-rule-say" type="button" hidden aria-label="Read the card again" title="Read it again">${ICON.speaker}</button><div class="bmh-rule-main"></div><div class="bmh-rule-sub"></div><div class="bmh-rule-btns"></div></div>
        <div class="bmh-meter" hidden><span class="bmh-meter-pic" aria-hidden="true">${METER_WAGON}</span><b class="bmh-meter-label"></b><span class="bmh-meter-bar" role="meter" aria-valuemin="0" aria-valuemax="100"><i></i></span><span class="bmh-meter-sub"></span></div>
        <div class="bmh-hint" hidden role="status"></div>
      </div>
    </div>
    <div class="bmh-corner">
      <button class="bmh-menu" type="button" title="Menu (Esc)">${ICON.menu}<span>Menu</span></button>
      <div class="bmh-perf" hidden></div>
    </div>
    <div class="bmh-help"></div>
    <div class="bmh-bottom">
      <button class="bmh-prompt" type="button" hidden></button>
      <div class="bmh-toast" role="status"></div>
    </div>
    <div class="bmh-hob" hidden><span class="bmh-hob-face">${HOB_FACE}</span><div class="bmh-hob-text"><b>Old Hob</b><span></span></div></div>
    <button class="bmh-call" type="button" hidden title="Whistle for your horse (H)"><kbd>H</kbd>${ICON.horse}<span>Call your horse</span></button>
    <div class="bmh-touch" hidden>
      <button type="button" data-code="KeyE">On / off</button>
      <button type="button" data-code="KeyH">Horse</button>
      <button type="button" data-code="KeyF" class="is-big">Rope</button>
    </div>`;
  root.appendChild(el);
  const $ = (q) => el.querySelector(q);
  const goldN = $('.bmh-gold-n'), titleEl = $('.bmh-title'), bountyEl = $('.bmh-bounty'), nextEl = $('.bmh-next');
  const badgesEl = $('.bmh-badges'), bagEl = $('.bmh-bag'), ruleEl = $('.bmh-rule'), hintEl = $('.bmh-hint');
  const sayEl = $('.bmh-rule-say');
  const promptEl = $('.bmh-prompt'), toastEl = $('.bmh-toast'), hobEl = $('.bmh-hob'), perfEl = $('.bmh-perf');
  const ticksEl = $('.bmh-ticks'), marksEl = $('.bmh-marks'), compassEl = $('.bmh-compass');
  // (buttons let go of keyboard focus at once, so Space or Enter afterwards doesn't press them again)
  const tap = (b, fn) => b.addEventListener('click', (e) => { e.currentTarget.blur(); fn(e); });
  tap($('.bmh-menu'), () => onMenu());
  tap(promptEl, () => onPrompt());
  for (const b of el.querySelectorAll('.bmh-touch button')) tap(b, () => onTouch(b.dataset.code));
  const callEl = $('.bmh-call'), touchHorse = $('.bmh-touch [data-code="KeyH"]');
  tap(callEl, () => onTouch('KeyH'));
  let callOn = false;
  function callHorse(on) {
    callOn = !!on;
    const fingers = !touchHorse.parentElement.hidden, hide = !callOn || fingers;
    if (callEl.hidden !== hide) callEl.hidden = hide;
    touchHorse.classList.toggle('is-call', callOn && fingers);
  }

  // ── THE PURSE ─────────────────────────────────────────────────────────────────────────────────────────────────
  let lastGold = null;
  const treatsEl = $('.bmh-treats');
  let treatsKey = '';
  function purse({ gold = 0, bounty = 0, title = '', next = null, badges = [], boxes = 0, goods = '', treats = null } = {}) {
    // the horses' treats in the saddlebags, by the gold (src/treats.js): an apple and a carrot with their counts
    const tk = treats ? `${treats.apple || 0}|${treats.carrot || 0}` : '';
    if (tk !== treatsKey) {
      treatsKey = tk;
      const a = treats ? treats.apple || 0 : 0, c = treats ? treats.carrot || 0 : 0;
      treatsEl.hidden = !(a || c);
      treatsEl.innerHTML = (a ? `<i>${TREAT_ICON.apple}<b>${a}</b></i>` : '') + (c ? `<i>${TREAT_ICON.carrot}<b>${c}</b></i>` : '');
      treatsEl.setAttribute('aria-label', `${a} apples and ${c} carrots for the horses`);
    }
    goldN.textContent = fmt(gold);
    if (lastGold !== null && gold > lastGold) pop(`+${fmt(gold - lastGold)}`);
    lastGold = gold;
    titleEl.textContent = title;
    bountyEl.textContent = ` · fame ${fmt(bounty)}`;
    nextEl.textContent = next ? `${fmt(next.toGo)} more to ${next.title}` : '';
    badgesEl.innerHTML = badges.map((b) => `<span class="bmh-badge">${ICON.star}${esc(b)}</span>`).join('');
    bagEl.hidden = !boxes;
    bagEl.querySelector('span').textContent = boxes === 1 ? '1 lock box in your saddlebags' : `${boxes} lock boxes in your saddlebags`;
    const ge = $('.bmh-goods'); ge.hidden = !goods; ge.querySelector('span').textContent = goods || '';
  }
  // ── THE SHIFT COUNTER (src/shifts.js): only redrawn when it changes ─────────────────────────────────────────────
  const shiftEl = $('.bmh-shift');
  let shiftKey = '';
  function shift(o) {
    const key = o ? `${o.label}|${o.n}|${o.of}|${o.done ? 1 : 0}` : '';
    if (key === shiftKey) return;
    shiftKey = key;
    shiftEl.hidden = !o;
    if (!o) return;
    const n = Math.min(o.n, o.of);
    shiftEl.classList.toggle('is-done', !!o.done);
    shiftEl.querySelector('.bmh-shift-text').textContent = `${o.label} ${n}/${o.of}${o.done ? ' · done for today' : ''}`;
    shiftEl.querySelector('.bmh-shift-pips').innerHTML = o.of <= 12 ? Array.from({ length: o.of }, (x, k) => `<i class="${k < n ? 'is-on' : ''}"></i>`).join('') : '';
  }
  // ── THE METER under the rule card (a held-up wagon's health) ────────────────────────────────────────────────────
  const meterEl = $('.bmh-meter'), meterBar = meterEl.querySelector('.bmh-meter-bar'), meterFill = meterBar.querySelector('i');
  let meterKey = '', meterHitT = 0;
  function meter(o) {
    const pct = o ? Math.max(0, Math.min(100, Math.round((o.value ?? 0) * 100))) : 0;
    const key = o ? `${o.label}|${pct}|${o.sub || ''}|${o.low ? 1 : 0}` : '';
    if (key === meterKey) return;
    meterKey = key;
    meterEl.hidden = !o;
    if (!o) return;
    meterEl.querySelector('.bmh-meter-label').textContent = o.label || '';
    meterEl.querySelector('.bmh-meter-sub').textContent = o.sub || '';
    meterEl.classList.toggle('is-low', !!o.low);
    meterEl.classList.toggle('is-empty', pct <= 0);
    meterFill.style.width = pct + '%';
    meterBar.setAttribute('aria-valuenow', String(pct));
    meterBar.setAttribute('aria-label', `${o.label || 'Health'} ${pct} out of 100`);
  }
  meter.hit = () => {
    meterEl.classList.remove('is-hit'); void meterEl.offsetWidth; meterEl.classList.add('is-hit');
    clearTimeout(meterHitT); meterHitT = setTimeout(() => meterEl.classList.remove('is-hit'), 260);
  };
  function pop(text) {
    const p = document.createElement('div');
    p.className = 'bmh-pop'; p.innerHTML = `${ICON.coin}<b>${esc(text)}</b>`;
    $('.bmh-purse').appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }

  // ── NOTES, THE PROMPT, HOB ───────────────────────────────────────────────────────────────────────────────────
  let toastT = 0;
  function toast(text, kind = '') {
    toastEl.textContent = text;
    toastEl.className = 'bmh-toast is-on' + (kind ? ' is-' + kind : '');
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.classList.remove('is-on'); placeBottom(); }, Math.max(2200, 900 + text.length * 45));
    placeBottom();
  }
  // (at: a point on the page, { x, y }: the prompt floats just over it, its tail pointing down at it: the spot inside a
  // building that E uses, src/usespots.js; left out, it sits at the bottom as by a door)
  // (kept on the screen, an 8 px gutter: its size measured once each time its words change, never every frame)
  let promptText = null, promptOver = false, promptW = 0, promptH = 0;
  function prompt(text, at = null) {
    const over = !!(text && at);
    if (text !== promptText || over !== promptOver) {
      promptText = text; promptOver = over;
      promptEl.classList.toggle('is-over', over);
      if (!over) promptEl.style.left = promptEl.style.top = '';
      promptEl.hidden = !text;
      if (text) promptEl.innerHTML = `${touchEl.hidden ? '<kbd>E</kbd>' : ''}<span>${esc(text)}</span>`;   // (no key to show on a phone: the prompt is tapped)
      promptW = over ? promptEl.offsetWidth : 0; promptH = over ? promptEl.offsetHeight : 0;
      placeBottom();
    }
    if (over) {
      const x = Math.max(8 + promptW / 2, Math.min(innerWidth - 8 - promptW / 2, at.x)), y = Math.max(promptH + 18, Math.min(innerHeight - 8, at.y));
      promptEl.style.left = `${Math.round(x)}px`; promptEl.style.top = `${Math.round(y)}px`;
    }
  }
  let hobT = 0;
  function caption(text, ms) {
    clearTimeout(hobT);
    if (!text) { hobEl.classList.remove('is-on'); return; }
    hobEl.hidden = false;
    hobEl.querySelector('.bmh-hob-text span').textContent = text;
    void hobEl.offsetWidth;
    hobEl.classList.add('is-on');
    placeBottom();
    hobT = setTimeout(() => hobEl.classList.remove('is-on'), ms || Math.max(4500, 1800 + text.length * 55));
  }

  // On a phone the bottom of the screen is crowded: the touch buttons, the door prompt, the number line box and Old Hob's
  // line all want it. They stack instead of covering each other: the prompt sits just above the buttons (the CSS), the
  // number line box above the prompt when one shows, and Hob's line above whatever is showing. When there is no room
  // left for Hob above the number line (a phone on its side), his line waits, tucked away, until the box goes.
  const narrow = matchMedia('(max-width: 760px), (max-height: 480px)');
  const helpEl = $('.bmh-help'), touchEl = $('.bmh-touch');
  const shown = (e) => !e.hidden && e.offsetParent !== null;
  function placeBottom() {
    if (!narrow.matches) { helpEl.style.bottom = ''; hobEl.style.bottom = ''; hobEl.classList.remove('is-tucked'); return; }
    const vh = innerHeight;
    // the door prompt and a note that is showing (they stack in one column) both push the number line box up
    const low = [promptEl, toastEl].filter((e) => shown(e) && (e !== toastEl || e.classList.contains('is-on')) && !(e === promptEl && promptOver));   // (a prompt floating over a spot isn't in the stack)
    helpEl.style.bottom = '';
    if (low.length) helpEl.style.bottom = `${vh - Math.min(...low.map((e) => e.getBoundingClientRect().top)) + 8}px`;
    let top = vh;
    const tools = el.querySelector('.bmtl-bar');   // (the tools strip above the touch buttons: src/ui/tools.js)
    for (const e of [...helpEl.children, ...low, ...touchEl.children, ...(tools ? tools.children : [])]) {
      if (!shown(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) top = Math.min(top, r.top);
    }
    const bottom = vh - top + 8;
    hobEl.style.bottom = top < vh ? `${bottom}px` : '';
    hobEl.classList.toggle('is-tucked', vh - bottom - hobEl.offsetHeight < vh * 0.14);
  }
  new ResizeObserver(() => placeBottom()).observe(helpEl);
  // Every helper in the box (the number line, the ten-frames: what a job shows when the rider asks for help) gets an X in
  // its corner, and Esc puts the box away (before the game's own Esc opens the menu). The rule (src/ui/askhelp.js): a
  // helper only ever comes when asked, and it always goes when asked.
  const closeHelp = (box) => { for (const c of box ? [box] : [...helpEl.children]) c.remove(); };
  new MutationObserver(() => {
    for (const c of helpEl.children) {
      if (c.querySelector(':scope > .bmh-help-x')) continue;
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'bmh-help-x'; x.title = 'Close (Esc)'; x.setAttribute('aria-label', 'Close the help');
      x.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
      for (const ev of ['pointerdown', 'pointerup', 'mousedown', 'touchstart']) x.addEventListener(ev, (e) => e.stopPropagation());
      x.addEventListener('click', (e) => { e.stopPropagation(); closeHelp(c); });
      c.classList.add('bmh-help-box'); c.appendChild(x);
    }
  }).observe(helpEl, { childList: true });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !helpEl.children.length || el.classList.contains('is-hidden')) return;
    e.preventDefault(); e.stopImmediatePropagation(); closeHelp();
  }, true);
  // (a note sliding in is measured where it is mid-slide, lower than where it stops: Hob's line is placed again once it
  // has settled, or grown to two lines, so a pay note arriving with his line never covers it)
  { const ro = new ResizeObserver(() => placeBottom()); ro.observe(toastEl); ro.observe(promptEl); }
  toastEl.addEventListener('transitionend', () => placeBottom());
  narrow.addEventListener('change', () => placeBottom());

  // ── THE RULE CARD AND THE LINE UNDER IT ───────────────────────────────────────────────────────────────────────
  let speakFn = null;
  tap(sayEl, () => { if (speakFn) speakFn(); });
  function rule(o) {
    if (!o) { ruleEl.hidden = true; speakFn = null; return ruleEl; }
    ruleEl.hidden = false;
    ruleEl.className = 'bmh-rule' + (o.kind ? ' is-' + o.kind : '') + (o.speak ? ' has-say' : '');
    speakFn = o.speak || null; sayEl.hidden = !speakFn;
    $('.bmh-rule-main').textContent = o.main || '';
    $('.bmh-rule-sub').textContent = o.sub || '';
    const btns = $('.bmh-rule-btns');
    btns.innerHTML = '';
    for (const b of o.buttons || []) {
      const x = document.createElement('button'); x.type = 'button'; x.textContent = b.label;
      tap(x, () => b.onClick()); btns.appendChild(x);
    }
    btns.hidden = !(o.buttons && o.buttons.length);
    return ruleEl;
  }
  function hint(o) {
    if (!o) { hintEl.hidden = true; hintEl.innerHTML = ''; return; }
    const skip = (o.skip || []).map((v) => (typeof v === 'string' ? `<b class="miss">${esc(v)}</b>` : `<span>${esc(v)}</span>`)).join('<i>·</i>');
    hintEl.innerHTML = `${o.say ? `<div class="bmh-hint-say">${esc(o.say)}</div>` : ''}`
      + `${o.line ? `<div class="bmh-hint-line">${esc(o.line)}</div>` : ''}`
      + `${skip ? `<div class="bmh-skip">${o.anchor ? `<em>${esc(o.anchor)}</em>` : ''}${skip}</div>` : ''}`
      + `${o.also ? `<div class="bmh-hint-also">${esc(o.also)}</div>` : ''}`;
    hintEl.hidden = false;
  }

  // ── THE COMPASS ──────────────────────────────────────────────────────────────────────────────────────────────
  // north is -z (the way the valley's map is drawn); E +x, S +z, W -x. A bearing as three's rotation.y.
  const POINTS = [['N', Math.PI], ['E', Math.PI / 2], ['S', 0], ['W', -Math.PI / 2], ['NE', Math.PI * 0.75], ['SE', Math.PI * 0.25], ['SW', -Math.PI * 0.25], ['NW', -Math.PI * 0.75]];
  const tickEls = [];
  for (let i = 0; i < 24; i++) {
    const t = document.createElement('i'); t.className = 'bmh-tick'; ticksEl.appendChild(t);
    tickEls.push({ el: t, b: Math.PI - i * Math.PI / 12 });
  }
  for (const [name, b] of POINTS) {
    const t = document.createElement('b'); t.className = 'bmh-point' + (name.length > 1 ? ' is-minor' : ''); t.textContent = name; ticksEl.appendChild(t);
    tickEls.push({ el: t, b });
  }
  const markEls = new Map();
  function compass(yaw, marks = []) {
    const w = compassEl.clientWidth || 400, half = w / 2;
    const px = (rel) => half - rel / COMPASS_SPAN * half;    // a bearing to the right of the view is a negative rel
    for (const t of tickEls) {
      const rel = wrap(t.b - yaw), x = px(rel);
      const on = Math.abs(rel) < COMPASS_SPAN * 0.98;
      t.el.style.display = on ? '' : 'none';
      if (on) t.el.style.transform = `translateX(${x.toFixed(1)}px)`;
    }
    const seen = new Set(), placed = [];
    for (const m of marks) {
      seen.add(m.id);
      let e = markEls.get(m.id);
      if (!e) {
        e = document.createElement('div'); e.className = `bmh-mark is-${m.icon}`; e.dataset.mark = m.id;
        e.innerHTML = `${ICON[m.icon] || ICON.job}<small></small>`;
        marksEl.appendChild(e); markEls.set(m.id, e);
      }
      const rel = wrap(m.bearing - yaw), edge = Math.abs(rel) > COMPASS_SPAN * 0.92;
      const x = px(Math.max(-COMPASS_SPAN * 0.92, Math.min(COMPASS_SPAN * 0.92, rel)));
      e.style.transform = `translateX(${x.toFixed(1)}px)`;
      e.classList.toggle('is-edge', edge);
      e.classList.toggle('is-near', m.dist != null && m.dist < 12);
      e.title = m.label || '';
      const small = e.querySelector('small');
      const txt = m.dist == null ? '' : m.dist < 12 ? '' : `${Math.round(m.dist)} m`;
      if (small.textContent !== txt) small.textContent = txt;
      placed.push({ x, small, d: m.dist == null ? Infinity : m.dist });
    }
    // two marks close together on the strip: only the nearer one's distance shows (the numbers would run together)
    placed.sort((a, b) => a.d - b.d);
    for (let i = 0; i < placed.length; i++) {
      const crowd = placed.slice(0, i).some((o) => o.small.style.visibility !== 'hidden' && Math.abs(o.x - placed[i].x) < 44);
      placed[i].small.style.visibility = crowd ? 'hidden' : '';
    }
    for (const [id, e] of markEls) if (!seen.has(id)) { e.remove(); markEls.delete(id); }
  }

  // ── A NEW BELT BUCKLE ─────────────────────────────────────────────────────────────────────────────────────────
  // b = save.js buckleOf's result for the buckle just won. Two at once take turns.
  const buckleEl = document.createElement('div');
  buckleEl.className = 'bmh-buckle';
  buckleEl.setAttribute('role', 'status');
  document.body.appendChild(buckleEl);
  const buckleQ = [], buckleTs = new Set();
  let buckleBusy = false;
  const later = (fn, ms) => { const t = setTimeout(() => { buckleTs.delete(t); fn(); }, ms); buckleTs.add(t); };
  function buckle(b, { delay = 0 } = {}) {
    if (!b || !b.tier) return;
    later(() => { buckleQ.push(b); nextBuckle(); }, delay);
  }
  const panelOpen = () => !!document.querySelector('.lbx');
  // a note only shows over the ride or over a lock box: one still waiting when the ride ends (back to the title) is let go
  const quiet = () => el.classList.contains('is-hidden') && !panelOpen();
  let buckleEnd = null, buckleWatch = null;
  function endBuckle() {
    clearInterval(buckleWatch); buckleWatch = null;
    if (buckleEnd) { clearTimeout(buckleEnd.t); buckleTs.delete(buckleEnd.t); buckleEnd = null; }
    buckleEl.classList.add('is-off');
    later(() => { buckleEl.classList.remove('is-on', 'is-off'); buckleBusy = false; nextBuckle(); }, 450);
  }
  function nextBuckle() {
    if (buckleBusy || !buckleQ.length) return;
    if (quiet()) { buckleQ.length = 0; return; }
    const b = buckleQ.shift();
    buckleBusy = true;
    const next = b.next ? `next: ${b.next.tier} at ${fmt(b.next.at)}` : 'the top buckle!';
    buckleEl.innerHTML = `<span class="bmh-buckle-art">${buckleSVG(b.tier, b.job)}</span>
      <span class="bmh-buckle-text"><b>${esc(BUCKLE_NAMES[b.tier] || '')} buckle!</b><span>${esc(jobWords(b.job, b.count))} · ${esc(next)}</span></span>`;
    buckleEl.classList.remove('is-on', 'is-off');
    // over the lock-box panel it goes up top, in the empty sky of the panel's stage, clear of the move buttons
    const high = panelOpen();
    buckleEl.classList.toggle('is-high', high);
    void buckleEl.offsetWidth;   // (so the drop-in plays again for a second buckle)
    buckleEl.classList.add('is-on');
    const t = setTimeout(() => { buckleTs.delete(t); buckleEnd = null; endBuckle(); }, 3600); buckleTs.add(t); buckleEnd = { t };
    // the panel closing under a note up top (where the ride's banner shows) ends it early, rather than leave it over the
    // banner; so does the ride ending under a note in play
    buckleWatch = setInterval(() => { if ((high && !panelOpen()) || quiet()) endBuckle(); }, 150);
  }

  const H = {
    el, ruleEl, hintEl, helpEl, meterEl, jobEl: $('.bmh-job'),
    closeHelp: () => closeHelp(), helpOpen: () => helpEl.children.length > 0,
    show(on) { el.classList.toggle('is-hidden', !on); if (!on) { prompt(null); caption(null); if (quiet()) { buckleQ.length = 0; if (buckleBusy && buckleWatch) endBuckle(); } } },
    purse, toast, prompt, caption, rule, hint, compass, buckle, shift, meter,
    // the big touch button's word: 'Rope', or 'Shoot' while the six-shooter is the tool (src/gun.js)
    fireWord(w) { const b = touchEl.querySelector('[data-code="KeyF"]'); if (b && b.textContent !== w) b.textContent = w; },
    touch(on) { if (touchEl.hidden === !on) return; touchEl.hidden = !on; if (promptText) { const t = promptText; promptText = null; prompt(t); } placeBottom(); callHorse(callOn); },
    callHorse,
    perf(text) { perfEl.hidden = !text; if (text) perfEl.textContent = text; },
    dispose() { clearTimeout(toastT); clearTimeout(hobT); clearInterval(buckleWatch); for (const t of buckleTs) clearTimeout(t); el.remove(); buckleEl.remove(); },
  };
  return H;
}
