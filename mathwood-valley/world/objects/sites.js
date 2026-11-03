// WHERE THE GAME'S OWN PLACES STAND (no three.js, so anything can read them, the tests too): the places that aren't in the
// town's layout. Their jobs build there (src/range.js, src/fishingjob.js, src/camps.js, src/world.js) and the sign posts'
// boards point there (world/objects/signplaces.js): move one here and both follow.
export const SITES = {
  range: { x: 60, z: -193 },         // the bottle range's firing line
  dock: { x: -4.4, z: -95.3 },       // the fishing dock's shore end, where the town's dirt path meets the lake
  cowCamp: { x: -184, z: -176 },     // The Bar T cow camp
  hollisCamp: { x: 256, z: -192 },   // The Hollis family camp
  surveyCamp: { x: 56, z: -304 },    // The surveyors' camp
  farm: { x: -6, z: -278 },          // the settlers' farm (the layout's game.farm can move it)
};
