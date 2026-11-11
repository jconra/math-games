// THE CABIN'S PRINT: the posters on a ship's walls, the signs over its doors, the stencils on its door leaves and
// control panels, the numbers and labels on its fittings. Drawn into the kit's decal sheet (kit/tex.js decalAtlas) in
// cells 24 to 55, which the station's pieces never use; white on clear, tinted by the piece that shows it (kit/piece.js
// decal).
//
// POSTERS: every room's slogans, in one list. The game's maker (2026-11-09): "I didn't pick any slogans, but if I did, it
// would be funny if they were about math." Change a text here and its poster changes: each is wrapped and sized to fit
// its poster by itself. The first four are the mess's (kit/shipparts/cabin/mess.js hangs them by number, in this order);
// the rest name their room's kind, and kit/ships/cabin-furnish.js hangs a room's in the order they come here (move a
// line to swap two, change `room` to move one).
//   text  the slogan
//   art   the little picture over it: 'delta' (the crew's mark), 'planet', 'ruler', 'pizza' (eight slices, one taken),
//         'pipes' (two parallel lines), or none
//   w, h  the poster's size on the wall, metres (its print keeps that shape)
//   room  the kind of room it hangs in (the mess's four: galley)
// (The mess's four are drawn 256 px across; the others 128 px, room for eight in the sheet's cells 24 to 31: about 380
// px a metre on a 0.34 m poster.)
export const POSTERS = [
  { text: 'GOOD CREWS CARRY THE ONE', art: 'delta', w: 0.42, h: 0.34, room: 'galley' },           // the middle cabinet over the bench
  { text: 'EAT · SLEEP · MULTIPLY · REPEAT', art: 'planet', w: 0.4, h: 0.56, room: 'galley' },     // the aft wall, over the bench
  { text: 'MEASURE TWICE, JUMP ONCE', art: 'ruler', w: 0.62, h: 0.36, room: 'galley' },           // the hull side, under the cabinets
  { text: 'PIZZA IS JUST FRACTIONS YOU CAN EAT', art: 'pizza', w: 0.34, h: 0.46, room: 'galley' },  // the cold store's door
  { text: 'CAN\'T SLEEP? COUNT BY 7s', w: 0.34, h: 0.34, room: 'bunks' },                          // a locker's upper door
  { text: 'LIGHTS OUT IN 10, 9, 8...', w: 0.34, h: 0.34, room: 'bunks' },                         // the other side's locker
  { text: 'WASH FOR 20 SECONDS. THAT\'S 4 × 5.', w: 0.34, h: 0.34, room: 'washroom' },
  { text: 'HYPOTHESIS: MATH IS FUN. RESULT: CONFIRMED.', w: 0.44, h: 0.34, room: 'science' },
  { text: 'SHOW YOUR WORK, CADET', w: 0.34, h: 0.34, room: 'science' },
  { text: 'ZERO GRAVITY. ZERO ERRORS.', w: 0.34, h: 0.34, room: 'engineering' },
  { text: 'PARALLEL LINES NEVER MEET. LIKE THESE PIPES.', art: 'pipes', w: 0.44, h: 0.34, room: 'engineering' },   // under the pipes
  { text: 'SUIT CHECK: 1 HELMET + 2 GLOVES + 2 BOOTS = 5', w: 0.44, h: 0.34, room: 'airlock' },
];
// a room kind's posters, as POSTERS indices, in order
export const postersFor = (kind) => POSTERS.map((P, i) => (P.room === kind ? i : -1)).filter((i) => i >= 0);
// the labels on the fittings ('cabin:label:<key>'): the lab bench's drawers (his science picture), the sample case, the
// reactor, the suit and tool lockers
export const LABELS = { bio: 'BIO', chem: 'CHEM', suits: 'SUITS', tools: 'TOOLS', samples: 'SAMPLES', reactor: 'REACTOR', analysis: 'ANALYSIS' };
// the numbers on the berths and their lockers ('cabin:num:<n>', 1 to 8: printed 01 to 08)
export const NUMBERS = 8;
// the sign over a door, by the kind of room it opens into
export const SIGNS = { cockpit: 'COCKPIT', science: 'SCIENCE LAB', galley: 'GALLEY', airlock: 'AIRLOCK', washroom: 'WASHROOM', bunks: 'BUNKS', engineering: 'ENGINEERING', medbay: 'MED BAY' };
// stencils on the door leaves and the control panels
export const STENCILS = { seal: 'PRESSURE SEAL', clear: 'KEEP CLEAR', standby: 'STANDBY' };

// the sheet's rects, by name: 'cabin:poster:<i>', 'cabin:sign:<kind>', 'cabin:seal', 'cabin:clear', 'cabin:standby',
// 'cabin:delta', 'cabin:arrow' (a button's arrow, pointing up), 'cabin:label:<key>' (LABELS), 'cabin:num:<n>' (1 to 8)
// Where they are (the sheet's rows of 64 px, 4 cells of 256 a row):
//   rows 6-7 (cells 24-31)   the rooms' posters (POSTERS 4 on), 128 px squares, eight across
//   row 8 (cells 32-35)      the stencils; the crew's mark and a button's arrow, then the numbers (32 px each)
//   rows 9-12 (cells 36-51)  the mess's four posters, 256 px squares; under poster 0 and poster 2 a strip of labels
//   row 13 (cells 52-55)     the signs over the doors
// (drawn on a canvas of its own, its rows 6 to 13 then copied into the sheet's as they are: the browser draws a canvas's
// recorded strokes over again when it is read, and more strokes on the sheet's own canvas were seen to change a few
// pixels of the station's print elsewhere on it)
export function cabinPrint(g0, cell, uvOf, rect) {
  const c = document.createElement('canvas'); c.width = c.height = g0.canvas.width; const g = c.getContext('2d');
  draw(g, cell, uvOf, rect);
  g0.putImageData(g.getImageData(0, 6 * 64, c.width, 8 * 64), 0, 6 * 64);
}
// each poster's box in the sheet [x, y, w, h]: its print as big as fits in it, in its own shape (the mess's 0 and 2 less a
// strip under them for the labels)
const SLOT = (i) => (i < 4 ? [i * 256, 576, 256, i === 0 ? 204 : i === 2 ? 146 : 256] : [(i - 4) * 128, 384, 128, 128]);
// the labels' places: four short ones under poster 0, three long ones under poster 2
const LABEL_AT = { bio: [0, 796, 64, 32], chem: [64, 796, 64, 32], suits: [128, 796, 64, 32], tools: [192, 796, 64, 32], samples: [512, 724, 256, 32], reactor: [512, 758, 256, 32], analysis: [512, 792, 256, 32] };
function draw(g, cell, uvOf, rect) {
  const F = (px, w = 'bold') => `${w} ${px}px "DejaVu Sans", Arial, sans-serif`;
  const clip = (x, y, w, h, fn) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fn(); g.restore(); };
  const fit = (t, x, y, mw) => { const w = g.measureText(t).width, s = Math.min(1, mw / w); g.save(); g.translate(x, y); g.scale(s, 1); g.fillText(t, 0, 0); g.restore(); };
  // row 8 (cells 32-35): the stencils; the crew's mark and a panel's up/down arrows share cell 35
  [['seal', 32], ['clear', 33]].forEach(([k, i]) => { const [x, y] = cell(i); clip(x, y, 256, 64, () => { g.font = F(40); fit(STENCILS[k], x + 128, y + 33, 236); g.save(); g.globalCompositeOperation = 'destination-out'; for (let n = 0; n < 2; n++) g.fillRect(x, y + 22 + n * 19, 256, 2.5); g.restore(); }); rect['cabin:' + k] = uvOf(x, y, 256, 64); });
  { const [x, y] = cell(34); clip(x, y, 256, 64, () => { g.font = F(34); fit(STENCILS.standby, x + 128, y + 26, 220); g.fillRect(x + 40, y + 50, 176, 6); }); rect['cabin:standby'] = uvOf(x, y, 256, 64); }
  { const [x, y] = cell(35); clip(x, y, 64, 64, () => delta(g, x + 32, y + 34, 26)); rect['cabin:delta'] = uvOf(x, y, 64, 64);
    clip(x + 64, y, 64, 64, () => { g.beginPath(); g.moveTo(x + 96, y + 12); g.lineTo(x + 96 + 22, y + 50); g.lineTo(x + 96 - 22, y + 50); g.fill(); }); rect['cabin:arrow'] = uvOf(x + 64, y, 64, 64); }
  // the posters: each in its box (SLOT), its print in the poster's own shape, centred across, at the box's top (in the
  // middle of a square box)
  if (POSTERS.length > 12) throw new Error('kit: the cabin\'s print has room for 12 posters');
  POSTERS.forEach((P, i) => {
    const [x0, y0, bw, bh] = SLOT(i), asp = P.h / P.w, s = bw / 256;
    let pw = asp >= 1 ? bh / asp : bw, ph = asp >= 1 ? bh : bw * asp; if (pw > bw) { ph *= bw / pw; pw = bw; } if (ph > bh) { pw *= bh / ph; ph = bh; }
    const x = x0 + (bw - pw) / 2, y = y0 + (bw === bh ? (bh - ph) / 2 : 0);
    clip(x, y, pw, ph, () => {
      const m = pw * 0.09, artH = P.art ? ph * (asp >= 1 ? 0.36 : 0.4) * (i < 4 ? 1 : 0.7) : 0;
      if (P.art) art(g, P.art, x + pw / 2, y + m + artH / 2, Math.min(pw - 2 * m, artH));
      // (the words wrapped to the width, as big as fit in what is left under the art)
      const tx = x + m, tw = pw - 2 * m, ty = y + m + artH + (P.art ? ph * 0.04 : 0), th = ph - (ty - y) - m;
      for (let px = Math.round(48 * s); px >= (i < 4 ? 12 : 8); px -= i < 4 ? 2 : 1) {
        g.font = F(px); const lines = balance(g, P.text, tw), lh = px * 1.12;
        if (lines.length * lh > th || lines.some((l) => g.measureText(l).width > tw)) continue;
        g.textAlign = 'left'; lines.forEach((l, k) => g.fillText(l, tx, ty + lh * (k + 0.5) + (th - lines.length * lh) * 0.15));
        g.fillRect(tx, Math.min(y + ph - m * 0.6, ty + lh * lines.length + (th - lines.length * lh) * 0.15 + px * 0.35), tw * 0.22, Math.max(i < 4 ? 3 : 2, px * 0.12));
        break;
      }
    });
    rect['cabin:poster:' + i] = uvOf(x, y, pw, ph);
  });
  // the labels, and the numbers (in cell 35, after the mark and the arrow)
  for (const [k, [x, y, w, h]] of Object.entries(LABEL_AT)) { clip(x, y, w, h, () => { g.font = F(22); fit(LABELS[k], x + w / 2, y + h / 2 + 1, w - 8); }); rect['cabin:label:' + k] = uvOf(x, y, w, h); }
  for (let n = 1; n <= NUMBERS; n++) { const [cx, cy] = cell(35), x = cx + 128 + ((n - 1) % 4) * 32, y = cy + ((n - 1) >> 2) * 32; clip(x, y, 32, 32, () => { g.font = F(22); fit(String(n).padStart(2, '0'), x + 16, y + 17, 29); }); rect['cabin:num:' + n] = uvOf(x, y, 32, 32); }
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
  } else if (kind === 'pipes') {
    // two pipes side by side, a flange on each end: parallel, never meeting
    const w = s * 2.4, x0 = x - w / 2, t = Math.max(3, r * 0.22);
    for (const dy of [-r * 0.4, r * 0.4]) { g.fillRect(x0, y + dy - t / 2, w, t); for (const fx of [x0, x0 + w - t * 0.9]) g.fillRect(fx, y + dy - t, t * 0.9, t * 2); }
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
