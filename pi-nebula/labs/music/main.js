// THE MUSIC LAB: the station's music (src/music/), and its control screen full page, to hear before any of it goes
// into the game. The game's maker, 2026-11-24: "Btw we should work on some music too ... We might want to make a lab
// for it." The screen is the game's own module (src/music/screen.js), with the "Heard in" row the lab has and a
// station wall will not. The music plays by itself here (its own audio context, made on the first Play).
// Beside it the same screen at a station wall screen's shape and about its size (the wall's own version: no "Heard
// in"), on one link with the big one: both show the same face and picture, a touch on either works. Under them a
// preview of the hallways' light bars (src/music/lights.js) from the same pulse numbers the game's bars will read.
import { createMusic } from '../../src/music/player.js';
import { mountMusicScreen, screenLink } from '../../src/music/screen.js';
import { tapOf } from '../../src/music/tap.js';
import { lightBars, LIGHT_STYLES, LIGHT_COLOURS } from '../../src/music/lights.js';

const KEEP = 'pi-nebula.music-lab';
const music = createMusic();
const link = screenLink();
const screen = mountMusicScreen(document.getElementById('screen'), music, { heardIn: true, keep: KEEP, link });
const wall = mountMusicScreen(document.getElementById('wall'), music, { heardIn: false, keep: KEEP, link, fit: true });

// ── the light bars ──────────────────────────────────────────────────────────────────────────────────────────────
const N = 24, cv = document.getElementById('lights'), g = cv.getContext('2d'), tap = tapOf(music);
let style = 'beat';
try { const v = localStorage.getItem(KEEP + '.lights'); if (LIGHT_STYLES.some((s) => s.id === v)) style = v; } catch (e) { /* */ }
const row = document.querySelector('[data-styles]');
row.className = 'styles';
row.innerHTML = LIGHT_STYLES.map((s) => `<button type="button" data-style="${s.id}">${s.label}</button>`).join('');
const lit = () => { for (const b of row.querySelectorAll('button')) b.classList.toggle('is-on', b.dataset.style === style); };
row.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; style = b.dataset.style; lit(); try { localStorage.setItem(KEEP + '.lights', style); } catch (er) { /* */ } });
lit();
let bright = new Float32Array(N);
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
function paintLights() {
  const d = Math.min(2, window.devicePixelRatio || 1), w = Math.round(cv.clientWidth * d), h = Math.round(cv.clientHeight * d);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const f = tap.frame();
  bright = lightBars(f.pulse, N, style, bright);
  const [r, gg, b] = hex(LIGHT_COLOURS[style]);
  g.fillStyle = '#05080c'; g.fillRect(0, 0, w, h);
  // a hallway wall: the strips standing on it, each one brightness (as its glowing material would be in the game)
  g.fillStyle = '#0c1118'; g.fillRect(0, h * 0.12, w, h * 0.76);
  const gap = w / N, bw = Math.max(4, gap * 0.34);
  for (let i = 0; i < N; i++) {
    const v = bright[i], x = gap * (i + 0.5) - bw / 2;
    g.fillStyle = `rgba(${r}, ${gg}, ${b}, ${0.1 + 0.3 * v})`; g.fillRect(x - bw * 0.7, h * 0.16, bw * 2.4, h * 0.68);   // its glow on the wall
    g.fillStyle = `rgb(${Math.round(20 + (r - 20) * v + (255 - r) * v * v * 0.5)}, ${Math.round(24 + (gg - 24) * v + (255 - gg) * v * v * 0.5)}, ${Math.round(30 + (b - 30) * v + (255 - b) * v * v * 0.5)})`;
    g.fillRect(x, h * 0.2, bw, h * 0.6);
  }
}
function frame() { requestAnimationFrame(frame); if (!document.hidden) paintLights(); }
requestAnimationFrame(frame);
// (the rigs: the music, its screens and the lights)
window.MUSIC = { music, screen, wall, link, lights: () => ({ style, bright: [...bright] }), setLights: (s) => { style = s; lit(); } };
