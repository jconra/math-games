// THE DECOR FILE, written: what differs between the town as shipped (models/town/layout.json, planting.json) and the town
// as decorated here, as models/town/decor.json (its fields: world/objects/decor.js, which the game reads it with).
//   makeDecor({ layout, planting }, { layout, planting }, nameOf) -> the decor object (shipped first, decorated second;
//     both layouts normalised the same way; nameOf(stroke or item) -> a few words noted on each planting entry, or '')
//   decorText(decor) -> the file's text: one line a thing, so it reads (and diffs) easily
const r2 = (v) => Math.round(+v * 100) / 100;
const same = (a, b) => Math.abs((+a || 0) - (+b || 0)) < 0.005;
const strokeKey = (s) => JSON.stringify([s.mode, s.kind, s.r, s.density, s.size, s.seed, s.pts]);
const itemKey = (i) => JSON.stringify([i.kind, i.x, i.y, i.z, i.rx, i.ry, i.rz, i.sx, i.sy, i.sz, i.clear]);

export function makeDecor(shipped, now, nameOf = () => '') {
  const out = { v: 1 }, was = new Map(shipped.layout.items.map((it) => [it.id, it])), here = new Set(now.layout.items.map((it) => it.id));
  // the shipped things moved, turned, sized, lifted or levelled; and taken away
  const moved = {};
  for (const it of now.layout.items) {
    const o = was.get(it.id); if (!o) continue;
    const m = {};
    if (!same(it.x, o.x) || !same(it.z, o.z)) { m.x = r2(it.x); m.z = r2(it.z); }
    if (!same(it.rot, o.rot)) m.rot = r2(it.rot);
    if (!same(it.y, o.y)) m.y = r2(it.y || 0);
    if (!same(it.size, o.size)) m.size = r2(it.size);
    if ((it.level === true) !== (o.level === true)) m.level = it.level === true;
    if (Object.keys(m).length) moved[it.id] = m;
  }
  if (Object.keys(moved).length) out.moved = moved;
  const removed = shipped.layout.items.filter((it) => !here.has(it.id)).map((it) => it.id);
  if (removed.length) out.removed = removed;
  // the things put down
  const placed = now.layout.items.filter((it) => !was.has(it.id)).map((it) => ({ type: it.type, kind: it.kind, x: r2(it.x), z: r2(it.z), rot: r2(it.rot),
    ...(same(it.size ?? 1, 1) && it.type !== 'model' ? {} : { size: r2(it.size ?? 1) }), ...(it.y ? { y: r2(it.y) } : {}), ...(it.level === true ? { level: true } : {}) }));
  if (placed.length) out.placed = placed;
  // stone roads: those painted after the shipped ones
  const R0 = shipped.layout.roads || [], R1 = now.layout.roads || [];
  if (R1.length > R0.length) out.roads = R1.slice(R0.length);
  // the planting: strokes and placed plants added (in order, after the shipped ones), and any shipped ones gone
  const P0 = shipped.planting, P1 = now.planting, s0 = new Map(P0.strokes.map((s) => [s.id, strokeKey(s)])), i0 = new Map(P0.items.map((i) => [i.id, itemKey(i)]));
  const s1 = new Set(P1.strokes.filter((s) => s0.get(s.id) === strokeKey(s)).map((s) => s.id)), i1 = new Set(P1.items.filter((i) => i0.get(i.id) === itemKey(i)).map((i) => i.id));
  const note = (o) => { const n = nameOf(o); return n ? { name: n } : {}; };
  const strokes = P1.strokes.filter((s) => !s1.has(s.id)).map((s) => ({ ...note(s), mode: s.mode, kind: s.kind, r: s.r, density: s.density, size: s.size, seed: s.seed, pts: s.pts }));
  const items = P1.items.filter((i) => !i1.has(i.id)).map((i) => { const { id, ...rest } = i; return { ...note(i), ...rest }; });
  const gone = [...P0.strokes.filter((s) => !s1.has(s.id)), ...P0.items.filter((i) => !i1.has(i.id))].map((s) => s.id);
  const pl = {};
  if (strokes.length) pl.strokes = strokes;
  if (items.length) pl.items = items;
  if (gone.length) pl.removed = gone;
  if (!!P1.procedural !== !!P0.procedural) pl.procedural = !!P1.procedural;
  if (Object.keys(pl).length) out.planting = pl;
  return out;
}

export function decorText(d) {
  const J = JSON.stringify, lines = ['{', `  "v": ${d.v || 1}`];
  const list = (key, arr, ind = '  ') => `${ind}${J(key)}: [\n${arr.map((x) => `${ind}  ${J(x)}`).join(',\n')}\n${ind}]`;
  const parts = [];
  if (d.moved) parts.push(`  "moved": {\n${Object.entries(d.moved).map(([k, v]) => `    ${J(k)}: ${J(v)}`).join(',\n')}\n  }`);
  if (d.removed) parts.push(`  "removed": ${J(d.removed)}`);
  if (d.placed) parts.push(list('placed', d.placed));
  if (d.roads) parts.push(list('roads', d.roads));
  if (d.planting) {
    const P = d.planting, inner = [];
    if (P.strokes) inner.push(list('strokes', P.strokes, '    '));
    if (P.items) inner.push(list('items', P.items, '    '));
    if (P.removed) inner.push(`    "removed": ${J(P.removed)}`);
    if ('procedural' in P) inner.push(`    "procedural": ${J(P.procedural)}`);
    parts.push(`  "planting": {\n${inner.join(',\n')}\n  }`);
  }
  return [lines[0], [lines[1], ...parts].join(',\n'), '}'].join('\n') + '\n';
}
