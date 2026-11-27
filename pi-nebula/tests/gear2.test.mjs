// THE LANDING GEAR'S LOOK (the game's maker, 2026-11-26: "The ship would look a lot better if none of this was here and
// you could just see the landing gear. We should just have doors that slide in place. Its fine if the landing gear is
// kind of magic and folds into itself"; "I don't see front landing gear on the miner ship"): kit/ships/gear-plan.js,
// the hull data's wells and doors (kit/ships/*-built.hull.js, made by ~/pw/space-math/rigs/gear-2/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEGS, LEG, FEET, DOOR, legPlan, kitLeaves, doorSlide, gearOrder } from '../kit/ships/gear-plan.js';
import { aimPoint } from '../kit/leafaim.js';
import * as EXPLORER from '../kit/ships/explorer-built.hull.js';
import * as MINER from '../kit/ships/miner-built.hull.js';
import * as MEDIC from '../kit/ships/medic-built.hull.js';

const HULLS = { explorer: EXPLORER, miner: MINER }, eps = 1e-9;
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('every ship stands on legs fore and aft, and on both sides aft', () => {
  for (const [ship, feet] of Object.entries(FEET)) {
    assert.ok(feet.some(([, z]) => z > 2), ship + ': a leg well forward of its middle');
    assert.ok(feet.some(([x, z]) => z < -2 && x > 0.5) && feet.some(([x, z]) => z < -2 && x < -0.5), ship + ': a leg aft on each side');
  }
  // (the Medic's and the Hauler's feet as their own data has them)
  for (const [name, W] of Object.entries(MEDIC.WELLS)) {
    const x = (W.x[0] + W.x[1]) / 2, z = (W.z[0] + W.z[1]) / 2;
    for (const s of [1, -1]) assert.ok(FEET.medic.some(([fx, fz]) => Math.abs(fx - s * x) < 0.05 && Math.abs(fz - z) < 0.05), 'the Medic\'s ' + name + ' legs');
  }
  const at = JSON.parse(read('kit/ships/hauler-built.js').match(/export const GEAR = \{ speed: [\d.]+, at: (\{[^}]*\}) \}/)[1].replace(/'/g, '"'));
  for (const [x, z] of Object.values(at)) assert.ok(FEET.hauler.some(([fx, fz]) => fx === x && fz === z), 'the Hauler\'s leg at ' + x + ', ' + z);
});

test('the gear\'s coverings are gone: no gear pods, every leg in a well of its own cut in the hull', () => {
  for (const [ship, H] of Object.entries(HULLS)) {
    for (const [which, L] of Object.entries(LEGS[ship].legs)) {
      const W = H.WELLS[which], D = H.DOORS[which];
      assert.ok(W && !W.bay && W.rim.length > 0, `${ship} ${which}: a well with its rim`);
      assert.ok(D && D.length === 2 && D.every((h) => h.polys.length > 0), `${ship} ${which}: two doors cut from the skin`);
      const [mn, mx] = W.box;
      assert.ok(mx[1] - L.top - 0.02 < 1e-3 && mn[0] <= L.at[0] && L.at[0] <= mx[0] && mn[2] <= L.at[1] && L.at[1] <= mx[2], `${ship} ${which}: the well round where the leg joins the hull`);
    }
    assert.deepEqual(Object.keys(H.WELLS).sort(), Object.keys(LEGS[ship].legs).sort(), ship + ': a well for each leg and no other');
  }
  // the old pods' code is gone from the shared kit
  assert.doesNotMatch(read('kit/ships/built-common.js'), /export function bayPod|export function bayDoors/);
});

// (the hull's skin as the game has it, the wells cut: every face over a point (x, z), low to high. Inside the hull: over
// its lowest skin and under its highest (the hull is shells that overlap, a block's roof inside the body's: counting
// faces over a point cannot tell; the legs live low in it, where this holds))
const skinOf = (H) => {
  const pb = Buffer.from(H.HULL.pos, 'base64'), P = Float32Array.from(new Int16Array(pb.buffer, pb.byteOffset, pb.length / 2), (v) => v / H.Q);
  const tb = Buffer.from(H.HULL.tris, 'base64'), T = new Uint16Array(tb.buffer, tb.byteOffset, tb.length / 2), C = 0.25, cells = new Map(), memo = new Map();
  for (let i = 0; i < T.length; i += 3) {
    const xs = [0, 1, 2].map((j) => P[T[i + j] * 3]), zs = [0, 1, 2].map((j) => P[T[i + j] * 3 + 2]);
    for (let cx = Math.floor(Math.min(...xs) / C); cx <= Math.floor(Math.max(...xs) / C); cx++) for (let cz = Math.floor(Math.min(...zs) / C); cz <= Math.floor(Math.max(...zs) / C); cz++) {
      const k = cx + ',' + cz; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i);
    }
  }
  return (x, z) => {
    const key = Math.round(x * 400) + ',' + Math.round(z * 400); if (memo.has(key)) return memo.get(key);
    const hs = [];
    for (const i of cells.get(Math.floor(x / C) + ',' + Math.floor(z / C)) || []) {
      const a = T[i] * 3, b = T[i + 1] * 3, c = T[i + 2] * 3;
      const d = (P[b + 2] - P[c + 2]) * (P[a] - P[c]) + (P[c] - P[b]) * (P[a + 2] - P[c + 2]); if (Math.abs(d) < 1e-12) continue;
      const l1 = ((P[b + 2] - P[c + 2]) * (x - P[c]) + (P[c] - P[b]) * (z - P[c + 2])) / d, l2 = ((P[c + 2] - P[a + 2]) * (x - P[c]) + (P[a] - P[c]) * (z - P[c + 2])) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
      hs.push(l1 * P[a + 1] + l2 * P[b + 1] + l3 * P[c + 1]);
    }
    hs.sort((p, q) => p - q); memo.set(key, hs); return hs;
  };
};
const inside = (hs, y) => hs.length > 1 && y > hs[0] + 0.01 && y < hs[hs.length - 1] - 0.01;
// (a shut door's skin over (x, z): the height of its faces there, or null)
const doorSkin = (halves) => (x, z) => {
  let y = null;
  for (const h of halves) for (const poly of h.polys) for (let i = 1; i + 1 < poly.length; i++) {
    const [A, B, C] = [poly[0], poly[i], poly[i + 1]], d = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]); if (Math.abs(d) < 1e-12) continue;
    const l1 = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / d, l2 = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / d, l3 = 1 - l1 - l2;
    if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
    const v = l1 * A[1] + l2 * B[1] + l3 * C[1]; y = y == null ? v : Math.max(y, v);
  }
  return y;
};
const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), mul = (a, k) => a.map((v) => v * k);
const unit = (a) => mul(a, 1 / Math.hypot(...a)), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const ring = (c, d, r, n = 8) => {
  const u = unit(cross(Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], d)), v = cross(d, u);
  return Array.from({ length: n }, (_, i) => add(c, add(mul(u, Math.cos(i * Math.PI / 4) * r), mul(v, Math.sin(i * Math.PI / 4) * r))));
};
const ease = (t) => t * t * (3 - 2 * t);
// every part's points as drawn shut (built-common.js strutLeg's sizes: the cylinder's collars, the knuckle's drum and
// its collars, the pad's corners, each brace's eye and sleeve), the ship's frame: [leaf, point, what]
function partPoints(G, L) {
  const pts = [], a = G.line.a, d = G.dir, K = LEG.knuckle;
  G.stages.forEach((s, k) => {
    const [s0, s1] = s.span(G.length);
    for (const t of [s0, (s0 + s1) / 2, s1]) for (const q of ring(add(a, mul(d, t)), d, s.r + (k === 0 ? 0.05 : 0.03))) pts.push([`stage ${k}`, q, `stage ${k}`]);
  });
  const last = `stage ${G.n - 1}`, sk = G.length - G.kneeAt;
  for (const t of [sk - K.h / 2 - 0.05, sk, sk + K.h / 2 + 0.05]) for (const q of ring(add(a, mul(d, t)), d, G.rk + 0.03)) pts.push([last, q, 'the knuckle']);
  for (const sx of [1, -1]) for (const sz of [1, -1]) for (const y of [0, LEG.pad]) pts.push([G.padLevel ? 'pad' : last, [G.foot[0] + sx * L.pad[0] / 2, G.foot[1] + y, G.foot[2] + sz * L.pad[1] / 2], 'the pad']);
  for (const B of G.braces) {
    const k0 = G.knee, bd = unit(sub(k0, B.from)), l0 = Math.hypot(...sub(k0, B.from));
    B.stages.forEach((s, k) => { const [s0, s1] = s.span(l0); for (const t of [Math.max(s0, 0), (s0 + s1) / 2, Math.min(s1, l0 - G.rk * 0.7)]) for (const q of ring(add(B.from, mul(bd, t)), bd, s.r + 0.03)) pts.push([`brace ${B.name} ${k}`, q, `the ${B.name} brace`]); });
    if (B.track) { const h = B.r + LEG.carriage; for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) pts.push([`brace ${B.name} 0`, add(B.from, [sx * h, sy * h, sz * h]), `the ${B.name} brace's mount`]); }
  }
  return pts;
}
const DECKS = { explorer: EXPLORER.DOOR.sill, miner: MINER.DECK };
// a leaf's point as the game poses it (the leaf as the kit is handed it, in the piece's frame), t of the way up
const posed = (leaf, p, t, deck) => {
  const q = [p[0], p[1] - deck, p[2]], e = ease(t), r = leaf.aim ? aimPoint(leaf.aim, q, e) : add(q, mul(leaf.slide, e));
  return [r[0], r[1] + deck, r[2]];
};

test('the kit is handed the plan\'s leaves in the frame it draws them in (each leg drawn with its deck at 0)', () => {
  const src = read('kit/ships/built-common.js');
  assert.match(src, /const G = legPlan\(L, floor\), deck = -dk\(V3\(0, 0, 0\)\)\.y/, 'strutLeg finds the deck it draws in');
  assert.match(src, /kitLeaves\(G, deck\)/, 'and hands the kit the plan\'s leaves lowered by it');
  for (const [ship, S] of Object.entries(LEGS)) for (const [which, L] of Object.entries(S.legs)) {
    const G = legPlan(L, S.floor), K = kitLeaves(G, DECKS[ship]), name = `${ship} ${which}`;
    // (lowered: a stage's line starts at the hip less the deck; a brace's at its mount less the deck)
    const s0 = K.find((q) => q.part === 'stage 0');
    assert.ok(Math.abs(s0.aim.a[1] - (G.line.a[1] - DECKS[ship])) < 1e-9, name + ': its hip lowered by the deck');
    for (const B of G.braces) assert.ok(Math.abs(K.find((q) => q.part === `brace ${B.name} 0`).aim.a[1] - (B.from[1] - DECKS[ship])) < 1e-9, `${name}: its ${B.name} brace's mount lowered by the deck`);
  }
});

test('each leg, F-16 fashion: leaning out, a knuckle low on it, fat round braces coming in at angles, a broad pad', () => {
  // (the least angle each leg's braces meet it at: as wide as its hull leaves room for. The Miner's back legs stand on a
  // stern block 1 m wide and 1.2 m long, every mount on it, and lean out 28 degrees: their braces come down from its
  // outboard lip, 13 to 15 degrees off the leg; its front legs' wells end 1 m ahead and behind, where the belly is high;
  // the Explorer's back wells end short of a gap in its hull's skin just ahead of them, their fore braces 26 to 29)
  const LEAST = { 'explorer nose': 40, 'explorer port': 26, 'explorer starboard': 26, 'miner nose port': 27, 'miner nose starboard': 27, 'miner port': 12, 'miner starboard': 12 };
  for (const [ship, S] of Object.entries(LEGS)) for (const [which, L] of Object.entries(S.legs)) {
    const G = legPlan(L, S.floor), name = `${ship} ${which}`;
    assert.ok(G.n >= 2 && G.n <= 3, `${name}: ${G.n} stages to its strut`);
    if (L.splay) assert.ok(G.lean >= 20, `${name}: leaning out ${G.lean.toFixed(0)} degrees`);
    assert.ok((G.knee[1] - S.floor) / (G.hip[1] - S.floor) <= 0.36, name + ': its knuckle low on it');
    assert.ok(Math.max(...L.pad) >= 1.5 * 2 * L.r, name + ': a pad broader than the leg');
    assert.ok(G.braces.length >= 2, name + ': two braces');
    for (const B of G.braces) {
      assert.ok(B.r >= 0.5 * L.r, `${name}: its ${B.name} brace fat (${B.r} m, the cylinder ${L.r})`);
      assert.ok(B.stages.at(-1).r >= L.r / 3, `${name}: its ${B.name} brace's rod no thinner than a third of the leg`);
      assert.ok(B.angle >= LEAST[name], `${name}: its ${B.name} brace comes in at ${B.angle.toFixed(0)} degrees to the leg`);
      assert.ok(B.stages.length <= 5, `${name}: its ${B.name} brace in ${B.stages.length} stages (the Miner's front wells are short: up to five)`);
    }
  }
});

test('each leg folds as the game draws it: joined, every rod in its sleeve, through the hull only by its well, and up behind its shut doors', () => {
  const bad = [];
  for (const [ship, S] of Object.entries(LEGS)) {
    const H = HULLS[ship], skin = skinOf(H), deck = DECKS[ship];
    for (const [which, L] of Object.entries(S.legs)) {
      const G = legPlan(L, S.floor), name = `${ship} ${which}`, [mn, mx] = G.well, kit = Object.fromEntries(kitLeaves(G, deck).map((q) => [q.part, q]));
      const W = H.WELLS[which].box, doors = doorSkin(H.DOORS[which]);
      assert.ok([0, 1, 2].every((k) => Math.abs(W[0][k] - mn[k]) < 1e-3 && Math.abs(W[1][k] - mx[k]) < 1e-3), name + ': its well cut where its plan says');
      // (in its mouth: over the hole cut in the skin, the doors' own outline, give or take half a centimetre)
      const inMouth = (q) => [[0, 0], [0.005, 0], [-0.005, 0], [0, 0.005], [0, -0.005]].some(([dx, dz]) => doors(q[0] + dx, q[2] + dz) != null);
      // (under its roof: the hull rig's, over each piece of its mouth, under the hull's own top)
      const roof = doorSkin([{ polys: H.WELLS[which].roof }]), ceil = (q) => roof(q[0], q[2]) ?? mx[1];
      const pts = partPoints(G, L), note = new Map(), say = (k, v) => { if (!note.has(k)) note.set(k, v); };
      // (a line's stages: each in the one it slides in, all the way)
      const lineStages = [['stage', G.stages, G.line.a, G.dir, G.length], ...G.braces.map((B) => [`brace ${B.name}`, B.stages, B.from, unit(sub(G.knee, B.from)), Math.hypot(...sub(G.knee, B.from))])];
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        for (const [part, p, what] of pts) {
          const q = posed(kit[part], p, t, deck);
          if (t === 0 && Math.hypot(...sub(q, p)) > 1e-9) say(`${what} not where the plan stands it`, q);
          if (inside(skin(q[0], q[2]), q[1]) && !(inMouth(q) && q[1] < ceil(q) + 0.01)) say(`${what} through the hull outside its well at ${i}%`, q);
          if (t === 1) {
            if (!(inMouth(q) && q[1] < ceil(q) + 0.01)) say(`${what} up outside its well`, q);
            const dy = doors(q[0], q[2]); if (dy != null && q[1] < dy + 0.01) say(`${what} up under its shut doors`, q);
          }
        }
        // (joined: each brace's rod ends where the knuckle is, as the leg's piston carries it)
        for (const B of G.braces) {
          const k0 = G.knee, rodEnd = posed(kit[`brace ${B.name} ${B.stages.length - 1}`], k0, t, deck), knuckle = posed(kit[`stage ${G.n - 1}`], k0, t, deck);
          if (Math.hypot(...sub(rodEnd, knuckle)) > 1e-6) say(`the ${B.name} brace off the knuckle at ${i}%`, rodEnd);
        }
        for (const [stem, st, a0, d0, l0] of lineStages) for (let k = 1; k < st.length; k++) {
          const ax = (j, s) => posed(kit[`${stem} ${j}`], add(a0, mul(d0, s)), t, deck);
          const [o0, o1] = st[k - 1].span(l0), [n0, n1] = st[k].span(l0), A = ax(k - 1, o0), Bq = ax(k - 1, o1), u = unit(sub(Bq, A));
          for (const s of [n0, n1]) { const q = ax(k, s), off = sub(sub(q, A), mul(u, dot(sub(q, A), u))); if (Math.hypot(...off) > 1e-6) say(`${stem} ${k} off its sleeve's line at ${i}%`, q); }
          const lap = dot(sub(ax(k - 1, o1), A), u) - dot(sub(ax(k, n0), A), u);
          if (lap < LEG.overlap - 1e-6) say(`${stem} ${k} only ${lap.toFixed(3)} m in the one it slides in at ${i}%`, A);
        }
      }
      // (standing: the pad level on the floor)
      for (const [, p, what] of pts) if (what === 'the pad' && Math.abs(posed(kit[pts.find((q) => q[2] === 'the pad')[0]], p, 0, deck)[1] - p[1]) > 1e-9) say('the pad off the floor', p);
      // (the still mount blocks: in the well's mouth, over its shut doors)
      for (const B of G.braces) if (!B.track) {
        const h = B.r + 0.06;
        for (const sx of [1, -1]) for (const sz of [1, -1]) { const q = add(B.from, [sx * h, -h, sz * h]), dy = doors(q[0], q[2]); if (!inMouth(q) || (dy != null && q[1] < dy + 0.005)) say(`the ${B.name} brace's mount block under its shut doors or outside its well`, q); }
      }
      for (const [k, q] of note) bad.push(`${name}: ${k} (${q.map((v) => v.toFixed(2))})`);
    }
  }
  assert.equal(bad.join(' | '), '', 'the fold as drawn');
});

test('each well inside the hull: its roof over its mouth\'s own outline, under the hull\'s top, its walls up to it', () => {
  const bad = [];
  for (const [ship, S] of Object.entries(LEGS)) {
    // (the hull with its wells' doors shut: the doors are its skin there)
    const skin0 = skinOf(HULLS[ship]), shut = Object.values(HULLS[ship].DOORS).map((d) => doorSkin(d));
    const skin = (x, z) => [...skin0(x, z), ...shut.map((f) => f(x, z)).filter((v) => v != null)].sort((p, q) => p - q);
    for (const which of Object.keys(S.legs)) {
      const Wl = HULLS[ship].WELLS[which], name = `${ship} ${which}`;
      assert.ok(Wl.roof && Wl.roof.length === HULLS[ship].DOORS[which].reduce((t, h) => t + h.polys.length, 0), name + ': a roof piece over each piece of its mouth');
      assert.ok(Wl.rimTop && Wl.rimTop.length === Wl.rim.length, name + ': its walls\' heights');
      // (each roof piece's corners drawn 2 cm in, and its middle, under the hull's top)
      for (const P of Wl.roof) {
        const c = [0, 1, 2].map((k) => P.reduce((t, p) => t + p[k], 0) / P.length);
        for (const q of [c, ...P.map((p) => { const d = Math.hypot(p[0] - c[0], p[2] - c[2]) || 1, k = Math.min(0.02, d) / d; return p.map((v, j) => v + (c[j] - v) * k); })]) {
          // (the hull's top there, the highest within a centimetre: a point on the seam between two faces)
          const top = Math.max(...[[0, 0], [0.01, 0], [-0.01, 0], [0, 0.01], [0, -0.01]].map(([dx, dz]) => { const hs = skin(q[0] + dx, q[2] + dz); return hs.length ? hs[hs.length - 1] : -Infinity; }));
          if (top < q[1] + 0.01) bad.push(`${name}: its roof out of the hull at (${q.map((v) => v.toFixed(2))})`);
        }
      }
    }
  }
  assert.equal(bad.join(' | '), '', 'the wells in the hull');
});

test('the doors slide apart, clear of the well\'s mouth and into the hull, and come back flush', () => {
  for (const [ship, H] of Object.entries(HULLS)) for (const [which, halves] of Object.entries(H.DOORS)) {
    const box = H.WELLS[which].box;
    halves.forEach((h, i) => {
      const S = doorSlide(h), k = h.axis, half = h.polys.flat().map((p) => p[k]), name = `${ship} ${which} door ${i}`;
      assert.equal(h.len.toFixed(3), (box[1][k] - box[0][k]).toFixed(3), name + ': its length the well\'s');
      // (slid open, every point of it is past the mouth's edge on its own side)
      const moved = half.map((v) => v + S[k]);
      const dir = h.one || h.dir;
      assert.ok(dir > 0 ? Math.min(...moved) >= box[1][k] - 1e-6 : Math.max(...moved) <= box[0][k] + 1e-6, name + ': clear of the mouth');
      // (and into the hull: the slide's part across the line points against the skin's outward normal)
      const across = S.map((v, j) => (j === k ? 0 : v)), into = -(across[0] * h.n[0] + across[1] * h.n[1] + across[2] * h.n[2]);
      assert.ok(into > 0.5 * (h.sink ?? DOOR.sink), name + ': it sinks into the hull as it goes');
    });
  }
});

test('in turn: up the legs fold first, then the doors shut; down the doors open first, then the legs come down', () => {
  const legs = [{ t: 0 }, { t: 0 }], doors = [{ t: 0 }, { t: 0 }], log = [];
  const move = (list, mode) => { let m = false; for (const D of list) { const t = mode === 'open' ? Math.min(1, D.t + 0.25) : Math.max(0, D.t - 0.25); if (t !== D.t) { D.t = t; m = true; } } if (m) log.push(list === legs ? 'legs' : 'doors'); return m; };
  while (gearOrder(legs, doors, true, move));
  assert.deepEqual(log, ['legs', 'legs', 'legs', 'legs', 'doors', 'doors', 'doors', 'doors'], 'up: the legs all the way, then the doors');
  assert.ok(legs.every((D) => D.t === 1) && doors.every((D) => D.t === 1));
  log.length = 0;
  while (gearOrder(legs, doors, false, move));
  assert.deepEqual(log, ['doors', 'doors', 'doors', 'doors', 'legs', 'legs', 'legs', 'legs'], 'down: the doors all the way open, then the legs');
});
