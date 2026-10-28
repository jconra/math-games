// HOWDY: a little speech bubble over somebody's head when the player comes close: a townsperson walking about, a wagon
// driver, a rider passing on the road. One short line ("Howdy!", "Mornin'!", "Fine horse!"), up for a couple of seconds
// and following the speaker, then fading. Nothing to click: it is just the town being friendly.
//
//   howdyCamera(camera)        once, when the game starts: the camera the bubbles are placed with (until it is given,
//                              howdy() does nothing and returns null)
//   howdy(who, text, opts) -> handle | null
//     who    whoever says it: a folk person (src/actors/folk.js: its Head bone), a record holding one (.p or .person),
//            any THREE.Object3D (its place, `lift` metres up), or { at: () => ({ x, y, z }) } (the point over the head)
//     text   the words; null or '' picks a hello for the time of day (opts.hour, else the world's W.hour, else daytime)
//     opts   { ms (how long it stays up), lift (m over the head bone, or over an Object3D's origin), key (one bubble per
//            key at a time: a new one for the same key takes its place; default: the speaker), riding (the player is on a
//            horse: now and then "Fine horse!"), hour (0..24), night (0..1) }
//     handle { close(), open (true while up) }
//   makeHowdyWatch({ near, away, again }) -> G   when to say it, one per speaker: G.update(dt, d) -> true when it is time
//                              (d: metres from the player). Said once the player comes within `near`; again only after
//                              they have been further than `away` and `again` seconds have passed
//   pickHello({ hour, night, riding, rand }) -> text   the hello for the time of day (pure: the tests use it)
//   hideHowdies(on)            hides every bubble (a panel or the cabin is up) and holds new ones back; false: shown again
//   howdyState()               for rigs: the bubbles up now: [{ text, key, x, y, shown }]
//   HOWDY, HELLOS              the dials and the words
//
// The bubbles place themselves each frame while any is up (their own requestAnimationFrame), so a caller only says
// when. At most HOWDY.most are up at once (the oldest goes); a bubble whose speaker is behind the camera or off the
// screen is hidden until it comes back in view.

export const HOWDY = {
  near: 5.5,       // m: a person says hello when the player comes this close
  away: 14,        // m: ... and again only after the player has been further off than this
  again: 75,       // s: ... and this long has passed since the last one
  ms: 2600,        // how long a bubble stays up (ms), fading for its last 400
  lift: 0.62,      // m over the head bone (over the hat)
  objLift: 2.3,    // m over an Object3D's own place (when it has no head bone)
  most: 3,         // bubbles up at once
  horse: 0.25,     // the chance of a remark about the horse when the player rides up
};

// the words: plain and friendly, for children (no slang a young reader can't sound out, beyond the West's own)
export const HELLOS = {
  any: ['Howdy!', 'Howdy, partner!', 'Hello there!', 'Nice day for it.', 'Good to see you!', 'Hey there!'],
  morning: ["Mornin'!", 'Good morning!', 'Up early, partner?'],
  evening: ["Evenin'!", 'Good evening!', 'Getting dark out.'],
  night: ["Evenin', partner.", 'Late to be out!', 'Lovely moon tonight.'],
  riding: ['Fine horse!', 'Nice saddle!', 'Easy on that horse now!'],
};

// the hello for the time of day: mornings (5 to 11) and evenings (after 18) have their own now and then; at night
// (night over a half) the night's
export function pickHello({ hour = null, night = 0, riding = false, rand = Math.random } = {}) {
  const one = (a) => a[Math.floor(rand() * a.length) % a.length];
  if (riding && rand() < HOWDY.horse) return one(HELLOS.riding);
  if (night > 0.5) return one(HELLOS.night);
  if (Number.isFinite(hour)) {
    if (hour >= 5 && hour < 11 && rand() < 0.5) return one(HELLOS.morning);
    if ((hour >= 18 || hour < 5) && rand() < 0.5) return one(HELLOS.evening);
  }
  return one(HELLOS.any);
}

// when a speaker says hello (pure: a clock and the player's distance)
export function makeHowdyWatch({ near = HOWDY.near, away = HOWDY.away, again = HOWDY.again } = {}) {
  let since = 1e9, left = true;
  return {
    update(dt, d) {
      since += dt;
      if (d > away) left = true;
      if (d < near && left && since >= again) { since = 0; left = false; return true; }
      if (d < near) left = false;
      return false;
    },
    reset() { since = 1e9; left = true; },
  };
}

let cam = null, box = null, raf = 0, hidden = false;
const up = [];   // { el, key, who, lift, t0, ms, shown }
let V3 = null;   // (a THREE.Vector3, borrowed from the camera's own class: no three.js import, so the tests can load this)
export function howdyCamera(camera) { cam = camera || null; if (cam && !V3) V3 = new cam.position.constructor(); }
export const howdyCam = () => cam;   // (the game's camera, for anything that must know what is in sight: src/townlife.js)
export function hideHowdies(on) {
  hidden = !!on;
  for (const b of up) b.el.hidden = hidden || !b.shown;
}

// the point over the speaker's head, in the world (false: nothing to place it by)
function headOf(who, lift, out) {
  if (!who) return false;
  if (typeof who.at === 'function') { const p = who.at(); if (!p) return false; out.set(p.x, p.y, p.z); return true; }
  const person = who.bones ? who : who.p && who.p.bones ? who.p : who.person && who.person.bones ? who.person : null;
  if (person && person.bones.Head) {
    const root = person.root;
    if (root && !visibleUp(root)) return false;
    person.bones.Head.getWorldPosition(out); out.y += lift ?? HOWDY.lift; return true;
  }
  const obj = who.isObject3D ? who : person && person.root && person.root.isObject3D ? person.root : who.root && who.root.isObject3D ? who.root : null;
  if (obj) { if (!visibleUp(obj)) return false; obj.getWorldPosition(out); out.y += lift ?? HOWDY.objLift; return true; }
  return false;
}
// (a speaker that is hidden, or in something hidden, says nothing)
function visibleUp(o) { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; }

export function howdy(who, text = null, opts = {}) {
  if (!cam || !who) return null;
  ensureCss();
  if (!box) { box = document.createElement('div'); box.className = 'bhw'; document.body.appendChild(box); }
  const key = opts.key ?? who;
  // the same speaker again: the old bubble goes
  for (let i = up.length - 1; i >= 0; i--) if (up[i].key === key) drop(i);
  while (up.length >= HOWDY.most) drop(0);
  const words = text || pickHello({ hour: opts.hour ?? worldHour(), night: opts.night ?? worldNight(), riding: !!opts.riding });
  const el = document.createElement('div'); el.className = 'bhw-say'; el.textContent = words; el.hidden = true;
  box.appendChild(el);
  const b = { el, key, who, lift: opts.lift, t0: performance.now(), ms: opts.ms || HOWDY.ms, shown: false, text: words };
  up.push(b);
  place(b);
  if (!raf) raf = requestAnimationFrame(tick);
  const handle = { close: () => { const i = up.indexOf(b); if (i >= 0) drop(i); }, get open() { return up.includes(b); } };
  return handle;
}
// the world's clock, if the game has one (src/world.js W.hour / W.night, lane of the day and night)
function worldHour() { try { const W = globalThis.BM && globalThis.BM.world; return W && Number.isFinite(W.hour) ? W.hour : null; } catch (e) { return null; } }
function worldNight() { try { const W = globalThis.BM && globalThis.BM.world; return W && Number.isFinite(W.night) ? W.night : 0; } catch (e) { return 0; } }

function drop(i) { const b = up[i]; up.splice(i, 1); b.el.remove(); }
function place(b) {
  if (!V3 || !headOf(b.who, b.lift, V3)) { b.shown = false; b.el.hidden = true; return; }
  const sx = innerWidth, sy = innerHeight;
  V3.project(cam);
  const on = V3.z < 1 && Math.abs(V3.x) < 1.02 && Math.abs(V3.y) < 1.02;
  b.shown = on; b.el.hidden = hidden || !on;
  if (!on) return;
  const x = (V3.x + 1) / 2 * sx, y = (1 - V3.y) / 2 * sy;
  // (kept on the screen with a 10 px gutter; the tail points at the speaker)
  const w = b.el.offsetWidth || 80, h = b.el.offsetHeight || 30;
  const left = Math.max(10, Math.min(sx - w - 10, x - w / 2)), top = Math.max(10, y - h - 10);
  b.el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  b.el.style.setProperty('--tail', `${Math.max(12, Math.min(w - 12, x - left))}px`);
}
function tick() {
  raf = 0;
  const now = performance.now();
  for (let i = up.length - 1; i >= 0; i--) {
    const b = up[i], age = now - b.t0;
    if (age > b.ms) { drop(i); continue; }
    b.el.classList.toggle('is-out', age > b.ms - 400);
    place(b);
  }
  if (up.length) raf = requestAnimationFrame(tick);
}
export function howdyState() {
  return up.map((b) => ({ text: b.text, key: typeof b.key === 'string' ? b.key : null, shown: b.shown && !hidden, x: parseFloat((b.el.style.transform.match(/translate\(([-\d.]+)px/) || [])[1]) || null }));
}

let css = false;
function ensureCss() {
  if (css || typeof document === 'undefined') return; css = true;
  const s = document.createElement('style'); s.dataset.howdy = '1';
  s.textContent = `
.bhw { position: fixed; inset: 0; z-index: 12; pointer-events: none; }
.bhw-say { position: absolute; left: 0; top: 0; width: max-content; max-width: min(220px, calc(100vw - 20px)); padding: 5px 11px 6px;
  border-radius: 12px; background: #f6edd6; color: #2b2219; font: 600 15px/1.25 Bitter, Georgia, serif; white-space: nowrap;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.38), inset 0 0 0 2px rgba(122, 85, 48, 0.28); opacity: 1; transition: opacity 0.4s ease;
  animation: bhw-in 0.25s ease-out; --tail: 50%; }
.bhw-say::after { content: ''; position: absolute; left: var(--tail); bottom: -7px; margin-left: -7px; border: 7px solid transparent; border-bottom: 0; border-top-color: #f6edd6; }
.bhw-say.is-out { opacity: 0; }
@keyframes bhw-in { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 600px) { .bhw-say { font-size: 14px; padding: 4px 9px 5px; } }
`;
  document.head.appendChild(s);
}
