// FEEDING THE HORSES, in the valley (the plain rules are src/treats.js):
//   THE APPLE TREES   the wild apple trees the Town Lab puts down (world/objects/appletree.js; the forest draws the tree)
//                     carry red apples in their crowns, drawn here. On foot by one, E picks what's on it ("Pick apples",
//                     main.js puts the prompt up); a tree picked bare fills again the next morning in the game.
//   A TREAT           on foot by a horse's head with a treat in the saddlebags, the apple button comes up on the tools
//                     strip (src/ui/tools.js); a tap or a click on it, or G ("give"), hands the treat over: the horse
//                     lowers its head and munches (its Eating clip; a stall horse, its head out over the gate, nods
//                     instead), a crunch is heard, and a heart floats up (two from the donkey for a carrot). E stays get
//                     on and off: feeding never takes it.
//   ANY HORSE         the rider's own (with them, or in its stall), the pen's (src/horsepen.js), the stable's stall horses
//                     (src/stablelife.js) and the donkey. Only the rider's own fill hearts (src/treats.js BOND).
//   FULL HEARTS       the horse nickers when the rider walks up to it (from a way off), and comes faster to the whistle
//                     (P.eager: src/player.js)
//
//   const F = makeFeeding({ W, rider, player, hud, tools, audio, pen, stable, refresh })
//     player() the player (src/player.js); tools: src/ui/tools.js's (its apple button); pen(), stable(): the horse pen and
//     the stable life (each has treatSpots()); refresh(): the HUD's purse again (the treat counter)
//   F.update(dt, { busy })   each frame of play (not paused); busy: in the cabin or at a counter (nothing to pick or feed)
//   F.prompt          'Pick apples' by an apple tree with apples on it (on foot), else null;  F.pickDist: how far its trunk is
//   F.pick()          E by the tree: picks what the saddlebags have room for
//   F.feed()          G or the apple button: the treat to the horse whose head is nearest (within FEED.reach)
//   F.target          the horse that would be fed now ({ key, name, kind }) or null
//   F.state()         for the rigs: trees and their apples, the target, hearts in the air, the sounds played
//   F.dispose()
import * as THREE from 'three';
import { APPLE_TREE, appleSpots } from '../world/objects/appletree.js';
import { TREATS, BOND, countOf, whichTreat, takeTreat, applesLeft, pickApples, feedHorse, bondOf, treatWord, haveOf } from './treats.js';
import { today } from './shifts.js';
import { saveRider } from './save.js';
import { horseLook, ridden } from './mounts.js';
import { makeTreatSound } from './audio/treatsound.js';

export const FEED = {
  reach: 2.4,          // m (along the ground) from a horse's head the rider can hand it a treat
  look: 7,             // m: horses farther off than this (their middle) aren't looked at for a head
  munch: 3.4,          // s a horse munches
  pickReach: 3.6,      // m from an apple tree's trunk where E picks
  nickerNear: 7,       // m: a horse with full hearts nickers when the rider comes this near its head...
  nickerAway: 14,      // ...having been at least this far off since it last did
  nickerGap: 25,       // s at least between two nickers of one horse
  heartRise: 1.5,      // m a heart floats up
  heartTime: 1.9,      // s it takes
  heartSize: 0.42,     // m across
};

// a heart, drawn once: red, a shine, a dark edge (read against the sky and the grass)
let heartTex = null;
function heartTexture() {
  if (heartTex) return heartTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const path = () => { g.beginPath(); g.moveTo(64, 112); g.bezierCurveTo(14, 78, 4, 50, 16, 30); g.bezierCurveTo(30, 8, 58, 12, 64, 36); g.bezierCurveTo(70, 12, 98, 8, 112, 30); g.bezierCurveTo(124, 50, 114, 78, 64, 112); g.closePath(); };
  path(); g.lineWidth = 10; g.strokeStyle = 'rgba(70, 8, 18, 0.85)'; g.stroke();
  const grad = g.createLinearGradient(0, 16, 0, 112); grad.addColorStop(0, '#ff5a6e'); grad.addColorStop(1, '#c8102e');
  path(); g.fillStyle = grad; g.fill();
  g.beginPath(); g.ellipse(40, 40, 11, 7, -0.6, 0, Math.PI * 2); g.fillStyle = 'rgba(255, 255, 255, 0.75)'; g.fill();
  heartTex = new THREE.CanvasTexture(c); heartTex.colorSpace = THREE.SRGBColorSpace;
  return heartTex;
}

export function makeFeeding({ W, rider, player, hud, tools = null, audio = null, pen = () => null, stable = () => null, refresh = () => {} }) {
  const scene = W.scene, sound = makeTreatSound({ audio });
  const F = { prompt: null, pickDist: Infinity, target: null };
  const P = () => player && player();
  const day = () => today(rider);
  const short = (name) => String(name || 'The horse').split(' ')[0];
  const save = () => { saveRider(rider); refresh(); };

  // ── THE APPLE TREES' APPLES ──────────────────────────────────────────────────────────────────────────────────────
  let trees = [], treesSig = '', mesh = null, dayWas = -1, treeT = 0;
  const appleGeo = new THREE.IcosahedronGeometry(1, 1), appleMat = new THREE.MeshStandardMaterial({ color: 0xd0222a, emissive: 0x4a0606, roughness: 0.4, metalness: 0 });   // (a little glow of its own: red still reads in the crown's shade)
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  // the trees as the valley has them (none until the forest has its models): their apples' spots in the world
  function readTrees() {
    const list = (W.V && W.V.appleTrees) ? W.V.appleTrees() : [];
    const sig = list.map((t) => t.id).join('|');
    if (sig === treesSig) return false;
    treesSig = sig;
    trees = list.map((t) => {
      let seed = 7; for (const ch of t.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      // (each spot out past its leaves, away from the trunk, and a little down: an apple hangs)
      const spots = appleSpots(t.sp.root, APPLE_TREE.apples, seed).map((p) => { const v = new THREE.Vector3(p[0], p[1], p[2]).multiplyScalar(t.s), r = Math.hypot(v.x, v.z) || 1;
        v.x += v.x / r * APPLE_TREE.out; v.z += v.z / r * APPLE_TREE.out; v.y -= APPLE_TREE.out * 0.5;
        return v.applyAxisAngle(Y, t.yaw).add(new THREE.Vector3(t.x, t.y, t.z)); });
      return { id: t.id, x: t.x, z: t.z, y: t.y, spots, shown: -1 };
    });
    if (mesh) { mesh.removeFromParent(); mesh.dispose(); mesh = null; }
    const n = trees.reduce((a, t) => a + t.spots.length, 0);
    if (n) { mesh = new THREE.InstancedMesh(appleGeo, appleMat, n); mesh.name = 'apples'; mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh); }
    return true;
  }
  // each tree's apples: as many of its spots as it has apples left today
  function showApples() {
    if (!mesh) return;
    let k = 0;
    const r = APPLE_TREE.appleR, d = day();
    for (const t of trees) {
      const left = applesLeft(rider, t.id, d), n = Math.round(t.spots.length * left / TREATS.perTree);
      t.shown = n;
      for (let i = 0; i < n; i++) {
        const p = t.spots[i];
        _q.setFromAxisAngle(Y, i * 1.7); _s.set(r, r * 0.92, r);
        _m.compose(p, _q, _s); mesh.setMatrixAt(k++, _m);
      }
    }
    mesh.count = k; mesh.instanceMatrix.needsUpdate = true;
  }
  function treesStep(dt) {
    if ((treeT -= dt) > 0) return;
    treeT = 1;
    const d = day();
    if (readTrees() || d !== dayWas) { dayWas = d; showApples(); }
  }
  // the tree by the rider (on foot), and what E does there
  function treePrompt(p) {
    F.prompt = null; F.pickDist = Infinity; F.tree = null;
    if (!p || p.mode !== 'foot' || p.enabled === false) return;
    let best = null, bd = FEED.pickReach;
    for (const t of trees) { const dd = Math.hypot(t.x - p.position.x, t.z - p.position.z); if (dd < bd) { bd = dd; best = t; } }
    if (!best || applesLeft(rider, best.id, day()) <= 0) return;
    F.tree = best; F.pickDist = bd; F.prompt = 'Pick apples';
  }
  F.pick = () => {
    const t = F.tree; if (!t) return false;
    const r = pickApples(rider, t.id, day());
    if (!r.picked) { hud.toast(`Your saddlebags are full: ${TREATS.most} treats`, 'warn'); return false; }
    sound.play('pick', { x: t.x, y: t.y + 2.5, z: t.z });
    showApples(); save();
    const now = countOf(rider);
    hud.toast(`+${treatWord('apple', r.picked)}: ${now} of ${TREATS.most} treats in your saddlebags${r.left ? '' : '. That\'s all on this tree till morning'}`, 'good');
    return true;
  };

  // ── THE HORSES' HEADS ────────────────────────────────────────────────────────────────────────────────────────────
  // every horse that could be fed: { key, id (the rider's horse id, when it's the rider's), name, a (the animal),
  // owned, donkey, eat(seconds) -> true if it munches now }
  function spots(p) {
    const out = [];
    if (p && p.horse && p.horseId && !p.onHorse) {
      const L = horseLook(rider, p.horseId);
      out.push({ key: 'own:' + p.horseId, id: p.horseId, name: L ? L.name : 'Your horse', a: p.horse, owned: true, donkey: !!L && L.kind === 'donkey', eat: (s) => p.horseEat(s) });
    }
    const PN = pen(), SL = stable();
    if (PN && PN.treatSpots) out.push(...PN.treatSpots());
    if (SL && SL.treatSpots) out.push(...SL.treatSpots());
    return out;
  }
  const _h = new THREE.Vector3();
  const headOf = (s, into) => { const b = s.a.bones && s.a.bones.Head; return b ? b.getWorldPosition(into) : into.copy(s.a.root.position).setY(s.a.root.position.y + 1.4); };
  const munching = new Map();   // key -> until (performance.now() ms)
  let nearSpots = [], allSpots = [];
  function targetStep(p) {
    F.target = null; nearSpots = []; allSpots = [];
    const onFoot = !!p && p.mode === 'foot' && p.enabled !== false;
    if (!onFoot) return;
    const at = p.position, list = allSpots = spots(p);
    let best = null, bd = FEED.reach;
    for (const s of list) {
      const r = s.a.root.getWorldPosition(_v);
      if (Math.hypot(r.x - at.x, r.z - at.z) > FEED.look) continue;
      headOf(s, _h);
      const d = Math.hypot(_h.x - at.x, _h.z - at.z);
      nearSpots.push({ s, d });
      if (d < bd) { bd = d; best = s; }
    }
    if (best) {
      // (still munching the last one: the button stays up, dimmed, and a press waits for it to finish)
      const kind = whichTreat(rider, { donkey: best.donkey }), busy = (munching.get(best.key) || 0) > performance.now();
      if (kind) F.target = { key: best.key, name: best.name, kind, spot: best, dist: bd, busy };
    }
  }
  // the apple button: up with the treat it would give, while there is a horse to give it to
  let buttonKey = '';
  function button() {
    const t = F.target, key = t ? `${t.kind}|${haveOf(rider, t.kind)}|${short(t.name)}|${t.busy ? 1 : 0}` : '';
    if (key === buttonKey) return;
    buttonKey = key;
    if (tools && tools.treat) tools.treat(t ? { kind: t.kind, n: haveOf(rider, t.kind), name: short(t.name), busy: !!t.busy } : null);
  }

  // ── HEARTS FLOATING UP ───────────────────────────────────────────────────────────────────────────────────────────
  const hearts = [];
  function floatHearts(at, n) {
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false, opacity: 0 }));
      sp.renderOrder = 5; sp.name = 'heart';
      const side = n > 1 ? (i - (n - 1) / 2) * 0.42 : 0;
      sp.position.copy(at); scene.add(sp);
      hearts.push({ sp, from: at.clone().add(new THREE.Vector3(side, 0.3, 0)), t: -i * 0.28, wob: Math.random() * 6 });
    }
  }
  function heartsStep(dt) {
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i]; h.t += dt;
      const u = Math.max(0, h.t) / FEED.heartTime;
      if (u >= 1) { h.sp.removeFromParent(); h.sp.material.dispose(); hearts.splice(i, 1); continue; }
      const up = 1 - (1 - u) * (1 - u), pop = Math.min(1, Math.max(0, h.t) / 0.22), size = FEED.heartSize * (0.5 + 0.5 * pop) * (1 + 0.08 * Math.sin(h.t * 9));
      h.sp.position.set(h.from.x + Math.sin(h.wob + h.t * 3) * 0.08, h.from.y + up * FEED.heartRise, h.from.z);
      h.sp.scale.set(size, size, 1);
      h.sp.material.opacity = h.t < 0 ? 0 : u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
    }
  }

  // ── A TREAT GIVEN ────────────────────────────────────────────────────────────────────────────────────────────────
  F.feed = () => {
    const t = F.target; if (!t || t.busy) return false;
    const s = t.spot, kind = t.kind;
    if (!s.eat(FEED.munch)) return false;   // (it can't just now: on the move)
    if (!takeTreat(rider, kind)) return false;
    munching.set(s.key, performance.now() + FEED.munch * 1000);
    headOf(s, _h);
    sound.play('crunch', _h);
    const r = feedHorse(rider, { horseId: s.id, owned: s.owned, donkey: s.donkey, kind, day: day() });
    floatHearts(_h.clone(), r.hearts);
    save();
    const who = short(s.name), what = kind === 'carrot' ? 'the carrot' : 'the apple';
    let line;
    if (s.donkey && kind === 'carrot') line = `${who} LOVES carrots!`;
    else line = `${who} munches ${what}. Yum!`;
    if (r.counted && r.after > r.before) line += r.full ? ` ${who} loves you all the way: ${BOND.hearts} of ${BOND.hearts} hearts! Now ${who} comes faster to your whistle` : ` ${r.after} of ${BOND.hearts} hearts`;
    else if (r.plenty) line += ` ${who} has had plenty of treats today: the hearts grow again tomorrow`;
    hud.toast(line, 'good');
    F.fed = { key: s.key, kind, hearts: r.hearts, counted: r.counted, after: r.after, at: performance.now() };
    buttonKey = '';   // (the count on the button)
    return true;
  };

  // ── A NICKER, AT FULL HEARTS ─────────────────────────────────────────────────────────────────────────────────────
  const nick = new Map();   // key -> { armed, last }
  function nickerStep(p) {
    if (!p || p.mode !== 'foot') return;
    const now = performance.now();
    for (const s of allSpots) {
      if (!s.owned || !s.id || !bondOf(rider, s.id).full) continue;
      headOf(s, _h);
      const d = Math.hypot(_h.x - p.position.x, _h.z - p.position.z);
      // (met for the first time this ride: armed only if the rider is a way off, so a horse right there doesn't nicker)
      let n = nick.get(s.key); if (!n) nick.set(s.key, n = { armed: d > FEED.nickerAway, last: -1e9 });
      if (d > FEED.nickerAway) n.armed = true;
      else if (n.armed && d < FEED.nickerNear && now - n.last > FEED.nickerGap * 1000) { n.armed = false; n.last = now; sound.play('nicker', _h); F.nickered = { key: s.key, at: now }; }
    }
  }

  // ── EACH FRAME ───────────────────────────────────────────────────────────────────────────────────────────────────
  F.update = (dt, { busy = false } = {}) => {
    const p = busy ? null : P();   // (busy: inside the cabin or at a counter: no tree to pick, no horse to feed)
    treesStep(dt);
    treePrompt(p);
    targetStep(p);
    button();
    nickerStep(p);
    heartsStep(dt);
    const pl = P(); if (pl) { const id = ridden(rider); pl.eager = !!id && bondOf(rider, id).full; }   // (full hearts: comes faster to the whistle)
  };
  F.state = () => ({ trees: trees.map((t) => ({ id: t.id, x: +t.x.toFixed(1), z: +t.z.toFixed(1), apples: t.shown, left: applesLeft(rider, t.id, day()) })), drawn: mesh ? mesh.count : 0,
    target: F.target ? { key: F.target.key, name: F.target.name, kind: F.target.kind, dist: +F.target.dist.toFixed(2) } : null, prompt: F.prompt, hearts: hearts.length,
    fed: F.fed || null, nickered: F.nickered || null, sounds: sound.played.slice(), near: nearSpots.map((x) => ({ key: x.s.key, d: +x.d.toFixed(2) })) });
  F.dispose = () => {
    if (tools && tools.treat) tools.treat(null);
    for (const h of hearts) { h.sp.removeFromParent(); h.sp.material.dispose(); }
    hearts.length = 0;
    if (mesh) { mesh.removeFromParent(); mesh.dispose(); }
    appleGeo.dispose(); appleMat.dispose();
  };
  return F;
}
