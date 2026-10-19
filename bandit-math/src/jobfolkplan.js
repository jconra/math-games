// THE JOB PEOPLE'S PLAN: who stands at each job, what they say, and the small rules for when they say it. No three.js
// here (the people themselves are made in src/jobfolk.js), so the tests can run it as it is.
//
//   JOB_FOLK            one entry a person: { id, job, name, role, look, hello: [line, line], start, thanks: [...],
//                       leave } (look: a folk.js look; hello: what is going on and what to do; start: said as the job
//                       gets going, if the job starts from a talk; thanks: one is said after a job's batch is done, in
//                       turn; leave: the toast when the player walks away from the job, for the jobs that end that way)
//   FOREMAN_HELLO       a camp foreman's two lines while no order is under way (by camp id; the delivery job has the rest)
//   TALK                distances and times: how close a person greets the player, offers E, shows a name tag ...
//   sayMs(text)         how long a line stays up (ms): longer lines stay longer
//   standSpot({ x, z, face, tries, step, ok })   the first spot round (x, z) that ok(x, z) accepts, trying a little to
//                       either side in turn; -> { x, z } or null
//   makeGreeter({ again })   when a person says hello: G.update(dt, near, away) -> true when it is time to say it
//                       (near: the player came close or arrived at the job; away: the player is well away). A hello
//                       is said the first time and then again only after the player has been away and `again` seconds
//                       have passed
//   makeLeaveWatch({ stay, leave })   walking away from an area job: W.update(dt, at, d) -> true once when the player,
//                       having been at the job (at: true) for `stay` seconds, is now `leave` metres (d) or more away
//                       W.worked(): the player did something at the job (needed for the toast); W.other(): they did
//                       something at a different area job instead (only the job last worked says goodbye)
//   thanksFor(event)    the person thanked for a job event ('waveDone' -> 'boss', ...), or null

export const TALK = {
  greet: 9,            // m from a person where they say hello as the player walks or rides up
  hail: 40,            // m: the freight driver calls out from this far (his wagon starts when the player is 26 m off)
  prompt: 4.2,         // m from a person where E (or a tap on the prompt) does what they ask
  tag: 16,             // m within which a person's name tag shows
  face: 10,            // m within which a person turns to face the player
  away: 22,            // m: further than this from a person (and away from the job) counts as having left
  again: 180,          // s before a person who has said hello says it again (after the player has been away)
  againArea: 600,      // ... the people at the herd, the sheep and the pigs (said on every arrival, it would wear thin)
  thanksNear: 90,      // m: a thank-you is said over the person within this; farther off it shows as a card of its own
  keep: 25,            // s a thank-you waits to be said while a panel is open over the game (then it is let go)
  awake: 90,           // m within which a person's clips play
  show: 170,           // m within which a person is drawn
  block: 0.42,         // m round a standing person where walkers are stopped (so nobody walks through them)
};

// the looks are folk.js's outfits and palettes, in drab period colours (none in the gang's black)
export const JOB_FOLK = [
  { id: 'boss', job: 'roundup', name: 'Cal Wheeler', role: 'trail boss', look: { outfit: 'adventurer_m', palette: 'rancher', skin: 3, hair: 2 },
    hello: ["My brand's cattle got mixed in with the big herd, and I need 'em cut out.",
      "Mine carry the numbers the card up top asks for. Rope 'em and they'll trot into this corral."],
    thanks: ["That's my bunch cut out. Much obliged, partner!", 'Penned, every one. Thank you kindly.', "Fine roping! There's more of mine out there."],
    leave: 'The herd will wait for you' },
  { id: 'vet', job: 'sheep', name: 'Doc Pruitt', role: 'veterinarian', look: { outfit: 'casual_m', palette: 'homestead', skin: 1, hair: 9 },
    hello: ['A sickness went through this flock, and I mean to doctor every one.',
      "A sick sheep looks like the rest: only her sum is wrong. Find the wrong sums and pick the medicine that fixes them."],
    thanks: ['Every one on her feet. Thank you, partner!', "That's the flock doctored. I'm obliged.", 'Good doctoring! You have a knack for it.'],
    leave: 'The sheep will wait for you' },
  { id: 'wife', job: 'pigs', name: 'Mrs. Haskell', role: "the farmer's wife", look: { outfit: 'casual_f', palette: 'prairie', skin: 2, hair: 5 },
    hello: ['The wind blew the gate open and the pigs got out!',
      "Each pig has a sum on it. Herd it into the pen whose sign shows the answer: come at it from behind."],
    thanks: ['Every pig back in! Bless you.', "That's the lot penned. Thank you kindly!", 'Back in their pens. You herd better than my husband!'],
    leave: 'The pigs will wait for you' },
  { id: 'driver', job: 'wagon', name: 'Gus Tolliver', role: 'freight driver', look: null,   // (the wagon's own driver)
    hello: ["A gang's been hitting this road, and I've freight to get through.",
      'Ride along and rope the bandits for me? Ride up alongside and we roll.'],
    start: "Let's roll! Keep alongside, partner.",
    thanks: ["That's that gang seen to. Obliged!", 'Freight rolls on safe. Thank you, partner.', "You're a fair hand with a rope! More road ahead."],
    leave: 'The wagon will wait for you' },
  { id: 'naturalist', job: 'deer', name: 'Miss Ada Wren', role: 'naturalist', look: { outfit: 'adventurer_f', palette: 'sage', skin: 1, hair: 6 },
    hello: ["I'm making a book of this valley's animals, and I need pictures of the deer.",
      'Borrow my camera! Set it up a good way off, and photograph the deer whose tag makes the equation true.'],
    lend: ["Here you are: it's strapped behind your saddle. Do take care of it!",
      'Follow the hoofprints to the herd. Set it up a good way off, and photograph the deer whose tag makes the equation true.'],
    back: ['Thank you kindly! Your pictures go straight in my book.', 'Come and borrow it again any time.'],
    thanks: ['Lovely pictures! They go straight in my book.', 'What a fine roll of pictures. Thank you!', 'Splendid! The next herd is on your compass.'] },
  { id: 'sheriff', job: 'boxes', name: 'Sheriff Boone', role: 'sheriff', look: { outfit: 'suit_m', palette: 'mustard', skin: 4, hair: 1 },
    hello: ['Seized lock boxes keep piling up on my desk.', "Crack 'em open and I'll pay you for every one. Step inside."],
    thanks: ['Fine work on those boxes. Come back any time.', "That's a few less on my desk. Obliged!", 'Good safecracking, partner.'] },
  // (out front of the sheriff's office too, the other side of the steps: only when "Loot the gang" is ticked)
  { id: 'deputy', job: 'loot', name: 'Deputy Mills', role: 'deputy', look: { outfit: 'adventurer_m', palette: 'rancher', skin: 2, hair: 3 },
    hello: ['The gang that hits the freight wagons stashed what they stole out in the valley.',
      "Find their cache on your compass, haul it back here, and help me share it out fair."],
    thanks: ['Every family got back what was theirs. Obliged, partner!', "That's one stash cleaned out. Word is there's more.", 'Folks in this town owe you. Thank you kindly.'] },
];
export const FOLK_BY_ID = Object.fromEntries(JOB_FOLK.map((f) => [f.id, f]));

// a camp foreman's hello while no order is under way (the delivery job says the rest: the order, the thank-you)
export const FOREMAN_HELLO = {
  cow: ['The crew is running low on grub out here.', 'Take an order: the general store will make it up, and you haul it out.'],
  hollis: ["We're short of supplies at our camp.", 'Take an order: the general store will make it up, and you haul it out.'],
  survey: ['The survey crew is low on stores.', 'Take an order: the general store will make it up, and you haul it out.'],
};

// which person thanks the player for which job event (the game's Hob events: src/hob.js)
const THANKS = { waveDone: 'boss', flockDone: 'vet', pigsDone: 'wife', banditsDone: 'driver', deerDone: 'naturalist', sheriffDone: 'sheriff', lootDone: 'deputy' };
export const thanksFor = (event) => THANKS[event] || null;
// the job events that count as working at an area job (a pick, right or wrong), by the area's person
export const WORK = { catch: 'boss', miss: 'boss', waveDone: 'boss', sheepHealed: 'vet', sheepWrong: 'vet', sheepFine: 'vet', flockDone: 'vet',
  pigPenned: 'wife', pigWrong: 'wife', pigsDone: 'wife' };

export const sayMs = (text) => Math.max(4200, 1600 + String(text || '').length * 52);

// the first spot round (x, z) that ok() takes: straight out first, then a little to one side and the other, further
// each time (step radians), turning about (x, z) at the same distance
export function standSpot({ x, z, toward = null, dist = 0, tries = 9, step = 0.3, ok = () => true }) {
  const a0 = toward ? Math.atan2(toward.x - x, toward.z - z) : 0;
  for (let i = 0; i < tries; i++) {
    const k = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1);
    const a = a0 + k * step, px = x + Math.sin(a) * dist, pz = z + Math.cos(a) * dist;
    if (ok(px, pz)) return { x: px, z: pz };
  }
  return null;
}

export function makeGreeter({ again = TALK.again } = {}) {
  let said = false, since = 1e9, left = true;
  return {
    update(dt, near, away) {
      since += dt;
      if (away) left = true;
      if (near && left && (!said || since >= again)) { said = true; since = 0; left = false; return true; }
      if (near) left = false;
      return false;
    },
    reset() { said = false; since = 1e9; left = true; },
    get said() { return said; },
  };
}

export function makeLeaveWatch({ stay = 4, leave = 50 } = {}) {
  let t = 0, did = false;
  return {
    // the player did something at this job (roped, doctored, penned: right or wrong); only then does leaving get the toast
    worked() { did = true; },
    // ... at another job instead (the pigs, next door to the sheep): this one forgets, so only the job last worked says
    // goodbye (riding out of the pig yard crosses the sheep's area, and that is not leaving the sheep)
    other() { did = false; t = 0; },
    update(dt, at, d) {
      if (at) { t += dt; return false; }
      if (did && t >= stay && d >= leave) { t = 0; did = false; return true; }
      if (d >= leave) t = 0;   // (passing through briefly doesn't count)
      return false;
    },
  };
}
