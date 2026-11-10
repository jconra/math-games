// title.js: Mathwood Valley's title screen. It floats over the live valley while the world loads behind it.
//
//   const T = showTitle(root, { riders, build, onRide(rider), onLockboxes(rider), onChange(rider), completion })
//   T.setProgress(0.4, 'Planting trees')   // the world's loading progress, 0..1 (RIDE OUT waits for 1)
//   T.hide(); T.show();
//
// HOW THE SCREEN WORKS IS SHARED: shared/title/title.js is the engine (the riders' cards, the new-rider form, the
// chosen rider's panel, RIDE OUT and its loading bar, the Grown-ups corner, the clicks and the keyboard), and the
// other games in this repo use the same one. THIS FILE IS MATHWOOD'S THEME: everything Mathwood says and draws on that
// screen. A change to how the screen works goes in the engine, once, for every game; a change to what Mathwood says or
// shows goes here; how it looks is title.css beside this file.
//
// What is on it: the game's name; a card for each rider (name, title, bounty, face, when they last rode, the belt
// buckles won; the chosen rider's card also shows each job's buckle with how far to the next one) and "New rider" (a
// name, a look, and an optional age); the chosen rider's panel: their math (no level to pick: the game finds each
// kind of math's level by itself as they play, src/math/skill.js; the panel says so and shows the levels found so
// far, with the levels page, src/ui/levels.js, and the stats page, src/ui/stats.js, a tap away), their goals and completion (src/completion.js, when the game
// has it: a grown-up pins a goal, "Set a goal"), the read-aloud switch while their math is young, and a folded "Jobs"
// list where a grown-up can turn some jobs off (every job is on by default); RIDE OUT; "Just lock boxes"; a small
// build number; and a folded Grown-ups corner (each rider's math, age and progress, the bandits switch; delete a rider).
// No math topics or missions to tick: every rider gets every job, the bottle range included, at their own level.
// THE BANDITS SWITCH (src/gun.js): "Lasso only / Lasso or guns", on the new-rider form and on each rider's
// row in the Grown-ups corner, shown plainly and set to lasso only at the start. It is the rider's saved mode
// ('lasso' | 'shoot'): on, the general store sells the rider a six-shooter for bringing in bandits.
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

import { showTitle as showShared, ICONS, esc, fmt } from '../../../shared/title/title.js';
import {
  loadRiders, saveRider, newRider, deleteRider, titleOf, nextTitle, badgesOf, accuracyOf, storageWorks, jobOn, readAloudLevel,
  readMode, nextReadMode, readModeWords, bucklesOf, buckleProgress, jobWords, BUCKLE_NAMES, MISSIONS, LOOKS, SKINS, HAIRS, MAX_RIDERS,
} from '../save.js';
import { stats as strandStats, levelOf } from '../math/skill.js';
import { openStats, statRows } from './stats.js';
import { openLevels, gridWords } from './levels.js';
import { placeStats, stateOf } from '../levels/model.js';
import { buckleSVG } from './hud.js';
import { hatSVG, hatOf, hatColour } from '../hats.js';
import { BANDIT_MODES, gunOn, ownsGun, setBandits } from '../gun.js';
import { PRICES } from '../catalog.js';

// ---- small drawings --------------------------------------------------------------------------------------------

function starPoints(cx, cy, R, r, n) {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n, d = i % 2 ? r : R;
    p.push((cx + d * Math.cos(a)).toFixed(2) + ',' + (cy + d * Math.sin(a)).toFixed(2));
  }
  return p.join(' ');
}

// Mathwood's own drawings, on top of the engine's (check, plus, chevron, close, people, info).
const ICON = {
  ...ICONS,
  // a six-point sheriff's star with little balls on the tips
  star: '<svg viewBox="0 0 16 16" aria-hidden="true"><polygon points="' + starPoints(8, 8.3, 7, 3.6, 6) + '" fill="currentColor"/></svg>',
  strongbox: '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M4 12.2V9.6Q4 6 7.6 6h12.8Q24 6 24 9.6v2.6z" fill="currentColor"/><rect x="4" y="13.4" width="20" height="10.6" rx="1.4" fill="currentColor"/><path d="M8.6 6v18M19.4 6v18" stroke="#1d140c" stroke-width="1.5" opacity=".55"/><rect x="11.4" y="10" width="5.2" height="7.4" rx="1.1" fill="#1d140c"/><circle cx="14" cy="12.9" r="1.15" fill="currentColor"/><path d="M14 13.6v2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M8.5 12V9a5.5 5.5 0 0 1 11 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="5" y="12" width="18" height="13" rx="2.5" fill="currentColor"/><circle cx="14" cy="17.4" r="2" fill="#1d140c"/><path d="M14 18.6v3" stroke="#1d140c" stroke-width="2" stroke-linecap="round"/></svg>',
  // a compass: the game finds the level by itself
  compass: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M15.6 8.4l-2.2 5-5 2.2 2.2-5z" fill="currentColor"/></svg>',
  // three rising bars: the stats page
  bars: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><rect x="2" y="9" width="3" height="5" rx=".8"/><rect x="6.5" y="5.5" width="3" height="8.5" rx=".8"/><rect x="11" y="2" width="3" height="12" rx=".8"/></svg>',
  // a ladder: the levels page
  ladder: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.5 1.5v13M11.5 1.5v13M4.5 4.5h7M4.5 8h7M4.5 11.5h7"/></svg>',
  // a pennant on a pole: a goal
  flag: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 14.5V1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4.4 2.2h8.4l-2.2 3.2 2.2 3.2H4.4z" fill="currentColor"/></svg>',
  // a list with ticks: what's left to do
  list: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 4l1.2 1.2L5.4 3M2 9l1.2 1.2L5.4 8"/><path d="M7.6 4.2h6.4M7.6 9.2h6.4M7.6 13.4h6.4"/><circle cx="3.6" cy="13.4" r="1" fill="currentColor" stroke="none"/></svg>',
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

// The ages the new-rider form offers (optional; the engine's list). An age only gives a modest head start
// (src/math/skill.js ageStart: nothing at 5 and under, a third-grade start from 15 on); the game finds the real level
// as the rider plays.

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

// The same for the places (src/levels/model.js: one kind of math and one ladder each): the places played lately
// first. Only places with something to go on (answered, or moved from an earlier ride's save).
// -> [{ place, short, pct, finding }]
function placeSummary(r, n = 4) {
  const rows = placeStats(r).filter((x) => x.answered > 0 || (stateOf(r, x.place) || {}).old);
  const last = (x) => Number((stateOf(r, x.place) || {}).last) || 0;
  return rows.sort((a, b) => last(b) - last(a) || b.answered - a.answered).slice(0, n);
}

// Names a new rider can start with without typing one (a rider who can't read yet taps Saddle up): one not taken yet.
const NAMES = ['Dusty', 'Rosie', 'Kit', 'Hank', 'Belle', 'Sam', 'Lou', 'Jo', 'Cody', 'Daisy', 'Buck', 'Pearl'];

// Every word the engine puts on the screen, in Mathwood's voice.
const WORDS = {
  screen: 'Mathwood Valley title screen',
  who: 'Who\'s riding?',
  players: 'Riders',
  newPlayer: 'New rider',
  formTitle: 'New rider',
  formLine: 'Name, look, and you\'re off',
  anyName: 'Rider',
  create: 'Saddle up',
  start: 'RIDE OUT',
  waiting: 'Saddling up…',
  starting: 'Riding out…',
  makeFirst: 'Make a rider first',
  loading: 'Loading the valley',
  ready: 'The valley is ready',
  grownIntro: 'How each rider is doing. The game finds each rider\'s level in every kind of math by itself and keeps it where about 4 answers in 5 are right. Names and saves stay on this device, and no personal data is sent: only game data (how answers go and which jobs get played, never names), to help make the game better. It can be switched off in the pause menu.',
  noPlayers: 'No riders yet.',
  deletePlayer: 'Delete rider',
  deleteAsk: (name) => `Delete ${name} for good? Their gold, fame and progress go too. This can't be undone.`,
};

// ---- the screen ------------------------------------------------------------------------------------------------

export function showTitle(root, opts = {}) {
  const onLockboxes = opts.onLockboxes || (() => {});
  const onChange = opts.onChange || (() => {});

  // what only Mathwood's parts of the screen remember
  const M = {
    comp: opts.completion && typeof opts.completion.completion === 'function' ? opts.completion : null,   // src/completion.js, once loaded
    jobsOpen: false,    // the folded Jobs list is open
  };

  // The goals and completion, from src/completion.js (null until it has loaded, or if the game has none)
  function compOf(r) {
    if (!M.comp) return null;
    try {
      const c = M.comp.completion(r);
      const goals = typeof M.comp.goalsOf === 'function' ? M.comp.goalsOf(r) : [];
      return { pct: Math.round(Number(c && c.pct) || 0), goals: Array.isArray(goals) ? goals : [], groups: (c && c.groups) || [] };
    } catch (e) { console.warn('Mathwood Valley: completion could not be read', e); return null; }
  }
  const pct100 = (v) => Math.max(0, Math.min(100, Number(v) || 0));

  // the bandits switch as two round buttons, lasso only first (the new-rider form; a rider's row in the Grown-ups
  // corner, with id)
  function banditPick(cur, kind, label, id = null) {
    return `<div class="bmt-agepick bmt-bandits" role="radiogroup" aria-label="${label}" data-nav="radio">
      ${BANDIT_MODES.map((m) => `<button class="bmt-agech is-skip" role="radio" aria-checked="${cur === m.id}" tabindex="${cur === m.id ? 0 : -1}"
          data-act="${kind}" data-v="${m.id}"${id ? ` data-id="${esc(id)}"` : ''} data-k="${kind}:${id ? esc(id) + ':' : ''}${m.id}">${esc(m.words)}</button>`).join('')}
    </div>`;
  }

  // "Just lock boxes" in the rider's own words: picture boxes for the youngest (equations under the first rung, R0a at
  // 10: "2 plus what equals 4?"), solving for x from there
  function boxWords(r) {
    let eq = 0;
    try { eq = levelOf(r, 'eq'); } catch (e) { /* no skill yet */ }
    return eq < 10 ? '<b>Picture lock boxes</b><small>Count it up, no riding</small>' : '<b>Just lock boxes</b><small>Solve for x, no riding</small>';
  }

  let boxGuard = 0;

  const theme = {
    prefix: 'bmt',
    css: new URL('./title.css', import.meta.url).href,   // the stylesheet sits next to this file
    words: WORDS,
    icons: { runner: ICON.horse },
    brand: () => `<h1 class="bmt-name">Mathwood <span>Valley</span></h1><div class="bmt-orn"><i></i>${ICON.ornStar}<i></i></div>`,
    save: { load: loadRiders, save: saveRider, make: newRider, remove: deleteRider, works: storageWorks, max: MAX_RIDERS },
    looks: LOOKS, skins: SKINS, hairs: HAIRS, names: NAMES,
    portrait: faceSVG,
    lookOf: (d, l) => ({ outfit: l.outfit, palette: l.palette, skin: d.skin, hair: d.hair, hat: d.hat }),
    lookCardOf: (l, d) => ({ outfit: l.outfit, palette: l.palette, skin: d.skin, hair: d.hairPicked ? d.hair : l.hair, hat: d.hat }),
    when: rode,

    // ---- a rider's card ----
    cardSaid: (r) => `${esc(r.name)}, ${titleOf(r)}, ${fmt(r.bounty)} fame. ${esc(bucklesSaid(r))}`,
    cardBody(r, on) {
      const badges = badgesOf(r).map(b => `<span class="bmt-badge">${ICON.star}${esc(b)}</span>`).join('');
      return `<span class="bmt-rank"><b>${titleOf(r)}</b><span class="bmt-bounty">${ICON.star}${fmt(r.bounty)} fame</span>${badges}${on ? '' : miniBuckles(r)}</span>
        ${on ? buckleRow(r) : ''}`;
    },

    // ---- the chosen rider's panel ----
    panelLine: toNext,
    panel(r) {
      // MATH: no level to pick. Until the rider has answered something the panel says how it works; then the places
      // played lately with their % up each place's ladder (the levels page and the stats page have every one), or, for a
      // rider whose answers so far came from jobs not on the ladders yet, the kinds of math practised lately; and any
      // levels a grown-up set by hand, in plain words
      const places = placeSummary(r, 4);
      const sum = places.length ? places : mathSummary(r, 4);
      const finding = places.length ? places.filter((x) => x.finding) : strandStats(r).filter((x) => x.finding && x.answered > 0);
      const set = gridWords(r);
      const math = sum.length
        ? `<div class="bmt-skills">${sum.map((x) => `<span class="bmt-sk${x.finding ? ' is-finding' : ''}"><b>${esc(x.short)}</b><em>${x.pct}%</em>
            <span class="bmt-skbar"><i style="width:${pct100(x.pct)}%"></i></span></span>`).join('')}</div>
        <p class="bmt-auto is-small">${ICON.compass}<span>${finding.length ? `Finding your level in ${esc(finding.map((x) => x.short).join(', ').replace(/, ([^,]*)$/, ' and $1'))}: a question may feel too easy or too hard for a minute.`
          : 'Your level moves with you: about 4 answers in 5 right.'}</span></p>`
        : `<p class="bmt-auto">${ICON.compass}<span><b>No level to pick.</b> ${AUTO_LINE}</span></p>`;
      const setLine = set ? `<p class="bmt-auto is-small bmt-set">${ICON.ladder}<span><b>Set by hand:</b> ${esc(set)}</span></p>` : '';
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
        <small>${rm === 'on' ? 'The basic math cards are always read out loud (a recorded voice). Tap to turn it off.' : rm === false ? 'Nothing is read out loud. Tap to have the basic math cards read out by a recorded voice.'
          : 'The basic math cards are read out loud by a recorded voice while the math is new (and for an age of 7 and under). Tap for always.'}</small></div>` : '';
      // JOBS: every job on; a grown-up can turn some off (folded away)
      const jobs = MISSIONS.filter((m) => m.ready);
      const on = jobs.filter((m) => jobOn(r, m.id)).length;
      const missions = jobs.map((m) => {
        const isOn = jobOn(r, m.id);
        return `<button class="bmt-mission" role="checkbox" aria-checked="${isOn}" data-act="mission" data-id="${m.id}" data-k="mission:${m.id}">
        <span class="bmt-box">${ICON.check}</span><b>${esc(m.name)}</b><small>${esc(m.line)}</small>
      </button>`;
      }).join('');
      return `<section class="bmt-sec">
        <h3 class="bmt-label">Math <span class="bmt-links"><button class="bmt-link" data-act="levels" data-k="levels">${ICON.ladder}Levels</button><button class="bmt-link" data-act="stats" data-k="stats">${ICON.bars}Stats</button></span></h3>
        ${math}${setLine}
      </section>
      ${goals}
      ${readRow}
      <details class="bmt-jobs"${M.jobsOpen ? ' open' : ''}>
        <summary data-k="jobs"><span class="bmt-label">Jobs</span><small>${on === jobs.length ? `All ${jobs.length} on` : `${on} of ${jobs.length} on`}</small>${ICON.chevron}</summary>
        <p class="bmt-note">Every job is on, so there is always something to do. A grown-up can turn some off. The round-up and the lock boxes are always on.</p>
        <div class="bmt-missions" role="group" aria-label="Jobs" data-nav="grid">${missions}</div>
      </details>`;
    },
    panelReady(panelEl) {
      const fold = panelEl.querySelector('.bmt-jobs');
      if (fold) fold.addEventListener('toggle', () => { M.jobsOpen = fold.open; });
    },

    // ---- the new-rider form: the hat, "let the rider pick levels", the bandits switch ----
    draft: () => ({ hat: true, levels: true, bandits: 'lasso' }),
    formTones: (d) => `<div class="bmt-tone"><span>Hat</span><button class="bmt-hat" role="switch" aria-checked="${d.hat}" data-act="hat" data-k="hat">${ICON.hat}${d.hat ? 'On' : 'Off'}</button></div>`,
    formAge: (d) => `<p class="bmt-auto">${ICON.compass}<span><b>No level to set.</b> ${AUTO_LINE} An age only gives a small head start.</span></p>
          <div class="bmt-read"><button class="bmt-hat" role="switch" aria-checked="${d.levels !== false}" data-act="picklv" data-k="picklv">${ICON.ladder}Let the rider pick levels: ${d.levels !== false ? 'On' : 'Off'}</button>
            <small>${d.levels !== false ? 'Arrows by the level at the bottom of the screen step it down or up by hand.' : 'Only the game moves the level: the arrows by it are hidden.'}</small></div>`,
    formMore: (d) => `<section>
          <h3 class="bmt-label">Bandits <small>a grown-up's choice</small></h3>
          ${banditPick(d.bandits, 'bandits', 'Bandits')}
          <p class="bmt-auto is-small"><span>${esc((BANDIT_MODES.find((m) => m.id === d.bandits) || BANDIT_MODES[0]).line)}</span></p>
        </section>`,
    created(nr, d) {
      nr.pickLevels = d.levels !== false;   // (the level tool's arrows: src/ui/leveltool.js)
      setBandits(nr, d.bandits);            // (the bandits switch: src/gun.js)
    },

    // ---- "Just lock boxes", beside RIDE OUT ----
    actionsBefore: (r, S) => `<button class="bmt-boxes" data-act="boxes" data-k="boxes" ${S.riding ? 'disabled' : ''}>${ICON.strongbox}${boxWords(r)}</button>`,

    // ---- a rider's row in the Grown-ups corner ----
    grownLine: (r) => `${titleOf(r)} · ${fmt(r.bounty)} fame · ${fmt(r.gold)} gold to spend`,
    grownFacts(r, ctx) {
      const acc = accuracyOf(r);
      const accText = acc.pct == null ? 'no answers yet'
        : `${acc.pct}% right over the last ${acc.of} · ${fmt(r.stats.answered)} answered in all`;
      const range = accuracyOf(r, 'shoot');
      const split = range.of > 0 ? ` (bottle range ${range.pct}%)` : '';
      const badges = badgesOf(r);
      const boxes = `${fmt(r.stats.boxes)} solved` +
        (r.lockboxes.length ? ` · ${r.lockboxes.length} waiting in the saddlebags` : '');
      const math = statRows(r);   // (the kinds of math the rider has shown something in, as on the stats page)
      const mathText = math.length
        ? math.map((x) => `${esc(x.short)} ${x.pct}%${x.finding ? ' <small>(finding)</small>' : ''}`).join(' · ')
        : 'nothing answered yet: the game finds each level as they play';
      const off = MISSIONS.filter((m) => m.ready && !jobOn(r, m.id));
      const c = compOf(r);
      return `<dt>Math</dt><dd>${mathText}</dd>
        <dt>Accuracy</dt><dd>${accText}${split}</dd>
        <dt>Age</dt><dd>${ctx.ageSelect(r)} <small>a small head start for math not met yet</small></dd>
        <dt>Read aloud</dt><dd><button class="bmt-chip bmt-readsw" aria-pressed="${readMode(r) !== false}" data-act="read" data-id="${esc(r.id)}" data-k="read:${esc(r.id)}">${readMode(r) !== false ? ICON.speaker : ICON.speakerOff}${esc(readModeWords(r))}</button>
          <small>tap: by itself, always, off</small></dd>
        <dt>Levels</dt><dd>${esc(gridWords(r) || 'every level on in every place: the game finds each one')}</dd>
        <dt>Pick levels</dt><dd><button class="bmt-chip" aria-pressed="${r.pickLevels !== false}" data-act="picklv" data-id="${esc(r.id)}" data-k="picklv:${esc(r.id)}">${ICON.ladder}${r.pickLevels !== false ? 'On' : 'Off'}</button>
          <small>the arrows by the level at the bottom of the screen</small></dd>
        <dt>Bandits</dt><dd>${banditPick(gunOn(r) ? 'shoot' : 'lasso', 'bandits', `${esc(r.name)}'s bandits`, r.id)}
          <small>${gunOn(r) ? (ownsGun(r) ? 'the six-shooter is bought: choose it at the bandits with the buttons on the right' : `a six-shooter can be bought at the general store (${PRICES.revolver} gold)`) : (ownsGun(r) ? 'the six-shooter bought is put away: bandits are roped' : 'bandits are roped; the six-shooter shows in the store, greyed')}</small></dd>
        <dt>Jobs</dt><dd>${off.length ? `turned off: ${off.map((m) => esc(m.name)).join(', ')}` : 'every job on'}</dd>
        ${c ? `<dt>Completion</dt><dd>${c.pct}%${c.goals.length ? ` · goals: ${c.goals.map((g) => esc(g.name)).join(', ')}` : ''}</dd>` : ''}
        <dt>Lock boxes</dt><dd>${boxes}</dd>
        <dt>Jobs done</dt><dd>${bucklesOf(r).map(b => `${esc(jobWords(b.job, b.count))}${b.tier ? ` (${BUCKLE_NAMES[b.tier].toLowerCase()} buckle)` : ''}`).join(' · ')}</dd>
        <dt>Badges</dt><dd>${badges.length ? badges.map(esc).join(', ') : 'none yet'}</dd>`;
    },
    grownButtons: (r) => `<button class="bmt-chip" data-act="levels" data-id="${esc(r.id)}" data-k="levels:${esc(r.id)}">${ICON.ladder}Levels</button>
        <button class="bmt-chip" data-act="stats" data-id="${esc(r.id)}" data-k="stats:${esc(r.id)}">${ICON.bars}Stats</button>`,

    // ---- what Mathwood's own controls do ----
    actions: {
      hat({ S, keepFocus, draw }) { S.draft.hat = !S.draft.hat; keepFocus(draw.panel); },
      // "Let the rider pick levels": on the new-rider form, or a rider's row in the Grown-ups corner
      picklv({ S, players, keepFocus, draw, changed }, data) {
        const who = data.id ? players.find(x => x.id === data.id) : null;
        if (who) { who.pickLevels = who.pickLevels === false; keepFocus(() => { draw.panel(); draw.sheet(); }); changed(who); return; }
        S.draft.levels = S.draft.levels === false; keepFocus(draw.panel);
      },
      // the bandits switch: on the new-rider form, or a rider's row in the Grown-ups corner
      bandits({ S, players, keepFocus, draw, changed }, data) {
        const who = data.id ? players.find(x => x.id === data.id) : null;
        if (who) { setBandits(who, data.v); keepFocus(() => { draw.panel(); draw.sheet(); }); changed(who); return; }
        if (S.draft) { S.draft.bandits = data.v === 'shoot' ? 'shoot' : 'lasso'; keepFocus(draw.panel); }
      },
      // the read-aloud switch: by itself -> always -> off -> by itself (the panel, or a Grown-ups row)
      read({ players, current, keepFocus, draw, changed }, data) {
        const who = (data.id && players.find(x => x.id === data.id)) || current();
        if (!who) return;
        who.readAloud = nextReadMode(who);
        keepFocus(() => { draw.panel(); draw.sheet(); });
        changed(who);
      },
      // a job on or off (the folded Jobs list); its buckle shows or hides on the card with it
      mission({ current, keepFocus, draw, changed }, data) {
        const r = current(), m = MISSIONS.find(x => x.id === data.id);
        if (!r || !m || !m.ready) return;
        r.missions[m.id] = !jobOn(r, m.id);
        keepFocus(() => { draw.players(); draw.panel(); });
        changed(r);
      },
      // the stats page, for the chosen rider (or a rider's row in the Grown-ups corner)
      stats({ players, current, focusKey }, data) {
        const who = (data.id && players.find(x => x.id === data.id)) || current();
        if (!who) return;
        const back = data.id ? `stats:${data.id}` : 'stats';
        openStats(document.body, who, { face: faceSVG(who.look), completion: M.comp, onClose: () => focusKey(back, false) });
      },
      // the levels page (src/ui/levels.js), for the chosen rider (or a rider's row in the Grown-ups corner)
      levels({ players, current, keepFocus, focusKey, draw }, data) {
        const who = (data.id && players.find(x => x.id === data.id)) || current();
        if (!who) return;
        const back = data.id ? `levels:${data.id}` : 'levels';
        openLevels(document.body, who, {
          onChange: (x) => { keepFocus(() => { draw.panel(); draw.sheet(); }); try { onChange(x || who); } catch (e) { console.error(e); } },
          onClose: () => focusKey(back, false) });
      },
      // the checklist's "What's left" page (src/ui/completion.js), over the title; "Set a goal" opens it with a Pin
      // button on every item (a grown-up pins a goal there: two at a time)
      goals: (ctx) => whatsLeft(ctx, 'goals'),
      left: (ctx) => whatsLeft(ctx, 'left'),
      boxes({ S, current, keepFocus, draw }) {
        const r = current();
        if (!r || Date.now() - boxGuard < 800) return;
        boxGuard = Date.now();
        S.waiting = false;
        r.last = Date.now();
        saveRider(r);
        keepFocus(draw.actions);
        onLockboxes(r);
      },
    },

    // the goals and completion (src/completion.js): drawn in once loaded; left out if the game has none yet
    begin({ S, keepFocus, draw }) {
      if (M.comp) return;
      import('../completion.js').then((m) => {
        if (typeof m.completion !== 'function') return;
        M.comp = m;
        keepFocus(() => { draw.panel(); if (S.sheet) draw.sheet(); });
      }).catch(() => { /* no completion in this build yet */ });
    },
  };

  function whatsLeft({ current, keepFocus, focusKey, draw, changed }, what) {
    const r = current();
    if (!r) return;
    const back = what;
    import('./completion.js').then((m) => {
      if (typeof m.openWhatsLeft !== 'function') return;
      m.openWhatsLeft(document.body, r, { pin: what === 'goals',
        onChange: (x) => { keepFocus(draw.panel); changed(x || r); },
        onClose: () => { keepFocus(draw.panel); focusKey(back, false); } });
    }).catch((e) => console.warn('Mathwood Valley: the what\'s-left page is not there yet', e));
  }

  const T = showShared(root, theme, { players: opts.riders, build: opts.build, onStart: opts.onRide, onChange: opts.onChange });
  T.rider = T.player;   // the rider whose card is picked (or null)
  return T;
}
