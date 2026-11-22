// SHIP EMBLEMS (options, the Ship Lab only): a glowing line-art emblem for the Miner, the Explorer and the Hauler, in
// the style of the Medic's pulse line (kit/ships/medic-built.js MARKS.pulse: a thin glowing ribbon laid 1.4 cm off the
// skin, on each side, aft of the bay; the game's maker: "I like this emissive symbol on the medic"). Nothing here is in
// the game: each ship has two or three designs to pick from (SUNDAY.md item 11); the one picked moves into the ship's
// own marks piece.
// A design is strokes of line art, drawn as seen from the side it is on (x to the right, y up, metres, about its
// middle), so it reads the same way round on both sides (the Medic's own trace runs fore to aft on both, so it is
// mirrored on the starboard side). Each stroke is a list of points (closed: it joins back to its start); a point is
// found on the hull by a ray in from outside (as the ships' own marks are) and the ribbon is laid along the face it
// lands on. The colour is the ship's job colour's light lines (kit/crew.js JOBS: the Medic's teal is its own), the
// Explorer's (it has none) its own light strips' blue. (No three.js import here: the lab hands it in, so the designs
// load in node for the tests.)

// (a circle's or an ellipse's points: centre, radii, from angle a0 to a1, n steps)
const arc = (cx, cy, rx, ry, a0, a1, n = 24, tilt = 0) => {
  const out = [], c = Math.cos(tilt), s = Math.sin(tilt);
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, x = rx * Math.cos(a), y = ry * Math.sin(a); out.push([cx + x * c - y * s, cy + x * s + y * c]); }
  return out;
};
const ring = (cx, cy, r, n = 28) => arc(cx, cy, r, r, 0, Math.PI * 2, n).slice(0, -1);
const box = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const closed = (pts) => ({ pts, closed: true });

// a pickaxe: its handle from the grip (gx, gy) to the head (hx, hy), a little of it standing out over the head; the
// head a crescent across the handle's end, bowed away from the grip, thickest in the middle, its two points drooping
// back toward the grip (half its span w, its bow b)
function pick(gx, gy, hx, hy, w, b) {
  const L = Math.hypot(hx - gx, hy - gy), ux = (hx - gx) / L, uy = (hy - gy) / L, px = -uy, py = ux;
  const at = (a, c) => [hx + px * a + ux * c, hy + py * a + uy * c];
  const top = [], bot = [];
  for (let i = 0; i <= 12; i++) { const t = -1 + 2 * i / 12, a = t * w, k = 1 - t * t; top.push(at(a, b * k - 0.04 * t * t)); bot.push(at(a, -0.04 * t * t)); }
  return [{ pts: [[gx, gy], at(0, 0)] }, { pts: [at(0, b), at(0, b + 0.06)] }, closed([...top, ...bot.reverse()])];
}

export const EMBLEMS = {
  miner: {
    // the white flank of the cab, aft of the canopy, over the dark band (both sides)
    spot: { z: 0.8, y: 4.07 }, colour: [1.5, 0.55, 0.02],
    designs: {
      pick: { name: 'Pick and ore', tip: 'A pickaxe over a lump of ore', strokes: [
        ...pick(-0.4, -0.3, -0.04, 0.08, 0.34, 0.08),
        closed([[0.1, -0.3], [0.16, -0.1], [0.34, -0.02], [0.52, -0.1], [0.56, -0.26], [0.42, -0.32]]),
        { pts: [[0.16, -0.1], [0.34, -0.18], [0.52, -0.1]] }, { pts: [[0.34, -0.18], [0.42, -0.32]] },
      ] },
      picks: { name: 'Crossed picks', tip: 'Two pickaxes crossed, the old sign for a mine', strokes: [
        ...pick(-0.32, -0.32, 0.14, 0.14, 0.32, 0.08), ...pick(0.32, -0.32, -0.14, 0.14, 0.32, 0.08),
      ] },
      line: { name: 'Ore line', tip: 'A line along the side, like the Medic\'s pulse, with a cut gem in it', strokes: [
        { pts: [[-0.8, -0.05], [-0.22, -0.05]] }, { pts: [[0.22, -0.05], [0.8, -0.05]] },
        closed([[-0.22, -0.05], [-0.12, 0.13], [0.12, 0.13], [0.22, -0.05], [0, -0.3]]),
        { pts: [[-0.22, -0.05], [0.22, -0.05]] }, { pts: [[-0.12, 0.13], [-0.07, -0.05], [0, -0.3]] }, { pts: [[0.12, 0.13], [0.07, -0.05], [0, -0.3]] }, { pts: [[-0.07, -0.05], [0, 0.13], [0.07, -0.05]] },
      ] },
    },
  },
  explorer: {
    // the flank aft of the door, behind his two yellow slashes (both sides)
    spot: { z: -1.95, y: 3.18 }, colour: [0.08, 0.85, 3.2],
    designs: {
      compass: { name: 'Compass star', tip: 'A compass star in a ring, its north point longer', strokes: [
        { pts: ring(0, 0, 0.24, 32), closed: true },
        closed([[0, 0.38], [0.06, 0.06], [0.3, 0], [0.06, -0.06], [0, -0.3], [-0.06, -0.06], [-0.3, 0], [-0.06, 0.06]]),
      ] },
      planet: { name: 'Ringed planet', tip: 'A planet with a tilted ring round it', strokes: (() => {
        const R = 0.2, tilt = 0.32, rx = 0.44, ry = 0.11, c = Math.cos(tilt), s = Math.sin(tilt);
        // (in the ring's own frame: u along it, v across; its front half v < 0)
        const uv = ([x, y]) => [x * c + y * s, -x * s + y * c];
        const runs = (pts, keep) => { const out = []; let cur = []; for (const p of pts) { if (keep(p)) cur.push(p); else { if (cur.length > 1) out.push({ pts: cur }); cur = []; } } if (cur.length > 1) out.push({ pts: cur }); return out; };
        // the planet's outline, a little gap where the ring's front half crosses over it
        const planet = runs(arc(0, 0, R, R, Math.PI / 2, Math.PI * 2.5, 72), (p) => { const [u, v] = uv(p); return v > 0 || Math.abs(Math.hypot(u / rx, v / ry) - 1) > 0.3; });
        // the ring, its back half hidden behind the planet
        const ringRuns = runs(arc(0, 0, rx, ry, Math.PI, Math.PI * 3, 80, tilt), (p) => uv(p)[1] < 0 || Math.hypot(p[0], p[1]) > R + 0.035);
        return [...planet, ...ringRuns];
      })() },
      rise: { name: 'Planet rise', tip: 'A line along the side, like the Medic\'s pulse, with a planet rising over it and its moon', strokes: [
        { pts: [[-0.8, -0.16], [0.8, -0.16]] },
        { pts: arc(-0.05, -0.16, 0.3, 0.3, 0, Math.PI, 30) },
        { pts: arc(-0.05, -0.16, 0.2, 0.2, Math.PI * 0.62, Math.PI * 0.95, 8) },
        { pts: ring(0.38, 0.22, 0.06, 16), closed: true },
      ] },
    },
  },
  hauler: {
    // the white panel of the cab's flank, just ahead of the crew door (the rest of its side is clamps and containers)
    spot: { z: 4.1, y: 2.1, scale: 0.92 }, colour: [1.8, 0.4, 0.03],
    designs: {
      box: { name: 'Container', tip: 'One cargo container, seen corner on, its ribs along the side', strokes: [
        closed([[-0.36, -0.26], [0.16, -0.26], [0.16, 0.08], [-0.36, 0.08]]),
        closed([[-0.36, 0.08], [-0.16, 0.22], [0.36, 0.22], [0.16, 0.08]]),
        closed([[0.16, -0.26], [0.36, -0.12], [0.36, 0.22], [0.16, 0.08]]),
        ...[-0.23, -0.1, 0.03].map((x) => ({ pts: [[x, -0.2], [x, 0.02]] })),
      ] },
      hook: { name: 'Hook and container', tip: 'A container hanging from a crane hook', strokes: [
        { pts: [[0, 0.4], [0, 0.24]] }, { pts: [[0, 0.24], ...arc(0.04, 0.17, 0.07, 0.07, Math.PI * 0.95, Math.PI * 2.1, 14)] },
        { pts: [[-0.26, -0.02], [0, 0.12], [0.26, -0.02]] },
        closed(box(-0.34, -0.36, 0.34, -0.02)),
        ...[-0.2, -0.07, 0.07, 0.2].map((x) => ({ pts: [[x, -0.3], [x, -0.08]] })),
      ] },
      stack: { name: 'Stacked containers', tip: 'Three containers, two below and one on top', strokes: [
        closed(box(-0.37, -0.26, -0.02, -0.02)), closed(box(0.02, -0.26, 0.37, -0.02)), closed(box(-0.18, 0.02, 0.18, 0.26)),
        ...[-0.26, -0.13, 0.13, 0.26].map((x) => ({ pts: [[x, -0.21], [x, -0.07]] })), ...[-0.06, 0.06].map((x) => ({ pts: [[x, 0.07], [x, 0.21]] })),
      ] },
    },
  },
};
export const WIDTH = 0.045, LIFT = 0.014;   // (the Medic's pulse line's own)

// lay a design on a ship (both sides): its hull's meshes (`model`), found by rays in from outside; returns a group of
// glowing ribbons and how many points missed the hull
export function layEmblem(THREE, model, ship, id) {
  const E = EMBLEMS[ship], D = E?.designs[id];
  const group = new THREE.Group(); group.name = 'emblem';
  if (!D) return { group, missed: 0, points: 0 };
  const meshes = []; model.updateMatrixWorld(true);
  model.traverse((o) => { if (o.isMesh && !/glow|glass/.test(o.material?.name || '') && !/glow/.test(o.name)) meshes.push(o); });
  const rc = new THREE.Raycaster(), k = E.spot.scale || 1;
  const pos = [], idx = []; let missed = 0, points = 0;
  for (const s of [1, -1]) {
    // (seen from its own side, x to the right is aft on the port side (+x), forward on the starboard)
    const hit = (x, y) => {
      rc.set(new THREE.Vector3(s * 9, E.spot.y + y * k, E.spot.z - s * x * k), new THREE.Vector3(-s, 0, 0));
      const h = rc.intersectObjects(meshes, false)[0]; points++;
      if (!h) { missed++; return null; }
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld); if (n.x * s < 0) n.negate();
      return { p: h.point.clone().addScaledVector(n, LIFT), n };
    };
    for (const S of D.strokes) {
      // (points no further apart than 4 cm, so the ribbon follows the facets)
      const src = S.closed ? [...S.pts, S.pts[0]] : S.pts, dense = [];
      for (let i = 0; i < src.length; i++) {
        if (i === 0) { dense.push(src[0]); continue; }
        const [ax, ay] = src[i - 1], [bx, by] = src[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * k / 0.04));
        for (let j = 1; j <= n; j++) dense.push([ax + (bx - ax) * j / n, ay + (by - ay) * j / n]);
      }
      const H = dense.map(([x, y]) => hit(x, y));
      for (let i = 0; i < H.length; i++) {
        if (!H[i]) continue;
        // (the ribbon's sideways: across the line, in the face; mitred at a corner, never more than twice as wide)
        const prev = H[i - 1] || (S.closed && i === 0 ? H[H.length - 2] : null), next = H[i + 1] || (S.closed && i === H.length - 1 ? H[1] : null);
        const t1 = prev ? H[i].p.clone().sub(prev.p).normalize() : null, t2 = next ? next.p.clone().sub(H[i].p).normalize() : null;
        const side = (t) => H[i].n.clone().cross(t).normalize();
        let w = new THREE.Vector3(), m = 1;
        if (t1 && t2) { const a = side(t1), b = side(t2); w = a.clone().add(b); if (w.lengthSq() < 1e-6) w = a; w.normalize(); m = Math.min(2, 1 / Math.max(0.5, w.dot(a))); } else w = side(t1 || t2);
        H[i].l = H[i].p.clone().addScaledVector(w, WIDTH / 2 * m); H[i].r = H[i].p.clone().addScaledVector(w, -WIDTH / 2 * m);
      }
      for (let i = 0; i < H.length - 1; i++) {
        const a = H[i], b = H[i + 1]; if (!a || !b || !a.l || !b.l) continue;
        const o = pos.length / 3; pos.push(...a.l.toArray(), ...a.r.toArray(), ...b.r.toArray(), ...b.l.toArray());
        idx.push(o, o + 1, o + 2, o, o + 2, o + 3, o, o + 2, o + 1, o, o + 3, o + 2);   // (both faces)
      }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...E.colour), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'emblem glow'; group.add(mesh);
  return { group, missed, points, tris: idx.length / 3 };
}
