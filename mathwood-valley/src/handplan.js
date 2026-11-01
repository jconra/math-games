// THE HANDS' NUMBERS (no three.js: the lab, the game and the tests read the same ones). What the Hands Lab (labs/hands)
// sets and models/people/hands.json keeps: for each player, each clip, each hand:
//   off    [x, y, z]  cm the wrist moves, in the player's own frame (x to his left, y up, z the way he faces). The arm
//                     follows: the shoulder stays, the elbow bends to reach
//   rot    [x, y, z]  degrees the hand turns about its wrist, on the clip's own hold
//   elbow  degrees the elbow swings round the line from shoulder to wrist (the hand staying put)
//   curl   { fingers, thumb }  degrees more (or less: negative) each finger bends, shared along its joints
// A clip or a hand with nothing set is left as the clip has it.
export const PLAYERS = {
  fiddler: { name: 'The fiddler', clips: ['Play_Fiddle', 'Fiddle_Rest', 'Fiddle_Up', 'Fiddle_Down'], hands: { L: 'Fret hand (left)', R: 'Bow arm (right)' }, keep: { L: 'fiddle' } },
  banjo: { name: 'The banjo player', clips: ['Play_Banjo', 'Banjo_Rest'], hands: { L: 'Fret hand (left)', R: 'Picking hand (right)' } },
  harpist: { name: 'The harmonica player', clips: ['Play_Harmonica', 'Harmonica_Rest'], hands: { L: 'Left hand', R: 'Right hand' } },
};
// how far an elbow bends (degrees from straight) before the low-poly arm folds in on itself and shows its inside. Past
// warn the lab says so
export const ELBOW = { warn: 128, worst: 140 };
export const emptyHand = () => ({ off: [0, 0, 0], rot: [0, 0, 0], elbow: 0, curl: { fingers: 0, thumb: 0 } });
const num = (v, lo, hi) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : 0; };
export function cleanHand(h) {
  const o = h && typeof h === 'object' ? h : {};
  const trip = (a, m) => [0, 1, 2].map((i) => num(Array.isArray(a) ? a[i] : 0, -m, m));
  return { off: trip(o.off, 30), rot: trip(o.rot, 180), elbow: num(o.elbow, -180, 180), curl: { fingers: num(o.curl && o.curl.fingers, -60, 90), thumb: num(o.curl && o.curl.thumb, -60, 90) } };
}
export const isEmpty = (h) => !h || (h.off.every((v) => !v) && h.rot.every((v) => !v) && !h.elbow && !h.curl.fingers && !h.curl.thumb);
// a file read or about to be saved: the known players, clips and hands only, numbers in range, nothing kept that does nothing
export function cleanHands(d) {
  const out = { v: 1, players: {} }, P = d && d.players && typeof d.players === 'object' ? d.players : {};
  for (const [who, def] of Object.entries(PLAYERS)) {
    const pl = {}; for (const clip of def.clips) {
      const c = P[who] && P[who][clip]; if (!c) continue;
      const e = {}; for (const side of ['L', 'R']) { const h = cleanHand(c[side]); if (!isEmpty(h)) e[side] = h; }
      if (Object.keys(e).length) pl[clip] = e;
    }
    if (Object.keys(pl).length) out.players[who] = pl;
  }
  return out;
}
// the file's text: one line a hand, so it reads and diffs cleanly
export function handsText(d) {
  const c = cleanHands(d), lines = ['{ "v": 1, "players": {'], who = Object.keys(c.players);
  who.forEach((w, i) => {
    lines.push(`  ${JSON.stringify(w)}: {`);
    const clips = Object.keys(c.players[w]);
    clips.forEach((cl, j) => {
      lines.push(`    ${JSON.stringify(cl)}: {`);
      const sides = Object.keys(c.players[w][cl]);
      sides.forEach((s, k) => lines.push(`      ${JSON.stringify(s)}: ${JSON.stringify(c.players[w][cl][s])}${k < sides.length - 1 ? ',' : ''}`));
      lines.push(`    }${j < clips.length - 1 ? ',' : ''}`);
    });
    lines.push(`  }${i < who.length - 1 ? ',' : ''}`);
  });
  lines.push('} }');
  return lines.join('\n') + '\n';
}
