// THE SIX-SHOOTER IN THE RIDER'S OWN HAND, out on the trail (src/player.js P.shoot; the rules in src/gun.js): the bottle
// range's gun (src/revolver.js makeGunModel) held in the right hand of the rider's own body, seen from the chase camera.
// It sits in the fist where the range's hand holds it (revolver.js fistFrame), measured once from the body posed in the
// gun clip and then carried on the wrist bone, so it goes wherever the hand goes. A shot: a flash at the muzzle and a
// puff or two of smoke drifting off. It is drawn a little bigger than life so it reads from behind the rider.
//
//   const S = makeHeldGun({ scene })
//   S.fit(person)      put it in this person's right hand: call once the body is posed holding a gun (the clip has come
//                      in fully); again for a new body (a new look). -> true when it is in the hand
//   S.fitted           the person it is in the hand of (null: none yet)
//   S.show(on)         in the hand, or put away
//   S.fire()           the flash and the smoke at the muzzle
//   S.muzzle(v)        where the muzzle is in the world (a Vector3 filled in)
//   S.update(dt)       each frame
//   S.dispose()
import * as THREE from 'three';
import { makeGunModel, fistFrame, puffPicture, GRIP } from './revolver.js';

export const HELD = {
  scale: 1.5,       // drawn this much bigger than life (about the grip, so it stays in the fist)
  flash: 0.07,      // s the muzzle flash shows
  flashSize: 0.32,  // m across
  smoke: 1.3,       // s a puff of smoke lasts
};

let flashMap = null, smokeMap = null;

export function makeHeldGun({ scene }) {
  const model = makeGunModel();
  const holder = new THREE.Group(); holder.name = 'sixgun'; holder.matrixAutoUpdate = false; holder.visible = false;
  // (sized about the grip's middle, as the range's hand is: the grip stays in the fist)
  const sized = new THREE.Group(); sized.scale.setScalar(HELD.scale);
  sized.position.fromArray(GRIP.at).multiplyScalar(1 - HELD.scale);
  sized.add(model.gun); holder.add(sized);
  holder.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  if (!flashMap) { flashMap = puffPicture('rgba(255,250,220,1)', 'rgba(255,170,60,0.85)'); smokeMap = puffPicture('rgba(235,232,225,0.75)', 'rgba(200,196,188,0.35)'); }
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashMap, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  flash.visible = false; scene.add(flash);
  const puffs = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeMap, depthWrite: false, transparent: true, opacity: 0 }));
    s.visible = false; scene.add(s); puffs.push({ s, t: 9, v: new THREE.Vector3() });
  }
  const S = { fitted: null };
  let flashT = 0;
  const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _j = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();

  S.fit = (person) => {
    const B = person && person.bones;
    if (!B || !B.WristR || !B.Index2R || !B.Pinky2R || !B.Index4R) return false;
    person.root.updateMatrixWorld(true);
    // the gun's frame in the world (the fist as posed now), then in the wrist bone's own frame
    const F = fistFrame(B);
    holder.matrix.copy(_m.copy(B.WristR.matrixWorld).invert().multiply(F));
    holder.matrixWorldNeedsUpdate = true;
    B.WristR.add(holder);
    S.fitted = person;
    return true;
  };
  S.show = (on) => { holder.visible = !!on && !!S.fitted; };
  S.muzzle = (v = new THREE.Vector3()) => { holder.updateWorldMatrix(true, true); return model.muzzle.getWorldPosition(v); };
  S.fire = () => {
    if (!S.fitted) return;
    flashT = HELD.flash;
    S.muzzle(_v);
    model.muzzle.getWorldQuaternion(_q); _d.set(0, 0, 1).applyQuaternion(_q);   // (the muzzle's way)
    for (let k = 0, n = 0; k < puffs.length && n < 2; k++) {
      const p = puffs[k]; if (p.t < HELD.smoke) continue;
      p.s.position.copy(_v).addScaledVector(_d, 0.08 * (n + 1));
      p.v.copy(_d).multiplyScalar(0.6 + Math.random() * 0.4).add(_j.set((Math.random() - 0.5) * 0.2, 0.25, (Math.random() - 0.5) * 0.2));
      p.t = -n * 0.05; p.s.visible = false; n++;
    }
  };
  S.update = (dt) => {
    if (flashT > 0) {
      flashT -= dt;
      S.muzzle(flash.position);
      flash.scale.setScalar(HELD.flashSize * (0.8 + Math.random() * 0.4)); flash.material.rotation = Math.random() * 6;
      flash.visible = flashT > 0 && holder.visible;
    } else flash.visible = false;
    for (const p of puffs) {
      if (p.t >= HELD.smoke) continue;
      p.t += dt;
      if (p.t < 0) continue;
      const f = p.t / HELD.smoke;
      p.s.visible = f < 1;
      p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-dt * 1.6)); p.v.y += dt * 0.08;
      p.s.scale.setScalar(0.08 + f * 0.4);
      p.s.material.opacity = 0.4 * (1 - f) * Math.min(1, p.t * 12);
    }
  };
  S.dispose = () => {
    holder.removeFromParent();
    holder.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    model.metal.dispose(); model.matte.dispose();
    flash.removeFromParent(); flash.material.dispose();
    for (const p of puffs) { p.s.removeFromParent(); p.s.material.dispose(); }
  };
  return S;
}

// THE SIGHTS out on the trail: the bottle range's sights (the same ring with its four ticks, src/missions/shooting.js)
// over the ringed rider while the six-shooter is the rider's tool, gold when he is in its reach.
//   const G = makeSights();  G.place({ x, y, r } | null, hot);  G.dispose()
export function makeSights() {
  if (!document.getElementById('bsg-css')) {
    const st = document.createElement('style'); st.id = 'bsg-css';
    st.textContent = `
.bsg-sights { position: fixed; left: 0; top: 0; width: 0; height: 0; pointer-events: none; z-index: 11; transition: opacity .15s; }
.bsg-sights i { position: absolute; left: -17px; top: -17px; width: 34px; height: 34px; border-radius: 50%; border: 2px solid rgba(255,248,230,0.92); box-shadow: 0 0 0 1px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.35); }
.bsg-sights i::before, .bsg-sights i::after { content: ''; position: absolute; background: rgba(255,248,230,0.92); box-shadow: 0 0 0 1px rgba(0,0,0,0.35); }
.bsg-sights i::before { left: 15px; top: -8px; width: 2px; height: 46px; clip-path: polygon(0 0, 100% 0, 100% 35%, 0 35%, 0 65%, 100% 65%, 100% 100%, 0 100%); }
.bsg-sights i::after { top: 15px; left: -8px; height: 2px; width: 46px; clip-path: polygon(0 0, 35% 0, 35% 100%, 0 100%, 0 0, 65% 0, 100% 0, 100% 100%, 65% 100%); }
.bsg-sights.is-on i { border-color: #ffd36a; }
.bsg-sights.is-on i::before, .bsg-sights.is-on i::after { background: #ffd36a; }`;
    document.head.appendChild(st);
  }
  const el = document.createElement('div'); el.className = 'bsg-sights'; el.innerHTML = '<i></i>'; el.hidden = true;
  document.body.appendChild(el);
  return {
    el,
    place(at, hot = false) {
      if (!at) { el.hidden = true; return; }
      el.hidden = false;
      el.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
      el.classList.toggle('is-on', !!hot);
    },
    dispose() { el.remove(); },
  };
}
