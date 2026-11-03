// WHICH STROKES EACH PART OF THE PLANTING HEEDS, with no three.js (so the Town Lab's save tidy-up and the node tests read the
// very rules the valley lays by: world/valley.js plantingFor, paintedOnly). The strokes are one list, but a fence's Clear
// takes down fences only, a rock's Clear rocks only, and each kind of plant is worked out from its own paint strokes.
//   plantSorts(PLANT) -> { plant, tree, rock, path, fence }   does this kind belong to that sort? (PLANT: the valley's kind numbers)
//   wildView(planting, sort, SORT)   what the plants, trees or rocks that grow by themselves heed (keepProcedural)
//   paintedView(planting, want, SORT)   what the painted plants of the kinds wanted are worked out from (paintedPlants): its
//                                    paint strokes, the others kept in their places with no thickness, as a clear stroke rubs
//                                    out only what was painted before it
export const plantSorts = (PLANT) => ({
  plant: (k) => k <= PLANT.LAWN_KIND,
  tree: (k) => (k >= PLANT.TREE0 && k < PLANT.ROCK0) || k === PLANT.APPLE,
  rock: (k) => (k >= PLANT.ROCK0 && k < PLANT.ROCK0 + 4) || k === PLANT.ROCKS,
  path: (k) => k === PLANT.PATH || k === PLANT.NOPATH,
  fence: (k) => k === PLANT.FENCE || k === PLANT.GATE,
});
// (a placed plant's clear circle keeps the meadow back, not the trees: trees and rocks heed only their own sort's. Clear with
// a fence chosen takes down fences only; with a rock chosen, rocks only)
export const wildView = (P, sort, SORT) => ({ ...P, procedural: sort === 'plant' ? P.procedural : true,
  strokes: P.strokes.filter((st) => (st.mode === 'clear' && !SORT.fence(st.kind) && (sort === 'rock' || !SORT.rock(st.kind))) || SORT[sort](st.kind)),
  items: sort === 'plant' ? P.items : P.items.filter((i) => SORT[sort](i.kind)) });
export const paintedView = (P, want, SORT) => ({ ...P,
  strokes: P.strokes.filter((s) => !(s.mode === 'clear' && (SORT.fence(s.kind) || (SORT.rock(s.kind) && !want(s.kind))))).map((s) => (s.mode !== 'clear' && !want(s.kind) ? { ...s, density: 0 } : s)) });
