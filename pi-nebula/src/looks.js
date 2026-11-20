// The looks a new crew member can pick from: ready-made people put together from the crew kit's heads, hair and
// outfits (kit/crew.js, assets/crew/crew.json). Each is a recipe for the kit's makeCrew().
//
// A NEW ARRIVAL IS POOR: every look wears a plain outfit (the grey crew uniform or civilian clothes), never a
// captain's or a job's. Better outfits are something to earn later.
//
// Each look has two small pictures of the real 3D character: head and shoulders (for cards) and the whole person (for
// the chosen crew member's panel). They are drawn in the player's browser from this very list and the crew kit
// (portraits.js), so a change here or to the crew kit's heads, hair or outfits shows on the title by itself.
// src/tools/looks.html shows them all side by side.
//
// `name` is a few plain words on what the look is, for a screen reader and for anyone who cannot see the picture; the
// title screen does not print it (a person-like name under a picture would be taken for the player's own name).
//
// FOUR READY-MADE ANDROIDS (2026-11-19; the game's maker, asked whether the eight looks should stay beside the character
// maker: "We should make the bottom 4 androids"). The title offers OFFERED: the first four people (on a phone, the top
// row of the grid of four over four) and four of his six androids, each as he made it (its own head, no hair, its own
// colours). Which four he did not say: the four most unlike each other were taken (the dock worker with his wide visor,
// the heavy one with one round lens, the old worn one, the medical one; the service and feminine ones are sleek and
// white as the medical one is): asked. The four looks that stood there (Sol, Ivy, Ren, Noor) are still in LOOKS, so a
// crew member saved with one of them looks exactly as before; the title no longer offers them. All six androids are
// on the character maker's Body arrows (maker.js BRINGS).
//
// WHAT IS SAVED with a player is { id } (save.js), not the whole recipe, so a look that is improved here improves for
// everyone who already picked it, and the picture always matches. What a player changes in the character maker (a
// body, a head, a hair, colours: maker.js) is saved beside the id and laid over the look's recipe by recipeOf() below.

import { BAND_COLOURS as BAND } from '../kit/crew.js';
import { OFFERED_LOOKS, standIn, asWorn } from './maker.js';

// (each uniform look wears its own band colour (the white bands on the grey and dark uniforms): the game's maker asked for
// tinted bands, purple among them, 2026-11-10; the two jackets keep theirs as made)
const SKIN = { fair: '#f2d3bd', light: '#e8bf9f', tan: '#d9a37f', olive: '#c48a62', brown: '#a66d45', deep: '#86522f', dark: '#663b22' };
const HAIR = { black: '#17110d', darkBrown: '#2e1f15', brown: '#4a2f1d', chestnut: '#6b4127', lightBrown: '#8f5a32', darkBlond: '#b4824f', blond: '#d8bc84', red: '#a83c22' };

export const LOOKS = [
  { id: 'kai', name: 'A young man with short curly dark hair, in a jacket',
    recipe: { suit: 'civilian', head: 't10', hair: 'curlyShort', colours: { skin: SKIN.tan, hair: HAIR.darkBrown }, face: { jawWidth: -0.3, eyeSize: 0.3 } } },
  { id: 'mira', name: 'A young woman with a blond bob, in a grey crew uniform',
    recipe: { suit: 'atlantis2', head: 't7', hair: 'q_bob', colours: { skin: SKIN.light, hair: HAIR.blond, uniform: BAND.blue }, face: { cheekbones: 0.6, eyeSize: 0.5, chin: -0.4 } } },
  { id: 'dax', name: 'A young man with short black coiled hair and a beard, in a dark crew uniform',
    recipe: { suit: 'atlantis1', head: 't2', hair: 'coil', colours: { skin: SKIN.dark, hair: HAIR.black, uniform: BAND.gold } } },
  { id: 'zuri', name: 'A woman with a round black afro, in a grey crew uniform',
    recipe: { suit: 'atlantis2', head: 't3', hair: 'afro', colours: { skin: SKIN.deep, hair: HAIR.black, uniform: BAND.purple }, face: { noseWidth: 0.5, jawWidth: 0.3 } } },
  { id: 'sol', name: 'A man with blond hair parted to the side, in a dark crew uniform',
    recipe: { suit: 'atlantis1', head: 't6', hair: 'sidepart', colours: { skin: SKIN.fair, hair: '#c8a56a', uniform: BAND.red }, face: { jawWidth: 0.6, brow: 0.5, noseWidth: -0.5 } } },
  { id: 'ivy', name: 'A woman with wavy red hair and freckles, in a grey crew uniform',
    recipe: { suit: 'atlantis2', head: 't9', hair: 'wavy', colours: { skin: SKIN.fair, hair: HAIR.red, uniform: BAND.teal } } },
  { id: 'ren', name: 'A man with cropped black hair, in a jacket',
    recipe: { suit: 'civilian', head: 't1', hair: 'crop', colours: { skin: SKIN.olive, hair: HAIR.black }, face: { eyeSize: -0.3, jawWidth: -0.4 } } },
  { id: 'noor', name: 'A young woman with a black braid round her head, in a grey crew uniform',
    recipe: { suit: 'atlantis2', head: 't7', hair: 'braidcrown', colours: { skin: SKIN.brown, hair: HAIR.black, uniform: BAND.orange }, face: { noseLength: 0.5, eyeSpacing: -0.4, jawWidth: 0.5, cheekbones: -0.4 } } },
  // (the four ready-made androids: each body brings its own head and wears no hair, maker.js BRINGS)
  { id: 'androidDock', name: 'A big white and yellow android with a wide visor', recipe: { suit: 'androidDock', head: 'androidDock', hair: null } },
  { id: 'androidHeavy', name: 'A heavy android with one round eye', recipe: { suit: 'androidHeavy', head: 'androidHeavy', hair: null } },
  { id: 'androidOld', name: 'An old, worn android', recipe: { suit: 'androidOld', head: 'androidOld', hair: null } },
  { id: 'androidMedical', name: 'A slim white android with a medical cross', recipe: { suit: 'androidMedical', head: 'androidMedical', hair: null } },
];
// the eight the title offers, in the order shown (four over four on a phone: maker.js OFFERED_LOOKS)
export const OFFERED = OFFERED_LOOKS.map((id) => LOOKS.find((l) => l.id === id)).filter(Boolean);

export const lookById = (id) => LOOKS.find((l) => l.id === id) || LOOKS[0];

// The crew kit's recipe for a saved player's look ({ id, ...anything earned since }): the look's own recipe with the
// saved extras laid over it (colours are merged, so one earned colour does not wipe the others). Given the crew kit's
// library (lib: its entry(kind, id)), a saved extra that names a part the crew no longer has (a retired outfit, head or
// hair: 2026-11-17, the old captain1 portrait set) is left out, so the look's own part is worn.
// THE CHARACTER MAKER (2026-11-19, maker.js) saves just such extras: a body (suit), a head, a hair (null: none) and
// colours (hair, skin, uniform: the body's colour, eyes, freckles). A head of the player's own choosing wears its own
// face: the look's face settings were made for the look's own head, and are left off any other.
// (under: the look as it is under a body that brings its own head (the android's: maker.js BRINGS), which is what the
// maker's arrows step from; without it, such a body's own head and no hair are what is worn)
export function recipeOf(saved, lib = null, { under = false } = {}) {
  const base = lookById(saved && saved.id).recipe, extra = { ...(saved || {}) };
  delete extra.id;
  if (lib && lib.entry) for (const k of ['suit', 'head', 'hair', 'hand']) if (typeof extra[k] === 'string' && !lib.entry(k, extra[k])) delete extra[k];
  const face = typeof extra.head === 'string' && extra.head !== base.head ? {} : base.face || {};
  const R = { ...base, ...extra, colours: { ...(base.colours || {}), ...(extra.colours || {}) }, face: { ...face, ...(extra.face || {}) } };
  // (worn: an android's body its own head, no hair and only the colours the player picked, maker.js asWorn; a ready-made
  // android's look stepped on to a person's body: the first look's head and hair stand in for its own, standIn)
  return under ? standIn(R, LOOKS[0].recipe) : asWorn(R, extra.colours, LOOKS[0].recipe);
}
