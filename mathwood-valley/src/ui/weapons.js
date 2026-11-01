// THE WEAPON BUTTONS: down the right side of the screen, what the rider can take up (src/gun.js weapons): the lasso, the
// six-shooter, the rifles bought. Shown while bandits are near (a hold-up, a camp's guards) or at the range, and only with
// more than one thing to choose from. Nothing ever changes by itself: a button, or its key (the number in the tab on the
// button's corner: 1 lasso, then the guns), chooses. The choice is saved with the rider.
//   const B = makeWeaponButtons({ rider, onChange })   onChange(id): chosen
//   B.show(on, { lasso = true })   up or put away (lasso false: the range, which has no use for a rope)
//   B.dispose()
import { GUNS, weapons, weaponOf, setWeapon } from '../gun.js';
import { saveRider } from '../save.js';

const PIC = {
  lasso: '<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="14" rx="13" ry="7" fill="none" stroke="currentColor" stroke-width="3"/><path d="M9 18c0 8 6 8 8 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  revolver: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 12h26v6H17l-1 3h-4l-2 11H4l3-13-2-1z" fill="currentColor"/></svg>',
  lever: '<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M2 24l15-7h9v-3h36v3H36v4h-5l-2 2h-8l-4-1L5 31z" fill="currentColor"/><circle cx="27" cy="27" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  single: '<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M1 25l15-8h10v-3h37v3H38v3H29l-3 3h-7L4 31z" fill="currentColor"/><path d="M21 17v-7h2v7z" fill="currentColor"/></svg>',
};
const NAME = { lasso: 'Lasso', revolver: 'Six-shooter', lever: 'Lever-action', single: 'Long-range' };
let css = false;
function ensureCss() {
  if (css || typeof document === 'undefined') return; css = true;
  const st = document.createElement('style'); st.dataset.for = 'weapons';
  st.textContent = `
.bmw-box { position: fixed; right: 12px; top: 50%; transform: translateY(-50%); z-index: 30; display: flex; flex-direction: column; gap: 8px; }
.bmw-box[hidden] { display: none; }
.bmw-b { position: relative; width: 112px; min-height: 58px; padding: 4px 6px 3px; border-radius: 10px; border: 2px solid rgba(233, 214, 174, .45); background: rgba(38, 26, 16, .78);
  color: #f3e6c8; font: 700 13px/1.1 Bitter, Georgia, serif; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.bmw-b svg { height: 30px; width: auto; }
.bmw-b.is-on { border-color: #ffd36a; background: rgba(120, 78, 28, .92); color: #fff6dc; box-shadow: 0 0 10px rgba(255, 200, 90, .55); }
.bmw-b kbd { position: absolute; left: -7px; top: -7px; min-width: 18px; padding: 1px 3px; border-radius: 5px; background: #2a1b0f; border: 1px solid rgba(233,214,174,.6); color: #e9d6ae; font: 700 11px/1.3 system-ui, sans-serif; }
@media (pointer: coarse) { .bmw-b kbd { display: none; } }
@media (max-width: 700px) { .bmw-box { top: 42%; right: 6px; gap: 6px; } .bmw-b { width: 62px; min-height: 48px; font-size: 10px; padding: 3px 2px; } .bmw-b svg { height: 22px; } }
`;
  document.head.appendChild(st);
}

export function makeWeaponButtons({ rider, onChange = () => {} }) {
  ensureCss();
  const el = document.createElement('div'); el.className = 'bmw-box'; el.hidden = true; document.body.appendChild(el);
  let on = false, lasso = true, sig = '';
  const list = () => weapons(rider).filter((id) => lasso || id !== 'lasso');
  function draw() {
    const L = list(), cur = weaponOf(rider), s = L.join() + '|' + cur;
    el.hidden = !on || L.length < 2;
    if (s === sig) return; sig = s;
    el.innerHTML = L.map((id, i) => `<button class="bmw-b${id === cur ? ' is-on' : ''}" type="button" data-w="${id}" aria-pressed="${id === cur}" title="${(GUNS[id] && GUNS[id].name) || 'Lasso'}"><kbd>${i + 1}</kbd>${PIC[id]}<span>${NAME[id]}</span></button>`).join('');
  }
  function choose(id) { if (!setWeapon(rider, id)) return; saveRider(rider); draw(); onChange(id); }
  const click = (e) => { const b = e.target.closest('[data-w]'); if (!b) return; e.stopPropagation(); choose(b.dataset.w); b.blur(); };
  const stop = (e) => e.stopPropagation();
  const key = (e) => {
    if (!on || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code); if (!m) return;
    const id = list()[+m[1] - 1]; if (id && list().length > 1) { e.stopPropagation(); e.preventDefault(); choose(id); }
  };
  el.addEventListener('click', click);
  for (const n of ['pointerdown', 'mousedown', 'touchstart']) el.addEventListener(n, stop);   // (a press here is never a shot or a throw)
  addEventListener('keydown', key, true);
  return {
    el,
    show(v, o = {}) { on = !!v; lasso = o.lasso !== false; draw(); },
    dispose() { removeEventListener('keydown', key, true); el.remove(); },
  };
}
