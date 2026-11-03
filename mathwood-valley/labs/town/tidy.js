// THE TOWN LAB'S SAVE TIDY-UP (the game's maker, 2026-10-30: "It just kind of bugs me if I know there is a bunch of useless
// lines in there like removing a fence and redrawing it"): before decor.json is written, the brush strokes that do nothing
// are left out: a stroke whose whole effect was later erased, and an erase stroke with nothing left to remove. A stroke goes
// only if the town comes out the same without it, checked by working the town out both ways with the game's own code:
//   fences and gates   what stands of each (world/objects/fenceplan.js planFences, plainLines): posts, pieces, gates, looks
//   plants, lawn, trees, rocks   every painted plant under the stroke (planting.js paintedPlants), in each part as the valley
//                      lays it (world/objects/plantviews.js), and whether what grows by itself may grow, on a fine grid
//                      (keepProcedural)
// Left alone: the shipped strokes (taking one out would only add a line to `removed`) and the footpaths (their strokes key
// the land's bake, models/town/land, and the walkers read them; a footpath changed means a new bake).
//   tidyStrokes(planting, { PLANT, keep }) -> { strokes (the ones to save, the same objects, in order), dropped: [stroke] }
//     keep: the ids of the strokes never to touch (the shipped ones)
import { paintedPlants, keepProcedural, inStroke, strokeBounds } from '../../world/objects/planting.js';
import { planFences, plainLines } from '../../world/objects/fenceplan.js';
import { plantSorts, wildView, paintedView } from '../../world/objects/plantviews.js';

const GRID = 0.25, MOST_SPOTS = 150000;   // (m between the spots looked at under a stroke; a very wide stroke's grid made coarser to keep to this many)
const r3 = (v) => Math.round(v * 1000) / 1000;
const line = (pts) => pts.map((p) => [r3(p[0]), r3(p[1])]);

// what stands of all the town's fences, in words that don't depend on a stroke's place in the list
export function fencesStanding(strokes, PLANT) {
  const opts = { fence: PLANT.FENCE, gate: PLANT.GATE, inStroke }, plan = planFences(strokes, opts);
  const styled = plan.runs.filter((R) => R.style && R.pieces.length).map((R) => [R.style, R.size, R.stroke.seed, R.pieces.map((p) => [line(p.pts), !!p.gateA, !!p.gateB])]);
  const plain = plainLines(strokes, plan, opts).filter((L) => L.kept.some(Boolean)).map((L) => [L.h, L.kept.map((p) => (p ? [r3(p[0]), r3(p[1])] : 0)), !!L.part.gateA, !!L.part.gateB]);
  const gates = plan.gates.map((G) => [G.kind, line([G.A, G.B]), r3(G.w)]);
  return JSON.stringify({ styled, plain, gates });
}

// the plants under a stroke's box, in every part, and whether what grows by itself may grow on a grid over it
function plantsUnder(P, box, PLANT, SORT) {
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2, radius = Math.hypot(box.x1 - cx, box.z1 - cz) + 1, parts = [(k) => k < PLANT.LAWN_KIND, (k) => k === PLANT.LAWN_KIND, SORT.tree, SORT.rock], out = [];
  for (const want of parts) {
    const list = paintedPlants(paintedView(P, want, SORT), null, { at: { x: cx, z: cz }, radius }).filter((q) => q.x >= box.x0 && q.x <= box.x1 && q.z >= box.z0 && q.z <= box.z1);
    out.push(list.map((q) => `${q.sp},${r3(q.x)},${r3(q.z)},${r3(q.scale)},${r3(q.yaw)}`).sort().join(';'));
  }
  const w = box.x1 - box.x0, d = box.z1 - box.z0, step = Math.max(GRID, Math.sqrt((w * d) / MOST_SPOTS));
  for (const sort of ['plant', 'tree', 'rock']) {
    const V = wildView(P, sort, SORT); let bits = '';
    for (let z = box.z0; z <= box.z1; z += step) for (let x = box.x0; x <= box.x1; x += step) bits += keepProcedural(V, null, x, z) ? '1' : '0';
    out.push(bits);
  }
  return out.join('|');
}

export function tidyStrokes(planting, { PLANT, keep = new Set() }) {
  const SORT = plantSorts(PLANT), dropped = [];
  let strokes = planting.strokes;
  const canGo = (st) => !keep.has(st.id) && !SORT.path(st.kind);
  const without = (st) => strokes.filter((s) => s !== st);
  // (over again from the end until nothing more goes: a fence taken out can leave the erase stroke over it with nothing to do)
  for (let again = true; again;) {
    again = false;
    for (let i = strokes.length - 1; i >= 0; i--) {
      const st = strokes[i]; if (!canGo(st)) continue;
      const rest = without(st);
      let same;
      if (SORT.fence(st.kind)) same = fencesStanding(strokes, PLANT) === fencesStanding(rest, PLANT);
      else {
        const box = strokeBounds(st);
        same = !box || plantsUnder({ ...planting, strokes }, box, PLANT, SORT) === plantsUnder({ ...planting, strokes: rest }, box, PLANT, SORT);
      }
      if (same) { strokes = rest; dropped.push(st); again = true; }
    }
  }
  return { strokes, dropped };
}
