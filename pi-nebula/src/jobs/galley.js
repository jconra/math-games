// THE GALLEY KITCHEN, at the serving counter in the terminal: kitchen math. Counting what's on the trays for the
// youngest, then trays and bowls (equal groups), sharing out, whole crates, recipes made bigger ("this stew serves 4,
// we need 10"), ratio tables, a drink mixed 3 parts to 1, proportions, and at the top a recipe scaled by a fraction
// of a cup. The questions are Mathwood Valley's question makers (engine.js), told in the galley through SETTING; the
// fraction-of-a-cup recipe is this job's own maker (cups, below), as Mathwood has none.
// The scene: a recipe card on the panel (the order's story as a card from the galley's screen); the counter, the
// drinks machine and the cook behind it are the station's own (kit/rooms/station.json: counter serve, dispenser drinks).
import { frac, fracText, gcd } from '../../../mathwood-valley/src/levels/kit.js';
import { ownOrder } from './engine.js';

const u = (n, unit) => `${n} ${n === 1 ? unit[0] : unit[1]}`;

// who brings the order: the station's people (she: true for "she"; Mathwood's FOLK shape)
const FOLK = [
  { name: 'Cook Tamsin', she: true }, { name: 'Cook Raffi', she: false }, { name: 'Ensign Moss', she: false }, { name: 'Pilot Juno', she: true },
  { name: 'Engineer Okafor', she: false }, { name: 'Medic Lin', she: true }, { name: 'Dock Chief Ibarra', she: false }, { name: 'Navigator Sela', she: true },
];

export const SETTING = {
  folk: FOLK,
  // the youngest: things counted on the counter (Mathwood's picture-story shapes: apple, egg, carrot, loaf, can)
  things: [
    { key: 'apples', unit: ['apple', 'apples'], shape: 'apple' },
    { key: 'eggs', unit: ['egg', 'eggs'], shape: 'egg' },
    { key: 'carrots', unit: ['carrot', 'carrots'], shape: 'carrot' },
    { key: 'loaves', unit: ['loaf of bread', 'loaves of bread'], shape: 'loaf', short: ['loaf', 'loaves'] },
    { key: 'cans', unit: ['can of soup', 'cans of soup'], shape: 'can', short: ['can', 'cans'] },
  ],
  kmoreHow: [({ b }) => `The grow pods give ${b} more.`, ({ b }) => `A supply drone brings ${b} more.`, ({ b, p }) => `${p.They} finds ${b} more in the cold store.`],
  kleftHow: [({ b }) => `The night shift used ${b} of them.`, ({ b, p }) => `${p.They} put ${b} in the soup pot.`, ({ b }) => `${b} went to the Medic's crew.`],
  kgroups: ({ g, e, th, f }) => `${f.name} sets out ${g} trays with ${u(e, th.unit)} on each tray.`,
  groups: [
    { key: 'rolls', item: ['tray', 'trays'], unit: ['roll', 'rolls'], story: ({ a, b, f }) => `${f.name} is filling ${a} trays for the night shift, ${b} bread rolls on each tray.`, ask: () => 'How many rolls is that?' },
    { key: 'noodles', item: ['bowl', 'bowls'], unit: ['scoop', 'scoops'], story: ({ a, b }) => `The galley serves ${a} bowls of noodle soup, with ${b} scoops of noodles in every bowl.`, ask: () => 'How many scoops of noodles is that?' },
    { key: 'tomatoes', item: ['grow pod', 'grow pods'], unit: ['tomato', 'tomatoes'], story: ({ a, b }) => `${a} grow pods each gave ${b} tomatoes this week.`, ask: () => 'How many tomatoes is that in all?' },
    { key: 'dumplings', item: ['plate', 'plates'], unit: ['dumpling', 'dumplings'], story: ({ a, b, f }) => `${f.name} orders ${a} plates of dumplings, ${b} dumplings on each plate.`, ask: () => 'How many dumplings should the galley steam?' },
    { key: 'cups', item: ['flask', 'flasks'], unit: ['cup', 'cups'], story: ({ a, b, f }) => `${f.name} is filling ${a} flasks of hot cocoa for a spacewalk crew. Each flask holds ${b} cups.`, ask: () => 'How many cups of cocoa are needed?' },
  ],
  share: [
    { key: 'cookies', thing: ['cookie', 'cookies'], box: ['crew member', 'crew members'], story: ({ total, groups, f }) => `${f.name} baked ${total} star cookies to share evenly among ${groups} crew members.`, ask: 'How many cookies does each one get?' },
    { key: 'rice', thing: ['cup', 'cups'], box: ['bowl', 'bowls'], story: ({ total, groups }) => `There are ${total} cups of fried rice in the pan, to go evenly into ${groups} bowls.`, ask: 'How many cups go in each bowl?' },
    { key: 'berries', thing: ['berry', 'berries'], box: ['pancake', 'pancakes'], story: ({ total, groups, f }) => `${f.name} has ${total} space berries for ${groups} pancakes, the same on every pancake.`, ask: 'How many berries go on each pancake?' },
    { key: 'wraps', thing: ['wrap', 'wraps'], box: ['shift', 'shifts'], story: ({ total, groups }) => `The galley made ${total} wraps, shared evenly among ${groups} shifts.`, ask: 'How many wraps does each shift get?' },
  ],
  crates: [
    { key: 'eggs', box: ['carton', 'cartons'], story: ({ total, per, f }) => `${f.name} needs ${total} eggs for the big breakfast. Eggs come in cartons of ${per}.`, ask: 'How many cartons should the galley open so there are enough?' },
    { key: 'trays', box: ['tray', 'trays'], story: ({ total, per }) => `${total} crew are coming to the party, and a tray holds ${per} cupcakes.`, ask: 'How many trays of cupcakes so everyone gets one?' },
    { key: 'tins', box: ['crate', 'crates'], story: ({ total, per }) => `The galley needs ${total} tins of beans this month. Beans come in crates of ${per} tins.`, ask: 'How many crates should it order so there are enough?' },
  ],
  partsLeft: [
    { key: 'eggsLeft', unit: ['egg', 'eggs'], story: ({ a, b, f }) => `The cold store had ${a} eggs this morning. ${f.name} used ${b} of them for omelettes.`, ask: 'How many eggs are left?' },
    { key: 'soupLeft', unit: ['bowl', 'bowls'], story: ({ a, b }) => `The big pot held ${a} bowls of soup. ${b} bowls have been served.`, ask: 'How many bowls of soup are left in the pot?' },
    { key: 'juiceLeft', unit: ['cup', 'cups'], story: ({ a, b }) => `The drinks machine had ${a} cups of orange juice. The day shift drank ${b} cups.`, ask: 'How many cups are left?' },
  ],
  partsTogether: [
    { key: 'potatoes', unit: ['potato', 'potatoes'], story: ({ a, b }) => `Two supply drones landed. One brought ${a} potatoes and the other ${b} potatoes.`, ask: 'How many potatoes came in?' },
    { key: 'meals', unit: ['meal', 'meals'], story: ({ a, b }) => `The galley served ${a} meals at breakfast and ${b} at lunch.`, ask: 'How many meals is that in all?' },
    { key: 'herbs', unit: ['bunch', 'bunches'], story: ({ a, b }) => `The grow pods gave ${a} bunches of basil on Monday and ${b} more on Friday.`, ask: 'How many bunches of basil in all?' },
  ],
  recipe: [
    { key: 'stew', make: ['bowl of stew', 'bowls of stew'], unit: ['cup of beans', 'cups of beans'], small: ['cup', 'cups'],
      story: ({ base, per, want }) => `The galley's comet stew serves ${base} with ${u(per, ['cup of beans', 'cups of beans'])}. ${want} crew are coming off shift and want a bowl each.`, ask: () => 'How many cups of beans does the stew need?' },
    { key: 'pancakes', make: ['pancake', 'pancakes'], unit: ['egg', 'eggs'], small: ['egg', 'eggs'],
      story: ({ base, per, want }) => `The pancake recipe makes ${base} pancakes with ${u(per, ['egg', 'eggs'])}. The galley needs ${want} pancakes.`, ask: () => 'How many eggs are needed?' },
    { key: 'noodles', make: ['bowl of ramen', 'bowls of ramen'], unit: ['scoop of noodles', 'scoops of noodles'], small: ['scoop', 'scoops'],
      story: ({ base, per, want, f }) => `${f.name}'s ramen recipe makes ${base} bowls with ${u(per, ['scoop of noodles', 'scoops of noodles'])}. ${want} bowls are ordered.`, ask: () => 'How many scoops of noodles?' },
    { key: 'pizza', make: ['pizza', 'pizzas'], unit: ['cup of cheese', 'cups of cheese'], small: ['cup', 'cups'],
      story: ({ base, per, want }) => `${base} moon pizzas take ${u(per, ['cup of cheese', 'cups of cheese'])}. The party wants ${want} pizzas.`, ask: () => 'How many cups of cheese?' },
  ],
  tables: [
    { key: 'rice', top: ['crew member', 'crew members'], bot: ['cup of rice', 'cups of rice'], botShort: ['cup', 'cups'], s: (a, b) => `The galley cooks ${a} cups of rice for every ${b} crew members.` },
    { key: 'noodles', top: ['bowl', 'bowls'], bot: ['scoop of noodles', 'scoops of noodles'], botShort: ['scoop', 'scoops'], s: (a, b) => `${b} bowls of ramen take ${a} scoops of noodles.` },
    { key: 'pancakes', top: ['pancake', 'pancakes'], bot: ['egg', 'eggs'], botShort: ['egg', 'eggs'], s: (a, b) => `The pancake mix takes ${a} eggs for every ${b} pancakes.` },
    { key: 'tea', top: ['pot', 'pots'], bot: ['spoon of tea', 'spoons of tea'], botShort: ['spoon', 'spoons'], s: (a, b) => `${b} pots of nebula tea take ${a} spoons of tea leaves.` },
  ],
  shares: {
    names: [['water', 'juice'], ['milk', 'cocoa'], ['broth', 'sauce']],
    what: [['cup', 'cups', 'cup', 'cups']],
    story: ({ x, y, total, a, b }) => `The galley mixes ${a} ${a === 1 ? 'part' : 'parts'} ${x} to ${b} ${b === 1 ? 'part' : 'parts'} ${y}. The jug holds ${total} cups in all.`,
    ask: ({ who }) => `How many cups of ${who} go in?`,
  },
  proportions: [
    ({ n, d, D }) => ({ key: 'veg', s: `${n} of every ${d} meals on the galley's menu ${n === 1 ? 'is' : 'are'} veggie. This week the galley cooks ${D} meals.`, ask: 'How many of them are veggie?', unit: ['meal', 'meals'], what: 'veggie' }),
    ({ n, d, D }) => ({ key: 'beans', s: `In the bean mix, ${n} of every ${d} beans ${n === 1 ? 'is' : 'are'} red. The sack holds ${D} beans.`, ask: 'How many are red?', unit: ['bean', 'beans'], what: 'red' }),
    ({ n, d, D }) => ({ key: 'berries', s: `${n} of every ${d} berries from the grow pods ${n === 1 ? 'is' : 'are'} ripe today. The pods have ${D} berries.`, ask: 'How many are ripe?', unit: ['berry', 'berries'], what: 'ripe' }),
  ],
};

// ── this job's own maker: a recipe scaled by a fraction of a cup ───────────────────────────────────────────────────
// "The comet stew serves 4 with 3/4 cup of rice. 10 crew are coming: how many cups?" 10 is 2 1/2 times 4, so 2 1/2
// lots of 3/4 cup: 1 7/8 cups. Step 1: whole times (2 or 3 batches); step 2: one and a half or two and a half batches.
// The wrong answers: adding on instead of scaling, the cup amount times the crew, the times only, one batch too many.
const AMOUNTS = [[1, 2], [1, 3], [2, 3], [3, 4], [1, 4], [3, 2], [5, 4]];
const STUFF = [
  { dish: 'comet stew', stuff: 'rice' }, { dish: 'pancake mix', stuff: 'milk' }, { dish: 'moon soup', stuff: 'lentils' },
  { dish: 'star bread', stuff: 'flour' }, { dish: 'fruit salad', stuff: 'honey' },
];
const cupsWord = (f) => (f[0] <= f[1] ? 'cup' : 'cups');
const face = (f) => { const t = fracText(f); return { v: `f${f[0]}/${f[1]}`, big: t, small: cupsWord(f), label: `${t} ${cupsWord(f)}` }; };
const mul = (f, k) => frac(f[0] * k[0], f[1] * k[1]);

export const MAKERS = {
  cups: {
    strand: 'ratio', at: (step) => (step <= 1 ? 72 : 76),
    make(step, { rand = Math.random, who = null } = {}) {
      const pick = (a) => a[Math.floor(rand() * a.length)];
      for (let tries = 0; tries < 40; tries++) {
        const base = pick([2, 4]), k = step <= 1 ? pick([[2, 1], [3, 1]]) : pick([[3, 2], [5, 2], [3, 2]]);
        const want = base * k[0] / k[1];
        if (!Number.isInteger(want) || want === base) continue;
        const amt = pick(AMOUNTS), dish = pick(STUFF), ans = mul(amt, k);
        if (ans[1] === 1 && step > 1 && tries < 30) continue;   // (step 2: an answer with a fraction in it)
        const slips = [
          { ...face(frac(amt[0] + (want - base) * amt[1], amt[1])), slip: 'addedOn', why: `That adds a cup for every extra crew member. A recipe grows by times: ${want} is ${fracText(k)} times ${base}, so it takes ${fracText(k)} times the ${dish.stuff}.` },
          { ...face(mul(amt, [want, 1])), slip: 'multipliedAll', why: `That's ${fracText(amt)} cup for every one crew member. The ${fracText(amt)} cup is for ${base}.` },
          { ...face(mul(amt, [k[0] + k[1], k[1]])), slip: 'batchOff', why: `That's ${fracText([k[0] + k[1], k[1]])} batches. ${want} is ${fracText(k)} batches of ${base}.` },
          { ...face(frac(k[0], k[1])), slip: 'timesOnly', why: `${fracText(k)} is how many times bigger the batch is. Now make the ${fracText(amt)} cup that many times bigger too.` },
          { ...face(frac(ans[0] + ans[1], ans[1])), slip: 'off', why: 'That\'s a cup too many. Count the batches again.' },
        ].filter((s) => s.v !== face(ans).v);
        const g = gcd(want, base);
        return ownOrder({
          key: `cups:${dish.stuff}`,
          story: `The ${dish.dish} recipe serves ${base} and takes ${fracText(amt)} ${cupsWord(amt)} of ${dish.stuff}. ${want} crew are coming to dinner.`,
          ask: `How many cups of ${dish.stuff} are needed?`,
          right: face(ans), slips,
          rightWhy: `${want} is ${fracText(k)} times ${base}, so ${fracText(k)} × ${fracText(amt)} = ${fracText(ans)} ${cupsWord(ans)}`,
          help: {
            title: 'Batches of the recipe',
            pic: { kind: 'cups', amt, k, base, want },
            line: `One batch serves ${base}. ${want} crew is ${fracText(k)} batches (${want} ÷ ${base}${g > 1 && k[1] > 1 ? ` = ${want / g}/${base / g}` : ''}). Add up ${fracText(amt)} cup for each whole batch, and half of it for a half batch.`,
            steps: [`First the batches: ${want} ÷ ${base}`, `Then that many lots of ${fracText(amt)} ${cupsWord(amt)}: ${fracText(k)} × ${fracText(amt)}`],
          },
          own: { strand: 'ratio', at: step <= 1 ? 72 : 76 },
          credit: [{ strand: 'frac', at: 58, weight: 0.5 }],
          facts: { base, want, amt, k, ans }, size: 2,
        }, rand);
      }
      throw new Error('galley cups: nothing made');
    },
  },
};

// ── the ladder: easiest first, every step small (Mathwood's store ladder's way: each level a mix of Asks) ─────────
const K = (step, w = 1) => ({ maker: 'wordsK', step, w });
const W = (step, types, w = 1) => ({ maker: 'words', step, types, w });
const M = (maker, step, w = 1) => ({ maker, step, w });

export const PLACE = {
  id: 'galley', name: 'The galley kitchen', short: 'Galley', math: 'Kitchen math: groups, recipes, ratios', pic: 'galley', job: null,
  line: 'Orders at the serving counter: trays and bowls, sharing out, recipes made bigger, mixing by a ratio.',
  levels: [
    { id: 'kAll', title: 'Counting on the counter', line: '2 apples and 1 more, up to 5', gen: { mix: [K(1)] } },
    { id: 'kLeft', title: 'How many in all, how many left', line: 'Up to 10: 7 eggs, 3 used', gen: { mix: [K(2)] } },
    { id: 'kPast', title: 'Past 10', line: '8 carrots and 5 more', gen: { mix: [K(3)] } },
    { id: 'kTrays', title: 'Trays of the same', line: '3 trays with 2 rolls on each', gen: { mix: [K(4, 2), K(3)] } },
    { id: 'groups', title: 'Trays and bowls', line: '4 trays, 3 rolls each; 15 and 18 together', gen: { mix: [W(1, ['groups', 'parts'])] } },
    { id: 'share', title: 'Sharing out', line: '24 cookies among 4 crew', gen: { mix: [W(2, ['share'], 2), W(1, ['groups'])] } },
    { id: 'bigger', title: 'Bigger trays and shares', line: '7 bowls with 9 scoops; 54 berries on 6 pancakes', gen: { mix: [W(3, ['groups', 'share', 'parts'])] } },
    { id: 'crates', title: 'Whole cartons', line: '50 eggs in cartons of 12: open 5', gen: { mix: [W(7, ['share'], 2), W(3, ['groups', 'share'])] } },
    { id: 'recipe', title: 'Recipes made bigger', line: 'The stew serves 4; we need 12', gen: { mix: [W(7, ['recipe'], 2), M('ratio', 2)] } },
    { id: 'table', title: 'Ratio tables', line: '3 cups of rice for every 2 crew; for 10 crew?', gen: { mix: [M('ratio', 3, 2), W(7, ['recipe'])] } },
    { id: 'mix', title: 'Mixing by a ratio', line: '3 parts water to 1 part juice, 20 cups in all', gen: { mix: [M('ratio', 4, 2), M('ratio', 3)] } },
    { id: 'prop', title: 'Proportions', line: '3 of every 4 meals are veggie; of 20?', gen: { mix: [M('ratio', 5, 2), M('ratio', 4)] } },
    { id: 'cupsWhole', title: 'Recipes with fractions', line: 'Serves 2 with 3/4 cup; for 6?', gen: { mix: [M('cups', 1, 2), M('ratio', 5)] } },
    { id: 'cupsHalf', title: 'Fractions of a batch', line: 'Serves 4 with 3/4 cup; for 10? (2 1/2 batches)', gen: { mix: [M('cups', 2, 2), M('cups', 1)] } },
  ],
};

export const JOB = {
  dark: true,      // its pictures are drawn dark, with light lines (src/jobs/pics.js NIGHT; the game's maker: "the dark mode looks better")
  id: 'galley', name: 'The galley kitchen', short: 'Galley', open: true,
  // where the job is: BEHIND the counter, on the cook's side (the game's maker: "it feels like they are standing on the
  // wrong side of that counter"): at the plain stretch of counter beside the cook, who serves at the food wells, turned
  // toward him and the dining room past the wells (spots.js shape: by the station file's names; the counter's own
  // frame: customers on +z, the cook on -z, the food wells' stretch toward +x)
  spot: { piece: 'counter', variant: 'plain', local: [0, 0, -0.9], face: [0.7, 0.7] },
  // the prompt comes up only on the cook's side: a customer at the tray rail is 1.6 m or more from the spot
  near: 1.2,
  // the camera while the job is up: through the player's own eyes, along the counter: the cook, the wells, the tables
  sign: 'Galley kitchen', hint: 'Cook up the orders',
  place: PLACE, setting: SETTING, makers: MAKERS,
  card: 'recipe',
};
