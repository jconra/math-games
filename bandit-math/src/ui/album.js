// THE PHOTO ALBUM: the deer photographs a rider has taken (src/missions/deerjob.js), each a small sepia print with the
// equation it answered written under it in ink. Kept with the rider (rider.album, saved like everything else): the
// newest ALBUM.max prints; when that's full the oldest one is let go. The album opens from the pause menu ("Photo
// album"); the camera's viewfinder counts the prints as they go in.
//
//   addPrint(rider, { eq, x, img, rung })   puts a print in the album and saves; img: a small JPEG as a data address.
//                    If the browser's storage is full the oldest prints lose their pictures (their equations stay), and
//                    as a last resort the new one is kept without its picture.   -> the print
//   prints(rider)    the album, newest first, cleaned (a hand-edited or old save can't break it)
//   albumBody(rider) -> a page element with the album, for a panel (makePanel's body)
//   ensureAlbumCss()
import { saveRider } from '../save.js';

export const ALBUM = {
  max: 24,               // prints kept (each about 6 to 9 KB with its picture)
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const okImg = (s) => typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);

export function cleanAlbum(list) {
  return (Array.isArray(list) ? list : []).filter((p) => p && typeof p === 'object' && typeof p.eq === 'string')
    .map((p) => ({ eq: p.eq.slice(0, 60), x: String(p.x ?? '').slice(0, 12), img: okImg(p.img) ? p.img : '', at: Number(p.at) || 0, rung: typeof p.rung === 'string' ? p.rung : '' }))
    .slice(-ALBUM.max);
}

export function prints(rider) { return cleanAlbum(rider && rider.album).reverse(); }

export function addPrint(rider, { eq, x, img = '', rung = '' }) {
  const p = { eq: String(eq), x: String(x), img: okImg(img) ? img : '', at: Date.now(), rung: String(rung) };
  rider.album = [...cleanAlbum(rider.album), p].slice(-ALBUM.max);
  if (saveRider(rider) || !usable()) return p;
  // (the browser's storage is full: the oldest pictures go first, a few at a time, then the new one's)
  for (const q of rider.album) { if (q === p || !q.img) continue; q.img = ''; if (saveRider(rider)) return p; }
  p.img = ''; saveRider(rider);
  return p;
}

// (the browser keeps things at all: a full storage still takes a tiny note, a blocked one doesn't)
function usable() {
  try { const s = globalThis.localStorage, k = 'bandit-math.album-probe'; s.setItem(k, '1'); s.removeItem(k); return true; } catch (e) { return false; }
}

export function albumBody(rider) {
  ensureAlbumCss();
  const list = prints(rider);
  const el = document.createElement('div'); el.className = 'bma';
  if (!list.length) { el.innerHTML = '<p class="bma-none">No prints yet. Tick <b>Deer photographs</b> on the title screen and Miss Wren, the naturalist, lends you her camera.</p>'; return el; }
  el.innerHTML = `<p class="bma-count">${list.length} print${list.length === 1 ? '' : 's'}${list.length >= ALBUM.max ? ` (the album holds ${ALBUM.max}: a new one lets the oldest go)` : ''}</p>
    <div class="bma-grid">${list.map((p) => `<figure class="bma-print">
      ${p.img ? `<img src="${p.img}" alt="A photograph of a deer">` : '<div class="bma-blank">faded</div>'}
      <figcaption><span class="bma-eq">${esc(p.eq)}</span><span class="bma-x">x = ${esc(p.x)}</span></figcaption></figure>`).join('')}</div>`;
  return el;
}

export function ensureAlbumCss() {
  if (document.getElementById('bma-css')) return;
  const s = document.createElement('style'); s.id = 'bma-css';
  s.textContent = `
.bma { max-height: min(62vh, 560px); overflow: auto; padding: 2px 4px 6px; }
.bma-count, .bma-none { font: 500 14px Bitter, Georgia, serif; color: #5a4632; margin: 0 0 10px; }
.bma-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
.bma-print { margin: 0; background: #f4ecd8; padding: 8px 8px 6px; border-radius: 2px; box-shadow: 0 2px 6px rgba(40, 25, 10, 0.35);
  transform: rotate(var(--r, 0deg)); }
.bma-print:nth-child(3n+1) { --r: -1.2deg; } .bma-print:nth-child(3n+2) { --r: 0.9deg; } .bma-print:nth-child(3n) { --r: -0.4deg; }
.bma-print img, .bma-blank { display: block; width: 100%; aspect-ratio: 3 / 2; object-fit: cover; border: 1px solid #b9a37c; }
.bma-blank { display: grid; place-items: center; background: #d9c9a6; color: #8a7350; font: italic 13px Bitter, Georgia, serif; }
.bma-print figcaption { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; padding-top: 5px;
  font: italic 600 15px Bitter, Georgia, serif; color: #3b2a1a; }
.bma-x { color: #8a5a14; white-space: nowrap; }
`;
  document.head.appendChild(s);
}
