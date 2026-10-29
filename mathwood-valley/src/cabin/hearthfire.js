// A FIRE IN THE CABIN'S HEARTH, once lit (cabin.js: "Light a fire" at the fireplace, after a few fireside sums,
// firemath.js). The flame is the camps' own (src/fire/campfire.js: yomotsu's volumetric fire, its crackle made of noise
// only, never tones), set in the firebox on the logs laid there (labs/buildings/cabins.js hearth); its glow on the
// ground left out (the hearthstones and the room are lit instead). It catches (the flame grows over a few seconds),
// burns a good while, dies down to embers glowing in the ash, and can be lit again any time after.
//
// THE LIGHT: no real light (a PointLight would make every lit thing in the valley costlier). The cabin's own walls are
// lit by its fireplace's lamp (the building's lamp marked `hearth`: its strength turned up and down with the flames);
// the pieces in it (the furniture, the keepsakes, the dogs) by one more lamp in their own lamp list (interior.js
// R.extraLamps), on the tiers that have room for it (not the potato tier: there the walls' light is all).
//
//   const F = makeHearthFire({ W, R, camera, audio, hearth, index })   R: the cabin (interior.js makeHome);
//                                       hearth: its layout's hearth (layout.js: fire, into, look...); index: which one
//   F.light()           puts a flame to it (cold or embers): it catches
//   F.update(dt, t)     each frame while the cabin is near
//   F.phase             'cold' | 'catching' | 'burning' | 'dying' | 'embers';  F.heat: 0..1 how big the flames are now
//   F.dispose()
import * as THREE from 'three';
import { makeCampfire } from '../fire/campfire.js';
import { lampOf } from './pieces.js';

export const HEARTH_FIRE = {
  width: 0.4,          // m: the flame's width (the firebox is a little under a metre across)
  catch: 4,            // s for it to catch and grow to full
  burn: 420,           // s it burns at full (seven minutes)
  die: 60,             // s it dies down over, to embers
  ember: 0.16,         // how bright the embers glow, against the full fire's 1
  wall: 0.85,          // the fireplace's lamp's strength on the walls at full (the cabins' lanterns are about 1)
  piece: 2.4,          // the pieces' lamp at full (interior.js lamps: the stove's fire is 2.2)
  reach: 7,            // m the pieces' lamp reaches
};

export function makeHearthFire({ W, R, camera, audio = null, hearth, index = 0 }) {
  const C = HEARTH_FIRE, B = R.code, scene = W.scene;
  const at = new THREE.Vector3(), front = new THREE.Vector3();
  const fireW = () => R.toWorld(hearth.fire[0], hearth.fire[1], hearth.fire[2], at);
  // (the fireplace's own lamp: the building's lamp marked hearth nearest this fire)
  const lampI = (() => { let best = -1, bd = 9; B.lamps.forEach((L, i) => { if (!L.hearth) return; const d = Math.hypot(L.p[0] - hearth.fire[0], L.p[2] - hearth.fire[2]); if (d < bd) { bd = d; best = i; } }); return best; })();
  const wallLamp = lampI >= 0 ? B.lamps[lampI] : null;
  // the pieces' lamp: a little out of the firebox, at the flames' height
  const lamp = lampOf(0xff8a3c, 0, C.reach, 1.5); lamp.name = 'hearth-fire-lamp';
  lamp.position.set(hearth.fire[0] + hearth.into[0] * 0.55, hearth.fire[1] + 0.35, hearth.fire[2] + hearth.into[2] * 0.55);
  R.group.add(lamp);
  const lampsOn = W.tier !== 'potato';
  // THE EMBERS: a bed of them glowing in the ash under the logs (one small mesh, added light, brighter as it burns)
  const eg = new THREE.BufferGeometry(), pts = [], R0 = (k) => (Math.sin(k * 12.9898 + index * 7.1) * 43758.5453) % 1;
  for (let k = 0; k < 26; k++) {
    // (small coals in the ash under the logs, thicker toward the middle)
    const u = (Math.abs(R0(k)) - 0.5) * 0.3, v = (Math.abs(R0(k + 50)) - 0.5) * 0.46 * (0.5 + Math.abs(R0(k + 7))), s = 0.012 + Math.abs(R0(k + 99)) * 0.022;
    const cx = hearth.fire[0] - hearth.into[0] * u * 0.6 + hearth.into[2] * v, cz = hearth.fire[2] - hearth.into[2] * u * 0.6 - hearth.into[0] * v, y = hearth.fire[1] - 0.115 + Math.abs(R0(k + 31)) * 0.01;
    pts.push([cx - s, y, cz - s, cx + s, y, cz - s, cx + s, y, cz + s, cx - s, y, cz - s, cx + s, y, cz + s, cx - s, y, cz + s]);
  }
  eg.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
  const em = new THREE.MeshBasicMaterial({ color: 0xff5a14, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const embers = new THREE.Mesh(eg, em); embers.name = 'hearth-embers'; embers.renderOrder = 4; embers.visible = false; R.inner.add(embers);

  let flame = null, phase = 'cold', t = 0, heat = 0, clock = 0;
  const F = { get phase() { return phase; }, get heat() { return heat; }, index };
  F.light = () => {
    if (phase === 'catching' || phase === 'burning') return false;
    if (!flame) {
      fireW();
      flame = makeCampfire({ W, scene, camera, x: at.x, z: at.z, y: at.y - 0.04, width: C.width, audio, id: 'hearth-fire-' + index, glow: false });
    }
    phase = 'catching'; t = 0; return true;
  };
  // how big the flames are, how bright the light: up as it catches, flickering, down to the embers' glow as it dies
  F.update = (dt, time = (clock += dt)) => {
    t += dt;
    if (phase === 'catching') { heat = Math.min(1, t / C.catch); if (t >= C.catch) { phase = 'burning'; t = 0; } }
    else if (phase === 'burning') { heat = 1; if (t >= C.burn) { phase = 'dying'; t = 0; } }
    else if (phase === 'dying') { heat = Math.max(0, 1 - t / C.die); if (t >= C.die) { phase = 'embers'; t = 0; } }
    else heat = 0;
    const glowK = phase === 'cold' ? 0 : Math.max(C.ember, heat);
    const f = 1 + 0.14 * Math.sin(time * 8.3) + 0.08 * Math.sin(time * 19.1 + 1.3) + 0.05 * Math.sin(time * 3.1);
    if (flame) {
      const on = heat > 0.02;
      if (on) flame.update(dt, time);
      flame.mesh.visible = on && flame.burning;
      if (on) {   // (the flame's column grows from the logs: its foot stays put)
        const s = (C.width / 2) * (0.35 + 0.65 * heat), y0 = at.y - 0.04;
        flame.mesh.scale.setScalar(s); flame.mesh.position.y = y0 + 2 * s;
      }
    }
    embers.visible = glowK > 0; em.opacity = Math.min(1, glowK * (0.85 + 0.15 * f));
    // the light: the walls' (the building's own lamp), the pieces' (one more lamp in their list)
    if (wallLamp) { wallLamp.strength = C.wall * glowK * f; if (B.uni && B.uni.uLampS) B.uni.uLampS.value[lampI] = wallLamp.strength; }
    lamp.intensity = C.piece * glowK * f;
    R.extraLamps = lampsOn && glowK > 0 ? [lamp] : [];
  };
  F.dispose = () => {
    if (flame) flame.dispose();
    embers.removeFromParent(); eg.dispose(); em.dispose(); lamp.removeFromParent();
    if (wallLamp) wallLamp.strength = 0;
    R.extraLamps = [];
  };
  F.state = () => ({ phase, heat: +heat.toFixed(2), t: +t.toFixed(1), lamp: wallLamp ? +wallLamp.strength.toFixed(2) : null, flame: !!(flame && flame.mesh.visible) });
  void front;
  return F;
}
