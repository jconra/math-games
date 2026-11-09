// THE CABIN'S PRINT: the posters on a ship's walls, the signs over its doors, the stencils on its door leaves and
// control panels. Drawn into the kit's decal sheet (kit/tex.js decalAtlas) in cells 32 to 55, which the station's
// pieces never use; white on clear, tinted by the piece that shows it (kit/piece.js decal).
//
// POSTERS: the mess's slogans, in the order the mess hangs them (kit/shipparts/cabin/mess.js). The game's maker
// (2026-11-09): "I didn't pick any slogans, but if I did, it would be funny if they were about math." Change a text here
// and its poster changes: each is wrapped and sized to fit its poster by itself.
//   text  the slogan
//   art   the little picture over it: 'delta' (the crew's mark), 'planet', 'ruler', 'pizza' (eight slices, one taken),
//         or none
//   w, h  the poster's size on the wall, metres (its print keeps that shape)
export const POSTERS = [
  { text: 'GOOD CREWS CARRY THE ONE', art: 'delta', w: 0.42, h: 0.34 },           // the middle cabinet over the bench
  { text: 'EAT · SLEEP · MULTIPLY · REPEAT', art: 'planet', w: 0.4, h: 0.56 },     // the aft wall, over the bench
  { text: 'MEASURE TWICE, JUMP ONCE', art: 'ruler', w: 0.62, h: 0.36 },           // the hull side, under the cabinets
  { text: 'PIZZA IS JUST FRACTIONS YOU CAN EAT', art: 'pizza', w: 0.34, h: 0.46 },  // the cold store's door
];
// the sign over a door, by the kind of room it opens into
export const SIGNS = { cockpit: 'COCKPIT', science: 'SCIENCE LAB', galley: 'GALLEY', airlock: 'AIRLOCK', washroom: 'WASHROOM', bunks: 'BUNKS', engineering: 'ENGINEERING', medbay: 'MED BAY' };
// stencils on the door leaves and the control panels
export const STENCILS = { seal: 'PRESSURE SEAL', clear: 'KEEP CLEAR', standby: 'STANDBY' };

// the sheet's rects, by name: 'cabin:poster:<i>', 'cabin:sign:<kind>', 'cabin:seal', 'cabin:clear', 'cabin:standby',
// 'cabin:delta', 'cabin:arrow' (a button's arrow, pointing up)
// (drawn on a canvas of its own, its rows 8 to 13 then copied into the sheet's as they are: the browser draws a canvas's
// recorded strokes over again when it is read, and more strokes on the sheet's own canvas were seen to change a few
// pixels of the station's print elsewhere on it)
export function cabinPrint(g0, cell, uvOf, rect) {
  const c = document.createElement('canvas'); c.width = c.height = g0.canvas.width; const g = c.getContext('2d');
  draw(g, cell, uvOf, rect);
  g0.putImageData(g.getImageData(0, 8 * 64, c.width, 6 * 64), 0, 8 * 64);
}
function draw(g, cell, uvOf, rect) {
  const F = (px, w = 'bold') => `${w} ${px}px "DejaVu Sans", Arial, sans-serif`;
  const clip = (x, y, w, h, fn) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fn(); g.restore(); };
  const fit = (t, x, y, mw) => { const w = g.measureText(t).width, s = Math.min(1, mw / w); g.save(); g.translate(x, y); g.scale(s, 1); g.fillText(t, 0, 0); g.restore(); };
  // row 8 (cells 32-35): the stencils; the crew's mark and a panel's up/down arrows share cell 35
  [['seal', 32], ['clear', 33]].forEach(([k, i]) => { const [x, y] = cell(i); clip(x, y, 256, 64, () => { g.font = F(40); fit(STENCILS[k], x + 128, y + 33, 236); g.save(); g.globalCompositeOperation = 'destination-out'; for (let n = 0; n < 2; n++) g.fillRect(x, y + 22 + n * 19, 256, 2.5); g.restore(); }); rect['cabin:' + k] = uvOf(x, y, 256, 64); });
  { const [x, y] = cell(34); clip(x, y, 256, 64, () => { g.font = F(34); fit(STENCILS.standby, x + 128, y + 26, 220); g.fillRect(x + 40, y + 50, 176, 6); }); rect['cabin:standby'] = uvOf(x, y, 256, 64); }
  { const [x, y] = cell(35); clip(x, y, 64, 64, () => delta(g, x + 32, y + 34, 26)); rect['cabin:delta'] = uvOf(x, y, 64, 64);
    clip(x + 64, y, 64, 64, () => { g.beginPath(); g.moveTo(x + 96, y + 12); g.lineTo(x + 96 + 22, y + 50); g.lineTo(x + 96 - 22, y + 50); g.fill(); }); rect['cabin:arrow'] = uvOf(x + 64, y, 64, 64); }
  // rows 9-12 (cells 36-51): a 256 x 256 square for each poster, its print in the poster's own shape in the middle
  POSTERS.slice(0, 4).forEach((P, i) => {
    const x0 = i * 256, y0 = 9 * 64, asp = P.h / P.w, pw = asp >= 1 ? 256 / asp : 256, ph = asp >= 1 ? 256 : 256 * asp, x = x0 + (256 - pw) / 2, y = y0 + (256 - ph) / 2;
    clip(x, y, pw, ph, () => {
      const m = pw * 0.09, artH = P.art ? ph * (asp >= 1 ? 0.36 : 0.4) : 0;
      if (P.art) art(g, P.art, x + pw / 2, y + m + artH / 2, Math.min(pw - 2 * m, artH));
      // (the words wrapped to the width, as big as fit in what is left under the art)
      const tx = x + m, tw = pw - 2 * m, ty = y + m + artH + (P.art ? ph * 0.04 : 0), th = ph - (ty - y) - m;
      for (let px = 48; px >= 12; px -= 2) {
        g.font = F(px); const lines = balance(g, P.text, tw), lh = px * 1.12;
        if (lines.length * lh > th || lines.some((l) => g.measureText(l).width > tw)) continue;
        g.textAlign = 'left'; lines.forEach((l, k) => g.fillText(l, tx, ty + lh * (k + 0.5) + (th - lines.length * lh) * 0.15));
        g.fillRect(tx, Math.min(y + ph - m * 0.6, ty + lh * lines.length + (th - lines.length * lh) * 0.15 + px * 0.35), tw * 0.22, Math.max(3, px * 0.12));
        break;
      }
    });
    rect['cabin:poster:' + i] = uvOf(x, y, pw, ph);
  });
  // row 13 (cells 52-55): the signs over the doors, two to a cell (256 x 32)
  Object.entries(SIGNS).forEach(([k, t], i) => { const [cx, cy] = cell(52 + (i >> 1)), y = cy + (i & 1) * 32; clip(cx, y, 256, 32, () => { g.font = F(24); fit(t, cx + 128, y + 17, 240); }); rect['cabin:sign:' + k] = uvOf(cx, y, 256, 32); });
}
// (the same number of lines as wrapping to the width gives, but as even as they will go: no lone word on the last line)
function balance(g, text, w) {
  const n = wrap(g, text, w).length; let lo = 0, hi = w;
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (wrap(g, text, m).length > n) lo = m; else hi = m; }
  return wrap(g, text, hi);
}
function wrap(g, text, w) {
  const out = []; let line = '';
  for (const word of text.split(/\s+/)) { const t = line ? line + ' ' + word : word; if (line && g.measureText(t).width > w) { out.push(line); line = word; } else line = t; }
  if (line) out.push(line); return out;
}
// the crew's mark: an arrowhead, its foot notched (as the mugs and posters in his mess picture carry)
function delta(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.78, y + r * 0.72); g.lineTo(x, y + r * 0.3); g.lineTo(x - r * 0.78, y + r * 0.72); g.closePath(); g.fill(); }
function art(g, kind, x, y, s) {
  const r = s / 2;
  if (kind === 'delta') delta(g, x, y, r * 0.9);
  else if (kind === 'planet') {
    // a planet half lit (greys, so its tint keeps the shading), its ring
    const gr = g.createLinearGradient(x - r, y - r, x + r * 0.6, y + r * 0.6); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#9a9a9a'); gr.addColorStop(1, '#4a4a4a');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 0.7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.save(); g.translate(x, y); g.rotate(-0.35); g.scale(1, 0.28); g.lineWidth = r * 0.12; g.strokeStyle = '#d8d8d8'; g.beginPath(); g.arc(0, 0, r * 0.98, Math.PI * 0.05, Math.PI * 0.95); g.stroke(); g.restore();
  } else if (kind === 'ruler') {
    const w = s * 2.2, x0 = x - w / 2, h = r * 0.8; g.lineWidth = 3; g.strokeRect(x0, y - h / 2, w, h);
    for (let i = 0; i <= 20; i++) { const tx = x0 + w * i / 20, l = i % 10 === 0 ? h * 0.7 : i % 5 === 0 ? h * 0.5 : h * 0.3; g.fillRect(tx - 1.2, y - h / 2, 2.4, l); }
  } else if (kind === 'pizza') {
    // eight slices, one slid out of the round
    const R = r * 0.86; g.lineWidth = Math.max(2, R * 0.06);
    for (let i = 0; i < 8; i++) {
      const a0 = -Math.PI / 2 + i * Math.PI / 4, a1 = a0 + Math.PI / 4, am = (a0 + a1) / 2, out = i === 1 ? R * 0.22 : 0, cx = x + Math.cos(am) * out, cy = y + Math.sin(am) * out;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0 + 0.02, a1 - 0.02); g.closePath(); g.fill();
      g.save(); g.globalCompositeOperation = 'destination-out';
      for (const [k, d] of [[0.3, 0.45], [0.7, 0.62], [0.5, 0.8]]) { const a = a0 + (a1 - a0) * k; g.beginPath(); g.arc(cx + Math.cos(a) * R * d, cy + Math.sin(a) * R * d, R * 0.07, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
  }
}
