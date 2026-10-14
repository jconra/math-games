// THE TOWN'S SOUNDS: the animals, the birds, somebody at work out back, the creek, and the player's own horse's hooves,
// so the town and the valley sound lived in. Quiet and now and then, never busy.
//
// The animals and the birds are short RECORDED clips (CC0 / public domain, listed with their sources in
// sounds/CREDITS.md; each comes as .ogg and .m4a, and the browser gets the one it can play). Everything else is made
// in the browser: the hammer and the hand saw are the Windmill lab's (labs/windmill/sound.js, played the same way here),
// and a pig's grunt, the creek, and a hoof on dirt or splashing through water are Sound Lab patches (TOWN_PATCHES below,
// the same in ~/sound-lab/patch.js so they can be tuned by ear there). Knocks and hits are bursts of noise (a hammer is
// a crack, like a clap, over a dull thump), never ringing tones.
//
// Each sound comes from where its animal (or the work, or the water) is: a PannerNode at that spot, the camera as the
// ears (audio.js), softer with distance and duller far off (the air takes the top off). A clip plays a touch faster or
// slower each time and a little louder or softer, and (but for the cows and the dogs, below) the same clip never plays
// twice running, so the repeats don't sound copied. Some clips are RARE (the howl, the grating bark, the rooster, the
// hawk): they wait a long while before they may play again.
//
// COWS AND DOGS CALL IN BURSTS: one starts, a few answer over the next few seconds, then they are quiet for a good while
// (tens of seconds to a couple of minutes); never a steady stream. Every cow says the same moo (most moos sound alike):
// each cow has its own speed for it (so its own pitch, 0.8 to 1.15), and a herd is that one moo overlapping from
// different cows at different loudness. A dog's burst is a few barks from the one dog.
//
// Who makes what:
//   the town's chickens (townlife.js) and the yard's hens (homestead.js)   clucks, a squawk when one scatters, a rooster
//                                                                         now and then
//   the yard's sheep, the farm's flock (missions/sheep.js)                  baas
//   the yard's cows, the farm's paddock, the round-up herd, the corral     moo bursts; from far off, the whole herd lowing
//   the yard's pigs and the farm's pig yard (missions/pigs.js)             soft grunts (made in the browser: no clip)
//   the teams of the standing and stopped wagons (traffic.js), the farm's   snorts and the odd whinny
//     horse, a horse in the stable, the player's own horse standing still
//   the meadows, the woods' edge, the sky                                   a meadowlark, crows and ravens, a hawk far up
//   the player's dog (dog.js)                                               the shiba's and the husky's bark (the husky
//                                                                         also talks, and rarely howls), the pug's small
//                                                                         woof; the grating bark only rarely
//   behind the general store                                                sawing and hammering (heard, not seen)
//   the creek                                                               a brook of tiny bubbles, near the running water
//   the player's horse moving                                               a hoof on the dirt for every hoof that lands
//                                                                         (walk, trot, gallop), a splash in water
// (dog_whine, a hurt or frightened dog, isn't shipped: nothing in the game hurts a dog.)
//
// The mix: everything goes through one bus into the game's master volume (so the Menu's volume, the title's silence and
// a pause all hold it, see audio.js). The bus dips under the action music and under Hob's voice, and is muffled while
// the player is inside the cabin. Fewer sounds at once, and longer gaps, on the potato tier.
//
//   const A = makeAmbience({ audio, W, tier, base })   audio: makeAudio(); W: the world; base: the game's folder URL
//   A.update(dt, { at, flock, P, D, HS, farm, RU, SH, PG, traffic, indoor, music, voice })   each frame of play: at:
//        where the player is; flock: the town's chickens (townLifeNow()); P: the player; D: the dog (or null); HS: the
//        homestead; farm, SH, PG: the farm and its sheep and pig jobs (or null); RU: the round-up; traffic: the wagons;
//        indoor: in the cabin; music 0..1: how loud the action music is; voice: true while Hob speaks
//   A.state()     for rigs: what has played, how many sound at once, the creek, the hooves, the bus level
//   A.dispose()
//   Pure helpers for tests: clipExt(canPlayType), pickClip(list, last, now, lastAt, rand, repeat), crossed(last, now,
//   at), duckOf({ music, voice, indoor }), airCut(d), burstPlan(n, rand), CLIPS, SOURCES, BURST, AMB, HOOVES,
//   TOWN_PATCHES
import { playPatch } from './patch.js';

// ── THE CLIPS (sounds/<name>.ogg|.m4a): each one's level (they are all made about as loud: -18 LUFS; the two marked
// quieter were left a few dB softer rather than squashed) and, for a rare one, the seconds before it may play again
export const CLIPS = {
  chicken_hen_clucks: { level: 1 }, chicken_hen_squawk: { level: 1.35 }, chicken_rooster: { level: 0.8, rare: 100 },
  cow_moo_1: { level: 1 }, cow_herd_distant: { level: 1, rare: 70 },
  sheep_baa_1: { level: 0.9 }, sheep_baa_2: { level: 0.9 }, sheep_baa_3: { level: 0.9 },
  horse_snort: { level: 0.9 }, horse_whinny_1: { level: 0.85, rare: 40 }, horse_whinny_2: { level: 0.85, rare: 40 },
  bird_meadowlark_1: { level: 0.8 }, bird_meadowlark_2: { level: 0.8 },
  bird_crow_1: { level: 0.8 }, bird_crow_2: { level: 0.8 }, bird_raven_1: { level: 0.8 }, bird_raven_2: { level: 0.8 },
  bird_hawk: { level: 0.75, rare: 150 },
  dog_bark_1: { level: 0.9 }, dog_bark_rare: { level: 1.2, rare: 420 },   // (true to life but grating: rarely)
  dog_husky_talk: { level: 0.85, rare: 50 }, dog_husky_howl: { level: 0.75, rare: 300 },
  dog_woof: { level: 0.85 },                                                // (a small dog's: the pug's)
};

export const AMB = {
  level: 0.55,              // the whole bus into the game's master volume
  duck: { music: 0.5, voice: 0.35 },   // how far the bus dips (share) under the action music at full, and under Hob
  indoor: { level: 0.45, cut: 650 },   // inside the cabin: this much quieter, and nothing above `cut` Hz (through the walls)
  voices: { gaming: 7, normal: 6, potato: 3 },   // clips sounding at once at most
  slower: { gaming: 1, normal: 1, potato: 1.6 }, // the gaps between sounds are this much longer
  gap: 0.9,                 // seconds at least between one call starting and the next one's (bursts excepted)
  rate: [0.94, 1.06],       // each clip a touch faster or slower (its pitch with it)
  loud: [0.8, 1.1],         // ... and a touch louder or softer
  air: { from: 25, top: 16000, low: 1800 },   // past `from` m the air dulls a sound: its top falls toward `low` Hz
  panner: 'equalpower',
};

// Who calls, how often (seconds between, at random), the clips [name, weight], how far off it can be heard at all (far,
// metres from the player) and how near it is at full loudness (ref: softer as 1 / distance past it)
export const SOURCES = {
  hens:      { every: [5, 12],   far: 34,  ref: 3,  level: 0.8, clips: [['chicken_hen_clucks', 1]] },
  rooster:   { every: [60, 140], far: 120, ref: 6,  level: 1,   clips: [['chicken_rooster', 1]] },
  squawk:    { far: 30, ref: 3, level: 0.75, clips: [['chicken_hen_squawk', 1]], again: 4 },
  sheep:     { every: [9, 22],   far: 75,  ref: 5,  level: 0.85, clips: [['sheep_baa_1', 1], ['sheep_baa_2', 1], ['sheep_baa_3', 1]] },
  cows:      { far: 130, ref: 8, level: 0.95, clips: [['cow_moo_1', 1]] },               // (in bursts: BURST.cows)
  herd:      { every: [70, 160], far: 420, near: 110, ref: 70, level: 0.7, clips: [['cow_herd_distant', 1]] },
  horses:    { every: [14, 34],  far: 60,  ref: 4,  level: 0.8, clips: [['horse_snort', 4], ['horse_whinny_1', 1], ['horse_whinny_2', 1]] },
  myHorse:   { every: [20, 50],  far: 40,  ref: 3,  level: 0.75, clips: [['horse_snort', 4], ['horse_whinny_1', 1], ['horse_whinny_2', 1]] },
  meadowlark:{ every: [12, 30],  far: 999, ref: 14, level: 0.7, clips: [['bird_meadowlark_1', 1], ['bird_meadowlark_2', 1]] },
  crows:     { every: [20, 55],  far: 999, ref: 16, level: 0.7, clips: [['bird_crow_1', 1], ['bird_crow_2', 1], ['bird_raven_1', 1], ['bird_raven_2', 1]] },
  hawk:      { every: [120, 260], far: 999, ref: 45, level: 0.7, clips: [['bird_hawk', 1]] },
  // the player's dog, by breed (in bursts: BURST.dogs): the first call of a burst [name, weight], then the barks after it
  shiba:     { far: 90, ref: 3, level: 0.8, first: [['dog_bark_1', 12], ['dog_bark_rare', 1]], then: [['dog_bark_1', 1]] },
  husky:     { far: 90, ref: 3, level: 0.8, first: [['dog_bark_1', 8], ['dog_husky_talk', 3], ['dog_husky_howl', 1], ['dog_bark_rare', 0.6]], then: [['dog_bark_1', 1]] },
  pug:       { far: 90, ref: 3, level: 0.8, first: [['dog_woof', 1]], then: [['dog_woof', 1]] },
  pigs:      { every: [7, 18],   far: 45,  ref: 3,  level: 0.8 },      // (made in the browser: TOWN — GRUNT)
  work:      { far: 95, ref: 6, level: 0.8 },                        // (the Windmill lab's saw and hammer)
  creek:     { far: 70, near: 8, level: 0.5 },                       // (TOWN — CREEK)
};

// The bursts: how long the quiet lasts after one (seconds, at random), how many answer (at most), and how soon after
// the one before each answer starts (seconds: the cows overlap, a dog waits for its last bark to end)
export const BURST = {
  cows: { quiet: [35, 120], answers: [0, 3], after: [0.5, 3.2], rate: [0.8, 1.15], calf: [1.1, 1.15], loud: [0.55, 1.05] },
  dogs: { quiet: [50, 150], answers: [1, 3], after: [0.15, 0.9] },   // (a dog's "after" counts from the end of its last bark)
  first: { cows: [8, 25], dogs: [20, 45] },   // seconds into the ride before the first burst may come
};

// where in each horse's Walk and Gallop clip a hoof lands (share of the clip; measured on the lower legs and feet:
// ~/pw/bandit-math/rigs/townsound/hoofphase_horse.cjs). The bay, the white horse and the donkey share a skeleton; the
// farm horse's are the wagons' (wagonsound.js)
const RIDING = { Walk: [0.24, 0.40, 0.75, 0.96], Gallop: [0.34, 0.52, 0.76, 0.94] };
export const HOOVES = {
  horse: RIDING, horseWhite: RIDING, donkey: RIDING,
  farmHorse: { Walk: [0.16, 0.51, 0.67, 0.9], Gallop: [0.14, 0.29, 0.49, 0.66] },
  level: { Walk: 0.7, Gallop: 1.5 },     // a hoof at a walk, and at a gallop (a trot is the Walk clip, sped up: between)
  far: 50,
};

// ── THE PATCHES (Sound Lab format: paste one into the lab to tune it, then paste it back) ──────────────────────────
const WHITE = { type: 'noise', freq: 600, steps: 256, loopLen: 1, rate: 1, level: 1 };   // (white hiss: a fresh value every sample)
export const TOWN_PATCHES = {
  // a pig's grunt: a rough low buzz (random steps about 95 times a second) whose pitch drops a little, through two
  // mouth-like bands, short
  'TOWN — GRUNT': {
    name: 'Pig grunt', group: 'TOWN', kind: 'perc', dur: 0.4,
    nodes: [
      { id: 'buzz', type: 'noise', name: 'throat', freq: 95, steps: 1, loopLen: 1, rate: 1, level: 1 },
      { id: 'drop', type: 'env', name: 'pitch drop', peak: 0.35, attack: 0.001, decay: 0.16, sustain: 0 },
      { id: 'f1', type: 'filter', name: 'mouth 1', ftype: 'bandpass', freq: 380, Q: 2.5 },
      { id: 'f2', type: 'filter', name: 'mouth 2', ftype: 'bandpass', freq: 850, Q: 4 },
      { id: 'f2-g', type: 'gain', name: 'mouth 2', gain: 0.6 },
      { id: 'vca', type: 'gain', name: 'loudness', gain: 0 },
      { id: 'amp', type: 'env', name: 'loudness', peak: 1, attack: 0.02, attackCurve: 'lin', decay: 0.17, sustain: 0 },
      { id: 'soft', type: 'filter', name: 'soft top', ftype: 'lowpass', freq: 1400, Q: 0.5 },
      { id: 'out', type: 'out', name: 'output', gain: 1.4 },
    ],
    cables: [
      { from: 'drop', to: 'buzz', port: 'rate' }, { from: 'buzz', to: 'f1' }, { from: 'buzz', to: 'f2' }, { from: 'f2', to: 'f2-g' },
      { from: 'f1', to: 'vca' }, { from: 'f2-g', to: 'vca' }, { from: 'amp', to: 'vca', port: 'gain' }, { from: 'vca', to: 'soft' }, { from: 'soft', to: 'out' },
    ],
  },
  // a hoof coming down on the dirt: a dull low thump of noise, a short knock, a little grit (no tone)
  'TOWN — HOOF': {
    name: 'Hoof on dirt (noise)', group: 'TOWN', kind: 'perc', dur: 0.2,
    nodes: [
      { id: 'n', name: 'noise', ...WHITE },
      { id: 'thump-f', type: 'filter', name: 'thump', ftype: 'lowpass', freq: 260, Q: 0.8 },
      { id: 'thump-g', type: 'gain', name: 'thump', gain: 0 },
      { id: 'thump-e', type: 'env', name: 'thump', peak: 1.4, attack: 0.002, decay: 0.07, sustain: 0 },
      { id: 'knock-f', type: 'filter', name: 'knock', ftype: 'bandpass', freq: 1100, Q: 1.2 },
      { id: 'knock-g', type: 'gain', name: 'knock', gain: 0 },
      { id: 'knock-e', type: 'env', name: 'knock', peak: 0.4, attack: 0.001, decay: 0.025, sustain: 0 },
      { id: 'grit-f', type: 'filter', name: 'grit', ftype: 'highpass', freq: 2600, Q: 0.7 },
      { id: 'grit-g', type: 'gain', name: 'grit', gain: 0 },
      { id: 'grit-e', type: 'env', name: 'grit', peak: 0.1, attack: 0.001, decay: 0.03, sustain: 0, delay: 0.004 },
      { id: 'out', type: 'out', name: 'output', gain: 0.6 },
    ],
    cables: [
      { from: 'n', to: 'thump-f' }, { from: 'thump-f', to: 'thump-g' }, { from: 'thump-e', to: 'thump-g', port: 'gain' }, { from: 'thump-g', to: 'out' },
      { from: 'n', to: 'knock-f' }, { from: 'knock-f', to: 'knock-g' }, { from: 'knock-e', to: 'knock-g', port: 'gain' }, { from: 'knock-g', to: 'out' },
      { from: 'n', to: 'grit-f' }, { from: 'grit-f', to: 'grit-g' }, { from: 'grit-e', to: 'grit-g', port: 'gain' }, { from: 'grit-g', to: 'out' },
    ],
  },
  // a hoof in shallow water: a soft slap and a spray of bright hiss
  'TOWN — HOOF SPLASH': {
    name: 'Hoof in water', group: 'TOWN', kind: 'perc', dur: 0.35,
    nodes: [
      { id: 'n', name: 'noise', ...WHITE },
      { id: 'slap-f', type: 'filter', name: 'slap', ftype: 'bandpass', freq: 700, Q: 0.7 },
      { id: 'slap-g', type: 'gain', name: 'slap', gain: 0 },
      { id: 'slap-e', type: 'env', name: 'slap', peak: 0.7, attack: 0.004, decay: 0.09, sustain: 0 },
      { id: 'spray-f', type: 'filter', name: 'spray', ftype: 'bandpass', freq: 3800, Q: 0.6 },
      { id: 'spray-g', type: 'gain', name: 'spray', gain: 0 },
      { id: 'spray-e', type: 'env', name: 'spray', peak: 0.35, attack: 0.015, decay: 0.2, sustain: 0, delay: 0.01 },
      { id: 'out', type: 'out', name: 'output', gain: 0.6 },
    ],
    cables: [
      { from: 'n', to: 'slap-f' }, { from: 'slap-f', to: 'slap-g' }, { from: 'slap-e', to: 'slap-g', port: 'gain' }, { from: 'slap-g', to: 'out' },
      { from: 'n', to: 'spray-f' }, { from: 'spray-f', to: 'spray-g' }, { from: 'spray-e', to: 'spray-g', port: 'gain' }, { from: 'spray-g', to: 'out' },
    ],
  },
  // the creek: a steady wash of hiss in two bands, the upper one's middle jumping about a few times a second (the
  // babble), the whole slowly swelling (a drone: it runs while the player is near running water)
  'TOWN — CREEK': {
    name: 'Creek murmur', group: 'TOWN', kind: 'engine', dur: 3,
    nodes: [
      { id: 'n', name: 'noise', ...WHITE },
      { id: 'wash', type: 'filter', name: 'wash', ftype: 'bandpass', freq: 650, Q: 0.6 },
      { id: 'wash-g', type: 'gain', name: 'wash', gain: 0.5 },
      { id: 'bab', type: 'filter', name: 'babble', ftype: 'bandpass', freq: 1900, Q: 2.2 },
      { id: 'jump', type: 'noise', name: 'babble jumps', freq: 7, steps: 1, loopLen: 3, rate: 1, level: 700 },
      { id: 'bab-g', type: 'gain', name: 'babble', gain: 0.55 },
      { id: 'swell', type: 'osc', name: 'swell', wave: 'sine', freq: 0.13, level: 0.2 },
      { id: 'bus', type: 'gain', name: 'mix', gain: 0.8 },
      { id: 'out', type: 'out', name: 'output', gain: 0.7 },
    ],
    cables: [
      { from: 'n', to: 'wash' }, { from: 'wash', to: 'wash-g' }, { from: 'wash-g', to: 'bus' },
      { from: 'n', to: 'bab' }, { from: 'jump', to: 'bab', port: 'freq' }, { from: 'bab', to: 'bab-g' }, { from: 'bab-g', to: 'bus' },
      { from: 'swell', to: 'bus', port: 'gain' }, { from: 'bus', to: 'out' },
    ],
  },
};

// ── PURE HELPERS ─────────────────────────────────────────────────────────────────────────────────────────────────
// the file kind this browser can play: Ogg Vorbis where it can (Chrome, Firefox, Edge), else AAC in .m4a (Safari)
export function clipExt(canPlayType) {
  try { if (canPlayType && /^(probably|maybe)$/.test(canPlayType('audio/ogg; codecs="vorbis"'))) return '.ogg'; } catch (e) { /* no audio element */ }
  return '.m4a';
}
// a clip from a list of [name, weight]: never one that played last (unless it is the only one, or repeat is true), and
// never a rare one still inside its wait (lastAt: { name: when it last played, seconds }); null if none may play now
export function pickClip(list, last, now = 0, lastAt = {}, rand = Math.random, repeat = false) {
  const ok = list.filter(([n, w]) => {
    const c = CLIPS[n]; if (!c || !(w > 0)) return false;
    return !(c.rare && lastAt[n] != null && now - lastAt[n] < c.rare);
  });
  // (no clip twice running, but only when another clip of the same weight can stand in for it: a heavy common clip
  // after itself is fine, else every snort would force a whinny and the rare ones would play far more than weighted)
  const lw = (ok.find(([n]) => n === last) || [])[1];
  const twin = lw != null && ok.some(([n, w]) => n !== last && w === lw);
  const fresh = twin && !repeat ? ok.filter(([n]) => n !== last) : ok;
  if (!fresh.length) return null;
  const total = fresh.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [n, w] of fresh) { r -= w; if (r < 0) return n; }
  return fresh[fresh.length - 1][0];
}
// whether a clip's play head went past `at` (a share of the clip) between two looks, wrapping round the loop's end
export function crossed(last, now, at) {
  if (last < 0) return false;
  return last <= now ? at > last && at <= now : at > last || at <= now;
}
// how loud the bus is (a share of AMB.level) under the action music (0..1), with Hob speaking, and indoors
export function duckOf({ music = 0, voice = false, indoor = false } = {}) {
  const m = Math.max(0, Math.min(1, music));
  return (1 - AMB.duck.music * m) * (voice ? 1 - AMB.duck.voice : 1) * (indoor ? AMB.indoor.level : 1);
}
// the top (Hz) the air leaves a sound d metres off: all of it up close, duller and duller further away
export function airCut(d) {
  const A = AMB.air;
  if (!(d > A.from)) return A.top;
  return Math.max(A.low, A.top * Math.pow(A.from / d, 1.1));
}
// a burst's calls: [{ who: 0 for the one that starts, 1.. for the ones that answer }], n answers at most (the first
// always comes; fewer answer more often than many)
// the creek's sound, made sample by sample into a loop: a babbling brook is not a hiss (that reads as surf) but
// thousands of tiny bubbles, each a short pure note whose pitch climbs as it rings out (the "plink" of poured water).
// Mostly small ones (0.65-2.9 kHz, softened above 2 kHz), a few bigger gurgles lower down, and a faint fizz of spray on top. The loop
// wraps round, so it has no seam. rand is passed in so tests can make the same brook twice.
export function brookSamples(rate, secs = 7, rand = Math.random) {
  const n = Math.round(rate * secs), out = new Float32Array(n), TAU = Math.PI * 2;
  const bubble = (t0, f0, amp, life) => {
    const len = Math.round(life * rate), rise = 0.25 + rand() * 0.6; let ph = 0;
    for (let i = 0; i < len; i++) {
      const u = i / len, f = f0 * (1 + rise * u), env = Math.min(1, i / (0.0008 * rate)) * Math.exp(-5 * u);
      ph += TAU * f / rate; out[(t0 + i) % n] += Math.sin(ph) * amp * env;
    }
  };
  for (let k = 0, m = Math.round(secs * 38); k < m; k++)   // small bubbles: the crisp poured-water sound (not too many)
    bubble(Math.floor(rand() * n), 650 + Math.pow(rand(), 1.8) * 2200, 0.06 + Math.pow(rand(), 3) * 0.3, 0.02 + rand() * 0.04);
  for (let k = 0, m = Math.round(secs * 8); k < m; k++)    // a few bigger gurgles
    bubble(Math.floor(rand() * n), 260 + rand() * 420, 0.12 + rand() * 0.2, 0.05 + rand() * 0.06);
  let prev = 0;                                             // the fizz: white noise with its lows taken off, very quiet
  for (let i = 0; i < n; i++) { const w = rand() * 2 - 1; out[i] += (w - prev) * 0.012; prev = w; }
  // soften the top: two gentle low-pass passes (about 2 kHz), run round the loop twice so the seam matches
  const k1 = 1 - Math.exp(-2 * Math.PI * 2000 / rate); let y1 = 0, y2 = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) { y1 += k1 * (out[i] - y1); y2 += k1 * (y1 - y2); if (pass) out[i] = y2; }
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(out[i]));
  for (let i = 0; i < n; i++) out[i] *= 0.6 / (pk || 1);
  return out;
}

export function burstPlan(most, rand = Math.random) {
  const out = [{ who: 0 }];
  let n = 0; while (n < most && rand() < 0.62) n++;
  for (let i = 1; i <= n; i++) out.push({ who: i });
  return out;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const GAME = new URL('../../', import.meta.url).href;     // (src/audio/ -> the game's folder)

export function makeAmbience({ audio, W, tier = W && W.tier, base = GAME }) {
  const T = AMB.voices[tier] ? tier : 'normal', slow = AMB.slower[T], most = AMB.voices[T];
  let ctx = null, bus = null, cut = null, noiseBuf = null, alive = true, voices = 0, clock = 0, lastAny = -99, ext = '.ogg', here = null;
  const buffers = {}, last = {}, lastAt = {}, played = {}, made = { hammer: 0, saw: 0, grunt: 0, hoof: 0, splash: 0 };
  const bursts = { cows: 0, dogs: 0, cowCalls: 0, dogCalls: 0 };
  const timers = {};
  for (const k of Object.keys(SOURCES)) { const e = SOURCES[k].every; timers[k] = e ? rnd(e[0] * 0.3, e[1] * 0.6) : 0; }

  // the bus: clips and patches -> bus (level and dips) -> cut (indoors: through the walls) -> the game's master
  function build() {
    if (ctx || !audio.ctx) return;
    ctx = audio.ctx;
    bus = ctx.createGain(); bus.gain.value = 0;
    cut = ctx.createBiquadFilter(); cut.type = 'lowpass'; cut.frequency.value = 18000; cut.Q.value = 0.5;
    bus.connect(cut).connect(audio.out);
    // two seconds of white noise, shared by the saw and the hammer
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ext = clipExt((n) => { const el = document.createElement('audio'); return el.canPlayType(n); });
    let b = String(base); if (!b.endsWith('/')) b += '/';
    // (the context is held here: leaving the ride clears ctx while clips may still be on their way, and those just stop)
    const c = ctx;
    for (const name of Object.keys(CLIPS)) {
      fetch(b + 'sounds/' + name + ext).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.url); return r.arrayBuffer(); })
        .then((ab) => (alive ? c.decodeAudioData(ab) : null)).then((buf) => { if (alive && buf) buffers[name] = buf; })
        .catch((e) => { if (alive) console.warn('ambience: a clip could not load', name, e && e.message); });
    }
  }
  audio.ready(() => { if (alive) build(); });

  const yAt = (x, z, up = 0.8) => (W ? W.heightAt(x, z) : 0) + up;
  const dist = (p) => (here ? Math.hypot(p.x - here.x, p.z - here.z) : 0);
  // a place in the world to play from: panner (softer with distance) and, far off, the air's dulling, into the bus
  const panner = (ref, at) => {
    const p = ctx.createPanner(); p.panningModel = AMB.panner; p.distanceModel = 'inverse';
    p.refDistance = ref; p.rolloffFactor = 1; p.maxDistance = 10000;
    if (p.positionX) { p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z; } else p.setPosition(at.x, at.y, at.z);
    const f = airCut(dist(at));
    if (f < AMB.air.top) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f; lp.Q.value = 0.5; p.connect(lp).connect(bus); p.air = lp; }
    else p.connect(bus);
    return p;
  };
  const unpan = (p) => { try { p.disconnect(); if (p.air) p.air.disconnect(); } catch (e) { /* gone */ } };

  // a recorded clip at a place: false if it can't now (not loaded, too many sounding, too soon after another).
  // o: { force (no gap after the last call), when (s from now), rate, loud, name (this clip, not a pick), repeat }
  function playClip(key, at, o = {}) {
    const S = SOURCES[key];
    if (!ctx || !audio.running || voices >= most) return false;
    if (!o.force && clock - lastAny < AMB.gap) return false;
    const list = (o.list || S.clips).filter(([n]) => buffers[n]);
    const name = o.name ? (buffers[o.name] ? o.name : null) : pickClip(list, last[key], clock, lastAt, Math.random, o.repeat);
    if (!name) return false;
    const src = ctx.createBufferSource(); src.buffer = buffers[name];
    src.playbackRate.value = o.rate || rnd(AMB.rate[0], AMB.rate[1]);
    const g = ctx.createGain(); g.gain.value = (S.level ?? 1) * CLIPS[name].level * (o.loud ?? rnd(AMB.loud[0], AMB.loud[1]));
    const p = panner(S.ref, { x: at.x, y: at.y ?? yAt(at.x, at.z), z: at.z });
    src.connect(g).connect(p);
    src.onended = () => { voices--; try { src.disconnect(); g.disconnect(); } catch (e) { /* gone */ } unpan(p); };
    src.start(ctx.currentTime + 0.02 + (o.when || 0));
    voices++; lastAny = clock; last[key] = name; lastAt[name] = clock + (o.when || 0); played[name] = (played[name] || 0) + 1;
    return { name, len: buffers[name].duration / src.playbackRate.value };
  }
  // a patch at a place (grunt), at a time on the audio clock
  function playAt(patch, at, ref, when = 0, gain = 1) {
    if (!ctx || !audio.running) return;
    const p = panner(ref, at), g = ctx.createGain(); g.gain.value = gain; g.connect(p);
    playPatch(ctx, null, g, null, patch, () => { try { g.disconnect(); } catch (e) { /* gone */ } unpan(p); }, { at: ctx.currentTime + 0.02 + when });
  }
  const withNodes = (name, fn) => { const P = TOWN_PATCHES[name]; return { ...P, nodes: P.nodes.map((n) => fn(n) || n) }; };

  // ── WHERE THINGS ARE ─────────────────────────────────────────────────────────────────────────────────────────
  const near = (list, far) => { const out = []; for (const p of list) if (p && dist(p) < far) out.push(p); return out; };
  const any = (list) => (list.length ? list[(Math.random() * list.length) | 0] : null);
  const rootOf = (o) => (!o ? null : o.a && o.a.root ? o.a.root : o.root && o.root.position ? o.root : null);
  const spotOf = (o, extra) => { const r = rootOf(o); return r ? { x: r.position.x, z: r.position.z, key: r, ...extra } : null; };
  // the stable's horses, heard through its walls: a spot just inside the back of the building
  let stable = null;
  { const b = W && W.places && W.places.stable;
    if (b && b.door) { const dx = b.door.x - b.x, dz = b.door.z - b.z, d = Math.hypot(dx, dz) || 1; stable = { x: b.x - (dx / d) * 1.5, z: b.z - (dz / d) * 1.5 }; } }
  // the work out back: a spot behind the general store (else behind the saloon), clear of the walls
  let work = null;
  if (W && W.places) for (const k of ['store', 'saloon']) {
    const b = W.places[k]; if (!b || !b.door || work) continue;
    const dx = b.door.x - b.x, dz = b.door.z - b.z, d = Math.hypot(dx, dz) || 1;
    for (const f of [d + 1.5, d + 3, d + 5]) { const x = b.x - (dx / d) * f, z = b.z - (dz / d) * f; if (!W.blocked(x, z)) { work = { x, z, y: yAt(x, z, 1) }; break; } }
  }
  // the trees, in 24 m squares (for the crows: a tree at the woods' edge); made the first time a crow is wanted
  let trees = null;
  const CELL = 24, cellKey = (i, j) => i + ',' + j;
  function treeCells() {
    if (trees) return trees;
    trees = new Map();
    const f = W && W.V && W.V.treeForest, list = (f && f.fixed) || [];
    for (const t of list) { const k = cellKey(Math.floor(t.x / CELL), Math.floor(t.z / CELL)); let c = trees.get(k); if (!c) trees.set(k, c = []); c.push(t); }
    return trees;
  }
  const treesNear = (x, z) => { const c = treeCells().get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))); return c ? c.length : 0; };
  // a crow's tree: one 30-110 m off, preferring a square with few trees beside an empty one (the edge of the woods)
  function crowTree(at) {
    const cells = treeCells(); let best = null, bestScore = -1;
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * Math.PI * 2, r = rnd(30, 110), x = at.x + Math.sin(a) * r, z = at.z + Math.cos(a) * r;
      const i = Math.floor(x / CELL), j = Math.floor(z / CELL), c = cells.get(cellKey(i, j)); if (!c || !c.length) continue;
      let empty = 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!cells.get(cellKey(i + di, j + dj))) empty++;
      const score = empty + Math.random();
      if (score > bestScore) { bestScore = score; const t = c[(Math.random() * c.length) | 0]; best = { x: t.x, z: t.z, y: yAt(t.x, t.z, 8 + 4 * (t.scale || 1)) }; }
    }
    return best;
  }
  // a meadowlark's spot: open grass 30-75 m off (no trees in its square, no water, not in the town)
  function meadow(at) {
    const sq = W && W.places && W.places.square;
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2, r = rnd(30, 75), x = at.x + Math.sin(a) * r, z = at.z + Math.cos(a) * r;
      if (sq && Math.hypot(x - sq.x, z - sq.z) < 55) continue;
      if (treesNear(x, z) > 1 || W.waterAt(x, z) > 0.15) continue;
      return { x, z, y: yAt(x, z, 0.6) };
    }
    return null;
  }

  // ── THE WORK OUT BACK: the Windmill lab's hand saw and hammer (labs/windmill/sound.js), played the same way ──────
  // a burst of filtered noise (the lab's noise())
  function hiss(dest, t0, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.5, attack = 0.005 } = {}) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest); src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
  }
  // one saw stroke: hiss through the blade's bright band and the board's low band, chopped by the teeth, swelling and
  // easing like the arm; louder and brighter on the push (the lab's stroke())
  function stroke(dest, t, dur, push, depth, gain) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const lift = 1 + depth * 0.22;
    const hi = ctx.createBiquadFilter(); hi.type = 'bandpass'; hi.Q.value = 1.1;
    const b = (push ? 3300 : 2500) * lift;
    hi.frequency.setValueAtTime(b * 0.85, t); hi.frequency.linearRampToValueAtTime(b * 1.1, t + dur * 0.5); hi.frequency.linearRampToValueAtTime(b * 0.9, t + dur);
    const body = ctx.createBiquadFilter(); body.type = 'bandpass'; body.Q.value = 6; body.frequency.value = 520 * lift;
    const bodyG = ctx.createGain(); bodyG.gain.value = push ? 1.6 : 1.0;
    const am = ctx.createGain(); am.gain.value = 0.5;
    const teeth = ctx.createOscillator(); teeth.type = 'sawtooth';
    const rate = push ? 125 : 95;
    teeth.frequency.setValueAtTime(rate * 0.5, t); teeth.frequency.linearRampToValueAtTime(rate, t + dur * 0.45); teeth.frequency.linearRampToValueAtTime(rate * 0.55, t + dur);
    const tg = ctx.createGain(); tg.gain.value = -0.5; teeth.connect(tg); tg.connect(am.gain);
    const env = ctx.createGain(), peak = (push ? 0.85 : 0.45) * gain;
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(peak, t + dur * 0.3);
    env.gain.setValueAtTime(peak, t + dur * 0.62); env.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(hi); hi.connect(am); src.connect(body); body.connect(bodyG); bodyG.connect(am); am.connect(env); env.connect(dest);
    src.start(t, Math.random()); src.stop(t + dur + 0.05); teeth.start(t); teeth.stop(t + dur + 0.05);
  }
  // one hammer blow: a crack of noise like a clap with two tiny repeats, over the board's dull thump; drier as the nail
  // sinks, the last blow (nail seated) mostly thump (the lab's blow())
  function blow(dest, t, sink, last, gain, pitch) {
    gain *= 1.1;
    const crack = (last ? 0.35 : 1) * gain, f = (1700 + 600 * sink) * pitch * rnd(0.92, 1.08);
    hiss(dest, t, 0.03 - 0.01 * sink, { freq: f, q: 0.6, gain: 0.75 * crack, attack: 0.0006 });
    hiss(dest, t + 0.004, 0.018, { freq: f * 1.6, q: 0.8, gain: 0.35 * crack, attack: 0.0006 });
    hiss(dest, t + rnd(0.009, 0.013), 0.014, { freq: f * 0.8, q: 0.7, gain: 0.2 * crack, attack: 0.0006 });
    hiss(dest, t, last ? 0.09 : 0.05, { type: 'lowpass', freq: last ? 380 : 520 + 200 * sink, gain: (last ? 0.8 : 0.45) * gain, attack: 0.001 });
  }
  let workT = rnd(2, 6), workStep = 0;
  function doWork() {
    const S = SOURCES.work;
    if (!work || dist(work) > S.far || voices >= most) return;
    const p = panner(S.ref, work), g = ctx.createGain(); g.gain.value = S.level; g.connect(p);
    const t0 = ctx.currentTime + 0.05; let t = t0;
    if (workStep % 2 === 0) {
      // the saw: 5 to 9 strokes, push and pull, the first gentle, the board's note climbing as the cut deepens
      const n = 5 + ((Math.random() * 5) | 0);
      for (let i = 0; i < n; i++) {
        const push = i % 2 === 0, dur = (push ? 0.17 : 0.145) * rnd(0.93, 1.07);
        stroke(g, t, dur, push, i / Math.max(1, n - 1), (i === 0 ? 0.6 : 1) * rnd(0.9, 1.08)); made.saw++;
        t += dur + rnd(0.015, 0.03);
      }
      workT = t - t0 + rnd(2.5, 6);
    } else {
      // the hammer: one to three nails, three or four blows each (a light tap to set it, then swings, the last one dead)
      const nails = 1 + ((Math.random() * 3) | 0);
      for (let k = 0; k < nails; k++) {
        const blows = Math.random() < 0.5 ? 3 : 4, pitch = k ? rnd(0.9, 0.96) : rnd(1, 1.06);
        for (let i = 0; i < blows; i++) {
          const lastBlow = i === blows - 1;
          blow(g, t, i / (blows - 1), lastBlow, i === 0 ? 0.55 : rnd(0.85, 1.05), pitch); made.hammer++;
          if (!lastBlow) t += (i === 0 ? 0.3 : 0.36) * rnd(0.88, 1.14);
        }
        t += rnd(0.45, 0.6);
      }
      workT = t - t0 + (Math.random() < 0.35 ? rnd(18, 40) : rnd(4, 10));   // (now and then a longer rest)
    }
    voices++;
    setTimeout(() => { voices--; try { g.disconnect(); } catch (e) { /* gone */ } unpan(p); }, (t - t0 + 0.6) * 1000);
    workStep++;
  }

  // ── THE CREEK: the drone sits at the nearest running water ───────────────────────────────────────────────────────
  // The creek by the town is thin, so the water is looked for on a fine grid (every 1.5 m), a 24 m square at a time
  // (two squares a frame at most, each kept once looked at): the wet spots in each square (shallow: a pond's middle
  // doesn't babble)
  const WT = 24, WSTEP = 1.5, wet = new Map();
  function wetIn(i, j) {
    const k = i + ',' + j; let c = wet.get(k);
    if (c) return c;
    c = [];
    for (let x = i * WT + WSTEP / 2; x < (i + 1) * WT; x += WSTEP) for (let z = j * WT + WSTEP / 2; z < (j + 1) * WT; z += WSTEP) {
      const w = W.waterAt(x, z); if (w > 0.3 && w < 0.95) c.push(x, z);
    }
    wet.set(k, c);
    return c;
  }
  function findWater(at, budget) {
    const r = SOURCES.creek.far, i0 = Math.floor((at.x - r) / WT), i1 = Math.floor((at.x + r) / WT), j0 = Math.floor((at.z - r) / WT), j1 = Math.floor((at.z + r) / WT);
    let best = null, bd = Infinity, missing = false;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      if (!wet.has(i + ',' + j)) { if (budget <= 0) { missing = true; continue; } budget--; }
      const c = wetIn(i, j);
      for (let n = 0; n < c.length; n += 2) { const d = Math.hypot(c[n] - at.x, c[n + 1] - at.z); if (d < bd) { bd = d; best = { x: c[n], z: c[n + 1] }; } }
    }
    return { at: best, d: bd, missing };
  }
  let brook = null;   // (the brook's loop, made once per ride on first need)
  let creek = null, creekG = null, creekP = null, creekT = 0, creekAt = null, creekD = Infinity, dryT = 0;
  function doCreek(dt, at) {
    if (!W || !W.waterAt) return;
    creekT -= dt;
    if (creekT <= 0) {
      const f = findWater(at, 2);
      creekT = f.missing ? 0 : 0.5;   // (squares still to look at: next frame, until all are known)
      // (water found but past hearing counts as dry too, so the silent drone stops after a few seconds)
      if (f.at) { creekAt = f.at; creekD = f.d; dryT = f.d < SOURCES.creek.far ? 0 : f.missing ? dryT : dryT + 0.5; } else if (!f.missing) { creekD = Infinity; dryT += 0.5; }
    }
    const S = SOURCES.creek, want = creekD < S.far && audio.running;
    if (want && !creek) {
      creekG = ctx.createGain(); creekG.gain.value = 0;
      const p = ctx.createPanner(); p.panningModel = AMB.panner; p.distanceModel = 'inverse'; p.refDistance = 6; p.rolloffFactor = 1; p.maxDistance = 10000;
      p.connect(bus); creekP = p; creekG.connect(p);
      if (!brook) { const d = brookSamples(ctx.sampleRate); brook = ctx.createBuffer(1, d.length, ctx.sampleRate); brook.copyToChannel(d, 0); }
      const src = ctx.createBufferSource(); src.buffer = brook; src.loop = true; src.connect(creekG); src.start(ctx.currentTime, Math.random() * brook.duration);
      creek = { stop: (dt = 0) => { try { src.stop(ctx.currentTime + dt); src.disconnect(); } catch (e) { /* gone */ } } };
    } else if (creek && (dryT > 4 || !audio.running)) {
      const c = creek, g = creekG, p = creekP; creek = creekG = creekP = null;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.2); setTimeout(() => { c.stop(0.05); try { g.disconnect(); p.disconnect(); } catch (e) { /* gone */ } }, 1500);
    }
    if (creek) {
      const t = ctx.currentTime, f = creekD < S.far ? Math.min(1, (S.far - creekD) / (S.far - S.near)) : 0;
      creekG.gain.setTargetAtTime(S.level * f, t, 0.4);
      if (creekAt) {
        const y = yAt(creekAt.x, creekAt.z, 0.2);
        if (creekP.positionX) { creekP.positionX.setTargetAtTime(creekAt.x, t, 0.5); creekP.positionZ.setTargetAtTime(creekAt.z, t, 0.5); creekP.positionY.setTargetAtTime(y, t, 0.5); }
        else creekP.setPosition(creekAt.x, y, creekAt.z);
      }
    }
  }

  // ── THE PLAYER'S HORSE'S HOOVES ────────────────────────────────────────────────────────────────────────────
  let hoofP = null, hoofLast = -1, hoofClip = '', hooves = 0, splashes = 0;
  function doHooves(P, at) {
    const h = P && P.horse, a = h && h.actions && h.actions[h.clip], lands = h && HOOVES[h.kind] && HOOVES[h.kind][h.clip];
    if (!a || !lands || Math.hypot(h.root.position.x - at.x, h.root.position.z - at.z) > HOOVES.far) { hoofLast = -1; hoofClip = ''; return; }
    if (hoofClip !== h.clip) { hoofLast = -1; hoofClip = h.clip; }
    const ph = (a.time / a.getClip().duration) % 1;
    if (hoofLast >= 0 && ctx && audio.running) {
      const hp = h.root.position;
      if (!hoofP) { hoofP = ctx.createPanner(); hoofP.panningModel = AMB.panner; hoofP.distanceModel = 'inverse'; hoofP.refDistance = 4; hoofP.rolloffFactor = 1; hoofP.connect(bus); }
      if (hoofP.positionX) { hoofP.positionX.value = hp.x; hoofP.positionY.value = hp.y; hoofP.positionZ.value = hp.z; } else hoofP.setPosition(hp.x, hp.y, hp.z);
      const isWet = W.waterAt(hp.x, hp.z) > 0.25, lv = HOOVES.level[h.clip] ?? 0.6, sp = a.timeScale || 1;
      for (let i = 0; i < lands.length; i++) {
        if (!crossed(hoofLast, ph, lands[i])) continue;
        // (louder at a gallop, and a little with the clip's speed: a trot is the Walk clip played faster)
        const g = lv * Math.min(1.2, 0.7 + 0.3 * sp) * rnd(0.75, 1);
        const P2 = withNodes(isWet ? 'TOWN — HOOF SPLASH' : 'TOWN — HOOF', (x) => (x.type === 'out' ? { ...x, gain: x.gain * g }
          : x.id === 'knock-f' ? { ...x, freq: x.freq * rnd(0.8, 1.25) } : x.id === 'thump-f' ? { ...x, freq: x.freq * rnd(0.85, 1.15) } : null));
        playPatch(ctx, null, hoofP, null, P2, null, { at: ctx.currentTime + 0.01 + i * 0.002 });
        if (isWet) splashes++; else hooves++;
      }
    }
    hoofLast = ph;
  }

  // ── THE BURSTS: cows and the dog ─────────────────────────────────────────────────────────────────────────────
  // each cow's own speed for the one moo (its voice), kept for as long as the cow is about
  const cowVoice = new WeakMap();
  const voiceOf = (c) => {
    if (!c.key) return rnd(BURST.cows.rate[0], BURST.cows.rate[1]);
    let v = cowVoice.get(c.key);
    if (v == null) { const R = c.young ? BURST.cows.calf : BURST.cows.rate; v = rnd(R[0], R[1]); cowVoice.set(c.key, v); }
    return v;
  };
  let cowT = rnd(BURST.first.cows[0], BURST.first.cows[1]);
  // one cow near the player starts; a few others near her answer, each a little after the one before, overlapping
  function cowBurst(cattle) {
    const S = SOURCES.cows, here_ = near(cattle, S.far);
    if (!here_.length) return false;
    const lead = any(here_);
    const others = here_.filter((c) => c !== lead && Math.hypot(c.x - lead.x, c.z - lead.z) < 45);
    const plan = burstPlan(Math.min(BURST.cows.answers[1], others.length));
    let when = 0, n = 0;
    for (const step of plan) {
      const c = step.who === 0 ? lead : others.splice((Math.random() * others.length) | 0, 1)[0];
      if (!c) break;
      if (step.who) when += rnd(BURST.cows.after[0], BURST.cows.after[1]);
      const ok = playClip('cows', { x: c.x, z: c.z, y: yAt(c.x, c.z, 1.3) }, { force: step.who > 0, when, rate: voiceOf(c), loud: rnd(BURST.cows.loud[0], BURST.cows.loud[1]), name: 'cow_moo_1' });
      if (!ok) { if (step.who === 0) return false; break; }
      n++;
    }
    bursts.cows++; bursts.cowCalls += n;
    return true;
  }
  let dogT = rnd(BURST.first.dogs[0], BURST.first.dogs[1]);
  // the dog barks a few times, each bark after the last one ends (its first call may be the husky's talk or howl, or
  // rarely the grating bark: then that one call is the burst)
  function dogBurst(D, short = false) {
    const k = SOURCES[D.kind] ? D.kind : 'shiba', S = SOURCES[k], p = D.position;
    const at = { x: p.x, z: p.z, y: p.y + 0.5 };
    const first = playClip(k, at, { force: true, list: short ? S.then : S.first, repeat: true });
    if (!first) return false;
    let n = 1;
    if (first.name === 'dog_bark_1' || first.name === 'dog_woof') {
      let when = first.len;
      const plan = burstPlan(short ? 1 : BURST.dogs.answers[1]);
      if (!short && plan.length < 2) plan.push({ who: 1 });   // (a burst is at least two barks)
      for (const step of plan.slice(1)) {
        when += rnd(BURST.dogs.after[0], BURST.dogs.after[1]);
        const r = playClip(k, at, { force: true, when, list: S.then, repeat: true });
        if (!r) break;
        when += r.len; n++;
      }
    }
    bursts.dogs++; bursts.dogCalls += n;
    return true;
  }

  // ── EACH FRAME ───────────────────────────────────────────────────────────────────────────────────────────────
  const chickState = new WeakMap();
  let squawkAt = -99, barkBack = false, dogAt = -99;
  const A = {};
  A.update = (dt, { at, flock = null, P = null, D = null, HS = null, farm = null, RU = null, SH = null, PG = null, traffic = null, indoor = false, music = 0, voice = false } = {}) => {
    if (!alive || !at) return;
    audio.need('ambience', true);
    if (!ctx) return;
    here = at;
    clock += dt;
    const t = ctx.currentTime;
    bus.gain.setTargetAtTime(AMB.level * duckOf({ music, voice, indoor }), t, 0.25);
    cut.frequency.setTargetAtTime(indoor ? AMB.indoor.cut : 18000, t, 0.15);
    if (!audio.running) return;

    // the town's chickens: a squawk when one starts to scatter (and the dog may bark at it)
    const chickens = flock && flock.chickens ? flock.chickens : [];
    for (const c of chickens) {
      const was = chickState.get(c); chickState.set(c, c.state);
      if (c.state === 'run' && was && was !== 'run' && clock - squawkAt > SOURCES.squawk.again && dist(c) < SOURCES.squawk.far) {
        if (playClip('squawk', { x: c.x, z: c.z }, { force: true })) {
          squawkAt = clock;
          if (D && D.position && Math.hypot(D.position.x - c.x, D.position.z - c.z) < 7 && Math.random() < 0.4 && clock - dogAt > BURST.dogs.quiet[0]) barkBack = true;   // (the dog barks back, below)
        }
      }
    }
    const herd = (HS && HS.herd) || [];
    const ofKind = (k) => { const out = []; for (const h of herd) if (h.kind === k) { const s = spotOf(h, { young: !!(h.rec && h.rec.young) }); if (s) out.push(s); } return out; };
    const due = (k) => { timers[k] -= dt; if (timers[k] > 0) return false; const e = SOURCES[k].every; timers[k] = rnd(e[0], e[1]) * slow; return true; };
    const retry = (k, s = 3) => { timers[k] = Math.min(timers[k], s); };
    const tryAt = (k, list) => { const p = any(near(list, SOURCES[k].far)); if (!p || !playClip(k, p)) retry(k); };

    // the hens: a town chicken or a yard hen near the player
    const henDue = due('hens'), roosterDue = due('rooster');
    if (henDue || roosterDue) {
      const hens = [...chickens.map((c) => ({ x: c.x, z: c.z })), ...ofKind('hen')];
      if (henDue) tryAt('hens', hens);
      if (roosterDue) tryAt('rooster', hens);
    }
    if (due('sheep')) tryAt('sheep', [...ofKind('sheep'), ...((SH && SH.sheep) || []).map((s) => spotOf(s))]);
    // the cows, in bursts
    cowT -= dt;
    if (cowT <= 0) {
      const cattle = [...ofKind('cow'), ...((farm && farm.herd) || []).filter((w) => w.a && /Cow/i.test(w.a.kind)).map((w) => spotOf(w)),
        ...((RU && RU.targets) || []).map((s) => spotOf(s))].filter(Boolean);
      cowT = cowBurst(cattle) ? rnd(BURST.cows.quiet[0], BURST.cows.quiet[1]) * slow : 4;
    }
    if (due('herd')) {
      const pa = W.places && W.places.pasture, d = pa ? dist(pa) : Infinity;
      if (pa && d > SOURCES.herd.near && d < SOURCES.herd.far) playClip('herd', { x: pa.x, z: pa.z, y: yAt(pa.x, pa.z, 2) }); else retry('herd', 10);
    }
    // the horses: the wagons' teams standing about, the farm's horse, one in the stable
    if (due('horses')) {
      const horses = [];
      if (traffic) {
        for (const s of traffic.standing || []) if (s.wg && s.wg.team) for (const h of s.wg.team) { const p = spotOf(h); if (p) horses.push(p); }
        for (const w of traffic.wagons || []) if (w.wg && w.wg.idle && w.wg.team) for (const h of w.wg.team) { const p = spotOf(h); if (p) horses.push(p); }
      }
      for (const w of (farm && farm.herd) || []) if (w.a && /Horse/i.test(w.a.kind)) { const p = spotOf(w); if (p) horses.push(p); }
      if (stable) horses.push(stable);
      tryAt('horses', horses.map((h) => ({ x: h.x, z: h.z, y: yAt(h.x, h.z, 1.6) })));
    }
    if (due('myHorse')) {
      const h = P && P.horse, still = h && h.root && !/Walk|Gallop/.test(h.clip || '');
      if (still) tryAt('myHorse', [{ x: h.root.position.x, z: h.root.position.z, y: h.root.position.y + 1.6 }]); else retry('myHorse', 8);
    }
    if (due('pigs')) {
      const pigs = near([...ofKind('pig'), ...((PG && PG.pigs) || []).map((g) => spotOf(g))].filter(Boolean), SOURCES.pigs.far), p = any(pigs);
      if (p && voices < most) {
        const n = 1 + ((Math.random() * 3) | 0), up = p.young ? 1.4 : 1;
        for (let i = 0; i < n; i++) {
          // the throat's pitch moves by its playback speed, never its freq: each new noise freq would build and keep
          // a fresh noise buffer for good (the pitch drop scales with it, so the grunt sounds the same as before)
          const k = up * rnd(0.85, 1.15);
          const P2 = withNodes('TOWN — GRUNT', (x) => (x.id === 'buzz' ? { ...x, rate: (x.rate ?? 1) * k } : x.id === 'drop' ? { ...x, peak: x.peak * k } : x.id === 'f1' ? { ...x, freq: x.freq * up * rnd(0.9, 1.1) } : x.id === 'f2' ? { ...x, freq: x.freq * up * rnd(0.9, 1.1) } : x.id === 'amp' ? { ...x, decay: x.decay * rnd(0.7, 1.3) } : null));
          playAt(P2, { x: p.x, z: p.z, y: yAt(p.x, p.z, 0.5) }, SOURCES.pigs.ref, i * rnd(0.25, 0.4), SOURCES.pigs.level * rnd(0.7, 1)); made.grunt++;
        }
      } else retry('pigs');
    }
    // the birds (none indoors: they are heard through the walls only as the rest is)
    if (due('meadowlark')) { const p = !indoor && meadow(at); if (!p || !playClip('meadowlark', p)) retry('meadowlark', 5); }
    if (due('crows')) { const p = !indoor && crowTree(at); if (!p || !playClip('crows', p)) retry('crows', 8); }
    if (due('hawk')) {
      const a = Math.random() * Math.PI * 2, r = rnd(80, 130);
      if (indoor || !playClip('hawk', { x: at.x + Math.sin(a) * r, z: at.z + Math.cos(a) * r, y: yAt(at.x, at.z, rnd(45, 70)) })) retry('hawk', 20);
    }
    // the dog: a burst now and then (not while it lies resting), or a short one right after a chicken it was near squawked
    if (D && D.position && D.dog) {
      dogT -= dt;
      if (barkBack && dogBurst(D, true)) { dogAt = clock; dogT = Math.max(dogT, rnd(BURST.dogs.quiet[0], BURST.dogs.quiet[1]) * slow * 0.5); }
      else if (dogT <= 0) {
        const lying = D.state && D.state().pose === 'lie';
        if (!lying && dogBurst(D)) { dogAt = clock; dogT = rnd(BURST.dogs.quiet[0], BURST.dogs.quiet[1]) * slow; } else dogT = 5;
      }
    }
    barkBack = false;
    // the work out back
    workT -= dt;
    if (workT <= 0) { workT = 3; doWork(); }
    doCreek(dt, at);
    doHooves(P, at);
  };
  A.state = () => ({ on: !!ctx, loaded: Object.keys(buffers).length, clips: Object.keys(CLIPS).length, ext, voices, played: { ...played }, made: { ...made, hoof: hooves, splash: splashes },
    bursts: { ...bursts }, next: { cows: +cowT.toFixed(1), dog: +dogT.toFixed(1) },
    creek: { on: !!creek, d: Number.isFinite(creekD) ? +creekD.toFixed(1) : null, squares: wet.size }, bus: bus ? +bus.gain.value.toFixed(3) : 0, work, stable });
  // (for rigs: a burst now)
  A.dev = { cows: () => { cowT = 0; }, dog: () => { dogT = 0; }, work: () => { workT = 0; }, out: () => cut };
  A.dispose = () => {
    alive = false; audio.need('ambience', false);
    // (every node this made is let go: the bus, the indoor filter on the master, the hooves' and the creek's)
    const gone = [bus, cut, hoofP, creekG, creekP].filter(Boolean);
    if (creek) { creek.stop(0.05); creek = null; }
    bus = cut = hoofP = creekG = creekP = null; ctx = null;
    if (gone.length) setTimeout(() => { for (const n of gone) try { n.disconnect(); } catch (e) { /* gone */ } }, 800);
  };
  return A;
}
