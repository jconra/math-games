// THE GAME'S SOUND: one AudioContext for the whole game, made on the player's first click or key press (browsers keep
// sound asleep until a page is touched), a master volume the player sets in the menu (kept in a small settings key, not
// with a rider: it belongs to the computer, not the person), and the camera as the ears.
//
// Two kinds of switch keep it quiet and cheap:
//   hold(why, on)   the whole game's sound faded out while any hold is on: 'title' (on the title screen), 'pause' (a
//                   panel over the game: the menu, a counter, a lock box), 'hidden' (the tab is in the background; set
//                   here). The sound fades in about a tenth of a second, so nothing clicks.
//   need(who, on)   someone has sound to make (the stage band while the player is near the town). With nobody needing
//                   it, or with a hold on, the context is put to sleep (suspended): no sound work at all on the trail.
//
//   const A = makeAudio()
//   A.ctx            the AudioContext, or null until the first click or key press
//   A.out            where everything that makes sound connects (null until then; see A.ready(fn))
//   A.ready(fn)      fn(ctx, out) once the context exists (at once if it does)
//   A.volume / A.setVolume(v)   0..1, saved
//   A.listen(camera) each frame: the ears go where the camera is, facing where it looks
//   A.running        true while the context is awake and nothing holds it quiet
//   volumeRow(A)     a "Volume" slider row for a panel (the pause menu)
export const SOUND = {
  volume: 0.8,          // the first volume, before the player has set one
  fade: 0.035,          // the time constant (s) of the fade when the game is held quiet or let go (about 0.1 s to quiet)
  sleepAfter: 0.4,      // s after going quiet before the context is put to sleep
};
const KEY = 'bandit-math.settings';

function loadSettings() { try { const s = JSON.parse(globalThis.localStorage.getItem(KEY) || '{}'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; } }
function saveSettings(patch) { try { globalThis.localStorage.setItem(KEY, JSON.stringify({ ...loadSettings(), ...patch })); } catch (e) { /* storage blocked: the volume just isn't remembered */ } }

export function makeAudio() {
  const saved = +loadSettings().volume;
  const holds = new Set(), needs = new Set(), waiting = [];
  let ctx = null, master = null, sleepTimer = null;
  const A = {
    get ctx() { return ctx; }, get out() { return master; },
    volume: Number.isFinite(saved) ? Math.max(0, Math.min(1, saved)) : SOUND.volume,
    get running() { return !!ctx && ctx.state === 'running' && !holds.size; },
    holds, needs,
  };
  // the level the master should be at now
  const level = () => (holds.size ? 0 : A.volume * A.volume);   // (squared: the slider feels even from quiet to loud)
  function apply() {
    if (!ctx) return;
    const now = ctx.currentTime, g = master.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now); else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
    g.setTargetAtTime(level(), now, SOUND.fade);
    const awake = !holds.size && needs.size > 0;
    clearTimeout(sleepTimer); sleepTimer = null;
    if (awake) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); }
    else armSleep();
  }
  // put the context to sleep a moment after it goes quiet. A wake-up asked for just before (resume() takes a while) may
  // still finish after this, so the context also checks again whenever it actually wakes (see 'statechange' below).
  function armSleep() {
    clearTimeout(sleepTimer); sleepTimer = null;
    if (ctx.state === 'running' && (holds.size || !needs.size)) sleepTimer = setTimeout(() => { sleepTimer = null; if (holds.size || !needs.size) ctx.suspend().catch(() => {}); }, SOUND.sleepAfter * 1000);
  }
  function unlock() {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return;
      try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { return; }
      // the master volume, then a safety limiter (it only acts on a peak near full scale; the music sits well under it)
      master = ctx.createGain(); master.gain.value = 0;
      const limit = ctx.createDynamicsCompressor(); limit.threshold.value = -4; limit.knee.value = 2; limit.ratio.value = 12; limit.attack.value = 0.003; limit.release.value = 0.2;
      master.connect(limit).connect(ctx.destination);
      ctx.addEventListener('statechange', () => { if (ctx.state === 'running' && !sleepTimer) armSleep(); });
      for (const fn of waiting.splice(0)) { try { fn(ctx, master); } catch (e) { console.error('audio: a sound could not start', e); } }
    }
    apply();
  }
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });
  addEventListener('touchend', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => A.hold('hidden', document.hidden));

  A.ready = (fn) => { if (ctx) fn(ctx, master); else waiting.push(fn); };
  // (only a change does anything: the stage says what it needs every frame)
  A.hold = (why, on) => { if (!!on === holds.has(why)) return; if (on) holds.add(why); else holds.delete(why); apply(); };
  A.need = (who, on) => { if (!!on === needs.has(who)) return; if (on) needs.add(who); else needs.delete(who); apply(); };
  A.setVolume = (v) => { A.volume = Math.max(0, Math.min(1, +v || 0)); saveSettings({ volume: +A.volume.toFixed(3) }); apply(); };
  const fwd = { x: 0, y: 0, z: -1 }, up = { x: 0, y: 1, z: 0 };
  A.listen = (camera) => {
    if (!ctx || ctx.state !== 'running') return;
    const L = ctx.listener, e = camera.matrixWorld.elements, t = ctx.currentTime;
    fwd.x = -e[8]; fwd.y = -e[9]; fwd.z = -e[10]; up.x = e[4]; up.y = e[5]; up.z = e[6];
    if (L.positionX) {
      L.positionX.setTargetAtTime(e[12], t, 0.02); L.positionY.setTargetAtTime(e[13], t, 0.02); L.positionZ.setTargetAtTime(e[14], t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.setTargetAtTime(up.x, t, 0.02); L.upY.setTargetAtTime(up.y, t, 0.02); L.upZ.setTargetAtTime(up.z, t, 0.02);
    } else { L.setPosition(e[12], e[13], e[14]); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
  };
  A.unlock = unlock;   // (for rigs: what the first click does)
  return A;
}

// A "Volume" slider row for a panel: drag it and the sound follows at once (and is remembered on this computer).
export function volumeRow(A) {
  ensureCss();
  const row = document.createElement('label');
  row.className = 'bm-vol';
  row.innerHTML = `<span>Volume</span><input type="range" min="0" max="100" step="1" aria-label="Volume"><b></b>`;
  const input = row.querySelector('input'), num = row.querySelector('b');
  const show = () => { num.textContent = Math.round(A.volume * 100); };
  input.value = String(Math.round(A.volume * 100)); show();
  input.addEventListener('input', () => { A.setVolume(+input.value / 100); show(); });
  // (the arrow keys move the slider, not the rider)
  input.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  return row;
}
let cssDone = false;
function ensureCss() {
  if (cssDone) return; cssDone = true;
  const s = document.createElement('style');
  s.textContent = `.bm-vol { display: flex; align-items: center; gap: 12px; margin-top: 14px; font: 600 15px Bitter, Georgia, serif; color: inherit; }
.bm-vol input { flex: 1; accent-color: #c8913c; height: 22px; cursor: pointer; }
.bm-vol b { min-width: 2.2em; text-align: right; font-weight: 700; }`;
  document.head.appendChild(s);
}
