// THE WESTERN TOWN'S BUILDINGS AS PLAIN DATA, and the ground pads they stand on: no three.js here, so the node tests can
// check them (tests/world.test.mjs). objects/village.js places the models and hands these on (the valley imports them
// from there, as the Terrain Lab's copy has them).

// THE BUILDINGS (the model is models/town/<kind>.glb, 2K pictures, and models/town/lo/ 1K; or <file>.glb when a kind
// borrows another's model), box: the model's bounding box in its own
// units, front: which of its sides has the entrance (turned to face +z), size: its longest side in metres, level: flatten
// the ground under it. Fronts and sizes from rendering each from all sides and judging doors, windows and steps
// (sizes a little up from those estimates where a building reads small among the others).
export const TOWN_ASSETS = {
  // MATHWOOD VALLEY'S WESTERN TOWN (Tripo models, one mesh and one picture each; box from each model's real bounds; size: the
  // longest side in metres, chosen against a 1.8 m person: the doors come out 2.9-3.3 m, generous, as games do)
  // tilt: degrees the model is turned about its own x axis to stand level (a Tripo model can come leaning a little; more
  // tips its front down), its box measured after that; sink: model units its lowest point goes below the ground (when a
  // few posts or steps reach lower than the rest, so the rest isn't left hanging over the ground)
  cabin: { name: 'Cabin', box: [0.944, 0.897, 1.0], front: '+Z', size: 9.5, category: 'home', sink: 0.006 },                 // 9 m wide, porch and steps at the front
  stable: { name: 'Stable & livery', box: [1.0, 0.711, 0.815], front: '+Z', size: 14, category: 'work', sink: 0.006 },      // big barn doors at the front, a wagon shed on its right
  // (the store's model came leaning back 2.7 degrees, its porch posts short of the ground by up to 0.6 m: stood upright,
  // its posts end between 0 and 0.022 of a unit up, so it goes down 0.012: the porch and steps rest on the ground)
  generalStore: { name: 'General store', box: [1.0, 0.866, 0.837], front: '+Z', size: 11, category: 'work', tilt: 2.7, sink: 0.012 },
  sheriff: { name: "Sheriff's office", box: [0.852, 0.807, 1.0], front: '+Z', size: 11.7, category: 'work' },  // 10 m wide
  saloon: { name: 'Saloon', box: [0.883, 0.865, 1.0], front: '+Z', size: 13.5, category: 'work' },             // two storeys and a balcony: 11.9 m wide, 11.7 m to the top of its sign, batwing doors in a 3 m doorway
  stage: { name: 'Stage', box: [1.0, 0.803, 0.776], front: '+Z', size: 7, category: 'work' },                  // an open-air stage: curtains, a piano and a stool, steps up at its front left; its floor 1.1 m up
  // THE TOWNSFOLK'S HOMES: the town cabin's shell again (file: its model, models/town/cabin.glb, shared with the
  // player's cabin, so it loads once), a little smaller, as other people's homes behind the main row toward the lake
  // (src/townpeople.js knows their doors: people go in and out of them, and their windows light up at night)
  home: { name: 'Home', file: 'cabin', box: [0.944, 0.897, 1.0], front: '+Z', size: 8.6, category: 'home', sink: 0.006 },
  // BUILT IN CODE ONLY (code: true, no model file: objects/codebuildings.js builds it, labs/buildings/blacksmith.js): the
  // smithy, board and batten, its big doors in its gable end, a shoeing shed on its right; box: its own 11.1 x 5.6 x 7.8 m
  blacksmith: { name: 'Blacksmith', code: true, box: [1.0, 0.505, 0.703], front: '+Z', size: 11.1, category: 'work' },
};
// a building's footprint (width along its own x, depth along its own z, metres) and height, from its kind and size
export function modelFootprint(it) {
  const A = TOWN_ASSETS[it.kind]; if (!A) return { w: 4, d: 4, h: 4 };
  const side = A.front === '+X' || A.front === '-X', bx = side ? A.box[2] : A.box[0], bz = side ? A.box[0] : A.box[2], s = it.size / Math.max(A.box[0], A.box[2]);
  return { w: bx * s, d: bz * s, h: A.box[1] * s };
}
// (a building sits on the land as it is unless asked to level it, level: true: most have foundations enough for a gentle slope)
export const levels = (it) => it.type === 'model' && it.level === true && (TOWN_ASSETS[it.kind] || {}).level !== false;

// (world -> an item's own frame: x' = cos x - sin z, z' = sin x + cos z, its turn being rot)
// THE GROUND PADS: H = Hpre, then under each building that levels the ground, its footprint flattened (to the average
// height over it and a metre round) out to `flat` m past its walls, and blended back to the land over `margin` m more.
// Grid N x N over SIZE m, a cell TEX m. flat (Mathwood Valley): a cell and a half (~4.4 m), so all the ground the walls stand
// on is worked out from flattened cells only (the ground between cell middles is drawn, and measured, from the four
// round it): with a metre, a small building's corners (the stage's) stood on ground 0.17 m off its floor.
// Buildings whose flat zones meet (an alley between them) share one height, the average of theirs, so the alley is flat
// too and every corner on its floor (each with its own height, the alley's ground can't be both). Order doesn't matter:
// each cell takes the pad that holds it most (a flat zone beats a neighbour's blend; of two flat zones, the nearer).
export function levelPads(H, Hpre, layout, N, SIZE, TEX, margin = 5) {
  H.set(Hpre);
  const F = new Float32Array(N * N), TGT = new Float32Array(N * N), flat = Math.max(1, TEX * 1.42), pads = [];
  for (const it of layout.items) {
    if (!levels(it)) continue;
    const { w, d } = modelFootprint(it), a = it.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), R = Math.hypot(w / 2 + flat, d / 2 + flat) + margin;
    const i0 = Math.max(0, Math.floor((it.x - R + SIZE / 2) / TEX)), i1 = Math.min(N - 1, Math.ceil((it.x + R + SIZE / 2) / TEX));
    const j0 = Math.max(0, Math.floor((it.z - R + SIZE / 2) / TEX)), j1 = Math.min(N - 1, Math.ceil((it.z + R + SIZE / 2) / TEX));
    let sum = 0, n = 0; const cells = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = (i + 0.5) * TEX - SIZE / 2 - it.x, z = (j + 0.5) * TEX - SIZE / 2 - it.z, lx = c * x - s * z, lz = s * x + c * z;
      const ox = Math.max(0, Math.abs(lx) - w / 2), oz = Math.max(0, Math.abs(lz) - d / 2), out = Math.hypot(ox, oz);   // how far outside the footprint
      if (ox <= 1 && oz <= 1) { sum += Hpre[j * N + i]; n++; }
      if (out < flat + margin) cells.push([j * N + i, out]);
    }
    if (n) pads.push({ sum, n, cells });
  }
  // the groups that share a height: two buildings whose flat zones hold the same cell are joined
  const owner = new Int32Array(N * N).fill(-1), up = pads.map((_, p) => p), top = (p) => (up[p] === p ? p : (up[p] = top(up[p])));
  pads.forEach((P, p) => { for (const [k, out] of P.cells) if (out <= flat) { if (owner[k] >= 0) up[top(p)] = top(owner[k]); else owner[k] = p; } });
  const group = new Map(); pads.forEach((P, p) => { const g = group.get(top(p)) || { sum: 0, n: 0 }; g.sum += P.sum; g.n += P.n; group.set(top(p), g); });
  pads.forEach((P, p) => { const g = group.get(top(p)), target = g.sum / g.n;
    for (const [k, out] of P.cells) { const t = Math.max(0, out - flat) / margin, f = out <= flat ? 2 - 0.9 * out / flat : 1 - t * t * (3 - 2 * t); if (f > F[k]) { F[k] = f; TGT[k] = target; } } });
  for (let k = 0; k < N * N; k++) if (F[k] > 0) H[k] = Hpre[k] + (TGT[k] - Hpre[k]) * Math.min(1, F[k]);
}
