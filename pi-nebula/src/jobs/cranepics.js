// THE CRANE GAME'S HELP PICTURES (src/jobs/crane.js), drawn as the jobs' others are (src/jobs/pics.js): on a light card,
// the numbers given, the answer always a "?". Pure: the orders carry them ready made (help.svg), so node can test them.
// The grid is drawn as the game's view from above shows it: the bay door at the top, x to the right, y up.
//   grid(p)     the hangar's grid from above: its quadrants or its numbers, the crane and the place, a guide line
//               from the place to the numbers, four lettered marks, a move's two arrows, the two ways to go
//   line(p)     one axis as a number line (across for x, standing up for y): the crane's mark and the place's, the gap
//               or the squares to count, or a change with its sign
//   height(p)   the hoist's scale: the grab's height and the place's
//   legs(p)     a trip's two legs along one axis: from where it started to the canister, then on to its place
const INK = '#2b2219', SOFT = '#8a7558', ASK = '#b5523a', BLUE = '#4d8fd6', AMBER = '#e8922a', DARK = '#3a3f46', W = 360;
const svg = (h, body, w = W) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${body}</svg>`;
const text = (x, y, s, { size = 13, fill = INK, weight = 600, anchor = 'middle' } = {}) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="system-ui, sans-serif">${s}</text>`;
const n2 = (v) => String(Math.round(v * 100) / 100);
const ROMAN = ['I', 'II', 'III', 'IV'];
const arrow = (id, c) => `<defs><marker id="${id}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="${c}"/></marker></defs>`;
const crane = (x, y) => `<circle cx="${x}" cy="${y}" r="7" fill="${AMBER}" stroke="${INK}" stroke-width="1.4"/><path d="M${x - 11} ${y}h22M${x} ${y - 11}v22" stroke="${INK}" stroke-width="1.2"/>`;
const target = (x, y) => `<rect x="${x - 9}" y="${y - 5}" width="18" height="10" rx="4" fill="#ffd84a" stroke="${INK}" stroke-width="1.4"/>`;

export const DRAW = {
  // the hangar from above, x to the right and y up the page (the bay door at the top): the middle lines and the
  // quadrants' numbers, or the numbers along the edges; the crane and the place (grid coordinates, metres)
  grid({ size = [28, 40], crane: c = null, target: t = null, quads = false, numbers = false, guide = null, marks = null, arrows = null, path = false, ask = '' }) {
    const [X, Y] = size, tall = 250, s = Math.min((W - 120) / X, tall / Y), x0 = Math.round((W - X * s) / 2), y0 = 14, px = (x) => x0 + x * s, py = (y) => y0 + (Y - y) * s;
    let b = arrow('cg', ASK) + `<rect x="${x0}" y="${y0}" width="${X * s}" height="${Y * s}" fill="#f6efe0" stroke="${INK}" stroke-width="1.4"/>`;
    for (let x = 2; x < X; x += 2) b += `<path d="M${px(x)} ${y0}V${y0 + Y * s}" stroke="${SOFT}" stroke-width="${x % 10 ? 0.4 : 0.9}" opacity="0.7"/>`;
    for (let y = 2; y < Y; y += 2) b += `<path d="M${x0} ${py(y)}H${x0 + X * s}" stroke="${SOFT}" stroke-width="${y % 10 ? 0.4 : 0.9}" opacity="0.7"/>`;
    // (the bay door along the top)
    b += text(W / 2, y0 - 3, 'bay door', { size: 9.5, fill: SOFT, weight: 700 });
    if (quads) {
      b += `<path d="M${px(X / 2)} ${y0}V${y0 + Y * s}M${x0} ${py(Y / 2)}H${x0 + X * s}" stroke="${INK}" stroke-width="2.2"/>`;
      [[0.75, 0.75], [0.25, 0.75], [0.25, 0.25], [0.75, 0.25]].forEach(([fx, fy], i) => { b += text(px(X * fx), py(Y * fy) + 9, ROMAN[i], { size: 26, fill: BLUE, weight: 800 }); });
    }
    if (numbers) {
      for (let x = 0; x <= X; x += 10) b += text(px(x), y0 + Y * s + 13, String(x), { size: 10, fill: SOFT });
      for (let y = 0; y <= Y; y += 10) b += text(x0 - 6, py(y) + 4, String(y), { size: 10, fill: SOFT, anchor: 'end' });
      b += text(x0 + X * s + 4, y0 + Y * s + 13, 'x', { size: 11, weight: 800, anchor: 'start' }) + text(x0 - 14, y0 + 10, 'y', { size: 11, weight: 800 });
    }
    // (the way to read a place: straight down to x, straight across to y)
    if (guide && t) {
      if (guide !== 'y') b += `<path d="M${px(t[0])} ${py(t[1]) + 6}V${y0 + Y * s}" stroke="${BLUE}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
      if (guide !== 'x') b += `<path d="M${px(t[0]) - 10} ${py(t[1])}H${x0}" stroke="${BLUE}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
    }
    // (a move: across, then up or down, each its own arrow; the end a "?")
    if (arrows && c) {
      const [dx, dy] = arrows, mx = px(c[0] + dx), my = py(c[1] + dy);
      if (dx) b += `<path d="M${px(c[0])} ${py(c[1])}H${mx}" stroke="${ASK}" stroke-width="2.2" marker-end="url(#cg)"/>` + text((px(c[0]) + mx) / 2, py(c[1]) + (dy > 0 ? 14 : -6), `${Math.abs(dx)} m`, { size: 11, fill: ASK, weight: 800 });
      if (dy) b += `<path d="M${mx} ${py(c[1])}V${my}" stroke="${ASK}" stroke-width="2.2" marker-end="url(#cg)"/>` + text(mx + (dx >= 0 ? 6 : -6), (py(c[1]) + my) / 2 + 4, `${Math.abs(dy)} m`, { size: 11, fill: ASK, weight: 800, anchor: dx >= 0 ? 'start' : 'end' });
      b += text(mx + (dx >= 0 ? 8 : -8), my + (dy > 0 ? -6 : 14), '?', { size: 15, fill: ASK, weight: 800, anchor: dx >= 0 ? 'start' : 'end' });
    }
    // (the two ways to go, from the crane to the place: along x, then along y, each a "?")
    if (path && c && t) {
      b += `<path d="M${px(c[0])} ${py(c[1])}H${px(t[0])}V${py(t[1])}" fill="none" stroke="${ASK}" stroke-width="2" stroke-dasharray="6 4"/>`;
      b += text((px(c[0]) + px(t[0])) / 2, py(c[1]) + (t[1] > c[1] ? 15 : -7), '? m', { size: 11.5, fill: ASK, weight: 800 });
      b += text(px(t[0]) + (t[0] >= c[0] ? 7 : -7), (py(c[1]) + py(t[1])) / 2 + 4, '? m', { size: 11.5, fill: ASK, weight: 800, anchor: t[0] >= c[0] ? 'start' : 'end' });
    }
    if (marks) for (const m of marks) { const mx = px(m.at[0]), my = py(m.at[1]); b += `<circle cx="${mx}" cy="${my}" r="8" fill="#fff" stroke="${BLUE}" stroke-width="2"/>` + text(mx, my + 4, m.letter, { size: 10.5, fill: BLUE, weight: 800 }); }
    if (c) b += crane(px(c[0]), py(c[1]));
    if (t && !marks) b += target(px(t[0]), py(t[1]));
    if (ask) b += text(W / 2, y0 + Y * s + 32, ask, { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(y0 + Y * s + (ask ? 42 : 24), b), line: '' };
  },
  // one axis as a number line: from the crane's mark to the place's; squares to count, the gap as a "?", or a change
  // with its sign. Across for x, standing up for y (as the grid has them)
  line({ axis = 'x', from, to, count = false, read = false, signed = false }) {
    const lo = Math.min(from, to), hi = Math.max(from, to), pad = Math.max(1, (hi - lo) * 0.15), a = lo - pad, b2 = hi + pad;
    const span = b2 - a, every = span > 40 ? 10 : span > 16 ? 5 : span > 8 ? 2 : 1, whole = (v) => Math.abs(v - Math.round(v)) < 1e-6;
    const ask = signed ? (to < from ? '− ?' : '+ ?') : '? m';
    if (axis === 'y') {
      // standing up: y grows up the page, as on the grid
      const yT = 14, yB = 196, Y = (v) => yB - (v - a) * (yB - yT) / (b2 - a), x = 150;
      let s = arrow('cl', ASK) + `<path d="M${x} ${yT}V${yB}" stroke="${INK}" stroke-width="2"/>`;
      for (let v = Math.ceil(a); v <= b2; v++) { const big = v % every === 0; s += `<path d="M${x - (big ? 7 : 4)} ${Y(v)}H${x + (big ? 7 : 4)}" stroke="${INK}" stroke-width="${big ? 1.4 : 0.8}"/>`; if (big && !read) s += text(x - 12, Y(v) + 4, String(v), { size: 11, fill: SOFT, anchor: 'end' }); }
      if (count) for (let v = lo; v < hi - 1e-6; v++) s += `<path d="M${x + 12} ${Y(v) - 2}q12 ${(Y(v + 1) - Y(v)) / 2} 0 ${Y(v + 1) - Y(v) + 4}" fill="none" stroke="${BLUE}" stroke-width="1.6"/>`;
      s += crane(x + 34, Y(from)) + text(x + 50, Y(from) + 4, read ? '' : `y = ${n2(from)}`, { size: 12, weight: 800, anchor: 'start' });
      s += target(x + 34, Y(to)) + text(x + 50, Y(to) + 4, read ? '?' : `y = ${whole(to) ? to : n2(to)}`, { size: 12, weight: 800, fill: read ? ASK : INK, anchor: 'start' });
      if (!count && !read) s += `<path d="M${x - 46} ${Y(from)}V${Y(to)}" stroke="${ASK}" stroke-width="2" marker-end="url(#cl)"/>` + text(x - 54, (Y(from) + Y(to)) / 2 + 4, ask, { size: 13, fill: ASK, weight: 800, anchor: 'end' });
      return { svg: svg(210, s), line: '' };
    }
    const x0 = 24, x1 = W - 24, X = (v) => x0 + (v - a) * (x1 - x0) / (b2 - a), y = 52;
    let s = arrow('cl', ASK) + `<path d="M${x0} ${y}H${x1}" stroke="${INK}" stroke-width="2"/>`;
    for (let v = Math.ceil(a); v <= b2; v++) { const big = v % every === 0; s += `<path d="M${X(v)} ${y - (big ? 7 : 4)}V${y + (big ? 7 : 4)}" stroke="${INK}" stroke-width="${big ? 1.4 : 0.8}"/>`; if (big && !read) s += text(X(v), y + 22, String(v), { size: 11, fill: SOFT }); }
    if (count) for (let v = lo; v < hi - 1e-6; v++) s += `<path d="M${X(v) + 2} ${y - 12}Q${(X(v) + X(v + 1)) / 2} ${y - 26} ${X(v + 1) - 2} ${y - 12}" fill="none" stroke="${BLUE}" stroke-width="1.6"/>`;
    s += crane(X(from), y - 30) + text(X(from), y + 38, read ? '' : `x = ${n2(from)}`, { size: 12, weight: 800 });
    s += target(X(to), y - 30) + text(X(to), y + 38, read ? '?' : `x = ${whole(to) ? to : n2(to)}`, { size: 12, weight: 800, fill: read ? ASK : INK });
    if (!count && !read) s += `<path d="M${X(from)} ${y + 50}H${X(to)}" stroke="${ASK}" stroke-width="2" marker-end="url(#cl)"/>` + text((X(from) + X(to)) / 2, y + 66, ask, { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(count || read ? 100 : 124, s), line: '' };
  },
  // the hoist's scale, standing: the grab's height and the target's, the gap a "?" (or plus and minus)
  height({ from, to, signed = false, count = false }) {
    const top = Math.ceil(Math.max(from, to)) + 1, y0 = 14, y1 = 150, Y = (v) => y1 - (v / top) * (y1 - y0), x = 120;
    let s = arrow('ch', ASK) + `<path d="M${x} ${y0}V${y1}" stroke="${INK}" stroke-width="2"/><path d="M60 ${y1}H300" stroke="${SOFT}" stroke-width="1.4"/>`;
    for (let v = 0; v <= top; v++) s += `<path d="M${x - 6} ${Y(v)}H${x + 6}" stroke="${INK}" stroke-width="1.2"/>` + text(x - 12, Y(v) + 4, `${v} m`, { size: 10.5, fill: SOFT, anchor: 'end' });
    if (count) for (let v = Math.min(from, to); v < Math.max(from, to) - 1e-6; v++) s += `<path d="M${x + 10} ${Y(v) - 2}q10 ${-(Y(v) - Y(v + 1)) / 2} 0 ${-(Y(v) - Y(v + 1)) + 4}" fill="none" stroke="${BLUE}" stroke-width="1.6"/>`;
    s += `<rect x="${x + 24}" y="${Y(from) - 8}" width="36" height="16" rx="3" fill="${DARK}"/>` + text(x + 96, Y(from) + 4, `the grab, ${n2(from)} m`, { size: 11.5, weight: 700, anchor: 'start' });
    s += target(x + 42, Y(to)) + text(x + 96, Y(to) + 4, `${n2(to)} m`, { size: 11.5, weight: 700, anchor: 'start' });
    if (!count) s += `<path d="M${x + 70} ${Y(from) + 10}V${Y(to) - 10}" stroke="${ASK}" stroke-width="2" marker-end="url(#ch)"/>` + text(x + 82, (Y(from) + Y(to)) / 2 + 4, signed ? (to < from ? '− ?' : '+ ?') : '? m', { size: 13, fill: ASK, weight: 800, anchor: 'start' });
    return { svg: svg(162, s), line: '' };
  },
  // a trip's two legs along one axis: from where it started (p0) to the canister (a), then on to its place (b); the
  // first leg's length when the card gives it; both legs together a "?"
  legs({ axis = 'x', p0, a, b, given = null }) {
    const lo = Math.min(p0, a, b), hi = Math.max(p0, a, b), pad = Math.max(1, (hi - lo) * 0.12), L = lo - pad, H = hi + pad;
    const x0 = 24, x1 = W - 24, X = (v) => x0 + (v - L) * (x1 - x0) / (H - L), y = 96;
    let s = arrow('cs', ASK) + arrow('cs2', BLUE) + `<path d="M${x0} ${y}H${x1}" stroke="${INK}" stroke-width="2"/>`;
    for (const [v, w] of [[p0, 'start'], [a, 'canister'], [b, 'its place']]) s += `<path d="M${X(v)} ${y - 7}V${y + 7}" stroke="${INK}" stroke-width="1.4"/>` + text(X(v), y + 22, `${axis} = ${n2(v)}`, { size: 11.5, weight: 700 }) + text(X(v), y + 37, w, { size: 10.5, fill: SOFT });
    s += `<path d="M${X(p0)} ${y - 40}C${X(p0)} ${y - 62} ${X(a)} ${y - 62} ${X(a)} ${y - 44}" fill="none" stroke="${BLUE}" stroke-width="2" marker-end="url(#cs2)"/>` + text((X(p0) + X(a)) / 2, y - 64, given != null ? `1st leg: ${n2(given)} m` : '1st leg: ? m', { size: 11.5, fill: BLUE, weight: 800 });
    s += `<path d="M${X(a)} ${y - 14}C${X(a)} ${y - 32} ${X(b)} ${y - 32} ${X(b)} ${y - 16}" fill="none" stroke="${ASK}" stroke-width="2" marker-end="url(#cs)"/>` + text((X(a) + X(b)) / 2, y - 30, '2nd leg: ? m', { size: 11.5, fill: ASK, weight: 800 });
    s += text(W / 2, y + 62, 'both legs together = ? m', { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(y + 72, s), line: '' };
  },
};
export const picture = (p) => (p && DRAW[p.kind] ? DRAW[p.kind](p).svg : '');
