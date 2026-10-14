// THE VOICES: short spoken clips recorded by the game's maker (sounds/voice/<name>.ogg|.m4a, each cut tight, rumble
// taken off below 90 Hz, made about as loud as the town's clips: -18 LUFS, peaks under -3 dBFS). Small and now and
// then, never busy.
//
// THE PLAYER'S OWN SHOUTS (from the rider's head):
//   spurring the horse from a walk or a stand into a gallop     Hyah / Giddy-up / Let's go / Come on, let's go / Hup
//   pulling up from a gallop to a stop                          Whoa
//   a whole job done (a round-up wave, a healed flock, the pigs penned, a wagon gang beaten, a herd's photographs,
//   a delivery)                                                 Yeehaw / Whoohee
//   a job's person says hello                                   Howdy / Howdy partner / How ya do (the first hello of
//                                                               a ride is sometimes Good morning: the game has no time
//                                                               of day)
//   walking away from a job, or "Done for now"                  See ya later / See ya next time
//   a roped steer or a penned pig heading in (rarely)           Get along
//   calming an animal (rarely): walking up to a sick sheep      Easy now
//   with the bottles, setting up the deer camera
//   a bandit roped right (now and then)                         You better sit down (and he answers, below)
// OTHER PEOPLE (the maker's voice too, so only ever the MEN: never Mrs. Haskell, Miss Wren, Ma Hollis, a woman at the
// store counter or a woman riding with the wagon; each from where that person is):
//   a bandit after "you better sit down"                        Alright, alright, you got me
//   an innocent rider roped by mistake ("Not me, partner")      What in tarnation / What are you doin' / Who are you
//   a job person's thank-you after a job, a camp foreman's      Aw, thank ya partner / You're a real life saver /
//   after a delivery (nearly always); a store customer's        (Aw,) much obliged / Thank ya kindly (three) /
//   when an order or a sale is paid (about half the time)       Much obliged, partner
//   a store customer leaving, a job person as you walk away     Ya have a nice day now (now and then)
//   a store customer come to buy the rider's own goods          Whatcha got there
//   (UNUSED for now: mystuff_1, "Is that my stuff?", kept for the "Loot the gang" mission: stolen goods handed back
//   to their owner. It is in VOICE_CLIPS and SHOUTS.unused, in no kind yet, and not loaded.)
//
// Each kind has a chance and a wait before it may come again, any two clips are a few seconds apart (but an answer
// follows its line closely), the same clip never plays twice running, one at a time, and a few may wait their turn
// (the bigger moment first: a job's yeehaw, then the thank-you). Everything goes through the game's master volume, so
// the Menu's Volume, the title's silence and a pause all hold it (audio.js). No switch of its own: the volume covers it.
//
//   const S = makeShouts({ audio, base })   audio: makeAudio(); base: the game's folder URL
//   S.update(dt, { P, I })   each frame of play (P: the player, I: the input): watches the horse for a spur or a pull-up,
//                            and lets out a clip that is due
//   S.heard(event, data)     a Hob event (src/hob.js): the jobs' ends, a catch, a pig penned, "Done for now", a bandit
//                            caught or a rider roped by mistake (data: { at: { x, z }, male }), 'sheepDose', 'deerSetup'
//   S.talk(what, who)        the job folk (src/jobfolk.js): 'hello' (a person greets the player), 'leave' (the toast on
//                            walking away from a job), 'thanks' (a person's thank-you); who: { at, male }
//   S.say(kind, who)         another job's people: 'thanksStore', 'niceday', 'whatchagot' (the store counter)
//                            who: { at: { x, z } or a function returning one, male }
//   S.speaking               true while a clip plays (the town's sounds dip a little under it)
//   S.state()                for rigs: what has played, what is waiting, each kind's moments (said or not)
//   S.dispose()
//   Pure, for tests: SHOUTS, VOICE_CLIPS, makeShoutBrain(rand), pickShout(list, avoid, rand), isMale(look)

// every clip, with a level for the ones that measured a little quieter after their peaks were held down
export const VOICE_CLIPS = {
  hyah_1: 1, hyah_2: 1, hyah_3: 1, hyah_4: 1, hyah_5: 1, hyah_6: 1, hyah_7: 1, hyah_8: 1,
  hyah_x2_1: 1, hyah_x2_2: 1.08, hyah_x2_3: 1, hyah_x2_4: 1, hyah_x2_5: 1.08,
  giddyup_1: 1, giddyup_2: 1, giddyup_3: 1, giddyup_4: 1, giddyup_5: 1, giddyup_6: 1, giddyup_x2_1: 1,
  letsgo_1: 1, letsgo_2: 1.14, letsgo_3: 1.22, letsgo_4: 1.24, letsgo_5: 1, letsgo_x2_1: 1, comeon_letsgo_1: 1,
  hup_1: 1,
  whoa_1: 1, whoa_2: 1, whoa_3: 1, whoa_4: 1, whoa_5: 1, whoa_6: 1, whoa_x2_1: 1, whoa_x2_2: 1,
  yeehaw_1: 1, yeehaw_2: 1, yeehaw_3: 1, yeehaw_4: 1, yeehaw_5: 1, whoohee_1: 1,
  getalong_1: 1, getalong_2: 1, getalong_3: 1, getalong_x2_1: 1.1, getalong_ho_1: 1,
  howdy_1: 1.29, howdy_2: 1.13, howdy_partner_1: 1.25, howyado_1: 1.14,
  goodmorning_1: 1.19, goodmorning_2: 1,
  seeya_later_1: 1.3, seeya_nexttime_1: 1.16,
  // the second batch
  easynow_1: 1, easynow_2: 1, sitdown_1: 1.14, yougotme_1: 1,
  tarnation_1: 1, whatareyoudoin_1: 1, whoareyou_1: 1,
  thankya_partner_1: 1.25, lifesaver_1: 1, obliged_1: 1.1, obliged_2: 1.3, thankya_kindly_1: 1.25, thankya_kindly_2: 1.3,
  thankya_kindly_3: 1.24, obliged_partner_1: 1.27, niceday_1: 1.13, whatchagot_1: 1,
  mystuff_1: 1.3,   // (unused for now: "Loot the gang")
};
const W = (names, w = 1) => names.map((n) => [n, w]);
const range = (pre, n) => Array.from({ length: n }, (_, i) => `${pre}_${i + 1}`);
const THANKS = W(['thankya_partner_1', 'lifesaver_1', 'obliged_1', 'obliged_2', 'thankya_kindly_1', 'thankya_kindly_2', 'thankya_kindly_3', 'obliged_partner_1']);

export const SHOUTS = {
  level: 0.9,             // into the game's master volume
  ref: 6,                 // m: full loudness this near (the camera rides a few metres behind), softer past it
  head: { foot: 1.6, horse: 2.4 },   // m above the ground the player's voice comes from (another person's: `head.foot`)
  rate: [0.98, 1.02],     // a touch faster or slower each time (a voice: only a touch)
  loud: [0.9, 1.05],      // ... and a touch louder or softer
  gap: 3,                 // s at least from the end of one clip to the start of the next (an answer: its own delay)
  most: 3,                // clips waiting their turn at most
  // the horse: a gallop is past `gallop` m/s (a trot tops out at 6, the donkey's gallop is 8); a spur is Shift with a
  // direction pressed while the horse is under `slow` m/s; a pull-up is letting go of the keys from a gallop while it
  // is still going faster than `stopFrom`
  gallop: 7.5, slow: 4.5, stopFrom: 5,
  // each kind: who says it (the player, or a man nearby: 'him'), the chance it is said when it may be, the wait (s, at
  // random between) after one before the next of its kind, how much it matters (prio: the bigger waits in front), how
  // long after the moment it starts (delay) and how long it may wait its turn (wait), a group sharing "not the same
  // clip twice running", and its clips [name, weight] (the doubles "Hyah! Hyah!" a little less often)
  kinds: {
    spur:  { chance: 0.6, cool: [15, 25], prio: 2, delay: 0.05, wait: 1.2, clips: [
      ...W(range('hyah', 8)), ...W(range('hyah_x2', 5), 0.5), ...W(range('giddyup', 6)), ...W(['giddyup_x2_1'], 0.5),
      ...W(range('letsgo', 5)), ...W(['letsgo_x2_1', 'comeon_letsgo_1'], 0.5), ...W(['hup_1'])] },
    whoa:  { chance: 0.7, cool: [12, 20], prio: 2, delay: 0.05, wait: 1.2, clips: [...W(range('whoa', 6)), ...W(range('whoa_x2', 2), 0.5)] },
    done:  { chance: 1, cool: [10, 10], prio: 3, delay: 0.5, wait: 8, clips: [...W(range('yeehaw', 5)), ...W(['whoohee_1'])] },
    hello: { chance: 0.75, cool: [20, 35], prio: 2, delay: 0.8, wait: 3, clips: W(['howdy_1', 'howdy_2', 'howdy_partner_1', 'howyado_1']) },
    bye:   { chance: 0.7, cool: [25, 40], prio: 2, delay: 0.3, wait: 3, clips: W(['seeya_later_1', 'seeya_nexttime_1']) },
    along: { chance: 0.18, cool: [45, 90], prio: 1, delay: 0.5, wait: 1.5, clips: [...W(['getalong_1', 'getalong_2', 'getalong_3']), ...W(['getalong_x2_1', 'getalong_ho_1'], 0.5)] },
    easy:  { chance: 0.3, cool: [60, 120], prio: 1, delay: 0.3, wait: 2, clips: W(['easynow_1', 'easynow_2']) },
    sitdown: { chance: 0.5, cool: [30, 60], prio: 2, delay: 1.2, wait: 3, clips: W(['sitdown_1']) },
    // other people (men only)
    gotme: { him: true, chance: 1, cool: [0, 0], prio: 2, delay: 0.35, wait: 3, clips: W(['yougotme_1']) },
    huh:   { him: true, chance: 0.6, cool: [12, 25], prio: 2, delay: 0.4, wait: 2, clips: W(['tarnation_1', 'whatareyoudoin_1', 'whoareyou_1']) },
    thanks: { him: true, chance: 0.9, cool: [6, 6], prio: 2, delay: 0.2, wait: 8, group: 'thanks', clips: THANKS },
    thanksStore: { him: true, chance: 0.5, cool: [25, 45], prio: 2, delay: 0.2, wait: 3, group: 'thanks', clips: THANKS },
    niceday: { him: true, chance: 0.35, cool: [60, 120], prio: 1, delay: 0.4, wait: 5, clips: W(['niceday_1']) },
    whatchagot: { him: true, chance: 0.6, cool: [60, 90], prio: 2, delay: 0.6, wait: 3, clips: W(['whatchagot_1']) },
  },
  morning: { chance: 0.5, clips: W(['goodmorning_1', 'goodmorning_2']) },   // the first hello of a ride, sometimes
  // the Hob events that are each kind's moment (banditCatch and banditMiss: below, they need the rider)
  events: {
    waveDone: 'done', flockDone: 'done', pigsDone: 'done', banditsDone: 'done', deerDone: 'done', deliveryDone: 'done',
    catch: 'along', pigPenned: 'along', wagonStop: 'bye', deerStop: 'bye', sheepDose: 'easy', deerSetup: 'easy',
  },
  unused: ['mystuff_1'],   // recorded for later ("Loot the gang"): in no kind yet
};

// a man, by his folk.js look (the outfits end _m or _f)
export const isMale = (look) => !!(look && /_m$/.test(look.outfit || ''));

// a clip from [name, weight]: never one in `avoid` (unless nothing else is left)
export function pickShout(list, avoid = [], rand = Math.random) {
  const ok = list.filter(([n, w]) => w > 0 && !avoid.includes(n));
  const from = ok.length ? ok : list.filter(([, w]) => w > 0);
  if (!from.length) return null;
  let r = rand() * from.reduce((a, [, w]) => a + w, 0);
  for (const [n, w] of from) { r -= w; if (r < 0) return n; }
  return from[from.length - 1][0];
}

// THE DECIDING, without sound (the tests drive it with their own clock and dice):
//   B.ask(kind, now, { who, then, sure })   the moment for a kind: true if it will be said (its chance came up, its
//                         wait is over, it isn't waiting already). who: the man saying it ({ male, at }; a 'him' kind
//                         without a man is never said); then: { kind, who, sure } said right after this one; sure: no dice
//   B.ride(now, { onHorse, speed, push, run })   the horse each frame: asks for a spur or a whoa when one happens
//   B.next(now, busy)       the clip to start now, or null: { kind, name, who }; busy: one is still playing
//   B.ended(now)            the clip playing has just ended (its answer, if any, is asked for now)
//   B.queue, B.last, B.lastOf, B.coolUntil, B.moments (how many times each kind's moment came, said or not)
export function makeShoutBrain(rand = Math.random, S = SHOUTS) {
  const B = { queue: [], last: null, lastOf: {}, coolUntil: {}, greeted: false, endedAt: -1e9, wantG: false, galloped: false, moments: {}, follow: null };
  B.rand = rand;   // (a rig may set it: dice that always say yes)
  const between = ([a, b]) => a + B.rand() * (b - a);
  B.ask = (kind, now, { who = null, then = null, sure = false, answer = false } = {}) => {
    const K = S.kinds[kind]; if (!K) return false;
    B.moments[kind] = (B.moments[kind] || 0) + 1;
    if (K.him && !(who && who.male)) return false;   // (the maker's voice: only a man says it)
    if (now < (B.coolUntil[kind] ?? -1e9)) return false;
    if (B.queue.some((q) => q.kind === kind) || B.queue.length >= S.most) return false;
    if (!sure && B.rand() >= K.chance) return false;
    const at = now + (K.delay || 0);
    B.queue.push({ kind, at, until: at + K.wait, prio: K.prio, who, then, answer });
    B.queue.sort((a, b) => b.prio - a.prio || (b.answer - a.answer));   // (the bigger moment in front; an answer first)
    return true;
  };
  B.ride = (now, { onHorse = false, speed = 0, push = false, run = false } = {}) => {
    if (!onHorse) { B.wantG = false; B.galloped = false; return; }
    const wantG = push && run;
    if (wantG && !B.wantG && speed < S.slow) B.ask('spur', now);   // (Shift and a direction, from a walk or a stand)
    B.wantG = wantG;
    if (speed >= S.gallop && push) B.galloped = true;   // (galloping because the rider asks: not still slowing from one)
    if (B.galloped && !push && speed > S.stopFrom) { B.galloped = false; B.ask('whoa', now); }   // (let go at a gallop: pulling up)
    else if (B.galloped && speed < S.stopFrom) B.galloped = false;   // (slowed some other way: no whoa)
  };
  B.next = (now, busy = false) => {
    B.queue = B.queue.filter((q) => now <= q.until);
    if (busy) return null;
    const q = B.queue.find((x) => now >= x.at && (x.answer || now - B.endedAt >= S.gap));
    if (!q) return null;
    B.queue.splice(B.queue.indexOf(q), 1);
    const K = S.kinds[q.kind], group = K.group || q.kind;
    let list = K.clips;
    if (q.kind === 'hello' && !B.greeted && S.morning && B.rand() < S.morning.chance) list = S.morning.clips;
    if (q.kind === 'hello') B.greeted = true;
    const name = pickShout(list, [B.last, B.lastOf[group]].filter(Boolean), B.rand);
    if (!name) return null;
    B.last = name; B.lastOf[group] = name;
    B.coolUntil[q.kind] = now + between(K.cool);
    B.follow = q.then;
    B.endedAt = 1e9;   // (playing: the gap counts from its end)
    return { kind: q.kind, name, who: q.who };
  };
  B.ended = (now) => {
    B.endedAt = now;
    const f = B.follow; B.follow = null;
    if (f) B.ask(f.kind, now, { who: f.who, sure: f.sure, answer: true });
  };
  return B;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const GAME = new URL('../../', import.meta.url).href;     // (src/audio/ -> the game's folder)
function clipExt() {
  try { const el = document.createElement('audio'); if (/^(probably|maybe)$/.test(el.canPlayType('audio/ogg; codecs="vorbis"'))) return '.ogg'; } catch (e) { /* no audio element */ }
  return '.m4a';
}

export function makeShouts({ audio, base = GAME }) {
  const B = makeShoutBrain();
  let ctx = null, bus = null, alive = true, clock = 0, now = null, nowWho = null, panner = null, src = null, me = null;
  const buffers = {}, played = {}; let asked = 0;
  const S = { speaking: false };
  function build() {
    if (ctx || !audio.ctx) return;
    ctx = audio.ctx;
    bus = ctx.createGain(); bus.gain.value = SHOUTS.level; bus.connect(audio.out);
    const ext = clipExt(); let b = String(base); if (!b.endsWith('/')) b += '/';
    const c = ctx;
    for (const name of Object.keys(VOICE_CLIPS)) {
      if (SHOUTS.unused.includes(name)) continue;   // (kept for later: not fetched)
      fetch(b + 'sounds/voice/' + name + ext).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.url); return r.arrayBuffer(); })
        .then((ab) => (alive ? c.decodeAudioData(ab) : null)).then((buf) => { if (alive && buf) buffers[name] = buf; })
        .catch((e) => { if (alive) console.warn('shouts: a clip could not load', name, e && e.message); });
    }
  }
  audio.ready(() => { if (alive) build(); });

  // where a voice is: the player's head, or the man saying it (his spot, at a standing man's head height)
  const where = (who) => {
    if (!who || !who.at) return me;
    const a = typeof who.at === 'function' ? who.at() : who.at;
    if (!a) return me;
    return { x: a.x, y: a.y ?? (me ? me.ground + SHOUTS.head.foot : SHOUTS.head.foot), z: a.z };
  };
  const place = (p) => { if (!panner || !p) return; if (panner.positionX) { panner.positionX.value = p.x; panner.positionY.value = p.y; panner.positionZ.value = p.z; } else panner.setPosition(p.x, p.y, p.z); };
  function play(name, who) {
    const at = where(who);
    if (!ctx || !audio.running || !buffers[name] || !at) { B.ended(clock); return false; }
    panner = ctx.createPanner(); panner.panningModel = 'equalpower'; panner.distanceModel = 'inverse';
    panner.refDistance = SHOUTS.ref; panner.rolloffFactor = 1; panner.maxDistance = 10000;
    place(at); panner.connect(bus);
    const s = src = ctx.createBufferSource(); s.buffer = buffers[name];
    s.playbackRate.value = rnd(SHOUTS.rate[0], SHOUTS.rate[1]);
    const g = ctx.createGain(); g.gain.value = VOICE_CLIPS[name] * rnd(SHOUTS.loud[0], SHOUTS.loud[1]);
    const p = panner;
    s.connect(g).connect(p);
    s.onended = () => { try { s.disconnect(); g.disconnect(); p.disconnect(); } catch (e) { /* gone */ } if (src === s) { src = null; panner = null; S.speaking = false; nowWho = null; B.ended(clock); } };
    s.start(ctx.currentTime + 0.01);
    S.speaking = true; now = name; nowWho = who; played[name] = (played[name] || 0) + 1;
    return true;
  }

  S.update = (dt, { P = null, I = null } = {}) => {
    if (!alive || !P) return;
    audio.need('shouts', true);
    clock += dt;
    const pos = P.position;
    me = { x: pos.x, y: pos.y + (P.onHorse ? SHOUTS.head.horse : SHOUTS.head.foot), z: pos.z, ground: pos.y };
    if (S.speaking) place(where(nowWho));   // (the voice goes with whoever is talking)
    const push = !!(I && I.enabled !== false && I.move && I.move.mag >= 0.08);
    B.ride(clock, { onHorse: !!P.onHorse, speed: P.speed || 0, push, run: !!(I && I.run) });
    const n = B.next(clock, S.speaking);
    if (n) play(n.name, n.who);
  };
  const ask = (kind, o) => { if (alive && B.ask(kind, clock, o)) asked++; };
  const him = (d) => (d && d.at ? { at: d.at, male: !!d.male } : null);
  S.heard = (event, data) => {
    if (event === 'banditCatch') { const w = him(data); ask('sitdown', { then: w && w.male ? { kind: 'gotme', who: w, sure: true } : null }); return; }
    if (event === 'banditMiss') { ask('huh', { who: him(data) }); return; }
    const k = SHOUTS.events[event]; if (k) ask(k);
  };
  S.talk = (what, who = null) => {
    const w = him(who);
    if (what === 'hello') ask('hello');
    else if (what === 'thanks') ask('thanks', { who: w });
    else if (what === 'leave') {
      // the player's see-ya, and the person's "have a nice day" after it now and then (or on its own)
      const nice = w && w.male && B.rand() < SHOUTS.kinds.niceday.chance ? { kind: 'niceday', who: w, sure: true } : null;
      const before = asked; ask('bye', { then: nice });
      if (asked === before && nice) ask('niceday', { who: w, sure: true });
    }
  };
  S.say = (kind, who = null) => { if (SHOUTS.kinds[kind] && SHOUTS.kinds[kind].him) ask(kind, { who: him(who) }); };
  S.brain = B;   // (for rigs)
  S.state = () => ({ on: !!ctx, loaded: Object.keys(buffers).length, clips: Object.keys(VOICE_CLIPS).length - SHOUTS.unused.length, speaking: S.speaking, now, asked,
    queue: B.queue.map((q) => ({ kind: q.kind, at: q.at, until: q.until })), moments: { ...B.moments }, played: { ...played }, clock });
  S.dispose = () => {
    alive = false;
    try { if (src) src.stop(); } catch (e) { /* gone */ }
    try { if (bus) bus.disconnect(); } catch (e) { /* gone */ }
    audio.need('shouts', false);
  };
  return S;
}
