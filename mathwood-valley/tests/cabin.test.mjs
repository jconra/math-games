// Tests for the cabin's furnishings (src/cabin/slots.js) and how they save (src/save.js).
// Run with:  node --test mathwood-valley/tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { return { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }; } });
const S = await import('../src/save.js');
const C = await import('../src/cabin/slots.js');
const { PRICES } = await import('../src/catalog.js');
S.useSaveKey('bandit-math.riders.cabintest');

test('the slots make a price ladder from a cheap rug to a costly stove', () => {
  const prices = C.SLOTS.map((s) => s.price);
  assert.deepEqual([...prices].sort((a, b) => a - b), prices, 'cheapest first');
  assert.equal(C.SLOTS[0].id, 'rug'); assert.equal(C.SLOTS.at(-1).id, 'stove');
  assert.equal(new Set(C.SLOTS.map((s) => s.id)).size, C.SLOTS.length, 'ids are unique');
  for (const s of C.SLOTS) {
    assert.ok(s.file || s.made, s.id + ': a file or made in code');
    assert.ok(s.looks.length > 0, s.id + ': somewhere to look to pick it');
    for (const ex of s.extra || []) assert.ok(ex.file, s.id + ': its extra pieces are files');
  }
  // every gap between neighbours is a fair save, so there is always a next thing in reach (the prices were doubled on
  // 2026-10-19, and the gaps with them)
  for (let i = 1; i < prices.length; i++) assert.ok(prices[i] - prices[i - 1] <= 200, `${C.SLOTS[i].id} is not too far past the one before`);
  // the prices are the catalog's (one table for every price)
  for (const s of C.SLOTS) assert.equal(s.price, PRICES.furniture[s.id], s.id);
});

test('an old save (no cabin) loads with nothing bought, and a new rider has no cabin field yet', () => {
  const old = S.fixRider({ name: 'Old', owned: { saddle: 'plain', dog: { kind: 'shiba', name: 'Rex' } } });
  assert.deepEqual(C.ownedPieces(old), []);
  assert.equal('cabin' in old.owned, false);
  assert.equal(C.nextPiece(old).id, 'rug');
  assert.equal('cabin' in S.newRider('New').owned, false);
});

test('buying: gold is taken, the piece is kept in the slot order, it saves and loads again', () => {
  const r = S.newRider('Buyer'), start = C.SLOT.picture.price + C.SLOT.rug.price + 45; r.gold = start; S.saveRider(r);
  assert.equal(C.buyPiece(r, 'picture', S.spend, S.saveRider), 'bought');
  assert.equal(C.buyPiece(r, 'rug', S.spend, S.saveRider), 'bought');
  assert.equal(r.gold, start - C.SLOT.picture.price - C.SLOT.rug.price);
  assert.deepEqual(r.owned.cabin, ['rug', 'picture']);
  assert.equal(C.buyPiece(r, 'rug', S.spend, S.saveRider), 'owned', 'never twice');
  assert.equal(C.buyPiece(r, 'stove', S.spend, S.saveRider), 'short', 'not enough gold: nothing taken');
  assert.equal(r.gold, 45);
  assert.equal(C.buyPiece(r, 'piano', S.spend, S.saveRider), 'unknown');
  const back = S.loadRiders().find((x) => x.id === r.id);
  assert.deepEqual(C.ownedPieces(back), ['rug', 'picture']);
  assert.equal(back.gold, 45);
});

test('a damaged cabin list is cleaned on load (no junk, no repeats, unknown pieces ignored)', () => {
  const r = S.fixRider({ name: 'Mess', owned: { cabin: ['rug', 'rug', 7, null, 'spaceship', 'bed'] } });
  assert.deepEqual(r.owned.cabin, ['rug', 'spaceship', 'bed'], 'strings kept once (a newer build may know more pieces)');
  assert.deepEqual(C.ownedPieces(r), ['rug', 'bed']);
  assert.deepEqual(S.fixRider({ owned: { cabin: 'rug' } }).owned.cabin, []);
});

test('the dogs at home: the one following you is marked, the rest wait; an old one-dog save works', () => {
  assert.deepEqual(C.homeDogs(S.fixRider({ owned: { dog: { kind: 'pug', name: 'Tater' } } })), [{ kind: 'pug', name: 'Tater', following: true }]);
  const r = S.fixRider({ owned: { dog: { kind: 'husky', name: 'Ghost' }, dogs: [{ kind: 'shiba', name: 'Biscuit' }, { kind: 'husky', name: 'Old name' }, { kind: 'wolf', name: 'No' }] } });
  assert.deepEqual(C.homeDogs(r), [{ kind: 'shiba', name: 'Biscuit', following: false }, { kind: 'husky', name: 'Ghost', following: true }]);
  assert.deepEqual(C.homeDogs(S.newRider('Nobody')), []);
});

test('every keepsake has a spot in the cabin', () => {
  for (const job of Object.keys(S.KEEPSAKES)) assert.ok(C.KEEPSAKE_SPOTS[job], job);
});

test('the steer horns hang on the back wall, clear of the beams (over the door a ceiling beam ran through them)', () => {
  const h = C.KEEPSAKE_SPOTS.cattle;
  assert.deepEqual(h.wall, [0, 0, -1], 'on the back wall, facing into the room');
  assert.ok(h.at[2] < -2.5, 'at the back of the room');
  assert.ok(Math.abs(h.at[0] - 0.24) > 0.9, 'not over the door\'s line, nor the back window\'s');
  assert.ok(h.at[1] + 0.3 < 2.9, 'their tips stay under the beams (about 2.9 m up)');
  // nothing else hangs where they spread (1.7 m across, 0.6 m tall)
  for (const [job, k] of Object.entries(C.KEEPSAKE_SPOTS)) {
    if (job === 'cattle' || !k.wall || k.wall[2] !== -1) continue;
    assert.ok(Math.abs(k.at[0] - h.at[0]) > 1.0 || Math.abs((k.at[1] ?? 1) - h.at[1]) > 0.7, job);
  }
  const pic = C.SLOT.picture;
  assert.ok(Math.abs(pic.at[0] - h.at[0]) > 1.5, 'the painting over the bed is well off to the side');
});


// ── WHERE THE CABIN'S THINGS GO (src/cabin/layout.js), for every cabin design the player's cabin can be built as (each
// preset's anchors as labs/buildings/cabins.js builds it: tests/fixtures/cabin-anchors.json, written by
// ~/pw/bandit-math/rigs/cabin_things/dump_anchors.cjs), with every keepsake earned. The game's maker, 2026-10-28: the cracked safe door
// stood on the floor right in front of the front door, the steer horns were crammed to the left, the wanted posters hung
// over a window. ──
const { readFileSync } = await import('node:fs');
const LAY = await import('../src/cabin/layout.js');
const PL = await import('../src/cabin/placement.js');
const CAB = JSON.parse(readFileSync(new URL('./fixtures/cabin-anchors.json', import.meta.url), 'utf8')).presets;
const layouts = Object.fromEntries(Object.entries(CAB).map(([k, A]) => [k, LAY.cabinLayout(A)]));
// (the cabin's walls as plain lines: which wall a spot is on, and where along it)
const wallOfSpot = (Lay, s) => Lay.walls.find((w) => w.dir[0] === s.wall[0] && w.dir[2] === s.wall[2] && Math.abs((w.axis === 'x' ? s.at[2] : s.at[0]) - w.at) < 0.05 && (w.axis === 'x' ? s.at[0] : s.at[2]) > w.a0 - 0.05 && (w.axis === 'x' ? s.at[0] : s.at[2]) < w.a1 + 0.05);   // (two rooms' walls can share a line)
const along = (w, p) => (w.axis === 'x' ? p[0] : p[2]);
const wallThings = (Lay) => [...LAY.WALL_JOBS.map((j) => [j, Lay.keepsakes[j]]), ['picture', Lay.slots.picture], ['rifles', Lay.slots.rifles]].filter(([, s]) => s && s.wall);
const rectOf = (Lay, id, s) => { const w = wallOfSpot(Lay, s), rc = LAY.KEEP_RECT[id].map((q) => q * (s.scale || 1)), u = along(w, s.at); return { w, r: [u + rc[0], u + rc[1], s.at[1] + rc[2], s.at[1] + rc[3]] }; };
const meet = (a, b, m = 0) => a[0] < b[1] + m && b[0] < a[1] + m && a[2] < b[3] + m && b[2] < a[3] + m;

// (the designs as the town's player's cabin gets them: each preset with its own seed, and the game's own cabin; the others
// are the same presets with other seeds, the kind a New look gives)
const own = (name) => !name.includes('/');
test('every design: the layout\'s own checks find nothing (no window or doorway covered, no doorway\'s floor, hearth or walking line stood in, nothing in anything)', () => {
  assert.ok(Object.keys(layouts).length >= 11, 'every preset');
  assert.ok(CAB.game, 'the game\'s own cabin is in the fixture');
  for (const [name, Lay] of Object.entries(layouts)) {
    if (own(name)) { assert.deepEqual(Lay.checks, [], `${name}: ${Lay.checks.map((c) => c.what).join('; ')}`); assert.deepEqual(Lay.crowded, [], `${name}: crowded`); continue; }
    // (another seed: a cabin too small for everything may have to stand a piece in the walking line; it says which, and
    // nothing else is wrong: no window, doorway or hearth covered on the walls, nothing in anything)
    for (const c of Lay.checks) assert.ok(Lay.crowded.includes(c.id) && /way between the doors|before the|on the hearth|by the stove/.test(c.what), `${name}: ${c.id} ${c.what}`);
  }
  const crowded = Object.entries(layouts).filter(([, L]) => L.crowded.length).map(([k]) => k);
  assert.ok(crowded.length <= Object.keys(layouts).length / 8, `few designs crowded: ${crowded.join(', ')}`);
});

test('every design: every keepsake and piece has a spot, the wall ones on a wall of a room, under the ceiling, off the floor', () => {
  for (const [name, Lay] of Object.entries(layouts)) {
    for (const job of Object.keys(S.KEEPSAKES)) assert.ok(Lay.keepsakes[job], `${name}: ${job}`);
    for (const id of ['bed', 'table', 'stove', 'rug', 'dogbeds', 'picture', 'rifles', 'lanterns', 'porch']) assert.ok(Lay.slots[id], `${name}: ${id}`);
    for (const [id, s] of wallThings(Lay)) {
      const { w, r } = rectOf(Lay, id, s);
      assert.ok(w, `${name}: ${id} on a wall`);
      assert.ok(r[0] >= w.a0 && r[1] <= w.a1, `${name}: ${id} within its wall`);
      assert.ok(r[3] <= w.room.ceil - 0.05 && r[2] >= w.room.y + 0.2, `${name}: ${id} between the floor and the ceiling`);
    }
    assert.ok(Lay.slots.dogbeds.spots.length >= 1, `${name}: a dog bed at least`);
  }
});

test('every design, worked out afresh: nothing hangs over a window or a doorway, nor overlaps another thing on its wall', () => {
  for (const [name, Lay] of Object.entries(layouts)) {
    const A = CAB[name], things = wallThings(Lay).map(([id, s]) => ({ id, ...rectOf(Lay, id, s) }));
    for (const t of things) {
      const u0 = (w, c, half) => [along(w, c) - half, along(w, c) + half];
      for (const g of A.windows) { if (Math.abs(g.out[0] - t.w.dir[0]) > 0.1 || Math.abs(g.out[2] - t.w.dir[2]) > 0.1 || Math.abs((t.w.axis === 'x' ? g.centre[2] : g.centre[0]) - t.w.at) > 0.1) continue;
        const [a, b] = u0(t.w, g.centre, g.w / 2 + 0.07); assert.ok(!meet(t.r, [a, b, g.y0 - 0.05, g.y1 + 0.1]), `${name}: ${t.id} over a window`); }
      for (const d of A.doorways) { if (Math.abs(Math.abs(d.out[0]) - Math.abs(t.w.dir[0])) > 0.1 || Math.abs((t.w.axis === 'x' ? d.centre[2] : d.centre[0]) - t.w.at) > 0.7) continue;
        const [a, b] = u0(t.w, d.centre, d.w / 2 + 0.07); assert.ok(!meet(t.r, [a, b, A.floor - 0.1, A.floor + d.h + 0.08]), `${name}: ${t.id} over the ${d.name} doorway`); }
    }
    for (let i = 0; i < things.length; i++) for (let j = i + 1; j < things.length; j++) if (things[i].w === things[j].w) assert.ok(!meet(things[i].r, things[j].r, -0.02), `${name}: ${things[i].id} and ${things[j].id} overlap`);
  }
});

test('every design, worked out afresh: nothing stands on the floor before a doorway (its width and 40 cm either side, 1.2 m out)', () => {
  for (const [name, Lay] of Object.entries(layouts)) {
    const A = CAB[name], fl = [];
    const T = Lay.slots.table, alongX = T.rot % 180 === 0; fl.push(['table', T.at[0], T.at[2], alongX ? 0.6 : 0.4, alongX ? 0.4 : 0.6]);   // (the table's model is long along its own x)
    for (const c of T.extra) fl.push(['chair', c.at[0], c.at[2], 0.22, 0.22]);
    if (!Lay.slots.stove.builtIn) fl.push(['stove', Lay.slots.stove.at[0], Lay.slots.stove.at[2], 0.4, 0.4]);
    { const b = Lay.slots.bed, side = b.rot === 90 || b.rot === 270; fl.push(['bed', b.at[0], b.at[2], side ? 0.93 : 0.5, side ? 0.5 : 0.93]); }
    for (const q of Lay.slots.dogbeds.spots) fl.push(['dog bed', q.x, q.z, 0.4, 0.4]);
    for (const id of ['boxes', 'loot']) { const s = Lay.keepsakes[id]; if (s.table) continue; const sz = LAY.FLOOR_BOX[id], side = Math.abs(Math.sin((s.rot || 0) * Math.PI / 180)) > 0.5; fl.push([id, s.at[0], s.at[2], (side ? sz[1] : sz[0]) / 2 - 0.03, (side ? sz[0] : sz[1]) / 2 - 0.03]); }
    for (const d of A.doorways) {
      const acrossX = Math.abs(d.out[2]) > 0.5, half = d.w / 2 + 0.4, deep = d.inner ? 0.9 : 1.2;
      // (the room side: from the wall's inside face, deep metres in)
      for (const s of d.inner ? [1, -1] : [-1]) {
        const c0 = acrossX ? d.centre[2] : d.centre[0], o = (acrossX ? d.out[2] : d.out[0]) * s, start = c0 + o * (d.inner ? 0.15 : 0.3), end = start + o * deep;
        const zr = acrossX ? [d.centre[0] - half, d.centre[0] + half, Math.min(start, end), Math.max(start, end)] : [Math.min(start, end), Math.max(start, end), d.centre[2] - half, d.centre[2] + half];
        for (const [what, x, z, hw, hd] of fl) {
          const id = { chair: 'table', 'dog bed': 'dogbeds' }[what] || what;
          if (!own(name) && Lay.crowded.includes(id)) continue;   // (a cabin too small for everything: it says so, above)
          assert.ok(!meet([x - hw, x + hw, z - hd, z + hd], zr, -0.03), `${name}: the ${what} stands before the ${d.name} doorway`);
        }
      }
    }
  }
});

test('the game\'s cabin (tworoom, as the town builds it): the horns centred over the mantel, the safe door off the front door\'s floor', () => {
  const G = CAB.game ? 'game' : 'tworoom', Lay = layouts[G], A = CAB[G], h = Lay.keepsakes.cattle, hearth = A.hearths[0];
  assert.deepEqual(h.wall, hearth.into.map((q) => -q || 0), 'on the fireplace\'s wall');
  assert.ok(Math.abs(h.at[2] - hearth.centre[2]) < 0.05, 'centred over the fireplace');
  assert.ok(h.at[1] + LAY.KEEP_RECT.cattle[2] > hearth.mantel[1], 'over the mantel shelf');
  const f = A.doorways.find((d) => d.name === 'front'), b = Lay.keepsakes.boxes;
  assert.ok(Math.hypot(b.at[0] - f.centre[0], b.at[2] - f.centre[2]) > 1.3 || Math.abs(b.at[0] - f.centre[0]) > 0.9, 'the safe door is not before the front door');
});

test('saved spots (the lab\'s Place things) win, and a bad one is reported, not hidden', () => {
  const A = CAB.tworoom, auto = layouts.tworoom;
  const w = auto.walls.find((q) => q.room === auto.main && q.side === 'back'), spot = { at: [(w.a0 + w.a1) / 2, A.floor + 1.5, w.at], wall: w.dir.slice() };
  const Lay = LAY.cabinLayout(A, { saved: { bandits: spot, table: { at: [auto.slots.table.at[0], null, auto.slots.table.at[2]], rot: auto.slots.table.rot } } });
  assert.deepEqual(Lay.keepsakes.bandits, spot);
  assert.deepEqual(Lay.slots.table.at, auto.slots.table.at);
  // (a poster saved right over a window: the checks say so)
  const g = A.windows.find((q) => q.out[2] < -0.5), bad = LAY.cabinLayout(A, { saved: { fish: { at: [g.centre[0], g.centre[1], g.centre[2]], wall: [0, 0, -1] } } });
  assert.ok(bad.checks.some((c) => c.id === 'fish' && /window/.test(c.what)), JSON.stringify(bad.checks));
  // (junk is ignored)
  const junk = LAY.cabinLayout(A, { saved: { cattle: { at: 'x' }, table: null, nothing: { at: [0, 0, 0] } } });
  assert.deepEqual(junk.keepsakes.cattle, auto.keepsakes.cattle);
});

test('placement.json: one line a thing, read back as it was written; the key is the design', () => {
  const file = { v: 1, spots: { tworoom: { cattle: { at: [3.11, 2.351, -1.35], wall: [1, 0, 0] }, boxes: { at: [0.1, null, -1.2], rot: 90.4 } } } };
  const text = PL.placementText(file), back = JSON.parse(text);
  assert.equal(back.v, 1);
  assert.deepEqual(back.spots.tworoom.cattle, { at: [3.11, 2.35, -1.35], wall: [1, 0, 0] });
  assert.deepEqual(back.spots.tworoom.boxes, { at: [0.1, null, -1.2], rot: 90 });
  assert.ok(text.split('\n').some((l) => l.trim().startsWith('"cattle": {')), 'a line for the horns');
  assert.equal(LAY.placementKey({ preset: 'tworoom' }, { tworoom: { seed: 5 } }), 'tworoom');
  assert.equal(LAY.placementKey({ preset: 'tworoom', seed: 5 }, { tworoom: { seed: 5 } }), 'tworoom');
  assert.equal(LAY.placementKey({ preset: 'tworoom', seed: 587 }, { tworoom: { seed: 5 } }), 'tworoom/587');
  assert.deepEqual(PL.spotsFor(back, 'tworoom').cattle.wall, [1, 0, 0]);
  assert.equal(PL.spotsFor(back, 'homestead'), null);
});

test('working out a cabin\'s layout is quick (it runs as the cabin loads, on a phone too)', () => {
  for (const [name, A] of Object.entries(CAB)) { const t0 = performance.now(); LAY.cabinLayout(A); const ms = performance.now() - t0; assert.ok(ms < 250, `${name}: ${ms.toFixed(0)} ms`); }
});

// ── A FIRE IN THE HEARTH (src/cabin/firemath.js): a few fireside sums first, at the rider's level, not a job ──
const FM = await import('../src/cabin/firemath.js');
test('the fire\'s sums: three cards of the early topics, four answers each with one right, a line for a wrong pick and a picture', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    let s = seed * 9301; const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const r = S.newRider('Fire' + seed), stats = JSON.stringify(r.stats), gold = r.gold;
    const set = FM.fireCards(r, { rand });
    assert.ok(FM.FIRE_MATH.maps.includes(set.map), set.map);
    assert.equal(set.cards.length, FM.FIRE_MATH.cards);
    assert.ok(set.title && set.lead, 'fireside words');
    for (const c of set.cards) {
      assert.equal(c.targets.length, FM.FIRE_MATH.answers, c.text);
      assert.equal(c.targets.filter((t) => t.good).length, 1, c.text);
      assert.equal(c.targets.find((t) => t.good).n, c.answer, c.text);
      assert.equal(new Set(c.targets.map((t) => t.n)).size, c.targets.length, 'no answer twice');
      const wrong = c.targets.find((t) => !t.good);
      assert.ok(FM.wrongLine(set, c, wrong.n).length > 8, 'a line for a wrong pick');
      const pic = FM.helpPicture(set, c);
      assert.ok(pic && pic.helper === 'count' && pic.reveal === false, 'the helper\'s picture, the answer hidden');
    }
    // (not a job: nothing paid or counted)
    assert.equal(JSON.stringify(r.stats), stats); assert.equal(r.gold, gold);
  }
});
