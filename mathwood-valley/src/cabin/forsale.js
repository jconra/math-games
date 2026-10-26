// THE "FOR SALE" SIGN in front of the cabin until a rider buys it: a painted board on a post, hung from a little arm by
// two short chains (it sways a touch in the breeze), saying FOR SALE and the price. Bought: a red SOLD board is nailed
// across it (it drops in and settles), and the sign is taken away once the cabin is out of sight (cabin.js), so nothing
// vanishes in front of the player. Made in code: a post, an arm, the board (its picture drawn on a canvas), no download.
//
//   const S = makeSaleSign({ price })   a THREE.Group standing on y = 0, its board facing +z
//   S.sold()          the SOLD board goes up (a short drop; S.isSold is true)
//   S.update(dt, t)   the sway and the drop
//   S.dispose()
import * as THREE from 'three';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; };
// a painted board: weathered planks, the words in a western face, a nail at each corner
function boardPicture(lines, { bg = '#d8c49a', ink = '#3a2412', w = 512, h = 256 } = {}) {
  return canvasTex(w, h, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    // the planks' grain and the gaps between them
    for (let i = 0; i < 4; i++) {
      x.fillStyle = `rgba(90, 60, 30, ${0.06 + (i % 2) * 0.05})`; x.fillRect(0, i * h / 4, w, h / 4);
      x.fillStyle = 'rgba(60, 38, 18, 0.45)'; x.fillRect(0, i * h / 4, w, 3);
      x.strokeStyle = 'rgba(80, 52, 26, 0.2)'; x.lineWidth = 1.5;
      for (let k = 0; k < 5; k++) { const y = i * h / 4 + 8 + k * 11; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + 3, w * 0.6, y - 3, w, y + 1); x.stroke(); }
    }
    x.strokeStyle = ink; x.lineWidth = 7; x.strokeRect(14, 14, w - 28, h - 28);
    x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach(([text, size, y]) => { x.font = `bold ${size}px Georgia, 'Times New Roman', serif`; x.fillText(text, w / 2, y); });
    x.fillStyle = '#2a2420'; for (const [cx, cy] of [[30, 30], [w - 30, 30], [30, h - 30], [w - 30, h - 30]]) { x.beginPath(); x.arc(cx, cy, 5, 0, Math.PI * 2); x.fill(); }
  });
}

export function makeSaleSign({ price = 600 } = {}) {
  const grp = new THREE.Group(); grp.name = 'for-sale-sign';
  const wood = std(0x5a3d24), dark = std(0x2f2620, { roughness: 0.5, metalness: 0.5 });
  const pics = [];
  // the post and its arm
  grp.add(mesh(new THREE.BoxGeometry(0.12, 2.1, 0.12), wood, 0, 1.05, 0));
  grp.add(mesh(new THREE.BoxGeometry(0.95, 0.09, 0.09), wood, 0.42, 1.98, 0));
  grp.add(mesh(new THREE.BoxGeometry(0.06, 0.38, 0.06).rotateZ(-Math.PI / 4), wood, 0.13, 1.84, 0));   // (the brace)
  // the board, hung from the arm by two chains (short dark rods), swaying about the arm
  const hang = new THREE.Group(); hang.position.set(0.47, 1.94, 0); grp.add(hang);
  for (const x of [-0.3, 0.3]) hang.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 5), dark, x, -0.08, 0));
  const front = boardPicture([['FOR SALE', 74, 96], [`${price} GOLD`, 52, 178]]);
  pics.push(front);
  const faces = [wood, wood, wood, wood, std(0xffffff, { map: front }), std(0xffffff, { map: front })];
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.41, 0.035), faces); board.castShadow = board.receiveShadow = true;
  board.position.set(0, -0.37, 0); hang.add(board);
  // the SOLD board, nailed across once the cabin is bought (hidden till then)
  const soldPic = boardPicture([['SOLD', 82, 64]], { bg: '#a8322a', ink: '#f4e3c0', w: 384, h: 128 }); pics.push(soldPic);
  const soldM = std(0xffffff, { map: soldPic });
  const sold = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.02), [soldM, soldM, soldM, soldM, soldM, soldM]);
  sold.castShadow = true; sold.visible = false; sold.rotation.z = 0.16; hang.add(sold);
  let t0 = Math.random() * 10, drop = -1;
  const S = {
    group: grp, isSold: false,
    sold() { if (S.isSold) return; S.isSold = true; sold.visible = true; drop = 0; },
    update(dt, t = 0) {
      t0 += dt;
      hang.rotation.x = 0.05 * Math.sin(t0 * 1.3) + 0.02 * Math.sin(t0 * 3.1);   // (a little sway on its chains)
      if (drop >= 0) {   // (the SOLD board drops into place and settles with a small bounce)
        drop = Math.min(1, drop + dt / 0.45); const k = drop, b = 1 - Math.pow(1 - k, 3);
        sold.position.set(0, -0.37 + 0.35 * (1 - b) - 0.03 * Math.sin(k * Math.PI), 0.03);
        if (drop >= 1) drop = -2;
      } else if (drop === -1) sold.position.set(0, -0.37, 0.03);
    },
    dispose() {
      const mats = new Set(), geos = new Set();
      grp.traverse((o) => { if (o.geometry) geos.add(o.geometry); if (o.material) for (const m of [].concat(o.material)) mats.add(m); });
      for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const p of pics) p.dispose();
      grp.removeFromParent();
    },
  };
  return S;
}
