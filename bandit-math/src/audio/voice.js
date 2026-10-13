// OLD HOB'S VOICE: when Hob says a line, a short babble plays under the caption, the way the townsfolk talk in a cosy
// village game: no words, a little low gravelly syllable for each word or so, each at its own pitch, warm and old. The
// syllable is a Sound Lab patch ('VOICE — OLD HOB' in src/audio/patch.js, the same as ~/sound-lab/patch.js, so it can be
// tuned by ear in the lab); here each one is played with its vowel and pitch set. The same line always babbles the same
// way (its pitches come from its letters), a question lifts at the end, and a long line stops babbling after a couple of
// seconds (the caption carries on): it is a voice, not a speech.
//
// It is quiet (well under the stage band and the game's other sounds) and only plays while the game runs: it goes
// through the game's master volume (the Menu's Volume, silent on the title and while paused, see audio.js), and the
// syllables are let out a frame at a time from V.update, which the game only calls while riding (so a pause or the
// title stops the babble where it is). The Esc menu has its own "Hob's voice" switch (saved with the volume, in the
// game's settings key: it belongs to the computer, not the rider).
//
//   const V = makeHobVoice(audio)     audio: makeAudio() (src/audio/audio.js)
//   V.speak(text)       babble for this line (a line already babbling is cut short)
//   V.stop()            no more syllables for this line
//   V.update(dt)        each frame while riding: lets out the syllables that are due
//   V.on / V.setOn(on)  the switch (saved)
//   V.speaking          true while syllables are still to come
//   V.said              how many syllables have played (for rigs)
//   voiceRow(V)         the "Hob's voice" switch row for the Esc menu
//   babble(text)        the syllables a line makes: [{ at (s from the start), vowel, semi, len }] (pure: for tests)
import { playPatch, PATCH_PRESETS } from './patch.js';

export const VOICE = {
  patch: 'VOICE — OLD HOB',
  level: 0.32,          // the voice's own level into the master (the patch is written at full; this keeps it quiet)
  step: 0.15,           // seconds from one syllable to the next
  wordGap: 0.05,        // ... plus this between words
  pause: 0.22,          // ... and this after a comma or a full stop
  most: 14,             // syllables a line at most (about two seconds): the babble stops, the caption stays
  spread: 4,            // semitones the pitch wanders about Hob's own
  ahead: 0.08,          // seconds ahead a syllable is put on the clock (smooths out an uneven frame)
};
// the vowel resonances (Hz) of an old man's voice, a touch darker than the textbook ones so it stays warm
const VOWELS = {
  a: [700, 1100], e: [500, 1650], i: [360, 1900], o: [540, 850], u: [400, 900], y: [380, 1700],
};
const KEY = 'bandit-math.settings';
function loadSettings() { try { const s = JSON.parse(globalThis.localStorage.getItem(KEY) || '{}'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; } }
function saveSettings(patch) { try { globalThis.localStorage.setItem(KEY, JSON.stringify({ ...loadSettings(), ...patch })); } catch (e) { /* storage blocked: the switch just isn't remembered */ } }

// a small number from a word's letters, so the same word always gets the same pitch
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function babble(text) {
  const out = [];
  const words = String(text || '').split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  const question = /\?\s*$/.test(String(text || ''));
  let at = 0;
  for (let wi = 0; wi < words.length && out.length < VOICE.most; wi++) {
    const w = words[wi], letters = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    // one syllable a word, two for a long one: from the word's vowels (a word with none hums an 'uh')
    const vowels = (letters.match(/[aeiouy]/g) || ['u']);
    const n = letters.length > 6 && vowels.length > 1 ? 2 : 1;
    for (let k = 0; k < n && out.length < VOICE.most; k++) {
      const h = hash(letters + k);
      // the pitch: about Hob's own, wandering by the word, drifting down through a line (a question lifts at the end)
      let semi = ((h % 1000) / 1000 * 2 - 1) * VOICE.spread * 0.5 - (out.length / VOICE.most) * 1.5;
      const last = wi === words.length - 1 && k === n - 1;
      if (last) semi += question ? 3 : -1.5;
      out.push({ at: +at.toFixed(3), vowel: vowels[Math.min(vowels.length - 1, k * 2)], semi: +semi.toFixed(2), len: last ? 1.3 : 1 });
      at += VOICE.step;
    }
    at += VOICE.wordGap + (/[.,;:!?]$/.test(w) ? VOICE.pause : 0);
  }
  return out;
}

// the patch with this syllable's pitch, vowel and length
function syllablePatch(base, s) {
  const r = Math.pow(2, s.semi / 12), [f1, f2] = VOWELS[s.vowel] || VOWELS.u;
  return {
    ...base,
    nodes: base.nodes.map((n) => {
      if (n.id === 'buzz' || n.id === 'buzz2') return { ...n, freq: n.freq * r };
      if (n.id === 'f1') return { ...n, freq: f1 };
      if (n.id === 'f2') return { ...n, freq: f2 };
      if (n.id === 'amp') return { ...n, decay: (n.decay ?? 0.13) * s.len };
      return n;
    }),
  };
}

export function makeHobVoice(audio) {
  const saved = loadSettings().hobVoice;
  let line = [], t = 0, bus = null, since = 0;
  const V = { on: saved !== false, said: 0, get speaking() { return line.length > 0; } };
  const need = (on) => { if (audio) audio.need('hob', on); };
  V.setOn = (on) => { V.on = !!on; saveSettings({ hobVoice: V.on }); if (!V.on) V.stop(); };
  V.speak = (text) => {
    line = V.on ? babble(text) : []; t = 0; since = performance.now();
    need(line.length > 0);
  };
  V.stop = () => { line = []; need(false); };
  V.update = (dt) => {
    if (!line.length) return;
    t += dt;
    // (a line said while the game was paused, at a counter say, is not babbled late over whatever comes next)
    if ((performance.now() - since) / 1000 > line[0].at + 1) { V.stop(); return; }
    const ctx = audio && audio.ctx, base = PATCH_PRESETS[VOICE.patch];
    while (line.length && line[0].at <= t) {
      // (the sound still waking from its sleep, with nothing holding it quiet: the line waits for it a moment)
      if (ctx && !audio.holds.size && ctx.state !== 'running' && t - line[0].at < 0.6) break;
      const s = line.shift();
      // (only once the sound is awake and running: a syllable put on a sleeping clock would all come out at once later)
      if (ctx && audio.running && base) {
        if (!bus) { bus = ctx.createGain(); bus.gain.value = VOICE.level; bus.connect(audio.out); }
        try { playPatch(ctx, null, bus, null, syllablePatch(base, s), null, { at: ctx.currentTime + VOICE.ahead }); V.said++; } catch (e) { console.warn('voice: a syllable could not play', e); }
      }
    }
    if (!line.length) need(false);
  };
  V.dispose = () => { V.stop(); if (bus) { try { bus.disconnect(); } catch (e) { /* already gone */ } bus = null; } };
  return V;
}

// The Esc menu's "Hob's voice" switch: one tap turns it on or off (and is remembered on this computer)
export function voiceRow(V) {
  ensureCss();
  const row = document.createElement('div');
  row.className = 'bm-voice';
  row.innerHTML = `<span>Hob's voice</span><button type="button" role="switch" aria-label="Hob's voice"></button>`;
  const b = row.querySelector('button');
  const show = () => { b.setAttribute('aria-checked', String(V.on)); b.textContent = V.on ? 'On' : 'Off'; };
  b.addEventListener('click', () => { V.setOn(!V.on); show(); });
  show();
  return row;
}
let cssDone = false;
function ensureCss() {
  if (cssDone) return; cssDone = true;
  const s = document.createElement('style');
  s.textContent = `.bm-voice { display: flex; align-items: center; gap: 12px; margin-top: 10px; font: 600 15px Bitter, Georgia, serif; color: inherit; }
.bm-voice span { flex: 1; }
.bm-voice button { min-width: 4.2em; padding: 5px 12px; border-radius: 999px; font: 700 14px Bitter, Georgia, serif; cursor: pointer;
  border: 1px solid rgba(226, 173, 76, 0.45); background: transparent; color: inherit; }
.bm-voice button[aria-checked="true"] { background: #c8913c; border-color: #c8913c; color: #1e140c; }
.bm-voice button:focus-visible { outline: 2px solid #e2ad4c; outline-offset: 2px; }`;
  document.head.appendChild(s);
}
