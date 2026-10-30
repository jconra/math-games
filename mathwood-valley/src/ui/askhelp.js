// askhelp.js: THE HELP RULE. The game's maker (2026-10-29): a helper is always one click away and never pops up
// uninvited. A job that sees the rider stuck (a while with no pick) or just wrong asks for a nudge here instead of
// opening its picture: every Help button on the page glows (the tools strip's, src/ui/tools.js, and a job's own button
// marked data-askhelp: the range's, the deer camera's); nothing opens until the rider presses one, and what opens is
// the help for the question the rider is on (the ringed sheep, the nearest pig, the card up).
//
//   nudgeHelp(on = true)   light (or put out) every Help button on the page; cheap, safe in node (no document)
//   HELP_KEY               the keyboard key for Help ('KeyQ'), and HELP_KEY_LABEL ('Q') shown in a tab under the button

export const HELP_KEY = 'KeyQ';
export const HELP_KEY_LABEL = 'Q';

export function nudgeHelp(on = true) {
  if (typeof document === 'undefined') return;
  for (const b of document.querySelectorAll('[data-askhelp]')) b.classList.toggle('is-glow', !!on);
}
