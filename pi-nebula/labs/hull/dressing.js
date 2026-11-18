// THE SAMPLE'S SET DRESSING (the lab's own, not the hull's look): something to see through the door's shield, and two
// things to judge size by.
//   inside()    the hangar behind the door as a plain lit box: a floor, walls, a roof with three light strips
//   markers()   a person 1.8 m tall standing on the door's sill, and a ship-sized block 17 m long parked in the hangar
//   stationMarkers()   for the whole station: a person 1.8 m tall beside each door to a landing pad and one in the
//               middle of each pad (the roof's two and the dock side's two), and a ship-sized block 17 m long on the
//               roof's south pad
import * as THREE from 'three';
import { DOOR } from './sample-plan.js';
import { PADS, PAD_DOORS, SHELL_PADS, SHELL_DOORS } from '../../kit/outside-plan.js';

const flat = (c) => new THREE.MeshBasicMaterial({ color: c });
const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };

export function inside() {
  const g = new THREE.Group(); g.name = 'inside';
  const y0 = DOOR.sill, y1 = DOOR.sill + DOOR.h + 0.6, hw = DOOR.w / 2 + 2, deep = 15.4;
  const quad = (w, h, mat, pos, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(...pos); m.rotation.set(...rot); g.add(m); return m; };
  quad(deep, hw * 2, flat(0x353a41), [-deep / 2, y0, 0], [-Math.PI / 2, 0, 0]);                 // the floor
  quad(deep, hw * 2, flat(0x14171b), [-deep / 2, y1, 0], [Math.PI / 2, 0, 0]);                  // the roof
  quad(hw * 2, y1 - y0, flat(0x23272d), [-deep, (y0 + y1) / 2, 0], [0, Math.PI / 2, 0]);        // the back wall
  quad(deep, y1 - y0, flat(0x1c2025), [-deep / 2, (y0 + y1) / 2, -hw], [0, 0, 0]);              // the side walls
  quad(deep, y1 - y0, flat(0x1c2025), [-deep / 2, (y0 + y1) / 2, hw], [0, Math.PI, 0]);
  const strip = flat(0xdfeeff), band = flat(0x4a5059), line = flat(0xc9a032);
  for (const z of [-7, 0, 7]) g.add(box(deep - 3, 0.12, 0.5, strip, -deep / 2, y1 - 0.08, z));  // light strips along the roof
  g.add(box(0.1, 1.6, hw * 2 - 1.2, band, -deep + 0.06, y0 + 4.2, 0));                          // a pale band across the back wall
  for (const z of [-9.4, 9.4]) g.add(box(deep - 1.5, 0.02, 0.22, line, -deep / 2, y0 + 0.012, z)); // the pad's yellow lines
  return g;
}

// a person, 1.8 m: legs, body, head, in a bright orange that reads against any hull
function person() {
  const suit = flat(0xff7a1a), skin = flat(0xf1c9a0), p = new THREE.Group();
  p.add(box(0.34, 0.86, 0.22, suit, 0, 0.43, 0), box(0.46, 0.62, 0.26, suit, 0, 1.17, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), skin); head.position.set(0, 1.67, 0); p.add(head);
  p.name = 'person'; return p;
}
export function stationMarkers() {
  const g = new THREE.Group(); g.name = 'station markers';
  for (const d of [...PAD_DOORS, ...SHELL_DOORS]) { const p = person(); p.position.set(d.x + 2.3, d.y + 0.32, d.z + d.out * 0.9); g.add(p); }
  for (const pad of [...PADS, ...SHELL_PADS]) { const p = person(); p.position.set(pad.at[0], pad.y + pad.tall, pad.at[1]); g.add(p); }
  const ship = new THREE.Group(), pad = PADS[0], y = pad.y;
  ship.add(box(6.4, 3, 17, flat(0x7d8690), 0, 1.5, 0), box(4.6, 1.1, 5, flat(0x545c66), 0, 3.55, -4.6), box(6.5, 0.5, 17.1, flat(0xdc7526), 0, 1.1, 0));
  ship.rotation.y = Math.PI / 2; ship.position.set(pad.at[0] + 1.5, y + pad.tall, pad.at[1] + 2.5); ship.name = 'ship'; g.add(ship);
  return g;
}
export function markers() {
  const g = new THREE.Group(); g.name = 'markers';
  const p = person(); p.position.set(0.3, DOOR.sill, -8.2); g.add(p);
  // a ship-sized block, 17 m long, parked across the hangar behind the shield (so it is never between the camera and
  // the plates): a plain body, a darker cabin at one end, an orange stripe
  const ship = new THREE.Group();
  ship.add(box(6.4, 3, 17, flat(0x7d8690), 0, 1.5, 0), box(4.6, 1.1, 5, flat(0x545c66), 0, 3.55, -4.6), box(6.5, 0.5, 17.1, flat(0xdc7526), 0, 1.1, 0));
  ship.position.set(-7.6, DOOR.sill, 1.5); ship.name = 'ship'; g.add(ship);
  return g;
}
