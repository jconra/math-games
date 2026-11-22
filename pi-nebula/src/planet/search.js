// FINDING THE WRECK ON ARRIVAL: the sensors' card (src/jobs/sensors.js), the ship put where the card says it is, and the
// way there lit once it is answered (src/planet/guide.js). The game's maker, 2026-11-22 (RESC1-3): "We could do a math
// question with coordinates when you first start that shows you relative to the target, so it is representing you
// finding the target with sensors, and then you travel to it."
//
// THE ORDER OF IT: out of the jump the ship is over the planet, the card comes up (the job panel, dark, as the jump
// computer's), and the ship is where the card's grid has it: the wreck so many squares across to its right and ahead of
// its nose, each square SQUARE metres of the ground, the ship a little way up and level. A card dealt again (the level's
// arrows) puts it where the new card says. Answered right, the card goes by itself a moment later (no button to press),
// the beam rises from the wreck, the arrow comes up over the view and the radar's dot shows: then the ship flies there.
// Put away unanswered (Done), the way stays dark and the sensors can be asked again.
//
//   const S = makeSearch({ scene, ground, land, wreck, pods, cfg, place, bounds, root })
//     wreck    { x, y, z } where it lies (src/planet/wreckship.js site); pods: [x, z] their middle, or none
//     cfg      the ship's flight facts (src/fleet.js flightOf): its blue goal on the landing place
//     place(at, look)   the ship put there, looking there (the lab's camera)
//   S.start({ ahead })  the card up, the ship put where it says (ahead: the way the ship's nose points, [x, z])
//   S.update(camera, dt, { ahead })    each frame
//   S.guide (src/planet/guide.js), S.panel (the card, while it is up), S.found, S.state(), S.dispose()
import { openPanel } from '../jobs/panel.js';
import { JOB as SENSORS, sensorsHead, labPilot } from '../jobs/sensors.js';
import { guideColour } from './guideplan.js';
import { makeWreckGuide } from './guide.js';

// the ship as it comes out over the planet: how high over the ground under it and the ground on the way ahead (m), how
// far its view looks down (radians); how long the card stays after a right answer (s)
export const ARRIVE = { up: 45, down: 0.12, close: 1.1 };

export function makeSearch({ scene, ground, land, wreck, pods = null, cfg = null, place, bounds = null, root = document.body, crew = null }) {
  const colour = guideColour(land.palette);
  const guide = makeWreckGuide({ scene, ground, colour, at: [wreck.x, wreck.y, wreck.z], root, bounds });
  if (cfg) guide.goal({ cfg, landing: land.landing, toward: pods });
  const pilot = crew || labPilot();
  let panel = null, found = false, ahead = [0, -1], facts = null, closing = 0, closed = false;
  // the ship where the card's grid has it: the wreck x squares to its right and y ahead of it
  function put(f) {
    if (!f) return;
    facts = { ...f };
    const l = Math.hypot(ahead[0], ahead[1]) || 1, fx = ahead[0] / l, fz = ahead[1] / l, rx = -fz, rz = fx;
    const x = wreck.x - (rx * f.x + fx * f.y) * f.unit, z = wreck.z - (rz * f.x + fz * f.y) * f.unit;
    // (over the highest ground under it and on the way ahead to the wreck: nothing in the way of the first look)
    let top = land.heightAt(x, z);
    for (let k = 1; k <= 8; k++) top = Math.max(top, land.heightAt(x + (wreck.x - x) * k / 10, z + (wreck.z - z) * k / 10));
    const y = top + ARRIVE.up, d = 200;
    place([x, y, z], [x + fx * d, y - Math.tan(ARRIVE.down) * d, z + fz * d]);
  }
  const live = {
    // (the card's top, as the jump computer's; and each card dealt puts the ship where it says)
    head: (o) => { if (o && o.facts && (!facts || o.facts.x !== facts.x || o.facts.y !== facts.y || o.facts.unit !== facts.unit)) put(o.facts); return sensorsHead(); },
    right() {
      found = true; guide.light(true);
      // (the card goes by itself, a moment after the right answer has shown green, before the next would slide in)
      clearTimeout(closing); closing = setTimeout(() => { if (panel) panel.close(); }, ARRIVE.close * 1000);
    },
  };
  return {
    guide, colour,
    get found() { return found; }, get panel() { return panel; }, get facts() { return facts; },
    start({ ahead: a = null } = {}) {
      if (closed || panel) return panel;
      if (a && Math.hypot(a[0], a[1]) > 1e-4) ahead = [a[0], a[1]];
      found = false; guide.show(false); facts = null;
      panel = openPanel(root, { job: SENSORS, crew: pilot.crew, live, pay: false, onSave: () => pilot.save(), onClose: () => { panel = null; clearTimeout(closing); } });
      return panel;
    },
    // (the rigs: the way lit at once, as a right answer lights it)
    light(on = true) { found = !!on; guide.light(found); },
    update(camera, dt, opts = {}) { if (!closed) guide.update(camera, dt, opts); },
    state: () => ({ found, card: panel ? panel.state() : null, facts, ...guide.state() }),
    dispose() { closed = true; clearTimeout(closing); if (panel) { const p = panel; panel = null; p.close(); } guide.dispose(); },
  };
}
