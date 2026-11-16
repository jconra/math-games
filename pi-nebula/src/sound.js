// THE GAME'S SOUND: one small player for every sound the game makes (the station's voices are the first; more to come).
// Browsers let a page make sound only once the player has touched it (a tap, a click, a key), so nothing plays, and
// nothing is even set up, before that; a sound asked for before then is simply not heard.
//
//   import { sound } from './sound.js'
//   sound.load(name, url)            fetch a sound once (it is made ready to play once the player has touched the page)
//   sound.play(name, { at, volume, rate, group, near, far })   -> { stop() } | null (not loaded, muted, or not yet allowed)
//       at      a point in the world ({ x, y, z }): the sound comes from there, softer with distance (full within
//               `near` metres, 1.5 unless given; quieter on out to `far`, 28); left out: plain, from everywhere
//       volume  0..1 (1 unless given); rate: played quicker and higher (over 1) or slower and lower (under 1)
//       group   the sounds' own volume group ('voices' unless given; groups.<name>.gain sets one group's level)
//   sound.ears(camera)               each frame: where the ears are (the camera, its way and its up)
//   sound.volume, sound.muted        as saved in this browser (0..1, 0.8 at first; not muted); setVolume(v), setMuted(m)
//   sound.ready                      true once the player has touched the page and sound can play
//   sound.played                     how many sounds have played (the rigs read it)
// The volume and the mute are kept in this browser (localStorage 'calc-station.sound'); ui/soundbutton.js is the HUD's
// switch for them.
const KEY = 'calc-station.sound';
const GROUPS = { voices: 0.9, effects: 1, music: 0.6 };

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
  S.play = (name, { at = null, volume = 1, rate = 1, group = 'voices', near = 1.5, far = 28 } = {}) => {
    if (!ctx || ctx.state !== 'running' || !level()) return null;
    const buf = bufs.get(name); if (!buf) { decode(name); return null; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = Math.max(0, volume);
    src.connect(g);
    let out = g;
    if (at) {
      const p = ctx.createPanner();
      p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = near; p.maxDistance = far; p.rolloffFactor = 1.3;
      if (p.positionX) { p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z; } else p.setPosition(at.x, at.y, at.z);
      g.connect(p); out = p;
    }
    out.connect(groups[group] || groups.voices);
    src.start();
    S.played++;
    return { stop() { try { src.stop(); } catch (e) { /* done already */ } } };
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
