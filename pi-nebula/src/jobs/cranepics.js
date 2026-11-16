// THE CRANE GAME'S HELP PICTURES (src/jobs/crane.js), drawn as the jobs' others are (src/jobs/pics.js): on a light card,
// the numbers given, the answer always a "?". Pure: the orders carry them ready made (help.svg), so node can test them.
//   grid(p)     the hangar's grid from above, its quadrants or its numbers, the crane and the target
//   line(p)     one axis as a number line: the crane's mark and the target's, the gap or the squares to count
//   height(p)   the hoist's scale: the grab's height and the target's
//   turn(p)     the canister seen from above, the way it lies and the way it must go
//   speed(p)    a move at a speed: metres in each second
//   both(p)     two moves at once: each one's time, the longer one
//   straight(p) the move along x and along y, and the straight line between
const INK = '#2b2219', SOFT = '#8a7558', FILL = '#ead9b2', ASK = '#b5523a', BLUE = '#4d8fd6', AMBER = '#e8922a', DARK = '#3a3f46', W = 360;
const svg = (h, body) => `<svg viewBox="0 0 ${W} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg">${body}</svg>`;
const text = (x, y, s, { size = 13, fill = INK, weight = 600, anchor = 'middle' } = {}) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="system-ui, sans-serif">${s}</text>`;
const n2 = (v) => String(Math.round(v * 100) / 100);
const ROMAN = ['I', 'II', 'III', 'IV'];
const arrow = (id, c) => `<defs><marker id="${id}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="${c}"/></marker></defs>`;
const crane = (x, y) => `<circle cx="${x}" cy="${y}" r="7" fill="${AMBER}" stroke="${INK}" stroke-width="1.4"/><path d="M${x - 11} ${y}h22M${x} ${y - 11}v22" stroke="${INK}" stroke-width="1.2"/>`;
const target = (x, y) => `<rect x="${x - 9}" y="${y - 5}" width="18" height="10" rx="4" fill="#ffd84a" stroke="${INK}" stroke-width="1.4"/>`;

export const DRAW = {
  // the hangar from above: 40 by 28 m, x to the right, y up the page; the middle lines and the quadrants' numbers,
  // or the numbers along the edges; the crane and the target (grid coordinates, metres)
  grid({ size = [40, 28], crane: c = null, target: t = null, quads = false, numbers = false, ask = '' }) {
    const [X, Y] = size, x0 = 34, y0 = 12, s = Math.min((W - 52) / X, 170 / Y), px = (x) => x0 + x * s, py = (y) => y0 + (Y - y) * s;
    let b = `<rect x="${x0}" y="${y0}" width="${X * s}" height="${Y * s}" fill="#f6efe0" stroke="${INK}" stroke-width="1.4"/>`;
    for (let x = 2; x < X; x += 2) b += `<path d="M${px(x)} ${y0}V${y0 + Y * s}" stroke="${SOFT}" stroke-width="${x % 10 ? 0.4 : 0.9}" opacity="0.7"/>`;
    for (let y = 2; y < Y; y += 2) b += `<path d="M${x0} ${py(y)}H${x0 + X * s}" stroke="${SOFT}" stroke-width="${y % 10 ? 0.4 : 0.9}" opacity="0.7"/>`;
    if (quads) {
      b += `<path d="M${px(X / 2)} ${y0}V${y0 + Y * s}M${x0} ${py(Y / 2)}H${x0 + X * s}" stroke="${INK}" stroke-width="2.2"/>`;
      [[0.75, 0.75], [0.25, 0.75], [0.25, 0.25], [0.75, 0.25]].forEach(([fx, fy], i) => { b += text(px(X * fx), py(Y * fy) + 9, ROMAN[i], { size: 26, fill: BLUE, weight: 800 }); });
    }
    if (numbers) {
      for (let x = 0; x <= X; x += 10) b += text(px(x), y0 + Y * s + 13, String(x), { size: 10, fill: SOFT });
      for (let y = 0; y <= Y; y += 10) b += text(x0 - 6, py(y) + 4, String(y), { size: 10, fill: SOFT, anchor: 'end' });
      b += text(x0 + X * s - 4, y0 + Y * s + 13, 'x', { size: 11, weight: 800, anchor: 'end' }) + text(x0 - 14, y0 + 10, 'y', { size: 11, weight: 800 });
    }
    if (c) b += crane(px(c[0]), py(c[1]));
    if (t) b += target(px(t[0]), py(t[1]));
    if (ask) b += text(W / 2, y0 + Y * s + 30, ask, { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(y0 + Y * s + (ask ? 40 : 22), b), line: '' };
  },
  // one axis as a number line: from the crane's mark to the target's; squares to count, or the gap as a "?"
  line({ axis = 'x', from, to, count = false, read = false }) {
    const lo = Math.min(from, to), hi = Math.max(from, to), pad = Math.max(1, (hi - lo) * 0.15), a = lo - pad, b2 = hi + pad;
    const x0 = 24, x1 = W - 24, X = (v) => x0 + (v - a) * (x1 - x0) / (b2 - a), y = 52;
    const whole = (v) => Math.abs(v - Math.round(v)) < 1e-6, span = b2 - a, every = span > 40 ? 10 : span > 16 ? 5 : span > 8 ? 2 : 1;
    let s = arrow('cl', ASK) + `<path d="M${x0} ${y}H${x1}" stroke="${INK}" stroke-width="2"/>`;
    for (let v = Math.ceil(a); v <= b2; v++) { const big = v % every === 0; s += `<path d="M${X(v)} ${y - (big ? 7 : 4)}V${y + (big ? 7 : 4)}" stroke="${INK}" stroke-width="${big ? 1.4 : 0.8}"/>`; if (big && !read) s += text(X(v), y + 22, String(v), { size: 11, fill: SOFT }); }
    if (count) for (let v = lo; v < hi - 1e-6; v++) s += `<path d="M${X(v) + 2} ${y - 12}Q${(X(v) + X(v + 1)) / 2} ${y - 26} ${X(v + 1) - 2} ${y - 12}" fill="none" stroke="${BLUE}" stroke-width="1.6"/>`;
    s += crane(X(from), y - 30) + text(X(from), y + 38, read ? '' : `${axis} = ${n2(from)}`, { size: 12, weight: 800 });
    s += target(X(to), y - 30) + text(X(to), y + 38, read ? '?' : `${axis} = ${whole(to) ? to : n2(to)}`, { size: 12, weight: 800, fill: read ? ASK : INK });
    if (!count && !read) s += `<path d="M${X(from)} ${y + 50}H${X(to)}" stroke="${ASK}" stroke-width="2" marker-end="url(#cl)"/>` + text((X(from) + X(to)) / 2, y + 66, '? m', { size: 13, fill: ASK, weight: 800 });
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
  // the canister from above, the way it lies now (dark) and the way it must go (dashed), the turn between as an arc
  turn({ from = 90, to = 0 }) {
    const cx = 120, cy = 80, r = 52, rad = (d) => d * Math.PI / 180, end = (d, k) => [cx + Math.sin(rad(d)) * r * k, cy - Math.cos(rad(d)) * r * k];
    const [ax, ay] = end(from, 1), [bx, by] = end(to, 1);
    let s = arrow('ct', ASK);
    s += `<path d="M${2 * cx - ax} ${2 * cy - ay}L${ax} ${ay}" stroke="${DARK}" stroke-width="16" stroke-linecap="round"/>`;
    s += `<path d="M${2 * cx - bx} ${2 * cy - by}L${bx} ${by}" stroke="${BLUE}" stroke-width="5" stroke-dasharray="7 5" stroke-linecap="round"/>`;
    const [px, py] = end(from, 0.75), [qx, qy] = end(to, 0.75);
    s += `<path d="M${px} ${py}A${r * 0.75} ${r * 0.75} 0 0 ${((to - from + 360) % 360) < 180 ? 1 : 0} ${qx} ${qy}" fill="none" stroke="${ASK}" stroke-width="2" marker-end="url(#ct)"/>`;
    s += text(250, 60, 'now', { size: 12, weight: 700, fill: DARK }) + text(250, 80, 'it must go', { size: 12, weight: 700, fill: BLUE }) + text(250, 110, '? degrees', { size: 14, weight: 800, fill: ASK });
    s += text(250, 140, 'a quarter turn is 90°', { size: 11, fill: SOFT });
    return { svg: svg(160, s), line: '' };
  },
  // a move at a speed: so many metres in each second, the seconds counted
  speed({ d, v, axis = 'x' }) {
    const n = Math.max(1, Math.round(d / v)), bw = Math.min(40, (W - 60) / Math.max(n, 1)), x0 = (W - n * bw) / 2;
    let s = '';
    for (let i = 0; i < Math.min(n, 12); i++) s += `<rect x="${x0 + i * bw}" y="30" width="${bw - 3}" height="26" rx="4" fill="${FILL}" stroke="${INK}" stroke-width="1.1"/>` + text(x0 + i * bw + (bw - 3) / 2, 48, n2(v), { size: 10.5, weight: 700 });
    s += text(W / 2, 20, `${n2(v)} m each second along ${axis}`, { size: 12, fill: SOFT });
    s += text(W / 2, 80, `${n2(d)} m in all ÷ ${n2(v)} m each second = ? seconds`, { size: 13, fill: ASK, weight: 800 });
    return { svg: svg(92, s), line: '' };
  },
  // two moves at once: each one's time; the canister is there when the longer one is done
  both({ dx, vx, dy, vy }) {
    const tx = dx / vx, ty = dy / vy, most = Math.max(tx, ty, 1), L = (t) => 30 + (t / most) * 250;
    let s = `<rect x="30" y="22" width="${L(tx) - 30}" height="22" rx="4" fill="${FILL}" stroke="${INK}" stroke-width="1.2"/>` + text(36, 38, `x: ${n2(dx)} m at ${n2(vx)} m a second`, { size: 11.5, weight: 700, anchor: 'start' });
    s += `<rect x="30" y="58" width="${L(ty) - 30}" height="22" rx="4" fill="#d6e6f5" stroke="${INK}" stroke-width="1.2"/>` + text(36, 74, `y: ${n2(dy)} m at ${n2(vy)} m a second`, { size: 11.5, weight: 700, anchor: 'start' });
    s += text(W / 2, 106, 'both at once: it is there when the longer one is done = ? s', { size: 12.5, fill: ASK, weight: 800 });
    return { svg: svg(118, s), line: '' };
  },
  // the move along x and along y, and the straight line the canister goes along
  straight({ dx, dy }) {
    const k = Math.min(200 / dx, 100 / dy), x0 = 60, y0 = 130, x1 = x0 + dx * k, y1 = y0 - dy * k;
    let s = `<path d="M${x0} ${y0}H${x1}V${y1}" fill="none" stroke="${INK}" stroke-width="2"/><path d="M${x1 - 10} ${y0}v-10h10" fill="none" stroke="${SOFT}" stroke-width="1.2"/>`;
    s += `<path d="M${x0} ${y0}L${x1} ${y1}" stroke="${ASK}" stroke-width="2.4" stroke-dasharray="6 4"/>`;
    s += text((x0 + x1) / 2, y0 + 18, `x: ${n2(dx)} m`, { size: 12, weight: 700 }) + text(x1 + 8, (y0 + y1) / 2 + 4, `y: ${n2(dy)} m`, { size: 12, weight: 700, anchor: 'start' });
    s += text((x0 + x1) / 2 - 18, (y0 + y1) / 2 - 8, '?', { size: 15, fill: ASK, weight: 800 });
    s += text(W / 2, y0 + 40, 'x × x + y × y = ? × ?', { size: 12, fill: SOFT });
    return { svg: svg(y0 + 50, s), line: '' };
  },
};
export const picture = (p) => (p && DRAW[p.kind] ? DRAW[p.kind](p).svg : '');
