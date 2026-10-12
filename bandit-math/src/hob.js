// OLD HOB: the old hand next door. He says a short line now and then (a caption at the bottom left; no voice yet) and
// lays a trail of glowing hoofprints from the town square out to the job, so a new rider knows where to go.
//
// Each teaching line is said once per rider (remembered in rider.flags.hob, saved with the rider), so a returning
// rider isn't told the same things again.
//
//   const B = makeHob({ W, hud, rider, scene })
//   B.event(name, data)   what just happened; Hob decides whether to say something:
//                         'ride' (riding out; data.mode), 'arrive' (at the herd), 'catch', 'miss', 'waveDone' (data.gold),
//                         'boxWon', 'saddle', 'dog', 'horse', 'title' (data.title), 'near' (data.place: at the saloon's
//                         doors, nothing behind them yet, or the front of the stage, where the town band plays; said
//                         again only after NEAR_AGAIN)
//   B.say(text)           says a line now
//   B.trail(on)           the hoofprints to the pasture on or off (they fade in and out)
//   B.update(dt, at)      each frame: at = the player's position (the trail fades away once they reach the herd)
//   B.dispose()
import * as THREE from 'three';
import { saveRider } from './save.js';

export const HOB = {
  step: 1.15,          // metres between hoofprints along the trail
  side: 0.3,           // each print this far left or right of the trail's middle
  size: [0.5, 0.58],   // a print's width and length (m), glow included: bigger than a real hoof, to be seen from the saddle
  pulse: 9,            // metres a second the glow runs along the trail toward the job
  wave: 14,            // metres between two glows
  hideNear: 38,        // the trail fades out within this many metres of the pasture's middle
};

const LINES = {
  firstDay: "Mornin'! Rancher next door needs a hand with his herd. Follow the hoofprints out to the pasture.",
  back: ["Herd's waiting out in the pasture. The hoofprints know the way.", "Good to see you. The rancher's got more cattle needing a rope.",
    "Fine day for a round-up. Pasture's east, past the creek."],
  shoot: "Shooting comes in a later update, partner. It's the lasso for now, same pay.",
  arrive: 'Each steer carries a number. Rope the ones the card up top asks for: point at one and click, or press F.',
  catch: "Nice throw! It'll gallop itself over to the corral.",
  miss: 'No harm done. Read why it wasn\'t that one, then try another.',
  waveSaddle: "That's a day's wages! Enough for a saddle. The stable's back in town.",
  wave: 'Good work. Another bunch is wandering in.',
  boxWon: "There's a lock box in your saddlebags. Crack it at the sheriff's desk, or at your cabin table.",
  saddle: 'Whistle with H and your horse comes running. E gets you up, Shift lets her gallop.',
  dog: 'Every cowhand needs a dog. Yours will keep up, never you mind.',
  dogPug: "A pug! Them little legs won't keep up with a horse, but he'll find you. He always does.",
  horse: 'Fine-looking horse. Treat her well.',
  // walking up to the saloon's doors (nothing to open yet) and the front of the stage (the town band plays there)
  saloon: ["Saloon's shut till sundown, partner. Lock boxes are next door at the sheriff's.",
    "Doors stay shut till evening. The band out front keeps folks company meanwhile."],
  stage: ["That's the town band. The Professor on the piano, Josie on the harmonica.",
    "Stand a spell and listen, if you like. They play from sunup to sundown.",
    "Josie learned that harmonica on a cattle drive. The Professor plays it all by ear."],
};
const NEAR_AGAIN = 180;  // seconds before Hob says something about the same place again (walking past again and again doesn't set him off each time)

export function makeHob({ W, hud, rider, scene = W.scene }) {
  const flags = () => { rider.flags = rider.flags && typeof rider.flags === 'object' ? rider.flags : {}; const f = rider.flags; f.hob = f.hob || {}; return f.hob; };
  const once = (id) => { const f = flags(); if (f[id]) return false; f[id] = 1; saveRider(rider); return true; };
  const queue = [];
  const nearAt = {}, nearN = {};   // ('near': when each place was last remarked on, and which line it said)
  let speaking = 0;
  const B = {};
  B.say = (text, ms) => {
    if (!text) return;
    if (speaking > 0) { if (!queue.includes(text)) queue.push(text); return; }
    const t = ms || Math.max(4500, 1800 + text.length * 55);
    hud.caption(text, t); speaking = t / 1000 + 0.4;
  };
  B.event = (name, data = {}) => {
    switch (name) {
      case 'ride': {
        const first = !flags().firstDay;
        if (first) { once('firstDay'); B.say(LINES.firstDay, 7000); }
        else B.say(LINES.back[Math.floor(Math.random() * LINES.back.length)]);
        if (data.mode === 'shoot') B.say(LINES.shoot);
        break;
      }
      case 'arrive': if (once('arrive')) B.say(LINES.arrive, 7000); break;
      case 'catch': if (once('catch')) B.say(LINES.catch); break;
      case 'miss': if (once('miss')) B.say(LINES.miss); break;
      case 'waveDone':
        if (!(rider.owned && rider.owned.saddle) && rider.gold >= (data.saddle || 15) && once('waveSaddle')) B.say(LINES.waveSaddle, 6500);
        else if (once('wave')) B.say(LINES.wave);
        break;
      case 'boxWon': if (once('boxWon')) B.say(LINES.boxWon, 6500); break;
      case 'saddle': if (once('saddle')) B.say(LINES.saddle, 6500); break;
      case 'dog': {
        // (the pug can't keep up with a galloping horse, so he gets his own line)
        const pug = rider.owned && rider.owned.dog && rider.owned.dog.kind === 'pug';
        if (pug ? once('dogPug') : once('dog')) B.say(pug ? LINES.dogPug : LINES.dog);
        break;
      }
      case 'horse': B.say(LINES.horse); break;
      case 'near': {
        const L = LINES[data.place], t = performance.now() / 1000;
        if (!Array.isArray(L) || t - (nearAt[data.place] ?? -1e9) < NEAR_AGAIN) break;
        nearAt[data.place] = t;
        B.say(L[(nearN[data.place] = ((nearN[data.place] ?? -1) + 1)) % L.length]);
        break;
      }
      default: break;
    }
  };

  // ── THE HOOFPRINTS ────────────────────────────────────────────────────────────────────────────────────────────
  const path = (W.places.trail || []).map(([x, z]) => new THREE.Vector2(x, z));
  const prints = [];
  if (path.length > 1) {
    let along = 0, next = 0, n = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], seg = a.distanceTo(b); if (seg < 1e-3) continue;
      const dx = (b.x - a.x) / seg, dz = (b.y - a.y) / seg;
      while (next <= along + seg) {
        const t = next - along, side = n % 2 ? HOB.side : -HOB.side;
        const x = a.x + dx * t + dz * side, z = a.y + dz * t - dx * side;
        if (!W.blocked(x, z) && W.waterAt(x, z) < 0.35) prints.push({ x, z, h: Math.atan2(dx, dz), along: next });
        next += HOB.step; n++;
      }
      along += seg;
    }
  }
  const tex = printTexture();
  const geo = new THREE.PlaneGeometry(HOB.size[0], HOB.size[1]);
  geo.rotateX(-Math.PI / 2);
  const alongAttr = new Float32Array(prints.length);
  prints.forEach((p, i) => { alongAttr[i] = p.along; });
  geo.setAttribute('aAlong', new THREE.InstancedBufferAttribute(alongAttr, 1));
  const U = { map: { value: tex }, uTime: { value: 0 }, uFade: { value: 0 }, uLen: { value: prints.length ? prints[prints.length - 1].along : 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    vertexShader: `attribute float aAlong; varying vec2 vUv; varying float vAlong;
      void main() { vUv = uv; vAlong = aAlong; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform float uTime, uFade, uLen; varying vec2 vUv; varying float vAlong;
      void main() {
        float a = texture2D(map, vUv).a;
        float w = fract((vAlong - uTime * ${HOB.pulse.toFixed(1)}) / ${HOB.wave.toFixed(1)});
        float glow = 0.85 + 1.6 * smoothstep(0.7, 0.97, w) * (1.0 - smoothstep(0.97, 1.0, w));
        float ends = smoothstep(0.0, 4.0, vAlong) * (1.0 - 0.5 * smoothstep(uLen - 8.0, uLen, vAlong));
        gl_FragColor = vec4(vec3(1.0, 0.82, 0.45) * glow * a * uFade * ends, 1.0);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, prints.length));
  mesh.count = prints.length; mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name = 'hob-hoofprints';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  prints.forEach((p, i) => {
    // lying on the ground, along the slope
    const e = 0.3, hx = W.heightAt(p.x + e, p.z) - W.heightAt(p.x - e, p.z), hz = W.heightAt(p.x, p.z + e) - W.heightAt(p.x, p.z - e);
    const nrm = new THREE.Vector3(-hx / (2 * e), 1, -hz / (2 * e)).normalize();
    // (the picture's top is the toe: turned so the toe points along the way to the job, the open heel behind)
    q.setFromUnitVectors(up, nrm).multiply(new THREE.Quaternion().setFromAxisAngle(up, p.h + Math.PI));
    pos.set(p.x, W.heightAt(p.x, p.z) + 0.04, p.z);
    m4.compose(pos, q, one); mesh.setMatrixAt(i, m4);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.visible = false;
  scene.add(mesh);

  let want = false, fade = 0, time = 0;
  B.trail = (on) => { want = !!on; };
  B.update = (dt, at) => {
    time += dt;
    if (speaking > 0 && (speaking -= dt) <= 0 && queue.length) B.say(queue.shift());
    const pa = W.places.pasture;
    const near = at && pa ? Math.hypot(at.x - pa.x, at.z - pa.z) < HOB.hideNear : false;
    const target = want && !near ? 1 : 0;
    fade += Math.sign(target - fade) * Math.min(Math.abs(target - fade), dt / 0.8);
    U.uFade.value = fade; U.uTime.value = time;
    mesh.visible = fade > 0.002;
  };
  B.prints = prints.length;
  B.dispose = () => { scene.remove(mesh); geo.dispose(); mat.dispose(); tex.dispose(); hud.caption(null); };
  return B;
}

// a horseshoe-shaped hoofprint with a soft glow round it, white on clear (the glow colour comes from the shader)
function printTexture() {
  const W = 128, H = 148, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const shoe = (ctx) => {
    ctx.beginPath(); ctx.ellipse(64, 70, 34, 44, 0, 0, Math.PI * 2); ctx.ellipse(64, 86, 17, 30, 0, 0, Math.PI * 2, true); ctx.fill('evenodd');
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(52, 96, 24, 26); ctx.restore();   // (the open heel)
  };
  // the glow: the shoe drawn blurred and faint, then the shoe itself on top
  c.filter = 'blur(10px)'; c.fillStyle = 'rgba(255,255,255,0.55)'; shoe(c);
  c.filter = 'none'; c.fillStyle = '#fff'; shoe(c);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
