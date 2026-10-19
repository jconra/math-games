// The general store's grandfather clock, drawn as an SVG string for the order slip: a tall wooden case with an arched
// hood, a cream dial with the numbers 1 to 12, a mark for every minute, a short iron hour hand and a long minute hand.
// The hour hand sits where a real one would: at 4:30 it is halfway from the 4 to the 5 (reading that is half the skill).
//
//   handAngles(h, m) -> { hour, minute }   degrees clockwise from the 12
//   clockSvg(h, m)                      the clock in its case, as a customer sees it (the question)
//   clockSvg(h, m, { help: true })      the helper after a wrong pick: the dial bigger, without the case, the minutes
//                                       written round the edge (5, 10, 15 ... 55), the minutes gone by since the 12
//                                       shaded, and the hour the short hand has passed lit. It shows how to read the
//                                       clock; the time itself is never written.
// Plain strings, no page needed (tests/counter.test.mjs draws it).

const INK = '#2b2219', SOFT = '#8a7558', DIAL = '#f6efdc', RIM = '#b47f2c', WOOD = '#6b3f1d', WOOD2 = '#8a5a2e', ASK = '#b5523a', LIT = '#f3d79a';
const f1 = (n) => n.toFixed(1);
const at = (cx, cy, r, deg) => [cx + r * Math.sin(deg * Math.PI / 180), cy - r * Math.cos(deg * Math.PI / 180)];

// where the hands point, in degrees clockwise from the 12: at 4:30 the hour hand is at 135 (halfway from 4 to 5)
export function handAngles(h, m) { return { hour: ((h % 12) + m / 60) * 30, minute: m * 6 }; }

function dial(cx, cy, R, h, m, { help = false } = {}) {
  const { minute: minDeg, hour: hourDeg } = handAngles(h, m);
  let s = `<circle cx="${cx}" cy="${cy}" r="${R + 6}" fill="${RIM}" stroke="${INK}" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="${DIAL}" stroke="${INK}" stroke-width="1"/>`;
  if (help) {
    // the hour the short hand has passed, lit (a wedge from that number to the next)
    const h0 = (h % 12) * 30, [ax, ay] = at(cx, cy, R - 2, h0), [bx, by] = at(cx, cy, R - 2, h0 + 30);
    s += `<path d="M${cx} ${cy}L${f1(ax)} ${f1(ay)}A${R - 2} ${R - 2} 0 0 1 ${f1(bx)} ${f1(by)}Z" fill="${LIT}" opacity="0.8"/>`;
    // the minutes gone by since the 12, shaded
    if (m > 0) {
      const [mx, my] = at(cx, cy, R * 0.92, minDeg);
      s += `<path d="M${cx} ${cy}L${cx} ${f1(cy - R * 0.92)}A${f1(R * 0.92)} ${f1(R * 0.92)} 0 ${minDeg > 180 ? 1 : 0} 1 ${f1(mx)} ${f1(my)}Z" fill="${ASK}" opacity="0.14"/>`;
    }
  }
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0, [x0, y0] = at(cx, cy, R - (big ? 9 : 5), i * 6), [x1, y1] = at(cx, cy, R - 1.5, i * 6);
    s += `<path d="M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}" stroke="${INK}" stroke-width="${big ? 2.2 : 1}"/>`;
  }
  for (let n = 1; n <= 12; n++) {
    const [x, y] = at(cx, cy, R - 21, n * 30);
    s += `<text x="${f1(x)}" y="${f1(y + 6.5)}" font-size="${R > 80 ? 19 : 17}" font-weight="700" fill="${INK}" text-anchor="middle" font-family="Bitter, Georgia, serif">${n}</text>`;
  }
  if (help) {
    for (let k = 1; k < 12; k++) {
      const [x, y] = at(cx, cy, R + 19, k * 30);
      s += `<text x="${f1(x)}" y="${f1(y + 4.5)}" font-size="12.5" font-weight="700" fill="${ASK}" text-anchor="middle" font-family="Bitter, Georgia, serif">${k * 5}</text>`;
    }
    const [x, y] = at(cx, cy, R + 19, 0);
    s += `<text x="${f1(x)}" y="${f1(y + 4.5)}" font-size="12.5" font-weight="700" fill="${ASK}" text-anchor="middle" font-family="Bitter, Georgia, serif">0</text>`;
  }
  // the hands: the hour hand short and broad with a spade tip, the minute hand long and thin
  const [hx, hy] = at(cx, cy, R * 0.52, hourDeg), [hbx, hby] = at(cx, cy, R * 0.12, hourDeg + 180);
  const [mx, my] = at(cx, cy, R * 0.86, minDeg), [mbx, mby] = at(cx, cy, R * 0.16, minDeg + 180);
  s += `<path d="M${f1(hbx)} ${f1(hby)}L${f1(hx)} ${f1(hy)}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
  const [sx, sy] = at(cx, cy, R * 0.6, hourDeg);
  s += `<circle cx="${f1((hx + sx) / 2)}" cy="${f1((hy + sy) / 2)}" r="5.5" fill="${INK}"/>`;
  s += `<path d="M${f1(mbx)} ${f1(mby)}L${f1(mx)} ${f1(my)}" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="6" fill="${RIM}" stroke="${INK}" stroke-width="1.5"/>`;
  return s;
}

export function clockSvg(h, m, { help = false } = {}) {
  if (help) {
    const cx = 130, cy = 120, R = 88;
    let s = dial(cx, cy, R, h, m, { help: true });
    s += `<text x="${cx}" y="${cy + R + 42}" font-size="12.5" fill="${SOFT}" text-anchor="middle" font-family="Bitter, Georgia, serif" font-weight="600">red: the minutes, by 5s from the top</text>`;
    return `<svg viewBox="0 0 260 256" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg bmp-clock" aria-label="The clock with the minutes written round its edge">${s}</svg>`;
  }
  // the case: the arched hood, the dial in it, and the top of the trunk with its pendulum window
  const cx = 110, cy = 112, R = 76;
  let s = `<defs><linearGradient id="bmq-wood" x1="0" x2="1"><stop offset="0" stop-color="${WOOD}"/><stop offset="0.5" stop-color="${WOOD2}"/><stop offset="1" stop-color="${WOOD}"/></linearGradient></defs>`;
  s += `<path d="M14 214V70Q14 14 110 10Q206 14 206 70V214Z" fill="url(#bmq-wood)" stroke="${INK}" stroke-width="2"/>`;
  s += `<path d="M30 30Q110 -2 190 30" fill="none" stroke="${RIM}" stroke-width="3" opacity="0.7"/>`;
  s += `<circle cx="22" cy="200" r="4" fill="${RIM}"/><circle cx="198" cy="200" r="4" fill="${RIM}"/>`;
  s += dial(cx, cy, R, h, m);
  s += `<rect x="40" y="214" width="140" height="44" fill="url(#bmq-wood)" stroke="${INK}" stroke-width="2"/>`;
  s += `<rect x="86" y="220" width="48" height="38" rx="4" fill="#2b1a0c" stroke="${RIM}" stroke-width="2"/><path d="M110 220V246" stroke="${RIM}" stroke-width="2"/><circle cx="110" cy="250" r="7" fill="${RIM}"/>`;
  return `<svg viewBox="0 0 220 258" xmlns="http://www.w3.org/2000/svg" role="img" class="bmp-svg bmp-clock" aria-label="The store's grandfather clock">${s}</svg>`;
}
