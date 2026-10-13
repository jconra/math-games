// OLD HOB: the old hand next door. He says a short line now and then (a caption at the bottom left, with a short babble
// of a voice under it: src/audio/voice.js, when the game gives him one) and
// lays a trail of glowing hoofprints from the town square out to the job, so a new rider knows where to go.
//
// Each teaching line is said once per rider (remembered in rider.flags.hob, saved with the rider), so a returning
// rider isn't told the same things again.
//
//   const B = makeHob({ W, hud, rider, scene, I, voice })   (I: the input, so a phone player is told to tap, not press F;
//                         voice: makeHobVoice, his babble, or null for none)
//   B.event(name, data)   what just happened; Hob decides whether to say something:
//                         'ride' (riding out; data.mode, data.wagon: the wagon job is on), 'arrive' (at the herd), 'catch', 'miss', 'waveDone' (data.gold),
//                         'boxWon', 'saddle', 'dog', 'horse', 'title' (data.title), 'near' (data.place: at the saloon's
//                         doors, nothing behind them yet, or the front of the stage, where the town band plays; said
//                         again only after NEAR_AGAIN)
//                         The farm (missions/sheep.js): 'farmArrive' (at the sheep pasture), 'sheepHealed', 'sheepWrong' (a
//                         wrong bottle), 'sheepFine' (medicine for a healthy sheep: a short line, the why is in the hint), 'flockDone'
//                         The pig yard (missions/pigs.js): 'pigsArrive', 'pigPenned', 'pigWrong' (data.line: why not that pen,
//                         said at once), 'pigsDone'
//                         The store counter (missions/store.js): 'storeStart', 'storeMiss' (a wrong coin), 'storeEquation'
//                         (a story told backwards, off to the lock box), 'storeDone' (data.filled)
//                         'storeRight' (a right coin: a 'pick again' line still up or waiting is dropped)
//                         The camps' deliveries (missions/delivery.js): 'deliveryOrder' (an order taken), 'deliveryWork' (the
//                         slip at the store), 'deliveryMiss', 'deliveryRight', 'deliveryLoaded', 'deliveryArrive',
//                         'deliveryDone' (data.first), 'deliveryNoSaddle', 'deliveryRobbed'; 'campTip' (said once, after a
//                         wave, to a rider with a saddle: there's hauling to do for the camps)
//                         Protect the wagon (missions/wagonjob.js): 'wagonArrive' (the job starts), 'banditCatch',
//                         'banditMiss', 'banditLoop' (a rider has galloped off round the bend), 'banditsDone' (data.n),
//                         'wagonStop' ("Done for now")
//   B.say(text)           says a line now (or after the line he is saying)
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
  arriveTouch: 'Each steer carries a number. Rope the ones the card up top asks for: tap one, or the Rope button.',
  catch: "Nice throw! It'll gallop itself over to the corral.",
  miss: 'No harm done. Read why it wasn\'t that one, then try another.',
  waveSaddle: "That's a day's wages! Enough for a saddle. The stable's back in town.",
  wave: 'Good work. Another bunch is wandering in.',
  boxWon: "There's a lock box in your saddlebags. Crack it at the sheriff's desk, or at your cabin table.",
  saddle: 'Whistle with H and your horse comes running. E gets you up, Shift lets her gallop.',
  dog: 'Every cowhand needs a dog. Yours will keep up, never you mind.',
  dogPug: "A pug! Them little legs won't keep up with a horse, but he'll find you. He always does.",
  horse: 'Fine-looking horse. Treat her well.',
  donkey: "A donkey! Slow as molasses, but he won't quit on you.",
  hat: ['Now that is a fine hat.', 'Suits you, partner.', 'Look at you! A proper hat for a proper rider.'],
  // the farm north of town: the sick-sheep job
  farmTip: "There's a farm north of town, behind your cabin. The settler's sheep are poorly, if you've a mind for doctoring.",
  farmArrive: "Some of these sheep are sick, but they look like the rest. Only her sum gives her away: find the wrong ones. Point at a sheep, press F and pick the medicine that fixes it.",
  farmArriveTouch: "Some of these sheep are sick, but they look like the rest. Only her sum gives her away: find the wrong ones. Tap a sheep, then tap the medicine that fixes it.",
  sheepHealed: "That's the cure. She'll be right as rain.",
  sheepWrong: 'Not that bottle. Read why, then try another. No harm done.',
  sheepFine: ["She's fine, partner. Nothing wrong with that sum.", 'That one\'s healthy. Save the medicine.', 'Fit as a fiddle, that one. Check the others.'],
  flockDone: ["Whole flock's on its feet. The settler thanks you kindly.", "That's the flock seen to. More sums for you to check.", 'Good doctoring.'],
  // the farm's pig yard: the loose-pigs job
  pigsArrive: "The pigs got loose! Each one's got a sum on it. Herd it into the pen whose sign shows the answer. They run from you, so come at them from behind.",
  pigPenned: "In she goes. That's the right pen.",
  pigsDone: ["That's every pig penned. The settler's obliged.", 'All penned. Here come some more sums.', 'Fine herding, partner.'],
  // the general store's counter: townsfolk bring order slips (word problems)
  storeStart: "Folks bring their orders on a slip. Read it through, picture what's going on, then pick the coin.",
  storeBack: ['Counter\'s open. Here they come.', 'Busy day at the store. Slips at the ready.'],
  storeMiss: 'Not that one. The picture on the slip shows how the story goes together. Pick again, no charge.',
  storeEquation: 'This one\'s told backwards. Write the story as an equation, then crack it like a lock box.',
  storeDone: ['Store\'s in good hands with you.', 'Fine work at the counter.', 'The storekeeper says thank you kindly.'],
  // the camps out in the valley: hauling their supplies
  campTip: "Folks are camped out in the valley: a cow crew to the west, the Hollis family past the pasture, surveyors up north. They pay to have supplies hauled. Ask their foreman.",
  deliveryOrder: "The order's on your card. Ride to the general store and work out how much to send: pull up out front.",
  deliveryWork: 'Take it a step at a time: how much for one day, then all the days, then how many crates.',
  deliveryMiss: 'Not that one. Look at the picture, then pick again. No harm done.',
  deliveryRoundUp: "Mind the leftovers! A crate that's only part full still has to go. Always round up.",
  deliveryLoaded: "Crates are on your horse. Follow the compass out to the camp.",
  deliveryArrive: 'Here come the hands to unload.',
  deliveryDone: ["Hauling's honest work. Talk to the foreman for the next order.", 'Another one delivered.', 'Good hauling, partner.'],
  deliveryFirst: "That's your first delivery! Talk to the foreman again whenever you want the next order.",
  deliveryNoSaddle: "Crates need a saddled horse to carry 'em. The stable sells saddles.",
  deliveryRobbed: "The gang got the crates! Don't fret: ride back to the store and they'll make it up again.",
  // protect the wagon: the gang wears its numbers; the townsfolk riding along look just the same
  wagonArrive: "A gang's after this wagon! Every bandit wears a number from the gang's table. Townsfolk ride along too, wearing other numbers, and they look just like the gang. Rope the bandits: point at a rider and click, or press F.",
  wagonArriveTouch: "A gang's after this wagon! Every bandit wears a number from the gang's table. Townsfolk ride along too, wearing other numbers, and they look just like the gang. Rope the bandits: tap a rider, or the Rope button.",
  banditCatch: "Got him! He'll keep, trussed up by the road. The deputies will bring him in.",
  banditMiss: "That's an honest townsman. No harm done: check the count on the rail, then pick again.",
  banditLoop: "One's galloped on ahead. Don't fret: they always come back round the bend.",
  banditsDone: ['The wagon rolls on safe. More road ahead, and likely more trouble.', "That's the gang seen to. Keep alongside, partner.", 'Fine riding. Eyes on the road.'],
  wagonStop: "The wagon will wait. Come back any time.",
  wagonWaits: "There's a wagon waiting for you on the road east of the pasture: follow the wagon on your compass and ride up alongside it.",
  // walking up to the saloon's doors (nothing to open yet) and the front of the stage (the town band plays there)
  saloon: ["Saloon's shut till sundown, partner. Lock boxes are next door at the sheriff's.",
    "Doors stay shut till evening. The band out front keeps folks company meanwhile."],
  stage: ["That's the town band. The Professor on the piano, Josie on the harmonica.",
    "Stand a spell and listen, if you like. They play from sunup to sundown.",
    "Josie learned that harmonica on a cattle drive. The Professor plays it all by ear."],
};
// which job each line belongs to. A line still waiting its turn is dropped once the player is at another job, or once it
// has waited longer than KEEP_JOB seconds: said late it would be about a moment that has passed.
const JOB = { arrive: 'roundup', catch: 'roundup', miss: 'roundup', farmArrive: 'sheep', sheepHealed: 'sheep', sheepWrong: 'sheep',
  sheepFine: 'sheep', flockDone: 'sheep', pigsArrive: 'pigs', pigPenned: 'pigs', pigWrong: 'pigs', pigsDone: 'pigs', storeStart: 'store',
  storeMiss: 'store', storeEquation: 'store', storeDone: 'store', deliveryWork: 'delivery', deliveryMiss: 'delivery', deliveryRight: 'delivery',
  deliveryRoundUp: 'delivery', wagonArrive: 'wagon', banditCatch: 'wagon', banditMiss: 'wagon', banditLoop: 'wagon', banditsDone: 'wagon' };
const KEEP_JOB = 5;
const NEAR_AGAIN = 180;  // seconds before Hob says something about the same place again (walking past again and again doesn't set him off each time)

export function makeHob({ W, hud, rider, scene = W.scene, I = null, voice = null }) {
  const touch = () => !!(I && I.touch);
  const flags = () => { rider.flags = rider.flags && typeof rider.flags === 'object' ? rider.flags : {}; const f = rider.flags; f.hob = f.hob || {}; return f.hob; };
  const once = (id) => { const f = flags(); if (f[id]) return false; f[id] = 1; saveRider(rider); return true; };
  const queue = [];
  let fineN = 0, doneN = 0;       // ('sheepFine', 'flockDone': which line said last)
  let pigN = 0;                   // ('pigsDone': which line said last)
  let storeN = 0;                 // ('storeBack', 'storeDone': which line said last)
  let haulN = 0;                  // ('deliveryDone': which line said last)
  let hatN = 0;                   // ('hat': which line said last)
  let wagonN = 0;                 // ('banditsDone': which line said last)
  const nearAt = {}, nearN = {};   // ('near': when each place was last remarked on, and which line it said)
  let speaking = 0, now = 0;
  let saying = null;               // the line on screen: { text, key } (key = the event it came from)
  let key = null;                  // (the event being handled, so the line it says remembers where it came from)
  const B = {};
  B.say = (text, ms) => {
    if (!text) return;
    if (speaking > 0) { if (!queue.some((q) => q.text === text)) queue.push({ text, ms, key, at: now }); return; }
    const t = ms || Math.max(4500, 1800 + text.length * 55);
    hud.caption(text, t); speaking = t / 1000 + 0.4; saying = { text, key };
    if (voice) voice.speak(text);
  };
  // a moment has passed: drop those lines, whether waiting or on screen
  const drop = (...keys) => {
    for (let i = queue.length - 1; i >= 0; i--) if (keys.includes(queue[i].key)) queue.splice(i, 1);
    if (saying && speaking > 0 && keys.includes(saying.key)) { hud.caption(null); speaking = 0; saying = null; if (voice) voice.stop(); }
  };
  B.event = (name, data = {}) => {
    const job = JOB[name];
    // at another job now: what was waiting to be said about the last one no longer fits
    if (job) for (let i = queue.length - 1; i >= 0; i--) if (JOB[queue[i].key] && JOB[queue[i].key] !== job) queue.splice(i, 1);
    key = name;
    try { said(name, data); } finally { key = null; }
  };
  function said(name, data) {
    switch (name) {
      case 'ride': {
        const first = !flags().firstDay;
        if (first) { once('firstDay'); B.say(LINES.firstDay, 7000); }
        else B.say(LINES.back[Math.floor(Math.random() * LINES.back.length)]);
        if (data.mode === 'shoot') B.say(LINES.shoot);
        if (data.wagon && once('wagonWaits')) B.say(LINES.wagonWaits, 6500);   // (the first ride with "Protect the wagon" ticked)
        break;
      }
      case 'arrive': if (once('arrive')) B.say(touch() ? LINES.arriveTouch : LINES.arrive, 7000); break;
      case 'catch': drop('miss'); if (once('catch')) B.say(LINES.catch); break;
      case 'miss': if (once('miss')) B.say(LINES.miss); break;
      case 'waveDone':
        drop('miss');
        if (!(rider.owned && rider.owned.saddle) && rider.gold >= (data.saddle || 15) && once('waveSaddle')) B.say(LINES.waveSaddle, 6500);
        else if (once('wave')) B.say(LINES.wave);
        else if (once('farmTip')) B.say(LINES.farmTip, 6500);
        else if (rider.owned && rider.owned.saddle && once('campTip')) B.say(LINES.campTip, 8000);
        break;
      case 'boxWon': if (once('boxWon')) B.say(LINES.boxWon, 6500); break;
      case 'saddle': if (once('saddle')) B.say(LINES.saddle, 6500); break;
      case 'dog': {
        // (the pug can't keep up with a galloping horse, so he gets his own line)
        const pug = rider.owned && rider.owned.dog && rider.owned.dog.kind === 'pug';
        if (pug ? once('dogPug') : once('dog')) B.say(pug ? LINES.dogPug : LINES.dog);
        break;
      }
      case 'horse': B.say(rider.owned && rider.owned.horse === 'donkey' ? LINES.donkey : LINES.horse); break;
      case 'hat': B.say(LINES.hat[(hatN++) % LINES.hat.length], 3000); break;
      case 'farmArrive': if (once('farmArrive')) B.say(touch() ? LINES.farmArriveTouch : LINES.farmArrive, 9000); break;
      case 'sheepHealed': drop('sheepWrong', 'sheepFine'); if (once('sheepHealed')) B.say(LINES.sheepHealed); break;
      case 'sheepWrong': if (once('sheepWrong')) B.say(LINES.sheepWrong); break;
      // (said at once, over anything he was saying: said later it would seem to be about some other sheep)
      case 'sheepFine': queue.length = 0; speaking = 0; B.say(LINES.sheepFine[(fineN++) % LINES.sheepFine.length], 3500); break;
      case 'flockDone': drop('sheepWrong', 'sheepFine', 'sheepHealed'); B.say(LINES.flockDone[(doneN++) % LINES.flockDone.length]); break;
      case 'pigsArrive': if (once('pigsArrive')) B.say(LINES.pigsArrive, 9000); break;
      case 'pigPenned': if (once('pigPenned')) B.say(LINES.pigPenned); break;
      // (the why, said at once over anything else: the pig is trotting back out right now)
      case 'pigWrong': queue.length = 0; speaking = 0; B.say(data.line, Math.max(5000, 1800 + String(data.line || '').length * 55)); break;
      case 'pigsDone': drop('pigWrong', 'pigPenned'); B.say(LINES.pigsDone[(pigN++) % LINES.pigsDone.length]); break;
      case 'storeStart': if (once('storeStart')) B.say(LINES.storeStart, 7000); else B.say(LINES.storeBack[(storeN++) % LINES.storeBack.length], 3000); break;
      case 'storeRight': drop('storeMiss'); break;
      case 'storeMiss': if (once('storeMiss')) B.say(LINES.storeMiss, 6500); break;
      case 'storeEquation': if (once('storeEquation')) B.say(LINES.storeEquation, 6500); break;
      case 'storeDone': drop('storeMiss', 'storeEquation', 'storeStart'); if (data.filled) B.say(LINES.storeDone[(storeN++) % LINES.storeDone.length], 3500); break;
      case 'deliveryOrder': if (once('deliveryOrder')) B.say(LINES.deliveryOrder, 6500); break;
      case 'deliveryWork': if (once('deliveryWork')) B.say(LINES.deliveryWork, 6000); break;
      case 'deliveryRight': drop('deliveryMiss', 'deliveryRoundUp'); break;
      // (the leftover slip gets its own line, the first time it is made: rounding up is the point of the job)
      case 'deliveryMiss': if (data.slip === 'roundDown' && once('deliveryRoundUp')) B.say(LINES.deliveryRoundUp, 6500); else if (once('deliveryMiss')) B.say(LINES.deliveryMiss, 5000); break;
      case 'deliveryLoaded': if (once('deliveryLoaded')) B.say(LINES.deliveryLoaded); break;
      case 'deliveryArrive': if (once('deliveryArrive')) B.say(LINES.deliveryArrive, 3500); break;
      case 'deliveryDone': drop('deliveryArrive'); if (data.first && once('deliveryFirst')) B.say(LINES.deliveryFirst, 6000); else B.say(LINES.deliveryDone[(haulN++) % LINES.deliveryDone.length], 3500); break;
      case 'deliveryNoSaddle': if (once('deliveryNoSaddle')) B.say(LINES.deliveryNoSaddle); break;
      case 'deliveryRobbed': B.say(LINES.deliveryRobbed, 6000); break;
      case 'wagonArrive': if (once('wagonArrive')) B.say(touch() ? LINES.wagonArriveTouch : LINES.wagonArrive, 9000); break;
      case 'banditCatch': drop('banditMiss'); if (once('banditCatch')) B.say(LINES.banditCatch); break;
      case 'banditMiss': if (once('banditMiss')) B.say(LINES.banditMiss, 6000); break;
      case 'banditLoop': if (once('banditLoop')) B.say(LINES.banditLoop); break;
      case 'banditsDone': drop('banditMiss', 'banditCatch', 'banditLoop'); B.say(LINES.banditsDone[(wagonN++) % LINES.banditsDone.length], 3500); break;
      case 'wagonStop': if (once('wagonStop')) B.say(LINES.wagonStop, 3000); break;
      case 'near': {
        const L = LINES[data.place], t = performance.now() / 1000;
        if (!Array.isArray(L) || t - (nearAt[data.place] ?? -1e9) < NEAR_AGAIN) break;
        nearAt[data.place] = t;
        B.say(L[(nearN[data.place] = ((nearN[data.place] ?? -1) + 1)) % L.length]);
        break;
      }
      default: break;
    }
  }

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
    if (voice) voice.update(dt);
    now += dt;
    // (a job line that waited too long is dropped, not said late)
    for (let i = queue.length - 1; i >= 0; i--) if (JOB[queue[i].key] && now - queue[i].at > KEEP_JOB) queue.splice(i, 1);
    if (speaking > 0 && (speaking -= dt) <= 0) {
      saying = null;
      if (queue.length) { const q = queue.shift(); key = q.key; B.say(q.text, q.ms); key = null; }
    }
    const pa = W.places.pasture;
    const near = at && pa ? Math.hypot(at.x - pa.x, at.z - pa.z) < HOB.hideNear : false;
    const target = want && !near ? 1 : 0;
    fade += Math.sign(target - fade) * Math.min(Math.abs(target - fade), dt / 0.8);
    U.uFade.value = fade; U.uTime.value = time;
    mesh.visible = fade > 0.002;
  };
  B.prints = prints.length;
  B.dispose = () => { scene.remove(mesh); geo.dispose(); mat.dispose(); tex.dispose(); hud.caption(null); if (voice) voice.stop(); };
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
