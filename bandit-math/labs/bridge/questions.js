// THE MATH, for the bridge: the windmill lab's geometry ladder (labs/windmill/questions.js, imported as it is: name the
// angle, kinds of triangles, the missing angle, crossing boards, the third corner, right triangles, a mix) with one more
// step at the top, the bridge's own: a truss panel's diagonal. A panel is the square between two posts and the boards
// above and below them; the diagonal nailed across it corner to corner is the long side of a right triangle, so on a
// panel 8 feet long and 6 feet tall it is 10 feet (6×6 + 8×8 = 100 = 10×10). Every question is one to do in your head:
// whole numbers or a simple half, sides from whole-number right triangles.
//
// The ladder is the bridge's own (eight steps, kept under its own key), but a player who has climbed the windmill's
// starts the bridge where they had got to there.
import { TOPICS as WT, ladderQuestion as windmillLadder, questionOf as windmillQuestion, topicOf as windmillTopic, questionDue, BONUS_MAX, earnsBoard,
  trianglesOf, makeQuestion, bayQuestion, reachQuestion, readLadder as readWindmill, LADDER_KEY as WINDMILL_KEY } from '../windmill/questions.js';
import { lenWords, lenLabel } from './bridge.js';

export { questionDue, BONUS_MAX, earnsBoard, trianglesOf, makeQuestion, bayQuestion, reachQuestion, WINDMILL_KEY };
export const LADDER_TOP = 8;
export const LADDER_KEY = 'bandit-math.bridge.ladder';
export const freshLadder = () => ({ level: 1, streak: 0 });
// the ladder after an answer: two right in a row climb a step, a wrong one drops a step (the windmill's rule, 8 steps)
export function stepLadder(s, right) {
  const level = Math.min(LADDER_TOP, Math.max(1, Math.round(+s?.level || 1)));
  if (!right) return { level: Math.max(1, level - 1), streak: 0 };
  const streak = (s?.streak || 0) + 1;
  return streak >= 2 && level < LADDER_TOP ? { level: level + 1, streak: 0 } : { level, streak: streak >= 2 ? 0 : streak };
}
// a saved ladder read back safely; with none saved yet, the windmill's step (if there is one)
export function readLadder(text, windmillText = null) {
  try { const s = JSON.parse(text); const l = Math.round(+s.level); if (l >= 1 && l <= LADDER_TOP) return { level: l, streak: Math.max(0, Math.min(1, Math.round(+s.streak || 0))) }; } catch (e) { /* none */ }
  if (windmillText) { const w = readWindmill(windmillText); return { level: w.level, streak: 0 }; }
  return freshLadder();
}

// ── the bridge's own step: a panel's diagonal ───────────────────────────────────────────────────────────────────────
// panels from whole-number right triangles (and one with halves), never longer than a board can reach... or longer, and
// then the answer says so: a 10 ft diagonal needs two boards lapped
const PANELS = [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [4.5, 6, 7.5], [6, 4.5, 7.5], [1.5, 2, 2.5]];
const shuffle = (arr, rnd) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const num = (v) => { const f = Math.floor(v + 1e-9); return v - f > 0.25 ? (f || '') + '½' : String(f); };
const sq = (v) => { const r = v * v; return Number.isInteger(r) ? String(r) : String(Math.round(r * 100) / 100); };
const INK = '#2b2219', WOOD = '#8a5a32', RED = '#b0401f', FONT = 'font-family="Bitter, Georgia, serif" font-weight="700"';
// a truss panel drawn: two posts, the top and bottom boards, the diagonal; labels on its length and height, ? on what
// is asked. h: height, w: length (feet), ask: 'diag' | 'h' | 'w'
function panelSvg(w, h, ask, answer = null) {
  const s = Math.min(220 / w, 120 / h), W = w * s, H = h * s, x0 = (320 - W) / 2, y1 = 160, y0 = y1 - H;
  const bd = (a, b, c, d, col = WOOD, wd = 9) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${col}" stroke-width="${wd}" stroke-linecap="round"/>`;
  let o = '<svg class="pic" viewBox="0 0 320 186">';
  o += bd(x0 - 18, y1, x0 + W + 18, y1) + bd(x0 - 18, y0, x0 + W + 18, y0) + bd(x0, y0, x0, y1) + bd(x0 + W, y0, x0 + W, y1) + bd(x0, y1, x0 + W, y0, '#a36a3a', 8);
  o += `<path d="M${x0 + W - 14} ${y1} v-14 h14" fill="none" stroke="${INK}" stroke-width="2"/>`;
  const lab = (x, y, t, col = INK, size = 17) => `<text x="${x}" y="${y}" text-anchor="middle" ${FONT} font-size="${size}" fill="${col}">${t}</text>`;
  const show = (v) => lenLabel(v);
  o += lab(x0 + W / 2, y1 + 22, ask === 'w' ? (answer !== null ? show(answer) : '?') : show(w), ask === 'w' && answer === null ? RED : INK);
  o += lab(x0 + W + 34, (y0 + y1) / 2 + 6, ask === 'h' ? (answer !== null ? show(answer) : '?') : show(h), ask === 'h' && answer === null ? RED : INK);
  o += lab(x0 + W / 2 - 18, (y0 + y1) / 2 - 8, ask === 'diag' ? (answer !== null ? show(answer) : '?') : show(Math.hypot(w, h)), ask === 'diag' && answer === null ? RED : '#6d4b2b');
  return o + '</svg>';
}
// the squares helper (half feet allowed): the sum written out
function squaresSvg(a, b, c) {
  return `<svg class="pic" viewBox="0 0 320 96"><text x="160" y="34" text-anchor="middle" ${FONT} font-size="18" fill="${INK}">${num(a)}×${num(a)} + ${num(b)}×${num(b)} = ${sq(a)} + ${sq(b)} = ${sq(c)}</text>
    <text x="160" y="70" text-anchor="middle" ${FONT} font-size="18" fill="${INK}">${num(c)}×${num(c)} = ${sq(c)}</text></svg>`;
}
export function panelQ(rnd = Math.random, sub = null) {
  const [h, w, d] = PANELS[Math.floor(rnd() * PANELS.length) % PANELS.length];
  const ask = sub || (rnd() < 0.65 ? 'diag' : 'h');
  const answer = ask === 'diag' ? d : ask === 'h' ? h : w;
  const on = (v) => Math.round(v * 2) / 2;
  const wrong = ask === 'diag' ? [h + w, d + 1, d - 1, on(Math.max(h, w) + 1), on((h + w) / 2 + 1)] : [d - w, d + 1, answer + 1, answer - 1, on(d / 2)];
  const choices = shuffle([answer, ...shuffle([...new Set(wrong.map(on).filter((v) => v > 0 && Math.abs(v - answer) > 1e-6))], rnd).slice(0, 3)], rnd);
  const long = d > 8 + 1e-6 ? ` That's longer than an 8 foot board: two boards lapped and nailed would reach.` : '';
  const prompt = ask === 'diag'
    ? `A panel of your bridge is ${lenWords(w)} long and ${lenWords(h)} tall. How long a diagonal reaches from corner to corner?`
    : `A diagonal ${lenWords(d)} long reaches across a panel ${lenWords(w)} long. How tall is the panel?`;
  const why = ask === 'diag'
    ? `Square the two sides and add: ${num(h)}×${num(h)} + ${num(w)}×${num(w)} = ${sq(h)} + ${sq(w)} = ${sq(d)}, and ${num(d)}×${num(d)} = ${sq(d)}. So the diagonal is ${lenWords(d)} long.${long}`
    : `The diagonal squared, take away the length squared: ${num(d)}×${num(d)} − ${num(w)}×${num(w)} = ${sq(d)} − ${sq(w)} = ${sq(h)}, and ${num(h)}×${num(h)} = ${sq(h)}. So the panel is ${lenWords(h)} tall.`;
  const steps = ask === 'diag'
    ? [`The diagonal is the long side of a right triangle: the panel's corner is square.`, `${num(h)}×${num(h)} = ${sq(h)} and ${num(w)}×${num(w)} = ${sq(w)}.`, `${sq(h)} + ${sq(w)} = ${sq(d)}.`, `${num(d)}×${num(d)} = ${sq(d)}, so the diagonal is ${lenWords(d)}.`]
    : [`The diagonal is the long side of a right triangle.`, `${num(d)}×${num(d)} = ${sq(d)} and ${num(w)}×${num(w)} = ${sq(w)}.`, `${sq(d)} − ${sq(w)} = ${sq(h)}.`, `${num(h)}×${num(h)} = ${sq(h)}, so the panel is ${lenWords(h)} tall.`];
  return {
    kind: 'panel', title: ask === 'diag' ? 'How long a diagonal?' : 'How tall a panel?', svg: panelSvg(w, h, ask), geo: { w, h, d, ask },
    prompt, choices, labels: choices.map((v) => lenLabel(v)), answer, unit: '', why,
    helper: { kind: 'svg', svg: squaresSvg(h, w, d) },
    lessonPic: panelSvg(w, h, ask, answer) + squaresSvg(h, w, d),
    topic: 'panel', rule: 'A panel\'s corner is square, so its diagonal is the long side of a right triangle: square the two short sides, add them, and the diagonal is the number that squares to that.', steps,
  };
}

// every topic: the windmill's, and the panel at step 8
export const TOPICS = { ...WT, panel: [8, (r) => panelQ(r)] };
// a question for a step (the top step: the bridge's panel half the time, else the windmill's mix)
export function ladderQuestion(level, rnd = Math.random) {
  level = Math.min(LADDER_TOP, Math.max(1, Math.round(level) || 1));
  if (level === LADDER_TOP) return rnd() < 0.5 ? { ...panelQ(rnd), level, from: 8 } : { ...windmillLadder(7, rnd), level };
  return { ...windmillLadder(level, rnd), level };
}
export function questionOf(topic, level, rnd = Math.random) {
  if (topic === 'panel') return { ...panelQ(rnd), level, from: 8 };
  return windmillQuestion(topic, level, rnd);
}
export const topicOf = (q) => (q.kind === 'panel' ? 'panel' : windmillTopic(q));
