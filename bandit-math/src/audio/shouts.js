// THE PLAYER'S OWN VOICE: short cowboy shouts, recorded by the game's maker (sounds/voice/<name>.ogg|.m4a, each cut
// tight, rumble taken off below 90 Hz, made about as loud as the town's clips: -18 LUFS, peaks under -3 dBFS). Small and
// now and then, never busy:
//   spurring the horse from a walk or a stand into a gallop     Hyah / Giddy-up / Let's go / Come on, let's go / Hup
//   pulling up from a gallop to a stop                          Whoa
//   a whole job done (a round-up wave, a healed flock, the pigs penned, a wagon gang beaten, a herd's photographs,
//   a delivery)                                                 Yeehaw / Whoohee
//   a job's person says hello                                   Howdy / Howdy partner / How ya do (the first hello of
//                                                               a ride is sometimes Good morning: the game has no time
//                                                               of day)
//   walking away from a job, or "Done for now"                  See ya later / See ya next time
//   a roped steer or a penned pig heading in (rarely)           Get along
// Each kind has a chance and a wait before it may come again, any two shouts are a few seconds apart, the same clip
// never plays twice running, and one shout at a time. A shout comes from the player (a PannerNode at the rider's head,
// following them while it plays) through the game's master volume, so the Menu's Volume, the title's silence and a
// pause all hold it (audio.js). No switch of its own: the volume covers it.
//
//   const S = makeShouts({ audio, base })   audio: makeAudio(); base: the game's folder URL
//   S.update(dt, { P, I })   each frame of play (P: the player, I: the input): watches the horse for a spur or a pull-up,
//                            and lets out a shout that is due
//   S.heard(event, data)     a Hob event (src/hob.js): the jobs' ends, a catch, a pig penned, "Done for now"
//   S.talk(what)             the job folk (src/jobfolk.js): 'hello' (a person greets the player), 'leave' (the toast
//                            on walking away from a job)
//   S.speaking               true while a shout plays (the town's sounds dip a little under it)
//   S.state()                for rigs: what has played, what is waiting, each kind's moments (said or not)
//   S.dispose()
//   Pure, for tests: SHOUTS, VOICE_CLIPS, makeShoutBrain(rand), pickShout(list, avoid, rand)

// every clip, with a level for the few that measured a little quieter after their peaks were held down
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
};
const W = (names, w = 1) => names.map((n) => [n, w]);
const range = (pre, n) => Array.from({ length: n }, (_, i) => `${pre}_${i + 1}`);

export const SHOUTS = {
  level: 0.9,             // into the game's master volume
  ref: 6,                 // m: full loudness this near (the camera rides a few metres behind), softer past it
  head: { foot: 1.6, horse: 2.4 },   // m above the ground the voice comes from
  rate: [0.98, 1.02],     // a touch faster or slower each time (a voice: only a touch)
  loud: [0.9, 1.05],      // ... and a touch louder or softer
  gap: 3,                 // s at least from the end of one shout to the start of the next
  // the horse: a gallop is past `gallop` m/s (a trot tops out at 6, the donkey's gallop is 8); a spur is Shift with a
  // direction pressed while the horse is under `slow` m/s; a pull-up is letting go of the keys from a gallop while it
  // is still going faster than `stopFrom`
  gallop: 7.5, slow: 4.5, stopFrom: 5,
  // each kind: the chance it is said when it may be, the wait (s, at random between) after one before the next of its
  // kind, how much it matters when two want to play (prio), how long after the moment it starts (delay) and how long
  // it may wait its turn (wait), and its clips [name, weight] (the doubles "Hyah! Hyah!" a little less often)
  kinds: {
    spur:  { chance: 0.6, cool: [15, 25], prio: 2, delay: 0.05, wait: 1.2, clips: [
      ...W(range('hyah', 8)), ...W(range('hyah_x2', 5), 0.5), ...W(range('giddyup', 6)), ...W(['giddyup_x2_1'], 0.5),
      ...W(range('letsgo', 5)), ...W(['letsgo_x2_1', 'comeon_letsgo_1'], 0.5), ...W(['hup_1'])] },
    whoa:  { chance: 0.7, cool: [12, 20], prio: 2, delay: 0.05, wait: 1.2, clips: [...W(range('whoa', 6)), ...W(range('whoa_x2', 2), 0.5)] },
    done:  { chance: 1, cool: [10, 10], prio: 3, delay: 0.5, wait: 8, clips: [...W(range('yeehaw', 5)), ...W(['whoohee_1'])] },
    hello: { chance: 0.75, cool: [20, 35], prio: 2, delay: 0.8, wait: 3, clips: W(['howdy_1', 'howdy_2', 'howdy_partner_1', 'howyado_1']) },
    bye:   { chance: 0.7, cool: [25, 40], prio: 2, delay: 0.3, wait: 3, clips: W(['seeya_later_1', 'seeya_nexttime_1']) },
    along: { chance: 0.18, cool: [45, 90], prio: 1, delay: 0.5, wait: 1.5, clips: [...W(['getalong_1', 'getalong_2', 'getalong_3']), ...W(['getalong_x2_1', 'getalong_ho_1'], 0.5)] },
  },
  morning: { chance: 0.5, clips: W(['goodmorning_1', 'goodmorning_2']) },   // the first hello of a ride, sometimes
  // the Hob events that are each kind's moment
  events: {
    waveDone: 'done', flockDone: 'done', pigsDone: 'done', banditsDone: 'done', deerDone: 'done', deliveryDone: 'done',
    catch: 'along', pigPenned: 'along', wagonStop: 'bye', deerStop: 'bye',
  },
};

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
//   B.ask(kind, now)        the moment for a kind: true if it will be said (its chance came up and its wait is over)
//   B.ride(now, { onHorse, speed, push, run })   the horse each frame: asks for a spur or a whoa when one happens
//   B.next(now, busy)       the shout to start now, or null: { kind, name }; busy: one is still playing
//   B.ended(now)            the shout playing has just ended
//   B.pending, B.last, B.lastOf, B.coolUntil, B.moments (how many times each kind's moment came, said or not)
export function makeShoutBrain(rand = Math.random, S = SHOUTS) {
  const B = { pending: null, last: null, lastOf: {}, coolUntil: {}, greeted: false, endedAt: -1e9, wantG: false, galloped: false, moments: {} };
  const between = ([a, b]) => a + rand() * (b - a);
  B.ask = (kind, now) => {
    const K = S.kinds[kind]; if (!K) return false;
    B.moments[kind] = (B.moments[kind] || 0) + 1;
    if (now < (B.coolUntil[kind] ?? -1e9)) return false;
    if (B.pending && S.kinds[B.pending.kind].prio > K.prio) return false;   // (a bigger moment is already waiting)
    if (rand() >= K.chance) return false;
    B.pending = { kind, at: now + (K.delay || 0), until: now + (K.delay || 0) + K.wait };
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
    const p = B.pending; if (!p) return null;
    if (now > p.until) { B.pending = null; return null; }
    if (busy || now < p.at || now - B.endedAt < S.gap) return null;
    B.pending = null;
    let list = S.kinds[p.kind].clips;
    if (p.kind === 'hello' && !B.greeted && S.morning && rand() < S.morning.chance) list = S.morning.clips;
    if (p.kind === 'hello') B.greeted = true;
    const name = pickShout(list, [B.last, B.lastOf[p.kind]].filter(Boolean), rand);
    if (!name) return null;
    B.last = name; B.lastOf[p.kind] = name;
    B.coolUntil[p.kind] = now + between(S.kinds[p.kind].cool);
    B.endedAt = 1e9;   // (playing: the gap counts from its end)
    return { kind: p.kind, name };
  };
  B.ended = (now) => { B.endedAt = now; };
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
  let ctx = null, bus = null, alive = true, clock = 0, now = null, panner = null, src = null, at = null;
  const buffers = {}, played = {}; let asked = 0;
  const S = { speaking: false };
  function build() {
    if (ctx || !audio.ctx) return;
    ctx = audio.ctx;
    bus = ctx.createGain(); bus.gain.value = SHOUTS.level; bus.connect(audio.out);
    const ext = clipExt(); let b = String(base); if (!b.endsWith('/')) b += '/';
    const c = ctx;
    for (const name of Object.keys(VOICE_CLIPS)) {
      fetch(b + 'sounds/voice/' + name + ext).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.url); return r.arrayBuffer(); })
        .then((ab) => (alive ? c.decodeAudioData(ab) : null)).then((buf) => { if (alive && buf) buffers[name] = buf; })
        .catch((e) => { if (alive) console.warn('shouts: a clip could not load', name, e && e.message); });
    }
  }
  audio.ready(() => { if (alive) build(); });

  const place = (p) => { if (!panner || !p) return; if (panner.positionX) { panner.positionX.value = p.x; panner.positionY.value = p.y; panner.positionZ.value = p.z; } else panner.setPosition(p.x, p.y, p.z); };
  function play(name) {
    if (!ctx || !audio.running || !buffers[name] || !at) { B.ended(clock); return false; }
    panner = ctx.createPanner(); panner.panningModel = 'equalpower'; panner.distanceModel = 'inverse';
    panner.refDistance = SHOUTS.ref; panner.rolloffFactor = 1; panner.maxDistance = 10000;
    place(at); panner.connect(bus);
    const s = src = ctx.createBufferSource(); s.buffer = buffers[name];
    s.playbackRate.value = rnd(SHOUTS.rate[0], SHOUTS.rate[1]);
    const g = ctx.createGain(); g.gain.value = VOICE_CLIPS[name] * rnd(SHOUTS.loud[0], SHOUTS.loud[1]);
    const p = panner;
    s.connect(g).connect(p);
    s.onended = () => { try { s.disconnect(); g.disconnect(); p.disconnect(); } catch (e) { /* gone */ } if (src === s) { src = null; panner = null; S.speaking = false; B.ended(clock); } };
    s.start(ctx.currentTime + 0.01);
    S.speaking = true; now = name; played[name] = (played[name] || 0) + 1;
    return true;
  }

  S.update = (dt, { P = null, I = null } = {}) => {
    if (!alive || !P) return;
    audio.need('shouts', true);
    clock += dt;
    const pos = P.position;
    at = { x: pos.x, y: pos.y + (P.onHorse ? SHOUTS.head.horse : SHOUTS.head.foot), z: pos.z };
    if (S.speaking) place(at);   // (the voice goes with the rider)
    const push = !!(I && I.enabled !== false && I.move && I.move.mag >= 0.08);
    B.ride(clock, { onHorse: !!P.onHorse, speed: P.speed || 0, push, run: !!(I && I.run) });
    const n = B.next(clock, S.speaking);
    if (n) play(n.name);
  };
  const ask = (kind) => { if (alive && B.ask(kind, clock)) asked++; };
  S.heard = (event) => { const k = SHOUTS.events[event]; if (k) ask(k); };
  S.talk = (what) => { if (what === 'hello') ask('hello'); else if (what === 'leave') ask('bye'); };
  S.state = () => ({ on: !!ctx, loaded: Object.keys(buffers).length, clips: Object.keys(VOICE_CLIPS).length, speaking: S.speaking, now, asked,
    pending: B.pending && { ...B.pending }, moments: { ...B.moments }, played: { ...played }, clock });
  S.dispose = () => {
    alive = false;
    try { if (src) src.stop(); } catch (e) { /* gone */ }
    try { if (bus) bus.disconnect(); } catch (e) { /* gone */ }
    audio.need('shouts', false);
  };
  return S;
}
