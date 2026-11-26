// THE MUSIC LAB: the station's music (src/music/), and its control screen full page, to hear before any of it goes
// into the game. The game's maker, 2026-11-24: "Btw we should work on some music too ... We might want to make a lab
// for it." The screen is the game's own module (src/music/screen.js), with the "Heard in" row the lab has and a
// station wall will not. The music plays by itself here (its own audio context, made on the first Play).
// Beside it the same screen at a station wall screen's shape and about its size (the wall's own version: no "Heard
// in"), on one link with the big one: both show the same face and picture, a touch on either works. Under them a
// preview of the hallways' lines (src/music/lights.js: a line a part, brightest along it where its notes are, the one
// style the game's maker chose) drawn as the game's hallways draw them: long, at the same thickness.
// The lab's "Notes" row on the big screen (lab only, as "Heard in" is; MUSICGAME 1): Live, every note made by the
// engine as it plays; Pre-rendered, each different note rendered once in the background and played back
// (src/music/bake.js), as the game plays it, so the two can be compared by ear. Kept in this browser
// ('pi-nebula.music-lab.notes'); Pre-rendered at first. Under it a small line: how many notes are rendered.
import { createMusic } from '../../src/music/player.js';
import { mountMusicScreen, screenLink } from '../../src/music/screen.js';
import { tapOf } from '../../src/music/tap.js';
import { lightLines, LINE_LOOK } from '../../src/music/lights.js';
import { PART_COLOURS } from '../../src/music/visuals.js';
import { PART_IDS } from '../../src/music/song.js';

const KEEP = 'pi-nebula.music-lab';
let notes = 'baked';
try { if (localStorage.getItem(KEEP + '.notes') === 'live') notes = 'live'; } catch (e) { /* blocked: pre-rendered */ }
const music = createMusic({ notes });
const link = screenLink();
const screen = mountMusicScreen(document.getElementById('screen'), music, { heardIn: true, notes: true, keep: KEEP, link });
// (what is rendered so far, once a second: MUSICGAME 1)
setInterval(() => {
  const said = document.querySelector('#screen [data-baked]'), B = music.bakery; if (!said) return;
  if (music.notes !== 'baked' || !B) { said.textContent = music.notes === 'live' ? 'Every note made as it plays.' : ''; return; }
  const s = B.stats();
  said.textContent = `${s.baked} notes rendered (${s.MB} MB)${s.queued ? `, ${s.queued} to come` : ''}; played back ${s.played}, live ${s.live}`;
}, 1000);
const wall = mountMusicScreen(document.getElementById('wall'), music, { heardIn: false, keep: KEEP, link, fit: true });

// ── the hallway lines ────────────────────────────────────────────────────────────────────────────────────────────
// (the one style the game's maker chose, as the game's hallways draw it: src/music/lights.js LINE_LOOK, the lines a
// little thicker than this preview first drew them)
const cv = document.getElementById('lights'), g = cv.getContext('2d'), tap = tapOf(music);
const COLS = 128;
let table = new Float32Array(5 * COLS);
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const RGB = Object.fromEntries(PART_IDS.map((p) => [p, hex(PART_COLOURS[p])]));
// the lines along a hallway wall: five long lines, each place along a line as bright as the table says; the wall's
// metres to the canvas's pixels by the gap between two lines (LINE_LOOK.gap)
function paintLights() {
  const d = Math.min(2, window.devicePixelRatio || 1), w = Math.round(cv.clientWidth * d), h = Math.round(cv.clientHeight * d);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  table = lightLines(tap.frame(), COLS, table);
  g.fillStyle = '#05080c'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#0c1118'; g.fillRect(0, h * 0.12, w, h * 0.76);
  const gap = h * 0.13, px = gap / LINE_LOOK.gap, x0 = w * 0.01, cw = (w * 0.98) / COLS;
  const lw = Math.max(2, LINE_LOOK.core * px), glow = Math.max(6, LINE_LOOK.glow * px);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < COLS; i++) {
    // (each place a whole number of pixels, edge to edge: no seams where two meet)
    const x = Math.round(x0 + i * cw), xw = Math.round(x0 + (i + 1) * cw) - x;
    for (let r = 0; r < 5; r++) {
      const v = table[r * COLS + i], [cr, cg, cb] = RGB[PART_IDS[r]], y = h * 0.24 + gap * r;
      if (v < 0.01) continue;
      // its glow on the wall, then the line itself (going toward white where it is brightest)
      g.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${LINE_LOOK.halo * v})`; g.fillRect(x, y - glow / 2, xw, glow);
      const k = v * v * LINE_LOOK.white;
      g.fillStyle = `rgba(${Math.round(cr + (255 - cr) * k)}, ${Math.round(cg + (255 - cg) * k)}, ${Math.round(cb + (255 - cb) * k)}, ${Math.min(1, LINE_LOOK.base + v)})`;
      g.fillRect(x, y - lw / 2, xw, lw);
    }
  }
  g.globalCompositeOperation = 'source-over';
}
function frame() { requestAnimationFrame(frame); if (!document.hidden) paintLights(); }
requestAnimationFrame(frame);
// (the rigs: the music, its screens and the lights)
window.MUSIC = { music, screen, wall, link, lights: () => ({ table: [...table] }) };
