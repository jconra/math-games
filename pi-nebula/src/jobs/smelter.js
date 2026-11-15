// THE SMELTER'S CONTROL ROOM: what a load of ore pays (weights, yields, credits). COMING SOON: its props (the furnace
// and the crusher line, the ceiling crane, the ore canisters and the wall sockets) are picked by the game's maker from
// option sheets first (STATION_buildout.md section 10), so only its spot is marked today.
//
// TO FILL IT IN (see ~/pw/space-math/JOBS.md, "Adding a job"): give it a SETTING (the smelter's world for Mathwood's
// makers, as galley.js and medical.js do), MAKERS of its own where Mathwood has none (a load's yield: 8 canisters of
// 1.2 t at 35% iron), a PLACE (its ladder, easiest first), a `card` for its scene (a pay slip at the console), then set
// open: true. The panel, the levels, the help and the credits come with the job system (engine.js, panel.js).
export const PLACE = null;
export const JOB = {
  id: 'smelter', name: 'The smelter\'s control room', short: 'Smelter', open: false,
  spot: { place: 'smelterConsole' },
  sign: 'Smelter pay desk', hint: 'What a load of ore pays: coming soon',
  place: PLACE, setting: null, makers: null, card: 'payslip',
};
