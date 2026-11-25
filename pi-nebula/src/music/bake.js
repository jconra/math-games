// PRE-RENDERED NOTES: each different note of the music rendered once, in the background, by the same patch through the
// same engine (src/audio/patch.js), kept, and played back as one buffer, so the sound thread is not running a tree of
// oscillators, filters and envelopes for every note. The game's maker, 2026-11-24: "Do we need to sample all the notes
// we need so the audio context doesn't have a hard time processing the sounds in real time? (like the issue we were
// having in Mathwood)". His other game does this for its band: mathwood-valley/src/audio/bake.js, whose idea this is
// and from which these parts are copied (nothing is imported across the game folders):
//   from Mathwood's bake.js, as they are: hashText; the store (storeOpen, askedAll, asked: IndexedDB, anything going
//     wrong just means rendering again); the bakery's shape (a queue, the store asked first, then a batch at a time in
//     one OfflineAudioContext, a channel each, its building spread over frames: BAKE.batch, buildPerStep, gap); a
//     note not ready yet played live, as it always was, so nothing waits and nothing goes silent; a few takes of a
//     note with noise in it, played in turn; the old notes of a changed patch thrown off the shelf (prune).
//   Pi Nebula's own: what a note is (its patch, its pitch, its length, its per-note settings: the player's notePatch),
//     so the key is the patch's own content and the note's (a patch changed in the Sound Lab and synced has a new key
//     and is rendered again by itself); the rule for which notes are worth it (worth: by a note's length and cost,
//     never by its name, so a patch this file has never seen is decided the same way); the level and the room's
//     share put on at play time (every note rendered at the patch's own level: its velocity, and its part's level,
//     which is the part's bus, are never in it or in its key).
//
// WHY THE SAME SOUND: in every patch of the music a note's velocity is only its out (and send) level (voicePatch,
// notePatch), so a note rendered at full level and played back through a gain of its velocity is the same note.
// What a note sends to the room is rendered with it, in the same voice (the same noise), as a second channel where
// it is not simply a share of what goes out (a snare's noise only, the bells' first partial, the echo pluck's dry
// half); where it is (a pad, a clap), the one channel is sent at the send's share.
// What is not the same: the noise in a drum is a different take of four live (the engine keeps four noise buffers a
// kind) and three here; a note's very end: it is rendered as long as its voice is heard live (to its last envelope's
// end, about -40 dB on a held note's release) and faded over the last 10 ms, where a live voice goes on falling under
// that until it is torn down.
//
//   const B = bakery(sampleRate, { noteOf, store, patches })   the one bakery for a sample rate (AudioBuffers outlive
//            contexts). noteOf(patch, { semi, len, set }) -> the note's patch at full level (the player's notePatch)
//   B.plan(patch, { semi, len, set }) -> plan          the note: its key, whether it is worth rendering (plan.worth),
//            its takes, its levels (cached: one lookup a note once seen)
//   B.want(plan, urgent)                               asked for (rendered in the background unless kept already)
//   B.play(ctx, plan, at, vel, dest, room) -> { stop(fade) } | null   null: not rendered yet (asked for now) or not
//            worth it: play it live
//   B.whenDone() -> promise                            every note asked for so far rendered (the rigs)
//   B.stats() -> { wanted, baked, fromStore, bakeMs, buildMs, storeMs, MB, played, live, skipped, notes }
//   hashText, patchHash, noteKey, worth, bakedSecs, bakedPatch, storeOpen, BAKE: the plain parts, for the tests
import { playPatch, patchAutoStopTime } from '../audio/patch.js';

const VERSION = 2;                         // (a change in how notes are rendered: everything is rendered again)
export const BAKE = {
  takes: 3,              // a note with noise in it: this many takes, played in turn (the noise differs hit to hit)
  // WHICH NOTES (by length and cost, never by name): a note is worth rendering when playing it live costs the sound
  // thread more than keeping it costs memory. Its cost live: the nodes the engine makes for it; its memory: its length
  // times its takes. Measured on the eight presets (~/pw/space-math/rigs/musicgame-1/count.mjs, three rounds of each
  // song's sections): the long pads are 20-60 % of all the work live (node-seconds) and only 7-12 different notes a
  // song (4-7 MB, the slowest song's up to 5.2 s a note); the wobble bass 10-12 % of it and 26-42 different notes
  // (3.5-4 MB). Both are rendered. A whole song rendered so comes to 6-19 MB. The longest held note of the slowest
  // tempo (60 bpm: a bar's pad, 5.5 s) still fits; the riser (2 s of noise, three takes: 6 s) just does.
  most: 6,               // s of samples a note keeps (its length times its takes): longer plays live
  short: 0.75,           // s: a note this short or shorter is always rendered
  perSec: 0.5,           // longer: rendered when it has at least this many nodes for each second it lasts (a long
                         // note with next to nothing in it is cheaper live than kept)
  fade: 0.01,            // s faded at a rendered note's end
  // WHERE IN THE ENGINE'S 128-SAMPLE BLOCK A NOTE IS RENDERED FROM (samples of quiet before it, skipped at play time):
  // a live note's sound differs a little with where in a block its time falls (its envelopes and sweeps are worked
  // out a block at a time: the wobble and the FM ladder bass by 0.3-0.5 dB, the rest by under 0.05;
  // rigs/musicgame-1/offsets.cjs); rendered from the block's start, each note was at one end of that spread, from its
  // middle it sits in it. Each take of a noisy note from another place (Mathwood's bake.js `lead`, the same idea).
  lead: (take) => (64 + 43 * take) % 128,
  batch: 12,             // notes rendered at once (one context, a channel each)
  buildPerStep: 3,       // notes of a batch set up between frames
  gap: 40,               // ms rested between steps
  storeMB: 64,           // the kept store's most; past it, notes not asked for on this visit are thrown off first
};

// ── THE PLAIN PARTS ──────────────────────────────────────────────────────────────────────────────────────────────────
// (from Mathwood's bake.js: two FNV-1a's with different seeds, as hex)
export function hashText(text) {
  let a = 2166136261, b = 0x811c9dc5 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 1099511); b ^= b >>> 13; }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
// a patch's content as a short hash (kept for the patch object: the synced file's patches never change in place)
const hashes = new WeakMap();
export function patchHash(patch) {
  let h = hashes.get(patch);
  if (!h) { h = hashText(JSON.stringify(patch)); hashes.set(patch, h); }
  return h;
}
const held = (patch) => patch.nodes.some((n) => n.type === 'env' && !n.disabled && (n.sustain ?? 0) > 0.001);
export const noisy = (patch) => patch.nodes.some((n) => n.type === 'noise' && !n.disabled);
const r4 = (v) => Math.round(v * 1e4) / 1e4;
// A NOTE'S KEY: the patch's content, the note's pitch, its length where its patch holds notes (a drum's length is the
// drum: none), its per-note settings, the sample rate and the take. Velocity is not in it (put on at play time).
export function noteKey(patch, { semi = 0, len = null, set = null } = {}, sr, take = 0) {
  const L = len != null && held(patch) ? r4(len) : '-';
  const S = set ? hashText(JSON.stringify(set, (k, v) => (typeof v === 'number' ? r4(v) : v))) : '-';
  return `${patchHash(patch)}:${VERSION}:${r4(semi)}:${L}:${S}:${sr}:${take}`;
}
// how long a note is rendered: as long as its voice is heard live (to its last envelope's end)
export const bakedSecs = (note) => { const t = patchAutoStopTime(note); return t == null ? null : +((t - 0.2 + 0.05).toFixed(3)); };
// what the engine builds for a note (every node but its out and its send)
export const costOf = (note) => note.nodes.filter((n) => n.type !== 'out' && n.type !== 'send').length;
// THE RULE: worth rendering? (a drone, with no envelope, never: it has no end)
export function worth(note) {
  const secs = bakedSecs(note);
  if (secs == null || secs * (noisy(note) ? BAKE.takes : 1) > BAKE.most) return false;
  return secs <= BAKE.short || costOf(note) >= BAKE.perSec * secs;
}
const feeds = (p, id) => p.cables.filter((c) => c.to === id && (!c.port || c.port === 'in')).map((c) => c.from).sort().join(',');
// a note as it is rendered: its out at full level, and its send at full level as a second output where what it sends
// is not simply what goes out (apart); { patch, out, send, apart } (out, send: the levels put on at play time)
export function bakedPatch(note) {
  const out = note.nodes.find((n) => n.type === 'out'), send = note.nodes.find((n) => n.type === 'send' && !n.disabled);
  const apart = !!send && feeds(note, send.id) !== feeds(note, out.id);
  const nodes = note.nodes.filter((n) => n !== send || apart).map((n) => (n === out || n === send ? { ...n, gain: 1 } : n));
  const ids = new Set(nodes.map((n) => n.id));
  return { patch: { ...note, nodes, cables: note.cables.filter((c) => ids.has(c.from) && ids.has(c.to)) }, out: out ? out.gain ?? 1 : 1, send: send ? send.gain ?? 0 : 0, apart };
}

// ── THE STORE (from Mathwood's bake.js: IndexedDB; anything going wrong just means rendering again) ─────────────────
const DB = 'pi-nebula-music-notes', OS = 'notes';
export function storeOpen(timeoutMs = 10000) {
  return new Promise((res) => {
    let done = false; const end = (v) => { if (!done) { done = true; res(v); } };
    try {
      if (typeof indexedDB === 'undefined') return end(null);
      const q = indexedDB.open(DB, 1);
      q.onupgradeneeded = () => { try { q.result.createObjectStore(OS); } catch (e) { /* there already */ } };
      q.onsuccess = () => { if (done) { try { q.result.close(); } catch (e) { /* gone */ } } else end(q.result); };
      q.onerror = () => end(null); q.onblocked = () => end(null);
      setTimeout(() => end(null), timeoutMs);
    } catch (e) { end(null); }
  });
}
const askedAll = (db, keys) => new Promise((res) => {
  try {
    const s = db.transaction(OS, 'readonly').objectStore(OS), out = new Array(keys.length); let left = keys.length;
    if (!left) return res(out);
    keys.forEach((k, i) => { const r = s.get(k), one = () => { out[i] = r.result; if (--left === 0) res(out); }; r.onsuccess = one; r.onerror = one; });
  } catch (e) { res(new Array(keys.length)); }
});
const asked = (db, how, run) => new Promise((res) => {
  try { const r = run(db.transaction(OS, how).objectStore(OS)); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); } catch (e) { res(undefined); }
});
// a stored key's bytes, from the key itself (its samples and channels are its last part: "...|n<samples>c<channels>")
const bytesOf = (k) => { const m = /\|n(\d+)c(\d+)$/.exec(String(k)); return m ? +m[1] * +m[2] * 4 : 0; };

// ── THE BAKERY ───────────────────────────────────────────────────────────────────────────────────────────────────────
const later = (ms) => new Promise((r) => setTimeout(r, ms));
const bakeries = new Map();
export function bakery(sr, opts = {}) {
  const had = bakeries.get(sr);
  if (had && !opts.fresh) return had;
  const B = makeBakery(sr, opts);
  bakeries.set(sr, B);
  return B;
}

function makeBakery(sr, { noteOf, store = true, patches = null } = {}) {
  const P = BAKE, plans = new WeakMap(), jobs = new Map(), queue = [], done = new Map(), turn = new Map();
  const stats = { wanted: 0, baked: 0, fromStore: 0, bakeMs: 0, buildMs: 0, storeMs: 0, played: 0, live: 0, skipped: 0, notes: 0, pruned: 0 };
  let dbP = null, running = false, waiters = [], pruned = false;
  const db = () => { if (!store) return Promise.resolve(null); if (!dbP) dbP = storeOpen(); return dbP; };

  function plan(patch, o = {}) {
    let byNote = plans.get(patch); if (!byNote) { byNote = new Map(); plans.set(patch, byNote); }
    const id = noteKey(patch, o, sr, 0);
    let p = byNote.get(id);
    if (p) return p;
    const note = noteOf(patch, { ...o, gain: 1 }), b = bakedPatch(note), secs = bakedSecs(note);
    const takes = noisy(note) ? P.takes : 1, ch = b.apart ? 2 : 1, n = secs ? Math.round(secs * sr) : 0;
    p = { id, worth: worth(note), secs, n, ch, takes, out: b.out, send: b.send, apart: b.apart, patch: b.patch,
      leads: Array.from({ length: takes }, (_, k) => P.lead(k)),
      keys: Array.from({ length: takes }, (_, k) => `${noteKey(patch, o, sr, k)}|n${n + P.lead(k)}c${ch}`) };
    byNote.set(id, p); stats.notes++;
    return p;
  }
  function want(p, urgent = false) {
    if (!p.worth) return;
    for (const key of p.keys) {
      if (jobs.has(key)) {
        if (urgent && !done.has(key)) { const i = queue.findIndex((j) => j.key === key); if (i > 0) queue.unshift(...queue.splice(i, 1)); }
        continue;
      }
      const j = { key, p, lead: p.leads[p.keys.indexOf(key)], len: p.n + p.leads[p.keys.indexOf(key)] };
      jobs.set(key, j); stats.wanted++;
      if (urgent) queue.unshift(j); else queue.push(j);
    }
    run();
  }

  // what is asked for: the store first, then the rendering, a batch at a time
  async function run() {
    if (running) return; running = true;
    try {
      const d = await db();
      while (queue.length) {
        // (a batch: the first and those no longer than it, one context as long as the first)
        const first = queue[0], batch = [];
        for (let i = 0; i < queue.length && batch.length < P.batch; i++) if (queue[i].len <= first.len) batch.push(queue[i]);
        for (const j of batch) queue.splice(queue.indexOf(j), 1);
        const rest = [], t0 = performance.now(), found = d ? await askedAll(d, batch.map((j) => j.key)) : [];
        for (let i = 0; i < batch.length; i++) {
          const j = batch[i], got = found[i];
          if (Array.isArray(got) && got.length === j.p.ch && got.every((a) => a instanceof Float32Array && a.length === j.len)) {
            done.set(j.key, toBuffer(got)); stats.fromStore++; stats.baked++;
          } else rest.push(j);
        }
        stats.storeMs += performance.now() - t0;
        if (rest.length) await bakeBatch(rest, d);
        await later(P.gap);
      }
      if (d && !pruned) { pruned = true; await prune(d); }
    } catch (e) { console.warn('Pi Nebula music: pre-rendering stopped; the notes play live', e); queue.length = 0; }
    running = false;
    if (queue.length) run();
    else { const w = waiters; waiters = []; for (const f of w) f(); }
  }
  function toBuffer(chans) {
    const buf = new AudioBuffer({ length: chans[0].length, numberOfChannels: chans.length, sampleRate: sr });
    chans.forEach((c, i) => buf.copyToChannel(c, i));
    return buf;
  }
  async function bakeBatch(list, d) {
    const n = list[0].len, t0 = performance.now();
    let chans = 0; const at = list.map((j) => { const c = chans; chans += j.p.ch; return c; });
    let spent = 0, mark = performance.now();
    const oc = new OfflineAudioContext(chans, n, sr), merge = oc.createChannelMerger(chans);
    merge.connect(oc.destination);
    for (let i = 0; i < list.length; i++) {
      const g = oc.createGain(); g.connect(merge, 0, at[i]);
      let w = null; if (list[i].p.ch > 1) { w = oc.createGain(); w.connect(merge, 0, at[i] + 1); }
      playPatch(oc, null, g, w, list[i].p.patch, null, { at: list[i].lead / sr });
      if ((i + 1) % P.buildPerStep === 0) { spent += performance.now() - mark; await later(P.gap); mark = performance.now(); }
    }
    spent += performance.now() - mark;
    const r = await oc.startRendering();
    const f = Math.max(1, Math.round(P.fade * sr));
    for (let i = 0; i < list.length; i++) {
      const j = list[i], data = [];
      for (let c = 0; c < j.p.ch; c++) {
        const a = r.getChannelData(at[i] + c).slice(0, j.len);
        for (let k = 0; k < f && k < a.length; k++) a[a.length - 1 - k] *= k / f;
        data.push(a);
      }
      done.set(j.key, toBuffer(data)); stats.baked++;
      if (d) asked(d, 'readwrite', (s) => s.put(data, j.key));
      await later(1);
    }
    stats.bakeMs += performance.now() - t0; stats.buildMs += spent;
  }
  // (off the shelf: notes of a patch that is no longer any of the music's (changed, or gone), of an old way of
  // rendering; then, over the most (BAKE.storeMB), the notes not asked for on this visit)
  async function prune(d) {
    const now = new Set(Object.values(patches || {}).map(patchHash));
    const keys = await asked(d, 'readonly', (s) => s.getAllKeys());
    if (!keys) return;
    let bytes = 0; const spare = [];
    for (const k of keys) {
      const [h, v] = String(k).split(':');
      if (+v !== VERSION || (patches && !now.has(h))) { asked(d, 'readwrite', (s) => s.delete(k)); stats.pruned++; continue; }
      bytes += bytesOf(k); if (!jobs.has(k)) spare.push(k);
    }
    for (const k of spare) { if (bytes <= P.storeMB * 1048576) break; bytes -= bytesOf(k); asked(d, 'readwrite', (s) => s.delete(k)); stats.pruned++; }
  }

  const B = {
    plan, want,
    get busy() { return running || queue.length > 0; },
    whenDone() { if (!running && !queue.length) return Promise.resolve(); return new Promise((r) => waiters.push(r)); },
    play(ctx, p, at, vel, dest, room) {
      if (!p.worth || ctx.sampleRate !== sr) { stats.live++; if (!p.worth) stats.skipped++; return null; }
      const k = (turn.get(p.id) || 0) % p.takes; turn.set(p.id, k + 1);
      const buf = done.get(p.keys[k]);
      if (!buf) { want(p, true); stats.live++; return null; }
      const src = ctx.createBufferSource(); src.buffer = buf;
      const head = ctx.createGain(), o = ctx.createGain(), nodes = [src, head, o];
      o.gain.value = p.out * vel;
      src.connect(head);
      // (two channels: what goes out is the first, what goes to the room the second)
      let sp = null;
      if (p.apart) { sp = ctx.createChannelSplitter(2); nodes.push(sp); head.connect(sp); sp.connect(o, 0); } else head.connect(o);
      o.connect(dest);
      if (room && p.send) {
        const s = ctx.createGain(); s.gain.value = p.send * vel; nodes.push(s); s.connect(room);
        if (sp) sp.connect(s, 1); else head.connect(s);
      }
      src.start(at, p.leads[k] / sr);
      src.onended = () => { for (const x of nodes) try { x.disconnect(); } catch (e) { /* gone */ } };
      stats.played++;
      return { stop(fade = 0.02) {
        const now = ctx.currentTime;
        try { if (now < at) { src.stop(); return; } head.gain.setTargetAtTime(0, now, Math.max(0.002, fade)); src.stop(now + Math.max(0.002, fade) * 5 + 0.02); } catch (e) { /* gone */ }
      } };
    },
    stats() {
      let bytes = 0; for (const b of done.values()) bytes += b.length * b.numberOfChannels * 4;
      return { ...stats, MB: +(bytes / 1048576).toFixed(2), bakeMs: Math.round(stats.bakeMs), buildMs: Math.round(stats.buildMs), storeMs: Math.round(stats.storeMs), queued: queue.length };
    },
  };
  return B;
}
