// THE GOVERNOR (Mathwood Valley): the game watches how fast it really runs on this machine and turns its DIALS up while
// there is room, and down when there isn't. On potato the valley starts bare (nothing decorative, the old horse); on a
// strong gaming PC it climbs till every horse is the new one, the roads are busy with travellers and every plant and
// decoration is in.
//
// DAD'S RULES (2026-10-27): "start adding things at > 60 and take away things at < 50. Also, things taken away should only
// be behind the player or occluded. And things added should be from a node like a door or the road out of sight."
//   ADD when the frame has clear spare time, held for GOV.addWin seconds:
//     on a screen faster than 60 Hz: over 60 fps;
//     on a 60 Hz screen (vsync holds it at 60, so "over 60" never comes): at the refresh with no frames dropped, and the
//     frame's own work (measured from the start of the game's frame to the end of drawing it) under 70% of the refresh's
//     interval at the 90th percentile; where the browser offers GPU timer queries, the GPU's time for the frame as well.
//   TAKE AWAY when the frame rate stays under 50 for GOV.downWin seconds (on a screen slower than 60 Hz: 83% of its refresh).
//   Anything that would hitch is left out of the count: a frame over 100 ms, the slowest 3% of frames, the second after a
//   change, a hidden tab.
// TWO LANES:
//   PEOPLE (travellers, wagons, townsfolk, chickens, the far figures): the fast lane, turned while playing. Nothing
//     vanishes or pops in view: a new one comes in from out of sight (a road's end, a stretch of road out of view, a door),
//     and one taken away goes only once it is out of sight (behind the camera, behind a building or a rise, far off), or
//     through a door; until then it waits its turn (each system keeps to it: src/sight.js).
//   SCENERY (resolution, shadows, grass and plants, lawn, stones, trees, ground, clouds, sunbeams, decorations, the horse's
//     look, fences): the slow lane. It can't come in through a door, so it changes only at a moment that hides the change
//     (a CURTAIN): the title screen, a menu or counter open (the game paused), inside the cabin, deep in the mist at the
//     valley's ends. The resolution only on the title and in the mist (a paused screen would go blank). At a curtain the
//     slow lane takes one step from what the last stretch of riding showed: up when the frame had spare time and the
//     people lane is as far along as the scenery; down when it was too slow and the people lane is already low (people
//     first). With no curtain for a while, the step it wants is remembered for the next load.
//   AUTO CLIMBS BACK UP (the game's maker, 2026-10-30: "If auto can move the setting down, then I would think it would be
//     able to move it back up again also, as long as it's not a selected choice"): smooth riding raises the scenery rung the
//     game is heading for (GOAL) a step every GOV.climbEvery s, with no curtain needed, as far as the start of the band above
//     this load's (one band a load: the load after is what measures that band). The goal is what's remembered, so the band
//     and its reload-only settings follow on the next load; nothing heavy is reloaded in the middle of play. A curtain takes
//     up to GOV.curtainMost of the steps waiting. Too slow again: the steps not yet taken are forgotten at once.
//   NO FLAPPING: a rung that fails soon after it came up is a ceiling for a while (GOV.backoff; for the scenery, that rung
//     and all above it, GOV.sceneryBackoff), and a band that falls soon
//     after it came up isn't tried again for half an hour, doubling each time, kept with the machine's memory across loads
//     (GOV.bandProbe, bandHold); one that held a good while and then fell (a hot phone) rests GOV.bandRest. A choice made by
//     hand or in the address pins it all: no climbing, nothing remembered.
//
// THE DIALS: everything the governor can turn, each with its levels (lowest first) and what a level costs (GOVERNOR.md).
// THE LADDERS: one order for each lane. Each step turns one dial up one level; going up the next step is added, going down
// the last one taken away. A tier is a pair of rungs: potato starts at 0, 0 (bare); normal and gaming at the rungs that
// look as those tiers looked before the governor. Past gaming: more grass, more people, more of everything.
// The reload dials (the land's mesh, the screen's smoothing, the models' pictures, the shadow map itself) follow the BAND
// the scenery rung is in (potato, normal, gaming), chosen at load from the rungs remembered for this graphics card
// (world/quality.js), so the next load starts right.
//
//   const G = makeGovernor({ renderer, quality })   (src/world.js makes it and attaches it: W.governor)
//   G.on(dial, fn)        fn(value, level, dialName) now and whenever that dial's level changes; returns off()
//   G.limit(dial, most, why, reload)   the highest level this machine can have of a dial (reload: until a reload); a step
//                         past it changes nothing, and the governor goes straight past it
//   G.level(dial), G.value(dial)   now
//   G.scenery, G.people   the two rungs;  G.set(scenery, people, why)   (rigs) straight there
//   G.pin(tier | null)    a tier chosen by hand pins the dials at that tier's rungs (saved); null: Auto again (the default)
//   G.scene = () => 'title' | 'play' | 'paused' | 'cabin' | 'away'   set by the game (src/main.js): where the curtains are
//   G.work(t0)            the game's frame began at t0 (performance.now()) and is done now: its own work
//   G.state()             for rigs and the ?perf overlay
// The address can carry: ?gov=potato|normal|gaming or ?gov=<scenery>,<people> (start there, auto), ?gov=off (pinned at
// the loaded tier), ?auto (with ?q=: start at that tier but let the governor walk), ?govlog (each change in the console).
import { TIERS, gpuName, recall, remember, saveTier, savedTier } from './quality.js';
import { gpuMemory } from './gpumem.js';
import { onGraphicsRestored } from './gfxrestore.js';

// ── THE DIALS ────────────────────────────────────────────────────────────────────────────────────────────────────
// lane: 'people' (live, out of sight) or 'scenery' (at a curtain); live: 'live', or 'hook' (the system that owns it
// decides how: a helper wires it)
export const DIALS = {
  ratio: { label: 'Resolution', lane: 'scenery', live: 'live', about: 'pixels drawn per screen pixel (never more than the screen has); only on the title or in the mist',
    levels: [{ name: '0.5x', v: 0.5 }, { name: '0.75x', v: 0.75 }, { name: '1x', v: 1 }, { name: '1.5x', v: 1.5 }, { name: '2x', v: 2 }] },
  shadows: { label: 'Shadows', lane: 'scenery', live: 'live', about: 'the sun\'s real shadows: the map\'s size, how far round you, and whether the plants cast them',
    levels: [{ name: 'off', v: { off: true } }, { name: '512/40 m', v: { size: 512, range: 40, plants: false } }, { name: '1024/60 m', v: { size: 1024, range: 60, plants: false } },
      { name: '2048/70 m', v: { size: 2048, range: 70, plants: false } }, { name: '2048/70 m +plants', v: { size: 2048, range: 70, plants: true } }, { name: '4096/90 m +plants', v: { size: 4096, range: 90, plants: true } }] },
  grass: { label: 'Grass & plants', lane: 'scenery', live: 'live', about: 'the meadow plants (and painted flowers among them): how many, out to how far, meshes out to `near` (imposters past it)',
    levels: [{ name: 'none', v: { count: 0, near: 0, radius: 90, farX: 1.8 } }, { name: '2,900 far', v: { count: 2900, near: 0, radius: 90, farX: 1.8 } },
      { name: '5,000', v: { count: 5000, near: 40, radius: 115, farX: 2.4 } }, { name: '7,000', v: { count: 7000, near: 70, radius: 140, farX: 3.1 } },
      { name: '16,000', v: { count: 16000, near: 85, radius: 210, farX: 3.1 } }, { name: '30,000', v: { count: 30000, near: 100, radius: 290, farX: 3.1 } },
      { name: '45,000 thick', v: { count: 45000, near: 110, radius: 300, farX: 3.1 } }, { name: '60,000 thicker', v: { count: 60000, near: 120, radius: 330, farX: 3.1 } }] },
  lawn: { label: 'Lawn grass', lane: 'scenery', live: 'live', about: 'the short grass tufts on the bare ground near you',
    levels: [{ name: 'none', v: { radius: 0, density: 0 } }, { name: '25 m', v: { radius: 25, density: 0.7 } }, { name: '40 m', v: { radius: 40, density: 1 } },
      { name: '60 m', v: { radius: 60, density: 1 } }, { name: '75 m thick', v: { radius: 75, density: 1.2 } }, { name: '90 m thicker', v: { radius: 90, density: 1.4 } }] },
  stones: { label: 'Stones', lane: 'scenery', live: 'live', about: 'the share of the loose stones drawn (the creeks\' first; more than were laid needs a reload)',
    levels: [{ name: 'none', v: 0 }, { name: 'a quarter', v: 0.25 }, { name: 'half', v: 0.5 }, { name: 'all', v: 1 }] },
  trees: { label: 'Trees up close', lane: 'scenery', live: 'live', about: 'how far out trees are real models (imposters past it)',
    levels: [{ name: 'imposters', v: { at: 0, band: 0 } }, { name: '60 m', v: { at: 60, band: 40 } }, { name: '150 m', v: { at: 150, band: 120 } },
      { name: '260 m', v: { at: 260, band: 140 } }, { name: '350 m', v: { at: 350, band: 160 } }, { name: '450 m', v: { at: 450, band: 180 } }] },
  ground: { label: 'Ground detail', lane: 'scenery', live: 'live', about: 'the ground\'s shader: the anti-repeat tiling, the leaves and twigs painted on it, the far detail, the water\'s waves',
    levels: [{ name: 'plain', v: { hexOn: 0, stampOn: 0, stampFar: 12, farOn: 0, wWaveOn: 0 } }, { name: 'tiled', v: { hexOn: 1, stampOn: 0, stampFar: 12, farOn: 0, wWaveOn: 0 } },
      { name: 'leaves 12 m', v: { hexOn: 1, stampOn: 1, stampFar: 12, farOn: 0, wWaveOn: 0 } }, { name: 'leaves 30 m, waves', v: { hexOn: 1, stampOn: 1, stampFar: 30, farOn: 0, wWaveOn: 1 } },
      { name: 'leaves 73 m, far detail', v: { hexOn: 1, stampOn: 1, stampFar: 73, farOn: 1, wWaveOn: 1 } }] },
  sky: { label: 'Clouds', lane: 'scenery', live: 'live', about: 'the cloud dome (off: a plain sky colour)', levels: [{ name: 'off', v: false }, { name: 'on', v: true }] },
  beams: { label: 'Sunbeams', lane: 'scenery', live: 'live', about: 'shafts of light from a low sun (a full-screen pass)', levels: [{ name: 'off', v: false }, { name: 'on', v: true }] },
  props: { label: 'Decorations', lane: 'scenery', live: 'live', about: 'the town\'s decorative props (barrels, crates, gardens, benches, flower beds)', levels: [{ name: 'off', v: false }, { name: 'on', v: true }] },
  // (the code-built buildings, world/objects/codebuildings.js: past this distance only their outsides are drawn, dark
  // cards in their doorways and windows; inside it their rooms, furniture, goods and props too)
  // (measured from the nearest of its doorways, the camera's or the player's: past it the far look, the wood and one
  // merged trim, objects/codebuild.js FAR TRIM. The insides come and go by the player's distance alone: GOVERNOR.md
  // Interiors)
  outsides: { label: 'Building outsides', lane: 'scenery', live: 'live', about: 'how near a doorway of the code-built buildings their outsides are drawn in full (past it: the wood and one merged trim) and their outdoor props',
    levels: [{ name: '15 m', v: 15 }, { name: '30 m', v: 30 }, { name: '50 m', v: 50 }, { name: '90 m', v: 90 }] },
  // (each inside part's priority: objects/codebuild.js PROP_PRI; potato keeps to the rooms and what a walker goes round)
  insideDetail: { label: 'Inside detail', lane: 'scenery', live: 'live', about: 'the code-built buildings\' insides loaded up to this priority: 1 the rooms, counters, shelves and furniture; 2 the goods, barrels and crates; 3 the clutter and the pictures on the walls',
    levels: [{ name: 'needed', v: 1 }, { name: 'normal', v: 2 }, { name: 'all', v: 3 }] },
  // (a window's view arc, world/objects/codebuildings.js ARC: the room behind the glass loaded, in 3D, as the player
  // comes into the arc in front of it looking that way; else the picture taken of it)
  windowArc: { label: 'Window view', lane: 'scenery', live: 'live', about: 'what the code-built buildings\' see-through windows show in front of them: the picture taken of the room, the room itself with its priority-1 parts, or the whole room',
    levels: [{ name: 'pictures', v: 0 }, { name: 'rooms', v: 1 }, { name: 'full', v: 3 }] },
  // (look: which HORSE_LOOK distances the new horse keeps (src/actors/horses.js); player: the player's own horse, the old
  // pack horse or the new one; pen: how many horses in the pen behind the stable (src/horsepen.js, ~22k triangles each up
  // close), penFar: the pen's horses always in their far look; every: every horse in the valley the new one (the road
  // riders' and the wagon teams' too). The horse helper wires it: GOVERNOR.md, Hooks)
  horse: { label: 'Horses', lane: 'scenery', live: 'hook', about: 'the horses: the player\'s own (old pack horse or the new one), the new horse\'s look distances, the pen behind the stable (how many, far look only), every horse in the valley new (src/actors/horses.js, src/player.js, src/horsepen.js wire it)',
    levels: [{ name: 'old', v: { look: 'potato', player: 'old', pen: 2, penFar: true, every: false } }, { name: 'far', v: { look: 'potato', player: 'new', pen: 3, penFar: true, every: false } },
      { name: 'normal', v: { look: 'normal', player: 'new', pen: 4, penFar: false, every: false } }, { name: 'gaming', v: { look: 'gaming', player: 'new', pen: 4, penFar: false, every: false } },
      { name: 'every', v: { look: 'gaming', player: 'new', pen: 4, penFar: false, every: true } }] },
  fences: { label: 'Fences', lane: 'scenery', live: 'hook', about: 'one: the one plain fence everywhere (fewest draws); plain: the styled fences, half-size pictures, no normal maps; styled; detailed: with normal maps (world/objects/fences.js wires it)',
    levels: [{ name: 'one', v: 'one' }, { name: 'plain', v: 'plain' }, { name: 'styled', v: 'styled' }, { name: 'detailed', v: 'detailed' }] },
  travellers: { label: 'Travellers', lane: 'people', live: 'live', about: 'riders and hikers on the road: on it at once / drawn as real people / made within (m)',
    levels: [{ name: '3', v: { most: 3, made: 2, show: 120 } }, { name: '6', v: { most: 6, made: 3, show: 140 } }, { name: '8', v: { most: 8, made: 4, show: 160 } },
      { name: '10', v: { most: 10, made: 5, show: 240 } }, { name: '14', v: { most: 14, made: 7, show: 270 } }, { name: '20', v: { most: 20, made: 9, show: 290 } },
      { name: '30', v: { most: 30, made: 12, show: 310 } }, { name: '45', v: { most: 45, made: 14, show: 330 } }, { name: '60', v: { most: 60, made: 16, show: 350 } }] },
  wagons: { label: 'Wagons', lane: 'people', live: 'live', about: 'wagons on the road at once / drawn at once',
    levels: [{ name: '4', v: { most: 4, made: 2 } }, { name: '5', v: { most: 5, made: 3 } }, { name: '6', v: { most: 6, made: 4 } }, { name: '7', v: { most: 7, made: 5 } }, { name: '8', v: { most: 8, made: 6 } }] },
  townsfolk: { label: 'Townsfolk', lane: 'people', live: 'live', about: 'the most of the town\'s people out at once (by day)',
    levels: [{ name: '4', v: 4 }, { name: '7', v: 7 }, { name: '10', v: 10 }, { name: '13', v: 13 }, { name: '16', v: 16 }] },
  chickens: { label: 'Chickens', lane: 'people', live: 'live', about: 'chickens about the town', levels: [{ name: '4', v: 4 }, { name: '8', v: 8 }, { name: '12', v: 12 }, { name: '16', v: 16 }] },
  saloon: { label: 'Saloon crowd', lane: 'people', live: 'live', about: 'the townsfolk in the saloon\'s hall at most while the band plays (src/saloonfolk.js: they come and go by its doors)',
    levels: [{ name: '2', v: 2 }, { name: '4', v: 4 }, { name: '6', v: 6 }, { name: '8', v: 8 }, { name: '10', v: 10 }] },
  crowd: { label: 'Far figures', lane: 'people', live: 'live', about: 'travellers and wagons past the drawn ones shown as cheap far figures, out to (m): src/crowd.js',
    levels: [{ name: '320 m', v: 320 }, { name: '450 m', v: 450 }, { name: '600 m', v: 600 }, { name: '850 m', v: 850 }] },
};
// THE RELOAD DIALS: fixed at load by the band (potato, normal, gaming); what each band means is in the systems' own
// tables (world/valley.js TIER_SET and the files named)
export const RELOAD = {
  antialias: { label: 'Screen smoothing', by: ['off', 'on', 'on'], where: 'world/quality.js wantAntialias (src/main.js)' },
  land: { label: 'Land mesh & ground shader', by: ['lite: a quarter of the points, flat colours', 'full', 'full'], where: 'world/valley.js TIER_SET.lite' },
  shadowMap: { label: 'Shadow map at all', by: ['none', 'yes', 'yes, plants built to cast'], where: 'world/valley.js TIER_SET.shadow' },
  treeModels: { label: 'Tree models', by: ['low pine, sparse, 45% of the trees', 'sparse', 'coarse'], where: 'world/valley.js TIER_SET.forest, treeShare' },
  buildings: { label: 'Building pictures', by: ['small; code-built: half-size signs and goods, one wood sheet', 'small', 'full'], where: 'world/objects/village.js lo, world/objects/codebuildings.js' },
  camps: { label: 'Camp pictures', by: ['1024', '1024', 'full'], where: 'src/camps.js' },
  builds: { label: 'Windmill & bridge models', by: ['low', 'lo pictures', 'full'], where: 'src/windmilljob.js, src/bridgejob.js' },
  board: { label: 'Jobs board picture', by: ['half', 'full', 'full'], where: 'src/jobsboard.js' },
  stoneShapes: { label: 'Stone shapes', by: ['20 faces, no pictures, 1,500', '20 faces, 14,000', '80 faces, 26,000'], where: 'world/valley.js stoneShapes, TIER_SET.stones' },
  paving: { label: '3D paving stones', by: ['painted only', '3D near', '3D near'], where: 'world/valley.js TIER_SET.paving3D' },
};

// ── THE LADDERS (the order going up; going down is the same, backwards) ────────────────────────────────────────────
// '|normal' and '|gaming' mark where those tiers start: the rung after every step above it is the tier's own look.
export const LADDERS = {
  // the slow lane: the resolution's big jumps where a band begins (each is most of a fill-bound machine's frame)
  scenery: [
    ['grass', 1], ['ground', 1], ['stones', 1], ['horse', 1], ['fences', 1], ['ratio', 1], ['sky', 1], ['trees', 1], ['lawn', 1],
    ['ratio', 2], ['shadows', 1], ['grass', 2], ['ground', 2], ['stones', 2], ['beams', 1], ['props', 1], ['outsides', 1], ['insideDetail', 1], ['windowArc', 1], ['grass', 3], ['lawn', 2],
    ['ground', 3], ['trees', 2], ['shadows', 2], ['horse', 2], ['fences', 2], ['stones', 3], ['ratio', 3],
    '|normal',
    ['grass', 4], ['trees', 3], ['lawn', 3], ['shadows', 3], ['ground', 4], ['grass', 5], ['shadows', 4], ['horse', 3], ['outsides', 2], ['insideDetail', 2], ['windowArc', 2], ['fences', 3], ['ratio', 4],
    '|gaming',
    ['grass', 6], ['lawn', 4], ['trees', 4], ['shadows', 5], ['grass', 7], ['horse', 4], ['outsides', 3], ['lawn', 5], ['trees', 5],
  ],
  // the fast lane: people first (Dad: "Id love to see more pairs of mounted riders and hikers")
  people: [
    ['travellers', 1], ['chickens', 1], ['townsfolk', 1], ['wagons', 1], ['travellers', 2], ['wagons', 2], ['chickens', 2], ['saloon', 1],
    '|normal',
    ['travellers', 3], ['townsfolk', 2], ['wagons', 3], ['crowd', 1], ['saloon', 2],
    '|gaming',
    ['travellers', 4], ['townsfolk', 3], ['crowd', 2], ['chickens', 3], ['saloon', 3], ['travellers', 5], ['townsfolk', 4], ['wagons', 4], ['travellers', 6],
    ['crowd', 3], ['saloon', 4], ['travellers', 7], ['travellers', 8],
  ],
};
export const LANES = ['scenery', 'people'];
export const STEPS = Object.fromEntries(LANES.map((l) => [l, LADDERS[l].filter((s) => Array.isArray(s))]));
export const TOP = Object.fromEntries(LANES.map((l) => [l, STEPS[l].length]));
export const START = Object.fromEntries(LANES.map((l) => [l, { potato: 0, normal: LADDERS[l].indexOf('|normal'), gaming: LADDERS[l].indexOf('|gaming') - 1 }]));
// (the version of the ladders: rungs remembered from other ladders are read by their band instead)
export const LADDER_V = (() => { let h = 0; for (const c of JSON.stringify(LADDERS)) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); })();
// the band a scenery rung is in (what a reload would choose)
export const bandOf = (s) => (s >= START.scenery.gaming ? 'gaming' : s >= START.scenery.normal ? 'normal' : 'potato');
// where a rung sits, counted in bands: potato's start 0, normal's 1, gaming's 2, the top 3 (so the two ladders, of
// different lengths, can be compared: at a tier's start both lanes sit at the same place)
export function bandPos(lane, r) {
  const A = [[START[lane].potato, 0], [START[lane].normal, 1], [START[lane].gaming, 2], [TOP[lane], 3]];
  for (let i = 1; i < A.length; i++) if (r <= A[i][0]) return A[i - 1][1] + (r - A[i - 1][0]) / Math.max(1, A[i][0] - A[i - 1][0]);
  return 3;
}
// every dial's level at a pair of rungs
export function levelsAt(s, p) {
  const out = {}; for (const k of Object.keys(DIALS)) out[k] = 0;
  for (const [lane, r] of [['scenery', s], ['people', p]]) for (let i = 0; i < Math.min(r, STEPS[lane].length); i++) { const [k, l] = STEPS[lane][i]; out[k] = Math.max(out[k], l); }
  return out;
}

// ── HOW IT DECIDES ─────────────────────────────────────────────────────────────────────────────────────────────
export const GOV = {
  addFps: 60,       // a screen faster than 60 Hz: over this, held, is spare time
  spare: 0.7,       // a 60 Hz screen: the frame's own work (and the GPU's, when it can be timed) under this share of the interval ...
  spareAt: 0.9,     // ... at this percentile of the frames
  atCap: 0.97,      // ... and the frame rate at least this share of the refresh (no frames dropped)
  down: 50,         // take away under this many frames a second, held (a screen slower than 60 Hz: downHz of its refresh)
  downHz: 0.83,
  addWin: 4, downWin: 3,   // s each must hold
  settle: 1.0,      // s after a change whose frames aren't counted (things laid again, shaders built)
  upAfter: 5,       // s after any change before adding again ...
  downAfter: 3,     // ... or taking away again
  fall: 6,          // how many people steps a much too slow frame rate takes away at once: (down / fps - 1) x fall, 1 to fallMost
  fallMost: 4,
  hitch: 100,       // ms: a frame this long is a hitch (loading, a shader built): left out of the count
  trim: 0.03,       // and the slowest 3% of the frames besides
  probe: 30,        // s: a rung that fails this soon after it was added is a ceiling ...
  backoff: [45, 600],   // ... not tried again for 45 s, doubling each time it fails, up to 10 minutes
  hold: 20,         // s a pair of rungs must hold (while riding) before it is remembered for this machine
  sceneryEvery: 15, // s of riding between two steps of the slow lane (so each is measured before the next)
  ahead: 0.35,      // the people lane may be this far behind the scenery's (in bands: bandPos) before the scenery gives way
  mist: 0.85,       // how thick the mist at the valley's ends must be round the camera to hide a change
  phoneTop: START.scenery.gaming - 1,   // phones and tablets: the scenery climbs no higher (battery and heat: GOVERNOR.md, Questions for Dad)
  climbEvery: 10,   // s of smooth riding for each step of the climb back up (from the bottom of the potato band to normal: about 4 minutes)
  curtainMost: 8,   // the most of those steps one curtain takes, so what comes next is measured before the rest (one, after a rung has failed)
  sceneryBackoff: [90, 1200],   // s: a scenery rung that failed isn't tried again for this long, doubling each time, up to 20 minutes
  probeScenery: 120,   // s: a scenery rung that fails this soon after it was taken is a ceiling (its verdict waits for a curtain, so longer than GOV.probe)
  bandProbe: 300,   // s: a band that falls this soon after it came up has failed on this machine ...
  bandHold: [1800, 172800],   // ... and isn't tried again for half an hour, doubling each time it fails, up to two days
  bandRest: 600,    // s: a band that held longer and then fell (a hot phone, a flat battery) rests this long
};
const HZ = [30, 48, 50, 60, 72, 75, 85, 90, 100, 120, 144, 165, 170, 180, 200, 240];
const pct = (arr, q) => { if (!arr.length) return null; const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; };

export function makeGovernor({ renderer, quality, W = null } = {}) {
  const Q = new URLSearchParams(location.search), log = Q.has('govlog');
  const gpu = gpuName(renderer), loadBand = TIERS.includes(quality && quality.tier) ? quality.tier : 'normal';
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
  const top = { scenery: mobile ? GOV.phoneTop : TOP.scenery, people: TOP.people };
  const clampL = (lane, r) => Math.max(0, Math.min(top[lane], Math.round(+r || 0)));
  // pinned: a tier forced in the address or chosen by hand (no governor then)
  let pinned = quality && (quality.source === 'forced' || quality.source === 'saved') ? quality.tier : null;
  if (Q.has('auto')) pinned = null;
  if (Q.get('gov') === 'off') pinned = loadBand;
  const rec = recall(gpu), gq = Q.get('gov');
  let rung = { scenery: START.scenery[loadBand], people: START.people[loadBand] };
  if (pinned) rung = { scenery: START.scenery[pinned], people: START.people[pinned] };
  else if (gq && TIERS.includes(gq)) rung = { scenery: START.scenery[gq], people: START.people[gq] };
  else if (gq && /^\d+,\d+$/.test(gq)) { const [a, b] = gq.split(',').map(Number); rung = { scenery: a, people: b }; }
  else if (quality && quality.source === 'remembered' && rec && rec.v === LADDER_V) rung = { scenery: rec.scenery ?? rung.scenery, people: rec.people ?? rung.people };
  rung = { scenery: clampL('scenery', rung.scenery), people: clampL('people', rung.people) };
  // (the scenery rung waiting for a curtain; remembered for the next load meanwhile. goal: where smooth riding says it could
  // be, want or above; a curtain takes up to GOV.curtainMost of the way there, the next load all of it)
  let want = rung.scenery, wantWhy = '', goal = rung.scenery, goalWhy = '', goalAt = -1e9;
  // (the bands not to go back to yet: { normal: { until (Date.now()), n (failures in a row) }, gaming }; kept in the memory)
  const holds = (rec && rec.hold && typeof rec.hold === 'object') ? { ...rec.hold } : {};
  let memBand = bandOf(rung.scenery), memBandAt = Date.now();
  const subs = new Map(), limits = {}, journal = [];
  let levels = levelsAt(rung.scenery, rung.people), last = null, disposed = false;
  const changed = { scenery: performance.now(), people: performance.now(), any: performance.now() };
  const fails = new Map(), ceiling = new Map(); let upAt = -1e9, upTo = null;
  // (the scenery's ceiling: nothing from this rung up while it lasts. The climb can come up several rungs at a curtain, so
  // one rung's own ceiling, as the people's have, would let it go round the rungs either side of it; n: failures in a row)
  const sCeil = { at: Infinity, until: 0, n: 0, to: null, upAt: -1e9 };   // (to, upAt: the last rung it came up to, and when)
  const over = {};   // (rigs: a dial held at a level of its own, G.dev.dial)
  const wait = {};   // (a dial waiting at its level for the right curtain: the resolution, for the title or the mist)
  const eff = (k, l = levels[k]) => (over[k] != null ? over[k] : wait[k] != null ? wait[k] : Math.min(l, limits[k] ? limits[k].most : Infinity));
  const value = (k) => DIALS[k].levels[eff(k)].v;
  const G = {
    get scenery() { return rung.scenery; }, get people() { return rung.people; }, get wanted() { return want; }, get goal() { return goal; }, top, get auto() { return !pinned; }, get pinned() { return pinned; }, loadBand, gpu,
    level: (k) => eff(k), value,
    scene: () => 'play',
    on(k, fn) {
      if (!DIALS[k]) throw new Error('governor: no dial ' + k);
      if (!subs.has(k)) subs.set(k, new Set());
      subs.get(k).add(fn);
      try { fn(value(k), eff(k), k); } catch (e) { console.warn('governor: dial ' + k, e); }
      return () => { const s = subs.get(k); if (s) s.delete(fn); };
    },
    limit(k, most, why = '', reload = false) { const was = eff(k); limits[k] = { most, why, reload }; if (eff(k) !== was) tell(k); },
    listening: (k) => !!(subs.get(k) && subs.get(k).size),
  };
  function tell(k) { const s = subs.get(k); if (s) for (const fn of [...s]) { try { fn(value(k), eff(k), k); } catch (e) { console.warn('governor: dial ' + k, e); } } }
  const changesAt = (s, p, s2, p2) => { const A = levelsAt(s, p), B = levelsAt(s2, p2); return Object.keys(DIALS).filter((k) => eff(k, A[k]) !== eff(k, B[k])); };
  // to a pair of rungs: every dial whose level changed is told; returns the changes in words
  function set(s, p, why = '', kind = 'set', lane = 'any') {
    s = clampL('scenery', s); p = clampL('people', p);
    const before = levels, after = levelsAt(s, p), moved = [];
    rung = { scenery: s, people: p }; levels = after;
    for (const k of Object.keys(DIALS)) {
      if (before[k] === after[k]) continue;
      const a = eff(k, before[k]), b = eff(k, after[k]);
      if (a !== b) { moved.push(`${k} ${DIALS[k].levels[a].name} → ${DIALS[k].levels[b].name}`); tell(k); }
    }
    const t = performance.now(); changed.any = t; if (lane !== 'any') changed[lane] = t; else { changed.scenery = changed.people = t; }
    last = { kind, lane, scenery: s, people: p, why, moved, at: Date.now() };
    journal.push(last); if (journal.length > 40) journal.shift();
    if (log) console.log(`governor: ${kind} ${lane} to ${s},${p} (${why})`, moved.join('; '));
    return moved;
  }
  G.set = (s, p = rung.people, why = 'asked') => { want = goal = clampL('scenery', s); const w = Object.keys(wait); for (const k of w) delete wait[k]; const out = set(s, p, why); for (const k of w) tell(k); return out; };
  G.pin = (tier) => {
    // (the people at once; the scenery now too, behind the menu, but for the resolution, which waits for the title or the
    // mist: a paused screen would go blank)
    if (tier && TIERS.includes(tier)) { pinned = tier; saveTier(tier); want = goal = START.scenery[tier]; wantWhy = 'chosen by hand'; set(rung.scenery, START.people[tier], 'chosen by hand', 'pin', 'people'); applyWanted(sceneNow()); }
    else { pinned = null; saveTier(null); goal = want; last = { kind: 'auto', lane: 'any', scenery: rung.scenery, people: rung.people, why: 'Auto again', moved: [], at: Date.now() }; journal.push(last); changed.any = performance.now(); }
    return G.state();
  };

  // ── MEASURING ──────────────────────────────────────────────────────────────────────────────────────────────────
  // each frame drawn: [time, ms between frames, the frame's own work (ms, or null), the GPU's (ms, or null)]; a hidden
  // tab, a frame not drawn (the game paused) or one in the moment after a change are left out
  const S = [], keep = 10000;
  let prevT = 0, drewN = 0, hiddenAt = -1e9, hitches = 0, hz = 0, nextLook = 0, workMs = null, gpuMs = null;
  const hzSeen = new Map();
  G.drew = () => { drewN++; };
  G.work = (t0) => { workMs = performance.now() - t0; };
  const onVis = () => { hiddenAt = performance.now(); prevT = 0; };
  document.addEventListener('visibilitychange', onVis);
  // GPU TIMER QUERIES (EXT_disjoint_timer_query_webgl2 / EXT_disjoint_timer_query): the GPU's time for each frame W.render
  // draws, read back a few frames later; none where the browser doesn't offer them (most, for privacy)
  const gl = renderer.getContext(), gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  let tq = null;
  const timer = () => {
    try {
      const ext = gl2 ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : gl.getExtension('EXT_disjoint_timer_query');
      tq = ext ? { ext, open: [], q: null } : null;
    } catch (e) { tq = null; }
  };
  timer();
  // (a context lost takes its queries and the extension with it: asked of the new context they were INVALID_OPERATION
  // and INVALID_ENUM, the Graphics check's error flag; dropped, and the extension fetched again once it is back)
  const onLost = () => { tq = null; }, offRestored = onGraphicsRestored('GPU timer', () => { timer(); return !!tq; });
  renderer.domElement.addEventListener('webglcontextlost', onLost, false);
  function gpuBegin() {
    if (!tq || tq.q || tq.open.length > 4) return;
    try { const { ext } = tq; tq.q = gl2 ? gl.createQuery() : ext.createQueryEXT(); if (gl2) gl.beginQuery(ext.TIME_ELAPSED_EXT, tq.q); else ext.beginQueryEXT(ext.TIME_ELAPSED_EXT, tq.q); } catch (e) { tq = null; }
  }
  function gpuEnd() {
    if (!tq || !tq.q) return;
    try { const { ext } = tq; if (gl2) gl.endQuery(ext.TIME_ELAPSED_EXT); else ext.endQueryEXT(ext.TIME_ELAPSED_EXT); tq.open.push(tq.q); tq.q = null; } catch (e) { tq = null; }
  }
  function gpuRead() {
    if (!tq) return;
    try {
      const { ext } = tq, disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      while (tq.open.length) {
        const q = tq.open[0];
        const ready = gl2 ? gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) : ext.getQueryObjectEXT(q, ext.QUERY_RESULT_AVAILABLE_EXT);
        if (!ready) break;
        const ns = gl2 ? gl.getQueryParameter(q, gl.QUERY_RESULT) : ext.getQueryObjectEXT(q, ext.QUERY_RESULT_EXT);
        if (gl2) gl.deleteQuery(q); else ext.deleteQueryEXT(q);
        tq.open.shift();
        if (!disjoint) gpuMs = ns / 1e6;
      }
    } catch (e) { tq = null; }
  }
  // the frames since `from` (and within `sec` seconds): the frame rate with the hitches and the slowest few left out,
  // the middle frame, and the work and GPU times at their 90th percentile
  function window_(sec, now, from) {
    const start = Math.max(now - sec * 1000, from + GOV.settle * 1000, hiddenAt + 1500);
    const d = [], w = [], g = []; let span = 0;
    for (let i = S.length - 1; i >= 0 && S[i][0] >= start; i--) { d.push(S[i][1]); span += S[i][1]; if (S[i][2] != null) w.push(S[i][2]); if (S[i][3] != null) g.push(S[i][3]); }
    if (span < sec * 1000 * 0.7 || d.length < 8) return null;
    d.sort((a, b) => a - b);
    const cut = Math.max(1, Math.floor(d.length * (1 - GOV.trim)));
    let sum = 0, n = 0; for (let i = 0; i < cut; i++) { if (d[i] > GOV.hitch) break; sum += d[i]; n++; }
    if (n < 8) return null;
    return { fps: 1000 * n / sum, med: d[d.length >> 1], work: pct(w, GOV.spareAt), gpu: pct(g, GOV.spareAt), n };
  }
  // the screen's refresh: the frame rate it sits at, when it sits at one of the usual ones
  function lookRefresh(f) {
    if (!f) return;
    const near = HZ.find((h) => Math.abs(f.fps - h) / h < 0.03 && Math.abs(1000 / f.med - h) / h < 0.03);
    if (!near) return;
    hzSeen.set(near, (hzSeen.get(near) || 0) + 1);
    let best = 0; for (const [h, n] of hzSeen) if (n >= 3 && h > best) best = h;
    if (best) hz = best;
  }
  const downAt = () => Math.min(GOV.down, (hz || 60) * GOV.downHz);
  // DAD'S ADD SIGNAL: over 60 fps on a faster screen; on a 60 Hz one, at the refresh with the frame's work (and the GPU's)
  // under 70% of its interval
  function spare(f) {
    if (!f) return { ok: false, why: 'measuring' };
    const H = hz || 60;
    if (H > 65) return f.fps > GOV.addFps ? { ok: true, why: `${f.fps.toFixed(0)} fps > ${GOV.addFps}` } : { ok: false, why: `${f.fps.toFixed(0)} fps, not over ${GOV.addFps}` };
    const budget = GOV.spare * 1000 / H;
    if (f.fps < H * GOV.atCap) return { ok: false, why: `${f.fps.toFixed(0)} fps, under the ${H} Hz refresh` };
    if (f.work == null) return { ok: false, why: 'no frame work measured' };
    if (f.work > budget) return { ok: false, why: `work ${f.work.toFixed(1)} ms > ${budget.toFixed(1)}` };
    if (f.gpu != null && f.gpu > budget) return { ok: false, why: `GPU ${f.gpu.toFixed(1)} ms > ${budget.toFixed(1)}` };
    return { ok: true, why: `at ${H} Hz, work ${f.work.toFixed(1)}${f.gpu != null ? ` / GPU ${f.gpu.toFixed(1)}` : ''} ms < ${budget.toFixed(1)}` };
  }
  let fpsNow = 0, sig = { ok: false, why: 'measuring' }, workNow = null, gpuNow = null;
  // the last stretch of riding, for the slow lane's steps at a curtain: [time, spare?, too slow?]
  const ride = [];
  function tick(t) {
    if (disposed) return;
    requestAnimationFrame(tick);
    gpuRead();
    const dt = prevT ? t - prevT : 0; prevT = t;
    const drew = drewN; drewN = 0;
    const work = workMs; workMs = null;
    if (dt && drew && !document.hidden) {
      if (dt > GOV.hitch) hitches++;
      S.push([t, dt, work, gpuMs]); gpuMs = null;
      while (S.length && S[0][0] < t - keep) S.shift();
    }
    if (t < nextLook) return;
    nextLook = t + 250;
    const scene = sceneNow();
    const f2 = window_(2, t, changed.any); lookRefresh(f2);
    if (f2) { fpsNow = f2.fps; workNow = f2.work; gpuNow = f2.gpu; }
    decide(t, scene);
  }
  requestAnimationFrame(tick);
  // where the game is: its own word (G.scene), and deep in the mist at the valley's ends
  function sceneNow() {
    let s = 'play'; try { s = G.scene() || 'play'; } catch (e) { /* (the game's word, if it can't say: playing) */ }
    if (s === 'play' && W && W.fogAt && W.camTarget && W.fogAt(W.camTarget.x, W.camTarget.z) >= GOV.mist) s = 'mist';
    return s;
  }
  const curtain = (s) => s !== 'play';   // (title, paused, cabin, away, mist: a moment that hides a change)
  let curtainWas = false, sceneryAt = -1e9, heldSince = performance.now(), wasScene = 'play';
  function decide(t, scene) {
    if (scene !== wasScene) { changed.any = changed.people = changed.scenery = t; wasScene = scene; }   // (a new place's frames aren't the old one's)
    if (G.held) return;
    if (pinned) { if (curtain(scene) && (want !== rung.scenery || wait.ratio != null)) applyWanted(scene); return; }
    if (scene === 'play') riding(t);
    else if (scene === 'title') titleLane(t);
    if (curtain(scene)) { if (!curtainWas) atCurtain(t, scene); else if (want !== rung.scenery || (wait.ratio != null && (scene === 'title' || scene === 'mist'))) applyWanted(scene); curtainWas = true; }
    else curtainWas = false;
    if (scene === 'play' && (t - heldSince) / 1000 >= GOV.hold && G.listening('travellers')) { heldSince = t; rememberNow(); }
  }
  // RIDING: the people lane, by Dad's signals
  function riding(t) {
    const f = window_(GOV.addWin, t, changed.people), fd = window_(GOV.downWin, t, changed.people), lo = downAt();
    sig = spare(f);
    ride.push([t, sig.ok, !!(fd && fd.fps < lo), fd ? fd.fps : 0]); while (ride.length && ride[0][0] < t - 30000) ride.shift();
    const since = (t - changed.people) / 1000;
    // (too slow again: the climb's steps not yet taken are forgotten)
    if (fd && fd.fps < lo && goal > want) { goal = want; rememberNow(); }
    if (since >= GOV.downAfter && fd && fd.fps < lo) {
      if (rung.people > 0) {
        markCeiling(t, 'people');
        const steps = Math.max(1, Math.min(GOV.fallMost, Math.round((lo / fd.fps - 1) * GOV.fall)));
        let p = rung.people - steps; while (p > 0 && !changesAt(rung.scenery, rung.people, rung.scenery, p).length) p--;
        set(rung.scenery, p, `${fd.fps.toFixed(0)} fps for ${GOV.downWin} s (under ${lo.toFixed(0)})`, 'down', 'people');
        heldSince = t; rememberNow();
      } else wantDown(`${fd.fps.toFixed(0)} fps with the people already at their fewest`, fallBy(fd.fps));
      return;
    }
    if (since >= GOV.upAfter && sig.ok && rung.people < top.people) {
      let p = rung.people + 1; while (p < top.people && !changesAt(rung.scenery, rung.people, rung.scenery, p).length) p++;
      const c = ceiling.get('people:' + p); if (c && t < c) return;
      set(rung.scenery, p, sig.why, 'up', 'people');
      upAt = t; upTo = 'people:' + p; heldSince = t;
    }
    // (spare time with the people as far along as the scenery would be, or at their most: the climb goes on)
    if (sig.ok && (rung.people >= top.people || bandPos('people', rung.people) >= bandPos('scenery', goal))) climb(t, `spare time riding (${sig.why})`);
  }
  // THE CLIMB: the goal up a step, at most every GOV.climbEvery s; as far as the start of the band above this load's, and
  // short of a band still held back
  function heldLimit() {
    let lim = top.scenery; const now = Date.now();
    for (const b of ['normal', 'gaming']) if (holds[b] && now < holds[b].until) lim = Math.min(lim, START.scenery[b] - 1);
    return lim;
  }
  // (a card with no WebGL 2 stays in the potato band however far it climbs: its live dials just go on: GOVERNOR.md, Questions)
  const climbLimit = () => Math.min(heldLimit(), !gl2 ? top.scenery : loadBand === 'potato' ? START.scenery.normal : loadBand === 'normal' ? START.scenery.gaming : TOP.scenery);
  function climb(t, why) {
    if ((t - goalAt) / 1000 < GOV.climbEvery) return;
    // (a step down still waiting for a curtain, and the riding is smooth now: it isn't wanted any more)
    if (want < rung.scenery) { want = goal = rung.scenery; goalAt = t; rememberNow(); return; }
    // (the rung that failed has held at last: the machine's better now, so the slow tries are over)
    if (sCeil.n && sCeil.to != null && sCeil.to >= sCeil.at && (t - sCeil.upAt) / 1000 >= GOV.probeScenery) sCeil.n = 0;
    if (goal < want) goal = want;
    const lim = climbLimit(); if (goal >= lim) return;
    let s = goal + 1; while (s < lim && !changesAt(goal, rung.people, s, rung.people).length) s++;
    if (t < sCeil.until && s >= sCeil.at) return;
    goal = s; goalAt = t; goalWhy = why;
    if (log) console.log(`governor: the climb to ${s} (${why}), ${bandOf(s)} on the next load`);
    rememberNow();
  }
  // ON THE TITLE: the slow lane moves by the same signals (the town's backdrop is the valley without its people)
  function titleLane(t) {
    const f = window_(GOV.addWin, t, changed.scenery), fd = window_(GOV.downWin, t, changed.scenery), lo = downAt();
    sig = spare(f);
    const since = (t - changed.scenery) / 1000;
    if (since >= GOV.downAfter && fd && fd.fps < lo && rung.scenery > 0) {
      markCeiling(t, 'scenery');
      let s = rung.scenery - Math.max(1, Math.min(GOV.fallMost, Math.round((lo / fd.fps - 1) * GOV.fall)));
      while (s > 0 && !changesAt(rung.scenery, rung.people, s, rung.people).length) s--;
      want = s; wantWhy = `${fd.fps.toFixed(0)} fps on the title (under ${lo.toFixed(0)})`; applyWanted('title');
      return;
    }
    const most = heldLimit();
    if (since >= GOV.upAfter && sig.ok && rung.scenery < most && rung.scenery >= want) {
      let s = rung.scenery + 1; while (s < most && !changesAt(rung.scenery, rung.people, s, rung.people).length) s++;
      if (t < sCeil.until && s >= sCeil.at) return;
      want = s; wantWhy = sig.why + ' (on the title)'; applyWanted('title');
    }
  }
  // how many steps a frame rate this far under the line takes away at once
  function fallBy(fps) { const lo = downAt(); return Math.max(1, Math.min(GOV.fallMost, Math.round((lo / Math.max(1, fps) - 1) * GOV.fall))); }
  function markCeiling(t, lane) {
    if (lane === 'scenery') {
      if (sCeil.to != null && (t - sCeil.upAt) / 1000 < GOV.probeScenery) { sCeil.at = sCeil.to; sCeil.n++; sCeil.until = t + Math.min(GOV.sceneryBackoff[1], GOV.sceneryBackoff[0] * 2 ** (sCeil.n - 1)) * 1000; }
      sCeil.to = null; return;
    }
    if (upTo && upTo.startsWith(lane) && (t - upAt) / 1000 < GOV.probe) {
      const n = (fails.get(upTo) || 0) + 1; fails.set(upTo, n);
      ceiling.set(upTo, t + Math.min(GOV.backoff[1], GOV.backoff[0] * 2 ** (n - 1)) * 1000);
    }
    upTo = null;
  }
  // the slow lane's next step DOWN, from the last stretch of riding (at most every GOV.sceneryEvery s); taken at the next
  // curtain, and remembered for the next load meanwhile (up: the climb)
  function wantDown(why, steps = 1) {
    const t = performance.now();
    if ((t - sceneryAt) / 1000 < GOV.sceneryEvery || want !== rung.scenery) return;
    let s = want;
    for (let n = 0; n < steps; n++) { s--; while (s > 0 && !changesAt(want, rung.people, s, rung.people).length) s--; }
    s = clampL('scenery', s); if (s === want) return;
    markCeiling(t, 'scenery');
    want = goal = s; sceneryAt = t; wantWhy = why;
    if (log) console.log(`governor: the scenery wants ${s} (${why}), at the next curtain`);
    rememberNow();
  }
  // A CURTAIN: the slow lane's step taken now, from how the riding went
  function atCurtain(t, scene) {
    const recent = ride.filter((r) => r[0] > t - 12000);
    if (recent.length >= 16 && want === rung.scenery) {
      const spareShare = recent.filter((r) => r[1]).length / recent.length, slow = recent.filter((r) => r[2]).length / recent.length;
      const pN = bandPos('people', rung.people), sN = bandPos('scenery', want);
      const fr = recent.filter((r) => r[3]).map((r) => r[3]), fpsR = fr.length ? fr.reduce((a, b) => a + b, 0) / fr.length : downAt();
      if (slow > 0.3 && (rung.people === 0 || pN < sN - GOV.ahead)) wantDown(`too slow riding (${Math.round(slow * 100)}% of the last stretch, ${fpsR.toFixed(0)} fps) with the people lane low`, fallBy(fpsR));
      else if (spareShare > 0.8 && (rung.people === top.people || pN >= sN)) climb(t, `spare time riding (${Math.round(spareShare * 100)}% of the last stretch)`);
      else if (spareShare < 0.2 && pN < sN - GOV.ahead * 2) wantDown('the people lane well behind the scenery: room made for people');
    }
    // (the climb's steps waiting: up to GOV.curtainMost of them now)
    if (want === rung.scenery && goal > want) { want = Math.min(goal, want + (sCeil.n ? 1 : GOV.curtainMost)); wantWhy = goalWhy; }
    applyWanted(scene);
  }
  function applyWanted(scene) {
    const free = scene === 'title' || scene === 'mist';
    // (the resolution waiting from an earlier curtain: its turn now, on the title or in the mist)
    if (free && wait.ratio != null) { const a = wait.ratio; delete wait.ratio; if (eff('ratio') !== a) { tell('ratio'); note('ratio', a, scene); } }
    if (want === rung.scenery) return;
    // (the resolution can't change behind a paused screen: it would go blank. Its level is held where it is, to change
    // on the title or in the mist; the rest of the step goes now)
    const moving = changesAt(rung.scenery, rung.people, want, rung.people);
    const held = moving.includes('ratio') && !free;
    if (held && wait.ratio == null) wait.ratio = eff('ratio');
    const up = want > rung.scenery;
    set(want, rung.people, `${wantWhy || 'asked'} (at a curtain: ${scene}${held ? '; the resolution waits for the title or the mist' : ''})`, up ? 'up' : 'down', 'scenery');
    if (up) { sCeil.to = want; sCeil.upAt = performance.now(); }
    if (!up || goal < want) goal = want;
    rememberNow();
  }
  function note(k, a, scene) {
    last = { kind: eff(k) > a ? 'up' : 'down', lane: 'scenery', scenery: rung.scenery, people: rung.people, why: `its turn (${scene})`, moved: [`${k} ${DIALS[k].levels[a].name} → ${DIALS[k].levels[eff(k)].name}`], at: Date.now() };
    journal.push(last); if (journal.length > 40) journal.shift(); changed.any = changed.scenery = performance.now();
  }
  // WHAT THE NEXT LOAD STARTS FROM: the goal and its band (a band falling here is held back: see NO FLAPPING above)
  function rememberNow() {
    if (pinned) return;
    const s = Math.max(want, goal), b = bandOf(s), now = Date.now();
    if (b !== memBand) {
      if (TIERS.indexOf(b) < TIERS.indexOf(memBand)) {
        const soon = (now - memBandAt) / 1000 < GOV.bandProbe, n = soon ? ((holds[memBand] && holds[memBand].n) || 0) + 1 : 0;
        holds[memBand] = { n, until: now + (soon ? Math.min(GOV.bandHold[1], GOV.bandHold[0] * 2 ** (n - 1)) : GOV.bandRest) * 1000 };
        if (log) console.log(`governor: the ${memBand} band fell after ${Math.round((now - memBandAt) / 1000)} s: not again for ${Math.round((holds[memBand].until - now) / 60000)} min`);
      }
      memBand = b; memBandAt = now;
    }
    remember(gpu, { v: LADDER_V, scenery: s, people: rung.people, band: b, hz: hz || null, hold: holds });
  }
  G.forget = () => remember(gpu, null);
  // (rigs: one dial held at a level, whatever the rungs say (null lets it go); the governor itself held still meanwhile)
  G.dev = { samples(sec = 4) { const t = performance.now(), out = S.filter((x) => x[0] > t - sec * 1000); const med = (i) => { const a = out.map((x) => x[i]).filter((v) => v != null).sort((p, q) => p - q); return a.length ? a[a.length >> 1] : null; }; return { n: out.length, dt: med(1), work: med(2), gpu: med(3) }; },
    dial(k, l) { if (l == null) delete over[k]; else over[k] = Math.max(0, Math.min(DIALS[k].levels.length - 1, l)); tell(k); return value(k); }, hold(on = true) { G.held = !!on; } };

  G.state = () => {
    const dials = {};
    for (const k of Object.keys(DIALS)) dials[k] = { lane: DIALS[k].lane, level: eff(k), want: levels[k], waiting: wait[k] != null, name: DIALS[k].levels[eff(k)].name, of: DIALS[k].levels.length, limit: limits[k] ? limits[k].most : null, why: limits[k] ? limits[k].why : '', reload: !!(limits[k] && limits[k].reload), live: DIALS[k].live, heard: G.listening(k) };
    const c = []; for (const [r, until] of ceiling) if (until > performance.now()) c.push({ rung: r, for: Math.round((until - performance.now()) / 1000) });
    if (sCeil.until > performance.now()) c.push({ rung: 'scenery:' + sCeil.at + ' and up', for: Math.round((sCeil.until - performance.now()) / 1000) });
    const H = hz || 60;
    return { auto: !pinned, pinned, scenery: rung.scenery, people: rung.people, want, goal, nextBand: bandOf(Math.max(want, goal)), holds: { ...holds }, top: { ...top }, start: { scenery: { ...START.scenery }, people: { ...START.people } }, band: bandOf(rung.scenery), wantBand: bandOf(want), loadBand, gpu, mobile,
      scene: sceneNow(), fps: +fpsNow.toFixed(1), hz: hz || null, work: workNow != null ? +workNow.toFixed(2) : null, gpuMs: gpuNow != null ? +gpuNow.toFixed(2) : null, timer: !!tq, hitches,
      add: H > 65 ? `over ${GOV.addFps} fps for ${GOV.addWin} s` : `at ${H} fps with the frame's work${tq ? ' and the GPU\'s' : ''} under ${(GOV.spare * 1000 / H).toFixed(1)} ms (70% of ${(1000 / H).toFixed(1)}) for ${GOV.addWin} s`,
      takeAway: `under ${downAt().toFixed(0)} fps for ${GOV.downWin} s`, signal: sig, dials, last, log: journal.slice(-12), ceilings: c, remembered: recall(gpu),
      memory: gpuMemory(renderer) ? gpuMemory(renderer).total() : null };
  };

  // ── THE ?perf OVERLAY ────────────────────────────────────────────────────────────────────────────────────────────
  let box = null, boxT = 0;
  if (Q.has('perf')) {
    box = document.createElement('div');
    box.className = 'mv-gov';
    box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:27;max-width:min(600px,calc(100vw - 16px));font:11px/1.35 ui-monospace,Menlo,monospace;color:#eef3df;background:rgba(0,0,0,.58);padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre-wrap';
    document.body.appendChild(box);
    const short = { ratio: 'res', shadows: 'shadow', grass: 'grass', lawn: 'lawn', stones: 'stones', trees: 'trees', ground: 'ground', sky: 'clouds', beams: 'beams', props: 'props', outsides: 'outsides', insideDetail: 'inside', windowArc: 'windows', horse: 'horse', fences: 'fences', travellers: 'road', wagons: 'wagons', townsfolk: 'town', chickens: 'hens', crowd: 'far' };
    const paint = () => {
      if (disposed) return;
      boxT = setTimeout(paint, 500);
      const s = G.state(), d = s.dials, ago = s.last ? Math.round((Date.now() - s.last.at) / 1000) : null;
      const row = (lane) => Object.keys(DIALS).filter((k) => DIALS[k].lane === lane).map((k) => `${short[k]} ${d[k].name}${d[k].reload && d[k].want > d[k].limit ? '*' : ''}${d[k].waiting ? '~' : ''}${d[k].heard ? '' : '°'}`).join(' · ');
      const mem = s.memory ? ` · card memory ~${s.memory.mb} MB (pictures ${s.memory.textures}, screen ${s.memory.screen}, buffers ${s.memory.buffers})` : '';
      box.textContent = `${s.auto ? 'AUTO' : 'pinned ' + s.pinned} · ${s.fps} fps${s.hz ? ` (${s.hz} Hz)` : ''} · work ${s.work ?? '-'} ms${s.timer ? ` · GPU ${s.gpuMs ?? '-'} ms` : ''} · ${s.scene}${mem}\n`
        + `scenery ${s.scenery}/${s.top.scenery}${s.want !== s.scenery ? ` (wants ${s.want} at a curtain)` : ''}${s.goal > s.want ? ` (climbing to ${s.goal}: ${s.nextBand} on the next load)` : ''} · people ${s.people}/${s.top.people} · band ${s.band} (loaded ${s.loadBand})\n`
        + `add: ${s.add}  [${s.signal.ok ? 'yes' : 'no'}: ${s.signal.why}]\ntake away: ${s.takeAway}\n`
        + (s.last ? `${s.last.kind === 'up' ? '▲' : s.last.kind === 'down' ? '▼' : '•'} ${s.last.lane} ${s.last.moved.join('; ') || '-'}  (${s.last.why}) ${ago}s ago\n` : '')
        + (s.ceilings.length ? `ceiling: ${s.ceilings.map((c) => `${c.rung} for ${c.for}s`).join(', ')}\n` : '')
        + `${row('people')}\n${row('scenery')}`
        + (Object.values(d).some((x) => x.reload && x.want > x.limit) ? '\n* held back until a reload' : '') + (Object.values(d).some((x) => x.waiting) ? '  ~ waits for the title or the mist' : '') + (Object.values(d).some((x) => !x.heard) ? '  ° nothing listening yet' : '');
    };
    paint();
  }

  G.dispose = () => { disposed = true; clearTimeout(boxT); if (box) box.remove(); document.removeEventListener('visibilitychange', onVis); renderer.domElement.removeEventListener('webglcontextlost', onLost, false); offRestored(); subs.clear(); };
  // (W.governor; only the frames W.render draws are measured, and the GPU's time for each)
  G.attach = (w) => { W = w; w.governor = G; const r0 = w.render; w.render = (...a) => { G.drew(); gpuBegin(); try { return r0(...a); } finally { gpuEnd(); } }; return G; };
  if (W) G.attach(W);
  window.MVGOV = G;   // (rigs and the console)
  return G;
}

// the plain-word name of where a scenery rung sits (for the menu)
export function rungWords(s) {
  const b = bandOf(s), st = START.scenery[b];
  return s === st ? b : s > START.scenery.gaming ? `past gaming (+${s - START.scenery.gaming})` : `${b} +${s - st}`;
}
export { savedTier };
