// THE SOUND SWITCH while walking: a small speaker button beside the Crew button (top left); a tap opens a slider for
// the volume and a mute switch under it (kept in this browser: src/sound.js). The title screen's look: dark glass,
// eight-sided, one orange accent.
//   const sw = soundButton(document.getElementById('hud-root'), sound);  sw.show(on)
const CSS = `
.hud-sound { position: absolute; top: max(12px, env(safe-area-inset-top)); left: calc(max(12px, env(safe-area-inset-left)) + 92px); display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
  font: 600 13px/1.2 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: #eef1f4; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.hud-sound[hidden] { display: none; }
.hud-sound > button { width: 44px; height: 40px; border: 0; padding: 0; cursor: pointer; color: #eef1f4; display: grid; place-items: center;
  background: rgba(14, 18, 24, 0.72); box-shadow: inset 0 0 0 1.5px rgba(150, 200, 240, 0.45);
  clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px); }
.hud-sound > button:hover, .hud-sound > button:focus-visible { background: rgba(240, 140, 50, 0.9); color: #14100c; outline: none; }
.hud-sound svg { width: 22px; height: 22px; }
.hud-sound .hs-pop { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(15, 19, 25, 0.92); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.36);
  clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px); }
.hud-sound .hs-pop[hidden] { display: none; }
.hud-sound input[type=range] { width: 150px; accent-color: #ff8f2e; }
.hud-sound .hs-mute { height: 34px; padding: 0 12px; border: 0; cursor: pointer; font: inherit; letter-spacing: 0.06em; text-transform: uppercase; color: #eef1f4; background: rgba(40, 47, 56, 0.92);
  box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.36); clip-path: polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px); }
.hud-sound .hs-mute[aria-pressed=true] { background: #ff8f2e; color: #1c1205; }
`;
const ICON_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export function soundButton(root, sound) {
  if (!document.getElementById('hud-sound-css')) { const st = document.createElement('style'); st.id = 'hud-sound-css'; st.textContent = CSS; document.head.appendChild(st); }
  const box = document.createElement('div'); box.className = 'hud-sound'; box.hidden = true;
  box.innerHTML = '<button type="button" class="hs-btn" aria-expanded="false"></button>'
    + '<div class="hs-pop" hidden><input type="range" min="0" max="100" step="1" aria-label="Volume"><button type="button" class="hs-mute" aria-pressed="false">Mute</button></div>';
  root.appendChild(box);
  const btn = box.querySelector('.hs-btn'), pop = box.querySelector('.hs-pop'), range = box.querySelector('input'), mute = box.querySelector('.hs-mute');
  const show = () => {
    const off = sound.muted || sound.volume === 0;
    btn.innerHTML = off ? ICON_OFF : ICON_ON;
    btn.setAttribute('aria-label', off ? 'Sound is off: change it' : 'Sound: change the volume');
    range.value = String(Math.round(sound.volume * 100));
    mute.setAttribute('aria-pressed', String(!!sound.muted));
  };
  const open = (on) => { pop.hidden = !on; btn.setAttribute('aria-expanded', String(on)); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(pop.hidden); });
  range.addEventListener('input', () => { sound.setVolume(+range.value / 100); show(); });
  mute.addEventListener('click', () => { sound.setMuted(!sound.muted); show(); });
  // (a tap anywhere else closes it; the keys go on walking)
  addEventListener('pointerdown', (e) => { if (!box.contains(e.target)) open(false); }, true);
  for (const el of [range, mute, btn]) el.addEventListener('keydown', (e) => e.stopPropagation());
  show();
  return { el: box, show(on) { box.hidden = !on; if (!on) open(false); show(); } };
}
