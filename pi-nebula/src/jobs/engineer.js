// THE ENGINEER'S QUESTIONS: the fuel pellets in the Miner's core and the containment field round them. The game's maker
// (2026-11-19): "I am thinking it would be good to have some questions about volume, surface areas, and edge lengths."
// And: "I like the idea of the engineering covering questions about volume, area, and edges. I imagine something like a
// display with some kind of cube configuration (depending on the level). So a basic level could just show a 2d box and
// ask what its height is and what its length is. The levels would progress through area and volume. The high levels
// could show a cluster of cubes (the more, the harder) in 3d that can spin around. The questions can claim that the
// cubes are fuel pellets that need a containment field or something."
// (When they are asked, later and not here: "if you signed up for engineering then the captain tells you the core needs
// to be adjusted. So you go back to mechanical and answer so questions there.")
//
// One ladder like every job's, kids to grown-ups, easiest first. Its first and last steps are his; the steps between
// are the ladder he agreed to ("That sounds good, let's do it"):
//    1  a flat box on a grid: how long it is, how high (the pellets along a side, counted)
//    2  all the way round: the field's edge round a flat box
//    3  area by counting: the pellets that fill the flat box
//    4  area by the sides, length × height; then (its own level) a missing side when the area is given
//    5  a flat shape that is not a box: an L-shape, split into two boxes
//    6  into 3D: a block of pellets in layers, how many in all
//    7  volume by the sides, length × width × height; then (its own level) a missing side
//    8  the frame: the lengths of all 12 edges of the field
//    9  the skin: the area of all six faces of the field
//   10  a cluster to turn: how many pellets are in it, hidden ones included
//   11  the field round a cluster: the smallest box that holds it, its volume; then (its own level) how much is empty
//   12  the cluster's own skin: how many faces show on the outside
// Fifteen levels: steps 4, 7 and 11 each hold two kinds of question and are two levels each. Circles and pi stay out.
// THE MORE, THE HARDER: the clusters grow from one cluster level to the next (CLUSTER below).
//
// UNITS. The youngest levels count whole pellets. From the way round onward a pellet is a cube 1 centimetre along each
// side (a real fuel pellet is about that size), so lengths are centimetres, areas square centimetres and volumes cubic
// centimetres; the cluster's skin is counted in faces.
//
// EVERY WRONG ANSWER IS A SLIP A LEARNER MAKES (the sides added where they should be multiplied, the pellets along the
// edge counted for the way round, one layer only, only the faces that can be seen ...), each with one plain line that
// says why it is wrong. HELP just teaches: its picture, one line, and the sum with the numbers filled in (rows of
// squares for an area, layer by layer for a block or a cluster, the pairs of faces for the skin, the 4 + 4 + 4 edges
// for the frame).
//
// THE SHAPE SHOWN. Each card hands over the plain facts of its shape (`facts.shape`: the flat box's squares, the block's
// cubes, the cluster's cubes, what is marked on it), and the display (src/jobs/engview.js) draws exactly that. A card
// also carries the shape as a still picture (`lead`), for anywhere the display itself is not put on it.
//
// A CLUSTER'S ANSWER CAN BE FOUND FROM WHAT IS SHOWN (fair, below): it is one piece; every pellet is the first thing
// met looking straight in from the top, the bottom or one of the four sides (so none is sealed inside, and each shows a
// whole face from one of the six sides the display can be turned to); and there is no hollow closed off inside it, so
// every face with no pellet against it is on the outside.
//
// Counted in Mathwood's geometry (strand 'geo'), as the dock's bridge and the drill's box are; half as much in the
// arithmetic a card uses. Pure (no page): node tests it, pi-nebula/tests/engineer.test.mjs.
import { ownOrder } from './engine.js';
import { shapeSvg, plansSvg, pairsSvg, seenFrom, outsideFaces, START, KEY } from './engview.js';

const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
const PEL = ['pellet', 'pellets'], CM = ['centimetre', 'centimetres'], CM2 = ['square centimetre', 'square centimetres'], CM3 = ['cubic centimetre', 'cubic centimetres'], FACE = ['face', 'faces'], LAYER = ['layer', 'layers'], ROW = ['row', 'rows'];
const C = (n, unit) => ({ v: n, big: String(n), small: n === 1 ? unit[0] : unit[1], label: `${n} ${n === 1 ? unit[0] : unit[1]}` });
const kit = (rand) => ({ int: (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)), pick: (a) => a[Math.floor(rand() * a.length)], chance: (p) => rand() < p });
const cm = (n) => `${n} cm`;
const HELP = { h: 200 };   // how tall a help picture of a flat shape is drawn

// who is aboard (Mathwood's FOLK shape): the Miner's crew
const FOLK = [{ name: 'Engineer Okafor', she: false }, { name: 'Captain Ruiz', she: false }, { name: 'Pilot Juno', she: true }, { name: 'Miner Kestrel', she: true }];
export const SETTING = { folk: FOLK };

// ── the shapes ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const flatCells = (l, h) => { const c = []; for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) c.push([x, y]); return c; };
export const boxCells = (l, w, h) => { const c = []; for (let y = 0; y < h; y++) for (let z = 0; z < w; z++) for (let x = 0; x < l; x++) c.push([x, y, z]); return c; };
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const k3 = (c) => `${c[0]},${c[1]},${c[2]}`;
// how long, how wide and how high a cluster is at its longest (its cubes start from 0 each way)
export const spanOf = (cells) => ({ l: Math.max(...cells.map((c) => c[0])) + 1, h: Math.max(...cells.map((c) => c[1])) + 1, w: Math.max(...cells.map((c) => c[2])) + 1 });

// THE CLUSTERS, by the cluster level (1 the first, 4 the last): how many pellets, fewest to most, and the biggest box
// one may fill (long, high, wide). The more, the harder.
export const CLUSTER = {
  1: { n: [4, 7], max: [3, 3, 3] },
  2: { n: [6, 9], max: [3, 3, 3] },
  3: { n: [8, 11], max: [4, 3, 3] },
  4: { n: [10, 13], max: [4, 3, 3] },
};
// one piece: every pellet reached from the first, face to face
export function onePiece(cells) {
  const set = new Set(cells.map(k3)), seen = new Set([k3(cells[0])]), todo = [cells[0]];
  while (todo.length) { const c = todo.pop(); for (const d of DIRS) { const p = [c[0] + d[0], c[1] + d[1], c[2] + d[2]], key = k3(p); if (set.has(key) && !seen.has(key)) { seen.add(key); todo.push(p); } } }
  return seen.size === cells.length;
}
// every pellet is the first thing met looking straight in from one of the six sides
export function seenAll(cells) {
  const set = new Set(cells.map(k3)), S = spanOf(cells), most = Math.max(S.l, S.h, S.w);
  return cells.every((c) => DIRS.some((d) => { for (let k = 1; k <= most; k++) if (set.has(k3([c[0] + d[0] * k, c[1] + d[1] * k, c[2] + d[2] * k]))) return false; return true; }));
}
// no hollow: every empty place in and round the cluster's box is reached from outside it
export function noHollow(cells) {
  const set = new Set(cells.map(k3)), S = spanOf(cells), seen = new Set(['-1,-1,-1']), todo = [[-1, -1, -1]];
  const inside = (p) => p[0] >= -1 && p[0] <= S.l && p[1] >= -1 && p[1] <= S.h && p[2] >= -1 && p[2] <= S.w;
  while (todo.length) { const c = todo.pop(); for (const d of DIRS) { const p = [c[0] + d[0], c[1] + d[1], c[2] + d[2]], key = k3(p); if (inside(p) && !set.has(key) && !seen.has(key)) { seen.add(key); todo.push(p); } } }
  return seen.size === (S.l + 2) * (S.h + 2) * (S.w + 2) - cells.length;
}
export const fair = (cells) => onePiece(cells) && seenAll(cells) && noHollow(cells);
// a cluster grown a pellet at a time: each new pellet goes against one already there, inside the biggest box allowed
// (a place that touches more pellets is likelier, so it grows into a lump with pellets tucked behind, not long thin arms)
function grow(rand, n, max) {
  const cells = [[0, 0, 0]], set = new Set(['0,0,0']), lo = [0, 0, 0], hi = [0, 0, 0];
  while (cells.length < n) {
    const open = new Map();
    for (const c of cells) for (const d of DIRS) {
      const p = [c[0] + d[0], c[1] + d[1], c[2] + d[2]], key = k3(p);
      if (set.has(key) || [0, 1, 2].some((a) => Math.max(hi[a], p[a]) - Math.min(lo[a], p[a]) + 1 > max[a])) continue;
      const o = open.get(key); if (o) o.touch++; else open.set(key, { p, touch: 1 });
    }
    const list = [...open.values()]; if (!list.length) return null;
    let total = 0; for (const o of list) total += (o.w = 1 + 2 * (o.touch - 1));
    let r = rand() * total, got = list[list.length - 1];
    for (const o of list) { r -= o.w; if (r < 0) { got = o; break; } }
    cells.push(got.p); set.add(k3(got.p));
    for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], got.p[a]); hi[a] = Math.max(hi[a], got.p[a]); }
  }
  return cells.map((c) => [c[0] - lo[0], c[1] - lo[1], c[2] - lo[2]]).sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
}
// (should no grown cluster come out fair, which the tests have never seen: pellets laid in rows, layer on layer)
const heap = (n, max) => boxCells(max[0], max[2], max[1]).slice(0, n);
// a cluster of n pellets that is fair (above)
export function makeCluster(rand, n, max = [3, 3, 3]) {
  for (let tries = 0; tries < 60; tries++) { const cells = grow(rand, n, max); if (cells && fair(cells)) return cells; }
  return heap(n, max);
}
// the cluster's facts, for its cards: its box, its layers, its faces by the way they point, and the side it is first
// shown from (of the four corners it can be seen from, the one that hides the most pellets: turning it is the point)
function clusterOf(rand, step, { some = false } = {}) {
  const t = kit(rand), B = CLUSTER[step];
  let cells = null, S = null;
  for (let tries = 0; tries < 30; tries++) {
    cells = makeCluster(rand, t.int(B.n[0], B.n[1]), B.max); S = spanOf(cells);
    if (!some || cells.length < S.l * S.w * S.h) break;          // (some: its box must have some empty room in it)
  }
  const n = cells.length, shape = { kind: 'cluster', ...S, cells, pellets: true, field: false };
  let view = null, seen = n + 1;
  for (let q = 0; q < 4; q++) { const yaw = START.yaw + q * Math.PI / 2, s = seenFrom(shape, yaw, START.pitch).size; if (s < seen) { seen = s; view = { yaw, pitch: START.pitch }; } }
  shape.view = view;
  const layers = Array.from({ length: S.h }, (_, y) => cells.filter((c) => c[1] === y).length);
  const faces = outsideFaces(cells), by = [0, 1, 2, 3, 4, 5].map((d) => faces.filter((f) => f.d === d).length);
  return { cells, n, S, shape, seen, layers, skin: faces.length, up: by[2], down: by[3], side: by[0], front: by[4], stacks: new Set(cells.map((c) => `${c[0]},${c[2]}`)).size };
}
const addUp = (list, first = 'First two layers', then = 'Then the next') => { const out = []; let run = list[0]; for (let i = 1; i < list.length; i++) { out.push({ op: 'add', a: run, b: list[i], say: i === 1 ? first : then }); run += list[i]; } return out.length === 1 ? { ...out[0], say: 'The two layers together' } : out; };

export const MAKERS = {
  // ── FLAT: pellets in a flat box on a grid, and the field round it ───────────────────────────────────────────────
  // step 1  the sides: how many pellets long, how many high
  // step 2  all the way round: the field's edge, in centimetres
  // step 3  the pellets that fill it, counted
  // step 4  its area from its sides
  // step 5  a missing side, from the area and the other side
  // step 6  an L-shape: two boxes
  flat: {
    strand: 'geo', at: (step) => [6, 18, 22, 32, 36, 42][Math.max(1, Math.min(6, step)) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand);
      if (step <= 1) {
        const l = t.int(2, 7); let h = t.int(1, 5); if (h === l) h = h === 5 ? 4 : h + 1;
        const long = t.chance(0.5), ans = long ? l : h, other = long ? h : l;
        const shape = { kind: 'flat', l, h, cells: flatCells(l, h), pellets: true, field: true };
        return ownOrder({
          key: long ? 'flat:long' : 'flat:high', story: 'The core display shows fuel pellets in a flat box.', ask: long ? 'How many pellets long is the box?' : 'How many pellets high is the box?', right: C(ans, PEL),
          slips: [
            { ...C(other, PEL), slip: 'otherSide', why: long ? `${other} is how high it is. Long is from side to side: count along the bottom.` : `${other} is how long it is. High is from bottom to top: count up one side.` },
            { ...C(ans + 1, PEL), slip: 'off', why: 'One too many. Count again, touching each pellet once.' },
            { ...C(ans - 1, PEL), slip: 'off', why: 'One short. Count again, touching each pellet once.' },
            { ...C(l * h, PEL), slip: 'all', why: long ? 'That is every pellet in the box. Count just the row along the bottom.' : 'That is every pellet in the box. Count just the pellets up one side.' },
            { ...C(l + h, PEL), slip: 'added', why: 'That adds the two sides together. Count along just one of them.' },
          ],
          rightWhy: long ? `${u(l, PEL)} along the bottom` : `${u(h, PEL)} up the side`,
          lead: shapeSvg(shape),
          help: { title: 'Count along one side', svg: shapeSvg({ ...shape, lit: long ? flatCells(l, 1) : flatCells(1, h) }), line: long ? 'Long is from side to side. Count the pellets in the bottom row, touching each one once.' : 'High is from bottom to top. Count the pellets up the left side, touching each one once.' },
          own: { strand: 'geo', at: 6 }, credit: [{ strand: 'number', at: 4, weight: 0.5 }], facts: { kind: 'sides', ask: long ? 'l' : 'h', l, h, ans, shape },
        }, rand, 3);
      }
      if (step === 2) {
        const l = t.int(2, 6); let h = t.int(1, 4); if (h === l) h = h === 4 ? 3 : h + 1;
        const P = 2 * (l + h), shape = { kind: 'flat', l, h, cells: flatCells(l, h), pellets: true, field: true, marks: [{ a: [0, 0], b: [1, 0], text: cm(1) }] };
        const sides = [{ a: [0, 0], b: [l, 0], text: cm(l) }, { a: [0, h], b: [l, h], text: cm(l) }, { a: [0, 0], b: [0, h], text: cm(h) }, { a: [l, 0], b: [l, h], text: cm(h) }];
        return ownOrder({
          key: 'flat:round', story: 'A containment field runs round the edge of the box. Each pellet is 1 centimetre wide.', ask: 'How long is the field, all the way round?', right: C(P, CM),
          slips: [
            { ...C(l + h, CM), slip: 'twoSides', why: `${l} + ${h} is only two of its sides. The field goes all the way round: four sides.` },
            ...(h >= 2 ? [{ ...C(P - 4, CM), slip: 'edgePellets', why: 'That counts the pellets along the edge. A corner pellet has two sides on the edge: count sides, not pellets.' }] : []),
            { ...C(l * h, CM), slip: 'inside', why: `${l * h} is how many pellets are inside. The field runs round the outside edge.` },
            { ...C(2 * l + h, CM), slip: 'threeSides', why: 'That leaves out one side. Go all the way round: bottom, side, top, side.' },
            { ...C(P + 1, CM), slip: 'again', why: 'One too many. Mark where you start, and stop when you are back there.' },
            { ...C(P + 2, CM), slip: 'again', why: 'Two too many. Mark where you start, and stop when you are back there.' },
          ],
          rightWhy: `${l} + ${h} + ${l} + ${h} = ${u(P, CM)}`,
          sum: [{ op: 'add', a: l, b: l, say: 'The bottom and the top' }, { op: 'add', a: h, b: h, say: 'The two sides' }, { op: 'add', a: 2 * l, b: 2 * h, say: 'All four together' }],
          lead: shapeSvg(shape),
          help: { title: 'Four sides', svg: shapeSvg({ ...shape, marks: sides, caption: 'all the way round = ? centimetres' }, HELP), line: 'Go round the box one side at a time: the bottom, a side, the top, the other side. Add the four.', steps: [`The bottom and the top: ${l} + ${l}`, `The two sides: ${h} + ${h}`, 'Then add them together'] },
          own: { strand: 'geo', at: 18 }, credit: [{ strand: 'add', at: 12, weight: 0.5 }], facts: { kind: 'round', l, h, ans: P, shape }, size: 2,
        }, rand);
      }
      if (step === 3) {
        const l = t.int(2, 6), h = t.int(2, 5), n = l * h, shape = { kind: 'flat', l, h, cells: flatCells(l, h), pellets: true, field: true };
        const rows = Array.from({ length: h }, (_, y) => ({ x: l + 0.85, y: y + 0.5, text: String(l), size: 12 }));
        return ownOrder({
          key: 'flat:fill', story: 'Fuel pellets fill this flat box, row on row.', ask: 'How many pellets are in the box?', right: C(n, PEL),
          slips: [
            { ...C(l + h, PEL), slip: 'added', why: `That adds the two sides. Count every pellet: ${h} rows of ${l}.` },
            ...(l >= 3 && h >= 3 ? [{ ...C(2 * (l + h) - 4, PEL), slip: 'edgeOnly', why: 'That counts only the pellets along the edge. Count the ones in the middle too.' }] : []),
            { ...C(n - l, PEL), slip: 'rowShort', why: `That is ${u(h - 1, ROW)} of ${l}. Count the rows again: ${h}.` },
            { ...C(n + l, PEL), slip: 'rowOver', why: `That is ${h + 1} rows of ${l}. Count the rows again: ${h}.` },
            { ...C(n - 1, PEL), slip: 'off', why: 'One short. Count row by row, touching each pellet once.' },
          ],
          rightWhy: `${h} rows of ${l}: ${Array(h).fill(l).join(' + ')} = ${u(n, PEL)}`, sum: { op: 'mul', a: h, b: l, say: `${h} rows of ${l}` },
          lead: shapeSvg(shape),
          help: { title: 'Row by row', svg: shapeSvg({ ...shape, tags: rows, caption: `${h} rows of ${l} = ?` }, HELP), line: `Every row has ${l} pellets, and there are ${h} rows. Count one row, then count the rows.`, steps: [`${h} rows of ${l}: ${Array(h).fill(l).join(' + ')}`] },
          own: { strand: 'geo', at: 22 }, credit: [{ strand: 'mul', at: 14, weight: 0.5 }], facts: { kind: 'fill', l, h, ans: n, shape },
        }, rand);
      }
      if (step === 4 || step === 5) {
        const l = t.int(3, 9); let h = t.int(2, 8); if (h === l) h = h === 8 ? 7 : h + 1;
        const A = l * h, cells = flatCells(l, h), bottom = (text) => ({ a: [0, 0], b: [l, 0], text }), left = (text) => ({ a: [0, 0], b: [0, h], text });
        const rows = Array.from({ length: h }, (_, y) => ({ x: 0, y, l, h: 1, fill: y % 2 ? KEY.long : KEY.wide, fa: 0.16 }));
        if (step === 4) {
          const shape = { kind: 'flat', l, h, cells, pellets: false, field: true, marks: [bottom(cm(l)), left(cm(h))] };
          return ownOrder({
            key: 'flat:area', story: `This field is a flat box ${l} centimetres long and ${h} high. One pellet covers 1 square centimetre.`, ask: 'What is the area of the field?', right: C(A, CM2),
            slips: [
              { ...C(l + h, CM2), slip: 'added', why: `${l} + ${h} adds the two sides. Area is rows of squares: ${l} × ${h}.` },
              { ...C(2 * (l + h), CM2), slip: 'round', why: `That is the way round the edge. Area is the space inside: ${l} × ${h}.` },
              { ...C(A - l, CM2), slip: 'rowShort', why: `That is ${u(h - 1, ROW)} of ${l}. The box is ${h} high.` },
              { ...C(A + l, CM2), slip: 'rowOver', why: `That is ${h + 1} rows of ${l}. The box is ${h} high.` },
              { ...C(l * l, CM2), slip: 'sameSide', why: `That is ${l} × ${l}. The box is ${l} long but ${h} high.` },
            ],
            rightWhy: `${h} rows of ${l}: ${l} × ${h} = ${u(A, CM2)}`, sum: { op: 'mul', a: l, b: h },
            lead: shapeSvg(shape),
            help: { title: 'Rows of squares', svg: shapeSvg({ ...shape, bands: rows, caption: `${h} rows of ${l} squares: ${l} × ${h} = ?` }, HELP), line: `The box is ${h} rows, and every row is ${l} square centimetres. Multiply the two sides.`, steps: [`${h} rows of ${l}: ${l} × ${h}`] },
            own: { strand: 'geo', at: 32 }, credit: [{ strand: 'mul', at: 30, weight: 0.5 }], facts: { kind: 'area', l, h, ans: A, shape },
          }, rand);
        }
        const long = t.chance(0.5), g = long ? l : h, s = long ? h : l;   // the side given, and the side asked for
        const shape = { kind: 'flat', l, h, cells, pellets: false, field: true, marks: [bottom(long ? cm(l) : '?'), left(long ? '?' : cm(h))], note: `${A} sq cm` };
        return ownOrder({
          key: long ? 'flat:high?' : 'flat:long?', story: `The field is a flat box with an area of ${A} square centimetres. It is ${g} centimetres ${long ? 'long' : 'high'}.`, ask: long ? 'How high is it?' : 'How long is it?', right: C(s, CM),
          slips: [
            ...(A - g !== s ? [{ ...C(A - g, CM), slip: 'subtracted', why: `${A} − ${g} takes the side away from the area. Ask how many lots of ${g} make ${A}: divide.` }] : []),
            { ...C(g, CM), slip: 'same', why: `${g} is the side you were told. Find the other one: ${g} × ? = ${A}.` },
            { ...C(s + 1, CM), slip: 'off', why: `${g} × ${s + 1} is ${g * (s + 1)}, more than the ${A} there are.` },
            { ...C(s - 1, CM), slip: 'off', why: `${g} × ${s - 1} is only ${g * (s - 1)}. The area is ${A}.` },
            { ...C(s + 2, CM), slip: 'off', why: `${g} × ${s + 2} is ${g * (s + 2)}, more than the ${A} there are.` },
          ],
          rightWhy: `${g} × ${s} = ${A}, so ${A} ÷ ${g} = ${u(s, CM)}`, sum: { op: 'div', a: A, b: g },
          lead: shapeSvg(shape),
          help: { title: 'How many make the area', svg: shapeSvg({ ...shape, caption: `${g} × ? = ${A}` }, HELP), line: long ? `Every row is ${g} square centimetres. How many rows make ${A}?` : `Every column is ${g} square centimetres. How many columns make ${A}?`, steps: [`${A} ÷ ${g}`] },
          own: { strand: 'geo', at: 36 }, credit: [{ strand: 'div', at: 30, weight: 0.5 }], facts: { kind: 'side', ask: long ? 'h' : 'l', l, h, area: A, ans: s, shape },
        }, rand);
      }
      // an L-shape: a lower box the whole length, and an upper box on part of it (the corner cut out on the right, or on the left)
      const L = t.int(4, 8), H = t.int(4, 6), b = t.int(2, H - 2), ch = H - b, cl = t.int(2, L - 2), top = L - cl, flip = t.chance(0.5);
      const cells = flatCells(L, H).filter(([x, y]) => y < b || (flip ? x >= cl : x < top)), A = L * b + top * ch;
      const X = (x) => (flip ? L - x : x), seg = (x0, y0, x1, y1, text, out) => ({ a: [Math.min(X(x0), X(x1)), y0], b: [Math.max(X(x0), X(x1)), y1], text, ...(out ? { out } : {}) });
      const shape = { kind: 'flat', l: L, h: H, cells, pellets: false, field: true,
        marks: [seg(0, 0, L, 0, cm(L)), seg(0, 0, 0, H, cm(H)), seg(0, H, top, H, cm(top)), seg(top, b, top, H, cm(ch)), seg(top, b, L, b, cm(cl), [0, -1]), seg(L, 0, L, b, cm(b))] };
      const lower = { x: 0, y: 0, l: L, h: b, fill: KEY.long, fa: 0.2, stroke: KEY.long }, upper = { x: flip ? cl : 0, y: b, l: top, h: ch, fill: KEY.wide, fa: 0.2, stroke: KEY.wide };
      return ownOrder({
        key: 'flat:bend', story: 'This field bends round a corner. Its sides are marked in centimetres.', ask: 'What is the area of the field?', right: C(A, CM2),
        slips: [
          { ...C(L * H, CM2), slip: 'wholeBox', why: `${L} × ${H} is the whole box, with the missing corner counted. Split the shape into two boxes instead.` },
          { ...C(L * b, CM2), slip: 'onePart', why: `${L * b} is only the lower box. Add the upper one too.` },
          { ...C(A + top * b, CM2), slip: 'twice', why: 'That counts the part where the two boxes cross twice. Cut the shape so the boxes do not overlap.' },
          { ...C(2 * (L + H), CM2), slip: 'round', why: 'That adds up the sides: the way round the edge. Area is the space inside.' },
          { ...C(top * ch, CM2), slip: 'onePart', why: `${top * ch} is only the upper box. Add the lower one too.` },
        ],
        rightWhy: `${L} × ${b} = ${L * b} and ${top} × ${ch} = ${top * ch}; ${L * b} + ${top * ch} = ${u(A, CM2)}`,
        sum: [{ op: 'mul', a: L, b, say: 'First the lower box' }, { op: 'mul', a: top, b: ch, say: 'Then the upper box' }, { op: 'add', a: L * b, b: top * ch, say: 'Then the two together' }],
        lead: shapeSvg(shape),
        help: { title: 'Split it into two boxes', svg: shapeSvg({ ...shape, bands: [lower, upper], tags: [{ x: upper.x + top / 2, y: b / 2, text: `${L} × ${b}`, plate: true }, { x: upper.x + top / 2, y: b + ch / 2, text: `${top} × ${ch}`, plate: true }], caption: 'the lower box + the upper box = ?' }, HELP), line: 'Cut the shape into two boxes. Work out the area of each, then add them.', steps: [`The lower box: ${L} × ${b}`, `The upper box: ${top} × ${ch}`, 'Then add the two'] },
        own: { strand: 'geo', at: 42 }, credit: [{ strand: 'mul', at: 30, weight: 0.5 }], facts: { kind: 'bend', l: L, h: H, lower: [L, b], upper: [top, ch], ans: A, shape }, size: 3,
      }, rand);
    },
  },

  // ── A BOX IN 3D: a block of pellets, then the field as a see-through box with its sides marked ───────────────────
  // step 1  a block of pellets in layers: how many in all
  // step 2  the field's volume from its sides
  // step 3  a missing side, from the volume and the other two
  // step 4  the frame: all 12 edges
  // step 5  the skin: all six faces
  box: {
    strand: 'geo', at: (step) => [46, 50, 54, 58, 64][Math.max(1, Math.min(5, step)) - 1],
    make(step, { rand = Math.random } = {}) {
      const t = kit(rand);
      if (step <= 1) {
        const l = t.int(2, 4), w = t.int(2, 3), h = Math.min(t.int(2, 4), Math.floor(36 / (l * w))), lw = l * w, V = lw * h, seen = lw + l * h + w * h - l - w - h + 1;
        const cells = boxCells(l, w, h), shape = { kind: 'block', l, w, h, cells, pellets: true, field: false };
        return ownOrder({
          key: 'box:block', story: 'Now the pellets are stacked in a block, layer on layer.', ask: 'How many pellets are in the block?', right: C(V, PEL),
          slips: [
            { ...C(lw, PEL), slip: 'oneLayer', why: `${lw} is one layer. The block is ${h} layers high.` },
            { ...C(seen, PEL), slip: 'seenOnly', why: 'That counts only the pellets you can see. More are hidden inside and behind.' },
            { ...C(l + w + h, PEL), slip: 'added', why: 'That adds the three sides. Count one layer, then the layers.' },
            { ...C(V - lw, PEL), slip: 'layerShort', why: `That is ${u(h - 1, LAYER)}. Count the layers again: ${h}.` },
            { ...C(V + lw, PEL), slip: 'layerOver', why: `That is ${h + 1} layers. Count the layers again: ${h}.` },
          ],
          rightWhy: `${l} × ${w} = ${lw} in a layer; ${h} layers: ${lw} × ${h} = ${u(V, PEL)}`,
          sum: [{ op: 'mul', a: l, b: w, say: 'First one layer' }, { op: 'mul', a: lw, b: h, say: `Then ${h} layers` }],
          lead: shapeSvg(shape),
          help: { title: 'Layer by layer', svg: plansSvg({ cells, l, w, h, caption: `${h} layers of ${l} × ${w} = ?` }), line: `Here is the block taken apart. Every layer is ${l} pellets by ${w}, and there are ${h} layers.`, steps: [`One layer: ${l} × ${w}`, `${h} layers: that × ${h}`] },
          own: { strand: 'geo', at: 46 }, credit: [{ strand: 'mul', at: 30, weight: 0.5 }], facts: { kind: 'block', l, w, h, ans: V, shape }, size: 2,
        }, rand);
      }
      if (step === 2 || step === 3) {
        let l = 0, w = 0, h = 0; do { l = t.int(2, 6); w = t.int(2, 5); h = t.int(2, 5); } while (l * w * h > 120);
        const lw = l * w, V = lw * h, cells = boxCells(l, w, h), marks = (hi) => [{ axis: 'l', text: cm(l) }, { axis: 'w', text: cm(w) }, { axis: 'h', text: hi }];
        // (the help: the field with one layer of pellets on its floor)
        const floor = (hi, note) => shapeSvg({ kind: 'block', l, w, h, cells: boxCells(l, w, 1), pellets: true, field: true, marks: marks(hi), ...(note ? { note } : {}) });
        if (step === 2) {
          const shape = { kind: 'box', l, w, h, cells, pellets: false, field: true, marks: marks(cm(h)) };
          return ownOrder({
            key: 'box:volume', story: `The field is a box ${l} centimetres long, ${w} wide and ${h} high. One pellet fills 1 cubic centimetre.`, ask: 'What is the volume of the field?', right: C(V, CM3),
            slips: [
              { ...C(l + w + h, CM3), slip: 'added', why: 'That adds the three sides. Volume is one layer times the layers: long × wide × high.' },
              { ...C(lw, CM3), slip: 'oneLayer', why: `${l} × ${w} is only the bottom layer. The box is ${h} layers high.` },
              { ...C(2 * (lw + l * h + w * h), CM3), slip: 'skin', why: 'That is the area of its six faces. Volume is the space inside.' },
              { ...C(V + lw, CM3), slip: 'layerOver', why: `That is ${h + 1} layers. The box is ${h} centimetres high.` },
              { ...C(V - lw, CM3), slip: 'layerShort', why: `That is ${u(h - 1, LAYER)}. The box is ${h} centimetres high.` },
            ],
            rightWhy: `${l} × ${w} = ${lw} in a layer; ${h} layers: ${lw} × ${h} = ${u(V, CM3)}`,
            sum: [{ op: 'mul', a: l, b: w, say: 'First the bottom layer' }, { op: 'mul', a: lw, b: h, say: `Then ${h} layers` }],
            lead: shapeSvg(shape),
            help: { title: 'Layer by layer', svg: floor(cm(h)), line: `One layer of pellets covers the floor: ${l} long and ${w} wide. The box holds ${h} of those layers.`, steps: [`First the bottom layer: ${l} × ${w}`, `Then ${h} layers: that × ${h}`] },
            own: { strand: 'geo', at: 50 }, credit: [{ strand: 'mul', at: 30, weight: 0.5 }], facts: { kind: 'volume', l, w, h, ans: V, shape }, size: 2,
          }, rand);
        }
        const shape = { kind: 'box', l, w, h, cells, pellets: false, field: true, marks: marks('?'), note: `${V} cubic cm in all` };
        return ownOrder({
          key: 'box:high?', story: `The field's volume is ${V} cubic centimetres. It is ${l} centimetres long and ${w} wide.`, ask: 'How high is it?', right: C(h, CM),
          slips: [
            { ...C(V / l, CM), slip: 'oneOnly', why: `${V} ÷ ${l} uses only the length. Divide by the whole bottom layer: ${l} × ${w}.` },
            ...(lw !== h ? [{ ...C(lw, CM), slip: 'layer', why: `${lw} is the bottom layer. How many layers of ${lw} make ${V}?` }] : []),
            ...(V - l - w > 0 ? [{ ...C(V - l - w, CM), slip: 'subtracted', why: `That takes the sides away from the volume. Ask how many layers of ${lw} make ${V}: divide.` }] : []),
            { ...C(h + 1, CM), slip: 'off', why: `${h + 1} layers of ${lw} make ${lw * (h + 1)}, more than the ${V} there are.` },
            { ...C(h - 1, CM), slip: 'off', why: `${u(h - 1, LAYER)} of ${lw} ${h - 1 === 1 ? 'makes' : 'make'} only ${lw * (h - 1)}. The volume is ${V}.` },
          ],
          rightWhy: `${l} × ${w} = ${lw} in a layer; ${V} ÷ ${lw} = ${h} layers: ${u(h, CM)} high`,
          sum: [{ op: 'mul', a: l, b: w, say: 'First the bottom layer' }, { op: 'div', a: V, b: lw, say: 'Then how many layers make the volume' }],
          lead: shapeSvg(shape),
          help: { title: 'How many layers', svg: floor('?', `${V} cubic cm in all`), line: `One layer of pellets covers the floor: ${l} long and ${w} wide. How many of those layers make ${V}?`, steps: [`First the bottom layer: ${l} × ${w}`, `Then the layers: ${V} ÷ that`] },
          own: { strand: 'geo', at: 54 }, credit: [{ strand: 'div', at: 30, weight: 0.5 }], facts: { kind: 'high', l, w, h, volume: V, ans: h, shape }, size: 2,
        }, rand);
      }
      if (step === 4) {
        const l = t.int(2, 9), w = t.int(2, 6), h = t.int(2, 6), F = 4 * (l + w + h), marks = [{ axis: 'l', text: cm(l) }, { axis: 'w', text: cm(w) }, { axis: 'h', text: cm(h) }];
        const shape = { kind: 'box', l, w, h, cells: boxCells(l, w, h), pellets: false, field: true, frame: true, marks };
        return ownOrder({
          key: 'box:frame', story: `The field's frame runs along every edge of the box: ${l} centimetres long, ${w} wide and ${h} high.`, ask: 'How long is the frame in all?', right: C(F, CM),
          slips: [
            { ...C(l + w + h, CM), slip: 'oneEach', why: 'That is one edge of each kind. A box has 4 long edges, 4 wide ones and 4 high ones.' },
            { ...C(2 * (l + w + h), CM), slip: 'twoEach', why: 'That is two of each edge. There are four of each: 12 edges in all.' },
            { ...C(4 * (l + w), CM), slip: 'noUprights', why: 'That leaves out the four edges that stand up.' },
            { ...C(l * w * h, CM), slip: 'volume', why: 'That is the volume, the space inside. The frame is the length of the edges.' },
            { ...C(12 * l, CM), slip: 'allLong', why: `That is 12 edges of ${l}. Only 4 of them are ${l} long.` },
            { ...C(3 * (l + w + h), CM), slip: 'threeEach', why: 'That is three of each edge. There are four of each: 12 edges in all.' },
          ],
          rightWhy: `4 × ${l} = ${4 * l}, 4 × ${w} = ${4 * w}, 4 × ${h} = ${4 * h}; ${4 * l} + ${4 * w} + ${4 * h} = ${u(F, CM)}`,
          sum: [{ op: 'mul', a: 4, b: l, say: 'The 4 long edges' }, { op: 'mul', a: 4, b: w, say: 'The 4 wide edges' }, { op: 'mul', a: 4, b: h, say: 'The 4 high edges' }, { op: 'add', a: 4 * l, b: 4 * w, say: 'The long and the wide together' }, { op: 'add', a: 4 * l + 4 * w, b: 4 * h, say: 'And the high ones' }],
          lead: shapeSvg(shape),
          help: { title: '4 + 4 + 4 edges', svg: shapeSvg({ ...shape, edgeTones: true, marks: [], legend: [{ fill: KEY.long, text: `4 long: ${cm(l)}` }, { fill: KEY.wide, text: `4 wide: ${cm(w)}` }, { fill: KEY.high, text: `4 high: ${cm(h)}` }] }), line: 'A box has 12 edges: 4 long ones, 4 wide ones and 4 high ones.', steps: [`The 4 long edges: 4 × ${l}`, `The 4 wide edges: 4 × ${w}`, `The 4 high edges: 4 × ${h}`, 'Then add the three'] },
          own: { strand: 'geo', at: 58 }, credit: [{ strand: 'mul', at: 30, weight: 0.5 }], facts: { kind: 'frame', l, w, h, ans: F, shape }, size: 3,
        }, rand);
      }
      const l = t.int(2, 6), w = t.int(2, 4), h = t.int(2, 5), lw = l * w, lh = l * h, wh = w * h, half = lw + lh + wh, S = 2 * half;
      const shape = { kind: 'box', l, w, h, cells: boxCells(l, w, h), pellets: false, field: true, skin: true, marks: [{ axis: 'l', text: cm(l) }, { axis: 'w', text: cm(w) }, { axis: 'h', text: cm(h) }] };
      return ownOrder({
        key: 'box:skin', story: `The field's skin covers all six faces of the box: ${l} centimetres long, ${w} wide and ${h} high.`, ask: 'What is the area of the skin?', right: C(S, CM2),
        slips: [
          { ...C(half, CM2), slip: 'onePair', why: 'That is one face of each pair. Every face has a twin on the far side: double it.' },
          { ...C(lw * h, CM2), slip: 'volume', why: 'That is the volume, the space inside. The skin is the area of the six faces.' },
          { ...C(S - lw, CM2), slip: 'noBottom', why: 'That leaves out one face. Count all six: top, bottom, front, back and the two ends.' },
          { ...C(4 * (l + w + h), CM2), slip: 'frame', why: 'That is the frame, the length of the edges. The skin is the area of the faces.' },
          { ...C(6 * lw, CM2), slip: 'allSame', why: `That is six faces of ${l} × ${w}. Only the top and the bottom are that size.` },
        ],
        rightWhy: `${l} × ${w} = ${lw}, ${l} × ${h} = ${lh}, ${w} × ${h} = ${wh}; ${lw} + ${lh} + ${wh} = ${half}, and twice that is ${u(S, CM2)}`,
        sum: [{ op: 'mul', a: l, b: w, say: 'The top face' }, { op: 'mul', a: l, b: h, say: 'The front face' }, { op: 'mul', a: w, b: h, say: 'An end face' }, { op: 'add', a: lw, b: lh, say: 'The top and the front together' }, { op: 'add', a: lw + lh, b: wh, say: 'And the end' }, { op: 'mul', a: half, b: 2, say: 'Each of the three has a twin' }],
        lead: shapeSvg(shape),
        help: { title: 'Faces in pairs', svg: pairsSvg({ l, w, h, caption: 'all six faces = ?' }), line: 'A box has six faces in three pairs: top and bottom, front and back, and the two ends.', steps: [`Top and bottom: ${l} × ${w}, twice`, `Front and back: ${l} × ${h}, twice`, `The two ends: ${w} × ${h}, twice`, 'Then add them all'] },
        own: { strand: 'geo', at: 64 }, credit: [{ strand: 'mul', at: 30, weight: 0.5 }], facts: { kind: 'skin', l, w, h, ans: S, shape }, size: 3,
      }, rand);
    },
  },

  // ── A CLUSTER: pellets stuck together, turned to see every side ──────────────────────────────────────────────────
  // step 1  how many pellets are in it, hidden ones included
  // step 2  the field round it, the smallest box that holds it: its volume
  // step 3  how much of that box is empty
  // step 4  its own skin: the faces that show on the outside
  cluster: {
    strand: 'geo', at: (step) => [66, 70, 74, 80][Math.max(1, Math.min(4, step)) - 1],
    make(step, { rand = Math.random } = {}) {
      const s = Math.max(1, Math.min(4, step)), G = clusterOf(rand, s, { some: s === 2 || s === 3 }), { n, S, cells, layers } = G, { l, w, h } = S, V = l * w * h, lw = l * w;
      const laid = layers.join(' + '), plans = (box, caption) => plansSvg({ cells, l, w, h, box, caption });
      const facts = { l, w, h, n, seen: G.seen, layers };
      if (s === 1) {
        return ownOrder({
          key: 'cluster:count', story: 'The pellets have stuck together in a cluster. Drag it round to see every side.', ask: 'How many pellets are in the cluster?', right: C(n, PEL),
          slips: [
            ...(G.seen < n ? [{ ...C(G.seen, PEL), slip: 'seenOnly', why: 'That counts only the pellets you can see from one side. Drag it round: some are hidden behind.' }] : []),
            ...(G.stacks !== n ? [{ ...C(G.stacks, PEL), slip: 'tops', why: 'That counts the stacks from above. Some stacks are more than one pellet high.' }] : []),
            { ...C(n + 1, PEL), slip: 'off', why: 'One too many. Count layer by layer, so no pellet is counted twice.' },
            { ...C(n - 1, PEL), slip: 'off', why: 'One short. Turn it round and count layer by layer: one is hiding.' },
            { ...C(n + 2, PEL), slip: 'off', why: 'Two too many. Count layer by layer, so no pellet is counted twice.' },
          ],
          rightWhy: h > 1 ? `Layer by layer: ${laid} = ${u(n, PEL)}` : `One layer of ${u(n, PEL)}`, sum: h > 1 ? addUp(layers) : null,
          lead: shapeSvg(G.shape),
          help: { title: 'Layer by layer', svg: plans(false, h > 1 ? 'all the layers together = ?' : ''), line: 'Here is the cluster taken apart, one layer at a time, each seen from above. Count each layer, then add them.', steps: h > 1 ? [`Add the layers: ${laid}`] : [] },
          own: { strand: 'geo', at: 66 }, credit: [{ strand: 'add', at: 12, weight: 0.5 }], facts: { kind: 'count', ...facts, ans: n, shape: G.shape }, size: Math.min(3, h),
        }, rand);
      }
      const shape = { ...G.shape, field: s !== 4 };
      if (s === 2) {
        return ownOrder({
          key: 'cluster:box', story: 'The field is the smallest box that holds the whole cluster. Each pellet is 1 centimetre wide.', ask: 'What is the volume of the field?', right: C(V, CM3),
          slips: [
            { ...C(n, CM3), slip: 'pelletsOnly', why: 'That is the pellets. The field is the whole box round them, the empty places too.' },
            { ...C(l + w + h, CM3), slip: 'added', why: 'That adds the three sides. Volume is long × wide × high.' },
            ...(h > 1 ? [{ ...C(lw, CM3), slip: 'oneLayer', why: `${lw} is one layer of the box. The box is ${h} layers high.` }] : []),
            { ...C(V + lw, CM3), slip: 'layerOver', why: `That is ${h + 1} layers. The cluster is ${h} high at its highest.` },
            { ...C(V - lw, CM3), slip: 'layerShort', why: `That is ${u(h - 1, LAYER)}. The cluster is ${h} high at its highest.` },
            { ...C(V + l * h, CM3), slip: 'sideOver', why: `That box is ${w + 1} wide. The cluster is ${w} wide at its widest.` },
          ],
          rightWhy: `The box is ${l} long, ${w} wide and ${h} high: ${l} × ${w} × ${h} = ${u(V, CM3)}`,
          sum: [{ op: 'mul', a: l, b: w, say: 'First one layer of the box' }, { op: 'mul', a: lw, b: h, say: `Then ${u(h, LAYER)}` }],
          lead: shapeSvg(shape),
          help: { title: 'The box round it', svg: plans(true, `${u(h, LAYER)} of ${l} × ${w} places = ?`), line: `The box is as long, as wide and as high as the cluster is at its longest: ${l} long, ${w} wide, ${h} high. Here it is layer by layer, the empty places dotted.`, steps: [`One layer of the box: ${l} × ${w}`, `${u(h, LAYER)}: that × ${h}`] },
          own: { strand: 'geo', at: 70 }, credit: [{ strand: 'mul', at: 30, weight: 0.5 }], facts: { kind: 'fieldBox', ...facts, ans: V, shape }, size: 2,
        }, rand);
      }
      if (s === 3) {
        const E = V - n;
        return ownOrder({
          key: 'cluster:empty', story: 'The field is the smallest box that holds the whole cluster. One pellet fills 1 cubic centimetre.', ask: 'How much of the field is empty?', right: C(E, CM3),
          slips: [
            { ...C(V, CM3), slip: 'wholeBox', why: `${V} is the whole box. Take away the room the pellets fill.` },
            { ...C(n, CM3), slip: 'pellets', why: `${n} is the room the pellets fill. The empty part is the rest of the box.` },
            ...(G.seen < n ? [{ ...C(V - G.seen, CM3), slip: 'seenOnly', why: 'That takes away only the pellets you can see from one side. Count the hidden ones too.' }] : []),
            { ...C(V + n, CM3), slip: 'added', why: 'That adds the pellets to the box. They are inside it: take them away.' },
            { ...C(E + 1, CM3), slip: 'off', why: 'One too many. Count the pellets again, layer by layer.' },
            { ...C(E - 1, CM3), slip: 'off', why: 'One short. Count the pellets again, layer by layer.' },
          ],
          rightWhy: `The box is ${l} × ${w} × ${h} = ${V}; ${V} − ${u(n, PEL)} = ${u(E, CM3)}`,
          sum: [{ op: 'mul', a: l, b: w, say: 'First one layer of the box' }, { op: 'mul', a: lw, b: h, say: 'Then the whole box' }, { op: 'sub', a: V, b: n, say: `Then take away the ${n} pellets` }],
          lead: shapeSvg(shape),
          help: { title: 'The box, less the pellets', svg: plans(true, 'the dotted places are empty: how many?'), line: 'Work out the whole box, count the pellets, and take them away. Or count the dotted places, layer by layer.', steps: [`The box: ${l} × ${w} × ${h}`, `The pellets, layer by layer: ${laid}`, 'Then the box take away the pellets'] },
          own: { strand: 'geo', at: 74 }, credit: [{ strand: 'sub', at: 30, weight: 0.5 }], facts: { kind: 'empty', ...facts, box: V, ans: E, shape }, size: 3,
        }, rand);
      }
      const { skin, up, down, side, front } = G, boxSkin = 2 * (lw + l * h + w * h);
      return ownOrder({
        key: 'cluster:skin', story: 'The skin is every pellet face that shows on the outside. Drag it round to look underneath.', ask: 'How many faces show on the outside?', right: C(skin, FACE),
        slips: [
          { ...C(skin / 2, FACE), slip: 'threeSides', why: 'That counts the faces on three sides. The back, the bottom and the far side have as many again.' },
          { ...C(6 * n, FACE), slip: 'everyFace', why: 'That counts six faces on every pellet. A face pressed against another pellet does not show.' },
          { ...C(skin - down, FACE), slip: 'noBottom', why: 'That leaves out the faces underneath. Drag it over and count those too.' },
          ...(boxSkin !== skin ? [{ ...C(boxSkin, FACE), slip: 'boxSkin', why: 'That is the skin of the box round it. Count the cluster\'s own faces, dents and all.' }] : []),
          { ...C(n, FACE), slip: 'pellets', why: 'That is the pellets. Count the faces of them that show.' },
        ],
        rightWhy: `Up and down ${up} + ${up}, front and back ${front} + ${front}, the two sides ${side} + ${side}: ${u(skin, FACE)}`,
        sum: [{ op: 'add', a: up, b: front, say: 'The faces pointing up, and to the front' }, { op: 'add', a: up + front, b: side, say: 'And to one side' }, { op: 'mul', a: up + front + side, b: 2, say: 'As many again point the other three ways' }],
        lead: shapeSvg(shape),
        help: { title: 'Six ways to point', svg: shapeSvg({ ...shape, tones: true, legend: [{ fill: KEY.faceY, text: 'up, down' }, { fill: KEY.faceZ, text: 'front, back' }, { fill: KEY.faceX, text: 'the two sides' }] }), line: 'Count the faces that point up. Just as many point down. Do the same for front and back, and for the two sides.', steps: [`Up ${up}, and down ${up}`, `Front ${front}, and back ${front}`, `One side ${side}, and the other ${side}`, `Add them: ${up} + ${up} + ${front} + ${front} + ${side} + ${side}`] },
        own: { strand: 'geo', at: 80 }, credit: [{ strand: 'add', at: 30, weight: 0.5 }], facts: { kind: 'clusterSkin', ...facts, up, down, side, front, ans: skin, shape }, size: 3,
      }, rand);
    },
  },
};

// ── the ladder: easiest first ─────────────────────────────────────────────────────────────────────────────────────
const M = (maker, step, w = 1) => ({ maker, step, w });

export const PLACE = {
  id: 'engineer', name: 'The Miner\'s core', short: 'Engineer', math: 'Fuel pellets and their containment field: sides, the way round, area, volume, edges and faces', pic: 'smelter', job: null,
  line: 'The fuel pellets in the core and the containment field round them: a flat box on a grid, a block in layers, a cluster to turn.',
  levels: [
    { id: 'sides', title: 'The sides of a flat box', line: 'Count the pellets along a side: how long, how high', gen: { mix: [M('flat', 1)] } },
    { id: 'round', title: 'All the way round', line: 'The field round a flat box: 4 and 3 and 4 and 3', gen: { mix: [M('flat', 2)] } },
    { id: 'fill', title: 'Pellets in a flat box', line: '4 rows of 5 pellets', gen: { mix: [M('flat', 3)] } },
    { id: 'area', title: 'Area by the sides', line: '6 centimetres long, 4 high: 6 × 4', gen: { mix: [M('flat', 4)] } },
    { id: 'areaSide', title: 'A missing side', line: '24 square centimetres, 6 long: how high', gen: { mix: [M('flat', 5)] } },
    { id: 'bend', title: 'Round a corner', line: 'An L-shape, split into two boxes', gen: { mix: [M('flat', 6)] } },
    { id: 'block', title: 'A block in layers', line: '3 layers of 4 by 2 pellets', gen: { mix: [M('box', 1)] } },
    { id: 'volume', title: 'Volume by the sides', line: '4 long, 3 wide, 2 high: 4 × 3 × 2', gen: { mix: [M('box', 2)] } },
    { id: 'volSide', title: 'A missing side of a box', line: '24 cubic centimetres, 4 long, 3 wide: how high', gen: { mix: [M('box', 3)] } },
    { id: 'frame', title: 'The frame', line: 'All 12 edges: 4 long, 4 wide, 4 high', gen: { mix: [M('box', 4)] } },
    { id: 'skin', title: 'The skin', line: 'All six faces, in three pairs', gen: { mix: [M('box', 5)] } },
    { id: 'cluster', title: 'A cluster to turn', line: 'How many pellets, hidden ones too', gen: { mix: [M('cluster', 1)] } },
    { id: 'fieldBox', title: 'The field round a cluster', line: 'The smallest box that holds it: its volume', gen: { mix: [M('cluster', 2)] } },
    { id: 'empty', title: 'The empty part of the field', line: 'The box take away the pellets', gen: { mix: [M('cluster', 3)] } },
    { id: 'clusterSkin', title: 'The cluster\'s own skin', line: 'Every face that shows on the outside', gen: { mix: [M('cluster', 4)] } },
  ],
};

export const JOB = {
  // (not one of the station's job spots, src/jobs/index.js JOBS, and not on a contract yet: its cards will be asked at
  // the Miner's core on a captain's run. The card's top and its display come from the panel's `live` for this job:
  // src/jobs/engview.js engineerLink())
  id: 'engineer', name: 'Reactor core', short: 'Engineer', open: true, seated: true,
  spot: null, sign: 'The Miner\'s core', hint: 'Check the containment field',
  place: PLACE, setting: SETTING, makers: MAKERS,
  card: 'core',
  dark: true,      // its pictures are drawn dark, with light lines
};
