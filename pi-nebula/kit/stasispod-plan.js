// THE STASIS POD'S NUMBERS (plain, no THREE: the tests read them; kit/stasispod.js draws it).
// The game's maker made the model himself, in Tripo, for the Medic's rescue runs: you walk down the Medic's ramp to 3 to
// 6 pods on the ground beside a crashed ship (his answers MED-1, MED-2); "opening the statis pods on medical missions can
// be equation solving, like lockboxes"; nobody is hurt: asleep in a pod, safe until it is opened. His prompt asked for a
// rounded chunky capsule about 2.2 m long on a low base, white and dark grey armour panels with orange stripes, a long
// tinted window over the top half showing an empty padded bed inside, a small glowing control screen with a keypad on
// one side, status lights, thick hinges along one edge, scuffed and dusty. He made it with its lid open on purpose: "I
// asked for it to be open so the door could open and close."
//
// HIS FILE (assets/rescue/stasispod.glb) is his, byte for byte (POD.md5): one mesh, one material, one 1024 px picture,
// 6,146 triangles. In his units it is 1 long (x), 0.41 wide (z; its front, the screen's side, is +z), 0.46 tall with its
// lid open (y up, its foot on 0), its middle over x = z = 0.
//
// THE LID is already a piece of its own in his mesh: his triangles part into 26 pieces (joined by a shared corner, or by
// corners on the very same spot), and the lid is one of them, its window and frame together; the latches along its free
// edge, the two status strips on its back edge and the two struts with their upper brackets are pieces of their own too.
// Every piece whose middle stands over POD.lidAbove (his units) rides on the lid; the rest is the base (its body, the
// three hinge knuckles on its back rim, the pad, the straps, the head rest, the struts' lower mounts). Nothing is cut.
// THE HINGE: his lid lies open at 51.8 degrees from his base's level (its own plane, measured), its lower edge along the
// back; his three hinge knuckles stand on the base's back rim, round a line along x through (y 0.229, z -0.088). The lid
// turns about that line. His base's rim is not level (0.22 along the back where the knuckles are, 0.17 along the front,
// following the capsule's curve) and his lid is flat underneath, so it cannot rest on both: turned down until it is level
// it rests on the two raised ends and leaves the front 0.08 open (26 cm at its size); turned on to POD.shut degrees its
// front edge comes down onto the front rim (within 4 to 11 thousandths: 1 to 3.5 cm) and its back sits on the back rim
// (5 to 10), while its two ends sink into the raised ends' tops (up to 30 thousandths, 10 cm, at the front corners,
// inside them: not seen).
// Shut is POD.shut degrees from as he made it; open is his own angle (lidAngle).
// THE GLASS: his window is painted on (the texture: light grey glass in a dark frame), and in his mesh the window and
// its frame are one piece. The window's faces are found by his paint and his edges (rigs/stasis-1/glass2.py): from the
// window's middle on its underside, every triangle joined to it across his edges whose paint is at least a quarter glass
// (POD.window, 104 triangles); and only where his paint on them is glass (light, hardly coloured: POD.glass) is it drawn
// see-through, a pixel at a time, so the window's edge is his paint's edge and no triangle of his is cut or moved.
// ITS SIZE: at his 2.2 m one of our crew does not fit (the bed inside is 0.638 of his units long: 1.40 m). It is fitted
// so the crew lie in it with the lid shut: POD.long metres long, the bed then 2.04 m wall to wall, the longest of the
// eight people lying (1.93 m, crown to toes) with 2 cm to spare at each end (BED: the bed's room and where the sleeper
// lies; src/sleeper.js). His underside rises a little toward the foot end: the pod is turned POD.level to stand level.
//
//   POD, POD_PIECES (the Kit Lab's catalog entry), podScale(), levelY(x, y), lidAngle(k), turnLid(p, a), readGlb(buffer),
//   podPieces(P, I) -> { tri (each triangle's piece), pieces [{ tris, mid }], lid: triangle numbers, base: triangle
//   numbers }, bedFrame(s) (the bed in metres for src/onbed.js, and where it lies in the pod)

export const POD = {
  md5: 'b2816f5d784c092848e65b25301bb4bb',
  his: { long: 0.99951, wide: 0.40674, tris: 6146 },    // his units: x from -0.49976 to 0.49976, z from -0.20337 to 0.20337
  long: 3.2,                // metres long, as fitted (ITS SIZE)
  lidAbove: 0.26,           // his units: a piece whose middle is higher rides on the lid (the lowest on it 0.277, the highest of the base 0.243)
  hinge: [0.229, -0.088],   // his units: the hinge line along x, through (y, z): his knuckles' middle
  shut: 67,                 // degrees the lid turns from as he made it (open) to shut
  swing: 2.4,               // seconds a lid takes to swing all the way, open or shut
  // his underside is not level: it rises evenly from the head end (+x, his lowest point, 0) to the foot end (0.02 at x
  // -0.45; rigs/stasis-1/bottom.mjs): the whole pod is turned this much about z (radians) so it stands level on a floor
  level: 0.0235,
  // the window's triangles (his numbers: rigs/stasis-1/glass2.py, the pick at a quarter glass)
  window: [157, 158, 159, 162, 163, 201, 202, 240, 241, 422, 437, 438, 439, 440, 542, 587, 593, 594, 1660, 1661, 1662, 1663, 1664, 1665, 1966, 1969, 2080, 2081, 2082, 2083, 2190, 2220, 2221, 2222, 2223, 2230, 2231, 2964, 2965, 2966, 2967, 2968, 2969, 3091, 3102, 3103, 3104, 3105, 3106, 3107, 3110, 3111, 3112, 3113, 3184, 3185, 3284, 3285, 3286, 3287, 3292, 3293, 3294, 3295, 3304, 3305, 3306, 3307, 3310, 3311, 4365, 4604, 4605, 4606, 4607, 4854, 4855, 4856, 4857, 4932, 4933, 5762, 5763, 5766, 5767, 5768, 5769, 5876, 5877, 5882, 5883, 5884, 5885, 5956, 5957, 5958, 5959, 6071, 6082, 6083, 6084, 6085, 6090, 6091],
  // where his paint is glass: lighter than `light` (0 black, 1 white), less coloured than `sat`, eased over `soft`; the
  // glass let through: its own paint at `paint` of its brightness, `opacity` of it over what is behind
  glass: { light: 0.5, sat: 0.3, soft: 0.08, paint: 0.35, opacity: 0.25 },
};
export const podScale = () => POD.long / POD.his.long;
// a point of his (his units) turned level (POD.level about z): its height then
export const levelY = (x, y) => x * Math.sin(POD.level) + y * Math.cos(POD.level);
// the lid's turn about the hinge (radians about +x: + turns up toward the front, down onto the base) for open k: 0 shut,
// 1 as he made it
export const lidAngle = (k) => (1 - Math.max(0, Math.min(1, k))) * POD.shut * Math.PI / 180;
// a point of the lid as he made it ([x, y, z], his units) turned about the hinge by a (radians)
export function turnLid([x, y, z], a) {
  const [y0, z0] = POD.hinge, dy = y - y0, dz = z - z0, c = Math.cos(a), s = Math.sin(a);
  return [x, y0 + dy * c - dz * s, z0 + dy * s + dz * c];
}

// THE BED inside (his units, measured: rigs/stasis-1/room.mjs): the pad's top along its middle, the head end's wall
// (the head rest's side, +x) and the foot end's, the bed's middle line across (z), the pad's half width, the head rest's
// slope from where it starts (x) to the end wall
export const BED = { top: 0.158, head: 0.322, foot: -0.316, z: 0.04, half: 0.09, rest: 0.27 };
// the bed in metres, in src/onbed.js's own frame (x across it, +x the pod's front; y up from the pod's foot; z along it
// from its head end's wall), for a pod s metres to his unit; and its frame in the pod: bed (bx, by, bz) is the pod's
// (head - bz, by, z + bx); its length wall to wall and its middle along the pod (x), in metres
export function bedFrame(s = podScale(), hips = 0.92) {
  return {
    bed: { top: BED.top * s, edge: BED.half * s, pad: BED.half * s, z: hips, stand: [BED.half * s + 0.3, hips], hipUp: 0.095, rest: [0, 0.3] },
    toPod: (bx, by, bz) => [BED.head * s - bz, by, BED.z * s + bx],
    length: (BED.head - BED.foot) * s, mid: (BED.head + BED.foot) / 2 * s, head: BED.head * s, foot: BED.foot * s, width: 2 * BED.half * s,
  };
}

// ── his file, read without a browser (the tests; the kit uses three's loader) ──────────────────────────────────────
// buffer: an ArrayBuffer of a .glb; -> { json, P (positions), N, UV, I (indices), image (the picture's bytes) }
export function readGlb(buffer) {
  const dv = new DataView(buffer); let off = 12; const ch = [];
  while (off < buffer.byteLength) { const l = dv.getUint32(off, true), t = dv.getUint32(off + 4, true); ch.push({ t, o: off + 8, l }); off += 8 + l; }
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, ch[0].o, ch[0].l))), bin = ch[1].o;
  const acc = (i) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView], o = bin + (v.byteOffset || 0) + (a.byteOffset || 0), n = { VEC3: 3, VEC2: 2, SCALAR: 1 }[a.type];
    const T = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.componentType];
    return new T(buffer.slice(o, o + a.count * n * T.BYTES_PER_ELEMENT));
  };
  const pr = json.meshes[0].primitives[0], iv = json.bufferViews[json.images[0].bufferView];
  return { json, P: acc(pr.attributes.POSITION), N: acc(pr.attributes.NORMAL), UV: acc(pr.attributes.TEXCOORD_0), I: acc(pr.indices), image: new Uint8Array(buffer, bin + (iv.byteOffset || 0), iv.byteLength) };
}

// HIS PIECES: P his positions (x, y, z), I his triangles' corners; each triangle's piece (corners joined by a triangle,
// or on the very same spot), each piece's triangles and middle (of its corners), and which triangles ride on the lid
export function podPieces(P, I) {
  const n = P.length / 3, par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  for (let t = 0; t < I.length; t += 3) { join(I[t], I[t + 1]); join(I[t], I[t + 2]); }
  const spot = new Map();
  for (let i = 0; i < n; i++) { const k = Math.round(P[i * 3] * 1e5) + ',' + Math.round(P[i * 3 + 1] * 1e5) + ',' + Math.round(P[i * 3 + 2] * 1e5); const s = spot.get(k); if (s == null) spot.set(k, i); else join(i, s); }
  const tri = new Int32Array(I.length / 3), byRoot = new Map();
  for (let t = 0; t < tri.length; t++) { const r = find(I[t * 3]); tri[t] = r; if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(t); }
  const pieces = [...byRoot.values()].map((tris) => {
    const seen = new Set(), m = [0, 0, 0];
    for (const t of tris) for (let c = 0; c < 3; c++) seen.add(I[t * 3 + c]);
    for (const v of seen) for (let k = 0; k < 3; k++) m[k] += P[v * 3 + k] / seen.size;
    return { tris, mid: m };
  }).sort((a, b) => b.tris.length - a.tris.length);
  const lid = [], base = [];
  for (const p of pieces) (p.mid[1] > POD.lidAbove ? lid : base).push(...p.tris);
  return { tri, pieces, lid: lid.sort((a, b) => a - b), base: base.sort((a, b) => a - b) };
}

// THE KIT LAB'S ENTRY (kit/catalog.js): his model, a file the kit does not cut, so it builds nothing here; the Kit Lab
// fetches it and stands it on its stand (`model`), someone asleep in it or empty
export const POD_PIECES = {
  stasisPod: { name: 'Stasis pod', group: 'Medical', at: 'free', variants: ['asleep', 'empty'], foot: [POD.long, 1.0, POD.long * POD.his.wide / POD.his.long], build: () => {}, model: 'stasispod' },
};
