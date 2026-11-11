// Shows every look a new crew member picks from (src/looks.js), drawn the way the game's title draws them: by the
// game's own portraits.js from the crew kit. Nothing here is a copy: change a look, a head or the studio there and
// this page shows it.
//
// A rig (~/pw/space-math/rigs/game/looks.cjs) calls
//   await LOOKS_TOOL.shoot(idOrRecipe, 'face' | 'body', pose)   -> a webp picture as a data: address
// to make a sheet of them, or to try a recipe or a stance (pose: { clip, at }).   ?only=kai,mira draws just those here.
import { loadCrew } from '../../kit/crew.js';
import { LOOKS } from '../looks.js';
import { shoot as shootWith, SIZES } from '../portraits.js';

const q = new URLSearchParams(location.search);
const lib = await loadCrew();
const shoot = (what, kind = 'face', pose = null) => shootWith(lib, what, kind, pose);
const TOOL = window.LOOKS_TOOL = { ready: true, shoot, looks: LOOKS.map((l) => l.id), sizes: SIZES, lib };

// shown to a person: every look, face and body
const grid = document.getElementById('grid'), note = document.getElementById('note');
const only = (q.get('only') || '').split(',').filter(Boolean);
if (!q.has('rig')) {
  for (const l of LOOKS) {
    if (only.length && !only.includes(l.id)) continue;
    const fig = document.createElement('figure');
    for (const kind of ['face', 'body']) {
      const img = new Image(); img.className = kind; img.alt = `${l.name} (${kind})`; img.src = await shoot(l.id, kind);
      img.width = SIZES[kind][0] / 2; fig.appendChild(img);
    }
    const cap = document.createElement('figcaption');
    const b = document.createElement('b'); b.textContent = l.id; cap.appendChild(b); cap.appendChild(document.createTextNode(l.name));
    fig.appendChild(cap); grid.appendChild(fig);
  }
}
note.textContent = '';
TOOL.shown = true;
