// THE LANDING GEAR FOLDS BY ITSELF (the game's maker, 2026-11-26, of the trailer: "I'd just build it so that it is
// automatically lowered when you go in the hanger or near the surface of a planet, and up otherwise"). src/flymodel.js
// GEAR, gearWanted, gearOverGround; src/shiphull.js gear.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/flymodel.js';
import { flightOf } from '../src/fleet.js';
import { HANGARS, DOOR } from '../kit/outside-plan.js';

const at = (cfg, p, v = [0, 0, 0]) => { const S = M.makeShip(cfg); M.place(S, p, M.facing([1, 0, 0])); S.v = [...v]; return S; };

test('gear: down in a hangar (any of the three) and coming in to one, up out in space and going out', () => {
  const S0 = M.makeShip(M.MINER);
  assert.equal(M.gearWanted(S0), false, 'parked on its pad: down');
  for (const H of HANGARS) {
    assert.equal(M.gearWanted(at(M.MINER, [45, 2.6, H.z])), false, H.id + ': in the bay, down');
    assert.equal(M.gearWanted(at(M.MINER, [DOOR.face - 0.1, 2.6, H.z + 6], [8, 0, 0])), false, H.id + ': still inside the door\'s line, down');
    assert.equal(M.gearWanted(at(M.MINER, [DOOR.face + 0.5, 2.6, H.z], [8, 0, 0])), true, H.id + ': just out through the door, going out: up');
    assert.equal(M.gearWanted(at(M.MINER, [DOOR.face + 20, 3, H.z], [-10, 0, 0])), false, H.id + ': 20 m out, closing on the door: down');
    assert.equal(M.gearWanted(at(M.MINER, [DOOR.face + 20, 3, H.z], [0.2, 0, 0])), true, H.id + ': 20 m out, hanging there: up');
    assert.equal(M.gearWanted(at(M.MINER, [DOOR.face + M.GEAR.lead + 5, 3, H.z], [-30, 0, 0])), true, H.id + ': further out than the lead: up');
    assert.equal(M.gearWanted(at(M.MINER, [DOOR.face + 10, DOOR.h + M.GEAR.over + 2, H.z], [-10, 0, 0])), true, H.id + ': over the door\'s top: up');
  }
  assert.equal(M.gearWanted(at(M.MINER, [DOOR.face + 10, 3, (HANGARS[0].z + HANGARS[1].z) / 2], [-10, 0, 0])), true, 'between two doors: up');
  assert.equal(M.gearWanted(at(M.MINER, [300, 9, -5])), true, 'out of its jump home: up');
});

test('gear: over a planet, down near the ground and up above it, never fluttering at one height', () => {
  assert.equal(M.gearOverGround(140, false), true, 'high over it: up');
  assert.equal(M.gearOverGround(M.GEAR.near - 1, true), false, 'coming down under `near`: down');
  assert.equal(M.gearOverGround(M.GEAR.near + 1, true), true, 'over `near` coming down: still up');
  assert.equal(M.gearOverGround(M.GEAR.near + 2, false), false, 'lifting, between `near` and `clear`: still down');
  assert.equal(M.gearOverGround(M.GEAR.clear + 1, false), true, 'lifting over `clear`: up');
  assert.ok(M.GEAR.clear > M.GEAR.near);
  // (the autopilot holds the Medic 26 m over its landing place before it comes down: its legs up there)
  assert.ok(M.GEAR.near < 26, 'up while it hovers over the landing place');
});

test('gear: a ship is never down on a floor until its legs are fully down, however it got there', () => {
  for (const cfg of ['miner', 'explorer', 'medic'].map(flightOf)) {
    const S = at(cfg, [cfg.pad[0], cfg.pad[1] + 0.02, cfg.pad[2]]);
    S.gearDown = false;
    for (let i = 0; i < 240; i++) M.stepShip(S, M.noControls(), 1 / 60);
    assert.equal(S.landed, false, cfg.id + ': on its feet\'s line with its legs still coming: not down');
    assert.ok(Math.abs(S.p[1] - cfg.pad[1]) < 0.05, cfg.id + ': resting on its feet\'s line, not sinking');
    S.gearDown = true;
    for (let i = 0; i < 60 && !S.landed; i++) M.stepShip(S, M.noControls(), 1 / 60);
    assert.equal(S.landed, true, cfg.id + ': legs down: down');
  }
});

