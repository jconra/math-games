// READ-ALOUD: the youngest topics' cards (Counting, Adding, Taking away) read out in a real voice, recorded by the
// game's maker (sounds/read/<clip>.ogg|.m4a). A card's `say` line ("what comes after 7", "9 cows, 4 run off") is put
// together from short clips: each number, the tens and ones that make 21 to 99, and the card's words. A line that can't
// be put together from the clips is not read at all (never a robot voice mixed in with a person's).
//
// HOW A NUMBER IS SAID
//   0 to 20, 30, 40 ... 90, 100   one clip each (said on their own)
//   21 to 99                      the tens as said leading into a ones word ("thirty-") and the ones as said after a
//                                 tens word ("-four"), cut from his compounds and joined with a short crossfade
//   101 to 109                    "one hundred" (said leading on) + "and" + the ones word said on its own (the ones
//                                 cut from the compounds read less clearly after "and": "and four" as "and war")
// HOW A LINE IS SAID
//   the card's words come from his sample lines with the number cut off the end ("what comes after|", "one more than|":
//   said leading into a number), or from a take of the words on their own where that measured better (see PHRASES),
//   with a short natural gap between words, a longer one at a comma, and "counting by fives" always followed by
//   "what comes next?".
// REACTIONS (only with read-aloud on, only in these three topics): "That's right!" on about one right answer in three
//   (never twice running), "Not that one." on a wrong pick, "Count 'em again." on a wrong count of dots. A reaction is
//   never said over a card being read, and a card dealt with a reaction is read once the reaction is done.
//
// It goes through the game's sound (src/audio/audio.js): the master volume, the title's silence, a pause, the iPhone
// unlock on the first touch. A clip is fetched the first time a line needs it (then kept). The other voices (the
// player's shouts) wait while a card is read, and a card waits for a shout to finish.
//
//   const R = makeReadAloud({ audio, base, on: () => bool, busy: () => bool })
//     on: is read-aloud switched on for this rider (rider.readAloud); busy: another voice is talking (the shouts)
//   R.can(topic)             read-aloud is on, and this topic's cards are read
//   R.say(text, { topic })   read a card's line now (a line being read is cut short); topic: the card's topic (only
//                            READ.topics are read). -> true if the line can be read from the clips
//   R.react(kind, { topic }) 'right' | 'wrong' | 'recount' after an answer (see above)
//   R.preload(lines, { topic }) fetch the clips a wave's lines (and the reactions) need, before they are read
//   R.stop()                 stop talking
//   R.update(dt)             each frame (starts a line waiting on a busy voice or on its clips; a reaction goes first,
//                            then the card dealt with it)
//   R.speaking               true while a line or a reaction is being said (and while one waits to start)
//   R.state()                for rigs: { loaded, fetched, said: [{ text, clips }], ahead: [lines preloaded], now, misses,
//                            played }
//   R.dispose()
//   Pure, for tests and the sample: READ, READ_CLIPS, READ_EDGES, PHRASES, numberParts(n), compose(text),
//   timeline(parts, dur, edge), clipEdge(clip),
//   makeReactions(rand)

import { clipExt } from './ambience.js';

export const READ = {
  topics: ['counting', 'adding', 'taking'],   // the topics whose cards are read
  level: 1,          // into the game's master volume (the clips sit at -18 LUFS, as the town's do)
  // the quiet heard between two words, from where one word's sound ends to where the next one's begins (each clip's
  // own quiet edges, READ_EDGES, are allowed for)
  gap: 0.095,        // s of quiet between two words
  lead: 0.07,        // ... after a phrase cut where its number began (it leads straight into the number)
  comma: 0.29,       // ... at a comma ("9 cows, 4 run off")
  then: 0.33,        // ... between "counting by fives" and "what comes next?"
  hundred: 0.03,     // ... between "one hundred" and "and", and between "and" and the ones
  xfade: 0.01,       // s the tens and the ones overlap ("thirty" + "four")
  stop: 0.03,        // ... but "two" begins with a t, which needs its moment of quiet ("forty-two", not "forty-tee-two")
  wait: 3,           // s a line waits for another voice before it gives up (once its clips are in)
  load: 12,          // s a line waits for its clips to come in before it gives up (a slow connection)
  start: 0.04,       // s from asking to the first sound (room to schedule it cleanly)
  right: 1 / 3,      // the chance of "That's right!" on a right answer (never twice running)
};

// Every clip in sounds/read/, with its length in seconds as it was cut. A line is timed from these, not from the
// decoded sound's length: a decoder may add a few ms of silence at the end (Chrome's .ogg: up to about 20 ms), which
// would stretch the gaps and undo the tens-and-ones crossfade.
export const READ_CLIPS = {
  n0: 0.812, n1: 0.482, n2: 0.432, n3: 0.432, n4: 0.427, n5: 0.397, n6: 0.577, n7: 0.567, n8: 0.402, n9: 0.487,
  n10: 0.472, n11: 0.592, n12: 0.597, n13: 0.707, n14: 0.762, n15: 0.722, n16: 0.812, n17: 0.832, n18: 0.772,
  n19: 0.732, n20: 0.537, n30: 0.487, n40: 0.542, n50: 0.562, n60: 0.712, n70: 0.697, n80: 0.442, n90: 0.607,
  n100: 0.847, x20: 0.557, x30: 0.450, x40: 0.507, x50: 0.507, x60: 0.662, x70: 0.642, x80: 0.417, x90: 0.587,
  x100: 0.822, o1: 0.415, o2: 0.370, o3: 0.465, o4: 0.417, o5: 0.525, o6: 0.545, o7: 0.625, o8: 0.225, o9: 0.632,
  and: 0.242, plus: 0.627, minus: 0.712, dots: 1.212, by2: 1.352, by5: 1.482, by10: 1.412, next: 1.157, right: 0.747,
  notthat: 1.002, again: 1.087, after: 1.267, before: 1.452, onemore: 1.072, oneless: 1.342, tenmore: 1.062,
  tenless: 1.617, takeaway: 0.758, takeawaywhatleaves: 1.792, andwhatmake: 1.050, cows: 0.632, runoff: 0.720,
};

// Each clip's quiet edges as [start, end] in seconds: how long before its sound begins, and how long after its sound
// ends (5 ms frames over the clip's loudest less 40 dB, and never under -50 dBFS; the larger of the .ogg and the
// .m4a). The gap between two words is measured from sound to sound.
export const READ_EDGES = {
  n0: [0.015, 0.032], n1: [0.02, 0.032], n2: [0.015, 0.027], n3: [0.02, 0.022], n4: [0.015, 0.022],
  n5: [0.02, 0.032], n6: [0.005, 0.007], n7: [0.005, 0.017], n8: [0.02, 0.037], n9: [0.015, 0.032],
  n10: [0.005, 0.017], n11: [0.015, 0.027], n12: [0.015, 0.027], n13: [0.015, 0.012], n14: [0.01, 0.017],
  n15: [0.005, 0.012], n16: [0.005, 0.007], n17: [0.005, 0.022], n18: [0.005, 0.022], n19: [0, 0.007],
  n20: [0.01, 0.012], n30: [0.025, 0.027], n40: [0.02, 0.022], n50: [0, 0.012], n60: [0.005, 0.012],
  n70: [0.01, 0.022], n80: [0.02, 0.027], n90: [0.015, 0.017], n100: [0.015, 0.027], x20: [0.015, 0.007],
  x30: [0, 0.005], x40: [0.015, 0.007], x50: [0.005, 0.012], x60: [0.005, 0.007], x70: [0.015, 0.007],
  x80: [0.02, 0.007], x90: [0.015, 0.007], x100: [0.015, 0.012], o1: [0, 0.01], o2: [0.005, 0.02],
  o3: [0.005, 0.015], o4: [0.01, 0.012], o5: [0.005, 0.015], o6: [0, 0.01], o7: [0, 0.015], o8: [0.005, 0.025],
  o9: [0.01, 0.022], and: [0.015, 0.007], plus: [0.02, 0.012], minus: [0.015, 0.022], dots: [0.015, 0.027],
  by2: [0.015, 0.022], by5: [0.015, 0.017], by10: [0.02, 0.022], next: [0.015, 0.022], right: [0.02, 0.027],
  notthat: [0.015, 0.017], again: [0.02, 0.032], after: [0.01, 0.012], before: [0.005, 0.022],
  onemore: [0.02, 0.007], oneless: [0.015, 0.022], tenmore: [0.02, 0.007], tenless: [0.015, 0.007],
  takeaway: [0.005, 0.008], takeawaywhatleaves: [0.02, 0.027], andwhatmake: [0, 0.015], cows: [0.015, 0.027],
  runoff: [0.015, 0.015],
};

// The words a line can hold, as the clips that say them. lead: the clip was cut where a number began, so it goes
// straight on into the number (READ.lead, not READ.gap). then: more clips after it, after READ.then.
// (Each phrase's clip was picked by measuring both cuts, the one from a sample line and the one said alone: the level
// and pitch where it meets the number, and the speech-to-text reading of the joined line. The other cut isn't shipped.)
export const PHRASES = [
  { words: 'how many dots', clip: 'dots' },
  { words: 'what comes after', clip: 'after', lead: true },
  { words: 'what comes before', clip: 'before', lead: true },
  { words: 'one more than', clip: 'onemore', lead: true },
  { words: 'one less than', clip: 'oneless', lead: true },
  { words: 'ten more than', clip: 'tenmore', lead: true },
  { words: 'ten less than', clip: 'tenless', lead: true },
  { words: 'counting by 2s', clip: 'by2', then: ['next'] },
  { words: 'counting by twos', clip: 'by2', then: ['next'] },
  { words: 'counting by 5s', clip: 'by5', then: ['next'] },
  { words: 'counting by fives', clip: 'by5', then: ['next'] },
  { words: 'counting by 10s', clip: 'by10', then: ['next'] },
  { words: 'counting by tens', clip: 'by10', then: ['next'] },
  { words: 'what comes next', clip: 'next' },
  { words: 'take away what leaves', clip: 'takeawaywhatleaves' },   // (the take said alone measured closer here)
  { words: 'and what make', clip: 'andwhatmake', lead: true },
  { words: 'take away', clip: 'takeaway', lead: true },
  { words: 'plus', clip: 'plus' },
  { words: 'minus', clip: 'minus' },
  { words: 'cows', clip: 'cows' },
  { words: 'run off', clip: 'runoff' },
  { words: "that's right", clip: 'right' },
  { words: 'not that one', clip: 'notthat' },
  { words: "count 'em again", clip: 'again' },
].map((p) => ({ ...p, toks: p.words.split(' ') }));

// A number as clips: [{ clip, gap }] (gap: s of quiet before it; negative: an overlap), or null past what was recorded
export function numberParts(n) {
  if (!Number.isInteger(n) || n < 0 || n > 109) return null;
  if (n <= 20 || (n < 100 && n % 10 === 0) || n === 100) return [{ clip: `n${n}`, gap: 0 }];
  if (n < 100) return [{ clip: `x${n - (n % 10)}`, gap: 0 }, { clip: `o${n % 10}`, gap: n % 10 === 2 ? READ.stop : -READ.xfade }];
  return [{ clip: 'x100', gap: 0 }, { clip: 'and', gap: READ.hundred }, { clip: `n${n - 100}`, gap: READ.hundred }];
}

// A line as clips: -> { parts: [{ clip, gap }], clips: ['n9', 'cows', ...] } or null if any word has no clip
export function compose(text) {
  const toks = String(text || '').toLowerCase().replace(/[’]/g, "'").replace(/,/g, ' , ').replace(/[?!.;:]/g, ' ')
    .split(/\s+/).filter(Boolean);
  if (!toks.length) return null;
  const parts = [];
  let pause = 0, lead = false;   // (the quiet owed before the next clip: a comma's, a lead-in's)
  const push = (list) => {
    list.forEach((p, i) => {
      const word = !i && !!parts.length;   // (a new word: its gap is heard from sound to sound)
      const gap = i ? p.gap : !parts.length ? 0 : Math.max(pause, lead ? READ.lead : READ.gap);
      parts.push(word ? { clip: p.clip, gap, word } : { clip: p.clip, gap });
    });
    pause = 0; lead = false;
  };
  for (let i = 0; i < toks.length;) {
    const t = toks[i];
    if (t === ',') { pause = READ.comma; i++; continue; }
    if (/^\d+$/.test(t)) {
      const n = numberParts(+t); if (!n) return null;
      push(n); i++; continue;
    }
    const ph = PHRASES.filter((p) => p.toks.every((w, k) => toks[i + k] === w)).sort((a, b) => b.toks.length - a.toks.length)[0];
    if (!ph) return null;
    push([{ clip: ph.clip, gap: 0 }]);
    if (ph.then) for (const c of ph.then) { pause = READ.then; push([{ clip: c, gap: 0 }]); }
    lead = !!ph.lead;
    i += ph.toks.length;
  }
  return parts.length ? { parts, clips: parts.map((p) => p.clip) } : null;
}

// When each clip starts (s from the line's start), given each clip's length and its quiet edges ([start, end] s, as
// READ_EDGES): -> { at: [s...], end }. A new word's gap runs from where the last word's sound ends to where its own
// begins; the joins inside a number (the crossfade, "one hundred and") are timed from the clips' cut ends.
export function timeline(parts, dur, edge = () => [0, 0]) {
  const at = []; let t = 0;
  parts.forEach((p, i) => {
    if (i) t += p.word ? p.gap - edge(parts[i - 1].clip)[1] - edge(p.clip)[0] : p.gap;
    at.push(Math.max(i ? at[i - 1] : 0, t)); t = at[i] + dur(p.clip);
  });
  return { at, end: t };
}
export const clipEdge = (c) => READ_EDGES[c] || [0, 0];

// "That's right!" on about one right answer in three, never two running; the wrong answers always get theirs.
//   const B = makeReactions(rand); B.pick('right' | 'wrong' | 'recount') -> a clip name or null
export function makeReactions(rand = Math.random) {
  let lastRight = false;
  return {
    pick(kind) {
      if (kind === 'right') {
        const say = !lastRight && rand() < READ.right;
        lastRight = say;
        return say ? 'right' : null;
      }
      lastRight = false;
      return kind === 'recount' ? 'again' : kind === 'wrong' ? 'notthat' : null;
    },
  };
}

const GAME = new URL('../../', import.meta.url).href;     // (src/audio/ -> the game's folder)
const ALT = { '.ogg': '.m4a', '.m4a': '.ogg' };            // (the other format, tried once if a clip won't load)
const audioType = (n) => { const el = document.createElement('audio'); return el.canPlayType(n); };

export function makeReadAloud({ audio, base = GAME, on = () => true, busy = () => false, rand = Math.random, canPlay = audioType }) {
  let alive = true, bus = null, ext = null, playing = null, clock = 0;
  // the lines waiting to be said, in order: at most a reaction and then a card ("That's right!" and then the next
  // card, which is dealt the moment the answer lands)
  let jobs = [];
  const buffers = {}, loading = {}, played = {}, said = [], ahead = [];
  let misses = 0, fetched = 0;
  const B = makeReactions(rand);
  const R = { get speaking() { return !!(jobs.length || playing); } };
  let root = String(base); if (!root.endsWith('/')) root += '/';
  function ready() {
    if (bus || !audio.ctx) return !!bus;
    bus = audio.ctx.createGain(); bus.gain.value = READ.level; bus.connect(audio.out);
    ext = clipExt(canPlay);
    return true;
  }
  // a clip's sound, fetched once (a failed fetch may be tried again by a later line). If it won't fetch or decode
  // in the format this browser said it plays, the other format is tried once.
  function fetchAs(name, e) {
    const c = audio.ctx; fetched++;
    return fetch(root + 'sounds/read/' + name + e).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.url); return r.arrayBuffer(); })
      .then((ab) => new Promise((ok, no) => c.decodeAudioData(ab, ok, (err) => no(err || new Error('could not decode ' + name + e)))));
  }
  function load(name) {
    if (buffers[name]) return Promise.resolve(buffers[name]);
    if (loading[name]) return loading[name];
    loading[name] = fetchAs(name, ext).catch(() => fetchAs(name, ALT[ext]))
      .then((buf) => { buffers[name] = buf; delete loading[name]; return buf; })
      .catch((e) => { delete loading[name]; if (alive) console.warn('read-aloud: a clip could not load', name, e && e.message); throw e; });
    return loading[name];
  }
  // a line (or a reaction) to say: its clips load, then it waits for the other voices, then it plays
  function queue(text, parts, kind) {
    if (!ready()) return false;
    const j = { text, parts, kind, asked: clock, readyAt: -1, dead: false };
    Promise.all([...new Set(parts.map((p) => p.clip))].map(load)).then(() => { j.readyAt = clock; R.update(0); }, () => { j.dead = true; });
    if (kind === 'card') jobs = jobs.filter((x) => x.kind !== 'card').concat(j);   // (a newer card replaces a waiting one)
    else jobs = [j].concat(jobs.filter((x) => x.kind === 'card'));                // (a reaction goes before a waiting card)
    return true;
  }
  function start(j) {
    const ctx = audio.ctx, t0 = ctx.currentTime + READ.start;
    const { at, end } = timeline(j.parts, (c) => READ_CLIPS[c] || buffers[c].duration, clipEdge);
    const g = ctx.createGain(); g.gain.value = 1; g.connect(bus);
    const srcs = j.parts.map((p, i) => {
      const s = ctx.createBufferSource(); s.buffer = buffers[p.clip];
      s.connect(g); s.start(t0 + at[i]);
      played[p.clip] = (played[p.clip] || 0) + 1;
      return s;
    });
    const p = { text: j.text, kind: j.kind, g, srcs, until: t0 + end };
    srcs[srcs.length - 1].onended = () => { if (playing === p) { playing = null; try { g.disconnect(); } catch (e) { /* gone */ } } };
    playing = p;
    said.push({ text: j.text, kind: j.kind, clips: j.parts.map((x) => x.clip), at: ctx.currentTime });
    if (said.length > 40) said.shift();
  }
  function cut() {
    const p = playing; playing = null;
    if (!p) return;
    const ctx = audio.ctx, t = ctx.currentTime;
    try { p.g.gain.setTargetAtTime(0, t, 0.015); for (const s of p.srcs) s.stop(t + 0.08); } catch (e) { /* already stopped */ }
    setTimeout(() => { try { p.g.disconnect(); } catch (e) { /* gone */ } }, 200);
  }
  const reading = () => jobs.some((j) => j.kind === 'card') || !!(playing && playing.kind === 'card');

  R.can = (topic) => !!(alive && on() && READ.topics.includes(topic));
  R.say = (text, { topic = null } = {}) => {
    if (!alive || !on() || (topic && !READ.topics.includes(topic))) return false;
    const c = compose(text);
    if (!c) { misses++; return false; }
    if (playing && playing.kind === 'card') cut();   // (a new card: the old line stops; a reaction is let finish)
    return queue(text, c.parts, 'card');
  };
  R.react = (kind, { topic = null } = {}) => {
    if (!alive || !on() || (topic && !READ.topics.includes(topic))) return false;
    if (reading()) return false;                     // (never over a card being read, or one waiting to be)
    const clip = B.pick(kind);
    if (!clip) return false;
    cut();
    return queue(kind, [{ clip, gap: 0 }], 'react');
  };
  // fetch a wave's clips before its cards are read (a slow connection then has the whole first card's time), and
  // the reactions'. Lines it can't say are skipped.
  R.preload = (lines, { topic = null } = {}) => {
    if (!alive || !on() || (topic && !READ.topics.includes(topic)) || !ready()) return 0;
    const need = new Set(['right', 'notthat', 'again']);
    for (const t of lines || []) { const c = compose(t); if (c) { c.clips.forEach((x) => need.add(x)); ahead.push(t); } }
    if (ahead.length > 40) ahead.splice(0, ahead.length - 40);
    for (const n of need) load(n).catch(() => null);
    return need.size;
  };
  R.stop = () => { jobs = []; cut(); };
  R.update = (dt = 0) => {
    clock += dt;
    if (!alive || !jobs.length) return;
    if (!on()) { jobs = []; return; }
    // a line gives up if its clips haven't come in READ.load s, or once in, it has waited READ.wait s for another voice
    jobs = jobs.filter((j) => !j.dead && (j.readyAt < 0 ? clock - j.asked <= READ.load : clock - j.readyAt <= READ.wait));
    const j = jobs[0];
    if (!j || j.readyAt < 0 || !audio.running) return;
    if (busy()) return;                                            // (another voice: wait for it)
    if (playing && playing.kind === 'react' && audio.ctx.currentTime < playing.until) return;   // (a card waits for a reaction)
    jobs.shift();
    start(j);
  };
  R.state = () => ({ on: !!on(), loaded: Object.keys(buffers).length, fetched, waiting: jobs.length ? jobs.map((j) => j.text).join(' | ') : null,
    now: playing ? playing.text : null, misses, said: said.slice(), ahead: ahead.slice(), played: { ...played } });
  R.dispose = () => { alive = false; jobs = []; cut(); try { if (bus) bus.disconnect(); } catch (e) { /* gone */ } };
  return R;
}
