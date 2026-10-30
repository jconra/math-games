// DOG BREEDS: each breed is one of the game's dogs (its base: the shiba, the husky or the pug) reshaped (a morph,
// morphplan.js) and given a coat (dogcoat.js). Plain data, so the tests read it as it is; dogkind.js makes them.
// The Dog Lab (labs/dogs) tunes them and saves its tuning to models/animals/dogbreeds.json, which the game reads over
// these: what's saved wins, a breed the file doesn't have is as written here.
//
//   BREEDS            id -> { label, base, morph, ears (EAR_SETS id, laid under the morph's own ear numbers), coat,
//                     collar (null, or { colour, studs }), note }
//   BREED_ORDER       the order the lab and the line-up show them in (the keepers)
//   NOT_KEEPERS       breeds kept in the code but shown nowhere (not good enough yet)
//   LATER             breeds noted for later (not made yet)
//   isBreed(id)       one of these ids
//   breedOf(id, saved)  the breed as the game makes it: the saved one (models/animals/dogbreeds.json's) over this one,
//                     every field filled; null for an id that isn't a breed
//   cleanBreed(b)     a breed as it is saved (only known fields, numbers in range)
//   FUR / FUR_KEYS / fillFur(f)   the fur's numbers (dogfur.js draws it): length, softness, strength, sheen, 0..1
//   FUR_BASES         the plain dogs' fur (the shiba, the husky, the pug as the game has them)
//   baseFur(id, saved)  a plain dog's fur: the saved file's (its `fur` block) over FUR_BASES
import { fillMorph, EAR_SETS } from './morphplan.js';
import { fillCoat } from './dogcoat.js';

export const BASES = ['shiba', 'husky', 'pug'];
// (the coats' colours as seen: glossy black, a warm white, a black that is a touch brown in the sun)
const BLACK = '#141110', WHITE = '#f2efe8';
export const BREEDS = {
  // THE BOSTON TERRIER: compact, square, a deep chest, a short square muzzle, big round eyes, big bat ears, a stub
  // tail; a tuxedo: black with a white blaze, muzzle, chest and collar, white feet
  boston: {
    label: 'Boston terrier', base: 'shiba', ears: 'bat',
    morph: { size: 0.95, legFront: 1.04, legBack: 1.08, legThick: 1.12, legSet: 0.25, body: 1.22, chestDepth: 1.02, chestWidth: 1.3, girth: 1.15, tuck: 0.8,
      neck: 0.62, neckThick: 1.3, neckTilt: 0.65, head: 1.1, skull: 1.28, snout: 0.5, muzzle: 1.32, jaw: 1.15, eyes: 1.45, ears: 1.5, earWidth: 1.3,
      tailLength: 0.2, tailThick: 1.3, tailCarry: -0.2, tailCurl: -0.6 },
    coat: { base: BLACK, white: WHITE, blaze: 0.3, blazeTop: 0.75, muzzle: 1, chest: 0.85, collar: 0.35, socksF: 0.3, socksB: 0.12, shade: 0.1 },
    note: 'On the shiba: its snout pulled in, the head, skull and eyes grown, big wide-set bat ears, a short thick neck carried forward, a deep wide chest, a tucked belly, a stub tail.',
  },
  bostonPug: {
    label: 'Boston terrier (on the pug)', base: 'pug', ears: 'bat',
    morph: { size: 1.3, legFront: 1.22, legBack: 1.2, legThick: 1.0, body: 1.0, chestDepth: 1.05, chestWidth: 1.05, girth: 0.95, tuck: 0.5,
      neck: 1.05, head: 0.95, skull: 1.05, snout: 1.35, muzzle: 1, jaw: 1, eyes: 1.2, ears: 1.3, tailLength: 0.3 },
    coat: { base: BLACK, white: WHITE, blaze: 0.3, blazeTop: 0.75, muzzle: 1, chest: 0.85, collar: 0.35, socksF: 0.3, socksB: 0.12, shade: 0.1 },
    note: 'On the pug: already short-faced and sturdy; its legs and snout lengthened a little; eyes and bat ears added (the farm pack pug has neither eyes nor ear bones).',
  },
  bostonFamily: {
    label: "Boston terrier (the family's)", base: 'shiba', ears: 'tipped',
    morph: { size: 0.95, legFront: 1.12, legBack: 1.18, legThick: 1.15, legSet: 0.3, body: 1.35, chestDepth: 1.0, chestWidth: 1.45, girth: 1.15, tuck: 0.9,
      neck: 0.6, neckThick: 1.3, neckTilt: 0.7, head: 1.1, skull: 1.28, snout: 0.6, muzzle: 1.32, jaw: 1.15, eyes: 1.4, ears: 1.6, earWidth: 1.1,
      earSplay: 0.25, earTilt: 0, earFold: 0.35, tailLength: 0.16, tailThick: 1.3, tailCarry: -0.2, tailCurl: -0.6 },
    coat: { base: '#0f0d0d', white: WHITE, blaze: 0.12, blazeTop: 1, muzzle: 1, chest: 0.95, collar: 0.2, socksF: 0.34, socksB: 0.05, shade: 0.08 },
    collar: { colour: '#c4302b', studs: '#d8d2c4' },
    note: "From the family's photos: glossy black, a narrow blaze up to between the ears, a white muzzle, throat and broad bib, white front socks to the wrist and white toes behind, big ears up with the tips folded over, a back longer than a show Boston's, a red studded collar. Measured against the side photo.",
  },
  bostonBrindle: {
    label: 'Boston terrier (brindle)', base: 'shiba', ears: 'bat',
    morph: { size: 0.95, legFront: 1.04, legBack: 1.08, legThick: 1.12, legSet: 0.25, body: 1.22, chestDepth: 1.02, chestWidth: 1.3, girth: 1.15, tuck: 0.8,
      neck: 0.62, neckThick: 1.3, neckTilt: 0.65, head: 1.1, skull: 1.28, snout: 0.5, muzzle: 1.32, jaw: 1.15, eyes: 1.45, ears: 1.5, earWidth: 1.3,
      tailLength: 0.2, tailThick: 1.3, tailCarry: -0.2, tailCurl: -0.6 },
    coat: { base: '#4a3423', white: WHITE, blaze: 0.3, blazeTop: 0.75, muzzle: 1, chest: 0.85, collar: 0.35, socksF: 0.3, socksB: 0.12, shade: 0.1,
      pattern: 'brindle', patternOn: 'base', patternColour: '#0e0b09', patternAmount: 0.85, patternScale: 0.4 },
    note: 'The same dog in brindle (dark stripes over brown), the tuxedo white kept clear of the stripes.',
  },
  borderCollie: {
    label: 'Border collie', base: 'husky', ears: 'tipped',
    morph: { size: 0.86, legFront: 1, legBack: 1, body: 1.08, chestDepth: 1.05, girth: 0.95, tuck: 0.3, neck: 1.05, head: 0.95, snout: 0.95, eyes: 1.1,
      ears: 0.95, earFold: 0.8, earSplay: 0.2, tailLength: 1.25, tailCarry: -0.9, tailCurl: 0.35 },
    coat: { base: '#141212', white: WHITE, blaze: 0.35, blazeTop: 0.6, muzzle: 0.75, chest: 0.9, collar: 0.85, belly: 0.4, socksF: 0.35, socksB: 0.3, tailTip: 0.22, shade: 0.12 },
    note: 'Black and white: a blaze, a white collar and chest, socks, a white tail tip; ears up with the tips tipped, a long low tail.',
  },
  cattleDog: {
    label: 'Australian cattle dog', base: 'husky', ears: 'pricked',
    morph: { size: 0.86, legFront: 0.92, legBack: 0.94, legThick: 1.15, body: 1.05, chestDepth: 1.1, chestWidth: 1.2, girth: 1.12, tuck: 0.25,
      neck: 0.92, neckThick: 1.2, head: 1.08, skull: 1.18, snout: 0.88, muzzle: 1.15, jaw: 1.1, ears: 1.0, earSplay: 0.1, tailLength: 1.0, tailThick: 1.2, tailCarry: -1.1, tailCurl: 0 },
    coat: { base: '#5d6670', white: '#d9dad8', tan: '#a8622e', dark: '#1b1a1b', points: 0.5, eyePatch: 0.5, ears: 'dark', shade: 0.18,
      pattern: 'ticking', patternOn: 'all', patternColour: '#191a1d', patternAmount: 0.75, patternScale: 0.35 },
    note: 'The blue heeler: blue-grey ticked with black hairs, tan legs and eyebrows, dark patches round the eyes and dark ears; sturdy, a broad head, a brush tail.',
  },
  labYellow: {
    label: 'Labrador (yellow)', base: 'husky', ears: 'drop',
    morph: { size: 1, legFront: 0.95, legBack: 0.95, legThick: 1.15, body: 1.02, chestDepth: 1.18, chestWidth: 1.25, girth: 1.18, tuck: 0.2,
      neckThick: 1.2, head: 1.05, skull: 1.15, snout: 0.88, muzzle: 1.2, jaw: 1.15, ears: 0.95, earWidth: 1.25, earLength: 0.95,
      tailLength: 1.05, tailThick: 1.5, tailCarry: -0.7, tailCurl: -0.4 },
    coat: { base: '#d9b47a', white: '#ead3a6', dark: '#a8814e', nose: '#2b211c', chest: 0.25, shade: 0.08 },
    note: 'Broad-headed, solid, an otter tail, drop ears. Yellow, black or chocolate.',
  },
  labBlack: {
    label: 'Labrador (black)', base: 'husky', ears: 'drop',
    morph: { size: 1, legFront: 0.95, legBack: 0.95, legThick: 1.15, body: 1.02, chestDepth: 1.18, chestWidth: 1.25, girth: 1.18, tuck: 0.2,
      neckThick: 1.2, head: 1.05, skull: 1.15, snout: 0.88, muzzle: 1.2, jaw: 1.15, ears: 0.95, earWidth: 1.25, earLength: 0.95,
      tailLength: 1.05, tailThick: 1.5, tailCarry: -0.7, tailCurl: -0.4 },
    coat: { base: '#131111', shade: 0.08 },
    note: 'The black Labrador.',
  },
  labChocolate: {
    label: 'Labrador (chocolate)', base: 'husky', ears: 'drop',
    morph: { size: 1, legFront: 0.95, legBack: 0.95, legThick: 1.15, body: 1.02, chestDepth: 1.18, chestWidth: 1.25, girth: 1.18, tuck: 0.2,
      neckThick: 1.2, head: 1.05, skull: 1.15, snout: 0.88, muzzle: 1.2, jaw: 1.15, ears: 0.95, earWidth: 1.25, earLength: 0.95,
      tailLength: 1.05, tailThick: 1.5, tailCarry: -0.7, tailCurl: -0.4 },
    coat: { base: '#4a2e1f', nose: '#3a2419', shade: 0.08 },
    note: 'The chocolate Labrador (a brown nose too).',
  },
  beagle: {
    label: 'Beagle', base: 'shiba', ears: 'drop',
    morph: { size: 0.95, legFront: 0.9, legBack: 0.9, legThick: 1.1, body: 1.02, chestDepth: 1.1, girth: 1.08, head: 1.05, skull: 1.05, snout: 1.02, muzzle: 1.1, jaw: 1.1, eyes: 1.15,
      ears: 1.15, earLength: 1.4, earWidth: 1.3, earSplay: 2.3, earFold: 0.25, tailLength: 1.05, tailThick: 1.1, tailCarry: 0.9, tailCurl: -1 },
    coat: { base: '#b26a2f', white: WHITE, dark: '#161312', blaze: 0.3, blazeTop: 0.5, muzzle: 0.85, chest: 0.85, belly: 0.8, socksF: 0.5, socksB: 0.45, tailTip: 0.3, saddle: 0.75, shade: 0.1 },
    note: 'Tricolour: a black saddle, tan head and ears, white blaze, muzzle, chest, legs and tail tip; long drop ears, the tail up.',
  },
  dalmatian: {
    label: 'Dalmatian', base: 'husky', ears: 'drop',
    morph: { size: 0.98, legFront: 1.05, legBack: 1.05, body: 1.02, chestDepth: 1.05, girth: 0.95, tuck: 0.4, neck: 1.1, head: 0.98, snout: 1.05,
      ears: 0.9, earWidth: 1.15, earLength: 0.95, tailLength: 1.15, tailThick: 0.9, tailCarry: -0.5, tailCurl: -0.5 },
    coat: { base: '#f1eee8', dark: '#151312', nose: '#141212', shade: 0.06, pattern: 'spots', patternOn: 'all', patternColour: '#141212', patternAmount: 0.95, patternScale: 0.45 },
    note: 'White with round black spots (from the pattern picture: the faces are too big to paint spots on).',
  },
};
// (not keepers, the game's maker 2026-10-29: the Boston on the pug, "the ears aren't connected to the body", and the
// brindle, "very unnatural waves on it": kept here as made, but out of the lab's line-up and not for sale)
// THE FUR (a shader over the painted coat, no extra geometry: dogfur.js). [default, min, max, step, label]
//   length    how long the strands look: short (a Boston's, a Lab's) .. long and loose (a collie's, a husky's)
//   softness  how soft the light falls over it (wrapped round the sides) and how blurred the strands are
//   strength  how much the strands break up the flat colour (0: the painted coat as it was)
//   sheen     the light catching the fur's edge at grazing angles
export const FUR = {
  length:   [0.3, 0, 1, 0.01, 'Length'],
  softness: [0.35, 0, 1, 0.01, 'Softness'],
  strength: [0.55, 0, 1, 0.01, 'Strength'],
  sheen:    [0.5, 0, 1, 0.01, 'Sheen'],
};
export const FUR_KEYS = Object.keys(FUR);
export function fillFur(f = {}) {
  const o = {};
  for (const k of FUR_KEYS) { const [d, lo, hi] = FUR[k], v = f && Number.isFinite(+f[k]) && f[k] !== null && f[k] !== '' ? +f[k] : d; o[k] = +Math.min(hi, Math.max(lo, v)).toFixed(3); }
  return o;
}
const SHORT = { length: 0.12, softness: 0.25, strength: 0.5, sheen: 0.45 };
const FUR_OF = {
  boston: SHORT, bostonPug: SHORT, bostonFamily: SHORT, bostonBrindle: SHORT, beagle: SHORT, dalmatian: { ...SHORT, strength: 0.45 },
  labYellow: { length: 0.22, softness: 0.35, strength: 0.5, sheen: 0.5 }, labBlack: { length: 0.22, softness: 0.35, strength: 0.5, sheen: 0.55 },
  labChocolate: { length: 0.22, softness: 0.35, strength: 0.5, sheen: 0.5 },
  cattleDog: { length: 0.3, softness: 0.35, strength: 0.55, sheen: 0.45 },
  borderCollie: { length: 0.85, softness: 0.75, strength: 0.7, sheen: 0.6 },
};
for (const [id, f] of Object.entries(FUR_OF)) if (BREEDS[id]) BREEDS[id].fur = { ...f };
export const FUR_BASES = {
  shiba: { length: 0.5, softness: 0.6, strength: 0.6, sheen: 0.5 },
  husky: { length: 0.7, softness: 0.7, strength: 0.65, sheen: 0.55 },
  pug: { ...SHORT },
};
export function baseFur(id, saved = null) {
  const own = FUR_BASES[id] || {}, file = saved && saved.fur && saved.fur[id];
  return fillFur({ ...own, ...(file || {}) });
}

export const NOT_KEEPERS = ['bostonPug', 'bostonBrindle'];
export const BREED_ORDER = ['boston', 'bostonFamily', 'borderCollie', 'cattleDog', 'labYellow', 'labBlack', 'labChocolate', 'beagle', 'dalmatian'];
export const LATER = ['German shepherd (saddle, black mask, big pricked ears)', 'Corgi (very short legs, long body, big ears)', 'Dachshund (very short legs, very long body, drop ears)',
  'Greyhound (long legs, deep chest, tucked belly, thin tail)', 'Basset hound (short legs, long ears, heavy head)', 'Coonhound (black and tan, long ears)', 'Bloodhound (long ears, loose skin: the face a morph cannot fold)'];
export const isBreed = (id) => Object.prototype.hasOwnProperty.call(BREEDS, id);

// a collar: off, or its colour and its studs' (null: no studs)
const HEX = /^#[0-9a-f]{6}$/i;
const cleanCollar = (c) => (c && typeof c === 'object' && HEX.test(c.colour || '') ? { colour: c.colour.toLowerCase(), studs: HEX.test(c.studs || '') ? c.studs.toLowerCase() : null } : null);
// (the morph is kept as it differs from its ear set's numbers over the defaults, the coat as it differs from the
// defaults: the file stays short, and a slider put back to where its set has it is simply left out)
const earBase = (ears) => { const { label, ...nums } = EAR_SETS[ears] || {}; return fillMorph(nums); };
export function cleanBreed(b = {}, fallback = {}) {
  const base = BASES.includes(b.base) ? b.base : BASES.includes(fallback.base) ? fallback.base : 'shiba';
  const own = (k) => (b[k] !== undefined ? b[k] : fallback[k]);
  const ears = Object.prototype.hasOwnProperty.call(EAR_SETS, own('ears')) ? own('ears') : 'asMade';
  const baseline = earBase(ears), full = fillMorph({ ...baseline, ...(own('morph') || {}) });
  const morph = {}; for (const k of Object.keys(full)) if (Math.abs(full[k] - baseline[k]) > 1e-9) morph[k] = +full[k].toFixed(3);
  const coatFull = fillCoat(own('coat') || {}), coatDef = fillCoat({});
  const coat = {}; for (const k of Object.keys(coatFull)) if (coatFull[k] !== coatDef[k]) coat[k] = typeof coatFull[k] === 'number' ? +coatFull[k].toFixed(3) : coatFull[k];
  return {
    label: String(own('label') || 'Dog').slice(0, 60), base, ears, morph, coat,
    collar: cleanCollar(own('collar')),
    fur: fillFur(own('fur') || {}),
    note: String(own('note') ?? '').slice(0, 600),
  };
}
export function breedOf(id, saved = null) {
  const own = BREEDS[id], file = saved && saved.breeds && saved.breeds[id];
  if (!own && !file) return null;
  const b = cleanBreed(file || own, file ? own || {} : {});
  return { id, ...b, morphFull: fillMorph({ ...earBase(b.ears), ...b.morph }), coatFull: fillCoat(b.coat), furFull: b.fur };
}
