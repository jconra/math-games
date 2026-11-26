// THE MUSIC LAB: the station's music (src/music/), to hear before any of it goes into the game. The game's maker,
// 2026-11-24: "Btw we should work on some music too ... We might want to make a lab for it." 2026-11-26: "I'd prefer to
// just have the visualization and the controls on the same page. And no need for the second "A station wall screen,
// small". Just put the visualization at the top or bottom. Instead of "show the picture" maybe have a full screen
// button." So: the picture at the top (the wall screen's own: src/music/screen.js mountMusicPicture, MUSIC along its
// top, the wall's 46 x 25 shape), a Full screen button on it; under it the controls, the very panel the game opens
// from a wall screen (mountMusicControls), with the lab's own rows (Heard in, Notes) and Play / Stop; under them a
// preview of the hallways' lines (src/music/lights.js) drawn as the game's rail draws them. The music plays by itself
// here (its own audio context, made on the first Play).
// The lab's "Notes" row (lab only, as "Heard in" is; MUSICGAME 1): Live, every note made by the engine as it plays;
// Pre-rendered, each different note rendered once in the background and played back (src/music/bake.js), as the game
// plays it, so the two can be compared by ear. Kept in this browser ('pi-nebula.music-lab.notes'); Pre-rendered at
// first. Under it a small line: how many notes are rendered.
import { createMusic } from '../../src/music/player.js';
import { mountMusicPicture, mountMusicControls, screenLink } from '../../src/music/screen.js';
import { tapOf } from '../../src/music/tap.js';
import { lightLines, lineColour } from '../../src/music/lights.js';
import { MUSIC_LINES, lineY } from '../../kit/musiclines.js';
import { PART_COLOURS } from '../../src/music/visuals.js';
import { PART_IDS } from '../../src/music/song.js';

const KEEP = 'pi-nebula.music-lab';
let notes = 'baked';
try { if (localStorage.getItem(KEEP + '.notes') === 'live') notes = 'live'; } catch (e) { /* blocked: pre-rendered */ }
const music = createMusic({ notes });
const link = screenLink();
const controls = mountMusicControls(document.getElementById('controls'), music, { heardIn: true, notes: true, keep: KEEP, link });
const picture = mountMusicPicture(document.getElementById('picture'), music, { link, full: true });
// (what is rendered so far, once a second: MUSICGAME 1)
setInterval(() => {
  const said = document.querySelector('#controls [data-baked]'), B = music.bakery; if (!said) return;
  if (music.notes !== 'baked' || !B) { said.textContent = music.notes === 'live' ? 'Every note made as it plays.' : ''; return; }
  const s = B.stats();
  said.textContent = `${s.baked} notes rendered (${s.MB} MB)${s.queued ? `, ${s.queued} to come` : ''}; played back ${s.played}, live ${s.live}`;
}, 1000);

// ── the hallway lines ────────────────────────────────────────────────────────────────────────────────────────────
// (the one style the game's maker chose, as the game's hallways draw it: the rail (kit/musiclines.js), its five lines
// filling its face, each a part's colour at its full strength where its note is and dim where it rests:
// src/music/lights.js lineColour)
const cv = document.getElementById('lights'), g = cv.getContext('2d'), tap = tapOf(music);
const COLS = 128;
let table = new Float32Array(5 * COLS);
const css = (c) => `rgb(${c.map((x) => Math.round(Math.min(1, x) * 255)).join(', ')})`;
// the rail along a hallway wall, its five lines, each place along a line as bright as the table says; the rail's
// metres to the canvas's pixels by its height (MUSIC_LINES.h)
function paintLights() {
  const d = Math.min(2, window.devicePixelRatio || 1), w = Math.round(cv.clientWidth * d), h = Math.round(cv.clientHeight * d);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  table = lightLines(tap.frame(), COLS, table);
  g.fillStyle = '#05080c'; g.fillRect(0, 0, w, h);
  const R = MUSIC_LINES, px = (h * 0.7) / R.h, top = h * 0.15, x0 = w * 0.01, cw = (w * 0.98) / COLS;
  g.fillStyle = '#1c1f24'; g.fillRect(x0, top, w * 0.98, R.h * px);
  for (let i = 0; i < COLS; i++) {
    // (each place a whole number of pixels, edge to edge: no seams where two meet)
    const x = Math.round(x0 + i * cw), xw = Math.round(x0 + (i + 1) * cw) - x;
    for (let r = 0; r < 5; r++) {
      const y = top + (R.h - lineY(r)) * px;
      g.fillStyle = css(lineColour(PART_COLOURS[PART_IDS[r]], table[r * COLS + i]));
      g.fillRect(x, Math.round(y - R.line * px / 2), xw, Math.round(R.line * px));
    }
  }
}
function frame() { requestAnimationFrame(frame); if (!document.hidden) paintLights(); }
requestAnimationFrame(frame);
// (the rigs: the music, its screens and the lights)
window.MUSIC = { music, picture, controls, link, lights: () => ({ table: [...table] }) };
