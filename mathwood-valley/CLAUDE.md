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
  - Trees stand far enough off that their crowns clear the roof (clearcheck warns: a hand-placed ash once hung its
    leaves inside the blacksmith's).
- Write decor.json with labs/town/decorfile.js `decorText` (one line a thing), so it reads and diffs cleanly.
- If footpath strokes changed, re-bake the land: `node ~/pw/bandit-math/rigs/bakeland.cjs`.

## Buildings on the land

The game's maker doesn't like the land levelled under buildings: "It seems more realistic to have foundations and stairs
that go deep in the ground and the ground level is natural. The building should be lowered as much as it can without
the ground coming up." So a building sits as low as it can without the ground coming through its floor, its foundation
and its steps reach down to the ground however deep the slope needs, and new buildings don't level the ground.

## Keep the labs in step with the game

The game's maker: "it would be nice to update the labs as we update the games. I think the labs for this project are fantastic."
He shows them to people, so a lab showing last week's version looks like a bug.

- When you change something a lab shows, bring that lab up to date in the same piece of work. Check it loads clean and
  shows the new version, and bump its `index.html` `?v=` so phones get it.
- Share one piece of code. The game already builds from the labs' code: the building recipes, stone, materials, the
  windmill tower, the bridge, the fishing scene. Labs drift when the game builds something better on top of a lab's
  piece and the lab keeps its own copy. That's how the Building Lab's stalls kept the old horses: the game's stable used
  `makeHorse` while the lab had its own table and `makeAnimal`. A lab imports the game's code, never a copy of a table
  or a recipe.
- Which lab shows what:
  - **Building Lab** (labs/buildings): the code-built buildings, their doors and insides, the stable's horses.
  - **Town Lab** (labs/town): the town's layout and decor.json (plants, props, fences, footpaths).
  - **Horse Lab** (labs/horse): horse coats, manes and the new horse.
  - **Dog Lab** (labs/dogs): the dog breeds (src/actors/dogbreeds.js, morph.js, dogcoat.js, dogkind.js; saved to
    models/animals/dogbreeds.json), reshaped from the game's dogs, and the dogs as the game has them.
  - **Material Lab** and **Stone Lab**: the wood, weather and stone the buildings wear.
  - **Windmill Tower Lab**, **Bridge Lab** and **Fishing Lab**: those places and their questions.
  - **Practice**: the math levels and lockboxes.
  - **Props Lab** (planned, ~/pw/bandit-math/PROPS.md): the props.
- If a new part of the game has no lab, say so in its plan file. Whether it gets one is the game maker's call.

## Help is asked for, never pushed

The game's maker (2026-10-29), after a ten-frame helper opened by itself in the middle of the sheep job, for another
sheep, with no way to close it: "I'm not really a fan of things just showing up in the middle of my screen uninvited."
The old rule ("every topic gets a helper that pops up when the kid is stuck") is replaced by: **a helper is always one
click away, and never pops up uninvited.**

- Every job with questions has a helper the rider can open: the tools strip's **Help** (key Q, shown in a tab on the
  button's corner), the job's own Help or "Show me". It shows the help for the question the rider is on (the sheep being dosed or
  ringed, the nearest pig, the card up), not some other one.
- Stuck a while, or just wrong, a job may only nudge: `nudgeHelp()` in src/ui/askhelp.js makes the Help buttons glow
  (any button marked `data-askhelp`). A one-line "why" under the card after a wrong pick is fine; a panel is not. A
  small offer button (the times chart's "Peek") is fine; the chart itself opens only when pressed.
  (One exception kept for now, an open question for the game's maker: the range's and the deer camera's card saying why
  the bottle just shot or the deer just photographed was wrong comes up beside the view as that answer's feedback, with
  an X.)
- Every helper that opens has a visible X, and Esc closes it (the HUD's help box adds the X itself: src/ui/hud.js).
- Moving the level by hand (the tools strip's arrows) re-deals the questions out at that place straight away, at the new
  level (main.js `relevel` calls the job's `relevel()`); what was already answered or healed stays.
