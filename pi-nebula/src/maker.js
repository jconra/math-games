// THE CHARACTER MAKER's rules (2026-11-19; the game's maker: "let the player pick their own style a bit more. Like have
// a hair, head, body with arrows on either side, plus maybe a skin tone adjustment and height adjustment to the side";
// "It would be great if it showed the character and had arrows to the sides for hear, head, and body. And then some
// color options for hair, skin, and body"; and, asked whether it should have eye colour and freckles too: "Why not,
// people usually like customizing characters").
//
// Nothing here draws: it is the plain rules (which parts a player may wear, which go together, what the arrows step
// to, what is saved), kept apart from the 3D so the tests can run them. The title's panel (ui/title.js) shows them, the
// pictures are drawn by portraits.js, and looks.js recipeOf turns what is saved into the crew kit's recipe.
//
// WHAT IS SAVED with a crew member is their look: { id, size } as before (a ready-made look and a height), and now, laid
// over that look's own recipe, whatever the player changed:
//   suit, head     a part's id in the crew kit (crew.json)          hair   a hair's id, or null: no hair
//   colours        { hair, skin, uniform, eyes: '#rrggbb', freckles: 1 }   (uniform: the body's colour)
// A part stepped back to the look's own is taken out again, so a look put back as it was is the ready-made look.
// A colour is one of the title's swatches or ANY colour picked with a row's "+" (2026-11-19, the game's maker: "for the
// color can we get a + that opens up the color picker so we can have other colors?"). A skin colour picked that way is
// brought inside THE SKIN'S RANGE (skinInRange, below): never white or near white.
//
// THE PARTS ARE THE CREW KIT'S OWN, as they are: nothing is re-made or re-fitted for the maker. What is left out:
//   KEPT_BACK   parts no player wears: Captain Vega's body and his helmet (his own: "Vega is special"). The three
//               captains' bodies are a player's too (2026-11-19, the game's maker: "Players can wear them too", "They are
//               just outfits"), and every body is open from the start ("All 14 from the start");
//   APART       pairings that do not go together cleanly in the kit (a hair on one head, a head on one body): the arrows
//               step past them. Each was looked at from the front, the side and behind (~/pw/space-math/CHARACTER_MAKER.md).

// the arrows' rows, top to bottom; `part` is the crew kit's own word for it, `word` what the player reads
export const ROWS = [
  { id: 'hair', part: 'hair', word: 'Hair' },
  { id: 'head', part: 'head', word: 'Head' },
  { id: 'body', part: 'suit', word: 'Body' },
];
export const KEPT_BACK = { suit: ['vega'], head: ['vega'], hair: [] };
// AN ANDROID'S BODY (the game's maker, 2026-11-19, of a blue-skinned crew member the checks had made: "I guess we have
// aliens now. I wonder if we should let the player pick an android?"): a body that brings its own head and wears no
// hair. While one is worn the head and hair arrows have nothing to step to, and the head and hair the player had are
// kept under it and are theirs again on the next body. THE PLAYER'S ANDROIDS ARE HIS SIX (2026-11-19: the dock worker,
// the heavy one, the old one, the medical, service and feminine ones he made; in the crew kit as a body with its own
// hands and a head with its face plate each, crew.json `with`). Captain Vega's own body is such a body too, but no
// player wears it: "I wasn't going to let the player select Captain Vega because Vega is special."
export const ANDROIDS = ['androidDock', 'androidHeavy', 'androidOld', 'androidMedical', 'androidService', 'androidFeminine'];
export const BRINGS = { vega: { head: 'vega', hair: null }, ...Object.fromEntries(ANDROIDS.map((id) => [id, { head: id, hair: null }])) };
// THE READY-MADE LOOKS THE TITLE OFFERS (looks.js OFFERED: the game's maker, "We should make the bottom 4 androids"):
// the first four people, then four of his androids as he made them (which four: asked). Every look in looks.js LOOKS
// is still worn by whoever saved it; only these eight are offered.
export const OFFERED_LOOKS = ['kai', 'mira', 'dax', 'zuri', 'androidDock', 'androidHeavy', 'androidOld', 'androidMedical'];
export const brings = (suit) => (suit && Object.prototype.hasOwnProperty.call(BRINGS, suit) ? BRINGS[suit] : null);
// A HEAD THAT COMES WITH ONE BODY (an android's, Vega's: BRINGS) worn on any other body: what a ready-made android's
// look comes to when the player steps the Body arrows on to a person's body, since that look has no head of a
// person's own. A person stands in: the head and hair of `person` (the first ready-made look's recipe), in that look's
// own skin and hair colours unless the player has picked theirs; R is the recipe with the look's extras laid over it.
// The android's own head again on its own body, and any head the player steps to is theirs.
export function standIn(R, person) {
  const b = brings(R.suit), owned = Object.values(BRINGS).some((x) => x.head === R.head);
  if (!owned || (b && b.head === R.head) || !person) return R;
  return { ...R, head: person.head, hair: person.hair === undefined ? null : person.hair, colours: { ...(person.colours || {}), ...(R.colours || {}) }, face: {} };
}
// pairings left out: { hair id: [head ids] } and { suit id: [head ids] }
// (2026-11-19: all 13 heads on the 11 bodies and under the 23 hairs, each drawn from the front, the side and behind
// and looked at. No hair is left out on any head. Two heads on a body are: the 40s man's thick neck comes through the
// back of the dark crew uniform's collar in ragged pieces, and the 30s man's neck stands long and bare over the back of
// the women's spacesuit's collar. The 30s man on the dark crew uniform does as the first, but that is the ready-made
// look Sol himself, so it stays: asked.)
export const APART = { hair: {}, suit: { atlantis1: ['t8'], spaceWoman: ['t6'] } };
// (no hair at all is one of the hair row's choices: the last one before the row comes round again)
export const NO_HAIR = null;

const has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
const HEX = /^#[0-9a-f]{6}$/i;

// the ids of one kind a player may wear, in the crew kit's own order (list: crew.json's `parts`)
export function wearable(list, part) {
  const ids = ((list && list[part]) || []).filter((p) => p && p.id && !p.with && !KEPT_BACK[part].includes(p.id)).map((p) => p.id);
  return part === 'hair' ? [...ids, NO_HAIR] : ids;
}
// whether a hair goes on a head, and a head on a body (anything not listed APART does)
export const hairGoes = (hair, head) => !hair || !head || !(APART.hair[hair] || []).includes(head);
export const headGoes = (head, suit) => !head || !suit || !(APART.suit[suit] || []).includes(head);
export const goTogether = (w) => hairGoes(w.hair, w.head) && headGoes(w.head, w.suit);

// a row's choices with the other two parts as worn (w: { suit, head, hair }): the part worn is always one of them
export function choices(list, part, w) {
  if (part !== 'suit' && brings(w.suit)) return [];      // (the android's body brings its own head and wears no hair)
  return wearable(list, part).filter((id) => id === w[part] || goTogether({ ...w, [part]: id }));
}
// the choice an arrow steps to (dir 1: the next, -1: the one before), coming round at the ends
export function step(list, part, w, dir) {
  const all = choices(list, part, w), at = all.indexOf(w[part] === undefined ? null : w[part]);
  if (all.length < 2) return w[part];
  return all[(((at < 0 ? 0 : at + (dir < 0 ? -1 : 1)) % all.length) + all.length) % all.length];
}

// whether a saved look is a made one (anything laid over its ready-made look but the height)
export function isMade(look) {
  if (!look) return false;
  return has(look, 'suit') || has(look, 'head') || has(look, 'hair') || !!(look.colours && Object.keys(look.colours).length);
}
// what a look's picture depends on, as one short text (the height is not in the pictures)
export function keyOf(look) {
  const l = look || {}, c = l.colours || {};
  if (!isMade(l)) return String(l.id || '');
  return [l.id, has(l, 'suit') ? l.suit : '', has(l, 'head') ? l.head : '', has(l, 'hair') ? (l.hair === null ? '-' : l.hair) : '',
    c.hair || '', c.skin || '', c.uniform || '', c.eyes || '', c.freckles ? 'f' : ''].join('~');
}

// A part or a colour set on a saved look -> the new look (the old one is not changed). `own` is the ready-made look's
// own recipe: what is set back to its own is taken out again.
export function withPart(look, part, id, own = {}) {
  const l = { ...(look || {}) };
  if ((own[part] === undefined ? null : own[part]) === id) delete l[part]; else l[part] = id;
  return l;
}
export function withColour(look, what, value, own = {}) {
  const l = { ...(look || {}) }, c = { ...(l.colours || {}) }, mine = (own.colours || {})[what];
  if (!value || value === mine) delete c[what]; else c[what] = value;
  if (Object.keys(c).length) l.colours = c; else delete l.colours;
  return l;
}
// a ready-made look picked: that look as it is, the height kept
export function withLook(look, id) {
  const l = { id };
  if (look && has(look, 'size')) l.size = look.size;
  return l;
}

// THE SKIN'S RANGE: a skin colour picked with the "+" may be any hue (a green or blue crew member is the player's to
// make), but never white or near white (the crew's rule: "they should have a limit on how light they can go"). So a
// picked colour is brought inside the range, never refused: no lighter than the lightest swatch (LIGHTEST: its
// lightness, 0.845 of the way from black to white), and the lighter it is the more colour it must have (none asked up
// to half way; at the lightest, at least SKIN_COLOUR of full: the lightest swatch itself has 0.67), so nothing pale
// and grey gets through; a colour with no hue of its own (a white, a grey) takes the swatches' own warm hue. A colour
// already inside comes back as it was. (The crew kit then holds every tone short of white on the head itself: kit/crew.js
// THE SKIN'S LIMITS.)
export const SKIN_RANGE = { lightest: 0.845, colour: 0.55, from: 0.5, hue: 22 };
export function skinInRange(hex, R = SKIN_RANGE) {
  if (!HEX.test(String(hex))) return null;
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let l = (max + min) / 2, s = d < 1e-9 ? 0 : d / (1 - Math.abs(2 * l - 1)), h = R.hue;
  if (s >= 0.08) h = (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  const l2 = Math.min(l, R.lightest), need = Math.max(0, Math.min(1, (l2 - R.from) / (R.lightest - R.from))) * R.colour, s2 = Math.max(s < 0.08 && need > 0 ? 0 : s, need);
  if (l2 === l && s2 === s) return hex.toLowerCase();
  const c = (1 - Math.abs(2 * l2 - 1)) * s2, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l2 - c / 2, k = Math.floor(h / 60) % 6;
  const [r2, g2, b2] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k];
  return '#' + [r2, g2, b2].map((v) => Math.round(Math.max(0, Math.min(1, v + m)) * 255).toString(16).padStart(2, '0')).join('');
}

// A saved look made safe to wear (the game's own save runs every crew member through this): parts that are no text, or
// kept back, are dropped; a colour that is no '#rrggbb' is dropped, and a skin colour is brought inside THE SKIN'S
// RANGE (so no saved look, however it came to be, has a white skin); anything else on the look is kept.
export function tidy(look) {
  const l = { ...(look || {}) };
  for (const part of ['suit', 'head']) if (has(l, part) && (typeof l[part] !== 'string' || !l[part] || KEPT_BACK[part].includes(l[part]))) delete l[part];
  if (has(l, 'hair') && l.hair !== null && (typeof l.hair !== 'string' || !l.hair)) delete l.hair;
  if (has(l, 'colours')) {
    const c = {}, from = l.colours && typeof l.colours === 'object' ? l.colours : {};
    for (const k of ['hair', 'skin', 'uniform', 'eyes']) {
      const v = typeof from[k] === 'string' && HEX.test(from[k]) ? from[k].toLowerCase() : null;
      if (v) c[k] = k === 'skin' ? skinInRange(v) : v;
    }
    if (from.freckles) c.freckles = 1;
    if (Object.keys(c).length) l.colours = c; else delete l.colours;
  }
  return l;
}
