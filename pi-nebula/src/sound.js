// THE GAME'S SOUND: one small player for every sound the game makes (the station's voices are the first; more to come).
// Browsers let a page make sound only once the player has touched it (a tap, a click, a key), so nothing plays, and
// nothing is even set up, before that; a sound asked for before then is simply not heard.
//
//   import { sound } from './sound.js'
//   sound.load(name, url)            fetch a sound once (it is made ready to play once the player has touched the page)
//   sound.play(name, { at, volume, rate, group, near, far, delay })   -> { stop(), volume(v) } | null (not loaded, muted,
//               or not yet allowed); delay: seconds from now it starts (sounds joined end to end start on time);
//               volume(v): its own volume changed while it plays (eased over a tenth of a second)
//       at      a point in the world ({ x, y, z }): the sound comes from there, softer with distance (full within
//               `near` metres, 1.5 unless given; quieter on out to `far`, 28); left out: plain, from everywhere
//       volume  0..1 (1 unless given); rate: played quicker and higher (over 1) or slower and lower (under 1)
//       group   the sounds' own volume group ('voices' unless given; groups.<name>.gain sets one group's level)
//   sound.alarm({ at, volume, near, far, group, notes, beat })   -> { stop() } | null (as play). A sound made here, with
//       no file: an alarm of two notes, turn and turn about (`notes` in Hz, `beat` seconds each), until it is stopped.
//       The game's maker (2026-11-18, of the Miner flown into another ship's hangar): "you would hear an alarm".
//   sound.ears(camera)               each frame: where the ears are (the camera, its way and its up)
//   sound.volume, sound.muted        as saved in this browser (0..1, 0.8 at first; not muted); setVolume(v), setMuted(m)
//   sound.has(name), sound.length(name)   a sound fetched and made ready to play; how long it lasts (s; 0 if not)
//   sound.ready                      true once the player has touched the page and sound can play
//   sound.played                     how many sounds have played (the rigs read it)
// The volume and the mute are kept in this browser (localStorage 'calc-station.sound'); ui/soundbutton.js is the HUD's
// switch for them.
const KEY = 'calc-station.sound';
const GROUPS = { voices: 0.9, effects: 1, music: 0.6, station: 0.9 };   // (station: the station's announcements, src/announce.js)

function makeSound() {
  let ctx = null, master = null;
  const bytes = new Map(), bufs = new Map(), groups = {};
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { /* blocked: the defaults */ }
  const S = {
    volume: Number.isFinite(+saved.volume) ? Math.max(0, Math.min(1, +saved.volume)) : 0.8,
    muted: !!saved.muted, ready: false, played: 0, groups,
  };
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify({ volume: S.volume, muted: S.muted })); } catch (e) { /* blocked: not kept */ } };
  const level = () => (S.muted ? 0 : S.volume * S.volume);   // (heard as louder in even steps)
  function decode(name) {
    const b = bytes.get(name); if (!ctx || !b || bufs.has(name)) return;
    // (a copy: decoding takes the bytes over; the callback form, for older Safari)
    bufs.set(name, null);
    try { ctx.decodeAudioData(b.slice(0), (buf) => bufs.set(name, buf), () => bufs.delete(name)); } catch (e) { bufs.delete(name); }
  }
  // (the first touch of the page: the player for every sound made, and everything fetched so far made ready)
  function wake() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = level(); master.connect(ctx.destination);
    for (const [g, v] of Object.entries(GROUPS)) { const n = groups[g] = ctx.createGain(); n.gain.value = v; n.connect(master); }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    S.ready = true;
    for (const name of bytes.keys()) decode(name);
  }
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, wake, { capture: true, passive: true });

  S.load = (name, url) => {
    if (bytes.has(name)) return Promise.resolve();
    bytes.set(name, null);
    return fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => { if (!b) { bytes.delete(name); return; } bytes.set(name, b); decode(name); }).catch(() => { bytes.delete(name); });
  };
  S.has = (name) => !!bufs.get(name);
  S.length = (name) => { const b = bufs.get(name); return b ? b.duration : 0; };
  S.play = (name, { at = null, volume = 1, rate = 1, group = 'voices', near = 1.5, far = 28, delay = 0 } = {}) => {
    if (!ctx || ctx.state !== 'running' || !level()) return null;
    const buf = bufs.get(name); if (!buf) { decode(name); return null; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = Math.max(0, volume);
    src.connect(g);
    placed(g, at, near, far).connect(groups[group] || groups.voices);
    src.start(delay > 0 ? ctx.currentTime + delay : 0);
    S.played++;
    return { stop() { try { src.stop(); } catch (e) { /* done already */ } }, volume(v) { g.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, 0.04); } };
  };
  // (a sound's last node, set at a point in the world if it has one: softer with distance)
  function placed(node, at, near, far) {
    if (!at) return node;
    const p = ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = near; p.maxDistance = far; p.rolloffFactor = 1.3;
    if (p.positionX) { p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z; } else p.setPosition(at.x, at.y, at.z);
    node.connect(p); return p;
  }
  // AN ALARM, MADE HERE (no sound file): two notes, turn and turn about, for as long as it is wanted. The game's maker
  // (2026-11-18, of the Miner flown into another ship's hangar): "you would hear an alarm".
  S.alarm = ({ at = null, volume = 0.5, group = 'effects', near = 10, far = 140, notes = [640, 480], beat = 0.42 } = {}) => {
    if (!ctx || ctx.state !== 'running' || !level()) return null;
    const t = ctx.currentTime, osc = ctx.createOscillator(), turn = ctx.createOscillator(), depth = ctx.createGain(), soft = ctx.createBiquadFilter(), g = ctx.createGain();
    // (one voice whose pitch a slow square wave moves between the two notes; softened, so it is a horn and not a buzz)
    osc.type = 'sawtooth'; osc.frequency.value = (notes[0] + notes[1]) / 2;
    turn.type = 'square'; turn.frequency.value = 1 / (2 * beat); depth.gain.value = (notes[0] - notes[1]) / 2;
    turn.connect(depth); depth.connect(osc.frequency);
    soft.type = 'lowpass'; soft.frequency.value = 1400; soft.Q.value = 0.6;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(Math.max(0, volume) * 0.3, t + 0.1);
    osc.connect(soft); soft.connect(g);
    placed(g, at, near, far).connect(groups[group] || groups.effects);
    osc.start(); turn.start();
    S.played++;
    let over = false;
    return { stop() { if (over) return; over = true; const e = ctx.currentTime; try { g.gain.cancelScheduledValues(e); g.gain.setValueAtTime(g.gain.value, e); g.gain.linearRampToValueAtTime(0, e + 0.15); osc.stop(e + 0.2); turn.stop(e + 0.2); } catch (x) { /* done already */ } } };
  };
  // where the ears are: the camera's place, the way it looks and its up
  const e = new Array(16);
  S.ears = (camera) => {
    if (!ctx) return;
    const L = ctx.listener, m = camera.matrixWorld.elements;
    for (let i = 0; i < 16; i++) e[i] = m[i];
    const px = e[12], py = e[13], pz = e[14], fx = -e[8], fy = -e[9], fz = -e[10], ux = e[4], uy = e[5], uz = e[6];
    if (L.positionX) {
      L.positionX.value = px; L.positionY.value = py; L.positionZ.value = pz;
      L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz; L.upX.value = ux; L.upY.value = uy; L.upZ.value = uz;
    } else { L.setPosition(px, py, pz); L.setOrientation(fx, fy, fz, ux, uy, uz); }
  };
  const setLevel = () => { if (master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.05); };
  S.setVolume = (v) => { S.volume = Math.max(0, Math.min(1, +v || 0)); if (S.volume > 0) S.muted = false; setLevel(); keep(); };
  S.setMuted = (m) => { S.muted = !!m; setLevel(); keep(); };
  return S;
}

export const sound = makeSound();
