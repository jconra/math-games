// THE LEVEL PICKER: "< 27: Odd steps going down >": the arrows step the rider's level at a place down and up, each level's
// title showing as they go, the small bar filling with right answers toward the next level. One piece of code wherever it
// shows: the tools strip along the bottom (src/ui/tools.js), and the bar of a job that puts the HUD away (a build site's
// panel: src/buildsite.js, the fishing's top bar, the windmill's and the bridge's panels). The sums are src/ui/leveltool.js;
// the sheet is tools.css (the page's: tools.js puts it on).
//   const L = makeLevelPicker({ rider, place, onLevel })   rider(), place() -> the place's id or null (hidden), onLevel(placeId, view)
//   L.el, L.update() (a few times a second: cheap, only what changed is written), L.step(dir), L.view (or null)
import { levelTool, stepLevel } from './leveltool.js';

const ARROW_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5 7.5 12l7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARROW_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function makeLevelPicker({ rider = () => null, place = () => null, onLevel = () => {} } = {}) {
  const el = document.createElement('div');
  el.className = 'bmtl-level'; el.hidden = true;
  el.innerHTML = `<button type="button" class="bmtl-step" data-dir="-1" aria-label="A level down">${ARROW_L}</button>
    <div class="bmtl-lv"><span class="bmtl-lvt"></span><span class="bmtl-lvbar"><i></i></span></div>
    <button type="button" class="bmtl-step" data-dir="1" aria-label="A level up">${ARROW_R}</button>`;
  const q = (sel) => el.querySelector(sel);
  const lvText = q('.bmtl-lvt'), lvFill = q('.bmtl-lvbar i'), lvBox = q('.bmtl-lv');
  const downBtn = q('.bmtl-step[data-dir="-1"]'), upBtn = q('.bmtl-step[data-dir="1"]');
  let key = '';
  const L = { el, view: null };
  function show(v) {
    L.view = v;
    const k = v ? `${v.place}|${v.id}|${v.into}|${v.placing}|${v.pick}|${v.canDown}|${v.canUp}` : '';
    if (k === key) return;
    key = k;
    el.hidden = !v;
    if (!v) return;
    lvText.textContent = v.words;
    lvBox.title = `${v.name}: ${v.note}`;
    lvBox.setAttribute('aria-label', `${v.name}, level ${v.words}. ${v.note}`);
    lvFill.style.width = `${Math.round(v.fill * 100)}%`;
    el.classList.toggle('is-placing', v.placing);
    el.classList.toggle('is-fixed', !v.pick);
    downBtn.hidden = upBtn.hidden = !v.pick;
    downBtn.disabled = !v.canDown; upBtn.disabled = !v.canUp;
  }
  L.step = (dir) => {
    const r = rider(), id = L.view && L.view.place;
    if (!r || !id) return null;
    const v = stepLevel(r, id, dir);
    if (!v) return null;
    show(v);
    el.classList.remove('is-moved'); void el.offsetWidth; el.classList.add('is-moved');
    try { onLevel(id, v); } catch (e) { console.error(e); }
    return v;
  };
  L.update = () => {
    let pid = null;
    try { pid = place(); } catch (e) { console.warn(e); }
    const r = rider();
    show(pid && r ? levelTool(r, pid) : null);
  };
  for (const b of [downBtn, upBtn]) b.addEventListener('click', (e) => { e.currentTarget.blur(); L.step(+b.dataset.dir); });
  return L;
}
