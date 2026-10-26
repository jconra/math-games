// A solution set drawn on a number line, as an SVG string: the inequalities' answer pictures.
//
//   setLineSVG(set, win, { width, height, marks, theme }) -> '<svg …>'
//     set    pieces { lo, loIn, hi, hiIn } (ineq.js; lo/hi null = it goes on forever that way)
//     win    { lo, hi } the numbers the line runs over (every picture of one question shares it, so they compare fairly)
//     marks  the numbers written under the line (default: the set's ends, zero and the two ends of the line)
//     theme  'card' (dark ink on the tray's paper buttons) or 'mat' (light ink on the leather mat)
// A filled circle: that number counts too (≤, ≥). An open circle: it doesn't (<, >). The shading is a thick bar,
// with an arrowhead where it goes on forever.

const MINUS = '−';
const numText = (v) => (v < 0 ? MINUS : '') + Math.abs(v);

export function setLineSVG(set, win, { width = 560, height = 72, marks = null, theme = 'card' } = {}) {
  const ink = theme === 'mat' ? '#f4e8cf' : '#2b1d10';
  const faint = theme === 'mat' ? 'rgba(244,232,207,0.55)' : 'rgba(43,29,16,0.45)';
  const shade = theme === 'mat' ? '#f3c56b' : '#b5531f';
  const hole = theme === 'mat' ? '#3b2819' : '#f6ead0';
  const pad = Math.max(16, Math.round(width * 0.04));
  const x0 = pad, x1 = width - pad;
  const y = Math.round(height * 0.38);
  const X = (v) => x0 + ((v - win.lo) / (win.hi - win.lo)) * (x1 - x0);
  const font = Math.max(12, Math.min(19, Math.round(height * 0.24)));
  const r = Math.max(5.5, Math.min(9, height * 0.11));
  const parts = [];
  // the line, with an arrow at each end (it goes on forever)
  parts.push(`<line x1="${x0 - 8}" y1="${y}" x2="${x1 + 8}" y2="${y}" stroke="${faint}" stroke-width="2"/>`);
  parts.push(`<path d="M${x0 - 12} ${y}l8 -5v10z" fill="${faint}"/><path d="M${x1 + 12} ${y}l-8 -5v10z" fill="${faint}"/>`);
  for (let v = Math.ceil(win.lo); v <= win.hi; v++) {
    const big = v === 0;
    parts.push(`<line x1="${X(v).toFixed(1)}" y1="${y - (big ? 9 : 5)}" x2="${X(v).toFixed(1)}" y2="${y + (big ? 9 : 5)}" stroke="${big ? ink : faint}" stroke-width="${big ? 2.5 : 1.5}"/>`);
  }
  // the shading
  for (const p of set) {
    const a = p.lo === null ? x0 - 10 : X(p.lo), b = p.hi === null ? x1 + 10 : X(p.hi);
    parts.push(`<line x1="${a.toFixed(1)}" y1="${y}" x2="${b.toFixed(1)}" y2="${y}" stroke="${shade}" stroke-width="${Math.round(r * 0.9)}" stroke-linecap="butt"/>`);
    if (p.lo === null) parts.push(`<path d="M${x0 - 16} ${y}l12 -${r + 2}v${2 * r + 4}z" fill="${shade}"/>`);
    if (p.hi === null) parts.push(`<path d="M${x1 + 16} ${y}l-12 -${r + 2}v${2 * r + 4}z" fill="${shade}"/>`);
  }
  // the circles on the ends
  for (const p of set) {
    for (const [v, closed] of [[p.lo, p.loIn], [p.hi, p.hiIn]]) {
      if (v === null) continue;
      parts.push(`<circle cx="${X(v).toFixed(1)}" cy="${y}" r="${r.toFixed(1)}" fill="${closed ? shade : hole}" stroke="${shade}" stroke-width="3"/>`);
    }
  }
  // the numbers under the line
  const want = marks || [...new Set([...set.flatMap((p) => [p.lo, p.hi]).filter((v) => v !== null), 0, Math.ceil(win.lo), Math.floor(win.hi)])];
  const placed = [];
  const sorted = [...new Set(want)].filter((v) => v >= win.lo && v <= win.hi).sort((p, q) => {
    // the set's ends are placed first, so a crowded end label gives way, not them
    const key = (v) => (set.some((s) => s.lo === v || s.hi === v) ? 0 : v === 0 ? 1 : 2);
    return key(p) - key(q);
  });
  for (const v of sorted) {
    const x = X(v);
    const w = numText(v).length * font * 0.58;
    if (placed.some((o) => Math.abs(o - x) < w * 0.5 + font * 0.6)) continue;
    placed.push(x);
    const end = set.some((s) => s.lo === v || s.hi === v);
    parts.push(`<text x="${x.toFixed(1)}" y="${y + r + font + 3}" text-anchor="middle" font-family="Bitter, Georgia, serif" font-size="${font}" font-weight="${end || v === 0 ? 700 : 500}" fill="${end ? ink : faint}">${numText(v)}</text>`);
  }
  return `<svg class="setline" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="number line">${parts.join('')}</svg>`;
}
