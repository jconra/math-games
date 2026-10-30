// THE GANG'S REVOLVERS IN THEIR FISTS, shared by the wagon hold-up (src/missions/wagonjob.js) and the gang's loot camps
// that fight (src/missions/loot.js): every rider's revolver drawn in his fist (one shared mesh for them all:
// src/fx/gunfire.js), and a shot when the job starts one: the gun raised into the air (or out straight at a mark the job
// picked), fired (the flash, the smoke, the range's shot heard from the muzzle), held a moment and lowered. Where a shot
// at a mark lands (splinters, dust, a ping) is the job's: onBoom. Never at anyone: the jobs pick marks clear of the player.
//
//   const G = makeGangGuns({ scene, W, camera, sound })   sound(): src/audio/rangesound.js's (made when first wanted)
//   G.start(rec, kind)   a shot from this rider: 'air', or another kind with rec.hit = { at (a Vector3), ... } its mark
//   G.frame(recs, dt, { skip, noGun, onBoom })   each frame: recs are { r (actors/riders.js), shot, gunIx } records;
//                        skip(rec): left out this frame (no gun, his shot held); noGun(rec): his shot steps on but no gun
//                        is drawn; onBoom(rec, muzzle): a shot just fired (after the flash and the sound)
//   G.gunfire           the gunfire (F: splinters, dust ...) once made, else null;  G.shots  shots fired
//   G.state(), G.dispose()
import * as THREE from 'three';
import { makeGunfire } from './gunfire.js';

export const SHOT = { raise: 0.2, hold: 0.45, lower: 0.45 };   // s: the gun up (or out at the mark), held, lowered

export function makeGangGuns({ scene, W, camera, sound }) {
  let F = null;
  const fists = [];
  for (let i = 0; i < 12; i++) fists.push({ pos: new THREE.Vector3(), dir: new THREE.Vector3(), side: new THREE.Vector3() });
  const _hq = new THREE.Quaternion(), _mz = new THREE.Vector3();
  const G = { shots: 0 };
  G.start = (rec, kind = 'air') => { rec.shot = { t: 0, kind, fired: false, boom: false }; };
  // a shot under way: the gun up (or out at the mark), fired, held a moment, lowered
  function stepShot(rec, dt) {
    const sh = rec.shot, g = rec.r.gun;
    sh.t += dt;
    const up = Math.min(1, sh.t / SHOT.raise), down = Math.max(0, Math.min(1, (sh.t - SHOT.raise - SHOT.hold) / SHOT.lower)), k = up * (1 - down);
    if (sh.kind === 'air') g.up = k; else { g.aim = k; g.at.copy(rec.hit.at); }
    if (!sh.fired && sh.t >= SHOT.raise) { sh.fired = true; sh.boom = rec.r.mode === 'ride'; }
    if (sh.t >= SHOT.raise + SHOT.hold + SHOT.lower || rec.r.mode !== 'ride') { g.up = 0; g.aim = 0; rec.shot = null; }
  }
  // fired: the flash and the smoke at his muzzle, and the shot heard from there
  function boom(rec, onBoom) {
    if (rec.gunIx < 0) return;
    G.shots++;
    F.muzzle(rec.gunIx, _mz);
    F.flash(_mz, fists[rec.gunIx].dir, camera.position.distanceTo(_mz));
    sound().shotAt(_mz);
    if (onBoom) onBoom(rec, _mz);
  }
  G.frame = (recs, dt, { skip = null, noGun = null, onBoom = null } = {}) => {
    if (!F) { if (!recs.length) return; F = makeGunfire({ scene, tier: W.tier, W }); F.ground((x, z) => W.heightAt(x, z)); }
    let n = 0;
    for (const rec of recs) {
      rec.gunIx = -1;
      if (skip && skip(rec)) continue;
      if (rec.shot) stepShot(rec, dt);
      const r = rec.r, f = fists[n];
      if (n < fists.length && !(noGun && noGun(rec)) && r.gunHand(f.pos, f.dir)) {
        r.person.root.getWorldQuaternion(_hq); f.side.set(1, 0, 0).applyQuaternion(_hq);
        rec.gunIx = n++;
      }
    }
    F.guns(fists, n);
    for (const rec of recs) if (rec.shot && rec.shot.boom) { rec.shot.boom = false; boom(rec, onBoom); }
    F.update(dt);
  };
  Object.defineProperty(G, 'gunfire', { get: () => F });
  G.state = () => (F ? F.state() : null);
  G.dispose = () => { if (F) { F.dispose(); F = null; } };
  return G;
}
