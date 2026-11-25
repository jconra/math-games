// THE MUSIC'S PICTURES: what a music screen shows when nobody is touching it. The game's maker, 2026-11-24: "I think we
// will need some visualizations too. So the screens can show visualizations and then if you interact with it then it
// shows the controls. It would be nice to have a visual that demonstrates that all the note information is there, and
// not just a spectrum analyzer, although that could be part of it too. Or we could have a few different visualization
// options."
//
// Each picture is a plain function, paint(g, f): it paints one whole picture on a 2D canvas context g from the frame f
// (src/music/tap.js T.frame(), plus w, h: the canvas's size in its own pixels, and memo: an object the picture may keep
// a little between pictures in, its own for each screen). No page elements: the same function can paint a wall
// screen's texture in the game ten or fifteen times a second. Dark with light lines, as the game's screens are; bold
// shapes and no small print, for a wall screen 46 cm by 25 cm seen from a few metres.
//
//   VISUALS   [{ id, label, paint }]: the Picture row's choices, in order
//     notes     every note of every part as it plays: a lane a part in its own colour, how high it is, how long, where
//               in the bar (the bar's lines and beats), the notes coming from the right before they sound
//     spectrum  the classic bars from the sound itself (the analyser), low notes on the left
//     orbit     the bar as a clock: the sixteen steps round a ring, a ring a part, each note lit on its ring as the
//               hand passes it, the ones about to play just ahead of the hand; the core flashes on each kick
//     sections  the song's map: its 8-bar sections as blocks going by, a strip in a part's colour where that part plays
//               there; the section now, the bar in it, and what comes next
//   PART_COLOURS   each part's colour
//   paintVisual(id, g, f)   paints the picture of that id (an unknown id: the first)
import { PART_IDS } from './song.js';

export const PART_COLOURS = { beat: '#ffd27a', bass: '#ff7fae', pads: '#b9a2ff', lead: '#8fd3ff', melody: '#7dffc8' };
const BG = '#070b11', GRID = 'rgba(150, 210, 250, 0.16)', GRID2 = 'rgba(150, 210, 250, 0.07)', CYAN = '#8fd3ff';
// the drums' rows, from the bottom: the kick, the snare and clap, the toms, the hats, the riser
const DRUM_ROW = { kick: 0, snare: 1, clap: 1, tom: 2, hat: 3, open: 3, riser: 4 }, DRUM_ROWS = 5;
const drumRow = (s) => DRUM_ROW[s] ?? 2;
// each pitched part's lane covers the notes it plays (every preset, every key: rigs/visuals-1/ranges.mjs)
const RANGES = { bass: [19, 64], pads: [45, 76], lead: [56, 84], melody: [58, 94] };
const WORDS = { a: 'Part A', b: 'Part B', c: 'Part C', rest: 'Rest', intro: 'Intro', groove: 'Groove', main: 'Main', peak: 'Peak',
  breakdown: 'Breakdown', build: 'Build', drop: 'Drop', break: 'Break', calm: 'Calm', riff: 'Riff', tune: 'Tune', low: 'Low', answer: 'Answer' };
export const sectionWord = (kind) => WORDS[kind] || String(kind || '').replace(/^./, (c) => c.toUpperCase());

const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };
const font = (px, w = 800) => `${w} ${Math.round(px)}px "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif`;
const partOn = (f, p) => f.song && f.song[p] && f.song[p] !== 'off';
function clear(g, f) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = BG; g.fillRect(0, 0, f.w, f.h); }
// a frame round the picture: the game's screens' eight-sided line
function border(g, f) {
  const c = Math.max(6, Math.min(f.w, f.h) * 0.05), i = Math.max(1, f.h * 0.008);
  g.strokeStyle = 'rgba(150, 210, 250, 0.5)'; g.lineWidth = Math.max(1.5, f.h * 0.006);
  g.beginPath(); g.moveTo(c, i); g.lineTo(f.w - c, i); g.lineTo(f.w - i, c); g.lineTo(f.w - i, f.h - c); g.lineTo(f.w - c, f.h - i);
  g.lineTo(c, f.h - i); g.lineTo(i, f.h - c); g.lineTo(i, c); g.closePath(); g.stroke();
}
// a bold word in a corner (the section; the song stopped)
function word(g, f, text, x, y, align = 'left', px = f.h * 0.1, colour = 'rgba(238, 241, 244, 0.92)') {
  g.font = font(px); g.textAlign = align; g.textBaseline = 'top'; g.fillStyle = colour; g.fillText(text.toUpperCase(), x, y);
}
function stopped(g, f) {
  // two bold bars: the music is stopped (nothing to show coming)
  const s = f.h * 0.16, x = f.w / 2, y = f.h / 2;
  g.fillStyle = 'rgba(150, 210, 250, 0.35)'; g.fillRect(x - s * 0.55, y - s / 2, s * 0.35, s); g.fillRect(x + s * 0.2, y - s / 2, s * 0.35, s);
}

// ── NOTES: a lane a part ─────────────────────────────────────────────────────────────────────────────────────────
const LANE = { beat: 1.15, bass: 1, pads: 1, lead: 1, melody: 1 };
function paintNotes(g, f) {
  clear(g, f);
  const { w, h } = f, pad = h * 0.05, top = pad, bot = h - pad, left = w * 0.02, right = w * 0.98;
  const back = 1, ahead = 2, span = back + ahead, nowX = left + (right - left) * (back / span);
  const bar = f.barDur || 2, x = (t) => nowX + ((t - f.now) / bar) * ((right - left) / span);
  const total = PART_IDS.reduce((a, p) => a + LANE[p], 0), gap = h * 0.012;
  let y0 = top;
  const lanes = {};
  for (const p of PART_IDS) { const lh = ((bot - top) * LANE[p]) / total; lanes[p] = { y: y0 + gap / 2, h: lh - gap }; y0 += lh; }
  // the lanes, dim where the part is off
  for (const p of PART_IDS) {
    const L = lanes[p], on = partOn(f, p);
    g.fillStyle = rgba(PART_COLOURS[p], on ? 0.06 : 0.02); g.fillRect(left, L.y, right - left, L.h);
    g.fillStyle = rgba(PART_COLOURS[p], on ? 0.55 : 0.15); g.fillRect(left, L.y, Math.max(3, w * 0.006), L.h);
  }
  // the bars' lines and the beats, moving with the music
  if (f.playing && f.bar >= 0) {
    const barStart = f.now - f.barPhase * bar;
    for (let k = -2; k <= 3; k++) for (let b = 0; b < 4; b++) {
      const xx = x(barStart + k * bar + (b * bar) / 4);
      if (xx < left || xx > right) continue;
      g.fillStyle = b ? GRID2 : GRID; g.fillRect(xx - (b ? 0.5 : 1), top, b ? 1 : 2, bot - top);
    }
  }
  if (!f.playing) { border(g, f); stopped(g, f); return; }
  // the notes
  for (const n of f.notes) {
    const L = lanes[n.part]; if (!L) continue;
    let yy, nh;
    if (n.part === 'beat') {
      const r = drumRow(n.sound), rows = DRUM_ROWS;
      nh = L.h / rows; yy = L.y + L.h - (r + 1) * nh; nh = Math.max(2, nh * 0.8);
    } else {
      const [lo, hi] = RANGES[n.part] || [36, 96], steps = hi - lo + 1, m = n.midi == null ? (lo + hi) / 2 : n.midi;
      nh = Math.max(5, (L.h / steps) * 3.2); yy = L.y + L.h - ((m - lo + 0.5) / steps) * L.h - nh / 2;
    }
    let x0 = x(n.at), x1 = x(n.at + n.dur);
    if (x1 < left || x0 > right) continue;
    x0 = Math.max(left, x0); x1 = Math.min(right, x1);
    const ww = Math.max(2.5, x1 - x0 - 1.5), col = PART_COLOURS[n.part];
    const sounding = n.at <= f.now && f.now < n.at + n.dur, past = n.at + n.dur <= f.now;
    if (sounding) {
      g.fillStyle = rgba(col, 0.35); g.fillRect(x0 - 2, yy - 2, ww + 4, nh + 4);
      g.fillStyle = '#ffffff'; g.globalAlpha = 0.55 + 0.45 * n.vel; g.fillRect(x0, yy, ww, nh); g.globalAlpha = 1;
      g.fillStyle = col; g.fillRect(x0, yy, Math.min(ww, Math.max(2, x(f.now) - x0)), nh);
    } else if (past) {
      g.fillStyle = rgba(col, 0.25 + 0.3 * n.vel); g.fillRect(x0, yy, ww, nh);
    } else {
      // coming: an outline in its colour, filling in as it nears
      g.strokeStyle = rgba(col, 0.5 + 0.4 * n.vel); g.lineWidth = Math.max(1, h * 0.004); g.strokeRect(x0 + 0.5, yy + 0.5, ww - 1, nh - 1);
    }
  }
  // now: a bright line that flares with the kick
  const k = f.pulse.kick;
  g.fillStyle = rgba('#8fd3ff', 0.18 + 0.3 * k); g.fillRect(nowX - 6 - 8 * k, top, 12 + 16 * k, bot - top);
  g.fillStyle = CYAN; g.fillRect(nowX - 1.5, top, 3, bot - top);
  border(g, f);
}

// ── SPECTRUM: the sound's levels ──────────────────────────────────────────────────────────────────────────────────
function paintSpectrum(g, f) {
  clear(g, f);
  const { w, h } = f, memo = f.memo || {}, N = w < 700 ? 20 : 28, lo = 35, hi = 14000;
  const left = w * 0.05, right = w * 0.95, base = h * 0.8, tall = h * 0.68, bw = (right - left) / N;
  // the floor line and its reflection
  g.fillStyle = GRID; g.fillRect(left, base + 1, right - left, 2);
  const s = f.spectrum, nyq = (f.sampleRate || 48000) / 2;
  if (!memo.peaks || memo.peaks.length !== N) { memo.peaks = new Float32Array(N); memo.vals = new Float32Array(N); }
  for (let i = 0; i < N; i++) {
    let v = 0;
    if (s && f.playing) {
      const f0 = lo * Math.pow(hi / lo, i / N), f1 = lo * Math.pow(hi / lo, (i + 1) / N);
      const a = Math.max(1, Math.floor((f0 / nyq) * s.length)), b = Math.max(a + 1, Math.ceil((f1 / nyq) * s.length));
      for (let j = a; j < b && j < s.length; j++) v = Math.max(v, s[j]);
      v = Math.max(0, (v / 255 - 0.12) / 0.88);
    }
    memo.vals[i] = v;
    memo.peaks[i] = Math.max(v, memo.peaks[i] - 0.012);
  }
  for (let i = 0; i < N; i++) {
    const v = memo.vals[i], x0 = left + i * bw + bw * 0.12, ww = bw * 0.76, hh = Math.max(2, v * tall);
    const t = i / (N - 1), col = t < 0.2 ? PART_COLOURS.bass : t < 0.55 ? CYAN : t < 0.8 ? PART_COLOURS.melody : PART_COLOURS.beat;
    // the bar in blocks, as a meter's lights
    const blocks = 14, bh = tall / blocks, lit = Math.round(v * blocks);
    for (let k = 0; k < blocks; k++) {
      const yy = base - (k + 1) * bh;
      g.fillStyle = k < lit ? col : 'rgba(150, 210, 250, 0.05)';
      g.globalAlpha = k < lit ? 0.55 + 0.45 * (k / blocks) : 1;
      g.fillRect(x0, yy + bh * 0.14, ww, bh * 0.72);
    }
    g.globalAlpha = 1;
    // the reflection on the floor
    g.fillStyle = rgba(col, 0.16); g.fillRect(x0, base + 4, ww, Math.min(h - base - 8, hh * 0.25));
    // the peak's cap, falling slowly
    const py = base - memo.peaks[i] * tall;
    if (memo.peaks[i] > 0.02) { g.fillStyle = '#ffffff'; g.fillRect(x0, py - Math.max(2, h * 0.008), ww, Math.max(2, h * 0.008)); }
  }
  f.memo = memo;
  if (!f.playing) stopped(g, f);
  border(g, f);
}

// ── ORBIT: the bar as a clock ─────────────────────────────────────────────────────────────────────────────────────
const RINGS = ['beat', 'bass', 'pads', 'lead', 'melody'];   // from the core outward
function paintOrbit(g, f) {
  clear(g, f);
  const { w, h } = f, cx = w / 2, cy = h / 2, R = h * 0.46, r0 = R * 0.3, ring = (R - r0) / RINGS.length;
  const ang = (ph) => -Math.PI / 2 + ph * Math.PI * 2;
  // the sixteen steps round the outside, the beats bolder
  for (let i = 0; i < 16; i++) {
    const a = ang(i / 16), b = i % 4 === 0, lit = f.playing && i === f.step;
    g.strokeStyle = lit ? CYAN : b ? 'rgba(150, 210, 250, 0.55)' : GRID; g.lineWidth = lit ? Math.max(3, h * 0.014) : b ? Math.max(2, h * 0.008) : Math.max(1, h * 0.004);
    g.beginPath(); g.moveTo(cx + Math.cos(a) * (R + h * 0.005), cy + Math.sin(a) * (R + h * 0.005)); g.lineTo(cx + Math.cos(a) * (R + h * (b ? 0.04 : 0.025)), cy + Math.sin(a) * (R + h * (b ? 0.04 : 0.025))); g.stroke();
  }
  // the rings: lit while their part has a note sounding, faint while it rests, dashed where it is off
  RINGS.forEach((p, i) => {
    const rr = r0 + ring * (i + 0.5), on = partOn(f, p), sounding = f.pulse.on[p];
    g.setLineDash(on ? [] : [h * 0.01, h * 0.015]);
    g.strokeStyle = rgba(PART_COLOURS[p], on ? 0.14 + 0.16 * sounding : 0.08); g.lineWidth = ring * 0.62;
    g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke();
  });
  g.setLineDash([]);
  if (!f.playing) { border(g, f); stopped(g, f); return; }
  // the notes on their rings: those of the last three quarters of a bar behind the hand, fading; the next quarter
  // ahead of it, as outlines
  const bar = f.barDur, barStart = f.now - f.barPhase * bar;
  for (const n of f.notes) {
    const i = RINGS.indexOf(n.part); if (i < 0) continue;
    const age = f.now - n.at;
    if (age > bar * 0.78 || age < -bar * 0.22) continue;
    const ph0 = (n.at - barStart) / bar, ph1 = ph0 + Math.min(n.dur, bar * 0.95) / bar;
    let off = 0.5;
    if (n.part === 'beat') off = (drumRow(n.sound) + 0.5) / DRUM_ROWS;
    else if (n.midi != null) { const [lo, hi] = RANGES[n.part]; off = (n.midi - lo) / (hi - lo); }
    const rr = r0 + ring * (i + 0.12 + 0.76 * Math.max(0, Math.min(1, off))), col = PART_COLOURS[n.part];
    const sounding = age >= 0 && age < n.dur;
    g.lineCap = 'round';
    if (age < 0) { g.strokeStyle = rgba(col, 0.55); g.lineWidth = Math.max(1.5, h * 0.006); }
    else { g.strokeStyle = sounding ? '#ffffff' : rgba(col, 0.85 * (1 - age / (bar * 0.78)) + 0.1); g.lineWidth = Math.max(2.5, ring * (sounding ? 0.34 : 0.24)); }
    g.beginPath(); g.arc(cx, cy, rr, ang(ph0), ang(Math.max(ph0 + 0.012, ph1 - 0.006))); g.stroke();
    if (sounding) { g.strokeStyle = rgba(col, 0.9); g.lineWidth = Math.max(1.5, ring * 0.14); g.stroke(); }
  }
  g.lineCap = 'butt';
  // the hand
  const a = ang(f.barPhase);
  g.strokeStyle = CYAN; g.lineWidth = Math.max(2, h * 0.008);
  g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (R + h * 0.03), cy + Math.sin(a) * (R + h * 0.03)); g.stroke();
  // the core: flashes with the kick, glows with the bass
  const k = f.pulse.kick, b = f.pulse.bass;
  g.fillStyle = rgba(PART_COLOURS.bass, 0.12 + 0.3 * b); g.beginPath(); g.arc(cx, cy, r0 * 0.86, 0, Math.PI * 2); g.fill();
  g.fillStyle = rgba('#ffffff', 0.12 + 0.8 * k); g.beginPath(); g.arc(cx, cy, r0 * (0.4 + 0.3 * k), 0, Math.PI * 2); g.fill();
  // the section, big, in the corner; the bar of 8 in it as dots under it
  word(g, f, sectionWord(f.section.kind), w * 0.04, h * 0.06);
  dots(g, f, w * 0.04, h * 0.06 + h * 0.13, h * 0.032);
  border(g, f);
}
// the bars of the section as eight dots, the one now lit
function dots(g, f, x, y, s) {
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i === f.section.barIn ? CYAN : i < f.section.barIn ? 'rgba(150, 210, 250, 0.45)' : 'rgba(150, 210, 250, 0.14)';
    g.fillRect(x + i * s * 1.5, y, s, s);
  }
}

// ── SECTIONS: the song's map ──────────────────────────────────────────────────────────────────────────────────────
function paintSections(g, f) {
  clear(g, f);
  const { w, h } = f, left = w * 0.03, right = w * 0.97, top = h * 0.3, bot = h * 0.9;
  const barW = (right - left) / 22, nowX = left + barW * 5;
  const pos = f.playing && f.bar >= 0 ? f.bar + f.barPhase : 0;
  const X = (bar) => nowX + (bar - pos) * barW;
  const stripH = (bot - top) / PART_IDS.length;
  for (const S of f.sections) {
    const x0 = X(S.from) + barW * 0.08, x1 = X(S.from + 8) - barW * 0.08;
    if (x1 < left || x0 > right) continue;
    const a = Math.max(left, x0), b = Math.min(right, x1), here = pos >= S.from && pos < S.from + 8;
    g.fillStyle = here ? 'rgba(150, 210, 250, 0.08)' : 'rgba(150, 210, 250, 0.03)'; g.fillRect(a, top, b - a, bot - top);
    PART_IDS.forEach((p, i) => {
      const m = S.mask[p], on = m && partOn(f, p);
      if (!on) return;
      const y = top + i * stripH + stripH * 0.14, sh = stripH * 0.72, col = PART_COLOURS[p];
      g.fillStyle = rgba(col, here ? 0.75 : 0.42);
      if (m === 'build') {
        // the beat building: a wedge, growing through the section
        g.beginPath(); g.moveTo(Math.max(a, x0), y + sh); g.lineTo(b, y + sh); g.lineTo(b, y + sh - sh * Math.min(1, (b - x0) / (x1 - x0))); g.closePath(); g.fill();
      } else g.fillRect(a, m === 'light' ? y + sh * 0.5 : y, b - a, m === 'light' ? sh * 0.5 : sh);
    });
    g.strokeStyle = here ? 'rgba(150, 210, 250, 0.8)' : 'rgba(150, 210, 250, 0.3)'; g.lineWidth = here ? Math.max(2, h * 0.008) : Math.max(1, h * 0.004);
    g.strokeRect(a, top, b - a, bot - top);
    // its eight bars, a thin dark cut between each
    g.fillStyle = BG;
    for (let k = 1; k < 8; k++) { const xx = X(S.from + k); if (xx > a && xx < b) g.fillRect(xx - Math.max(1, h * 0.003), top + 2, Math.max(2, h * 0.006), bot - top - 4); }
  }
  // the bars of the section ticking past, and now
  if (f.playing) {
    const k = f.pulse.kick;
    g.fillStyle = rgba('#8fd3ff', 0.15 + 0.3 * k); g.fillRect(nowX - 5 - 6 * k, top - h * 0.03, 10 + 12 * k, bot - top + h * 0.06);
    g.fillStyle = CYAN; g.fillRect(nowX - 1.5, top - h * 0.03, 3, bot - top + h * 0.06);
  }
  // the words: the section now, and what is next
  const S = f.sections.find((s) => pos >= s.from && pos < s.from + 8) || f.sections[0];
  const N = f.sections[f.sections.indexOf(S) + 1];
  word(g, f, sectionWord(S.kind), left, h * 0.06, 'left', h * 0.14);
  if (N) word(g, f, 'Next  ' + sectionWord(N.kind), right, h * 0.09, 'right', h * 0.085, 'rgba(167, 176, 186, 0.95)');
  if (!f.playing) stopped(g, f);
  border(g, f);
}

export const VISUALS = [
  { id: 'notes', label: 'Notes', paint: paintNotes },
  { id: 'spectrum', label: 'Spectrum', paint: paintSpectrum },
  { id: 'orbit', label: 'Orbit', paint: paintOrbit },
  { id: 'sections', label: 'Sections', paint: paintSections },
];
export const visualOf = (id) => VISUALS.find((v) => v.id === id) || VISUALS[0];
export function paintVisual(id, g, f) { visualOf(id).paint(g, f); }
