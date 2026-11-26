// THE MUSIC'S CONTROL SCREEN: the presets, a row for each part (Beat, Bass, Pads, Lead, Melody) with its choices and
// Off, the speed with a minus and a plus, Play and Stop, the bar's sixteen steps lighting as they play, and "Copy this
// song". The game's maker, 2026-11-24: "Maybe have a few screens around the station that interface with it to change
// the song, or modify the song. Such as select the lead, pads, bass, bpm, melodies, beat. But we can have a few
// presets". Dark with light lines, eight-sided frames, as the game's screens are (src/kiosk.js's store screen).
// The lab shows it full page now; the station's screens can show the same module later, as many copies as there are
// screens, all showing and changing the one song (each follows the music through M.on).
//
// TWO FACES. The game's maker, 2026-11-24: "So the screens can show visualizations and then if you interact with it
// then it shows the controls." Left alone it shows a picture of the music (src/music/visuals.js); a tap or a click
// anywhere on it shows the controls; left alone again for a while (idle) it goes back to the picture, and the
// controls' "Show the picture" button goes back at once. Which picture is one more row on the controls, Picture.
// Each part's row has its own volume, a minus and a plus by its name (the game's maker: "it might be good idea to have a
// volume adjustment for each instrument. The pads seem a bit loud"): kept with the song (src/music/song.js vol).
//
//   const S = mountMusicScreen(el, music, { heardIn, keep, link, fit, idle, fps })
//       el       where it goes (it fills it); music: the one music player (src/music/player.js createMusic)
//       heardIn  true: the "Heard in" row (the lab's places to try the music in; a station wall leaves it out)
//       notes    true: the lab's "Notes: Live / Pre-rendered" row (MUSICGAME 1: every note made as it plays, or each
//                different note rendered once and played back, src/music/bake.js; a station wall leaves it out)
//       keep     the key the song, the place and the picture are kept under in this browser ('' or false: not kept)
//       link     screenLink(): screens on one link show the same face and picture (the lab's big screen and its small
//                wall one); left out, the screen has its own
//       fit      true: the screen is the wall screen's shape (46 by 25) whichever face (the controls scroll inside)
//       idle     ms without a touch before the controls go back to the picture (30 s; a link's own when given)
//       fps      at most this many pictures a second (0: every frame the page draws)
//       play     false: no Play / Stop button (the game: the music plays wherever it is heard; the HUD's mute rules it)
//       hallway  { on(), set(on) }: one more row, "Hallway lights" On / Off (the game's hallway lines, MUSIC 3)
//       onSong   called with the song after each change made on this screen (the game keeps it, src/music/game.js)
//   S.destroy()  takes it away; S.stats { paints, ms (the last picture's painting time), errors, error (the last) }; S.link
//   A part's switches (PARTS[part].switches: [{ id, label }]) are tick boxes after its choices, each the song's field
//   of that id, true or false.
//   A part's numbered choice (PARTS[part].numbered: { id, label, field }) is one more button at the end of its row:
//   each press picks that choice with a new number (the song's field[part]), shown small on the button ("Random 4821").
//   screenLink({ face, picture, idle }) -> { face: 'picture' | 'controls', picture, show(face), pick(id), touch() }
//   WALL       the wall screen's shape, cm
// A picture with a shader (VISUALS' `shader`: Hex, src/music/hex.js; Electric's place on the row since MUSIC 3) is drawn by WebGL on a second
// canvas in the face (src/music/electricview.js, loaded the first time it is shown); with no WebGL, a shader that will
// not build, or the context lost, the screen paints that picture's own paint instead (the Notes picture) and goes on.
//   S.stats.gl   'off' (not asked for yet), 'loading', 'on', 'failed'; S.glView() the WebGL view (the rigs)
// Nothing is painted while the page is hidden or the controls are showing.
import { PARTS, PRESETS, BPM, VOL, volOf, volsOf, songText, cleanSong, checkSong, numberOf, numbersOf, freshNumber } from './song.js';
import { PLACES } from './player.js';
import { tapOf } from './tap.js';
import { VISUALS, visualOf } from './visuals.js';

export const WALL = { w: 46, h: 25 };

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
.pnm-top .pnm-show { margin-left: auto; flex: none; }
.pnm-top small { flex: 1; font-size: 13px; color: var(--dim); letter-spacing: 0.04em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pnm-presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 6px; margin-bottom: 12px; }
.pnm-b { min-height: 42px; padding: 4px 8px; font-size: 14px; letter-spacing: 0.03em; background: rgba(150, 210, 250, 0.07) !important;
  box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.25); clip-path: var(--oct); --cut: 8px; }
.pnm-b:hover { box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.6); }
.pnm-b.is-on { background: var(--on) !important; box-shadow: inset 0 0 0 2px var(--cyan); color: #ffffff; }
.pnm-b.is-off { color: var(--dim); }
.pnm-b.is-off.is-on { color: #ffffff; background: rgba(255, 255, 255, 0.1) !important; box-shadow: inset 0 0 0 2px rgba(220, 230, 240, 0.7); }
.pnm-preset { font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 13px; }
.pnm-row { display: grid; grid-template-columns: 178px 1fr; gap: 6px 10px; align-items: center; padding: 6px 0; border-top: 1px solid rgba(150, 210, 250, 0.12); }
.pnm-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.pnm-head > .pnm-name { flex: 1; min-width: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); }
.pnm-vol { display: flex; align-items: center; gap: 4px; flex: none; }
.pnm-vol .pnm-b { width: 40px; min-height: 40px; padding: 0; font-size: 20px; line-height: 1; font-weight: 700; }
.pnm-vol output { min-width: 26px; text-align: center; font-size: 16px; font-weight: 700; }
.pnm-vol output.is-moved { color: var(--cyan); }
.pnm-ch .pnm-sw { display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
.pnm-sw input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.pnm-sw i { flex: none; width: 22px; height: 22px; box-shadow: inset 0 0 0 2px rgba(150, 210, 250, 0.6); }
.pnm-sw input:checked + i { background: var(--cyan); box-shadow: inset 0 0 0 2px var(--cyan), inset 0 0 0 5px #0c1016; }
.pnm-sw:has(input:focus-visible) { outline: 2px solid var(--cyan); outline-offset: 2px; }
.pnm-sw:has(input:checked) { box-shadow: inset 0 0 0 2px var(--cyan); }
.pnm-ch { display: flex; flex-wrap: wrap; gap: 6px; }
.pnm-ch .pnm-b { flex: 1 1 88px; max-width: 150px; }
.pnm-num small { font-size: 11px; letter-spacing: 0.02em; color: var(--dim); font-variant-numeric: tabular-nums; }
.pnm-num.is-on small { color: var(--cyan); }
.pnm-speed { display: flex; align-items: center; gap: 8px; }
.pnm-speed .pnm-b { width: 46px; font-size: 22px; line-height: 1; font-weight: 700; }
.pnm-speed output { min-width: 92px; text-align: center; font-size: 18px; font-weight: 700; letter-spacing: 0.04em; }
.pnm-speed output small { font-size: 12px; color: var(--dim); font-weight: 400; margin-left: 4px; }
.pnm-foot { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding-top: 10px; margin-top: 6px; border-top: 1px solid var(--line); }
.pnm-go { min-height: 46px; padding: 6px 18px; font-size: 14px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; clip-path: var(--oct); --cut: 8px;
  color: #06202e !important; background: var(--cyan) !important; }
.pnm-go[hidden] { display: none; }
.pnm-foot.no-go { grid-template-columns: 1fr auto; }
.pnm-go.is-stop { color: var(--ink) !important; background: rgba(40, 47, 56, 0.92) !important; box-shadow: inset 0 0 0 1.5px var(--line); }
.pnm-steps { display: grid; grid-template-columns: repeat(16, 1fr); gap: 3px; min-width: 0; }
.pnm-steps i { height: 18px; background: rgba(150, 210, 250, 0.08); box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.18); }
.pnm-steps i.is-beat { box-shadow: inset 0 0 0 1px rgba(150, 210, 250, 0.45); }
.pnm-steps i.is-now { background: var(--cyan); box-shadow: 0 0 8px rgba(143, 211, 255, 0.8); }
.pnm-copy { min-height: 46px; padding: 6px 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.pnm-note { min-height: 1.3em; margin: 8px 0 0; font-size: 13px; color: var(--dim); }
.pnm-out { display: block; width: 100%; margin-top: 6px; font: 12px/1.4 ui-monospace, "DejaVu Sans Mono", monospace; color: var(--ink); background: #0b1119; border: 1px solid var(--line); padding: 6px; resize: vertical; user-select: text; -webkit-user-select: text; }
.pnm-out[hidden] { display: none; }
.pnm-box { container-type: inline-size; width: 100%; }
.pnm-face { display: none; position: relative; width: 100%; aspect-ratio: 46 / 25; cursor: pointer; }
.pnm-face canvas { display: block; width: 100%; height: 100%; }
.pnm-face canvas[hidden] { display: none; }
.pnm.is-pic { padding: 0; }
.pnm.is-pic .pnm-face { display: block; }
.pnm.is-pic .pnm-ctl { display: none; }
.pnm-fit { aspect-ratio: 46 / 25; max-width: none; }
.pnm-fit .pnm-face { aspect-ratio: auto; height: 100%; }
.pnm-fit .pnm-ctl { height: 100%; overflow-y: auto; overscroll-behavior: contain; }
.pnm-fit:not(.is-pic) { padding: 10px 12px; }
@container (max-width: 560px) {
  .pnm { padding: 10px 10px 12px; --cut: 10px; }
  .pnm-top small { display: none; }
  .pnm-presets { grid-template-columns: repeat(2, 1fr); }
  .pnm-row { grid-template-columns: 1fr; gap: 4px; }
  .pnm-head > .pnm-name { flex: 0 1 auto; margin-right: auto; }
  .pnm-ch .pnm-b { flex: 1 1 64px; font-size: 13px; padding: 4px; }
  .pnm-foot { grid-template-columns: auto 1fr; }
  .pnm-steps { grid-column: 1 / -1; grid-row: 1; }
  .pnm-copy { justify-self: end; }
}
`;
let styled = false;
function style() { if (styled || typeof document === 'undefined') return; styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }

const same = (a, b) => ['bpm', 'key', 'scale', 'swing', 'seed', 'tune', ...PARTS.map((p) => p.id)].every((k) => a[k] === b[k])
  && PARTS.every((p) => (p.switches || []).every((w) => !!a[w.id] === !!b[w.id]))
  && JSON.stringify(volsOf(a)) === JSON.stringify(volsOf(b)) && JSON.stringify(numbersOf(a)) === JSON.stringify(numbersOf(b));

// the faces' shared state: screens on one link show the same face and the same picture
export function screenLink({ face = 'picture', picture = VISUALS[0].id, idle = 30000 } = {}) {
  const fans = new Set();
  let timer = 0;
  const L = { face, picture, idle, fans };
  const tell = () => { for (const f of fans) f(L); };
  L.show = (f) => { L.face = f === 'controls' ? 'controls' : 'picture'; clearTimeout(timer); if (L.face === 'controls') L.touch(); tell(); };
  L.pick = (id) => { L.picture = visualOf(id).id; tell(); };
  // a touch on the controls: the picture comes back only once they have been left alone for `idle`
  L.touch = () => { clearTimeout(timer); if (L.face === 'controls' && L.idle > 0) timer = setTimeout(() => L.show('picture'), L.idle); };
  return L;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mountMusicScreen(el, music, { heardIn = false, notes = false, keep = 'pi-nebula.music', link = null, fit = false, idle = 30000, fps = 0, play = true, hallway = null, onSong = null } = {}) {
  style();
  const L = link || screenLink({ idle });
  // what this browser kept: the song (and the place)
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
  const root = document.createElement('div'); root.className = 'pnm' + (fit ? ' pnm-fit' : '');
  const head = (label, part) => `<div class="pnm-head"><span class="pnm-name">${esc(label)}</span>${part ? `<span class="pnm-vol" role="group" aria-label="${esc(label)} volume"><button type="button" class="pnm-b" data-vol="-1" data-vpart="${part}" aria-label="${esc(label)} quieter">&minus;</button><output data-vol-out="${part}"></output><button type="button" class="pnm-b" data-vol="1" data-vpart="${part}" aria-label="${esc(label)} louder">+</button></span>` : ''}</div>`;
  root.innerHTML = `
    <div class="pnm-face" data-face role="button" tabindex="0" aria-label="The music's picture: tap for the controls"><canvas></canvas><canvas class="pnm-gl" hidden></canvas></div>
    <div class="pnm-ctl">
    <div class="pnm-top"><b>Music</b><small data-name></small><button type="button" class="pnm-b pnm-show" data-show>Show the picture</button></div>
    <div class="pnm-presets" role="group" aria-label="Presets">${PRESETS.map((P) => `<button type="button" class="pnm-b pnm-preset" data-preset="${P.id}">${esc(P.name)}</button>`).join('')}</div>
    ${PARTS.map((P) => `<div class="pnm-row" data-row="${P.id}">${head(P.label, P.id)}<div class="pnm-ch" role="group" aria-label="${esc(P.label)}">${P.choices.map((c) => `<button type="button" class="pnm-b" data-part="${P.id}" data-choice="${c.id}">${esc(c.label)}</button>`).join('')}<button type="button" class="pnm-b is-off" data-part="${P.id}" data-choice="off">Off</button>${(P.switches || []).map((w) => `<label class="pnm-b pnm-sw"><input type="checkbox" data-switch="${esc(w.id)}"><i aria-hidden="true"></i><span>${esc(w.label)}</span></label>`).join('')}${P.numbered ? `<button type="button" class="pnm-b pnm-num" data-numbered="${P.id}">${esc(P.numbered.label)}<small data-number="${P.id}"></small></button>` : ''}</div></div>`).join('')}
    <div class="pnm-row">${head('Speed')}<div class="pnm-speed"><button type="button" class="pnm-b" data-bpm="-1" aria-label="Slower">&minus;</button><output data-bpm-out></output><button type="button" class="pnm-b" data-bpm="1" aria-label="Faster">+</button></div></div>
    <div class="pnm-row">${head('Picture')}<div class="pnm-ch" role="group" aria-label="Picture">${VISUALS.map((v) => `<button type="button" class="pnm-b" data-picture="${v.id}">${esc(v.label)}</button>`).join('')}</div></div>
    ${hallway ? `<div class="pnm-row">${head('Hallway lights')}<div class="pnm-ch" role="group" aria-label="Hallway lights"><button type="button" class="pnm-b" data-hallway="on">On</button><button type="button" class="pnm-b is-off" data-hallway="off">Off</button></div></div>` : ''}
    ${heardIn ? `<div class="pnm-row">${head('Heard in')}<div class="pnm-ch" role="group" aria-label="Heard in">${PLACES.map((p) => `<button type="button" class="pnm-b" data-place="${p.id}">${esc(p.name)}</button>`).join('')}</div></div>` : ''}
    ${notes ? `<div class="pnm-row">${head('Notes')}<div class="pnm-ch" role="group" aria-label="Notes"><button type="button" class="pnm-b" data-notes="live">Live</button><button type="button" class="pnm-b" data-notes="baked">Pre-rendered</button><small data-baked style="flex: 1 1 100%; font-size: 12px; color: var(--dim);"></small></div></div>` : ''}
    <div class="pnm-foot${play ? '' : ' no-go'}">
      <button type="button" class="pnm-go" data-go${play ? '' : ' hidden'}>Play</button>
      <div class="pnm-steps" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<i class="${i % 4 ? '' : 'is-beat'}"></i>`).join('')}</div>
      <button type="button" class="pnm-b pnm-copy" data-copy>Copy this song</button>
    </div>
    <p class="pnm-note" data-note aria-live="polite"></p>
    <textarea class="pnm-out" rows="3" readonly spellcheck="false" hidden aria-label="This song, as text"></textarea>
    </div>`;
  box.appendChild(root); el.appendChild(box);
  const $ = (q) => root.querySelector(q), $$ = (q) => [...root.querySelectorAll(q)];
  const steps = $$('.pnm-steps i'), note = $('[data-note]'), out = $('.pnm-out');

  function show() {
    const s = music.song, P = PRESETS.find((p) => same(p.song, s));
    $('[data-name]').textContent = P ? P.name : (s.name || 'My song') + ' (changed)';
    for (const b of $$('[data-preset]')) b.classList.toggle('is-on', !!P && b.dataset.preset === P.id);
    for (const b of $$('[data-part]')) b.classList.toggle('is-on', s[b.dataset.part] === b.dataset.choice);
    for (const b of $$('[data-place]')) b.classList.toggle('is-on', music.place === b.dataset.place);
    for (const b of $$('[data-notes]')) b.classList.toggle('is-on', music.notes === b.dataset.notes);   // (MUSICGAME 1)
    $('[data-bpm-out]').innerHTML = `${s.bpm}<small>bpm</small>`;
    for (const o of $$('[data-vol-out]')) { const v = volOf(s, o.dataset.volOut); o.textContent = v; o.classList.toggle('is-moved', v !== VOL.usual); }
    for (const c of $$('[data-switch]')) c.checked = !!s[c.dataset.switch];
    for (const b of $$('[data-numbered]')) { const v = numberOf(s, b.dataset.numbered); b.classList.toggle('is-on', v != null); b.querySelector('small').textContent = v != null ? ' ' + v : ''; }
    for (const b of $$('[data-picture]')) b.classList.toggle('is-on', b.dataset.picture === L.picture);
    for (const b of $$('[data-hallway]')) b.classList.toggle('is-on', (b.dataset.hallway === 'on') === !!hallway.on());
    const go = $('[data-go]'); go.textContent = music.playing ? 'Stop' : 'Play'; go.classList.toggle('is-stop', music.playing);
  }
  const change = (s) => { music.set(s); save(); if (onSong) onSong(music.song); };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const s = music.song;
    if (b.dataset.preset) { const P = PRESETS.find((p) => p.id === b.dataset.preset); change({ ...P.song }); if (!music.playing) music.play(); }
    else if (b.dataset.part) change({ ...s, [b.dataset.part]: b.dataset.choice });
    else if (b.dataset.numbered) {
      // a numbered choice: picked, with a new number each press
      const p = b.dataset.numbered, N = PARTS.find((P) => P.id === p).numbered;
      change({ ...s, [p]: N.id, [N.field]: { ...(numbersOf(s)[N.field] || {}), [p]: freshNumber(numberOf(s, p)) } });
    }
    else if (b.dataset.vpart) {
      const p = b.dataset.vpart, v = Math.max(VOL.min, Math.min(VOL.max, volOf(s, p) + +b.dataset.vol));
      change({ ...s, vol: { ...(s.vol || {}), [p]: v } });
    }
    else if (b.dataset.picture) { L.pick(b.dataset.picture); save(); }
    else if (b.dataset.hallway) { hallway.set(b.dataset.hallway === 'on'); show(); }
    else if ('show' in b.dataset) L.show('picture');
    else if (b.dataset.bpm) change({ ...s, bpm: Math.max(BPM.min, Math.min(BPM.max, s.bpm + BPM.step * +b.dataset.bpm)) });
    else if (b.dataset.place) { music.room(b.dataset.place); save(); }
    else if (b.dataset.notes) { music.setNotes(b.dataset.notes); try { if (keep) localStorage.setItem(keep + '.notes', music.notes); } catch (er) { /* not kept */ } }   // (MUSICGAME 1)
    else if ('go' in b.dataset) { if (music.playing) music.stop(); else music.play(); }
    else if ('copy' in b.dataset) copy();
  });
  // a part's switch (PARTS[part].switches): the song's field of that name, true or false
  root.addEventListener('change', (e) => { const c = e.target.closest('[data-switch]'); if (c) change({ ...music.song, [c.dataset.switch]: c.checked }); });
  function copy() {
    const text = songText(music.song);
    out.value = text;
    const shown = () => { out.hidden = false; out.focus(); out.select(); note.textContent = 'The clipboard is shut here: the song is in the box below to copy by hand.'; };
    try {
      navigator.clipboard.writeText(text).then(() => { note.textContent = 'Copied: paste it to Claude.'; out.hidden = false; }, shown);
    } catch (e) { shown(); }
  }
  // the faces: a tap on the picture shows the controls; any touch on the controls keeps them up a while longer
  const face = $('[data-face]'), canvas = face.querySelector('canvas'), g = canvas.getContext('2d'), glCanvas = face.querySelector('.pnm-gl');
  face.addEventListener('click', () => L.show('controls'));
  face.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); L.show('controls'); } });
  const touched = () => L.touch();
  root.addEventListener('pointerdown', touched); root.addEventListener('keydown', touched); root.addEventListener('wheel', touched, { passive: true });
  $('.pnm-ctl').addEventListener('scroll', touched, { passive: true });
  function faces() { root.classList.toggle('is-pic', L.face === 'picture'); show(); }
  L.fans.add(faces);
  // the picture's size in its own pixels (the page's pixels, at most 2 a CSS pixel)
  let cw = 0, ch = 0;
  // (measured on the face, which holds whichever canvas is showing)
  const sized = () => { const d = Math.min(2, window.devicePixelRatio || 1); cw = Math.round(face.clientWidth * d); ch = Math.round(face.clientHeight * d); };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sized) : null;
  if (ro) ro.observe(face);
  const tap = tapOf(music), memo = {}, stats = { paints: 0, ms: 0, errors: 0, error: '', gl: 'off' };
  // the shader pictures' WebGL view: made the first time one is shown; 'failed' for good once it cannot draw
  let glView = null, glShown = false;
  const showGL = (on) => { if (on === glShown) return; glShown = on; glCanvas.hidden = !on; canvas.hidden = on; };
  function startGL() {
    stats.gl = 'loading';
    import('./electricview.js').then((m) => {
      try { glView = m.electricView(glCanvas); stats.gl = 'on'; } catch (e) { stats.gl = 'failed'; stats.error = 'WebGL: ' + String(e && e.message || e); }
    }, (e) => { stats.gl = 'failed'; stats.error = 'WebGL: ' + String(e && e.message || e); });
  }
  let raf = 0, lit = -1, last = 0;
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (typeof document !== 'undefined' && document.hidden) return;   // (nothing painted while hidden)
    if (L.face === 'controls') {
      // the steps lighting with the music
      const p = music.position(), i = p ? p.step : -1;
      if (i !== lit) { if (lit >= 0) steps[lit].classList.remove('is-now'); if (i >= 0) steps[i].classList.add('is-now'); lit = i; }
      return;
    }
    if (fps > 0 && t - last < 1000 / fps - 2) return;
    last = t;
    if (!ro) sized();
    if (!cw || !ch) return;
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const t0 = performance.now(), V = visualOf(L.picture);
    try {
      const f = tap.frame();
      if (V.shader && stats.gl !== 'failed') {
        if (stats.gl === 'off') startGL();
        if (glView && !glView.ok()) { stats.gl = 'failed'; stats.error = 'WebGL: lost'; }
        else if (glView) {
          showGL(true); glView.draw(f, cw, ch, (t / 1000) % 1000, V.shader);
          stats.ms = performance.now() - t0; stats.paints++;
          return;
        } else { showGL(false); g.fillStyle = '#070b11'; g.fillRect(0, 0, cw, ch); return; }   // (a moment, while it loads)
      }
      showGL(false);
      f.w = cw; f.h = ch; f.memo = memo[V.id] || (memo[V.id] = {});
      V.paint(g, f);
      stats.ms = performance.now() - t0; stats.paints++;
    } catch (e) { stats.errors++; stats.error = String(e && e.message || e); }   // (a picture's fault must not stop the screen)
  }
  raf = requestAnimationFrame(frame);
  const off = music.on(show);
  faces();
  return { el: root, link: L, stats, glView: () => glView, destroy() { cancelAnimationFrame(raf); off(); L.fans.delete(faces); if (ro) ro.disconnect(); if (glView) glView.dispose(); box.remove(); } };
}
