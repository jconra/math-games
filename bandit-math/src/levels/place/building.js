// The windmill and the bridge: GEOMETRY, as built (the agreed design, 2026-10-21). The miller and the bridge
// engineer stop the building now and then with a question card about the boards: kinds of angles and triangles, the
// missing angle, crossing boards, the third corner, right triangles, a bridge panel's diagonal. One ladder for both
// jobs (a rider who built the windmill starts the bridge where they were); the windmill asks up to level 7 (levelFor's
// `most: 'g7'`), the bridge all 8.
//
// gen: { level } (labs/windmill/questions.js ladderQuestion for 1-7, labs/bridge/questions.js for 8)

import { ladderQuestion as windmillQ } from '../../../labs/windmill/questions.js';
import { panelQ } from '../../../labs/bridge/questions.js';

const G = (n, title, line, grade) => ({ id: `g${n}`, title, line, grade, strand: 'geo', count: 5, gen: { level: n } });

export const PLACE = {
  id: 'building', name: 'The windmill and the bridge', short: 'Building', math: 'Geometry', pic: 'windmill', job: ['windmill', 'bridge'], fastFrom: null,
  line: 'Answer the builder’s questions about the boards: angles, triangles, lengths.',
  levels: [
    G(1, 'Kinds of angles', 'Acute, right, obtuse or straight?', 40),
    G(2, 'Kinds of triangles', 'By their corners or by their sides', 46),
    G(3, 'The missing angle', 'A brace in a square corner: 90 − 30', 58),
    G(4, 'Crossing boards', 'Equal angles, and angles that make 180', 72),
    G(5, 'The third corner', 'Two corners are 65° and 75°: the third?', 78),
    G(6, 'Right triangles', 'Short sides 5 and 12 feet: the long side?', 86),
    G(7, 'All of it', 'A mix of levels 2 to 6', 92),
    G(8, 'A bridge panel’s diagonal', 'A panel 6 feet long and 4½ feet tall (the bridge only)', 94),
  ],
  example: (L, rand) => {
    const q = L.gen.level >= 8 ? panelQ(rand) : windmillQ(L.gen.level, rand);   // (level 8 shows its own panel question; the bridge mixes in the windmill's)
    // (the card shows a picture; the levels page has words only, so a question that needs the picture says what it shows)
    const g = q.geo || {}, and3 = (a) => `${a[0]}, ${a[1]} and ${a[2]}`;
    const seen = q.kind === 'name-angle' && g.deg ? ` (The boards meet at ${g.deg}°.)`
      : q.kind === 'tri-sides' && Array.isArray(g.sides) ? ` (Its sides: ${and3(g.sides)} feet.)`
      : q.kind === 'tri-corners' && Array.isArray(g.ang) ? ` (Its corners: ${and3(g.ang.map((x) => `${x}°`))}.)` : '';
    if (seen) q.prompt += seen;
    // (a question with its own labels shows the label: lengths in feet and inches; else the number and its unit)
    if (Array.isArray(q.labels) && q.choices) return { q: q.prompt, a: String(q.labels[q.choices.indexOf(q.answer)]) };
    const unit = String(q.unit || '').trim() || (typeof q.answer === 'number' && q.kind === 'panel' ? 'ft' : '');
    return { q: q.prompt, a: `${q.answer}${unit === '°' ? '°' : unit ? ` ${unit}` : ''}` };
  },
};
