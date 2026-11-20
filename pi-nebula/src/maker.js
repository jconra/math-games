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
//
// THE PARTS ARE THE CREW KIT'S OWN, as they are: nothing is re-made or re-fitted for the maker. What is left out:
//   KEPT_BACK   parts no player wears: Vega's helmet and his coat (his own), and the three captains' bodies (whether a
//               player may wear a captain's is the game's maker's to say: asked);
//   APART       pairings that do not go together cleanly in the kit (a hair on one head, a head on one body): the arrows
//               step past them. Each was looked at from the front, the side and behind (~/pw/space-math/CHARACTER_MAKER.md).

// the arrows' rows, top to bottom; `part` is the crew kit's own word for it, `word` what the player reads
export const ROWS = [
  { id: 'hair', part: 'hair', word: 'Hair' },
  { id: 'head', part: 'head', word: 'Head' },
  { id: 'body', part: 'suit', word: 'Body' },
];
export const KEPT_BACK = { suit: ['vega', 'captainMan', 'captainOld', 'captainWoman'], head: ['vega'], hair: [] };
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

// A saved look made safe to wear (the game's own save runs every crew member through this): parts that are no text, or
// kept back, are dropped; a colour that is not one of the maker's own swatches is dropped (so no skin is ever lighter
// than the lightest swatch: the crew kit holds even that one short of white); anything else on the look is kept.
// allowed: { hair, skin, uniform, eyes: [colours] } (left out: any '#rrggbb' is kept).
export function tidy(look, allowed = null) {
  const l = { ...(look || {}) };
  for (const part of ['suit', 'head']) if (has(l, part) && (typeof l[part] !== 'string' || !l[part] || KEPT_BACK[part].includes(l[part]))) delete l[part];
  if (has(l, 'hair') && l.hair !== null && (typeof l.hair !== 'string' || !l.hair)) delete l.hair;
  if (has(l, 'colours')) {
    const c = {}, from = l.colours && typeof l.colours === 'object' ? l.colours : {};
    for (const k of ['hair', 'skin', 'uniform', 'eyes']) {
      const v = typeof from[k] === 'string' ? from[k].toLowerCase() : null;
      if (v && HEX.test(v) && (!allowed || !allowed[k] || allowed[k].includes(v))) c[k] = v;
    }
    if (from.freckles) c.freckles = 1;
    if (Object.keys(c).length) l.colours = c; else delete l.colours;
  }
  return l;
}
