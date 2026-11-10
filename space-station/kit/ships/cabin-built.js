// THE CABIN FROM A BLUEPRINT: a ship's rooms built from its blueprint (kit/ships/blueprint.js has the format and the
// checks) with the cabin kit's own parts (kit/shipparts/cabin.js): the walls, the sliding doors, the floors and ceilings
// and the slanted top corners where the rooms meet the hull's sides. Written for any ship's blueprint; first used on
// Explorer C's "Rooms in a row".
//   buildCabin(p, bp, opts)   draws the cabin into a piece, in the ship's frame (x toward port, z toward the nose, y 0 on
//                             the deck), as the built ships' own pieces are drawn. opts:
//     space      the shell's measured space (assets/ships/<shell>.space.json): where the hull comes down at each side,
//                which sets how high each room's slanted corner starts
//     which      'walls' (everything but the ceilings), 'ceilings', or 'all' (the lab builds the two apart, so it can
//                lift the ceilings off to look in from above)
//     outer      the ship's own door, from inside: { head (its opening's top over the deck: the slanted corner starts
//                there over it), sill (x where the deck stops at its step, port side; the floor runs on past it elsewhere)
//     look       'light' (the game's maker's own reference pictures for the bunks and the mess: warm light-grey panels,
//                a charcoal floor, warm-white light strips) or 'warm' (his concept sheet's insets: grey steel panels, amber
//                light strips, blue leather) - see LOOKS
//     items      true: the blueprint's furniture: the rooms the cabin kit has fittings for furnished with them
//                (kit/ships/cabin-furnish.js; so far the galley / mess), the rest as the plan's boxes (its colours,
//                muted), hanging cabinets at their height, the door casings dark
//     doorFrame  'oct' (or the blueprint's own "doorFrame"): the game's maker's 8-sided doorways (kit/shipparts/cabin/
//                door.js), each with a sign over it naming the room it leads to on each face, and a control panel beside
//                it on whichever side has clear wall; else the station's doorway at a ship's size
// What it gives back on the piece: p.stats (triangles by what they are), p.runs (the runs of wall, for the lab),
// p.notes, and p.seesOutside: the rooms that can see out of the ship, by id: 'canopy' (always, through the glass) or
// 'door' (while the hull's door is open). Everywhere else the outside world could be left out (not done yet).
// How it is put together (the kit's parts cost about the same per panel whatever its length, and a doorway about two
// panels, so a ship's whole inside stays near 35,000 triangles):
//   - down each hull side, a LINING: one run of wall per stretch of rooms whose hull comes down alike (panels up to
//     LINING_PANEL long), its top where the hull's slope starts (y0, from the space: 2.0 where there is room, lower
//     where the hull comes down), and the kit's hullSlope over it, 45 degrees up and in to the 2.5 m ceiling, a light
//     strip along its foot; the partitions between rooms butt into it
//   - every other room edge is a PARTITION: a run of wall on each face (one panel each), the doorways in it two-faced;
//     a partition's ends stop at the faces of the walls across them (no corner posts: they would double the walls'
//     cost); where a partition meets a slope its top corners hide behind the slope, except on a wall facing a room
//     under glass (the cockpit), where they are cut back to the slope and a gusset fills the corner
//   - a doorway for every inside door, its leaves sliding into the wall beside it (the blueprint's `leaves`); a sliver of
//     wall too short for a panel (under FILLER) is a plain filler
//   - each room's floor (the deck's tread plate) and its ceiling between the slopes (one of the station's ceiling tiles
//     the room's size, its light panel in the middle)
//   - the ship's own door (a door to "outside"): no wall over its opening, the slope over it starting at its head
// Rooms under a canopy ("ceiling": "canopy") are the ship's own (its cockpit): only their faces of the walls they share
// are drawn.
import * as THREE from 'three';
import { part, placeInto } from '../shipparts/place.js';
import { wallRun, doorway, floorRun, ceilingRun, hullSlope } from '../shipparts/cabin.js';
import { FACE, ROOM } from '../shipparts/cabin/ship.js';
import { SURF, GLOW } from '../materials.js';
import { Piece } from '../piece.js';
import { ITEM_KINDS, doorWall, hangs, spaceAt } from './blueprint.js';
import { furnishRoom } from './cabin-furnish.js';
import { SIGNS } from '../shipparts/cabin/print.js';
import { makeMaterials } from '../materials.js';

const PI = Math.PI, EPS = 1e-6;
export const LINING_PANEL = 3.75, FILLER = 0.3, FRAME = 0.1;
// the partitions' walls run straight up to the ceiling (no skirting, no cornice: each would add a third to a wall's cost),
// and the doorways' own cornice is cut down to a lip under it (DOOR_TOP)
export const WALL = { top: ROOM, base: false, cornice: false }, DOOR_TOP = 2.45;
// the slope's foot over the deck: at most SLOPE.top, never under SLOPE.least (the kit's wall needs 1.67 m over its band)
// (margin: how far under the measured space's top at the wall it starts, so there is room outside it for what closes
// the hull off: under a canopy, the cockpit's dark lid)
export const SLOPE = { top: 2.0, least: 1.7, margin: 0.15 };
// the rooms' light, for the bake. The game's maker (2026-11-09): "a low light level, and have the light noticeably glowing
// from the light strips. So there is a lot of contrast and dynamic lighting." So the rooms are lit low and mostly by
// their strips (the slopes' feet, the cabinets' undersides, the benches' toes, the door frames), each throwing a pool on
// what is near it:
//   panel    the kit's ceiling panel at this share of its own strength (it scales with the room's size), at least
//            `least` in all (so a small room still has a pool under its light)
//   bounce   the light a floor throws back up, `bounce` a square metre (at least `bounceLeast`): just enough that a
//            ceiling is not black
//   slope    the soft lights under each slope (every `slopeEvery`), looking up at it; `slopeStrip`: the slope's own strip
//            along its foot, at this share of the kit's
//   ambient  how much of the lab's or game's own sky and surroundings reaches inside (cabinMaterials): little; env, how
//            much of them the cabin's surfaces mirror
// (The bake is in a point light's units: about 1 on a pale wall already reads light grey once tone-mapped, so the fill is
// kept near 0.15 and the strips' pools reach 1 to 3.)
//   scale    every baked light at this share, the fittings' own strips (a light marked `strip`) at `strips` times that
export const LIGHT = { panel: 0.2, least: 1.3, bounce: 0.09, bounceLeast: 0.35, slope: 0.12, slopeEvery: 1.5, slopeStrip: 0.4, ambient: 0.08, env: 0.18, scale: 0.18, strips: 2.6 };
// THE POOLS: a baked light lives in the vertices, and a ship's walls have few (a panel is drawn in big steps), so the
// bake cannot draw a pool of light on a wall. A pool is a real-time light instead: the fittings mark where theirs are
// (a light with `pool: { i, reach }`: the strip under a cabinet, a bench's toe strip, a door's frame), each room's ceiling
// panel gives one, and p.pools lists them by room ({ at, color, i, reach, room }), for a lab or the game to light the
// few of the room the eye is in. `panel`: the ceiling's pool, this much a square metre of ceiling (between least and most).
export const POOLS = { panel: 0.26, least: 0.4, most: 1.3, reach: 3.2 };

// ── THE LOOKS ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The kit's parts with each of the station's surfaces (kit/materials.js SURF) swapped: surf; the light strips' and
// ceiling panels' glow and the light they cast (for the bake) by TONE, each room taking its kind's tone (rooms);
// floor (a tint on the floor's tread plate); leather (the bench cushions, and the furniture boxes of benches not yet
// furnished), bedding (the bunks'); accents (which of the mess's other things take the leather's colour too, for
// kit/ships/cabin-furnish.js: 'stools' their top pads, 'mugs' the mugs and the bottle, 'handles' the cabinets', counter's
// and cold store's handle slots, 'trim' the table's rim, the bench's base panel, the cabinets' rail and the worktop's
// edge); the other furniture boxes: the plan's colours, muted.
//   light   his three reference pictures (2026-11-09: the bunks, the mess, the science lab): one light grey for every
//           panel, the band a softer grey, charcoal trim, a charcoal floor; the light warm white in the mess, cool white
//           in the science lab and the bunks, a plain white elsewhere; the bunks' charcoal bedding. The leather navy (his
//           pick from the bench colours, 2026-11-09; his mess picture's was rust, '#9c5a34'), the stools' tops to match
//   warm    his concept sheet's insets: grey steel panels, dark bands, amber light everywhere, blue leather
// (a tone: `glow` the strip's colour at full (linear, over 1 for the bloom), `light` the colour it casts)
const TONES = {
  warm: { glow: [3.7, 3.0, 2.1], light: [1.0, 0.86, 0.68] },
  cool: { glow: [2.7, 3.05, 3.6], light: [0.84, 0.92, 1.0] },
  plain: { glow: [3.2, 3.15, 3.0], light: [1.0, 0.97, 0.92] },
  amber: { glow: [4.3, 3.2, 1.7], light: [1.3, 1.0, 0.62] },
};
export const LOOKS = {
  light: {
    name: 'Light',
    // (light to mid greys, as his pictures' panels are under their dim light: round one's were near white in the small
    // rooms)
    surf: {
      white: ['#9f9e9a', 0.6, 0.05, 0.6], white2: ['#adaba6', 0.56, 0.05, 0.5], grey2: ['#8e8c88', 0.56, 0.08, 0.6], grey: ['#7a7975', 0.5, 0.15, 0.5],
      band: ['#7f7d79', 0.55, 0.1, 0.7], dark: ['#2f3032', 0.55, 0.3, 0.7], black: ['#343538', 0.4, 0.45, 0.5],
    },
    tone: 'plain', rooms: { galley: 'warm', science: 'cool', bunks: 'cool' },
    floor: '#e4e5ea', floorGain: 7, leather: '#22355e', accents: ['stools'], bedding: '#3a3d42',
  },
  warm: {
    name: 'Warm',
    surf: {
      white: ['#6c727a', 0.42, 0.5, 0.9], white2: ['#79808a', 0.4, 0.5, 0.8], grey2: ['#5e646c', 0.45, 0.5, 0.85], grey: ['#555b62', 0.45, 0.5, 0.6],
      band: ['#34373b', 0.45, 0.45, 1.0], dark: ['#26282b', 0.5, 0.4, 0.8], black: ['#2e3033', 0.35, 0.55, 0.6],
    },
    tone: 'amber', rooms: {},
    floor: '#aaa5a0', floorGain: 6, leather: '#22355e', accents: ['stools'], bedding: '#22355e',
  },
};
// THE CABIN'S MATERIALS: the kit's own (kit/materials.js), with only a little of the outside's light let in (LIGHT.ambient:
// the sky light and the surroundings' glow that a lab or the game lights everything with), so the cabin is lit by its
// strips; reflections of the surroundings low (LIGHT.env); the floor tinted for the look and less of a mirror.
export function cabinMaterials(look) {
  const M = makeMaterials(), L = LOOKS[look] || LOOKS.light, amb = { value: LIGHT.ambient };
  for (const k of ['solid', 'solidInst', 'floor', 'floorInst', 'decal', 'decalInst']) {
    const m = M[k], before = m.onBeforeCompile, key = m.customProgramCacheKey;
    m.onBeforeCompile = (sh, r) => {
      before(sh, r); sh.uniforms.uCabinAmb = amb;
      sh.fragmentShader = sh.fragmentShader.replace('uniform float uAOStrength;', 'uniform float uAOStrength; uniform float uCabinAmb;').replace('reflectedLight.indirectDiffuse *= ambientOcclusion;', 'reflectedLight.indirectDiffuse *= ambientOcclusion * uCabinAmb;');
    };
    m.customProgramCacheKey = () => key() + 'cabin';
    m.envMapIntensity = LIGHT.env;
  }
  // (the floor's plates are drawn dark (kit/tex.js, the deck's #34373d): in the cabin's low light its tint goes well over
  // 1 (floorGain), else it reads black)
  // (not metal: a metal's reflection takes its colour, and this one's is raised)
  for (const k of ['floor', 'floorInst']) { if (L.floor) M[k].color.set(L.floor).multiplyScalar(L.floorGain ?? 1); M[k].metalness = 0; M[k].envMapIntensity = LIGHT.env; }
  M.ambient = amb;   // (a lab may turn it: M.ambient.value)
  return M;
}
// (the station's glows the strips and panels are drawn with, and how bright each is against the tone's full)
const GLOWS = [[GLOW.soft, 0.6], [GLOW.strip, 1.0], [GLOW.white, 1.3]];
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
// a piece's parts re-surfaced for a look: every vertex whose colour is one of the station's surfaces takes the look's;
// every glow (a strip, a ceiling panel) and every light the tone of the room it is in (toneAt(x, z): a TONES entry). (Door
// leaves are copied first: a part's leaves are shared by every copy of it.)
function recolour(p, look, toneAt) {
  const L = LOOKS[look]; if (!L) return p;
  const map = Object.entries(L.surf).map(([k, s]) => ({ from: lin(SURF[k][0]), to: lin(s[0]), rmw: [s[1], s[2], s[3]] }));
  const near = (a, b, i) => Math.abs(a[i] - b[0]) < 2e-3 && Math.abs(a[i + 1] - b[1]) < 2e-3 && Math.abs(a[i + 2] - b[2]) < 2e-3;
  const doParts = (parts) => parts.map(({ mat, geo }) => {
    const g = geo.clone(), c = g.attributes.color?.array, rmw = g.attributes.aRMW?.array, P = g.attributes.position.array; if (!c) return { mat, geo: g };
    for (let i = 0; i < c.length; i += 3) {
      if (mat === 'solid') { for (const m of map) if (near(c, m.from, i)) { c.set(m.to, i); if (rmw) rmw.set(m.rmw, i); break; } }
      else if (mat === 'glow') { for (const [from, k] of GLOWS) if (near(c, from, i)) { c.set(toneAt(P[i], P[i + 2]).glow.map((v) => v * k), i); break; } }
    }
    return { mat, geo: g };
  });
  p.parts = doParts(p.parts);
  // (the strips' and panels' lights take the room's tone; a doorway's green status light, which would tint a small room's
  // ceiling green, is dimmed to a glint)
  p.lights = p.lights.map((l) => (l.color && l.color[1] > 0.85 && l.color[0] > 0.85 ? { ...l, color: toneAt(l.at[0], l.at[2]).light } : l.color && l.color[1] > 0.9 && l.color[0] < 0.5 ? { ...l, i: l.i * 0.2 } : l));
  const leaves = new Map();
  p.movers = p.movers.map((mv) => {
    if (!leaves.has(mv.piece)) { const q = new Piece(); q.parts = doParts(mv.piece.parts); q.lights = mv.piece.lights; leaves.set(mv.piece, q); }
    return { ...mv, key: look + '|' + mv.key, piece: leaves.get(mv.piece) };
  });
  return p;
}

// ── the plan read as lines of wall ───────────────────────────────────────────────────────────────────────────────
// Every room edge on a line: { axis 'x' (a line x = v, running along z) | 'z', v, side (-1: the room is on the low side
// of the line, +1 the high side), lo, hi, room }. An edge with no room across it is OUTER.
function edgesOf(rooms) {
  const out = [];
  for (const r of rooms) {
    const [x0, z0, x1, z1] = r.rect;
    out.push({ axis: 'x', v: x0, side: 1, lo: z0, hi: z1, room: r }, { axis: 'x', v: x1, side: -1, lo: z0, hi: z1, room: r });
    out.push({ axis: 'z', v: z0, side: 1, lo: x0, hi: x1, room: r }, { axis: 'z', v: z1, side: -1, lo: x0, hi: x1, room: r });
  }
  return out;
}
const sameLine = (a, b) => a.axis === b.axis && Math.abs(a.v - b.v) < EPS;
// the stretches of [lo, hi] that `cover` (a list of [lo, hi]) does / does not cover
function split(lo, hi, cover) {
  const cuts = cover.map(([a, b]) => [Math.max(lo, a), Math.min(hi, b)]).filter(([a, b]) => b - a > EPS).sort((p, q) => p[0] - q[0]);
  const inside = [], outside = []; let at = lo;
  for (const [a, b] of cuts) { if (a > at + EPS) outside.push([at, a]); if (b > at) { inside.push([Math.max(a, at), b]); at = b; } }
  if (hi > at + EPS) outside.push([at, hi]);
  // (touching stretches as one)
  const merged = []; for (const r of inside) { const l = merged[merged.length - 1]; if (l && Math.abs(l[1] - r[0]) < EPS) l[1] = r[1]; else merged.push(r.slice()); }
  return { inside: merged, outside };
}
// (a face's run, minus the openings in it: the doorways' panels)
const minus = (lo, hi, holes) => split(lo, hi, holes).outside;

export function buildCabin(p, bp, opts = {}) {
  const { space = null, which = 'all', outer = {}, look = 'light', items = true } = opts, oct = (opts.doorFrame ?? bp.doorFrame) === 'oct';
  const walls = which !== 'ceilings', ceilings = which !== 'walls';
  const q = new Piece();   // (drawn into a piece of its own, re-surfaced for the look, then copied into p)
  // (triangles by what they are, for the lab: stats)
  const stats = {}, tri = (P) => P.parts.reduce((t, x) => t + x.geo.index.count / 3, 0) + P.movers.reduce((t, m) => t + m.piece.parts.reduce((u, x) => u + x.geo.index.count / 3, 0), 0);
  const put = (what, src, o) => { stats[what] = (stats[what] || 0) + tri(src); return placeInto(q, src, o); };
  const rooms = bp.rooms, byId = Object.fromEntries(rooms.map((r) => [r.id, r])), canopy = (r) => r?.ceiling === 'canopy';
  const at = space ? spaceAt(space) : () => [0, 9];
  const E = edgesOf(rooms), notes = [];
  // which edges are outer (nothing across them), which shared; the outer edges along the hull's sides (x lines: the
  // linings), and the rooms whose slopes start where (y0 from the space just inside the line, under the outer door
  // its head)
  const across = (e) => E.filter((f) => f !== e && sameLine(e, f) && f.side === -e.side).map((f) => [f.lo, f.hi]);
  const doors = (bp.doors || []).map((d) => ({ d, w: doorWall(bp, d) })).filter((o) => o.w);
  const outerDoors = doors.filter((o) => o.d.rooms[1] === 'outside' && !o.w.hatch);
  const sideOf = (e) => (e.axis === 'x' && !canopy(e.room) ? split(e.lo, e.hi, across(e)).outside : []);
  const linings = [];
  for (const e of E) for (const [lo, hi] of sideOf(e)) {
    let Tmin = Infinity; for (let z = lo + 0.05; z < hi; z += 0.1) Tmin = Math.min(Tmin, at(e.v + e.side * 0.05, z)[1]);
    let y0 = Math.max(SLOPE.least, Math.min(SLOPE.top, Math.floor((Tmin - SLOPE.margin + EPS) * 20) / 20));
    const od = outerDoors.find((o) => o.w.along === 'z' && Math.abs(o.w.x - e.v) < EPS && o.w.span[0] < hi && o.w.span[1] > lo);
    if (od && outer.head) y0 = outer.head;
    linings.push({ ...e, lo, hi, y0, run: +(ROOM - y0).toFixed(3), door: od || null });
  }
  // (merged along each side where the slope starts alike: one run of wall and of slope per stretch)
  linings.sort((a, b) => a.v - b.v || a.lo - b.lo);
  const sides = [];
  for (const L of linings) { const last = sides[sides.length - 1]; if (last && Math.abs(last.v - L.v) < EPS && Math.abs(last.hi - L.lo) < EPS && last.y0 === L.y0 && !last.door && !L.door) { last.hi = L.hi; last.rooms.push(L.room.id); } else sides.push({ ...L, rooms: [L.room.id] }); }
  // the slope's run at a point along a side line (for the ceilings and the partitions' ends)
  const runAt = (v, z) => { const L = linings.find((s) => Math.abs(s.v - v) < EPS && z >= s.lo - EPS && z <= s.hi + EPS); return L ? L.run : 0; };

  // ── the doorways: each inside door's panel, its leaves, its id ──
  const panels = [];   // { axis, v, lo, hi } along their line (both faces)
  for (const { d, w } of doors) {
    if (w.hatch || d.rooms[1] === 'outside') { if (w.hatch) notes.push(`${d.id}: a hatch (not drawn yet)`); continue; }
    const c = w.along === 'z' ? d.at[1] : d.at[0], fw = d.width / 2 + FRAME;
    panels.push({ axis: w.along === 'z' ? 'x' : 'z', v: w.along === 'z' ? w.x : w.z, lo: c - fw, hi: c + fw, door: d });
  }
  // (an outer door's opening: no wall over it)
  for (const { d, w } of outerDoors) panels.push({ axis: w.along === 'z' ? 'x' : 'z', v: w.along === 'z' ? w.x : w.z, lo: w.span[0], hi: w.span[1], door: d, outer: true });
  const holesOn = (e) => panels.filter((P) => sameLine(P, e)).map((P) => [P.lo, P.hi]);
  // where a wall across a line stops a run on it: the faces of the walls on the lines that cross [lo, hi] at its ends
  const place = (x, z, axis, side) => ({ at: [x, 0, z], rot: [0, axis === 'z' ? (side > 0 ? 0 : PI) : (side > 0 ? PI / 2 : -PI / 2), 0] });
  // (a run of wall on a face: centred on the run, on the line, the room on `side`)
  const runs = [];
  const runAtLine = (e, lo, hi, o) => {
    const len = +(hi - lo).toFixed(3), mid = (lo + hi) / 2; if (len < 0.02) return;
    runs.push(`${e.axis}=${e.v} ${e.side > 0 ? '+' : '-'} ${e.room.id} ${lo.toFixed(2)}..${hi.toFixed(2)}${o.lining ? ' lining' : ''}${len < FILLER ? ' FILLER' : ''}`);
    const pos = e.axis === 'z' ? place(mid, e.v, 'z', e.side) : place(e.v, mid, 'x', e.side);
    if (len < FILLER) { const f = new Piece(); filler(f, len, {}, o); put('fillers', f, pos); return; }
    put(o.lining ? 'linings' : 'partitions', part(wallRun, { len, panel: o.lining ? Math.min(LINING_PANEL, len / Math.ceil(len / LINING_PANEL - EPS)) : len, pilaster: false, ...WALL, ...(o.wall || {}) }), pos);
  };

  if (walls) {
    // ── the linings and slopes down the hull's sides ──
    for (const S of sides) {
      const holes = holesOn(S), pieces = minus(S.lo, S.hi, holes);
      for (const [lo, hi] of pieces) runAtLine(S, lo, hi, { lining: true, wall: { top: S.y0, cornice: false } });
      // (the slope over the whole stretch, the door's opening too; its strip lights the room under it)
      const len = +(S.hi - S.lo).toFixed(3), pos = place(S.v, (S.lo + S.hi) / 2, 'x', S.side), n0 = q.lights.length;
      put('slopes', part(hullSlope, { len, y0: S.y0, run: S.run, panel: Math.min(LINING_PANEL, len / Math.ceil(len / LINING_PANEL - EPS)) }), pos);
      for (const l of q.lights.slice(n0)) l.i *= LIGHT.slopeStrip;
      // (the slope's own fill, for the bake: soft lights under it, a little in from the wall, looking up at it; tall
      // furniture against the wall would shade it from the room's middle)
      for (let z = S.lo + LIGHT.slopeEvery / 2; z < S.hi; z += LIGHT.slopeEvery) q.light([S.v + S.side * 0.9, S.y0 - 0.15, z], LIGHT.slope, [1, 0.97, 0.92], [-S.side * 0.7, 0.7, 0], 3);
    }
    // ── the partitions: every face that is not a lining ──
    for (const e of E) {
      if (e.axis === 'x' && !canopy(e.room)) { const { inside } = split(e.lo, e.hi, across(e)); if (!inside.length) continue; }
      // (a canopy room's own face only where it meets a built room)
      const shared = split(e.lo, e.hi, across(e)).inside; if (canopy(e.room) && !shared.length) continue;
      const stretches = e.axis === 'x' ? shared : canopy(e.room) ? shared : [[e.lo, e.hi]];
      // (the ends: in by FACE from each end where a wall runs across: the room's own walls there)
      for (const [lo0, hi0] of stretches) {
        const lo = lo0 + FACE, hi = hi0 - FACE;
        for (const [a, b] of minus(lo, hi, holesOn(e))) {
          // a partition reaching a hull side: its ends under the slope (on a face toward a canopy room's neighbour, or
          // any face of a room under glass: cut back to the slope, a gusset in the corner)
          const glassy = rooms.some((r) => canopy(r) && E.some((f) => f.room === r && sameLine(f, e)));
          if (e.axis === 'z' && glassy) { cutToSlopes(e, a, b); continue; }
          runAtLine(e, a, b, {});
        }
      }
    }
    // ── the doorways ──
    for (const P of panels) {
      if (P.outer) continue;
      const d = P.door, w = +(P.hi - P.lo).toFixed(3), L = d.leaves ?? 2;
      // (the kit's leaves: +1 slides to the doorway's own +x: along the ship's +x on a wall along x (turned 0), and
      // along +z on a wall along z (turned -90 degrees, which takes its +x to the ship's +z))
      const pos = P.axis === 'z' ? { at: [(P.lo + P.hi) / 2, 0, P.v], rot: [0, 0, 0] } : { at: [P.v, 0, (P.lo + P.hi) / 2], rot: [0, -PI / 2, 0] };
      const style = oct ? { frame: 'oct', ...octFaces(P, L) } : {};
      put('doorways', part(doorway, { w, clear: d.width, leaves: L === 2 ? 2 : L > 0 ? 1 : -1, top: DOOR_TOP, ...style }), { ...pos, id: `door ${d.id}:` });
    }
    // (the 8-sided doors' leaves of one size and kind are one kind of leaf wherever they hang, whatever each doorway's
    // signs: one draw for all of them)
    for (const mv of q.movers) { const i = mv.key.indexOf('oct-leaf:'); if (i > 0) mv.key = mv.key.slice(i); }
    // ── the floors (a room under glass has the ship's own) ──
    for (const r of rooms) {
      if (canopy(r)) continue;
      const [x0, z0, x1, z1] = r.rect, f = +(r.floor || 0);
      // (where the ship's own door is in this room's side, the deck stops at its step, across its opening)
      const od = outerDoors.find((o) => o.d.rooms[0] === r.id && o.w.along === 'z');
      const [s0, s1] = od ? od.w.span : [0, 0];
      const parts = od && outer.sill != null ? [[x0, z0, x1, s0], od.w.x > 0 ? [x0, s0, outer.sill, s1] : [-outer.sill, s0, x1, s1], [x0, s1, x1, z1]] : [[x0, z0, x1, z1]];
      for (const [a0, b0, a1, b1] of parts) {
        if (a1 - a0 < 0.02 || b1 - b0 < 0.02) continue;
        // (in 1 m tiles: the cabin kit's floor maps a metre of floor to one plate of the floor's texture, so a bigger tile
        // ran on past the deck's plate into the texture's other plates, vents and gratings)
        put('floors', part(floorRun, { v: 'deck', len: +(b1 - b0).toFixed(3), wid: +(a1 - a0).toFixed(3), tile: 1 }), { at: [(a0 + a1) / 2, f, (b0 + b1) / 2], rot: [0, PI / 2, 0] });
      }
    }
    // ── the furniture: the kit's fittings where it has them for a room's kind, else the plan's boxes ──
    const furnished = new Set();
    if (items) {
      const slopeAt = (axis, v, a) => { if (axis !== 'x') return null; const L = linings.find((s) => Math.abs(s.v - v) < EPS && a >= s.lo - EPS && a <= s.hi + EPS); return L ? { y0: L.y0, run: L.run } : null; };
      const openings = (axis, v) => panels.filter((P) => P.axis === axis && Math.abs(P.v - v) < EPS).map((P) => (P.outer ? [P.lo, P.hi] : [P.lo - 0.2, P.hi + 0.2]));
      for (const r of rooms) if (!canopy(r)) for (const id of furnishRoom(q, bp, r, { put, slopeAt, openings, look: LOOKS[look] })) furnished.add(id);
    }
    if (items) for (const it of bp.items || []) {
      const r = byId[it.room]; if (!r || canopy(r) || furnished.has(it.id)) continue;
      const K = ITEM_KINDS[it.kind] || { color: '#999999' }, [x0, z0, x1, z1] = it.rect, f = +(r.floor || 0) + +(it.y || 0), g = 0.01;
      const L = LOOKS[look], soft = L && (it.kind === 'bench' ? L.leather : it.kind === 'bunk' || it.kind === 'bed' ? L.bedding : null);
      const surf = it.kind === 'casing' ? 'black' : { c: soft || mute(K.color), r: soft ? 0.6 : 0.7, m: 0.05, w: 0.3 };
      q.slab(surf, x0 + g, x1 - g, f, f + +it.h, z0 + g, z1 - g, { r: 0, cell: 9, loops: [] }); stats.boxes = (stats.boxes || 0) + 12;
      // (a door casing's face at the edge of the ship's own door: an amber strip up its inner edge, so the opening
      // reads from inside, framed as his concept's airlock is)
      if (it.kind === 'casing') for (const { w } of outerDoors) {
        if (w.along !== 'z' || Math.abs(w.x - (w.x > 0 ? x1 : x0)) > 0.01) continue;
        const sz = Math.abs(z1 - w.span[0]) < 0.01 ? 1 : Math.abs(z0 - w.span[1]) < 0.01 ? -1 : 0; if (!sz) continue;
        const zf = sz > 0 ? z1 + 0.002 : z0 - 0.002, xe = w.x > 0 ? x0 + 0.04 : x1 - 0.04, d = w.x > 0 ? 1 : -1;
        q.glowSlab('amber', Math.min(xe, xe + d * 0.035), Math.max(xe, xe + d * 0.035), f + 0.08, f + +it.h - 0.06, Math.min(zf, zf + sz * 0.004), Math.max(zf, zf + sz * 0.004));
        q.light([xe + d * 0.1, f + 1.0, zf + sz * 0.15], 0.25, [1, 0.97, 0.92], [0, 0, sz], 2.5);
      }
    }
    // (the ship's own door: a yellow nosing along the deck's edge at its step, across the opening)
    for (const { w } of outerDoors) if (w.along === 'z' && outer.sill != null) { const xs = w.x > 0 ? outer.sill : -outer.sill, d = w.x > 0 ? -1 : 1; q.slab('yellow', Math.min(xs, xs + d * 0.07), Math.max(xs, xs + d * 0.07), -0.004, 0.006, w.span[0], w.span[1], { r: 0, cell: 9, loops: [] }); }
  }
  if (ceilings) {
    // ── the ceilings: each room's, between its slopes, at ROOM ──
    for (const r of rooms) {
      if (canopy(r)) continue;
      const [x0, z0, x1, z1] = r.rect, zm = (z0 + z1) / 2, a = x0 + runAt(x0, zm), b = x1 - runAt(x1, zm), f = +(r.floor || 0);
      if (b - a < 0.05) continue;
      // (one tile the room's size, lit: the station's light panel in the middle of the ceiling; tiles cost the same
      // whatever their size, and a lit one about five unlit)
      const len = +(z1 - z0).toFixed(3), wid = +(b - a).toFixed(3), n0 = q.lights.length;
      put('ceilings', part(ceilingRun, { len, wid, tile: Math.max(len, wid), lights: 1, h: ROOM }), { at: [(a + b) / 2, f, zm], rot: [0, PI / 2, 0] });
      // (the panel at LIGHT.panel of the kit's strength, but at least LIGHT.least in all, so a small room still has its pool)
      const lit = q.lights.slice(n0), sum = lit.reduce((t, l) => t + l.i, 0) * LIGHT.panel; for (const l of lit) l.i *= LIGHT.panel * (sum > 0 && sum < LIGHT.least ? LIGHT.least / sum : 1);
      // (its pool, a little under the panel)
      q.lights.push({ at: [(a + b) / 2, f + ROOM - 0.3, zm], i: 0, color: [1, 0.97, 0.92], dir: null, reach: POOLS.reach, pool: { i: Math.max(POOLS.least, Math.min(POOLS.most, POOLS.panel * len * wid)), reach: POOLS.reach } });
    }
  }
  // the bounce: in each room, a soft light pointing up from the middle at waist height (the light a pale floor and
  // furniture would throw back up), for the bake, so the ceilings and the slanted corners are not black (the kit's
  // panels light straight down)
  if (walls) for (const r of rooms) {
    if (canopy(r)) continue;
    const [x0, z0, x1, z1] = r.rect, area = (x1 - x0) * (z1 - z0);
    q.light([(x0 + x1) / 2, +(r.floor || 0) + 1.0, (z0 + z1) / 2], Math.max(LIGHT.bounceLeast, LIGHT.bounce * area), [1, 0.97, 0.92], [0, 1, 0], 5);
  }
  // a partition's run on a line along x that meets the hull's sides: the middle full height, each end within the slope's
  // run of a side line cut down to the slope's foot, and a gusset (a triangle of panel) filling the corner up to it
  function cutToSlopes(e, a, b) {
    let lo = a, hi = b; const cuts = [];
    for (const S of sides) {
      if (S.v < a - 0.1 || S.v > b + 0.1 || e.v < S.lo - EPS || e.v > S.hi + EPS) continue;
      const end = S.v < (a + b) / 2 ? 'lo' : 'hi', inner = S.v < (a + b) / 2 ? S.v + S.run : S.v - S.run;
      if (end === 'lo' && inner > lo) { cuts.push([lo, inner, S]); lo = inner; } else if (end === 'hi' && inner < hi) { cuts.push([inner, hi, S]); hi = inner; }
    }
    if (hi - lo > 0.02) runAtLine(e, lo, hi, {});
    for (const [c0, c1, S] of cuts) {
      runAtLine(e, c0, c1, { wall: { top: S.y0, cornice: false } });
      gusset(e, c0, c1, S);
    }
  }
  // (the gusset: from the slope's foot at the side line, over the cut-down wall's top, up to the ceiling where the slope
  // ends; on the wall's face, white2)
  function gusset(e, c0, c1, S) {
    const zf = e.v + e.side * (FACE + 0.002), atSide = Math.abs(S.v - c0) < Math.abs(S.v - c1) ? c0 : c1, other = atSide === c0 ? c1 : c0;
    const pts = [[atSide, S.y0], [other, S.y0], [other, ROOM]].map(([x, y]) => new THREE.Vector3(x, y, zf));
    const g = new THREE.BufferGeometry().setFromPoints(pts); g.setIndex([0, 1, 2]); g.computeVertexNormals();
    const n = new THREE.Vector3(0, 0, e.side); if (new THREE.Vector3().fromBufferAttribute(g.attributes.normal, 0).dot(n) < 0) g.setIndex([0, 2, 1]);
    g.computeVertexNormals(); q.add('solid', g, 'white2'); stats.gussets = (stats.gussets || 0) + 1;
  }
  // (each room's tone by its kind; outside every room, the look's own)
  const L = LOOKS[look] || LOOKS.light, toneAt = (x, z) => { const r = rooms.find((q2) => x >= q2.rect[0] - 0.1 && x <= q2.rect[2] + 0.1 && z >= q2.rect[1] && z < q2.rect[3]); return TONES[(r && L.rooms[r.kind]) || L.tone]; };
  recolour(q, look, toneAt);
  for (const l of q.lights) if (!l.pool) l.i *= LIGHT.scale * (l.strip ? LIGHT.strips : 1);
  placeInto(p, q, {});
  p.notes = notes; p.runs = runs; p.stats = { ...(p.stats || {}), ...Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, Math.round(v)])) };
  p.seesOutside = seesOutside(bp);
  // (the pools, each in the room it is in; one standing in a doorway goes to the room it faces)
  const roomAt = (x, z) => rooms.find((r) => x >= r.rect[0] - EPS && x <= r.rect[2] + EPS && z >= r.rect[1] - EPS && z <= r.rect[3] + EPS)?.id ?? null;
  p.pools = q.lights.filter((l) => l.pool).map((l) => ({ at: l.at.map((v) => +v.toFixed(3)), color: l.color, i: l.pool.i, reach: l.pool.reach, room: roomAt(l.at[0], l.at[2]) }));
  return p;

  // an 8-sided doorway's two faces (kit/shipparts/cabin/door.js): the sign each shows (the kind of the room beyond it)
  // and the side of the door its control panel takes (in the doorway's own x, which is the ship's +x on a wall along x
  // and the ship's +z on a wall along z): the side away from where a single leaf parks if that wall is clear, else the
  // other, else none. Clear: inside its room's own wall (not past a corner), no other doorway there, nothing tall standing
  // against the wall there and nothing hanging low over it.
  function octFaces(P, L) {
    const c = (P.lo + P.hi) / 2, k = (P.hi - P.lo) / 2, d = P.door;
    const sideRoom = (s) => rooms.find((r) => d.rooms.includes(r.id) && Math.abs((P.axis === 'z' ? (s > 0 ? r.rect[1] : r.rect[3]) : (s > 0 ? r.rect[0] : r.rect[2])) - P.v) < EPS);
    // (the front face looks into the room on the line's high side on a wall along x (turned 0), on its low side on a wall
    // along z (turned -90 degrees: the doorway's +z is the ship's -x))
    const fs = P.axis === 'z' ? 1 : -1, front = sideRoom(fs), back = sideRoom(-fs);
    const free = (room, s) => {
      if (!room || canopy(room)) return false;
      const a = c + s * (k + 0.11), [lo, hi] = P.axis === 'z' ? [room.rect[0], room.rect[2]] : [room.rect[1], room.rect[3]];
      if (a - 0.08 < lo + FACE + 0.02 || a + 0.08 > hi - FACE - 0.02) return false;
      if (panels.some((Q) => Q !== P && sameLine(Q, P) && Q.lo < a + 0.08 && Q.hi > a - 0.08)) return false;
      return !(bp.items || []).some((it) => {
        if (it.room !== room.id) return false;
        const [x0, z0, x1, z1] = it.rect, [ia, ib] = P.axis === 'z' ? [x0, x1] : [z0, z1], [ja, jb] = P.axis === 'z' ? [z0, z1] : [x0, x1];
        return Math.min(Math.abs(ja - P.v), Math.abs(jb - P.v)) < 0.4 && (hangs(it) ? +it.y < 1.45 : +it.h > 0.95) && ia < a + 0.08 && ib > a - 0.08;
      });
    };
    const prefer = L === 2 ? [1, -1] : [-Math.sign(L), Math.sign(L)], pick = (room) => prefer.find((s) => free(room, s)) ?? 0;
    const sign = (r) => (r && SIGNS[r.kind] ? r.kind : undefined);
    // (a side where another doorway's frame meets this one's, or where the frame ends in its room's corner against a wall
    // across: no light strips there on that face, so two doors side by side share a plain post and a corner stays clear)
    const meets = (s) => panels.some((Q) => Q !== P && !Q.outer && sameLine(Q, P) && Math.abs((s < 0 ? Q.hi : Q.lo) - (s < 0 ? P.lo : P.hi)) < 0.02);
    const cornered = (room, s) => { if (!room) return false; const [lo, hi] = P.axis === 'z' ? [room.rect[0], room.rect[2]] : [room.rect[1], room.rect[3]]; return s < 0 ? P.lo - lo < 0.06 : hi - P.hi < 0.06; };
    const sharedOf = (room) => [-1, 1].filter((s) => meets(s) || cornered(room, s));
    return { signs: { front: sign(back), back: sign(front) }, panels: { front: pick(front), back: pick(back) }, shared: { front: sharedOf(front), back: sharedOf(back) } };
  }
}
// the rooms that can see out of the ship, by id: under a canopy ('canopy': always, through its glass) and those the
// ship's own door opens from ('door': while it is open). Every other room sees only the cabin.
export function seesOutside(bp) {
  const out = {};
  for (const r of bp.rooms || []) if (r.ceiling === 'canopy') out[r.id] = 'canopy';
  for (const d of bp.doors || []) if (d.rooms?.[1] === 'outside' && !out[d.rooms[0]]) out[d.rooms[0]] = 'door';
  return out;
}
// a sliver of wall too short for a panel: a plain one, its band across it (on its line, the room in its +z)
function filler(p, len, pos, o) {
  const h = o.wall?.cornice === false ? o.wall.top : ROOM, q = new Piece();
  q.slab('dark', -len / 2, len / 2, 0, h, 0.004, 0.012, { r: 0, cell: 9, loops: [] });
  q.slab('white', -len / 2, len / 2, 0.15, 1.22, 0.012, FACE, { r: 0, cell: 9, loops: [] }); q.slab('band', -len / 2, len / 2, 1.22, 1.52, 0.012, FACE, { r: 0, cell: 9, loops: [] });
  q.slab('white', -len / 2, len / 2, 1.52, h, 0.012, FACE, { r: 0, cell: 9, loops: [] }); q.slab('dark', -len / 2, len / 2, 0, 0.15, 0.012, FACE + 0.005, { r: 0, cell: 9, loops: [] });
  placeInto(p, q, pos);
}
// a plan colour toned down for a box in the 3D cabin
function mute(hex) { const c = new THREE.Color(hex), g = new THREE.Color('#8a8f96'); c.lerp(g, 0.45); return '#' + c.getHexString(); }
