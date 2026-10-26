// THE GAME'S OWN ADDRESS: the mathwood-valley folder (this file's folder's parent), wherever the game is served from
// (http://127.0.0.1:8997/mathwood-valley/ or math-games.jconra.com/mathwood-valley/). Every model, picture and data file the world
// loads is found from here, next to the game, never from the site's root.
export const BASE = new URL('../', import.meta.url).href;
