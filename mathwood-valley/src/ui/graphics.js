// THE GRAPHICS CHOICE in the pause menu: Auto (the default: the governor finds what this computer can do, world/
// governor.js) or a tier chosen by hand (Potato, Normal, Gaming), which pins every dial at that tier's level and is
// remembered (world/quality.js saveTier). Some of a tier (the land's mesh, the screen's smoothing, the shadow map, the
// models' pictures) can only change when the game loads again: the row says so when the tier chosen isn't the one loaded.
//   graphicsRow(G) -> element   (G: W.governor; nothing when there is none)
import { rungWords } from '../../world/governor.js';

const NAMES = { auto: 'Auto', potato: 'Potato', normal: 'Normal', gaming: 'Gaming' };
export function graphicsRow(G) {
  ensureCss();
  const row = document.createElement('div');
  row.className = 'bm-gfx';
  if (!G) return row;
  const paint = () => {
    const s = G.state(), on = s.auto ? 'auto' : s.pinned;
    const note = s.auto ? `Finding what this computer can do: now ${rungWords(s.scenery)}`
      : s.pinned !== s.loadBand ? `${NAMES[s.pinned]} in full the next time the game loads` : `${NAMES[s.pinned]}, chosen by hand`;
    row.innerHTML = `<span>Graphics</span><div class="bm-gfx-opts" role="radiogroup" aria-label="Graphics">${Object.entries(NAMES).map(([k, n]) =>
      `<button type="button" role="radio" aria-checked="${on === k}" data-gfx="${k}">${n}</button>`).join('')}</div><small>${note}</small>`;
  };
  row.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-gfx]'); if (!b) return;
    e.stopPropagation();   // (the menu stays open)
    G.pin(b.dataset.gfx === 'auto' ? null : b.dataset.gfx);
    paint();
  });
  row.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  paint();
  return row;
}
let cssDone = false;
function ensureCss() {
  if (cssDone) return; cssDone = true;
  const s = document.createElement('style');
  s.textContent = `.bm-gfx { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 6px 12px; margin-top: 12px; font: 600 15px Bitter, Georgia, serif; }
.bm-gfx-opts { display: flex; flex-wrap: wrap; gap: 6px; }
.bm-gfx-opts button { font: 600 13px Bitter, Georgia, serif; padding: 5px 10px; border-radius: 6px; border: 1px solid #7a5a3a; background: rgba(40,28,16,.55); color: inherit; cursor: pointer; }
.bm-gfx-opts button[aria-checked="true"] { background: #c8913c; color: #24170c; border-color: #c8913c; }
.bm-gfx small { grid-column: 1 / -1; font: 400 12.5px Bitter, Georgia, serif; opacity: 0.8; }`;
  document.head.appendChild(s);
}
