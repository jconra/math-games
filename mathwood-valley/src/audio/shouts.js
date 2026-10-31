// THE VOICES: short spoken clips (sounds/voice/<name>.ogg|.m4a, each cut tight, rumble taken off below 90 Hz, made about
// as loud as the town's clips: -18 LUFS, peaks under -3 dBFS). Small and now and then, never busy. Recorded by the game's
// maker, but for the women's: w_* a woman rider's, t_* a townswoman's (made with ElevenLabs; each kind's `her` list).
// The rider's look says which set the rider shouts, and only that set is fetched (clipsToLoad).
//
// THE PLAYER'S OWN SHOUTS (from the rider's head):
//   spurring the horse from a walk or a stand into a gallop     Hyah / Giddy-up / Let's go / Come on, let's go / Hup
//   pulling up from a gallop to a stop                          Whoa
//   W (a direction) and Shift held about a second at a gallop   Yeehaw / Whoohee
//   a job's person says hello                                   Howdy / Howdy partner / How ya do (the first hello of
//                                                               a ride is sometimes Good morning: the game has no time
//                                                               of day)
//   walking away from a job, or "Done for now"                  See ya later / See ya next time
//   a roped steer or a penned pig heading in (rarely)           Get along
//   near a horse that is moving (rarely): walking up to it, or  Easy now
//   standing by while it comes or goes; or letting the reins
//   go from a trot
//   a bandit roped right (now and then)                         You better sit down (and he answers, below)
// OTHER PEOPLE (each from where that person is; a man in the maker's voice, a woman, male: false, in the t_ clip of the
// same kind where there is one: Mrs. Haskell, Miss Wren, Ma Hollis, a woman at the store counter or riding with the wagon;
// the bandit's "you got me" has none, and a held-up wagon's "Help!" is the wagon job's, src/audio/clipslots.js):
//   a bandit after "you better sit down"                        Alright, alright, you got me
//   an innocent rider roped by mistake ("Not me, partner")      What in tarnation / What are you doin' / Who are you
//   a job person's thank-you after a job, a camp foreman's      Aw, thank ya partner / You're a real life saver /
//   after a delivery (nearly always); a store customer's        (Aw,) much obliged / Thank ya kindly (three) /
//   when an order or a sale is paid (about half the time)       Much obliged, partner
//   a store customer leaving, a job person as you walk away     Ya have a nice day now (now and then)
//   a store customer come to buy the rider's own goods          Whatcha got there
//   a townsman seeing his stolen goods ride into town           Is that my stuff? (Loot the gang: src/missions/loot.js)
//   (the gang's guard at the cache roped: his "you got me", as a bandit's on the wagon road)
//
// A whole job done (a round-up wave, a healed flock, the pigs penned, a wagon gang beaten, a herd's photographs, a
// delivery, the loot handed back, the store's counter) is no voice: a short jingle of coins dropping into the purse.
//
// Each kind has a chance and a wait before it may come again, any two clips are a few seconds apart (but an answer
// follows its line closely), the same clip never plays twice running, one at a time, and a few may wait their turn
// (the bigger moment first: a "you better sit down", then the thank-you). Everything goes through the game's master volume, so
// the Menu's Volume, the title's silence and a pause all hold it (audio.js). No switch of its own: the volume covers it.
//
//   const S = makeShouts({ audio, base, hush, woman })   audio: makeAudio(); base: the game's folder URL; hush(): true while
//                            another voice talks (a card being read aloud, src/audio/readaloud.js): no clip starts;
//                            woman: the rider's look is a woman's (isWoman)
//   S.update(dt, { P, I, horses })   each frame of play (P: the player, I: the input; horses(): other horses about,
//                            [{ x, z, speed }], for "easy now"): watches the horse for a spur, a long gallop or a pull-up,
//                            and lets out a clip that is due
//   S.heard(event, data)     a Hob event (src/hob.js): the jobs' ends (the coin jingle), a catch, a pig penned, "Done
//                            for now", a bandit caught or a rider roped by mistake (data: { at: { x, z }, male })
//   S.jingle()               the coins (a job's end)
//   S.talk(what, who, { clip })   the job folk (src/jobfolk.js): 'hello' (a person greets the player), 'leave' (the
//                            toast on walking away from a job), 'thanks' (a person's thank-you); who: { at, male };
//                            clip: that very take (a thanks whose words are already in a bubble: a hold-up's driver)
//   S.say(kind, who)         another job's people: 'thanksStore', 'niceday', 'whatchagot' (the store counter)
//                            who: { at: { x, z } or a function returning one, male }
//   S.speaking               true while a clip plays (the town's sounds dip a little under it)
//   S.state()                for rigs: what has played, what is waiting, each kind's moments (said or not)
//   S.dispose()
//   Pure, for tests: SHOUTS, VOICE_CLIPS, JINGLE, makeShoutBrain(rand), pickShout(list, avoid, rand), isMale(look),
//   isWoman(look), clipsToLoad(woman)

const range = (pre, n) => Array.from({ length: n }, (_, i) => `${pre}_${i + 1}`);
const levels = (pre, n, level = 1) => Object.fromEntries(range(pre, n).map((name) => [name, level]));

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
  mystuff_1: 1.3,   // ("Loot the gang": a townsman sees his goods)
  // a woman rider's (each phrase's first take is the game maker's pick)
  ...levels('w_hyah', 6), ...levels('w_hyah_x2', 2), ...levels('w_giddyup', 2), ...levels('w_letsgo', 2), ...levels('w_comeon', 2), ...levels('w_hup', 2),
  ...levels('w_whoa', 2), ...levels('w_whoa_x2', 2), ...levels('w_yeehaw', 2), ...levels('w_whoohee', 2),
  ...levels('w_howdy_partner', 2), ...levels('w_howdy', 2), ...levels('w_howyado', 2), ...levels('w_goodmorning', 2),
  ...levels('w_seeya_later', 2), ...levels('w_seeya_nexttime', 2), ...levels('w_getalong', 2), ...levels('w_sitdown', 2),
  ...levels('w_easynow', 2, 0.6),   // (a whisper: quieter than the shouts)
  // a townswoman's
  t_thankya_1: 1.07, t_obliged_1: 1, t_lifesaver_1: 1, t_tarnation_1: 1.06, t_mystuff_1: 1, t_niceday_1: 1, t_whatchagot_1: 1, t_whatareyoudoin_1: 1, t_whoareyou_1: 1,
};
const W = (names, w = 1) => names.map((n) => [n, w]);
// a phrase's takes, its first about twice as often as each of the others
const takes = (pre, n, w = 1) => range(pre, n).map((name, i) => [name, i ? w : w * 2]);
const THANKS = W(['thankya_partner_1', 'lifesaver_1', 'obliged_1', 'obliged_2', 'thankya_kindly_1', 'thankya_kindly_2', 'thankya_kindly_3', 'obliged_partner_1']);
const THANKS_HER = W(['t_thankya_1', 't_obliged_1', 't_lifesaver_1']);

export const SHOUTS = {
  level: 0.9,             // into the game's master volume
  ref: 6,                 // m: full loudness this near (the camera rides a few metres behind), softer past it
  head: { foot: 1.6, horse: 2.4 },   // m above the ground the player's voice comes from (another person's: `head.foot`)
  rate: [0.98, 1.02],     // a touch faster or slower each time (a voice: only a touch)
  // the other men's voices (see voiceOf): a speed/pitch from these (none near the player's own 1.0), a nasal or chesty
  // bump somewhere in peak Hz by up to +-peakDb, the top darker or brighter by up to top dB, the chest by up to low dB
  voices: { rates: [0.84, 0.88, 0.92, 1.08, 1.12, 1.16], peak: [650, 2600], peakDb: 6, top: 9, low: 4 },
  herVoices: { rates: [0.94, 0.97, 1.03, 1.06], peak: [900, 3000], peakDb: 3, top: 4, low: 2 },   // (the townswomen's: one recorded voice, coloured gently)
  loud: [0.9, 1.05],      // ... and a touch louder or softer
  gap: 3,                 // s at least from the end of one clip to the start of the next (an answer: its own delay)
  most: 3,                // clips waiting their turn at most
  // the horse: a gallop is past `gallop` m/s (a trot tops out at 6, the donkey's gallop is 8); a spur is Shift with a
  // direction pressed while the horse is under `slow` m/s; a pull-up is letting go of the keys from a gallop while it
  // is still going faster than `stopFrom`; a yeehaw is a direction and Shift held `yeehawAfter` s with the horse past
  // `slow` m/s (once a press); easing off is letting go of the keys from a trot past `easyFrom` m/s
  gallop: 7.5, slow: 4.5, stopFrom: 5, yeehawAfter: 1, easyFrom: 4,
  // "easy now" on foot: a horse moving faster than `moving` m/s within `near` m that the player walks toward (closing
  // by `closing` m/s) or stands by (slower than `still` m/s); once a meeting: it may come again after no moving horse
  // has been within `apart` m
  horse: { near: 6, moving: 0.8, closing: 0.4, still: 0.5, apart: 10 },
  // each kind: who says it (the player, or a man nearby: 'him'), the chance it is said when it may be, the wait (s, at
  // random between) after one before the next of its kind, how much it matters (prio: the bigger waits in front), how
  // long after the moment it starts (delay) and how long it may wait its turn (wait), a group sharing "not the same
  // clip twice running", and its clips [name, weight] (the doubles "Hyah! Hyah!" a little less often); her: the clips
  // when a woman says it (none: a woman doesn't)
  kinds: {
    spur:  { chance: 0.6, cool: [15, 25], prio: 2, delay: 0.05, wait: 1.2, clips: [
      ...W(range('hyah', 8)), ...W(range('hyah_x2', 5), 0.5), ...W(range('giddyup', 6)), ...W(['giddyup_x2_1'], 0.5),
      ...W(range('letsgo', 5)), ...W(['letsgo_x2_1', 'comeon_letsgo_1'], 0.5), ...W(['hup_1'])],
      her: [...takes('w_hyah', 6), ...takes('w_hyah_x2', 2, 0.5), ...takes('w_giddyup', 2), ...takes('w_letsgo', 2), ...takes('w_comeon', 2), ...takes('w_hup', 2)] },
    whoa:  { chance: 0.7, cool: [12, 20], prio: 2, delay: 0.05, wait: 1.2, clips: [...W(range('whoa', 6)), ...W(range('whoa_x2', 2), 0.5)], her: [...takes('w_whoa', 2), ...takes('w_whoa_x2', 2, 0.5)] },
    yeehaw: { chance: 0.6, cool: [35, 70], prio: 2, delay: 0.1, wait: 4, clips: [...W(range('yeehaw', 5)), ...W(['whoohee_1'])], her: [...takes('w_yeehaw', 2), ...takes('w_whoohee', 2)] },
    hello: { chance: 0.75, cool: [20, 35], prio: 2, delay: 0.8, wait: 3, clips: W(['howdy_1', 'howdy_2', 'howdy_partner_1', 'howyado_1']), her: [...takes('w_howdy_partner', 2), ...takes('w_howdy', 2), ...takes('w_howyado', 2)] },
    bye:   { chance: 0.7, cool: [25, 40], prio: 2, delay: 0.3, wait: 3, clips: W(['seeya_later_1', 'seeya_nexttime_1']), her: [...takes('w_seeya_later', 2), ...takes('w_seeya_nexttime', 2)] },
    along: { chance: 0.18, cool: [45, 90], prio: 1, delay: 0.5, wait: 1.5, clips: [...W(['getalong_1', 'getalong_2', 'getalong_3']), ...W(['getalong_x2_1', 'getalong_ho_1'], 0.5)], her: takes('w_getalong', 2) },
    easy:  { chance: 0.3, cool: [60, 120], prio: 1, delay: 0.3, wait: 2, clips: W(['easynow_1', 'easynow_2']), her: takes('w_easynow', 2) },
    sitdown: { chance: 0.5, cool: [30, 60], prio: 2, delay: 1.2, wait: 3, clips: W(['sitdown_1']), her: takes('w_sitdown', 2) },
    // other people
    gotme: { him: true, chance: 1, cool: [0, 0], prio: 2, delay: 0.35, wait: 3, clips: W(['yougotme_1']) },
    huh:   { him: true, chance: 0.6, cool: [12, 25], prio: 2, delay: 0.4, wait: 2, clips: W(['tarnation_1', 'whatareyoudoin_1', 'whoareyou_1']), her: [['t_whatareyoudoin_1', 2], ...W(['t_tarnation_1', 't_whoareyou_1'])] },
    thanks: { him: true, chance: 0.9, cool: [6, 6], prio: 2, delay: 0.2, wait: 8, group: 'thanks', clips: THANKS, her: THANKS_HER },
    thanksStore: { him: true, chance: 0.5, cool: [25, 45], prio: 2, delay: 0.2, wait: 3, group: 'thanks', clips: THANKS, her: THANKS_HER },
    niceday: { him: true, chance: 0.35, cool: [60, 120], prio: 1, delay: 0.4, wait: 5, clips: W(['niceday_1']), her: W(['t_niceday_1']) },
    whatchagot: { him: true, chance: 0.6, cool: [60, 90], prio: 2, delay: 0.6, wait: 3, clips: W(['whatchagot_1']), her: W(['t_whatchagot_1']) },
    mystuff: { him: true, chance: 1, cool: [20, 30], prio: 2, delay: 0.2, wait: 4, clips: W(['mystuff_1']), her: W(['t_mystuff_1']) },
  },
  morning: { chance: 0.5, clips: W(['goodmorning_1', 'goodmorning_2']), her: takes('w_goodmorning', 2) },   // the first hello of a ride, sometimes
  // the Hob events that are each kind's moment (banditCatch and banditMiss: below, they need the rider)
  events: { catch: 'along', pigPenned: 'along', wagonStop: 'bye', deerStop: 'bye' },
  // the Hob events that are a whole job's end: the coin jingle (no voice)
  jobEnds: ['waveDone', 'flockDone', 'pigsDone', 'banditsDone', 'deerDone', 'deliveryDone', 'lootDone', 'storeDone'],
  unused: [],   // clips recorded for later, in no kind yet (none now)
};

// a man, by his folk.js look (the outfits end _m or _f)
export const isMale = (look) => !!(look && /_m$/.test(look.outfit || ''));
export const isWoman = (look) => !!(look && /_f$/.test(look.outfit || ''));

// what a rider's game may play, so all that is fetched: the rider's own shouts (her set or his, never both) and other
// people's lines, the men's and the townswomen's
export function clipsToLoad(woman = false, S = SHOUTS) {
  const out = new Set();
  const add = (list) => { for (const [n] of list || []) if (!S.unused.includes(n)) out.add(n); };
  for (const K of Object.values(S.kinds)) { if (K.him) { add(K.clips); add(K.her); } else add(woman ? K.her : K.clips); }
  add(woman ? S.morning.her : S.morning.clips);
  return [...out];
}

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
//   B.ask(kind, now, { who, then, sure, clip })   the moment for a kind: true if it will be said (its chance came up,
//                         its wait is over, it isn't waiting already). who: the person saying it ({ male, at }; a 'him'
//                         kind with nobody, or with a woman when it has no `her` clips, is never said); then: { kind, who, sure } said right after this one; sure:
//                         no dice; clip: this take of the kind's, not one picked at random
//   B.ride(now, { onHorse, speed, push, run })   the horse each frame: asks for a spur or a whoa when one happens
//   B.next(now, busy)       the clip to start now, or null: { kind, name, who }; busy: one is still playing
//   B.ended(now)            the clip playing has just ended (its answer, if any, is asked for now)
//   B.queue, B.last, B.lastOf, B.coolUntil, B.moments (how many times each kind's moment came, said or not)
//   B.woman                 the rider is a woman: her clips for the rider's own kinds
export function makeShoutBrain(rand = Math.random, S = SHOUTS) {
  const B = { queue: [], last: null, lastOf: {}, coolUntil: {}, greeted: false, endedAt: -1e9, wantG: false, galloped: false, moments: {}, follow: null,
    runFrom: null, whooped: false, pushed: false, met: false, lastD: null, woman: false };
  B.rand = rand;   // (a rig may set it: dice that always say yes)
  const between = ([a, b]) => a + B.rand() * (b - a);
  B.ask = (kind, now, { who = null, then = null, sure = false, answer = false, clip = null } = {}) => {
    const K = S.kinds[kind]; if (!K) return false;
    B.moments[kind] = (B.moments[kind] || 0) + 1;
    if (K.him && !(who && (who.male || K.her))) return false;   // (no clips of a woman's for this kind: only a man says it)
    if (now < (B.coolUntil[kind] ?? -1e9)) return false;
    if (B.queue.some((q) => q.kind === kind) || B.queue.length >= S.most) return false;
    if (!sure && B.rand() >= K.chance) return false;
    const at = now + (K.delay || 0);
    B.queue.push({ kind, at, until: at + K.wait, prio: K.prio, who, then, answer, clip });
    B.queue.sort((a, b) => b.prio - a.prio || (b.answer - a.answer));   // (the bigger moment in front; an answer first)
    return true;
  };
  B.ride = (now, { onHorse = false, speed = 0, push = false, run = false } = {}) => {
    if (!onHorse) { B.wantG = false; B.galloped = false; B.runFrom = null; B.whooped = false; B.pushed = false; return; }
    const wantG = push && run;
    if (wantG && !B.wantG && speed < S.slow) B.ask('spur', now);   // (Shift and a direction, from a walk or a stand)
    B.wantG = wantG;
    // a direction and Shift held a second, going well: the yeehaw (once a press)
    if (!wantG) { B.runFrom = null; B.whooped = false; }
    else if (B.runFrom == null) B.runFrom = now;
    else if (!B.whooped && now - B.runFrom >= S.yeehawAfter && speed >= S.slow) { B.whooped = true; B.ask('yeehaw', now); }
    if (speed >= S.gallop && push) B.galloped = true;   // (galloping because the rider asks: not still slowing from one)
    if (B.galloped && !push && speed > S.stopFrom) { B.galloped = false; B.ask('whoa', now); }   // (let go at a gallop: pulling up)
    else if (B.galloped && speed < S.stopFrom) B.galloped = false;   // (slowed some other way: no whoa)
    else if (!B.galloped && B.pushed && !push && speed > S.easyFrom) B.ask('easy', now);   // (let the reins go from a trot)
    B.pushed = push;
  };
  // on foot, each frame (or a few times a second): the nearest moving horse (d: m, or null for none; closing: m/s the
  // player is getting nearer to it) and how fast the player goes. Walking up to it or standing by it: "easy now"
  B.horses = (now, { onHorse = false, d = null, closing = 0, speed = 0 } = {}) => {
    const H = S.horse;
    if (onHorse || d == null || d > H.apart) { B.met = false; return; }
    if (B.met || d > H.near) return;
    if (closing >= H.closing || speed < H.still) { B.met = true; B.ask('easy', now); }
  };
  B.next = (now, busy = false) => {
    B.queue = B.queue.filter((q) => now <= q.until);
    if (busy) return null;
    const q = B.queue.find((x) => now >= x.at && (x.answer || now - B.endedAt >= S.gap));
    if (!q) return null;
    B.queue.splice(B.queue.indexOf(q), 1);
    const K = S.kinds[q.kind], group = K.group || q.kind;
    const her = K.him ? !!(q.who && !q.who.male) : B.woman;
    let list = (her && K.her) || K.clips;
    if (q.kind === 'hello' && !B.greeted && S.morning && B.rand() < S.morning.chance) list = (her && S.morning.her) || S.morning.clips;
    if (q.kind === 'hello') B.greeted = true;
    const name = q.clip && VOICE_CLIPS[q.clip] ? q.clip : pickShout(list, [B.last, B.lastOf[group]].filter(Boolean), B.rand);
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

// THE COINS at a job's end: a small handful dropping into the purse, each a short bright clink (a tick of noise for the
// knock, and two quick metal rings that die away fast), a little apart and a little different each time
export const JINGLE = {
  level: 0.08,                  // each clink, into the game's master volume (the wagon job's sack clink is 0.07)
  delay: 0.25,                  // s after the moment (as the gold lands)
  coins: 5, spread: [0.045, 0.085],   // clinks, and s between one and the next
  pitch: [2300, 3600],          // Hz: each coin's ring
  rings: [[1, 1], [2.76, 0.35]], // its rings: [times the pitch, loudness]
  ring: 0.16,                   // s: how long a ring takes to die away
  tick: 0.006,                  // s: the knock of noise at its start
};

export function makeShouts({ audio, base = GAME, hush = () => false, woman = false }) {
  const B = makeShoutBrain();
  B.woman = woman;
  const toLoad = clipsToLoad(woman);
  let ctx = null, bus = null, alive = true, clock = 0, now = null, nowWho = null, panner = null, src = null, me = null;
  const buffers = {}, played = {}; let asked = 0;
  const S = { speaking: false };
  function build() {
    if (ctx || !audio.ctx) return;
    ctx = audio.ctx;
    bus = ctx.createGain(); bus.gain.value = SHOUTS.level; bus.connect(audio.out);
    const ext = clipExt(); let b = String(base); if (!b.endsWith('/')) b += '/';
    const c = ctx;
    for (const name of toLoad) {
      fetch(b + 'sounds/voice/' + name + ext).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.url); return r.arrayBuffer(); })
        .then((ab) => (alive ? c.decodeAudioData(ab) : null)).then((buf) => { if (alive && buf) buffers[name] = buf; })
        .catch((e) => { if (alive) console.warn('shouts: a clip could not load', name, e && e.message); });
    }
  }
  audio.ready(() => { if (alive) build(); });

  // where a voice is: the player's head, or the person saying it (the spot, at a standing man's head height)
  const where = (who) => {
    if (!who || !who.at) return me;
    const a = typeof who.at === 'function' ? who.at() : who.at;
    if (!a) return me;
    return { x: a.x, y: a.y ?? (me ? me.ground + SHOUTS.head.foot : SHOUTS.head.foot), z: a.z };
  };
  const place = (p) => { if (!panner || !p) return; if (panner.positionX) { panner.positionX.value = p.x; panner.positionY.value = p.y; panner.positionZ.value = p.z; } else panner.setPosition(p.x, p.y, p.z); };
  // other men are all the maker's voice: each gets his own colour so they don't sound like one guy (the townswomen, one
  // voice too, a gentler one). A person with an id (a job person's name, a bandit's number, a customer's name) always
  // gets the same voice; one without gets a fresh one.
  // The player's own lines stay as recorded.
  const voices = new Map();
  function voiceOf(who) {
    if (!who) return null;
    const key = who.id == null ? null : String(who.id);
    if (key && voices.has(key)) return voices.get(key);
    let h = 2166136261; for (const ch of key || String(Math.random())) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const r = (k) => ((h = Math.imul(h ^ (h >>> 15), 2246822519 + k) >>> 0) / 4294967296);
    const v = who.male ? SHOUTS.voices : SHOUTS.herVoices, rate = v.rates[Math.floor(r(1) * v.rates.length)];
    const deep = rate < 1;   // (a deeper, slower man is usually darker on top too)
    const out = { rate, peakHz: v.peak[0] * Math.pow(v.peak[1] / v.peak[0], r(2)), peakDb: (r(3) * 2 - 1) * v.peakDb,
      top: deep ? -v.top * (0.4 + 0.6 * r(4)) : (r(4) * 2 - 1) * v.top * 0.5, low: (r(5) * 2 - 1) * v.low };
    if (key) voices.set(key, out);
    return out;
  }
  function play(name, who) {
    const at = where(who);
    if (!ctx || !audio.running || !buffers[name] || !at) { B.ended(clock); return false; }
    panner = ctx.createPanner(); panner.panningModel = 'equalpower'; panner.distanceModel = 'inverse';
    panner.refDistance = SHOUTS.ref; panner.rolloffFactor = 1; panner.maxDistance = 10000;
    place(at); panner.connect(bus);
    const s = src = ctx.createBufferSource(); s.buffer = buffers[name];
    const vo = voiceOf(who);
    s.playbackRate.value = rnd(SHOUTS.rate[0], SHOUTS.rate[1]) * (vo ? vo.rate : 1);
    const g = ctx.createGain(); g.gain.value = VOICE_CLIPS[name] * rnd(SHOUTS.loud[0], SHOUTS.loud[1]);
    const p = panner, fx = [];
    let last = s;
    if (vo) for (const [type, freq, gain, Q] of [['peaking', vo.peakHz, vo.peakDb, 1.1], ['highshelf', 3200, vo.top, 0.7], ['lowshelf', 220, vo.low, 0.7]]) {
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.gain.value = gain; f.Q.value = Q; last.connect(f); last = f; fx.push(f);
    }
    last.connect(g).connect(p);
    s.onended = () => { try { s.disconnect(); g.disconnect(); p.disconnect(); for (const f of fx) f.disconnect(); } catch (e) { /* gone */ } if (src === s) { src = null; panner = null; S.speaking = false; nowWho = null; B.ended(clock); } };
    s.start(ctx.currentTime + 0.01);
    S.speaking = true; now = name; nowWho = who; played[name] = (played[name] || 0) + 1;
    return true;
  }

  let horseT = 0;
  S.update = (dt, { P = null, I = null, horses = null } = {}) => {
    if (!alive || !P) return;
    audio.need('shouts', true);
    clock += dt;
    const pos = P.position;
    me = { x: pos.x, y: pos.y + (P.onHorse ? SHOUTS.head.horse : SHOUTS.head.foot), z: pos.z, ground: pos.y };
    if (S.speaking) place(where(nowWho));   // (the voice goes with whoever is talking)
    const push = !!(I && I.enabled !== false && I.move && I.move.mag >= 0.08);
    B.ride(clock, { onHorse: !!P.onHorse, speed: P.speed || 0, push, run: !!(I && I.run) });
    // on foot: the nearest moving horse (the player's own, and any others the game names), a few times a second
    if ((horseT -= dt) <= 0) {
      const step = 0.15 - horseT; horseT = 0.15;
      let d = null;
      if (!P.onHorse) {
        const st = P.state && P.state(), list = [];
        if (st && st.horse && st.horse.mode !== 'ridden') list.push(st.horse);
        if (horses) for (const h of horses() || []) list.push(h);
        for (const h of list) if (h && (h.speed || 0) > SHOUTS.horse.moving) { const e = Math.hypot(h.x - pos.x, h.z - pos.z); if (d == null || e < d) d = e; }
      }
      const closing = d != null && B.lastD != null ? (B.lastD - d) / step : 0;
      B.lastD = d;
      B.horses(clock, { onHorse: !!P.onHorse, d, closing, speed: P.speed || 0 });
    }
    const n = B.next(clock, S.speaking || !!hush());
    if (n) play(n.name, n.who);
  };
  const ask = (kind, o) => { if (alive && B.ask(kind, clock, o)) asked++; };
  const him = (d) => (d && d.at ? { at: d.at, male: !!d.male, id: d.id ?? d.name ?? d.n ?? null } : null);
  S.heard = (event, data) => {
    if (event === 'banditCatch' || event === 'lootGuard') { const w = him(data); ask('sitdown', { then: w && w.male ? { kind: 'gotme', who: w, sure: true } : null }); return; }   // (lootGuard: the gang's guard at the cache)
    if (event === 'banditMiss') { ask('huh', { who: him(data) }); return; }
    if (SHOUTS.jobEnds.includes(event)) { S.jingle(); return; }
    const k = SHOUTS.events[event]; if (k) ask(k);
  };
  let jingles = 0;
  S.jingle = () => {
    jingles++;
    if (!alive || !ctx || !audio.running || !audio.out) return;
    const J = JINGLE, c = ctx;
    let t = c.currentTime + J.delay;
    // one short buffer of noise for the knocks (made once)
    if (!S._tick) { const n = Math.ceil(c.sampleRate * J.tick), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); S._tick = b; }
    const nodes = [];
    for (let k = 0; k < J.coins; k++) {
      const f = rnd(J.pitch[0], J.pitch[1]), lv = J.level * (k === J.coins - 1 ? 1 : rnd(0.55, 0.9));
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lv, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0003, t + J.ring);
      g.connect(audio.out); nodes.push(g);
      for (const [r, a] of J.rings) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * r * rnd(0.995, 1.005);
        const og = c.createGain(); og.gain.value = a; o.connect(og).connect(g); o.start(t); o.stop(t + J.ring + 0.02); nodes.push(o, og);
      }
      const nz = c.createBufferSource(); nz.buffer = S._tick;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500;
      const ng = c.createGain(); ng.gain.value = lv * 1.6; nz.connect(hp).connect(ng).connect(audio.out); nz.start(t); nodes.push(nz, hp, ng);
      t += rnd(J.spread[0], J.spread[1]);
    }
    setTimeout(() => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* gone */ } } }, (t - c.currentTime + J.ring + 0.3) * 1000);
  };
  S.talk = (what, who = null, { clip = null } = {}) => {
    const w = him(who);
    if (what === 'hello') ask('hello');
    else if (what === 'thanks') ask('thanks', { who: w, clip, sure: !!clip });
    else if (what === 'leave') {
      // the player's see-ya, and the person's "have a nice day" after it now and then (or on its own)
      const nice = w && B.rand() < SHOUTS.kinds.niceday.chance ? { kind: 'niceday', who: w, sure: true } : null;
      const before = asked; ask('bye', { then: nice });
      if (asked === before && nice) ask('niceday', { who: w, sure: true });
    }
  };
  S.say = (kind, who = null) => { if (SHOUTS.kinds[kind] && SHOUTS.kinds[kind].him) ask(kind, { who: him(who) }); };
  S.brain = B;   // (for rigs)
  S.state = () => ({ on: !!ctx, loaded: Object.keys(buffers).length, clips: toLoad.length, woman, speaking: S.speaking, now, asked, jingles,
    queue: B.queue.map((q) => ({ kind: q.kind, at: q.at, until: q.until })), moments: { ...B.moments }, played: { ...played }, clock });
  S.dispose = () => {
    alive = false;
    try { if (src) src.stop(); } catch (e) { /* gone */ }
    try { if (bus) bus.disconnect(); } catch (e) { /* gone */ }
    audio.need('shouts', false);
  };
  return S;
}
