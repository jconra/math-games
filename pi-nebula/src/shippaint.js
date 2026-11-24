// THE SHIPS' PAINT IN THE GAME: each ship drawn in the paint the crew member playing picked for it, if it is theirs
// (src/paint.js: whose it is to pick and how it is kept; kit/ships/paints.js: the paints and how one is laid).
//
// THE GAME'S MAKER, asked what he would want to change on a ship that is his (2026-11-23): "Its colour: pick the paint
// of its hull."
//
// ONE SHIP, ONE PAINT, WHEREVER IT IS DRAWN. A ship in the game is drawn from one set of corners wherever it is: parked
// in its hangar, flown out of it and round the station, out at the rocks or over a planet, on a run of the crew member's
// own or on its captain's contract, seen from the station's windows (the three in the hangars: their rooms of the
// station, moved whole by whoever flies them, src/shiphull.js; the Hauler: its own two builds at the dock, with and
// without the rooms inside, src/haulerdock.js). So the paint is laid on those corners once and is then everywhere the
// ship is. It is laid for the crew member playing: when another crew member starts, the ships are in that one's paints
// (their own for a ship that is theirs, the ship's own for any other). The station's saved light is untouched (the
// corners' places do not change), and nothing of a ship's rooms inside is paint.
//
// WHAT IT COSTS: a repaint writes the new colour over the old in the lists the ship is already drawn from (about a
// thousand corners) and sends those lists to the graphics card once. No picture, no material, no mesh and no draw is
// added; a frame in which nothing changed costs four comparisons.
//
// THE SHIP SHOWN WHILE ITS PAINT IS PICKED (view): the owner's card is brought up at the pilot's seat, where nothing of
// the hull is seen, so while the paint card is up the camera stands outside the ship, off its bow, looking back at it:
// in its hangar (kept inside the hangar's walls, wherever the ship was set down), or out past the Hauler at the dock.
// The crew member has not moved: Done, and they are at the seat again.
//
//   const S = makeShipPaint({ W, crew, save, boarding, hauler })
//   S.card(ship)      the owner's card's `own.paint` (src/contract.js, src/paintcard.js): { list(), pick(id), view(on) }
//   S.pick(ship, id)  the crew member's paint for a ship that is theirs: laid and saved at once -> { ok, paint | why }
//   S.aim(camera)     once a frame, last: the camera outside the ship while its paint card is up (true while it is)
//   S.on(ship)        the paint laid on a ship now;   S.viewing: the ship whose paint card is up, or null
//   S.modelColour(ship, own)  the small model's colour in the landing guide (src/flying.js): the paint, kept light
//                     enough to read on the guide's dark glass; `own` (the model's own colour) for a ship in its own paint
import * as THREE from 'three';
import { paintBuilt, FACTORY, hullColour, lin, hexOf } from '../kit/ships/paints.js';
import { paintOf, setPaint, swatchesOf } from './paint.js';

// the ships parked in the station's hangars, each a room of the station file ('ship-' + id)
const PARKED = ['miner', 'explorer', 'medic'];
// THE VIEW OF A SHIP WHILE ITS PAINT IS PICKED, in the ship's own frame (x to port, y up from the floor it stands on (the
// Hauler: from its ground line), z to its nose; metres): the eye and where it looks, on a wide screen and on one held
// upright (`tall`: further off, higher and more from ahead, the narrow picture has less room across; it looks lower,
// so the ship stands above the card along the bottom). keep: how far inside its hangar's walls the eye stays (the bay
// door's shield is a wall of blue light: well inside it), and how high.
export const VIEW = {
  miner: { eye: [-11.5, 3.4, 12], look: [0, 0.6, 0.6], fov: 48, tall: { eye: [-9, 5.5, 15], look: [0, -0.8, 2], fov: 70 } },
  explorer: { eye: [-12, 3.6, 12.5], look: [0, 0.8, -0.4], fov: 48, tall: { eye: [-9, 5.5, 15.5], look: [0, -0.8, 1], fov: 70 } },
  medic: { eye: [-12, 3.6, 12.5], look: [0, 0.8, -0.2], fov: 48, tall: { eye: [-9, 5.5, 15.5], look: [0, -0.8, 1], fov: 70 } },
  hauler: { eye: [-13, 6.2, 15.5], look: [0, 1.6, 0.8], fov: 46, tall: { eye: [-10, 7.5, 20], look: [0, -1.6, 1.5], fov: 70 } },
  keep: { wall: 2.6, top: 7.5, floor: 1.2 },
};
// how light the landing guide's small model is kept (the brightest of its red, green and blue, 0 to 1, as shown), and
// how much white is mixed into the paint first
const MODEL = { mix: 0.3, light: 0.88 };

export function makeShipPaint({ W, crew, save = () => {}, boarding = null, hauler = () => null }) {
  const laid = Object.fromEntries(PARKED.map((id) => [id, FACTORY])), onBuild = new WeakMap();
  let lastCrew, lastPaints, lastShips, lastBuilds = -1, viewing = null;
  // EACH SHIP IN THE PAINT IT HAS FOR THE CREW MEMBER PLAYING: looked at once a frame, laid only when the crew member, their
  // ships, their paints or the Hauler's builds have changed
  function lay(force = false) {
    const c = crew() || null, H = hauler(), builds = H && H.builds ? H.builds() : [];
    if (!force && c === lastCrew && (c && c.paints) === lastPaints && (c && c.ships) === lastShips && builds.length === lastBuilds) return;
    lastCrew = c; lastPaints = c && c.paints; lastShips = c && c.ships; lastBuilds = builds.length;
    for (const id of PARKED) { const want = paintOf(c, id); if (laid[id] !== want) { paintBuilt(W.built, id, want, { zones: ['ship-' + id] }); laid[id] = want; } }
    const want = paintOf(c, 'hauler');
    for (const B of builds) if ((onBuild.get(B) || FACTORY) !== want) { paintBuilt(B, 'hauler', want); onBuild.set(B, want); }
  }
  const after = () => lay(false);
  W.after.add(after);
  function pick(ship, id) {
    const c = crew(), r = setPaint(c, ship, id);
    if (r.ok) { save(c); lay(true); }
    return r;
  }
  // ── the view from outside ──
  const _eye = new THREE.Vector3(), _look = new THREE.Vector3(), _M = new THREE.Matrix4();
  // (the ship's own frame in the station's: where it stands now. A ship in a hangar: its cabin's, as boarding has it
  // while someone is aboard (src/boarding.js s.M: on the floor it stands on); else where the station file parks it. The
  // Hauler: where it is docked)
  function frameOf(ship) {
    if (ship === 'hauler') { const H = hauler(); return H && H.matrix ? H.matrix : null; }
    const s = boarding && boarding.ships.find((x) => x.id === ship);
    if (s && (s.M || s.M0)) return s.M || s.M0;
    const p = W.R.places && W.R.places.ships && W.R.places.ships[ship]; if (!p) return null;
    // (parked: its nose along +x or -x of the station; its frame's z is its nose, its x its port side)
    return _M.makeRotationY(p.nose === '-x' ? -Math.PI / 2 : Math.PI / 2).setPosition(p.at[0], p.at[1], p.at[2]);
  }
  function viewOf(ship) {
    const V = VIEW[ship], F = frameOf(ship); if (!V || !F) return null;
    const cam = W.camera, v = cam.aspect < 0.8 && V.tall ? V.tall : V;
    _eye.fromArray(v.eye).applyMatrix4(F); _look.fromArray(v.look).applyMatrix4(F);
    // (in a hangar: the eye kept inside its walls and under its roof's trusses)
    const hangar = ship !== 'hauler' ? W.room(((W.room('ship-' + ship) || {}).with || [])[0]) : null, box = hangar && hangar.box;
    if (box && !box.isEmpty()) {
      const K = VIEW.keep;
      _eye.x = Math.max(box.min.x + K.wall, Math.min(box.max.x - K.wall, _eye.x)); _eye.z = Math.max(box.min.z + K.wall, Math.min(box.max.z - K.wall, _eye.z));
      _eye.y = Math.max(box.min.y + K.floor, Math.min(box.min.y + K.top, _eye.y));
    }
    return { eye: _eye, look: _look, fov: v.fov };
  }
  function aim(camera) {
    if (!viewing) return false;
    const v = viewOf(viewing); if (!v) return false;
    camera.position.copy(v.eye); camera.up.set(0, 1, 0); camera.lookAt(v.look);
    if (camera.fov !== v.fov) { camera.fov = v.fov; camera.updateProjectionMatrix(); }
    return true;
  }
  // (the small model in the landing guide: the paint with a little white in it, brought up to the guide's brightness)
  function modelColour(ship, own) {
    const id = laid[ship] || (ship === 'hauler' ? paintOf(crew(), 'hauler') : FACTORY);
    if (!id || id === FACTORY) return own;
    const c = lin(hullColour(ship, id)).map((v) => v + (1 - v) * MODEL.mix), top = Math.max(...c), k = lin('#' + Math.round(MODEL.light * 255).toString(16).padStart(2, '0').repeat(3))[0] / Math.max(1e-3, top);
    return parseInt(hexOf(c.map((v) => v * k)).slice(1), 16);
  }
  return {
    pick, aim, lay, modelColour,
    card: (ship) => ({ list: () => swatchesOf(crew(), ship), pick: (id) => pick(ship, id).ok, view: (on) => { viewing = on ? ship : viewing === ship ? null : viewing; } }),
    on: (ship) => (ship === 'hauler' ? paintOf(lastCrew, 'hauler') : laid[ship] || FACTORY),
    get viewing() { return viewing; }, view: (ship) => { viewing = ship || null; }, viewOf,
    dispose() { W.after.delete(after); },
  };
}
