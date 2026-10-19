// title.js: the title screen. It floats over the live valley while the world loads behind it.
//
//   const T = showTitle(root, { riders, build, onRide(rider), onLockboxes(rider), onChange(rider), completion })
//   T.setProgress(0.4, 'Planting trees')   // the world's loading progress, 0..1 (RIDE OUT waits for 1)
//   T.hide(); T.show();
//
// What is on it: the game's name; a card for each rider (name, title, bounty, face, when they last rode, the belt
// buckles won; the chosen rider's card also shows each job's buckle with how far to the next one) and "New rider" (a
// name, a look, and an optional age); the chosen rider's panel: their math (no level to pick: the game finds each
// kind of math's level by itself as they play, src/math/skill.js; the panel says so and shows the levels found so
// far, with the stats page a tap away, src/ui/stats.js), their goals and completion (src/completion.js, when the game
// has it: a grown-up pins a goal, "Set a goal"), the read-aloud switch while their math is young, and a folded "Jobs"
// list where a grown-up can turn some jobs off (every job is on by default); RIDE OUT; "Just lock boxes"; a small
// build number; and a folded Grown-ups corner (each rider's math, age and progress; delete a rider).
// No math topics or missions to tick and no lasso-or-shooting choice: every rider gets every job, the bottle range
// included, at their own level.
//
// Every change is saved straight away (save.js), so settings stick after a reload. RIDE OUT can be pressed while
// the valley is still loading: it then reads "Saddling up" and rides out the moment loading reaches 1. If
// setProgress is never called, the world is taken as ready.
//
// `completion` (optional): the src/completion.js module, for a page that has it already; otherwise it is loaded here,
// and the goals and completion stay out of sight until it is (or if the game has none).
//
// Keyboard: Tab moves between controls, arrow keys move within a group (riders, ages, jobs, looks), Space or Enter
// picks, Escape closes the Grown-ups corner or the new-rider form. RIDE OUT has focus at the start,
// so a returning rider can just press Enter.

import {
  loadRiders, saveRider, newRider, deleteRider, titleOf, nextTitle, badgesOf, accuracyOf, storageWorks, jobOn, readAloudLevel,
  readMode, nextReadMode, readModeWords, bucklesOf, buckleProgress, jobWords, BUCKLE_NAMES, MISSIONS, LOOKS, SKINS, HAIRS, MAX_RIDERS,
} from '../save.js';
import { stats as strandStats, levelOf } from '../math/skill.js';
import { openStats, statRows } from './stats.js';
import { buckleSVG } from './hud.js';
import { hatSVG, hatOf, hatColour } from '../hats.js';

// ---- small drawings --------------------------------------------------------------------------------------------

function starPoints(cx, cy, R, r, n) {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n, d = i % 2 ? r : R;
    p.push((cx + d * Math.cos(a)).toFixed(2) + ',' + (cy + d * Math.sin(a)).toFixed(2));
  }
  return p.join(' ');
}

const ICON = {
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.6l3.1 3.1L13 4.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // a six-point sheriff's star with little balls on the tips
  star: '<svg viewBox="0 0 16 16" aria-hidden="true"><polygon points="' + starPoints(8, 8.3, 7, 3.6, 6) + '" fill="currentColor"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  strongbox: '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M4 12.2V9.6Q4 6 7.6 6h12.8Q24 6 24 9.6v2.6z" fill="currentColor"/><rect x="4" y="13.4" width="20" height="10.6" rx="1.4" fill="currentColor"/><path d="M8.6 6v18M19.4 6v18" stroke="#1d140c" stroke-width="1.5" opacity=".55"/><rect x="11.4" y="10" width="5.2" height="7.4" rx="1.1" fill="#1d140c"/><circle cx="14" cy="12.9" r="1.15" fill="currentColor"/><path d="M14 13.6v2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M8.5 12V9a5.5 5.5 0 0 1 11 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="5" y="12" width="18" height="13" rx="2.5" fill="currentColor"/><circle cx="14" cy="17.4" r="2" fill="#1d140c"/><path d="M14 18.6v3" stroke="#1d140c" stroke-width="2" stroke-linecap="round"/></svg>',
  // a compass: the game finds the level by itself
  compass: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M15.6 8.4l-2.2 5-5 2.2 2.2-5z" fill="currentColor"/></svg>',
  // three rising bars: the stats page
  bars: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><rect x="2" y="9" width="3" height="5" rx=".8"/><rect x="6.5" y="5.5" width="3" height="8.5" rx=".8"/><rect x="11" y="2" width="3" height="12" rx=".8"/></svg>',
  // a pennant on a pole: a goal
  flag: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 14.5V1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4.4 2.2h8.4l-2.2 3.2 2.2 3.2H4.4z" fill="currentColor"/></svg>',
  // a list with ticks: what's left to do
  list: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 4l1.2 1.2L5.4 3M2 9l1.2 1.2L5.4 8"/><path d="M7.6 4.2h6.4M7.6 9.2h6.4M7.6 13.4h6.4"/><circle cx="3.6" cy="13.4" r="1" fill="currentColor" stroke="none"/></svg>',
  chevron: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5L10 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  people: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><circle cx="5.6" cy="5" r="2.4"/><path d="M1.2 13.6c.3-3 2.1-4.6 4.4-4.6s4.1 1.6 4.4 4.6z"/><circle cx="11.4" cy="5.8" r="2"/><path d="M10.3 9.4c.4-.1.8-.2 1.1-.2 2 0 3.4 1.4 3.6 4.1h-3.9c-.1-1.6-.4-2.9-.8-3.9z"/></svg>',
  info: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 7.2v4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="4.8" r="1.1" fill="currentColor"/></svg>',
  // a horse at a run, for the loading bar
  horse: '<svg viewBox="0 0 34 22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 8.6c2.6-1.5 9.4-1.6 13.2-.6l3.6-4.6 1.4.4 4.4 2.6-.8 1.8-3.4-.6-2.1 4.6c-3.6 2-10.6 2-14.2.6z" fill="currentColor"/><path d="M22.2 12.2l3.4 3-1.4 4.6M19.4 12.9l-1 4.2 2.4 2.4M11.4 13.2l-4 2.4-2.8 3M13.2 13.6l-.2 6"/><path d="M7.6 9.2C5 9 3 10.6 1.8 13.6"/></svg>',
  // a small speaker with sound waves (read-aloud on), or with a cross (off)
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9.2h3.6L12 5v14l-4.9-4.2H3.5z" fill="currentColor"/><path d="M15.2 9.2a4 4 0 0 1 0 5.6M17.8 6.6a7.6 7.6 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  speakerOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9.2h3.6L12 5v14l-4.9-4.2H3.5z" fill="currentColor"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  hat: '<svg viewBox="0 0 24 16" aria-hidden="true" fill="currentColor"><path d="M7 11.5C6.6 6 8 2 10.6 2Q12 3.2 13.4 2C16 2 17.4 6 17 11.5Z"/><path d="M1 10.4C2.6 13.6 7 14.6 12 14.6S21.4 13.6 23 10.4C21.6 11.8 18 12.4 12 12.4S2.4 11.8 1 10.4Z"/></svg>',
  ornStar: '<svg viewBox="0 0 18 18" aria-hidden="true"><polygon points="' + starPoints(9, 9.3, 8, 4.1, 6) + '" fill="currentColor"/><circle cx="9" cy="9.3" r="1.7" fill="#1d140c"/></svg>',
};

// Clothes colours for the drawn faces: [shirt, trousers, boots, hat], matching the people palettes in the game.
const PALETTE = {
  drifter: ['#8b5a3a', '#5a4632', '#3b2a1e', '#5b4630'],
  rancher: ['#d6c9a8', '#3e4a5c', '#4a3322', '#9a8263'],
  outlaw: ['#2e2b29', '#3f3c39', '#211a15', '#262321'],
  homestead: ['#6f7f8f', '#6b5843', '#3b2a1e', '#6e6a63'],
  prairie: ['#7a4038', '#8a7558', '#3b2a1e', '#cbbd9a'],
  townsman: ['#5c5a50', '#4a463f', '#2a2420', '#3a332c'],
  mustard: ['#a88a4a', '#5a4632', '#3b2a1e', '#5b4630'],
  sage: ['#6b6f52', '#4e4234', '#3b2a1e', '#7c6a4f'],
};

// Mixes two #rrggbb colours: t = 0 gives a, 1 gives b.
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}
// How light a #rrggbb colour looks, 0 (black) to 1 (white).
function light(c) { const p = parseInt(c.slice(1), 16); return (0.2126 * (p >> 16 & 255) + 0.7152 * (p >> 8 & 255) + 0.0722 * (p & 255)) / 255; }
function hex(c, dflt) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : dflt; }

// A head-and-shoulders drawing of a rider's look (a 64 x 64 picture, shown inside a round frame), so a rider can
// find their card by face and hat. Braces for the farmer outfits; a beard, a bedroll and pack straps for the
// explorers; longer hair for the women's outfits; their hat (look.hatStyle, the cowboy hat if none) unless look.hat is false.
export function faceSVG(look) {
  look = look || {};
  const pal = PALETTE[look.palette] || PALETTE.drifter;
  const skin = hex(look.skin, '#c68d62'), hair = hex(look.hair, '#3f2a1b');
  const shade = mix(skin, '#3a1c0c', 0.22), deep = mix(skin, '#2a1208', 0.45);
  const shirt = pal[0], pants = pal[1], hatC = pal[3];
  const hatOn = look.hat !== false;
  const outfit = String(look.outfit || 'farmer_m');
  const kind = outfit.startsWith('farmer') ? 'farmer' : outfit === 'adventurer_m' ? 'explorer'
    : outfit === 'adventurer_f' ? 'explorerF' : outfit.endsWith('_f') ? 'bob' : 'short';
  const explorer = kind === 'explorer' || kind === 'explorerF';
  const bg = mix(shirt, '#120c08', 0.72);
  const s = [];
  s.push(`<rect width="64" height="64" fill="${bg}"/>`);
  s.push(`<circle cx="32" cy="62" r="31" fill="${mix(bg, '#ffffff', 0.05)}"/>`);
  // hair that sits behind the head
  if (kind === 'bob') s.push(`<path d="M19.5 35C18.5 22 24 17.5 32 17.5S45.5 22 44.5 35L45 46C42 47.5 39.5 46 38.5 44H25.5C24.5 46 22 47.5 19 46Z" fill="${hair}"/>`);
  if (kind === 'explorerF') {
    if (hatOn) s.push(`<path d="M20.5 33C19.5 39 20 45 23.5 48.5L26 41Z" fill="${hair}"/>`);   // a braid over one shoulder
    else s.push(`<circle cx="32" cy="19.5" r="5.2" fill="${hair}"/>`);                            // a bun
  }
  // bedroll across the shoulders
  if (explorer) {
    s.push(`<rect x="10" y="42.5" width="44" height="8.5" rx="4.25" fill="#b39566"/>`);
    s.push(`<path d="M19 42.8v8M45 42.8v8" stroke="#5a4129" stroke-width="2"/>`);
  }
  // neck, shoulders, collar
  s.push(`<rect x="27.5" y="38" width="9" height="13" rx="3" fill="${shade}"/>`);
  s.push(`<path d="M5 64C6 55 14 50 26 49H38C50 50 58 55 59 64Z" fill="${shirt}"/>`);
  s.push(`<path d="M26.5 49L32 56.5 37.5 49Z" fill="${shade}"/>`);
  if (kind === 'farmer') s.push(`<path d="M23 50.5V64M41 50.5V64" stroke="${pants}" stroke-width="2.6"/>`);   // braces
  if (explorer) s.push(`<path d="M23 49.5l3.5 14.5M41 49.5l-3.5 14.5" stroke="#5a4129" stroke-width="2.2"/>`);   // pack straps
  // ears and head
  s.push(`<ellipse cx="21.6" cy="35" rx="2.3" ry="3.2" fill="${shade}"/><ellipse cx="42.4" cy="35" rx="2.3" ry="3.2" fill="${shade}"/>`);
  s.push(`<ellipse cx="32" cy="34" rx="10.3" ry="11.8" fill="${skin}"/>`);
  // hair in front
  if (kind === 'bob') s.push(`<path d="M21.6 32C22 24.5 26.5 21.2 32 21.2S42 24.5 42.4 32C39 27.5 35 26.6 30.5 27.4 27 28 24 29.6 21.6 32Z" fill="${hair}"/>`);
  else if (kind === 'explorerF') s.push(`<path d="M21.7 33C21.6 25 26.4 21.6 32 21.6S42.4 25 42.3 33C40.5 28.5 37 26.6 32 26.6S23.5 28.5 21.7 33Z" fill="${hair}"/>`);
  else if (!hatOn) s.push(`<path d="M21.4 32.5C20.6 24 25 20.2 32 20.2 39.5 20.2 43.6 24 42.6 32.5 41.4 28.5 39 26.4 35 26.6 31 24.8 26.2 26.4 21.4 32.5Z" fill="${hair}"/>`);
  if (kind === 'farmer' || kind === 'explorer' || kind === 'short') s.push(`<path d="M21.6 35V30.5L24 29.2V36.2ZM42.4 35V30.5L40 29.2V36.2Z" fill="${hair}"/>`);   // sideburns
  if (kind === 'explorer') s.push(`<path d="M22.4 36.5C23 45.5 27 47.2 32 47.2S41 45.5 41.6 36.5C40 40.5 37.5 41.6 35 40.6 33.2 40 30.8 40 29 40.6 26.5 41.6 24 40.5 22.4 36.5Z" fill="${hair}"/>`);   // beard
  // face
  const brow = light(hair) > 0.45 ? mix(hair, '#3a2410', 0.45) : hair;   // fair hair still needs brows that show
  s.push(`<path d="M26 31.8l3.6-.7M34.4 31.1l3.6.7" stroke="${brow}" stroke-width="1.5" stroke-linecap="round"/>`);
  s.push(`<ellipse cx="28.2" cy="35" rx="1.35" ry="1.6" fill="#1f150e"/><ellipse cx="35.8" cy="35" rx="1.35" ry="1.6" fill="#1f150e"/>`);
  s.push(`<path d="M32 36l-1.2 3h2" fill="none" stroke="${deep}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>`);
  if (kind !== 'explorer') s.push(`<path d="M29.4 41.6q2.6 1.5 5.2 0" fill="none" stroke="${deep}" stroke-width="1.3" stroke-linecap="round"/>`);
  // the hat (src/hats.js): the cowboy hat in the outfit's hat colour, or the one bought at the general store
  if (hatOn) s.push(hatSVG(hatOf(look), hatColour(look, hatC)));
  // drawn on a 64 x 64 square, shown a little closer in (the round frame trims the corners anyway)
  return `<svg viewBox="4 6 56 56" aria-hidden="true">${s.join('')}</svg>`;
}

// ---- helpers ---------------------------------------------------------------------------------------------------

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }
// How far to the next title, in words for the settings header.
function toNext(r) {
  const n = nextTitle(r);
  return n ? `${ICON.star} ${fmt(n.toGo)} more fame to ${n.title}` : `${ICON.star} Top title: ${titleOf(r)}`;
}
function dayStart(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
// When a rider last rode, in words.
function rode(last) {
  if (!last) return 'New rider';
  const days = Math.round((dayStart(Date.now()) - dayStart(last)) / 864e5);
  if (days <= 0) return 'Rode today';
  if (days === 1) return 'Rode yesterday';
  if (days < 7) return `Rode ${days} days ago`;
  return 'Rode ' + new Date(last).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
// The belt buckles on a rider's card. Every rider's card shows the buckles won so far, small, next to the badges;
// the chosen rider's card shows each job's buckle (a faint outline before the first) with how far to the next one,
// "37 / 50 to copper", and a bar in the next metal's colour.
function miniBuckles(r) {
  return bucklesOf(r).filter(b => b.tier).map(b =>
    `<span class="bmt-minib" title="${BUCKLE_NAMES[b.tier]} buckle · ${esc(b.name)}">${buckleSVG(b.tier, b.job)}</span>`).join('');
}
function buckleRow(r) {
  return `<span class="bmt-buckles">${bucklesOf(r).map(b => {
    const f = b.next ? Math.max(0, Math.min(1, (b.count - b.from) / Math.max(1, b.next.at - b.from))) : 1;
    return `<span class="bmt-bk" data-next="${b.next ? b.next.tier : 'done'}">
      <span class="bmt-bk-art">${buckleSVG(b.tier, b.job)}</span>
      <span class="bmt-bk-name">${esc(b.name)}</span>
      <span class="bmt-bk-prog">${esc(buckleProgress(b))}</span>
      <span class="bmt-bk-bar"><i style="width:${(f * 100).toFixed(1)}%"></i></span>
    </span>`;
  }).join('')}</span>`;
}
// The buckles in words, for a screen reader reading the card.
function bucklesSaid(r) {
  return bucklesOf(r).map(b => `${b.name}: ${b.tier ? BUCKLE_NAMES[b.tier] + ' buckle, ' : ''}${buckleProgress(b)}`).join('; ');
}

// The stylesheet sits next to this file; it is added once, and the screen stays invisible until it has loaded.
function ensureStyles(done) {
  const href = new URL('./title.css', import.meta.url).href;
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

// The ages the new-rider form offers (optional). An age only gives a modest head start (src/math/skill.js ageStart:
// nothing at 5 and under, a third-grade start from 15 on); the game finds the real level as the rider plays. 5 stands
// for "5 or under" and 16 for "16 or older" (it reads "16+").
const AGES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const ageWord = (a) => (a == null ? 'not set' : a >= 16 ? '16+' : String(a));

// The plain line that there is no level to pick (the new-rider form, and a rider who hasn't answered anything yet).
const AUTO_LINE = 'The game finds your level by itself as you play, for each kind of math. The first few questions may feel too easy or too hard for a minute.';

// A short list of a rider's math for a card: the kinds with the most answers lately first (among those practised in
// the week up to the rider's last answer), then the most recent. Only kinds with something to go on: answered, placed,
// or read from the rider's earlier rides (a job that only looked at a kind of math, before any answer, shows nothing
// yet: it is still the age's head start). -> [{ strand, short, pct, finding }]
const WEEK = 7 * 86400000;
function mathSummary(r, n = 4) {
  const raw = (r && r.skill && r.skill.strands) || {};
  const last = (x) => Number(raw[x.strand] && raw[x.strand].last) || 0;
  const kept = (x) => (raw[x.strand] && Array.isArray(raw[x.strand].h) ? raw[x.strand].h.length : 0);   // (up to the last 20)
  const rows = strandStats(r).filter((x) => x.answered > 0 || x.placed || (raw[x.strand] && raw[x.strand].old));
  const newest = Math.max(0, ...rows.map(last));
  const lately = (x) => (newest - last(x) <= WEEK ? kept(x) : 0);
  return rows.sort((a, b) => lately(b) - lately(a) || last(b) - last(a) || b.answered - a.answered).slice(0, n);
}

// Names a new rider can start with without typing one (a rider who can't read yet taps Saddle up): one not taken yet.
const NAMES = ['Dusty', 'Rosie', 'Kit', 'Hank', 'Belle', 'Sam', 'Lou', 'Jo', 'Cody', 'Daisy', 'Buck', 'Pearl'];
const freeName = (taken) => NAMES.find((n) => !taken.has(n.toLowerCase())) || `Rider ${taken.size + 1}`;

// ---- the screen ------------------------------------------------------------------------------------------------

export function showTitle(root, opts = {}) {
  root = root || document.body;
  const riders = Array.isArray(opts.riders) ? opts.riders : loadRiders();
  const build = opts.build == null ? '' : String(opts.build);
  const onRide = opts.onRide || (() => {});
  const onLockboxes = opts.onLockboxes || (() => {});
  const onChange = opts.onChange || (() => {});

  const S = {
    sel: riders[0] ? riders[0].id : null,
    view: riders.length ? 'settings' : 'new',
    draft: null,
    sheet: false,       // false | 'grown': the Grown-ups corner is open
    confirmDel: null,
    load: { known: false, f: 1, text: '' },
    waiting: false,     // RIDE OUT was pressed before the world finished loading
    riding: false,      // onRide has been called; the screen ignores clicks until show()
    visible: true,
    saveOk: storageWorks(),
    comp: opts.completion && typeof opts.completion.completion === 'function' ? opts.completion : null,   // src/completion.js, once loaded
    jobsOpen: false,    // the folded Jobs list is open
  };

  const el = document.createElement('div');
  el.className = 'bmt is-hidden';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Bandit Math title screen');
  el.innerHTML = `
    <div class="bmt-scrim"></div>
    <div class="bmt-left">
      <div class="bmt-brand"><h1 class="bmt-name">Bandit Math</h1><div class="bmt-orn"><i></i>${ICON.ornStar}<i></i></div></div>
      <h2 class="bmt-label">Who's riding?</h2>
      <div class="bmt-riders" role="radiogroup" aria-label="Riders" data-nav="radio"></div>
    </div>
    <div class="bmt-right">
      <div class="bmt-panel"></div>
      <div class="bmt-actions"></div>
    </div>
    <div class="bmt-foot"></div>
    <div class="bmt-sheet" role="dialog" aria-modal="true" hidden></div>`;
  root.appendChild(el);
  const $ = (q) => el.querySelector(q);
  const ridersEl = $('.bmt-riders'), panelEl = $('.bmt-panel'), actionsEl = $('.bmt-actions'), footEl = $('.bmt-foot'), sheetEl = $('.bmt-sheet');

  const current = () => riders.find(r => r.id === S.sel) || null;
  const canMakeMore = () => riders.length < MAX_RIDERS;

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

  // ---- riders list ----
  function renderRiders() {
    const cards = riders.map(r => {
      const on = r.id === S.sel && S.view !== 'new';
      const badges = badgesOf(r).map(b => `<span class="bmt-badge">${ICON.star}${esc(b)}</span>`).join('');
      return `<button class="bmt-rider" role="radio" aria-checked="${on}" tabindex="${on || (!S.sel && r === riders[0]) ? 0 : -1}"
          data-act="pick" data-id="${esc(r.id)}" data-k="rider:${esc(r.id)}" aria-label="${esc(r.name)}, ${titleOf(r)}, ${fmt(r.bounty)} fame. ${esc(bucklesSaid(r))}">
        <span class="bmt-face">${faceSVG(r.look)}</span>
        <span class="bmt-rname">${esc(r.name)}</span>
        <span class="bmt-when">${rode(r.last)}</span>
        <span class="bmt-rank"><b>${titleOf(r)}</b><span class="bmt-bounty">${ICON.star}${fmt(r.bounty)} fame</span>${badges}${on ? '' : miniBuckles(r)}</span>
        ${on ? buckleRow(r) : ''}
      </button>`;
    }).join('');
    const more = canMakeMore()
      ? `<button class="bmt-newrider" data-act="new" data-k="new" ${S.view === 'new' ? 'aria-current="true"' : ''}><span class="bmt-plus">${ICON.plus}</span><span>New rider</span></button>`
      : '';
    ridersEl.innerHTML = cards + more;
    ridersEl.classList.toggle('is-many', riders.length >= 4);   // smaller cards when the family is big
    // If no rider card can take focus (all on -1), let the first one.
    if (riders.length && !ridersEl.querySelector('.bmt-rider[tabindex="0"]')) ridersEl.querySelector('.bmt-rider').tabIndex = 0;
  }

  // ---- the chosen rider's panel / new rider form ----
  // The goals and completion, from src/completion.js (null until it has loaded, or if the game has none)
  function compOf(r) {
    if (!S.comp) return null;
    try {
      const c = S.comp.completion(r);
      const goals = typeof S.comp.goalsOf === 'function' ? S.comp.goalsOf(r) : [];
      return { pct: Math.round(Number(c && c.pct) || 0), goals: Array.isArray(goals) ? goals : [], groups: (c && c.groups) || [] };
    } catch (e) { console.warn('Bandit Math: completion could not be read', e); return null; }
  }
  const pct100 = (v) => Math.max(0, Math.min(100, Number(v) || 0));

  function renderSettings(r) {
    // MATH: no level to pick. Until the rider has answered something the panel says how it works; then the kinds of
    // math practised lately with their levels (the stats page has every one), named short as on their tiles
    const sum = mathSummary(r, 4);
    const finding = strandStats(r).filter((x) => x.finding && x.answered > 0);
    const math = sum.length
      ? `<div class="bmt-skills">${sum.map((x) => `<span class="bmt-sk${x.finding ? ' is-finding' : ''}"><b>${esc(x.short)}</b><em>${x.pct}%</em>
            <span class="bmt-skbar"><i style="width:${pct100(x.pct)}%"></i></span></span>`).join('')}</div>
        <p class="bmt-auto is-small">${ICON.compass}<span>${finding.length ? `Finding your level in ${esc(finding.map((x) => x.short).join(', ').replace(/, ([^,]*)$/, ' and $1'))}: a question may feel too easy or too hard for a minute.`
          : 'Your level moves with you: about 4 answers in 5 right.'}</span></p>`
      : `<p class="bmt-auto">${ICON.compass}<span><b>No level to pick.</b> ${AUTO_LINE}</span></p>`;
    // GOALS and completion (src/completion.js)
    const c = compOf(r);
    const goals = c ? `
      <section class="bmt-sec">
        <h3 class="bmt-label">Goals <small>${c.pct}% of the game done</small></h3>
        ${c.goals.length ? `<div class="bmt-goals">${c.goals.map((g) => `
          <div class="bmt-goal${g.done ? ' is-done' : ''}">${ICON.flag}<b>${esc(g.name)}</b>
            <span class="bmt-goal-n">${g.done ? 'Done!' : esc(g.line || `${fmt(g.have)} / ${fmt(g.need)}`)}</span>
            <span class="bmt-bk-bar"><i style="width:${pct100(g.pct)}%"></i></span></div>`).join('')}</div>`
          : '<p class="bmt-note">A grown-up can pin a goal here, like a silver buckle for cattle corralled.</p>'}
        <div class="bmt-chips">
          <button class="bmt-chip" data-act="goals" data-k="goals">${ICON.flag}Set a goal</button>
          <button class="bmt-chip" data-act="left" data-k="left">${ICON.list}What's left</button>
        </div>
      </section>` : '';
    // READ ALOUD: shown while questions are read by themselves, or once a grown-up has set it (the Grown-ups corner and
    // the pause menu always have it). Three settings, a tap stepping through them: by itself, always, off
    const rm = readMode(r);
    const readRow = readAloudLevel(r) || rm !== true ? `<div class="bmt-read">
        <button class="bmt-hat bmt-readsw" aria-pressed="${rm !== false}" data-act="read" data-k="read">${rm !== false ? ICON.speaker : ICON.speakerOff}Read aloud: ${esc(readModeWords(r))}</button>
        <small>${rm === 'on' ? 'Every question is read out loud, whatever the math.' : rm === false ? 'Nothing is read out loud. Tap to have it read by itself again.'
          : 'Questions are read out loud while the math is new (and for an age of 7 and under). Tap for always, or off.'}</small></div>` : '';
    // JOBS: every job on; a grown-up can turn some off (folded away)
    const jobs = MISSIONS.filter((m) => m.ready);
    const on = jobs.filter((m) => jobOn(r, m.id)).length;
    const missions = jobs.map((m) => {
      const isOn = jobOn(r, m.id);
      return `<button class="bmt-mission" role="checkbox" aria-checked="${isOn}" data-act="mission" data-id="${m.id}" data-k="mission:${m.id}">
        <span class="bmt-box">${ICON.check}</span><b>${esc(m.name)}</b><small>${esc(m.line)}</small>
      </button>`;
    }).join('');
    return `
      <div class="bmt-head"><h2><em>${esc(r.name)}</em></h2><p>${toNext(r)}</p></div>
      <section class="bmt-sec">
        <h3 class="bmt-label">Math <button class="bmt-link" data-act="stats" data-k="stats">${ICON.bars}Stats</button></h3>
        ${math}
      </section>
      ${goals}
      ${readRow}
      <details class="bmt-jobs"${S.jobsOpen ? ' open' : ''}>
        <summary data-k="jobs"><span class="bmt-label">Jobs</span><small>${on === jobs.length ? `All ${jobs.length} on` : `${on} of ${jobs.length} on`}</small>${ICON.chevron}</summary>
        <p class="bmt-note">Every job is on, so there is always something to do. A grown-up can turn some off. The round-up and the lock boxes are always on.</p>
        <div class="bmt-missions" role="group" aria-label="Jobs" data-nav="grid">${missions}</div>
      </details>`;
  }

  function freshDraft() {
    const look = LOOKS[riders.length % LOOKS.length];
    return { name: '', pick: freeName(new Set(riders.map((x) => String(x.name || '').toLowerCase()))), look: look.id,
      skin: SKINS[(2 + riders.length) % SKINS.length], hair: look.hair, hairPicked: false, hat: true, age: null };
  }
  function draftLook() {
    const d = S.draft, l = LOOKS.find(x => x.id === d.look) || LOOKS[0];
    return { outfit: l.outfit, palette: l.palette, skin: d.skin, hair: d.hair, hat: d.hat };
  }
  // the optional age as a row of round buttons ("Skip" first); kind = 'age' on the form
  function agePick(cur, kind, label) {
    return `<div class="bmt-agepick" role="radiogroup" aria-label="${label}" data-nav="radio">
      <button class="bmt-agech is-skip" role="radio" aria-checked="${cur == null}" tabindex="${cur == null ? 0 : -1}" data-act="${kind}" data-v="" data-k="${kind}:-">Skip</button>
      ${AGES.map((a) => `<button class="bmt-agech" role="radio" aria-checked="${cur === a}" tabindex="${cur === a ? 0 : -1}" aria-label="${a >= 16 ? '16 or older' : a <= 5 ? '5 or under' : a}"
          data-act="${kind}" data-v="${a}" data-k="${kind}:${a}">${ageWord(a)}</button>`).join('')}
    </div>`;
  }

  function renderForm() {
    const d = S.draft;
    const looks = LOOKS.map(l => `
      <button class="bmt-look" role="radio" aria-checked="${d.look === l.id}" tabindex="${d.look === l.id ? 0 : -1}"
          data-act="look" data-id="${l.id}" data-k="look:${l.id}">
        <span class="bmt-face">${faceSVG({ outfit: l.outfit, palette: l.palette, skin: d.skin, hair: d.hairPicked ? d.hair : l.hair, hat: d.hat })}</span>
        <span class="bmt-lname">${esc(l.name)}</span>
      </button>`).join('');
    const dots = (list, kind, cur, label) => `
      <div class="bmt-tone"><span>${label}</span><div role="radiogroup" aria-label="${label}" data-nav="radio" style="display:flex;gap:8px">
        ${list.map((c, i) => `<button class="bmt-dot" role="radio" aria-checked="${c === cur}" tabindex="${c === cur ? 0 : -1}" aria-label="${label} ${i + 1}"
          style="background:${c}" data-act="${kind}" data-v="${c}" data-k="${kind}:${i}"></button>`).join('')}
      </div></div>`;
    return `
      <div class="bmt-head"><h2>New rider</h2><p>Name, look, and you're off</p></div>
      <div class="bmt-form">
        <div class="bmt-who">
          <span class="bmt-face bmt-preview">${faceSVG(draftLook())}</span>
          <label class="bmt-field"><span>Name</span>
            <input class="bmt-input" data-k="name" maxlength="16" autocomplete="off" spellcheck="false" placeholder="${esc(d.pick || 'Rider')}, or type one" value="${esc(d.name)}"></label>
        </div>
        <section>
          <h3 class="bmt-label">Pick a look</h3>
          <div class="bmt-looks" role="radiogroup" aria-label="Look" data-nav="radio">${looks}</div>
        </section>
        <div class="bmt-tones">${dots(SKINS, 'skin', d.skin, 'Skin')}${dots(HAIRS, 'hair', d.hairPicked ? d.hair : null, 'Hair')}
          <div class="bmt-tone"><span>Hat</span><button class="bmt-hat" role="switch" aria-checked="${d.hat}" data-act="hat" data-k="hat">${ICON.hat}${d.hat ? 'On' : 'Off'}</button></div></div>
        <section>
          <h3 class="bmt-label">Age <small>if you like</small></h3>
          ${agePick(d.age, 'age', 'Age, if you like')}
          <p class="bmt-auto">${ICON.compass}<span><b>No level to pick.</b> ${AUTO_LINE} An age only gives a small head start.</span></p>
        </section>
        <div class="bmt-formbtns">
          ${riders.length ? '<button class="bmt-btn" data-act="cancel" data-k="cancel">Cancel</button>' : ''}
          <button class="bmt-btn go" data-act="create" data-k="create">Saddle up${d.name.trim() ? '' : ` <small>as ${esc(d.pick || 'Rider')}</small>`}</button>
        </div>
      </div>`;
  }

  function renderPanel() {
    const r = current();
    if (S.view === 'new' || !r) {
      if (!S.draft) S.draft = freshDraft();
      panelEl.innerHTML = renderForm();
      const input = panelEl.querySelector('.bmt-input');
      input.addEventListener('input', () => {
        S.draft.name = input.value;
        // (no name typed: Saddle up uses the picked one, so a rider who can't read can start alone)
        const go = panelEl.querySelector('[data-act="create"]');
        if (go) go.innerHTML = `Saddle up${input.value.trim() ? '' : ` <small>as ${esc(S.draft.pick || 'Rider')}</small>`}`;
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); act('create', {}); }
      });
    } else {
      panelEl.innerHTML = renderSettings(r);
      const fold = panelEl.querySelector('.bmt-jobs');
      if (fold) fold.addEventListener('toggle', () => { S.jobsOpen = fold.open; });
    }
  }

  // ---- RIDE OUT, Just lock boxes, and the line under them ----
  // (nothing to tick before riding out: the round-up and the lock boxes are always on, and the math finds its level)
  function whyNot(r) {
    return r ? '' : 'Make a rider first';
  }
  const ready = () => !S.load.known || S.load.f >= 1;

  // "Just lock boxes" in the rider's own words: picture boxes for the youngest (equations under the first rung, R0a at
  // 10: "2 plus what equals 4?"), solving for x from there
  function boxWords(r) {
    let eq = 0;
    try { eq = levelOf(r, 'eq'); } catch (e) { /* no skill yet */ }
    return eq < 10 ? '<b>Picture lock boxes</b><small>Count it up, no riding</small>' : '<b>Just lock boxes</b><small>Solve for x, no riding</small>';
  }
  function renderActions() {
    const r = current();
    if (S.view === 'new' || !r) { actionsEl.innerHTML = ''; actionsEl.hidden = true; return; }
    actionsEl.hidden = false;
    const why = whyNot(r);
    const label = S.riding ? 'Riding out…' : S.waiting ? 'Saddling up…' : 'RIDE OUT';
    actionsEl.innerHTML = `
      <button class="bmt-boxes" data-act="boxes" data-k="boxes" ${S.riding ? 'disabled' : ''}>${ICON.strongbox}${boxWords(r)}</button>
      <button class="bmt-ride ${S.waiting ? 'is-waiting' : ''}" data-act="ride" data-k="ride" ${why || S.riding ? 'disabled' : ''}
          aria-describedby="bmt-status"><i class="bmt-fill"></i><span>${label}</span></button>
      <div class="bmt-status" id="bmt-status" aria-live="polite">${why
        ? `<span class="bmt-why">${ICON.info}${why}</span>`
        : `<div class="bmt-load"><span class="bmt-bar"><i></i>${ICON.horse}</span><span class="bmt-loadtext"></span></div>`}</div>`;
    paintLoad();
  }

  // Updates just the loading bar and its words (called often while the world loads).
  let doneTimer = 0;
  function paintLoad() {
    const f = Math.max(0, Math.min(1, S.load.f));
    const pct = Math.round(f * 100);
    const load = actionsEl.querySelector('.bmt-load');
    const fill = actionsEl.querySelector('.bmt-fill');
    if (fill) fill.style.width = S.waiting ? pct + '%' : '0';
    if (!load) return;
    const bar = load.querySelector('.bmt-bar i'), horse = load.querySelector('.bmt-bar svg'), text = load.querySelector('.bmt-loadtext');
    if (!S.load.known) { load.style.display = 'none'; return; }
    load.style.display = '';
    bar.style.width = pct + '%';
    horse.style.left = pct + '%';
    if (f >= 1) {
      text.textContent = 'The valley is ready';
      if (!doneTimer) doneTimer = setTimeout(() => { const l = actionsEl.querySelector('.bmt-load'); if (l) l.classList.add('is-done'); }, 1400);
    } else {
      clearTimeout(doneTimer); doneTimer = 0; load.classList.remove('is-done');
      text.textContent = `${S.load.text || 'Loading the valley'} · ${pct}%`;
    }
  }

  function renderFoot() {
    footEl.innerHTML = `
      <button class="bmt-grown" data-act="grown" data-k="grown" aria-expanded="${S.sheet === 'grown'}">${ICON.people}Grown-ups</button>
      ${build ? `<span class="bmt-build">build ${esc(build)}</span>` : ''}
      ${S.saveOk ? '' : '<span class="bmt-warn">This browser is blocking saves, so progress lasts only until this tab closes.</span>'}`;
  }

  // ---- Grown-ups corner (a sheet over the screen) ----
  function grownRow(r) {
    const acc = accuracyOf(r);
    const accText = acc.pct == null ? 'no answers yet'
      : `${acc.pct}% right over the last ${acc.of} · ${fmt(r.stats.answered)} answered in all`;
    const range = accuracyOf(r, 'shoot');
    const split = range.of > 0 ? ` (bottle range ${range.pct}%)` : '';
    const badges = badgesOf(r);
    const boxes = `${fmt(r.stats.boxes)} solved, ${fmt(r.stats.parBoxes)} in the fewest moves` +
      (r.lockboxes.length ? ` · ${r.lockboxes.length} waiting in the saddlebags` : '');
    const math = statRows(r);   // (the kinds of math the rider has shown something in, as on the stats page)
    const mathText = math.length
      ? math.map((x) => `${esc(x.short)} ${x.pct}%${x.finding ? ' <small>(finding)</small>' : ''}`).join(' · ')
      : 'nothing answered yet: the game finds each level as they play';
    const off = MISSIONS.filter((m) => m.ready && !jobOn(r, m.id));
    const c = compOf(r);
    const confirm = S.confirmDel === r.id ? `
      <div class="bmt-confirm" role="alert"><span>Delete <b>${esc(r.name)}</b> for good? Their gold, fame and progress go too. This can't be undone.</span>
        <button class="bmt-btn" data-act="keep" data-k="keep:${esc(r.id)}">Keep</button>
        <button class="bmt-btn danger" data-act="delyes" data-id="${esc(r.id)}" data-k="delyes:${esc(r.id)}">Delete</button></div>` : '';
    return `<div class="bmt-row">
      <span class="bmt-face">${faceSVG(r.look)}</span>
      <h3>${esc(r.name)}<small>${titleOf(r)} · ${fmt(r.bounty)} fame · ${fmt(r.gold)} gold to spend</small></h3>
      <dl class="bmt-facts">
        <dt>Math</dt><dd>${mathText}</dd>
        <dt>Accuracy</dt><dd>${accText}${split}</dd>
        <dt>Age</dt><dd><label class="bmt-agesel"><select data-sel="age" data-id="${esc(r.id)}" data-k="agesel:${esc(r.id)}" aria-label="${esc(r.name)}'s age">
            <option value=""${r.age == null ? ' selected' : ''}>Not set</option>
            ${AGES.map((a) => `<option value="${a}"${r.age === a || (a === 16 && r.age != null && r.age > 16) || (a === 5 && r.age != null && r.age < 5) ? ' selected' : ''}>${a <= 5 ? '5 or under' : ageWord(a)}</option>`).join('')}
          </select></label> <small>a small head start for math not met yet</small></dd>
        <dt>Read aloud</dt><dd><button class="bmt-chip bmt-readsw" aria-pressed="${readMode(r) !== false}" data-act="read" data-id="${esc(r.id)}" data-k="read:${esc(r.id)}">${readMode(r) !== false ? ICON.speaker : ICON.speakerOff}${esc(readModeWords(r))}</button>
          <small>tap: by itself, always, off</small></dd>
        <dt>Jobs</dt><dd>${off.length ? `turned off: ${off.map((m) => esc(m.name)).join(', ')}` : 'every job on'}</dd>
        ${c ? `<dt>Completion</dt><dd>${c.pct}%${c.goals.length ? ` · goals: ${c.goals.map((g) => esc(g.name)).join(', ')}` : ''}</dd>` : ''}
        <dt>Lock boxes</dt><dd>${boxes}</dd>
        <dt>Jobs done</dt><dd>${bucklesOf(r).map(b => `${esc(jobWords(b.job, b.count))}${b.tier ? ` (${BUCKLE_NAMES[b.tier].toLowerCase()} buckle)` : ''}`).join(' · ')}</dd>
        <dt>Badges</dt><dd>${badges.length ? badges.map(esc).join(', ') : 'none yet'}</dd>
      </dl>
      <div class="bmt-rowbtns">
        <button class="bmt-chip" data-act="stats" data-id="${esc(r.id)}" data-k="stats:${esc(r.id)}">${ICON.bars}Stats</button>
        ${S.confirmDel === r.id ? '' : `<button class="bmt-del" data-act="del" data-id="${esc(r.id)}" data-k="del:${esc(r.id)}">Delete rider</button>`}
      </div>
      ${confirm}
    </div>`;
  }

  function renderSheet() {
    sheetEl.hidden = !S.sheet;
    if (!S.sheet) { sheetEl.innerHTML = ''; return; }
    sheetEl.setAttribute('aria-label', 'Grown-ups');
    sheetEl.innerHTML = `<div class="bmt-card">
      <header><h2>Grown-ups</h2><button class="bmt-x" data-act="ungrown" data-k="ungrown" aria-label="Close">${ICON.close}</button></header>
      <p>How each rider is doing. The game finds each rider's level in every kind of math by itself and keeps it where about 4 answers in 5 are right. Everything stays on this device; nothing is sent anywhere.</p>
      <div class="bmt-ledger">${riders.map(grownRow).join('') || '<div class="bmt-empty">No riders yet.</div>'}</div>
      <div class="bmt-cardfoot">${S.saveOk ? 'Progress is saved in this browser.' : 'This browser is blocking saves: progress lasts only until this tab closes.'}${build ? ` · build ${esc(build)}` : ''}</div>
    </div>`;
  }

  function renderAll() {
    keepFocus(() => { renderRiders(); renderPanel(); renderActions(); renderFoot(); renderSheet(); });
  }

  // ---- what each control does ----
  function changed(r) {
    saveRider(r);
    try { onChange(r); } catch (e) { console.error(e); }
  }

  function rideNow() {
    const r = current();
    if (!r || whyNot(r) || S.riding) return;
    S.waiting = false; S.riding = true;
    r.last = Date.now();
    saveRider(r);
    keepFocus(renderActions);
    let out;
    try { out = onRide(r); } catch (e) { S.riding = false; keepFocus(renderActions); throw e; }
    if (out && typeof out.then === 'function') out.then(null, (e) => { S.riding = false; keepFocus(renderActions); console.error(e); });
  }

  let boxGuard = 0;
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
        if (!riders.length) return;
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
      case 'hat': S.draft.hat = !S.draft.hat; keepFocus(renderPanel); return;
      case 'hair': S.draft.hair = data.v; S.draft.hairPicked = true; keepFocus(renderPanel); return;
      case 'age': S.draft.age = data.v ? Math.round(+data.v) : null; keepFocus(renderPanel); return;
      case 'create': {
        const name = (S.draft && S.draft.name || '').trim() || (S.draft && S.draft.pick) || '';
        if (!name || !canMakeMore()) { focusKey('name'); return; }
        const nr = newRider(name, draftLook());
        nr.age = S.draft.age == null ? null : S.draft.age;   // (optional: a modest head start, src/math/skill.js ageStart)
        riders.push(nr);
        saveRider(nr);
        S.saveOk = storageWorks();
        S.sel = nr.id; S.view = 'settings'; S.draft = null;
        renderAll();
        focusKey('ride');
        try { onChange(nr); } catch (e) { console.error(e); }
        return;
      }
      case 'read': {   // the read-aloud switch: by itself -> always -> off -> by itself (the panel, or a Grown-ups row)
        const who = (data.id && riders.find(x => x.id === data.id)) || r;
        if (!who) return;
        who.readAloud = nextReadMode(who);
        keepFocus(() => { renderPanel(); renderSheet(); });
        changed(who);
        return;
      }
      case 'mission': {   // a job on or off (the folded Jobs list); its buckle shows or hides on the card with it
        const m = MISSIONS.find(x => x.id === data.id);
        if (!r || !m || !m.ready) return;
        r.missions[m.id] = !jobOn(r, m.id);
        keepFocus(() => { renderRiders(); renderPanel(); });
        changed(r);
        return;
      }
      case 'stats': {   // the stats page, for the chosen rider (or a rider's row in the Grown-ups corner)
        const who = (data.id && riders.find(x => x.id === data.id)) || r;
        if (!who) return;
        const back = data.id ? `stats:${data.id}` : 'stats';
        openStats(document.body, who, { face: faceSVG(who.look), completion: S.comp, onClose: () => focusKey(back, false) });
        return;
      }
      case 'goals': case 'left': {
        // the checklist's "What's left" page (src/ui/completion.js), over the title; "Set a goal" opens it with a Pin
        // button on every item (a grown-up pins a goal there: two at a time)
        if (!r) return;
        const back = what;
        import('./completion.js').then((m) => {
          if (typeof m.openWhatsLeft !== 'function') return;
          m.openWhatsLeft(document.body, r, { pin: what === 'goals',
            onChange: (x) => { keepFocus(renderPanel); changed(x || r); },
            onClose: () => { keepFocus(renderPanel); focusKey(back, false); } });
        }).catch((e) => console.warn('Bandit Math: the what\'s-left page is not there yet', e));
        return;
      }
      case 'ride':
        if (!r || whyNot(r)) return;
        if (ready()) { rideNow(); return; }
        S.waiting = !S.waiting;   // a second press while saddling up calls it off
        keepFocus(renderActions);
        return;
      case 'boxes': {
        if (!r || Date.now() - boxGuard < 800) return;
        boxGuard = Date.now();
        S.waiting = false;
        r.last = Date.now();
        saveRider(r);
        keepFocus(renderActions);
        onLockboxes(r);
        return;
      }
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
        deleteRider(id);
        const i = riders.findIndex(x => x.id === id);
        if (i >= 0) riders.splice(i, 1);
        S.confirmDel = null;
        if (S.sel === id) {
          S.sel = riders[0] ? riders[0].id : null;
          S.waiting = false;
          if (!riders.length) { S.view = 'new'; S.draft = freshDraft(); }
          try { onChange(current()); } catch (e) { console.error(e); }
        }
        renderAll();
        focusKey(riders.length ? 'ungrown' : 'ungrown');
        return;
      }
      default:
    }
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !el.contains(b) || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
    act(b.getAttribute('data-act'), { id: b.getAttribute('data-id'), v: b.getAttribute('data-v') });
  });
  // a rider's age, picked in the Grown-ups corner (a small head start for the math they haven't met yet)
  sheetEl.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-sel="age"]');
    if (!sel) return;
    const r = riders.find(x => x.id === sel.getAttribute('data-id'));
    if (!r) return;
    r.age = sel.value ? Math.round(+sel.value) : null;
    keepFocus(() => { renderSheet(); renderPanel(); });
    changed(r);
  });
  // a click on the dark backdrop of the Grown-ups sheet closes it
  sheetEl.addEventListener('click', (e) => { if (e.target === sheetEl) act('ungrown', {}); });

  // Escape closes the Grown-ups corner or the new-rider form, even when nothing has keyboard focus.
  const onEscape = (e) => {
    if (e.key !== 'Escape' || !S.visible) return;
    if (e.target !== document.body && !el.contains(e.target)) return;   // another panel's Escape, not ours
    if (S.sheet) { e.preventDefault(); act(S.confirmDel ? 'keep' : 'ungrown', {}); return; }
    if (S.view === 'new' && riders.length) { e.preventDefault(); act('cancel', {}); }
  };
  document.addEventListener('keydown', onEscape);

  // Arrow keys move within a group; in a radio group (riders, mode, looks, colours) they also pick.
  el.addEventListener('keydown', (e) => {
    if (!S.visible || e.key === 'Escape') return;
    const keys = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };
    if (!(e.key in keys)) return;
    const nav = e.target.closest && e.target.closest('[data-nav]');
    if (!nav || e.target.tagName === 'INPUT') return;
    const radio = nav.getAttribute('data-nav') === 'radio';
    // in a radio group only the choices take part (not, say, the New rider button below the rider cards)
    const items = [...nav.querySelectorAll(radio ? '[role="radio"]' : '[data-k]')]
      .filter(n => n.getAttribute('aria-disabled') !== 'true' && !n.disabled && n.closest('[data-nav]') === nav);
    const at = items.indexOf(e.target);
    if (at < 0) return;
    let step = keys[e.key];
    if (nav.getAttribute('data-nav') === 'grid' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      // move a whole row in a grid of cards: to the card in the next row up or down that sits nearest side to
      // side (the rows can hold different numbers of cards, as the math topics do)
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
  // the goals and completion (src/completion.js): drawn in once loaded; left out if the game has none yet
  if (!S.comp) {
    import('../completion.js').then((m) => {
      if (typeof m.completion !== 'function') return;
      S.comp = m;
      keepFocus(() => { renderPanel(); if (S.sheet) renderSheet(); });
    }).catch(() => { /* no completion in this build yet */ });
  }
  ensureStyles(() => {
    if (!S.visible) return;
    el.classList.remove('is-hidden');
    if (S.view === 'new') focusKey('name', false); else focusKey('ride', false);   // no scrolling: the name stays in view
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
    // Brings it back (after a ride, or after the lock boxes), with riders' latest gold, bounty and titles.
    show() {
      clearTimeout(goneTimer);
      const stored = loadRiders();
      const live = new Map(riders.map(r => [r.id, r]));
      const next = stored.map(s => live.get(s.id) || s);   // keep the game's live rider objects; follow the saved order
      riders.splice(0, riders.length, ...next);
      if (!current()) S.sel = riders[0] ? riders[0].id : null;
      if (!riders.length) { S.view = 'new'; S.draft = freshDraft(); }
      S.visible = true; S.riding = false; S.waiting = false; S.sheet = false; S.confirmDel = null;
      S.saveOk = storageWorks();
      el.inert = false;
      el.classList.remove('is-gone');
      renderAll();
      void el.offsetWidth;   // let the browser see it before fading in
      el.classList.remove('is-hidden');
      if (S.view === 'new') focusKey('name', false); else focusKey('ride', false);   // no scrolling: the name stays in view
    },
    // The world's loading progress behind the title: fraction 0..1, and a few words on what it is doing.
    setProgress(fraction, text) {
      const f = Number(fraction);
      S.load.known = true;
      S.load.f = Number.isFinite(f) ? Math.max(0, Math.min(1, f)) : 0;
      if (text != null) S.load.text = String(text);
      paintLoad();
      if (S.load.f >= 1 && S.waiting) rideNow();
    },
    // The rider whose card is picked (or null).
    rider: () => current(),
  };
  return api;
}
