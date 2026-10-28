# Working on Mathwood Valley's town

## Placing, moving or growing a building

Whenever a building is placed, moved, made bigger or given a new design (models/town/decor.json, the Town Lab,
labs/buildings), check the ground it now covers before calling the work done:

- Nothing the town already has may be left inside it, in its walls or in front of its doors: hand-placed plants
  (decor.json `planting.items`, trees and rocks included) and props (decor.json `placed`, the layout's props: crates,
  barrels, rails, troughs, wagons). Move each out of the way, keeping the look it had; remove it only when there's no
  sensible spot nearby.
- Run the check: `node ~/pw/bandit-math/rigs/town/clearcheck.cjs` (needs the shared server on 8997). It lists
  everything inside a building, in a wall or in front of a door, and exits 1 until the town is clear.
- Where things go back:
  - Grass tufts sit ON the line where the grass meets the dirt, not out on the dirt. Find the line you can see,
    not the footpath picture's: the ground shader's noise moves it up to half a metre.
  - Flowers go round a building's edges, a little at random (busy homesteaders planted them), never in front of a door.
- Write decor.json with labs/town/decorfile.js `decorText` (one line a thing), so it reads and diffs cleanly.
- If footpath strokes changed, re-bake the land: `node ~/pw/bandit-math/rigs/bakeland.cjs`.
