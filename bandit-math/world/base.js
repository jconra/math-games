// THE GAME'S OWN ADDRESS: the bandit-math folder (this file's folder's parent), wherever the game is served from
// (http://127.0.0.1:8997/bandit-math/ or math-games.jconra.com/bandit-math/). Every model, picture and data file the world
// loads is found from here, next to the game, never from the site's root.
export const BASE = new URL('../', import.meta.url).href;
