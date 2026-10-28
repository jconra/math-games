// THE PEN BEHIND THE STABLE (HORSES.md step 8): a few horses of every coat on the far side of the stable from the road,
// inside a corral fence with a corral gate (decor: the planting stroke 'horsepen' and its gate in
// models/town/planting.json, drawn, blocking walkers and swinging open by world/objects/fences.js like the town's other
// fences). Each time the rider has been out of town (further than PENPLAN.away from the pen: past every job in town) a
// new few take their places, the moment none of them can be seen (src/sight.js, the governor's rule: nothing changes
// in view). They can be bought at the stable's counter (its pen rows, below), as many as the rider likes; a horse bought
// is kept with its whole coat (src/mounts.js), leaves the pen at once (the counter covers the screen, and the pen
// can't be seen from the stable's door) and is ridden.
//
// The horses are made once (src/actors/horses.js) and only ever given new coats and sizes (uniforms and a scale), so a
// new visit builds nothing and nothing piles up. They amble about inside, graze, look round, and stand still when far
// off (PENPLAN.sleep).
//
//   const PN = makeHorsePen({ W, animals, rider, camera, player: () => P, shadows })
//   PN.update(dt)     each frame (while riding)
//   PN.shop           the stable counter's extra rows (src/shop.js extra.stable): html(), click(what, id)
//   PN.treatSpots()   the pen's horses a treat can be given to (src/feeding.js)
//   PN.dev            { roll(seed) a new few now (rigs; seen or not), visit() a new visit due, state() }
//   PN.dispose()
import * as THREE from 'three';
import { makeHorse, HORSE_KIND, onHorseDial } from './actors/horses.js';
import { makeSight } from './sight.js';
import { rollPenHorse, PENPLAN } from './horsepenplan.js';
import { spend, saveRider } from './save.js';
import { ownedHorses, rideHorse } from './mounts.js';
import { handsOf, handsText } from './catalog.js';

export const PEN_STROKE = 'horsepen';
// (the pen as laid in models/town/planting.json, if the world's fence plan doesn't have it: the paddock behind the stable
// on the main street, a corral fence round three sides and the stable's back wall the fourth, so its run is left open:
// the last corner back to the first goes along that wall)
const FALLBACK = [[-57.5, -189.8], [-74, -190], [-74, -163.5], [-72, -152.5], [-39.5, -155], [-42, -189.5], [-43.8, -189.8]];
const IDLES = [['Idle', 3], ['Eating', 4], ['Idle_Headlow', 2], ['Idle_2', 1.5], ['LookLeft', 1.2], ['LookRight', 1.2], ['Nod', 0.8], ['EarFlick', 1], ['HeadShake', 0.6]];
const ONCE = new Set(['LookLeft', 'LookRight', 'Nod', 'EarFlick', 'HeadShake']);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#e2ad4c"/><circle cx="12" cy="12" r="7.4" fill="none" stroke="#a8742a" stroke-width="1.6"/></svg>';

// the pen's corners: the fence plan's stroke (world/valley.js FENCE.plan), else the laid corners
function penCorners(W) {
  const plan = W && W.V && W.V.FENCE && W.V.FENCE.plan;
  const run = plan && plan.runs && plan.runs.find((R) => R.stroke && R.stroke.id === PEN_STROKE);
  const pts = run ? run.pts.map((p) => [p[0], p[1]]) : FALLBACK.slice();
  if (pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.5) pts.pop();   // (a closed loop: its last corner is its first)
  return pts;
}
const inside = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const toEdge = (P, x, z) => { let d = Infinity; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, az] = P[j], [bx, bz] = P[i], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)); d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return d; };

// a small picture of the horse in its coat's colours (the counter's rows): side on, its points or socks, a paint's white
function horseIcon(r) {
  const body = r.base || '#7a3f20', mane = r.mane || '#15100d', white = '#e8e2d6', grey = (r.grey || 0) > 0.3;
  const fill = grey ? '#cfcac4' : body, pt = r.points === 'black' ? '#1b1511' : fill;
  const legs = r.legs || {}, legCol = (k) => (legs[k] && legs[k] !== 'none' ? white : pt);
  const leg = (x, k) => `<rect x="${x}" y="24" width="3.2" height="9" fill="${fill}"/><rect x="${x}" y="31" width="3.2" height="9" fill="${legCol(k)}"/>`;
  const paint = r.pinto && r.pinto !== 'none' ? `<ellipse cx="25" cy="21" rx="7" ry="4.6" fill="${white}"/>` : '';
  const face = r.face && r.face !== 'none' ? `<path d="M55.2 7.4 L57.6 10.6" stroke="${white}" stroke-width="1.6" stroke-linecap="round"/>` : '';
  const stripe = (r.dorsal || 0) > 0.3 ? `<path d="M16 13.6 Q28 12.2 40 13.6" stroke="${mane}" stroke-width="1.3" fill="none"/>` : '';
  return `<svg viewBox="0 0 64 44" width="64" height="44" aria-hidden="true" style="flex:none;display:block"><ellipse cx="32" cy="26" rx="31" ry="17" fill="#f3e6c8" opacity="0.14"/>`
    + `<path d="M13 17 Q8 24 10 34" stroke="${mane}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`
    + leg(16, 'HR') + leg(21, 'HL') + leg(36, 'FR') + leg(40.5, 'FL')
    + `<ellipse cx="28" cy="20" rx="16" ry="7.5" fill="${fill}"/><path d="M38 16 L46 5 L51 7.5 L45 21 Z" fill="${fill}"/><path d="M46 5 L50.5 2.4 L59 9.2 L57 12.6 L50.5 10.4 Z" fill="${fill}"/>`
    + `<path d="M47.5 4.4 L48.6 0.6 L50.2 3.6 Z" fill="${fill}"/><path d="M45.6 5.6 Q42 11 39 16.4" stroke="${mane}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    + paint + stripe + face + `</svg>`;
}

export function makeHorsePen({ W, animals, rider, camera, player, shadows = true }) {
  const P = penCorners(W);
  const cx = P.reduce((a, p) => a + p[0], 0) / P.length, cz = P.reduce((a, p) => a + p[1], 0) / P.length;
  const R0 = Math.max(...P.map((p) => Math.hypot(p[0] - cx, p[1] - cz)));
  const x0 = Math.min(...P.map((p) => p[0])), x1 = Math.max(...P.map((p) => p[0])), z0 = Math.min(...P.map((p) => p[1])), z1 = Math.max(...P.map((p) => p[1]));
  const sight = makeSight({ W, camera });
  // (the most horses the pen holds, all made at once; the governor's horse dial says how many show: pen, and penFar, all
  // in their far look; a horse comes or goes only while the pen can't be seen. Without a governor: the tier's)
  const N = Math.max(...Object.values(PENPLAN.horses));
  let shown = 0, wantShown = PENPLAN.horses[W.tier] || PENPLAN.horses.normal, dialFar = false, lookName = W.tier;
  const group = new THREE.Group(); group.name = 'horse-pen'; W.scene.add(group);
  const slots = [];
  let ready = false, disposed = false, seed = 1 + Math.floor(Math.random() * 99999), due = false, visits = 0, out = false, farOnly = false;
  const FAR = new THREE.Vector3(0, 1e4, 0);   // (dev.far: every pen horse in its far look, for measuring)
  const rnd = (a, b) => a + Math.random() * (b - a);

  // a spot inside the fence, clear of the other horses (and of `but`, the horse looking)
  function spot(but = null) {
    for (let k = 0; k < 60; k++) {
      const x = rnd(x0, x1), z = rnd(z0, z1);
      if (!inside(P, x, z) || toEdge(P, x, z) < PENPLAN.inset || (W.blocked && W.blocked(x, z))) continue;   // (a big paddock: clear of a tree, a rock or a puddle in it)
      if (slots.some((s) => s !== but && !s.sold && Math.hypot(s.x - x, s.z - z) < 3.2)) continue;
      return [x, z];
    }
    return [cx, cz];
  }
  function place(s) {
    const a = s.h.a, sz = a.size || 1, sn = Math.sin(s.heading), cs = Math.cos(s.heading);
    const y = W.heightAt(s.x, s.z), yf = W.heightAt(s.x + sn * sz, s.z + cs * sz), yb = W.heightAt(s.x - sn * sz, s.z - cs * sz);
    a.root.position.set(s.x, Math.max(y, (yf + yb) / 2), s.z);
    a.root.rotation.set(-Math.atan2(yf - yb, 2 * sz), s.heading, 0, 'YXZ');
  }
  // a new few: each slot a new horse from the pool (a new coat and size on the same horse), at a new spot
  function roll() {
    const taken = ownedHorses(rider).map((x) => x.name);
    for (const s of slots) {
      const d = rollPenHorse(seed * 37 + s.i, { taken }); taken.push(d.name);
      s.data = d; s.sold = false; s.h.setRecipe(d.recipe); s.h.setSize(d.size);
      [s.x, s.z] = spot(s); s.heading = rnd(-Math.PI, Math.PI); s.mode = 'stand'; s.t = rnd(0, 3); s.idle = 'Idle';
      s.h.a.root.visible = !s.off; s.h.a.play('Idle', { fade: 0 }); s.h.a.mixer.update(Math.random() * 3); place(s);
    }
    seed++; due = false; visits++;
  }
  // how many show (the dial's pen): the first `wantShown` of them (a horse sold stays out till the next visit)
  function applyShown() { shown = wantShown; for (const s of slots) { s.off = s.i >= shown; s.h.a.root.visible = !s.off && !s.sold; } }
  animals.need(HORSE_KIND).then(() => {
    if (disposed) return;
    for (let i = 0; i < N; i++) { const h = makeHorse(animals, { tier: lookName, shadows }); group.add(h.a.root); slots.push({ i, h, x: cx, z: cz, heading: 0, mode: 'stand', t: 0, idle: 'Idle', data: null, sold: false, asleep: false, off: i >= wantShown }); }
    roll(); applyShown(); ready = true;   // (at load: how many show is set at once)
  }).catch((e) => console.warn('the pen: no horses', e));

  // nothing of the pen in view: every horse (and every spot one stood on) and the pen's middle and corners
  const unseen = () => slots.every((s) => sight.unseen(s.x, s.z, undefined, 1.8)) && sight.unseen(cx, cz, undefined, 2) && P.every(([x, z]) => sight.unseen(x, z, undefined, 1));

  // one horse, a step: standing (an idle now and then, a glance once), or ambling to a spot
  const _cam = new THREE.Vector3();
  function step(s, dt, near) {
    const a = s.h.a;
    if (s.mode === 'stand') {
      s.t -= dt;
      if (s.t <= 0) {
        if (Math.random() < 0.45) { [s.tx, s.tz] = spot(s); s.mode = 'walk'; s.v = rnd(...PENPLAN.walk); }
        else { let t = Math.random() * IDLES.reduce((q, x) => q + x[1], 0), name = 'Idle'; for (const [n, w] of IDLES) if ((t -= w) <= 0) { name = n; break; } s.idle = a.actions[name] ? name : 'Idle'; s.t = ONCE.has(s.idle) ? a.actions[s.idle].getClip().duration + 0.3 : rnd(...PENPLAN.stand); }
      }
      if (s.mode === 'stand') a.play(s.idle, { fade: 0.4, once: ONCE.has(s.idle) });
    }
    if (s.mode === 'walk') {
      const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz), want = Math.atan2(dx, dz), diff = wrap(want - s.heading);
      s.heading = wrap(s.heading + Math.sign(diff) * Math.min(Math.abs(diff), 1.3 * dt));
      // (stops short of another horse, or of the rider, in the way)
      const sn = Math.sin(s.heading), cs = Math.cos(s.heading), ahead = (x, z, r) => { const ox = x - s.x, oz = z - s.z, f = ox * sn + oz * cs; return f > 0 && f < r && Math.abs(ox * cs - oz * sn) < 1.2; };
      const blocked = slots.some((o) => o !== s && !o.sold && ahead(o.x, o.z, 2.6 * (a.size || 1))) || (near && ahead(near.x, near.z, 2));
      if (d < 0.4 || blocked) { s.mode = 'stand'; s.t = rnd(...PENPLAN.stand); s.idle = 'Idle'; a.pace(0); }
      else {
        const v = Math.abs(diff) < 0.6 ? s.v : 0.25, nx = s.x + sn * v * dt, nz = s.z + cs * v * dt;
        if (inside(P, nx, nz) && toEdge(P, nx, nz) > PENPLAN.inset * 0.6) { s.x = nx; s.z = nz; } else { s.mode = 'stand'; s.t = 1; }
        a.pace(v);
      }
    }
    place(s);
  }

  // THE GOVERNOR'S HORSE DIAL (actors/horses.js horseDial): how many show, all in their far look or not, the look's
  // distances (called at once, before the horses are made, then at each change: those wait for the pen out of sight)
  const offDial = onHorseDial(W, (v) => {
    wantShown = Math.max(0, Math.min(N, Math.round(+v.pen || 0))); dialFar = !!v.penFar; lookName = v.look || lookName;
    for (const s of slots) s.h.setLook(lookName);
  });
  const PN = {
    get ready() { return ready; },
    update(dt) {
      if (!ready || disposed) return;
      const pl = player && player(), pos = pl && pl.position;
      // (out of town: one new visit a trip, its new few in the next time none can be seen; back in town (20 m inside the
      // line, so riding along it doesn't count twice) a later trip counts again)
      const dp = pos ? Math.hypot(pos.x - cx, pos.z - cz) : 0;
      if (!out && dp > PENPLAN.away) { out = true; due = true; } else if (out && dp < PENPLAN.away - 20) out = false;
      sight.view();
      if (due && unseen()) roll();
      if (wantShown !== shown && unseen()) applyShown();   // (the dial asked for more or fewer: only out of sight)
      camera.getWorldPosition(_cam);
      const near = pos && !(pl.onHorse) ? pos : null;
      for (const s of slots) {
        if (s.sold || s.off) continue;
        const far = Math.hypot(_cam.x - s.x, _cam.z - s.z) > PENPLAN.sleep;
        if (far) { if (!s.asleep) { s.asleep = true; s.h.look(_cam); } continue; }   // (asleep: still, in its far look)
        s.asleep = false;
        step(s, dt, near);
        s.h.a.update(dt);
        s.h.look(farOnly || dialFar ? FAR : _cam);
      }
    },
    // THE COUNTER'S PEN ROWS: each horse in the pen now, its picture, name, line, top speed and price
    shop: {
      html() {
        const list = slots.filter((s) => s.data && !s.sold && !s.off);
        if (!ready || !list.length) return '';
        let h = `<h3 class="bms-h">In the pen out back</h3>`;
        for (const s of list) {
          const d = s.data, cost = d.price, can = rider.gold >= cost;
          h += `<div class="bms-row">${horseIcon(d.recipe)}<div class="bms-what"><b>${esc(d.name)}</b><small>${esc(d.line)}</small><span class="bms-speed" title="Top speed"><b>${d.mph}</b> mph</span> <span class="bms-speed" title="Height at the shoulder (a hand is 4 inches)"><b>${handsText(handsOf({ kind: 'steed', size: d.size }))}</b> hands</span></div>`
            + `<div class="bms-act"><span class="bms-price">${COIN}<b>${cost}</b></span><button type="button" data-do="buy-pen" data-id="${s.i}" ${can ? '' : 'disabled'}>${can ? 'Buy' : `Need ${cost - rider.gold} more`}</button></div></div>`;
        }
        return h + `<p class="bms-tip">New horses come into the pen while you're out of town.</p>`;
      },
      click(what, id) {
        if (what !== 'buy-pen') return undefined;
        const s = slots.find((x) => String(x.i) === String(id)); if (!s || s.sold || !s.data) return { note: '' };
        const d = s.data;
        if (!spend(rider, d.price)) return { note: 'Not enough gold yet.' };
        const o = rider.owned || (rider.owned = {}), n = Math.max(1, Math.round(+o.penNext || 1)), mid = 'pen-' + n;
        o.penNext = n + 1;
        o.mounts = { ...(o.mounts || {}), [mid]: { name: d.name, line: d.line, coat: d.recipe, size: d.size, gallop: d.gallop, price: d.price, rarity: d.rarity, from: 'pen', at: Date.now() } };
        rideHorse(rider, mid); saveRider(rider);
        s.sold = true; s.h.a.root.visible = false;   // (out of the pen: it waits by the stable now, saddled if there is a saddle)
        const saddled = !!(o.saddle);
        return { note: saddled ? `${d.name} is yours, saddled up by the stable.` : `${d.name} is yours, waiting by the stable. You'll need a saddle to ride.`, bought: 'horse' };
      },
    },
    // THE HORSES A TREAT CAN BE GIVEN (src/feeding.js): each one in the pen and awake (near), its animal, and how it munches
    // (stops where it is, lowers its head: its Eating clip, then back to its ambling)
    treatSpots() {
      if (!ready) return [];
      const out = [];
      for (const s of slots) {
        if (s.sold || s.off || s.asleep || !s.data) continue;
        out.push({ key: 'pen:' + s.i, id: null, name: s.data.name, a: s.h.a, owned: false, donkey: false,
          eat: (sec) => { s.mode = 'stand'; s.idle = s.h.a.actions.Eating ? 'Eating' : 'Idle_Headlow'; s.t = sec; s.h.a.pace(0); return true; } });
      }
      return out;
    },
    dev: {
      roll(s) { if (s) seed = s; if (ready) roll(); return PN.dev.state(); },
      visit() { due = true; return due; },
      far(on) { farOnly = !!on; return farOnly; },
      state: () => ({ ready, seed, due, visits, out, shown, wantShown, dialFar, lookName, corners: P, centre: [cx, cz], horses: slots.map((s) => ({ i: s.i, name: s.data && s.data.name, coat: s.data && s.data.coatId, rarity: s.data && s.data.rarity, size: s.data && s.data.size, mph: s.data && s.data.mph, price: s.data && s.data.price, x: +s.x.toFixed(2), z: +s.z.toFixed(2), mode: s.mode, sold: s.sold, asleep: s.asleep, look: s.h.lookNow.coat })) }),
      seen: () => !unseen(),
    },
    dispose() { disposed = true; offDial(); for (const s of slots) s.h.dispose(); slots.length = 0; group.removeFromParent(); },
  };
  return PN;
}
