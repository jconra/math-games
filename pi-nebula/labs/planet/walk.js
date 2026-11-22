// THE PLANET LAB ON FOOT (the rescue run's pieces 3 and 4, RESCUE_PLAN.md; the lab's own part of them, kept here so the
// lab's page changes only where it hands over the camera): the Medic set down in the landing ring beside the wreck, its
// ramp down toward the pods (src/planet/medicdown.js, src/rescueplan.js medicStand); the player on foot, starting in its
// med bay at the top of the ramp (src/planet/onfoot.js: the game's own walking and camera); each pod's lock as the lab
// already has it (E, or a tap); and whoever was asleep in an opened pod getting out and coming aboard by themselves
// (src/rescued.js). Nothing here is the game's: the game will put the same pieces in its run.
//
// A row of the menu, "On foot": Walk from the Medic (the Medic lands at once if it is not there yet), and while walking
// Back to flying. While on foot the menu folds away to that row (on a phone it took half the screen), the lab's flying
// keys and its thumb stick rest, and the game's own keys and stick walk (W A S D or the arrows, Shift to run; on a touch
// screen a stick wherever the left thumb lands, drag on the right to look). Back to flying, the Medic stays where it
// stands and the rescued go on.
//
//   const walk = makeWalkLab({ LAB, scene, camera, canvas, renderer, quality, lab })
//     lab() -> { planet, wreck, pods, podPlan, crewLib (a promise of the crew kit) }: the lab's own, as they are now
//   walk.frame(dt) -> true while on foot (the camera is the walk's); walk.on
//   LAB.walk(on) (a promise), LAB.foot -> { F, medic, rescued, input } (for the rigs)
// Address: ?walk starts on foot once the planet is made.
import * as THREE from 'three';
import { makeInput } from '../../../shared/input.js';
import { makeMedicDown } from '../../src/planet/medicdown.js';
import { makeOnFoot } from '../../src/planet/onfoot.js';
import { makeRescued } from '../../src/rescued.js';
import { medicStand } from '../../src/rescueplan.js';
import { LOOKS, recipeOf } from '../../src/looks.js';

export function makeWalkLab({ LAB, scene, camera, canvas, renderer, quality, lab }) {
  const $ = (id) => document.getElementById(id);
  const input = makeInput(canvas, { camera, stick: { ring: 'rgba(170, 215, 255, .6)', back: 'rgba(10, 16, 24, .3)', knob: 'rgba(240, 150, 60, .75)' } });
  input.enabled = false;
  let on = false, busy = null, site = null;     // site: { planet, medic, F, rescued } for the planet it was made on
  // ── the row ──
  const row = document.createElement('div'); row.className = 'kl-row'; row.id = 'walkRow';
  const label = document.createElement('span'); label.className = 'kl-label pl-keep'; label.textContent = 'On foot';
  const go = document.createElement('button'); go.type = 'button'; go.className = 'chip sub';
  const say = document.createElement('span'); say.className = 'pl-note'; say.style.flex = '1 1 12em';
  row.append(label, go, say);
  const podsRow = $('podsRow'); podsRow.after(row);
  go.addEventListener('click', (e) => { e.currentTarget.blur(); setOn(!on); });
  const folded = new Map();
  function paint() {
    const L = lab(); row.style.display = L.podPlan ? '' : 'none';
    go.textContent = busy ? 'Setting the Medic down…' : on ? 'Back to flying' : 'Walk from the Medic'; go.classList.toggle('on', on); go.disabled = !!busy;
    say.textContent = on ? (matchMedia('(pointer: coarse)').matches ? 'A thumb on the left walks, a drag on the right looks; tap a pod for its lock.' : 'W A S D walk · Shift runs · drag to look · E or a tap: a pod\'s lock') : '';
    // (on foot, the menu folds away to this row, each row put back as it was after, and the lab's own stick and buttons
    // rest)
    for (const el of $('bar').children) {
      if (el === row) continue;
      if (on) { if (!folded.has(el)) folded.set(el, el.style.display); el.style.display = 'none'; } else if (folded.has(el)) { el.style.display = folded.get(el); folded.delete(el); }
    }
    for (const id of ['stick', 'updown', 'keys']) { const el = $(id); if (el) el.style.visibility = on ? 'hidden' : ''; }
    document.body.style.setProperty('--bar', $('bar').offsetHeight + 'px');
    dispatchEvent(new Event('resize'));
  }
  // ── the Medic set down, the walls, the player, the rescued: made once a planet ──
  async function make() {
    const L = lab(); if (!L.planet || !L.podPlan || !L.pods) return null;
    if (site && site.planet === L.planet) return site;
    drop();
    const planet = L.planet, stand = medicStand(planet.land.landing, L.podPlan.pods);
    const medic = await makeMedicDown({ scene, renderer, camera, ground: planet.ground, sky: planet.dome, stand, quality });
    const lib = await L.crewLib();
    // (the player in a look none of the sleepers here wears)
    const used = new Set(L.podPlan.pods.map((p) => p.look)), mine = LOOKS.filter((l) => !/^android/.test(l.id)).find((l, k) => !used.has(k)) || LOOKS[0];
    const F = await makeOnFoot({ planet, scene, camera, lib, recipe: recipeOf({ id: mine.id }, lib), wreck: L.wreck, pods: L.pods, medic });
    F.player.c.root.visible = false;
    const rescued = makeRescued({ pods: L.pods, medic, walls: F.walls, scene });
    if (lab().planet !== planet) { medic.dispose(); F.dispose(); rescued.dispose(); return null; }
    site = { planet, medic, F, rescued, look: mine.id };
    return site;
  }
  function drop() {
    if (!site) return;
    site.rescued.dispose(); site.F.dispose(); site.medic.dispose(); site = null;
  }
  // the player put in the med bay at the ramp's head, facing down it
  function startAt(S) {
    const s = S.medic.stand, sg = S.medic.side === 'port' ? 1 : -1, deck = S.medic.space.deck;
    const feet = new THREE.Vector3(sg * 1.55, deck, 0.25).applyMatrix4(S.medic.M);
    S.F.put(feet, s.yaw + sg * Math.PI / 2);
  }
  async function setOn(want) {
    if (busy) return busy;
    if (!want) {
      on = false; input.enabled = false; if (LAB.reach) LAB.reach.eye = null;
      if (site) site.F.player.c.root.visible = false;
      // (the lab's flying camera where the walking one is, looking the same way)
      const d = camera.getWorldDirection(new THREE.Vector3());
      LAB.look(camera.position.toArray(), camera.position.clone().addScaledVector(d, 10).toArray());
      paint(); return false;
    }
    busy = (async () => {
      paint();
      try {
        const S = await make(); if (!S) return false;
        if (!S.started) { startAt(S); S.started = true; }
        S.F.player.c.root.visible = true; on = true; input.enabled = true;
        // (a pod's lock offered from where the player stands, looked at as the camera looks: src/podreach.js eye)
        if (LAB.reach) { const head = new THREE.Vector3(); LAB.reach.eye = () => head.copy(S.F.player.pos).setY(S.F.player.pos.y + 1.6); }
        return true;
      } catch (e) { console.error('planet lab: on foot did not start', e); if (window.oops) window.oops(e); return false; }
      finally { busy = null; paint(); }
    })();
    return busy;
  }
  // ── each frame (called whatever the mode: the Medic and the rescued go on while the lab flies) ──
  let seen = null, auto = new URLSearchParams(location.search).has('walk');
  function frame(dt) {
    const L = lab();
    if (site && site.planet !== L.planet) { on = false; input.enabled = false; if (LAB.reach) LAB.reach.eye = null; drop(); }
    if (seen !== L.planet) { seen = L.planet; paint(); }
    if (auto && L.planet && L.podPlan && L.pods) { auto = false; setOn(true); }
    if (!site) return false;
    // (a row the lab shows again while on foot (a lock solved repaints its chips) folded away again, kept to put back)
    if (on) for (const el of $('bar').children) if (el !== row && el.style.display !== 'none') { folded.set(el, el.style.display); el.style.display = 'none'; }
    const { F, medic, rescued } = site, P = F.player;
    // (a lid come to rest open or shut: the pods felt again as they now stand)
    const lids = L.pods.pods.map((p) => p.t).join();
    if (lids !== site.lids && L.pods.pods.every((p) => p.t === (p.want ?? L.pods.want))) { if (site.lids !== undefined) F.pods(); site.lids = lids; }
    if (on) F.update(dt, { move: input.move, run: input.run, look: input.takeLook(), zoom: input.takeZoom(), others: rescued.others });
    rescued.update(dt, { player: on ? P : null, camera });
    medic.update(dt, camera, [...(on ? [P.pos] : []), ...rescued.eyes()]);
    return on;
  }
  LAB.walk = (want = true) => setOn(want);
  Object.defineProperty(LAB, 'foot', { get: () => (site ? { ...site, input, on } : null) });
  paint();
  return { frame, paint, get on() { return on; } };
}
