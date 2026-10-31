// clipslots.js: named places for recorded voice lines that the game says today some other way (the browser's voice,
// or only a bubble). Each slot is one line with its file name in sounds/voice/ (<file>.ogg and <file>.m4a, as the
// other voice clips). A slot plays its clip once `recorded` is true (set it when both files are in sounds/voice/:
// a missing file would be a failed request on every play); until then, and whenever the clip can't play (no sound
// yet, a file that won't load), the caller falls back to what it did before.
//
//   CLIP_SLOTS                     { id: { file, says, recorded } }
//   slotFiles(id) -> ['help_1', ...] when recorded, else []   (a list, for callers that take several clips)
//   slotTakes(id) -> [{ file, says }] when recorded, else []   (a slot of several takes: each with its own words)
//   playSlot(audio, id, { after })  -> true if the clip will play (the caller then skips its fallback), false if not.
//                                     audio: src/audio/audio.js's { ctx, out, running }. after: ms to wait first.

export const CLIP_SLOTS = {
  ropeEvens: { file: 'rope_the_evens', says: 'Rope the evens', recorded: false },     // the wagon's evens card, read out
  ropeOdds: { file: 'rope_the_odds', says: 'Rope the odds', recorded: false },        // the wagon's odds card, read out
  // a held-up wagon's driver: Dad's four takes, one at a time at random, his bubble saying the words of the one he shouts
  helpBandits: { file: 'help_1', says: 'Help! Ah, bandits!', recorded: true, takes: [
    { file: 'help_1', says: 'Help! Ah, bandits!' }, { file: 'help_2', says: 'Heelp! Bandits!' },
    { file: 'help_3', says: "Help! They're trying to rob me!" }, { file: 'help_4', says: 'Stay back! Heeeelp!' }] },
  // a woman driving a held-up wagon
  helpWoman: { file: 't_help_1', says: 'Help!', recorded: true },
};

export function slotFiles(id) { return slotTakes(id).map((t) => t.file); }
// the slot's takes, each with its own words: [{ file, says }] when recorded (a slot of one take: that one), else []
export function slotTakes(id) {
  const s = CLIP_SLOTS[id];
  return s && s.recorded ? (s.takes || [{ file: s.file, says: s.says }]) : [];
}

const GAME = new URL('../../', import.meta.url).href;
const bufs = new Map();   // file -> AudioBuffer | Promise | null (failed)

function extOf() {
  try { if (/^(probably|maybe)$/.test(document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"'))) return '.ogg'; } catch (e) { /* no audio element */ }
  return '.m4a';
}

function load(ctx, file) {
  if (bufs.has(file)) return bufs.get(file);
  const p = fetch(GAME + 'sounds/voice/' + file + extOf())
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
    .then((ab) => ctx.decodeAudioData(ab))
    .then((b) => { bufs.set(file, b); return b; })
    .catch((e) => { console.warn('voice slot: a clip could not load', file, e && e.message); bufs.set(file, null); return null; });
  bufs.set(file, p);
  return p;
}

export function playSlot(audio, id, { after = 0 } = {}) {
  const s = CLIP_SLOTS[id];
  if (!s || !s.recorded || !audio || !audio.ctx || !audio.running || !audio.out) return false;
  if (bufs.get(s.file) === null) return false;   // (tried before and it wouldn't load: the fallback says it)
  const ctx = audio.ctx;
  const go = (b) => {
    if (!b) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = b; src.connect(audio.out);
      src.onended = () => { try { src.disconnect(); } catch (e) { /* gone */ } };
      src.start();
    } catch (e) { /* no sound: the card is still on screen */ }
  };
  setTimeout(() => { const b = bufs.get(s.file); if (b && typeof b.then !== 'function') go(b); else Promise.resolve(load(ctx, s.file)).then(go); }, Math.max(0, after));
  return true;
}
