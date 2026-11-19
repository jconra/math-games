// FLYING BY HAND, in the game: the ship really moves. The keys, the mouse and the thumb sticks; the two views; the
// buttons and the help corner; the speed on a screen in the cockpit; the autopilot. The plain part (how it moves, the
// keys, the station's area, the autopilot's sums, the setting) is src/flymodel.js; what it bumps into, src/flysolid.js.
//
// THE GAME'S MAKER (2026-11-18): "I'd prefer it if the pilot could switch views between the cockpit or flying the ship
// in 3rd person. It would be cool if when in 3rd person you could hold a key to allow the camera to orbit the ship. On
// a phone you might just have to accept a lesser experience (auto-pilot), but we could try allowing manual flying with
// virtual joysticks and/or keys. ... So, if you sit down at the pilot's seat, it would be cool to have a button to
// toggle power, but it's not necessary. It would be good to have buttons both virtual and physical (for a keyboard
// user). You press space bar and the ship lifts up, you press w and it goes forward and leaves the hanger. There should
// be a help ui on the bottom corner to show you what the buttons do. It would be cool to see a screen in the cockpit
// that shows your speed. When you leave the area of the station then it gives you the option to jump." And: "We might
// need to use an interact key (F) to change mouse control to inside the cockpit. Otherwise if you move the mouse down
// to click a button it would give you the unintended consequence of pitching the ship down."
//
// HOW THE SHIP MOVES IN THE PICTURE: the parked ship is a room of the station (drawn with its hangar) and its cabin is
// built where it is parked (src/boarding.js). Flown, both are drawn moved by one matrix, from where it is parked to
// where it is now (crane.fly, boarding.fly): the same ship, its own cockpit, its own thrusters (kit/ships/flight.js).
// The crew member's body stays in the parked seat, unseen; nothing walks about a ship in flight.
//
// THE MOUSE: in flight it points the nose. The game holds it (pointer lock) when the browser lets it, never under a
// test rig (navigator.webdriver: a page holding the mouse there has run the machine out of memory before); not held,
// the nose turns toward wherever the pointer is from the middle of the screen. F gives the mouse back as an ordinary
// pointer for the buttons (the ship then holds its heading), and F again takes it. Lifting off by a key takes the
// mouse by itself only if the browser gives it to the game; otherwise it stays a pointer until F (or a click on the
// view) asks for it, so the nose never swings off toward a pointer left on a button.
//
//   const F = startFlying({ W, boarding, crane, outside }, { cfg, pilot, goal, settings, flier, on... })
//     goal        'leave' (out of the hangar and clear of the station) | 'land' (in and down on the pad) | 'free' (the lab)
//     pilot       false: the crew's pilot flies (the autopilot, and no way to switch it off)
//     settings    { invertY }; onSettings(settings) when the crew member changes one
//     onClear()   once, when the ship is first clear of the station; onJump(): the Jump button; onLanded(): down on the pad
//     words(w)    a few words on what is happening, for whoever shows them (the trip's strip along the top)
//   F.update(dt)  each frame; F.aim(camera, dt) after the game's own camera; F.late() just before the picture
//   F.lock(on)    the controls and the buttons put away for a while (the jump computer's cards are up)
//   F.away()      the ship back where it is parked, nothing of the flying drawn (it has jumped: src/trip.js)
//   F.arrive()    out of the jump home: outside the station, in sight of it, to fly in and land
//   F.press(what), F.hold(what, on)   a key's work, by name (the buttons; the rigs)
//   F.close()
import * as THREE from 'three';
import * as M from './flymodel.js';
import { stationSolid, bayOf } from './flysolid.js';
import { DOOR } from '../kit/outside-plan.js';

export const VIEW = { near: { cockpit: 0.05, behind: 0.4 }, far: 6000, follow: 7, orbit: { speed: 0.0052, back: 5, most: 1.25 }, least: 0.3 };

const CSS = `
.pfl { position: fixed; inset: 0; z-index: 21; pointer-events: none; font: 400 15px/1.3 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: #eef1f4; user-select: none; -webkit-user-select: none; touch-action: none; }
.pfl[hidden] { display: none; }
.pfl button { font: inherit; color: inherit; pointer-events: auto; cursor: pointer; border: 0; margin: 0; touch-action: none; -webkit-tap-highlight-color: transparent; }
.pfl kbd { font: 700 12px/1 ui-monospace, "SF Mono", Consolas, monospace; padding: 3px 6px; color: #10151c; background: #cfd8e2; border-radius: 3px; white-space: nowrap; }
.pfl-help { position: absolute; left: max(14px, env(safe-area-inset-left)); bottom: max(14px, env(safe-area-inset-bottom)); max-width: min(330px, 76vw); pointer-events: auto; }
.pfl-help ul { list-style: none; margin: 0; padding: 9px 12px 10px; background: rgba(13, 17, 23, 0.84); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.32);
  clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px); }
.pfl-help li { display: flex; align-items: baseline; gap: 9px; padding: 2px 0; font-size: 14px; color: #dfe6ee; }
.pfl-help li kbd { flex: 0 0 auto; min-width: 54px; text-align: center; }
.pfl.is-touch .pfl-help li kbd { min-width: 70px; font-family: inherit; font-size: 12.5px; padding: 4px 6px; }
.pfl-help li.is-word { color: #ffd560; font-weight: 700; }
.pfl-helptab { display: block; margin: 0 0 5px; height: 28px; padding: 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #cfd8e2 !important; background: rgba(13, 17, 23, 0.84) !important; box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.32); }
.pfl-help.is-shut ul { display: none; }
.pfl-btns { position: absolute; right: max(14px, env(safe-area-inset-right)); bottom: max(14px, env(safe-area-inset-bottom)); display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; max-width: min(680px, 62vw); }
.pfl-b { height: 44px; min-width: 60px; padding: 0 14px; display: inline-flex; align-items: center; gap: 8px; font-size: 14px !important; font-weight: 700 !important; letter-spacing: 0.04em; background: rgba(15, 19, 25, 0.88) !important; box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.45);
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px); }
.pfl-b[hidden] { display: none; }
.pfl-b.is-on { background: rgba(60, 46, 8, 0.92) !important; box-shadow: inset 0 0 0 2px rgba(255, 205, 60, 0.9); color: #ffe08a !important; }
.pfl-jump { position: absolute; left: 50%; bottom: max(84px, calc(env(safe-area-inset-bottom) + 70px)); transform: translateX(-50%); height: 56px; padding: 0 26px; font-size: 19px !important; font-weight: 800 !important; letter-spacing: 0.08em; text-transform: uppercase; display: inline-flex; align-items: center; gap: 12px;
  color: #10151c !important; background: #ffd560 !important; clip-path: polygon(11px 0, calc(100% - 11px) 0, 100% 11px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 11px 100%, 0 calc(100% - 11px), 0 11px); }
.pfl-jump[hidden] { display: none; }
.pfl-jump kbd { background: #10151c; color: #ffd560; }
.pfl-ring { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px rgba(207, 230, 255, 0.45); }
.pfl-ring[hidden] { display: none; }
.pfl-ring::after { content: ""; position: absolute; left: 50%; top: 50%; width: 4px; height: 4px; margin: -2px 0 0 -2px; border-radius: 50%; background: rgba(207, 230, 255, 0.8); }
.pfl-stick { position: absolute; bottom: max(20px, env(safe-area-inset-bottom)); width: 118px; height: 118px; border-radius: 50%; pointer-events: auto; background: rgba(10, 16, 24, 0.34); box-shadow: inset 0 0 0 2px rgba(170, 215, 255, 0.6); }
.pfl-stick[hidden] { display: none; }
.pfl-stick.is-l { left: max(16px, env(safe-area-inset-left)); } .pfl-stick.is-r { right: max(16px, env(safe-area-inset-right)); }
.pfl-stick i { position: absolute; left: 50%; top: 50%; width: 50px; height: 50px; margin: -25px 0 0 -25px; border-radius: 50%; background: rgba(240, 150, 60, 0.8); pointer-events: none; }
.pfl-stick small { position: absolute; left: 0; right: 0; top: -20px; text-align: center; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #cfe6ff; text-shadow: 0 1px 3px #000; pointer-events: none; }
.pfl-holds { position: absolute; bottom: calc(max(20px, env(safe-area-inset-bottom)) + 150px); display: flex; gap: 8px; }
.pfl-holds[hidden] { display: none; }
.pfl-holds.is-l { left: max(16px, env(safe-area-inset-left)); } .pfl-holds.is-r { right: max(16px, env(safe-area-inset-right)); }
.pfl-holds .pfl-b { min-width: 56px; height: 46px; padding: 0 10px; justify-content: center; }
.pfl-card { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(380px, 88vw); padding: 16px 18px 18px; pointer-events: auto; background: rgba(13, 17, 23, 0.96); box-shadow: inset 0 0 0 2px rgba(255, 205, 60, 0.8);
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px); }
.pfl-card[hidden] { display: none; }
.pfl-card h3 { margin: 0 34px 10px 0; font-size: 15px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #ffd560; }
.pfl-card label { display: flex; align-items: flex-start; gap: 10px; font-size: 16px; cursor: pointer; }
.pfl-card input { width: 22px; height: 22px; margin: 1px 0 0; accent-color: #ffd560; flex: 0 0 auto; }
.pfl-card small { display: block; color: #a7b0ba; font-size: 13px; margin-top: 2px; }
.pfl-x { position: absolute; right: 8px; top: 8px; width: 34px; height: 34px; font-size: 20px !important; background: transparent !important; color: #cfd8e2 !important; }
.pfl.is-touch .pfl-help { left: 50%; transform: translateX(-50%); bottom: max(10px, env(safe-area-inset-bottom)); }
.pfl.is-touch .pfl-helptab { margin: 5px auto 0; }
.pfl.is-touch .pfl-help ul { position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%); width: max-content; max-width: 86vw; }
.pfl.is-touch .pfl-btns { left: 0; right: 0; max-width: none; justify-content: center; bottom: calc(max(20px, env(safe-area-inset-bottom)) + 210px); padding: 0 10px; }
.pfl.is-touch.is-seat .pfl-btns, .pfl.is-touch.is-watch .pfl-btns { bottom: calc(max(20px, env(safe-area-inset-bottom)) + 52px); }
.pfl.is-touch .pfl-jump { bottom: calc(max(20px, env(safe-area-inset-bottom)) + 270px); }
.pfl.is-touch.is-watch .pfl-jump { bottom: calc(max(20px, env(safe-area-inset-bottom)) + 112px); }
@media (max-width: 640px) { .pfl-help li { font-size: 13.5px; } .pfl-b { height: 46px; } }
`;

// what a ship of this bay bumps into, made once (about a third of a second)
const SOLIDS = new Map();
export function solidFor(cfg, outside = null) {
  const key = cfg.id;
  if (!SOLIDS.has(key)) SOLIDS.set(key, stationSolid({ bay: bayOf(cfg.pad[2]), lists: outside ? outside.triangles() : null }));
  return SOLIDS.get(key);
}

export function startFlying(ctx, opts = {}) {
  const { W, boarding, crane, outside = null } = ctx;
  const cfg = opts.cfg || M.MINER, pilot = opts.pilot !== false, canvas = W.renderer.domElement;
  const B = boarding.ships.find((s) => s.id === cfg.id);
  if (!B || !B.M) throw new Error('flying: the ' + cfg.id + '\'s cabin is not in');
  if (!document.getElementById('pfl-css')) { const st = document.createElement('style'); st.id = 'pfl-css'; st.textContent = CSS; document.head.appendChild(st); }
  const S = M.makeShip(cfg), solid = solidFor(cfg, outside);
  const set = { invertY: !!(opts.settings && opts.settings.invertY) };
  const say = opts.words || (() => {});
  let goal = opts.goal || 'leave', auto = !pilot, plan = null, startIn = pilot ? 0 : 1.4, view = opts.view === 'behind' ? 'behind' : 'cockpit';
  let on = true, locked = false, closed = false, offered = false, everClear = false, panelUp = false;
  let mouse = 'pointer', captured = false, hadLock = false, rightDown = false, mx = innerWidth / 2, my = innerHeight / 2;
  let touch = matchMedia('(pointer: coarse)').matches;
  const canLock = !navigator.webdriver && typeof canvas.requestPointerLock === 'function';
  const held = new Set(), pend = { dx: 0, dy: 0 }, orbit = { yaw: 0, pitch: 0 }, sticks = { l: { x: 0, y: 0, id: null }, r: { x: 0, y: 0, id: null } };

  // ── the buttons, the help corner, the sticks ──
  const el = document.createElement('div'); el.className = 'pfl';
  el.innerHTML = `<div class="pfl-ring" hidden></div>
    <div class="pfl-help"><ul></ul><button type="button" class="pfl-helptab" data-do="help" aria-label="Show or hide what the keys do"><span>Keys</span> <kbd>H</kbd></button></div>
    <div class="pfl-holds is-l" hidden><button type="button" class="pfl-b" data-hold="up">Up</button><button type="button" class="pfl-b" data-hold="down">Down</button></div>
    <div class="pfl-holds is-r" hidden><button type="button" class="pfl-b" data-hold="rollLeft" aria-label="Roll left">Roll &#8630;</button><button type="button" class="pfl-b" data-hold="rollRight" aria-label="Roll right">Roll &#8631;</button></div>
    <div class="pfl-stick is-l" hidden><small>Fly</small><i></i></div><div class="pfl-stick is-r" hidden><small>Nose</small><i></i></div>
    <button type="button" class="pfl-jump" data-do="jump" hidden>Jump <kbd>J</kbd></button>
    <div class="pfl-btns">
      <button type="button" class="pfl-b" data-do="power">Power <kbd>P</kbd></button>
      <button type="button" class="pfl-b" data-hold="up" data-lift>Lift off <kbd>Space</kbd></button>
      <button type="button" class="pfl-b" data-do="autopilot">Autopilot <kbd>T</kbd></button>
      <button type="button" class="pfl-b" data-do="view">View <kbd>V</kbd></button>
      <button type="button" class="pfl-b" data-do="mouse">Mouse <kbd>F</kbd></button>
      <button type="button" class="pfl-b" data-do="controls">Controls</button>
    </div>
    <div class="pfl-card" hidden role="dialog" aria-label="Controls"><button type="button" class="pfl-x" data-do="controls" aria-label="Close">&#10005;</button><h3>Controls</h3>
      <label><input type="checkbox" class="pfl-inv"><span>Flip up and down<small>Off: push the mouse or the stick forward and the nose goes up. On: pull it back and the nose goes up.</small></span></label></div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s), $$ = (s) => [...el.querySelectorAll(s)];
  const helpEl = $('.pfl-help'), inv = $('.pfl-inv'), card = $('.pfl-card');
  inv.checked = set.invertY;
  inv.addEventListener('change', () => { set.invertY = inv.checked; if (opts.onSettings) opts.onSettings({ ...set }); });
  let helpShut = null;      // (the help corner: open on a wide screen, behind its tab on a phone, until it is asked for or put away)
  // (a button is pressed as a finger touches it, or as the mouse comes up on it, not by the browser's own click: a
  // second finger, tapping a button while the first holds a stick, makes no click at all; a click with no press before
  // it is a key pressed on the button, and is taken too)
  for (const b of $$('[data-do]')) {
    let down = false, at = 0;
    b.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { setTouch(true); at = performance.now(); e.preventDefault(); press(b.dataset.do); return; } down = true; });
    b.addEventListener('pointerup', (e) => { if (!down) return; down = false; at = performance.now(); e.preventDefault(); press(b.dataset.do); b.blur(); });
    b.addEventListener('pointercancel', () => { down = false; }); b.addEventListener('pointerleave', () => { down = false; });
    b.addEventListener('click', (e) => { e.preventDefault(); if (performance.now() - at < 600) return; press(b.dataset.do); b.blur(); });
  }
  for (const b of $$('[data-hold]')) {
    const a = b.dataset.hold, off = () => held.delete(a);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (locked) return; if (e.pointerType === 'touch') setTouch(true); held.add(a); try { b.setPointerCapture(e.pointerId); } catch (x) { /* gone */ } });
    b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  }
  for (const k of ['l', 'r']) {
    const box = $('.pfl-stick.is-' + k), knob = box.querySelector('i'), st = sticks[k];
    const move = (e) => { const r = box.getBoundingClientRect(), R = r.width / 2, x = (e.clientX - r.left - R) / (R * 0.72), y = (e.clientY - r.top - R) / (R * 0.72), L = Math.hypot(x, y), s = L > 1 ? 1 / L : 1; st.x = x * s; st.y = y * s; knob.style.transform = `translate(${st.x * R * 0.72}px, ${st.y * R * 0.72}px)`; };
    const end = (e) => { if (e.pointerId !== st.id) return; st.id = null; st.x = st.y = 0; knob.style.transform = ''; };
    box.addEventListener('pointerdown', (e) => { e.preventDefault(); st.id = e.pointerId; try { box.setPointerCapture(e.pointerId); } catch (x) { /* gone */ } move(e); });
    box.addEventListener('pointermove', (e) => { if (e.pointerId === st.id) move(e); });
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  }
  function setTouch(v) { if (touch === v) return; touch = v; if (v) setMouse('pointer'); painted = ''; }
  // everything held is let go: the keys, the sticks, the mouse's last move (whenever the controls are put away: a
  // finger lifted while its stick is hidden must not leave the stick pushed)
  function letGo() { held.clear(); pend.dx = pend.dy = 0; rightDown = false; liftMouse = false; for (const k of ['l', 'r']) { sticks[k].x = sticks[k].y = 0; sticks[k].id = null; $('.pfl-stick.is-' + k + ' i').style.transform = ''; } }

  // ── the mouse: flying, or an ordinary pointer ──
  function capture(want) {
    if (!canLock) return;
    try {
      if (want && document.pointerLockElement !== canvas) { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); }
      else if (!want && document.pointerLockElement === canvas) document.exitPointerLock();
    } catch (e) { /* not allowed now: the pointer's place flies it instead */ }
  }
  function setMouse(m) { if (touch && m === 'fly') m = 'pointer'; mouse = m; pend.dx = pend.dy = 0; hadLock = false; capture(m === 'fly'); painted = ''; }
  // (lifting off by a key, the mouse starts to fly only once the browser has given it to the game: not held, it would
  // turn the nose at once toward wherever the pointer happened to be, a button in a corner. F asks for that outright.)
  let liftLock = 0;
  const onLock = () => {
    captured = document.pointerLockElement === canvas;
    if (captured && mouse !== 'fly') { if (liftLock > 0 && pilot && !auto && !S.landed) { mouse = 'fly'; pend.dx = pend.dy = 0; } else { capture(false); return; } }
    liftLock = 0;
    if (captured) hadLock = true; else if (hadLock && mouse === 'fly') { mouse = 'pointer'; hadLock = false; }
    painted = '';
  };
  const looking = () => view === 'behind' && (held.has('look') || rightDown);
  function onMove(e) {
    if (e.pointerType === 'touch' || closed || !on) return;
    mx = e.clientX; my = e.clientY;
    const dx = e.movementX || 0, dy = e.movementY || 0;
    if (looking()) { orbit.yaw -= dx * VIEW.orbit.speed; orbit.pitch = Math.max(-VIEW.orbit.most, Math.min(VIEW.orbit.most, orbit.pitch + dy * VIEW.orbit.speed)); return; }
    if (mouse === 'fly' && captured) { pend.dx += dx; pend.dy += dy; }
  }
  function onDown(e) {
    if (closed || !on || locked || e.pointerType === 'touch') { if (e.pointerType === 'touch') setTouch(true); return; }
    if (e.button === 2) { rightDown = true; return; }
    // (a click on the view itself, in flight: the mouse flies)
    if (e.button === 0 && pilot && !auto && !S.landed && mouse === 'pointer') setMouse('fly');
  }
  const onUp = (e) => { if (e.button === 2) rightDown = false; };
  const onMenu = (e) => { if (!closed && on) e.preventDefault(); };

  // ── the keys ──
  const typing = (e) => { const t = e.target; return !!(t && t.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.type !== 'checkbox'); };
  function onKey(e) {
    if (closed || !on || locked || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    const a = M.KEYS[e.code]; if (!a) return;
    e.preventDefault();
    if (M.HELD.includes(a)) { held.add(a); if (a === 'up' && pilot && !auto && S.landed && !touch && mouse !== 'fly') liftMouse = true; return; }
    if (!e.repeat) press(a);
  }
  const onKeyUp = (e) => { const a = M.KEYS[e.code]; if (a) held.delete(a); if (a === 'up' && S.landed) liftMouse = false; };
  let liftMouse = false;
  const onBlur = () => letGo();
  addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
  addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp); canvas.addEventListener('contextmenu', onMenu);
  document.addEventListener('pointerlockchange', onLock);

  const planFor = () => (goal === 'land' || (goal === 'free' && everClear && !S.landed) ? M.planLand(S, solid) : M.planLeave(S, solid));
  function press(a) {
    if (closed || !on) return false;
    if (a === 'controls') { card.hidden = !card.hidden; if (!card.hidden && mouse === 'fly') setMouse('pointer'); return true; }
    if (a === 'help') { helpShut = !helpEl.classList.contains('is-shut'); painted = ''; return true; }
    if (locked) return false;
    if (a === 'view') { view = view === 'cockpit' ? 'behind' : 'cockpit'; fresh = true; orbit.yaw = orbit.pitch = 0; painted = ''; return true; }
    if (!pilot) return false;
    if (a === 'power') { if (!S.landed) return false; M.setPower(S, !S.power); painted = ''; return true; }
    if (a === 'autopilot') {
      auto = !auto; plan = auto ? planFor() : null;
      if (auto) setMouse('pointer'); else if (!S.landed && !touch && canLock) { liftLock = 1.5; capture(true); }
      painted = ''; return true;
    }
    if (a === 'mouse') { if (auto || touch) return false; setMouse(mouse === 'fly' ? 'pointer' : 'fly'); return true; }
    if (a === 'jump') { if (!offered || goal === 'land') return false; if (opts.onJump) opts.onJump(); return true; }
    return false;
  }

  // ── the ship, drawn where it is: its hull's room, its cabin, its thrusters; the speed's screen rides in it ──
  const rig = new THREE.Group(); rig.name = 'flying: ' + cfg.id; rig.matrixAutoUpdate = false; rig.matrix.copy(B.M); W.scene.add(rig);
  const screen = (() => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 112;
    const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const sc = cfg.screen, mesh = new THREE.Mesh(new THREE.PlaneGeometry(sc.size[0], sc.size[1]), new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false }));
    // (it faces back at the pilot, leaning back a little)
    mesh.position.set(...sc.at); mesh.rotation.set(-sc.lean, Math.PI, 0, 'YXZ'); rig.add(mesh);
    let shown = null;
    function draw(words, power) {
      const key = words + '|' + power; if (key === shown) return; shown = key;
      g.fillStyle = '#05090e'; g.fillRect(0, 0, 256, 112);
      g.strokeStyle = power ? 'rgba(120, 220, 255, 0.75)' : 'rgba(120, 220, 255, 0.18)'; g.lineWidth = 3; g.strokeRect(3.5, 3.5, 249, 105);
      if (power) {
        g.fillStyle = '#7fd4ee'; g.font = '700 20px "Segoe UI", system-ui, Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('SPEED', 16, 30);
        g.fillStyle = '#eaffff'; g.font = '800 62px "Segoe UI", system-ui, Arial, sans-serif'; g.textAlign = 'right'; g.fillText(words.split(' ')[0], 168, 92);
        g.fillStyle = '#7fd4ee'; g.font = '700 26px "Segoe UI", system-ui, Arial, sans-serif'; g.textAlign = 'left'; g.fillText('m/s', 178, 92);
      }
      tex.needsUpdate = true;
    }
    return { mesh, tex, draw, dispose() { mesh.geometry.dispose(); mesh.material.dispose(); tex.dispose(); } };
  })();
  const _D = new THREE.Matrix4(), _T = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _acc = new THREE.Vector3(), now = new THREE.Matrix4();
  let parked = true;
  function pose(dt) {
    // (on its pad with the power off: exactly as it is parked, its thrusters at rest; with the power on its engine idles)
    if (S.landed && !S.power) {
      if (!parked) { crane.fly(null); boarding.fly(cfg.id, null); parked = true; now.copy(B.M); rig.matrix.copy(now); rig.matrixWorldNeedsUpdate = true; }
      return;
    }
    parked = false;
    _D.compose(_p.set(...S.p), _q.set(...S.q), _one).multiply(_T.makeTranslation(-cfg.pad[0], -cfg.pad[1], -cfg.pad[2]));
    // (how it is moving, for its thrusters: its push in the kit's frame, x its left, y up, z its nose; in the bay the
    // pods hold it up, out in space nothing needs to)
    const hold = S.landed ? 0 : Math.max(0, Math.min(1, (DOOR.face + 8 - S.p[0]) / 12)), inBay = S.p[0] < DOOR.face + 8;
    crane.fly(_D, dt, { acc: _acc.set(-S.acc[2], S.acc[1], S.acc[0]), spin: S.spin, hold, engine: S.engine, heat: 1, x: S.p[0], z: S.p[2], height: inBay ? S.p[1] - cfg.pad[1] : null });
    boarding.fly(cfg.id, _D);
    now.multiplyMatrices(_D, B.M); rig.matrix.copy(now); rig.matrixWorldNeedsUpdate = true;
  }
  now.copy(B.M);

  // ── what shows: the buttons and the help, by what is going on ──
  let painted = '';
  const modeNow = () => (!pilot || auto ? 'watch' : S.landed ? 'seat' : mouse === 'fly' ? 'fly' : 'pointer');
  function paint() {
    const mode = modeNow(), canJump = offered && goal !== 'land' && pilot;
    const key = [mode, auto, view, canJump, S.power, S.landed, touch, goal, locked, helpShut, captured, S.settle ? 1 : 0, S.p[0] > DOOR.face + 2 ? 1 : 0].join('|');
    if (key === painted) return; painted = key;
    el.hidden = locked; el.classList.toggle('is-touch', touch); el.classList.toggle('is-seat', mode === 'seat'); el.classList.toggle('is-watch', mode === 'watch');
    const rows = M.helpFor(mode, { pilot, auto, behind: view === 'behind', canJump, touch });
    helpEl.querySelector('ul').innerHTML = rows.map(([k, w]) => (k ? `<li><kbd>${k}</kbd><span>${w}</span></li>` : `<li class="is-word"><span>${w}</span></li>`)).join('');
    helpEl.classList.toggle('is-shut', helpShut == null ? touch : helpShut);
    $('.pfl-helptab span').textContent = touch ? 'Help' : 'Keys';
    const b = (name) => $(`.pfl-btns [data-do="${name}"]`), flying = pilot && !auto && !S.landed;
    b('power').hidden = !(pilot && S.landed && !auto); b('power').classList.toggle('is-on', S.power);
    $('[data-lift]').hidden = !(pilot && S.landed && !auto);
    b('autopilot').hidden = !pilot; b('autopilot').classList.toggle('is-on', auto);
    b('mouse').hidden = !(flying && !touch); b('mouse').classList.toggle('is-on', mouse === 'fly');
    b('controls').hidden = !pilot;
    for (const k of $$('.pfl kbd')) if (k.closest('.pfl-btns, .pfl-jump, .pfl-helptab')) k.hidden = touch;
    $('.pfl-jump').hidden = !canJump;
    for (const s of $$('.pfl-stick, .pfl-holds')) s.hidden = !(touch && flying);
    if (!flying && (sticks.l.id != null || sticks.r.id != null || sticks.l.x || sticks.l.y || sticks.r.x || sticks.r.y)) letGo();
    $('.pfl-ring').hidden = !(mode === 'fly' && !captured);
    // a few words on what is happening
    const outThere = S.p[0] > DOOR.face + 2;
    say(!pilot ? `${opts.flier || 'The crew\'s pilot'} is flying` : auto ? (goal === 'land' || (goal === 'free' && everClear) ? 'Autopilot: in through the bay door, down on the pad' : 'Autopilot: out of the hangar, clear of the station')
      : S.landed ? 'At the controls' : S.settle ? 'Setting down' : goal === 'land' ? 'Fly in through the bay door and set down on your pad' : canJump ? 'Clear of the station' : outThere ? 'Fly clear of the station' : 'Fly out through the bay door');
  }

  // ── the cameras ──
  const _eye = new THREE.Vector3(), _look = new THREE.Vector3(), _up = new THREE.Vector3(), _arm = new THREE.Vector3(), _e = new THREE.Euler(), camLook = new THREE.Vector3(), camPos = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0), _want = new THREE.Vector3();
  let fresh = true;
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  function aim(camera, dt = 1 / 60) {
    if (closed || !on) return false;
    const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640;
    _up.set(0, 1, 0).transformDirection(now);
    let fov, near;
    if (view === 'cockpit') {
      const st = cfg.seat, lk = tall ? (panelUp ? st.lookTallPanel : st.lookTall) : panelUp ? st.lookPanel : st.look;
      _eye.set(pilot ? st.eye[0] : -st.eye[0], st.eye[1], st.eye[2]); _look.set(...lk);
      // (the look eases in the ship's own frame, so a turning ship does not leave it behind)
      if (fresh) camLook.copy(_look); else camLook.lerp(_look, 1 - Math.exp(-3 * dt));
      camera.position.copy(_eye).applyMatrix4(now); camera.up.copy(_up); camera.lookAt(_look.copy(camLook).applyMatrix4(now));
      fov = tall ? st.fovTall : st.fov; near = VIEW.near.cockpit;
    } else {
      const bh = cfg.behind;
      // (let go, the look round the ship swings back behind it)
      if (!looking()) { const k = Math.exp(-VIEW.orbit.back * dt); orbit.yaw *= k; orbit.pitch *= k; if (Math.abs(orbit.yaw) > Math.PI) orbit.yaw -= Math.sign(orbit.yaw) * 2 * Math.PI; }
      _look.set(...bh.look).applyMatrix4(now);
      const a = [_look.x, _look.y, _look.z];
      // (never through a wall: where it would be behind one (in the bay, under its roof) it follows lower, and failing
      // that is brought in along its line to the ship as far as is clear)
      let best = -1;
      for (const up of bh.ups || [bh.up]) {
        _arm.set(0, up - bh.look[1], -bh.back - bh.look[2]).applyAxisAngle(X, orbit.pitch).applyAxisAngle(Y, orbit.yaw);
        _eye.set(...bh.look).add(_arm).applyMatrix4(now);
        const t = solid.clear(a, [_eye.x, _eye.y, _eye.z], 0.75);
        if (t > best + 0.02) { best = t; _want.copy(_look).lerp(_eye, Math.max(VIEW.least, t)); }
        if (t >= 1) break;
      }
      if (fresh) { camPos.copy(_want); camUp.copy(_up); } else { camPos.lerp(_want, 1 - Math.exp(-VIEW.follow * dt)); camUp.lerp(_up, 1 - Math.exp(-VIEW.follow * dt)).normalize(); }
      const t = Math.max(VIEW.least, solid.clear(a, [camPos.x, camPos.y, camPos.z], 0.6));
      camera.position.copy(_look).lerp(camPos, t); camera.up.copy(camUp); camera.lookAt(_look);
      fov = tall ? bh.fovTall : bh.fov; near = VIEW.near.behind;
    }
    fresh = false;
    if (camera.fov !== fov || camera.near !== near || camera.far !== VIEW.far) { camera.fov = fov; camera.near = near; camera.far = VIEW.far; camera.updateProjectionMatrix(); }
    return true;
  }
  const dustWas = W.dust ? W.dust.visible : false;
  function restoreCamera() {
    const c = W.camera; c.up.set(0, 1, 0);
    if (c.near !== 0.03 || c.far !== (W.sees || 120)) { c.near = 0.03; c.far = W.sees || 120; c.updateProjectionMatrix(); }
    if (W.dust) W.dust.visible = dustWas;
  }
  if (outside) outside.flying = cfg.room;

  const api = {
    S, solid, cfg,
    get on() { return on && !closed; }, get view() { return view; }, get auto() { return auto; }, get mouse() { return mouse; }, get offered() { return offered; }, get goal() { return goal; }, set goal(g) { goal = g; painted = ''; },
    set panel(v) { panelUp = !!v; },
    update(dt) {
      if (closed || !on) return;
      let C = M.noControls();
      if (!locked) {
        if (auto) {
          if (startIn > 0) startIn -= dt;
          else { if (!plan) plan = planFor(); C = M.fly(S, plan, dt) || M.noControls(); }
        } else if (pilot) {
          C = M.controlsOf(held);
          if (touch) { C.move[0] += -sticks.l.y; C.move[2] += sticks.l.x; C.turn = M.stickTurn(sticks.r.x, sticks.r.y, set); }
          else if (mouse === 'fly' && !looking()) {
            if (captured) C.nudge = M.mouseTurn(pend.dx, pend.dy, set);
            else { const R = Math.min(innerWidth, innerHeight) * 0.42; C.turn = M.stickTurn((mx - innerWidth / 2) / R, (my - innerHeight / 2) / R, set); }
          }
        }
      }
      pend.dx = pend.dy = 0;
      const was = S.landed;
      M.stepShip(S, C, dt, solid);
      if (was && !S.landed) { if (liftMouse && pilot && !auto && canLock) { liftLock = 1.5; capture(true); } liftMouse = false; painted = ''; }
      if (liftLock > 0) liftLock -= dt;
      if (!was && S.landed) { setMouse('pointer'); auto = !pilot; plan = null; painted = ''; pose(dt); if (opts.onLanded) opts.onLanded(); if (closed || !on) return; }
      const clear = !S.landed && M.clearOf(S.p, offered);
      if (clear !== offered) { offered = clear; painted = ''; if (clear && !everClear) { everClear = true; if (opts.onClear) opts.onClear(); if (closed || !on) return; } }
      pose(dt);
      screen.draw(M.speedWords(S), S.power);
      paint();
    },
    aim,
    // just before the picture: no haze once the camera is out of the bay (after the boarding's light has had its say),
    // and none of the rooms' drifting dust out there
    late() {
      if (closed || !on) return;
      const out = !!(outside && outside.out), k = out ? 1 : Math.max(0, Math.min(1, (W.camera.position.x - (DOOR.face - 6)) / 22));
      if (W.scene.fog && k > 0) { W.scene.fog.near += k * k * 1e4; W.scene.fog.far += k * k * 2e4; }
      if (W.dust) W.dust.visible = dustWas && !out;
    },
    lock(v) { locked = !!v; letGo(); if (locked) { setMouse('pointer'); card.hidden = true; } painted = ''; paint(); },
    // the ship has jumped: parked again where the station's rooms have it, nothing of the flying drawn or heard
    away() {
      if (closed) return;
      M.park(S); S.power = true; auto = !pilot; plan = null; offered = false; letGo(); setMouse('pointer');
      crane.fly(null); boarding.fly(cfg.id, null); parked = true; now.copy(B.M); rig.matrix.copy(now); rig.visible = false;
      on = false; el.hidden = true; if (outside) outside.flying = null; restoreCamera();
    },
    // out of the jump home: outside the station, in sight of it
    arrive() {
      if (closed) return;
      const A = M.arrival(cfg); M.place(S, A.p, A.q); S.engine = 0.15; letGo();
      goal = 'land'; offered = false; auto = !pilot; plan = null; startIn = pilot ? 0 : 0.8; on = true; locked = false; fresh = true; rig.visible = true; el.hidden = false; painted = '';
      if (outside) outside.flying = cfg.room;
      pose(1 / 60); paint();
    },
    // (the lab: back on its pad with the power off, as when first sat down in)
    reset() {
      if (closed) return;
      M.park(S); S.power = false; S.engine = 0; auto = !pilot; plan = null; offered = false; everClear = false; letGo(); setMouse('pointer');
      on = true; locked = false; fresh = true; rig.visible = true; el.hidden = false; if (outside) outside.flying = cfg.room;
      pose(1 / 60); painted = ''; paint();
    },
    // (the rigs, and the lab: the ship put somewhere at once)
    put(p, q = null) { M.place(S, p, q || M.facing([1, 0, 0])); fresh = true; pose(1 / 60); painted = ''; },
    press, hold(a, v = true) { if (v) held.add(a); else held.delete(a); }, stick(k, x, y) { sticks[k].x = x; sticks[k].y = y; }, setTouch,
    pointer(x, y) { mx = x; my = y; },
    state: () => ({ on, view, auto, mouse, captured, canLock, locked, offered, everClear, goal, pilot, touch, mode: modeNow(), power: S.power, landed: S.landed, settling: !!S.settle, p: S.p.map((v) => +v.toFixed(2)), q: S.q.map((v) => +v.toFixed(3)), speed: +M.speedOf(S).toFixed(2), bump: +S.bump.toFixed(3), legs: plan ? plan.length : 0, invertY: set.invertY,
      help: [...el.querySelectorAll('.pfl-help li')].map((li) => li.textContent.trim()), helpShut: helpEl.classList.contains('is-shut'), buttons: $$('.pfl-btns .pfl-b, .pfl-jump').filter((b) => !b.hidden).map((b) => [...b.childNodes].filter((n) => !n.hidden).map((n) => n.textContent).join('').trim().replace(/\s+/g, ' ')), sticks: !$('.pfl-stick').hidden, clearOf: +M.boxDist(S.p).toFixed(1) }),
    close() {
      if (closed) return; closed = true;
      removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
      removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp); canvas.removeEventListener('contextmenu', onMenu);
      document.removeEventListener('pointerlockchange', onLock); capture(false);
      crane.fly(null); boarding.fly(cfg.id, null);
      W.scene.remove(rig); screen.dispose(); el.remove(); if (outside) outside.flying = null; restoreCamera();
    },
  };
  screen.draw(M.speedWords(S), S.power); paint();
  return api;
}
