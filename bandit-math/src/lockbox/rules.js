// "You've reached algebra!" and "The rules": the card that shows a kid the rules of solving with moves.
//
// Below x on both sides a lock box is opened by finding x (tap the key that makes both sides the same). The first box
// past that (the levels' ladder: src/lockbox/levelplan.js ALGEBRA_FROM) opens with this card once per rider, as "You've
// reached algebra!": guessing gets hard once x is on both sides, so here are the rules that always work, one worked
// example, and the steps in order. From then on a "The rules" button on every box worked with moves opens the same
// card, without the cheer. The panel (panel.js) draws it over the box; nothing here touches the page.
//
//   rulesHTML({ first, steps, flip }) -> the card's inside, as HTML (first: the cheer and why; steps: the steps card's
//                                        rows [{ n, label }]; flip: add the inequalities' flip rule)
//   ALGEBRA_TITLE, RULES_TITLE, GO_WORD (the button), EXAMPLE (the worked example, line by line)

import { GOLDEN_RULE, STEPS } from './steps.js';
import { MINUS, TIMES } from './engine.js';

export const ALGEBRA_TITLE = 'You’ve reached algebra!';
export const RULES_TITLE = 'The rules';
export const GO_WORD = { first: 'Let’s go', again: 'Back to the box' };

// x + 5 = 2x + 1, solved with two moves and checked
export const EXAMPLE = [
  { line: 'x + 5 = 2x + 1', move: '' },
  { line: '5 = x + 1', move: `${MINUS}x on both sides` },
  { line: '4 = x', move: `${MINUS}1 on both sides` },
];
export const EXAMPLE_CHECK = `Check: 4 + 5 = 9, and 2 ${TIMES} 4 + 1 = 9. The same!`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// a lone x is the letter x (italic serif), as on the box
const xs = (s) => esc(s).replace(/(^|[^A-Za-z])x(?![A-Za-z])/g, '$1<i class="x">x</i>').replace(/(\d)x\b/g, '$1<i class="x">x</i>');

export function rulesHTML({ first = false, steps = STEPS, flip = null } = {}) {
  const lead = first
    ? `<p class="rl-lead">Now <i class="x">x</i> is on <b>both sides</b>. Guessing gets hard, so algebra has rules that always work.</p>`
    : '';
  const ex = EXAMPLE.map((e) => `<li><span class="rl-move">${e.move ? xs(e.move) : ''}</span><span class="rl-line">${xs(e.line)}</span></li>`).join('');
  return `${lead}
    <p class="rl-gold">${esc(GOLDEN_RULE)}</p>
    <p class="rl-p">A move (like ${xs(`${MINUS}x`)}, +4 or ÷3) happens to <b>both sides at once</b>, so they stay the same.</p>
    ${flip ? `<p class="rl-p rl-flip">${esc(flip)}</p>` : ''}
    <div class="rl-ex"><div class="rl-h">For example</div><ol class="rl-exl">${ex}</ol><p class="rl-check">${esc(EXAMPLE_CHECK)}</p></div>
    <div class="rl-steps"><div class="rl-h">The steps, in order</div>
      <ol class="rl-stl">${steps.map((s) => `<li><b>${s.n}</b>${xs(s.label)}</li>`).join('')}</ol>
      <p class="rl-small">Skip a step the box doesn’t need. The step you’re on is written big over the box.</p></div>`;
}
