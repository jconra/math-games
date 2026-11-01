// BAKED NOTES: the band's synth notes rendered once, in the browser, and played back like samples, so the sound thread
// isn't running a tree of oscillators and filters for every note (the game's maker heard the music crackle on his phone
// while running about). No download: the Sound Lab patches stay the source of every sound, so tuning a patch still works,
// and a note changed that way is baked again (its key is a hash of its patch). Baked notes are kept between visits in the
// browser's storage (IndexedDB) when it's there. Rendering happens a batch at a time in OfflineAudioContexts, which run off
// the main thread and off the sound thread; building a batch is spread over frames. A note not baked yet is simply played
// live, as it always was, so nothing waits and nothing goes silent.
//
// What makes a note bakeable with no change in its sound:
//   the piano   a note's velocity only sets its output's level, and its damper comes last in the patch; the patch's random
//               part (the hammer's noise) changes a note by 50-65 dB under it, so one take. So: one bake a key, damper held open, full ring;
//               at play time a gain with the damper's own two-stage fall (from the note's own patch, so the same times)
//   the box     a thump's velocity changes its boom's length too, a hit's tone its filters: a few velocities and tones
//               baked, two takes each (the noise differs from hit to hit), the nearest played; its level from the hit's patch
//   the banjo   velocity changes its brightness: a few velocities baked for each note asked for. The head's echo comes
//               after its damper, so it stays live, one shared echo for all the notes (the same sound: it's linear)
//   the harmonica is not baked: its bends and its wobble change with every phrase, and it's a voice or two at a time.
//   the rest    the action music's notes (actionmusic.js), a horse's hooves and splashes (ambience.js), a wagon's hooves and
//               creaks (wagonsound.js): each of those files says what it wants baked, as a family of "shots", and plays them
//               with B.playShot. A family goes off the shelf and is kept up on its own (a family only asked for on a wagon
//               job isn't thrown away by a visit that never takes one).
//
//   bakedBand(sampleRate, { patches, store }) -> B       the one bakery for a sample rate (AudioBuffers outlive contexts)
//   B.start(songId)        starts on the notes in the background, the song's own first; again later: that song's come next
//   B.whenBaked()          a promise of every note done (rigs)
//   B.playPiano(ctx, dest, room, note, midi, at, len) -> { stop(s) } or null   note: its patch from pianoNotes (null: not
//                          baked yet, or held longer than the bake rings: play it live)
//   B.playBox(ctx, dest, room, hit, note, at) -> { stop(s) } or null           hit: { hit, vel, tone }; note: from boxNote
//   B.playBanjo(ctx, dest, room, n) -> { stop(s) } or null                     n as playBanjoSynth takes it (asks for it, baked for next time)
//   B.shots(family, list)  asks for a family's sounds, list: [{ name, make() -> { patch (full level, nothing sent: openNote), secs, take, lead } }]; lead: samples of silence
//                          it's baked after and played from: a sine with a falling pitch starts at a phase that depends on where in a
//                          128-sample render block it starts, so takes at different leads have the spread of starts a live note has
//   B.playShot(ctx, dest, room, family, name, o, at) -> { stop(fade) } or null   null: not baked yet, play it live. o: { gain (its
//                          output), send (its share to the room), wet (a second shot's name, when what goes to the room isn't what
//                          goes out: wetNote), let: a time and time constant it's let go with, { at, tc, tail } }
//   B.stats()              { wanted, baked, fromStore, bakeMs, MB, played: {piano, box, banjo, ...families}, live: {the same} }
//   noteKey(patch, secs, sr, take), nearest(list, v), openNote(patch), wetNote(patch), bakedSecs(patch), storeOpen()   the plain parts, for the tests
import { playPatch, patchAutoStopTime, BUILDERS, PATCH_PRESETS } from './patch.js';
import { pianoNotes, boxNote, songOf, PIANO } from './stagemusic.js';
import { banjoNote, BANJO_SYNTH_LEVEL, BANJO, BANJO_SYNTH } from './banjosynth.js';

const VERSION = 1;                       // (a change in how notes are baked: everything is baked again)
export const BAKE = {
  pianoSecs: 2,                          // s of a piano note's ring baked; a note held too long for it plays live (about 1 in 200)
  tail: 0.35,                            // s the damper's tail runs before its note ends (about -60 dB)
  // the piano's keys the songs use, low to high (a key not listed is baked the first time it's played; tests/bake.test.mjs
  // checks the songs against the list)
  pianoKeys: [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 52, 54, 55, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88],
  thumpVels: [0.5, 0.75, 1], tones: [0.95, 0.975, 1, 1.025, 1.05], takes: 2,
  banjoVels: [0.2, 0.35, 0.55, 0.8, 1], banjoSecs: 2,
  batch: 12,                             // notes rendered at once (one context, a channel each: they share its wave tables)
  buildPerStep: 3,                       // notes of a batch set up between frames
  gap: 40,                               // ms rested between steps
};

// ── THE PLAIN PARTS ──────────────────────────────────────────────────────────────────────────────────────────────────
export function hashText(text) {   // (two FNV-1a's with different seeds, as hex)
  let a = 2166136261, b = 0x811c9dc5 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 1099511); b ^= b >>> 13; }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
export const noteKey = (patch, secs, sr, take = 0) => `${hashText(JSON.stringify(patch))}:${VERSION}:${secs}:${sr}:${take}`;
export const nearest = (list, v) => list.reduce((b, x) => (Math.abs(x - v) < Math.abs(b - v) ? x : b), list[0]);
const nodeOf = (p, id) => p.nodes.find((n) => n.id === id);
// a note's patch as it's baked: its output at full level, nothing sent to the room, and (ids) any other nodes left out
export function openNote(patch, drop = []) {
  const gone = new Set([...patch.nodes.filter((n) => n.type === 'send').map((n) => n.id), ...drop]);
  return { ...patch, nodes: patch.nodes.filter((n) => !gone.has(n.id)).map((n) => (n.type === 'out' ? { ...n, gain: 1 } : n)), cables: patch.cables.filter((c) => !gone.has(c.from) && !gone.has(c.to)) };
}

// what a note sends to its room, as a note of its own (for a patch where that isn't simply a share of what goes out)
export function wetNote(patch) {
  const send = patch.nodes.find((n) => n.type === 'send'), out = patch.nodes.find((n) => n.type === 'out');
  const fed = new Set(), grow = (id) => { if (fed.has(id)) return; fed.add(id); for (const c of patch.cables) if (c.to === id) grow(c.from); };
  grow(send.id);
  return { ...patch, nodes: patch.nodes.filter((n) => fed.has(n.id) && n !== out).map((n) => (n === send ? { ...n, type: 'out', gain: 1 } : n)), cables: patch.cables.filter((c) => fed.has(c.from) && fed.has(c.to) && c.to !== out.id) };
}
// how long a one-shot patch's bake runs: as long as its voice is heard live
export const bakedSecs = (patch) => +((patchAutoStopTime(patch) - 0.2 + 0.05).toFixed(3));

// ── THE STORE (IndexedDB; anything going wrong just means baking again) ──────────────────────────────────────────────
const DB = 'mathwood-baked-notes', OS = 'notes';
export function storeOpen(timeoutMs = 10000) {   // (a busy phone can be seconds about it; live notes play meanwhile)
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
// several notes in one transaction (one trip to the disk, not one a frame): undefined for the ones not there
const askedAll = (db, keys) => new Promise((res) => {
  try {
    const s = db.transaction(OS, 'readonly').objectStore(OS), out = new Array(keys.length); let left = keys.length;
    keys.forEach((k, i) => { const r = s.get(k), one = () => { out[i] = r.result; if (--left === 0) res(out); }; r.onsuccess = one; r.onerror = one; });
  } catch (e) { res(new Array(keys.length)); }
});
const asked = (db, how, run) => new Promise((res) => {
  try { const r = run(db.transaction(OS, how).objectStore(OS)); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); } catch (e) { res(undefined); }
});

// ── THE BAKERY ───────────────────────────────────────────────────────────────────────────────────────────────────────
const later = (ms) => new Promise((r) => setTimeout(r, ms));
const bakeries = new Map();
export function bakedBand(sampleRate, opts = {}) {
  const had = bakeries.get(sampleRate);
  if (had && !opts.fresh) return had;
  const B = makeBakery(sampleRate, opts);
  bakeries.set(sampleRate, B);
  return B;
}

function makeBakery(sr, { patches = PATCH_PRESETS, store = true } = {}) {
  const P = BAKE, jobs = new Map(), queue = [], done = new Map(), turn = new Map(), echoes = new WeakMap(), pruned = new Set();
  const stats = { wanted: 0, baked: 0, fromStore: 0, bakeMs: 0, storeMs: 0, played: { piano: 0, box: 0, banjo: 0 }, live: { piano: 0, box: 0, banjo: 0 } };
  let dbP = null, running = false, whenDone = null, boxAsked = false;
  const db = () => { if (!store) return Promise.resolve(null); if (!dbP) dbP = storeOpen(); return dbP; };

  // a job: a note's name here, its patch as baked, how long
  function want(name, make, urgent = false, family = '') {
    if (jobs.has(name)) {
      if (urgent && !done.has(name)) { const i = queue.findIndex((j) => j.name === name); if (i > 0) queue.unshift(...queue.splice(i, 1)); }
      return;
    }
    const j = { name, make, family, patch: null, key: null, secs: 0 };
    jobs.set(name, j); stats.wanted++;
    if (urgent) queue.unshift(j); else queue.push(j);
    run();
  }
  const prepare = (j) => { if (j.patch) return; const m = j.make(); j.patch = m.patch; j.secs = m.secs; j.lead = m.lead || 0; j.key = (j.family ? j.family + '|' : '') + noteKey(m.patch, m.secs, sr, m.take || 0); };

  const pianoName = (m) => `piano|${m}`;
  function wantPiano(m, urgent) {
    const base = patches[PIANO];
    if (!base || !nodeOf(base, 'damp-a-e') || !nodeOf(base, 'damp-b-e')) return false;
    want(pianoName(m), () => ({ patch: openNote(pianoNotes({ midi: m, len: P.pianoSecs + 2, vel: 1 }, base)[0]), secs: P.pianoSecs }), urgent);
    return true;
  }
  const boxName = (hit, v, t, k) => `box|${hit}|${v}|${t}|${k}`;
  function wantBox() {
    for (const hit of ['thump', 'slap', 'tap']) for (const v of hit === 'thump' ? P.thumpVels : [1]) for (const t of P.tones) for (let k = 0; k < P.takes; k++) {
      want(boxName(hit, v, t, k), () => { const note = boxNote({ hit, vel: v, tone: t }, patches); return { patch: openNote(note), secs: +((patchAutoStopTime(note) - 0.2 + 0.05).toFixed(3)), take: k }; });
    }
  }
  const banjoName = (m, v) => `banjo|${m}|${v}`;
  const banjoPatch = () => patches[BANJO] || BANJO_SYNTH;
  function wantBanjo(m, v) {
    want(banjoName(m, v), () => ({ patch: openNote(banjoNote({ midi: m, len: null, vel: v }, banjoPatch()), ['echo-lp', 'echo', 'echo-v']), secs: P.banjoSecs }), true);
  }

  // what's asked for: the store first, then the bake, a batch of a length at a time
  async function run() {
    if (running) return; running = true;
    try {
      const d = await db();
      while (queue.length) {
        const first = queue[0]; prepare(first);
        const batch = [];
        for (let i = 0; i < queue.length && batch.length < P.batch; i++) { prepare(queue[i]); if (queue[i].secs === first.secs) batch.push(queue[i]); }
        for (const j of batch) queue.splice(queue.indexOf(j), 1);
        const rest = [];
        const t0 = performance.now(), found = d ? await askedAll(d, batch.map((j) => j.key)) : [];
        for (let i = 0; i < batch.length; i++) {
          const j = batch[i], got = found[i];
          if (got instanceof Float32Array && got.length === Math.round(j.secs * sr)) {
            const buf = new AudioBuffer({ length: got.length, numberOfChannels: 1, sampleRate: sr }); buf.copyToChannel(got, 0);
            done.set(j.name, buf); stats.fromStore++; stats.baked++;
          } else rest.push(j);
        }
        stats.storeMs += performance.now() - t0;
        if (rest.length) await bakeBatch(rest, d);
        await later(P.gap);
      }
      if (d && stats.baked === stats.wanted) for (const j of jobs.values()) if (!pruned.has(j.family)) { pruned.add(j.family); prune(d, j.family); }
    } catch (e) { console.warn('Mathwood Valley: baking the notes stopped; they play live', e); queue.length = 0; }
    running = false;
    if (queue.length) run();
    else if (whenDone) { const w = whenDone; whenDone = null; w.res(); }
  }
  async function bakeBatch(list, d) {
    const n = Math.round(list[0].secs * sr), t0 = performance.now();
    let spent = 0, mark = performance.now();
    const oc = new OfflineAudioContext(list.length, n, sr), merge = oc.createChannelMerger(list.length);
    merge.connect(oc.destination);
    for (let i = 0; i < list.length; i++) {
      const g = oc.createGain(); g.connect(merge, 0, i);
      playPatch(oc, null, g, null, list[i].patch, null, { at: list[i].lead / sr });
      if ((i + 1) % P.buildPerStep === 0) { spent += performance.now() - mark; await later(P.gap); mark = performance.now(); }
    }
    spent += performance.now() - mark;
    const r = await oc.startRendering();
    for (let i = 0; i < list.length; i++) {
      const data = r.getChannelData(i).slice(), buf = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate: sr });
      buf.copyToChannel(data, 0);
      done.set(list[i].name, buf); stats.baked++;
      if (d) asked(d, 'readwrite', (s) => s.put(data, list[i].key));
      await later(2);
    }
    stats.bakeMs += performance.now() - t0; stats.buildMs = (stats.buildMs || 0) + spent;
  }
  // (a family's old notes off the shelf: a patch changed, an old way of baking; the band's keys have no family before them)
  const familyOf = (k) => { const i = String(k).indexOf('|'); return i < 0 ? '' : String(k).slice(0, i); };
  async function prune(d, family) {
    const keep = new Set(); for (const j of jobs.values()) if (j.key) keep.add(j.key);
    const keys = await asked(d, 'readonly', (s) => s.getAllKeys());
    if (!keys) return;
    for (const k of keys) if (familyOf(k) === family && !keep.has(k) && String(k).split(':')[3] === String(sr)) asked(d, 'readwrite', (s) => s.delete(k));
  }

  function play(ctx, buf, head, nodes, at, stopAt, lead = 0) {
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.connect(head);
    src.start(at, lead / sr); if (stopAt != null) src.stop(stopAt);
    src.onended = () => { for (const n of nodes) try { n.disconnect(); } catch (e) { /* gone */ } };
    return src;
  }
  const levels = (ctx, head, note, dest, room) => {
    const out = nodeOf(note, 'out'), send = nodeOf(note, 'send'), o = ctx.createGain(), nodes = [o];
    o.gain.value = out ? out.gain ?? 1 : 1; head.connect(o); o.connect(dest);
    if (send && room) { const s = ctx.createGain(); s.gain.value = send.gain ?? 0; head.connect(s); s.connect(room); nodes.push(s); }
    return nodes;
  };

  const B = {
    get ready() { return stats.wanted > 0 && stats.baked >= stats.wanted; },
    start(song = null) {
      if (!boxAsked) { boxAsked = true; wantBox(); }
      const order = [];
      if (song) {   // (the keys of the song about to play first: a few of its lines, as the dice might make them)
        try {
          const S = songOf(song), next = S.tune(1, { intro: true, fiddle: true });
          for (let i = 0; i < 8; i++) for (const e of next()) if (e.what === 'piano') for (const m of [].concat(e.midi)) if (!order.includes(m)) order.push(m);
        } catch (e) { /* (the rest come anyway) */ }
      }
      for (const m of order) wantPiano(m, true);
      for (const m of P.pianoKeys) wantPiano(m, false);
    },
    whenBaked() {
      if (!running && !queue.length) return Promise.resolve();
      if (!whenDone) { let res; const p = new Promise((r) => { res = r; }); whenDone = { p, res }; }
      return whenDone.p;
    },
    playPiano(ctx, dest, room, note, midi, at, len) {
      const buf = done.get(pianoName(midi));
      if (!buf || ctx.sampleRate !== sr || len + 0.25 + P.tail > P.pianoSecs) {
        if (!buf) wantPiano(midi, true);
        stats.live.piano++;
        return null;
      }
      const a = nodeOf(note, 'damp-a-e'), b = nodeOf(note, 'damp-b-e'), ag = nodeOf(note, 'damp-a-g'), bg = nodeOf(note, 'damp-b-g');
      if (!a || !b || !ag || !bg) { stats.live.piano++; return null; }
      const wa = ag.gain, wb = bg.gain, ta = (a.release ?? 0.3) / 3, tb = (b.release ?? 0.3) / 3;
      const ra = at + (a.attack ?? 0.01) + (a.decay ?? 0.2) + a.hold, rb = at + (b.attack ?? 0.01) + (b.decay ?? 0.2) + b.hold;
      // the damper: both its stages open, then the quick one closing, what's left hanging on, then the tail's own close
      // (the bake has both stages open already: this is the share of that left)
      const damper = ctx.createGain(), g = damper.gain, hang = wb / (wa + wb);
      g.value = 1; g.setValueAtTime(1, at);
      g.setTargetAtTime(hang, ra, Math.max(1e-3, ta));
      g.setTargetAtTime(0, rb, Math.max(1e-3, tb));
      const nodes = [damper, ...levels(ctx, damper, note, dest, room)], end = rb + P.tail;
      const src = play(ctx, buf, damper, nodes, at, Math.min(end, at + P.pianoSecs));
      stats.played.piano++;
      return { stop(fade = 0.02) {   // (as the patch's stop: its damper's two stages let go at once)
        const now = ctx.currentTime;
        try {
          g.cancelScheduledValues(now);
          if (now < at) { src.stop(now); return; }
          // (both stages falling at once, each at its own pace, from wherever the damper is)
          const v = Math.min(1, g.value), n = 48, secs = 0.4, ca = Math.max(fade, ta), cb = Math.max(fade, tb), curve = new Float32Array(n);
          for (let i = 0; i < n; i++) { const t = i / (n - 1) * secs; curve[i] = v * ((1 - hang) * Math.exp(-t / ca) + hang * Math.exp(-t / cb)); }
          curve[n - 1] = 0;
          g.setValueCurveAtTime(curve, now, secs);
          src.stop(now + secs + 0.01);
        } catch (e) { /* gone */ }
      } };
    },
    playBox(ctx, dest, room, ev, note, at) {
      const hit = ev.hit || 'thump', v = hit === 'thump' ? nearest(P.thumpVels, ev.vel ?? 0.8) : 1, t = nearest(P.tones, ev.tone ?? 1);
      const name = boxName(hit, v, t, 0), k = (turn.get(name) || 0) % P.takes;
      turn.set(name, k + 1);
      const buf = done.get(boxName(hit, v, t, k));
      if (!buf || ctx.sampleRate !== sr) { stats.live.box++; return null; }
      const head = ctx.createGain(), nodes = [head, ...levels(ctx, head, note, dest, room)];
      const src = play(ctx, buf, head, nodes, at);
      stats.played.box++;
      return { stop(fade = 0.02) { const now = ctx.currentTime; try { if (now < at) { src.stop(now); return; } head.gain.setTargetAtTime(0, now, fade); src.stop(now + fade * 5 + 0.02); } catch (e) { /* gone */ } } };
    },
    playBanjo(ctx, dest, room, n) {
      const v = nearest(P.banjoVels, n.vel ?? 0.8), buf = done.get(banjoName(n.midi, v));
      wantBanjo(n.midi, v);
      if (!buf || n.len == null || ctx.sampleRate !== sr || n.len + P.tail > P.banjoSecs) { stats.live.banjo++; return null; }
      const note = banjoNote({ ...n, gain: BANJO_SYNTH_LEVEL * (n.gain ?? 1) }, banjoPatch()), de = nodeOf(note, 'damp-e'), at = n.at;
      const rt = at + (de.attack ?? 0.01) + (de.decay ?? 0.2) + de.hold, tc = (de.release ?? 0.1) / 3;
      const damper = ctx.createGain(), g = damper.gain; g.value = 1; g.setValueAtTime(1, at); g.setTargetAtTime(0, rt, tc);
      const nodes = [damper, ...levels(ctx, damper, note, dest, room)], ev = nodeOf(note, 'echo-v'), out = nodeOf(note, 'out');
      if (ev) { const eg = ctx.createGain(); eg.gain.value = ev.gain * (out.gain ?? 1); damper.connect(eg); eg.connect(echoFor(ctx, dest, room, note)); nodes.push(eg); }
      const src = play(ctx, buf, damper, nodes, at, rt + P.tail);
      stats.played.banjo++;
      return { stop(t = 0) { const now = ctx.currentTime, f = Math.max(0.004, t / 3); try { g.cancelScheduledValues(now); if (now < at) { src.stop(now); return; } g.setTargetAtTime(0, now, Math.max(f, tc)); src.stop(now + P.tail); } catch (e) { /* gone */ } } };
    },
    shots(family, list) {
      for (const { name, make } of list) want(family + '/' + name, make, false, family);
    },
    has: (family, name) => done.has(family + '/' + name),
    playShot(ctx, dest, room, family, name, o, at) {
      const job = jobs.get(family + '/' + name), lead = job ? job.lead || 0 : 0;
      const buf = done.get(family + '/' + name), wet = o.wet && room ? done.get(family + '/' + o.wet) : null;
      if (!buf || ctx.sampleRate !== sr || (o.wet && room && !wet)) { stats.live[family] = (stats.live[family] || 0) + 1; return null; }
      const head = ctx.createGain(), g = head.gain, out = ctx.createGain(); out.gain.value = o.gain ?? 1;
      head.connect(out); out.connect(dest);
      const nodes = [head, out];
      let stopAt = null;
      if (o.let) { g.value = 1; g.setValueAtTime(1, at); g.setTargetAtTime(0, o.let.at, o.let.tc); stopAt = Math.min(o.let.at + o.let.tail, at + buf.duration); }
      let w = null;
      if (room && o.send) {
        const s = ctx.createGain(); s.gain.value = o.send; s.connect(room); nodes.push(s);
        if (wet) { w = play(ctx, wet, s, [], at, stopAt); } else head.connect(s);
      }
      const src = play(ctx, buf, head, nodes, at, stopAt, lead);
      stats.played[family] = (stats.played[family] || 0) + 1;
      return { stop(fade = 0.02) {
        const now = ctx.currentTime;
        try {
          if (now < at) { src.stop(now); if (w) w.stop(now); return; }
          g.cancelScheduledValues(now); g.setTargetAtTime(0, now, Math.max(0.002, fade));
          const end = now + Math.max(0.002, fade) * 5 + 0.02;
          src.stop(end); if (w) { nodes[2].gain.setTargetAtTime(0, now, Math.max(0.002, fade)); w.stop(end); }
        } catch (e) { /* gone */ }
      } };
    },
    stats() {
      let bytes = 0; for (const b of done.values()) bytes += b.length * 4;
      return { ...stats, played: { ...stats.played }, live: { ...stats.live }, MB: +(bytes / 1048576).toFixed(2), bakeMs: Math.round(stats.bakeMs), storeMs: Math.round(stats.storeMs), buildMs: Math.round(stats.buildMs || 0) };
    },
  };
  // the banjo's head echo, one for a place the notes go: what each note's own echo would do, added up
  function echoFor(ctx, dest, room, note) {
    let byDest = echoes.get(ctx); if (!byDest) { byDest = new Map(); echoes.set(ctx, byDest); }
    let e = byDest.get(dest);
    if (e) return e;
    const lp = BUILDERS.filter(ctx, nodeOf(note, 'echo-lp'), 0), line = BUILDERS.delay(ctx, nodeOf(note, 'echo'));
    lp.out.connect(line.in); line.out.connect(dest);
    const send = nodeOf(note, 'send'), out = nodeOf(note, 'out');
    if (send && room && out && out.gain) { const s = ctx.createGain(); s.gain.value = send.gain / out.gain; line.out.connect(s); s.connect(room); }
    e = lp.in; byDest.set(dest, e);
    return e;
  }
  return B;
}
