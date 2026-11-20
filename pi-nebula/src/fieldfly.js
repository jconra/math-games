// FLYING AT THE ROCKS: the drill's view (src/drillview.js) and the game's own flying (src/flying.js) joined, for a
// captain's run (src/trip.js) and for the Drill Lab alike.
//
// THE GAME'S MAKER (2026-11-18, of who flies at the rocks): "Yeah the pilot flies if you are operating the drill. If you
// signed up for both there can be a button that lets you switch tasks. Either way, you should be able to click on an
// asteroid to travel over to it (If you want to fly and you signed up to be a pilot, you can click a button to fly
// manually if you want). If you are the drill operator and you click on an asteroid that is you telling the pilot where
// you would like they to fly. If you are autopilot it is the same control."
//
// SO, AT THE ROCKS:
//   - THE FLYING IS KEPT. It is the same flying as at the station (the same keys, mouse, sticks and buttons, the two
//     views, the help corner), flying the drill's own Miner in the field, with the rocks as what it bumps into (no
//     damage: it stops, or slides round them).
//   - A TAP ON A ROCK IS STILL WHERE TO FLY, in the drill's view, whoever flies: Pilot Juno for a drill operator, the
//     autopilot for a crew member who has the pilot's seat too. That is the drill's own, untouched.
//   - A CREW MEMBER WITH BOTH JOBS HAS THE BUTTON THAT SWITCHES BETWEEN THE TWO TASKS. At the drill it says "Fly
//     manually" (M): the ship is theirs to fly. Flying, it says "Back to the drill" (M): the drill's view again, where
//     a tapped rock is where the autopilot flies.
//   - THE CLAW TAKES A ROCK THE SHIP HAS BEEN BROUGHT UP TO (flymodel.js rockNear: the rock within reach of the claw's
//     hand, the ship slow), as it does after a tapped trip: the drill's task is then on, with that rock.
//   - FROM THE SEAT: as the wormhole's far end opens on the field, and again for the jump home, the eye is in the seat
//     (or behind the ship, whichever view was on), with the controls put away: `seat`. Nothing of the drill's is
//     shown then.
//   - THE CREW'S OWN DRILLER (the crew member did not sign for the drill: the drill's view `byCrew`, src/drillview.js),
//     2026-11-19: "If you are the pilot then the drill guy will mark one for you to fly to". With the pilot's seat, the
//     crew member flies to the marked rock by hand (`hand`), from whichever view they had (no drill's view to come
//     back to), and the claw takes that rock only; while it is drilled the ship holds and is watched from the same
//     view (`ride`), the next rock is marked, and the flying is theirs again. Riding (the crew's pilot flies, or the
//     autopilot while the pilot is on their feet), it is `ride` all the while: the drill's view moves the ship (its
//     tapped trip) and the flying's two views follow it, V changing them.
// The ship's place has one owner at a time: the flying while it is flown by hand, the drill's view otherwise (a tapped
// trip); each is told where the other left it.
//
//   const FF = makeFieldFlying({ W, drill, startFlying, pilot, flier, settings, onSettings, words, view, byCrew, dash, run })
//       W: { renderer, scene, camera, after (a Set), dust }; pilot: the crew member has the pilot's seat too
//       byCrew: { hand: () => true while the crew member at the controls flies to the marked rock by hand }
//       dash, run: the dashboard's numbers kept by a run, and its canisters (src/flying.js; none: the flying keeps its
//       own, as in the Drill Lab)
//   FF.mode       'seat' | 'drill' | 'hand' | 'ride'
//   FF.ride()     the drill's view moves the ship, the flying's views follow it (the crew's driller)
//   FF.update(dt), FF.aim(camera, dt)   each frame, after the drill's own update
//   FF.out(secs, wait)   out of the seat to the drill's view: the eye glides from wherever it is (wait: until FF.go())
//   FF.sit(view)         into the seat for the jump home (the eye has glided there): the flying's views, controls away
//   FF.fly(), FF.drill() the two tasks, by name (the buttons; the rigs)
//   FF.fl (the flying), FF.matrix (the ship's kit frame in the world), FF.state(), FF.close()
import * as THREE from 'three';
import { FIELD, rockNear, rockSolid } from './flymodel.js';

// the ship's kit frame (x to port, y up, z to its nose) in the flight model's own [ahead, up, right]
const KIT = new THREE.Matrix4().makeRotationY(Math.PI / 2);

export function makeFieldFlying({ W, drill, startFlying, pilot = false, flier = 'The pilot', settings = null, onSettings = null, words = () => {}, view = 'cockpit', byCrew = null, dash = null, run = null }) {
  const _f = new THREE.Vector3(), _q = new THREE.Quaternion(), _k = new THREE.Quaternion().setFromRotationMatrix(KIT).invert();
  // (where the drill's view has the ship: its place, and its turn as the flight model keeps it)
  const poseNow = () => { _q.copy(drill.ship.q).multiply(_k); return { p: drill.ship.p.toArray(), q: _q.toArray() }; };
  _f.set(0, 0, 1).applyQuaternion(drill.ship.q);
  let mode = 'seat', closed = false, taken = 0, api = null;
  const fl = startFlying({ W, boarding: null, crane: null }, {
    // (the flying's own few words along the top only while it is flown by hand: from the seat the run's own stand)
    cfg: FIELD, goal: 'field', pilot, flier, view, settings, onSettings, words: (w) => { if (mode === 'hand') words(w); },
    // (the dashboard: a run's own numbers, if it keeps them; src/flying.js)
    ...(dash ? { dash, run } : {}),
    body: { at: drill.at, M0: KIT, p: drill.ship.p.toArray(), f: _f.toArray(), fly: (M) => drill.shipTo(M), solid: rockSolid(() => drill.rocksNow()) },
    task: pilot && !byCrew ? { words: 'Back to the drill', on: () => api.drill() } : null,
  });
  fl.lock(true); drill.eye = false; drill.show(false);

  api = {
    fl, get mode() { return mode; }, get matrix() { return fl.matrix; }, get taken() { return taken; },
    // OUT OF THE SEAT, to the drill's view: the eye glides there from wherever the flying's view has it
    out(secs, wait = false) {
      if (closed || mode === 'drill') return;
      if (mode === 'hand') drill.hand(false, W.camera);
      const from = fl.eye(W.camera);
      fl.pause(true); drill.eye = true; drill.show(true); drill.glideFrom(from, secs, wait); mode = 'drill';
    },
    go() { drill.glideGo(); },
    // INTO THE SEAT, for the jump home: the flying's own views, the controls put away
    sit(v = 'cockpit') {
      if (closed) return;
      if (mode === 'hand') drill.hand(false, W.camera);
      const at = poseNow(); fl.put(at.p, at.q); fl.view = v; fl.pause(false); fl.lock(true);
      drill.eye = false; drill.show(false); mode = 'seat';
    },
    // THE PILOT'S TASK: the ship flown by hand, from where it is, seen from behind at first (where the eye already is)
    fly() {
      if (closed || !pilot || mode !== 'drill' || !drill.hand(true)) return false;
      const at = poseNow(); mode = 'hand'; fl.put(at.p, at.q); fl.lock(false); fl.pause(false); fl.eyeFrom(W.camera);
      return true;
    },
    // THE DRILL'S TASK again: the ship stays where it was flown to, and a tapped rock is where the autopilot flies
    drill() {
      if (closed || mode !== 'hand') return false;
      fl.pause(true); drill.hand(false, W.camera); mode = 'drill'; words('At the rocks');
      return true;
    },
    // THE CREW'S DRILLER: the drill's view moves the ship, the flying's views follow it, the controls put away
    ride() {
      if (closed || mode === 'ride') return;
      if (mode === 'hand') drill.hand(false, W.camera);
      if (mode === 'drill') { const at = poseNow(); fl.put(at.p, at.q); fl.pause(false); drill.eye = false; drill.show(false); }
      fl.lock(true); mode = 'ride';
    },
    update(dt) {
      if (closed) return;
      // (the crew's driller: the marked rock is the crew member's to fly to while they are at the controls; not now
      // (on their feet, or a part skipped), the ship is the drill's view's to move)
      if (byCrew && mode === 'ride' && byCrew.hand() && drill.stage === 'look' && drill.crew.mark != null && drill.hand(true)) { const at = poseNow(); fl.put(at.p, at.q); fl.lock(false); mode = 'hand'; }
      else if (byCrew && mode === 'hand' && !byCrew.hand()) api.ride();
      if (mode === 'seat' || mode === 'hand') fl.update(dt);
      // (flown up to a rock: the claw takes it, and the drill's task is on with that rock; the crew's driller takes only
      // the rock they marked, and the ship is watched from where the eye is)
      if (mode === 'hand') {
        const R = rockNear(fl.S, drill.rocksNow());
        if (R && byCrew) { if (R.id === drill.crew.mark && drill.take(R.id, W.camera)) { taken++; const at = poseNow(); fl.put(at.p, at.q); fl.lock(true); mode = 'ride'; } }
        else if (R) { fl.pause(true); mode = 'drill'; words('At the rocks'); if (drill.take(R.id, W.camera)) taken++; else drill.hand(false, W.camera); }
      }
    },
    // the camera: the flying's own view from the seat and flown by hand, the drill's otherwise (which still places
    // what hangs on the rocks either way); riding, the flying's view where the drill's view has put the ship
    aim(camera, dt) {
      if (closed) return;
      if (mode === 'ride') { const at = poseNow(); fl.put(at.p, at.q); }
      if (mode !== 'drill') fl.aim(camera, dt);
      drill.aim(camera, dt);
    },
    state: () => ({ mode, taken, fly: fl.state() }),
    close() { if (closed) return; closed = true; fl.close(); },
  };
  return api;
}
