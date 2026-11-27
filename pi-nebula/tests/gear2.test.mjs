// THE LANDING GEAR'S LOOK (the game's maker, 2026-11-26: "The ship would look a lot better if none of this was here and
// you could just see the landing gear. We should just have doors that slide in place. Its fine if the landing gear is
// kind of magic and folds into itself"; "I don't see front landing gear on the miner ship"; 2026-11-27: "something like
// the F-16 landing gear. It goes out wider, and has a few cylinders that meet up"): kit/ships/gear-plan.js, the hull
// data's wells and doors (kit/ships/*-built.hull.js, made by ~/pw/space-math/rigs/gear-2/), and the legs and doors AS
// THEY ARE DRAWN: every vertex of every part, posed by the kit's own code (kit/layout.js leafAt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { register } from 'node:module';
import { homedir } from 'node:os';
import { LEGS, LEG, FEET, legPlan, kitLeaves, doorFolds, doorHalves, keptPieces, gearOrder, behindAngle } from '../kit/ships/gear-plan.js';
import { aimPoint, foldPoint, aimMatrix } from '../kit/leafaim.js';
import * as EXPLORER from '../kit/ships/explorer-built.hull.js';
import * as MINER from '../kit/ships/miner-built.hull.js';
import * as MEDIC from '../kit/ships/medic-built.hull.js';

const HULLS = { explorer: EXPLORER, miner: MINER }, eps = 1e-9;
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), mul = (a, k) => a.map((v) => v * k);
const unit = (a) => mul(a, 1 / Math.hypot(...a)), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const ease = (t) => t * t * (3 - 2 * t);

// (three.js, which the game loads from the web, for building the parts as the game draws them: from THREE_DIR, or a
// copy of the same version on this machine; without it the tests on what is drawn say so and are skipped)
const THREE_DIR = [process.env.THREE_DIR, homedir() + '/valehex/node_modules/three'].find((d) => d && existsSync(d + '/build/three.module.js'));
if (THREE_DIR) {
  const T = 'file://' + THREE_DIR + '/';
  register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { if (s === 'three') return { url: '${T}build/three.module.js', shortCircuit: true }; if (s.startsWith('three/addons/')) return { url: '${T}examples/jsm/' + s.slice(13), shortCircuit: true }; return n(s, c); }`));
}
const DRAWN = THREE_DIR ? false : 'three.js not found (set THREE_DIR): the legs and doors as drawn are NOT checked';

test('every ship stands on legs fore and aft, and on both sides aft', () => {
  for (const [ship, feet] of Object.entries(FEET)) {
    assert.ok(feet.some(([, z]) => z > 2), ship + ': a leg well forward of its middle');
    assert.ok(feet.some(([x, z]) => z < -2 && x > 0.5) && feet.some(([x, z]) => z < -2 && x < -0.5), ship + ': a leg aft on each side');
  }
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
      assert.ok(D && D.length === 2 && D.every((h) => h.polys.length > 0), `${ship} ${which}: its door cut from the skin`);
      const [mn, mx] = W.box, G = legPlan(L, LEGS[ship].floor);
      assert.ok([0, 1, 2].every((k) => Math.abs(W.box[0][k] - G.well[0][k]) < 1e-3 && Math.abs(W.box[1][k] - G.well[1][k]) < 1e-3), `${ship} ${which}: its well cut where its plan says`);
      assert.ok(mn[0] <= L.at[0] && L.at[0] <= mx[0] && mn[2] <= L.at[1] && L.at[1] <= mx[2], `${ship} ${which}: the well round where the leg joins the hull`);
    }
    assert.deepEqual(Object.keys(H.WELLS).sort(), Object.keys(LEGS[ship].legs).sort(), ship + ': a well for each leg and no other');
  }
  assert.doesNotMatch(read('kit/ships/built-common.js'), /export function bayPod|export function bayDoors/);
});

// THE LOOK, from behind, where a player stands (the coordinator's rulings of round five, after two critics: "the
// Explorer from behind is still one thin post"; "the Miner's back legs are single columns")
test('from behind each leg is braced: a support at a wide angle to it, meeting it low; thick; a broad pad', () => {
  const E = LEGS.explorer.legs, M = LEGS.miner.legs;
  for (const which of ['port', 'starboard']) {
    // (the Explorer's: one long support from inboard on the belly, 30 degrees or more from the leg as seen from behind,
    // meeting it about a quarter of its height over the foot; the foot out by a third of its height; the leg 1.5 times
    // round four's (0.2 m), its supports two thirds of that, its pad twice round four's (0.62 by 0.9 m); one support
    // from well ahead)
    const L = E[which], G = legPlan(L, 0), name = 'explorer ' + which;
    const inb = G.braces.filter((B) => Math.abs(B.from[0]) < Math.abs(G.hip[0]) - 0.3);
    assert.ok(inb.length === 1 && inb[0].behind >= 30, `${name}: one support from inboard, ${inb.map((B) => B.behind.toFixed(0))} degrees from the leg seen from behind`);
    assert.ok((G.knee[1] - 0) / (G.hip[1] - 0) <= 0.3, `${name}: they meet low (${((G.knee[1]) / G.hip[1]).toFixed(2)} of its height)`);
    assert.ok(G.out >= 0.33, `${name}: its foot out ${G.out.toFixed(2)} of its height`);
    assert.ok(L.r >= 1.5 * 0.2 - eps && G.braces.every((B) => B.r >= (2 / 3) * L.r - eps), name + ': thick, its supports two thirds of it');
    assert.ok(L.pad[0] * L.pad[1] >= 2 * 0.62 * 0.9 - eps, name + ': a pad twice round four\'s');
    const fore = G.braces.filter((B) => B.from[2] - G.knee[2] >= 1.2);
    assert.equal(fore.length, 1, name + ': one support from well ahead');
    assert.equal(G.braces.length, 2, name + ': two supports, not a balanced V');
  }
  for (const which of ['port', 'starboard']) {
    // (the Miner's back legs: every support 25 degrees or more from the leg seen from behind, about 60 percent of its
    // thickness, meeting it at the boot's top)
    const L = M[which], G = legPlan(L, LEGS.miner.floor), name = 'miner ' + which;
    for (const B of G.braces) {
      assert.ok(B.behind >= 25, `${name}: its ${B.name} support ${B.behind.toFixed(0)} degrees from the leg seen from behind`);
      assert.ok(B.r >= 0.55 * L.r && B.r <= 0.7 * L.r, `${name}: its ${B.name} support ${B.r} m against the leg's ${L.r}`);
    }
    assert.ok(G.braces.length >= 2 && G.braces.some((B) => Math.abs(B.from[0]) < Math.abs(G.hip[0])) && G.braces.some((B) => Math.abs(B.from[0]) > Math.abs(G.hip[0])), name + ': supports from either side, an A');
  }
  for (const which of ['nose port', 'nose starboard']) {
    // (the Miner's front legs: their supports' rods no thinner than half the column)
    const L = M[which], G = legPlan(L, LEGS.miner.floor);
    for (const B of G.braces) assert.ok(B.r * 0.8 >= 0.5 * L.r - eps, `miner ${which}: its ${B.name} support's rod ${(B.r * 0.8).toFixed(3)} m against the column's ${L.r}`);
  }
  // every leg leaning out, its knuckle low, a pad broader than the leg; left and right alike wherever the hull is
  for (const [ship, S] of Object.entries(LEGS)) for (const [which, L] of Object.entries(S.legs)) {
    const G = legPlan(L, S.floor), name = `${ship} ${which}`;
    if (L.splay) assert.ok(G.lean >= 20, `${name}: leaning out ${G.lean.toFixed(0)} degrees`);
    assert.ok((G.knee[1] - S.floor) / (G.hip[1] - S.floor) <= 0.36, name + ': its knuckle low on it');
    assert.ok(Math.max(...L.pad) >= 1.5 * 2 * L.r, name + ': a pad broader than the leg');
    if (!which.includes('starboard')) continue;
    const T = legPlan(S.legs[which.replace('starboard', 'port')], S.floor), mir = (q) => [-q[0], q[1], q[2]];
    assert.deepEqual([G.braces.map((B) => [B.name, B.r, B.from.map((v) => v.toFixed(3))]), G.padLevel, G.foot.map((v) => v.toFixed(3))], [T.braces.map((B) => [B.name, B.r, mir(B.from).map((v) => v.toFixed(3))]), T.padLevel, mir(T.foot).map((v) => v.toFixed(3))], `${name}: as its port twin, mirrored`);
  }
});

test('the kit is handed the plan\'s leaves in the frame it draws them in; a leaf stands as drawn when down', () => {
  const src = read('kit/ships/built-common.js');
  assert.match(src, /const G = legPlan\(L, floor\), deck = -dk\(V3\(0, 0, 0\)\)\.y/, 'strutLeg finds the deck it draws in');
  assert.match(src, /kitLeaves\(G, deck\)/, 'and hands the kit the plan\'s leaves lowered by it');
  for (const [ship, S] of Object.entries(LEGS)) for (const [which, L] of Object.entries(S.legs)) {
    const G = legPlan(L, S.floor), K = kitLeaves(G, 1.7);
    for (const q of K) for (const p of [[0, 0, 0], [1, 2, 3], G.knee]) assert.ok(Math.hypot(...sub(aimPoint(q.aim, p, 0), p)) < 1e-9, `${ship} ${which} ${q.part}: as drawn when down`);
  }
  // (posing a leaf makes no new arrays: the same scratch array back each time)
  const q = kitLeaves(legPlan(LEGS.miner.legs.port, LEGS.miner.floor), 1.95)[2], out = new Float64Array(16);
  assert.equal(aimMatrix(q.aim, 0.5, out), out);
});

// (the hull's skin as the game has it, the wells cut: every face over a point (x, z), low to high)
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
    const key = Math.round(x * 200) + ',' + Math.round(z * 200); if (memo.has(key)) return memo.get(key);
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
// (a set of polys' height over (x, z): the highest, or null)
const polysAt = (polys) => (x, z) => {
  let y = null;
  for (const poly of polys) for (let i = 1; i + 1 < poly.length; i++) {
    const [A, B, C] = [poly[0], poly[i], poly[i + 1]], d = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]); if (Math.abs(d) < 1e-12) continue;
    const l1 = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / d, l2 = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / d, l3 = 1 - l1 - l2;
    if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
    const v = l1 * A[1] + l2 * B[1] + l3 * C[1]; y = y == null ? v : Math.max(y, v);
  }
  return y;
};
// (each ship's pieces, built by its own code with three.js, and posed by the kit's)
async function kitOf() {
  const THREE = await import('three'), { Piece } = await import('../kit/piece.js'), { leafAt } = await import('../kit/layout.js');
  const EB = await import('../kit/ships/explorer-built.js'), MB = await import('../kit/ships/miner-built.js');
  const ships = { explorer: { cat: EB.SHIP_EXPLORER_BUILT, gear: 'ebGear', doors: 'ebGearDoors', wells: 'ebWells', deck: EB.DECK }, miner: { cat: MB.SHIP_MINER_BUILT, gear: 'mbGear', doors: 'mbGearDoors', wells: 'mbWells', deck: MB.DECK } };
  const build = (ship, name, which) => { const p = new Piece(); ships[ship].cat[name].build(p, which); return p; };
  // every leaf of a piece of one door: its vertices (the piece's frame) and the leaf as the kit poses it
  const leaves = (p, door) => p.movers.filter((m) => m.door === door).map((mv) => ({ key: mv.key, leaf: { M: new THREE.Matrix4(), base: mv.base, slide: mv.slide, hinge: mv.hinge, aim: mv.aim, fold: mv.fold }, pos: mv.piece.parts.flatMap((pt) => Array.from(pt.geo.attributes.position.array)) }));
  const m = new THREE.Matrix4(), v = new THREE.Vector3();
  // each vertex of a leaf, t of the way, in the ship's frame
  const each = (l, t, deck, fn) => { leafAt(l.leaf, t, m); const P = l.pos; for (let j = 0; j < P.length; j += 3) { v.set(P[j], P[j + 1], P[j + 2]).applyMatrix4(m); fn(v.x, v.y + deck, v.z); } };
  return { THREE, Piece, ships, build, leaves, each };
}

test('each leg folds AS DRAWN: every vertex of every part, at a hundred moments, out of the hull but by its well, and up behind its shut door', { skip: DRAWN }, async () => {
  const K = await kitOf(), bad = [];
  for (const [ship, S] of Object.entries(LEGS)) {
    const H = HULLS[ship], skin0 = skinOf(H), deck = K.ships[ship].deck;
    for (const which of Object.keys(S.legs)) {
      // (the hull's skin, with the pieces cut with the well that stay in it (an upper skin over it); its mouth without them)
      const kept = polysAt(keptPieces(H.DOORS[which], S.legs[which].door)), skin = (x, z) => { const k = kept(x, z), hs = skin0(x, z); return k == null ? hs : [...hs, k].sort((p, q) => p - q); };
      // (each kind of fault once a part, with the moments it was seen at, first and last)
      const name = `${ship} ${which}`, G = legPlan(S.legs[which], S.floor), [mn, mx] = G.well, note = new Map();
      const say = (k, q, i = null) => { const n = note.get(k); if (!n) note.set(k, { q, i0: i, i1: i }); else n.i1 = i; };
      const door = polysAt(doorHalves(H.DOORS[which], S.legs[which].door).flatMap((h) => h.polys)), roof = polysAt(H.WELLS[which].roof);
      const inMouth = (x, z) => [[0, 0], [0.005, 0], [-0.005, 0], [0, 0.005], [0, -0.005]].some(([dx, dz]) => door(x + dx, z + dz) != null);
      const ceil = (x, z) => roof(x, z) ?? mx[1];
      const legs = K.leaves(K.build(ship, K.ships[ship].gear, which), 'gear');
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        for (const l of legs) K.each(l, t, deck, (x, y, z) => {
          const part = l.key.split(':')[1], at = [x, y, z].map((c) => +c.toFixed(2));
          if (inside(skin(x, z), y) && !(inMouth(x, z) && y < ceil(x, z) + 0.01)) say(`${part} through the hull outside its well`, at, i);
          if (t === 1) {
            if (!(inMouth(x, z) && y < ceil(x, z) + 0.01)) say(`${part} up outside its well`, at);
            const dy = door(x, z); if (dy != null && y < dy + 0.01) say(`${part} up under its shut door`, at);
          }
          if (t === 0 && y < S.floor - 1e-6) say(`${part} under the floor`, at);
        });
      }
      // (standing: the pad's sole on the floor)
      let low = Infinity; for (const l of legs) K.each(l, 0, deck, (x, y) => { low = Math.min(low, y); });
      if (Math.abs(low - S.floor) > 1e-4) say('its lowest point off the floor', [low]);
      for (const [k, n] of note) bad.push(`${name}: ${k}${n.i0 != null ? ` from ${n.i0}% to ${n.i1}%` : ''} (${n.q.join(', ')})`);
    }
  }
  assert.equal(bad.join(' | '), '', 'the fold as drawn');
});

test('each leg stays one joined thing all the way: each support on the knuckle, the piston in the cylinder, the pad under the ankle', () => {
  const bad = [];
  for (const [ship, S] of Object.entries(LEGS)) for (const [which, L] of Object.entries(S.legs)) {
    const G = legPlan(L, S.floor), kit = Object.fromEntries(kitLeaves(G, 0).map((q) => [q.part, q])), name = `${ship} ${which}`;
    const sTop = G.length - G.cyl.top, sGland = G.length - G.cyl.keep, alongLeg = (s) => add(G.line.a, mul(G.dir, s));
    for (let i = 0; i <= 100; i++) {
      const e = ease(i / 100), kn = aimPoint(kit.foot.aim, G.knee, e);
      for (const B of G.braces) if (Math.hypot(...sub(aimPoint(kit[`brace ${B.name}`].aim, G.knee, e), kn)) > 1e-6) bad.push(`${name}: its ${B.name} support off the knuckle at ${i}%`);
      // (the piston's top, carried by the foot, inside the cylinder: between its hip and its gland, on its line)
      const hip = aimPoint(kit.cylinder.aim, G.line.a, e), gland = aimPoint(kit.cylinder.aim, alongLeg(sGland), e), top = aimPoint(kit.foot.aim, alongLeg(sTop), e);
      const u = unit(sub(gland, hip)), s = dot(sub(top, hip), u), off = Math.hypot(...sub(sub(top, hip), mul(u, s)));
      if (off > 1e-6 || s < -1e-6 || s > Math.hypot(...sub(gland, hip)) - LEG.overlap + 1e-6) bad.push(`${name}: its piston out of its cylinder at ${i}% (${s.toFixed(3)} along, ${off.toFixed(4)} off)`);
      if (G.padLevel && Math.hypot(...sub(aimPoint(kit.pad.aim, G.ankle, e), aimPoint(kit.foot.aim, G.ankle, e))) > 1e-6) bad.push(`${name}: its pad off its ankle at ${i}%`);
    }
  }
  assert.equal([...new Set(bad)].join(' | '), '', 'joined');
});

test('the doors: shut, the hull\'s own skin; open, folded into the frame inside the well, every corner (the drawn door)', { skip: DRAWN }, async () => {
  const K = await kitOf(), bad = [];
  for (const [ship, S] of Object.entries(LEGS)) {
    const H = HULLS[ship], deck = K.ships[ship].deck, skin = skinOf(H);
    for (const which of Object.keys(S.legs)) {
      const [mn, mx] = H.WELLS[which].box, roof = polysAt(H.WELLS[which].roof), name = `${ship} ${which}`;
      // (the mouth's height over (x, z), or within half a centimetre of it: a corner on its edge)
      // (its lowest piece there: a mouth cut up a cheek or round a block's edge has pieces one over another)
      const low0 = (x, z) => { let y = null; for (const h of H.DOORS[which]) for (const P of h.polys) { const v = polysAt([P])(x, z); if (v != null) y = y == null ? v : Math.min(y, v); } return y; };
      const door = (x, z) => { let y = null; for (const [dx, dz] of [[0, 0], [0.005, 0], [-0.005, 0], [0, 0.005], [0, -0.005]]) { const v = low0(x + dx, z + dz); if (v != null) y = y == null ? v : Math.min(y, v); } return y; };
      const ls = K.leaves(K.build(ship, K.ships[ship].doors, which), 'doors');
      assert.equal(ls.length, S.legs[which].door.apart ? 2 : 1, name + ': its door\'s leaves');
      for (const l of ls) {
        // (shut, t 1: just where it is drawn, the skin cut out of the well's mouth)
        let j = 0;
        K.each(l, 1, deck, (x, y, z) => { const P = l.pos; if (Math.hypot(x - P[j], y - deck - P[j + 1], z - P[j + 2]) > 1e-6) bad.push(`${name}: shut, a corner not where it is drawn (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`); j += 3; });
        // (open, t 0: in the well's box, over its mouth and under its roof; or, its inner face's edge a little past the
        // box, inside the hull's skin)
        K.each(l, 0, deck, (x, y, z) => {
          const dy = door(x, z), rf = roof(x, z) ?? mx[1], q = `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`;
          const inBox = (m) => x >= mn[0] - m && x <= mx[0] + m && z >= mn[2] - m && z <= mx[2] + m;
          if (inBox(0.005) && dy != null && y >= dy + 0.01 && y <= rf) return;
          if (inBox(0.035) && inside(skin(x, z), y)) return;
          bad.push(`${name}: open, a corner ${!inBox(0.005) ? 'outside its well' : dy == null || y < dy + 0.01 ? 'not over its mouth' : 'over its roof'} ${q}`);
        });
      }
    }
  }
  assert.equal([...new Set(bad)].slice(0, 12).join(' | '), '', 'the doors');
});

test('each well inside the hull: its roof over its mouth\'s own outline, every height a number, under the hull\'s top, over its mouth', () => {
  const bad = [];
  for (const [ship, S] of Object.entries(LEGS)) {
    const skin0 = skinOf(HULLS[ship]), shut = Object.values(HULLS[ship].DOORS).map((d) => polysAt(d.flatMap((h) => h.polys)));
    const skin = (x, z) => [...skin0(x, z), ...shut.map((f) => f(x, z)).filter((v) => v != null)].sort((p, q) => p - q);
    for (const which of Object.keys(S.legs)) {
      const Wl = HULLS[ship].WELLS[which], name = `${ship} ${which}`, mouth = polysAt(HULLS[ship].DOORS[which].flatMap((h) => h.polys));
      assert.ok(Wl.roof && Wl.roof.length === HULLS[ship].DOORS[which].reduce((t, h) => t + h.polys.length, 0), name + ': a roof piece over each piece of its mouth');
      assert.ok(Wl.rimTop && Wl.rimTop.length === Wl.rim.length, name + ': its walls\' heights');
      for (const v of [...Wl.roof.flat(2), ...Wl.rim.flat(2), ...Wl.rimTop.flat()]) if (!Number.isFinite(v)) { bad.push(`${name}: a height that is not a number in its roof or rim`); break; }
      for (const P of Wl.roof) {
        const c = [0, 1, 2].map((k) => P.reduce((t, p) => t + p[k], 0) / P.length);
        for (const q of [c, ...P.map((p) => { const d = Math.hypot(p[0] - c[0], p[2] - c[2]) || 1, k = Math.min(0.02, d) / d; return p.map((v, j) => v + (c[j] - v) * k); })]) {
          const top = Math.max(...[[0, 0], [0.01, 0], [-0.01, 0], [0, 0.01], [0, -0.01]].map(([dx, dz]) => { const hs = skin(q[0] + dx, q[2] + dz); return hs.length ? hs[hs.length - 1] : -Infinity; }));
          if (top < q[1] + 0.01) bad.push(`${name}: its roof out of the hull at (${q.map((v) => v.toFixed(2))})`);
        }
        // (and each corner over the mouth under it: no dark sheet hanging below the skin)
        for (const p of P) { const my = mouth(p[0], p[2]); if (my != null && p[1] < my) bad.push(`${name}: its roof under its mouth at (${p.map((v) => v.toFixed(2))})`); }
      }
    }
  }
  assert.equal([...new Set(bad)].join(' | '), '', 'the wells in the hull');
});

test('what stands still is the same at every quality level (it is lit and saved with its room); the draws a ship\'s gear costs', { skip: DRAWN }, async () => {
  const K = await kitOf();
  for (const ship of ['explorer', 'miner']) {
    const n = (fine) => { K.Piece.fine = fine; try { const p = K.build(ship, K.ships[ship].wells, K.ships[ship].cat[K.ships[ship].wells].variants?.[0]); return p.parts.reduce((t, q) => t + q.geo.attributes.position.count, 0); } finally { K.Piece.fine = true; } };
    assert.equal(n(false), n(true), ship + ': its wells and still mounts the same at the low level');
    // (each leg a cylinder, a foot and a leaf a support, its pad where it keeps level; one door leaf a well, two on
    // the Explorer's nose: round four had 34 and 48, main 16 and 12)
    let leaves = 0;
    for (const which of Object.keys(LEGS[ship].legs)) leaves += K.build(ship, K.ships[ship].gear, which).movers.length + K.build(ship, K.ships[ship].doors, which).movers.length;
    assert.ok(leaves <= { explorer: 19, miner: 24 }[ship], `${ship}: ${leaves} leaves`);
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
  // (the doors' folds: shut, as drawn; open, a sliver)
  for (const [ship, H] of Object.entries(HULLS)) for (const [which, L] of Object.entries(LEGS[ship].legs)) for (const { fold } of doorFolds(H.DOORS[which], L.door)) {
    const p = H.DOORS[which][0].polys[0][0];
    assert.ok(Math.hypot(...sub(foldPoint(fold, p, 1), p)) < 1e-9, `${ship} ${which}: its door shut as drawn`);
  }
  void behindAngle;
});
