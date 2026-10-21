// levels.js: THE LEVELS PAGE, from the title screen (the chosen rider's panel and the Grown-ups corner), the pause
// menu and the stats page. Each place in the game has one kind of math and one ladder of levels (src/levels/places.js);
// this page shows them one place at a time, so a rider and a grown-up can see what each place asks and where the rider
// is, and change it if they like:
//   - a tab for every place, each with a picture (for riders who can't read yet), its short name and the rider's %
//   - the place: its picture, name, kind of math, one line about it, the rider's % up its ladder and where they are
//     ("Finding your level", "Not played yet: you'd start at level 3"), and THE SETTINGS IN PLAIN WORDS (all levels
//     on, or which are skipped; a level picked with "Start here"; the job switched off in the Jobs list)
//   - its levels going down, easiest first: each with what's asked, 2 or 3 real examples made by the place's own
//     question maker (fresh each time the page opens; "New examples" makes more), a tick, and "Start here"
//   - every tick on (the start) = the game moves the rider up and down by itself; untick a level to skip it (the last
//     one on stays on); "Start here" puts the rider straight on a level, with an Undo for a slip of the finger.
// No grown-up lock: the page always shows the settings as they are, so a grown-up who looks can see them.
// Every change is saved straight away (save.js saveRider) and takes effect on the next question asked: each job asks
// src/levels/model.js levelFor for every question.
//
//   const page = openLevels(root, rider, { place, onClose, onChange(rider), speak(text) })
//   page.show(placeId); page.close()
//     place     the tab to open on (a place id); else the place the rider played last, else the first
//     onChange  called after every change (a tick, Start here, Undo, all on)
//     speak     optional: reads a place's name and line when its tab is picked (the game passes it for a rider who
//               is read to: skill.js readAloud)
//   Esc, the close button or a click on the dark backdrop closes it. z-index 52: over the stats page (50), which can
//   open it, and the title and the pause menu; under the lock box (60).
//
// Pure parts for the tests and for the title and stats pages: placeView(rider, placeId, { seed, n }), settingsWords,
// statusWords, gridWords (the settings of every place in one line), placeOfJob(jobId), PIC (the pictures), picSVG(key).
//
// The page reads only what the levels contract names: PLACES, examplesOf, pctOf, stateOf, isOn, onIds, setOn,
// setAllOn, startHere, seedLevel, then saveRider.

import { PLACES, PLACE, examplesOf } from '../levels/places.js';
import { stateOf, pctOf, isOn, onIds, setOn, setAllOn, startHere, seedLevel, levelPct } from '../levels/model.js';
import { saveRider, jobOn, MISSIONS } from '../save.js';

// ---- the pictures: one small drawing for each place's `pic` key, in the text colour (details in the card's ink) ----

const INK = '#1a120c';
export const PIC = {
  // a steer's head with its horns
  cow: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M1.5 8.5c1.6 2.6 4.6 4 8 4.2h13c3.4-.2 6.4-1.6 8-4.2-.4 3.6-2.8 6-6.6 6.6l-1.6 7.4c-.6 3.4-3.2 6-6.3 6s-5.7-2.6-6.3-6l-1.6-7.4C4.3 14.5 1.9 12.1 1.5 8.5z" fill="currentColor"/><ellipse cx="12.4" cy="17.2" rx="1.2" ry="1.4" fill="' + INK + '"/><ellipse cx="19.6" cy="17.2" rx="1.2" ry="1.4" fill="' + INK + '"/><ellipse cx="14.2" cy="25.4" rx=".9" ry="1.2" fill="' + INK + '"/><ellipse cx="17.8" cy="25.4" rx=".9" ry="1.2" fill="' + INK + '"/></svg>',
  // a covered wagon
  wagon: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4.5 18.5L3.6 7.2c3.4-2.6 6.4-2.6 8.6-.2 2.6-2.4 5-2.4 7.6 0 2.2-2.4 5.2-2.4 8.6.2l-.9 11.3z" fill="currentColor"/><path d="M12.2 7v11.5M19.8 7v11.5" stroke="' + INK + '" stroke-width="1.2" opacity=".6"/><rect x="2" y="18.5" width="28" height="4" rx="1" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="8.5" cy="25.5" r="4"/><circle cx="23.5" cy="25.5" r="4"/></g><circle cx="8.5" cy="25.5" r="1.2" fill="currentColor"/><circle cx="23.5" cy="25.5" r="1.2" fill="currentColor"/></svg>',
  // a strongbox with its lock
  lockbox: '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M4 12.2V9.6Q4 6 7.6 6h12.8Q24 6 24 9.6v2.6z" fill="currentColor"/><rect x="4" y="13.4" width="20" height="10.6" rx="1.4" fill="currentColor"/><path d="M8.6 6v18M19.4 6v18" stroke="' + INK + '" stroke-width="1.5" opacity=".55"/><rect x="11.4" y="10" width="5.2" height="7.4" rx="1.1" fill="' + INK + '"/><circle cx="14" cy="12.9" r="1.15" fill="currentColor"/><path d="M14 13.6v2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>',
  // a deer's head and antlers
  deer: '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 12.5C10 10.5 8.6 7.5 8.4 3M9.2 7.2L5.4 5.6M10.6 10L6.8 10.4"/><path d="M18.8 12.5c3.2-2 4.6-5 4.8-9.5M22.8 7.2l3.8-1.6M21.4 10l3.8.4"/></g><ellipse cx="10.4" cy="14.6" rx="3.2" ry="1.6" transform="rotate(-24 10.4 14.6)" fill="currentColor"/><ellipse cx="21.6" cy="14.6" rx="3.2" ry="1.6" transform="rotate(24 21.6 14.6)" fill="currentColor"/><path d="M12.4 13.2h7.2c.4 4-.6 9-1.8 12.4-.5 1.4-1.1 2.2-1.8 2.2s-1.3-.8-1.8-2.2c-1.2-3.4-2.2-8.4-1.8-12.4z" fill="currentColor"/><circle cx="14" cy="17" r=".95" fill="' + INK + '"/><circle cx="18" cy="17" r=".95" fill="' + INK + '"/><ellipse cx="16" cy="26.4" rx="1.3" ry=".9" fill="' + INK + '"/></svg>',
  // a fish
  fish: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2.5 16c3.6-6 11.6-8.4 18.6-4.2l6.4-5.3v19l-6.4-5.3C14.1 24.4 6.1 22 2.5 16z" fill="currentColor"/><circle cx="8.6" cy="14.6" r="1.3" fill="' + INK + '"/><path d="M13 11.4c1.4 3 1.4 6.2 0 9.2" fill="none" stroke="' + INK + '" stroke-width="1.2" stroke-linecap="round" opacity=".6"/></svg>',
  // a woolly sheep
  sheep: '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="currentColor"><rect x="11" y="20" width="2.4" height="8" rx="1"/><rect x="21" y="20" width="2.4" height="8" rx="1"/><circle cx="13" cy="13" r="5"/><circle cx="19" cy="11.6" r="5.2"/><circle cx="24.6" cy="14.6" r="4.6"/><circle cx="16.4" cy="18.4" r="5"/><circle cx="23" cy="19.4" r="4.4"/><circle cx="11.6" cy="18.6" r="4"/></g><path d="M3.2 13.6c0-2.6 1.8-4.2 3.8-4.2s3.6 1.6 3.6 4.2-1.4 5.2-3.6 5.2-3.8-2.6-3.8-5.2z" fill="currentColor" stroke="' + INK + '" stroke-width="1.2"/><circle cx="5.8" cy="13.4" r=".9" fill="' + INK + '"/></svg>',
  // a pig with a curly tail
  pig: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M27.4 13.6c2.2-.4 2.6 1.8.8 2.2-1.4.3-1.2-1.4.2-1.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><g fill="currentColor"><rect x="9" y="20" width="3" height="7" rx="1.2"/><rect x="21" y="20" width="3" height="7" rx="1.2"/><ellipse cx="16.6" cy="16.2" rx="11" ry="7.8"/><path d="M8.6 9.6l1.2-5 4 3.6z"/></g><ellipse cx="4.6" cy="17.2" rx="2.6" ry="3" fill="currentColor" stroke="' + INK + '" stroke-width="1.1"/><circle cx="4" cy="16.4" r=".6" fill="' + INK + '"/><circle cx="4" cy="18.2" r=".6" fill="' + INK + '"/><circle cx="9.6" cy="13.4" r="1" fill="' + INK + '"/></svg>',
  // a bottle on the fence
  bottle: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13.2 2.5h5.6v5.2c0 2 4.2 3.2 4.2 7.4v12c0 1.2-.9 2.2-2.1 2.2h-9.8c-1.2 0-2.1-1-2.1-2.2v-12c0-4.2 4.2-5.4 4.2-7.4z" fill="currentColor"/><rect x="9" y="16" width="14" height="7" rx="1" fill="' + INK + '" opacity=".75"/><path d="M12.6 19.5h6.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  // a loot sack with a dollar sign
  sack: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11.4 3.6c2.6-1 6.6-1 9.2 0l-2 4.4c5 2 8.4 7.4 8.4 12.6 0 5.6-4.4 8.8-11 8.8s-11-3.2-11-8.8c0-5.2 3.4-10.6 8.4-12.6z" fill="currentColor"/><path d="M12 8.4h8" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/><text x="16" y="25" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="11" fill="' + INK + '">$</text></svg>',
  // the general store: a false front, an awning and a door
  store: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 4h22v7H5z" fill="currentColor"/><path d="M8 7.5h16" stroke="' + INK + '" stroke-width="1.4" stroke-linecap="round" opacity=".7"/><path d="M3 12h26l-1.6 4.4H4.6z" fill="currentColor"/><path d="M8.2 12l-.6 4.4M13.4 12l-.3 4.4M18.6 12l.3 4.4M23.8 12l.6 4.4" stroke="' + INK + '" stroke-width="1.3"/><rect x="5" y="17.6" width="22" height="11.4" fill="currentColor"/><rect x="13" y="20" width="6" height="9" rx=".6" fill="' + INK + '"/><rect x="7" y="20" width="4" height="4.4" fill="' + INK + '" opacity=".7"/><rect x="21" y="20" width="4" height="4.4" fill="' + INK + '" opacity=".7"/></svg>',
  // a wooden crate
  crate: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="5" width="24" height="23" rx="1.4" fill="currentColor"/><g stroke="' + INK + '" stroke-width="1.4" fill="none" opacity=".7"><rect x="7" y="8" width="18" height="17"/><path d="M7 8l18 17M4 16.5h3M25 16.5h3"/></g></svg>',
  // a windmill on its tower
  windmill: '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M13.6 13.6L10 29.5M18.4 13.6L22 29.5M11.3 24h9.4M12.4 19h7.2M11.3 24l8.3-5M20.7 24l-8.3-5"/></g><g fill="currentColor"><path d="M16 10.4L14.6 1.8h2.8z"/><path d="M16 10.4l8.6-1.4v2.8z"/><path d="M16 10.4l1.4 8.6h-2.8z" opacity=".9"/><path d="M16 10.4L7.4 11.8V9z"/><circle cx="16" cy="10.4" r="2"/></g><circle cx="16" cy="10.4" r=".8" fill="' + INK + '"/></svg>',
};
export function picSVG(key) { return PIC[key] || PIC.cow; }

const ICON = {
  close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.6l3.1 3.1L13 4.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // a map pin: you are here
  pin: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 15s5-5.2 5-8.7A5 5 0 0 0 3 6.3C3 9.8 8 15 8 15z" fill="currentColor"/><circle cx="8" cy="6.3" r="1.9" fill="' + INK + '"/></svg>',
  // a compass: the game finds the level by itself
  compass: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.6 8.4l-2.2 5-5 2.2 2.2-5z" fill="currentColor"/></svg>',
  // two curved arrows: new examples
  shuffle: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 6.2A5.4 5.4 0 0 0 3.4 5M2.8 9.8a5.4 5.4 0 0 0 9.8 1.2"/><path d="M13.6 2.6v3.8H9.8M2.4 13.4V9.6h3.8"/></svg>',
  flag: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 14.5V1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M4.4 2.2h8.4l-2.2 3.2 2.2 3.2H4.4z" fill="currentColor"/></svg>',
  info: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 7.2v4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="4.8" r="1.1" fill="currentColor"/></svg>',
};

// ---- the words (pure) ----------------------------------------------------------------------------------------------

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const and = (list) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
// level numbers as short runs: [1, 2, 3, 7] -> '1–3 and 7'
export function runs(nums) {
  const a = [...new Set(nums)].sort((x, y) => x - y), out = [];
  for (let i = 0; i < a.length; i++) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
    out.push(j > i + 1 ? `${a[i]}–${a[j]}` : j === i + 1 ? `${a[i]}, ${a[j]}` : `${a[i]}`);
    i = j;
  }
  return and(out);
}
const jobsOf = (P) => (P.job == null ? [] : Array.isArray(P.job) ? P.job : [P.job]);
const jobName = (id) => { const m = MISSIONS.find((x) => x.id === id); return m ? m.name : id; };
// the place a job belongs to (the pause menu opens the levels page on the job being played): 'hunt' -> 'deer'
const JOB_PLACE = { boxes: 'lockbox', lockbox: 'lockbox', shoot: 'range', delivery: 'deliveries', windmill: 'building', bridge: 'building' };
export function placeOfJob(jobId) {
  if (!jobId) return null;
  if (PLACE[jobId]) return jobId;
  if (JOB_PLACE[jobId]) return JOB_PLACE[jobId];
  const P = PLACES.find((x) => jobsOf(x).includes(jobId));
  return P ? P.id : null;
}

// What the grown-ups have set for a place, in plain words (always shown, so the page never hides a setting).
export function settingsWords(rider, placeId) {
  const P = PLACE[placeId];
  if (!P) return '';
  const s = stateOf(rider, placeId), n = P.levels.length;
  const off = s ? s.off : [];
  const nums = off.map((id) => P.levels.findIndex((L) => L.id === id) + 1).filter((k) => k > 0);
  const parts = [nums.length
    ? `${n - nums.length} of ${n} levels on: level${nums.length === 1 ? '' : 's'} ${runs(nums)} skipped.`
    : `All ${n} levels on: the game moves you up and down by itself.`];
  if (s && s.start) {
    const k = P.levels.findIndex((L) => L.id === s.start);
    if (k >= 0) parts.push(`Started at level ${k + 1} with “Start here”.`);
  }
  const offJobs = jobsOf(P).filter((j) => !jobOn(rider, j));
  if (offJobs.length) parts.push(`${and(offJobs.map((j, k) => (k ? jobName(j).replace(/^The /, 'the ') : jobName(j))))} ${offJobs.length === 1 ? 'is' : 'are'} switched off in the Jobs list.`);
  return parts.join(' ');
}

// Where the rider is in a place, in plain words.
export function statusWords(rider, placeId) {
  const P = PLACE[placeId];
  if (!P) return '';
  const s = stateOf(rider, placeId), n = P.levels.length;
  if (!s) {
    const id = seedLevel(rider, placeId), k = P.levels.findIndex((L) => L.id === id);
    return `Not played yet. You’d start at level ${k + 1} of ${n}: ${P.levels[k].title}.`;
  }
  const k = P.levels.findIndex((L) => L.id === s.id), L = P.levels[k];
  if (!s.placed) return `Finding your level: trying level ${k + 1} of ${n}, ${L.title}. Each right answer tries the next level up.`;
  const count = Math.max(1, Math.round(L.count || 5)), into = Math.floor(s.into);
  if (k === n - 1) return `You’re on the top level, ${k + 1} of ${n}: ${L.title}.`;
  return `You’re on level ${k + 1} of ${n}: ${L.title}. ${into} of ${count} right answers toward level ${k + 2}.`;
}

// Every place's settings that differ from "all on", in one short line (the title's panel and the Grown-ups corner):
// 'Lock boxes: levels 1–3 skipped · Round-up: started at level 9', or '' when everything is as it starts.
export function gridWords(rider) {
  const out = [];
  for (const P of PLACES) {
    const s = stateOf(rider, P.id);
    if (!s) continue;
    const bits = [];
    const nums = s.off.map((id) => P.levels.findIndex((L) => L.id === id) + 1).filter((k) => k > 0);
    if (nums.length) bits.push(`level${nums.length === 1 ? '' : 's'} ${runs(nums)} skipped`);
    if (s.start) { const k = P.levels.findIndex((L) => L.id === s.start); if (k >= 0) bits.push(`started at level ${k + 1}`); }
    if (bits.length) out.push(`${P.short}: ${bits.join(', ')}`);
  }
  return out.join(' · ');
}

// Everything the page draws for one place. seed: which examples (the same seed, the same examples); n: examples a level.
export function placeView(rider, placeId, { seed = 1, n = 3 } = {}) {
  const P = PLACE[placeId];
  if (!P) return null;
  const s = stateOf(rider, placeId);
  const here = s ? s.id : seedLevel(rider, placeId);
  const hereI = P.levels.findIndex((L) => L.id === here);
  const on = new Set(onIds(rider, placeId));
  const rows = P.levels.map((L, i) => ({
    i, n: i + 1, id: L.id, title: L.title, line: L.line, read: !!L.read,
    on: on.has(L.id), here: i === hereI, start: !!(s && s.start === L.id),
    examples: examplesOf(placeId, L.id, { n, seed: seed + i }),
  }));
  const L = P.levels[hereI];
  return {
    id: P.id, name: P.name, short: P.short, math: P.math, line: P.line, pic: P.pic,
    met: !!s, placing: !!(s && !s.placed), pct: s ? pctOf(rider, placeId) : null, wouldPct: s ? null : levelPct(placeId, here, 0),
    here, hereI, hereTitle: L.title, into: s ? s.into : 0, count: Math.max(1, Math.round(L.count || 5)),
    offCount: P.levels.length - on.size, start: s ? s.start : null,
    jobsOff: jobsOf(P).filter((j) => !jobOn(rider, j)).map(jobName),
    counts: (() => { const c = [...new Set(P.levels.map((x) => Math.max(1, Math.round(x.count || 5))))].sort((a, b) => a - b); return c.length > 1 ? `${c[0]} to ${c[c.length - 1]}` : String(c[0]); })(),
    status: statusWords(rider, placeId), settings: settingsWords(rider, placeId), rows,
  };
}

// the place the rider played last (the page opens there), else the first place
function lastPlace(rider) {
  let best = null, t = 0;
  for (const P of PLACES) { const s = stateOf(rider, P.id); if (s && s.last > t) { t = s.last; best = P.id; } }
  return best || (PLACES[0] && PLACES[0].id);
}

// ---- the page ------------------------------------------------------------------------------------------------------

// the stylesheet, added once; done() runs once it has loaded (at once if it already has)
function ensureCss(done = () => {}) {
  if (typeof document === 'undefined') return;
  const href = new URL('./levels.css', import.meta.url).href;
  let link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((l) => l.href === href);
  if (link && link.sheet) { done(); return; }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    document.head.appendChild(link);
  }
  link.addEventListener('load', done, { once: true });
}

export function openLevels(root, rider, opts = {}) {
  root = root || document.body;
  const onClose = typeof opts.onClose === 'function' ? opts.onClose : () => {};
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};
  const speak = typeof opts.speak === 'function' ? opts.speak : null;
  const back = document.activeElement;
  const S = {
    place: PLACE[opts.place] ? opts.place : PLACE[placeOfJob(opts.place)] ? placeOfJob(opts.place) : lastPlace(rider),
    seed: 1 + Math.floor(Math.random() * 100000),   // (fresh examples every time the page opens)
    note: null,       // { place, text, undo: snapshot } a line under the settings after a change (with Undo for Start here)
    open: new Set(),  // examples opened out in full (long word problems are cut to three lines)
  };
  let closed = false;

  const el = document.createElement('div');
  el.className = 'bmlv';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', `${rider && rider.name ? rider.name : 'Rider'}'s levels`);
  root.appendChild(el);
  ensureCss(() => { if (!closed) centerTab(); });   // (the tab strip's layout is known once the sheet is in)

  function tabsHTML() {
    return PLACES.map((P) => {
      const pct = pctOf(rider, P.id), sel = P.id === S.place;
      return `<button type="button" class="bmlv-tab" role="tab" id="bmlv-tab-${P.id}" aria-selected="${sel}" aria-controls="bmlv-place" tabindex="${sel ? 0 : -1}"
          data-do="tab" data-id="${P.id}" title="${esc(P.name)}: ${esc(P.math)}">
        <span class="bmlv-pic">${picSVG(P.pic)}</span><span class="bmlv-tname">${esc(P.short)}</span>
        <span class="bmlv-tpct">${pct == null ? 'new' : `${pct}%`}</span></button>`;
    }).join('');
  }

  function rowHTML(v, x) {
    const ex = x.examples.map((e, k) => {
      const key = `${v.id}/${x.id}/${k}`;
      return `<li class="bmlv-ex${S.open.has(key) ? ' is-open' : ''}" data-do="ex" data-key="${esc(key)}"><span class="bmlv-q">${esc(e.q)}</span><span class="bmlv-a">${esc(e.a)}</span></li>`;
    }).join('');
    const hereTag = x.here
      ? `<span class="bmlv-here">${ICON.pin}${v.met ? (v.placing ? 'Finding your level here' : 'You are here') : 'You’d start here'}</span>` : '';
    const prog = x.here && v.met && !v.placing
      ? `<span class="bmlv-prog" aria-label="${Math.floor(v.into)} of ${v.count} right toward the next level">${Array.from({ length: v.count }, (_, k) => `<i class="${k < Math.floor(v.into) ? 'on' : ''}"></i>`).join('')}</span>` : '';
    const startBtn = x.here && v.met && !v.placing ? ''
      : `<button type="button" class="bmlv-start" data-do="start" data-id="${x.id}" aria-label="Start here: level ${x.n}, ${esc(x.title)}">${ICON.flag}Start here</button>`;
    return `<li class="bmlv-row${x.here ? ' is-here' : ''}${x.on ? '' : ' is-off'}" id="bmlv-row-${v.id}-${x.id}">
      <button type="button" class="bmlv-tick" role="checkbox" aria-checked="${x.on}" data-do="tick" data-id="${x.id}"
        aria-label="Level ${x.n}, ${esc(x.title)}: ${x.on ? 'on' : 'skipped'}">${ICON.check}</button>
      <div class="bmlv-info">
        <div class="bmlv-title"><span class="bmlv-n">${x.n}</span><b>${esc(x.title)}</b>${x.on ? '' : '<em class="bmlv-skip">skipped</em>'}${x.start ? '<em class="bmlv-started">started here</em>' : ''}</div>
        <div class="bmlv-line">${esc(x.line)}</div>
        ${hereTag || prog ? `<div class="bmlv-herebox">${hereTag}${prog}</div>` : ''}
      </div>
      <ul class="bmlv-exs" aria-label="Examples">${ex}</ul>
      ${startBtn}
    </li>`;
  }

  function placeHTML() {
    const v = placeView(rider, S.place, { seed: S.seed });
    const i = PLACES.findIndex((P) => P.id === S.place);
    const prev = PLACES[(i - 1 + PLACES.length) % PLACES.length], next = PLACES[(i + 1) % PLACES.length];
    const pct = v.pct == null ? null : v.pct;
    const note = S.note && S.note.place === v.id
      ? `<p class="bmlv-note" role="status">${esc(S.note.text)}${S.note.undo !== undefined ? ' <button type="button" class="bmlv-undo" data-do="undo">Undo</button>' : ''}</p>` : '';
    return `
      <div class="bmlv-phead">
        <button type="button" class="bmlv-arrow" data-do="tab" data-dir="prev" data-id="${prev.id}" aria-label="Before: ${esc(prev.name)}">${ICON.prev}</button>
        <span class="bmlv-bigpic">${picSVG(v.pic)}</span>
        <div class="bmlv-pname"><h3>${esc(v.name)}</h3><span class="bmlv-math">${esc(v.math)}</span></div>
        <button type="button" class="bmlv-arrow" data-do="tab" data-dir="next" data-id="${next.id}" aria-label="Next: ${esc(next.name)}">${ICON.next}</button>
      </div>
      <p class="bmlv-pline">${esc(v.line)}</p>
      <div class="bmlv-where">
        <div class="bmlv-pct"><b>${pct == null ? '–' : `${pct}%`}</b><small>${pct == null ? 'not played yet' : v.placing ? 'finding your level' : 'up this ladder'}</small></div>
        <div class="bmlv-wbar" aria-hidden="true"><i style="width:${pct == null ? 0 : pct}%"></i>${pct == null ? `<i class="would" style="left:${v.wouldPct}%"></i>` : ''}</div>
        <p class="bmlv-status">${v.placing ? ICON.compass : ICON.pin}<span>${esc(v.status)}</span></p>
      </div>
      <div class="bmlv-settings${v.offCount || v.start || v.jobsOff.length ? ' is-set' : ''}">
        <p><b>Settings:</b> ${esc(v.settings)}</p>
        <div class="bmlv-sbtns">
          ${v.offCount ? '<button type="button" class="bmlv-chip" data-do="allon">Turn every level on</button>' : ''}
          <button type="button" class="bmlv-chip" data-do="here">${ICON.pin}Where am I?</button>
          <button type="button" class="bmlv-chip" data-do="more">${ICON.shuffle}New examples</button>
        </div>
        ${note}
      </div>
      <p class="bmlv-how">Every tick on: the game moves you up a level after ${v.counts} right answers and back a little after a miss, so about 4 answers in 5 are right. Untick a level to skip it. “Start here” puts you straight on a level.</p>
      <ol class="bmlv-rows" aria-label="${esc(v.name)} levels, easiest first">${v.rows.map((x) => rowHTML(v, x)).join('')}</ol>`;
  }

  // top: a new place (the card scrolled back to its top, under the tabs); else the reader's place in the list is kept
  function draw({ top = false, focus = null } = {}) {
    const card = el.querySelector('.bmlv-card');
    const keep = card && !top ? card.scrollTop : 0;
    el.innerHTML = `<div class="bmlv-card">
      <header class="bmlv-head">
        <div><h2>Levels<span> · ${esc(rider && rider.name ? rider.name : 'Rider')}</span></h2>
          <p>Each place has one kind of math and its own ladder, from kindergarten up.</p></div>
        <button type="button" class="bmlv-x" data-do="close" aria-label="Close">${ICON.close}</button>
      </header>
      <div class="bmlv-tabs" role="tablist" aria-label="Places">${tabsHTML()}</div>
      <section class="bmlv-place" id="bmlv-place" role="tabpanel" aria-labelledby="bmlv-tab-${S.place}">${placeHTML()}</section>
    </div>`;
    const c = el.querySelector('.bmlv-card');
    c.scrollTop = keep;
    centerTab();
    if (focus) { const f = el.querySelector(focus); if (f) f.focus({ preventScroll: true }); }
  }
  // the chosen tab in the middle of the tab strip when it scrolls sideways (a phone): the strip moves, never the page
  function centerTab() {
    const tabs = el.querySelector('.bmlv-tabs'), tab = el.querySelector('.bmlv-tab[aria-selected="true"]');
    if (!tabs || !tab || tabs.scrollWidth <= tabs.clientWidth) return;
    tabs.scrollLeft = tab.getBoundingClientRect().left - tabs.getBoundingClientRect().left + tabs.scrollLeft - (tabs.clientWidth - tab.offsetWidth) / 2;
  }
  // the rider's row brought into view (a little of the row above showing)
  function scrollToHere(smooth = true) {
    const c = el.querySelector('.bmlv-card'), row = el.querySelector('.bmlv-row.is-here');
    if (!c || !row) return;
    const tabs = el.querySelector('.bmlv-tabs');
    const top = row.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - (tabs ? tabs.offsetHeight : 0) - 16;
    c.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
  }

  function changed(text, undo) {
    saveRider(rider);
    S.note = { place: S.place, text, undo };
    try { onChange(rider); } catch (e) { console.error(e); }
  }
  // a copy of the place's saved state (or undefined: not met), for Undo
  const snap = () => { const s = stateOf(rider, S.place); return s ? JSON.parse(JSON.stringify(s)) : null; };

  function act(what, b) {
    const id = b && b.dataset.id;
    const P = PLACE[S.place];
    switch (what) {
      case 'close': close(); return;
      case 'tab': {
        if (!PLACE[id] || id === S.place) return;
        S.place = id; S.note = null;
        draw({ top: true, focus: b.dataset.dir ? `.bmlv-arrow[data-dir="${b.dataset.dir}"]` : `#bmlv-tab-${id}` });
        if (speak) { try { speak(`${PLACE[id].name}. ${PLACE[id].line}`); } catch (e) { /* the voice is a help, never in the way */ } }
        return;
      }
      case 'tick': {
        const L = P.levels.find((x) => x.id === id);
        if (!L) return;
        const k = P.levels.indexOf(L) + 1;
        const was = isOn(rider, S.place, id);
        if (!setOn(rider, S.place, id, !was)) {
          S.note = { place: S.place, text: 'The last level that is on stays on: there has to be something to ask.' };
          draw({ focus: `.bmlv-tick[data-id="${id}"]` });
          return;
        }
        changed(was ? `Level ${k} skipped.` : `Level ${k} is on again.`);
        draw({ focus: `.bmlv-tick[data-id="${id}"]` });
        return;
      }
      case 'allon': {
        if (setAllOn(rider, S.place)) changed('Every level is on: the game moves you up and down by itself.');
        draw({ focus: '[data-do="here"]' });
        return;
      }
      case 'start': {
        const L = P.levels.find((x) => x.id === id);
        if (!L) return;
        const before = snap();
        if (!startHere(rider, S.place, id)) return;
        changed(`Now on level ${P.levels.indexOf(L) + 1}: ${L.title}.`, before);
        draw({ focus: '.bmlv-undo' });
        return;
      }
      case 'undo': {
        if (!S.note || S.note.undo === undefined) return;
        const before = S.note.undo;
        const places = rider.levels && rider.levels.places;
        if (places) { if (before) places[S.place] = before; else delete places[S.place]; }
        changed('Back where you were.');
        S.note.undo = undefined;
        draw({ focus: '[data-do="here"]' });
        return;
      }
      case 'here': scrollToHere(); return;
      case 'more': S.seed += 977; draw({ focus: '[data-do="more"]' }); return;
      case 'ex': {
        const key = b.dataset.key;
        if (S.open.has(key)) S.open.delete(key); else S.open.add(key);
        b.classList.toggle('is-open');
        return;
      }
      default:
    }
  }

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    el.remove();
    try { if (back && back.focus && document.contains(back)) back.focus({ preventScroll: true }); } catch (e) { /* the opener is gone */ }
    try { onClose(); } catch (e) { console.error(e); }
  }
  // Esc closes this page only; arrow keys move between the place tabs
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    const t = e.target;
    if (t && t.classList && t.classList.contains('bmlv-tab') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End')) {
      e.preventDefault(); e.stopPropagation();
      const i = PLACES.findIndex((P) => P.id === S.place);
      const j = e.key === 'Home' ? 0 : e.key === 'End' ? PLACES.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + PLACES.length) % PLACES.length;
      act('tab', { dataset: { id: PLACES[j].id } });
    }
  }
  document.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (e) => {
    if (e.target === el) { close(); return; }
    const b = e.target.closest('[data-do]');
    if (!b || !el.contains(b)) return;
    act(b.dataset.do, b);
  });

  draw({ top: true, focus: '.bmlv-tab[aria-selected="true"]' });
  return {
    el, close,
    show(placeId) { if (PLACE[placeId] && placeId !== S.place) act('tab', { dataset: { id: placeId } }); },
    get place() { return S.place; },
  };
}
