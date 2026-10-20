// THE JOBS BOARD: a big notice board on the edge of the town square listing the town's jobs, each on its own notice
// with a picture and its name (so a rider who can't read yet can use it too). Walk or ride up to it and the prompt says
// "Read the jobs board": E (or a tap on the prompt) opens it big on the screen, its notices as large picture cards (a
// line under each for a reader: what the job is, and how far and which way). Tap one, or click a notice on the board
// itself from close by, and Old Hob's golden hoofprints lead to that job (src/hob.js; main.js gives the trail JB.goal()
// first). Picking a job never stops anything: every job still starts wherever the rider finds it. The tracks give way
// once the rider gets to the job picked, or is at work at any job (a steer roped, a slip up...), and the trail goes back to
// what it was.
// A job that needs a saddled horse (deliveries, the gang's loot) leads by the stable first while the rider has none.
//
// The board: two posts, a shingled roof, a plank backboard with a painted "JOBS" header and the notices pinned on it
// (one canvas picture: src drawn here in code), a lantern on a post that glows at night (W.night, when the world has
// it). Three draws, and it blocks walkers at its posts. Only the jobs on for this rider are pinned up.
//
//   const JB = makeJobsBoard({ W, camera, I, hud, rider, player, jobs, onOpen, onClose, speak, scene })
//     player(): the player (P); jobs: { roundup, sheep, pigs, store, delivery, wagon, deer, range, loot, farm, camps,
//       jobfolk }: each () -> that job's object or null (a job turned off is null: not on the board); onOpen / onClose:
//       the game pauses while the board's panel is up; speak(text): read out for a rider who can't read yet (or null)
//   JB.update(dt, at, { busy })   each frame of play; busy: the job asking a question where the player is (main.js
//                       askingJob: 'roundup', 'store', ..., or 'panel'), or null: a sit-down one (the store's counter, a
//                       delivery's slip, the camera, the loot's slip, the range) means the rider is at work there
//   JB.heard(event)     what the jobs tell Old Hob (src/hob.js events): one that means the rider is working at a job (a
//                       steer roped or missed, a sheep dosed, a bandit roped...) lets the tracks give way
//   JB.prompt           'Read the jobs board' near its front, else null;  JB.open()  opens the board's panel (as E there)
//   JB.goal()           { id, x, z, hide } while a picked job's tracks are wanted, else null
//   JB.pick(id)         as tapping that job's notice;  JB.picked  the job picked (its id) or null (it stays main.js's
//                       chosen job after the tracks give way: the card and the trail keep to it, see main.js THE JOB)
//   JB.where(id), JB.nameOf(id), JB.whatOf(id), JB.wayTo(from, to)   where a job is, its name and line, 'north-east'...
//   JB.jobs             the jobs on the board now: [{ id, name, what, pic, saddle }]
//   JB.screenOf(id)     (rigs) where that job's notice is on the page { x, y, on } (the board in view), or null
//   JB.state(), JB.dispose()
//   BOARD_JOBS, BOARD, boardSpot(W), drawPic(ctx, kind, x, y, size)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makePanel } from './shop.js';
import { HOB } from './hob.js';
import { forgetPlants } from './missions/loot.js';

// the jobs, in the order they're pinned up (pic: the picture drawn for it; saddle: it needs a saddled horse)
export const BOARD_JOBS = [
  { id: 'roundup', name: 'Round-up', pic: 'steer', what: 'Rope the cattle with the right numbers' },
  { id: 'sheep', name: 'Sick sheep', pic: 'sheep', what: 'Give each sick sheep the right medicine' },
  { id: 'pigs', name: 'Loose pigs', pic: 'pig', what: 'Herd the loose pigs into the right pens' },
  { id: 'store', name: 'Mind the store', pic: 'slip', what: "Fill the townsfolk's order slips" },
  { id: 'delivery', name: 'Deliveries', pic: 'crate', what: 'Haul supplies out to the camps', saddle: true },
  { id: 'wagon', name: 'Protect the wagon', pic: 'wagon', what: 'Rope the gang that jumps the wagon' },
  { id: 'deer', name: 'Deer photos', pic: 'deer', what: "Take the deer's pictures for Miss Wren" },
  { id: 'range', name: 'Bottle range', pic: 'bottles', what: "Shoot bottles at Miss Opal's range" },
  { id: 'loot', name: 'Loot the gang', pic: 'chest', what: 'Bring back what the gang stole', saddle: true },
  { id: 'boxes', name: 'Lock boxes', pic: 'lock', what: "Crack the sheriff's seized boxes" },
];

export const BOARD = {
  spot: { x: -13.5, z: -218.8 },   // where it stands: the north edge of the square, facing its middle (metres, world)
  w: 4.0, h: 2.55, low: 0.85,      // the backboard: width, height, its bottom edge above the ground (m)
  post: 3.75,                      // the posts' height (m)
  mow: 3.5, mowFade: 2,            // m round it where the meadow is mown (no tall grass in front of the notices)
  near: 4.5,                     // m from the spot in front of it where the prompt shows
  front: 2.2,                    // ... that spot: this far out in front of the board
  click: 18,                     // m: a click on a notice on the board itself picks from no further than this
  arrive: HOB.goalNear,          // m from a picked job where the tracks give way to the job's own
  tex: [1536, 980],              // the board's picture (pixels; the potato tier has half)
  cols: 5,                       // notices a row
};

// where the board stands, and the way it faces (toward the square's middle)
export function boardSpot(W) {
  const sq = W.places.square || W.places.spawn || { x: 0, z: 0 }, s = BOARD.spot;
  return { x: s.x, z: s.z, rot: Math.atan2(sq.x - s.x, sq.z - s.z) };
}

// ── THE PICTURES (drawn in code, in a 100 x 100 box) ─────────────────────────────────────────────────────────────────
const INK = '#2b1d12';
export function drawPic(ctx, kind, x, y, size) {
  const c = ctx; c.save(); c.translate(x, y); c.scale(size / 100, size / 100);
  c.lineJoin = 'round'; c.lineCap = 'round';
  const fill = (col, path) => { c.beginPath(); path(); c.fillStyle = col; c.fill(); c.lineWidth = 2.4; c.strokeStyle = INK; c.stroke(); };
  const ell = (cx, cy, rx, ry, rot = 0) => () => c.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  const rect = (x0, y0, w, h, r = 2) => () => { c.roundRect ? c.roundRect(x0, y0, w, h, r) : c.rect(x0, y0, w, h); };
  const dot = (cx, cy, r, col = INK) => { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); };
  const line = (pts, w, col = INK) => { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.lineWidth = w; c.strokeStyle = col; c.stroke(); };
  switch (kind) {
    case 'steer': {   // a steer's head, horns out wide, a rope loop over them
      line([[10, 30], [18, 22], [30, 24], [38, 31]], 9); line([[10, 30], [18, 22], [30, 24], [38, 31]], 5.5, '#efe3c4');
      line([[90, 30], [82, 22], [70, 24], [62, 31]], 9); line([[90, 30], [82, 22], [70, 24], [62, 31]], 5.5, '#efe3c4');
      fill('#7a4a2a', ell(25, 40, 9, 5, 0.4)); fill('#7a4a2a', ell(75, 40, 9, 5, -0.4));
      fill('#8a5532', () => { c.moveTo(33, 30); c.quadraticCurveTo(50, 24, 67, 30); c.quadraticCurveTo(70, 52, 63, 72); c.lineTo(37, 72); c.quadraticCurveTo(30, 52, 33, 30); });
      fill('#f2e6cf', () => { c.moveTo(50, 31); c.lineTo(56, 42); c.lineTo(50, 56); c.lineTo(44, 42); c.closePath(); });
      fill('#d9a98e', ell(50, 76, 15, 10)); dot(44, 77, 2.4); dot(56, 77, 2.4);
      dot(41, 46, 3); dot(59, 46, 3);
      c.beginPath(); c.ellipse(50, 18, 34, 8, 0, 0, Math.PI * 2); c.lineWidth = 3.2; c.strokeStyle = '#b8894a'; c.stroke();
      break;
    }
    case 'sheep': {   // a woolly sheep, and a medicine bottle with a cross
      for (const [cx, cy] of [[38, 46], [52, 42], [66, 46], [72, 58], [60, 64], [44, 64], [32, 58], [52, 54]]) fill('#f4f0e6', ell(cx, cy, 12, 11));
      for (const lx of [38, 48, 58, 68]) line([[lx, 70], [lx, 84]], 5);
      fill('#3d3a36', ell(22, 50, 9, 11, -0.3)); fill('#3d3a36', ell(16, 43, 5, 3, -0.6)); dot(20, 49, 1.6, '#fff');
      fill('#7d4e22', rect(76, 60, 16, 26, 3)); fill('#7d4e22', rect(80, 54, 8, 8, 1)); fill('#f6efe0', rect(78, 66, 12, 12, 1));
      line([[84, 68], [84, 76]], 2.6, '#c0392b'); line([[80, 72], [88, 72]], 2.6, '#c0392b');
      break;
    }
    case 'pig': {   // a pink pig, side on, its tail curled
      for (const lx of [30, 40, 62, 72]) line([[lx, 66], [lx, 82]], 6, '#c97b7b');
      fill('#f2a9a6', ell(50, 56, 30, 18));
      fill('#f2a9a6', ell(80, 50, 13, 13));
      fill('#f6c3bf', ell(92, 54, 5.5, 7)); dot(91, 52, 1.2); dot(93.5, 56, 1.2);
      fill('#e58f8b', () => { c.moveTo(74, 40); c.lineTo(78, 28); c.lineTo(84, 39); c.closePath(); });
      dot(82, 47, 2);
      c.beginPath(); c.moveTo(20, 52); c.bezierCurveTo(8, 50, 10, 40, 15, 42); c.bezierCurveTo(20, 44, 14, 50, 10, 46); c.lineWidth = 2.6; c.strokeStyle = INK; c.stroke();
      break;
    }
    case 'slip': {   // an order slip with its lines, and two gold coins
      c.save(); c.translate(42, 46); c.rotate(-0.12);
      fill('#f6ecd2', rect(-28, -34, 56, 68, 2));
      for (let i = 0; i < 5; i++) line([[-20, -22 + i * 11], [i === 4 ? 4 : 20, -22 + i * 11]], 2, '#8a6a46');
      c.restore();
      fill('#e2b33c', ell(72, 74, 15, 15)); c.font = 'bold 18px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK; c.fillText('$', 72, 75);
      fill('#e8c04e', ell(84, 60, 11, 11));
      break;
    }
    case 'crate': {   // a slatted crate
      fill('#b98a52', () => { c.moveTo(22, 36); c.lineTo(38, 22); c.lineTo(84, 22); c.lineTo(68, 36); c.closePath(); });
      fill('#9c7040', () => { c.moveTo(68, 36); c.lineTo(84, 22); c.lineTo(84, 70); c.lineTo(68, 84); c.closePath(); });
      fill('#a87a46', rect(22, 36, 46, 48, 1));
      for (const ly of [48, 60, 72]) line([[24, ly], [66, ly]], 2, '#6d4a26');
      line([[28, 37], [28, 83]], 4, '#5b3e20'); line([[62, 37], [62, 83]], 4, '#5b3e20');
      c.beginPath(); c.arc(45, 60, 8, 0, Math.PI * 2); c.lineWidth = 2.4; c.strokeStyle = '#3a2a18'; c.stroke();
      break;
    }
    case 'wagon': {   // a covered wagon, side on
      fill('#f3ebd8', () => { c.moveTo(18, 56); c.bezierCurveTo(18, 18, 82, 18, 82, 56); c.closePath(); });
      for (const lx of [34, 50, 66]) line([[lx, 30 + Math.abs(lx - 50) * 0.3], [lx, 55]], 1.8, '#a89878');
      fill('#8a5a32', rect(14, 54, 72, 14, 2));
      for (const wx of [28, 72]) {
        fill('#5a3a22', ell(wx, 74, 12, 12)); fill('#c9a46a', ell(wx, 74, 3, 3));
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; line([[wx, 74], [wx + Math.cos(a) * 11, 74 + Math.sin(a) * 11]], 1.6, '#c9a46a'); }
      }
      line([[86, 62], [97, 66]], 3, '#5a3a22');
      break;
    }
    case 'deer': {   // a stag, side on, his antlers up
      for (const [lx, ly] of [[34, 62], [42, 62], [66, 62], [72, 62]]) line([[lx, ly], [lx + 1, 88]], 3.6, '#7a5232');
      fill('#b07a48', ell(52, 56, 24, 12));
      fill('#b07a48', () => { c.moveTo(68, 52); c.lineTo(76, 30); c.lineTo(84, 32); c.lineTo(78, 56); c.closePath(); });
      fill('#b07a48', ell(84, 30, 9, 6, 0.3));
      dot(85, 28, 1.6); fill('#8a5a32', ell(77, 23, 4, 2, -0.6));
      line([[80, 24], [74, 10], [68, 4]], 2.8, '#6d4a2a'); line([[75, 13], [80, 6]], 2.4, '#6d4a2a'); line([[83, 24], [88, 10], [94, 6]], 2.8, '#6d4a2a'); line([[87, 13], [84, 6]], 2.4, '#6d4a2a');
      fill('#f2e6cf', ell(30, 50, 4, 3));
      break;
    }
    case 'bottles': {   // three bottles and a tin can on a plank
      fill('#8a5a32', rect(6, 76, 88, 8, 1));
      const bottle = (bx, h, col) => fill(col, () => { c.moveTo(bx - 7, 76); c.lineTo(bx - 7, 76 - h + 16); c.quadraticCurveTo(bx - 7, 76 - h + 8, bx - 3, 76 - h + 6); c.lineTo(bx - 3, 76 - h); c.lineTo(bx + 3, 76 - h); c.lineTo(bx + 3, 76 - h + 6); c.quadraticCurveTo(bx + 7, 76 - h + 8, bx + 7, 76 - h + 16); c.lineTo(bx + 7, 76); c.closePath(); });
      bottle(20, 50, '#4f8a4a'); bottle(40, 58, '#8a5a2a'); bottle(60, 46, '#7fb0c8');
      fill('#b8bcc0', rect(72, 52, 18, 24, 2)); line([[72, 58], [90, 58]], 1.6, '#6a6e72'); line([[72, 70], [90, 70]], 1.6, '#6a6e72');
      break;
    }
    case 'chest': {   // the gang's strongbox, banded in iron, a sack beside it
      fill('#c4a774', () => { c.moveTo(66, 84); c.quadraticCurveTo(62, 58, 74, 50); c.lineTo(78, 44); c.lineTo(84, 50); c.quadraticCurveTo(96, 58, 92, 84); c.closePath(); });
      fill('#5a3a22', rect(10, 44, 58, 40, 2)); fill('#6a4428', () => { c.moveTo(10, 44); c.quadraticCurveTo(39, 26, 68, 44); c.closePath(); });
      for (const bx of [20, 58]) line([[bx, 36], [bx, 84]], 5, '#3a3836');
      fill('#d1a542', rect(33, 52, 12, 14, 2)); dot(39, 58, 2);
      break;
    }
    case 'lock': {   // a padlock, and the sheriff's star
      c.beginPath(); c.arc(42, 40, 18, Math.PI, 0); c.lineWidth = 9; c.strokeStyle = INK; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#9aa0a6'; c.stroke();
      fill('#6e6a62', rect(16, 40, 52, 44, 5)); dot(42, 58, 5); line([[42, 60], [42, 72]], 4);
      c.save(); c.translate(78, 30); fill('#e2b33c', () => { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 7 : 16; k ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); }); c.restore();
      break;
    }
    case 'saddle': {   // a small saddle (the "needs a saddle" badge)
      fill('#8a5532', () => { c.moveTo(14, 52); c.quadraticCurveTo(30, 34, 50, 44); c.quadraticCurveTo(70, 34, 86, 42); c.quadraticCurveTo(80, 60, 50, 62); c.quadraticCurveTo(22, 64, 14, 52); });
      fill('#6a3e22', ell(76, 36, 5, 7, 0.4)); line([[50, 60], [50, 80]], 3); fill('#7a7672', rect(44, 78, 12, 6, 2));
      break;
    }
    default: break;
  }
  c.restore();
}
// a picture as an image (for the panel's cards)
const picURLs = new Map();
function picURL(kind, px = 160) {
  const key = kind + px; if (picURLs.has(key)) return picURLs.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = px; drawPic(cv.getContext('2d'), kind, 0, 0, px);
  const u = cv.toDataURL('image/png'); picURLs.set(key, u); return u;
}

// the board's face: weathered planks, the JOBS header, the notices pinned on in rows; -> { canvas, hits: [{ id, u0, v0,
// u1, v1 }] } (each notice's box on the picture, 0..1 across and up)
function paintBoard(list, [W0, H0]) {
  const cv = document.createElement('canvas'); cv.width = W0; cv.height = H0;
  const c = cv.getContext('2d'), k = W0 / 1536;
  // planks, each a little different, with grain and gaps
  const planks = 7, ph = H0 / planks;
  for (let i = 0; i < planks; i++) {
    c.fillStyle = ['#7a5636', '#6f4e31', '#80603e', '#734f33', '#7d5838', '#6c4b2f', '#785536'][i]; c.fillRect(0, i * ph, W0, ph);
    c.strokeStyle = 'rgba(40,25,12,0.25)'; c.lineWidth = 1.5 * k;
    for (let g = 0; g < 6; g++) { c.beginPath(); const y = i * ph + (g + 1) * ph / 7; c.moveTo(0, y); c.bezierCurveTo(W0 * 0.3, y - 4 * k, W0 * 0.6, y + 5 * k, W0, y - 2 * k); c.stroke(); }
    c.fillStyle = 'rgba(25,15,8,0.55)'; c.fillRect(0, i * ph, W0, 3 * k);
  }
  // the header: "JOBS" painted big on a lighter board, "help wanted" under it
  const hh = 190 * k;
  c.fillStyle = '#e9d9b4'; c.fillRect(W0 * 0.3, 18 * k, W0 * 0.4, hh - 30 * k);
  c.strokeStyle = '#3a2615'; c.lineWidth = 6 * k; c.strokeRect(W0 * 0.3, 18 * k, W0 * 0.4, hh - 30 * k);
  c.fillStyle = '#5a2a14'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `bold ${118 * k}px Rye, "Bitter", Georgia, serif`; c.fillText('JOBS', W0 / 2, 18 * k + (hh - 30 * k) * 0.44);
  c.font = `600 ${30 * k}px Bitter, Georgia, serif`; c.fillStyle = '#3a2615'; c.fillText('help wanted · tap a job', W0 / 2, 18 * k + (hh - 30 * k) * 0.86);
  // the notices: rows of parchment, each with its picture and name, pinned at the top
  const hits = [], cols = Math.min(BOARD.cols, Math.max(1, Math.ceil(list.length / 2))), rows = Math.ceil(list.length / cols);
  const top = hh + 8 * k, gw = W0 / cols, gh = (H0 - top - 16 * k) / Math.max(1, rows);
  list.forEach((j, i) => {
    const r = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, list.length - r * cols);
    const ox = (W0 - inRow * gw) / 2, cx = ox + gw * (col + 0.5), cy = top + gh * (r + 0.5);
    const w = gw * 0.86, h = gh * 0.9, tilt = (((i * 37) % 7) - 3) * 0.012;
    c.save(); c.translate(cx, cy); c.rotate(tilt);
    c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(-w / 2 + 6 * k, -h / 2 + 8 * k, w, h);
    c.fillStyle = '#f3e7cb'; c.fillRect(-w / 2, -h / 2, w, h);
    c.strokeStyle = 'rgba(120,85,45,0.5)'; c.lineWidth = 3 * k; c.strokeRect(-w / 2 + 6 * k, -h / 2 + 6 * k, w - 12 * k, h - 12 * k);
    const ps = Math.min(w * 0.82, h * 0.66);
    drawPic(c, j.pic, -ps / 2, -h / 2 + h * 0.06, ps);
    c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
    let fs = 40 * k; c.font = `bold ${fs}px Bitter, Georgia, serif`;
    while (c.measureText(j.name).width > w * 0.92 && fs > 18 * k) { fs -= 2 * k; c.font = `bold ${fs}px Bitter, Georgia, serif`; }
    c.fillText(j.name, 0, h / 2 - h * 0.14);
    if (j.saddle) drawPic(c, 'saddle', w / 2 - 54 * k, -h / 2 + 6 * k, 48 * k);
    c.fillStyle = '#9a9690'; c.beginPath(); c.arc(0, -h / 2 + 12 * k, 7 * k, 0, Math.PI * 2); c.fill();   // (the nail)
    c.restore();
    hits.push({ id: j.id, u0: (cx - w / 2) / W0, u1: (cx + w / 2) / W0, v0: 1 - (cy + h / 2) / H0, v1: 1 - (cy - h / 2) / H0 });
  });
  return { canvas: cv, hits, header: { u0: 0.3, u1: 0.7, v0: 1 - hh / H0, v1: 1 } };
}

const WAY8 = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const wayTo = (from, to) => WAY8[Math.round(((Math.atan2(to.x - from.x, -(to.z - from.z)) * 180 / Math.PI) + 360) % 360 / 45) % 8];   // (north is -z)

export function makeJobsBoard({ W, camera, I = null, hud = null, rider = null, player = () => null, jobs = {}, onOpen = () => {}, onClose = () => {}, speak = null, scene = W.scene }) {
  const shadows = !!(W.V && W.V.SHADOW ? W.V.SHADOW.on : true);
  const get = (k) => { try { return jobs[k] ? jobs[k]() : null; } catch (e) { return null; } };
  // the jobs on the board: those this rider has (a grown-up may have turned some off); the round-up and the sheriff's
  // lock boxes always
  const on = { roundup: () => !!get('roundup'), sheep: () => !!get('sheep'), pigs: () => !!get('pigs'), store: () => !!get('store'), delivery: () => !!get('delivery'),
    wagon: () => !!get('wagon'), deer: () => !!get('deer'), range: () => !!get('range'), loot: () => !!get('loot'), boxes: () => true };
  const list = BOARD_JOBS.filter((j) => on[j.id]());
  const B = boardSpot(W), c = Math.cos(B.rot), s = Math.sin(B.rot);
  const at = (lx, lz) => ({ x: B.x + c * lx + s * lz, z: B.z - s * lx + c * lz });   // (the board's own frame: x along it, z out of its face)
  const yL = at(-1.75, 0), yR = at(1.75, 0), y0 = Math.min(W.heightAt(yL.x, yL.z), W.heightAt(yR.x, yR.z));   // (the lower post's foot: the other sinks a little)

  // ── THE BOARD ──────────────────────────────────────────────────────────────────────────────────────────────────
  const root = new THREE.Group(); root.name = 'jobs-board';
  root.position.set(B.x, y0, B.z); root.rotation.y = B.rot;
  const wood = new THREE.MeshStandardMaterial({ color: 0x5c3d24, roughness: 0.9, metalness: 0 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 0.95, metalness: 0 });
  const half = BOARD.w / 2, top = BOARD.low + BOARD.h;
  const parts = [];
  for (const sx of [-1, 1]) parts.push(new THREE.BoxGeometry(0.15, BOARD.post + 0.25, 0.15).translate(sx * (half + 0.12), (BOARD.post - 0.25) / 2, -0.05));   // the posts (a little in the ground)
  parts.push(new THREE.BoxGeometry(BOARD.w + 0.2, 0.1, 0.09).translate(0, top + 0.05, 0), new THREE.BoxGeometry(BOARD.w + 0.2, 0.1, 0.09).translate(0, BOARD.low - 0.05, 0));   // the frame, top and bottom
  for (const sx of [-1, 1]) parts.push(new THREE.BoxGeometry(0.1, BOARD.h + 0.2, 0.09).translate(sx * (half + 0.05), BOARD.low + BOARD.h / 2, 0));
  parts.push(new THREE.BoxGeometry(BOARD.w, BOARD.h, 0.05).translate(0, BOARD.low + BOARD.h / 2, -0.06));   // the backboard's back
  parts.push(new THREE.BoxGeometry(BOARD.w + 0.1, 0.06, 0.32).translate(0, BOARD.low - 0.08, 0.14));       // a ledge under the notices
  const woodMesh = new THREE.Mesh(mergeGeometries(parts), wood); parts.forEach((g) => g.dispose());
  // the roof: two shingled slopes over the top, front and back
  const roofParts = [];
  for (const sz of [-1, 1]) roofParts.push(new THREE.BoxGeometry(BOARD.w + 0.9, 0.06, 0.62).rotateX(sz * 0.42).translate(0, BOARD.post + 0.06, sz * 0.27));
  const roofMesh = new THREE.Mesh(mergeGeometries(roofParts), roofMat); roofParts.forEach((g) => g.dispose());
  // the face with the notices
  const tier = W.tier || 'normal', [TW, TH] = tier === 'potato' ? BOARD.tex.map((v) => v / 2) : BOARD.tex;
  const painted = paintBoard(list, [TW, TH]);
  const tex = new THREE.CanvasTexture(painted.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, BOARD.h).translate(0, BOARD.low + BOARD.h / 2, -0.03), faceMat);
  face.name = 'jobs-board-face';
  for (const m of [woodMesh, roofMesh, face]) { m.castShadow = shadows; m.receiveShadow = shadows; root.add(m); }
  // a lantern on the left post, glowing at night
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffb04a, emissiveIntensity: 0.15, roughness: 0.4 });
  const lamp = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(0.16, 0.22, 0.16).translate(0, 0, 0), new THREE.ConeGeometry(0.13, 0.1, 4).rotateY(Math.PI / 4).translate(0, 0.16, 0)]), lampMat);
  lamp.position.set(-(half + 0.12), BOARD.low + BOARD.h * 0.55, 0.2); root.add(lamp);
  scene.add(root);
  root.updateMatrixWorld(true);
  // the posts block walkers (the board between them doesn't reach the ground: nobody walks through a notice board)
  const postsAt = [at(-(half + 0.12), -0.05), at(half + 0.12, -0.05)];
  const offBlock = W.addBlocker ? W.addBlocker((x, z) => {
    if (Math.abs(x - B.x) > 3 || Math.abs(z - B.z) > 3) return false;
    const dx = x - B.x, dz = z - B.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lz + 0.05) < 0.35 && Math.abs(lx) < half + 0.35;
  }) : () => {};
  const front = at(0, BOARD.front);
  // the meadow round it mown, as round the camps (the old values come back when it goes; the plants laid there are
  // forgotten, so they're laid again from the mown ground: src/missions/loot.js forgetPlants)
  const unmow = (() => {
    const V = W.V, T = V && V.TOWN;
    if (!T || !T.yard || !V.N || !V.TEX) return () => {};
    const N = V.N, TEX = V.TEX, SIZE = V.SIZE, old = new Map(), R = BOARD.mow + BOARD.mowFade + TEX;
    for (let j = Math.max(0, Math.floor((B.z - R + SIZE / 2) / TEX)); j <= Math.min(N - 1, Math.ceil((B.z + R + SIZE / 2) / TEX)); j++)
      for (let i = Math.max(0, Math.floor((B.x - R + SIZE / 2) / TEX)); i <= Math.min(N - 1, Math.ceil((B.x + R + SIZE / 2) / TEX)); i++) {
        const d = Math.hypot((i + 0.5) * TEX - SIZE / 2 - B.x, (j + 0.5) * TEX - SIZE / 2 - B.z);
        const t = Math.min(1, Math.max(0, (d - BOARD.mow) / BOARD.mowFade)), v = 1 - t * t * (3 - 2 * t);
        const k = j * N + i; if (v > T.yard[k]) { if (!old.has(k)) old.set(k, T.yard[k]); T.yard[k] = v; }
      }
    forgetPlants(V, B.x, B.z, R);
    return () => { for (const [k, v] of old) T.yard[k] = v; forgetPlants(V, B.x, B.z, R); };
  })();

  // ── WHERE EACH JOB IS (where the tracks lead) ────────────────────────────────────────────────────────────────────
  const P = () => player();
  const door = (k) => { const b = W.places[k]; return b && b.door ? { x: b.door.x, z: b.door.z } : null; };
  const first = (ms) => (ms && ms[0] ? { x: ms[0].x, z: ms[0].z } : null);
  const needsSaddle = (j) => !!(j && j.saddle && P() && !P().canRide);
  function jobPlace(id) {
    const p = P(), pos = p && p.position;
    switch (id) {
      case 'roundup': {   // (out to the corral at the end of the town's trail, as on the first day; none once in the pasture)
        const pa = W.places.pasture, t = W.places.trail; if (!pa) return null;
        const e = t && t.length ? t[t.length - 1] : [pa.x, pa.z];
        return { x: e[0], z: e[1], hide: { x: pa.x, z: pa.z, r: HOB.hideNear } };
      }
      case 'sheep': { const f = get('farm'), g = f && f.layout && f.layout.sheep && f.layout.sheep.gate; return g ? { x: g.out.x, z: g.out.z } : null; }
      case 'pigs': { const f = get('farm'), g = f && f.layout && f.layout.yard && f.layout.yard.gate; return g ? { x: g.out.x, z: g.out.z } : null; }
      case 'store': return door('store');
      case 'boxes': return door('sheriff');
      case 'delivery': {
        const DL = get('delivery'); const m = DL && first(DL.marks()); if (m) return m;
        // (no order yet: the nearest camp's foreman)
        const C = get('camps'); if (!C || !C.list || !pos) return null;
        let best = null, bd = Infinity; for (const cp of C.list) { const d = Math.hypot(cp.x - pos.x, cp.z - pos.z); if (d < bd) { bd = d; best = cp; } }
        return best ? { x: best.foreman.x, z: best.foreman.z } : null;
      }
      case 'wagon': { const WJ = get('wagon'); return WJ && WJ.where ? WJ.where() : null; }
      case 'deer': {
        const DJ = get('deer'), JF = get('jobfolk'); if (!DJ) return null;
        const n = !DJ.lent() && JF && JF.people && JF.people.find((r) => r.id === 'naturalist' && r.placed);   // (her camera first)
        return n ? { x: n.x, z: n.z } : first(DJ.marks());
      }
      case 'range': { const SR = get('range'); return SR ? first(SR.marks()) || (SR.layout ? { x: SR.layout.x, z: SR.layout.z } : null) : null; }
      case 'loot': {
        const LJ = get('loot'); if (!LJ) return null;
        if (LJ.phase === 'carrying') return first(LJ.marks());
        return (LJ.nearestLoot && pos && LJ.nearestLoot(pos)) || first(LJ.marks());
      }
      default: return null;
    }
  }

  // ── PICKING A JOB ──────────────────────────────────────────────────────────────────────────────────────────────
  let picked = null, panel = null;   // picked: { id, t }
  const JB = { prompt: null, jobs: list.map((j) => ({ ...j })) };
  JB.pick = (id) => {
    const j = list.find((q) => q.id === id); if (!j) return false;
    picked = { id, t: 0 };
    if (panel) { const pn = panel; panel = null; pn.close(); }
    const saddle = needsSaddle(j);
    const line = saddle ? `${j.name} needs a saddled horse: the hoofprints go by the stable first` : `The hoofprints lead to the job: ${j.name}`;
    if (hud) hud.toast(line, 'good');
    if (speak) try { speak(saddle ? `${j.name}. First, a saddle at the stable. Follow the hoofprints.` : `${j.name}. Follow the hoofprints.`) } catch (e) { /* (no voice) */ }
    return true;
  };
  JB.goal = () => {
    if (!picked) return null;
    const j = list.find((q) => q.id === picked.id); if (!j) return null;
    if (needsSaddle(j)) { const d = door('stable'); return d ? { id: 'board:' + j.id + ':stable', x: d.x, z: d.z } : null; }
    const g = jobPlace(j.id); if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.z)) return null;
    return { id: 'board:' + j.id, x: g.x, z: g.z, hide: g.hide };
  };
  Object.defineProperty(JB, 'picked', { get: () => (picked ? picked.id : null) });
  // where a job is (by the stable first while it needs a saddle the rider hasn't got), its name, and which way it lies
  // from a spot: for main.js's card of the job the rider chose, while that job has no card of its own up
  JB.where = (id) => {
    const j = list.find((q) => q.id === id); if (!j) return null;
    if (needsSaddle(j)) { const d = door('stable'); return d ? { x: d.x, z: d.z, stable: true } : null; }
    const g = jobPlace(id); return g && Number.isFinite(g.x) && Number.isFinite(g.z) ? g : null;
  };
  JB.nameOf = (id) => { const j = list.find((q) => q.id === id); return j ? j.name : null; };
  JB.whatOf = (id) => { const j = list.find((q) => q.id === id); return j ? j.what : null; };
  JB.wayTo = wayTo;

  // ── THE PANEL: the board big on the screen ──────────────────────────────────────────────────────────────────────
  ensureCss();
  JB.open = () => {
    if (panel) return false;
    const pos = P() && P().position;
    const body = document.createElement('div'); body.className = 'bjb-grid';
    body.innerHTML = list.map((j) => {
      const g = jobPlace(j.id), d = g && pos ? Math.hypot(g.x - pos.x, g.z - pos.z) : null;
      const far = d == null ? '' : d < 25 ? 'right here' : `${d > 100 ? Math.round(d / 10) * 10 : Math.round(d)} m ${wayTo(pos, g)}`;
      const saddle = needsSaddle(j);
      return `<button type="button" class="bjb-job${picked && picked.id === j.id ? ' is-on' : ''}" data-id="${j.id}" aria-label="${esc(j.name)}">
        <img src="${picURL(j.pic)}" alt="" draggable="false">${saddle ? `<img class="bjb-saddle" src="${picURL('saddle', 64)}" alt="needs a saddle" title="Needs a saddled horse: the stable first">` : ''}
        <b>${esc(j.name)}</b><small>${esc(j.what)}${far ? ` · ${far}` : ''}${saddle ? ' · needs a saddle: the stable first' : ''}</small>${picked && picked.id === j.id ? '<i>Following</i>' : ''}</button>`;
    }).join('');
    body.addEventListener('click', (e) => { const b = e.target.closest('.bjb-job'); if (b) JB.pick(b.dataset.id); });
    onOpen();
    panel = makePanel({ title: 'Jobs board', sub: 'Pick a job, and the golden hoofprints lead the way', body, wide: true,
      onClose: () => { panel = null; onClose(); } });
    panel.el.classList.add('bjb');
    if (speak && rider) try { speak('Jobs board. Tap a picture, and follow the hoofprints.'); } catch (e) { /* (no voice) */ }
    return true;
  };

  // a click or tap on a notice on the board itself, from close by, picks that job (on the header: the board opens)
  const offTarget = I && I.addTarget ? I.addTarget(face, { board: true }) : () => {};
  const _inv = new THREE.Matrix4(), _p = new THREE.Vector3();
  const offPick = I ? I.onPick((p) => {
    if (panel || !p.hit || !p.hit.data || !p.hit.data.board || !P()) return;
    const pos = P().position; if (Math.hypot(pos.x - B.x, pos.z - B.z) > BOARD.click) return;
    _inv.copy(face.matrixWorld).invert(); _p.copy(p.hit.point).applyMatrix4(_inv);
    const u = _p.x / BOARD.w + 0.5, v = (_p.y - BOARD.low) / BOARD.h;
    const n = painted.hits.find((h) => u >= h.u0 && u <= h.u1 && v >= h.v0 && v <= h.v1);
    if (n) JB.pick(n.id); else JB.open();
  }) : () => {};

  // ── EACH FRAME ─────────────────────────────────────────────────────────────────────────────────────────────────
  // the events that mean the rider is at work at a job (riding near one isn't: the farm's sheep are "near" from the
  // square's north side)
  const WORKING = new Set(['catch', 'miss', 'waveDone', 'sheepHealed', 'sheepWrong', 'sheepFine', 'sheepDose', 'flockDone', 'pigPenned', 'pigWrong', 'pigsDone',
    'storeStart', 'storeMiss', 'storeRight', 'storeDone', 'deliveryOrder', 'deliveryWork', 'deliveryMiss', 'deliveryRight', 'deliveryLoaded',
    'banditCatch', 'banditMiss', 'banditsDone', 'gangDone', 'deerSetup', 'deerRight', 'deerWrong', 'lootGuard', 'lootLoaded', 'lootShare', 'lootMiss', 'lootRight']);
  const SITDOWN = new Set(['store', 'delivery', 'deer', 'loot', 'range']);
  JB.heard = (name) => { if (picked && picked.t > 0.5 && WORKING.has(name)) picked = null; };
  JB.update = (dt, pos, { busy = null } = {}) => {
    if (!pos) return;
    JB.prompt = Math.hypot(pos.x - front.x, pos.z - front.z) < BOARD.near && !panel ? 'Read the jobs board' : null;
    if (picked) {
      picked.t += dt;
      const j = list.find((q) => q.id === picked.id), g = j && !needsSaddle(j) ? jobPlace(j.id) : null;
      // at work at a job (a slip or the camera up where the player is): the tracks give way, whichever job it is
      if (busy && SITDOWN.has(busy)) picked = null;
      // at the job picked: its own card and trail take over
      else if (g && (Math.hypot(pos.x - g.x, pos.z - g.z) < BOARD.arrive || (g.hide && Math.hypot(pos.x - g.hide.x, pos.z - g.hide.z) < g.hide.r))) picked = null;
    }
    const night = Number.isFinite(W.night) ? W.night : 0;
    lampMat.emissiveIntensity = 0.15 + 2.2 * night;
  };

  const _s = new THREE.Vector3();
  JB.screenOf = (id) => {
    const h = painted.hits.find((q) => q.id === id); if (!h) return null;
    _s.set(((h.u0 + h.u1) / 2 - 0.5) * BOARD.w, BOARD.low + (h.v0 + h.v1) / 2 * BOARD.h, -0.03).applyMatrix4(face.matrixWorld).project(camera);
    return { x: (_s.x + 1) / 2 * innerWidth, y: (1 - _s.y) / 2 * innerHeight, on: _s.z < 1 && Math.abs(_s.x) < 1 && Math.abs(_s.y) < 1 };
  };
  JB.state = () => ({ picked: picked ? picked.id : null, prompt: JB.prompt, open: !!panel, jobs: list.map((j) => j.id), spot: { x: B.x, z: B.z, rot: +B.rot.toFixed(3) }, front,
    goal: JB.goal() });
  JB.dispose = () => {
    if (panel) { const pn = panel; panel = null; pn.close(); }
    offPick(); offTarget(); offBlock(); unmow();
    root.removeFromParent();
    root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
    for (const m of [wood, roofMat, faceMat, lampMat]) m.dispose();
    tex.dispose();
  };
  return JB;
}

const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
let css = false;
function ensureCss() {
  if (css || typeof document === 'undefined') return; css = true;
  const st = document.createElement('style'); st.dataset.jobsboard = '1';
  st.textContent = `
.bms.bjb .bms-card { width: min(1060px, 100%); }
.bjb-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
.bms .bjb-job { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 6px 9px; border-radius: 10px; cursor: pointer;
  background: #f3e7cb; color: #2b1d12; border: 2px solid rgba(120, 85, 45, 0.45); box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25); font: 500 12.5px/1.25 Bitter, Georgia, serif; text-align: center;
  transition: transform 0.12s, box-shadow 0.12s; }
.bms .bjb-job:hover, .bms .bjb-job:focus-visible { border-color: #b8894a; transform: translateY(-2px); outline: none; box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35); }
.bjb-job img { width: 92px; height: 92px; pointer-events: none; }
.bjb-job .bjb-saddle { position: absolute; top: 6px; right: 6px; width: 32px; height: 32px; }
.bms .bjb-job b { font: 700 17px/1.15 Bitter, Georgia, serif; color: #2b1d12; }
.bms .bjb-job small { color: #5a4630; }
.bms .bjb-job.is-on { border-color: #e2b33c; box-shadow: 0 0 0 3px rgba(226, 179, 60, 0.6), 0 3px 8px rgba(0, 0, 0, 0.25); }
.bjb-job i { position: absolute; top: 6px; left: 6px; font: 700 11px Bitter, Georgia, serif; font-style: normal; background: #e2b33c; color: #2b1d12; padding: 2px 6px; border-radius: 6px; }
@media (max-width: 900px) { .bjb-grid { grid-template-columns: repeat(4, 1fr); } }
@media (max-width: 700px) { .bjb-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 520px) { .bjb-grid { grid-template-columns: 1fr 1fr; gap: 8px; } .bjb-job img { width: 72px; height: 72px; } .bms .bjb-job b { font-size: 15px; } .bms .bjb-job small { font-size: 11.5px; } }
/* a phone on its side (short and wide): five across, small pictures, no line under the name, so every job is in view */
@media (max-height: 500px) and (min-width: 521px) { .bjb-grid { grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .bms .bjb-job { padding: 5px 4px 6px; gap: 1px; } .bjb-job img { width: 50px; height: 50px; } .bms .bjb-job b { font-size: 13.5px; }
  .bms .bjb-job small { display: none; } .bjb-job .bjb-saddle { width: 22px; height: 22px; top: 3px; right: 3px; } .bjb-job i { top: 3px; left: 3px; font-size: 10px; padding: 1px 4px; } }
`;
  document.head.appendChild(st);
}
