// THE STASIS POD'S NUMBERS (plain, no THREE: the tests read them; kit/stasispod.js draws it).
// The game's maker made the model himself, in Tripo, for the Medic's rescue runs: you walk down the Medic's ramp to 3 to
// 6 pods on the ground beside a crashed ship (his answers MED-1, MED-2); "opening the statis pods on medical missions can
// be equation solving, like lockboxes"; nobody is hurt: asleep in a pod, safe until it is opened. His prompt asked for a
// rounded chunky capsule about 2.2 m long on a low base, white and dark grey armour panels with orange stripes, a long
// tinted window over the top half showing an empty padded bed inside, a small glowing control screen with a keypad on
// one side, status lights, thick hinges along one edge, scuffed and dusty. He made it with its lid open on purpose: "I
// asked for it to be open so the door could open and close."
//
// HIS FILE (assets/rescue/stasispod2.glb) is his, byte for byte (POD.md5): his second, "I just fixed it up in Blender"
// (his answer STAS1-2 B), two meshes: the pod (6,072 triangles, his first material and his 1024 px picture) and his glass
// (18 triangles, its own material, ".001"), the glass where his open lid has it. In his units it is 1 long (x), 0.41
// wide (z; its front, the screen's side, is +z), 0.46 tall with its lid open (y up, its foot on 0), its middle over
// x = z = 0. (Against his first file, Tripo's: the same picture, byte for byte; the same places; his window cut out of
// the lid (134 of its triangles gone, 60 new ones round the hole) and made the glass; the normals as Blender wrote them.)
//
// THE LID is already a piece of its own in his mesh: his triangles part into 26 pieces (joined by a shared corner, or by
// corners on the very same spot), and the lid is one of them, its frame round his glass; the latches along its free
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
// THE GLASS is his own piece (his second mesh), used as it is: 15 of its 18 corners are on his lid's own corners round
// the hole, and it turns with the lid about the same hinge. His glass material carries no settings of its own (no
// colour, no see-through), so it is drawn as tinted glass (POD.glass): the colour his first window's glass paint was
// drawn in (that paint's mean, #bcbebf, at 35% of its brightness), a quarter of it over what is behind, shiny.
// ITS SIZE: at his 2.2 m one of our crew does not fit (the bed inside is 0.638 of his units long: 1.40 m). It is fitted
// so the crew lie in it with the lid shut: POD.long metres long, the bed then 2.04 m wall to wall, the longest of the
// eight people lying (1.93 m, crown to toes) with 2 cm to spare at each end (BED: the bed's room and where the sleeper
// lies; src/sleeper.js). His underside rises a little toward the foot end: the pod is turned POD.level to stand level.
// ITS COLOURS (his answer STAS1-3 C: "the pods and the uniforms both in the crashed crew's colours"): beside a wreck the
// pods take the wreck's crew's colours (src/planet/wreck.js PAINTS) by the wreck's own rule, a pixel at a time on his
// picture: his light paint (light, hardly coloured: POD.paint.skin) to their skin colour, his orange stripes
// (POD.paint.accent) to their stripe colour, the rest (his greys, the screen) a shade toward theirs. Alone (the Kit Lab)
// it is in his own colours.
// WHO SLEEPS IN IT wears their position's colour (his words: "I like it when it looks like they are wearing certain
// colors for their position like red-Captain, purple-engineer, yellow-drill or whatever"): POSITIONS, the crew kit's
// band colours (kit/crew.js BAND_COLOURS) on the uniform's bands.
//
//   POD, POD_PIECES (the Kit Lab's catalog entry), POSITIONS, podScale(), levelY(x, y), lidAngle(k), turnLid(p, a),
//   readGlb(buffer) (-> his pod's P, N, UV, I, picture, and his glass's: glass { P, N, UV, I }), podPieces(P, I) -> { tri
//   (each triangle's piece), pieces [{ tris, mid }], lid: triangle numbers, base: triangle numbers }, bedFrame(s) (the
//   bed in metres for src/onbed.js, and where it lies in the pod)

export const POD = {
  md5: '875bb2dbc5eb3519414dedffb654d08d',
  // his units: x from -0.49976 to 0.49976, z from -0.20337 to 0.20337; his pod's triangles and his glass's
  his: { long: 0.99951, wide: 0.40674, tris: 6072, glassTris: 18 },
  long: 3.2,                // metres long, as fitted (ITS SIZE)
  lidAbove: 0.26,           // his units: a piece whose middle is higher rides on the lid (the lowest on it 0.277, the highest of the base 0.243)
  hinge: [0.229, -0.088],   // his units: the hinge line along x, through (y, z): his knuckles' middle
  shut: 67,                 // degrees the lid turns from as he made it (open) to shut
  swing: 2.4,               // seconds a lid takes to swing all the way, open or shut
  // his underside is not level: it rises evenly from the head end (+x, his lowest point, 0) to the foot end (0.02 at x
  // -0.45; rigs/stasis-1/bottom.mjs): the whole pod is turned this much about z (radians) so it stands level on a floor
  level: 0.0235,
  // his glass drawn as glass (THE GLASS): its colour (the screen's), how much of it over what is behind, how rough
  glass: { colour: '#757778', opacity: 0.25, roughness: 0.18 },
  // his paint by the wreck's classes (ITS COLOURS; HSL as the screen shows it, 0..1, hue in degrees): his light paint
  // (lighter than `light`, less coloured than `sat`: src/planet/wreck.js paintClass's own 'skin'), his orange (hue within
  // `hue`, more coloured than `sat`, lighter than `light`: measured on his picture, his stripes are hue 23 to 28, the
  // wreck's own accent rule is for our ships' yellow, 28 to 62); each shaded as his paint is: its lightness over `by`
  // (the wreck's own, at most `most`)
  paint: { skin: { light: 0.6, sat: 0.42, by: 0.82 }, accent: { hue: [15, 40], sat: 0.45, light: 0.25, by: 0.5 }, most: 1.15 },
};
// THE POSITIONS of whoever sleeps in a pod, and the colour each wears: the one table every position of our crew wears
// (kit/positions.js, the station's people and the ships' crews too). A rescue's sleepers have one captain at most
// (src/planet/pods.js sleeperPositions).
export { POSITIONS, POSITION_IDS } from './positions.js';
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
// buffer: an ArrayBuffer of a .glb; -> { json, P (positions), N, UV, I (indices), image (the picture's bytes) } of his
// pod (the mesh with the picture), and glass: the same of his glass (the other mesh)
export function readGlb(buffer) {
  const dv = new DataView(buffer); let off = 12; const ch = [];
  while (off < buffer.byteLength) { const l = dv.getUint32(off, true), t = dv.getUint32(off + 4, true); ch.push({ t, o: off + 8, l }); off += 8 + l; }
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, ch[0].o, ch[0].l))), bin = ch[1].o;
  const acc = (i) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView], o = bin + (v.byteOffset || 0) + (a.byteOffset || 0), n = { VEC3: 3, VEC2: 2, SCALAR: 1 }[a.type];
    const T = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.componentType];
    return new T(buffer.slice(o, o + a.count * n * T.BYTES_PER_ELEMENT));
  };
  const prims = json.meshes.map((m) => m.primitives[0]), painted = (pr) => !!(json.materials[pr.material]?.pbrMetallicRoughness?.baseColorTexture);
  const read = (pr) => pr && { P: acc(pr.attributes.POSITION), N: acc(pr.attributes.NORMAL), UV: acc(pr.attributes.TEXCOORD_0), I: acc(pr.indices) };
  const pr = prims.find(painted), iv = json.bufferViews[json.images[0].bufferView];
  return { json, ...read(pr), glass: read(prims.find((p) => p !== pr)), image: new Uint8Array(buffer, bin + (iv.byteOffset || 0), iv.byteLength) };
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
