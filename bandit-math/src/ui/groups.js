// EQUAL GROUPS: the dividing topic's picture (src/math/dividing.js), shown in the round-up's help box at the bottom
// middle (where the number line goes for positive & negative cards). The number shared out is drawn as dots dealt into
// rows, one row for each group, the way you'd deal cards round a table:
//   help (reveal false)   the first round dealt (a dot in each row) and the rest still in the pile, "keep dealing":
//                         the answer is never drawn as a number, and no row holds it yet
//   after a miss (reveal) every round dealt: each row full, and what couldn't go round again set aside as the leftover
//   both ways round       ? ÷ 6 = 4: six rows of four, "? in all"; 24 ÷ ? = 4: one row of four filled, the rest in the
//                         pile, "how many rows of 4?"
// Plain page elements and one <svg>; nothing touches gold, accuracy or the trainer.
//
//   groupsSvg(o) -> { svg, title, line }   o = { total, groups, dealt (rounds dealt, null for all), reveal, ask, each,
//                                          theme: 'dark' | 'light' } (pure: the node tests draw it)
//   showGroups(container, o) -> { el, remove() }   the picture in a smoky panel, with o.reason as its caption

const THEMES = {
  dark: { ink: '#f4e8cf', soft: '#a8957a', pen: 'rgba(220, 202, 165, 0.55)', penFill: 'rgba(255, 240, 210, 0.05)', dot: '#e2ad4c', pile: '#c9a46a', left: '#f08a6c', ask: '#f6c661' },
  light: { ink: '#2b2219', soft: '#8a7558', pen: 'rgba(92, 64, 36, 0.6)', penFill: 'rgba(122, 85, 48, 0.06)', dot: '#b47f2c', pile: '#8a6a3a', left: '#b5523a', ask: '#b5523a' },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PITCH = 16, R = 5.6, ROW_H = 22, LEFT = 66, MIN_W = 270, SCALE = 1.3;   // (the picture is drawn this many times its own size, up to the screen's width)

export function groupsSvg(o = {}) {
  const T = THEMES[o.theme === 'light' ? 'light' : 'dark'];
  const g = Math.max(1, Math.min(12, Math.round(o.groups || 1)));
  const total = Math.max(0, Math.round(o.total || 0));
  const ask = o.ask === 'n' || o.ask === 'd' ? o.ask : null;
  const q = Math.floor(total / g), left = total - q * g;
  // what each row holds, and how many are still in the pile
  let per, rows = g, pile;
  if (ask === 'n') { per = Math.max(1, Math.round(o.each || q)); pile = 0; }                         // ? ÷ 6 = 4: the rows are the story
  else if (ask === 'd') { per = Math.max(1, Math.round(o.each || q)); rows = o.reveal ? g : 1; pile = o.reveal ? total - per * g : total - per; }   // 24 ÷ ? = 4
  else if (o.reveal || o.dealt == null) { per = q; pile = left; }
  else { per = Math.max(0, Math.min(q, Math.round(o.dealt))); pile = total - per * g; }
  const t = (x, y, s, { size = 13, fill = T.ink, anchor = 'start', weight = 600 } = {}) =>
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="Bitter, Georgia, serif">${esc(s)}</text>`;
  let s = '', y = 8;
  // (a row is drawn as long as a full row will be, so the first round's dots sit in rows with room to fill)
  const rowW = Math.max(PITCH * Math.max(per, q || 1) + 12, 44);
  const pileW = pile > 0 ? Math.min(pile, 20) * 12 + 16 : 0;
  const W = Math.max(MIN_W, LEFT + Math.max(rowW, pileW) + 14);
  for (let i = 0; i < rows; i++) {
    s += `<rect x="${LEFT}" y="${y}" width="${rowW.toFixed(1)}" height="${ROW_H - 4}" rx="8" fill="${T.penFill}" stroke="${T.pen}" stroke-width="1.2"/>`;
    s += t(LEFT - 8, y + ROW_H / 2 + 2.5, `row ${i + 1}`, { size: 10.5, fill: T.soft, anchor: 'end', weight: 500 });
    for (let k = 0; k < per; k++) s += `<circle cx="${(LEFT + 12 + k * PITCH).toFixed(1)}" cy="${(y + (ROW_H - 4) / 2).toFixed(1)}" r="${R}" fill="${T.dot}"/>`;
    y += ROW_H;
  }
  // the pile still to deal (help), or the leftover set aside (after a miss)
  let title = '', line = '';
  if (pile > 0) {
    const perLine = 20, lines = Math.ceil(pile / perLine), gap = 12;
    y += 6;
    const leftover = o.reveal || o.dealt == null;
    s += t(LEFT - 8, y + 9, leftover ? 'left over' : 'to deal', { size: 10.5, fill: leftover ? T.left : T.soft, anchor: 'end', weight: 700 });
    for (let k = 0; k < pile; k++) {
      const cx = LEFT + 8 + (k % perLine) * gap, cy = y + 6 + Math.floor(k / perLine) * gap;
      s += leftover ? `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${R - 0.6}" fill="none" stroke="${T.left}" stroke-width="2"/>` : `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${R - 1.4}" fill="${T.pile}"/>`;
    }
    y += lines * gap + 6;
  }
  // a word for what's asked: never the number itself
  if (ask === 'n') { title = 'Rows of dots'; s += t(W / 2, y + 14, '? in all', { size: 14, fill: T.ask, anchor: 'middle', weight: 800 }); y += 20; }
  else if (ask === 'd' && !o.reveal) { title = 'Filling rows'; s += t(W / 2, y + 14, `how many rows of ${per}?`, { size: 14, fill: T.ask, anchor: 'middle', weight: 800 }); y += 20; }
  else if (!o.reveal && o.dealt != null) { title = 'Dealing them out'; s += t(W / 2, y + 14, 'keep dealing: how many in each row?', { size: 13, fill: T.ask, anchor: 'middle', weight: 800 }); y += 20; }
  else title = 'Dealt out in rows';
  const h = Math.max(40, y + 4);
  const svg = `<svg viewBox="0 0 ${W} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" class="bm-gr-svg" preserveAspectRatio="xMidYMin meet" style="width: min(${Math.round(W * SCALE)}px, 84vw)">${s}</svg>`;
  return { svg, title, line, width: W, height: h };
}

let css = false;
function ensureCss() {
  if (css || typeof document === 'undefined') return; css = true;
  const st = document.createElement('style'); st.dataset.bmGroups = '1';
  st.textContent = `
.bm-gr { margin: 0 auto; width: fit-content; max-width: min(480px, 92vw); padding: 10px 16px 12px; border-radius: 16px; color: #f4e8cf;
  background: rgba(22, 15, 10, 0.88); border: 1px solid rgba(226, 173, 76, 0.32); box-shadow: 0 10px 34px rgba(0, 0, 0, 0.45);
  font: 400 15px/1.35 Bitter, Georgia, serif; pointer-events: none; animation: bm-gr-in 0.25s ease-out; -webkit-user-select: none; user-select: none; }
.bm-gr-svg { display: block; height: auto; max-height: min(320px, 34vh); margin: 0 auto; }
.bm-gr figcaption { margin-top: 6px; text-align: center; font-size: 15px; color: #f4e8cf; max-width: 420px; }
.bm-gr small { display: block; text-align: center; font: 700 11px Bitter, Georgia, serif; letter-spacing: 0.08em; text-transform: uppercase; color: #c9a46a; margin-bottom: 4px; }
@keyframes bm-gr-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (max-height: 480px) { .bm-gr { padding: 6px 10px 8px; } .bm-gr figcaption { font-size: 13px; } .bm-gr-svg { max-height: 30vh; } }
`;
  document.head.appendChild(st);
}

export function showGroups(container, o = {}) {
  ensureCss();
  const { svg, title } = groupsSvg(o);
  const el = document.createElement('figure');
  el.className = 'bm-gr';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `${title}. ${o.reason || ''}`);
  el.innerHTML = `<small>${esc(title)}</small>${svg}${o.reason ? `<figcaption>${esc(o.reason)}</figcaption>` : ''}`;
  container.appendChild(el);
  return { el, remove: () => el.remove() };
}
