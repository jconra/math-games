// The lock box's own voice: the maker's read-aloud clips (src/audio/readaloud.js) on a small sound path of the box's
// own. The game's sound is held quiet while a box is open (the game is paused: the wind, the creek and the band all
// fade out), so the read-aloud can't go through it. This path carries nothing but the clips, at the game's volume.
//
// It is only made for a rider whose questions are read out (src/math/skill.js readAloud), the first time the box has a
// line to read, which is inside the click or tap that opened the box (browsers only let sound start from one; every
// tap on the panel wakes it again, which an iPhone wants). It closes with the panel.
//
//   const V = makeBoxVoice({ volume: () => 0..1, base })   (volume: the game's master volume setting; base: the game's
//                                                          folder, where sounds/read/ is)
//   V.say(text) -> true if the clips can say it (it plays as soon as they are loaded)
//   V.react('right' | 'wrong')   "That's right!" (now and then) or "Not that one."
//   V.wake()     on a tap: make the sound path, or wake it
//   V.stop(), V.state() (readaloud.js's state, for rigs), V.dispose()

import { makeReadAloud } from '../audio/readaloud.js';

const GAME = new URL('../../', import.meta.url).href;   // (src/lockbox/ -> the game's folder)

export function makeBoxVoice({ volume = () => 0.8, base = GAME } = {}) {
  let ctx = null, out = null, alive = true;
  const audio = {
    get ctx() { return ctx; },
    get out() { return out; },
    get running() { return !!ctx && ctx.state === 'running'; },
  };
  const level = () => { const v = Math.max(0, Math.min(1, Number(volume()) || 0)); return v * v; };   // (as audio.js: squared)
  function wake() {
    if (!alive) return;
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = null; return; }
      out = ctx.createGain();
      out.gain.value = level();
      out.connect(ctx.destination);
    }
    out.gain.value = level();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  }
  const R = makeReadAloud({ audio, base, on: () => alive });
  // a line waits for its clips and for the sound path to wake: keep looking while there is something to say
  const tick = setInterval(() => { if (alive && ctx) R.update(0.1); }, 100);
  return {
    wake,
    say(text) { if (!alive || !text) return false; wake(); return R.say(text); },
    react(kind) { if (!alive) return false; wake(); return R.react(kind); },
    stop() { R.stop(); },
    state() { return { ...R.state(), made: !!ctx, running: audio.running }; },
    get speaking() { return R.speaking; },
    dispose() {
      if (!alive) return;
      alive = false;
      clearInterval(tick);
      R.dispose();
      const c = ctx; ctx = null;
      // (let the last word finish fading before the path closes)
      if (c) setTimeout(() => { try { c.close(); } catch (e) { /* already closed */ } }, 300);
    },
  };
}
