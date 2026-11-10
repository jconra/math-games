// LIVE SCREENS: the ship's screens, moving. Every live screen (and every lamp that changes) on a ship is ONE material,
// so ONE draw for the lot: each screen face carries which programme it shows in its vertices, and the picture is worked
// out on the graphics card from the shared clock (kit/materials.js U.time). Nothing is drawn or uploaded per frame.
//
//   liveFace(p, o, at, rot)   a screen face showing a programme: o.show (a name or number from SHOWS), o.w, o.h, o.c (the
//                             8-sided face's corner cut), o.seed (0..1: two screens with the same programme and different
//                             seeds do not move in step), o.gain (brightness, 1). Facing +z before it is turned, centred
//                             on `at`. It is only the glowing face: the bezel is bits.js screen()'s.
//   liveLamp(p, o, at, rot)   a flat glowing plate o.w x o.h whose brightness changes: o.mode 'steady', 'flicker' (THE
//                             tired strip light, kit/shipparts/cabin/flicker.js: one on a ship), 'blink' (slow, eased:
//                             on for a second and a half every o.every seconds, 4), 'breathe' (a slow swell, o.every, 5);
//                             o.glow a glow name (kit/materials.js GLOW) or a linear colour; o.phase 0..1
//   liveScreenMaterial(o)     the material (o.time: the clock uniform, U.time by default; o.dark: false for the kit's
//                             blue panel instead of the dark one; o.palette: 'soft' or 'vivid', LIVE_PALETTES)
//   livePalette(m, name)      change a live material's palette while it runs (every screen at once)
//   liveTick(t)               once a frame: works out the flicker light's brightness for time t and hands it to the
//                             material; returns it (multiply the strip's pool of light by it)
//
// The programmes (SHOWS), each plainly a display: line drawings, glowing traces, readouts, in the ship's screen colours:
//   1 survey    a wire planet turning: lines of latitude and longitude, a marked spot, a moon on its ring
//   2 chart     a star chart drifting, a marker that locks on to one star after another, the course to it
//   3 rest      a sleeper's heartbeat sweeping across, the breathing under it, the rate
//   4 drive     the engine's readouts: a dial and its needle, bars, a trend line
//   5 scan      a scanner: rings, a sweep going round, what it found fading behind it
//   6 log       the ship's log: lines of text scrolling up, the newest typing itself out, a cursor
//   7 systems   a status board: AIR, POWER, HEAT, WATER, HULL, a lamp and a bar each; a lamp goes amber now and then
//   8 airlock   the same board for the airlock: INNER DOOR, OUTER DOOR, PRESSURE, SUITS, VENT
//   9 water     the washroom's: three tanks (COLD, HOT, WASTE), their levels lapping, FILTER and PUMP lamps
// Nothing in any of them blinks faster than once a second, and what blinks is small (a cursor, a lamp).
//
// THE WORDS come from one small sheet of its own (512 x 512, one channel, drawn once when the first material is made
// and never again): the log's lines, the labels, the digits. It holds each letter's distance to its edge, not its
// picture, so the words stay sharp on a big screen. One texture, one lookup per pixel.
import * as THREE from 'three';
import { shape, plate, add } from '../../bevel.js';
import { GLOW, U } from '../../materials.js';
import { flicker } from './flicker.js';
import { LIVE_VERTEX, liveFragment } from './live.glsl.js';

export const SHOWS = { lamp: 0, survey: 1, chart: 2, rest: 3, drive: 4, scan: 5, log: 6, systems: 7, airlock: 8, water: 9 };
export const SHOW_LABEL = ['lamp', 'wire planet', 'star chart', 'sleep trace', 'engine readouts', 'scanner sweep', "ship's log", 'systems board', 'airlock board', 'water tanks'];
export const LAMP_MODES = { steady: 0, flicker: 1, blink: 2, breathe: 3 };
// what the material shares: the flicker light's brightness this frame, which seed of flicker it is
export const LIVE = { flick: { value: 1 }, seed: 0, sheet: null, adv: 0.45 };
// the tag on the tired strip's pool of light (bits.js glowStrip o.flicker): multiply that pool by liveTick(t)
export const FLICKER_TAG = 'flicker';

export function liveTick(t) { LIVE.flick.value = flicker(t, LIVE.seed); return LIVE.flick.value; }

function showOf(s) {
  const n = typeof s === 'number' ? s : SHOWS[s];
  if (!(n >= 1 && n <= 9)) throw new Error('kit: no live screen ' + s);
  return n;
}
const setColor = (g, v) => {
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = v[0]; a[i * 3 + 1] = v[1]; a[i * 3 + 2] = v[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
};
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function liveFace(p, o = {}, at = [0, 0, 0], rot = [0, 0, 0]) {
  const w = o.w ?? 0.5, h = o.h ?? 0.3, c = o.c ?? o.oct ?? 0.012, show = showOf(o.show ?? 'survey');
  const g = plate(shape(w, h, c)), uv = g.attributes.uv.array, P = g.attributes.position.array;
  for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = P[i * 3] / w + 0.5; uv[i * 2 + 1] = P[i * 3 + 1] / h + 0.5; }
  add(p, [1, 1, 1], g, at, rot, 'live');   // (its colours are set below: they carry the programme, not a colour)
  // each vertex: brightness; programme (whole part) and seed (the part after the point); the face's width over its
  // height in hundredths (whole part) and its corner cut over its height (the part after the point, less a quarter:
  // nothing sits right on a whole number, where rounding on the way to the pixel could tip it over)
  setColor(g, [o.gain ?? 1, show + clamp(0.05 + 0.9 * ((o.seed ?? 0) % 1), 0.05, 0.95), Math.round(clamp(w / h, 0.2, 9) * 100) + 0.25 + clamp(c / h, 0, 0.5)]);
  return g;
}

export function liveLamp(p, o = {}, at = [0, 0, 0], rot = [0, 0, 0]) {
  const w = o.w ?? 0.3, h = o.h ?? 0.03, mode = LAMP_MODES[o.mode ?? 'steady'];
  if (mode === undefined) throw new Error('kit: no lamp mode ' + o.mode);
  const g = plate(shape(w, h, o.c ?? Math.min(w, h) * 0.25)), uv = g.attributes.uv.array;
  // (a lamp says so in its uv: 2 + its mode, and where in its cycle it starts with how long the cycle is)
  for (let i = 0; i < uv.length / 2; i++) { uv[i * 2] = 2 + mode; uv[i * 2 + 1] = Math.round(o.every ?? (mode === 3 ? 5 : 4)) + 0.02 + 0.96 * clamp((o.phase ?? 0) % 1, 0, 1); }
  add(p, [1, 1, 1], g, at, rot, 'live');
  const k = o.gain ?? 1, c = Array.isArray(o.glow) ? o.glow : GLOW[o.glow || 'strip'];
  setColor(g, [c[0] * k, c[1] * k, c[2] * k]);
  return g;
}

// ── the sheet of words ──────────────────────────────────────────────────────────────────────────────
// 512 x 512. Left half: the log's lines, 20 high. Right half: labels in two columns of cells 128 x 20 (label i in
// column floor(i / 25), row i % 25); cell 48 holds the signs, cell 49 the digits, each in a cell 12 wide.
const S = 512, ROW = 20, HI = 2, SPREAD = 4;
export const LOG = ['AIR MIX STEADY', 'HULL TEMP MINUS 41', 'REACTOR AT IDLE', 'WATER LOOP 2 PUMP OK', 'CABIN PRESSURE 101', 'DRIVE COILS COOL', 'STAR FIX GOOD 3 OF 3', 'SOLAR WIND LOW', 'GROW POD LIGHTS ON', 'FILTER 4 CLEAN IN 9 DAYS', 'BATTERY BANK FULL', 'ANTENNA TRACKING HOME',
  'DUST COUNT LOW', 'SPIN STEADY', 'COOLANT FLOW 12', 'DOCK CLAMPS FREE', 'CARGO BAY SEALED', 'NIGHT LIGHTS AT 30', 'SCAN SWEEP CLEAR', 'FUEL CELLS 88 PERCENT', 'ROUTE HELD', 'LAB FRIDGE MINUS 4', 'GALLEY HEATER OFF', 'ALL QUIET'];
export const LABELS = ['SURVEY', 'STAR CHART', 'REST', 'DRIVE', 'SCAN', 'SHIP LOG', 'SYSTEMS', 'AIRLOCK', 'WATER', 'TURN', 'RANGE', 'PULSE', 'THRUST', 'BREATH', 'TREND',
  'AIR', 'POWER', 'HEAT', 'WATER', 'HULL', 'INNER DOOR', 'OUTER DOOR', 'PRESSURE', 'SUITS', 'VENT', 'COLD', 'HOT', 'WASTE', 'FILTER', 'PUMP', 'FUEL', 'COILS', 'FLOW', 'TARGET', 'CLEAR'];
const SIGNS = '.:%-+/';

// how far each pixel is (squared) from the nearest pixel that is `on` (the two-pass method: columns, then rows)
function farFrom(on, N) {
  const INF = 1e10, f = new Float64Array(N), d = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1), out = new Float32Array(N * N);
  const pass = () => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < N; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < N; q++) { while (z[k + 1] < q) k++; const m = q - v[k]; d[q] = m * m + f[v[k]]; }
  };
  for (let x = 0; x < N; x++) { for (let y = 0; y < N; y++) f[y] = on[y * N + x] ? 0 : INF; pass(); for (let y = 0; y < N; y++) out[y * N + x] = d[y]; }
  for (let y = 0; y < N; y++) { for (let x = 0; x < N; x++) f[x] = out[y * N + x]; pass(); for (let x = 0; x < N; x++) out[y * N + x] = d[x]; }
  return out;
}

const FONT = `bold ${15 * HI}px "DejaVu Sans Mono", "Consolas", "Menlo", monospace`;
// one letter's step, in line heights (measured once: the shader is written with it)
function letterStep() {
  if (LIVE.step) return LIVE.adv;
  const g = document.createElement('canvas').getContext('2d'); g.font = FONT;
  LIVE.adv = g.measureText('0').width / HI / ROW; LIVE.step = true; return LIVE.adv;
}
export function liveSheet() {
  if (LIVE.sheet) return LIVE.sheet;
  const N = S * HI, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N); g.fillStyle = '#fff'; g.textBaseline = 'middle';
  g.font = FONT; letterStep();
  const midOf = (row) => (row * ROW + ROW / 2 + 1) * HI;
  LOG.forEach((s, i) => g.fillText('> ' + s, 3 * HI, midOf(i), 250 * HI));
  LABELS.forEach((s, i) => g.fillText(s, (256 + 128 * Math.floor(i / 25) + 3) * HI, midOf(i % 25), 122 * HI));
  g.textAlign = 'center';
  [...SIGNS].forEach((ch, i) => g.fillText(ch, (384 + 12 * i + 6) * HI, midOf(23)));
  [...'0123456789'].forEach((ch, i) => g.fillText(ch, (384 + 12 * i + 6) * HI, midOf(24)));
  const px = g.getImageData(0, 0, N, N).data, on = new Uint8Array(N * N), off = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) { on[i] = px[i * 4] > 127 ? 1 : 0; off[i] = 1 - on[i]; }
  const out = farFrom(on, N), ins = farFrom(off, N), data = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let a = 0;
    for (let j = 0; j < HI; j++) for (let i = 0; i < HI; i++) { const k = (y * HI + j) * N + x * HI + i; a += Math.sqrt(out[k]) - Math.sqrt(ins[k]); }
    data[y * S + x] = clamp(Math.round(255 * (0.5 - a / (HI * HI) / (2 * SPREAD * HI))), 0, 255);     // over a half: inside a letter
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.unpackAlignment = 1; t.needsUpdate = true; t.name = 'live words';
  return (LIVE.sheet = t);
}

// ── the colours ─────────────────────────────────────────────────────────────────────────────────────
// Two palettes (linear colours). 'soft' is the first one filmed: pale blues, the tone curve takes the bright parts
// toward white. 'vivid' is deeper and richer (the game's maker asked to see more colour, the pastels first): the same
// drawing, the blues deeper, the amber and the green stronger, the hot tank warm and the waste tank murky, the panel a
// deeper navy, and the whole deepened a little more at the end (sat). Not neon: nothing is brighter than before.
// panel: the panel behind the drawing, top and bottom.
export const LIVE_PALETTES = {
  soft: {
    ink: [0.62, 0.86, 1.0], line: [0.16, 0.55, 1.0], dim: [0.05, 0.2, 0.36], amb: [1.0, 0.48, 0.09], good: [0.2, 0.9, 0.72],
    hot: [0.465, 0.645, 0.75], waste: [0.3025, 0.3388, 0.4183], sat: 1, panel: [[0.012, 0.046, 0.078], [0.005, 0.02, 0.038]],
  },
  vivid: {
    ink: [0.3, 0.78, 1.0], line: [0.03, 0.36, 1.0], dim: [0.015, 0.11, 0.34], amb: [1.0, 0.3, 0.015], good: [0.04, 0.88, 0.3],
    hot: [1.0, 0.26, 0.02], waste: [0.3, 0.42, 0.04], sat: 1.3, panel: [[0.012, 0.046, 0.078], [0.005, 0.02, 0.038]],   // (the soft palette's teal panel: the game's maker found the deep navy one cold)
  },
};
// the palette a ship's screens wear unless told otherwise
export const LIVE_PALETTE = 'vivid';   // (his pick, 2026-11-10: the vivid colours on the teal panel)
// (the kit's brighter blue panel, for liveScreenMaterial({ dark: false }))
const BLUE_PANEL = [[0.018, 0.122, 0.212], [0.008, 0.05, 0.095]];
const UNI = { ink: 'C_INK', line: 'C_LINE', dim: 'C_DIM', amb: 'C_AMB', good: 'C_GOOD', hot: 'C_HOT', waste: 'C_WASTE' };

// put a palette on a live material (every screen drawn with it changes at once): a name from LIVE_PALETTES
export function livePalette(m, name = LIVE_PALETTE) {
  const P = LIVE_PALETTES[name]; if (!P) throw new Error('kit: no live palette ' + name);
  const u = m.uniforms, panel = m.userData.dark === false ? BLUE_PANEL : P.panel;
  for (const [k, n] of Object.entries(UNI)) u[n].value.set(...P[k]);
  u.uSat.value = P.sat; u.uPanelA.value.set(...panel[0]); u.uPanelB.value.set(...panel[1]);
  m.userData.palette = name;
  return m;
}

export function liveScreenMaterial(o = {}) {
  const V = () => ({ value: new THREE.Vector3() }); letterStep();
  const m = new THREE.ShaderMaterial({
    // (the words' sheet is drawn the first time a live screen is drawn, not when the material is made: every lab and
    // the game make the kit's materials, and most never draw a live screen)
    uniforms: {
      uTime: o.time || U.time, uFlick: LIVE.flick, uSheet: { get value() { return liveSheet(); } },
      uPanelA: V(), uPanelB: V(), uSat: { value: 1 },
      C_INK: V(), C_LINE: V(), C_DIM: V(), C_AMB: V(), C_GOOD: V(), C_HOT: V(), C_WASTE: V(),
    },
    vertexColors: true, fog: false, vertexShader: LIVE_VERTEX, fragmentShader: liveFragment({ adv: LIVE.adv, spread: SPREAD, lens: LOG.map((l) => l.length + 2) }),
  });
  m.name = 'live'; m.userData.dark = o.dark ?? true;
  return livePalette(m, o.palette ?? LIVE_PALETTE);
}
