// FURNISHING THE MEDIC'S ROOMS (the chosen plan, kit/ships/medic-open-bench.blueprint.json, and the plans that share its
// rooms): the cabin's builder (kit/ships/cabin-built.js) furnishes a room by its kind (kit/ships/cabin-furnish.js); for a
// blueprint on the Medic's shell ('medic-built') the kinds here come first (cabin-furnish.js MORE):
//   medbay       the med bay, after the game's maker's wish list and his picture (refs/ships/medic/medicalbay_2026-11-10.png),
//                its gear on all four corners as he marked them: see furnishMedBay
//   lab          the open pharmacy and lab: the sit-down bench along the hull, the shelves over its aft end, the island
//                with its lab gear, the drugs in a tall locked cabinet, the supplies rack by the med bay's door
//   bunks        the crew room: the bunk room's own furnishing (cabin-furnish.js) for the bunks and lockers, and here the
//                third bed, the step up to the bunk, the cubby, the kitchen, the table and its stools
//   engineering  engineering's own furnishing (the reactor, the drive and pumps, the station, the pipes), and here its
//                walls made busy: wiring painted on cards, boxes of lit switches, gauges
// The rooms the Explorer's furnishing already does as the Medic's plan wants (the airlock, the washroom) are left to it.
// Every built-in is shallow (0.2 to 0.25 m off its wall) and its free corners are cut at 45 degrees.
import { part } from '../shipparts/place.js';
import { FACE, ROOM } from '../shipparts/cabin/ship.js';
import { MORE, ROOMS, wallOf, localX, wallFields, asItems, toWorld, rotOf, hangPosters } from './cabin-furnish.js';
import * as MB from '../shipparts/cabin/medbay.js';
import { hisMask } from '../shipparts/cabin/gasmask.js';
import { shallowLocker } from '../shipparts/cabin/lockers.js';
import { printed, FLAT } from '../shipparts/cabin/bits.js';
import { prism, add } from '../bevel.js';
import { washLight } from '../shipparts/cabin/lights.js';
import { stowedStretcher } from '../shipparts/cabin/stretcher.js';
import * as ML from '../shipparts/cabin/medlab.js';
import * as MC from '../shipparts/cabin/medcrew.js';
import * as LB from '../shipparts/cabin/lab.js';
import { stool, messTable, mug, galleyRun, coffeeMachine } from '../shipparts/cabin/mess.js';
import { screen } from '../shipparts/cabin/bits.js';
import { growPod } from '../shipparts/cabin/growpod.js';
import { postersFor } from '../shipparts/cabin/print.js';

const PI = Math.PI, EPS = 1e-6, r3 = (v) => +v.toFixed(3);

// THE MEDIC'S OWN LIGHT. The game's maker, 2026-11-10: "I think the medic rooms can be brighter, due to the nature of the
// work". So the med bay and the pharmacy and lab are lit for medical work, brighter and whiter than the ship's darker
// level, which stays as it is for every other room (the Medic's crew room and engineering keep it, and Explorer C's
// rooms, his pick for that ship, are not touched): more downlights, each brighter, with a bigger pool, in a cool working
// white; the lamps over the beds brighter, their pools wider; the strips under the high lockers and the lab's shelves
// brighter and cool white. Every light still comes from a fitting you can see (a disc in its rim, a lamp's head, a strip
// on its rail), and the rooms keep their pools: brighter pools and more of them, not even light.
//   on       false: the two rooms back to the ship's darker level, as they were (one switch)
//   color    the light the fittings throw (linear; kept under 0.85 red so the cabin does not re-tone it to the room's warm
//            white) and glow, the strips' own glow
//   disc     each downlight: its light in the bake (i), its real-time pool (pool, poolReach), its disc's radius (r)
//   lamp     the lamps over the beds: their light, pool and reach
//   strip    the strips under the high lockers and the shelves: their light, times this; stripPool, their pools
//   beam     the beams with dust under the discs and lamps: stronger, so they still read against the brighter walls
//   extra    the downlights added (their beams off, so the beams that are there still read as events): the med bay's over
//            the band's middle and over the walkway between the beds' feet, the lab's by the supplies rack
export const CLINIC = {
  on: true, color: [0.82, 0.93, 1.06], glow: [2.9, 3.2, 3.6],
  disc: { i: 1.5, pool: 1.0, poolReach: 3.2, r: 0.1 }, lamp: { i: 1.8, pool: 1.2, reach: 2.8, poolReach: 2.2, beam: 1.5 }, beam: 1.7,
  strip: 2.4, stripPool: 0.16, extra: true,
};
// (a downlight's options in the two rooms; null: the kit's own)
const clinicDisc = (beam = true) => (CLINIC.on ? { i: CLINIC.disc.i, pool: CLINIC.disc.pool, poolReach: CLINIC.disc.poolReach, r: CLINIC.disc.r, color: CLINIC.color, beam: beam ? CLINIC.beam : 0 } : undefined);
const clinicStrip = (base) => (CLINIC.on ? { light: r3(base * CLINIC.strip), glow: CLINIC.glow, color: CLINIC.color, pool: CLINIC.stripPool } : {});

// ── the med bay ─────────────────────────────────────────────────────────────────────────────────────────────────
// His four corners (2026-11-10, "these walls I drew Red on should have gear on them"): the forward wall either side of
// the door from the lab, the aft wall either side of the door to the crew room, and the hull's side beside each bed, aft
// of its ramp's opening. Along each, from the door outward (u: metres from the door's frame):
//   forward, port (the grab-and-go wall by the ramp that faces the medical centre): a fire extinguisher low by the door;
//     the strap-pouch wall (AIRWAY, IV / FLUIDS, MEDS over WOUND CARE, DIAGNOSTICS, TOOLS, over the TRAUMA bag, the small
//     O2 bottles and the spare masks), shallow drawers under it, lockers over it; the ambulance stretcher folded flat on
//     end at the hull end
//   forward, starboard: the fire axe by the door; a counter of shallow drawers with the x-ray viewer over it, the gas mask
//     on its hook; the hazmat locker at the hull end; lockers over the counter
//   aft, port (behind the port bed): two oxygen tanks at the walkway end; the RESPIRATORY, MONITORING and MISC pouches
//     over the bed; lockers over them
//   aft, starboard: two oxygen tanks; the defibrillator, the sharps bin; the spine board along the wall over the bed;
//     lockers over them
//   each bed's hull side, at its head: the head panel (oxygen, air, suction), the vital signs monitor, the IV bags over
//     their pumps
// Over each bed a lamp on a jointed arm, parked over the bed's middle (never forward of the bed into the see-through
// band); two downlights before the forward wall's runs; a wash light over the stretcher and over the hazmat locker. On
// the deck, a yellow line along each edge of the band from each ramp's mouth to the walkway, KEEP CLEAR at each mouth.
// Nothing stands or hangs in the band (z -0.75 to 1.25 in the chosen plan: the
// ramps' openings), in the walkway between the beds, or in a door's way.
export const BAY = { door: 0.12, top: [1.96, 2.45], depth: 0.22 };
function furnishMedBay({ bp, room, ctx, done, items, f, at, A }) {
  const [X0, Z0, X1, Z1] = room.rect, blocks = [];
  const wall = (axis, v, side) => ({ axis, v, side, lo: axis === 'z' ? X0 : Z0, hi: axis === 'z' ? X1 : Z1 });
  // (each thing on a wall: its own part, placed at its middle along the wall; a block kept so the walls' fields go round
  // it)
  const put = (tag, fn, o, W, a, [y0, y1], half) => { ctx.put('medbay: ' + tag, part(fn, o), at(W, r3(a))); blocks.push({ axis: W.axis, v: W.v, side: W.side, lo: a - half, hi: a + half, y0, y1 }); };
  // the runs of the forward and aft walls, each side of the door in it: from its frame (inner) out to the hull (outer)
  const runs = (W) => {
    const d = (bp.doors || []).find((q) => q.rooms.includes(room.id) && q.rooms[1] !== 'outside' && Math.abs(q.at[1] - W.v) < EPS), c = d ? d.at[0] : 0, hf = d ? d.width / 2 + 0.1 + BAY.door - 0.1 : 0;
    return [1, -1].map((s) => ({ s, inner: c + s * hf, outer: s > 0 ? X1 : X0, len: (s > 0 ? X1 - c : c - X0) - hf, at: (u) => c + s * (hf + u) }));
  };
  const FW = wall('z', Z1, -1), AW = wall('z', Z0, 1);
  // the lockers hung high on a run, from u0 to u1 along it (their free corners cut, the hull end's too)
  const topLockers = (W, R, u0, u1) => {
    const a0 = R.at(u0), a1 = R.at(u1), mid = (a0 + a1) / 2, len = Math.abs(a1 - a0), k = localX(W, mid, R.at(u1)) > 0 ? 1 : -1;
    const cut = k > 0 ? [0.05, 0.06] : [0.06, 0.05];
    put('lockers', MB.wallCabinet, { x0: r3(-len / 2), x1: r3(len / 2), y0: BAY.top[0], y1: BAY.top[1], depth: 0.2, cut, handle: A.handle, trim: A.trim, ...clinicStrip(0.22) }, W, mid, [BAY.top[0], 2.6], len / 2);
  };
  // the drawers on a run from u0 to u1, h high (a worktop over them if they are a counter)
  const drawers = (W, R, u0, u1, h, rows, counter) => {
    const a0 = R.at(u0), a1 = R.at(u1), mid = (a0 + a1) / 2, len = Math.abs(a1 - a0), k = localX(W, mid, R.at(u0)) > 0 ? 1 : -1;
    const ends = k > 0 ? [0, 0.06] : [0.06, 0];
    put('drawers', shallowLocker, { w: r3(len), depth: BAY.depth, h, rows, cols: Math.max(1, Math.round(len / 0.4)), ends, handle: A.handle, trim: A.trim }, W, mid, [0, h], len / 2);
    if (counter) put('drawers', counterTop, { len: r3(len), depth: BAY.depth + 0.02, y: h, ends: ends.map((e) => (e ? 0.08 : 0)) }, W, mid, [0, h + 0.03], len / 2);
  };
  const [fP, fS] = runs(FW), [aP, aS] = runs(AW);
  // ── the forward wall, port: the grab-and-go wall ──
  if (fP.len > 1.5) {
    const R = fP, cw = Math.min(0.37, (R.len - 0.62) / 3), u0 = 0.22, um = (k) => u0 + cw * (k + 0.5);
    put('extinguisher', MB.extinguisher, { y0: 0.08 }, FW, R.at(0.1), [0, 0.7], 0.1);
    [['AIRWAY', 'airway'], ['IV / FLUIDS', 'fluids'], ['MEDS', 'meds']].forEach(([label, kind], k) => put('pouches', MB.pouchPanel, { label, kind, y0: 1.47, w: r3(cw - 0.02), h: 0.45, rows: 2 }, FW, R.at(um(k)), [1.47, 1.92], cw / 2));
    [['WOUND CARE', 'wound'], ['DIAGNOSTICS', 'diag'], ['TOOLS', 'tools']].forEach(([label, kind], k) => put('pouches', MB.pouchPanel, { label, kind, y0: 0.98, w: r3(cw - 0.02), h: 0.45, rows: 2 }, FW, R.at(um(k)), [0.98, 1.43], cw / 2));
    put('trauma bag', MB.traumaBag, { y0: 0.5, w: r3(cw - 0.03), h: 0.4, d: 0.13 }, FW, R.at(um(0)), [0.5, 0.94], cw / 2);
    put('pouches', MB.pouchPanel, { label: 'O2', kind: 'o2', y0: 0.5, w: r3(cw - 0.02), h: 0.44, rows: 1 }, FW, R.at(um(1)), [0.5, 0.94], cw / 2);
    put('pouches', MB.pouchPanel, { label: 'MASKS', kind: 'masks', y0: 0.5, w: r3(cw - 0.02), h: 0.44, rows: 1 }, FW, R.at(um(2)), [0.5, 0.94], cw / 2);
    drawers(FW, R, u0, u0 + 3 * cw, 0.44, [[0.1, 0.42]], false);
    topLockers(FW, R, u0 - 0.02, u0 + 3 * cw + 0.02);
    const sw = Math.min(0.5, R.len - (u0 + 3 * cw) - 0.06);
    if (sw > 0.36) {
      // (the ambulance stretcher folded flat and hung on end, by the ramp that faces the medical centre)
      put('stretcher', stowedStretcher, { len: 1.8, w: r3(Math.min(0.5, sw - 0.06)), y0: 0.16 }, FW, R.at(R.len - sw / 2 - 0.03), [0, 2.1], sw / 2 + 0.03);
      // (a wash light over it, under the hull's slope: the hull end is dark otherwise)
      ctx.put('medbay: lights', part(washLight, { len: r3(sw), y: 2.12, i: 0.16, pool: 0.2 }), at(FW, r3(R.at(R.len - sw / 2 - 0.03))));
    }
  }
  // ── the forward wall, starboard: the axe, the x-ray viewer over the counter, the mask, the hazmat locker ──
  if (fS.len > 1.5) {
    const R = fS, hz = Math.min(0.46, R.len - 1.38), uh = R.len - hz / 2 - 0.02;
    put('axe', MB.fireAxe, { y0: 0.95, len: 0.85 }, FW, R.at(0.13), [0.9, 1.85], 0.13);
    drawers(FW, R, 0.3, R.len - hz - 0.04, 0.9, [[0.1, 0.36], [0.38, 0.62], [0.64, 0.86]], true);
    const ux = 0.3 + (R.len - hz - 0.34 - 0.3) * 0.43;
    put('x-ray viewer', MB.xrayViewer, { y0: 1.14, w: 0.66, h: 0.56 }, FW, R.at(ux), [1.0, 1.8], 0.38);
    ctx.put('medbay: masks', part(hisMask, { size: 0.24 }), { ...at(FW, r3(R.at(ux + 0.52))), at: posOn(FW, R.at(ux + 0.52), f + 1.34, FACE + 0.012) });
    ctx.put('medbay: masks', part(maskHook, {}), at(FW, r3(R.at(ux + 0.52))));
    blocks.push({ axis: FW.axis, v: FW.v, side: FW.side, lo: R.at(ux + 0.52) - 0.13, hi: R.at(ux + 0.52) + 0.13, y0: 1.3, y1: 1.65 });
    // (its free corner, toward the counter, cut)
    put('hazmat locker', MB.hazmatLocker, { w: r3(hz), h: 2.08, d: 0.24, cut: localX(FW, R.at(uh), R.at(0)) < 0 ? [0.07, 0] : [0, 0.07] }, FW, R.at(uh), [0, 2.1], hz / 2);
    topLockers(FW, R, 0.3, R.len - hz - 0.06);
    ctx.put('medbay: lights', part(washLight, { len: r3(hz), y: 2.13, i: 0.16, pool: 0.2 }), at(FW, r3(R.at(uh))));
  }
  // ── the aft wall, behind the beds ──
  for (const R of [aP, aS]) {
    if (R.len < 1.4) continue;
    for (const u of [0.32, 0.54]) put('oxygen tanks', MB.o2Tank, { r: 0.09, h: 1.0 }, AW, R.at(u), [0, 1.15], 0.1);
    if (R.s > 0) {
      const cw = Math.min(0.37, (R.len - 0.7) / 3);
      [['RESPIRATORY', 'resp'], ['MONITORING', 'monitor'], ['MISC', 'misc']].forEach(([label, kind], k) => put('pouches', MB.pouchPanel, { label, kind, y0: 1.02, w: r3(cw - 0.02), h: 0.86, rows: 3 }, AW, R.at(0.7 + cw * (k + 0.5)), [1.02, 1.88], cw / 2));
    } else {
      put('defibrillator', MB.defib, { y0: 1.02 }, AW, R.at(0.92), [0.98, 1.36], 0.25);
      put('sharps bin', MB.sharpsBin, { y0: 1.02 }, AW, R.at(1.32), [0.98, 1.27], 0.1);
      const sl = Math.min(1.75, R.len - 0.12);
      put('spine board', MB.spineBoard, { y0: 1.45, len: r3(sl), w: 0.4 }, AW, R.at(0.06 + sl / 2), [1.4, 1.9], sl / 2);
    }
    topLockers(AW, R, 0.06, Math.min(R.len - 0.36, 1.5));
  }
  // ── the beds, and at each one's head on the hull's side its panel, monitor and IV ──
  let n = 0;
  for (const it of items.filter((x) => x.kind === 'patient')) {
    const W = wallOf(it, room); if (!W) continue;
    const mid = (W.lo + W.hi) / 2, len = W.depth;
    ctx.put('medbay: beds', part(MB.patientBed, { len: r3(len), w: 0.9, top: +it.h || 0.8, label: 'MED-0' + (++n) }), at(W, r3(mid)));
    done.add(it.id);
    // (on its head's wall: toward the bay's aft wall the IV, the panel at its middle, the monitor a little forward)
    if (W.axis === 'x') {
      const aft = Z0 + 0.22, SW = { ...W, lo: Z0, hi: Z1 };
      put('bed heads', MB.bedHead, { y0: 0.92, w: 0.56 }, SW, mid, [0.9, 1.18], 0.3);
      put('vital signs', MB.vitalsMonitor, { y: 1.58, w: 0.44, h: 0.28, live: 'rest', seed: r3(n * 0.37) }, SW, mid + 0.17, [1.38, 1.8], 0.26);
      if (mid - 0.4 > aft) put('IV', MB.ivStation, { y0: 1.0, top: 1.98 }, SW, aft, [0.95, 2.02], 0.16);
      // the lamp on its arm: its mount on the ceiling a little in from the bed's middle, its head parked over the bed
      const bx = W.v + (W.side) * len / 2, mx = W.v + W.side * len * 0.72;
      ctx.put('medbay: lamps', part(MB.armLamp, { ceil: ROOM, head: [r3(bx - mx), 1.98, -0.04], drop: 1.13, ...(CLINIC.on ? { ...CLINIC.lamp, color: CLINIC.color } : {}) }), { at: [r3(mx), f, r3(mid)] });
    }
  }
  // ── the downlights, the lines on the deck, KEEP CLEAR at the ramps' mouths ──
  const ramps = (bp.doors || []).filter((d) => d.rooms[0] === room.id && d.rooms[1] === 'outside');
  // (two, before the forward wall's two runs of gear, over the band kept clear: they light the gear walls and the way
  // across; the lamps over the beds light the aft half)
  if (ctx.disc) for (const s of [1, -1]) ctx.disc(room, r3(s * Math.min(1.35, (X1 - X0) / 2 - 0.9)), r3(Z1 - 0.5), clinicDisc());
  // (the Medic's own light, CLINIC: two more, their beams off: over the band's middle, and over the walkway between the
  // beds' feet, lighting both aft corners)
  if (ctx.disc && CLINIC.on && CLINIC.extra) { ctx.disc(room, 0, r3(ramps.length ? ramps[0].at[1] : (Z0 + Z1) / 2), clinicDisc(false)); ctx.disc(room, 0, r3(Z0 + 0.7), clinicDisc(false)); }
  for (const d of ramps) {
    const s = d.at[0] > 0 ? 1 : -1, [z0, z1] = [d.at[1] - d.width / 2, d.at[1] + d.width / 2], xa = s * 0.62, xb = d.at[0] - s * 0.06;
    ctx.put('medbay: deck marks', part(deckLines, { len: r3(Math.abs(xb - xa)), z: [r3(z0 + 0.03), r3(z1 - 0.03)], end: s, mid: r3(d.at[1]) }), { at: [r3((xa + xb) / 2), f, 0] });
  }
  wallFields(ctx, room, items, at, { tag: 'medbay: wall fields', touch: true, also: asItems(blocks) });
}
// (a point on wall W, at `a` along it, height y, `out` from the wall line)
const posOn = (W, a, y, out) => (W.axis === 'z' ? [a, y, W.v + W.side * out] : [W.v + W.side * out, y, a]);
// a counter's worktop over shallow drawers: a charcoal slab, its free end's front corner cut (a wall fitting)
function counterTop(p, o) {
  const len = o.len, d = o.depth, y = o.y, [eL, eR] = o.ends || [0, 0];
  const pts = [[-len / 2, FACE], [len / 2, FACE]]; if (eR) pts.push([len / 2, d - eR], [len / 2 - eR, d]); else pts.push([len / 2, d]); if (eL) pts.push([-len / 2 + eL, d], [-len / 2, d - eL]); else pts.push([-len / 2, d]);
  add(p, o.look || 'black', prism(pts.map(([x, z]) => [x, -z]), y, y + 0.03, {}), [0, 0, 0], FLAT);
  return p;
}
// the gas mask's hook: a small dark plate and a peg
function maskHook(p) { p.slab('gun', -0.03, 0.03, 1.56, 1.64, FACE, FACE + 0.012, { r: 0, cell: 9, loops: [] }); p.slab('rail', -0.008, 0.008, 1.6, 1.616, FACE + 0.012, FACE + 0.06, { r: 0, cell: 9, loops: [] }); return p; }
// two yellow lines on the deck along the edges of the band kept clear across the bay (a FLOOR piece: x along them,
// centred; z as the room's), KEEP CLEAR between them by the ramp's mouth (o.end: the ramp's end, +1 or -1), reading from
// the walkway
function deckLines(p, o) {
  for (const z of o.z) p.slab('yellow', -o.len / 2, o.len / 2, 0.001, 0.004, z - 0.025, z + 0.025, { r: 0, cell: 9, loops: [] });
  printed(p, 'clear', 0.72, 0.18, [o.end * (o.len / 2 - 0.3), 0.005, o.mid], [-PI / 2, 0, -o.end * PI / 2], '#c9a032');
  return p;
}

// ── the pharmacy and lab ────────────────────────────────────────────────────────────────────────────────────────
// The bench along the hull (a counter on a wall): the lab bench's drawers, its knee space where the stool is, a sample
// fridge's door in the column beside the knee, a sink at its forward end, a rack of tubes and a tablet on it, a live screen
// on the hull over its forward half (the place his plan left for a window: none, question 4). The shelves over its aft
// end (an overhead item over it). The island (a counter standing free): its four corners cut, a microscope, a centrifuge,
// an analyser, two racks of sample tubes and a small screen on it. The drugs (a pharmacy item): one tall locked cabinet.
// The supplies (a rack): stretchers, blankets, splints, collars, kept clear of the med bay door's frame. The stool. Two
// downlights, over the island and over the bench; the science posters on the clearest walls.
function furnishLab({ bp, room, ctx, done, items, f, at, A }) {
  const blocks = [];
  const stool = items.find((it) => it.kind === 'bench');
  for (const it of items) {
    const W = wallOf(it, room), [x0, z0, x1, z1] = it.rect, h = +it.h || 0.9;
    if (it.kind === 'counter' && W) {
      // the bench: its columns half a metre each, the knee space where the stool stands (else the middle)
      const mid = (W.lo + W.hi) / 2, len = W.hi - W.lo, n = Math.max(1, Math.round(len / 0.5)), cw = len / n, lx = (a) => localX(W, mid, a);
      let knee = n >= 3 ? Math.floor(n / 2) : -1;
      if (stool) { const sc = W.axis === 'x' ? (stool.rect[1] + stool.rect[3]) / 2 : (stool.rect[0] + stool.rect[2]) / 2; knee = Math.max(0, Math.min(n - 1, Math.floor((lx(sc) + len / 2) / cw))); }
      ctx.put('lab: bench', part(LB.labBench, { len: r3(len), depth: W.depth, top: h, knee, handle: A.handle, trim: A.trim }), at(W, mid));
      // (the far end from the knee: the sink; the column beside the knee toward it: the fridge)
      const far = knee >= n / 2 ? 0 : n - 1, colX = (i) => -len / 2 + cw * (i + 0.5), fr = knee + (far < knee ? -1 : 1);
      if (fr >= 0 && fr < n && fr !== far) ctx.put('lab: bench', part(ML.fridgeFront, { x: r3(colX(fr)), w: r3(cw), top: h, z: r3(W.depth - 0.03 + 0.008), handle: A.handle }), at(W, mid));
      ctx.put('lab: on the bench', part(sinkPart, {}), { at: toWorld(W, mid, [colX(far), f + h, 0]), rot: [0, rotOf(W), 0] });
      ctx.put('lab: on the bench', part(LB.vialRack, { seed: 3 }), { at: toWorld(W, mid, [colX(far) + (far < knee ? 1 : -1) * cw * 1.1, f + h, 0.18]), rot: [0, rotOf(W), 0] });
      if (knee >= 0) ctx.put('lab: on the bench', part(LB.tablet, {}), { at: toWorld(W, mid, [colX(knee), f + h, 0.3]), rot: [0, rotOf(W) - 0.25, 0] });
      // the screen on the wall over the bench's forward half (between the sink and the shelves), live: the log
      const sx = colX(far) + (far < knee ? 1 : -1) * cw * 1.25, slope = ctx.slopeAt(W.axis, W.v, mid), yTop = slope ? slope.y0 - 0.08 : 2.0;
      ctx.put('lab: screen', part(screenPart, { w: 0.5, h: 0.3, live: 'log', seed: 0.2 }), { at: toWorld(W, mid, [sx, f + yTop - 0.22, FACE]), rot: [0, rotOf(W), 0] });
      blocks.push({ axis: W.axis, v: W.v, side: W.side, lo: W.lo, hi: W.hi, y0: 0, y1: h + 0.04 });
      blocks.push({ axis: W.axis, v: W.v, side: W.side, lo: Math.min(...[sx - 0.3, sx + 0.3].map((x) => mid + (W.axis === 'z' ? W.side : -W.side) * x)), hi: Math.max(...[sx - 0.3, sx + 0.3].map((x) => mid + (W.axis === 'z' ? W.side : -W.side) * x)), y0: yTop - 0.42, y1: yTop });
      if (stool && knee >= 0) { const P = toWorld(W, mid, [colX(knee), f, W.depth + 0.14]); ctx.put('lab: stool', part(LB.labStool, { pad: A.pad }), { at: P, rot: [0, rotOf(W) + PI, 0] }); done.add(stool.id); }
      done.add(it.id);
    } else if (it.kind === 'counter') {
      // the island
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongZ = z1 - z0 >= x1 - x0, w = alongZ ? x1 - x0 : z1 - z0, len = alongZ ? z1 - z0 : x1 - x0, ry = alongZ ? 0 : PI / 2;
      ctx.put('lab: island', part(ML.labIsland, { w: r3(w), len: r3(len), h, handle: A.handle, trim: A.trim }), { at: [r3(cx), f, r3(cz)], rot: [0, ry, 0] });
      const T = (dx, dz) => (alongZ ? [r3(cx + dx), f + h, r3(cz + dz)] : [r3(cx + dz), f + h, r3(cz - dx)]);
      ctx.put('lab: on the island', part(LB.microscope, {}), { at: T(-0.14, len * 0.28), rot: [0, ry - PI / 2 + 0.3, 0] });
      ctx.put('lab: on the island', part(ML.centrifuge, {}), { at: T(-0.15, -len * 0.25), rot: [0, ry, 0] });
      ctx.put('lab: on the island', part(ML.analyser, {}), { at: T(0.17, -len * 0.22), rot: [0, ry + PI / 2, 0] });
      ctx.put('lab: on the island', part(LB.vialRack, { seed: 5 }), { at: T(0.16, len * 0.08), rot: [0, ry + PI / 2, 0] });
      ctx.put('lab: on the island', part(ML.standScreen, { live: 'rest', seed: 0.35 }), { at: T(0.16, len * 0.36), rot: [0, ry + PI / 2 + 0.4, 0] });
      if (ctx.disc) ctx.disc(room, r3(cx), r3(cz), clinicDisc());
      // (and one over the hall's half of the room, between the island and the airlock's and washroom's doors)
      if (ctx.disc && room.rect[2] - x1 > 1.0) ctx.disc(room, r3((x1 + room.rect[2]) / 2 + 0.1), r3(cz), clinicDisc());
      done.add(it.id);
    } else if (it.kind === 'overhead' && W) {
      const mid = (W.lo + W.hi) / 2, len = W.hi - W.lo, slope = ctx.slopeAt(W.axis, W.v, mid), y1 = Math.min(+it.y + h, slope ? slope.y0 : 9);
      ctx.put('lab: shelves', part(ML.labShelves, { w: r3(len), y0: +it.y, y1: r3(y1), d: W.depth, ...clinicStrip(0.24) }), at(W, mid));
      blocks.push({ axis: W.axis, v: W.v, side: W.side, lo: W.lo, hi: W.hi, y0: +it.y - 0.05, y1 });
      done.add(it.id);
    } else if (it.kind === 'pharmacy' && W) {
      const mid = (W.lo + W.hi) / 2, len = W.hi - W.lo;
      ctx.put('lab: drugs', part(ML.drugsCabinet, { w: r3(len - 0.03), h, d: W.depth - 0.01, handle: A.handle }), at(W, mid));
      done.add(it.id);
    } else if (it.kind === 'rack' && W) {
      // (kept clear of a door's frame in its wall: the frame's 0.1 and a little more)
      let lo = W.lo, hi = W.hi;
      for (const d of bp.doors || []) {
        if (!d.rooms.includes(room.id) || d.rooms[1] === 'outside') continue;
        const c = W.axis === 'z' ? d.at[0] : d.at[1], v = W.axis === 'z' ? d.at[1] : d.at[0], e = d.width / 2 + 0.14; if (Math.abs(v - W.v) > EPS) continue;
        if (c > lo && c - e < hi && c > (lo + hi) / 2) hi = Math.min(hi, c - e); else if (c < hi && c + e > lo) lo = Math.max(lo, c + e);
      }
      const mid = (lo + hi) / 2, len = hi - lo, k = localX(W, mid, hi) > 0;
      ctx.put('lab: supplies', part(ML.suppliesRack, { w: r3(len), h, d: W.depth - 0.01, cut: k ? [0, 0.06] : [0.06, 0] }), at(W, r3(mid)));
      done.add(it.id);
    }
  }
  // (a downlight over the bench, clear of the hull's slope)
  const bench = items.find((it) => it.kind === 'counter' && wallOf(it, room));
  if (ctx.disc && bench) { const W = wallOf(bench, room); if (W.axis === 'x') { const z = stool ? (stool.rect[1] + stool.rect[3]) / 2 : (W.lo + W.hi) / 2, x = W.v + W.side * (W.depth + 0.45); ctx.disc(room, r3(x), r3(z), clinicDisc()); } }
  // (the Medic's own light, CLINIC: one more, its beam off, over the way in from the med bay, by the supplies rack)
  const rack = items.find((it) => it.kind === 'rack');
  if (ctx.disc && CLINIC.on && CLINIC.extra && rack) ctx.disc(room, r3((rack.rect[0] + rack.rect[2]) / 2), r3((rack.rect[1] + rack.rect[3]) / 2 + (rack.rect[1] - room.rect[1] < 0.3 ? 0.55 : -0.55)), clinicDisc(false));
  hangPosters(ctx, room, items, at, postersFor('science'), 'lab: posters', blocks);
  wallFields(ctx, room, items, at, { tag: 'lab: wall fields', touch: true, also: asItems(blocks) });
}
// a sink set in a worktop (a wall fitting, its middle 0.24 out from the wall, at the worktop's height y 0)
function sinkPart(p) { MC.basinTop(p, 0, 0.002, 0.27, 0.36, 0.3); return p; }
// a screen on a wall, its own screen() (live where o.live names a programme)
function screenPart(p, o) { return screen(p, { w: o.w, h: o.h, live: o.live, seed: o.seed, bezel: 0.02, depth: 0.016 }, [0, 0, 0]); }

// ── the crew room ───────────────────────────────────────────────────────────────────────────────────────────────
// The bunk room's own furnishing (cabin-furnish.js) for the stacked bunks (their heads toward the cubby), the bank of
// shallow lockers beside the door (kept clear of the door's frame) and the cupboard over the kitchen; here, the rest:
// the cubby at the bunks' head (a niche, a lamp and a little locker for each berth, on its face toward the room), the
// step along the bunks, the third bed across the stern (its foot-board at the kitchen counter), the kitchen counter
// with the coffee machine and mugs, the table against the engineering wall with its three stools and a live screen over
// it.
function furnishCrew(args) {
  const { bp, room, ctx, done, items, f, at, A } = args;
  const bunk = items.find((it) => it.kind === 'bunk'), cub = bunk && items.find((it) => it.kind === 'locker' && it !== bunk && wallOf(it, room) && +it.h >= 1.5 && touchesEnd(it, bunk));
  const bank = items.find((it) => it.kind === 'locker' && it !== cub && wallOf(it, room)?.depth <= 0.3 + EPS);
  // (what the bunk room's own furnishing gets: the bunk with its head named, the bank clipped clear of the door's frame,
  // the cubby as a box it leaves alone, so its walls' panels and posters go round it)
  const own = items.map((it) => {
    if (it === bunk && cub) return { ...it, head: (cub.rect[1] + cub.rect[3]) / 2 > (it.rect[1] + it.rect[3]) / 2 ? 'high' : 'low' };
    if (it === cub) return { ...it, kind: 'casing' };
    if (it === bank) return { ...it, kind: 'casing', rect: clipFromDoors(bp, room, it) };
    return it;
  });
  // (the grow pod's place over the kitchen counter, held as a box so no wall panel or poster takes it: GROWPOD)
  const kc = items.find((it) => it.kind === 'counter' && wallOf(it, room));
  if (kc) { const W = wallOf(kc, room), mid = (W.lo + W.hi) / 2, gs = growPodSide(room, W, mid), c = mid + (W.axis === 'z' ? W.side : -W.side) * gs * GROWPOD.along, h = GROWPOD.size / 2 + 0.02; own.push({ id: '_growpod', kind: 'casing', room: room.id, rect: W.axis === 'z' ? (W.side > 0 ? [c - h, W.v, c + h, W.v + 0.05] : [c - h, W.v - 0.05, c + h, W.v]) : (W.side > 0 ? [W.v, c - h, W.v + 0.05, c + h] : [W.v - 0.05, c - h, W.v, c + h]), y: GROWPOD.y - GROWPOD.size / 2 - 0.02, h: GROWPOD.size + 0.04 }); }
  ROOMS.bunks({ ...args, items: own });
  for (const it of items) {
    const W = wallOf(it, room), [x0, z0, x1, z1] = it.rect, h = +it.h;
    if (it === cub && W) {
      // (its face toward the room: the side of the wall the room's middle is on; the bank of lockers covers part of it)
      const mid = (W.lo + W.hi) / 2, cxr = (room.rect[0] + room.rect[2]) / 2, face = localX(W, mid, cxr) > localX(W, mid, mid) ? 1 : -1;
      const covered = bank && wallOf(bank, room)?.v === W.v ? wallOf(bank, room).depth : 0;
      ctx.put('crew: cubby', part(MC.cubby, { w: r3(W.hi - W.lo), depth: W.depth, h, face, free: [r3(FACE + covered + 0.03), r3(W.depth - 0.03)], handle: A.handle }), at(W, mid));
      done.add(it.id);
    } else if (it === bank && W) {
      // (the bank of shallow lockers, one for each of the crew, numbered 01 to 03 (the berths' numbers): three lockers
      // side by side, kept clear of the door's frame, the free end by the door cut at 45 degrees)
      const [a0, b0, a1, b1] = clipFromDoors(bp, room, it), Wc = wallOf({ ...it, rect: [a0, b0, a1, b1] }, room), lo = Wc.lo, hi = Wc.hi, n3 = 3, uw = (hi - lo) / n3, slope = ctx.slopeAt(Wc.axis, Wc.v, (lo + hi) / 2);
      const hh = Math.min(+it.h || 2.0, slope ? slope.y0 + Wc.depth - 0.02 : 2.5), door = (bp.doors || []).find((d) => d.rooms.includes(room.id) && d.rooms[1] !== 'outside' && Math.abs((Wc.axis === 'z' ? d.at[1] : d.at[0]) - Wc.v) < EPS);
      const dc = door ? (Wc.axis === 'z' ? door.at[0] : door.at[1]) : null;
      for (let k = 0; k < n3; k++) {
        const m = lo + uw * (k + 0.5), nearDoor = dc != null && (k === 0 ? Math.abs(lo - dc) : k === n3 - 1 ? Math.abs(hi - dc) : 9) < 0.8, endSide = k === 0 ? lo : hi, cut = [0, 0];
        if (nearDoor) cut[localX(Wc, m, endSide) > 0 ? 1 : 0] = 0.08;
        const num = dc != null && Math.abs(hi - dc) < Math.abs(lo - dc) ? n3 - k : k + 1;
        ctx.put('crew: lockers', part(shallowLocker, { w: r3(uw), depth: Wc.depth, h: r3(hh), cols: 1, ends: cut, nums: [num, null], handle: A.handle, trim: A.trim }), at(Wc, r3(m)));
      }
      done.add(it.id);
    } else if (it.kind === 'bed' && W) {
      const mid = (W.lo + W.hi) / 2, len = W.hi - W.lo;
      // (its head at the end away from the kitchen counter, its foot-board at the counter)
      const counter = items.find((o) => o.kind === 'counter'), cc = counter ? (W.axis === 'z' ? (counter.rect[0] + counter.rect[2]) / 2 : (counter.rect[1] + counter.rect[3]) / 2) : W.hi;
      const head = localX(W, mid, cc) > 0 ? -1 : 1;
      ctx.put('crew: bed', part(MC.singleBed, { len: r3(len), depth: W.depth, h: h || 0.6, head, bedding: A.bedding, handle: A.handle, trim: A.trim }), at(W, mid));
      done.add(it.id);
    } else if (it.kind === 'bench' && h <= 0.35 && W) {
      const mid = (W.lo + W.hi) / 2;
      ctx.put('crew: step', part(MC.bunkStep, { len: r3(W.hi - W.lo), depth: W.depth, h, handle: A.handle }), at(W, mid));
      done.add(it.id);
    } else if (it.kind === 'bench' && h <= 0.35) {
      // (a step standing free, along a bunk's front: it faces away from the bunk)
      const alongZ = z1 - z0 > x1 - x0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, toward = bunk ? (alongZ ? Math.sign(cx - (bunk.rect[0] + bunk.rect[2]) / 2) : Math.sign(cz - (bunk.rect[1] + bunk.rect[3]) / 2)) : 1;
      const len = alongZ ? z1 - z0 : x1 - x0, dep = alongZ ? x1 - x0 : z1 - z0;
      const back = alongZ ? [cx - toward * dep / 2, cz] : [cx, cz - toward * dep / 2];
      ctx.put('crew: step', part(MC.bunkStep, { len: r3(len), depth: r3(dep + FACE), h, handle: A.handle }), { at: [r3(back[0] - (alongZ ? toward * FACE : 0)), f, r3(back[1] - (alongZ ? 0 : toward * FACE))], rot: [0, alongZ ? toward * PI / 2 : (toward > 0 ? 0 : PI), 0] });
      done.add(it.id);
    } else if (it.kind === 'bench') {
      ctx.put('crew: stools', part(stool, { pad: A.pad }), { at: [r3((x0 + x1) / 2), f, r3((z0 + z1) / 2)] });
      done.add(it.id);
    } else if (it.kind === 'table') {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, th = h || 0.75;
      ctx.put('crew: table', part(messTable, { w: r3(x1 - x0), d: r3(z1 - z0), h: th, trim: A.trim }), { at: [r3(cx), f, r3(cz)] });
      ctx.put('crew: small things', part(mug, { look: A.cup }), { at: [r3(cx - 0.08), f + th, r3(cz + 0.2)], rot: [0, 1.1, 0] });
      ctx.put('crew: small things', part(mug, { look: A.cup }), { at: [r3(cx + 0.06), f + th, r3(cz - 0.25)], rot: [0, -0.5, 0] });
      // (a live screen over it, on the wall it stands against: the star chart)
      if (W) ctx.put('crew: screen', part(screenPart, { w: 0.5, h: 0.3, live: 'chart', seed: 0.55 }), { at: toWorld(W, (W.lo + W.hi) / 2, [0, f + th + 0.62, FACE]), rot: [0, rotOf(W), 0] });
      done.add(it.id);
    } else if (it.kind === 'counter' && W) {
      const mid = (W.lo + W.hi) / 2, len = W.hi - W.lo, th = h || 0.9;
      ctx.put('crew: kitchen', part(galleyRun, { len: r3(len), depth: W.depth, top: th, end: [0, 0], handle: A.handle, trim: A.trim }), at(W, mid));
      // (the coffee machine at the end away from GROWPOD's place, the sink in the middle, its tap clear of that place)
      const gs = growPodSide(room, W, mid);
      ctx.put('crew: kitchen', part(coffeeMachine, {}), { at: toWorld(W, mid, [-gs * len * 0.32, f + th, 0.2]), rot: [0, rotOf(W), 0] });
      ctx.put('crew: kitchen', part(sinkPart, {}), { at: toWorld(W, mid, [-gs * len * 0.03, f + th, 0]), rot: [0, rotOf(W), 0] });
      ctx.put('crew: small things', part(mug, { look: A.cup }), { at: toWorld(W, mid, [gs * len * 0.3, f + th, 0.36]), rot: [0, 0.7, 0] });
      ctx.put('crew: grow pod', part(growPod, { size: 0.30, y: GROWPOD.y, rings: GROWPOD.rings }), at(W, mid + (W.axis === 'z' ? W.side : -W.side) * gs * GROWPOD.along));
      done.add(it.id);
    }
  }
}
// THE GROW POD'S PLACE (the game's maker wants a grow pod, a small round window into a turning hydroponic garden, in every
// ship: kit/shipparts/cabin/growpod.js, hung here in the counter's furnishing): kept free on the wall over the kitchen
// counter, its middle `along` from the counter's middle toward the end away from the room's middle (the bed's foot is at the other end), `y` over
// the deck, a square `size`
// across of flat wall; the wall here is the crew room's stern wall, and behind it there is more than 0.35 m of free space
// (the inside-space file: free from the deck to 3.5 m for 0.45 m behind it). Nothing of the room's stands or hangs there
// (the coffee machine is at the counter's other end, the sink's tap stops 2 cm short of it).
// `rings`: the pod's rings of plants (three of the kit's four: the deepest, faint behind the frost, left out to keep the
// Medic under its triangle limit)
export const GROWPOD = { along: 0.24, y: 1.25, size: 0.45, rings: 3 };
// (which end of the counter the pod takes: +1 or -1 in the counter's own x: the end away from the room's middle across)
function growPodSide(room, W, mid) { const c = W.axis === 'z' ? (room.rect[0] + room.rect[2]) / 2 : (room.rect[1] + room.rect[3]) / 2; return localX(W, mid, c) >= localX(W, mid, mid) ? -1 : 1; }
// (whether item `a` stands at one end of item `b`, touching it)
const touchesEnd = (a, b) => (Math.abs(a.rect[1] - b.rect[3]) < 0.01 || Math.abs(a.rect[3] - b.rect[1]) < 0.01) && a.rect[0] < b.rect[2] && a.rect[2] > b.rect[0];
// an item's rect clipped clear of the frames of the room's inside doors in its wall (their opening, the frame's 0.1 and
// a little more)
function clipFromDoors(bp, room, it) {
  const W = wallOf(it, room); if (!W) return it.rect;
  let [x0, z0, x1, z1] = it.rect;
  for (const d of bp.doors || []) {
    if (!d.rooms.includes(room.id) || d.rooms[1] === 'outside') continue;
    const v = W.axis === 'z' ? d.at[1] : d.at[0], c = W.axis === 'z' ? d.at[0] : d.at[1], e = d.width / 2 + 0.14; if (Math.abs(v - W.v) > EPS) continue;
    if (W.axis === 'z') { if (c - e < x1 && c > x0) x1 = Math.min(x1, c - e); else if (c + e > x0 && c < x1) x0 = Math.max(x0, c + e); }
    else { if (c - e < z1 && c > z0) z1 = Math.min(z1, c - e); else if (c + e > z0 && c < z1) z0 = Math.max(z0, c + e); }
  }
  return [x0, z0, x1, z1].map(r3);
}

// ── engineering ─────────────────────────────────────────────────────────────────────────────────────────────────
// Engineering's own furnishing (cabin-furnish.js: the reactor, the drive and pumps, the station, the pipes, the posters),
// with the walls it leaves clear held for this (as boxes it goes round); then on them, the game's maker's busier walls
// (2026-11-09: "maybe some wiring bundles and some boxes with a bunch of switches with lights on them. I'd expect every sq
// inch of an area like that to be used in a real ship. We can try to paint the wires on with cards"): on each clear
// stretch of wall, cards of painted wiring, boxes of lit switches, gauges and conduit runs, filling it from the deck to
// the slope or the ceiling.
export const BUSY = { least: 0.4, y: [0.25, 2.05] };
function furnishEng(args) {
  const { bp, room, ctx, at, items } = args;
  // the walls' clear stretches before the room's own furnishing: what no plan item stands against, from deck to top
  const walls = roomWallsOf(room).map((W) => ({ W, free: clearAlong(ctx, room, items, W) })), held = [];
  for (const { W, free } of walls) for (const [a, b] of free) if (b - a >= BUSY.least) held.push({ W, a, b, it: { id: '_busy' + held.length, kind: 'casing', room: room.id, rect: rectOn(W, a, b, 0.22), h: 2.2 } });
  ROOMS.engineering({ ...args, items: [...items, ...held.map((H) => H.it)] });
  // (each held stretch, busy: from its ends in, a conduit up each end; along the top a wiring card; a row of switch
  // boxes at the middle height; gauges between; a low wiring card near the deck)
  let k = 0;
  for (const { W, a, b } of held) {
    const len = b - a, mid = (a + b) / 2, slope = ctx.slopeAt(W.axis, W.v, mid), top = Math.min(BUSY.y[1], slope ? slope.y0 - 0.05 : 2.2), seed = (k++ * 0.37) % 1;
    ctx.put('engineering: busy walls', part(busyWall, { len: r3(len), top: r3(top), seed: r3(seed), tag: ['BUS A', 'BUS B', 'BUS C', 'O2 LOOP'][k % 4], label: ['PUMPS', 'MAIN', 'LIFE SUP', 'SPARE'][k % 4] }), at(W, r3(mid)));
  }
}
const roomWallsOf = (room) => { const [X0, Z0, X1, Z1] = room.rect; return [{ axis: 'x', v: X0, side: 1, lo: Z0, hi: Z1 }, { axis: 'x', v: X1, side: -1, lo: Z0, hi: Z1 }, { axis: 'z', v: Z0, side: 1, lo: X0, hi: X1 }, { axis: 'z', v: Z1, side: -1, lo: X0, hi: X1 }]; };
const rectOn = (W, a, b, d) => (W.axis === 'x' ? (W.side > 0 ? [W.v, a, W.v + d, b] : [W.v - d, a, W.v, b]) : (W.side > 0 ? [a, W.v, b, W.v + d] : [a, W.v - d, b, W.v])).map(r3);
// the stretches of wall W no plan item stands against or hangs on, and clear of its doorways and their frames' panels
function clearAlong(ctx, room, items, W) {
  const touch = (it) => { const [x0, z0, x1, z1] = it.rect; return W.axis === 'x' ? Math.abs((W.side > 0 ? x0 : x1) - W.v) < 0.3 && z1 > W.lo + EPS && z0 < W.hi - EPS : Math.abs((W.side > 0 ? z0 : z1) - W.v) < 0.3 && x1 > W.lo + EPS && x0 < W.hi - EPS; };
  const cut = [...ctx.openings(W.axis, W.v), ...items.filter(touch).map((it) => (W.axis === 'x' ? [it.rect[1], it.rect[3]] : [it.rect[0], it.rect[2]]))];
  let free = [[W.lo + FACE + 0.04, W.hi - FACE - 0.04]];
  for (const [p, q] of cut) free = free.flatMap(([u, v]) => (q <= u || p >= v ? [[u, v]] : [[u, p - 0.04], [q + 0.04, v]]));
  return free.filter(([u, v]) => v - u > 0.1);
}
// a stretch of busy engineering wall, len along it, from the deck to `top` (a wall fitting)
function busyWall(p, o) {
  const L = o.len, top = o.top, hw = L / 2 - 0.03, s = o.seed;
  MC.conduit(p, { a: [-hw + 0.03, 0.1], b: [-hw + 0.03, top], r: 0.022 });
  MC.conduit(p, { a: [hw - 0.03, 0.1], b: [hw - 0.03, top], r: 0.018, look: 'yellow' });
  const x0 = -hw + 0.08, x1 = hw - 0.07, w = x1 - x0;
  MC.wireCard(p, { x: (x0 + x1) / 2, y0: top - 0.32, w, h: 0.28, n: 7, seed: s + 0.1, tag: o.tag });
  // (switch boxes across the middle, as many as fit at 0.36 each; gauges in the row over them)
  const nb = Math.max(1, Math.floor(w / 0.38)), bw = w / nb;
  for (let i = 0; i < nb; i++) MC.switchBox(p, { x: x0 + bw * (i + 0.5), y0: 1.12, w: bw - 0.04, h: 0.32, rows: 2, cols: Math.max(3, Math.round((bw - 0.1) / 0.055)), seed: s + i * 0.13, label: i === 0 ? o.label : null });
  const ng = Math.max(1, Math.min(3, Math.floor(w / 0.3)));
  for (let i = 0; i < ng; i++) MC.gauge(p, { x: x0 + w * (i + 0.5) / ng, y: 1.6, r: 0.065, a: (s * 7 + i * 0.31) % 0.85 + 0.05 });
  MC.wireCard(p, { x: (x0 + x1) / 2, y0: 0.62, w, h: 0.36, n: 9, seed: s + 0.5 });
  MC.switchBox(p, { x: (x0 + x1) / 2, y0: 0.18, w: Math.min(w, 0.9), h: 0.34, rows: 2, cols: Math.max(4, Math.round(Math.min(w, 0.9) / 0.065)), seed: s + 0.9 });
  return p;
}

// ── the washroom ────────────────────────────────────────────────────────────────────────────────────────────────
// The Explorer's washroom furnishing for the toilet (its box shortened so it draws the toilet alone), and the plan's own
// basin (a counter item) as a small shallow cabinet with the basin in its top and a live mirror-screen over it (the
// washroom's programme: its water tanks).
function furnishWash(args) {
  const { room, ctx, done, items, at, A } = args, basin = items.find((it) => it.kind === 'counter' && wallOf(it, room));
  const own = items.map((it) => {
    if (it === basin) return { ...it, kind: 'casing', h: 1.75 };
    if (it.kind === 'toilet' && basin) { const W = wallOf(it, room); if (!W || W.hi - W.lo < 0.65) return it; const [x0, z0, x1, z1] = it.rect, R = room.rect, atLo = Math.abs(W.lo - (W.axis === 'x' ? R[1] : R[0])) < EPS; return { ...it, rect: W.axis === 'x' ? (atLo ? [x0, z0, x1, z0 + 0.6] : [x0, z1 - 0.6, x1, z1]) : (atLo ? [x0, z0, x0 + 0.6, z1] : [x1 - 0.6, z0, x1, z1]) }; }
    return it;
  });
  ROOMS.washroom({ ...args, items: own });
  if (basin) {
    const W = wallOf(basin, room), mid = (W.lo + W.hi) / 2, len = W.hi - W.lo;
    ctx.put('wash: basin', part(MC.vanity, { w: r3(len - 0.04), depth: r3(Math.min(0.38, W.depth)), h: 0.85, handle: A.handle }), at(W, mid));
    ctx.put('wash: basin', part(screenPart, { w: r3(Math.min(0.36, len - 0.1)), h: 0.26, live: 'water', seed: 0.4 }), { at: toWorld(W, mid, [0, args.f + 1.42, FACE]), rot: [0, rotOf(W), 0] });
    done.add(basin.id);
  }
}

MORE['medic-built:medbay'] = furnishMedBay;
MORE['medic-built:washroom'] = furnishWash;
MORE['medic-built:lab'] = furnishLab;
MORE['medic-built:bunks'] = furnishCrew;
MORE['medic-built:engineering'] = furnishEng;
