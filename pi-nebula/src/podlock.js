// THE STASIS POD'S LOCK: an equation, Mathwood's lock box as it is. The game's maker (2026-11-19): "I am thinking that
// opening the statis pods on medical missions can be equation solving, like lockboxes." So each pod's lock IS Mathwood's
// lock box (mathwood-valley/src/lockbox/: its ladder of 19 levels, its moves on both sides, its parts asked one at a
// time, its hints, its check, Work it out), shared, not copied: this file only dresses it in this game's look (the dark
// glass with light lines the station's panels have, src/podlock.css) and puts this game's words where the West's were
// (no gold, no sheriff, no saddlebags, no Hob). Opening a pod pays nothing by itself, as every card on a run: the rescue
// is paid by the people brought home (his answer MED-5).
//
// ONE POD, ONE LOCK: the panel opens on the pod's equation; solved and checked, its button opens the pod and the panel
// closes (onOpen), and the pod's own lid swings (the caller's: kit/stasispod.js). "Skip this lock" (after a while, or
// once the answer has been shown) or "Done for now" (Esc) close it with the pod still shut; it can be tried again, a new
// equation at the level then.
//
// Labs only for now (the Planet Lab and the Kit Lab): nothing in the game opens it yet.
//
//   const L = openPodLock(root, { rider, pod: { name, where }, onOpen(result), onClose(totals), saveRider(rider),
//                                 rung, level, debug })
//     rider      the crew member (their levels on the lock boxes' ladder: Mathwood's src/levels/model.js keeps them in
//                rider.levels, as this game's job levels are kept); none: a scratch one (the strands pick the box)
//     pod        what the top strip says: its name ("Stasis pod 2") and the line under it
//     onOpen(r)  the lock solved: the pod opens (r: Mathwood's result: { solved, moves, par, rung, clean, hints })
//     onClose(t) the panel gone, opened or not (t: Mathwood's totals; t.solved)
//     saveRider  saves the rider when its level is stepped with the arrows in the top strip
//     rung, level  (for rigs) one of Mathwood's rungs at a size, as its test page does
//     finish     the words on the button a solved lock brings, in place of "Open the pod" (a pod with a second lock
//                still to come, on a run of the crew member's own: "Next lock": src/rescue.js)
//   L.close(), L.el, L.handle (Mathwood's: debug, workSum, redeal)
//   SPACE_LOOK   the look handed to Mathwood's panel (opts.look), and spaceWords(text) its words
import { openLockbox } from '../../mathwood-valley/src/lockbox/index.js';
import { THINGS, THING_SVG } from '../../mathwood-valley/src/lockbox/kbox.js';
import { openLongWork } from '../../mathwood-valley/src/ui/longwork.js';
import { openOwnSum } from '../../mathwood-valley/src/ui/ownsum.js';
import { workOf } from '../../mathwood-valley/src/math/longwork.js';
import { sound } from './sound.js';
import { makeLockChime } from './sounds.js';

const CSS = new URL('./podlock.css', import.meta.url).href;

// THE WORDS: the few lines of the lock box that belong to the West, as this game says them (everything else it says
// is plain math and stays word for word). A kindergarten box's things: the apples, eggs and carrots stay (the galley
// has them), the horseshoes are bolts and the gold nuggets ore crystals; the sack x stands for is a crate.
const SWAP = [
  [/\bBox jammed\b/g, 'Lock jammed'],
  [/That one goes back in the pile\./g, 'That pod stays shut for now.'],
  [/Dark coins are negative numbers\./g, 'Dark circles are negative numbers.'],
  [/get their own box now/g, 'get their own lock now'],
  [/Back to the box/g, 'Back to the lock'],
  [/\bgold nuggets\b/g, 'ore crystals'], [/\bgold nugget\b/g, 'ore crystal'],
  [/\bhorseshoes\b/g, 'bolts'], [/\bhorseshoe\b/g, 'bolt'],
  [/\bsack\b/g, 'crate'], [/\bSack\b/g, 'Crate'],
];
export function spaceWords(text) {
  let s = String(text);
  for (const [a, b] of SWAP) s = s.replace(a, b);
  return s;
}
// the words that must never show on a pod (the tests read every line through spaceWords)
export const WEST_WORDS = /\b(gold|nuggets?|sheriff|saddlebags?|horseshoes?|sack|Hob|coins?|pile)\b/i;

// THE DRAWINGS, in light lines on the dark (the station's look: off-white and light blue lines, one orange accent)
const LINE = '#bfe3ff', DIM = '#6f9fc4', ACC = '#ff8f2e';
// the lock's own screen, where Hob's face was: a small round screen with a padlock on it
const FACE = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#0d141c"/><circle cx="24" cy="24" r="20.5" fill="none" stroke="${DIM}" stroke-width="1.5"/>
<path d="M17.5 22v-4a6.5 6.5 0 0 1 13 0v4" fill="none" stroke="${LINE}" stroke-width="2.4"/><rect x="14.5" y="22" width="19" height="14" rx="2" fill="none" stroke="${LINE}" stroke-width="2.4"/><circle cx="24" cy="28" r="2" fill="${ACC}"/></svg>`;
// a crate, for x in the picture row (the West's saddlebag) and in a kindergarten box (its sack)
const crate = (s, w) => `<path d="M${s * 0.16} ${s * 0.3}h${s * 0.68}v${s * 0.56}h-${s * 0.68}z" fill="#16222e" stroke="${LINE}" stroke-width="${w}" stroke-linejoin="round"/>
<path d="M${s * 0.16} ${s * 0.3}l${s * 0.08}-${s * 0.12}h${s * 0.52}l${s * 0.08} ${s * 0.12}" fill="#1d2c3a" stroke="${LINE}" stroke-width="${w}" stroke-linejoin="round"/>
<path d="M${s * 0.16} ${s * 0.44}h${s * 0.68}M${s * 0.16} ${s * 0.72}h${s * 0.68}" stroke="${DIM}" stroke-width="${w * 0.7}"/>`;
const BAG = `<svg viewBox="0 0 32 32" aria-hidden="true">${crate(32, 1.6)}</svg>`;
const SACK = `<svg viewBox="0 0 64 64" aria-hidden="true">${crate(64, 2.4)}</svg>`;
// an ore crystal, for 1 in the picture row (the West's nugget)
const CRYSTAL = (s) => `<svg viewBox="0 0 ${s} ${s}" aria-hidden="true"><path d="M${s * 0.5} ${s * 0.06}L${s * 0.84} ${s * 0.42}L${s * 0.5} ${s * 0.94}L${s * 0.16} ${s * 0.42}z" fill="#2a6f9e" stroke="${LINE}" stroke-width="${s / 16}" stroke-linejoin="round"/><path d="M${s * 0.16} ${s * 0.42}h${s * 0.68}M${s * 0.5} ${s * 0.06}v${s * 0.88}" stroke="#9fd6ff" stroke-width="${s / 32}" opacity="0.7"/></svg>`;
const BOLT = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 5h14l3 5-3 5H9l-3-5z" fill="#8d99a6" stroke="#2c3540" stroke-width="1.3" stroke-linejoin="round"/><rect x="12.5" y="15" width="7" height="13" rx="1" fill="#a9b4bf" stroke="#2c3540" stroke-width="1.2"/><path d="M12.5 18.5h7M12.5 21.5h7M12.5 24.5h7" stroke="#2c3540" stroke-width="1.1"/></svg>`;
const THINGS_SPACE = { ...THING_SVG, horseshoe: BOLT, nugget: CRYSTAL(32) };
// what shows as the lock opens (the West's chest): the pod's padlock, its shackle up, lit
const OPENED = `<svg viewBox="0 0 240 190" class="pl-open" aria-hidden="true">
  <circle cx="120" cy="104" r="70" fill="none" stroke="${DIM}" stroke-width="2" stroke-dasharray="6 7" class="pl-ring"/>
  <path d="M92 96 V66 a28 28 0 0 1 56 0 V74" fill="none" stroke="${LINE}" stroke-width="9" stroke-linecap="round" class="pl-shackle"/>
  <rect x="80" y="96" width="80" height="62" rx="8" fill="#101a24" stroke="${LINE}" stroke-width="5"/>
  <circle cx="120" cy="122" r="8" fill="${ACC}"/><rect x="117" y="126" width="6" height="16" rx="2" fill="${ACC}"/></svg>`;

export const SPACE_LOOK = {
  cls: 'lbx-space', css: CSS,
  title: (info) => (info && info.name) || 'Stasis pod',
  where: (info) => (info && info.where) || 'Its lock',
  say: spaceWords,
  helper: 'Help', skip: 'Skip this lock', finish: 'Open the pod',
  face: FACE, bag: BAG, nugget: CRYSTAL(16), sack: SACK, things: THINGS_SPACE, reward: OPENED,
  pay: false, opened: 'The lock opens',
};
// (every kindergarten thing has its drawing)
export const SPACE_THINGS = THINGS.map((t) => [t, !!THINGS_SPACE[t]]);

// THE LABS' MEDIC: a crew member of the labs' own, whose level on the ladder is kept in this browser (the arrows in the
// lock's top strip step it; Mathwood's levels find it by itself at first) -> { rider, save(rider) }
const LAB_KEY = 'pi-nebula.podlock.medic';
export function labMedic() {
  let rider = null;
  try { rider = JSON.parse(localStorage.getItem(LAB_KEY)); } catch (e) { /* none kept */ }
  if (!rider || typeof rider !== 'object' || rider.id !== 'pod-lab') rider = { id: 'pod-lab', name: 'Medic' };
  return { rider, save: (r) => { try { localStorage.setItem(LAB_KEY, JSON.stringify(r)); } catch (e) { /* blocked: not kept */ } } };
}

export function openPodLock(root = document.body, { rider = null, pod = {}, onOpen = () => {}, onClose = () => {}, saveRider = null, rung, level, size, debug = false, finish = null } = {}) {
  let sheet = null, opened = false;
  const chime = makeLockChime(sound);
  // WORK IT OUT, as Mathwood's tools do it over the box: the part being asked in columns (its own sheet, longwork.js),
  // or, between parts (nothing to work out on screen), the entry to type a sum by hand
  function openOwn() {
    sheet = openOwnSum(document.body, { free: true, top: true,
      onWork: (mine) => { const p = sheet; sheet = null; if (p) p.close(); openWork(mine, true); },
      onClose: () => { sheet = null; } });
  }
  function openWork(s, mine = false) {
    let work = null, chain = null;
    try {
      if (s.chain) chain = s.chain.map((x) => ({ work: workOf(x), sum: x, say: x.say || '', carried: x.carried || null }));
      else work = workOf(s);
    } catch (e) { console.warn(e); }
    if (chain ? chain.some((x) => !x.work) : !work) { openOwn(); return; }
    sheet = openLongWork(document.body, { work, chain, title: 'Work it out', ask: mine ? 'Your own sum' : s.ask || '', closeLabel: 'Close', free: true, top: true, stay: true,
      onOwn: () => { const p = sheet; sheet = null; if (p) p.close(); openOwn(); },
      onClose: () => { sheet = null; }, onGone: () => { sheet = null; } });
  }
  const closeSheet = () => { if (sheet) { try { sheet.close(); } catch (e) { /* gone */ } sheet = null; } };
  const handle = openLockbox(root, {
    rider, box: { tier: 'iron', from: 'pod', name: pod.name, where: pod.where }, one: true, look: finish ? { ...SPACE_LOOK, finish } : SPACE_LOOK, debug,
    ...(rung ? { rung, level: level ?? 4, size: size ?? 2 } : {}),
    saveRider: (r) => { if (typeof saveRider === 'function') saveRider(r); },
    workOut: () => { closeSheet(); const s = handle.workSum(); if (s) openWork(s); else openOwn(); },
    toolsOpen: () => !!sheet && !!document.querySelector('.bml:not(.is-out), .bmo.is-on'),
    // (the chime for a right answer, once for this lock: at the moment its last answer is judged right; or, closed so
    // quickly the box never said so, as it opens: src/sounds.js makeLockChime)
    onSolved: () => chime.solved(),
    onBox: (res) => { if (res.solved && !opened) { opened = true; chime.opened(); try { onOpen(res); } catch (e) { console.error(e); } } },
    onDone: (totals) => { closeSheet(); try { onClose(totals); } catch (e) { console.error(e); } },
  });
  return { el: handle.el, handle, close: () => handle.close() };
}
