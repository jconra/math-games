// A TEACH CARD: a small lesson shown on a card, for any question in the game that has one.
// A lesson is { title, rule, picture, example, steps, answer }:
//   rule     the idea in one plain sentence ("The three corners of any triangle add up to 180°.")
//   picture  an SVG string (the worked example, its answer filled in)
//   example  the example's question in words; steps: its answer worked out, one short sentence a step
//   answer   (optional) the example's answer said as it would be on a button
// The steps come in one after another (CSS: .teach .step, delayed by --i), then "Try it" asks a fresh question of the
// same kind and "Back" closes the card. Pure DOM, no game state: the caller decides what "Try it" asks.
// It lives in the windmill lab for now; nothing in it is about windmills.
export function teachHTML(lesson) {
  const esc = (s) => String(s);
  return `<h2>${esc(lesson.title || 'How it works')}</h2>
    <p class="rule">${esc(lesson.rule)}</p>
    ${lesson.picture || ''}
    ${lesson.example ? `<p class="example"><b>For example:</b> ${esc(lesson.example)}</p>` : ''}
    <ol class="steps-list">${lesson.steps.map((s, i) => `<li class="step" style="--i:${i}">${esc(s)}</li>`).join('')}</ol>
    ${lesson.answer !== undefined ? `<p class="step answer" style="--i:${lesson.steps.length}">Answer: <b>${esc(lesson.answer)}</b></p>` : ''}
    <div class="row"><button class="btn" data-teach="back">Back to building</button><button class="btn go" data-teach="try">Try it</button></div>`;
}
// show a lesson on `card` (an element); onTry / onBack are called by its buttons
export function showTeach(card, lesson, { onTry, onBack }) {
  card.classList.add('teach');
  card.innerHTML = teachHTML(lesson);
  card.hidden = false; card.scrollTop = 0;
  card.querySelector('[data-teach="try"]').onclick = () => { card.classList.remove('teach'); onTry(); };
  card.querySelector('[data-teach="back"]').onclick = () => { card.classList.remove('teach'); onBack(); };
}
