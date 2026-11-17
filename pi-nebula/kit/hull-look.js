// THE HULL'S LOOK, AS SETTINGS: what the outside of the station is made to look like, as one plain object of numbers,
// colours and names (no three.js here, so the tests can read it). The game's maker, 2026-11-17: "I would prefer to have
// darker grey on the outside. I hope we can add some overlapping wearing and other metal textures like tempered,
// brushed, cross-hatches. The texture you put on the floor of the hanger is really nice. It would be great to have extra
// darkness around lines and edges to make the flat area really pop. It could even be cool to have a lab to experiment."
//   kit/hull.js turns a look into materials (hullMaterials) and a plan into plated tiers (buildHull);
//   labs/hull/ is the lab where the look is tried out; its "Copy settings" text is writeLook's.
//
// THE SETTINGS (every one listed in SETTINGS below, with its range, its plain name and the window it sits in):
//   colours   grey, grey2 (alternate plates), trim, vary (how much one plate differs from the next), windowColour,
//             windowBright
//   plates    plateW, plateH (metres), lap (how far a row laps over the row below; 0: flush), bevel (how wide and deep
//             the slope round every plate is), cut (how far a plate's four corners are cut back), gap (the seam between neighbours), shift (how far each row is slid along
//             from the row below, as a part of a plate: 0.5 is brickwork), uneven (how much the plates of a row differ
//             in width), unevenRows (how much the rows differ in height)
//   finish    for each group of plates (band: the wide middle band; tiers: the stepped tiers above and below; trim:
//             frames, lips and window surrounds): <group>Finish (plain | brushed | tempered | hatched | mottled),
//             <group>Strength, <group>Angle (brushed: which way the brushing runs; hatched: the lines' slant),
//             <group>Spacing (hatched: between lines), <group>Edges (tempered: how much the heat colours gather toward
//             a plate's edges), <group>Shine (how much it mirrors the sky and the sun), <group>Rough (how blurred that
//             shine is)
//   wear      scratches, edgeWear (paler worn metal along exposed edges), streaks (dark, running from seams), pits (from
//             meteoroids: a dark pit, a bright rim), grime (in the corners): each its own amount, 0 to 1, and they stack
//   edges     edgeDark (how dark), edgeWide (how wide, metres): the shading along every seam, plate edge and inside
//             corner
export const FINISHES = ['plain', 'brushed', 'tempered', 'hatched', 'mottled'];
export const FINISH_NAMES = { plain: 'Plain', brushed: 'Brushed', tempered: 'Tempered', hatched: 'Cross-hatched', mottled: 'Mottled' };
export const GROUPS = ['band', 'tiers', 'trim'];
export const GROUP_NAMES = { band: 'Middle band', tiers: 'Tiers', trim: 'Trim' };
// which of a group's settings each finish uses (the lab shows only these; Shine and Rough always)
export const FINISH_USES = { plain: [], brushed: ['Angle', 'Strength'], tempered: ['Strength', 'Edges'], hatched: ['Spacing', 'Angle', 'Strength'], mottled: ['Strength'] };

const num = (key, win, label, def, min, max, step, unit = '', title = '') => ({ key, kind: 'number', win, label, def, min, max, step, unit, title });
const colour = (key, win, label, def, title = '') => ({ key, kind: 'colour', win, label, def, title });
const choice = (key, win, label, def, options, title = '') => ({ key, kind: 'choice', win, label, def, options, title });

// (units: 'm' shown in metres, 'cm' kept in metres and shown in centimetres, '%' kept 0 to 1 and shown as a percentage,
// 'deg' degrees, '' a plain number)
export const SETTINGS = [
  colour('grey', 'colours', 'Main grey', '#474c54', 'The plates\' main grey'),
  colour('grey2', 'colours', 'Second grey', '#3b3f46', 'Every other plate'),
  colour('trim', 'colours', 'Trim', '#191b1f', 'Frames, lips and window surrounds'),
  num('vary', 'colours', 'Plate to plate', 0.06, 0, 0.3, 0.01, '%', 'How much one plate differs from the next'),
  colour('windowColour', 'colours', 'Window light', '#cfeeff', 'The colour of the lit windows'),
  num('windowBright', 'colours', 'Window brightness', 2, 0, 6, 0.1, '', 'How bright the windows are'),

  num('plateW', 'plates', 'Width', 7, 1, 12, 0.1, 'm', 'How wide a plate is'),
  num('plateH', 'plates', 'Height', 3, 0.6, 6, 0.1, 'm', 'How tall a plate is'),
  num('lap', 'plates', 'Lap over the next', 0, 0, 1, 0.01, 'cm', 'How far each row laps over the row below (0: the rows sit flush)'),
  num('bevel', 'plates', 'Bevel', 0.35, 0, 1, 0.01, 'cm', 'How wide and deep the slope round every plate is'),
  num('cut', 'plates', 'Cut corners', 0.45, 0, 1.2, 0.01, 'cm', 'How far each plate\'s four corners are cut back (0: square corners)'),
  num('gap', 'plates', 'Seam gap', 0.06, 0, 0.3, 0.005, 'cm', 'The gap between neighbouring plates'),
  num('shift', 'plates', 'Row shift', 0, 0, 0.5, 0.01, '%', 'How far each row is slid along from the row below (50%: like brickwork)'),
  num('uneven', 'plates', 'Uneven widths', 0.6, 0, 1, 0.01, '%', 'How much the plates in a row differ in width (0: all the same)'),
  num('unevenRows', 'plates', 'Uneven heights', 0.5, 0, 1, 0.01, '%', 'How much the rows differ in height (0: all the same)'),

  ...GROUPS.flatMap((g) => [
    choice(g + 'Finish', 'finish', 'Finish', 'plain', FINISHES),
    num(g + 'Strength', 'finish', 'Strength', 0.5, 0, 1, 0.01, '%', 'How strongly the finish shows'),
    num(g + 'Angle', 'finish', 'Direction', 0, 0, 180, 1, 'deg', 'Brushed: the way the brushing runs (0: along the hull, 90: up and down). Cross-hatched: the lines\' slant'),
    num(g + 'Spacing', 'finish', 'Spacing', 0.12, 0.04, 0.6, 0.01, 'cm', 'Cross-hatched: from one line to the next'),
    num(g + 'Edges', 'finish', 'Toward the edges', 0.5, 0, 1, 0.01, '%', 'Tempered: how much the heat colours gather toward a plate\'s edges'),
    num(g + 'Shine', 'finish', 'Shine', 0.4, 0, 1, 0.01, '%', 'How much it mirrors the sky and the sun, as bare metal does (0: like paint)'),
    num(g + 'Rough', 'finish', 'Shine blur', 0.55, 0.05, 1, 0.01, '%', 'How blurred the shine is (low: a sharp glint; high: a soft sheen)'),
  ].map((s) => ({ ...s, group: g }))),

  num('scratches', 'wear', 'Scratches and scuffs', 0.2, 0, 1, 0.01, '%'),
  num('edgeWear', 'wear', 'Worn edges', 0.15, 0, 1, 0.01, '%', 'Paler worn metal along the exposed edges'),
  num('streaks', 'wear', 'Dark streaks', 0.1, 0, 1, 0.01, '%', 'Dark streaks running from the seams'),
  num('pits', 'wear', 'Meteoroid pits', 0.1, 0, 1, 0.01, '%', 'Small pits: a dark pit, a bright rim'),
  num('grime', 'wear', 'Grime in corners', 0.15, 0, 1, 0.01, '%'),

  num('edgeDark', 'edges', 'How dark', 0.6, 0, 1, 0.01, '%', 'How dark the shading along seams, plate edges and inside corners is'),
  num('edgeWide', 'edges', 'How wide', 0.3, 0, 1, 0.01, 'cm', 'How far that shading reaches into a plate\'s flat from its edge'),
];
export const SETTING = Object.fromEntries(SETTINGS.map((s) => [s.key, s]));

// ── THE READY-MADE LOOKS (each a whole look; the lab starts from the first) ──────────────────────────────────────
const finish = (g, kind, o = {}) => ({ [g + 'Finish']: kind, [g + 'Strength']: o.strength ?? 0.5, [g + 'Angle']: o.angle ?? 0, [g + 'Spacing']: o.spacing ?? 0.12, [g + 'Edges']: o.edges ?? 0.5, [g + 'Shine']: o.shine ?? 0.4, [g + 'Rough']: o.rough ?? 0.55 });
export const HULL_LOOKS = {
  // like the game's maker's own pictures of the station: dark greys, darker trim, heavy bevelled plates with cut
  // corners, dark seams, a soft brushed sheen, very little wear
  'dark armour': {
    grey: '#474c54', grey2: '#3b3f46', trim: '#191b1f', vary: 0.08, windowColour: '#a9dcff', windowBright: 2,
    plateW: 7, plateH: 3, lap: 0, bevel: 0.35, gap: 0.05, cut: 0.45, shift: 0, uneven: 0.6, unevenRows: 0.6,
    ...finish('band', 'brushed', { strength: 0.35, angle: 0, shine: 0.25, rough: 0.6 }),
    ...finish('tiers', 'brushed', { strength: 0.3, angle: 90, shine: 0.25, rough: 0.62 }),
    ...finish('trim', 'hatched', { strength: 0.45, angle: 45, spacing: 0.12, shine: 0.3, rough: 0.6 }),
    scratches: 0.2, edgeWear: 0.15, streaks: 0.1, pits: 0.08, grime: 0.15,
    edgeDark: 0.6, edgeWide: 0.3,
  },
  // closer to the station's insides: pale painted plates between dark seams and trim
  'pale plates, dark seams': {
    grey: '#aeb0ad', grey2: '#9a9c9b', trim: '#2b2e33', vary: 0.04, windowColour: '#fff1d6', windowBright: 2,
    plateW: 5, plateH: 3, lap: 0, bevel: 0.12, gap: 0.08, cut: 0.25, shift: 0, uneven: 0, unevenRows: 0,
    ...finish('band', 'mottled', { strength: 0.3, shine: 0.08, rough: 0.62 }),
    ...finish('tiers', 'plain', { shine: 0.08, rough: 0.6 }),
    ...finish('trim', 'brushed', { strength: 0.4, angle: 0, shine: 0.45, rough: 0.42 }),
    scratches: 0.3, edgeWear: 0.1, streaks: 0.15, pits: 0.06, grime: 0.3,
    edgeDark: 0.7, edgeWide: 0.22,
  },
  // the older, run-down station of later in the story: lapped plates, heat-stained, pitted, streaked
  'old and worn': {
    grey: '#56575b', grey2: '#47484c', trim: '#1c1b1b', vary: 0.16, windowColour: '#ffd39a', windowBright: 1.4,
    plateW: 4.6, plateH: 2.2, lap: 0.3, bevel: 0.2, gap: 0.08, cut: 0.2, shift: 0.5, uneven: 0.7, unevenRows: 0.5,
    ...finish('band', 'mottled', { strength: 0.5, shine: 0.45, rough: 0.56 }),
    ...finish('tiers', 'tempered', { strength: 0.6, edges: 0.7, shine: 0.55, rough: 0.45 }),
    ...finish('trim', 'hatched', { strength: 0.6, angle: 45, spacing: 0.14, shine: 0.25, rough: 0.72 }),
    scratches: 0.7, edgeWear: 0.6, streaks: 0.6, pits: 0.4, grime: 0.65,
    edgeDark: 0.75, edgeWide: 0.42,
  },
};
export const LOOK_NAMES = Object.keys(HULL_LOOKS);
export const DEFAULT_LOOK = LOOK_NAMES[0];

// ── READ, CLAMP, WRITE ───────────────────────────────────────────────────────────────────────────────────────────
const round = (v, step) => { const p = Math.max(0, Math.min(6, Math.ceil(-Math.log10(step)) + 2)); return +v.toFixed(p); };
// a colour as '#rrggbb' (lower case), or null: '#abc' and 'AABBCC' are read too
export function readColour(v) {
  if (typeof v !== 'string') return null;
  const m = /^\s*#?([0-9a-f]{6}|[0-9a-f]{3})\s*$/i.exec(v); if (!m) return null;
  const h = m[1].toLowerCase(); return '#' + (h.length === 3 ? h.replace(/./g, (c) => c + c) : h);
}
// one setting's value made good: a number inside its range, a colour, one of the choices; anything else gives `base`
export function readSetting(s, v, base = s.def) {
  if (s.kind === 'colour') return readColour(v) || base;
  if (s.kind === 'choice') return s.options.includes(v) ? v : base;
  if (typeof v === 'string' && v.trim() !== '') v = Number(v);
  if (typeof v !== 'number' || !Number.isFinite(v)) return base;
  return round(Math.max(s.min, Math.min(s.max, v)), s.step);
}
// A WHOLE LOOK from anything: an object, or text (writeLook's, with or without other words round it). Every setting
// comes back, inside its range; what is missing or wrong is taken from `base` (the first ready-made look); names the
// look does not have are dropped.
export function readLook(input, base = HULL_LOOKS[DEFAULT_LOOK]) {
  let o = input;
  if (typeof input === 'string') {
    const a = input.indexOf('{'), b = input.lastIndexOf('}');
    try { o = a >= 0 && b > a ? JSON.parse(input.slice(a, b + 1)) : null; } catch (_) { o = null; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) o = {};
  const out = {};
  for (const s of SETTINGS) out[s.key] = readSetting(s, o[s.key], readSetting(s, base ? base[s.key] : undefined));
  return out;
}
// did that text hold a look at all? (something with at least one of the look's own names in it)
export function isLookText(text) {
  if (typeof text !== 'string') return false;
  const a = text.indexOf('{'), b = text.lastIndexOf('}'); if (a < 0 || b <= a) return false;
  try { const o = JSON.parse(text.slice(a, b + 1)); return !!o && typeof o === 'object' && !Array.isArray(o) && SETTINGS.some((s) => s.key in o); } catch (_) { return false; }
}
// a look as text: one line a window of settings, so it can be read as well as pasted
const WINS = ['colours', 'plates', 'finish', 'wear', 'edges'];
export function writeLook(look) {
  const L = readLook(look), lines = [];
  for (const w of WINS) {
    const mine = SETTINGS.filter((s) => s.win === w);
    // (the finish: a line a group)
    const rows = w === 'finish' ? GROUPS.map((g) => mine.filter((s) => s.group === g)) : [mine];
    for (const r of rows) lines.push(r.map((s) => JSON.stringify(s.key) + ':' + JSON.stringify(L[s.key])).join(','));
  }
  return '{"hull look":1,\n' + lines.join(',\n') + '}';
}
export const sameLook = (a, b) => SETTINGS.every((s) => readSetting(s, a?.[s.key]) === readSetting(s, b?.[s.key]));
// the name of the ready-made look these settings are, or null
export const lookName = (look) => LOOK_NAMES.find((n) => sameLook(HULL_LOOKS[n], look)) || null;

// the plates' own sizes out of a look (what the plate builder needs)
export const plateSizes = (look) => ({ w: look.plateW, h: look.plateH, lap: look.lap, bevel: look.bevel, gap: look.gap, cut: look.cut, shift: look.shift, uneven: look.uneven, unevenRows: look.unevenRows });
// a setting's value as the lab shows it: a plain number with its unit
export function showValue(s, v) {
  if (s.kind !== 'number') return String(v);
  if (s.unit === 'cm') return +(v * 100).toFixed(1) + ' cm';
  if (s.unit === '%') return Math.round(v * 100) + '%';
  if (s.unit === 'deg') return Math.round(v) + '°';
  if (s.unit === 'm') return (+v.toFixed(2)) + ' m';
  return String(+v.toFixed(2));
}
