// OLD HOB: the old hand next door, the trail buddy with the hints (the people at each job say what is going on there:
// src/jobfolk.js). He says a short line now and then (a caption at the bottom left, with a short babble
// of a voice under it: src/audio/voice.js, when the game gives him one) and
// lays a trail of glowing hoofprints from where the player is out to the job the card up top is about, so a rider
// knows where to go.
//
// Each teaching line is said once per rider (remembered in rider.flags.hob, saved with the rider), so a returning
// rider isn't told the same things again.
//
//   const B = makeHob({ W, hud, rider, scene, I, voice, roads })   (I: the input, so a phone player is told to tap, not press F;
//                         voice: { speak(text, { key }), stop(), update?(dt), babble? }: what says his lines (the game
//                         gives the browser's voice for a rider who can't read yet: src/audio/sayline.js; his old
//                         babble, makeHobVoice, would go in with babble: true) or null for none; roads(): more ways the trail likes to keep
//                         to besides the town's dirt trail, as [[[x, z], ...], ...] (the wagon road), or null)
//   B.event(name, data)   what just happened; Hob decides whether to say something:
//                         'ride' (riding out; data.range, data.wagon, data.sheep, data.pigs, data.deliveries, data.store ...:
//                         which jobs are on, false for one a grown-up turned off: its tips aren't said), 'arrive' (at the herd), 'catch', 'miss', 'waveDone' (data.gold),
//                         'boxWon', 'saddle', 'dog', 'horse', 'title' (data.title), 'near' (data.place: at the saloon's
//                         doors, nothing behind them yet, or the front of the stage, where the town band plays; said
//                         again only after NEAR_AGAIN)
//                         The farm (missions/sheep.js): 'farmArrive' (at the sheep pasture), 'sheepHealed', 'sheepWrong' (a
//                         wrong bottle), 'sheepFine' (medicine for a healthy sheep: a short line, the why is in the hint), 'flockDone'
//                         The pig yard (missions/pigs.js): 'pigsArrive', 'pigPenned', 'pigWrong' (data.line: why not that pen,
//                         said at once), 'pigsDone'
//                         The store counter (missions/store.js): 'storeStart', 'storeMiss' (a wrong coin), 'storeEquation'
//                         (a story told backwards, off to the lock box), 'storeDone' (data.filled)
//                         'storeRight' (a right coin: a 'pick again' line still up or waiting is dropped)
//                         The camps' deliveries (missions/delivery.js): 'deliveryOrder' (an order taken), 'deliveryWork' (the
//                         slip at the store), 'deliveryMiss', 'deliveryRight', 'deliveryLoaded', 'deliveryArrive',
//                         'deliveryDone' (data.first), 'deliveryNoSaddle', 'deliveryRobbed'; 'campTip' (said once, after a
//                         wave, to a rider with a saddle: there's hauling to do for the camps)
//                         Protect the wagon (missions/wagonjob.js): 'wagonArrive' (the job starts), 'banditCatch',
//                         'banditMiss', 'banditLoop' (a rider has galloped off round the bend), 'banditsDone' (data.n),
//                         'wagonStop' ("Done for now")
//                         The homestead (homestead.js): 'animal' (data.kind, data.name: one bought), 'animalGift' (data.kind,
//                         data.name, data.unlocked: a thank-you lamb, piglet or calf; unlocked: the first of its kind, so
//                         the store sells that kind now), 'animalGrew' (data.name), 'goodsCollected' (picked up
//                         at the yard), 'goodsSold' (sold at the store counter)
//                         Deer photographs (missions/deerjob.js): 'deerArrive' (near the herd), 'deerSpooked' (it bolted),
//                         'deerSetup' (the viewfinder is up), 'deerFlip' (the ground glass turns the right way up),
//                         'deerRight', 'deerWrong' (data.line: why not that deer, said at once), 'deerDone' (a herd's
//                         pictures all taken), 'deerStop' ("Done for now"); 'ride' with data.deer: the job is on
//                         Loot the gang (missions/loot.js): 'lootGuard' (the cache's guard roped), 'lootFled' (he ran),
//                         'lootLoaded', 'lootNoSaddle', 'lootShare' (the slip at the sheriff's office), 'lootMiss',
//                         'lootRight' (a right coin: a 'pick again' line still up or waiting is dropped),
//                         'lootDone' (data.trips), 'lootWord' (data.place: the next cache); 'ride' with data.loot: the job is on
//   B.say(text)           says a line now (or after the line he is saying)
//   B.trail(on)           the hoofprints on or off (they fade in and out)
//   B.trailTo(goal | null)   each frame: where the trail leads, { id, x, z, hide: { x, z, r } } (id: which job; hide: a
//                         circle where the trail is not wanted, as the whole pasture for the round-up), or null for no
//                         trail (no job card up, or the job is under way)
//   B.trailState()        for rigs: { id, goal, prints, fade, searching, gone, length, end, pts }
//   B.update(dt, at, { hold })   each frame: at = the player's position (the trail fades away once they reach the job);
//                         hold: a job person's speech card is up (on a narrow screen Hob then waits his turn)
//   B.dispose()
import * as THREE from 'three';
import { saveRider } from './save.js';
import { makePathSearch, nearestAlong } from './trailpath.js';

export const HOB = {
  step: 1.15,          // metres between hoofprints along the trail
  side: 0.3,           // each print this far left or right of the trail's middle
  size: [0.5, 0.58],   // a print's width and length (m), glow included: bigger than a real hoof, to be seen from the saddle
  pulse: 9,            // metres a second the glow runs along the trail toward the job
  wave: 14,            // metres between two glows
  hideNear: 38,        // the round-up's trail fades out within this many metres of the pasture's middle
  goalNear: 15,        // any other job's trail fades out within this many metres of it
  ahead: 3,            // the trail starts this many metres ahead of the player (the prints behind are gone)
  stray: 25,           // metres off the trail before it is worked out again from where the player is
  moved: 20,           // metres a job can move (the wagon rolling on) before the trail is worked out again
  most: 900,           // prints at most (about a kilometre of trail)
  cell: 2,             // the way finder's grid squares (m)
  pad: 40,             // metres of land round the two ends that the way may use
  steep: 0.6,          // ground steeper than this (rise over run) is no way for the trail
  road: 0.45,          // the town trail and the wagon road cost this much of open grass, so the way keeps to them
  budget: 3,           // milliseconds a frame for working out a way
};

const LINES = {
  firstDay: "Mornin'! Rancher next door needs a hand with his herd. His trail boss is out by the corral: follow the hoofprints.",
  back: ["Herd's waiting out in the pasture. The hoofprints know the way.", "Good to see you. The rancher's got more cattle needing a rope.",
    "Fine day for a round-up. Pasture's east, past the creek."],
  shoot: "Miss Opal keeps a target range across the creek, east end of town. Bottles and tin cans only, mind: it's still the rope for cattle and bandits.",
  arrive: 'Each steer carries a number. Rope the ones the card up top asks for: point at one and click, or press F.',
  arriveTouch: 'Each steer carries a number. Rope the ones the card up top asks for: tap one, or the Rope button.',
  catch: "Nice throw! It'll gallop itself over to the corral.",
  miss: 'No harm done. The help shows why it wasn\'t that one. Then try another.',
  waveSaddle: "That's a day's wages! Enough for a saddle. The stable's back in town.",
  wave: 'Good work. Another bunch is wandering in.',
  boxWon: "There's a lock box in your saddlebags. Crack it at the sheriff's desk, or at your cabin table.",
  saddle: 'Whistle with H and your horse comes running. E gets you up, Shift lets her gallop.',
  dog: 'Every cowhand needs a dog. Yours will keep up, never you mind.',
  dogPug: "A pug! Them little legs won't keep up with a horse, but he'll find you. He always does.",
  horse: 'Fine-looking horse. Treat her well.',
  donkey: "A donkey! Slow as molasses, but he won't quit on you.",
  hat: ['Now that is a fine hat.', 'Suits you, partner.', 'Look at you! A proper hat for a proper rider.'],
  // the farm north of town: the sick-sheep job
  farmTip: "There's a farm north of town, behind your cabin. The vet out there could use a hand with the sheep, and the pigs got loose.",
  farmTipSheep: "There's a farm north of town, behind your cabin. The vet out there could use a hand with the sheep.",
  farmTipPigs: "There's a farm north of town, behind your cabin. The pigs got loose out there, and they need penning.",
  farmArrive: 'Point at a sheep with a wrong sum, press F, and pick the medicine that fixes it.',
  farmArriveTouch: 'Tap a sheep with a wrong sum, then tap the medicine that fixes it.',
  sheepHealed: "That's the cure. She'll be right as rain.",
  sheepWrong: 'Not that bottle. The help shows why. Then try another. No harm done.',
  sheepFine: ["She's fine, partner. Nothing wrong with that sum.", 'That one\'s healthy. Save the medicine.', 'Fit as a fiddle, that one. Check the others.'],
  flockDone: ["Whole flock's on its feet.", "That's the flock seen to. More sums for you to check.", 'Good doctoring.'],
  // the farm's pig yard: the loose-pigs job
  pigsArrive: "Pigs run from you: come at one from the side away from the pen you want, and it runs ahead of you.",
  pigPenned: "In she goes. That's the right pen.",
  pigsDone: ["That's every pig penned.", 'All penned. Here come some more sums.', 'Fine herding, partner.'],
  // the general store's counter: townsfolk bring order slips (word problems)
  storeStart: "Folks bring their orders on a slip. Read it through, picture what's going on, then pick the coin.",
  storeBack: ['Counter\'s open. Here they come.', 'Busy day at the store. Slips at the ready.'],
  storeMiss: 'Not that one. The picture on the slip shows how the story goes together. Pick again, no charge.',
  storeEquation: 'This one\'s told backwards. Write the story as an equation, then crack it like a lock box.',
  storeDone: ['Store\'s in good hands with you.', 'Fine work at the counter.', 'The storekeeper says thank you kindly.'],
  // the camps out in the valley: hauling their supplies
  campTip: "Folks are camped out in the valley: a cow crew to the west, the Hollis family past the pasture, surveyors up north. They pay to have supplies hauled. Ask their foreman.",
  deliveryOrder: "The order's on your card. Ride to the general store and work out how much to send: pull up out front.",
  deliveryWork: 'Take it a step at a time: how much for one day, then all the days, then how many crates.',
  deliveryMiss: 'Not that one. Look at the picture, then pick again. No harm done.',
  deliveryRoundUp: "Mind the leftovers! A crate that's only part full still has to go. Always round up.",
  deliveryLoaded: "Crates are on your horse. Follow the compass out to the camp.",
  deliveryArrive: 'Here come the hands to unload.',
  deliveryDone: ["Hauling's honest work. Talk to the foreman for the next order.", 'Another one delivered.', 'Good hauling, partner.'],
  deliveryFirst: "That's your first delivery! Talk to the foreman again whenever you want the next order.",
  deliveryNoSaddle: "Crates need a saddled horse to carry 'em. The stable sells saddles.",
  deliveryRobbed: "The gang got the crates! Don't fret: ride back to the store and they'll make it up again.",
  // protect the wagon: the gang wears its numbers; the townsfolk riding along look just the same
  wagonArrive: "Every bandit wears a number: the card up top says which. Townsfolk ride along too, looking just like the gang: only the number tells. Point at a rider and click, or press F.",
  wagonArriveTouch: "Every bandit wears a number: the card up top says which. Townsfolk ride along too, looking just like the gang: only the number tells. Tap a rider, or the Rope button.",
  banditCatch: "Got him! Once he's caught his breath, he'll walk himself to the sheriff.",
  banditMiss: "That's an honest townsman. No harm done: check the count on the rail, then pick again.",
  banditMissCard: "That's an honest townsman. No harm done: look at the picture, then pick again.",   // (a gang of cards: no rail)
  banditLoop: "One's galloped on ahead. Don't fret: they always come back round the bend.",
  banditsDone: ['The wagon rolls on safe. More road ahead, and likely more trouble.', "That's the gang seen to. Keep alongside, partner.", 'Fine riding. Eyes on the road.'],
  wagonStop: "The wagon will wait. Come back any time.",
  wagonWaits: "A freight driver's waiting with his wagon on the road east of the pasture: follow the wagon on your compass and ride up to him.",
  // walking up to the saloon's doors (nothing to open yet) and the front of the stage (the town band plays there)
  saloon: ["Saloon's shut till sundown, partner. Lock boxes are next door at the sheriff's.",
    "Doors stay shut till evening. The band out front keeps folks company meanwhile."],
  stage: ["That's the town band. The Professor on the piano, Josie on the harmonica.",
    "Stand a spell and listen, if you like. They play from sunup to sundown.",
    "Josie learned that harmonica on a cattle drive. The Professor plays it all by ear."],
  // the homestead behind your cabin: the first of each kind bought, the thank-yous, the goods
  animal: {
    hen: "A hen of your own! She'll lay eggs in the coop behind your cabin. Walk past to pick them up, and sell them at the store counter.",
    pig: "A pig! Pigs don't lay a blessed thing, partner. They're just good company.",
    sheep: "A sheep! Her wool grows slow and steady. Pick it up by the corral: townsfolk at the store buy a share of it, a half or a third or so.",
    cow: "A milk cow! Pick up the milk by the corral. The store buys it by the gallon, and four quarts make a gallon.",
  },
  animalAgain: ['{name} settles right in.', '{name} looks happy out back.', 'Another mouth to feed. {name} will earn their keep.'],
  animalGift: {
    sheep: "The settler sent you a lamb by way of thanks. {name} is waiting in your corral behind the cabin.",
    pig: "The settler sent you a piglet by way of thanks. {name} is waiting in your pen behind the cabin.",
    cow: "The rancher sent you a calf for all that roping. {name} is waiting in your corral behind the cabin.",
  },
  // (said after the thank-you line when it is the first of its kind: the store sells that kind from now on)
  animalUnlock: { pig: 'And the store will sell you pigs now.', sheep: 'And the store will sell you sheep now.', cow: 'And the store will sell you milk cows now.' },
  animalGrew: '{name} is all grown up now.',
  goodsCollected: "Those go in your saddlebags. The townsfolk at the general store will buy them: mind the counter.",
  goodsKept: "Those go in your saddlebags.",   // (the store's counter job is turned off: nobody to sell them to)
  goodsSold: "Sold! That's how a homestead pays its way: a little figuring at the counter.",
  // deer photographs: the naturalist's box camera, the herds out in the valley
  deerTip: "There's a naturalist out by the deer, making a book of the valley's animals. She'll lend you her camera: follow the compass to the herd.",
  deerArrive: "Easy now. Deer bolt if you crowd 'em. Set the camera up a good ways off: the card up top says when you're close enough.",
  deerSpooked: ["Too close, partner! They'll settle again. Give 'em more room this time.", "Off they go! Let 'em settle, then set up from further back."],
  deerSetup: "Each deer's wearing a number tag, and only one number makes that equation true. Work it out, then take that deer's picture.",
  deerSetupTouch: "Each deer's wearing a number tag, and only one number makes that equation true. Work it out, then tap that deer.",
  deerFlip: "Ground glass shows the world upside down! There's a little mirror in this one to turn it the right way up.",
  deerRight: "Hold still... there! That's one for the album.",
  deerDone: ["That's a fine roll of pictures. They've had enough: the compass knows where the next herd is.", 'Three for the album. Pack her up and find another herd.', "Those'll look fine in her book."],
  deerStop: "The deer will keep. Set the camera up again whenever you like.",
  // loot the gang: the gang's cache out in the valley, handed back at the sheriff's office
  lootTip: "The deputy says the gang stashed what they stole out in the valley. It's on your compass: bring it back and share it out fair.",
  lootGuard: "Got him! He'll keep there till the sheriff collects him.",
  lootFled: "Let him run, partner. It's the loot that counts.",
  lootLoaded: "Loot's on your horse. Take it back to the sheriff's office: the folks it was taken from will be waiting.",
  lootNoSaddle: "That's too much to carry by hand. You'll want a saddled horse: the stable sells saddles.",
  lootShare: "Read who lost what, then pick the coin that shares it out fair. Whatever won't go round is the leftover.",
  lootMiss: "Not that one. The picture shows the sharing: deal it out round and round. Pick again, no charge.",
  lootDone: ['Every family got their goods back. That\'s good work.', 'The town owes you one, partner.', 'Fair shares all round.'],
  lootWord: "Word is the gang hid more loot out at {place}. It's on your compass.",
};
// which job each line belongs to. A line still waiting its turn is dropped once the player is at another job, or once it
// has waited longer than KEEP_JOB seconds: said late it would be about a moment that has passed.
const JOB = { arrive: 'roundup', catch: 'roundup', miss: 'roundup', waveDone: 'roundup', farmArrive: 'sheep', sheepHealed: 'sheep', sheepWrong: 'sheep',
  sheepFine: 'sheep', flockDone: 'sheep', pigsArrive: 'pigs', pigPenned: 'pigs', pigWrong: 'pigs', pigsDone: 'pigs', storeStart: 'store',
  storeMiss: 'store', storeEquation: 'store', storeDone: 'store', deliveryWork: 'delivery', deliveryMiss: 'delivery', deliveryRight: 'delivery',
  deliveryRoundUp: 'delivery', animal: 'home', goodsCollected: 'home', goodsSold: 'store', wagonArrive: 'wagon', banditCatch: 'wagon', banditMiss: 'wagon', banditLoop: 'wagon', banditsDone: 'wagon',
  deerArrive: 'deer', deerSpooked: 'deer', deerSetup: 'deer', deerFlip: 'deer', deerRight: 'deer', deerWrong: 'deer', deerDone: 'deer',
  lootShare: 'loot', lootMiss: 'loot', lootRight: 'loot', lootGuard: 'loot', lootFled: 'loot' };
const KEEP_JOB = 5;
const WANT_FOR = 120;    // seconds the trail leads where his line just sent the rider (the stable, after the first wave's pay)
const NEAR_AGAIN = 180;  // seconds before Hob says something about the same place again (walking past again and again doesn't set him off each time)

export function makeHob({ W, hud, rider, scene = W.scene, I = null, voice = null, roads = null }) {
  const touch = () => !!(I && I.touch);
  const flags = () => { rider.flags = rider.flags && typeof rider.flags === 'object' ? rider.flags : {}; const f = rider.flags; f.hob = f.hob || {}; return f.hob; };
  const once = (id) => { const f = flags(); if (f[id]) return false; f[id] = 1; saveRider(rider); return true; };
  const queue = [];
  let fineN = 0, doneN = 0;       // ('sheepFine', 'flockDone': which line said last)
  let pigN = 0;                   // ('pigsDone': which line said last)
  let storeN = 0;                 // ('storeBack', 'storeDone': which line said last)
  let haulN = 0;                  // ('deliveryDone': which line said last)
  let hatN = 0;                   // ('hat': which line said last)
  let wagonN = 0;                 // ('banditsDone': which line said last)
  let animalN = 0;                // ('animal' after the first of a kind: which line said last)
  let deerN = 0, spookN = 0;      // ('deerDone', 'deerSpooked': which line said last)
  let lootN = 0;                  // ('lootDone': which line said last)
  const nearAt = {}, nearN = {};   // ('near': when each place was last remarked on, and which line it said)
  let speaking = 0, now = 0;
  let on = {};                     // the jobs on for this ride ('ride' data: a job a grown-up turned off is false)
  let saying = null;               // the line on screen: { text, ms, key, urgent } (key = the event it came from)
  let hold = false;                // (a narrow screen with a job person's speech card up: Hob waits his turn, see B.update)
  let asking = null;               // (the job whose question is up where the player is, or 'panel': see B.update)
  let sentTo = null;               // (a place his line just sent the rider to: { place, until }; the trail leads there, B.wants)
  let key = null;                  // (the event being handled, so the line it says remembers where it came from)
  const B = {};
  // (urgent: the why of a pick just made, said even while Hob is waiting his turn)
  B.say = (text, ms, { urgent = false } = {}) => {
    if (!text) return;
    // (what a wave just earned goes ahead of the tips waiting: it is said next, before the next bunch)
    if (speaking > 0 || (hold && !urgent) || held(key, urgent)) { if (!queue.some((q) => q.text === text)) queue[key === 'waveDone' ? 'unshift' : 'push']({ text, ms, key, at: now }); return; }
    const t = ms || Math.max(4500, 1800 + text.length * 55);
    hud.caption(text, t); speaking = t / 1000 + 0.4; saying = { text, ms, key, urgent };
    if (voice) voice.speak(text, { key });
    // (the saddle line sends the rider to the stable: the trail goes there for a while, once it is really said)
    if (text === LINES.waveSaddle) sentTo = { place: 'stable', until: now + WANT_FOR };
  };
  // while a question is up where the player is (B.update's asking: the job asking, or 'panel'), only lines about that
  // job are said (and the why of a pick: urgent); his tips and other jobs' lines wait their turn
  const held = (k, urgent = false) => !urgent && !!asking && JOB[k] !== asking;
  // a moment has passed: drop those lines, whether waiting or on screen
  const drop = (...keys) => {
    for (let i = queue.length - 1; i >= 0; i--) if (keys.includes(queue[i].key)) queue.splice(i, 1);
    if (saying && speaking > 0 && keys.includes(saying.key)) { hud.caption(null); speaking = 0; saying = null; if (voice) voice.stop(); }
  };
  B.event = (name, data = {}) => {
    const job = JOB[name];
    // at another job now: what was waiting to be said about the last one no longer fits
    if (job) for (let i = queue.length - 1; i >= 0; i--) if (JOB[queue[i].key] && JOB[queue[i].key] !== job) queue.splice(i, 1);
    key = name;
    try { said(name, data); } finally { key = null; }
  };
  function said(name, data) {
    switch (name) {
      case 'ride': {
        on = { ...data };
        const first = !flags().firstDay;
        if (first) { once('firstDay'); B.say(LINES.firstDay, 7000); }
        else B.say(LINES.back[Math.floor(Math.random() * LINES.back.length)]);
        if (data.range && once('rangeTip')) B.say(LINES.shoot, 7000);   // (where the target range is: told once)
        if (data.wagon && once('wagonWaits')) B.say(LINES.wagonWaits, 6500);   // (the first ride with "Protect the wagon" on)
        if (data.deer && once('deerTip')) B.say(LINES.deerTip, 6500);   // (the first ride with "Deer photographs" on)
        if (data.loot && once('lootTip')) B.say(LINES.lootTip, 7000);   // (the first ride with "Loot the gang" on)
        break;
      }
      case 'arrive': if (once('arrive')) B.say(touch() ? LINES.arriveTouch : LINES.arrive, 7000); break;
      case 'catch': drop('miss'); if (once('catch')) B.say(LINES.catch); break;
      case 'miss': if (once('miss')) B.say(LINES.miss); break;
      case 'waveDone':
        drop('miss');
        // (the saddle line: the trail goes to the stable for a while, so what he says and where the hoofprints lead agree)
        if (!(rider.owned && rider.owned.saddle) && rider.gold >= (data.saddle || 15) && once('waveSaddle')) B.say(LINES.waveSaddle, 6500);
        else if (once('wave')) B.say(LINES.wave);
        else if ((on.sheep !== false || on.pigs !== false) && once('farmTip')) B.say(on.pigs === false ? LINES.farmTipSheep : on.sheep === false ? LINES.farmTipPigs : LINES.farmTip, 6500);
        else if (on.deliveries !== false && rider.owned && rider.owned.saddle && once('campTip')) B.say(LINES.campTip, 8000);
        break;
      case 'boxWon': if (once('boxWon')) B.say(LINES.boxWon, 6500); break;
      case 'saddle': if (sentTo && sentTo.place === 'stable') sentTo = null; if (once('saddle')) B.say(LINES.saddle, 6500); break;
      case 'dog': {
        // (the pug can't keep up with a galloping horse, so he gets his own line)
        const pug = rider.owned && rider.owned.dog && rider.owned.dog.kind === 'pug';
        if (pug ? once('dogPug') : once('dog')) B.say(pug ? LINES.dogPug : LINES.dog);
        break;
      }
      case 'horse': B.say(rider.owned && rider.owned.horse === 'donkey' ? LINES.donkey : LINES.horse); break;
      case 'hat': B.say(LINES.hat[(hatN++) % LINES.hat.length], 3000); break;
      case 'farmArrive': if (once('farmArrive')) B.say(touch() ? LINES.farmArriveTouch : LINES.farmArrive, 9000); break;
      case 'sheepHealed': drop('sheepWrong', 'sheepFine'); if (once('sheepHealed')) B.say(LINES.sheepHealed); break;
      case 'sheepWrong': if (once('sheepWrong')) B.say(LINES.sheepWrong); break;
      // (said at once, over anything he was saying: said later it would seem to be about some other sheep)
      case 'sheepFine': queue.length = 0; speaking = 0; B.say(LINES.sheepFine[(fineN++) % LINES.sheepFine.length], 3500, { urgent: true }); break;
      case 'flockDone': drop('sheepWrong', 'sheepFine', 'sheepHealed'); B.say(LINES.flockDone[(doneN++) % LINES.flockDone.length]); break;
      case 'pigsArrive': drop('farmArrive', 'sheepWrong', 'sheepFine', 'sheepHealed'); if (once('pigsArrive')) B.say(LINES.pigsArrive, 9000); break;   // (the sheep's lines are done with: next door is the pigs)
      case 'pigPenned': if (once('pigPenned')) B.say(LINES.pigPenned); break;
      // (the why, said at once over anything else: the pig is trotting back out right now)
      case 'pigWrong': queue.length = 0; speaking = 0; B.say(data.line, Math.max(5000, 1800 + String(data.line || '').length * 55), { urgent: true }); break;
      case 'pigsDone': drop('pigWrong', 'pigPenned'); B.say(LINES.pigsDone[(pigN++) % LINES.pigsDone.length]); break;
      case 'storeStart': if (once('storeStart')) B.say(LINES.storeStart, 7000); else B.say(LINES.storeBack[(storeN++) % LINES.storeBack.length], 3000); break;
      case 'storeRight': drop('storeMiss'); break;
      case 'storeMiss': if (once('storeMiss')) B.say(LINES.storeMiss, 6500); break;
      case 'storeEquation': if (once('storeEquation')) B.say(LINES.storeEquation, 6500); break;
      case 'storeDone': drop('storeMiss', 'storeEquation', 'storeStart'); if (data.filled) B.say(LINES.storeDone[(storeN++) % LINES.storeDone.length], 3500); break;
      case 'deliveryOrder': if (once('deliveryOrder')) B.say(LINES.deliveryOrder, 6500); break;
      case 'deliveryWork': if (once('deliveryWork')) B.say(LINES.deliveryWork, 6000); break;
      case 'deliveryRight': drop('deliveryMiss', 'deliveryRoundUp'); break;
      // (the leftover slip gets its own line, the first time it is made: rounding up is the point of the job)
      case 'deliveryMiss': if (data.slip === 'roundDown' && once('deliveryRoundUp')) B.say(LINES.deliveryRoundUp, 6500); else if (once('deliveryMiss')) B.say(LINES.deliveryMiss, 5000); break;
      case 'deliveryLoaded': if (once('deliveryLoaded')) B.say(LINES.deliveryLoaded); break;
      case 'deliveryArrive': if (once('deliveryArrive')) B.say(LINES.deliveryArrive, 3500); break;
      case 'deliveryDone': drop('deliveryArrive'); if (data.first && once('deliveryFirst')) B.say(LINES.deliveryFirst, 6000); else B.say(LINES.deliveryDone[(haulN++) % LINES.deliveryDone.length], 3500); break;
      case 'deliveryNoSaddle': if (once('deliveryNoSaddle')) B.say(LINES.deliveryNoSaddle); break;
      case 'deliveryRobbed': B.say(LINES.deliveryRobbed, 6000); break;
      case 'wagonArrive': if (once('wagonArrive')) B.say(touch() ? LINES.wagonArriveTouch : LINES.wagonArrive, 9000); break;
      case 'banditCatch': drop('banditMiss'); if (once('banditCatch')) B.say(LINES.banditCatch); break;
      case 'banditMiss': if (once(data.card ? 'banditMissCard' : 'banditMiss')) B.say(data.card ? LINES.banditMissCard : LINES.banditMiss, 6000); break;
      case 'banditLoop': if (once('banditLoop')) B.say(LINES.banditLoop); break;
      case 'banditsDone': drop('banditMiss', 'banditCatch', 'banditLoop'); B.say(LINES.banditsDone[(wagonN++) % LINES.banditsDone.length], 3500); break;
      case 'wagonStop': if (once('wagonStop')) B.say(LINES.wagonStop, 3000); break;
      case 'near': {
        const L = LINES[data.place], t = performance.now() / 1000;
        if (!Array.isArray(L) || t - (nearAt[data.place] ?? -1e9) < NEAR_AGAIN) break;
        nearAt[data.place] = t;
        B.say(L[(nearN[data.place] = ((nearN[data.place] ?? -1) + 1)) % L.length]);
        break;
      }
      case 'animal': {
        const L = LINES.animal[data.kind]; if (!L) break;
        if (once('animal_' + data.kind)) B.say(L, 7000);
        else B.say(LINES.animalAgain[(animalN++) % LINES.animalAgain.length].replace('{name}', data.name || 'That one'), 3000);
        break;
      }
      case 'animalGift': {
        // (said straight after the job's own line: ahead of any older tip still waiting its turn)
        const L = LINES.animalGift[data.kind]; if (!L) break;
        const text = L.replace('{name}', data.name || 'The little one') + (data.unlocked && LINES.animalUnlock[data.kind] ? ' ' + LINES.animalUnlock[data.kind] : '');
        if (speaking > 0) {
          let i = 0; queue.forEach((q, k) => { if (q.key === 'flockDone' || q.key === 'pigsDone' || q.key === 'waveDone') i = k + 1; });
          queue.splice(i, 0, { text, ms: 6500, key, at: now });
        } else B.say(text, 6500);
        break;
      }
      case 'animalGrew': B.say(LINES.animalGrew.replace('{name}', data.name || 'Your little one'), 3500); break;
      case 'goodsCollected': if (once('goodsCollected')) B.say(on.store === false ? LINES.goodsKept : LINES.goodsCollected, 6500); break;
      case 'goodsSold': if (once('goodsSold')) B.say(LINES.goodsSold, 4500); break;
      // deer photographs (missions/deerjob.js)
      case 'deerArrive': if (once('deerArrive')) B.say(LINES.deerArrive, 7000); break;
      case 'deerSpooked': B.say(LINES.deerSpooked[(spookN++) % LINES.deerSpooked.length], 4500); break;
      case 'deerSetup': if (once('deerSetup')) B.say(touch() ? LINES.deerSetupTouch : LINES.deerSetup, 7500); break;
      case 'deerFlip': if (once('deerFlip')) B.say(LINES.deerFlip, 5000); break;
      case 'deerRight': drop('deerWrong'); if (once('deerRight')) B.say(LINES.deerRight, 3500); break;
      // (the why, said at once over anything else: it is about the deer just picked)
      case 'deerWrong': queue.length = 0; speaking = 0; B.say(data.line, Math.max(5000, 1800 + String(data.line || '').length * 55), { urgent: true }); break;
      case 'deerDone': drop('deerWrong', 'deerRight'); B.say(LINES.deerDone[(deerN++) % LINES.deerDone.length], 4500); break;
      case 'deerStop': drop('deerWrong'); if (once('deerStop')) B.say(LINES.deerStop, 3500); break;
      case 'lootGuard': if (once('lootGuard')) B.say(LINES.lootGuard); break;
      case 'lootFled': if (once('lootFled')) B.say(LINES.lootFled, 3500); break;
      case 'lootLoaded': if (once('lootLoaded')) B.say(LINES.lootLoaded, 6500); break;
      case 'lootNoSaddle': if (once('lootNoSaddle')) B.say(LINES.lootNoSaddle, 6000); break;
      case 'lootShare': if (once('lootShare')) B.say(LINES.lootShare, 7000); break;
      case 'lootMiss': if (once('lootMiss')) B.say(LINES.lootMiss, 6000); break;
      case 'lootRight': drop('lootMiss'); break;
      case 'lootDone': drop('lootMiss', 'lootShare'); B.say(LINES.lootDone[(lootN++) % LINES.lootDone.length], 3500); break;
      case 'lootWord': B.say(LINES.lootWord.replace('{place}', data.place || 'another spot'), 6000); break;
      default: break;
    }
  }

  // ── THE HOOFPRINTS ────────────────────────────────────────────────────────────────────────────────────────────
  // The trail leads from just ahead of the player to the job the card up top is about (main.js says which, with
  // B.trailTo). The way is worked out over the land (src/trailpath.js): round buildings, fences, trees, deep water and
  // steep ground, keeping to the town's dirt trail and the wagon road where that is no longer way round. It is worked out
  // again when the job changes, when the job moves (the wagon rolls on), and when the player wanders well off it; the
  // prints the player has passed fade away behind them. The search runs a few milliseconds a frame, never all at once.
  const prints = [];
  const tex = printTexture();
  const geo = new THREE.PlaneGeometry(HOB.size[0], HOB.size[1]);
  geo.rotateX(-Math.PI / 2);
  const alongAttr = new THREE.InstancedBufferAttribute(new Float32Array(HOB.most), 1);
  alongAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aAlong', alongAttr);
  const U = { map: { value: tex }, uTime: { value: 0 }, uFade: { value: 0 }, uLen: { value: 1 }, uStart: { value: HOB.ahead } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    vertexShader: `attribute float aAlong; varying vec2 vUv; varying float vAlong;
      void main() { vUv = uv; vAlong = aAlong; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    // (uStart: the prints behind it, the ones the player has passed, are gone; the next few metres fade in)
    fragmentShader: `uniform sampler2D map; uniform float uTime, uFade, uLen, uStart; varying vec2 vUv; varying float vAlong;
      void main() {
        float a = texture2D(map, vUv).a;
        float w = fract((vAlong - uTime * ${HOB.pulse.toFixed(1)}) / ${HOB.wave.toFixed(1)});
        float glow = 0.85 + 1.6 * smoothstep(0.7, 0.97, w) * (1.0 - smoothstep(0.97, 1.0, w));
        float ends = smoothstep(uStart, uStart + 4.0, vAlong) * (1.0 - 0.5 * smoothstep(uLen - 8.0, uLen, vAlong));
        gl_FragColor = vec4(vec3(1.0, 0.82, 0.45) * glow * a * uFade * ends, 1.0);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, HOB.most);
  mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name = 'hob-hoofprints';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.visible = false;
  scene.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), nrm = new THREE.Vector3();

  // what the ground costs to cross, for the way finder (remembered to the metre: the land doesn't change)
  const ROAD_CELL = 2;
  let roadCells = null, roadsIn = false;
  const ground = new Map();
  function roadsNow() {
    if (roadCells && roadsIn) return;
    roadCells = new Set();
    const lines = [W.places.trail || []];
    const more = roads ? roads() : null;
    if (more && more.length) { lines.push(...more); roadsIn = true; }
    for (const L of lines) for (let i = 1; i < L.length; i++) {
      const [ax, az] = L[i - 1], [bx, bz] = L[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
      for (let s = 0; s <= n; s++) {
        const ci = Math.floor((ax + (bx - ax) * s / n) / ROAD_CELL), cj = Math.floor((az + (bz - az) * s / n) / ROAD_CELL);
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) roadCells.add((ci + di) + ',' + (cj + dj));
      }
    }
    ground.clear();
  }
  function cost(x, z) {
    const k = Math.round(x) + ',' + Math.round(z);
    let v = ground.get(k);
    if (v !== undefined) return v;
    if (W.blocked(x, z)) v = Infinity;
    else {
      const e = 1, gx = (W.heightAt(x + e, z) - W.heightAt(x - e, z)) / (2 * e), gz = (W.heightAt(x, z + e) - W.heightAt(x, z - e)) / (2 * e);
      const slope = Math.hypot(gx, gz);
      if (slope > HOB.steep) v = Infinity;
      else {
        v = 1 + 8 * Math.max(0, slope - 0.12);                   // (a climb costs more the steeper it is)
        if (W.waterAt(x, z) > 0.3) v += 3;                       // (wading a creek: allowed, but a ford or a bridge is better)
        if (roadCells.has(Math.floor(x / ROAD_CELL) + ',' + Math.floor(z / ROAD_CELL))) v *= HOB.road;
      }
    }
    if (ground.size > 400000) ground.clear();
    ground.set(k, v);
    return v;
  }

  // lay the prints along a path [[x, z], ...] (alternating left and right of its middle, HOB.step apart)
  function lay(path) {
    prints.length = 0;
    let along = 0, next = 0, n = 0;
    for (let i = 1; i < path.length && prints.length < HOB.most; i++) {
      const [ax, az] = path[i - 1], [bx, bz] = path[i], seg = Math.hypot(bx - ax, bz - az); if (seg < 1e-3) continue;
      const dx = (bx - ax) / seg, dz = (bz - az) / seg;
      while (next <= along + seg && prints.length < HOB.most) {
        const t = next - along, side = n % 2 ? HOB.side : -HOB.side;
        const x = ax + dx * t + dz * side, z = az + dz * t - dx * side;
        if (!W.blocked(x, z) && W.waterAt(x, z) < 0.35) prints.push({ x, z, h: Math.atan2(dx, dz), along: next });
        next += HOB.step; n++;
      }
      along += seg;
    }
    prints.forEach((p, i) => {
      // lying on the ground, along the slope
      const e = 0.3, hx = W.heightAt(p.x + e, p.z) - W.heightAt(p.x - e, p.z), hz = W.heightAt(p.x, p.z + e) - W.heightAt(p.x, p.z - e);
      nrm.set(-hx / (2 * e), 1, -hz / (2 * e)).normalize();
      // (the picture's top is the toe: turned so the toe points along the way to the job, the open heel behind)
      q.setFromUnitVectors(up, nrm).multiply(q2.setFromAxisAngle(up, p.h + Math.PI));
      pos.set(p.x, W.heightAt(p.x, p.z) + 0.04, p.z);
      m4.compose(pos, q, one); mesh.setMatrixAt(i, m4);
      alongAttr.array[i] = p.along;
    });
    mesh.count = prints.length;
    mesh.instanceMatrix.needsUpdate = true; alongAttr.needsUpdate = true;
    U.uLen.value = prints.length ? prints[prints.length - 1].along : 1;
  }

  let want = false, fade = 0, time = 0;
  let goal = null;            // the job the trail should lead to: { id, x, z, hide } (main.js, each frame)
  let shown = null;           // the trail laid now: { id, x, z, pts }
  let search = null;          // a way being worked out: { S, id, x, z }
  let ready = null;           // a way worked out, waiting for the old trail to fade before it is laid
  let gone = 0;               // metres along the laid trail the player has got to (the prints behind are gone)
  let checkT = 0, failed = null, firstSearch = true;
  B.trail = (on) => { want = !!on; };
  B.trailTo = (g) => { goal = g && Number.isFinite(g.x) && Number.isFinite(g.z) ? g : null; };
  function trailUpdate(dt, at) {
    const d = goal && at ? Math.hypot(at.x - goal.x, at.z - goal.z) : Infinity;
    const there = !goal || !at || d < HOB.goalNear || (goal.hide && Math.hypot(at.x - goal.hide.x, at.z - goal.hide.z) < goal.hide.r);
    // a new way is wanted: a different job, the job moved off, or the player wandered off the trail
    if ((checkT -= dt) <= 0 && want && goal && at && !there) {
      checkT = 0.25;
      let need = !shown || shown.id !== goal.id || Math.hypot(shown.x - goal.x, shown.z - goal.z) > HOB.moved;
      if (!need && shown.pts.length > 1) {
        const r = nearestAlong(shown.pts, at.x, at.z);
        if (r.off > HOB.stray) need = true;
        else gone = Math.max(gone, r.along);
      }
      const busy = (search && search.id === goal.id && Math.hypot(search.x - goal.x, search.z - goal.z) < HOB.moved) || (ready && ready.id === goal.id && !need);
      const waitFail = failed && failed.id === goal.id && now - failed.at < 8;
      if (need && !busy && !waitFail) {
        roadsNow();
        search = { S: makePathSearch({ from: { x: at.x, z: at.z }, to: { x: goal.x, z: goal.z }, cost, cell: HOB.cell, pad: HOB.pad }), id: goal.id, x: goal.x, z: goal.z };
      }
    }
    // a few milliseconds a frame on the search (more on the ride's first frame, so the first trail is there at once)
    if (search) {
      const t0 = performance.now(), budget = firstSearch ? 60 : HOB.budget;
      let st = 'running';
      while (st === 'running' && performance.now() - t0 < budget) st = search.S.step(200);
      if (st === 'done') { ready = { id: search.id, x: search.x, z: search.z, pts: search.S.path }; search = null; firstSearch = false; }
      else if (st === 'fail') { failed = { id: search.id, at: now }; search = null; firstSearch = false; }
    }
    // a new way is laid once the old trail has faded out (or straight away if none is showing)
    if (ready && fade < 0.02) {
      lay(ready.pts); shown = ready; ready = null; gone = 0;
      if (at) { const r = nearestAlong(shown.pts, at.x, at.z); gone = r.along; }
    }
    U.uStart.value = gone + HOB.ahead;
    const target = want && goal && shown && !ready && shown.id === goal.id && !there ? 1 : 0;
    fade += Math.sign(target - fade) * Math.min(Math.abs(target - fade), dt / 0.8);
  }
  B.update = (dt, at, o = {}) => {
    time += dt;
    if (voice && voice.update) voice.update(dt);
    now += dt;
    // On a narrow screen, while a job person's speech card is up (the trail boss's hello on arriving), Hob waits his
    // turn so the phone isn't all talk: his line goes away and comes back with the time it had left once they're done,
    // and what's waiting keeps its place (the time held doesn't count toward a job line going stale). If a line about
    // the job came up meanwhile, it goes first and the one from before (a tip, the ride's hello) waits its turn again.
    // And while a question is up where the player is (o.asking: the job asking, 'roundup' for a card or a wave at the
    // herd, 'store' at the counter...; 'panel' for a lock box or a menu), only that job's lines come: his tips and the
    // other jobs' lines wait (held), so a question and its why aren't talked over, in captions or in the read-aloud voice.
    asking = o.asking || null;
    const wait = !!o.hold && (innerWidth <= 760 || innerHeight <= 480) && !(voice && voice.babble);
    if (wait !== hold) {
      hold = wait;
      if (saying && !saying.urgent && speaking > 0) {
        if (hold) hud.caption(null);
        else if (!JOB[saying.key] && queue.some((q) => JOB[q.key])) { queue.unshift({ text: saying.text, ms: saying.ms, key: saying.key, at: now }); speaking = 0; saying = null; }
        else hud.caption(saying.text, Math.max(1500, (speaking - 0.4) * 1000));
      }
    }
    if (hold) for (const q of queue) q.at += dt;
    // (a job line that waited too long is dropped, not said late)
    for (let i = queue.length - 1; i >= 0; i--) if (JOB[queue[i].key] && queue[i].key !== 'waveDone' && now - queue[i].at > KEEP_JOB) queue.splice(i, 1);
    if (speaking > 0 && !(hold && saying && !saying.urgent) && (speaking -= dt) <= 0) saying = null;
    // (next: a line about a job before a tip, as a job line that waits too long is dropped and a tip can wait)
    if (speaking <= 0 && !hold && queue.length) {
      const j = queue.findIndex((q) => JOB[q.key] && !held(q.key));
      const i = j >= 0 ? j : queue.findIndex((q) => !held(q.key));
      if (i >= 0) { const q = queue.splice(i, 1)[0]; key = q.key; B.say(q.text, q.ms); key = null; }
    }
    if (sentTo && now > sentTo.until) sentTo = null;
    trailUpdate(dt, at);
    U.uFade.value = fade; U.uTime.value = time;
    mesh.visible = fade > 0.002 && mesh.count > 0;
  };
  // the place his last line sent the rider to, while it holds (main.js leads the trail there instead): 'stable' | null
  B.wants = () => (sentTo && now <= sentTo.until && !(sentTo.place === 'stable' && rider.owned && rider.owned.saddle) ? sentTo.place : null);
  Object.defineProperty(B, 'prints', { get: () => prints.length });
  // (for rigs: the trail laid now, and the job it leads to)
  B.trailState = () => ({ id: shown && shown.id, goal: goal && goal.id, prints: prints.length, fade, searching: !!search, gone, length: U.uLen.value,
    end: shown ? shown.pts[shown.pts.length - 1] : null, pts: shown ? shown.pts : null });
  B.dispose = () => { scene.remove(mesh); geo.dispose(); mat.dispose(); tex.dispose(); hud.caption(null); if (voice) voice.stop(); };
  return B;
}

// a horseshoe-shaped hoofprint with a soft glow round it, white on clear (the glow colour comes from the shader)
function printTexture() {
  const W = 128, H = 148, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const shoe = (ctx) => {
    ctx.beginPath(); ctx.ellipse(64, 70, 34, 44, 0, 0, Math.PI * 2); ctx.ellipse(64, 86, 17, 30, 0, 0, Math.PI * 2, true); ctx.fill('evenodd');
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(52, 96, 24, 26); ctx.restore();   // (the open heel)
  };
  // the glow: the shoe drawn blurred and faint, then the shoe itself on top
  c.filter = 'blur(10px)'; c.fillStyle = 'rgba(255,255,255,0.55)'; shoe(c);
  c.filter = 'none'; c.fillStyle = '#fff'; shoe(c);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
