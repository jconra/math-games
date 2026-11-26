// THE MUSIC'S SCREEN: its picture, and its controls. The game's maker, 2026-11-24: "Maybe have a few screens around
// the station that interface with it to change the song, or modify the song. Such as select the lead, pads, bass, bpm,
// melodies, beat. But we can have a few presets", "So the screens can show visualizations and then if you interact with
// it then it shows the controls". 2026-11-26: "I think the wall screens should always show the music visualization (And
// maybe say "Music" on the top) ... But the controls shouldn't show up until you interact with the screen. Then the
// controls should all fit nicely, Maybe they should have some color too that corresponds to the colors the instruments
// have been given in the displays too", "I don't want the controls to wrap around", and of the Music Lab: "I'd prefer to
// just have the visualization and the controls on the same page ... Instead of "show the picture" maybe have a full
// screen button."
//
// THE PICTURE (mountMusicPicture): always the music's picture (src/music/visuals.js), the word MUSIC along its top
// (TITLE: a strip of its own over the picture, so it never covers a note). The game's wall screens paint the same
// picture and title on their faces (src/music/places.js); the Music Lab shows it at the top of its page, with a Full
// screen button (the browser's own full screen where it is allowed, else the whole window; Esc or a tap brings the
// page back).
// THE CONTROLS (mountMusicControls): one designed panel, the same in the game (opened over it from a wall screen) and
// in the lab (always on its page): the presets as their own grid; each part a block of one shape in its instrument's
// colour (its name, a bar, its chosen button), its volume beside its name, its choices and Off, and its one extra (the
// bass's Rolling, the Random of pads, lead and melody) on a fixed grid; the speed, the Picture row, the Hallway lights;
// the bar's steps. Nothing wraps by chance: every button is one line high and never breaks its words; the panel lays
// itself out by its own width (a container query): two columns when it is 700 px wide or more (the presets and the
// rest on the left, the five parts on the right, each part's choices in one row), one column below that (each part's
// choices in two rows of four). A chosen button is the part's colour, and a thicker edge and bold words besides.
//
//   const P = mountMusicPicture(el, music, { link, fps, full })
//       link    screenLink(): which picture (shared with the controls)
//       fps     at most this many pictures a second (0: every frame the page draws)
//       full    true: a Full screen button on it (the lab)
//   P.stats { paints, ms, errors, error, gl }, P.glView(), P.destroy()
//   const C = mountMusicControls(el, music, { heardIn, notes, keep, link, play, hallway, onSong, done })
//       heardIn  the lab's "Heard in" row; notes: the lab's "Notes: Live / Pre-rendered" row
//       keep     the key the song, the place and the picture are kept under in this browser ('' or false: not kept)
//       play     false: no Play / Stop (the game: the HUD's mute rules the music)
//       hallway  { on(), set(on) }: the Hallway lights row (the game's hallway lines)
//       onSong   called with the song after each change made here (the game keeps it, src/music/game.js)
//       done     a function: a Done button (and Esc, the game's own way out) that calls it
//   C.destroy()
//   screenLink({ picture }) -> { picture, pick(id), fans }   the picture picked, shared by a picture and its controls
//   WALL       the wall screen's shape, cm; TITLE: the title strip's share of the screen's height, and its word
// A picture with a shader (Hex, src/music/hex.js) is drawn by WebGL on a second canvas (src/music/electricview.js,
// loaded the first time it is shown); with no WebGL, a shader that will not build, or the context lost, the picture
// paints Notes instead and goes on. Nothing is painted while the page is hidden.
import { PARTS, PRESETS, BPM, VOL, volOf, volsOf, songText, cleanSong, checkSong, numberOf, numbersOf, freshNumber } from './song.js';
import { PLACES } from './player.js';
import { tapOf } from './tap.js';
import { VISUALS, visualOf, PART_COLOURS } from './visuals.js';

export const WALL = { w: 46, h: 25 };
export const TITLE = { share: 0.12, word: 'MUSIC' };
// (a preset's name on its button where the whole name will not sit on one line)
const SHORT = { joeclarkremix: 'Joe Clark Remix' };

const CSS = `
.pnm, .pnp { --ink: #eef1f4; --dim: #a7b0ba; --cyan: #8fd3ff; --line: rgba(150, 210, 250, 0.36); --cut: 12px;
  --oct: polygon(var(--cut) 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, var(--cut) 100%, 0 calc(100% - var(--cut)), 0 var(--cut));
  font: 400 13px/1.2 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: var(--ink);
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; box-sizing: border-box; }
.pnm *, .pnp * { box-sizing: border-box; }
.pnm button, .pnp button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; margin: 0; }
.pnm button:focus-visible { outline: 2px solid var(--cyan); outline-offset: 1px; }
/* the picture: MUSIC along its top, the picture under it */
.pnp { position: relative; width: 100%; aspect-ratio: 46 / 25; background: #070b11; box-shadow: inset 0 0 0 2px rgba(150, 210, 250, 0.45); clip-path: var(--oct); overflow: hidden; }
.pnp-title { position: absolute; left: 0; right: 0; top: 0; height: ${TITLE.share * 100}%; display: flex; align-items: center; justify-content: center;
  background: #0b1119; border-bottom: 1px solid rgba(150, 210, 250, 0.25); color: #8fd3ff; font-weight: 700; letter-spacing: 0.32em; font-size: clamp(9px, 2.6cqw, 22px); }
.pnp { container-type: inline-size; }
.pnp canvas { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: ${(1 - TITLE.share) * 100}%; display: block; }
.pnp canvas[hidden] { display: none; }
.pnp-full { position: absolute; right: 10px; bottom: 10px; z-index: 2; height: 30px; padding: 0 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; font-size: 12px;
  background: rgba(12, 16, 22, 0.8) !important; box-shadow: inset 0 0 0 1px var(--line); clip-path: var(--oct); --cut: 7px; white-space: nowrap; }
.pnp.is-full { position: fixed; inset: 0; z-index: 1000; width: 100vw; height: 100vh; aspect-ratio: auto; clip-path: none; }
.pnp.is-full .pnp-full { display: none; }
.pnp:fullscreen { width: 100vw; height: 100vh; aspect-ratio: auto; clip-path: none; }
.pnp:fullscreen .pnp-full { display: none; }
/* the controls */
.pnm-box { container-type: inline-size; width: 100%; }
.pnm { width: 100%; padding: 10px 12px 12px; background: rgba(12, 16, 22, 0.95); box-shadow: inset 0 0 0 2px rgba(150, 210, 250, 0.7); clip-path: var(--oct); --cut: 14px; }
.pnm-top { display: flex; align-items: center; gap: 10px; height: 32px; padding-bottom: 6px; margin-bottom: 8px; border-bottom: 1px solid var(--line); }
.pnm-top b { font-size: 16px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cyan); }
.pnm-top small { flex: 1; min-width: 0; font-size: 13px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pnm-done { flex: none; height: 30px; padding: 0 14px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #06202e !important; background: var(--cyan) !important; clip-path: var(--oct); --cut: 7px; white-space: nowrap; }
.pnm-done kbd { font: 700 10px/1 inherit; font-family: inherit; padding: 2px 4px; margin-left: 6px; border-radius: 3px; background: rgba(0, 0, 0, 0.18); }
@media (hover: none) and (pointer: coarse) { .pnm-done kbd { display: none; } }
.pnm-main { display: grid; grid-template-columns: 100%; grid-template-areas: "a" "p" "b"; gap: 8px; }
.pnm-a { grid-area: a; } .pnm-parts { grid-area: p; display: grid; gap: 6px; } .pnm-b { grid-area: b; display: grid; gap: 6px; align-content: start; }
.pnm-btn { display: flex; align-items: center; justify-content: center; gap: 5px; height: 30px; min-width: 0; padding: 0 3px; white-space: nowrap; overflow: hidden;
  background: rgba(150, 210, 250, 0.06) !important; box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.22); clip-path: var(--oct); --cut: 6px; }
.pnm-btn:hover { box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.55); }
.pnm-btn.is-on { background: rgba(150, 210, 250, 0.2) !important; box-shadow: inset 0 0 0 2px var(--cyan); color: #fff; }
.pnm-preset.is-on { font-weight: 800; }
.pnm-presets { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
.pnm-preset { font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; font-size: 12px; }
/* a part: a bar and its name in its colour, its volume beside the name, its choices on a fixed grid */
.pnm-part { --pc: #8fd3ff; display: grid; grid-template-columns: 4px minmax(0, 1fr); column-gap: 8px; }
.pnm-part > i { grid-row: 1 / span 2; background: var(--pc); border-radius: 2px; }
.pnm-ph { display: flex; align-items: center; gap: 6px; height: 22px; }
.pnm-ph .pnm-name { flex: 1; min-width: 0; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--pc); white-space: nowrap; }
.pnm-vol { display: flex; align-items: center; gap: 2px; }
.pnm-vol .pnm-btn { width: 26px; height: 22px; padding: 0; font-size: 16px; font-weight: 700; --cut: 5px; }
.pnm-vol output { width: 22px; text-align: center; font-weight: 700; }
.pnm-vol output.is-moved { color: var(--pc); }
.pnm-ch { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: 30px 30px; gap: 4px; margin-top: 3px; }
.pnm-ch .pnm-x { grid-column: span 2; }
.pnm-part .pnm-btn.is-on { background: color-mix(in srgb, var(--pc) 30%, rgba(12, 16, 22, 0.9)) !important; box-shadow: inset 0 0 0 2px var(--pc); color: #fff; }
.pnm-part .pnm-off { color: var(--dim); }
.pnm-part .pnm-off.is-on { background: rgba(255, 255, 255, 0.1) !important; box-shadow: inset 0 0 0 2px rgba(220, 230, 240, 0.7); color: #fff; }
.pnm-sw input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.pnm-sw i { flex: none; width: 15px; height: 15px; box-shadow: inset 0 0 0 2px rgba(150, 210, 250, 0.6); }
.pnm-sw input:checked + i { background: var(--pc); box-shadow: inset 0 0 0 2px var(--pc), inset 0 0 0 4px #0c1016; }
.pnm-sw:has(input:checked) { box-shadow: inset 0 0 0 2px var(--pc); color: #fff; }
.pnm-sw:has(input:focus-visible) { outline: 2px solid var(--cyan); outline-offset: 1px; }
.pnm-num small { font-size: 11px; color: var(--dim); font-variant-numeric: tabular-nums; }
.pnm-num.is-on small { color: #fff; }
.pnm-line { display: grid; grid-template-columns: 62px minmax(0, 1fr); align-items: center; gap: 6px; }
.pnm-cap { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); white-space: nowrap; }
.pnm-row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 4px; }
.pnm-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
.pnm-two:has(> :only-child) { grid-template-columns: 100%; }
.pnm-two .pnm-line { grid-template-columns: auto minmax(0, 1fr); }
.pnm-speed { display: grid; grid-template-columns: 30px minmax(0, 1fr) 30px; gap: 4px; align-items: center; }
.pnm-speed output { text-align: center; font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; }
.pnm-speed output small { font-size: 11px; color: var(--dim); font-weight: 400; margin-left: 3px; }
.pnm-foot { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: center; height: 30px; }
.pnm-foot.no-go { grid-template-columns: minmax(0, 1fr) auto; }
.pnm-go { height: 30px; padding: 0 14px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; clip-path: var(--oct); --cut: 7px; color: #06202e !important; background: var(--cyan) !important; }
.pnm-go[hidden] { display: none; }
.pnm-go.is-stop { color: var(--ink) !important; background: rgba(40, 47, 56, 0.92) !important; box-shadow: inset 0 0 0 1.5px var(--line); }
.pnm-steps { display: grid; grid-template-columns: repeat(16, 1fr); gap: 2px; min-width: 0; }
.pnm-steps i { height: 14px; background: rgba(150, 210, 250, 0.08); box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.18); }
.pnm-steps i.is-beat { box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.45); }
.pnm-steps i.is-now { background: var(--cyan); }
.pnm-copy { font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 0 10px; }
.pnm-note { min-height: 0; margin: 4px 0 0; font-size: 12px; color: var(--dim); }
.pnm-note:empty { display: none; }
.pnm-out { display: block; width: 100%; margin-top: 6px; font: 12px/1.4 ui-monospace, "DejaVu Sans Mono", monospace; color: var(--ink); background: #0b1119; border: 1px solid var(--line); padding: 6px; resize: vertical; user-select: text; -webkit-user-select: text; }
.pnm-out[hidden] { display: none; }
.pnm-baked { font-size: 11px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* two columns: the presets and the rest on the left, the five parts on the right, each part's choices in one row */
@container (min-width: 700px) {
  .pnm { font-size: 13px; padding: 10px 14px 12px; }
  .pnm-main { grid-template-columns: 270px minmax(0, 1fr); grid-template-areas: "a p" "b p"; column-gap: 14px; row-gap: 8px; align-items: start; }
  .pnm-ch { grid-template-columns: repeat(6, minmax(0, 1fr)) minmax(0, 1.45fr); grid-template-rows: 30px; }
  .pnm-ch .pnm-x { grid-column: auto; }
  .pnm-two { grid-template-columns: 100%; gap: 6px; }
}
@container (min-width: 700px) and (max-width: 859px) { .pnm-line { grid-template-columns: 50px minmax(0, 1fr); } .pnm-cap { font-size: 10px; letter-spacing: 0.06em; } }
/* (two columns: the choices at 12 px, so the longest, Four floor, sits on its cell; the picture row under its caption) */
@container (min-width: 700px) { .pnm-ch .pnm-btn, .pnm-pic .pnm-btn { font-size: 12px; } .pnm-line.pnm-pic { grid-template-columns: 100%; gap: 3px; } }
@container (min-width: 860px) { .pnm-main { grid-template-columns: 300px minmax(0, 1fr); } }
/* (the lab's own rows, Heard in and Notes: the caption over the row, so its five places have the column's width) */
.pnm-stack { grid-template-columns: 100%; gap: 3px; }
.pnm-heard .pnm-row { grid-auto-flow: row; grid-template-columns: repeat(3, minmax(0, 1fr)); }
`;
let styled = false;
function style() { if (styled || typeof document === 'undefined') return; styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }

const same = (a, b) => ['bpm', 'key', 'scale', 'swing', 'seed', 'tune', ...PARTS.map((p) => p.id)].every((k) => a[k] === b[k])
  && PARTS.every((p) => (p.switches || []).every((w) => !!a[w.id] === !!b[w.id]))
  && JSON.stringify(volsOf(a)) === JSON.stringify(volsOf(b)) && JSON.stringify(numbersOf(a)) === JSON.stringify(numbersOf(b));

// the picture picked, shared by a picture and its controls
export function screenLink({ picture = VISUALS[0].id } = {}) {
  const fans = new Set();
  const L = { picture, fans };
  L.pick = (id) => { L.picture = visualOf(id).id; for (const f of fans) f(L); };
  return L;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── the picture ───────────────────────────────────────────────────────────────────────────────────────────────────
export function mountMusicPicture(el, music, { link = null, fps = 0, full = false } = {}) {
  style();
  const L = link || screenLink();
  const root = document.createElement('div'); root.className = 'pnp';
  root.innerHTML = `<div class="pnp-title">${TITLE.word}</div><canvas></canvas><canvas class="pnm-gl" hidden></canvas>${full ? '<button type="button" class="pnp-full" data-full>Full screen</button>' : ''}`;
  el.appendChild(root);
  const canvas = root.querySelector('canvas'), g = canvas.getContext('2d'), glCanvas = root.querySelector('.pnm-gl');
  // full screen: the browser's own where allowed, else the whole window; Esc or a tap brings the page back
  let fullOn = false;
  const leave = () => { if (!fullOn) return; fullOn = false; root.classList.remove('is-full'); if (document.fullscreenElement === root && document.exitFullscreen) document.exitFullscreen().catch(() => {}); };
  const enter = () => {
    fullOn = true;
    if (root.requestFullscreen) root.requestFullscreen().catch(() => root.classList.add('is-full')); else root.classList.add('is-full');
  };
  if (full) {
    root.querySelector('[data-full]').addEventListener('click', (e) => { e.stopPropagation(); enter(); });
    root.addEventListener('click', () => { if (fullOn) leave(); });
    addEventListener('keydown', (e) => { if (fullOn && e.key === 'Escape') leave(); });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && fullOn && !root.classList.contains('is-full')) fullOn = false; });
  }
  let cw = 0, ch = 0;
  const sized = () => { const d = Math.min(2, window.devicePixelRatio || 1); cw = Math.round(canvas.clientWidth * d || glCanvas.clientWidth * d); ch = Math.round((canvas.clientHeight || glCanvas.clientHeight) * d); };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sized) : null;
  if (ro) ro.observe(root);
  const tap = tapOf(music), memo = {}, stats = { paints: 0, ms: 0, errors: 0, error: '', gl: 'off' };
  let glView = null, glShown = false;
  const showGL = (on) => { if (on === glShown) return; glShown = on; glCanvas.hidden = !on; canvas.hidden = on; };
  function startGL() {
    stats.gl = 'loading';
    import('./electricview.js').then((m) => {
      try { glView = m.electricView(glCanvas); stats.gl = 'on'; } catch (e) { stats.gl = 'failed'; stats.error = 'WebGL: ' + String(e && e.message || e); }
    }, (e) => { stats.gl = 'failed'; stats.error = 'WebGL: ' + String(e && e.message || e); });
  }
  let raf = 0, last = 0;
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (typeof document !== 'undefined' && document.hidden) return;   // (nothing painted while hidden)
    if (fps > 0 && t - last < 1000 / fps - 2) return;
    last = t;
    sized();
    if (!cw || !ch) return;
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const t0 = performance.now(), V = visualOf(L.picture);
    try {
      const f = tap.frame();
      if (V.shader && stats.gl !== 'failed') {
        if (stats.gl === 'off') startGL();
        if (glView && !glView.ok()) { stats.gl = 'failed'; stats.error = 'WebGL: lost'; }
        else if (glView) { showGL(true); glView.draw(f, cw, ch, (t / 1000) % 1000, V.shader); stats.ms = performance.now() - t0; stats.paints++; return; }
        else { showGL(false); g.fillStyle = '#070b11'; g.fillRect(0, 0, cw, ch); return; }   // (a moment, while it loads)
      }
      showGL(false);
      f.w = cw; f.h = ch; f.memo = memo[V.id] || (memo[V.id] = {});
      V.paint(g, f);
      stats.ms = performance.now() - t0; stats.paints++;
    } catch (e) { stats.errors++; stats.error = String(e && e.message || e); }   // (a picture's fault must not stop the screen)
  }
  raf = requestAnimationFrame(frame);
  return { el: root, link: L, stats, glView: () => glView, full: { enter, leave, get on() { return fullOn; } }, destroy() { cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (glView) glView.dispose(); root.remove(); } };
}

// ── the controls ──────────────────────────────────────────────────────────────────────────────────────────────────
export function mountMusicControls(el, music, { heardIn = false, notes = false, keep = 'pi-nebula.music', link = null, play = true, hallway = null, onSong = null, done = null } = {}) {
  style();
  const L = link || screenLink();
  // what this browser kept: the song (and the place, and the picture)
  if (keep) {
    try {
      const v = JSON.parse(localStorage.getItem(keep) || 'null');
      if (v && v.song && !checkSong(cleanSong(v.song)).length) music.set(cleanSong(v.song));
      if (heardIn && v && v.place && PLACES.some((p) => p.id === v.place)) music.room(v.place);
      if (v && v.picture) L.picture = visualOf(v.picture).id;
    } catch (e) { /* blocked: the music's own */ }
  }
  const save = () => { if (!keep) return; try { localStorage.setItem(keep, JSON.stringify({ song: music.song, place: music.place, picture: L.picture })); } catch (e) { /* not kept */ } };
  const box = document.createElement('div'); box.className = 'pnm-box';
  const root = document.createElement('div'); root.className = 'pnm';
  const btn = (cls, data, words, extra = '') => `<button type="button" class="pnm-btn ${cls}" ${data}${extra}>${words}</button>`;
  const part = (P) => {
    const extra = P.switches && P.switches.length ? P.switches.map((w) => `<label class="pnm-btn pnm-sw pnm-x"><input type="checkbox" data-switch="${esc(w.id)}"><i aria-hidden="true"></i><span>${esc(w.label)}</span></label>`).join('')
      : P.numbered ? btn('pnm-num pnm-x', `data-numbered="${P.id}"`, `${esc(P.numbered.label)}<small data-number="${P.id}"></small>`) : '<span class="pnm-x" aria-hidden="true"></span>';
    return `<section class="pnm-part" data-row="${P.id}" style="--pc:${PART_COLOURS[P.id]}"><i aria-hidden="true"></i>
      <div class="pnm-ph"><span class="pnm-name">${esc(P.label)}</span><span class="pnm-vol" role="group" aria-label="${esc(P.label)} volume">${btn('', `data-vol="-1" data-vpart="${P.id}"`, '&minus;', ` aria-label="${esc(P.label)} quieter"`)}<output data-vol-out="${P.id}"></output>${btn('', `data-vol="1" data-vpart="${P.id}"`, '+', ` aria-label="${esc(P.label)} louder"`)}</span></div>
      <div class="pnm-ch" role="group" aria-label="${esc(P.label)}">${P.choices.map((c) => btn('', `data-part="${P.id}" data-choice="${c.id}"`, esc(c.label))).join('')}${btn('pnm-off', `data-part="${P.id}" data-choice="off"`, 'Off')}${extra}</div></section>`;
  };
  root.innerHTML = `
    <header class="pnm-top"><b>Music</b><small data-name></small>${done ? '<button type="button" class="pnm-done" data-done>Done<kbd>Esc</kbd></button>' : ''}</header>
    <div class="pnm-main">
      <div class="pnm-a"><div class="pnm-presets" role="group" aria-label="Presets">${PRESETS.map((P) => btn('pnm-preset', `data-preset="${P.id}"`, esc(SHORT[P.id] || P.name), ` title="${esc(P.name)}"`)).join('')}</div></div>
      <div class="pnm-parts">${PARTS.map(part).join('')}</div>
      <div class="pnm-b">
        <div class="pnm-line pnm-pic"><span class="pnm-cap">Picture</span><div class="pnm-row" role="group" aria-label="Picture">${VISUALS.map((v) => btn('', `data-picture="${v.id}"`, esc(v.label))).join('')}</div></div>
        <div class="pnm-two">
          <div class="pnm-line"><span class="pnm-cap">Speed</span><div class="pnm-speed">${btn('', 'data-bpm="-1"', '&minus;', ' aria-label="Slower"')}<output data-bpm-out></output>${btn('', 'data-bpm="1"', '+', ' aria-label="Faster"')}</div></div>
          ${hallway ? `<div class="pnm-line"><span class="pnm-cap">Lights</span><div class="pnm-row" role="group" aria-label="Hallway lights">${btn('', 'data-hallway="on"', 'On', ' title="Hallway lights on"')}${btn('pnm-off', 'data-hallway="off"', 'Off', ' title="Hallway lights off"')}</div></div>` : ''}
        </div>
        ${heardIn ? `<div class="pnm-line pnm-stack pnm-heard"><span class="pnm-cap">Heard in</span><div class="pnm-row" role="group" aria-label="Heard in">${PLACES.map((p) => btn('', `data-place="${p.id}"`, esc(p.name))).join('')}</div></div>` : ''}
        ${notes ? `<div class="pnm-line pnm-stack"><span class="pnm-cap">Notes</span><div class="pnm-row" role="group" aria-label="Notes">${btn('', 'data-notes="live"', 'Live')}${btn('', 'data-notes="baked"', 'Pre-rendered')}</div></div><div class="pnm-baked" data-baked></div>` : ''}
        <div class="pnm-foot${play ? '' : ' no-go'}"><button type="button" class="pnm-go" data-go${play ? '' : ' hidden'}>Play</button><div class="pnm-steps" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<i class="${i % 4 ? '' : 'is-beat'}"></i>`).join('')}</div>${btn('pnm-copy', 'data-copy', 'Copy song')}</div>
      </div>
    </div>
    <p class="pnm-note" data-note aria-live="polite"></p>
    <textarea class="pnm-out" rows="3" readonly spellcheck="false" hidden aria-label="This song, as text"></textarea>`;
  box.appendChild(root); el.appendChild(box);
  const $ = (q) => root.querySelector(q), $$ = (q) => [...root.querySelectorAll(q)];
  const steps = $$('.pnm-steps i'), note = $('[data-note]'), out = $('.pnm-out');
  function show() {
    const s = music.song, P = PRESETS.find((p) => same(p.song, s));
    $('[data-name]').textContent = P ? P.name : (s.name || 'My song') + ' (changed)';
    for (const b of $$('[data-preset]')) b.classList.toggle('is-on', !!P && b.dataset.preset === P.id);
    for (const b of $$('[data-part]')) b.classList.toggle('is-on', s[b.dataset.part] === b.dataset.choice);
    for (const b of $$('[data-place]')) b.classList.toggle('is-on', music.place === b.dataset.place);
    for (const b of $$('[data-notes]')) b.classList.toggle('is-on', music.notes === b.dataset.notes);
    $('[data-bpm-out]').innerHTML = `${s.bpm}<small>bpm</small>`;
    for (const o of $$('[data-vol-out]')) { const v = volOf(s, o.dataset.volOut); o.textContent = v; o.classList.toggle('is-moved', v !== VOL.usual); }
    for (const c of $$('[data-switch]')) c.checked = !!s[c.dataset.switch];
    for (const b of $$('[data-numbered]')) { const v = numberOf(s, b.dataset.numbered); b.classList.toggle('is-on', v != null); b.querySelector('small').textContent = v != null ? ' ' + v : ''; }
    for (const b of $$('[data-picture]')) b.classList.toggle('is-on', b.dataset.picture === L.picture);
    if (hallway) for (const b of $$('[data-hallway]')) b.classList.toggle('is-on', (b.dataset.hallway === 'on') === !!hallway.on());
    const go = $('[data-go]'); go.textContent = music.playing ? 'Stop' : 'Play'; go.classList.toggle('is-stop', music.playing);
  }
  const change = (s) => { music.set(s); save(); if (onSong) onSong(music.song); };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const s = music.song;
    if (b.dataset.preset) { const P = PRESETS.find((p) => p.id === b.dataset.preset); change({ ...P.song }); if (!music.playing && play) music.play(); }
    else if (b.dataset.part) change({ ...s, [b.dataset.part]: b.dataset.choice });
    else if (b.dataset.numbered) {
      const p = b.dataset.numbered, N = PARTS.find((P) => P.id === p).numbered;
      change({ ...s, [p]: N.id, [N.field]: { ...(numbersOf(s)[N.field] || {}), [p]: freshNumber(numberOf(s, p)) } });
    }
    else if (b.dataset.vpart) { const p = b.dataset.vpart, v = Math.max(VOL.min, Math.min(VOL.max, volOf(s, p) + +b.dataset.vol)); change({ ...s, vol: { ...(s.vol || {}), [p]: v } }); }
    else if (b.dataset.picture) { L.pick(b.dataset.picture); save(); show(); }
    else if (b.dataset.hallway) { hallway.set(b.dataset.hallway === 'on'); show(); }
    else if (b.dataset.bpm) change({ ...s, bpm: Math.max(BPM.min, Math.min(BPM.max, s.bpm + BPM.step * +b.dataset.bpm)) });
    else if (b.dataset.place) { music.room(b.dataset.place); save(); }
    else if (b.dataset.notes) { music.setNotes(b.dataset.notes); try { if (keep) localStorage.setItem(keep + '.notes', music.notes); } catch (er) { /* not kept */ } }
    else if ('go' in b.dataset) { if (music.playing) music.stop(); else music.play(); }
    else if ('copy' in b.dataset) copy();
    else if ('done' in b.dataset && done) done();
  });
  root.addEventListener('change', (e) => { const c = e.target.closest('[data-switch]'); if (c) change({ ...music.song, [c.dataset.switch]: c.checked }); });
  function copy() {
    const text = songText(music.song);
    out.value = text;
    const shown = () => { out.hidden = false; out.focus(); out.select(); note.textContent = 'The clipboard is shut here: the song is in the box below to copy by hand.'; };
    try { navigator.clipboard.writeText(text).then(() => { note.textContent = 'Copied: paste it to Claude.'; out.hidden = false; }, shown); } catch (e) { shown(); }
  }
  // (the bar's steps lighting as they play)
  let raf = 0, lit = -1;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (typeof document !== 'undefined' && document.hidden) return;
    const p = music.position(), i = p ? p.step : -1;
    if (i !== lit) { if (lit >= 0) steps[lit].classList.remove('is-now'); if (i >= 0) steps[i].classList.add('is-now'); lit = i; }
  }
  raf = requestAnimationFrame(frame);
  const off = music.on(show), fan = () => show();
  L.fans.add(fan);
  show();
  return { el: root, link: L, show, destroy() { cancelAnimationFrame(raf); off(); L.fans.delete(fan); box.remove(); } };
}
