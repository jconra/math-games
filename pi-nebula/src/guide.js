// THE GUIDE LINE: a glowing line on the floor from the player to a place, along the way a person walks there (the
// way-finder, room to room: walls.plan), bright marks flowing along it toward the place. The game's maker
// (2026-11-17): "I think we need the ability to click on them and get the glowing lines in the floor or colored lights
// to follow or something that can take us to the job we selected." The line shortens behind the player as they follow
// it, is worked out again from where they are if they wander off it, and fades out as they get there (or when another
// place is picked, the old line fading as the new one comes).
//
//   const guide = makeGuide({ W, walls })
//   guide.to(pos, { near, colour, label })   a line to `pos` (a Vector3 on a floor); `near`: how close counts as there
//   guide.clear()                            the line faded out
//   guide.update(dt, player)                 each frame (player: the player's { pos }, or null)
//   guide.active                             the place the line leads to (its label), or null
//   guide.turnTo                             a line just picked: the heading it sets off along (the camera turns to it;
//                                            the game sets it back to null)
//   guide.stats()                            for the rigs: { planning, length, left, start, lines, replans, arrived }
//
// HOW: one strip of triangles along the way (34 cm wide, 4.5 cm over the floor, the floor's own height under every
// point, so it climbs steps), drawn in one go with a small shader: the marks are worked out on the graphics card from
// the clock, the part already walked and the ends faded by two numbers. Nothing is redrawn as the player walks. The
// walker's way is moved toward the middle of the floor first (a walker shaves past pillars and rails; a line to follow
// keeps off them), and a soft column of light in the job's colour stands over the place, seen over the player's head
// when the line straight ahead is behind them. (A second blind look: the line pale, hugging pillars and rails, hidden
// behind the player on the straights.)
import * as THREE from 'three';

export const GUIDE = {
  width: 0.34, lift: 0.045, step: 0.2,        // the strip: its width, how far over the floor (over a grating's bars, a step's edge), its points' spacing (m)
  colour: [1.0, 0.75, 0.3],                   // its colour when the job gives none (the board gives each its own)
  marks: 0.75, speed: 1.4,                    // a bright chevron every this far along, flowing this fast toward the place
  off: 2.2, replan: 1.2,                      // wandered this far off the line: worked out again (no oftener than this, s)
  fade: 0.6, planMs: 5,                       // seconds to fade in and out; ms of way-finding a frame (a one-off, while it is worked out)
  round: 0.45,                                // the corners rounded off within this far of each turn (m)
  centre: 0.6,                                // how far the line may be moved off the walker's way toward the most room (m)
  beacon: [0.7, 2.6],                         // the column of light over the place: its width and its height (m)
};

const VERT = `
  attribute float aAlong; attribute float aAcross;
  varying float vAlong; varying float vAcross;
  void main() { vAlong = aAlong; vAcross = aAcross; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// (a solid band in the job's colour with a darker edge, so it reads on the dark floors and the light gratings and
// beside the floor's own white light strips alike; a chevron every uMarks metres, its point toward the place, flowing
// toward it, whiter. A first version glowed cyan over the floor, faint on the gratings, its chevrons pointing back)
const FRAG = `
  uniform float uTime, uStart, uLength, uOpacity, uMarks;
  uniform vec3 uColour;
  varying float vAlong; varying float vAcross;
  void main() {
    float a = abs(vAcross);
    float core = 1.0 - smoothstep(0.6, 0.74, a);
    float rim = (1.0 - core) * (1.0 - smoothstep(0.86, 1.0, a));
    float ph = fract((vAlong - uTime) / uMarks + a * 0.3);
    float mark = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.2, 0.24, ph)) * core;   // (a soft tail, a sharp front)
    float ends = smoothstep(uStart, uStart + 0.8, vAlong) * (1.0 - smoothstep(uLength - 0.7, uLength - 0.05, vAlong));
    vec3 c = mix(uColour * 0.22, mix(uColour, vec3(1.0), 0.6 * mark), core);
    float alpha = (core * (0.94 + 0.06 * mark) + rim * 0.7) * ends * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(c, alpha);
  }`;

// THE COLUMN OF LIGHT over the place: two crossed upright quads, brightest at the floor, fading up, a slow pulse
// climbing it; added to what is behind (it glows), hidden by walls as anything is
const BEACON_VERT = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEACON_FRAG = `
  uniform float uTime, uOpacity;
  uniform vec3 uColour;
  varying vec2 vUv;
  void main() {
    float across = 1.0 - smoothstep(0.15, 1.0, abs(vUv.x - 0.5) * 2.0);
    float up = pow(1.0 - vUv.y, 1.4);
    float pulse = 0.7 + 0.3 * sin(uTime * 3.0 - vUv.y * 7.0);
    float a = across * up * pulse * uOpacity * 0.8;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColour, a);
  }`;
function beaconGeometry([w, h]) {
  const pos = [], uv = [], ix = [];
  for (const [ax, az] of [[1, 0], [0, 1]]) {
    const k = pos.length / 3;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { pos.push((u - 0.5) * w * ax, v * h, (u - 0.5) * w * az); uv.push(u, v); }
    ix.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix); g.computeBoundingSphere();
  return g;
}
// (a job's colour for its line, deepened where it is pale (its lightness at most 0.6: a lavender reads as purple on a
// light floor), as the page's own numbers: the shaders write it as it is)
export function lineRGB(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6 || l <= 0.6) return [r, g, b];
  const s = Math.min(1, d / (1 - Math.abs(2 * l - 1)));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360;
  const C = 0.8 * s, X = C * (1 - Math.abs((h / 60) % 2 - 1)), m = 0.6 - C / 2;
  const [r1, g1, b1] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
  return [r1 + m, g1 + m, b1 + m];
}

export function makeGuide({ W, walls }) {
  const lines = [];      // the line now (last) and any fading out
  let want = null, req = null, replanAt = 0, clock = 0;
  const counts = { lines: 0, replans: 0, arrived: 0, failed: 0 };
  let beacon = null;

  function material() {
    return new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false,
      uniforms: { uTime: { value: 0 }, uStart: { value: 0 }, uLength: { value: 1 }, uOpacity: { value: 0 }, uMarks: { value: GUIDE.marks }, uColour: { value: new THREE.Color(...GUIDE.colour) } },
    });
  }
  // the strip along a way: its corners rounded off (cut twice, Chaikin's way, never more than GUIDE.round from the
  // turn: a doorway's corner is not cut through), its points every GUIDE.step, each on the floor under it: the highest
  // floor within a quarter metre either way along it, so over a step it rides the step's edge rather than cutting
  // into it
  function strip(way) {
    let line = way.map((p) => p.clone());
    for (let n = 0; n < 2 && line.length > 2; n++) {
      const out = [line[0]];
      for (let i = 0; i + 1 < line.length; i++) {
        const a = line[i], b = line[i + 1], L = a.distanceTo(b), k = Math.min(0.25, GUIDE.round / Math.max(L, 1e-6));
        if (i > 0) out.push(a.clone().lerp(b, k));
        if (i + 2 < line.length) out.push(a.clone().lerp(b, 1 - k));
      }
      out.push(line[line.length - 1]); line = out;
    }
    let pts = [];
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], b = line[i + 1], n = Math.max(1, Math.ceil(a.distanceTo(b) / GUIDE.step));
      for (let k = 0; k < n; k++) pts.push(a.clone().lerp(b, k / n));
    }
    pts.push(line[line.length - 1].clone());
    const floor = pts.map((p) => { const f = walls.floorAt(p.x, p.z, p.y + 0.35, 0.8); return f == null ? p.y : f; });
    pts.forEach((p, i) => { let y = floor[i]; for (let j = Math.max(0, i - 1); j <= Math.min(pts.length - 1, i + 1); j++) y = Math.max(y, floor[j]); p.y = y; });
    const pos = [], along = [], across = [], ix = [], acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b.x - a.x, dz = b.z - a.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const sx = -dz * GUIDE.width / 2, sz = dx * GUIDE.width / 2, y = pts[i].y + GUIDE.lift;
      pos.push(pts[i].x + sx, y, pts[i].z + sz, pts[i].x - sx, y, pts[i].z - sz);
      along.push(acc[i], acc[i]); across.push(1, -1);
      if (i) { const k = (i - 1) * 2; ix.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }     // (facing up)
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    g.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1));
    g.setIndex(ix); g.computeBoundingSphere();
    return { g, pts, acc, length: acc[acc.length - 1] };
  }
  // DOWN THE MIDDLE: the walker's way, a point every 2 m or less, each moved across the way toward the most room either
  // side (at most GUIDE.centre), so the line keeps off walls, pillars and rails rather than shaving past them as a
  // walker's shortest way does; never onto anything solid, through it, or off a floor's edge; the ends kept
  const ROOM = [0.3, 0.45, 0.6, 0.8, 1.0];
  const ACROSS = [-1, -0.75, -0.5, -0.25, 0.25, 0.5, 0.75, 1].map((k) => k * GUIDE.centre);
  function centre(way) {
    const pts = [way[0].clone()];
    for (let i = 0; i + 1 < way.length; i++) {
      const a = way[i], b = way[i + 1], n = Math.max(1, Math.ceil(a.distanceTo(b) / 2));
      for (let k = 1; k <= n; k++) pts.push(a.clone().lerp(b, k / n));
    }
    const room = (x, y, z) => { let r = 0; for (const q of ROOM) { if (walls.free(x, y, z, q, true)) r = q; else break; } return r; };
    const onFloor = (x, y, z) => { const f = walls.floorAt(x, z, y + 0.35, 0.8); return f != null && Math.abs(f - y) < 0.12; };
    const side = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
      return [-dz / L, dx / L];
    });
    let off = pts.map((p, i) => {
      if (i === 0 || i === pts.length - 1) return 0;
      const [sx, sz] = side[i];
      let best = 0, score = room(p.x, p.y, p.z);
      for (const k of ACROSS) {
        const x = p.x + sx * k, z = p.z + sz * k;
        if (!onFloor(x, p.y, z) || !walls.free(p.x + sx * k / 2, p.y, p.z + sz * k / 2, 0.2, true)) continue;
        const sc = room(x, p.y, z) - 0.15 * Math.abs(k);
        if (sc > score + 0.05) { score = sc; best = k; }
      }
      return best;
    });
    for (let n = 0; n < 2; n++) off = off.map((o, i) => (i === 0 || i === off.length - 1 ? 0 : (off[i - 1] + 2 * o + off[i + 1]) / 4));
    return pts.map((p, i) => new THREE.Vector3(p.x + side[i][0] * off[i], p.y, p.z + side[i][1] * off[i]));
  }
  function show(way) {
    const S = strip(centre(way)), mesh = new THREE.Mesh(S.g, material());
    mesh.renderOrder = 3; mesh.frustumCulled = false; W.scene.add(mesh);
    const L = { mesh, pts: S.pts, acc: S.acc, length: S.length, opacity: 0, fading: false, start: 0, near: 0 };
    mesh.material.uniforms.uLength.value = L.length;
    for (const o of lines) o.fading = true;
    lines.push(L); counts.lines++;
  }
  function drop(L) { W.scene.remove(L.mesh); L.mesh.geometry.dispose(); L.mesh.material.dispose(); lines.splice(lines.indexOf(L), 1); }
  // (where the player is along a line: the nearest point of it, looked for a little way either side of the last)
  function progress(L, p) {
    let best = Infinity, bi = L.near;
    const i0 = Math.max(0, L.near - 30), i1 = Math.min(L.pts.length - 1, L.near + 60);
    for (let i = i0; i <= i1; i++) { const q = L.pts[i], d = Math.hypot(q.x - p.x, q.z - p.z) + Math.abs(q.y - p.y) * 2; if (d < best) { best = d; bi = i; } }
    L.near = bi; return best;
  }
  function plan(from) {
    if (!want) return;
    req = walls.plan(from, want.pos);
    replanAt = clock;
  }
  const api = {
    get active() { return want ? want.label : null; },
    get target() { return want ? want.pos : null; },
    turnTo: null,       // (a line just picked: the heading it sets off along, once: the game turns its camera to it)
    to(pos, { near = 1.6, colour = null, label = '' } = {}, from = null) {
      want = { pos: pos.clone(), near, label };
      for (const o of lines) o.fading = true;
      req = null;
      if (from) plan(from); else want.pending = true;
      if (colour) want.colour = colour;
    },
    clear() { want = null; req = null; for (const o of lines) o.fading = true; },
    update(dt, player) {
      clock += dt;
      for (const L of lines) L.mesh.material.uniforms.uTime.value = clock * GUIDE.speed;
      const P = player && player.pos;
      if (want && P && want.pending) { want.pending = false; plan(P); }
      // the way, worked out a little each frame; shown once it gets there (or as near as it can)
      if (req) {
        if (req.step(GUIDE.planMs)) {
          const w = req.way; req = null;
          if (w && w.length >= 2 && w.short < 1.5) {
            if (w.short > 0.05) w.push(want.pos.clone());
            show(w);
            const L = lines[lines.length - 1];
            // (the job's own colour, deepened where pale, as the page's numbers: the shader writes it as it is)
            if (want.colour) L.mesh.material.uniforms.uColour.value.setRGB(...lineRGB(want.colour));
            L.colour = L.mesh.material.uniforms.uColour.value;
            // (a line just picked: the way it sets off, for the camera to turn to; not a line worked out again)
            if (!want.shown) { want.shown = true; const k = Math.min(L.pts.length - 1, Math.round(2.5 / GUIDE.step)), a = L.pts[0], b = L.pts[k]; if (Math.hypot(b.x - a.x, b.z - a.z) > 0.3) api.turnTo = Math.atan2(b.x - a.x, b.z - a.z); }
          }
          else { counts.failed++; console.info('guide: no way to ' + (want && want.label)); want = null; }
        }
      }
      // the line now: shortened behind the player; there, it fades; wandered off, worked out again
      const cur = lines.length && !lines[lines.length - 1].fading ? lines[lines.length - 1] : null;
      if (cur && P && want) {
        const off = progress(cur, P);
        cur.start = Math.max(cur.start, cur.acc[cur.near] + 0.25);      // (from just ahead of the player's feet)
        cur.mesh.material.uniforms.uStart.value = cur.start;
        const there = Math.hypot(P.x - want.pos.x, P.z - want.pos.z) < want.near && Math.abs(P.y - want.pos.y) < 1.2;
        if (there) { counts.arrived++; api.clear(); }
        else if (off > GUIDE.off && !req && clock - replanAt > GUIDE.replan) { counts.replans++; plan(P); }
      }
      for (const L of [...lines]) {
        const goal = L.fading ? 0 : 1;
        L.opacity += Math.sign(goal - L.opacity) * Math.min(Math.abs(goal - L.opacity), dt / GUIDE.fade);
        L.mesh.material.uniforms.uOpacity.value = L.opacity;
        if (L.fading && L.opacity <= 0) drop(L);
      }
      // the column of light over the newest line's end, as bright as that line (made the first time it is wanted)
      const top = lines.length ? lines[lines.length - 1] : null;
      if (top && !beacon) {
        beacon = new THREE.Mesh(beaconGeometry(GUIDE.beacon), new THREE.ShaderMaterial({
          vertexShader: BEACON_VERT, fragmentShader: BEACON_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, toneMapped: false,
          uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColour: { value: new THREE.Color() } },
        }));
        beacon.renderOrder = 4; beacon.name = 'guide light'; W.scene.add(beacon);
      }
      if (beacon) {
        beacon.visible = !!top && top.opacity > 0.001;
        if (top) {
          beacon.position.copy(top.pts[top.pts.length - 1]);
          beacon.material.uniforms.uColour.value.copy(top.colour || top.mesh.material.uniforms.uColour.value);
          beacon.material.uniforms.uOpacity.value = top.opacity;
          beacon.material.uniforms.uTime.value = clock;
        }
      }
    },
    stats() {
      const cur = lines.length ? lines[lines.length - 1] : null;
      return { planning: !!req, active: api.active, length: cur ? +cur.length.toFixed(1) : 0, left: cur ? +(cur.length - cur.acc[cur.near]).toFixed(1) : 0, start: cur ? +cur.start.toFixed(1) : 0, opacity: cur ? +cur.opacity.toFixed(2) : 0, shown: lines.length, ...counts };
    },
  };
  return api;
}
