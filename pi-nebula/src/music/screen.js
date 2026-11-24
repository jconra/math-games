// THE MUSIC'S CONTROL SCREEN: the presets, a row for each part (Beat, Bass, Pads, Lead, Melody) with its choices and
// Off, the speed with a minus and a plus, Play and Stop, the bar's sixteen steps lighting as they play, and "Copy this
// song". The game's maker, 2026-11-24: "Maybe have a few screens around the station that interface with it to change
// the song, or modify the song. Such as select the lead, pads, bass, bpm, melodies, beat. But we can have a few
// presets". Dark with light lines, eight-sided frames, as the game's screens are (src/kiosk.js's store screen).
// The lab shows it full page now; the station's screens can show the same module later, as many copies as there are
// screens, all showing and changing the one song (each follows the music through M.on).
//
//   const S = mountMusicScreen(el, music, { heardIn, keep })
//       el       where it goes (it fills it); music: the one music player (src/music/player.js createMusic)
//       heardIn  true: the "Heard in" row (the lab's places to try the music in; a station wall leaves it out)
//       keep     the key the song (and the place) are kept under in this browser ('' or false: not kept)
//   S.destroy()  takes it away
import { PARTS, PRESETS, BPM, songText, cleanSong, checkSong } from './song.js';
import { PLACES } from './player.js';

const CSS = `
.pnm { --ink: #eef1f4; --dim: #a7b0ba; --cyan: #8fd3ff; --line: rgba(150, 210, 250, 0.36); --on: rgba(150, 210, 250, 0.2);
  --cut: 14px; --oct: polygon(var(--cut) 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, var(--cut) 100%, 0 calc(100% - var(--cut)), 0 var(--cut));
  box-sizing: border-box; width: 100%; max-width: 980px; margin: 0 auto; padding: 14px 16px 16px; background: rgba(12, 16, 22, 0.94);
  box-shadow: inset 0 0 0 2px rgba(150, 210, 250, 0.7); clip-path: var(--oct);
  font: 400 16px/1.35 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: var(--ink);
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.pnm * { box-sizing: border-box; }
.pnm button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
.pnm button:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
.pnm-top { display: flex; align-items: baseline; gap: 10px; padding-bottom: 8px; margin-bottom: 10px; border-bottom: 1px solid var(--line); }
.pnm-top b { font-size: 19px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cyan); }
.pnm-top small { flex: 1; font-size: 13px; color: var(--dim); letter-spacing: 0.04em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pnm-presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 6px; margin-bottom: 12px; }
.pnm-b { min-height: 42px; padding: 4px 8px; font-size: 14px; letter-spacing: 0.03em; background: rgba(150, 210, 250, 0.07) !important;
  box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.25); clip-path: var(--oct); --cut: 8px; }
.pnm-b:hover { box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.6); }
.pnm-b.is-on { background: var(--on) !important; box-shadow: inset 0 0 0 2px var(--cyan); color: #ffffff; }
.pnm-b.is-off { color: var(--dim); }
.pnm-b.is-off.is-on { color: #ffffff; background: rgba(255, 255, 255, 0.1) !important; box-shadow: inset 0 0 0 2px rgba(220, 230, 240, 0.7); }
.pnm-preset { font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 13px; }
.pnm-row { display: grid; grid-template-columns: 92px 1fr; gap: 6px 10px; align-items: center; padding: 6px 0; border-top: 1px solid rgba(150, 210, 250, 0.12); }
.pnm-row > span { font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); }
.pnm-row.is-resting > span { opacity: 0.5; }
.pnm-ch { display: flex; flex-wrap: wrap; gap: 6px; }
.pnm-ch .pnm-b { flex: 1 1 88px; max-width: 150px; }
.pnm-speed { display: flex; align-items: center; gap: 8px; }
.pnm-speed .pnm-b { width: 46px; font-size: 22px; line-height: 1; font-weight: 700; }
.pnm-speed output { min-width: 92px; text-align: center; font-size: 18px; font-weight: 700; letter-spacing: 0.04em; }
.pnm-speed output small { font-size: 12px; color: var(--dim); font-weight: 400; margin-left: 4px; }
.pnm-foot { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding-top: 10px; margin-top: 6px; border-top: 1px solid var(--line); }
.pnm-go { min-height: 46px; padding: 6px 18px; font-size: 14px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; clip-path: var(--oct); --cut: 8px;
  color: #06202e !important; background: var(--cyan) !important; }
.pnm-go.is-stop { color: var(--ink) !important; background: rgba(40, 47, 56, 0.92) !important; box-shadow: inset 0 0 0 1.5px var(--line); }
.pnm-steps { display: grid; grid-template-columns: repeat(16, 1fr); gap: 3px; min-width: 0; }
.pnm-steps i { height: 18px; background: rgba(150, 210, 250, 0.08); box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.18); }
.pnm-steps i.is-beat { box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.45); }
.pnm-steps i.is-now { background: var(--cyan); box-shadow: 0 0 8px rgba(143, 211, 255, 0.8); }
.pnm-copy { min-height: 46px; padding: 6px 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.pnm-note { min-height: 1.3em; margin: 8px 0 0; font-size: 13px; color: var(--dim); }
.pnm-out { display: block; width: 100%; margin-top: 6px; font: 12px/1.4 ui-monospace, "DejaVu Sans Mono", monospace; color: var(--ink); background: #0b1119; border: 1px solid var(--line); padding: 6px; resize: vertical; user-select: text; -webkit-user-select: text; }
.pnm-out[hidden] { display: none; }
@media (max-width: 560px) {
  .pnm { padding: 10px 10px 12px; --cut: 10px; }
  .pnm-top small { display: none; }
  .pnm-presets { grid-template-columns: repeat(2, 1fr); }
  .pnm-row { grid-template-columns: 1fr; gap: 4px; }
  .pnm-ch .pnm-b { flex: 1 1 64px; font-size: 13px; padding: 4px; }
  .pnm-foot { grid-template-columns: auto 1fr; }
  .pnm-steps { grid-column: 1 / -1; grid-row: 1; }
  .pnm-copy { justify-self: end; }
}
`;
let styled = false;
function style() { if (styled || typeof document === 'undefined') return; styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }

const same = (a, b) => ['bpm', 'key', 'scale', 'swing', 'seed', 'tune', ...PARTS.map((p) => p.id)].every((k) => a[k] === b[k]);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mountMusicScreen(el, music, { heardIn = false, keep = 'pi-nebula.music' } = {}) {
  style();
  // what this browser kept: the song (and the place)
  if (keep) {
    try {
      const v = JSON.parse(localStorage.getItem(keep) || 'null');
      if (v && v.song && !checkSong(cleanSong(v.song)).length) music.set(cleanSong(v.song));
      if (heardIn && v && v.place && PLACES.some((p) => p.id === v.place)) music.room(v.place);
    } catch (e) { /* blocked: the music's own */ }
  }
  const save = () => { if (!keep) return; try { localStorage.setItem(keep, JSON.stringify({ song: music.song, place: music.place })); } catch (e) { /* not kept */ } };

  const root = document.createElement('div'); root.className = 'pnm';
  root.innerHTML = `
    <div class="pnm-top"><b>Music</b><small data-name></small></div>
    <div class="pnm-presets" role="group" aria-label="Presets">${PRESETS.map((P) => `<button type="button" class="pnm-b pnm-preset" data-preset="${P.id}">${esc(P.name)}</button>`).join('')}</div>
    ${PARTS.map((P) => `<div class="pnm-row" data-row="${P.id}"><span>${esc(P.label)}</span><div class="pnm-ch" role="group" aria-label="${esc(P.label)}">${P.choices.map((c) => `<button type="button" class="pnm-b" data-part="${P.id}" data-choice="${c.id}">${esc(c.label)}</button>`).join('')}<button type="button" class="pnm-b is-off" data-part="${P.id}" data-choice="off">Off</button></div></div>`).join('')}
    <div class="pnm-row"><span>Speed</span><div class="pnm-speed"><button type="button" class="pnm-b" data-bpm="-1" aria-label="Slower">&minus;</button><output data-bpm-out></output><button type="button" class="pnm-b" data-bpm="1" aria-label="Faster">+</button></div></div>
    ${heardIn ? `<div class="pnm-row"><span>Heard in</span><div class="pnm-ch" role="group" aria-label="Heard in">${PLACES.map((p) => `<button type="button" class="pnm-b" data-place="${p.id}">${esc(p.name)}</button>`).join('')}</div></div>` : ''}
    <div class="pnm-foot">
      <button type="button" class="pnm-go" data-go>Play</button>
      <div class="pnm-steps" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<i class="${i % 4 ? '' : 'is-beat'}"></i>`).join('')}</div>
      <button type="button" class="pnm-b pnm-copy" data-copy>Copy this song</button>
    </div>
    <p class="pnm-note" data-note aria-live="polite"></p>
    <textarea class="pnm-out" rows="3" readonly spellcheck="false" hidden aria-label="This song, as text"></textarea>`;
  el.appendChild(root);
  const $ = (q) => root.querySelector(q), $$ = (q) => [...root.querySelectorAll(q)];
  const steps = $$('.pnm-steps i'), note = $('[data-note]'), out = $('.pnm-out');

  function show() {
    const s = music.song, P = PRESETS.find((p) => same(p.song, s));
    $('[data-name]').textContent = P ? P.name : (s.name || 'My song') + ' (changed)';
    for (const b of $$('[data-preset]')) b.classList.toggle('is-on', !!P && b.dataset.preset === P.id);
    for (const b of $$('[data-part]')) b.classList.toggle('is-on', s[b.dataset.part] === b.dataset.choice);
    for (const b of $$('[data-place]')) b.classList.toggle('is-on', music.place === b.dataset.place);
    $('[data-bpm-out]').innerHTML = `${s.bpm}<small>bpm</small>`;
    const go = $('[data-go]'); go.textContent = music.playing ? 'Stop' : 'Play'; go.classList.toggle('is-stop', music.playing);
  }
  const change = (s) => { music.set(s); save(); };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const s = music.song;
    if (b.dataset.preset) { const P = PRESETS.find((p) => p.id === b.dataset.preset); change({ ...P.song }); if (!music.playing) music.play(); }
    else if (b.dataset.part) change({ ...s, [b.dataset.part]: b.dataset.choice });
    else if (b.dataset.bpm) change({ ...s, bpm: Math.max(BPM.min, Math.min(BPM.max, s.bpm + BPM.step * +b.dataset.bpm)) });
    else if (b.dataset.place) { music.room(b.dataset.place); save(); }
    else if ('go' in b.dataset) { if (music.playing) music.stop(); else music.play(); }
    else if ('copy' in b.dataset) copy();
  });
  function copy() {
    const text = songText(music.song);
    out.value = text;
    const shown = () => { out.hidden = false; out.focus(); out.select(); note.textContent = 'The clipboard is shut here: the song is in the box below to copy by hand.'; };
    try {
      navigator.clipboard.writeText(text).then(() => { note.textContent = 'Copied: paste it to Claude.'; out.hidden = false; }, shown);
    } catch (e) { shown(); }
  }
  // the steps lighting with the music
  let raf = 0, lit = -1;
  function frame() {
    const p = music.position(), i = p ? p.step : -1;
    if (i !== lit) { if (lit >= 0) steps[lit].classList.remove('is-now'); if (i >= 0) steps[i].classList.add('is-now'); lit = i; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  const off = music.on(show);
  show();
  return { el: root, destroy() { cancelAnimationFrame(raf); off(); root.remove(); } };
}
