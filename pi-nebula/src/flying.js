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
// LANDING (2026-11-18, later): "I don't wan the ship taking over. That will annoy me. ... There should be some kind of
// guidance that appears on the hanger floor or just in midair that should request you to find the correct heading and
// shows you how far forward/back/left/right you are from being centered. I am hoping the information is displayed in a
// helpful way, it could be a small model and a hologram as the goal in the same space, so you try to make both of them
// match. That could also help for being centered when coming in the hanger. Anyway, if the pilot sets down and is still
// crooked then I would hope the crane can just compensate for it. ... Even if they just come straight in and land it
// nose-in, that should be okay (as long as the ship is not upside down). Once they leave the hanger and come back then
// the ship should be reset in it's proper parking spot. If they do have the ship rolled over to much for a landing
// (like upside down) then it shouldn't allow them out of the seat until they have corrected it. One thing that could be
// helpful is to show the keys that would correct the ship to a preferred landing position. There could be a qweasad
// grid in the corner and arrows for the mouse that could light up keys to orient the ship correctly. The could glow
// brightly when a lot of input is needed and dim once they are close."
//
// SO, COMING HOME:
//   - NOTHING SETS THE SHIP DOWN FOR A PILOT (src/flymodel.js LAND). Brought down onto its hangar's floor it stands
//     there on its legs, wherever and whichever way round. That is told at once to the crane and the cabin (crane.stand:
//     the ship, its cabin, its lift and its walls are then there), so the ship is never drawn anywhere but where it
//     is. Down where the crane can unload it, the seat's prompt comes up (Get up, E): not by itself, so the pilot can
//     lift off again and shuffle it. Rolled over too far, or down too near the door or a wall, there is no prompt, and
//     the few words along the top say what to do.
//   - THE GUIDE (flymodel.js guideOf):
//       the small space, THE TINY SHIP: a small model of the ship, as the pilot sees their own ship from behind, and a
//       see-through blue hologram of the goal, the ship in its proper parking place, nose out, with its pad's ring, the
//       hangar's floor, the bay door and the door's middle line drawn round it. The two are the same size and match
//       when the ship is on its goal; far apart they are drawn nearer together (flymodel.js guideAt), so the goal is in
//       sight from the jump home on, and coming in the door's frame and its middle line pass round the model. It is on
//       the dashboard's display (below), and seen from behind it floats beside the ship; all the time the ship's power
//       is on (out at the rocks, with no pad there, the tiny ship alone). From the jump home until it is down it asks:
//       "Line up with the blue ship" under it, and
//       the keys, at the top left: Q W E, A S D, Space and C, and four arrows for the mouse; each key that would bring
//       the ship toward the goal is lit, brightly when a lot is needed, dimly when it is close, dark when it is there. On
//       a phone the same on the sticks (a spot on each ring: push that way) and on the Up, Down and Roll buttons.
//     It only asks. A ship set down crooked, or nose in, is down all the same. Nothing is scored and no word judges it.
//   - ANYONE ON THE FLOOR under a ship coming down hurries out of its way (people.flee, as from the crane's load).
//
// THE DASHBOARD (2026-11-19, LAND-4, B: "In the cockpit, a hologram standing on the sill in front of the pilot beside
// the speed; from behind, floating beside the ship", and: "You should use that big unused dashboard area. Like 1/3 of
// the screen is being unused in the screenshot. I'd move the speed down into it and put the tiny ship in a display there
// (and probably just show it all the time. ... we should show more information like fuel or distance traveled or
// canisters full, time in route, something more than one number." NOW-4, B: "A fuel gauge for show: it goes down as
// you fly, and there is always enough for the run." And of the speed's own screen (2026-11-20): "I'd prefer it be on a
// big screen like where that math question is with other flight data ... It just looks out of place all by itself on
// it's own little screen"):
//   - ONE DISPLAY on the dashboard in front of the crew member's seat (the pilot's; riding beside the pilot, the other
//     seat's, across the ship), where the ship's own data puts it (src/fleet.js `dash`: on the empty top of the
//     dashboard under the windscreen; on a screen held upright, its own place above a phone's buttons): three framed screens on one dark glass, light lines: THE TINY SHIP (above); THE SPEED and THE FUEL, a
//     gauge and its percent; HOW FAR, THE CANISTERS FULL (on a run) and THE FLIGHT TIME. Their numbers are src/dash.js:
//     the flying's own in the labs, the run's over the whole of it in the game (src/trip.js). Dark but for its frames
//     while the ship's power is off. The speed has no screen of its own any more.
//   - FROM BEHIND the tiny ship floats beside the ship on the screen, see-through, clear of the ship, the buttons and
//     whatever the page asks to be kept clear of (opts.clearOf).
//
// THE OTHER TWO HANGARS, AND THE SHIP'S VOICE (2026-11-18, later still; asked whether the Miner should be able to fly
// in through the other two hangar doors): "Lol, I'm sure kids will try to do this and it will make them laugh, so why
// not. I think it would be good if people can go in and then you would hear an alarm and red lights started spinning
// around in the hanger and people started running around and it started saying "Safety Violation" over and over in
// your cockpit. It would even be appropriate for the other ship to get moved around if they rammed it. But it would be
// reset the next time they entered into the other hanger. No need for damage or anything like that. By the way, since
// I am thinking about sounds, we should get sounds for the ships too. Like a welcome message from the ship to the
// pilot when it gets turned on (a robotic "Welcome aboard pilot, Systems Ready") ... It would also be cool if the
// different ships had different sound clips."
//   - The other two bays are open to it, and the ships parked in them give way to a bump (flymodel.js OTHERS,
//     pushOthers; src/visit.js keeps them, draws them where they are and sets the alarm off: `ctx.visit`).
//   - In another ship's hangar the ship can rest on the floor but is never down, so THE SEAT'S PROMPT NEVER COMES UP
//     THERE; the words along the top say whose hangar it is and what to do.
//   - ITS VOICE (src/voices.js SHIP_CLIPS, flymodel.js voiceStep): "Welcome aboard, pilot. Systems ready." once each
//     time someone sits down and the power comes on; "Safety violation." over and over while it is in another hangar.
//     Heard in the cockpit, from everywhere, in both views.
//
// HOW THE SHIP MOVES IN THE PICTURE: the parked ship is a room of the station (drawn with its hangar) and its cabin is
// built where it stands (src/boarding.js). Flown, both are drawn moved by one matrix, from where it is parked to
// where it is now (crane.fly, boarding.fly): the same ship, its own cockpit, its own thrusters (kit/ships/flight.js).
// The crew member's body stays in the seat of the ship as it last stood, unseen; nothing walks about a ship in flight.
//
// THE MOUSE: in flight it points the nose. The game holds it (pointer lock) when the browser lets it, never under a
// test rig (navigator.webdriver: a page holding the mouse there has run the machine out of memory before); not held,
// the nose turns toward wherever the pointer is from the middle of the screen. F gives the mouse back as an ordinary
// pointer for the buttons (the ship then holds its heading), and F again takes it. Lifting off by a key takes the
// mouse by itself only if the browser gives it to the game; otherwise it stays a pointer until F (or a click on the
// view) asks for it, so the nose never swings off toward a pointer left on a button.
//
// AT THE ROCKS (2026-11-18: "the pilot flies if you are operating the drill. If you signed up for both there can be a
// button that lets you switch tasks. Either way, you should be able to click on an asteroid to travel over to it (If
// you want to fly and you signed up to be a pilot, you can click a button to fly manually if you want)"): the same
// flying, kept. The ship out there is the drill's own Miner in the field (src/drillview.js), so the flying is given a
// `body`: where that ship is drawn and what it bumps into (the rocks), in place of the hangar's crane and cabin. The
// keys, the two views, the help corner, a phone's sticks and buttons are these same ones. There is nothing to land on
// out there, so no Power and no Lift off, and no autopilot of its own (a tapped rock is where the autopilot flies, in
// the drill's view); `task` is the one more button, for a crew member with both jobs: back to the drill.
// src/fieldfly.js joins the two.
//
//   const F = startFlying({ W, boarding, crane, hull, outside, people, visit }, { cfg, pilot, goal, settings, flier, on... })
//     cfg         the ship's own facts (src/fleet.js flightOf): EVERY SHIP IS FLOWN BY THIS SAME CODE from its data
//     hull        whoever draws its hull where it is flown, fires its thrusters and keeps where it stands: the Miner's
//                 crane (its canisters ride with it; the default), or the ship's own (src/shiphull.js makeHull)
//     body        at the rocks, in place of boarding and crane: { at (Matrix4: the field's own frame in the world), M0
//                 (Matrix4: the ship's kit frame in the flight model's), p, f (where it is and the way its nose points,
//                 the field's frame), fly(M) (the ship drawn there: M, its kit frame in the field's), solid }
//     task        { words, on() }: one more button (M), for a pilot who also has another job out there
//     visit       the other two hangars' keeper (src/visit.js), or none: then nothing is parked in them
//     goal        'leave' (out of the hangar and clear of the station) | 'land' (in and down in its hangar) | 'free' (the lab)
//     pilot       false: the crew's pilot flies (the autopilot, and no way to switch it off)
//     settings    { invertY }; onSettings(settings) when the crew member changes one
//     guide       'land' (the guide asks while the goal is to land) | 'always' (whenever it is in flight: the lab)
//     dash        the dashboard's numbers (src/dash.js makeDash), kept and stepped by whoever owns them (a run: src/trip.js);
//                 none: the flying keeps its own, from the ship's own moves ("Back on the pad", reset, fills the tank)
//     run         () -> { cans: [full, of] }: what the dashboard says of the run (none: no canisters)
//     clearOf     () -> [elements]: the page's own boxes the tiny ship floating beside the ship keeps clear of
//     onClear()   once, when the ship is first clear of the station; onJump(): the Jump button; onLanded(): it is down
//     onStand(M)  the ship stands somewhere else than it did: M, a Matrix4 from where it stood to where it stands (the
//                 crew member's body, in its seat, is the caller's to move with it)
//     onGetUp()   the seat's prompt, pressed: the crew member gets up (none: no prompt, the lab)
//     words(w)    a few words on what is happening, for whoever shows them (the trip's strip along the top)
//     people      () -> the station's people (src/people.js), or null
//   F.update(dt)  each frame; F.aim(camera, dt) after the game's own camera; F.late() just before the picture
//   F.lock(on)    the controls and the buttons put away for a while (the jump computer's cards are up)
//   F.away()      the ship back where it is parked, nothing of the flying drawn (it has jumped: src/trip.js)
//   F.arrive()    out of the jump home: outside the station, in sight of it, to fly in and land
//   F.press(what), F.hold(what, on)   a key's work, by name (the buttons; the rigs)
//   F.skip()      a part of the flying skipped by someone who takes no part in it: clear of the station, or down on its pad
//   F.pause(on)   put away altogether for a while, the ship left where it is (at the rocks: the drill's view has the eye)
//   F.eye(camera) where the eye is now, in the ship's own kit frame: { eye, look, fov } (for a glide that starts there)
//   F.eyeFrom(camera)   the view from behind taken up from wherever the eye is now, so it eases there and does not jump
//   F.close()
import * as THREE from 'three';
import * as M from './flymodel.js';
import { stationJob, bayOf } from './flysolid.js';
import { standElements } from './standing.js';
import { sound } from './sound.js';
import { SHIP_CLIPS, clipUrl } from './voices.js';
import { makeDash, stepDash, resetDash, dashRows } from './dash.js';
import { DOOR } from '../kit/outside-plan.js';
import { shipOf } from './fleet.js';

export const VIEW = { near: { cockpit: 0.05, behind: 0.4 }, far: 6000, follow: 7, orbit: { speed: 0.0052, back: 5, most: 1.25 }, least: 0.3, glide: 0.6 };
// THE GUIDE'S SMALL SPACE: its own small picture, drawn over the game's (W.after). Its eye is behind and above the small
// model, which stands in the middle, its nose away from the eye; `edge` is how far out the furthest thing is drawn.
// under: how low over the floor a ship coming down sends anyone under it running (m), how much room round it (m), how
// often it looks (s)
export const HOLO = { fov: 40, eye: [0, 2.5, 1.5], look: [0, 0.05, -0.12], back: 0x060a10, model: 0xe2e6ea, mark: 0xffb347, goal: 0x58d2ff, line: 0x7fdcff, pad: 7 };
export const UNDER = { low: 3.4, room: 1.3, every: 0.35, away: 2.5 };
// THE DASHBOARD'S DISPLAY: its picture's width (px; its height as the display's own shape), the tiny ship's picture's
// width (px), how often its words are drawn again in flight (s), its colours (dark glass, light lines), its case.
// FLOAT: the tiny ship seen from behind, floating beside the ship: how far from the ship on the screen and from the
// screen's edges (px), and how see-through its glass is
export const DASH = { px: 1024, pic: 512, every: 1 / 6, glass: '#04070b', screen: '#06101a', line: 'rgba(120, 220, 255, 0.78)', dim: 'rgba(120, 220, 255, 0.2)', label: '#7fd4ee', value: '#eaffff', track: 'rgba(120, 220, 255, 0.16)', case: 0x0a0d11 };
export const FLOAT = { gap: 10, edge: 8, see: 0.62 };
const FONT = '"Segoe UI", system-ui, Arial, sans-serif';
const GUIDE_WORDS = 'Line up with the blue ship';

// where things are on the display's picture (px): three screens in a row, the first square for the tiny ship (its
// picture `pic`, its caption under it), then the speed and the fuel, then the rest
export function dashLayout(CW, CH) {
  const m = Math.round(CH * 0.05), gap = Math.round(CH * 0.05), side = CH - 2 * m, w1 = Math.round(side * 1.22), rest = CW - 2 * m - w1 - 2 * gap;
  const s1 = { x: m, y: m, w: w1, h: side }, s2 = { x: s1.x + w1 + gap, y: m, w: Math.round(rest * 0.45), h: side };
  const s3 = { x: s2.x + s2.w + gap, y: m, w: CW - m - (s2.x + s2.w + gap), h: side };
  const pad = Math.round(CH * 0.03), capH = Math.round(CH * 0.13);
  return { CW, CH, s: [s1, s2, s3], pad, cap: { x: s1.x, y: s1.y + side - capH, w: w1, h: capH }, pic: { x: s1.x + pad, y: s1.y + pad, w: w1 - 2 * pad, h: side - 2 * pad - capH } };
}
// a screen's frame: eight-sided, as the game's other boxes are
function frame(g, r, k, fill, line, lw) {
  g.beginPath(); g.moveTo(r.x + k, r.y); g.lineTo(r.x + r.w - k, r.y); g.lineTo(r.x + r.w, r.y + k); g.lineTo(r.x + r.w, r.y + r.h - k); g.lineTo(r.x + r.w - k, r.y + r.h); g.lineTo(r.x + k, r.y + r.h); g.lineTo(r.x, r.y + r.h - k); g.lineTo(r.x, r.y + k); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); } if (line) { g.strokeStyle = line; g.lineWidth = lw; g.stroke(); }
}
// (text no wider than w: made smaller until it fits)
function fit(g, text, x, y, w, px, weight = 700) { let p = px; g.font = `${weight} ${p}px ${FONT}`; while (p > 8 && g.measureText(text).width > w) { p -= 2; g.font = `${weight} ${p}px ${FONT}`; } g.fillText(text, x, y); return g.measureText(text).width; }
// THE DISPLAY'S PICTURE: rows from src/dash.js dashRows; lit: the ship's power is on; caption: under the tiny ship
export function paintDash(g, L, rows, lit, caption = '') {
  const { CW, CH, s, pad } = L, k = Math.round(CH * 0.05), lw = Math.max(2, Math.round(CH * 0.012));
  g.fillStyle = DASH.glass; g.fillRect(0, 0, CW, CH);
  for (const r of s) frame(g, r, k, DASH.screen, lit ? DASH.line : DASH.dim, lw);
  if (!lit) return;
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const by = (id) => rows.find((r) => r.id === id);
  const lab = Math.round(CH * 0.085), big = Math.round(CH * 0.27), mid = Math.round(CH * 0.14);
  // the tiny ship's caption
  if (caption) { g.fillStyle = '#a9e6ff'; g.textAlign = 'center'; fit(g, caption, L.cap.x + L.cap.w / 2, L.cap.y + L.cap.h * 0.62, L.cap.w - 2 * pad, Math.round(CH * 0.07), 600); g.textAlign = 'left'; }
  // the speed, big, and the fuel's gauge and number
  { const r = s[1], x = r.x + pad * 1.4, w = r.w - pad * 2.8, sp = by('speed'), fu = by('fuel');
    g.fillStyle = DASH.label; fit(g, sp.label, x, r.y + pad + lab, w, lab);
    g.fillStyle = DASH.value; const vw = fit(g, sp.value, x, r.y + pad + lab + big * 0.98, w * 0.62, big, 800);
    g.fillStyle = DASH.label; fit(g, sp.unit, x + vw + pad * 0.6, r.y + pad + lab + big * 0.98, w - vw - pad * 0.6, mid);
    const fy = r.y + r.h * 0.6;
    g.fillStyle = DASH.label; fit(g, fu.label, x, fy + lab, w, lab);
    const bh = Math.round(CH * 0.1), bx = x, bw = Math.round(w * 0.56), byy = fy + lab + pad * 0.7;
    g.fillStyle = DASH.track; g.fillRect(bx, byy, bw, bh);
    g.fillStyle = DASH.label; g.fillRect(bx, byy, Math.round(bw * fu.gauge), bh);
    g.strokeStyle = DASH.line; g.lineWidth = Math.max(1, lw * 0.6); g.strokeRect(bx, byy, bw, bh);
    g.fillStyle = DASH.value; const fw = fit(g, fu.value, bx + bw + pad, byy + bh * 0.98, w - bw - pad * 2.6, Math.round(mid * 1.05), 800);
    g.fillStyle = DASH.label; fit(g, fu.unit, bx + bw + pad + fw + pad * 0.3, byy + bh * 0.98, w - bw - pad * 1.3 - fw, Math.round(mid * 0.7));
  }
  // how far, the canisters, how long: each its label over its number
  { const r = s[2], x = r.x + pad * 1.4, w = r.w - pad * 2.8, rest = rows.filter((q) => !['speed', 'fuel'].includes(q.id)), each = (r.h - pad * 1.2) / rest.length;
    rest.forEach((q, i) => {
      const y0 = r.y + pad * 0.6 + i * each, ly = y0 + (each - lab - mid * 1.05) / 2 + lab;
      g.fillStyle = DASH.label; fit(g, q.label, x, ly, w, lab);
      g.fillStyle = DASH.value; const vw = fit(g, q.value, x, ly + mid * 1.05, w * (q.unit ? 0.7 : 1), mid, 800);
      if (q.unit) { g.fillStyle = DASH.label; fit(g, q.unit, x + vw + pad * 0.5, ly + mid * 1.05, w - vw - pad * 0.5, Math.round(mid * 0.7)); }
    });
  }
}

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
.pfl.is-touch .pfl-help { left: 0; right: 0; max-width: none; bottom: max(10px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: center; pointer-events: none; }
.pfl.is-touch .pfl-help ul { pointer-events: auto; }
.pfl.is-touch .pfl-helptab { margin: 5px auto 0; }
/* (on a phone the help opens as a card in the upper part of the screen, clear of the sticks and the buttons; a tap on it puts it away) */
.pfl.is-touch .pfl-help ul { position: fixed; top: max(150px, 20vh); bottom: auto; left: 50%; transform: translateX(-50%); width: max-content; max-width: 90vw; background: rgba(13, 17, 23, 0.95); box-shadow: inset 0 0 0 2px rgba(255, 205, 60, 0.75); }
.pfl.is-touch .pfl-btns { left: 0; right: 0; max-width: none; justify-content: center; bottom: calc(max(20px, env(safe-area-inset-bottom)) + 210px); padding: 0 10px; }
.pfl.is-touch.is-seat .pfl-btns, .pfl.is-touch.is-watch .pfl-btns { bottom: calc(max(20px, env(safe-area-inset-bottom)) + 52px); }
.pfl.is-touch .pfl-jump { bottom: calc(max(20px, env(safe-area-inset-bottom)) + 270px); }
.pfl.is-touch.is-watch .pfl-jump { bottom: calc(max(20px, env(safe-area-inset-bottom)) + 112px); }
@media (max-width: 640px) { .pfl-help li { font-size: 13.5px; } .pfl-b { height: 46px; } }
/* THE GUIDE: the small space (its picture is drawn by the game under this frame) and the keys that would help */
.pfl-guide { position: absolute; left: max(14px, env(safe-area-inset-left)); top: 66px; width: 224px; display: flex; flex-direction: column; gap: 7px; }
.pfl-guide[hidden] { display: none; }
/* THE TINY SHIP SEEN FROM BEHIND: floating beside the ship (its picture is drawn by the game under this frame, see-through) */
.pfl-float { position: absolute; left: 0; top: 0; width: 200px; }
.pfl-fpic { height: 168px; box-shadow: inset 0 0 0 1.5px rgba(120, 220, 255, 0.6);
  clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px); }
.pfl-float[hidden] { display: none; }
.pfl-float small { display: block; margin-top: 3px; text-align: center; font-size: 12px; line-height: 1.15; font-weight: 600; color: #a9e6ff; text-shadow: 0 1px 2px #000, 0 0 4px #000; }
.pfl-float small:empty { display: none; }
.pfl-keys { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 9px; background: rgba(13, 17, 23, 0.84); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.32);
  clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px); }
.pfl-keys[hidden] { display: none; }
.pfl-kb { display: grid; grid-template-columns: repeat(3, 34px); gap: 4px; }
.pfl-ms { display: grid; grid-template-columns: repeat(3, 24px); grid-template-rows: repeat(3, 24px); gap: 2px; align-items: center; justify-items: center; }
/* (the mouse itself, drawn small in the middle of its four arrows) */
.pfl-ms b { position: relative; grid-column: 2; grid-row: 2; width: 13px; height: 19px; border: 1.5px solid #9aa5b1; border-radius: 6px 6px 7px 7px; }
.pfl-ms b::after { content: ""; position: absolute; left: 50%; top: 2px; width: 1.5px; height: 5px; margin-left: -0.75px; background: #9aa5b1; }
.pfl-keys i { --k: 0; position: relative; isolation: isolate; display: grid; place-items: center; height: 28px; min-width: 0; font: 700 13px/1 ui-monospace, "SF Mono", Consolas, monospace; font-style: normal; color: #7d8894;
  background: rgba(8, 11, 16, 0.9); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.28); border-radius: 4px; }
.pfl-keys i::before { content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; background: #ffd560; opacity: var(--k); box-shadow: 0 0 calc(var(--k) * 14px) rgba(255, 205, 60, 0.95); }
.pfl-keys i.is-on { color: #f3f5f7; } .pfl-keys i.is-hot { color: #14100a; }
.pfl-keys i.is-wide { grid-column: span 2; font-size: 11px; }
.pfl-ms i { width: 24px; height: 24px; font-size: 11px; }
.pfl-ms i[data-m="up"] { grid-column: 2; grid-row: 1; } .pfl-ms i[data-m="left"] { grid-column: 1; grid-row: 2; } .pfl-ms i[data-m="right"] { grid-column: 3; grid-row: 2; } .pfl-ms i[data-m="down"] { grid-column: 2; grid-row: 3; }
/* (a phone: the same hint as a spot on each stick's ring, the way to push it, and a glow on the buttons to hold) */
.pfl-stick u { --k: 0; position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: #ffd560; opacity: var(--k); box-shadow: 0 0 calc(var(--k) * 16px) rgba(255, 205, 60, 0.95); pointer-events: none; text-decoration: none; }
.pfl-holds .pfl-b { --k: 0; position: relative; isolation: isolate; }
.pfl-holds .pfl-b::before { content: ""; position: absolute; inset: 0; z-index: -1; background: #ffd560; opacity: calc(var(--k) * 0.9); }
.pfl-holds .pfl-b.is-hot { color: #14100a !important; }
/* THE SEAT'S PROMPT, down in the hangar: as the game's other seats have */
.pfl-seat { position: absolute; left: 50%; bottom: max(84px, calc(env(safe-area-inset-bottom) + 70px)); transform: translateX(-50%); display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 18px; pointer-events: auto; max-width: calc(100vw - 32px);
  background: rgba(15, 19, 25, 0.9); box-shadow: inset 0 0 0 1.5px rgba(196, 220, 240, 0.36);
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px); }
.pfl-seat[hidden] { display: none; }
.pfl-seat div { display: flex; flex-direction: column; min-width: 0; }
.pfl-seat b { font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; } .pfl-seat small { font-size: 13px; color: #a7b0ba; }
.pfl-seat button { flex: none; height: 44px; padding: 0 18px; font-size: 15px !important; font-weight: 800 !important; letter-spacing: 0.08em; text-transform: uppercase; color: #1c1205 !important; background: #ff8f2e !important;
  clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px); }
.pfl-seat button kbd { margin-left: 8px; background: rgba(0, 0, 0, 0.18); color: #1c1205; }
.pfl.is-touch .pfl-seat { bottom: calc(max(20px, env(safe-area-inset-bottom)) + 176px); }
/* (seen from the seat: the Jump button and the seat's prompt just above the dashboard's display, never over it) */
.pfl.is-dash .pfl-jump, .pfl.is-dash .pfl-seat { bottom: var(--dash-up) !important; }
@media (max-width: 640px) { .pfl-float { width: 120px; } .pfl-fpic { height: 104px; } .pfl-float small { font-size: 10.5px; } }
@media (max-height: 480px) { .pfl-float { width: 108px; } .pfl-fpic { height: 84px; } .pfl-float small { font-size: 10px; } }
@media (max-width: 640px) {
  .pfl-guide { top: max(136px, calc(env(safe-area-inset-top) + 132px)); left: max(8px, env(safe-area-inset-left)); width: 152px; }
  /* (the seat's prompt across a phone's screen, over the buttons' two rows) */
  .pfl-seat { left: 10px; right: 10px; transform: none; max-width: none; justify-content: space-between; } .pfl-seat b { white-space: nowrap; }
}
`;

// what a ship of this bay bumps into, made once, as a job (about a third of a second's work on a desktop, more on a
// phone: done a little each frame while the ship sits on its pad, and finished at once if it is wanted sooner)
const SOLIDS = new Map();
// (its own bay, and the other hangars' bays it can fly into by hand: cfg.others)
export function solidFor(cfg, outside = null) {
  const key = cfg.id;
  if (!SOLIDS.has(key)) SOLIDS.set(key, stationJob({ bay: cfg.bay || bayOf(cfg.pad[2]), bays: (cfg.others || []).map((o) => o.bay), lists: outside ? outside.triangles() : null }));
  return SOLIDS.get(key);
}

export function startFlying(ctx, opts = {}) {
  // (hull: whoever keeps the ship's hull where it is flown and stands, its thrusters and its pad: the Miner's crane, or
  // the ship's own shared hull, src/shiphull.js)
  const { W, boarding, crane = null, hull = crane, outside = null, people = () => null, visit = null } = ctx;
  const cfg = opts.cfg || M.MINER, pilot = opts.pilot !== false, canvas = W.renderer.domElement;
  // (at the rocks: a body of its own, the top of this file; then there is no cabin, no crane and no station here)
  const body = opts.body || null;
  const B = body ? null : boarding.ships.find((s) => s.id === cfg.id);
  if (!body && (!B || !B.M)) throw new Error('flying: the ' + cfg.id + '\'s cabin is not in');
  if (!document.getElementById('pfl-css')) { const st = document.createElement('style'); st.id = 'pfl-css'; st.textContent = CSS; document.head.appendChild(st); }
  // WHERE IT STANDS: its proper parking place, or wherever it was last set down by hand (boarding has it: B.D, from
  // where it is parked to where it stands). As the flight model has it ({ p, q }), and back as that matrix.
  // (a ship parked nose in, cfg.q0: the flight model's turn is the move's turn after the parked one)
  const q0 = new THREE.Quaternion(...M.parkedTurn(cfg)), q0i = q0.clone().invert();
  const standNow = () => { if (body || !B.moved) return null; const p = new THREE.Vector3(...cfg.pad).applyMatrix4(B.D), q = new THREE.Quaternion().setFromRotationMatrix(B.D); if (cfg.q0) q.multiply(q0); return { p: p.toArray(), q: q.toArray() }; };
  const matrixOf = (st) => (st ? new THREE.Matrix4().fromArray(standElements(cfg.q0 ? { p: st.p, q: new THREE.Quaternion(...st.q).multiply(q0i).toArray() } : st, cfg.pad)) : null);
  const S = body ? M.makeFieldShip(body.p, body.f, cfg) : M.makeShip(cfg, standNow()), job0 = body ? null : solidFor(cfg, outside);
  // WHAT IT BUMPS INTO: the station (the job above, worked a little at a time), and with it the ships parked in the
  // other two hangars (src/visit.js keeps them: where each is, how it is sliding). They give way to a bump
  // (flymodel.js pushOthers), and the camera that follows the ship is kept out of them too.
  const others = visit ? visit.others : [];
  let whole = null;
  const withOthers = (s) => { if (!s) return null; if (!whole || whole.station !== s) whole = { ...s, station: s, push: (ship) => M.pushOthers(ship, others), clear: (a, b, r) => Math.min(s.clear(a, b, r), M.clearOfOthers(a, b, r ?? 0.8, others)) }; return whole; };
  const job = body ? { finish: () => body.solid, run: () => body.solid } : { finish: () => withOthers(job0.finish()), run: (ms) => withOthers(job0.run(ms)) };
  // ITS VOICE (src/voices.js SHIP_CLIPS, by the ship's own name; when each is said: flymodel.js voiceStep): heard in the
  // cockpit, from everywhere, in both views. Never the browser's own speech: a ship with no clip says nothing.
  const clips = body ? {} : SHIP_CLIPS[cfg.voice] || {}, voice = M.makeVoice(), heard = { welcome: 0, safety: 0 };
  const secs = { welcome: (clips.welcome && clips.welcome.secs) || M.VOICE.welcome, safety: (clips.safety && clips.safety.secs) || M.VOICE.safety, gap: M.VOICE.gap };
  if (body) voice.welcomed = true;      // (its welcome was said as the crew member sat down, at the station)
  for (const c of Object.values(clips)) sound.load(c.id, clipUrl(c.id));
  let saying = null, there = null;
  const set = { invertY: !!(opts.settings && opts.settings.invertY) };
  const say = opts.words || (() => {});
  let goal = opts.goal || 'leave', auto = !pilot, plan = null, startIn = pilot ? 0 : 1.4, view = opts.view === 'behind' ? 'behind' : 'cockpit';
  // (aside: the crew member is on their feet aboard (src/trip.js): no key, button or pointer of theirs flies it, nothing
  // of it is on the screen, and whoever has it, the autopilot or the crew's pilot, flies on)
  let on = true, locked = false, closed = false, offered = false, everClear = false, panelUp = false, aside = false;
  let mouse = 'pointer', captured = false, hadLock = false, rightDown = false, mx = innerWidth / 2, my = innerHeight / 2;
  let seatUp = false, guideOn = false, keysOn = false, eArmed = true, underT = 0;
  // (the ship's power on: its dashboard lit, and its tiny ship shown. Out at the rocks it always is)
  const powered = () => !!body || S.power;
  let touch = matchMedia('(pointer: coarse)').matches;
  const canLock = !navigator.webdriver && typeof canvas.requestPointerLock === 'function';
  const held = new Set(), pend = { dx: 0, dy: 0 }, orbit = { yaw: 0, pitch: 0 }, sticks = { l: { x: 0, y: 0, id: null }, r: { x: 0, y: 0, id: null } };

  // ── the buttons, the help corner, the sticks ──
  const el = document.createElement('div'); el.className = 'pfl';
  el.innerHTML = `<div class="pfl-ring" hidden></div>
    <div class="pfl-float" hidden role="img" aria-label="A small model of your ship, and in blue where it parks"><div class="pfl-fpic"></div><small></small></div>
    <div class="pfl-guide" hidden><div class="pfl-keys" aria-label="The keys that would line it up, lit"><div class="pfl-kb"><i data-k="rollLeft">Q</i><i data-k="forward">W</i><i data-k="rollRight">E</i><i data-k="left">A</i><i data-k="reverse">S</i><i data-k="right">D</i><i data-k="up" class="is-wide">Space</i><i data-k="down">C</i></div>
        <div class="pfl-ms" aria-label="The mouse"><i data-m="up">&#9650;</i><i data-m="left">&#9664;</i><b></b><i data-m="right">&#9654;</i><i data-m="down">&#9660;</i></div></div></div>
    <div class="pfl-seat" hidden><div><b></b><small></small></div><button type="button" data-do="getup">Get up <kbd>E</kbd></button></div>
    <div class="pfl-help"><ul></ul><button type="button" class="pfl-helptab" data-do="help" aria-label="Show or hide what the keys do"><span>Keys</span> <kbd>H</kbd></button></div>
    <div class="pfl-holds is-l" hidden><button type="button" class="pfl-b" data-hold="up">Up</button><button type="button" class="pfl-b" data-hold="down">Down</button></div>
    <div class="pfl-holds is-r" hidden><button type="button" class="pfl-b" data-hold="rollLeft" aria-label="Roll left">Roll &#8630;</button><button type="button" class="pfl-b" data-hold="rollRight" aria-label="Roll right">Roll &#8631;</button></div>
    <div class="pfl-stick is-l" hidden><small>Fly</small><u></u><i></i></div><div class="pfl-stick is-r" hidden><small>Nose</small><u></u><i></i></div>
    <button type="button" class="pfl-jump" data-do="jump" hidden>Jump <kbd>J</kbd></button>
    <div class="pfl-btns">
      <button type="button" class="pfl-b" data-do="power">Power <kbd>P</kbd></button>
      <button type="button" class="pfl-b" data-hold="up" data-lift>Lift off <kbd>Space</kbd></button>
      <button type="button" class="pfl-b" data-do="autopilot">Autopilot <kbd>T</kbd></button>
      <button type="button" class="pfl-b" data-do="view">View <kbd>V</kbd></button>
      <button type="button" class="pfl-b" data-do="mouse">Mouse <kbd>F</kbd></button>
      <button type="button" class="pfl-b" data-do="controls">Controls</button>
      <button type="button" class="pfl-b pfl-task" data-do="task" hidden></button>
    </div>
    <div class="pfl-card" hidden role="dialog" aria-label="Controls"><button type="button" class="pfl-x" data-do="controls" aria-label="Close">&#10005;</button><h3>Controls</h3>
      <label><input type="checkbox" class="pfl-inv"><span>Flip up and down<small>Off: push the mouse or the stick forward and the nose goes up. On: pull it back and the nose goes up.</small></span></label></div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s), $$ = (s) => [...el.querySelectorAll(s)];
  const helpEl = $('.pfl-help'), inv = $('.pfl-inv'), card = $('.pfl-card');
  inv.checked = set.invertY;
  inv.addEventListener('change', () => { set.invertY = inv.checked; if (opts.onSettings) opts.onSettings({ ...set }); });
  let helpShut = null;      // (the help corner: open on a wide screen, behind its tab on a phone, until it is asked for or put away)
  helpEl.querySelector('ul').addEventListener('pointerdown', (e) => { if (touch && e.pointerType === 'touch') { e.preventDefault(); press('help'); } });
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
    if (closed || !on || locked || aside || e.pointerType === 'touch') { if (e.pointerType === 'touch') setTouch(true); return; }
    if (e.button === 2) { rightDown = true; return; }
    // (a click on the view itself, in flight: the mouse flies)
    if (e.button === 0 && pilot && !auto && !S.landed && mouse === 'pointer') setMouse('fly');
  }
  const onUp = (e) => { if (e.button === 2) rightDown = false; };
  const onMenu = (e) => { if (!closed && on) e.preventDefault(); };

  // ── the keys ──
  const typing = (e) => { const t = e.target; return !!(t && t.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.type !== 'checkbox'); };
  function onKey(e) {
    if (closed || !on || aside || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    const a = M.KEYS[e.code]; if (!a) return;
    // (the controls put away, for the jump computer's cards and the jump itself: the two views can still be changed, so
    // a jump can be watched from the cockpit or from behind)
    if (locked) { if (a === 'view' && !e.repeat) { e.preventDefault(); press('view'); } return; }
    e.preventDefault();
    // (E, down where the seat lets them out: get up; never by an E still held from rolling as it came down)
    if (a === 'rollRight' && seatUp) { if (eArmed && !e.repeat) press('getup'); return; }
    if (M.HELD.includes(a)) { held.add(a); if (a === 'up' && pilot && !auto && S.landed && !touch && mouse !== 'fly') liftMouse = true; return; }
    if (!e.repeat) press(a);
  }
  const onKeyUp = (e) => { const a = M.KEYS[e.code]; if (a) held.delete(a); if (a === 'up' && S.landed) liftMouse = false; if (a === 'rollRight') eArmed = true; };
  let liftMouse = false;
  const onBlur = () => letGo();
  addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
  addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp); canvas.addEventListener('contextmenu', onMenu);
  document.addEventListener('pointerlockchange', onLock);

  const planFor = () => (goal === 'land' || (goal === 'free' && everClear && !S.landed) ? M.planLand(S, job.finish()) : M.planLeave(S, job.finish()));
  function press(a) {
    if (closed || !on || aside) return false;
    if (a === 'controls') { card.hidden = !card.hidden; if (!card.hidden && mouse === 'fly') setMouse('pointer'); return true; }
    if (a === 'help') { helpShut = !helpEl.classList.contains('is-shut'); painted = ''; return true; }
    if (a === 'view') { view = view === 'cockpit' ? 'behind' : 'cockpit'; fresh = true; glideNext = true; orbit.yaw = orbit.pitch = 0; painted = ''; return true; }
    if (locked) return false;
    // (the seat's prompt: out of the seat, for the pilot and for a crew member riding alike)
    if (a === 'getup') { if (!seatUp) return false; letGo(); opts.onGetUp(); return true; }
    if (!pilot) return false;
    // (at the rocks, a pilot with another job as well: back to it)
    if (a === 'task') { if (!opts.task) return false; letGo(); opts.task.on(); return true; }
    if (body && a === 'autopilot') return false;
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

  // ── the ship, drawn where it is: its hull's room, its cabin, its thrusters; the dashboard's display rides in it ──
  const rig = new THREE.Group(); rig.name = 'flying: ' + cfg.id; rig.matrixAutoUpdate = false; if (B) rig.matrix.copy(B.M); W.scene.add(rig);
  // THE DASHBOARD'S DISPLAY (the top of this file; its numbers src/dash.js): standing on the dashboard in front of the
  // pilot where this ship's data puts it (cfg.dash), facing the pilot's eyes: three framed screens on one dark glass,
  // the tiny ship (the guide's small space, drawn into a picture of its own: holo.toTarget), the speed and the fuel,
  // and how far, the canisters (on a run) and how long. Dark but for its frames while the ship's power is off.
  const dash = (() => {
    const spec = cfg.dash, CW = DASH.px, CH = Math.round(CW * spec.h / spec.w);
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
    const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const L = dashLayout(CW, CH);
    const group = new THREE.Group(); group.name = 'the dashboard\'s display';
    const face = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false }));
    // (its case: a thin dark slab behind the glass, so it is a thing standing there, seen from any side)
    const back = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.024, spec.h + 0.024, 0.018), new THREE.MeshBasicMaterial({ color: DASH.case, fog: false }));
    back.position.z = -0.0105;
    // (the tiny ship's own picture, over the first screen)
    const rt = new THREE.WebGLRenderTarget(DASH.pic, Math.round(DASH.pic * L.pic.h / L.pic.w), { samples: 4 });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(spec.w * L.pic.w / CW, spec.h * L.pic.h / CH), new THREE.MeshBasicMaterial({ map: rt.texture, fog: false, toneMapped: false }));
    pic.position.set(spec.w * ((L.pic.x + L.pic.w / 2) / CW - 0.5), spec.h * (0.5 - (L.pic.y + L.pic.h / 2) / CH), 0.0012);
    group.add(back, face, pic);
    // (standing on its foot, leaning back toward the nose, facing the pilot; on a screen held upright where the ship's
    // data puts it for one (`tall`): the same display, its size as that place has it)
    let placed = null;
    function place(tall) {
      const s = (tall && spec.tall) || spec; if (s === placed) return; placed = s;
      // (turned a little about upright, `turn`, to follow a curved dashboard: its port end nearer the pilot)
      // (in front of the crew member's own seat: the other seat, riding beside the pilot, has it across the ship, as its
      // eyes are)
      const m = pilot ? 1 : -1, t = m * (s.turn || 0), up = [Math.sin(s.lean) * Math.sin(t), Math.cos(s.lean), Math.sin(s.lean) * Math.cos(t)];
      group.position.set(m * s.at[0] + up[0] * s.h / 2, s.at[1] + up[1] * s.h / 2, s.at[2] + up[2] * s.h / 2); group.rotation.set(-s.lean, Math.PI + t, 0, 'YXZ');
      group.scale.setScalar(s.w / spec.w);
    }
    place(false);
    rig.add(group);
    let shown = null, cap = null, at = -1e9;
    function draw(rows, lit, caption, t) {
      const key = lit ? rows.map((r) => r.value).join('|') : 'off';
      if (key === shown && caption === cap) return;
      // (the numbers change many times a second in flight: drawn again a few times a second, as a dashboard's are;
      // at once when the power or the caption changes)
      if (shown !== null && shown !== 'off' && key !== 'off' && caption === cap && t - at < DASH.every) return;
      shown = key; cap = caption; at = t;
      paintDash(g, L, rows, lit, caption);
      pic.visible = lit;
      tex.needsUpdate = true;
    }
    // (where it is on the screen, CSS px: its face's corners seen by the camera; null when it is not in front of it)
    const _c = new THREE.Vector3(), P = face.geometry.attributes.position;
    function onScreen(camera) {
      face.updateWorldMatrix(true, false); camera.updateMatrixWorld();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < P.count; i++) { _c.fromBufferAttribute(P, i).applyMatrix4(face.matrixWorld).project(camera); if (_c.z > 1 || _c.z < -1) return null; const x = (_c.x + 1) / 2 * innerWidth, y = (1 - _c.y) / 2 * innerHeight; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      return x1 < 0 || x0 > innerWidth || y1 < 0 || y0 > innerHeight ? null : { left: x0, top: y0, right: x1, bottom: y1 };
    }
    return { group, rt, aspect: L.pic.w / L.pic.h, draw, place, onScreen, get words() { return shown; }, get tall() { return placed !== spec; },
      dispose() { face.geometry.dispose(); face.material.dispose(); back.geometry.dispose(); back.material.dispose(); pic.geometry.dispose(); pic.material.dispose(); tex.dispose(); rt.dispose(); } };
  })();
  const _D = new THREE.Matrix4(), _T = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _acc = new THREE.Vector3(), now = new THREE.Matrix4();
  let parked = true;
  function pose(dt) {
    // (at the rocks: the drill's own Miner drawn where the ship is; `now` is the ship's kit frame in the field's)
    if (body) { parked = false; now.compose(_p.set(...S.p), _q.set(...S.q), _one).multiply(body.M0); body.fly(now, dt); rig.matrix.multiplyMatrices(body.at, now); rig.matrixWorldNeedsUpdate = true; return; }
    // (on its pad with the power off: exactly as it is parked, its thrusters at rest; with the power on its engine idles)
    if (S.landed && !S.power) {
      if (!parked) { hull.fly(null); boarding.fly(cfg.id, null); parked = true; now.copy(B.M); rig.matrix.copy(now); rig.matrixWorldNeedsUpdate = true; }
      return;
    }
    parked = false;
    _q.set(...S.q); if (cfg.q0) _q.multiply(q0i);
    _D.compose(_p.set(...S.p), _q, _one).multiply(_T.makeTranslation(-cfg.pad[0], -cfg.pad[1], -cfg.pad[2]));
    // (how it is moving, for its thrusters: its push in the kit's frame, x its left, y up, z its nose; in the bay the
    // pods hold it up, out in space nothing needs to)
    const hold = S.landed ? 0 : Math.max(0, Math.min(1, (DOOR.face + 8 - S.p[0]) / 12)), inBay = S.p[0] < DOOR.face + 8;
    hull.fly(_D, dt, { acc: _acc.set(-S.acc[2], S.acc[1], S.acc[0]), spin: S.spin, hold, engine: S.engine, heat: 1, x: S.p[0], z: S.p[2], height: inBay ? S.p[1] - cfg.pad[1] : null });
    boarding.fly(cfg.id, _D);
    now.multiplyMatrices(_D, B.M0); rig.matrix.copy(now); rig.matrixWorldNeedsUpdate = true;
  }
  if (B) now.copy(B.M); else pose(0);
  // WHERE IT STANDS IS TOLD AT ONCE, each time it comes down: the crane (and through it the cabin, the lift and the
  // walls: crane.stand), and whoever keeps the crew member's body in its seat (onStand: from where it stood to where it
  // stands). So it is never drawn anywhere but where it is, and the next lift-off is from there.
  const _was = new THREE.Matrix4(), _move = new THREE.Matrix4();
  function stood() {
    if (body) return;
    const D = matrixOf(M.standOf(S));
    if (!D && !B.moved) return;
    _was.copy(B.D);
    if (hull.stand) hull.stand(D); else boarding.stand(cfg.id, D);
    _move.copy(_was).invert(); if (D) _move.premultiply(D);
    if (parked) { now.copy(B.M); rig.matrix.copy(now); rig.matrixWorldNeedsUpdate = true; }
    if (opts.onStand) opts.onStand(_move);
  }
  // (is a point of the floor under the ship, or within `room` of it? in the ship's own frame: its hull is cfg.points)
  const foot = (() => { let a0 = 0, a1 = 0, r1 = 0; for (const p of cfg.points) { a0 = Math.min(a0, p[0]); a1 = Math.max(a1, p[0]); r1 = Math.max(r1, Math.abs(p[2])); } return { a0, a1, r1 }; })();
  const under = (pos) => { const r = M.unturn(S.q, [pos.x - S.p[0], 0, pos.z - S.p[2]]); return r[0] > foot.a0 - UNDER.room && r[0] < foot.a1 + UNDER.room && Math.abs(r[2]) < foot.r1 + UNDER.room; };

  // ── THE GUIDE'S SMALL SPACE: a small model of the ship and the hologram of its goal, in a small picture of their own ──
  // (the ship's own shape in a few boxes, metres in its own frame: [from, to] along it, across it and up, and what it is)
  const holo = (() => {
    // (the ship's own: src/fleet.js `model`)
    const BOXES = cfg.model;
    const k = 1 / M.GUIDE.space, c = new THREE.Color();
    function shape(colours) {
      const pos = [], nor = [], col = [], idx = [];
      for (const [a0, a1, r0, r1, u0, u1, part] of BOXES) {
        const g = new THREE.BoxGeometry((r1 - r0) * k, (u1 - u0) * k, (a1 - a0) * k).translate((r0 + r1) / 2 * k, (u0 + u1) / 2 * k, -(a0 + a1) / 2 * k), base = pos.length / 3;
        for (const v of g.attributes.position.array) pos.push(v); for (const v of g.attributes.normal.array) nor.push(v);
        c.set(colours[part] ?? colours.body); for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b);
        for (const i of g.index.array) idx.push(base + i); g.dispose();
      }
      const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.setIndex(idx);
      return out;
    }
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(HOLO.fov, 1, 0.05, 20);
    cam.position.set(...HOLO.eye); cam.lookAt(...HOLO.look);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4658, 1.5)); const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(-1.4, 2.4, 1.5); scene.add(sun);
    // the small model: the pilot's own ship, solid, its nose marked
    const model = new THREE.Mesh(shape({ body: HOLO.model, nose: HOLO.mark, glass: 0x2b3642, pod: 0xb9c0c8, engine: 0x6a727c, leg: 0x8a929c }), new THREE.MeshLambertMaterial({ vertexColors: true, toneMapped: false, fog: false }));
    // the hologram: the goal, see-through, with its edges drawn
    const ghost = shape({ body: 0xffffff }), goal = new THREE.Group(); goal.matrixAutoUpdate = false;
    const glass = new THREE.Mesh(ghost, new THREE.MeshBasicMaterial({ color: HOLO.goal, transparent: true, opacity: 0.26, depthWrite: false, toneMapped: false, fog: false }));
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(ghost), new THREE.LineBasicMaterial({ color: HOLO.line, transparent: true, opacity: 0.95, toneMapped: false, fog: false }));
    goal.add(glass, wire);
    // the lines round the goal, each a run of points of the station (drawn where guideAt puts them): the pad's ring and
    // its cross, the hangar's floor, the bay door's frame, the door's middle line out into space; and the model's own
    // place on the floor (a ring under it and a stem down to it)
    const P = cfg.pad, B2 = cfg.bay, runs = [], run = (pts) => runs.push(pts), y0 = P[1] + 0.02;
    const seg = (a, b, step = 1.5) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step)), out = []; for (let i = 0; i <= n; i++) out.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, a[2] + (b[2] - a[2]) * i / n]); return out; };
    { const ring = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; ring.push([P[0] + Math.cos(a) * HOLO.pad, y0, P[2] + Math.sin(a) * HOLO.pad]); } run(ring); }
    run(seg([P[0] - 2.5, y0, P[2]], [P[0] + 2.5, y0, P[2]])); run(seg([P[0], y0, P[2] - 2.5], [P[0], y0, P[2] + 2.5]));
    if (B2) {
      const z0 = P[2] - DOOR.w / 2, z1 = P[2] + DOOR.w / 2, xb = B2.x0, xd = DOOR.x;
      run([...seg([xd, y0, z0], [xb, y0, z0]), ...seg([xb, y0, z0], [xb, y0, z1]), ...seg([xb, y0, z1], [xd, y0, z1])]);
      run([...seg([xd, y0, z0], [xd, DOOR.h, z0]), ...seg([xd, DOOR.h, z0], [xd, DOOR.h, z1]), ...seg([xd, DOOR.h, z1], [xd, y0, z1]), ...seg([xd, y0, z1], [xd, y0, z0])]);
      for (let x = P[0] + HOLO.pad + 2; x < DOOR.x + 150; x += 9) run(seg([x, y0, P[2]], [x + 4.5, y0, P[2]]));
    }
    const fixed = runs.reduce((n, r) => n + (r.length - 1), 0), own = 24 + 1;
    const lineGeo = new THREE.BufferGeometry(), linePos = new Float32Array((fixed + own) * 6); lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: HOLO.line, transparent: true, opacity: 0.6, toneMapped: false, fog: false })); lines.frustumCulled = false;
    scene.add(lines, goal, model);
    // (out at the rocks there is no pad: the tiny ship alone)
    if (body) goal.visible = lines.visible = false;
    // (seen from behind it floats beside the ship, see-through: a dark glass behind it, drawn first, filling its frame)
    const glassBack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: HOLO.back, transparent: true, opacity: FLOAT.see, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
    glassBack.renderOrder = -1; glassBack.position.z = -1; cam.add(glassBack); scene.add(cam);
    const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _o = new THREE.Vector3(), _sz = new THREE.Vector2(), _cc = new THREE.Color();
    const box = el.querySelector('.pfl-fpic'), boxOf = el.querySelector('.pfl-float');
    let live = false;
    // everything put where the ship now sees it (the ship's frame [ahead, up, right] -> the picture's x right, y up, z back)
    function update() {
      let o = 0;
      const put = (p) => { const w = M.guideAt(S, p); linePos[o++] = w[2]; linePos[o++] = w[1]; linePos[o++] = -w[0]; };
      for (const r of runs) for (let i = 0; i + 1 < r.length; i++) { put(r[i]); put(r[i + 1]); }
      // (the model's own place on the floor of its hangar, while it is over it: a ring under it and a stem down to it)
      const fy = M.floorUnder(S);
      if (fy != null && S.p[1] - fy > 0.15) {
        const f = M.turn(S.q, [1, 0, 0]), r = [f[2], -f[0]], L = Math.hypot(f[0], f[2]) || 1;
        for (let i = 0; i < 24; i++) for (const j of [i, i + 1]) { const a = j / 24 * Math.PI * 2, ca = Math.cos(a) * 5.5, sa = Math.sin(a) * 3.3; put([S.p[0] + (f[0] * ca + r[0] * sa) / L, fy + 0.02, S.p[2] + (f[2] * ca + r[1] * sa) / L]); }
        put(S.p); put([S.p[0], fy + 0.02, S.p[2]]);
      }
      lineGeo.setDrawRange(0, o / 3); lineGeo.attributes.position.needsUpdate = true;
      // the hologram: where the goal is, turned as the goal is, drawn smaller the further off (as the lines round it are)
      const g = M.guideAt(S, P), T = M.guideTurn(S), d = Math.hypot(P[0] - S.p[0], P[1] - S.p[1], P[2] - S.p[2]);
      _x.set(T[2][2], T[2][1], -T[2][0]); _y.set(T[1][2], T[1][1], -T[1][0]); _z.set(-T[0][2], -T[0][1], T[0][0]);
      goal.matrix.makeBasis(_x, _y, _z).scale(_o.setScalar(M.GUIDE.space / (d + M.GUIDE.space))).setPosition(g[2], g[1], -g[0]); goal.matrixWorldNeedsUpdate = true;
    }
    const aspectIs = (a) => { cam.aspect = a; cam.updateProjectionMatrix(); const h = 2 * Math.tan(cam.fov * Math.PI / 360); glassBack.scale.set(h * a * 1.02, h * 1.02, 1); };
    // IN THE COCKPIT: drawn into the dashboard's own picture of it (dash.rt), the frame's picture is not touched
    function toTarget(renderer, rt, aspect) {
      update(); aspectIs(aspect);
      const was = renderer.getRenderTarget(), auto = renderer.autoClear, alpha = renderer.getClearAlpha(); renderer.getClearColor(_cc);
      renderer.setRenderTarget(rt); renderer.autoClear = false; renderer.setClearColor(HOLO.back, 1); renderer.clear(true, true, false);
      renderer.render(scene, cam);
      renderer.setRenderTarget(was); renderer.setClearColor(_cc, alpha); renderer.autoClear = auto;
    }
    // FROM BEHIND: drawn over the game's picture, inside its frame floating beside the ship, see-through
    function draw(renderer) {
      if (!live || el.hidden || boxOf.hidden) return;
      const r = box.getBoundingClientRect(); if (r.width < 8 || r.height < 8) return;
      update();
      renderer.getSize(_sz); const auto = renderer.autoClear, alpha = renderer.getClearAlpha(); renderer.getClearColor(_cc);
      aspectIs(r.width / r.height);
      renderer.setRenderTarget(null); renderer.autoClear = false;
      renderer.setScissorTest(true); renderer.setScissor(r.left, _sz.y - r.bottom, r.width, r.height); renderer.setViewport(r.left, _sz.y - r.bottom, r.width, r.height);
      renderer.clear(false, true, false);
      renderer.render(scene, cam);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, _sz.x, _sz.y); renderer.setClearColor(_cc, alpha); renderer.autoClear = auto;
    }
    W.after.add(draw);
    return { show(v) { live = !!v; }, get live() { return live; }, scene, toTarget, tris: (model.geometry.index.count + ghost.index.count) / 3, draws: 5,
      dispose() { W.after.delete(draw); model.geometry.dispose(); model.material.dispose(); ghost.dispose(); glass.material.dispose(); wire.geometry.dispose(); wire.material.dispose(); lineGeo.dispose(); lines.material.dispose(); glassBack.geometry.dispose(); glassBack.material.dispose(); } };
  })();
  // ── THE TINY SHIP FROM BEHIND, FLOATING BESIDE THE SHIP: its frame put each frame beside where the ship is on the
  // screen, level with its middle, off its starboard side (or its port side if that is clearer), a little higher or
  // lower where that is clearer: never over the ship, the flying's own buttons, sticks, help and keys, or what the page
  // asks to be kept clear (opts.clearOf: the lab's top bar, the run's own boxes), and always on the screen. Not at all
  // while the ship is not in sight ──
  const floatEl = $('.pfl-float'), floatCap = floatEl.querySelector('small');
  // (its body, the first box of its shape (src/fleet.js), in its kit frame, x to port, y up, z to the nose: its corners.
  // A wingtip may be passed over, the body never)
  const corners = (() => {
    const b = (shipOf(cfg.id) || { boxes: [] }).boxes[0] || { a: [-8, 8], r: 3, h: 5 }, out = [];
    for (const x of [-b.r, b.r]) for (const y of [0, b.h]) for (const z of b.a) out.push(new THREE.Vector3(x, y, z));
    return out;
  })();
  const _fp = new THREE.Vector3();
  let floatAt = null, floatSide = 1, clearKey = '', clear = [], clearAge = 0;
  // (what it keeps clear of, as it is now: read again when what is shown changes, and every few frames for the page's
  // own boxes, which come and go by themselves)
  const keepClear = () => {
    const k = painted + '|' + innerWidth + 'x' + innerHeight + '|' + helpEl.classList.contains('is-shut');
    if (k !== clearKey || (opts.clearOf && ++clearAge > 8)) {
      clearKey = k; clearAge = 0;
      const more = opts.clearOf ? opts.clearOf() : [];
      clear = [...$$('.pfl-btns > .pfl-b, .pfl-jump, .pfl-holds .pfl-b, .pfl-stick, .pfl-helptab, .pfl-help ul, .pfl-seat, .pfl-guide'), ...more].filter(Boolean).map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    }
    return clear;
  };
  const over = (x, y, w, h, r) => Math.max(0, Math.min(x + w, r.right) - Math.max(x, r.left)) * Math.max(0, Math.min(y + h, r.bottom) - Math.max(y, r.top));
  function placeFloat(camera, show) {
    const hide = () => { if (!floatEl.hidden) floatEl.hidden = true; floatAt = null; };
    if (!show) { hide(); return; }
    camera.updateMatrixWorld();
    const Wm = world(), W0 = innerWidth, H0 = innerHeight;
    // (the ship on the screen)
    let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity;
    for (const c of corners) { _fp.copy(c).applyMatrix4(Wm).project(camera); if (_fp.z > 1 || _fp.z < -1) { hide(); return; } const x = (_fp.x + 1) / 2 * W0, y = (1 - _fp.y) / 2 * H0; sx0 = Math.min(sx0, x); sy0 = Math.min(sy0, y); sx1 = Math.max(sx1, x); sy1 = Math.max(sy1, y); }
    if (sx1 < 0 || sx0 > W0 || sy1 < 0 || sy0 > H0) { hide(); return; }
    if (floatEl.hidden) floatEl.hidden = false;
    const w = floatEl.offsetWidth, h = floatEl.offsetHeight, keep = [{ left: sx0, top: sy0, right: sx1, bottom: sy1 }, ...keepClear()], mid = (sy0 + sy1) / 2 - h / 2;
    let best = null;
    for (const side of [1, -1]) {
      const x = Math.max(FLOAT.edge, Math.min(W0 - w - FLOAT.edge, side > 0 ? sx1 + FLOAT.gap : sx0 - w - FLOAT.gap));
      for (let k = 0; k <= 16; k++) {
        const dy = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * h * 0.25, y = Math.max(FLOAT.edge, Math.min(H0 - h - FLOAT.edge, mid + dy));
        let score = Math.abs(y - mid) * 2 + (side !== floatSide ? w * 0.5 : 0) + (side < 0 ? w * 0.5 : 0);
        for (const r of keep) score += over(x, y, w, h, r) * 4;
        if (!best || score < best.score) best = { x, y, side, score };
      }
    }
    floatSide = best.side;
    floatAt = [Math.round(best.x), Math.round(best.y), w, h];
    floatEl.style.transform = `translate(${floatAt[0]}px, ${floatAt[1]}px)`;
  }
  // the keys lit: each by how much it is needed (a key's light is written to the page only when it changes)
  const keyEls = Object.fromEntries($$('.pfl-kb i').map((k) => [k.dataset.k, k])), mouseEls = Object.fromEntries($$('.pfl-ms i').map((k) => [k.dataset.m, k]));
  const holdEls = Object.fromEntries($$('.pfl-holds [data-hold]').map((k) => [k.dataset.hold, k])), spotEls = { l: $('.pfl-stick.is-l u'), r: $('.pfl-stick.is-r u') };
  const lit = new Map();
  function light(elm, v, tag = '') {
    const q = Math.round(v * 20) / 20, key = q + tag; if (lit.get(elm) === key) return; lit.set(elm, key);
    elm.style.setProperty('--k', String(q)); elm.classList.toggle('is-on', q > 0); elm.classList.toggle('is-hot', q >= 0.6);
  }
  let hints = null;
  function guide() {
    const G = hints = guideOn ? M.guideOf(S, set) : null;
    const shown = keysOn && G;
    for (const n in keyEls) light(keyEls[n], shown && !touch ? G.keys[n] : 0);
    for (const n in mouseEls) light(mouseEls[n], shown && !touch ? G.mouse[n] : 0);
    for (const n in holdEls) light(holdEls[n], shown && touch ? G.keys[n] : 0);
    // (a phone's sticks: a spot on each ring, the way to push it)
    const spot = (u, x, y, kk) => { const L = Math.hypot(x, y), key = L > 1e-6 ? `:${Math.round(Math.atan2(y, x) * 20)}` : ''; light(u, L > 1e-6 ? kk : 0, key); if (L > 1e-6) u.style.transform = `translate(${(x / L * 46).toFixed(1)}px, ${(y / L * 46).toFixed(1)}px)`; };
    if (shown && touch) { spot(spotEls.l, G.stick.x, G.stick.y, G.stick.k); const mxx = G.mouse.right - G.mouse.left, myy = G.mouse.down - G.mouse.up; spot(spotEls.r, mxx, myy, Math.max(G.mouse.right, G.mouse.left, G.mouse.down, G.mouse.up)); }
    else { light(spotEls.l, 0); light(spotEls.r, 0); }
  }

  // ── what shows: the buttons and the help, by what is going on ──
  let painted = '';
  const modeNow = () => (!pilot || auto ? 'watch' : S.landed ? 'seat' : mouse === 'fly' ? 'fly' : 'pointer');
  function paint() {
    const mode = modeNow(), canJump = offered && goal !== 'land' && pilot;
    // (home: where it stands, and why the seat does not let them out when it does not)
    const where = M.standing(S), why = M.whyNot(S), home = goal === 'land', edge = why === 'edge' ? M.edgeOf(S) : '';
    const key = [mode, auto, view, canJump, S.power, S.landed, touch, goal, locked, aside, helpShut, captured, S.settle ? 1 : 0, S.p[0] > DOOR.face + 2 ? 1 : 0, where, why, edge, there ? there.id : ''].join('|');
    if (key === painted) return; painted = key;
    el.hidden = locked || aside; el.classList.toggle('is-touch', touch); el.classList.toggle('is-seat', mode === 'seat'); el.classList.toggle('is-watch', mode === 'watch');
    // THE SEAT'S PROMPT: home, down where the crane can unload it. THE GUIDE ASKING: coming home, until then (the lab:
    // whenever it is in flight): the tiny ship's caption, and the keys that would line it up, lit for a pilot flying by
    // hand. THE TINY SHIP ITSELF is shown all the time the ship's power is on: on the dashboard, and from behind beside
    // the ship
    seatUp = !!opts.onGetUp && home && (where === 'pad' || where === 'floor');
    guideOn = (home || opts.guide === 'always') && !(S.landed && where !== 'edge');
    keysOn = guideOn && pilot && !auto;
    $('.pfl-seat').hidden = !seatUp; $('.pfl-guide').hidden = !keysOn || touch; $('.pfl-keys').hidden = !keysOn || touch; holo.show(powered());
    floatCap.textContent = guideOn ? GUIDE_WORDS : '';
    if (seatUp) { $('.pfl-seat b').textContent = pilot ? 'Pilot\'s seat' : `The ${cfg.name || 'ship'}'s cockpit`; $('.pfl-seat small').textContent = where === 'pad' ? 'Down on your pad' : 'Down on the hangar floor'; }
    const rows = M.helpFor(mode, { pilot, auto, behind: view === 'behind', canJump, touch, getUp: seatUp, field: !!body, task: opts.task ? opts.task.words : '' });
    helpEl.querySelector('ul').innerHTML = rows.map(([k, w]) => (k ? `<li><kbd>${k}</kbd><span>${w}</span></li>` : `<li class="is-word"><span>${w}</span></li>`)).join('');
    helpEl.classList.toggle('is-shut', helpShut == null ? touch : helpShut);
    $('.pfl-helptab span').textContent = touch ? 'Help' : 'Keys';
    const b = (name) => $(`.pfl-btns [data-do="${name}"]`), flying = pilot && !auto && !S.landed;
    b('power').hidden = !(pilot && S.landed && !auto); b('power').classList.toggle('is-on', S.power);
    $('[data-lift]').hidden = !(pilot && S.landed && !auto);
    b('autopilot').hidden = !pilot || !!body; b('autopilot').classList.toggle('is-on', auto);
    { const tb = b('task'), show = !!(opts.task && pilot); tb.hidden = !show; if (show && tb._w !== opts.task.words) { tb._w = opts.task.words; tb.innerHTML = `${opts.task.words} <kbd>M</kbd>`; } }
    b('mouse').hidden = !(flying && !touch); b('mouse').classList.toggle('is-on', mouse === 'fly');
    b('controls').hidden = !pilot;
    for (const k of $$('.pfl kbd')) if (k.closest('.pfl-btns, .pfl-jump, .pfl-helptab, .pfl-seat')) k.hidden = touch;
    $('.pfl-jump').hidden = !canJump;
    for (const s of $$('.pfl-stick, .pfl-holds')) s.hidden = !(touch && flying);
    if (!flying && (sticks.l.id != null || sticks.r.id != null || sticks.l.x || sticks.l.y || sticks.r.x || sticks.r.y)) letGo();
    $('.pfl-ring').hidden = !(mode === 'fly' && !captured);
    // a few words on what is happening
    const outThere = S.p[0] > DOOR.face + 2;
    // (at the rocks the run's own words stand, but while a pilot flies by hand)
    if (body) { if (pilot && !auto && !locked) say('Flying by hand'); return; }
    // (down at home: where; down where the seat cannot let them out, or lying rolled over: what to do about it)
    say(home && where === 'pad' ? 'Down on your pad' : home && where === 'floor' ? 'Down on the hangar floor'
      : where === 'edge' ? (edge === 'door' ? 'Too near the door for the crane: lift off and set down further in' : 'Too near the wall for the crane: lift off and set down nearer the middle')
      : why === 'over' ? 'Rolled over too far to land: roll it level'
      // (in another ship's hangar, flying by hand: whose it is, and that the seat only lets them out in their own)
      : there && pilot && !auto ? (home ? `This is the ${there.name}'s hangar: fly out and set down in your own` : `This is the ${there.name}'s hangar: fly out through its bay door`)
      : !pilot ? `${opts.flier || 'The crew\'s pilot'} is flying` : auto ? (goal === 'land' || (goal === 'free' && everClear) ? 'Autopilot: in through the bay door, down on the pad' : 'Autopilot: out of the hangar, clear of the station')
      : S.landed ? 'At the controls' : goal === 'land' ? 'Fly in through the bay door and set down in your hangar' : canJump ? 'Clear of the station' : outThere ? 'Fly clear of the station' : 'Fly out through the bay door');
  }

  // ── the cameras ──
  const _eye = new THREE.Vector3(), _look = new THREE.Vector3(), _up = new THREE.Vector3(), _arm = new THREE.Vector3(), _e = new THREE.Euler(), camLook = new THREE.Vector3(), camPos = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0), _want = new THREE.Vector3();
  let fresh = true;
  // V GLIDES (the game's maker, 2026-11-19: "I think the player should be able to press v to go between inside and
  // outside. A quick glide is fine"): from where the eye was, the ship's own frame, to the other view, over VIEW.glide
  const glide = { t: 1, p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 60 }, _gq = new THREE.Quaternion(), _gi = new THREE.Matrix4();
  let glideNext = false;
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), _pos = new THREE.Vector3(), _upv = new THREE.Vector3(), _tgt = new THREE.Vector3(), _inv = new THREE.Matrix4(), nowW = new THREE.Matrix4();
  // (the ship's kit frame in the world: at the station `now` itself)
  const world = () => (body ? nowW.multiplyMatrices(body.at, now) : now);
  function aim(camera, dt = 1 / 60) {
    if (closed || !on) return false;
    // (the view changed: the glide sets off from where the eye is now, kept in the ship's own frame as it moves)
    if (glideNext) { glideNext = false; _gi.copy(world()).invert(); glide.p.copy(camera.position).applyMatrix4(_gi); glide.q.setFromRotationMatrix(_gi).multiply(camera.quaternion); glide.fov = camera.fov; glide.t = 0; }
    const tall = innerHeight > innerWidth * 1.05 || innerWidth <= 640;
    dash.place(tall);
    _up.set(0, 1, 0).transformDirection(now);
    let fov, near;
    if (view === 'cockpit') {
      const st = cfg.seat, lk = tall ? (panelUp ? st.lookTallPanel : st.lookTall) : panelUp ? st.lookPanel : st.look;
      _eye.set(pilot ? st.eye[0] : -st.eye[0], st.eye[1], st.eye[2]); _look.set(...lk);
      // (the look eases in the ship's own frame, so a turning ship does not leave it behind)
      if (fresh) camLook.copy(_look); else camLook.lerp(_look, 1 - Math.exp(-3 * dt));
      _pos.copy(_eye).applyMatrix4(now); _upv.copy(_up); _tgt.copy(camLook).applyMatrix4(now);
      fov = tall ? st.fovTall : st.fov; near = VIEW.near.cockpit;
    } else {
      const bh = cfg.behind;
      // (let go, the look round the ship swings back behind it)
      if (!looking()) { const k = Math.exp(-VIEW.orbit.back * dt); orbit.yaw *= k; orbit.pitch *= k; if (Math.abs(orbit.yaw) > Math.PI) orbit.yaw -= Math.sign(orbit.yaw) * 2 * Math.PI; }
      _look.set(...bh.look).applyMatrix4(now);
      const a = [_look.x, _look.y, _look.z], solid = job.finish();
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
      _pos.copy(_look).lerp(camPos, t); _upv.copy(camUp); _tgt.copy(_look);
      fov = tall ? bh.fovTall : bh.fov; near = VIEW.near.behind;
    }
    // (at the rocks all of this was worked out in the field's own frame: into the world's)
    if (body) { _pos.applyMatrix4(body.at); _tgt.applyMatrix4(body.at); _upv.transformDirection(body.at); }
    camera.position.copy(_pos); camera.up.copy(_upv); camera.lookAt(_tgt);
    fresh = false;
    if (glide.t < VIEW.glide) {
      glide.t += dt; const k = Math.min(1, glide.t / VIEW.glide), e = k * k * (3 - 2 * k), W2 = world();
      _gq.setFromRotationMatrix(W2).multiply(glide.q);
      camera.position.lerpVectors(_eye.copy(glide.p).applyMatrix4(W2), camera.position, e); camera.quaternion.slerpQuaternions(_gq, camera.quaternion.clone(), e);
      fov = glide.fov + (fov - glide.fov) * e; near = Math.min(VIEW.near.cockpit, near);
    }
    if (camera.fov !== fov || camera.near !== near || camera.far !== VIEW.far) { camera.fov = fov; camera.near = near; camera.far = VIEW.far; camera.updateProjectionMatrix(); }
    // (the dashboard, and the tiny ship beside the ship from behind, once the eye is there)
    if (ownDash) { _w.setFromMatrixPosition(world()); stepDash(D, { p: [_w.x, _w.y, _w.z], dt, flying: !S.landed }); }
    dashClock += dt; dashTick();
    placeFloat(camera, view === 'behind' && glide.t >= VIEW.glide && powered() && !el.hidden);
    // (seen from the seat, the Jump button and the seat's prompt stand just above the display, not over it)
    { const r = view === 'cockpit' && glide.t >= VIEW.glide && !el.hidden ? dash.onScreen(camera) : null, up = r ? Math.round(innerHeight - r.top + 10) : 0;
      if (up !== dashUp) { dashUp = up; el.classList.toggle('is-dash', !!r); if (r) el.style.setProperty('--dash-up', up + 'px'); } }
    return true;
  }
  // ── THE DASHBOARD: its numbers, stepped once a frame in aim (the flying's own in the labs, from the ship's own moves; a
  // run's are the trip's, src/trip.js); its words and its tiny ship's picture while it can be seen from the seat, once
  // for each picture (from update, or from aim when the ship is only watched) ──
  const ownDash = !opts.dash, D = opts.dash || makeDash(), _w = new THREE.Vector3();
  // (dashClock: the game's own time, for how often the words are drawn again; the picture of the tiny ship is drawn once
  // for each picture of the game's)
  let ticked = -1, dashClock = 0, dashUp = -1;
  function dashTick() {
    const on = powered();
    dash.draw(dashRows(D, opts.run ? opts.run() : null), on, guideOn ? GUIDE_WORDS : '', dashClock);
    if (W.renderer.info.render.frame === ticked || !on || !(view === 'cockpit' || glide.t < VIEW.glide)) return;
    holo.toTarget(W.renderer, dash.rt, dash.aspect);
    ticked = W.renderer.info.render.frame;
  }
  const dustWas = W.dust ? W.dust.visible : false;
  function restoreCamera() {
    if (body) return;      // (at the rocks the drill's view keeps the camera: src/drillview.js)
    const c = W.camera; c.up.set(0, 1, 0);
    if (c.near !== 0.03 || c.far !== (W.sees || 120)) { c.near = 0.03; c.far = W.sees || 120; c.updateProjectionMatrix(); }
    if (W.dust) W.dust.visible = dustWas;
  }
  if (outside) outside.flying = cfg.room;

  const api = {
    S, cfg, get solid() { return job.finish(); },
    get on() { return on && !closed; }, get auto() { return auto; }, get mouse() { return mouse; }, get offered() { return offered; }, get goal() { return goal; }, set goal(g) { goal = g; painted = ''; },
    set panel(v) { panelUp = !!v; },
    update(dt) {
      if (closed || !on) return;
      let C = M.noControls();
      if (!locked) {
        if (auto) {
          if (body) C = M.noControls();      // (at the rocks, riding: the ship holds where it is)
          else if (startIn > 0) startIn -= dt;
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
      S.padBusy = !!(hull && hull.padBusy && hull.padBusy());
      // (what it bumps into: a little of that work each frame on the pad, all that is left of it the moment it is off)
      M.stepShip(S, C, dt, S.landed ? job.run(S.power ? 12 : 6) : job.finish());
      if (was && !S.landed) { if (liftMouse && pilot && !auto && canLock) { liftLock = 1.5; capture(true); } liftMouse = false; painted = ''; }
      if (liftLock > 0) liftLock -= dt;
      if (!was && S.landed) { stood(); eArmed = !held.has('rollRight'); setMouse('pointer'); auto = !pilot; plan = null; painted = ''; pose(dt); if (opts.onLanded) opts.onLanded(); if (closed || !on) return; }
      // IN ANOTHER SHIP'S HANGAR, or not (the alarm there is src/visit.js); and what the ship itself says: its welcome
      // as its power first comes on this sitting, "Safety violation" over and over while it is in there. (A clip asked
      // for before the page may make a sound is tried again for a moment, then let go.)
      there = M.visiting(S);
      const clip = M.voiceStep(voice, S, dt, there, secs);
      if (clip && clips[clip]) saying = { what: clip, t: clip === 'welcome' ? 1.5 : 0.4 };
      if (saying) { const h = sound.play(clips[saying.what].id, { volume: 0.95 }); if (h) { heard[saying.what]++; saying = null; } else if ((saying.t -= dt) <= 0) saying = null; }
      // (coming down low over a hangar's floor, its own or another's: anyone under it hurries out of its way, as from
      // the crane's load)
      underT -= dt;
      if (underT <= 0 && !S.landed && S.v[1] < 0.3 && M.floorBelow(S) != null && S.p[1] - cfg.pad[1] < UNDER.low) { underT = UNDER.every; const pp = people(); if (pp && pp.flee) pp.flee(S.p[0], S.p[2], 12, UNDER.away, { inside: under }); }
      const clear = !body && !S.landed && M.clearOf(S.p, offered);
      if (clear !== offered) { offered = clear; painted = ''; if (clear && !everClear) { everClear = true; if (opts.onClear) opts.onClear(); if (closed || !on) return; } }
      pose(dt);
      paint(); guide(); if (aside) dashClock += dt; dashTick();
    },
    aim,
    // just before the picture: no haze once the camera is out of the bay (after the boarding's light has had its say),
    // and none of the rooms' drifting dust out there
    late() {
      if (closed || !on || body) return;
      const out = !!(outside && outside.out), k = out ? 1 : Math.max(0, Math.min(1, (W.camera.position.x - (DOOR.face - 6)) / 22));
      if (W.scene.fog && k > 0) { W.scene.fog.near += k * k * 1e4; W.scene.fog.far += k * k * 2e4; }
      if (W.dust) W.dust.visible = dustWas && !out;
    },
    lock(v) { locked = !!v; letGo(); if (locked) { setMouse('pointer'); card.hidden = true; } painted = ''; paint(); },
    // (the crew member on their feet aboard: the top of this function, `aside`)
    // (at the rocks the cabin walked is the hangar's own Miner, drawn in the drill's Miner's place, its dashboard lower
    // than that ship's: this flying's display is put away meanwhile, so it does not hang over the cabin's dashboard)
    aside(v) { if (closed || aside === !!v) return; aside = !!v; if (body) dash.group.visible = !aside; letGo(); setMouse('pointer'); card.hidden = true; painted = ''; if (on) paint(); else el.hidden = true; },
    // put away altogether for a while, the ship left where it is (at the rocks, while the drill's view has the eye), and back
    pause(v) { if (closed) return; on = !v; if (ownDash) D.last = null; letGo(); setMouse('pointer'); card.hidden = true; fresh = true; orbit.yaw = orbit.pitch = 0; painted = ''; if (on) { pose(1 / 60); paint(); } else el.hidden = true; },
    // where the eye is now, in the ship's own kit frame (a glide out of this view starts there)
    eye(camera) {
      _inv.copy(world()).invert();
      const e = camera.position.clone().applyMatrix4(_inv), l = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(30).add(camera.position).applyMatrix4(_inv);
      return { eye: e.toArray(), look: l.toArray(), fov: camera.fov };
    },
    // the view from behind taken up from wherever the eye is now: it eases to its own place from there
    eyeFrom(camera) { view = 'behind'; orbit.yaw = orbit.pitch = 0; camPos.copy(camera.position); if (body) camPos.applyMatrix4(_inv.copy(body.at).invert()); camUp.set(0, 1, 0); fresh = false; painted = ''; },
    get matrix() { return world(); }, get locked() { return locked; }, get view() { return view; }, set view(v) { const w = v === 'behind' ? 'behind' : 'cockpit'; if (w !== view) { view = w; fresh = true; orbit.yaw = orbit.pitch = 0; painted = ''; } },
    // the ship has jumped: parked again where the station's rooms have it, nothing of the flying drawn or heard
    away() {
      if (closed) return;
      M.park(S, standNow()); S.power = true; auto = !pilot; plan = null; offered = false; letGo(); setMouse('pointer');
      hull.fly(null); boarding.fly(cfg.id, null); parked = true; now.copy(B.M); rig.matrix.copy(now); rig.visible = false;
      on = false; el.hidden = true; holo.show(false); if (outside) outside.flying = null; restoreCamera();
    },
    // out of the jump home: outside the station, in sight of it
    arrive() {
      if (closed) return;
      const A = M.arrival(cfg); M.place(S, A.p, A.q); S.engine = 0.15; letGo(); if (ownDash) D.last = null;
      goal = 'land'; offered = false; auto = !pilot; plan = null; startIn = pilot ? 0 : 0.8; on = true; locked = false; fresh = true; rig.visible = true; el.hidden = false; painted = '';
      if (outside) outside.flying = cfg.room;
      pose(1 / 60); paint();
    },
    // (the lab: back on its pad with the power off, as when first sat down in; wherever it had been left standing)
    reset() {
      if (closed) return;
      M.park(S); stood(); S.power = false; S.engine = 0; auto = !pilot; plan = null; offered = false; everClear = false; letGo(); setMouse('pointer');
      voice.welcomed = false; voice.busy = 0; saying = null;      // (as newly sat down: its welcome again when the power comes on)
      if (ownDash) resetDash(D);      // (and its tank full again, nothing flown)
      on = true; locked = false; fresh = true; rig.visible = true; el.hidden = false; if (outside) outside.flying = cfg.room;
      pose(1 / 60); painted = ''; paint();
    },
    // A PART OF THE FLYING SKIPPED by a crew member who takes no part in it (src/trip.js: its skip button, while the
    // crew's own pilot flies). Coming home: down on its pad at once, as it is parked. Leaving: clear of the station at
    // once, out from its own bay door (where the jump home comes out), nose away from it.
    skip() {
      if (closed || !on || body) return false;
      if (goal === 'land') {
        if (S.landed) return false;
        M.park(S); stood(); eArmed = !held.has('rollRight'); setMouse('pointer'); auto = !pilot; plan = null; fresh = true; painted = ''; pose(1 / 60); paint();
        if (opts.onLanded) opts.onLanded();
        return true;
      }
      const A = M.arrival(cfg); M.place(S, A.p, M.facing([1, 0, 0])); plan = null; fresh = true; painted = ''; pose(1 / 60);
      return true;
    },
    // (the rigs, and the lab: the ship put somewhere at once)
    put(p, q = null) { M.place(S, p, q || M.facing([1, 0, 0])); fresh = true; pose(1 / 60); painted = ''; },
    press, hold(a, v = true) { if (v) held.add(a); else held.delete(a); }, stick(k, x, y) { sticks[k].x = x; sticks[k].y = y; }, setTouch,
    pointer(x, y) { mx = x; my = y; },
    getUp: () => press('getup'), get hints() { return hints; }, holo,
    // (the ship's place as a matrix, from where it is parked: for the rigs' own pictures)
    state: () => ({ on, view, auto, mouse, captured, canLock, locked, aside, offered, everClear, goal, pilot, touch, mode: modeNow(), power: S.power, landed: S.landed, settling: !!S.settle, p: S.p.map((v) => +v.toFixed(2)), q: S.q.map((v) => +v.toFixed(3)), speed: +M.speedOf(S).toFixed(2), bump: +S.bump.toFixed(3), legs: plan ? plan.length : 0, invertY: set.invertY,
      visiting: there ? there.id : null, said: { ...voice.said }, heard: { ...heard },
      standing: M.standing(S), stands: !!(B && B.moved), field: !!body, task: !!(opts.task && pilot && on && !locked), canGetUp: M.canGetUp(S), why: M.whyNot(S), tilt: +M.tiltOf(S).toFixed(1), touching: !!S.on, seat: seatUp, guide: guideOn, keys: keysOn, yaw: +(Math.atan2(-M.turn(S.q, [1, 0, 0])[2], M.turn(S.q, [1, 0, 0])[0]) * 180 / Math.PI).toFixed(1),
      lit: hints ? Object.fromEntries(Object.entries(hints.keys).filter(([, v]) => v > 0).map(([k, v]) => [k, +v.toFixed(2)])) : null, arrows: hints ? Object.fromEntries(Object.entries(hints.mouse).filter(([, v]) => v > 0).map(([k, v]) => [k, +v.toFixed(2)])) : null,
      help: [...el.querySelectorAll('.pfl-help li')].map((li) => li.textContent.trim()), helpShut: helpEl.classList.contains('is-shut'), buttons: $$('.pfl-btns .pfl-b, .pfl-jump').filter((b) => !b.hidden).map((b) => [...b.childNodes].filter((n) => !n.hidden).map((n) => n.textContent).join('').trim().replace(/\s+/g, ' ')), sticks: !$('.pfl-stick').hidden, clearOf: body ? 0 : +M.boxDist(S.p).toFixed(1),
      dash: { on: powered(), words: dash.words, caption: guideOn ? GUIDE_WORDS : '', fuel: +D.fuel.toFixed(4), dist: +D.dist.toFixed(2), secs: +D.secs.toFixed(2), speed: +D.speed.toFixed(2), own: ownDash, float: floatAt } }),
    close() {
      if (closed) return; closed = true;
      removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
      removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp); canvas.removeEventListener('contextmenu', onMenu);
      document.removeEventListener('pointerlockchange', onLock); capture(false);
      if (!body) { hull.fly(null); boarding.fly(cfg.id, null); }
      W.scene.remove(rig); dash.dispose(); holo.dispose(); el.remove(); if (outside) outside.flying = null; restoreCamera();
      if (visit) visit.fly(null);
    },
  };
  paint(); guide(); dashTick();
  // (whoever keeps the other hangars is told there is a ship flying: the alarm in them is theirs, src/visit.js)
  if (visit) visit.fly(api);
  return api;
}
