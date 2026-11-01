// THE LIBRARY'S LIGHTS: a lantern hanging by a chain (the kit's own lantern, parts.js, the buildings' lanterns). Its hook's
// height is the prop's spot; the lantern hangs o.drop below it.
import { lantern } from '../../../labs/buildings/parts.js';

export const LIGHTS = {
  hangingLantern(k, M, o) {
    const drop = o.drop ?? 0.25, v = M.elements;
    if (!k.parts.glow) k.parts.glow = [];
    lantern(k, v[12], v[13] - drop - 0.23, v[14], { chain: drop });
  },
};
